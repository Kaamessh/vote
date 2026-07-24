'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TOTAL_ELIGIBLE_VOTERS } from '@/lib/validation';
import { 
  Shield, 
  LogOut, 
  Plus, 
  Trash2, 
  BarChart3, 
  Users, 
  ClipboardList, 
  ArrowUpDown, 
  Loader2, 
  Sparkles, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Vote,
  Layers
} from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  votes_count: number;
}

interface Election {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

interface VoteLog {
  id: string;
  voter_name: string;
  voter_reg_no: string;
  created_at: string;
  candidate_name: string;
}

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // All active elections
  const [electionsList, setElectionsList] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);

  // Data for currently selected election
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voteLogs, setVoteLogs] = useState<VoteLog[]>([]);
  const router = useRouter();

  // Create Election Form States
  const [roleTitle, setRoleTitle] = useState('');
  const [candidateNameInput, setCandidateNameInput] = useState('');
  const [candidatesList, setCandidatesList] = useState<string[]>([]);
  const [isSubmittingElection, setIsSubmittingElection] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // 3-way Sorting State for Audit Log: 'name' | 'reg_no' | 'candidate'
  const [sortBy, setSortBy] = useState<'name' | 'reg_no' | 'candidate'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Cancel vote state
  const [cancellingVoteId, setCancellingVoteId] = useState<string | null>(null);
  
  // Delete election state
  const [isDeletingElection, setIsDeletingElection] = useState(false);

  // Verify Admin Session
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/admin/login');
      } else {
        setIsAdmin(true);
      }
      setLoadingSession(false);
    };
    checkAdmin();
  }, [router]);

  // Fetch all active elections
  const fetchElectionsList = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = data || [];
      setElectionsList(list);

      // Auto-select first election if none selected or selected was deleted
      if (list.length > 0) {
        setSelectedElectionId((prev) => {
          if (prev && list.some((e) => e.id === prev)) {
            return prev;
          }
          return list[0].id;
        });
      } else {
        setSelectedElectionId(null);
      }
    } catch (err: unknown) {
      console.error('Error fetching elections list:', err);
    }
  }, []);

  // Fetch details for currently selected election
  const fetchSelectedElectionData = useCallback(async (electionId: string) => {
    try {
      // 1. Fetch candidates
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('candidates')
        .select('*')
        .eq('election_id', electionId)
        .order('name', { ascending: true });

      if (candidatesError) throw candidatesError;
      setCandidates(candidatesData || []);

      // 2. Fetch votes audit log
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select(`
          id,
          voter_name,
          voter_reg_no,
          created_at,
          candidates (
            name
          )
        `)
        .eq('election_id', electionId);

      if (votesError) throw votesError;

      const mappedVotes: VoteLog[] = (votesData || []).map((vote: any) => ({
        id: vote.id,
        voter_name: vote.voter_name,
        voter_reg_no: vote.voter_reg_no,
        created_at: vote.created_at,
        candidate_name: vote.candidates?.name || 'Unknown Candidate',
      }));

      setVoteLogs(mappedVotes);
    } catch (err: unknown) {
      console.error('Error fetching selected election details:', err);
    }
  }, []);

  // Initial fetch on admin auth
  useEffect(() => {
    if (isAdmin) {
      fetchElectionsList();
    }
  }, [isAdmin, fetchElectionsList]);

  // Fetch candidate/vote data whenever selected election changes
  useEffect(() => {
    if (selectedElectionId) {
      fetchSelectedElectionData(selectedElectionId);
    } else {
      setCandidates([]);
      setVoteLogs([]);
    }
  }, [selectedElectionId, fetchSelectedElectionData]);

  // Realtime subscriptions for live election changes & vote entries
  useEffect(() => {
    if (!isAdmin) return;

    const electionsChannel = supabase
      .channel('admin-elections-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elections' }, () => {
        fetchElectionsList();
      })
      .subscribe();

    const candidateChannel = supabase
      .channel('admin-candidates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
        if (selectedElectionId) fetchSelectedElectionData(selectedElectionId);
      })
      .subscribe();

    const votesChannel = supabase
      .channel('admin-votes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        if (selectedElectionId) fetchSelectedElectionData(selectedElectionId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(electionsChannel);
      supabase.removeChannel(candidateChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [isAdmin, selectedElectionId, fetchElectionsList, fetchSelectedElectionData]);

  // Handle adding candidate to form lineup
  const addCandidateToList = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = candidateNameInput.trim();
    if (!name) return;

    if (candidatesList.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setFormError('Candidate name already added.');
      return;
    }

    setCandidatesList([...candidatesList, name]);
    setCandidateNameInput('');
    setFormError(null);
  };

  const removeCandidateFromList = (index: number) => {
    setCandidatesList(candidatesList.filter((_, i) => i !== index));
  };

  // Launch new election role
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    const title = roleTitle.trim();
    if (!title) {
      setFormError('Please enter the Title of the Role.');
      return;
    }

    if (candidatesList.length < 2) {
      setFormError('An election requires at least two candidates.');
      return;
    }

    setIsSubmittingElection(true);

    try {
      const { data: newElectionId, error } = await supabase.rpc('create_new_election', {
        p_title: title,
        p_candidate_names: candidatesList,
      });

      if (error) throw error;

      setFormSuccess(true);
      setRoleTitle('');
      setCandidatesList([]);
      setFormError(null);
      
      // Refresh list and select newly created election
      await fetchElectionsList();
      if (newElectionId) {
        setSelectedElectionId(newElectionId);
      }
    } catch (err: any) {
      console.error('Error creating election:', err);
      setFormError(err.message || 'Failed to create election. Please try again.');
    } finally {
      setIsSubmittingElection(false);
    }
  };

  // Cancel / Delete an individual vote record
  const handleCancelVote = async (voteId: string, voterRegNo: string) => {
    if (!confirm(`Are you sure you want to cancel the vote cast by Register Number ${voterRegNo}? This voter will be unlocked to vote again.`)) {
      return;
    }

    setCancellingVoteId(voteId);
    try {
      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('id', voteId);

      if (error) throw error;
      if (selectedElectionId) fetchSelectedElectionData(selectedElectionId);
    } catch (err: any) {
      console.error('Error cancelling vote:', err);
      alert('Failed to cancel vote: ' + err.message);
    } finally {
      setCancellingVoteId(null);
    }
  };

  // Delete active election
  const handleDeleteElection = async () => {
    if (!selectedElectionId) return;
    const currentElection = electionsList.find((e) => e.id === selectedElectionId);
    const title = currentElection?.title || 'Selected';

    if (!confirm(`Are you sure you want to completely DELETE the election role "${title}"? All candidates and votes cast for this role will be permanently deleted.`)) {
      return;
    }

    setIsDeletingElection(true);
    try {
      const { error } = await supabase
        .from('elections')
        .delete()
        .eq('id', selectedElectionId);

      if (error) throw error;
      setSelectedElectionId(null);
      await fetchElectionsList();
    } catch (err: any) {
      console.error('Error deleting election:', err);
      alert('Failed to delete election: ' + err.message);
    } finally {
      setIsDeletingElection(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // 3-way Sorting Toggles
  const handleSortToggle = (field: 'name' | 'reg_no' | 'candidate') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortedVoteLogs = () => {
    return [...voteLogs].sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortBy === 'name') {
        valA = a.voter_name.toLowerCase();
        valB = b.voter_name.toLowerCase();
      } else if (sortBy === 'candidate') {
        valA = a.candidate_name.toLowerCase();
        valB = b.candidate_name.toLowerCase();
      } else {
        const regA = parseInt(a.voter_reg_no, 10);
        const regB = parseInt(b.voter_reg_no, 10);

        if (!isNaN(regA) && !isNaN(regB)) {
          return sortOrder === 'asc' ? regA - regB : regB - regA;
        }

        valA = a.voter_reg_no.toLowerCase();
        valB = b.voter_reg_no.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const currentSelectedElection = electionsList.find((e) => e.id === selectedElectionId);
  const totalVotes = candidates.reduce((acc, curr) => acc + curr.votes_count, 0);
  const remainingVoters = Math.max(0, TOTAL_ELIGIBLE_VOTERS - totalVotes);

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400">Verifying administrator session...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-slate-950 -z-10" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-xl text-indigo-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-medium rounded">Admin Panel</span>
                <span className="text-xs text-slate-500">SRM Valliammai Engineering College</span>
              </div>
              <h1 className="text-lg font-bold text-white">Multi-Role Symposium Voting Console</h1>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-red-500/30 hover:text-red-400 rounded-xl text-sm font-semibold transition-all duration-300"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-10 space-y-10">
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Create Election Form */}
          <section className="lg:col-span-5 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800/60 pb-4">
              <Plus className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Create New Role Election</h2>
            </div>

            {formError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Election role launched successfully and is now live!</span>
              </div>
            )}

            <form onSubmit={handleCreateElection} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Title of the Role / Post
                </label>
                <input
                  type="text"
                  required
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. President, Vice President, Treasurer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Add Candidates
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={candidateNameInput}
                    onChange={(e) => setCandidateNameInput(e.target.value)}
                    placeholder="Candidate Name"
                    className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCandidateToList();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addCandidateToList()}
                    className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 p-3 rounded-xl transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {candidatesList.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 block">Candidate Lineup ({candidatesList.length})</span>
                  <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 divide-y divide-slate-900">
                    {candidatesList.map((cand, idx) => (
                      <div key={idx} className="flex items-center justify-between pt-2 first:pt-0">
                        <span className="text-sm font-medium text-slate-200">{cand}</span>
                        <button
                          type="button"
                          onClick={() => removeCandidateFromList(idx)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingElection || candidatesList.length < 2}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isSubmittingElection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Launching Role...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Add & Launch Role Election
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Real-time Analytics Section & Election Selector */}
          <section className="lg:col-span-7 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/60 pb-4 gap-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Live Role Analytics</h2>
              </div>

              {selectedElectionId && (
                <button
                  onClick={handleDeleteElection}
                  disabled={isDeletingElection}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/30 px-3 py-1.5 rounded-lg font-medium transition-all self-start sm:self-auto"
                >
                  {isDeletingElection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Selected Role
                </button>
              )}
            </div>

            {/* Active Election Selection Tabs */}
            {electionsList.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <span className="text-xs text-slate-500 font-semibold uppercase shrink-0 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Roles:
                  </span>
                  {electionsList.map((election) => {
                    const isSelected = election.id === selectedElectionId;
                    return (
                      <button
                        key={election.id}
                        onClick={() => setSelectedElectionId(election.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Vote className="w-3.5 h-3.5" />
                        {election.title}
                      </button>
                    );
                  })}
                </div>

                {/* Turnout Stats Cards (Total, Voted, Remaining) */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Voters</span>
                    <span className="text-xl md:text-2xl font-bold text-white mt-1 block">
                      {TOTAL_ELIGIBLE_VOTERS}
                    </span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Votes for {currentSelectedElection?.title}</span>
                    <span className="text-xl md:text-2xl font-bold text-emerald-400 mt-1 block">
                      {totalVotes}
                    </span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Remaining</span>
                    <span className="text-xl md:text-2xl font-bold text-amber-400 mt-1 block">
                      {remainingVoters}
                    </span>
                  </div>
                </div>

                {/* Candidate Vote counts with progress bar */}
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Candidates Standing for "{currentSelectedElection?.title}"
                    </h3>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold animate-pulse">
                      Live
                    </span>
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {candidates.map((cand) => {
                      const percentage = totalVotes > 0 ? Math.round((cand.votes_count / totalVotes) * 100) : 0;
                      return (
                        <div key={cand.id} className="space-y-1 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-slate-200">{cand.name}</span>
                            <span className="font-bold text-emerald-400">
                              {cand.votes_count} {cand.votes_count === 1 ? 'vote' : 'votes'} ({percentage}%)
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-500 ease-out rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <BarChart3 className="w-12 h-12 text-slate-700" />
                <h3 className="text-slate-400 font-semibold">No Active Role Elections</h3>
                <p className="text-xs text-slate-600 max-w-sm">
                  Use the form on the left to add your first role election. You can create multiple concurrent elections.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Exclusive Voter Audit Log Section with 3-Way Sorting */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/60 pb-4 gap-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Exclusive Voter Audit Log</h2>
                <p className="text-xs text-slate-500">
                  Showing audit records for role: <span className="text-indigo-400 font-semibold">{currentSelectedElection?.title || 'None Selected'}</span>
                </p>
              </div>
            </div>

            {/* 3-Way Sorting Toggles: Voter Name, Reg No, Voted Candidate */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Sort By:</span>
              <div className="inline-flex rounded-lg border border-slate-800 p-0.5 bg-slate-950">
                <button
                  onClick={() => handleSortToggle('name')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    sortBy === 'name' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Voter Name <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSortToggle('reg_no')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    sortBy === 'reg_no' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reg Number <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSortToggle('candidate')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    sortBy === 'candidate' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Candidate Choice <ArrowUpDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {selectedElectionId ? (
            voteLogs.length > 0 ? (
              <div className="overflow-x-auto border border-slate-900 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase border-b border-slate-900">
                      <th className="py-4 px-6">Voter Name</th>
                      <th className="py-4 px-6">Register Number</th>
                      <th className="py-4 px-6">Candidate Choice</th>
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-900 bg-slate-950/40">
                    {getSortedVoteLogs().map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/20 transition-colors text-slate-200">
                        <td className="py-4 px-6 font-semibold">{log.voter_name}</td>
                        <td className="py-4 px-6">
                          <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-xs font-mono text-slate-400">
                            {log.voter_reg_no}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-emerald-400">{log.candidate_name}</td>
                        <td className="py-4 px-6 text-xs text-slate-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleCancelVote(log.id, log.voter_reg_no)}
                            disabled={cancellingVoteId === log.id}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/30 px-2.5 py-1 rounded-lg font-medium transition-all"
                          >
                            {cancellingVoteId === log.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Cancel Vote
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-900 rounded-xl bg-slate-950/20">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-semibold">No Votes Logged for this Role Yet</p>
                <p className="text-xs text-slate-600 mt-1">Waiting for eligible voters to submit their choices for "{currentSelectedElection?.title}".</p>
              </div>
            )
          ) : (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-900 rounded-xl bg-slate-950/20">
              <ClipboardList className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold">No Role Selected</p>
              <p className="text-xs text-slate-600 mt-1">Select an active election role above to view its audit log.</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60 bg-slate-950">
        <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium Multi-Role Voting System</p>
      </footer>
    </div>
  );
}
