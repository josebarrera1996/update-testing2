//types/supabase.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type Database = {
  public: {
    Tables: {
      aria_user_profiles: {
        Row: {
          id: string;
          email: string;
          domain_validated: boolean;
          is_approved: boolean;
          approval_token: string | null;
          role: string;
          created_at: string;
          last_sign_in: string | null;
        };
        Insert: {
          id: string;
          email: string;
          domain_validated?: boolean;
          is_approved?: boolean;
          approval_token?: string | null;
          role?: string;
          created_at?: string;
          last_sign_in?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          domain_validated?: boolean;
          is_approved?: boolean;
          approval_token?: string | null;
          role?: string;
          created_at?: string;
          last_sign_in?: string | null;
        };
      };
      aria_predictive_chats: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          name: string | null;
          messages: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          name?: string | null;
          messages?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          session_id?: string;
          version_id?: number;
          name?: string | null;
          messages?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      aria_predictive_messages: {
        Row: {
          id: string;
          chat_id: string;
          user_id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          message: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          user_id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          message: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          user_id?: string;
          project_id?: string;
          session_id?: string;
          version_id?: number;
          message?: Json;
          created_at?: string;
        };
      };
      aria_agent_research: {
        Row: {
          id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          input: Json | null;
          output: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          session_id: string;
          version_id: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          session_id?: string;
          version_id?: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
      };
      aria_agent_programming: {
        Row: {
          id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          input: Json | null;
          output: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          session_id: string;
          version_id: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          session_id?: string;
          version_id?: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
      };
      aria_agent_documentation: {
        Row: {
          id: string;
          project_id: string;
          session_id: string;
          version_id: number;
          input: Json | null;
          output: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          session_id: string;
          version_id: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          session_id?: string;
          version_id?: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
      };
    };
  };
};
