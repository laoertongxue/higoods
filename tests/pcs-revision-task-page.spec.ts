import assert from 'node:assert/strict'

import {
  getRevisionTaskById,
  resetRevisionTaskRepository,
  updateRevisionTask,
} from '../src/data/pcs-revision-task-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  renderPcsRevisionTaskDetailPage,
  renderPcsRevisionTaskPage,
  resetRevisionTaskPageState,
} from '../src/pages/pcs-engineering-tasks/revision-task.ts'

resetStyleArchiveRepository()
resetRevisionTaskRepository()
resetRevisionTaskPageState()

const revision = getRevisionTaskById('RT-20260108-002')
assert.ok(revision, '应存在改款任务演示数据')

updateRevisionTask(revision.revisionTaskId, {
  materialAdjustmentLines: [
    {
      lineId: 'revision-material-001',
      materialImageId: '',
      materialName: '天丝斜纹面料',
      materialSku: 'ML-TENCEL-001',
      printRequirement: '需要印花',
      quantity: 2.4,
      unitPrice: 26.5,
      amount: 63.6,
      note: '用于直播展示样衣',
    },
  ],
  patternChangeNote: '关联花型任务：PT-20260402-003\n关联调色任务：CT-20260402-002',
})

const listHtml = renderPcsRevisionTaskPage()
assert.match(listHtml, /改款与设计打样任务/, '列表必须清楚区分改款与设计打样')
assert.match(listHtml, /8 条\/页/, '标准列表必须保留分页')
assert.doesNotMatch(listHtml, /暂停|取消|异常|验收|历史任务|兼容/, '页面不得暴露已移除的任务语义')

const detailHtml = renderPcsRevisionTaskDetailPage(revision.revisionTaskId)
assert.match(detailHtml, /基于款式/, '改款详情必须展示源 SPU')
assert.match(detailHtml, /目标款式/, '改款详情必须展示目标 SPU')
assert.match(detailHtml, /天丝斜纹面料/, '详情必须展示本次样衣物料')
assert.match(detailHtml, /需要印花/, '详情必须展示物料工艺要求')
assert.match(detailHtml, /关联花型任务：PT-20260402-003/, '详情必须展示关联花型任务')
assert.match(detailHtml, /关联调色任务：CT-20260402-002/, '详情必须展示关联调色任务')
assert.doesNotMatch(detailHtml, /暂停|取消|异常|验收|历史任务|兼容/, '详情不得暴露已移除的任务语义')

console.log('pcs-revision-task-page.spec.ts PASS')
