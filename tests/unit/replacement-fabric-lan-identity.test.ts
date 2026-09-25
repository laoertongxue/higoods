import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { cuttingRecordFingerprint, cuttingRecordUuid } from '../../src/data/fcs/cutting/cutting-record-identity.ts'

test('局域网 HTTP 的摘要与原生 SHA-256 相同，既有票号不变化', async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'crypto')
  try {
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)}})
    for(const value of ['', 'abc', '换片布/蓝色/5 Yard', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), '布'.repeat(10000)]) {
      assert.equal(await cuttingRecordFingerprint(value),createHash('sha256').update(value).digest('hex'))
    }
    const ids=Array.from({length:1000},()=>cuttingRecordUuid())
    assert.equal(new Set(ids).size,1000)
    assert.ok(ids.every(id=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)))
  } finally { if(original)Object.defineProperty(globalThis,'crypto',original) }
})
