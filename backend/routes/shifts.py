from fastapi import APIRouter, Depends, HTTPException
from firebase_admin_init import get_db
from auth import require_employee, require_manager
from models import ShiftRequest, ShiftStatusUpdate, ShiftHoursUpdate
from services.shift_service import (
    request_shift, approve_shift, reject_shift, update_shift_hours,
)

router = APIRouter(prefix="/shifts", tags=["shifts"])


@router.post("/request")
def employee_request_shift(body: ShiftRequest, ctx: dict = Depends(require_employee)):
    user = ctx["user"]

    if user.get("isBlocked") and not user.get("blockOverride"):
        raise HTTPException(status_code=403, detail="חסום — הגעת לגבול 60 שעות שבועיות")

    result = request_shift(
        employee_id=user["id"],
        employee_name=user["name"],
        date_str=body.date,
        shift_type=body.type,
        custom_hours=None,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/my")
def get_my_shifts(ctx: dict = Depends(require_employee)):
    db = get_db()
    uid = ctx["uid"]
    docs = (
        db.collection("shifts")
        .where("employeeId", "==", uid)
        .order_by("date", direction="DESCENDING")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.get("/date/{date_str}")
def get_shifts_by_date(date_str: str, ctx: dict = Depends(require_manager)):
    db = get_db()
    docs = db.collection("shifts").where("date", "==", date_str).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.get("/pending")
def get_pending_shifts(ctx: dict = Depends(require_manager)):
    db = get_db()
    docs = (
        db.collection("shifts")
        .where("status", "==", "pending")
        .order_by("createdAt", direction="DESCENDING")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.patch("/{shift_id}/status")
def update_shift_status(
    shift_id: str,
    body: ShiftStatusUpdate,
    ctx: dict = Depends(require_manager),
):
    db = get_db()
    shift_ref = db.collection("shifts").document(shift_id)
    shift_doc = shift_ref.get()
    if not shift_doc.exists:
        raise HTTPException(status_code=404, detail="Shift not found")

    shift_data = shift_doc.to_dict()

    if body.status == "approved":
        approve_shift(shift_id)
    elif body.status == "rejected":
        reject_shift(
            shift_id,
            shift_data["employeeId"],
            shift_data["employeeName"],
            shift_data["date"],
            shift_data["type"],
        )
    else:
        shift_ref.update({"status": body.status})

    return {"success": True}


@router.patch("/{shift_id}/hours")
def edit_shift_hours(
    shift_id: str,
    body: ShiftHoursUpdate,
    ctx: dict = Depends(require_manager),
):
    db = get_db()
    if not db.collection("shifts").document(shift_id).get().exists:
        raise HTTPException(status_code=404, detail="Shift not found")
    update_shift_hours(shift_id, body.start_time, body.end_time, body.duration_hours)
    return {"success": True}


@router.delete("/{shift_id}")
def delete_shift(shift_id: str, ctx: dict = Depends(require_manager)):
    db = get_db()
    db.collection("shifts").document(shift_id).delete()
    return {"success": True}
