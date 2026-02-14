// benchmark/setup_remote.js
// Registers a user on Production to get a valid token options.
const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://chat.snapflect.com/api';
const USER_EMAIL = 'benchmark_user_' + Date.now() + '@snapflect.com';
const USER_PHONE = '1555000' + Math.floor(1000 + Math.random() * 9000); // Dummy phone

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
                    console.log('Raw Body:', body);
                    resolve({ error: 'JSON_PARSE_ERROR', body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    console.log(`1. Registering ${USER_EMAIL}...`);
    const regRes = await request('POST', '/register.php', {
        email: USER_EMAIL,
        phone_number: USER_PHONE,
        action: 'registration'
    });
    console.log('Reg Result:', regRes);

    if (regRes.status !== 'sent') {
        console.error("Failed to send OTP. Exiting.");
        return;
    }

    // Since we can't read the email, we might be stuck unless the API returns the OTP in debug mode
    // or we use the fallback "123456" if configured?
    // Wait, `register.php` logic:
    // `if (mail(...)) ... else { ... "debug": "email_issue" }`
    // It doesn't return the OTP in the response unless checking logs or fallback enabled.

    // PIVOT: Does `register.php` allow a specific test-email to bypass OTP? 
    // Or can we use `api/v4/devices/register.php` directly if we "assume authenticated context"?
    // The code says: `$authData = requireAuth();` -> needs existing token.

    // BLOCKER: We cannot automate OTP retrieval from "official@snapflect.com" without access to that inbox.

    // ALTERNATIVE: Use existing known user? 
    // Or ask User to provide a token?

    console.log("\n⚠️ OTP Sent. Cannot retrieve automatically without Inbox Access.");
    console.log("Please provide a Valid JWT Token in benchmark/tokens.json manually.");
}

run();
