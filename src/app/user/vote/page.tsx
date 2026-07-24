'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Award,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface Candidate {
  id: string;
  name: string;
  votes_count: number;
}

function VotingArenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetElectionId = searchParams.get('electionId');

  const [voterName, setVoterName] = useState<string | null>(null);
  const [voterRegNo, setVoterRegNo] = useState<string | null>(null);
  const [electionTitle, setElectionTitle] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [alreadyVotedThisRole, setAlreadyVotedThisRole] = useState(false);
  const [votedForName, setVotedForName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const verifyVoterSession = async () => {
      const storedName = sessionStorage.getItem('voter_name');
      const storedRegNo = sessionStorage.getItem('voter_reg_no');

      if (!storedName || !storedRegNo) {
        router.replace('/user/login');
        return;
      }

      if (!targetElectionId) {
        router.replace('/user/portal');
        return;
      }

      setVoterName(storedName);
      setVoterRegNo(storedRegNo);

      try {
        // 1. Check if voter already voted for THIS specific election role
        const { data: hasVoted, error: checkError } = await supabase.rpc('check_has_voted', {
          p_reg_no: storedRegNo,
          p_election_id: targetElectionId,
        });

        if (checkError) throw checkError;

        if (hasVoted) {
          setAlreadyVotedThisRole(true);
          setCheckingEligibility(false);
          return;
        }

        // 2. Fetch target election details
        const { data: election, error: electionError } = await supabase
          .from('elections')
          .select('id, title, is_active')
          .eq('id', targetElectionId)
          .maybeSingle();

        if (electionError) throw electionError;

        if (!election || !election.is_active) {
          setErrorMsg('This election role is no longer active.');
          setCheckingEligibility(false);
          return;
        }

        setElectionTitle(election.title);

        // 3. Fetch candidates
        const { data: candidatesList, error: candidatesError } = await supabase
          .from('candidates')
          .select('id, name, votes_count')
          .eq('election_id', targetElectionId)
          .order('name', { ascending: true });

        if (candidatesError) throw candidatesError;

        setCandidates(candidatesList || []);
      } catch (err: any) {
        console.error('Error verifying voter session:', err);
        setErrorMsg('Error loading voting ballot. Please return to portal.');
      } finally {
        setCheckingEligibility(false);
      }
    };

    verifyVoterSession();
  }, [router, targetElectionId]);

  // Realtime listener for live vote counts
  useEffect(() => {
    if (!targetElectionId) return;

    const candidateChannel = supabase
      .channel(`voter-candidates-live-${targetElectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidates',
          filter: `election_id=eq.${targetElectionId}`,
        },
        () => {
          const refetchCandidates = async () => {
            const { data } = await supabase
              .from('candidates')
              .select('id, name, votes_count')
              .eq('election_id', targetElectionId)
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
  }, [targetElectionId]);

  const handleCastVote = async () => {
    if (!selectedCandidateId || !targetElectionId || !voterName || !voterRegNo) return;
    
    setIsSubmittingVote(true);
    setErrorMsg(null);

    const selectedCandidateName = candidates.find(c => c.id === selectedCandidateId)?.name || 'Candidate';

    try {
      const { error } = await supabase
        .from('votes')
        .insert({
          election_id: targetElectionId,
          candidate_id: selectedCandidateId,
          voter_name: voterName,
          voter_reg_no: voterRegNo,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Our security system detected you have already voted for this election role.');
        }
        throw error;
      }

      setVotedForName(selectedCandidateName);
      setVoteSuccess(true);
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setErrorMsg(err.message || 'Failed to submit vote. Please try again.');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleBackToPortal = () => {
    router.push('/user/portal');
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

  // Already Voted this Role UI
  if (alreadyVotedThisRole) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
        <header className="border-b border-slate-900/80 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/user/portal" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to Elections Portal
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
              <h1 className="text-2xl font-bold text-white">Ballot Already Submitted</h1>
              <p className="text-slate-400 text-sm leading-relaxed mt-4">
                You have already cast your vote for this election post under Register Number <span className="font-mono text-white">{voterRegNo}</span>.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={handleBackToPortal}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-all text-sm"
              >
                Return to Elections Portal
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
              <h1 className="text-2xl font-bold text-white">Vote Recorded!</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your vote for <span className="font-semibold text-emerald-400">{votedForName}</span> in <span className="text-white italic">"{electionTitle}"</span> has been securely transmitted.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-900 rounded-xl text-left text-xs text-slate-500 space-y-1 font-mono">
              <p>Voter Name: {voterName}</p>
              <p>Reg Number: {voterRegNo}</p>
              <p>Election Role: {electionTitle}</p>
              <p>Status: CONFIRMED</p>
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={handleBackToPortal}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Elections Portal
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
            <Link href="/user/portal" className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">SRM Valliammai AI & DS</span>
              <span className="text-xs font-semibold text-slate-200">Election Role Terminal</span>
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
                <Flame className="w-3.5 h-3.5" /> Live Role Poll
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                Role: {electionTitle}
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
                Select your candidate choice below. Live vote counts update continuously in real-time.
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
                  <Award className="w-3 h-3 text-emerald-400" /> Role Votes
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
                    <Vote className="w-5 h-5" /> Submit Ballot for {electionTitle}
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-600 leading-normal">
                By submitting this ballot, you confirm that you are Register Number <span className="font-mono">{voterRegNo}</span>. Your vote is secret and locked for this role post.
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

export default function UserVoteArena() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading election arena...</p>
      </div>
    }>
      <VotingArenaContent />
    </Suspense>
  );
}
