import { renderDetailDrawer as uiDetailDrawer } from '../components/ui/index.ts'
import { listSampleInventoryViewItems } from '../data/pcs-sample-view-model.ts'
import { ensureSampleBootstrapInitialized } from '../data/pcs-sample-project-writeback.ts'
import { escapeHtml } from '../utils.ts'

interface SampleInventoryPageState {
  keyword: string
  statusFilter: string
  siteFilter: string
  selectedAssetId: string | null
  detailOpen: boolean
}

let state: SampleInventoryPageState = {
  keyword: '',
  statusFilter: 'all',
  siteFilter: 'all',
  selectedAssetId: null,
  detailOpen: false,
}

function getAssets() {
  ensureSampleBootstrapInitialized()
  return listSampleInventoryViewItems().filter((item) => {
    if (state.keyword) {
      const keyword = state.keyword.toLowerCase()
      const matched = [item.sampleCode, item.sampleName, item.projectCode, item.projectName, item.workItemTypeName]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(keyword))
      if (!matched) return false
    }
    if (state.statusFilter !== 'all' && item.inventoryStatus !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && item.responsibleSite !== state.siteFilter) return false
    return true
  })
}

function getSelectedAsset() {
  if (!state.selectedAssetId) return null
  return listSampleInventoryViewItems().find((item) => item.sampleAssetId === state.selectedAssetId) || null
}

function renderDetail(): string {
  const asset = getSelectedAsset()
  if (!state.detailOpen || !asset) return ''
  return uiDetailDrawer(
    {
      title: '样衣资产详情',
      subtitle: asset.sampleCode,
      closeAction: { prefix: 'sample-inventory', action: 'close-detail' },
      width: 'md',
    },
    `
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣名称</div><div class="mt-1 font-medium">${escapeHtml(asset.sampleName)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣类型</div><div class="mt-1 font-medium">${escapeHtml(asset.sampleType)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">库存状态</div><div class="mt-1 font-medium">${escapeHtml(asset.inventoryStatus)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">可用状态</div><div class="mt-1 font-medium">${escapeHtml(asset.availabilityStatus)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">责任站点</div><div class="mt-1 font-medium">${escapeHtml(asset.responsibleSite)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">当前位置</div><div class="mt-1 font-medium">${escapeHtml(asset.locationDisplay)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">保管人</div><div class="mt-1 font-medium">${escapeHtml(asset.custodianName || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">关联项目</div><div class="mt-1 font-medium">${escapeHtml(asset.projectCode ? `${asset.projectCode} · ${asset.projectName}` : '未绑定项目')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">关联项目节点</div><div class="mt-1 font-medium">${escapeHtml(asset.workItemTypeName || '未挂项目节点')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">最近事件</div><div class="mt-1 font-medium">${escapeHtml(asset.lastEventType || '—')}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">最近事件时间</div><div class="mt-1 font-medium">${escapeHtml(asset.lastEventTime || '—')}</div></div>
      </div>
    `,
  )
}

export function handleSampleInventoryEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sample-inventory-action]')
  const action = actionNode?.dataset.sampleInventoryAction
  if (!action) return false

  if (action === 'open-detail') {
    const assetId = actionNode?.dataset.assetId
    if (assetId) {
      state.selectedAssetId = assetId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    return true
  }
  return false
}

export function isSampleInventoryDialogOpen(): boolean {
  return state.detailOpen
}

export function renderSampleInventoryPage(): string {
  const assets = getAssets()
  const statusOptions = Array.from(new Set(listSampleInventoryViewItems().map((item) => item.inventoryStatus)))
  const siteOptions = Array.from(new Set(listSampleInventoryViewItems().map((item) => item.responsibleSite)))

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-xl font-semibold">样衣库存</h1>
        <p class="mt-1 text-sm text-muted-foreground">库存状态、可用状态、项目归属与最后事件统一来自正式样衣资产记录。</p>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 lg:grid-cols-[2fr,1fr,1fr,auto]">
          <input class="h-9 rounded-md border bg-background px-3 text-sm" placeholder="搜索样衣编号/样衣名称/项目/项目节点" value="${escapeHtml(state.keyword)}" oninput="" data-sample-inventory-field="keyword" />
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-sample-inventory-field="status">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部库存状态</option>
            ${statusOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.statusFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-sample-inventory-field="site">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            ${siteOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.siteFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-sample-inventory-action="reset">重置</button>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1200px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">样衣编号</th>
                <th class="px-3 py-2 font-medium">样衣名称</th>
                <th class="px-3 py-2 font-medium">库存状态</th>
                <th class="px-3 py-2 font-medium">可用状态</th>
                <th class="px-3 py-2 font-medium">责任站点</th>
                <th class="px-3 py-2 font-medium">当前位置</th>
                <th class="px-3 py-2 font-medium">关联项目</th>
                <th class="px-3 py-2 font-medium">项目节点</th>
                <th class="px-3 py-2 font-medium">最近事件</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${assets.length > 0 ? assets.map((item) => `
                <tr class="border-b last:border-b-0 hover:bg-muted/30">
                  <td class="px-3 py-3 font-medium text-primary">${escapeHtml(item.sampleCode)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.sampleName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.inventoryStatus)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.availabilityStatus)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.responsibleSite)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.locationDisplay)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.projectCode ? `${item.projectCode} · ${item.projectName}` : '未绑定项目')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.workItemTypeName || '未挂项目节点')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.lastEventType ? `${item.lastEventType} / ${item.lastEventTime}` : '—')}</td>
                  <td class="px-3 py-3"><button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-sample-inventory-action="open-detail" data-asset-id="${item.sampleAssetId}">查看</button></td>
                </tr>
              `).join('') : '<tr><td colspan="10" class="px-4 py-12 text-center text-muted-foreground">暂无正式样衣资产记录</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      ${renderDetail()}
    </div>
  `
}

export function handleSampleInventoryInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.sampleInventoryField
  if (!field) return false
  if (field === 'keyword') {
    state.keyword = (target as HTMLInputElement).value
    return true
  }
  if (field === 'status') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'site') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }
  return false
}
