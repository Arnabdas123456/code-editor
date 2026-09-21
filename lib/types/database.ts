export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          prompt: string | null;
          framework: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          prompt?: string | null;
          framework?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          prompt?: string | null;
          framework?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          path: string;
          content: string;
          language: string;
          is_folder: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          path: string;
          content?: string;
          language?: string;
          is_folder?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          path?: string;
          content?: string;
          language?: string;
          is_folder?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generation_history: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          prompt: string;
          model: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          prompt: string;
          model?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          prompt?: string;
          model?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      project_dependencies: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          version: string;
          created_at?: string;
        };
        Update: { id?: string; project_id?: string; name?: string; version?: string };
        Relationships: [];
      };
      product_plans: {
        Row: {
          id: string;
          project_id: string;
          vision: Json;
          personas: Json;
          mvp: Json;
          features: Json;
          roadmap: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          vision?: Json;
          personas?: Json;
          mvp?: Json;
          features?: Json;
          roadmap?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          vision?: Json;
          personas?: Json;
          mvp?: Json;
          features?: Json;
          roadmap?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_tasks: {
        Row: {
          id: string;
          project_id: string;
          product_plan_id: string | null;
          title: string;
          description: string;
          type: string;
          priority: string;
          status: string;
          requirements: string | null;
          acceptance_criteria: Json;
          technical_plan: Json;
          affected_files: Json;
          dependencies: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          product_plan_id?: string | null;
          title: string;
          description: string;
          type?: string;
          priority?: string;
          status?: string;
          requirements?: string | null;
          acceptance_criteria?: Json;
          technical_plan?: Json;
          affected_files?: Json;
          dependencies?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          product_plan_id?: string | null;
          title?: string;
          description?: string;
          type?: string;
          priority?: string;
          status?: string;
          requirements?: string | null;
          acceptance_criteria?: Json;
          technical_plan?: Json;
          affected_files?: Json;
          dependencies?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: string;
          project_id: string;
          task_id: string | null;
          agent_type: string;
          status: string;
          current_step: string | null;
          input: Json;
          output: Json;
          error: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id?: string | null;
          agent_type: string;
          status?: string;
          current_step?: string | null;
          input?: Json;
          output?: Json;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          agent_type?: string;
          status?: string;
          current_step?: string | null;
          input?: Json;
          output?: Json;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      project_embeddings: {
        Row: {
          id: string;
          project_id: string;
          file_id: string | null;
          chunk_index: number;
          content: string;
          embedding: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          file_id?: string | null;
          chunk_index?: number;
          content: string;
          embedding?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          file_id?: string | null;
          chunk_index?: number;
          content?: string;
          embedding?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_ai_generation: {
        Args: { p_project_id: string; p_operations: Json; p_dependencies?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectFile = Database['public']['Tables']['project_files']['Row'];
export type GenerationHistory = Database['public']['Tables']['generation_history']['Row'];
export type ProjectDependency = Database['public']['Tables']['project_dependencies']['Row'];
export type DbProductPlan = Database['public']['Tables']['product_plans']['Row'];
export type DbProductTask = Database['public']['Tables']['product_tasks']['Row'];
export type DbAgentRun = Database['public']['Tables']['agent_runs']['Row'];
export type DbProjectEmbedding = Database['public']['Tables']['project_embeddings']['Row'];
