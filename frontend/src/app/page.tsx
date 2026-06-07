'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Code, FileText, CheckCircle, Terminal, Play, 
  Loader2, Plus, Network, RefreshCw, AlertCircle, 
  Cpu, Layers, Shield
} from 'lucide-react';
import { useAgentStore } from '@/store/useAgentStore';
import { useProjects, useCreateProject, useTriggerRun, Project } from '@/hooks/useApi';

export default function Workspace() {
  const {
    projectId, sessionId, step, logs, plan, codeChanges, 
    testResults, errors, prompt, modelName,
    setProjectId, setSessionId, setStep, setLogs, addLog,
    setPlan, setTasks, setCodeChanges, setTestResults, setErrors,
    setPrompt, setModelName, resetRunState
  } = useAgentStore();

  const { data: dbProjects = [], isLoading: isLoadingProjects } = useProjects();
  const createProjectMutation = useCreateProject();
  const triggerRunMutation = useTriggerRun();

  // Local UI State
  const [activeTab, setActiveTab] = useState<'code' | 'plan' | 'tests'>('code');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('/home/hp/ForgeMind/my_app');
  const [isSimulatedMode, setIsSimulatedMode] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Set default selected file when codeChanges updates
  useEffect(() => {
    const files = Object.keys(codeChanges);
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[0]);
    }
  }, [codeChanges, selectedFile]);

  // Set default project when loaded
  useEffect(() => {
    if (dbProjects.length > 0 && !projectId) {
      setProjectId(dbProjects[0].id);
    }
  }, [dbProjects, projectId, setProjectId]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!sessionId) return;
    
    // Check if we are running in simulated mode
    if (isSimulatedMode) return;

    const host = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = host.replace('http://', 'ws://').replace('https://', 'wss://');
    
    addLog(`Connecting to Agent socket...`);
    const socket = new WebSocket(`${wsUrl}/ws/${sessionId}`);

    socket.onopen = () => {
      addLog(`WebSocket connected for Session #${sessionId}`);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_update') {
          setStep(data.step);
          setLogs(data.logs);
          if (data.state.plan) setPlan(data.state.plan);
          if (data.state.tasks) setTasks(data.state.tasks);
          if (data.state.code_changes) setCodeChanges(data.state.code_changes);
          if (data.state.test_results) setTestResults(data.state.test_results);
          if (data.state.errors) setErrors(data.state.errors);
        } else if (data.type === 'workflow_complete') {
          setStep(data.status === 'success' ? 'completed' : 'failed');
          if (data.logs) {
            setLogs(data.logs);
          }
        }
      } catch (err) {
        console.error("Failed to parse socket payload:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("Socket error:", err);
      addLog("WebSocket connection error. Checking server status...");
    };

    socket.onclose = () => {
      addLog("Agent socket connection closed.");
    };

    return () => {
      socket.close();
    };
  }, [sessionId, isSimulatedMode, setStep, setLogs, setPlan, setTasks, setCodeChanges, setTestResults, setErrors, addLog]);

  // Triggering the Agent Pipeline Run
  const handleStartPipeline = async () => {
    if (!projectId) {
      alert("Please select or create a project first.");
      return;
    }
    if (!prompt.trim()) {
      alert("Please enter a feature description or task.");
      return;
    }

    resetRunState();
    addLog("Sending task command to Backend Orchestrator...");

    try {
      const result = await triggerRunMutation.mutateAsync({
        project_id: projectId,
        prompt: prompt,
        model_name: modelName
      });
      setSessionId(result.session_id);
      setIsSimulatedMode(false);
    } catch (error) {
      console.warn("Backend unavailable. Starting offline visual simulator...", error);
      addLog("Backend API server not reachable. Launching Client-side agent simulator...");
      setIsSimulatedMode(true);
      runClientSimulation();
    }
  };

  // Offline Client Simulation (for visual demo & testing when backend is not run yet)
  const runClientSimulation = async () => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    
    // Step 1: Planner
    setStep('planner');
    setLogs([
      'Client Simulator Mode active.',
      'Initializing Planner Agent node...',
      'Planner Analyzing workspace repositories...',
      'Planner broke down the task into sub-tasks.'
    ]);
    setPlan(`# Roadmap for: ${prompt}\n\n1. Establish Base Services\n2. Add Controller handlers\n3. Set up unit testing suites`);
    setTasks(['1. Create base config models', '2. Implement application business logic', '3. Add pytest automation files']);
    await delay(3000);

    // Step 2: Coder
    setStep('coder');
    addLog('Planner complete. Launching Coder Agent node...');
    addLog('Coder Analyzing repository details...');
    addLog('Coder generating code modifications for src/main.py...');
    setCodeChanges({
      'src/main.py': `def handle_feature():\n    print("Executing requested feature: ${prompt}")\n    return {"status": "success", "data": "simulated_data"}\n\nif __name__ == '__main__':\n    handle_feature()\n`
    });
    await delay(3000);

    // Step 3: Tester
    setStep('tester');
    addLog('Coder complete. Launching Tester Agent node...');
    addLog('Tester starting pytest orchestration runner inside sandbox container...');
    
    if (prompt.toLowerCase().includes('fail')) {
      addLog('TEST FAILURE DETECTED: AssertionError: Expected True but got False.');
      setTestResults({ passed: false, summary: '1 failed, 0 passed', error: 'AssertionError: Expected True but got False' });
      setErrors(['AssertionError: test_feature failed']);
      await delay(3000);
      
      // Self healing back to coder
      setStep('coder');
      addLog('Self-healing Loop: Testing failed. Routing back to Coder Agent node with error logs...');
      addLog('Coder analyzing error logs: AssertionError...');
      addLog('Coder rewriting bug fixes to src/main.py...');
      setCodeChanges({
        'src/main.py': `def handle_feature():\n    # Fixed bug by removing invalid assertion\n    print("Executing requested feature: ${prompt}")\n    return {"status": "success", "data": "simulated_data"}\n`
      });
      await delay(3000);

      // Tester again
      setStep('tester');
      addLog('Retesting corrected codebase...');
      addLog('Tester starting pytest validation inside sandbox container...');
      setTestResults({ passed: true, summary: '2 tests passed' });
      setErrors([]);
    } else {
      setTestResults({ passed: true, summary: '1 test passed successfully' });
    }
    await delay(3000);

    // Step 4: Reviewer
    setStep('reviewer');
    addLog('Tester complete. Launching Reviewer Agent node...');
    addLog('Reviewer examining implementation quality and test coverage reports...');
    addLog('Reviewer: No security flags found. Code style is conformant.');
    await delay(3000);

    // Step 5: Documentation
    setStep('documentation');
    addLog('Reviewer approved changes. Launching Documentation Agent node...');
    addLog('Documentation compiling project manuals...');
    setCodeChanges({
      'src/main.py': codeChanges['src/main.py'] || `def handle_feature():\n    print("Executing requested feature: ${prompt}")\n    return {"status": "success"}\n`,
      'README.md': `# Project Documentation\n\nImplemented feature request: *${prompt}*\n\n## Running the application\n\`\`\`bash\npython src/main.py\n\`\`\`\n`
    });
    addLog('Documentation successfully compiled README.md.');
    await delay(2000);

    setStep('completed');
    addLog('Orchestration pipeline complete. All agents completed successfully!');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const result = await createProjectMutation.mutateAsync({
        name: newProjectName,
        description: newProjectDesc,
        path: newProjectPath
      });
      setProjectId(result.id);
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } catch (err) {
      // Offline fallback for creating projects
      console.warn("Backend unavailable. Mocking project creation...", err);
      const mockProj = {
        id: Date.now(),
        name: newProjectName,
        description: newProjectDesc,
        path: newProjectPath,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setProjectId(mockProj.id);
      dbProjects.push(mockProj);
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
    }
  };

  const activeProject = dbProjects.find(p => p.id === projectId) || (projectId ? {
    id: projectId,
    name: "Mock Project",
    description: "Offline local sandbox project",
    path: "/home/hp/ForgeMind/mock"
  } : null);

  const getStepClass = (nodeStep: string) => {
    if (step === nodeStep) {
      return 'border-[#00f0ff] bg-cyan-950/40 text-cyan-400 scale-105 border-glow-cyan';
    }
    const stepsOrder = ['init', 'planner', 'coder', 'tester', 'reviewer', 'documentation', 'completed'];
    const activeIdx = stepsOrder.indexOf(step);
    const nodeIdx = stepsOrder.indexOf(nodeStep);

    if (activeIdx > nodeIdx || step === 'completed') {
      return 'border-[#00ff66] bg-emerald-950/20 text-emerald-400';
    }
    return 'border-gray-800 bg-gray-900/40 text-gray-400';
  };

  return (
    <div className="flex h-screen overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-gray-900 bg-[#0c0e14] flex flex-col justify-between z-20">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-gray-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-[#bd00ff] to-[#00f0ff]">
              <Cpu className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider bg-gradient-to-r from-white via-gray-300 to-gray-600 bg-clip-text text-transparent">ForgeMind</h1>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Multi-Agent Team</span>
            </div>
          </div>

          {/* Project Switcher */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase text-gray-500 tracking-wider font-semibold font-mono">Workspace Project</span>
              <button 
                onClick={() => setShowNewProjectModal(true)}
                className="p-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
                title="Create Project"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {isLoadingProjects ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading projects...
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {dbProjects.length === 0 && (
                  <div className="p-3 text-xs bg-gray-900/30 border border-dashed border-gray-800 rounded text-gray-400 text-center">
                    No active projects. Click &quot;+&quot; to create one.
                  </div>
                )}
                {dbProjects.map((p: Project) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProjectId(p.id);
                      resetRunState();
                    }}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                      projectId === p.id 
                        ? 'border-cyan-500/50 bg-cyan-950/10 text-cyan-300' 
                        : 'border-gray-900 bg-gray-900/20 text-gray-400 hover:bg-gray-900/40'
                    }`}
                  >
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-500 truncate mt-1">{p.path}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project Details */}
          {activeProject && (
            <div className="px-5 py-2">
              <div className="p-4 rounded-xl glass bg-gray-900/20 space-y-3">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Project Configuration</span>
                <div className="text-xs space-y-1">
                  <div className="text-gray-400">Path:</div>
                  <div className="font-mono text-gray-300 break-all bg-[#090b10] p-1.5 rounded border border-gray-900">{activeProject.path}</div>
                </div>
                {activeProject.description && (
                  <div className="text-xs text-gray-400">
                    <p className="line-clamp-2">{activeProject.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-5 border-t border-gray-900 text-[11px] text-gray-500 font-mono space-y-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isSimulatedMode ? 'bg-amber-400 animate-pulse' : 'bg-[#00ff66]'}`} />
            <span>Mode: {isSimulatedMode ? 'Simulator Mode' : 'Live Engine'}</span>
          </div>
          <div>ForgeMind v1.0.0 Base Build</div>
        </div>
      </aside>

      {/* MAIN LAYOUT */}
      <main className="flex-1 flex flex-col bg-[#060709] overflow-hidden">
        
        {/* HEADER */}
        <header className="h-16 border-b border-gray-900 px-8 flex items-center justify-between z-10 glass">
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-gray-400">Pipeline State:</span>
            {step === 'idle' ? (
              <span className="text-xs bg-gray-900 border border-gray-800 text-gray-400 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-500" /> IDLE
              </span>
            ) : step === 'completed' ? (
              <span className="text-xs bg-emerald-950/30 border border-emerald-900 text-emerald-400 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> SUCCESS
              </span>
            ) : step === 'failed' ? (
              <span className="text-xs bg-red-950/30 border border-red-900 text-red-400 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" /> FAILED
              </span>
            ) : (
              <span className="text-xs bg-cyan-950/30 border border-cyan-900 text-cyan-400 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> EXECUTING ({step.toUpperCase()})
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">Local LLM:</span>
              <select 
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="phi-4">Phi 4 (Planning)</option>
                <option value="qwen3-coder">Qwen3-Coder (Coding)</option>
                <option value="deepseek-coder">DeepSeek-Coder (Debug)</option>
                <option value="llama3">Llama 3 (Reasoning)</option>
                <option value="gemma">Gemma (Docs)</option>
              </select>
            </div>
          </div>
        </header>

        {/* WORKSPACE PANELS CONTAINER */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          
          {/* LEFT: PROMPT INPUT & PIPELINE STATUS */}
          <div className="col-span-8 flex flex-col border-r border-gray-900 overflow-y-auto p-6 space-y-6">
            
            {/* Task Prompt Area */}
            <div className="glass-panel p-5 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold tracking-wider text-gray-300 uppercase font-mono flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#00f0ff]" /> Trigger Agent Workflow
              </h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the software feature or task you want to build (e.g. 'Create a REST API client to query weather forecasts' or 'Add tests to check database connections' - type 'fail' to test the self-healing loop!)"
                className="w-full h-24 bg-[#090b10] border border-gray-800 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-gray-600 resize-none font-sans"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-500">
                  Runs locally in isolated execution containers.
                </span>
                <button
                  onClick={handleStartPipeline}
                  disabled={step !== 'idle' && step !== 'completed' && step !== 'failed'}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    step !== 'idle' && step !== 'completed' && step !== 'failed'
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#bd00ff] to-[#00f0ff] hover:brightness-110 text-black shadow-lg shadow-cyan-900/10'
                  }`}
                >
                  {step !== 'idle' && step !== 'completed' && step !== 'failed' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing workflow...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-black" /> Run Agent Team
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* PIPELINE LIVE DIAGRAM FLOW */}
            <div className="glass-panel p-6 rounded-xl space-y-6 flex flex-col justify-center">
              <h2 className="text-sm font-semibold tracking-wider text-gray-300 uppercase font-mono flex items-center gap-2">
                <Network className="h-4 w-4 text-[#bd00ff]" /> Live Orchestration pipeline
              </h2>

              <div className="grid grid-cols-5 gap-3 relative py-4 items-center">
                
                {/* Horizontal dotted connector lines in background */}
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-[#bd00ff]/20 to-[#00f0ff]/20 -translate-y-1/2 z-0" />

                {/* Node 1: Planner */}
                <div className={`z-10 flex flex-col items-center p-3 rounded-lg border transition-all duration-500 ${getStepClass('planner')}`}>
                  <div className="p-2 rounded bg-gray-900/50 mb-2 border border-gray-800">
                    <Layers className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-mono font-bold">Planner</span>
                  <span className="text-[9px] text-gray-500 mt-1">phi-4</span>
                </div>

                {/* Node 2: Coder */}
                <div className={`z-10 flex flex-col items-center p-3 rounded-lg border transition-all duration-500 ${getStepClass('coder')}`}>
                  <div className="p-2 rounded bg-gray-900/50 mb-2 border border-gray-800">
                    <Code className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-mono font-bold">Coder</span>
                  <span className="text-[9px] text-gray-500 mt-1">qwen3</span>
                </div>

                {/* Node 3: Tester (With Loop back to Coder) */}
                <div className={`z-10 flex flex-col items-center p-3 rounded-lg border transition-all duration-500 relative ${getStepClass('tester')}`}>
                  <div className="p-2 rounded bg-gray-900/50 mb-2 border border-gray-800">
                    <Shield className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-mono font-bold">Tester</span>
                  <span className="text-[9px] text-gray-500 mt-1">deepseek</span>
                  
                  {/* self-healing visual path */}
                  {step === 'tester' && (
                    <div className="absolute -top-3 text-[9px] text-amber-400 font-mono bg-[#0b0c10] border border-amber-900/40 px-1 rounded animate-pulse">
                      Self-healing Loop
                    </div>
                  )}
                </div>

                {/* Node 4: Reviewer */}
                <div className={`z-10 flex flex-col items-center p-3 rounded-lg border transition-all duration-500 ${getStepClass('reviewer')}`}>
                  <div className="p-2 rounded bg-gray-900/50 mb-2 border border-gray-800">
                    <Bot className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-mono font-bold">Reviewer</span>
                  <span className="text-[9px] text-gray-500 mt-1">llama3</span>
                </div>

                {/* Node 5: Documentation */}
                <div className={`z-10 flex flex-col items-center p-3 rounded-lg border transition-all duration-500 ${getStepClass('documentation')}`}>
                  <div className="p-2 rounded bg-gray-900/50 mb-2 border border-gray-800">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-mono font-bold">Docs</span>
                  <span className="text-[9px] text-gray-500 mt-1">gemma</span>
                </div>

              </div>
            </div>

            {/* TAB CONTAINER (CODE GENERATION / PLANS) */}
            <div className="flex-1 flex flex-col min-h-[300px] glass-panel rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-900 bg-gray-900/10 px-4">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-all ${
                    activeTab === 'code' ? 'border-[#00f0ff] text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Generated Files
                </button>
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-all ${
                    activeTab === 'plan' ? 'border-[#00f0ff] text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Architecture Plan
                </button>
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-all ${
                    activeTab === 'tests' ? 'border-[#00f0ff] text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Test Coverage
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto bg-[#07090d]">
                {activeTab === 'code' && (
                  <div className="h-full flex flex-col">
                    {Object.keys(codeChanges).length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-600 text-xs font-mono">
                        <Code className="h-8 w-8 mb-2 opacity-30" />
                        No code generated yet. Run the agents.
                      </div>
                    ) : (
                      <div className="flex-1 grid grid-cols-12 gap-4 h-full">
                        {/* File lists */}
                        <div className="col-span-3 border-r border-gray-900/80 pr-2 space-y-1">
                          {Object.keys(codeChanges).map(f => (
                            <button
                              key={f}
                              onClick={() => setSelectedFile(f)}
                              className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono truncate transition-all ${
                                selectedFile === f 
                                  ? 'bg-gray-800/60 text-cyan-400 border-l-2 border-cyan-400' 
                                  : 'text-gray-400 hover:bg-gray-900/50 hover:text-gray-200'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                        {/* Code preview */}
                        <div className="col-span-9 bg-[#050608] rounded border border-gray-900 p-4 overflow-x-auto relative">
                          <span className="absolute right-3 top-3 text-[9px] font-mono text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded uppercase">
                            {selectedFile.split('.').pop() || 'txt'}
                          </span>
                          <pre className="text-xs font-mono text-gray-300 whitespace-pre">
                            {codeChanges[selectedFile] || 'No file content'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'plan' && (
                  <div className="font-mono text-xs text-gray-300 space-y-4">
                    {plan ? (
                      <div className="bg-[#050608] rounded border border-gray-900 p-4 whitespace-pre-line leading-relaxed">
                        {plan}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                        <FileText className="h-8 w-8 mb-2 opacity-30" />
                        No architecture roadmap compiled.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'tests' && (
                  <div className="font-mono text-xs space-y-4">
                    {testResults ? (
                      <div className={`p-4 rounded border ${
                        testResults.passed 
                          ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-300' 
                          : 'bg-red-950/20 border-red-900/60 text-red-300'
                      }`}>
                        <div className="font-bold flex items-center gap-2 mb-2">
                          {testResults.passed ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                          Status: {testResults.passed ? 'PASSED' : 'FAILED'}
                        </div>
                        <div className="bg-[#050608] p-3 rounded border border-gray-900 text-gray-300 mt-2">
                          <div>{testResults.summary}</div>
                          {testResults.error && (
                            <div className="text-red-400 mt-2 whitespace-pre-wrap">{testResults.error}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                        <Shield className="h-8 w-8 mb-2 opacity-30" />
                        Test execution status unavailable.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT: REAL-TIME CONSOLE TERMINAL LOGS */}
          <div className="col-span-4 flex flex-col bg-[#080a0e] p-5 h-full overflow-hidden relative">
            <div className="flex items-center justify-between pb-3 border-b border-gray-900 mb-4">
              <span className="text-xs font-mono font-semibold tracking-widest text-[#00f0ff] uppercase flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 animate-pulse" /> Agent Execution Console
              </span>
              <button 
                onClick={resetRunState}
                className="p-1 rounded bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
                title="Reset log console"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            {/* Retro Terminal Screen */}
            <div className="flex-1 bg-black/90 rounded-lg border border-gray-950 p-4 overflow-y-auto font-mono text-[11px] text-[#00ff66] scanlines shadow-inner leading-relaxed">
              {logs.length === 0 && (
                <div className="text-gray-600">Console idle. Awaiting command inputs...</div>
              )}
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 mb-1.5 items-start">
                  <span className="text-emerald-800 select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            {/* Diagnostics Panel */}
            <div className="mt-4 p-3 bg-gray-900/20 border border-gray-900 rounded-lg text-[10px] font-mono text-gray-500 space-y-1">
              <div>Backend Engine: {isSimulatedMode ? 'Client Simulator' : 'FastAPI Docker'}</div>
              <div>Websocket Status: {sessionId ? 'Connected' : 'Disconnected'}</div>
              {errors.length > 0 && (
                <div className="text-red-400 mt-2 border-t border-red-950/40 pt-2">
                  <AlertCircle className="h-3 w-3 inline mr-1 text-red-400" />
                  {errors[errors.length - 1]}
                </div>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* NEW PROJECT MODAL */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0e14] border border-gray-800 rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-200 text-sm tracking-wider uppercase font-mono">Create Workspace Project</h3>
              <button 
                onClick={() => setShowNewProjectModal(false)}
                className="text-gray-500 hover:text-gray-300 text-xs"
              >
                Close
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-gray-500">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. WeatherApiClient"
                  className="w-full bg-[#07090d] border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-gray-500">Workspace Directory Path</label>
                <input
                  type="text"
                  required
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  placeholder="Absolute folder path"
                  className="w-full bg-[#07090d] border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-gray-500">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Project purpose..."
                  className="w-full h-16 bg-[#07090d] border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={createProjectMutation.isPending}
                className="w-full bg-gradient-to-r from-[#bd00ff] to-[#00f0ff] hover:brightness-110 text-black py-2 rounded text-xs font-semibold"
              >
                {createProjectMutation.isPending ? 'Configuring workspace...' : 'Initialize Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
