"""
Celery tasks for async news ingestion and sentiment processing.
"""
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Only define tasks if Celery is configured (Redis available)
try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    def shared_task(*args, **kwargs):
        def decorator(f):
            return f
        return decorator


def _fetch_alpha_vantage_news(ticker: str = "", topic: str = "financial_markets") -> list:
    import requests
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        return []
    url = "https://www.alphavantage.co/query"
    params = {"function": "NEWS_SENTIMENT", "apikey": api_key, "limit": 50}
    if ticker:
        params["tickers"] = ticker
    if topic:
        params["topics"] = topic
    r = requests.get(url, params=params, timeout=15)
    if r.status_code != 200:
        return []
    data = r.json()
    return data.get("feed", [])


@shared_task(bind=True, max_retries=3)
def ingest_news_task(self, ticker: str = "", topic: str = "financial_markets") -> dict[str, Any]:
    """Async task: fetch news and optionally run sentiment + store."""
    if not CELERY_AVAILABLE:
        return {"status": "skipped", "reason": "Celery not installed"}
    try:
        from pipelines.ingestion import fetch_news_with_retry
        feed = fetch_news_with_retry(lambda: _fetch_alpha_vantage_news(ticker, topic))
        if not feed:
            return {"status": "ok", "count": 0, "articles": []}
        articles = [
            {
                "title": item.get("title", ""),
                "summary": item.get("summary", ""),
                "url": item.get("url", ""),
                "sentiment": (item.get("overall_sentiment_label") or "Neutral").lower(),
                "ticker_sentiment": item.get("ticker_sentiment", []),
            }
            for item in feed[:30]
        ]
        return {"status": "ok", "count": len(articles), "articles": articles}
    except Exception as e:
        logger.exception("ingest_news_task failed: %s", e)
        raise self.retry(exc=e)
