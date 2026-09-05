import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readBrowserStorageItem,
  removeBrowserStorageItem,
  writeBrowserStorageItem,
  type BrowserStorageLike,
} from '../../src/data/browser-storage.ts'

test('浏览器存储封装保持读写删除语义', () => {
  const values = new Map<string, string>()
  const storage: BrowserStorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  assert.equal(writeBrowserStorageItem(storage, 'key', 'value'), true)
  assert.equal(readBrowserStorageItem(storage, 'key'), 'value')
  assert.equal(removeBrowserStorageItem(storage, 'key'), true)
  assert.equal(readBrowserStorageItem(storage, 'key'), null)
})

test('浏览器存储不可用或抛错时保持静默降级', () => {
  const brokenStorage: BrowserStorageLike = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }

  assert.equal(readBrowserStorageItem(brokenStorage, 'key'), null)
  assert.equal(writeBrowserStorageItem(brokenStorage, 'key', 'value'), false)
  assert.equal(removeBrowserStorageItem(brokenStorage, 'key'), false)
})
