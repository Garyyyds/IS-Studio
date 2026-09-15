import React, { useState, useRef, useEffect } from 'react';
import { 
  UserSettings, 
  Task, 
  Runbook, 
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
  Shield,
  ArrowLeft,
  Inbox,
  Archive,
  Filter,
  MessageCircle,
} from 'lucide-react';
import { CHARS_PER_TOKEN, isActiveRunbook, knowledgeBaseText } from '../utils/knowledgeBase';

export type SettingsSection = 'profile' | 'theme' | 'views' | 'defaults' | 'data';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  tasks: Task[];
  runbooks: Runbook[];
  onImportData: (data: { tasks?: Task[]; runbooks?: Runbook[]; settings?: UserSettings }) => void;
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
  /** Limits the page to these sections, e.g. an employee's profile and theme. */
  allowedSections?: SettingsSection[];
  /** Shown as a Back button in the header when set. */
  onBack?: () => void;
}

/** Shown when the server cannot be reached to supply its own setup notes. */
const SQL_SETUP_HINT = '-- Run db/schema.sql from the project in the Supabase SQL Editor, then any files in db/patches/.';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  tasks,
  runbooks,
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
  allowedSections,
  onBack,
  onSectionChange,
}) => {
  const [internalSection, setInternalSection] = useState<SettingsSection>(activeSectionProp || 'profile');
  
  useEffect(() => {
    if (activeSectionProp) {
      setInternalSection(activeSectionProp);
    }
  }, [activeSectionProp]);

  const requestedSection = activeSectionProp || internalSection;
  const isAllowed = (section: SettingsSection) => !allowedSections || allowedSections.includes(section);
  // A section outside the allowed set falls back to the first one allowed.
  const activeSection =
    isAllowed(requestedSection) || !allowedSections?.length ? requestedSection : allowedSections[0];
  const isPersonalOnly = Boolean(allowedSections);

  const handleSelectSection = (sec: SettingsSection) => {
    setInternalSection(sec);
    if (onSectionChange) {
      onSectionChange(sec);
    }
  };

  // User Profile Form State
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileDepartment, setProfileDepartment] = useState(currentUser?.department || 'IT Operations');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileDepartment(currentUser.department || 'IT Operations');
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
        });
      }

      // Also sync the operator name into the task defaults. That setting
      // is shared by the whole workspace, so only the full settings page does it.
      if (!isPersonalOnly) {
        onUpdateSettings({
          ...settings,
          operatorName: profileName.trim(),
        });
      }

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
      description: 'Tabular overview with multi-column sorting, category filters, and quick status toggles.',
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
      id: 'forms',
      title: 'Form Inbox',
      description: 'Requisition, user ID, asset allocation and asset disposal forms submitted by employees, one lane per form.',
      icon: <Inbox className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      category: 'Task Workflow',
    },
    {
      id: 'formHistory',
      title: 'Form History',
      description: 'Forms marked Done in the Form Inbox, kept separately for each form type.',
      icon: <Archive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
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
      id: 'analytics',
      title: 'Performance & Metrics Dashboard',
      description: 'Resolution velocity, category breakdown charts, and frequent issue root-cause analysis.',
      icon: <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      category: 'Insights',
    },
  ];

  // The form workspaces arrived after settings were first saved, so they are on
  // unless they have been switched off.
  const withFormViews = () => ({ forms: true, formHistory: true, ...settings.visibleViews });
  const isViewOn = (viewKey: keyof UserSettings['visibleViews']) => withFormViews()[viewKey] !== false;

  const handleToggleView = (viewKey: keyof UserSettings['visibleViews']) => {
    const currentVal = isViewOn(viewKey);
    
    // Safety check: Don't allow disabling the last remaining view
    if (currentVal) {
      const activeCount = Object.values(withFormViews()).filter(Boolean).length;
      if (activeCount <= 1) {
        alert('At least one navigation view must remain enabled so you can interact with your workspace.');
        return;
      }
    }

    const updatedViews = {
      ...withFormViews(),
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
          analytics: false,
          forms: false,
          formHistory: false,
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
          analytics: true,
          forms: true,
          formHistory: true,
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
              {isPersonalOnly ? 'My Settings' : 'Workspace Settings & Customization'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isPersonalOnly
              ? 'Update your profile and choose how the app looks on this device.'
              : 'Choose your theme mode, configure visible views, set task defaults, and manage offline data backups.'}
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal</span>
          </button>
        )}

      </div>

      {/* Settings Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-1.5">
          {isAllowed('profile') && (
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
          )}

          {isAllowed('theme') && (
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
          )}

          {isAllowed('views') && (
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
          )}

          {isAllowed('defaults') && (
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
          )}

          {isAllowed('data') && (
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
          )}
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
                      Manage your name, department assignment, and security credentials.
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
                  {/* Account Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    Select your visual presentation theme. Changes take effect instantly and are saved on this device only.
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
                    const isVisible = isViewOn(view.id);
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
                    {Object.entries(withFormViews())
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

          {/* SECTION: Task Defaults */}
          {activeSection === 'defaults' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Task Defaults</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    How long resolved tickets stay on the board, and how much of the IT Handbook the IT Assistant reads.
                  </p>
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

                  {/* IT Assistant knowledge base mode */}
                  {(() => {
                    const mode = settings.chatKnowledgeMode === 'full' ? 'full' : 'scoped';
                    const activeGuides = runbooks.filter(isActiveRunbook);
                    const handbookChars = knowledgeBaseText(activeGuides).length;
                    const options = [
                      {
                        id: 'scoped' as const,
                        title: 'Scoped (recommended)',
                        description:
                          'Send only the guides relevant to the question. Faster and much cheaper as the handbook grows.',
                        icon: <Filter className="w-4 h-4" />,
                        iconClass: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300',
                      },
                      {
                        id: 'full' as const,
                        title: 'Full access',
                        description:
                          'Send the whole handbook every message. Highest coverage, slow and expensive at scale.',
                        icon: <BookOpen className="w-4 h-4" />,
                        iconClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
                      },
                    ];
                    return (
                      <div data-chat-knowledge-setting className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>IT Assistant Knowledge Base</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              How many IT Handbook guides the employee IT Assistant reads for each question.
                            </div>
                          </div>
                          <span
                            data-handbook-size
                            className="self-start text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono font-bold whitespace-nowrap"
                            title="Size of the whole handbook as sent in full access mode"
                          >
                            {activeGuides.length} active guide{activeGuides.length === 1 ? '' : 's'} · ~
                            {handbookChars.toLocaleString()} chars (~{Math.round(handbookChars / CHARS_PER_TOKEN).toLocaleString()} tokens)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="IT Assistant knowledge base">
                          {options.map((option) => {
                            const selected = mode === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                data-knowledge-mode={option.id}
                                onClick={() => onUpdateSettings({ ...settings, chatKnowledgeMode: option.id })}
                                className={`text-left p-4 rounded-xl border cursor-pointer transition ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${option.iconClass}`}>
                                    {option.icon}
                                  </div>
                                  {selected && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Active
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{option.title}</h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                  {option.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
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
                            : 'Sync all your tickets, SOP runbooks and settings across multiple PCs and devices using Supabase free tier (no credit card required).'}
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
                        <span>Connected to the workspace tables (tickets, runbooks, forms, settings)</span>
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
                          Create the workspace tables in your Supabase <strong>SQL Editor</strong>:
                        </li>
                      </ol>

                      <div className="relative">
                        <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-800">
{storageInfo?.supabase?.sqlSetup || SQL_SETUP_HINT}
                        </pre>
                        <button
                          type="button"
                          onClick={() => {
                            const sql = storageInfo?.supabase?.sqlSetup || SQL_SETUP_HINT;
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
                          <span>Saving:</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                          Each ticket, guide and setting is saved on its own as soon as you change it.
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
                        {serverSyncStatus === 'syncing' ? 'Saving...' : serverSyncStatus === 'error' ? 'Connection Error' : 'All Saved'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      Last saved: <span className="font-mono text-slate-700 dark:text-slate-200 font-medium">{lastSavedToServer ? new Date(lastSavedToServer).toLocaleTimeString() : 'Just now'}</span>
                      <span className="mx-2 hidden sm:inline">•</span>
                      <span className="block sm:inline mt-0.5 sm:mt-0">
                        Content: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{tasks.length}</strong> tasks and <strong className="text-slate-700 dark:text-slate-200 font-semibold">{runbooks.length}</strong> runbooks
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
                          <span>Check Connection</span>
                        </button>
                      )}
                      {onReloadFromServer && (
                        <button
                          type="button"
                          onClick={onReloadFromServer}
                          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reload Latest</span>
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
                      Download all {tasks.length} tasks, {runbooks.length} runbooks and settings in a portable JSON file.
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
                        Restores initial tasks, runbooks and settings to default setup.
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
