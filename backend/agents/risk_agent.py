"""
Risk Agent: flags volatility spikes and tail risks.
"""
import logging
from typing import Any

from .base import BaseAgent

logger = logging.getLogger(__name__)


class RiskAgent(BaseAgent):
    """Flags volatility spikes and tail risks from news and context."""

    def __init__(self):
        super().__init__(name="Risk", role="Flag volatility spikes and tail risks")

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        articles = context.get("articles", [])
        spike = context.get("spike_detected", False)
        spike_direction = context.get("spike_direction")
        td_ctx = context.get("truedata_context") or {}
        td_factors = td_ctx.get("decision_factors") or {}

        flags = []
        if spike and spike_direction == "negative":
            flags.append("Elevated downside risk: negative sentiment spike")
        if spike and spike_direction == "positive":
            flags.append("Crowded positive sentiment: possible short-term overextension")
        if len(articles) > 15:
            flags.append("High news volume: volatility likely")
        # Tail risk: extreme negative
        neg_count = sum(1 for a in articles if (a.get("sentiment") or "").lower() == "negative")
        if len(articles) and neg_count / len(articles) >= 0.7:
            flags.append("Tail risk: majority negative news — consider hedging")

        try:
            oi_gainers = int(td_factors.get("oi_gainers_count", 0) or 0)
            oi_losers = int(td_factors.get("oi_losers_count", 0) or 0)
            corp_actions = int(td_factors.get("corporate_actions_count", 0) or 0)
            if oi_losers > oi_gainers and oi_losers - oi_gainers >= 3:
                flags.append("Derivatives risk: OI losers dominate, positioning may be weakening")
            if corp_actions >= 5:
                flags.append("Event risk: elevated corporate actions flow may increase volatility")
        except Exception:
            pass

        finding = {"flags": flags, "spike": spike}
        self._remember(finding)

        return {
            "risk_flags": flags,
            "summary": "; ".join(flags) if flags else "No elevated risk flags.",
        }
