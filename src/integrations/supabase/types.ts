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
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_business_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_business_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_business_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          business_id: string
          cooldown_hours: number
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          message: string
          target_segment: string
          title: string
          trigger_type: string
          trigger_value: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          cooldown_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          message: string
          target_segment?: string
          title: string
          trigger_type?: string
          trigger_value?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          cooldown_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          message?: string
          target_segment?: string
          title?: string
          trigger_type?: string
          trigger_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accent_color: string | null
          address: string | null
          auto_notifications: boolean | null
          auto_reminder_days: number | null
          auto_reminder_enabled: boolean | null
          birthday_notif_enabled: boolean | null
          birthday_notif_message: string | null
          business_template: string | null
          card_animation_intensity: string | null
          card_bg_image_url: string | null
          card_bg_type: string | null
          card_style: string | null
          category: string | null
          city: string | null
          created_at: string
          description: string | null
          feature_analytics: boolean | null
          feature_customer_scoring: boolean | null
          feature_gamification: boolean | null
          feature_notifications: boolean | null
          feature_rich_notifications: boolean | null
          feature_special_events: boolean | null
          feature_wallet: boolean | null
          foreground_color: string | null
          geofence_enabled: boolean | null
          geofence_message: string | null
          geofence_radius: number | null
          geofence_satellite_points: Json | null
          geofence_time_end: string | null
          geofence_time_start: string | null
          google_place_id: string | null
          google_review_enabled: boolean | null
          google_review_message: string | null
          google_review_threshold: number | null
          id: string
          is_demo: boolean
          label_color: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          loyalty_type: string | null
          max_points_per_card: number | null
          name: string
          notif_custom_interval_hours: number | null
          notif_frequency: string | null
          notif_time_end: string | null
          notif_time_start: string | null
          notification_frequency_limit: string | null
          onboarding_completed: boolean | null
          onboarding_mode: string | null
          owner_id: string
          phone: string | null
          pos_api_key: string | null
          pos_enabled: boolean | null
          pos_system_type: string | null
          pos_webhook_url: string | null
          points_per_euro: number | null
          points_per_visit: number | null
          primary_color: string | null
          promo_text: string | null
          reward_alert_threshold: number | null
          reward_description: string | null
          score_at_risk_threshold: number | null
          score_loyal_threshold: number | null
          score_regular_threshold: number | null
          score_vip_threshold: number | null
          secondary_color: string | null
          show_customer_name: boolean | null
          show_expiration: boolean | null
          show_points: boolean | null
          show_qr_code: boolean | null
          show_rewards_preview: boolean | null
          slug: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at: string | null
          updated_at: string
          vip_auto_enabled: boolean | null
          vip_auto_threshold: number | null
          vip_min_total_spent: number | null
          vip_min_visits: number | null
          website: string | null
          welcome_push_enabled: boolean | null
          welcome_push_message: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          auto_notifications?: boolean | null
          auto_reminder_days?: number | null
          auto_reminder_enabled?: boolean | null
          birthday_notif_enabled?: boolean | null
          birthday_notif_message?: string | null
          business_template?: string | null
          card_animation_intensity?: string | null
          card_bg_image_url?: string | null
          card_bg_type?: string | null
          card_style?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          feature_analytics?: boolean | null
          feature_customer_scoring?: boolean | null
          feature_gamification?: boolean | null
          feature_notifications?: boolean | null
          feature_rich_notifications?: boolean | null
          feature_special_events?: boolean | null
          feature_wallet?: boolean | null
          foreground_color?: string | null
          geofence_enabled?: boolean | null
          geofence_message?: string | null
          geofence_radius?: number | null
          geofence_satellite_points?: Json | null
          geofence_time_end?: string | null
          geofence_time_start?: string | null
          google_place_id?: string | null
          google_review_enabled?: boolean | null
          google_review_message?: string | null
          google_review_threshold?: number | null
          id?: string
          is_demo?: boolean
          label_color?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          loyalty_type?: string | null
          max_points_per_card?: number | null
          name: string
          notif_custom_interval_hours?: number | null
          notif_frequency?: string | null
          notif_time_end?: string | null
          notif_time_start?: string | null
          notification_frequency_limit?: string | null
          onboarding_completed?: boolean | null
          onboarding_mode?: string | null
          owner_id: string
          phone?: string | null
          pos_api_key?: string | null
          pos_enabled?: boolean | null
          pos_system_type?: string | null
          pos_webhook_url?: string | null
          points_per_euro?: number | null
          points_per_visit?: number | null
          primary_color?: string | null
          promo_text?: string | null
          reward_alert_threshold?: number | null
          reward_description?: string | null
          score_at_risk_threshold?: number | null
          score_loyal_threshold?: number | null
          score_regular_threshold?: number | null
          score_vip_threshold?: number | null
          secondary_color?: string | null
          show_customer_name?: boolean | null
          show_expiration?: boolean | null
          show_points?: boolean | null
          show_qr_code?: boolean | null
          show_rewards_preview?: boolean | null
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
          vip_auto_enabled?: boolean | null
          vip_auto_threshold?: number | null
          vip_min_total_spent?: number | null
          vip_min_visits?: number | null
          website?: string | null
          welcome_push_enabled?: boolean | null
          welcome_push_message?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          auto_notifications?: boolean | null
          auto_reminder_days?: number | null
          auto_reminder_enabled?: boolean | null
          birthday_notif_enabled?: boolean | null
          birthday_notif_message?: string | null
          business_template?: string | null
          card_animation_intensity?: string | null
          card_bg_image_url?: string | null
          card_bg_type?: string | null
          card_style?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          feature_analytics?: boolean | null
          feature_customer_scoring?: boolean | null
          feature_gamification?: boolean | null
          feature_notifications?: boolean | null
          feature_rich_notifications?: boolean | null
          feature_special_events?: boolean | null
          feature_wallet?: boolean | null
          foreground_color?: string | null
          geofence_enabled?: boolean | null
          geofence_message?: string | null
          geofence_radius?: number | null
          geofence_satellite_points?: Json | null
          geofence_time_end?: string | null
          geofence_time_start?: string | null
          google_place_id?: string | null
          google_review_enabled?: boolean | null
          google_review_message?: string | null
          google_review_threshold?: number | null
          id?: string
          is_demo?: boolean
          label_color?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          loyalty_type?: string | null
          max_points_per_card?: number | null
          name?: string
          notif_custom_interval_hours?: number | null
          notif_frequency?: string | null
          notif_time_end?: string | null
          notif_time_start?: string | null
          notification_frequency_limit?: string | null
          onboarding_completed?: boolean | null
          onboarding_mode?: string | null
          owner_id?: string
          phone?: string | null
          pos_api_key?: string | null
          pos_enabled?: boolean | null
          pos_system_type?: string | null
          pos_webhook_url?: string | null
          points_per_euro?: number | null
          points_per_visit?: number | null
          primary_color?: string | null
          promo_text?: string | null
          reward_alert_threshold?: number | null
          reward_description?: string | null
          score_at_risk_threshold?: number | null
          score_loyal_threshold?: number | null
          score_regular_threshold?: number | null
          score_vip_threshold?: number | null
          secondary_color?: string | null
          show_customer_name?: boolean | null
          show_expiration?: boolean | null
          show_points?: boolean | null
          show_qr_code?: boolean | null
          show_rewards_preview?: boolean | null
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
          vip_auto_enabled?: boolean | null
          vip_auto_threshold?: number | null
          vip_min_total_spent?: number | null
          vip_min_visits?: number | null
          website?: string | null
          welcome_push_enabled?: boolean | null
          welcome_push_message?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_cards: {
        Row: {
          business_id: string
          card_code: string | null
          created_at: string
          current_points: number | null
          customer_id: string
          id: string
          is_active: boolean | null
          last_visit: string | null
          max_points: number | null
          rewards_earned: number | null
          updated_at: string
          wallet_auth_token: string | null
          wallet_change_message: string | null
          wallet_installed_at: string | null
          wallet_last_fetched_at: string | null
          wallet_pass_installed: boolean | null
        }
        Insert: {
          business_id: string
          card_code?: string | null
          created_at?: string
          current_points?: number | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          last_visit?: string | null
          max_points?: number | null
          rewards_earned?: number | null
          updated_at?: string
          wallet_auth_token?: string | null
          wallet_change_message?: string | null
          wallet_installed_at?: string | null
          wallet_last_fetched_at?: string | null
          wallet_pass_installed?: boolean | null
        }
        Update: {
          business_id?: string
          card_code?: string | null
          created_at?: string
          current_points?: number | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          last_visit?: string | null
          max_points?: number | null
          rewards_earned?: number | null
          updated_at?: string
          wallet_auth_token?: string | null
          wallet_change_message?: string | null
          wallet_installed_at?: string | null
          wallet_last_fetched_at?: string | null
          wallet_pass_installed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_cards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_scores: {
        Row: {
          business_id: string
          calculated_at: string
          created_at: string
          customer_id: string
          engagement_score: number
          id: string
          inactivity_days: number
          recency_score: number
          score: number
          segment: string
          spend_score: number
          total_spent: number
          updated_at: string
          visits_score: number
        }
        Insert: {
          business_id: string
          calculated_at?: string
          created_at?: string
          customer_id: string
          engagement_score?: number
          id?: string
          inactivity_days?: number
          recency_score?: number
          score?: number
          segment?: string
          spend_score?: number
          total_spent?: number
          updated_at?: string
          visits_score?: number
        }
        Update: {
          business_id?: string
          calculated_at?: string
          created_at?: string
          customer_id?: string
          engagement_score?: number
          id?: string
          inactivity_days?: number
          recency_score?: number
          score?: number
          segment?: string
          spend_score?: number
          total_spent?: number
          updated_at?: string
          visits_score?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          badges: string[] | null
          birthday: string | null
          business_id: string
          created_at: string
          current_streak: number | null
          email: string | null
          full_name: string | null
          id: string
          last_visit_at: string | null
          level: Database["public"]["Enums"]["loyalty_level"] | null
          longest_streak: number | null
          phone: string | null
          push_token: string | null
          total_points: number | null
          total_visits: number | null
          updated_at: string
        }
        Insert: {
          badges?: string[] | null
          birthday?: string | null
          business_id: string
          created_at?: string
          current_streak?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_visit_at?: string | null
          level?: Database["public"]["Enums"]["loyalty_level"] | null
          longest_streak?: number | null
          phone?: string | null
          push_token?: string | null
          total_points?: number | null
          total_visits?: number | null
          updated_at?: string
        }
        Update: {
          badges?: string[] | null
          birthday?: string | null
          business_id?: string
          created_at?: string
          current_streak?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_visit_at?: string | null
          level?: Database["public"]["Enums"]["loyalty_level"] | null
          longest_streak?: number | null
          phone?: string | null
          push_token?: string | null
          total_points?: number | null
          total_visits?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          business_id: string
          card_id: string | null
          clicked_pricing: boolean
          clicked_signup: boolean
          converted: boolean
          created_at: string
          cta_shown_at: string | null
          current_step: number
          demo_started: boolean
          id: string
          pass_installed: boolean
          slug: string
          step1_at: string | null
          step2_at: string | null
          step3_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          card_id?: string | null
          clicked_pricing?: boolean
          clicked_signup?: boolean
          converted?: boolean
          created_at?: string
          cta_shown_at?: string | null
          current_step?: number
          demo_started?: boolean
          id?: string
          pass_installed?: boolean
          slug: string
          step1_at?: string | null
          step2_at?: string | null
          step3_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          card_id?: string | null
          clicked_pricing?: boolean
          clicked_signup?: boolean
          converted?: boolean
          created_at?: string
          cta_shown_at?: string | null
          current_step?: number
          demo_started?: boolean
          id?: string
          pass_installed?: boolean
          slug?: string
          step1_at?: string | null
          step2_at?: string | null
          step3_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sessions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "customer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_logs: {
        Row: {
          data: Json
          id: string
          merchant_id: string
          sent_at: string
        }
        Insert: {
          data?: Json
          id?: string
          merchant_id: string
          sent_at?: string
        }
        Update: {
          data?: Json
          id?: string
          merchant_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_logs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      merchant_locations: {
        Row: {
          address: string | null
          business_id: string
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          business_id: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          frequency_limit: string | null
          id: string
          media_url: string | null
          message: string
          recipients_count: number
          segment: string
          send_at: string | null
          send_mode: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          frequency_limit?: string | null
          id?: string
          media_url?: string | null
          message: string
          recipients_count?: number
          segment?: string
          send_at?: string | null
          send_mode?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          frequency_limit?: string | null
          id?: string
          media_url?: string | null
          message?: string
          recipients_count?: number
          segment?: string
          send_at?: string | null
          send_mode?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean | null
          message: string
          title: string
          trigger_days_inactive: number | null
          trigger_distance: number | null
          trigger_points_remaining: number | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          message: string
          title: string
          trigger_days_inactive?: number | null
          trigger_distance?: number | null
          trigger_points_remaining?: number | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          message?: string
          title?: string
          trigger_days_inactive?: number | null
          trigger_distance?: number | null
          trigger_points_remaining?: number | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          business_id: string
          campaign_id: string | null
          cta_label: string | null
          cta_url: string | null
          customer_id: string
          delivery_status: string | null
          id: string
          media_url: string | null
          message: string
          read_at: string | null
          scheduled_at: string | null
          segment: string | null
          sent_at: string
          template_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          cta_label?: string | null
          cta_url?: string | null
          customer_id: string
          delivery_status?: string | null
          id?: string
          media_url?: string | null
          message: string
          read_at?: string | null
          scheduled_at?: string | null
          segment?: string | null
          sent_at?: string
          template_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          cta_label?: string | null
          cta_url?: string | null
          customer_id?: string
          delivery_status?: string | null
          id?: string
          media_url?: string | null
          message?: string
          read_at?: string | null
          scheduled_at?: string | null
          segment?: string | null
          sent_at?: string
          template_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_pricing_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          plan_key: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          stripe_monthly_price_id: string | null
          stripe_yearly_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plan_key: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plan_key?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      points_history: {
        Row: {
          action: string | null
          business_id: string
          card_id: string
          created_at: string
          customer_id: string
          id: string
          note: string | null
          points_added: number
          scanned_by: string | null
        }
        Insert: {
          action?: string | null
          business_id: string
          card_id: string
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          points_added?: number
          scanned_by?: string | null
        }
        Update: {
          action?: string | null
          business_id?: string
          card_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          points_added?: number
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "customer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_templates: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          id: string
          is_visible: boolean
          name: string
          points_required: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_visible?: boolean
          name: string
          points_required?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_visible?: boolean
          name?: string
          points_required?: number
          sort_order?: number
        }
        Relationships: []
      }
      rewards: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          points_required: number
          title: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          points_required?: number
          title: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          points_required?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      special_events: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          eligible_segment: string
          end_hour: string | null
          ends_at: string
          id: string
          is_active: boolean
          name: string
          notification_message: string | null
          reward_multiplier: number
          start_hour: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          eligible_segment?: string
          end_hour?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          notification_message?: string | null
          reward_multiplier?: number
          start_hour?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          eligible_segment?: string
          end_hour?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notification_message?: string | null
          reward_multiplier?: number
          start_hour?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          business_name: string
          category: string
          created_at: string
          id: string
          quote: string
          rating: number
          sort_order: number
        }
        Insert: {
          business_name: string
          category?: string
          created_at?: string
          id?: string
          quote: string
          rating?: number
          sort_order?: number
        }
        Update: {
          business_name?: string
          category?: string
          created_at?: string
          id?: string
          quote?: string
          rating?: number
          sort_order?: number
        }
        Relationships: []
      }
      user_merchant_points: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          merchant_location_id: string
          points: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          merchant_location_id: string
          points?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          merchant_location_id?: string
          points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_merchant_points_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_merchant_points_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_merchant_points_merchant_location_id_fkey"
            columns: ["merchant_location_id"]
            isOneToOne: false
            referencedRelation: "merchant_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_apns_logs: {
        Row: {
          apns_response: string | null
          business_id: string | null
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          push_token: string
          serial_number: string
          status: string
        }
        Insert: {
          apns_response?: string | null
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          push_token: string
          serial_number: string
          status?: string
        }
        Update: {
          apns_response?: string | null
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          push_token?: string
          serial_number?: string
          status?: string
        }
        Relationships: []
      }
      wallet_pass_updates: {
        Row: {
          campaign_id: string | null
          change_message: string | null
          id: string
          last_updated: string
          pass_type_id: string
          serial_number: string
        }
        Insert: {
          campaign_id?: string | null
          change_message?: string | null
          id?: string
          last_updated?: string
          pass_type_id?: string
          serial_number: string
        }
        Update: {
          campaign_id?: string | null
          change_message?: string | null
          id?: string
          last_updated?: string
          pass_type_id?: string
          serial_number?: string
        }
        Relationships: []
      }
      wallet_registrations: {
        Row: {
          authentication_token: string
          business_id: string | null
          card_id: string | null
          created_at: string
          customer_id: string | null
          device_library_id: string
          id: string
          pass_type_id: string
          push_token: string
          serial_number: string
          updated_at: string
        }
        Insert: {
          authentication_token: string
          business_id?: string | null
          card_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_library_id: string
          id?: string
          pass_type_id?: string
          push_token: string
          serial_number: string
          updated_at?: string
        }
        Update: {
          authentication_token?: string
          business_id?: string | null
          card_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_library_id?: string
          id?: string
          pass_type_id?: string
          push_token?: string
          serial_number?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "business_owner"
      loyalty_level: "bronze" | "silver" | "gold"
      notification_type:
        | "proximity"
        | "points_reminder"
        | "special_offer"
        | "win_back"
        | "reward_earned"
        | "custom"
      subscription_plan: "starter" | "pro" | "enterprise"
      subscription_status:
        | "active"
        | "inactive"
        | "trialing"
        | "past_due"
        | "canceled"
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
      app_role: ["super_admin", "business_owner"],
      loyalty_level: ["bronze", "silver", "gold"],
      notification_type: [
        "proximity",
        "points_reminder",
        "special_offer",
        "win_back",
        "reward_earned",
        "custom",
      ],
      subscription_plan: ["starter", "pro", "enterprise"],
      subscription_status: [
        "active",
        "inactive",
        "trialing",
        "past_due",
        "canceled",
      ],
    },
  },
} as const
