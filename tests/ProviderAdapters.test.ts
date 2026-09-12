import assert from 'node:assert/strict';
import test from 'node:test';
import { ClaudeProvider, OpenAIProvider } from '../src/services/ai/providers/AlternativeProviders';

type PrivateOpenAIProvider = {
  requestText(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<unknown>;
};

type PrivateClaudeProvider = {
  requestText(system: string, userContent: string): Promise<unknown>;
};

test('provider request bodies omit model-sensitive sampling parameters', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  const requestBodies: Record<string, unknown>[] = [];

  globalThis.fetch = async (input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    const isClaude = String(input).includes('anthropic.com');
    const responseBody = isClaude
      ? { content: [{ type: 'text', text: '{}' }] }
      : { choices: [{ message: { content: '{}' } }] };
    return new Response(JSON.stringify(responseBody), { status: 200 });
  };

  try {
    await (new OpenAIProvider() as unknown as PrivateOpenAIProvider).requestText([
      { role: 'user', content: 'test' }
    ]);
    await (new ClaudeProvider() as unknown as PrivateClaudeProvider).requestText('system', 'test');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestBodies.length, 2);
  for (const body of requestBodies) {
    assert.equal('temperature' in body, false);
    assert.equal('top_p' in body, false);
    assert.equal('top_k' in body, false);
  }
});
