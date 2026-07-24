'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateRegisterNumber } from '@/lib/validation';
import { supabase } from '@/lib/supabase';
import { User, IdCard, LogIn, ArrowLeft, ShieldAlert, Cpu, Lock } from 'lucide-react';
import Link from 'next/link';

export default function UserLogin() {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedName = name.trim();
    const trimmedRegNo = regNo.trim();

    if (!trimmedName || !trimmedRegNo) {
      setError('Please fill in all fields.');
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
      // Get or generate persistent Device ID for single-device locking
      let deviceId = localStorage.getItem('voter_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('voter_device_id', deviceId);
      }

      // Verify single-device lock via Supabase RPC
      const { data, error: rpcError } = await supabase.rpc('register_voter_device', {
        p_name: trimmedName,
        p_reg_no: normalizedRegNo,
        p_device_id: deviceId,
      });

      if (rpcError) throw rpcError;

      if (data && data.length > 0 && !data[0].success) {
        setError(data[0].message || 'User already registered on another device.');
        setLoading(false);
        return;
      }

      // Session granted for this device
      sessionStorage.setItem('voter_name', trimmedName);
      sessionStorage.setItem('voter_reg_no', normalizedRegNo);
      router.push('/user/portal');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Verification failed. Please try again.');
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

      {/* Main Form */}
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-emerald-400 mb-2">
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Voter Verification</h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              Enter your credentials to access active election roles. Only whitelisted AI & DS department voters are permitted.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. 01 or 1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-mono"
              />
              <p className="text-[10px] text-slate-500">
                Leading zeros are automatically recognized (e.g. 01 and 1 are identical).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-2"
            >
              {loading ? (
                'Verifying Device Lock...'
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Enter Voting Portal
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800/80 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-emerald-400" /> Single-Device Session Enforced (One device per voter)
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
