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
            stateData.processingState,
            stateData.warrantyStatus || null,
            stateData.warrantyType || null,
            stateData.warrantyEndDate || null,
            stateData.warrantyDaysRemaining || null,
            stateData.shipDate || null,
            stateData.errorMessage || null,
            stateData.isRetryable !== undefined ? (stateData.isRetryable ? 1 : 0) : null,
            stateData.retryCount || 0,
            deviceId
        );
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
