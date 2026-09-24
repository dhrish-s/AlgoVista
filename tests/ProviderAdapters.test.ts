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

test('solution adapters request structured TypeScript tied to the selected approach', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const problem = {
    title: 'Valid Parentheses',
    statement: 'Validate matching brackets.',
    constraints: ['1 <= s.length <= 100'],
    starterCode: 'function isValid(s: string): boolean {}'
  } as never;
  const approach = {
    id: 'stack',
    name: 'Stack-based Matching',
    explanation: 'Use a stack.',
    complexity: { time: 'O(n)', space: 'O(n)' },
    isOptimal: true
  } as never;
  const responseText = JSON.stringify({
    code: 'function isValid(s: string): boolean {\n  return true;\n}',
    language: 'typescript'
  });
  const originalFetch = globalThis.fetch;
  const bodies: Record<string, any>[] = [];
  globalThis.fetch = async (input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(String(input).includes('anthropic.com')
      ? { content: [{ type: 'text', text: responseText }], stop_reason: 'end_turn' }
      : { choices: [{ message: { content: responseText }, finish_reason: 'stop' }] }
    ), { status: 200 });
  };

  try {
    await new OpenAIProvider().generateSolution(problem, approach);
    await new ClaudeProvider().generateSolution(problem, approach);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(bodies[0].response_format, { type: 'json_object' });
  assert.match(bodies[0].messages[0].content, /complete TypeScript solution/);
  assert.match(bodies[0].messages[1].content, /Stack-based Matching/);
  assert.equal(bodies[1].max_tokens, 4096);
  assert.match(bodies[1].system, /complete TypeScript solution/);
  assert.match(bodies[1].messages[0].content, /Stack-based Matching/);
});

test('OpenAI exposes reported input, output, and cached token usage', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      code: 'function solve(): boolean { return true; }', language: 'typescript'
    }) }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: 120,
      completion_tokens: 30,
      prompt_tokens_details: { cached_tokens: 80 }
    }
  }), { status: 200 });

  try {
    const response = await new OpenAIProvider().generateSolution(
      { title: 'Test', statement: 'Test', constraints: [] } as never,
      { name: 'Approach', explanation: 'Solve it.' } as never
    );
    assert.deepEqual(response.usage, {
      inputTokens: 120,
      outputTokens: 30,
      cacheReadTokens: 80
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Claude exposes reported input, output, cache-read, and cache-write usage', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({
      code: 'function solve(): boolean { return true; }', language: 'typescript'
    }) }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 140,
      output_tokens: 35,
      cache_read_input_tokens: 90,
      cache_creation_input_tokens: 12
    }
  }), { status: 200 });

  try {
    const response = await new ClaudeProvider().generateSolution(
      { title: 'Test', statement: 'Test', constraints: [] } as never,
      { name: 'Approach', explanation: 'Solve it.' } as never
    );
    assert.deepEqual(response.usage, {
      inputTokens: 140,
      outputTokens: 35,
      cacheReadTokens: 90,
      cacheWriteTokens: 12
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenAI requests and returns a structured Python solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      choices: [{
        message: { content: JSON.stringify({ code: 'def is_valid(s: str) -> bool:\n    return bool(s)', language: 'python' }) },
        finish_reason: 'stop'
      }]
    }), { status: 200 });
  };

  try {
    const response = await new OpenAIProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'python' }
    );
    assert.equal(response.data.language, 'python');
    assert.match(response.data.code, /^def is_valid/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestBody?.messages[0].content, /complete Python solution/);
  assert.match(requestBody?.messages[0].content, /four-space indentation/);
  assert.match(requestBody?.messages[0].content, /Do not compress multiple statements/);
  assert.match(requestBody?.messages[1].content, /Requested language: Python/);
});

test('OpenAI requests and returns a structured C++ solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      code: 'class Solution {\npublic:\n  bool isValid(string s) { return true; }\n};', language: 'cpp'
    }) }, finish_reason: 'stop' }] }), { status: 200 });
  };
  try {
    const response = await new OpenAIProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'cpp' }
    );
    assert.equal(response.data.language, 'cpp');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.messages[0].content, /complete C\+\+ solution/);
  assert.match(requestBody?.messages[0].content, /C\+\+17 conventions/);
  assert.match(requestBody?.messages[0].content, /Do not include an unnecessary main/);
  assert.match(requestBody?.messages[1].content, /Requested language: C\+\+/);
});

test('OpenAI requests and returns a structured Java solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      code: 'class Solution {\n  public boolean isValid(String s) { return true; }\n}', language: 'java'
    }) }, finish_reason: 'stop' }] }), { status: 200 });
  };
  try {
    const response = await new OpenAIProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'java' }
    );
    assert.equal(response.data.language, 'java');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.messages[0].content, /complete Java solution/);
  assert.match(requestBody?.messages[0].content, /explicit Java types/);
  assert.match(requestBody?.messages[0].content, /Do not include an unnecessary runner/);
  assert.match(requestBody?.messages[1].content, /Requested language: Java/);
});

test('OpenAI requests and returns a structured C solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      code: 'bool isValid(char *s) {\n  return s[0] != 0;\n}', language: 'c'
    }) }, finish_reason: 'stop' }] }), { status: 200 });
  };
  try {
    const response = await new OpenAIProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'c' }
    );
    assert.equal(response.data.language, 'c');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.messages[0].content, /complete C solution/);
  assert.match(requestBody?.messages[0].content, /C11-style functions/);
  assert.match(requestBody?.messages[0].content, /memory handling explicitly/);
  assert.match(requestBody?.messages[0].content, /Do not use C\+\+ constructs/);
  assert.match(requestBody?.messages[1].content, /Requested language: C/);
});

test('OpenAI requests and returns a structured Ruby solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      code: 'def is_valid(s)\n  !s.empty?\nend', language: 'ruby'
    }) }, finish_reason: 'stop' }] }), { status: 200 });
  };
  try {
    const response = await new OpenAIProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'ruby' }
    );
    assert.equal(response.data.language, 'ruby');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.messages[0].content, /complete Ruby solution/);
  assert.match(requestBody?.messages[0].content, /conventional Ruby def and end/);
  assert.match(requestBody?.messages[0].content, /Array as a stack with push and pop/);
  assert.match(requestBody?.messages[1].content, /Requested language: Ruby/);
});

test('Claude requests and returns a structured Python solution', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({ code: 'class Solution:\n    def isValid(self, s: str) -> bool:\n        return bool(s)', language: 'python' })
      }],
      stop_reason: 'end_turn'
    }), { status: 200 });
  };

  try {
    const response = await new ClaudeProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'python' }
    );
    assert.equal(response.data.language, 'python');
    assert.match(response.data.code, /^class Solution:/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestBody?.system, /complete Python solution/);
  assert.match(requestBody?.system, /four-space indentation/);
  assert.match(requestBody?.system, /Do not compress multiple statements/);
  assert.match(requestBody?.messages[0].content, /Requested language: Python/);
});

test('Claude requests and returns a structured C++ solution', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      code: 'class Solution {\npublic:\n  bool isValid(string s) { return true; }\n};', language: 'cpp'
    }) }], stop_reason: 'end_turn' }), { status: 200 });
  };
  try {
    const response = await new ClaudeProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'cpp' }
    );
    assert.equal(response.data.language, 'cpp');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.system, /complete C\+\+ solution/);
  assert.match(requestBody?.system, /C\+\+17 conventions/);
  assert.match(requestBody?.system, /Do not include an unnecessary main/);
  assert.match(requestBody?.messages[0].content, /Requested language: C\+\+/);
});

test('Claude requests and returns a structured Java solution', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      code: 'class Solution {\n  public boolean isValid(String s) { return true; }\n}', language: 'java'
    }) }], stop_reason: 'end_turn' }), { status: 200 });
  };
  try {
    const response = await new ClaudeProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'java' }
    );
    assert.equal(response.data.language, 'java');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.system, /complete Java solution/);
  assert.match(requestBody?.system, /explicit Java types/);
  assert.match(requestBody?.system, /Do not include an unnecessary runner/);
  assert.match(requestBody?.messages[0].content, /Requested language: Java/);
});

test('Claude requests and returns a structured C solution', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      code: 'bool isValid(char *s) {\n  return s[0] != 0;\n}', language: 'c'
    }) }], stop_reason: 'end_turn' }), { status: 200 });
  };
  try {
    const response = await new ClaudeProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'c' }
    );
    assert.equal(response.data.language, 'c');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.system, /complete C solution/);
  assert.match(requestBody?.system, /C11-style functions/);
  assert.match(requestBody?.system, /memory handling explicitly/);
  assert.match(requestBody?.system, /Do not use C\+\+ constructs/);
  assert.match(requestBody?.messages[0].content, /Requested language: C/);
});

test('Claude requests and returns a structured Ruby solution', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      code: 'def is_valid(s)\n  !s.empty?\nend', language: 'ruby'
    }) }], stop_reason: 'end_turn' }), { status: 200 });
  };
  try {
    const response = await new ClaudeProvider().generateSolution(
      { title: 'Valid Parentheses', statement: 'Validate brackets.', constraints: [] } as never,
      { name: 'Stack', explanation: 'Use a stack.' } as never,
      { solutionLanguage: 'ruby' }
    );
    assert.equal(response.data.language, 'ruby');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestBody?.system, /complete Ruby solution/);
  assert.match(requestBody?.system, /conventional Ruby def and end/);
  assert.match(requestBody?.system, /Array as a stack with push and pop/);
  assert.match(requestBody?.messages[0].content, /Requested language: Ruby/);
});

test('Claude reports solution truncation before parsing incomplete code JSON', async () => {
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'text', text: '{"code":"function unfinished' }],
    stop_reason: 'max_tokens'
  }), { status: 200 });

  try {
    await assert.rejects(
      new ClaudeProvider().generateSolution(
        { title: 'Test', statement: 'Test', constraints: [] } as never,
        { name: 'Approach', explanation: 'Solve it.' } as never
      ),
      /truncated after reaching the 4,096-token output limit/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenAI reports a length-limited solution response as truncation', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: { content: '{"code":"partial","language":"typescript"}' },
      finish_reason: 'length'
    }]
  }), { status: 200 });

  try {
    await assert.rejects(
      new OpenAIProvider().generateSolution(
        { title: 'Test', statement: 'Test', constraints: [] } as never,
        { name: 'Approach', explanation: 'Solve it.' } as never
      ),
      /truncated after reaching the model output-token limit/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini solution generation uses a strict TypeScript response schema', async () => {
  const provider = new GeminiProvider();
  let request: Record<string, any> | undefined;
  (provider as any).ai = {
    models: {
      generateContent: async (value: Record<string, any>) => {
        request = value;
        return {
          text: JSON.stringify({ code: 'function solve() {\n  return true;\n}', language: 'typescript' }),
          candidates: [{ finishReason: 'STOP' }]
        };
      }
    }
  };

  await provider.generateSolution(
    { title: 'Test', statement: 'Test', constraints: [] } as never,
    { name: 'Stack', explanation: 'Use a stack.' } as never
  );

  assert.match(request?.contents || '', /complete TypeScript solution/);
  assert.deepEqual(request?.config?.responseSchema?.required, ['code', 'language']);
  assert.deepEqual(request?.config?.responseSchema?.properties?.language?.enum, ['typescript']);
});

test('Gemini retains raw SDK responses outside solution generation', async () => {
  const provider = new GeminiProvider();
  const rawResponse = { text: JSON.stringify({
    title: 'Test', statement: 'Test statement', examples: [], constraints: [], approaches: []
  }), usageMetadata: { promptTokenCount: 10 } };
  (provider as any).ai = { models: { generateContent: async () => rawResponse } };

  const response = await provider.parseProblem('Test');

  assert.equal(response.raw, rawResponse);
});

test('Gemini solution generation uses a strict Python response schema', async () => {
  const provider = new GeminiProvider();
  let request: Record<string, any> | undefined;
  (provider as any).ai = {
    models: {
      generateContent: async (value: Record<string, any>) => {
        request = value;
        return {
          text: JSON.stringify({ code: 'def solve():\n    return True', language: 'python' }),
          candidates: [{ finishReason: 'STOP' }]
        };
      }
    }
  };

  const response = await provider.generateSolution(
    { title: 'Test', statement: 'Test', constraints: [] } as never,
    { name: 'Stack', explanation: 'Use a stack.' } as never,
    { solutionLanguage: 'python' }
  );

  assert.equal(response.data.language, 'python');
  assert.match(request?.contents || '', /complete Python solution/);
  assert.match(request?.contents || '', /four-space indentation/);
  assert.match(request?.contents || '', /Requested language: Python/);
  assert.deepEqual(request?.config?.responseSchema?.required, ['code', 'language']);
  assert.deepEqual(request?.config?.responseSchema?.properties?.language?.enum, ['python']);
});

test('Gemini solution generation uses a strict C++ response schema', async () => {
  const provider = new GeminiProvider();
  let request: Record<string, any> | undefined;
  (provider as any).ai = { models: { generateContent: async (value: Record<string, any>) => {
    request = value;
    return {
      text: JSON.stringify({ code: 'class Solution { public: bool solve() { return true; } };', language: 'cpp' }),
      candidates: [{ finishReason: 'STOP' }]
    };
  } } };
  const response = await provider.generateSolution(
    { title: 'Test', statement: 'Test', constraints: [] } as never,
    { name: 'Stack', explanation: 'Use a stack.' } as never,
    { solutionLanguage: 'cpp' }
  );
  assert.equal(response.data.language, 'cpp');
  assert.match(request?.contents || '', /C\+\+17 conventions/);
  assert.match(request?.contents || '', /Requested language: C\+\+/);
  assert.deepEqual(request?.config?.responseSchema?.properties?.language?.enum, ['cpp']);
});

test('Gemini solution generation uses a strict Java response schema', async () => {
  const provider = new GeminiProvider();
  let request: Record<string, any> | undefined;
  (provider as any).ai = { models: { generateContent: async (value: Record<string, any>) => {
    request = value;
    return {
      text: JSON.stringify({ code: 'class Solution { public boolean solve() { return true; } }', language: 'java' }),
      candidates: [{ finishReason: 'STOP' }]
    };
  } } };
  const response = await provider.generateSolution(
    { title: 'Test', statement: 'Test', constraints: [] } as never,
    { name: 'Stack', explanation: 'Use a stack.' } as never,
    { solutionLanguage: 'java' }
  );
  assert.equal(response.data.language, 'java');
  assert.match(request?.contents || '', /explicit Java types/);
  assert.match(request?.contents || '', /Requested language: Java/);
  assert.deepEqual(request?.config?.responseSchema?.properties?.language?.enum, ['java']);
});

test('Gemini solution generation uses a strict C response schema', async () => {
  const provider = new GeminiProvider();
  let request: Record<string, any> | undefined;
  (provider as any).ai = { models: { generateContent: async (value: Record<string, any>) => {
    request = value;
    return {
      text: JSON.stringify({ code: 'bool solve(void) { return true; }', language: 'c' }),
      candidates: [{ finishReason: 'STOP' }]
    };
  } } };
  const response = await provider.generateSolution(
    { title: 'Test', statement: 'Test', constraints: [] } as never,
    { name: 'Stack', explanation: 'Use a stack.' } as never,
    { solutionLanguage: 'c' }
  );
  assert.equal(response.data.language, 'c');
  assert.match(request?.contents || '', /C11-style functions/);
  assert.match(request?.contents || '', /Do not use C\+\+ constructs/);
  assert.match(request?.contents || '', /Requested language: C/);
  assert.deepEqual(request?.config?.responseSchema?.properties?.language?.enum, ['c']);
});

test('Gemini solution generation uses a strict Ruby response schema', async () => {
  const provider = new GeminiProvider();
  let request: Record<string, any> | undefined;
  (provider as any).ai = { models: { generateContent: async (value: Record<string, any>) => {
    request = value;
    return {
      text: JSON.stringify({ code: 'def solve\n  true\nend', language: 'ruby' }),
      candidates: [{ finishReason: 'STOP' }]
    };
  } } };
  const response = await provider.generateSolution(
    { title: 'Test', statement: 'Test', constraints: [] } as never,
    { name: 'Stack', explanation: 'Use a stack.' } as never,
    { solutionLanguage: 'ruby' }
  );
  assert.equal(response.data.language, 'ruby');
  assert.match(request?.contents || '', /conventional Ruby def and end/);
  assert.match(request?.contents || '', /Array as a stack with push and pop/);
  assert.match(request?.contents || '', /Requested language: Ruby/);
  assert.deepEqual(request?.config?.responseSchema?.properties?.language?.enum, ['ruby']);
});
