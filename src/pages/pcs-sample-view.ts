import { renderDetailDrawer as uiDetailDrawer } from '../components/ui/index.ts'
import { listSampleInventoryViewItems } from '../data/pcs-sample-view-model.ts'
import { ensureSampleBootstrapInitialized } from '../data/pcs-sample-project-writeback.ts'
import { escapeHtml } from '../utils.ts'

interface SampleViewPageState {
  keyword: string
  siteFilter: string
  selectedSampleId: string | null
  detailOpen: boolean
}

let state: SampleViewPageState = {
  keyword: '',
  siteFilter: 'all',
  selectedSampleId: null,
  detailOpen: false,
}

function getSamples() {
  ensureSampleBootstrapInitialized()
  return listSampleInventoryViewItems().filter((item) => {
    if (state.keyword) {
      const keyword = state.keyword.toLowerCase()
      const matched = [item.sampleCode, item.sampleName, item.projectCode, item.projectName, item.workItemTypeName]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(keyword))
      if (!matched) return false
    }
    if (state.siteFilter !== 'all' && item.responsibleSite !== state.siteFilter) return false
    return true
  })
}

function getSelectedSample() {
  if (!state.selectedSampleId) return null
  return listSampleInventoryViewItems().find((item) => item.sampleAssetId === state.selectedSampleId) || null
}

function renderDetail(): string {
  const sample = getSelectedSample()
  if (!state.detailOpen || !sample) return ''
  return uiDetailDrawer(
    {
      title: '样衣视图详情',
      subtitle: sample.sampleCode,
      closeAction: { prefix: 'sample-view', action: 'close-detail' },
      width: 'md',
    },
    `
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣名称</div><div class="mt-1 font-medium">${escapeHtml(sample.sampleName)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">责任站点</div><div class="mt-1 font-medium">${escapeHtml(sample.responsibleSite)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">库存状态</div><div class="mt-1 font-medium">${escapeHtml(sample.inventoryStatus)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">可用状态</div><div class="mt-1 font-medium">${escapeHtml(sample.availabilityStatus)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">当前位置</div><div class="mt-1 font-medium">${escapeHtml(sample.locationDisplay)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">关联项目</div><div class="mt-1 font-medium">${escapeHtml(sample.projectCode ? `${sample.projectCode} · ${sample.projectName}` : '未绑定项目')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">项目节点</div><div class="mt-1 font-medium">${escapeHtml(sample.workItemTypeName || '未挂项目节点')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">最近事件</div><div class="mt-1 font-medium">${escapeHtml(sample.lastEventType ? `${sample.lastEventType} / ${sample.lastEventTime}` : '—')}</div></div>
      </div>
    `,
  )
}

export function handleSampleViewEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sample-view-action]')
  const action = actionNode?.dataset.sampleViewAction
  if (!action) return false
  if (action === 'open-detail') {
    const sampleId = actionNode?.dataset.sampleId
    if (sampleId) {
      state.selectedSampleId = sampleId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }
  return false
}

export function handleSampleViewInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.sampleViewField
  if (!field) return false
  if (field === 'keyword') {
    state.keyword = (target as HTMLInputElement).value
    return true
  }
  if (field === 'site') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }
  return false
}

export function isSampleViewDialogOpen(): boolean {
  return state.detailOpen
}

export function renderSampleViewPage(): string {
  const samples = getSamples()
  const siteOptions = Array.from(new Set(listSampleInventoryViewItems().map((item) => item.responsibleSite)))

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-xl font-semibold">样衣视图</h1>
        <p class="mt-1 text-sm text-muted-foreground">样衣卡片中的项目与项目节点标签统一回读正式样衣资产记录，不再主展示旧项目字段。</p>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 lg:grid-cols-[2fr,1fr]">
          <input class="h-9 rounded-md border bg-background px-3 text-sm" placeholder="搜索样衣编号/样衣名称/项目/项目节点" value="${escapeHtml(state.keyword)}" data-sample-view-field="keyword" />
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-sample-view-field="site">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            ${siteOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.siteFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        ${samples.length > 0 ? samples.map((item) => `
          <article class="rounded-lg border bg-card p-4 hover:shadow-md">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs text-muted-foreground">${escapeHtml(item.sampleCode)}</p>
                <h2 class="mt-1 text-base font-semibold">${escapeHtml(item.sampleName)}</h2>
              </div>
              <span class="rounded-full border px-2 py-0.5 text-xs">${escapeHtml(item.inventoryStatus)}</span>
            </div>
            <div class="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>责任站点：${escapeHtml(item.responsibleSite)}</p>
              <p>当前位置：${escapeHtml(item.locationDisplay)}</p>
              <p>项目：${escapeHtml(item.projectCode ? `${item.projectCode} · ${item.projectName}` : '未绑定项目')}</p>
              <p>项目节点：${escapeHtml(item.workItemTypeName || '未挂项目节点')}</p>
              <p>最近事件：${escapeHtml(item.lastEventType ? `${item.lastEventType} / ${item.lastEventTime}` : '—')}</p>
            </div>
            <div class="mt-4">
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-sample-view-action="open-detail" data-sample-id="${item.sampleAssetId}">查看详情</button>
            </div>
          </article>
        `).join('') : '<div class="col-span-full rounded-lg border border-dashed bg-muted/20 p-12 text-center text-muted-foreground">暂无正式样衣资产</div>'}
      </section>

      ${renderDetail()}
    </div>
  `
}
