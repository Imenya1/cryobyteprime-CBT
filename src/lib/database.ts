import { createClient } from '@supabase/supabase-js';
import { 
  Student, 
  AttSession, 
  AttRecord, 
  AttEditRequest, 
  ExamEligibility, 
  Question, 
  Result, 
  DeletionRequest, 
  AuditLog, 
  AdminProfile, 
  SystemConfig 
} from '../types';

// Load Supabase constants if configured
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Helper to execute Supabase mutations with self-healing support in case columns don't exist in Supabase schema cache
async function runWithSelfHealing<PL>(
  initialPayload: PL,
  actionFn: (currentPayload: PL) => Promise<{ data?: any; error: any }>
): Promise<{ data?: any; error: any }> {
  let payload = JSON.parse(JSON.stringify(initialPayload));
  
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await actionFn(payload);
      if (!res.error) {
        return res;
      }
      
      const errMsg = res.error.message || "";
      // Match error patterns like:
      // "Could not find the 'gender' column of 'students' in the schema cache"
      // "column \"gender\" of relation \"students\" does not exist"
      const match = errMsg.match(/Could not find the '([^']+)' column/i) || 
                    errMsg.match(/column "([^"]+)" of/i) || 
                    errMsg.match(/column "([^"]+)" does not exist/i);
      
      if (match && match[1]) {
        const missingColumn = match[1];
        console.warn(`[Self-Healing] stripping unmapped column "${missingColumn}" from Supabase payload.`);
        
        if (Array.isArray(payload)) {
          payload = payload.map(item => {
            if (item && typeof item === 'object') {
              const clone = { ...item };
              delete clone[missingColumn];
              return clone;
            }
            return item;
          });
        } else if (payload && typeof payload === 'object') {
          delete (payload as any)[missingColumn];
        } else {
          return res; // Can't heal non-object
        }
        
        // Retry with modified payload
        continue;
      }
      
      return res; // Return other types of errors
    } catch (err: any) {
      return { error: err };
    }
  }
  
  return { error: new Error("Too many self-healing retries failed.") };
}

// ==========================================
// Deterministic Nigerian Seed Generator
// ==========================================
const FIRST_NAMES = ["Chukwuemeka", "Adaeze", "Tunde", "Olumide", "Ngozi", "Femi", "Yemi", "Amarachi", "Chioma", "Kelechi", "Oluwaseun", "Damilola", "Temitope", "Fatima", "Aisha", "Zainab", "Chinedu", "Chidi", "Obinna", "Nkechi", "Efe", "Uche", "Bimbo", "Emeka"];
const LAST_NAMES = ["Okonkwo", "Balogun", "Onyekwerre", "Ugwu", "Nwachukwu", "Alabi", "Bello", "Adeniyi", "Adewale", "Eze", "Okafor", "Okoye", "Adebayo", "Soyinka", "Shonibare", "Suleiman", "Danjuma", "Obasanjo", "Chineye"];

function generateSeedStudents(): Student[] {
  const list: Student[] = [];
  
  // Deterministic random selection
  let nameCount = 0;
  
  // Class A: 44 students (A1 - A44)
  for (let i = 1; i <= 44; i++) {
    const fn = FIRST_NAMES[(i * 3 + 7) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 7 + 13) % LAST_NAMES.length];
    const name = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@cryobyteprime.com`;
    const phone = `080${String(1234567 + i * 29).slice(-7)}`;
    const gender = (i % 3 === 0) ? 'Female' : 'Male';
    
    list.push({
      id: `student-a-${i}`,
      name,
      email,
      phone,
      gender,
      class: 'Class A',
      classSN: `A${i}`,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Class B: 43 students (B1 - B43)
  for (let i = 1; i <= 43; i++) {
    const fn = FIRST_NAMES[(i * 4 + 11) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 5 + 17) % LAST_NAMES.length];
    const name = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@cryobyteprime.com`;
    const phone = `090${String(1284567 + i * 47).slice(-7)}`;
    const gender = (i % 2 === 0) ? 'Female' : 'Male';
    
    list.push({
      id: `student-b-${i}`,
      name,
      email,
      phone,
      gender,
      class: 'Class B',
      classSN: `B${i}`,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  return list;
}

// Generate deterministic demo Questions
function generateSeedQuestions(): Question[] {
  return [
    {
      id: "q-1",
      text: "Which of the following data structures operates on a Last-In, First-Out (LIFO) basis?",
      type: "mcq",
      options: ["Queue", "Stack", "Binary Tree", "Linked List"],
      answer: "B",
      subject: "Data Structures",
      difficulty: "Easy",
      createdAt: new Date().toISOString()
    },
    {
      id: "q-2",
      text: "True or False: In a relational database, a primary key allows NULL values to maintain flexibility.",
      type: "truefalse",
      answer: "False",
      subject: "Databases",
      difficulty: "Easy",
      createdAt: new Date().toISOString()
    },
    {
      id: "q-3",
      text: "What is the time complexity of searching for an element in a balanced Binary Search Tree (BST) of size N?",
      type: "mcq",
      options: ["O(1)", "O(N)", "O(log N)", "O(N log N)"],
      answer: "C",
      subject: "Algorithms",
      difficulty: "Medium",
      createdAt: new Date().toISOString()
    },
    {
      id: "q-4",
      text: "In React, which hook is used to perform side effects in functional components?",
      type: "fill",
      answer: "useEffect",
      subject: "Frontend Development",
      difficulty: "Easy",
      createdAt: new Date().toISOString()
    },
    {
      id: "q-5",
      text: "True or False: HTTP stands for Hypertext Transfer Protocol and is stateful by default.",
      type: "truefalse",
      answer: "False",
      subject: "Web Networking",
      difficulty: "Medium",
      createdAt: new Date().toISOString()
    },
    {
      id: "q-6",
      text: "Complete the statement: SQL represents Structured _____ Language.",
      type: "fill",
      answer: "Query",
      subject: "Databases",
      difficulty: "Easy",
      createdAt: new Date().toISOString()
    }
  ];
}

// ==========================================
// Local Storage Base Driver
// ==========================================
const STORAGE_KEYS = {
  STUDENTS: 'cbt_students',
  SESSIONS: 'cbt_att_sessions',
  RECORDS: 'cbt_att_records',
  EDIT_REQS: 'cbt_att_edit_requests',
  ELIGIBILITY: 'cbt_exam_eligibility',
  QUESTIONS: 'cbt_questions',
  RESULTS: 'cbt_results',
  DELETION_REQS: 'cbt_deletion_requests',
  AUDIT_LOG: 'cbt_audit_log',
  ADMIN_PROFILES: 'cbt_admin_profiles',
  CONFIG: 'cbt_config'
};

function getLocalItem<T>(key: string, defaultValue: T): T {
  const item = localStorage.getItem(key);
  if (!item) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Ensure local persistence is seeded
if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
  setLocalItem(STORAGE_KEYS.STUDENTS, generateSeedStudents());
}
if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
  setLocalItem(STORAGE_KEYS.QUESTIONS, generateSeedQuestions());
}
if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
  setLocalItem(STORAGE_KEYS.CONFIG, {
    examActivated: false,
    protectionPassword: "admin",
    superadminPassword: "super"
  });
}
if (!localStorage.getItem(STORAGE_KEYS.ADMIN_PROFILES)) {
  setLocalItem(STORAGE_KEYS.ADMIN_PROFILES, [
    { id: "sa-1", email: "super@cbt.com", name: "Super User", role: "Superadmin", createdAt: new Date().toISOString() },
    { id: "a-1", email: "admin@cbt.com", name: "Lead Admin (Seed)", role: "Admin", createdAt: new Date().toISOString() },
    { id: "t-1", email: "tutor@cbt.com", name: "Class Tutor", role: "Tutor", createdAt: new Date().toISOString() }
  ]);
}

// ==========================================
// Unified Core DB API
// ==========================================
export const DB = {
  // Students
  async getStudents(): Promise<Student[]> {
    if (supabase) {
      const { data, error } = await supabase.from('students').select('*').order('createdAt', { ascending: true });
      if (!error && data) return data;
    }
    return getLocalItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
  },

  async addStudent(student: Omit<Student, 'id' | 'createdAt'>): Promise<Student> {
    const newStudent: Student = {
      ...student,
      id: 'student_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (supabase) {
      const { data, error } = await runWithSelfHealing(newStudent, async (payload) => {
        return await supabase.from('students').insert(payload).select().single();
      });
      if (!error && data) return data;
    }
    const current = getLocalItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
    current.push(newStudent);
    setLocalItem(STORAGE_KEYS.STUDENTS, current);
    return newStudent;
  },

  async updateStudent(id: string, patch: Partial<Student>): Promise<Student> {
    if (supabase) {
      const { data, error } = await runWithSelfHealing(patch, async (payload) => {
        return await supabase.from('students').update(payload).eq('id', id).select().single();
      });
      if (!error && data) return data;
    }
    const current = getLocalItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
    const idx = current.findIndex(s => s.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch, updatedAt: new Date().toISOString() };
      setLocalItem(STORAGE_KEYS.STUDENTS, current);
      return current[idx];
    }
    throw new Error('Student not found');
  },

  async deleteStudent(id: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (!error) return true;
    }
    const current = getLocalItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
    const filtered = current.filter(s => s.id !== id);
    setLocalItem(STORAGE_KEYS.STUDENTS, filtered);
    return true;
  },

  async setStudents(arr: Student[]): Promise<void> {
    if (supabase) {
      try {
        const { error: deleteError } = await supabase.from('students').delete().gte('id', '');
        if (deleteError) {
          console.error("Supabase students delete error:", deleteError);
          throw deleteError;
        }
        if (arr.length > 0) {
          const { error: insertError } = await runWithSelfHealing(arr, async (payload) => {
            return await supabase.from('students').insert(payload);
          });
          if (insertError) {
            console.error("Supabase students insert error:", insertError);
            throw insertError;
          }
        }
      } catch (err: any) {
        console.error("Failed to sync students to Supabase:", err);
        throw new Error(err?.message || "Failed to sync students list to Supabase. Check your connection or constraints.");
      }
    }
    setLocalItem(STORAGE_KEYS.STUDENTS, arr);
  },

  // Attendance Sessions
  async getAttSessions(): Promise<AttSession[]> {
    if (supabase) {
      const { data, error } = await supabase.from('att_sessions').select('*').order('date', { ascending: false });
      if (!error && data) return data;
    }
    return getLocalItem<AttSession[]>(STORAGE_KEYS.SESSIONS, []);
  },

  async addAttSession(session: Omit<AttSession, 'id' | 'createdAt'>): Promise<AttSession> {
    const newSession: AttSession = {
      ...session,
      id: 'session_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (supabase) {
      const { data, error } = await supabase.from('att_sessions').insert(newSession).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttSession[]>(STORAGE_KEYS.SESSIONS, []);
    current.push(newSession);
    setLocalItem(STORAGE_KEYS.SESSIONS, current);
    return newSession;
  },

  async updateAttSession(id: string, patch: Partial<AttSession>): Promise<AttSession> {
    if (supabase) {
      const { data, error } = await supabase.from('att_sessions').update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttSession[]>(STORAGE_KEYS.SESSIONS, []);
    const idx = current.findIndex(s => s.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch };
      setLocalItem(STORAGE_KEYS.SESSIONS, current);
      return current[idx];
    }
    throw new Error('Session not found');
  },

  async deleteAttSession(id: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('att_sessions').delete().eq('id', id);
      if (!error) return true;
    }
    const current = getLocalItem<AttSession[]>(STORAGE_KEYS.SESSIONS, []);
    const filtered = current.filter(s => s.id !== id);
    setLocalItem(STORAGE_KEYS.SESSIONS, filtered);
    return true;
  },

  async getOpenAttSession(): Promise<AttSession | null> {
    const list = await this.getAttSessions();
    return list.find(s => s.status === 'open') || null;
  },

  async getOpenAttSessions(): Promise<AttSession[]> {
    const list = await this.getAttSessions();
    return list.filter(s => s.status === 'open');
  },

  // Attendance Records
  async getAttRecords(): Promise<AttRecord[]> {
    if (supabase) {
      const { data, error } = await supabase.from('att_records').select('*');
      if (!error && data) return data;
    }
    return getLocalItem<AttRecord[]>(STORAGE_KEYS.RECORDS, []);
  },

  async addAttRecord(record: Omit<AttRecord, 'id'>): Promise<AttRecord> {
    const newRecord: AttRecord = {
      ...record,
      id: 'record_' + Math.random().toString(36).substr(2, 9)
    };
    if (supabase) {
      const { data, error } = await supabase.from('att_records').insert(newRecord).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttRecord[]>(STORAGE_KEYS.RECORDS, []);
    // Prevent duplicate sessionId + email
    const filtered = current.filter(r => !(r.sessionId === record.sessionId && r.email === record.email));
    filtered.push(newRecord);
    setLocalItem(STORAGE_KEYS.RECORDS, filtered);
    return newRecord;
  },

  async addAttRecords(records: Omit<AttRecord, 'id'>[]): Promise<AttRecord[]> {
    const newRecords = records.map(r => ({
      ...r,
      id: 'record_' + Math.random().toString(36).substr(2, 9)
    }));
    if (supabase) {
      const { data, error } = await supabase.from('att_records').insert(newRecords).select();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttRecord[]>(STORAGE_KEYS.RECORDS, []);
    // Prevent duplicates
    const emailsToInsert = new Set(records.map(r => r.email));
    const sessionIdsToInsert = new Set(records.map(r => r.sessionId));
    const filtered = current.filter(r => !(sessionIdsToInsert.has(r.sessionId) && emailsToInsert.has(r.email)));
    const merged = [...filtered, ...newRecords];
    setLocalItem(STORAGE_KEYS.RECORDS, merged);
    return newRecords;
  },

  async getRecordsBySession(sessionId: string): Promise<AttRecord[]> {
    const list = await this.getAttRecords();
    return list.filter(r => r.sessionId === sessionId);
  },

  async getRecordsByStudent(email: string): Promise<AttRecord[]> {
    const list = await this.getAttRecords();
    return list.filter(r => r.email.toLowerCase() === email.toLowerCase());
  },

  async updateAttRecord(id: string, patch: Partial<AttRecord>): Promise<AttRecord> {
    if (supabase) {
      const { data, error } = await supabase.from('att_records').update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttRecord[]>(STORAGE_KEYS.RECORDS, []);
    const idx = current.findIndex(r => r.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch };
      setLocalItem(STORAGE_KEYS.RECORDS, current);
      return current[idx];
    }
    throw new Error('Record not found');
  },

  async deleteRecordsBySession(sessionId: string): Promise<boolean> {
    if (supabase) {
      await supabase.from('att_records').delete().eq('sessionId', sessionId);
      return true;
    }
    const current = getLocalItem<AttRecord[]>(STORAGE_KEYS.RECORDS, []);
    const filtered = current.filter(r => r.sessionId !== sessionId);
    setLocalItem(STORAGE_KEYS.RECORDS, filtered);
    return true;
  },

  // Attendance Edit Requests
  async getAttEditReqs(): Promise<AttEditRequest[]> {
    if (supabase) {
      const { data, error } = await supabase.from('att_edit_requests').select('*').order('createdAt', { ascending: false });
      if (!error && data) return data;
    }
    return getLocalItem<AttEditRequest[]>(STORAGE_KEYS.EDIT_REQS, []);
  },

  async addAttEditReq(req: Omit<AttEditRequest, 'id' | 'createdAt'>): Promise<AttEditRequest> {
    const newReq: AttEditRequest = {
      ...req,
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (supabase) {
      const { data, error } = await supabase.from('att_edit_requests').insert(newReq).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttEditRequest[]>(STORAGE_KEYS.EDIT_REQS, []);
    current.push(newReq);
    setLocalItem(STORAGE_KEYS.EDIT_REQS, current);
    return newReq;
  },

  async updateAttEditReq(id: string, patch: Partial<AttEditRequest>): Promise<AttEditRequest> {
    if (supabase) {
      const { data, error } = await supabase.from('att_edit_requests').update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AttEditRequest[]>(STORAGE_KEYS.EDIT_REQS, []);
    const idx = current.findIndex(r => r.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch };
      setLocalItem(STORAGE_KEYS.EDIT_REQS, current);
      return current[idx];
    }
    throw new Error('Req not found');
  },

  async getPendingEditReqs(): Promise<AttEditRequest[]> {
    const list = await this.getAttEditReqs();
    return list.filter(r => r.status === 'pending');
  },

  // Exam Eligibility
  async getExamEligibility(): Promise<ExamEligibility[]> {
    if (supabase) {
      const { data, error } = await supabase.from('exam_eligibility').select('*');
      if (!error && data) return data;
    }
    return getLocalItem<ExamEligibility[]>(STORAGE_KEYS.ELIGIBILITY, []);
  },

  async updateExamEligibility(sessionId: string, email: string, patch: Partial<ExamEligibility>): Promise<ExamEligibility> {
    if (supabase) {
      const { data, error } = await supabase.from('exam_eligibility')
        .upsert({ sessionId, email, ...patch, updatedAt: new Date().toISOString() }, { onConflict: 'sessionId,email' })
        .select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<ExamEligibility[]>(STORAGE_KEYS.ELIGIBILITY, []);
    const idx = current.findIndex(e => e.sessionId === sessionId && e.email.toLowerCase() === email.toLowerCase());
    
    if (idx !== -1) {
      current[idx] = { 
        ...current[idx], 
        ...patch, 
        updatedAt: new Date().toISOString() 
      };
      setLocalItem(STORAGE_KEYS.ELIGIBILITY, current);
      return current[idx];
    } else {
      const newElig: ExamEligibility = {
        id: 'elig_' + Math.random().toString(36).substr(2, 9),
        sessionId,
        email,
        status: patch.status || 'locked',
        reason: (patch.reason as any) || 'unmarked',
        overrideBy: patch.overrideBy,
        overrideReason: patch.overrideReason,
        updatedAt: new Date().toISOString()
      };
      current.push(newElig);
      setLocalItem(STORAGE_KEYS.ELIGIBILITY, current);
      return newElig;
    }
  },

  async updateExamEligibilityBulk(sessionId: string, entries: { email: string; status: 'eligible' | 'locked'; reason: 'present' | 'late' | 'absent' | 'unmarked' | 'admin_override' }[]): Promise<boolean> {
    if (supabase) {
      const payload = entries.map(e => ({
        sessionId,
        email: e.email,
        status: e.status,
        reason: e.reason,
        updatedAt: new Date().toISOString()
      }));
      const { error } = await supabase.from('exam_eligibility').upsert(payload, { onConflict: 'sessionId,email' });
      if (error) {
        console.error("Bulk Exam Eligibility upsert error:", error);
        throw error;
      }
      return true;
    }

    const current = getLocalItem<ExamEligibility[]>(STORAGE_KEYS.ELIGIBILITY, []);
    const entryMap = new Map(entries.map(e => [e.email.toLowerCase(), e]));

    const updatedEmails = new Set<string>();
    const nextList = current.map(item => {
      if (item.sessionId === sessionId) {
        const match = entryMap.get(item.email.toLowerCase());
        if (match) {
          updatedEmails.add(item.email.toLowerCase());
          return {
            ...item,
            status: match.status,
            reason: match.reason,
            updatedAt: new Date().toISOString()
          };
        }
      }
      return item;
    });

    for (const entry of entries) {
      if (!updatedEmails.has(entry.email.toLowerCase())) {
        nextList.push({
          id: 'elig_' + Math.random().toString(36).substr(2, 9),
          sessionId,
          email: entry.email,
          status: entry.status,
          reason: entry.reason,
          updatedAt: new Date().toISOString()
        });
      }
    }

    setLocalItem(STORAGE_KEYS.ELIGIBILITY, nextList);
    return true;
  },

  async deleteExamEligibilityBySession(sessionId: string): Promise<boolean> {
    if (supabase) {
      await supabase.from('exam_eligibility').delete().eq('sessionId', sessionId);
      return true;
    }
    const current = getLocalItem<ExamEligibility[]>(STORAGE_KEYS.ELIGIBILITY, []);
    const filtered = current.filter(e => e.sessionId !== sessionId);
    setLocalItem(STORAGE_KEYS.ELIGIBILITY, filtered);
    return true;
  },

  // Questions Bank
  async getQuestions(): Promise<Question[]> {
    if (supabase) {
      const { data, error } = await supabase.from('questions').select('*').order('createdAt', { ascending: true });
      if (!error && data) return data;
    }
    return getLocalItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
  },

  async addQuestion(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    const newQ: Question = {
      ...question,
      id: 'q_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (supabase) {
      const { data, error } = await supabase.from('questions').insert(newQ).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    current.push(newQ);
    setLocalItem(STORAGE_KEYS.QUESTIONS, current);
    return newQ;
  },

  async updateQuestion(id: string, patch: Partial<Question>): Promise<Question> {
    if (supabase) {
      const { data, error } = await supabase.from('questions').update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    const idx = current.findIndex(q => q.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch };
      setLocalItem(STORAGE_KEYS.QUESTIONS, current);
      return current[idx];
    }
    throw new Error('Question not found');
  },

  async deleteQuestion(id: string): Promise<boolean> {
    if (supabase) {
      await supabase.from('questions').delete().eq('id', id);
      return true;
    }
    const current = getLocalItem<Question[]>(STORAGE_KEYS.QUESTIONS, []);
    const filtered = current.filter(q => q.id !== id);
    setLocalItem(STORAGE_KEYS.QUESTIONS, filtered);
    return true;
  },

  async setQuestions(arr: Question[]): Promise<void> {
    if (supabase) {
      await supabase.from('questions').delete().gte('id', '');
      await supabase.from('questions').insert(arr);
    }
    setLocalItem(STORAGE_KEYS.QUESTIONS, arr);
  },

  // Exam Results
  async getResults(): Promise<Result[]> {
    if (supabase) {
      const { data, error } = await supabase.from('results').select('*').order('submittedAt', { ascending: false });
      if (!error && data) return data;
    }
    return getLocalItem<Result[]>(STORAGE_KEYS.RESULTS, []);
  },

  async addResult(result: Omit<Result, 'id'>): Promise<Result> {
    const newRes: Result = {
      ...result,
      id: 'res_' + Math.random().toString(36).substr(2, 9)
    };
    if (supabase) {
      const { data, error } = await supabase.from('results').upsert(newRes).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<Result[]>(STORAGE_KEYS.RESULTS, []);
    // Upsert on email + examSessionId
    const filtered = current.filter(r => !(r.email.toLowerCase() === result.email.toLowerCase() && r.examSessionId === result.examSessionId));
    filtered.push(newRes);
    setLocalItem(STORAGE_KEYS.RESULTS, filtered);
    return newRes;
  },

  async deleteResultsBySession(sessionId: string): Promise<boolean> {
    if (supabase) {
      await supabase.from('results').delete().eq('examSessionId', sessionId);
      return true;
    }
    const current = getLocalItem<Result[]>(STORAGE_KEYS.RESULTS, []);
    const filtered = current.filter(r => r.examSessionId !== sessionId);
    setLocalItem(STORAGE_KEYS.RESULTS, filtered);
    return true;
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    if (supabase) {
      const { data, error } = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false });
      if (!error && data) return data;
    }
    return getLocalItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOG, []);
  },

  async addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const newLog: AuditLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    };
    if (supabase) {
      await supabase.from('audit_log').insert(newLog);
    }
    const current = getLocalItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOG, []);
    
    // Duplicate debounce within a short window (e.g. 2 seconds)
    const recent = current[current.length - 1];
    if (recent && 
        recent.userName === log.userName && 
        recent.action === log.action && 
        recent.page === log.page && 
        (new Date().getTime() - new Date(recent.timestamp).getTime()) < 2000) {
      return recent; // skip logging duplicate click flood
    }
    
    current.push(newLog);
    setLocalItem(STORAGE_KEYS.AUDIT_LOG, current);
    return newLog;
  },

  // Deletion Requests
  async getDeletionRequests(): Promise<DeletionRequest[]> {
    if (supabase) {
      const { data, error } = await supabase.from('deletion_requests').select('*').order('createdAt', { ascending: false });
      if (!error && data) return data;
    }
    return getLocalItem<DeletionRequest[]>(STORAGE_KEYS.DELETION_REQS, []);
  },

  async addDeletionRequest(req: Omit<DeletionRequest, 'id' | 'createdAt' | 'status'>): Promise<DeletionRequest> {
    const newReq: DeletionRequest = {
      ...req,
      id: 'del_' + Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    if (supabase) {
      const { data, error } = await supabase.from('deletion_requests').insert(newReq).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<DeletionRequest[]>(STORAGE_KEYS.DELETION_REQS, []);
    current.push(newReq);
    setLocalItem(STORAGE_KEYS.DELETION_REQS, current);
    return newReq;
  },

  async updateDeletionRequest(id: string, patch: Partial<DeletionRequest>): Promise<DeletionRequest> {
    if (supabase) {
      const { data, error } = await supabase.from('deletion_requests').update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<DeletionRequest[]>(STORAGE_KEYS.DELETION_REQS, []);
    const idx = current.findIndex(d => d.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch };
      setLocalItem(STORAGE_KEYS.DELETION_REQS, current);
      return current[idx];
    }
    throw new Error('Deletion request not found');
  },

  // System Config
  async getConfig(): Promise<SystemConfig> {
    if (supabase) {
      const { data, error } = await supabase.from('config').select('*').limit(1).single();
      if (!error && data) return data;
    }
    return getLocalItem<SystemConfig>(STORAGE_KEYS.CONFIG, {
      examActivated: false,
      protectionPassword: 'admin',
      superadminPassword: 'super'
    });
  },

  async updateConfig(patch: Partial<SystemConfig>): Promise<SystemConfig> {
    if (supabase) {
      const { data, error } = await supabase.from('config').update(patch).gte('id', '').select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<SystemConfig>(STORAGE_KEYS.CONFIG, {
      examActivated: false,
      protectionPassword: 'admin',
      superadminPassword: 'super'
    });
    const updated = { ...current, ...patch };
    setLocalItem(STORAGE_KEYS.CONFIG, updated);
    return updated;
  },

  // Admin Profiles
  async getAdminProfiles(): Promise<AdminProfile[]> {
    if (supabase) {
      const { data, error } = await supabase.from('admin_profiles').select('*');
      if (!error && data) return data;
    }
    return getLocalItem<AdminProfile[]>(STORAGE_KEYS.ADMIN_PROFILES, []);
  },

  async addAdminProfile(profile: Omit<AdminProfile, 'id' | 'createdAt'>): Promise<AdminProfile> {
    const newProfile: AdminProfile = {
      ...profile,
      id: 'profile_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (supabase) {
      const { data, error } = await supabase.from('admin_profiles').insert(newProfile).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AdminProfile[]>(STORAGE_KEYS.ADMIN_PROFILES, []);
    current.push(newProfile);
    setLocalItem(STORAGE_KEYS.ADMIN_PROFILES, current);
    return newProfile;
  },

  async updateAdminProfile(id: string, patch: Partial<AdminProfile>): Promise<AdminProfile> {
    if (supabase) {
      const { data, error } = await supabase.from('admin_profiles').update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    }
    const current = getLocalItem<AdminProfile[]>(STORAGE_KEYS.ADMIN_PROFILES, []);
    const idx = current.findIndex(p => p.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...patch };
      setLocalItem(STORAGE_KEYS.ADMIN_PROFILES, current);
      return current[idx];
    }
    throw new Error('Profile not found');
  },

  async deleteAdminProfile(id: string): Promise<boolean> {
    if (supabase) {
      await supabase.from('admin_profiles').delete().eq('id', id);
      return true;
    }
    const current = getLocalItem<AdminProfile[]>(STORAGE_KEYS.ADMIN_PROFILES, []);
    const filtered = current.filter(p => p.id !== id);
    setLocalItem(STORAGE_KEYS.ADMIN_PROFILES, filtered);
    return true;
  }
};
