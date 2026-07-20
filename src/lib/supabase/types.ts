// Hand-written Supabase types for the tables this step (backend build order §14 item 1)
// actually queries from the app. supabase/migrations/0001_schema.sql has the full
// 15-table schema; the remaining tables get typed here as their build-order steps wire
// them up (items 4-10) rather than hand-maintaining 15 tables' worth of types now.
// Shared with Tables.projects.Row and Functions.list_projects_with_progress.Returns —
// list_projects_with_progress (supabase/migrations/0005_steps_complete_gate.sql) returns
// the same column shape as the projects table itself, just with steps_complete computed.
type ProjectRowShape = {
  id: string;
  org_id: string;
  name: string;
  focal_question: string;
  refined_focal_question: string | null;
  horizon: string;
  industry: string;
  summary: string;
  steps_complete: number;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      orgs: {
        Row: { id: string; name: string; plan: string; created_at: string };
        Insert: { id?: string; name: string; plan?: string; created_at?: string };
        Update: { id?: string; name?: string; plan?: string; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; org_id: string; name: string | null; email: string; role: string; created_at: string };
        Insert: {
          id: string;
          org_id: string;
          name?: string | null;
          email: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string | null;
          email?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: ProjectRowShape;
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          focal_question?: string;
          refined_focal_question?: string | null;
          horizon?: string;
          industry?: string;
          summary?: string;
          steps_complete?: number;
          archived?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          focal_question?: string;
          refined_focal_question?: string | null;
          horizon?: string;
          industry?: string;
          summary?: string;
          steps_complete?: number;
          archived?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      list_projects_with_progress: {
        Args: Record<PropertyKey, never>;
        Returns: ProjectRowShape[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
