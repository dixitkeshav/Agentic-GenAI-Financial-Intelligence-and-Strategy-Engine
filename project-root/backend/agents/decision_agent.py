"""
Decision Agent: synthesizes all agent outputs into a final recommendation.
"""
import logging
import os
from typing import Any, Optional

from .base import BaseAgent

logger = logging.getLogger(__name__)


def _call_llm_debate(agent_summaries: list[str], context: dict) -> Optional[str]:
    """Use Groq or OpenAI (via intelligence.llm) to synthesize agent debate."""
    from intelligence.llm import chat_completion
    prompt = (
        "You are a senior strategist. Given these specialist views, output a single short "
        "paragraph: (1) overall view, (2) key risk, (3) one actionable recommendation. "
        "Be concise.\n\n" + "\n\n".join(agent_summaries)
    )
    return chat_completion(prompt, system_content="", max_tokens=250)


class DecisionAgent(BaseAgent):
    """Synthesizes News Scout, Macro, Market Reaction, and Risk into a final recommendation."""

    def __init__(self):
        super().__init__(name="Decision", role="Synthesize all agent views into final recommendation")

    def run(self, context: dict[str, Any]) -> dict[str, Any]:
        agent_outputs = context.get("agent_outputs", {})
        summaries = []
        for name, out in agent_outputs.items():
            if isinstance(out, dict) and "summary" in out:
                summaries.append(f"{name}: {out['summary']}")
            elif isinstance(out, str):
                summaries.append(f"{name}: {out}")

        # Optional debate via LLM
        recommendation = _call_llm_debate(summaries, context)
        if not recommendation:
            # Rule-based synthesis
            risk_flags = agent_outputs.get("Risk", {}).get("risk_flags", [])
            reaction = agent_outputs.get("MarketReaction", {}).get("historical_reaction", "")
            macro = agent_outputs.get("MacroContext", {}).get("macro_links", [])
            recommendation = (
                "Synthesis: Consider macro context (" + ", ".join(macro[:2]) + "). "
                + reaction + " "
                + ("Key risks: " + "; ".join(risk_flags[:2]) if risk_flags else "")
            )

        self._remember({"recommendation": recommendation, "inputs": list(agent_outputs.keys())})

        return {
            "recommendation": recommendation,
            "summary": recommendation,
        }
