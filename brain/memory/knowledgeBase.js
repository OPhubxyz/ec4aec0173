// Language: JavaScript (ES Modules) | File: brain/memory/knowledgeBase.js | Runtime: Node.js >= 20
// External dependency: none (deterministic token-overlap + tag-weighted BM25-style scoring)

import { brainConfig } from '../core/config.js';

/**
 * Purpose: Long-term knowledge store and retrieval engine for Luau idioms, executor APIs, hooks, and anti-cheat bypass patterns.
 * Inputs: Query string, intent string, optional topK override.
 * Outputs: Ranked array of reference entries { id, title, tags, snippet, score }.
 * Side effects: None during retrieval; addDocument/bulkLoad mutate in-memory index.
 * Error modes: Handles empty queries or non-matching corpora gracefully by returning empty or fallback entries.
 * Concurrency assumptions: Read-heavy; safe for concurrent queries when corpus is static.
 * Performance characteristics: O(D * T) linear scan over D documents and T query tokens; sub-millisecond for < 2,000 docs.
 */

const BUILTIN_LUAU_CORPUS = [
  {
    id: 'luau-hookmetamethod',
    title: 'Luau Metamethod Hooking & Namecall Guarding',
    tags: ['hookmetamethod', '__namecall', '__index', 'anticheat', 'bypass', 'executor', 'luau'],
    content: [
      'Use hookmetamethod(game, "__namecall", newcclosure(...)) with checkcaller() guards when intercepting RemoteEvent/RemoteFunction calls.',
      'Cache original metamethod reference before hooking; restore or pass through via return oldNamecall(self, ...) preserving varargs.',
      'Filter spoofed telemetry remotes early by checking getnamecallmethod() against expected method names ("FireServer", "InvokeServer").',
    ].join('\n'),
  },
  {
    id: 'luau-gc-remotes',
    title: 'Scanning Upvalues, Closures, and Remote Table References via GC',
    tags: ['getgc', 'getupvalues', 'getconstants', 'remotes', 'deobfuscate', 'bypass', 'luau'],
    content: [
      'Iterate getgc(true) to locate hidden tables, closures, or RemoteEvent/RemoteFunction instances not exposed in standard hierarchy paths.',
      'Inspect closures with debug.getupvalues / debug.getconstants to identify anti-cheat check loops or validation keys without guessing names.',
      'Wrap GC scans in pcall and deduplicate instances by reference identity.',
    ].join('\n'),
  },
  {
    id: 'luau-signal-connections',
    title: 'ScriptConnection Inspection, Disabling, and Loop Neutralization',
    tags: ['getconnections', 'task.spawn', 'heartbeat', 'renderstepped', 'anticheat', 'bypass', 'luau'],
    content: [
      'Use getconnections(signal) on suspicious signals (e.g., CharacterAdded, ChildAdded, RunService.Heartbeat) to inspect or :Disable() callbacks.',
      'Verify function environments with getfenv(conn.Function) before disabling so legitimate gameplay systems remain intact.',
      'Keep executor loops paced with task.wait() or RunService.Heartbeat and isolate state inside a clean table namespace.',
    ].join('\n'),
  },
  {
    id: 'luau-strict-types-oop',
    title: 'Strict Luau Type Annotations, Buffers, and Zero-Leak Cleanup',
    tags: ['luau', 'strict', 'type', 'buffer', 'table.freeze', 'cleanup', 'module', 'debug'],
    content: [
      '--!strict enforces type checking on tables, unions, and optional fields.',
      'Use table.clear(t) and disconnect RBXScriptConnections inside a deterministic :Destroy() method to prevent memory leaks across respawns.',
      'Prefer task.cancel() for tracked thread handles rather than relying on orphaned coroutines.',
    ].join('\n'),
  },
  {
    id: 'luau-cframe-movement',
    title: 'Deterministic Character Physics & CFrame Manipulation in Luau',
    tags: ['cframe', 'humanoid', 'assemblylinearvelocity', 'noclip', 'teleport', 'luau', 'optimize'],
    content: [
      'Resolve Humanoid and BasePart safely via FindFirstChildWhichIsA("Humanoid") and RootPart before mutating AssemblyLinearVelocity or CFrame.',
      'When anchoring or setting CFrame per frame, reconcile velocity so physics solvers do not apply residual impulses.',
      'Cache service references (Players, RunService, Workspace, UserInputService) at top-level rather than calling game:GetService inside hot loops.',
    ].join('\n'),
  },
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export class KnowledgeBase {
  constructor(initialDocs = BUILTIN_LUAU_CORPUS) {
    this.documents = [];
    this.bulkLoad(initialDocs);
  }

  addDocument(doc) {
    if (!doc || typeof doc.content !== 'string' || doc.content.trim().length === 0) {
      throw new TypeError('Knowledge document requires non-empty content');
    }
    const id = String(doc.id || `doc-${this.documents.length + 1}`);
    const title = String(doc.title || id);
    const tags = Array.isArray(doc.tags) ? doc.tags.map((t) => String(t).toLowerCase()) : [];
    const content = doc.content.trim();
    const corpusTokens = new Set([...tokenize(title), ...tokenize(content), ...tags]);

    const entry = { id, title, tags, content, corpusTokens };
    const existingIndex = this.documents.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      this.documents[existingIndex] = entry;
    } else {
      this.documents.push(entry);
    }
    return entry;
  }

  bulkLoad(docs) {
    if (!Array.isArray(docs)) {
      throw new TypeError('docs must be an array');
    }
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  retrieve(query, intent = 'code', topK = brainConfig.ragTopK) {
    const queryTokens = tokenize(`${query} ${intent}`);
    if (queryTokens.length === 0 || this.documents.length === 0) {
      return [];
    }

    const scored = this.documents.map((doc) => {
      let score = 0;
      for (const token of queryTokens) {
        if (doc.tags.includes(token)) {
          score += 3;
        }
        if (doc.corpusTokens.has(token)) {
          score += 1.5;
        }
        if (doc.content.toLowerCase().includes(token)) {
          score += 0.5;
        }
      }
      if (doc.tags.includes(String(intent).toLowerCase())) {
        score += 2;
      }
      return {
        id: doc.id,
        title: doc.title,
        tags: doc.tags,
        content: doc.content,
        score: Number(score.toFixed(2)),
      };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));
  }
}
