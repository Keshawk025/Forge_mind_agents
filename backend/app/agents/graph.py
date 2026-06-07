from langgraph.graph import StateGraph, END
from app.agents.state import AgentState
from app.agents.planner import planner_node
from app.agents.coder import coder_node
from app.agents.tester import tester_node
from app.agents.reviewer import reviewer_node
from app.agents.documentation import documentation_node

def decide_next_step(state: AgentState) -> str:
    """
    Decides whether to route back to coder for self-healing or proceed to reviewer.
    """
    test_results = state.get("test_results", {})
    passed = test_results.get("passed", True)
    iterations = state.get("iterations", 0)
    
    if not passed and iterations < 3:
        # Route back to coder node for self-healing code fixes
        state["logs"].append(f"Tester node reported errors. Directing back to Coder node (attempt {iterations}).")
        return "coder"
        
    return "reviewer"

# Initialize state graph
workflow = StateGraph(AgentState)

# Register nodes
workflow.add_node("planner", planner_node)
workflow.add_node("coder", coder_node)
workflow.add_node("tester", tester_node)
workflow.add_node("reviewer", reviewer_node)
workflow.add_node("documentation", documentation_node)

# Set entry point
workflow.set_entry_point("planner")

# Flow definitions
workflow.add_edge("planner", "coder")
workflow.add_edge("coder", "tester")

# Conditional self-healing route
workflow.add_conditional_edges(
    "tester",
    decide_next_step,
    {
        "coder": "coder",
        "reviewer": "reviewer"
    }
)

workflow.add_edge("reviewer", "documentation")
workflow.add_edge("documentation", END)

# Compile
agent_graph = workflow.compile()
