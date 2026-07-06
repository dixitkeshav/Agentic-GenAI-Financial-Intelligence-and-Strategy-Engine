# FintelliAI — Agentic GenAI Financial Intelligence Platform

> Real-time financial news → FinBERT sentiment → multi-agent LLM reasoning → quant signals → backtested strategies → live dashboard.

🔗 **Live Demo:** [https://fintelli-ai-one.vercel.app/](https://fintelli-ai-one.vercel.app/)

---

## What is this?

FintelliAI is a full-stack AI platform that automates financial analysis. It ingests live market news, runs it through a domain-specific NLP model (FinBERT), passes it through a pipeline of specialized AI agents powered by an LLM, converts the output into quantitative trading signals, and surfaces everything on a real-time Next.js dashboard.

Think of it as a **Bloomberg terminal meets an AI research analyst** — instead of just reading headlines, the platform *reasons* about them.

---

## Why we built it

Manual news monitoring is slow, subjective, and impossible to scale. Traders miss critical signals buried in thousands of daily articles. This platform:

- **Automates** the entire ingestion → sentiment → reasoning → signal pipeline
- **Fuses** narrative sentiment with price context and quant evaluation
- **Validates** signals through backtesting before trusting them
- **Delivers** everything in real-time to a single dashboard

---

## Architecture

```
Live News APIs
(Alpha Vantage, Finnhub, NewsAPI)
        │
        ▼
 News Ingestion (Django + Celery)
        │
        ▼
 FinBERT Sentiment  ──────────────────────────────┐
 (Positive / Negative / Neutral + confidence)      │
        │                                          │
        ▼                                          ▼
 Multi-Agent Pipeline (LangChain + Groq)      Quant Layer
 ┌─────────────────────────────────┐           (signals, backtest,
 │ News Scout → Macro Context      │            Sharpe, IC)
 │ → Technical → Market Reaction   │
 │ → Risk → Bull/Bear Debate       │
 │ → Shock Predictor → Decision    │
 └─────────────────────────────────┘
        │
        ▼
 Next.js Dashboard  ◄── WebSocket (real-time push)
 (News, Agents, Markets, Options, Backtest, Shock Alert)
```

---

## Features

| Feature | Description |
|---------|-------------|
| **FinBERT Sentiment** | Domain-specific NLP model trained on financial text — far more accurate than VADER or generic BERT on market news |
| **12-Step Agent Pipeline** | News Scout → Macro → Technical → Market Reaction → Risk → Bull Research → Bear Research → Risk Committee → Debate → Shock → Decision |
| **GenAI Insights** | LLM explains *why* a sentiment label was given, extracts risk drivers, event types, and per-aspect sentiment (earnings, macro, guidance, sector) |
| **Symbol Deep-Dive** | Single-stock analysis: price history, sector peer comparison, and LLM-generated prediction |
| **Quant Signals** | Sentiment momentum, MA crossover, and mean reversion signals from historical sentiment series |
| **Backtesting** | Price-only vs sentiment-augmented strategies — compare Sharpe ratio, Information Coefficient, total return |
| **Market Shock Predictor** | Real-time Nifty/BankNifty shock probability using RSS news NLP, PCR, IV change, and VIX. Fires Telegram alerts when score ≥ 70 |
| **Intraday Trade Decision** | Generates BUY/SELL/NO_TRADE with entry, stop-loss, target, and risk-reward. Tracks paper trade on the chart |
| **Options Chain** | Live calls + puts via yfinance (Finnhub fallback) |
| **Market Scanner** | Multi-ticker screener combining price momentum + sentiment → BULLISH/BEARISH/NEUTRAL |
| **Cross-Domain Analysis** | Crypto, commodities, FX, and geopolitical news with LLM reasoning chains |
| **Real-time WebSockets** | Django Channels + Daphne ASGI push live updates to the dashboard |
| **Feature Flags** | Toggle GenAI, agents, quant, and WebSockets independently via environment variables |

---

## Tech Stack

**Backend:** Python · Django · Django REST Framework · Django Channels · Daphne · Celery · Redis · SQLite (dev) / PostgreSQL (prod)

**AI/ML:** FinBERT (HuggingFace Transformers + PyTorch) · LangChain · Groq (Llama 3.3 70B) · OpenAI (fallback)

**Quant:** backtrader · yfinance · pandas · numpy · scipy

**Frontend:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Zustand · TanStack React Query · Recharts · Framer Motion · Prisma

---

## How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- Redis (optional — falls back to in-memory if absent)

### 1. Clone & install Python dependencies
```bash
git clone https://github.com/dixitkeshav/Agentic-GenAI-Financial-Intelligence-and-Strategy-Engine.git
cd Financial-News-Sentiment-Analysis
pip install -r requirements.txt
```

### 2. Set up environment variables
```bash
cp .env.example backend/.env
```

Edit `backend/.env` with your keys:
```env
ALPHA_VANTAGE_API_KEY=your_key      # required — news + ticker search
FINNHUB_API_KEY=your_key            # required — live quotes + options
GROQ_API_KEY=your_key               # optional — enables all AI agent features
DJANGO_SECRET_KEY=any-random-string
```

### 3. Start the backend
```bash
cd backend
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
# or without WebSocket: python manage.py runserver
```

### 4. Start the frontend
```bash
cd frontend
cp .env.local.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open **http://localhost:3000**

### 5. Optional — Redis + Celery (for real-time shock scoring and background tasks)
```bash
brew install redis && redis-server
cd backend
celery -A config worker -l info
celery -A config beat -l info
```

---

## Project Structure

```
Financial-News-Sentiment-Analysis/
├── backend/
│   ├── agents/          # 12-step multi-agent orchestration pipeline
│   ├── fetch_news/      # News ingestion, FinBERT sentiment, WebSocket consumer
│   ├── intelligence/    # LLM layer (LangChain + Groq/OpenAI)
│   ├── quant/           # Signals, backtesting, strategy engine
│   ├── shock_predictor/ # Market shock detection + Telegram alerts
│   ├── evaluation/      # Accuracy + latency benchmarks
│   ├── cross_domain/    # Crypto, FX, commodities, geopolitical analysis
│   ├── pipelines/       # Celery async task definitions
│   └── config/          # Django settings, URLs, ASGI, Celery config
│
├── frontend/
│   ├── app/dashboard/   # All dashboard pages (news, agents, markets, shock, etc.)
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # API client + WebSocket client
│   ├── store/           # Zustand state stores
│   └── prisma/          # Edge PostgreSQL schema (candles, signals, backtests)
│
├── docs/                # Integration guide, API reference, shock predictor setup
├── DOCUMENTATION.md     # Full technical documentation
├── DEPLOY.md            # Vercel + Render deployment guide
└── .env.example         # Environment variable template
```

---

## Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/fetch-news/` | Live financial news (Redis-cached) |
| `POST /api/analyze-sentiment/` | FinBERT sentiment on custom text |
| `GET /api/agents/run/` | Run full 12-step agent pipeline |
| `GET /api/agents/symbol-deep-dive/?symbol=AAPL` | Single-stock deep-dive |
| `GET /api/scanner/` | Multi-ticker momentum + sentiment screener |
| `POST /api/quant/backtest/` | Run backtest (Sharpe, IC, total return) |
| `GET /api/shock/score/` | Live shock probability score |
| `GET /api/trade/decision/?symbol=^NSEI` | Intraday trade decision |
| `ws/dashboard/` | WebSocket — real-time dashboard push |
| `ws/shock/` | WebSocket — live shock score stream |

Full API reference in [`DOCUMENTATION.md`](./DOCUMENTATION.md)

---

## Deployment

Deployed on **Vercel (frontend) + Render (backend + PostgreSQL)** — both free tier.

See [`DEPLOY.md`](./DEPLOY.md) for the step-by-step guide.

---

*Built with Django · Next.js 15 · FinBERT · LangChain · Groq · Redis · Celery · backtrader · yfinance*
