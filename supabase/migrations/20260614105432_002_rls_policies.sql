-- Enable Row Level Security on all tables
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

-- Config policies
CREATE POLICY "Allow public select" ON config FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON config FOR UPDATE USING (true);

-- Admin profiles policies
CREATE POLICY "Allow public select" ON admin_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON admin_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON admin_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON admin_profiles FOR DELETE USING (true);

-- Students policies
CREATE POLICY "Allow public select" ON students FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON students FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON students FOR DELETE USING (true);

-- Attendance sessions policies
CREATE POLICY "Allow public select" ON att_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON att_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON att_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON att_sessions FOR DELETE USING (true);

-- Attendance records policies
CREATE POLICY "Allow public select" ON att_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON att_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON att_records FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON att_records FOR DELETE USING (true);

-- Attendance edit requests policies
CREATE POLICY "Allow public select" ON att_edit_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON att_edit_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON att_edit_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON att_edit_requests FOR DELETE USING (true);

-- Exam eligibility policies
CREATE POLICY "Allow public select" ON exam_eligibility FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON exam_eligibility FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON exam_eligibility FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON exam_eligibility FOR DELETE USING (true);

-- Questions policies
CREATE POLICY "Allow public select" ON questions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON questions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON questions FOR DELETE USING (true);

-- Results policies
CREATE POLICY "Allow public select" ON results FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON results FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON results FOR DELETE USING (true);

-- Deletion requests policies
CREATE POLICY "Allow public select" ON deletion_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON deletion_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON deletion_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON deletion_requests FOR DELETE USING (true);

-- Audit log policies
CREATE POLICY "Allow public select" ON audit_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON audit_log FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON audit_log FOR DELETE USING (true);