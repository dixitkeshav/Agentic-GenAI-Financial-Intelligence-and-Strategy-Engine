"""
Agent orchestrator: runs all agents and optionally debate, returns unified output.
"""
import logging
import time
from typing import Any

from .base import BaseAgent
from .news_scout import NewsScoutAgent
from .macro_context import MacroContextAgent
from .technical_agent import TechnicalAgent
from .market_reaction import MarketReactionAgent
from .risk_agent import RiskAgent
from .decision_agent import DecisionAgent

try:
    from shock_predictor.agent import ShockAgent, build_shock_context_from_pipeline
except ImportError:
    ShockAgent = None
    build_shock_context_from_pipeline = None

logger = logging.getLogger(__name__)

PIPELINE_STEPS = [
    ("news_fetch", "News ingestion", "Fetch headlines from Alpha Vantage / Finnhub / database"),
    ("news_scout", "News Scout", "Scan sentiment distribution and detect spikes"),
    ("macro_context", "Macro Context", "Link headlines to rates, CPI, GDP, yields"),
    ("technical", "Technical Analysis", "Moving averages, momentum, volatility"),
    ("market_reaction", "Market Reaction", "Historical reaction patterns to similar sentiment"),
    ("risk", "Risk", "Flag concentration, spike, and downside risks"),
    ("shock", "Shock Predictor", "Real-time Nifty shock probability and hedge hints"),
    ("decision", "Decision", "Synthesize all agent views into a recommendation"),
]


class AgentOrchestrator:
    """Runs specialized agents and the Decision agent to produce a final view."""

    def __init__(self):
        self.agents: list[BaseAgent] = [
            NewsScoutAgent(),
            MacroContextAgent(),
            TechnicalAgent(),
            MarketReactionAgent(),
            RiskAgent(),
            DecisionAgent(),
        ]
        self.news_scout = self.agents[0]
        self.macro = self.agents[1]
        self.technical = self.agents[2]
        self.market_reaction = self.agents[3]
        self.risk = self.agents[4]
        self.decision = self.agents[5]
        self.shock = ShockAgent() if ShockAgent else None

    def run(
        self,
        articles: list[dict],
        ticker: str = "",
        aggregate_sentiment: str = "neutral",
        news_meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute pipeline: News Scout -> Macro -> Technical -> Market Reaction -> Risk -> Decision.
        """
        pipeline: list[dict[str, Any]] = []
        meta = news_meta or {}

        def record(step_id: str, label: str, status: str, summary: str = "", ms: float = 0) -> None:
            pipeline.append(
                {
                    "id": step_id,
                    "label": label,
                    "status": status,
                    "summary": summary,
                    "duration_ms": round(ms, 1),
                }
            )

        record(
            "news_fetch",
            "News ingestion",
            "completed",
            f"Loaded {len(articles)} articles from {meta.get('source', 'unknown')}.",
            float(meta.get("fetch_ms", 0)),
        )

        ctx: dict[str, Any] = {"articles": articles, "ticker": ticker, "aggregate_sentiment": aggregate_sentiment}

        t0 = time.perf_counter()
        scout_out = self.news_scout.run(ctx)
        record("news_scout", "News Scout", "completed", scout_out.get("summary", ""), (time.perf_counter() - t0) * 1000)
        ctx["agent_outputs"] = {"NewsScout": scout_out}
        ctx["spike_detected"] = scout_out.get("spike_detected", False)
        ctx["spike_direction"] = scout_out.get("spike_direction")

        t0 = time.perf_counter()
        macro_out = self.macro.run(ctx)
        record("macro_context", "Macro Context", "completed", macro_out.get("summary", ""), (time.perf_counter() - t0) * 1000)
        ctx["agent_outputs"]["MacroContext"] = macro_out

        t0 = time.perf_counter()
        technical_out = self.technical.run(ctx)
        record("technical", "Technical Analysis", "completed", technical_out.get("summary", ""), (time.perf_counter() - t0) * 1000)
        ctx["agent_outputs"]["Technical"] = technical_out
        ctx["technical_signal"] = technical_out.get("signal", "neutral")

        t0 = time.perf_counter()
        reaction_out = self.market_reaction.run(ctx)
        record("market_reaction", "Market Reaction", "completed", reaction_out.get("summary", ""), (time.perf_counter() - t0) * 1000)
        ctx["agent_outputs"]["MarketReaction"] = reaction_out

        t0 = time.perf_counter()
        risk_out = self.risk.run(ctx)
        record("risk", "Risk", "completed", risk_out.get("summary", ""), (time.perf_counter() - t0) * 1000)
        ctx["agent_outputs"]["Risk"] = risk_out

        shock_out = {}
        if self.shock and build_shock_context_from_pipeline:
            t0 = time.perf_counter()
            shock_ctx = {**ctx, **build_shock_context_from_pipeline(ctx)}
            shock_out = self.shock.run(shock_ctx)
            record(
                "shock",
                "Shock Predictor",
                "completed",
                shock_out.get("summary", ""),
                (time.perf_counter() - t0) * 1000,
            )
            ctx["agent_outputs"]["Shock"] = shock_out
            ctx["shock_probability"] = shock_out.get("shock_probability", 0)

        t0 = time.perf_counter()
        decision_out = self.decision.run(ctx)
        record("decision", "Decision", "completed", decision_out.get("recommendation", ""), (time.perf_counter() - t0) * 1000)
        ctx["agent_outputs"]["Decision"] = decision_out

        return {
            "news_scout": scout_out,
            "macro_context": macro_out,
            "technical": technical_out,
            "market_reaction": reaction_out,
            "risk": risk_out,
            "shock": shock_out,
            "decision": decision_out,
            "recommendation": decision_out.get("recommendation", ""),
            "pipeline": pipeline,
            "article_count": len(articles),
            "news_source": meta.get("source"),
            "ticker": ticker or None,
        }
