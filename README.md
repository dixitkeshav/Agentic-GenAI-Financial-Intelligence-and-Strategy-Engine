# Financial Intelligence Platform (Advanced)

An **agentic GenAI financial intelligence platform** that ingests real-time news, reasons over macro and market context using multiple specialized agents, converts narrative sentiment into quant signals, and validates them via backtesting in a production-grade system.

## Features

### 1. GenAI Intelligence (beyond basic sentiment)
- **Why sentiment** — LLM-generated explanation for positive/negative/neutral
- **Risk drivers** — Key risk drivers extracted from news
- **Event impact summary** — Historical context (e.g. "similar narratives led to 2–4% drawdowns in banking stocks")
- **Event extraction** — Mergers, rate hikes, earnings misses, etc.
- **Aspect-based sentiment** — Per-aspect (earnings, macro, sector, guidance) sentiment

### 2. Multi-Agent System (two modes)
- **Mode A — Current-news analysis:** News Scout, Macro Context, Market Reaction, Risk, and Decision agents run on **live/fetched news** and produce one recommendation.
- **Mode B — Symbol Deep-Dive:** For **one stock/symbol**: fetch its price + details, relevant news, full history, **similar stocks by sector**, and a **prediction** based on historical movements of those **named similar stocks** (e.g. "Based on MSFT, GOOGL, META…").
- Agents: News Scout, Macro Context, Market Reaction, Risk, Decision, **Symbol Deep-Dive**

### 3. Quant Layer
- **Sentiment momentum** — Rolling sentiment change
- **MA crossover** — Short/long sentiment moving average signals
- **Mean reversion** — Extreme negative/positive sentiment signals
- **Backtesting** — Price-only vs sentiment strategy (Sharpe, IC, total return)
- **yfinance** — Price data for backtests

### 4. SDE-Level Engineering
- **Caching** — Redis (or in-memory fallback) for news API responses
- **Async pipelines** — Celery tasks for rate-limit-safe news ingestion
- **WebSockets** — Real-time dashboard updates (Channels)
- **Feature flags** — `FEATURE_GENAI_INSIGHTS`, `FEATURE_AGENTS`, `FEATURE_QUANT_SIGNALS`, `FEATURE_WEBSOCKETS`
- **Structured logging** — Django logging to file

### 5. Cross-Domain
- **Crypto, commodities, FX, geopolitical** — Domain-specific news (Alpha Vantage topics)
- **Cross-domain reasoning** — e.g. "Geopolitical tension → Oil ↑ → Inflation risk → Bank stocks ↓"

### 6. Evaluation
- **Sentiment accuracy** — vs manual labels (accuracy, macro F1)
- **Latency benchmark** — Sentiment analysis mean/std time
- **Ablation** — Compare with/without agents (use strategy Sharpe)

---

## Setup

### 1. Install dependencies

```bash
cd project-root
pip install -r requirements.txt
```

Optional: Redis and Celery for caching and async tasks:

```bash
# Redis (macOS)
brew install redis && redis-server

# Run Celery worker (in another terminal)
cd backend && celery -A config worker -l info
```

### 2. Environment variables

Create a `.env` in `project-root` or `backend/`:

```env
ALPHA_VANTAGE_API_KEY=your_key
GROQ_API_KEY=your_groq_key          # Used for GenAI insights and agents (Groq is default)
# Optional: use OpenAI instead of Groq
# OPENAI_API_KEY=your_openai_key
# OPENAI_BASE_URL=https://api.openai.com/v1
# LLM_MODEL=gpt-4o-mini
GROQ_MODEL=llama-3.1-70b-versatile   # or llama-3.1-8b-instant
DJANGO_SECRET_KEY=your_secret
REDIS_URL=redis://127.0.0.1:6379/0   # Optional
```

### 3. Run the app

```bash
cd backend
python manage.py migrate
python manage.py runserver
# Or with WebSockets (ASGI):
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Open `http://127.0.0.1:8000`.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fetch-news/` | GET | Live financial news (cached) |
| `/api/live-ticker/` | GET | Indices & stock prices for scrolling ticker (US + India) |
| `/api/chart-data/` | GET | Sentiment distribution & trend |
| `/api/analyze-sentiment/` | POST | FinBERT sentiment + optional GenAI insights |
| `/api/analyze-with-insights/` | POST | Full insights: why, risks, events, aspect sentiment |
| `/api/custom-sentiment/` | POST | Ticker-level sentiment from news |
| `/api/agents/run/` | GET/POST | Run multi-agent pipeline (current news) |
| `/api/agents/symbol-deep-dive/?symbol=AAPL` | GET/POST | Symbol deep-dive: price, news, similar stocks, prediction |
| `/api/quant/signals/` | POST | Sentiment momentum, MA crossover, mean reversion |
| `/api/quant/backtest/` | GET/POST | Backtest ticker (Sharpe, IC, returns) |
| `/api/evaluation/sentiment-accuracy/` | POST | Predicted vs labels accuracy/F1 |
| `/api/evaluation/latency/` | GET | Sentiment analysis latency benchmark |
| `/api/cross-domain/?domain=crypto` | GET | Cross-domain news + reasoning |

---

## One-liner for judges

*"I built an agentic GenAI financial intelligence platform that ingests real-time news, reasons over macro and market context using multiple specialized agents, converts narrative sentiment into quant signals, and validates them via backtesting in a production-grade system."*
