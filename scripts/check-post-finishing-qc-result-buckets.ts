#!/usr/bin/env node

import {
  completePostFinishingQcOrder,
  getPostFinishingTaskById,
  getPostFinishingTaskSkuLines,
  listPostFinishingQcOrderEntities,
  listPostFinishingQcOrders,
  listPostFinishingTasks,
  listPostFinishingWaitQcSkuItems,
  submitPostFinishingPdaQcResult,
  type PostFinishingQcSkuResult,
} from '../src/data/fcs/post-finishing-domain.ts'
import { getMobileTaskTabKey, listMobileExecutionTasks } from '../src/data/fcs/mobile-execution-task-index.ts'
import { renderPostFinishingQcOrdersPage } from '../src/pages/process-factory/post-finishing/qc-orders.ts'
import { renderPostFinishingTasksPage } from '../src/pages/process-factory/post-finishing/tasks.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const qc = listPostFinishingQcOrderEntities().find((item) => item.skuLines.length > 0)
assert(qc, '缺少可检查的后道质检单')

const pendingRecord = listPostFinishingQcOrders().find((item) => !item.status.includes('完成'))
assert(pendingRecord, '缺少可检查的待完成质检单')
;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?tab=qc&completeQc=${pendingRecord!.actionRecordId}`,
  },
}
const completeDialogHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window

assert(!completeDialogHtml.includes('数量与处理'), '完成质检弹窗不应再显示数量与处理区')
assert(!completeDialogHtml.includes('责任与扣款依据'), '完成质检弹窗不应再显示责任与扣款依据区')
assert(!completeDialogHtml.includes('data-qc-sku-remark'), 'SKU 质检行不应再显示备注输入')
assert(!completeDialogHtml.includes('data-qc-result-select'), '质检结果不应再手动选择')
assert(completeDialogHtml.includes('data-qc-result-display'), '质检结果应由下方数量自动展示')
assert(completeDialogHtml.includes('返工扣款单价（IDR）'), '返工外流时应填写返工扣款单价')
assert(completeDialogHtml.includes('data-qc-rework-deduction-unit-amount'), '缺少返工扣款单价输入')
assert(completeDialogHtml.includes('data-qc-button-mode="manual"'), '选择装扣子时应能选择人工装扣')
assert(completeDialogHtml.includes('data-qc-button-mode="machine"'), '选择装扣子时应能选择机器装扣')
assert(completeDialogHtml.includes('data-qc-post-project-lockable'), '开扣眼或装扣子应锁定熨烫、包装')
assert(completeDialogHtml.includes('data-qc-sku-card'), 'SKU 质检区应改成卡片，不能再是宽表')
assert(!completeDialogHtml.includes('min-w-[1500px]'), '完成质检弹窗不应再使用 1500px 宽表')
assert(completeDialogHtml.includes('原工厂') && completeDialogHtml.includes('当前后道工厂'), '返工工厂应只提供原工厂和当前后道工厂')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=qc',
  },
}
const qcListHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
const headerIndex = qcListHtml.indexOf('<h1 class="text-xl font-semibold text-foreground">质检单</h1>')
const tabsIndex = qcListHtml.indexOf('待质检列表')
const filterIndex = qcListHtml.indexOf('data-qc-filter-row')
assert(headerIndex >= 0 && tabsIndex > headerIndex && filterIndex > tabsIndex, '待质检列表和质检单列表 Tab 应紧跟在页面标题下方，并位于筛选条件上方')
assert(qcListHtml.includes('data-qc-filter-row'), '质检单筛选条件应渲染为单行')
assert(qcListHtml.includes('data-qc-filter-actions'), '重置和查询按钮应在筛选条件同一行')
assert(!qcListHtml.includes('责任方') && !qcListHtml.includes('扣款决策'), '质检单列表不应再显示责任方和扣款决策')
assert(qcListHtml.includes('返工接收工厂') && qcListHtml.includes('瑕疵原因'), '质检单列表应显示返工工厂和瑕疵原因')
assert(qcListHtml.includes('装扣方式'), '质检单列表应展示装扣方式')
assert(qcListHtml.includes('<div class="mt-1">人工装扣</div>') && qcListHtml.includes('<div class="mt-1">机器装扣</div>'), '质检单列表应能直接展示人工装扣和机器装扣')
assert(qcListHtml.includes('name="buttonMode"') && qcListHtml.includes('value="manual"') && qcListHtml.includes('value="machine"'), '装扣方式应合入筛选条件中')
assert(qcListHtml.includes('name="pendingDefectReason"') && qcListHtml.includes('value="required"') && qcListHtml.includes('value="none"'), '质检单列表应支持按是否需要待补瑕疵原因筛选')
assert(qcListHtml.includes('待补瑕疵原因'), '初始 mock 数据应让 Web 质检单列表直接展示待补瑕疵原因')
assert(qcListHtml.includes('补齐瑕疵原因'), '初始 mock 数据应提供补齐瑕疵原因入口')
assert(qcListHtml.includes('data-qc-list-card'), '质检单列表应改成卡片列表，不能再是宽表')
assert(!qcListHtml.includes('min-w-[2200px]'), '质检单列表不应再使用 2200px 宽表')
assert(!qcListHtml.includes('录入质检数据'), '质检单页面右上角不应再显示“录入质检数据”按钮')
assert(qcListHtml.includes('>创建质检单</button>') && qcListHtml.includes('inputQc=1'), '质检单页面右上角“创建质检单”应进入手动生产单录入弹窗')

const postTasks = listPostFinishingTasks()
const createableTasks = postTasks.filter((item) => item.waitQcQty > 0)
const nonCreateableTasks = postTasks.filter((item) => item.waitQcQty <= 0)
const tasksWithQcOrder = postTasks.filter((task) => listPostFinishingQcOrderEntities().some((qcOrder) => qcOrder.postTaskId === task.postTaskId))
assert(postTasks.length <= 6, '后道任务 mock 数据应收敛为少量代表行')
assert(listPostFinishingQcOrderEntities().length <= 6, '质检单 mock 数据应收敛为少量代表单据')
assert(createableTasks.length >= 1, '后道任务 mock 应包含可创建质检单的数据')
assert(nonCreateableTasks.length >= 1, '后道任务 mock 应包含不可创建质检单的数据')
assert(tasksWithQcOrder.length >= 1, '后道任务 mock 应包含已有质检单的数据')
assert(createableTasks.every((task) => getPostFinishingTaskSkuLines(task.postTaskId).length > 1), '可创建质检单的后道任务必须是一个生产单下多个 SKU')
assert(nonCreateableTasks.every((task) => getPostFinishingTaskSkuLines(task.postTaskId).length !== 1), '不可创建质检单的后道任务不能只展示单 SKU')
assert(listPostFinishingQcOrderEntities().every((item) => item.skuLines.length > 1), '质检单 mock 里每张质检单都必须包含多个 SKU')
assert(postTasks.every((task) => task.qcDoneQty > 0), '后道任务每条 mock 都必须有已质检数量')
assert(postTasks.every((task) => listPostFinishingQcOrderEntities().filter((qcOrder) => qcOrder.productionOrderNo === task.productionOrderNo).length >= 2), '后道任务每条 mock 点击查看质检单后至少应看到 2 张质检单')

const waitInputItem = listPostFinishingWaitQcSkuItems().find((item) => item.waitQcQty > 0)
assert(waitInputItem, '缺少可检查的待质检 SKU')
const waitInputItems = listPostFinishingWaitQcSkuItems({ productionOrderNo: waitInputItem.productionOrderNo }).filter((item) => item.waitQcQty > 0)
assert(waitInputItems.length >= 3, '可创建质检单的生产单必须至少查出 3 个待质检 SKU')
assert(waitInputItems.every((item) => item.waitQcQty > 100), '可创建质检单的每个 SKU 待质检数量都必须超过 100')
const spacedOrderNo = waitInputItem.productionOrderNo.replace('-', '- ')
const spacedWaitInputItems = listPostFinishingWaitQcSkuItems({ productionOrderNo: spacedOrderNo }).filter((item) => item.waitQcQty > 0)
assert(spacedWaitInputItems.length >= 3, '生产单号中误输入空格时也应查出待质检 SKU')
const arbitraryProductionOrderNo = '用户随便输入的生产单号'
;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=wait',
  },
}
const waitListHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(waitListHtml.includes(`postTaskId=${encodeURIComponent(waitInputItem!.postTaskId)}`) && waitListHtml.includes(`createQc=${encodeURIComponent(waitInputItem!.waitQcSkuKey)}`), '待质检列表创建质检单应自动带入生产单对应的后道任务')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/tasks',
    search: '',
  },
}
const taskPageHtml = renderPostFinishingTasksPage()
delete (globalThis as any).window
assert(taskPageHtml.includes(`postTaskId=${encodeURIComponent(waitInputItem!.postTaskId)}`) && taskPageHtml.includes('createQc=1'), '后道任务创建质检单应自动带入生产单对应的后道任务')
assert((taskPageHtml.match(/>创建质检单<\/button>/g) || []).length <= 6, '后道任务列表不应铺过多创建质检单按钮')
assert(taskPageHtml.includes('>计划数量</th><th') && taskPageHtml.includes('>待质检数量</th><th') && taskPageHtml.includes('>已质检数量</th>'), '后道任务列表计划数量后应紧跟待质检数量和已质检数量')
assert(!taskPageHtml.includes('<th class="px-3 py-2 text-left">未质检</th>'), '后道任务列表不应再展示“未质检”列')
assert(createableTasks.every((task) => taskPageHtml.includes(`data-nav="/fcs/craft/post-finishing/qc-orders?postTaskId=${encodeURIComponent(task.postTaskId)}&amp;createQc=1"`)), '待质检数量大于 0 的后道任务创建质检单按钮应可点击')
assert(nonCreateableTasks.every((task) => task.waitQcQty <= 0), '不可创建质检单的判断应只基于待质检数量')
const firstTask = postTasks[0]!
;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?postTaskId=${encodeURIComponent(firstTask.postTaskId)}&tab=qc&keyword=${encodeURIComponent(firstTask.productionOrderNo)}`,
  },
}
const taskQcListHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert((taskQcListHtml.match(/data-qc-list-card/g) || []).length >= 2, '后道任务查看质检单应按生产单号展示至少 2 张质检单')
assert(taskQcListHtml.includes('查看质检单') && taskQcListHtml.includes('viewQc='), '后道任务查看质检单列表后应能继续查看质检详情')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?postTaskId=${encodeURIComponent(waitInputItem!.postTaskId)}&createQc=1`,
  },
}
const createQcHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(createQcHtml.includes('合格数量') && createQcHtml.includes('返工数量') && createQcHtml.includes('瑕疵数量'), '创建质检单弹窗应能直接录入质检结果')
assert(createQcHtml.includes('返工接收工厂') && createQcHtml.includes('返工扣款单价（IDR）') && createQcHtml.includes('瑕疵原因'), '创建质检单弹窗应包含返工工厂、返工扣款和瑕疵原因')
assert(createQcHtml.includes('确认完成质检'), '创建质检单弹窗应能直接完成质检')
assert(createQcHtml.includes('window.__postQuickInputQcOrder()') && !createQcHtml.includes('window.__postCreateQcOrder()'), '创建质检单弹窗不应只停留在创建质检单动作')
assert(!createQcHtml.includes('xl:grid-cols-2'), '创建质检单弹窗应一行展示一个 SKU，不应两列铺卡片')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?inputQc=1&qcProductionOrderNo=${encodeURIComponent(spacedOrderNo)}`,
  },
}
const quickInputHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(quickInputHtml.includes('data-qc-quick-input-dialog'), '录入质检数据弹窗应可按生产单号打开')
assert(quickInputHtml.includes('data-qc-quick-preview'), '右上角创建质检单查看结果应有局部预览容器')
assert(quickInputHtml.includes(`value="${spacedOrderNo}"`), '录入质检数据弹窗应保留生产单号')
assert(quickInputHtml.includes('data-qc-quick-source-row'), '录入质检数据弹窗应展示待质检 SKU 行')
assert((quickInputHtml.match(/data-qc-quick-source-row/g) || []).length >= 3, '右上角手动输入生产单号后应查出该生产单下至少 3 个 SKU')
assert(quickInputHtml.includes('>查看</button>'), '右上角创建质检单手动查询按钮应显示为“查看”')
assert(quickInputHtml.includes('window.__postQuickInputQcPreview()'), '右上角创建质检单查看按钮必须直接触发弹窗预览刷新')
assert(quickInputHtml.includes('商品图片') && quickInputHtml.includes('生产时间') && quickInputHtml.includes('送检数量') && quickInputHtml.includes('合格数量'), '录入质检数据弹窗应展示图片、生产时间和核心数量字段')
assert(quickInputHtml.includes('返工数量') && quickInputHtml.includes('返工接收工厂') && quickInputHtml.includes('瑕疵原因') && quickInputHtml.includes('确认完成质检'), '录入质检数据弹窗应支持一次性完成质检')
;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?inputQc=1&qcProductionOrderNo=${encodeURIComponent(arbitraryProductionOrderNo)}`,
  },
}
const arbitraryInputHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(arbitraryInputHtml.includes(`value="${arbitraryProductionOrderNo}"`), '右上角手动输入任意生产单号时应保留输入值')
assert((arbitraryInputHtml.match(/data-qc-quick-source-row/g) || []).length >= 3, '右上角手动输入任意生产单号后也应直接展示 mock SKU')
assert(!arbitraryInputHtml.includes('暂无待质检 SKU') && !arbitraryInputHtml.includes('输入生产单号后展示待质检 SKU'), '右上角手动输入任意生产单号后不应展示空态')
const quickDialogStart = quickInputHtml.indexOf('data-qc-quick-input-dialog')
const quickDialogEnd = quickInputHtml.indexOf('data-qc-create-station', quickDialogStart)
const quickDialogHtml = quickInputHtml.slice(quickDialogStart, quickDialogEnd > quickDialogStart ? quickDialogEnd : undefined)
assert(!quickDialogHtml.includes('min-w-[1280px]'), '录入质检数据弹窗不应复用宽表')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=qc&pendingDefectReason=required',
  },
}
const pendingReasonFilterHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(pendingReasonFilterHtml.includes('QC-POST-2026-006'), '筛选需要补齐时应展示待补瑕疵原因质检单')
assert(!pendingReasonFilterHtml.includes('QC-POST-2026-001'), '筛选需要补齐时不应展示无需补齐的质检单')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?tab=qc&viewQc=${pendingRecord!.actionRecordId}`,
  },
}
const qcDetailHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(!qcDetailHtml.includes('责任方') && !qcDetailHtml.includes('扣款决策'), '质检单详情不应再显示责任方和扣款决策')
assert(qcDetailHtml.includes('data-qc-detail-sku-card'), '质检单详情 SKU 明细应改成卡片，不能再是宽表')
assert(!qcDetailHtml.includes('min-w-[1320px]'), '质检单详情 SKU 明细不应再使用 1320px 宽表')

const pdaPending = listPostFinishingQcOrderEntities().find((item) => item.qcStatus !== '质检完成' && item.skuLines.length > 0)
assert(pdaPending, '缺少可检查的 PDA 待质检单')
const pdaPendingTask = getPostFinishingTaskById(pdaPending!.postTaskId || '')
assert(pdaPendingTask?.currentStatus === '待质检' || pdaPendingTask?.currentStatus === '质检中', 'PDA 执行列表应优先露出待质检或质检中的后道任务')
const pdaExecTask = listMobileExecutionTasks({ currentFactoryId: 'PF-DEDICATED-001', statusTab: 'IN_PROGRESS' }).find((item) => item.taskId === pdaPending!.postTaskId)
assert(pdaExecTask && getMobileTaskTabKey(pdaExecTask) === 'IN_PROGRESS', 'PDA 待质检后道任务应出现在进行中列表')
const pdaLine = pdaPending!.skuLines[0]
const pdaDraft = submitPostFinishingPdaQcResult({
  qcOrderId: pdaPending!.qcOrderId,
  inspectorName: 'PDA 后道质检员',
  qcStationName: '后道质检台 A',
  qcSkuResults: [{
    qcSkuResultId: `${pdaPending!.qcOrderId}-PDA-CHECK-001`,
    skuLineId: pdaLine.skuLineId,
    skuId: pdaLine.skuId,
    skuCode: pdaLine.skuCode,
    skuImageUrl: pdaLine.imageUrl,
    colorName: pdaLine.colorName,
    sizeName: pdaLine.sizeName,
    inspectedQty: 100,
    qualifiedQty: 70,
    reworkQty: 10,
    defectAcceptedQty: 20,
    unqualifiedQty: 30,
    platformReasonQty: 0,
    factoryReasonQty: 30,
    responsibleFactoryId: pdaPending!.sourceFactoryId,
    responsibleFactoryName: pdaPending!.sourceFactoryName,
    reworkReceiveFactoryId: pdaPending!.sourceFactoryId,
    reworkReceiveFactoryName: pdaPending!.sourceFactoryName,
    defectReasonItems: [],
    postProjectJudgements: [
      { projectName: '装扣子', needed: true, qty: 70, buttonAttachMode: '人工装扣' },
    ],
    qtyUnit: '件',
  }],
})
assert(pdaDraft.qcStatus !== '质检完成', 'PDA 有瑕疵数量但未补原因时，质检单不能算完成')
assert(pdaDraft.defectAcceptedGarmentQty === 20, 'PDA 应保存瑕疵数量')
assert(!pdaDraft.generatedPostOrderId && !pdaDraft.generatedRecheckOrderId, '待补瑕疵原因前不能生成后道单或复检单')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=qc',
  },
}
const pdaDraftListHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(pdaDraftListHtml.includes('待补瑕疵原因'), 'Web 列表应提示 PDA 提交后待补瑕疵原因')
assert(pdaDraftListHtml.includes('补齐瑕疵原因'), 'Web 列表应提供补齐瑕疵原因入口')

try {
  completePostFinishingQcOrder({ qcOrderId: pdaDraft.qcOrderId, qcSkuResults: pdaDraft.qcSkuResults })
  assert(false, '瑕疵原因数量未补齐时不允许完成质检')
} catch (error) {
  assert(String(error).includes('瑕疵原因合计必须等于瑕疵数量'), '未补齐瑕疵原因时应给出明确提示')
}

const line = qc!.skuLines[0]
const bucketResult = {
  qcSkuResultId: `${qc!.qcOrderId}-CHECK-001`,
  skuLineId: line.skuLineId,
  skuId: line.skuId,
  skuCode: line.skuCode,
  skuImageUrl: line.imageUrl,
  colorName: line.colorName,
  sizeName: line.sizeName,
  inspectedQty: 100,
  qualifiedQty: 50,
  reworkQty: 30,
  defectAcceptedQty: 20,
  unqualifiedQty: 50,
  platformReasonQty: 0,
  factoryReasonQty: 50,
  reworkReceiveFactoryName: '当前后道工厂',
  reworkDeductionUnitAmountIdr: 15000,
  responsibleFactoryId: qc!.sourceFactoryId,
  responsibleFactoryName: qc!.sourceFactoryName,
  defectReasonItems: [
    {
      reasonItemId: `${qc!.qcOrderId}-CHECK-REASON-1`,
      reasonName: '做工原因',
      qty: 12,
      liabilityType: '工厂',
      responsibleFactoryId: qc!.sourceFactoryId,
      responsibleFactoryName: qc!.sourceFactoryName,
    },
    {
      reasonItemId: `${qc!.qcOrderId}-CHECK-REASON-2`,
      reasonName: '脏污',
      qty: 8,
      liabilityType: '工厂',
      responsibleFactoryId: qc!.sourceFactoryId,
      responsibleFactoryName: qc!.sourceFactoryName,
    },
  ],
  postProjectJudgements: [],
  qtyUnit: '件',
} as PostFinishingQcSkuResult & {
  reworkQty: number
  defectAcceptedQty: number
  reworkReceiveFactoryName: string
  reworkDeductionUnitAmountIdr: number
}
bucketResult.postProjectJudgements = [
  { projectName: '装扣子', needed: true, qty: 50, buttonAttachMode: '机器装扣' },
]

const emptyResults = qc!.skuLines.slice(1).map((item, index): PostFinishingQcSkuResult => ({
  qcSkuResultId: `${qc!.qcOrderId}-CHECK-EMPTY-${index + 1}`,
  skuLineId: item.skuLineId,
  skuId: item.skuId,
  skuCode: item.skuCode,
  skuImageUrl: item.imageUrl,
  colorName: item.colorName,
  sizeName: item.sizeName,
  inspectedQty: 0,
  qualifiedQty: 0,
  unqualifiedQty: 0,
  platformReasonQty: 0,
  factoryReasonQty: 0,
  defectReasonItems: [],
  postProjectJudgements: [],
  qtyUnit: item.qtyUnit,
}))

const completed = completePostFinishingQcOrder({
  qcOrderId: qc!.qcOrderId,
  qcResult: '部分不合格',
  unqualifiedDisposition: '返修',
  unqualifiedReasonSummary: '合格 50，返工 30，瑕疵品 20。',
  rootCauseType: '工厂加工问题',
  responsiblePartyType: '工厂',
  responsiblePartyName: qc!.sourceFactoryName,
  deductionDecision: '建议扣款',
  deductionDecisionRemark: '本质检周期先扣返工数量对应加工费。',
  qcSkuResults: [bucketResult, ...emptyResults],
})

assert(completed.inspectedGarmentQty === 100, '质检数量应为 100')
assert(completed.passedGarmentQty === 50, '合格数量应为 50')
assert(completed.defectiveGarmentQty === 50, '返工和瑕疵品应计入质检异常数量 50')
assert(completed.reworkGarmentQty === 30, '返工数量应为 30')
assert(completed.defectAcceptedGarmentQty === 20, '瑕疵品接收数量应为 20')
assert(completed.processingFeeDeductionQty === 30, '本质检结算周期应扣返工加工费数量 30')
assert(completed.qcSkuResults[0].reworkReceiveFactoryName === '当前后道工厂', '返工接收工厂未保留')
assert(completed.qcSkuResults[0].reworkDeductionUnitAmountIdr === 15000, '返工外流扣款单价未保留')
assert(completed.qcSkuResults[0].reworkDeductionAmountIdr === 450000, '返工外流扣款金额应为返工数量乘以单价')
assert(completed.needButton && completed.needIroning && completed.needPackaging, '选择装扣子后应自动需要熨烫和包装')
assert(completed.qcSkuResults[0].postProjectJudgements.find((item) => item.projectName === '装扣子')?.buttonAttachMode === '机器装扣', '装扣方式未保留')
assert(
  completed.qcSkuResults[0].defectReasonItems.map((item) => item.reasonName).join('、') === '做工原因、脏污',
  '瑕疵原因明细未保留',
)

const action = listPostFinishingQcOrders().find((item) => item.linkedQcOrderId === completed.qcOrderId)
assert(action, '质检动作记录未生成')
assert(action!.reworkGarmentQty === 30, '动作记录应保留返工数量')
assert(action!.defectAcceptedGarmentQty === 20, '动作记录应保留瑕疵品数量')
assert(action!.qualityDeductionSnapshot?.processingFeeDeductionQty === 30, '扣款快照应记录本期扣加工费数量 30')

console.log('post finishing qc result bucket checks passed')
