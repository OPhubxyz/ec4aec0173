// Language: JavaScript (React Client Component) | File: GUI/src/app/page.js | Runtime: Next.js 15 / React 19
// External dependency: none (uses browser fetch, AbortController, localStorage, Clipboard API)

'use client';

import { useEffect, useRef, useState } from 'react';

const SESSION_STORAGE_KEY = 'night_ai_session_id';

function getOrCreateSessionId() {
  if (typeof window === 'undefined') return 'night-default';
  let existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!existing) {
    existing = `night-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, existing);
  }
  return existing;
}

function splitCodeBlocks(rawText) {
  const text = String(rawText || '');
  const segments = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: 'code',
      lang: (match[1] || 'luau').toLowerCase(),
      content: match[2].replace(/\n$/, ''),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

export default function NightAiPage() {
  const [sessionId, setSessionId] = useState('night-default');
  const [messages, setMessages] = useState([
    {
      id: 'boot-msg',
      role: 'assistant',
      content: 'Night AI sẵn sàng. Nhập yêu cầu Luau, hook, bypass anti-cheat, debug hoặc tối ưu hiệu năng.',
      meta: { intent: 'ready', latencyMs: 0 },
    },
  ]);
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleCopy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
    } catch {
      setErrorBanner('Không thể sao chép vào clipboard.');
    }
  }

  async function handleResetSession() {
    if (isLoading) return;
    setErrorBanner(null);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', sessionId }),
      });
    } catch {
      // Ignore network error on local state reset
    }
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: 'assistant',
        content: 'Đã làm mới phiên ngữ cảnh. Sẵn sàng cho lệnh Luau tiếp theo.',
        meta: { intent: 'reset', latencyMs: 0 },
      },
    ]);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setErrorBanner(null);
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          sessionId,
          overrides: {
            temperature: Number(temperature),
            maxTokens: Number(maxTokens),
          },
        }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          meta: {
            intent: data.route?.intent || 'code',
            latencyMs: data.latencyMs ?? 0,
            valid: data.validation?.valid ?? true,
            warnings: data.validation?.warnings || [],
          },
        },
      ]);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const msgText = err?.message || 'Lỗi kết nối tới Brain API.';
      setErrorBanner(msgText);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Lỗi thực thi: ${msgText}`,
          meta: { intent: 'error', latencyMs: 0, valid: false },
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleTextareaChange(e) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  return (
    <div className="flex flex-col h-screen bg-[#050507] text-[#e6e8ee]">
      <header className="flex items-center justify-between px-5 py-3 bg-[#0b0c10] border-b border-[#1e222d] shrink-0">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
          <h1 className="text-base font-semibold tracking-wider uppercase text-zinc-100">
            Night AI
          </h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#14161b] text-zinc-400 border border-[#232734]">
            LUAU WORKSTATION
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <label className="flex items-center gap-1.5 text-zinc-400">
            <span>TEMP</span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-16 px-2 py-1 rounded bg-[#050507] border border-[#232734] text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </label>

          <label className="flex items-center gap-1.5 text-zinc-400">
            <span>MAX</span>
            <input
              type="number"
              step="256"
              min="256"
              max="32768"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="w-20 px-2 py-1 rounded bg-[#050507] border border-[#232734] text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </label>

          <button
            type="button"
            onClick={handleResetSession}
            disabled={isLoading}
            className="px-3 py-1.5 rounded bg-[#14161b] hover:bg-[#1c1f27] disabled:opacity-40 text-zinc-200 border border-[#272c3a] transition-colors"
          >
            Reset Context
          </button>
        </div>
      </header>

      {errorBanner && (
        <div className="px-5 py-2 bg-rose-950/60 border-b border-rose-800/60 text-rose-200 text-xs font-mono flex items-center justify-between">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-300 hover:text-white ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
        <div className="max-w-5xl mx-auto space-y-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const segments = isUser ? [{ type: 'text', content: msg.content }] : splitCodeBlocks(msg.content);

            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 ${
                  isUser
                    ? 'bg-[#0e1016] border-[#232838] ml-auto max-w-3xl'
                    : 'bg-[#0b0c10] border-[#1c202b] mr-auto max-w-4xl'
                }`}
              >
                <div className="flex items-center justify-between mb-2 text-[11px] font-mono text-zinc-500">
                  <span className={isUser ? 'text-zinc-300 font-semibold' : 'text-rose-400 font-semibold'}>
                    {isUser ? 'YOU' : 'NIGHT AI'}
                  </span>
                  {!isUser && msg.meta && (
                    <div className="flex items-center gap-2">
                      {msg.meta.intent && (
                        <span className="px-1.5 py-0.5 rounded bg-[#141720] text-zinc-400 border border-[#232838]">
                          {msg.meta.intent}
                        </span>
                      )}
                      {msg.meta.latencyMs > 0 && (
                        <span>{msg.meta.latencyMs}ms</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {segments.map((seg, idx) => {
                    if (seg.type === 'code') {
                      const copyKey = `${msg.id}-code-${idx}`;
                      return (
                        <div
                          key={copyKey}
                          className="rounded-lg overflow-hidden border border-[#232838] bg-[#050507]"
                        >
                          <div className="flex items-center justify-between px-3 py-1.5 bg-[#11131a] border-b border-[#202432] text-xs font-mono text-zinc-400">
                            <span>{seg.lang}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(seg.content, copyKey)}
                              className="px-2 py-0.5 rounded bg-[#1a1d28] hover:bg-[#242838] text-zinc-200 transition-colors"
                            >
                              {copiedKey === copyKey ? 'Đã copy' : 'Copy'}
                            </button>
                          </div>
                          <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed font-mono text-zinc-100">
                            <code>{seg.content}</code>
                          </pre>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${msg.id}-txt-${idx}`}
                        className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200"
                      >
                        {seg.content}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="rounded-xl border border-[#1c202b] bg-[#0b0c10] p-4 max-w-4xl text-xs font-mono text-zinc-400">
              Đang xử lý qua Brain &amp; kiểm tra cú pháp Luau...
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="px-4 md:px-8 py-3.5 bg-[#0b0c10] border-t border-[#1e222d] shrink-0">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto flex items-end gap-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Viết prompt Luau (Enter để gửi, Shift+Enter xuống dòng)..."
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl bg-[#050507] border border-[#242938] px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-[#1a1d26] disabled:text-zinc-600 text-white text-sm font-medium transition-colors shrink-0"
          >
            {isLoading ? 'Đang chạy' : 'Gửi'}
          </button>
        </form>
      </footer>
    </div>
  );
}
