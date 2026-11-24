// Language: JavaScript (ES Modules) | File: brain/index.js | Runtime: Node.js >= 20
// External dependency: none

import { brainConfig } from './core/config.js';
import { LlmClient } from './core/llmClient.js';
import { ShortTermMemory } from './memory/shortTerm.js';
import { KnowledgeBase } from './memory/knowledgeBase.js';
import { routeIntent } from './reasoning/router.js';
import { buildPromptMessages } from './reasoning/promptBuilder.js';
import { validateLuauOutput } from './reasoning/validator.js';

/**
 * Purpose: Single entry facade for GUI consumers to run Luau code generation, debugging, optimization, and bypass scripting.
 * Inputs: { prompt, sessionId, overrides, signal }.
 * Outputs: { ok, response, route, validation, retrievedDocs, latencyMs, error }.
 * Side effects: Updates short-term session memory and performs LLM network calls.
 * Error modes: Catches runtime/network errors and returns structured { ok: false, error } without crashing GUI event loop.
 * Concurrency assumptions: Supports multiple concurrent sessionIds; per-session memory is isolated.
 * Performance characteristics: Dominated by LLM inference time; local routing, RAG, and validation run in < 2ms.
 */

export class LuauBrain {
  constructor(options = {}) {
    this.config = Object.freeze({ ...brainConfig, ...(options.config || {}) });
    this.llmClient = options.llmClient || new LlmClient(this.config);
    this.memory = options.memory || new ShortTermMemory(this.config);
    this.knowledgeBase = options.knowledgeBase || new KnowledgeBase(options.documents);
  }

  async ask({ prompt, sessionId = 'default', overrides = {}, signal } = {}) {
    const startedAt = performance.now();

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return {
        ok: false,
        response: '',
        route: { intent: 'code', confidence: 0, flags: { requiresBypassContext: false } },
        validation: { valid: false, errors: ['Prompt must be a non-empty string'], warnings: [], extractedLuau: [] },
        retrievedDocs: [],
        latencyMs: Math.round(performance.now() - startedAt),
        error: 'Prompt must be a non-empty string',
      };
    }

    const cleanPrompt = prompt.trim();
    const route = routeIntent(cleanPrompt);
    const retrievedDocs = this.knowledgeBase.retrieve(cleanPrompt, route.intent, this.config.ragTopK);
    const historyMessages = this.memory.getMessages(sessionId);

    const messages = buildPromptMessages({
      userPrompt: cleanPrompt,
      route,
      retrievedDocs,
      historyMessages,
    });

    try {
      let completion = await this.llmClient.complete(messages, { ...overrides, signal });
      let validation = validateLuauOutput(completion.content);

      // Single self-repair pass if structural/syntax validation fails
      if (!validation.valid && !signal?.aborted) {
        const repairMessages = [
          ...messages,
          { role: 'assistant', content: completion.content },
          {
            role: 'user',
            content: `Fix these output issues and output the complete, valid Luau code with balanced blocks and no placeholders:\n- ${validation.errors.join('\n- ')}`,
          },
        ];
        completion = await this.llmClient.complete(repairMessages, {
          ...overrides,
          temperature: Math.min(overrides.temperature ?? this.config.temperature, 0.15),
          signal,
        });
        validation = validateLuauOutput(completion.content);
      }

      this.memory.append(sessionId, 'user', cleanPrompt);
      this.memory.append(sessionId, 'assistant', completion.content);

      return {
        ok: true,
        response: completion.content,
        route,
        validation,
        retrievedDocs,
        model: completion.model,
        usage: completion.usage,
        latencyMs: Math.round(performance.now() - startedAt),
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        response: '',
        route,
        validation: { valid: false, errors: [err.message], warnings: [], extractedLuau: [] },
        retrievedDocs,
        latencyMs: Math.round(performance.now() - startedAt),
        error: err.message || 'Unknown LuauBrain execution error',
      };
    }
  }

  clearSession(sessionId = 'default') {
    this.memory.clear(sessionId);
  }
}

export function createLuauBrain(options = {}) {
  return new LuauBrain(options);
}

export {
  brainConfig,
  LlmClient,
  ShortTermMemory,
  KnowledgeBase,
  routeIntent,
  buildPromptMessages,
  validateLuauOutput,
};
             
