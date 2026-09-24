import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePrintExecution, serializePrintExecution } from '../../src/data/fcs/printing-execution-storage.ts'

test('frozen printing images are losslessly stored once across orders, tasks and attachments', () => {
  const image = 'data:image/jpeg;base64,' + 'A'.repeat(112891)
  const record = { version: 1, state: { workOrders: [['print-1', { sourceSnapshot: { targetSpuImageUrl: image }, businessView: { product: { imageUrl: image } } }]] }, tasks: [{ sourceSnapshot: { targetSpuImageUrl: image, professionalResultAttachments: [{ dataUrl: image }] } }], designRevisionHandovers: [], note: '你好😀', imageUrl: '/fixture.jpg' }
  const raw = serializePrintExecution(record)
  assert.ok(raw.length < JSON.stringify(record).length / 3)
  assert.deepEqual(parsePrintExecution(raw), record)
  assert.deepEqual(parsePrintExecution(JSON.stringify(record)), record, 'old uncompressed records remain readable')
  assert.equal(serializePrintExecution(parsePrintExecution(raw) as object), raw)
})

test('missing or malformed image references fail rather than silently replacing frozen evidence', () => {
  assert.throws(() => parsePrintExecution(JSON.stringify({ imageDataUrls: ['data:image/png;base64,abc'], imageUrl: 'higoods-print-image:v1:2' })), /引用缺失/)
  assert.throws(() => parsePrintExecution(JSON.stringify({ imageDataUrls: ['invalid'] })), /格式不完整/)
  assert.deepEqual(parsePrintExecution(serializePrintExecution({ imageUrl: '/x.jpg', dataUrl: '' })), { imageUrl: '/x.jpg', dataUrl: '' })
})
