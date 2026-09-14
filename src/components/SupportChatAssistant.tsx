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
  RotateCcw,
  Clock,
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
  /** Opens the IT Support Request form filled in from the conversation. */
  onRaiseTicket?: (prefill: TicketPrefill) => void;
}

// What the employee can do next, shown as buttons under an assistant message.
type NextStep = 'confirm-knowledge' | 'offer-web' | 'confirm-web' | 'raise-ticket';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Which attempt produced this answer. */
  attempt?: 1 | 2;
  webSearchUsed?: boolean;
  nextStep?: NextStep;
  /** Set once one of the buttons has been used, so it cannot be pressed twice. */
  stepTaken?: boolean;
  /** A reply sent by pressing a button, left out of the ticket summary. */
  fromButton?: boolean;
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
const MAX_SUMMARY_REPLY_CHARS = 500;

/**
 * Remarks for the ticket, built from the conversation without another AI call:
 * the issue, what the employee added, and the steps each attempt gave.
 */
function summarizeCase(question: string, messages: ChatMessage[]): string {
  const lines = [`Issue: ${question}`];
  let attempt1Written = false;
  // Only the current case: everything after the message that asked it.
  const start = messages.map((m) => m.role === 'user' && m.content === question).lastIndexOf(true);
  for (const m of messages.slice(start + 1)) {
    if (m.role === 'user') {
      if (!m.fromButton) lines.push(`User added: ${m.content}`);
      continue;
    }
    // Attempt 1 is recorded as one line however many times it answered.
    if (m.attempt === 1) {
      if (!attempt1Written) lines.push('Attempt 1: Failed to resolve');
      attempt1Written = true;
    } else if (m.attempt === 2) {
      const reply = m.content.length > MAX_SUMMARY_REPLY_CHARS ? m.content.slice(0, MAX_SUMMARY_REPLY_CHARS - 3) + '...' : m.content;
      lines.push('', 'Attempt 2 (' + (m.webSearchUsed ? 'web search' : 'general AI knowledge') + '):', reply);
    }
  }
  lines.push('', 'Result: not resolved after both attempts.');
  return lines.join('\n');
}

const SUGGESTED_QUESTIONS = [
  'No Internet connection',
  'Cannot access the shared drive',
  'Where are my open requests up to?',
];

/**
 * The usage window, as last reported by the server (which enforces it):
 * - new:    no session; the next question starts one
 * - active: questions allowed until endsAt
 * - ended:  locked until retryAt
 * Times are local clock values, computed from the durations the server sends.
 */
type Session = { status: 'new' } | { status: 'active'; endsAt: number; cooldownMs: number } | { status: 'ended'; retryAt: number };

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const minutesLeft = (ms: number) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

const newId = () =>`msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const SupportChatAssistant: React.FC<SupportChatAssistantProps> = ({
  currentUser,
  tasks,
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
  const [session, setSession] = useState<Session>({ status: 'new' });
  const [now, setNow] = useState(() => Date.now());

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

  // Ask the server for the window on opening, so a reload or another tab shows
  // the real countdown or lock instead of assuming a fresh start.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/ai/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: { id: currentUser.id, email: currentUser.email } }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const at = Date.now();
        setNow(at);
        if (data.status === 'active') setSession({ status: 'active', endsAt: at + data.endsInMs, cooldownMs: data.cooldownMs });
        else if (data.status === 'ended') setSession({ status: 'ended', retryAt: at + data.retryInMs });
        else setSession({ status: 'new' });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser.id, currentUser.email]);

  // Ticks the countdown, and moves the window along when a deadline passes.
  useEffect(() => {
    if (session.status === 'new') return;
    const timer = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      setSession((prev) => {
        if (prev.status === 'active' && at >= prev.endsAt) return { status: 'ended', retryAt: prev.endsAt + prev.cooldownMs };
        if (prev.status === 'ended' && at >= prev.retryAt) return { status: 'new' };
        return prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.status]);

  const sessionEnded = session.status === 'ended';

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
          user: { id: currentUser.id, email: currentUser.email, name: currentUser.name, department: currentUser.department },
          tickets: myOpenTickets.map((t) => ({ ticketNumber: t.ticketNumber, title: t.title, status: t.status })),
        }),
      });

      // The server sends a readable explanation for quota and rate-limit
      // failures, so surface that rather than a bare status code.
      const data = await res.json().catch(() => null);
      if (data?.sessionEnded) {
        const at = Date.now();
        setNow(at);
        setSession({ status: 'ended', retryAt: at + data.retryInMs });
        return;
      }
      if (!res.ok) throw new Error(data?.error || `The assistant is unavailable (error ${res.status}).`);
      if (typeof data.sessionEndsInMs === 'number') {
        const at = Date.now();
        setNow(at);
        setSession({ status: 'active', endsAt: at + data.sessionEndsInMs, cooldownMs: data.cooldownMs });
      }

      if (mode === 'knowledge') {
        if (data.found) {
          add({ role: 'assistant', content: data.reply, attempt: 1, nextStep: 'confirm-knowledge' });
          setStage('knowledge');
        } else {
          add({
            role: 'assistant',
            attempt: 1,
            content: 'Not covered in the IT guides.',
            nextStep: 'offer-web',
          });
          setStage('knowledge');
        }
      } else {
        add({
          role: 'assistant',
          content: data.reply,
          attempt: 2,
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
    if (!trimmed || isLoading || sessionEnded) return;

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
    add({ role: 'user', content: 'Yes, that solved it.', fromButton: true });
    add({ role: 'assistant', content: 'Case closed.' });
    setStage('none');
    setCaseQuestion('');
  };

  const handleTryWeb = async (messageId: string, userSaid: string) => {
    markStepTaken(messageId);
    const history = [...messages];
    add({ role: 'user', content: userSaid, fromButton: true });
    await ask('web', caseQuestion, userSaid, history);
  };

  const handleStillNotWorking = (messageId: string) => {
    markStepTaken(messageId);
    add({ role: 'user', content: 'No, it is still not working.', fromButton: true });
    add({
      role: 'assistant',
      content: 'Please submit an IT Support Request. The details are filled in for you.',
      nextStep: 'raise-ticket',
    });
    setStage('ticket');
  };

  const handleRaiseTicket = (messageId?: string) => {
    if (messageId) markStepTaken(messageId);
    const summary = caseQuestion.length > 120 ? caseQuestion.slice(0, 117) + '...' : caseQuestion;
    onRaiseTicket?.({ summary, description: summarizeCase(caseQuestion, messages) });
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
    // Buttons that would call the assistant again are locked once the session ends.
    const askDisabled = disabled || sessionEnded;
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
              disabled={askDisabled}
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
            disabled={askDisabled}
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
                {session.status === 'active' && (
                  <span
                    role="timer"
                    aria-label="Time left in this session"
                    title="Time left in this session"
                    className="inline-flex items-center gap-1 px-2 py-0.5 mr-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300"
                  >
                    <Clock className="w-3 h-3" />
                    {formatCountdown(session.endsAt - now)}
                  </span>
                )}
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
                        disabled={sessionEnded}
                        onClick={() => sendMessage(question)}
                        className="disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
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

            {/* Composer, or the lock once the session has ended */}
            {session.status === 'ended' ? (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900"
                >
                  <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Session ended</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                      Please try again in {minutesLeft(session.retryAt - now)}.
                    </p>
                    {caseQuestion && (
                      <button type="button" onClick={() => handleRaiseTicket()} className={primaryButton}>
                        <LifeBuoy className="w-3.5 h-3.5" />
                        <span>Submit IT Support Request</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
