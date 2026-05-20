from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.shifts import router as shifts_router
from routes.leaves import router as leaves_router
from routes.employees import router as employees_router

app = FastAPI(
    title="Work Scheduler API",
    description="Backend API for Work Scheduler mobile app",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shifts_router)
app.include_router(leaves_router)
app.include_router(employees_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
