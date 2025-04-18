# fetch_news/urls.py
from django.urls import path
from .views import dashboard, fetch_news_view, sentiment_chart_data, analyze_news_view

urlpatterns = [
    path('', dashboard, name='dashboard'),
    path('api/fetch-news/', fetch_news_view, name='fetch_news'),
    path('api/chart-data/', sentiment_chart_data, name='chart_data'),  # Added /api/ prefix
    path('api/analyze-sentiment/', analyze_news_view, name='analyze_sentiment'),
]
