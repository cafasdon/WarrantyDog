import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Migration System
 * Handles schema updates and data migrations for WarrantyDog
 */
class MigrationManager {
    constructor(dbService) {
        this.dbService = dbService;
        this.migrationsPath = path.join(__dirname, 'migrations');
    }

    /**
     * Initialize migrations table
     */
    initializeMigrationsTable() {
        const createMigrationsTable = `
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        this.dbService.db.exec(createMigrationsTable);
    }

    /**
     * Get executed migrations
     */
    getExecutedMigrations() {
        const stmt = this.dbService.db.prepare('SELECT version FROM migrations ORDER BY version');
        return stmt.all().map(row => row.version);
    }

    /**
     * Record migration execution
     */
    recordMigration(version, name) {
        const stmt = this.dbService.db.prepare(`
            INSERT INTO migrations (version, name) VALUES (?, ?)
        `);
        stmt.run(version, name);
    }

    /**
     * Run pending migrations
     */
    async runMigrations() {
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
    getAvailableMigrations() {
        const migrations = [];
        
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
                    this.dbService.db.exec(sql);
                });
            }
        });

        return migrations.sort((a, b) => a.version.localeCompare(b.version));
    }

    /**
     * Execute a single migration
     */
    async executeMigration(migration) {
        const transaction = this.dbService.db.transaction(() => {
            migration.execute();
        });
        
        transaction();
    }
}

/**
 * Database Cleanup Utilities
 */
class DatabaseCleanup {
    constructor(dbService) {
        this.dbService = dbService;
    }

    /**
     * Clean up old completed sessions
     */
    cleanupOldSessions(daysOld = 30) {
        const stmt = this.dbService.db.prepare(`
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
    cleanupOrphanedHistory() {
        const stmt = this.dbService.db.prepare(`
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
    vacuumDatabase() {
        console.log('Vacuuming database...');
        this.dbService.db.exec('VACUUM');
        console.log('Database vacuum completed');
    }

    /**
     * Analyze database for query optimization
     */
    analyzeDatabase() {
        console.log('Analyzing database...');
        this.dbService.db.exec('ANALYZE');
        console.log('Database analysis completed');
    }

    /**
     * Full cleanup routine
     */
    performFullCleanup(daysOld = 30) {
        console.log('Starting full database cleanup...');
        
        const transaction = this.dbService.db.transaction(() => {
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
    getCleanupRecommendations() {
        const recommendations = [];
        
        // Check for old sessions
        const oldSessionsCount = this.dbService.db.prepare(`
            SELECT COUNT(*) as count FROM sessions 
            WHERE created_at < datetime('now', '-30 days')
            AND status IN ('completed', 'cancelled')
        `).get().count;
        
        if (oldSessionsCount > 0) {
            recommendations.push({
                type: 'old_sessions',
                count: oldSessionsCount,
                message: `${oldSessionsCount} old sessions can be cleaned up`
            });
        }
        
        // Check for orphaned history
        const orphanedHistoryCount = this.dbService.db.prepare(`
            SELECT COUNT(*) as count FROM processing_history 
            WHERE device_id NOT IN (SELECT id FROM devices)
        `).get().count;
        
        if (orphanedHistoryCount > 0) {
            recommendations.push({
                type: 'orphaned_history',
                count: orphanedHistoryCount,
                message: `${orphanedHistoryCount} orphaned history records can be cleaned up`
            });
        }
        
        // Check database size
        const dbStats = this.dbService.db.prepare(`
            SELECT 
                page_count * page_size as size_bytes,
                freelist_count * page_size as free_bytes
            FROM pragma_page_count(), pragma_page_size(), pragma_freelist_count()
        `).get();
        
        const sizeMB = Math.round(dbStats.size_bytes / 1024 / 1024 * 100) / 100;
        const freeMB = Math.round(dbStats.free_bytes / 1024 / 1024 * 100) / 100;
        
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
