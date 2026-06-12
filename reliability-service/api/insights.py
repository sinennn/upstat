from fastapi import APIRouter
from services.insight_generator import generate_insight

insights_router = APIRouter()

@insights_router.get("/insights/{monitor_id}")
def get_insights(monitor_id: str):
    return generate_insight(monitor_id).to_dict()
