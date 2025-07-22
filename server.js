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

// Dell API proxy endpoint
app.get('/api/dell/warranty/:serviceTag', async (req, res) => {
    try {
        const { serviceTag } = req.params;
        const apiKey = req.headers['x-dell-api-key'];
        
        if (!apiKey) {
            return res.status(400).json({ 
                error: 'Missing Dell API key in X-Dell-Api-Key header' 
            });
        }

        if (!serviceTag) {
            return res.status(400).json({ 
                error: 'Missing service tag parameter' 
            });
        }

        console.log(`Proxying Dell API request for service tag: ${serviceTag}`);
        
        // Make request to Dell API
        const dellUrl = `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements?servicetags=${serviceTag}`;
        
        const response = await fetch(dellUrl, {
            method: 'GET',
            headers: {
                'X-Dell-Api-Key': apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        // Return the response with proper status
        res.status(response.status).json(data);
        
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
