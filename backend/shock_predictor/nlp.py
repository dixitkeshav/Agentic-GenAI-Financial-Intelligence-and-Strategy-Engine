"""
FinBERT + keyword cause classification for shock events.
Reuses the project's lazy-loaded FinBERT in fetch_news.sentiment (no second model load).
"""
from fetch_news.sentiment import analyze_financial_sentiment

CAUSE_KEYWORDS = {
    'policy': [
        'rbi', 'repo rate', 'monetary policy', 'sebi', 'regulation', 'circular',
        'rate cut', 'rate hike', 'fema', 'fii limit', 'circuit breaker', 'ban',
        'budget', 'tax', 'gst', 'fiscal policy', 'finance minister',
    ],
    'macro': [
        'gdp', 'inflation', 'cpi', 'fed', 'federal reserve', 'dollar', 'crude oil',
        'recession', 'current account', 'trade deficit', 'imf', 'world bank',
        'global slowdown', 'china', 'us economy',
    ],
    'geopolitical': [
        'war', 'conflict', 'sanctions', 'election', 'terror', 'attack',
        'geopolitical', 'border', 'pakistan', 'nuclear', 'oil embargo',
    ],
    'technical': [
        'fii selling', 'fii outflow', 'dii buying', 'margin call', 'circuit',
        'block deal', 'bulk deal', 'expiry', 'short covering', 'stop loss',
        'unwinding', 'derivative', 'rollover',
    ],
    'corporate': [
        'earnings', 'results', 'profit', 'loss', 'default', 'insolvency',
        'merger', 'acquisition', 'ipo', 'delisting', 'fraud', 'scam',
    ],
}


def get_finbert_sentiment(text: str) -> float:
    """
    Returns a float in [-1, 1] using existing FinBERT (negative / neutral / positive).
    """
    if not text or len(text.strip()) < 5:
        return 0.0
    try:
        label, probs = analyze_financial_sentiment(text[:512])
        if not probs or len(probs) < 3:
            return 0.0
        neg, neu, pos = float(probs[0]), float(probs[1]), float(probs[2])
        if label == 'positive':
            return pos - neg
        if label == 'negative':
            return -(neg - pos)
        return pos - neg
    except Exception:
        return 0.0


def _keyword_in_text(keyword: str, text_lower: str) -> bool:
    """Match whole words/phrases so e.g. 'ban' does not match 'banknifty'."""
    import re
    if ' ' in keyword:
        return keyword in text_lower
    return bool(re.search(rf'\b{re.escape(keyword)}\b', text_lower))


def classify_cause_type(headline: str, date=None) -> tuple[str, str]:
    """
    Rule-based keyword classifier. Returns (cause_type, summary_string).
    """
    text_lower = (headline or '').lower()
    scores = {}
    for cause, keywords in CAUSE_KEYWORDS.items():
        scores[cause] = sum(1 for kw in keywords if _keyword_in_text(kw, text_lower))

    best_cause = max(scores, key=scores.get) if scores else 'unknown'
    if scores.get(best_cause, 0) == 0:
        best_cause = 'unknown'

    summary = (
        f"Classified as '{best_cause}' based on keyword match "
        f"(score={scores.get(best_cause, 0)}). Headline: {(headline or '')[:120]}"
    )
    return best_cause, summary
