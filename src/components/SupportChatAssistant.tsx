import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AppUser, Runbook, Task } from '../types';

interface SupportChatAssistantProps {
  currentUser: AppUser;
  tasks: Task[];
  runbooks: Runbook[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGE_CHARS = 2000;

const SUGGESTED_QUESTIONS = [
  'My VPN keeps disconnecting',
  'How do I reset my password?',
  'Where are my open requests up to?',
];

export const SupportChatAssistant: React.FC<SupportChatAssistantProps> = ({
  currentUser,
  tasks,
  runbooks,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Same ownership test the portal uses, so the assistant is only ever given
  // tickets this employee is allowed to see.
  const myOpenTickets = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      (t.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        t.requesterId === currentUser.id)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Escape closes the panel, matching the app's modals.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const outgoing: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    // Captured before the state update so the request carries the turns that
    // preceded this message, not this message twice.
    const priorHistory = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, outgoing]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: priorHistory,
          user: { name: currentUser.name, department: currentUser.department },
          tickets: myOpenTickets.map((t) => ({
            ticketNumber: t.ticketNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            slaDeadline: t.slaDeadline,
          })),
          runbooks: runbooks.map((r) => ({
            code: r.code,
            title: r.title,
            symptom: r.symptom,
          })),
        }),
      });

      // The server sends a readable explanation for quota and rate-limit
      // failures, so surface that rather than a bare status code.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `The assistant is unavailable (error ${res.status}).`);
      }

      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}-reply`, role: 'assistant', content: data.reply },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Could not reach the IT assistant. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close IT assistant' : 'Open IT assistant'}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="dialog"
            aria-label="IT assistant"
            className="fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] sm:w-[380px] max-h-[min(560px,calc(100vh-8rem))] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                    IT Assistant
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    AI powered &middot; Self-service help
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close IT assistant"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Hi {currentUser.name.split(' ')[0]} &mdash; ask me about an IT problem and
                    I will walk you through what to try. I can also check where your open
                    requests stand.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        onClick={() => sendMessage(question)}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] rounded-xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white'
                        : 'max-w-[85%] rounded-xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Thinking
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSubmit}
              className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_MESSAGE_CHARS}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your IT issue..."
                  className="flex-1 resize-none max-h-28 px-3.5 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xs transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                AI can be wrong. Raise a ticket if the issue continues.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
