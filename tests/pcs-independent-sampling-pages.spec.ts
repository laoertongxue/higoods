import assert from 'node:assert/strict'

import { renderPcsDesignSamplingListPage, renderPcsDisplaySampleTaskListPage, renderPcsIndependentSamplingDetailPage, renderPcsIndependentSamplingProfessionalTaskPage, renderPcsRevisionSamplingListPage } from '../src/pages/pcs-independent-sampling.ts'
import { CURRENT_PCS_ENGINEERING_USER } from '../src/data/pcs-engineering-current-user.ts'
import { createEngineeringIndependentSampling, getEngineeringIndependentSamplingStep, listEngineeringIndependentSamplingRecords, resetEngineeringIndependentSamplingRepository } from '../src/data/pcs-engineering-master-sampling.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'

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
assert.equal((revisionHtml.match(/data-pcs-independent-sampling-action="open-column-settings"/g) ?? []).length, 1, '列设置只允许出现在数据列表表头最右侧')
assert.ok(
  revisionHtml.indexOf('data-pcs-independent-sampling-action="open-column-settings"') > revisionHtml.indexOf('data-standard-list-table-section'),
  '列设置必须位于数据列表区域内，而不是页面标题区',
)

const buyerRecord = listEngineeringIndependentSamplingRecords('REVISION').find((item) => getEngineeringIndependentSamplingStep(item) === 'BUYER_PREPARATION')!
const buyerDetailHtml = renderPcsIndependentSamplingDetailPage('REVISION', buyerRecord.samplingTaskId)
assert.match(buyerDetailHtml, /A 款：基于款式（参考）/)
assert.match(buyerDetailHtml, /B 款：最终做成款式/)
assert.match(buyerDetailHtml, /新款资料准备/)
assert.match(buyerDetailHtml, /目标颜色与参考色/)
assert.match(buyerDetailHtml, /BOM 与价格/)
assert.match(buyerDetailHtml, /新增颜色/)
assert.match(buyerDetailHtml, /输入或选择新款颜色|已完成/, '目标颜色支持从款式档案建议中选择，也支持自行输入')

const emptyDraft = createEngineeringIndependentSampling({
  samplingType: 'DESIGN',
  targetStyleId: listStyleArchives()[0]!.styleId,
  creationReason: '验证未确认目标颜色时的 BOM 页签门禁',
  merchandiser: CURRENT_PCS_ENGINEERING_USER,
  createdAt: '2026-08-12 09:00:00',
})
const emptyDraftHtml = renderPcsIndependentSamplingDetailPage('DESIGN', emptyDraft.samplingTaskId)
assert.match(emptyDraftHtml, /BOM 与价格（待确认颜色）/)
assert.match(emptyDraftHtml, /disabled title="请先确认目标颜色"/, '确认目标颜色前 BOM 页签必须可见但不可进入')
assert.match(emptyDraftHtml, /datalist/, '款式档案已有颜色必须可选择，不能只显示成说明文字')
assert.match(emptyDraftHtml, /本次目标颜色待买手定义/)

const record = listEngineeringIndependentSamplingRecords('REVISION').find((item) => getEngineeringIndependentSamplingStep(item) === 'PROFESSIONAL_WORK')!
const detailHtml = renderPcsIndependentSamplingDetailPage('REVISION', record.samplingTaskId)
assert.match(detailHtml, /新款资料准备/)
assert.match(detailHtml, /工作安排/)
assert.match(detailHtml, /专业工作/)
assert.match(detailHtml, /整单确认/)
assert.match(detailHtml, /本次需要完成的工作/)
assert.match(detailHtml, /\/pcs\/(patterns\/(plate-making|artwork)|engineering\/color|samples\/display-sample)\//)
assert.doesNotMatch(detailHtml, /\/pcs\/engineering\/sampling-professional\//, '进入任务必须跳到对应专业任务详情，不再生成通用中转链接')

const designRecord = listEngineeringIndependentSamplingRecords('DESIGN').find((item) => getEngineeringIndependentSamplingStep(item) === 'PROFESSIONAL_WORK')!
const designDetailHtml = renderPcsIndependentSamplingDetailPage('DESIGN', designRecord.samplingTaskId)
assert.match(designDetailHtml, /设计打样/)
assert.match(designDetailHtml, /目标款式/)
assert.doesNotMatch(designDetailHtml, /A 款：基于款式（参考）/)
assert.match(designDetailHtml, /本次需要完成的工作/)
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
