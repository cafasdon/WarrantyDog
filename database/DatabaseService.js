import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MigrationManager, DatabaseCleanup } from './migrations.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WarrantyDog Database Service
 * Comprehensive SQLite-based session management and data persistence
 */
class DatabaseService {
    constructor(dbPath = './data/warrantydog.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.isInitialized = false;
        this.migrationManager = null;
        this.cleanup = null;
    }

    /**
     * Initialize database connection and schema
     */
    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Open database connection
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
            this.db.pragma('foreign_keys = ON'); // Enable foreign key constraints

            // Initialize schema
            await this.initializeSchema();

            // Initialize migration manager and cleanup utilities
            this.migrationManager = new MigrationManager(this);
            this.cleanup = new DatabaseCleanup(this);

            // Run any pending migrations
            await this.migrationManager.runMigrations();

            this.isInitialized = true;
            console.log(`Database initialized: ${this.dbPath}`);
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize database schema from SQL file
     */
    async initializeSchema() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema statements
        this.db.exec(schema);
        console.log('Database schema initialized');
    }

    /**
     * Health check for database connection
     */
    healthCheck() {
        try {
            if (!this.db) return { status: 'error', message: 'Database not initialized' };
            
            const result = this.db.prepare('SELECT 1 as test').get();
            return { 
                status: 'ok', 
                message: 'Database connection healthy',
                dbPath: this.dbPath,
                isInitialized: this.isInitialized
            };
        } catch (error) {
            return { 
                status: 'error', 
                message: `Database health check failed: ${error.message}` 
            };
        }
    }

    /**
     * Session Management Methods
     */

    /**
     * Create a new session
     */
    createSession(sessionData) {
        const stmt = this.db.prepare(`
            INSERT INTO sessions (id, file_name, total_devices, metadata)
            VALUES (?, ?, ?, ?)
        `);
        
        const metadata = JSON.stringify(sessionData.metadata || {});
        return stmt.run(
            sessionData.id,
            sessionData.fileName,
            sessionData.totalDevices || 0,
            metadata
        );
    }

    /**
     * Get session by ID
     */
    getSession(sessionId) {
        const stmt = this.db.prepare(`
            SELECT * FROM session_summary WHERE id = ?
        `);
        
        const session = stmt.get(sessionId);
        if (session && session.metadata) {
            try {
                session.metadata = JSON.parse(session.metadata);
            } catch (e) {
                session.metadata = {};
            }
        }
        return session;
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        const stmt = this.db.prepare(`
            SELECT * FROM session_summary 
            WHERE status IN ('active', 'processing')
            ORDER BY created_at DESC
        `);
        
        return stmt.all().map(session => {
            if (session.metadata) {
                try {
                    session.metadata = JSON.parse(session.metadata);
                } catch (e) {
                    session.metadata = {};
                }
            }
            return session;
        });
    }

    /**
     * Update session progress
     */
    updateSessionProgress(sessionId, progressData) {
        const stmt = this.db.prepare(`
            UPDATE sessions 
            SET processed_count = ?, successful_count = ?, failed_count = ?, 
                skipped_count = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        return stmt.run(
            progressData.processed || 0,
            progressData.successful || 0,
            progressData.failed || 0,
            progressData.skipped || 0,
            sessionId
        );
    }

    /**
     * Complete session
     */
    completeSession(sessionId, status = 'completed') {
        const stmt = this.db.prepare(`
            UPDATE sessions 
            SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        return stmt.run(status, sessionId);
    }

    /**
     * Device Management Methods
     */

    /**
     * Bulk insert devices for a session
     */
    insertDevices(sessionId, devices) {
        const stmt = this.db.prepare(`
            INSERT INTO devices (
                session_id, serial_number, vendor, model, device_name,
                processing_order, is_supported, api_configured
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = this.db.transaction((devices) => {
            devices.forEach((device, index) => {
                stmt.run(
                    sessionId,
                    device.serialNumber,
                    device.vendor,
                    device.model || null,
                    device.deviceName || null,
                    index,
                    device.isSupported ? 1 : 0,
                    device.apiConfigured ? 1 : 0
                );
            });
        });

        return transaction(devices);
    }

    /**
     * Get devices for a session
     */
    getSessionDevices(sessionId) {
        const stmt = this.db.prepare(`
            SELECT * FROM devices 
            WHERE session_id = ? 
            ORDER BY processing_order
        `);
        
        return stmt.all(sessionId);
    }

    /**
     * Get failed devices that can be retried
     */
    getRetryableDevices(sessionId) {
        const stmt = this.db.prepare(`
            SELECT * FROM devices 
            WHERE session_id = ? 
            AND processing_state = 'failed' 
            AND (is_retryable = 1 OR is_retryable IS NULL)
            ORDER BY processing_order
        `);
        
        return stmt.all(sessionId);
    }

    /**
     * Update device processing state
     */
    updateDeviceState(deviceId, stateData) {
        const stmt = this.db.prepare(`
            UPDATE devices 
            SET processing_state = ?, warranty_status = ?, warranty_type = ?,
                warranty_end_date = ?, warranty_days_remaining = ?, ship_date = ?,
                error_message = ?, is_retryable = ?, retry_count = ?,
                updated_at = CURRENT_TIMESTAMP,
                last_processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        return stmt.run(
            stateData.processing_state || stateData.processingState,
            stateData.warranty_status || stateData.warrantyStatus || null,
            stateData.warranty_type || stateData.warrantyType || null,
            stateData.warranty_end_date || stateData.warrantyEndDate || null,
            stateData.warranty_days_remaining || stateData.warrantyDaysRemaining || null,
            stateData.ship_date || stateData.shipDate || null,
            stateData.error_message || stateData.errorMessage || null,
            stateData.is_retryable !== undefined ? (stateData.is_retryable ? 1 : 0) :
                stateData.isRetryable !== undefined ? (stateData.isRetryable ? 1 : 0) : null,
            stateData.retry_count || stateData.retryCount || 0,
            deviceId
        );
    }

    /**
     * Find device by serial number in a session
     */
    findDeviceBySerial(sessionId, serialNumber) {
        const stmt = this.db.prepare(`
            SELECT * FROM devices
            WHERE session_id = ? AND serial_number = ?
        `);

        return stmt.get(sessionId, serialNumber);
    }

    /**
     * Check if device already processed successfully
     */
    isDeviceProcessed(serialNumber, vendor) {
        const stmt = this.db.prepare(`
            SELECT id, session_id, processing_state, warranty_status, last_processed_at
            FROM devices
            WHERE serial_number = ? AND vendor = ? AND processing_state = 'success'
            ORDER BY last_processed_at DESC
            LIMIT 1
        `);

        return stmt.get(serialNumber, vendor);
    }

    /**
     * Get existing warranty data from API responses cache
     */
    getWarrantyData(serviceTag, vendor) {
        const stmt = this.db.prepare(`
            SELECT parsed_data, response_timestamp, parsing_status
            FROM api_responses
            WHERE service_tag = ? AND vendor = ?
            AND parsing_status = 'success'
            AND parsed_data IS NOT NULL
            ORDER BY response_timestamp DESC
            LIMIT 1
        `);

        const result = stmt.get(serviceTag, vendor);
        if (result && result.parsed_data) {
            try {
                return JSON.parse(result.parsed_data);
            } catch (error) {
                console.error('Failed to parse cached warranty data:', error);
                return null;
            }
        }
        return null;
    }

    /**
     * Get warranty data for multiple devices in bulk - checks both api_responses and devices tables
     */
    getBulkWarrantyData(devices) {
        if (!devices || devices.length === 0) {
            return [];
        }

        // Create placeholders for the IN clause
        const placeholders = devices.map(() => '(?, ?)').join(', ');

        // Flatten the device array for the query parameters
        const params = devices.flatMap(device => [device.serviceTag, device.vendor]);

        const deviceMap = new Map();

        // First, check the devices table for previously processed devices
        const devicesStmt = this.db.prepare(`
            SELECT
                serial_number as service_tag,
                vendor,
                warranty_status,
                warranty_type,
                warranty_end_date,
                warranty_days_remaining,
                ship_date,
                last_processed_at,
                model
            FROM devices
            WHERE (serial_number, LOWER(vendor)) IN (VALUES ${devices.map(() => '(?, LOWER(?))').join(', ')})
            AND processing_state = 'success'
            AND warranty_status IS NOT NULL
            ORDER BY last_processed_at DESC
        `);

        const deviceResults = devicesStmt.all(...params);
        console.log(`📊 Found ${deviceResults.length} devices in devices table`);

        // Process devices table results
        deviceResults.forEach(row => {
            const key = `${row.vendor}_${row.service_tag}`;

            if (!deviceMap.has(key)) {
                const warrantyData = {
                    service_tag: row.service_tag,
                    vendor: row.vendor,
                    warranty_status: row.warranty_status,
                    warranty_type: row.warranty_type,
                    warranty_start_date: null, // Not stored in devices table
                    warranty_end_date: row.warranty_end_date,
                    ship_date: row.ship_date,
                    warranty_days_remaining: row.warranty_days_remaining,
                    is_active: row.warranty_status === 'active',
                    message: 'Retrieved from devices table',
                    model: row.model,
                    response_timestamp: row.last_processed_at
                };

                deviceMap.set(key, warrantyData);
            }
        });

        // Then, check the api_responses table for additional data
        const apiStmt = this.db.prepare(`
            SELECT
                service_tag,
                vendor,
                parsed_data,
                response_timestamp,
                parsing_status
            FROM api_responses
            WHERE (service_tag, LOWER(vendor)) IN (VALUES ${devices.map(() => '(?, LOWER(?))').join(', ')})
            AND parsing_status = 'success'
            AND parsed_data IS NOT NULL
            ORDER BY response_timestamp DESC
        `);

        const apiResults = apiStmt.all(...params);
        console.log(`📊 Found ${apiResults.length} devices in api_responses table`);

        // Process api_responses table results (only if not already found in devices table)
        apiResults.forEach(row => {
            const key = `${row.vendor}_${row.service_tag}`;

            if (!deviceMap.has(key)) {
                try {
                    const parsedData = JSON.parse(row.parsed_data);

                    // Add database fields for compatibility
                    const warrantyData = {
                        service_tag: row.service_tag,
                        vendor: row.vendor,
                        warranty_status: parsedData.status,
                        warranty_type: parsedData.warrantyType,
                        warranty_start_date: parsedData.startDate,
                        warranty_end_date: parsedData.endDate,
                        ship_date: parsedData.shipDate,
                        warranty_days_remaining: parsedData.daysRemaining,
                        is_active: parsedData.isActive,
                        message: parsedData.message || 'Retrieved from api_responses table',
                        model: parsedData.model,
                        response_timestamp: row.response_timestamp
                    };

                    deviceMap.set(key, warrantyData);
                } catch (error) {
                    console.error(`Failed to parse warranty data for ${row.service_tag}:`, error);
                }
            }
        });

        console.log(`📊 Total unique devices found in cache: ${deviceMap.size}`);
        return Array.from(deviceMap.values());
    }

    /**
     * Store warranty data in API responses cache
     */
    storeWarrantyData(warrantyData) {
        // First, store or update the API response
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO api_responses (
                vendor, service_tag, request_url, request_method,
                response_status, response_body, response_timestamp,
                parsing_status, parsed_data, last_parsed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const parsedData = {
            vendor: warrantyData.vendor,
            serviceTag: warrantyData.serviceTag,
            status: warrantyData.warranty_status,
            warrantyType: warrantyData.warranty_type,
            startDate: warrantyData.warranty_start_date,
            endDate: warrantyData.warranty_end_date,
            shipDate: warrantyData.ship_date,
            daysRemaining: warrantyData.warranty_days_remaining,
            isActive: warrantyData.is_active,
            message: warrantyData.message,
            model: warrantyData.model
        };

        return stmt.run(
            warrantyData.vendor,
            warrantyData.serviceTag,
            'warranty_lookup', // request_url placeholder
            'GET', // request_method
            200, // response_status (assuming success)
            warrantyData.raw_api_response || JSON.stringify(parsedData), // response_body
            warrantyData.last_updated, // response_timestamp
            'success', // parsing_status
            JSON.stringify(parsedData), // parsed_data
            warrantyData.last_updated // last_parsed_at
        );
    }

    /**
     * Get existing warranty data for a device (if available) - DEPRECATED
     */
    getExistingWarrantyData(serialNumber, vendor, maxAgeHours = 24) {
        const stmt = this.db.prepare(`
            SELECT
                warranty_status, warranty_type, warranty_end_date,
                warranty_days_remaining, ship_date, last_processed_at,
                session_id, processing_state
            FROM devices
            WHERE serial_number = ? AND vendor = ?
            AND processing_state = 'success'
            AND last_processed_at > datetime('now', '-' || ? || ' hours')
            ORDER BY last_processed_at DESC
            LIMIT 1
        `);

        return stmt.get(serialNumber, vendor, maxAgeHours);
    }

    /**
     * Check for duplicate devices across all sessions
     */
    findDuplicateDevices(devices, maxAgeHours = 24) {
        const duplicates = [];
        const fresh = [];

        devices.forEach(device => {
            const existing = this.getExistingWarrantyData(
                device.serialNumber,
                device.vendor,
                maxAgeHours
            );

            if (existing) {
                duplicates.push({
                    device,
                    existingData: existing,
                    ageHours: Math.round((Date.now() - new Date(existing.last_processed_at).getTime()) / (1000 * 60 * 60))
                });
            } else {
                fresh.push(device);
            }
        });

        return { duplicates, fresh };
    }

    /**
     * Bulk insert devices with duplicate detection and handling
     */
    insertDevicesWithDuplicateHandling(sessionId, devices, options = {}) {
        const {
            skipDuplicates = true,
            maxAgeHours = 24,
            updateExisting = false
        } = options;

        // Find duplicates
        const { duplicates, fresh } = this.findDuplicateDevices(devices, maxAgeHours);

        console.log(`Found ${duplicates.length} duplicates and ${fresh.length} fresh devices`);

        // Handle fresh devices
        if (fresh.length > 0) {
            try {
                this.insertDevices(sessionId, fresh);
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    console.log('Some devices already exist in this session, skipping duplicates...');
                    // Try inserting one by one to handle partial duplicates
                    fresh.forEach((device, index) => {
                        try {
                            this.insertDevices(sessionId, [device]);
                        } catch (innerError) {
                            if (innerError.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
                                throw innerError; // Re-throw non-duplicate errors
                            }
                            console.log(`Device ${device.serialNumber} already exists in session, skipping...`);
                        }
                    });
                } else {
                    throw error; // Re-throw non-duplicate errors
                }
            }
        }

        // Handle duplicates based on options
        const handledDuplicates = [];

        duplicates.forEach(({ device, existingData, ageHours }) => {
            if (skipDuplicates) {
                // Create a device record that references existing data
                const stmt = this.db.prepare(`
                    INSERT INTO devices (
                        session_id, serial_number, vendor, model, device_name,
                        processing_order, processing_state, warranty_status, warranty_type,
                        warranty_end_date, warranty_days_remaining, ship_date,
                        is_supported, api_configured, created_at, updated_at,
                        last_processed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'duplicate_skipped', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
                `);

                const index = devices.indexOf(device);
                stmt.run(
                    sessionId,
                    device.serialNumber,
                    device.vendor,
                    device.model || null,
                    device.deviceName || null,
                    index,
                    existingData.warranty_status,
                    existingData.warranty_type,
                    existingData.warranty_end_date,
                    existingData.warranty_days_remaining,
                    existingData.ship_date,
                    device.isSupported ? 1 : 0,
                    device.apiConfigured ? 1 : 0,
                    existingData.last_processed_at
                );

                handledDuplicates.push({
                    device,
                    action: 'skipped',
                    reason: `Already processed ${ageHours} hours ago`,
                    existingData
                });
            } else if (updateExisting) {
                // Insert as fresh device for reprocessing
                fresh.push(device);
                handledDuplicates.push({
                    device,
                    action: 'reprocess',
                    reason: `Forced reprocessing (age: ${ageHours} hours)`
                });
            }
        });

        return {
            inserted: fresh.length,
            duplicates: duplicates.length,
            handledDuplicates,
            summary: {
                total: devices.length,
                fresh: fresh.length,
                duplicates: duplicates.length,
                skipped: handledDuplicates.filter(h => h.action === 'skipped').length,
                reprocessed: handledDuplicates.filter(h => h.action === 'reprocess').length
            }
        };
    }

    /**
     * Processing History Methods
     */

    /**
     * Record processing attempt
     */
    recordProcessingAttempt(deviceId, sessionId, attemptData) {
        const stmt = this.db.prepare(`
            INSERT INTO processing_history (
                device_id, session_id, attempt_number, processing_state,
                api_response_status, api_response_data, error_message, error_type,
                retry_reason, processing_duration_ms, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        return stmt.run(
            deviceId,
            sessionId,
            attemptData.attemptNumber || 1,
            attemptData.processingState,
            attemptData.apiResponseStatus || null,
            attemptData.apiResponseData ? JSON.stringify(attemptData.apiResponseData) : null,
            attemptData.errorMessage || null,
            attemptData.errorType || null,
            attemptData.retryReason || null,
            attemptData.processingDurationMs || null
        );
    }

    /**
     * Cleanup and Maintenance Methods
     */

    /**
     * Clean up old sessions (older than specified days)
     */
    cleanupOldSessions(daysOld = 30) {
        const stmt = this.db.prepare(`
            DELETE FROM sessions 
            WHERE created_at < datetime('now', '-' || ? || ' days')
            AND status IN ('completed', 'cancelled')
        `);
        
        return stmt.run(daysOld);
    }

    /**
     * Get database statistics
     */
    getStatistics() {
        const stats = {};
        
        // Session counts
        const sessionStats = this.db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM sessions 
            GROUP BY status
        `).all();
        
        stats.sessions = sessionStats.reduce((acc, row) => {
            acc[row.status] = row.count;
            return acc;
        }, {});
        
        // Device counts
        const deviceStats = this.db.prepare(`
            SELECT processing_state, COUNT(*) as count 
            FROM devices 
            GROUP BY processing_state
        `).all();
        
        stats.devices = deviceStats.reduce((acc, row) => {
            acc[row.processing_state] = row.count;
            return acc;
        }, {});
        
        // Total processing attempts
        stats.totalAttempts = this.db.prepare(`
            SELECT COUNT(*) as count FROM processing_history
        `).get().count;
        
        return stats;
    }

    /**
     * Migration and Compatibility Methods
     */

    /**
     * Migrate localStorage session data to database
     */
    migrateLocalStorageSession(localStorageData) {
        try {
            const sessionData = {
                id: localStorageData.sessionId,
                fileName: localStorageData.csvFileName || 'Migrated Session',
                totalDevices: localStorageData.devices ? localStorageData.devices.length : 0,
                metadata: {
                    migrated: true,
                    originalTimestamp: localStorageData.lastSaved
                }
            };

            // Create session
            this.createSession(sessionData);

            // Insert devices if available
            if (localStorageData.devices && localStorageData.devices.length > 0) {
                this.insertDevices(sessionData.id, localStorageData.devices);

                // Update session progress
                this.updateSessionProgress(sessionData.id, {
                    processed: localStorageData.processedCount || 0,
                    successful: localStorageData.successful || 0,
                    failed: localStorageData.failed || 0,
                    skipped: localStorageData.skipped || 0
                });
            }

            console.log(`Migrated localStorage session: ${sessionData.id}`);
            return sessionData.id;
        } catch (error) {
            console.error('Failed to migrate localStorage session:', error);
            throw error;
        }
    }

    /**
     * Get device by serial number and vendor (for duplicate checking)
     */
    getDeviceBySerial(serialNumber, vendor, sessionId = null) {
        let stmt;
        if (sessionId) {
            stmt = this.db.prepare(`
                SELECT * FROM devices
                WHERE serial_number = ? AND vendor = ? AND session_id = ?
                LIMIT 1
            `);
            return stmt.get(serialNumber, vendor, sessionId);
        } else {
            stmt = this.db.prepare(`
                SELECT * FROM devices
                WHERE serial_number = ? AND vendor = ?
                ORDER BY last_processed_at DESC
                LIMIT 1
            `);
            return stmt.get(serialNumber, vendor);
        }
    }

    /**
     * Update device with first processing timestamp
     */
    markDeviceProcessingStarted(deviceId) {
        const stmt = this.db.prepare(`
            UPDATE devices
            SET processing_state = 'processing',
                first_processed_at = CASE
                    WHEN first_processed_at IS NULL THEN CURRENT_TIMESTAMP
                    ELSE first_processed_at
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        return stmt.run(deviceId);
    }

    /**
     * Get session resume data (compatible with existing frontend)
     */
    getSessionResumeData(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        const devices = this.getSessionDevices(sessionId);

        return {
            sessionId: session.id,
            csvFileName: session.file_name,
            devices: devices.map(device => ({
                serialNumber: device.serial_number,
                vendor: device.vendor,
                model: device.model,
                deviceName: device.device_name,
                isSupported: Boolean(device.is_supported),
                apiConfigured: Boolean(device.api_configured),
                processingState: device.processing_state,
                warrantyStatus: device.warranty_status,
                warrantyType: device.warranty_type,
                warrantyExpiry: device.warranty_end_date,
                shipDate: device.ship_date,
                errorMessage: device.error_message,
                isRetryable: device.is_retryable !== null ? Boolean(device.is_retryable) : null,
                lastProcessed: device.last_processed_at
            })),
            processedCount: session.processed_count,
            successful: session.successful_count,
            failed: session.failed_count,
            skipped: session.skipped_count,
            lastSaved: session.updated_at
        };
    }

    /**
     * Transaction wrapper for atomic operations
     */
    transaction(callback) {
        const transaction = this.db.transaction(callback);
        return transaction;
    }

    /**
     * Database Maintenance Methods
     */

    /**
     * Perform database cleanup
     */
    performCleanup(daysOld = 30) {
        if (!this.cleanup) {
            throw new Error('Cleanup utilities not initialized');
        }
        return this.cleanup.performFullCleanup(daysOld);
    }

    /**
     * Get cleanup recommendations
     */
    getCleanupRecommendations() {
        if (!this.cleanup) {
            throw new Error('Cleanup utilities not initialized');
        }
        return this.cleanup.getCleanupRecommendations();
    }

    /**
     * Run database migrations
     */
    async runMigrations() {
        if (!this.migrationManager) {
            throw new Error('Migration manager not initialized');
        }
        return await this.migrationManager.runMigrations();
    }

    // ==================== API RESPONSE CACHING METHODS ====================

    /**
     * Store raw API response for caching and reprocessing
     */
    storeApiResponse(vendor, serviceTag, requestData, responseData) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO api_responses (
                vendor, service_tag, request_url, request_method, request_headers, request_body,
                response_status, response_headers, response_body, response_timestamp,
                parsing_status, is_valid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `);

        const isValid = responseData.status >= 200 && responseData.status < 300;

        return stmt.run(
            vendor.toLowerCase(),
            serviceTag.toUpperCase(),
            requestData.url || '',
            requestData.method || 'GET',
            JSON.stringify(requestData.headers || {}),
            requestData.body ? JSON.stringify(requestData.body) : null,
            responseData.status,
            JSON.stringify(responseData.headers || {}),
            JSON.stringify(responseData.body),
            new Date().toISOString(),
            isValid ? 1 : 0
        );
    }

    /**
     * Get cached API response
     */
    getCachedApiResponse(vendor, serviceTag, maxAgeHours = 24) {
        const stmt = this.db.prepare(`
            SELECT * FROM api_responses
            WHERE vendor = ? AND service_tag = ? AND is_valid = 1
            AND datetime(response_timestamp) > datetime('now', '-' || ? || ' hours')
            ORDER BY response_timestamp DESC
            LIMIT 1
        `);

        return stmt.get(vendor.toLowerCase(), serviceTag.toUpperCase(), maxAgeHours);
    }

    /**
     * Update parsing status and results for an API response
     */
    updateApiResponseParsing(responseId, status, parsedData = null, error = null) {
        const stmt = this.db.prepare(`
            UPDATE api_responses
            SET parsing_status = ?, parsed_data = ?, parsing_error = ?,
                parsing_attempts = parsing_attempts + 1, last_parsed_at = ?,
                updated_at = ?
            WHERE id = ?
        `);

        return stmt.run(
            status,
            parsedData ? JSON.stringify(parsedData) : null,
            error,
            new Date().toISOString(),
            new Date().toISOString(),
            responseId
        );
    }

    /**
     * Get all failed parsing responses for reprocessing
     */
    getFailedParsingResponses(vendor = null, limit = 100) {
        let query = `
            SELECT * FROM api_responses
            WHERE parsing_status = 'failed' AND is_valid = 1
        `;
        const params = [];

        if (vendor) {
            query += ` AND vendor = ?`;
            params.push(vendor.toLowerCase());
        }

        query += ` ORDER BY response_timestamp DESC LIMIT ?`;
        params.push(limit);

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Get API response statistics
     */
    getApiResponseStats(vendor = null, hours = 24) {
        let query = `
            SELECT
                vendor,
                COUNT(*) as total_responses,
                COUNT(CASE WHEN parsing_status = 'success' THEN 1 END) as successful_parsing,
                COUNT(CASE WHEN parsing_status = 'failed' THEN 1 END) as failed_parsing,
                COUNT(CASE WHEN parsing_status = 'pending' THEN 1 END) as pending_parsing,
                AVG(response_status) as avg_response_status,
                MIN(response_timestamp) as earliest_response,
                MAX(response_timestamp) as latest_response
            FROM api_responses
            WHERE datetime(response_timestamp) > datetime('now', '-' || ? || ' hours')
        `;
        const params = [hours];

        if (vendor) {
            query += ` AND vendor = ?`;
            params.push(vendor.toLowerCase());
        }

        query += ` GROUP BY vendor`;

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Clean old API responses
     */
    cleanOldApiResponses(retentionDays = 30) {
        const stmt = this.db.prepare(`
            DELETE FROM api_responses
            WHERE datetime(response_timestamp) < datetime('now', '-' || ? || ' days')
        `);

        return stmt.run(retentionDays);
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log('Database connection closed');
        }
    }
}

export default DatabaseService;
