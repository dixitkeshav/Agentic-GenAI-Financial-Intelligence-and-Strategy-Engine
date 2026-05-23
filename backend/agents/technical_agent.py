"""
Technical Context Agent: price trends, moving averages, and momentum from market data.
"""
import logging
from typing import Any

from .base import BaseAgent

logger = logging.getLogger(__name__)


def _normalize_ticker(ticker: str) -> str:
    t = (ticker or "").strip().upper()
    if not t:
        return ""
    if t in ("NIFTY", "NSEI", "^NSEI"):
        return "^NSEI"
    if t in ("SENSEX", "BSESN", "^BSESN"):
        return "^BSESN"
    if "." not in t and len(t) <= 12:
        return f"{t}.NS"
    return t


class TechnicalAgent(BaseAgent):
    """Integrates technical indicators (MA crossover, recent return, volatility)."""

    def __init__(self):
        super().__init__(name="Technical", role="Technical analysis: trends, MAs, momentum")

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        ticker = _normalize_ticker(context.get("ticker", ""))
        if not ticker:
            return {
                "summary": "No ticker provided — technical analysis skipped. Pass ?ticker=RELIANCE or RELIANCE.NS.",
                "indicators": {},
                "signal": "neutral",
            }

        try:
            import yfinance as yf

            hist = yf.Ticker(ticker).history(period="6mo")
            if hist is None or hist.empty or len(hist) < 20:
                return {
                    "summary": f"Insufficient price history for {ticker}.",
                    "indicators": {},
                    "signal": "neutral",
                }

            close = hist["Close"]
            sma20 = float(close.rolling(20).mean().iloc[-1])
            sma50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else sma20
            last = float(close.iloc[-1])
            ret_21d = float((close.iloc[-1] / close.iloc[-22] - 1) if len(close) >= 22 else 0)
            vol = float(close.pct_change().dropna().std() * (252 ** 0.5))

            if last > sma20 > sma50:
                signal = "bullish"
                trend = "Price above 20- and 50-day averages — uptrend structure."
            elif last < sma20 < sma50:
                signal = "bearish"
                trend = "Price below 20- and 50-day averages — downtrend structure."
            else:
                signal = "neutral"
                trend = "Mixed moving-average alignment — no clear trend."

            summary = (
                f"{ticker}: last {last:.2f}, 20d SMA {sma20:.2f}, 50d SMA {sma50:.2f}. "
                f"~1m return {ret_21d*100:.1f}%. {trend}"
            )
            indicators = {
                "last_close": round(last, 2),
                "sma_20": round(sma20, 2),
                "sma_50": round(sma50, 2),
                "return_21d_pct": round(ret_21d * 100, 2),
                "annualized_vol_pct": round(vol * 100, 2),
            }
            self._remember({"ticker": ticker, "signal": signal, **indicators})
            return {"summary": summary, "indicators": indicators, "signal": signal}
        except Exception as e:
            logger.warning("Technical agent failed for %s: %s", ticker, e)
            return {
                "summary": f"Technical data unavailable for {ticker}: {e}",
                "indicators": {},
                "signal": "neutral",
            }
