from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import logging
import requests
import json
import os
from .models import NewsArticle
from .sentiment import analyze_financial_sentiment
from rest_framework.decorators import api_view
from rest_framework.response import Response

logger = logging.getLogger(__name__)
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "YOUR_API_KEY_HERE")  # Replace or use env variable

# Home/Dashboard View
def dashboard(request):
    try:
        articles = NewsArticle.objects.all().values('title', 'content', 'published_at')
        return render(request, 'index.html', {'articles': articles})
    except Exception as e:
        logger.error(f"Error loading dashboard: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal Server Error'}, status=500)

# News API from Alpha Vantage
def fetch_news(request):
    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&apikey={ALPHA_VANTAGE_API_KEY}"
    try:
        response = requests.get(url)
        data = response.json()

        if 'feed' not in data:
            return JsonResponse({'error': 'No news found'}, status=500)

        articles = [{
            'title': item.get('title', 'No Title'),
            'summary': item.get('summary', ''),
            'url': item.get('url', '#'),
            'sentiment': item.get('overall_sentiment_label', 'neutral').lower()
        } for item in data['feed'][:10]]

        return JsonResponse({'articles': articles})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# Sentiment Distribution Chart Data (Dummy Data for Now)
def sentiment_chart_data(request):
    data = {
        "distribution": {
            "labels": ["Positive", "Negative", "Neutral"],
            "data": [62, 28, 10]
        },
        "trend": {
            "labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
            "positive": [60, 70, 65, 75, 80],
            "negative": [30, 20, 25, 15, 10]
        }
    }
    return JsonResponse(data)

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
        return Response({
            "sentiment": sentiment,
            "probabilities": {
                "negative": probs[0],
                "neutral": probs[1],
                "positive": probs[2]
            }
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# Custom Sentiment for Ticker (for /api/custom-sentiment/)
@api_view(['POST'])
def custom_sentiment(request):
    ticker = request.data.get('ticker', '').upper()
    if not ticker:
        return Response({"error": "No ticker provided."}, status=400)
    try:
        # Example: fetch recent news for the ticker and aggregate sentiment
        # For demo, just return neutral or use a simple mapping
        # You can enhance this to fetch news and run FinBERT on each headline
        if ticker == "AAPL":
            sentiment = "positive"
        elif ticker == "TSLA":
            sentiment = "negative"
        else:
            sentiment = "neutral"
        return Response({"sentiment": sentiment})
    except Exception as e:
        return Response({"error": str(e)}, status=500)