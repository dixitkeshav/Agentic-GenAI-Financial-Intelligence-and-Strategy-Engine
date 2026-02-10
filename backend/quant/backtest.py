"""
Simple backtester: compare price-only vs price + sentiment strategy.
Uses pandas and optional yfinance for price data.
"""
import logging
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _fetch_prices(ticker: str, days: int = 252) -> Optional[pd.Series]:
    """Fetch daily close prices. Requires yfinance."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        hist = t.history(period="1y") if days >= 252 else t.history(period=f"{max(days, 30)}d")
        if hist is None or hist.empty:
            return None
        return hist["Close"]
    except Exception as e:
        logger.warning("yfinance fetch failed: %s", e)
        return None


def _simulate_returns(prices: pd.Series, signals: pd.Series) -> pd.Series:
    """Strategy returns: when signal > 0 long, when signal < 0 short (as -1 * return)."""
    ret = prices.pct_change().dropna()
    common = ret.index.intersection(signals.index)
    if common.empty:
        return pd.Series(dtype=float)
    ret = ret.reindex(common).ffill().fillna(0)
    sig = signals.reindex(common).ffill().fillna(0)
    strategy_ret = ret * np.sign(sig)
    return strategy_ret


def sharpe_ratio(returns: pd.Series, risk_free: float = 0.0, annualize: bool = True) -> float:
    """Annualized Sharpe (assuming daily returns if annualize=True)."""
    if returns is None or len(returns) < 2:
        return 0.0
    excess = returns - risk_free / 252 if annualize else returns
    std = excess.std()
    if std == 0:
        return 0.0
    ann = np.sqrt(252) if annualize else 1
    return float(excess.mean() / std * ann)


def information_coefficient(signal: pd.Series, forward_returns: pd.Series) -> float:
    """IC = correlation(signal, forward return)."""
    if signal is None or forward_returns is None or min(len(signal), len(forward_returns)) < 5:
        return 0.0
    common = signal.index.intersection(forward_returns.index)
    s = signal.reindex(common).dropna()
    r = forward_returns.reindex(common).dropna()
    common = s.index.intersection(r.index)
    if len(common) < 5:
        return 0.0
    return float(s.loc[common].corr(r.loc[common]))


def run_backtest(
    ticker: str = "AAPL",
    sentiment_series: Optional[pd.Series] = None,
    days: int = 252,
) -> dict[str, Any]:
    """
    Run backtest: buy-and-hold vs sentiment-based (signal = sign(sentiment)).
    Returns metrics: Sharpe (price-only, strategy), IC, total return.
    """
    prices = _fetch_prices(ticker, days)
    if prices is None or len(prices) < 10:
        return {
            "error": "Could not fetch price data",
            "ticker": ticker,
            "price_only_sharpe": None,
            "strategy_sharpe": None,
            "ic": None,
        }

    price_returns = prices.pct_change().dropna()

    # Price-only: buy and hold
    price_only_sharpe = sharpe_ratio(price_returns)

    # Strategy: if we have sentiment series, use it; else dummy 0
    if sentiment_series is not None and len(sentiment_series) > 0:
        # Align: reindex sentiment to price index (forward fill from last known)
        signal = sentiment_series.reindex(prices.index).ffill().fillna(0)
        strategy_returns = _simulate_returns(prices, signal)
        strategy_sharpe = sharpe_ratio(strategy_returns)
        fwd_ret = prices.pct_change().shift(-1).dropna()
        ic = information_coefficient(signal, fwd_ret)
    else:
        strategy_returns = pd.Series(dtype=float)
        strategy_sharpe = None
        ic = None

    total_return_price = float((1 + price_returns).prod() - 1) if len(price_returns) else None
    total_return_strategy = float((1 + strategy_returns).prod() - 1) if len(strategy_returns) else None

    return {
        "ticker": ticker,
        "price_only_sharpe": round(price_only_sharpe, 4),
        "strategy_sharpe": round(strategy_sharpe, 4) if strategy_sharpe is not None else None,
        "ic": round(ic, 4) if ic is not None else None,
        "total_return_price": total_return_price,
        "total_return_strategy": total_return_strategy,
        "num_days": len(prices),
    }
