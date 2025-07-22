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

        const warrantyData = await warrantyResponse.json();

        // Return the response with proper status
        res.status(warrantyResponse.status).json(warrantyData);

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
    res.json({ 
        status: 'ok', 
        message: 'WarrantyDog API proxy server is running',
        timestamp: new Date().toISOString()
    });
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
