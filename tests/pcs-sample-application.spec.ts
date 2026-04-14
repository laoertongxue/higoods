import assert from 'node:assert/strict'
import { getSampleAssetById } from '../src/data/pcs-sample-asset-repository.ts'
import { listSampleUseRequests } from '../src/data/pcs-sample-application-repository.ts'
import {
  handlePcsSampleApplicationEvent,
  renderPcsSampleApplicationPage,
  resetPcsSampleApplicationState,
} from '../src/pages/pcs-sample-application.ts'

resetPcsSampleApplicationState()

const listHtml = renderPcsSampleApplicationPage()

assert.match(listHtml, /样衣使用申请/, '页面应渲染样衣使用申请标题')
assert.match(listHtml, /新建申请/, '页面应提供新建申请入口')
assert.match(listHtml, /待审批|使用中|归还中/, '页面应渲染状态汇总')

const submittedRequest = listSampleUseRequests().find((item) => item.status === 'SUBMITTED')
assert.ok(submittedRequest, '应存在待审批申请演示数据')

handlePcsSampleApplicationEvent({
  dataset: { pcsSampleApplicationAction: 'approve-request', requestId: submittedRequest.requestId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const reservedAssetId = submittedRequest.sampleAssetIds[0]
assert.equal(getSampleAssetById(reservedAssetId)?.inventoryStatus, '预占锁定', '审批通过后样衣应进入预占锁定')
assert.match(renderPcsSampleApplicationPage(), /已审批通过|预占锁定/, '审批通过后页面应反馈结果')

const approvedRequest = listSampleUseRequests().find((item) => item.requestCode === submittedRequest.requestCode)
assert.equal(approvedRequest?.status, 'APPROVED', '审批通过后申请状态应更新为已批准')

console.log('pcs-sample-application.spec.ts PASS')
