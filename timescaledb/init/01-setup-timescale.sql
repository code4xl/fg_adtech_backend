-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create RTB impressions hypertable
CREATE TABLE rtb_impressions (
    timestamp TIMESTAMPTZ NOT NULL,
    impression_id UUID NOT NULL,
    creative_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    advertiser_id UUID NOT NULL,
    inventory_id UUID NOT NULL,
    publisher_id UUID NOT NULL,
    website_id UUID NOT NULL,
    
    -- Financial metrics
    price DECIMAL(10,4),
    publisher_revenue DECIMAL(10,4),
    
    -- User context
    user_id TEXT,
    session_id TEXT,
    
    -- Technical details
    user_agent TEXT,
    ip_address INET,
    device_type TEXT,
    browser_type TEXT,
    os_type TEXT,
    
    -- Geo context
    country TEXT,
    region TEXT,
    city TEXT,
    
    -- Viewability metrics
    viewable BOOLEAN,
    view_time INTEGER,
    viewable_pixels INTEGER,
    ad_size_pixels TEXT,
    
    -- Fraud detection
    is_bot BOOLEAN DEFAULT FALSE,
    fraud_score REAL,
    
    -- Attribution
    referrer_url TEXT,
    page_url TEXT,
    page_category TEXT,
    
    PRIMARY KEY (timestamp, impression_id)
);

-- Convert to hypertable (partition by time)
SELECT create_hypertable('rtb_impressions', 'timestamp', chunk_time_interval => INTERVAL '1 hour');

-- Create RTB clicks hypertable
CREATE TABLE rtb_clicks (
    timestamp TIMESTAMPTZ NOT NULL,
    click_id UUID NOT NULL,
    impression_id UUID,
    creative_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    advertiser_id UUID NOT NULL,
    inventory_id UUID NOT NULL,
    publisher_id UUID NOT NULL,
    
    -- Click details
    click_x INTEGER,
    click_y INTEGER,
    time_from_impression INTEGER,
    
    -- User context (duplicate for denormalization)
    user_id TEXT,
    session_id TEXT,
    user_agent TEXT,
    ip_address INET,
    device_type TEXT,
    
    -- Geo context
    country TEXT,
    region TEXT,
    city TEXT,
    
    -- Fraud detection
    is_bot BOOLEAN DEFAULT FALSE,
    fraud_score REAL,
    
    PRIMARY KEY (timestamp, click_id)
);

-- Convert to hypertable
SELECT create_hypertable('rtb_clicks', 'timestamp', chunk_time_interval => INTERVAL '1 hour');

-- Create RTB bid metrics hypertable
CREATE TABLE rtb_bid_metrics (
    timestamp TIMESTAMPTZ NOT NULL,
    bid_response_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    inventory_id UUID NOT NULL,
    
    -- Bid performance
    bid_price DECIMAL(10,4),
    final_price DECIMAL(10,4),
    won BOOLEAN,
    
    -- Response metrics
    response_time_ms INTEGER,
    auction_duration_ms INTEGER,
    total_bids INTEGER,
    valid_bids INTEGER,
    
    -- Targeting match scores
    targeting_score REAL,
    quality_score REAL,
    
    PRIMARY KEY (timestamp, bid_response_id)
);

-- Convert to hypertable
SELECT create_hypertable('rtb_bid_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 hour');

-- Create indexes for common query patterns
-- Impressions indexes
CREATE INDEX idx_impressions_creative_time ON rtb_impressions (creative_id, timestamp DESC);
CREATE INDEX idx_impressions_campaign_time ON rtb_impressions (campaign_id, timestamp DESC);
CREATE INDEX idx_impressions_inventory_time ON rtb_impressions (inventory_id, timestamp DESC);
CREATE INDEX idx_impressions_publisher_time ON rtb_impressions (publisher_id, timestamp DESC);
CREATE INDEX idx_impressions_country_time ON rtb_impressions (country, timestamp DESC);

-- Clicks indexes
CREATE INDEX idx_clicks_creative_time ON rtb_clicks (creative_id, timestamp DESC);
CREATE INDEX idx_clicks_campaign_time ON rtb_clicks (campaign_id, timestamp DESC);
CREATE INDEX idx_clicks_impression_id ON rtb_clicks (impression_id);

-- Bid metrics indexes
CREATE INDEX idx_bid_metrics_campaign_time ON rtb_bid_metrics (campaign_id, timestamp DESC);
CREATE INDEX idx_bid_metrics_inventory_time ON rtb_bid_metrics (inventory_id, timestamp DESC);
CREATE INDEX idx_bid_metrics_won_time ON rtb_bid_metrics (won, timestamp DESC);

-- Create continuous aggregates for real-time analytics
CREATE MATERIALIZED VIEW hourly_campaign_metrics
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS hour,
    campaign_id,
    COUNT(*) AS impressions,
    SUM(price) AS revenue,
    AVG(view_time) AS avg_view_time,
    COUNT(*) FILTER (WHERE viewable = true) AS viewable_impressions
FROM rtb_impressions
GROUP BY hour, campaign_id;

-- Add refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('hourly_campaign_metrics',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Create retention policy (keep data for 90 days in main table)
SELECT add_retention_policy('rtb_impressions', INTERVAL '90 days');
SELECT add_retention_policy('rtb_clicks', INTERVAL '90 days');
SELECT add_retention_policy('rtb_bid_metrics', INTERVAL '90 days');