import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * Database Debug Tool
 * Examine the SQLite database to understand what's being stored
 */

const dbPath = './data/warrantydog.db';

if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('🔍 WarrantyDog Database Investigation\n');

// 1. Check tables
console.log('📋 TABLES:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(table => console.log(`  - ${table.name}`));
console.log('');

// 2. Check sessions
console.log('📊 SESSIONS:');
const sessions = db.prepare("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5").all();
if (sessions.length === 0) {
    console.log('  No sessions found');
} else {
    sessions.forEach(session => {
        console.log(`  Session: ${session.id}`);
        console.log(`    File: ${session.file_name}`);
        console.log(`    Status: ${session.status}`);
        console.log(`    Devices: ${session.total_devices} total, ${session.processed_count} processed`);
        console.log(`    Success: ${session.successful_count}, Failed: ${session.failed_count}, Skipped: ${session.skipped_count}`);
        console.log(`    Created: ${session.created_at}`);
        console.log('');
    });
}

// 3. Check API responses cache
console.log('💾 API RESPONSES CACHE:');
const apiResponsesCount = db.prepare("SELECT COUNT(*) as count FROM api_responses").get();
console.log(`  Total API responses cached: ${apiResponsesCount.count}`);

if (apiResponsesCount.count > 0) {
    // Show breakdown by vendor
    const vendorBreakdown = db.prepare(`
        SELECT vendor, COUNT(*) as count, 
               COUNT(CASE WHEN parsing_status = 'success' THEN 1 END) as parsed_success,
               COUNT(CASE WHEN parsing_status = 'failed' THEN 1 END) as parsed_failed,
               COUNT(CASE WHEN parsing_status = 'pending' THEN 1 END) as parsed_pending
        FROM api_responses 
        GROUP BY vendor
    `).all();
    
    vendorBreakdown.forEach(vendor => {
        console.log(`  ${vendor.vendor}: ${vendor.count} responses`);
        console.log(`    Parsed successfully: ${vendor.parsed_success}`);
        console.log(`    Parse failed: ${vendor.parsed_failed}`);
        console.log(`    Parse pending: ${vendor.parsed_pending}`);
    });
    
    // Show recent API responses
    console.log('\n  Recent API responses:');
    const recentResponses = db.prepare(`
        SELECT vendor, service_tag, response_status, parsing_status, response_timestamp
        FROM api_responses 
        ORDER BY response_timestamp DESC 
        LIMIT 10
    `).all();
    
    recentResponses.forEach(response => {
        console.log(`    ${response.vendor}/${response.service_tag}: HTTP ${response.response_status}, Parse: ${response.parsing_status} (${response.response_timestamp})`);
    });
}

// 4. Check devices
console.log('\n📱 DEVICES:');
const devicesCount = db.prepare("SELECT COUNT(*) as count FROM devices").get();
console.log(`  Total devices: ${devicesCount.count}`);

if (devicesCount.count > 0) {
    // Show breakdown by processing state
    const stateBreakdown = db.prepare(`
        SELECT processing_state, COUNT(*) as count
        FROM devices 
        GROUP BY processing_state
    `).all();
    
    stateBreakdown.forEach(state => {
        console.log(`    ${state.processing_state}: ${state.count}`);
    });
    
    // Show recent devices
    console.log('\n  Recent devices:');
    const recentDevices = db.prepare(`
        SELECT serial_number, vendor, processing_state, warranty_status, last_processed_at
        FROM devices 
        ORDER BY last_processed_at DESC 
        LIMIT 10
    `).all();
    
    recentDevices.forEach(device => {
        console.log(`    ${device.serial_number} (${device.vendor}): ${device.processing_state} -> ${device.warranty_status || 'N/A'}`);
    });
}

// 5. Check for specific service tags
console.log('\n🔍 SAMPLE SERVICE TAG INVESTIGATION:');
const sampleTags = ['JN28C24', '4PC8533', '5LR55Y2', '8PSMR74', '9JQHFL3', '8MFDPW2'];

sampleTags.forEach(tag => {
    // Check if in devices table
    const device = db.prepare("SELECT * FROM devices WHERE serial_number = ?").get(tag);
    
    // Check if in API responses
    const apiResponse = db.prepare("SELECT * FROM api_responses WHERE service_tag = ?").get(tag);
    
    console.log(`  ${tag}:`);
    if (device) {
        console.log(`    Device: ${device.processing_state} -> ${device.warranty_status || 'N/A'}`);
    } else {
        console.log(`    Device: Not found in devices table`);
    }
    
    if (apiResponse) {
        console.log(`    API: HTTP ${apiResponse.response_status}, Parse: ${apiResponse.parsing_status}`);
        if (apiResponse.parsed_data) {
            try {
                const parsed = JSON.parse(apiResponse.parsed_data);
                console.log(`    Warranty: ${parsed.status} - ${parsed.message || 'N/A'}`);
            } catch (e) {
                console.log(`    Warranty: Parse error`);
            }
        }
    } else {
        console.log(`    API: Not found in cache`);
    }
});

// 6. Database statistics
console.log('\n📈 DATABASE STATISTICS:');
const dbStats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM devices) as total_devices,
        (SELECT COUNT(*) FROM api_responses) as total_api_responses,
        (SELECT COUNT(*) FROM processing_history) as total_processing_attempts
`).get();

console.log(`  Sessions: ${dbStats.total_sessions}`);
console.log(`  Devices: ${dbStats.total_devices}`);
console.log(`  API Responses: ${dbStats.total_api_responses}`);
console.log(`  Processing Attempts: ${dbStats.total_processing_attempts}`);

db.close();
console.log('\n✅ Database investigation complete!');
