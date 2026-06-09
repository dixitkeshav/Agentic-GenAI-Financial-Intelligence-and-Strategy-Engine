"""
Ticker universe for shock monitoring — TrueData index components when available, else curated lists.
"""
from __future__ import annotations

import logging
from typing import Any

from fetch_news import truedata_bridge as td

logger = logging.getLogger(__name__)

# Curated NSE large / mid / small (representative liquid names)
LARGE_CAP = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN",
    "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK", "ASIANPAINT", "MARUTI", "SUNPHARMA",
]
MID_CAP = [
    "PIDILITIND", "DIXON", "POLYCAB", "PERSISTENT", "COFORGE", "MPHASIS", "AUROPHARMA",
    "GODREJCP", "INDHOTEL", "BANKBARODA", "CANBK", "NHPC", "IRCTC", "BEL",
]
SMALL_CAP = [
    "IRCON", "RVNL", "HFCL", "SUZLON", "YESBANK", "IDEA", "PNB", "NMDC", "SAIL", "BHEL",
]

INDICES = [
    {"symbol": "NIFTY", "yf": "^NSEI", "type": "index"},
    {"symbol": "BANKNIFTY", "yf": "^NSEBANK", "type": "index"},
    {"symbol": "SENSEX", "yf": "^BSESN", "type": "index"},
]


def _from_truedata_index(index: str = "NIFTY") -> list[str]:
    if not td.is_available():
        return []
    try:
        rows = td.call_api("getIndexComponents", symbol=index)
        if isinstance(rows, list):
            out = []
            for r in rows:
                if isinstance(r, dict):
                    sym = r.get("symbol") or r.get("Symbol") or r.get("name")
                    if sym:
                        out.append(str(sym).upper().replace(".NS", ""))
            return out[:100]
        if isinstance(rows, dict):
            data = rows.get("data") or rows.get("Records") or []
            if isinstance(data, list):
                return [
                    str((x.get("symbol") or x.get("Symbol") or "")).upper().replace(".NS", "")
                    for x in data
                    if isinstance(x, dict) and (x.get("symbol") or x.get("Symbol"))
                ][:100]
    except Exception as exc:
        logger.debug("TrueData index components: %s", exc)
    return []


def get_universe(group: str = "all") -> dict[str, Any]:
    td_nifty = _from_truedata_index("NIFTY")
    large = td_nifty if td_nifty else LARGE_CAP
    g = (group or "all").lower()
    payload = {
        "indices": INDICES,
        "large_cap": large,
        "mid_cap": MID_CAP,
        "small_cap": SMALL_CAP,
        "source": "truedata" if td_nifty else "curated",
    }
    if g == "large_cap":
        payload["symbols"] = large
    elif g == "mid_cap":
        payload["symbols"] = MID_CAP
    elif g == "small_cap":
        payload["symbols"] = SMALL_CAP
    elif g == "indices":
        payload["symbols"] = [x["symbol"] for x in INDICES]
    else:
        payload["symbols"] = list(dict.fromkeys(large + MID_CAP + SMALL_CAP))
    payload["count"] = len(payload["symbols"])
    return payload
