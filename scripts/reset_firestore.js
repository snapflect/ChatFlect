const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Firestore Reset Script
 * Usage: node scripts/reset_firestore.js
 * Requires: firebase-admin
 */

// 1. Path to your service account key
const serviceAccountPath = path.join(__dirname, '../secure-chat-backend/api/service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('CRITICAL: service-account.json not found at ' + serviceAccountPath);
    console.error('Please ensure the file exists before running this script.');
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// 2. Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Deletes all documents in a collection (including subcollections)
 */
async function deleteCollection(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function resetFirestore() {
    console.log('🚀 Starting Firestore Reset...');

    // Core collections to wipe for a fresh build
    const collections = ['users', 'chats', 'presence', 'discovery_cache', 'calls'];

    for (const collection of collections) {
        console.log(`🧹 Wiping collection: ${collection}...`);
        try {
            await deleteCollection(collection);
            console.log(`✅ ${collection} wiped.`);
        } catch (e) {
            console.error(`❌ Failed to wipe ${collection}:`, e.message);
        }
    }

    console.log('✨ Firestore Reset Complete.');
    process.exit(0);
}

// Trap errors
resetFirestore().catch(err => {
    console.error('💥 Reset Script Failed:', err);
    process.exit(1);
});
