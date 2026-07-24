'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateRegisterNumber } from '@/lib/validation';
import { supabase } from '@/lib/supabase';
import { User, IdCard, LogIn, ArrowLeft, ShieldAlert, Cpu, Lock, KeyRound, UserPlus, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function UserLogin() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginRegNo, setLoginRegNo] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regRegNo, setRegRegNo] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handle Voter Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const trimmedRegNo = loginRegNo.trim();
    const trimmedPassword = loginPassword.trim();

    if (!trimmedRegNo || !trimmedPassword) {
      setError('Please fill in both Register Number and Password.');
      setLoading(false);
      return;
    }

    const valResult = validateRegisterNumber(trimmedRegNo);
    if (!valResult.isValid || !valResult.normalizedRegNo) {
      setError(valResult.error || 'Invalid Register Number.');
      setLoading(false);
      return;
    }

    const normalizedRegNo = valResult.normalizedRegNo;

    try {
      // Query voters table directly to avoid RPC schema cache mismatches
      const { data: userAccount, error: fetchErr } = await supabase
        .from('voters')
        .select('*')
        .eq('reg_no', normalizedRegNo)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!userAccount) {
        setError(`Register Number ${normalizedRegNo} is not registered yet. Please click 'Register First' to create your account.`);
        setLoading(false);
        return;
      }

      if (userAccount.password !== trimmedPassword) {
        setError('Invalid password. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Credentials verified successfully
      sessionStorage.setItem('voter_name', userAccount.name);
      sessionStorage.setItem('voter_reg_no', normalizedRegNo);
      router.push('/user/portal');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  // Handle Voter Account Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const trimmedName = regName.trim();
    const trimmedRegNo = regRegNo.trim();
    const trimmedPassword = regPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedName || !trimmedRegNo || !trimmedPassword || !trimmedConfirm) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    // Password must be above 6 characters (>= 6)
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError('Passwords do not match. Please verify your password.');
      setLoading(false);
      return;
    }

    const valResult = validateRegisterNumber(trimmedRegNo);
    if (!valResult.isValid || !valResult.normalizedRegNo) {
      setError(valResult.error || 'Invalid Register Number or not authorized for this symposium election.');
      setLoading(false);
      return;
    }

    const normalizedRegNo = valResult.normalizedRegNo;

    try {
      // 1. Check if Register Number is already registered in voters table
      const { data: existingUser, error: checkErr } = await supabase
        .from('voters')
        .select('reg_no')
        .eq('reg_no', normalizedRegNo)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existingUser) {
        setError(`Register Number ${normalizedRegNo} is already registered. Please switch to the Login tab.`);
        setLoading(false);
        return;
      }

      // 2. Insert new voter account directly into voters table
      const { error: insertErr } = await supabase
        .from('voters')
        .insert({
          reg_no: normalizedRegNo,
          name: trimmedName,
          password: trimmedPassword,
        });

      if (insertErr) throw insertErr;

      // Registration successful -> auto login
      sessionStorage.setItem('voter_name', trimmedName);
      sessionStorage.setItem('voter_reg_no', normalizedRegNo);
      setSuccessMsg('Account registered successfully! Redirecting to portal...');
      setTimeout(() => {
        router.push('/user/portal');
      }, 800);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="px-6 py-6 border-b border-slate-900 bg-slate-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Landing Page
          </Link>
          
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 text-xs font-medium">
            <Cpu className="w-3.5 h-3.5" /> Department of AI & DS
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-emerald-400 mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Voter Authentication</h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              Whitelisted AI & DS department voters can register or log in with their Register Number & Password.
            </p>
          </div>

          {/* Mode Tabs: Login vs Register */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Login
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Register First
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5 text-emerald-400" /> Register Number
                </label>
                <input
                  type="text"
                  required
                  value={loginRegNo}
                  onChange={(e) => setLoginRegNo(e.target.value)}
                  placeholder="e.g. 37 or 037"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Log In to Voting Portal
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5 text-emerald-400" /> Register Number
                </label>
                <input
                  type="text"
                  required
                  value={regRegNo}
                  onChange={(e) => setRegRegNo(e.target.value)}
                  placeholder="e.g. 37 or 037"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Create Password (Min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Choose a secret password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Confirm Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Register & Access Portal
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-emerald-400" /> Encrypted Credentials stored in Database
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60 bg-slate-950">
        <p>© 2026 SRM Valliammai Engineering College. Department of AI & DS</p>
      </footer>
    </div>
  );
}
