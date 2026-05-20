from fastapi import APIRouter, Depends, HTTPException
from firebase_admin_init import get_db
from auth import require_employee, require_manager
from models import LeaveRequestBody, LeaveStatusUpdate
from services.leave_service import request_leave, approve_leave, reject_leave

router = APIRouter(prefix="/leaves", tags=["leaves"])


@router.post("/request")
def employee_request_leave(body: LeaveRequestBody, ctx: dict = Depends(require_employee)):
    user = ctx["user"]
    result = request_leave(
        employee_id=user["id"],
        employee_name=user["name"],
        start_date=body.start_date,
        end_date=body.end_date,
        reason=body.reason,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/my")
def get_my_leaves(ctx: dict = Depends(require_employee)):
    db = get_db()
    uid = ctx["uid"]
    docs = (
        db.collection("leaves")
        .where("employeeId", "==", uid)
        .order_by("createdAt", direction="DESCENDING")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.get("/pending")
def get_pending_leaves(ctx: dict = Depends(require_manager)):
    db = get_db()
    docs = (
        db.collection("leaves")
        .where("status", "==", "pending")
        .order_by("createdAt", direction="DESCENDING")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.patch("/{leave_id}/status")
def update_leave_status(
    leave_id: str,
    body: LeaveStatusUpdate,
    ctx: dict = Depends(require_manager),
):
    db = get_db()
    if not db.collection("leaves").document(leave_id).get().exists:
        raise HTTPException(status_code=404, detail="Leave not found")

    if body.status == "approved":
        approve_leave(leave_id)
    elif body.status == "rejected":
        reject_leave(leave_id)
    else:
        db.collection("leaves").document(leave_id).update({"status": body.status})

    return {"success": True}
