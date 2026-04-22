import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { StructuredProblem, UserState, ExecutionStep } from '../types';
import { AIProviderID, AIProviderSettings } from '../services/ai/types';

interface AppState {
  // AI Settings
  aiSettings: AIProviderSettings;
  setAISettings: (settings: Partial<AIProviderSettings>) => void;

  // Loading State
  isParsing: boolean;
  parseError: string | null;
  
  // Session State
  currentProblem: StructuredProblem | null;
  currentSteps: ExecutionStep[];
  currentStepIndex: number;
  isGeneratingSteps: boolean;
  stepGenerationError: string | null;
  
  userCode: string;
  userReasoning: string;
  unlockedEditor: boolean;

  // Animation Controls
  playbackSpeed: number;
  isPlaying: boolean;
  
  // Layout State
  panelLayout: number[]; // Store sizes for horizontal panels
  
  // Progress State
  userProgress: UserState;
  
  // Actions
  setParsing: (loading: boolean) => void;
  setParseError: (error: string | null) => void;
  setCurrentProblem: (problem: StructuredProblem | null) => void;
  setUserCode: (code: string) => void;
  setSteps: (steps: ExecutionStep[]) => void;
  setStepIndex: (index: number | ((prev: number) => number)) => void;
  setStepGenerationState: (loading: boolean, error: string | null) => void;
  setUserReasoning: (text: string) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPanelLayout: (layout: number[]) => void;
  unlockEditor: () => void;
  completeProblem: (points: number) => void;
  resetSession: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      aiSettings: {
        defaultProvider: 'gemini',
        modelNames: {
          gemini: 'gemini-3-flash-preview',
          openai: 'gpt-4o',
          claude: 'claude-3-5-sonnet-latest'
        },
        fallbackProvider: 'gemini',
        taskRouting: {
          'parse': 'gemini',
          'steps': 'gemini',
          'coach': 'gemini'
        }
      },
      setAISettings: (settings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...settings }
      })),

      isParsing: false,
      parseError: null,
      
      currentProblem: null,
      currentSteps: [],
      currentStepIndex: -1,
      isGeneratingSteps: false,
      stepGenerationError: null,
      
      userCode: '',
      userReasoning: '',
      unlockedEditor: false,

      playbackSpeed: 1000,
      isPlaying: false,

      panelLayout: [30, 70], // Default: 30% sidebar, 70% content
      
      userProgress: {
        streak: 0,
        totalSolved: 0,
        mastery: [],
        points: 0,
      },

      setParsing: (loading) => set({ isParsing: loading }),
      setParseError: (error) => set({ parseError: error }),
      
      setCurrentProblem: (problem) => set({ 
        currentProblem: problem,
        currentSteps: [],
        currentStepIndex: -1,
        userCode: problem?.starterCode || '',
        userReasoning: '',
        unlockedEditor: false,
        parseError: null,
        stepGenerationError: null
      }),

      setUserCode: (code) => set({ userCode: code }),
      setSteps: (steps) => set({ currentSteps: steps }),
      setStepIndex: (index) => set((state) => ({ 
        currentStepIndex: typeof index === 'function' ? index(state.currentStepIndex) : index 
      })),
      
      setStepGenerationState: (loading, error) => set({ 
        isGeneratingSteps: loading, 
        stepGenerationError: error 
      }),

      setUserReasoning: (text) => set({ userReasoning: text }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setPanelLayout: (layout) => set({ panelLayout: layout }),

      unlockEditor: () => set({ unlockedEditor: true }),

      completeProblem: (points) => set((state) => ({
        userProgress: {
          ...state.userProgress,
          streak: state.userProgress.streak + 1,
          totalSolved: state.userProgress.totalSolved + 1,
          points: state.userProgress.points + points,
        }
      })),

      resetSession: () => set({
        currentProblem: null,
        currentSteps: [],
        currentStepIndex: -1,
        userReasoning: '',
        unlockedEditor: false,
        parseError: null,
        stepGenerationError: null
      }),
    }),
    {
      name: 'algovista-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentProblem: state.currentProblem,
        userCode: state.userCode,
        userReasoning: state.userReasoning,
        unlockedEditor: state.unlockedEditor,
        aiSettings: state.aiSettings,
        panelLayout: state.panelLayout,
        userProgress: state.userProgress,
      }),
    }
  )
);
