# FintelliAI — Complete Project Documentation

> **Version:** 1.0 · **Last Updated:** July 2026  
> An agentic GenAI financial intelligence platform: real-time news ingestion → FinBERT sentiment → multi-agent LLM reasoning → quantitative signals → backtested strategies → live Next.js dashboard.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Backend Modules](#5-backend-modules)
   - 5.1 [fetch\_news](#51-fetch_news)
   - 5.2 [agents](#52-agents)
   - 5.3 [intelligence](#53-intelligence)
   - 5.4 [quant](#54-quant)
   - 5.5 [shock\_predictor](#55-shock_predictor)
   - 5.6 [evaluation](#56-evaluation)
   - 5.7 [cross\_domain](#57-cross_domain)
   - 5.8 [pipelines](#58-pipelines)
   - 5.9 [local\_integrations](#59-local_integrations)
   - 5.10 [config](#510-config)
6. [Frontend](#6-frontend)
   - 6.1 [Pages & Routes](#61-pages--routes)
   - 6.2 [State Management](#62-state-management)
   - 6.3 [Data Fetching Layer](#63-data-fetching-layer)
   - 6.4 [Prisma Edge Schema](#64-prisma-edge-schema)
7. [Full API Reference](#7-full-api-reference)
8. [Data Models](#8-data-models)
9. [Environment Variables](#9-environment-variables)
10. [Feature Flags](#10-feature-flags)
11. [Setup & Local Development](#11-setup--local-development)
12. [Docker & Production Deployment](#12-docker--production-deployment)
13. [Deployment: Vercel + Render (Free Tier)](#13-deployment-vercel--render-free-tier)
14. [External APIs & Rate Limits](#14-external-apis--rate-limits)
15. [Known Issues & Limitations](#15-known-issues--limitations)
16. [Roadmap & Potential Improvements](#16-roadmap--potential-improvements)
17. [Contributing](#17-contributing)

---

## 1. Project Overview

FintelliAI is a full-stack, production-oriented AI financial intelligence platform. It automates the entire analyst workflow:

```
Live News APIs  →  NLP Sentiment  →  Multi-Agent LLM Reasoning  →  Quant Signals  →  Backtesting  →  Real-time Dashboard
```

### Core Problem Solved

Manual financial news monitoring is slow, subjective, and unscalable. Traders and analysts miss critical signals buried in thousands of news articles daily. FintelliAI provides:

- **Automated ingestion** of news from Alpha Vantage, Finnhub, and NewsAPI
- **Domain-accurate sentiment** via FinBERT (trained on financial text)
- **Structured LLM reasoning** through a sequential multi-agent pipeline
- **Quantitative validation** — sentiment signals backtested against real price data
- **Real-time delivery** via WebSockets and a polished Next.js dashboard

### What Makes It Production-Grade

| Feature | Implementation |
|---------|---------------|
| Redis caching | API responses cached with TTL to avoid rate-limit exhaustion |
| Celery async tasks | News ingestion and shock scoring run off the request thread |
| Django Channels + WebSockets | Real-time dashboard push without polling |
| Feature flags | Every major feature togglable via environment variables |
| Graceful degradation | Redis-optional; falls back to in-memory cache and channel layer |
| Structured logging | All API calls logged to `news_api.log` |
| ASGI server (Daphne) | Serves both HTTP and WebSocket traffic |

---

## 2. Repository Structure

```
Financial-News-Sentiment-Analysis/
├── backend/                    # Django application (API + AI + Quant)
│   ├── agents/                 # Multi-agent orchestration pipeline
│   ├── config/                 # Django settings, URLs, ASGI, Celery config
│   ├── cross_domain/           # Crypto, commodities, FX, geopolitical analysis
│   ├── evaluation/             # Sentiment accuracy metrics + latency benchmarks
│   ├── fetch_news/             # News ingestion, FinBERT sentiment, DB models
│   ├── intelligence/           # LLM layer (LangChain + Groq/OpenAI)
│   ├── local_integrations/     # Broker integrations (Zerodha Kite)
│   ├── pipelines/              # Celery task definitions
│   ├── quant/                  # Signals, backtesting, strategy engine
│   ├── scripts/                # Management utilities
│   ├── shock_predictor/        # Market shock detection + Telegram alerts
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── build.sh                # Render build script (migrate + collectstatic)
│
├── frontend/                   # Next.js 15 dashboard
│   ├── app/                    # App Router pages
│   │   ├── dashboard/          # Main dashboard + sub-pages
│   │   │   ├── agents/         # Multi-agent pipeline view
│   │   │   ├── backtest/       # Backtesting UI
│   │   │   ├── markets/        # Markets scanner + intraday trade view
│   │   │   ├── news/           # News feed + sentiment explorer
│   │   │   ├── options/        # Options chain viewer
│   │   │   ├── portfolio/      # Portfolio tracker
│   │   │   ├── scanner/        # Multi-ticker momentum screener
│   │   │   ├── settings/       # User preferences
│   │   │   └── shock/          # Shock alert dashboard
│   │   ├── api/                # Next.js API routes (auth, broker callbacks)
│   │   ├── login/              # Password-protected entry
│   │   └── settings/           # App-level settings page
│   ├── components/             # Reusable UI components (shadcn/ui + custom)
│   ├── hooks/                  # Custom React hooks (useLiveTicker, etc.)
│   ├── lib/                    # API client, WebSocket client, utilities
│   ├── prisma/                 # Prisma schema (PostgreSQL edge persistence)
│   │   └── schema.prisma
│   ├── store/                  # Zustand state stores
│   ├── styles/                 # Global CSS
│   ├── next.config.ts
│   └── package.json
│
├── DATA_FETCHING/              # Standalone Python utility for bulk data collection
│   └── src/                   # Offline NLP model experiments
│
├── docs/                       # Supplemental documentation
│   ├── FRONTEND_FIGMA.md       # Design system reference
│   ├── INTEGRATION.md          # Frontend-backend integration guide
│   ├── MARKETS_APIS.md         # API options for Indian/US/global markets
│   ├── SHOCK_PREDICTOR.md      # Shock predictor setup guide
│   ├── TRADING_DECISION_V1.md  # Intraday trade decision spec
│   └── VERIFICATION.md         # End-to-end verification checklist
│
├── .env.example                # Root env template (copy to backend/.env)
├── DEPLOY.md                   # Vercel + Render deployment guide
├── FRONTEND_SETUP.md           # Frontend-specific setup steps
├── INTERVIEW_README.md         # Technical Q&A reference
├── README.md                   # Project overview + quick start
├── docker-compose.edge.yml     # Local Docker (Postgres for edge mode)
├── docker-compose.prod.yml     # Production Docker Compose
├── render.yaml                 # Render Blueprint configuration
└── requirements.txt            # Root-level requirements (mirrors backend/)
```

---

## 3. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND — Next.js 15 (App Router)               │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard │ │ Markets  │ │  Agents   │ │Backtest  │ │  Shock   │ │
│  │ (main)   │ │ Scanner  │ │ Insights  │ │   UI     │ │  Alert   │ │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘ └──────────┘ │
│                                                                       │
│    TanStack React Query  ·  Zustand State  ·  Recharts  ·  Framer   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  HTTP REST + WebSocket (wss://)
┌───────────────────────────────▼─────────────────────────────────────┐
│               BACKEND — Django 4.2+ · DRF · Channels · Daphne        │
│                                                                       │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ fetch_news  │ │   agents/    │ │ intelligence/│ │    quant/   │ │
│  │ (ingestion, │ │ (12-step     │ │ (LangChain + │ │ (signals,   │ │
│  │  FinBERT,   │ │  orchestr.)  │ │  LLM calls)  │ │  backtest,  │ │
│  │  WebSocket) │ │              │ │              │ │  strategy)  │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │  evaluation │ │ cross_domain │ │shock_predict.│ │  pipelines  │ │
│  │  (metrics,  │ │ (crypto, FX, │ │ (Nifty shock │ │  (Celery    │ │
│  │   latency)  │ │  geopolitics)│ │  detection)  │ │   tasks)    │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│                                                                       │
│   SQLite (dev) / PostgreSQL (prod)                                   │
│   Redis Cache · Celery Workers · Celery Beat Scheduler               │
└───────────────┬────────────────────────────┬────────────────────────┘
                │                            │
   ┌────────────▼───────────┐  ┌────────────▼────────────┐
   │  Data & News APIs       │  │  AI / ML Services        │
   │  · Alpha Vantage        │  │  · Groq (Llama 3.3 70B) │
   │  · Finnhub              │  │  · OpenAI (fallback)    │
   │  · NewsAPI              │  │  · FinBERT (local)      │
   │  · yfinance             │  │    via Hugging Face     │
   │  · feedparser (RSS)     │  └─────────────────────────┘
   └─────────────────────────┘
```

### Request Lifecycle

1. **User action** (e.g. "Run Agents") triggers a POST to `/api/agents/run/`
2. Django view checks the `FEATURE_AGENTS` flag; if enabled, calls `AgentOrchestrator.run()`
3. Orchestrator fetches news (with Redis cache check), then passes articles through 12 sequential agent steps
4. Each agent builds a prompt from the shared `ctx` dict, calls the LLM via LangChain, and writes its output back to `ctx`
5. Final `DecisionAgent` synthesizes all outputs into a BUY/SELL/HOLD recommendation
6. Response is serialized to JSON and returned to the frontend
7. Frontend `DashboardConsumer` (WebSocket) pushes live updates to subscribed clients

---

## 4. Tech Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10+ | Core language |
| Django | 4.2–5.x | Web framework, ORM, admin, migrations |
| Django REST Framework | ≥3.14 | REST API serialization and routing |
| Django Channels | ≥4.0 | ASGI WebSocket support |
| Daphne | ≥4.0 | ASGI server (HTTP + WebSocket) |
| Celery | ≥5.3 | Distributed async task queue |
| django-celery-beat | ≥2.5 | Cron-style periodic task scheduling |
| Redis | ≥5.0 | API cache, Celery broker/backend, Channels layer |
| SQLite | built-in | Local dev database |
| PostgreSQL | via dj-database-url | Production database (Render) |
| WhiteNoise | ≥6.6 | Static file serving in production |

### AI / ML

| Technology | Purpose |
|-----------|---------|
| FinBERT (`yiyanghkust/finbert-tone`) | Domain-specific financial NLP sentiment (Positive/Negative/Neutral) |
| PyTorch | FinBERT inference runtime |
| Hugging Face Transformers | Model loading, tokenization, pipeline |
| LangChain | LLM prompt templates, chain composition, provider abstraction |
| openai SDK | Compatible with both Groq and OpenAI APIs |
| Groq (Llama 3.3 70B) | Default LLM provider — fast, cheap inference |
| OpenAI GPT-4o | Optional premium LLM fallback |
| NLTK / scikit-learn | Supporting NLP utilities |
| ta | Technical analysis indicators library |

### Quantitative Finance

| Technology | Purpose |
|-----------|---------|
| yfinance | OHLC price history, options chains, live quotes |
| backtrader | Strategy backtesting engine |
| pandas / numpy | Time-series data manipulation |
| scipy | Statistical computations (correlation, regression) |
| Alpha Vantage | Financial news sentiment + ticker search |
| Finnhub | Live quotes, candles, options data, company news |
| feedparser | RSS feed parsing for shock predictor news |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.x (App Router) | React SSR/SSG framework, file-based routing |
| React | 19.x | UI component library |
| TypeScript | 5.x | Static type safety |
| Tailwind CSS | v4 | Utility-first CSS |
| shadcn/ui + Radix UI | latest | Accessible component primitives |
| Zustand | 5.x | Lightweight global state management |
| TanStack React Query | 5.x | Server state caching, background refetch |
| Recharts + Chart.js | latest | Financial charts (line, bar, area, candlestick) |
| Framer Motion | 12.x | UI animations and transitions |
| Lucide React | latest | Icon set |
| Prisma | 6.x | ORM for edge PostgreSQL models |
| NextAuth.js | built into Next.js API routes | Password-protected demo login |
| kiteconnect | 5.x | Zerodha broker integration |

---

## 5. Backend Modules

### 5.1 `fetch_news`

**Purpose:** Core news ingestion, FinBERT sentiment analysis, real-time WebSocket consumer, and the Django ORM model for persistent news articles.

**Key files:**

| File | Description |
|------|-------------|
| `views.py` | All primary API views: `fetch_news`, `analyze_sentiment`, `live_ticker`, `chart_data`, `options_chain`, `scanner`, `trade_decision`, `custom_sentiment` |
| `sentiment.py` | Lazy-loads FinBERT model; exposes `analyze_sentiment(text)` returning label + confidence |
| `consumers.py` | `DashboardConsumer` WebSocket handler for `ws/dashboard/` endpoint |
| `models.py` | `NewsArticle` Django model (title, content, published\_at, sentiment) |
| `urls.py` | URL routing for all `fetch_news` endpoints |

**FinBERT Model Loading:**
FinBERT is loaded lazily on first use (to avoid startup delay). It is loaded into CPU memory by default; GPU is used automatically if `torch.cuda.is_available()`.

**Caching Strategy:**
- Alpha Vantage news responses are cached in Redis (or `LocMemCache`) with a configurable TTL
- The free Alpha Vantage tier allows only **25 requests/day**, making caching critical
- Cache key is based on the news topic/ticker query

---

### 5.2 `agents`

**Purpose:** Sequential multi-agent pipeline for financial reasoning. Each agent is a Python class that reads from and writes to a shared context dictionary.

**Full Pipeline Order (12 steps):**

```
news_fetch → news_scout → macro_context → technical → market_reaction
→ risk → bull_research → bear_research → risk_committee → debate_facilitator
→ shock → decision
```

**Agent Files:**

| File | Agent Class | Role |
|------|------------|------|
| `base.py` | `BaseAgent` | Abstract base with `run(ctx)` interface |
| `news_scout.py` | `NewsScoutAgent` | Scans sentiment distribution, detects spikes |
| `macro_context.py` | `MacroContextAgent` | Links headlines to macro themes (rates, CPI, GDP, yields) |
| `technical_agent.py` | `TechnicalAgent` | Moving averages, momentum, volatility signals |
| `market_reaction.py` | `MarketReactionAgent` | Predicts market reaction from news + macro |
| `risk_agent.py` | `RiskAgent` | Flags concentration, spike, and downside risks |
| `debate_agents.py` | `BullResearcherAgent`, `BearResearcherAgent`, `RiskCommitteeAgent`, `DebateFacilitatorAgent` | Structured bull vs. bear debate with risk constraints |
| `decision_agent.py` | `DecisionAgent` | Synthesizes all agent outputs into BUY/SELL/HOLD |
| `symbol_deep_dive.py` | (standalone) | Single-stock deep analysis with sector peer comparison |
| `orchestrator.py` | `AgentOrchestrator` | Runs all agents sequentially, returns unified `pipeline` output |
| `report_schema.py` | Pydantic schemas | Typed output definitions for agent responses |

**Context Dictionary (`ctx`):**
All agents share and mutate a single Python `dict`. This avoids network overhead (no Redis pub/sub between agents). The dict grows as each agent appends its output under `ctx["agent_outputs"][<AgentName>]`.

**Symbol Deep-Dive:**
A separate agent flow (not part of the main pipeline) that:
1. Fetches current price, 52-week high/low, and recent news for one ticker
2. Identifies sector peers via yfinance
3. Retrieves historical price movements of those peers under similar conditions
4. Passes all data to the LLM to generate a price prediction with reasoning

---

### 5.3 `intelligence`

**Purpose:** LLM integration layer. Wraps LangChain and provides reusable functions for all LLM calls.

**Key files:**

| File | Description |
|------|-------------|
| `llm.py` | LLM client factory — configures Groq (default) or OpenAI; implements all insight generators: `why_sentiment`, `risk_drivers`, `event_impact`, `event_extraction`, `aspect_based_sentiment` |
| `insights.py` | Entry point: `get_insights(text, label)` — calls all five insight generators |

**Five Insight Types:**

| Insight | Description |
|---------|-------------|
| `why_sentiment` | LLM explanation for why the text was classified positive/negative/neutral |
| `risk_drivers` | Extracted key risk factors from the news text |
| `event_impact` | Historical context ("similar narratives led to 2–4% drawdowns") |
| `event_extraction` | Detects specific events: mergers, rate hikes, earnings misses |
| `aspect_based_sentiment` | Per-dimension sentiment: earnings, macro, sector, guidance |

**LLM Provider Selection:**
```
GROQ_API_KEY set? → Use Groq (llama-3.3-70b-versatile) [default]
OPENAI_API_KEY set? → Use OpenAI (gpt-4o or gpt-4o-mini)
Neither set? → LLM features return graceful error response
```

---

### 5.4 `quant`

**Purpose:** Quantitative signal generation, backtesting, strategy engine, and technical indicators.

**Key files:**

| File | Description |
|------|-------------|
| `signals.py` | Three sentiment signals: momentum, MA crossover, mean reversion |
| `backtest.py` | Backtrader integration — runs price-only vs sentiment-augmented strategies; computes Sharpe, IC, total return |
| `event_backtest.py` | Event-driven backtest (news event → price reaction analysis) |
| `strategy_engine.py` | Modular strategy engine for combining multiple signals |
| `strategy_llm.py` | LLM-generated strategy suggestions based on market context |
| `research_benchmark.py` | Research-grade benchmark with transaction costs, slippage, India/global symbols |
| `technical_snapshot.py` | Technical analysis snapshot for a given symbol and timeframe |
| `indicators.py` | Technical indicators (RSI, MACD, Bollinger Bands, etc.) |
| `catalog.py` | Strategy catalog for the strategy engine |
| `backtest_smoke_test.py` | Quick validation script for backtesting pipeline |

**Quant Signals:**

| Signal | Logic |
|--------|-------|
| Sentiment Momentum | Rate of change of sentiment score over a rolling window |
| MA Crossover | Short-period sentiment MA crossing above long-period MA = buy signal |
| Mean Reversion | Extreme sentiment lows → potential reversion upward |

**Backtest Metrics:**

| Metric | Definition |
|--------|-----------|
| Sharpe Ratio | (Return − Risk-Free Rate) / StdDev of Returns |
| Information Coefficient (IC) | Pearson correlation between sentiment signal and next-day return |
| Total Return | Cumulative P&L over the backtest period |
| Max Drawdown | Largest peak-to-trough decline |

---

### 5.5 `shock_predictor`

**Purpose:** Real-time Nifty/BankNifty/Sensex intraday market shock detection. Combines RSS news sentiment, options market data (PCR, IV), and VIX to compute a live shock probability score.

**Key files:**

| File | Description |
|------|-------------|
| `models.py` | Three Django models: `ShockEvent` (historical shocks), `ShockPrecursorPattern` (aggregated fingerprints), `ShockAlert` (live fired alerts) |
| `agent.py` | `ShockAgent` — computes current shock probability and suggests hedges |
| `nlp.py` | NLP pipeline for extracting signals from RSS headlines |
| `scoring.py` | Rule-based scoring of shock probability (0–100) |
| `news_fetcher.py` | RSS feed fetcher (feedparser) for live market news |
| `consumers.py` | WebSocket consumer for `ws/shock/` live score stream |
| `tasks.py` | Celery tasks: `poll_and_score` (every 30s during market hours) + `update_eod_feedback` (15:35 IST) |
| `symbols.py` | Nifty/BankNifty/Sensex symbol definitions |
| `telegram_bot.py` | Sends Telegram alerts when shock score ≥ 70 |

**Database Models:**

- **`ShockEvent`**: One row per historical shock day. Stores OHLCV data, direction (UP/DOWN), magnitude, cause type (policy/macro/geopolitical/technical/corporate), headlines, PCR, IV change, FII flows, VIX, and `precursor_signals` JSON.
- **`ShockPrecursorPattern`**: Aggregated fingerprint per cause type. Used to match current conditions against known shock patterns.
- **`ShockAlert`**: Fired live alert with score, cause hypothesis, trigger headline, suggested hedge, and EOD Nifty change for feedback tracking.

**Celery Beat Schedule:**

```python
CELERY_BEAT_SCHEDULE = {
    'shock-poll-and-score': {
        'task': 'shock_predictor.tasks.poll_and_score',
        'schedule': 30.0,  # every 30 seconds during market hours
    },
    'shock-eod-feedback': {
        'task': 'shock_predictor.tasks.update_eod_feedback',
        'schedule': crontab(hour=15, minute=35),  # 3:35 PM IST daily
    },
}
```

**Cause Types:** `policy`, `macro`, `geopolitical`, `technical`, `corporate`, `unknown`

---

### 5.6 `evaluation`

**Purpose:** Model quality and performance benchmarking.

**Key file:** `metrics.py`

| Metric | Endpoint | Description |
|--------|----------|-------------|
| Sentiment Accuracy | `/api/evaluation/sentiment-accuracy/` | Accuracy + macro F1 vs manually labeled ground truth |
| Latency Benchmark | `/api/evaluation/latency/` | FinBERT inference time per article (ms) |

> **Note:** Hard accuracy percentages should only be cited if you have a written benchmark run with a known dataset. The evaluation endpoints provide the harness to produce those numbers.

---

### 5.7 `cross_domain`

**Purpose:** Cross-asset analysis — tracks crypto, commodities, foreign exchange, and geopolitical news, then uses the LLM to reason about downstream market effects.

**Example reasoning chain:** "Geopolitical tension → Oil ↑ → Inflation risk → Bank stocks ↓"

**Endpoint:** `GET /api/cross-domain/?domain=<domain>`

**Supported domains:** `crypto`, `commodities`, `forex`, `geopolitical`

---

### 5.8 `pipelines`

**Purpose:** Celery task definitions for background news ingestion.

**Key file:** `tasks.py`

The main task fetches news from Alpha Vantage, runs FinBERT sentiment, and saves articles to the database asynchronously. This decouples the API response time from the news processing time.

---

### 5.9 `local_integrations`

**Purpose:** Broker integration module. Contains Zerodha Kite Connect integration for live order placement (optional, requires active Kite subscription and daily access token).

**Environment variables:**
```env
KITE_API_KEY=...
KITE_API_SECRET=...
KITE_ACCESS_TOKEN=...
EDGE_BROKER=ZERODHA
```

> **Warning:** This module enables actual order execution. Only activate in a controlled environment with a paper trading or sandbox account.

---

### 5.10 `config`

**Purpose:** Django project configuration.

| File | Description |
|------|-------------|
| `settings.py` | All Django settings — database, Redis, Celery, Channels, feature flags, logging, CORS |
| `urls.py` | Root URL router (includes `fetch_news.urls`) |
| `asgi.py` | ASGI application with Channels URL routing for WebSocket paths |
| `celery.py` | Celery app factory |

**Django Installed Apps:**
`daphne`, `fetch_news`, `intelligence`, `agents`, `quant`, `pipelines`, `evaluation`, `cross_domain`, `shock_predictor`, `django_celery_beat`, `rest_framework`, `corsheaders`, plus all standard Django apps.

---

## 6. Frontend

### 6.1 Pages & Routes

All pages live under `frontend/app/`. The dashboard requires authentication (password set via `DASHBOARD_PASSWORD` env var).

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/dashboard` or `/login` |
| `/login` | Password-protected entry page |
| `/dashboard` | Main overview: live ticker, news feed, sentiment chart, agent summary |
| `/dashboard/news` | Full news feed with per-article sentiment + insights |
| `/dashboard/agents` | Multi-agent pipeline run view with step-by-step pipeline cards |
| `/dashboard/markets` | Markets scanner + intraday trade decision + chart with SL/TP overlays |
| `/dashboard/scanner` | Multi-ticker momentum + sentiment screener |
| `/dashboard/options` | Options chain table (calls + puts) |
| `/dashboard/backtest` | Strategy backtesting UI (price-only vs sentiment-augmented) |
| `/dashboard/shock` | Real-time shock score + historical shock events + alert log |
| `/dashboard/portfolio` | Portfolio tracker (in development) |
| `/dashboard/settings` | User preferences and watchlist management |
| `/settings` | App-level settings page |

---

### 6.2 State Management

**Zustand** manages client-side UI state (two stores):

| Store | State |
|-------|-------|
| `marketStore` | Live index prices (Sensex, Nifty, S&P 500, Nasdaq), WebSocket connection status |
| `agentStore` | Agent pipeline results, loading state, last run timestamp |

**TanStack React Query** manages server state:
- Automatic caching of API responses with configurable `staleTime`
- Background refetch (stale-while-revalidate)
- Loading/error/success states
- Deduplication of concurrent requests for the same endpoint

---

### 6.3 Data Fetching Layer

`frontend/lib/apiClient.ts` — central HTTP client configured with `NEXT_PUBLIC_API_URL` as base URL.

`frontend/lib/websocket.ts` — `WebSocketClient` class:
1. Connects to `ws://localhost:8000/ws/dashboard/` (configurable via `NEXT_PUBLIC_WS_URL`)
2. Parses incoming JSON messages from `DashboardConsumer`
3. Dispatches updates to Zustand `marketStore`
4. Implements reconnection logic with exponential backoff

**Polling intervals (React Query):**

| Data | Interval |
|------|---------|
| Live ticker | 2 minutes |
| News feed | 30 seconds |
| Agent insights | 5 minutes |
| Shock score | 30 seconds |

---

### 6.4 Prisma Edge Schema

Prisma manages a separate set of PostgreSQL tables for edge/browser-side persistence (candles, signals, backtests, watchlist, settings). These coexist with Django's tables in the same database.

**Models:**

| Model | Purpose |
|-------|---------|
| `OHLCVCandle` | Completed OHLCV bars (persisted from session or historical backfill) |
| `Signal` | AI/trading signals with full technical snapshot JSON |
| `BacktestRun` | Backtest run metadata and summary (Sharpe, drawdown, net P&L) |
| `BacktestTrade` | Individual trades within a backtest run |
| `WatchlistSymbol` | User's watchlist (symbol + exchange + sort order) |
| `Settings` | Singleton settings: broker, signal sensitivity, enabled indicators |
| `ConnectionLog` | Broker connection history with success/error and profile data |

---

## 7. Full API Reference

### News & Sentiment

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/fetch-news/` | GET | Live financial news (Redis-cached). Optional `?topic=earnings` | None |
| `/api/analyze-sentiment/` | POST | FinBERT sentiment on custom text. Body: `{ "text": "..." }`. Optional GenAI insights via flag | None |
| `/api/analyze-with-insights/` | POST | Full FinBERT + all 5 GenAI insight types | None |
| `/api/custom-sentiment/` | POST | Aggregate sentiment from live news for a ticker. Body: `{ "ticker": "AAPL" }` | None |
| `/api/chart-data/` | GET | Sentiment distribution + trend from stored `NewsArticle` DB records | None |

### Market Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/live-ticker/` | GET | Scrolling ticker: indices (Nifty, Sensex, S&P, Nasdaq) + watchlist stocks |
| `/api/market/<symbol>/history/` | GET | OHLC history via yfinance. Query: `?period=1mo` (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y) |
| `/api/options-chain/` | GET | Options chain (calls + puts). Query: `?symbol=AAPL&expiry=2025-01-17` |
| `/api/search-ticker/` | GET | Ticker autocomplete. Query: `?q=AAPL` |

### Agents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/run/` | GET/POST | Run 12-step agent pipeline on current news. Optional: `?ticker=AAPL` |
| `/api/agents/symbol-deep-dive/` | GET | Single-symbol deep dive with sector peer comparison. Required: `?symbol=AAPL` |

### Quant & Backtesting

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quant/signals/` | POST | Compute sentiment signals. Body: `{ "ticker": "AAPL", "window": 10 }` |
| `/api/quant/backtest/` | POST | Run backtest. Body: `{ "ticker": "AAPL", "period": "1y" }` |
| `/api/quant/research-benchmark/` | GET/POST | Research-grade benchmark with transaction costs + slippage (India + optional global) |

### Scanner & Trading

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scanner/` | GET | Multi-ticker screener: BULLISH/BEARISH/NEUTRAL per symbol |
| `/api/trade/decision/` | GET | Intraday decision (BUY/SELL/NO_TRADE) with entry, SL, target, risk-reward. Query: `?symbol=^NSEI&hold_minutes=15` |

### Evaluation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/evaluation/sentiment-accuracy/` | POST | Accuracy + macro F1 vs ground truth labels |
| `/api/evaluation/latency/` | GET | FinBERT latency benchmark (ms per article) |

### Cross-Domain

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cross-domain/` | GET | Cross-asset news + LLM reasoning chain. Query: `?domain=crypto` |

### Shock Predictor

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shock/score/` | GET | Latest shock probability score from Redis |
| `/api/shock/history/` | GET | Backtested shock events. Query: `?page=1&cause=policy` |
| `/api/shock/alerts/` | GET | Fired live shock alerts log |
| `/api/shock/patterns/` | GET | Aggregated precursor fingerprints per cause type |

### WebSockets

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `ws/dashboard/` | WS | Real-time dashboard push (ticker prices, sentiment updates) |
| `ws/shock/` | WS | Real-time shock score stream (updated every 30s during market hours) |

### System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health/` | GET | Health check (used by Render for service monitoring) |
| `/admin/` | GET | Django admin panel |

---

## 8. Data Models

### Django ORM (SQLite / PostgreSQL)

#### `NewsArticle` (fetch\_news app)
```python
class NewsArticle(models.Model):
    title        = CharField(max_length=255)
    content      = TextField()
    published_at = DateTimeField(auto_now_add=True)
    # sentiment label stored inline or derived on read
```

#### `ShockEvent` (shock\_predictor app)
| Field | Type | Description |
|-------|------|-------------|
| `date` | DateField | Shock date |
| `index` | CharField | NIFTY / BANKNIFTY / SENSEX |
| `open_price`, `close_price`, `high_price`, `low_price` | Float | OHLC |
| `intraday_range` | Float | High - Low |
| `direction` | CharField | UP / DOWN |
| `magnitude` | Float | Points moved |
| `cause_type` | CharField | policy / macro / geopolitical / technical / corporate / unknown |
| `cause_summary` | TextField | Human-readable description |
| `headline` | TextField | Trigger headline |
| `pcr_before` | Float | Put-call ratio before shock |
| `iv_change_pct` | Float | Implied volatility change |
| `fii_flow_crores` | Float | Foreign institutional investor flows |
| `vix_open` | Float | VIX at open |
| `precursor_signals` | JSONField | Structured dict of pre-shock signals |

#### `ShockPrecursorPattern` (shock\_predictor app)
Aggregated fingerprint per `cause_type`, updated after each backtest run.

#### `ShockAlert` (shock\_predictor app)
| Field | Type | Description |
|-------|------|-------------|
| `fired_at` | DateTimeField | When the alert was triggered |
| `score` | IntegerField | Shock probability score (0–100) |
| `cause_hypothesis` | CharField | Most likely cause type |
| `trigger_headline` | TextField | Headline that triggered the alert |
| `suggested_hedge` | TextField | LLM-suggested hedge action |
| `status` | CharField | fired / confirmed / false\_positive |
| `eod_nifty_change` | Float | End-of-day Nifty change (filled by EOD task) |

### Django-Celery-Beat Models
Standard `django_celery_beat` tables are also present in the database for managing the periodic task schedule.

---

## 9. Environment Variables

### Root / Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | ✅ | `django-insecure-default-key` | Django secret key |
| `DJANGO_DEBUG` | ❌ | `True` | Set to `False` in production |
| `DJANGO_ALLOWED_HOSTS` | ❌ | `*` | Comma-separated allowed hosts |
| `DATABASE_URL` | ❌ | SQLite | PostgreSQL connection URL |
| `DATABASE_SSL` | ❌ | `true` | Require SSL for PostgreSQL |
| `REDIS_URL` | ❌ | `redis://127.0.0.1:6379/0` | Redis URL (optional — falls back to in-memory) |
| `CELERY_BROKER_URL` | ❌ | `redis://127.0.0.1:6379/1` | Celery broker |
| `CELERY_RESULT_BACKEND` | ❌ | `redis://127.0.0.1:6379/2` | Celery results backend |
| `ALPHA_VANTAGE_API_KEY` | ✅ | — | Alpha Vantage news + ticker search |
| `FINNHUB_API_KEY` | ✅ | — | Finnhub quotes, candles, options |
| `NEWSAPI_KEY` | ❌ | — | NewsAPI (used by shock predictor backtest) |
| `GROQ_API_KEY` | ❌ | — | Groq LLM (enables GenAI features) |
| `GROQ_MODEL` | ❌ | `llama-3.3-70b-versatile` | Groq model ID |
| `OPENAI_API_KEY` | ❌ | — | OpenAI fallback |
| `FEATURE_GENAI_INSIGHTS` | ❌ | `true` | Toggle GenAI insight generation |
| `FEATURE_AGENTS` | ❌ | `true` | Toggle multi-agent pipeline |
| `FEATURE_QUANT_SIGNALS` | ❌ | `true` | Toggle quant signals |
| `FEATURE_WEBSOCKETS` | ❌ | `true` | Toggle WebSocket push |
| `CORS_EXTRA_ORIGINS` | ❌ | — | Additional CORS origins (comma-separated) |
| `TELEGRAM_BOT_TOKEN` | ❌ | — | Telegram bot for shock alerts |
| `TELEGRAM_CHAT_ID` | ❌ | — | Telegram chat/channel ID |
| `KITE_API_KEY` | ❌ | — | Zerodha Kite API key |
| `KITE_API_SECRET` | ❌ | — | Zerodha Kite API secret |
| `KITE_ACCESS_TOKEN` | ❌ | — | Zerodha daily access token |
| `EDGE_BROKER` | ❌ | `ZERODHA` | Active broker for order execution |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Django backend base URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | ❌ | WebSocket base URL (e.g. `ws://localhost:8000`) |
| `DATABASE_URL` | ❌ | PostgreSQL URL for Prisma (production only) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth session signing secret |
| `NEXTAUTH_URL` | ✅ | Canonical URL for the Next.js app |
| `DASHBOARD_PASSWORD` | ✅ | Demo login password |
| `OPENAI_API_KEY` | ❌ | OpenAI key for Next.js API routes |

---

## 10. Feature Flags

Feature flags allow toggling major features at runtime without code changes. They are read from environment variables in `config/settings.py`.

| Flag | Default | Effect when `false` |
|------|---------|---------------------|
| `FEATURE_GENAI_INSIGHTS` | `true` | `/api/analyze-with-insights/` returns only FinBERT label; no LLM calls |
| `FEATURE_AGENTS` | `true` | `/api/agents/run/` returns a 503 or empty response |
| `FEATURE_QUANT_SIGNALS` | `true` | Quant endpoints disabled |
| `FEATURE_WEBSOCKETS` | `true` | WebSocket consumer does not broadcast (dashboard uses REST polling only) |

**Use cases for disabling flags:**
- **Cost control** — Groq/OpenAI calls cost money; disable GenAI on free-tier deployments
- **Graceful degradation** — If Redis is absent, `FEATURE_WEBSOCKETS=false` prevents errors
- **Demo mode** — Selectively show/hide features during a presentation
- **Staged rollout** — Deploy new features but keep them disabled until tested

---

## 11. Setup & Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- Redis (optional, but recommended for full functionality)

### Step 1 — Clone and install Python dependencies

```bash
git clone <repo-url>
cd Financial-News-Sentiment-Analysis
pip install -r requirements.txt
```

### Step 2 — Configure environment

```bash
cp .env.example backend/.env
# Edit backend/.env with your API keys
```

Minimum required keys for basic functionality:
```env
ALPHA_VANTAGE_API_KEY=your_key
FINNHUB_API_KEY=your_key
DJANGO_SECRET_KEY=any-random-secret
```

For GenAI features:
```env
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
```

### Step 3 — Initialize the database

```bash
cd backend
python manage.py migrate
```

### Step 4 — Run the backend

**Option A — Standard WSGI (no WebSocket):**
```bash
cd backend
python manage.py runserver
```

**Option B — ASGI with WebSocket support:**
```bash
cd backend
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Step 5 — Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The app proxies API calls to `http://localhost:8000`.

### Step 6 — Optional: Redis + Celery

```bash
# macOS
brew install redis && redis-server

# Celery worker (in a separate terminal)
cd backend
celery -A config worker -l info

# Celery Beat (periodic tasks — shock scoring, news polling)
celery -A config beat -l info
```

### Step 7 — Optional: Shock Predictor Backtest

```bash
cd backend
pip install feedparser  # if not already installed
python manage.py backtest_shocks --fast --skip-newsapi --indices nifty
```

This populates `ShockEvent` records used by the shock scoring model (~40 historical Nifty shock days).

---

## 12. Docker & Production Deployment

### Local Docker (Edge Mode — Postgres + Redis)

```bash
docker compose -f docker-compose.edge.yml up -d
```

This starts a local PostgreSQL instance. Set `DATABASE_URL` in `backend/.env` and `frontend/.env.local` to the local Postgres connection string.

### Production Docker Compose

```bash
docker compose -f docker-compose.prod.yml up -d
```

Starts: Django (Daphne ASGI), Next.js, Redis, Celery Worker, Celery Beat.

### Backend Dockerfile

```dockerfile
# From backend/Dockerfile
# Python 3.11 slim → installs requirements.txt → runs build.sh
# Start: daphne -b 0.0.0.0 -p $PORT config.asgi:application
```

`build.sh` runs on every Render deploy:
```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --no-input
```

---

## 13. Deployment: Vercel + Render (Free Tier)

See [DEPLOY.md](./DEPLOY.md) for the full step-by-step guide.

### Architecture

| Service | Platform | Purpose |
|---------|----------|---------|
| Django API | Render Web Service | REST + WebSocket backend |
| Next.js Frontend | Vercel | Static + server-side rendering |
| PostgreSQL | Render Postgres (Free) | Shared database for Django + Prisma |
| Redis | ❌ (not on free tier) | In-memory fallback used instead |

### Quick Summary

1. **Render Postgres**: Create → copy Internal URL → set as `DATABASE_URL` in Render backend env
2. **Render Backend**: Connect GitHub repo → Blueprint reads `render.yaml` → set all env vars
3. **Vercel Frontend**: Import repo → set root to `frontend` → set env vars (External DB URL + API URL)
4. **Cross-link**: Set `CORS_EXTRA_ORIGINS` on Render to your Vercel URL → redeploy backend

### Free Tier Limitations

| Constraint | Impact |
|-----------|--------|
| Render sleeps after ~15 min idle | 30–60s cold start on first request |
| 512 MB RAM on free Render service | FinBERT first load may be slow; upgrade if OOM |
| No free Redis on Render | Shock Celery tasks disabled; REST polling works |
| Render Postgres expires after 90 days inactivity | Recreate if expired |
| Vercel serverless timeout | Long backtests should call Render API directly |

---

## 14. External APIs & Rate Limits

| API | Free Tier Limit | Used For | Rate Limit Strategy |
|-----|----------------|---------|---------------------|
| **Alpha Vantage** | 25 req/day | News sentiment, ticker search | Redis TTL cache (5 min default) |
| **Finnhub** | 60 req/min | Live quotes, candles, options, company news | Per-request, no batch caching |
| **NewsAPI** | 100 req/day | Shock predictor historical backtest | Used sparingly; `--skip-newsapi` flag available |
| **Groq** | Generous free tier | LLM inference (all agent + insight calls) | No caching; each pipeline run makes multiple calls |
| **OpenAI** | Pay-per-use | Fallback LLM provider | Same as Groq |
| **yfinance** | Unofficial; self-rate-limit | OHLC data, options, live quotes | No built-in caching; use sparingly |

### Adding a New News Source

1. Add the API key to `config/settings.py` and `.env.example`
2. Create a client module under `fetch_news/` (e.g. `polygon_client.py`) returning normalized items: `{ "title", "url", "sentiment", "source" }`
3. Merge results in `fetch_news/views.py` fetch logic
4. Add the key to `MARKETS_APIS.md` for reference

---

## 15. Known Issues & Limitations

### Critical

| Issue | Location | Impact | Workaround |
|-------|----------|--------|-----------|
| **FinBERT OOM on Render free tier** | `fetch_news/sentiment.py` | Cold start may hit 512 MB RAM limit | Upgrade Render instance; or lazy-load with `torch.no_grad()` and CPU offload |
| **Alpha Vantage 25 req/day limit** | `fetch_news/views.py` | News feed goes stale after 25 calls | Redis caching is critical; do not call the endpoint in a polling loop |
| **Celery not available on Render free tier** | `pipelines/tasks.py` | Background news ingestion and shock scoring disabled | Acceptable for demo; use REST polling fallback |
| **SQLite not suitable for production** | `config/settings.py` | SQLite does not support concurrent writes well | Set `DATABASE_URL` to use PostgreSQL on Render |

### Known Technical Issues

| Issue | Details |
|-------|---------|
| **Look-ahead bias in backtests** | If news timestamps are not carefully aligned with price bar timestamps, the backtest may inadvertently use future information. The `research_benchmark.py` attempts to handle this but review assumptions carefully for any published results. |
| **yfinance unofficial API** | yfinance scrapes Yahoo Finance and is not an official API. It can break without notice when Yahoo changes its endpoints. |
| **FinBERT tokenizer truncation** | FinBERT has a 512 token limit. Long news articles are silently truncated. Very long articles may lose critical sentiment information at the end. |
| **Agent pipeline LLM cost** | Running the full 12-step agent pipeline makes approximately 8–10 LLM API calls. On paid tiers this can be expensive at high polling frequency. |
| **WebSocket single server** | The `InMemoryChannelLayer` (used without Redis) does not support multi-process/multi-server deployments. WebSocket push only works correctly on a single Daphne process. |
| **Shock predictor Sensex data noise** | The yfinance data for `^BSESN` (Sensex) can be noisy or incomplete. The `backtest_shocks` command recommends running with `--indices nifty` only. |
| **Kite access token expiry** | Zerodha access tokens expire daily. Automated order execution requires a daily token refresh mechanism that is not currently implemented. |
| **No authentication on API endpoints** | All Django REST API endpoints are currently unauthenticated. Anyone with the backend URL can call any endpoint, including expensive agent/LLM ones. |
| **CORS allow all origins** | `CORS_ALLOW_ALL_ORIGINS=true` is the default in `settings.py`. This should be set to `false` in production with explicit `CORS_EXTRA_ORIGINS`. |
| **Shock score accuracy not validated** | The shock score is a heuristic combination of RSS NLP, PCR, IV, and VIX. No formal backtested accuracy metrics have been published for the live scoring model. |
| **Portfolio page incomplete** | The `/dashboard/portfolio` route exists but is listed as "in development." |

### Minor Issues

- `config/urls.py` has an explicit `fetch_news` import at the top and also includes `fetch_news.urls` — this creates a duplicate route for `/api/fetch-news/` which Django resolves by using the first match.
- `news_api.log` can grow very large (68 MB observed) in development with `DEBUG=True`. Add log rotation or set `DEBUG=False`.
- `db.sqlite3` in the backend directory is checked into `.gitignore` but the `.gitignore` should also exclude `*.log` files.

---

## 16. Roadmap & Potential Improvements

### High Priority

| Item | Effort | Description |
|------|--------|-------------|
| **JWT Authentication** | Medium | Add `djangorestframework-simplejwt` to protect all API endpoints from unauthorized access |
| **PostgreSQL in dev** | Low | Use Docker Compose Postgres locally for dev parity with production |
| **Rate limiting** | Low | Add per-IP rate limiting (`django-ratelimit`) on expensive endpoints: `/api/agents/run/`, `/api/quant/backtest/` |
| **FinBERT GPU acceleration** | Medium | Enable GPU inference if available; add model quantization for faster CPU inference |
| **Log rotation** | Low | Add `RotatingFileHandler` to the logging config to prevent `news_api.log` from growing unbounded |
| **Fix CORS in production** | Low | Set `CORS_ALLOW_ALL_ORIGINS=false` and rely solely on `CORS_EXTRA_ORIGINS` |

### Medium Priority

| Item | Effort | Description |
|------|--------|-------------|
| **Agent result caching** | Medium | Cache agent pipeline results for identical news inputs to reduce LLM costs |
| **Streaming LLM responses** | High | Stream LLM output back to the frontend via SSE or WebSocket for better UX on slow LLM calls |
| **Multi-worker WebSocket** | Medium | Replace `InMemoryChannelLayer` with `channels_redis` for horizontal scaling |
| **Kite access token refresh** | Medium | Automated daily Zerodha access token refresh (OAuth flow) |
| **Sentiment label storage** | Low | Store FinBERT label + confidence in `NewsArticle` model at ingestion time for faster chart data queries |
| **Backtesting with real commissions** | Medium | Integrate actual NSE/BSE brokerage fee schedules into `research_benchmark.py` |
| **Alternative news sources** | Low | Add Polygon.io, Benzinga, or Indian RSS feeds (Moneycontrol, Economic Times) |
| **Global market coverage** | Medium | Extend the scanner and agents to cover more international indices (FTSE, DAX, Hang Seng) |

### Architecture Improvements

| Item | Effort | Description |
|------|--------|-------------|
| **Switch to PostgreSQL for dev** | Low | Use `docker-compose.edge.yml` by default in local dev; eliminate SQLite dependency |
| **Microservice agents** | High | Convert each agent to an independent FastAPI microservice communicating via Redis pub/sub — enables independent scaling |
| **CI/CD pipeline** | Medium | Add GitHub Actions for: `pip install`, `pytest`, `eslint`, Render deploy on merge to `main` |
| **Error tracking** | Low | Integrate Sentry for both Django and Next.js |
| **Metrics & monitoring** | Medium | Prometheus + Grafana for API latency, Celery queue depth, and FinBERT inference time |
| **Secret management** | Medium | Move API keys from `.env` to AWS Secrets Manager or HashiCorp Vault |
| **Tests** | High | Add `pytest-django` unit tests for each agent and integration tests for API endpoints |
| **OpenAPI / Swagger docs** | Low | Add `drf-spectacular` to auto-generate Swagger/OpenAPI docs from DRF views |

### Feature Additions

| Feature | Description |
|---------|-------------|
| **Options strategy suggestions** | Extend the ShockAgent to suggest specific options strategies (e.g. straddle/strangle) when shock probability is high |
| **Multi-trade journal** | Persist paper trades from the intraday decision feature to a database; show win rate and P&L history |
| **Alert notifications** | Extend Telegram alerts to also send browser push notifications (via Web Push API) |
| **Backtesting comparison UI** | Side-by-side comparison of multiple strategies in the backtest page |
| **News article search** | Full-text search over stored `NewsArticle` records with filtering by sentiment and date |
| **Sector heatmap** | Add a sector heatmap view showing relative sentiment strength across sectors |
| **India-specific indicators** | RBI rate decisions, FII/DII flow data, India VIX as first-class inputs to the shock predictor |
| **FinBERT fine-tuning** | Fine-tune FinBERT on Indian financial news corpus for better accuracy on NSE/BSE-specific terminology |

---

## 17. Contributing

### Security

- **Never commit API keys or secrets.** Only `.env.example` files with placeholder values should be in the repository.
- All contributors must copy `.env.example` → `backend/.env` and fill in their own keys locally.
- Check `.gitignore` before committing: `backend/.env`, `frontend/.env.local`, `*.log`, `db.sqlite3`, `node_modules/`, `.next/` must all be excluded.

### Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes; run `python manage.py test` (backend) and `npm run lint` (frontend)
3. Run a quick smoke test: start both servers and verify `/api/health/` and `/dashboard` load correctly
4. Open a pull request to `main` with a clear description of changes and any environment variable additions

### Adding a New Backend Feature

1. Create a new Django app or add views to an existing one
2. Register the app in `INSTALLED_APPS` in `config/settings.py`
3. Add URL patterns in the app's `urls.py` and include in `config/urls.py`
4. Add any new environment variables to `.env.example` with placeholder values and document them in this file
5. If the feature requires a new model, create and run migrations: `python manage.py makemigrations && python manage.py migrate`

### Adding a New Frontend Page

1. Create a new directory under `frontend/app/dashboard/`
2. Add a `page.tsx` with a default export React component
3. Wire up API calls using `lib/apiClient.ts` and TanStack React Query hooks
4. Update navigation in the dashboard layout if applicable

---

*Built with Django · Next.js 15 · FinBERT · LangChain · Redis · Celery · backtrader · yfinance · Groq · Prisma · Tailwind CSS v4*
