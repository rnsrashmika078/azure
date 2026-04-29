const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Azure Configuration
const AZURE_CONFIG = {
    storageAccount: 'fileuploader12',
    containerName: 'rashmika',
    sasToken: 'sp=r&st=2026-04-29T06:18:39Z&se=2026-04-29T14:33:39Z&spr=https&sv=2025-11-05&sr=c&sig=4QPVYcO6wxm1YrvUk4QVr8Fz0sNt3C71UuG%2BOF10%2BiQ%3D'
};

const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/upload') {
        let body = [];
        
        req.on('data', chunk => body.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(body);
            
            // Parse the multipart form data manually
            const boundary = req.headers['content-type'].split('boundary=')[1];
            const parts = parseMultipart(buffer, boundary);
            
            if (!parts || parts.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No file found' }));
                return;
            }
            
            const filePart = parts.find(p => p.filename);
            if (!filePart) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No file uploaded' }));
                return;
            }
            
            const filename = filePart.filename;
            const fileContent = filePart.content;
            const contentType = filePart.contentType || 'application/octet-stream';
            
            // Upload to Azure Blob Storage
            uploadToAzure(filename, fileContent, contentType)
                .then(azureRes => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: `File "${filename}" uploaded successfully!`,
                        url: `https://${AZURE_CONFIG.storageAccount}.blob.core.windows.net/${AZURE_CONFIG.containerName}/${filename}`
                    }));
                })
                .catch(err => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);
    const endBoundary = Buffer.from('--' + boundary + '--');
    
    let start = 0;
    while (start < buffer.length) {
        let idx = buffer.indexOf(boundaryBuffer, start);
        if (idx === -1) break;
        
        let nextIdx = buffer.indexOf(boundaryBuffer, idx + boundaryBuffer.length);
        if (nextIdx === -1) nextIdx = buffer.indexOf(endBoundary, idx);
        if (nextIdx === -1) nextIdx = buffer.length;
        
        const partData = buffer.slice(idx + boundaryBuffer.length, nextIdx);
        
        // Find headers end (double CRLF)
        let headerEnd = -1;
        for (let i = 0; i < partData.length - 3; i++) {
            if (partData[i] === 0x0D && partData[i+1] === 0x0A && 
                partData[i+2] === 0x0D && partData[i+3] === 0x0A) {
                headerEnd = i;
                break;
            }
        }
        
        if (headerEnd > 0) {
            const headers = partData.slice(0, headerEnd).toString();
            const content = partData.slice(headerEnd + 4);
            
            // Parse filename and content-type
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
            
            if (filenameMatch) {
                parts.push({
                    filename: filenameMatch[1],
                    contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                    content: content
                });
            }
        }
        
        start = nextIdx;
    }
    
    return parts;
}

function uploadToAzure(filename, content, contentType) {
    return new Promise((resolve, reject) => {
        const url = `${AZURE_CONFIG.storageAccount}.blob.core.windows.net`;
        const path = `/${AZURE_CONFIG.containerName}/${filename}?${AZURE_CONFIG.sasToken}`;
        
        const options = {
            hostname: url,
            port: 443,
            path: path,
            method: 'PUT',
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2021-08-06',
                'Content-Type': contentType,
                'Content-Length': content.length
            }
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode === 201) {
                resolve(res);
            } else {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${data}`)));
            }
        });
        
        req.on('error', reject);
        req.write(content);
        req.end();
    });
}

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Upload endpoint: POST /upload');
});