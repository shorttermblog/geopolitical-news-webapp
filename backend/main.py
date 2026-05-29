import os
import traceback
from typing import List, Literal, Union

import feedparser
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from news_logic import suggest_news_queries, run_monitor


app = FastAPI(
    title="Geopolitical News Intelligence API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Root route
# ============================================================

@app.get("/")
def root():
    return {
        "ok": True,
        "message": "Geopolitical News Intelligence API is running.",
        "routes": [
            "GET /",
            "GET /api/health",
            "GET /api/debug-google-news",
            "POST /api/suggest-queries",
            "POST /api/run-monitor",
        ],
    }


# ============================================================
# Request / response models
# ============================================================

class SuggestRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    user_prompt: str = ""
    n: int = Field(5, ge=1, le=50)


class SuggestResponse(BaseModel):
    queries: List[str]


class RunRequest(BaseModel):
    topic: str = Field(..., min_length=1)

    # Accepts either:
    # - a normal list: ["Iran war", "Iran sanctions"]
    # - a multiline textarea string: "Iran war\nIran sanctions"
    queries: Union[List[str], str]

    max_articles: int = Field(50, ge=1, le=500)
    top_n: int = Field(5, ge=1, le=50)
    max_age_hours: int = Field(24, ge=1, le=480)
    ranking_mode: Literal["local_embeddings", "keyword"] = "keyword"


# ============================================================
# API routes
# ============================================================

@app.get("/api/health")
def health():
    key = os.getenv("OPENAI_API_KEY")

    return {
        "ok": True,
        "openai_key_configured": bool(key),
        "openai_key_length": len(key) if key else 0,
    }


@app.get("/api/debug-google-news")
def debug_google_news(q: str = "Iran war"):
    """
    Diagnostic route to test whether Google News RSS is reachable
    from this Render service.

    Test examples:
    /api/debug-google-news?q=Iran%20war
    /api/debug-google-news?q=Nvidia%20stock
    """

    url = "https://news.google.com/rss/search"

    params = {
        "q": q,
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }

    header_sets = {
        "simple": {
            "User-Agent": "Mozilla/5.0",
        },
        "browser_like_rss": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://news.google.com/",
        },
        "browser_like_html": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://news.google.com/",
        },
    }

    results = {}

    for name, headers in header_sets.items():
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=20,
            )

            feed = feedparser.parse(response.content)

            results[name] = {
                "status_code": response.status_code,
                "content_type": response.headers.get("Content-Type"),
                "final_url": response.url,
                "first_300_chars": response.text[:300],
                "feed_entries": len(feed.entries),
                "feed_bozo": getattr(feed, "bozo", None),
                "feed_bozo_exception": str(getattr(feed, "bozo_exception", "")),
            }

        except Exception as exc:
            results[name] = {
                "error": repr(exc),
            }

    return {
        "query": q,
        "results": results,
    }


@app.post("/api/suggest-queries", response_model=SuggestResponse)
def suggest(req: SuggestRequest):
    try:
        return {
            "queries": suggest_news_queries(
                topic=req.topic,
                user_prompt=req.user_prompt,
                n=req.n,
            )
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"{exc}\n{traceback.format_exc()}",
        )


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
        raise HTTPException(
            status_code=500,
            detail=f"{exc}\n{traceback.format_exc()}",
        )
