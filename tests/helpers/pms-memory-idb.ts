import { closePmsDb } from '../../src/data/pms/idb-storage.ts'

/** Narrow request/transaction facility for Node contracts. Real browser IDB is verified separately. */
export function installPmsMemoryIdb() {
  closePmsDb()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  const originalBroadcast = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel')
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })
  const makeDatabase = (version: number) => {
  const stores = new Map<string, { keyPath: string; rows: Map<unknown, unknown> }>()
  const db = {
    version,
    get objectStoreNames() { return Object.assign([...stores.keys()], { contains: (name: string) => stores.has(name) }) },
    createObjectStore(name: string, options: { keyPath: string }) { stores.set(name, { keyPath: options.keyPath, rows: new Map() }) },
    close() {},
    transaction(namesInput: string | string[], mode: string) {
      const names = typeof namesInput === 'string' ? [namesInput] : namesInput
      const writable = mode === 'readwrite'
      const draft = new Map(names.map(name => {
        const store = stores.get(name)
        if (!store) throw new Error(`Missing contract store ${name}`)
        return [name, { keyPath: store.keyPath, rows: new Map(store.rows) }]
      }))
      let pending = 0, finished = false
      const tx: any = { oncomplete: null, onabort: null, onerror: null, error: null }
      const settle = () => setImmediate(() => {
        if (pending || finished) return
        if (writable && failWrites) { tx.abort(); return }
        finished = true
        if (writable) for (const [name, store] of draft) stores.set(name, store)
        tx.oncomplete?.()
      })
      const request = (read: () => unknown) => {
        if (finished) throw new Error('TransactionInactiveError')
        pending += 1
        const req: any = { result: undefined, error: null, onsuccess: null, onerror: null }
        setImmediate(() => {
          if (finished) return
          try { req.result = read(); req.onsuccess?.() }
          catch (error) { req.error = error; req.onerror?.(); tx.error = error; tx.abort() }
          pending -= 1; settle()
        })
        return req
      }
      tx.abort = () => { if (finished) return; finished = true; tx.error ??= new Error('Contract write aborted'); setImmediate(() => tx.onabort?.()) }
      tx.objectStore = (name: string) => {
        const store = draft.get(name)
        if (!store) throw new Error(`Store outside transaction ${name}`)
        return {
          get: (key: unknown) => request(() => structuredClone(store.rows.get(key))),
          getAll: () => request(() => structuredClone([...store.rows.values()])),
          put: (value: Record<string, unknown>) => request(() => {
            if (!writable) throw new Error('ReadOnlyError')
            const key = value[store.keyPath]
            if (key == null) throw new Error('DataError')
            store.rows.set(key, structuredClone(value)); return key
          }),
          delete: (key: unknown) => request(() => { if (!writable) throw new Error('ReadOnlyError'); store.rows.delete(key) }),
          clear: () => request(() => { if (!writable) throw new Error('ReadOnlyError'); store.rows.clear() }),
          openCursor: () => {
            const entries = [...store.rows.entries()]; let index = 0
            const req: any = { result: undefined, onsuccess: null, onerror: null }
            const step = () => {
              pending += 1
              setImmediate(() => {
                if (finished) return
                const entry = entries[index++]
                req.result = entry ? { key: entry[0], value: structuredClone(entry[1]), continue: step } : null
                req.onsuccess?.(); pending -= 1; settle()
              })
            }
            step(); return req
          },
        }
      }
      settle(); return tx
    },
  }
  return { db, stores }
  }
  let failWrites = false
  const databases = new Map<string, ReturnType<typeof makeDatabase>>()
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open(name: string, version = 1) {
      const upgrade = !databases.has(name)
      if (upgrade) databases.set(name, makeDatabase(version))
      const { db } = databases.get(name)!
      const req: any = { result: db, onsuccess: null, onerror: null, onupgradeneeded: null }
      setImmediate(() => { if (upgrade) req.onupgradeneeded?.(); req.onsuccess?.() })
      return req
    },
  } })
  return {
    setFailWrites(fail: boolean) { failWrites = fail },
    restore() { closePmsDb(); if (original) Object.defineProperty(globalThis, 'indexedDB', original); else Reflect.deleteProperty(globalThis, 'indexedDB'); if (originalBroadcast) Object.defineProperty(globalThis, 'BroadcastChannel', originalBroadcast); else Reflect.deleteProperty(globalThis, 'BroadcastChannel') },
  }
}
