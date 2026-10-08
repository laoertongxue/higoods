import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { escapeHtml } from '../../src/utils'
import * as source from '../../src/data/production-timing/source'
import type { FollowupRecord } from '../../src/pages/production-fulfillment/followup-storage'

const code = ts.transpileModule(readFileSync(new URL('../../src/pages/production-fulfillment/timing-followups.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const caseId = 'PO-202610-0086'
type UI = {
  renderTimingFollowups(id: string): string
  handleTimingFollowupClick(target: HTMLElement, callback: () => void): boolean
  handleTimingFollowupField(target: HTMLElement): boolean
}

function harness(options: {
  load?: (state: { loaded: boolean; error: string }) => Promise<void>
  save?: (record: FollowupRecord, attempt: number, state: { loaded: boolean; error: string }, records: FollowupRecord[]) => Promise<void>
  records?: FollowupRecord[]
} = {}) {
  const state = { loaded: true, error: '', legacyCount: 0, legacyWarning: '' }, records = options.records ?? [], calls: FollowupRecord[] = []
  let loads = 0, updated = 0
  const storage = {
    async loadFollowups() { loads++; if (options.load) await options.load(state); else { state.loaded = true; state.error = '' } },
    readFollowups: () => records,
    followupStorageState: () => ({ ...state }),
    async saveFollowup(record: FollowupRecord, forecast?: unknown) {
      assert.equal(forecast, undefined, 'Follow-up feedback must not update forecast or source fact storage')
      calls.push({ ...record })
      if (options.save) await options.save(record, calls.length, state, records)
      else { records.push(record); state.loaded = true; state.error = '' }
    },
  }
  const module = { exports: {} }
  const context = vm.createContext({ module, exports: module.exports, Error, Intl, Date, Math, Promise, crypto: globalThis.crypto, require(id: string) {
    if (id === '../../utils') return { escapeHtml }
    if (id === '../../data/production-timing/source') return source
    if (id === './followup-storage') return storage
    throw new Error(`Unexpected dependency: ${id}`)
  } })
  vm.runInContext(code, context)
  const ui = module.exports as UI
  const root = { dataset: { timingFollowups: caseId }, innerHTML: '' }
  function field(key: string, value: string) {
    const element = { dataset: { timingFollowupField: key }, value, closest(selector: string) { return selector === '[data-timing-followups]' ? root : element } }
    return ui.handleTimingFollowupField(element as unknown as HTMLElement)
  }
  function click(action: string) {
    const element = { dataset: { timingFollowupAction: action }, closest(selector: string) { return selector === '[data-timing-followups]' ? root : element } }
    return ui.handleTimingFollowupClick(element as unknown as HTMLElement, () => { updated++ })
  }
  return { ui, state, records, calls, root, field, click, html: () => ui.renderTimingFollowups(caseId), loads: () => loads, updated: () => updated }
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve))
async function filled(h: ReturnType<typeof harness>) {
  h.html(); await settle()
  h.field('author', '陈静'); h.field('reason', '工厂反馈最后一批仍在加工'); h.field('action', '陈静与工厂确认完成时间，王明继续跟进')
}

test('opening a follow-up modal only reads, and empty inputs never appear saved', async () => {
  const h = harness(), before = h.html()
  assert.ok(before.includes('尚未填写，未保存'))
  await settle()
  assert.equal(h.loads(), 1)
  assert.equal(h.calls.length, 0)
  h.click('save'); await settle()
  assert.equal(h.calls.length, 0)
  assert.ok(h.html().includes('跟进人、原因和跟进动作都需要填写'))
  assert.ok(!h.html().includes('跟进记录已保存并核对'))
})

test('save waits for completion and readback, rejects double-click writes, and stores realtime feedback without a forecast', async () => {
  let finish: (() => void) | undefined
  const h = harness({ save: (record, _attempt, state, records) => new Promise<void>(resolve => { finish = () => { records.push(record); state.loaded = true; resolve() } }) })
  await filled(h)
  h.field('expectedAt', '2026-10-10T15:30')
  const started = Date.now()
  h.click('save'); h.click('save')
  assert.equal(h.calls.length, 1)
  assert.ok(h.html().includes('正在保存，请稍候'))
  assert.ok(!h.html().includes('跟进记录已保存并核对'))
  assert.equal(h.updated(), 0)
  finish!(); await settle()
  const record = h.records[0]
  assert.equal(record.expectedAt, '2026-10-10T07:30:00.000Z')
  assert.equal(record.nodeId, '')
  assert.ok(Date.parse(record.at) >= started)
  assert.ok(!record.at.startsWith('2026-10-07T01:00'), 'Registration time must not use the fixed demonstration ASOF')
  assert.ok(h.html().includes('跟进记录已保存并核对'))
  assert.ok(h.html().includes('预计时间仅作为反馈，不覆盖'))
  assert.equal(h.updated(), 1)
})

test('failed save retains all inputs and retries the exact same operation ID', async () => {
  const h = harness({ async save(record, attempt, state, records) { if (attempt === 1) throw new Error('空间不足，本次未保存')
    records.push(record); state.loaded = true
  } })
  await filled(h)
  h.click('save'); await settle()
  assert.ok(h.html().includes('空间不足，本次未保存'))
  assert.ok(h.html().includes('工厂反馈最后一批仍在加工'))
  assert.ok(h.html().includes('value="陈静"'))
  assert.equal(h.records.length, 0)
  h.field('author', '陈静') // Unchanged blur/change must not create a new operation ID.
  h.click('save'); await settle()
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[0].id, h.calls[1].id)
  assert.equal(h.calls[0].at, h.calls[1].at)
  assert.equal(h.records.length, 1)
  assert.ok(h.html().includes('跟进记录已保存并核对'))
})

test('commit followed by readback failure remains unconfirmed until a read proves the same record', async () => {
  const h = harness({ async save(record, _attempt, state, records) { records.push(record); state.loaded = false; state.error = '读回失败'; throw new Error('记录已提交，但读回失败；请重新读取确认') } })
  await filled(h)
  h.click('save'); await settle()
  assert.ok(h.html().includes('保存结果待确认，请重新读取'))
  h.click('save'); await settle()
  assert.equal(h.calls.length, 1)
  h.click('reload'); await settle()
  assert.ok(h.html().includes('跟进记录已保存并核对'))
  assert.equal(h.records.length, 1)
})

test('work must belong to the current production order and expected time must be valid', async () => {
  const h = harness()
  await filled(h)
  h.field('nodeId', 'PO-202610-0089/prep-086')
  h.click('save'); await settle()
  assert.equal(h.calls.length, 0)
  assert.ok(h.html().includes('对应工作不属于当前记录'))
  h.field('nodeId', ''); h.field('expectedAt', 'not-a-date')
  h.click('save'); await settle()
  assert.equal(h.calls.length, 0)
  assert.ok(h.html().includes('预计时间格式不正确'))
  h.field('expectedAt', '2026-02-30T15:00')
  h.click('save'); await settle()
  assert.equal(h.calls.length, 0)
  assert.ok(h.html().includes('预计时间无效'))
})

test('read failure retains a draft and does not treat unavailable records as a normal empty history', async () => {
  const h = harness({ async load(state) { state.loaded = false; state.error = 'IndexedDB 无法读取' } })
  h.html(); h.field('author', '陈静'); h.field('reason', '尚未保存的说明'); await settle()
  const html = h.html()
  assert.ok(html.includes('IndexedDB 无法读取'))
  assert.ok(html.includes('尚未保存的说明'))
  assert.ok(html.includes('跟进记录待成功读取'))
  assert.ok(!html.includes('当前记录暂无已保存的跟进记录'))
  assert.equal(h.calls.length, 0)
})

test('old logs are retained, but never assigned to a new production order by inference', async () => {
  const old: FollowupRecord = { id: 'old-log', taskId: 'DEM-202603-0001', nodeId: '', author: '旧记录人', at: '2026-10-06T00:00:00Z', reason: '旧需求跟进', action: '旧动作', expectedAt: '', kind: '旧记录' }
  const h = harness({ records: [old] })
  h.html(); await settle()
  const html = h.html()
  assert.ok(html.includes('不能确认归属的记录继续保留，待核实'))
  assert.ok(!html.includes('旧记录人') && !html.includes('旧需求跟进'))
  assert.equal(h.records[0], old)
  assert.equal(h.calls.length, 0)
})
