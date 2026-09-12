import assert from 'node:assert/strict';
import test from 'node:test';
import { AIProviderManager } from '../src/services/ai/AIProviderManager';
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

test('Claude reserves a larger output budget only for execution steps', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  const requestBodies: Record<string, unknown>[] = [];
  let requestCount = 0;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    const text = requestCount++ === 0 ? '{}' : '[]';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 });
  };

  try {
    const provider = new ClaudeProvider();
    await provider.parseProblem('Two Sum');
    await provider.generateSteps({ title: 'Two Sum', statement: 'Find two values.' } as never, 'Use a map.', {});
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestBodies[0].max_tokens, 4096);
  assert.equal(requestBodies[1].max_tokens, 16384);
});

test('Claude reports max-token truncation before parsing partial JSON', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: '[{"id":"unfinished"' }],
    stop_reason: 'max_tokens',
    usage: { output_tokens: 16384 }
  }), { status: 200 });

  try {
    const manager = new AIProviderManager({
      defaultProvider: 'claude',
      fallbackProvider: 'claude',
      modelNames: {
        gemini: 'gemini-3-flash-preview',
        openai: 'gpt-4o-mini',
        claude: 'claude-sonnet-5'
      },
      taskRouting: { steps: 'claude' }
    });

    await assert.rejects(
      manager.generateSteps({}, '', {}, { provider: 'claude', task: 'steps' }),
      /Claude response was truncated after reaching the 16,384-token output limit/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider adapters include structured API error messages in thrown errors', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const provider = String(input).includes('anthropic.com') ? 'Claude' : 'OpenAI';
    return new Response(JSON.stringify({
      error: { message: `${provider} rejected a model-specific parameter.` }
    }), { status: 400 });
  };

  try {
    const openai = new OpenAIProvider() as unknown as PrivateOpenAIProvider;
    const claude = new ClaudeProvider() as unknown as PrivateClaudeProvider;

    await assert.rejects(
      openai.requestText([{ role: 'user', content: 'test' }]),
      /OpenAI rejected a model-specific parameter\./
    );
    await assert.rejects(
      claude.requestText('system', 'test'),
      /Claude rejected a model-specific parameter\./
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider manager preserves structured API details in its final error', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: 'temperature is deprecated for this model' }
  }), { status: 400 });

  try {
    const manager = new AIProviderManager({
      defaultProvider: 'claude',
      fallbackProvider: 'claude',
      modelNames: {
        gemini: 'gemini-3-flash-preview',
        openai: 'gpt-4o-mini',
        claude: 'claude-sonnet-5'
      },
      taskRouting: { parse: 'claude' }
    });

    await assert.rejects(
      manager.parseProblem('Two Sum', { provider: 'claude', task: 'parse' }),
      /temperature is deprecated for this model/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
