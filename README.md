# Geopolitical News Intelligence Web App

This is a web version of your PyQt geopolitical news app.

It keeps your original table columns:

- Rank
- Score
- Title
- Source
- Published
- Link

The project has two parts:

```text
backend/   FastAPI API with your news, ranking, article extraction, and OpenAI summary logic
frontend/  React + Vite + Tailwind UI
```

## Local setup

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="your_api_key_here"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:8000/api/health
```

If your machine or Render instance struggles with `sentence-transformers`, use the lighter install instead:

```bash
pip install -r requirements-light.txt
```

The app will then fall back to keyword ranking.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

By default, the frontend calls:

```text
http://localhost:8000
```

To point it elsewhere, create `frontend/.env`:

```text
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

## Render deployment

### Recommended Render setup

Deploy two services from the same GitHub repo.

### Backend service

Type: **Web Service**

Root directory:

```text
backend
```

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```text
OPENAI_API_KEY=your_api_key_here
CORS_ORIGINS=*
OPENAI_QUERY_MODEL=gpt-4.1-mini
OPENAI_SUMMARY_MODEL=gpt-4.1
```

For a lighter backend, set the build command to:

```bash
pip install -r requirements-light.txt
```

and choose **Lightweight keyword ranking** in the UI.

### Frontend service

Type: **Static Site**

Root directory:

```text
frontend
```

Build command:

```bash
npm ci && npm run build
```

Publish directory:

```text
dist
```

Environment variable:

```text
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

Replace `https://your-backend-url.onrender.com` with the real URL of your Render backend service.

## API endpoints

### Health

```http
GET /api/health
```

### Suggest queries

```http
POST /api/suggest-queries
```

Payload:

```json
{
  "topic": "Iran war",
  "n": 5
}
```

### Run monitor

```http
POST /api/run-monitor
```

Payload:

```json
{
  "topic": "Iran war",
  "queries": ["Iran war", "Iran Israel escalation", "Hormuz oil risk"],
  "max_articles": 50,
  "top_n": 5,
  "max_age_hours": 24,
  "ranking_mode": "local_embeddings"
}
```

`ranking_mode` can be:

```text
local_embeddings
keyword
```

## Notes

- The backend uses Google News RSS.
- Top article bodies are extracted server-side before summary generation.
- The frontend CSV export preserves the visible table columns only.
- The `Link` column is intentionally kept in the table, as requested.
