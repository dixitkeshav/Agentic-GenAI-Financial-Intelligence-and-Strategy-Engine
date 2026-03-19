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

        feed = data.get("feed") or []
        if not feed:
            # Avoid hard-failing the frontend.
            err = data.get("Note") or data.get("Error Message") or "No news found"
            payload = {"articles": [], "error": err}
            try:
                cache.set(cache_key, payload, timeout=120)  # 2 minutes
            except Exception:
                pass
            return JsonResponse(payload, status=200)

        articles = [
            {
                "title": item.get("title", "No Title"),
                "summary": item.get("summary", ""),
                "url": item.get("url", "#"),
                "sentiment": (item.get("overall_sentiment_label") or "Neutral").lower(),
                "source": item.get("source", "Alpha Vantage"),
                "time_published": item.get("time_published", ""),
            }
            for item in feed[:20]
        ]

        # Persist for sentiment charts.
        try:
            for a in articles:
                title = (a.get("title") or "").strip()
                summary = (a.get("summary") or "").strip()
                if not title or not summary:
                    continue
                NewsArticle.objects.update_or_create(
                    title=title,
                    defaults={"content": summary[:20000]},
                )
        except Exception:
            logger.exception("fetch_news: failed to persist NewsArticle records")

        payload = {'articles': articles}
        try:
            cache.set(cache_key, payload, timeout=300)  # 5 min
        except Exception:
            pass
        return JsonResponse(payload)
    except Exception as e:
        # Keep API stable for the frontend.
        return JsonResponse({"articles": [], "error": str(e)}, status=200)

# Sentiment Distribution Chart Data (from recent news when available)
def sentiment_chart_data(request):
    try:
        articles = list(NewsArticle.objects.all().values_list("title", "content")[:200])
        if articles:
            from .sentiment import analyze_financial_sentiment
            pos = neg = neu = 0
            labels: list[str] = []
            for title, content in articles:
                text = (title or "") + " " + (content or "")[:500]
                if not text.strip():
                    continue
                try:
                    s, _ = analyze_financial_sentiment(text)
                    s = (s or "neutral").lower()
                    labels.append(s)
                    if s == "positive":
                        pos += 1
                    elif s == "negative":
                        neg += 1
                    else:
                        neu += 1
                except Exception:
                    neu += 1
            total = pos + neg + neu
            if total:
                chunk_size = max(1, len(labels) // 5)
                trend_positive = []
                trend_negative = []
                for i in range(5):
                    chunk = labels[i * chunk_size : (i + 1) * chunk_size]
                    trend_positive.append(sum(1 for x in chunk if x == "positive"))
                    trend_negative.append(sum(1 for x in chunk if x == "negative"))
                data = {
                    "distribution": {"labels": ["Positive", "Negative", "Neutral"], "data": [pos, neg, neu]},
                    "trend": {
                        "labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
                        "positive": trend_positive,
                        "negative": trend_negative,
                    },
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
            try:
                r = requests.get(url, timeout=25)
                feed = r.json().get("feed", [])
            except Exception:
                feed = []

            if feed:
                articles = [
                    {
                        "title": i.get("title", ""),
                        "summary": i.get("summary", ""),
                        "sentiment": (i.get("overall_sentiment_label") or "Neutral").lower(),
                    }
                    for i in feed[:25]
                ]
            else:
                # Fallback: avoid empty/timeout failures by using stored news + FinBERT sentiment.
                from .sentiment import analyze_financial_sentiment
                stored = list(
                    NewsArticle.objects.all()
                    .order_by("-published_at")
                    .values_list("title", "content")[:30]
                )
                articles = []
                for title, content in stored:
                    text = ((title or "") + " " + (content or ""))[:2000]
                    if not text.strip():
                        continue
                    try:
                        s, _ = analyze_financial_sentiment(text)
                        articles.append(
                            {
                                "title": title or "",
                                "summary": content or "",
                                "sentiment": (s or "neutral").lower(),
                            }
                        )
                    except Exception:
                        articles.append(
                            {
                                "title": title or "",
                                "summary": content or "",
                                "sentiment": "neutral",
                            }
                        )
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


# ——— Market price history (OHLC) for charts ———
@api_view(['GET'])
def market_history(request, symbol: str):
    """Return OHLC history for a symbol. Query: period=1d|5d|1mo|3mo|6mo|1y"""
    period = request.GET.get('period', '1mo')
    valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y']
    if period not in valid_periods:
        period = '1mo'
    try:
        import yfinance as yf
        t = yf.Ticker(symbol)
        hist = t.history(period=period)
        if hist is None or hist.empty:
            return Response({"error": "No data", "history": []})
        history = [
            {
                "timestamp": int(row.name.timestamp() * 1000),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if "Volume" in row else 0,
            }
            for row in hist.itertuples()
        ]
        return Response({"symbol": symbol, "history": history})
    except Exception as e:
        logger.warning("market_history: %s", e)
        return Response({"error": str(e), "history": []})


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


# ——— Screener / Scanner ———
@api_view(["GET"])
def scanner(request):
    """
    Simple functional screener:
    - sentiment from Alpha Vantage (NEWS_SENTIMENT) aggregated into pos/neg counts
    - momentum from yfinance price change
    - outputs BULLISH/BEARISH/NEUTRAL + confidence
    """
    symbols_csv = request.GET.get("symbols", "").strip()
    if not symbols_csv:
        symbols_csv = "^NSEI,AAPL,MSFT,NVDA,RELIANCE.NS"

    symbols = [s.strip().upper() for s in symbols_csv.split(",") if s.strip()]
    period = request.GET.get("period", "3mo")

    def _alpha_sentiment_for_ticker(ticker: str) -> dict:
        try:
            url = (
                "https://www.alphavantage.co/query"
                f"?function=NEWS_SENTIMENT&tickers={ticker}"
                f"&apikey={ALPHA_VANTAGE_API_KEY}&limit=15"
            )
            r = requests.get(url, timeout=20)
            data = r.json()
            feed = data.get("feed", []) or []
            if not feed:
                return {"sentiment": "neutral", "count": 0, "positive": 0, "negative": 0, "neutral": 0}
            pos = neg = neu = 0
            for item in feed:
                lab = (item.get("overall_sentiment_label") or "Neutral").lower()
                if lab == "positive":
                    pos += 1
                elif lab == "negative":
                    neg += 1
                else:
                    neu += 1
            count = pos + neg + neu
            if count == 0:
                sentiment = "neutral"
            elif pos > neg and pos > neu:
                sentiment = "positive"
            elif neg > pos and neg > neu:
                sentiment = "negative"
            else:
                sentiment = "neutral"
            return {
                "sentiment": sentiment,
                "count": count,
                "positive": pos,
                "negative": neg,
                "neutral": neu,
            }
        except Exception:
            return {"sentiment": "neutral", "count": 0, "positive": 0, "negative": 0, "neutral": 0}

    def _momentum_for_symbol(ticker: str) -> dict:
        try:
            import yfinance as yf
            t = yf.Ticker(ticker)
            hist = t.history(period=period)
            if hist is None or hist.empty or "Close" not in hist:
                return {"momentum": 0.0, "start_price": None, "end_price": None}
            closes = hist["Close"].dropna()
            if len(closes) < 2:
                return {"momentum": 0.0, "start_price": None, "end_price": None}
            start = float(closes.iloc[0])
            end = float(closes.iloc[-1])
            mom = (end / start - 1.0) if start else 0.0
            return {"momentum": mom, "start_price": start, "end_price": end}
        except Exception:
            return {"momentum": 0.0, "start_price": None, "end_price": None}

    results = []
    for sym in symbols:
        sent = _alpha_sentiment_for_ticker(sym)
        mom = _momentum_for_symbol(sym)

        pos = sent.get("positive", 0) or 0
        neg = sent.get("negative", 0) or 0
        count = sent.get("count", 0) or 0

        # sentiment_score in [-1, 1]
        sentiment_score = 0.0
        if count > 0:
            sentiment_score = float(pos - neg) / float(count)

        momentum = mom.get("momentum", 0.0) or 0.0

        if sentiment_score > 0 and momentum > 0:
            signal = "BULLISH"
        elif sentiment_score < 0 and momentum < 0:
            signal = "BEARISH"
        else:
            signal = "NEUTRAL"

        # Confidence is a heuristic blend of sentiment strength + absolute momentum.
        abs_sent = min(abs(sentiment_score), 1.0)
        abs_mom = min(abs(momentum) * 5.0, 1.0)  # scale momentum into [0,1]
        confidence = round(0.5 * abs_sent + 0.5 * abs_mom, 3)

        results.append(
            {
                "symbol": sym,
                "signal": signal,
                "confidence": confidence,
                "sentiment": sent.get("sentiment", "neutral"),
                "sentiment_score": round(sentiment_score, 4),
                "momentum": round(momentum, 6),
                "sentiment_counts": {
                    "positive": pos,
                    "negative": neg,
                    "neutral": sent.get("neutral", 0) or 0,
                    "total": count,
                },
            }
        )

    return Response({"period": period, "results": results})


# ——— Options chain (US example via yfinance) ———
@api_view(["GET"])
def options_chain(request):
    """
    Options chain for a symbol (best-effort via yfinance).
    For India NSE-style chains, you'll likely need a dedicated provider.
    """
    symbol = (request.GET.get("symbol") or "").strip().upper()
    if not symbol:
        symbol = "AAPL"
    expiry = (request.GET.get("expiry") or "").strip()

    cache_key = f"options_chain:{symbol}:{expiry or 'auto'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    try:
        import yfinance as yf
        t = yf.Ticker(symbol)
        expiries = list(t.options or [])
        if not expiries:
            payload = {"symbol": symbol, "expiry": None, "expiries": [], "data": [], "error": "No options expiries found"}
            cache.set(cache_key, payload, timeout=300)
            return Response(payload)

        if not expiry or expiry not in expiries:
            expiry = expiries[0]

        chain = t.option_chain(expiry)
        calls = chain.calls
        puts = chain.puts

        strikes = sorted(set(calls["strike"].tolist()) | set(puts["strike"].tolist()))
        rows = []
        for strike in strikes:
            ce = calls[calls["strike"] == strike]
            pe = puts[puts["strike"] == strike]
            ce_row = ce.iloc[0].to_dict() if len(ce) else {}
            pe_row = pe.iloc[0].to_dict() if len(pe) else {}
            rows.append(
                {
                    "strike": float(strike),
                    "call": {
                        "bid": ce_row.get("bid"),
                        "ask": ce_row.get("ask"),
                        "lastPrice": ce_row.get("lastPrice"),
                        "impliedVolatility": ce_row.get("impliedVolatility"),
                        "openInterest": ce_row.get("openInterest"),
                        "volume": ce_row.get("volume"),
                    },
                    "put": {
                        "bid": pe_row.get("bid"),
                        "ask": pe_row.get("ask"),
                        "lastPrice": pe_row.get("lastPrice"),
                        "impliedVolatility": pe_row.get("impliedVolatility"),
                        "openInterest": pe_row.get("openInterest"),
                        "volume": pe_row.get("volume"),
                    },
                }
            )

        payload = {"symbol": symbol, "expiry": expiry, "expiries": expiries[:10], "data": rows}
        cache.set(cache_key, payload, timeout=60)
        return Response(payload)
    except Exception as e:
        payload = {"symbol": symbol, "expiry": expiry or None, "expiries": [], "data": [], "error": str(e)}
        cache.set(cache_key, payload, timeout=60)
        return Response(payload)