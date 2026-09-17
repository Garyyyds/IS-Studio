import React, { useState, useEffect, useRef } from 'react';
import { 
  Task, 
  Runbook, 
  TaskStatus, 
  ITCategory,
  UserSettings,
  ActiveTab,
  StorageStatusInfo,
  AppUser,
  StaffMember
} from './types';
import { 
  DEFAULT_TASKS, 
  DEFAULT_RUNBOOKS, 
  DEFAULT_USER_SETTINGS 
} from './data/defaultData';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskListView } from './components/TaskListView';
import { TicketHistoryView } from './components/TicketHistoryView';
import { HandbookView } from './components/HandbookView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsView } from './components/SettingsView';
import { TaskModal } from './components/TaskModal';
import { RunbookEditorModal } from './components/RunbookEditorModal';
import { QuickTriageModal } from './components/QuickTriageModal';
import { AiRunbookGeneratorModal } from './components/AiRunbookGeneratorModal';
import { AuthPage } from './components/AuthPage';
import { UserPortalView } from './components/UserPortalView';
import { SupportChatAssistant } from './components/SupportChatAssistant';
import { FormInboxView } from './components/FormInboxView';
import { FormHistoryView } from './components/FormHistoryView';
import { normalizeRunbooks, normalizeSettings, normalizeTask, normalizeTasks } from './utils/categories';
import {
  deleteRunbook,
  deleteTickets,
  importWorkspace,
  loadWorkspace,
  resetWorkspace,
  saveRunbook,
  saveSettings,
  saveTicket,
  TicketConflictError,
  type WorkspaceSnapshot,
} from './utils/workspaceApi';
import { exportHandbookToPdf, exportRunbookToPdf } from './utils/pdfExport';
import { Check, Zap, Info } from 'lucide-react';

/** Replaces the item with the same id, or adds it to the front. */
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
}

export default function App() {
  // Settings State with LocalStorage
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('it_ops_settings');
    return saved ? { ...DEFAULT_USER_SETTINGS, ...JSON.parse(saved) } : DEFAULT_USER_SETTINGS;
  });

  // Theme is a personal preference, so it lives in this browser rather than in
  // the workspace settings, which sync to every account through the server -
  // otherwise one person switching to dark mode would switch everyone.
  const [themeMode, setThemeMode] = useState<UserSettings['themeMode']>(() => {
    const own = localStorage.getItem('it_ops_theme_mode');
    if (own === 'light' || own === 'dark' || own === 'system') return own;
    // First run after this change: carry over whatever this browser last used.
    try {
      const legacy = JSON.parse(localStorage.getItem('it_ops_settings') || '{}').themeMode;
      if (legacy === 'light' || legacy === 'dark' || legacy === 'system') return legacy;
    } catch {}
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('it_ops_theme_mode', themeMode);
  }, [themeMode]);

  // What screens that show or change the theme receive: the shared settings
  // with this browser's theme laid over them. A theme change is kept local and
  // never written into the shared settings.
  const viewSettings: UserSettings = { ...settings, themeMode };

  // Navigation View State initialized with user's defaultView
  const [activeView, setActiveView] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('it_ops_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.defaultView && parsed.defaultView !== 'rules') return parsed.defaultView;
      } catch (e) {}
    }
    return 'kanban';
  });

  // Core Data State with LocalStorage initialization & clean migration
  const [tasks, setTasks] = useState<Task[]>(() => {
    const legacyDemoTickets = new Set([
      'INC-2041', 'INC-2042', 'OPS-1892', 'OPS-1893', 'OPS-1894', 'OPS-1895',
      'task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6'
    ]);
    const migrationKey = 'it_ops_clean_tasks_v5';
    const hasCleaned = localStorage.getItem(migrationKey);

    if (!hasCleaned) {
      // Clean legacy default tickets once so only the user's manual INC-2045 remains
      localStorage.setItem('it_ops_tasks', JSON.stringify(DEFAULT_TASKS));
      localStorage.setItem(migrationKey, 'true');
      return DEFAULT_TASKS;
    }

    const saved = localStorage.getItem('it_ops_tasks');
    if (!saved) return DEFAULT_TASKS;
    try {
      const parsed: Task[] = JSON.parse(saved);
      // Remove any lingering default legacy tickets
      const cleaned = parsed.filter(t => 
        !legacyDemoTickets.has(t.id) && 
        !legacyDemoTickets.has(t.ticketNumber) &&
        !t.ticketNumber.startsWith('OPS-189') &&
        t.ticketNumber !== 'INC-2041' &&
        t.ticketNumber !== 'INC-2042'
      );
      return cleaned;
    } catch (e) {
      return DEFAULT_TASKS;
    }
  });

  const [runbooks, setRunbooks] = useState<Runbook[]>(() => {
    const saved = localStorage.getItem('it_ops_runbooks');
    if (!saved) return DEFAULT_RUNBOOKS;
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_RUNBOOKS;
    }
  });

  // User Authentication & Role State - defaults to null so the app opens on Login / Register
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('it_ops_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  // Settings active section state (profile, theme, views, defaults, data)
  const [settingsSection, setSettingsSection] = useState<'profile' | 'theme' | 'views' | 'defaults' | 'data'>('profile');

  // Bumped by the logo so the employee portal returns to its start page.
  const [portalHomeSignal, setPortalHomeSignal] = useState(0);
  // Set when the IT Assistant hands a conversation over to a support request.
  const [ticketPrefill, setTicketPrefill] = useState<{ summary: string; description: string; key: number } | null>(null);
  const handleRaiseTicketFromChat = (prefill: { summary: string; description: string }) => {
    setActiveView(settings.defaultView || 'kanban');
    setTicketPrefill({ ...prefill, key: Date.now() });
  };
  const handleGoHome = () => {
    setActiveView(settings.defaultView || 'kanban');
    setPortalHomeSignal((n) => n + 1);
  };

  const handleOpenUserProfile = () => {
    setSettingsSection('profile');
    setActiveView('settings');
  };

  // Re-read the account once per sign-in, so changes IT makes to it (such as a
  // role or department) show up without signing out. Failures keep the saved copy.
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    fetch('/api/auth/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentUser.id, email: currentUser.email }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        setCurrentUser((prev) => (prev ? { ...prev, ...data.user } : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('it_ops_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('it_ops_current_user');
    }
  }, [currentUser]);

  // Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<Runbook | null>(null);
  const [isRunbookEditorOpen, setIsRunbookEditorOpen] = useState(false);
  const [isQuickTriageOpen, setIsQuickTriageOpen] = useState(false);
  const [isAiRunbookGeneratorOpen, setIsAiRunbookGeneratorOpen] = useState(false);
  const [taskForAiRunbook, setTaskForAiRunbook] = useState<Task | null>(null);

  // Status & Feedback Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('it_ops_settings', JSON.stringify(settings));
  }, [settings]);

  // Synchronize Theme Mode with document root (supports light, dark, system)
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const mode = themeMode || 'light';
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('it_ops_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('it_ops_runbooks', JSON.stringify(runbooks));
  }, [runbooks]);

  // Tagging rules were removed; clear the copy older versions kept.
  useEffect(() => {
    localStorage.removeItem('it_ops_rules');
  }, []);

  // Server storage state. Each change saves only the record it touches (see
  // utils/workspaceApi), so two people working on different tickets no longer
  // overwrite each other's work.
  const [serverSyncStatus, setServerSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSavedToServer, setLastSavedToServer] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageStatusInfo | null>(null);
  // IT accounts tickets can be assigned to.
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const isLoadedFromServerRef = useRef(false);
  const lastSavedToServerRef = useRef<string | null>(null);
  const pendingSavesRef = useRef(0);
  const settingsSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticketSaveQueueRef = useRef(new Map<string, Promise<Task | undefined>>());

  const noteServerTime = (time: string) => {
    setLastSavedToServer(time);
    lastSavedToServerRef.current = time;
  };

  const fetchStorageStatus = async () => {
    try {
      const res = await fetch('/api/data/status');
      if (res.ok) {
        const info = await res.json();
        setStorageInfo(info);
      }
    } catch (err) {
      console.warn('Could not inspect storage status:', err);
    }
  };

  const applyWorkspace = (data: WorkspaceSnapshot) => {
    if (Array.isArray(data.tasks)) setTasks(normalizeTasks(data.tasks));
    if (Array.isArray(data.runbooks)) setRunbooks(normalizeRunbooks(data.runbooks));
    if (data.settings && typeof data.settings === 'object') {
      setSettings((prev) => ({ ...prev, ...normalizeSettings(data.settings) }));
    }
    if (Array.isArray(data.staff)) setStaff(data.staff);
    noteServerTime(data.lastSaved || new Date().toISOString());
    setServerSyncStatus('synced');
  };

  const reloadWorkspace = async () => {
    const data = await loadWorkspace();
    applyWorkspace(data);
    return data;
  };

  // Load the workspace on first mount.
  useEffect(() => {
    let isMounted = true;
    setServerSyncStatus('syncing');
    fetchStorageStatus();
    loadWorkspace()
      .then((data) => {
        if (isMounted) applyWorkspace(data);
      })
      .catch((err) => {
        console.warn('Could not load the workspace from the server, showing the cached copy:', err);
        if (isMounted) setServerSyncStatus('error');
      })
      .finally(() => {
        isLoadedFromServerRef.current = true;
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picks up other people's changes: on window focus and every 20s.
  useEffect(() => {
    let isMounted = true;

    const checkRemoteSync = async () => {
      // Skipped while this browser is saving, so a reload cannot undo a change in flight.
      if (!isLoadedFromServerRef.current || pendingSavesRef.current > 0) return;
      try {
        const res = await fetch('/api/data/status');
        if (!res.ok) return;
        const status = await res.json();
        if (!isMounted) return;
        setStorageInfo(status);
        const remoteTime = status.lastSaved ? new Date(status.lastSaved).getTime() : 0;
        const localTime = lastSavedToServerRef.current ? new Date(lastSavedToServerRef.current).getTime() : 0;
        if (remoteTime > localTime + 2500 && pendingSavesRef.current === 0) {
          const latest = await loadWorkspace();
          if (isMounted && pendingSavesRef.current === 0) applyWorkspace(latest);
        }
      } catch (err) {
        // Silent poll error
      }
    };

    window.addEventListener('focus', checkRemoteSync);
    const interval = setInterval(checkRemoteSync, 20000);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', checkRemoteSync);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * Runs one save. Screens are updated before the save finishes; if it fails,
   * the workspace is reloaded so they show what is really stored.
   */
  const runSave = async <T,>(save: () => Promise<T>, failure: string): Promise<T | undefined> => {
    pendingSavesRef.current += 1;
    setServerSyncStatus('syncing');
    try {
      const result = await save();
      if (pendingSavesRef.current === 1) setServerSyncStatus('synced');
      noteServerTime(new Date().toISOString());
      return result;
    } catch (err: any) {
      setServerSyncStatus('error');
      if (err instanceof TicketConflictError) {
        setTasks((prev) => upsertById(prev, normalizeTask(err.current)));
        showToast(err.message);
      } else {
        showToast(`${failure}: ${err?.message || 'unknown error'}`);
        loadWorkspace().then(applyWorkspace).catch(() => {});
      }
      return undefined;
    } finally {
      pendingSavesRef.current -= 1;
    }
  };

  // Workspace settings are shared, so only IT saves them, and a theme change
  // (kept per browser) never does.
  useEffect(() => {
    return () => {
      if (settingsSaveTimeoutRef.current) clearTimeout(settingsSaveTimeoutRef.current);
    };
  }, []);
  const updateSettings = (next: UserSettings) => {
    if (next.themeMode && next.themeMode !== themeMode) setThemeMode(next.themeMode);
    const { themeMode: _nextTheme, ...nextShared } = next;
    const { themeMode: _currentTheme, ...currentShared } = settings;
    const merged = { ...next, themeMode: settings.themeMode };
    setSettings(merged);
    if (JSON.stringify(nextShared) === JSON.stringify(currentShared) || currentUser?.role !== 'admin') return;
    // Typing in a settings box saves once the typing pauses.
    if (settingsSaveTimeoutRef.current) clearTimeout(settingsSaveTimeoutRef.current);
    settingsSaveTimeoutRef.current = setTimeout(() => {
      runSave(() => saveSettings(merged), 'Could not save settings');
    }, 600);
  };

  const handleForceSaveToServer = async () => {
    // Every change is already saved as it is made; this confirms the connection.
    const saved = await runSave(() => saveSettings(settings), 'Could not reach storage');
    if (saved) {
      await fetchStorageStatus();
      showToast('All changes are saved to Supabase');
    }
  };

  const handleReloadFromServer = async () => {
    setServerSyncStatus('syncing');
    try {
      await reloadWorkspace();
      await fetchStorageStatus();
      showToast('Reloaded the latest data from Supabase');
    } catch (err: any) {
      setServerSyncStatus('error');
      showToast(err?.message || 'Error reloading from storage');
    }
  };

  // Task Handlers
  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  /**
   * Saves one ticket. `baseUpdatedAt` is the ticket's updatedAt when the change
   * started; if someone saved it since, the save is refused and their version shown.
   * New tickets get their REQ number from the server.
   */
  const persistTask = (task: Task, baseUpdatedAt: string | undefined, successToast?: (saved: Task) => string) => {
    const draft: Task = { ...task, title: task.title.trim() || 'Untitled Incident', ticketNumber: task.ticketNumber.trim() };
    setTasks((prev) => upsertById(prev, draft));
    // Saves to the same ticket go one after another (e.g. two quick drags), each
    // based on the version the previous one stored, so they are not mistaken
    // for someone else's change.
    const prior = ticketSaveQueueRef.current.get(task.id);
    const run = (async () => {
      const previous = prior ? await prior : undefined;
      const base = previous && baseUpdatedAt ? previous.updatedAt : baseUpdatedAt;
      const saved = await runSave(() => saveTicket(draft, base), 'Could not save the ticket');
      if (saved) {
        setTasks((prev) => upsertById(prev, normalizeTask(saved)));
        if (successToast) showToast(successToast(saved));
      }
      return saved;
    })();
    ticketSaveQueueRef.current.set(task.id, run);
    run.finally(() => {
      if (ticketSaveQueueRef.current.get(task.id) === run) ticketSaveQueueRef.current.delete(task.id);
    });
    return run;
  };

  const handleSaveTask = (updatedTask: Task) => {
    const existing = tasks.find((t) => t.id === updatedTask.id);
    // An edited ticket carries the updatedAt it was opened with.
    persistTask(
      existing ? { ...updatedTask, ticketNumber: existing.ticketNumber } : updatedTask,
      existing ? updatedTask.updatedAt : undefined,
      (saved) => `Saved task ${saved.ticketNumber}`
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    runSave(() => deleteTickets([taskId]), 'Could not delete the ticket').then((done) => {
      if (done) showToast('Task removed from queue.');
    });
  };

  const handleBatchDeleteTasks = (taskIds: string[]) => {
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
    runSave(() => deleteTickets(taskIds), 'Could not delete the tickets').then((done) => {
      if (done) showToast(`Removed ${taskIds.length} tasks from queue.`);
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === newStatus) return;
    const isResolving = newStatus === 'done' && t.status !== 'done';
    persistTask(
      {
        ...t,
        status: newStatus,
        resolvedAt: isResolving ? new Date().toISOString() : newStatus !== 'done' ? undefined : t.resolvedAt,
        updatedAt: new Date().toISOString(),
      },
      t.updatedAt
    );
  };

  const handleReopenTask = (taskId: string, targetStatus: TaskStatus = 'investigating') => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    persistTask(
      { ...t, status: targetStatus, resolvedAt: undefined, updatedAt: new Date().toISOString() },
      t.updatedAt,
      (saved) => `Reopened ticket ${saved.ticketNumber} back to ${targetStatus}`
    );
  };

  const handleCreateNewTask = (status: TaskStatus = 'backlog') => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      // Given the next REQ number when saved.
      ticketNumber: '',
      title: '',
      description: '',
      status,
      automatedTags: [],
      manualTags: [],
      category: settings.defaultCategory || 'Others',
      requesterName: currentUser?.name || 'Employee Requester',
      requesterEmail: currentUser?.email || 'employee@company.com',
      requesterDepartment: currentUser?.department || 'General',
      deviceInfo: '',
      isUserSubmitted: true,
      assigneeId: '',
      assignee: { name: 'Unassigned', role: '', email: '' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: [
        { id: `chk-${Date.now()}-1`, text: 'Acknowledge request & verify symptoms', done: false },
        { id: `chk-${Date.now()}-2`, text: 'Investigate issue and apply fix', done: false },
        { id: `chk-${Date.now()}-3`, text: 'Confirm resolution with employee', done: false },
      ],
    };

    setSelectedTask(newTask);
    setIsTaskModalOpen(true);
  };

  // Runbook Handlers
  const handleOpenRunbookEditor = (runbook?: Runbook) => {
    setEditingRunbook(runbook || null);
    setIsRunbookEditorOpen(true);
  };

  const handleSaveRunbook = async (savedRunbook: Runbook) => {
    setRunbooks((prev) => upsertById(prev, savedRunbook));
    const stored = await runSave(() => saveRunbook(savedRunbook), 'Could not save the guide');
    if (stored) {
      setRunbooks((prev) => upsertById(prev, stored));
      showToast(`Handbook updated: ${stored.code}`);
    }
  };

  const handleDeleteRunbook = (id: string) => {
    const toDelete = runbooks.find((r) => r.id === id);
    setRunbooks((prev) => prev.filter((r) => r.id !== id));
    // The server drops the guide's ticket links along with it.
    setTasks((prev) =>
      prev.map((t) => (t.linkedRunbookId === id ? { ...t, linkedRunbookId: undefined } : t))
    );
    runSave(() => deleteRunbook(id), 'Could not delete the guide').then((done) => {
      if (done) showToast(`Deleted SOP: ${toDelete?.code || 'Runbook'}`);
    });
  };

  const handleOpenRunbookFromAnywhere = (runbookId: string) => {
    const target = runbooks.find((r) => r.id === runbookId);
    if (target) {
      setEditingRunbook(target);
      setIsRunbookEditorOpen(true);
    }
  };

  const handleGenerateRunbookFromTask = (task: Task) => {
    setTaskForAiRunbook(task);
    setIsAiRunbookGeneratorOpen(true);
  };

  // The SOP writer can split one set of notes into several SOPs. A ticket they
  // were written from is linked to the first.
  const handleRunbooksGenerated = async (newRunbooks: Runbook[]) => {
    if (!newRunbooks.length) return;
    setRunbooks((prev) => [...newRunbooks, ...prev]);
    const sourceTask = taskForAiRunbook ? tasks.find((t) => t.id === taskForAiRunbook.id) : undefined;
    const stored = await runSave(async () => {
      const saved: Runbook[] = [];
      for (const rb of newRunbooks) saved.push(await saveRunbook(rb));
      return saved;
    }, 'Could not add the SOPs to the handbook');
    if (!stored) return;
    setRunbooks((prev) => stored.reduce((list, rb) => upsertById(list, rb), prev));
    if (sourceTask) await persistTask({ ...sourceTask, linkedRunbookId: stored[0].id }, sourceTask.updatedAt);
    const drafts = stored.filter((rb) => rb.status === 'draft').length;
    showToast(
      `Added ${stored.map((rb) => rb.code).join(', ')} to the handbook` +
        (drafts ? ` (${drafts} draft${drafts > 1 ? 's' : ''} to confirm)` : '')
    );
  };

  const handleExportFullHandbook = () => {
    exportHandbookToPdf(runbooks);
    showToast('Exported complete Issue-Solution Handbook to PDF');
  };

  // Data Management Handlers
  const handleImportData = async (data: { tasks?: Task[]; runbooks?: Runbook[]; settings?: UserSettings }) => {
    const result = await runSave(
      () =>
        importWorkspace({
          tasks: Array.isArray(data.tasks) ? normalizeTasks(data.tasks) : undefined,
          runbooks: Array.isArray(data.runbooks) ? normalizeRunbooks(data.runbooks) : undefined,
          settings: data.settings ? normalizeSettings(data.settings) : undefined,
        }),
      'Could not import the backup'
    );
    if (result) {
      applyWorkspace(result);
      showToast('Workspace data successfully imported and synced.');
    }
  };

  const handleResetToDefaults = async () => {
    const result = await runSave(
      () => resetWorkspace({ tasks: DEFAULT_TASKS, runbooks: DEFAULT_RUNBOOKS, settings: DEFAULT_USER_SETTINGS }),
      'Could not reset the workspace'
    );
    if (result) {
      applyWorkspace(result);
      showToast('Workspace reset to factory sample data.');
    }
  };

  const handleClearCompletedTasks = () => {
    const doneIds = tasks.filter((t) => t.status === 'done').map((t) => t.id);
    if (!doneIds.length) return;
    setTasks((prev) => prev.filter((t) => t.status !== 'done'));
    runSave(() => deleteTickets(doneIds), 'Could not clear completed tasks').then((done) => {
      if (done) showToast(`Cleared ${doneIds.length} completed tasks.`);
    });
  };

  // Auth & Portal Handlers
  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    showToast(`Signed in as ${user.name} (${user.role === 'admin' ? 'IT Ops Admin' : 'Employee Portal'})`);
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('it_ops_current_user');
    showToast('Signed out of workspace.');
  };

  // If not logged in, show the Login / Register screen as default!
  if (!currentUser) {
    return (
      <AuthPage
        onLoginSuccess={handleLoginSuccess}
        themeMode={themeMode || 'light'}
        onToggleTheme={(newMode) => setThemeMode(newMode)}
      />
    );
  }

  // Waits for the save, so the employee only sees a ticket number once it is stored.
  const handleUserSubmitTicket = async (ticketData: Partial<Task>): Promise<string> => {
    const fullTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      // Given the next REQ number by the server.
      ticketNumber: '',
      title: ticketData.title || 'Service Request',
      description: ticketData.description || '',
      rawLogs: ticketData.rawLogs,
      status: 'backlog',
      automatedTags: ticketData.automatedTags || ['User Request', 'PORTAL'],
      manualTags: ticketData.manualTags || ['Portal Submission'],
      category: ticketData.category || 'Others',
      // Arrives unassigned; IT picks a technician when triaging.
      assigneeId: '',
      assignee: { name: 'Unassigned', role: '', email: '' },
      requesterId: currentUser?.id,
      requesterName: currentUser?.name || 'Employee',
      requesterEmail: currentUser?.email,
      requesterDepartment: currentUser?.department || 'General Staff',
      deviceInfo: ticketData.deviceInfo,
      isUserSubmitted: true,
      systemRequested: ticketData.systemRequested,
      userLocation: ticketData.userLocation,
      userPhoneExt: ticketData.userPhoneExt,
      hodName: ticketData.hodName,
      hodEmail: ticketData.hodEmail,
      attachments: ticketData.attachments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: ticketData.checklist || [
        { id: 'chk-1', text: 'Review user submitted request & assess impact', done: false },
        { id: 'chk-2', text: 'Reach out to employee or apply remediation runbook', done: false },
        { id: 'chk-3', text: 'Verify resolution with employee and close ticket', done: false },
      ],
    };

    const saved = normalizeTask(await saveTicket(fullTask));
    setTasks((prev) => upsertById(prev, saved));
    noteServerTime(new Date().toISOString());
    showToast(`Ticket ${saved.ticketNumber} submitted and synced.`);
    return saved.ticketNumber;
  };

  const isEmployeeView = currentUser?.role === 'user';

  return (
    <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900 transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white border border-slate-800 dark:border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar
        activeTab={activeView}
        setActiveTab={setActiveView}
        tasks={tasks}
        runbookCount={runbooks.length}
        settings={viewSettings}
        onUpdateSettings={updateSettings}
        onOpenNewTask={() => handleCreateNewTask('backlog')}
        onOpenNewRunbook={() => handleOpenRunbookEditor()}
        onOpenQuickTriage={() => setIsQuickTriageOpen(true)}
        onExportAllHandbook={handleExportFullHandbook}
        serverSyncStatus={serverSyncStatus}
        lastSavedToServer={lastSavedToServer}
        storageType={storageInfo?.storageType || 'file'}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenUserProfile={handleOpenUserProfile}
        onGoHome={handleGoHome}
      />

      {/* Primary Workspace View */}
      <main className="flex-1 overflow-y-auto">
        {isEmployeeView && activeView === 'settings' ? (
          // Employees get the personal sections only; workspace-wide options
          // (views, defaults, storage) stay with IT.
          <SettingsView
            settings={viewSettings}
            onUpdateSettings={updateSettings}
            tasks={tasks}
            runbooks={runbooks}
            onImportData={handleImportData}
            onResetToDefaults={handleResetToDefaults}
            onClearCompletedTasks={handleClearCompletedTasks}
            currentUser={currentUser}
            onUpdateCurrentUser={(updatedUser) => {
              setCurrentUser(updatedUser);
              localStorage.setItem('it_ops_current_user', JSON.stringify(updatedUser));
            }}
            onSignOut={handleSignOut}
            activeSection={settingsSection}
            onSectionChange={setSettingsSection}
            allowedSections={['profile', 'theme']}
            onBack={() => setActiveView('kanban')}
          />
        ) : isEmployeeView ? (
          <UserPortalView
            currentUser={currentUser}
            tasks={tasks}
            onSubmitTicket={handleUserSubmitTicket}
            onSelectTask={handleSelectTask}
            homeSignal={portalHomeSignal}
            ticketPrefill={ticketPrefill}
          />
        ) : (
          <>
            {activeView === 'kanban' && (
              <KanbanBoard
                tasks={tasks}
                runbooks={runbooks}
                settings={settings}
                onSelectTask={handleSelectTask}
                onStatusChange={handleStatusChange}
                onOpenRunbook={handleOpenRunbookFromAnywhere}
                onNewTaskWithStatus={handleCreateNewTask}
                onOpenQuickTriage={() => setIsQuickTriageOpen(true)}
                onDeleteTask={handleDeleteTask}
                onNavigateToHistory={() => setActiveView('history')}
              />
            )}

            {activeView === 'list' && (
              <TaskListView
                tasks={tasks}
                runbooks={runbooks}
                settings={settings}
                onSelectTask={handleSelectTask}
                onStatusChange={handleStatusChange}
                onOpenRunbook={handleOpenRunbookFromAnywhere}
                onOpenQuickTriage={() => setIsQuickTriageOpen(true)}
                onDeleteTask={handleDeleteTask}
                onBatchDelete={handleBatchDeleteTasks}
                onNavigateToHistory={() => setActiveView('history')}
              />
            )}

            {activeView === 'history' && (
              <TicketHistoryView
                tasks={tasks}
                settings={settings}
                onSelectTask={handleSelectTask}
                onReopenTask={handleReopenTask}
                onDeleteTask={handleDeleteTask}
                onBatchDeleteTasks={handleBatchDeleteTasks}
              />
            )}

            {activeView === 'forms' && <FormInboxView currentUserName={currentUser?.name || 'IT'} />}

            {activeView === 'formHistory' && <FormHistoryView />}

            {activeView === 'handbook' && (
              <HandbookView
                runbooks={runbooks}
                onOpenEditor={handleOpenRunbookEditor}
                onDeleteRunbook={handleDeleteRunbook}
                onOpenAiGenerator={() => {
                  setTaskForAiRunbook(null);
                  setIsAiRunbookGeneratorOpen(true);
                }}
                onExportFullHandbook={handleExportFullHandbook}
                userRole={currentUser?.role}
              />
            )}

            {activeView === 'analytics' && (
              <AnalyticsDashboard
                tasks={tasks}
                runbooks={runbooks}
                onOpenRunbook={handleOpenRunbookFromAnywhere}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                settings={viewSettings}
                onUpdateSettings={updateSettings}
                tasks={tasks}
                runbooks={runbooks}
                onImportData={handleImportData}
                onResetToDefaults={handleResetToDefaults}
                onClearCompletedTasks={handleClearCompletedTasks}
                serverSyncStatus={serverSyncStatus}
                lastSavedToServer={lastSavedToServer}
                onForceSaveToServer={handleForceSaveToServer}
                onReloadFromServer={handleReloadFromServer}
                storageInfo={storageInfo}
                onRefreshStorageStatus={fetchStorageStatus}
                currentUser={currentUser}
                onUpdateCurrentUser={(updatedUser) => {
                  setCurrentUser(updatedUser);
                  localStorage.setItem('it_ops_current_user', JSON.stringify(updatedUser));
                }}
                onSignOut={handleSignOut}
                activeSection={settingsSection}
                onSectionChange={setSettingsSection}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {isTaskModalOpen && selectedTask && (
        <TaskModal
          task={selectedTask}
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          runbooks={runbooks}
          onOpenRunbook={handleOpenRunbookFromAnywhere}
          onGenerateRunbookFromTask={handleGenerateRunbookFromTask}
          userRole={currentUser?.role}
          staff={staff}
        />
      )}

      {isRunbookEditorOpen && (
        <RunbookEditorModal
          runbook={editingRunbook}
          isOpen={isRunbookEditorOpen}
          onClose={() => {
            setIsRunbookEditorOpen(false);
            setEditingRunbook(null);
          }}
          onSave={handleSaveRunbook}
          onDelete={handleDeleteRunbook}
          userRole={currentUser?.role}
        />
      )}

      {isQuickTriageOpen && (
        <QuickTriageModal
          isOpen={isQuickTriageOpen}
          onClose={() => setIsQuickTriageOpen(false)}
          onCreateTask={handleSaveTask}
          onGenerateRunbook={(data) => {
            handleOpenRunbookEditor(data as any);
          }}
        />
      )}

      {isAiRunbookGeneratorOpen && (
        <AiRunbookGeneratorModal
          isOpen={isAiRunbookGeneratorOpen}
          onClose={() => {
            setIsAiRunbookGeneratorOpen(false);
            setTaskForAiRunbook(null);
          }}
          onRunbooksGenerated={handleRunbooksGenerated}
          ownerName={currentUser?.name || settings.operatorName || 'IT Department'}
          initialTask={taskForAiRunbook}
        />
      )}

      {/* Employee-only support chat. Admins have the full triage tooling
          instead, so it is deliberately not rendered for them. */}
      {isEmployeeView && (
        <SupportChatAssistant
          currentUser={currentUser}
          tasks={tasks}
          runbooks={runbooks}
          onRaiseTicket={handleRaiseTicketFromChat}
        />
      )}
    </div>
  );
}
