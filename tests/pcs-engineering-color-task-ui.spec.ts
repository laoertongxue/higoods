import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringTaskMaterialLine } from '../src/data/pcs-engineering-master-types.ts'
import { confirmEngineeringColorRequirements } from '../src/data/pcs-engineering-color-task-service.ts'
import { renderPcsColorTaskDetailPage } from '../src/pages/pcs-engineering-tasks/color-task.ts'
import { changeTaskUiPage } from '../src/pages/pcs-engineering-tasks/material-review-task-ui.ts'

function colorLine(index: number): EngineeringTaskMaterialLine {
  return {
    materialLineId: `COLOR-PAGED-${index}`,
    materialSkuId: `FAB-DYE-${index}`,
    materialName: `分页染色物料 ${index}`,
    materialType: '面料',
    requirementType: '染色',
    productColor: `颜色 ${index}`,
    status: '正常',
    resultFileIds: [],
    effectImageIds: [],
    resultSubmittedBy: '',
    resultSubmittedAt: '',
    reviewStatus: '待提交',
    reviewReason: '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

function countReadonlyRows(html: string): number {
  return html.match(/data-color-requirement-readonly-row=/g)?.length || 0
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)
const taskId = `${master.masterOrderId}-COLOR_FABRIC`

updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
  task.status = '未启用'
  task.materialLines = []
})
const disabledHtml = renderPcsColorTaskDetailPage(taskId)
assert.match(disabledHtml, /暂无染色物料/)
assert.doesNotMatch(disabledHtml, /data-review-ui-action="confirm-color"/)

updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
  task.status = '进行中'
  task.materialLines = []
})
const emptyHtml = renderPcsColorTaskDetailPage(taskId)
assert.match(emptyHtml, /暂无染色物料/)
assert.doesNotMatch(emptyHtml, /data-review-ui-action="confirm-color"/)

updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
  task.status = '进行中'
  task.materialLines = Array.from({ length: 10 }, (_, index) => colorLine(index + 1))
})
confirmEngineeringColorRequirements({
  masterOrderId: master.masterOrderId,
  taskId,
  confirmedBy: '跟单A',
  requirements: Array.from({ length: 10 }, (_, index) => ({
    materialLineId: `COLOR-PAGED-${index + 1}`,
    pantoneColorCode: `PANTONE-${index + 1}`,
    colorName: `颜色 ${index + 1}`,
    dyeColorCode: `DYE-${index + 1}`,
  })),
})

const firstPageHtml = renderPcsColorTaskDetailPage(taskId)
assert.equal(countReadonlyRows(firstPageHtml), 8, '确认后的只读阶段首屏只能渲染每页八条')
assert.doesNotMatch(firstPageHtml, /data-color-requirement-readonly-row="COLOR-PAGED-9"/)
assert.match(firstPageHtml, /共 10 条，第 1 \/ 2 页，每页 8 条/)

changeTaskUiPage('color', taskId, 2)
const secondPageHtml = renderPcsColorTaskDetailPage(taskId)
assert.equal(countReadonlyRows(secondPageHtml), 2, '翻页后只渲染第二页剩余两条')
assert.match(secondPageHtml, /data-color-requirement-readonly-row="COLOR-PAGED-9"/)
assert.match(secondPageHtml, /共 10 条，第 2 \/ 2 页，每页 8 条/)

console.log('pcs-engineering-color-task-ui.spec.ts PASS')
