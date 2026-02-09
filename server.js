// Local HTTP Server for Mirror - Hosts the mirror interface on a local IP

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

let server = null;
let serverPort = 8765;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start the server
function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Add Chromecast compatibility headers
      res.setHeader('X-Goog-Cast-Service', 'true');
      res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval';");

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // API endpoints
      if (req.url === '/api/info' && req.method === 'GET') {
        const info = {
          name: 'Webpage Mirror',
          version: '2.0.0',
          type: 'web-display',
          ip: getLocalIP(),
          port: serverPort,
          protocols: ['http', 'ws']
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(info));
        return;
      }

      if (req.url === '/api/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'active' }));
        return;
      }

      // Handle frame updates from background script
      if (req.url === '/api/frame' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            // Frame data is handled by the receiver
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      // Serve HTML file
      if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'mirror-server.html');
        fs.readFile(filePath, (err, content) => {
          if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        });
        return;
      }

      // Serve static files
      const filePath = path.join(__dirname, req.url);
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        let contentType = 'text/plain';
        if (req.url.endsWith('.js')) contentType = 'application/javascript';
        if (req.url.endsWith('.css')) contentType = 'text/css';
        if (req.url.endsWith('.json')) contentType = 'application/json';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.listen(serverPort, '0.0.0.0', () => {
      const localIP = getLocalIP();
      console.log(`Mirror server running at http://${localIP}:${serverPort}`);
      resolve({
        url: `http://${localIP}:${serverPort}`,
        ip: localIP,
        port: serverPort
      });
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
      reject(err);
    });
  });
}

// Stop the server
function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('Mirror server stopped');
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  startServer,
  stopServer,
  getLocalIP
};
