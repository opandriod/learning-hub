-- Run this in Supabase SQL Editor before using Admin Upload.
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS course_id INT,
ADD COLUMN IF NOT EXISTS unit_id INT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS uploaded_by INT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);
CREATE INDEX IF NOT EXISTS idx_notes_unit_id ON notes(unit_id);
CREATE INDEX IF NOT EXISTS idx_notes_file_type ON notes(file_type);
