import assert from 'node:assert/strict'

import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  handlePcsEngineeringMasterDetailEvent,
  renderPcsEngineeringMasterDetailPage,
} from '../src/pages/pcs-engineering-master-detail.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style, '必须存在款式档案演示数据')
const draft = createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单-林晓',
  createdBy: '跟单-林晓',
})

const draftHtml = renderPcsEngineeringMasterDetailPage(draft.masterOrderId)
assert.match(draftHtml, /任务方案确认/, '草稿工程主单首屏必须是任务方案确认')
assert.match(draftHtml, /系统建议/, '任务方案必须展示系统建议')
assert.match(draftHtml, /固定依赖/, '任务方案必须说明固定依赖不可调整')
assert.doesNotMatch(draftHtml, /data-engineering-lane-head=/, '确认前不能进入正式任务泳道')

const originalWindow = globalThis.window
const originalDocument = globalThis.document
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { pathname: `/pcs/engineering/masters/${draft.masterOrderId}` },
    dispatchEvent() { return true },
  },
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector() { return null },
    querySelectorAll() { return [] },
  },
})

const handled = handlePcsEngineeringMasterDetailEvent({
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      dataset: { pcsEngineeringMasterAction: 'confirm-task-plan' },
    }
  },
} as unknown as HTMLElement)
assert.equal(handled, true, '详情页必须处理跟单确认任务方案动作')

const confirmed = getEngineeringMasterOrderById(draft.masterOrderId)
assert.equal(confirmed?.status, '已发布', '确认任务方案后工程主单必须进入已发布')
assert.equal(confirmed?.taskPlanConfirmedBy, '跟单-林晓', '必须记录确认任务的跟单')
assert.ok(confirmed?.taskPlanConfirmedAt, '必须记录任务方案确认时间')
assert.equal(confirmed?.tasks.length, 10, '确认后必须一次性生成完整任务骨架')

Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })

console.log('pcs-engineering-master-task-plan-confirmation.spec.ts PASS')
