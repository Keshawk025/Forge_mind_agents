from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    project_id: int
    project_path: str
    prompt: str
    model_name: str
    current_step: str
    plan: str
    tasks: List[str]
    code_changes: Dict[str, str] # filepath -> code
    test_results: Dict[str, Any]
    logs: List[str]
    errors: List[str]
    iterations: int
    session_id: int
    execution_id: int
