# WarrantyDog API Documentation

## Overview

WarrantyDog provides warranty lookup functionality for various hardware vendors through their official APIs. The application handles rate limiting, error management, and provides a unified interface for warranty information retrieval.

## Supported Vendors

### Dell ✅ Implemented
- **API Endpoint**: `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements`
- **Rate Limit**: 60 requests/minute, 1000 requests/hour
- **Authentication**: API Key required (X-Dell-Api-Key header)
- **Identifier**: Service Tag
- **Status**: Fully implemented with error handling

#### Dell API Configuration
```javascript
// Set API key in browser console
localStorage.setItem('dell_api_key', 'your_dell_api_key_here');
```

#### Dell Response Format
```javascript
{
  serviceTag: "ABC1234",
  vendor: "Dell",
  status: "active|expired|not_found|error",
  warrantyType: "ProSupport Plus",
  startDate: "2023-01-15",
  endDate: "2026-01-15",
  daysRemaining: 365,
  isActive: true,
  model: "OptiPlex 7090",
  shipDate: "2023-01-10",
  allEntitlements: [...]
}
```

### Lenovo 🚧 Planned
- **Status**: Implementation planned
- **Identifier**: Serial Number
- **Rate Limit**: 30 requests/minute, 500 requests/hour (estimated)
- **Authentication**: TBD

### HP 🚧 Planned
- **Status**: Implementation planned
- **Identifier**: Serial Number
- **Rate Limit**: 40 requests/minute, 800 requests/hour (estimated)
- **Authentication**: TBD

## Rate Limiting

WarrantyDog implements intelligent rate limiting to respect vendor API quotas:

### Rate Limiter Features
- **Per-vendor tracking**: Each vendor has separate rate limits
- **Time-based windows**: Tracks requests per minute and per hour
- **Automatic throttling**: Prevents API calls when limits are reached
- **Wait time calculation**: Provides estimated wait times when throttled

### Rate Limit Status
```javascript
// Get rate limit status for a vendor
const status = warrantyService.getRateLimitStatus('dell');
console.log(status);
// {
//   canMakeRequest: true,
//   waitTime: 0,
//   requestsInLastMinute: 15,
//   requestsInLastHour: 245
// }
```

## Error Handling

### Error Types
- **401 Unauthorized**: Invalid API key
- **404 Not Found**: Service tag/serial not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Server Error**: Vendor API server error
- **Network Error**: Connection issues

### Error Response Format
```javascript
{
  serviceTag: "ABC1234",
  vendor: "Dell",
  status: "error",
  message: "Invalid Dell API key. Please check your API key configuration."
}
```

## Usage Examples

### Basic Warranty Lookup
```javascript
import { WarrantyLookupService } from './vendorApis.js';

const warrantyService = new WarrantyLookupService();

try {
  const result = await warrantyService.lookupWarranty('dell', 'ABC1234');
  console.log('Warranty info:', result);
} catch (error) {
  console.error('Lookup failed:', error.message);
}
```

### Batch Processing with Rate Limiting
```javascript
const devices = [
  { vendor: 'dell', serviceTag: 'ABC1234' },
  { vendor: 'dell', serviceTag: 'XYZ5678' },
  // ... more devices
];

for (const device of devices) {
  // Check rate limit before making request
  const status = warrantyService.getRateLimitStatus(device.vendor);
  
  if (!status.canMakeRequest) {
    console.log(`Rate limited, waiting ${status.waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, status.waitTime));
  }
  
  try {
    const result = await warrantyService.lookupWarranty(device.vendor, device.serviceTag);
    // Process result...
  } catch (error) {
    console.error(`Failed to lookup ${device.serviceTag}:`, error.message);
  }
}
```

## CSV File Format

### Required Columns
- `vendor`: Vendor name (dell, lenovo, hp)
- `service_tag` or `serial`: Device identifier

### Optional Columns
- `description`: Device description
- `location`: Device location
- `model`: Device model
- Any other custom fields

### Example CSV
```csv
vendor,service_tag,description,location
Dell,ABC1234,Dell OptiPlex 7090,Office-Floor1
Dell,XYZ5678,Dell Latitude 5520,Remote-User1
Lenovo,LEN001,ThinkPad X1 Carbon,Office-Floor2
HP,HP001,EliteBook 840 G8,Office-Floor3
```

## API Key Management

### Storage
API keys are stored in browser localStorage for security and persistence:

```javascript
// Set API key
localStorage.setItem('dell_api_key', 'your_key');

// Get API key
const apiKey = localStorage.getItem('dell_api_key');

// Remove API key
localStorage.removeItem('dell_api_key');
```

### Security Considerations
- Keys are stored locally in the browser
- No server-side storage or transmission
- Keys are only sent to official vendor APIs
- Use HTTPS for all API communications

## Development

### Adding New Vendors

1. **Create API Class**
   ```javascript
   class NewVendorAPI {
     constructor() {
       this.baseUrl = 'https://api.newvendor.com';
       this.rateLimiter = rateLimiters.newvendor;
     }
     
     async lookupWarranty(identifier) {
       // Implementation
     }
   }
   ```

2. **Update Factory**
   ```javascript
   // Add to VendorAPIFactory.createAPI()
   case 'newvendor':
     return new NewVendorAPI();
   ```

3. **Configure Rate Limits**
   ```javascript
   const RATE_LIMITS = {
     newvendor: {
       requestsPerMinute: 30,
       requestsPerHour: 500
     }
   };
   ```

### Testing

Use the provided sample CSV file for testing:
- `examples/sample-devices.csv`
- Contains test data for all supported vendors
- Safe for development and testing

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   - Error: "API key not configured"
   - Solution: Set API key in browser console

2. **Rate Limit Exceeded**
   - Error: "Rate limit exceeded"
   - Solution: Wait for rate limit window to reset

3. **Invalid Service Tag**
   - Error: "Service tag not found"
   - Solution: Verify service tag format and existence

4. **Network Issues**
   - Error: "Network error"
   - Solution: Check internet connection and vendor API status
