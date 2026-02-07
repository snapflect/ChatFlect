/**
 * Firestore Security Rules Test Suite
 * Epic 7: Firestore Security Rules Audit & Hardening
 *
 * Run: firebase emulators:exec --only firestore "cd firestore-tests && npm test"
 */

const {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "chatflect-test";

let testEnv;

// Test users
const USER_A = "user_a";
const USER_B = "user_b";
const USER_C = "user_c";

// Test chat (participants: A and B)
const CHAT_AB = "chat_a_b";

describe("Firestore Security Rules", () => {
    before(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                rules: fs.readFileSync(
                    path.resolve(__dirname, "../firestore.rules"),
                    "utf8"
                ),
                host: "localhost",
                port: 8080,
            },
        });

        // Seed test data
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();

            // Create chat with participants A and B
            await db.doc(`chats/${CHAT_AB}`).set({
                participants: [USER_A, USER_B],
                lastMessage: "Hello",
                lastTimestamp: new Date(),
            });

            // Create a message in the chat
            await db.doc(`chats/${CHAT_AB}/messages/msg1`).set({
                senderId: USER_A,
                ciphertext: "encrypted_data",
                timestamp: new Date(),
            });

            // Create sync request for User A
            await db.doc("sync_requests/session123").set({
                targetUserId: USER_A,
                payload: "encrypted_key",
            });

            // Create device registry for User A
            await db.doc(`device_registry/${USER_A}/devices/device1`).set({
                status: "active",
                createdAt: new Date(),
            });
        });
    });

    after(async () => {
        await testEnv.cleanup();
    });

    // ==================================
    // TC-I-01: Cross-User Message Read
    // ==================================
    describe("TC-I-01: Cross-User Message Read", () => {
        it("should DENY reading messages for non-participant (User C)", async () => {
            const db = testEnv.authenticatedContext(USER_C).firestore();
            await assertFails(db.collection(`chats/${CHAT_AB}/messages`).get());
        });

        it("should ALLOW reading messages for participant (User A)", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertSucceeds(db.collection(`chats/${CHAT_AB}/messages`).get());
        });
    });

    // ==================================
    // TC-I-02: Sync Request Interception
    // ==================================
    describe("TC-I-02: Sync Request Interception", () => {
        it("should DENY reading sync request for wrong user (User B)", async () => {
            const db = testEnv.authenticatedContext(USER_B).firestore();
            await assertFails(db.doc("sync_requests/session123").get());
        });

        it("should ALLOW reading sync request for target user (User A)", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertSucceeds(db.doc("sync_requests/session123").get());
        });
    });

    // ==================================
    // TC-I-03: Chat Metadata Access
    // ==================================
    describe("TC-I-03: Chat Metadata Access", () => {
        it("should DENY reading chat metadata for non-participant (User C)", async () => {
            const db = testEnv.authenticatedContext(USER_C).firestore();
            await assertFails(db.doc(`chats/${CHAT_AB}`).get());
        });

        it("should ALLOW reading chat metadata for participant (User A)", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertSucceeds(db.doc(`chats/${CHAT_AB}`).get());
        });
    });

    // ==================================
    // TC-I-04: Write as Non-Participant
    // ==================================
    describe("TC-I-04: Write as Non-Participant", () => {
        it("should DENY writing message as non-participant (User C)", async () => {
            const db = testEnv.authenticatedContext(USER_C).firestore();
            await assertFails(
                db.collection(`chats/${CHAT_AB}/messages`).add({
                    senderId: USER_C,
                    ciphertext: "malicious",
                })
            );
        });

        // STRICT: Even participants cannot write messages (backend only)
        it("should DENY writing message even as participant (User A) - backend only", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertFails(
                db.collection(`chats/${CHAT_AB}/messages`).add({
                    senderId: USER_A,
                    ciphertext: "new_message",
                })
            );
        });
    });

    // ==================================
    // TC-I-05: Chat Metadata Write Block
    // ==================================
    describe("TC-I-05: Chat Metadata Write Block", () => {
        it("should DENY participant modifying chat metadata", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertFails(
                db.doc(`chats/${CHAT_AB}`).update({ lastMessage: "overwritten" })
            );
        });

        it("should DENY participant adding themselves as participant", async () => {
            const db = testEnv.authenticatedContext(USER_C).firestore();
            await assertFails(
                db.doc(`chats/${CHAT_AB}`).update({
                    participants: [USER_A, USER_B, USER_C],
                })
            );
        });
    });

    // ==================================
    // TC-I-06: Device Registry Protection
    // ==================================
    describe("TC-I-06: Device Registry Protection", () => {
        it("should DENY writing to device registry (client)", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertFails(
                db.doc(`device_registry/${USER_A}/devices/device2`).set({
                    status: "active",
                })
            );
        });

        it("should ALLOW reading own device registry", async () => {
            const db = testEnv.authenticatedContext(USER_A).firestore();
            await assertSucceeds(
                db.doc(`device_registry/${USER_A}/devices/device1`).get()
            );
        });

        it("should DENY reading other user's device registry", async () => {
            const db = testEnv.authenticatedContext(USER_B).firestore();
            await assertFails(
                db.doc(`device_registry/${USER_A}/devices/device1`).get()
            );
        });
    });

    // ==================================
    // TC-I-07: Unauthenticated Access
    // ==================================
    describe("TC-I-07: Unauthenticated Access", () => {
        it("should DENY all access for unauthenticated users", async () => {
            const db = testEnv.unauthenticatedContext().firestore();
            await assertFails(db.doc(`chats/${CHAT_AB}`).get());
            await assertFails(db.collection("users").get());
            await assertFails(db.collection("status").get());
        });
    });
});
