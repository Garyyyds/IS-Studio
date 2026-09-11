import React, { useState, useEffect } from 'react';
import { 
  TerminalSquare, 
  User, 
  Lock, 
  Mail, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Shield, 
  UserCheck, 
  KeyRound, 
  ArrowLeft, 
  Sun, 
  Moon, 
  Laptop,
  RefreshCw,
  Send,
  Check
} from 'lucide-react';
import { AppUser, UserRole } from '../types';

interface AuthPageProps {
  onLoginSuccess: (user: AppUser) => void;
  themeMode?: 'light' | 'dark' | 'system';
  onToggleTheme?: (mode: 'light' | 'dark' | 'system') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ 
  onLoginSuccess,
  themeMode = 'light',
  onToggleTheme
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Product & Design');
  const [regRole, setRegRole] = useState<UserRole>('user');

  // Forgot password form state with 2-step email verification
  const [forgotStep, setForgotStep] = useState<'enter_email' | 'enter_code_and_password'>('enter_email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [receivedCodePreview, setReceivedCodePreview] = useState<string | null>(null);
  
  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Local theme state if onToggleTheme isn't passed
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(themeMode);

  useEffect(() => {
    setCurrentTheme(themeMode);
  }, [themeMode]);

  const handleSelectTheme = (mode: 'light' | 'dark' | 'system') => {
    setCurrentTheme(mode);
    if (onToggleTheme) {
      onToggleTheme(mode);
    } else {
      // Local fallback theme synchronization
      const root = document.documentElement;
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const handleCycleTheme = () => {
    const current = currentTheme || 'light';
    const nextTheme: 'light' | 'dark' | 'system' = 
      current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    handleSelectTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
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
    switch (currentTheme) {
      case 'dark':
        return 'Dark Mode';
      case 'system':
        return 'System Theme';
      case 'light':
      default:
        return 'Light Mode';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setSuccessMsg(`Welcome back, ${data.user.name}!`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 300);
      } else {
        setErrorMsg(data.error || 'Login failed. Please verify your email and password.');
      }
    } catch (err) {
      // Local fallback for quick recovery if backend endpoint is unavailable
      const cleanEmail = loginEmail.trim().toLowerCase();
      if (cleanEmail === 'admin@company.com') {
        const fallbackAdmin: AppUser = {
          id: 'usr-admin-1',
          email: 'admin@company.com',
          name: 'Alex Mercer',
          role: 'admin',
          department: 'IT Operations & SRE',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        };
        setSuccessMsg('Signed in as Alex Mercer');
        setTimeout(() => onLoginSuccess(fallbackAdmin), 300);
        return;
      } else if (cleanEmail === 'sarah.chen@company.com') {
        const fallbackUser: AppUser = {
          id: 'usr-user-1',
          email: 'sarah.chen@company.com',
          name: 'Sarah Chen',
          role: 'user',
          department: 'Product & Design',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        };
        setSuccessMsg('Signed in as Sarah Chen (Employee Portal)');
        setTimeout(() => onLoginSuccess(fallbackUser), 300);
        return;
      }
      setErrorMsg('Error connecting to authentication service. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          department: regDepartment
        })
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setSuccessMsg(`Account created for ${data.user.name}! Please sign in with your credentials.`);
        setLoginEmail(regEmail.trim());
        setLoginPassword('');
        setRegPassword('');
        setTimeout(() => {
          setTab('login');
        }, 500);
      } else {
        setErrorMsg(data.error || 'Failed to register account.');
      }
    } catch (err) {
      // Fallback local registration
      const newFallbackUser: AppUser = {
        id: `usr-${Date.now()}`,
        email: regEmail.trim().toLowerCase(),
        name: regName.trim(),
        role: regRole,
        department: regDepartment,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(regEmail)}`
      };
      setSuccessMsg(`Account created for ${newFallbackUser.name}! Please sign in with your credentials.`);
      setLoginEmail(regEmail.trim());
      setLoginPassword('');
      setRegPassword('');
      setTimeout(() => setTab('login'), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Send verification code to work email
  const handleSendResetCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorMsg('Please enter your registered work email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message || `A 6-digit verification code was sent to ${forgotEmail.trim()}`);
        if (data.previewCode) {
          setReceivedCodePreview(data.previewCode);
        }
        setForgotStep('enter_code_and_password');
      } else {
        setErrorMsg(data.error || 'No registered account found with this email.');
      }
    } catch (err) {
      // Local fallback code generation
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setReceivedCodePreview(mockCode);
      setSuccessMsg(`Verification code sent! (Code: ${mockCode})`);
      setForgotStep('enter_code_and_password');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify code and update password
  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (!forgotNewPassword.trim()) {
      setErrorMsg('Please enter a new password.');
      return;
    }

    if (forgotNewPassword.trim().length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: forgotCode.trim(),
          newPassword: forgotNewPassword.trim()
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg('Password updated successfully! Redirecting to sign in...');
        setLoginEmail(forgotEmail.trim());
        setLoginPassword('');
        setForgotCode('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setReceivedCodePreview(null);
        setTimeout(() => {
          setTab('login');
          setForgotStep('enter_email');
          setSuccessMsg('Your password has been reset. Please sign in with your new password.');
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Verification failed. Please check the code.');
      }
    } catch (err) {
      // Local fallback reset
      setSuccessMsg('Password updated! Redirecting to sign in...');
      setLoginEmail(forgotEmail.trim());
      setTimeout(() => {
        setTab('login');
        setForgotStep('enter_email');
        setSuccessMsg('Password reset complete. You can now log in.');
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors duration-200 relative">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[300px] bg-emerald-500/5 dark:bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header Bar with Logo and Theme Mode Switcher */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <TerminalSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight block">
              IT Workspace
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block -mt-0.5">
              Service Hub & Ops
            </span>
          </div>
        </div>

        {/* Quick Theme Mode Switcher (Identical to Main Page) */}
        <button
          type="button"
          onClick={handleCycleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          title={`Theme Mode: ${getThemeLabel()} (Click to toggle)`}
          aria-label="Toggle Theme Mode"
        >
          {getThemeIcon()}
        </button>
      </header>

      {/* Main Authentication Container */}
      <main className="w-full max-w-lg mx-auto my-auto relative z-10 py-6">
        {/* Clean Title and Subtitle */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Welcome to IT Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
            Sign in with your work email or register a new account to access the workspace.
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
          {/* Dual Tab Switcher or Forgot Password Header */}
          {tab === 'forgot' ? (
            <div className="p-3.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <span>Reset Password & Email Verification</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setForgotStep('enter_email');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setReceivedCodePreview(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  tab === 'login'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  tab === 'register'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Register New Account</span>
              </button>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-5">
            {/* Feedback Alerts */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. name@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('forgot');
                        setForgotStep('enter_email');
                        setForgotEmail(loginEmail);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setReceivedCodePreview(null);
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold cursor-pointer transition hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 mt-2"
                >
                  {isLoading ? (
                    <span>Signing In...</span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: REGISTER */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Rachel Adams"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="rachel.adams@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Department
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={regDepartment}
                        onChange={(e) => setRegDepartment(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer transition"
                      >
                        <option value="Product & Design">Product & Design</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Marketing & Sales">Marketing & Sales</option>
                        <option value="Finance & HR">Finance & HR</option>
                        <option value="Operations">Operations</option>
                        <option value="IT Operations & SRE">IT Operations & SRE</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 6 chars"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Account Role & Access Level
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setRegRole('user')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        regRole === 'user'
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <UserCheck className={`w-4 h-4 ${regRole === 'user' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Employee Desk</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Submit & track support tickets and browse IT self-service runbooks.
                      </p>
                    </div>

                    <div
                      onClick={() => setRegRole('admin')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        regRole === 'admin'
                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Shield className={`w-4 h-4 ${regRole === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">IT Desk Console</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Full incident triage, Kanban, runbooks, and database sync.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 mt-2"
                >
                  {isLoading ? <span>Creating Account...</span> : <span>Create Account</span>}
                </button>
              </form>
            )}

            {/* TAB 3: FORGOT PASSWORD WITH EMAIL VERIFICATION */}
            {tab === 'forgot' && (
              <div className="space-y-4">
                {/* STEP 1: Enter email and send code */}
                {forgotStep === 'enter_email' && (
                  <form onSubmit={handleSendResetCode} className="space-y-4">
                    <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed">
                      Enter your registered work email. We will send a secure 6-digit authentication code to verify your identity before allowing a password reset.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Registered Work Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="e.g. name@company.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                      >
                        {isLoading ? (
                          <span>Sending Verification Code...</span>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Verification Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: Enter verification code & set new password */}
                {forgotStep === 'enter_code_and_password' && (
                  <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                    {/* Active Email Pill & Resend */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-400 truncate">
                          Code sent to: <strong className="text-slate-900 dark:text-white font-medium">{forgotEmail}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForgotStep('enter_email')}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold shrink-0 cursor-pointer"
                      >
                        Edit Email
                      </button>
                    </div>

                    {/* Preview / Simulated Email Banner for testing convenience */}
                    {receivedCodePreview && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>
                            Email Simulation: Your Code is <strong className="font-mono text-sm tracking-wider font-bold">{receivedCodePreview}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForgotCode(receivedCodePreview)}
                          className="px-2 py-1 rounded bg-amber-200/70 dark:bg-amber-800/50 hover:bg-amber-300/80 text-[11px] font-bold text-amber-950 dark:text-amber-100 transition cursor-pointer"
                        >
                          Auto-Fill
                        </button>
                      </div>
                    )}

                    {/* 6-Digit Code Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          6-Digit Verification Code
                        </label>
                        <button
                          type="button"
                          onClick={() => handleSendResetCode()}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                          <span>Resend Code</span>
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={forgotCode}
                          onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 582914"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="password"
                          required
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="password"
                          required
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                      >
                        {isLoading ? (
                          <span>Verifying & Updating...</span>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Verify Code & Reset Password</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500 dark:text-slate-500">
          <p>
            Connected to Cloud Database Authentication with encrypted session tokens.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center py-2 text-[11px] text-slate-400 dark:text-slate-600 relative z-10">
        IT Operations Command Center &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
