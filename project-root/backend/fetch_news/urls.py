from django.urls import path
from .views import (
    dashboard,
    fetch_news,
    sentiment_chart_data,
    analyze_news_view,
    search_ticker,
    analyze_sentiment,  # Import the FinBERT-based view
    custom_sentiment,
)

urlpatterns = [
    path('', dashboard, name='dashboard'),
    path('api/fetch-news/', fetch_news, name='fetch_news'),
    path('api/chart-data/', sentiment_chart_data, name='chart_data'),
    path('api/analyze-news/', analyze_news_view, name='analyze_news'),
    path('api/search-ticker/', search_ticker, name='search_ticker'),
    path('api/analyze-sentiment/', analyze_sentiment, name='analyze_sentiment'),  # <-- Add this line
    path('api/custom-sentiment/', custom_sentiment, name='custom_sentiment'),  # <-- Add this line
]