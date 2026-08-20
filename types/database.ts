// Tipe ini ditulis manual mengikuti schema.sql sebagai titik awal.
// Setelah project Supabase jalan, sebaiknya generate ulang otomatis dengan:
//   npx supabase gen types typescript --project-id <project-id> > types/database.ts
// supaya selalu sinkron dengan skema database yang sesungguhnya.

export type UserRole = "admin" | "guru" | "siswa";
export type ExamStatus = "draft" | "aktif" | "non_aktif" | "selesai";
export type QuestionType = "PG" | "PG_KOMPLEKS" | "BS" | "JODOH" | "ESAI";
export type ResponseStatus = "in_progress" | "completed" | "curang";

export interface User {
  id: string;
  auth_id: string | null;
  user_code: string;
  name: string;
  role: UserRole;
  class_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClassRow {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Exam {
  id: string;
  exam_code: string | null;
  subject_id: string;
  created_by: string | null;
  start_date: string;
  end_date: string | null;
  duration_minutes: number;
  pin: string;
  status: ExamStatus;
  shuffle_config: Record<string, boolean>;
  created_at: string;
}

export interface Question {
  id: string;
  exam_id: string;
  type: QuestionType;
  content: string;
  image_url: string | null;
  options: unknown;
  correct_answer: unknown; // JANGAN pernah dikirim ke client saat siswa ujian
  is_required: boolean;
  weight: number;
  order_index: number | null;
}

// Versi soal yang aman dikirim ke siswa (tanpa correct_answer)
export type PublicQuestion = Omit<Question, "correct_answer">;

export interface ExamResponse {
  id: string;
  user_id: string;
  exam_id: string;
  answers: Record<string, unknown>;
  score: number | null;
  start_time: string;
  submit_time: string | null;
  status: ResponseStatus;
  violation_count: number;
  updated_at: string;
}

// Placeholder generik supaya @supabase/ssr punya bentuk Database yang valid.
// Bisa diperluas / diganti hasil generate otomatis nanti.
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> };
      classes: { Row: ClassRow; Insert: Partial<ClassRow>; Update: Partial<ClassRow> };
      subjects: { Row: Subject; Insert: Partial<Subject>; Update: Partial<Subject> };
      exams: { Row: Exam; Insert: Partial<Exam>; Update: Partial<Exam> };
      questions: { Row: Question; Insert: Partial<Question>; Update: Partial<Question> };
      responses: { Row: ExamResponse; Insert: Partial<ExamResponse>; Update: Partial<ExamResponse> };
    };
  };
}
