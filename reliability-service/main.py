import logging
import os

from fastapi import FastAPI

from app.config import load_env_file

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("reliability-service")

load_env_file()

from api.analyze import analyze_router
from api.insights import insights_router

app = FastAPI()

@app.on_event("startup")
def startup_event():
    logger.info("Starting reliability-service")
    logger.info(f"UPSTAT_GRPC_ADDRESS={os.getenv('UPSTAT_GRPC_ADDRESS', '<unset>')}")
    logger.info(f"UPSTAT_GRPC_AUTH_TOKEN set={bool(os.getenv('UPSTAT_GRPC_AUTH_TOKEN'))}")

app.include_router(analyze_router)
app.include_router(insights_router)

@app.get("/")
def root():
    return {"service": "reliability-ai", "message": "initial development"}

@app.get("/health")
def health():
    return {"status": "ok"}
