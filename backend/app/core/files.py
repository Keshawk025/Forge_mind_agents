import os
import subprocess

def write_project_file(project_path: str, relative_path: str, content: str) -> str:
    """
    Writes content to a file inside the project directory, with path traversal prevention.
    """
    project_abs = os.path.abspath(project_path)
    target_abs = os.path.abspath(os.path.join(project_abs, relative_path))
    
    # Path traversal safety check
    if not target_abs.startswith(project_abs):
        raise ValueError(f"Path traversal detected: {relative_path} is outside the project workspace.")

    os.makedirs(os.path.dirname(target_abs), exist_ok=True)
    with open(target_abs, "w", encoding="utf-8") as f:
        f.write(content)
    return target_abs

def run_project_tests(project_path: str) -> dict:
    """
    Runs tests inside the project workspace. Triggers pytest if present,
    or falls back to a python syntax compilation check.
    """
    project_abs = os.path.abspath(project_path)
    
    # Check if pytest is available in the venv/system
    try:
        result = subprocess.run(
            ["pytest"],
            cwd=project_abs,
            capture_output=True,
            text=True,
            timeout=15
        )
        return {
            "passed": result.returncode == 0,
            "summary": f"pytest finished with exit code {result.returncode}",
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except FileNotFoundError:
        # Pytest not found, compile Python code to verify syntax
        try:
            result = subprocess.run(
                ["python3", "-m", "compileall", "."],
                cwd=project_abs,
                capture_output=True,
                text=True,
                timeout=10
            )
            return {
                "passed": result.returncode == 0,
                "summary": "python3 compilation syntax check completed",
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except Exception as e:
            return {
                "passed": False,
                "summary": "Failed to invoke Python compiler check",
                "stdout": "",
                "stderr": str(e)
            }
