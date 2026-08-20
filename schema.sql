-- ============================================================
-- SKEMA DATABASE - APLIKASI UJIAN ONLINE (ujiand.web.id)
-- Migrasi dari Google Sheets (code.gs) ke PostgreSQL / Supabase
-- ============================================================
-- Pemetaan dari sheet lama:
--   Users        -> users, teacher_assignments
--   Exams        -> exams, exam_classes
--   Questions    -> questions
--   Responses    -> responses
--   Logs         -> violation_logs
--   Gambar       -> images
--   Konfigurasi  -> app_config
--   Master_Data  -> classes, subjects
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. ENUM TYPES
-- ------------------------------------------------------------
create type user_role as enum ('admin', 'guru', 'siswa');
create type exam_status as enum ('draft', 'aktif', 'non_aktif', 'selesai');
create type question_type as enum ('PG', 'PG_KOMPLEKS', 'BS', 'JODOH', 'ESAI');
create type response_status as enum ('in_progress', 'completed', 'curang');

-- ------------------------------------------------------------
-- 2. MASTER DATA (dari sheet Master_Data)
-- ------------------------------------------------------------
create table classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,          -- contoh: 'XII-RPL'
  created_at  timestamptz not null default now()
);

create table subjects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,          -- contoh: 'Matematika'
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. USERS (dari sheet Users)
-- Password & SessionToken TIDAK disimpan manual lagi -> Supabase Auth
-- ------------------------------------------------------------
create table users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  user_code   text not null unique,          -- pengganti ADM-001 / SIS-001 dst (boleh tetap dipakai sbg NIS/username tampilan)
  name        text not null,
  role        user_role not null,
  class_id    uuid references classes(id),   -- hanya relevan utk role 'siswa'
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_users_role on users(role);
create index idx_users_class on users(class_id);

-- Penugasan Guru: gantikan JSON/text yang dulu dijejalkan ke kolom Class milik Guru
create table teacher_assignments (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references users(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  class_id    uuid not null references classes(id) on delete cascade,
  unique (teacher_id, subject_id, class_id)
);

-- ------------------------------------------------------------
-- 4. EXAMS (dari sheet Exams)
-- ------------------------------------------------------------
create table exams (
  id               uuid primary key default gen_random_uuid(),
  exam_code        text unique,              -- opsional, kompatibilitas ID lama (EXM-xxx)
  subject_id       uuid not null references subjects(id),
  created_by       uuid references users(id),
  start_date       timestamptz not null,
  end_date         timestamptz,
  duration_minutes int not null check (duration_minutes > 0),
  pin              text not null,
  status           exam_status not null default 'draft',
  shuffle_config   jsonb not null default
    '{"PG": false, "PG_KOMPLEKS": false, "BS": false, "JODOH": false, "Esai": false}',
  created_at       timestamptz not null default now()
);

create index idx_exams_status on exams(status);
create index idx_exams_subject on exams(subject_id);

-- Gantikan kolom Class comma-separated di sheet Exams lama
create table exam_classes (
  exam_id   uuid not null references exams(id) on delete cascade,
  class_id  uuid not null references classes(id) on delete cascade,
  primary key (exam_id, class_id)
);

-- ------------------------------------------------------------
-- 5. QUESTIONS (dari sheet Questions)
-- correct_answer TIDAK BOLEH pernah di-select ke client saat siswa ujian
-- (terapkan lewat RLS/kolom terpisah policy, atau view khusus tanpa kolom ini)
-- ------------------------------------------------------------
create table questions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references exams(id) on delete cascade,
  type            question_type not null,
  content         text not null,
  image_url       text,
  options         jsonb,                     -- opsi PG / pernyataan BS / pasangan JODOH
  correct_answer  jsonb,                     -- SENSITIF: jangan di-expose ke role siswa
  is_required     boolean not null default true,
  weight          numeric not null default 10 check (weight >= 0),
  order_index     int,
  created_at      timestamptz not null default now()
);

create index idx_questions_exam on questions(exam_id);

-- ------------------------------------------------------------
-- 6. RESPONSES (dari sheet Responses)
-- UNIQUE(user_id, exam_id) -> memungkinkan UPSERT atomik,
-- menggantikan LockService + scan manual di syncAnswers()/submitExam() lama
-- ------------------------------------------------------------
create table responses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  exam_id         uuid not null references exams(id),
  answers         jsonb not null default '{}',
  score           numeric,
  start_time      timestamptz not null default now(),
  submit_time     timestamptz,
  status          response_status not null default 'in_progress',
  violation_count int not null default 0,
  updated_at      timestamptz not null default now(),
  unique (user_id, exam_id)
);

create index idx_responses_exam on responses(exam_id);
create index idx_responses_status on responses(status);

-- ------------------------------------------------------------
-- 7. VIOLATION LOGS (dari sheet Logs)
-- ------------------------------------------------------------
create table violation_logs (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid references responses(id) on delete cascade,
  user_id      uuid not null references users(id),
  exam_id      uuid not null references exams(id),
  details      text not null,
  created_at   timestamptz not null default now()
);

create index idx_violation_logs_exam on violation_logs(exam_id);

-- ------------------------------------------------------------
-- 8. IMAGES (dari sheet Gambar) - bank gambar soal
-- ------------------------------------------------------------
create table images (
  id            uuid primary key default gen_random_uuid(),
  file_name     text not null,
  direct_link   text not null,
  preview_link  text,
  storage_path  text,                        -- path di Supabase Storage bucket
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. APP CONFIG (dari sheet Konfigurasi)
-- ------------------------------------------------------------
create table app_config (
  key    text primary key,
  value  text
);

insert into app_config (key, value) values
  ('app_name', 'Ujian Online'),
  ('app_subtitle', 'Sistem Ujian Terintegrasi'),
  ('app_logo', ''),
  ('app_background', ''),
  ('show_exam_result', 'true');

-- ============================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- Menutup celah keamanan lama: syncAnswers/submitExam/logViolation
-- di code.gs tidak pernah validasi token -> di sini DB sendiri yang menolak.
-- ============================================================

alter table users enable row level security;
alter table responses enable row level security;
alter table violation_logs enable row level security;
alter table questions enable row level security;

-- Helper: ambil users.id dari auth.uid() yang sedang login
-- (asumsi kolom users.auth_id sudah terisi saat user dibuat)

-- Siswa hanya boleh melihat & mengubah response miliknya sendiri
create policy "siswa lihat response sendiri"
  on responses for select
  using (user_id in (select id from users where auth_id = auth.uid()));

create policy "siswa upsert response sendiri"
  on responses for insert
  with check (user_id in (select id from users where auth_id = auth.uid()));

create policy "siswa update response sendiri"
  on responses for update
  using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

-- Siswa hanya boleh menulis log pelanggaran atas namanya sendiri
create policy "siswa insert log pelanggaran sendiri"
  on violation_logs for insert
  with check (user_id in (select id from users where auth_id = auth.uid()));

-- Guru & Admin: akses penuh (sesuaikan lagi jika guru hanya boleh lihat mapelnya)
create policy "admin guru akses penuh responses"
  on responses for all
  using (
    exists (
      select 1 from users
      where auth_id = auth.uid() and role in ('admin', 'guru')
    )
  );

create policy "admin guru akses penuh violation_logs"
  on violation_logs for all
  using (
    exists (
      select 1 from users
      where auth_id = auth.uid() and role in ('admin', 'guru')
    )
  );

-- catatan: kolom questions.correct_answer sebaiknya TIDAK di-select lewat
-- client langsung saat siswa mengerjakan ujian. Cara paling aman: buat VIEW
-- terpisah (mis. questions_public) tanpa kolom correct_answer, dan endpoint
-- API "ambil soal ujian" query lewat view itu, bukan tabel questions asli.
