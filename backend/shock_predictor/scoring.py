import json
from datetime import datetime

from django.core.cache import cache

from shock_predictor.nlp import get_finbert_sentiment, classify_cause_type, CAUSE_KEYWORDS
from shock_predictor.news_fetcher import poll_all_feeds

REDIS_SCORE_KEY = "shock:score:latest"
SCORE_THRESHOLD = 70


def compute_article_score(article: dict) -> dict:
    text = article.get('full_text', '')
    source_weight = article.get('weight', 0.5)

    sentiment = get_finbert_sentiment(text)
    sentiment_intensity = abs(sentiment)
    sentiment_component = sentiment_intensity * 35

    text_lower = text.lower()
    from shock_predictor.nlp import _keyword_in_text
    keyword_hits = sum(
        1 for kws in CAUSE_KEYWORDS.values() for kw in kws if _keyword_in_text(kw, text_lower)
    )
    keyword_component = min(keyword_hits * 8, 30)

    cause_type, cause_summary = classify_cause_type(text)
    cause_weights = {
        'policy': 20, 'macro': 15, 'geopolitical': 18,
        'technical': 12, 'corporate': 10, 'unknown': 5,
    }
    cause_component = cause_weights.get(cause_type, 5)

    raw = sentiment_component + keyword_component + cause_component
    score = int(min(100, raw * source_weight))

    return {
        **article,
        'shock_score': score,
        'cause_type': cause_type,
        'cause_summary': cause_summary,
        'sentiment': round(sentiment, 3),
        'suggested_hedge': get_hedge_suggestion(cause_type, sentiment),
    }


def get_hedge_suggestion(cause_type: str, sentiment: float) -> str:
    hedges = {
        'policy': (
            "Consider buying Nifty puts or reducing delta exposure. "
            "Policy shocks often have multi-day momentum."
        ),
        'macro': (
            "Macro shocks are broad. Consider VIX-linked products or "
            "rotation to defensives (FMCG, Pharma)."
        ),
        'geopolitical': (
            "Geopolitical moves can be sharp and reversible. "
            "Straddle or strangle may suit uncertain direction."
        ),
        'technical': (
            "Flow-driven. Monitor OI data. Short-term options hedge "
            "rather than outright directional bet."
        ),
        'corporate': (
            "Corporate event — check affected stock options. "
            "Index impact usually contained."
        ),
        'unknown': (
            "Signal unclear. Reduce position size and monitor "
            "the next 30 minutes before acting."
        ),
    }
    return hedges.get(cause_type, hedges['unknown'])


def update_shock_score(score: int, article: dict) -> dict:
    payload = {
        'score': score,
        'cause': article.get('cause_type', 'unknown'),
        'headline': article.get('title', ''),
        'source': article.get('source', ''),
        'hedge': article.get('suggested_hedge', ''),
        'timestamp': datetime.now().isoformat(),
    }
    cache.set(REDIS_SCORE_KEY, json.dumps(payload), timeout=300)
    return payload


def get_current_score() -> dict:
    raw = cache.get(REDIS_SCORE_KEY)
    if raw:
        return json.loads(raw)
    return {
        'score': 0,
        'cause': 'none',
        'headline': '',
        'source': '',
        'hedge': '',
        'timestamp': '',
    }


def compute_live_shock_score(*, persist: bool = True) -> dict:
    """
    Score latest headlines without Celery/Redis workers (Render free tier).
    Polls RSS feeds and falls back to NewsAPI market headlines.
    """
    articles = poll_all_feeds()

    if len(articles) < 5:
        try:
            from fetch_news import newsapi_client as na

            if na.is_configured():
                for item in na.fetch_market_news(limit=15):
                    title = item.get('title', '') or ''
                    summary = item.get('summary', '') or ''
                    articles.append(
                        {
                            'uid': title[:80],
                            'source': item.get('source', 'NewsAPI'),
                            'title': title,
                            'summary': summary,
                            'full_text': f'{title}. {summary}',
                            'weight': 0.75,
                        }
                    )
        except Exception:
            pass

    if len(articles) < 3:
        try:
            from fetch_news.news_aggregator import fetch_merged_news

            merged = fetch_merged_news(None, limit=20, run_finbert=False, include_market=True)
            for item in merged.get('articles', []):
                title = item.get('title', '') or ''
                summary = item.get('summary', '') or ''
                articles.append(
                    {
                        'uid': title[:80],
                        'source': item.get('source', 'merged'),
                        'title': title,
                        'summary': summary,
                        'full_text': f'{title}. {summary}',
                        'weight': 0.7,
                    }
                )
        except Exception:
            pass

    if not articles:
        return get_current_score()

    scored = [compute_article_score(a) for a in articles]
    top = max(scored, key=lambda x: x['shock_score'])
    payload = {
        'score': top['shock_score'],
        'cause': top.get('cause_type', 'unknown'),
        'headline': top.get('title', ''),
        'source': top.get('source', ''),
        'hedge': top.get('suggested_hedge', ''),
        'timestamp': datetime.now().isoformat(),
    }
    if persist:
        cache.set(REDIS_SCORE_KEY, json.dumps(payload), timeout=300)
    return payload
