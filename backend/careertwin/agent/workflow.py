"""LangGraph intent router and bounded specialist workflow."""

from __future__ import annotations

from typing import Any, TypedDict, cast

from langgraph.graph import END, START, StateGraph

from careertwin.agent.contracts import AgentContext, AgentDraft
from careertwin.agent.providers import Provider


class WorkflowState(TypedDict, total=False):
    context: AgentContext
    specialist: str
    draft: AgentDraft
    verified: bool
    error: str


def route_intent(state: WorkflowState) -> dict[str, str]:
    """Route with explicit bounded vocabulary; this step has no tools and makes no writes."""
    question = state["context"].question.casefold()
    mapping = {
        "opportunity": ("job", "opportunity", "offer", "vacancy", "empleo", "oferta"),
        "matching": ("match", "score", "align", "encaj", "puntaje"),
        "improvement": ("improve", "learn", "gap", "weak", "mejor", "brecha"),
        "pipeline": ("application", "interview", "deadline", "meeting", "postul"),
        "guide": ("how", "help", "guide", "como", "ayuda"),
    }
    for specialist, markers in mapping.items():
        if any(marker in question for marker in markers):
            return {"specialist": specialist}
    return {"specialist": "profile"}


def build_workflow(provider: Provider) -> Any:
    """Compile the typed routing, response and evidence-critic graph."""

    def respond(state: WorkflowState) -> dict[str, AgentDraft]:
        return {"draft": provider.complete(state["context"], state["specialist"])}

    def evidence_critic(state: WorkflowState) -> dict[str, bool | str]:
        draft = state["draft"]
        available = {str(item.get("id")) for item in state["context"].evidence}
        cited = {item.evidence_id for item in draft.citations}
        if not cited.issubset(available):
            return {"verified": False, "error": "A citation did not resolve to supplied evidence"}
        if draft.proposed_operations and not cited:
            return {"verified": False, "error": "Canonical change proposals require evidence"}
        return {"verified": True}

    graph = StateGraph(WorkflowState)
    graph.add_node("route", route_intent)
    graph.add_node("respond", respond)
    graph.add_node("evidence_critic", evidence_critic)
    graph.add_edge(START, "route")
    graph.add_edge("route", "respond")
    graph.add_edge("respond", "evidence_critic")
    graph.add_edge("evidence_critic", END)
    return graph.compile()


def run_workflow(provider: Provider, context: AgentContext) -> AgentDraft:
    """Run a bounded conversation turn and reject an evidence-critic failure."""
    result = build_workflow(provider).invoke({"context": context})
    if not result.get("verified"):
        raise ValueError(result.get("error", "Evidence critic rejected the response"))
    return cast(AgentDraft, result["draft"])
