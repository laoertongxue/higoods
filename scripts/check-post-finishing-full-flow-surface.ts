#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
  pdaExecDetail: read('../src/pages/pda-exec-detail.ts'),
  pdaHandover: read('../src/pages/pda-handover.ts'),
  pdaHandoverDetail: read('../src/pages/pda-handover-detail.ts'),
  pdaWarehouse: read('../src/pages/pda-warehouse.ts'),
  pdaWaitProcess: read('../src/pages/pda-warehouse-wait-process.ts'),
  warehouse: read('../src/pages/process-factory/post-finishing/warehouse.ts'),
  qcWorkbench: read('../src/pages/process-factory/post-finishing/qc-workbench.ts'),
  qcOrders: read('../src/pages/process-factory/post-finishing/qc-orders.ts'),
  tasks: read('../src/pages/process-factory/post-finishing/tasks.ts'),
  workOrders: read('../src/pages/process-factory/post-finishing/work-orders.ts'),
  recheckOrders: read('../src/pages/process-factory/post-finishing/recheck-orders.ts'),
  outboundOrders: read('../src/pages/process-factory/post-finishing/outbound-orders.ts'),
  audit: read('../src/pages/process-factory/post-finishing/audit-records.ts'),
  authorizationCode: read('../src/pages/process-factory/post-finishing/authorization-code.ts'),
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
  '/fcs/craft/post-finishing/recheck-orders',
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
  '/fcs/pda/post-finishing/sku-adjustment',
  '/fcs/pda/post-finishing/recheck',
  '/fcs/pda/post-finishing/outbound-receive',
]
for (const path of pdaPaths) {
  assert(files.pdaRoutes.includes(`'${path}'`), `PDA 路由缺少 ${path}`)
  assert(files.pdaHandlers.includes(`exact('${path}')`), `PDA 处理器缺少 ${path}`)
}
assert(files.renderers.includes('renderPdaPostFinishingReturnConfirmationPage'), 'PDA 回货确认渲染器未注册')
assert(files.pdaWarehouse.includes('/fcs/pda/post-finishing/return-confirm'), '仓库 PDA 首页缺少回货确认入口')
assert(files.pdaWarehouse.includes('/fcs/pda/post-finishing/outbound-receive'), '仓库 PDA 首页缺少 FCK 收货入口')

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
  'claimPostFinishingRecheckOrder',
  'releasePostFinishingRecheckOrder',
  'scanPostFinishingRecheckSkuBarcode',
  'markPostFinishingRecheckSkuRelabeled',
  'upsertOutboundFromRecheck',
  'receivePostFinishingOutboundOrder',
  'setPostFinishingPostCompletedQuantity',
  'savePostFinishingPostSkuAdjustment',
  'defectReasonQuantities',
  'listPostFinishingPostReturnReceiverOptions',
  'completePostFinishingPostTaskFromDraft',
  'takeOverPostFinishingPostTask',
  'tracePostFinishingFullFlow',
  'listPostFinishingWaitProcessWarehouseRecords',
  'listPostFinishingWaitProcessWarehouseMovements',
  'listPostFinishingWaitHandoverWarehouseRecords',
  'listPostFinishingWaitHandoverWarehouseMovements',
  'loadPostFinishingDemoData',
]) assert(files.domain.includes(required), `共享全流程事实缺少 ${required}`)

assert(files.numbering.includes('idempotencyKey'), '统一编号服务必须按幂等键生成')
assert(files.numbering.includes('triggerSource'), '送货编号必须保留多触发来源')
assert(files.authorization.includes('TIME_WINDOW_MS = 30_000'), '授权码必须每 30 秒刷新')
assert(files.authorization.includes('ALREADY_USED'), '授权码必须一次性消费')
assert(files.authorization.includes('differenceFingerprint'), '授权必须绑定差异指纹')
assert(files.logs.includes('startedAt') && files.logs.includes('endedAt'), '操作日志必须支持时间范围筛选')
assert(files.references.includes('!record.qcTaskId') && files.references.includes('record.qcTaskId = input.qcTaskId'), '质检参考资料必须冻结绑定到具体质检任务')

assert(files.sewingReturn.includes('min="1"') && files.sewingReturn.includes('回货登记数量必须大于 0，不能静默忽略'), '公共 PDA 必须显式阻断 0 数量')
assert(files.sewingReturn.includes('不展示待办列表'), '公共 PDA 初始不得展示回货任务池')
for (const required of ['车缝任务', '生产计划', 'defaultStagingLocation', '管理员退出']) {
  assert(files.sewingReturn.includes(required), `公共 PDA 回货识别结果缺少 ${required}`)
}
assert(files.pdaFlow.includes('初始不展示待确认任务池'), '回货确认 PDA 初始不得展示任务池')
assert(files.pdaFlow.includes('二次仍超过 5%才扫描授权码'), '回货确认 PDA 必须展示正确的二次点数规则')
assert(files.pdaFlow.includes("actor('回货确认人员')"), '回货确认 PDA 必须读取当前登录账号')
assert(files.pdaFlow.includes('核对无误，开始后道'), '后道 PDA 必须扫码核对后再开始')
assert(files.pdaFlow.includes('data-post-completed-qty') && files.pdaFlow.includes('质检已确认加工项目'), '后道 PDA 必须只读展示质检已确认项目，并以逐 SKU 完成数量为主动作')
assert(!files.pdaFlow.includes('toggle-process-item'), '后道 PDA 不得再次勾选质检已确认的加工项目')
assert(files.pdaFlow.includes('调整瑕疵数量') && files.pdaFlow.includes('data-post-defect-reason-qty') && files.pdaFlow.includes('增加瑕疵') && files.pdaFlow.includes('减少瑕疵'), '后道 PDA 必须从 SKU 入口进入逐原因增减瑕疵页')
assert(!files.pdaFlow.includes('data-post-adjust-file="defectImage"') && !files.pdaFlow.includes('data-post-adjust-field="responsibleParty"'), '后道 PDA 调整页不得保留责任方或现场证据图片')
assert(files.pdaFlow.includes('data-return-receiver-search') && files.pdaFlow.includes('data-return-receiver-options'), '后道 PDA 返厂接收对象必须使用移动端可搜索选择器')
assert(files.pdaFlow.includes('本人最近收货'), '仓库 PDA 扫码首页必须展示当前账号最近收货')
assert(files.pdaFlow.includes('条码错误，已阻断出货') && files.pdaFlow.includes('已重新贴码') && files.pdaFlow.includes('必须复扫正确'), '复检 PDA 必须完成错码阻断、重贴和复扫恢复')
assert(files.pdaFlow.includes('只接受完整 FCK 后道出货单号'), '仓库 PDA 只能扫描 FCK 出货单')
for (const summary of ['return-line', 'return-total', 'recheck-line', 'recheck-total', 'warehouse-line', 'warehouse-total']) {
  assert(files.pdaFlow.includes(`'${summary}'`), `PDA 缺少实时数量摘要 ${summary}`)
}
assert(files.pdaFlow.includes('本批数量归类') && files.pdaFlow.includes('个 SKU 未完成数量归类'), '后道 PDA 必须按完成、瑕疵或返厂的逐 SKU 归类进度替代加工项目勾选')
assert(files.pdaFlow.includes('data-difference-authorization-block') && files.pdaFlow.includes("classList.toggle('hidden', !visible)"), 'PDA 各环节必须仅在有差异时显示授权区')

assert(files.warehouse.includes('首次差异率超过 5%才要求二次点数'), 'Web 回货确认不得保留“任何差异都二次点数”的旧规则')
assert(files.warehouse.includes('分母始终为工厂登记数量'), 'Web 回货确认必须说明差异分母')
assert(!files.warehouse.includes('任一 SKU 首次点数有差异必须二次点数'), 'Web 回货确认仍残留错误阈值文案')
for (const fakeDefault of ['value="本批质检判断依据"', 'value="买手通过飞书提供"', 'value="/materials/fabric-main.jpg"']) {
  assert(!files.warehouse.includes(fakeDefault), `质检参考资料不得伪造默认值：${fakeDefault}`)
}
assert(files.warehouse.includes('独立于技术包'), '质检参考资料必须明确独立于技术包')
assert(files.warehouse.includes('不伪造默认资料'), '未上传资料必须显示真实空态')
assert(files.warehouse.includes("title: mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓'"), 'Web 两类仓库必须共用线上基线式列表结构')
assert(files.warehouse.includes('确认回货后生成入仓流水，送检后生成出仓流水'), '后道待加工仓必须显示回货入仓和送检出仓事实')
assert(files.warehouse.includes('复检完成后生成入仓流水，仓库收货后生成交出流水'), '后道待交出仓必须显示复检入仓和出货交出事实')
assert(files.warehouse.includes("{ key: 'inventory', label: '库存' }") && files.warehouse.includes("{ key: 'movements', label: '流水记录' }") && files.warehouse.includes("{ key: 'locations', label: '库区库位' }"), '两类仓库必须保留线上库存、流水记录和库区库位页签')
assert(files.warehouse.includes('扫码收货（Web 兜底）') && files.warehouse.includes('PDA 扫码优先'), 'Web 后道待加工仓必须保留扫码收货兜底入口')
assert(files.workOrders.includes('PDA执行（优先）') && files.workOrders.includes('Web应急处理'), 'Web 后道单必须同时提供 PDA 优先和 Web 应急处理入口')

assert(files.qcWorkbench.includes('输入完整质检任务号'), 'Web 质检执行页必须输入完整任务号')
assert(!files.qcWorkbench.includes('扫描完整质检任务号'), 'Web 质检不得把任务号输入描述为扫描')
assert(files.qcWorkbench.includes('错误领取，退回待质检'), '质检任务必须支持退领')
assert(files.qcWorkbench.includes('已由 ${escapeHtml(task.claimedBy.actorName)} 质检中'), '质检占用必须显示具体质检员')
assert(files.qcWorkbench.includes('合格 + 瑕疵 + 返厂'), '质检必须逐 SKU 录入三类数量')
assert(files.qcWorkbench.includes('data-qc-task-reference-file') && files.qcWorkbench.includes('QC 代上传并绑定本次任务'), 'Web 质检必须支持当前 QC 可见上传并绑定本任务')
assert(files.qcWorkbench.includes('data-qc-result-file="defectImage"'), 'Web 质检必须提供可见瑕疵图片选择器')
assert(files.qcWorkbench.includes('data-qc-release-confirm') && files.qcWorkbench.includes('确认退领'), '质检退领必须二次确认并可填写原因')
assert(files.qcWorkbench.includes('data-qc-difference-authorization') && files.qcWorkbench.includes("classList.toggle('hidden', differentSkuCount === 0)"), 'Web 质检授权区必须仅在有差异时显示')
assert(files.qcOrders.includes('主管释放'), '质检管理页必须提供主管释放')
assert(files.qcOrders.includes('data-qc-task-input') && files.qcOrders.includes('输入质检任务号'), '质检任务页必须同时提供输入领取入口')
assert(files.recheckOrders.includes('full-flow-supervisor-release-recheck'), '复检管理页必须提供主管释放错误领取')
assert(files.tasks.includes('生产单级后道任务') && files.tasks.includes('查看全流程'), '后道任务页必须以生产单汇总并进入一单到底链路')
assert(files.qcOrders.includes('getCurrentPostFinishingActor') && !files.qcOrders.includes("query().get('actor')"), 'Web 质检身份必须来自当前登录身份，不得由网址参数切换')
assert(files.qcWorkbench.includes('getCurrentPostFinishingActor') && !files.qcWorkbench.includes("query().get('actor')"), 'Web 质检工作台身份必须来自当前登录身份，不得由网址参数切换')

const reachableUi = [
  files.sewingReturn, files.pdaFlow, files.pdaQuality, files.pdaExecDetail, files.pdaWarehouse,
  files.warehouse, files.qcWorkbench, files.qcOrders, files.tasks, files.workOrders, files.authorizationCode,
  files.recheckOrders, files.outboundOrders, files.audit, files.productionDetail,
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
assert(files.pdaQuality.includes('后道质检仅在 Web“质检任务”领取'), 'PDA 通用质检页必须提示 Web-only')
assert(files.pdaExecDetail.includes('POST_QC_WEB_ONLY') && !files.pdaExecDetail.includes('POST_QC_START') && !files.pdaExecDetail.includes('POST_QC_FINISH'), '旧 PDA 详情必须彻底停止后道质检动作')
assert(files.pdaHandover.includes("head.pickupSourceType !== 'SEWING_SELF_RETURN'"), '通用 PDA 交接列表必须过滤旧车缝自助回货接收单')
assert(!files.pdaHandover.includes('ensurePostFinishingSewingSelfReturnMockRecords') && !files.pdaHandover.includes('syncAllPostFinishingSewingSelfReturnHandoverRecords'), '通用 PDA 交接页不得再注入旧回货 Mock 或投影')
assert(files.pdaWaitProcess.includes('/fcs/pda/post-finishing/return-confirm'), '旧待加工仓的历史回货记录必须引导到专用回货确认页')
assert(!files.pdaWaitProcess.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord') && !files.pdaWaitProcess.includes('confirm-post-self-return'), '旧待加工仓不得保留直接确认入库处理器')
assert(files.pdaHandoverDetail.includes('旧回货接收入口已关闭') && files.pdaHandoverDetail.includes('/fcs/pda/post-finishing/return-confirm'), '旧交接详情直达路径必须阻断并引导到专用回货确认页')
assert(!files.pdaHandoverDetail.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord'), '旧交接详情不得直接确认车缝回货入库')
assert(!files.postFinishingEvents.includes("if (action === 'open-self-return-confirm')") && !files.postFinishingEvents.includes("if (action === 'open-self-return-edit')"), 'Web 旧回货确认/修改处理器必须退出可达事件链')
assert(files.printRegistry.includes("templateCode: 'POST_FINISHING_QC_ORDER'"), '兼容质检打印模板必须仍由统一打印注册表解析')
assert(files.legacyQcPrint.includes('/fcs/craft/post-finishing/qc-workbench?taskNo='), '兼容质检单二维码必须进入 Web 质检工作台')
assert(files.legacyQcPrint.includes('扫码进入 Web 质检任务执行页'), '兼容质检单打印说明必须明确 Web 质检入口')
assert(!files.legacyQcPrint.includes('postMobileAction=complete-qc') && !files.legacyQcPrint.includes('扫码进入 PDA 质检执行页'), '兼容质检单打印不得残留 PDA 质检跳转')

for (const scoped of [files.domain, files.sewingReturn, files.pdaFlow, files.warehouse, files.qcWorkbench, files.qcOrders, files.tasks, files.workOrders, files.recheckOrders, files.outboundOrders, files.audit, files.print]) {
  assert(!scoped.includes('次品'), 'QC 后道新事实和用户界面必须统一使用“瑕疵”')
}

for (const required of [
  "type PrintType = 'SEND_QC' | 'POST_ORDER' | 'OUTBOUND' | 'SKU_LABEL'",
  '/fcs/craft/post-finishing/qc-workbench?taskNo=',
  '/fcs/pda/post-finishing/execute?id=',
  '/fcs/pda/post-finishing/outbound-receive?id=',
  'data-business-document-barcode',
  'data-sku-label-barcode',
  'h-[30mm] w-[40mm]',
  '图片加载失败',
  'data-print-sheet="a4"',
  '数量来源',
  '回货确认人 / 时间',
  '质检交接时间',
  '送货单 / 质检任务',
]) assert(files.print.includes(required), `打印闭环缺少 ${required}`)

for (const imageSurface of [files.sewingReturn, files.pdaFlow, files.warehouse, files.qcWorkbench, files.recheckOrders, files.outboundOrders]) {
  assert(imageSurface.includes('图片加载中') && imageSurface.includes('图片加载失败'), '款式/SKU 图片表面必须有加载与失败状态')
  assert(imageSurface.includes('zoom-image'), '款式/SKU 缩略图必须能查看大图')
}

assert(files.audit.includes('data-audit-chain-detail') && files.audit.includes('差异与瑕疵') && files.audit.includes('操作时间线'), '日志页必须采用业务链主从结构')
assert(files.audit.includes('data-audit-detail-tab') && files.audit.includes('按阶段查看单据链') && files.audit.includes('按环节归组的操作记录'), '日志详情必须分层展示，不得继续把链路、差异和时间线全部平铺')
assert(files.audit.includes('name="startedAt"') && files.audit.includes('name="endedAt"') && files.audit.includes('name="operator"') && files.audit.includes('name="authorizer"'), '主从日志页仍必须支持时间、操作人和授权人筛选')
assert(files.audit.includes('name="direction"') && files.audit.includes('name="authorizationResult"'), '主从日志页仍必须支持差异方向和授权结果筛选')
assert(!files.audit.includes('getPostFinishingAuthorizationDisplay') && !files.audit.includes("query().get('authorizerId')"), '操作日志页不得再夹带动态授权码入口')
assert(files.authorizationCode.includes('getCurrentPostFinishingAuthorizedPerson') && files.authorizationCode.includes('每个授权码只能使用一次'), '独立授权码页必须读取当前登录授权身份并说明一次性规则')
assert(files.authorizationCode.includes('当前账号没有授权权限') && !files.authorizationCode.includes("query().get('authorizerId')"), '非授权身份必须被阻断且不得通过网址参数切换')
assert(files.menu.includes("title: '后道待加工仓'") && files.menu.includes("title: '质检任务'") && files.menu.includes("title: '我的动态授权码'"), '后道菜单必须使用纠偏后的三个入口')
assert(!files.menu.includes("title: 'Web 质检工作台'"), 'Web 质检工作台不得保留独立菜单')
for (const relation of ['deliveryOrderNo', 'qcTaskNo', 'postTaskNo', 'recheckOrderNo', 'productionOrderNo']) {
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
  printTypes: 4,
  result: '通过',
}, null, 2))
