import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Award, Key, AlertTriangle, Play, HelpCircle, CheckCircle2, ChevronLeft, ChevronRight,
  ShieldCheck, Hourglass, BarChart3, AlertCircle, Sparkles, BookOpen, Clock, FileCheck, Circle
} from 'lucide-react';
import { DB } from '../lib/database';
import { Student, Question, Result, ExamEligibility } from '../types';

export default function StudentCBT() {
  // --- STATE ---
  const [stage, setStage] = useState<'login' | 'unauthorized' | 'quiz' | 'scorecard'>('login');

  // Input credentials
  const [email, setEmail] = useState('');
  const [serialCode, setSerialCode] = useState('');
  const [loginError, setLoginError] = useState('');

  // Loaded profiles
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [configActive, setConfigActive] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [eligibility, setEligibility] = useState<ExamEligibility | null>(null);

  // Quiz Engine
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQIndex, setActiveQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // maps question.id -> selected option or check text

  // Countdown clock: 15 minutes by default (900 seconds)
  const [timeLeft, setTimeLeft] = useState(900); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Result scorecard
  const [generatedResult, setGeneratedResult] = useState<Result | null>(null);

  // Clean timer cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- ACTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedSerial = serialCode.trim().toUpperCase();

    if (!trimmedEmail || !trimmedSerial) {
      setLoginError('Both registered Email and Serial ID code are required.');
      return;
    }

    try {
      // 1. Verify general student credentials
      const allStudents = await DB.getStudents();
      const student = allStudents.find(s => 
        s.email.toLowerCase() === trimmedEmail && 
        s.classSN.toUpperCase() === trimmedSerial
      );

      if (!student) {
        setLoginError('Invalid credentials. Ensure your registration email matches your serial number.');
        return;
      }

      // 2. Fetch general portal gate configuration
      const config = await DB.getConfig();

      // 3. Fetch candidate eligibility gate record
      const eligibilityList = await DB.getExamEligibility();
      const currentElig = eligibilityList.find(elg => elg.email.toLowerCase() === trimmedEmail);

      // 4. Fetch any active open attendance sessions to check real-time checkins
      const openSessions = await DB.getOpenAttSessions();
      const isMarkedInOpenSession = openSessions.some(sess => {
        const r1 = sess.round1Serials || [];
        const r2 = sess.round2Serials || [];
        return r1.map(s => s.toUpperCase()).includes(trimmedSerial) ||
               r2.map(s => s.toUpperCase()).includes(trimmedSerial);
      });

      setCurrentStudent(student);
      setEligibility(currentElig || null);

      // Verify portal eligibility bounds (Requirement C2) - unlocked if whitelisted OR marked in open session
      const eligible = (currentElig && currentElig.status === 'eligible') || isMarkedInOpenSession;
      setIsWhitelisted(!!eligible);
      setConfigActive(config.examActivated);

      // Navigation routing
      if (!config.examActivated || !eligible) {
        setStage('unauthorized');
      } else {
        // Enrolled correctly! Feed questions bank
        const questionsPool = await DB.getQuestions();
        if (questionsPool.length === 0) {
          setLoginError('There are currently no active questions in the Examination database pool.');
          return;
        }
        
        setQuestions(questionsPool);
        setAnswers({}); 
        setActiveQIndex(0);
        setTimeLeft(720); // 12 minutes (720 seconds) for dynamic assessment
        setStage('quiz');

        // Start counting down
        startCountdown();
      }

    } catch (err) {
      setLoginError('Error validating entrance: ' + err);
    }
  };

  // COUNTDOWN IMPLEMENTATION
  const startCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Automatically submit exam on timer expiry
          triggerAutoSubmission();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formattedTimeLeft = useMemo(() => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [timeLeft]);

  // Handle option select
  const handleSelectAnswer = (qId: string, answerVal: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: answerVal
    }));
  };

  // Auto/Manual Submission Engine
  const triggerAutoSubmission = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!currentStudent) return;

    let score = 0;
    questions.forEach(q => {
      const candidateAnswer = (answers[q.id] || '').trim().toUpperCase();
      const correctAnswer = q.answer.trim().toUpperCase();
      if (candidateAnswer === correctAnswer) {
        score++;
      }
    });

    const percentage = Math.round((score / questions.length) * 100);

    const payload: Omit<Result, 'id'> = {
      email: currentStudent.email,
      name: currentStudent.name,
      class: currentStudent.class,
      classSN: currentStudent.classSN,
      examSessionId: eligibility?.sessionId || 'active-session',
      score,
      percentage,
      totalQuestions: questions.length,
      answers,
      submittedAt: new Date().toISOString(),
      attemptId: `alt-${Date.now()}`
    };

    try {
      const committed = await DB.addResult(payload);
      setGeneratedResult(committed);
      setStage('scorecard');
    } catch (e) {
      alert("Submission error: " + e);
    }
  };

  const handleManualSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    const message = `Are you absolutely sure you want to turn in your examination sheet? You have answered ${answeredCount} out of ${questions.length} questions. This cannot be undone.`;
    
    if (confirm(message)) {
      triggerAutoSubmission();
    }
  };

  const handleReturnToPortal = () => {
    // Purge states
    setEmail('');
    setSerialCode('');
    setCurrentStudent(null);
    setAnswers({});
    setGeneratedResult(null);
    setStage('login');
  };

  const isQuestionAnswered = (qId: string) => {
    return !!answers[qId];
  };

  // --- RENDERING ---
  return (
    <div id="student-cbt-root" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-755 selection:bg-cyan-50 selection:text-cyan-700 select-none">
      
      {/* PERSISTENT CORE HEADER */}
      <header className="bg-white border-b sticky top-0 z-40 select-none">
        <div id="student-header-inner" className="max-w-6xl mx-auto px-5 py-4.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center font-bold text-cyan-600 shadow-sm border border-cyan-150">
              <Award className="w-5.5 h-5.5" />
            </div>
            <div className="text-left">
              <h1 className="text-sm font-black tracking-tight text-slate-900 leading-none">CryoBytePrime</h1>
              <p className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mt-0.5">Computer-Based Testing Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] uppercase font-mono font-black text-slate-500 tracking-wider">CBT SECURE TERMINAL</span>
          </div>
        </div>
      </header>

      {/* VIEW STAGE CONTROLLER */}
      {stage === 'login' && (
        <main className="grow flex items-center justify-center p-5 select-none h-auto">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl p-6.5 max-w-sm w-full text-xs space-y-5 text-center animate-zoom-in">
            <div className="space-y-1.5">
              <HelpCircle className="w-10 h-10 text-cyan-600 mx-auto shrink-0 animate-bounce" />
              <h2 className="text-base font-extrabold text-slate-900">Sign In to Student Examination</h2>
              <p className="text-[11px] text-slate-450 leading-relaxed font-normal">Enter your designated course credentials to check-in your CBT candidate registry.</p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-left font-sans leading-relaxed">
                <p className="font-semibold">{loginError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black font-mono text-slate-500 uppercase">Registration Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. adaeze.eze.12@cryobyteprime.com"
                  className="w-full bg-slate-50 border border-slate-251 p-2.5 rounded-xl focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black font-mono text-slate-550 uppercase">Student Serial ID</label>
                <input
                  type="text"
                  value={serialCode}
                  onChange={(e) => setSerialCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A22"
                  className="w-full bg-slate-50 border border-slate-251 p-2.5 rounded-xl font-mono text-xs font-extrabold focus:bg-white focus:outline-none focus:border-cyan-500 uppercase"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-colors"
              >
                Enter Examination Portal
              </button>
            </form>
          </div>
        </main>
      )}

      {stage === 'unauthorized' && (
        <main className="grow flex items-center justify-center p-5 select-none">
          <div className="bg-white border rounded-3xl p-8 max-w-md w-full shadow-xl text-center space-y-6 animate-zoom-in text-xs">
            <div className="space-y-2">
              <div className="w-14 h-14 bg-rose-50 border border-rose-150 rounded-2xl flex items-center justify-center text-rose-600 mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Portal Entry Locked</h2>
              <p className="text-slate-500 leading-relaxed leading-relaxed font-normal">
                Credentials verified, but you are currently blocked from entering the live exam. Check the reasons below:
              </p>
            </div>

            <div className="bg-slate-50 border p-4.5 rounded-2xl text-left space-y-2 font-sans text-[11px] leading-relaxed text-slate-650">
              {!configActive && (
                <div className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0"></span>
                  <p>
                    <strong className="text-slate-800">Exam overall gate inactive:</strong> The class tutor has not activated general exam access. Please wait for coordinates to be activated.
                  </p>
                </div>
              )}
              {!isWhitelisted && (
                <div className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                  <p>
                    <strong className="text-slate-800 font-bold">Portal locked automatically:</strong> You have been logged as <span className="text-rose-600 font-bold">ABSENT</span> or your attendance was unregistered for the linked roster check-in blocks. Standard exam gates dictate that you must be present inside class to earn CBT access keys!
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 border border-indigo-100 bg-indigo-50/40 text-indigo-850 rounded-2xl flex items-start space-x-2 text-[10.5px] text-left leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-indigo-550 mt-0.5" />
              <span>Contact the lesson coordinators or class superadmin to apply a whitelist override if pre-excused.</span>
            </div>

            <button
              onClick={handleReturnToPortal}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl transition-all cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </main>
      )}

      {stage === 'quiz' && currentStudent && questions.length > 0 && (
        <main className="grow max-w-6xl w-full mx-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5 select-none min-h-0 h-auto">
          
          {/* LEFT PANEL: QUESTION GRID BUBBLES BAR */}
          <div className="md:col-span-3 bg-white border rounded-2xl p-4 flex flex-col justify-between shadow-sm min-h-0">
            <div className="space-y-4 text-xs font-sans">
              <div className="flex items-center space-x-2 pb-2 border-b">
                <BookOpen className="w-5 h-5 text-cyan-600" />
                <span className="font-bold text-slate-800">Evaluation Navigator</span>
              </div>

              <p className="text-slate-400 text-[10.5px] font-medium leading-relaxed">Toggle cards below to jump to specific check prompts:</p>
              
              {/* Grid Bubbles */}
              <div className="grid grid-cols-4 gap-2.5 max-h-[40vh] overflow-y-auto p-0.5 select-none">
                {questions.map((q, idx) => {
                  const isAnswered = isQuestionAnswered(q.id);
                  const isActive = idx === activeQIndex;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setActiveQIndex(idx)}
                      className={`h-9 rounded-xl border font-mono font-bold text-xs flex items-center justify-center relative cursor-pointer font-black transition-all ${
                        isActive 
                          ? 'bg-cyan-600 border-cyan-700 text-white shadow shadow-cyan-600/10' 
                          : isAnswered 
                          ? 'bg-cyan-50 border-cyan-150 text-cyan-700 font-extrabold' 
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isAnswered && !isActive && (
                        <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-cyan-500"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Completion Stats */}
            <div className="pt-4 border-t space-y-4 text-xs select-none">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-500">Progress Tracker</span>
                  <span className="font-mono text-slate-900 font-bold">{Math.round((Object.keys(answers).length / questions.length) * 100)}% Done</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border">
                  <div 
                    className="bg-cyan-600 h-full rounded-full transition-all duration-300" 
                    style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-2.5 border rounded-xl bg-slate-50 flex items-center justify-between text-[10px] font-mono leading-none">
                <span className="text-slate-400">CLASS SERIAL:</span>
                <strong className="text-slate-800 font-black">{currentStudent.classSN}</strong>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: EXAMINATION TIMED QUESTIONS VIEWPORT */}
          <div className="md:col-span-9 bg-white border rounded-2xl p-6.5 shadow-sm flex flex-col justify-between space-y-6 relative select-none">
            
            {/* Header: Countdown clock and candidate info */}
            <div className="flex items-center justify-between pb-3.5 border-b text-xs">
              <div>
                <p className="font-bold text-slate-900 font-sans text-sm">{currentStudent.name}</p>
                <p className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">{currentStudent.email}</p>
              </div>

              {/* Ticking timer showing red glow if under 3 mins (180 secs) */}
              <div className={`flex items-center space-x-2.5 px-4.5 py-2.5 rounded-2xl border font-mono font-bold font-black text-sm tracking-tight shrink-0 transition-colors ${
                timeLeft < 180 
                  ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse' 
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}>
                <Clock className="w-4.5 h-4.5 stroke-[2.5]" />
                <span className="text-xs leading-none">TIME SECURE:</span>
                <span className="text-base tracking-widest">{formattedTimeLeft}</span>
              </div>
            </div>

            {/* Main prompt body */}
            <div className="space-y-6 grow py-6.5">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-slate-100 border text-slate-650 text-[10px] font-black font-mono tracking-tight rounded-md uppercase">
                    QUESTION {activeQIndex + 1} OF {questions.length}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-705 text-[10px] font-black font-mono tracking-tight rounded-md uppercase">
                    {questions[activeQIndex].subject || 'General'}
                  </span>
                </div>

                <p className="font-extrabold text-slate-900 text-sm md:text-base leading-relaxed h-auto">
                  {questions[activeQIndex].text}
                </p>
              </div>

              {/* SELECT ANSWER BOX */}
              <div className="pt-4">
                {/* MCQ SELECT AREA */}
                {questions[activeQIndex].type === 'mcq' && questions[activeQIndex].options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 font-sans">
                    {questions[activeQIndex].options.map((opt, i) => {
                       const key = ['A', 'B', 'C', 'D'][i];
                       const isSelected = answers[questions[activeQIndex].id] === key;
                       return (
                         <button
                           key={i}
                           type="button"
                           onClick={() => handleSelectAnswer(questions[activeQIndex].id, key)}
                           className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all text-xs font-sans select-none cursor-pointer hover:bg-slate-55/70 ${
                             isSelected 
                               ? 'bg-cyan-50/70 border-cyan-500/30 text-cyan-950 font-extrabold shadow-sm' 
                               : 'bg-white border-slate-200 text-slate-600'
                           }`}
                         >
                           <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center font-mono font-black border text-[10px] ${
                             isSelected ? 'bg-cyan-600 text-white border-cyan-705' : 'bg-slate-100 border-slate-250 text-slate-500'
                           }`}>{key}</span>
                           <span className="shrink grow leading-normal font-semibold pr-2 mt-0.5 text-slate-900">{opt}</span>
                         </button>
                       );
                    })}
                  </div>
                )}

                {/* TRUE / FALSE SELECT AREA */}
                {questions[activeQIndex].type === 'truefalse' && (
                  <div className="grid grid-cols-2 gap-4 pb-3">
                    {['True', 'False'].map((key) => {
                      const isSelected = answers[questions[activeQIndex].id] === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleSelectAnswer(questions[activeQIndex].id, key)}
                          className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-cyan-50/60 border-cyan-500/30 text-cyan-900 font-black shadow-md scale-[1.01]' 
                              : 'bg-white border-slate-200 text-slate-500 font-semibold'
                          }`}
                        >
                          <span className="text-sm block">{key}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* FILL AREA */}
                {questions[activeQIndex].type === 'fill' && (
                  <div className="space-y-1.5 pb-3 font-sans">
                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Write your answers below:</label>
                    <input
                      type="text"
                      value={answers[questions[activeQIndex].id] || ''}
                      onChange={(e) => handleSelectAnswer(questions[activeQIndex].id, e.target.value)}
                      placeholder="e.g. key constraint"
                      className="w-full max-w-md bg-slate-50 border border-slate-250 p-3 rounded-xl font-semibold text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-cyan-500"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer navigational controls */}
            <div className="flex items-center justify-between border-t pt-4 select-none font-sans">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveQIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeQIndex === 0}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={activeQIndex === questions.length - 1}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>

              {/* Large Manual submit exam trigger */}
              <button
                type="button"
                onClick={handleManualSubmit}
                className="px-5.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 font-extrabold text-white shadow-md flex items-center space-x-1.5 cursor-pointer text-xs transition-colors"
              >
                <FileCheck className="w-4 h-4 text-white" />
                <span>Submit Exam</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {stage === 'scorecard' && generatedResult && currentStudent && (
        <main className="grow flex items-center justify-center p-5 select-none font-sans">
          <div className="bg-white border border-slate-200 text-center shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden flex flex-col md:max-h-[85vh] animate-zoom-in font-sans text-xs">
            {/* Ribbon congrat */}
            <div className="bg-cyan-600 text-white p-6 space-y-1.5 shrink-0">
              <Sparkles className="w-10 h-10 text-white mx-auto animate-pulse" />
              <h2 className="text-base font-black">Examination Answer Sheet Saved</h2>
              <p className="text-[11px] text-cyan-100 font-mono tracking-tight uppercase">SCORE SUBMITTED AT: {generatedResult.submittedAt.slice(11, 16)} UTC</p>
            </div>

            {/* Score body */}
            <div className="p-6.5 space-y-5 grow overflow-y-auto">
              <div className="space-y-1">
                <p className="text-[10px] font-bold font-mono text-slate-450 uppercase leading-none">CANDIDATE LOG NAME</p>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">{generatedResult.name}</h3>
                <p className="font-mono text-indigo-705 text-[10.5px]">{generatedResult.email}</p>
              </div>

              {/* Bullet circle metrics */}
              <div className="flex items-center justify-center space-x-4 pt-2.5 pb-2">
                <div className="text-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Correct</span>
                  <strong className="text-xl font-extrabold text-cyan-600 block mt-0.5">{generatedResult.score} / {generatedResult.totalQuestions}</strong>
                </div>
                <div className="h-8 border-r"></div>
                <div className="text-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Percentage</span>
                  <strong className="text-xl font-extrabold text-cyan-600 block mt-0.5">{generatedResult.percentage}%</strong>
                </div>
              </div>

              {/* Status block */}
              <div className={`p-3 rounded-2xl border ${
                generatedResult.percentage >= 75 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : generatedResult.percentage >= 50
                  ? 'bg-amber-50 border-amber-200 text-amber-705'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              } text-[11px] leading-relaxed font-semibold`}>
                {generatedResult.percentage >= 75 && "Outstanding achievement! You have demonstrated key fluency core concepts."}
                {generatedResult.percentage >= 50 && generatedResult.percentage < 75 && "Good trial, but require focus review sections."}
                {generatedResult.percentage < 50 && "Requires tutoring session setup. Please check materials with lessons tutors."}
              </div>

              {/* Review answers detail */}
              <div className="space-y-4 pt-1.5 border-t">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>Questions Check Answers</span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">SCORE OVERVIEW</span>
                </div>

                <div className="space-y-2 max-h-[22vh] overflow-y-auto text-left pr-1 select-none">
                  {questions.map((q, idx) => {
                    const candAns = answers[q.id] || '(Skipped)';
                    const isRight = candAns.toUpperCase().trim() === q.answer.toUpperCase().trim();
                    return (
                      <div key={q.id} className="p-2.5 border rounded-xl bg-slate-50/80 hover:bg-slate-50 text-[10.5px] leading-normal font-sans text-slate-600">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold text-slate-800 shrink truncate pr-1">Q{idx + 1}: {q.text.slice(0, 32)}...</p>
                          {isRight ? (
                            <span className="text-green-600 font-extrabold uppercase text-[9px] shrink-0 font-mono tracking-tight bg-green-50 border border-green-150 px-1 rounded">CORRECT</span>
                          ) : (
                            <span className="text-rose-600 font-bold uppercase text-[9px] shrink-0 font-mono tracking-tight bg-rose-50 border border-rose-150 px-1 rounded">WRONG</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-450 mt-1 font-mono leading-none">
                          <span>Your choice: <strong className={isRight ? "text-slate-700 font-semibold" : "text-rose-600 font-bold"}>{candAns}</strong></span>
                          <span>True option: <strong className="text-slate-705 font-bold">{q.answer}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t p-4 shrink-0 flex items-center justify-center">
              <button
                onClick={handleReturnToPortal}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Close Examination Portal
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
