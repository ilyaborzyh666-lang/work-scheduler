from fastapi import APIRouter, Depends, HTTPException
from firebase_admin_init import get_db
from auth import require_manager
from models import BlockOverrideUpdate

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/")
def get_all_employees(ctx: dict = Depends(require_manager)):
    db = get_db()
    docs = db.collection("users").where("role", "==", "employee").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.patch("/{employee_id}/block-override")
def set_block_override(
    employee_id: str,
    body: BlockOverrideUpdate,
    ctx: dict = Depends(require_manager),
):
    db = get_db()
    user_ref = db.collection("users").document(employee_id)
    if not user_ref.get().exists:
        raise HTTPException(status_code=404, detail="Employee not found")
    user_ref.update({"blockOverride": body.override})
    return {"success": True, "blockOverride": body.override}


@router.get("/{employee_id}/weekly-hours")
def get_employee_weekly_hours(employee_id: str, date: str, ctx: dict = Depends(require_manager)):
    from services.shift_service import get_weekly_hours
    hours = get_weekly_hours(employee_id, date)
    return {"employeeId": employee_id, "weeklyHours": hours}
