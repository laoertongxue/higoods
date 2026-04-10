import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { generateStyleArchiveShellFromProject } from '../data/pcs-project-style-archive-writeback.ts'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository.ts'
import {
  buildStyleArchiveListItems,
  listStyleArchiveEligibleProjects,
} from '../data/pcs-style-archive-view-model.ts'
import type { StyleArchiveShellRecord } from '../data/pcs-style-archive-types.ts'

export type StyleArchiveRecord = StyleArchiveShellRecord

interface ProductSpuState {
  search: string
  statusFilter: string
  drawerOpen: boolean
  createMode: 'project' | 'new' | 'legacy'
  projectId: string
  notice: string
}

const state: ProductSpuState = {
  search: '',
  statusFilter: 'all',
  drawerOpen: false,
  createMode: 'project',
  projectId: '',
  notice: '',
}

function getStatusClass(status: string): string {
  if (status === '启用中') return 'border-green-200 bg-green-50 text-green-700'
  if (status === '已归档') return 'border-slate-200 bg-slate-100 text-slate-700'
  return 'border-orange-200 bg-orange-50 text-orange-700'
}

function listFilteredItems() {
  return buildStyleArchiveListItems().filter((item) => {
    const keyword = state.search.trim()
    if (
      keyword &&
      !`${item.styleCode}${item.styleName}${item.categoryPath}${item.sourceProjectText}`.includes(keyword)
    ) {
      return false
    }
    if (state.statusFilter !== 'all' && item.archiveStatusCode !== state.statusFilter) return false
    return true
  })
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-spu-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderToolbar(): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input
          class="min-w-[260px] flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="搜索款式档案编号、款式名称、来源项目"
          data-spu-field="search"
          value="${escapeHtml(state.search)}"
        />
        <select class="rounded-md border px-3 py-2 text-sm" data-spu-field="statusFilter">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部档案状态</option>
          <option value="DRAFT" ${state.statusFilter === 'DRAFT' ? 'selected' : ''}>待补全</option>
          <option value="ACTIVE" ${state.statusFilter === 'ACTIVE' ? 'selected' : ''}>启用中</option>
          <option value="ARCHIVED" ${state.statusFilter === 'ARCHIVED' ? 'selected' : ''}>已归档</option>
        </select>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-spu-action="open-project-drawer">从项目生成</button>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-spu-action="open-new-drawer">从零新建</button>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-spu-action="open-legacy-drawer">绑定历史档案</button>
      </div>
    </section>
  `
}

function renderTable(): string {
  const items = listFilteredItems()
  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-left text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">款式档案编号</th>
            <th class="px-4 py-3 font-medium">款式名称</th>
            <th class="px-4 py-3 font-medium">分类</th>
            <th class="px-4 py-3 font-medium">风格标签</th>
            <th class="px-4 py-3 font-medium">价格带</th>
            <th class="px-4 py-3 font-medium">档案状态</th>
            <th class="px-4 py-3 font-medium">规格清单状态</th>
            <th class="px-4 py-3 font-medium">技术资料状态</th>
            <th class="px-4 py-3 font-medium">当前生效技术资料</th>
            <th class="px-4 py-3 font-medium">成本核价状态</th>
            <th class="px-4 py-3 font-medium">来源项目</th>
            <th class="px-4 py-3 font-medium">更新时间</th>
            <th class="px-4 py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${items
            .map(
              (item) => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium">${escapeHtml(item.styleCode)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.styleName)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.categoryPath)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.styleTagsText)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.priceRangeLabel)}</td>
                  <td class="px-4 py-3"><span class="inline-flex rounded-full border px-2 py-1 text-xs ${getStatusClass(item.archiveStatusLabel)}">${escapeHtml(item.archiveStatusLabel)}</span></td>
                  <td class="px-4 py-3">${escapeHtml(item.specificationStatus)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.technicalDataStatus)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.effectiveTechnicalVersionText)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.costPricingStatus)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.sourceProjectText)}</td>
                  <td class="px-4 py-3">${escapeHtml(item.updatedAt)}</td>
                  <td class="px-4 py-3 text-right">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-spu-action="view-detail" data-style-id="${escapeHtml(item.styleId)}">查看详情</button>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
      ${
        items.length === 0
          ? '<div class="p-10 text-center text-sm text-gray-500">暂无符合条件的款式档案。</div>'
          : ''
      }
    </section>
  `
}

function renderProjectDrawer(): string {
  if (!state.drawerOpen) return ''
  const projectOptions = listStyleArchiveEligibleProjects()

  let body = ''
  if (state.createMode === 'project') {
    body = `
      <div class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium">商品项目</label>
          <select class="w-full rounded-md border px-3 py-2 text-sm" data-spu-field="projectId">
            <option value="">请选择商品项目</option>
            ${projectOptions
              .map(
                (option) => `
                  <option value="${escapeHtml(option.projectId)}" ${state.projectId === option.projectId ? 'selected' : ''}>
                    ${escapeHtml(option.label)}
                  </option>
                `,
              )
              .join('')}
          </select>
        </div>
        <div class="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
          <p class="font-medium">从商品项目生成款式档案初始记录</p>
          <p class="mt-1">本轮只生成款式档案壳，不自动创建规格、技术资料和成本版本。</p>
        </div>
      </div>
    `
  } else if (state.createMode === 'new') {
    body = `
      <div class="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
        本轮只接通“从项目生成款式档案壳”正式链路。从零新建入口暂保留页面壳，不执行正式建档。
      </div>
    `
  } else {
    body = `
      <div class="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
        本轮只接通“从项目生成款式档案壳”正式链路。绑定历史档案入口暂保留页面壳，不执行正式建档。
      </div>
    `
  }

  const title =
    state.createMode === 'project' ? '从项目生成款式档案' : state.createMode === 'new' ? '从零新建款式档案' : '绑定历史款式档案'

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div class="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold">${title}</h2>
            <p class="mt-1 text-sm text-gray-500">款式档案围绕正式主记录管理，不再停留在页面演示数组中。</p>
          </div>
          <button class="text-xl text-gray-500 hover:text-gray-700" data-spu-action="close-drawer">×</button>
        </div>
        <div class="space-y-4 px-6 py-5">
          <div class="flex flex-wrap gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${state.createMode === 'project' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}" data-spu-action="set-mode" data-mode="project">从项目生成</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${state.createMode === 'new' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}" data-spu-action="set-mode" data-mode="new">从零新建</button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${state.createMode === 'legacy' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}" data-spu-action="set-mode" data-mode="legacy">绑定历史档案</button>
          </div>
          ${body}
        </div>
        <div class="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-gray-50" data-spu-action="close-drawer">取消</button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-spu-action="submit-create">
            ${state.createMode === 'project' ? '生成并进入详情' : '知道了'}
          </button>
        </div>
      </div>
    </div>
  `
}

export function listStyleArchiveRecords(): StyleArchiveRecord[] {
  return buildStyleArchiveListItems()
    .map((item) => getStyleArchiveById(item.styleId))
    .filter(Boolean) as StyleArchiveRecord[]
}

export function getStyleArchiveRecord(styleId: string): StyleArchiveRecord | null {
  return getStyleArchiveById(styleId)
}

export function renderProductSpuPage(): string {
  return `
    <div class="space-y-4">
      <header class="rounded-lg border bg-white p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold">款式档案</h1>
            <p class="mt-1 text-sm text-gray-500">围绕正式款式档案主记录查看来源项目、档案状态和后续补全进展。</p>
          </div>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-spu-action="open-project-drawer">从项目生成</button>
        </div>
      </header>
      ${renderNotice()}
      ${renderToolbar()}
      ${renderTable()}
      ${renderProjectDrawer()}
    </div>
  `
}

export function handleProductSpuEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-spu-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.spuAction
  if (!action) return false

  if (action === 'open-project-drawer') {
    state.drawerOpen = true
    state.createMode = 'project'
    state.projectId = ''
    return true
  }

  if (action === 'open-new-drawer') {
    state.drawerOpen = true
    state.createMode = 'new'
    return true
  }

  if (action === 'open-legacy-drawer') {
    state.drawerOpen = true
    state.createMode = 'legacy'
    return true
  }

  if (action === 'set-mode') {
    state.createMode = (actionNode.dataset.mode as ProductSpuState['createMode']) || 'project'
    if (state.createMode !== 'project') state.projectId = ''
    return true
  }

  if (action === 'close-drawer') {
    state.drawerOpen = false
    return true
  }

  if (action === 'close-notice') {
    state.notice = ''
    return true
  }

  if (action === 'view-detail') {
    const styleId = actionNode.dataset.styleId
    if (styleId) appStore.navigate(`/pcs/products/styles/${styleId}`)
    return true
  }

  if (action === 'submit-create') {
    if (state.createMode !== 'project') {
      state.drawerOpen = false
      state.notice = '本轮仅接通从商品项目生成款式档案壳。'
      return true
    }

    if (!state.projectId) {
      state.notice = '请先选择商品项目。'
      return true
    }

    const result = generateStyleArchiveShellFromProject(state.projectId)
    state.notice = result.message
    if (result.ok && result.style) {
      state.drawerOpen = false
      appStore.navigate(`/pcs/products/styles/${result.style.styleId}`)
    }
    return true
  }

  return false
}

export function handleProductSpuInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-spu-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.spuField
  const value = (fieldNode as HTMLInputElement | HTMLSelectElement).value

  if (field === 'search') {
    state.search = value
    return true
  }
  if (field === 'statusFilter') {
    state.statusFilter = value
    return true
  }
  if (field === 'projectId') {
    state.projectId = value
    return true
  }
  return false
}

export function isProductSpuDialogOpen(): boolean {
  return state.drawerOpen
}
