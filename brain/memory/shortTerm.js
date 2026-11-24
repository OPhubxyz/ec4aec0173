// Language: JavaScript (ES Modules) | File: brain/memory/shortTerm.js | Runtime: Node.js >= 20
// External dependency: none

import { brainConfig } from '../core/config.js';

/**
 * Purpose: Bounded per-session conversation history manager that prunes old turns without overflowing token budgets.
 * Inputs: sessionId, role ('user' | 'assistant'), content string.
 * Outputs: Ordered message arrays suitable for prompt construction.
 * Side effects: Mutates in-memory session maps.
 * Error modes: Rejects invalid roles or non-string content.
 * Concurrency assumptions: Single-process JS event loop; each sessionId maintains isolated history.
 * Performance characteristics: O(N) pruning over session message list where N <= maxMessages; bounded memory via char cap.
 */

const VALID_ROLES = new Set(['user', 'assistant']);

export class ShortTermMemory {
  constructor(options = {}) {
    this.maxMessages = options.maxMessages ?? brainConfig.shortTermMaxMessages;
    this.maxChars = options.maxChars ?? brainConfig.shortTermMaxChars;
    this.sessions = new Map();
  }

  #getOrCreateSession(sessionId) {
    const key = String(sessionId || 'default');
    let list = this.sessions.get(key);
    if (!list) {
      list = [];
      this.sessions.set(key, list);
    }
    return list;
  }

  #prune(list) {
    // Keep most recent turns up to maxMessages
    if (list.length > this.maxMessages) {
      list.splice(0, list.length - this.maxMessages);
    }

    // Enforce character budget from newest to oldest so recent code context survives
    let totalChars = 0;
    let keepFromIndex = list.length;

    for (let i = list.length - 1; i >= 0; i -= 1) {
      const len = list[i].content.length;
      if (totalChars + len > this.maxChars && keepFromIndex < list.length) {
        break;
      }
      totalChars += len;
      keepFromIndex = i;
    }

    if (keepFromIndex > 0) {
      list.splice(0, keepFromIndex);
    }
  }

  append(sessionId, role, content) {
    if (!VALID_ROLES.has(role)) {
      throw new TypeError(`Invalid message role: ${role}`);
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new TypeError('Message content must be a non-empty string');
    }

    const list = this.#getOrCreateSession(sessionId);
    list.push({
      role,
      content: content.trim(),
      timestamp: Date.now(),
    });
    this.#prune(list);
    return this.getMessages(sessionId);
  }

  getMessages(sessionId) {
    const list = this.#getOrCreateSession(sessionId);
    return list.map(({ role, content }) => ({ role, content }));
  }

  clear(sessionId) {
    this.sessions.delete(String(sessionId || 'default'));
  }
}
