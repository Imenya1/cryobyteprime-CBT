-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Config Table (Single-row Configuration)
CREATE TABLE IF NOT EXISTS config (
    id text PRIMARY KEY DEFAULT 'config_main',
    "examActivated" boolean NOT NULL DEFAULT false,
    "protectionPassword" text NOT NULL DEFAULT 'admin',
    "superadminPassword" text NOT NULL DEFAULT 'super'
);

INSERT INTO config (id, "examActivated", "protectionPassword", "superadminPassword")
VALUES ('config_main', false, 'admin', 'super')
ON CONFLICT (id) DO NOTHING;

-- Admin Profiles
CREATE TABLE IF NOT EXISTS admin_profiles (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('Superadmin', 'Admin', 'Tutor')),
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Students Table
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

-- Attendance Sessions
CREATE TABLE IF NOT EXISTS att_sessions (
    id text PRIMARY KEY,
    class text NOT NULL CHECK (class IN ('Class A', 'Class B', 'Joint')),
    date text NOT NULL,
    topic text NOT NULL,
    notes text,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    "round1Serials" text[] NOT NULL DEFAULT '{}',
    "round2Serials" text[] NOT NULL DEFAULT '{}',
    "createdBy" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Attendance Records
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
    UNIQUE ("sessionId", email)
);

-- Attendance Edit Requests
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

-- Exam Eligibility
CREATE TABLE IF NOT EXISTS exam_eligibility (
    id text PRIMARY KEY DEFAULT 'elig_' || translate(lower(encode(sha256(random()::text::bytea), 'hex')), '0123456789abcdef', 'abcdefghijklmnop'),
    "sessionId" text NOT NULL,
    email text NOT NULL,
    status text NOT NULL CHECK (status IN ('eligible', 'locked')),
    reason text NOT NULL CHECK (reason IN ('present', 'late', 'absent', 'unmarked', 'admin_override')),
    "overrideBy" text,
    "overrideReason" text,
    "updatedAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE ("sessionId", email)
);

-- Questions Bank
CREATE TABLE IF NOT EXISTS questions (
    id text PRIMARY KEY,
    text text NOT NULL,
    type text NOT NULL CHECK (type IN ('mcq', 'truefalse', 'fill')),
    options text[] DEFAULT '{}',
    answer text NOT NULL,
    subject text,
    difficulty text CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    "createdAt" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Exam Results
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

-- Deletion Requests
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

-- Audit Log
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