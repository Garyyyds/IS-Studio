import React, { useState, useEffect, useRef } from 'react';
import { 
  Task, 
  Runbook, 
  TaggingRule, 
  TaskStatus, 
  PriorityLevel, 
  EnvironmentType, 
  ITCategory,
  UserSettings,
  ActiveTab,
  StorageStatusInfo,
  AppUser
} from './types';
import { 
  DEFAULT_TASKS, 
  DEFAULT_RUNBOOKS, 
  DEFAULT_TAGGING_RULES as DEFAULT_RULES,
  DEFAULT_USER_SETTINGS 
} from './data/defaultData';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskListView } from './components/TaskListView';
import { TicketHistoryView } from './components/TicketHistoryView';
import { HandbookView } from './components/HandbookView';
import { PriorityRulesManager } from './components/PriorityRulesManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsView } from './components/SettingsView';
import { TaskModal } from './components/TaskModal';
import { RunbookEditorModal } from './components/RunbookEditorModal';
import { QuickTriageModal } from './components/QuickTriageModal';
import { AiRunbookGeneratorModal } from './components/AiRunbookGeneratorModal';
import { AuthPage } from './components/AuthPage';
import { UserPortalView } from './components/UserPortalView';
import { SupportChatAssistant } from './components/SupportChatAssistant';
import { evaluateTaskPriorityWithRules } from './utils/priorityEngine';
import { exportHandbookToPdf, exportRunbookToPdf } from './utils/pdfExport';
import { Check, Zap, Info } from 'lucide-react';

export default function App() {
  // Settings State with LocalStorage
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('it_ops_settings');
    return saved ? { ...DEFAULT_USER_SETTINGS, ...JSON.parse(saved) } : DEFAULT_USER_SETTINGS;
  });

  // Navigation View State initialized with user's defaultView
  const [activeView, setActiveView] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('it_ops_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.defaultView) return parsed.defaultView;
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

  const [rules, setRules] = useState<TaggingRule[]>(() => {
    const saved = localStorage.getItem('it_ops_rules');
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
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

  // Settings active section state (profile, theme, views, workstation, defaults, data)
  const [settingsSection, setSettingsSection] = useState<'profile' | 'theme' | 'views' | 'workstation' | 'defaults' | 'data'>('profile');

  const handleOpenUserProfile = () => {
    setSettingsSection('profile');
    setActiveView('settings');
  };

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
  const [isScanning, setIsScanning] = useState(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('it_ops_settings', JSON.stringify(settings));
  }, [settings]);

  // Synchronize Theme Mode with document root (supports light, dark, system)
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const mode = settings.themeMode || 'light';
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

    if (settings.themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }
  }, [settings.themeMode]);

  useEffect(() => {
    localStorage.setItem('it_ops_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('it_ops_runbooks', JSON.stringify(runbooks));
  }, [runbooks]);

  useEffect(() => {
    localStorage.setItem('it_ops_rules', JSON.stringify(rules));
  }, [rules]);

  // Server-side & Supabase Cloud Storage State
  const [serverSyncStatus, setServerSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSavedToServer, setLastSavedToServer] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageStatusInfo | null>(null);
  const isLoadedFromServerRef = useRef(false);
  const lastSavedToServerRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Load freshest persistent data from server/Supabase on initial mount
  useEffect(() => {
    let isMounted = true;

    async function loadFromServer() {
      try {
        setServerSyncStatus('syncing');
        const [dataRes] = await Promise.all([
          fetch('/api/data'),
          fetchStorageStatus()
        ]);

        if (dataRes.ok) {
          const data = await dataRes.json();
          if (!isMounted) return;

          if (data.tasks && Array.isArray(data.tasks)) {
            setTasks(data.tasks);
            localStorage.setItem('it_ops_tasks', JSON.stringify(data.tasks));
          }
          if (data.runbooks && Array.isArray(data.runbooks)) {
            setRunbooks(data.runbooks);
            localStorage.setItem('it_ops_runbooks', JSON.stringify(data.runbooks));
          }
          if (data.rules && Array.isArray(data.rules)) {
            setRules(data.rules);
            localStorage.setItem('it_ops_rules', JSON.stringify(data.rules));
          }
          if (data.settings && typeof data.settings === 'object') {
            setSettings((prev) => ({ ...prev, ...data.settings }));
            localStorage.setItem('it_ops_settings', JSON.stringify(data.settings));
          }

          setServerSyncStatus('synced');
          const savedTime = data.lastSaved || new Date().toISOString();
          setLastSavedToServer(savedTime);
          lastSavedToServerRef.current = savedTime;
        } else {
          if (isMounted) setServerSyncStatus('idle');
        }
      } catch (err) {
        console.warn('Could not load from server/cloud, using local cache:', err);
        if (isMounted) setServerSyncStatus('idle');
      } finally {
        isLoadedFromServerRef.current = true;
      }
    }

    loadFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cross-device sync check (listens on window focus and periodic 20s interval)
  useEffect(() => {
    let isMounted = true;

    const checkRemoteSync = async () => {
      if (!isLoadedFromServerRef.current || serverSyncStatus === 'syncing') return;

      try {
        const res = await fetch('/api/data/status');
        if (!res.ok) return;
        const status = await res.json();
        setStorageInfo(status);

        if (status.lastSaved && lastSavedToServerRef.current) {
          const remoteTime = new Date(status.lastSaved).getTime();
          const localTime = new Date(lastSavedToServerRef.current).getTime();

          // If another device made newer saves (more than 2.5s difference)
          if (remoteTime > localTime + 2500) {
            const dataRes = await fetch('/api/data');
            if (dataRes.ok && isMounted) {
              const latest = await dataRes.json();
              if (latest.tasks) setTasks(latest.tasks);
              if (latest.runbooks) setRunbooks(latest.runbooks);
              if (latest.rules) setRules(latest.rules);
              if (latest.settings) setSettings(latest.settings);
              setLastSavedToServer(latest.lastSaved);
              lastSavedToServerRef.current = latest.lastSaved;
              setServerSyncStatus('synced');
            }
          }
        }
      } catch (err) {
        // Silent poll error
      }
    };

    const handleFocus = () => {
      checkRemoteSync();
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(checkRemoteSync, 20000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [serverSyncStatus]);

  // Debounced auto-save to server and cloud whenever state changes
  useEffect(() => {
    if (!isLoadedFromServerRef.current) return;

    setServerSyncStatus('syncing');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks,
            runbooks,
            rules,
            settings,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          setServerSyncStatus('synced');
          const savedTime = result.savedAt || new Date().toISOString();
          setLastSavedToServer(savedTime);
          lastSavedToServerRef.current = savedTime;
        } else {
          setServerSyncStatus('error');
        }
      } catch (err) {
        console.error('Error auto-syncing storage:', err);
        setServerSyncStatus('error');
      }
    }, 600);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tasks, runbooks, rules, settings]);

  const handleForceSaveToServer = async () => {
    try {
      setServerSyncStatus('syncing');
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          runbooks,
          rules,
          settings,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setServerSyncStatus('synced');
        const savedTime = result.savedAt || new Date().toISOString();
        setLastSavedToServer(savedTime);
        lastSavedToServerRef.current = savedTime;
        await fetchStorageStatus();
        showToast(result.storageType === 'supabase' ? 'Synced to Supabase Cloud Database' : 'Saved to server file data/server-storage.json');
      } else {
        setServerSyncStatus('error');
        showToast('Failed to save data');
      }
    } catch (err) {
      setServerSyncStatus('error');
      showToast('Error connecting to storage backend');
    }
  };

  const handleReloadFromServer = async () => {
    try {
      setServerSyncStatus('syncing');
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        if (data.tasks) setTasks(data.tasks);
        if (data.runbooks) setRunbooks(data.runbooks);
        if (data.rules) setRules(data.rules);
        if (data.settings) setSettings(data.settings);
        setServerSyncStatus('synced');
        const savedTime = data.lastSaved || new Date().toISOString();
        setLastSavedToServer(savedTime);
        lastSavedToServerRef.current = savedTime;
        await fetchStorageStatus();
        showToast(data.storageType === 'supabase' ? 'Reloaded freshest data from Supabase Cloud' : 'Reloaded freshest data from server file');
      } else {
        showToast('No server data found');
      }
    } catch (err) {
      showToast('Error reloading from storage');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Task Handlers
  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (updatedTask: Task) => {
    const finalTask: Task = {
      ...updatedTask,
      ticketNumber: updatedTask.ticketNumber.trim() || `INC-${tasks.length + 1}`,
      title: updatedTask.title.trim() || 'Untitled Incident',
    };
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === finalTask.id);
      if (exists) {
        return prev.map((t) => (t.id === finalTask.id ? finalTask : t));
      }
      return [finalTask, ...prev];
    });
    showToast(`Saved task ${finalTask.ticketNumber}`);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('Task removed from queue.');
  };

  const handleBatchDeleteTasks = (taskIds: string[]) => {
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
    showToast(`Removed ${taskIds.length} tasks from queue.`);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const isResolving = newStatus === 'done' && t.status !== 'done';
          return {
            ...t,
            status: newStatus,
            resolvedAt: isResolving ? new Date().toISOString() : (newStatus !== 'done' ? undefined : t.resolvedAt),
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
  };

  const handleReopenTask = (taskId: string, targetStatus: TaskStatus = 'investigating') => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: targetStatus,
            resolvedAt: undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    const targetTask = tasks.find((t) => t.id === taskId);
    showToast(`Reopened ticket ${targetTask?.ticketNumber || ''} back to ${targetStatus}`);
  };

  const handleCreateNewTask = (status: TaskStatus = 'backlog') => {
    const nextTicketNum = `REQ-${1000 + tasks.length + 1}`;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ticketNumber: nextTicketNum,
      title: '',
      description: '',
      status,
      priority: settings.defaultPriority || 'P3',
      priorityRationale: 'Direct ticket creation',
      automatedTags: [],
      manualTags: [],
      category: settings.defaultCategory || 'Application',
      environment: settings.defaultEnvironment || 'Corporate LAN',
      impactScore: 5,
      urgencyScore: 5,
      requesterName: currentUser?.name || 'Employee Requester',
      requesterEmail: currentUser?.email || 'employee@company.com',
      requesterDepartment: currentUser?.department || 'General',
      deviceInfo: 'Company Workstation (macOS / Windows)',
      isUserSubmitted: true,
      urgencyLevel: 'medium',
      assignee: {
        name: settings.operatorName || 'Alex Rivera',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'IT Support Engineer',
        email: 'alex.rivera@internal.corp',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: [
        { id: `chk-${Date.now()}-1`, text: 'Acknowledge request & verify symptoms', done: false },
        { id: `chk-${Date.now()}-2`, text: 'Investigate issue and apply fix', done: false },
        { id: `chk-${Date.now()}-3`, text: 'Confirm resolution with employee', done: false },
      ],
      isAutoTagged: false,
    };

    setSelectedTask(newTask);
    setIsTaskModalOpen(true);
  };

  const handleBatchPriority = (taskIds: string[], priority: PriorityLevel) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (taskIds.includes(t.id)) {
          return {
            ...t,
            priority,
            priorityRationale: `Manually set to ${priority} in batch action`,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    showToast(`Updated ${taskIds.length} tasks to ${priority}`);
  };

  // Automated Priority Tagging Batch Scan
  const handleAutoScanAll = () => {
    setIsScanning(true);
    let taggedCount = 0;

    const updated = tasks.map((task) => {
      const evaluation = evaluateTaskPriorityWithRules(
        {
          title: task.title,
          description: task.description,
          rawLogs: task.rawLogs,
          environment: task.environment,
          affectedUsersEstimate: task.affectedUsersEstimate,
        },
        rules
      );

      if (evaluation.priority !== task.priority || evaluation.automatedTags.length > 0) {
        taggedCount++;
      }

      return {
        ...task,
        priority: evaluation.priority,
        priorityRationale: evaluation.priorityRationale,
        automatedTags: evaluation.automatedTags,
        category: evaluation.category,
        impactScore: evaluation.impactScore,
        urgencyScore: evaluation.urgencyScore,
        isAutoTagged: true,
        updatedAt: new Date().toISOString(),
      };
    });

    setTasks(updated);
    setIsScanning(false);
    showToast(`Auto-Tagging engine evaluated ${updated.length} tasks (${taggedCount} adjusted)`);
  };

  // Runbook Handlers
  const handleOpenRunbookEditor = (runbook?: Runbook) => {
    setEditingRunbook(runbook || null);
    setIsRunbookEditorOpen(true);
  };

  const handleSaveRunbook = (savedRunbook: Runbook) => {
    setRunbooks((prev) => {
      const exists = prev.some((r) => r.id === savedRunbook.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRunbook.id ? savedRunbook : r));
      }
      return [savedRunbook, ...prev];
    });
    showToast(`Handbook updated: ${savedRunbook.code}`);
  };

  const handleDeleteRunbook = (id: string) => {
    const toDelete = runbooks.find((r) => r.id === id);
    setRunbooks((prev) => prev.filter((r) => r.id !== id));
    setTasks((prev) =>
      prev.map((t) => (t.linkedRunbookId === id ? { ...t, linkedRunbookId: undefined } : t))
    );
    showToast(`Deleted SOP: ${toDelete?.code || 'Runbook'}`);
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

  const handleRunbookGenerated = (newRunbook: Runbook) => {
    setRunbooks((prev) => [newRunbook, ...prev]);
    if (taskForAiRunbook) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskForAiRunbook.id ? { ...t, linkedRunbookId: newRunbook.id } : t))
      );
    }
    showToast(`Generated and added SOP: ${newRunbook.code}`);
  };

  const handleExportFullHandbook = () => {
    exportHandbookToPdf(runbooks);
    showToast('Exported complete Issue-Solution Handbook to PDF');
  };

  // Data Management Handlers
  const handleImportData = (data: { tasks?: Task[]; runbooks?: Runbook[]; rules?: TaggingRule[]; settings?: UserSettings }) => {
    if (data.tasks && Array.isArray(data.tasks)) {
      setTasks(data.tasks);
    }
    if (data.runbooks && Array.isArray(data.runbooks)) {
      setRunbooks(data.runbooks);
    }
    if (data.rules && Array.isArray(data.rules)) {
      setRules(data.rules);
    }
    if (data.settings) {
      setSettings(data.settings);
    }
    showToast('Workspace data successfully imported and synced.');
  };

  const handleResetToDefaults = () => {
    setTasks(DEFAULT_TASKS);
    setRunbooks(DEFAULT_RUNBOOKS);
    setRules(DEFAULT_RULES);
    setSettings(DEFAULT_USER_SETTINGS);
    showToast('Workspace reset to factory sample data.');
  };

  const handleClearCompletedTasks = () => {
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    setTasks((prev) => prev.filter((t) => t.status !== 'done'));
    showToast(`Cleared ${doneCount} completed tasks.`);
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
        themeMode={settings.themeMode || 'light'}
        onToggleTheme={(newMode) => setSettings((prev) => ({ ...prev, themeMode: newMode }))}
      />
    );
  }

  const handleUserSubmitTicket = (ticketData: Partial<Task>) => {
    const fullTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ticketNumber: ticketData.ticketNumber || `REQ-${1000 + tasks.length + 1}`,
      title: ticketData.title || 'Service Request',
      description: ticketData.description || '',
      rawLogs: ticketData.rawLogs,
      status: 'backlog',
      priority: ticketData.priority || 'P3',
      priorityRationale: ticketData.priorityRationale || 'User submitted request via Employee Portal.',
      automatedTags: ticketData.automatedTags || ['User Request', 'PORTAL'],
      manualTags: ticketData.manualTags || ['Portal Submission'],
      category: ticketData.category || 'Application',
      environment: ticketData.environment || 'Corporate LAN',
      impactScore: ticketData.impactScore || 5,
      urgencyScore: ticketData.urgencyScore || 5,
      affectedUsersEstimate: 1,
      assignee: ticketData.assignee || {
        name: 'IT Helpdesk Queue',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'Triage Specialist',
        email: 'helpdesk@company.com',
      },
      requesterId: currentUser?.id,
      requesterName: currentUser?.name || 'Employee',
      requesterEmail: currentUser?.email,
      requesterDepartment: currentUser?.department || 'General Staff',
      deviceInfo: ticketData.deviceInfo || 'Company Workstation',
      isUserSubmitted: true,
      urgencyLevel: ticketData.urgencyLevel || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: ticketData.checklist || [
        { id: 'chk-1', text: 'Review user submitted request & assess impact', done: false },
        { id: 'chk-2', text: 'Reach out to employee or apply remediation runbook', done: false },
        { id: 'chk-3', text: 'Verify resolution with employee and close ticket', done: false },
      ],
      isAutoTagged: false,
    };

    setTasks((prev) => [fullTask, ...prev]);
    showToast(`Ticket ${fullTask.ticketNumber} submitted and synced.`);
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
        settings={settings}
        onUpdateSettings={setSettings}
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
      />

      {/* Primary Workspace View */}
      <main className="flex-1 overflow-y-auto">
        {isEmployeeView ? (
          <UserPortalView
            currentUser={currentUser}
            tasks={tasks}
            runbooks={runbooks}
            onSubmitTicket={handleUserSubmitTicket}
            onSelectTask={handleSelectTask}
            onOpenRunbook={handleOpenRunbookFromAnywhere}
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
                onAutoScanAll={handleAutoScanAll}
                onOpenQuickTriage={() => setIsQuickTriageOpen(true)}
                onDeleteTask={handleDeleteTask}
                onNavigateToHistory={() => setActiveView('history')}
                isScanning={isScanning}
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
                onBatchPriority={handleBatchPriority}
                onOpenQuickTriage={() => setIsQuickTriageOpen(true)}
                onDeleteTask={handleDeleteTask}
                onBatchDelete={handleBatchDeleteTasks}
                onNavigateToHistory={() => setActiveView('history')}
              />
            )}

            {activeView === 'history' && (
              <TicketHistoryView
                tasks={tasks}
                runbooks={runbooks}
                settings={settings}
                onSelectTask={handleSelectTask}
                onReopenTask={handleReopenTask}
                onDeleteTask={handleDeleteTask}
                onBatchDelete={handleBatchDeleteTasks}
                onOpenRunbook={handleOpenRunbookFromAnywhere}
                onUpdateSettings={setSettings}
              />
            )}

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

            {activeView === 'rules' && (
              <PriorityRulesManager
                rules={rules}
                onSaveRules={setRules}
                onRunBatchScan={handleAutoScanAll}
                isScanning={isScanning}
              />
            )}

            {activeView === 'analytics' && (
              <AnalyticsDashboard
                tasks={tasks}
                runbooks={runbooks}
                rules={rules}
                onOpenRunbook={handleOpenRunbookFromAnywhere}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={setSettings}
                tasks={tasks}
                runbooks={runbooks}
                rules={rules}
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
          onRunbookGenerated={handleRunbookGenerated}
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
        />
      )}
    </div>
  );
}
