from fastapi import APIRouter
from services.insight_generator import generate_insight

analyze_router = APIRouter()

@analyze_router.post("/analyze/{monitor_id}")
def analyze(monitor_id: str):
    return generate_insight(monitor_id).to_dict()
