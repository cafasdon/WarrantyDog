import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Dell API proxy endpoint with OAuth 2.0 support
app.get('/api/dell/warranty/:serviceTag', async (req, res) => {
    try {
        const { serviceTag } = req.params;
        const apiKey = req.headers['x-dell-api-key'];
        const apiSecret = req.headers['x-dell-api-secret'];

        if (!apiKey || !apiSecret) {
            return res.status(400).json({
                error: 'Missing Dell API credentials. Both X-Dell-Api-Key and X-Dell-Api-Secret headers are required for OAuth 2.0 authentication.'
            });
        }

        if (!serviceTag) {
            return res.status(400).json({
                error: 'Missing service tag parameter'
            });
        }

        console.log(`Generating OAuth token for Dell API request: ${serviceTag}`);

        // Step 1: Generate OAuth 2.0 access token
        const authUrl = 'https://apigtwb2c.us.dell.com/auth/oauth/v2/token';
        const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

        const tokenResponse = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('OAuth token generation failed:', errorData);
            return res.status(401).json({
                error: 'Invalid Dell API key. Please check your API key configuration.',
                details: errorData
            });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        console.log(`OAuth token generated successfully, making warranty request for: ${serviceTag}`);

        // Step 2: Make warranty lookup request with Bearer token
        const warrantyUrl = `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements?servicetags=${serviceTag}`;

        const warrantyResponse = await fetch(warrantyUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        console.log(`Dell API Response Status: ${warrantyResponse.status}`);

        // Handle rate limiting (429 Too Many Requests)
        if (warrantyResponse.status === 429) {
            const retryAfter = warrantyResponse.headers.get('retry-after') ||
                              warrantyResponse.headers.get('x-ratelimit-reset') ||
                              warrantyResponse.headers.get('x-rate-limit-reset');

            const rateLimitInfo = {
                error: 'rate_limit_exceeded',
                message: 'Dell API rate limit exceeded',
                retryAfter: retryAfter,
                retryAfterSeconds: retryAfter ? parseInt(retryAfter) : 60, // Default to 60 seconds
                timestamp: new Date().toISOString(),
                serviceTag: serviceTag
            };

            console.log(`Rate limit exceeded for ${serviceTag}. Retry after: ${retryAfter || '60'} seconds`);
            return res.status(429).json(rateLimitInfo);
        }

        const warrantyData = await warrantyResponse.json();

        // Enhanced response with rate limit headers if available
        const responseData = {
            ...warrantyData,
            _metadata: {
                status: warrantyResponse.status,
                timestamp: new Date().toISOString(),
                serviceTag: serviceTag,
                rateLimitRemaining: warrantyResponse.headers.get('x-ratelimit-remaining'),
                rateLimitReset: warrantyResponse.headers.get('x-ratelimit-reset')
            }
        };

        // Return the response with proper status
        res.status(warrantyResponse.status).json(responseData);

    } catch (error) {
        console.error('Dell API proxy error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const healthCheck = {
        status: 'ok',
        message: 'WarrantyDog API proxy server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {
            api: 'operational',
            proxy: 'operational'
        }
    };

    res.status(200).json(healthCheck);
});

// Readiness check endpoint
app.get('/api/ready', (req, res) => {
    // Check if server is ready to accept requests
    const readinessCheck = {
        status: 'ready',
        message: 'WarrantyDog server is ready to accept requests',
        timestamp: new Date().toISOString(),
        checks: {
            server: 'ready',
            routes: 'loaded',
            middleware: 'initialized'
        }
    };

    res.status(200).json(readinessCheck);
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🐕 WarrantyDog API proxy server running on port ${PORT}`);
    console.log(`📡 Dell API proxy available at: http://localhost:${PORT}/api/dell/warranty/:serviceTag`);
    console.log(`🌐 Web interface available at: http://localhost:${PORT}`);
});
