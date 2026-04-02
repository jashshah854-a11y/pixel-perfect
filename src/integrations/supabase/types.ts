export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_collaborations: {
        Row: {
          collab_type: string
          created_at: string
          from_agent: string
          id: string
          message: string
          resolved_at: string | null
          status: string
          task_id: string | null
          to_agent: string
        }
        Insert: {
          collab_type?: string
          created_at?: string
          from_agent: string
          id?: string
          message: string
          resolved_at?: string | null
          status?: string
          task_id?: string | null
          to_agent: string
        }
        Update: {
          collab_type?: string
          created_at?: string
          from_agent?: string
          id?: string
          message?: string
          resolved_at?: string | null
          status?: string
          task_id?: string | null
          to_agent?: string
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          agent_id: string
          confidence: number
          content: string
          created_at: string
          id: string
          memory_type: string
          source_task_id: string | null
          tags: string[] | null
        }
        Insert: {
          agent_id: string
          confidence?: number
          content: string
          created_at?: string
          id?: string
          memory_type?: string
          source_task_id?: string | null
          tags?: string[] | null
        }
        Update: {
          agent_id?: string
          confidence?: number
          content?: string
          created_at?: string
          id?: string
          memory_type?: string
          source_task_id?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      agent_research_log: {
        Row: {
          agent_id: string
          applied: boolean
          findings: string | null
          id: string
          relevance_score: number
          researched_at: string
          source_url: string | null
          topic: string
        }
        Insert: {
          agent_id: string
          applied?: boolean
          findings?: string | null
          id?: string
          relevance_score?: number
          researched_at?: string
          source_url?: string | null
          topic: string
        }
        Update: {
          agent_id?: string
          applied?: boolean
          findings?: string | null
          id?: string
          relevance_score?: number
          researched_at?: string
          source_url?: string | null
          topic?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          current_task: string | null
          department: string
          id: string
          last_active: string | null
          name: string
          role: string
          status: string
          tokens_used: number
        }
        Insert: {
          current_task?: string | null
          department: string
          id: string
          last_active?: string | null
          name: string
          role: string
          status?: string
          tokens_used?: number
        }
        Update: {
          current_task?: string | null
          department?: string
          id?: string
          last_active?: string | null
          name?: string
          role?: string
          status?: string
          tokens_used?: number
        }
        Relationships: []
      }
      autonomous_actions: {
        Row: {
          action_type: string
          agent_id: string | null
          approved: boolean
          created_at: string
          description: string
          id: string
          task_id: string | null
        }
        Insert: {
          action_type: string
          agent_id?: string | null
          approved?: boolean
          created_at?: string
          description: string
          id?: string
          task_id?: string | null
        }
        Update: {
          action_type?: string
          agent_id?: string | null
          approved?: boolean
          created_at?: string
          description?: string
          id?: string
          task_id?: string | null
        }
        Relationships: []
      }
      external_actions: {
        Row: {
          action_type: string
          agent_id: string
          created_at: string
          id: string
          payload: Json | null
          result: Json | null
          status: string
          target: string | null
          task_id: string | null
        }
        Insert: {
          action_type: string
          agent_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
          target?: string | null
          task_id?: string | null
        }
        Update: {
          action_type?: string
          agent_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
          target?: string | null
          task_id?: string | null
        }
        Relationships: []
      }
      inbox: {
        Row: {
          created_at: string
          from_agent: string | null
          id: string
          message: string
          read: boolean
          to_agent: string | null
          type: string
        }
        Insert: {
          created_at?: string
          from_agent?: string | null
          id?: string
          message: string
          read?: boolean
          to_agent?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          from_agent?: string | null
          id?: string
          message?: string
          read?: boolean
          to_agent?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_from_agent_fkey"
            columns: ["from_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          markdown_content: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          markdown_content?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          markdown_content?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      sweep_results: {
        Row: {
          apply_url: string | null
          company: string
          fit_score: number
          flags: Json | null
          ghost_score: number
          id: string
          job_title: string
          location: string | null
          salary: string | null
          swept_at: string
          verdict: string
        }
        Insert: {
          apply_url?: string | null
          company: string
          fit_score?: number
          flags?: Json | null
          ghost_score?: number
          id?: string
          job_title: string
          location?: string | null
          salary?: string | null
          swept_at?: string
          verdict?: string
        }
        Update: {
          apply_url?: string | null
          company?: string
          fit_score?: number
          flags?: Json | null
          ghost_score?: number
          id?: string
          job_title?: string
          location?: string | null
          salary?: string | null
          swept_at?: string
          verdict?: string
        }
        Relationships: []
      }
      system_suggestions: {
        Row: {
          acted_at: string | null
          affected_agents: string[] | null
          confidence: number
          created_at: string
          description: string
          id: string
          status: string
          title: string
          type: string
        }
        Insert: {
          acted_at?: string | null
          affected_agents?: string[] | null
          confidence?: number
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          type?: string
        }
        Update: {
          acted_at?: string | null
          affected_agents?: string[] | null
          confidence?: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          agent_id: string
          claimed_at: string
          fit_score: number
          id: string
          reasoning: string | null
          role: string
          task_id: string
        }
        Insert: {
          agent_id: string
          claimed_at?: string
          fit_score?: number
          id?: string
          reasoning?: string | null
          role?: string
          task_id: string
        }
        Update: {
          agent_id?: string
          claimed_at?: string
          fit_score?: number
          id?: string
          reasoning?: string | null
          role?: string
          task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          source: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          source?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_connections: {
        Row: {
          api_url: string | null
          category: string
          config: Json | null
          id: string
          last_ping: string | null
          name: string
          notes: string | null
          status: string | null
        }
        Insert: {
          api_url?: string | null
          category: string
          config?: Json | null
          id: string
          last_ping?: string | null
          name: string
          notes?: string | null
          status?: string | null
        }
        Update: {
          api_url?: string | null
          category?: string
          config?: Json | null
          id?: string
          last_ping?: string | null
          name?: string
          notes?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
