"""
Agent orchestrator: runs all agents and optionally debate, returns unified output.
"""
import logging
from typing import Any

from .base import BaseAgent
from .news_scout import NewsScoutAgent
from .macro_context import MacroContextAgent
from .market_reaction import MarketReactionAgent
from .risk_agent import RiskAgent
from .decision_agent import DecisionAgent

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """Runs specialized agents and the Decision agent to produce a final view."""

    def __init__(self):
        self.agents: list[BaseAgent] = [
            NewsScoutAgent(),
            MacroContextAgent(),
            MarketReactionAgent(),
            RiskAgent(),
            DecisionAgent(),
        ]
        self.news_scout = self.agents[0]
        self.macro = self.agents[1]
        self.market_reaction = self.agents[2]
        self.risk = self.agents[3]
        self.decision = self.agents[4]

    def run(self, articles: list[dict], ticker: str = "", aggregate_sentiment: str = "neutral") -> dict[str, Any]:
        """
        Execute pipeline: News Scout -> Macro -> Market Reaction -> Risk -> Decision.
        """
        # Build context step by step
        ctx: dict[str, Any] = {"articles": articles, "ticker": ticker, "aggregate_sentiment": aggregate_sentiment}

        scout_out = self.news_scout.run(ctx)
        ctx["agent_outputs"] = {"NewsScout": scout_out}
        ctx["spike_detected"] = scout_out.get("spike_detected", False)
        ctx["spike_direction"] = scout_out.get("spike_direction")

        macro_out = self.macro.run(ctx)
        ctx["agent_outputs"]["MacroContext"] = macro_out

        reaction_out = self.market_reaction.run(ctx)
        ctx["agent_outputs"]["MarketReaction"] = reaction_out

        risk_out = self.risk.run(ctx)
        ctx["agent_outputs"]["Risk"] = risk_out

        decision_out = self.decision.run(ctx)
        ctx["agent_outputs"]["Decision"] = decision_out

        return {
            "news_scout": scout_out,
            "macro_context": macro_out,
            "market_reaction": reaction_out,
            "risk": risk_out,
            "decision": decision_out,
            "recommendation": decision_out.get("recommendation", ""),
        }
