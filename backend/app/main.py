import asyncio
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environmental variables from .env file
load_dotenv()

from app.core.database import Base, engine, get_db
from app.models.models import Project, Session as DBSession, AgentExecution, Log
from app.schemas.schemas import ProjectCreate, ProjectOut, RunAgentWorkflow, SessionOut
from app.agents import agent_graph

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ForgeMind Agent Orchestration Engine")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, session_id: int, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: int, websocket: WebSocket):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)

    async def broadcast(self, session_id: int, message: Dict[str, Any]):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Ignore dead connections
                    pass

manager = ConnectionManager()

# Background execution runner for LangGraph workflow
async def run_agent_workflow_task(project_id: int, session_id: int, execution_id: int, prompt: str, model_name: str):
    db_session = next(get_db())
    project = db_session.query(Project).filter(Project.id == project_id).first()
    project_path = project.path if project else "."
    db_session.close()

    # Shared graph state initialization
    state = {
        "project_id": project_id,
        "project_path": project_path,
        "prompt": prompt,
        "model_name": model_name,
        "current_step": "init",
        "plan": "",
        "tasks": [],
        "code_changes": {},
        "test_results": {},
        "logs": ["Workflow initialized. Launching Planner Agent..."],
        "errors": [],
        "iterations": 0,
        "session_id": session_id,
        "execution_id": execution_id
    }

    await manager.broadcast(session_id, {
        "type": "agent_update",
        "step": "init",
        "logs": state["logs"],
        "state": {k: state[k] for k in ["project_id", "current_step", "plan", "tasks", "code_changes", "test_results", "logs", "errors", "iterations"]}
    })
    
    # Introduce small latency for visual dashboard transitions
    await asyncio.sleep(1)

    try:
        # Stream the nodes of the graph
        async for event in agent_graph.astream(state):
            for node_name, node_state in event.items():
                # Merge the update into current state
                state.update(node_state)
                
                # Broadast update
                await manager.broadcast(session_id, {
                    "type": "agent_update",
                    "step": node_name,
                    "logs": state["logs"],
                    "state": {
                        "project_id": state["project_id"],
                        "current_step": state["current_step"],
                        "plan": state["plan"],
                        "tasks": state["tasks"],
                        "code_changes": state["code_changes"],
                        "test_results": state["test_results"],
                        "logs": state["logs"],
                        "errors": state["errors"],
                        "iterations": state["iterations"],
                    }
                })
                await asyncio.sleep(1.5) # Allow visualization time on dashboard

        # Mark execution success
        db = next(get_db())
        exec_record = db.query(AgentExecution).filter(AgentExecution.id == execution_id).first()
        if exec_record:
            exec_record.status = "success"
            exec_record.completed_at = datetime.datetime.utcnow()
            
            sess_record = db.query(DBSession).filter(DBSession.id == session_id).first()
            if sess_record:
                sess_record.status = "completed"
                
            db.commit()
        db.close()

        await manager.broadcast(session_id, {
            "type": "workflow_complete",
            "status": "success",
            "logs": ["Workflow executed successfully. All agents completed tasks!"]
        })

    except Exception as e:
        print(f"Agent graph execution error: {e}")
        db = next(get_db())
        exec_record = db.query(AgentExecution).filter(AgentExecution.id == execution_id).first()
        if exec_record:
            exec_record.status = "failed"
            exec_record.completed_at = datetime.datetime.utcnow()
            db.add(Log(execution_id=execution_id, level="error", message=f"Execution failed: {str(e)}"))
            
            sess_record = db.query(DBSession).filter(DBSession.id == session_id).first()
            if sess_record:
                sess_record.status = "failed"
                
            db.commit()
        db.close()

        await manager.broadcast(session_id, {
            "type": "workflow_complete",
            "status": "failed",
            "logs": [f"Execution failed: {str(e)}"]
        })


# REST APIs

@app.get("/")
def read_root():
    return {"message": "ForgeMind API engine is up and running."}

@app.get("/api/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

@app.post("/api/projects", response_model=ProjectOut)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(
        name=project.name,
        description=project.description,
        path=project.path
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.get("/api/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    sess = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess

@app.post("/api/runs")
def trigger_agent_run(payload: RunAgentWorkflow, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Verify project exists
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create new session
    session = DBSession(project_id=payload.project_id, status="running")
    db.add(session)
    db.commit()
    db.refresh(session)

    # Create agent execution record
    execution = AgentExecution(
        session_id=session.id,
        agent_name="orchestrator",
        status="running",
        input_data={"prompt": payload.prompt, "model_name": payload.model_name}
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Launch background task
    background_tasks.add_task(
        run_agent_workflow_task,
        project_id=payload.project_id,
        session_id=session.id,
        execution_id=execution.id,
        prompt=payload.prompt,
        model_name=payload.model_name
    )

    return {
        "message": "Agent workflow started.",
        "session_id": session.id,
        "execution_id": execution.id
    }


# WebSockets

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: int):
    await manager.connect(session_id, websocket)
    try:
        while True:
            # Maintain connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
