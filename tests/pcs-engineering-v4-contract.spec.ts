import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  listEngineeringIndependentSamplingRecords,
  resetEngineeringIndependentSamplingRepository,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  assertEngineeringUploadedFilesReady,
  captureEngineeringUploadedFiles,
  ENGINEERING_UPLOAD_RULES,
} from '../src/data/pcs-engineering-file-upload.ts'
import {
  renderPcsDesignSamplingListPage,
  renderPcsDisplaySampleTaskListPage,
  renderPcsRevisionSamplingListPage,
} from '../src/pages/pcs-independent-sampling.ts'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

const menu = source('src/data/app-shell-config.ts')
const routes = source('src/router/routes-pcs.ts')
const handlers = source('src/main-handlers/pcs-handlers.ts')
const samplingDomain = source('src/data/pcs-engineering-master-sampling.ts')
const masterTypes = source('src/data/pcs-engineering-master-types.ts')
const samplingPage = source('src/pages/pcs-independent-sampling.ts')
const masterPage = source('src/pages/pcs-engineering-master-detail.ts')
const taskListPage = source('src/pages/pcs-engineering-tasks/master-task-page.ts')
const changeDomain = source('src/data/pcs-engineering-change-workspace.ts')
const changePage = source('src/pages/pcs-engineering-change.ts')
const techPackTypes = source('src/data/pcs-technical-data-version-types.ts')
const techPackReview = source('src/data/pcs-tech-pack-review.ts')
const preparationProjection = source('src/data/pcs-engineering-preparation-projection.ts')
const preparationPage = source('src/pages/production/preparation-timing.ts')
const uploadComponent = source('src/components/ui/engineering-file-upload.ts')
const techPackEvents = source('src/pages/tech-pack/events.ts')
const techPackAssets = source('src/pages/tech-pack/asset-domain.ts')
const techPackContext = source('src/pages/tech-pack/context.ts')
const techPackPattern = source('src/pages/tech-pack/pattern-domain.ts')
const engineeringPatternResult = source('src/data/pcs-engineering-pattern-result.ts')
const engineeringTechPackWorkspace = source('src/data/pcs-engineering-tech-pack-workspace.ts')
const technicalDataBootstrap = source('src/data/pcs-technical-data-version-bootstrap.ts')
const technicalDataRepository = source('src/data/pcs-technical-data-version-repository.ts')

// ADJ-001～003：三条业务路径分开；独立打样建立后不提前产生专业任务。
for (const [label, path] of [
  ['改款打样任务', '/pcs/engineering/revision-sampling'],
  ['设计打样任务', '/pcs/engineering/design-sampling'],
  ['工程主单', '/pcs/engineering/masters'],
  ['工程变更', '/pcs/engineering/changes'],
] as const) {
  assert.ok(menu.includes(label) && menu.includes(path), `缺少独立业务入口：${label}`)
  assert.ok(routes.includes(path), `缺少独立业务路由：${path}`)
}
assert.match(samplingDomain, /professionalTasks:\s*\[\]/, '建立独立打样时不得直接生成专业任务')
assert.match(samplingPage, /创建后先完成 B 款 BOM 与价格，再由跟单确认本次工作安排/)

// ADJ-002：销售展示样衣与产前版样衣是不同业务成果。
assert.ok(menu.includes('销售展示样衣任务') && menu.includes('/pcs/samples/display-sample'))
assert.ok(menu.includes('产前版样衣任务') && menu.includes('/pcs/samples/first-sample'))
assert.notEqual(menu.indexOf('/pcs/samples/display-sample'), menu.indexOf('/pcs/samples/first-sample'))

// ADJ-004～007：建议来自目的和 B 款 BOM；改款必须先做颜色及物料转换，最终归属 B 款。
for (const text of ['colorMappings', 'materialConversionLines', 'WAIT_COLOR_MAPPING', 'WAIT_MATERIAL_DECISION', 'CONFIRMED']) {
  assert.ok(samplingDomain.includes(text), `A→B 转换缺少：${text}`)
}
assert.match(samplingDomain, /B 款新增颜色/)
assert.match(samplingDomain, /targetStyleCode/)
assert.match(samplingPage, /A 款：基于款式（参考）/)
assert.match(samplingPage, /B 款：最终做成款式/)

// ADJ-008～011：任务先落团队；统一状态；仅保留一个“当前需处理的团队”筛选；自动衔接下一团队。
assert.doesNotMatch(menu, /我的工程任务/)
assert.doesNotMatch(taskListPage, /待本团队处理|团队处理中|待本团队审核|团队返工中/)
assert.match(taskListPage, /当前需处理的团队/)
assert.match(samplingPage, /当前需处理的团队/)
  assert.match(samplingPage, /action === 'close-image'/)
  assert.match(samplingPage, /target\.dataset\.skipPageRerender = 'true'/)
  assert.match(samplingPage, /ui\.createDraft\.targetStyleId/)
  assert.match(samplingPage, /taskDraftValue/)
assert.match(samplingPage, /完成后去向/)
assert.match(masterTypes, /assigneeName/)
assert.match(masterTypes, /submittedByName/)

// ADJ-012～014：主单使用业务表格字段；专业详情显示业务名称，不暴露依赖编号。
for (const text of ['任务', '当前处理团队', '当前动作', '需要先完成', '完成后去向', '计划／实际', '状态']) {
  assert.ok(masterPage.includes(text), `工程主单表格缺少：${text}`)
}
assert.match(samplingPage, /需要先完成/)
assert.doesNotMatch(samplingPage, />前置依赖</)

// ADJ-015～020：工程变更选择具体内容，专业制作形成真实任务并投影到统一列表，状态与版本清楚分开。
for (const status of ['待确认修改内容', '修改中', '待汇总技术包', '技术包审核中', '已生效', '已完成']) {
  assert.ok(changeDomain.includes(`'${status}'`), `工程变更缺少状态：${status}`)
}
for (const treatment of ['BOM_EDIT', 'PROFESSIONAL_TASK', 'TECHNICAL_DATA_EDIT']) {
  assert.ok(changeDomain.includes(treatment), `工程变更缺少处理方式：${treatment}`)
}
assert.match(changePage, /本次要修改的内容/)
assert.doesNotMatch(changePage, /受影响资料模块/)
assert.match(changeDomain, /listEngineeringChangeProfessionalTaskProjections/)
assert.match(changeDomain, /sourceType:\s*'ENGINEERING_CHANGE'/)
assert.match(changePage, /原主单和原正式技术包保持只读/)

// ADJ-021：技术包退回必须指向具体内容，并能回开指定任务。
for (const target of ['BOM_LINE', 'PROCESS_ITEM', 'PAPER_PATTERN_RESULT', 'ARTWORK_RESULT']) {
  assert.ok(techPackTypes.includes(`'${target}'`), `技术包缺少退回目标：${target}`)
}
assert.match(techPackTypes, /reviewReturnTargets/)
assert.match(techPackReview, /listTechPackReviewReturnTargets/)
assert.match(techPackReview, /input\.targets/)

// ADJ-022～023：生产准备时效只读工程主单任务事实；页面使用业务语言。
assert.match(preparationProjection, /projectEngineeringMasterToPreparation/)
assert.doesNotMatch(preparationProjection, /INDEPENDENT_SAMPLING|ENGINEERING_CHANGE/)
assert.match(preparationPage, /产前版样衣/)
assert.doesNotMatch(changePage, /受影响资料模块|临时任务/)

// ADJ-024：Mock 足够分页，并覆盖一对多颜色和无来源颜色。
resetEngineeringIndependentSamplingRepository(true)
for (const type of ['REVISION', 'DESIGN'] as const) {
  assert.ok(listEngineeringIndependentSamplingRecords(type).length >= 12, `${type} Mock 不足以验证分页`)
}
const revisionRecords = listEngineeringIndependentSamplingRecords('REVISION')
assert.ok(revisionRecords.some((record) => {
  const values = record.colorMappings.map((item) => item.sourceColor).filter(Boolean)
  return new Set(values).size < values.length
}), 'Mock 缺少 A 款一个颜色对应 B 款多个颜色')
assert.ok(revisionRecords.some((record) => record.colorMappings.some((item) => !item.sourceColor)), 'Mock 缺少 B 款无来源颜色')

// ADJ-025：三份权威文档和验收记录必须使用同一组 ADJ 编号。
for (const path of [
  'docs/product-design/PCS生产工程管理总体设计文档.md',
  'docs/product-design/PCS生产工程管理实施计划.md',
  'docs/product-design/PCS生产工程管理需求追踪与交付矩阵.md',
  'docs/product-design/PCS生产工程管理V4逐项验收结果.md',
]) {
  const document = source(path)
  for (let index = 1; index <= 27; index += 1) {
    assert.ok(document.includes(`ADJ-${String(index).padStart(3, '0')}`), `${path} 未覆盖 ADJ-${String(index).padStart(3, '0')}`)
  }
}

// ADJ-026：所有专业成果通过真实文件选择；文件规则、保存、查看、下载及错误门禁齐全。
assert.match(uploadComponent, /type="file"/)
assert.match(uploadComponent, /选择本地文件/)
assert.match(uploadComponent, /查看大图/)
assert.match(uploadComponent, /download=/)
assert.doesNotMatch(uploadComponent, /图片地址|文件地址/)
assert.doesNotMatch(techPackEvents, /buildDesignPlaceholderImage/, '非图片设计稿不得生成假缩略图')
assert.match(techPackEvents, /readFileAsDataUrl\(file\)/, '技术包设计稿必须读取真实本地文件')
assert.match(techPackAssets, /非图片文件，无图片预览/, '非图片文件必须明确说明无图片预览')
assert.match(techPackEvents, /readPatternFileAsDataUrl/, '技术包纸样文件必须读取真实本地文件')
assert.match(techPackEvents, /dataUrl:\s*''/, '技术包纸样文件保存前必须等待真实内容读取')
assert.match(techPackContext, /fileUrl:\s*item\.fileUrl\s*\|\|\s*''/, '毛织 Zip 原文件必须随纸样记录保存')
assert.doesNotMatch(techPackContext, /hasLegacyTechnicalFiles/, '不得根据旧文件名补造纸样原文件')
assert.doesNotMatch(techPackPattern, /buildPrototypeDownloadUrl|HiGood 技术包演示文件/, '不得把文件名包装成演示下载文件')
assert.doesNotMatch(techPackPattern, /buildPatternPreviewUrl/, '缺少唛架原图时不得生成假预览')
assert.match(techPackPattern, /原文件缺失，请重新上传/, '历史记录缺少原文件时必须明确提示重新上传')
assert.match(techPackPattern, /原图片缺失，请重新上传/, '历史记录缺少原图时必须明确提示重新上传')
assert.match(engineeringPatternResult, /sourceFiles:\s*EngineeringUploadedFile\[\]/, '制版成果必须保存真实源文件')
assert.match(engineeringPatternResult, /previewFiles:\s*EngineeringUploadedFile\[\]/, '制版成果必须保存真实预览图')
assert.match(engineeringPatternResult, /assertEngineeringUploadedFilesReady\(sourceFiles/, '制版成果提交前必须校验真实源文件已经保存')
assert.match(engineeringTechPackWorkspace, /result\.sourceFiles/, '技术包草稿必须读取制版成果的真实源文件')
assert.match(engineeringTechPackWorkspace, /fileUrl:\s*file\.dataUrl/, '技术包纸样下载必须保留真实文件内容')
assert.match(engineeringTechPackWorkspace, /prjFile:\s*toManagedPatternFile\(prj\)/, '技术包必须保留真实 PRJ 文件元数据和内容')
assert.match(technicalDataRepository, /prjFile:\s*item\.prjFile\s*\?\s*\{\s*\.\.\.item\.prjFile/, '技术包版本读取必须隔离真实 PRJ 文件快照')
assert.doesNotMatch(technicalDataBootstrap, /buildDemoDesignPreviewDataUrl|data:image\/svg\+xml/, '演示种子不得生成假设计稿或假预览图')
assert.ok(ENGINEERING_UPLOAD_RULES.PATTERN_SOURCE.extensions.includes('prj'), '纸样源文件必须支持 .prj')
assert.ok(ENGINEERING_UPLOAD_RULES.SAMPLE_RESULT.extensions.includes('jpg'), '样衣成果必须支持真实图片')
const realPatternFile = new File(['HiGood pattern source'], 'STYLE-PRJ-202604-013.prj', { type: 'application/octet-stream' })
const capturedPatternFiles = await captureEngineeringUploadedFiles({
  files: [realPatternFile],
  purpose: 'PATTERN_SOURCE',
  actor: { userId: 'pattern-team-01', userName: '版师-周师傅', teamName: '版师团队' },
  roundNo: 2,
  uploadedAt: '2026-08-11 16:30:00',
})
assertEngineeringUploadedFilesReady(capturedPatternFiles, '纸样源文件')
assert.equal(capturedPatternFiles[0]?.fileName, 'STYLE-PRJ-202604-013.prj')
assert.equal(capturedPatternFiles[0]?.extension, 'prj')
assert.equal(capturedPatternFiles[0]?.roundNo, 2)
assert.equal(capturedPatternFiles[0]?.uploadedByTeam, '版师团队')
assert.match(capturedPatternFiles[0]?.dataUrl || '', /^data:application\/octet-stream;base64,/)

// ADJ-027：改款、设计列表均采用专业任务标准列表骨架和同一筛选方式。
const revisionHtml = renderPcsRevisionSamplingListPage()
const designHtml = renderPcsDesignSamplingListPage()
const displaySampleHtml = renderPcsDisplaySampleTaskListPage()
for (const [name, html] of [['改款', revisionHtml], ['设计', designHtml]] as const) {
  assert.match(html, /data-standard-list-page/, `${name}打样未使用标准列表骨架`)
  assert.match(html, /列设置/)
  assert.match(html, /当前需处理的团队/)
  assert.equal((html.match(/data-pcs-independent-sampling-field="teamFilter"/g) || []).length, 1, `${name}打样只能有一个团队筛选条件`)
}
assert.match(displaySampleHtml, /销售展示样衣任务/)

// 当前入口不得重新接回已删除的历史泛入口。
assert.doesNotMatch(routes, /\/pcs\/patterns\/revision/)
assert.doesNotMatch(handlers, /\/pcs\/patterns\/revision/)

console.log('pcs-engineering-v4-contract.spec PASS')
