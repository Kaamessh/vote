import Link from 'next/link';
import { Vote, Shield, Cpu, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-emerald-500 p-2 rounded-xl">
              <Cpu className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h2 className="text-xs md:text-sm font-semibold tracking-wider text-slate-400 uppercase">SRM Valliammai Engineering College</h2>
              <h1 className="text-sm md:text-lg font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Dept. of Artificial Intelligence & Data Science</h1>
            </div>
          </div>
          <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold rounded-full uppercase tracking-wider">
            Symposium 2026
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-6 py-12 z-10">
        <div className="max-w-4xl w-full text-center space-y-12">
          {/* Hero Section */}
          <div className="space-y-4">
            <h2 className="text-indigo-400 text-xs md:text-sm font-semibold tracking-widest uppercase">National Level Technical Symposium</h2>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Real-Time Voting Arena
            </h1>
            <p className="max-w-2xl mx-auto text-slate-400 text-sm md:text-lg">
              Cast your vote securely and track election analytics live. Powering democratic student lead selection through next-gen technology.
            </p>
          </div>

          {/* Portals Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto pt-6">
            {/* Voter Portal Card */}
            <Link
              href="/user/login"
              className="group relative bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
              <div className="flex flex-col h-full justify-between gap-6">
                <div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                    <Vote className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Voter Entry
                  </h3>
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed">
                    Access the voting dashboard, verify your eligibility with your Register Number, and make your selection.
                  </p>
                </div>
                <div className="flex items-center text-emerald-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                  Enter Voter Portal <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>

            {/* Admin Portal Card */}
            <Link
              href="/admin/login"
              className="group relative bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
              <div className="flex flex-col h-full justify-between gap-6">
                <div>
                  <div className="bg-indigo-500/10 border border-indigo-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                    Admin Login
                  </h3>
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed">
                    Create new elections, manage candidates, monitor real-time vote metrics, and audit results securely.
                  </p>
                </div>
                <div className="flex items-center text-indigo-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                  Enter Admin Console <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 bg-slate-950/80 py-6 text-center text-xs text-slate-500 z-10">
        <p>© 2026 SRM Valliammai Engineering College. All rights reserved.</p>
        <p className="mt-1 text-slate-600">Designed & Developed for Department of Artificial Intelligence and Data Science</p>
      </footer>
    </div>
  );
}

