/**
 * scripts/validate_openapi.js
 * Epic 35: OpenAPI Validation Script
 */

const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

const OPENAPI_PATH = path.join(__dirname, '../docs/api/openapi.yaml');

console.log('=== OpenAPI Validation ===\n');

try {
    // 1. File exists
    if (!fs.existsSync(OPENAPI_PATH)) {
        console.error('❌ FAIL: openapi.yaml not found');
        process.exit(1);
    }
    console.log('✅ File exists');

    // 2. Parse YAML
    const content = fs.readFileSync(OPENAPI_PATH, 'utf8');
    const spec = yaml.parse(content);
    console.log('✅ Valid YAML');

    // 3. Required fields
    const required = ['openapi', 'info', 'paths', 'components'];
    for (const field of required) {
        if (!spec[field]) {
            console.error(`❌ FAIL: Missing required field: ${field}`);
            process.exit(1);
        }
    }
    console.log('✅ Required fields present');

    // 4. Version check
    if (!spec.openapi.startsWith('3.')) {
        console.error('❌ FAIL: OpenAPI version must be 3.x');
        process.exit(1);
    }
    console.log(`✅ OpenAPI version: ${spec.openapi}`);

    // 5. Critical endpoints defined
    const criticalPaths = [
        '/relay/send.php',
        '/relay/pull.php',
        '/admin/v1/health_report.php'
    ];
    for (const p of criticalPaths) {
        if (!spec.paths[p]) {
            console.error(`❌ FAIL: Missing critical path: ${p}`);
            process.exit(1);
        }
    }
    console.log('✅ Critical endpoints defined');

    // 6. Schema count
    const schemaCount = Object.keys(spec.components.schemas || {}).length;
    console.log(`✅ Schemas defined: ${schemaCount}`);

    console.log('\n✅ PASS: OpenAPI spec is valid');
    process.exit(0);

} catch (e) {
    console.error(`❌ FAIL: ${e.message}`);
    process.exit(1);
}
