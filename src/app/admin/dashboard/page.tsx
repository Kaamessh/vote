'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
  AlertTriangle
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
  const [activeElection, setActiveElection] = useState<Election | null>(null);
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

  // Sorting State for Audit Log
  const [sortBy, setSortBy] = useState<'name' | 'reg_no'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  // Fetch all election data
  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Fetch active election
      const { data: electionData, error: electionError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (electionError) throw electionError;

      if (electionData) {
        setActiveElection(electionData);

        // 2. Fetch candidates for active election
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('candidates')
          .select('*')
          .eq('election_id', electionData.id)
          .order('name', { ascending: true });

        if (candidatesError) throw candidatesError;
        setCandidates(candidatesData || []);

        // 3. Fetch votes audit log
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
          .eq('election_id', electionData.id);

        if (votesError) throw votesError;

        // Map candidate name from joined relation
        const mappedVotes: VoteLog[] = (votesData || []).map((vote: any) => ({
          id: vote.id,
          voter_name: vote.voter_name,
          voter_reg_no: vote.voter_reg_no,
          created_at: vote.created_at,
          candidate_name: vote.candidates?.name || 'Unknown Candidate',
        }));

        setVoteLogs(mappedVotes);
      } else {
        setActiveElection(null);
        setCandidates([]);
        setVoteLogs([]);
      }
    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin, fetchDashboardData]);

  // Set up Realtime subscriptions
  useEffect(() => {
    if (!isAdmin || !activeElection) return;

    // Subscribe to candidates update for live count
    const candidateChannel = supabase
      .channel('admin-candidates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidates',
          filter: `election_id=eq.${activeElection.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to votes insert for audit log
    const votesChannel = supabase
      .channel('admin-votes-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
          filter: `election_id=eq.${activeElection.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(candidateChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [isAdmin, activeElection, fetchDashboardData]);

  // Handle adding candidate to list in form
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

  // Remove candidate from list in form
  const removeCandidateFromList = (index: number) => {
    setCandidatesList(candidatesList.filter((_, i) => i !== index));
  };

  // Submit and create new election
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
      // Call create_new_election RPC function
      const { data: newElectionId, error } = await supabase.rpc('create_new_election', {
        p_title: title,
        p_candidate_names: candidatesList,
      });

      if (error) {
        throw error;
      }

      setFormSuccess(true);
      setRoleTitle('');
      setCandidatesList([]);
      setFormError(null);
      
      // Fetch new election data
      fetchDashboardData();
    } catch (err: any) {
      console.error('Error creating election:', err);
      setFormError(err.message || 'Failed to create election. Please try again.');
    } finally {
      setIsSubmittingElection(false);
    }
  };

  // Sign out admin
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // Sort and filter audit log
  const handleSortToggle = (field: 'name' | 'reg_no') => {
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
      } else {
        // Sort numerically if possible, otherwise string sort
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

  const totalVotes = candidates.reduce((acc, curr) => acc + curr.votes_count, 0);

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
      {/* Dynamic Background */}
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
              <h1 className="text-lg font-bold text-white">Symposium Voting Console</h1>
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

      {/* Main Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-10 space-y-10">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Create Election Section */}
          <section className="lg:col-span-5 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800/60 pb-4">
              <Plus className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Create New Election</h2>
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
                <span>Election successfully created and is now live!</span>
              </div>
            )}

            <form onSubmit={handleCreateElection} className="space-y-6">
              {/* Election Title */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Title of the Role
                </label>
                <input
                  type="text"
                  required
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Student President"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>

              {/* Candidates Add Form */}
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

              {/* Added Candidates List */}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingElection || candidatesList.length < 2}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isSubmittingElection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Launching...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Launch Live Poll
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Real-time Analytics Section */}
          <section className="lg:col-span-7 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Live Analytics</h2>
              </div>
              {activeElection && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
                </span>
              )}
            </div>

            {activeElection ? (
              <div className="space-y-6">
                {/* Stats Summary cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl">
                    <span className="text-xs text-slate-500 font-semibold block uppercase">Active Election</span>
                    <span className="text-base md:text-lg font-bold text-white mt-1 block truncate">
                      {activeElection.title}
                    </span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 font-semibold block uppercase">Total Votes Cast</span>
                      <span className="text-2xl md:text-3xl font-extrabold text-white mt-1 block">
                        {totalVotes}
                      </span>
                    </div>
                    <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Candidate Vote counts with percentages */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Candidate Performance</h3>
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
                <h3 className="text-slate-400 font-semibold">No Active Election</h3>
                <p className="text-xs text-slate-600 max-w-sm">Use the form on the left to configure and launch an election. Live vote details will appear here immediately.</p>
              </div>
            )}
          </section>
        </div>

        {/* Exclusive Voter Audit Log Section */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/60 pb-4 gap-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Exclusive Voter Audit Log</h2>
                <p className="text-xs text-slate-500">Secure log visible only to the administrator</p>
              </div>
            </div>
            {/* Sorting Toggles */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-semibold uppercase">Sort By:</span>
              <div className="inline-flex rounded-lg border border-slate-800 p-0.5 bg-slate-950">
                <button
                  onClick={() => handleSortToggle('name')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    sortBy === 'name' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Voter Name <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleSortToggle('reg_no')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    sortBy === 'reg_no' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reg Number <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {activeElection ? (
            voteLogs.length > 0 ? (
              <div className="overflow-x-auto border border-slate-900 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase border-b border-slate-900">
                      <th className="py-4 px-6">Voter Name</th>
                      <th className="py-4 px-6">Register Number</th>
                      <th className="py-4 px-6">Selection</th>
                      <th className="py-4 px-6">Timestamp</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-900 rounded-xl bg-slate-950/20">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-semibold">No Votes Logged Yet</p>
                <p className="text-xs text-slate-600 mt-1">Waiting for eligible voters to register and submit their choices.</p>
              </div>
            )
          ) : (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-900 rounded-xl bg-slate-950/20">
              <ClipboardList className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold">Audit Log Offline</p>
              <p className="text-xs text-slate-600 mt-1">Audit information will be displayed when an active election is running.</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60 bg-slate-950">
        <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium Voting System</p>
      </footer>
    </div>
  );
}
