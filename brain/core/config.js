// Language: JavaScript (ES Modules) | File: brain/core/config.js | Runtime: Node.js >= 20
// External dependency: none (reads process.env directly; zero runtime overhead)

import { freeze } from 'node:object';

/**
 * Purpose: Centralized, immutable configuration for the Luau brain runtime.
 * Inputs: Environment variables (LLM_PROVIDER, LLM_ENDPOINT, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS, CONTEXT_MAX_CHARS).
 * Outputs: Frozen configuration object.
 * Side effects: None.
 * Error modes: Throws explicit RangeError or TypeError on invalid numeric bounds.
 * Concurrency assumptions: Immutable object safe across concurrent async calls.
 * Performance characteristics: O(1) property lookup, zero allocation after module load.
 */

function parseBoundedNumber(rawValue, fallback, min, max, fieldName) {
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`Invalid ${fieldName}: expected finite number in [${min}, ${max}], got "${rawValue}"`);
  }
  return parsed;
}

const provider = (process.env.LLM_PROVIDER || 'openai-compatible').toLowerCase();
const endpoint = (process.env.LLM_ENDPOINT || 'http://127.0.0.1:11434/v1/chat/completions').replace(/\/+$/, '');
const model = process.env.LLM_MODEL || 'qwen2.5-coder:32b';

export const brainConfig = Object.freeze({
  provider,
  endpoint,
  apiKey: process.env.LLM_API_KEY || '',
  model,
  temperature: parseBoundedNumber(process.env.LLM_TEMPERATURE, 0.2, 0, 2, 'LLM_TEMPERATURE'),
  maxTokens: parseBoundedNumber(process.env.LLM_MAX_TOKENS, 4096, 64, 32768, 'LLM_MAX_TOKENS'),
  requestTimeoutMs: parseBoundedNumber(process.env.LLM_TIMEOUT_MS, 120000, 1000, 600000, 'LLM_TIMEOUT_MS'),
  maxRetries: parseBoundedNumber(process.env.LLM_MAX_RETRIES, 2, 0, 5, 'LLM_MAX_RETRIES'),
  shortTermMaxMessages: parseBoundedNumber(process.env.SHORT_TERM_MAX_MESSAGES, 24, 2, 200, 'SHORT_TERM_MAX_MESSAGES'),
  shortTermMaxChars: parseBoundedNumber(process.env.SHORT_TERM_MAX_CHARS, 48000, 1000, 400000, 'SHORT_TERM_MAX_CHARS'),
  ragTopK: parseBoundedNumber(process.env.RAG_TOP_K, 4, 1, 16, 'RAG_TOP_K'),
});
