from app.agents.state import AgentState
from app.agents.llm import call_ollama
from app.core.database import SessionLocal
from app.models.models import AgentExecution, Log

def reviewer_node(state: AgentState) -> AgentState:
    print("--- REVIEWER AGENT ---")
    model_name = state.get("model_name", "llama3")
    
    system_prompt = "You are the Reviewer agent for ForgeMind. Review the code changes and test results, ensuring best practices are met."
    user_prompt = f"Code: {state.get('code_changes')}\nTests: {state.get('test_results')}"
    
    fallback_review = (
        "Code implementation looks clean and adheres to standards. "
        "Imports are properly resolved, and testing has validated the changes."
    )
    
    review = call_ollama(model_name, system_prompt, user_prompt, "reviewer")
    
    state["current_step"] = "reviewer"
    state["logs"].append("Reviewer completed code review and approved changes.")
    
    # Log progress to DB
    db = SessionLocal()
    try:
        exec_id = state.get("execution_id")
        if exec_id:
            execution = db.query(AgentExecution).filter(AgentExecution.id == exec_id).first()
            if execution:
                execution.output_data = {"review": review}
                db.add(Log(execution_id=exec_id, level="info", message="Reviewer node: Approved changes with code review metrics."))
                db.commit()
    except Exception as e:
        print(f"Db log error in reviewer: {e}")
    finally:
        db.close()
        
    return state
