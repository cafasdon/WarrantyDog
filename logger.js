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

/**
 * Winston Logger Configuration for WarrantyDog
 * 
 * Provides structured logging with multiple transports:
 * - Console: For development and Docker logs
 * - File: For production log persistence
 * - Error File: For error-level logs only
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels and colors
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

winston.addColors(logColors);

// Custom format for structured logging
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };

        if (stack) {
            logEntry.stack = stack;
        }

        return JSON.stringify(logEntry);
    })
);

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');

// Configure transports based on environment
const transports = [];

// Always add console transport
transports.push(
    new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
    })
);

// Add file transports for production or when LOG_TO_FILE is set
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
    // Combined log file
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'warrantydog.log'),
            level: 'info',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );

    // Error log file
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );
}

// Create the logger
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: logFormat,
    transports,
    exitOnError: false
});

// Create a stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

// Helper methods for common logging patterns
logger.apiRequest = (method, url, ip, userAgent) => {
    logger.http('API Request', {
        method,
        url,
        ip,
        userAgent,
        type: 'api_request'
    });
};

logger.apiResponse = (method, url, statusCode, responseTime, ip) => {
    logger.http('API Response', {
        method,
        url,
        statusCode,
        responseTime,
        ip,
        type: 'api_response'
    });
};

logger.vendorApiCall = (vendor, endpoint, statusCode, responseTime) => {
    logger.info('Vendor API Call', {
        vendor,
        endpoint,
        statusCode,
        responseTime,
        type: 'vendor_api'
    });
};

logger.databaseOperation = (operation, table, duration, recordCount) => {
    logger.debug('Database Operation', {
        operation,
        table,
        duration,
        recordCount,
        type: 'database'
    });
};

logger.securityEvent = (event, ip, userAgent, details) => {
    logger.warn('Security Event', {
        event,
        ip,
        userAgent,
        details,
        type: 'security'
    });
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
    logger.exceptions.handle(
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: logFormat
        })
    );

    logger.rejections.handle(
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: logFormat
        })
    );
}

export default logger;
