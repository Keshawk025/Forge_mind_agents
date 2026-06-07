from app.agents.state import AgentState
from app.agents.llm import call_ollama
from app.core.database import SessionLocal
from app.models.models import AgentExecution, Log
from app.core.files import write_project_file

def documentation_node(state: AgentState) -> AgentState:
    print("--- DOCUMENTATION AGENT ---")
    model_name = state.get("model_name", "gemma")
    project_path = state.get("project_path", ".")
    
    system_prompt = "You are the Documentation agent for ForgeMind. Write a readme documenting the implemented features."
    user_prompt = f"Task: {state.get('prompt')}\nCode: {state.get('code_changes')}"
    
    fallback_doc = (
        f"# Implementation Details\n\n"
        f"Goal: {state.get('prompt')}\n\n"
        f"The backend logic has been updated, and tests are passing.\n"
    )
    
    doc = call_ollama(model_name, system_prompt, user_prompt, "docs")
    
    changes = state.get("code_changes", {})
    changes["README.md"] = doc
    state["code_changes"] = changes
    
    # Save file to disk
    try:
        write_project_file(project_path, "README.md", doc)
        state["logs"].append("Documentation node wrote README.md to workspace.")
    except Exception as e:
        state["logs"].append(f"Documentation: Failed to write README.md: {e}")
        state["errors"].append(str(e))
        
    state["current_step"] = "documentation"
    
    # Log progress to DB and mark execution success
    db = SessionLocal()
    try:
        exec_id = state.get("execution_id")
        if exec_id:
            execution = db.query(AgentExecution).filter(AgentExecution.id == exec_id).first()
            if execution:
                execution.output_data = {"code_changes": changes}
                execution.status = "success" # Mark final node success
                db.add(Log(execution_id=exec_id, level="info", message="Documentation node: Generated and wrote README.md."))
                db.commit()
    except Exception as e:
        print(f"Db log error in documentation: {e}")
    finally:
        db.close()
        
    return state
