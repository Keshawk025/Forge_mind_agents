from app.agents.state import AgentState
from app.agents.llm import call_ollama
from app.core.database import SessionLocal
from app.models.models import AgentExecution, Log
from datetime import datetime

def planner_node(state: AgentState) -> AgentState:
    print("--- PLANNER AGENT ---")
    prompt = state.get("prompt", "")
    model_name = state.get("model_name", "phi-4")
    
    system_prompt = "You are the Planner agent for ForgeMind. Breakdown the user request into a step-by-step development roadmap."
    user_prompt = f"Request: {prompt}"
    
    fallback = (
        f"1. Analyze the project workspace files.\n"
        f"2. Implement core components and services requested: '{prompt}'.\n"
        f"3. Verify and compile codebase."
    )
    
    plan = call_ollama(model_name, system_prompt, user_prompt, "planner")
    
    # Extract tasks from plan lines
    tasks = []
    for line in plan.split("\n"):
        line = line.strip()
        if line.startswith(("-", "*", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.")):
            tasks.append(line)
            
    if not tasks:
        tasks = [f"Complete implementation of: {prompt}"]
        
    state["plan"] = plan
    state["tasks"] = tasks
    state["current_step"] = "planner"
    state["logs"].append("Planner generated execution path and broke down work tasks.")
    
    # Log progress to DB
    db = SessionLocal()
    try:
        exec_id = state.get("execution_id")
        if exec_id:
            execution = db.query(AgentExecution).filter(AgentExecution.id == exec_id).first()
            if execution:
                execution.status = "running"
                execution.output_data = {"plan": plan, "tasks": tasks}
                db.add(Log(execution_id=exec_id, level="info", message="Planner node: Completed task breakdown."))
                db.commit()
    except Exception as e:
        print(f"Db log error in planner: {e}")
    finally:
        db.close()
        
    return state
