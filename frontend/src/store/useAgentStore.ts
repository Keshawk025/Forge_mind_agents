import { create } from 'zustand';

interface AgentState {
  projectId: number | null;
  sessionId: number | null;
  step: 'idle' | 'init' | 'planner' | 'coder' | 'tester' | 'reviewer' | 'documentation' | 'completed' | 'failed';
  logs: string[];
  plan: string;
  tasks: string[];
  codeChanges: Record<string, string>;
  testResults: Record<string, unknown> | null;
  errors: string[];
  prompt: string;
  modelName: string;
  
  setProjectId: (id: number | null) => void;
  setSessionId: (id: number | null) => void;
  setStep: (step: AgentState['step']) => void;
  addLog: (log: string) => void;
  setLogs: (logs: string[]) => void;
  setPlan: (plan: string) => void;
  setTasks: (tasks: string[]) => void;
  setCodeChanges: (changes: Record<string, string>) => void;
  setTestResults: (results: Record<string, unknown> | null) => void;
  setErrors: (errors: string[]) => void;
  setPrompt: (prompt: string) => void;
  setModelName: (model: string) => void;
  resetRunState: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  projectId: null,
  sessionId: null,
  step: 'idle',
  logs: [],
  plan: '',
  tasks: [],
  codeChanges: {},
  testResults: null,
  errors: [],
  prompt: '',
  modelName: 'phi-4',

  setProjectId: (id) => set({ projectId: id }),
  setSessionId: (id) => set({ sessionId: id }),
  setStep: (step) => set({ step }),
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setLogs: (logs) => set({ logs }),
  setPlan: (plan) => set({ plan }),
  setTasks: (tasks) => set({ tasks }),
  setCodeChanges: (codeChanges) => set({ codeChanges }),
  setTestResults: (testResults) => set({ testResults }),
  setErrors: (errors) => set({ errors }),
  setPrompt: (prompt) => set({ prompt }),
  setModelName: (modelName) => set({ modelName }),
  resetRunState: () => set({
    step: 'idle',
    logs: ['Ready to build.'],
    plan: '',
    tasks: [],
    codeChanges: {},
    testResults: null,
    errors: [],
  }),
}));
