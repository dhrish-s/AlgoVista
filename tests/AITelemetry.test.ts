import assert from 'node:assert/strict';
import test from 'node:test';
import { appendAITelemetry, clearAITelemetry, getAITelemetryEntries } from '../src/services/ai/AITelemetry';

test('keeps only the latest 500 telemetry records and returns defensive copies', () => {
  clearAITelemetry();
  for (let index = 0; index < 505; index += 1) {
    appendAITelemetry({
      timestamp: `2026-01-01T00:00:${String(index).padStart(2, '0')}Z`,
      operation: 'step-generation',
      provider: 'openai',
      model: `model-${index}`,
      latencyMs: index,
      payload: { staticCharacters: index, variableCharacters: 1, totalCharacters: index + 1 },
      outcome: 'success'
    });
  }

  const records = getAITelemetryEntries();
  assert.equal(records.length, 500);
  assert.equal(records[0].model, 'model-5');
  records[0].payload.staticCharacters = -1;
  assert.equal(getAITelemetryEntries()[0].payload.staticCharacters, 5);
  clearAITelemetry();
});
