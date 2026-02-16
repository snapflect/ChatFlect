// benchmark/step2_verify_otp.js
const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://chat.snapflect.com/api';
const ARGS = process.argv.slice(2);
const EMAIL = ARGS[0];
const OTP = ARGS[1];

if (!EMAIL || !OTP) {
    console.error("Usage: node benchmark/step2_verify_otp.js <email> <otp>");
    process.exit(1);
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
                    console.log("Raw:", body);
                    resolve({ error: 'JSON_PARSE', body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    console.log(`Verifying OTP '${OTP}' for ${EMAIL}...`);

    // Dummy Identity Key (Base64 or Hex? DB is roughly text, usually Base64 in Signal)
    const dummyKey = "Pf" + Date.now() + "X" + Math.random().toString(36).substring(7);

    const res = await request('POST', '/profile.php', {
        action: 'confirm_otp',
        email: EMAIL,
        otp: OTP,
        public_key: dummyKey,
        device_uuid: 'BENCHMARK_DEVICE_001',
        device_name: 'Benchmark Node Runner',
        platform: 'web'
    });

    console.log('Result:', res);

    if (res.status === 'success' && res.token) {
        console.log("✅ Token Acquired!");
        const tokenData = {
            token: res.token,
            user_id: res.user_id,
            email: EMAIL,
            device_uuid: 'BENCHMARK_DEVICE_001'
        };
        fs.writeFileSync('benchmark/tokens.json', JSON.stringify(tokenData, null, 2));
        console.log("Saved to benchmark/tokens.json");
    } else {
        console.error("❌ Verification Failed.");
    }
}

run();
