from datetime import datetime, date
from typing import Optional
from firebase_admin_init import get_db
from models import SHORT_LEAVE_MAX_DAYS, SHORT_LEAVE_NOTICE_DAYS, LONG_LEAVE_NOTICE_DAYS


def _parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def days_between(start: str, end: str) -> int:
    return (_parse_date(end) - _parse_date(start)).days + 1


def days_from_today(date_str: str) -> int:
    return (_parse_date(date_str) - date.today()).days


def validate_leave(start_date: str, end_date: str) -> Optional[str]:
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    if end < start:
        return "תאריך סיום חייב להיות אחרי תאריך התחלה"

    duration = days_between(start_date, end_date)
    days_ahead = days_from_today(start_date)

    if duration <= SHORT_LEAVE_MAX_DAYS:
        if days_ahead < SHORT_LEAVE_NOTICE_DAYS:
            return f"חופשה קצרה (1-2 ימים) דורשת {SHORT_LEAVE_NOTICE_DAYS} ימי הודעה מראש"
    else:
        if days_ahead < LONG_LEAVE_NOTICE_DAYS:
            remaining = LONG_LEAVE_NOTICE_DAYS - days_ahead
            return f"חופשה ארוכה (3+ ימים) דורשת {LONG_LEAVE_NOTICE_DAYS} ימי הודעה מראש (חסרים {remaining} ימים)"

    return None


def request_leave(
    employee_id: str,
    employee_name: str,
    start_date: str,
    end_date: str,
    reason: str,
) -> dict:
    error = validate_leave(start_date, end_date)
    if error:
        return {"error": error}

    db = get_db()
    leave = {
        "employeeId": employee_id,
        "employeeName": employee_name,
        "startDate": start_date,
        "endDate": end_date,
        "durationDays": days_between(start_date, end_date),
        "reason": reason,
        "status": "pending",
        "createdAt": datetime.utcnow().isoformat(),
    }
    ref = db.collection("leaves").add(leave)
    return {"id": ref[1].id, **leave}


def approve_leave(leave_id: str) -> None:
    db = get_db()
    leave_ref = db.collection("leaves").document(leave_id)
    leave_data = leave_ref.get().to_dict()
    if not leave_data:
        raise ValueError("Leave not found")

    leave_ref.update({"status": "approved"})
    _notify_employee(
        leave_data["employeeId"],
        "leave_approved",
        "בקשת החופשה אושרה",
        f"החופשה שלך מ-{leave_data['startDate']} עד {leave_data['endDate']} אושרה",
    )


def reject_leave(leave_id: str) -> None:
    db = get_db()
    leave_ref = db.collection("leaves").document(leave_id)
    leave_data = leave_ref.get().to_dict()
    if not leave_data:
        raise ValueError("Leave not found")

    leave_ref.update({"status": "rejected"})
    _notify_employee(
        leave_data["employeeId"],
        "leave_rejected",
        "בקשת החופשה נדחתה",
        f"החופשה שלך מ-{leave_data['startDate']} עד {leave_data['endDate']} נדחתה",
    )


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
