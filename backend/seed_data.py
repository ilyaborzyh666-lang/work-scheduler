"""
סקריפט זריעת נתונים: 12 עובדים + משמרות
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from firebase_admin_init import get_db
from datetime import date, timedelta
import uuid

db = get_db()

EMPLOYEES = [
    {"name": "ישראל ישראלי",   "email": "israel@work.com"},
    {"name": "שרה כהן",         "email": "sara@work.com"},
    {"name": "דוד לוי",         "email": "david@work.com"},
    {"name": "מיכל אברהם",      "email": "michal@work.com"},
    {"name": "יוסי מזרחי",      "email": "yossi@work.com"},
    {"name": "רחל פרץ",         "email": "rachel@work.com"},
    {"name": "אבי גולן",         "email": "avi@work.com"},
    {"name": "נועה שפירא",       "email": "noa@work.com"},
    {"name": "עמי בן דוד",       "email": "ami@work.com"},
    {"name": "תמר אלון",         "email": "tamar@work.com"},
    {"name": "רון כץ",           "email": "ron@work.com"},
    {"name": "לילי שמש",         "email": "lily@work.com"},
]

SHIFT_TYPES = ["morning", "afternoon", "night"]

# תאריכים: השבוע הנוכחי (7 ימים קדימה)
today = date.today()
dates = [(today + timedelta(days=i)).isoformat() for i in range(7)]

# מחיקת עובדים ומשמרות קיימים (לא מנהלים)
print("מוחק נתונים קיימים...")
existing = db.collection("users").where("role", "==", "employee").stream()
for doc in existing:
    doc.reference.delete()

existing_shifts = db.collection("shifts").stream()
for doc in existing_shifts:
    doc.reference.delete()

print("מוסיף 12 עובדים...")
employee_ids = []
for emp in EMPLOYEES:
    doc_ref = db.collection("users").document()
    doc_ref.set({
        "name": emp["name"],
        "email": emp["email"],
        "role": "employee",
        "isBlocked": False,
        "blockOverride": False,
    })
    employee_ids.append({"id": doc_ref.id, **emp})
    print(f"  נוסף: {emp['name']} ({doc_ref.id})")

print("\nמוסיף משמרות...")

SHIFT_CONFIG = {
    "morning":   {"start": "07:00", "end": "15:00", "hours": 8},
    "afternoon": {"start": "15:00", "end": "23:00", "hours": 8},
    "night":     {"start": "23:00", "end": "07:00", "hours": 8},
}

# 4 עובדים ראשונים - משמרות בוקר בכל הימים (זהות)
for emp in employee_ids[:4]:
    for d in dates:
        ref = db.collection("shifts").document()
        ref.set({
            "employeeId": emp["id"],
            "employeeName": emp["name"],
            "date": d,
            "type": "morning",
            "status": "approved",
            "startTime": SHIFT_CONFIG["morning"]["start"],
            "endTime": SHIFT_CONFIG["morning"]["end"],
            "durationHours": SHIFT_CONFIG["morning"]["hours"],
        })

# 4 עובדים אמצעיים - משמרות צהריים בכל הימים (זהות)
for emp in employee_ids[4:8]:
    for d in dates:
        ref = db.collection("shifts").document()
        ref.set({
            "employeeId": emp["id"],
            "employeeName": emp["name"],
            "date": d,
            "type": "afternoon",
            "status": "approved",
            "startTime": SHIFT_CONFIG["afternoon"]["start"],
            "endTime": SHIFT_CONFIG["afternoon"]["end"],
            "durationHours": SHIFT_CONFIG["afternoon"]["hours"],
        })

# 4 עובדים אחרונים - משמרות מעורבות (שונות)
mixed_schedule = [
    ["morning", "afternoon", "night", "morning", "afternoon", "night", "morning"],
    ["afternoon", "night", "morning", "night", "morning", "afternoon", "night"],
    ["night", "morning", "afternoon", "afternoon", "night", "morning", "afternoon"],
    ["morning", "night", "afternoon", "morning", "night", "afternoon", "morning"],
]
for i, emp in enumerate(employee_ids[8:]):
    for j, d in enumerate(dates):
        shift_type = mixed_schedule[i][j]
        ref = db.collection("shifts").document()
        ref.set({
            "employeeId": emp["id"],
            "employeeName": emp["name"],
            "date": d,
            "type": shift_type,
            "status": "approved",
            "startTime": SHIFT_CONFIG[shift_type]["start"],
            "endTime": SHIFT_CONFIG[shift_type]["end"],
            "durationHours": SHIFT_CONFIG[shift_type]["hours"],
        })

print("\nסיום! נוספו 12 עובדים ומשמרות לשבוע הקרוב.")
print("- עובדים 1-4: משמרות בוקר (זהות)")
print("- עובדים 5-8: משמרות צהריים (זהות)")
print("- עובדים 9-12: משמרות מעורבות (שונות)")
