export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Project-authored activity discriminator. Supabase generates the underlying
// column as `string`; this overlay keeps application code exhaustive.
export type ActivityType =
  | "lesson"
  | "quiz"
  | "matching"
  | "fill_blank"
  | "drag_order"
  | "flashcard"
  | "ielts_vocab_collocation"
  | "ielts_paraphrase_transform"
  | "ielts_gap_fill"
  | "ielts_tfng_reasoning"
  | "ielts_scan_detail"
  | "ielts_sentence_transform"
  | "ielts_cohesion_linker"

export type IeltsMicroDraftActivityType = Extract<
  ActivityType,
  | "ielts_vocab_collocation"
  | "ielts_paraphrase_transform"
  | "ielts_gap_fill"
  | "ielts_tfng_reasoning"
  | "ielts_scan_detail"
  | "ielts_sentence_transform"
  | "ielts_cohesion_linker"
>

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
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
      age_assurance_audit_events: {
        Row: {
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          previous_state: Json
          reason: string
          target_user_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          previous_state: Json
          reason: string
          target_user_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          previous_state?: Json
          reason?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "age_assurance_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "age_assurance_audit_events_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_coach_turns: {
        Row: {
          assistant_message_id: string | null
          attempt_count: number
          claim_token: string | null
          client_request_id: string
          completed_at: string | null
          conversation_id: string
          created_at: string
          error_code: string | null
          id: string
          lease_expires_at: string | null
          product_context: string
          request_hash: string
          response_metadata: Json
          response_text: string | null
          status: string
          updated_at: string
          user_id: string
          user_message_id: string | null
        }
        Insert: {
          assistant_message_id?: string | null
          attempt_count?: number
          claim_token?: string | null
          client_request_id: string
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          error_code?: string | null
          id?: string
          lease_expires_at?: string | null
          product_context: string
          request_hash: string
          response_metadata?: Json
          response_text?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_message_id?: string | null
        }
        Update: {
          assistant_message_id?: string | null
          attempt_count?: number
          claim_token?: string | null
          client_request_id?: string
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          error_code?: string | null
          id?: string
          lease_expires_at?: string | null
          product_context?: string
          request_hash?: string
          response_metadata?: Json
          response_text?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_turns_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_coach_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_coach_turns_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_benchmark_release_attestations: {
        Row: {
          benchmark_id: string
          created_at: string
          envelope: Json
          expires_at: string
          key_id: string
          signature_base64: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          benchmark_id: string
          created_at?: string
          envelope: Json
          expires_at: string
          key_id: string
          signature_base64: string
          updated_at?: string
          verified_at: string
        }
        Update: {
          benchmark_id?: string
          created_at?: string
          envelope?: Json
          expires_at?: string
          key_id?: string
          signature_base64?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_benchmark_release_attestations_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: true
            referencedRelation: "ai_grading_benchmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_benchmark_run_claims: {
        Row: {
          benchmark_id: string
          claim_attempt_count: number
          claim_token: string | null
          corpus_version: number
          created_at: string
          grader_version: string
          last_error_code: string | null
          lease_expires_at: string | null
          pipeline_stage: string
          provider_request_id: string | null
          provisional_provider_request_id: string | null
          run_kind: string
          status: string
          updated_at: string
        }
        Insert: {
          benchmark_id: string
          claim_attempt_count?: number
          claim_token?: string | null
          corpus_version: number
          created_at?: string
          grader_version: string
          last_error_code?: string | null
          lease_expires_at?: string | null
          pipeline_stage: string
          provider_request_id?: string | null
          provisional_provider_request_id?: string | null
          run_kind: string
          status: string
          updated_at?: string
        }
        Update: {
          benchmark_id?: string
          claim_attempt_count?: number
          claim_token?: string | null
          corpus_version?: number
          created_at?: string
          grader_version?: string
          last_error_code?: string | null
          lease_expires_at?: string | null
          pipeline_stage?: string
          provider_request_id?: string | null
          provisional_provider_request_id?: string | null
          run_kind?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_benchmark_run_clai_provisional_provider_request_fkey"
            columns: ["provisional_provider_request_id"]
            isOneToOne: false
            referencedRelation: "ai_provider_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_benchmark_run_claims_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_benchmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_benchmark_run_claims_provider_request_id_fkey"
            columns: ["provider_request_id"]
            isOneToOne: false
            referencedRelation: "ai_provider_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_benchmark_withdrawals: {
        Row: {
          actor_kind: string
          benchmark_id: string
          created_at: string
          id: string
          reason_code: string
          receipt_sha256: string
          study_actor_key: string
          verified_receipt_id: string | null
          withdrawn_at: string
        }
        Insert: {
          actor_kind: string
          benchmark_id: string
          created_at?: string
          id?: string
          reason_code: string
          receipt_sha256: string
          study_actor_key: string
          verified_receipt_id?: string | null
          withdrawn_at?: string
        }
        Update: {
          actor_kind?: string
          benchmark_id?: string
          created_at?: string
          id?: string
          reason_code?: string
          receipt_sha256?: string
          study_actor_key?: string
          verified_receipt_id?: string | null
          withdrawn_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_benchmark_withdrawals_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: true
            referencedRelation: "ai_grading_benchmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_benchmark_withdrawals_verified_receipt_id_fkey"
            columns: ["verified_receipt_id"]
            isOneToOne: true
            referencedRelation: "ai_grading_verified_withdrawal_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_benchmarks: {
        Row: {
          accent_group: string | null
          band_or_score_range: string | null
          benchmark_key: string
          collection_id: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          protected_label: Json
          skill: string
          source_id: string | null
          split: string
          task_type: string | null
          updated_at: string
        }
        Insert: {
          accent_group?: string | null
          band_or_score_range?: string | null
          benchmark_key: string
          collection_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          protected_label: Json
          skill: string
          source_id?: string | null
          split?: string
          task_type?: string | null
          updated_at?: string
        }
        Update: {
          accent_group?: string | null
          band_or_score_range?: string | null
          benchmark_key?: string
          collection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          protected_label?: Json
          skill?: string
          source_id?: string | null
          split?: string
          task_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_benchmarks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_benchmarks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_checkpoints: {
        Row: {
          created_at: string
          last_provider_failed_at: string | null
          last_provider_failure_claim_token: string | null
          last_provider_failure_kind: string | null
          output_hash: string | null
          output_payload: Json | null
          output_version: number | null
          prepared_hash: string | null
          prepared_payload: Json | null
          provider_attempt_count_at_output: number | null
          provider_attempt_count_at_provisional: number | null
          provider_claim_token: string | null
          provider_completed_at: string | null
          provider_failure_count: number
          provider_retry_ordinal: number
          provider_started_at: string | null
          provisional_claim_token: string | null
          provisional_completed_at: string | null
          provisional_hash: string | null
          provisional_payload: Json | null
          provisional_version: number | null
          provisional_workflow_attempt: number | null
          updated_at: string
          workflow_run_id: string
        }
        Insert: {
          created_at?: string
          last_provider_failed_at?: string | null
          last_provider_failure_claim_token?: string | null
          last_provider_failure_kind?: string | null
          output_hash?: string | null
          output_payload?: Json | null
          output_version?: number | null
          prepared_hash?: string | null
          prepared_payload?: Json | null
          provider_attempt_count_at_output?: number | null
          provider_attempt_count_at_provisional?: number | null
          provider_claim_token?: string | null
          provider_completed_at?: string | null
          provider_failure_count?: number
          provider_retry_ordinal?: number
          provider_started_at?: string | null
          provisional_claim_token?: string | null
          provisional_completed_at?: string | null
          provisional_hash?: string | null
          provisional_payload?: Json | null
          provisional_version?: number | null
          provisional_workflow_attempt?: number | null
          updated_at?: string
          workflow_run_id: string
        }
        Update: {
          created_at?: string
          last_provider_failed_at?: string | null
          last_provider_failure_claim_token?: string | null
          last_provider_failure_kind?: string | null
          output_hash?: string | null
          output_payload?: Json | null
          output_version?: number | null
          prepared_hash?: string | null
          prepared_payload?: Json | null
          provider_attempt_count_at_output?: number | null
          provider_attempt_count_at_provisional?: number | null
          provider_claim_token?: string | null
          provider_completed_at?: string | null
          provider_failure_count?: number
          provider_retry_ordinal?: number
          provider_started_at?: string | null
          provisional_claim_token?: string | null
          provisional_completed_at?: string | null
          provisional_hash?: string | null
          provisional_payload?: Json | null
          provisional_version?: number | null
          provisional_workflow_attempt?: number | null
          updated_at?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_checkpoints_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: true
            referencedRelation: "ai_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_evaluation_runs: {
        Row: {
          completed_at: string
          created_at: string
          evaluation_id: string
          id: string
          model: string
          prediction: Json
          provider: string
          provider_request_id: string
          run_kind: string
          started_at: string
          trace_id: string
        }
        Insert: {
          completed_at: string
          created_at?: string
          evaluation_id: string
          id?: string
          model: string
          prediction: Json
          provider: string
          provider_request_id: string
          run_kind: string
          started_at: string
          trace_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          model?: string
          prediction?: Json
          provider?: string
          provider_request_id?: string
          run_kind?: string
          started_at?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_evaluation_runs_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_evaluation_runs_provider_request_id_fkey"
            columns: ["provider_request_id"]
            isOneToOne: true
            referencedRelation: "ai_provider_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_evaluations: {
        Row: {
          benchmark_id: string
          corpus_version: number
          created_at: string
          grader_version: string
          id: string
          metrics: Json
          prediction: Json
          run_metadata: Json
        }
        Insert: {
          benchmark_id: string
          corpus_version: number
          created_at?: string
          grader_version: string
          id?: string
          metrics?: Json
          prediction: Json
          run_metadata?: Json
        }
        Update: {
          benchmark_id?: string
          corpus_version?: number
          created_at?: string
          grader_version?: string
          id?: string
          metrics?: Json
          prediction?: Json
          run_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_evaluations_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_benchmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_operational_claims: {
        Row: {
          declared_at: string
          evidence_id: string
          id: string
          injection_token: string
          scenario: string
          workflow_run_id: string
        }
        Insert: {
          declared_at?: string
          evidence_id: string
          id?: string
          injection_token?: string
          scenario: string
          workflow_run_id: string
        }
        Update: {
          declared_at?: string
          evidence_id?: string
          id?: string
          injection_token?: string
          scenario?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_operational_claims_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_operational_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_operational_claims_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: true
            referencedRelation: "ai_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_operational_evidence: {
        Row: {
          corpus_version: number
          created_at: string
          deployment_id: string
          environment: string
          evidence_hash: string | null
          expires_at: string | null
          grader_version: string
          id: string
          image_digest: string
          run_id: string
          started_at: string
          status: string
          verified_at: string | null
        }
        Insert: {
          corpus_version: number
          created_at?: string
          deployment_id: string
          environment: string
          evidence_hash?: string | null
          expires_at?: string | null
          grader_version: string
          id?: string
          image_digest: string
          run_id: string
          started_at?: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          corpus_version?: number
          created_at?: string
          deployment_id?: string
          environment?: string
          evidence_hash?: string | null
          expires_at?: string | null
          grader_version?: string
          id?: string
          image_digest?: string
          run_id?: string
          started_at?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      ai_grading_operational_scenarios: {
        Row: {
          claim_id: string
          details_hash: string
          evidence_id: string
          expected_provider_calls: number
          finalized_at: string
          id: string
          invalid_authoritative_citation_count: number
          observed_provider_calls: number
          passed: boolean
          scenario: string
          terminal_status: string
          workflow_run_id: string
        }
        Insert: {
          claim_id: string
          details_hash: string
          evidence_id: string
          expected_provider_calls: number
          finalized_at?: string
          id?: string
          invalid_authoritative_citation_count?: number
          observed_provider_calls: number
          passed: boolean
          scenario: string
          terminal_status: string
          workflow_run_id: string
        }
        Update: {
          claim_id?: string
          details_hash?: string
          evidence_id?: string
          expected_provider_calls?: number
          finalized_at?: string
          id?: string
          invalid_authoritative_citation_count?: number
          observed_provider_calls?: number
          passed?: boolean
          scenario?: string
          terminal_status?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_operational_scenarios_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "ai_grading_operational_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_operational_scenarios_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_operational_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_operational_scenarios_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: true
            referencedRelation: "ai_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_operational_transitions: {
        Row: {
          claim_token: string
          created_at: string
          event_type: string
          id: string
          workflow_run_id: string
        }
        Insert: {
          claim_token: string
          created_at?: string
          event_type: string
          id?: string
          workflow_run_id: string
        }
        Update: {
          claim_token?: string
          created_at?: string
          event_type?: string
          id?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_operational_transitions_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_runtime_attestations: {
        Row: {
          attested_at: string
          claim_token: string
          corpus_version: number
          grader_version: string
          id: string
          image_digest: string
          runtime_revision: string
          workflow_run_id: string
        }
        Insert: {
          attested_at?: string
          claim_token: string
          corpus_version: number
          grader_version: string
          id?: string
          image_digest: string
          runtime_revision: string
          workflow_run_id: string
        }
        Update: {
          attested_at?: string
          claim_token?: string
          corpus_version?: number
          grader_version?: string
          id?: string
          image_digest?: string
          runtime_revision?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_runtime_attestations_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_verified_withdrawal_receipts: {
        Row: {
          actor_kind: string
          benchmark_id: string
          created_at: string
          expires_at: string | null
          id: string
          legacy_operator_profile_sha256: string | null
          operator_key_id: string | null
          operator_signature_base64: string | null
          reason_code: string
          receipt_sha256: string
          request_key: string
          signed_payload: Json | null
          signed_payload_sha256: string | null
          study_actor_key: string
          verification_version: string
          verified_at: string
        }
        Insert: {
          actor_kind: string
          benchmark_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          legacy_operator_profile_sha256?: string | null
          operator_key_id?: string | null
          operator_signature_base64?: string | null
          reason_code: string
          receipt_sha256: string
          request_key: string
          signed_payload?: Json | null
          signed_payload_sha256?: string | null
          study_actor_key: string
          verification_version?: string
          verified_at: string
        }
        Update: {
          actor_kind?: string
          benchmark_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          legacy_operator_profile_sha256?: string | null
          operator_key_id?: string | null
          operator_signature_base64?: string | null
          reason_code?: string
          receipt_sha256?: string
          request_key?: string
          signed_payload?: Json | null
          signed_payload_sha256?: string | null
          study_actor_key?: string
          verification_version?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_verified_withdrawal_receipts_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_benchmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_verified_withdrawal_receipts_operator_key_id_fkey"
            columns: ["operator_key_id"]
            isOneToOne: false
            referencedRelation: "ai_grading_withdrawal_operator_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_withdrawal_operator_key_revocations: {
        Row: {
          created_at: string
          operator_key_id: string
          reason_code: string
          revocation_receipt_sha256: string
          revoked_at: string
          revoked_by_profile_id: string
        }
        Insert: {
          created_at?: string
          operator_key_id: string
          reason_code: string
          revocation_receipt_sha256: string
          revoked_at: string
          revoked_by_profile_id: string
        }
        Update: {
          created_at?: string
          operator_key_id?: string
          reason_code?: string
          revocation_receipt_sha256?: string
          revoked_at?: string
          revoked_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_withdrawal_operator_key_r_revoked_by_profile_id_fkey"
            columns: ["revoked_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_withdrawal_operator_key_revocat_operator_key_id_fkey"
            columns: ["operator_key_id"]
            isOneToOne: true
            referencedRelation: "ai_grading_withdrawal_operator_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_grading_withdrawal_operator_keys: {
        Row: {
          created_at: string
          credential_receipt_sha256: string
          credential_verified_at: string
          credential_verified_by_profile_id: string
          expires_at: string
          id: string
          key_id: string
          operator_profile_id: string
          public_key_base64: string
          signature_algorithm: string
          valid_from: string
        }
        Insert: {
          created_at?: string
          credential_receipt_sha256: string
          credential_verified_at: string
          credential_verified_by_profile_id: string
          expires_at: string
          id?: string
          key_id: string
          operator_profile_id: string
          public_key_base64: string
          signature_algorithm?: string
          valid_from: string
        }
        Update: {
          created_at?: string
          credential_receipt_sha256?: string
          credential_verified_at?: string
          credential_verified_by_profile_id?: string
          expires_at?: string
          id?: string
          key_id?: string
          operator_profile_id?: string
          public_key_base64?: string
          signature_algorithm?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_withdrawal_operato_credential_verified_by_profi_fkey"
            columns: ["credential_verified_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_withdrawal_operator_keys_operator_profile_id_fkey"
            columns: ["operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_collection_versions: {
        Row: {
          collection_id: string
          created_at: string
          import_key: string | null
          published_at: string | null
          published_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          import_key?: string | null
          published_at?: string | null
          published_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          import_key?: string | null
          published_at?: string | null
          published_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_collection_versions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_collection_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_collection_versions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_collection_versions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_collections: {
        Row: {
          active_version: number
          created_at: string
          domain: string
          embedding_dimensions: number
          embedding_model: string
          embedding_provider: string
          id: string
          is_active: boolean
          language: string
          retrieval_thresholds: Json
          slug: string
          updated_at: string
        }
        Insert: {
          active_version?: number
          created_at?: string
          domain: string
          embedding_dimensions?: number
          embedding_model: string
          embedding_provider: string
          id?: string
          is_active?: boolean
          language: string
          retrieval_thresholds?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          active_version?: number
          created_at?: string
          domain?: string
          embedding_dimensions?: number
          embedding_model?: string
          embedding_provider?: string
          id?: string
          is_active?: boolean
          language?: string
          retrieval_thresholds?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_knowledge_embeddings: {
        Row: {
          collection_id: string
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
          collection_id: string
          content_hash: string
          created_at?: string
          dimensions?: number
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
          collection_id?: string
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
            foreignKeyName: "ai_knowledge_embeddings_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_embeddings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_items: {
        Row: {
          band_max: number | null
          band_min: number | null
          collection_id: string
          collection_version: number
          content_hash: string
          created_at: string
          criterion: string | null
          embedding_text: string
          external_key: string | null
          format: string | null
          id: string
          item_kind: string
          language: string
          metadata: Json
          permitted_excerpt: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
          source_locator: string | null
          structured_insight: Json
          submitted_by: string | null
          task_type: string | null
          updated_at: string
          usable_for: string[]
        }
        Insert: {
          band_max?: number | null
          band_min?: number | null
          collection_id: string
          collection_version: number
          content_hash: string
          created_at?: string
          criterion?: string | null
          embedding_text: string
          external_key?: string | null
          format?: string | null
          id?: string
          item_kind: string
          language: string
          metadata?: Json
          permitted_excerpt?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
          source_locator?: string | null
          structured_insight?: Json
          submitted_by?: string | null
          task_type?: string | null
          updated_at?: string
          usable_for?: string[]
        }
        Update: {
          band_max?: number | null
          band_min?: number | null
          collection_id?: string
          collection_version?: number
          content_hash?: string
          created_at?: string
          criterion?: string | null
          embedding_text?: string
          external_key?: string | null
          format?: string | null
          id?: string
          item_kind?: string
          language?: string
          metadata?: Json
          permitted_excerpt?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
          source_locator?: string | null
          structured_insight?: Json
          submitted_by?: string | null
          task_type?: string | null
          updated_at?: string
          usable_for?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_items_collection_version_fkey"
            columns: ["collection_id", "collection_version"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_collection_versions"
            referencedColumns: ["collection_id", "version"]
          },
          {
            foreignKeyName: "ai_knowledge_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_items_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_retrieval_logs: {
        Row: {
          ai_quality_run_id: string | null
          collection_id: string
          created_at: string
          dimensions: number
          filters: Json
          id: string
          latency_ms: number | null
          model: string
          provider: string
          query_hash: string
          query_preview: string | null
          relevance_measurements: Json
          returned_evidence: Json
          source_route: string | null
          user_id: string | null
          workflow_run_id: string | null
        }
        Insert: {
          ai_quality_run_id?: string | null
          collection_id: string
          created_at?: string
          dimensions?: number
          filters?: Json
          id?: string
          latency_ms?: number | null
          model: string
          provider: string
          query_hash: string
          query_preview?: string | null
          relevance_measurements?: Json
          returned_evidence?: Json
          source_route?: string | null
          user_id?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          ai_quality_run_id?: string | null
          collection_id?: string
          created_at?: string
          dimensions?: number
          filters?: Json
          id?: string
          latency_ms?: number | null
          model?: string
          provider?: string
          query_hash?: string
          query_preview?: string | null
          relevance_measurements?: Json
          returned_evidence?: Json
          source_route?: string | null
          user_id?: string | null
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_retrieval_logs_ai_quality_run_id_fkey"
            columns: ["ai_quality_run_id"]
            isOneToOne: false
            referencedRelation: "ai_quality_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_retrieval_logs_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_retrieval_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_retrieval_logs_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_sources: {
        Row: {
          authority_tier: string
          canonical_url: string
          captured_at: string
          checksum: string
          created_at: string
          id: string
          metadata: Json
          publisher: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rights_status: string
          submitted_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          authority_tier: string
          canonical_url: string
          captured_at?: string
          checksum: string
          created_at?: string
          id?: string
          metadata?: Json
          publisher?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_status?: string
          submitted_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          authority_tier?: string
          canonical_url?: string
          captured_at?: string
          checksum?: string
          created_at?: string
          id?: string
          metadata?: Json
          publisher?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_status?: string
          submitted_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_sources_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_sources_submitted_by_fkey"
            columns: ["submitted_by"]
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
      ai_workflow_runs: {
        Row: {
          analysis_job_id: string | null
          backend: string
          backend_message_id: string | null
          completed_at: string | null
          core_completed_at: string | null
          created_at: string
          failed_at: string | null
          id: string
          idempotency_key: string
          last_delivery_attempt: number | null
          last_delivery_id: string | null
          last_error_code: string | null
          last_error_message: string | null
          launch_token: string | null
          lease_expires_at: string | null
          manual_retry_count: number
          phase: string
          progress: Json
          provider_attempt_count: number
          published_at: string | null
          speaking_response_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_claim_token: string | null
          workflow_attempt_count: number
          workflow_kind: string
          workflow_run_id: string | null
          writing_response_id: string | null
        }
        Insert: {
          analysis_job_id?: string | null
          backend?: string
          backend_message_id?: string | null
          completed_at?: string | null
          core_completed_at?: string | null
          created_at?: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          last_delivery_attempt?: number | null
          last_delivery_id?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          launch_token?: string | null
          lease_expires_at?: string | null
          manual_retry_count?: number
          phase?: string
          progress?: Json
          provider_attempt_count?: number
          published_at?: string | null
          speaking_response_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          worker_claim_token?: string | null
          workflow_attempt_count?: number
          workflow_kind: string
          workflow_run_id?: string | null
          writing_response_id?: string | null
        }
        Update: {
          analysis_job_id?: string | null
          backend?: string
          backend_message_id?: string | null
          completed_at?: string | null
          core_completed_at?: string | null
          created_at?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_delivery_attempt?: number | null
          last_delivery_id?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          launch_token?: string | null
          lease_expires_at?: string | null
          manual_retry_count?: number
          phase?: string
          progress?: Json
          provider_attempt_count?: number
          published_at?: string | null
          speaking_response_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          worker_claim_token?: string | null
          workflow_attempt_count?: number
          workflow_kind?: string
          workflow_run_id?: string | null
          writing_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_runs_analysis_job_id_fkey"
            columns: ["analysis_job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_runs_speaking_response_id_fkey"
            columns: ["speaking_response_id"]
            isOneToOne: false
            referencedRelation: "speaking_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_runs_writing_response_id_fkey"
            columns: ["writing_response_id"]
            isOneToOne: false
            referencedRelation: "writing_responses"
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
      assignment_submission_files: {
        Row: {
          club_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          state: string
          storage_path: string
          submission_id: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          state?: string
          storage_path: string
          submission_id: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          state?: string
          storage_path?: string
          submission_id?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submission_files_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submission_files_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submission_files_submission_owner_fkey"
            columns: ["submission_id", "club_id", "user_id"]
            isOneToOne: false
            referencedRelation: "club_assignment_submissions"
            referencedColumns: ["id", "club_id", "user_id"]
          },
          {
            foreignKeyName: "assignment_submission_files_user_id_fkey"
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
      center_admissions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          revision: number
          source: string
          stage: string
          student_record_id: string
          target: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          revision?: number
          source?: string
          stage?: string
          student_record_id: string
          target?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          revision?: number
          source?: string
          stage?: string
          student_record_id?: string
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_admissions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_admissions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_admissions_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
        ]
      }
      center_calendar_items: {
        Row: {
          binding_id: string
          class_id: string | null
          club_id: string
          ends_at: string | null
          etag: string | null
          event_id: string
          raw: Json
          schedule_id: string | null
          starts_at: string | null
          status: string
          title: string
          trial_id: string | null
        }
        Insert: {
          binding_id: string
          class_id?: string | null
          club_id: string
          ends_at?: string | null
          etag?: string | null
          event_id: string
          raw?: Json
          schedule_id?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          trial_id?: string | null
        }
        Update: {
          binding_id?: string
          class_id?: string | null
          club_id?: string
          ends_at?: string | null
          etag?: string | null
          event_id?: string
          raw?: Json
          schedule_id?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          trial_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_calendar_items_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "center_resource_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_calendar_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_calendar_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_calendar_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_calendar_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_calendar_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_calendar_items_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "center_trials"
            referencedColumns: ["id"]
          },
        ]
      }
      center_chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "center_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      center_commands: {
        Row: {
          actor_id: string
          club_id: string
          created_at: string
          id: string
          idempotency_key: string
          input_hash: string
          kind: string
          receipt: Json
        }
        Insert: {
          actor_id: string
          club_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          input_hash: string
          kind: string
          receipt: Json
        }
        Update: {
          actor_id?: string
          club_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          input_hash?: string
          kind?: string
          receipt?: Json
        }
        Relationships: [
          {
            foreignKeyName: "center_commands_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_commands_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_commands_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      center_communication_policies: {
        Row: {
          approval_status: string
          club_id: string
          daily_limit: number
          enabled: boolean
          include_guardians: boolean
          provider_template_id: string | null
          quiet_end: number
          quiet_start: number
          template_key: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          club_id: string
          daily_limit?: number
          enabled?: boolean
          include_guardians?: boolean
          provider_template_id?: string | null
          quiet_end?: number
          quiet_start?: number
          template_key: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          club_id?: string
          daily_limit?: number
          enabled?: boolean
          include_guardians?: boolean
          provider_template_id?: string | null
          quiet_end?: number
          quiet_start?: number
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_communication_policies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_communication_policies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      center_connections: {
        Row: {
          account_label: string | null
          club_id: string
          connected_by: string | null
          created_at: string
          external_account_id: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          provider: string
          revision: number
          scopes: string[]
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          club_id: string
          connected_by?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider: string
          revision?: number
          scopes?: string[]
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          club_id?: string
          connected_by?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider?: string
          revision?: number
          scopes?: string[]
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_connections_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_connections_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      center_conversations: {
        Row: {
          actor_id: string
          club_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          club_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          club_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_conversations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      center_drafts: {
        Row: {
          body: string
          class_id: string
          club_id: string
          created_at: string
          created_by: string
          id: string
          kind: string
          revision: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          class_id: string
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          revision?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          class_id?: string
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          revision?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_drafts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drafts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drafts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drafts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      center_drive_sources: {
        Row: {
          binding_id: string
          club_id: string
          content_hash: string | null
          last_sync_at: string | null
          material_id: string | null
          status: string
          version_id: string | null
        }
        Insert: {
          binding_id: string
          club_id: string
          content_hash?: string | null
          last_sync_at?: string | null
          material_id?: string | null
          status?: string
          version_id?: string | null
        }
        Update: {
          binding_id?: string
          club_id?: string
          content_hash?: string | null
          last_sync_at?: string | null
          material_id?: string | null
          status?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_drive_sources_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: true
            referencedRelation: "center_resource_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drive_sources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drive_sources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drive_sources_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_drive_sources_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      center_event_receipts: {
        Row: {
          consumer: string
          created_at: string
          detail: Json
          event_id: string
          provider_id: string | null
          status: string
        }
        Insert: {
          consumer: string
          created_at?: string
          detail?: Json
          event_id: string
          provider_id?: string | null
          status: string
        }
        Update: {
          consumer?: string
          created_at?: string
          detail?: Json
          event_id?: string
          provider_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_event_receipts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "center_events"
            referencedColumns: ["id"]
          },
        ]
      }
      center_events: {
        Row: {
          attempts: number
          available_at: string
          club_id: string
          command_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          origin: string
          payload: Json
          status: string
          subject_id: string | null
        }
        Insert: {
          attempts?: number
          available_at?: string
          club_id: string
          command_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          origin?: string
          payload?: Json
          status?: string
          subject_id?: string | null
        }
        Update: {
          attempts?: number
          available_at?: string
          club_id?: string
          command_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          origin?: string
          payload?: Json
          status?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_events_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "center_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      center_guardian_students: {
        Row: {
          club_id: string
          guardian_id: string
          preferences: Json
          revoked_at: string | null
          student_record_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          club_id: string
          guardian_id: string
          preferences?: Json
          revoked_at?: string | null
          student_record_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          club_id?: string
          guardian_id?: string
          preferences?: Json
          revoked_at?: string | null
          student_record_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_guardian_students_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_guardian_students_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_guardian_students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "center_guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_guardian_students_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_guardian_students_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      center_guardians: {
        Row: {
          club_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_guardians_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_guardians_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_guardians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      center_invoices: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          currency: string
          id: string
          offer_id: string
          revision: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          currency?: string
          id?: string
          offer_id: string
          revision?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          currency?: string
          id?: string
          offer_id?: string
          revision?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_invoices_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_invoices_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_invoices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "center_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      center_notes: {
        Row: {
          body: string
          club_id: string
          created_at: string
          created_by: string
          id: string
          revision: number
          student_record_id: string
          updated_at: string
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          revision?: number
          student_record_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          revision?: number
          student_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_notes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_notes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_notes_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
        ]
      }
      center_offers: {
        Row: {
          amount: number
          class_id: string
          club_id: string
          created_at: string
          currency: string
          ends_on: string
          id: string
          revision: number
          starts_on: string
          status: string
          student_record_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          class_id: string
          club_id: string
          created_at?: string
          currency?: string
          ends_on: string
          id?: string
          revision?: number
          starts_on: string
          status?: string
          student_record_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          class_id?: string
          club_id?: string
          created_at?: string
          currency?: string
          ends_on?: string
          id?: string
          revision?: number
          starts_on?: string
          status?: string
          student_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_offers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_offers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_offers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_offers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_offers_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
        ]
      }
      center_payment_attempts: {
        Row: {
          checkout_url: string | null
          club_id: string
          connection_id: string
          created_at: string
          error_code: string | null
          expected_amount: number
          expires_at: string | null
          id: string
          invoice_id: string
          provider_order_id: string
          provider_transaction_id: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          checkout_url?: string | null
          club_id: string
          connection_id: string
          created_at?: string
          error_code?: string | null
          expected_amount: number
          expires_at?: string | null
          id?: string
          invoice_id: string
          provider_order_id: string
          provider_transaction_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          checkout_url?: string | null
          club_id?: string
          connection_id?: string
          created_at?: string
          error_code?: string | null
          expected_amount?: number
          expires_at?: string | null
          id?: string
          invoice_id?: string
          provider_order_id?: string
          provider_transaction_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_payment_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_payment_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_payment_attempts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "center_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_payment_attempts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "center_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      center_proposals: {
        Row: {
          actor_id: string
          club_id: string
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          input: Json
          kind: string
          receipt: Json | null
          requires_confirmation: boolean
          status: string
        }
        Insert: {
          actor_id: string
          club_id: string
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          input: Json
          kind: string
          receipt?: Json | null
          requires_confirmation: boolean
          status?: string
        }
        Update: {
          actor_id?: string
          club_id?: string
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          input?: Json
          kind?: string
          receipt?: Json | null
          requires_confirmation?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_proposals_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_proposals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_proposals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_proposals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "center_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      center_recipient_channels: {
        Row: {
          address: string
          channel: string
          club_id: string
          consent_at: string | null
          created_at: string
          guardian_id: string | null
          id: string
          revoked_at: string | null
          student_record_id: string | null
          verified_at: string | null
        }
        Insert: {
          address: string
          channel: string
          club_id: string
          consent_at?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          revoked_at?: string | null
          student_record_id?: string | null
          verified_at?: string | null
        }
        Update: {
          address?: string
          channel?: string
          club_id?: string
          consent_at?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          revoked_at?: string | null
          student_record_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_recipient_channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_recipient_channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_recipient_channels_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "center_guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_recipient_channels_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
        ]
      }
      center_resource_bindings: {
        Row: {
          class_id: string | null
          club_id: string
          connection_id: string
          created_at: string
          cursor: string | null
          external_id: string
          id: string
          kind: string
          label: string
          last_sync_at: string | null
          metadata: Json
          state: string
        }
        Insert: {
          class_id?: string | null
          club_id: string
          connection_id: string
          created_at?: string
          cursor?: string | null
          external_id: string
          id?: string
          kind: string
          label: string
          last_sync_at?: string | null
          metadata?: Json
          state?: string
        }
        Update: {
          class_id?: string | null
          club_id?: string
          connection_id?: string
          created_at?: string
          cursor?: string | null
          external_id?: string
          id?: string
          kind?: string
          label?: string
          last_sync_at?: string | null
          metadata?: Json
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_resource_bindings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_resource_bindings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_resource_bindings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_resource_bindings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_resource_bindings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "center_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      center_sheet_staging: {
        Row: {
          binding_id: string
          club_id: string
          content_hash: string
          created_at: string
          id: string
          rows: Json
          status: string
        }
        Insert: {
          binding_id: string
          club_id: string
          content_hash: string
          created_at?: string
          id?: string
          rows: Json
          status?: string
        }
        Update: {
          binding_id?: string
          club_id?: string
          content_hash?: string
          created_at?: string
          id?: string
          rows?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_sheet_staging_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "center_resource_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_sheet_staging_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_sheet_staging_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      center_trials: {
        Row: {
          assessment: Json | null
          class_id: string
          club_id: string
          created_at: string
          ends_at: string
          id: string
          rebook_of: string | null
          revision: number
          starts_at: string
          status: string
          student_record_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          assessment?: Json | null
          class_id: string
          club_id: string
          created_at?: string
          ends_at: string
          id?: string
          rebook_of?: string | null
          revision?: number
          starts_at: string
          status?: string
          student_record_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          assessment?: Json | null
          class_id?: string
          club_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          rebook_of?: string | null
          revision?: number
          starts_at?: string
          status?: string
          student_record_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_trials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_trials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_trials_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_trials_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_trials_rebook_of_fkey"
            columns: ["rebook_of"]
            isOneToOne: false
            referencedRelation: "center_trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_trials_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string
          id: string
          initial_request_id: string | null
          product_context: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          initial_request_id?: string | null
          product_context?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          initial_request_id?: string | null
          product_context?: string
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
      class_attendance_correction_events: {
        Row: {
          action: string
          class_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string
          session_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by: string
          session_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          session_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_correction_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_correction_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_correction_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_correction_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_correction_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          occurrence_id: string | null
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
          occurrence_id?: string | null
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
          occurrence_id?: string | null
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
            foreignKeyName: "class_attendance_sessions_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "lms_lesson_occurrences"
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
      club_assignment_grade_events: {
        Row: {
          created_at: string
          feedback: string | null
          grade_status: string
          graded_by: string
          id: string
          revision_number: number
          rubric_breakdown: Json
          score: number | null
          score_max: number | null
          submission_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          grade_status: string
          graded_by: string
          id?: string
          revision_number: number
          rubric_breakdown?: Json
          score?: number | null
          score_max?: number | null
          submission_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          grade_status?: string
          graded_by?: string
          id?: string
          revision_number?: number
          rubric_breakdown?: Json
          score?: number | null
          score_max?: number | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_assignment_grade_events_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_grade_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "club_assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_assignment_submissions: {
        Row: {
          assignment_id: string
          class_id: string | null
          cleanup_attempts: number
          cleanup_last_error: string | null
          cleanup_status: string
          cleanup_updated_at: string | null
          club_id: string
          created_at: string
          failure_reason: string | null
          feedback: string | null
          grade_status: string
          graded_at: string | null
          graded_by: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          revision_number: number
          revision_of: string | null
          rubric_breakdown: Json
          score: number | null
          score_max: number | null
          source_id: string | null
          source_type: string
          status: string
          submission_state: string
          submission_text: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          class_id?: string | null
          cleanup_attempts?: number
          cleanup_last_error?: string | null
          cleanup_status?: string
          cleanup_updated_at?: string | null
          club_id: string
          created_at?: string
          failure_reason?: string | null
          feedback?: string | null
          grade_status?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          revision_number?: number
          revision_of?: string | null
          rubric_breakdown?: Json
          score?: number | null
          score_max?: number | null
          source_id?: string | null
          source_type?: string
          status?: string
          submission_state?: string
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          class_id?: string | null
          cleanup_attempts?: number
          cleanup_last_error?: string | null
          cleanup_status?: string
          cleanup_updated_at?: string | null
          club_id?: string
          created_at?: string
          failure_reason?: string | null
          feedback?: string | null
          grade_status?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          revision_number?: number
          revision_of?: string | null
          rubric_breakdown?: Json
          score?: number | null
          score_max?: number | null
          source_id?: string | null
          source_type?: string
          status?: string
          submission_state?: string
          submission_text?: string | null
          submitted_at?: string | null
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
            foreignKeyName: "club_assignment_submissions_assignment_scope_fk"
            columns: ["assignment_id", "club_id", "class_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id", "club_id", "class_id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_assignment_scope_fk"
            columns: ["assignment_id", "club_id", "class_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id", "club_id", "class_id"]
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
            foreignKeyName: "club_assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_assignment_submissions_revision_fk"
            columns: ["revision_of"]
            isOneToOne: false
            referencedRelation: "club_assignment_submissions"
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
          ielts_test_id: string | null
          metadata: Json
          required_attempts: number
          rubric_key: string
          rubric_version: number
          status: string
          submission_allowed_ext: string[] | null
          submission_files_enabled: boolean
          submission_instructions: string | null
          submission_max_file_mb: number
          submission_max_files: number
          submission_text_enabled: boolean
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
          ielts_test_id?: string | null
          metadata?: Json
          required_attempts?: number
          rubric_key?: string
          rubric_version?: number
          status?: string
          submission_allowed_ext?: string[] | null
          submission_files_enabled?: boolean
          submission_instructions?: string | null
          submission_max_file_mb?: number
          submission_max_files?: number
          submission_text_enabled?: boolean
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
          ielts_test_id?: string | null
          metadata?: Json
          required_attempts?: number
          rubric_key?: string
          rubric_version?: number
          status?: string
          submission_allowed_ext?: string[] | null
          submission_files_enabled?: boolean
          submission_instructions?: string | null
          submission_max_file_mb?: number
          submission_max_files?: number
          submission_text_enabled?: boolean
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
          {
            foreignKeyName: "club_assignments_ielts_test_id_fkey"
            columns: ["ielts_test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
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
          onboarding_completed_at: string | null
          organization_type: string
          owner_user_id: string | null
          settings: Json
          setup_completed_at: string | null
          setup_version: number
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
          onboarding_completed_at?: string | null
          organization_type?: string
          owner_user_id?: string | null
          settings?: Json
          setup_completed_at?: string | null
          setup_version?: number
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
          onboarding_completed_at?: string | null
          organization_type?: string
          owner_user_id?: string | null
          settings?: Json
          setup_completed_at?: string | null
          setup_version?: number
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
          club_id: string | null
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
          subject: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          category: string
          club_id?: string | null
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
          subject?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          category?: string
          club_id?: string | null
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
          subject?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
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
      email_campaign_recipients: {
        Row: {
          attempts: number
          available_at: string
          campaign_id: string
          created_at: string
          display_name: string | null
          email: string
          email_message_id: string | null
          id: string
          last_error: string | null
          locale: string
          max_attempts: number
          send_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          campaign_id: string
          created_at?: string
          display_name?: string | null
          email: string
          email_message_id?: string | null
          id?: string
          last_error?: string | null
          locale: string
          max_attempts?: number
          send_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          campaign_id?: string
          created_at?: string
          display_name?: string | null
          email?: string
          email_message_id?: string | null
          id?: string
          last_error?: string | null
          locale?: string
          max_attempts?: number
          send_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_email_message_id_fkey"
            columns: ["email_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: Json
          audience_snapshot_count: number
          body: Json
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          locale: string
          name: string
          scheduled_for: string | null
          sent_count: number
          status: string
          subject: string | null
          template_key: string
          updated_at: string
          variables: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience: Json
          audience_snapshot_count?: number
          body?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          locale?: string
          name: string
          scheduled_for?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          template_key: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: Json
          audience_snapshot_count?: number
          body?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          locale?: string
          name?: string
          scheduled_for?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          template_key?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          delayed_at: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          from_email: string
          id: string
          last_provider_event: string | null
          last_provider_event_at: string | null
          locale: string
          message_class: string | null
          metadata: Json
          notification_event_id: string | null
          opened_at: string | null
          reply_to: string[]
          resend_email_id: string | null
          scheduled_for: string | null
          send_key: string
          sender_stream: string | null
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
          delayed_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_email: string
          id?: string
          last_provider_event?: string | null
          last_provider_event_at?: string | null
          locale?: string
          message_class?: string | null
          metadata?: Json
          notification_event_id?: string | null
          opened_at?: string | null
          reply_to?: string[]
          resend_email_id?: string | null
          scheduled_for?: string | null
          send_key: string
          sender_stream?: string | null
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
          delayed_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_email?: string
          id?: string
          last_provider_event?: string | null
          last_provider_event_at?: string | null
          locale?: string
          message_class?: string | null
          metadata?: Json
          notification_event_id?: string | null
          opened_at?: string | null
          reply_to?: string[]
          resend_email_id?: string | null
          scheduled_for?: string | null
          send_key?: string
          sender_stream?: string | null
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
            foreignKeyName: "email_messages_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
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
      ielts_adaptive_evidence: {
        Row: {
          band_estimate: number | null
          confidence: number
          created_at: string
          criterion: string | null
          evidence_type: Database["public"]["Enums"]["ielts_adaptive_evidence_type"]
          evidence_value: number
          id: string
          metadata: Json
          module: Database["public"]["Enums"]["ielts_module"]
          question_type:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          raw_score: number | null
          reason_en: string
          reason_vi: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_id: string
          source_table: string
          subskill_key: string
          test_kind: Database["public"]["Enums"]["ielts_test_kind"] | null
          user_id: string
        }
        Insert: {
          band_estimate?: number | null
          confidence: number
          created_at?: string
          criterion?: string | null
          evidence_type: Database["public"]["Enums"]["ielts_adaptive_evidence_type"]
          evidence_value: number
          id?: string
          metadata?: Json
          module?: Database["public"]["Enums"]["ielts_module"]
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          raw_score?: number | null
          reason_en: string
          reason_vi: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_id: string
          source_table: string
          subskill_key: string
          test_kind?: Database["public"]["Enums"]["ielts_test_kind"] | null
          user_id: string
        }
        Update: {
          band_estimate?: number | null
          confidence?: number
          created_at?: string
          criterion?: string | null
          evidence_type?: Database["public"]["Enums"]["ielts_adaptive_evidence_type"]
          evidence_value?: number
          id?: string
          metadata?: Json
          module?: Database["public"]["Enums"]["ielts_module"]
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          raw_score?: number | null
          reason_en?: string
          reason_vi?: string
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_id?: string
          source_table?: string
          subskill_key?: string
          test_kind?: Database["public"]["Enums"]["ielts_test_kind"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_adaptive_evidence_subskill_key_fkey"
            columns: ["subskill_key"]
            isOneToOne: false
            referencedRelation: "ielts_subskills"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ielts_adaptive_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_attempt_question_blueprints: {
        Row: {
          attempt_id: string
          created_at: string
          group_instructions: string | null
          group_key: string | null
          id: string
          listening_section_id: string | null
          max_points: number
          metadata: Json
          options: Json
          passage_id: string | null
          prompt: string
          question_id: string
          question_order: number
          question_revision: number
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          section_id: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_audio_asset_id: string | null
          source_audio_status: string | null
          source_audio_storage_path: string | null
          source_audio_version: number | null
          source_body: string | null
          source_title: string | null
          source_updated_at: string
          test_id: string
          user_id: string
          visual: Json | null
          word_limit: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          group_instructions?: string | null
          group_key?: string | null
          id?: string
          listening_section_id?: string | null
          max_points: number
          metadata?: Json
          options?: Json
          passage_id?: string | null
          prompt: string
          question_id: string
          question_order: number
          question_revision?: number
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          section_id: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_audio_asset_id?: string | null
          source_audio_status?: string | null
          source_audio_storage_path?: string | null
          source_audio_version?: number | null
          source_body?: string | null
          source_title?: string | null
          source_updated_at: string
          test_id: string
          user_id: string
          visual?: Json | null
          word_limit?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          group_instructions?: string | null
          group_key?: string | null
          id?: string
          listening_section_id?: string | null
          max_points?: number
          metadata?: Json
          options?: Json
          passage_id?: string | null
          prompt?: string
          question_id?: string
          question_order?: number
          question_revision?: number
          question_type?: Database["public"]["Enums"]["ielts_question_type"]
          section_id?: string
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_audio_asset_id?: string | null
          source_audio_status?: string | null
          source_audio_storage_path?: string | null
          source_audio_version?: number | null
          source_body?: string | null
          source_title?: string | null
          source_updated_at?: string
          test_id?: string
          user_id?: string
          visual?: Json | null
          word_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_attempt_question_blueprints_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_blueprints_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_blueprints_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempt_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_blueprints_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_blueprints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_attempt_question_group_blueprints: {
        Row: {
          answer_mode: string | null
          any_order: boolean
          attempt_id: string
          bank: Json
          bank_reuse: boolean
          created_at: string
          group_id: string | null
          group_key: string
          id: string
          instructions: string | null
          listening_section_id: string | null
          metadata: Json
          order_index: number
          passage_id: string | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_updated_at: string
          stimulus: Json | null
          test_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          answer_mode?: string | null
          any_order?: boolean
          attempt_id: string
          bank?: Json
          bank_reuse?: boolean
          created_at?: string
          group_id?: string | null
          group_key: string
          id?: string
          instructions?: string | null
          listening_section_id?: string | null
          metadata?: Json
          order_index?: number
          passage_id?: string | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_updated_at: string
          stimulus?: Json | null
          test_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          answer_mode?: string | null
          any_order?: boolean
          attempt_id?: string
          bank?: Json
          bank_reuse?: boolean
          created_at?: string
          group_id?: string | null
          group_key?: string
          id?: string
          instructions?: string | null
          listening_section_id?: string | null
          metadata?: Json
          order_index?: number
          passage_id?: string | null
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_updated_at?: string
          stimulus?: Json | null
          test_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_attempt_question_group_blueprints_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_group_blueprints_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ielts_question_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_group_blueprints_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_group_blueprints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_attempt_question_keys: {
        Row: {
          accept_variants: Json
          attempt_id: string
          correct_answer: Json
          created_at: string
          examiner_notes: string | null
          explanation_en: string | null
          explanation_vi: string | null
          model_answer: string | null
          question_id: string
        }
        Insert: {
          accept_variants?: Json
          attempt_id: string
          correct_answer?: Json
          created_at?: string
          examiner_notes?: string | null
          explanation_en?: string | null
          explanation_vi?: string | null
          model_answer?: string | null
          question_id: string
        }
        Update: {
          accept_variants?: Json
          attempt_id?: string
          correct_answer?: Json
          created_at?: string
          examiner_notes?: string | null
          explanation_en?: string | null
          explanation_vi?: string | null
          model_answer?: string | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_attempt_question_keys_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_attempt_question_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
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
          assessment_mode: Database["public"]["Enums"]["ielts_assessment_mode"]
          assignment_id: string | null
          attempt_number: number
          blueprint_frozen_at: string | null
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
          test_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_attempt_id?: string | null
          assessment_mode?: Database["public"]["Enums"]["ielts_assessment_mode"]
          assignment_id?: string | null
          attempt_number?: number
          blueprint_frozen_at?: string | null
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
          test_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_attempt_id?: string | null
          assessment_mode?: Database["public"]["Enums"]["ielts_assessment_mode"]
          assignment_id?: string | null
          attempt_number?: number
          blueprint_frozen_at?: string | null
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
          test_version?: number
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
      ielts_criterion_evidence: {
        Row: {
          attempt_id: string
          band: number
          confidence: number
          created_at: string
          criterion: string
          deterministic_hash: string
          grading_version: string
          id: string
          metadata: Json
          model: string
          prompt_version: string
          provider: string
          provider_attempt: number
          question_id: string
          rationale: string
          response_id: string
          revision: number
          rubric_version: string
          run_id: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_response_revision: number
          speaking_response_id: string | null
          stage: string
          trace_id: string
          user_id: string
          validated_output_snapshot: Json
          workflow_attempt: number
          writing_response_id: string | null
        }
        Insert: {
          attempt_id: string
          band: number
          confidence: number
          created_at?: string
          criterion: string
          deterministic_hash: string
          grading_version: string
          id?: string
          metadata?: Json
          model: string
          prompt_version: string
          provider: string
          provider_attempt: number
          question_id: string
          rationale: string
          response_id: string
          revision?: number
          rubric_version: string
          run_id: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_response_revision: number
          speaking_response_id?: string | null
          stage: string
          trace_id: string
          user_id: string
          validated_output_snapshot: Json
          workflow_attempt: number
          writing_response_id?: string | null
        }
        Update: {
          attempt_id?: string
          band?: number
          confidence?: number
          created_at?: string
          criterion?: string
          deterministic_hash?: string
          grading_version?: string
          id?: string
          metadata?: Json
          model?: string
          prompt_version?: string
          provider?: string
          provider_attempt?: number
          question_id?: string
          rationale?: string
          response_id?: string
          revision?: number
          rubric_version?: string
          run_id?: string
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_response_revision?: number
          speaking_response_id?: string | null
          stage?: string
          trace_id?: string
          user_id?: string
          validated_output_snapshot?: Json
          workflow_attempt?: number
          writing_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_criterion_evidence_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_criterion_evidence_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_criterion_evidence_speaking_response_id_fkey"
            columns: ["speaking_response_id"]
            isOneToOne: false
            referencedRelation: "speaking_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_criterion_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_criterion_evidence_writing_response_id_fkey"
            columns: ["writing_response_id"]
            isOneToOne: false
            referencedRelation: "writing_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_effective_attempt_scores: {
        Row: {
          attempt_id: string
          class_id: string | null
          club_id: string | null
          computed_at: string
          listening_band: number | null
          overall_band: number | null
          overall_is_provisional: boolean
          provisional_band: number | null
          reading_band: number | null
          score_source: string
          speaking_band: number | null
          user_id: string
          writing_band: number | null
        }
        Insert: {
          attempt_id: string
          class_id?: string | null
          club_id?: string | null
          computed_at?: string
          listening_band?: number | null
          overall_band?: number | null
          overall_is_provisional?: boolean
          provisional_band?: number | null
          reading_band?: number | null
          score_source?: string
          speaking_band?: number | null
          user_id: string
          writing_band?: number | null
        }
        Update: {
          attempt_id?: string
          class_id?: string | null
          club_id?: string | null
          computed_at?: string
          listening_band?: number | null
          overall_band?: number | null
          overall_is_provisional?: boolean
          provisional_band?: number | null
          reading_band?: number | null
          score_source?: string
          speaking_band?: number | null
          user_id?: string
          writing_band?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_effective_attempt_scores_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_effective_attempt_scores_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_effective_attempt_scores_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_effective_attempt_scores_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_effective_attempt_scores_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_effective_attempt_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_micro_item_drafts: {
        Row: {
          activity_type: string
          answer_key: Json
          created_at: string
          created_by: string | null
          draft_content: Json
          edited_by: string | null
          id: string
          model_name: string | null
          model_provider: string | null
          prompt_version: string
          provenance: Json
          published_activity_id: string | null
          published_at: string | null
          qa_notes: string | null
          rationale_en: string
          rationale_vi: string
          reviewed_at: string | null
          reviewer_id: string | null
          source_listening_section_id: string | null
          source_passage_id: string | null
          source_question_id: string | null
          status: string
          subskill_key: string | null
          test_id: string | null
          updated_at: string
        }
        Insert: {
          activity_type: string
          answer_key: Json
          created_at?: string
          created_by?: string | null
          draft_content: Json
          edited_by?: string | null
          id?: string
          model_name?: string | null
          model_provider?: string | null
          prompt_version?: string
          provenance?: Json
          published_activity_id?: string | null
          published_at?: string | null
          qa_notes?: string | null
          rationale_en: string
          rationale_vi: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          source_listening_section_id?: string | null
          source_passage_id?: string | null
          source_question_id?: string | null
          status?: string
          subskill_key?: string | null
          test_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          answer_key?: Json
          created_at?: string
          created_by?: string | null
          draft_content?: Json
          edited_by?: string | null
          id?: string
          model_name?: string | null
          model_provider?: string | null
          prompt_version?: string
          provenance?: Json
          published_activity_id?: string | null
          published_at?: string | null
          qa_notes?: string | null
          rationale_en?: string
          rationale_vi?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          source_listening_section_id?: string | null
          source_passage_id?: string | null
          source_question_id?: string | null
          status?: string
          subskill_key?: string | null
          test_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_micro_item_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_published_activity_id_fkey"
            columns: ["published_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_source_listening_section_id_fkey"
            columns: ["source_listening_section_id"]
            isOneToOne: false
            referencedRelation: "listening_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_source_passage_id_fkey"
            columns: ["source_passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_subskill_key_fkey"
            columns: ["subskill_key"]
            isOneToOne: false
            referencedRelation: "ielts_subskills"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ielts_micro_item_drafts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_question_groups: {
        Row: {
          answer_mode: string | null
          any_order: boolean
          bank: Json
          bank_reuse: boolean
          created_at: string
          group_key: string
          id: string
          instructions: string | null
          listening_section_id: string | null
          metadata: Json
          order_index: number
          passage_id: string | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          stimulus: Json | null
          test_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          answer_mode?: string | null
          any_order?: boolean
          bank?: Json
          bank_reuse?: boolean
          created_at?: string
          group_key: string
          id?: string
          instructions?: string | null
          listening_section_id?: string | null
          metadata?: Json
          order_index?: number
          passage_id?: string | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          stimulus?: Json | null
          test_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          answer_mode?: string | null
          any_order?: boolean
          bank?: Json
          bank_reuse?: boolean
          created_at?: string
          group_key?: string
          id?: string
          instructions?: string | null
          listening_section_id?: string | null
          metadata?: Json
          order_index?: number
          passage_id?: string | null
          skill?: Database["public"]["Enums"]["ielts_skill"]
          stimulus?: Json | null
          test_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_question_groups_listening_section_id_fkey"
            columns: ["listening_section_id"]
            isOneToOne: false
            referencedRelation: "listening_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_question_groups_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_question_groups_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
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
      ielts_question_responses: {
        Row: {
          attempt_id: string
          awarded_points: number | null
          created_at: string
          graded_at: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          question_revision: number
          response: Json
          section_id: string | null
          test_version: number
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
          question_revision?: number
          response?: Json
          section_id?: string | null
          test_version?: number
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
          question_revision?: number
          response?: Json
          section_id?: string | null
          test_version?: number
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
      ielts_review_events: {
        Row: {
          activity_attempt_id: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          metadata: Json
          next_difficulty: number
          next_due_at: string
          next_ease_factor: number
          next_interval_days: number
          next_lapses: number
          next_repetitions: number
          next_retrievability: number
          next_stability: number
          next_state: string
          plan_item_id: string | null
          previous_difficulty: number
          previous_due_at: string
          previous_ease_factor: number
          previous_interval_days: number
          previous_lapses: number
          previous_repetitions: number
          previous_retrievability: number
          previous_stability: number
          previous_state: string
          quality_grade: number
          rating: Database["public"]["Enums"]["ielts_review_rating"]
          response_ms: number | null
          review_item_id: string
          user_id: string
        }
        Insert: {
          activity_attempt_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          metadata?: Json
          next_difficulty: number
          next_due_at: string
          next_ease_factor: number
          next_interval_days: number
          next_lapses: number
          next_repetitions: number
          next_retrievability: number
          next_stability: number
          next_state: string
          plan_item_id?: string | null
          previous_difficulty: number
          previous_due_at: string
          previous_ease_factor: number
          previous_interval_days: number
          previous_lapses: number
          previous_repetitions: number
          previous_retrievability: number
          previous_stability: number
          previous_state: string
          quality_grade: number
          rating: Database["public"]["Enums"]["ielts_review_rating"]
          response_ms?: number | null
          review_item_id: string
          user_id: string
        }
        Update: {
          activity_attempt_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          metadata?: Json
          next_difficulty?: number
          next_due_at?: string
          next_ease_factor?: number
          next_interval_days?: number
          next_lapses?: number
          next_repetitions?: number
          next_retrievability?: number
          next_stability?: number
          next_state?: string
          plan_item_id?: string | null
          previous_difficulty?: number
          previous_due_at?: string
          previous_ease_factor?: number
          previous_interval_days?: number
          previous_lapses?: number
          previous_repetitions?: number
          previous_retrievability?: number
          previous_stability?: number
          previous_state?: string
          quality_grade?: number
          rating?: Database["public"]["Enums"]["ielts_review_rating"]
          response_ms?: number | null
          review_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_review_events_activity_attempt_id_fkey"
            columns: ["activity_attempt_id"]
            isOneToOne: false
            referencedRelation: "activity_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_events_review_item_id_fkey"
            columns: ["review_item_id"]
            isOneToOne: false
            referencedRelation: "ielts_review_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_review_items: {
        Row: {
          activity_attempt_id: string | null
          activity_id: string | null
          algorithm: Database["public"]["Enums"]["ielts_review_algorithm"]
          answer_en: string | null
          answer_vi: string | null
          atom_payload: Json
          created_at: string
          difficulty: number
          due_at: string
          ease_factor: number
          focus_area: string
          id: string
          interval_days: number
          lapses: number
          last_reviewed_at: string | null
          mastered_at: string | null
          metadata: Json
          prompt_en: string
          prompt_vi: string
          question_id: string | null
          question_response_id: string | null
          repetitions: number
          retrievability: number
          review_kind: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_id: string | null
          source_key: string
          source_type: string
          speaking_response_id: string | null
          stability: number
          state: string
          suspended_until: string | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }
        Insert: {
          activity_attempt_id?: string | null
          activity_id?: string | null
          algorithm?: Database["public"]["Enums"]["ielts_review_algorithm"]
          answer_en?: string | null
          answer_vi?: string | null
          atom_payload?: Json
          created_at?: string
          difficulty?: number
          due_at?: string
          ease_factor?: number
          focus_area: string
          id?: string
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          mastered_at?: string | null
          metadata?: Json
          prompt_en: string
          prompt_vi: string
          question_id?: string | null
          question_response_id?: string | null
          repetitions?: number
          retrievability?: number
          review_kind: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_id?: string | null
          source_key: string
          source_type: string
          speaking_response_id?: string | null
          stability?: number
          state?: string
          suspended_until?: string | null
          updated_at?: string
          user_id: string
          writing_response_id?: string | null
        }
        Update: {
          activity_attempt_id?: string | null
          activity_id?: string | null
          algorithm?: Database["public"]["Enums"]["ielts_review_algorithm"]
          answer_en?: string | null
          answer_vi?: string | null
          atom_payload?: Json
          created_at?: string
          difficulty?: number
          due_at?: string
          ease_factor?: number
          focus_area?: string
          id?: string
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          mastered_at?: string | null
          metadata?: Json
          prompt_en?: string
          prompt_vi?: string
          question_id?: string | null
          question_response_id?: string | null
          repetitions?: number
          retrievability?: number
          review_kind?: string
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_id?: string | null
          source_key?: string
          source_type?: string
          speaking_response_id?: string | null
          stability?: number
          state?: string
          suspended_until?: string | null
          updated_at?: string
          user_id?: string
          writing_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_review_items_activity_attempt_id_fkey"
            columns: ["activity_attempt_id"]
            isOneToOne: false
            referencedRelation: "activity_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_items_question_response_id_fkey"
            columns: ["question_response_id"]
            isOneToOne: false
            referencedRelation: "ielts_question_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_items_speaking_response_id_fkey"
            columns: ["speaking_response_id"]
            isOneToOne: false
            referencedRelation: "speaking_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_review_items_writing_response_id_fkey"
            columns: ["writing_response_id"]
            isOneToOne: false
            referencedRelation: "writing_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_scoring_retry_events: {
        Row: {
          attempt_id: string | null
          class_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          new_workflow_run: string
          previous_workflow_run: string | null
          requested_by: string
          retry_ordinal: number
          source_id: string
          source_kind: string
          source_revision: number
        }
        Insert: {
          attempt_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          new_workflow_run: string
          previous_workflow_run?: string | null
          requested_by: string
          retry_ordinal: number
          source_id: string
          source_kind: string
          source_revision: number
        }
        Update: {
          attempt_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          new_workflow_run?: string
          previous_workflow_run?: string | null
          requested_by?: string
          retry_ordinal?: number
          source_id?: string
          source_kind?: string
          source_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "ielts_scoring_retry_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_scoring_retry_events_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_skill_states: {
        Row: {
          band_estimate: number | null
          confidence: number
          created_at: string
          criterion: string | null
          evidence_count: number
          explanation: Json
          id: string
          last_evidence_at: string | null
          mastery_score: number
          module: Database["public"]["Enums"]["ielts_module"]
          question_type:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          subskill_key: string
          updated_at: string
          user_id: string
          weakness_weight: number
        }
        Insert: {
          band_estimate?: number | null
          confidence?: number
          created_at?: string
          criterion?: string | null
          evidence_count?: number
          explanation?: Json
          id?: string
          last_evidence_at?: string | null
          mastery_score?: number
          module?: Database["public"]["Enums"]["ielts_module"]
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          subskill_key: string
          updated_at?: string
          user_id: string
          weakness_weight?: number
        }
        Update: {
          band_estimate?: number | null
          confidence?: number
          created_at?: string
          criterion?: string | null
          evidence_count?: number
          explanation?: Json
          id?: string
          last_evidence_at?: string | null
          mastery_score?: number
          module?: Database["public"]["Enums"]["ielts_module"]
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          skill?: Database["public"]["Enums"]["ielts_skill"]
          subskill_key?: string
          updated_at?: string
          user_id?: string
          weakness_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ielts_skill_states_subskill_key_fkey"
            columns: ["subskill_key"]
            isOneToOne: false
            referencedRelation: "ielts_subskills"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ielts_skill_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_study_plan_items: {
        Row: {
          activity_attempt_id: string | null
          activity_id: string | null
          assignment_id: string | null
          available_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          criterion: string | null
          due_at: string | null
          estimated_minutes: number
          focus_area: string
          id: string
          ielts_attempt_id: string | null
          ielts_question_id: string | null
          ielts_test_id: string | null
          kind: Database["public"]["Enums"]["ielts_plan_item_kind"]
          metadata: Json
          plan_id: string
          priority_score: number
          question_type:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          rationale_en: string
          rationale_vi: string
          review_item_id: string | null
          scheduled_date: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_prediction_snapshot_id: string | null
          source_weakness_keys: string[]
          speaking_response_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ielts_plan_item_status"]
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }
        Insert: {
          activity_attempt_id?: string | null
          activity_id?: string | null
          assignment_id?: string | null
          available_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          criterion?: string | null
          due_at?: string | null
          estimated_minutes: number
          focus_area: string
          id?: string
          ielts_attempt_id?: string | null
          ielts_question_id?: string | null
          ielts_test_id?: string | null
          kind: Database["public"]["Enums"]["ielts_plan_item_kind"]
          metadata?: Json
          plan_id: string
          priority_score?: number
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          rationale_en: string
          rationale_vi: string
          review_item_id?: string | null
          scheduled_date: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_prediction_snapshot_id?: string | null
          source_weakness_keys?: string[]
          speaking_response_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ielts_plan_item_status"]
          updated_at?: string
          user_id: string
          writing_response_id?: string | null
        }
        Update: {
          activity_attempt_id?: string | null
          activity_id?: string | null
          assignment_id?: string | null
          available_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          criterion?: string | null
          due_at?: string | null
          estimated_minutes?: number
          focus_area?: string
          id?: string
          ielts_attempt_id?: string | null
          ielts_question_id?: string | null
          ielts_test_id?: string | null
          kind?: Database["public"]["Enums"]["ielts_plan_item_kind"]
          metadata?: Json
          plan_id?: string
          priority_score?: number
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          rationale_en?: string
          rationale_vi?: string
          review_item_id?: string | null
          scheduled_date?: string
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_prediction_snapshot_id?: string | null
          source_weakness_keys?: string[]
          speaking_response_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ielts_plan_item_status"]
          updated_at?: string
          user_id?: string
          writing_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_study_plan_items_activity_attempt_id_fkey"
            columns: ["activity_attempt_id"]
            isOneToOne: false
            referencedRelation: "activity_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_ielts_attempt_id_fkey"
            columns: ["ielts_attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_ielts_question_id_fkey"
            columns: ["ielts_question_id"]
            isOneToOne: false
            referencedRelation: "ielts_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_ielts_test_id_fkey"
            columns: ["ielts_test_id"]
            isOneToOne: false
            referencedRelation: "ielts_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ielts_study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_review_item_id_fkey"
            columns: ["review_item_id"]
            isOneToOne: false
            referencedRelation: "ielts_review_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_speaking_response_id_fkey"
            columns: ["speaking_response_id"]
            isOneToOne: false
            referencedRelation: "speaking_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_items_writing_response_id_fkey"
            columns: ["writing_response_id"]
            isOneToOne: false
            referencedRelation: "writing_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_study_plan_revisions: {
        Row: {
          after_snapshot: Json
          before_snapshot: Json
          changed_item_count: number
          created_at: string
          from_version: number | null
          id: string
          plan_id: string
          summary_en: string
          summary_vi: string
          to_version: number
          trigger_source_id: string | null
          trigger_source_type: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          after_snapshot?: Json
          before_snapshot?: Json
          changed_item_count?: number
          created_at?: string
          from_version?: number | null
          id?: string
          plan_id: string
          summary_en: string
          summary_vi: string
          to_version: number
          trigger_source_id?: string | null
          trigger_source_type?: string | null
          trigger_type: string
          user_id: string
        }
        Update: {
          after_snapshot?: Json
          before_snapshot?: Json
          changed_item_count?: number
          created_at?: string
          from_version?: number | null
          id?: string
          plan_id?: string
          summary_en?: string
          summary_vi?: string
          to_version?: number
          trigger_source_id?: string | null
          trigger_source_type?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_study_plan_revisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ielts_study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_study_plan_revisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_study_plans: {
        Row: {
          baseline_prediction_snapshot_id: string | null
          created_at: string
          daily_minutes: number
          explanation: Json
          feedback_language: string
          focus_skills: Database["public"]["Enums"]["ielts_skill"][] | null
          generated_at: string
          id: string
          last_replanned_at: string | null
          latest_prediction_snapshot_id: string | null
          module: Database["public"]["Enums"]["ielts_module"]
          next_reassessment_at: string | null
          plan_horizon_days: number
          plan_version: number
          predicted_listening_band: number | null
          predicted_overall_band: number | null
          predicted_reading_band: number | null
          predicted_speaking_band: number | null
          predicted_writing_band: number | null
          prediction_confidence: number | null
          prediction_summary: Json
          status: Database["public"]["Enums"]["ielts_study_plan_status"]
          study_days: number[]
          target_listening_band: number | null
          target_overall_band: number
          target_reading_band: number | null
          target_speaking_band: number | null
          target_test_date: string
          target_writing_band: number | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_prediction_snapshot_id?: string | null
          created_at?: string
          daily_minutes: number
          explanation?: Json
          feedback_language?: string
          focus_skills?: Database["public"]["Enums"]["ielts_skill"][] | null
          generated_at?: string
          id?: string
          last_replanned_at?: string | null
          latest_prediction_snapshot_id?: string | null
          module?: Database["public"]["Enums"]["ielts_module"]
          next_reassessment_at?: string | null
          plan_horizon_days?: number
          plan_version?: number
          predicted_listening_band?: number | null
          predicted_overall_band?: number | null
          predicted_reading_band?: number | null
          predicted_speaking_band?: number | null
          predicted_writing_band?: number | null
          prediction_confidence?: number | null
          prediction_summary?: Json
          status?: Database["public"]["Enums"]["ielts_study_plan_status"]
          study_days: number[]
          target_listening_band?: number | null
          target_overall_band?: number
          target_reading_band?: number | null
          target_speaking_band?: number | null
          target_test_date: string
          target_writing_band?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_prediction_snapshot_id?: string | null
          created_at?: string
          daily_minutes?: number
          explanation?: Json
          feedback_language?: string
          focus_skills?: Database["public"]["Enums"]["ielts_skill"][] | null
          generated_at?: string
          id?: string
          last_replanned_at?: string | null
          latest_prediction_snapshot_id?: string | null
          module?: Database["public"]["Enums"]["ielts_module"]
          next_reassessment_at?: string | null
          plan_horizon_days?: number
          plan_version?: number
          predicted_listening_band?: number | null
          predicted_overall_band?: number | null
          predicted_reading_band?: number | null
          predicted_speaking_band?: number | null
          predicted_writing_band?: number | null
          prediction_confidence?: number | null
          prediction_summary?: Json
          status?: Database["public"]["Enums"]["ielts_study_plan_status"]
          study_days?: number[]
          target_listening_band?: number | null
          target_overall_band?: number
          target_reading_band?: number | null
          target_speaking_band?: number | null
          target_test_date?: string
          target_writing_band?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ielts_study_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_subskills: {
        Row: {
          created_at: string
          description_en: string | null
          description_vi: string | null
          id: string
          is_active: boolean
          key: string
          kind: string
          label_en: string
          label_vi: string
          question_type:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_vi?: string | null
          id?: string
          is_active?: boolean
          key: string
          kind: string
          label_en: string
          label_vi: string
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_vi?: string | null
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          label_en?: string
          label_vi?: string
          question_type?:
            | Database["public"]["Enums"]["ielts_question_type"]
            | null
          skill?: Database["public"]["Enums"]["ielts_skill"]
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      ielts_teacher_review_events: {
        Row: {
          actor_id: string
          attempt_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          payload: Json
          review_id: string
          revision: number
          to_status: string | null
        }
        Insert: {
          actor_id: string
          attempt_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          payload?: Json
          review_id: string
          revision: number
          to_status?: string | null
        }
        Update: {
          actor_id?: string
          attempt_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          payload?: Json
          review_id?: string
          revision?: number
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_teacher_review_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_review_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "ielts_published_criterion_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "ielts_teacher_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_teacher_review_feedback_history: {
        Row: {
          actor_id: string
          attempt_id: string
          created_at: string
          criterion_feedback: Json
          id: string
          previous_criterion_feedback: Json
          review_id: string
          revision: number
        }
        Insert: {
          actor_id: string
          attempt_id: string
          created_at?: string
          criterion_feedback: Json
          id?: string
          previous_criterion_feedback: Json
          review_id: string
          revision: number
        }
        Update: {
          actor_id?: string
          attempt_id?: string
          created_at?: string
          criterion_feedback?: Json
          id?: string
          previous_criterion_feedback?: Json
          review_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "ielts_teacher_review_feedback_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_review_feedback_history_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_review_feedback_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "ielts_published_criterion_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_review_feedback_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "ielts_teacher_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_teacher_reviews: {
        Row: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band?: number | null
          created_at?: string
          criterion_feedback?: Json
          fluency_coherence_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_resource_band?: number | null
          part_number?: number | null
          pronunciation_band?: number | null
          published_at?: string | null
          returned_at?: string | null
          returned_note?: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note?: string | null
          revision?: number
          revision_consumed_at?: string | null
          revision_granted?: number | null
          rubric_key?: string
          rubric_version?: number
          skill_band?: number | null
          speaking_response_id?: string | null
          status?: string
          task_band?: number | null
          task_number?: number | null
          task_response_band?: number | null
          updated_at?: string
          user_id: string
          writing_response_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          attempt_id?: string
          class_id?: string
          club_id?: string
          coherence_cohesion_band?: number | null
          created_at?: string
          criterion_feedback?: Json
          fluency_coherence_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_resource_band?: number | null
          part_number?: number | null
          pronunciation_band?: number | null
          published_at?: string | null
          returned_at?: string | null
          returned_note?: string | null
          review_kind?: string
          reviewer_id?: string
          reviewer_note?: string | null
          revision?: number
          revision_consumed_at?: string | null
          revision_granted?: number | null
          rubric_key?: string
          rubric_version?: number
          skill_band?: number | null
          speaking_response_id?: string | null
          status?: string
          task_band?: number | null
          task_number?: number | null
          task_response_band?: number | null
          updated_at?: string
          user_id?: string
          writing_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_teacher_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_speaking_response_id_fkey"
            columns: ["speaking_response_id"]
            isOneToOne: false
            referencedRelation: "speaking_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_writing_response_id_fkey"
            columns: ["writing_response_id"]
            isOneToOne: false
            referencedRelation: "writing_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      ielts_tests: {
        Row: {
          assessment_mode: Database["public"]["Enums"]["ielts_assessment_mode"]
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
          assessment_mode?: Database["public"]["Enums"]["ielts_assessment_mode"]
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
          assessment_mode?: Database["public"]["Enums"]["ielts_assessment_mode"]
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
      lms_announcements: {
        Row: {
          archived_at: string | null
          body: string
          class_id: string
          club_id: string
          created_at: string
          created_by: string
          id: string
          publish_at: string | null
          published_at: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          body: string
          class_id: string
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          publish_at?: string | null
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          body?: string
          class_id?: string
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          publish_at?: string | null
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_announcements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_lesson_occurrences: {
        Row: {
          activity_id: string | null
          class_id: string
          class_schedule_id: string | null
          club_id: string
          course_id: string
          created_at: string
          created_by: string
          ends_at: string
          id: string
          lesson_id: string | null
          metadata: Json
          notes: string | null
          occurrence_date: string
          published_at: string | null
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id?: string | null
          class_id: string
          class_schedule_id?: string | null
          club_id: string
          course_id: string
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          lesson_id?: string | null
          metadata?: Json
          notes?: string | null
          occurrence_date: string
          published_at?: string | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string | null
          class_id?: string
          class_schedule_id?: string | null
          club_id?: string
          course_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json
          notes?: string | null
          occurrence_date?: string
          published_at?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_lesson_occurrences_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_class_id_course_id_fkey"
            columns: ["class_id", "course_id"]
            isOneToOne: false
            referencedRelation: "class_course_assignments"
            referencedColumns: ["class_id", "course_id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_class_schedule_id_fkey"
            columns: ["class_schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_occurrences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_audiences: {
        Row: {
          added_at: string
          added_by: string
          class_id: string
          id: string
          material_id: string
          placement_id: string
          revoked_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          class_id: string
          id?: string
          material_id: string
          placement_id: string
          revoked_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          class_id?: string
          id?: string
          material_id?: string
          placement_id?: string
          revoked_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_audiences_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_audiences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_audiences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_audiences_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_audiences_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "lms_material_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_audiences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          material_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          material_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          material_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_placements: {
        Row: {
          assignment_id: string | null
          audience_mode: string
          class_id: string | null
          club_id: string
          course_id: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          material_id: string
          occurrence_id: string | null
          order_index: number
          release_at: string | null
          required: boolean
          source_assignment_id: string | null
          status: string
          target_type: string
          updated_at: string
          version_id: string
        }
        Insert: {
          assignment_id?: string | null
          audience_mode?: string
          class_id?: string | null
          club_id: string
          course_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          material_id: string
          occurrence_id?: string | null
          order_index?: number
          release_at?: string | null
          required?: boolean
          source_assignment_id?: string | null
          status?: string
          target_type: string
          updated_at?: string
          version_id: string
        }
        Update: {
          assignment_id?: string | null
          audience_mode?: string
          class_id?: string | null
          club_id?: string
          course_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          material_id?: string
          occurrence_id?: string | null
          order_index?: number
          release_at?: string | null
          required?: boolean
          source_assignment_id?: string | null
          status?: string
          target_type?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_placements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "lms_material_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "lms_lesson_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_source_assignment_id_fkey"
            columns: ["source_assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_source_assignment_id_fkey"
            columns: ["source_assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_placements_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_renditions: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          metadata: Json
          mime_type: string | null
          page_number: number | null
          processing_status: string
          rendition_kind: string
          sha256: string | null
          size_bytes: number | null
          sort_order: number
          storage_path: string
          version_id: string
          watermark_class_label: string | null
          watermark_learner_label: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          page_number?: number | null
          processing_status?: string
          rendition_kind: string
          sha256?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
          version_id: string
          watermark_class_label?: string | null
          watermark_learner_label?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          page_number?: number | null
          processing_status?: string
          rendition_kind?: string
          sha256?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
          version_id?: string
          watermark_class_label?: string | null
          watermark_learner_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_renditions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_rights_approvals: {
        Row: {
          basis: string
          created_at: string
          decision: string
          evidence_note: string | null
          evidence_url: string | null
          expires_at: string | null
          id: string
          license_name: string | null
          material_id: string
          provenance: string
          reviewed_at: string
          reviewer_id: string
          rights_holder: string | null
          version_id: string
        }
        Insert: {
          basis: string
          created_at?: string
          decision: string
          evidence_note?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          license_name?: string | null
          material_id: string
          provenance: string
          reviewed_at?: string
          reviewer_id: string
          rights_holder?: string | null
          version_id: string
        }
        Update: {
          basis?: string
          created_at?: string
          decision?: string
          evidence_note?: string | null
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          license_name?: string | null
          material_id?: string
          provenance?: string
          reviewed_at?: string
          reviewer_id?: string
          rights_holder?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_rights_approvals_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_rights_approvals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_rights_approvals_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_unlock_rules: {
        Row: {
          assignment_id: string | null
          created_at: string
          created_by: string
          id: string
          material_id: string
          minimum_score: number | null
          occurrence_id: string | null
          placement_id: string
          rule_kind: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          material_id: string
          minimum_score?: number | null
          occurrence_id?: string | null
          placement_id: string
          rule_kind: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          material_id?: string
          minimum_score?: number | null
          occurrence_id?: string | null
          placement_id?: string
          rule_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_unlock_rules_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_unlock_rules_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_unlock_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_unlock_rules_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_unlock_rules_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "lms_lesson_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_unlock_rules_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "lms_material_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_material_versions: {
        Row: {
          content_review_note: string | null
          content_review_status: string
          content_reviewed_at: string | null
          content_reviewer_id: string | null
          created_at: string
          created_by: string
          detected_mime_type: string | null
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          ingest_bucket: string | null
          ingest_path: string | null
          lease_expires_at: string | null
          lease_token: string | null
          material_id: string
          native_document: Json
          original_bucket: string | null
          original_path: string | null
          processing_attempts: number
          processing_status: string
          purpose: string
          sha256: string | null
          size_bytes: number | null
          source_file_name: string | null
          source_mime_type: string | null
          updated_at: string
          version_number: number
        }
        Insert: {
          content_review_note?: string | null
          content_review_status?: string
          content_reviewed_at?: string | null
          content_reviewer_id?: string | null
          created_at?: string
          created_by: string
          detected_mime_type?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          ingest_bucket?: string | null
          ingest_path?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          material_id: string
          native_document?: Json
          original_bucket?: string | null
          original_path?: string | null
          processing_attempts?: number
          processing_status?: string
          purpose?: string
          sha256?: string | null
          size_bytes?: number | null
          source_file_name?: string | null
          source_mime_type?: string | null
          updated_at?: string
          version_number: number
        }
        Update: {
          content_review_note?: string | null
          content_review_status?: string
          content_reviewed_at?: string | null
          content_reviewer_id?: string | null
          created_at?: string
          created_by?: string
          detected_mime_type?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          ingest_bucket?: string | null
          ingest_path?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          material_id?: string
          native_document?: Json
          original_bucket?: string | null
          original_path?: string | null
          processing_attempts?: number
          processing_status?: string
          purpose?: string
          sha256?: string | null
          size_bytes?: number | null
          source_file_name?: string | null
          source_mime_type?: string | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lms_material_versions_content_reviewer_id_fkey"
            columns: ["content_reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_material_versions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_materials: {
        Row: {
          archived_at: string | null
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          document: Json
          id: string
          material_kind: string
          program_type: string
          published_at: string | null
          rights_approved_at: string | null
          rights_approved_by: string | null
          rights_basis: string
          rights_holder: string | null
          rights_license: string | null
          rights_provenance: string | null
          rights_review_note: string | null
          scope_class_id: string | null
          source_resource_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          document?: Json
          id?: string
          material_kind: string
          program_type: string
          published_at?: string | null
          rights_approved_at?: string | null
          rights_approved_by?: string | null
          rights_basis?: string
          rights_holder?: string | null
          rights_license?: string | null
          rights_provenance?: string | null
          rights_review_note?: string | null
          scope_class_id?: string | null
          source_resource_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          document?: Json
          id?: string
          material_kind?: string
          program_type?: string
          published_at?: string | null
          rights_approved_at?: string | null
          rights_approved_by?: string | null
          rights_basis?: string
          rights_holder?: string | null
          rights_license?: string | null
          rights_provenance?: string | null
          rights_review_note?: string | null
          scope_class_id?: string | null
          source_resource_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_materials_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_rights_approved_by_fkey"
            columns: ["rights_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "lms_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_materials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          event_type: string
          id: string
          outbox_event_id: string | null
          payload: Json
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          event_type: string
          id?: string
          outbox_event_id?: string | null
          payload?: Json
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          event_type?: string
          id?: string
          outbox_event_id?: string | null
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_notifications_outbox_event_id_fkey"
            columns: ["outbox_event_id"]
            isOneToOne: false
            referencedRelation: "lms_outbox_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_occurrence_assignments: {
        Row: {
          added_by: string
          assignment_id: string
          created_at: string
          occurrence_id: string
          relation_type: string
        }
        Insert: {
          added_by: string
          assignment_id: string
          created_at?: string
          occurrence_id: string
          relation_type?: string
        }
        Update: {
          added_by?: string
          assignment_id?: string
          created_at?: string
          occurrence_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_occurrence_assignments_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_assignments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_assignments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_assignments_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "lms_lesson_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_occurrence_resources: {
        Row: {
          added_by: string
          created_at: string
          occurrence_id: string
          order_index: number
          required: boolean
          resource_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          occurrence_id: string
          order_index?: number
          required?: boolean
          resource_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          occurrence_id?: string
          order_index?: number
          required?: boolean
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_occurrence_resources_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_resources_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "lms_lesson_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "lms_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_occurrence_roster_snapshots: {
        Row: {
          captured_at: string
          class_membership_id: string | null
          enrollment_status: string
          occurrence_id: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          class_membership_id?: string | null
          enrollment_status?: string
          occurrence_id: string
          user_id: string
        }
        Update: {
          captured_at?: string
          class_membership_id?: string | null
          enrollment_status?: string
          occurrence_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_occurrence_roster_snapshots_class_membership_id_fkey"
            columns: ["class_membership_id"]
            isOneToOne: false
            referencedRelation: "class_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_roster_snapshots_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "lms_lesson_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_occurrence_roster_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_operation_audit_events: {
        Row: {
          actor_id: string
          after_state: Json
          before_state: Json
          class_id: string | null
          club_id: string
          created_at: string
          entity_id: string | null
          id: string
          idempotency_key: string | null
          operation: string
        }
        Insert: {
          actor_id: string
          after_state?: Json
          before_state?: Json
          class_id?: string | null
          club_id: string
          created_at?: string
          entity_id?: string | null
          id?: string
          idempotency_key?: string | null
          operation: string
        }
        Update: {
          actor_id?: string
          after_state?: Json
          before_state?: Json
          class_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          idempotency_key?: string | null
          operation?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_operation_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_operation_audit_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_operation_audit_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_operation_audit_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_operation_audit_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_operation_receipts: {
        Row: {
          actor_id: string
          created_at: string
          idempotency_key: string
          input_hash: string
          operation: string
          result: Json
        }
        Insert: {
          actor_id: string
          created_at?: string
          idempotency_key: string
          input_hash: string
          operation: string
          result: Json
        }
        Update: {
          actor_id?: string
          created_at?: string
          idempotency_key?: string
          input_hash?: string
          operation?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lms_operation_receipts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_outbox_events: {
        Row: {
          attempts: number
          available_at: string
          class_id: string | null
          club_id: string
          created_at: string
          dedupe_key: string
          email_recipient_ids: Json
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          recipient_ids: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          class_id?: string | null
          club_id: string
          created_at?: string
          dedupe_key: string
          email_recipient_ids?: Json
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_ids?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          class_id?: string | null
          club_id?: string
          created_at?: string
          dedupe_key?: string
          email_recipient_ids?: Json
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_ids?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_outbox_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_outbox_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_outbox_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_outbox_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_pilot_flags: {
        Row: {
          class_id: string | null
          club_id: string
          created_at: string
          disabled_at: string | null
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
          feature_key: string
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          club_id: string
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          feature_key?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          club_id?: string
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          feature_key?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_pilot_flags_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_pilot_flags_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_pilot_flags_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_pilot_flags_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_pilot_flags_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_resource_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          class_id: string | null
          course_id: string | null
          id: string
          resource_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          class_id?: string | null
          course_id?: string | null
          id?: string
          resource_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          class_id?: string | null
          course_id?: string | null
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_resource_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resource_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resource_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resource_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resource_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "lms_resource_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "lms_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_resources: {
        Row: {
          archived_at: string | null
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          kind: string
          license_status: string
          metadata: Json
          mime_type: string | null
          provenance: string | null
          published_at: string | null
          scope_class_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          kind: string
          license_status?: string
          metadata?: Json
          mime_type?: string | null
          provenance?: string | null
          published_at?: string | null
          scope_class_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          kind?: string
          license_status?: string
          metadata?: Json
          mime_type?: string | null
          provenance?: string | null
          published_at?: string | null
          scope_class_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_resources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resources_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_resources_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_vocabulary_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          class_id: string | null
          course_id: string | null
          id: string
          set_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          class_id?: string | null
          course_id?: string | null
          id?: string
          set_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          class_id?: string | null
          course_id?: string | null
          id?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_vocabulary_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_course_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_popular_courses"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "lms_vocabulary_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_assignments_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "lms_vocabulary_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_vocabulary_items: {
        Row: {
          created_at: string
          definition: string
          example: string | null
          id: string
          metadata: Json
          order_index: number
          set_id: string
          term: string
          translation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition: string
          example?: string | null
          id?: string
          metadata?: Json
          order_index?: number
          set_id: string
          term: string
          translation?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: string
          example?: string | null
          id?: string
          metadata?: Json
          order_index?: number
          set_id?: string
          term?: string
          translation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_vocabulary_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "lms_vocabulary_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_vocabulary_sets: {
        Row: {
          archived_at: string | null
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          license_status: string
          metadata: Json
          provenance: string | null
          published_at: string | null
          scope_class_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          license_status?: string
          metadata?: Json
          provenance?: string | null
          published_at?: string | null
          scope_class_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          license_status?: string
          metadata?: Json
          provenance?: string | null
          published_at?: string | null
          scope_class_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_vocabulary_sets_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_sets_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_sets_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_vocabulary_sets_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_settings: {
        Row: {
          banner_message_en: string
          banner_message_vi: string
          expected_done_at: string | null
          full_message_en: string
          full_message_vi: string
          id: string
          mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banner_message_en: string
          banner_message_vi: string
          expected_done_at?: string | null
          full_message_en: string
          full_message_vi: string
          id?: string
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banner_message_en?: string
          banner_message_vi?: string
          expected_done_at?: string | null
          full_message_en?: string
          full_message_vi?: string
          id?: string
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_jobs: {
        Row: {
          attempts: number
          available_at: string
          channel: string
          completed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          inbox_item_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          provider_message_id: string | null
          recipient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          channel: string
          completed_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          idempotency_key: string
          inbox_item_id: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          provider_message_id?: string | null
          recipient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          idempotency_key?: string
          inbox_item_id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          provider_message_id?: string | null
          recipient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_jobs_inbox_item_id_fkey"
            columns: ["inbox_item_id"]
            isOneToOne: false
            referencedRelation: "notification_inbox_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_jobs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          event_key: string
          event_type: string
          id: string
          importance: string
          message_class: string
          payload: Json
          source: string
          subject_id: string | null
          subject_type: string | null
          title: string
          topic: string | null
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          importance?: string
          message_class?: string
          payload?: Json
          source?: string
          subject_id?: string | null
          subject_type?: string | null
          title: string
          topic?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          importance?: string
          message_class?: string
          payload?: Json
          source?: string
          subject_id?: string | null
          subject_type?: string | null
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_inbox_items: {
        Row: {
          archived_at: string | null
          created_at: string
          event_id: string
          id: string
          read_at: string | null
          recipient_id: string
          state: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          read_at?: string | null
          recipient_id: string
          state?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_inbox_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_inbox_items_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_mutes: {
        Row: {
          channel: string
          created_at: string
          id: string
          muted_until: string | null
          subject_id: string
          subject_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          muted_until?: string | null
          subject_id: string
          subject_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          muted_until?: string | null
          subject_id?: string
          subject_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          enabled: boolean
          event_type: string
          frequency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          enabled?: boolean
          event_type: string
          frequency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          event_type?: string
          frequency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_user_settings: {
        Row: {
          digest_frequency: string
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          digest_frequency?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          digest_frequency?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      observability_bug_deliveries: {
        Row: {
          applied: boolean
          completed_at: string | null
          created_at: string
          delivery_id: string
          environment: string
          fingerprint: string
          lease_expires_at: string | null
          lease_token: string | null
          previous_alert_status: string | null
          service: string
        }
        Insert: {
          applied?: boolean
          completed_at?: string | null
          created_at?: string
          delivery_id: string
          environment: string
          fingerprint: string
          lease_expires_at?: string | null
          lease_token?: string | null
          previous_alert_status?: string | null
          service: string
        }
        Update: {
          applied?: boolean
          completed_at?: string | null
          created_at?: string
          delivery_id?: string
          environment?: string
          fingerprint?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          previous_alert_status?: string | null
          service?: string
        }
        Relationships: [
          {
            foreignKeyName: "observability_bug_deliveries_fingerprint_service_environme_fkey"
            columns: ["fingerprint", "service", "environment"]
            isOneToOne: false
            referencedRelation: "observability_bug_incidents"
            referencedColumns: ["fingerprint", "service", "environment"]
          },
        ]
      }
      observability_bug_incidents: {
        Row: {
          affected_sessions: number
          alert_status: string
          clickup_task_id: string | null
          created_at: string
          creation_lease_expires_at: string | null
          creation_lease_token: string | null
          environment: string
          fingerprint: string
          first_seen_at: string
          last_seen_at: string
          occurrence_count: number
          service: string
          severity: string
          updated_at: string
        }
        Insert: {
          affected_sessions?: number
          alert_status: string
          clickup_task_id?: string | null
          created_at?: string
          creation_lease_expires_at?: string | null
          creation_lease_token?: string | null
          environment: string
          fingerprint: string
          first_seen_at: string
          last_seen_at: string
          occurrence_count?: number
          service: string
          severity: string
          updated_at?: string
        }
        Update: {
          affected_sessions?: number
          alert_status?: string
          clickup_task_id?: string | null
          created_at?: string
          creation_lease_expires_at?: string | null
          creation_lease_token?: string | null
          environment?: string
          fingerprint?: string
          first_seen_at?: string
          last_seen_at?: string
          occurrence_count?: number
          service?: string
          severity?: string
          updated_at?: string
        }
        Relationships: []
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
      organization_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          idempotency_key: string | null
          organization_id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          idempotency_key?: string | null
          organization_id: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          idempotency_key?: string | null
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_operation_idempotency: {
        Row: {
          actor_id: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          request_hash: string
          response_payload: Json | null
        }
        Insert: {
          actor_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          request_hash: string
          response_payload?: Json | null
        }
        Update: {
          actor_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          request_hash?: string
          response_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_operation_idempotency_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_question_import_entitlements: {
        Row: {
          club_id: string
          concurrent_job_limit: number
          max_file_size_bytes: number
          max_files_per_batch: number
          max_pages_per_file: number
          monthly_page_limit: number
          monthly_question_limit: number
          updated_at: string
        }
        Insert: {
          club_id: string
          concurrent_job_limit?: number
          max_file_size_bytes?: number
          max_files_per_batch?: number
          max_pages_per_file?: number
          monthly_page_limit?: number
          monthly_question_limit?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          concurrent_job_limit?: number
          max_file_size_bytes?: number
          max_files_per_batch?: number
          max_pages_per_file?: number
          monthly_page_limit?: number
          monthly_question_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_question_import_entitlements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_question_import_entitlements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_question_import_usage: {
        Row: {
          bucket_month: string
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          jobs: number
          kind: Database["public"]["Enums"]["question_import_usage_kind"]
          pages: number
          questions: number
          reservation_key: string
        }
        Insert: {
          bucket_month: string
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          jobs?: number
          kind: Database["public"]["Enums"]["question_import_usage_kind"]
          pages?: number
          questions?: number
          reservation_key: string
        }
        Update: {
          bucket_month?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          jobs?: number
          kind?: Database["public"]["Enums"]["question_import_usage_kind"]
          pages?: number
          questions?: number
          reservation_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_question_import_usage_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_question_import_usage_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_question_import_usage_created_by_fkey"
            columns: ["created_by"]
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
          client_attempt_alias: string | null
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
          client_attempt_alias?: string | null
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
          client_attempt_alias?: string | null
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
      question_bank_collections: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          kind: string
          module: Database["public"]["Enums"]["ielts_module"]
          published_at: string | null
          quarantine_reason: string | null
          status: Database["public"]["Enums"]["question_bank_collection_status"]
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          module?: Database["public"]["Enums"]["ielts_module"]
          published_at?: string | null
          quarantine_reason?: string | null
          status?: Database["public"]["Enums"]["question_bank_collection_status"]
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          module?: Database["public"]["Enums"]["ielts_module"]
          published_at?: string | null
          quarantine_reason?: string | null
          status?: Database["public"]["Enums"]["question_bank_collection_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_collections_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_collections_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_items: {
        Row: {
          club_id: string
          collection_id: string
          created_at: string
          id: string
          ordinal: number
          payload: Json
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_action_at: string | null
          source_action_by: string | null
          source_action_reason: string | null
          source_draft_item_id: string | null
          source_evidence: Json
          source_lifecycle: string
          source_prior_lifecycle: string | null
          stimulus_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          collection_id: string
          created_at?: string
          id?: string
          ordinal: number
          payload?: Json
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_action_at?: string | null
          source_action_by?: string | null
          source_action_reason?: string | null
          source_draft_item_id?: string | null
          source_evidence?: Json
          source_lifecycle?: string
          source_prior_lifecycle?: string | null
          stimulus_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          collection_id?: string
          created_at?: string
          id?: string
          ordinal?: number
          payload?: Json
          question_type?: Database["public"]["Enums"]["ielts_question_type"]
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_action_at?: string | null
          source_action_by?: string | null
          source_action_reason?: string | null
          source_draft_item_id?: string | null
          source_evidence?: Json
          source_lifecycle?: string
          source_prior_lifecycle?: string | null
          stimulus_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "question_bank_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_source_action_by_fkey"
            columns: ["source_action_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_source_draft_item_id_fkey"
            columns: ["source_draft_item_id"]
            isOneToOne: false
            referencedRelation: "question_import_draft_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_stimulus_id_fkey"
            columns: ["stimulus_id"]
            isOneToOne: false
            referencedRelation: "question_bank_stimuli"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_keys: {
        Row: {
          answer_payload: Json
          bank_item_id: string
          club_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          answer_payload?: Json
          bank_item_id: string
          club_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          answer_payload?: Json
          bank_item_id?: string
          club_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_keys_bank_item_id_fkey"
            columns: ["bank_item_id"]
            isOneToOne: true
            referencedRelation: "question_bank_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_keys_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_keys_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_stimuli: {
        Row: {
          club_id: string
          collection_id: string
          created_at: string
          id: string
          ordinal: number
          payload: Json
          stimulus_kind: string
          updated_at: string
        }
        Insert: {
          club_id: string
          collection_id: string
          created_at?: string
          id?: string
          ordinal?: number
          payload?: Json
          stimulus_kind: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          collection_id?: string
          created_at?: string
          id?: string
          ordinal?: number
          payload?: Json
          stimulus_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_stimuli_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_stimuli_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_stimuli_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "question_bank_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      question_import_batch_documents: {
        Row: {
          batch_id: string
          club_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          material_id: string | null
          media_material_id: string | null
          media_version_id: string | null
          page_count: number | null
          provider_job_id: string | null
          provider_result: Json
          provider_status: string | null
          provider_usage: Json
          scanned: boolean
          sha256: string | null
          size_bytes: number | null
          source_file_name: string
          source_mime_type: string
          source_prior_status:
            | Database["public"]["Enums"]["question_import_document_status"]
            | null
          status: Database["public"]["Enums"]["question_import_document_status"]
          updated_at: string
          version_id: string | null
        }
        Insert: {
          batch_id: string
          club_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          material_id?: string | null
          media_material_id?: string | null
          media_version_id?: string | null
          page_count?: number | null
          provider_job_id?: string | null
          provider_result?: Json
          provider_status?: string | null
          provider_usage?: Json
          scanned?: boolean
          sha256?: string | null
          size_bytes?: number | null
          source_file_name: string
          source_mime_type?: string
          source_prior_status?:
            | Database["public"]["Enums"]["question_import_document_status"]
            | null
          status?: Database["public"]["Enums"]["question_import_document_status"]
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          batch_id?: string
          club_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          material_id?: string | null
          media_material_id?: string | null
          media_version_id?: string | null
          page_count?: number | null
          provider_job_id?: string | null
          provider_result?: Json
          provider_status?: string | null
          provider_usage?: Json
          scanned?: boolean
          sha256?: string | null
          size_bytes?: number | null
          source_file_name?: string
          source_mime_type?: string
          source_prior_status?:
            | Database["public"]["Enums"]["question_import_document_status"]
            | null
          status?: Database["public"]["Enums"]["question_import_document_status"]
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_import_batch_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "question_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_media_material_id_fkey"
            columns: ["media_material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_media_version_id_fkey"
            columns: ["media_version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_import_batches: {
        Row: {
          club_id: string
          completed_at: string | null
          copyright_attestation_locale: string
          copyright_attestation_version: string | null
          copyright_attested: boolean
          copyright_attested_at: string | null
          copyright_attested_by: string | null
          created_at: string
          created_by: string
          failure_code: string | null
          failure_message: string | null
          id: string
          module: Database["public"]["Enums"]["ielts_module"]
          parser_provider: string
          parser_version: string | null
          prompt_version: string | null
          quarantine_reason: string | null
          quota_reservation_key: string | null
          source_prior_status:
            | Database["public"]["Enums"]["question_import_status"]
            | null
          status: Database["public"]["Enums"]["question_import_status"]
          submitted_at: string | null
          title: string
          total_files: number
          total_pages: number
          total_questions: number
          updated_at: string
        }
        Insert: {
          club_id: string
          completed_at?: string | null
          copyright_attestation_locale?: string
          copyright_attestation_version?: string | null
          copyright_attested?: boolean
          copyright_attested_at?: string | null
          copyright_attested_by?: string | null
          created_at?: string
          created_by: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          module?: Database["public"]["Enums"]["ielts_module"]
          parser_provider?: string
          parser_version?: string | null
          prompt_version?: string | null
          quarantine_reason?: string | null
          quota_reservation_key?: string | null
          source_prior_status?:
            | Database["public"]["Enums"]["question_import_status"]
            | null
          status?: Database["public"]["Enums"]["question_import_status"]
          submitted_at?: string | null
          title: string
          total_files?: number
          total_pages?: number
          total_questions?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          completed_at?: string | null
          copyright_attestation_locale?: string
          copyright_attestation_version?: string | null
          copyright_attested?: boolean
          copyright_attested_at?: string | null
          copyright_attested_by?: string | null
          created_at?: string
          created_by?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          module?: Database["public"]["Enums"]["ielts_module"]
          parser_provider?: string
          parser_version?: string | null
          prompt_version?: string | null
          quarantine_reason?: string | null
          quota_reservation_key?: string | null
          source_prior_status?:
            | Database["public"]["Enums"]["question_import_status"]
            | null
          status?: Database["public"]["Enums"]["question_import_status"]
          submitted_at?: string | null
          title?: string
          total_files?: number
          total_pages?: number
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_import_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batches_copyright_attested_by_fkey"
            columns: ["copyright_attested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_import_compliance_events: {
        Row: {
          actor_id: string | null
          batch_id: string | null
          club_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          batch_id?: string | null
          club_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          batch_id?: string | null
          club_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_import_compliance_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_compliance_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "question_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_compliance_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_compliance_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      question_import_draft_items: {
        Row: {
          answer_source: string
          batch_id: string
          club_id: string
          confidence: number | null
          created_at: string
          document_id: string
          id: string
          ordinal: number
          payload: Json
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_action_at: string | null
          source_action_by: string | null
          source_action_reason: string | null
          source_evidence: Json
          source_lifecycle: string
          source_prior_lifecycle: string | null
          status: Database["public"]["Enums"]["question_import_item_status"]
          updated_at: string
        }
        Insert: {
          answer_source?: string
          batch_id: string
          club_id: string
          confidence?: number | null
          created_at?: string
          document_id: string
          id?: string
          ordinal: number
          payload?: Json
          question_type: Database["public"]["Enums"]["ielts_question_type"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_action_at?: string | null
          source_action_by?: string | null
          source_action_reason?: string | null
          source_evidence?: Json
          source_lifecycle?: string
          source_prior_lifecycle?: string | null
          status?: Database["public"]["Enums"]["question_import_item_status"]
          updated_at?: string
        }
        Update: {
          answer_source?: string
          batch_id?: string
          club_id?: string
          confidence?: number | null
          created_at?: string
          document_id?: string
          id?: string
          ordinal?: number
          payload?: Json
          question_type?: Database["public"]["Enums"]["ielts_question_type"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill?: Database["public"]["Enums"]["ielts_skill"]
          source_action_at?: string | null
          source_action_by?: string | null
          source_action_reason?: string | null
          source_evidence?: Json
          source_lifecycle?: string
          source_prior_lifecycle?: string | null
          status?: Database["public"]["Enums"]["question_import_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_import_draft_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "question_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "question_import_batch_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "question_import_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_items_source_action_by_fkey"
            columns: ["source_action_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_import_draft_keys: {
        Row: {
          answer_confirmed: boolean
          answer_payload: Json
          club_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          draft_item_id: string
          updated_at: string
        }
        Insert: {
          answer_confirmed?: boolean
          answer_payload?: Json
          club_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          draft_item_id: string
          updated_at?: string
        }
        Update: {
          answer_confirmed?: boolean
          answer_payload?: Json
          club_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          draft_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_import_draft_keys_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_keys_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_keys_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_draft_keys_draft_item_id_fkey"
            columns: ["draft_item_id"]
            isOneToOne: true
            referencedRelation: "question_import_draft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      question_import_publication_receipts: {
        Row: {
          batch_id: string
          club_id: string
          collection_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          item_ids: string[] | null
          published_count: number
        }
        Insert: {
          batch_id: string
          club_id: string
          collection_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          item_ids?: string[] | null
          published_count?: number
        }
        Update: {
          batch_id?: string
          club_id?: string
          collection_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          item_ids?: string[] | null
          published_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_import_publication_receipts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "question_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_publication_receipts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_publication_receipts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_publication_receipts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "question_bank_collections"
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
      resources: {
        Row: {
          access_level: string
          club_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          mime_type: string | null
          published: boolean
          size_bytes: number | null
          storage_path: string | null
          subject: string
          tags: string[]
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          access_level?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          published?: boolean
          size_bytes?: number | null
          storage_path?: string | null
          subject?: string
          tags?: string[]
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          access_level?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          published?: boolean
          size_bytes?: number | null
          storage_path?: string | null
          subject?: string
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_created_by_fkey"
            columns: ["created_by"]
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
      roster_import_batches: {
        Row: {
          class_id: string | null
          club_id: string
          created_at: string
          created_by: string | null
          created_count: number
          error_count: number
          id: string
          idempotency_key: string | null
          invited_count: number
          metadata: Json
          report: Json
          row_count: number
          skipped_count: number
          source_filename: string | null
          updated_at: string
          updated_count: number
        }
        Insert: {
          class_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_count?: number
          id?: string
          idempotency_key?: string | null
          invited_count?: number
          metadata?: Json
          report?: Json
          row_count?: number
          skipped_count?: number
          source_filename?: string | null
          updated_at?: string
          updated_count?: number
        }
        Update: {
          class_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_count?: number
          id?: string
          idempotency_key?: string | null
          invited_count?: number
          metadata?: Json
          report?: Json
          row_count?: number
          skipped_count?: number
          source_filename?: string | null
          updated_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_import_batches_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_import_batches_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_import_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_import_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_import_batches_created_by_fkey"
            columns: ["created_by"]
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
          audio_mime_type: string | null
          audio_sha256: string | null
          audio_size_bytes: number | null
          audio_storage_path: string | null
          audio_verified_at: string | null
          created_at: string
          feedback: Json
          feedback_language: string
          fluency_coherence_band: number | null
          grading_metadata: Json
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
          revision: number
          revision_consumed_at: string | null
          revision_grant: number | null
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
          audio_mime_type?: string | null
          audio_sha256?: string | null
          audio_size_bytes?: number | null
          audio_storage_path?: string | null
          audio_verified_at?: string | null
          created_at?: string
          feedback?: Json
          feedback_language?: string
          fluency_coherence_band?: number | null
          grading_metadata?: Json
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
          revision?: number
          revision_consumed_at?: string | null
          revision_grant?: number | null
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
          audio_mime_type?: string | null
          audio_sha256?: string | null
          audio_size_bytes?: number | null
          audio_storage_path?: string | null
          audio_verified_at?: string | null
          created_at?: string
          feedback?: Json
          feedback_language?: string
          fluency_coherence_band?: number | null
          grading_metadata?: Json
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
          revision?: number
          revision_consumed_at?: string | null
          revision_grant?: number | null
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
      student_record_enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrolled_at: string
          id: string
          import_batch_id: string | null
          metadata: Json
          removed_at: string | null
          status: string
          student_record_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          import_batch_id?: string | null
          metadata?: Json
          removed_at?: string | null
          status?: string
          student_record_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          import_batch_id?: string | null
          metadata?: Json
          removed_at?: string | null
          status?: string
          student_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_record_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_record_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_record_enrollments_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "roster_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_record_enrollments_student_record_id_fkey"
            columns: ["student_record_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id"]
          },
        ]
      }
      student_records: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          import_batch_id: string | null
          invitation_sent_at: string | null
          metadata: Json
          notes: string | null
          phone: string | null
          status: string
          student_code: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          import_batch_id?: string | null
          invitation_sent_at?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          status?: string
          student_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          import_batch_id?: string | null
          invitation_sent_at?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          status?: string
          student_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_records_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_records_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_records_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "roster_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_records_user_id_fkey"
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
      teacher_workspace_class_preferences: {
        Row: {
          class_id: string
          color_token: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          color_token?: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          color_token?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_workspace_class_preferences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_workspace_class_preferences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_workspace_class_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_workspace_preferences: {
        Row: {
          created_at: string
          default_calendar_view: string
          timezone: string | null
          timezone_mode: string
          updated_at: string
          user_id: string
          week_start: number
          working_hour_end: string
          working_hour_start: string
        }
        Insert: {
          created_at?: string
          default_calendar_view?: string
          timezone?: string | null
          timezone_mode?: string
          updated_at?: string
          user_id: string
          week_start?: number
          working_hour_end?: string
          working_hour_start?: string
        }
        Update: {
          created_at?: string
          default_calendar_view?: string
          timezone?: string | null
          timezone_mode?: string
          updated_at?: string
          user_id?: string
          week_start?: number
          working_hour_end?: string
          working_hour_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_workspace_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      user_age_assurance: {
        Row: {
          age_band: string
          consent_status: string
          consent_version: string
          created_at: string
          guardian_acted_at: string | null
          guardian_email: string | null
          updated_at: string
          user_id: string
          verification_expires_at: string | null
          verification_token_hash: string | null
        }
        Insert: {
          age_band: string
          consent_status: string
          consent_version?: string
          created_at?: string
          guardian_acted_at?: string | null
          guardian_email?: string | null
          updated_at?: string
          user_id: string
          verification_expires_at?: string | null
          verification_token_hash?: string | null
        }
        Update: {
          age_band?: string
          consent_status?: string
          consent_version?: string
          created_at?: string
          guardian_acted_at?: string | null
          guardian_email?: string | null
          updated_at?: string
          user_id?: string
          verification_expires_at?: string | null
          verification_token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_age_assurance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      vocab_items: {
        Row: {
          band_tag: string | null
          collocations: string[]
          created_at: string
          created_by: string | null
          definition_en: string | null
          definition_vi: string | null
          example: string | null
          id: string
          part_of_speech: string | null
          phonetic: string | null
          source: string | null
          subject: string
          synonyms: string[]
          term: string
          topic_tags: string[]
          updated_at: string
        }
        Insert: {
          band_tag?: string | null
          collocations?: string[]
          created_at?: string
          created_by?: string | null
          definition_en?: string | null
          definition_vi?: string | null
          example?: string | null
          id?: string
          part_of_speech?: string | null
          phonetic?: string | null
          source?: string | null
          subject?: string
          synonyms?: string[]
          term: string
          topic_tags?: string[]
          updated_at?: string
        }
        Update: {
          band_tag?: string | null
          collocations?: string[]
          created_at?: string
          created_by?: string | null
          definition_en?: string | null
          definition_vi?: string | null
          example?: string | null
          id?: string
          part_of_speech?: string | null
          phonetic?: string | null
          source?: string | null
          subject?: string
          synonyms?: string[]
          term?: string
          topic_tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocab_items_created_by_fkey"
            columns: ["created_by"]
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
          criteria_feedback: Json
          essay: string
          feedback_language: string
          grading_metadata: Json
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
          revision: number
          revision_consumed_at: string | null
          revision_grant: number | null
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
          criteria_feedback?: Json
          essay?: string
          feedback_language?: string
          grading_metadata?: Json
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
          revision?: number
          revision_consumed_at?: string | null
          revision_grant?: number | null
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
          criteria_feedback?: Json
          essay?: string
          feedback_language?: string
          grading_metadata?: Json
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
          revision?: number
          revision_consumed_at?: string | null
          revision_grant?: number | null
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
      ielts_published_criterion_feedback: {
        Row: {
          assignment_id: string | null
          attempt_id: string | null
          class_id: string | null
          club_id: string | null
          criterion_feedback: Json | null
          id: string | null
          published_at: string | null
          review_kind: string | null
          revision: number | null
          speaking_response_id: string | null
          user_id: string | null
          writing_response_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          attempt_id?: string | null
          class_id?: string | null
          club_id?: string | null
          criterion_feedback?: Json | null
          id?: string | null
          published_at?: string | null
          review_kind?: string | null
          revision?: number | null
          speaking_response_id?: string | null
          user_id?: string | null
          writing_response_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          attempt_id?: string | null
          class_id?: string | null
          club_id?: string | null
          criterion_feedback?: Json | null
          id?: string | null
          published_at?: string | null
          review_kind?: string | null
          revision?: number | null
          speaking_response_id?: string | null
          user_id?: string | null
          writing_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ielts_teacher_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "admin_club_assignment_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "club_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "ielts_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "admin_class_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_speaking_response_id_fkey"
            columns: ["speaking_response_id"]
            isOneToOne: false
            referencedRelation: "speaking_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ielts_teacher_reviews_writing_response_id_fkey"
            columns: ["writing_response_id"]
            isOneToOne: false
            referencedRelation: "writing_responses"
            referencedColumns: ["id"]
          },
        ]
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
      question_import_documents: {
        Row: {
          batch_id: string | null
          club_id: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          file_name: string | null
          id: string | null
          material_id: string | null
          material_version_id: string | null
          media_material_id: string | null
          media_version_id: string | null
          page_count: number | null
          provider_job_id: string | null
          provider_result: Json | null
          provider_status: string | null
          provider_usage: Json | null
          scanned: boolean | null
          sha256: string | null
          size_bytes: number | null
          source_file_name: string | null
          source_mime_type: string | null
          status:
            | Database["public"]["Enums"]["question_import_document_status"]
            | null
          storage_path: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_import_batch_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "question_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "admin_club_list_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_media_material_id_fkey"
            columns: ["media_material_id"]
            isOneToOne: false
            referencedRelation: "lms_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_media_version_id_fkey"
            columns: ["media_version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_import_batch_documents_version_id_fkey"
            columns: ["material_version_id"]
            isOneToOne: false
            referencedRelation: "lms_material_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_organization_transaction: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_organization_id: string
        }
        Returns: Json
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
      admin_override_publish_ielts_teacher_review: {
        Args: { p_actor_id?: string; p_reason: string; p_review_id: string }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_override_return_ielts_teacher_review: {
        Args: {
          p_actor_id?: string
          p_note?: string
          p_reason: string
          p_review_id: string
        }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
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
      archive_class_schedule_transaction: {
        Args: { p_class_id: string; p_schedule_id: string }
        Returns: string
      }
      archive_class_transaction: {
        Args: { p_class_id: string }
        Returns: string
      }
      assign_organization_course_transaction: {
        Args: {
          p_action: string
          p_actor_id: string
          p_class_id: string
          p_course_id: string
          p_idempotency_key: string
          p_organization_id: string
        }
        Returns: Json
      }
      assign_organization_material_transaction: {
        Args: {
          p_actor_id: string
          p_class_id: string
          p_idempotency_key: string
          p_material_id: string
          p_organization_id: string
        }
        Returns: Json
      }
      assign_organization_teacher_transaction: {
        Args: {
          p_action: string
          p_actor_id: string
          p_class_id: string
          p_idempotency_key: string
          p_organization_id: string
          p_teacher_id: string
        }
        Returns: Json
      }
      attest_ai_grading_runtime: {
        Args: {
          p_claim_token: string
          p_corpus_version: number
          p_grader_version: string
          p_image_digest: string
          p_run_id: string
          p_runtime_revision: string
        }
        Returns: boolean
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
      begin_ai_grading_operational_evidence: {
        Args: {
          p_corpus_version: number
          p_deployment_id: string
          p_environment: string
          p_grader_version: string
          p_image_digest: string
          p_run_id: string
        }
        Returns: {
          corpus_version: number
          created_at: string
          deployment_id: string
          environment: string
          evidence_hash: string | null
          expires_at: string | null
          grader_version: string
          id: string
          image_digest: string
          run_id: string
          started_at: string
          status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_grading_operational_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      begin_practice_analysis: {
        Args: {
          p_attempt: Json
          p_attempt_id: string
          p_charge_type: string
          p_cost: number
          p_job: Json
          p_job_id: string
          p_user_id: string
        }
        Returns: Json
      }
      block_profile: { Args: { p_target_user_id: string }; Returns: Json }
      bootstrap_ai_grading_environment_marker: {
        Args: {
          p_bootstrap_token: string
          p_environment: string
          p_project_ref: string
        }
        Returns: boolean
      }
      can_access_duel: {
        Args: { p_duel_id: string; p_user_id: string }
        Returns: boolean
      }
      can_access_lms_material_preview: {
        Args: {
          p_placement_id: string
          p_rendition_id: string
          p_version_id: string
        }
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
      center_activate_provider: {
        Args: {
          p_actor_id: string
          p_ciphertext: string
          p_club_id: string
          p_external_id: string
          p_key_name: string
          p_label: string
          p_provider: string
          p_status: string
        }
        Returns: string
      }
      center_apply_verified_payment: {
        Args: {
          p_amount: number
          p_connection_id: string
          p_order_id: string
          p_transaction_id: string
        }
        Returns: Json
      }
      center_attach_checkout: {
        Args: {
          p_attempt_id: string
          p_checkout_url: string
          p_expires_at: string
        }
        Returns: Json
      }
      center_base_snapshot: { Args: { p_club_id: string }; Returns: Json }
      center_bind_google_resource: {
        Args: {
          p_actor_id: string
          p_class_id?: string
          p_club_id: string
          p_external_id: string
          p_kind: string
          p_label: string
          p_metadata?: Json
        }
        Returns: Json
      }
      center_calendar_command_context: {
        Args: { p_event_id: string }
        Returns: Json
      }
      center_chat_complete: {
        Args: {
          p_actions: Json
          p_answer: string
          p_club_id: string
          p_conversation_id: string
          p_request_key: string
          p_sources: Json
        }
        Returns: Json
      }
      center_chat_history: {
        Args: { p_club_id: string; p_conversation_id: string }
        Returns: Json
      }
      center_chat_open: {
        Args: {
          p_club_id: string
          p_conversation_id: string
          p_message: string
          p_request_key: string
        }
        Returns: Json
      }
      center_claim_event: { Args: { p_event_id?: string }; Returns: Json }
      center_claim_guardian_invite: { Args: { p_token: string }; Returns: Json }
      center_claim_token_refresh: {
        Args: { p_connection_id: string; p_expected_updated_at: string }
        Returns: string
      }
      center_create_guardian_invite: {
        Args: {
          p_club_id: string
          p_email: string
          p_full_name: string
          p_key: string
          p_phone: string
          p_student_record_id: string
        }
        Returns: Json
      }
      center_decide_proposal: {
        Args: { p_club_id: string; p_decision: string; p_proposal_id: string }
        Returns: Json
      }
      center_execute_command: {
        Args: {
          p_club_id: string
          p_idempotency_key: string
          p_input: Json
          p_kind: string
        }
        Returns: Json
      }
      center_execute_native_command: {
        Args: {
          p_club_id: string
          p_idempotency_key: string
          p_input: Json
          p_kind: string
        }
        Returns: Json
      }
      center_finish_event: {
        Args: {
          p_error?: string
          p_event_id: string
          p_lease_token: string
          p_status: string
        }
        Returns: Json
      }
      center_finish_sheet_import: {
        Args: { p_batch_id: string; p_staging_id: string }
        Returns: undefined
      }
      center_finish_token_refresh: {
        Args: {
          p_ciphertext: string
          p_connection_id: string
          p_key_name: string
          p_token: string
        }
        Returns: undefined
      }
      center_google_connection_context: {
        Args: { p_actor_id: string; p_club_id: string }
        Returns: Json
      }
      center_google_projection: {
        Args: {
          p_actor_id: string
          p_binding_id: string
          p_cursor?: string
          p_items: Json
          p_mode: string
        }
        Returns: Json
      }
      center_guardian_base_progress: {
        Args: { p_student_record_id: string }
        Returns: Json
      }
      center_guardian_progress: {
        Args: { p_student_record_id: string }
        Returns: Json
      }
      center_guardian_set_preferences: {
        Args: {
          p_guardian_id: string
          p_preferences: Json
          p_student_record_id: string
        }
        Returns: Json
      }
      center_load_credentials: {
        Args: { p_connection_id: string }
        Returns: Json
      }
      center_mark_reconnect: {
        Args: { p_connection_id: string }
        Returns: Json
      }
      center_notification_context: {
        Args: { p_event_id: string }
        Returns: Json
      }
      center_oauth_begin: {
        Args: {
          p_actor_id: string
          p_ciphertext: string
          p_club_id: string
          p_key_name: string
          p_scopes: string[]
          p_state_hash: string
        }
        Returns: Json
      }
      center_oauth_consume: { Args: { p_state_hash: string }; Returns: Json }
      center_prepare_payment: {
        Args: {
          p_connection_id: string
          p_invoice_id: string
          p_order_id: string
        }
        Returns: Json
      }
      center_project_calendar: {
        Args: {
          p_actor_id: string
          p_binding_id: string
          p_from: string
          p_items: Json
          p_until: string
        }
        Returns: Json
      }
      center_queue_google_material: {
        Args: {
          p_actor_id: string
          p_binding_id: string
          p_file_id: string
          p_metadata: Json
          p_size_bytes: number
          p_storage_path: string
          p_version: string
        }
        Returns: Json
      }
      center_record_delivery: {
        Args: {
          p_consumer: string
          p_detail?: Json
          p_event_id: string
          p_provider_id?: string
          p_status: string
        }
        Returns: Json
      }
      center_refresh_credentials: {
        Args: {
          p_ciphertext: string
          p_connection_id: string
          p_expected_updated_at: string
          p_key_name: string
        }
        Returns: Json
      }
      center_reserve_delivery: {
        Args: { p_consumer: string; p_detail?: Json; p_event_id: string }
        Returns: Json
      }
      center_revoke_google_material: {
        Args: { p_actor_id: string; p_binding_id: string }
        Returns: undefined
      }
      center_revoke_guardian_link: {
        Args: {
          p_club_id: string
          p_guardian_id: string
          p_student_record_id: string
        }
        Returns: Json
      }
      center_schedule_reminders: { Args: never; Returns: Json }
      center_snapshot: { Args: { p_club_id: string }; Returns: Json }
      center_store_credentials: {
        Args: {
          p_account_label: string
          p_actor_id: string
          p_ciphertext: string
          p_connection_id: string
          p_key_name: string
          p_scopes: string[]
        }
        Returns: Json
      }
      center_teacher_materials: {
        Args: { p_club_id: string; p_query: string }
        Returns: Json
      }
      checkpoint_ai_grading_output: {
        Args: {
          p_claim_token: string
          p_hash: string
          p_payload: Json
          p_run_id: string
          p_version?: number
        }
        Returns: boolean
      }
      checkpoint_ai_grading_prepared: {
        Args: {
          p_claim_token: string
          p_hash: string
          p_payload: Json
          p_run_id: string
        }
        Returns: boolean
      }
      checkpoint_ai_grading_provider_failure: {
        Args: {
          p_claim_token: string
          p_failure_kind: string
          p_run_id: string
        }
        Returns: boolean
      }
      checkpoint_ai_grading_provisional: {
        Args: {
          p_claim_token: string
          p_hash: string
          p_payload: Json
          p_run_id: string
          p_version: number
          p_workflow_attempt: number
        }
        Returns: string
      }
      claim_ai_coach_turn: {
        Args: {
          p_client_request_id: string
          p_conversation_id: string
          p_lease_seconds?: number
          p_product_context: string
          p_request_hash: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_ai_grading_benchmark_run: {
        Args: {
          p_benchmark_id: string
          p_corpus_version: number
          p_grader_version: string
          p_lease_seconds?: number
          p_pipeline_stage: string
          p_run_kind: string
        }
        Returns: {
          claim_attempt: number
          claim_token: string
          outcome: string
          provider_request_id: string
        }[]
      }
      claim_ai_grading_delivery: {
        Args: {
          p_delivery_attempt: number
          p_delivery_id: string
          p_kind: string
          p_lease_seconds?: number
          p_run_id: string
          p_source_id: string
        }
        Returns: {
          attempt_count: number
          claim_token: string
          manual_retry_count: number
          outcome: string
          output_hash: string
          output_payload: Json
          prepared_payload: Json
          provider_started_at: string
        }[]
      }
      claim_ai_workflow_run: {
        Args: {
          p_launch_token?: string
          p_lease_seconds?: number
          p_phase: string
          p_run_id: string
        }
        Returns: {
          analysis_job_id: string | null
          backend: string
          backend_message_id: string | null
          completed_at: string | null
          core_completed_at: string | null
          created_at: string
          failed_at: string | null
          id: string
          idempotency_key: string
          last_delivery_attempt: number | null
          last_delivery_id: string | null
          last_error_code: string | null
          last_error_message: string | null
          launch_token: string | null
          lease_expires_at: string | null
          manual_retry_count: number
          phase: string
          progress: Json
          provider_attempt_count: number
          published_at: string | null
          speaking_response_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_claim_token: string | null
          workflow_attempt_count: number
          workflow_kind: string
          workflow_run_id: string | null
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_workflow_runs"
          isOneToOne: false
          isSetofReturn: true
        }
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
      claim_lms_outbox_events: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          class_id: string | null
          club_id: string
          created_at: string
          dedupe_key: string
          email_recipient_ids: Json
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          recipient_ids: Json
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lms_outbox_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_notification_delivery_job: {
        Args: { p_job_id: string; p_lease_seconds?: number }
        Returns: {
          attempts: number
          available_at: string
          channel: string
          completed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          inbox_item_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          provider_message_id: string | null
          recipient_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_delivery_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_notification_delivery_jobs: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          channel: string
          completed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          inbox_item_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          provider_message_id: string | null
          recipient_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_delivery_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_observability_bug_incident: {
        Args: {
          p_affected_sessions: number
          p_alert_status: string
          p_delivery_id: string
          p_environment: string
          p_fingerprint: string
          p_first_seen_at: string
          p_last_seen_at: string
          p_occurrence_count: number
          p_service: string
          p_severity: string
        }
        Returns: {
          action: string
          clickup_task_id: string
          effective_severity: string
          lease_token: string
          previous_alert_status: string
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
      claim_question_import_provider_job: {
        Args: {
          p_batch_id: string
          p_document_id: string
          p_pages: number
          p_question_estimate: number
          p_reservation_key: string
        }
        Returns: Json
      }
      cleanup_stale_homework_submissions: {
        Args: { p_before: string; p_limit?: number }
        Returns: {
          previous_state: string
          removed_paths: Json
          submission_id: string
        }[]
      }
      clone_global_course_transaction: {
        Args: {
          p_idempotency_key: string
          p_organization_id: string
          p_slug: string
          p_source_course_id: string
        }
        Returns: Json
      }
      close_leaderboard_season: {
        Args: { p_leaderboard_language?: string; p_season_id: string }
        Returns: {
          resolved_count: number
        }[]
      }
      complete_ai_coach_turn: {
        Args: {
          p_assistant_message: string
          p_attempt_count: number
          p_claim_token: string
          p_response_metadata?: Json
          p_turn_id: string
          p_user_id: string
          p_user_message: string
        }
        Returns: Json
      }
      complete_ai_grading_benchmark_provider: {
        Args: {
          p_benchmark_id: string
          p_claim_token: string
          p_corpus_version: number
          p_grader_version: string
          p_pipeline_stage: string
          p_provider_request_id: string
          p_run_kind: string
        }
        Returns: boolean
      }
      complete_ai_grading_delivery: {
        Args: { p_claim_token: string; p_phase?: string; p_run_id: string }
        Returns: boolean
      }
      complete_lms_outbox_event: {
        Args: { p_error?: string; p_event_id: string; p_success: boolean }
        Returns: {
          attempts: number
          available_at: string
          class_id: string | null
          club_id: string
          created_at: string
          dedupe_key: string
          email_recipient_ids: Json
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          recipient_ids: Json
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lms_outbox_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_notification_delivery_job: {
        Args: {
          p_error?: string
          p_job_id: string
          p_lease_token: string
          p_provider_message_id?: string
          p_success: boolean
        }
        Returns: {
          attempts: number
          available_at: string
          channel: string
          completed_at: string | null
          created_at: string
          event_id: string
          id: string
          idempotency_key: string
          inbox_item_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          provider_message_id: string | null
          recipient_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_delivery_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_observability_bug_delivery: {
        Args: { p_delivery_id: string; p_lease_token: string }
        Returns: undefined
      }
      confirm_question_import_answer: {
        Args: { p_answer_payload: Json; p_draft_item_id: string }
        Returns: undefined
      }
      consume_guardian_consent_token: {
        Args: { p_decision: string; p_token_hash: string }
        Returns: string
      }
      consume_organization_invitation: {
        Args: { p_token_hash: string }
        Returns: Json
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
      create_class_transaction: {
        Args: {
          p_club_id: string
          p_code: string
          p_description: string
          p_end_date: string
          p_grade_level: string
          p_max_students: number
          p_meeting_schedule: string
          p_program_type: string
          p_room: string
          p_start_date: string
          p_status: string
          p_title: string
        }
        Returns: string
      }
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
        SetofOptions: {
          from: "*"
          to: "ielts_questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_class_transaction: {
        Args: {
          p_actor_id: string
          p_club_id: string
          p_code: string
          p_description: string
          p_end_date: string
          p_grade_level: string
          p_idempotency_key: string
          p_max_students: number
          p_meeting_schedule: string
          p_organization_id: string
          p_program_type: string
          p_room: string
          p_start_date: string
          p_status: string
          p_title: string
        }
        Returns: Json
      }
      create_organization_draft_transaction: {
        Args: {
          p_actor_id: string
          p_city: string
          p_code: string
          p_country: string
          p_idempotency_key: string
          p_name: string
          p_organization_type: string
          p_timezone: string
        }
        Returns: Json
      }
      create_question_bank_collection: {
        Args: {
          p_club_id: string
          p_kind: string
          p_module: Database["public"]["Enums"]["ielts_module"]
          p_title: string
        }
        Returns: string
      }
      create_question_import_batch: {
        Args: {
          p_actor_id: string
          p_club_id: string
          p_copyright_attestation_locale: string
          p_copyright_attestation_version: string
          p_module: Database["public"]["Enums"]["ielts_module"]
          p_title: string
        }
        Returns: string
      }
      create_zalopay_payment_order: {
        Args: {
          p_amount: number
          p_app_trans_id: string
          p_billing_cycle: string
          p_currency: string
          p_plan_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      credit_referral: { Args: { p_referral_id: string }; Returns: undefined }
      declare_ai_grading_operational_scenario: {
        Args: {
          p_evidence_id: string
          p_scenario: string
          p_workflow_run_id: string
        }
        Returns: {
          declared_at: string
          evidence_id: string
          id: string
          injection_token: string
          scenario: string
          workflow_run_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_grading_operational_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_class_attendance_transaction: {
        Args: { p_class_id: string; p_session_id: string }
        Returns: string
      }
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
      enqueue_lms_due_soon_events: {
        Args: { p_horizon?: string }
        Returns: number
      }
      enqueue_notification_event: {
        Args: {
          p_actor_id?: string
          p_body: string
          p_enqueue_delivery_jobs?: boolean
          p_event_key: string
          p_event_type: string
          p_importance?: string
          p_message_class?: string
          p_payload?: Json
          p_recipient_ids: string[]
          p_source?: string
          p_subject_id?: string
          p_subject_type?: string
          p_title: string
          p_topic?: string
        }
        Returns: string
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
      ensure_ielts_coach_conversation: {
        Args: {
          p_client_request_id: string
          p_context_id?: string
          p_context_type: string
          p_title?: string
        }
        Returns: string
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
      fail_ai_coach_turn: {
        Args: {
          p_attempt_count: number
          p_claim_token: string
          p_error_code: string
          p_turn_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      fail_ai_grading_benchmark_provider: {
        Args: {
          p_benchmark_id: string
          p_claim_token: string
          p_corpus_version: number
          p_grader_version: string
          p_pipeline_stage: string
          p_provider_request_ids: string[]
          p_run_kind: string
        }
        Returns: {
          outcome: string
        }[]
      }
      fail_ai_grading_delivery: {
        Args: {
          p_claim_token: string
          p_error_code: string
          p_error_message: string
          p_retryable: boolean
          p_run_id: string
        }
        Returns: string
      }
      fail_homework_submission: {
        Args: { p_reason: string; p_submission_id: string; p_user_id: string }
        Returns: string
      }
      fail_zalopay_payment_order: {
        Args: { p_app_trans_id: string }
        Returns: undefined
      }
      finalize_ai_grading_operational_scenario: {
        Args: {
          p_claim_id: string
          p_details_hash: string
          p_injection_token: string
          p_invalid_authoritative_citation_count: number
        }
        Returns: {
          claim_id: string
          details_hash: string
          evidence_id: string
          expected_provider_calls: number
          finalized_at: string
          id: string
          invalid_authoritative_citation_count: number
          observed_provider_calls: number
          passed: boolean
          scenario: string
          terminal_status: string
          workflow_run_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_grading_operational_scenarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_debate_duel_stats: {
        Args: { p_duel_id: string; p_duration_minutes: number; p_xp: number }
        Returns: undefined
      }
      finalize_homework_submission: {
        Args: {
          p_storage_paths: Json
          p_submission_id: string
          p_user_id: string
        }
        Returns: string
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
      get_ai_grading_environment_marker: {
        Args: never
        Returns: {
          environment: string
          project_ref: string
        }[]
      }
      get_chat_sidebar_payload: {
        Args: { p_product_context?: string }
        Returns: Json
      }
      get_homework_submission_roster: {
        Args: { p_assignment_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
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
      get_question_import_quota: { Args: { p_club_id: string }; Returns: Json }
      get_skill_breakdown: { Args: { p_user_id: string }; Returns: Json }
      grade_curriculum_quiz_submission: {
        Args: { p_answers: Json; p_lesson_id: string }
        Returns: {
          is_correct: boolean
          max_points: number
          points: number
          question_id: string
        }[]
      }
      grade_homework_submission: {
        Args: {
          p_club_id: string
          p_feedback: string
          p_grade_status: string
          p_rubric_breakdown: Json
          p_score: number
          p_score_max: number
          p_submission_id: string
        }
        Returns: string
      }
      grant_feedback_popup_reward: {
        Args: { p_amount?: number; p_response_id: string; p_user_id: string }
        Returns: number
      }
      head_teacher_override_publish_ielts_review: {
        Args: {
          p_idempotency_key: string
          p_reason: string
          p_review_id: string
        }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      head_teacher_override_return_ielts_review: {
        Args: {
          p_idempotency_key: string
          p_note: string
          p_reason: string
          p_review_id: string
        }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ielts_create_attempt_with_blueprint: {
        Args: {
          p_assignment_id?: string
          p_attempt_number: number
          p_class_id?: string
          p_club_id?: string
          p_module: Database["public"]["Enums"]["ielts_module"]
          p_sections: Json
          p_test_id: string
          p_user_id: string
        }
        Returns: string
      }
      ielts_finalize_attempt: {
        Args: { p_attempt_id: string }
        Returns: string
      }
      ielts_pause_attempt_section: {
        Args: { p_section_id: string }
        Returns: undefined
      }
      ielts_pause_attempt_section_v2: {
        Args: { p_attempt_id: string; p_section_id: string }
        Returns: undefined
      }
      ielts_record_question_response: {
        Args: { p_question_id: string; p_response: Json; p_section_id: string }
        Returns: string
      }
      ielts_record_question_response_v2: {
        Args: {
          p_attempt_id: string
          p_question_id: string
          p_response: Json
          p_section_id: string
        }
        Returns: string
      }
      ielts_resume_attempt_section: {
        Args: { p_section_id: string }
        Returns: string
      }
      ielts_resume_attempt_section_v2: {
        Args: { p_attempt_id: string; p_section_id: string }
        Returns: string
      }
      ielts_start_attempt_section: {
        Args: { p_section_id: string }
        Returns: string
      }
      ielts_start_attempt_section_v2: {
        Args: { p_attempt_id: string; p_section_id: string }
        Returns: string
      }
      ielts_submit_attempt_section: {
        Args: { p_section_id: string }
        Returns: string
      }
      ielts_submit_attempt_section_v2: {
        Args: { p_attempt_id: string; p_section_id: string }
        Returns: string
      }
      import_ai_grading_benchmark_provider: {
        Args: {
          p_benchmark_id: string
          p_corpus_version: number
          p_grader_version: string
          p_provider_request_id: string
          p_run_kind: string
        }
        Returns: boolean
      }
      increment_ai_workflow_provider_attempt: {
        Args: { p_run_id: string }
        Returns: {
          analysis_job_id: string | null
          backend: string
          backend_message_id: string | null
          completed_at: string | null
          core_completed_at: string | null
          created_at: string
          failed_at: string | null
          id: string
          idempotency_key: string
          last_delivery_attempt: number | null
          last_delivery_id: string | null
          last_error_code: string | null
          last_error_message: string | null
          launch_token: string | null
          lease_expires_at: string | null
          manual_retry_count: number
          phase: string
          progress: Json
          provider_attempt_count: number
          published_at: string | null
          speaking_response_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_claim_token: string | null
          workflow_attempt_count: number
          workflow_kind: string
          workflow_run_id: string | null
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_workflow_runs"
          isOneToOne: false
          isSetofReturn: true
        }
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
      invite_organization_member_transaction: {
        Args: {
          p_actor_id: string
          p_email: string
          p_idempotency_key: string
          p_organization_id: string
          p_role: string
        }
        Returns: Json
      }
      join_debate_duel: {
        Args: { p_actor_user_id: string; p_share_code: string }
        Returns: string
      }
      list_ai_grading_reconciliation_candidates: {
        Args: { p_limit?: number }
        Returns: {
          source_id: string
          workflow_kind: string
          workflow_run_id: string
        }[]
      }
      lms_list_materials_manager: {
        Args: {
          p_class_id?: string
          p_course_id?: string
          p_cursor?: string
          p_limit?: number
          p_status?: string
        }
        Returns: {
          content_review_status: string
          created_at: string
          description: string
          id: string
          native_document: Json
          placements: Json
          processing_status: string
          rights_approved: boolean
          title: string
          updated_at: string
          version_id: string
          version_number: number
        }[]
      }
      lms_place_material: { Args: { p_input: Json }; Returns: Json }
      lms_publish_material: {
        Args: { p_material_id: string; p_placement_id: string }
        Returns: boolean
      }
      lms_review_material_content: {
        Args: {
          p_material_id: string
          p_note?: string
          p_status: string
          p_version_id: string
        }
        Returns: boolean
      }
      lms_set_material_audience: {
        Args: {
          p_class_id: string
          p_placement_id: string
          p_user_ids: string[]
        }
        Returns: number
      }
      lms_set_material_rights: {
        Args: { p_material_id: string; p_rights: Json; p_version_id: string }
        Returns: boolean
      }
      lms_set_material_unlock_rules: {
        Args: { p_placement_id: string; p_rules: Json }
        Returns: number
      }
      lms_withdraw_material: {
        Args: { p_placement_id: string; p_reason: string }
        Returns: boolean
      }
      load_ai_grading_provisional: {
        Args: { p_claim_token: string; p_run_id: string }
        Returns: {
          payload: Json
          payload_hash: string
          payload_version: number
          provider_attempt_count: number
          workflow_attempt: number
        }[]
      }
      load_curriculum_quiz_questions: {
        Args: { p_lesson_id: string }
        Returns: {
          id: string
          lesson_id: string
          options: Json
          order_index: number
          question_text: string
          question_type: string
        }[]
      }
      load_ielts_coach_prepared_context: {
        Args: { p_learner_id: string; p_max_recent_attempts?: number }
        Returns: Json
      }
      load_lms_materials_for_user: {
        Args: { p_class_id: string; p_from: string; p_to: string }
        Returns: {
          access_state: string
          assignment_id: string
          class_id: string
          course_id: string
          description: string
          expires_at: string
          lock_reasons: string[]
          material_id: string
          native_document: Json
          occurrence_id: string
          order_index: number
          page_count: number
          page_number: number
          placement_id: string
          placement_status: string
          preview_kind: string
          preview_mime_type: string
          preview_rendition_id: string
          processing_status: string
          release_at: string
          required: boolean
          target_type: string
          title: string
          version_id: string
          watermark_class_label: string
          watermark_learner_label: string
        }[]
      }
      load_student_lms_week: {
        Args: { p_class_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      load_teacher_calendar_roster: {
        Args: {
          p_class_id: string
          p_occurrence_id?: string
          p_session_date?: string
        }
        Returns: {
          attendance_status: string
          display_name: string
          enrollment_status: string
          user_id: string
        }[]
      }
      load_teacher_review_queue: {
        Args: { p_class_id: string; p_cursor?: string; p_limit?: number }
        Returns: {
          class_id: string
          item_id: string
          item_type: string
          review_status: string
          score_source: string
          student_id: string
          submitted_at: string
          title: string
        }[]
      }
      load_teacher_review_queue_v2:
        | {
            Args: { p_class_id: string; p_cursor?: string; p_limit?: number }
            Returns: {
              class_id: string
              evidence: Json
              feedback: Json
              item_id: string
              item_type: string
              review_status: string
              revision: number
              score_source: string
              student_id: string
              submitted_at: string
              title: string
            }[]
          }
        | {
            Args: {
              p_class_id: string
              p_cursor_at: string
              p_cursor_id: string
              p_limit?: number
            }
            Returns: {
              class_id: string
              evidence: Json
              feedback: Json
              item_id: string
              item_type: string
              review_status: string
              revision: number
              score_source: string
              student_id: string
              submitted_at: string
              title: string
            }[]
          }
      manage_class_course_transaction: {
        Args: { p_action: string; p_class_id: string; p_course_id: string }
        Returns: string
      }
      manage_class_student_transaction: {
        Args: { p_action: string; p_class_id: string; p_student_id: string }
        Returns: string
      }
      manage_class_teacher_transaction: {
        Args: { p_action: string; p_class_id: string; p_teacher_id: string }
        Returns: string
      }
      manage_organization_member_transaction: {
        Args: {
          p_action: string
          p_actor_id: string
          p_expected_updated_at: string
          p_idempotency_key: string
          p_organization_id: string
          p_role: string
          p_user_id: string
        }
        Returns: Json
      }
      mark_homework_submission_uploading: {
        Args: { p_submission_id: string; p_user_id: string }
        Returns: string
      }
      mark_lms_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
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
      mark_question_import_source_action: {
        Args: { p_action: string; p_batch_id: string; p_reason: string }
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
      persist_question_import_result: {
        Args: {
          p_batch_id: string
          p_document_id: string
          p_pages: number
          p_provider_result: Json
          p_provider_status: string
          p_provider_usage: Json
        }
        Returns: number
      }
      prepare_ai_knowledge_collection_draft: {
        Args: {
          p_collection_slug: string
          p_import_key: string
          p_submitted_by?: string
          p_version: number
        }
        Returns: {
          collection_id: string
          language: string
          version: number
        }[]
      }
      prepare_lms_material_upload: { Args: { p_input: Json }; Returns: Json }
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
      publish_ai_knowledge_collection_version: {
        Args: {
          p_collection_slug: string
          p_review_notes?: string
          p_reviewer_id: string
          p_version: number
        }
        Returns: {
          collection_id: string
          published_at: string
          version: number
        }[]
      }
      publish_ielts_teacher_review: {
        Args: { p_actor_id?: string; p_review_id: string }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      publish_question_import_items: {
        Args: {
          p_batch_id: string
          p_collection_id: string
          p_idempotency_key: string
          p_item_ids: string[]
        }
        Returns: number
      }
      qualify_and_credit_referral: {
        Args: { p_referee_id: string; p_transcript_word_count: number }
        Returns: undefined
      }
      recalculate_course_progress: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: undefined
      }
      reclaim_notification_delivery_jobs: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: number
      }
      reconcile_question_import_quota: {
        Args: {
          p_club_id: string
          p_jobs: number
          p_pages: number
          p_questions: number
          p_reservation_key: string
        }
        Returns: Json
      }
      record_ai_grading_evaluation_run: {
        Args: {
          p_evaluation_id: string
          p_prediction: Json
          p_provider_request_id: string
          p_run_kind: string
        }
        Returns: {
          completed_at: string
          created_at: string
          evaluation_id: string
          id: string
          model: string
          prediction: Json
          provider: string
          provider_request_id: string
          run_kind: string
          started_at: string
          trace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_grading_evaluation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_ai_grading_operational_boundary_attempt: {
        Args: {
          p_claim_token: string
          p_injection_token: string
          p_run_id: string
        }
        Returns: boolean
      }
      record_ai_grading_operational_transition: {
        Args: { p_claim_token: string; p_event_type: string; p_run_id: string }
        Returns: boolean
      }
      record_homework_cleanup_result: {
        Args: { p_error?: string; p_submission_id: string; p_success: boolean }
        Returns: string
      }
      record_ielts_review_rating: {
        Args: {
          p_activity_attempt_id?: string
          p_is_correct?: boolean
          p_metadata?: Json
          p_next_difficulty: number
          p_next_due_at: string
          p_next_ease_factor: number
          p_next_interval_days: number
          p_next_lapses: number
          p_next_repetitions: number
          p_next_retrievability: number
          p_next_stability: number
          p_next_state: string
          p_plan_item_id?: string
          p_quality_grade: number
          p_rating: Database["public"]["Enums"]["ielts_review_rating"]
          p_response_ms?: number
          p_review_item_id: string
          p_reviewed_at?: string
        }
        Returns: {
          activity_attempt_id: string | null
          activity_id: string | null
          algorithm: Database["public"]["Enums"]["ielts_review_algorithm"]
          answer_en: string | null
          answer_vi: string | null
          atom_payload: Json
          created_at: string
          difficulty: number
          due_at: string
          ease_factor: number
          focus_area: string
          id: string
          interval_days: number
          lapses: number
          last_reviewed_at: string | null
          mastered_at: string | null
          metadata: Json
          prompt_en: string
          prompt_vi: string
          question_id: string | null
          question_response_id: string | null
          repetitions: number
          retrievability: number
          review_kind: string
          skill: Database["public"]["Enums"]["ielts_skill"]
          source_id: string | null
          source_key: string
          source_type: string
          speaking_response_id: string | null
          stability: number
          state: string
          suspended_until: string | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ielts_review_items"
          isOneToOne: true
          isSetofReturn: false
        }
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
      recover_ai_grading_benchmark_provider: {
        Args: {
          p_benchmark_id: string
          p_corpus_version: number
          p_grader_version: string
          p_pipeline_stage: string
          p_provider_request_id: string
          p_run_kind: string
        }
        Returns: boolean
      }
      refresh_ai_grading_benchmark_release_attestations: {
        Args: { p_attestations: Json }
        Returns: number
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
      refund_practice_analysis: {
        Args: { p_attempt_id: string; p_user_id: string }
        Returns: number
      }
      register_observability_bug_clickup_task: {
        Args: {
          p_clickup_task_id: string
          p_delivery_id: string
          p_environment: string
          p_fingerprint: string
          p_lease_token: string
          p_service: string
        }
        Returns: undefined
      }
      register_question_import_material: {
        Args: {
          p_batch_id: string
          p_material_id: string
          p_media_material_id?: string
          p_media_version_id?: string
          p_version_id: string
        }
        Returns: string
      }
      release_payment_transaction: {
        Args: { p_idempotency_key: string; p_provider: string }
        Returns: undefined
      }
      release_question_import_quota: {
        Args: { p_club_id: string; p_reservation_key: string }
        Returns: Json
      }
      release_question_import_worker_quota: {
        Args: { p_club_id: string; p_reservation_key: string }
        Returns: Json
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
      request_question_import_changes: {
        Args: { p_batch_id: string; p_note: string }
        Returns: undefined
      }
      reserve_ai_grading_provider_call: {
        Args: { p_claim_token: string; p_run_id: string }
        Returns: string
      }
      reserve_homework_submission: {
        Args: {
          p_assignment_id: string
          p_file_intents: Json
          p_idempotency_key: string
          p_submission_text: string
          p_user_id: string
        }
        Returns: string
      }
      reserve_question_import_quota: {
        Args: {
          p_club_id: string
          p_jobs: number
          p_pages: number
          p_questions: number
          p_reservation_key: string
        }
        Returns: Json
      }
      reset_age_assurance_as_admin: {
        Args: { p_reason: string; p_target_user_id: string }
        Returns: undefined
      }
      resolve_leaderboard_xp_event_flag: {
        Args: { p_flag_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      respond_to_profile_connection: {
        Args: { p_requester_user_id: string; p_response: string }
        Returns: Json
      }
      retry_homework_submission: {
        Args: { p_submission_id: string; p_user_id: string }
        Returns: string
      }
      retry_ielts_scoring_workflow: {
        Args: {
          p_actor_id: string
          p_attempt_id: string
          p_class_id: string
          p_club_id: string
          p_expected_revision: number
          p_idempotency_key: string
          p_response_id: string
          p_response_kind: string
        }
        Returns: {
          idempotent_replay: boolean
          manual_retry_count: number
          response_id: string
          response_kind: string
          response_revision: number
          status: string
          workflow_run_id: string
        }[]
      }
      return_ielts_teacher_review: {
        Args: { p_actor_id?: string; p_note?: string; p_review_id: string }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      review_ai_knowledge_record: {
        Args: {
          p_authority_tier?: string
          p_id: string
          p_kind: string
          p_review_notes?: string
          p_review_status: string
          p_rights_status?: string
        }
        Returns: Json
      }
      rotate_profile_friend_code: { Args: never; Returns: Json }
      save_class_attendance_transaction: {
        Args: {
          p_class_id: string
          p_course_id: string
          p_notes: string
          p_records: Json
          p_session_date: string
          p_title: string
        }
        Returns: string
      }
      save_class_schedule_transaction: {
        Args: {
          p_class_id: string
          p_course_id: string
          p_end_date: string
          p_end_time: string
          p_location: string
          p_recurrence_rule: Json
          p_recurrence_summary: string
          p_room: string
          p_schedule_id: string
          p_start_date: string
          p_start_time: string
          p_status: string
          p_timezone: string
          p_title: string
        }
        Returns: string
      }
      save_ielts_teacher_review: {
        Args: {
          p_actor_id?: string
          p_attempt_id: string
          p_class_id: string
          p_club_id: string
          p_coherence_cohesion?: number
          p_expected_revision: number
          p_fluency_coherence?: number
          p_grammar?: number
          p_lexical_resource?: number
          p_pronunciation?: number
          p_reviewer_note?: string
          p_speaking_response_id?: string
          p_task_response?: number
          p_writing_response_id?: string
        }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_organization_course_transaction: {
        Args: { p_input: Json }
        Returns: Json
      }
      save_question_import_draft: {
        Args: {
          p_draft_item_id: string
          p_payload: Json
          p_review_note: string
          p_status: Database["public"]["Enums"]["question_import_item_status"]
        }
        Returns: undefined
      }
      seal_ai_grading_operational_evidence: {
        Args: { p_evidence_hash: string; p_evidence_id: string }
        Returns: {
          corpus_version: number
          created_at: string
          deployment_id: string
          environment: string
          evidence_hash: string | null
          expires_at: string | null
          grader_version: string
          id: string
          image_digest: string
          run_id: string
          started_at: string
          status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_grading_operational_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_ai_knowledge_hybrid: {
        Args: {
          p_collection_slug: string
          p_filters?: Json
          p_match_count?: number
          p_model: string
          p_provider: string
          p_query_embedding: string
          p_query_text: string
        }
        Returns: {
          authority_tier: string
          band_max: number
          band_min: number
          canonical_url: string
          collection_slug: string
          collection_version: number
          criterion: string
          evidence_id: string
          format: string
          item_kind: string
          lexical_score: number
          permitted_excerpt: string
          relevance_score: number
          retrieval_limitations: string[]
          semantic_similarity: number
          source_id: string
          source_locator: string
          structured_insight: Json
          task_type: string
        }[]
      }
      search_debate_corpus_items_lexical: {
        Args: {
          language?: string
          match_count?: number
          min_confidence?: number
          query_text: string
          review_statuses?: string[]
          usable_for?: string
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
          lexical_rank: number
          lexical_score: number
          motion_vi: string
          review_status: string
          side: string
          similarity: number
          usable_for: string[]
        }[]
      }
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
      settle_zalopay_payment: {
        Args: {
          p_amount: number
          p_app_trans_id: string
          p_billing_cycle: string
          p_currency: string
          p_provider_ref: string
          p_user_id: string
        }
        Returns: string
      }
      start_ai_grading_benchmark_provider: {
        Args: {
          p_benchmark_id: string
          p_claim_token: string
          p_corpus_version: number
          p_grader_version: string
          p_pipeline_stage: string
          p_run_kind: string
        }
        Returns: boolean
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
      submit_age_assurance: {
        Args: {
          p_age_band: string
          p_consent_version?: string
          p_expires_at?: string
          p_guardian_email?: string
          p_token_hash?: string
        }
        Returns: string
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
      submit_question_import: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      teacher_workspace_correct_attendance: {
        Args: {
          p_idempotency_key: string
          p_notes: string
          p_session_id: string
          p_status: string
          p_user_id: string
        }
        Returns: Json
      }
      teacher_workspace_grade_homework: {
        Args: {
          p_expected_updated_at: string
          p_feedback: string
          p_idempotency_key: string
          p_rubric_breakdown: Json
          p_score: number
          p_score_max: number
          p_submission_id: string
        }
        Returns: Json
      }
      teacher_workspace_place_material: {
        Args: { p_input: Json }
        Returns: Json
      }
      teacher_workspace_plan_lesson: { Args: { p_input: Json }; Returns: Json }
      teacher_workspace_publish_announcement: {
        Args: { p_input: Json }
        Returns: Json
      }
      teacher_workspace_publish_assignment: {
        Args: {
          p_assignment_id: string
          p_expected_updated_at: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      teacher_workspace_publish_material: {
        Args: {
          p_idempotency_key: string
          p_material_id: string
          p_placement_id: string
        }
        Returns: Json
      }
      teacher_workspace_reschedule: {
        Args: {
          p_end_date: string
          p_end_time: string
          p_expected_updated_at: string
          p_idempotency_key: string
          p_schedule_id: string
          p_start_date: string
          p_start_time: string
          p_timezone: string
        }
        Returns: Json
      }
      teacher_workspace_reschedule_occurrence: {
        Args: {
          p_ends_at: string
          p_expected_updated_at: string
          p_idempotency_key: string
          p_occurrence_id: string
          p_starts_at: string
          p_timezone: string
        }
        Returns: Json
      }
      teacher_workspace_set_occurrence_state: {
        Args: {
          p_expected_updated_at: string
          p_idempotency_key: string
          p_occurrence_id: string
          p_state: string
        }
        Returns: Json
      }
      unblock_profile: { Args: { p_target_user_id: string }; Returns: Json }
      update_class_transaction: {
        Args: {
          p_class_id: string
          p_description: string
          p_end_date: string
          p_grade_level: string
          p_max_students: number
          p_meeting_schedule: string
          p_program_type: string
          p_room: string
          p_start_date: string
          p_status: string
          p_title: string
        }
        Returns: string
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
        SetofOptions: {
          from: "*"
          to: "ielts_questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_ielts_teacher_review_feedback: {
        Args: {
          p_actor_id?: string
          p_criterion_feedback: Json
          p_expected_revision: number
          p_review_id: string
        }
        Returns: {
          assignment_id: string | null
          attempt_id: string
          class_id: string
          club_id: string
          coherence_cohesion_band: number | null
          created_at: string
          criterion_feedback: Json
          fluency_coherence_band: number | null
          grammar_band: number | null
          id: string
          lexical_resource_band: number | null
          part_number: number | null
          pronunciation_band: number | null
          published_at: string | null
          returned_at: string | null
          returned_note: string | null
          review_kind: string
          reviewer_id: string
          reviewer_note: string | null
          revision: number
          revision_consumed_at: string | null
          revision_granted: number | null
          rubric_key: string
          rubric_version: number
          skill_band: number | null
          speaking_response_id: string | null
          status: string
          task_band: number | null
          task_number: number | null
          task_response_band: number | null
          updated_at: string
          user_id: string
          writing_response_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ielts_teacher_reviews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_leaderboard_privacy_settings: {
        Args: {
          p_allow_kudos: boolean
          p_display_mode: string
          p_participate_in_leaderboards: boolean
          p_show_organization: boolean
        }
        Returns: Json
      }
      update_organization_academic_profile_transaction: {
        Args: {
          p_actor_id: string
          p_expected_setup_version: number
          p_idempotency_key: string
          p_name: string
          p_organization_id: string
          p_organization_type: string
          p_timezone: string
        }
        Returns: Json
      }
      update_organization_transaction: {
        Args: {
          p_actor_id: string
          p_city: string
          p_country: string
          p_facebook_url: string
          p_idempotency_key: string
          p_instagram_url: string
          p_logo_url: string
          p_name: string
          p_organization_id: string
          p_organization_type: string
          p_setup_version: number
          p_threads_url: string
          p_timezone: string
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
      verify_ai_grading_benchmark_acoustic_attestation: {
        Args: { p_benchmark_key: string; p_envelope: Json; p_signature: string }
        Returns: boolean
      }
      verify_ai_grading_benchmark_provider_request: {
        Args: {
          p_benchmark_id: string
          p_corpus_version: number
          p_grader_version: string
          p_pipeline_stage: string
          p_provider_request_id: string
          p_run_kind: string
        }
        Returns: {
          prediction: Json
        }[]
      }
      withdraw_ai_grading_benchmark: {
        Args: { p_benchmark_id: string; p_verified_receipt_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ielts_accent: "uk" | "us" | "aus" | "other"
      ielts_adaptive_evidence_type:
        | "mock_result"
        | "section_result"
        | "objective_response"
        | "writing_score"
        | "speaking_score"
        | "phoneme_signal"
        | "learn_activity"
        | "review_result"
        | "diagnostic_import"
        | "manual_adjustment"
      ielts_assessment_mode: "practice" | "simulation"
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
      ielts_plan_item_kind:
        | "learn_activity"
        | "review"
        | "skill_drill"
        | "mini_mock"
        | "full_mock"
        | "writing_submission"
        | "speaking_submission"
        | "teacher_assignment"
      ielts_plan_item_status:
        | "scheduled"
        | "available"
        | "started"
        | "completed"
        | "missed"
        | "skipped"
        | "cancelled"
      ielts_question_type:
        | "mcq_single"
        | "mcq_multi"
        | "true_false_notgiven"
        | "yes_no_notgiven"
        | "matching_headings"
        | "matching_information"
        | "matching_features"
        | "matching_sentence_endings"
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
      ielts_review_algorithm: "sm2_v1" | "fsrs_v1"
      ielts_review_rating: "again" | "hard" | "good" | "easy"
      ielts_skill: "listening" | "reading" | "writing" | "speaking"
      ielts_study_plan_status: "active" | "paused" | "completed" | "archived"
      ielts_test_kind: "full_mock" | "skill_set" | "drill"
      question_bank_collection_status:
        | "draft"
        | "published"
        | "archived"
        | "quarantined"
      question_import_document_status:
        | "pending"
        | "validating"
        | "queued"
        | "parsing"
        | "extracting"
        | "ready"
        | "failed"
        | "quarantined"
        | "deleted"
      question_import_item_status:
        | "draft"
        | "accepted"
        | "rejected"
        | "needs_confirmation"
        | "submitted"
        | "changes_requested"
        | "published"
      question_import_status:
        | "draft"
        | "queued"
        | "processing"
        | "review"
        | "submitted"
        | "changes_requested"
        | "publishing"
        | "completed"
        | "failed"
        | "quarantined"
        | "deleted"
      question_import_usage_kind:
        | "reservation"
        | "consumed"
        | "released"
        | "adjustment"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ielts_adaptive_evidence_type: [
        "mock_result",
        "section_result",
        "objective_response",
        "writing_score",
        "speaking_score",
        "phoneme_signal",
        "learn_activity",
        "review_result",
        "diagnostic_import",
        "manual_adjustment",
      ],
      ielts_assessment_mode: ["practice", "simulation"],
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
      ielts_plan_item_kind: [
        "learn_activity",
        "review",
        "skill_drill",
        "mini_mock",
        "full_mock",
        "writing_submission",
        "speaking_submission",
        "teacher_assignment",
      ],
      ielts_plan_item_status: [
        "scheduled",
        "available",
        "started",
        "completed",
        "missed",
        "skipped",
        "cancelled",
      ],
      ielts_question_type: [
        "mcq_single",
        "mcq_multi",
        "true_false_notgiven",
        "yes_no_notgiven",
        "matching_headings",
        "matching_information",
        "matching_features",
        "matching_sentence_endings",
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
      ielts_review_algorithm: ["sm2_v1", "fsrs_v1"],
      ielts_review_rating: ["again", "hard", "good", "easy"],
      ielts_skill: ["listening", "reading", "writing", "speaking"],
      ielts_study_plan_status: ["active", "paused", "completed", "archived"],
      ielts_test_kind: ["full_mock", "skill_set", "drill"],
      question_bank_collection_status: [
        "draft",
        "published",
        "archived",
        "quarantined",
      ],
      question_import_document_status: [
        "pending",
        "validating",
        "queued",
        "parsing",
        "extracting",
        "ready",
        "failed",
        "quarantined",
        "deleted",
      ],
      question_import_item_status: [
        "draft",
        "accepted",
        "rejected",
        "needs_confirmation",
        "submitted",
        "changes_requested",
        "published",
      ],
      question_import_status: [
        "draft",
        "queued",
        "processing",
        "review",
        "submitted",
        "changes_requested",
        "publishing",
        "completed",
        "failed",
        "quarantined",
        "deleted",
      ],
      question_import_usage_kind: [
        "reservation",
        "consumed",
        "released",
        "adjustment",
      ],
    },
  },
} as const
