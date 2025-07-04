-- ==========================================
-- Custom TimescaleDB Initialization Script
-- This script runs when the container starts for the first time
-- ==========================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create your custom database (if it doesn't exist)
-- The main database is already created by Docker environment variables

-- 3. CREATE IMPRESSION EVENTS TABLE (Matching Your PostgreSQL Schema)
-- ==========================================
CREATE TABLE impression_events (
    id UUID NOT NULL,
    
    -- PRIMARY: Creative that was displayed
    creative_id UUID NOT NULL,
    bid_response_id UUID NOT NULL,
    
    -- HIERARCHY: All related entities for multi-dimensional analytics
    campaign_id UUID NOT NULL,
    advertiser_id UUID NOT NULL,
    inventory_id UUID NOT NULL,
    publisher_id UUID NOT NULL,
    website_id UUID NOT NULL,
    template_id UUID,
    
    -- Financial
    bid_price DECIMAL(10,4),
    final_price DECIMAL(10,4),
    
    -- TECHNICAL DETAILS
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT,
    device_type TEXT,
    
    -- Geo LOCATION
    country TEXT,
    region TEXT,
    city TEXT,
    
    -- VIEWABILITY METRICS (IAB standards)
    viewable BOOLEAN DEFAULT FALSE,
    view_time BIGINT,
    
    -- FRAUD DETECTION
    is_bot BOOLEAN DEFAULT FALSE,
    fraud_score DECIMAL(3,2),
    
    slot_id VARCHAR(100),
    user_fingerprint VARCHAR(50),
    
    -- SYNC STATUS (Not needed in TimescaleDB but keeping for compatibility)
    synced_to_timescale BOOLEAN DEFAULT TRUE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (timestamp, id)
);

-- Convert to hypertable (1 hour chunks for high-frequency data)
SELECT create_hypertable('impression_events', 'timestamp');

-- 4. CREATE CLICK EVENTS TABLE (Matching Your PostgreSQL Schema)
-- ==========================================
CREATE TABLE click_events (
    id UUID NOT NULL,
    
    -- LINK TO IMPRESSION
    impression_id UUID,
    
    -- PRIMARY: Creative that was clicked
    creative_id UUID NOT NULL,
    bid_response_id UUID NOT NULL,
    
    -- HIERARCHY: All related entities
    campaign_id UUID NOT NULL,
    advertiser_id UUID NOT NULL,
    inventory_id UUID NOT NULL,
    publisher_id UUID NOT NULL,
    website_id UUID NOT NULL,
    template_id UUID,
    
    -- TECHNICAL DETAILS
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT,
    device_type TEXT,
    
    -- LANDING PAGE
    landing_url TEXT,
    
    -- FRAUD DETECTION
    is_bot BOOLEAN DEFAULT FALSE,
    fraud_score DECIMAL(3,2),
    time_from_impression INTEGER,
    
    -- GEO LOCATION
    country TEXT,
    region TEXT,
    city TEXT,
    
    slot_id VARCHAR(100),
    user_fingerprint VARCHAR(50),
    
    -- SYNC STATUS (Not needed in TimescaleDB but keeping for compatibility)
    synced_to_timescale BOOLEAN DEFAULT TRUE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (timestamp, id)
);

-- Convert to hypertable
SELECT create_hypertable('click_events', 'timestamp');

-- 5. CREATE INDEXES FOR PERFORMANCE
-- ==========================================

-- Impressions indexes for common query patterns
CREATE INDEX idx_impressions_creative_time ON impression_events (creative_id, timestamp DESC);
CREATE INDEX idx_impressions_campaign_time ON impression_events (campaign_id, timestamp DESC);
CREATE INDEX idx_impressions_inventory_time ON impression_events (inventory_id, timestamp DESC);
CREATE INDEX idx_impressions_publisher_time ON impression_events (publisher_id, timestamp DESC);
CREATE INDEX idx_impressions_advertiser_time ON impression_events (advertiser_id, timestamp DESC);
CREATE INDEX idx_impressions_country_time ON impression_events (country, timestamp DESC);
CREATE INDEX idx_impressions_device_time ON impression_events (device_type, timestamp DESC);

-- Clicks indexes
CREATE INDEX idx_clicks_creative_time ON click_events (creative_id, timestamp DESC);
CREATE INDEX idx_clicks_campaign_time ON click_events (campaign_id, timestamp DESC);
CREATE INDEX idx_clicks_impression_id ON click_events (impression_id);
CREATE INDEX idx_clicks_publisher_time ON click_events (publisher_id, timestamp DESC);

-- 6. VERIFICATION QUERIES
-- ==========================================

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('impression_events', 'click_events');

-- Verify hypertables were created
SELECT * FROM timescaledb_information.hypertables;

-- Show sample data
SELECT 'impression_events' as table_name, COUNT(*) as record_count FROM impression_events
UNION ALL
SELECT 'click_events' as table_name, COUNT(*) as record_count FROM click_events;