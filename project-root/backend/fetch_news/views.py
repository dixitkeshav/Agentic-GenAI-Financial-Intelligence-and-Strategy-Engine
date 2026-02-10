from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.conf import settings
from django.core.cache import cache
import logging
import requests
import json
import os
from .models import NewsArticle
from .sentiment import analyze_financial_sentiment
from rest_framework.decorators import api_view
from rest_framework.response import Response

logger = logging.getLogger(__name__)
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "YOUR_API_KEY_HERE")

# Home/Dashboard View
def dashboard(request):
    try:
        articles = NewsArticle.objects.all().values('title', 'content', 'published_at')
        return render(request, 'index.html', {'articles': articles})
    except Exception as e:
        logger.error(f"Error loading dashboard: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal Server Error'}, status=500)

# News API from Alpha Vantage (with optional cache)
def fetch_news(request):
    cache_key = "fetch_news_financial_markets"
    try:
        cached = cache.get(cache_key)
        if cached is not None:
            return JsonResponse(cached)
    except Exception:
        pass

    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&apikey={ALPHA_VANTAGE_API_KEY}&limit=30"
    try:
        response = requests.get(url, timeout=15)
        data = response.json()

        if 'feed' not in data:
            return JsonResponse({'error': 'No news found'}, status=500)

        articles = [{
            'title': item.get('title', 'No Title'),
            'summary': item.get('summary', ''),
            'url': item.get('url', '#'),
            'sentiment': (item.get('overall_sentiment_label') or 'Neutral').lower()
        } for item in data['feed'][:20]]

        payload = {'articles': articles}
        try:
            cache.set(cache_key, payload, timeout=300)  # 5 min
        except Exception:
            pass
        return JsonResponse(payload)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# Sentiment Distribution Chart Data (from recent news when available)
def sentiment_chart_data(request):
    try:
        articles = list(NewsArticle.objects.all().values_list("title", "content")[:100])
        if articles:
            from .sentiment import analyze_financial_sentiment
            pos = neg = neu = 0
            for title, content in articles:
                text = (title or "") + " " + (content or "")[:500]
                if not text.strip():
                    continue
                try:
                    s, _ = analyze_financial_sentiment(text)
                    if s == "positive": pos += 1
                    elif s == "negative": neg += 1
                    else: neu += 1
                except Exception:
                    neu += 1
            total = pos + neg + neu
            if total:
                data = {
                    "distribution": {"labels": ["Positive", "Negative", "Neutral"], "data": [pos, neg, neu]},
                    "trend": {"labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"], "positive": [pos]*5, "negative": [neg]*5}
                }
            else:
                data = _default_chart_data()
        else:
            data = _default_chart_data()
    except Exception:
        data = _default_chart_data()
    return JsonResponse(data)


def _default_chart_data():
    return {
        "distribution": {"labels": ["Positive", "Negative", "Neutral"], "data": [62, 28, 10]},
        "trend": {"labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"], "positive": [60, 70, 65, 75, 80], "negative": [30, 20, 25, 15, 10]}
    }

# Sentiment Analysis for Pasted News (for /api/analyze-news/)
@csrf_exempt
@require_POST
def analyze_news_view(request):
    try:
        body = json.loads(request.body)
        text = body.get("text", "")
        if not text:
            return JsonResponse({'error': 'No text provided'}, status=400)

        sentiment, probabilities = analyze_financial_sentiment(text)
        return JsonResponse({
            "sentiment": sentiment,
            "probabilities": {
                "positive": round(probabilities[2], 3),
                "neutral": round(probabilities[1], 3),
                "negative": round(probabilities[0], 3)
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# Ticker Symbol Auto-Suggestion (for /api/search-ticker/)
def search_ticker(request):
    query = request.GET.get('q', '')  # Use 'q' to match frontend
    if not query:
        return JsonResponse({'results': []})

    url = f'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords={query}&apikey={ALPHA_VANTAGE_API_KEY}'
    try:
        response = requests.get(url)
        data = response.json()

        # Return only the symbol for dropdown
        results = [match.get("1. symbol", "") for match in data.get("bestMatches", []) if match.get("1. symbol", "")]
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'results': []})

# FinBERT Sentiment Analysis API (for /api/analyze-sentiment/)
@api_view(['POST'])
def analyze_sentiment(request):
    text = request.data.get('text', '')
    if not text:
        return Response({"error": "No text provided."}, status=400)
    try:
        sentiment, probs = analyze_financial_sentiment(text)
        probs_dict = {"negative": float(probs[0]), "neutral": float(probs[1]), "positive": float(probs[2])}
        payload = {
            "sentiment": sentiment,
            "probabilities": probs_dict,
        }
        if getattr(settings, "FEATURE_GENAI_INSIGHTS", False):
            try:
                from intelligence.insights import build_genai_insights
                insights = build_genai_insights(text, sentiment, probs_dict, include_aspect=True)
                payload["insights"] = insights
            except Exception as e:
                logger.warning("GenAI insights failed: %s", e)
        return Response(payload)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# Custom Sentiment for Ticker (for /api/custom-sentiment/) — fetches news and aggregates
@api_view(['POST'])
def custom_sentiment(request):
    ticker = request.data.get('ticker', '').upper()
    if not ticker:
        return Response({"error": "No ticker provided."}, status=400)
    try:
        url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={ticker}&apikey={ALPHA_VANTAGE_API_KEY}&limit=15"
        r = requests.get(url, timeout=15)
        data = r.json()
        feed = data.get("feed", [])
        if not feed:
            return Response({"sentiment": "neutral", "count": 0})
        pos = neg = neu = 0
        for item in feed:
            lab = (item.get("overall_sentiment_label") or "Neutral").lower()
            if lab == "positive": pos += 1
            elif lab == "negative": neg += 1
            else: neu += 1
        total = pos + neg + neu
        if pos > neg and pos > neu: sentiment = "positive"
        elif neg > pos and neg > neu: sentiment = "negative"
        else: sentiment = "neutral"
        return Response({"sentiment": sentiment, "count": total, "positive": pos, "negative": neg, "neutral": neu})
    except Exception as e:
        return Response({"error": str(e), "sentiment": "neutral"}, status=500)


# ——— GenAI Intelligence: full insights for a single text ———
@api_view(['POST'])
def analyze_with_insights(request):
    """Returns sentiment + why_sentiment, risk_drivers, event_impact_summary, events, aspect_sentiment."""
    text = request.data.get('text', '')
    if not text:
        return Response({"error": "No text provided."}, status=400)
    try:
        sentiment, probs = analyze_financial_sentiment(text)
        probs_dict = {"negative": float(probs[0]), "neutral": float(probs[1]), "positive": float(probs[2])}
        from intelligence.insights import build_genai_insights
        insights = build_genai_insights(text, sentiment, probs_dict, include_aspect=True)
        return Response({"sentiment": sentiment, "probabilities": probs_dict, "insights": insights})
    except Exception as e:
        logger.exception("analyze_with_insights: %s", e)
        return Response({"error": str(e)}, status=500)


# ——— Agentic AI: run multi-agent pipeline ———
@api_view(['GET', 'POST'])
def agents_run(request):
    """Run News Scout, Macro, Market Reaction, Risk, Decision agents on current news (or provided articles)."""
    try:
        if request.method == 'POST' and request.data.get("articles"):
            articles = request.data["articles"]
        else:
            url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&apikey={ALPHA_VANTAGE_API_KEY}&limit=25"
            r = requests.get(url, timeout=15)
            feed = r.json().get("feed", [])
            articles = [{"title": i.get("title", ""), "summary": i.get("summary", ""), "sentiment": (i.get("overall_sentiment_label") or "Neutral").lower()} for i in feed[:25]]
        ticker = (request.data if request.method == "POST" else request.GET).get("ticker", "")
        agg = "neutral"
        if articles:
            p = sum(1 for a in articles if (a.get("sentiment") or "").lower() == "positive")
            n = sum(1 for a in articles if (a.get("sentiment") or "").lower() == "negative")
            if p > n and p > len(articles) - p - n: agg = "positive"
            elif n > p: agg = "negative"
        from agents.orchestrator import AgentOrchestrator
        orch = AgentOrchestrator()
        result = orch.run(articles, ticker=ticker, aggregate_sentiment=agg)
        return Response(result)
    except Exception as e:
        logger.exception("agents_run: %s", e)
        return Response({"error": str(e)}, status=500)


# ——— Quant: signals and backtest ———
@api_view(['POST'])
def quant_signals(request):
    """Return sentiment momentum, MA crossover, mean-reversion signal from provided sentiment series or last probs."""
    try:
        probs = request.data.get("probabilities") or request.data.get("last_probs")
        import pandas as pd
        from quant.signals import build_signal_payload, sentiment_score_from_probs
        sentiment_series = None
        if request.data.get("sentiment_series"):
            sentiment_series = pd.Series(request.data["sentiment_series"])
        payload = build_signal_payload(sentiment_series=sentiment_series, last_probs=probs, window=5)
        return Response(payload)
    except Exception as e:
        logger.exception("quant_signals: %s", e)
        return Response({"error": str(e)}, status=500)


@api_view(['GET', 'POST'])
def quant_backtest(request):
    """Run backtest: price-only vs sentiment strategy. GET: ticker=AAPL. POST: ticker, optional sentiment_series."""
    ticker = (request.GET if request.method == "GET" else request.data).get("ticker", "AAPL")
    sentiment_series = None
    if request.method == "POST" and request.data.get("sentiment_series"):
        import pandas as pd
        sentiment_series = pd.Series(request.data["sentiment_series"])
    try:
        from quant.backtest import run_backtest
        result = run_backtest(ticker=ticker, sentiment_series=sentiment_series, days=252)
        return Response(result)
    except Exception as e:
        logger.exception("quant_backtest: %s", e)
        return Response({"error": str(e)}, status=500)


# ——— Evaluation ———
@api_view(['POST'])
def evaluation_sentiment_accuracy(request):
    """Compare predicted vs ground truth labels. Body: { \"predicted\": [...], \"labels\": [...] }."""
    try:
        from evaluation.metrics import sentiment_accuracy
        predicted = request.data.get("predicted", [])
        labels = request.data.get("labels", [])
        out = sentiment_accuracy(predicted, labels)
        return Response(out)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def evaluation_latency(request):
    """Benchmark latency of sentiment analysis (and optionally insights)."""
    try:
        from evaluation.metrics import latency_benchmark
        from fetch_news.sentiment import analyze_financial_sentiment
        sample = "The Fed raised rates by 25 bps. Markets reacted negatively. Banking stocks fell."
        out = latency_benchmark(lambda: analyze_financial_sentiment(sample), num_runs=5)
        return Response(out)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ——— Symbol Deep-Dive Agent (price + news + similar stocks + prediction) ———
@api_view(['GET', 'POST'])
def symbol_deep_dive(request):
    """Run Symbol Deep-Dive agent: fetch price, details, news, similar stocks; predict and name similar stocks."""
    symbol = (request.GET if request.method == "GET" else request.data).get("symbol", "").strip().upper()
    if not symbol:
        return Response({"error": "symbol required"}, status=400)
    try:
        from agents.symbol_deep_dive import SymbolDeepDiveAgent
        agent = SymbolDeepDiveAgent()
        result = agent.run({
            "symbol": symbol,
            "alpha_vantage_api_key": ALPHA_VANTAGE_API_KEY,
        })
        if result.get("error") and not result.get("prediction"):
            return Response(result, status=500)
        return Response(result)
    except Exception as e:
        logger.exception("symbol_deep_dive: %s", e)
        return Response({"error": str(e)}, status=500)


# ——— Live ticker / indices (for scrolling strip: symbol, price, change) ———
@api_view(['GET'])
def live_ticker(request):
    """Return list of { symbol, name, price, change_pct } for indices and popular tickers (yfinance)."""
    try:
        import yfinance as yf
        # Indices and a few liquid names for the ticker strip
        symbols = [
            "^GSPC", "^DJI", "^IXIC", "^NSEI", "^BSESN", "^N225", "^FTSE", "^GDAXI",
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "RELIANCE.NS", "TCS.NS", "INFY.NS",
        ]
        out = []
        for s in symbols:
            try:
                t = yf.Ticker(s)
                hist = t.history(period="5d")
                info = t.info
                name = info.get("shortName") or info.get("longName") or s
                if hist is not None and len(hist) >= 2:
                    last = float(hist["Close"].iloc[-1])
                    prev = float(hist["Close"].iloc[-2])
                    ch = ((last - prev) / prev * 100) if prev else 0
                else:
                    last = info.get("regularMarketPrice") or info.get("previousClose") or 0
                    ch = 0
                out.append({"symbol": s, "name": name[:30], "price": round(last, 2), "change_pct": round(ch, 2)})
            except Exception:
                continue
        return Response({"tickers": out})
    except Exception as e:
        logger.warning("live_ticker: %s", e)
        return Response({"tickers": []})


# ——— Cross-domain ———
@api_view(['GET', 'POST'])
def cross_domain_news(request):
    """Fetch news for domain: crypto, commodities, fx, geopolitical. GET ?domain=crypto."""
    domain = (request.GET if request.method == "GET" else request.data).get("domain", "financial_markets")
    try:
        from cross_domain.sources import fetch_domain_news, cross_domain_reasoning
        articles = fetch_domain_news(domain, limit=20)
        summary = cross_domain_reasoning({domain: (articles[0].get("sentiment") if articles else "neutral")})
        return Response({"domain": domain, "articles": articles, "cross_domain_reasoning": summary})
    except Exception as e:
        return Response({"error": str(e)}, status=500)