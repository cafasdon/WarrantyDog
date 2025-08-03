#!/usr/bin/env node

/**
 * Debug script to check database contents
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'warrantydog.db');

console.log('🔍 Checking WarrantyDog Database...');
console.log(`Database path: ${dbPath}`);

try {
    const db = new Database(dbPath);
    
    // Check sessions
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 10').all();
    console.log(`\n📋 Sessions (${sessions.length}):`);
    sessions.forEach(session => {
        console.log(`  - ${session.id}: ${session.file_name} (${session.status}) - ${session.total_devices} devices`);
    });
    
    // Check devices
    const devices = db.prepare('SELECT COUNT(*) as count FROM devices').get();
    console.log(`\n🖥️ Total Devices: ${devices.count}`);
    
    const devicesByState = db.prepare(`
        SELECT processing_state, COUNT(*) as count 
        FROM devices 
        GROUP BY processing_state
    `).all();
    console.log('Device states:');
    devicesByState.forEach(state => {
        console.log(`  - ${state.processing_state}: ${state.count}`);
    });
    
    // Check devices with warranty data
    const devicesWithWarranty = db.prepare(`
        SELECT COUNT(*) as count 
        FROM devices 
        WHERE warranty_status IS NOT NULL
    `).get();
    console.log(`\n💾 Devices with warranty data: ${devicesWithWarranty.count}`);
    
    // Check API responses
    const apiResponses = db.prepare('SELECT COUNT(*) as count FROM api_responses').get();
    console.log(`\n🌐 API Responses: ${apiResponses.count}`);
    
    const apiResponsesByStatus = db.prepare(`
        SELECT parsing_status, COUNT(*) as count 
        FROM api_responses 
        GROUP BY parsing_status
    `).all();
    console.log('API response parsing status:');
    apiResponsesByStatus.forEach(status => {
        console.log(`  - ${status.parsing_status}: ${status.count}`);
    });
    
    // Sample warranty data
    const sampleWarrantyData = db.prepare(`
        SELECT serial_number, vendor, warranty_status, warranty_end_date, last_processed_at
        FROM devices 
        WHERE warranty_status IS NOT NULL 
        LIMIT 5
    `).all();
    
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
    `).all();
    
    if (sampleApiData.length > 0) {
        console.log(`\n🔧 Sample API response data:`);
        sampleApiData.forEach(response => {
            console.log(`  - ${response.service_tag} (${response.vendor}): ${response.parsing_status}`);
            if (response.parsed_data) {
                try {
                    const parsed = JSON.parse(response.parsed_data);
                    console.log(`    Status: ${parsed.status}, End Date: ${parsed.endDate}`);
                } catch (e) {
                    console.log(`    Parse error: ${e.message}`);
                }
            }
        });
    }
    
    db.close();
    console.log('\n✅ Database check complete!');
    
} catch (error) {
    console.error('❌ Database error:', error);
}
