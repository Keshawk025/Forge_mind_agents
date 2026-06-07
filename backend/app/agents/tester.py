from app.agents.state import AgentState
from app.core.database import SessionLocal
from app.models.models import AgentExecution, Log
from app.core.files import run_project_tests

def tester_node(state: AgentState) -> AgentState:
    print("--- TESTER AGENT ---")
    
    iterations = state.get("iterations", 0)
    prompt = state.get("prompt", "").lower()
    project_path = state.get("project_path", ".")
    
    state["logs"].append("Tester node invoking workspace runner checks...")
    
    # Run physical code verification inside sandbox workspace
    test_info = run_project_tests(project_path)
    passed = test_info["passed"]
    
    # Keep simulated failure on first iteration for explicit user demonstration request
    if "fail" in prompt and iterations == 0:
        passed = False
        test_info["passed"] = False
        test_info["error"] = "SimulatedAssertionError: Expected True but got False"
        test_info["summary"] = "1 failed, 0 passed (Simulated demo)"
        
    if not passed:
        error_msg = test_info.get("stderr") or test_info.get("error") or "Code validation failed."
        state["errors"].append(error_msg)
        state["test_results"] = test_info
        state["logs"].append(f"Tester node: Test failed. Summary: {test_info['summary']}")
    else:
        state["test_results"] = test_info
        state["logs"].append(f"Tester node: Code verification successful. Summary: {test_info['summary']}")
        
    state["current_step"] = "tester"
    state["iterations"] = iterations + 1
    
    # Log progress to DB
    db = SessionLocal()
    try:
        exec_id = state.get("execution_id")
        if exec_id:
            execution = db.query(AgentExecution).filter(AgentExecution.id == exec_id).first()
            if execution:
                execution.output_data = {"test_results": state["test_results"]}
                status = "passed" if passed else "failed"
                db.add(Log(execution_id=exec_id, level="info", message=f"Tester node: Completed verification. Status: {status}."))
                db.commit()
    except Exception as e:
        print(f"Db log error in tester: {e}")
    finally:
        db.close()
        
    return state
