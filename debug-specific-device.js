import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * Debug Tool: Track a specific device through the entire process
 * Find out exactly what happens to a "no_warranty" device
 */

const dbPath = './data/warrantydog.db';

if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('🔍 Tracking Specific Devices Through Processing\n');

// Pick a few devices that should have "no_warranty" status
const testTags = ['JN28C24', '4PC8533', '5LR55Y2', '8PSMR74'];

testTags.forEach(tag => {
    console.log(`\n🎯 TRACKING: ${tag}`);
    
    // 1. Check API response
    const apiResponse = db.prepare(`
        SELECT service_tag, response_status, parsing_status, parsed_data
        FROM api_responses 
        WHERE service_tag = ?
    `).get(tag);
    
    if (apiResponse) {
        console.log(`  ✅ API Response: HTTP ${apiResponse.response_status}, Parse: ${apiResponse.parsing_status}`);
        
        if (apiResponse.parsed_data) {
            try {
                const parsed = JSON.parse(apiResponse.parsed_data);
                console.log(`  📊 Parsed Data: status="${parsed.status}", message="${parsed.message}"`);
                console.log(`  🔍 Full parsed result:`, JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log(`  ❌ Parse Error: ${e.message}`);
            }
        }
    } else {
        console.log(`  ❌ No API response found`);
    }
    
    // 2. Check device record
    const device = db.prepare(`
        SELECT serial_number, processing_state, warranty_status, error_message
        FROM devices 
        WHERE serial_number = ?
    `).get(tag);
    
    if (device) {
        console.log(`  💾 Device Record: state="${device.processing_state}", warranty="${device.warranty_status}"`);
        if (device.error_message) {
            console.log(`  ⚠️ Error Message: ${device.error_message}`);
        }
    } else {
        console.log(`  ❌ No device record found`);
    }
});

// Check the overall pattern
console.log('\n📊 OVERALL PATTERN ANALYSIS:');

const overallStats = db.prepare(`
    SELECT 
        JSON_EXTRACT(ar.parsed_data, '$.status') as api_status,
        d.processing_state as device_state,
        COUNT(*) as count
    FROM api_responses ar
    LEFT JOIN devices d ON ar.service_tag = d.serial_number
    WHERE ar.vendor = 'dell' AND ar.parsing_status = 'success'
    GROUP BY JSON_EXTRACT(ar.parsed_data, '$.status'), d.processing_state
    ORDER BY count DESC
`).all();

console.log('API Status -> Device State mapping:');
overallStats.forEach(stat => {
    console.log(`  ${stat.api_status} -> ${stat.device_state || 'NULL'}: ${stat.count} devices`);
});

// Check for devices that have API responses but no device records
const orphanedResponses = db.prepare(`
    SELECT COUNT(*) as count
    FROM api_responses ar
    LEFT JOIN devices d ON ar.service_tag = d.serial_number
    WHERE ar.vendor = 'dell' AND d.id IS NULL
`).get();

console.log(`\n🔍 Orphaned API responses (no device record): ${orphanedResponses.count}`);

// Check for devices that have no API responses
const orphanedDevices = db.prepare(`
    SELECT COUNT(*) as count
    FROM devices d
    LEFT JOIN api_responses ar ON d.serial_number = ar.service_tag
    WHERE d.vendor = 'dell' AND ar.id IS NULL
`).get();

console.log(`🔍 Orphaned devices (no API response): ${orphanedDevices.count}`);

db.close();
console.log('\n✅ Specific device tracking complete!');
