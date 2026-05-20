import os
import firebase_admin
from firebase_admin import credentials, firestore

_app = None


def get_firebase_app():
    global _app
    if _app is None:
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
        # project: sidur-avoda-bdd29
        cred = credentials.Certificate(service_account_path)
        _app = firebase_admin.initialize_app(cred)
    return _app


def get_db() -> firestore.Client:
    get_firebase_app()
    return firestore.client()
