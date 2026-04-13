'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 10;

export default function AIAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (messages.length >= MAX_MESSAGES) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const currentPage = typeof window !== 'undefined' ? window.location.pathname : '/';
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'assistant',
          data: {
            prompt: trimmed,
            context: { page: currentPage },
            history: messages.slice(-6), // send last 6 messages for context
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.data || data.error || 'Analyse indisponible';
        setMessages(prev => [...prev, { role: 'assistant', content }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Erreur de connexion. Reessayez.' },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Erreur de connexion. Reessayez.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Don't show if not authenticated
  if (!user) return null;

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-corner-blue to-corner-blue/80 text-white shadow-elevation-3 flex items-center justify-center hover:shadow-elevation-4 active:scale-95 transition-all no-print"
          title="Assistant IA"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
      )}

      {/* Chat modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full sm:max-w-md h-[80vh] sm:h-[70vh] sm:rounded-2xl rounded-t-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-elevation-3 flex flex-col overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-corner-blue to-corner-blue/80 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Assistant IA</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Corner Mobile</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                    <svg className="w-6 h-6 text-corner-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Comment puis-je vous aider ?</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Posez des questions sur votre stock, ventes, reparations...
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {[
                      'Stock iPhones en bon etat',
                      'Ventes du jour',
                      'Reparations en attente',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => { setInput(suggestion); }}
                        className="px-3 py-1.5 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] rounded-full hover:bg-[var(--surface-3)] transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-corner-blue text-white rounded-br-md'
                        : 'bg-[var(--surface-2)] text-[var(--text-primary)] rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--surface-2)] px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-corner-blue/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-corner-blue/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-corner-blue/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-[var(--border)] p-3">
              {messages.length >= MAX_MESSAGES && (
                <p className="text-xs text-[var(--text-muted)] text-center mb-2">
                  Limite de {MAX_MESSAGES} messages atteinte. Fermez et reouvrez pour une nouvelle session.
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={messages.length >= MAX_MESSAGES ? 'Session terminee' : 'Posez votre question...'}
                  disabled={messages.length >= MAX_MESSAGES || loading}
                  className="flex-1 bg-[var(--surface-2)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-corner-blue/30 transition-all disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading || messages.length >= MAX_MESSAGES}
                  className="w-10 h-10 rounded-xl bg-corner-blue text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-corner-blue/90 active:scale-95 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
