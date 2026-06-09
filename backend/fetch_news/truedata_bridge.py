"""
Thin bridge to optional local TrueData integration code.

The confidential implementation lives under:
    backend/local_integrations/truedata/

That directory is gitignored so proprietary provider-specific logic can be
kept local while the rest of the backend stays public-safe.
"""
from __future__ import annotations

import math
import os
from typing import Any

# Map UI / Yahoo symbols → TrueData F&O underlying names
OPTIONS_SYMBOL_ALIASES: dict[str, str] = {
    "NIFTY50": "NIFTY",
    "NIFTY 50": "NIFTY",
    "NIFTY-I": "NIFTY",
    "^NSEI": "NIFTY",
    "BANKNIFTY-I": "BANKNIFTY",
    "BANK NIFTY": "BANKNIFTY",
    "^NSEBANK": "BANKNIFTY",
    "^BSESN": "SENSEX",
    "SENSEX50": "SENSEX",
}


TRUEDATA_ENDPOINT_CATALOG: dict[str, list[str]] = {
    "historical_rest": [
        "getTickData",
        "getLastNTicks",
        "getBarData",
        "getAllBars",
        "getAllTickForSecond",
        "getTradedSymbols",
        "getBhavCopyStatus",
        "getLTP",
        "getLTPBulk",
        "getIndexComponents",
        "getTopGainers",
        "getTopLosers",
        "getTopVolumeGainers",
        "getSymbolNameChange",
        "getSymbolOptionChain",
    ],
    "analytics": [
        "getOptionChainLive",
        "getFuturesWithHighestOI",
        "getOptionsWithHighestOI",
        "getOIGainers",
        "getOIGainersPriceGainers",
        "getOIGainersPriceLosers",
        "getOILosersPriceGainers",
        "getOILosersPriceLosers",
        "getOILosers",
        "getIndexGainers",
        "getIndexLosers",
        "getMostActiveByVolume",
        "getMostActiveByTurnover",
        "getIndustryGainers",
        "getIndustryLosers",
    ],
    "greeks": [
        "getOptionChainwithGreeks",
        "getLTPwithGreeks",
        "getTickHistorywithGreeks",
    ],
    "symbol_master": [
        "getAllSymbols",
        "getoptionchain",
        "getIndexComponents",
        "getSymbolExpiryList",
        "getIndustryList",
        "getIndices",
        "getETFlist",
        "getunderlyinglist",
    ],
    "corporate_announcements": [
        "getDescriptors",
        "getAnnualReportFile",
        "getAnnouncementFile",
        "getAnnoucementsForCompanies",
        "getQuarterlyReports",
        "getAnnouncementById",
        "getAISummary",
    ],
    "results": [
        "getAllResultByCompany",
        "getResultListByDate",
        "getAllResultItemsById",
        "getResultALById",
        "getQuarterlyReports",
        "getPnLById",
        "getBalSheetById",
        "getCashFlowSummaryById",
        "getCashFlowDetailById",
    ],
    "shareholding_patterns": [
        "getSHPListByCompany",
        "getSHPListByDate",
        "getSHPAllItems",
        "getSHPMemberTypes",
        "getSHPSummary",
        "getSHPDetailById",
    ],
    "other_financial": [
        "getFIIDIIData",
        "getCorporateInfo",
        "getCorpAction",
        "getCorpActionRange",
    ],
    "additional": [
        "getSymbolClassification",
        "getPeerCompanies",
        "getMarketCap",
        "getCompanyLogo",
    ],
    "eod_quotes": [
        "getBhavCopy",
        "get52WeekHL",
    ],
}


def _all_catalog_endpoints() -> list[str]:
    out: list[str] = []
    seen = set()
    for names in TRUEDATA_ENDPOINT_CATALOG.values():
        for name in names:
            if name not in seen:
                seen.add(name)
                out.append(name)
    return out


def _service():
    try:
        from local_integrations.truedata.service import TrueDataService  # type: ignore

        return TrueDataService
    except Exception:
        return None


def is_enabled() -> bool:
    """True only when TRUEDATA_ENABLED=true and local integration is configured."""
    if os.getenv("TRUEDATA_ENABLED", "false").lower() not in ("1", "true", "yes"):
        return False
    return is_configured()


def is_configured() -> bool:
    svc = _service()
    if svc is None:
        return False
    try:
        return bool(svc.is_configured())
    except Exception:
        return False


def is_available() -> bool:
    """Backward-compatible alias — respects TRUEDATA_ENABLED."""
    return is_enabled()


def endpoint_catalog() -> dict[str, list[str]]:
    return {k: list(v) for k, v in TRUEDATA_ENDPOINT_CATALOG.items()}


def discover_available_endpoints() -> dict[str, bool]:
    svc = _service()
    if svc is None:
        return {name: False for name in _all_catalog_endpoints()}
    out: dict[str, bool] = {}
    for name in _all_catalog_endpoints():
        out[name] = callable(getattr(svc, name, None))
    return out


def call_api(api_name: str, **params: Any) -> Any:
    """
    Generic bridge for TrueData REST-like methods listed in the endpoint catalog.
    Returns {"error": "..."} if method is unavailable or invocation fails.
    """
    method = (api_name or "").strip()
    if not method:
        return {"error": "api_name required"}
    svc = _service()
    if svc is None:
        return {"error": "TrueData integration unavailable", "api": method}
    fn = getattr(svc, method, None)
    if not callable(fn):
        return {"error": f"Unsupported API '{method}' in local TrueData service", "api": method}
    try:
        return fn(**params)
    except TypeError:
        # Some local wrappers might only accept positional patterns.
        try:
            if "symbol" in params and len(params) == 1:
                return fn(params["symbol"])
        except Exception:
            pass
        return {"error": f"Invalid parameters for '{method}'", "api": method, "params": params}
    except Exception as exc:
        return {"error": str(exc), "api": method}


def fetch_news(
    limit: int = 20,
    symbol: str | None = None,
    *,
    include_corporate: bool = False,
) -> list[dict[str, Any]]:
    svc = _service()
    if svc is None:
        return []
    try:
        # Prefer richer news feeds (e.g. ET/business wires) over raw corporate notices.
        return list(
            svc.fetch_news(
                limit=limit,
                symbol=symbol,
                include_corporate=include_corporate,
            )
            or []
        )
    except TypeError:
        # Backward-compatible local service signature.
        try:
            return list(svc.fetch_news(limit=limit, symbol=symbol) or [])
        except Exception:
            return []
    except Exception:
        return []


def aggregate_symbol_sentiment(symbol: str) -> dict[str, Any]:
    svc = _service()
    if svc is None:
        return {"sentiment": "neutral", "count": 0, "positive": 0, "negative": 0, "neutral": 0}
    try:
        return dict(svc.aggregate_symbol_sentiment(symbol) or {})
    except Exception:
        return {"sentiment": "neutral", "count": 0, "positive": 0, "negative": 0, "neutral": 0}


def get_ltp_bulk(symbols: list[str]) -> list[dict[str, Any]]:
    svc = _service()
    if svc is None:
        return []
    try:
        return list(svc.get_ltp_bulk(symbols) or [])
    except Exception:
        return []


def normalize_options_symbol(symbol: str) -> str:
    s = (symbol or "").strip().upper().replace(".NS", "").replace(".BO", "")
    return OPTIONS_SYMBOL_ALIASES.get(s, s)


def _safe_chain_num(val: Any) -> float | None:
    if val is None or val == "":
        return None
    try:
        v = float(val)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def normalize_truedata_chain_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert TrueData CSV option-chain rows to the UI/backtest strike schema."""
    out: list[dict[str, Any]] = []
    for row in rows:
        strike = _safe_chain_num(row.get("strike") or row.get("Strike"))
        if strike is None:
            continue
        out.append(
            {
                "strike": strike,
                "call": {
                    "bid": _safe_chain_num(row.get("callbid") or row.get("callBid")),
                    "ask": _safe_chain_num(row.get("callask") or row.get("callAsk")),
                    "lastPrice": _safe_chain_num(row.get("callltp") or row.get("callLTP")),
                    "impliedVolatility": _safe_chain_num(row.get("calliv") or row.get("callIV")),
                    "openInterest": _safe_chain_num(row.get("callOI") or row.get("calloi")),
                    "volume": _safe_chain_num(row.get("callVol") or row.get("callvol")),
                },
                "put": {
                    "bid": _safe_chain_num(row.get("putbid") or row.get("putBid")),
                    "ask": _safe_chain_num(row.get("putask") or row.get("putAsk")),
                    "lastPrice": _safe_chain_num(row.get("putLTP") or row.get("putltp")),
                    "impliedVolatility": _safe_chain_num(row.get("putiv") or row.get("putIV")),
                    "openInterest": _safe_chain_num(row.get("putOI") or row.get("putoi")),
                    "volume": _safe_chain_num(row.get("putVol") or row.get("putvol")),
                },
            }
        )
    out.sort(key=lambda r: r["strike"])
    return out


def atm_strike_from_chain(chain_rows: list[dict[str, Any]], spot: float, symbol: str) -> float:
    strikes = [float(r["strike"]) for r in chain_rows if r.get("strike") is not None]
    if strikes and spot > 0:
        return float(min(strikes, key=lambda k: abs(k - spot)))
    step = 50.0 if "NIFTY" in symbol.upper() or "SENSEX" in symbol.upper() else 10.0
    if spot > 0:
        return round(spot / step) * step
    return strikes[len(strikes) // 2] if strikes else step


def get_symbol_option_chain(symbol: str, expiry: str | None = None) -> dict[str, Any]:
    """
    TrueData option chain (indices + equities). Calls local TrueDataService directly
    so classmethods work reliably; normalizes rows for the options UI and backtester.
    """
    sym = normalize_options_symbol(symbol)
    svc = _service()
    if svc is None:
        return {
            "symbol": sym,
            "symbol_requested": symbol,
            "expiry": expiry,
            "expiries": [],
            "data": [],
            "source": "truedata",
            "error": "TrueData integration unavailable",
        }
    try:
        raw = svc.get_symbol_option_chain(sym, expiry=expiry)
    except Exception as exc:
        return {
            "symbol": sym,
            "symbol_requested": symbol,
            "expiry": expiry,
            "expiries": [],
            "data": [],
            "source": "truedata",
            "error": str(exc),
        }
    if not isinstance(raw, dict):
        raw = {"data": list(raw) if isinstance(raw, list) else []}
    raw_rows = raw.get("data") or raw.get("rows") or []
    expiries = raw.get("expiries") or []
    if not expiries and hasattr(svc, "get_symbol_expiry_list"):
        try:
            expiries = list(svc.get_symbol_expiry_list(sym) or [])
        except Exception:
            expiries = []
    norm = normalize_truedata_chain_rows(raw_rows) if raw_rows else []
    err = raw.get("error")
    if norm:
        err = None
    return {
        "symbol": raw.get("symbol") or sym,
        "symbol_requested": raw.get("symbol_requested") or symbol,
        "expiry": raw.get("expiry") or expiry,
        "expiries": expiries[:20],
        "data": norm,
        "raw_row_count": len(raw_rows),
        "source": "truedata",
        "error": err,
    }


def check_options_chain(symbol: str, expiry: str | None = None) -> dict[str, Any]:
    """
    Availability probe for backtest/options UI. TrueData is always tried first when configured.
    """
    sym = normalize_options_symbol(symbol)
    if not is_available():
        return {"available": False, "source": None, "symbol_checked": sym, "proxy": False}

    payload = get_symbol_option_chain(symbol, expiry=expiry)
    data = payload.get("data") or []
    expiries = payload.get("expiries") or []
    base: dict[str, Any] = {
        "symbol_checked": sym,
        "symbol_requested": symbol,
        "source": "truedata",
        "nearest_expiry": payload.get("expiry"),
        "expiries_count": len(expiries),
        "chain_rows": len(data),
        "chain": payload,
        "symbols_tried": [sym],
    }
    if data:
        return {
            **base,
            "available": True,
            "proxy": False,
            "note": f"Live option chain from TrueData ({len(data)} strikes).",
        }
    if expiries:
        return {
            **base,
            "available": True,
            "proxy": True,
            "note": (
                "TrueData returned expiries but no chain rows for the selected expiry "
                "(subscription/symbol). Backtest uses underlying proxy for options P&L."
            ),
        }
    return {
        **base,
        "available": False,
        "proxy": False,
        "error": payload.get("error") or "TrueData option chain unavailable",
    }


def get_price_history(symbol: str, days: int = 365) -> list[dict[str, Any]]:
    """
    Best-effort TrueData history adapter.
    Supports multiple local service method names/shapes to stay backward compatible.
    """
    svc = _service()
    if svc is None:
        return []
    # Try common method names in descending preference.
    candidates = [
        ("get_price_history", {"symbol": symbol, "days": days}),
        ("get_historical_prices", {"symbol": symbol, "days": days}),
        ("get_history", {"symbol": symbol, "days": days}),
        ("history", {"symbol": symbol, "days": days}),
    ]
    for method_name, kwargs in candidates:
        try:
            fn = getattr(svc, method_name, None)
            if not fn:
                continue
            rows = fn(**kwargs)
            if rows:
                return list(rows)
        except TypeError:
            # Try minimal signature variants.
            try:
                fn = getattr(svc, method_name, None)
                if not fn:
                    continue
                rows = fn(symbol)
                if rows:
                    return list(rows)
            except Exception:
                continue
        except Exception:
            continue
    return []


def ws_subscribe() -> tuple[bool, str]:
    try:
        from local_integrations.truedata.ws_stream import TrueDataWsStreamer  # type: ignore

        return TrueDataWsStreamer.subscribe()
    except Exception:
        return False, "streamer_unavailable"


def ws_unsubscribe() -> None:
    try:
        from local_integrations.truedata.ws_stream import TrueDataWsStreamer  # type: ignore

        TrueDataWsStreamer.unsubscribe()
    except Exception:
        return
