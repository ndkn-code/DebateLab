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
      achievements: {
        Row: {
          category: string
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          icon: string
          id: string
          slug: string
          sort_order: number
          title: string
          title_reward: string | null
          xp_reward: number
        }
        Insert: {
          category: string
          condition_type: string
          condition_value: number
          created_at?: string
          description: string
          icon: string
          id?: string
          slug: string
          sort_order?: number
          title: string
          title_reward?: string | null
          xp_reward?: number
        }
        Update: {
          category?: string
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          title_reward?: string | null
          xp_reward?: number
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          content: Json
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_archived: boolean | null
          metadata: Json | null
          module_id: string
          order_index: number
          phase: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          content?: Json
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_archived?: boolean | null
          metadata?: Json | null
          module_id: string
          order_index: number
          phase?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          content?: Json
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_archived?: boolean | null
          metadata?: Json | null
          module_id?: string
          order_index?: number
          phase?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_attempts: {
        Row: {
          activity_id: string
          attempt_number: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          is_passed: boolean | null
          max_score: number | null
          responses: Json | null
          score: number | null
          started_at: string | null
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          activity_id: string
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_passed?: boolean | null
          max_score?: number | null
          responses?: Json | null
          score?: number | null
          started_at?: string | null
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          activity_id?: string
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_passed?: boolean | null
          max_score?: number | null
          responses?: Json | null
          score?: number | null
          started_at?: string | null
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_log: {
        Row: {
          action: string
          admin_user_id: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_requests: {
        Row: {
          ai_quality_run_id: string | null
          analysis_job_id: string | null
          cache_hit_tokens: number | null
          cache_miss_tokens: number | null
          created_at: string
          debate_session_id: string | null
          error_code: string | null
          error_message: string | null
          estimated_cost_usd: number
          finish_reason: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json
          model: string
          output_tokens: number | null
          output_type: string | null
          practice_attempt_id: string | null
          provider: string
          reasoning_tokens: number | null
          request_id: string | null
          response_status: number | null
          source_route: string | null
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          ai_quality_run_id?: string | null
          analysis_job_id?: string | null
          cache_hit_tokens?: number | null
          cache_miss_tokens?: number | null
          created_at?: string
          debate_session_id?: string | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost_usd?: number
          finish_reason?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model: string
          output_tokens?: number | null
          output_type?: string | null
          practice_attempt_id?: string | null
          provider: string
          reasoning_tokens?: number | null
          request_id?: string | null
          response_status?: number | null
          source_route?: string | null
          status: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          ai_quality_run_id?: string | null
          analysis_job_id?: string | null
          cache_hit_tokens?: number | null
          cache_miss_tokens?: number | null
          created_at?: string
          debate_session_id?: string | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost_usd?: number
          finish_reason?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string
          output_tokens?: number | null
          output_type?: string | null
          practice_attempt_id?: string | null
          provider?: string
          reasoning_tokens?: number | null
          request_id?: string | null
          response_status?: number | null
          source_route?: string | null
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_requests_ai_quality_run_id_fkey"
            columns: ["ai_quality_run_id"]
            isOneToOne: false
            referencedRelation: "ai_quality_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_provider_requests_analysis_job_id_fkey"
            columns: ["analysis_job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_provider_requests_debate_session_id_fkey"
            columns: ["debate_session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_provider_requests_practice_attempt_id_fkey"
            columns: ["practice_attempt_id"]
            isOneToOne: false
            referencedRelation: "practice_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_provider_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quality_ratings: {
        Row: {
          comment: string | null
          created_at: string
          fairness: string | null
          id: string
          locale: string | null
          reason_tags: string[]
          route: string | null
          run_id: string
          updated_at: string
          usefulness: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          fairness?: string | null
          id?: string
          locale?: string | null
          reason_tags?: string[]
          route?: string | null
          run_id: string
          updated_at?: string
          usefulness?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          fairness?: string | null
          id?: string
          locale?: string | null
          reason_tags?: string[]
          route?: string | null
          run_id?: string
          updated_at?: string
          usefulness?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_quality_ratings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_quality_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quality_runs: {
        Row: {
          admin_notes: string | null
          ai_side: string | null
          analysis_job_id: string | null
          cache_hit_tokens: number | null
          cache_miss_tokens: number | null
          confidence: number | null
          created_at: string
          debate_duel_id: string | null
          debate_duel_judgment_id: string | null
          debate_format: string | null
          debate_session_id: string | null
          difficulty: string | null
          error_code: string | null
          error_message: string | null
          estimated_cost_usd: number
          fallback_used: boolean
          id: string
          input_preview: string | null
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json
          model: string
          output_preview: string | null
          output_text: string | null
          output_tokens: number | null
          output_type: string
          practice_attempt_id: string | null
          practice_language: string | null
          practice_track: string | null
          prompt_bundle_key: string | null
          prompt_bundle_version: number | null
          prompt_hash: string | null
          provider: string
          reasoning_tokens: number | null
          requested_provider: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rubric_key: string | null
          rubric_version: number | null
          score: number | null
          side: string | null
          source_route: string | null
          status: string
          topic_title: string | null
          total_tokens: number | null
          updated_at: string
          user_id: string
          winner: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_side?: string | null
          analysis_job_id?: string | null
          cache_hit_tokens?: number | null
          cache_miss_tokens?: number | null
          confidence?: number | null
          created_at?: string
          debate_duel_id?: string | null
          debate_duel_judgment_id?: string | null
          debate_format?: string | null
          debate_session_id?: string | null
          difficulty?: string | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost_usd?: number
          fallback_used?: boolean
          id?: string
          input_preview?: string | null
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model: string
          output_preview?: string | null
          output_text?: string | null
          output_tokens?: number | null
          output_type: string
          practice_attempt_id?: string | null
          practice_language?: string | null
          practice_track?: string | null
          prompt_bundle_key?: string | null
          prompt_bundle_version?: number | null
          prompt_hash?: string | null
          provider: string
          reasoning_tokens?: number | null
          requested_provider?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rubric_key?: string | null
          rubric_version?: number | null
          score?: number | null
          side?: string | null
          source_route?: string | null
          status?: string
          topic_title?: string | null
          total_tokens?: number | null
          updated_at?: string
          user_id: string
          winner?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_side?: string | null
          analysis_job_id?: string | null
          cache_hit_tokens?: number | null
          cache_miss_tokens?: number | null
          confidence?: number | null
          created_at?: string
          debate_duel_id?: string | null
          debate_duel_judgment_id?: string | null
          debate_format?: string | null
          debate_session_id?: string | null
          difficulty?: string | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost_usd?: number
          fallback_used?: boolean
          id?: string
          input_preview?: string | null
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string
          output_preview?: string | null
          output_text?: string | null
          output_tokens?: number | null
          output_type?: string
          practice_attempt_id?: string | null
          practice_language?: string | null
          practice_track?: string | null
          prompt_bundle_key?: string | null
          prompt_bundle_version?: number | null
          prompt_hash?: string | null
          provider?: string
          reasoning_tokens?: number | null
          requested_provider?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rubric_key?: string | null
          rubric_version?: number | null
          score?: number | null
          side?: string | null
          source_route?: string | null
          status?: string
          topic_title?: string | null
          total_tokens?: number | null
          updated_at?: string
          user_id?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_quality_runs_analysis_job_id_fkey"
            columns: ["analysis_job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_runs_debate_duel_id_fkey"
            columns: ["debate_duel_id"]
            isOneToOne: false
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_runs_debate_duel_judgment_id_fkey"
            columns: ["debate_duel_judgment_id"]
            isOneToOne: false
            referencedRelation: "debate_duel_judgments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_runs_debate_session_id_fkey"
            columns: ["debate_session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_runs_practice_attempt_id_fkey"
            columns: ["practice_attempt_id"]
            isOneToOne: false
            referencedRelation: "practice_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_runs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_jobs: {
        Row: {
          attempt_id: string
          created_at: string
          delivery_count: number
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          input_hash: string | null
          job_type: string
          max_attempts: number
          model_name: string | null
          model_provider: string | null
          next_retry_at: string | null
          prompt_hash: string | null
          queue_message_id: string | null
          queue_topic: string
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          delivery_count?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          input_hash?: string | null
          job_type?: string
          max_attempts?: number
          model_name?: string | null
          model_provider?: string | null
          next_retry_at?: string | null
          prompt_hash?: string | null
          queue_message_id?: string | null
          queue_topic?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          delivery_count?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          input_hash?: string | null
          job_type?: string
          max_attempts?: number
          model_name?: string | null
          model_provider?: string | null
          next_retry_at?: string | null
          prompt_hash?: string | null
          queue_message_id?: string | null
          queue_topic?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "practice_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_name: string
          feature_area: string
          id: string
          metadata: Json
          occurred_at: string
          route: string | null
          session_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_name: string
          feature_area: string
          id?: string
          metadata?: Json
          occurred_at?: string
          route?: string | null
          session_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_name?: string
          feature_area?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          route?: string | null
          session_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          created_at: string
          id: number
          request_count: number
          scope: string
          updated_at: string
          user_id: string
          window_reset_at: string
          window_start_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          request_count?: number
          scope: string
          updated_at?: string
          user_id: string
          window_reset_at: string
          window_start_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          request_count?: number
          scope?: string
          updated_at?: string
          user_id?: string
          window_reset_at?: string
          window_start_at?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          created_at: string
          duration_ms: number | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          input_unit: string | null
          metadata: Json | null
          model: string | null
          output_tokens: number | null
          output_unit: string | null
          reference_id: string | null
          reference_type: string | null
          service: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          input_unit?: string | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          output_unit?: string | null
          reference_id?: string | null
          reference_type?: string | null
          service: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          input_unit?: string | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          output_unit?: string | null
          reference_id?: string | null
          reference_type?: string | null
          service?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_band_scores: {
        Row: {
          attempt_id: string
          band_conversion_id: string | null
          computed_at: string | null
          created_at: string
          id: string
          listening_band: number | null
          listening_raw: number | null
          overall_band: number | null
          reading_band: number | null
          reading_raw: number | null
          speaking_band: number | null
          updated_at: string
          user_id: string
          writing_band: number | null
        }
        Insert: {
          attempt_id: string
          band_conversion_id?: string | null
          computed_at?: string | null
          created_at?: string
          id?: string
          listening_band?: number | null
          listening_raw?: number | null
          overall_band?: number | null
          reading_band?: number | null
          reading_raw?: number | null
          speaking_band?: number | null
          updated_at?: string
          user_id: string
          writing_band?: number | null
        }
        Update: {
          attempt_id?: string
          band_conversion_id?: string | null
          computed_at?: string | null
          created_at?: string
          id?: string
          listening_band?: number | null
          listening_raw?: number | null
          overall_band?: number | null
          reading_band?: number | null
          reading_raw?: number | null
          speaking_band?: number | null
          updated_at?: string
          user_id?: string
          writing_band?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_band_scores_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_band_scores_band_conversion_id_fkey"
            columns: ["band_conversion_id"]
            isOneToOne: false
            referencedRelation: "band_conversions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_band_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_assets: {
        Row: {
          accent: Database["public"]["Enums"]["ielts_accent"]
          created_at: string
          duration_seconds: number | null
          id: string
          kind: string
          metadata: Json
          script: string | null
          status: Database["public"]["Enums"]["ielts_audio_status"]
          storage_path: string | null
          test_id: string | null
          tts_provider: string | null
          updated_at: string
          version: number
          voice: string | null
        }
        Insert: {
          accent?: Database["public"]["Enums"]["ielts_accent"]
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          metadata?: Json
          script?: string | null
          status?: Database["public"]["Enums"]["ielts_audio_status"]
          storage_path?: string | null
          test_id?: string | null
          tts_provider?: string | null
          updated_at?: string
          version?: number
          voice?: string | null
        }
        Update: {
          accent?: Database["public"]["Enums"]["ielts_accent"]
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          metadata?: Json
          script?: string | null
          status?: Database["public"]["Enums"]["ielts_audio_status"]
          storage_path?: string | null
          test_id?: string | null
          tts_provider?: string | null
          updated_at?: string
          version?: number
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_assets_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      band_conversions: {
        Row: {
          band: number
          conversion_key: string
          created_at: string
          id: string
          module: Database["public"]["Enums"]["ielts_module"] | null
          raw_max: number
          raw_min: number
          skill: Database["public"]["Enums"]["ielts_skill"]
          updated_at: string
          version: number
        }
        Insert: {
          band: number
          conversion_key?: string
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["ielts_module"] | null
          raw_max: number
          raw_min: number
          skill: Database["public"]["Enums"]["ielts_skill"]
          updated_at?: string
          version?: number
        }
        Update: {
          band?: number
          conversion_key?: string
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["ielts_module"] | null
          raw_max?: number
          raw_min?: number
          skill?: Database["public"]["Enums"]["ielts_skill"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      class_attendance_records: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          session_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_attendance_sessions: {
        Row: {
          class_id: string
          course_id: string
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          session_date: string
          taken_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          course_id: string
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          session_date: string
          taken_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          course_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          session_date?: string
          taken_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "class_attendance_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_sessions_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_course_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          class_id: string
          course_id: string
          created_at: string
          id: string
          metadata: Json
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          class_id: string
          course_id: string
          created_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          class_id?: string
          course_id?: string
          created_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "class_course_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_course_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_course_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "class_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      class_memberships: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          joined_at: string
          member_role: string
          metadata: Json
          removed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          member_role?: string
          metadata?: Json
          removed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          member_role?: string
          metadata?: Json
          removed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_memberships_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_memberships_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          class_id: string
          course_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          end_time: string
          id: string
          location: string | null
          metadata: Json
          recurrence_rule: Json
          recurrence_summary: string | null
          room: string | null
          start_date: string
          start_time: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time: string
          id?: string
          location?: string | null
          metadata?: Json
          recurrence_rule?: Json
          recurrence_summary?: string | null
          room?: string | null
          start_date: string
          start_time: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string
          id?: string
          location?: string | null
          metadata?: Json
          recurrence_rule?: Json
          recurrence_summary?: string | null
          room?: string | null
          start_date?: string
          start_time?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "class_schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          club_id: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          grade_level: string | null
          id: string
          max_students: number | null
          meeting_schedule: string | null
          metadata: Json
          program_type: string
          room: string | null
          start_date: string | null
          status: string
          teacher_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          grade_level?: string | null
          id?: string
          max_students?: number | null
          meeting_schedule?: string | null
          metadata?: Json
          program_type?: string
          room?: string | null
          start_date?: string | null
          status?: string
          teacher_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          grade_level?: string | null
          id?: string
          max_students?: number | null
          meeting_schedule?: string | null
          metadata?: Json
          program_type?: string
          room?: string | null
          start_date?: string | null
          status?: string
          teacher_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_assignment_submissions: {
        Row: {
          assignment_id: string
          class_id: string | null
          club_id: string
          created_at: string
          id: string
          metadata: Json
          source_id: string
          source_type: string
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          class_id?: string | null
          club_id: string
          created_at?: string
          id?: string
          metadata?: Json
          source_id: string
          source_type?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          class_id?: string | null
          club_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string
          source_type?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_assignments: {
        Row: {
          assigned_track: string
          assignment_type: string
          class_id: string | null
          club_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          required_attempts: number
          rubric_key: string
          rubric_version: number
          status: string
          title: string
          topic_category: string | null
          topic_title: string | null
          updated_at: string
        }
        Insert: {
          assigned_track?: string
          assignment_type?: string
          class_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          required_attempts?: number
          rubric_key?: string
          rubric_version?: number
          status?: string
          title: string
          topic_category?: string | null
          topic_title?: string | null
          updated_at?: string
        }
        Update: {
          assigned_track?: string
          assignment_type?: string
          class_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          required_attempts?: number
          rubric_key?: string
          rubric_version?: number
          status?: string
          title?: string
          topic_category?: string | null
          topic_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_events: {
        Row: {
          class_id: string | null
          club_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          end_time: string
          event_type: string
          external_calendar_url: string | null
          external_provider: string | null
          id: string
          location: string | null
          metadata: Json
          recurrence_rule: Json
          recurrence_summary: string | null
          room: string | null
          start_date: string
          start_time: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time: string
          event_type?: string
          external_calendar_url?: string | null
          external_provider?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          recurrence_rule?: Json
          recurrence_summary?: string | null
          room?: string | null
          start_date: string
          start_time: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string
          event_type?: string
          external_calendar_url?: string | null
          external_provider?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          recurrence_rule?: Json
          recurrence_summary?: string | null
          room?: string | null
          start_date?: string
          start_time?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          club_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          last_sent_at: string | null
          metadata: Json
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string | null
          metadata?: Json
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string | null
          metadata?: Json
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_join_codes: {
        Row: {
          club_id: string
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          issued_by: string | null
          metadata: Json
          redeemed_at: string | null
          redeemed_by: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          code_hash: string
          created_at?: string
          expires_at?: string
          id?: string
          issued_by?: string | null
          metadata?: Json
          redeemed_at?: string | null
          redeemed_by?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          issued_by?: string | null
          metadata?: Json
          redeemed_at?: string | null
          redeemed_by?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_join_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_codes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_codes_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_memberships: {
        Row: {
          club_id: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          metadata: Json
          removed_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          metadata?: Json
          removed_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          metadata?: Json
          removed_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          city: string | null
          club_type: string
          code: string
          country: string
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          logo_storage_path: string | null
          logo_url: string | null
          metadata: Json
          name: string
          owner_user_id: string | null
          settings: Json
          status: string
          threads_url: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          club_type?: string
          code: string
          country?: string
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          metadata?: Json
          name: string
          owner_user_id?: string | null
          settings?: Json
          status?: string
          threads_url?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          club_type?: string
          code?: string
          country?: string
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          metadata?: Json
          name?: string
          owner_user_id?: string | null
          settings?: Json
          status?: string
          threads_url?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reviews: {
        Row: {
          club_id: string
          comment: string | null
          created_at: string
          id: string
          performance_attempt_id: string
          reviewer_id: string | null
          score_adjustments: Json
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          club_id: string
          comment?: string | null
          created_at?: string
          id?: string
          performance_attempt_id: string
          reviewer_id?: string | null
          score_adjustments?: Json
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          club_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          performance_attempt_id?: string
          reviewer_id?: string | null
          score_adjustments?: Json
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_performance_attempt_id_fkey"
            columns: ["performance_attempt_id"]
            isOneToOne: false
            referencedRelation: "performance_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_access_rules: {
        Row: {
          course_id: string
          created_at: string | null
          created_by: string | null
          id: string
          rule_type: string
          target_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          rule_type: string
          target_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          rule_type?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_access_rules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_access_rules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_access_rules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_access_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          access_level: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean | null
          sort_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          sort_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          sort_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          difficulty: string
          estimated_hours: number | null
          id: string
          is_archived: boolean | null
          is_free: boolean
          is_published: boolean
          metadata: Json | null
          short_description: string | null
          slug: string
          sort_order: number
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          difficulty: string
          estimated_hours?: number | null
          id?: string
          is_archived?: boolean | null
          is_free?: boolean
          is_published?: boolean
          metadata?: Json | null
          short_description?: string | null
          slug: string
          sort_order?: number
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: string
          estimated_hours?: number | null
          id?: string
          is_archived?: boolean | null
          is_free?: boolean
          is_published?: boolean
          metadata?: Json | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          average_score: number | null
          date: string
          id: string
          lessons_completed: number
          minutes_studied: number
          practice_minutes: number
          quizzes_completed: number
          sessions_completed: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          average_score?: number | null
          date: string
          id?: string
          lessons_completed?: number
          minutes_studied?: number
          practice_minutes?: number
          quizzes_completed?: number
          sessions_completed?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          average_score?: number | null
          date?: string
          id?: string
          lessons_completed?: number
          minutes_studied?: number
          practice_minutes?: number
          quizzes_completed?: number
          sessions_completed?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_documents: {
        Row: {
          content_hash: string
          content_text: string
          created_at: string
          created_by: string | null
          document_type: string
          id: string
          import_batch_id: string | null
          language: string
          metadata: Json
          source_id: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          content_text: string
          created_at?: string
          created_by?: string | null
          document_type: string
          id?: string
          import_batch_id?: string | null
          language?: string
          metadata?: Json
          source_id?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          content_text?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          id?: string
          import_batch_id?: string | null
          language?: string
          metadata?: Json
          source_id?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_documents_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_embeddings: {
        Row: {
          content_hash: string
          created_at: string
          dimensions: number
          embedded_at: string
          embedding: string
          id: string
          input_type: string
          item_id: string
          model: string
          provider: string
          token_count_estimate: number | null
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          dimensions: number
          embedded_at?: string
          embedding: string
          id?: string
          input_type?: string
          item_id: string
          model: string
          provider: string
          token_count_estimate?: number | null
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          dimensions?: number
          embedded_at?: string
          embedding?: string
          id?: string
          input_type?: string
          item_id?: string
          model?: string
          provider?: string
          token_count_estimate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_embeddings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_items"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_import_batches: {
        Row: {
          created_at: string
          error_message: string | null
          file_name: string | null
          id: string
          import_key: string
          imported_by: string | null
          input_format: string
          item_count: number
          match_count: number
          metadata: Json
          motion_count: number
          original_document_id: string | null
          source_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_key: string
          imported_by?: string | null
          input_format: string
          item_count?: number
          match_count?: number
          metadata?: Json
          motion_count?: number
          original_document_id?: string | null
          source_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_key?: string
          imported_by?: string | null
          input_format?: string
          item_count?: number
          match_count?: number
          metadata?: Json
          motion_count?: number
          original_document_id?: string | null
          source_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_import_batches_original_document_id_fkey"
            columns: ["original_document_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_items: {
        Row: {
          admin_notes: string | null
          canonical_fingerprint: string
          canonical_match_id: string
          confidence: number
          content: Json
          content_hash: string
          created_at: string
          embedding_text: string
          evidence_status: string
          id: string
          item_type: string
          language: string
          metadata: Json
          quality_flags: Json
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          side: string
          source_id: string | null
          source_match_key: string | null
          updated_at: string
          usable_for: string[]
        }
        Insert: {
          admin_notes?: string | null
          canonical_fingerprint: string
          canonical_match_id: string
          confidence?: number
          content: Json
          content_hash: string
          created_at?: string
          embedding_text: string
          evidence_status?: string
          id?: string
          item_type: string
          language?: string
          metadata?: Json
          quality_flags?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          side?: string
          source_id?: string | null
          source_match_key?: string | null
          updated_at?: string
          usable_for?: string[]
        }
        Update: {
          admin_notes?: string | null
          canonical_fingerprint?: string
          canonical_match_id?: string
          confidence?: number
          content?: Json
          content_hash?: string
          created_at?: string
          embedding_text?: string
          evidence_status?: string
          id?: string
          item_type?: string
          language?: string
          metadata?: Json
          quality_flags?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          side?: string
          source_id?: string | null
          source_match_key?: string | null
          updated_at?: string
          usable_for?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_items_canonical_match_id_fkey"
            columns: ["canonical_match_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_matches: {
        Row: {
          admin_notes: string | null
          aggregate_confidence: number
          canonical_match_key: string
          created_at: string
          id: string
          import_decision: string
          metadata: Json
          motion_confidence: number
          motion_en: string | null
          motion_key: string
          motion_vi: string
          quality_flags: Json
          rejected_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_match_refs: Json
          teams: Json
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          aggregate_confidence?: number
          canonical_match_key: string
          created_at?: string
          id?: string
          import_decision: string
          metadata?: Json
          motion_confidence?: number
          motion_en?: string | null
          motion_key: string
          motion_vi: string
          quality_flags?: Json
          rejected_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_match_refs?: Json
          teams?: Json
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          aggregate_confidence?: number
          canonical_match_key?: string
          created_at?: string
          id?: string
          import_decision?: string
          metadata?: Json
          motion_confidence?: number
          motion_en?: string | null
          motion_key?: string
          motion_vi?: string
          quality_flags?: Json
          rejected_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_match_refs?: Json
          teams?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_matches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_motion_candidates: {
        Row: {
          admin_notes: string | null
          canonical_match_id: string | null
          category_key: string
          created_at: string
          difficulty: string
          id: string
          metadata: Json
          motion_en: string | null
          motion_key: string
          motion_vi: string
          normalized_title_hash: string
          publish_status: string
          published_topic_key: string | null
          quality_flags: Json
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          source_season: number | null
          source_stage: string | null
          source_url: string | null
          teams: Json
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          canonical_match_id?: string | null
          category_key?: string
          created_at?: string
          difficulty?: string
          id?: string
          metadata?: Json
          motion_en?: string | null
          motion_key: string
          motion_vi: string
          normalized_title_hash: string
          publish_status?: string
          published_topic_key?: string | null
          quality_flags?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_season?: number | null
          source_stage?: string | null
          source_url?: string | null
          teams?: Json
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          canonical_match_id?: string | null
          category_key?: string
          created_at?: string
          difficulty?: string
          id?: string
          metadata?: Json
          motion_en?: string | null
          motion_key?: string
          motion_vi?: string
          normalized_title_hash?: string
          publish_status?: string
          published_topic_key?: string | null
          quality_flags?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_season?: number | null
          source_stage?: string | null
          source_url?: string | null
          teams?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_motion_candidates_canonical_match_id_fkey"
            columns: ["canonical_match_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_motion_candidates_published_topic_key_fkey"
            columns: ["published_topic_key"]
            isOneToOne: false
            referencedRelation: "active_practice_topic_catalog"
            referencedColumns: ["topic_key"]
          },
          {
            foreignKeyName: "debate_corpus_motion_candidates_published_topic_key_fkey"
            columns: ["published_topic_key"]
            isOneToOne: false
            referencedRelation: "practice_topics"
            referencedColumns: ["topic_key"]
          },
          {
            foreignKeyName: "debate_corpus_motion_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_motion_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "debate_corpus_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_retrieval_logs: {
        Row: {
          ai_quality_run_id: string | null
          created_at: string
          dimensions: number
          filters: Json
          id: string
          latency_ms: number | null
          model: string
          provider: string
          query_hash: string
          query_text_preview: string | null
          retrieved_items: Json
          source_route: string | null
          user_id: string | null
        }
        Insert: {
          ai_quality_run_id?: string | null
          created_at?: string
          dimensions: number
          filters?: Json
          id?: string
          latency_ms?: number | null
          model: string
          provider: string
          query_hash: string
          query_text_preview?: string | null
          retrieved_items?: Json
          source_route?: string | null
          user_id?: string | null
        }
        Update: {
          ai_quality_run_id?: string | null
          created_at?: string
          dimensions?: number
          filters?: Json
          id?: string
          latency_ms?: number | null
          model?: string
          provider?: string
          query_hash?: string
          query_text_preview?: string | null
          retrieved_items?: Json
          source_route?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_retrieval_logs_ai_quality_run_id_fkey"
            columns: ["ai_quality_run_id"]
            isOneToOne: false
            referencedRelation: "ai_quality_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_corpus_retrieval_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_corpus_sources: {
        Row: {
          admin_notes: string | null
          created_at: string
          episode: string | null
          id: string
          language: string
          metadata: Json
          overall_confidence: number
          quality_flags: Json
          raw_line: number | null
          reason: string | null
          recommended_import_status: string
          recommended_use: string[]
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          season: number | null
          source_type: string
          stage: string | null
          transcript_quality: string
          updated_at: string
          video_title: string
          youtube_url: string
          youtube_video_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          episode?: string | null
          id: string
          language?: string
          metadata?: Json
          overall_confidence?: number
          quality_flags?: Json
          raw_line?: number | null
          reason?: string | null
          recommended_import_status?: string
          recommended_use?: string[]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          season?: number | null
          source_type: string
          stage?: string | null
          transcript_quality: string
          updated_at?: string
          video_title: string
          youtube_url: string
          youtube_video_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          episode?: string | null
          id?: string
          language?: string
          metadata?: Json
          overall_confidence?: number
          quality_flags?: Json
          raw_line?: number | null
          reason?: string | null
          recommended_import_status?: string
          recommended_use?: string[]
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          season?: number | null
          source_type?: string
          stage?: string | null
          transcript_quality?: string
          updated_at?: string
          video_title?: string
          youtube_url?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_corpus_sources_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_duel_integrity_events: {
        Row: {
          action_data: Json
          action_type: string
          created_at: string
          duel_id: string
          id: string
          is_suspicious: boolean
          participant_id: string | null
          severity: string
          suspicious_reason: string | null
          user_id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          created_at?: string
          duel_id: string
          id?: string
          is_suspicious?: boolean
          participant_id?: string | null
          severity?: string
          suspicious_reason?: string | null
          user_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string
          duel_id?: string
          id?: string
          is_suspicious?: boolean
          participant_id?: string | null
          severity?: string
          suspicious_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_duel_integrity_events_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_duel_integrity_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "debate_duel_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_duel_judgments: {
        Row: {
          confidence: number | null
          created_at: string
          duel_id: string
          id: string
          judge_model: string
          summary: string
          updated_at: string
          verdict: Json
          winner_participant_id: string | null
          winner_side: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          duel_id: string
          id?: string
          judge_model?: string
          summary?: string
          updated_at?: string
          verdict?: Json
          winner_participant_id?: string | null
          winner_side?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          duel_id?: string
          id?: string
          judge_model?: string
          summary?: string
          updated_at?: string
          verdict?: Json
          winner_participant_id?: string | null
          winner_side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_duel_judgments_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: true
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_duel_judgments_winner_participant_id_fkey"
            columns: ["winner_participant_id"]
            isOneToOne: false
            referencedRelation: "debate_duel_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_duel_matchmaking_tickets: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string
          id: string
          matched_at: string | null
          matched_duel_id: string | null
          matched_ticket_id: string | null
          opening_time_seconds: number
          practice_language: string
          prep_time_seconds: number
          rebuttal_time_seconds: number
          status: string
          topic_category: string
          topic_category_key: string
          topic_difficulty: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          matched_at?: string | null
          matched_duel_id?: string | null
          matched_ticket_id?: string | null
          opening_time_seconds?: number
          practice_language?: string
          prep_time_seconds?: number
          rebuttal_time_seconds?: number
          status?: string
          topic_category: string
          topic_category_key?: string
          topic_difficulty: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          matched_at?: string | null
          matched_duel_id?: string | null
          matched_ticket_id?: string | null
          opening_time_seconds?: number
          practice_language?: string
          prep_time_seconds?: number
          rebuttal_time_seconds?: number
          status?: string
          topic_category?: string
          topic_category_key?: string
          topic_difficulty?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_duel_matchmaking_tickets_matched_duel_id_fkey"
            columns: ["matched_duel_id"]
            isOneToOne: false
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_duel_matchmaking_tickets_matched_ticket_id_fkey"
            columns: ["matched_ticket_id"]
            isOneToOne: false
            referencedRelation: "debate_duel_matchmaking_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_duel_participants: {
        Row: {
          avatar_url_snapshot: string | null
          completed_at: string | null
          created_at: string
          credits_charged_at: string | null
          display_name_snapshot: string
          duel_id: string
          id: string
          joined_at: string
          ready_at: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url_snapshot?: string | null
          completed_at?: string | null
          created_at?: string
          credits_charged_at?: string | null
          display_name_snapshot?: string
          duel_id: string
          id?: string
          joined_at?: string
          ready_at?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url_snapshot?: string | null
          completed_at?: string | null
          created_at?: string
          credits_charged_at?: string | null
          display_name_snapshot?: string
          duel_id?: string
          id?: string
          joined_at?: string
          ready_at?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_duel_participants_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_duel_speeches: {
        Row: {
          audio_storage_path: string | null
          created_at: string
          duel_id: string
          duration_seconds: number
          id: string
          metadata: Json
          participant_id: string
          round_number: number
          side: string
          speech_type: string
          transcript: string
          updated_at: string
        }
        Insert: {
          audio_storage_path?: string | null
          created_at?: string
          duel_id: string
          duration_seconds?: number
          id?: string
          metadata?: Json
          participant_id: string
          round_number: number
          side: string
          speech_type: string
          transcript?: string
          updated_at?: string
        }
        Update: {
          audio_storage_path?: string | null
          created_at?: string
          duel_id?: string
          duration_seconds?: number
          id?: string
          metadata?: Json
          participant_id?: string
          round_number?: number
          side?: string
          speech_type?: string
          transcript?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_duel_speeches_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_duel_speeches_duel_participant_fk"
            columns: ["duel_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "debate_duel_participants"
            referencedColumns: ["duel_id", "id"]
          },
          {
            foreignKeyName: "debate_duel_speeches_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "debate_duel_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_duels: {
        Row: {
          ai_opponent: boolean
          completed_at: string | null
          created_at: string
          creator_id: string
          creator_side_preference: string | null
          current_phase: string
          duel_kind: string
          entry_cost: number
          expires_at: string
          forfeited_by: string | null
          id: string
          integrity_status: string
          judge_dispatched_at: string | null
          opening_time_seconds: number
          outcome_reason: string | null
          phase_deadline: string | null
          phase_started_at: string | null
          practice_language: string
          practice_topic_key: string | null
          prep_time_seconds: number
          rated: boolean
          rating_excluded_reason: string | null
          rating_processed_at: string | null
          rebuttal_time_seconds: number
          share_code: string
          side_assignment_mode: string
          started_at: string | null
          stats_finalized_at: string | null
          status: string
          topic_category: string
          topic_category_key: string | null
          topic_description: string | null
          topic_difficulty: string
          topic_title: string
          updated_at: string
        }
        Insert: {
          ai_opponent?: boolean
          completed_at?: string | null
          created_at?: string
          creator_id: string
          creator_side_preference?: string | null
          current_phase?: string
          duel_kind?: string
          entry_cost?: number
          expires_at?: string
          forfeited_by?: string | null
          id?: string
          integrity_status?: string
          judge_dispatched_at?: string | null
          opening_time_seconds?: number
          outcome_reason?: string | null
          phase_deadline?: string | null
          phase_started_at?: string | null
          practice_language?: string
          practice_topic_key?: string | null
          prep_time_seconds?: number
          rated?: boolean
          rating_excluded_reason?: string | null
          rating_processed_at?: string | null
          rebuttal_time_seconds?: number
          share_code: string
          side_assignment_mode?: string
          started_at?: string | null
          stats_finalized_at?: string | null
          status?: string
          topic_category?: string
          topic_category_key?: string | null
          topic_description?: string | null
          topic_difficulty?: string
          topic_title: string
          updated_at?: string
        }
        Update: {
          ai_opponent?: boolean
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          creator_side_preference?: string | null
          current_phase?: string
          duel_kind?: string
          entry_cost?: number
          expires_at?: string
          forfeited_by?: string | null
          id?: string
          integrity_status?: string
          judge_dispatched_at?: string | null
          opening_time_seconds?: number
          outcome_reason?: string | null
          phase_deadline?: string | null
          phase_started_at?: string | null
          practice_language?: string
          practice_topic_key?: string | null
          prep_time_seconds?: number
          rated?: boolean
          rating_excluded_reason?: string | null
          rating_processed_at?: string | null
          rebuttal_time_seconds?: number
          share_code?: string
          side_assignment_mode?: string
          started_at?: string | null
          stats_finalized_at?: string | null
          status?: string
          topic_category?: string
          topic_category_key?: string | null
          topic_description?: string | null
          topic_difficulty?: string
          topic_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      debate_sessions: {
        Row: {
          ai_difficulty: string | null
          created_at: string
          duration_seconds: number
          feedback: Json
          id: string
          lesson_id: string | null
          mode: string
          overall_band: string
          practice_language: string
          practice_topic_key: string | null
          practice_track: string
          prep_notes: string | null
          prep_time: number
          rounds: Json | null
          side: string
          speech_time: number
          topic_category: string
          topic_category_key: string | null
          topic_difficulty: string | null
          topic_id: string | null
          topic_title: string
          total_score: number
          transcript: string | null
          user_id: string
        }
        Insert: {
          ai_difficulty?: string | null
          created_at?: string
          duration_seconds?: number
          feedback: Json
          id?: string
          lesson_id?: string | null
          mode: string
          overall_band: string
          practice_language?: string
          practice_topic_key?: string | null
          practice_track?: string
          prep_notes?: string | null
          prep_time: number
          rounds?: Json | null
          side: string
          speech_time: number
          topic_category: string
          topic_category_key?: string | null
          topic_difficulty?: string | null
          topic_id?: string | null
          topic_title: string
          total_score: number
          transcript?: string | null
          user_id: string
        }
        Update: {
          ai_difficulty?: string | null
          created_at?: string
          duration_seconds?: number
          feedback?: Json
          id?: string
          lesson_id?: string | null
          mode?: string
          overall_band?: string
          practice_language?: string
          practice_topic_key?: string | null
          practice_track?: string
          prep_notes?: string | null
          prep_time?: number
          rounds?: Json | null
          side?: string
          speech_time?: number
          topic_category?: string
          topic_category_key?: string | null
          topic_difficulty?: string | null
          topic_id?: string | null
          topic_title?: string
          total_score?: number
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_mmr_profiles: {
        Row: {
          created_at: string
          last_match_at: string | null
          losses: number
          matches_count: number
          provisional: boolean
          rating: number
          seed_snapshot: Json
          seed_source: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          last_match_at?: string | null
          losses?: number
          matches_count?: number
          provisional?: boolean
          rating?: number
          seed_snapshot?: Json
          seed_source?: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          last_match_at?: string | null
          losses?: number
          matches_count?: number
          provisional?: boolean
          rating?: number
          seed_snapshot?: Json
          seed_source?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      duel_rating_events: {
        Row: {
          created_at: string
          duel_id: string
          expected_score: number
          id: string
          integrity_status: string
          judge_confidence: number | null
          k_factor: number
          opponent_user_id: string
          rating_after: number
          rating_before: number
          rating_delta: number
          result: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duel_id: string
          expected_score: number
          id?: string
          integrity_status: string
          judge_confidence?: number | null
          k_factor: number
          opponent_user_id: string
          rating_after: number
          rating_before: number
          rating_delta: number
          result: string
          user_id: string
        }
        Update: {
          created_at?: string
          duel_id?: string
          expected_score?: number
          id?: string
          integrity_status?: string
          judge_confidence?: number | null
          k_factor?: number
          opponent_user_id?: string
          rating_after?: number
          rating_before?: number
          rating_delta?: number
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_rating_events_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "debate_duels"
            referencedColumns: ["id"]
          },
        ]
      }
      email_cron_runs: {
        Row: {
          candidate_users: number
          created_at: string
          error_message: string | null
          failed_count: number
          finished_at: string | null
          id: string
          job_key: string
          metadata: Json
          queued_count: number
          sent_count: number
          skipped_count: number
          started_at: string
          status: string
        }
        Insert: {
          candidate_users?: number
          created_at?: string
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          job_key?: string
          metadata?: Json
          queued_count?: number
          sent_count?: number
          skipped_count?: number
          started_at?: string
          status: string
        }
        Update: {
          candidate_users?: number
          created_at?: string
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          job_key?: string
          metadata?: Json
          queued_count?: number
          sent_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          bounced_at: string | null
          category: string
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          from_email: string
          id: string
          last_provider_event: string | null
          locale: string
          metadata: Json
          opened_at: string | null
          reply_to: string[]
          resend_email_id: string | null
          scheduled_for: string | null
          send_key: string
          sent_at: string | null
          skip_reason: string | null
          status: string
          subject: string
          suppressed_at: string | null
          tags: Json
          template_key: string
          to_email: string
          updated_at: string
          user_id: string | null
          variables: Json
        }
        Insert: {
          bounced_at?: string | null
          category: string
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_email: string
          id?: string
          last_provider_event?: string | null
          locale?: string
          metadata?: Json
          opened_at?: string | null
          reply_to?: string[]
          resend_email_id?: string | null
          scheduled_for?: string | null
          send_key: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          subject: string
          suppressed_at?: string | null
          tags?: Json
          template_key: string
          to_email: string
          updated_at?: string
          user_id?: string | null
          variables?: Json
        }
        Update: {
          bounced_at?: string | null
          category?: string
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_email?: string
          id?: string
          last_provider_event?: string | null
          locale?: string
          metadata?: Json
          opened_at?: string | null
          reply_to?: string[]
          resend_email_id?: string | null
          scheduled_for?: string | null
          send_key?: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          subject?: string
          suppressed_at?: string | null
          tags?: Json
          template_key?: string
          to_email?: string
          updated_at?: string
          user_id?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          email: string
          id: string
          metadata: Json
          reason: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          email: string
          id?: string
          metadata?: Json
          reason: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          email?: string
          id?: string
          metadata?: Json
          reason?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_template_override_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          fields: Json
          id: string
          locale: string
          metadata: Json
          previous_fields: Json | null
          template_key: string
          template_override_id: string | null
          version: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          fields?: Json
          id?: string
          locale?: string
          metadata?: Json
          previous_fields?: Json | null
          template_key: string
          template_override_id?: string | null
          version: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          fields?: Json
          id?: string
          locale?: string
          metadata?: Json
          previous_fields?: Json | null
          template_key?: string
          template_override_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_override_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_template_override_events_template_override_id_fkey"
            columns: ["template_override_id"]
            isOneToOne: false
            referencedRelation: "email_template_overrides"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_overrides: {
        Row: {
          created_at: string
          fields: Json
          id: string
          is_active: boolean
          locale: string
          template_key: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          is_active?: boolean
          locale?: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          is_active?: boolean
          locale?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_webhook_events: {
        Row: {
          created_at: string
          email_message_id: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          resend_email_id: string | null
          svix_id: string
        }
        Insert: {
          created_at?: string
          email_message_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          resend_email_id?: string | null
          svix_id: string
        }
        Update: {
          created_at?: string
          email_message_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          resend_email_id?: string | null
          svix_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_webhook_events_email_message_id_fkey"
            columns: ["email_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          id: string
          last_accessed_at: string
          progress_pct: number
          progress_percent: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          id?: string
          last_accessed_at?: string
          progress_pct?: number
          progress_percent?: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          id?: string
          last_accessed_at?: string
          progress_pct?: number
          progress_percent?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_attempt_sections: {
        Row: {
          attempt_id: string
          created_at: string
          deadline_at: string | null
          id: string
          label: string | null
          listening_section_id: string | null
          passage_id: string | null
          paused_at: string | null
          paused_seconds: number
          section_order: number
          skill: Database["public"]["Enums"]["ielts_skill"]
          started_at: string | null
          submitted_at: string | null
          time_limit_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          deadline_at?: string | null
          id?: string
          label?: string | null
          listening_section_id?: string | null
          passage_id?: string | null
          paused_at?: string | null
          paused_seconds?: number
          section_order?: number
          skill: Database["public"]["Enums"]["ielts_skill"]
          started_at?: string | null
          submitted_at?: string | null
          time_limit_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          deadline_at?: string | null
          id?: string
          label?: string | null
          listening_section_id?: string | null
          passage_id?: string | null
          paused_at?: string | null
          paused_seconds?: number
          section_order?: number
          skill?: Database["public"]["Enums"]["ielts_skill"]
          started_at?: string | null
          submitted_at?: string | null
          time_limit_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_attempt_sections_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_sections_listening_section_id_fkey"
            columns: ["listening_section_id"]
            isOneToOne: false
            referencedRelation: "listening_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_sections_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_sections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_attempts: {
        Row: {
          activity_attempt_id: string | null
          assignment_id: string | null
          attempt_number: number
          class_id: string | null
          club_id: string | null
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          module: Database["public"]["Enums"]["ielts_module"]
          started_at: string
          status: Database["public"]["Enums"]["ielts_attempt_status"]
          submitted_at: string | null
          test_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_attempt_id?: string | null
          assignment_id?: string | null
          attempt_number?: number
          class_id?: string | null
          club_id?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          module?: Database["public"]["Enums"]["ielts_module"]
          started_at?: string
          status?: Database["public"]["Enums"]["ielts_attempt_status"]
          submitted_at?: string | null
          test_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_attempt_id?: string | null
          assignment_id?: string | null
          attempt_number?: number
          class_id?: string | null
          club_id?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          module?: Database["public"]["Enums"]["ielts_module"]
          started_at?: string
          status?: Database["public"]["Enums"]["ielts_attempt_status"]
          submitted_at?: string | null
          test_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_attempts_activity_attempt_id_fkey"
            columns: ["activity_attempt_id"]
            isOneToOne: false
            referencedRelation: "activity_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_question_keys: {
        Row: {
          accept_variants: Json
          correct_answer: Json
          created_at: string
          examiner_notes: Json
          explanation_en: string | null
          explanation_vi: string | null
          model_answer: string | null
          question_id: string
          updated_at: string
        }
        Insert: {
          accept_variants?: Json
          correct_answer?: Json
          created_at?: string
          examiner_notes?: Json
          explanation_en?: string | null
          explanation_vi?: string | null
          model_answer?: string | null
          question_id: string
          updated_at?: string
        }
        Update: {
          accept_variants?: Json
          correct_answer?: Json
          created_at?: string
          examiner_notes?: Json
          explanation_en?: string | null
          explanation_vi?: string | null
          model_answer?: string | null
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_question_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_content_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["ielts_content_status"]
          test_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["ielts_content_status"]
          test_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["ielts_content_status"]
          test_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ielts_content_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_content_versions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_question_responses: {
        Row: {
          attempt_id: string
          awarded_points: number | null
          created_at: string
          graded_at: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          response: Json
          section_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          awarded_points?: number | null
          created_at?: string
          graded_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          response?: Json
          section_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          awarded_points?: number | null
          created_at?: string
          graded_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          response?: Json
          section_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_question_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_question_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_question_responses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempt_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_question_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_questions: {
        Row: {
          created_at: string
          group_instructions: string | null
          group_key: string | null
          id: string
          listening_section_id: string | null
          max_points: number
          metadata: Json
          options: Json
          order_index: number
          passage_id: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          skill: Database["public"]["Enums"]["ielts_skill"]
          test_id: string
          updated_at: string
          visual: Json | null
          word_limit: number | null
        }
        Insert: {
          created_at?: string
          group_instructions?: string | null
          group_key?: string | null
          id?: string
          listening_section_id?: string | null
          max_points?: number
          metadata?: Json
          options?: Json
          order_index?: number
          passage_id?: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          skill: Database["public"]["Enums"]["ielts_skill"]
          test_id: string
          updated_at?: string
          visual?: Json | null
          word_limit?: number | null
        }
        Update: {
          created_at?: string
          group_instructions?: string | null
          group_key?: string | null
          id?: string
          listening_section_id?: string | null
          max_points?: number
          metadata?: Json
          options?: Json
          order_index?: number
          passage_id?: string | null
          prompt?: string
          question_type?: Database["public"]["Enums"]["ielts_question_type"]
          skill?: Database["public"]["Enums"]["ielts_skill"]
          test_id?: string
          updated_at?: string
          visual?: Json | null
          word_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_questions_listening_section_id_fkey"
            columns: ["listening_section_id"]
            isOneToOne: false
            referencedRelation: "listening_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_questions_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_tests: {
        Row: {
          author_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["ielts_test_kind"]
          metadata: Json
          module: Database["public"]["Enums"]["ielts_module"]
          published_at: string | null
          qa_reviewer_id: string | null
          skill: Database["public"]["Enums"]["ielts_skill"] | null
          slug: string
          status: Database["public"]["Enums"]["ielts_content_status"]
          time_limit_seconds: number | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ielts_test_kind"]
          metadata?: Json
          module?: Database["public"]["Enums"]["ielts_module"]
          published_at?: string | null
          qa_reviewer_id?: string | null
          skill?: Database["public"]["Enums"]["ielts_skill"] | null
          slug: string
          status?: Database["public"]["Enums"]["ielts_content_status"]
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ielts_test_kind"]
          metadata?: Json
          module?: Database["public"]["Enums"]["ielts_module"]
          published_at?: string | null
          qa_reviewer_id?: string | null
          skill?: Database["public"]["Enums"]["ielts_skill"] | null
          slug?: string
          status?: Database["public"]["Enums"]["ielts_content_status"]
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ielts_tests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_tests_qa_reviewer_id_fkey"
            columns: ["qa_reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_admin_audit_log: {
        Row: {
          actor_user_id: string | null
          club_id: string | null
          created_at: string
          event_type: string
          flag_id: string | null
          id: string
          metadata: Json
          target_user_id: string | null
          xp_event_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id?: string | null
          created_at?: string
          event_type: string
          flag_id?: string | null
          id?: string
          metadata?: Json
          target_user_id?: string | null
          xp_event_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string | null
          created_at?: string
          event_type?: string
          flag_id?: string | null
          id?: string
          metadata?: Json
          target_user_id?: string | null
          xp_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_admin_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_admin_audit_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_admin_audit_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_admin_audit_log_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_xp_event_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_admin_audit_log_xp_event_id_fkey"
            columns: ["xp_event_id"]
            isOneToOne: false
            referencedRelation: "xp_events"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_kudos: {
        Row: {
          created_at: string
          id: string
          kudos_kind: string
          metadata: Json
          recipient_user_id: string
          season_id: string
          sender_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kudos_kind?: string
          metadata?: Json
          recipient_user_id: string
          season_id: string
          sender_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kudos_kind?: string
          metadata?: Json
          recipient_user_id?: string
          season_id?: string
          sender_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_kudos_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_kudos_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_kudos_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_privacy_settings: {
        Row: {
          allow_kudos: boolean
          created_at: string
          display_mode: string
          metadata: Json
          participate_in_leaderboards: boolean
          show_organization: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_kudos?: boolean
          created_at?: string
          display_mode?: string
          metadata?: Json
          participate_in_leaderboards?: boolean
          show_organization?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_kudos?: boolean
          created_at?: string
          display_mode?: string
          metadata?: Json
          participate_in_leaderboards?: boolean
          show_organization?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_season_results: {
        Row: {
          cohort_index: number
          final_rank: number
          final_zone: string
          leaderboard_language: string
          league_tier: string
          next_league_tier: string
          outcome: string
          resolved_at: string
          season_id: string
          season_xp: number
          user_id: string
        }
        Insert: {
          cohort_index: number
          final_rank: number
          final_zone: string
          leaderboard_language?: string
          league_tier: string
          next_league_tier: string
          outcome: string
          resolved_at?: string
          season_id: string
          season_xp?: number
          user_id: string
        }
        Update: {
          cohort_index?: number
          final_rank?: number
          final_zone?: string
          leaderboard_language?: string
          league_tier?: string
          next_league_tier?: string
          outcome?: string
          resolved_at?: string
          season_id?: string
          season_xp?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_season_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_season_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_season_user_cohorts: {
        Row: {
          assigned_at: string
          cohort_index: number
          cohort_key: string
          leaderboard_language: string
          league_tier: string
          previous_rank: number | null
          previous_zone: string | null
          season_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          cohort_index: number
          cohort_key: string
          leaderboard_language?: string
          league_tier: string
          previous_rank?: number | null
          previous_zone?: string | null
          season_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          cohort_index?: number
          cohort_key?: string
          leaderboard_language?: string
          league_tier?: string
          previous_rank?: number | null
          previous_zone?: string | null
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_season_user_cohorts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_season_user_cohorts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_user_leagues: {
        Row: {
          last_rank: number | null
          last_season_id: string | null
          last_zone: string | null
          leaderboard_language: string
          league_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_rank?: number | null
          last_season_id?: string | null
          last_zone?: string | null
          leaderboard_language?: string
          league_tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_rank?: number | null
          last_season_id?: string | null
          last_zone?: string | null
          leaderboard_language?: string
          league_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_user_leagues_last_season_id_fkey"
            columns: ["last_season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_user_leagues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_xp_event_flags: {
        Row: {
          created_at: string
          created_by: string | null
          flag_type: string
          id: string
          metadata: Json
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          season_id: string
          severity: string
          source: string
          status: string
          updated_at: string
          user_id: string
          xp_event_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flag_type: string
          id?: string
          metadata?: Json
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          season_id: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          xp_event_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flag_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          season_id?: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          xp_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_xp_event_flags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_xp_event_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_xp_event_flags_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_xp_event_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_xp_event_flags_xp_event_id_fkey"
            columns: ["xp_event_id"]
            isOneToOne: false
            referencedRelation: "xp_events"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          lesson_id: string
          quiz_answers: Json | null
          score: number | null
          status: string
          time_spent_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          lesson_id: string
          quiz_answers?: Json | null
          score?: number | null
          status?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          quiz_answers?: Json | null
          score?: number | null
          status?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_body: string | null
          course_id: string
          created_at: string
          estimated_minutes: number | null
          id: string
          is_published: boolean
          lesson_type: string
          module_id: string
          practice_config: Json | null
          quiz_config: Json | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          content_body?: string | null
          course_id: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          lesson_type: string
          module_id: string
          practice_config?: Json | null
          quiz_config?: Json | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          content_body?: string | null
          course_id?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          lesson_type?: string
          module_id?: string
          practice_config?: Json | null
          quiz_config?: Json | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_sections: {
        Row: {
          accent: Database["public"]["Enums"]["ielts_accent"]
          audio_asset_id: string | null
          created_at: string
          id: string
          metadata: Json
          order_index: number
          script: string
          section_number: number
          speakers: Json
          test_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          accent?: Database["public"]["Enums"]["ielts_accent"]
          audio_asset_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_index?: number
          script: string
          section_number: number
          speakers?: Json
          test_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          accent?: Database["public"]["Enums"]["ielts_accent"]
          audio_asset_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_index?: number
          script?: string
          section_number?: number
          speakers?: Json
          test_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_sections_audio_asset_id_fkey"
            columns: ["audio_asset_id"]
            isOneToOne: false
            referencedRelation: "audio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listening_sections_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      orb_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orb_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passages: {
        Row: {
          body: string
          created_at: string
          genre: string | null
          id: string
          metadata: Json
          order_index: number
          test_id: string
          title: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          body: string
          created_at?: string
          genre?: string | null
          id?: string
          metadata?: Json
          order_index?: number
          test_id: string
          title: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          body?: string
          created_at?: string
          genre?: string | null
          id?: string
          metadata?: Json
          order_index?: number
          test_id?: string
          title?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "passages_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          kind: string
          metadata: Json
          plan_type: string | null
          processed: boolean
          provider: string
          provider_ref: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          kind?: string
          metadata?: Json
          plan_type?: string | null
          processed?: boolean
          provider: string
          provider_ref?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          kind?: string
          metadata?: Json
          plan_type?: string | null
          processed?: boolean
          provider?: string
          provider_ref?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_attempts: {
        Row: {
          assignment_id: string | null
          class_id: string | null
          club_id: string | null
          created_at: string
          duration_seconds: number | null
          evidence: Json
          format: string | null
          id: string
          model_name: string | null
          occurred_at: string
          overall_band: string | null
          overall_score: number | null
          practice_track: string
          rubric_key: string
          rubric_version: number
          skill_scores: Json
          source_id: string
          source_type: string
          submission_id: string | null
          topic_category: string | null
          topic_difficulty: string | null
          topic_title: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          assignment_id?: string | null
          class_id?: string | null
          club_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          evidence?: Json
          format?: string | null
          id?: string
          model_name?: string | null
          occurred_at?: string
          overall_band?: string | null
          overall_score?: number | null
          practice_track?: string
          rubric_key?: string
          rubric_version?: number
          skill_scores?: Json
          source_id: string
          source_type?: string
          submission_id?: string | null
          topic_category?: string | null
          topic_difficulty?: string | null
          topic_title?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          assignment_id?: string | null
          class_id?: string | null
          club_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          evidence?: Json
          format?: string | null
          id?: string
          model_name?: string | null
          occurred_at?: string
          overall_band?: string | null
          overall_score?: number | null
          practice_track?: string
          rubric_key?: string
          rubric_version?: number
          skill_scores?: Json
          source_id?: string
          source_type?: string
          submission_id?: string | null
          topic_category?: string | null
          topic_difficulty?: string | null
          topic_title?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "club_assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          ai_difficulty: string | null
          attempt_snapshot: Json
          audio_storage_path: string | null
          completed_at: string | null
          created_at: string
          duration_seconds: number
          error_code: string | null
          error_message: string | null
          feedback: Json | null
          id: string
          input_hash: string | null
          legacy_debate_session_id: string | null
          mode: string
          model_name: string | null
          model_provider: string | null
          overall_band: string | null
          practice_language: string
          practice_topic_key: string | null
          practice_track: string
          prep_notes: string | null
          prep_time: number
          prompt_bundle_key: string
          prompt_bundle_version: number
          prompt_hash: string | null
          rounds: Json | null
          rubric_key: string
          rubric_version: number
          side: string
          speech_time: number
          status: string
          submitted_at: string | null
          topic_category: string
          topic_category_key: string | null
          topic_difficulty: string
          topic_id: string | null
          topic_title: string
          total_score: number | null
          transcript: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_difficulty?: string | null
          attempt_snapshot?: Json
          audio_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number
          error_code?: string | null
          error_message?: string | null
          feedback?: Json | null
          id?: string
          input_hash?: string | null
          legacy_debate_session_id?: string | null
          mode?: string
          model_name?: string | null
          model_provider?: string | null
          overall_band?: string | null
          practice_language?: string
          practice_topic_key?: string | null
          practice_track?: string
          prep_notes?: string | null
          prep_time?: number
          prompt_bundle_key?: string
          prompt_bundle_version?: number
          prompt_hash?: string | null
          rounds?: Json | null
          rubric_key?: string
          rubric_version?: number
          side: string
          speech_time?: number
          status?: string
          submitted_at?: string | null
          topic_category?: string
          topic_category_key?: string | null
          topic_difficulty?: string
          topic_id?: string | null
          topic_title: string
          total_score?: number | null
          transcript?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_difficulty?: string | null
          attempt_snapshot?: Json
          audio_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number
          error_code?: string | null
          error_message?: string | null
          feedback?: Json | null
          id?: string
          input_hash?: string | null
          legacy_debate_session_id?: string | null
          mode?: string
          model_name?: string | null
          model_provider?: string | null
          overall_band?: string | null
          practice_language?: string
          practice_topic_key?: string | null
          practice_track?: string
          prep_notes?: string | null
          prep_time?: number
          prompt_bundle_key?: string
          prompt_bundle_version?: number
          prompt_hash?: string | null
          rounds?: Json | null
          rubric_key?: string
          rubric_version?: number
          side?: string
          speech_time?: number
          status?: string
          submitted_at?: string | null
          topic_category?: string
          topic_category_key?: string | null
          topic_difficulty?: string
          topic_id?: string | null
          topic_title?: string
          total_score?: number | null
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_legacy_debate_session_id_fkey"
            columns: ["legacy_debate_session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_session_drafts: {
        Row: {
          ai_difficulty: string | null
          created_at: string
          current_phase: string
          current_round: number
          id: string
          mode: string
          practice_language: string
          practice_topic_key: string | null
          practice_track: string
          prep_notes: string
          prep_time: number
          rounds: Json | null
          session_started_at: string | null
          side: string
          speech_time: number
          topic_category: string
          topic_category_key: string | null
          topic_difficulty: string
          topic_id: string | null
          topic_title: string
          transcript: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_difficulty?: string | null
          created_at?: string
          current_phase?: string
          current_round?: number
          id?: string
          mode: string
          practice_language?: string
          practice_topic_key?: string | null
          practice_track: string
          prep_notes?: string
          prep_time?: number
          rounds?: Json | null
          session_started_at?: string | null
          side: string
          speech_time?: number
          topic_category: string
          topic_category_key?: string | null
          topic_difficulty?: string
          topic_id?: string | null
          topic_title: string
          transcript?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_difficulty?: string | null
          created_at?: string
          current_phase?: string
          current_round?: number
          id?: string
          mode?: string
          practice_language?: string
          practice_topic_key?: string | null
          practice_track?: string
          prep_notes?: string
          prep_time?: number
          rounds?: Json | null
          session_started_at?: string | null
          side?: string
          speech_time?: number
          topic_category?: string
          topic_category_key?: string | null
          topic_difficulty?: string
          topic_id?: string | null
          topic_title?: string
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_topic_category_translations: {
        Row: {
          category_key: string
          created_at: string
          display_order: number
          label: string
          language: string
          updated_at: string
        }
        Insert: {
          category_key: string
          created_at?: string
          display_order?: number
          label: string
          language: string
          updated_at?: string
        }
        Update: {
          category_key?: string
          created_at?: string
          display_order?: number
          label?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_topic_sources: {
        Row: {
          created_at: string
          id: string
          info_slide: string | null
          raw_motion_hash: string
          raw_motion_text: string
          round_label: string | null
          scraped_at: string
          source_language: string
          source_motion_index: number
          source_page_type: string
          source_slug: string
          source_tag: string | null
          source_url: string
          stage_label: string | null
          stats: Json
          topic_key: string
          tournament_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          info_slide?: string | null
          raw_motion_hash: string
          raw_motion_text: string
          round_label?: string | null
          scraped_at?: string
          source_language: string
          source_motion_index: number
          source_page_type: string
          source_slug: string
          source_tag?: string | null
          source_url: string
          stage_label?: string | null
          stats?: Json
          topic_key: string
          tournament_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          info_slide?: string | null
          raw_motion_hash?: string
          raw_motion_text?: string
          round_label?: string | null
          scraped_at?: string
          source_language?: string
          source_motion_index?: number
          source_page_type?: string
          source_slug?: string
          source_tag?: string | null
          source_url?: string
          stage_label?: string | null
          stats?: Json
          topic_key?: string
          tournament_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_topic_sources_topic_key_fkey"
            columns: ["topic_key"]
            isOneToOne: false
            referencedRelation: "active_practice_topic_catalog"
            referencedColumns: ["topic_key"]
          },
          {
            foreignKeyName: "practice_topic_sources_topic_key_fkey"
            columns: ["topic_key"]
            isOneToOne: false
            referencedRelation: "practice_topics"
            referencedColumns: ["topic_key"]
          },
        ]
      }
      practice_topic_translations: {
        Row: {
          context: string | null
          created_at: string
          language: string
          suggested_points: Json
          title: string
          topic_key: string
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          language: string
          suggested_points?: Json
          title: string
          topic_key: string
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          language?: string
          suggested_points?: Json
          title?: string
          topic_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_topic_translations_topic_key_fkey"
            columns: ["topic_key"]
            isOneToOne: false
            referencedRelation: "active_practice_topic_catalog"
            referencedColumns: ["topic_key"]
          },
          {
            foreignKeyName: "practice_topic_translations_topic_key_fkey"
            columns: ["topic_key"]
            isOneToOne: false
            referencedRelation: "practice_topics"
            referencedColumns: ["topic_key"]
          },
        ]
      }
      practice_topics: {
        Row: {
          category_key: string
          created_at: string
          difficulty: string
          display_order: number
          is_active: boolean
          metadata: Json
          normalized_title_hash: string | null
          source_kind: string
          source_language: string | null
          topic_key: string
          updated_at: string
        }
        Insert: {
          category_key: string
          created_at?: string
          difficulty: string
          display_order?: number
          is_active?: boolean
          metadata?: Json
          normalized_title_hash?: string | null
          source_kind?: string
          source_language?: string | null
          topic_key: string
          updated_at?: string
        }
        Update: {
          category_key?: string
          created_at?: string
          difficulty?: string
          display_order?: number
          is_active?: boolean
          metadata?: Json
          normalized_title_hash?: string | null
          source_kind?: string
          source_language?: string | null
          topic_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          metadata: Json
          reason: string | null
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          metadata?: Json
          reason?: string | null
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          metadata?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_connections: {
        Row: {
          id: string
          metadata: Json
          recipient_user_id: string
          removed_at: string | null
          requested_at: string
          requester_user_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          metadata?: Json
          recipient_user_id: string
          removed_at?: string | null
          requested_at?: string
          requester_user_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          metadata?: Json
          recipient_user_id?: string
          removed_at?: string | null
          requested_at?: string
          requester_user_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_connections_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_connections_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_featured_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          sort_order: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_featured_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_featured_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_friend_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          metadata: Json
          rotated_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          metadata?: Json
          rotated_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          metadata?: Json
          rotated_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_friend_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_privacy_settings: {
        Row: {
          achievements_visibility: string
          activities_visibility: string
          allow_connection_requests: boolean
          analytics_visibility: string
          created_at: string
          friend_code_discovery_enabled: boolean
          metadata: Json
          organization_visibility: string
          profile_visibility: string
          searchable_by_handle: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements_visibility?: string
          activities_visibility?: string
          allow_connection_requests?: boolean
          analytics_visibility?: string
          created_at?: string
          friend_code_discovery_enabled?: boolean
          metadata?: Json
          organization_visibility?: string
          profile_visibility?: string
          searchable_by_handle?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements_visibility?: string
          activities_visibility?: string
          allow_connection_requests?: boolean
          analytics_visibility?: string
          created_at?: string
          friend_code_discovery_enabled?: boolean
          metadata?: Json
          organization_visibility?: string
          profile_visibility?: string
          searchable_by_handle?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          metadata: Json
          reason: string
          reported_user_id: string
          reporter_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          metadata?: Json
          reason: string
          reported_user_id: string
          reporter_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          metadata?: Json
          reason?: string
          reported_user_id?: string
          reporter_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_social_audit_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_social_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_social_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_color: string | null
          bio: string | null
          created_at: string
          display_name: string
          email: string | null
          handle: string | null
          id: string
          level: number
          onboarding_completed: boolean
          orb_balance: number
          preferences: Json | null
          profile_status: string | null
          referral_code: string | null
          referred_by: string | null
          role: string
          selected_title: string | null
          streak_current: number
          streak_last_active_date: string | null
          streak_longest: number
          total_practice_minutes: number
          total_sessions_completed: number
          unlocked_titles: string[] | null
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          handle?: string | null
          id: string
          level?: number
          onboarding_completed?: boolean
          orb_balance?: number
          preferences?: Json | null
          profile_status?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          selected_title?: string | null
          streak_current?: number
          streak_last_active_date?: string | null
          streak_longest?: number
          total_practice_minutes?: number
          total_sessions_completed?: number
          unlocked_titles?: string[] | null
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          handle?: string | null
          id?: string
          level?: number
          onboarding_completed?: boolean
          orb_balance?: number
          preferences?: Json | null
          profile_status?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          selected_title?: string | null
          streak_current?: number
          streak_last_active_date?: string | null
          streak_longest?: number
          total_practice_minutes?: number
          total_sessions_completed?: number
          unlocked_titles?: string[] | null
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string | null
          explanation: string | null
          id: string
          lesson_id: string
          options: Json | null
          points: number
          question_text: string
          question_type: string
          sort_order: number
        }
        Insert: {
          correct_answer?: string | null
          explanation?: string | null
          id?: string
          lesson_id: string
          options?: Json | null
          points?: number
          question_text: string
          question_type: string
          sort_order?: number
        }
        Update: {
          correct_answer?: string | null
          explanation?: string | null
          id?: string
          lesson_id?: string
          options?: Json | null
          points?: number
          question_text?: string
          question_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          credited_at: string | null
          id: string
          qualified_at: string | null
          referee_id: string
          referee_orbs_awarded: number
          referrer_id: string
          referrer_orbs_awarded: number
          status: string
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          id?: string
          qualified_at?: string | null
          referee_id: string
          referee_orbs_awarded?: number
          referrer_id: string
          referrer_orbs_awarded?: number
          status?: string
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          id?: string
          qualified_at?: string | null
          referee_id?: string
          referee_orbs_awarded?: number
          referrer_id?: string
          referrer_orbs_awarded?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_customer_mappings: {
        Row: {
          aliases: Json
          app_user_id: string
          canonical_user_id: string | null
          created_at: string
          first_seen_at: string
          id: string
          is_anonymous: boolean
          last_seen_at: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          aliases?: Json
          app_user_id: string
          canonical_user_id?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          is_anonymous?: boolean
          last_seen_at?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          aliases?: Json
          app_user_id?: string
          canonical_user_id?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          is_anonymous?: boolean
          last_seen_at?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_customer_mappings_canonical_user_id_fkey"
            columns: ["canonical_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_popup_campaigns: {
        Row: {
          campaign_type: string
          cooldown_hours: number
          copy_en: Json
          copy_vi: Json
          created_at: string
          created_by: string | null
          cta_href: string
          daily_cap_per_user: number
          delivery_mode: string
          ends_at: string | null
          id: string
          image_path: string
          key: string
          max_impressions_per_user: number
          metadata: Json
          priority: number
          published_at: string | null
          published_by: string | null
          response_goal: number | null
          reward_credits: number
          rules: Json
          starts_at: string | null
          status: string
          surface: string
          updated_at: string
          updated_by: string | null
          weekly_cap_per_user: number
        }
        Insert: {
          campaign_type?: string
          cooldown_hours?: number
          copy_en?: Json
          copy_vi?: Json
          created_at?: string
          created_by?: string | null
          cta_href: string
          daily_cap_per_user?: number
          delivery_mode?: string
          ends_at?: string | null
          id?: string
          image_path: string
          key: string
          max_impressions_per_user?: number
          metadata?: Json
          priority?: number
          published_at?: string | null
          published_by?: string | null
          response_goal?: number | null
          reward_credits?: number
          rules?: Json
          starts_at?: string | null
          status?: string
          surface?: string
          updated_at?: string
          updated_by?: string | null
          weekly_cap_per_user?: number
        }
        Update: {
          campaign_type?: string
          cooldown_hours?: number
          copy_en?: Json
          copy_vi?: Json
          created_at?: string
          created_by?: string | null
          cta_href?: string
          daily_cap_per_user?: number
          delivery_mode?: string
          ends_at?: string | null
          id?: string
          image_path?: string
          key?: string
          max_impressions_per_user?: number
          metadata?: Json
          priority?: number
          published_at?: string | null
          published_by?: string | null
          response_goal?: number | null
          reward_credits?: number
          rules?: Json
          starts_at?: string | null
          status?: string
          surface?: string
          updated_at?: string
          updated_by?: string | null
          weekly_cap_per_user?: number
        }
        Relationships: [
          {
            foreignKeyName: "smart_popup_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_popup_campaigns_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_popup_campaigns_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_popup_cron_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          generated_opportunities: number
          id: string
          job_key: string
          metadata: Json
          processed_users: number
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          generated_opportunities?: number
          id?: string
          job_key?: string
          metadata?: Json
          processed_users?: number
          started_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          generated_opportunities?: number
          id?: string
          job_key?: string
          metadata?: Json
          processed_users?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      smart_popup_events: {
        Row: {
          campaign_key: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          route: string | null
          surface: string
          user_id: string
        }
        Insert: {
          campaign_key: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          route?: string | null
          surface?: string
          user_id: string
        }
        Update: {
          campaign_key?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          route?: string | null
          surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_popup_events_campaign_key_fkey"
            columns: ["campaign_key"]
            isOneToOne: false
            referencedRelation: "smart_popup_campaigns"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "smart_popup_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_popup_survey_responses: {
        Row: {
          answers: Json
          campaign_key: string
          context: Json
          created_at: string
          id: string
          impression_event_id: string | null
          locale: string
          reward_credits_awarded: number
          rewarded_at: string | null
          submission_key: string
          submitted_at: string
          survey_version_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          campaign_key: string
          context?: Json
          created_at?: string
          id?: string
          impression_event_id?: string | null
          locale?: string
          reward_credits_awarded?: number
          rewarded_at?: string | null
          submission_key: string
          submitted_at?: string
          survey_version_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          campaign_key?: string
          context?: Json
          created_at?: string
          id?: string
          impression_event_id?: string | null
          locale?: string
          reward_credits_awarded?: number
          rewarded_at?: string | null
          submission_key?: string
          submitted_at?: string
          survey_version_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_popup_survey_responses_campaign_key_fkey"
            columns: ["campaign_key"]
            isOneToOne: false
            referencedRelation: "smart_popup_campaigns"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "smart_popup_survey_responses_impression_event_id_fkey"
            columns: ["impression_event_id"]
            isOneToOne: false
            referencedRelation: "smart_popup_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_popup_survey_responses_survey_version_id_fkey"
            columns: ["survey_version_id"]
            isOneToOne: false
            referencedRelation: "smart_popup_survey_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_popup_survey_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_popup_survey_versions: {
        Row: {
          campaign_key: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          questions: Json
          thank_you_copy: Json
          version: number
        }
        Insert: {
          campaign_key: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          questions?: Json
          thank_you_copy?: Json
          version?: number
        }
        Update: {
          campaign_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          questions?: Json
          thank_you_copy?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "smart_popup_survey_versions_campaign_key_fkey"
            columns: ["campaign_key"]
            isOneToOne: false
            referencedRelation: "smart_popup_campaigns"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "smart_popup_survey_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_popup_user_state: {
        Row: {
          campaign_state: Json
          created_at: string
          last_refreshed_at: string | null
          segment: string
          traits: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_state?: Json
          created_at?: string
          last_refreshed_at?: string | null
          segment?: string
          traits?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_state?: Json
          created_at?: string
          last_refreshed_at?: string | null
          segment?: string
          traits?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_popup_user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_responses: {
        Row: {
          attempt_id: string
          audio_storage_path: string | null
          created_at: string
          feedback: Json
          feedback_language: string
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          model_name: string | null
          model_provider: string | null
          part_number: number | null
          phoneme_report: Json
          prompt_bundle_key: string | null
          prompt_bundle_version: number | null
          pronunciation_band: number | null
          question_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          scored_at: string | null
          speaking_band: number | null
          status: Database["public"]["Enums"]["ielts_response_status"]
          stt_provider: string | null
          transcript: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          audio_storage_path?: string | null
          created_at?: string
          feedback?: Json
          feedback_language?: string
          fluency_coherence_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_resource_band?: number | null
          model_name?: string | null
          model_provider?: string | null
          part_number?: number | null
          phoneme_report?: Json
          prompt_bundle_key?: string | null
          prompt_bundle_version?: number | null
          pronunciation_band?: number | null
          question_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          scored_at?: string | null
          speaking_band?: number | null
          status?: Database["public"]["Enums"]["ielts_response_status"]
          stt_provider?: string | null
          transcript?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          audio_storage_path?: string | null
          created_at?: string
          feedback?: Json
          feedback_language?: string
          fluency_coherence_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_resource_band?: number | null
          model_name?: string | null
          model_provider?: string | null
          part_number?: number | null
          phoneme_report?: Json
          prompt_bundle_key?: string | null
          prompt_bundle_version?: number | null
          pronunciation_band?: number | null
          question_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          scored_at?: string | null
          speaking_band?: number | null
          status?: Database["public"]["Enums"]["ielts_response_status"]
          stt_provider?: string | null
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_responses_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stt_repair_shadow_runs: {
        Row: {
          admin_notes: string | null
          analysis_job_id: string | null
          audio_storage_path: string | null
          baseline_transcript_hash: string
          created_at: string
          debate_session_id: string | null
          edits: Json
          hallucination_risk: number
          id: string
          judge_transcript: string | null
          judge_transcript_hash: string | null
          metrics: Json
          practice_attempt_id: string | null
          practice_language: string
          practice_track: string
          raw_transcript_hash: string
          repair_latency_ms: number
          repair_mode: string
          repair_model: string
          repair_provider: string
          repair_status: string
          repair_version: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          score_after: number | null
          score_before: number | null
          score_delta: number | null
          side: string | null
          soft_cap_reasons: string[]
          source_route: string
          topic_title: string | null
          uncertain_spans: Json
          updated_at: string
          user_id: string | null
          warnings: string[]
        }
        Insert: {
          admin_notes?: string | null
          analysis_job_id?: string | null
          audio_storage_path?: string | null
          baseline_transcript_hash: string
          created_at?: string
          debate_session_id?: string | null
          edits?: Json
          hallucination_risk?: number
          id?: string
          judge_transcript?: string | null
          judge_transcript_hash?: string | null
          metrics?: Json
          practice_attempt_id?: string | null
          practice_language?: string
          practice_track?: string
          raw_transcript_hash: string
          repair_latency_ms?: number
          repair_mode?: string
          repair_model?: string
          repair_provider?: string
          repair_status?: string
          repair_version?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_after?: number | null
          score_before?: number | null
          score_delta?: number | null
          side?: string | null
          soft_cap_reasons?: string[]
          source_route?: string
          topic_title?: string | null
          uncertain_spans?: Json
          updated_at?: string
          user_id?: string | null
          warnings?: string[]
        }
        Update: {
          admin_notes?: string | null
          analysis_job_id?: string | null
          audio_storage_path?: string | null
          baseline_transcript_hash?: string
          created_at?: string
          debate_session_id?: string | null
          edits?: Json
          hallucination_risk?: number
          id?: string
          judge_transcript?: string | null
          judge_transcript_hash?: string | null
          metrics?: Json
          practice_attempt_id?: string | null
          practice_language?: string
          practice_track?: string
          raw_transcript_hash?: string
          repair_latency_ms?: number
          repair_mode?: string
          repair_model?: string
          repair_provider?: string
          repair_status?: string
          repair_version?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_after?: number | null
          score_before?: number | null
          score_delta?: number | null
          side?: string | null
          soft_cap_reasons?: string[]
          source_route?: string
          topic_title?: string | null
          uncertain_spans?: Json
          updated_at?: string
          user_id?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "stt_repair_shadow_runs_analysis_job_id_fkey"
            columns: ["analysis_job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stt_repair_shadow_runs_debate_session_id_fkey"
            columns: ["debate_session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stt_repair_shadow_runs_practice_attempt_id_fkey"
            columns: ["practice_attempt_id"]
            isOneToOne: false
            referencedRelation: "practice_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stt_repair_shadow_runs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stt_repair_shadow_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_paid: number | null
          billing_cycle: string | null
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          last_webhook_event_at: string | null
          metadata: Json
          plan_type: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          last_webhook_event_at?: string | null
          metadata?: Json
          plan_type?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          last_webhook_event_at?: string | null
          metadata?: Json
          plan_type?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_issue_reports: {
        Row: {
          attachments: Json
          contact_permission: string | null
          created_at: string
          description: string | null
          environment: Json
          expected_behavior: string | null
          hidden_fields: Json
          id: string
          issue_type: string | null
          locale: string | null
          raw_payload: Json
          route: string | null
          severity: string | null
          source: string
          status: string
          steps_to_reproduce: string | null
          submitted_at: string | null
          tally_event_id: string
          tally_form_id: string | null
          tally_form_name: string | null
          tally_response_id: string | null
          tally_submission_id: string | null
          title: string | null
          updated_at: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          attachments?: Json
          contact_permission?: string | null
          created_at?: string
          description?: string | null
          environment?: Json
          expected_behavior?: string | null
          hidden_fields?: Json
          id?: string
          issue_type?: string | null
          locale?: string | null
          raw_payload?: Json
          route?: string | null
          severity?: string | null
          source?: string
          status?: string
          steps_to_reproduce?: string | null
          submitted_at?: string | null
          tally_event_id: string
          tally_form_id?: string | null
          tally_form_name?: string | null
          tally_response_id?: string | null
          tally_submission_id?: string | null
          title?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          attachments?: Json
          contact_permission?: string | null
          created_at?: string
          description?: string | null
          environment?: Json
          expected_behavior?: string | null
          hidden_fields?: Json
          id?: string
          issue_type?: string | null
          locale?: string | null
          raw_payload?: Json
          route?: string | null
          severity?: string | null
          source?: string
          status?: string
          steps_to_reproduce?: string | null
          submitted_at?: string | null
          tally_event_id?: string
          tally_form_id?: string | null
          tally_form_name?: string | null
          tally_response_id?: string | null
          tally_submission_id?: string | null
          title?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_issue_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_usage: {
        Row: {
          created_at: string
          feature_name: string
          id: string
          last_used_at: string | null
          limit_count: number | null
          metadata: Json
          period_end: string
          period_start: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_name: string
          id?: string
          last_used_at?: string | null
          limit_count?: number | null
          metadata?: Json
          period_end: string
          period_start: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature_name?: string
          id?: string
          last_used_at?: string | null
          limit_count?: number | null
          metadata?: Json
          period_end?: string
          period_start?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          geo_city: string | null
          geo_country: string | null
          geo_lat: number | null
          geo_lon: number | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_seen_at: string | null
          session_end: string | null
          session_start: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_seen_at?: string | null
          session_end?: string | null
          session_start?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_seen_at?: string | null
          session_end?: string | null
          session_start?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      writing_responses: {
        Row: {
          attempt_id: string
          coherence_cohesion_band: number | null
          created_at: string
          essay: string
          feedback_language: string
          grammar_band: number | null
          id: string
          inline_corrections: Json
          lexical_resource_band: number | null
          model_answer: string | null
          model_name: string | null
          model_provider: string | null
          paragraph_feedback: Json
          prompt_bundle_key: string | null
          prompt_bundle_version: number | null
          question_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          scored_at: string | null
          status: Database["public"]["Enums"]["ielts_response_status"]
          task_band: number | null
          task_number: number
          task_response_band: number | null
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          attempt_id: string
          coherence_cohesion_band?: number | null
          created_at?: string
          essay?: string
          feedback_language?: string
          grammar_band?: number | null
          id?: string
          inline_corrections?: Json
          lexical_resource_band?: number | null
          model_answer?: string | null
          model_name?: string | null
          model_provider?: string | null
          paragraph_feedback?: Json
          prompt_bundle_key?: string | null
          prompt_bundle_version?: number | null
          question_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          scored_at?: string | null
          status?: Database["public"]["Enums"]["ielts_response_status"]
          task_band?: number | null
          task_number?: number
          task_response_band?: number | null
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          attempt_id?: string
          coherence_cohesion_band?: number | null
          created_at?: string
          essay?: string
          feedback_language?: string
          grammar_band?: number | null
          id?: string
          inline_corrections?: Json
          lexical_resource_band?: number | null
          model_answer?: string | null
          model_name?: string | null
          model_provider?: string | null
          paragraph_feedback?: Json
          prompt_bundle_key?: string | null
          prompt_bundle_version?: number | null
          question_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          scored_at?: string | null
          status?: Database["public"]["Enums"]["ielts_response_status"]
          task_band?: number | null
          task_number?: number
          task_response_band?: number | null
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "writing_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writing_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writing_responses_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writing_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          activity_type: string | null
          class_id: string | null
          club_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          leaderboard_language: string | null
          lifetime_xp: number
          metadata: Json
          occurred_at: string
          reference_type: string | null
          season_id: string
          season_xp: number
          source_id: string | null
          source_type: string
          user_id: string
          xp_category: string
        }
        Insert: {
          activity_type?: string | null
          class_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          leaderboard_language?: string | null
          lifetime_xp?: number
          metadata?: Json
          occurred_at?: string
          reference_type?: string | null
          season_id: string
          season_xp?: number
          source_id?: string | null
          source_type: string
          user_id: string
          xp_category: string
        }
        Update: {
          activity_type?: string | null
          class_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          leaderboard_language?: string | null
          lifetime_xp?: number
          metadata?: Json
          occurred_at?: string
          reference_type?: string | null
          season_id?: string
          season_xp?: number
          source_id?: string | null
          source_type?: string
          user_id?: string
          xp_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_legacy_baselines: {
        Row: {
          baseline_level: number
          baseline_xp: number
          captured_at: string
          user_id: string
        }
        Insert: {
          baseline_level?: number
          baseline_xp?: number
          captured_at?: string
          user_id: string
        }
        Update: {
          baseline_level?: number
          baseline_xp?: number
          captured_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_legacy_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_season_org_totals: {
        Row: {
          active_member_count: number
          category_breakdown: Json
          contributing_user_count: number
          event_count: number
          last_event_at: string | null
          leaderboard_language: string
          normalized_xp: number
          organization_id: string
          organization_type: string
          season_id: string
          season_xp: number
          updated_at: string
        }
        Insert: {
          active_member_count?: number
          category_breakdown?: Json
          contributing_user_count?: number
          event_count?: number
          last_event_at?: string | null
          leaderboard_language?: string
          normalized_xp?: number
          organization_id: string
          organization_type: string
          season_id: string
          season_xp?: number
          updated_at?: string
        }
        Update: {
          active_member_count?: number
          category_breakdown?: Json
          contributing_user_count?: number
          event_count?: number
          last_event_at?: string | null
          leaderboard_language?: string
          normalized_xp?: number
          organization_id?: string
          organization_type?: string
          season_id?: string
          season_xp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_season_org_totals_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_season_user_totals: {
        Row: {
          category_breakdown: Json
          event_count: number
          last_event_at: string | null
          leaderboard_language: string
          lifetime_xp: number
          season_id: string
          season_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_breakdown?: Json
          event_count?: number
          last_event_at?: string | null
          leaderboard_language?: string
          lifetime_xp?: number
          season_id: string
          season_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_breakdown?: Json
          event_count?: number
          last_event_at?: string | null
          leaderboard_language?: string
          lifetime_xp?: number
          season_id?: string
          season_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_season_user_totals_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "xp_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_season_user_totals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          metadata: Json
          season_key: string
          season_type: string
          starts_at: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          metadata?: Json
          season_key: string
          season_type?: string
          starts_at: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          metadata?: Json
          season_key?: string
          season_type?: string
          starts_at?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_practice_topic_catalog: {
        Row: {
          category_key: string | null
          context: string | null
          difficulty: string | null
          display_order: number | null
          has_info_slide: boolean | null
          has_stats: boolean | null
          language: string | null
          metadata: Json | null
          normalized_title_hash: string | null
          source_count: number | null
          source_kind: string | null
          source_language: string | null
          sources: Json | null
          suggested_points: Json | null
          title: string | null
          topic_key: string | null
        }
        Relationships: []
      }
      admin_class_list_rows: {
        Row: {
          assigned_course_count: number | null
          attendance_rate_30d: number | null
          club_id: string | null
          club_name: string | null
          code: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          grade_level: string | null
          id: string | null
          max_students: number | null
          meeting_schedule: string | null
          program_type: string | null
          room: string | null
          schedule_count: number | null
          session_count_30d: number | null
          start_date: string | null
          status: string | null
          student_count: number | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_club_assignment_rows: {
        Row: {
          assigned_track: string | null
          assignment_type: string | null
          average_score: number | null
          class_id: string | null
          class_title: string | null
          club_id: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string | null
          required_attempts: number | null
          rubric_key: string | null
          rubric_version: number | null
          status: string | null
          submission_count: number | null
          title: string | null
          topic_category: string | null
          topic_title: string | null
          unique_submitters: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_club_list_rows: {
        Row: {
          assignment_count: number | null
          attendance_rate_30d: number | null
          average_score_30d: number | null
          city: string | null
          class_count: number | null
          club_type: string | null
          coach_count: number | null
          code: string | null
          completion_rate_30d: number | null
          country: string | null
          created_at: string | null
          facebook_url: string | null
          id: string | null
          instagram_url: string | null
          logo_storage_path: string | null
          logo_url: string | null
          name: string | null
          review_queue_count: number | null
          status: string | null
          student_count: number | null
          threads_url: string | null
          timezone: string | null
          upcoming_event_count: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      admin_course_list_rows: {
        Row: {
          assigned_class_count: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          enrollment_count: number | null
          estimated_hours: number | null
          id: string | null
          is_archived: boolean | null
          is_free: boolean | null
          is_published: boolean | null
          metadata: Json | null
          short_description: string | null
          slug: string | null
          sort_order: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          visibility: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_popular_courses: {
        Row: {
          course_id: string | null
          enrollment_count: number | null
          title: string | null
        }
        Relationships: []
      }
      monthly_usage_summary: {
        Row: {
          model: string | null
          month: string | null
          service: string | null
          total_cost_usd: number | null
          total_input: number | null
          total_output: number | null
          total_requests: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_ielts_question_with_key: {
        Args: {
          p_accept_variants?: Json
          p_correct_answer?: Json
          p_examiner_notes?: Json
          p_explanation_en?: string
          p_explanation_vi?: string
          p_group_instructions?: string
          p_group_key?: string
          p_listening_section_id?: string
          p_max_points?: number
          p_metadata?: Json
          p_model_answer?: string
          p_options?: Json
          p_order_index?: number
          p_passage_id?: string
          p_prompt: string
          p_question_type: Database["public"]["Enums"]["ielts_question_type"]
          p_skill: Database["public"]["Enums"]["ielts_skill"]
          p_test_id: string
          p_visual?: Json
          p_word_limit?: number
        }
        Returns: {
          created_at: string
          group_instructions: string | null
          group_key: string | null
          id: string
          listening_section_id: string | null
          max_points: number
          metadata: Json
          options: Json
          order_index: number
          passage_id: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          skill: Database["public"]["Enums"]["ielts_skill"]
          test_id: string
          updated_at: string
          visual: Json | null
          word_limit: number | null
        }
      }
      update_ielts_question_with_key: {
        Args: {
          p_accept_variants?: Json
          p_correct_answer?: Json
          p_examiner_notes?: Json
          p_explanation_en?: string
          p_explanation_vi?: string
          p_group_instructions?: string
          p_group_key?: string
          p_listening_section_id?: string
          p_max_points?: number
          p_metadata?: Json
          p_model_answer?: string
          p_options?: Json
          p_order_index?: number
          p_passage_id?: string
          p_prompt: string
          p_question_id: string
          p_question_type: Database["public"]["Enums"]["ielts_question_type"]
          p_skill: Database["public"]["Enums"]["ielts_skill"]
          p_visual?: Json
          p_word_limit?: number
        }
        Returns: {
          created_at: string
          group_instructions: string | null
          group_key: string | null
          id: string
          listening_section_id: string | null
          max_points: number
          metadata: Json
          options: Json
          order_index: number
          passage_id: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          skill: Database["public"]["Enums"]["ielts_skill"]
          test_id: string
          updated_at: string
          visual: Json | null
          word_limit: number | null
        }
      }
      adjust_orb_balance: {
        Args: {
          p_amount: number
          p_reference_id?: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      advance_overdue_debate_duels: { Args: never; Returns: number }
      apply_subscription_from_webhook: {
        Args: {
          p_amount_paid: number
          p_billing_cycle: string
          p_cancel_at_period_end: boolean
          p_currency: string
          p_current_period_end: string
          p_current_period_start: string
          p_event_at: string
          p_plan_type: string
          p_provider: string
          p_provider_customer_id: string
          p_provider_subscription_id: string
          p_status: string
          p_trial_end_date: string
          p_user_id: string
        }
        Returns: string
      }
      award_xp_event: {
        Args: {
          p_activity_type?: string
          p_class_id?: string
          p_club_id?: string
          p_idempotency_key: string
          p_leaderboard_language?: string
          p_lifetime_xp?: number
          p_metadata?: Json
          p_minutes?: number
          p_occurred_at?: string
          p_reference_type?: string
          p_score?: number
          p_season_xp?: number
          p_sessions?: number
          p_source_id?: string
          p_source_type: string
          p_user_id: string
          p_xp_category: string
        }
        Returns: {
          event_id: string
          inserted: boolean
          lifetime_xp_awarded: number
          season_id: string
          season_xp_awarded: number
        }[]
      }
      backfill_legacy_xp_events: {
        Args: { p_since?: string }
        Returns: {
          inserted_count: number
        }[]
      }
      block_profile: { Args: { p_target_user_id: string }; Returns: Json }
      can_access_duel: {
        Args: { p_duel_id: string; p_user_id: string }
        Returns: boolean
      }
      cancel_debate_duel_matchmaking: {
        Args: { p_actor_user_id: string; p_ticket_id: string }
        Returns: string
      }
      cancel_profile_connection: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      claim_club_join_code: {
        Args: { p_code: string }
        Returns: {
          club_id: string
          membership_id: string
          message: string
          status: string
        }[]
      }
      claim_payment_transaction: {
        Args: {
          p_amount: number
          p_billing_cycle: string
          p_currency: string
          p_idempotency_key: string
          p_kind: string
          p_metadata: Json
          p_plan_type: string
          p_provider: string
          p_provider_ref: string
          p_user_id: string
        }
        Returns: string
      }
      close_leaderboard_season: {
        Args: { p_leaderboard_language?: string; p_season_id: string }
        Returns: {
          resolved_count: number
        }[]
      }
      consume_rate_limit: {
        Args: { p_limit: number; p_scope: string; p_window_seconds: number }
        Returns: Json
      }
      create_ai_backfill_duel: {
        Args: {
          p_ai_user_id: string
          p_human_user_id: string
          p_opening_time_seconds: number
          p_practice_language: string
          p_practice_topic_key: string
          p_prep_time_seconds: number
          p_rebuttal_time_seconds: number
          p_topic_category: string
          p_topic_category_key: string
          p_topic_description: string
          p_topic_difficulty: string
          p_topic_title: string
        }
        Returns: string
      }
      credit_referral: { Args: { p_referral_id: string }; Returns: undefined }
      dispatch_overdue_duel_judging: { Args: never; Returns: number }
      duel_phase_duration: {
        Args: {
          p_opening_time_seconds: number
          p_phase: string
          p_prep_time_seconds: number
          p_rebuttal_time_seconds: number
        }
        Returns: number
      }
      ensure_duel_mmr_profile: {
        Args: {
          p_seed_rating: number
          p_seed_snapshot?: Json
          p_seed_source: string
          p_user_id: string
        }
        Returns: undefined
      }
      enter_debate_duel_matchmaking: {
        Args: {
          p_actor_user_id: string
          p_opening_time_seconds?: number
          p_practice_language?: string
          p_practice_topic_key: string
          p_prep_time_seconds?: number
          p_rebuttal_time_seconds?: number
          p_topic_category: string
          p_topic_category_key: string
          p_topic_description: string
          p_topic_difficulty: string
          p_topic_title: string
        }
        Returns: string
      }
      finalize_debate_duel_stats: {
        Args: { p_duel_id: string; p_duration_minutes: number; p_xp: number }
        Returns: undefined
      }
      finalize_payment_transaction: {
        Args: {
          p_idempotency_key: string
          p_provider: string
          p_provider_ref: string
          p_status: string
          p_subscription_id: string
        }
        Returns: undefined
      }
      flag_leaderboard_xp_event: {
        Args: {
          p_flag_type: string
          p_reason?: string
          p_severity?: string
          p_status?: string
          p_xp_event_id: string
        }
        Returns: Json
      }
      forfeit_debate_duel: {
        Args: { p_actor_user_id: string; p_share_code: string }
        Returns: string
      }
      forfeit_debate_duel_internal: {
        Args: { p_duel_id: string; p_forfeiter_user_id: string }
        Returns: string
      }
      generate_duel_share_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_leaderboard_page_data: {
        Args: { p_leaderboard_language?: string; p_user_id?: string }
        Returns: Json
      }
      get_leaderboard_page_data_v2: {
        Args: { p_leaderboard_language?: string; p_user_id?: string }
        Returns: Json
      }
      get_leaderboard_privacy_settings: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      get_leaderboard_rollout_metrics: {
        Args: { p_since?: string }
        Returns: Json
      }
      get_leaderboard_safety_audit: {
        Args: { p_club_id?: string; p_limit?: number }
        Returns: Json
      }
      get_profile_achievements: {
        Args: {
          p_handle?: string
          p_leaderboard_language?: string
          p_target_user_id?: string
        }
        Returns: Json
      }
      get_profile_activity_feed: {
        Args: {
          p_handle?: string
          p_leaderboard_language?: string
          p_limit?: number
          p_target_user_id?: string
        }
        Returns: Json
      }
      get_profile_analytics_summary: {
        Args: {
          p_handle?: string
          p_leaderboard_language?: string
          p_range?: string
          p_target_user_id?: string
        }
        Returns: Json
      }
      get_profile_connection_center: { Args: never; Returns: Json }
      get_profile_discovery_suggestions: {
        Args: { p_limit?: number }
        Returns: Json
      }
      get_profile_public_data: {
        Args: {
          p_handle?: string
          p_leaderboard_language?: string
          p_target_user_id?: string
        }
        Returns: Json
      }
      get_profile_self_shell: {
        Args: { p_leaderboard_language?: string }
        Returns: Json
      }
      get_profile_social_guardrails: {
        Args: { p_limit?: number }
        Returns: Json
      }
      get_skill_breakdown: { Args: { p_user_id: string }; Returns: Json }
      grant_feedback_popup_reward: {
        Args: { p_amount?: number; p_response_id: string; p_user_id: string }
        Returns: number
      }
      ielts_pause_attempt_section: {
        Args: { p_section_id: string }
        Returns: undefined
      }
      ielts_record_question_response: {
        Args: { p_question_id: string; p_response: Json; p_section_id: string }
        Returns: string
      }
      ielts_resume_attempt_section: {
        Args: { p_section_id: string }
        Returns: string
      }
      ielts_start_attempt_section: {
        Args: { p_section_id: string }
        Returns: string
      }
      ielts_submit_attempt_section: {
        Args: { p_section_id: string }
        Returns: string
      }
      increment_feature_usage: {
        Args: {
          p_amount: number
          p_feature: string
          p_limit: number
          p_period_end: string
          p_period_start: string
          p_user_id: string
        }
        Returns: {
          allowed: boolean
          limit_count: number
          used_count: number
        }[]
      }
      increment_xp: {
        Args: { amount: number; user_id: string }
        Returns: undefined
      }
      join_debate_duel: {
        Args: { p_actor_user_id: string; p_share_code: string }
        Returns: string
      }
      mark_payment_webhook_event: {
        Args: {
          p_error: string
          p_event_id: string
          p_provider: string
          p_status: string
        }
        Returns: undefined
      }
      match_debate_corpus_items: {
        Args: {
          match_count?: number
          match_dimensions?: number
          match_language?: string
          match_model?: string
          match_provider?: string
          match_review_statuses?: string[]
          match_usable_for?: string
          min_confidence?: number
          query_embedding: string
        }
        Returns: {
          canonical_match_id: string
          canonical_match_key: string
          confidence: number
          content: Json
          embedding_text: string
          evidence_status: string
          item_id: string
          item_type: string
          language: string
          motion_vi: string
          review_status: string
          side: string
          similarity: number
          usable_for: string[]
        }[]
      }
      process_debate_duel_forfeit_internal: {
        Args: { p_duel_id: string; p_forfeiter_user_id: string }
        Returns: boolean
      }
      process_debate_duel_rating: {
        Args: { p_duel_id: string }
        Returns: boolean
      }
      process_debate_duel_rating_internal: {
        Args: { p_duel_id: string }
        Returns: boolean
      }
      qualify_and_credit_referral: {
        Args: { p_referee_id: string; p_transcript_word_count: number }
        Returns: undefined
      }
      recalculate_course_progress: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: undefined
      }
      record_payment_webhook_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_payload: Json
          p_provider: string
          p_user_id: string
        }
        Returns: string
      }
      refresh_leaderboard_org_totals: {
        Args: { p_leaderboard_language?: string; p_season_id: string }
        Returns: {
          refreshed_count: number
        }[]
      }
      refresh_leaderboard_season_cohorts: {
        Args: { p_leaderboard_language?: string; p_season_id?: string }
        Returns: {
          assigned_count: number
        }[]
      }
      release_payment_transaction: {
        Args: { p_idempotency_key: string; p_provider: string }
        Returns: undefined
      }
      remove_profile_connection: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      report_profile: {
        Args: { p_details?: string; p_reason: string; p_target_user_id: string }
        Returns: Json
      }
      request_profile_connection: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      resolve_leaderboard_xp_event_flag: {
        Args: { p_flag_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      respond_to_profile_connection: {
        Args: { p_requester_user_id: string; p_response: string }
        Returns: Json
      }
      rotate_profile_friend_code: { Args: never; Returns: Json }
      search_profile_discovery: {
        Args: { p_leaderboard_language?: string; p_query: string }
        Returns: Json
      }
      send_leaderboard_kudos: {
        Args: {
          p_kudos_kind?: string
          p_recipient_user_id: string
          p_season_id: string
        }
        Returns: {
          kudos_id: string
          message: string
          status: string
        }[]
      }
      set_debate_duel_ready: {
        Args: {
          p_actor_user_id: string
          p_ready: boolean
          p_share_code: string
        }
        Returns: string
      }
      set_profile_featured_achievements: {
        Args: { p_achievement_ids: string[] }
        Returns: Json
      }
      start_debate_duel: {
        Args: { p_actor_user_id: string; p_share_code: string }
        Returns: string
      }
      store_debate_duel_judgment: {
        Args: {
          p_confidence: number
          p_duel_id: string
          p_judge_model: string
          p_summary: string
          p_verdict: Json
          p_winner_participant_id: string
          p_winner_side: string
        }
        Returns: undefined
      }
      submit_ai_duel_speech: {
        Args: {
          p_duel_id: string
          p_duration_seconds: number
          p_round_number: number
          p_transcript: string
        }
        Returns: string
      }
      unblock_profile: { Args: { p_target_user_id: string }; Returns: Json }
      update_leaderboard_privacy_settings: {
        Args: {
          p_allow_kudos: boolean
          p_display_mode: string
          p_participate_in_leaderboards: boolean
          p_show_organization: boolean
        }
        Returns: Json
      }
      update_streak: { Args: { p_user_id: string }; Returns: undefined }
      upsert_daily_stats:
        | {
            Args: {
              p_minutes?: number
              p_sessions?: number
              p_user_id: string
              p_xp?: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_minutes?: number
              p_score?: number
              p_sessions?: number
              p_user_id: string
              p_xp?: number
            }
            Returns: undefined
          }
    }
    Enums: {
      ielts_accent: "uk" | "us" | "aus" | "other"
      ielts_attempt_status:
        | "in_progress"
        | "submitted"
        | "scoring"
        | "completed"
        | "expired"
        | "abandoned"
      ielts_audio_status: "pending" | "generating" | "ready" | "failed"
      ielts_content_status:
        | "draft"
        | "in_qa"
        | "approved"
        | "published"
        | "archived"
      ielts_module: "academic" | "general_training"
      ielts_question_type:
        | "mcq_single"
        | "mcq_multi"
        | "true_false_notgiven"
        | "yes_no_notgiven"
        | "matching_headings"
        | "matching_information"
        | "matching_features"
        | "sentence_completion"
        | "summary_completion"
        | "note_table_form_flowchart_completion"
        | "short_answer"
        | "diagram_label"
        | "map_plan_label"
        | "writing_task1_academic"
        | "writing_task1_general"
        | "writing_task2_essay"
        | "speaking_part1"
        | "speaking_part2_cuecard"
        | "speaking_part3"
      ielts_response_status:
        | "pending"
        | "scoring"
        | "scored"
        | "failed"
        | "overridden"
      ielts_skill: "listening" | "reading" | "writing" | "speaking"
      ielts_test_kind: "full_mock" | "skill_set" | "drill"
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
      ielts_accent: ["uk", "us", "aus", "other"],
      ielts_attempt_status: [
        "in_progress",
        "submitted",
        "scoring",
        "completed",
        "expired",
        "abandoned",
      ],
      ielts_audio_status: ["pending", "generating", "ready", "failed"],
      ielts_content_status: [
        "draft",
        "in_qa",
        "approved",
        "published",
        "archived",
      ],
      ielts_module: ["academic", "general_training"],
      ielts_question_type: [
        "mcq_single",
        "mcq_multi",
        "true_false_notgiven",
        "yes_no_notgiven",
        "matching_headings",
        "matching_information",
        "matching_features",
        "sentence_completion",
        "summary_completion",
        "note_table_form_flowchart_completion",
        "short_answer",
        "diagram_label",
        "map_plan_label",
        "writing_task1_academic",
        "writing_task1_general",
        "writing_task2_essay",
        "speaking_part1",
        "speaking_part2_cuecard",
        "speaking_part3",
      ],
      ielts_response_status: [
        "pending",
        "scoring",
        "scored",
        "failed",
        "overridden",
      ],
      ielts_skill: ["listening", "reading", "writing", "speaking"],
      ielts_test_kind: ["full_mock", "skill_set", "drill"],
    },
  },
} as const
