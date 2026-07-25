'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Settings, 
  ArrowLeft, 
  LogOut, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2, 
  ArrowUpDown, 
  Clock, 
  KeyRound, 
  Search, 
  CheckSquare, 
  Square, 
  UserCheck, 
  ShieldAlert,
  CheckCircle2,
  Lock,
  Cpu
} from 'lucide-react';
import Link from 'next/link';

interface VoterAccount {
  reg_no: string;
  name: string;
  password: string;
  created_at: string;
}

export default function AdminSettings() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  // Accounts & Selection state
  const [voterAccounts, setVoterAccounts] = useState<VoterAccount[]>([]);
  const [selectedRegNos, setSelectedRegNos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingRegNo, setEditingRegNo] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  
  // Deleting states
  const [deletingRegNo, setDeletingRegNo] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Feedback message state
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 4-Way Sorting State: 'name' | 'reg_no' | 'password' | 'timestamp'
  const [sortBy, setSortBy] = useState<'name' | 'reg_no' | 'password' | 'timestamp'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const router = useRouter();

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

  // Fetch all registered voter accounts
  const fetchVoterAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('voters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVoterAccounts(data || []);
    } catch (err: any) {
      console.error('Error fetching voter accounts:', err);
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to load voter accounts.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchVoterAccounts();
    }
  }, [isAdmin, fetchVoterAccounts]);

  // Realtime subscription for voters table updates
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin-settings-voters-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => {
        fetchVoterAccounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, fetchVoterAccounts]);

  // Sort toggle handler
  const handleSortToggle = (field: 'name' | 'reg_no' | 'password' | 'timestamp') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'timestamp' ? 'desc' : 'asc');
    }
  };

  // Filter & Sort Voter Accounts
  const getFilteredAndSortedAccounts = () => {
    let filtered = [...voterAccounts];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (acc) => acc.name.toLowerCase().includes(q) || acc.reg_no.toLowerCase().includes(q)
      );
    }

    // Sort accounts
    return filtered.sort((a, b) => {
      if (sortBy === 'timestamp') {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (sortBy === 'reg_no') {
        const regA = parseInt(a.reg_no, 10);
        const regB = parseInt(b.reg_no, 10);

        if (!isNaN(regA) && !isNaN(regB)) {
          return sortOrder === 'asc' ? regA - regB : regB - regA;
        }
        return sortOrder === 'asc' 
          ? a.reg_no.localeCompare(b.reg_no) 
          : b.reg_no.localeCompare(a.reg_no);
      }

      let valA = '';
      let valB = '';

      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'password') {
        valA = a.password.toLowerCase();
        valB = b.password.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const displayedAccounts = getFilteredAndSortedAccounts();

  // Selection Logic (Individual + Select All)
  const isAllSelected = displayedAccounts.length > 0 && displayedAccounts.every((acc) => selectedRegNos.includes(acc.reg_no));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect all currently displayed accounts
      const displayedRegs = displayedAccounts.map((acc) => acc.reg_no);
      setSelectedRegNos((prev) => prev.filter((reg) => !displayedRegs.includes(reg)));
    } else {
      // Select all currently displayed accounts
      const displayedRegs = displayedAccounts.map((acc) => acc.reg_no);
      const combined = Array.from(new Set([...selectedRegNos, ...displayedRegs]));
      setSelectedRegNos(combined);
    }
  };

  const toggleSelectRow = (regNo: string) => {
    if (selectedRegNos.includes(regNo)) {
      setSelectedRegNos(selectedRegNos.filter((r) => r !== regNo));
    } else {
      setSelectedRegNos([...selectedRegNos, regNo]);
    }
  };

  // Start Editing Account
  const startEditingAccount = (account: VoterAccount) => {
    setEditingRegNo(account.reg_no);
    setEditName(account.name);
    setEditPassword(account.password);
  };

  // Save Account Edit
  const handleSaveAccount = async (regNo: string) => {
    if (!editName.trim() || !editPassword.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Name and Password cannot be empty.' });
      return;
    }

    if (editPassword.trim().length < 6) {
      setFeedbackMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsSavingAccount(true);
    setFeedbackMsg(null);

    try {
      const { error } = await supabase
        .from('voters')
        .update({
          name: editName.trim(),
          password: editPassword.trim(),
        })
        .eq('reg_no', regNo);

      if (error) throw error;

      setEditingRegNo(null);
      setFeedbackMsg({ type: 'success', text: `Voter account for Register Number ${regNo} updated successfully!` });
      await fetchVoterAccounts();
    } catch (err: any) {
      console.error('Error updating account:', err);
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update voter account.' });
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Delete Single Voter Account
  const handleDeleteSingleAccount = async (regNo: string, voterName: string) => {
    if (!confirm(`Are you sure you want to COMPLETELY DELETE the account for Register Number ${regNo} (${voterName})? The voter will be required to register again from scratch.`)) {
      return;
    }

    setDeletingRegNo(regNo);
    setFeedbackMsg(null);

    try {
      const { error } = await supabase
        .from('voters')
        .delete()
        .eq('reg_no', regNo);

      if (error) throw error;

      setSelectedRegNos((prev) => prev.filter((r) => r !== regNo));
      setFeedbackMsg({ type: 'success', text: `Account for Register Number ${regNo} deleted from database.` });
      await fetchVoterAccounts();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to delete account.' });
    } finally {
      setDeletingRegNo(null);
    }
  };

  // Bulk Delete Selected Voter Accounts
  const handleBulkDeleteSelected = async () => {
    const count = selectedRegNos.length;
    if (count === 0) return;

    if (!confirm(`Are you sure you want to COMPLETELY DELETE ${count} selected voter account(s) from the database? Selected voters will be required to register again from scratch.`)) {
      return;
    }

    setIsBulkDeleting(true);
    setFeedbackMsg(null);

    try {
      const { error } = await supabase
        .from('voters')
        .delete()
        .in('reg_no', selectedRegNos);

      if (error) throw error;

      setFeedbackMsg({ type: 'success', text: `Successfully deleted ${count} selected voter account(s) from the database.` });
      setSelectedRegNos([]);
      await fetchVoterAccounts();
    } catch (err: any) {
      console.error('Error in bulk delete:', err);
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to delete selected accounts.' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Verifying administrator session...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 -z-10" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Navigation Title */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-2xl text-emerald-400 shadow-[0_0_20px_-3px_rgba(16,185,129,0.2)]">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold rounded">
                  Admin Control Center
                </span>
                <span className="text-xs text-slate-500">SRM Valliammai Engineering College</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Voter Account Settings & Password Control
              </h1>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-red-500/30 hover:text-red-400 rounded-xl text-xs font-semibold transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Feedback Alert Banners */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl border text-sm flex items-center justify-between gap-3 backdrop-blur-md transition-all ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Settings Control Bar (Search, 4-Way Sort, Bulk Actions) */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-6">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-grow max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voter by name or register number..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 4-Way Sorting Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Sort Accounts By:
              </span>
              <div className="inline-flex flex-wrap rounded-xl border border-slate-800 p-1 bg-slate-950">
                <button
                  onClick={() => handleSortToggle('name')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === 'name' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Voter Name <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSortToggle('reg_no')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === 'reg_no' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reg Number <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSortToggle('password')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === 'password' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Password <KeyRound className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSortToggle('timestamp')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === 'timestamp' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Timestamp <Clock className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Action & Selection Counter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3 text-xs">
              <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono font-semibold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Total: {voterAccounts.length} Accounts
              </span>
              
              {selectedRegNos.length > 0 && (
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400 font-bold flex items-center gap-1.5 animate-pulse">
                  <CheckSquare className="w-3.5 h-3.5" /> {selectedRegNos.length} Account(s) Selected
                </span>
              )}
            </div>

            {/* Bulk Delete Button */}
            {selectedRegNos.length > 0 && (
              <button
                onClick={handleBulkDeleteSelected}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 border border-red-500/40 px-4 py-2 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Selected ({selectedRegNos.length})
              </button>
            )}
          </div>
        </div>

        {/* Registered Voters Account Table */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
          {loading ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs">Loading registered voter accounts...</p>
            </div>
          ) : displayedAccounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800/80">
                    
                    {/* Checkbox Select All Column */}
                    <th className="py-4 px-5 w-12 text-center">
                      <button
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
                        title={isAllSelected ? "Unselect All" : "Select All"}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    
                    <th className="py-4 px-6">Voter Name</th>
                    <th className="py-4 px-6">Register Number</th>
                    <th className="py-4 px-6">Registered Password</th>
                    <th className="py-4 px-6">Registration Time</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="text-sm divide-y divide-slate-900/80 bg-slate-950/40">
                  {displayedAccounts.map((account) => {
                    const isSelected = selectedRegNos.includes(account.reg_no);
                    const isEditing = editingRegNo === account.reg_no;

                    return (
                      <tr 
                        key={account.reg_no} 
                        className={`transition-colors ${
                          isSelected 
                            ? 'bg-indigo-500/10 hover:bg-indigo-500/15' 
                            : 'hover:bg-slate-900/30'
                        }`}
                      >
                        {/* Row Checkbox */}
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => toggleSelectRow(account.reg_no)}
                            className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </td>

                        {/* Voter Name */}
                        <td className="py-4 px-6 font-semibold text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="bg-slate-950 border border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none w-full max-w-xs"
                            />
                          ) : (
                            account.name
                          )}
                        </td>

                        {/* Register Number */}
                        <td className="py-4 px-6">
                          <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono text-slate-300 font-semibold">
                            {account.reg_no}
                          </span>
                        </td>

                        {/* Registered Password */}
                        <td className="py-4 px-6">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="bg-slate-950 border border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono w-full max-w-xs"
                            />
                          ) : (
                            <span className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-slate-500" /> {account.password}
                            </span>
                          )}
                        </td>

                        {/* Registration Timestamp */}
                        <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                          {new Date(account.created_at).toLocaleString()}
                        </td>

                        {/* Actions: Edit / Save / Delete */}
                        <td className="py-4 px-6 text-right space-x-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveAccount(account.reg_no)}
                                disabled={isSavingAccount}
                                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-medium transition-all"
                              >
                                {isSavingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save
                              </button>
                              <button
                                onClick={() => setEditingRegNo(null)}
                                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg font-medium transition-all"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditingAccount(account)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-medium transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSingleAccount(account.reg_no, account.name)}
                                disabled={deletingRegNo === account.reg_no}
                                className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/30 px-3 py-1.5 rounded-lg font-medium transition-all"
                              >
                                {deletingRegNo === account.reg_no ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                Delete Account
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500 border border-dashed border-slate-900 rounded-2xl bg-slate-950/20 text-xs">
              <UserCheck className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">No Voter Accounts Found</p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                {searchQuery ? 'No registered voters match your search query.' : 'Voter accounts registered by students will appear here for password control and management.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600 z-10 border-t border-slate-900/60 bg-slate-950">
        <p>© 2026 SRM Valliammai Engineering College. AI & DS Symposium Admin Control Panel</p>
      </footer>
    </div>
  );
}
