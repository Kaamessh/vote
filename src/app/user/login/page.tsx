'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { validateRegisterNumber } from '@/lib/validation';
import { UserCheck, HelpCircle, ArrowLeft, Loader2, Cpu, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function UserLogin() {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [activeElectionId, setActiveElectionId] = useState<string | null>(null);
  const [electionTitle, setElectionTitle] = useState<string | null>(null);
  
  const [checkingElection, setCheckingElection] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasVotedState, setHasVotedState] = useState(false);
  const [canonicalRegNo, setCanonicalRegNo] = useState<string>('');
  const router = useRouter();

  // Check for active election
  useEffect(() => {
    const checkActiveElection = async () => {
      try {
        const { data, error } = await supabase
          .from('elections')
          .select('id, title')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setActiveElectionId(data.id);
          setElectionTitle(data.title);
        }
      } catch (err: unknown) {
        console.error('Error fetching active election:', err);
        setErrorMsg('Error contacting database. Please refresh the page.');
      } finally {
        setCheckingElection(false);
      }
    };
    
    checkActiveElection();
  }, []);

  const handleRegNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numbers and restrict to 3 digits max
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 3) {
      setRegNo(val);
      setErrorMsg(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setHasVotedState(false);

    if (!activeElectionId) {
      setErrorMsg('No active election found. You cannot log in.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter your Name.');
      return;
    }

    // Validation & Normalization (e.g., 01 -> 1, 034 -> 34)
    const validation = validateRegisterNumber(regNo);
    if (!validation.isValid || !validation.normalizedRegNo) {
      setErrorMsg(validation.error || 'Invalid Number');
      return;
    }

    const normalizedReg = validation.normalizedRegNo;
    setCanonicalRegNo(normalizedReg);
    setIsLoading(true);

    try {
      // Secure check via RPC using normalized register number
      const { data: hasVoted, error } = await supabase.rpc('check_has_voted', {
        p_reg_no: normalizedReg,
        p_election_id: activeElectionId,
      });

      if (error) throw error;

      if (hasVoted) {
        setHasVotedState(true);
        sessionStorage.setItem('voter_name', trimmedName);
        sessionStorage.setItem('voter_reg_no', normalizedReg);
        sessionStorage.setItem('voter_status', 'already_voted');
      } else {
        // Successful login, save normalized details
        sessionStorage.setItem('voter_name', trimmedName);
        sessionStorage.setItem('voter_reg_no', normalizedReg);
        sessionStorage.setItem('voter_status', 'eligible');
        sessionStorage.setItem('active_election_id', activeElectionId);
        
        router.push('/user/vote');
      }
    } catch (err: any) {
      console.error('Error during login check:', err);
      setErrorMsg(err.message || 'An error occurred during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingElection) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Verifying election connection...</p>
      </div>
    );
  }

  // Already Voted State UI
  if (hasVotedState) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <header className="border-b border-slate-900/80 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> Exit Portal
            </Link>
            <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">SRM VEC AI & DS</span>
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-[0_0_50px_-12px_rgba(239,68,68,0.1)]">
            <div className="inline-flex bg-red-500/10 border border-red-500/20 w-16 h-16 rounded-full items-center justify-center text-red-400 mb-2">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Access Denied</h1>
              <h2 className="text-red-400 font-semibold uppercase tracking-wider text-sm">Already Voted</h2>
              <p className="text-slate-400 text-sm leading-relaxed mt-4">
                Dear <span className="font-semibold text-white">{name}</span> (Reg. No: <span className="font-mono text-white">{canonicalRegNo || regNo}</span>), our records show that a ballot has already been submitted under this register number for the current election <span className="text-white italic">"{electionTitle}"</span>.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => {
                  setHasVotedState(false);
                  setName('');
                  setRegNo('');
                }}
                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all text-sm"
              >
                Try Different Register Number
              </button>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60">
          <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Main
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-indigo-500 p-2 rounded-xl">
              <Cpu className="w-5 h-5 text-slate-950" />
            </div>
            <span className="text-xs md:text-sm font-semibold tracking-wider text-slate-200">SRM VEC AI & DS</span>
          </div>
        </div>
      </header>

      {/* Login Form */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-[0_0_50px_-12px_rgba(16,185,129,0.1)]">
          
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 w-12 h-12 rounded-xl items-center justify-center text-emerald-400 mb-2">
              <UserCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">Voter Verification</h1>
            {activeElectionId ? (
              <p className="text-slate-400 text-xs md:text-sm">
                Active Election: <span className="text-emerald-400 font-semibold">{electionTitle}</span>
              </p>
            ) : (
              <p className="text-slate-500 text-xs md:text-sm">Voter eligibility & registration terminal</p>
            )}
          </div>

          {!activeElectionId ? (
            <div className="p-5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto" />
              <h3 className="font-semibold text-yellow-500 text-sm">Voting is Closed</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                There are no active elections running right now. Please wait for the event administrator to launch the live poll.
              </p>
              <Link
                href="/"
                className="inline-block text-xs bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Go to Landing Page
              </Link>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="regNo" className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                      Register Number
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Max 3 digits</span>
                  </div>
                  <input
                    id="regNo"
                    type="text"
                    required
                    value={regNo}
                    onChange={handleRegNoChange}
                    placeholder="e.g. 1, 01, 301, 701"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-mono"
                  />
                </div>

                {/* Info Box */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-900 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
                  <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-300">Eligibility Criteria</p>
                    <p className="mt-1 text-slate-500">Only whitelisted roll numbers for AI & DS department are eligible. Leading zeros (e.g. 01 and 1) are treated as identical.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !name || !regNo}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    'Verify & Enter Arena'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60">
        <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium</p>
      </footer>
    </div>
  );
}
