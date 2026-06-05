// Supabase is no longer used by the frontend.
// This file is kept temporarily to avoid breaking legacy imports during migration.
// TODO: Delete this file (and @supabase/supabase-js dependency) once confirmed unused.
export const supabase = null as unknown as never

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string
          avatar_url: string
          email: string
          role: 'admin' | 'dealer' | 'customer' | 'crm' | 'service_manager'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      service_centers: {
        Row: {
          id: string
          owner_id: string | null
          name: string
          address: string
          city: string
          state: string
          pincode: string
          phone: string
          email: string
          gst_number: string
          description: string
          logo_url: string
          status: 'pending' | 'active' | 'suspended' | 'rejected'
          rating: number
          total_reviews: number
          brands: string[]
          services: string[]
          open_time: string
          close_time: string
          lat: number
          lng: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['service_centers']['Row']>
        Update: Partial<Database['public']['Tables']['service_centers']['Row']>
      }
      service_bookings: {
        Row: {
          id: string
          user_id: string
          bike_id: string | null
          service_center_id: string
          service_type: string
          scheduled_date: string
          scheduled_time: string
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          notes: string
          estimated_cost: number
          final_cost: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['service_bookings']['Row']>
        Update: Partial<Database['public']['Tables']['service_bookings']['Row']>
      }
    }
  }
}
