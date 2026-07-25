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
      sources: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          type: "doc" | "audio" | "survey" | "web";
          status: "processing" | "complete" | "failed" | "unsupported";
          storage_url: string | null;
          extracted_text: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          type: "doc" | "audio" | "survey" | "web";
          status?: "processing" | "complete" | "failed" | "unsupported";
          storage_url?: string | null;
          extracted_text?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          type?: "doc" | "audio" | "survey" | "web";
          status?: "processing" | "complete" | "failed" | "unsupported";
          storage_url?: string | null;
          extracted_text?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      insights: {
        Row: {
          id: string;
          project_id: string;
          source_id: string | null;
          text: string;
          quote: string | null;
          actor_type: string | null;
          category: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | "local_actor" | null;
          confidence: "high" | "medium" | "low" | null;
          source_type: "Docs" | "Audio" | "Survey" | "Web" | null;
          speaker_name: string | null;
          speaker_role: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_id?: string | null;
          text: string;
          quote?: string | null;
          actor_type?: string | null;
          category?: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | "local_actor" | null;
          confidence?: "high" | "medium" | "low" | null;
          source_type?: "Docs" | "Audio" | "Survey" | "Web" | null;
          speaker_name?: string | null;
          speaker_role?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          source_id?: string | null;
          text?: string;
          quote?: string | null;
          actor_type?: string | null;
          category?: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | "local_actor" | null;
          confidence?: "high" | "medium" | "low" | null;
          source_type?: "Docs" | "Audio" | "Survey" | "Web" | null;
          speaker_name?: string | null;
          speaker_role?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      signals: {
        Row: {
          id: string;
          project_id: string;
          category: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
          source: string;
          title: string;
          body: string;
          impact: number | null;
          uncertainty: "Low" | "Medium" | "High" | null;
          origin: "ai" | "user" | "insight" | "external_pattern";
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          category: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
          source: string;
          title: string;
          body?: string;
          impact?: number | null;
          uncertainty?: "Low" | "Medium" | "High" | null;
          origin?: "ai" | "user" | "insight" | "external_pattern";
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          category?: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
          source?: string;
          title?: string;
          body?: string;
          impact?: number | null;
          uncertainty?: "Low" | "Medium" | "High" | null;
          origin?: "ai" | "user" | "insight" | "external_pattern";
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      interviews: {
        Row: {
          id: string;
          project_id: string;
          source_id: string | null;
          participant_name: string;
          role: string | null;
          transcript: string | null;
          tag: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | null;
          key_quote: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_id?: string | null;
          participant_name: string;
          role?: string | null;
          transcript?: string | null;
          tag?: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | null;
          key_quote?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          source_id?: string | null;
          participant_name?: string;
          role?: string | null;
          transcript?: string | null;
          tag?: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | null;
          key_quote?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_runs: {
        Row: {
          id: string;
          project_id: string | null;
          step: string;
          prompt_version: string;
          input_hash: string;
          output_json: unknown | null;
          model: string | null;
          confidence: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          step: string;
          prompt_version: string;
          input_hash: string;
          output_json?: unknown | null;
          model?: string | null;
          confidence?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          step?: string;
          prompt_version?: string;
          input_hash?: string;
          output_json?: unknown | null;
          model?: string | null;
          confidence?: string | null;
          created_at?: string;
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
