-- WarrantyDog SQLite Database Schema
-- Comprehensive schema for persistent session management and data integrity

-- Sessions table: Stores session metadata and progress tracking
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    total_devices INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    successful_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, cancelled, error
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    metadata TEXT NULL -- JSON string for additional session data
);

-- Devices table: Stores individual device records and processing state
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    vendor TEXT NOT NULL,
    model TEXT NULL,
    device_name TEXT NULL,
    processing_state TEXT NOT NULL DEFAULT 'pending', -- pending, processing, success, failed, skipped
    processing_order INTEGER NOT NULL, -- Order in which device should be processed
    
    -- Warranty information
    warranty_status TEXT NULL,
    warranty_type TEXT NULL,
    warranty_end_date TEXT NULL,
    warranty_days_remaining INTEGER NULL,
    ship_date TEXT NULL,
    
    -- Processing metadata
    is_supported BOOLEAN NOT NULL DEFAULT 1,
    api_configured BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    is_retryable BOOLEAN NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    first_processed_at DATETIME NULL,
    last_processed_at DATETIME NULL,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Processing history table: Audit trail for all processing attempts
CREATE TABLE IF NOT EXISTS processing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    processing_state TEXT NOT NULL, -- processing, success, failed, skipped
    
    -- API response data
    api_response_status INTEGER NULL,
    api_response_data TEXT NULL, -- JSON string of API response
    error_message TEXT NULL,
    error_type TEXT NULL, -- rate_limit, network, api_error, etc.
    
    -- Processing context
    retry_reason TEXT NULL,
    processing_duration_ms INTEGER NULL,
    
    -- Timestamps
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- API responses cache table: Stores raw API responses for reprocessing and debugging
CREATE TABLE IF NOT EXISTS api_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor TEXT NOT NULL,
    service_tag TEXT NOT NULL,
    request_url TEXT NOT NULL,
    request_method TEXT NOT NULL DEFAULT 'GET',
    request_headers TEXT NULL, -- JSON string of request headers
    request_body TEXT NULL, -- JSON string of request body if applicable

    -- Response data
    response_status INTEGER NOT NULL,
    response_headers TEXT NULL, -- JSON string of response headers
    response_body TEXT NOT NULL, -- Raw response body (JSON string)
    response_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Processing metadata
    parsing_status TEXT DEFAULT 'pending', -- pending, success, failed, skipped
    parsing_error TEXT NULL,
    parsed_data TEXT NULL, -- JSON string of successfully parsed warranty data
    parsing_attempts INTEGER DEFAULT 0,
    last_parsed_at DATETIME NULL,

    -- Cache metadata
    cache_key TEXT GENERATED ALWAYS AS (vendor || '_' || service_tag) STORED,
    is_valid BOOLEAN DEFAULT 1, -- Mark as invalid if response indicates error
    expires_at DATETIME NULL, -- Optional expiration for cache invalidation

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_devices_session_id ON devices(session_id);
CREATE INDEX IF NOT EXISTS idx_devices_serial_vendor ON devices(serial_number, vendor);
CREATE INDEX IF NOT EXISTS idx_devices_processing_state ON devices(processing_state);
CREATE INDEX IF NOT EXISTS idx_devices_processing_order ON devices(session_id, processing_order);

CREATE INDEX IF NOT EXISTS idx_processing_history_device_id ON processing_history(device_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_session_id ON processing_history(session_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_started_at ON processing_history(started_at);

CREATE INDEX IF NOT EXISTS idx_api_responses_vendor_tag ON api_responses(vendor, service_tag);
CREATE INDEX IF NOT EXISTS idx_api_responses_cache_key ON api_responses(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_responses_parsing_status ON api_responses(parsing_status);
CREATE INDEX IF NOT EXISTS idx_api_responses_timestamp ON api_responses(response_timestamp);
CREATE INDEX IF NOT EXISTS idx_api_responses_valid ON api_responses(is_valid, expires_at);

-- Unique constraints to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_unique_session_serial
ON devices(session_id, serial_number, vendor);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_responses_unique_cache
ON api_responses(vendor, service_tag, response_timestamp);

-- Views for common queries
CREATE VIEW IF NOT EXISTS session_summary AS
SELECT 
    s.id,
    s.file_name,
    s.status,
    s.total_devices,
    s.processed_count,
    s.successful_count,
    s.failed_count,
    s.skipped_count,
    s.created_at,
    s.updated_at,
    s.completed_at,
    CASE 
        WHEN s.total_devices > 0 THEN 
            ROUND((s.processed_count * 100.0) / s.total_devices, 2)
        ELSE 0 
    END as progress_percentage,
    COUNT(CASE WHEN d.processing_state = 'failed' AND d.is_retryable = 1 THEN 1 END) as retryable_failures
FROM sessions s
LEFT JOIN devices d ON s.id = d.session_id
GROUP BY s.id, s.file_name, s.status, s.total_devices, s.processed_count, 
         s.successful_count, s.failed_count, s.skipped_count, s.created_at, 
         s.updated_at, s.completed_at;

CREATE VIEW IF NOT EXISTS device_summary AS
SELECT 
    d.*,
    s.file_name as session_file_name,
    s.status as session_status,
    COUNT(ph.id) as total_attempts,
    MAX(ph.started_at) as last_attempt_at
FROM devices d
JOIN sessions s ON d.session_id = s.id
LEFT JOIN processing_history ph ON d.id = ph.device_id
GROUP BY d.id;
