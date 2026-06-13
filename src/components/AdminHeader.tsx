import React, { useState } from 'react';
import { 
  Menu, 
  X, 
  Users, 
  Calendar, 
  BarChart3, 
  FileEdit, 
  HelpCircle, 
  FileText, 
  ShieldAlert, 
  Database,
  Lock,
  User,
  Power,
  Layers,
  Bell
} from 'lucide-react';
import { AdminRole } from '../types';

interface AdminHeaderProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  adminRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
  pendingRequestsCount: number;
  pendingDeletionsCount: number;
  adminEmail: string;
  onLogout: () => void;
}

export default function AdminHeader({
  currentPage,
  onPageChange,
  adminRole,
  onRoleChange,
  pendingRequestsCount,
  pendingDeletionsCount,
  adminEmail,
  onLogout
}: AdminHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'attendance', label: 'Attendance Sessions', icon: Calendar },
    { id: 'report', label: 'Attendance Reports', icon: FileText },
    { id: 'edit-requests', label: 'Edit Requests', icon: FileEdit, badge: pendingRequestsCount },
    { id: 'students', label: 'Manage Students', icon: Users },
    { id: 'questionbank', label: 'Question Bank', icon: HelpCircle },
    { id: 'results', label: 'Exam Results', icon: Layers },
    { id: 'auditlog', label: 'Audit Log', icon: Database, badge: pendingDeletionsCount ? '!' : undefined },
    { id: 'settings', label: 'Settings & Security', icon: Lock }
  ];

  const getPageLabel = (id: string) => {
    return menuItems.find(item => item.id === id)?.label || 'Menu';
  };

  const handleNavClick = (id: string) => {
    onPageChange(id);
    setIsOpen(false);
  };

  return (
    <header className="bg-[#0F172A] border-b border-slate-800 text-white select-none w-full relative z-30 font-sans">
      {/* Target headers for test and verification */}
      <div id="admin-header-main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/20">
            C
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">CRYO BYTE PRIME</h1>
            <p className="text-[10px] text-slate-450 tracking-wider font-mono">CBT COURSE BUILDER & EVALUATIONS</p>
          </div>
        </div>

        {/* Action Controls & Dropdown Trigger */}
        <div className="flex items-center space-x-3">
          {/* Role Status Switcher / Demo Badge */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/50">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={adminRole} 
              onChange={(e) => onRoleChange(e.target.value as AdminRole)}
              className="bg-transparent text-xs font-semibold focus:outline-none text-cyan-400 cursor-pointer"
              title="Switch user role for simulation"
            >
              <option value="Superadmin" className="bg-[#0F172A] text-white">Superadmin</option>
              <option value="Admin" className="bg-[#0F172A] text-white">Admin</option>
              <option value="Tutor" className="bg-[#0F172A] text-white">Tutor (Restricted)</option>
            </select>
          </div>

          {/* Quick Stats Notification Badge */}
          {(pendingRequestsCount > 0 || pendingDeletionsCount > 0) && (
            <div className="relative p-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <Bell className="w-4 h-4" />
            </div>
          )}

          {/* Core Trigger Button (Hamburger) - Requirement B1 */}
          <button
            id="admin-menu-trigger"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all group cursor-pointer"
          >
            {isOpen ? <X className="w-4 h-4 text-rose-450" /> : <Menu className="w-4 h-4 text-cyan-400 animate-pulse" />}
            <span className="text-xs text-slate-300 group-hover:text-white">
              Menu: <strong className="text-cyan-400 font-bold">{getPageLabel(currentPage)}</strong>
            </span>
            <span className="text-[10px] text-slate-550">▼</span>
          </button>

          {/* Log out */}
          <button 
            onClick={onLogout} 
            className="p-2 rounded-xl bg-rose-950/20 border border-rose-900/40 text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Sign out of Admin Session"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role Switcher sub-bar on mobile only */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-[#0F172A] border-t border-slate-800 text-xs text-slate-300">
        <div className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="truncate text-slate-300">{adminEmail}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span>Role:</span>
          <select 
            value={adminRole} 
            onChange={(e) => onRoleChange(e.target.value as AdminRole)}
            className="bg-slate-800 text-[11px] font-semibold text-cyan-400 rounded-lg border border-slate-700 px-2.1 py-0.5 focus:outline-none"
          >
            <option value="Superadmin" className="text-white">Superadmin</option>
            <option value="Admin" className="text-white">Admin</option>
            <option value="Tutor" className="text-white">Tutor</option>
          </select>
        </div>
      </div>

      {/* Expandable in-flow dropdown panel (Requirement B1: Pushes content down, never overlays) */}
      {isOpen && (
        <div id="admin-menu-dropdown" className="bg-[#0F172A] border-t border-slate-800 animate-fade-in py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-[10px] tracking-wider text-slate-500 font-bold uppercase mb-4">
              CBT Course Builder Modules & Access Gates
            </h3>
            
            {/* 3-column grid on desktop, 1-column on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center justify-between w-full p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-slate-800/80 border-cyan-500/80 text-cyan-400 shadow-lg shadow-cyan-500/10' 
                        : 'bg-slate-900/30 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-cyan-450' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        typeof item.badge === 'number' && item.badge > 0
                          ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Quick Helper for OAuth info */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                <span>Active Core Sandbox Storage Connected</span>
              </span>
              <span className="bg-slate-900 px-2.5 py-1 rounded-md text-[10px] font-mono border border-slate-850">
                DB STATE: OFFLINE-FIRST SEED READY
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
