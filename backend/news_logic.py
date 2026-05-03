import os
import json
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode

import feedparser
import pandas as pd
from openai import OpenAI

try:
    from sentence_transformers import SentenceTransformer, util
except Exception:
    SentenceTransformer = None
    util = None


def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("Set OPENAI_API_KEY in environment variables.")
    return OpenAI(api_key=api_key)


def chat_text(system_prompt, user_prompt, model, temperature=0.4):
    """Use Chat Completions because the Render OpenAI package may not support Responses."""
    client = get_openai_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
    )
    return response.choices[0].message.content or ""


KEYWORD_SUGGESTION_SYSTEM_PROMPT = """
You are a professional geopolitical news monitoring assistant.

Your task is to generate effective Google News RSS search queries for a given geopolitics, conflict, security, or international relations topic.

The topic may be:
- a war or armed conflict
- a country or region
- a leader or government
- a military escalation
- a diplomatic negotiation
- sanctions
- ceasefire talks
- terrorism or insurgency
- border tensions
- humanitarian crisis
- energy-security risk
- shipping-route disruption
- alliance or international institution activity
- geopolitical event with market, security, or humanitarian impact

The goal is to retrieve recent, relevant, high-signal news articles.

Important:
Google News RSS works best with short keyword queries.
Do not make queries too specific.
Do not combine too many angles in one query.
The app will rank and filter articles later, so queries should be broad enough to retrieve useful results.

First, infer the most likely geopolitical category internally.
Do not output the category unless explicitly requested.

Query style rules:
- Each query should usually contain 2 to 6 words.
- Each query should focus on one main geopolitical angle only.
- Prefer simple keyword-style searches.
- Prefer entity + angle format.
- Avoid long sentence-like queries.
- Avoid combining many concepts in one query.
- Avoid overly narrow queries that may return few or no articles.
- Avoid duplicates and near-duplicates.
- Include at least one broad core query.
- Include a few angle-specific queries.
- Vary the angles naturally across repeated generations.
- Do not include explanations, numbering, markdown, or comments.

Freshness rules:
- The queries are for current geopolitical news monitoring, not historical research.
- Use the current date only as context.
- Do not include any year unless the user explicitly includes a year in the topic.
- Do not automatically add the current year.
- Prefer current or recent developments.
- Prefer words such as latest, today, update, talks, ceasefire, sanctions, attack, escalation, diplomacy, warning, negotiations, and crisis only when useful.

Geopolitical relevance rules:
- Prefer queries likely to surface material geopolitical developments.
- Prioritize military actions, diplomacy, sanctions, ceasefire talks, territorial changes, leaders, alliances, energy risk, shipping risk, humanitarian impact, refugees, regional spillovers, and international institutions.
- Avoid low-signal opinion commentary unless the topic clearly requires political analysis.
- Avoid vague or generic queries that are likely to retrieve unrelated articles.
- For countries, include the country name and one clear angle.
- For conflicts, include the main actors and one clear angle when useful.

War / armed conflict guidance:
For wars and armed conflicts, cover a balanced mix of:
- war
- attack
- strikes
- missile attack
- drone attack
- military escalation
- ceasefire
- peace talks
- front line
- casualties
- civilian impact
- humanitarian crisis
- refugees
- sanctions
- diplomacy
- regional spillover

Diplomacy / negotiations guidance:
For diplomatic topics, use angles such as:
- talks
- negotiations
- ceasefire talks
- peace plan
- mediation
- summit
- foreign minister
- UN Security Council
- international pressure
- deal
- agreement
- diplomatic warning

Sanctions / economic pressure guidance:
For sanctions and economic-pressure topics, use angles such as:
- sanctions
- export controls
- asset freeze
- oil sanctions
- banking sanctions
- trade restrictions
- enforcement
- retaliation
- economic impact
- energy impact

Middle East guidance:
For Middle East conflicts or tensions, use angles such as:
- Israel
- Iran
- Gaza
- Lebanon
- Hezbollah
- Hamas
- Syria
- Iraq
- Yemen
- Houthis
- Red Sea
- Hormuz
- oil risk
- ceasefire
- hostages
- regional escalation

Russia / Ukraine guidance:
For Russia-Ukraine topics, use angles such as:
- Ukraine war
- Russia strikes
- drone attacks
- front line
- peace talks
- NATO
- weapons aid
- sanctions
- energy infrastructure
- Black Sea
- prisoner exchange
- battlefield update

China / Taiwan / Asia-Pacific guidance:
For China, Taiwan, or Asia-Pacific tensions, use angles such as:
- Taiwan Strait
- China military drills
- South China Sea
- Philippines
- Japan
- US China
- sanctions
- trade restrictions
- defense pact
- naval patrol
- chip restrictions
- regional security

Energy and shipping risk guidance:
For geopolitical topics with energy or trade implications, use angles such as:
- oil prices
- gas supply
- shipping routes
- Red Sea shipping
- Hormuz
- sanctions
- supply risk
- energy security
- commodity impact
- trade disruption

Humanitarian impact guidance:
For humanitarian crises, use angles such as:
- civilian casualties
- refugees
- humanitarian aid
- food crisis
- hospitals
- evacuation
- displacement
- UN aid
- border crossing
- famine risk

International institutions guidance:
For UN, NATO, EU, G7, or other institutions, use angles such as:
- UN Security Council
- NATO response
- EU sanctions
- G7 statement
- peacekeepers
- international court
- war crimes
- aid package
- diplomatic pressure

Output rules:
- Return only valid JSON.
- Return queries in this exact shape:
{
  "queries": [
    "query one",
    "query two"
  ]
}
"""



def extract_json_object(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


def suggest_news_queries(topic: str, n: int = 5):
    if not topic or not topic.strip():
        raise ValueError("Topic cannot be empty.")

    topic = topic.strip()
    today = datetime.now().strftime("%Y-%m-%d")
    prompt = f"""
Today is {today}. Use this date only to understand what counts as current or recent. Do not automatically include a year in the queries.

Topic: {topic}

Generate {n} Google News RSS search queries focused on geopolitical, conflict, diplomatic, security, humanitarian, and regional-risk developments.

Good examples for topic "Iran war":
Iran war
Iran Israel escalation
US Iran talks
Iran sanctions
Hormuz oil risk

Return JSON in this exact shape:
{{"queries": ["query one", "query two"]}}
"""

    output_text = chat_text(
        KEYWORD_SUGGESTION_SYSTEM_PROMPT,
        prompt,
        model=os.getenv("OPENAI_QUERY_MODEL", "gpt-4.1-mini"),
        temperature=0.4,
    )
    data = extract_json_object(output_text)

    cleaned = []
    seen = set()
    for q in data.get("queries", []):
        q = str(q).strip()
        if not q:
            continue
        key = q.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(q)
    return cleaned[:n]


_embedding_model = None


def get_embedding_model():
    global _embedding_model
    if SentenceTransformer is None or util is None:
        return None
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


def fetch_google_news(topic: str, max_articles: int = 50):
    params = urlencode({"q": topic, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    url = f"https://news.google.com/rss/search?{params}"
    feed = feedparser.parse(url)
    articles = []
    for entry in feed.entries[:max_articles]:
        articles.append({
            "title": entry.title if "title" in entry else "",
            "link": entry.link if "link" in entry else "",
            "published": entry.published if "published" in entry else "",
            "source": entry.source.title if "source" in entry else "",
            "query": topic,
        })
    return pd.DataFrame(articles)


def fetch_multiple_queries(queries, max_articles_per_query=50):
    dfs = []
    query_counts = {}
    total_raw_downloaded = 0
    for q in queries:
        q = q.strip()
        if not q:
            continue
        df = fetch_google_news(q, max_articles_per_query)
        count = len(df)
        query_counts[q] = count
        total_raw_downloaded += count
        if not df.empty:
            dfs.append(df)
    if not dfs:
        return pd.DataFrame(), total_raw_downloaded, 0, query_counts
    df = pd.concat(dfs, ignore_index=True)
    if "link" in df.columns:
        df = df.drop_duplicates(subset="link")
    return df.reset_index(drop=True), total_raw_downloaded, len(df), query_counts


def parse_date(date_str):
    try:
        dt = parsedate_to_datetime(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def filter_recent_articles(df, max_age_hours):
    if df.empty:
        return df
    now = datetime.now(timezone.utc)

    def is_recent(date_str):
        published = parse_date(date_str)
        if not published:
            return False
        hours_old = (now - published).total_seconds() / 3600
        return 0 <= hours_old <= max_age_hours

    return df[df["published"].apply(is_recent)].reset_index(drop=True)


def _keyword_score(text, topic):
    text_l = text.lower()
    terms = [t for t in topic.lower().replace("-", " ").split() if len(t) > 2]
    if not terms:
        return 0.0
    hits = sum(1 for t in terms if t in text_l)
    return min(1.0, hits / max(1, len(set(terms))))


def rank_articles(df, topic, recency_window_hours=72, ranking_mode="keyword"):
    if df.empty:
        return df
    df = df.copy()
    now = datetime.now(timezone.utc)
    texts = (df["title"].fillna("") + " " + df["source"].fillna("") + " " + df["query"].fillna("")).tolist()

    model = get_embedding_model() if ranking_mode == "local_embeddings" else None
    if model is not None and util is not None:
        ranking_query = topic + " " + " ".join(df["query"].dropna().unique())
        query_embedding = model.encode(ranking_query, convert_to_tensor=True)
        article_embeddings = model.encode(texts, convert_to_tensor=True)
        similarities = util.cos_sim(query_embedding, article_embeddings)[0].cpu().numpy()
        df["relevance"] = similarities
    else:
        df["relevance"] = [_keyword_score(t, topic) for t in texts]

    def recency(date_str):
        d = parse_date(date_str)
        if not d:
            return 0.0
        hours_old = (now - d).total_seconds() / 3600
        return max(0.0, 1.0 - hours_old / max(1, recency_window_hours))

    df["recency"] = df["published"].apply(recency)
    df["score"] = df["relevance"] * 0.8 + df["recency"] * 0.2
    df = df.sort_values("score", ascending=False).reset_index(drop=True)
    df.insert(0, "rank", df.index + 1)
    return df


def summarize(df, topic, n=5):
    if df.empty:
        return "No recent articles found for this time filter."

    articles_text = ""
    for _, r in df.head(n).iterrows():
        articles_text += f"""
Rank: {r.get('rank', '')}
Title: {r.get('title', '')}
Source: {r.get('source', '')}
Date: {r.get('published', '')}
Query: {r.get('query', '')}
"""

    prompt = f"""
You are a professional geopolitical analyst preparing a clear, high-quality conflict and international affairs briefing.

Topic: {topic}

You are given recent news articles. Some include article body excerpts. Some may include only headlines and metadata.

Your task is to synthesize them into a structured geopolitical summary.

Critical reliability rules:

- Use only information visible in the provided article titles, metadata, and body excerpts.
- Do not invent facts that are not supported by the provided text.
- If an article body is unavailable, rely only on the headline and metadata for that article.
- Do not imply that you read full articles when only excerpts are provided.

Instructions:

- Produce 4 to 7 bullet points when enough information is available.
- Each bullet should be 1 to 3 sentences.
- Each bullet should represent a distinct, meaningful geopolitical development.
- Combine related headlines into a single insight.
- Avoid repeating the same story across multiple bullets.
- Prioritize what is new, material, or strategically important.
- Briefly explain why each development matters when the provided text supports it.
- Focus on:
  • military actions, attacks, ceasefires, front lines, or escalation
  • diplomacy, negotiations, sanctions, mediation, or international pressure
  • involvement of major countries, leaders, armed groups, alliances, or institutions
  • humanitarian impact, civilian risk, refugees, aid, or displacement
  • regional spillover, energy risk, shipping risk, border tensions, or security implications

- Ignore minor, redundant, or low-signal updates.
- Do not simply restate headlines.
- Order bullets by importance.
- Do not print raw URLs.
- Do not mention source names in the summary.
- Keep the output readable.
- Do not use markdown hyperlinks.

Style:

- Professional, neutral, and information-dense.
- Concise but informative.
- Avoid unnecessary detail.
- Avoid speculation beyond what is supported by the provided news text.

End with:

Takeaway: <clear and professional synthesis of the overall geopolitical situation or direction>
News:
{articles_text}
"""
    return chat_text(
        "You are a professional geopolitical analyst. Follow the user's instructions exactly and do not claim to have read article bodies.",
        prompt,
        model=os.getenv("OPENAI_SUMMARY_MODEL", "gpt-4.1"),
        temperature=0.2,
    )


def run_monitor(topic, queries, max_articles=50, top_n=5, max_age_hours=24, ranking_mode="keyword"):
    active_queries = [q.strip() for q in queries if q.strip()]
    df, raw_downloaded, unique_articles, query_counts = fetch_multiple_queries(active_queries, max_articles)
    df = filter_recent_articles(df, max_age_hours)
    ranked = rank_articles(df, topic, recency_window_hours=max_age_hours, ranking_mode=ranking_mode)
    ranked = ranked.head(max_articles).reset_index(drop=True)
    if not ranked.empty:
        ranked["rank"] = ranked.index + 1
    summary = summarize(ranked, topic, top_n)

    table_cols = ["rank", "score", "title", "source", "published", "link"]
    articles = []
    for _, row in ranked.iterrows():
        item = {col: row.get(col, "") for col in table_cols}
        try:
            item["score"] = round(float(item["score"]), 3)
        except Exception:
            item["score"] = 0
        articles.append(item)

    return {
        "articles": articles,
        "summary": summary,
        "stats": {
            "raw_downloaded": raw_downloaded,
            "unique_articles": unique_articles,
            "recent_articles": len(df),
            "articles_shown": len(articles),
            "query_counts": query_counts,
        },
    }
