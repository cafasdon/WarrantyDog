/**
 * Database Debug Utility for WarrantyDog
 * TypeScript utility for detailed database debugging and analysis
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
  status: string;
  total_devices: number;
  created_at: string;
  updated_at: string;
}

interface DeviceRow {
  id: number;
  session_id: string;
  serial_number: string;
  vendor: string;
  model: string | null;
  device_name: string | null;
  processing_state: string;
  warranty_status: string | null;
  warranty_end_date: string | null;
  last_processed_at: string | null;
  retry_count: number;
  error_message: string | null;
}

interface ApiResponseRow {
  id: number;
  service_tag: string;
  vendor: string;
  response_status: number;
  parsing_status: string | null;
  parsed_data: string | null;
  created_at: string;
}

interface CountRow {
  count: number;
}

interface StateCountRow {
  processing_state: string;
  count: number;
}

async function debugDatabase(): Promise<void> {
  const dbPath = path.join(__dirname, '../../data/warrantydog.db');
  
  try {
    console.log('🐛 Starting detailed database debug analysis...\n');
    
    const db = new Database(dbPath);
    
    // Sessions analysis
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 10').all() as SessionRow[];
    console.log(`📋 Sessions (${sessions.length}):`);
    sessions.forEach(session => {
      console.log(`  - ${session.id}: ${session.file_name} (${session.status}) - ${session.total_devices} devices`);
      console.log(`    Created: ${session.created_at}, Updated: ${session.updated_at}`);
    });
    
    // Devices analysis
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get() as CountRow;
    console.log(`\n🖥️ Total Devices: ${deviceCount.count}`);
    
    const devicesByState = db.prepare(`
      SELECT processing_state, COUNT(*) as count 
      FROM devices 
      GROUP BY processing_state
    `).all() as StateCountRow[];
    console.log('Device states:');
    devicesByState.forEach(state => {
      console.log(`  - ${state.processing_state}: ${state.count}`);
    });
    
    // Error analysis
    const devicesWithErrors = db.prepare(`
      SELECT COUNT(*) as count 
      FROM devices 
      WHERE error_message IS NOT NULL
    `).get() as CountRow;
    
    if (devicesWithErrors.count > 0) {
      console.log(`\n❌ Devices with errors: ${devicesWithErrors.count}`);
      
      const errorSamples = db.prepare(`
        SELECT serial_number, vendor, error_message, retry_count
        FROM devices 
        WHERE error_message IS NOT NULL 
        LIMIT 5
      `).all() as Pick<DeviceRow, 'serial_number' | 'vendor' | 'error_message' | 'retry_count'>[];
      
      console.log('Sample errors:');
      errorSamples.forEach(device => {
        console.log(`  - ${device.serial_number} (${device.vendor}): ${device.error_message} (retries: ${device.retry_count})`);
      });
    }
    
    // Retry analysis
    const highRetryDevices = db.prepare(`
      SELECT serial_number, vendor, retry_count, error_message
      FROM devices 
      WHERE retry_count > 3 
      ORDER BY retry_count DESC 
      LIMIT 5
    `).all() as Pick<DeviceRow, 'serial_number' | 'vendor' | 'retry_count' | 'error_message'>[];
    
    if (highRetryDevices.length > 0) {
      console.log(`\n🔄 High retry devices:`);
      highRetryDevices.forEach(device => {
        console.log(`  - ${device.serial_number} (${device.vendor}): ${device.retry_count} retries - ${device.error_message}`);
      });
    }
    
    // API responses analysis
    const apiResponseCount = db.prepare('SELECT COUNT(*) as count FROM api_responses').get() as CountRow;
    console.log(`\n🌐 API Responses: ${apiResponseCount.count}`);
    
    if (apiResponseCount.count > 0) {
      const responsesByStatus = db.prepare(`
        SELECT response_status, COUNT(*) as count 
        FROM api_responses 
        GROUP BY response_status 
        ORDER BY response_status
      `).all() as { response_status: number; count: number }[];
      
      console.log('Response status codes:');
      responsesByStatus.forEach(status => {
        console.log(`  - HTTP ${status.response_status}: ${status.count} responses`);
      });
      
      // Sample warranty data
      const sampleWarrantyData = db.prepare(`
        SELECT serial_number, vendor, warranty_status, warranty_end_date, last_processed_at
        FROM devices 
        WHERE warranty_status IS NOT NULL 
        LIMIT 5
      `).all() as Pick<DeviceRow, 'serial_number' | 'vendor' | 'warranty_status' | 'warranty_end_date' | 'last_processed_at'>[];
      
      if (sampleWarrantyData.length > 0) {
        console.log(`\n📊 Sample warranty data:`);
        sampleWarrantyData.forEach(device => {
          console.log(`  - ${device.serial_number} (${device.vendor}): ${device.warranty_status} until ${device.warranty_end_date}`);
        });
      }
      
      // Sample API responses with parsed data
      const sampleApiData = db.prepare(`
        SELECT service_tag, vendor, parsing_status, parsed_data
        FROM api_responses 
        WHERE parsed_data IS NOT NULL 
        LIMIT 3
      `).all() as Pick<ApiResponseRow, 'service_tag' | 'vendor' | 'parsing_status' | 'parsed_data'>[];
      
      if (sampleApiData.length > 0) {
        console.log(`\n🔍 Sample parsed API data:`);
        sampleApiData.forEach(response => {
          console.log(`  - ${response.service_tag} (${response.vendor}): ${response.parsing_status}`);
          if (response.parsed_data) {
            try {
              const parsed = JSON.parse(response.parsed_data);
              console.log(`    Data: ${JSON.stringify(parsed, null, 2).substring(0, 200)}...`);
            } catch {
              console.log(`    Raw data: ${response.parsed_data.substring(0, 100)}...`);
            }
          }
        });
      }
    }
    
    // Performance analysis
    console.log(`\n⚡ Performance Analysis:`);
    
    const avgProcessingTime = db.prepare(`
      SELECT AVG(
        CASE 
          WHEN last_processed_at IS NOT NULL 
          THEN (julianday(last_processed_at) - julianday(created_at)) * 24 * 60 * 60 
          ELSE NULL 
        END
      ) as avg_seconds
      FROM devices 
      WHERE last_processed_at IS NOT NULL
    `).get() as { avg_seconds: number | null };
    
    if (avgProcessingTime.avg_seconds) {
      console.log(`  - Average processing time: ${avgProcessingTime.avg_seconds.toFixed(2)} seconds`);
    }
    
    const processingRates = db.prepare(`
      SELECT 
        vendor,
        COUNT(*) as total,
        SUM(CASE WHEN warranty_status IS NOT NULL THEN 1 ELSE 0 END) as processed,
        ROUND(
          (SUM(CASE WHEN warranty_status IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
        ) as success_rate
      FROM devices 
      GROUP BY vendor
    `).all() as { vendor: string; total: number; processed: number; success_rate: number }[];
    
    console.log('  Processing rates by vendor:');
    processingRates.forEach(rate => {
      console.log(`    - ${rate.vendor}: ${rate.processed}/${rate.total} (${rate.success_rate}%)`);
    });
    
    db.close();
    console.log('\n✅ Database debug analysis completed');
    
  } catch (error) {
    console.error('❌ Database debug failed:', error);
    process.exit(1);
  }
}

// Run the debug if this file is executed directly
if (process.argv[1] && (process.argv[1].endsWith('debug-db.js') || process.argv[1].endsWith('debug-db.ts'))) {
  debugDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { debugDatabase };
export default debugDatabase;
