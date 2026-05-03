import os
import traceback
from typing import List, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from news_logic import suggest_news_queries, run_monitor

app = FastAPI(title="Geopolitical News Intelligence API", version="1.0.0")

allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SuggestRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    n: int = Field(5, ge=1, le=50)


class SuggestResponse(BaseModel):
    queries: List[str]


class RunRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    queries: List[str] = Field(..., min_length=1)
    max_articles: int = Field(50, ge=1, le=500)
    top_n: int = Field(5, ge=1, le=50)
    max_age_hours: int = Field(24, ge=1, le=480)
    ranking_mode: Literal["local_embeddings", "keyword"] = "keyword"


@app.get("/api/health")
def health():
    key = os.getenv("OPENAI_API_KEY")
    return {
        "ok": True,
        "openai_key_configured": bool(key),
        "openai_key_length": len(key) if key else 0,
    }


@app.post("/api/suggest-queries", response_model=SuggestResponse)
def suggest(req: SuggestRequest):
    try:
        return {"queries": suggest_news_queries(req.topic, req.n)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{exc}\n{traceback.format_exc()}")


@app.post("/api/run-monitor")
def run(req: RunRequest):
    try:
        return run_monitor(
            topic=req.topic,
            queries=req.queries,
            max_articles=req.max_articles,
            top_n=req.top_n,
            max_age_hours=req.max_age_hours,
            ranking_mode=req.ranking_mode,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{exc}\n{traceback.format_exc()}")
