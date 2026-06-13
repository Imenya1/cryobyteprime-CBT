import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, HelpCircle, ToggleLeft, ToggleRight, Plus, Pencil, Trash2, 
  Search, ShieldAlert, Key, CheckCircle, XCircle, AlertTriangle, ListChecks,
  Sliders, PlusCircle, Check, Info, FileSpreadsheet, Send
} from 'lucide-react';
import { Question, ExamEligibility, Student, QuestionType, AdminRole } from '../../types';
import { DB } from '../../lib/database';
import { naturalSort } from '../../lib/attendanceUtils';

interface ExamsProps {
  adminRole: AdminRole;
  adminEmail: string;
  triggerAuditLog: (action: string, page: string, original?: any, newValue?: any, reason?: string) => Promise<any>;
  protectionPasswordConfirm: (actionLabel: string, callback: () => void) => void;
}

export default function Exams({
  adminRole,
  adminEmail,
  triggerAuditLog,
  protectionPasswordConfirm
}: ExamsProps) {
  // --- STATE ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [eligibilityList, setEligibilityList] = useState<ExamEligibility[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examActivated, setExamActivated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'questions' | 'eligibility'>('questions');

  // Search/Filters
  const [qSearch, setQSearch] = useState('');
  const [eSearch, setESearch] = useState('');
  const [eClassFilter, setEClassFilter] = useState('All');
  const [eStatusFilter, setEStatusFilter] = useState('All');

  // New/Edit Question states
  const [isQModalOpen, setIsQModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<QuestionType>('mcq');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qAnswer, setQAnswer] = useState('A');
  const [qSubject, setQSubject] = useState('');
  const [qDifficulty, setQDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [qError, setQError] = useState('');

  // Eligibility Override states
  const [selectedElig, setSelectedElig] = useState<ExamEligibility | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // Questions Import/Export states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'csv' | 'json' | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Omit<Question, 'id' | 'createdAt'>[]>([]);
  const [importError, setImportError] = useState('');

  // Sync initial system config & lists
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const qs = await DB.getQuestions();
      const elgs = await DB.getExamEligibility();
      const studs = await DB.getStudents();
      const conf = await DB.getConfig();

      setQuestions(qs);
      setEligibilityList(elgs);
      setStudents(studs);
      setExamActivated(conf.examActivated);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // --- QUESTION BANK COMPUTED LISTS ---
  const filteredQuestions = useMemo(() => {
    const term = qSearch.toLowerCase().trim();
    if (!term) return questions;
    return questions.filter(q => 
      q.text.toLowerCase().includes(term) ||
      (q.subject && q.subject.toLowerCase().includes(term))
    );
  }, [questions, qSearch]);

  // --- ELIGIBILITY MAPPING COMPUTED LISTS (Requirement C2) ---
  const mappedEligibility = useMemo(() => {
    // Map existing eligibility, fallback to default 'locked' (unmarked) if student has no row yet
    const elimap = new Map<string, ExamEligibility>();
    eligibilityList.forEach(e => elimap.set(e.email.toLowerCase(), e));

    const list = students.map(student => {
      const emailLower = student.email.toLowerCase();
      const existing = elimap.get(emailLower);

      return {
        student,
        eligibility: existing || {
          id: `fallback-${student.id}`,
          sessionId: 'default',
          email: student.email,
          status: 'locked' as const,
          reason: 'unmarked' as const,
          updatedAt: student.createdAt
        }
      };
    });

    // Apply Filters
    let filtered = list;
    if (eClassFilter !== 'All') {
      filtered = filtered.filter(item => item.student.class === eClassFilter);
    }
    if (eStatusFilter !== 'All') {
      filtered = filtered.filter(item => item.eligibility.status === eStatusFilter);
    }
    if (eSearch.trim()) {
      const term = eSearch.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.student.name.toLowerCase().includes(term) ||
        item.student.classSN.toLowerCase().includes(term) ||
        item.student.email.toLowerCase().includes(term)
      );
    }

    // Natural sort by student serial code
    return filtered.sort((a, b) => naturalSort(a.student.classSN, b.student.classSN));
  }, [students, eligibilityList, eClassFilter, eStatusFilter, eSearch]);


  // --- CBT ACTIVATION GATING COMMANDS ---
  const handleToggleExam = async () => {
    const nextState = !examActivated;
    const actionLabel = nextState ? "ACTIVATE GENERAL EXAM ACCESS" : "DEACTIVATE GENERAL EXAM ACCESS";

    protectionPasswordConfirm(actionLabel, async () => {
      try {
        await DB.updateConfig({ examActivated: nextState });
        setExamActivated(nextState);

        await triggerAuditLog(
          `${nextState ? 'Activated' : 'Suspended'} CBT Candidate Exam Entry overall gate`,
          'Exams Setup',
          { examActivated: !nextState },
          { examActivated: nextState },
          "Admin toggled general computer-based portal eligibility"
        );
      } catch (err) {
        alert("Config save failed: " + err);
      }
    });
  };

  // --- QUESTION ACTIONS (ADD / EDIT / DELETE) ---
  const openQModal = (q?: Question) => {
    setQError('');
    if (q) {
      setEditingQuestion(q);
      setQText(q.text);
      setQType(q.type);
      setQOptions(q.options || ['', '', '', '']);
      setQAnswer(q.answer);
      setQSubject(q.subject || '');
      setQDifficulty(q.difficulty || 'Easy');
    } else {
      setEditingQuestion(null);
      setQText('');
      setQType('mcq');
      setQOptions(['', '', '', '']);
      setQAnswer('A');
      setQSubject('');
      setQDifficulty('Easy');
    }
    setIsQModalOpen(true);
  };

  const handleUpdateOption = (index: number, val: string) => {
    const updated = [...qOptions];
    updated[index] = val;
    setQOptions(updated);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQError('');

    if (!qText.trim()) {
      setQError('Question prompt text cannot be blank.');
      return;
    }

    if (qType === 'mcq') {
      if (qOptions.some(o => !o.trim())) {
        setQError('All 4 option choices must be specified for MCQs.');
        return;
      }
    }

    const payload = {
      text: qText.trim(),
      type: qType,
      options: qType === 'mcq' ? qOptions.map(o => o.trim()) : undefined,
      answer: qType === 'truefalse' ? (qAnswer === 'True' || qAnswer === 'False' ? qAnswer : 'True') : qAnswer.trim(),
      subject: qSubject.trim() || 'General Programming',
      difficulty: qDifficulty
    };

    try {
      if (editingQuestion) {
        const result = await DB.updateQuestion(editingQuestion.id, payload);
        await triggerAuditLog(
          `Updated question ID: ${editingQuestion.id} (${payload.subject})`,
          'Exams Setup / Questions',
          editingQuestion,
          result,
          "Question payload adjusted in visual card modal"
        );
      } else {
        const result = await DB.addQuestion(payload);
        await triggerAuditLog(
          `Added new question to Bank: ${result.text.slice(0, 40)}...`,
          'Exams Setup / Questions',
          null,
          result,
          "Created new check question"
        );
      }
      setIsQModalOpen(false);
      loadInitialData();
    } catch (err) {
      setQError('Failed to save question: ' + err);
    }
  };

  const handleDeleteQuestion = (id: string, text: string) => {
    protectionPasswordConfirm("DELETE EXAM QUESTION", async () => {
      if (confirm(`Are you sure you want to permanently delete this exam question: "${text.slice(0, 30)}..."?`)) {
        await DB.deleteQuestion(id);
        await triggerAuditLog(
          `Deleted question ID: ${id}`,
          'Exams Setup / Questions',
          { text },
          null,
          "Purged from question list pool"
        );
        loadInitialData();
      }
    });
  };

  // --- ELIGIBILITY OVERRIDES CONTROL (C2) ---
  const handleOpenOverride = (eli: ExamEligibility) => {
    setSelectedElig(eli);
    setOverrideReason('');
    setIsOverrideModalOpen(true);
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElig) return;

    if (!overrideReason.trim()) {
      alert("Override justification reason is required for security audits.");
      return;
    }

    try {
      const newStatus = selectedElig.status === 'eligible' ? 'locked' : 'eligible';
      
      const updated = await DB.updateExamEligibility('default', selectedElig.email, {
        status: newStatus,
        reason: 'admin_override',
        overrideBy: adminEmail,
        overrideReason: overrideReason.trim()
      });

      await triggerAuditLog(
        `GCP OVERRIDE: ${selectedElig.email} gate updated to: ${newStatus.toUpperCase()}`,
        'Exam Eligibility Overrides',
        selectedElig,
        updated,
        overrideReason.trim()
      );

      setIsOverrideModalOpen(false);
      setSelectedElig(null);
      loadInitialData();
    } catch (err) {
      alert("Eligibility overwrite failed: " + err);
    }
  };


  // --- QUESTIONS IMPORT / EXPORT METHODS ---

  const handleExportCSV = () => {
    if (questions.length === 0) {
      alert("No questions to export.");
      return;
    }
    const headers = ["Text", "Type", "Option A", "Option B", "Option C", "Option D", "Answer", "Subject", "Difficulty"];
    const rows = questions.map(q => {
      const optA = q.options?.[0] || '';
      const optB = q.options?.[1] || '';
      const optC = q.options?.[2] || '';
      const optD = q.options?.[3] || '';
      return [
        q.text,
        q.type,
        optA,
        optB,
        optC,
        optD,
        q.answer,
        q.subject || '',
        q.difficulty || 'Easy'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`);
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `question_bank_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerAuditLog(
      `Exported ${questions.length} questions to CSV`,
      'Exams Setup / Questions',
      null,
      null,
      "Question bank CSV download"
    ).catch(console.error);
  };

  const handleExportJSON = () => {
    if (questions.length === 0) {
      alert("No questions to export.");
      return;
    }
    const cleanQuestions = questions.map(({ id, createdAt, ...rest }) => rest);
    const jsonString = JSON.stringify(cleanQuestions, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `question_bank_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerAuditLog(
      `Exported ${questions.length} questions to JSON`,
      'Exams Setup / Questions',
      null,
      null,
      "Question bank JSON download"
    ).catch(console.error);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const parseCSVQuestions = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error("CSV file must have header line and at least one data row.");
    }
    
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());
    
    const textIdx = headers.indexOf('text');
    const typeIdx = headers.indexOf('type');
    const optAIdx = headers.indexOf('option a');
    const optBIdx = headers.indexOf('option b');
    const optCIdx = headers.indexOf('option c');
    const optDIdx = headers.indexOf('option d');
    const answerIdx = headers.indexOf('answer');
    const subjectIdx = headers.indexOf('subject');
    const diffIdx = headers.indexOf('difficulty');

    if (textIdx === -1 || typeIdx === -1 || answerIdx === -1) {
      throw new Error("CSV must contain 'Text', 'Type', and 'Answer' columns.");
    }

    const questionsToImport: Omit<Question, 'id' | 'createdAt'>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const columns = parseCSVLine(lines[i]);
      if (columns.length < 3) continue;

      const textVal = columns[textIdx]?.trim();
      const typeVal = columns[typeIdx]?.trim().toLowerCase();
      const answerVal = columns[answerIdx]?.trim();

      if (!textVal || !typeVal || !answerVal) continue;
      if (!['mcq', 'truefalse', 'fill'].includes(typeVal)) continue;

      let options: string[] | undefined = undefined;
      if (typeVal === 'mcq') {
        options = [
          columns[optAIdx] || '',
          columns[optBIdx] || '',
          columns[optCIdx] || '',
          columns[optDIdx] || ''
        ].map(opt => opt.trim());
      }

      questionsToImport.push({
        text: textVal,
        type: typeVal as any,
        options,
        answer: answerVal,
        subject: columns[subjectIdx]?.trim() || 'General Programming',
        difficulty: (['Easy', 'Medium', 'Hard'].includes(columns[diffIdx]?.trim()) ? columns[diffIdx]?.trim() as any : 'Easy')
      });
    }

    if (questionsToImport.length === 0) {
      throw new Error("No valid exam questions parsed from CSV.");
    }

    return questionsToImport;
  };

  const parseJSONQuestions = (text: string) => {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error("File must contain a JSON array of questions.");
    }
    const questionsToImport: Omit<Question, 'id' | 'createdAt'>[] = [];
    for (const item of data) {
      if (!item.text || typeof item.text !== 'string') continue;
      if (!item.type || !['mcq', 'truefalse', 'fill'].includes(item.type)) continue;
      if (item.answer === null || item.answer === undefined || String(item.answer).trim() === '') continue;

      questionsToImport.push({
        text: item.text.trim(),
        type: item.type,
        options: item.options || (item.type === 'mcq' ? ['', '', '', ''] : undefined),
        answer: String(item.answer).trim(),
        subject: item.subject?.trim() || 'General Programming',
        difficulty: ['Easy', 'Medium', 'Hard'].includes(item.difficulty) ? item.difficulty : 'Easy'
      });
    }
    if (questionsToImport.length === 0) {
      throw new Error("No valid questions found in JSON file.");
    }
    return questionsToImport;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setParsedQuestions([]);
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      try {
        if (ext === 'json') {
          setImportType('json');
          const parsed = parseJSONQuestions(text);
          setParsedQuestions(parsed);
        } else if (ext === 'csv') {
          setImportType('csv');
          const parsed = parseCSVQuestions(text);
          setParsedQuestions(parsed);
        } else {
          throw new Error("Unsupported file extension. Please select a .csv or .json file.");
        }
      } catch (err: any) {
        setImportError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedQuestions.length === 0) return;
    try {
      for (const q of parsedQuestions) {
        await DB.addQuestion(q);
      }
      await triggerAuditLog(
        `Imported ${parsedQuestions.length} questions from ${importFileName}`,
        'Exams Setup / Questions',
        null,
        { count: parsedQuestions.length, filename: importFileName },
        `Questions bulk uploaded via ${importType?.toUpperCase()} file`
      );
      setIsImportModalOpen(false);
      setParsedQuestions([]);
      setImportFileName('');
      loadInitialData();
      alert(`Successfully imported ${parsedQuestions.length} questions to the bank.`);
    } catch (err: any) {
      alert("Failed executing import: " + err.message);
    }
  };


  // --- RENDER ---
  return (
    <div id="exams-module-root" className="space-y-6">
      
      {/* CBT ENTRY CONTROL HEADER CARD */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-lg select-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 grow pr-4">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-cyan-400" />
              <span className="text-[10px] uppercase font-mono font-black tracking-widest text-slate-400">Computer-Based Testing Gateways</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">CBT Active Examination & Roster Config</h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Turn the main CBT portal on or off. Locked students (those marked absent or unrecorded during attendance sessions) must be manually whitelisted/overridden here.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0 bg-slate-950/80 px-4.5 py-3 rounded-2xl border border-slate-800">
            <span className="text-xs font-mono font-bold leading-none text-slate-400">CBT GATE:</span>
            {examActivated ? (
              <button
                type="button"
                onClick={handleToggleExam}
                className="flex items-center space-x-2 text-green-400 font-extrabold text-xs tracking-tight transition-all cursor-pointer focus:outline-none"
              >
                <span>OPEN (ACTIVATED)</span>
                <ToggleRight className="w-8 h-8 text-green-500 fill-green-500/10" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleExam}
                className="flex items-center space-x-2 text-slate-400 font-bold text-xs tracking-tight transition-all cursor-pointer focus:outline-none"
              >
                <span>CLOSED (LOCKED)</span>
                <ToggleLeft className="w-8 h-8 text-slate-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CORE NAVIGATION TAB CONTROLS */}
      <div className="flex border-b border-slate-200 text-xs text-sans">
        <button
          onClick={() => setCurrentTab('questions')}
          className={`py-3 px-5 font-bold border-b-2 transition-all cursor-pointer ${
            currentTab === 'questions' 
              ? 'border-cyan-600 text-slate-900 bg-cyan-50/10 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Questions Pool ({questions.length})
        </button>
        <button
          onClick={() => setCurrentTab('eligibility')}
          className={`py-3 px-5 font-bold border-b-2 transition-all cursor-pointer ${
            currentTab === 'eligibility' 
              ? 'border-cyan-600 text-slate-900 bg-cyan-50/10 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Candidate CBT Eligibility & Overrides ({students.length})
        </button>
      </div>

      {/* VIEWPORT CONTROLS */}
      {currentTab === 'questions' ? (
        <div className="space-y-4 animate-fade-in">
          {/* SEARCH & REFRESH */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl select-none">
            <div className="relative grow max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search queries and subjects..."
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:bg-white text-xs text-slate-705 font-medium placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-250 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                title="Download questions as CSV"
              >
                <span>Export CSV</span>
              </button>
              
              <button
                type="button"
                onClick={handleExportJSON}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-250 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                title="Download questions as JSON"
              >
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportError('');
                  setParsedQuestions([]);
                  setImportFileName('');
                  setIsImportModalOpen(true);
                }}
                className="px-3.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 animate-pulse"
                title="Upload JSON/CSV to import questions"
              >
                <span>Import Q-Bank</span>
              </button>

              <button
                type="button"
                onClick={() => openQModal()}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Insert Question</span>
              </button>
            </div>
          </div>

          {/* QUESTIONS CARDS LIST */}
          {loading ? (
            <div className="py-20 text-center font-mono text-xs text-slate-400">
              Fetching database questions pool...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-slate-450 text-xs text-slate-400">
              No questions found. Click "Insert Question" to begin seeding the pool.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredQuestions.map((q, idx) => (
                <div key={q.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4.5 shadow-sm hover:shadow transition-all relative flex flex-col justify-between group select-none">
                  <div className="space-y-3.5 pr-8">
                    {/* Difficulty and Subject metrics */}
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-[5px] text-[9px] font-black tracking-tight font-mono bg-slate-100 text-slate-650 border border-slate-200 uppercase">{q.subject}</span>
                      <span className={`px-2 py-0.5 rounded-[5px] text-[9px] font-black tracking-tight font-mono border uppercase ${
                        q.difficulty === 'Easy' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : q.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-705 border-amber-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>{q.difficulty}</span>
                    </div>

                    {/* Question text */}
                    <h4 className="font-bold text-slate-900 text-xs leading-relaxed">
                      {idx + 1}. {q.text}
                    </h4>

                    {/* Options, if MCQ */}
                    {q.type === 'mcq' && q.options && (
                      <div className="space-y-1.5 grid grid-cols-2 gap-2">
                        {q.options.map((opt, i) => {
                          const optKey = ['A','B','C','D'][i];
                          const isCorrect = q.answer === optKey;
                          return (
                            <div key={i} className={`p-2 rounded-xl text-[11px] border font-sans select-none tracking-tight ${
                              isCorrect 
                                ? 'bg-green-50 border-green-200/60 text-green-800 font-extrabold shadow-sm' 
                                : 'bg-slate-50 border-slate-150 text-slate-500'
                            }`}>
                              <span className="font-mono font-black pr-1">{optKey}.</span> {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* True / False display */}
                    {q.type === 'truefalse' && (
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 bg-slate-50 text-[11px] font-semibold border rounded-lg ${q.answer === 'True' ? 'bg-green-50 border-green-200/50 text-green-700 font-black' : 'text-slate-400 border-slate-200'}`}>True</span>
                        <span className={`px-3 py-1 bg-slate-50 text-[11px] font-semibold border rounded-lg ${q.answer === 'False' ? 'bg-green-50 border-green-200/50 text-green-700 font-black' : 'text-slate-400 border-slate-200'}`}>False</span>
                      </div>
                    )}

                    {/* Fill Gap display */}
                    {q.type === 'fill' && (
                      <div className="p-2 bg-indigo-50/40 border border-indigo-100/50 text-indigo-850 font-mono text-[11px] rounded-xl">
                        Correct Input Phrase: <span className="font-black text-slate-900">{q.answer}</span>
                      </div>
                    )}
                  </div>

                  {/* Operation buttons overlaying on hover */}
                  <div className="absolute right-3.5 top-3 flex items-center space-x-1.5">
                    <button
                      onClick={() => openQModal(q)}
                      className="p-1 text-slate-450 hover:text-slate-700 hover:bg-slate-100 rounded transition-all cursor-pointer"
                      title="Edit Question"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id, q.text)}
                      className="p-1 text-slate-400 hover:text-rose-550 hover:bg-rose-50 rounded transition-all cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: CBT ELIGIBILITY GATE PANEL (Requirement C2) */
        <div className="space-y-4 animate-fade-in select-none">
          {/* SEARCH & STREAM FILTERS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3.5 border border-slate-200 rounded-2xl text-xs">
            {/* Search email or code */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidates by serial or name..."
                value={eSearch}
                onChange={(e) => setESearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-slate-705 placeholder:text-slate-400"
              />
            </div>

            {/* Class stream */}
            <select
              value={eClassFilter}
              onChange={(e) => setEClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-xl focus:outline-none focus:bg-white text-slate-700 cursor-pointer font-semibold"
            >
              <option value="All">All Class Streams</option>
              <option value="Class A">Class A Only</option>
              <option value="Class B">Class B Only</option>
            </select>

            {/* Gate Status */}
            <select
              value={eStatusFilter}
              onChange={(e) => setEStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-xl focus:outline-none focus:bg-white text-slate-700 cursor-pointer font-semibold"
            >
              <option value="All">All Portal States</option>
              <option value="eligible">Eligible (Unlocked)</option>
              <option value="locked">Locked (Blocked)</option>
            </select>
          </div>

          {/* ELIGIBILITY OVERRIDES TABLE */}
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] tracking-wider font-mono font-bold uppercase">
                <tr>
                  <th className="p-3.5">Serial</th>
                  <th className="p-3.5">Candidate Email</th>
                  <th className="p-3.5 opacity-80">Stream</th>
                  <th className="p-3.5">Portal Lock Status</th>
                  <th className="p-3.5">Evaluation Source</th>
                  <th className="p-3.5">Override Reason Logs</th>
                  <th className="p-3.5 text-right pr-6 w-36">Toggle Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400 font-mono">
                      Querying candidate access states...
                    </td>
                  </tr>
                ) : mappedEligibility.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400">
                      No matching student configurations found.
                    </td>
                  </tr>
                ) : (
                  mappedEligibility.map(({ student, eligibility }) => {
                    const isEligible = eligibility.status === 'eligible';
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-mono font-black text-slate-900">{student.classSN}</td>
                        <td className="p-3.5">
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{student.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{student.email}</p>
                          </div>
                        </td>
                        <td className="p-3.5">{student.class}</td>
                        <td className="p-3.5">
                          {isEligible ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-green-50 border border-green-200 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              <span>ELIGIBLE TO START</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 border border-rose-150 text-rose-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              <span>PORTAL LOCKED</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[10px] font-bold">
                          {eligibility.reason === 'present' && <span className="text-green-600">Present (Round 1)</span>}
                          {eligibility.reason === 'late' && <span className="text-amber-600">Late Arrived (Round 2)</span>}
                          {eligibility.reason === 'absent' && <span className="text-rose-600">Absent</span>}
                          {eligibility.reason === 'unmarked' && <span className="text-slate-400">Unmarked</span>}
                          {eligibility.reason === 'admin_override' && (
                            <span className="inline-flex items-center space-x-1 text-cyan-700 bg-cyan-50 border border-cyan-150 px-2 py-0.5 rounded text-[9px] font-mono">
                              <Key className="w-2.5 h-2.5 text-cyan-600" />
                              <span>Admin whitelisted</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 italic text-[11px] text-slate-500 max-w-[200px] truncate" title={eligibility.overrideReason}>
                          {eligibility.overrideReason || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-3.5 text-right pr-6">
                          <button
                            onClick={() => handleOpenOverride(eligibility)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm border transition-colors cursor-pointer ${
                              isEligible
                                ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700'
                                : 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700'
                            }`}
                          >
                            {isEligible ? 'Lock Gate' : 'Whitelist'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUESTION POPUP MODAL */}
      {isQModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-45 animate-fade-in select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-zoom-in">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between font-sans text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <HelpCircle className="w-5 h-5 text-cyan-600" />
                <span>{editingQuestion ? 'Modify Exam Question' : 'Add New Exam Question'}</span>
              </h3>
              <button onClick={() => setIsQModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Container */}
            <form onSubmit={handleSaveQuestion} className="p-5 overflow-y-auto space-y-4 text-xs">
              {qError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-750 font-mono rounded-lg">
                  {qError}
                </div>
              )}

              {/* Subject Category Tag */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Topic / Domain Subject</label>
                  <input
                    type="text"
                    value={qSubject}
                    onChange={(e) => setQSubject(e.target.value)}
                    placeholder="e.g. Python Functions"
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:bg-white focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Test Difficulty</label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value as any)}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:bg-white focus:outline-none cursor-pointer text-slate-700"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Query Type Toggle */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase font-sans">Choice Input Type</label>
                <div className="grid grid-cols-3 bg-slate-100 p-1 border rounded-xl">
                  {(['mcq', 'truefalse', 'fill'] as QuestionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setQType(t);
                        setQAnswer(t === 'mcq' ? 'A' : t === 'truefalse' ? 'True' : '');
                      }}
                      className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-tight cursor-pointer ${
                        qType === t ? 'bg-white text-slate-900 shadow' : 'text-slate-500 font-medium'
                      }`}
                    >
                      {t === 'mcq' ? '4-Option MCQ' : t === 'truefalse' ? 'True/False' : 'Fill Gap'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Question Prompt / Stem Text</label>
                <textarea
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="e.g. What is the syntax for creating an import directive in Javascript?"
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:bg-white focus:outline-none h-20 resize-none"
                  required
                />
              </div>

              {/* MCQ Options Choices */}
              {qType === 'mcq' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Specify Options & Correct Choice</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {['A','B','C','D'].map((key, i) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-slate-500">Option {key}</span>
                          <input
                            type="radio"
                            name="correctAnswerOptionChoice animate"
                            checked={qAnswer === key}
                            onChange={() => setQAnswer(key)}
                            className="text-cyan-600 cursor-pointer accent-cyan-600"
                          />
                        </div>
                        <input
                          type="text"
                          value={qOptions[i] || ''}
                          onChange={(e) => handleUpdateOption(i, e.target.value)}
                          placeholder={`Text choice ${key}`}
                          className="w-full bg-slate-50 p-2 rounded-lg border focus:bg-white focus:outline-none text-[11px]"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* True False correct option pick */}
              {qType === 'truefalse' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Expected True or False setting</label>
                  <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        checked={qAnswer === 'True'}
                        onChange={() => setQAnswer('True')}
                        className="accent-cyan-600 cursor-pointer"
                      />
                      <span className="font-semibold text-xs">True is correct</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        checked={qAnswer === 'False'}
                        onChange={() => setQAnswer('False')}
                        className="accent-cyan-600 cursor-pointer"
                      />
                      <span className="font-semibold text-xs">False is correct</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Fill gap text correct payload */}
              {qType === 'fill' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">Correct Text String Answer (Case-Insensitive)</label>
                  <input
                    type="text"
                    value={qAnswer}
                    onChange={(e) => setQAnswer(e.target.value)}
                    placeholder="e.g. useMemo"
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:bg-white focus:outline-none font-mono text-cyan-600 font-bold"
                    required
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-705 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm flex items-center space-x-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                  <span>Commit Question</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ELIGIBILITY OVERRIDE LOGGING MODAL (C2) */}
      {isOverrideModalOpen && selectedElig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-45 animate-fade-in select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full animate-zoom-in">
            <div className="bg-slate-50 border-b border-slate-150 px-5 py-3.5 flex items-center justify-between font-sans text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-550" />
                <span>Override Candidate Entrance Gate</span>
              </h3>
              <button onClick={() => { setIsOverrideModalOpen(false); setSelectedElig(null); }} className="text-slate-450 hover:text-slate-650 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyOverride} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Target Candidate Profile</p>
                <p className="font-bold text-slate-900 leading-tight">
                  {(students.find(s => s.email.toLowerCase() === selectedElig.email.toLowerCase())?.name) || 'Loading Candidate'}
                </p>
                <p className="font-mono text-[10px] text-slate-405">{selectedElig.email}</p>
                <p className="font-mono mt-1">
                  CURRENT ENTRANCE: {selectedElig.status === 'eligible' 
                    ? <span className="text-green-600 font-extrabold font-sans">ELIGIBLE (OPEN)</span> 
                    : <span className="text-rose-600 font-bold font-sans">LOCKED (BLOCKED)</span>
                  }
                </p>
              </div>

              {/* Justification Reason entry */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-slate-500 uppercase">
                  Write Audit Log Override Reason (Required)
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Student whitelisted due to pre-excused sick leave with doctor note verification."
                  className="w-full bg-slate-50 border border-slate-250 p-2.5 rounded-xl h-20 resize-none font-sans focus:outline-none focus:bg-white"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsOverrideModalOpen(false); setSelectedElig(null); }}
                  className="px-4 py-2 border rounded-lg text-slate-655 font-semibold bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg text-white font-extrabold shadow-sm cursor-pointer ${
                    selectedElig.status === 'eligible' ? 'bg-rose-605 hover:bg-rose-700' : 'bg-green-605 hover:bg-green-700'
                  }`}
                >
                  {selectedElig.status === 'eligible' ? 'Confirm Lock' : 'Confirm Whitelist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXAM QUESTIONS IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-45 animate-fade-in select-none">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full animate-zoom-in flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 border-b border-slate-150 px-5 py-4.5 flex items-center justify-between font-sans text-xs">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Bulk Questions Roster Import</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Acceptable formats: standard JSON array or CSV spreadsheet</p>
              </div>
              <button 
                onClick={() => { setIsImportModalOpen(false); setParsedQuestions([]); setImportFileName(''); }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs grow">
              {/* File input selector */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-cyan-500 hover:bg-cyan-50/5 transition-all relative">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="w-9 h-9 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Click or Drag JSON or CSV Question file here</p>
                <p className="text-[10px] text-slate-400 mt-1">Files should have headers: Text, Type, Option A, Option B, Option C, Option D, Answer, Subject, Difficulty</p>
              </div>

              {/* Error messages */}
              {importError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-750 p-3.5 rounded-xl font-sans leading-relaxed">
                  <p className="font-bold">❌ Parse failed:</p>
                  <p className="font-mono text-[10px] mt-1 break-words">{importError}</p>
                </div>
              )}

              {/* Preview parsed files parsed list summary */}
              {parsedQuestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800">Preview: parsed {parsedQuestions.length} valid questions</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-md font-bold uppercase">{importType} Loaded</span>
                  </div>

                  <div className="border rounded-2xl divide-y max-h-52 overflow-y-auto bg-slate-50">
                    {parsedQuestions.slice(0, 10).map((pq, pidx) => (
                      <div key={pidx} className="p-3 space-y-1 bg-white">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">{pq.subject}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 uppercase">{pq.type}</span>
                        </div>
                        <p className="font-bold text-slate-805 text-[11px] leading-tight">{pidx + 1}. {pq.text}</p>
                        <p className="text-[10px] text-emerald-700 font-semibold font-mono">Correct Answer: {pq.answer}</p>
                      </div>
                    ))}
                    {parsedQuestions.length > 10 && (
                      <div className="p-2.5 text-center text-[10px] text-slate-450 italic font-medium">
                        ... and {parsedQuestions.length - 10} more questions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-150 p-4.5 flex items-center justify-end space-x-2 rounded-b-3xl">
              <button
                type="button"
                onClick={() => { setIsImportModalOpen(false); setParsedQuestions([]); setImportFileName(''); }}
                className="px-4 py-2 border rounded-lg text-slate-600 font-semibold bg-white hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={parsedQuestions.length === 0}
                className="px-4.5 py-2 rounded-lg text-white font-extrabold shadow-sm bg-cyan-600 hover:bg-cyan-700 cursor-pointer disabled:bg-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Execute Bulk Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
