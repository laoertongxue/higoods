import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  getCutPieceReleaseRecord,
  listCutPieceReleaseRecords,
  saveCutPieceReleaseDecision,
  type CutPieceReleaseDecision,
  type CutPieceReleaseRecord,
  type CutPieceReleaseSkuLine,
} from '../../../data/fcs/cut-piece-release.ts'

type DecisionFilter = '全部' | CutPieceReleaseDecision

interface CutPieceReleasePageState {
  keyword: string
  decisionFilter: DecisionFilter
  activeRecordId: string | null
  feedbackMessage: string
  feedbackTone: 'success' | 'warning'
}

const state: CutPieceReleasePageState = {
  keyword: '',
  decisionFilter: '全部',
  activeRecordId: null,
  feedbackMessage: '',
  feedbackTone: 'success',
}

const decisionOptions: CutPieceReleaseDecision[] = ['待判断', '可以做', '部分可以做', '暂时不能做']

function formatQty(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function renderDecisionBadge(decision: CutPieceReleaseDecision): string {
  const className = decision === '可以做'
    ? 'border-green-200 bg-green-50 text-green-700'
    : decision === '部分可以做'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : decision === '暂时不能做'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(decision)}</span>`
}

function renderImage(url: string | undefined, alt: string): string {
  if (!url) return '<div class="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">暂无</div>'
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-14 w-14 rounded-md border object-cover" />`
}

function getFilteredRecords(): CutPieceReleaseRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listCutPieceReleaseRecords().filter((record) => {
    if (state.decisionFilter !== '全部' && record.decision !== state.decisionFilter) return false
    if (!keyword) return true
    const text = [
      record.recordNo,
      record.productionOrderNo,
      record.taskNo,
      record.spuCode,
      record.spuName,
      record.sourceCutOrderNos.join(' '),
      record.skuLines.map((line) => `${line.skuCode} ${line.colorName} ${line.sizeCode}`).join(' '),
    ].join(' ').toLowerCase()
    return text.includes(keyword)
  })
}

function renderMetricCard(label: string, value: string, hint: string, tone = 'text-foreground'): string {
  return `
    <div class="rounded-lg border bg-card px-4 py-3">
      <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold tabular-nums ${tone}">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</div>
    </div>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(280px,1fr)_200px_auto_auto] md:items-end">
        <label class="space-y-1">
          <span class="text-sm font-medium">搜索</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cut-piece-release-field="keyword" data-skip-page-rerender="true" value="${escapeHtml(state.keyword)}" placeholder="生产单 / 车缝任务 / SPU / SKU / 裁片单" />
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">裁床判断</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cut-piece-release-field="decisionFilter">
            ${(['全部', ...decisionOptions] as DecisionFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.decisionFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <button class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-cut-piece-release-action="query">查询</button>
        <button class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-cut-piece-release-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderTriggerInfo(record: CutPieceReleaseRecord): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <div>触发动作：<span class="text-foreground">${escapeHtml(record.triggerAction)}</span></div>
      <div>触发裁片单：<span class="font-mono text-foreground">${escapeHtml(record.triggerCutOrderNo)}</span></div>
      <div>裁剪操作人：${escapeHtml(record.triggerOperator)}</div>
      <div>触发时间：${escapeHtml(formatDateTime(record.triggerAt))}</div>
    </div>
  `
}

function renderRecordRow(record: CutPieceReleaseRecord): string {
  const skuScope = record.skuLines
    .slice(0, 3)
    .map((line) => `${line.colorName}/${line.sizeCode}`)
    .join('、')
  return `
    <tr class="border-b last:border-b-0 align-top">
      <td class="px-3 py-4">
        <div class="font-medium">${escapeHtml(record.recordNo)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)}</div>
        <div class="mt-2">${renderDecisionBadge(record.decision)}</div>
      </td>
      <td class="px-3 py-4">
        <div class="flex gap-3">
          ${renderImage(record.styleImageUrl, record.spuCode)}
          <div class="min-w-0">
            <div class="font-medium">${escapeHtml(record.spuCode)}</div>
            <div class="mt-0.5 max-w-[220px] text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.taskNo)}</div>
          </div>
        </div>
      </td>
      <td class="px-3 py-4">${renderTriggerInfo(record)}</td>
      <td class="px-3 py-4 text-xs">
        <div>${record.skuLines.length} 个 SKU / 颜色 / 尺码</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(skuScope || '暂无 SKU 范围')}</div>
        <div class="mt-1 text-muted-foreground">来源裁片单：${escapeHtml(record.sourceCutOrderNos.join('、') || '未关联')}</div>
      </td>
      <td class="px-3 py-4">
        <div class="text-xl font-semibold tabular-nums">${formatQty(record.releaseQty)} <span class="text-xs font-normal text-muted-foreground">件</span></div>
        <div class="mt-1 text-xs text-muted-foreground">${record.decision === '待判断' ? '等待裁床主管判断' : '裁床本次判断可做数量'}</div>
      </td>
      <td class="px-3 py-4 text-xs">
        <div class="max-w-[260px] leading-5">${escapeHtml(record.reason)}</div>
        ${record.riskNote ? `<div class="mt-1 max-w-[260px] text-amber-700">${escapeHtml(record.riskNote)}</div>` : ''}
      </td>
      <td class="px-3 py-4 text-xs">
        <div>${escapeHtml(record.judgedBy || '待裁床主管确认')}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(record.judgedAt ? formatDateTime(record.judgedAt) : '未确认')}</div>
      </td>
      <td class="px-3 py-4">
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted" data-cut-piece-release-action="open-detail" data-record-id="${escapeHtml(record.recordId)}">查看 / 确认</button>
      </td>
    </tr>
  `
}

function renderRecordTable(records: CutPieceReleaseRecord[]): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-base font-semibold">裁片放行判断列表</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">生产单下任一裁片单出现“铺布完成裁剪”后进入本列表，由裁床主管判断能不能交给车缝做货。</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1380px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs text-muted-foreground">
              <th class="px-3 py-3 text-left font-medium">放行单 / 生产单</th>
              <th class="px-3 py-3 text-left font-medium">款式 / 车缝任务</th>
              <th class="px-3 py-3 text-left font-medium">触发裁剪事实</th>
              <th class="px-3 py-3 text-left font-medium">SKU 范围</th>
              <th class="px-3 py-3 text-left font-medium">可做数量</th>
              <th class="px-3 py-3 text-left font-medium">判断原因 / 风险</th>
              <th class="px-3 py-3 text-left font-medium">确认人 / 时间</th>
              <th class="px-3 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选范围暂无裁片放行记录。</td></tr>' : records.map(renderRecordRow).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderSkuLineRow(line: CutPieceReleaseSkuLine): string {
  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-3">
        <div class="font-medium">${escapeHtml(line.skuCode)}</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeCode)}</div>
      </td>
      <td class="px-3 py-3 text-xs">
        <div>需求 ${formatQty(line.demandQty)} 件</div>
        <div>待分配 ${formatQty(line.remainingQty)} 件</div>
      </td>
      <td class="px-3 py-3">${formatQty(line.cutCompletedQty)} 件</td>
      <td class="px-3 py-3 text-xs">
        <div>完整齐套 ${formatQty(line.completeKitQty)} 件</div>
        <div>辅料可做 ${formatQty(line.accessoryReadyQty)} 件</div>
      </td>
      <td class="px-3 py-3">
        <div class="font-semibold tabular-nums">${formatQty(line.releaseQty)} 件</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.reason)}</div>
      </td>
    </tr>
  `
}

function renderDetailDrawer(record: CutPieceReleaseRecord | null): string {
  if (!record) return ''
  const maxReleaseQty = record.skuLines.reduce((sum, line) => sum + line.remainingQty, 0)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/40" data-cut-piece-release-action="close-overlay" aria-label="关闭"></button>
      <aside class="absolute right-0 top-0 flex h-full w-[min(1080px,100vw)] flex-col overflow-hidden border-l bg-background shadow-xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 class="text-lg font-semibold">裁片放行确认</h3>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)} · ${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.spuCode)}</p>
          </div>
          <button class="rounded-md p-1 hover:bg-muted" data-cut-piece-release-action="close-overlay"><i data-lucide="x" class="h-4 w-4"></i></button>
        </header>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          <div class="grid gap-3 sm:grid-cols-4">
            ${renderMetricCard('当前裁床判断', record.decision, '由裁床主管确认', record.decision === '暂时不能做' ? 'text-rose-700' : record.decision === '待判断' ? 'text-amber-700' : 'text-green-700')}
            ${renderMetricCard('本次可做数量', `${formatQty(record.releaseQty)} 件`, `最多参考待分配 ${formatQty(maxReleaseQty)} 件`, 'text-blue-700')}
            ${renderMetricCard('SKU 范围', `${record.skuLines.length}`, '颜色 / 尺码维度')}
            ${renderMetricCard('来源裁片单', `${record.sourceCutOrderNos.length}`, record.triggerCutOrderNo)}
          </div>

          <section class="mt-4 rounded-lg border">
            <div class="border-b bg-muted/30 px-4 py-3">
              <div class="font-medium">裁剪事实</div>
              <div class="mt-1 text-xs text-muted-foreground">铺布/裁剪操作人员只记录事实，不在这里判断能不能做货。</div>
            </div>
            <div class="grid gap-3 p-4 text-sm md:grid-cols-2">
              <div class="rounded-md border bg-background p-3">
                <div class="text-xs text-muted-foreground">触发动作</div>
                <div class="mt-1 font-medium">${escapeHtml(record.triggerAction)}</div>
                <div class="mt-2 text-xs text-muted-foreground">时间：${escapeHtml(formatDateTime(record.triggerAt))} · 操作人：${escapeHtml(record.triggerOperator)}</div>
              </div>
              <div class="rounded-md border bg-background p-3">
                <div class="text-xs text-muted-foreground">来源裁片单</div>
                <div class="mt-1 font-medium">${escapeHtml(record.sourceCutOrderNos.join('、') || '未关联')}</div>
                <div class="mt-2 text-xs text-muted-foreground">触发裁片单：${escapeHtml(record.triggerCutOrderNo)}</div>
              </div>
            </div>
          </section>

          <section class="mt-4 rounded-lg border">
            <div class="border-b bg-muted/30 px-4 py-3">
              <div class="font-medium">SKU 辅助信息</div>
              <div class="mt-1 text-xs text-muted-foreground">齐套和辅料库存只作为跟单判断分配节奏的参考，不替代裁床主管的裁片放行判断。</div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[820px] text-sm">
                <thead>
                  <tr class="border-b text-xs text-muted-foreground">
                    <th class="px-3 py-2 text-left">SKU / 颜色 / 尺码</th>
                    <th class="px-3 py-2 text-left">需求 / 待分配</th>
                    <th class="px-3 py-2 text-left">已裁数量</th>
                    <th class="px-3 py-2 text-left">齐套 / 辅料参考</th>
                    <th class="px-3 py-2 text-left">裁床判断可做</th>
                  </tr>
                </thead>
                <tbody>${record.skuLines.map(renderSkuLineRow).join('')}</tbody>
              </table>
            </div>
          </section>

          <section class="mt-4 rounded-lg border">
            <div class="border-b bg-muted/30 px-4 py-3">
              <div class="font-medium">裁床主管确认</div>
              <div class="mt-1 text-xs text-muted-foreground">确认的是“当前已裁片能不能交给车缝做货”，不是裁片齐套结论。</div>
            </div>
            <div class="grid gap-3 p-4 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-sm font-medium">裁床判断</span>
                <select id="cut-piece-release-decision" class="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  ${decisionOptions.map((item) => `<option value="${escapeHtml(item)}" ${record.decision === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-sm font-medium">可做数量</span>
                <input id="cut-piece-release-qty" class="h-10 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" max="${maxReleaseQty}" value="${escapeHtml(String(record.releaseQty))}" />
              </label>
              <label class="space-y-1 md:col-span-2">
                <span class="text-sm font-medium">判断原因</span>
                <textarea id="cut-piece-release-reason" class="min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="说明为什么可以做、部分可以做或暂时不能做">${escapeHtml(record.reason)}</textarea>
              </label>
              <label class="space-y-1 md:col-span-2">
                <span class="text-sm font-medium">风险说明</span>
                <textarea id="cut-piece-release-risk" class="min-h-[76px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="如需要跟单注意车缝节奏、混包、错码等风险">${escapeHtml(record.riskNote)}</textarea>
              </label>
              <label class="space-y-1">
                <span class="text-sm font-medium">确认人</span>
                <input id="cut-piece-release-judge-by" class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(record.judgedBy || '裁床主管')}" />
              </label>
              <div class="flex items-end justify-end gap-2">
                <button class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-cut-piece-release-action="close-overlay">取消</button>
                <button class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-cut-piece-release-action="save-decision" data-record-id="${escapeHtml(record.recordId)}">确认判断</button>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  `
}

export function renderCraftCuttingCutPieceReleasePage(): string {
  const records = getFilteredRecords()
  const allRecords = listCutPieceReleaseRecords()
  const activeRecord = state.activeRecordId ? getCutPieceReleaseRecord(state.activeRecordId) : null
  const releaseQtyTotal = records.reduce((sum, record) => sum + record.releaseQty, 0)
  const readyCount = records.filter((record) => record.decision === '可以做' || record.decision === '部分可以做').length
  const pendingCount = records.filter((record) => record.decision === '待判断').length
  const blockedCount = records.filter((record) => record.decision === '暂时不能做').length

  return `
    <div class="space-y-4">
      <header class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold">裁片放行管理</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">铺布完成裁剪后，由裁床主管判断当前已裁片能不能交给车缝做货，并给出可做数量、原因、确认人和确认时间。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/dispatch/sewing">车缝分配工作台</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/summary">裁剪结果核查</button>
        </div>
      </header>

      <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        判断触发条件是生产单下任一裁片单出现“铺布完成裁剪”。本页不要求裁片齐套，也不要求辅助工艺或特种工艺全部回仓；齐套和辅料库存继续在车缝分配工作台作为参考。
      </section>

      <div class="grid gap-3 md:grid-cols-5">
        ${renderMetricCard('放行记录', `${allRecords.length}`, '已进入裁片放行管理')}
        ${renderMetricCard('可以/部分可以做', `${readyCount}`, '裁床已允许车缝启动', 'text-green-700')}
        ${renderMetricCard('待判断', `${pendingCount}`, '等待裁床主管确认', 'text-amber-700')}
        ${renderMetricCard('暂时不能做', `${blockedCount}`, '需先处理裁片风险', 'text-rose-700')}
        ${renderMetricCard('可做数量合计', `${formatQty(releaseQtyTotal)} 件`, '当前筛选范围', 'text-blue-700')}
      </div>

      ${state.feedbackMessage ? `<section class="rounded-lg border px-4 py-3 text-sm ${state.feedbackTone === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${escapeHtml(state.feedbackMessage)}</section>` : ''}
      ${renderFilters()}
      ${renderRecordTable(records)}
      ${renderDetailDrawer(activeRecord)}
    </div>
  `
}

function readInputValue(id: string): string {
  const node = document.getElementById(id)
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
    return node.value
  }
  return ''
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement): void {
  if (field === 'keyword') {
    state.keyword = node.value
    return
  }
  if (field === 'decisionFilter') {
    state.decisionFilter = node.value as DecisionFilter
  }
}

export function handleCraftCuttingCutPieceReleaseEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cut-piece-release-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.cutPieceReleaseField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cut-piece-release-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.cutPieceReleaseAction
  if (!action) return false

  if (action === 'query') {
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.decisionFilter = '全部'
    state.feedbackMessage = ''
    return true
  }
  if (action === 'open-detail') {
    state.activeRecordId = actionNode.dataset.recordId || null
    state.feedbackMessage = ''
    return true
  }
  if (action === 'close-overlay') {
    state.activeRecordId = null
    return true
  }
  if (action === 'save-decision') {
    const recordId = actionNode.dataset.recordId || state.activeRecordId || ''
    const result = saveCutPieceReleaseDecision({
      recordId,
      decision: readInputValue('cut-piece-release-decision') as CutPieceReleaseDecision,
      releaseQty: Number(readInputValue('cut-piece-release-qty')),
      reason: readInputValue('cut-piece-release-reason'),
      riskNote: readInputValue('cut-piece-release-risk'),
      judgedBy: readInputValue('cut-piece-release-judge-by'),
    })
    state.feedbackMessage = result.message
    state.feedbackTone = result.ok ? 'success' : 'warning'
    if (result.ok) state.activeRecordId = null
    return true
  }

  return false
}

export function isCraftCuttingCutPieceReleaseDialogOpen(): boolean {
  return state.activeRecordId !== null
}
