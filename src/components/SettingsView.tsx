import React, { useState, useRef, useEffect } from 'react';
import { 
  UserSettings, 
  Task, 
  Runbook, 
  TaggingRule, 
  EnvironmentType, 
  ITCategory, 
  StorageStatusInfo,
  AppUser
} from '../types';
import { 
  Sliders, 
  Eye, 
  LayoutGrid, 
  List, 
  BookOpen, 
  Zap, 
  BarChart3, 
  Clock, 
  User, 
  HardDrive, 
  Download, 
  Upload, 
  Check, 
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Palette,
  Server,
  Save,
  RefreshCw,
  History,
  Database,
  Copy,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Mail,
  Building2,
  LogOut,
  RefreshCcw,
  Shield
} from 'lucide-react';

export type SettingsSection = 'profile' | 'theme' | 'views' | 'workstation' | 'defaults' | 'data';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  tasks: Task[];
  runbooks: Runbook[];
  rules: TaggingRule[];
  onImportData: (data: { tasks?: Task[]; runbooks?: Runbook[]; rules?: TaggingRule[]; settings?: UserSettings }) => void;
  onResetToDefaults: () => void;
  onClearCompletedTasks: () => void;
  serverSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  lastSavedToServer?: string | null;
  onForceSaveToServer?: () => void;
  onReloadFromServer?: () => void;
  storageInfo?: StorageStatusInfo | null;
  onRefreshStorageStatus?: () => void;
  currentUser?: AppUser | null;
  onUpdateCurrentUser?: (user: AppUser) => void;
  onSignOut?: () => void;
  activeSection?: SettingsSection;
  onSectionChange?: (section: SettingsSection) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  tasks,
  runbooks,
  rules,
  onImportData,
  onResetToDefaults,
  onClearCompletedTasks,
  serverSyncStatus,
  lastSavedToServer,
  onForceSaveToServer,
  onReloadFromServer,
  storageInfo,
  onRefreshStorageStatus,
  currentUser,
  onUpdateCurrentUser,
  onSignOut,
  activeSection: activeSectionProp,
  onSectionChange,
}) => {
  const [internalSection, setInternalSection] = useState<SettingsSection>(activeSectionProp || 'profile');
  
  useEffect(() => {
    if (activeSectionProp) {
      setInternalSection(activeSectionProp);
    }
  }, [activeSectionProp]);

  const activeSection = activeSectionProp || internalSection;

  const handleSelectSection = (sec: SettingsSection) => {
    setInternalSection(sec);
    if (onSectionChange) {
      onSectionChange(sec);
    }
  };

  // User Profile Form State
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileDepartment, setProfileDepartment] = useState(currentUser?.department || 'IT Operations');
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatar || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileDepartment(currentUser.department || 'IT Operations');
      setProfileAvatar(currentUser.avatar || '');
    }
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileFeedback({ type: 'error', message: 'Name cannot be blank.' });
      return;
    }
    if (newPassword) {
      if (newPassword.length < 6) {
        setProfileFeedback({ type: 'error', message: 'Password must be at least 6 characters long.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileFeedback({ type: 'error', message: 'Passwords do not match.' });
        return;
      }
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser?.id,
          email: currentUser?.email,
          name: profileName.trim(),
          department: profileDepartment.trim(),
          avatar: profileAvatar,
          newPassword: newPassword ? newPassword : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (onUpdateCurrentUser && data.user) {
        onUpdateCurrentUser(data.user);
      } else if (onUpdateCurrentUser && currentUser) {
        onUpdateCurrentUser({
          ...currentUser,
          name: profileName.trim(),
          department: profileDepartment.trim(),
          avatar: profileAvatar,
        });
      }

      // Also sync operator name in workstation settings if needed
      onUpdateSettings({
        ...settings,
        operatorName: profileName.trim(),
      });

      setNewPassword('');
      setConfirmPassword('');
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setTimeout(() => setProfileFeedback(null), 4000);
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Error updating user profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const AVATAR_PRESETS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Gary',
    'https://api.dicebear.com/7.x/bottts/svg?seed=TechOps',
    'https://api.dicebear.com/7.x/bottts/svg?seed=CyberAdmin',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Gary',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  ];

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    const styles = ['bottts', 'avataaars'];
    const style = styles[Math.floor(Math.random() * styles.length)];
    setProfileAvatar(`https://api.dicebear.com/7.x/${style}/svg?seed=${randomSeed}`);
  };

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [clearDoneConfirmOpen, setClearDoneConfirmOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completedTasksCount = tasks.filter(t => t.status === 'done').length;

  const viewDefinitions: Array<{
    id: keyof UserSettings['visibleViews'];
    title: string;
    description: string;
    icon: React.ReactNode;
    category: string;
  }> = [
    {
      id: 'kanban',
      title: 'Kanban Board View',
      description: 'Visual multi-column drag-and-drop workflow across Backlog, Investigating, In Progress, Blocked, Testing, and Done.',
      icon: <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      category: 'Task Workflow',
    },
    {
      id: 'list',
      title: 'Dense Task List View',
      description: 'Tabular overview with multi-column sorting, environment filters, and quick status toggles.',
      icon: <List className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
      category: 'Task Workflow',
    },
    {
      id: 'history',
      title: 'Ticket History & Resolution Archive',
      description: 'Permanent historical record of all completed incident tickets, resolution durations (MTTR), and post-mortem root causes.',
      icon: <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      category: 'Task Workflow',
    },
    {
      id: 'handbook',
      title: 'Troubleshooting & SOP Handbook',
      description: 'SRE issue-solution runbooks, interactive terminal diagnostic commands, and one-click PDF team documentation export.',
      icon: <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      category: 'Documentation',
    },
    {
      id: 'rules',
      title: 'Automated Tagging Rules',
      description: 'Keyword and regex pattern engine that auto-tags and categorises incoming logs and error traces.',
      icon: <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      category: 'Automation',
    },
    {
      id: 'analytics',
      title: 'Performance & Metrics Dashboard',
      description: 'Resolution velocity, category breakdown charts, and frequent issue root-cause analysis.',
      icon: <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      category: 'Insights',
    },
  ];

  const handleToggleView = (viewKey: keyof UserSettings['visibleViews']) => {
    const currentVal = settings.visibleViews[viewKey];
    
    // Safety check: Don't allow disabling the last remaining view
    if (currentVal) {
      const activeCount = Object.values(settings.visibleViews).filter(Boolean).length;
      if (activeCount <= 1) {
        alert('At least one navigation view must remain enabled so you can interact with your workspace.');
        return;
      }
    }

    const updatedViews = {
      ...settings.visibleViews,
      [viewKey]: !currentVal,
    };

    // If we're disabling the default view, fallback to another active view
    let updatedDefaultView = settings.defaultView;
    if (!updatedViews[settings.defaultView]) {
      const firstActive = (Object.keys(updatedViews) as Array<keyof UserSettings['visibleViews']>).find(
        (k) => updatedViews[k]
      );
      if (firstActive) {
        updatedDefaultView = firstActive;
      }
    }

    onUpdateSettings({
      ...settings,
      visibleViews: updatedViews,
      defaultView: updatedDefaultView,
    });
  };

  const handleSetAllViews = (enable: boolean) => {
    if (!enable) {
      // Keep only kanban enabled as fallback
      onUpdateSettings({
        ...settings,
        visibleViews: {
          kanban: true,
          list: false,
          history: false,
          handbook: false,
          rules: false,
          analytics: false,
        },
        defaultView: 'kanban',
      });
    } else {
      onUpdateSettings({
        ...settings,
        visibleViews: {
          kanban: true,
          list: true,
          history: true,
          handbook: true,
          rules: true,
          analytics: true,
        },
      });
    }
  };

  // Export full JSON workspace
  const handleExportJson = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tasks,
      runbooks,
      rules,
      settings,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `it-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle JSON file upload
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON format');
        }
        onImportData(parsed);
        setImportStatus(`Successfully restored workspace backup (${parsed.tasks?.length || 0} tasks, ${parsed.runbooks?.length || 0} runbooks).`);
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err: any) {
        setImportStatus(`Error importing file: ${err.message || 'Malformed JSON'}`);
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Workspace Settings & Customization
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose your theme mode, configure visible views, customize workstation defaults, and manage offline data backups.
          </p>
        </div>

        {/* Quick Mode Indicator */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className="text-slate-400 dark:text-slate-500 font-medium">Mode:</span>
          <span className="font-semibold text-indigo-700 dark:text-indigo-400">
            {settings.workstationMode === 'personal' ? 'Personal Workstation' : 'Team SRE'}
          </span>
        </div>
      </div>

      {/* Settings Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-1.5">
          <button
            onClick={() => handleSelectSection('profile')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              activeSection === 'profile'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>User Profile</span>
          </button>

          <button
            onClick={() => handleSelectSection('theme')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              activeSection === 'theme'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Theme & Appearance</span>
          </button>

          <button
            onClick={() => handleSelectSection('views')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              activeSection === 'views'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Navigation & View Visibility</span>
          </button>

          <button
            onClick={() => handleSelectSection('workstation')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              activeSection === 'workstation'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Workstation Style</span>
          </button>

          <button
            onClick={() => handleSelectSection('defaults')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              activeSection === 'defaults'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Task Defaults</span>
          </button>

          <button
            onClick={() => handleSelectSection('data')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
              activeSection === 'data'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Backup & Data Storage</span>
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="md:col-span-3 space-y-6">
          {/* SECTION: User Profile Management */}
          {activeSection === 'profile' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Profile Overview Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>User Profile & Identity</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage your operator identity, profile picture, department assignment, and security credentials.
                    </p>
                  </div>
                  {currentUser?.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      IT Operations Administrator
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 self-start sm:self-auto">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      Standard Employee
                    </span>
                  )}
                </div>

                {/* Profile Form */}
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Avatar Picker Section */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Profile Avatar
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Current Avatar Preview */}
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-200 dark:border-indigo-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-xs">
                        {profileAvatar ? (
                          <img src={profileAvatar} alt={profileName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-slate-500" />
                        )}
                      </div>

                      {/* Avatar Presets & Randomizer */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {AVATAR_PRESETS.map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setProfileAvatar(preset)}
                              className={`w-9 h-9 rounded-full overflow-hidden border-2 transition cursor-pointer p-0.5 bg-slate-100 dark:bg-slate-800 ${
                                profileAvatar === preset
                                  ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                              }`}
                            >
                              <img src={preset} alt={`Avatar preset ${idx}`} className="w-full h-full object-cover rounded-full" />
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={handleRandomizeAvatar}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
                            title="Generate a random avatar seed"
                          >
                            <RefreshCcw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Randomize</span>
                          </button>
                        </div>

                        <input
                          type="text"
                          value={profileAvatar}
                          onChange={(e) => setProfileAvatar(e.target.value)}
                          placeholder="Or paste custom image/avatar URL..."
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Account Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name / Display Identity
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                          placeholder="e.g. Gary Chen"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Department / Team
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={profileDepartment}
                          onChange={(e) => setProfileDepartment(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                          placeholder="e.g. IT Operations & Infrastructure"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Work Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="email"
                          readOnly
                          value={currentUser?.email || ''}
                          className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed select-all"
                          title="Email address is tied to your account login"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Access Role & Privileges
                      </label>
                      <div className="relative">
                        <Shield className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          readOnly
                          value={currentUser?.role === 'admin' ? 'IT Operations Admin (Full Access)' : 'Standard User / Employee'}
                          className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password & Security Subsection */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Change Workspace Password
                      </h4>
                      <span className="text-[11px] text-slate-400">(Optional, leave empty to keep current)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {profileFeedback && (
                    <div
                      className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in ${
                        profileFeedback.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {profileFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Zap className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{profileFeedback.message}</span>
                    </div>
                  )}

                  {/* Save Action Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Profile Changes</span>
                        </>
                      )}
                    </button>

                    {onSignOut && (
                      <button
                        type="button"
                        onClick={onSignOut}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium transition cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out of Workspace</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* SECTION 0: Theme & Appearance Mode */}
          {activeSection === 'theme' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Workspace Color & Theme Mode</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select your visual presentation theme. Changes take effect instantly and persist across browser sessions.
                  </p>
                </div>

                {/* Theme Mode Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Light Mode */}
                  <div
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        themeMode: 'light',
                      })
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-3 ${
                      settings.themeMode === 'light'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                          <Sun className="w-4 h-4" />
                        </div>
                        {settings.themeMode === 'light' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Light Mode</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Clean daylight aesthetic with crisp contrast, soft off-white canvas, and refined border lines.
                      </p>
                    </div>

                    {/* Visual Preview Swatch */}
                    <div className="mt-2 h-12 rounded-lg border border-slate-200 bg-slate-100 p-2 flex flex-col justify-between">
                      <div className="flex gap-1.5">
                        <div className="w-6 h-2 bg-indigo-500 rounded-sm"></div>
                        <div className="w-10 h-2 bg-slate-300 rounded-sm"></div>
                      </div>
                      <div className="h-2.5 bg-white border border-slate-200 rounded-sm"></div>
                    </div>
                  </div>

                  {/* Dark Mode */}
                  <div
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        themeMode: 'dark',
                      })
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-3 ${
                      settings.themeMode === 'dark'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center">
                          <Moon className="w-4 h-4" />
                        </div>
                        {settings.themeMode === 'dark' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Dark Mode</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Midnight SRE palette designed to minimize eye fatigue during on-call and night triage shifts.
                      </p>
                    </div>

                    {/* Visual Preview Swatch */}
                    <div className="mt-2 h-12 rounded-lg border border-slate-700 bg-slate-950 p-2 flex flex-col justify-between">
                      <div className="flex gap-1.5">
                        <div className="w-6 h-2 bg-indigo-500 rounded-sm"></div>
                        <div className="w-10 h-2 bg-slate-700 rounded-sm"></div>
                      </div>
                      <div className="h-2.5 bg-slate-900 border border-slate-800 rounded-sm"></div>
                    </div>
                  </div>

                  {/* System Mode */}
                  <div
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        themeMode: 'system',
                      })
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-3 ${
                      settings.themeMode === 'system'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                          <Laptop className="w-4 h-4" />
                        </div>
                        {settings.themeMode === 'system' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">System Sync</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Automatically adjusts to match your OS or browser system light/dark mode preference.
                      </p>
                    </div>

                    {/* Visual Preview Swatch */}
                    <div className="mt-2 h-12 rounded-lg border border-slate-300 dark:border-slate-700 bg-gradient-to-r from-slate-200 to-slate-900 p-2 flex flex-col justify-between">
                      <div className="flex gap-1.5">
                        <div className="w-6 h-2 bg-emerald-500 rounded-sm"></div>
                      </div>
                      <div className="text-[9px] text-slate-700 dark:text-slate-300 font-mono text-right">Auto OS</div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Quick shortcut: You can also toggle theme mode anytime using the sun/moon icon at the top right of the navigation bar.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: View Visibility */}
          {activeSection === 'views' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Customize Visible Views</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enable or disable specific sections from appearing in your top navigation bar.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetAllViews(true)}
                      className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                    >
                      Show All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllViews(false)}
                      className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                    >
                      Minimal (Board Only)
                    </button>
                  </div>
                </div>

                {/* View Switch Cards */}
                <div className="space-y-3">
                  {viewDefinitions.map((view) => {
                    const isVisible = settings.visibleViews[view.id];
                    const isDefault = settings.defaultView === view.id;

                    return (
                      <div
                        key={view.id}
                        className={`flex items-start justify-between gap-4 p-3.5 rounded-xl border transition ${
                          isVisible
                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                            : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                            {view.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{view.title}</h4>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                                {view.category}
                              </span>
                              {isDefault && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 font-semibold">
                                  Default View
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                              {view.description}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div className="flex items-center gap-3 shrink-0 self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleView(view.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isVisible ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                isVisible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Default Starting View Selector */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-900 dark:text-white block">
                      Default Startup View
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Choose which view automatically opens when you launch your workspace.
                    </span>
                  </div>
                  <select
                    value={settings.defaultView}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        defaultView: e.target.value as any,
                      })
                    }
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                  >
                    {Object.entries(settings.visibleViews)
                      .filter(([_, enabled]) => enabled)
                      .map(([key]) => (
                        <option key={key} value={key}>
                          {key.charAt(0).toUpperCase() + key.slice(1)} View
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Workstation mode */}
          {activeSection === 'workstation' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Personal Workstation vs Team Mode</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure how much operational detail the board surfaces on each ticket.
                  </p>
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        workstationMode: 'personal',
                      })
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      settings.workstationMode === 'personal'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Personal Workstation (Recommended)</div>
                      {settings.workstationMode === 'personal' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Optimized for self-directed engineering, personal homelabs, and internal tools. Keeps ticket cards clean and low-noise.
                    </p>
                  </div>

                  <div
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        workstationMode: 'team',
                      })
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      settings.workstationMode === 'team'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Team SRE / Shared Queue</div>
                      {settings.workstationMode === 'team' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Surfaces incident escalation workflows and richer ticket detail for a shared support queue.
                    </p>
                  </div>
                </div>

                {/* Granular Toggles */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Display Preferences
                  </h4>

                  {/* Show Automated Tags */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Show Tag Chips on Cards</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Render #tag chips directly on Kanban cards for quick filtering.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          showAutomatedTagsOnCards: !settings.showAutomatedTagsOnCards,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        settings.showAutomatedTagsOnCards ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.showAutomatedTagsOnCards ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show Checklist Progress */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Show Checklist Progress Bar</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Render visual progress bar for sub-tasks and remediation steps on cards.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          showChecklistProgressOnCards: !settings.showChecklistProgressOnCards,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        settings.showChecklistProgressOnCards ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.showChecklistProgressOnCards ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Completed Ticket Retention Window on Board/List */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Completed Ticket Retention Time Limit</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Completed tickets remain visible on active Board and List views for this duration before automatically moving to Ticket History.
                      </div>
                    </div>
                    <select
                      value={settings.completedTicketRetentionMinutes ?? 60}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          completedTicketRetentionMinutes: Number(e.target.value),
                        })
                      }
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 shrink-0"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={60}>1 Hour (Recommended)</option>
                      <option value={120}>2 Hours</option>
                      <option value={240}>4 Hours</option>
                      <option value={1440}>24 Hours (1 Day)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Task Defaults & Workstation Preferences */}
          {activeSection === 'defaults' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Task Defaults & Workstation Preferences</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure default values used when creating new tasks or authoring runbooks.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Operator / Engineer Name
                    </label>
                    <input
                      type="text"
                      value={settings.operatorName}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          operatorName: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                      placeholder="e.g. Alex Rivera or Personal Lab"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Default Environment
                    </label>
                    <select
                      value={settings.defaultEnvironment}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          defaultEnvironment: e.target.value as EnvironmentType,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                    >
                      <option value="Production">Production</option>
                      <option value="Staging">Staging</option>
                      <option value="Internal Tooling">Internal Tooling</option>
                      <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                      <option value="Corporate LAN">Corporate LAN</option>
                      <option value="DR / Failover">DR / Failover</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Default IT Category
                    </label>
                    <select
                      value={settings.defaultCategory}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          defaultCategory: e.target.value as ITCategory,
                        })
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                    >
                      <option value="DevOps & SRE">DevOps & SRE</option>
                      <option value="Database">Database</option>
                      <option value="Cloud Infra">Cloud Infra</option>
                      <option value="Security & IAM">Security & IAM</option>
                      <option value="Networking">Networking</option>
                      <option value="Application">Application</option>
                      <option value="SysAdmin">SysAdmin</option>
                    </select>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: Data Management & Backup */}
          {activeSection === 'data' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {importStatus && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Workspace Data & Cloud Sync</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect Supabase for multi-computer real-time sync, or use the local server storage file.
                  </p>
                </div>

                {/* Supabase Cloud Database Card (Permanent Multi-PC Real-Time Cloud Sync) */}
                <div className={`p-4 rounded-xl border space-y-3 ${
                  storageInfo?.supabase?.connected
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        storageInfo?.supabase?.connected
                          ? 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300'
                          : 'bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300'
                      }`}>
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                          <span>Supabase Cloud Database:</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            storageInfo?.supabase?.connected
                              ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200'
                              : 'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200'
                          }`}>
                            {storageInfo?.supabase?.connected ? 'Connected & Live' : 'Not Connected Yet'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                          {storageInfo?.supabase?.connected
                            ? 'All changes made on any computer or phone are synced to your free Supabase cloud database in real-time.'
                            : 'Sync all your tickets, SOP runbooks, rules, and settings across multiple PCs and devices using Supabase free tier (no credit card required).'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      {onRefreshStorageStatus && (
                        <button
                          type="button"
                          onClick={onRefreshStorageStatus}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                          title="Check Supabase connection status"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Check Connection</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {storageInfo?.supabase?.connected ? (
                    <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400 border-t border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Connected to table: <strong>workspace_data</strong></span>
                      </div>
                      {storageInfo.supabase.urlPreview && (
                        <p className="font-mono text-slate-500 text-[10px]">
                          Target URL: {storageInfo.supabase.urlPreview}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400 border-t border-indigo-200/60 dark:border-indigo-900/40 space-y-2.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Quick 3-Step Setup (100% Free, No Credit Card):
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                        <li>
                          Sign up for a free project at{' '}
                          <a
                            href="https://supabase.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-0.5"
                          >
                            supabase.com <ExternalLink className="w-3 h-3" />
                          </a>
                        </li>
                        <li>
                          In your project dashboard, go to <strong>Project Settings &gt; API</strong> and copy your <strong>Project URL</strong> and <strong>anon public API key</strong>.
                        </li>
                        <li>
                          Add them to your environment variables / secrets:
                          <div className="mt-1 font-mono text-[10px] bg-slate-900 text-slate-200 p-2 rounded-lg space-y-0.5">
                            <div>SUPABASE_URL=https://your-project.supabase.co</div>
                            <div>SUPABASE_ANON_KEY=eyJhbGciOi...</div>
                          </div>
                        </li>
                        <li>
                          Run this SQL query in your Supabase <strong>SQL Editor</strong> to create the storage table:
                        </li>
                      </ol>

                      <div className="relative">
                        <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-800">
{storageInfo?.supabase?.sqlSetup || `-- 1. Workspace operational data
CREATE TABLE IF NOT EXISTS workspace_data (
  id TEXT PRIMARY KEY DEFAULT 'default',
  tasks JSONB DEFAULT '[]'::jsonb,
  runbooks JSONB DEFAULT '[]'::jsonb,
  rules JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspace_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow workspace sync" ON workspace_data;
CREATE POLICY "Allow workspace sync" ON workspace_data FOR ALL USING (true) WITH CHECK (true);

-- 2. User Accounts & Role Permissions
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  department TEXT DEFAULT 'General',
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow user sync" ON app_users;
CREATE POLICY "Allow user sync" ON app_users FOR ALL USING (true) WITH CHECK (true);`}
                        </pre>
                        <button
                          type="button"
                          onClick={() => {
                            const sql = storageInfo?.supabase?.sqlSetup || `-- 1. Workspace operational data\nCREATE TABLE IF NOT EXISTS workspace_data (\n  id TEXT PRIMARY KEY DEFAULT 'default',\n  tasks JSONB DEFAULT '[]'::jsonb,\n  runbooks JSONB DEFAULT '[]'::jsonb,\n  rules JSONB DEFAULT '[]'::jsonb,\n  settings JSONB DEFAULT '{}'::jsonb,\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nALTER TABLE workspace_data ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow workspace sync" ON workspace_data;\nCREATE POLICY "Allow workspace sync" ON workspace_data FOR ALL USING (true) WITH CHECK (true);\n\n-- 2. User Accounts & Role Permissions\nCREATE TABLE IF NOT EXISTS app_users (\n  id TEXT PRIMARY KEY,\n  email TEXT UNIQUE NOT NULL,\n  password TEXT NOT NULL,\n  name TEXT NOT NULL,\n  role TEXT NOT NULL DEFAULT 'user',\n  department TEXT DEFAULT 'General',\n  avatar TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nALTER TABLE app_users ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow user sync" ON app_users;\nCREATE POLICY "Allow user sync" ON app_users FOR ALL USING (true) WITH CHECK (true);`;
                            navigator.clipboard.writeText(sql);
                            setCopiedSql(true);
                            setTimeout(() => setCopiedSql(false), 2500);
                          }}
                          className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition cursor-pointer flex items-center gap-1 border border-slate-700"
                        >
                          {copiedSql ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy SQL</span>
                            </>
                          )}
                        </button>
                      </div>

                      {storageInfo?.supabase?.error && (
                        <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                          Notice: {storageInfo.supabase.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Server File Storage Card (Local Container Backup) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                          <span>Local Server Storage File:</span>
                          <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-semibold">
                            data/server-storage.json
                          </code>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                          Always kept up-to-date as a secondary local container cache and backup file.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        serverSyncStatus === 'syncing'
                          ? 'bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200'
                          : serverSyncStatus === 'error'
                          ? 'bg-rose-100 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200'
                          : 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          serverSyncStatus === 'syncing'
                            ? 'bg-amber-500 animate-spin'
                            : serverSyncStatus === 'error'
                            ? 'bg-rose-500'
                            : 'bg-emerald-500 animate-pulse'
                        }`} />
                        {serverSyncStatus === 'syncing' ? 'Saving...' : serverSyncStatus === 'error' ? 'Connection Error' : 'File Saved'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      Last saved: <span className="font-mono text-slate-700 dark:text-slate-200 font-medium">{lastSavedToServer ? new Date(lastSavedToServer).toLocaleTimeString() : 'Just now'}</span>
                      <span className="mx-2 hidden sm:inline">•</span>
                      <span className="block sm:inline mt-0.5 sm:mt-0">
                        Content: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{tasks.length}</strong> tasks, <strong className="text-slate-700 dark:text-slate-200 font-semibold">{runbooks.length}</strong> runbooks, <strong className="text-slate-700 dark:text-slate-200 font-semibold">{rules.length}</strong> rules
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onForceSaveToServer && (
                        <button
                          type="button"
                          onClick={onForceSaveToServer}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save to File Now</span>
                        </button>
                      )}
                      {onReloadFromServer && (
                        <button
                          type="button"
                          onClick={onReloadFromServer}
                          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reload from File</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Export Backup */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Export Offline Backup (JSON)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Download all {tasks.length} tasks, {runbooks.length} runbooks, and automation rules in a portable JSON file.
                    </p>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Download JSON Backup</span>
                    </button>
                  </div>

                  {/* Import Backup */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <Upload className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>Restore from Backup</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Upload a previously exported JSON backup to restore your tasks and handbook.
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileImport}
                      accept=".json"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Select JSON File</span>
                    </button>
                  </div>
                </div>

                {/* Maintenance Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Workspace Clean Up & Reset
                  </h4>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Clear Done / Resolved Tasks</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Removes {completedTasksCount} completed tasks from the board while keeping active items intact.
                      </div>
                    </div>
                    {clearDoneConfirmOpen ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClearCompletedTasks();
                            setClearDoneConfirmOpen(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Confirm Clear ({completedTasksCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setClearDoneConfirmOpen(false)}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={completedTasksCount === 0}
                        onClick={() => setClearDoneConfirmOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition disabled:opacity-40 cursor-pointer"
                      >
                        Clear Completed
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-lg border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30">
                    <div>
                      <div className="text-xs font-bold text-rose-900 dark:text-rose-300">Reset to Factory Default Sample Data</div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400">
                        Restores initial tasks, runbooks, and automation rules to default setup.
                      </div>
                    </div>
                    {resetConfirmOpen ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onResetToDefaults();
                            setResetConfirmOpen(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Confirm Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetConfirmOpen(false)}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setResetConfirmOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-semibold transition cursor-pointer"
                      >
                        Reset All Data
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
