import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { StructuredProblem, UserState, ExecutionStep } from '../types';
import { AIProviderID, AIProviderSettings, SolutionLanguage } from '../services/ai/types';
import { DEFAULT_SOLUTION_LANGUAGE } from '../services/ai/solutionLanguages';
import { getDefaultFallbackProvider, getDefaultModelNames, getDefaultProvider } from '../services/ai/providerConfig';
import { ALGOVISTA_STORAGE_VERSION, migratePersistedState } from './persistedStateMigration';

interface AppState {
  // AI Settings
  aiSettings: AIProviderSettings;
  setAISettings: (settings: Partial<AIProviderSettings>) => void;

  // Loading State
  isParsing: boolean;
  parseError: string | null;
  parseConfidence: number; // 0 to 1
  
  // Session State
  currentProblem: StructuredProblem | null;
  currentSteps: ExecutionStep[];
  currentStepIndex: number;
  isGeneratingSteps: boolean;
  stepGenerationError: string | null;
  stepTruncated: boolean;
  currentProvider: string;
  providerStatus: 'success' | 'failed' | 'fallback' | 'unavailable' | 'idle';
  providerMessage: string | null;
  
  userCode: string;
  solutionLanguage: SolutionLanguage;
  idealSolutionCache: Record<string, Partial<Record<SolutionLanguage, string>>>;
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
  setParseConfidence: (confidence: number) => void;
  setCurrentProblem: (problem: StructuredProblem | null) => void;
  setUserCode: (code: string) => void;
  setSolutionLanguage: (language: SolutionLanguage) => void;
  setIdealVisualization: (approachId: string, code: string, steps: ExecutionStep[], language?: SolutionLanguage) => void;
  setSteps: (steps: ExecutionStep[]) => void;
  setStepIndex: (index: number | ((prev: number) => number)) => void;
  setStepGenerationState: (loading: boolean, error: string | null, truncated?: boolean) => void;
  setCurrentProvider: (provider: string) => void;
  setProviderStatus: (status: AppState['providerStatus'], message?: string | null) => void;
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
        defaultProvider: getDefaultProvider(),
        modelNames: getDefaultModelNames(),
        fallbackProvider: getDefaultFallbackProvider(),
        taskRouting: {
          'parse': getDefaultProvider(),
          'steps': getDefaultProvider(),
          'coach': getDefaultProvider()
        }
      },
      setAISettings: (settings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...settings }
      })),

      isParsing: false,
      parseError: null,
      parseConfidence: 0,
      
      currentProblem: null,
      currentSteps: [],
      currentStepIndex: -1,
      isGeneratingSteps: false,
      stepGenerationError: null,
      stepTruncated: false,
      currentProvider: getDefaultProvider(),
      providerStatus: 'idle',
      providerMessage: null,
      
      userCode: '',
      solutionLanguage: DEFAULT_SOLUTION_LANGUAGE,
      idealSolutionCache: {},
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
      setParseConfidence: (confidence) => set({ parseConfidence: Math.max(0, Math.min(1, confidence)) }),
      
      setCurrentProblem: (problem) => set({ 
        currentProblem: problem,
        currentSteps: [],
        currentStepIndex: -1,
        userCode: problem?.starterCode || '',
        idealSolutionCache: {},
        userReasoning: '',
        unlockedEditor: false,
        parseError: null,
        parseConfidence: problem?.parsingConfidence || 1,
        stepGenerationError: null,
        stepTruncated: false
      }),

      setUserCode: (code) => set({ userCode: code }),
      setSolutionLanguage: (solutionLanguage) => set({ solutionLanguage }),
      setIdealVisualization: (approachId, code, steps, language = DEFAULT_SOLUTION_LANGUAGE) => set((state) => ({
        idealSolutionCache: {
          ...state.idealSolutionCache,
          [approachId]: { ...state.idealSolutionCache[approachId], [language]: code }
        },
        userCode: code,
        currentSteps: steps,
        currentStepIndex: steps.length > 0 ? 0 : -1
      })),
      setSteps: (steps) => set({
        currentSteps: steps,
        currentStepIndex: steps.length > 0 ? 0 : -1
      }),
      setStepIndex: (index) => set((state) => ({ 
        currentStepIndex: typeof index === 'function' ? index(state.currentStepIndex) : index 
      })),
      
      setStepGenerationState: (loading, error, truncated = false) => set({ 
        isGeneratingSteps: loading, 
        stepGenerationError: error,
        stepTruncated: truncated
      }),
      setCurrentProvider: (provider) => set({ currentProvider: provider }),
      setProviderStatus: (status, message = null) => set({
        providerStatus: status,
        providerMessage: message
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
        idealSolutionCache: {},
        userReasoning: '',
        unlockedEditor: false,
        parseError: null,
        parseConfidence: 0,
        stepGenerationError: null,
        stepTruncated: false
      }),
    }),
    {
      name: 'algovista-storage',
      version: ALGOVISTA_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => migratePersistedState(persistedState, version) as AppState,
      partialize: (state) => ({
        currentProblem: state.currentProblem,
        userCode: state.userCode,
        userReasoning: state.userReasoning,
        unlockedEditor: state.unlockedEditor,
        aiSettings: state.aiSettings,
        panelLayout: state.panelLayout,
        userProgress: state.userProgress,
        currentProvider: state.currentProvider,
      }),
    }
  )
);
