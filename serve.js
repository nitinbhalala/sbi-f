require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5052';
const PORT = process.env.PORT || 5053;

http.createServer((req, res) => {
    if (req.url === '/config.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(`window.BACKEND_URL = ${JSON.stringify(BACKEND_URL)};`);
        return;
    }

    const file = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, file);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'text/plain' });
        res.end(data);
    });
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT} (BACKEND_URL=${BACKEND_URL})`));
