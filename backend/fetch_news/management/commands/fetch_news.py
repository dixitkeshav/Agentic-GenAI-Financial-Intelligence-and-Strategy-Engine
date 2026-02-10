import os
import requests
import django
from dotenv import load_dotenv
from django.core.management.base import BaseCommand
from fetch_news.models import NewsArticle

# ✅ Load environment variables
load_dotenv()
API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")

class Command(BaseCommand):
    help = "Fetches financial news from Alpha Vantage and stores them in the database"

    def handle(self, *args, **kwargs):
        if not API_KEY:
            self.stdout.write(self.style.ERROR("Error: ALPHA_VANTAGE_API_KEY not found in .env"))
            return

        url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey={API_KEY}"
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            news_data = response.json().get("feed", [])
            if not news_data:
                self.stdout.write(self.style.WARNING("No news articles found."))
                return

            for item in news_data:
                NewsArticle.objects.create(
                    title=item.get("title", "No Title"),
                    content=item.get("summary", "No Summary"),  # Ensure 'content' matches your model field
                )

            self.stdout.write(self.style.SUCCESS(f"✅ {len(news_data)} news articles saved successfully!"))

        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"❌ Error fetching news: {e}"))
