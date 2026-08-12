import assert from 'node:assert/strict'

import { renderPcsDesignSamplingListPage, renderPcsDisplaySampleTaskListPage, renderPcsIndependentSamplingDetailPage, renderPcsIndependentSamplingProfessionalTaskPage, renderPcsRevisionSamplingListPage } from '../src/pages/pcs-independent-sampling.ts'
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
assert.match(revisionHtml, /当前需处理的团队/)
assert.match(revisionHtml, /10 条\/\u9875/)
assert.match(revisionHtml, /下一页/, '改款打样列表必须有真实分页')
assert.match(designHtml, /下一页/, '设计打样列表必须有真实分页')
assert.doesNotMatch(revisionHtml, /\?kind=/)
const record = listEngineeringIndependentSamplingRecords('REVISION').find((item) => item.professionalTasks.length)!
const detailHtml = renderPcsIndependentSamplingDetailPage('REVISION', record.samplingTaskId)
assert.match(detailHtml, /A 款：基于款式（参考）/)
assert.match(detailHtml, /B 款：最终做成款式/)
assert.match(detailHtml, /BOM 与价格/)
assert.match(detailHtml, /本次需要完成的工作/)
assert.match(detailHtml, /\/pcs\/engineering\/sampling-professional\//)
const activeRecord = listEngineeringIndependentSamplingRecords('REVISION').find((item) => item.professionalTasks.some((task) => task.status === 'IN_PROGRESS'))!
const activeTask = activeRecord.professionalTasks.find((task) => task.status === 'IN_PROGRESS')!
const professionalHtml = renderPcsIndependentSamplingProfessionalTaskPage(activeTask.taskId)
assert.match(professionalHtml, /当前动作/)
assert.match(professionalHtml, /成果记录/)
assert.match(professionalHtml, /需要先完成/)
assert.match(professionalHtml, /完成后去向/)
assert.match(professionalHtml, /type="file"/, '专业任务必须通过真实文件选择器提交成果')
assert.doesNotMatch(professionalHtml, /图片地址|文件地址|resultImageUrls/)

const displaySampleHtml = renderPcsDisplaySampleTaskListPage()
assert.match(displaySampleHtml, /销售展示样衣任务/)
assert.match(displaySampleHtml, /当前需处理的团队/)
assert.match(displaySampleHtml, /data-standard-list-page/)
assert.doesNotMatch(displaySampleHtml, /产前版样衣/, '销售展示样衣和产前版样衣必须保持不同业务对象')

console.log('pcs-independent-sampling-pages.spec PASS')
