import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSewingDeliverySlaPreviewModel,
  renderSewingDeliverySlaPreview,
} from '../src/components/sewing-delivery-sla-preview.ts'
import type { SewingDeliverySlaTaskLike } from '../src/data/fcs/sewing-delivery-sla.ts'

const independent: SewingDeliverySlaTaskLike = {
  taskUnitType: 'PROCESS_TASK',
  processCode: 'SEW',
  processBusinessCode: 'SEW',
  processNameZh: '车缝',
}

const sewingToPost: SewingDeliverySlaTaskLike = {
  taskUnitType: 'COMBINED_PROCESS_TASK',
  processCode: 'SEW',
  processNameZh: '车缝+后道',
  coveredProcesses: [
    { processCode: 'SEW', processName: '车缝', sourceArtifactIds: [] },
    { processCode: 'POST', processName: '后道', sourceArtifactIds: [] },
  ],
}

const independentModel = buildSewingDeliverySlaPreviewModel({
  task: independent,
  businessAssignedAt: '2026-07-17T10:00',
  assignedQty: 400,
  currentOperationAt: '2026-07-17 10:00:00',
})
assert.equal(independentModel.valid, true)
assert.equal(independentModel.kindLabel, '车缝')
assert.deepEqual(independentModel.rows.map((row) => row.deadlineAt), [
  '2026-07-26 10:00:00',
  '2026-07-21 10:00:00',
  '2026-07-25 10:00:00',
  '2026-07-26 10:00:00',
])

const continuousModel = buildSewingDeliverySlaPreviewModel({
  task: sewingToPost,
  businessAssignedAt: '2026-12-28T09:30',
  assignedQty: 1_000,
  currentOperationAt: '2026-12-28 09:30:00',
})
assert.equal(continuousModel.valid, true)
assert.equal(continuousModel.kindLabel, '车缝到后道')
assert.deepEqual(continuousModel.rows.map((row) => row.deadlineAt), [
  '2027-01-07 09:30:00',
  '2027-01-02 09:30:00',
  '2027-01-06 09:30:00',
  '2027-01-07 09:30:00',
])

const futureModel = buildSewingDeliverySlaPreviewModel({
  task: independent,
  businessAssignedAt: '2026-07-17T10:01',
  assignedQty: 400,
  currentOperationAt: '2026-07-17 10:00:00',
})
assert.equal(futureModel.valid, false)
assert.match(futureModel.error, /不能晚于当前时间/)
assert.equal(futureModel.rows.length, 0)

const html = renderSewingDeliverySlaPreview({
  task: independent,
  businessAssignedAt: '2026-07-17T10:00',
  assignedQty: 400,
  currentOperationAt: '2026-07-17 10:00:00',
})
for (const text of ['交付完成', '30% 回货', '70% 回货', '100% 回货', '按满 24 小时滚动', '仅接收方确认实收']) {
  assert.match(html, new RegExp(text))
}
assert.doesNotMatch(html, /实际操作时间/)

const sewingWorkbenchSource = readFileSync(
  new URL('../src/pages/sewing-dispatch-workbench.ts', import.meta.url),
  'utf8',
)
assert.match(sewingWorkbenchSource, /renderSewingDeliverySlaPreview/)
assert.match(sewingWorkbenchSource, /data-sewing-direct-sla-preview-slot/)
assert.match(sewingWorkbenchSource, /data-sewing-reassign-sla-preview-slot/)
assert.match(sewingWorkbenchSource, /refreshSewingReassignmentSlaPreview/)
assert.doesNotMatch(sewingWorkbenchSource, /function renderDirectDispatchDeadlines/)

const continuousDispatchSource = readFileSync(
  new URL('../src/pages/continuous-dispatch.ts', import.meta.url),
  'utf8',
)
assert.match(continuousDispatchSource, /renderSewingDeliverySlaPreview/)
assert.match(continuousDispatchSource, /data-continuous-sla-preview-slot/)
assert.match(continuousDispatchSource, /refreshContinuousDispatchSlaPreview/)
assert.match(continuousDispatchSource, /max-h-\[calc\(88vh-142px\)\]/)
assert.match(continuousDispatchSource, /previewModel\?\.supported/)
assert.match(continuousDispatchSource, /direct && containsSewing\(task\)/)
assert.match(continuousDispatchSource, /action === 'restore-column-settings'/)
assert.doesNotMatch(continuousDispatchSource, /function renderMilestonePreview/)
assert.doesNotMatch(continuousDispatchSource, /实际操作时间/)
assert.doesNotMatch(continuousDispatchSource, />分配数量</)

console.log('车缝派单统一时效预览检查通过')
