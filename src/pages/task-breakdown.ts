import { productionOrders, type ProductionOrder } from '../data/fcs/production-orders'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import { initialDyePrintOrders } from '../data/fcs/store-domain-quality-seeds'
import {
  initialMaterialIssueSheets,
  initialQcStandardSheets,
} from '../data/fcs/store-domain-dispatch-process'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml, toClassName } from '../utils'

applyQualitySeedBootstrap()

type TaskBreakdownTab = 'by-order' | 'all'

interface TaskBreakdownState {
  keyword: string
  activeTab: TaskBreakdownTab
  chainDetailOrderId: string | null
}

interface FallbackTask extends ProcessTask {
  _isFallback?: true
  _hasMaterial?: boolean
  _hasQc?: boolean
}

interface OrderRow {
  order: ProductionOrder
  tasks: ProcessTask[]
  sorted: ProcessTask[]
  mainCount: number
  subCount: number
  dyeCount: number
  materialCount: number
  qcCount: number
  chain: string
  isFallback: boolean
}

const state: TaskBreakdownState = {
  keyword: '',
  activeTab: 'by-order',
  chainDetailOrderId: null,
}

const DYE_KEYWORDS = ['染', '印花', '染色', '染印', '印染']
const STAGE_ORDER = ['裁', '染', '绣', '印', '车', '缝', '后整', '整烫', '包']

function isDyeTask(name: string): boolean {
  return DYE_KEYWORDS.some((keyword) => name.includes(keyword))
}

function stageScore(name: string): number {
  const idx = STAGE_ORDER.findIndex((keyword) => name.includes(keyword))
  return idx === -1 ? 99 : idx
}

function inferDeps(tasks: ProcessTask[]): ProcessTask[] {
  if (tasks.length === 0) return tasks

  const hasAnyDep = tasks.some((task) => (task.dependsOnTaskIds ?? []).length > 0)
  if (hasAnyDep) return tasks

  const sorted = [...tasks].sort(
    (a, b) => a.seq - b.seq || stageScore(a.processNameZh) - stageScore(b.processNameZh),
  )

  return sorted.map((task, idx) => ({
    ...task,
    dependsOnTaskIds: idx === 0 ? [] : [sorted[idx - 1].taskId],
  }))
}

function createFallbackTask(
  orderId: string,
  taskId: string,
  seq: number,
  processCode: string,
  processNameZh: string,
  stage: ProcessTask['stage'],
  dependsOnTaskIds: string[],
  extras?: Partial<FallbackTask>,
): FallbackTask {
  return {
    taskId,
    productionOrderId: orderId,
    seq,
    processCode,
    processNameZh,
    stage,
    qty: 0,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'UNASSIGNED',
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    qcPoints: [],
    attachments: [],
    auditLogs: [],
    createdAt: '',
    updatedAt: '',
    status: 'NOT_STARTED',
    dependsOnTaskIds,
    _isFallback: true,
    ...extras,
  }
}

function makeFallbackTasks(orderId: string, variant: number): FallbackTask[] {
  if (variant === 0) {
    return [
      createFallbackTask(orderId, `${orderId}-FB-001`, 1, 'CUT', '裁剪', 'CUTTING', []),
      createFallbackTask(orderId, `${orderId}-FB-002`, 2, 'SEW', '车缝', 'SEWING', [`${orderId}-FB-001`], {
        _hasMaterial: true,
      }),
      createFallbackTask(orderId, `${orderId}-FB-003`, 3, 'POST', '后整', 'POST', [`${orderId}-FB-002`]),
      createFallbackTask(orderId, `${orderId}-FB-004`, 4, 'PACK', '包装', 'POST', [`${orderId}-FB-003`], {
        _hasQc: true,
      }),
    ]
  }

  if (variant === 1) {
    return [
      createFallbackTask(orderId, `${orderId}-FB-001`, 1, 'CUT', '裁剪', 'CUTTING', []),
      createFallbackTask(orderId, `${orderId}-FB-002`, 2, 'DYE', '染印', 'SEWING', [`${orderId}-FB-001`]),
      createFallbackTask(orderId, `${orderId}-FB-003`, 3, 'SEW', '车缝', 'SEWING', [`${orderId}-FB-002`]),
      createFallbackTask(orderId, `${orderId}-FB-004`, 4, 'POST', '后整', 'POST', [`${orderId}-FB-003`], {
        _hasQc: true,
      }),
    ]
  }

  return [
    createFallbackTask(orderId, `${orderId}-FB-001`, 1, 'CUT', '裁剪', 'CUTTING', []),
    createFallbackTask(orderId, `${orderId}-FB-002`, 2, 'SEW', '车缝', 'SEWING', [`${orderId}-FB-001`], {
      _hasMaterial: true,
    }),
    createFallbackTask(orderId, `${orderId}-FB-003`, 3, 'PACK', '包装', 'POST', [`${orderId}-FB-002`]),
  ]
}

function topoSort(tasks: ProcessTask[]): ProcessTask[] {
  if (tasks.length === 0) return []

  const ids = new Set(tasks.map((task) => task.taskId))
  const indegree: Record<string, number> = {}

  for (const task of tasks) {
    indegree[task.taskId] = (task.dependsOnTaskIds ?? []).filter((id) => ids.has(id)).length
  }

  const queue = tasks
    .filter((task) => indegree[task.taskId] === 0)
    .sort((a, b) => stageScore(a.processNameZh) - stageScore(b.processNameZh))

  const result: ProcessTask[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current.taskId)) continue

    visited.add(current.taskId)
    result.push(current)

    for (const next of tasks.filter((task) => (task.dependsOnTaskIds ?? []).includes(current.taskId))) {
      indegree[next.taskId] = Math.max(0, indegree[next.taskId] - 1)
      if (indegree[next.taskId] === 0) {
        queue.push(next)
      }
    }
  }

  for (const task of tasks) {
    if (!visited.has(task.taskId)) {
      result.push(task)
    }
  }

  return result
}

function getAllProcessTasks(): ProcessTask[] {
  const result: ProcessTask[] = []
  const tasksByOrder = new Map<string, ProcessTask[]>()

  for (const task of processTasks) {
    const current = tasksByOrder.get(task.productionOrderId) ?? []
    current.push(task)
    tasksByOrder.set(task.productionOrderId, current)
  }

  for (const tasks of tasksByOrder.values()) {
    result.push(...inferDeps(tasks))
  }

  let fallbackCount = 0
  for (const order of productionOrders) {
    if (fallbackCount >= 3) break
    const tasks = tasksByOrder.get(order.productionOrderId)
    if (!tasks || tasks.length === 0) {
      result.push(...makeFallbackTasks(order.productionOrderId, fallbackCount % 3))
      fallbackCount += 1
    }
  }

  return result
}

function getTaskMaterialSet(allTasks: ProcessTask[]): Set<string> {
  const set = new Set<string>()
  for (const sheet of initialMaterialIssueSheets) {
    if (sheet.taskId) set.add(sheet.taskId)
  }
  for (const task of allTasks) {
    if ((task as FallbackTask)._hasMaterial) {
      set.add(task.taskId)
    }
  }
  return set
}

function getTaskQcSet(allTasks: ProcessTask[]): Set<string> {
  const set = new Set<string>()
  for (const sheet of initialQcStandardSheets) {
    if (sheet.taskId) set.add(sheet.taskId)
  }
  for (const task of allTasks) {
    if ((task as FallbackTask)._hasQc) {
      set.add(task.taskId)
    }
  }
  return set
}

function getTaskDyeSet(allTasks: ProcessTask[]): Set<string> {
  const set = new Set<string>()

  for (const dye of initialDyePrintOrders) {
    set.add(dye.relatedTaskId)
  }

  for (const task of allTasks) {
    if ((task as FallbackTask)._isFallback && isDyeTask(task.processNameZh)) {
      set.add(task.taskId)
    }
  }

  return set
}

function chainTypeZh(task: ProcessTask): string {
  return isDyeTask(task.processNameZh) ? '次链路' : '主链路'
}

function chainTypeClass(task: ProcessTask): string {
  return isDyeTask(task.processNameZh)
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-slate-50 text-slate-700 border-slate-200'
}

function prevNames(task: ProcessTask, allTasks: ProcessTask[]): string {
  const ids = task.dependsOnTaskIds ?? []
  if (ids.length === 0) return '起始任务'
  return ids
    .map((id) => allTasks.find((item) => item.taskId === id)?.processNameZh ?? id)
    .join('、')
}

function nextNames(task: ProcessTask, allTasks: ProcessTask[]): string {
  const downstream = allTasks.filter((item) => (item.dependsOnTaskIds ?? []).includes(task.taskId))
  if (downstream.length === 0) return '末端任务'
  return downstream.map((item) => item.processNameZh).join('、')
}

function chainSummaryText(
  sorted: ProcessTask[],
  materialTaskIds: Set<string>,
  qcTaskIds: Set<string>,
): string {
  if (sorted.length === 0) return '—'

  return sorted
    .map((task) => {
      let label = task.processNameZh
      const fallbackTask = task as FallbackTask

      if (isDyeTask(label)) {
        label += '（次链路）'
      }

      if (materialTaskIds.has(task.taskId) || fallbackTask._hasMaterial) {
        label += '（需领料）'
      }

      if (qcTaskIds.has(task.taskId) || fallbackTask._hasQc) {
        label += '（需质检）'
      }

      return label
    })
    .join(' → ')
}

function renderNeedBadge(need: boolean, className: string): string {
  if (!need) {
    return '<span class="text-xs text-muted-foreground">不需要</span>'
  }
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-[11px] ${className}">需要</span>`
}

function renderChainDetailDialog(
  chainDetailOrderId: string | null,
  chainDetailOrder: ProductionOrder | null,
  chainDetailTasks: ProcessTask[],
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
): string {
  if (!chainDetailOrderId) return ''

  const subtitle = chainDetailOrder
    ? `${chainDetailOrder.productionOrderId}${
        chainDetailOrder.mainFactorySnapshot?.name
          ? `・${chainDetailOrder.mainFactorySnapshot.name}`
          : ''
      }`
    : chainDetailOrderId

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-breakdown-action="close-dialog" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-h-[80vh] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-breakdown-action="close-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
        <h3 class="text-lg font-semibold">
          任务链详情
          <span class="ml-2 text-sm font-normal text-muted-foreground">${escapeHtml(subtitle)}</span>
        </h3>

        <div class="rounded-md border mt-2">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-muted/40">
                  <th class="w-10 px-3 py-2 text-left font-medium">序</th>
                  <th class="px-3 py-2 text-left font-medium">任务名称</th>
                  <th class="px-3 py-2 text-left font-medium">前置任务</th>
                  <th class="px-3 py-2 text-left font-medium">后置任务</th>
                  <th class="px-3 py-2 text-left font-medium">链路类型</th>
                  <th class="px-3 py-2 text-center font-medium">染印承接</th>
                  <th class="px-3 py-2 text-center font-medium">领料需求</th>
                  <th class="px-3 py-2 text-center font-medium">质检标准</th>
                </tr>
              </thead>
              <tbody>
                ${
                  chainDetailTasks.length === 0
                    ? '<tr><td colspan="8" class="py-8 text-center text-sm text-muted-foreground">暂无任务数据</td></tr>'
                    : chainDetailTasks
                        .map((task, idx) => {
                          const hasDye = taskDyeSet.has(task.taskId)
                          const hasMaterial = taskMaterialSet.has(task.taskId)
                          const hasQc = taskQcSet.has(task.taskId)
                          return `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2 text-xs text-muted-foreground">${idx + 1}</td>
                              <td class="px-3 py-2 text-sm font-medium">${escapeHtml(task.processNameZh)}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(prevNames(task, chainDetailTasks))}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(nextNames(task, chainDetailTasks))}</td>
                              <td class="px-3 py-2">
                                <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${chainTypeClass(task)}">${chainTypeZh(task)}</span>
                              </td>
                              <td class="px-3 py-2 text-center">${renderNeedBadge(hasDye, 'bg-indigo-50 text-indigo-700 border-indigo-200')}</td>
                              <td class="px-3 py-2 text-center">${renderNeedBadge(hasMaterial, 'bg-amber-50 text-amber-700 border-amber-200')}</td>
                              <td class="px-3 py-2 text-center">${renderNeedBadge(hasQc, 'bg-cyan-50 text-cyan-700 border-cyan-200')}</td>
                            </tr>
                          `
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
      </div>
    </div>
  `
}

function getOrderRows(
  allTasks: ProcessTask[],
  keyword: string,
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
): OrderRow[] {
  return productionOrders
    .filter((order) => {
      if (!keyword) return true
      return (
        order.productionOrderId.toLowerCase().includes(keyword) ||
        (order.mainFactorySnapshot?.name ?? '').includes(keyword)
      )
    })
    .map((order) => {
      const tasks = allTasks.filter((task) => task.productionOrderId === order.productionOrderId)
      const sorted = topoSort(tasks)
      const mainCount = sorted.filter((task) => !isDyeTask(task.processNameZh)).length
      const subCount = sorted.filter((task) => isDyeTask(task.processNameZh)).length
      const dyeCount = tasks.filter((task) => taskDyeSet.has(task.taskId)).length
      const materialCount = tasks.filter((task) => taskMaterialSet.has(task.taskId)).length
      const qcCount = tasks.filter((task) => taskQcSet.has(task.taskId)).length
      const isFallback = tasks.some((task) => (task as FallbackTask)._isFallback)
      const chain = tasks.length > 0 ? chainSummaryText(sorted, taskMaterialSet, taskQcSet) : '—'

      return {
        order,
        tasks,
        sorted,
        mainCount,
        subCount,
        dyeCount,
        materialCount,
        qcCount,
        chain,
        isFallback,
      }
    })
}

function renderByOrderTable(orderRows: OrderRow[]): string {
  return `
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/40">
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">主工厂</th>
            <th class="px-3 py-2 text-center font-medium">任务总数</th>
            <th class="px-3 py-2 text-center font-medium">主链路</th>
            <th class="px-3 py-2 text-center font-medium">次链路</th>
            <th class="min-w-[320px] px-3 py-2 text-left font-medium">任务链摘要</th>
            <th class="px-3 py-2 text-left font-medium">执行准备摘要</th>
            <th class="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            orderRows.length === 0
              ? '<tr><td colspan="8" class="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</td></tr>'
              : orderRows
                  .map(({ order, tasks, mainCount, subCount, dyeCount, materialCount, qcCount, chain, isFallback }) => {
                    const prepSummary =
                      tasks.length === 0
                        ? '—'
                        : [
                            dyeCount > 0 ? '含染印' : null,
                            materialCount > 0 ? `领料需求：${materialCount}个任务` : null,
                            qcCount > 0 ? `质检标准：${qcCount}个任务` : null,
                          ]
                            .filter(Boolean)
                            .join('；') || '无执行准备挂载'

                    return `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-3 font-mono text-sm">
                          <div>${escapeHtml(order.productionOrderId)}</div>
                          ${isFallback ? '<div class="mt-0.5 text-[10px] text-muted-foreground">示例结构</div>' : ''}
                        </td>
                        <td class="px-3 py-3 text-sm">${escapeHtml(order.mainFactorySnapshot?.name ?? '—')}</td>
                        <td class="px-3 py-3 text-center text-sm">${tasks.length}</td>
                        <td class="px-3 py-3 text-center">
                          <span class="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">${mainCount}</span>
                        </td>
                        <td class="px-3 py-3 text-center">
                          ${
                            subCount > 0
                              ? `<span class="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">${subCount}</span>`
                              : '<span class="text-xs text-muted-foreground">—</span>'
                          }
                        </td>
                        <td class="max-w-[360px] px-3 py-3">
                          ${
                            tasks.length === 0
                              ? '<span class="text-xs italic text-muted-foreground">暂无任务</span>'
                              : `
                                  <div>
                                    <p class="text-xs leading-relaxed text-muted-foreground">${escapeHtml(chain)}</p>
                                    ${
                                      dyeCount > 0 || materialCount > 0 || qcCount > 0
                                        ? `
                                            <div class="mt-1.5 flex flex-wrap gap-1">
                                              ${
                                                dyeCount > 0
                                                  ? `<span class="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0 text-[10px] text-indigo-700">染印×${dyeCount}</span>`
                                                  : ''
                                              }
                                              ${
                                                materialCount > 0
                                                  ? `<span class="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0 text-[10px] text-amber-700">领料×${materialCount}</span>`
                                                  : ''
                                              }
                                              ${
                                                qcCount > 0
                                                  ? `<span class="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0 text-[10px] text-cyan-700">质检×${qcCount}</span>`
                                                  : ''
                                              }
                                            </div>
                                          `
                                        : ''
                                    }
                                  </div>
                                `
                          }
                        </td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(prepSummary)}</td>
                        <td class="px-3 py-3">
                          <div class="flex gap-1.5">
                            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-breakdown-action="open-chain-detail" data-order-id="${escapeHtml(order.productionOrderId)}">
                              任务链详情
                            </button>
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(order.productionOrderId)}">
                              查看生产单
                            </button>
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `
}

function renderAllTasksTable(
  allTaskRows: ProcessTask[],
  allTasks: ProcessTask[],
  taskDyeSet: Set<string>,
  taskMaterialSet: Set<string>,
  taskQcSet: Set<string>,
): string {
  return `
    <div class="rounded-md border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/40">
            <th class="w-10 px-3 py-2 text-left font-medium">序</th>
            <th class="px-3 py-2 text-left font-medium">任务ID</th>
            <th class="px-3 py-2 text-left font-medium">任务名称</th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">前置任务</th>
            <th class="px-3 py-2 text-left font-medium">后置任务</th>
            <th class="px-3 py-2 text-left font-medium">链路类型</th>
            <th class="px-3 py-2 text-center font-medium">染印承接</th>
            <th class="px-3 py-2 text-center font-medium">领料需求</th>
            <th class="px-3 py-2 text-center font-medium">质检标准</th>
            <th class="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            allTaskRows.length === 0
              ? '<tr><td colspan="11" class="py-12 text-center text-sm text-muted-foreground">暂无任务清单数据</td></tr>'
              : allTaskRows
                  .map((task, idx) => {
                    const hasDye = taskDyeSet.has(task.taskId)
                    const hasMaterial = taskMaterialSet.has(task.taskId)
                    const hasQc = taskQcSet.has(task.taskId)
                    const orderTasks = allTasks.filter((item) => item.productionOrderId === task.productionOrderId)
                    const isFallback = (task as FallbackTask)._isFallback

                    return `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-2 text-xs text-muted-foreground">${idx + 1}</td>
                        <td class="px-3 py-2 font-mono text-xs">
                          ${
                            isFallback
                              ? `<span class="text-muted-foreground">${escapeHtml(task.processNameZh)}（示例）</span>`
                              : escapeHtml(task.taskId)
                          }
                        </td>
                        <td class="px-3 py-2 text-sm font-medium">${escapeHtml(task.processNameZh)}</td>
                        <td class="px-3 py-2 font-mono text-xs text-muted-foreground">${escapeHtml(task.productionOrderId || '—')}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(prevNames(task, orderTasks))}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(nextNames(task, orderTasks))}</td>
                        <td class="px-3 py-2">
                          <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${chainTypeClass(task)}">${chainTypeZh(task)}</span>
                        </td>
                        <td class="px-3 py-2 text-center">${renderNeedBadge(hasDye, 'bg-indigo-50 text-indigo-700 border-indigo-200')}</td>
                        <td class="px-3 py-2 text-center">${renderNeedBadge(hasMaterial, 'bg-amber-50 text-amber-700 border-amber-200')}</td>
                        <td class="px-3 py-2 text-center">${renderNeedBadge(hasQc, 'bg-cyan-50 text-cyan-700 border-cyan-200')}</td>
                        <td class="px-3 py-2">
                          <div class="flex gap-1">
                            <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(task.productionOrderId)}">生产单</button>
                            ${
                              hasDye
                                ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/dye-orders">染印</button>'
                                : ''
                            }
                            ${
                              hasMaterial
                                ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/material-issue">领料</button>'
                                : ''
                            }
                            ${
                              hasQc
                                ? '<button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/qc-standards">质检标准</button>'
                                : ''
                            }
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')
          }
        </tbody>
      </table>
    </div>
  `
}

export function renderTaskBreakdownPage(): string {
  const allTasks = getAllProcessTasks()
  const taskMaterialSet = getTaskMaterialSet(allTasks)
  const taskQcSet = getTaskQcSet(allTasks)
  const taskDyeSet = getTaskDyeSet(allTasks)
  const keyword = state.keyword.trim().toLowerCase()

  const allTaskRows = allTasks
    .filter((task) => {
      if (!keyword) return true
      return (
        task.taskId.toLowerCase().includes(keyword) ||
        task.processNameZh.includes(keyword) ||
        task.productionOrderId.toLowerCase().includes(keyword)
      )
    })
    .sort((a, b) =>
      a.productionOrderId !== b.productionOrderId
        ? a.productionOrderId.localeCompare(b.productionOrderId)
        : a.seq - b.seq,
    )

  const orderRows = getOrderRows(allTasks, keyword, taskDyeSet, taskMaterialSet, taskQcSet)

  const realTasks = allTasks.filter((task) => !(task as FallbackTask)._isFallback)
  const stats = {
    orderCount: productionOrders.length,
    total: realTasks.length,
    mainCount: realTasks.filter((task) => !isDyeTask(task.processNameZh)).length,
    subCount: realTasks.filter((task) => isDyeTask(task.processNameZh)).length,
    materialCount: allTasks.filter(
      (task) => taskMaterialSet.has(task.taskId) && !(task as FallbackTask)._isFallback,
    ).length,
    qcCount: allTasks.filter(
      (task) => taskQcSet.has(task.taskId) && !(task as FallbackTask)._isFallback,
    ).length,
  }

  const chainDetailOrder = state.chainDetailOrderId
    ? productionOrders.find((order) => order.productionOrderId === state.chainDetailOrderId) ?? null
    : null
  const chainDetailTasks = state.chainDetailOrderId
    ? topoSort(allTasks.filter((task) => task.productionOrderId === state.chainDetailOrderId))
    : []

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-2xl font-semibold text-foreground">任务清单</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          任务清单用于展示生产单基于技术包已生成的任务组成与顺序关系；本页重点呈现任务链结构、前后置关系、主次链路以及执行准备要求，不承接运行进度与分配结果。
        </p>
      </header>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">生产单数</h2>
            <i data-lucide="file-text" class="h-4 w-4 text-muted-foreground"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.orderCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">任务总数</h2>
            <i data-lucide="layers" class="h-4 w-4 text-muted-foreground"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.total}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">主链路任务数</h2>
            <i data-lucide="chevron-right" class="h-4 w-4 text-slate-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.mainCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">次链路任务数</h2>
            <i data-lucide="chevron-right" class="h-4 w-4 text-indigo-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.subCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">需领料任务数</h2>
            <i data-lucide="clipboard-list" class="h-4 w-4 text-amber-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.materialCount}</p></div>
        </article>

        <article class="rounded-lg border bg-card py-3">
          <header class="flex items-center justify-between px-4 pb-1 pt-0">
            <h2 class="text-xs font-medium text-muted-foreground">需质检标准任务数</h2>
            <i data-lucide="check-square" class="h-4 w-4 text-cyan-500"></i>
          </header>
          <div class="px-4 pb-0"><p class="text-2xl font-bold">${stats.qcCount}</p></div>
        </article>
      </section>

      <section class="flex gap-2">
        <div class="relative max-w-xs flex-1">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            data-breakdown-field="keyword"
            value="${escapeHtml(state.keyword)}"
            placeholder="生产单号 / 任务名称 / 关键词"
            class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
          />
        </div>
      </section>

      <section class="space-y-3">
        <div class="inline-flex items-center rounded-md bg-muted p-1 text-sm">
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm',
              state.activeTab === 'by-order'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-breakdown-action="switch-tab"
            data-tab="by-order"
          >
            按生产单查看
          </button>
          <button
            class="${toClassName(
              'rounded-md px-3 py-1.5 text-sm',
              state.activeTab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}"
            data-breakdown-action="switch-tab"
            data-tab="all"
          >
            全部任务
          </button>
        </div>

        ${state.activeTab === 'by-order' ? renderByOrderTable(orderRows) : ''}
        ${state.activeTab === 'all' ? renderAllTasksTable(allTaskRows, allTasks, taskDyeSet, taskMaterialSet, taskQcSet) : ''}
      </section>

      ${renderChainDetailDialog(
        state.chainDetailOrderId,
        chainDetailOrder,
        chainDetailTasks,
        taskDyeSet,
        taskMaterialSet,
        taskQcSet,
      )}
    </div>
  `
}

export function handleTaskBreakdownEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-breakdown-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.breakdownField
    if (field === 'keyword') {
      state.keyword = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-breakdown-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.breakdownAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TaskBreakdownTab | undefined
    if (tab === 'by-order' || tab === 'all') {
      state.activeTab = tab
      return true
    }
    return false
  }

  if (action === 'open-chain-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.chainDetailOrderId = orderId
    return true
  }

  if (action === 'close-dialog') {
    state.chainDetailOrderId = null
    return true
  }

  return false
}

export function isTaskBreakdownDialogOpen(): boolean {
  return state.chainDetailOrderId !== null
}
