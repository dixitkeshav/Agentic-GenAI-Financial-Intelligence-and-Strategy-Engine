from django.shortcuts import render
from django.http import JsonResponse
from .models import NewsArticle
import logging
import requests
import json
from .sentiment import analyze_financial_sentiment 
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST   

# Configure logging
logger = logging.getLogger(__name__)

# View to display financial news on the dashboard
def dashboard(request):
    logger.info("Fetching financial news articles...")

    try:
        # Fetch news articles from the database
        articles = NewsArticle.objects.all().values('title', 'content', 'published_at')

        if not articles:
            logger.warning("No articles found in the database!")

        # Render the 'index.html' template and pass the articles
        logger.info(f"Returning {len(articles)} news articles.")
        return render(request, 'index.html', {'articles': articles})

    except Exception as e:
        logger.error(f"Error fetching news articles: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal Server Error'}, status=500)

# API endpoint to fetch the news list in JSON format
def news_list(request):
    logger.info("Fetching news articles from the database...")

    try:
        # Fetch news articles from the database
        news = NewsArticle.objects.all().values('title', 'content', 'published_at')
        news_list = list(news)

        if not news_list:
            logger.warning("No news articles found in the database!")

        logger.info(f"Returning {len(news_list)} news articles.")
        return JsonResponse(news_list, safe=False)

    except Exception as e:
        logger.error(f"Error fetching news: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal Server Error'}, status=500)

def fetch_news(request):
    API_KEY = "3PYST3XF1NKH2ZY7"  # Replace with your actual key
    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&apikey={API_KEY}"

    try:
        response = requests.get(url)
        data = response.json()

        # If no news data
        if 'feed' not in data:
            return JsonResponse({'error': 'Failed to fetch news from Alpha Vantage'}, status=500)

        articles = []

        for item in data['feed'][:10]:  # Limit to top 10 news
            articles.append({
                'title': item.get('title', 'No Title'),
                'summary': item.get('summary', ''),
                'url': item.get('url', '#'),
                'sentiment': item.get('overall_sentiment_label', 'neutral').lower()  # positive / neutral / negative
            })

        return JsonResponse({'articles': articles})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
        
from django.http import JsonResponse

def fetch_news_view(request):
    # Example data — replace with actual logic
    data = {
        "articles": [
            {"title": "Stock Market Hits Record High", "sentiment": "positive"},
            {"title": "Inflation Concerns Roil Markets", "sentiment": "negative"}
        ]
    }
    return JsonResponse(data)

from django.http import JsonResponse

def fetch_news_api(request):
    articles = NewsArticle.objects.all().values('title', 'sentiment')
    return JsonResponse({'articles': list(articles)})


def sentiment_chart_data(request):
    # Ideally fetch from DB or analysis logic
    data = {
        "distribution": {
            "labels": ["Positive", "Negative", "Neutral"],
            "data": [62, 28, 10]  # Replace with real aggregated values
        },
        "trend": {
            "labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
            "positive": [60, 70, 65, 75, 80],
            "negative": [30, 20, 25, 15, 10]
        }
    }
    return JsonResponse(data)

@csrf_exempt
@require_POST
def analyze_news_view(request):
    if request.method == 'POST':
        import json
        body = json.loads(request.body)
        text = body.get("text", "")
        sentiment, probabilities = analyze_financial_sentiment(text)
        return JsonResponse({
            "sentiment": sentiment,
            "probabilities": {
                "positive": round(probabilities[2], 3),
                "neutral": round(probabilities[1], 3),
                "negative": round(probabilities[0], 3)
            }
        })

