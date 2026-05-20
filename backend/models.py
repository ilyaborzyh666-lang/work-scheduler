from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from datetime import date

ShiftType = Literal["morning", "afternoon", "night"]
ShiftStatus = Literal["pending", "approved", "rejected"]
LeaveStatus = Literal["pending", "approved", "rejected"]

SHIFT_CONFIG = {
    "morning":   {"start": "07:00", "end": "15:00", "hours": 8},
    "afternoon": {"start": "15:00", "end": "23:00", "hours": 8},
    "night":     {"start": "23:00", "end": "07:00", "hours": 8},
}

MAX_WEEKLY_HOURS = 60
MIN_SHIFT_HOURS = 8
MAX_SHIFT_HOURS = 12
MIN_REST_HOURS = 8
SHORT_LEAVE_MAX_DAYS = 2
SHORT_LEAVE_NOTICE_DAYS = 2
LONG_LEAVE_NOTICE_DAYS = 30


class ShiftRequest(BaseModel):
    date: str          # YYYY-MM-DD
    type: ShiftType
    custom_hours: Optional[float] = None  # מנהל בלבד


class ShiftStatusUpdate(BaseModel):
    status: ShiftStatus


class ShiftHoursUpdate(BaseModel):
    start_time: str   # HH:MM
    end_time: str     # HH:MM
    duration_hours: float

    @field_validator("duration_hours")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        if v < MIN_SHIFT_HOURS or v > MAX_SHIFT_HOURS:
            raise ValueError(f"שעות חייבות להיות בין {MIN_SHIFT_HOURS} ל-{MAX_SHIFT_HOURS}")
        return v


class LeaveRequestBody(BaseModel):
    start_date: str   # YYYY-MM-DD
    end_date: str     # YYYY-MM-DD
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("חובה למלא סיבה לחופשה")
        return v.strip()


class LeaveStatusUpdate(BaseModel):
    status: LeaveStatus


class BlockOverrideUpdate(BaseModel):
    override: bool
