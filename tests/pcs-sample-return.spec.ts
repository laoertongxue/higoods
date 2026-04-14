import assert from 'node:assert/strict'
import { getSampleAssetById } from '../src/data/pcs-sample-asset-repository.ts'
import { listSampleReturnCases } from '../src/data/pcs-sample-return-repository.ts'
import {
  handlePcsSampleReturnEvent,
  renderPcsSampleReturnPage,
  resetPcsSampleReturnState,
} from '../src/pages/pcs-sample-return.ts'

resetPcsSampleReturnState()

const listHtml = renderPcsSampleReturnPage()

assert.match(listHtml, /样衣退货与处理/, '页面应渲染样衣退货与处理标题')
assert.match(listHtml, /新建案件/, '页面应提供新建案件入口')
assert.match(listHtml, /处理中|超期未处理|已结案/, '页面应渲染案件汇总')

const returningCase = listSampleReturnCases().find((item) => item.caseStatus === 'RETURNING')
assert.ok(returningCase, '应存在退货中案件演示数据')

handlePcsSampleReturnEvent({
  dataset: { pcsSampleReturnAction: 'confirm-return', caseId: returningCase.caseId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

assert.equal(getSampleAssetById(returningCase.sampleAssetId)?.inventoryStatus, '已退货', '确认签收后样衣应更新为已退货')
assert.match(renderPcsSampleReturnPage(), /已确认退货签收|已退货/, '确认签收后页面应反馈结果')

console.log('pcs-sample-return.spec.ts PASS')
