/**
 * Database Check Utility for WarrantyDog
 * TypeScript utility to inspect database contents and health
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SessionRow {
  id: string;
  file_name: string;
  total_devices: number;
  status: string;
  created_at: string;
}

interface DeviceCountRow {
  count: number;
}

interface DeviceStateRow {
  processing_state: string;
  count: number;
}

interface VendorRow {
  vendor: string;
  count: number;
}

interface WarrantyStatusRow {
  warranty_status: string;
  count: number;
}

interface SampleDeviceRow {
  serial_number: string;
  vendor: string;
  model: string | null;
  device_name: string | null;
  processing_state: string;
  warranty_status: string | null;
  warranty_end_date: string | null;
}

interface ApiResponseRow {
  service_tag: string;
  vendor: string;
  response_status: number;
  created_at: string;
}

async function checkDatabase(): Promise<void> {
  const dbPath = path.join(__dirname, '../../data/warrantydog.db');
  
  try {
    console.log('🔍 Checking database contents...\n');
    
    // Open the database
    const db = new Database(dbPath);
    
    // Check sessions
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5').all() as SessionRow[];
    console.log(`📊 Sessions table: ${sessions.length} sessions found`);
    sessions.forEach(session => {
      console.log(`  - Session ${session.id}: ${session.file_name} (${session.total_devices} devices, status: ${session.status})`);
    });
    
    // Check devices
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get() as DeviceCountRow;
    console.log(`\n📱 Devices table: ${deviceCount.count} devices found`);
    
    if (deviceCount.count > 0) {
      // Check devices by processing state
      const deviceStates = db.prepare(`
        SELECT processing_state, COUNT(*) as count 
        FROM devices 
        GROUP BY processing_state
      `).all() as DeviceStateRow[];
      
      console.log('  Device states:');
      deviceStates.forEach(state => {
        console.log(`    - ${state.processing_state}: ${state.count} devices`);
      });
      
      // Check devices by vendor
      const deviceVendors = db.prepare(`
        SELECT vendor, COUNT(*) as count 
        FROM devices 
        GROUP BY vendor
      `).all() as VendorRow[];
      
      console.log('\n  Devices by vendor:');
      deviceVendors.forEach(vendor => {
        console.log(`    - ${vendor.vendor}: ${vendor.count} devices`);
      });
      
      // Check warranty status distribution
      const warrantyStatuses = db.prepare(`
        SELECT warranty_status, COUNT(*) as count 
        FROM devices 
        WHERE warranty_status IS NOT NULL
        GROUP BY warranty_status
      `).all() as WarrantyStatusRow[];
      
      if (warrantyStatuses.length > 0) {
        console.log('\n  Warranty status distribution:');
        warrantyStatuses.forEach(status => {
          console.log(`    - ${status.warranty_status}: ${status.count} devices`);
        });
      }
      
      // Show sample devices
      const sampleDevices = db.prepare(`
        SELECT serial_number, vendor, model, device_name, processing_state, warranty_status, warranty_end_date
        FROM devices 
        LIMIT 5
      `).all() as SampleDeviceRow[];
      
      console.log('\n  Sample devices:');
      sampleDevices.forEach(device => {
        const warranty = device.warranty_status 
          ? `${device.warranty_status}${device.warranty_end_date ? ` until ${device.warranty_end_date}` : ''}`
          : 'No warranty data';
        console.log(`    - ${device.serial_number} (${device.vendor}): ${device.processing_state} - ${warranty}`);
      });
    }
    
    // Check API responses
    const apiResponseCount = db.prepare('SELECT COUNT(*) as count FROM api_responses').get() as DeviceCountRow;
    console.log(`\n🌐 API responses table: ${apiResponseCount.count} responses found`);
    
    if (apiResponseCount.count > 0) {
      const recentResponses = db.prepare(`
        SELECT service_tag, vendor, response_status, created_at
        FROM api_responses 
        ORDER BY created_at DESC 
        LIMIT 5
      `).all() as ApiResponseRow[];
      
      console.log('  Recent API responses:');
      recentResponses.forEach(response => {
        console.log(`    - ${response.service_tag} (${response.vendor}): HTTP ${response.response_status} at ${response.created_at}`);
      });
    }
    
    // Database health check
    console.log('\n🏥 Database health check:');
    
    try {
      db.prepare('PRAGMA integrity_check').get();
      console.log('  ✅ Database integrity: OK');
    } catch (error) {
      console.log('  ❌ Database integrity: FAILED');
      console.error('    Error:', error);
    }
    
    try {
      const walMode = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      console.log(`  📝 Journal mode: ${walMode.journal_mode}`);
    } catch (error) {
      console.log('  ❌ Could not check journal mode');
    }
    
    try {
      const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
      const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number };
      const dbSize = (pageSize.page_size * pageCount.page_count) / (1024 * 1024);
      console.log(`  💾 Database size: ${dbSize.toFixed(2)} MB`);
    } catch (error) {
      console.log('  ❌ Could not calculate database size');
    }
    
    db.close();
    console.log('\n✅ Database check completed successfully');
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  }
}

// Run the check if this file is executed directly
if (process.argv[1] && (process.argv[1].endsWith('check-db.js') || process.argv[1].endsWith('check-db.ts'))) {
  checkDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { checkDatabase };
export default checkDatabase;
