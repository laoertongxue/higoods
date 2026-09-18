import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { listPmsTransitOrderChecks, listPmsTransitPreparationTasks, type PmsTransitOrderCheck, type PmsTransitPreparationTask } from '../../data/pms/transit-warehouse.ts'
import { escapeHtml } from '../../utils.ts'
import { formatPmsQty, renderPmsStatusBadge } from './shared.ts'
import { createPmsResultListPage } from './result-list.ts'

const checkColumns: StandardListColumn<PmsTransitOrderCheck>[] = [
  {
    key: 'production',
    title: '生产单号',
    width: 200,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.productionNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.productionNo)}</div><div class="mt-1 text-xs text-slate-500">校验 ${escapeHtml(row.checkedAt)}</div>`,
  },
  {
    key: 'receipt',
    title: '收货状态',
    width: 140,
    sortable: true,
    sortValue: (row) => row.receivedStatus,
    render: (row) => renderPmsStatusBadge(row.receivedStatus, row.receivedStatus === '已收齐' ? 'green' : row.receivedStatus === '未收齐' ? 'yellow' : 'red'),
  },
  {
    key: 'note',
    title: '说明',
    width: 320,
    render: (row) => `<div class="text-xs text-slate-600">${escapeHtml(row.note || '—')}</div><div class="mt-1 text-xs text-slate-400">只读读取生产单现有校验结果，不根据配料任务状态反推</div>`,
  },
]

const taskColumns: StandardListColumn<PmsTransitPreparationTask>[] = [
  {
    key: 'task',
    title: '配料任务',
    width: 200,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.taskId,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.taskId)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.type)}</div>`,
  },
  {
    key: 'production',
    title: '生产单号',
    width: 180,
    sortable: true,
    sortValue: (row) => row.productionNo,
    render: (row) => `<div class="text-sm">${escapeHtml(row.productionNo)}</div><div class="mt-1 text-xs text-slate-500">负责人 ${escapeHtml(row.owner)}</div>`,
  },
  {
    key: 'qty',
    title: '任务量',
    width: 140,
    sortable: true,
    sortValue: (row) => row.qty,
    render: (row) => `<div class="text-sm tabular-nums">${formatPmsQty(row.qty, row.unit)}</div>`,
  },
  {
    key: 'type',
    title: '配料类型',
    width: 160,
    sortable: true,
    sortValue: (row) => row.type,
    render: (row) => renderPmsStatusBadge(row.type, row.type === '已收齐配料' ? 'green' : 'yellow'),
  },
  {
    key: 'note',
    title: '说明',
    width: 320,
    render: () => '<div class="text-xs text-slate-400">展示配料单现有类型；配料类型不作为任务完成状态</div>',
  },
]

const orderChecksList = createPmsResultListPage<PmsTransitOrderCheck>({
  title: '生产单校验',
  emptyText: '当前条件下暂无校验记录',
  exportName: '生产单校验.csv',
  exportHeaders: ['生产单号', '收货状态', '读取时间', '说明'],
  exportRow: (row) => [row.productionNo, row.receivedStatus, row.checkedAt, row.note],
  keywordPlaceholder: '生产单号 / 收货状态',
  note: '只读校验结果页',
  columns: checkColumns,
  getRows: listPmsTransitOrderChecks,
  searchValues: (row) => [row.productionNo, row.receivedStatus, row.note],
  stats: (rows) => [
    { label: '生产单', value: rows.length },
    { label: '缺货', value: rows.filter((row) => row.receivedStatus === '缺货').length },
    { label: '未收齐', value: rows.filter((row) => row.receivedStatus === '未收齐').length },
    { label: '已收齐', value: rows.filter((row) => row.receivedStatus === '已收齐').length },
  ],
  preferenceKey: 'higood:list:/pms/transit/order-checks',
  eventPrefix: 'pms-trno',
  rootSelector: '[data-pms-trno-root]',
})

const preparationTasksList = createPmsResultListPage<PmsTransitPreparationTask>({
  title: '配料任务',
  emptyText: '当前条件下暂无配料任务',
  exportName: '配料任务.csv',
  exportHeaders: ['任务号', '类型', '生产单号', '任务量', '单位', '负责人'],
  exportRow: (row) => [row.taskId, row.type, row.productionNo, row.qty, row.unit, row.owner],
  keywordPlaceholder: '任务号 / 类型 / 生产单号 / 负责人',
  note: '只读任务列表',
  columns: taskColumns,
  getRows: listPmsTransitPreparationTasks,
  searchValues: (row) => [row.taskId, row.type, row.productionNo, row.owner],
  stats: (rows) => [
    { label: '任务总数', value: rows.length },
    { label: '已收齐配料', value: rows.filter((row) => row.type === '已收齐配料').length },
    { label: '未收齐配料', value: rows.filter((row) => row.type === '未收齐配料').length },
  ],
  preferenceKey: 'higood:list:/pms/transit/preparation-tasks',
  eventPrefix: 'pms-trnp',
  rootSelector: '[data-pms-trnp-root]',
})

export function renderPmsTransitOrderChecksPage(): string {
  return orderChecksList.render()
}

export function handlePmsTransitOrderChecksEvent(target: HTMLElement): boolean {
  return orderChecksList.handle(target)
}

export function closePmsTransitOrderCheckOverlays(): boolean {
  return orderChecksList.close()
}

export function renderPmsTransitPreparationTasksPage(): string {
  return preparationTasksList.render()
}

export function handlePmsTransitPreparationTasksEvent(target: HTMLElement): boolean {
  return preparationTasksList.handle(target)
}

export function closePmsTransitPreparationTaskOverlays(): boolean {
  return preparationTasksList.close()
}

export function handlePmsTransitSimpleListEvent(target: HTMLElement): boolean {
  return orderChecksList.handle(target) || preparationTasksList.handle(target)
}

export function closePmsTransitSimpleListOverlays(): boolean {
  return orderChecksList.close() || preparationTasksList.close()
}
