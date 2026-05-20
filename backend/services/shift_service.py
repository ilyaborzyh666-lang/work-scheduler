from datetime import datetime, timedelta
from typing import Optional
from firebase_admin import firestore
from firebase_admin_init import get_db
from models import (
    SHIFT_CONFIG, MAX_WEEKLY_HOURS, MIN_SHIFT_HOURS,
    MAX_SHIFT_HOURS, MIN_REST_HOURS,
)


def _week_bounds(date_str: str) -> tuple[str, str]:
    # שבוע עברי: ראשון (0) עד שבת (6)
    d = datetime.strptime(date_str, "%Y-%m-%d")
    days_since_sunday = (d.weekday() + 1) % 7  # ראשון = 0
    week_start = d - timedelta(days=days_since_sunday)
    week_end = week_start + timedelta(days=6)
    return week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")


def get_weekly_hours(employee_id: str, date_str: str) -> float:
    db = get_db()
    week_start, week_end = _week_bounds(date_str)
    docs = (
        db.collection("shifts")
        .where("employeeId", "==", employee_id)
        .where("status", "==", "approved")
        .where("date", ">=", week_start)
        .where("date", "<=", week_end)
        .stream()
    )
    return sum(d.to_dict().get("durationHours", 0) for d in docs)


def _shift_end_dt(data: dict) -> datetime:
    """מחשב datetime מדויק של סוף משמרת, כולל לילה שעובר חצות."""
    base = datetime.strptime(data["date"], "%Y-%m-%d")
    end_hour, end_min = map(int, data["endTime"].split(":"))
    end_dt = base.replace(hour=end_hour, minute=end_min)
    if data["type"] == "night":
        end_dt += timedelta(days=1)
    elif data["type"] == "afternoon":
        # צהוריים נגמר ב-23:00 — נשאר אותו יום, אין שינוי
        pass
    return end_dt


def get_last_shift_end(employee_id: str, date_str: str, shift_type: str) -> Optional[datetime]:
    """מחזיר datetime של סוף המשמרת הקודמת הרלוונטית.

    בודק גם משמרות באותו יום (לצורך בוקר+לילה) וגם יום קודם (לצורך צהוריים+בוקר).
    """
    db = get_db()
    target_date = datetime.strptime(date_str, "%Y-%m-%d")
    prev_date = (target_date - timedelta(days=1)).strftime("%Y-%m-%d")

    # חפש במסגרת של יומיים אחורה
    docs = (
        db.collection("shifts")
        .where("employeeId", "==", employee_id)
        .where("status", "==", "approved")
        .where("date", ">=", prev_date)
        .where("date", "<=", date_str)
        .stream()
    )

    candidates = []
    for doc in docs:
        data = doc.to_dict()
        # דלג על משמרות באותו יום עם אותו סוג
        if data["date"] == date_str and data["type"] == shift_type:
            continue
        end_dt = _shift_end_dt(data)
        candidates.append(end_dt)

    return max(candidates) if candidates else None


def validate_shift(
    shift_type: str,
    date_str: str,
    duration_hours: float,
    employee_id: str,
) -> Optional[str]:
    if duration_hours < MIN_SHIFT_HOURS:
        return f"משמרת מינימום {MIN_SHIFT_HOURS} שעות"
    if duration_hours > MAX_SHIFT_HOURS:
        return f"משמרת מקסימום {MAX_SHIFT_HOURS} שעות"

    config = SHIFT_CONFIG[shift_type]
    start_hour, start_min = map(int, config["start"].split(":"))
    shift_start_dt = datetime.strptime(date_str, "%Y-%m-%d").replace(
        hour=start_hour, minute=start_min
    )

    last_end = get_last_shift_end(employee_id, date_str, shift_type)
    if last_end:
        rest_hours = (shift_start_dt - last_end).total_seconds() / 3600
        if rest_hours < MIN_REST_HOURS:
            return f"חובה {MIN_REST_HOURS} שעות מנוחה בין משמרות (נותרו {MIN_REST_HOURS - rest_hours:.1f} שעות)"

    return None


def request_shift(
    employee_id: str,
    employee_name: str,
    date_str: str,
    shift_type: str,
    custom_hours: Optional[float] = None,
) -> dict:
    db = get_db()
    config = SHIFT_CONFIG[shift_type]
    duration = custom_hours if custom_hours is not None else config["hours"]

    # Check weekly hours
    weekly_hours = get_weekly_hours(employee_id, date_str)
    if weekly_hours + duration > MAX_WEEKLY_HOURS:
        return {"error": f"חרגת ממכסת {MAX_WEEKLY_HOURS} שעות שבועיות ({weekly_hours:.0f} + {duration:.0f} = {weekly_hours + duration:.0f})"}

    # Validate rest and duration
    error = validate_shift(shift_type, date_str, duration, employee_id)
    if error:
        return {"error": error}

    shift = {
        "employeeId": employee_id,
        "employeeName": employee_name,
        "date": date_str,
        "type": shift_type,
        "startTime": config["start"],
        "endTime": config["end"],
        "durationHours": duration,
        "status": "pending",
        "createdAt": datetime.utcnow().isoformat(),
    }
    ref = db.collection("shifts").add(shift)
    return {"id": ref[1].id, **shift}


def approve_shift(shift_id: str) -> None:
    db = get_db()
    shift_ref = db.collection("shifts").document(shift_id)
    shift_data = shift_ref.get().to_dict()
    if not shift_data:
        raise ValueError("Shift not found")

    shift_ref.update({"status": "approved"})

    employee_id = shift_data["employeeId"]
    new_weekly = get_weekly_hours(employee_id, shift_data["date"])

    user_ref = db.collection("users").document(employee_id)
    is_blocked = new_weekly >= MAX_WEEKLY_HOURS
    user_ref.update({"weeklyHours": new_weekly, "isBlocked": is_blocked})

    if is_blocked:
        _notify_manager_hours_limit(employee_id, shift_data["employeeName"], new_weekly)

    _notify_employee(employee_id, "shift_approved",
                     "המשמרת שלך אושרה",
                     f"משמרת {shift_data['date']} ({shift_data['type']}) אושרה על ידי המנהל")


def reject_shift(shift_id: str, employee_id: str, employee_name: str, date_str: str, shift_type: str) -> None:
    db = get_db()
    db.collection("shifts").document(shift_id).update({"status": "rejected"})
    _notify_employee(employee_id, "shift_rejected",
                     "המשמרת שלך נדחתה",
                     f"משמרת {date_str} ({shift_type}) נדחתה על ידי המנהל")


def update_shift_hours(shift_id: str, start_time: str, end_time: str, duration_hours: float) -> None:
    db = get_db()
    db.collection("shifts").document(shift_id).update({
        "startTime": start_time,
        "endTime": end_time,
        "durationHours": duration_hours,
    })


def _notify_employee(employee_id: str, notif_type: str, title: str, body: str) -> None:
    db = get_db()
    db.collection("notifications").add({
        "userId": employee_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "read": False,
        "createdAt": datetime.utcnow().isoformat(),
    })


def _notify_manager_hours_limit(employee_id: str, employee_name: str, hours: float) -> None:
    db = get_db()
    managers = db.collection("users").where("role", "==", "manager").stream()
    for mgr in managers:
        db.collection("notifications").add({
            "userId": mgr.id,
            "type": "hours_limit",
            "title": f"עובד הגיע לגבול השעות",
            "body": f"{employee_name} הגיע ל-{hours:.0f} שעות שבועיות (מקסימום {MAX_WEEKLY_HOURS}). ניתן לבטל חסימה.",
            "read": False,
            "createdAt": datetime.utcnow().isoformat(),
        })
