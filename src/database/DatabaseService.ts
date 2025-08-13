import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MigrationManager, DatabaseCleanup } from './migrations.js';
import type {
  Session,
  Device,
  ApiResponse,
  SessionStats,
  DatabaseHealth,
  DuplicateHandlingResult,
  DuplicateHandlingOptions,
  DeviceQueryResult,
  SessionQueryResult,
  VendorWarrantyResponse
} from '../types/database.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SessionData {
  id: string;
  fileName: string;
  totalDevices?: number;
  metadata?: Record<string, any>;
}

interface DeviceData {
  serialNumber: string;
  vendor: string;
  model?: string;
  deviceName?: string;
  isSupported?: boolean;
  apiConfigured?: boolean;
  originalData?: Record<string, any>;
}

interface ProgressData {
  processed?: number;
  successful?: number;
  failed?: number;
  skipped?: number;
}

interface StateData {
  processing_state?: string;
  vendor?: string;
  model?: string;
  warranty_status?: string;
  warranty_type?: string;
  warranty_end_date?: string;
  warranty_days_remaining?: number;
  ship_date?: string;
  error_message?: string;
  is_retryable?: boolean;
  retry_count?: number;
}

interface AttemptData {
  attemptNumber?: number;
  processingState: string;
  apiResponseStatus?: string;
  apiResponseData?: Record<string, any>;
  errorMessage?: string;
  errorType?: string;
  retryReason?: string;
  processingDurationMs?: number;
}

interface RequestData {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface ResponseData {
  status: number;
  headers?: Record<string, string>;
  body: string;
  isValid?: boolean;
}

/**
 * WarrantyDog Database Service
 * Comprehensive SQLite-based session management and data persistence
 */
class DatabaseService {
  private dbPath: string;
  private db: Database.Database | null = null;
  private isInitialized: boolean = false;
  private migrationManager: MigrationManager | null = null;
  private cleanup: DatabaseCleanup | null = null;

  constructor(dbPath: string = './data/warrantydog.db') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
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
  private async initializeSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema statements
    this.db!.exec(schema);
    console.log('Database schema initialized');
  }

  /**
   * Health check for database connection
   */
  healthCheck(): DatabaseHealth {
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
        message: `Database health check failed: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Session Management Methods
   */

  /**
   * Create a new session
   */
  createSession(sessionData: SessionData): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    
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
  getSession(sessionId: string): SessionQueryResult | undefined {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM session_summary WHERE id = ?
    `);
    
    const session = stmt.get(sessionId) as SessionQueryResult | undefined;
    if (session && (session as any).metadata) {
      try {
        (session as any).metadata = JSON.parse((session as any).metadata);
      } catch (e) {
        (session as any).metadata = {};
      }
    }
    return session;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionQueryResult[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM session_summary ORDER BY created_at DESC
    `);
    
    const sessions = stmt.all() as SessionQueryResult[];
    return sessions.map(session => {
      if ((session as any).metadata) {
        try {
          (session as any).metadata = JSON.parse((session as any).metadata);
        } catch (e) {
          (session as any).metadata = {};
        }
      }
      return session;
    });
  }

  /**
   * Update session progress
   */
  updateSessionProgress(sessionId: string, progressData: ProgressData): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    
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
  completeSession(sessionId: string, status: string = 'completed'): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    
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
  insertDevices(sessionId: string, devices: DeviceData[]): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO devices (
        session_id, serial_number, vendor, model, device_name,
        processing_order, is_supported, api_configured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((devices: DeviceData[]) => {
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
  getSessionDevices(sessionId: string): DeviceQueryResult[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM devices 
      WHERE session_id = ? 
      ORDER BY processing_order ASC
    `);
    
    return stmt.all(sessionId) as DeviceQueryResult[];
  }

  /**
   * Update device processing state
   */
  updateDeviceState(deviceId: number, stateData: StateData): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      UPDATE devices
      SET processing_state = ?, vendor = ?, model = ?, warranty_status = ?, warranty_type = ?,
          warranty_end_date = ?, warranty_days_remaining = ?, ship_date = ?,
          error_message = ?, is_retryable = ?, retry_count = ?,
          updated_at = CURRENT_TIMESTAMP,
          last_processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(
      stateData.processing_state || null,
      stateData.vendor || null,
      stateData.model || null,
      stateData.warranty_status || null,
      stateData.warranty_type || null,
      stateData.warranty_end_date || null,
      stateData.warranty_days_remaining || null,
      stateData.ship_date || null,
      stateData.error_message || null,
      stateData.is_retryable ? 1 : 0,
      stateData.retry_count || 0,
      deviceId
    );
  }

  /**
   * Find device by serial number in a session
   */
  findDeviceBySerial(sessionId: string, serialNumber: string): DeviceQueryResult | undefined {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM devices
      WHERE session_id = ? AND serial_number = ?
    `);

    return stmt.get(sessionId, serialNumber) as DeviceQueryResult | undefined;
  }

  /**
   * Check if device already processed successfully
   */
  isDeviceProcessed(serialNumber: string, vendor: string): DeviceQueryResult | undefined {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT id, session_id, processing_state, warranty_status, last_processed_at
      FROM devices
      WHERE serial_number = ? AND vendor = ? AND processing_state = 'success'
      ORDER BY last_processed_at DESC
      LIMIT 1
    `);

    return stmt.get(serialNumber, vendor) as DeviceQueryResult | undefined;
  }

  /**
   * Get existing warranty data for a device
   */
  getExistingWarrantyData(serialNumber: string, vendor: string, maxAgeHours: number = 24): DeviceQueryResult | undefined {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM devices
      WHERE serial_number = ? AND vendor = ? AND processing_state = 'success'
      AND datetime(last_processed_at) > datetime('now', '-' || ? || ' hours')
      ORDER BY last_processed_at DESC
      LIMIT 1
    `);

    return stmt.get(serialNumber, vendor, maxAgeHours) as DeviceQueryResult | undefined;
  }

  /**
   * Get cached devices for reuse
   */
  getCachedDevices(sessionId: string): DeviceQueryResult[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT DISTINCT
        d.serial_number,
        d.vendor,
        d.model,
        d.warranty_status,
        d.warranty_type,
        d.warranty_end_date,
        d.warranty_days_remaining,
        d.ship_date,
        d.last_processed_at,
        d.processing_state
      FROM devices d
      WHERE d.processing_state = 'success'
      AND d.serial_number IN (
        SELECT DISTINCT serial_number
        FROM devices
        WHERE session_id = ?
      )
      ORDER BY d.last_processed_at DESC
    `);

    const devices = stmt.all(sessionId) as DeviceQueryResult[];

    // Create a map to store the most recent successful processing for each device
    const deviceMap = new Map<string, DeviceQueryResult>();

    devices.forEach(device => {
      const key = `${device.serial_number}-${device.vendor}`;
      if (!deviceMap.has(key)) {
        deviceMap.set(key, device);
      }
    });

    console.log(`📊 Total unique devices found in cache: ${deviceMap.size}`);
    return Array.from(deviceMap.values());
  }

  /**
   * Store warranty data in API responses cache
   */
  storeWarrantyData(warrantyData: VendorWarrantyResponse & { vendor: string }): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

    // First, store or update the API response
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO api_responses (
        vendor, service_tag, request_url, request_method,
        response_status, response_body, response_timestamp,
        parsing_status, parsed_data, last_parsed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const serialNumber = 'serviceTag' in warrantyData ? warrantyData.serviceTag : warrantyData.serialNumber;

    return stmt.run(
      warrantyData.vendor.toLowerCase(),
      serialNumber.toUpperCase(),
      null, // request_url - not available in this context
      'GET', // request_method
      200, // response_status - assuming success
      JSON.stringify(warrantyData), // response_body
      new Date().toISOString(), // response_timestamp
      'success', // parsing_status
      JSON.stringify(warrantyData), // parsed_data
      new Date().toISOString() // last_parsed_at
    );
  }

  /**
   * Check for duplicate devices across all sessions
   */
  findDuplicateDevices(devices: DeviceData[], maxAgeHours: number = 24): { duplicates: any[], fresh: DeviceData[] } {
    const duplicates: any[] = [];
    const fresh: DeviceData[] = [];

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
          ageHours: Math.round((Date.now() - new Date(existing.last_processed_at!).getTime()) / (1000 * 60 * 60))
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
  insertDevicesWithDuplicateHandling(sessionId: string, devices: DeviceData[], options: DuplicateHandlingOptions = { strategy: 'skip' }): DuplicateHandlingResult {
    const {
      strategy = 'skip'
    } = options;

    const skipDuplicates = strategy === 'skip';
    const maxAgeHours = 24;
    const updateExisting = strategy === 'update';

    console.log(`🔍 Checking ${devices.length} devices for duplicates (strategy: ${strategy})`);

    const { duplicates, fresh } = this.findDuplicateDevices(devices, maxAgeHours);

    console.log(`📊 Found ${duplicates.length} duplicates, ${fresh.length} fresh devices`);

    let newDevices = 0;
    let updatedDevices = 0;
    let skippedDevices = 0;

    // Handle fresh devices - always insert
    if (fresh.length > 0) {
      this.insertDevices(sessionId, fresh);
      newDevices = fresh.length;
      console.log(`✅ Inserted ${fresh.length} new devices`);
    }

    // Handle duplicates based on strategy
    if (duplicates.length > 0) {
      if (skipDuplicates) {
        skippedDevices = duplicates.length;
        console.log(`⏭️ Skipped ${duplicates.length} duplicate devices`);
      } else if (updateExisting) {
        // Insert duplicates as new entries in this session
        const duplicateDevices = duplicates.map(d => d.device);
        this.insertDevices(sessionId, duplicateDevices);
        updatedDevices = duplicates.length;
        console.log(`🔄 Added ${duplicates.length} duplicate devices to current session`);
      }
    }

    return {
      action: skipDuplicates ? 'skip' : (updateExisting ? 'update' : 'insert'),
      existingDevices: duplicates.length,
      newDevices,
      updatedDevices,
      skippedDevices,
      duplicateStrategy: strategy
    };
  }

  /**
   * Record processing attempt
   */
  recordProcessingAttempt(deviceId: number, sessionId: string, attemptData: AttemptData): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

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
  cleanupOldSessions(daysOld: number = 30): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

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
  getStatistics(): Record<string, any> {
    if (!this.db) throw new Error('Database not initialized');

    const stats: Record<string, any> = {};

    // Session counts
    const sessionStats = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM sessions
      GROUP BY status
    `).all() as { status: string; count: number }[];

    stats['sessions'] = sessionStats.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // Device counts
    const deviceStats = this.db.prepare(`
      SELECT processing_state, COUNT(*) as count
      FROM devices
      GROUP BY processing_state
    `).all() as { processing_state: string; count: number }[];

    stats['devices'] = deviceStats.reduce((acc, row) => {
      acc[row.processing_state] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // Total processing attempts
    const totalAttemptsResult = this.db.prepare(`
      SELECT COUNT(*) as count FROM processing_history
    `).get() as { count: number } | undefined;
    stats['totalAttempts'] = totalAttemptsResult?.count || 0;

    return stats;
  }

  /**
   * Store raw API response for caching and reprocessing
   */
  storeApiResponse(vendor: string, serviceTag: string, requestData: RequestData, responseData: ResponseData): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO api_responses (
        vendor, service_tag, request_url, request_method, request_headers, request_body,
        response_status, response_headers, response_body, response_timestamp,
        parsing_status, is_valid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);

    return stmt.run(
      vendor.toLowerCase(),
      serviceTag.toUpperCase(),
      requestData.url || null,
      requestData.method || 'GET',
      requestData.headers ? JSON.stringify(requestData.headers) : null,
      requestData.body || null,
      responseData.status,
      responseData.headers ? JSON.stringify(responseData.headers) : null,
      responseData.body,
      new Date().toISOString(),
      responseData.isValid ? 1 : 0
    );
  }

  /**
   * Get cached API response
   */
  getCachedApiResponse(vendor: string, serviceTag: string, maxAgeHours: number = 24): any {
    if (!this.db) throw new Error('Database not initialized');

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
   * Update API response parsing status
   */
  updateApiResponseParsing(vendor: string, serviceTag: string, parsingStatus: string, parsedData?: any, errorMessage?: string): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE api_responses
      SET parsing_status = ?, parsed_data = ?, error_message = ?, last_parsed_at = CURRENT_TIMESTAMP
      WHERE vendor = ? AND service_tag = ?
      ORDER BY response_timestamp DESC
      LIMIT 1
    `);

    return stmt.run(
      parsingStatus,
      parsedData ? JSON.stringify(parsedData) : null,
      errorMessage || null,
      vendor.toLowerCase(),
      serviceTag.toUpperCase()
    );
  }

  /**
   * Get API response statistics
   */
  getApiResponseStats(vendor?: string, hours: number = 24): any[] {
    if (!this.db) throw new Error('Database not initialized');

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
    const params: any[] = [hours];

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
  cleanOldApiResponses(retentionDays: number = 30): Database.RunResult {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM api_responses
      WHERE datetime(response_timestamp) < datetime('now', '-' || ? || ' days')
    `);

    return stmt.run(retentionDays);
  }

  /**
   * Get device by serial number and vendor (for duplicate checking)
   */
  getDeviceBySerial(serialNumber: string, vendor: string, sessionId?: string): DeviceQueryResult | undefined {
    if (!this.db) throw new Error('Database not initialized');

    let stmt: Database.Statement;
    if (sessionId) {
      stmt = this.db.prepare(`
        SELECT * FROM devices
        WHERE serial_number = ? AND vendor = ? AND session_id = ?
        LIMIT 1
      `);
      return stmt.get(serialNumber, vendor, sessionId) as DeviceQueryResult | undefined;
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM devices
        WHERE serial_number = ? AND vendor = ?
        ORDER BY last_processed_at DESC
        LIMIT 1
      `);
      return stmt.get(serialNumber, vendor) as DeviceQueryResult | undefined;
    }
  }

  /**
   * Get session summary with device counts
   */
  getSessionSummary(sessionId: string): any {
    if (!this.db) throw new Error('Database not initialized');

    const session = this.getSession(sessionId);
    if (!session) return null;

    return {
      sessionId: session.id,
      fileName: session.file_name,
      totalDevices: session.total_devices,
      processedCount: (session as any).processed_count,
      successful: (session as any).successful_count,
      failed: (session as any).failed_count,
      skipped: (session as any).skipped_count,
      lastSaved: session.updated_at
    };
  }

  /**
   * Transaction wrapper for atomic operations
   */
  transaction<T>(callback: () => T): () => T {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(callback);
    return transaction;
  }

  /**
   * Database Maintenance Methods
   */

  /**
   * Perform database cleanup
   */
  performCleanup(daysOld: number = 30): any {
    if (!this.cleanup) {
      throw new Error('Cleanup utilities not initialized');
    }
    return this.cleanup.performFullCleanup(daysOld);
  }

  /**
   * Get cleanup recommendations
   */
  getCleanupRecommendations(): any {
    if (!this.cleanup) {
      throw new Error('Cleanup utilities not initialized');
    }
    return this.cleanup.getCleanupRecommendations();
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<any> {
    if (!this.migrationManager) {
      throw new Error('Migration manager not initialized');
    }
    return await this.migrationManager.runMigrations();
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('Database connection closed');
    }
  }

  // Getter for database instance (for migration manager and cleanup)
  get database(): Database.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }
}

export default DatabaseService;
