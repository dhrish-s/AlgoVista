import { getDefaultModelNames } from '../services/ai/providerConfig';

export const ALGOVISTA_STORAGE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const migratePersistedState = (
  persistedState: unknown,
  persistedVersion: number
): unknown => {
  if (persistedVersion >= ALGOVISTA_STORAGE_VERSION || !isRecord(persistedState)) {
    return persistedState;
  }

  const migratedState = { ...persistedState };
  if (!isRecord(persistedState.aiSettings)) {
    delete migratedState.aiSettings;
    return migratedState;
  }

  migratedState.aiSettings = {
    ...persistedState.aiSettings,
    modelNames: getDefaultModelNames()
  };

  return migratedState;
};
