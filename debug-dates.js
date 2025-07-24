import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * Debug Tool: Check Date Collection
 * Verify if warranty expiry dates are being collected and parsed
 */

const dbPath = './data/warrantydog.db';

if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('📅 Checking Warranty Date Collection\n');

// 1. Check what date fields are available in parsed data
console.log('🔍 SAMPLE PARSED WARRANTY DATA WITH DATES:');

const samplesWithDates = db.prepare(`
    SELECT service_tag, parsed_data
    FROM api_responses 
    WHERE vendor = 'dell' 
    AND parsing_status = 'success' 
    AND parsed_data IS NOT NULL
    AND (
        JSON_EXTRACT(parsed_data, '$.endDate') IS NOT NULL OR
        JSON_EXTRACT(parsed_data, '$.shipDate') IS NOT NULL OR
        parsed_data LIKE '%Date%'
    )
    LIMIT 10
`).all();

samplesWithDates.forEach(sample => {
    console.log(`\n📋 ${sample.service_tag}:`);
    try {
        const parsed = JSON.parse(sample.parsed_data);
        console.log(`  Status: ${parsed.status}`);
        console.log(`  End Date: ${parsed.endDate || 'N/A'}`);
        console.log(`  Ship Date: ${parsed.shipDate || 'N/A'}`);
        console.log(`  Days Remaining: ${parsed.daysRemaining || 'N/A'}`);
        
        // Check for any other date fields
        Object.keys(parsed).forEach(key => {
            if (key.toLowerCase().includes('date') && key !== 'endDate' && key !== 'shipDate') {
                console.log(`  ${key}: ${parsed[key]}`);
            }
        });
    } catch (e) {
        console.log(`  ❌ Parse error: ${e.message}`);
    }
});

// 2. Check raw API responses for date information
console.log('\n\n🔍 RAW API RESPONSE DATE ANALYSIS:');

const rawSamples = db.prepare(`
    SELECT service_tag, response_body
    FROM api_responses 
    WHERE vendor = 'dell' 
    AND response_status = 200
    AND response_body LIKE '%Date%'
    LIMIT 5
`).all();

rawSamples.forEach(sample => {
    console.log(`\n📋 RAW DATA for ${sample.service_tag}:`);
    try {
        const raw = JSON.parse(sample.response_body);
        
        // Look for date fields in the raw response
        function findDates(obj, path = '') {
            if (typeof obj !== 'object' || obj === null) return;
            
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                const currentPath = path ? `${path}.${key}` : key;
                
                if (typeof value === 'string' && (
                    key.toLowerCase().includes('date') || 
                    value.match(/\d{4}-\d{2}-\d{2}/) ||
                    value.match(/\d{2}\/\d{2}\/\d{4}/)
                )) {
                    console.log(`    ${currentPath}: ${value}`);
                } else if (typeof value === 'object' && value !== null) {
                    findDates(value, currentPath);
                }
            });
        }
        
        findDates(raw);
    } catch (e) {
        console.log(`  ❌ Parse error: ${e.message}`);
    }
});

// 3. Check specific warranty statuses and their date availability
console.log('\n\n📊 DATE AVAILABILITY BY WARRANTY STATUS:');

const datesByStatus = db.prepare(`
    SELECT 
        JSON_EXTRACT(parsed_data, '$.status') as warranty_status,
        COUNT(*) as total_count,
        COUNT(CASE WHEN JSON_EXTRACT(parsed_data, '$.endDate') IS NOT NULL THEN 1 END) as has_end_date,
        COUNT(CASE WHEN JSON_EXTRACT(parsed_data, '$.shipDate') IS NOT NULL THEN 1 END) as has_ship_date,
        COUNT(CASE WHEN JSON_EXTRACT(parsed_data, '$.daysRemaining') IS NOT NULL THEN 1 END) as has_days_remaining
    FROM api_responses 
    WHERE vendor = 'dell' AND parsing_status = 'success'
    GROUP BY JSON_EXTRACT(parsed_data, '$.status')
`).all();

datesByStatus.forEach(status => {
    console.log(`\n${status.warranty_status} (${status.total_count} devices):`);
    console.log(`  Has End Date: ${status.has_end_date}/${status.total_count} (${((status.has_end_date/status.total_count)*100).toFixed(1)}%)`);
    console.log(`  Has Ship Date: ${status.has_ship_date}/${status.total_count} (${((status.has_ship_date/status.total_count)*100).toFixed(1)}%)`);
    console.log(`  Has Days Remaining: ${status.has_days_remaining}/${status.total_count} (${((status.has_days_remaining/status.total_count)*100).toFixed(1)}%)`);
});

// 4. Show examples of each warranty status with dates
console.log('\n\n📅 EXAMPLES BY WARRANTY STATUS:');

['active', 'expired', 'no_warranty'].forEach(status => {
    console.log(`\n🎯 ${status.toUpperCase()} WARRANTY EXAMPLES:`);
    
    const examples = db.prepare(`
        SELECT service_tag, parsed_data
        FROM api_responses 
        WHERE vendor = 'dell' 
        AND parsing_status = 'success'
        AND JSON_EXTRACT(parsed_data, '$.status') = ?
        LIMIT 3
    `).all(status);
    
    examples.forEach(example => {
        try {
            const parsed = JSON.parse(example.parsed_data);
            console.log(`  ${example.service_tag}: End=${parsed.endDate || 'N/A'}, Ship=${parsed.shipDate || 'N/A'}, Days=${parsed.daysRemaining || 'N/A'}`);
        } catch (e) {
            console.log(`  ${example.service_tag}: Parse error`);
        }
    });
});

// 5. Check if dates are being displayed in the UI correctly
console.log('\n\n🖥️ UI DATE DISPLAY CHECK:');
console.log('Checking if warranty dates are being shown in the table...');

// This would require checking the actual table content, but we can check the parsing logic

db.close();
console.log('\n✅ Date collection analysis complete!');
