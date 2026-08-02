
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_notification_devices: {
        Row: {
          account_id: string
          active: boolean
          created_at: string
          id: string
          last_seen_at: string
          platform: string | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          active?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string
          id: string
          member_id: string | null
          person_name: string
          role: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string | null
          person_name: string
          role: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string | null
          person_name?: string
          role?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      church_members: {
        Row: {
          church_id: string
          created_at: string
          email: string
          id: string
          is_admin: boolean
          member_id: string | null
          name: string | null
          role: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
          member_id?: string | null
          name?: string | null
          role?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          member_id?: string | null
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          allow_member_multiple_roles_same_service: boolean
          admin_id: string
          created_at: string
          id: string
          name: string
          song_type_options: string[]
          updated_at: string
          invitation_code: string
        }
        Insert: {
          allow_member_multiple_roles_same_service?: boolean
          admin_id: string
          created_at?: string
          id?: string
          name: string
          song_type_options?: string[]
          updated_at?: string
          invitation_code?: string
        }
        Update: {
          allow_member_multiple_roles_same_service?: boolean
          admin_id?: string
          created_at?: string
          id?: string
          name?: string
          song_type_options?: string[]
          updated_at?: string
          invitation_code?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          church_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          recurring_service_id: string | null
          service_type: string
          time: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          recurring_service_id?: string | null
          service_type: string
          time?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          recurring_service_id?: string | null
          service_type?: string
          time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_recurring_service_id_fkey"
            columns: ["recurring_service_id"]
            isOneToOne: false
            referencedRelation: "recurring_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_comments: {
        Row: {
          church_id: string
          comment_text: string
          created_at: string
          display_order: number | null
          id: string
          member_id: string
          service_id: string
          song_number: string | null
          song_type: string
          updated_at: string
        }
        Insert: {
          church_id: string
          comment_text: string
          created_at?: string
          display_order?: number | null
          id?: string
          member_id: string
          service_id: string
          song_number?: string | null
          song_type?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          comment_text?: string
          created_at?: string
          display_order?: number | null
          id?: string
          member_id?: string
          service_id?: string
          song_number?: string | null
          song_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_comments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_comments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_comments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_services: {
        Row: {
          church_id: string
          created_at: string
          day_of_week: number
          id: string
          name: string
          notes: string | null
          time: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          day_of_week: number
          id?: string
          name: string
          notes?: string | null
          time: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          name?: string
          notes?: string | null
          time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_services_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_roles: {
        Row: {
          church_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          display_order: number
        }
        Insert: {
          church_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          display_order?: number
        }
        Update: {
          church_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "church_roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_service_roles: {
        Row: {
          created_at: string
          id: string
          recurring_service_id: string
          role_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          recurring_service_id: string
          role_name: string
        }
        Update: {
          created_at?: string
          id?: string
          recurring_service_id?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_service_roles_recurring_service_id_fkey"
            columns: ["recurring_service_id"]
            isOneToOne: false
            referencedRelation: "recurring_services"
            referencedColumns: ["id"]
          },
        ]
      }
      member_unavailability: {
        Row: {
          created_at: string
          id: string
          member_id: string
          reason: string | null
          unavailable_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          reason?: string | null
          unavailable_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          reason?: string | null
          unavailable_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_unavailability_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_scheduling_preferences: {
        Row: {
          church_id: string
          created_at: string
          id: string
          member_id: string
          recurring_service_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          member_id: string
          recurring_service_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          member_id?: string
          recurring_service_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_scheduling_preferences_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_scheduling_preferences_member_role_fkey"
            columns: ["member_id", "role_id"]
            isOneToOne: false
            referencedRelation: "member_roles"
            referencedColumns: ["member_id", "role_id"]
          },
          {
            foreignKeyName: "member_scheduling_preferences_recurring_service_id_fkey"
            columns: ["recurring_service_id"]
            isOneToOne: false
            referencedRelation: "recurring_services"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notification_preferences: {
        Row: {
          church_id: string
          created_at: string
          fill_in_requests: boolean
          fill_in_updates: boolean
          id: string
          member_id: string
          service_comments: boolean
          service_reminders: boolean
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          fill_in_requests?: boolean
          fill_in_updates?: boolean
          id?: string
          member_id: string
          service_comments?: boolean
          service_reminders?: boolean
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          fill_in_requests?: boolean
          fill_in_updates?: boolean
          id?: string
          member_id?: string
          service_comments?: boolean
          service_reminders?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notification_preferences_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notification_preferences_membership_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: true
            referencedRelation: "church_members"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      member_notifications: {
        Row: {
          body: string
          church_id: string
          created_at: string
          data: Json
          event_key: string | null
          id: string
          member_id: string
          notification_type: string
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          church_id: string
          created_at?: string
          data?: Json
          event_key?: string | null
          id?: string
          member_id: string
          notification_type: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          church_id?: string
          created_at?: string
          data?: Json
          event_key?: string | null
          id?: string
          member_id?: string
          notification_type?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          created_at: string
          id: string
          member_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "church_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          id: string
          church_id: string
          notification_hours: number[]
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          church_id: string
          notification_hours?: number[]
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          church_id?: string
          notification_hours?: number[]
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      onesignal_subscriptions: {
        Row: {
          id: string
          member_id: string
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          member_id: string
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onesignal_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          id: string
          member_id: string
          token: string
          device_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          token: string
          device_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          token?: string
          device_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_reminders: {
        Row: {
          id: string
          reminder_key: string
          created_at: string | null
        }
        Insert: {
          id?: string
          reminder_key: string
          created_at?: string | null
        }
        Update: {
          id?: string
          reminder_key?: string
          created_at?: string | null
        }
        Relationships: []
      }
      fill_in_requests: {
        Row: {
          id: string
          assignment_id: string
          service_id: string
          church_id: string
          requesting_member_id: string
          role_name: string
          reason: string | null
          status: 'pending' | 'filled' | 'cancelled'
          filled_by_member_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assignment_id: string
          service_id: string
          church_id: string
          requesting_member_id: string
          role_name: string
          reason?: string | null
          status?: 'pending' | 'filled' | 'cancelled'
          filled_by_member_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string
          service_id?: string
          church_id?: string
          requesting_member_id?: string
          role_name?: string
          reason?: string | null
          status?: 'pending' | 'filled' | 'cancelled'
          filled_by_member_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fill_in_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fill_in_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fill_in_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fill_in_requests_requesting_member_id_fkey"
            columns: ["requesting_member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fill_in_requests_filled_by_member_id_fkey"
            columns: ["filled_by_member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_notification_preferences: {
        Args: {
          target_church_id: string
        }
        Returns: {
          church_id: string
          member_id: string
          service_reminders: boolean
          fill_in_requests: boolean
          fill_in_updates: boolean
          service_comments: boolean
          has_explicit_preferences: boolean
          updated_at: string | null
        }[]
      }
      update_my_notification_preferences: {
        Args: {
          target_church_id: string
          receive_service_reminders: boolean
          receive_fill_in_requests: boolean
          receive_fill_in_updates: boolean
          receive_service_comments: boolean
        }
        Returns: {
          church_id: string
          member_id: string
          service_reminders: boolean
          fill_in_requests: boolean
          fill_in_updates: boolean
          service_comments: boolean
          has_explicit_preferences: boolean
          updated_at: string | null
        }[]
      }
      auto_assign_service_slots: {
        Args: {
          target_church_id: string
          assignment_mode?: string
          dry_run?: boolean
          target_start_date?: string | null
          target_end_date?: string | null
          target_service_ids?: string[] | null
        }
        Returns: {
          assigned_count: number
          open_slot_count: number
          skipped_count: number
          no_role_match_count: number
          unavailable_slot_count: number
          unavailable_candidate_count: number
          same_service_conflict_count: number
          cleared_count: number
          preview: Json
          skipped_report: Json
        }[]
      }
      auto_assign_service_slots_v2: {
        Args: {
          target_church_id: string
          assignment_mode?: string
          dry_run?: boolean
          target_start_date?: string | null
          target_end_date?: string | null
          target_service_ids?: string[] | null
          target_role_id?: string | null
          expected_preview_token?: string | null
        }
        Returns: {
          assigned_count: number
          open_slot_count: number
          skipped_count: number
          no_role_match_count: number
          unavailable_slot_count: number
          unavailable_candidate_count: number
          same_service_conflict_count: number
          cleared_count: number
          preview: Json
          skipped_report: Json
          scope_role_id: string | null
          scope_role_name: string | null
          preview_token: string
        }[]
      }
      get_manual_assignment_candidates_v1: {
        Args: {
          target_assignment_id: string
        }
        Returns: {
          assignment_id: string
          service_id: string
          church_id: string
          service_date: string
          role_id: string
          role_name: string
          member_id: string
          display_name: string
          eligible: boolean
          reason_code: string | null
          unavailable_date: string | null
        }[]
      }
      assign_member_to_slot_v2: {
        Args: {
          target_assignment_id: string
          target_member_id: string
          expected_service_id: string
          expected_service_date: string
          expected_role_id: string
        }
        Returns: Database["public"]["Tables"]["assignments"]["Row"]
      }
      create_services_with_assignments_batch: {
        Args: {
          target_church_id: string
          service_drafts: Json
        }
        Returns: Json
      }
      manage_scheduled_services_bulk: {
        Args: {
          target_church_id: string
          target_start_date?: string | null
          target_end_date?: string | null
          target_service_ids?: string[] | null
          dry_run?: boolean
        }
        Returns: Json
      }
      preview_church_admin_delete_impact: {
        Args: {
          target_church_id: string
          target_type: string
          target_id: string
        }
        Returns: Json
      }
      reorder_church_roles_admin: {
        Args: {
          target_church_id: string
          ordered_role_ids: string[]
        }
        Returns: Json
      }
      reorder_service_songs: {
        Args: {
          target_service_id: string
          ordered_comment_ids: string[]
        }
        Returns: Database["public"]["Tables"]["service_comments"]["Row"][]
      }
      save_church_member_admin: {
        Args: {
          target_church_id: string
          target_member_id: string
          member_name: string
          member_email: string
          member_is_admin: boolean
          member_role_ids: string[]
        }
        Returns: Json
      }
      update_own_church_profile: {
        Args: {
          target_church_id: string
          display_name: string
        }
        Returns: Database["public"]["Tables"]["church_members"]["Row"]
      }
      save_church_role_admin: {
        Args: {
          target_church_id: string
          target_role_id: string
          role_name: string
          role_description: string
        }
        Returns: Database["public"]["Tables"]["church_roles"]["Row"]
      }
      save_recurring_service_admin: {
        Args: {
          target_church_id: string
          target_service_id: string | null
          service_name: string
          service_day_of_week: number
          service_time: string
          service_notes: string
          service_role_names: string[]
        }
        Returns: Database["public"]["Tables"]["recurring_services"]["Row"]
      }
      update_assignments_batch: {
        Args: {
          target_church_id: string
          assignment_updates: Json
        }
        Returns: Json
      }
      accept_fill_in_request: {
        Args: {
          target_request_id: string
          target_filled_by_member_id: string
        }
        Returns: Database["public"]["Tables"]["fill_in_requests"]["Row"]
      }
      claim_onesignal_subscription: {
        Args: {
          target_member_id: string
          target_subscription_id: string
        }
        Returns: Database["public"]["Tables"]["onesignal_subscriptions"]["Row"]
      }
      create_church_with_owner_membership: {
        Args: {
          target_church_name: string
          target_owner_name?: string
          target_request_id: string
        }
        Returns: {
          church_record: Database["public"]["Tables"]["churches"]["Row"]
          membership_record: Database["public"]["Tables"]["church_members"]["Row"]
        }[]
      }
      deactivate_account_notification_device: {
        Args: {
          target_subscription_id: string
        }
        Returns: boolean
      }
      get_fill_in_requests_with_member_info: {
        Args: {
          target_church_id: string
        }
        Returns: {
          id: string
          assignment_id: string
          service_id: string
          church_id: string
          requesting_member_id: string
          role_name: string
          reason: string | null
          status: string
          filled_by_member_id: string | null
          created_at: string
          updated_at: string
          requesting_member_name: string
          requesting_member_email: string
          filled_by_member_name: string | null
          filled_by_member_email: string | null
        }[]
      }
      join_church_by_invitation: {
        Args: {
          target_invitation_code: string
          target_member_name?: string
        }
        Returns: {
          church_record: Database["public"]["Tables"]["churches"]["Row"]
          membership_record: Database["public"]["Tables"]["church_members"]["Row"]
        }[]
      }
      register_account_notification_device: {
        Args: {
          target_platform?: string
          target_subscription_id: string
        }
        Returns: Database["public"]["Tables"]["account_notification_devices"]["Row"]
      }
      resolve_notification_recipient_subscriptions: {
        Args: {
          target_member_ids: string[]
        }
        Returns: {
          member_id: string
          subscription_id: string
        }[]
      }
      delete_account: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      update_church_name: {
        Args: {
          target_church_id: string
          church_name: string
        }
        Returns: Database["public"]["Tables"]["churches"]["Row"]
      }
      update_church_song_type_options: {
        Args: {
          target_church_id: string
          options: string[]
        }
        Returns: Database["public"]["Tables"]["churches"]["Row"]
      }
      update_church_auto_assign_settings: {
        Args: {
          target_church_id: string
          allow_multiple_roles_same_service: boolean
        }
        Returns: Database["public"]["Tables"]["churches"]["Row"]
      }
      upsert_church_notification_settings_admin: {
        Args: {
          target_church_id: string
          reminder_hours: number[]
          reminders_enabled: boolean
        }
        Returns: Database["public"]["Tables"]["notification_settings"]["Row"]
      }
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
