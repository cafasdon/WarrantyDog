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

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import DatabaseService from './database/DatabaseService.js';
import logger from './logger.js';
import metrics from './metrics.js';
import type {
  WarrantyApiRequest,
  ApiErrorResponse,
  ApiSuccessResponse,
  HealthCheckResponse,
  SessionCreateRequest,
  SessionResponse,
  DeviceUpdateRequest,
  MetricsResponse,
  RequestWithMetrics
} from './types/api.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env['PORT'] || 3001;

// Initialize database service
const dbService = new DatabaseService();
let dbInitialized = false;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedding for development
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

// Apply rate limiting to API routes only
app.use('/api/', apiLimiter);

// Request logging and metrics middleware
app.use((req: Request & { startTime?: number; requestId?: string }, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  req.startTime = startTime;
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log incoming request
  logger.apiRequest(req.method, req.url, req.ip || '', req.get('User-Agent'));

  // Override res.end to capture response metrics
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const responseTime = Date.now() - startTime;

    // Record metrics
    metrics.recordRequest(req.method, req.url, res.statusCode, responseTime, req.ip);

    // Log response
    logger.apiResponse(req.method, req.url, res.statusCode, responseTime, req.ip || '');

    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
});

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large CSV files
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Serve compiled frontend files from dist/frontend
app.use(express.static('./dist/frontend'));

// Dell API proxy endpoint with OAuth 2.0 support
app.get('/api/dell/warranty/:serviceTag', async (req: Request, res: Response) => {
  try {
    const { serviceTag } = req.params;
    const apiKey = req.headers['x-dell-api-key'] as string;
    const apiSecret = req.headers['x-dell-api-secret'] as string;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        error: 'Missing Dell API credentials. Both X-Dell-Api-Key and X-Dell-Api-Secret headers are required for OAuth 2.0 authentication.'
      } as ApiErrorResponse);
    }

    if (!serviceTag) {
      return res.status(400).json({
        error: 'Missing service tag parameter'
      } as ApiErrorResponse);
    }

    console.log(`🔍 Dell API proxy request for service tag: ${serviceTag}`);
    console.log(`🔑 Using API Key: ${apiKey.substring(0, 10)}...`);

    // Step 1: Get OAuth 2.0 token
    const tokenUrl = 'https://apigtwb2c.us.dell.com/auth/oauth/v2/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: `client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(apiSecret)}&grant_type=client_credentials`
    });

    console.log(`🔐 Dell OAuth token response status: ${tokenResponse.status}`);

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Dell OAuth token error:', tokenError);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid Dell API credentials or OAuth token request failed',
        details: tokenError
      } as ApiErrorResponse);
    }

    const tokenData = await tokenResponse.json() as { access_token: string; token_type: string };
    console.log(`✅ Dell OAuth token obtained: ${tokenData.token_type} ${tokenData.access_token.substring(0, 20)}...`);

    // Step 2: Make warranty API call
    const warrantyUrl = `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements?servicetags=${serviceTag}`;
    const warrantyResponse = await fetch(warrantyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `${tokenData.token_type} ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    console.log(`📡 Dell warranty API response status: ${warrantyResponse.status}`);

    const warrantyData = await warrantyResponse.json();
    console.log(`📊 Dell warranty API response:`, warrantyData);

    // Return the warranty data with proper status
    return res.status(warrantyResponse.status).json(warrantyData);

  } catch (error) {
    console.error('Dell API proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    } as ApiErrorResponse);
  }
});

// Lenovo API proxy endpoint
app.post('/api/lenovo/warranty', async (req: Request, res: Response) => {
  try {
    const { Serial } = req.body;
    const clientId = req.headers['x-lenovo-client-id'] as string;

    console.log(`🔍 Lenovo API proxy request for serial: ${Serial}`);
    console.log(`🔑 Using ClientID: ${clientId ? clientId.substring(0, 10) + '...' : 'not provided'}`);

    if (!clientId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Lenovo ClientID is required'
      } as ApiErrorResponse);
    }

    if (!Serial) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Serial number is required'
      } as ApiErrorResponse);
    }

    // Make request to Lenovo API
    const lenovoUrl = 'https://supportapi.lenovo.com/v2.5/warranty';
    const response = await fetch(lenovoUrl, {
      method: 'POST',
      headers: {
        'ClientID': clientId,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: `Serial=${encodeURIComponent(Serial)}`
    });

    console.log(`📡 Lenovo API response status: ${response.status}`);

    // Get response data
    let responseData: any;
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
    return res.status(response.status).json(responseData);

  } catch (error) {
    console.error('Lenovo API proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    } as ApiErrorResponse);
  }
});

// Get cached warranty data endpoint
app.get('/api/warranty-cache/:vendor/:serviceTag', (req: Request, res: Response) => {
  try {
    const vendor = req.params['vendor'];
    const serviceTag = req.params['serviceTag'];
    const maxAgeHours = parseInt(req.query['maxAge'] as string) || 24;

    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    if (!vendor || !serviceTag) {
      return res.status(400).json({ error: 'Vendor and service tag are required' });
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
      return res.status(200).json({
        found: false,
        reason: cachedResponse ?
          (cachedResponse.parsing_status === 'failed' ? 'parsing_failed' : 'no_parsed_data') :
          'not_cached'
      });
    }
  } catch (error) {
    console.error('Error getting cached warranty data:', error);
    return res.status(500).json({ error: 'Failed to get cached warranty data' });
  }
});

// Update parsing status endpoint
app.post('/api/parsing-status', (req: Request, res: Response) => {
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

// Store warranty data endpoint
app.post('/api/warranty-data', (req: Request, res: Response) => {
  try {
    const warrantyData = req.body;

    if (!warrantyData.vendor || !warrantyData.serialNumber) {
      return res.status(400).json({
        error: 'Missing required fields: vendor and serialNumber are required'
      });
    }

    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const result = dbService.storeWarrantyData(warrantyData);

    res.status(200).json({
      success: true,
      message: 'Warranty data stored successfully',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error storing warranty data:', error);
    res.status(500).json({ error: 'Failed to store warranty data' });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const dbHealth = dbService.healthCheck();

  const healthCheck: HealthCheckResponse = {
    status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
    message: 'WarrantyDog API proxy server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
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

// Metrics endpoint for operational monitoring
app.get('/api/metrics', (req: Request, res: Response) => {
  try {
    const metricsData = metrics.getMetrics();
    res.status(200).json(metricsData);
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: (error as Error).message
    });
  }
});

// Readiness check endpoint
app.get('/api/ready', (req: Request, res: Response) => {
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
app.get('/api/sessions', (req: Request, res: Response) => {
  try {
    const sessions = dbService.getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get specific session with devices
app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    const sessionData = dbService.getSessionSummary(sessionId);
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
app.post('/api/sessions', (req: Request<{}, SessionResponse, SessionCreateRequest>, res: Response<SessionResponse>) => {
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
    res.status(500).json({ error: 'Failed to create session', details: (error as Error).message } as any);
  }
});

// Get session devices
app.get('/api/sessions/:sessionId/devices', (req: Request, res: Response) => {
  try {
    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    const devices = dbService.getSessionDevices(sessionId);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching session devices:', error);
    res.status(500).json({ error: 'Failed to fetch session devices' });
  }
});

// Update session progress
app.put('/api/sessions/:sessionId/progress', (req: Request, res: Response) => {
  try {
    const { processed, successful, failed, skipped } = req.body;

    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    dbService.updateSessionProgress(sessionId, {
      processed, successful, failed, skipped
    });

    res.json({ message: 'Session progress updated' });
  } catch (error) {
    console.error('Error updating session progress:', error);
    res.status(500).json({ error: 'Failed to update session progress' });
  }
});

// Complete session
app.put('/api/sessions/:sessionId/complete', (req: Request, res: Response) => {
  try {
    const { status = 'completed' } = req.body;

    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    dbService.completeSession(sessionId, status);

    res.json({ message: 'Session completed' });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// Database statistics endpoint
app.get('/api/database/stats', (req: Request, res: Response) => {
  try {
    const stats = dbService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

// Device management endpoints
app.get('/api/sessions/:sessionId/devices/:serialNumber', (req: Request, res: Response) => {
  try {
    const sessionId = req.params['sessionId'];
    const serialNumber = req.params['serialNumber'];

    if (!sessionId || !serialNumber) {
      return res.status(400).json({ error: 'Session ID and serial number are required' });
    }
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

// Update device warranty data
app.put('/api/sessions/:sessionId/devices/:deviceId', (req: Request<{ sessionId: string; deviceId: string }, {}, DeviceUpdateRequest>, res: Response) => {
  try {
    const deviceId = parseInt(req.params.deviceId);
    const { warrantyData } = req.body;

    if (isNaN(deviceId)) {
      return res.status(400).json({ error: 'Invalid device ID' });
    }

    dbService.updateDeviceState(deviceId, {
      processing_state: warrantyData.processingState,
      vendor: warrantyData.vendor,
      model: warrantyData.model,
      warranty_status: warrantyData.warrantyStatus,
      warranty_end_date: warrantyData.warrantyEndDate,
      error_message: warrantyData.errorMessage
    });

    res.json({ message: 'Device updated successfully' });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// Database cleanup endpoints
app.get('/api/database/cleanup/recommendations', (req: Request, res: Response) => {
  try {
    const recommendations = dbService.getCleanupRecommendations();
    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching cleanup recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch cleanup recommendations' });
  }
});

app.post('/api/database/cleanup', (req: Request, res: Response) => {
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
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Initialize database and start server
async function startServer(): Promise<void> {
  try {
    // Initialize database
    console.log('Initializing database...');
    await dbService.initialize();
    dbInitialized = true;
    logger.info('Database initialized successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🐕 WarrantyDog API proxy server running on port ${PORT}`, {
        port: PORT,
        environment: process.env['NODE_ENV'] || 'development',
        nodeVersion: process.version
      });
      logger.info(`📡 Dell API proxy available at: http://localhost:${PORT}/api/dell/warranty/:serviceTag`);
      logger.info(`📡 Lenovo API proxy available at: http://localhost:${PORT}/api/lenovo/warranty`);
      logger.info(`🌐 Web interface available at: http://localhost:${PORT}`);
      logger.info(`💾 Database: SQLite with persistent session management`);
      logger.info(`📊 Metrics endpoint available at: http://localhost:${PORT}/api/metrics`);
    });
  } catch (error) {
    logger.error('Failed to start server:', { error: (error as Error).message, stack: (error as Error).stack });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\nShutting down gracefully...');
  dbService.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\nShutting down gracefully...');
  dbService.close();
  process.exit(0);
});

startServer();
