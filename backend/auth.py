from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from firebase_admin_init import get_firebase_app, get_db

bearer_scheme = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    get_firebase_app()
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def require_manager(token: dict = Depends(verify_token)) -> dict:
    db = get_db()
    uid = token["uid"]
    doc = db.collection("users").document(uid).get()
    if not doc.exists or doc.to_dict().get("role") != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    return {**token, "user": doc.to_dict()}


def require_employee(token: dict = Depends(verify_token)) -> dict:
    db = get_db()
    uid = token["uid"]
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {**token, "user": doc.to_dict()}
