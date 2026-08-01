"""
Agent orchestrator: runs all agents and optionally debate, returns unified output.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .base import BaseAgent
from .news_scout import NewsScoutAgent
from .macro_context import MacroContextAgent
from .technical_agent import TechnicalAgent
from .market_reaction import MarketReactionAgent
from .risk_agent import RiskAgent
from .decision_agent import DecisionAgent
from .debate_agents import (
    BearResearcherAgent,
    BullResearcherAgent,
    DebateFacilitatorAgent,
    RiskCommitteeAgent,
)

try:
    from shock_predictor.agent import ShockAgent, build_shock_context_from_pipeline
except ImportError:
    ShockAgent = None
    build_shock_context_from_pipeline = None

logger = logging.getLogger(__name__)

PIPELINE_STEPS = [
    ("news_fetch", "News ingestion", "Fetch headlines from NewsAPI and fallback providers"),
    ("news_scout", "News Scout", "Scan sentiment distribution and detect spikes"),
    ("macro_context", "Macro Context", "Link headlines to rates, CPI, GDP, yields"),
    ("technical", "Technical Analysis", "Moving averages, momentum, volatility"),
    ("market_reaction", "Market Reaction", "Historical reaction patterns to similar sentiment"),
    ("risk", "Risk", "Flag concentration, spike, and downside risks"),
    ("bull_research", "Bull Research", "Build bullish thesis from multi-signal evidence"),
    ("bear_research", "Bear Research", "Build bearish thesis from multi-signal evidence"),
    ("risk_committee", "Risk Committee", "Set position/risk constraints from committee view"),
    ("debate_facilitator", "Debate Facilitator", "Resolve bull vs bear and select base stance"),
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
        self.bull = BullResearcherAgent()
        self.bear = BearResearcherAgent()
        self.risk_committee = RiskCommitteeAgent()
        self.debate = DebateFacilitatorAgent()
        self.shock = ShockAgent() if ShockAgent else None

    def run(
        self,
        articles: list[dict],
        ticker: str = "",
        aggregate_sentiment: str = "neutral",
        news_meta: dict[str, Any] | None = None,
        selected_indicators: list[str] | None = None,
        selected_patterns: list[str] | None = None,
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

        ctx: dict[str, Any] = {
            "articles": articles,
            "ticker": ticker,
            "aggregate_sentiment": aggregate_sentiment,
            "selected_indicators": selected_indicators or [],
            "selected_patterns": selected_patterns or [],
        }
        ctx["agent_outputs"] = {}

        def _timed(agent: BaseAgent, run_ctx: dict[str, Any]) -> tuple[dict[str, Any], float]:
            t0 = time.perf_counter()
            out = agent.run(run_ctx)
            return out, (time.perf_counter() - t0) * 1000

        # Stage 1: independent of each other — only need articles/ticker.
        with ThreadPoolExecutor(max_workers=3) as pool:
            f_scout = pool.submit(_timed, self.news_scout, ctx)
            f_macro = pool.submit(_timed, self.macro, ctx)
            f_technical = pool.submit(_timed, self.technical, ctx)
            scout_out, scout_ms = f_scout.result()
            macro_out, macro_ms = f_macro.result()
            technical_out, technical_ms = f_technical.result()

        record("news_scout", "News Scout", "completed", scout_out.get("summary", ""), scout_ms)
        ctx["agent_outputs"]["NewsScout"] = scout_out
        ctx["spike_detected"] = scout_out.get("spike_detected", False)
        ctx["spike_direction"] = scout_out.get("spike_direction")

        record("macro_context", "Macro Context", "completed", macro_out.get("summary", ""), macro_ms)
        ctx["agent_outputs"]["MacroContext"] = macro_out

        record("technical", "Technical Analysis", "completed", technical_out.get("summary", ""), technical_ms)
        ctx["agent_outputs"]["Technical"] = technical_out
        ctx["technical_signal"] = technical_out.get("signal", "neutral")

        # Stage 2: depends only on stage 1 outputs, independent of each other.
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_reaction = pool.submit(_timed, self.market_reaction, ctx)
            f_risk = pool.submit(_timed, self.risk, ctx)
            reaction_out, reaction_ms = f_reaction.result()
            risk_out, risk_ms = f_risk.result()

        record("market_reaction", "Market Reaction", "completed", reaction_out.get("summary", ""), reaction_ms)
        ctx["agent_outputs"]["MarketReaction"] = reaction_out

        record("risk", "Risk", "completed", risk_out.get("summary", ""), risk_ms)
        ctx["agent_outputs"]["Risk"] = risk_out

        # Stage 3: bull/bear/shock only need stage 1+2 outputs, independent of each other.
        def _run_shock() -> tuple[dict[str, Any], float]:
            t0 = time.perf_counter()
            try:
                shock_ctx = {**ctx, **build_shock_context_from_pipeline(ctx)}
                out = self.shock.run(shock_ctx)
                return out, (time.perf_counter() - t0) * 1000
            except Exception as exc:
                logger.warning("Shock agent failed: %s", exc)
                return (
                    {"summary": f"Shock predictor unavailable: {exc}", "shock_probability": 0, "_error": True},
                    (time.perf_counter() - t0) * 1000,
                )

        run_shock = bool(self.shock and build_shock_context_from_pipeline)
        with ThreadPoolExecutor(max_workers=3) as pool:
            f_bull = pool.submit(_timed, self.bull, ctx)
            f_bear = pool.submit(_timed, self.bear, ctx)
            f_shock = pool.submit(_run_shock) if run_shock else None
            bull_out, bull_ms = f_bull.result()
            bear_out, bear_ms = f_bear.result()
            shock_out, shock_ms = f_shock.result() if f_shock else ({}, 0.0)

        record("bull_research", "Bull Research", "completed", bull_out.get("summary", ""), bull_ms)
        ctx["agent_outputs"]["BullResearcher"] = bull_out

        record("bear_research", "Bear Research", "completed", bear_out.get("summary", ""), bear_ms)
        ctx["agent_outputs"]["BearResearcher"] = bear_out

        if run_shock:
            record(
                "shock",
                "Shock Predictor",
                "error" if shock_out.get("_error") else "completed",
                shock_out.get("summary", ""),
                shock_ms,
            )
            shock_out.pop("_error", None)
            ctx["agent_outputs"]["Shock"] = shock_out
            ctx["shock_probability"] = shock_out.get("shock_probability", 0)

        t0 = time.perf_counter()
        committee_out = self.risk_committee.run(ctx)
        record(
            "risk_committee",
            "Risk Committee",
            "completed",
            committee_out.get("summary", ""),
            (time.perf_counter() - t0) * 1000,
        )
        ctx["agent_outputs"]["RiskCommittee"] = committee_out

        t0 = time.perf_counter()
        debate_out = self.debate.run(ctx)
        record(
            "debate_facilitator",
            "Debate Facilitator",
            "completed",
            debate_out.get("summary", ""),
            (time.perf_counter() - t0) * 1000,
        )
        ctx["agent_outputs"]["Debate"] = debate_out

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
            "bull_research": bull_out,
            "bear_research": bear_out,
            "risk_committee": committee_out,
            "debate": debate_out,
            "shock": shock_out,
            "decision": decision_out,
            "recommendation": decision_out.get("recommendation", ""),
            "pipeline": pipeline,
            "article_count": len(articles),
            "news_source": meta.get("source"),
            "news_sources": meta.get("sources"),
            "ticker": ticker or None,
            "selected_indicators": selected_indicators or [],
            "selected_patterns": selected_patterns or [],
        }
