/**
 * Jest setup file for crypto tests
 * Provides IndexedDB mock and Web Crypto API polyfill
 */

import 'fake-indexeddb/auto';

// Polyfill crypto.subtle for Node environment
const { webcrypto } = require('crypto');
globalThis.crypto = webcrypto;
