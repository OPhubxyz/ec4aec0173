// Language: JavaScript (ES Modules) | File: brain/core/llmClient.js | Runtime: Node.js >= 20
// External dependency: none (uses built-in fetch and AbortController)

import { brainConfig } from './config.js';

/**
 * Purpose: Normalized client for Ollama, vLLM, and OpenAI-compatible chat endpoints.
 * Inputs: messages array ({ role, content }), optional overrides ({ temperature, maxTokens, signal }).
 * Outputs: Normalized result { content, model, usage, latencyMs }.
 * Side effects: Outbound HTTP POST requests to configured LLM endpoint.
 * Error modes: Throws structured errors on HTTP non-2xx, malformed JSON, empty content, or timeout/abort.
 * Concurrency assumptions: Stateless per call; safe for concurrent invocations.
 * Performance characteristics: Network-bound; enforces per-request timeout and exponential backoff on transient 429/5xx.
 */

export class LlmClient {
  constructor(overrides = {}) {
    this.config = Object.freeze({ ...brainConfig, ...overrides });
  }

  #buildPayload(messages, overrides) {
    const payload = {
      model: overrides.model || this.config.model,
      messages,
      temperature: overrides.temperature ?? this.config.temperature,
      max_tokens: overrides.maxTokens ?? this.config.maxTokens,
      stream: false,
    };

    if (this.config.provider === 'ollama') {
      payload.options = {
        temperature: payload.temperature,
        num_predict: payload.max_tokens,
      };
    }

    return payload;
  }

  #buildHeaders(overrides) {
    const key = overrides.apiKey ?? this.config.apiKey;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (key) {
      headers.Authorization = `Bearer ${key}`;
    }
    return headers;
  }

  #extractContent(data) {
    // Supports OpenAI/vLLM chat completions, Ollama /api/chat, and Ollama /v1 compatibility
    if (typeof data?.message?.content === 'string') {
      return data.message.content;
    }
    const choiceMessage = data?.choices?.[0]?.message;
    if (typeof choiceMessage?.content === 'string') {
      return choiceMessage.content;
    }
    if (typeof data?.choices?.[0]?.text === 'string') {
      return data.choices[0].text;
    }
    throw new Error(`LLM response missing text content: ${JSON.stringify(data).slice(0, 400)}`);
  }

  async #postOnce(payload, headers, externalSignal) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('LLM request timed out')), this.config.requestTimeoutMs);

    const onExternalAbort = () => controller.abort(externalSignal.reason || new Error('Request aborted'));
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw controller.signal.reason;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawText = await response.text();
      let parsed;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(`Invalid JSON from LLM endpoint (HTTP ${response.status}): ${rawText.slice(0, 300)}`);
      }

      if (!response.ok) {
        const err = new Error(`LLM HTTP ${response.status}: ${parsed?.error?.message || rawText.slice(0, 300)}`);
        err.status = response.status;
        err.retryable = response.status === 429 || response.status >= 500;
        throw err;
      }

      return parsed;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  async complete(messages, overrides = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new TypeError('messages must be a non-empty array');
    }

    const payload = this.#buildPayload(messages, overrides);
    const headers = this.#buildHeaders(overrides);
    const startedAt = performance.now();

    let attempt = 0;
    while (true) {
      try {
        const rawData = await this.#postOnce(payload, headers, overrides.signal);
        const content = this.#extractContent(rawData).trim();
        if (!content) {
          throw new Error('LLM returned empty response content');
        }

        return {
          content,
          model: rawData?.model || payload.model,
          usage: rawData?.usage || {
            prompt_tokens: rawData?.prompt_eval_count ?? 0,
            completion_tokens: rawData?.eval_count ?? 0,
          },
          latencyMs: Math.round(performance.now() - startedAt),
        };
      } catch (err) {
        const isAbort = err?.name === 'AbortError' || overrides.signal?.aborted;
        const canRetry = !isAbort && Boolean(err?.retryable) && attempt < this.config.maxRetries;
        if (!canRetry) {
          throw err;
        }
        attempt += 1;
        const backoffMs = Math.min(4000, 250 * 2 ** (attempt - 1));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
}
