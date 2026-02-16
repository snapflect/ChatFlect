// benchmark/load_generator.js
const autocannon = require('autocannon');
const fs = require('fs');

async function runBenchmark() {
    const targetUrl = 'https://chat.snapflect.com/api/v4/messages/pull.php';
    let token = 'BENCHMARK_TOKEN_Manual';

    // Load real token if available
    try {
        if (fs.existsSync('benchmark/tokens.json')) {
            const data = JSON.parse(fs.readFileSync('benchmark/tokens.json', 'utf8'));
            if (data.token) {
                token = data.token;
                console.log("Loaded Token for User:", data.user_id);
            }
        }
    } catch (e) { console.error("Could not load tokens.json", e); }

    console.log(`Starting benchmark for: ${targetUrl}`);
    console.log(`Using Token: ${token.substring(0, 10)}...`);

    const instance = autocannon({
        url: targetUrl,
        connections: 10,
        duration: 30,
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Benchmark-Mode': 'true'
        }
    }, (err, result) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(autocannon.format(result));
    });

    autocannon.track(instance, { renderProgressBar: true });
}

runBenchmark();
