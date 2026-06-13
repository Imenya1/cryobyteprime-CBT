-- SUPABASE SCHEMA DEFINITION FOR STUDENT ATTENDANCE & CBT PORTAL
-- Copy and paste this script into your Supabase SQL Editor (Dashboard > SQL Editor > New query) to set up or heal database tables.

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. CONFIG TABLE (Single-row Configuration)
-- ==========================================
CREATE TABLE IF NOT EXISTS config (
    id text PRIMARY KEY DEFAULT 'config_main',
    "examActivated" boolean NOT NULL DEFAULT false,
    "protectionPassword" text NOT NULL DEFAULT 'admin',
    "superadminPassword" text NOT NULL DEFAULT 'super'
);

-- Schema healing helper: Ensure all config columns exist in case the table existed previously
ALTER TABLE config ADD COLUMN IF NOT EXISTS "examActivated" boolean NOT NULL DEFAULT false;
ALTER TABLE config ADD COLUMN IF NOT EXISTS "protectionPassword" text NOT NULL DEFAULT 'admin';
ALTER TABLE config ADD COLUMN IF NOT EXISTS "superadminPassword" text NOT NULL DEFAULT 'super';

-- Insert initial configuration values if not exists
INSERT INTO config (id, "examActivated", "protectionPassword", "superadminPassword")
VALUES ('config_main', false, 'admin', 'super')
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- 2. ADMIN PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_profiles (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('Superadmin', 'Admin', 'Tutor')),
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);


-- ==========================================
-- 3. STUDENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS students (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    gender text,
    class text NOT NULL CHECK (class IN ('Class A', 'Class B')),
    "classSN" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    "updatedAt" timestamp with time zone
);

-- Schema healing helper: Ensure the `gender` column exists on the `students` table if it was missed previously
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS "updatedAt" timestamp with time zone;


-- ==========================================
-- 4. ATTENDANCE SESSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS att_sessions (
    id text PRIMARY KEY,
    class text NOT NULL CHECK (class IN ('Class A', 'Class B', 'Joint')),
    date text NOT NULL, -- YYYY-MM-DD
    topic text NOT NULL,
    notes text,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    "round1Serials" text[] NOT NULL DEFAULT '{}',
    "round2Serials" text[] NOT NULL DEFAULT '{}',
    "createdBy" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);


-- ==========================================
-- 5. ATTENDANCE RECORDS
-- ==========================================
CREATE TABLE IF NOT EXISTS att_records (
    id text PRIMARY KEY,
    "sessionId" text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    class text NOT NULL,
    "classSN" text NOT NULL,
    date text NOT NULL,
    status text NOT NULL CHECK (status IN ('present', 'late', 'absent')),
    round text CHECK (round IN ('1', '2', NULL)),
    timestamp timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Prevent duplicate attendance for the same student in the same session
    UNIQUE ("sessionId", email)
);


-- ==========================================
-- 6. ATTENDANCE EDIT REQUESTS
-- ==========================================
CREATE TABLE IF NOT EXISTS att_edit_requests (
    id text PRIMARY KEY,
    "sessionId" text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    "classSN" text NOT NULL,
    "requestedStatus" text NOT NULL CHECK ("requestedStatus" IN ('present', 'late')),
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    "resolvedAt" timestamp with time zone,
    "resolvedBy" text
);


-- ==========================================
-- 7. EXAM ELIGIBILITY
-- ==========================================
CREATE TABLE IF NOT EXISTS exam_eligibility (
    id text PRIMARY KEY DEFAULT 'elig_' || translate(lower(encode(sha256(random()::text::bytea), 'hex')), '0123456789abcdef', 'abcdefghijklmnop'),
    "sessionId" text NOT NULL,
    email text NOT NULL,
    status text NOT NULL CHECK (status IN ('eligible', 'locked')),
    reason text NOT NULL CHECK (reason IN ('present', 'late', 'absent', 'unmarked', 'admin_override')),
    "overrideBy" text,
    "overrideReason" text,
    "updatedAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Ensures compound upserts on conflict are handled robustly
    UNIQUE ("sessionId", email)
);


-- ==========================================
-- 8. QUESTIONS BANK
-- ==========================================
CREATE TABLE IF NOT EXISTS questions (
    id text PRIMARY KEY,
    text text NOT NULL,
    type text NOT NULL CHECK (type IN ('mcq', 'truefalse', 'fill')),
    options text[] DEFAULT '{}', -- array of options for MCQ
    answer text NOT NULL,
    subject text,
    difficulty text CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);


-- ==========================================
-- 9. EXAM RESULTS
-- ==========================================
CREATE TABLE IF NOT EXISTS results (
    id text PRIMARY KEY,
    email text NOT NULL,
    name text NOT NULL,
    class text NOT NULL CHECK (class IN ('Class A', 'Class B')),
    "classSN" text NOT NULL,
    "examSessionId" text NOT NULL,
    score integer NOT NULL,
    percentage numeric NOT NULL,
    "totalQuestions" integer NOT NULL,
    answers jsonb NOT NULL,
    "submittedAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    "attemptId" text NOT NULL,
    UNIQUE (email, "examSessionId")
);


-- ==========================================
-- 10. DELETION REQUESTS
-- ==========================================
CREATE TABLE IF NOT EXISTS deletion_requests (
    id text PRIMARY KEY,
    "requestedBy" text NOT NULL,
    role text NOT NULL CHECK (role IN ('Superadmin', 'Admin', 'Tutor')),
    page text NOT NULL,
    scope text NOT NULL,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    "resolvedBy" text,
    "resolvedAt" timestamp with time zone,
    "resolutionReason" text
);


-- ==========================================
-- 11. AUDIT LOG
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_log (
    id text PRIMARY KEY,
    "userName" text NOT NULL,
    "userRole" text NOT NULL CHECK ("userRole" IN ('Superadmin', 'Admin', 'Tutor')),
    timestamp timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    action text NOT NULL,
    "originalValue" text,
    "newValue" text,
    reason text NOT NULL,
    page text NOT NULL
);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) HOOK (RECOMMENDED)
-- ==========================================
-- In Supabase, by default you can allow select/insert/update/delete 
-- operations for rapid proto-typical development, or write a global policy.
-- E.g. to enable full public anonymous access for a quick checkin portal:
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE att_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE att_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE att_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Creating wild Access Policies for each table:
CREATE POLICY "Allow public select" ON config FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON config FOR UPDATE USING (true);

CREATE POLICY "Allow public select" ON admin_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON admin_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON admin_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON admin_profiles FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON students FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON students FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON students FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON att_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON att_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON att_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON att_sessions FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON att_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON att_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON att_records FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON att_records FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON att_edit_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON att_edit_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON att_edit_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON att_edit_requests FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON exam_eligibility FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON exam_eligibility FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON exam_eligibility FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON exam_eligibility FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON questions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON questions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON questions FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON results FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON results FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON results FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON deletion_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON deletion_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON deletion_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON deletion_requests FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON audit_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON audit_log FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON audit_log FOR DELETE USING (true);
