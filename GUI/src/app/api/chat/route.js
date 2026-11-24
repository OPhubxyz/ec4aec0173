// Language: JavaScript (Next.js Route Handler) | File: GUI/src/app/api/chat/route.js | Runtime: Node.js >= 20
// External dependency: none (dynamically imports ../brain/index.js)

import { NextResponse } from 'next/server';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let brainInstancePromise = null;

async function getBrainInstance() {
  if (!brainInstancePromise) {
    brainInstancePromise = (async () => {
      const brainEntryPath = path.resolve(process.cwd(), '..', 'brain', 'index.js');
      const brainModule = await import(pathToFileURL(brainEntryPath).href);
      if (typeof brainModule.createLuauBrain === 'function') {
        return brainModule.createLuauBrain();
      }
      if (brainModule.LuauBrain) {
        return new brainModule.LuauBrain();
      }
      throw new Error('brain/index.js did not export createLuauBrain or LuauBrain');
    })().catch((err) => {
      brainInstancePromise = null;
      throw err;
    });
  }
  return brainInstancePromise;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim()
      ? body.sessionId.trim()
      : 'night-default';

    const brain = await getBrainInstance();

    if (body.action === 'clear') {
      if (typeof brain.clearSession === 'function') {
        brain.clearSession(sessionId);
      }
      return NextResponse.json({ ok: true, cleared: true, sessionId });
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const overrides = body.overrides && typeof body.overrides === 'object' ? body.overrides : {};
    const result = await brain.ask({
      prompt,
      sessionId,
      overrides,
      signal: request.signal,
    });

    if (!result?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.error || 'LuauBrain execution failed',
          route: result?.route,
          validation: result?.validation,
          latencyMs: result?.latencyMs ?? 0,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      response: result.response,
      route: result.route,
      validation: result.validation,
      retrievedDocs: result.retrievedDocs,
      model: result.model,
      usage: result.usage,
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal route error' },
      { status: 500 }
    );
  }
}
