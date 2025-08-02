import Database from 'better-sqlite3';

// Open the database
const db = new Database('./data/warrantydog.db');

try {
    console.log('🔍 Checking database contents...\n');
    
    // Check sessions
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5').all();
    console.log(`📊 Sessions table: ${sessions.length} sessions found`);
    sessions.forEach(session => {
        console.log(`  - Session ${session.id}: ${session.file_name} (${session.total_devices} devices, status: ${session.status})`);
    });
    
    // Check devices
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get();
    console.log(`\n📱 Devices table: ${deviceCount.count} devices found`);
    
    if (deviceCount.count > 0) {
        // Check devices by processing state
        const deviceStates = db.prepare(`
            SELECT processing_state, COUNT(*) as count 
            FROM devices 
            GROUP BY processing_state
        `).all();
        
        console.log('  Device states:');
        deviceStates.forEach(state => {
            console.log(`    - ${state.processing_state}: ${state.count} devices`);
        });
        
        // Check devices with warranty data
        const devicesWithWarranty = db.prepare(`
            SELECT COUNT(*) as count 
            FROM devices 
            WHERE warranty_status IS NOT NULL
        `).get();
        console.log(`  Devices with warranty data: ${devicesWithWarranty.count}`);
        
        // Show sample devices with different warranty statuses
        const sampleDevices = db.prepare(`
            SELECT serial_number, vendor, warranty_status, warranty_type, last_processed_at
            FROM devices
            WHERE processing_state = 'success'
            ORDER BY last_processed_at DESC
            LIMIT 10
        `).all();

        // Check warranty status distribution
        const warrantyStats = db.prepare(`
            SELECT warranty_status, COUNT(*) as count
            FROM devices
            WHERE processing_state = 'success'
            GROUP BY warranty_status
            ORDER BY count DESC
        `).all();
        
        if (sampleDevices.length > 0) {
            console.log('\n  Recently processed devices:');
            sampleDevices.forEach(device => {
                console.log(`    - ${device.serial_number} (${device.vendor}): ${device.warranty_status} - ${device.warranty_type || 'N/A'}`);
            });
        }

        if (warrantyStats.length > 0) {
            console.log('\n  Warranty status distribution:');
            warrantyStats.forEach(stat => {
                console.log(`    - ${stat.warranty_status}: ${stat.count} devices`);
            });
        }
    }
    
    // Check api_responses
    const apiResponseCount = db.prepare('SELECT COUNT(*) as count FROM api_responses').get();
    console.log(`\n📡 API responses table: ${apiResponseCount.count} responses found`);
    
    if (apiResponseCount.count > 0) {
        const apiStates = db.prepare(`
            SELECT parsing_status, COUNT(*) as count 
            FROM api_responses 
            GROUP BY parsing_status
        `).all();
        
        console.log('  API response states:');
        apiStates.forEach(state => {
            console.log(`    - ${state.parsing_status}: ${state.count} responses`);
        });
        
        // Show sample API responses
        const sampleResponses = db.prepare(`
            SELECT service_tag, vendor, parsing_status, response_timestamp 
            FROM api_responses 
            WHERE parsing_status = 'success' 
            LIMIT 5
        `).all();
        
        if (sampleResponses.length > 0) {
            console.log('\n  Sample successful API responses:');
            sampleResponses.forEach(response => {
                console.log(`    - ${response.service_tag} (${response.vendor}): ${response.parsing_status} at ${response.response_timestamp}`);
            });
        }
    }
    
} catch (error) {
    console.error('❌ Error checking database:', error);
} finally {
    db.close();
}
