import test from 'node:test'
import assert from 'node:assert/strict'
import { createPdaTransferBagRepackState } from '../../src/pages/pda-cutting-transfer-bag-repack.ts'
import { localDateTimeText } from '../../src/utils.ts'

test('中转袋交出与实际入仓使用同一浏览器本地业务时间，不把 UTC 当作本地时间', context => {
  const originalZone = process.env.TZ
  // Only the isolated Node test switches timezone; browser acceptance keeps the real environment.
  process.env.TZ = 'Asia/Shanghai'
  context.mock.timers.enable({ apis:['Date'], now:Date.parse('2026-09-25T05:31:00Z') })
  try {
    const inboundAt = localDateTimeText().slice(0,16)
    assert.equal(inboundAt, '2026-09-25 13:31')
    assert.equal(createPdaTransferBagRepackState().occurredAt, inboundAt)
  } finally {
    context.mock.timers.reset()
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  }
})
