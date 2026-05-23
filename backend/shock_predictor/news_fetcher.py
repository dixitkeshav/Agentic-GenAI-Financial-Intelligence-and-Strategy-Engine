import hashlib
import logging
from datetime import timedelta

import feedparser
import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

RSS_FEEDS = {
    'RBI': 'https://www.rbi.org.in/Scripts/RSS.aspx',
    'SEBI': 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListingAll=yes&sid=1&ssid=3&smid=0',
    'ET': 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'MC': 'https://www.moneycontrol.com/rss/marketsbuzz.xml',
    'MINT': 'https://www.livemint.com/rss/markets',
    'BS': 'https://www.business-standard.com/rss/markets-106.rss',
}

SOURCE_WEIGHTS = {
    'RBI': 1.0,
    'SEBI': 1.0,
    'ET': 0.75,
    'MC': 0.70,
    'MINT': 0.70,
    'BS': 0.70,
}


def fetch_headlines_for_date(target_date) -> str:
    """Historical headlines via NewsAPI (backtest). Requires NEWSAPI_KEY in settings."""
    from django.conf import settings

    api_key = getattr(settings, 'NEWSAPI_KEY', None) or ''
    if not api_key:
        return _fallback_headline_for_date(target_date)

    date_str = target_date.strftime('%Y-%m-%d')
    next_day = (target_date + timedelta(days=1)).strftime('%Y-%m-%d')
    url = (
        f"https://newsapi.org/v2/everything?"
        f"q=nifty+OR+sensex+OR+RBI+OR+SEBI+OR+india+market&"
        f"from={date_str}&to={next_day}&"
        f"language=en&sortBy=relevancy&pageSize=5&"
        f"apiKey={api_key}"
    )
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        articles = data.get('articles', [])
        if articles:
            a = articles[0]
            return (a.get('title', '') or '') + '. ' + (a.get('description', '') or '')
    except Exception as e:
        logger.debug("NewsAPI fetch failed for %s: %s", target_date, e)
    return _fallback_headline_for_date(target_date)


def _fallback_headline_for_date(target_date) -> str:
    """Keyword-only fallback when NewsAPI is unavailable."""
    return (
        f"Nifty market session on {target_date.isoformat()} — "
        "Indian equities volatile amid global and domestic factors."
    )


def poll_feed(source_name: str, feed_url: str) -> list[dict]:
    """Poll one RSS feed; dedupe via Redis cache."""
    new_entries = []
    try:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries[:20]:
            uid = hashlib.md5(
                (entry.get('link', '') + entry.get('title', '')).encode()
            ).hexdigest()
            cache_key = f"shock:seen:{uid}"
            if cache.get(cache_key):
                continue
            cache.set(cache_key, 1, timeout=86400)
            new_entries.append({
                'uid': uid,
                'source': source_name,
                'title': entry.get('title', ''),
                'summary': entry.get('summary', ''),
                'link': entry.get('link', ''),
                'published': entry.get('published', ''),
                'full_text': entry.get('title', '') + '. ' + entry.get('summary', ''),
                'weight': SOURCE_WEIGHTS.get(source_name, 0.5),
            })
    except Exception as e:
        logger.debug("RSS poll failed %s: %s", source_name, e)
    return new_entries


def poll_all_feeds() -> list[dict]:
    results = []
    for source, url in RSS_FEEDS.items():
        results.extend(poll_feed(source, url))
    return results
