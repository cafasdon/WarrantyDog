import Database from 'better-sqlite3';

// Open the database
const db = new Database('./data/warrantydog.db');

try {
    console.log('🔧 Fixing existing device data...\n');
    
    // First, let's check what we have in both tables
    console.log('🔍 Checking devices table...');
    const deviceSample = db.prepare(`
        SELECT serial_number, vendor, processing_state, warranty_status
        FROM devices
        LIMIT 5
    `).all();
    console.log('Sample devices:', deviceSample);

    console.log('\n🔍 Checking api_responses table...');
    const apiSample = db.prepare(`
        SELECT service_tag, vendor, parsing_status
        FROM api_responses
        LIMIT 5
    `).all();
    console.log('Sample API responses:', apiSample);

    // Check for vendor case mismatch
    console.log('\n🔍 Checking for case mismatches...');
    const vendorCheck = db.prepare(`
        SELECT DISTINCT d.vendor as device_vendor, ar.vendor as api_vendor
        FROM devices d
        JOIN api_responses ar ON d.serial_number = ar.service_tag
        WHERE LOWER(d.vendor) = LOWER(ar.vendor)
        AND d.vendor != ar.vendor
        LIMIT 5
    `).all();
    console.log('Vendor case mismatches:', vendorCheck);

    // Find devices that have API response data but haven't been updated in the devices table
    const devicesNeedingUpdate = db.prepare(`
        SELECT DISTINCT
            d.id as device_id,
            d.serial_number,
            d.vendor,
            d.processing_state,
            d.warranty_status,
            ar.parsed_data,
            ar.response_timestamp
        FROM devices d
        JOIN api_responses ar ON d.serial_number = ar.service_tag AND LOWER(d.vendor) = LOWER(ar.vendor)
        WHERE d.processing_state = 'pending'
        AND d.warranty_status = 'Unknown'
        AND ar.parsing_status = 'success'
        AND ar.parsed_data IS NOT NULL
        ORDER BY ar.response_timestamp DESC
    `).all();
    
    console.log(`📊 Found ${devicesNeedingUpdate.length} devices that need updating`);
    
    if (devicesNeedingUpdate.length === 0) {
        console.log('✅ No devices need updating');
        process.exit(0);
    }
    
    // Prepare update statement
    const updateStmt = db.prepare(`
        UPDATE devices 
        SET processing_state = ?,
            warranty_status = ?,
            warranty_type = ?,
            warranty_end_date = ?,
            warranty_days_remaining = ?,
            ship_date = ?,
            updated_at = CURRENT_TIMESTAMP,
            last_processed_at = ?
        WHERE id = ?
    `);
    
    let updated = 0;
    let errors = 0;
    
    // Process each device
    devicesNeedingUpdate.forEach(device => {
        try {
            const parsedData = JSON.parse(device.parsed_data);
            
            // Update the device record
            const result = updateStmt.run(
                'success',                          // processing_state
                parsedData.status,                  // warranty_status
                parsedData.warrantyType,            // warranty_type
                parsedData.endDate,                 // warranty_end_date
                parsedData.daysRemaining,           // warranty_days_remaining
                parsedData.shipDate,                // ship_date
                device.response_timestamp,          // last_processed_at
                device.device_id                    // WHERE id = ?
            );
            
            if (result.changes > 0) {
                updated++;
                console.log(`✅ Updated ${device.serial_number} (${device.vendor}): ${parsedData.status} - ${parsedData.warrantyType || 'N/A'}`);
            }
            
        } catch (error) {
            errors++;
            console.error(`❌ Failed to update ${device.serial_number}:`, error.message);
        }
    });
    
    console.log(`\n📊 Update Summary:`);
    console.log(`  ✅ Successfully updated: ${updated} devices`);
    console.log(`  ❌ Errors: ${errors} devices`);
    
    // Verify the updates
    const verifyCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM devices 
        WHERE processing_state = 'success' 
        AND warranty_status != 'Unknown'
    `).get();
    
    console.log(`\n🔍 Verification: ${verifyCount.count} devices now have warranty data`);
    
} catch (error) {
    console.error('❌ Error fixing existing data:', error);
} finally {
    db.close();
}
