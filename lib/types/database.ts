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
