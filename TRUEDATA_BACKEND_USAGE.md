# TrueData Backend Integration Guide

This project now supports **Alpha Vantage + TrueData** together for news workflows, while keeping TrueData implementation in a local confidential folder.

## What was added

- `/api/fetch-news/` now supports multi-provider aggregation:
  - Alpha Vantage (existing)
  - TrueData (new, optional)
  - Finnhub fallback (existing)
- New optional TrueData endpoints:
  - `/api/truedata/status/`
  - `/api/truedata/news/`
  - `/api/truedata/ltp-bulk/`
  - `/api/truedata/options-chain/`

## Confidentiality model

- Real TrueData integration code is in:
  - `backend/local_integrations/truedata/service.py`
- That folder is gitignored:
  - `backend/local_integrations/`
- Public backend imports it via a safe bridge:
  - `backend/fetch_news/truedata_bridge.py`

This means you can use TrueData locally without publishing provider-specific source details.

## Environment variables (backend/.env)

Add these variables:

```env
TRUEDATA_USERNAME=your_truedata_user
TRUEDATA_PASSWORD=your_truedata_password
TRUEDATA_AUTH_URL=https://auth.truedata.in/token
TRUEDATA_HISTORY_BASE_URL=https://history.truedata.in
TRUEDATA_CORPORATE_BASE_URL=https://corporate.truedata.in
TRUEDATA_ANALYTICS_BASE_URL=https://analytics.truedata.in
TRUEDATA_TIMEOUT_SECONDS=20
TRUEDATA_NEWS_LOOKBACK_DAYS=7

# WebSocket streaming (trial/live feed)
TRUEDATA_WS_LIVE_PORT=8086
# Optional; depends on account package
TRUEDATA_WS_HISTORICAL_PORT=8092
# Keep <= 50 symbols in trial
TRUEDATA_WS_SYMBOLS=NIFTY-I,RELIANCE,TCS,INFY
```

Existing providers keep working:

```env
ALPHA_VANTAGE_API_KEY=...
FINNHUB_API_KEY=...
```

## Website usage (frontend + backend)

1. Run backend:
   - `cd backend`
   - `python manage.py runserver`
2. Run frontend:
   - `cd frontend`
   - `npm run dev`
3. Open website:
   - `http://localhost:3000`

The normal News page continues using `/api/fetch-news/`.
Live ticker pages also receive WS updates from TrueData via `ws/dashboard/` (with polling fallback).

## Provider selection behavior

`/api/fetch-news/` defaults to:
- Alpha Vantage + TrueData (if configured), then dedupe and merge.
- If none available, fallback behavior remains stable.

You can force providers:

- Alpha only:
  - `/api/fetch-news/?providers=alpha_vantage`
- TrueData only:
  - `/api/fetch-news/?providers=truedata`
- Both:
  - `/api/fetch-news/?providers=alpha_vantage,truedata`

## New TrueData endpoints

- Status:
  - `GET /api/truedata/status/`
- TrueData news-like feed:
  - `GET /api/truedata/news/?limit=20`
  - Optional symbol: `GET /api/truedata/news/?symbol=RELIANCE`
- Bulk LTP:
  - `GET /api/truedata/ltp-bulk/?symbols=NIFTY-I,RELIANCE,TCS`
- Option chain:
  - `GET /api/truedata/options-chain/?symbol=NIFTY&expiry=230427`

### Full endpoint coverage for decision making

To support richer decision intelligence, backend now includes a catalog and generic caller for
the full set of TrueData endpoint groups from your API sheet:

- Historical REST APIs
- Analytics APIs
- Greeks APIs
- Symbol Master APIs
- Corporate/Fundamental APIs
- EOD quotes APIs

Use these routes:

- Endpoint catalog + availability (based on your local confidential integration implementation):
  - `GET /api/truedata/endpoints/`
- Generic endpoint invocation:
  - `GET /api/truedata/call/<api_name>/?symbol=NIFTY`
  - `POST /api/truedata/call/<api_name>/` with JSON body params
- Decision context fusion payload:
  - `GET /api/truedata/decision-context/?symbol=NIFTY&expiry=240627&include=all`
  - `include` supports `all`, `market`, `greeks`, `corporate`

Examples:

- `GET /api/truedata/call/getTopGainers/`
- `GET /api/truedata/call/getOIGainers/`
- `GET /api/truedata/call/getOptionChainwithGreeks/?symbol=NIFTY&expiry=240627`
- `GET /api/truedata/call/getCorporateInfo/?symbol=RELIANCE`

Notes:

- Actual availability depends on what is implemented in `backend/local_integrations/truedata/service.py`.
- Add-on endpoints in your provider plan may still return provider-side authorization errors.

## WebSocket streaming integration

- Backend consumer (`ws/dashboard/`) now auto-subscribes to a singleton TrueData WS stream.
- Stream payloads pushed to frontend contain:
  - `type: ticker_update`
  - `symbol`, `price`, `change`, `changePercent`, `timestamp`
- Frontend `useLiveTicker` consumes these updates and overlays them on existing polling data.
- If WS is unavailable, polling from `/api/live-ticker/` continues automatically.

## Trial end strategy (easy fallback)

When your 10-day trial ends, you can disable TrueData quickly:

1. Remove/blank `TRUEDATA_USERNAME` and `TRUEDATA_PASSWORD` in `backend/.env`.
2. Restart backend.

No other changes are needed. Existing Alpha Vantage/Finnhub/Zerodha flows remain active.
