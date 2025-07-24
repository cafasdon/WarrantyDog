import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * Debug Tool: Analyze the 517 Failed Devices
 * Find out exactly why devices are failing
 */

const dbPath = './data/warrantydog.db';

if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('🔍 Analyzing the 517 Failed Devices\n');

// 1. Check API responses that might be causing failures
console.log('📊 API RESPONSE ANALYSIS:');

// Check for error responses
const errorResponses = db.prepare(`
    SELECT response_status, COUNT(*) as count
    FROM api_responses 
    GROUP BY response_status
    ORDER BY count DESC
`).all();

console.log('  Response status breakdown:');
errorResponses.forEach(resp => {
    console.log(`    HTTP ${resp.response_status}: ${resp.count} responses`);
});

// Check parsing status
const parsingStatus = db.prepare(`
    SELECT parsing_status, COUNT(*) as count
    FROM api_responses 
    GROUP BY parsing_status
`).all();

console.log('\n  Parsing status breakdown:');
parsingStatus.forEach(status => {
    console.log(`    ${status.parsing_status}: ${status.count} responses`);
});

// 2. Look at specific failed responses
console.log('\n🔍 SAMPLE FAILED API RESPONSES:');

// Check for responses that might indicate failures
const suspiciousResponses = db.prepare(`
    SELECT vendor, service_tag, response_status, parsing_status, 
           SUBSTR(response_body, 1, 200) as response_preview
    FROM api_responses 
    WHERE response_status != 200 OR parsing_status = 'failed'
    LIMIT 10
`).all();

if (suspiciousResponses.length > 0) {
    suspiciousResponses.forEach(resp => {
        console.log(`  ${resp.vendor}/${resp.service_tag}: HTTP ${resp.response_status}, Parse: ${resp.parsing_status}`);
        console.log(`    Response: ${resp.response_preview}...`);
    });
} else {
    console.log('  No obviously failed API responses found');
}

// 3. Check for patterns in successful vs failed service tags
console.log('\n🎯 SERVICE TAG PATTERNS:');

// Get sample of successful API responses
const successfulTags = db.prepare(`
    SELECT service_tag, parsed_data
    FROM api_responses 
    WHERE parsing_status = 'success' AND response_status = 200
    ORDER BY response_timestamp DESC
    LIMIT 10
`).all();

console.log('  Recent successful API responses:');
successfulTags.forEach(tag => {
    try {
        const parsed = JSON.parse(tag.parsed_data);
        console.log(`    ${tag.service_tag}: ${parsed.status} - ${parsed.message || 'N/A'}`);
    } catch (e) {
        console.log(`    ${tag.service_tag}: Parse error`);
    }
});

// 4. Check for Dell API specific issues
console.log('\n🔧 DELL API SPECIFIC ANALYSIS:');

// Look for Dell API error patterns
const dellErrors = db.prepare(`
    SELECT service_tag, response_body
    FROM api_responses 
    WHERE vendor = 'dell' AND (
        response_body LIKE '%error%' OR 
        response_body LIKE '%invalid%' OR
        response_body LIKE '%not found%' OR
        response_body LIKE '%unauthorized%'
    )
    LIMIT 5
`).all();

if (dellErrors.length > 0) {
    console.log('  Dell API error responses found:');
    dellErrors.forEach(error => {
        console.log(`    ${error.service_tag}: ${error.response_body.substring(0, 100)}...`);
    });
} else {
    console.log('  No obvious Dell API errors found');
}

// 5. Check for rate limiting or timeout patterns
console.log('\n⏱️ TIMING ANALYSIS:');

const timingAnalysis = db.prepare(`
    SELECT
        DATE(response_timestamp) as date,
        strftime('%H', response_timestamp) as hour,
        COUNT(*) as requests,
        AVG(CASE WHEN response_status = 200 THEN 1.0 ELSE 0.0 END) as success_rate
    FROM api_responses
    WHERE vendor = 'dell'
    GROUP BY DATE(response_timestamp), strftime('%H', response_timestamp)
    ORDER BY response_timestamp DESC
    LIMIT 5
`).all();

console.log('  Request timing patterns:');
timingAnalysis.forEach(timing => {
    console.log(`    ${timing.date} ${timing.hour}:00 - ${timing.requests} requests, ${(timing.success_rate * 100).toFixed(1)}% success`);
});

// 6. Check for specific service tag patterns that might be failing
console.log('\n🔍 SERVICE TAG FAILURE PATTERNS:');

// Look for patterns in service tags that might indicate why they're failing
const tagPatterns = db.prepare(`
    SELECT 
        SUBSTR(service_tag, 1, 1) as first_char,
        LENGTH(service_tag) as tag_length,
        COUNT(*) as count,
        AVG(CASE WHEN response_status = 200 THEN 1.0 ELSE 0.0 END) as success_rate
    FROM api_responses 
    WHERE vendor = 'dell'
    GROUP BY SUBSTR(service_tag, 1, 1), LENGTH(service_tag)
    HAVING count >= 5
    ORDER BY success_rate ASC
`).all();

console.log('  Service tag patterns (by first character and length):');
tagPatterns.forEach(pattern => {
    console.log(`    Tags starting with '${pattern.first_char}' (length ${pattern.tag_length}): ${pattern.count} tags, ${(pattern.success_rate * 100).toFixed(1)}% success`);
});

// 7. Check the actual parsed warranty data to see what's being returned
console.log('\n💾 PARSED WARRANTY DATA ANALYSIS:');

const warrantyStatuses = db.prepare(`
    SELECT 
        JSON_EXTRACT(parsed_data, '$.status') as warranty_status,
        COUNT(*) as count
    FROM api_responses 
    WHERE parsing_status = 'success' AND parsed_data IS NOT NULL
    GROUP BY JSON_EXTRACT(parsed_data, '$.status')
    ORDER BY count DESC
`).all();

console.log('  Warranty status distribution:');
warrantyStatuses.forEach(status => {
    console.log(`    ${status.warranty_status}: ${status.count} devices`);
});

// 8. Final summary
console.log('\n📈 SUMMARY:');
const summary = db.prepare(`
    SELECT 
        COUNT(*) as total_api_responses,
        COUNT(CASE WHEN response_status = 200 THEN 1 END) as http_success,
        COUNT(CASE WHEN parsing_status = 'success' THEN 1 END) as parse_success,
        COUNT(CASE WHEN JSON_EXTRACT(parsed_data, '$.status') = 'no_warranty' THEN 1 END) as no_warranty,
        COUNT(CASE WHEN JSON_EXTRACT(parsed_data, '$.status') = 'active' THEN 1 END) as active_warranty,
        COUNT(CASE WHEN JSON_EXTRACT(parsed_data, '$.status') = 'expired' THEN 1 END) as expired_warranty
    FROM api_responses 
    WHERE vendor = 'dell'
`).get();

console.log(`  Total Dell API responses: ${summary.total_api_responses}`);
console.log(`  HTTP 200 responses: ${summary.http_success}`);
console.log(`  Successfully parsed: ${summary.parse_success}`);
console.log(`  No warranty found: ${summary.no_warranty}`);
console.log(`  Active warranties: ${summary.active_warranty}`);
console.log(`  Expired warranties: ${summary.expired_warranty}`);

db.close();
console.log('\n✅ Failure analysis complete!');
