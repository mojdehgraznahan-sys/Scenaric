// Hand-written Supabase types for the tables this step (backend build order §14 item 1)
// actually queries from the app. supabase/migrations/0001_schema.sql has the full
// 15-table schema; the remaining tables get typed here as their build-order steps wire
// them up (items 4-10) rather than hand-maintaining 15 tables' worth of types now.
// matrix_dots/axes/scenarios added by the Matrix backend build (Step 4, §7-§8).
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
  dashboard_last_viewed_at: string | null;
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
          dashboard_last_viewed_at?: string | null;
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
          dashboard_last_viewed_at?: string | null;
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
          type: "doc" | "audio" | "survey" | "web" | "web_feed";
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
          type: "doc" | "audio" | "survey" | "web" | "web_feed";
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
          type?: "doc" | "audio" | "survey" | "web" | "web_feed";
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
          ai_impact: number | null;
          ai_uncertainty: "Low" | "Medium" | "High" | null;
          user_impact: number | null;
          user_uncertainty: "Low" | "Medium" | "High" | null;
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
          ai_impact?: number | null;
          ai_uncertainty?: "Low" | "Medium" | "High" | null;
          user_impact?: number | null;
          user_uncertainty?: "Low" | "Medium" | "High" | null;
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
          ai_impact?: number | null;
          ai_uncertainty?: "Low" | "Medium" | "High" | null;
          user_impact?: number | null;
          user_uncertainty?: "Low" | "Medium" | "High" | null;
          origin?: "ai" | "user" | "insight" | "external_pattern";
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      matrix_dots: {
        Row: {
          id: string;
          project_id: string;
          signal_id: string;
          x: number;
          y: number;
          is_critical_axis: boolean;
          axis_label: "x" | "y" | null;
          bucket: "critical_uncertainty" | "predetermined" | "background" | "wildcard" | null;
          bucket_rationale: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          signal_id: string;
          x: number;
          y: number;
          is_critical_axis?: boolean;
          axis_label?: "x" | "y" | null;
          bucket?: "critical_uncertainty" | "predetermined" | "background" | "wildcard" | null;
          bucket_rationale?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          signal_id?: string;
          x?: number;
          y?: number;
          is_critical_axis?: boolean;
          axis_label?: "x" | "y" | null;
          bucket?: "critical_uncertainty" | "predetermined" | "background" | "wildcard" | null;
          bucket_rationale?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      axes: {
        Row: {
          id: string;
          project_id: string;
          x_signal_id: string | null;
          y_signal_id: string | null;
          x_label: string | null;
          y_label: string | null;
          independence_state: "independent" | "correlated" | "uncertain" | null;
          independence_rationale: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          x_signal_id?: string | null;
          y_signal_id?: string | null;
          x_label?: string | null;
          y_label?: string | null;
          independence_state?: "independent" | "correlated" | "uncertain" | null;
          independence_rationale?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          x_signal_id?: string | null;
          y_signal_id?: string | null;
          x_label?: string | null;
          y_label?: string | null;
          independence_state?: "independent" | "correlated" | "uncertain" | null;
          independence_rationale?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      scenarios: {
        Row: {
          id: string;
          project_id: string;
          axes_id: string | null;
          quadrant: "TL" | "TR" | "BL" | "BR";
          name: string;
          tagline: string | null;
          summary: string | null;
          narrative: string | null;
          color: string | null;
          logic: string | null;
          plausible: boolean | null;
          implausibility_note: string | null;
          is_archived: boolean;
          reaxed_at: string | null;
          narrative_edited_by_user: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          axes_id?: string | null;
          quadrant: "TL" | "TR" | "BL" | "BR";
          name: string;
          tagline?: string | null;
          summary?: string | null;
          narrative?: string | null;
          color?: string | null;
          logic?: string | null;
          plausible?: boolean | null;
          implausibility_note?: string | null;
          is_archived?: boolean;
          reaxed_at?: string | null;
          narrative_edited_by_user?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          axes_id?: string | null;
          quadrant?: "TL" | "TR" | "BL" | "BR";
          name?: string;
          tagline?: string | null;
          summary?: string | null;
          narrative?: string | null;
          color?: string | null;
          logic?: string | null;
          plausible?: boolean | null;
          implausibility_note?: string | null;
          is_archived?: boolean;
          reaxed_at?: string | null;
          narrative_edited_by_user?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      storyline_nodes: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string;
          phase: "precursors" | "catalysts" | "first_order" | "second_order" | "realized";
          category: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | null;
          title: string;
          body: string | null;
          year: number | null;
          strength: string | null;
          signal_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id: string;
          phase: "precursors" | "catalysts" | "first_order" | "second_order" | "realized";
          category?: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | null;
          title: string;
          body?: string | null;
          year?: number | null;
          strength?: string | null;
          signal_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string;
          phase?: "precursors" | "catalysts" | "first_order" | "second_order" | "realized";
          category?: "Social" | "Technology" | "Economic" | "Ecological" | "Political" | null;
          title?: string;
          body?: string | null;
          year?: number | null;
          strength?: string | null;
          signal_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      storyline_edges: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string;
          from_node_id: string;
          to_node_id: string;
          relationship: "Leads to" | "Enables" | "Amplifies" | "Blocks";
          confidence: "Strong" | "Moderate" | "Weak";
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id: string;
          from_node_id: string;
          to_node_id: string;
          relationship: "Leads to" | "Enables" | "Amplifies" | "Blocks";
          confidence: "Strong" | "Moderate" | "Weak";
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string;
          from_node_id?: string;
          to_node_id?: string;
          relationship?: "Leads to" | "Enables" | "Amplifies" | "Blocks";
          confidence?: "Strong" | "Moderate" | "Weak";
          created_at?: string;
        };
        Relationships: [];
      };
      implications: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string;
          text: string;
          category: "capital" | "hiring" | "tech" | "partners" | "other" | null;
          grounded_in_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id: string;
          text: string;
          category?: "capital" | "hiring" | "tech" | "partners" | "other" | null;
          grounded_in_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string;
          text?: string;
          category?: "capital" | "hiring" | "tech" | "partners" | "other" | null;
          grounded_in_text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      indicators: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string | null;
          name: string;
          status: "On track" | "Watch" | "Alert";
          trend: "up" | "flat" | "down" | null;
          note: string | null;
          grounded_in: string | null;
          trigger_condition: string | null;
          source_type: "project" | "news_feed";
          created_via: "ai" | "manual";
          last_checked: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id?: string | null;
          name: string;
          status?: "On track" | "Watch" | "Alert";
          trend?: "up" | "flat" | "down" | null;
          note?: string | null;
          grounded_in?: string | null;
          trigger_condition?: string | null;
          source_type?: "project" | "news_feed";
          created_via?: "ai" | "manual";
          last_checked?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string | null;
          name?: string;
          status?: "On track" | "Watch" | "Alert";
          trend?: "up" | "flat" | "down" | null;
          note?: string | null;
          grounded_in?: string | null;
          trigger_condition?: string | null;
          source_type?: "project" | "news_feed";
          created_via?: "ai" | "manual";
          last_checked?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      indicator_readings: {
        Row: {
          id: string;
          project_id: string;
          indicator_id: string;
          date: string;
          value: number;
          status_at_time: "On track" | "Watch" | "Alert";
          grounded_in: string | null;
          rationale: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          indicator_id: string;
          date: string;
          value: number;
          status_at_time: "On track" | "Watch" | "Alert";
          grounded_in?: string | null;
          rationale?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          indicator_id?: string;
          date?: string;
          value?: number;
          status_at_time?: "On track" | "Watch" | "Alert";
          grounded_in?: string | null;
          rationale?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      signposts: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string;
          storyline_id: string | null;
          name: string;
          rationale: string | null;
          status: "On track" | "Watch" | "Alert";
          citations: unknown;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id: string;
          storyline_id?: string | null;
          name: string;
          rationale?: string | null;
          status?: "On track" | "Watch" | "Alert";
          citations?: unknown;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string;
          storyline_id?: string | null;
          name?: string;
          rationale?: string | null;
          status?: "On track" | "Watch" | "Alert";
          citations?: unknown;
          generated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      plausibility_checks: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string;
          storyline_id: string | null;
          score: number;
          rationale: string;
          citations: unknown;
          checked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id: string;
          storyline_id?: string | null;
          score: number;
          rationale: string;
          citations?: unknown;
          checked_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string;
          storyline_id?: string | null;
          score?: number;
          rationale?: string;
          citations?: unknown;
          checked_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      scenario_storylines: {
        Row: {
          id: string;
          project_id: string;
          scenario_id: string;
          status: "not_generated" | "generating" | "completed" | "failed";
          generated_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scenario_id: string;
          status?: "not_generated" | "generating" | "completed" | "failed";
          generated_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scenario_id?: string;
          status?: "not_generated" | "generating" | "completed" | "failed";
          generated_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
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
      signal_insight_links: {
        Row: { project_id: string; signal_id: string; insight_id: string };
        Insert: { project_id: string; signal_id: string; insight_id: string };
        Update: { project_id?: string; signal_id?: string; insight_id?: string };
        Relationships: [];
      };
      strategic_options: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          notes: string | null;
          risk: "Low" | "Medium" | "High" | null;
          cost: "Low" | "Medium" | "High" | null;
          created_via: "ai" | "manual";
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          notes?: string | null;
          risk?: "Low" | "Medium" | "High" | null;
          cost?: "Low" | "Medium" | "High" | null;
          created_via?: "ai" | "manual";
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          notes?: string | null;
          risk?: "Low" | "Medium" | "High" | null;
          cost?: "Low" | "Medium" | "High" | null;
          created_via?: "ai" | "manual";
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      strategy_scenario_scores: {
        Row: {
          id: string;
          project_id: string;
          strategy_id: string;
          scenario_id: string;
          robust: boolean;
          rationale: string;
          grounded_in: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          strategy_id: string;
          scenario_id: string;
          robust: boolean;
          rationale: string;
          grounded_in?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          strategy_id?: string;
          scenario_id?: string;
          robust?: boolean;
          rationale?: string;
          grounded_in?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      strategy_recommendations: {
        Row: {
          id: string;
          project_id: string;
          primary_option_id: string;
          pairing_option_id: string | null;
          rationale: string;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          primary_option_id: string;
          pairing_option_id?: string | null;
          rationale: string;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          primary_option_id?: string;
          pairing_option_id?: string | null;
          rationale?: string;
          generated_at?: string;
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
          batch_id: string | null;
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
          batch_id?: string | null;
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
          batch_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      news_items: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          source: string;
          url: string;
          published_at: string | null;
          impact: "HIGH" | "MED" | "LOW" | null;
          impact_cited_phrase: string | null;
          steep_category: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
          summary: string;
          added_to_signals: boolean;
          source_id: string | null;
          signal_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          source: string;
          url: string;
          published_at?: string | null;
          impact?: "HIGH" | "MED" | "LOW" | null;
          impact_cited_phrase?: string | null;
          steep_category: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
          summary: string;
          added_to_signals?: boolean;
          source_id?: string | null;
          signal_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          source?: string;
          url?: string;
          published_at?: string | null;
          impact?: "HIGH" | "MED" | "LOW" | null;
          impact_cited_phrase?: string | null;
          steep_category?: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
          summary?: string;
          added_to_signals?: boolean;
          source_id?: string | null;
          signal_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      project_ai_settings: {
        Row: {
          project_id: string;
          auto_extract_insights: boolean;
          suggest_from_news_feeds: boolean;
          weekly_digest: boolean;
          strict_schwartz_mode: boolean;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          auto_extract_insights?: boolean;
          suggest_from_news_feeds?: boolean;
          weekly_digest?: boolean;
          strict_schwartz_mode?: boolean;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          auto_extract_insights?: boolean;
          suggest_from_news_feeds?: boolean;
          weekly_digest?: boolean;
          strict_schwartz_mode?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_integrations: {
        Row: {
          project_id: string;
          slack_webhook_url: string | null;
          slack_connected_at: string | null;
          rss_feed_url: string | null;
          rss_connected_at: string | null;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          slack_webhook_url?: string | null;
          slack_connected_at?: string | null;
          rss_feed_url?: string | null;
          rss_connected_at?: string | null;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          slack_webhook_url?: string | null;
          slack_connected_at?: string | null;
          rss_feed_url?: string | null;
          rss_connected_at?: string | null;
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
      compute_steps_complete: {
        Args: { p_project_id: string };
        Returns: number;
      };
      set_primary_strategic_option: {
        Args: { p_project_id: string; p_option_id: string; p_is_primary: boolean };
        Returns: Database["public"]["Tables"]["strategic_options"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
