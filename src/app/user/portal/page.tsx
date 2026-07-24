'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Vote, 
  User, 
  IdCard, 
  CheckCircle2, 
  Loader2, 
  Cpu, 
  LogOut, 
  ChevronRight, 
  Sparkles,
  Award,
  Eye,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

interface VoterElectionItem {
  election_id: string;
  election_title: string;
  created_at: string;
  has_voted: boolean;
}

export default function UserPortal() {
  const [voterName, setVoterName] = useState<string | null>(null);
  const [voterRegNo, setVoterRegNo] = useState<string | null>(null);
  const [elections, setElections] = useState<VoterElectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch elections status for current voter
  const fetchPortalData = useCallback(async (regNo: string) => {
    try {
      const { data, error } = await supabase.rpc('get_voter_elections_status', {
        p_reg_no: regNo,
      });

      if (error) throw error;
      setElections(data || []);
    } catch (err: unknown) {
      console.error('Error fetching portal data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Verify session
  useEffect(() => {
    const storedName = sessionStorage.getItem('voter_name');
    const storedRegNo = sessionStorage.getItem('voter_reg_no');

    if (!storedName || !storedRegNo) {
      router.replace('/user/login');
      return;
    }

    setVoterName(storedName);
    setVoterRegNo(storedRegNo);
    fetchPortalData(storedRegNo);
  }, [router, fetchPortalData]);

  // Realtime subscription for live election additions & vote updates
  useEffect(() => {
    if (!voterRegNo) return;

    const channel = supabase
      .channel(`user-portal-realtime-${voterRegNo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elections' }, () => {
        fetchPortalData(voterRegNo);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        fetchPortalData(voterRegNo);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [voterRegNo, fetchPortalData]);

  const handleExit = () => {
    sessionStorage.clear();
    router.push('/');
  };

  const totalElections = elections.length;
  const votedElectionsCount = elections.filter((e) => e.has_voted).length;
  const isAllCompleted = totalElections > 0 && votedElectionsCount === totalElections;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading your election portal...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-indigo-500 p-2 rounded-xl">
              <Cpu className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">SRM Valliammai Engineering College</span>
              <span className="text-xs font-semibold text-slate-200">Department of AI & DS</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-900 px-4 py-2 rounded-xl text-xs">
              <div className="flex items-center gap-1 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span className="font-semibold text-slate-300">{voterName}</span>
              </div>
              <div className="w-px h-3 bg-slate-800" />
              <div className="flex items-center gap-1 text-slate-400">
                <IdCard className="w-3.5 h-3.5" />
                <span className="font-mono text-slate-300">Reg: {voterRegNo}</span>
              </div>
            </div>
            <button
              onClick={handleExit}
              className="text-slate-500 hover:text-red-400 transition-colors p-2"
              title="Sign Out Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Welcome Banner */}
        <div className="text-center space-y-3">
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Symposium Election Hub
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Active Role Elections
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            You are eligible to vote once for each active role below. Click any election to enter its live arena or view real-time standings.
          </p>
        </div>

        {/* Voter Turnout Progress */}
        {totalElections > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-3 max-w-2xl mx-auto">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" /> Your Voting Progress
              </span>
              <span className="font-bold text-emerald-400">
                {votedElectionsCount} of {totalElections} Roles Voted
              </span>
            </div>
            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-500 rounded-full"
                style={{ width: `${(votedElectionsCount / totalElections) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Completion Celebration Badge */}
        {isAllCompleted && (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2 max-w-2xl mx-auto shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]">
            <div className="inline-flex bg-emerald-500/20 p-3 rounded-full text-emerald-400 mb-1">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">All Elections Completed!</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Thank you, {voterName}! You have submitted secret ballots for all active election posts. You can still re-enter any election below to observe real-time vote updates live.
            </p>
          </div>
        )}

        {/* Elections Grid */}
        {totalElections > 0 ? (
          <div className="grid md:grid-cols-2 gap-6 pt-2 max-w-3xl mx-auto">
            {elections.map((election) => (
              <div
                key={election.election_id}
                className={`group relative bg-slate-900/60 border rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 flex flex-col justify-between gap-6 overflow-hidden ${
                  election.has_voted 
                    ? 'border-emerald-500/40 bg-slate-900/80 hover:border-emerald-500/70' 
                    : 'border-slate-800 hover:border-emerald-500/50 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Symposium Post</span>
                    {election.has_voted ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Voted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-semibold rounded-full">
                        Action Required
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {election.election_title}
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {election.has_voted 
                      ? 'Your vote is recorded. Click below to view live candidate standings.' 
                      : 'Cast your vote securely for candidate standing in this role.'}
                  </p>
                </div>

                <div>
                  {election.has_voted ? (
                    <Link
                      href={`/user/vote?electionId=${election.election_id}`}
                      className="w-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-emerald-400 font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all group-hover:translate-x-0.5"
                    >
                      <Eye className="w-4 h-4 text-emerald-400" /> View Live Standings <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  ) : (
                    <Link
                      href={`/user/vote?electionId=${election.election_id}`}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-xs flex items-center justify-center gap-1.5 group-hover:translate-x-0.5"
                    >
                      <Vote className="w-4 h-4" /> Cast Vote <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500 border border-dashed border-slate-900 rounded-2xl bg-slate-950/40">
            <Vote className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-white font-semibold text-base">No Active Elections Available</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              The administrator has not launched any active elections yet. Please refresh or check back shortly.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60 bg-slate-950">
        <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium</p>
      </footer>
    </div>
  );
}
