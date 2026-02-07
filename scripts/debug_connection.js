const http = require('http');

const options = {
    hostname: 'localhost',
    port: 80,
    path: '/secure-chat-backend/api/relay/send.php',
    method: 'GET' // Should return 405 Method Not Allowed or 400
};

console.log('Testing connection to:', options.hostname + options.path);

const req = http.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', chunk => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', e => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
