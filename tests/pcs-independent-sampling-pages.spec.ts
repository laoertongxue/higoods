import assert from 'node:assert/strict'

import { renderPcsDesignSamplingListPage, renderPcsIndependentSamplingDetailPage, renderPcsIndependentSamplingProfessionalTaskPage, renderPcsRevisionSamplingListPage } from '../src/pages/pcs-independent-sampling.ts'
import { listEngineeringIndependentSamplingRecords, resetEngineeringIndependentSamplingRepository } from '../src/data/pcs-engineering-master-sampling.ts'

resetEngineeringIndependentSamplingRepository(true)
const revisionHtml = renderPcsRevisionSamplingListPage()
const designHtml = renderPcsDesignSamplingListPage()
assert.equal(listEngineeringIndependentSamplingRecords('REVISION').length, 12, '改款打样应提供足够分页演示数据')
assert.equal(listEngineeringIndependentSamplingRecords('DESIGN').length, 12, '设计打样应提供足够分页演示数据')
assert.match(revisionHtml, /改款打样任务/)
assert.match(designHtml, /设计打样任务/)
assert.match(revisionHtml, /data-standard-list-page/)
assert.match(revisionHtml, /data-pcs-independent-sampling-action="open-image"/)
assert.match(revisionHtml, /10 条\/\u9875/)
assert.match(revisionHtml, /下一页/, '改款打样列表必须有真实分页')
assert.match(designHtml, /下一页/, '设计打样列表必须有真实分页')
assert.doesNotMatch(revisionHtml, /\?kind=/)
const record = listEngineeringIndependentSamplingRecords('REVISION').find((item) => item.professionalTasks.length)!
const detailHtml = renderPcsIndependentSamplingDetailPage('REVISION', record.samplingTaskId)
assert.match(detailHtml, /基于款式（SPU）/)
assert.match(detailHtml, /做成款式（SPU）/)
assert.match(detailHtml, /BOM 与价格/)
assert.match(detailHtml, /\/pcs\/engineering\/sampling-professional\//)
const professionalHtml = renderPcsIndependentSamplingProfessionalTaskPage(record.professionalTasks[0].taskId)
assert.match(professionalHtml, /任务概要/)
assert.match(professionalHtml, /成果记录/)
assert.match(professionalHtml, /前置依赖/)

console.log('pcs-independent-sampling-pages.spec PASS')
