import assert from 'node:assert/strict';
import test from 'node:test';
import { AIProviderManager } from '../src/services/ai/AIProviderManager';
import { ClaudeProvider, OpenAIProvider } from '../src/services/ai/providers/AlternativeProviders';
import { GeminiProvider } from '../src/services/ai/providers/GeminiProvider';

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

test('OpenAI and Claude instructions require compact linked-list pointer deltas', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  const requestBodies: Record<string, any>[] = [];
  globalThis.fetch = async (input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    const isClaude = String(input).includes('anthropic.com');
    return new Response(JSON.stringify(isClaude
      ? { content: [{ type: 'text', text: '[]' }] }
      : { choices: [{ message: { content: '[]' } }] }
    ), { status: 200 });
  };

  try {
    const problem = { title: 'Reverse Linked List', statement: 'Reverse a singly linked list.' } as never;
    await new OpenAIProvider().generateSteps(problem, 'Use three pointers.', {});
    await new ClaudeProvider().generateSteps(problem, 'Use three pointers.', {});
  } finally {
    globalThis.fetch = originalFetch;
  }

  const openAIInstructions = requestBodies[0].messages[0].content as string;
  const claudeInstructions = requestBodies[1].system as string;
  for (const instructions of [openAIInstructions, claudeInstructions]) {
    assert.match(instructions, /first linked-list step's visualState must contain linkedListBase/);
    assert.match(instructions, /Every later linked-list step must contain only linkedListDelta/);
    assert.match(instructions, /actual pointer change in nextUpdates/);
    assert.match(instructions, /Represent a cycle by pointing nextId back to an existing node/);
    assert.match(instructions, /visualization state match that step's explanation/);
    assert.match(instructions, /operationType must be one of: init, compare, move-pointer/);
  }
});

test('OpenAI and Claude instructions require compact tree deltas', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  const requestBodies: Record<string, any>[] = [];
  globalThis.fetch = async (input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    const isClaude = String(input).includes('anthropic.com');
    return new Response(JSON.stringify(isClaude
      ? { content: [{ type: 'text', text: '[]' }] }
      : { choices: [{ message: { content: '[]' } }] }
    ), { status: 200 });
  };

  try {
    const problem = { title: 'Validate Binary Search Tree', statement: 'Validate a binary tree.' } as never;
    await new OpenAIProvider().generateSteps(problem, 'Use bounds.', {});
    await new ClaudeProvider().generateSteps(problem, 'Use bounds.', {});
  } finally {
    globalThis.fetch = originalFetch;
  }

  for (const instructions of [
    requestBodies[0].messages[0].content as string,
    requestBodies[1].system as string
  ]) {
    assert.match(instructions, /first tree step's visualState must contain treeBase/);
    assert.match(instructions, /Every later tree step must contain only treeDelta/);
    assert.match(instructions, /must not repeat treeBase or a full tree snapshot/);
    assert.match(instructions, /Use \{\} when a step changes no tree visualization fields/);
  }
});

test('OpenAI and Claude instructions require compact graph deltas', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  const requestBodies: Record<string, any>[] = [];
  globalThis.fetch = async (input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    const isClaude = String(input).includes('anthropic.com');
    return new Response(JSON.stringify(isClaude
      ? { content: [{ type: 'text', text: '[]' }] }
      : { choices: [{ message: { content: '[]' } }] }
    ), { status: 200 });
  };

  try {
    const problem = { title: 'Find if Path Exists in Graph', statement: 'Find a path.' } as never;
    await new OpenAIProvider().generateSteps(problem, 'Use BFS.', {});
    await new ClaudeProvider().generateSteps(problem, 'Use BFS.', {});
  } finally {
    globalThis.fetch = originalFetch;
  }

  for (const instructions of [
    requestBodies[0].messages[0].content as string,
    requestBodies[1].system as string
  ]) {
    assert.match(instructions, /first graph step's visualState must contain graphBase/);
    assert.match(instructions, /Every later graph step must contain only graphDelta/);
    assert.match(instructions, /newly visited nodes, newly traversed edges/);
    assert.match(instructions, /Cycles and disconnected components are valid/);
    assert.doesNotMatch(instructions, /graph.*rootId/i);
  }
});

test('OpenAI and Claude instructions require compact DP table deltas', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

  const originalFetch = globalThis.fetch;
  const requestBodies: Record<string, any>[] = [];
  globalThis.fetch = async (input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    const isClaude = String(input).includes('anthropic.com');
    return new Response(JSON.stringify(isClaude
      ? { content: [{ type: 'text', text: '[]' }] }
      : { choices: [{ message: { content: '[]' } }] }
    ), { status: 200 });
  };

  try {
    const problem = { title: 'Unique Paths', statement: 'Count paths through a grid.' } as never;
    await new OpenAIProvider().generateSteps(problem, 'Fill a DP table.', {});
    await new ClaudeProvider().generateSteps(problem, 'Fill a DP table.', {});
  } finally {
    globalThis.fetch = originalFetch;
  }

  for (const instructions of [
    requestBodies[0].messages[0].content as string,
    requestBodies[1].system as string
  ]) {
    assert.match(instructions, /first DP table step's visualState must contain dpTableBase/);
    assert.match(instructions, /Every later DP table step must contain only dpTableDelta/);
    assert.match(instructions, /full row, column, or diagonal/);
    assert.match(instructions, /Do not repeat previously filled cells/);
  }
});

test('Gemini prompt and schema require compact linked-list pointer deltas', async () => {
  process.env.VITE_GEMINI_API_KEY = 'test-gemini-key';

  const requests: any[] = [];
  const provider = new GeminiProvider();
  const privateProvider = provider as unknown as {
    ai: { models: { generateContent: (request: any) => Promise<{ text: string }> } };
  };
  privateProvider.ai.models.generateContent = async (request) => {
    requests.push(request);
    return { text: '[]' };
  };

  await provider.generateSteps(
    { title: 'Linked List Cycle', statement: 'Detect a cycle.' } as never,
    'Use slow and fast pointers.',
    { input: 'head = [3,2,0,-4], pos = 1' }
  );

  assert.equal(requests.length, 1);
  assert.match(requests[0].contents, /first linked-list step's visualState MUST contain linkedListBase/);
  assert.match(requests[0].contents, /Every later linked-list step MUST contain only linkedListDelta/);
  assert.match(requests[0].contents, /CURRENT structure/);
  assert.match(requests[0].contents, /actual pointer change in nextUpdates/);
  assert.match(requests[0].contents, /Represent a cycle by pointing nextId back to an existing node/);
  assert.match(requests[0].contents, /operationType MUST be one of: init, compare, move-pointer/);
  const operationTypes = requests[0].config.responseSchema.items.properties.operationType.enum;
  assert.ok(operationTypes.includes('move-pointer'));
  assert.ok(operationTypes.includes('return'));
  const visualProperties = requests[0].config.responseSchema.items.properties.visualState.properties;
  assert.equal(visualProperties.linkedList, undefined);
  assert.equal(visualProperties.linkedListBase.properties.nodes.items.properties.nextId.nullable, true);
  assert.equal(visualProperties.linkedListBase.properties.headId.nullable, true);
  assert.equal(visualProperties.linkedListDelta.properties.nextUpdates.items.properties.nextId.nullable, true);
  assert.equal(visualProperties.linkedListDelta.properties.activeNodeId.nullable, true);
  assert.ok(visualProperties.linkedListDelta.properties.highlightedNodeIds);
});

test('Gemini prompt and schema require compact tree deltas', async () => {
  process.env.VITE_GEMINI_API_KEY = 'test-gemini-key';

  const requests: any[] = [];
  const provider = new GeminiProvider();
  const privateProvider = provider as unknown as {
    ai: { models: { generateContent: (request: any) => Promise<{ text: string }> } };
  };
  privateProvider.ai.models.generateContent = async (request) => {
    requests.push(request);
    return { text: '[]' };
  };

  await provider.generateSteps(
    { title: 'Validate Binary Search Tree', statement: 'Validate a binary tree.' } as never,
    'Use lower and upper bounds.',
    { input: 'root = [2,1,3]' }
  );

  assert.match(requests[0].contents, /first tree step's visualState MUST contain treeBase/);
  assert.match(requests[0].contents, /Every later tree step MUST contain only treeDelta/);
  const visualProperties = requests[0].config.responseSchema.items.properties.visualState.properties;
  assert.equal(visualProperties.tree, undefined);
  assert.ok(visualProperties.treeBase.properties.nodes);
  assert.equal(visualProperties.treeDelta.properties.activeNodeId.nullable, true);
  assert.equal(visualProperties.treeDelta.properties.rootId.nullable, true);
  assert.ok(visualProperties.treeDelta.properties.updateNodes);
});

test('Gemini prompt and schema require compact graph deltas', async () => {
  process.env.VITE_GEMINI_API_KEY = 'test-gemini-key';

  const requests: any[] = [];
  const provider = new GeminiProvider();
  const privateProvider = provider as unknown as {
    ai: { models: { generateContent: (request: any) => Promise<{ text: string }> } };
  };
  privateProvider.ai.models.generateContent = async (request) => {
    requests.push(request);
    return { text: '[]' };
  };

  await provider.generateSteps(
    { title: 'Course Schedule', statement: 'Detect a directed cycle.' } as never,
    'Use depth-first search with node colors.',
    { input: 'numCourses = 2, prerequisites = [[1,0],[0,1]]' }
  );

  assert.match(requests[0].contents, /first graph step's visualState MUST contain graphBase/);
  assert.match(requests[0].contents, /Every later graph step MUST contain only graphDelta/);
  assert.match(requests[0].contents, /Cycles and disconnected components are valid/);
  const visualProperties = requests[0].config.responseSchema.items.properties.visualState.properties;
  assert.equal(visualProperties.graph, undefined);
  assert.ok(visualProperties.graphBase.properties.nodes);
  assert.ok(visualProperties.graphBase.properties.edges);
  assert.equal(visualProperties.graphDelta.properties.activeNodeId.nullable, true);
  assert.equal(visualProperties.graphDelta.properties.activeEdgeId.nullable, true);
  assert.ok(visualProperties.graphDelta.properties.traverseEdgeIds);
  assert.ok(visualProperties.graphDelta.properties.addEdges);
});

test('Gemini prompt and schema require compact DP table deltas', async () => {
  process.env.VITE_GEMINI_API_KEY = 'test-gemini-key';

  const requests: any[] = [];
  const provider = new GeminiProvider();
  const privateProvider = provider as unknown as {
    ai: { models: { generateContent: (request: any) => Promise<{ text: string }> } };
  };
  privateProvider.ai.models.generateContent = async (request) => {
    requests.push(request);
    return { text: '[]' };
  };

  await provider.generateSteps(
    { title: 'Unique Paths', statement: 'Count paths through a grid.' } as never,
    'Fill a dynamic programming table.',
    { input: 'm = 3, n = 7' }
  );

  assert.match(requests[0].contents, /first DP table step's visualState MUST contain dpTableBase/);
  assert.match(requests[0].contents, /Every later DP table step MUST contain only dpTableDelta/);
  assert.match(requests[0].contents, /Do not repeat previously filled cells/);
  const visualProperties = requests[0].config.responseSchema.items.properties.visualState.properties;
  assert.equal(visualProperties.dpTable, undefined);
  assert.ok(visualProperties.dpTableBase.properties.initialCells);
  assert.ok(visualProperties.dpTableDelta.properties.updates);
  assert.equal(visualProperties.dpTableDelta.properties.activeCell.nullable, true);
  assert.ok(visualProperties.dpTableDelta.properties.highlightedCells);
});
