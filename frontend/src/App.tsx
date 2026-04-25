import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RequestPage from './pages/RequestPage';
import MyRequests from './pages/MyRequests';
import SyncAdmin from './pages/SyncAdmin';
import TestRunner from './pages/TestRunner';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/request', label: 'New Request', icon: '✏️' },
  { to: '/requests', label: 'My Requests', icon: '📋' },
  { to: '/sync', label: 'Sync Admin', icon: '🔄' },
  { to: '/test-runner', label: 'Test Runner', icon: '🧪' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950">
        {/* Ambient background gradients */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-900/10 rounded-full blur-3xl" />
        </div>

        {/* Navbar */}
        <header className="relative z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-brand-500/30">
                  T
                </div>
                <span className="font-bold text-white text-lg">TimeOff</span>
                <span className="hidden sm:block text-slate-500 text-sm font-medium">Manager</span>
              </div>

              {/* Nav Links */}
              <nav className="flex items-center gap-1">
                {navItems.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="hidden sm:block">{icon}</span>
                    <span className="hidden md:block">{label}</span>
                    <span className="md:hidden">{icon}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/request" element={<RequestPage />} />
            <Route path="/requests" element={<MyRequests />} />
            <Route path="/sync" element={<SyncAdmin />} />
            <Route path="/test-runner" element={<TestRunner />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 mt-16 py-6 text-center text-slate-600 text-xs">
          TimeOff Manager — HCM Sync Microservice
        </footer>
      </div>
    </BrowserRouter>
  );
}
