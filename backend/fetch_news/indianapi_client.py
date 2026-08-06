"""
Indian Stock Market API client (stock.indianapi.in).
Backup/secondary source for Indian equities — quotes, historical OHLC, and
trending/most-active screens. Complements yfinance/Finnhub, which are the
primary sources for market_history / live_ticker.

Uses INDIAN_API_KEY from environment.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

BASE = "https://stock.indianapi.in"


def _api_key() -> str:
    return (os.getenv("INDIAN_API_KEY") or "").strip()


def is_configured() -> bool:
    return bool(_api_key())


def _get(path: str, params: Optional[dict[str, Any]] = None) -> Optional[Any]:
    key = _api_key()
    if not key:
        return None
    try:
        r = requests.get(
            f"{BASE}{path}",
            params=params or {},
            headers={"X-Api-Key": key},
            timeout=20,
        )
        if r.status_code != 200:
            logger.warning("IndianAPI %s %s: %s", path, r.status_code, r.text[:200])
            return None
        return r.json()
    except Exception as e:
        logger.warning("IndianAPI request failed %s: %s", path, e)
        return None


def _clean_symbol(symbol: str) -> str:
    """Strip Yahoo-style suffixes/prefixes: RELIANCE.NS / NSE:RELIANCE -> RELIANCE"""
    s = (symbol or "").strip().upper()
    if ":" in s:
        s = s.split(":")[-1]
    if s.endswith(".NS") or s.endswith(".BO"):
        s = s[:-3]
    return s.replace("^NSEI", "NIFTY").replace("^BSESN", "SENSEX")


def get_stock(name: str) -> Optional[dict[str, Any]]:
    """GET /stock?name=... — full company snapshot (price, technicals, financials, news)."""
    return _get("/stock", {"name": _clean_symbol(name)})


def quote(symbol: str) -> Optional[dict[str, Any]]:
    """Return a Finnhub-quote-shaped dict {c, dp} derived from /stock, for use as a live_ticker fallback."""
    data = get_stock(symbol)
    if not data:
        return None
    price = data.get("currentPrice") or {}
    last = price.get("NSE") or price.get("BSE")
    if last is None:
        return None
    pct = data.get("percentChange")
    return {"c": float(last), "dp": float(pct) if pct is not None else 0.0}


_PERIOD_MAP = {
    "1d": "1m", "5d": "1m", "1mo": "1m", "3mo": "6m",
    "6mo": "6m", "1y": "1yr", "2y": "3yr",
}


def historical_data(symbol: str, period: str = "1mo") -> tuple[list[dict[str, Any]], Optional[str]]:
    """GET /historical_data — normalized to the same OHLC row shape used by yfinance/Finnhub paths."""
    stock_name = _clean_symbol(symbol)
    mapped_period = _PERIOD_MAP.get(period, "1yr")
    data = _get("/historical_data", {"stock_name": stock_name, "period": mapped_period, "filter": "price"})
    if not data:
        return [], "no data"
    datasets = data.get("datasets") or []
    price_series = next((d for d in datasets if d.get("metric") == "Price"), None)
    if not price_series or not price_series.get("values"):
        return [], "no price series"
    rows: list[dict[str, Any]] = []
    for point in price_series["values"]:
        try:
            date_str, close = point[0], float(point[1])
        except (IndexError, TypeError, ValueError):
            continue
        try:
            import pandas as pd
            ms = int(pd.Timestamp(date_str).timestamp() * 1000)
        except Exception:
            continue
        rows.append(
            {
                "timestamp": ms,
                "open": close,
                "high": close,
                "low": close,
                "close": close,
                "volume": 0,
            }
        )
    if not rows:
        return [], "unparseable series"
    return rows, None


def trending() -> Optional[dict[str, Any]]:
    """GET /trending — top gainers/losers."""
    return _get("/trending")


def most_active(exchange: str = "NSE") -> list[dict[str, Any]]:
    """GET /NSE_most_active or /BSE_most_active."""
    path = "/NSE_most_active" if exchange.upper() == "NSE" else "/BSE_most_active"
    data = _get(path)
    return data if isinstance(data, list) else []
