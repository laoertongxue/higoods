import assert from 'node:assert/strict'
import test from 'node:test'
import { waterCompletionInput, waterErrorText, waterNumber, type WaterWorkDraft } from '../../src/pages/central-pda/water-ui.ts'
type Fact = Parameters<typeof waterCompletionInput>[0]
const fact = (completedQty = 0, input = 10, plannedQty = 10) => ({ order: { completedQty, plannedQty }, input }) as Fact
const draft = (raw: string, changes: Partial<WaterWorkDraft> = {}): WaterWorkDraft => ({ raw, pause: false, reason: '', revision: 'current', decision: '', operationId: 'current', ...changes })

test('independent water records the whole-order cumulative amount; ordinary positive partial work does not silently pause', () => {
  assert.deepEqual(waterCompletionInput(fact(), draft('8'), 'zh'), { action: 'COMPLETE', completedQty: 8, reason: '' })
  assert.deepEqual(waterCompletionInput(fact(8), draft('9', { reason: 'older hidden note' }), 'zh'), { action: 'COMPLETE', completedQty: 9, reason: '' })
  assert.throws(() => waterCompletionInput(fact(8), draft('7'), 'zh'), /WATER_minimum/)
  assert.throws(() => waterCompletionInput(fact(), draft('11', { reason: 'checked' }), 'zh'), /WATER_maximum/)
})

test('actual zero, over-plan and an explicitly requested pause retain their required note', () => {
  for (const raw of ['0', '11']) assert.throws(() => waterCompletionInput(fact(0, 12), draft(raw), 'zh'), /WATER_noteRequired/)
  assert.throws(() => waterCompletionInput(fact(), draft('8', { pause: true }), 'zh'), /WATER_noteRequired/)
  assert.deepEqual(waterCompletionInput(fact(), draft('8', { pause: true, reason: 'Hasil lot ini' }), 'id'), { action: 'COMPLETE', completedQty: 8, reason: 'Hasil lot ini' })
  assert.deepEqual(waterCompletionInput(fact(0, 12), draft('11', { reason: 'Sudah diukur' }), 'id'), { action: 'COMPLETE', completedQty: 11, reason: 'Sudah diukur' })
})

test('Indonesian decimal input keeps the original numerical amount and native cumulative tolerance', () => {
  assert.deepEqual(waterCompletionInput(fact(), draft('8,5'), 'id'), { action: 'COMPLETE', completedQty: 8.5, reason: '' })
  assert.deepEqual(waterCompletionInput(fact(), draft('8.5'), 'zh'), { action: 'COMPLETE', completedQty: 8.5, reason: '' })
  assert.throws(() => waterCompletionInput(fact(), draft('Infinity'), 'id'))
  assert.throws(() => waterCompletionInput(fact(), draft('-1'), 'id'))
  assert.deepEqual(waterCompletionInput(fact(0, 9.999999999999), draft('10'), 'zh'), { action: 'COMPLETE', completedQty: 10, reason: '' })
})


test('whole cumulative completion keeps current precision in both languages', () => {
  assert.equal(waterNumber(8.123456, 'zh'), '8.123456')
  assert.equal(waterNumber(8.123456, 'id'), '8,123456')
})

test('C06.21: original receiving failures tell the Indonesian operator what to check without CJK or invented units', () => {
  for (const [message, meaning] of [
    ['原交出记录无法定位，请先核对上游单据。', /Catatan kiriman asal tidak ditemukan/],
    ['此交接已在其他接收入口登记，请核对原入仓记录，不能再次入仓。', /sudah diterima melalui halaman lain/],
    ['原交出单位与实收单位无法换算，请先核对计量单位。', /Satuan kirim dan terima tidak dapat dikonversi/],
    ['接收人与当前账号不一致，请重新登录。', /Akun penerima berubah/],
  ] as const) {
    const translated = waterErrorText(new Error(message), 'id')
    assert.match(translated, meaning)
    assert.doesNotMatch(translated, /[\u3400-\u9fff]/)
    assert.doesNotMatch(translated, /\d|kg|Yard/)
  }
})
