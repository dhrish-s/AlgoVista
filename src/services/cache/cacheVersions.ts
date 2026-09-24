// Bump when any visualization state or compact delta contract changes.
export const VISUAL_CONTRACT_VERSION = 1;

// Bump when provider instructions or response schemas change.
export const AI_PROMPT_VERSION = 1;

// Bump when parsed problems, generated solutions, or execution traces are validated differently.
export const RESULT_VALIDATOR_VERSION = 1;

// Bump when the IndexedDB record shape or index layout changes.
export const RESULT_CACHE_SCHEMA_VERSION = 1;

export const RESULT_CACHE_VERSIONS = {
  contract: VISUAL_CONTRACT_VERSION,
  prompt: AI_PROMPT_VERSION,
  validator: RESULT_VALIDATOR_VERSION,
  schema: RESULT_CACHE_SCHEMA_VERSION
} as const;
