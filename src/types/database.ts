export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Replace with `supabase gen types typescript` output after the first remote migration.
export type Database = {
  public: {
    Tables: {
      hotel_settings: {
        Row: {
          max_booking_days: number
          telephone: string | null
          check_in_time: string
          front_desk_open: string
          front_desk_close: string
        }
        Insert: {
          max_booking_days?: number
          telephone?: string | null
          check_in_time?: string
          front_desk_open?: string
          front_desk_close?: string
        }
        Update: {
          max_booking_days?: number
          telephone?: string | null
          check_in_time?: string
          front_desk_open?: string
          front_desk_close?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          user_id: string
          display_name: string
          role: 'owner' | 'manager' | 'staff'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          display_name: string
          role?: 'owner' | 'manager' | 'staff'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          role?: 'owner' | 'manager' | 'staff'
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          id: string
          code: string
          name_ja: string
          name_en: string | null
          name_ko: string | null
          description_ja: string | null
          description_en: string | null
          description_ko: string | null
          standard_capacity: number
          max_capacity: number
          area_square_meters: number | null
          bed_description_ja: string | null
          bed_description_en: string | null
          bed_description_ko: string | null
          is_sellable: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name_ja: string
          name_en?: string | null
          name_ko?: string | null
          description_ja?: string | null
          description_en?: string | null
          description_ko?: string | null
          standard_capacity?: number
          max_capacity?: number
          area_square_meters?: number | null
          bed_description_ja?: string | null
          bed_description_en?: string | null
          bed_description_ko?: string | null
          is_sellable?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['room_types']['Insert']>
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          room_number: string
          floor: number
          room_style: 'western' | 'japanese'
          room_type_id: string
          standard_capacity: number
          max_capacity: number
          sales_status: 'active' | 'inactive' | 'admin_only' | 'maintenance'
          operations_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_number: string
          floor: number
          room_style: 'western' | 'japanese'
          room_type_id: string
          standard_capacity?: number
          max_capacity?: number
          sales_status?: 'active' | 'inactive' | 'admin_only' | 'maintenance'
          operations_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'rooms_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          },
        ]
      }
      room_rates: {
        Row: {
          id: string
          room_type_id: string
          guest_count: number
          valid_from: string
          valid_to: string
          price_per_person_yen: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_type_id: string
          guest_count: number
          valid_from: string
          valid_to: string
          price_per_person_yen: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          price_per_person_yen?: number
          valid_from?: string
          valid_to?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'room_rates_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          },
        ]
      }
      room_type_inventory: {
        Row: {
          id: string
          room_type_id: string
          stay_date: string
          sellable_quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_type_id: string
          stay_date: string
          sellable_quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          sellable_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'room_type_inventory_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          },
        ]
      }
      guests: {
        Row: {
          id: string
          name: string
          name_kana_or_roman: string | null
          email: string
          telephone: string
          nationality: string | null
          postal_code: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          name_kana_or_roman?: string | null
          email: string
          telephone: string
          nationality?: string | null
          postal_code?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['guests']['Insert']>
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          name: string
          normalized_name: string
          phone: string
          normalized_phone: string
          email: string | null
          memo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          email?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          phone?: string
          email?: string | null
          memo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          id: string
          reservation_number: string
          primary_guest_id: string
          customer_id: string | null
          check_in: string
          check_out: string
          adults: number
          paid_children: number
          free_preschool_children: number
          status:
            | 'pending'
            | 'confirmed'
            | 'cancelled'
            | 'checked_in'
            | 'checked_out'
            | 'no_show'
          booking_source: 'online' | 'phone' | 'walk_in' | 'admin'
          expected_check_in_time: string | null
          guest_note: string | null
          admin_note: string | null
          total_amount_yen: number | null
          admin_seen_at: string | null
          cancelled_at: string | null
          cancellation_fee_rate: number | null
          cancellation_fee_yen: number | null
          booking_request_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reservation_number: string
          primary_guest_id: string
          customer_id?: string
          check_in: string
          check_out: string
          adults: number
          paid_children?: number
          free_preschool_children?: number
          status?: Database['public']['Tables']['reservations']['Row']['status']
          booking_source?: Database['public']['Tables']['reservations']['Row']['booking_source']
          expected_check_in_time?: string | null
          guest_note?: string | null
          admin_note?: string | null
          total_amount_yen?: number | null
          admin_seen_at?: string | null
          cancelled_at?: string | null
          cancellation_fee_rate?: number | null
          cancellation_fee_yen?: number | null
          booking_request_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'reservations_primary_guest_id_fkey'
            columns: ['primary_guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      reservation_rooms: {
        Row: {
          id: string
          reservation_id: string
          room_type_id: string
          room_id: string | null
          paid_guest_count: number
          adult_guest_count: number
          paid_child_count: number
          free_preschool_count: number
          meal_plan: string
          meal_surcharge_yen: number
          quoted_price_per_person_yen: number | null
          quoted_room_total_yen: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          room_type_id: string
          room_id?: string | null
          paid_guest_count: number
          adult_guest_count?: number
          paid_child_count?: number
          free_preschool_count?: number
          meal_plan?: string
          meal_surcharge_yen?: number
          quoted_price_per_person_yen?: number | null
          quoted_room_total_yen?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<
          Database['public']['Tables']['reservation_rooms']['Insert']
        >
        Relationships: [
          {
            foreignKeyName: 'reservation_rooms_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservation_rooms_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservation_rooms_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      reservation_room_nights: {
        Row: {
          id: string
          reservation_room_id: string
          stay_date: string
          price_per_person_yen: number
          paid_guest_count: number
          room_total_yen: number
          created_at: string
        }
        Insert: {
          id?: string
          reservation_room_id: string
          stay_date: string
          price_per_person_yen: number
          paid_guest_count: number
          room_total_yen: number
          created_at?: string
        }
        Update: {
          price_per_person_yen?: number
          paid_guest_count?: number
          room_total_yen?: number
        }
        Relationships: [
          {
            foreignKeyName: 'reservation_room_nights_reservation_room_id_fkey'
            columns: ['reservation_room_id']
            isOneToOne: false
            referencedRelation: 'reservation_rooms'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          id: string
          reservation_id: string
          method: 'pay_at_hotel' | 'bank_transfer' | 'card'
          status:
            'pending' | 'awaiting_payment' | 'paid' | 'refunded' | 'cancelled'
          amount_yen: number
          paid_at: string | null
          external_reference: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          method?: Database['public']['Tables']['payments']['Row']['method']
          status?: Database['public']['Tables']['payments']['Row']['status']
          amount_yen: number
          paid_at?: string | null
          external_reference?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'payments_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          },
        ]
      }
      inventory_blocks: {
        Row: {
          id: string
          room_id: string
          reservation_room_id: string | null
          check_in: string
          check_out: string
          status: 'held' | 'active' | 'released'
          reason: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          reservation_room_id?: string | null
          check_in: string
          check_out: string
          status?: Database['public']['Tables']['inventory_blocks']['Row']['status']
          reason?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<
          Database['public']['Tables']['inventory_blocks']['Insert']
        >
        Relationships: [
          {
            foreignKeyName: 'inventory_blocks_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_blocks_reservation_room_id_fkey'
            columns: ['reservation_room_id']
            isOneToOne: false
            referencedRelation: 'reservation_rooms'
            referencedColumns: ['id']
          },
        ]
      }
      rate_overrides: {
        Row: {
          id: string
          room_type_id: string
          stay_date: string
          guest_count: number
          price_per_person_yen: number
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_type_id: string
          stay_date: string
          guest_count: number
          price_per_person_yen: number
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          price_per_person_yen?: number
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rate_overrides_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          },
        ]
      }
      rate_rules: {
        Row: {
          id: string
          name_ja: string
          name_en: string | null
          name_ko: string | null
          description_ja: string | null
          description_en: string | null
          description_ko: string | null
          adjustment_type: 'fixed_amount' | 'percentage'
          adjustment_value: number
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ja: string
          name_en?: string | null
          name_ko?: string | null
          description_ja?: string | null
          description_en?: string | null
          description_ko?: string | null
          adjustment_type: 'fixed_amount' | 'percentage'
          adjustment_value: number
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name_ja?: string
          description_ja?: string | null
          adjustment_value?: number
          is_active?: boolean
          display_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_rule_dates: {
        Row: {
          id: string
          rate_rule_id: string
          stay_date: string
          created_at: string
        }
        Insert: {
          id?: string
          rate_rule_id: string
          stay_date: string
          created_at?: string
        }
        Update: {
          rate_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rate_rule_dates_rate_rule_id_fkey'
            columns: ['rate_rule_id']
            isOneToOne: false
            referencedRelation: 'rate_rules'
            referencedColumns: ['id']
          },
        ]
      }
      cancellation_policies: {
        Row: {
          id: string
          code: string
          min_days_before: number | null
          max_days_before: number | null
          fee_percent: number
          is_no_show: boolean
          description_ja: string | null
          description_en: string | null
          description_ko: string | null
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          min_days_before?: number | null
          max_days_before?: number | null
          fee_percent: number
          is_no_show?: boolean
          description_ja?: string | null
          description_en?: string | null
          description_ko?: string | null
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<
          Database['public']['Tables']['cancellation_policies']['Insert']
        >
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      next_admin_reservation_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      create_admin_reservation: {
        Args: { p_guest: Json; p_reservation: Json; p_rooms: Json }
        Returns: string
      }
      assign_reservation_room: {
        Args: { p_reservation_room_id: string; p_room_id: string }
        Returns: undefined
      }
      change_reservation_status: {
        Args: { p_reservation_id: string; p_status: string }
        Returns: undefined
      }
      cancel_admin_reservation: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      update_admin_reservation_contact: {
        Args: { p_reservation_id: string; p_guest: Json; p_reservation: Json }
        Returns: undefined
      }
      update_admin_payment_status: {
        Args: {
          p_payment_id: string
          p_expected_status: string
          p_status: string
        }
        Returns: {
          id: string
          status: string
          paid_at: string | null
        }[]
      }
      normalize_customer_name: { Args: { p_name: string }; Returns: string }
      normalize_customer_phone: { Args: { p_phone: string }; Returns: string }
      get_admin_customers: {
        Args: {
          p_search?: string
          p_sort?: string
          p_page?: number
          p_page_size?: number
        }
        Returns: {
          id: string
          name: string
          phone: string
          email: string | null
          memo: string | null
          total_reservations: number
          completed_stays: number
          first_visit: string | null
          recent_visit: string | null
          total_nights: number
          average_visit_interval_days: number | null
          total_count: number
        }[]
      }
      search_available_room_types: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_adults: number
          p_paid_children: number
          p_free_preschool_children: number
          p_room_count: number
        }
        Returns: {
          room_type_id: string
          room_type_code: string
          room_type_name_ja: string
          available_quantity: number
          is_available: boolean
          guest_distribution: Json
          nightly_prices: Json
          min_price_per_person_yen: number
          estimated_total_yen: number
        }[]
      }
      create_public_reservation: {
        Args: {
          p_booking_request_id: string
          p_check_in: string
          p_check_out: string
          p_adults: number
          p_paid_children: number
          p_free_preschool_children: number
          p_room_count: number
          p_room_type_id: string
          p_name: string
          p_name_kana_or_roman: string
          p_telephone: string
          p_email: string
          p_expected_check_in_time: string
          p_guest_note: string
          p_expected_total_yen: number
        }
        Returns: Json
      }
      search_public_mixed_booking: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_rooms: Json
        }
        Returns: Json
      }
      create_public_mixed_reservation: {
        Args: {
          p_booking_request_id: string
          p_check_in: string
          p_check_out: string
          p_rooms: Json
          p_name: string
          p_name_kana_or_roman: string
          p_telephone: string
          p_email: string
          p_expected_check_in_time: string
          p_guest_note: string
          p_expected_total_yen: number
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
