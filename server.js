import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseService from './database/DatabaseService.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database service
const dbService = new DatabaseService();
let dbInitialized = false;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large CSV files
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
    const dbHealth = dbService.healthCheck();

    const healthCheck = {
        status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
        message: 'WarrantyDog API proxy server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {
            api: 'operational',
            proxy: 'operational',
            database: dbHealth.status
        },
        database: dbHealth
    };

    res.status(200).json(healthCheck);
});

// Readiness check endpoint
app.get('/api/ready', (req, res) => {
    // Check if server is ready to accept requests
    const readinessCheck = {
        status: dbInitialized ? 'ready' : 'not_ready',
        message: 'WarrantyDog server is ready to accept requests',
        timestamp: new Date().toISOString(),
        checks: {
            server: 'ready',
            routes: 'loaded',
            middleware: 'initialized',
            database: dbInitialized ? 'ready' : 'initializing'
        }
    };

    res.status(dbInitialized ? 200 : 503).json(readinessCheck);
});

// Session Management API Endpoints

// Get active sessions
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = dbService.getActiveSessions();
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Get specific session with devices
app.get('/api/sessions/:sessionId', (req, res) => {
    try {
        const sessionData = dbService.getSessionResumeData(req.params.sessionId);
        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(sessionData);
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Create new session
app.post('/api/sessions', (req, res) => {
    try {
        const { sessionId, fileName, devices, options = {} } = req.body;

        // Check if session already exists
        try {
            const existingSession = dbService.getSession(sessionId);
            if (existingSession) {
                console.log(`Session ${sessionId} already exists, updating...`);
                // Update existing session instead of creating new one
                const result = dbService.insertDevicesWithDuplicateHandling(sessionId, devices, options);

                res.status(200).json({
                    sessionId,
                    message: 'Session updated successfully',
                    duplicateHandling: result
                });
                return;
            }
        } catch (error) {
            // Session doesn't exist, continue with creation
        }

        // Create new session
        dbService.createSession({
            id: sessionId,
            fileName: fileName,
            totalDevices: devices.length
        });

        // Insert devices with duplicate handling
        if (devices && devices.length > 0) {
            const result = dbService.insertDevicesWithDuplicateHandling(sessionId, devices, options);

            res.status(201).json({
                sessionId,
                message: 'Session created successfully',
                duplicateHandling: result
            });
        } else {
            res.status(201).json({ sessionId, message: 'Session created successfully' });
        }
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session', details: error.message });
    }
});

// Check for duplicates before creating session
app.post('/api/sessions/check-duplicates', (req, res) => {
    try {
        const { devices, maxAgeHours = 24 } = req.body;

        const result = dbService.findDuplicateDevices(devices, maxAgeHours);

        res.json({
            total: devices.length,
            duplicates: result.duplicates.length,
            fresh: result.fresh.length,
            duplicateDetails: result.duplicates.map(d => ({
                serialNumber: d.device.serialNumber,
                vendor: d.device.vendor,
                ageHours: d.ageHours,
                lastProcessed: d.existingData.last_processed_at,
                warrantyStatus: d.existingData.warranty_status
            }))
        });
    } catch (error) {
        console.error('Error checking duplicates:', error);
        res.status(500).json({ error: 'Failed to check duplicates' });
    }
});

// Update session progress
app.put('/api/sessions/:sessionId/progress', (req, res) => {
    try {
        const { processed, successful, failed, skipped } = req.body;

        dbService.updateSessionProgress(req.params.sessionId, {
            processed, successful, failed, skipped
        });

        res.json({ message: 'Session progress updated' });
    } catch (error) {
        console.error('Error updating session progress:', error);
        res.status(500).json({ error: 'Failed to update session progress' });
    }
});

// Complete session
app.put('/api/sessions/:sessionId/complete', (req, res) => {
    try {
        const { status = 'completed' } = req.body;

        dbService.completeSession(req.params.sessionId, status);

        res.json({ message: 'Session completed' });
    } catch (error) {
        console.error('Error completing session:', error);
        res.status(500).json({ error: 'Failed to complete session' });
    }
});

// Get retryable devices for a session
app.get('/api/sessions/:sessionId/retryable', (req, res) => {
    try {
        const devices = dbService.getRetryableDevices(req.params.sessionId);
        res.json(devices);
    } catch (error) {
        console.error('Error fetching retryable devices:', error);
        res.status(500).json({ error: 'Failed to fetch retryable devices' });
    }
});

// Database statistics endpoint
app.get('/api/database/stats', (req, res) => {
    try {
        const stats = dbService.getStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching database stats:', error);
        res.status(500).json({ error: 'Failed to fetch database statistics' });
    }
});

// Database cleanup endpoints
app.get('/api/database/cleanup/recommendations', (req, res) => {
    try {
        const recommendations = dbService.getCleanupRecommendations();
        res.json(recommendations);
    } catch (error) {
        console.error('Error fetching cleanup recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch cleanup recommendations' });
    }
});

app.post('/api/database/cleanup', (req, res) => {
    try {
        const { daysOld = 30 } = req.body;
        const result = dbService.performCleanup(daysOld);
        res.json({
            message: 'Database cleanup completed',
            result: result
        });
    } catch (error) {
        console.error('Error performing database cleanup:', error);
        res.status(500).json({ error: 'Failed to perform database cleanup' });
    }
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        console.log('Initializing database...');
        await dbService.initialize();
        dbInitialized = true;
        console.log('Database initialized successfully');

        // Start server
        app.listen(PORT, () => {
            console.log(`🐕 WarrantyDog API proxy server running on port ${PORT}`);
            console.log(`📡 Dell API proxy available at: http://localhost:${PORT}/api/dell/warranty/:serviceTag`);
            console.log(`🌐 Web interface available at: http://localhost:${PORT}`);
            console.log(`💾 Database: SQLite with persistent session management`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    dbService.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    dbService.close();
    process.exit(0);
});

startServer();
