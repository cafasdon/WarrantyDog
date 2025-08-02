import Database from 'better-sqlite3';

// Open the database
const db = new Database('./data/warrantydog.db');

try {
    console.log('🔍 Debugging cache loading issue...\n');
    
    // Check what devices we have in the database with warranty data
    const devicesWithWarranty = db.prepare(`
        SELECT 
            serial_number,
            vendor,
            warranty_status,
            warranty_type,
            processing_state
        FROM devices 
        WHERE processing_state = 'success' 
        AND warranty_status IS NOT NULL 
        AND warranty_status != 'Unknown'
        LIMIT 10
    `).all();
    
    console.log('📱 Sample devices with warranty data in database:');
    devicesWithWarranty.forEach(device => {
        console.log(`  - ${device.serial_number} (${device.vendor}): ${device.warranty_status} - ${device.warranty_type || 'N/A'}`);
    });
    
    // Check what API responses we have
    const apiResponses = db.prepare(`
        SELECT 
            service_tag,
            vendor,
            parsing_status,
            parsed_data
        FROM api_responses 
        WHERE parsing_status = 'success'
        AND parsed_data IS NOT NULL
        LIMIT 5
    `).all();
    
    console.log('\n📡 Sample API responses:');
    apiResponses.forEach(response => {
        try {
            const parsed = JSON.parse(response.parsed_data);
            console.log(`  - ${response.service_tag} (${response.vendor}): ${parsed.status} - ${parsed.warrantyType || 'N/A'}`);
        } catch (e) {
            console.log(`  - ${response.service_tag} (${response.vendor}): Parse error`);
        }
    });
    
    // Test the bulk query that the app uses
    console.log('\n🔍 Testing bulk query with sample devices...');
    
    // Check if any of the CSV devices exist in the database
    console.log('\n🔍 Checking specific devices that should not be skipped...');
    const csvDevices = ['PF490Z53', 'JHRQ324', '545NFX3', '496VKX3', 'FKNQ324'];

    csvDevices.forEach(serial => {
        // Check devices table
        const deviceExists = db.prepare(`
            SELECT serial_number, vendor, warranty_status
            FROM devices
            WHERE serial_number = ?
            AND processing_state = 'success'
        `).get(serial);

        // Check API responses with detailed info
        const apiExists = db.prepare(`
            SELECT service_tag, vendor, parsing_status, parsed_data
            FROM api_responses
            WHERE service_tag = ?
            ORDER BY response_timestamp DESC
            LIMIT 1
        `).get(serial);

        let apiStatus = 'Not found';
        if (apiExists) {
            try {
                const parsed = JSON.parse(apiExists.parsed_data || '{}');
                apiStatus = `Found (${apiExists.parsing_status}) - Status: ${parsed.status || 'Unknown'}`;
            } catch (e) {
                apiStatus = `Found (${apiExists.parsing_status}) - Parse error`;
            }
        }

        console.log(`  ${serial}: Device table: ${deviceExists ? `Found (${deviceExists.warranty_status})` : 'Not found'}, API table: ${apiStatus}`);
    });

    // Simulate what the app would send
    const testDevices = [
        { serviceTag: 'JHRQ324', vendor: 'Dell' },
        { serviceTag: '545NFX3', vendor: 'Dell' },
        { serviceTag: '496VKX3', vendor: 'Dell' },
        { serviceTag: 'FKNQ324', vendor: 'Dell' }
    ];
    
    console.log('Test devices:', testDevices);
    
    // Create placeholders for the IN clause
    const placeholders = testDevices.map(() => '(?, ?)').join(', ');
    const params = testDevices.flatMap(device => [device.serviceTag, device.vendor]);
    
    // Test devices table query
    const devicesStmt = db.prepare(`
        SELECT
            serial_number as service_tag,
            vendor,
            warranty_status,
            warranty_type,
            warranty_end_date,
            warranty_days_remaining,
            ship_date,
            last_processed_at,
            model
        FROM devices
        WHERE (serial_number, vendor) IN (VALUES ${placeholders})
        AND processing_state = 'success'
        AND warranty_status IS NOT NULL
        ORDER BY last_processed_at DESC
    `);
    
    const deviceResults = devicesStmt.all(...params);
    console.log(`\n📱 Devices table results: ${deviceResults.length} found`);
    deviceResults.forEach(result => {
        console.log(`  - ${result.service_tag} (${result.vendor}): ${result.warranty_status}`);
    });
    
    // Test API responses table query
    const apiStmt = db.prepare(`
        SELECT
            service_tag,
            vendor,
            parsed_data,
            response_timestamp,
            parsing_status
        FROM api_responses
        WHERE (service_tag, vendor) IN (VALUES ${placeholders})
        AND parsing_status = 'success'
        AND parsed_data IS NOT NULL
        ORDER BY response_timestamp DESC
    `);
    
    const apiResults = apiStmt.all(...params);
    console.log(`\n📡 API responses table results: ${apiResults.length} found`);
    apiResults.forEach(result => {
        try {
            const parsed = JSON.parse(result.parsed_data);
            console.log(`  - ${result.service_tag} (${result.vendor}): ${parsed.status}`);
        } catch (e) {
            console.log(`  - ${result.service_tag} (${result.vendor}): Parse error`);
        }
    });
    
    // Test case-insensitive query
    console.log('\n🔍 Testing case-insensitive query...');
    const caseInsensitiveStmt = db.prepare(`
        SELECT
            service_tag,
            vendor,
            parsed_data
        FROM api_responses
        WHERE (service_tag, LOWER(vendor)) IN (VALUES ${testDevices.map(() => '(?, LOWER(?))').join(', ')})
        AND parsing_status = 'success'
        AND parsed_data IS NOT NULL
        LIMIT 5
    `);
    
    const caseResults = caseInsensitiveStmt.all(...params);
    console.log(`📡 Case-insensitive results: ${caseResults.length} found`);
    caseResults.forEach(result => {
        try {
            const parsed = JSON.parse(result.parsed_data);
            console.log(`  - ${result.service_tag} (${result.vendor}): ${parsed.status}`);
        } catch (e) {
            console.log(`  - ${result.service_tag} (${result.vendor}): Parse error`);
        }
    });
    
} catch (error) {
    console.error('❌ Error debugging cache:', error);
} finally {
    db.close();
}
