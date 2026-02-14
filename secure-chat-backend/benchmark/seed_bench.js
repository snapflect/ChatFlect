// benchmark/seed_bench.js
// Node.js version of the seeding script
const mysql = require('mysql2/promise');

async function seed() {
    const config = {
        host: 'localhost', // Assuming we are on the server or tunnelled
        user: 'u668772406_chat_admin',
        password: 'MusMisMM@1',
        database: 'u668772406_secure_chat'
    };

    console.log("Seeding benchmark data via Node.js...");
    let connection;
    try {
        connection = await mysql.createConnection(config);

        // 1. Create Organization
        const orgId = Buffer.from(require('crypto').randomBytes(16));
        const orgIdHex = orgId.toString('hex');
        await connection.execute("INSERT IGNORE INTO organizations (org_id, name) VALUES (?, ?)", [orgId, 'Benchmark Org Node']);
        console.log(`Org Created: ${orgIdHex}`);

        // 2. Create Users
        console.log("Provisioning 100 users...");
        for (let i = 1; i <= 100; i++) {
            const userId = `NODE_BENCH_${i.toString().padStart(3, '0')}`;
            const sub = `google_node_bench_${i}`;
            const deviceUuid = `NODE_BENCH_DEVICE_${i}`;

            await connection.execute(
                "INSERT IGNORE INTO users (user_id, google_sub, org_id, display_name) VALUES (?, ?, ?, ?)",
                [userId, sub, orgId, `Node Bench User ${i}`]
            );
            await connection.execute(
                "INSERT IGNORE INTO user_devices (user_id, device_uuid, status) VALUES (?, ?, 'active')",
                [userId, deviceUuid]
            );
        }
        console.log("100 Users/Devices ready.");

        // 3. Create Broadcast List
        const listId = Buffer.from(require('crypto').randomBytes(16));
        await connection.execute(
            "INSERT INTO broadcast_lists (list_id, owner_id, name) VALUES (?, ?, ?)",
            [listId, 'NODE_BENCH_001', 'Node Heavy Broadcast']
        );

        // Add members
        for (let i = 2; i <= 100; i++) {
            const userId = `NODE_BENCH_${i.toString().padStart(3, '0')}`;
            await connection.execute(
                "INSERT INTO broadcast_list_members (list_id, member_id) VALUES (?, ?)",
                [listId, userId]
            );
        }
        console.log("Broadcast list 'Node Heavy Broadcast' created with 99 members.");

    } catch (err) {
        console.error("Seeding failed:", err);
    } finally {
        if (connection) await connection.end();
    }
}

seed();
