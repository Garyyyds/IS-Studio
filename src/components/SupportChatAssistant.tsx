import React, { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  AlertTriangle,
  Loader2,
  BookOpen,
  Globe,
  CheckCircle2,
  XCircle,
  LifeBuoy,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AppUser, Task } from '../types';

export interface TicketPrefill {
  summary: string;
  description: string;
}

interface SupportChatAssistantProps {
  currentUser: AppUser;
  tasks: Task[];
  /** Opens an IT Handbook guide cited as a source. */
  onOpenRunbook?: (runbookId: string) => void;
  /** Opens the IT Support Request form filled in from the conversation. */
  onRaiseTicket?: (prefill: TicketPrefill) => void;
}

type Source =
  | { kind: 'guide'; id: string; code: string; title: string }
  | { kind: 'web'; title: string; url: string };

// What the employee can do next, shown as buttons under an assistant message.
type NextStep = 'confirm-knowledge' | 'offer-web' | 'confirm-web' | 'raise-ticket';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Which attempt produced this answer. */
  attempt?: 1 | 2;
  sources?: Source[];
  webSearchUsed?: boolean;
  nextStep?: NextStep;
  /** Set once one of the buttons has been used, so it cannot be pressed twice. */
  stepTaken?: boolean;
}

/**
 * Where the current question is in the escalation:
 * - none:      no open question; the next message starts attempt 1
 * - knowledge: attempt 1 answered from the company guides
 * - web:       attempt 2 answered from the web
 * - ticket:    both attempts failed; waiting for the employee to raise a ticket
 */
type Stage = 'none' | 'knowledge' | 'web' | 'ticket';

const MAX_MESSAGE_CHARS = 2000;

const SUGGESTED_QUESTIONS = [
  'No Internet connection',
  'Cannot access the shared drive',
  'Where are my open requests up to?',
];

const newId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const SupportChatAssistant: React.FC<SupportChatAssistantProps> = ({
  currentUser,
  tasks,
  onOpenRunbook,
  onRaiseTicket,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Checking IT guides');
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('none');
  // The question that opened the current case; every attempt answers this.
  const [caseQuestion, setCaseQuestion] = useState('');

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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

  const add = (message: Omit<ChatMessage, 'id'>) =>
    setMessages((prev) => [...prev, { id: newId(), ...message }]);

  const markStepTaken = (id: string) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, stepTaken: true } : m)));

  /** Calls the assistant in one mode and appends its answer. */
  const ask = async (mode: 'knowledge' | 'web', question: string, message: string, history: ChatMessage[]) => {
    setError(null);
    setIsLoading(true);
    setLoadingLabel(mode === 'knowledge' ? 'Checking IT guides' : 'Searching the web');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          question,
          message,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          user: { name: currentUser.name, department: currentUser.department },
          tickets: myOpenTickets.map((t) => ({ ticketNumber: t.ticketNumber, title: t.title, status: t.status })),
        }),
      });

      // The server sends a readable explanation for quota and rate-limit
      // failures, so surface that rather than a bare status code.
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `The assistant is unavailable (error ${res.status}).`);

      if (mode === 'knowledge') {
        if (data.found) {
          add({ role: 'assistant', content: data.reply, attempt: 1, sources: data.sources, nextStep: 'confirm-knowledge' });
          setStage('knowledge');
        } else {
          add({
            role: 'assistant',
            attempt: 1,
            content: `${data.reply}\n\nI can try a second attempt and search the web for a fix.`,
            nextStep: 'offer-web',
          });
          setStage('knowledge');
        }
      } else {
        add({
          role: 'assistant',
          content: data.reply,
          attempt: 2,
          sources: data.sources,
          webSearchUsed: data.webSearchUsed,
          nextStep: 'confirm-web',
        });
        setStage('web');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not reach the IT assistant. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const history = messages;
    add({ role: 'user', content: trimmed });
    setInput('');

    // With no open question, or after a case has ended in a ticket, a message
    // is a new issue and starts again at attempt 1. Otherwise it is a follow-up
    // answered in the attempt currently running.
    if (stage === 'none' || stage === 'ticket') {
      setCaseQuestion(trimmed);
      await ask('knowledge', trimmed, trimmed, []);
    } else {
      await ask(stage === 'web' ? 'web' : 'knowledge', caseQuestion, trimmed, history);
    }
  };

  const handleSolved = (messageId: string) => {
    markStepTaken(messageId);
    add({ role: 'user', content: 'Yes, that solved it.' });
    add({ role: 'assistant', content: 'Great, glad that sorted it. Ask me anytime if something else comes up.' });
    setStage('none');
    setCaseQuestion('');
  };

  const handleTryWeb = async (messageId: string, userSaid: string) => {
    markStepTaken(messageId);
    const history = [...messages];
    add({ role: 'user', content: userSaid });
    await ask('web', caseQuestion, userSaid, history);
  };

  const handleStillNotWorking = (messageId: string) => {
    markStepTaken(messageId);
    add({ role: 'user', content: 'No, it is still not working.' });
    add({
      role: 'assistant',
      content:
        "Sorry that didn't fix it. This needs the IT team, so please submit an official IT Support Request. I'll fill in what we've tried so far.",
      nextStep: 'raise-ticket',
    });
    setStage('ticket');
  };

  const handleRaiseTicket = (messageId: string) => {
    markStepTaken(messageId);
    const summary = caseQuestion.length > 120 ? caseQuestion.slice(0, 117) + '...' : caseQuestion;
    const description = [
      caseQuestion,
      '',
      'Already tried with the IT Assistant:',
      '1. Company IT guides (attempt 1)',
      '2. Web search (attempt 2)',
      'The issue is still not resolved.',
    ].join('\n');
    onRaiseTicket?.({ summary, description });
    setIsOpen(false);
  };

  const startOver = () => {
    setMessages([]);
    setStage('none');
    setCaseQuestion('');
    setError(null);
    inputRef.current?.focus();
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

  const stepButton =
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const neutralButton = `${stepButton} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200`;
  const primaryButton = `${stepButton} border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white`;

  const renderNextStep = (m: ChatMessage) => {
    if (!m.nextStep) return null;
    const disabled = Boolean(m.stepTaken) || isLoading;
    switch (m.nextStep) {
      case 'confirm-knowledge':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 w-full">Did this solve it?</span>
            <button type="button" disabled={disabled} onClick={() => handleSolved(m.id)} className={neutralButton}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Yes, solved</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleTryWeb(m.id, "No, that didn't solve it.")}
              className={neutralButton}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>No, still not working</span>
            </button>
          </div>
        );
      case 'offer-web':
        return (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTryWeb(m.id, 'Yes, please search the web.')}
            className={primaryButton}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Try attempt 2: search the web</span>
          </button>
        );
      case 'confirm-web':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 w-full">Did this solve it?</span>
            <button type="button" disabled={disabled} onClick={() => handleSolved(m.id)} className={neutralButton}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Yes, solved</span>
            </button>
            <button type="button" disabled={disabled} onClick={() => handleStillNotWorking(m.id)} className={neutralButton}>
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>No, still not working</span>
            </button>
          </div>
        );
      case 'raise-ticket':
        return (
          <button type="button" disabled={disabled} onClick={() => handleRaiseTicket(m.id)} className={primaryButton}>
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Submit IT Support Request</span>
          </button>
        );
    }
  };

  const renderSources = (m: ChatMessage) => {
    if (!m.sources?.length) return null;
    return (
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sources</span>
        <ul className="space-y-1">
          {m.sources.map((source, i) => (
            <li key={i} className="min-w-0">
              {source.kind === 'guide' ? (
                <button
                  type="button"
                  onClick={() => onOpenRunbook?.(source.id)}
                  className="flex items-center gap-1.5 max-w-full text-left text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  title={`${source.code}: ${source.title}`}
                >
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span className="font-mono shrink-0">{source.code}</span>
                  <span className="truncate">{source.title}</span>
                </button>
              ) : (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 max-w-full text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  title={source.title}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{source.title}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const attemptLabel = (m: ChatMessage) => {
    if (m.attempt === 1) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <BookOpen className="w-3 h-3" />
          <span>Attempt 1 &middot; IT guides</span>
        </span>
      );
    }
    if (m.attempt === 2) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Globe className="w-3 h-3" />
          <span>{m.webSearchUsed === false ? 'Attempt 2 · General AI knowledge' : 'Attempt 2 · Web search'}</span>
        </span>
      );
    }
    return null;
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
            className="fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] sm:w-[400px] max-h-[min(600px,calc(100vh-8rem))] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-tight">IT Assistant</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    IT guides &middot; Web &middot; Ticket
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={startOver}
                    aria-label="Start a new conversation"
                    title="New conversation"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close IT assistant"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Hi {currentUser.name.split(' ')[0]} &mdash; tell me about an IT problem. I'll check the
                    company IT guides first, then search the web if needed, and help you raise a ticket if
                    it's still not fixed.
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

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[90%] rounded-xl px-3.5 py-2.5 space-y-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      {attemptLabel(m)}
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {m.content}
                      </p>
                      {renderSources(m)}
                      {renderNextStep(m)}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{loadingLabel}</span>
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
            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_MESSAGE_CHARS}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={stage === 'none' || stage === 'ticket' ? 'Describe your IT issue...' : 'Add more detail or ask a follow-up...'}
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
                AI can be wrong. If it can't fix your issue, raise an IT Support Request.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
