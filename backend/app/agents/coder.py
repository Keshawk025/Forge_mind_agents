import os
import re
from app.agents.state import AgentState
from app.agents.llm import call_ollama
from app.core.database import SessionLocal
from app.models.models import AgentExecution, Log
from app.core.files import write_project_file

def parse_generated_files(text: str) -> dict[str, str]:
    """
    Parses LLM output line by line to extract multiple files.
    Only collects lines that are strictly inside markdown code blocks (```...```)
    under a [FILE: filename] declaration. Discards any outside conversational leakage.
    """
    files = {}
    current_file = None
    current_lines = []
    in_code_block = False
    
    file_decl_pat = re.compile(r'(?:---|\[)FILE:\s*([a-zA-Z0-9_\-\.\/]+)(?:\s*---|\])')
    
    for line in text.split("\n"):
        match = file_decl_pat.search(line)
        if match:
            # Save the previous file if we had one
            if current_file and current_lines:
                files[current_file] = "\n".join(current_lines).strip()
            # Start new file
            current_file = match.group(1).strip()
            current_lines = []
            in_code_block = False
            continue
            
        if line.strip().startswith("```"):
            if current_file is not None:
                if not in_code_block:
                    in_code_block = True
                else:
                    # Closing code block: save this file and reset
                    files[current_file] = "\n".join(current_lines).strip()
                    current_file = None
                    current_lines = []
                    in_code_block = False
            continue
            
        if current_file is not None and in_code_block:
            current_lines.append(line)
            
    # Save the last file if we didn't hit a closing fence
    if current_file and current_lines:
        files[current_file] = "\n".join(current_lines).strip()
        
    if not files:
        # Fallback to single main file if no file decl was found
        content = text.strip()
        lines = content.split("\n")
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        files["src/main.py"] = "\n".join(lines).strip()
        
    return files

def coder_node(state: AgentState) -> AgentState:
    print("--- CODER AGENT ---")
    prompt = state.get("prompt", "")
    tasks = state.get("tasks", [])
    model_name = state.get("model_name", "qwen3-coder")
    project_path = state.get("project_path", ".")
    
    system_prompt = (
        "You are the Coder agent for ForgeMind. Write the source code needed to fulfill the plan tasks.\n"
        "If you need to generate multiple files (for example, index.html, style.css, script.js, or python modules),\n"
        "prefix each markdown code block with a file header in the following format:\n"
        "[FILE: path/to/filename.ext]\n"
        "```language\n"
        "code content\n"
        "```\n\n"
        "Ensure all file paths are relative to the project root and do not start with a slash."
    )
    user_prompt = f"Plan: {state.get('plan')}\nTasks: {tasks}\nGoal: {prompt}"
    
    code = call_ollama(model_name, system_prompt, user_prompt, "coder")
    
    # Parse generated files mapping
    files_to_write = parse_generated_files(code)
    
    # Write code changes to state
    changes = state.get("code_changes", {})
    for filename, content in files_to_write.items():
        changes[filename] = content
    state["code_changes"] = changes
    
    # Save the files to disk
    written_files = []
    try:
        os.makedirs(project_path, exist_ok=True)
        for filename, content in files_to_write.items():
            # Ensure folder structure inside project_path exists
            dir_path = os.path.dirname(os.path.join(project_path, filename))
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            write_project_file(project_path, filename, content)
            written_files.append(filename)
            
        state["logs"].append(f"Coder node wrote files: {', '.join(written_files)}")
    except Exception as e:
        state["logs"].append(f"Coder: Failed to write files to disk: {e}")
        state["errors"].append(str(e))
    
    state["current_step"] = "coder"
    
    # Log progress to DB
    db = SessionLocal()
    try:
        exec_id = state.get("execution_id")
        if exec_id:
            execution = db.query(AgentExecution).filter(AgentExecution.id == exec_id).first()
            if execution:
                execution.output_data = {"code_changes": changes}
                db.add(Log(
                    execution_id=exec_id, 
                    level="info", 
                    message=f"Coder node: Generated and wrote files: {', '.join(written_files)}"
                ))
                db.commit()
    except Exception as e:
        print(f"Db log error in coder: {e}")
    finally:
        db.close()
        
    return state
