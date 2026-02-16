#!/bin/bash
# benchmark/run_certification.sh
# Epic 85: Benchmark Runner

echo "--- PHASE 14: PERFORMANCE CERTIFICATION ---"

# 1. Seeding
echo "[1/3] Seeding Database..."
php benchmark/seed_bench.php > benchmark/results/seed_log.txt

# 2. Execution
echo "[2/3] Running Load Tests..."
# If k6 is present, use it. Otherwise fallback to autocannon.
if command -v k6 &> /dev/null
then
    k6 run benchmark/k6/load_test.js --summary-export=benchmark/results/summary.json
else
    echo "k6 not found. Using autocannon fallback..."
    # Autocannon simple pull test
    autocannon -c 10 -d 30 -p 5 http://localhost/secure-chat-backend/api/v4/messages/pull.php \
      -H "Authorization: Bearer BENCHMARK_TOKEN_001" \
      -H "X-Mock-User: BENCH_USER_001" \
      --json > benchmark/results/summary.json
fi

# 3. Cleanup
echo "[3/3] Generating Report..."
echo "Done. Results saved to benchmark/results/summary.json"
