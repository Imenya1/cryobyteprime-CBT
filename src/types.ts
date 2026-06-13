export interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: 'Male' | 'Female' | '';
  class: 'Class A' | 'Class B';
  classSN: string;      // e.g. 'A12', 'B5'
  createdAt: string;
  updatedAt?: string;
}

export interface AttSession {
  id: string;
  class: 'Class A' | 'Class B' | 'Joint';
  date: string; // YYYY-MM-DD
  topic: string;
  notes?: string;
  status: 'open' | 'closed';
  round1Serials: string[];
  round2Serials: string[];
  createdBy: string;
  createdAt: string;
}

export interface AttRecord {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  class: string;
  classSN: string;
  date: string;
  status: 'present' | 'late' | 'absent';
  round: '1' | '2' | null;
  timestamp: string;
}

export interface AttEditRequest {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  classSN: string;
  requestedStatus: 'present' | 'late';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ExamEligibility {
  id: string;
  sessionId: string; // references AttSession or general session
  email: string;
  status: 'eligible' | 'locked';
  reason: 'present' | 'late' | 'absent' | 'unmarked' | 'admin_override';
  overrideBy?: string; // admin email
  overrideReason?: string;
  updatedAt: string;
}

export type QuestionType = 'mcq' | 'truefalse' | 'fill';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // exactly 4 for MCQ, empty/absent for fill, typically empty for truefalse
  answer: string;    // correct option key (e.g. 'A', 'B', 'C', 'D' or true/false text, or exact text for fill)
  subject?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  createdAt: string;
}

export interface Result {
  id: string;
  email: string;
  name: string;
  class: 'Class A' | 'Class B';
  classSN: string;
  examSessionId: string; // session ID the exam is linked to
  score: number; // raw correct answers
  percentage: number; // 0 to 100
  totalQuestions: number;
  answers: Record<string, string>; // Maps questionId -> student response
  submittedAt: string;
  attemptId: string; // UUID for idempotent submissions
}

export interface DeletionRequest {
  id: string;
  requestedBy: string;
  role: 'Superadmin' | 'Admin' | 'Tutor';
  page: string;
  scope: string; // e.g. "student:A12", "students:all", "session:UUID"
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
}

export interface AuditLog {
  id: string;
  userName: string;
  userRole: 'Superadmin' | 'Admin' | 'Tutor';
  timestamp: string;
  action: string;
  originalValue?: string; // JSON string
  newValue?: string;      // JSON string
  reason: string;         // required
  page: string;
}

export type AdminRole = 'Superadmin' | 'Admin' | 'Tutor';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: string;
}

export interface SystemConfig {
  examActivated: boolean;
  protectionPassword?: string;
  superadminPassword?: string;
}

export type AttendanceStanding = 'good' | 'risk' | 'poor';

export function getStanding(pct: number): AttendanceStanding {
  if (pct >= 75) return 'good';
  if (pct >= 50) return 'risk';
  return 'poor';
}
