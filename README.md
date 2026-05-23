# Financial Intelligence Platform — FintelliAI

An **agentic GenAI financial intelligence platform** that ingests real-time news, reasons over macro and market context using multiple specialized AI agents, converts narrative sentiment into quantitative signals, and validates them via backtesting — all surfaced in a modern Next.js dashboard.

---

## Table of Contents

1. [Project Overview (5-minute read)](#project-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Tech Stack](#tech-stack)
4. [Features](#features)
5. [Setup & Running](#setup--running)
6. [API Reference](#api-reference)
7. [Viva Questions & Answers](#viva-questions--answers)

---

## Project Overview

### What is this project?

FintelliAI is a full-stack AI-powered financial analysis platform. It pulls live financial news from external APIs, runs that news through an NLP sentiment model (FinBERT), enriches the analysis with a Large Language Model (LLM), and surfaces actionable trading signals — all in real-time through a sleek dashboard.

Think of it as a Bloomberg terminal meets an AI research analyst: instead of just reading headlines, the platform *reasons* about them.

### The Core Flow

```
External News APIs  ──►  News Ingestion  ──►  FinBERT Sentiment
(Alpha Vantage,           (Django REST /         (Positive / Negative /
 Finnhub)                  Celery async)          Neutral + confidence)
                                │
                                ▼
                         GenAI Insights  ──►  Multi-Agent Pipeline
                         (Groq / OpenAI        (News Scout → Macro →
                          via LangChain)        Market Reaction →
                                │               Risk → Decision)
                                ▼
                         Quant Signals  ──►  Backtesting
                         (momentum, MA        (Sharpe ratio, IC,
                          crossover,           total return via
                          mean reversion)      backtrader + yfinance)
                                │
                                ▼
                         Next.js Dashboard  ◄──  WebSocket (real-time)
                         (Charts, News Feed,      (Django Channels)
                          Agent Cards, Scanner)
```

### Who are the "Agents"?

The platform has 5 specialized AI agents that work as a pipeline:

| Agent | Role |
|-------|------|
| **News Scout** | Fetches and filters relevant news |
| **Macro Context** | Identifies macroeconomic themes (inflation, rate hikes, GDP) |
| **Market Reaction** | Predicts likely market movement based on news + macro |
| **Risk Agent** | Identifies key risk drivers and tail risks |
| **Decision Agent** | Synthesizes all inputs into a BUY / SELL / HOLD recommendation |

There is also a **Symbol Deep-Dive** agent that performs a comprehensive single-stock analysis: pulls price history, finds similar stocks by sector, and generates a prediction based on how those peers historically moved.

### What makes it "production-grade"?

- **Redis caching** — API responses are cached to avoid rate-limit penalties
- **Celery async tasks** — news ingestion runs asynchronously in the background
- **Django Channels + WebSockets** — dashboard receives real-time push updates
- **Feature flags** — every advanced feature (`FEATURE_GENAI_INSIGHTS`, `FEATURE_AGENTS`, `FEATURE_QUANT_SIGNALS`, `FEATURE_WEBSOCKETS`) can be toggled via environment variables
- **Structured logging** — all API calls are logged to `news_api.log`
- **ASGI server (Daphne)** — handles both HTTP and WebSocket traffic

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 15)                    │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐  ┌────────────┐  │
│  │Dashboard │  │  Markets  │  │Agent Insights│  │ Backtesting│  │
│  │  Page    │  │  Scanner  │  │    Page      │  │   Page     │  │
│  └──────────┘  └───────────┘  └─────────────┘  └────────────┘  │
│       │               │               │                │         │
│  React Query + Zustand State + TanStack Query + Recharts Charts  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP REST + WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                   BACKEND (Django + DRF + Channels)              │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │ fetch_news  │  │  agents/     │  │  intelligence/        │   │
│  │ (REST APIs) │  │  (5 agents)  │  │  (LLM + insights)     │   │
│  └─────────────┘  └──────────────┘  └───────────────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │   quant/    │  │ evaluation/  │  │   cross_domain/       │   │
│  │ (signals +  │  │ (metrics +   │  │   (crypto, FX,        │   │
│  │  backtest)  │  │  latency)    │  │    commodities)       │   │
│  └─────────────┘  └──────────────┘  └───────────────────────┘   │
│                                                                   │
│  SQLite DB ──── Redis Cache ──── Celery Workers ──── Daphne ASGI │
└──────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
       Alpha Vantage    Finnhub API    Groq / OpenAI
       (news + tickers)  (quotes,      (LLM reasoning)
                          options)
                              │
                         yfinance
                         (OHLC data,
                          options chain)
                              │
                      Hugging Face
                      (FinBERT model)
```

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.10+ | Core language |
| **Django** | 4.2 / 5.x | Web framework + ORM |
| **Django REST Framework** | latest | REST API layer |
| **Django Channels** | latest | WebSocket / ASGI support |
| **Daphne** | latest | ASGI server (serves HTTP + WS) |
| **Celery** | latest | Async task queue |
| **Redis** | latest | Cache + Celery broker |
| **SQLite** | built-in | Database (persistent storage) |

### AI / ML

| Technology | Purpose |
|-----------|---------|
| **FinBERT** (`yiyanghkust/finbert-tone`) | Domain-specific financial sentiment NLP model |
| **PyTorch** | FinBERT inference backend |
| **Hugging Face Transformers** | Load and run FinBERT |
| **LangChain** | LLM orchestration for multi-agent flow |
| **OpenAI Python SDK** | Used for both Groq and OpenAI APIs |
| **Groq API** | Default LLM provider (fast inference, Llama 3.1 70B) |
| **NLTK / scikit-learn** | Supporting NLP utilities |

### Quant / Finance

| Technology | Purpose |
|-----------|---------|
| **yfinance** | Stock OHLC data, options chains |
| **backtrader** | Backtesting engine |
| **pandas / numpy** | Time-series calculations |
| **scipy** | Statistical computations |
| **Alpha Vantage API** | Financial news + sentiment + ticker search |
| **Finnhub API** | Live quotes, candles, company news, options |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 15.x (App Router) | React SSR/SSG framework |
| **React** | 19.x | UI library |
| **TypeScript** | latest | Type safety |
| **Tailwind CSS** | v4 | Utility-first CSS |
| **shadcn/ui + Radix UI** | latest | Accessible component library |
| **Zustand** | latest | Lightweight global state management |
| **TanStack React Query** | latest | Server state, caching, data fetching |
| **Recharts** | latest | Financial charts (line, bar, area) |
| **Framer Motion** | latest | Animations |
| **Lucide React** | latest | Icon set |

---

## Features

### 1. GenAI Intelligence
- **Why sentiment** — LLM explanation for positive/negative/neutral classification
- **Risk drivers** — Key risk drivers extracted from news text
- **Event impact** — Historical context (e.g. "similar narratives led to 2–4% drawdowns")
- **Event extraction** — Detects mergers, rate hikes, earnings misses, etc.
- **Aspect-based sentiment** — Per-dimension sentiment (earnings, macro, sector, guidance)

### 2. Multi-Agent Pipeline
- **Mode A — Current-news:** News Scout → Macro → Market Reaction → Risk → Decision
- **Mode B — Symbol Deep-Dive:** Price + news + sector peers + prediction for one stock

### 3. Quant Layer
- Sentiment momentum, MA crossover, mean reversion signals
- Backtest: price-only vs sentiment-augmented strategy (Sharpe, IC, total return)

### 4. Market Scanner
- Screens multiple tickers combining price momentum + news sentiment
- Returns BULLISH / BEARISH / NEUTRAL signal per symbol

### 5. Options Chain
- Fetches live options data (calls + puts) via yfinance → Finnhub fallback

### 6. Cross-Domain Analysis
- Tracks crypto, commodities, FX, geopolitical news
- LLM reasoning chains: "Geopolitical tension → Oil ↑ → Inflation risk → Bank stocks ↓"

### 7. Evaluation
- Sentiment accuracy vs manual labels (accuracy, macro F1)
- Latency benchmark for sentiment analysis pipeline

---

## Setup & Running

### 1. Install Python dependencies

```bash
cd Financial-News-Sentiment-Analysis
pip install -r requirements.txt
```

### 2. Set environment variables

Create `backend/.env`:

```env
ALPHA_VANTAGE_API_KEY=your_key
FINNHUB_API_KEY=your_key
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-70b-versatile
DJANGO_SECRET_KEY=your_secret_key
REDIS_URL=redis://127.0.0.1:6379/0   # Optional
FEATURE_GENAI_INSIGHTS=true
FEATURE_AGENTS=true
FEATURE_QUANT_SIGNALS=true
FEATURE_WEBSOCKETS=true
```

### 3. Run the backend

```bash
cd backend
python manage.py migrate
# Standard HTTP:
python manage.py runserver
# With WebSocket support (ASGI):
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` — it proxies API calls to `http://localhost:8000`.

### 5. Optional: Redis + Celery

```bash
brew install redis && redis-server
cd backend && celery -A config worker -l info
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fetch-news/` | GET | Live financial news (Redis-cached) |
| `/api/live-ticker/` | GET | Indices + stock prices for scrolling ticker |
| `/api/chart-data/` | GET | Sentiment distribution + trend from DB |
| `/api/analyze-sentiment/` | POST | FinBERT sentiment + optional GenAI insights |
| `/api/analyze-with-insights/` | POST | Full FinBERT + LLM insights pipeline |
| `/api/custom-sentiment/` | POST | Ticker-level sentiment from live news |
| `/api/agents/run/` | GET/POST | Run 5-agent pipeline on current news |
| `/api/agents/symbol-deep-dive/?symbol=AAPL` | GET | Full single-symbol deep dive |
| `/api/scanner/` | GET | Multi-ticker momentum + sentiment screener |
| `/api/options-chain/` | GET | Options chain (calls + puts) |
| `/api/quant/signals/` | POST | Sentiment signals (momentum, MA, reversion) |
| `/api/quant/backtest/` | POST | Backtest (Sharpe, IC, return) |
| `/api/evaluation/sentiment-accuracy/` | POST | Accuracy + F1 vs ground truth labels |
| `/api/evaluation/latency/` | GET | FinBERT latency benchmark |
| `/api/cross-domain/?domain=crypto` | GET | Cross-domain news + LLM reasoning |
| `ws/dashboard/` | WS | WebSocket for real-time dashboard push |
| `/api/shock/score/` | GET | Live shock probability (Redis) |
| `/api/shock/history/` | GET | Backtested Nifty/BankNifty shock events |
| `/api/shock/alerts/` | GET | Fired shock alerts log |
| `ws/shock/` | WS | Real-time shock score stream |

---

## Viva Questions & Answers

### Section 1 — Project Understanding

**Q1. What is the core problem this project solves?**

Manual financial news monitoring is slow, subjective, and unable to scale. Traders and analysts miss critical signals buried in thousands of news articles daily. This platform automates the entire pipeline: ingestion → NLP sentiment → LLM reasoning → quant signals → backtested strategy — giving an objective, explainable, and real-time view of market sentiment.

---

**Q2. What is the overall architecture of the project?**

It is a decoupled, full-stack system:
- **Frontend**: Next.js 15 (App Router) dashboard for visualisation
- **Backend**: Django (REST + WebSocket) for API, business logic, and data
- **NLP Layer**: FinBERT for sentiment, loaded lazily in Python
- **GenAI Layer**: Groq-hosted Llama 3.1 (or OpenAI GPT) via LangChain for LLM reasoning
- **Async Layer**: Celery + Redis for background tasks, Redis for API response caching
- **Real-time Layer**: Django Channels + Daphne ASGI for WebSocket push

---

**Q3. Why did you choose Django over Flask or FastAPI for the backend?**

Django was chosen because:
1. It comes with a built-in ORM (for SQLite/Postgres models), admin panel, and migration system — reducing boilerplate.
2. Django REST Framework provides a mature, production-tested REST layer.
3. Django Channels extends Django natively to support WebSockets without switching frameworks.
4. For a feature-rich application with multiple apps (`fetch_news`, `agents`, `intelligence`, `quant`), Django's app-module structure keeps the codebase organised.

FastAPI would be faster but lacks the built-in ORM, admin, and Channels integration.

---

**Q4. What is FinBERT and why was it chosen for sentiment analysis?**

FinBERT is a variant of BERT (Bidirectional Encoder Representations from Transformers) pre-trained specifically on financial text — earnings reports, financial news articles, analyst notes. Standard BERT or VADER sentiment tools are trained on general English (movie reviews, tweets) and perform poorly on financial text where phrases like "revenue missed estimates" or "guidance lowered" are negative but may not pattern-match general negative sentiment models.

FinBERT (`yiyanghkust/finbert-tone`) was chosen because:
- It outputs three classes: Positive, Negative, Neutral — exactly what financial analysis needs
- It was trained on financial communications, making it domain-accurate
- It is available via Hugging Face Transformers, making integration straightforward

---

**Q5. What is the difference between `analyze-sentiment` and `analyze-with-insights`?**

- `/api/analyze-sentiment/` — runs FinBERT on the input text and returns the label + confidence. GenAI insights are optional (controlled by `FEATURE_GENAI_INSIGHTS` flag).
- `/api/analyze-with-insights/` — always runs the full pipeline: FinBERT + **all five GenAI insight types** (why sentiment, risk drivers, event impact, event extraction, aspect-based sentiment). This is the "premium" version that costs more LLM tokens.

---

### Section 2 — AI & Machine Learning

**Q6. How does the multi-agent pipeline work?**

The orchestrator (`agents/orchestrator.py`) runs agents sequentially, passing output from one as context to the next:

1. **News Scout** — Fetches and ranks the most relevant financial news
2. **Macro Context** — Identifies macro themes: inflation, Fed policy, GDP growth, geopolitical risk
3. **Market Reaction** — Based on news + macro, predicts short-term market sentiment
4. **Risk Agent** — Identifies tail risks, downside scenarios
5. **Decision Agent** — Synthesises all four outputs into a final recommendation: BUY / SELL / HOLD with reasoning

Each agent is a class derived from `agents/base.py` that constructs a prompt, calls the LLM, and returns structured output.

---

**Q7. What is Aspect-Based Sentiment Analysis (ABSA)?**

Standard sentiment analysis gives one label for an entire text. ABSA breaks the text into **aspects** and assigns sentiment to each:

Example for "Apple beat revenue estimates but guidance was weak":
- `earnings`: Positive
- `guidance`: Negative
- `macro`: Neutral
- `sector`: Neutral

This is more useful for financial decisions because a stock can have mixed signals across dimensions.

---

**Q8. What is the Symbol Deep-Dive agent and how does it generate predictions?**

The Symbol Deep-Dive agent (`agents/symbol_deep_dive.py`) performs a three-step analysis for a single stock:
1. Fetches current price, 52-week range, and recent news for the target symbol via yfinance + Finnhub
2. Identifies **sector peers** (similar stocks)
3. Retrieves historical price movement patterns for those peers under similar news conditions
4. Passes all this data to the LLM, which then generates a **prediction with reasoning** — e.g. "Based on how MSFT and GOOGL reacted to similar macro headwinds in Q3 2023, AAPL may see a 2–3% decline"

---

**Q9. How is LangChain used in the project?**

LangChain is used to structure LLM interactions in `intelligence/llm.py` and `intelligence/insights.py`. It provides:
- **Prompt templates** — Structured prompts with variable injection
- **Chain composition** — Connecting prompt → LLM → output parser
- **LLM abstraction** — Allows switching between Groq and OpenAI with minimal code changes by swapping the model configuration

---

**Q10. What is the difference between Groq and OpenAI in this project?**

Both are accessed via the OpenAI-compatible Python SDK. The difference is in the backend:
- **Groq** runs Llama 3.1 (Meta's open-source LLM) on custom inference hardware, making it significantly faster and cheaper
- **OpenAI** runs GPT-4o / GPT-4o-mini, which may have higher quality but at higher latency and cost

The project defaults to Groq (`GROQ_API_KEY`, `GROQ_MODEL=llama-3.1-70b-versatile`) and falls back to OpenAI if `OPENAI_API_KEY` is set.

---

### Section 3 — Quantitative Finance

**Q11. What quant signals does the platform generate?**

Three types of signals from `quant/signals.py`:

| Signal | Logic |
|--------|-------|
| **Sentiment Momentum** | Rate of change of sentiment score over a rolling window. Rising positive sentiment = bullish momentum |
| **MA Crossover** | Short-period sentiment MA crossing above long-period MA = buy signal (analogous to golden cross in price) |
| **Mean Reversion** | When sentiment hits extreme lows (oversold) → potential reversion upward; extreme highs → potential reversal |

---

**Q12. How does the backtesting engine work?**

`quant/backtest.py` uses **backtrader** + **yfinance**:
1. Fetches historical OHLC price data for a symbol via yfinance
2. Constructs two strategies: **price-only** (buy-and-hold or simple moving average) and **sentiment-augmented** (signals enhanced by sentiment scores)
3. Runs both strategies over the historical period
4. Computes performance metrics:
   - **Sharpe Ratio** — risk-adjusted return
   - **Information Coefficient (IC)** — correlation between sentiment signal and next-day return
   - **Total Return** — cumulative profit/loss

This allows comparing whether sentiment data adds alpha over a pure price strategy.

---

**Q13. What is the Sharpe Ratio and why is it used?**

The Sharpe Ratio = (Portfolio Return − Risk-Free Rate) / Standard Deviation of Returns.

It measures **risk-adjusted performance**. A higher Sharpe means more return per unit of risk. It is the standard metric in quant finance to compare strategies fairly — a strategy with 20% return but Sharpe of 0.5 is worse than one with 15% return but Sharpe of 1.8 because the latter achieves consistent returns with less volatility.

---

**Q14. What is the Information Coefficient (IC)?**

IC is the **Pearson correlation** between a factor's predicted signal (sentiment score) and the actual forward return of the asset. IC ranges from -1 to +1:
- IC > 0.05 is generally considered meaningful in quant finance
- IC > 0.10 is considered strong

It measures how predictive the sentiment signal is of actual price movements, beyond random noise.

---

### Section 4 — Backend & Engineering

**Q15. Why is Redis used and what happens if it is not available?**

Redis serves two purposes:
1. **API response caching** — News API responses are cached for a configurable TTL (e.g. 5 minutes) to avoid exceeding Alpha Vantage's rate limit (25 calls/day on free tier)
2. **Celery broker** — Redis acts as the message queue for async Celery tasks

If Redis is unavailable, the project gracefully falls back to:
- **In-memory channel layer** for Django Channels (instead of `channels_redis`)
- **Direct synchronous API calls** (no caching) for news fetching
- **No async tasks** (Celery simply won't start, but the synchronous path still works)

---

**Q16. What is Django Channels and why is it needed?**

Standard Django runs under WSGI, which is synchronous — it handles one request at a time. **Django Channels** extends Django to support **ASGI** (Asynchronous Server Gateway Interface), which enables:
- **WebSocket connections** — persistent bidirectional connections
- **Real-time push** — the server can push data to the browser without the client polling

In this project, `DashboardConsumer` in `fetch_news/consumers.py` handles the `ws/dashboard/` WebSocket endpoint to push live sentiment updates and ticker prices to the frontend.

**Daphne** is the ASGI server that replaces `manage.py runserver` to serve both HTTP and WebSocket traffic.

---

**Q17. What are Celery tasks used for and how are they triggered?**

Celery tasks (`pipelines/tasks.py`) handle **background news ingestion**. Instead of the API request blocking while fetching and processing news (which can take seconds), the task is offloaded:
1. API request hits Django → triggers Celery task
2. Request returns immediately (non-blocking)
3. Celery worker fetches news from Alpha Vantage, runs FinBERT, saves to DB
4. Frontend receives update via WebSocket push

Tasks can also be scheduled with **django-celery-beat** (cron-style periodic tasks), e.g. fetch news every 15 minutes.

---

**Q18. What are Feature Flags and why are they useful?**

Feature flags (`FEATURE_GENAI_INSIGHTS`, `FEATURE_AGENTS`, `FEATURE_QUANT_SIGNALS`, `FEATURE_WEBSOCKETS`) are environment variables that toggle major features on/off at runtime without code changes.

Benefits:
- **Cost control** — GenAI calls cost money; you can disable them on free-tier deployments
- **Graceful degradation** — If Redis is absent, WebSocket feature is turned off but the rest works
- **Staged rollout** — Deploy new features to production but keep them off until tested
- **Demo flexibility** — Show/hide features during a presentation

---

**Q19. Explain the database model used in this project.**

The project uses **SQLite** (default Django database) with a single custom model:

```python
class NewsArticle(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()
    published_at = models.DateTimeField(auto_now_add=True)
```

This stores ingested news articles persistently so the sentiment chart (`/api/chart-data/`) can query historical data from the DB rather than calling the external API every time. The rest of the data (agent outputs, real-time prices) is transient — it lives only in Redis cache or in memory.

---

**Q20. What is CORS and why is `django-cors-headers` needed?**

**CORS (Cross-Origin Resource Sharing)** is a browser security policy that blocks frontend JavaScript from calling a different origin (domain/port) than the one the page was loaded from.

Since the frontend (`localhost:3000`) calls the backend (`localhost:8000`), the browser will block the requests by default. `django-cors-headers` adds the appropriate `Access-Control-Allow-Origin` headers to Django's responses, telling the browser it's safe to allow these cross-origin requests.

---

### Section 5 — Frontend

**Q21. Why Next.js instead of plain React?**

Next.js adds several production-critical features to React:
- **App Router** — File-system based routing, layouts, nested routes
- **Server Components** — Render on the server for faster first paint
- **API proxying** — Can optionally proxy backend calls
- **Turbopack** — Faster development builds
- **Built-in TypeScript support**

For a dashboard with 10+ pages, Next.js's file-based routing is far cleaner than setting up React Router manually.

---

**Q22. Why Zustand over Redux for state management?**

Redux has significant boilerplate: actions, reducers, selectors, middleware. **Zustand** is a minimal state management library with:
- Zero boilerplate — create a store in a few lines
- No providers required — components subscribe to the store directly
- Built-in persistence and devtools support

For this project, `marketStore.ts` holds live index prices (Sensex, Nifty, S&P, Nasdaq) and `agentStore.ts` holds agent pipeline results — both are simple, flat state objects that don't need Redux's complexity.

---

**Q23. What is TanStack React Query and why is it used alongside Zustand?**

Zustand manages **client-side UI state** (what's selected, live ticker prices from WebSocket). React Query manages **server state** — data fetched from APIs:
- Automatic caching of API responses
- Background refetch (stale-while-revalidate)
- Loading / error / success states out of the box
- Deduplication of concurrent requests

They serve different purposes: React Query is for server data, Zustand is for client UI state.

---

**Q24. How does the WebSocket connection work on the frontend?**

`frontend/lib/websocket.ts` implements a `WebSocketClient` class that:
1. Connects to `ws://localhost:8000/ws/dashboard/`
2. Listens for JSON messages pushed by `DashboardConsumer`
3. Parses incoming data and dispatches updates to Zustand stores
4. Handles reconnection logic on disconnect

Components subscribe to the Zustand store and re-render automatically when the store updates — creating a fully reactive real-time dashboard.

---

### Section 6 — External APIs & Data

**Q25. What is Alpha Vantage used for?**

Alpha Vantage provides:
- **`NEWS_SENTIMENT` endpoint** — Financial news with pre-computed sentiment labels (used as raw news text and as a cross-check)
- **`SYMBOL_SEARCH` endpoint** — Ticker autocomplete search
- **Topic-based news** — Filtering news by topic: `earnings`, `ipo`, `mergers_and_acquisitions`, `financial_markets`, `economy_fiscal`, `crypto`, `forex`, `manufacturing`

The free tier allows 25 API calls per day, which is why Redis caching is critical.

---

**Q26. What is Finnhub used for?**

Finnhub provides:
- **Real-time quotes and OHLC candles** for live stock prices
- **Company news** when Alpha Vantage doesn't have ticker-specific news
- **Aggregate sentiment** (a pre-computed buzz/sentiment score)
- **Options chain** data as a fallback when yfinance options data is unavailable
- **Market-wide news** for general financial headlines

Finnhub is used as a complementary source to Alpha Vantage and yfinance.

---

**Q27. How does the options chain feature work?**

`views.options_chain` in Django:
1. First tries **yfinance** — fetches calls and puts for the requested symbol and expiry
2. If yfinance fails or returns empty data, falls back to **Finnhub's option chain API**
3. Returns structured JSON with strike, bid, ask, volume, open interest, implied volatility, greeks (delta, gamma, theta, vega where available)

The frontend `dashboard/options/page.tsx` displays this as a filterable table.

---

### Section 7 — Deployment & Architecture Decisions

**Q28. Why SQLite instead of PostgreSQL?**

SQLite is used because:
- This is a **demo/development project** — SQLite requires zero infrastructure setup
- The data volume is low (only `NewsArticle` records)
- Django makes it trivial to switch to PostgreSQL in production by changing `DATABASES` in `settings.py`

In production, you would replace SQLite with PostgreSQL, especially since Celery + Channels benefit from a more robust database.

---

**Q29. What would you change to make this production-ready?**

1. **Database**: Swap SQLite → PostgreSQL
2. **Auth**: Add JWT authentication (e.g. `djangorestframework-simplejwt`)
3. **Rate limiting**: Add per-IP rate limiting on expensive endpoints (agents, backtest)
4. **Containerisation**: Dockerise all services (Django, Redis, Celery, Next.js)
5. **CI/CD**: Add GitHub Actions for lint, test, and deploy
6. **Monitoring**: Add Sentry for error tracking, Prometheus + Grafana for metrics
7. **Secret management**: Move from `.env` to AWS Secrets Manager or Vault
8. **Horizontal scaling**: Stateless Django behind a load balancer, multiple Celery workers

---

**Q30. What is the DATA_FETCHING module and how does it differ from the main backend?**

`DATA_FETCHING/` is a **standalone Python utility** (separate from the Django app) for bulk data collection and offline model experimentation. It has its own `.env`, its own `config/`, and its own `models/model.py`. It appears to be used for:
- Batch fetching large volumes of news for model training/evaluation
- Offline testing of NLP models outside the web server context

The main Django backend is the live, web-serving component; `DATA_FETCHING` is more of a research/data-engineering utility script.

---

*Built with Django · Next.js · FinBERT · LangChain · Redis · Celery · backtrader · yfinance · Groq*
