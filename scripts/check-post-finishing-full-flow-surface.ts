#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const files = {
  domain: read('../src/data/fcs/post-finishing-full-flow.ts'),
  numbering: read('../src/data/fcs/post-finishing-document-numbering.ts'),
  authorization: read('../src/data/fcs/post-finishing-authorization.ts'),
  references: read('../src/data/fcs/post-finishing-qc-reference.ts'),
  logs: read('../src/data/fcs/post-finishing-operation-log.ts'),
  sewingReturn: read('../src/pages/pda-sewing-self-return.ts'),
  pdaFlow: read('../src/pages/pda-post-finishing-flow.ts'),
  pdaQuality: read('../src/pages/pda-quality.ts'),
  pdaExecDetail: read('../src/pages/pda-exec-detail.ts') + '\n' + read('../src/pages/pda-post-finishing-exec-detail.ts'),
  pdaHandover: read('../src/pages/pda-handover.ts'),
  pdaHandoverDetail: read('../src/pages/pda-handover-detail.ts'),
  pdaHandoverEvents: read('../src/data/fcs/pda-handover-events.ts'),
  pdaWarehouse: read('../src/pages/pda-warehouse.ts'),
  pdaWaitProcess: read('../src/pages/pda-warehouse-wait-process.ts'),
  warehouse: read('../src/pages/process-factory/post-finishing/warehouse.ts'),
  qcWorkbench: read('../src/pages/process-factory/post-finishing/qc-workbench.ts'),
  qcOrders: read('../src/pages/process-factory/post-finishing/qc-orders.ts'),
  tasks: read('../src/pages/process-factory/post-finishing/tasks.ts'),
  workOrders: read('../src/pages/process-factory/post-finishing/work-orders.ts'),
  workOrderDetail: read('../src/pages/process-factory/post-finishing/work-order-detail.ts'),
  outboundOrders: read('../src/pages/process-factory/post-finishing/outbound-orders.ts'),
  audit: read('../src/pages/process-factory/post-finishing/audit-records.ts'),
  authorizationCode: read('../src/pages/process-factory/post-finishing/authorization-code.ts'),
  statistics: read('../src/pages/process-factory/post-finishing/statistics.ts'),
  print: read('../src/pages/process-factory/post-finishing/full-flow-print.ts'),
  legacyQcPrint: read('../src/pages/print/templates/post-finishing-qc-print-template.ts'),
  printRegistry: read('../src/data/fcs/print-template-registry.ts'),
  productionDetail: read('../src/pages/production/detail-domain.ts'),
  fcsRoutes: read('../src/router/routes-fcs.ts'),
  pdaRoutes: read('../src/router/routes-pda.ts'),
  renderers: read('../src/router/route-renderers.ts'),
  fcsRenderers: read('../src/router/route-renderers-fcs.ts'),
  fcsHandlers: read('../src/main-handlers/fcs-handlers.ts'),
  postFinishingEvents: read('../src/pages/process-factory/post-finishing/events.ts'),
  pdaHandlers: read('../src/main-handlers/pda-handlers.ts'),
  menu: read('../src/data/app-shell-config.ts'),
  techPackTypes: read('../src/data/fcs/production-tech-pack-snapshot-types.ts'),
  techPacks: read('../src/data/fcs/tech-packs.ts'),
}

const webPaths = [
  '/fcs/craft/post-finishing/tasks',
  '/fcs/craft/post-finishing/wait-process-warehouse',
  '/fcs/craft/post-finishing/wait-handover-warehouse',
  '/fcs/craft/post-finishing/qc-workbench',
  '/fcs/craft/post-finishing/qc-orders',
  '/fcs/craft/post-finishing/work-orders',
  '/fcs/craft/post-finishing/outbound-orders',
  '/fcs/craft/post-finishing/audit-records',
  '/fcs/craft/post-finishing/authorization-code',
  '/fcs/craft/post-finishing/print',
]
for (const path of webPaths) {
  assert(files.fcsRoutes.includes(`'${path}'`), `Web 路由缺少 ${path}`)
  assert(files.menu.includes(path) || path.endsWith('/print') || path.endsWith('/qc-workbench'), `菜单或业务入口缺少 ${path}`)
}

const pdaPaths = [
  '/fcs/pda/handover/sewing-self-return',
  '/fcs/pda/post-finishing/return-confirm',
  '/fcs/pda/post-finishing/execute',
]
for (const path of pdaPaths) {
  assert(files.pdaRoutes.includes(`'${path}'`), `PDA 路由缺少 ${path}`)
  assert(files.pdaHandlers.includes(`exact('${path}')`), `PDA 处理器缺少 ${path}`)
}
assert(files.renderers.includes('renderPdaPostFinishingReturnConfirmationPage'), 'PDA 回货确认渲染器未注册')
assert(files.pdaHandover.includes('/fcs/pda/post-finishing/return-confirm'), '交接待接收缺少送货单点数确认入口')
assert(!files.pdaWarehouse.includes('/fcs/pda/post-finishing/return-confirm'), '仓管页不得保留回货确认入口')
assert(!files.pdaWarehouse.includes('/fcs/pda/post-finishing/outbound-receive'), '仓管页不得保留成衣仓收货入口')
assert(!files.pdaRoutes.includes('/fcs/pda/post-finishing/outbound-receive') && !files.pdaHandlers.includes('/fcs/pda/post-finishing/outbound-receive'), '后道工厂 PDA 必须删除成衣仓收货路由与处理器')

for (const required of [
  'toleranceRate: RETURN_TOLERANCE_RATE',
  "denominator: '工厂登记数量'",
  'frontlineEditable: false',
  'firstRequiresSecondCount',
  'differenceRate || 0) > RETURN_TOLERANCE_RATE',
  'assertIntegerQuantity',
  'claimPostFinishingQcTask',
  'releasePostFinishingQcTask',
  'uploadPostFinishingQcTaskReference',
  'upsertOutboundFromQc',
  'submitPostFinishingForOutbound',
  'dispatchPostFinishingOutboundOrder',
  'submitPostFinishingQcRound',
  'upgradePostFinishingQcInspection',
  'receivePostFinishingOutboundOrder',
  'appendPostFinishingProcessCompletion',
  'getPostFinishingProcessProgress',
  'defectReasonQuantities',
  'correctPostFinishingProcessCompletion',
  'tracePostFinishingFullFlow',
  'listPostFinishingWaitProcessWarehouseRecords',
  'listPostFinishingWaitProcessWarehouseMovements',
  'listPostFinishingWaitHandoverWarehouseRecords',
  'listPostFinishingWaitHandoverWarehouseMovements',
  'loadPostFinishingDemoData',
  'canDiscardPostFinishingFactoryReturn',
  'discardPostFinishingFactoryReturn',
  "delivery.status = '已废弃'",
  "action: '废弃回货记录'",
]) assert(files.domain.includes(required), `共享全流程事实缺少 ${required}`)

assert(files.numbering.includes('idempotencyKey'), '统一编号服务必须按幂等键生成')
assert(files.numbering.includes('triggerSource'), '送货编号必须保留多触发来源')
assert(files.authorization.includes('TIME_WINDOW_MS = 30_000'), '授权码必须每 30 秒刷新')
assert(files.authorization.includes('ALREADY_USED'), '授权码必须一次性消费')
assert(files.authorization.includes('differenceFingerprint'), '授权必须绑定差异指纹')
assert(files.logs.includes('startedAt') && files.logs.includes('endedAt'), '操作日志必须支持时间范围筛选')

assert(files.sewingReturn.includes('min="0"') && files.sewingReturn.includes('本次至少一个 SKU 大于 0'), '公共 PDA 必须允许单个 SKU 为 0，并显式阻断整批为 0')
assert(files.sewingReturn.includes('不展示待办列表'), '公共 PDA 初始不得展示回货任务池')
assert(files.sewingReturn.includes('查看并确认') && files.sewingReturn.includes('SKU 明细'), '车缝自助回货记录必须进入逐 SKU 确认并可展开明细')
assert(files.sewingReturn.includes('废弃本次回货') && files.sewingReturn.includes('discardPostFinishingFactoryReturn'), '车缝自助回货 PDA 必须允许废弃尚未最终接收的记录')
for (const required of ['来源任务', '本来源可登记', 'defaultStagingLocation', '管理员退出']) {
  assert(files.sewingReturn.includes(required), `公共 PDA 回货识别结果缺少 ${required}`)
}
assert(files.pdaFlow.includes('初始不展示待确认任务池'), '回货确认 PDA 初始不得展示任务池')
assert(files.pdaFlow.includes('二次仍超过 5%才扫描授权码'), '回货确认 PDA 必须展示正确的二次点数规则')
assert(files.pdaFlow.includes('不超过 5%，可直接确认') && files.pdaFlow.includes("policy === 'return-line'"), '回货确认 PDA 必须按逐 SKU 5%阈值实时解释授权结果')
assert(files.pdaFlow.includes('废弃本次回货') && files.pdaFlow.includes("action === 'discard-return'"), '回货确认 PDA 必须允许废弃尚未最终接收的回货记录')
assert(files.pdaFlow.includes('质检单') && files.pdaFlow.includes('已自动生成'), '回货最终确认后 PDA 必须展示自动生成的质检单号')
assert(files.pdaFlow.includes("actor('回货确认人员')"), '回货确认 PDA 必须读取当前登录账号')
assert(files.pdaFlow.includes('未找到完整后道加工单号') && files.pdaFlow.includes('data-post-process-qty'), 'PDA精确识别原加工单并逐项登记本次数量')
assert(files.pdaFlow.includes('save-process-completion') && files.pdaFlow.includes('本次完成数量'), 'PDA加工主动作表示本次增量而非覆盖累计')
assert(!files.pdaFlow.includes('toggle-process-item'), '后道 PDA 不得再次勾选质检已确认的加工项目')
assert(!files.pdaFlow.includes('data-post-adjust-field="unprocessedQty"') && !files.pdaFlow.includes('data-post-adjust-field="unprocessedReason"') && files.pdaFlow.includes('旧整单“未处理数量”登记入口已停用'), '旧未处理归类表单退役，深链接只显示当前只读说明')
for (const forbidden of ['data-post-defect-reason-qty', 'data-post-adjust-field="returnQty"', 'data-return-receiver-search', 'data-return-receiver-options']) {
  assert(!files.pdaFlow.includes(forbidden), `后道 PDA 不得保留质量或返厂字段：${forbidden}`)
}
assert(!files.pdaFlow.includes('scanPostFinishingRecheckSkuBarcode') && !files.pdaFlow.includes('claimPostFinishingRecheckOrder'), 'PDA活动复检动作退役')
assert(!files.pdaFlow.includes('扫描后道出货单条码') && !files.pdaFlow.includes('本人最近收货'), '后道工厂 PDA 不得保留成衣仓收货页面内容')
for (const summary of ['return-line', 'return-total']) {
  assert(files.pdaFlow.includes(`'${summary}'`), `PDA 缺少实时数量摘要 ${summary}`)
}
assert(files.pdaFlow.includes('submit-for-outbound') && files.pdaFlow.includes('dispatch-outbound') && files.pdaFlow.includes('data-post-outbound-qty'), 'PDA按SKU准备出货并另行确认实际发出')
assert(files.pdaFlow.includes('data-difference-authorization-block') && files.pdaFlow.includes("classList.toggle('hidden', !visible)"), 'PDA 各环节必须仅在有差异时显示授权区')

assert(files.warehouse.includes('首次差异率超过 5%才要求二次点数'), 'Web 回货确认不得保留“任何差异都二次点数”的旧规则')
assert(files.warehouse.includes('回货 SKU 明细') && files.warehouse.includes('data-return-readonly-line'), 'Web 回货详情必须在确认后继续展示逐 SKU 明细')
assert(files.warehouse.includes('废弃回货记录') && files.warehouse.includes('full-flow-discard-return'), 'Web 车缝回货登记必须允许废弃尚未最终接收的记录')
assert(files.warehouse.includes("record.status !== '已废弃'"), '已废弃回货不得计入后道待加工仓库存')
assert(!files.warehouse.includes("record.status !== '已确认待送检' && record.status !== '已送检' && record.status !== '已完成'"), '已废弃回货详情不得继续渲染点数确认表')
assert(files.warehouse.includes('分母始终为工厂登记数量'), 'Web 回货确认必须说明差异分母')
assert(!files.warehouse.includes('任一 SKU 首次点数有差异必须二次点数'), 'Web 回货确认仍残留错误阈值文案')
assert(!files.warehouse.includes('data-qc-reference-file') && !files.warehouse.includes('full-flow-upload-reference'), '待加工仓不得继续提供按回货单上传的旧质检资料入口')
assert(files.warehouse.includes("title: mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓'"), 'Web 两类仓库必须共用线上基线式列表结构')
assert(files.warehouse.includes('确认回货后生成入仓流水，送检后生成出仓流水'), '后道待加工仓必须显示回货入仓和送检出仓事实')
assert(files.warehouse.includes('准备出货后生成待出货入区流水，确认实际发出后生成交出流水'), '待出货区必须按准备与实际发出分别展示流水')
assert(!files.pdaHandoverDetail.includes('POST_FINISHING_PICKUP') && !files.pdaHandoverDetail.includes('POST_FINISHING_SELF_RETURN_PICKUP'), '通用 PDA 交接详情不得继续识别旧后道回货接收单')
assert(files.warehouse.includes("{ key: 'inventory', label: '库存' }") && files.warehouse.includes("{ key: 'movements', label: '流水记录' }") && files.warehouse.includes("{ key: 'locations', label: '库区库位' }"), '两类仓库必须保留线上库存、流水记录和库区库位页签')
assert(files.warehouse.includes('>回货确认<') && files.warehouse.includes('完整送货单号'), 'Web 后道待加工仓必须提供输入完整单号的回货确认入口')
assert(files.workOrders.includes('登记加工') && files.workOrders.includes('查看加工单') && !files.workOrders.includes('PDA 执行（优先）') && !files.workOrders.includes('Web 应急处理'), 'Web加工单以逐项登记为入口，不建立整单抢占前置')
assert(files.workOrders.includes('POST_FINISHING_PROCESS_ITEMS.map') && files.workOrders.includes('completedQty') && files.workOrders.includes('不涉及'), '加工单列表直接提供四项各自数量及不涉及表达')
assert(files.workOrderDetail.includes('data-post-entry-responsible') && files.workOrderDetail.includes('data-post-entry-quantity') && files.workOrderDetail.includes('open-outbound'), 'Web提供本次数量、责任人及独立准备出货动作')

assert(files.qcWorkbench.includes('输入完整质检单号'), 'Web 质检执行页必须输入完整单号')
assert(!files.qcWorkbench.includes('扫描完整质检单号'), 'Web 质检不得把单号输入描述为扫描')
for (const token of ['本次固定检查要求','实际已检','尚需检查','data-qc-issue','data-qc-result-field','data-qc-paper-file','data-qc-upgrade-percent','同件多问题只计一件','正常可放行']) assert(files.qcWorkbench.includes(token), `QC新表面缺少 ${token}`)
assert(!files.qcWorkbench.includes('瑕疵数量由各原因自动汇总'), '问题项目不再相加成坏件数')
assert(files.qcWorkbench.includes('本批QC完成前不交出任何部分货物'), '抽检样本不能提前放行')
assert(files.qcWorkbench.includes('库存不额外要求纸面双签'), '库存沿用原检查入口但不加生产双签前置')
assert(!files.qcOrders.includes('主管释放') && !files.qcOrders.includes('full-flow-supervisor-release-qc'), '质检清单不保留已退役的退领、接替或清空结果入口')
assert(!existsSync(new URL('../src/pages/process-factory/post-finishing/recheck-orders.ts', import.meta.url)), '退役复检执行页面必须删除；历史保持原只读事实')
assert(!files.fcsRoutes.includes('/fcs/craft/post-finishing/recheck-orders') && !files.pdaRoutes.includes('/fcs/pda/post-finishing/recheck'), '活动复检地址退出路由')
assert(files.pdaHandoverDetail.includes('dispatch-post-outbound') && files.pdaHandoverDetail.includes('runPostFinishingCommand'), '通用交接后道分支只在原库确认实际发出')
assert(!files.pdaHandoverEvents.includes('lines.find((line) => line.availableHandoverGarmentQty >= submittedQty)'), '不能按第一条足量SKU代填交出对象')
assert(files.tasks.includes("title: '后道生产任务'") && files.tasks.includes('回货记录') && files.tasks.includes('view-qc-orders'), '后道生产任务页必须以生产单汇总并可查看多次回货与多张质检单')
assert(files.qcOrders.includes('getCurrentPostFinishingActor') && !files.qcOrders.includes("query().get('actor')"), 'Web 质检身份必须来自当前登录身份，不得由网址参数切换')
assert(files.qcWorkbench.includes('getCurrentPostFinishingActor') && !files.qcWorkbench.includes("query().get('actor')"), 'Web 质检工作台身份必须来自当前登录身份，不得由网址参数切换')

const reachableUi = [
  files.sewingReturn, files.pdaFlow, files.pdaQuality, files.pdaExecDetail, files.pdaWarehouse,
  files.warehouse, files.qcWorkbench, files.qcOrders, files.tasks, files.workOrders, files.authorizationCode,
  files.outboundOrders, files.audit, files.productionDetail,
  files.fcsRoutes, files.pdaRoutes, files.fcsHandlers, files.pdaHandlers,
].join('\n')
for (const obsolete of [
  '创建质检单',
  'createQc=1',
  'PDA后道质检员',
  'PDA 后道质检员',
  'PDA复检员',
  '后道仓管员',
  '不关联来源任务，直接选择 SKU',
]) assert(!reachableUi.includes(obsolete), `可达界面仍残留旧入口或固定身份：${obsolete}`)
assert(!files.pdaQuality.includes('createPostFinishingQcOrder'), 'PDA 通用质检页不得调用旧后道手工建单')
assert(files.pdaQuality.includes('后道质检仅在 Web“执行质检”领取'), 'PDA 通用质检页必须提示 Web-only')
assert(read('../src/pages/pda-exec-detail.ts').includes("from './pda-post-finishing-exec-detail'"), '通用详情须调用同一后道详情模板')
for (const requiredPath of ['/fcs/pda/post-finishing/return-confirm', '/fcs/craft/post-finishing/qc-workbench', '/fcs/pda/post-finishing/execute', '/fcs/pda/handover?tab=handout']) {
  assert(files.pdaExecDetail.includes(requiredPath), `通用 PDA 任务详情缺少当前后道专用入口：${requiredPath}`)
}
for (const obsoleteAction of ['POST_QC_WEB_ONLY', 'POST_QC_START', 'POST_QC_FINISH', 'POST_FINISHING_START', 'POST_FINISHING_FINISH', 'POST_FINISHING_DIFFERENCE', 'SEWING_POST_START', 'SEWING_POST_COMPLETE']) {
  assert(!files.pdaExecDetail.includes(obsoleteAction), `通用 PDA 任务详情仍残留旧后道动作：${obsoleteAction}`)
}
assert(files.pdaHandover.includes('/fcs/pda/post-finishing/return-confirm'), '通用 PDA 交接页必须保留当前专用回货确认入口')
for (const obsoleteProjection of ['pickupSourceType', 'ensurePostFinishingSewingSelfReturnMockRecords', 'syncAllPostFinishingSewingSelfReturnHandoverRecords']) {
  assert(!files.pdaHandover.includes(obsoleteProjection), `通用 PDA 交接页仍残留旧回货投影：${obsoleteProjection}`)
  assert(!files.pdaHandoverEvents.includes(obsoleteProjection), `通用 PDA 交接事实仍残留旧回货投影：${obsoleteProjection}`)
}
assert(files.pdaWaitProcess.includes("from '../data/fcs/post-finishing-full-flow.ts'") && files.pdaWaitProcess.includes('/fcs/pda/post-finishing/return-confirm'), '待加工仓必须只读当前后道全流程事实并引导到专用回货确认页')
assert(!files.pdaWaitProcess.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord') && !files.pdaWaitProcess.includes('confirm-post-self-return'), '待加工仓不得保留旧回货直接入库处理器')
assert(!files.pdaHandoverDetail.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord') && !files.pdaHandoverDetail.includes('旧回货接收入口已关闭'), '通用交接详情不得保留旧后道接收兼容页面或写入动作')
assert(!files.postFinishingEvents.includes("if (action === 'open-self-return-confirm')") && !files.postFinishingEvents.includes("if (action === 'open-self-return-edit')"), 'Web 旧回货确认/修改处理器必须退出可达事件链')
assert(files.printRegistry.includes("templateCode: 'POST_FINISHING_QC_ORDER'"), '兼容质检打印模板必须仍由统一打印注册表解析')
assert(files.legacyQcPrint.includes('/fcs/craft/post-finishing/qc-workbench?taskNo='), '兼容质检单二维码必须进入 Web 质检工作台')
assert(files.legacyQcPrint.includes('扫码进入 Web 质检单执行页'), '兼容质检单打印说明必须明确 Web 质检入口')
assert(!files.legacyQcPrint.includes('postMobileAction=complete-qc') && !files.legacyQcPrint.includes('扫码进入 PDA 质检执行页'), '兼容质检单打印不得残留 PDA 质检跳转')

for (const scoped of [files.domain, files.sewingReturn, files.pdaFlow, files.warehouse, files.qcWorkbench, files.qcOrders, files.tasks, files.workOrders, files.outboundOrders, files.audit, files.print]) {
  assert(!scoped.includes('次品'), 'QC 后道新事实和用户界面必须统一使用“瑕疵”')
}

for (const required of [
  "type PrintType = 'SEND_QC' | 'QC_ORDER' | 'QC_DETAIL' | 'POST_ORDER' | 'OUTBOUND' | 'OUTBOUND_BARCODE' | 'OUTBOUND_HANGTAG'",
  '/fcs/craft/post-finishing/qc-workbench?taskNo=',
  '/fcs/pda/post-finishing/execute?id=',
  'data-business-document-barcode',
  '图片加载失败',
  'data-print-sheet="a4"',
  '回货确认人 / 时间',
  '质检交接时间',
  '送货单 / 质检单',
]) assert(files.print.includes(required), `打印闭环缺少 ${required}`)
assert(!files.print.includes('/fcs/pda/post-finishing/outbound-receive'), '后道出货单不得再指向后道工厂 PDA 的成衣仓收货入口')

for (const imageSurface of [files.sewingReturn, files.pdaFlow, files.warehouse, files.outboundOrders]) {
  assert(imageSurface.includes('图片加载中') && imageSurface.includes('图片加载失败'), '款式/SKU 图片表面必须有加载与失败状态')
  assert(imageSurface.includes('zoom-image'), '款式/SKU 缩略图必须能查看大图')
}

assert(files.audit.includes('data-audit-chain-detail') && files.audit.includes('差异与质检') && files.audit.includes('操作时间线'), '日志页必须采用业务链主从结构')
assert(files.audit.includes("listPostFinishingDefectRecords({ discoveryStage: '质检' })") && files.audit.includes('质量判断与返厂处置在 QC 登记'), '审计页必须把当前质量事实限制在 QC 节点')
assert(files.audit.includes('data-audit-detail-tab') && files.audit.includes('按阶段查看单据链') && files.audit.includes('按环节归组的操作记录'), '日志详情必须分层展示，不得继续把链路、差异和时间线全部平铺')
assert(files.audit.includes('if (selected)') && files.audit.includes('post-finishing-audit-detail-page'), '日志详情必须独立渲染，不得与筛选和业务链列表上下叠加')
assert(files.audit.includes('name="startedAt"') && files.audit.includes('name="endedAt"') && files.audit.includes('name="operator"') && files.audit.includes('name="authorizer"'), '主从日志页仍必须支持时间、操作人和授权人筛选')
assert(files.audit.includes('name="direction"') && files.audit.includes('name="authorizationResult"'), '主从日志页仍必须支持差异方向和授权结果筛选')
assert(!files.audit.includes('getPostFinishingAuthorizationDisplay') && !files.audit.includes("query().get('authorizerId')"), '操作日志页不得再夹带动态授权码入口')
assert(files.authorizationCode.includes('getCurrentPostFinishingAuthorizedPerson') && files.authorizationCode.includes('每个授权码只能使用一次'), '独立授权码页必须读取当前登录授权身份并说明一次性规则')
assert(files.authorizationCode.includes('当前账号没有授权权限') && !files.authorizationCode.includes("query().get('authorizerId')"), '非授权身份必须被阻断且不得通过网址参数切换')
assert(files.menu.includes("title: '后道待加工仓'") && files.menu.includes("title: '质检清单'") && files.menu.includes("title: '执行质检'") && files.menu.includes("title: '我的动态授权码'"), '后道菜单必须使用纠偏后的三个入口')
assert(!files.menu.includes("title: 'Web 质检工作台'"), 'Web 质检工作台不得保留独立菜单')
for (const [pageName, source] of Object.entries({
  质检单: files.qcOrders,
  质检单执行: files.qcWorkbench,
})) {
  assert(source.includes('renderPostFinishingQcPrintActions'), `${pageName}缺少质检单与质检单详情打印入口`)
}
for (const [pageName, source] of Object.entries({
  后道加工单: files.workOrders,
  后道加工详情: files.workOrderDetail,
  后道生产任务: files.tasks,
  后道统计: files.statistics,
  后道待加工仓与待交出仓: files.warehouse,
  后道出货单: files.outboundOrders,
  差异与操作日志: files.audit,
  我的动态授权码: files.authorizationCode,
})) {
  assert(!source.includes('renderPostFinishingQcPrintActions') && !source.includes('打印质检单') && !source.includes('type=QC_ORDER') && !source.includes('type=QC_DETAIL'), `${pageName}不得提供质检单打印入口`)
}
for (const relation of ['deliveryOrderNo', 'qcTaskNo', 'postTaskNo', 'productionOrderNo']) {
  assert(files.outboundOrders.includes(`record.${relation}`), `出货页面关联筛选缺少 ${relation}`)
}

const techPackText = `${files.techPackTypes}\n${files.techPacks}`
for (const forbidden of ['色差参考图', '尺寸判断标准', '质检参考资料']) {
  assert(!techPackText.includes(forbidden), `技术包不得新增后道质检资料字段：${forbidden}`)
}

console.log(JSON.stringify({
  suite: 'QC 后道全流程可达表面与反向迁移检查',
  webRoutes: webPaths.length,
  pdaRoutes: pdaPaths.length,
  printTypes: 7,
  result: '通过',
}, null, 2))

assert(files.domain.includes('getPostFinishingActiveQcTask'), '必须校验每人唯一未完成质检')
assert(!files.qcWorkbench.includes('full-flow-release-qc'), '员工执行页删除取消退领')
assert(!files.qcOrders.includes('data-spu-tech-field'), '清单删除参数维护表单')
