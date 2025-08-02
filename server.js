/*
 * Copyright 2025 Rodrigo Quintian (cafasdon)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

        // Store raw API response in database for caching and reprocessing
        let responseId = null;
        try {
            const requestData = {
                url: warrantyUrl,
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer [REDACTED]',
                    'Accept': 'application/json'
                }
            };

            const responseDataForStorage = {
                status: warrantyResponse.status,
                headers: Object.fromEntries(warrantyResponse.headers.entries()),
                body: warrantyData
            };

            const result = dbService.storeApiResponse('dell', serviceTag, requestData, responseDataForStorage);
            responseId = result.lastInsertRowid;
            console.log(`Stored API response for ${serviceTag} in database with ID: ${responseId}`);
        } catch (storageError) {
            console.error(`Failed to store API response for ${serviceTag}:`, storageError);
            // Continue processing even if storage fails
        }

        // Enhanced response with rate limit headers if available
        const responseData = {
            ...warrantyData,
            _metadata: {
                status: warrantyResponse.status,
                timestamp: new Date().toISOString(),
                serviceTag: serviceTag,
                responseId: responseId, // Include response ID for tracking parsing status
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

// Lenovo API proxy endpoint
app.post('/api/lenovo/warranty', async (req, res) => {
    try {
        const { Serial } = req.body;
        const clientId = req.headers['x-lenovo-client-id'];

        console.log(`🔍 Lenovo API proxy request for serial: ${Serial}`);
        console.log(`🔑 Using ClientID: ${clientId ? clientId.substring(0, 10) + '...' : 'not provided'}`);

        if (!clientId) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Lenovo ClientID is required'
            });
        }

        if (!Serial) {
            return res.status(400).json({
                error: 'Bad request',
                message: 'Serial number is required'
            });
        }

        // Prepare form data for Lenovo API
        const formData = new URLSearchParams();
        formData.append('Serial', Serial);

        console.log(`📡 Making request to Lenovo API...`);

        // Make request to Lenovo API
        const response = await fetch('https://supportapi.lenovo.com/v2.5/warranty', {
            method: 'POST',
            headers: {
                'ClientID': clientId,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'WarrantyDog/1.0'
            },
            body: formData
        });

        console.log(`📡 Lenovo API response status: ${response.status}`);

        // Get response data
        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const textData = await response.text();
            console.log(`📄 Lenovo API text response: ${textData}`);
            responseData = { message: textData };
        }

        console.log(`📊 Lenovo API response data:`, responseData);

        // Return the response with proper status
        res.status(response.status).json(responseData);

    } catch (error) {
        console.error('Lenovo API proxy error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Manual migration endpoint removed - automatic standardization now handles this during data storage

// Get cached warranty data endpoint
app.post('/api/cached-warranty', (req, res) => {
    try {
        const { vendor, serviceTag, maxAgeHours = 24 } = req.body;

        if (!vendor || !serviceTag) {
            return res.status(400).json({ error: 'vendor and serviceTag are required' });
        }

        const cachedResponse = dbService.getCachedApiResponse(vendor, serviceTag, maxAgeHours);

        if (cachedResponse && cachedResponse.parsing_status === 'success' && cachedResponse.parsed_data) {
            res.status(200).json({
                found: true,
                parsedData: cachedResponse.parsed_data,
                responseTimestamp: cachedResponse.response_timestamp,
                cacheAge: Math.round((Date.now() - new Date(cachedResponse.response_timestamp).getTime()) / 1000 / 60) // minutes
            });
        } else {
            res.status(200).json({
                found: false,
                reason: cachedResponse ?
                    (cachedResponse.parsing_status === 'failed' ? 'parsing_failed' : 'no_parsed_data') :
                    'not_cached'
            });
        }
    } catch (error) {
        console.error('Error getting cached warranty data:', error);
        res.status(500).json({ error: 'Failed to get cached warranty data' });
    }
});

// Update parsing status endpoint
app.post('/api/parsing-status', (req, res) => {
    try {
        const { responseId, status, parsedData, error } = req.body;

        if (!responseId || !status) {
            return res.status(400).json({ error: 'responseId and status are required' });
        }

        const result = dbService.updateApiResponseParsing(responseId, status, parsedData, error);

        res.status(200).json({
            success: true,
            message: 'Parsing status updated successfully',
            changes: result.changes
        });
    } catch (error) {
        console.error('Error updating parsing status:', error);
        res.status(500).json({ error: 'Failed to update parsing status' });
    }
});

// Get failed parsing responses for reprocessing
app.get('/api/failed-parsing', (req, res) => {
    try {
        const { vendor, limit = 100 } = req.query;
        const failedResponses = dbService.getFailedParsingResponses(vendor, parseInt(limit));

        res.status(200).json({
            success: true,
            count: failedResponses.length,
            responses: failedResponses
        });
    } catch (error) {
        console.error('Error getting failed parsing responses:', error);
        res.status(500).json({ error: 'Failed to get failed parsing responses' });
    }
});

// Get API response statistics
app.get('/api/response-stats', (req, res) => {
    try {
        const { vendor, hours = 24 } = req.query;
        const stats = dbService.getApiResponseStats(vendor, parseInt(hours));

        res.status(200).json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting API response stats:', error);
        res.status(500).json({ error: 'Failed to get API response stats' });
    }
});

// Reprocess failed parsing responses
app.post('/api/reprocess-parsing', (req, res) => {
    try {
        const { vendor, responseIds } = req.body;

        // Get failed responses to reprocess
        let responsesToReprocess;
        if (responseIds && responseIds.length > 0) {
            // Reprocess specific response IDs
            responsesToReprocess = responseIds.map(id => {
                const stmt = dbService.db.prepare('SELECT * FROM api_responses WHERE id = ?');
                return stmt.get(id);
            }).filter(Boolean);
        } else {
            // Reprocess all failed responses for vendor
            responsesToReprocess = dbService.getFailedParsingResponses(vendor);
        }

        const results = {
            total: responsesToReprocess.length,
            success: 0,
            failed: 0,
            details: []
        };

        // TODO: Implement actual reprocessing logic here
        // For now, just return the count of responses that would be reprocessed

        res.status(200).json({
            success: true,
            message: `Found ${results.total} responses ready for reprocessing`,
            results: results
        });
    } catch (error) {
        console.error('Error reprocessing parsing responses:', error);
        res.status(500).json({ error: 'Failed to reprocess parsing responses' });
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

// Device management endpoints
app.get('/api/sessions/:sessionId/devices/:serialNumber', (req, res) => {
    try {
        const { sessionId, serialNumber } = req.params;
        const device = dbService.findDeviceBySerial(sessionId, serialNumber);

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json(device);
    } catch (error) {
        console.error('Error finding device by serial:', error);
        res.status(500).json({ error: 'Failed to find device' });
    }
});

app.put('/api/devices/:deviceId/state', (req, res) => {
    try {
        const { deviceId } = req.params;
        const stateData = req.body;

        const result = dbService.updateDeviceState(deviceId, stateData);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error updating device state:', error);
        res.status(500).json({ error: 'Failed to update device state' });
    }
});

// Warranty data endpoints
app.get('/api/warranty-data/:serviceTag', (req, res) => {
    try {
        const { serviceTag } = req.params;
        const { vendor } = req.query;

        const warrantyData = dbService.getWarrantyData(serviceTag, vendor);

        if (!warrantyData) {
            return res.status(404).json({ error: 'Warranty data not found' });
        }

        res.json(warrantyData);
    } catch (error) {
        console.error('Error getting warranty data:', error);
        res.status(500).json({ error: 'Failed to get warranty data' });
    }
});

app.post('/api/warranty-data', (req, res) => {
    try {
        const warrantyData = req.body;

        const result = dbService.storeWarrantyData(warrantyData);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error storing warranty data:', error);
        res.status(500).json({ error: 'Failed to store warranty data' });
    }
});

// Bulk warranty data endpoint
app.post('/api/warranty-data/bulk', (req, res) => {
    try {
        const { devices } = req.body;

        if (!devices || !Array.isArray(devices)) {
            return res.status(400).json({ error: 'Invalid devices array' });
        }

        const bulkData = dbService.getBulkWarrantyData(devices);
        res.json(bulkData);
    } catch (error) {
        console.error('Error getting bulk warranty data:', error);
        res.status(500).json({ error: 'Failed to get bulk warranty data' });
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
            console.log(`📡 Lenovo API proxy available at: http://localhost:${PORT}/api/lenovo/warranty`);
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
