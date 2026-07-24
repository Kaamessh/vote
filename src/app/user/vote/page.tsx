'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
  ArrowLeft,
  Crown,
  TrendingDown,
  Trophy
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
  const [totalVotersCap, setTotalVotersCap] = useState<number>(59);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  
  // User's vote status for this election
  const [hasVotedRole, setHasVotedRole] = useState(false);
  const [votedCandidateId, setVotedCandidateId] = useState<string | null>(null);
  const [votedCandidateName, setVotedCandidateName] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justVotedSuccessMsg, setJustVotedSuccessMsg] = useState<string | null>(null);

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
        // 1. Fetch target election details
        const { data: election, error: electionError } = await supabase
          .from('elections')
          .select('id, title, total_voters, is_active')
          .eq('id', targetElectionId)
          .maybeSingle();

        if (electionError) throw electionError;

        if (!election || !election.is_active) {
          setErrorMsg('This election role is no longer active.');
          setCheckingEligibility(false);
          return;
        }

        setElectionTitle(election.title);
        setTotalVotersCap(election.total_voters || 59);

        // 2. Fetch candidates
        const { data: candidatesList, error: candidatesError } = await supabase
          .from('candidates')
          .select('id, name, votes_count')
          .eq('election_id', targetElectionId)
          .order('name', { ascending: true });

        if (candidatesError) throw candidatesError;
        setCandidates(candidatesList || []);

        // 3. Check if user has ALREADY voted for this role & get candidate choice
        const { data: voteInfo, error: voteCheckError } = await supabase.rpc('get_user_vote_for_election', {
          p_reg_no: storedRegNo,
          p_election_id: targetElectionId,
        });

        if (voteCheckError) throw voteCheckError;

        if (voteInfo && voteInfo.length > 0 && voteInfo[0].has_voted) {
          setHasVotedRole(true);
          setVotedCandidateId(voteInfo[0].candidate_id);
          setVotedCandidateName(voteInfo[0].candidate_name);
        }
      } catch (err: any) {
        console.error('Error verifying voter session:', err);
        setErrorMsg('Error loading voting ballot. Please return to portal.');
      } finally {
        setCheckingEligibility(false);
      }
    };

    verifyVoterSession();
  }, [router, targetElectionId]);

  // Realtime listener for live vote count updates
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
    if (hasVotedRole || !selectedCandidateId || !targetElectionId || !voterName || !voterRegNo) return;
    
    setIsSubmittingVote(true);
    setErrorMsg(null);

    const selectedCand = candidates.find(c => c.id === selectedCandidateId);
    const selectedCandidateName = selectedCand?.name || 'Candidate';

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

      setHasVotedRole(true);
      setVotedCandidateId(selectedCandidateId);
      setVotedCandidateName(selectedCandidateName);
      setJustVotedSuccessMsg(`Your vote for ${selectedCandidateName} has been recorded! Live counts update in real-time below.`);

      setCandidates((prev) =>
        prev.map((c) => (c.id === selectedCandidateId ? { ...c, votes_count: c.votes_count + 1 } : c))
      );
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setErrorMsg(err.message || 'Failed to submit vote. Please try again.');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleExit = () => {
    sessionStorage.clear();
    router.push('/');
  };

  const totalVotesCastForRole = candidates.reduce((acc, curr) => acc + curr.votes_count, 0);
  const remainingVoters = Math.max(0, totalVotersCap - totalVotesCastForRole);

  // Real-time Leading & Trailing Margins Formula
  const sortedCandidatesByVotes = [...candidates].sort((a, b) => b.votes_count - a.votes_count);
  const highestVotes = sortedCandidatesByVotes[0]?.votes_count || 0;
  const secondHighestVotes = sortedCandidatesByVotes[1]?.votes_count || 0;
  const isCompleted = totalVotesCastForRole >= totalVotersCap && totalVotersCap > 0;
  const winnerCandidate = sortedCandidatesByVotes[0];

  const getMarginBadge = (cand: Candidate) => {
    if (totalVotesCastForRole === 0) return null;

    if (cand.votes_count === highestVotes && highestVotes > 0) {
      if (highestVotes === secondHighestVotes) {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold rounded-full">
            <Crown className="w-3 h-3 text-amber-400" /> Tied for 1st
          </span>
        );
      }
      const margin = highestVotes - secondHighestVotes;
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-full">
          <Crown className="w-3 h-3 text-emerald-400" /> Leading by {margin} {margin === 1 ? 'vote' : 'votes'}
        </span>
      );
    } else if (highestVotes > 0) {
      const trailing = highestVotes - cand.votes_count;
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold rounded-full">
          <TrendingDown className="w-3 h-3 text-rose-400" /> Trailing by {trailing} {trailing === 1 ? 'vote' : 'votes'}
        </span>
      );
    }
    return null;
  };

  if (checkingEligibility) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading voting ballot...</p>
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
            <Link 
              href="/user/portal" 
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Elections Portal
            </Link>
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

        {/* Post-submission or Re-entry Banner */}
        {hasVotedRole && (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2 max-w-2xl mx-auto w-full shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]">
            <div className="inline-flex items-center justify-center gap-2 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>Ballot Recorded for "{electionTitle}"</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {justVotedSuccessMsg || (
                <>
                  You cast your vote for <span className="font-semibold text-emerald-400">{votedCandidateName}</span>. Live vote counts update in real-time below out of {totalVotersCap} total department voters.
                </>
              )}
            </p>
          </div>
        )}

        {/* Winner & Final Rankings Banner when Completed */}
        {isCompleted && winnerCandidate && (
          <div className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 rounded-2xl space-y-4 max-w-2xl mx-auto w-full shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)]">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-3 rounded-xl text-amber-400">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">Official Election Winner</span>
                <h2 className="text-2xl font-extrabold text-white">🏆 {winnerCandidate.name}</h2>
              </div>
              <span className="ml-auto text-xs px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-full">
                {winnerCandidate.votes_count} / {totalVotersCap} votes
              </span>
            </div>

            <div className="pt-2 border-t border-amber-500/20 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Final Standings & Rankings</span>
              <div className="grid gap-2">
                {sortedCandidatesByVotes.map((cand, rankIdx) => {
                  const medal = rankIdx === 0 ? '🥇 1st Place' : rankIdx === 1 ? '🥈 2nd Place' : rankIdx === 2 ? '🥉 3rd Place' : `${rankIdx + 1}th Place`;
                  const pct = Number(((cand.votes_count / totalVotersCap) * 100).toFixed(1));
                  return (
                    <div key={cand.id} className="flex justify-between items-center bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-900 text-xs">
                      <span className="font-bold text-amber-400">{medal}: <span className="text-white font-semibold">{cand.name}</span></span>
                      <span className="font-mono text-slate-300">{cand.votes_count} / {totalVotersCap} votes ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
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
                {hasVotedRole
                  ? 'Observing live real-time candidate standings below.'
                  : 'Select your candidate choice below. Live vote counts update continuously in real-time.'}
              </p>
            </div>

            {/* Dynamic Voter Turnout Summary Banner */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center backdrop-blur-sm">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-indigo-400" /> Total Voters
                </span>
                <span className="text-xl md:text-2xl font-bold text-white block">
                  {totalVotersCap}
                </span>
              </div>

              <div className="space-y-1 border-x border-slate-800">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block flex items-center justify-center gap-1">
                  <Award className="w-3 h-3 text-emerald-400" /> Role Votes
                </span>
                <span className="text-xl md:text-2xl font-bold text-emerald-400 block">
                  {totalVotesCastForRole}
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
                const isVotedChoice = votedCandidateId === cand.id;
                
                // Dynamic percentage out of totalVotersCap
                const percentage = Number(((cand.votes_count / totalVotersCap) * 100).toFixed(1));
                
                return (
                  <button
                    key={cand.id}
                    disabled={hasVotedRole}
                    onClick={() => setSelectedCandidateId(cand.id)}
                    className={`group relative text-left bg-slate-900/60 border rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between gap-5 overflow-hidden ${
                      isVotedChoice
                        ? 'border-emerald-500 shadow-[0_0_30px_-5px_rgba(16,185,129,0.25)] bg-slate-900/90'
                        : isSelected 
                        ? 'border-emerald-500 shadow-[0_0_25px_-5px_rgba(16,185,129,0.15)] bg-slate-900/90' 
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/70 disabled:hover:border-slate-800 disabled:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl transition-opacity duration-300 ${isSelected || isVotedChoice ? 'opacity-100' : 'opacity-0'}`} />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {cand.name}
                          </h3>
                        </div>

                        {isVotedChoice ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold rounded-full uppercase shrink-0">
                            Your Choice ✓
                          </span>
                        ) : (
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected 
                              ? 'border-emerald-500 bg-emerald-500 text-slate-950' 
                              : 'border-slate-700 group-hover:border-slate-500'
                          }`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[3]" />}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">Department Candidate</p>
                        {getMarginBadge(cand)}
                      </div>
                    </div>

                    {/* Real-time stats display out of totalVotersCap */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-slate-500">Live Standing</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {cand.votes_count} / {totalVotersCap} votes ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (cand.votes_count / totalVotersCap) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Voting Submission & Navigation Actions */}
            <div className="max-w-md mx-auto pt-4 text-center space-y-4">
              {hasVotedRole ? (
                <div className="space-y-3">
                  <button
                    disabled
                    className="w-full bg-slate-900 border border-slate-800 text-emerald-400 font-bold py-4 px-6 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Ballot Submitted for {electionTitle}
                  </button>
                  <Link
                    href="/user/portal"
                    className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Return to Elections Portal Hub
                  </Link>
                </div>
              ) : (
                <>
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
                </>
              )}
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
