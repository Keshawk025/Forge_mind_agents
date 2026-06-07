from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    path: str

class ProjectCreate(ProjectBase):
    pass

class ProjectOut(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Log Schemas
class LogOut(BaseModel):
    id: int
    execution_id: int
    level: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Agent Execution Schemas
class AgentExecutionBase(BaseModel):
    agent_name: str
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None

class AgentExecutionCreate(AgentExecutionBase):
    session_id: int

class AgentExecutionOut(AgentExecutionBase):
    id: int
    session_id: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    logs: List[LogOut] = []

    class Config:
        from_attributes = True

# Session Schemas
class SessionBase(BaseModel):
    project_id: int
    status: str

class SessionCreate(SessionBase):
    pass

class SessionOut(SessionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    executions: List[AgentExecutionOut] = []

    class Config:
        from_attributes = True

# Workflow execution triggers
class RunAgentWorkflow(BaseModel):
    project_id: int
    prompt: str
    model_name: Optional[str] = "phi-4" # phi-4, qwen3-coder, etc.
