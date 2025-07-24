import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * Debug Tool: Analyze Processing Flow
 * Track exactly what happens during processing
 */

const dbPath = './data/warrantydog.db';

if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('🔍 Analyzing Processing Flow and Cache Behavior\n');

// 1. Check the total counts and see if they add up
console.log('📊 PROCESSING COUNTS ANALYSIS:');

const totalApiResponses = db.prepare(`
    SELECT COUNT(*) as count FROM api_responses WHERE vendor = 'dell'
`).get();

const statusBreakdown = db.prepare(`
    SELECT 
        JSON_EXTRACT(parsed_data, '$.status') as warranty_status,
        COUNT(*) as count
    FROM api_responses 
    WHERE vendor = 'dell' AND parsing_status = 'success'
    GROUP BY JSON_EXTRACT(parsed_data, '$.status')
    ORDER BY count DESC
`).all();

console.log(`Total Dell API responses in database: ${totalApiResponses.count}`);
console.log('Warranty status breakdown:');
statusBreakdown.forEach(status => {
    console.log(`  ${status.warranty_status}: ${status.count}`);
});

// Calculate what the counts SHOULD be
const shouldBeSuccessful = statusBreakdown.reduce((sum, status) => sum + status.count, 0);
console.log(`\nShould be successful: ${shouldBeSuccessful} (all API responses)`);
console.log(`Actually reported as successful: 361`);
console.log(`Difference: ${shouldBeSuccessful - 361} devices not being counted correctly`);

// 2. Check for timing patterns in API responses
console.log('\n⏰ TIMING ANALYSIS:');

const recentApiCalls = db.prepare(`
    SELECT 
        service_tag,
        response_timestamp,
        JSON_EXTRACT(parsed_data, '$.status') as warranty_status
    FROM api_responses 
    WHERE vendor = 'dell'
    ORDER BY response_timestamp DESC 
    LIMIT 20
`).all();

console.log('Recent API calls:');
recentApiCalls.forEach(call => {
    const time = new Date(call.response_timestamp).toLocaleTimeString();
    console.log(`  ${call.service_tag}: ${call.warranty_status} at ${time}`);
});

// 3. Check for gaps in processing
console.log('\n🔍 PROCESSING GAPS ANALYSIS:');

// Look for time gaps in API responses that might indicate processing stops
const timeGaps = db.prepare(`
    SELECT 
        service_tag,
        response_timestamp,
        LAG(response_timestamp) OVER (ORDER BY response_timestamp) as prev_timestamp,
        (julianday(response_timestamp) - julianday(LAG(response_timestamp) OVER (ORDER BY response_timestamp))) * 24 * 60 as gap_minutes
    FROM api_responses 
    WHERE vendor = 'dell'
    ORDER BY response_timestamp DESC
    LIMIT 50
`).all();

const significantGaps = timeGaps.filter(gap => gap.gap_minutes > 5); // Gaps longer than 5 minutes

if (significantGaps.length > 0) {
    console.log('Significant time gaps found (>5 minutes):');
    significantGaps.forEach(gap => {
        console.log(`  ${gap.service_tag}: ${gap.gap_minutes.toFixed(1)} minute gap before this call`);
    });
} else {
    console.log('No significant time gaps found in recent API calls');
}

// 4. Check for duplicate processing
console.log('\n🔄 DUPLICATE PROCESSING CHECK:');

const duplicates = db.prepare(`
    SELECT 
        service_tag,
        COUNT(*) as call_count,
        GROUP_CONCAT(response_timestamp) as timestamps
    FROM api_responses 
    WHERE vendor = 'dell'
    GROUP BY service_tag
    HAVING COUNT(*) > 1
    ORDER BY call_count DESC
    LIMIT 10
`).all();

if (duplicates.length > 0) {
    console.log('Devices with multiple API calls:');
    duplicates.forEach(dup => {
        console.log(`  ${dup.service_tag}: ${dup.call_count} calls`);
    });
} else {
    console.log('No duplicate API calls found');
}

// 5. Check cache hit patterns
console.log('\n💾 CACHE PATTERN ANALYSIS:');

// Look at the distribution of API call timestamps to understand processing patterns
const hourlyDistribution = db.prepare(`
    SELECT 
        strftime('%H', response_timestamp) as hour,
        COUNT(*) as api_calls,
        COUNT(DISTINCT service_tag) as unique_devices
    FROM api_responses 
    WHERE vendor = 'dell'
    AND date(response_timestamp) = date('now')
    GROUP BY strftime('%H', response_timestamp)
    ORDER BY hour DESC
`).all();

console.log('API calls by hour today:');
hourlyDistribution.forEach(hour => {
    console.log(`  ${hour.hour}:00 - ${hour.api_calls} API calls for ${hour.unique_devices} devices`);
});

// 6. Check the actual device count in CSV vs processed
console.log('\n📋 DEVICE COUNT VERIFICATION:');

// This would require checking the actual CSV, but we can estimate from the logs
console.log('From the logs we know:');
console.log('  Total devices in CSV: 1504');
console.log('  Dell devices (estimated): ~1139 (based on non-skipped count)');
console.log('  API responses in DB: ' + totalApiResponses.count);
console.log('  Cache hits reported: 811');
console.log('  New API calls needed: ' + (1139 - totalApiResponses.count));

// 7. Check for processing bottlenecks
console.log('\n🚧 BOTTLENECK ANALYSIS:');

const processingStats = db.prepare(`
    SELECT 
        MIN(response_timestamp) as first_call,
        MAX(response_timestamp) as last_call,
        COUNT(*) as total_calls,
        (julianday(MAX(response_timestamp)) - julianday(MIN(response_timestamp))) * 24 * 60 as duration_minutes
    FROM api_responses 
    WHERE vendor = 'dell'
    AND date(response_timestamp) = date('now')
`).get();

if (processingStats.total_calls > 0) {
    console.log(`Processing session duration: ${processingStats.duration_minutes.toFixed(1)} minutes`);
    console.log(`API calls per minute: ${(processingStats.total_calls / processingStats.duration_minutes).toFixed(2)}`);
    console.log(`First call: ${processingStats.first_call}`);
    console.log(`Last call: ${processingStats.last_call}`);
}

db.close();
console.log('\n✅ Processing flow analysis complete!');
