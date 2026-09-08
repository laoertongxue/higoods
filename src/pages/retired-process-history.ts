// @page-pattern: detail
import { escapeHtml } from '../utils.ts'
import { appStore } from '../state/store.ts'
import {
  getRetiredProcessHistory,
  listRetiredProcessHistory,
  type RetiredProcessHistoryRecord,
} from '../data/fcs/retired-process-history.ts'

// 只读档案详情和有限记录目录，不是当前业务列表，不注册任何事件或操作处理器。
const rootPath = '/fcs/history/retired-process-records'
const labels: Record<string, string> = {
  productionOrderNo: '历史生产单号', productionOrderId: '历史生产单 ID', cuttingTaskNo: '历史裁剪任务号',
  relatedTaskId: '历史任务 ID', materialSku: '物料编码', materialLabel: '物料名称',
  assignedFactoryName: '原加工工厂', processorFactoryName: '原加工工厂',
  purchaseDate: '采购日期', plannedShipDate: '计划交期', orderQty: '订单数量（件）',
  plannedQty: '原计划数量', returnedPassQty: '原合格回货数量', returnedFailQty: '原不合格回货数量', availableQty: '原可用数量',
  currentStage: '原阶段', status: '原状态', processType: '原工艺', notes: '历史备注', remark: '历史备注',
  recordNo: '铺布记录号', fabricRollNo: '布卷号', layerCount: '层数', actualSpreadLength: '实铺长度（米）',
  headLength: '布头长度（米）', tailLength: '布尾长度（米）', calculatedRollLength: '计算布卷长度（米）',
  enteredBy: '登记人', enteredAt: '登记时间', note: '备注',
  returnId: '回货记录号', returnedAt: '回货时间', qty: '数量', result: '回货结果', disposition: '原处理方式', qcId: '历史质检 ID',
  docType: '单据类型', docNo: '历史单号', createdAt: '创建时间', summaryText: '历史说明',
  size: '尺码', totalPieces: '总件数', netLength: '净长（米）', perPieceConsumption: '单件用量（米）',
  markerImageStatus: '原唛架图片状态', markerImageName: '原图片文件名', updatedAt: '更新时间', updatedBy: '更新人',
}
const values: Record<string, string> = {
  DRAFT: '草稿', PROCESSING: '加工中', PARTIAL_RETURNED: '部分回货', COMPLETED: '已回齐', CLOSED: '已关闭',
  PRINT: '印花', DYE: '染色', DYE_PRINT: '染印（历史合并工艺）', PASS: '合格', FAIL: '不合格',
  ACCEPT_AS_DEFECT: '按次品接收', SCRAP: '报废', ACCEPT: '接收',
  PICKUP_SLIP: '领料单', CONFIG_BATCH: '配料批次', PICKUP_RECORD: '领料记录', INBOUND: '入仓记录',
  NOT_UPLOADED: '未上传', UPLOADED: '已上传',
}
function show(value: unknown): string {
  const text = value == null || value === '' ? '未记录' : String(value)
  return escapeHtml(values[text] || text)
}
function fields(record: Record<string, unknown>, keys: string[]): string {
  return `<dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${keys.filter((key) => record[key] !== undefined).map((key) =>
    `<div class="min-w-0"><dt class="text-xs text-muted-foreground">${escapeHtml(labels[key] || key)}</dt><dd class="mt-1 break-words text-sm">${show(record[key])}</dd></div>`).join('')}</dl>`
}
function section(title: string, body: string): string {
  return `<section class="rounded-lg border bg-card p-4"><h2 class="mb-3 text-base font-semibold">${escapeHtml(title)}</h2>${body}</section>`
}
function records(title: string, value: unknown, keys: string[]): string {
  const items = Array.isArray(value) ? value : []
  return section(title, items.length ? items.map((item) => `<div class="border-b py-3 last:border-b-0">${fields(item, keys)}</div>`).join('') : '<p class="text-sm text-muted-foreground">原档案未记录明细。</p>')
}
function index(kind?: RetiredProcessHistoryRecord['kind']): string {
  return section('历史记录目录', `<p class="mb-3 text-sm text-muted-foreground">仅保留旧演示记录。点击旧 ID 或单号查看原始事实。</p><ul class="grid gap-2 sm:grid-cols-2">${listRetiredProcessHistory(kind).map((item) =>
    `<li><a class="text-sm text-blue-700 underline" href="${rootPath}/${encodeURIComponent(item.id)}">${escapeHtml(item.orderNo)} · ${escapeHtml(item.id)}</a></li>`).join('')}</ul>`)
}
export function renderRetiredProcessHistoryLegacyPage(kind: RetiredProcessHistoryRecord['kind']): string {
  const params = new URLSearchParams(appStore.getState().pathname.split('?')[1] || '')
  const identity = ['id', 'dpId', 'orderId', 'orderNo', 'cutPieceOrderId', 'cutPieceOrderNo', 'cutOrderId', 'cutOrderNo']
    .map((key) => params.get(key)).find(Boolean) || ''
  return renderRetiredProcessHistoryPage(identity, kind)
}
export function renderRetiredProcessHistoryPage(idOrOrderNo = '', kind?: RetiredProcessHistoryRecord['kind']): string {
  // 查询参数仅用于旧书签定位；未知 ID 不跳转任何可操作业务页。
  const record = idOrOrderNo ? getRetiredProcessHistory(idOrOrderNo) : null
  const banner = '<p class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">历史只读档案 · 未映射正式记录。以下为旧原型演示事实，不纳入当前数量和统计，不支持接收、加工、回货或修改。</p>'
  if (!record) return `<div class="space-y-4 p-4"><h1 class="text-xl font-semibold">${idOrOrderNo ? '未找到历史记录' : '退役加工记录档案'}</h1>${banner}${idOrOrderNo ? `<p class="break-words text-sm">未找到旧 ID 或单号：${escapeHtml(idOrOrderNo)}</p>` : ''}${index(kind)}</div>`
  const data = record.snapshot
  const details = record.kind === 'CUT_PIECE'
    ? section('原裁片资料', fields(data, ['productionOrderNo', 'cuttingTaskNo', 'assignedFactoryName', 'materialSku', 'materialLabel', 'orderQty', 'purchaseDate', 'plannedShipDate', 'currentStage', 'notes']))
      + section('物料图片', '<p class="text-sm text-amber-800">原档案未保存该物料的对象原图，图片缺失；不使用其他物料图片代替。</p>')
      + section('原唛架资料', fields(data.markerInfo as Record<string, unknown>, ['totalPieces', 'netLength', 'perPieceConsumption', 'markerImageStatus', 'markerImageName', 'updatedAt', 'updatedBy']))
      + records('原尺码配比（数量单位：件）', (data.markerInfo as Record<string, unknown>).sizeMix, ['size', 'qty'])
      + records('原铺布明细', data.spreadingRecords, ['recordNo', 'fabricRollNo', 'layerCount', 'actualSpreadLength', 'headLength', 'tailLength', 'calculatedRollLength', 'enteredBy', 'enteredAt', 'note'])
      + records('原关联单据', data.linkedDocuments, ['docType', 'docNo', 'status', 'createdAt', 'summaryText'])
    : section('原染印资料', fields(data, ['productionOrderId', 'relatedTaskId', 'processorFactoryName', 'processType', 'plannedQty', 'returnedPassQty', 'returnedFailQty', 'availableQty', 'status', 'createdAt', 'updatedAt', 'remark']))
      + section('数量与图片说明', '<p class="text-sm text-amber-800">旧记录未保存数量单位、BOM 物料与对象原图；数量按原值留档，不推定为米或件，也不补配其他对象图片。</p>')
      + records('原回货明细', data.returnBatches, ['returnId', 'returnedAt', 'qty', 'result', 'disposition', 'qcId'])
  return `<div class="space-y-4 p-4"><a class="text-sm text-blue-700 underline" href="${rootPath}">返回历史目录</a><header><h1 class="text-xl font-semibold">${escapeHtml(record.orderNo)}</h1><p class="mt-1 text-sm text-muted-foreground">历史 ID：${escapeHtml(record.id)}</p></header>${banner}${details}</div>`
}
