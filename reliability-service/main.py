from fastapi import FastAPI

from app.config import load_env_file

load_env_file()

from api.analyze import analyze_router
from api.insights import insights_router

app = FastAPI()

app.include_router(analyze_router)
app.include_router(insights_router)

@app.get("/")
def root():
    return {"service": "reliability-ai", "message": "initial development"}

@app.get("/health")
def health():
    return {"status": "ok"}
