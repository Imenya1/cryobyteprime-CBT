import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Check, AlertTriangle, Play, HelpCircle, CornerDownLeft, Users, 
  Trash2, RotateCcw, Lock, ArrowRight, UserCheck, Bolt, ToggleLeft
} from 'lucide-react';
import { Student, AttSession, AttRecord, ExamEligibility } from '../../types';
import { DB } from '../../lib/database';
import { naturalSort } from '../../lib/attendanceUtils';

interface AttendanceCheckinProps {
  session: AttSession;
  onClose: () => void;
  adminEmail: string;
  triggerAuditLog: (action: string, page: string, original?: any, newValue?: any, reason?: string) => Promise<any>;
  protectionPasswordConfirm: (actionLabel: string, callback: () => void) => void;
}

export default function AttendanceCheckin({
  session,
  onClose,
  adminEmail,
  triggerAuditLog,
  protectionPasswordConfirm
}: AttendanceCheckinProps) {
  // --- STATE ---
  const [students, setStudents] = useState<Student[]>([]);
  const [round1Serials, setRound1Serials] = useState<string[]>(session.round1Serials || []);
  const [round2Serials, setRound2Serials] = useState<string[]>(session.round2Serials || []);
  const [activeRound, setActiveRound] = useState<1 | 2>(1);
  const [inputSerial, setInputSerial] = useState('');
  
  // Real-time flash feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const [saving, setSaving] = useState(false);
  const serialInputRef = useRef<HTMLInputElement>(null);

  // Load students for the assigned class
  useEffect(() => {
    const fetchStudentsForClass = async () => {
      const allStudents = await DB.getStudents();
      if (session.class === 'Joint') {
        setStudents(allStudents); // Both Class A and Class B
      } else {
        setStudents(allStudents.filter(s => s.class === session.class));
      }
    };
    fetchStudentsForClass();
    
    // Autofocus input on load
    setTimeout(() => {
      serialInputRef.current?.focus();
    }, 150);
  }, [session]);

  // Keep focus on input unless they explicitly select something else
  const maintainFocus = () => {
    serialInputRef.current?.focus();
  };

  // Pre-loaded student map in-memory for O(1) lightning lookup (no supabase query overhead)
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => {
      map.set(s.classSN.toUpperCase(), s);
    });
    return map;
  }, [students]);

  // Track check-in counts
  const r1Checked = useMemo(() => {
    return round1Serials.map(sn => studentMap.get(sn.toUpperCase())).filter(Boolean) as Student[];
  }, [round1Serials, studentMap]);

  const r2Checked = useMemo(() => {
    return round2Serials.map(sn => studentMap.get(sn.toUpperCase())).filter(Boolean) as Student[];
  }, [round2Serials, studentMap]);

  // Compute absent students in real-time
  const absentStudents = useMemo(() => {
    const checkedSet = new Set([
      ...round1Serials.map(s => s.toUpperCase()),
      ...round2Serials.map(s => s.toUpperCase())
    ]);
    return students.filter(s => !checkedSet.has(s.classSN.toUpperCase())).sort((a, b) => naturalSort(a.classSN, b.classSN));
  }, [students, round1Serials, round2Serials]);

  // Sync serial arrays to DB incrementally (Anti-overwrite overwrite guard)
  const syncSerialsToDatabase = async (r1: string[], r2: string[]) => {
    try {
      await DB.updateAttSession(session.id, {
        round1Serials: r1,
        round2Serials: r2
      });

      // Automatically lock/unlock exam eligibility in real-time as attendance is marked (marked = unlocked!)
      const checkedSet = new Set([...r1.map(s => s.toUpperCase()), ...r2.map(s => s.toUpperCase())]);
      for (const student of students) {
        const isChecked = checkedSet.has(student.classSN.toUpperCase());
        const isR1 = r1.map(s => s.toUpperCase()).includes(student.classSN.toUpperCase());
        await DB.updateExamEligibility(session.id, student.email, {
          status: isChecked ? 'eligible' : 'locked',
          reason: isChecked ? (isR1 ? 'present' : 'late') : 'unmarked'
        });
      }
    } catch (e) {
      console.warn("DB Session sync failed, operating in fallback local state:", e);
    }
  };

  // --- ACTIONS ---

  // Handle individual serial check-in
  const handleCheckin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const snLower = inputSerial.trim().toUpperCase();
    setInputSerial('');
    
    if (!snLower) {
      setFeedback({ type: 'warning', message: 'Please enter a serial number' });
      return;
    }

    const student = studentMap.get(snLower);
    
    // 1. Unknown Serial Alert
    if (!student) {
      setFeedback({ 
        type: 'error', 
        message: `❌ ${snLower} — Not found in this class roster list` 
      });
      maintainFocus();
      return;
    }

    // 2. Already checked in current round
    const activeSerialsList = activeRound === 1 ? round1Serials : round2Serials;
    if (activeSerialsList.map(s => s.toUpperCase()).includes(snLower)) {
      setFeedback({
        type: 'warning',
        message: `⚠️ ${snLower} (${student.name}) already checked in for Round ${activeRound}`
      });
      maintainFocus();
      return;
    }

    // Append to corresponding round state
    let updatedR1 = [...round1Serials];
    let updatedR2 = [...round2Serials];

    if (activeRound === 1) {
      updatedR1.push(snLower);
      setRound1Serials(updatedR1);
    } else {
      updatedR2.push(snLower);
      setRound2Serials(updatedR2);
    }

    // Fire success notification flash
    setFeedback({
      type: 'success',
      message: `✅ ${student.classSN} — Checked In ${student.name} (Round ${activeRound})`
    });

    // Write-back incrementally
    syncSerialsToDatabase(updatedR1, updatedR2);
    maintainFocus();
  };

  // Undo Last Entry (Known issues fix #2)
  const handleUndoLast = () => {
    const list = activeRound === 1 ? [...round1Serials] : [...round2Serials];
    if (list.length === 0) {
      setFeedback({ type: 'warning', message: 'No items in active round to undo' });
      return;
    }
    const removed = list.pop();
    
    if (activeRound === 1) {
      setRound1Serials(list);
      syncSerialsToDatabase(list, round2Serials);
    } else {
      setRound2Serials(list);
      syncSerialsToDatabase(round1Serials, list);
    }

    const student = removed ? studentMap.get(removed.toUpperCase()) : null;
    setFeedback({
      type: 'warning',
      message: student 
        ? `↩️ Undid check-in for ${student.classSN} (${student.name})`
        : `↩️ Undid last check-in`
    });
    maintainFocus();
  };

  // Remove individual entry from list (Undo capability)
  const handleRemoveEntry = (sn: string, round: 1 | 2) => {
    const snUpper = sn.toUpperCase();
    let updatedR1 = [...round1Serials];
    let updatedR2 = [...round2Serials];

    if (round === 1) {
      updatedR1 = updatedR1.filter(s => s.toUpperCase() !== snUpper);
      setRound1Serials(updatedR1);
    } else {
      updatedR2 = updatedR2.filter(s => s.toUpperCase() !== snUpper);
      setRound2Serials(updatedR2);
    }

    syncSerialsToDatabase(updatedR1, updatedR2);
    setFeedback({
      type: 'warning',
      message: `🗑️ Removed ${snUpper} from Round ${round}`
    });
    maintainFocus();
  };

  // Transition rounds helper
  const handleSwitchRound = () => {
    if (activeRound === 1) {
      if (confirm(`Round 1 is locked. Switching to Round 2 check-in. Continue?`)) {
        setActiveRound(2);
        setFeedback({
          type: 'success',
          message: 'Switched to Round 2 Check-in'
        });
      }
    } else {
      setActiveRound(1);
    }
    maintainFocus();
  };

  // DISCARD SESSION
  const handleDiscard = () => {
    protectionPasswordConfirm("Discard active attendance session", async () => {
      if (confirm("Are you sure you want to discard this session entirely? This will delete the session row and wipe records.")) {
        try {
          // Sweep linked child table records first to prevent foreign key errors (cascade map)
          await DB.deleteRecordsBySession(session.id);
          await DB.deleteExamEligibilityBySession(session.id);
          await DB.deleteAttSession(session.id);

          await triggerAuditLog(
            `Discarded and deleted open attendance session on ${session.date}: ${session.topic}`,
            'Attendance Sessions',
            session,
            null,
            "Admin discarded check-in session"
          );
          onClose();
        } catch (err: any) {
          alert("Error discarding session: " + err.message);
        }
      }
    });
  };

  // FINALISE & COMPUTER RECOCRDS (Requirement: Close Session & Save Records)
  const handleCloseAndSave = async () => {
    if (students.length === 0) {
      alert("No students found to compute. Aborting.");
      return;
    }

    const message = `This will finalize attendance for ${students.length} students. This will commit records and LOCK/UNLOCK exam active eligibility gateways in real time. Continue?`;
    if (!confirm(message)) return;

    setSaving(true);
    let auditLogMessage = `Closed session on ${session.date} (${session.class}): `;
    
    try {
      const recordsToInsert: Omit<AttRecord, 'id'>[] = [];
      const eligibilityToUpsert: Omit<ExamEligibility, 'id' | 'updatedAt'>[] = [];

      const r1Set = new Set(round1Serials.map(s => s.toUpperCase()));
      const r2Set = new Set(round2Serials.map(s => s.toUpperCase()));

      students.forEach(student => {
        const studentSN = student.classSN.toUpperCase();
        
        let status: 'present' | 'late' | 'absent' = 'absent';
        let round: '1' | '2' | null = null;

        if (r1Set.has(studentSN)) {
          status = 'present';
          round = '1';
        } else if (r2Set.has(studentSN)) {
          status = 'late';
          round = '2';
        }

        // Add attendance record
        recordsToInsert.push({
          sessionId: session.id,
          email: student.email,
          name: student.name,
          class: student.class,
          classSN: student.classSN,
          date: session.date,
          status,
          round,
          timestamp: new Date().toISOString()
        });

        // Add/Update real-time Exam Eligibility gate (Requirement C2)
        const isEligible = status === 'present' || status === 'late';
        eligibilityToUpsert.push({
          sessionId: session.id,
          email: student.email,
          status: isEligible ? 'eligible' : 'locked',
          reason: isEligible ? (status === 'present' ? 'present' : 'late') : 'absent'
        });
      });

      // Commit attendance records bulk insert 
      await DB.addAttRecords(recordsToInsert);

      // Save eligibility gate rows in a single bulk operation
      const bulkEntries = eligibilityToUpsert.map(elig => ({
        email: elig.email,
        status: elig.status,
        reason: elig.reason as any
      }));
      await DB.updateExamEligibilityBulk(session.id, bulkEntries);

      // Close the session row status
      await DB.updateAttSession(session.id, { status: 'closed' });

      auditLogMessage += `${recordsToInsert.filter(r => r.status === 'present').length} present, ` +
        `${recordsToInsert.filter(r => r.status === 'late').length} late, ` +
        `${recordsToInsert.filter(r => r.status === 'absent').length} absent. Committed to database tables.`;

      await triggerAuditLog(
        auditLogMessage,
        'Attendance Sessions',
        session,
        { status: 'closed', recordsCount: recordsToInsert.length },
        "Manual close and evaluation computation on roster check-in panel"
      );

      setSaving(false);
      onClose();
    } catch (err) {
      alert("Error finalizing: " + err);
      setSaving(false);
    }
  };

  // --- RENDERING ---
  return (
    <div id="checkin-gate-root" className="fixed inset-0 bg-slate-950 text-white flex flex-col z-50 animate-fade-in font-sans h-screen select-none">
      
      {/* PERSISTENT HEADER BAR */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-cyan-400">
            {session.class === 'Joint' ? 'JT' : session.class.toUpperCase().endsWith('A') ? 'A' : 'B'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-mono italic">ACTIVE CHECK-IN GATES</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            </div>
            <h2 className="text-sm font-bold tracking-tight text-white leading-tight">
              {session.topic} — <span className="text-cyan-400 font-bold">{session.class}</span> ({session.date})
            </h2>
          </div>
        </div>

        <button 
          onClick={onClose} 
          className="p-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* CORE TWO-COLUMN SIDE-BY-SIDE PANELS */}
      <div className="grow overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0 bg-slate-950">
        
        {/* LEFT COLUMN: SERIAL CODE INPUT & CONTROLS */}
        <div className="md:col-span-5 border-r border-slate-900/80 p-6 flex flex-col justify-between min-h-0 relative select-none">
          <div className="space-y-6">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500">
              Input Control Engine
            </span>

            {/* Input Serial Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleCheckin(); }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-slate-400 text-xs font-semibold leading-relaxed">
                  Enter student class serial number:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    ref={serialInputRef}
                    value={inputSerial}
                    onChange={(e) => setInputSerial(e.target.value.toUpperCase())}
                    placeholder="e.g. A22 or B31"
                    className="w-full bg-slate-900 text-cyan-350 font-mono font-extrabold text-2xl uppercase p-4 pr-16 rounded-2xl border border-slate-800 focus:outline-none focus:border-cyan-505 focus:bg-slate-900/70 transition-all font-mono placeholder:text-slate-650"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl text-white font-bold transition-all cursor-pointer"
                  >
                    <CornerDownLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>

            {/* Round Toggles */}
            <div className="space-y-2">
              <label className="text-slate-400 text-xs font-semibold">Active Assessment Session Round:</label>
              <div className="grid grid-cols-2 gap-3 bg-slate-900 p-1.5 border border-slate-800/80 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveRound(1)}
                  className={`py-3 text-center rounded-xl font-bold font-sans text-xs transition-colors cursor-pointer ${
                    activeRound === 1 
                      ? 'bg-cyan-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Round 1 (On Time)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRound(2)}
                  className={`py-3 text-center rounded-xl font-bold font-sans text-xs transition-colors cursor-pointer ${
                    activeRound === 2 
                      ? 'bg-amber-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Round 2 (Late)
                </button>
              </div>
            </div>

            {/* Real-time Color Flash Feedback banner */}
            <div className="min-h-16 flex items-center justify-center">
              {feedback.type && (
                <div 
                  className={`w-full p-4 rounded-xl border flex items-start space-x-2.5 animate-zoom-in text-xs ${
                    feedback.type === 'success' 
                      ? 'bg-green-950/30 border-green-800/55 text-green-300' 
                      : feedback.type === 'warning'
                      ? 'bg-amber-955/20 border-amber-800/50 text-amber-300'
                      : 'bg-rose-955/20 border-rose-800/50 text-rose-300'
                  }`}
                >
                  {feedback.type === 'success' && <Check className="w-4.5 h-4.5 shrink-0 text-green-400" />}
                  {feedback.type === 'warning' && <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-400" />}
                  {feedback.type === 'error' && <X className="w-4.5 h-4.5 shrink-0 text-rose-400" />}
                  <span className="font-semibold leading-relaxed">{feedback.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick tools */}
          <div className="space-y-3 pt-6 border-t border-slate-905">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Check-in Quick utilities</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleUndoLast}
                className="py-2.5 px-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Last</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchRound}
                className="py-2.5 px-3 rounded-xl border border-cyan-800/30 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-950/40 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{activeRound === 1 ? 'Go to Round 2' : 'Go to Round 1'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE ATTENDANCE BOARD */}
        <div className="md:col-span-7 p-6 overflow-hidden flex flex-col min-h-0 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500">Live Attendance Board</span>
            <div className="text-xs font-mono font-medium text-cyan-400">
              ACTIVE ROSTER SIZE: <strong className="text-white font-black">{students.length}</strong>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5 grow overflow-hidden min-h-0">
            {/* Round 1 Checkins list */}
            <div className="border border-slate-900 rounded-2xl bg-slate-900/10 flex flex-col min-h-0">
              <div className="p-3 bg-slate-900/50 border-b border-slate-900 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-300 font-mono uppercase tracking-wider">Round 1 ({round1Serials.length})</span>
              </div>
              <div className="overflow-y-auto p-2 grow space-y-1">
                {r1Checked.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-900 group">
                    <div className="truncate pr-1">
                      <p className="font-mono text-cyan-300 font-bold text-xs">{student.classSN}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{student.name}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveEntry(student.classSN, 1)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Remove Entry"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Round 2 Checkins list */}
            <div className="border border-slate-900 rounded-2xl bg-slate-900/10 flex flex-col min-h-0">
              <div className="p-3 bg-slate-900/50 border-b border-slate-900 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-305 font-mono uppercase tracking-wider">Round 2 ({round2Serials.length})</span>
              </div>
              <div className="overflow-y-auto p-2 grow space-y-1">
                {r2Checked.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-900 group">
                    <div className="truncate pr-1">
                      <p className="font-mono text-amber-400 font-bold text-xs">{student.classSN}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{student.name}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveEntry(student.classSN, 2)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Remove Entry"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Absent So Far List */}
            <div className="border border-slate-900 rounded-2xl bg-slate-900/15 flex flex-col min-h-0">
              <div className="p-3 bg-slate-900/55 border-b border-slate-900 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Absent ({absentStudents.length})</span>
              </div>
              <div className="overflow-y-auto p-2 grow space-y-1">
                {absentStudents.map((student) => (
                  <div key={student.id} className="p-2 rounded-xl bg-slate-950 border border-slate-900/50">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500 text-xs font-semibold">{student.classSN}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{student.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR GATES */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4.5 flex items-center justify-between select-none">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={saving}
          className="px-4.5 py-2.5 rounded-xl border border-rose-900/40 bg-rose-950/10 hover:bg-rose-950/20 text-rose-450 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
        >
          Discard Session Roster
        </button>

        {/* Real-time exam activation indicator */}
        <div className="hidden lg:flex items-center space-x-3 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl">
          <Bolt className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400 text-xs">Ready for CBT Gate sync?</span>
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
        </div>

        <button
          type="button"
          onClick={handleCloseAndSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold tracking-tight shadow-md flex items-center space-x-2 transition-all cursor-pointer"
        >
          {saving ? <RotateCcw className="w-4 h-4 animate-spin text-white" /> : <Lock className="w-4 h-4" />}
          <span>Close Session & Save Records</span>
        </button>
      </div>
    </div>
  );
}
