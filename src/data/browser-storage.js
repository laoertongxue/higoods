export function getBrowserLocalStorage() {
    const storage = typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
    return typeof storage?.getItem === 'function' ? storage : null;
}
export function getBrowserSessionStorage() {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    return typeof storage?.getItem === 'function' ? storage : null;
}
export function readBrowserStorageItem(storage, key) {
    try {
        return storage?.getItem(key) ?? null;
    }
    catch {
        return null;
    }
}
export function writeBrowserStorageItem(storage, key, value) {
    try {
        if (typeof storage?.setItem !== 'function')
            return false;
        storage.setItem(key, value);
        return true;
    }
    catch {
        return false;
    }
}
export function removeBrowserStorageItem(storage, key) {
    try {
        if (typeof storage?.removeItem !== 'function')
            return false;
        storage.removeItem(key);
        return true;
    }
    catch {
        return false;
    }
}
