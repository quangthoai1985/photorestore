export interface Env {
  DB: D1Database;
  MASTER_SECRET: string;
  APP_NAME?: string;
  GEMINI_PROCESSOR_URL?: string;
  PROCESSOR_SHARED_SECRET?: string;
}
