import assert from 'node:assert/strict'
import test from 'node:test'

import { createRetryableModuleLoader } from '../../src/main-infrastructure/retryable-module-loader.ts'

test('并发调用复用同一个模块加载 Promise，成功后继续复用结果', async () => {
  let loadCount = 0
  const load = createRetryableModuleLoader(async () => {
    loadCount += 1
    return { value: 'loaded' }
  })

  const first = load()
  const second = load()

  assert.equal(first, second)
  assert.deepEqual(await first, { value: 'loaded' })
  assert.deepEqual(await load(), { value: 'loaded' })
  assert.equal(loadCount, 1)
})

test('模块加载失败后清空缓存，下一次调用可以重试', async () => {
  let loadCount = 0
  const load = createRetryableModuleLoader(async () => {
    loadCount += 1
    if (loadCount === 1) throw new Error('temporary failure')
    return { value: 'recovered' }
  })

  await assert.rejects(load(), /temporary failure/)
  assert.deepEqual(await load(), { value: 'recovered' })
  assert.equal(loadCount, 2)
})
