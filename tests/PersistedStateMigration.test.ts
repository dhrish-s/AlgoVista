import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultModelNames } from '../src/services/ai/providerConfig';
import {
  ALGOVISTA_STORAGE_VERSION,
  migratePersistedState
} from '../src/store/persistedStateMigration';

test('replaces pre-versioned model names while preserving other persisted state', () => {
  const staleState = {
    userCode: 'return answer;',
    panelLayout: [35, 65],
    aiSettings: {
      defaultProvider: 'claude',
      fallbackProvider: 'openai',
      taskRouting: { parse: 'claude', steps: 'claude', coach: 'claude' },
      modelNames: {
        gemini: 'saved-gemini-model',
        openai: 'saved-openai-model',
        claude: 'claude-sonnet-4-20250514'
      }
    }
  };

  const migrated = migratePersistedState(staleState, 0) as typeof staleState;

  assert.deepEqual(migrated.aiSettings.modelNames, getDefaultModelNames());
  assert.equal(migrated.aiSettings.defaultProvider, 'claude');
  assert.equal(migrated.aiSettings.fallbackProvider, 'openai');
  assert.deepEqual(migrated.aiSettings.taskRouting, staleState.aiSettings.taskRouting);
  assert.equal(migrated.userCode, staleState.userCode);
  assert.deepEqual(migrated.panelLayout, staleState.panelLayout);
});

test('leaves settings written by the current storage version unchanged', () => {
  const currentState = {
    aiSettings: {
      modelNames: {
        gemini: 'custom-gemini-model',
        openai: 'custom-openai-model',
        claude: 'custom-claude-model'
      }
    }
  };

  assert.equal(
    migratePersistedState(currentState, ALGOVISTA_STORAGE_VERSION),
    currentState
  );
});
