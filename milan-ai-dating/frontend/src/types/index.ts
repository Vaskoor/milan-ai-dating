export interface User {
  id: string
  email: string
  phone?: string
  first_name: string
  is_verified: boolean
  subscription_tier: 'free' | 'basic' | 'premium' | 'elite'
  role: 'user' | 'moderator' | 'admin' | 'superadmin'
  profile_photo_url?: string
}

export interface Profile {
  id: string
  user_id: string
  first_name: string
  last_name?: string
  display_name?: string
  date_of_birth: string
  gender: 'male' | 'female' | 'non_binary' | 'other'
  bio?: string
  about_me?: string
  looking_for?: string
  city?: string
  province?: string
  height_cm?: number
  body_type?: string
  education?: string
  occupation?: string
  religion?: string
  mother_tongue?: string
  marital_status?: string
  drinking?: string
  smoking?: string
  diet?: string
  profile_photo_url?: string
  photo_count: number
  is_photo_verified: boolean
  verification_badge_level: number
  profile_completion_score: number
  interests: Interest[]
}

export interface Interest {
  id: string
  interest_name: string
  category?: string
}

export interface Match {
  id: string
  user1_id: string
  user2_id: string
  other_user: {
    id: string
    first_name: string
    profile_photo_url?: string
    age?: number
  }
  compatibility_score?: number
  match_reason?: string
  message_count: number
  last_message_at?: string
  created_at: string
}

export interface Conversation {
  id: string
  match_id: string
  other_user: {
    id: string
    first_name: string
    profile_photo_url?: string
    age?: number
  }
  is_active: boolean
  total_messages: number
  unread_count: number
  last_message?: Message
  last_message_at?: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  content_type: 'text' | 'image' | 'voice' | 'gif' | 'location'
  media_url?: string
  is_read: boolean
  read_at?: string
  is_ai_suggestion: boolean
  created_at: string
}

export interface SubscriptionPlan {
  id: string
  plan_code: string
  name_en: string
  name_ne?: string
  monthly_price_npr: number
  features: {
    daily_swipes: number
    superlikes_per_day: number
    boosts_per_month: number
    see_likes: boolean
    advanced_filters: boolean
    unlimited_likes: boolean
    read_receipts: boolean
    ai_assistant: boolean
    incognito_mode: boolean
    who_viewed: boolean
  }
}

export interface SwipeProfile {
  id: string
  user_id: string
  first_name: string
  age?: number
  profile_photo_url?: string
  city?: string
  bio?: string
  interests: string[]
  verification_badge_level: number
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
}

export interface RegisterData {
  email: string
  password: string
  first_name: string
  date_of_birth: string
  gender: string
  phone?: string
}
