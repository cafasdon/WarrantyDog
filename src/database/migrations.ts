import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type DatabaseService from './DatabaseService.js';
import type { Migration } from '../types/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationRecord {
  version: string;
  name: string;
  execute: () => void;
}

interface CleanupResult {
  sessionsDeleted: number;
  historyDeleted: number;
}

interface CleanupRecommendation {
  type: 'old_sessions' | 'orphaned_history' | 'vacuum_needed';
  count?: number;
  sizeMB?: number;
  freeMB?: number;
  message: string;
}

/**
 * Database Migration System
 * Handles schema updates and data migrations for WarrantyDog
 */
class MigrationManager {
  private dbService: DatabaseService;
  private migrationsPath: string;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * Initialize migrations table
   */
  initializeMigrationsTable(): void {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    this.dbService.database.exec(createMigrationsTable);
  }

  /**
   * Get executed migrations
   */
  getExecutedMigrations(): string[] {
    const stmt = this.dbService.database.prepare('SELECT version FROM migrations ORDER BY version');
    return stmt.all().map((row: any) => row.version);
  }

  /**
   * Record migration execution
   */
  recordMigration(version: string, name: string): void {
    const stmt = this.dbService.database.prepare(`
      INSERT INTO migrations (version, name) VALUES (?, ?)
    `);
    stmt.run(version, name);
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      this.initializeMigrationsTable();
      
      const executedMigrations = this.getExecutedMigrations();
      const availableMigrations = this.getAvailableMigrations();
      
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return;
      }

      console.log(`Running ${pendingMigrations.length} pending migrations...`);
      
      for (const migration of pendingMigrations) {
        console.log(`Executing migration: ${migration.name}`);
        await this.executeMigration(migration);
        this.recordMigration(migration.version, migration.name);
        console.log(`Migration completed: ${migration.name}`);
      }
      
      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get available migration files
   */
  getAvailableMigrations(): MigrationRecord[] {
    const migrations: MigrationRecord[] = [];
    
    // Built-in migrations
    migrations.push({
      version: '001',
      name: 'Initial Schema',
      execute: () => {
        // Schema is already created in DatabaseService initialization
        console.log('Initial schema already applied');
      }
    });

    migrations.push({
      version: '002',
      name: 'Add Indexes',
      execute: () => {
        // Additional indexes for performance
        const indexes = [
          'CREATE INDEX IF NOT EXISTS idx_devices_last_processed ON devices(last_processed_at)',
          'CREATE INDEX IF NOT EXISTS idx_devices_retry_count ON devices(retry_count)',
          'CREATE INDEX IF NOT EXISTS idx_processing_history_error_type ON processing_history(error_type)'
        ];
        
        indexes.forEach(sql => {
          this.dbService.database.exec(sql);
        });
      }
    });

    return migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration: MigrationRecord): Promise<void> {
    const transaction = this.dbService.database.transaction(() => {
      migration.execute();
    });
    
    transaction();
  }
}

/**
 * Database Cleanup Utilities
 */
class DatabaseCleanup {
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  /**
   * Clean up old completed sessions
   */
  cleanupOldSessions(daysOld: number = 30): number {
    const stmt = this.dbService.database.prepare(`
      DELETE FROM sessions 
      WHERE created_at < datetime('now', '-' || ? || ' days')
      AND status IN ('completed', 'cancelled')
    `);
    
    const result = stmt.run(daysOld);
    console.log(`Cleaned up ${result.changes} old sessions`);
    return result.changes;
  }

  /**
   * Clean up orphaned processing history
   */
  cleanupOrphanedHistory(): number {
    const stmt = this.dbService.database.prepare(`
      DELETE FROM processing_history 
      WHERE device_id NOT IN (SELECT id FROM devices)
    `);
    
    const result = stmt.run();
    console.log(`Cleaned up ${result.changes} orphaned history records`);
    return result.changes;
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuumDatabase(): void {
    console.log('Vacuuming database...');
    this.dbService.database.exec('VACUUM');
    console.log('Database vacuum completed');
  }

  /**
   * Analyze database for query optimization
   */
  analyzeDatabase(): void {
    console.log('Analyzing database...');
    this.dbService.database.exec('ANALYZE');
    console.log('Database analysis completed');
  }

  /**
   * Full cleanup routine
   */
  performFullCleanup(daysOld: number = 30): CleanupResult {
    console.log('Starting full database cleanup...');
    
    const transaction = this.dbService.database.transaction(() => {
      const sessionsDeleted = this.cleanupOldSessions(daysOld);
      const historyDeleted = this.cleanupOrphanedHistory();
      
      return { sessionsDeleted, historyDeleted };
    });
    
    const result = transaction();
    
    this.analyzeDatabase();
    this.vacuumDatabase();
    
    console.log('Full cleanup completed:', result);
    return result;
  }

  /**
   * Get cleanup recommendations
   */
  getCleanupRecommendations(): CleanupRecommendation[] {
    const recommendations: CleanupRecommendation[] = [];
    
    // Check for old sessions
    const oldSessionsResult = this.dbService.database.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE created_at < datetime('now', '-30 days')
      AND status IN ('completed', 'cancelled')
    `).get() as { count: number } | undefined;
    const oldSessionsCount = oldSessionsResult?.count || 0;
    
    if (oldSessionsCount > 0) {
      recommendations.push({
        type: 'old_sessions',
        count: oldSessionsCount,
        message: `${oldSessionsCount} old sessions can be cleaned up`
      });
    }
    
    // Check for orphaned history
    const orphanedHistoryResult = this.dbService.database.prepare(`
      SELECT COUNT(*) as count FROM processing_history
      WHERE device_id NOT IN (SELECT id FROM devices)
    `).get() as { count: number } | undefined;
    const orphanedHistoryCount = orphanedHistoryResult?.count || 0;
    
    if (orphanedHistoryCount > 0) {
      recommendations.push({
        type: 'orphaned_history',
        count: orphanedHistoryCount,
        message: `${orphanedHistoryCount} orphaned history records can be cleaned up`
      });
    }
    
    // Check database size
    const dbStatsResult = this.dbService.database.prepare(`
      SELECT
        page_count * page_size as size_bytes,
        freelist_count * page_size as free_bytes
      FROM pragma_page_count(), pragma_page_size(), pragma_freelist_count()
    `).get() as { size_bytes: number; free_bytes: number } | undefined;

    const sizeMB = dbStatsResult ? Math.round(dbStatsResult.size_bytes / 1024 / 1024 * 100) / 100 : 0;
    const freeMB = dbStatsResult ? Math.round(dbStatsResult.free_bytes / 1024 / 1024 * 100) / 100 : 0;
    
    if (freeMB > 10) {
      recommendations.push({
        type: 'vacuum_needed',
        sizeMB: sizeMB,
        freeMB: freeMB,
        message: `Database has ${freeMB}MB of free space that can be reclaimed`
      });
    }
    
    return recommendations;
  }
}

export { MigrationManager, DatabaseCleanup };
