from __future__ import annotations

import json
import math

from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import truedata_bridge as td


@api_view(["GET"])
def truedata_status(request):
    return Response(
        {
            "provider": "truedata",
            "available": td.is_available(),
            "note": "Set TRUEDATA_* credentials in backend/.env and local integration files.",
        }
    )


@api_view(["GET"])
def truedata_news(request):
    limit = request.GET.get("limit", "20")
    symbol = (request.GET.get("symbol") or "").strip().upper() or None
    try:
        n = max(1, min(int(limit), 100))
    except Exception:
        n = 20
    articles = td.fetch_news(limit=n, symbol=symbol)
    return Response({"articles": articles, "source": "truedata", "count": len(articles)})


@api_view(["GET"])
def truedata_ltp_bulk(request):
    symbols_csv = (request.GET.get("symbols") or "").strip()
    if not symbols_csv:
        symbols = ["NIFTY-I", "RELIANCE", "TCS", "INFY"]
    else:
        symbols = [s.strip().upper() for s in symbols_csv.split(",") if s.strip()]
    rows = td.get_ltp_bulk(symbols)
    return Response({"symbols": symbols, "data": rows, "source": "truedata"})


@api_view(["GET"])
def truedata_option_chain(request):
    symbol = (request.GET.get("symbol") or "NIFTY").strip().upper()
    expiry = (request.GET.get("expiry") or "").strip() or None
    payload = td.get_symbol_option_chain(symbol=symbol, expiry=expiry)
    payload.setdefault("source", "truedata")
    return Response(payload)


def _coerce_value(raw):
    if raw is None:
        return None
    if isinstance(raw, (dict, list, bool, int, float)):
        return raw
    text = str(raw).strip()
    if not text:
        return ""
    low = text.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("null", "none"):
        return None
    if "," in text:
        parts = [p.strip() for p in text.split(",") if p.strip()]
        if len(parts) > 1:
            return [_coerce_value(p) for p in parts]
    if text.startswith("{") or text.startswith("["):
        try:
            return json.loads(text)
        except Exception:
            pass
    try:
        if "." in text:
            v = float(text)
            if math.isfinite(v):
                return v
            return text
        return int(text)
    except Exception:
        return text


def _request_params(request):
    params = {k: _coerce_value(v) for k, v in request.GET.items()}
    if request.method == "POST" and isinstance(request.data, dict):
        for k, v in request.data.items():
            params[k] = _coerce_value(v)
    params.pop("api", None)
    return params


@api_view(["GET"])
def truedata_endpoints(request):
    availability = td.discover_available_endpoints()
    grouped = []
    for category, apis in td.endpoint_catalog().items():
        grouped.append(
            {
                "category": category,
                "apis": [{"name": name, "available": bool(availability.get(name, False))} for name in apis],
            }
        )
    return Response(
        {
            "provider": "truedata",
            "available": td.is_available(),
            "categories": grouped,
            "total_known_endpoints": len(availability),
            "available_endpoint_count": sum(1 for v in availability.values() if v),
        }
    )


@api_view(["GET", "POST"])
def truedata_call(request, api_name: str):
    params = _request_params(request)
    out = td.call_api(api_name, **params)
    if isinstance(out, dict):
        payload = dict(out)
    elif isinstance(out, list):
        payload = {"data": out}
    else:
        payload = {"data": out}
    payload.setdefault("api", api_name)
    payload.setdefault("source", "truedata")
    if payload.get("error"):
        payload.setdefault("params", params)
    return Response(payload)


def _extract_rows(obj):
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        for key in ("data", "rows", "items", "result", "results"):
            value = obj.get(key)
            if isinstance(value, list):
                return value
        return []
    return []


@api_view(["GET"])
def truedata_decision_context(request):
    """
    Builds a compact decision payload by fusing market, derivatives, and corporate endpoints.
    Each section is best-effort: unavailable APIs are skipped and recorded.
    """
    symbol = (request.GET.get("symbol") or "NIFTY").strip().upper()
    expiry = (request.GET.get("expiry") or "").strip() or None
    include = (request.GET.get("include") or "all").strip().lower()
    want_corporate = include in ("all", "corporate")
    want_market = include in ("all", "market")
    want_greeks = include in ("all", "greeks")

    unavailable = []
    context: dict[str, object] = {
        "symbol": symbol,
        "expiry": expiry,
        "source": "truedata",
    }

    if want_market:
        ltp = td.call_api("getLTP", symbol=symbol)
        if isinstance(ltp, dict) and ltp.get("error"):
            unavailable.append("getLTP")
        context["ltp"] = ltp

        option_chain = td.call_api("getOptionChainLive", symbol=symbol, expiry=expiry)
        if isinstance(option_chain, dict) and option_chain.get("error"):
            option_chain = td.call_api("getSymbolOptionChain", symbol=symbol, expiry=expiry)
        if isinstance(option_chain, dict) and option_chain.get("error"):
            unavailable.append("getOptionChainLive/getSymbolOptionChain")
        context["option_chain_live"] = option_chain

        oi_gainers = td.call_api("getOIGainers", symbol=symbol)
        if isinstance(oi_gainers, dict) and oi_gainers.get("error"):
            unavailable.append("getOIGainers")
        context["oi_gainers"] = oi_gainers

        oi_losers = td.call_api("getOILosers", symbol=symbol)
        if isinstance(oi_losers, dict) and oi_losers.get("error"):
            unavailable.append("getOILosers")
        context["oi_losers"] = oi_losers

    if want_greeks:
        greeks = td.call_api("getOptionChainwithGreeks", symbol=symbol, expiry=expiry)
        if isinstance(greeks, dict) and greeks.get("error"):
            unavailable.append("getOptionChainwithGreeks")
        context["option_chain_greeks"] = greeks

    if want_corporate:
        corp_info = td.call_api("getCorporateInfo", symbol=symbol)
        if isinstance(corp_info, dict) and corp_info.get("error"):
            unavailable.append("getCorporateInfo")
        context["corporate_info"] = corp_info

        corp_actions = td.call_api("getCorpAction", symbol=symbol)
        if isinstance(corp_actions, dict) and corp_actions.get("error"):
            unavailable.append("getCorpAction")
        context["corporate_actions"] = corp_actions

        market_cap = td.call_api("getMarketCap", symbol=symbol)
        if isinstance(market_cap, dict) and market_cap.get("error"):
            unavailable.append("getMarketCap")
        context["market_cap"] = market_cap

    oi_gain_rows = _extract_rows(context.get("oi_gainers"))
    oi_loss_rows = _extract_rows(context.get("oi_losers"))
    chain_rows = _extract_rows(context.get("option_chain_live"))
    greeks_rows = _extract_rows(context.get("option_chain_greeks"))
    corporate_action_rows = _extract_rows(context.get("corporate_actions"))

    context["decision_factors"] = {
        "oi_gainers_count": len(oi_gain_rows),
        "oi_losers_count": len(oi_loss_rows),
        "chain_depth": len(chain_rows),
        "greeks_depth": len(greeks_rows),
        "corporate_actions_count": len(corporate_action_rows),
    }
    context["unavailable_apis"] = sorted(set(unavailable))
    return Response(context)
