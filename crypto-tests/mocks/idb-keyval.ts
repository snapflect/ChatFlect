/**
 * Mock for idb-keyval in Node environment
 */

const store: Map<string, any> = new Map();

export async function get(key: string): Promise<any> {
    return store.get(key);
}

export async function set(key: string, value: any): Promise<void> {
    store.set(key, value);
}

export async function del(key: string): Promise<void> {
    store.delete(key);
}

export async function keys(): Promise<string[]> {
    return Array.from(store.keys());
}

export async function clear(): Promise<void> {
    store.clear();
}

// Helper for tests to reset state
export function __resetStore(): void {
    store.clear();
}
