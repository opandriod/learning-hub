-- Academic Resources Migration
-- Run this in Supabase SQL Editor before using the new PDF upload pages.

create table if not exists public.study_materials (
  id bigserial primary key,
  semester_id int not null references public.semesters(id) on delete cascade,
  course_id int not null references public.courses(id) on delete cascade,
  unit_id int references public.units(id) on delete set null,
  title text not null,
  description text,
  file_name text not null,
  file_url text not null,
  storage_path text,
  uploaded_by int references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.old_question_papers (
  id bigserial primary key,
  semester_id int not null references public.semesters(id) on delete cascade,
  course_id int not null references public.courses(id) on delete cascade,
  title text not null,
  year int not null check (year between 2000 and 2100),
  file_name text not null,
  file_url text not null,
  storage_path text,
  uploaded_by int references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_materials_semester_course_unit
  on public.study_materials(semester_id, course_id, unit_id);

create index if not exists idx_old_question_papers_semester_course_year
  on public.old_question_papers(semester_id, course_id, year);

-- Create a PUBLIC Supabase Storage bucket named academic-resources from the dashboard:
-- Storage > New bucket > Name: academic-resources > Public bucket: ON
-- This app stores files under:
-- academic-resources/study-materials/...
-- academic-resources/old-questions/...
