import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Calendar, FileText, FileEdit, Users, HelpCircle, Layers, 
  Database, Lock, ShieldCheck, Power, Key, ArrowRight, BookOpen, Clock, 
  CheckCircle, ChevronRight, Play, AlertTriangle, RefreshCw, Sparkles, UserCheck, Trash2
} from 'lucide-react';
import { DB } from './lib/database';
import { 
  AdminRole, Student, AttSession, AttRecord, AttEditRequest, Result, SystemConfig 
} from './types';
import { naturalSort } from './lib/attendanceUtils';

// Subpages import
import Students from './pages/admin/Students';
import Attendance from './pages/admin/Attendance';
import Exams from './pages/admin/Exams';
import Approvals from './pages/admin/Approvals';
import DriveSync from './pages/admin/DriveSync';
import StudentCBT from './pages/StudentCBT';
import AdminHeader from './components/AdminHeader';

export default function App() {
  // --- GENERAL STATE CHANNEL ---
  const [sessionUserType, setSessionUserType] = useState<'chooser' | 'student_portal' | 'admin_portal'>('chooser');
  
  // Secret admin access state
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdminTabBySecret, setShowAdminTabBySecret] = useState(false);

  // Check URL parameters for admin bypass on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || params.get('role') === 'admin' || params.get('console') === 'secure') {
      setShowAdminTabBySecret(true);
    }
  }, []);

  // Administrative Auth
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRole>('Admin');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');

  // Page Routing inside Admin Console
  const [currentAdminPage, setCurrentAdminPage] = useState<string>('dashboard');

  const handleLogoClick = () => {
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setShowAdminTabBySecret(true);
        setCurrentAdminPage('admin_sign_bar');
        return 0; // reset
      }
      return next;
    });
  };

  // Core collections synced from DB
  const [students, setStudents] = useState<Student[]>([]);
  const [attSessions, setAttSessions] = useState<AttSession[]>([]);
  const [attRecords, setAttRecords] = useState<AttRecord[]>([]);
  const [editRequests, setEditRequests] = useState<AttEditRequest[]>([]);
  const [examResults, setExamResults] = useState<Result[]>([]);
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);

  const [loading, setLoading] = useState(false);

  // Simulated live notification alerts counts
  const [pendingDeletionsCount, setPendingDeletionsCount] = useState(0);

  // Global password security confirmation dialogue modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordActionLabel, setPasswordActionLabel] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordCallback, setPasswordCallback] = useState<() => void>(() => {});
  const [passwordError, setPasswordError] = useState('');

  // Individual Student detail overlay for Reports tab
  const [selectedStudentReport, setSelectedStudentReport] = useState<Student | null>(null);
  const [studentReportHistory, setStudentReportHistory] = useState<AttRecord[]>([]);

  // Sync general administrative datatables
  const syncAdministrativeTables = async () => {
    setLoading(true);
    try {
      const studs = await DB.getStudents();
      const sess = await DB.getAttSessions();
      const recs = await DB.getAttRecords();
      const reqs = await DB.getAttEditReqs();
      const res = await DB.getResults();
      const conf = await DB.getConfig();
      const dels = await DB.getDeletionRequests();

      setStudents(studs);
      setAttSessions(sess);
      setAttRecords(recs);
      setEditRequests(reqs);
      setExamResults(res);
      setSysConfig(conf);

      // Pending approvals tally for notification rings
      setPendingDeletionsCount(dels.filter(r => r.status === 'pending').length);
    } catch (e) {
      console.warn("Table synchronization exception:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) {
      syncAdministrativeTables();
    }
  }, [isAdminLoggedIn]);

  // --- PASSWORD PROTECTION METHOD GATES ---
  const triggerPasswordConfirm = (actionLabel: string, callback: () => void) => {
    setPasswordActionLabel(actionLabel);
    setEnteredPassword('');
    setPasswordError('');
    setPasswordCallback(() => callback);
    setShowPasswordModal(true);
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    try {
      const config = await DB.getConfig();

      // Superadmin requests require the master superadminPassword
      const isSuperAction = passwordActionLabel.toUpperCase().includes("APPROVE DATA") || 
                            passwordActionLabel.toUpperCase().includes("SUPERADMIN") ||
                            adminRole === 'Superadmin';
                            
      const validKey = isSuperAction 
        ? (config.superadminPassword || 'super') 
        : (config.protectionPassword || 'admin');

      if (enteredPassword.trim() === validKey) {
        setShowPasswordModal(false);
        passwordCallback(); // Fire verified callback
      } else {
        setPasswordError('Invalid authorization PIN code key. Please try again.');
      }
    } catch {
      setPasswordError('Error validating credentials payload.');
    }
  };

  // --- SECURITY AUDIT LOG WRITER ---
  const triggerAuditLog = async (
    action: string, 
    page: string, 
    originalValue?: any, 
    newValue?: any, 
    reason?: string
  ) => {
    try {
      return await DB.addAuditLog({
        userName: adminEmail || 'joy.imenya@cryobyteprime.com',
        userRole: adminRole,
        action,
        originalValue: originalValue ? JSON.stringify(originalValue) : undefined,
        newValue: newValue ? JSON.stringify(newValue) : undefined,
        reason: reason || 'Standard administrative dashboard click logs',
        page
      });
    } catch (e) {
      console.warn("Audit logger exception bypass:", e);
    }
  };

  // --- AUTH COMMANDS ---
  const handleAdminSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');

    const emailLower = adminEmail.trim().toLowerCase();
    if (!emailLower) {
      setAdminAuthError('Please enter administrator email address.');
      return;
    }

    // Role mapping resolution based on email
    let resolvedRole: AdminRole = 'Tutor';
    if (emailLower.includes('super') || emailLower === 'imenya27@gmail.com') {
      resolvedRole = 'Superadmin';
    } else if (emailLower.includes('admin')) {
      resolvedRole = 'Admin';
    }

    setAdminRole(resolvedRole);
    setIsAdminLoggedIn(true);
    setSessionUserType('admin_portal');
    setCurrentAdminPage('dashboard');
    triggerAuditLog(
      `Administrator signed in manually with simulated role: ${resolvedRole}`,
      'Administrative Logins',
      null,
      { email: emailLower, role: resolvedRole },
      "Session started on developer sandbox"
    );
  };

  const handleAdminLogout = () => {
    triggerAuditLog(
      `Administrator signed out of session`,
      'Administrative Logins',
      null,
      null,
      "Standard teardown"
    );
    setIsAdminLoggedIn(false);
    setAdminEmail('');
    setSessionUserType('chooser');
  };

  // --- ACTIONS: REPORT OVERVIEWS ---
  const handleViewReportHistory = (stud: Student) => {
    const history = attRecords.filter(r => r.email.toLowerCase() === stud.email.toLowerCase());
    setSelectedStudentReport(stud);
    setStudentReportHistory(history.sort((a,b) => b.date.localeCompare(a.date)));
  };

  // --- ACTIONS: CORRECTION REQUESTS GATES ---
  const handleResolveCorrectionEdit = (req: AttEditRequest, status: 'approved' | 'rejected') => {
    const actionLabel = `${status.toUpperCase()} CORRECTION REQUEST (Session ID: ${req.classSN})`;
    
    // Changing student attendance logs requires standard security PIN
    triggerPasswordConfirm(actionLabel, async () => {
      try {
        // 1. Update correction request row state
        await DB.updateAttEditReq(req.id, {
          status,
          resolvedBy: adminEmail,
          resolvedAt: new Date().toISOString()
        });

        // 2. If approved, modify the underlying attendance record linked table!
        if (status === 'approved') {
          const records = await DB.getAttRecords();
          const targetRecord = records.find(r => r.sessionId === req.sessionId && r.email.toLowerCase() === req.email.toLowerCase());
          
          if (targetRecord) {
            await DB.updateAttRecord(targetRecord.id, {
              status: req.requestedStatus,
              round: req.requestedStatus === 'present' ? '1' : '2'
            });
          } else {
            // Record was absent or missing entirely, perform an upsert insertion
            await DB.addAttRecord({
              sessionId: req.sessionId,
              email: req.email,
              name: req.name,
              class: req.classSN.startsWith('A') ? 'Class A' : 'Class B',
              classSN: req.classSN,
              date: new Date().toISOString().slice(0, 10),
              status: req.requestedStatus,
              round: req.requestedStatus === 'present' ? '1' : '2',
              timestamp: new Date().toISOString()
            });
          }
        }

        // 3. Log modifications
        await triggerAuditLog(
          `${status.toUpperCase()} correction request for ${req.name} (${req.classSN})`,
          'Attendance Corrections',
          req,
          { status },
          "Admin processed student check-in ticket"
        );

        syncAdministrativeTables();
      } catch (err) {
        alert("Evaluation exception: " + err);
      }
    });
  };

  // --- COMPUTE DASHBOARD STATS ---
  const dashboardStats = useMemo(() => {
    const totalSCount = students.length;
    const totalSessCount = attSessions.length;
    
    // Average attendance ratios
    let avgPct = 0;
    if (totalSCount > 0 && totalSessCount > 0) {
      const positiveCount = attRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      avgPct = Math.round((positiveCount / (totalSCount * totalSessCount)) * 100);
    }

    const openSessions = attSessions.filter(s => s.status === 'open');
    const runningCBT = sysConfig?.examActivated || false;

    return { totalSCount, totalSessCount, avgPct, openSessions, runningCBT };
  }, [students, attSessions, attRecords, sysConfig]);

  // Compute percentage attendance standing per student (to list in reports tab)
  const reportCardsList = useMemo(() => {
    const totalSessionCount = attSessions.length;
    
    return students.map(student => {
      const records = attRecords.filter(r => r.email.toLowerCase() === student.email.toLowerCase());
      const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
      const percentage = totalSessionCount > 0 ? Math.round((presentCount / totalSessionCount) * 100) : 100;
      
      let standing: 'good' | 'risk' | 'poor' = 'poor';
      if (percentage >= 75) standing = 'good';
      else if (percentage >= 50) standing = 'risk';

      return { student, presentCount, totalNeeded: totalSessionCount, percentage, standing };
    }).sort((a,b) => naturalSort(a.student.classSN, b.student.classSN));
  }, [students, attSessions, attRecords]);


  // --- RENDER PORTALS ---
  if (sessionUserType === 'chooser') {
    return (
      <div id="cbt-chooser-viewport" className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between font-sans h-screen select-none relative overflow-hidden">
        
        {/* Subtle glowing mesh backgrounds */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-cyan-700/10 rounded-full blur-3xl animate-pulse"></div>

        {/* Header */}
        <header className="px-6 py-5 flex items-center justify-between border-b border-slate-900 shrink-0 relative z-10 bg-slate-950/40 backdrop-blur-md select-none">
          <div 
            onClick={handleLogoClick}
            className="flex items-center space-x-3 cursor-pointer group active:opacity-80 transition-opacity"
            title="Core administrative secret gate validation"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center font-bold text-cyan-400 group-hover:border-cyan-400/50 transition-colors">
              <Sparkles className="w-5.5 h-4.8 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-left font-sans">
              <h1 className="text-sm font-black tracking-wider text-white leading-tight uppercase">CryoBytePrime</h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">LEARNFACTORY EVALUATIONS PORTAL</p>
            </div>
          </div>

          <span className="text-[10px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl font-mono text-zinc-400">v3.2.0-secure</span>
        </header>

        {/* Body content selection */}
        <main className="grow flex flex-col items-center justify-center px-6 relative z-10 py-8">
          <div className="max-w-xl text-center space-y-8 animate-fade-in">
            <div className="space-y-3 max-w-lg mx-auto">
              <h2 className="text-3xl font-extrabold tracking-tight leading-none bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-200 bg-clip-text text-transparent uppercase">
                CryoBytePrime CBT
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                Continuous assessment system and real-time attendance management suite. Log in to start test session or open lesson grids.
              </p>
            </div>

            <div className={`grid grid-cols-1 ${showAdminTabBySecret ? 'md:grid-cols-2' : ''} gap-4 max-w-md mx-auto transition-all`}>
              {/* CBT Quiz taker link */}
              <button
                onClick={() => setSessionUserType('student_portal')}
                className={`p-5 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 rounded-3xl text-left select-none transition-all group cursor-pointer hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5 relative ${
                  !showAdminTabBySecret ? 'mx-auto max-w-xs text-center flex flex-col items-center' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 text-cyan-400 mb-3.5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300">Take CBT Exam</h3>
                <p className={`text-[11px] text-slate-450 mt-1 font-normal leading-normal ${!showAdminTabBySecret ? 'text-center' : ''}`}>
                  Enter course email and serial ID code to request testing gate access.
                </p>
                {showAdminTabBySecret && (
                  <ChevronRight className="w-4 h-4 text-slate-500 absolute right-4 bottom-4 group-hover:translate-x-1 transition-transform" />
                )}
              </button>

              {/* Administrative login link */}
              {showAdminTabBySecret && (
                <button
                  onClick={() => setCurrentAdminPage('admin_sign_bar')}
                  className="p-5 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 rounded-3xl text-left select-none transition-all group cursor-pointer hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5 relative animate-zoom-in"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 text-cyan-400 mb-3.5">
                    <Key className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300">Admin Console</h3>
                  <p className="text-[11px] text-slate-450 mt-1 font-normal leading-normal">Simulate Superadmin, Admin or Lesson Tutors for attendance management.</p>
                  <ChevronRight className="w-4 h-4 text-slate-500 absolute right-4 bottom-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            {/* Quick credentials popup panel trigger */}
            {currentAdminPage === 'admin_sign_bar' && (
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl max-w-xs mx-auto animate-zoom-in text-xs space-y-4 shadow-xl shadow-cyan-500/5">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-extrabold text-[11px] text-slate-200">Admin Authentication Simulator</span>
                  <button onClick={() => setCurrentAdminPage('dashboard')} className="text-slate-500 hover:text-slate-300 cursor-pointer">✕</button>
                </div>
                {adminAuthError && <p className="text-rose-400 font-mono text-[10px] text-left">{adminAuthError}</p>}
                
                <form onSubmit={handleAdminSignIn} className="space-y-3 text-left font-sans">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. super@cbt.com"
                    className="w-full bg-slate-950 p-3.5 text-cyan-400 font-bold border border-slate-850 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-xl font-mono text-center"
                    required
                  />
                  <button type="submit" className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-[11px] uppercase tracking-wide rounded-xl shadow-lg shadow-cyan-600/20 cursor-pointer transition-all">Validate Session</button>
                </form>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-5 text-center border-t border-slate-900/60 shrink-0 text-[10.5px] text-slate-500 font-mono tracking-widest uppercase">
          CRYO BYTE PRIME COHORT EVALUATIONS SYSTEM © 2026
        </footer>
      </div>
    );
  }

  // --- STAGE 2: REDIRECTS TO STUDENT CBT PANEL ---
  if (sessionUserType === 'student_portal') {
    return <StudentCBT />;
  }

  // --- STAGE 3: MAIN ADMINISTRATIVE PORTAL LAYOUT ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none pb-12">
      
      {/* HEADER NAVIGATION SHELL */}
      <AdminHeader
        currentPage={currentAdminPage}
        onPageChange={setCurrentAdminPage}
        adminRole={adminRole}
        onRoleChange={setAdminRole}
        pendingRequestsCount={editRequests.filter(r => r.status === 'pending').length}
        pendingDeletionsCount={pendingDeletionsCount}
        adminEmail={adminEmail || 'imenya27@gmail.com'}
        onLogout={handleAdminLogout}
      />

      {/* CORE WORKSPACE viewport */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {loading && (
          <div className="p-3 bg-zinc-900 text-white font-mono text-[10px] rounded-xl flex items-center space-x-1.5 shrink-0 max-w-xs mb-3 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Evaluating central datatables sync...</span>
          </div>
        )}

        {/* SWITCH PAGE DETECTIVE */}
        {currentAdminPage === 'dashboard' && (
          <div className="space-y-6 animate-fade-in text-xs select-none">
            {/* STATS BENTO MATRIX */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4.5 border border-slate-200 rounded-2xl shadow-sm text-left font-sans">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block tracking-widest leading-none">Roster Enrolled</span>
                <strong className="text-2xl font-black text-slate-900 block mt-1.5">{dashboardStats.totalSCount} candidates</strong>
              </div>
              <div className="bg-white p-4.5 border border-slate-200 rounded-2xl shadow-sm text-left font-sans">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block tracking-widest leading-none">Lesson Sessions</span>
                <strong className="text-2xl font-black text-slate-900 block mt-1.5">{dashboardStats.totalSessCount} sessions</strong>
              </div>
              <div className="bg-white p-4.5 border border-slate-200 rounded-2xl shadow-sm text-left font-sans">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block tracking-widest leading-none">Attendance Ratio</span>
                <strong className={`text-2xl font-black block mt-1.5 ${dashboardStats.avgPct >= 75 ? 'text-green-600' : 'text-amber-600'}`}>{dashboardStats.avgPct}% average</strong>
              </div>
              <div className="bg-white p-4.5 border border-slate-200 rounded-2xl shadow-sm text-left font-sans">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block tracking-widest leading-none">Active CBT gate</span>
                <strong className={`text-xl font-black block mt-2 ${dashboardStats.runningCBT ? 'text-green-600' : 'text-slate-400'}`}>
                  {dashboardStats.runningCBT ? '● Activation Open' : '○ Access Closed'}
                </strong>
              </div>
            </div>

            {/* LOWER COGNITIVE DASHBOARD GROUPS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
              
              {/* Left Column: Active Checkin monitors */}
              <div className="lg:col-span-12 space-y-4">
                <div className="bg-white border rounded-3xl p-5 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-sm pb-2 border-b">Active Enrolling Check-ins</h3>
                  
                  {dashboardStats.openSessions.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-normal">
                      No active sessions currently enrolling students. Go to <strong className="font-bold text-cyan-600">Attendance Sessions</strong> to initialize a new roster.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dashboardStats.openSessions.map((s) => (
                        <div key={s.id} className="p-4 border border-cyan-100 bg-cyan-50/10 rounded-2xl flex items-center justify-between group">
                          <div className="space-y-1">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase bg-cyan-100/40 text-cyan-700 bg-cyan-50 border border-cyan-150">Open checkin gate</span>
                            <h4 className="font-extrabold text-slate-900 text-sm leading-tight mt-0.5">{s.topic} — <span className="text-cyan-600 text-xs">({s.class})</span></h4>
                            <p className="text-[10px] text-slate-400 font-mono italic">Date: {s.date} · Enrolled Round 1: {s.round1Serials?.length || 0} · Round 2: {s.round2Serials?.length || 0}</p>
                          </div>

                          <button
                            onClick={() => setCurrentAdminPage('attendance')}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold shadow transition-transform cursor-pointer"
                          >
                            Jump to Check-in Panel
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {currentAdminPage === 'attendance' && (
          <Attendance
            adminRole={adminRole}
            adminEmail={adminEmail || ' joy.imenya@cryobyteprime.com'}
            triggerAuditLog={triggerAuditLog}
            protectionPasswordConfirm={triggerPasswordConfirm}
          />
        )}

        {currentAdminPage === 'report' && (
          <div className="space-y-6 animate-fade-in text-xs select-none">
            {/* REPORTS TITLE */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-6 h-6 text-cyan-600" />
                <span>Attendance standing report registries</span>
              </h2>
              <p className="text-xs text-slate-500">Inspect total session presence percentages, standing bounds, and generate itemized PDF report sheets.</p>
            </div>

            {/* MAIN REPORTS LIST COMPILATION */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-sans font-medium text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[9px] text-slate-500 uppercase sticky top-0 z-15">
                    <tr>
                      <th className="p-3 bg-slate-55 w-24">Serial code</th>
                      <th className="p-3 bg-slate-50">Candidate log info</th>
                      <th className="p-3 bg-slate-50">Stream</th>
                      <th className="p-3 bg-slate-50 text-center">Score ratios</th>
                      <th className="p-3 bg-slate-50 text-center">Calculated %</th>
                      <th className="p-3 bg-slate-50">Standing state</th>
                      <th className="p-3 bg-slate-50 text-right pr-6 w-32">Operational</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {reportCardsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-400 font-serif">No computed standing reports logs.</td>
                      </tr>
                    ) : (
                      reportCardsList.map(({ student, presentCount, totalNeeded, percentage, standing }) => (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-mono font-black text-slate-900">{student.classSN}</td>
                          <td className="p-3">
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{student.name}</p>
                              <p className="text-[10px] text-slate-450 font-mono mt-0.5">{student.email}</p>
                            </div>
                          </td>
                          <td className="p-3">{student.class}</td>
                          <td className="p-3 text-center font-mono font-bold">{presentCount} / {totalNeeded}</td>
                          <td className="p-3 text-center">
                            <span className={`font-mono text-xs font-black ${percentage >= 75 ? 'text-green-600' : percentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {percentage}%
                            </span>
                          </td>
                          <td className="p-3 uppercase font-mono tracking-tight text-[10px]">
                            {standing === 'good' && (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-150 font-extrabold">Good (75%+)</span>
                            )}
                            {standing === 'risk' && (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 text-amber-705 border border-amber-150 font-bold">At Risk (50%+)</span>
                            )}
                            {standing === 'poor' && (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-rose-50 text-rose-750 border border-rose-150 font-extrabold">Poor (&lt; 50%)</span>
                            )}
                          </td>
                          <td className="p-3 text-right pr-6">
                            <button
                              onClick={() => handleViewReportHistory(student)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border text-[10.5px] font-bold text-slate-700 transition-colors cursor-pointer"
                            >
                              Inspect history
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* INDIVIDUAL STUDENT HISTORY POPUP OVERLAY */}
            {selectedStudentReport && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in select-none">
                <div className="bg-white rounded-3xl border shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col animate-zoom-in text-xs font-sans">
                  {/* Header */}
                  <div className="bg-slate-50 border-b px-5 py-4 flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        Attendance Logs: {selectedStudentReport.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">{selectedStudentReport.classSN} · {selectedStudentReport.email}</p>
                    </div>
                    <button onClick={() => setSelectedStudentReport(null)} className="text-slate-400 hover:text-slate-650 cursor-pointer">✕</button>
                  </div>

                  {/* List */}
                  <div className="grow overflow-y-auto p-4 space-y-2">
                    {studentReportHistory.length === 0 ? (
                      <div className="py-20 text-center text-slate-405">
                        No checked attendance logs on record for this student ID.
                      </div>
                    ) : (
                      studentReportHistory.map((rec) => (
                        <div key={rec.id} className="p-3.5 border rounded-2xl bg-slate-50/70 flex items-center justify-between">
                          <div className="space-y-0.5 text-left leading-normal">
                            <p className="font-bold text-slate-800 leading-none">Date: {rec.date}</p>
                            <span className="text-[9.5px] text-slate-400 font-mono block uppercase">Sync: {rec.timestamp.slice(11,16)} UTC</span>
                          </div>

                          <div className="text-right">
                            {rec.status === 'present' ? (
                              <span className="px-2 py-0.5 bg-green-50 border border-green-150 text-green-700 font-bold font-mono text-[9px] rounded-full uppercase">Present (R1)</span>
                            ) : rec.status === 'late' ? (
                              <span className="px-2 py-0.5 bg-amber-50 border border-amber-150 text-amber-705 font-bold font-mono text-[9px] rounded-full uppercase">Late (R2)</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-150 text-rose-700 font-bold font-mono text-[9px] rounded-full uppercase">Absent</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="bg-slate-50 border-t p-4 flex items-center justify-end">
                    <button
                      onClick={() => setSelectedStudentReport(null)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-lg font-bold"
                    >
                      Close Summary
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentAdminPage === 'edit-requests' && (
          <div className="space-y-6 animate-fade-in text-xs select-none">
            {/* CORRECTIONS TITLE */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <FileEdit className="w-6 h-6 text-cyan-600 animate-pulse" />
                <span>Attendance Edit & Correction Tickets</span>
              </h2>
              <p className="text-xs text-slate-500">Tutors send corrective tickets (excused lates or absences). Process approvals here under secure PIN tracking.</p>
            </div>

            {/* LEDGER GRID CARD */}
            {editRequests.length === 0 ? (
              <div className="bg-white border rounded-3xl p-16 text-center text-slate-400 font-sans text-xs">
                Perfect! No pending correction tickets on file.
              </div>
            ) : (
              <div className="space-y-4">
                {editRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  
                  return (
                    <div key={req.id} className="bg-white border hover:border-slate-300 rounded-3xl p-5 shadow-sm relative flex flex-col md:flex-row justify-between gap-4">
                      
                      {/* Ticket metadata */}
                      <div className="space-y-2 text-left shrink pr-2">
                        <div className="flex items-center space-x-2">
                           <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-slate-100 border text-slate-550 font-mono">EDIT REQUEST</span>
                          {isPending ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 border border-amber-200 text-amber-705 uppercase font-mono animate-pulse">PENDING REVIEW</span>
                          ) : isApproved ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-green-50 border border-green-200 text-green-700 uppercase font-mono">APPROVED LOG</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-150 border border-slate-200 text-slate-500 uppercase font-mono">REJECTED DISMISS</span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-sm">
                          Candidate: <strong className="text-slate-800 font-black">{req.name}</strong> (<span className="font-mono text-xs font-black text-indigo-705">{req.classSN}</span>)
                        </h4>

                        <p className="text-[11px] text-indigo-850 font-sans leading-relaxed">
                          Correction Target Request: Change attendance status to <strong className="text-cyan-600 font-bold uppercase font-mono">{req.requestedStatus}</strong>
                        </p>
                        
                        <p className="p-2.5 bg-slate-50 border border-slate-100 italic rounded-xl mt-1 font-sans text-slate-500 leading-relaxed max-w-xl">
                          Justification Note: "{req.reason}"
                        </p>
                      </div>

                      {/* Operational controls if pending */}
                      {isPending && (
                        <div className="flex md:flex-col items-center justify-center shrink-0 min-w-[120px] gap-2 pt-2 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5 select-none font-sans">
                          <button
                            onClick={() => handleResolveCorrectionEdit(req, 'approved')}
                            className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                          >
                            <span>Approve Approve</span>
                          </button>
                          <button
                            onClick={() => handleResolveCorrectionEdit(req, 'rejected')}
                            className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <span>Dismiss Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentAdminPage === 'students' && (
          <Students
            adminRole={adminRole}
            adminEmail={adminEmail || ' joy.imenya@cryobyteprime.com'}
            triggerAuditLog={triggerAuditLog}
            onShowDeletionsPanel={() => setCurrentAdminPage('auditlog')}
            protectionPasswordConfirm={triggerPasswordConfirm}
          />
        )}

        {currentAdminPage === 'questionbank' && (
          <Exams
            adminRole={adminRole}
            adminEmail={adminEmail || ' joy.imenya@cryobyteprime.com'}
            triggerAuditLog={triggerAuditLog}
            protectionPasswordConfirm={triggerPasswordConfirm}
          />
        )}

        {currentAdminPage === 'results' && (
          <div className="space-y-6 animate-fade-in text-xs select-none">
            {/* EXAM RESULTS TITLE */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-6 h-6 text-cyan-600" />
                <span>CBT active examination score archives</span>
              </h2>
              <p className="text-xs text-slate-500 font-sans">Index of students' submitted test answer sheets scored automatically by the engine.</p>
            </div>

            {/* RESULTS SCORE CARD TABLE */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-sans font-medium text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[9px] text-slate-500 uppercase sticky top-0 z-15">
                    <tr>
                      <th className="p-3 bg-slate-55 w-24">Serial code</th>
                      <th className="p-3 bg-slate-50">Candidate Email</th>
                      <th className="p-3 bg-slate-50">Class</th>
                      <th className="p-3 bg-slate-50 text-center">Score points</th>
                      <th className="p-3 bg-slate-50 text-center">Calculated %</th>
                      <th className="p-3 bg-slate-50">Saved Date (UTC)</th>
                      <th className="p-3 bg-slate-50 text-right pr-6 w-32">Parity key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {examResults.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-zinc-400 font-serif">No test sheets submitted yet. Wait for candidates login sessions.</td>
                      </tr>
                    ) : (
                      examResults.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-mono font-black text-slate-900">{r.classSN}</td>
                          <td className="p-3">
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{r.name}</p>
                              <p className="text-[10px] text-slate-450 font-mono mt-0.5">{r.email}</p>
                            </div>
                          </td>
                          <td className="p-3">{r.class}</td>
                          <td className="p-3 text-center font-mono font-bold leading-none">{r.score} / {r.totalQuestions}</td>
                          <td className="p-3 text-center font-mono font-black text-cyan-600 text-xs">{r.percentage}%</td>
                          <td className="p-3 text-slate-450 font-mono text-[10px]">{r.submittedAt.slice(0, 10)} {r.submittedAt.slice(11, 16)}</td>
                          <td className="p-3 text-right pr-6 font-mono text-[9.5px] text-indigo-705 font-bold uppercase truncate max-w-[120px]" title={r.id}>
                            {r.id}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentAdminPage === 'auditlog' && (
          <Approvals
            adminRole={adminRole}
            adminEmail={adminEmail || ' joy.imenya@cryobyteprime.com'}
            triggerAuditLog={triggerAuditLog}
            protectionPasswordConfirm={triggerPasswordConfirm}
          />
        )}

        {currentAdminPage === 'settings' && (
          <div className="space-y-6">
            <DriveSync triggerAuditLog={triggerAuditLog} />
            
            <Approvals
              adminRole={adminRole}
              adminEmail={adminEmail || ' joy.imenya@cryobyteprime.com'}
              triggerAuditLog={triggerAuditLog}
              protectionPasswordConfirm={triggerPasswordConfirm}
            />
          </div>
        )}

      </main>

      {/* CENTRALIZED PASSWORD VERIFICATION MODAL COVERS DESTRUCTIVES */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="bg-white rounded-3xl border shadow-2xl max-w-sm w-full animate-zoom-in font-sans text-xs overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 px-5 py-4 text-left flex items-start space-x-2.5">
              <Lock className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm leading-tight">PIN Authorization Gating</h3>
                <p className="text-[10px] text-rose-700 tracking-tight leading-normal mt-0.5 uppercase font-mono font-bold">REQUIRED FOR: {passwordActionLabel}</p>
              </div>
            </div>

            <form onSubmit={handleVerifyPassword} className="p-5 space-y-4">
              <p className="text-slate-500 font-normal leading-relaxed text-left">
                To execute this operation safely in learning registries, enter standard protect passkey or super key.
              </p>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-left font-sans font-semibold rounded-xl">
                  {passwordError}
                </div>
              )}

              <input
                type="password"
                placeholder="Enter Authorization PIN code"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                className="w-full bg-slate-100 border p-3 rounded-xl focus:bg-white text-center font-extrabold text-slate-900 text-lg tracking-widest focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                autoComplete="off"
                required
                autoFocus
              />

              <div className="flex items-center space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-1/2 py-2.5 border rounded-xl font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl cursor-pointer"
                >
                  Confirm Gate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
