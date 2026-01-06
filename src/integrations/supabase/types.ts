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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_retries: number
          progress: number
          project_id: string
          retry_count: number
          scenes_generated: number
          scheduled_at: string
          script_content: string
          script_hash: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          progress?: number
          project_id: string
          retry_count?: number
          scenes_generated?: number
          scheduled_at?: string
          script_content: string
          script_hash: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          progress?: number
          project_id?: string
          retry_count?: number
          scenes_generated?: number
          scheduled_at?: string
          script_content?: string
          script_hash?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_balance: number
          full_name: string | null
          id: string
          monthly_exports_used: number
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          full_name?: string | null
          id?: string
          monthly_exports_used?: number
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          full_name?: string | null
          id?: string
          monthly_exports_used?: number
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          aspect_ratio: string
          created_at: string
          exported_video_url: string | null
          id: string
          language: Database["public"]["Enums"]["story_language"]
          script_content: string | null
          status: Database["public"]["Enums"]["project_status"]
          story_type: Database["public"]["Enums"]["story_type"]
          thumbnail_url: string | null
          title: string
          tone: Database["public"]["Enums"]["story_tone"]
          updated_at: string
          user_id: string
          visual_style: Database["public"]["Enums"]["visual_style"]
          voice_type: Database["public"]["Enums"]["voice_type"]
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          exported_video_url?: string | null
          id?: string
          language?: Database["public"]["Enums"]["story_language"]
          script_content?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          story_type?: Database["public"]["Enums"]["story_type"]
          thumbnail_url?: string | null
          title: string
          tone?: Database["public"]["Enums"]["story_tone"]
          updated_at?: string
          user_id: string
          visual_style?: Database["public"]["Enums"]["visual_style"]
          voice_type?: Database["public"]["Enums"]["voice_type"]
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          exported_video_url?: string | null
          id?: string
          language?: Database["public"]["Enums"]["story_language"]
          script_content?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          story_type?: Database["public"]["Enums"]["story_type"]
          thumbnail_url?: string | null
          title?: string
          tone?: Database["public"]["Enums"]["story_tone"]
          updated_at?: string
          user_id?: string
          visual_style?: Database["public"]["Enums"]["visual_style"]
          voice_type?: Database["public"]["Enums"]["voice_type"]
        }
        Relationships: []
      }
      scenes: {
        Row: {
          actual_duration: number | null
          audio_status: Database["public"]["Enums"]["scene_status"]
          audio_url: string | null
          created_at: string
          estimated_duration: number | null
          id: string
          image_status: Database["public"]["Enums"]["scene_status"]
          image_url: string | null
          mood: string | null
          narration_text: string
          project_id: string
          scene_order: number
          title: string
          updated_at: string
          visual_description: string | null
        }
        Insert: {
          actual_duration?: number | null
          audio_status?: Database["public"]["Enums"]["scene_status"]
          audio_url?: string | null
          created_at?: string
          estimated_duration?: number | null
          id?: string
          image_status?: Database["public"]["Enums"]["scene_status"]
          image_url?: string | null
          mood?: string | null
          narration_text: string
          project_id: string
          scene_order: number
          title: string
          updated_at?: string
          visual_description?: string | null
        }
        Update: {
          actual_duration?: number | null
          audio_status?: Database["public"]["Enums"]["scene_status"]
          audio_url?: string | null
          created_at?: string
          estimated_duration?: number | null
          id?: string
          image_status?: Database["public"]["Enums"]["scene_status"]
          image_url?: string | null
          mood?: string | null
          narration_text?: string
          project_id?: string
          scene_order?: number
          title?: string
          updated_at?: string
          visual_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      script_cache: {
        Row: {
          cached_scenes: Json
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          language: string
          script_hash: string
          story_type: string
          tone: string
        }
        Insert: {
          cached_scenes: Json
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          language: string
          script_hash: string
          story_type: string
          tone: string
        }
        Update: {
          cached_scenes?: Json
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          language?: string
          script_hash?: string
          story_type?: string
          tone?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          is_active: boolean
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_active?: boolean
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_active?: boolean
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          action_type: string
          created_at: string
          credits_used: number | null
          id: string
          metadata: Json | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          credits_used?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          credits_used?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rate_limits: {
        Row: {
          created_at: string
          id: string
          request_count: number
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      get_active_job: {
        Args: { p_user_id: string }
        Returns: {
          job_id: string
          project_id: string
          status: string
          updated_at: string
        }[]
      }
      has_active_job: { Args: { p_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_job_as_stale: { Args: { p_job_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      project_status: "draft" | "processing" | "ready" | "exported"
      scene_status: "pending" | "generating" | "completed" | "failed"
      story_language: "hindi" | "hinglish" | "english"
      story_tone: "calm" | "emotional" | "dramatic"
      story_type: "kids" | "bedtime" | "moral"
      subscription_tier: "free" | "monthly" | "credits"
      visual_style: "cartoon" | "storybook" | "kids_illustration"
      voice_type: "male" | "female" | "child"
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
    Enums: {
      app_role: ["admin", "user"],
      project_status: ["draft", "processing", "ready", "exported"],
      scene_status: ["pending", "generating", "completed", "failed"],
      story_language: ["hindi", "hinglish", "english"],
      story_tone: ["calm", "emotional", "dramatic"],
      story_type: ["kids", "bedtime", "moral"],
      subscription_tier: ["free", "monthly", "credits"],
      visual_style: ["cartoon", "storybook", "kids_illustration"],
      voice_type: ["male", "female", "child"],
    },
  },
} as const
