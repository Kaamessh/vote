'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TOTAL_ELIGIBLE_VOTERS } from '@/lib/validation';
import { 
  Vote, 
  User, 
  IdCard, 
  CheckCircle2, 
  Loader2, 
  Cpu, 
  AlertTriangle,
  LogOut,
  Flame,
  Users,
  Clock,
  Award
} from 'lucide-react';
import Link from 'next/link';

interface Candidate {
  id: string;
  name: string;
  votes_count: number;
}

export default function UserVoteArena() {
  const [voterName, setVoterName] = useState<string | null>(null);
  const [voterRegNo, setVoterRegNo] = useState<string | null>(null);
  const [activeElectionId, setActiveElectionId] = useState<string | null>(null);
  const [electionTitle, setElectionTitle] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [votedForName, setVotedForName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  // Validate session and check eligibility
  useEffect(() => {
    const verifyVoterSession = async () => {
      const storedName = sessionStorage.getItem('voter_name');
      const storedRegNo = sessionStorage.getItem('voter_reg_no');
      const storedStatus = sessionStorage.getItem('voter_status');
      const storedElectionId = sessionStorage.getItem('active_election_id');

      if (!storedName || !storedRegNo || !storedStatus || !storedElectionId) {
        router.replace('/user/login');
        return;
      }

      setVoterName(storedName);
      setVoterRegNo(storedRegNo);
      setActiveElectionId(storedElectionId);

      try {
        // Double check against database using normalized reg number
        const { data: hasVoted, error: checkError } = await supabase.rpc('check_has_voted', {
          p_reg_no: storedRegNo,
          p_election_id: storedElectionId,
        });

        if (checkError) throw checkError;

        if (hasVoted || storedStatus === 'already_voted') {
          sessionStorage.setItem('voter_status', 'already_voted');
          router.replace('/user/login');
          return;
        }

        // Fetch active election details
        const { data: election, error: electionError } = await supabase
          .from('elections')
          .select('id, title, is_active')
          .eq('id', storedElectionId)
          .maybeSingle();

        if (electionError) throw electionError;

        if (!election || !election.is_active) {
          setErrorMsg('This election is no longer active.');
          setCheckingEligibility(false);
          return;
        }

        setElectionTitle(election.title);

        // Fetch candidates
        const { data: candidatesList, error: candidatesError } = await supabase
          .from('candidates')
          .select('id, name, votes_count')
          .eq('election_id', storedElectionId)
          .order('name', { ascending: true });

        if (candidatesError) throw candidatesError;

        setCandidates(candidatesList || []);
      } catch (err: any) {
        console.error('Error verifying voter:', err);
        setErrorMsg('Error verifying voting session. Please login again.');
      } finally {
        setCheckingEligibility(false);
      }
    };

    verifyVoterSession();
  }, [router]);

  // Realtime listener for candidate vote changes
  useEffect(() => {
    if (!activeElectionId) return;

    const candidateChannel = supabase
      .channel('voter-candidates-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidates',
          filter: `election_id=eq.${activeElectionId}`,
        },
        () => {
          const refetchCandidates = async () => {
            const { data } = await supabase
              .from('candidates')
              .select('id, name, votes_count')
              .eq('election_id', activeElectionId)
              .order('name', { ascending: true });
            if (data) {
              setCandidates(data);
            }
          };
          refetchCandidates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(candidateChannel);
    };
  }, [activeElectionId]);

  const handleCastVote = async () => {
    if (!selectedCandidateId || !activeElectionId || !voterName || !voterRegNo) return;
    
    setIsSubmittingVote(true);
    setErrorMsg(null);

    const selectedCandidateName = candidates.find(c => c.id === selectedCandidateId)?.name || 'Candidate';

    try {
      // 1. Insert vote into database
      const { error } = await supabase
        .from('votes')
        .insert({
          election_id: activeElectionId,
          candidate_id: selectedCandidateId,
          voter_name: voterName,
          voter_reg_no: voterRegNo,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Our security system detected you have already voted in this election.');
        }
        throw error;
      }

      // 2. Mark as voted in session storage and show success
      sessionStorage.setItem('voter_status', 'already_voted');
      setVotedForName(selectedCandidateName);
      setVoteSuccess(true);
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setErrorMsg(err.message || 'Failed to submit vote. Please try again.');
      
      if (err.message?.includes('already voted')) {
        setTimeout(() => {
          router.replace('/user/login');
        }, 3000);
      }
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleExit = () => {
    sessionStorage.clear();
    router.push('/');
  };

  const totalVotesCast = candidates.reduce((acc, curr) => acc + curr.votes_count, 0);
  const remainingVoters = Math.max(0, TOTAL_ELIGIBLE_VOTERS - totalVotesCast);

  if (checkingEligibility) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading voting ballot...</p>
      </div>
    );
  }

  // Success UI
  if (voteSuccess) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wider text-slate-400 uppercase">SRM Valliammai Engineering College</span>
            <span className="text-xs px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold rounded">Ballot Cast</span>
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)]">
            <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 w-16 h-16 rounded-full items-center justify-center text-emerald-400 mb-2 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Thank You for Voting!</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your vote for <span className="font-semibold text-emerald-400">{votedForName}</span> has been securely transmitted and recorded in the database.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-900 rounded-xl text-left text-xs text-slate-500 space-y-1 font-mono">
              <p>Voter Name: {voterName}</p>
              <p>Reg Number: {voterRegNo}</p>
              <p>Election: {electionTitle}</p>
              <p>Status: CONFIRMED</p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleExit}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-sm"
              >
                Return to Home
              </button>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60">
          <p>© 2026 SRM Valliammai Engineering College. AI & DS Department</p>
        </footer>
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
                <span className="font-mono text-slate-300">{voterRegNo}</span>
              </div>
            </div>
            <button
              onClick={handleExit}
              className="text-slate-500 hover:text-red-400 transition-colors p-2"
              title="Exit Arena"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main voting card */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-10 flex flex-col justify-center space-y-8">
        
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-start gap-2 max-w-2xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!errorMsg && (
          <div className="space-y-8">
            {/* Title / Role header */}
            <div className="text-center space-y-3">
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 animate-pulse">
                <Flame className="w-3.5 h-3.5" /> Live Symposium Election
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                Cast Vote: {electionTitle}
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
                Review the candidates below. Live vote counts update in real-time. Select your choice and submit.
              </p>
            </div>

            {/* Voter Turnout Summary Banner */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center backdrop-blur-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-indigo-400" /> Total Voters
                </span>
                <span className="text-xl md:text-2xl font-bold text-white block">
                  {TOTAL_ELIGIBLE_VOTERS}
                </span>
              </div>

              <div className="space-y-1 border-x border-slate-800">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block flex items-center justify-center gap-1">
                  <Award className="w-3 h-3 text-emerald-400" /> Votes Cast
                </span>
                <span className="text-xl md:text-2xl font-bold text-emerald-400 block">
                  {totalVotesCast}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Remaining
                </span>
                <span className="text-xl md:text-2xl font-bold text-amber-400 block">
                  {remainingVoters}
                </span>
              </div>
            </div>

            {/* Candidates Selection Grid */}
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-2">
              {candidates.map((cand) => {
                const isSelected = selectedCandidateId === cand.id;
                const percentage = totalVotesCast > 0 ? Math.round((cand.votes_count / totalVotesCast) * 100) : 0;
                
                return (
                  <button
                    key={cand.id}
                    onClick={() => setSelectedCandidateId(cand.id)}
                    className={`group relative text-left bg-slate-900/60 border rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between gap-5 overflow-hidden ${
                      isSelected 
                        ? 'border-emerald-500 shadow-[0_0_25px_-5px_rgba(16,185,129,0.15)] bg-slate-900/90' 
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                    }`}
                  >
                    {/* Selected state background accent */}
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {cand.name}
                        </h3>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-500 text-slate-950' 
                            : 'border-slate-700 group-hover:border-slate-500'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[3]" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">Department of AI & DS Candidate</p>
                    </div>

                    {/* Real-time stats display per candidate */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-500">Live Standing</span>
                        <span className="text-emerald-400 font-bold">{cand.votes_count} {cand.votes_count === 1 ? 'vote' : 'votes'} ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Voting Submission actions */}
            <div className="max-w-md mx-auto pt-4 text-center space-y-4">
              <button
                onClick={handleCastVote}
                disabled={!selectedCandidateId || isSubmittingVote}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/35 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base uppercase tracking-wider"
              >
                {isSubmittingVote ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Casting Ballot...
                  </>
                ) : (
                  <>
                    <Vote className="w-5 h-5" /> Submit My Secret Ballot
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-600 leading-normal">
                By submitting this ballot, you confirm that you are the rightful owner of Register Number <span className="font-mono">{voterRegNo}</span>. Your vote is secure, and you will not be allowed to change it or vote again unless reset by the administrator.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60 bg-slate-950">
        <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium Voting Arena</p>
      </footer>
    </div>
  );
}
