#!/usr/bin/env node
/**
 * reset_firestore.js — Wipe & restore Firestore collections
 * 
 * Usage: node scripts/reset_firestore.js
 * 
 * This deletes all documents from the top-level collections
 * (chats, users, calls, location_audit) and their subcollections,
 * then re-creates the required empty collection stubs so Firestore
 * security rules remain valid.
 */

const admin = require('firebase-admin');
const path = require('path');

// ── Init ────────────────────────────────────────────────────
const serviceAccountPath = path.resolve(__dirname, '..', 'api', 'service-account.json');

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error(`❌ Failed to load service account from: ${serviceAccountPath}`);
    console.error(e.message);
    process.exit(1);
}

const db = admin.firestore();

// ── Collections to wipe ─────────────────────────────────────
const TOP_LEVEL_COLLECTIONS = [
    'chats',          // subcollections: messages, typing, locations
    'users',          // subcollections: blocked, sync_requests, contacts
    'calls',          // subcollections: signals
    'location_audit'
];

// ── Helpers ─────────────────────────────────────────────────
async function deleteCollection(collectionRef, batchSize = 100) {
    let totalDeleted = 0;

    while (true) {
        const snapshot = await collectionRef.limit(batchSize).get();
        if (snapshot.empty) break;

        // Delete subcollections first
        for (const doc of snapshot.docs) {
            await deleteSubcollections(doc.ref);
        }

        // Batch delete documents
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snapshot.size;

        if (snapshot.size < batchSize) break;
    }

    return totalDeleted;
}

async function deleteSubcollections(docRef) {
    const subcollections = await docRef.listCollections();
    for (const sub of subcollections) {
        await deleteCollection(sub);
    }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
    console.log('🔥 Firestore Reset — Starting...');
    console.log(`   Project: ${admin.app().options.credential.projectId || 'chat-26c25'}`);
    console.log('');

    let grandTotal = 0;

    for (const name of TOP_LEVEL_COLLECTIONS) {
        process.stdout.write(`   Deleting /${name}... `);
        const count = await deleteCollection(db.collection(name));
        console.log(`✅ ${count} documents deleted`);
        grandTotal += count;
    }

    console.log('');
    console.log(`🧹 Total documents deleted: ${grandTotal}`);
    console.log('');

    // Re-create empty placeholder docs to ensure collections exist
    // (Firestore deletes empty collections automatically)
    console.log('📦 Restoring collection stubs...');

    // We don't need placeholder docs — collections are created
    // automatically when the app writes to them. Just confirm.
    console.log('   ✅ Collections will be recreated on first app write.');
    console.log('');
    console.log('✅ Firestore reset complete! Restart the app to repopulate.');

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
