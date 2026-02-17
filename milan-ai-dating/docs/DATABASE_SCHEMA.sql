-- Milan AI Dating Platform - Database Schema
-- PostgreSQL 15+
-- Designed for Nepalese Market

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- CORE USER TABLES
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium', 'elite')),
    
    -- Role-based access
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'superadmin')),
    
    -- Security
    email_verified_at TIMESTAMP,
    phone_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- GDPR/Privacy
    consent_given BOOLEAN DEFAULT false,
    consent_given_at TIMESTAMP,
    data_processing_consent BOOLEAN DEFAULT false,
    marketing_consent BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete
    
    -- Indexes
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_subscription ON users(subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- USER PROFILES
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic Info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    display_name VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'non_binary', 'other')),
    
    -- Location (Nepal-specific)
    country VARCHAR(50) DEFAULT 'Nepal',
    province VARCHAR(50),
    district VARCHAR(50),
    city VARCHAR(100),
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_geom GEOMETRY(Point, 4326),
    
    -- Bio & About
    bio TEXT,
    about_me TEXT,
    looking_for TEXT,
    
    -- Physical Attributes
    height_cm INT CHECK (height_cm BETWEEN 100 AND 250),
    body_type VARCHAR(30) CHECK (body_type IN ('slim', 'average', 'athletic', 'curvy', 'plus_size')),
    
    -- Lifestyle
    education VARCHAR(100),
    occupation VARCHAR(100),
    company VARCHAR(100),
    income_range VARCHAR(50),
    religion VARCHAR(50),
    caste VARCHAR(50), -- Optional, for those who want to specify
    mother_tongue VARCHAR(50),
    marital_status VARCHAR(30) CHECK (marital_status IN ('never_married', 'divorced', 'widowed', 'separated')),
    have_children BOOLEAN DEFAULT false,
    want_children BOOLEAN,
    
    -- Habits
    drinking VARCHAR(20) CHECK (drinking IN ('never', 'socially', 'regularly')),
    smoking VARCHAR(20) CHECK (smoking IN ('never', 'socially', 'regularly')),
    diet VARCHAR(30) CHECK (diet IN ('vegetarian', 'vegan', 'non_vegetarian', 'jain', 'other')),
    
    -- Profile Media
    profile_photo_url VARCHAR(500),
    photo_count INT DEFAULT 0,
    
    -- Verification
    is_photo_verified BOOLEAN DEFAULT false,
    is_identity_verified BOOLEAN DEFAULT false,
    is_phone_verified BOOLEAN DEFAULT false,
    verification_badge_level INT DEFAULT 0, -- 0=None, 1=Basic, 2=Verified, 3=Premium
    
    -- Profile Status
    profile_completion_score INT DEFAULT 0 CHECK (profile_completion_score BETWEEN 0 AND 100),
    is_profile_visible BOOLEAN DEFAULT true,
    is_incognito BOOLEAN DEFAULT false,
    
    -- AI-generated fields
    personality_traits JSONB, -- Array of traits with scores
    interest_categories JSONB, -- Categorized interests
    embedding_vector_id VARCHAR(100), -- Reference to vector DB
    
    -- Metadata
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_location ON profiles USING GIST(location_geom);
CREATE INDEX idx_profiles_gender ON profiles(gender);
CREATE INDEX idx_profiles_age ON profiles(date_of_birth);
CREATE INDEX idx_profiles_completion ON profiles(profile_completion_score);
CREATE INDEX idx_profiles_active ON profiles(last_active_at);
CREATE INDEX idx_profiles_trgm ON profiles USING gin(first_name gin_trgm_ops, last_name gin_trgm_ops);

-- Trigger to update location_geom from lat/long
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location_geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_location_geom
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_location_geom();

-- ============================================
-- USER INTERESTS
-- ============================================

CREATE TABLE interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    interest_name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- e.g., 'hobbies', 'music', 'sports', 'travel'
    importance_level INT DEFAULT 3 CHECK (importance_level BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(profile_id, interest_name)
);

CREATE INDEX idx_interests_profile ON interests(profile_id);
CREATE INDEX idx_interests_name ON interests(interest_name);

-- ============================================
-- USER PHOTOS
-- ============================================

CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    photo_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    
    -- Photo metadata
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    is_moderated BOOLEAN DEFAULT false,
    moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    
    -- AI analysis
    has_face BOOLEAN,
    face_count INT,
    nsfw_score DECIMAL(3,2), -- 0.00 to 1.00
    photo_quality_score DECIMAL(3,2),
    
    -- Metadata
    file_size_bytes INT,
    width INT,
    height INT,
    mime_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    moderated_at TIMESTAMP,
    moderated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_photos_user ON photos(user_id);
CREATE INDEX idx_photos_primary ON photos(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_photos_moderation ON photos(moderation_status);

-- ============================================
-- USER PREFERENCES (MATCHING CRITERIA)
-- ============================================

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic Preferences
    looking_for_gender VARCHAR(20)[] DEFAULT ARRAY['male', 'female'], -- Can select multiple
    age_min INT DEFAULT 18 CHECK (age_min >= 18),
    age_max INT DEFAULT 50 CHECK (age_max <= 80),
    
    -- Location Preferences
    preferred_distance_km INT DEFAULT 50,
    preferred_provinces VARCHAR(50)[],
    preferred_districts VARCHAR(50)[],
    
    -- Lifestyle Preferences
    preferred_religions VARCHAR(50)[],
    preferred_marital_status VARCHAR(30)[],
    preferred_education_levels VARCHAR(100)[],
    
    -- Deal Breakers
    deal_breaker_smoking BOOLEAN DEFAULT false,
    deal_breaker_drinking BOOLEAN DEFAULT false,
    deal_breaker_children BOOLEAN DEFAULT false,
    
    -- AI-learned preferences (updated over time)
    learned_interests JSONB,
    learned_personality_preferences JSONB,
    compatibility_weights JSONB, -- Custom weights for matching algorithm
    
    -- Notification Preferences
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    match_notifications BOOLEAN DEFAULT true,
    message_notifications BOOLEAN DEFAULT true,
    marketing_notifications BOOLEAN DEFAULT false,
    
    -- Privacy Preferences
    show_online_status BOOLEAN DEFAULT true,
    show_last_active BOOLEAN DEFAULT true,
    show_distance BOOLEAN DEFAULT true,
    allow_discovery BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_preferences_user ON user_preferences(user_id);

-- ============================================
-- SWIPES / LIKES
-- ============================================

CREATE TABLE swipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swiper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('like', 'dislike', 'superlike')),
    
    -- Context
    swipe_context VARCHAR(50) DEFAULT 'discovery', -- 'discovery', 'recommendation', 'search'
    
    -- AI-generated insights
    compatibility_score DECIMAL(4,2), -- At time of swipe
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(swiper_id, swiped_id)
);

CREATE INDEX idx_swipes_swiper ON swipes(swiper_id, created_at);
CREATE INDEX idx_swipes_swiped ON swipes(swiped_id, action);
CREATE INDEX idx_swipes_match ON swipes(swiper_id, swiped_id);

-- ============================================
-- MATCHES
-- ============================================

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Match status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'unmatched', 'blocked')),
    
    -- Who initiated
    initiated_by UUID REFERENCES users(id),
    
    -- AI insights
    compatibility_score DECIMAL(4,2),
    match_reason TEXT, -- AI-generated explanation
    
    -- Engagement metrics
    first_message_at TIMESTAMP,
    last_message_at TIMESTAMP,
    message_count INT DEFAULT 0,
    
    -- Unmatch details
    unmatched_at TIMESTAMP,
    unmatched_by UUID REFERENCES users(id),
    unmatched_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user1_id, user2_id),
    CONSTRAINT different_users CHECK (user1_id != user2_id)
);

CREATE INDEX idx_matches_user1 ON matches(user1_id, status);
CREATE INDEX idx_matches_user2 ON matches(user2_id, status);
CREATE INDEX idx_matches_created ON matches(created_at);

-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    
    -- Participants (denormalized for quick access)
    user1_id UUID NOT NULL REFERENCES users(id),
    user2_id UUID NOT NULL REFERENCES users(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Message counts
    total_messages INT DEFAULT 0,
    unread_count_user1 INT DEFAULT 0,
    unread_count_user2 INT DEFAULT 0,
    
    -- Timestamps
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(match_id)
);

CREATE INDEX idx_conversations_match ON conversations(match_id);
CREATE INDEX idx_conversations_user1 ON conversations(user1_id, last_message_at);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id, last_message_at);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    
    -- Message content
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'voice', 'gif', 'location')),
    
    -- Media attachments
    media_url VARCHAR(500),
    media_metadata JSONB,
    
    -- AI moderation
    moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'blocked')),
    toxicity_score DECIMAL(4,3),
    flagged_reason TEXT,
    
    -- AI suggestions (if this was AI-generated suggestion)
    is_ai_suggestion BOOLEAN DEFAULT false,
    ai_suggestion_metadata JSONB,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;
CREATE INDEX idx_messages_moderation ON messages(moderation_status);

-- ============================================
-- SUBSCRIPTIONS & PAYMENTS (NPR Currency)
-- ============================================

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code VARCHAR(20) UNIQUE NOT NULL, -- 'free', 'basic', 'premium', 'elite'
    name_en VARCHAR(100) NOT NULL,
    name_ne VARCHAR(100), -- Nepali name
    
    -- Pricing in NPR
    monthly_price_npr DECIMAL(10,2) NOT NULL,
    quarterly_price_npr DECIMAL(10,2),
    yearly_price_npr DECIMAL(10,2),
    
    -- Features (JSON for flexibility)
    features JSONB NOT NULL,
    
    -- Limits
    daily_swipe_limit INT,
    superlikes_per_day INT,
    boosts_per_month INT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plans
INSERT INTO subscription_plans (plan_code, name_en, monthly_price_npr, features, daily_swipe_limit, superlikes_per_day, boosts_per_month) VALUES
('free', 'Free', 0, '{"see_likes": false, "advanced_filters": false, "unlimited_likes": false, "read_receipts": false, "ai_assistant": false, "incognito_mode": false, "profile_boost": false, "who_viewed": false}'::jsonb, 50, 0, 0),
('basic', 'Basic', 499, '{"see_likes": true, "advanced_filters": true, "unlimited_likes": true, "read_receipts": false, "ai_assistant": false, "incognito_mode": false, "profile_boost": false, "who_viewed": false}'::jsonb, NULL, 1, 0),
('premium', 'Premium', 999, '{"see_likes": true, "advanced_filters": true, "unlimited_likes": true, "read_receipts": true, "ai_assistant": true, "incognito_mode": false, "profile_boost": true, "who_viewed": true}'::jsonb, NULL, 5, 2),
('elite', 'Elite', 1999, '{"see_likes": true, "advanced_filters": true, "unlimited_likes": true, "read_receipts": true, "ai_assistant": true, "incognito_mode": true, "profile_boost": true, "who_viewed": true, "priority_support": true, "exclusive_matches": true}'::jsonb, NULL, 10, 5);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    -- Subscription period
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
    auto_renew BOOLEAN DEFAULT true,
    
    -- Payment info
    payment_method VARCHAR(50), -- 'khalti', 'esewa', 'imepay', 'bank_transfer'
    
    -- Cancellation
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at) WHERE status = 'active';

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    subscription_id UUID REFERENCES subscriptions(id),
    
    -- Payment details
    amount_npr DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NPR',
    payment_method VARCHAR(50) NOT NULL,
    
    -- External transaction
    external_transaction_id VARCHAR(255),
    external_reference VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')),
    
    -- Metadata
    payment_metadata JSONB,
    failure_reason TEXT,
    
    -- Timestamps
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_external ON payments(external_transaction_id);

-- ============================================
-- REPORTS & MODERATION
-- ============================================

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_id UUID NOT NULL REFERENCES users(id),
    
    -- Report details
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('fake_profile', 'inappropriate_content', 'harassment', 'scam', 'underage', 'other')),
    description TEXT,
    
    -- Evidence
    evidence_urls TEXT[], -- URLs to screenshots, etc.
    related_message_id UUID REFERENCES messages(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    
    -- Resolution
    resolution VARCHAR(50),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    action_taken TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_reported ON reports(reported_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_type ON reports(report_type);

CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- ============================================
-- AI AGENT LOGS
-- ============================================

CREATE TABLE agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Agent info
    agent_name VARCHAR(50) NOT NULL,
    agent_version VARCHAR(20),
    
    -- Request/Response
    request_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    
    input_payload JSONB,
    output_payload JSONB,
    
    -- Performance
    execution_time_ms INT,
    tokens_used INT,
    
    -- Status
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Context
    session_id VARCHAR(100),
    request_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_name, created_at);
CREATE INDEX idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX idx_agent_logs_request ON agent_logs(request_type);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at);

-- ============================================
-- USER BEHAVIOR & ANALYTICS
-- ============================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    
    -- Session info
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    
    -- Activity
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    
    -- Metrics
    pages_viewed INT DEFAULT 0,
    actions_count INT DEFAULT 0
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);

CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    activity_type VARCHAR(50) NOT NULL, -- 'profile_view', 'swipe', 'message', 'login', etc.
    activity_metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_user ON user_activities(user_id, created_at);
CREATE INDEX idx_activities_type ON user_activities(activity_type);

-- ============================================
-- AI-GENERATED RECOMMENDATIONS
-- ============================================

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    recommended_user_id UUID NOT NULL REFERENCES users(id),
    
    -- AI scoring
    compatibility_score DECIMAL(4,2) NOT NULL,
    match_probability DECIMAL(4,2),
    
    -- Reasoning
    recommendation_reason TEXT,
    common_interests TEXT[],
    
    -- Status
    shown_to_user BOOLEAN DEFAULT false,
    user_action VARCHAR(20), -- 'liked', 'disliked', 'ignored'
    action_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, recommended_user_id)
);

CREATE INDEX idx_recommendations_user ON recommendations(user_id, compatibility_score DESC);
CREATE INDEX idx_recommendations_shown ON recommendations(user_id, shown_to_user);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content
    notification_type VARCHAR(50) NOT NULL, -- 'match', 'message', 'like', 'system'
    title VARCHAR(200) NOT NULL,
    body TEXT,
    
    -- Deep link / action
    action_url VARCHAR(500),
    action_data JSONB,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    
    -- Delivery
    sent_via_push BOOLEAN DEFAULT false,
    sent_via_email BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

-- ============================================
-- VECTOR EMBEDDINGS (Metadata only - actual vectors in FAISS)
-- ============================================

CREATE TABLE embedding_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Vector reference
    faiss_index_id BIGINT,
    embedding_type VARCHAR(50) NOT NULL, -- 'profile', 'interests', 'conversation'
    
    -- Model info
    model_name VARCHAR(100),
    model_version VARCHAR(20),
    
    -- Embedding metadata
    vector_dimension INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, embedding_type)
);

CREATE INDEX idx_embeddings_user ON embedding_metadata(user_id);
CREATE INDEX idx_embeddings_faiss ON embedding_metadata(faiss_index_id);

-- ============================================
-- AUDIT LOGS (Security & Compliance)
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Who
    user_id UUID REFERENCES users(id),
    actor_type VARCHAR(20) DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'admin', 'agent')),
    
    -- What
    action VARCHAR(100) NOT NULL, -- 'login', 'profile_update', 'password_change', etc.
    resource_type VARCHAR(50), -- 'user', 'profile', 'message', etc.
    resource_id UUID,
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_embedding_metadata_updated_at BEFORE UPDATE ON embedding_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active matches with user details
CREATE VIEW active_matches_view AS
SELECT 
    m.id as match_id,
    m.user1_id,
    m.user2_id,
    m.compatibility_score,
    m.created_at as matched_at,
    m.message_count,
    m.last_message_at,
    p1.first_name as user1_name,
    p1.profile_photo_url as user1_photo,
    p2.first_name as user2_name,
    p2.profile_photo_url as user2_photo
FROM matches m
JOIN profiles p1 ON m.user1_id = p1.user_id
JOIN profiles p2 ON m.user2_id = p2.user_id
WHERE m.status = 'active';

-- User subscription status
CREATE VIEW user_subscription_view AS
SELECT 
    u.id as user_id,
    u.email,
    u.subscription_tier,
    s.id as subscription_id,
    s.status as subscription_status,
    s.started_at,
    s.expires_at,
    sp.name_en as plan_name,
    sp.monthly_price_npr,
    sp.features
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id;

-- Profile completeness calculation
CREATE OR REPLACE FUNCTION calculate_profile_completion(profile_id UUID)
RETURNS INT AS $$
DECLARE
    score INT := 0;
    p RECORD;
BEGIN
    SELECT * INTO p FROM profiles WHERE id = profile_id;
    
    IF p IS NULL THEN RETURN 0; END IF;
    
    -- Basic info (30 points)
    IF p.first_name IS NOT NULL THEN score := score + 5; END IF;
    IF p.date_of_birth IS NOT NULL THEN score := score + 5; END IF;
    IF p.gender IS NOT NULL THEN score := score + 5; END IF;
    IF p.bio IS NOT NULL AND LENGTH(p.bio) > 50 THEN score := score + 10; END IF;
    IF p.profile_photo_url IS NOT NULL THEN score := score + 5; END IF;
    
    -- Location (15 points)
    IF p.city IS NOT NULL THEN score := score + 5; END IF;
    IF p.latitude IS NOT NULL THEN score := score + 10; END IF;
    
    -- Lifestyle (25 points)
    IF p.education IS NOT NULL THEN score := score + 5; END IF;
    IF p.occupation IS NOT NULL THEN score := score + 5; END IF;
    IF p.religion IS NOT NULL THEN score := score + 5; END IF;
    IF p.height_cm IS NOT NULL THEN score := score + 5; END IF;
    IF p.marital_status IS NOT NULL THEN score := score + 5; END IF;
    
    -- Interests (20 points)
    IF (SELECT COUNT(*) FROM interests WHERE profile_id = p.id) >= 3 THEN score := score + 10; END IF;
    IF (SELECT COUNT(*) FROM interests WHERE profile_id = p.id) >= 5 THEN score := score + 10; END IF;
    
    -- Photos (10 points)
    IF (SELECT COUNT(*) FROM photos WHERE user_id = p.user_id) >= 2 THEN score := score + 5; END IF;
    IF (SELECT COUNT(*) FROM photos WHERE user_id = p.user_id) >= 4 THEN score := score + 5; END IF;
    
    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- Update profile completion trigger
CREATE OR REPLACE FUNCTION update_profile_completion_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.profile_completion_score := calculate_profile_completion(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_completion
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_completion_trigger();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Create admin user (password should be changed immediately)
-- Password hash is for 'Admin@123' - CHANGE IN PRODUCTION
INSERT INTO users (email, password_hash, role, is_verified, email_verified_at, consent_given, consent_given_at)
VALUES (
    'admin@milan.ai', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G',
    'superadmin',
    true,
    CURRENT_TIMESTAMP,
    true,
    CURRENT_TIMESTAMP
);

-- Create test moderator
INSERT INTO users (email, password_hash, role, is_verified, email_verified_at, consent_given, consent_given_at)
VALUES (
    'moderator@milan.ai',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G',
    'moderator',
    true,
    CURRENT_TIMESTAMP,
    true,
    CURRENT_TIMESTAMP
);
