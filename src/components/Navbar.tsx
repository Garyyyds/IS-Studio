import React, { useState, useRef, useEffect } from 'react';
import { 
  Kanban, 
  ListOrdered, 
  History, 
  BookOpen, 
  Zap, 
  BarChart3, 
  Plus, 
  ShieldAlert,
  TerminalSquare,
  Settings2,
  Sun,
  Moon,
  Laptop,
  Server,
  RefreshCw,
  User,
  LogOut,
  Shield,
  LifeBuoy,
  ChevronDown
} from 'lucide-react';
import { ActiveTab, Task, UserSettings, AppUser } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  tasks: Task[];
  runbookCount: number;
  settings: UserSettings;
  onUpdateSettings?: (settings: UserSettings) => void;
  onOpenNewTask: () => void;
  onOpenNewRunbook: () => void;
  onOpenQuickTriage: () => void;
  onExportAllHandbook: () => void;
  serverSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  lastSavedToServer?: string | null;
  storageType?: 'supabase' | 'file';
  currentUser?: AppUser | null;
  onSignOut?: () => void;
  onOpenUserProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  tasks,
  runbookCount,
  settings,
  onUpdateSettings,
  onOpenNewTask,
  onOpenQuickTriage,
  serverSyncStatus,
  lastSavedToServer,
  storageType = 'file',
  currentUser,
  onSignOut,
  onOpenUserProfile,
}) => {
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeP1Tasks = tasks.filter(t => t.priority === 'P1' && t.status !== 'done');
  const activeTasksCount = tasks.filter(t => t.status !== 'done').length;
  const resolvedTasksCount = tasks.filter(t => t.status === 'done').length;

  const handleCycleTheme = () => {
    if (!onUpdateSettings) return;
    const current = settings.themeMode || 'light';
    const nextTheme: 'light' | 'dark' | 'system' = 
      current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    onUpdateSettings({
      ...settings,
      themeMode: nextTheme,
    });
  };

  const getThemeIcon = () => {
    switch (settings.themeMode) {
      case 'dark':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      case 'system':
        return <Laptop className="w-4 h-4 text-emerald-500" />;
      case 'light':
      default:
        return <Sun className="w-4 h-4 text-amber-500" />;
    }
  };

  const getThemeLabel = () => {
    switch (settings.themeMode) {
      case 'dark':
        return 'Dark Mode';
      case 'system':
        return 'System Theme';
      case 'light':
      default:
        return 'Light Mode';
    }
  };

  const getActiveTabDetails = () => {
    switch (activeTab) {
      case 'kanban': return { icon: <Kanban className="w-3.5 h-3.5" />, label: 'Board' };
      case 'list': return { icon: <ListOrdered className="w-3.5 h-3.5" />, label: 'List' };
      case 'history': return { icon: <History className="w-3.5 h-3.5" />, label: 'History' };
      case 'handbook': return { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Handbook' };
      case 'rules': return { icon: <Zap className="w-3.5 h-3.5" />, label: 'Rules' };
      case 'analytics': return { icon: <BarChart3 className="w-3.5 h-3.5" />, label: 'Metrics' };
      case 'settings': return { icon: <Settings2 className="w-3.5 h-3.5" />, label: 'Settings' };
      default: return { icon: <Kanban className="w-3.5 h-3.5" />, label: 'Board' };
    }
  };

  const navItems = [
    { id: 'kanban', label: 'Board View', icon: <Kanban className="w-3.5 h-3.5" />, visible: settings.visibleViews.kanban },
    { id: 'list', label: 'Detailed List', icon: <ListOrdered className="w-3.5 h-3.5" />, visible: settings.visibleViews.list },
    { id: 'history', label: 'Ticket History', icon: <History className="w-3.5 h-3.5" />, visible: settings.visibleViews.history, count: resolvedTasksCount },
    { id: 'handbook', label: 'IT Handbook', icon: <BookOpen className="w-3.5 h-3.5" />, visible: settings.visibleViews.handbook },
    { id: 'rules', label: 'Automation Rules', icon: <Zap className="w-3.5 h-3.5" />, visible: settings.visibleViews.rules },
    { id: 'analytics', label: 'Ops Metrics', icon: <BarChart3 className="w-3.5 h-3.5" />, visible: settings.visibleViews.analytics },
  ];

  const currentTab = getActiveTabDetails();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-xs flex-none transition-colors duration-200">
      <div className="max-w-screen-2xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center h-14 gap-1">
          {/* Brand & Workspace Title (Left) */}
          <div className="flex items-center min-w-0">
            <div 
              onClick={() => {
                if (currentUser?.role === 'admin' && setActiveTab) {
                  setActiveTab(settings.defaultView || 'kanban');
                }
              }}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer hover:opacity-90 transition min-w-0"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0 ${
                currentUser?.role === 'user' ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}>
                {currentUser?.role === 'user' ? (
                  <LifeBuoy className="w-4 h-4" />
                ) : (
                  <TerminalSquare className="w-4 h-4" />
                )}
              </div>
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900 dark:text-white leading-none tracking-tight truncate">
                  IT Service Desk
                </span>
                {currentUser?.role === 'user' && (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                    Employee Portal
                  </span>
                )}
              </div>
            </div>

            {/* Stable Inline P1 Alert Chip if any (Admin mode only) */}
            {currentUser?.role === 'admin' && settings.showP1Banner && activeP1Tasks.length > 0 && (
              <button
                onClick={() => setActiveTab('kanban')}
                className="hidden xl:flex items-center gap-1.5 h-8 px-2 ml-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 transition shrink-0"
                title="Active Critical Task"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{activeP1Tasks.length}</span>
              </button>
            )}
          </div>

          {/* Navigation Dropdown - Centered View Switcher (Mathematically Centered) */}
          <div className="flex items-center justify-center">
            {currentUser?.role === 'admin' && (
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                  className={`group flex items-center gap-1 sm:gap-2 h-9 px-2 sm:px-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isViewDropdownOpen
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                      : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-1 rounded-md shrink-0 ${
                    isViewDropdownOpen ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {currentTab.icon}
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[50px] sm:max-w-[100px]">
                    {currentTab.label}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isViewDropdownOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden py-1.5 z-50">
                    <div className="px-3 py-1.5 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Workspace Views</span>
                    </div>
                    {navItems.filter(item => item.visible).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as ActiveTab);
                          setIsViewDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors ${
                          activeTab === item.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                            activeTab === item.id
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            {item.icon}
                          </div>
                          <span className="font-semibold">{item.label}</span>
                        </div>
                        {item.count !== undefined && item.count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            {item.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upper Right Action Controls & User Profile (Right) */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-0">
            {/* Storage Indicator - hidden on mobile */}
            <div
              className="hidden lg:flex items-center gap-1.5 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 shrink-0"
            >
              {serverSyncStatus === 'syncing' ? (
                <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${serverSyncStatus === 'synced' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              )}
              <span className="hidden xl:inline">Storage</span>
            </div>

            {/* Role-specific Admin Tools */}
            {currentUser?.role === 'admin' && (
              <>
                {/* New Task Button */}
                <button
                  onClick={onOpenNewTask}
                  className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer shrink-0"
                  title="Create New Incident Ticket"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Settings Logo / Gear */}
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition cursor-pointer shrink-0 ${
                    activeTab === 'settings'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Quick Theme Mode Switcher */}
            {onUpdateSettings && (
              <button
                type="button"
                onClick={handleCycleTheme}
                className="hidden xs:flex w-8 h-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shrink-0"
                title={`Theme Mode: ${getThemeLabel()} (Click to toggle)`}
                aria-label="Toggle Theme Mode"
              >
                {getThemeIcon()}
              </button>
            )}

            {/* User Profile Avatar Quick Access & Sign Out */}
            {currentUser && (
              <div className="flex items-center gap-1 sm:gap-1.5 pl-1 sm:pl-1.5 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenUserProfile) {
                      onOpenUserProfile();
                    } else if (setActiveTab) {
                      setActiveTab('settings');
                    }
                  }}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:ring-2 hover:ring-indigo-500/20 transition cursor-pointer overflow-hidden flex items-center justify-center p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0"
                  title={`User Profile: ${currentUser.name} (Click to open Profile Settings)`}
                  aria-label="User Profile Settings"
                >
                  <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    )}
                  </div>
                </button>

                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dropdown switch menu is now handled centrally in the main h-14 header above for all sizes */}
    </header>
  );
};

