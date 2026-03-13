import {
  capabilityTagsFull,
  tagCategories,
} from '../data/fcs/capability-mock-data'
import {
  tagStatusConfig,
  type CapabilityTagFull,
  type TagCategory,
  type TagStatus,
} from '../data/fcs/capability-types'
import { escapeHtml } from '../utils'

const PAGE_SIZE = 10

type SortField = 'name' | 'usageCount'

type DialogState =
  | { type: 'none' }
  | { type: 'tag-form'; mode: 'create' | 'edit'; tagId?: string }
  | { type: 'category-manage' }
  | { type: 'disable-confirm'; tagId: string }
  | { type: 'view'; tagId: string }

interface CapabilityState {
  tags: CapabilityTagFull[]
  categories: TagCategory[]

  searchKeyword: string
  filterCategory: string
  filterStatus: string
  filterSystemTag: 'all' | 'yes' | 'no'

  sortField: SortField
  sortOrder: 'asc' | 'desc'
  currentPage: number

  dialog: DialogState

  tagActionMenuId: string | null
  categoryActionMenuId: string | null

  tagFormErrors: Partial<Record<'name' | 'categoryId', string>>

  categoryFormOpen: boolean
  categoryEditingId: string | null
  categoryFormName: string
  categoryFormError: string
  categoryDisableConfirmId: string | null
}

const state: CapabilityState = {
  tags: [...capabilityTagsFull],
  categories: [...tagCategories],

  searchKeyword: '',
  filterCategory: 'all',
  filterStatus: 'all',
  filterSystemTag: 'all',

  sortField: 'name',
  sortOrder: 'asc',
  currentPage: 1,

  dialog: { type: 'none' },

  tagActionMenuId: null,
  categoryActionMenuId: null,

  tagFormErrors: {},

  categoryFormOpen: false,
  categoryEditingId: null,
  categoryFormName: '',
  categoryFormError: '',
  categoryDisableConfirmId: null,
}

function findTagById(tagId?: string): CapabilityTagFull | null {
  if (!tagId) return null
  return state.tags.find((tag) => tag.id === tagId) ?? null
}

function findCategoryById(categoryId?: string): TagCategory | null {
  if (!categoryId) return null
  return state.categories.find((category) => category.id === categoryId) ?? null
}

function getCategoryTagCount(categoryId: string): number {
  return state.tags.filter((tag) => tag.categoryId === categoryId).length
}

function getFilteredTags(): CapabilityTagFull[] {
  let result = [...state.tags]

  if (state.searchKeyword.trim()) {
    const keyword = state.searchKeyword.toLowerCase()
    result = result.filter((tag) => tag.name.toLowerCase().includes(keyword))
  }

  if (state.filterCategory !== 'all') {
    result = result.filter((tag) => tag.categoryId === state.filterCategory)
  }

  if (state.filterStatus !== 'all') {
    result = result.filter((tag) => tag.status === state.filterStatus)
  }

  if (state.filterSystemTag === 'yes') {
    result = result.filter((tag) => tag.isSystemTag)
  }

  if (state.filterSystemTag === 'no') {
    result = result.filter((tag) => !tag.isSystemTag)
  }

  result.sort((left, right) => {
    if (state.sortField === 'name') {
      const compared = left.name.localeCompare(right.name)
      return state.sortOrder === 'asc' ? compared : -compared
    }

    const compared = left.usageCount - right.usageCount
    return state.sortOrder === 'asc' ? compared : -compared
  })

  return result
}

function getPagedTags(filteredTags: CapabilityTagFull[]): CapabilityTagFull[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredTags.slice(start, start + PAGE_SIZE)
}

function closeDialog(): void {
  state.dialog = { type: 'none' }
  state.tagActionMenuId = null
  state.categoryActionMenuId = null
  state.tagFormErrors = {}
  state.categoryFormOpen = false
  state.categoryEditingId = null
  state.categoryFormName = ''
  state.categoryFormError = ''
  state.categoryDisableConfirmId = null
}

function getStatusBadgeClass(status: TagStatus): string {
  return tagStatusConfig[status].color
}

function renderTagFormDialog(): string {
  if (state.dialog.type !== 'tag-form') return ''

  const editingTag = findTagById(state.dialog.tagId)
  const isEditing = state.dialog.mode === 'edit'
  const activeCategories = state.categories.filter((category) => category.status === 'active')

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-cap-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[480px]" data-dialog-panel="true">
        <form data-cap-form="tag" class="flex h-full flex-col">
          <input type="hidden" name="tagId" value="${escapeHtml(editingTag?.id ?? '')}" />

          <header class="border-b px-6 py-4">
            <h3 class="text-lg font-semibold">${isEditing ? '编辑标签' : '新建标签'}</h3>
            <p class="mt-1 text-sm text-muted-foreground">${isEditing ? '修改能力标签的信息' : '创建新的能力标签'}</p>
          </header>

          <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <label class="space-y-1.5">
              <span class="text-sm font-medium">
                标签名称 <span class="text-red-600">*</span>
              </span>
              <input
                required
                name="name"
                class="w-full rounded-md border px-3 py-2 text-sm"
                value="${escapeHtml(editingTag?.name ?? '')}"
                placeholder="请输入标签名称"
              />
              ${
                state.tagFormErrors.name
                  ? `<p class="text-sm text-red-600">${escapeHtml(state.tagFormErrors.name)}</p>`
                  : ''
              }
            </label>

            <label class="space-y-1.5">
              <span class="text-sm font-medium">
                所属分类 <span class="text-red-600">*</span>
              </span>
              <select required name="categoryId" class="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">请选择分类</option>
                ${activeCategories
                  .map((category) => {
                    const selected = editingTag?.categoryId === category.id ? 'selected' : ''
                    return `<option value="${category.id}" ${selected}>${escapeHtml(category.name)}</option>`
                  })
                  .join('')}
              </select>
              ${
                state.tagFormErrors.categoryId
                  ? `<p class="text-sm text-red-600">${escapeHtml(state.tagFormErrors.categoryId)}</p>`
                  : ''
              }
            </label>

            <label class="space-y-1.5">
              <span class="text-sm font-medium">描述</span>
              <textarea
                name="description"
                rows="3"
                class="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="请输入标签描述"
              >${escapeHtml(editingTag?.description ?? '')}</textarea>
            </label>

            <label class="space-y-1.5">
              <span class="text-sm font-medium">状态</span>
              <select name="status" class="w-full rounded-md border px-3 py-2 text-sm">
                <option value="active" ${(editingTag?.status ?? 'active') === 'active' ? 'selected' : ''}>启用</option>
                <option value="inactive" ${(editingTag?.status ?? 'active') === 'inactive' ? 'selected' : ''}>禁用</option>
              </select>
            </label>

            <div class="flex items-center justify-between rounded-lg border p-4">
              <div class="space-y-0.5">
                <p class="text-sm font-medium">系统标签</p>
                <p class="text-sm text-muted-foreground">系统标签不可被普通用户删除</p>
              </div>
              <label class="relative inline-flex h-6 w-11 items-center">
                <input
                  type="checkbox"
                  name="isSystemTag"
                  class="peer sr-only"
                  ${editingTag?.isSystemTag ? 'checked' : ''}
                />
                <span class="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600"></span>
                <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></span>
              </label>
            </div>
          </div>

          <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
            <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cap-action="close-dialog">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">${isEditing ? '保存' : '创建'}</button>
          </footer>
        </form>
      </section>
    </div>
  `
}

function renderCategoryDisableConfirmDialog(): string {
  if (state.categoryDisableConfirmId === null) return ''
  const category = findCategoryById(state.categoryDisableConfirmId)
  if (!category) return ''

  const tagCount = getCategoryTagCount(category.id)

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <div class="px-6 py-5">
          <h3 class="text-lg font-semibold">确认禁用分类</h3>
          <p class="mt-2 text-sm text-muted-foreground">
            该分类下有 ${tagCount} 个标签，禁用后这些标签将无法被新工厂选择。确定要禁用吗？
          </p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cap-action="cancel-disable-category">取消</button>
          <button class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" data-cap-action="confirm-disable-category">确认禁用</button>
        </div>
      </div>
    </div>
  `
}

function renderCategoryDialog(): string {
  if (state.dialog.type !== 'category-manage') return ''
  const editingCategory = findCategoryById(state.categoryEditingId)

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-[600px] rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">分类管理</h3>
              <p class="mt-1 text-sm text-muted-foreground">管理能力标签的分类，支持新增、编辑和禁用操作</p>
            </div>
            <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cap-action="close-dialog">关闭</button>
          </div>
        </header>

        <div class="space-y-4 px-6 py-5">
          ${
            state.categoryFormOpen
              ? `
                <div class="space-y-4 rounded-lg border p-4">
                  <h4 class="font-medium">${editingCategory ? '编辑分类' : '新建分类'}</h4>
                  <label class="space-y-1.5">
                    <span class="text-sm font-medium">分类名称</span>
                    <input
                      data-cap-field="categoryFormName"
                      value="${escapeHtml(state.categoryFormName)}"
                      placeholder="请输入分类名称"
                      class="w-full rounded-md border px-3 py-2 text-sm"
                    />
                    ${
                      state.categoryFormError
                        ? `<p class="text-sm text-red-600">${escapeHtml(state.categoryFormError)}</p>`
                        : ''
                    }
                  </label>
                  <div class="flex gap-2">
                    <button class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-cap-action="submit-category-form">${
                      editingCategory ? '保存' : '创建'
                    }</button>
                    <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cap-action="cancel-category-form">取消</button>
                  </div>
                </div>
              `
              : `
                <button class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-cap-action="open-category-form">
                  <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
                  新建分类
                </button>
              `
          }

          <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/30">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">分类名称</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">标签数量</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">状态</th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  state.categories.length === 0
                    ? '<tr><td colspan="4" class="h-24 px-3 text-center text-muted-foreground">暂无分类数据</td></tr>'
                    : state.categories
                        .map((category) => {
                          const status = tagStatusConfig[category.status]
                          const tagCount = getCategoryTagCount(category.id)
                          return `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2 font-medium">${escapeHtml(category.name)}</td>
                              <td class="px-3 py-2">${tagCount}</td>
                              <td class="px-3 py-2">
                                <span class="inline-flex rounded border px-2 py-0.5 text-xs ${getStatusBadgeClass(category.status)}">${escapeHtml(
                                  status.label,
                                )}</span>
                              </td>
                              <td class="px-3 py-2 text-right">
                                <div class="relative inline-block text-left">
                                  <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-cap-action="toggle-category-menu" data-category-id="${category.id}">
                                    <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                                  </button>
                                  ${
                                    state.categoryActionMenuId === category.id
                                      ? `
                                        <div class="absolute right-0 z-20 mt-1 min-w-[120px] rounded-md border bg-background p-1 shadow-lg">
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-cap-action="open-category-edit" data-category-id="${category.id}">
                                            <i data-lucide="pencil" class="mr-2 h-4 w-4"></i>编辑
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-cap-action="toggle-category-status" data-category-id="${category.id}">
                                            <i data-lucide="ban" class="mr-2 h-4 w-4"></i>${category.status === 'active' ? '禁用' : '启用'}
                                          </button>
                                        </div>
                                      `
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
        </div>
      </div>

      ${renderCategoryDisableConfirmDialog()}
    </div>
  `
}

function renderDisableConfirmDialog(): string {
  if (state.dialog.type !== 'disable-confirm') return ''

  const tag = findTagById(state.dialog.tagId)
  if (!tag) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <div class="px-6 py-5">
          <h3 class="text-lg font-semibold">确认禁用标签</h3>
          <p class="mt-2 text-sm text-muted-foreground">确定要禁用标签「${escapeHtml(tag.name)}」吗？禁用后该标签将不再显示在工厂能力选项中。</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cap-action="close-dialog">取消</button>
          <button class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" data-cap-action="confirm-disable-tag" data-tag-id="${tag.id}">确认禁用</button>
        </div>
      </div>
    </div>
  `
}

function renderViewDialog(): string {
  if (state.dialog.type !== 'view') return ''

  const tag = findTagById(state.dialog.tagId)
  if (!tag) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-lg rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <div class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">标签详情</h3>
        </div>

        <div class="space-y-3 px-6 py-5 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <span class="text-muted-foreground">标签名称：</span><span>${escapeHtml(tag.name)}</span>
            <span class="text-muted-foreground">所属分类：</span><span>${escapeHtml(tag.categoryName)}</span>
            <span class="text-muted-foreground">状态：</span><span>${tag.status === 'active' ? '启用' : '禁用'}</span>
            <span class="text-muted-foreground">使用次数：</span><span>${tag.usageCount}</span>
            <span class="text-muted-foreground">系统标签：</span><span>${tag.isSystemTag ? '是' : '否'}</span>
            <span class="text-muted-foreground">描述：</span><span>${escapeHtml(tag.description || '-')}</span>
            <span class="text-muted-foreground">创建时间：</span><span>${escapeHtml(tag.createdAt)}</span>
            <span class="text-muted-foreground">更新时间：</span><span>${escapeHtml(tag.updatedAt)}</span>
          </div>
        </div>

        <div class="flex items-center justify-end border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cap-action="close-dialog">关闭</button>
        </div>
      </div>
    </div>
  `
}

function renderPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return ''

  return `
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">共 ${total} 条记录</p>
      <div class="flex items-center gap-1">
        <button class="rounded-md border px-3 py-1 text-sm ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-cap-action="prev-page">上一页</button>
        ${Array.from({ length: totalPages }, (_, index) => index + 1)
          .map(
            (page) =>
              `<button class="rounded-md border px-3 py-1 text-sm ${page === state.currentPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}" data-cap-action="goto-page" data-page="${page}">${page}</button>`,
          )
          .join('')}
        <button class="rounded-md border px-3 py-1 text-sm ${state.currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-cap-action="next-page">下一页</button>
      </div>
    </div>
  `
}

export function renderCapabilityPage(): string {
  const filteredTags = getFilteredTags()
  const pagedTags = getPagedTags(filteredTags)

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">能力标签</h1>
          <p class="mt-1 text-sm text-muted-foreground">管理工厂能力标签的分类和定义</p>
        </div>
        <div class="flex gap-2">
          <button class="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cap-action="open-category-dialog">
            <i data-lucide="settings-2" class="mr-2 h-4 w-4"></i>
            分类管理
          </button>
          <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cap-action="open-create-tag">
            <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
            新建标签
          </button>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">标签分类</span>
            <select data-cap-filter="category" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all" ${state.filterCategory === 'all' ? 'selected' : ''}>全部分类</option>
              ${state.categories
                .map(
                  (category) =>
                    `<option value="${category.id}" ${state.filterCategory === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`,
                )
                .join('')}
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">标签状态</span>
            <select data-cap-filter="status" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>全部状态</option>
              <option value="active" ${state.filterStatus === 'active' ? 'selected' : ''}>启用</option>
              <option value="inactive" ${state.filterStatus === 'inactive' ? 'selected' : ''}>禁用</option>
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">系统标签</span>
            <select data-cap-filter="system" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all" ${state.filterSystemTag === 'all' ? 'selected' : ''}>全部</option>
              <option value="yes" ${state.filterSystemTag === 'yes' ? 'selected' : ''}>是</option>
              <option value="no" ${state.filterSystemTag === 'no' ? 'selected' : ''}>否</option>
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">关键词搜索</span>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
              <input data-cap-filter="search" value="${escapeHtml(state.searchKeyword)}" placeholder="搜索标签名称" class="w-full rounded-md border py-2 pl-9 pr-3 text-sm" />
            </div>
          </label>

          <div class="space-y-2">
            <span class="invisible text-xs">操作</span>
            <button class="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cap-action="reset">重置</button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left">
                <button class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" data-cap-action="sort" data-sort-field="name">
                  标签名称
                  <i data-lucide="arrow-up-down" class="h-3.5 w-3.5"></i>
                </button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">所属分类</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="px-3 py-3 text-left">
                <button class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" data-cap-action="sort" data-sort-field="usageCount">
                  使用次数
                  <i data-lucide="arrow-up-down" class="h-3.5 w-3.5"></i>
                </button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">系统标签</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">最近更新</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              pagedTags.length === 0
                ? '<tr><td colspan="7" class="h-24 px-3 text-center text-muted-foreground">暂无数据</td></tr>'
                : pagedTags
                    .map((tag) => {
                      const status = tagStatusConfig[tag.status]
                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 font-medium">${escapeHtml(tag.name)}</td>
                          <td class="px-3 py-3">${escapeHtml(tag.categoryName)}</td>
                          <td class="px-3 py-3"><span class="inline-flex rounded border px-2 py-0.5 text-xs ${getStatusBadgeClass(tag.status)}">${escapeHtml(status.label)}</span></td>
                          <td class="px-3 py-3">${tag.usageCount}</td>
                          <td class="px-3 py-3">
                            ${
                              tag.isSystemTag
                                ? '<i data-lucide="check" class="h-4 w-4 text-green-600"></i>'
                                : '<span class="text-muted-foreground">-</span>'
                            }
                          </td>
                          <td class="px-3 py-3 text-muted-foreground">${escapeHtml(tag.updatedAt)}</td>
                          <td class="px-3 py-3 text-right">
                            <div class="relative inline-block text-left">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-cap-action="toggle-tag-menu" data-tag-id="${tag.id}">
                                <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                              </button>
                              ${
                                state.tagActionMenuId === tag.id
                                  ? `
                                    <div class="absolute right-0 z-20 mt-1 min-w-[120px] rounded-md border bg-background p-1 shadow-lg">
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-cap-action="view-tag" data-tag-id="${tag.id}">
                                        <i data-lucide="eye" class="mr-2 h-4 w-4"></i>查看
                                      </button>
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-cap-action="edit-tag" data-tag-id="${tag.id}">
                                        <i data-lucide="pencil" class="mr-2 h-4 w-4"></i>编辑
                                      </button>
                                      ${
                                        tag.status === 'active'
                                          ? `
                                            <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50" data-cap-action="disable-tag" data-tag-id="${tag.id}">
                                              <i data-lucide="ban" class="mr-2 h-4 w-4"></i>禁用
                                            </button>
                                          `
                                          : ''
                                      }
                                    </div>
                                  `
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

      ${renderPagination(filteredTags.length)}
      ${renderTagFormDialog()}
      ${renderCategoryDialog()}
      ${renderDisableConfirmDialog()}
      ${renderViewDialog()}
    </div>
  `
}

function updateCategoryNameForTags(categoryId: string, categoryName: string): void {
  state.tags = state.tags.map((tag) => (tag.categoryId === categoryId ? { ...tag, categoryName } : tag))
}

function toggleCategoryStatus(categoryId: string): void {
  state.categories = state.categories.map((category) =>
    category.id === categoryId
      ? {
          ...category,
          status: category.status === 'active' ? 'inactive' : 'active',
        }
      : category,
  )
}

export function handleCapabilityEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-cap-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.capFilter
    const value = filterNode.value

    if (filter === 'search') state.searchKeyword = value
    if (filter === 'category') state.filterCategory = value
    if (filter === 'status') state.filterStatus = value
    if (filter === 'system') state.filterSystemTag = value as 'all' | 'yes' | 'no'

    state.currentPage = 1
    state.tagActionMenuId = null
    state.categoryActionMenuId = null
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cap-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.capField
    const value = fieldNode.value

    if (field === 'categoryFormName') {
      state.categoryFormName = value
      state.categoryFormError = ''
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-cap-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.capAction
  if (!action) return false

  if (action === 'toggle-tag-menu') {
    const tagId = actionNode.dataset.tagId
    if (!tagId) return true
    state.tagActionMenuId = state.tagActionMenuId === tagId ? null : tagId
    state.categoryActionMenuId = null
    return true
  }

  if (action === 'toggle-category-menu') {
    const categoryId = actionNode.dataset.categoryId
    if (!categoryId) return true
    state.categoryActionMenuId = state.categoryActionMenuId === categoryId ? null : categoryId
    state.tagActionMenuId = null
    return true
  }

  if (action === 'open-create-tag') {
    state.dialog = { type: 'tag-form', mode: 'create' }
    state.tagFormErrors = {}
    state.tagActionMenuId = null
    return true
  }

  if (action === 'edit-tag') {
    const tagId = actionNode.dataset.tagId
    if (!tagId) return true
    state.dialog = { type: 'tag-form', mode: 'edit', tagId }
    state.tagFormErrors = {}
    state.tagActionMenuId = null
    return true
  }

  if (action === 'view-tag') {
    const tagId = actionNode.dataset.tagId
    if (!tagId) return true
    state.dialog = { type: 'view', tagId }
    state.tagActionMenuId = null
    return true
  }

  if (action === 'disable-tag') {
    const tagId = actionNode.dataset.tagId
    if (!tagId) return true
    state.dialog = { type: 'disable-confirm', tagId }
    state.tagActionMenuId = null
    return true
  }

  if (action === 'confirm-disable-tag') {
    const tagId = actionNode.dataset.tagId
    if (!tagId) return true
    state.tags = state.tags.map((tag) =>
      tag.id === tagId
        ? {
            ...tag,
            status: 'inactive',
            updatedAt: new Date().toISOString().split('T')[0],
          }
        : tag,
    )
    closeDialog()
    return true
  }

  if (action === 'open-category-dialog') {
    state.dialog = { type: 'category-manage' }
    state.categoryFormOpen = false
    state.categoryEditingId = null
    state.categoryFormName = ''
    state.categoryFormError = ''
    state.categoryDisableConfirmId = null
    state.categoryActionMenuId = null
    return true
  }

  if (action === 'open-category-form') {
    state.categoryFormOpen = true
    state.categoryEditingId = null
    state.categoryFormName = ''
    state.categoryFormError = ''
    state.categoryActionMenuId = null
    return true
  }

  if (action === 'open-category-edit') {
    const categoryId = actionNode.dataset.categoryId
    if (!categoryId) return true
    const category = findCategoryById(categoryId)
    if (!category) return true

    state.categoryFormOpen = true
    state.categoryEditingId = category.id
    state.categoryFormName = category.name
    state.categoryFormError = ''
    state.categoryActionMenuId = null
    return true
  }

  if (action === 'cancel-category-form') {
    state.categoryFormOpen = false
    state.categoryEditingId = null
    state.categoryFormName = ''
    state.categoryFormError = ''
    return true
  }

  if (action === 'submit-category-form') {
    const name = state.categoryFormName.trim()
    if (!name) {
      state.categoryFormError = '分类名称不能为空'
      return true
    }

    if (state.categoryEditingId) {
      state.categories = state.categories.map((category) =>
        category.id === state.categoryEditingId
          ? {
              ...category,
              name,
            }
          : category,
      )
      updateCategoryNameForTags(state.categoryEditingId, name)
    } else {
      const newCategory: TagCategory = {
        id: `cat-${Date.now()}`,
        name,
        status: 'active',
        sortOrder: state.categories.length + 1,
      }
      state.categories = [...state.categories, newCategory]
    }

    state.categoryFormOpen = false
    state.categoryEditingId = null
    state.categoryFormName = ''
    state.categoryFormError = ''
    return true
  }

  if (action === 'toggle-category-status') {
    const categoryId = actionNode.dataset.categoryId
    if (!categoryId) return true
    const category = findCategoryById(categoryId)
    if (!category) return true

    if (category.status === 'active') {
      const tagCount = getCategoryTagCount(categoryId)
      if (tagCount > 0) {
        state.categoryDisableConfirmId = categoryId
        state.categoryActionMenuId = null
        return true
      }
    }

    toggleCategoryStatus(categoryId)
    state.categoryActionMenuId = null
    return true
  }

  if (action === 'cancel-disable-category') {
    state.categoryDisableConfirmId = null
    return true
  }

  if (action === 'confirm-disable-category') {
    if (!state.categoryDisableConfirmId) return true
    const categoryId = state.categoryDisableConfirmId
    state.categoryDisableConfirmId = null
    state.categoryActionMenuId = null

    state.categories = state.categories.map((category) =>
      category.id === categoryId
        ? {
            ...category,
            status: 'inactive',
          }
        : category,
    )
    return true
  }

  if (action === 'sort') {
    const field = actionNode.dataset.sortField as SortField | undefined
    if (!field) return true

    if (state.sortField === field) {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
    } else {
      state.sortField = field
      state.sortOrder = 'asc'
    }

    state.tagActionMenuId = null
    return true
  }

  const totalPages = Math.max(1, Math.ceil(getFilteredTags().length / PAGE_SIZE))

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    state.tagActionMenuId = null
    return true
  }

  if (action === 'next-page') {
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    state.tagActionMenuId = null
    return true
  }

  if (action === 'goto-page') {
    const page = Number(actionNode.dataset.page ?? '1')
    state.currentPage = Math.max(1, Math.min(totalPages, page))
    state.tagActionMenuId = null
    return true
  }

  if (action === 'reset') {
    state.searchKeyword = ''
    state.filterCategory = 'all'
    state.filterStatus = 'all'
    state.filterSystemTag = 'all'
    state.currentPage = 1
    state.tagActionMenuId = null
    state.categoryActionMenuId = null
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  return false
}

export function handleCapabilitySubmit(form: HTMLFormElement): boolean {
  const formType = form.dataset.capForm
  if (formType !== 'tag') return false

  const formData = new FormData(form)

  const name = formData.get('name')?.toString().trim() ?? ''
  const categoryId = formData.get('categoryId')?.toString() ?? ''
  const errors: CapabilityState['tagFormErrors'] = {}

  if (!name) {
    errors.name = '标签名称不能为空'
  }

  if (!categoryId) {
    errors.categoryId = '请选择所属分类'
  }

  if (Object.keys(errors).length > 0) {
    state.tagFormErrors = errors
    return true
  }

  const tagId = formData.get('tagId')?.toString()
  const categoryName = state.categories.find((category) => category.id === categoryId)?.name ?? ''

  const payload: Omit<CapabilityTagFull, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'> = {
    name,
    categoryId,
    categoryName,
    description: formData.get('description')?.toString() ?? '',
    status: (formData.get('status')?.toString() as TagStatus) ?? 'active',
    isSystemTag: formData.get('isSystemTag') === 'on',
  }

  const today = new Date().toISOString().split('T')[0]

  if (tagId) {
    state.tags = state.tags.map((tag) =>
      tag.id === tagId
        ? {
            ...tag,
            ...payload,
            updatedAt: today,
          }
        : tag,
    )
  } else {
    const newTag: CapabilityTagFull = {
      id: `tag-${Date.now()}`,
      usageCount: 0,
      createdAt: today,
      updatedAt: today,
      ...payload,
    }
    state.tags = [...state.tags, newTag]
  }

  closeDialog()
  return true
}

export function isCapabilityDialogOpen(): boolean {
  return state.dialog.type !== 'none'
}
