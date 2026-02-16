// benchmark/step1_trigger_otp.js
const https = require('https');

const BASE_URL = 'https://chat.snapflect.com/api';
const EMAIL = process.argv[2] || 'official@snapflect.com'; // Default to official if not provided
const PHONE = '1555' + Math.floor(1000000 + Math.random() * 9000000);

if (!process.argv[2]) {
    console.log("Usage: node benchmark/step1_trigger_otp.js <your_email>");
    console.log("Using default test: " + EMAIL);
}

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(BASE_URL + path, options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ error: 'JSON', body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    console.log(`Triggering OTP for ${EMAIL}...`);
    const res = await request('POST', '/register.php', {
        email: EMAIL,
        phone_number: PHONE,
        action: 'registration'
    });
    console.log('Response:', res);

    if (res.status === 'sent') {
        console.log("\n✅ OTP Sent! Please check your email.");
        console.log("Then run: node benchmark/step2_verify_otp.js " + EMAIL + " <OTP_CODE>");
    }
}

run();
