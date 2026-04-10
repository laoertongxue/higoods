import { escapeHtml } from '../utils'
import {
  renderLabeledInput,
  renderLabeledSelect,
  renderLabeledTextarea,
} from '../components/ui'
import { appStore } from '../state/store'
import {
  createMaterialArchiveRecord,
  getMaterialArchiveRecord,
  listMaterialArchiveRecords,
  MATERIAL_ARCHIVE_STATUS_LABELS,
  updateMaterialArchiveRecord,
  type MaterialArchiveDraft,
  type MaterialArchiveKind,
  type MaterialArchiveRecord,
  type MaterialArchiveSource,
  type MaterialArchiveStatus,
} from '../data/pcs-material-archives'

interface MaterialListFilterState {
  search: string
  status: 'all' | MaterialArchiveStatus
  category: 'all' | string
}

interface MaterialArchiveEditorForm {
  archiveCode: string
  name: string
  alias: string
  subCategory: string
  materialSummary: string
  specSummary: string
  fieldA: string
  fieldB: string
  fieldC: string
  unit: string
  useScope: string
  applicableCategories: string
  processTags: string
  source: MaterialArchiveSource
  status: MaterialArchiveStatus
  governanceOwner: string
  imageUrl: string
  summary: string
  notes: string
}

interface MaterialArchiveMeta {
  label: string
  singular: string
  breadcrumb: string
  description: string
  codePrefix: string
  categoryOptions: string[]
  unitOptions: string[]
  fieldALabel: string
  fieldAPlaceholder: string
  fieldBLabel: string
  fieldBPlaceholder: string
  fieldCLabel: string
  fieldCPlaceholder: string
}

interface MaterialArchivePageState {
  listFilters: Record<MaterialArchiveKind, MaterialListFilterState>
  editorContextKey: string
  editorKind: MaterialArchiveKind
  editorMode: 'create' | 'edit'
  editorRecordId: string | null
  editorForm: MaterialArchiveEditorForm
}

const MATERIAL_ARCHIVE_META: Record<MaterialArchiveKind, MaterialArchiveMeta> = {
  fabric: {
    label: '面料档案',
    singular: '面料',
    breadcrumb: '物料档案 / 面料档案',
    description: '围绕面料主档维护成分、门幅克重、手感与适用品类，服务款式和规格引用。',
    codePrefix: 'FAB',
    categoryOptions: ['梭织雪纺', '仿牛仔', '针织罗纹', '蕾丝', '毛呢', '功能面料'],
    unitOptions: ['米', '公斤', '码'],
    fieldALabel: '成分 / 组织',
    fieldAPlaceholder: '如：100%涤纶 / 雪纺平纹',
    fieldBLabel: '门幅 / 克重',
    fieldBPlaceholder: '如：145cm / 92g',
    fieldCLabel: '手感 / 弹性',
    fieldCPlaceholder: '如：轻薄垂顺 / 微弹',
  },
  accessory: {
    label: '辅料档案',
    singular: '辅料',
    breadcrumb: '物料档案 / 辅料档案',
    description: '统一维护拉链、纽扣、绣片、织带等跨款复用辅料主档，聚焦规格和使用部位。',
    codePrefix: 'ACC',
    categoryOptions: ['花边', '绣片', '绣章', '立体花饰', '拉链', '纽扣', '织带'],
    unitOptions: ['片', '个', '码', '条'],
    fieldALabel: '主材 / 表面工艺',
    fieldAPlaceholder: '如：涤纶底布 / 蕾丝刺绣',
    fieldBLabel: '尺寸 / 规格',
    fieldBPlaceholder: '如：1.8cm宽 / 软挺适中',
    fieldCLabel: '使用部位',
    fieldCPlaceholder: '如：领口、袖口、门襟点缀',
  },
  yarn: {
    label: '纱线档案',
    singular: '纱线',
    breadcrumb: '物料档案 / 纱线档案',
    description: '围绕纱线主档维护成分、纱支、纺纱方式和适用品类，支撑针织与面料开发引用。',
    codePrefix: 'YRN',
    categoryOptions: ['棉纱', '混纺纱', '羊毛纱', '化纤长丝', '麻纱'],
    unitOptions: ['公斤', '克', '筒'],
    fieldALabel: '成分 / 纱支',
    fieldAPlaceholder: '如：100%精梳棉 / 32S',
    fieldBLabel: '纺纱方式 / 捻度',
    fieldBPlaceholder: '如：环锭纺 / 单纱',
    fieldCLabel: '适用方向',
    fieldCPlaceholder: '如：基础T恤与针织上衣',
  },
  consumable: {
    label: '耗材档案',
    singular: '耗材',
    breadcrumb: '物料档案 / 耗材档案',
    description: '承接包装、贴标、陈列等通用耗材主档，只维护识别、规格与使用场景。',
    codePrefix: 'CON',
    categoryOptions: ['包装耗材', '标识耗材', '品牌耗材', '陈列耗材'],
    unitOptions: ['个', '卷', '套', '包'],
    fieldALabel: '材质 / 包装方式',
    fieldAPlaceholder: '如：PE / 半透明包装',
    fieldBLabel: '尺寸 / 规格',
    fieldBPlaceholder: '如：45cm × 60cm / 中号',
    fieldCLabel: '使用阶段',
    fieldCPlaceholder: '如：成衣包装、样衣保护',
  },
}

const SOURCE_OPTIONS: MaterialArchiveSource[] = ['自建档案', '旧系统迁移', '开发沉淀', '样衣沉淀']

function createDefaultListFilters(): Record<MaterialArchiveKind, MaterialListFilterState> {
  return {
    fabric: { search: '', status: 'all', category: 'all' },
    accessory: { search: '', status: 'all', category: 'all' },
    yarn: { search: '', status: 'all', category: 'all' },
    consumable: { search: '', status: 'all', category: 'all' },
  }
}

function buildArchiveCode(kind: MaterialArchiveKind): string {
  const prefix = MATERIAL_ARCHIVE_META[kind].codePrefix
  const next = String(listMaterialArchiveRecords(kind).length + 1).padStart(3, '0')
  return `${prefix}-260410-${next}`
}

function createEmptyEditorForm(kind: MaterialArchiveKind): MaterialArchiveEditorForm {
  return {
    archiveCode: buildArchiveCode(kind),
    name: '',
    alias: '',
    subCategory: MATERIAL_ARCHIVE_META[kind].categoryOptions[0],
    materialSummary: '',
    specSummary: '',
    fieldA: '',
    fieldB: '',
    fieldC: '',
    unit: MATERIAL_ARCHIVE_META[kind].unitOptions[0],
    useScope: '',
    applicableCategories: '',
    processTags: '',
    source: kind === 'accessory' ? '旧系统迁移' : '自建档案',
    status: 'DRAFT',
    governanceOwner: `${MATERIAL_ARCHIVE_META[kind].singular}治理组`,
    imageUrl: '/placeholder.svg',
    summary: '',
    notes: '',
  }
}

function mapRecordToEditorForm(record: MaterialArchiveRecord): MaterialArchiveEditorForm {
  return {
    archiveCode: record.archiveCode,
    name: record.name,
    alias: record.alias,
    subCategory: record.subCategory,
    materialSummary: record.materialSummary,
    specSummary: record.specSummary,
    fieldA: record.fieldA,
    fieldB: record.fieldB,
    fieldC: record.fieldC,
    unit: record.unit,
    useScope: record.useScope,
    applicableCategories: record.applicableCategories.join('，'),
    processTags: record.processTags.join('，'),
    source: record.source,
    status: record.status,
    governanceOwner: record.governanceOwner,
    imageUrl: record.imageUrl,
    summary: record.summary,
    notes: record.notes,
  }
}

let state: MaterialArchivePageState = {
  listFilters: createDefaultListFilters(),
  editorContextKey: '',
  editorKind: 'fabric',
  editorMode: 'create',
  editorRecordId: null,
  editorForm: createEmptyEditorForm('fabric'),
}

function normalizeMultiValueInput(value: string): string[] {
  return value
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getMaterialStatusBadge(status: MaterialArchiveStatus): string {
  const cls =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : status === 'DRAFT'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-700'

  return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}">${MATERIAL_ARCHIVE_STATUS_LABELS[status]}</span>`
}

function getCurrentListFilters(kind: MaterialArchiveKind): MaterialListFilterState {
  return state.listFilters[kind]
}

function getFilteredRecords(kind: MaterialArchiveKind): MaterialArchiveRecord[] {
  const filters = getCurrentListFilters(kind)
  const keyword = filters.search.trim().toLowerCase()

  return listMaterialArchiveRecords(kind).filter((record) => {
    const matchKeyword =
      !keyword ||
      record.archiveCode.toLowerCase().includes(keyword) ||
      record.name.toLowerCase().includes(keyword) ||
      record.alias.toLowerCase().includes(keyword) ||
      record.materialSummary.toLowerCase().includes(keyword) ||
      record.processTags.join(',').toLowerCase().includes(keyword)

    const matchStatus = filters.status === 'all' || record.status === filters.status
    const matchCategory = filters.category === 'all' || record.subCategory === filters.category
    return matchKeyword && matchStatus && matchCategory
  })
}

function getArchiveStats(kind: MaterialArchiveKind) {
  const records = listMaterialArchiveRecords(kind)
  const activeCount = records.filter((item) => item.status === 'ACTIVE').length
  const draftCount = records.filter((item) => item.status === 'DRAFT').length
  const referenceCount = records.reduce((sum, item) => sum + item.references.length, 0)
  const recentCount = records.filter((item) => item.updatedAt >= '2026-04-04 00:00').length
  return {
    totalCount: records.length,
    activeCount,
    draftCount,
    referenceCount,
    recentCount,
  }
}

function renderArchiveNotice(kind: MaterialArchiveKind): string {
  const meta = MATERIAL_ARCHIVE_META[kind]
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div class="flex items-start gap-3">
        <i data-lucide="shield-check" class="mt-0.5 h-4 w-4 text-blue-700"></i>
        <div class="text-sm text-blue-900">
          <p class="font-medium">${escapeHtml(meta.label)}只维护可复用主档信息</p>
          <p class="mt-1">供应商、成本价、含运成本价、库存不再进入商品中心主档；这些信息分别由采购、成本与库存域承接。</p>
        </div>
      </div>
    </section>
  `
}

function renderMaterialArchiveListPage(kind: MaterialArchiveKind): string {
  const meta = MATERIAL_ARCHIVE_META[kind]
  const filters = getCurrentListFilters(kind)
  const records = getFilteredRecords(kind)
  const stats = getArchiveStats(kind)

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-gray-500">${escapeHtml(meta.breadcrumb)}</p>
          <h1 class="mt-2 text-2xl font-semibold">${escapeHtml(meta.label)}</h1>
          <p class="mt-1 text-sm text-gray-500">${escapeHtml(meta.description)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-material-archive-action="reset-filters" data-kind="${kind}">
            重置筛选
          </button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700" data-material-archive-action="go-create" data-kind="${kind}">
            新建${escapeHtml(meta.singular)}
          </button>
        </div>
      </header>

      ${renderArchiveNotice(kind)}

      <section class="grid gap-3 md:grid-cols-4">
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">主档总数</p>
          <p class="mt-2 text-2xl font-semibold">${stats.totalCount}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">启用中</p>
          <p class="mt-2 text-2xl font-semibold text-green-700">${stats.activeCount}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">草稿待治理</p>
          <p class="mt-2 text-2xl font-semibold text-amber-700">${stats.draftCount}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">被引用款式</p>
          <p class="mt-2 text-2xl font-semibold text-blue-700">${stats.referenceCount}</p>
          <p class="mt-1 text-xs text-gray-500">近 7 天更新 ${stats.recentCount} 条</p>
        </article>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative min-w-[280px] flex-1">
            <i data-lucide="search" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"></i>
            <input
              class="h-9 w-full rounded-md border pl-9 pr-3 text-sm"
              placeholder="搜索档案编码、名称、别名或标签"
              value="${escapeHtml(filters.search)}"
              data-material-archive-filter="search"
              data-kind="${kind}"
            />
          </div>
          <select class="h-9 rounded-md border px-3 text-sm" data-material-archive-filter="category" data-kind="${kind}">
            <option value="all" ${filters.category === 'all' ? 'selected' : ''}>全部分类</option>
            ${meta.categoryOptions
              .map((option) => `<option value="${escapeHtml(option)}" ${filters.category === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
              .join('')}
          </select>
          <select class="h-9 rounded-md border px-3 text-sm" data-material-archive-filter="status" data-kind="${kind}">
            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="ACTIVE" ${filters.status === 'ACTIVE' ? 'selected' : ''}>启用</option>
            <option value="DRAFT" ${filters.status === 'DRAFT' ? 'selected' : ''}>草稿</option>
            <option value="INACTIVE" ${filters.status === 'INACTIVE' ? 'selected' : ''}>停用</option>
          </select>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b bg-gray-50 text-left text-gray-500">
                <th class="px-3 py-3 font-medium">档案编码 / 名称</th>
                <th class="px-3 py-3 font-medium">分类</th>
                <th class="px-3 py-3 font-medium">关键规格</th>
                <th class="px-3 py-3 font-medium">适用品类</th>
                <th class="px-3 py-3 font-medium">治理状态</th>
                <th class="px-3 py-3 font-medium">引用款式</th>
                <th class="px-3 py-3 font-medium">更新信息</th>
                <th class="px-3 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              ${records.length === 0 ? `
                <tr>
                  <td colspan="8" class="px-3 py-10 text-center text-sm text-gray-500">暂无符合条件的${escapeHtml(meta.label)}记录</td>
                </tr>
              ` : records
                .map(
                  (record) => `
                    <tr class="border-b last:border-b-0 hover:bg-gray-50">
                      <td class="px-3 py-3">
                        <div class="flex items-center gap-3">
                          <img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.name)}" class="h-12 w-12 rounded-md border object-cover bg-gray-50" />
                          <div>
                            <button class="text-left font-medium text-gray-900 hover:text-blue-700" data-material-archive-action="go-detail" data-kind="${kind}" data-record-id="${record.id}">
                              ${escapeHtml(record.name)}
                            </button>
                            <p class="text-xs text-gray-500">${escapeHtml(record.archiveCode)}${record.alias ? ` ｜ ${escapeHtml(record.alias)}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-3 py-3">${escapeHtml(record.subCategory)}</td>
                      <td class="px-3 py-3">
                        <p>${escapeHtml(record.materialSummary)}</p>
                        <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.specSummary)}</p>
                      </td>
                      <td class="px-3 py-3">
                        <div class="flex flex-wrap gap-1">
                          ${record.applicableCategories.map((item) => `<span class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">${escapeHtml(item)}</span>`).join('')}
                        </div>
                      </td>
                      <td class="px-3 py-3">
                        ${getMaterialStatusBadge(record.status)}
                        <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.source)}</p>
                      </td>
                      <td class="px-3 py-3">
                        <p class="font-medium">${record.references.length} 款</p>
                        <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.references[0]?.styleName || '暂无引用')}</p>
                      </td>
                      <td class="px-3 py-3">
                        <p>${escapeHtml(record.updatedAt)}</p>
                        <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.updatedBy)}</p>
                      </td>
                      <td class="px-3 py-3">
                        <div class="flex justify-end gap-2">
                          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-material-archive-action="go-detail" data-kind="${kind}" data-record-id="${record.id}">详情</button>
                          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-material-archive-action="go-edit" data-kind="${kind}" data-record-id="${record.id}">编辑</button>
                        </div>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderTagPills(values: string[]): string {
  if (!values.length) {
    return '<p class="text-sm text-gray-500">暂无</p>'
  }
  return `
    <div class="flex flex-wrap gap-2">
      ${values.map((value) => `<span class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">${escapeHtml(value)}</span>`).join('')}
    </div>
  `
}

function renderMaterialArchiveDetailPage(kind: MaterialArchiveKind, recordId: string): string {
  const meta = MATERIAL_ARCHIVE_META[kind]
  const record = getMaterialArchiveRecord(kind, recordId)

  if (!record) {
    return `
      <div class="space-y-4">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-material-archive-action="go-list" data-kind="${kind}">
          返回${escapeHtml(meta.label)}
        </button>
        <section class="rounded-lg border border-dashed bg-white px-6 py-16 text-center text-sm text-gray-500">未找到对应${escapeHtml(meta.singular)}主档</section>
      </div>
    `
  }

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <p class="text-xs text-gray-500">${escapeHtml(meta.breadcrumb)} / 详情</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-material-archive-action="go-list" data-kind="${kind}">
              返回${escapeHtml(meta.label)}
            </button>
            ${getMaterialStatusBadge(record.status)}
            <span class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">${escapeHtml(record.subCategory)}</span>
            <span class="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">${escapeHtml(record.source)}</span>
          </div>
          <h1 class="text-2xl font-semibold">${escapeHtml(record.name)}</h1>
          <p class="text-sm text-gray-500">${escapeHtml(record.archiveCode)}${record.alias ? ` ｜ ${escapeHtml(record.alias)}` : ''}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-material-archive-action="go-edit" data-kind="${kind}" data-record-id="${record.id}">
            编辑档案
          </button>
        </div>
      </header>

      ${renderArchiveNotice(kind)}

      ${record.migrationNote ? `
        <section class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p class="font-medium">迁移处理</p>
          <p class="mt-1">${escapeHtml(record.migrationNote)}</p>
        </section>
      ` : ''}

      <section class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <article class="rounded-lg border bg-white p-4">
          <img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.name)}" class="h-64 w-full rounded-md border object-cover bg-gray-50" />
          <div class="mt-4 space-y-2 text-sm">
            <div class="flex items-center justify-between gap-3"><span class="text-gray-500">治理负责人</span><span class="font-medium">${escapeHtml(record.governanceOwner)}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-gray-500">创建时间</span><span class="font-medium">${escapeHtml(record.createdAt)}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-gray-500">更新时间</span><span class="font-medium">${escapeHtml(record.updatedAt)}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-gray-500">更新人</span><span class="font-medium">${escapeHtml(record.updatedBy)}</span></div>
          </div>
        </article>

        <article class="space-y-4 rounded-lg border bg-white p-4">
          <div>
            <h2 class="text-base font-semibold">主档摘要</h2>
            <p class="mt-2 text-sm text-gray-600">${escapeHtml(record.summary)}</p>
          </div>

          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article class="rounded-lg bg-slate-50 p-3">
              <p class="text-xs text-gray-500">${escapeHtml(meta.fieldALabel)}</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.fieldA)}</p>
            </article>
            <article class="rounded-lg bg-slate-50 p-3">
              <p class="text-xs text-gray-500">${escapeHtml(meta.fieldBLabel)}</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.fieldB)}</p>
            </article>
            <article class="rounded-lg bg-slate-50 p-3">
              <p class="text-xs text-gray-500">${escapeHtml(meta.fieldCLabel)}</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.fieldC)}</p>
            </article>
            <article class="rounded-lg bg-slate-50 p-3">
              <p class="text-xs text-gray-500">主材表达</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.materialSummary)}</p>
            </article>
            <article class="rounded-lg bg-slate-50 p-3">
              <p class="text-xs text-gray-500">关键规格</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.specSummary)}</p>
            </article>
            <article class="rounded-lg bg-slate-50 p-3">
              <p class="text-xs text-gray-500">计量单位</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.unit)}</p>
            </article>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-sm font-medium">适用品类</p>
              <div class="mt-2">${renderTagPills(record.applicableCategories)}</div>
            </div>
            <div>
              <p class="text-sm font-medium">工艺 / 风格标签</p>
              <div class="mt-2">${renderTagPills(record.processTags)}</div>
            </div>
          </div>

          <div class="rounded-lg border border-dashed p-3 text-sm text-gray-600">
            <p class="font-medium">适用范围</p>
            <p class="mt-1">${escapeHtml(record.useScope)}</p>
            <p class="mt-3 font-medium">备注</p>
            <p class="mt-1">${escapeHtml(record.notes || '暂无备注')}</p>
          </div>
        </article>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold">主档变体</h2>
          <p class="text-xs text-gray-500">${record.variants.length} 条</p>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b bg-gray-50 text-left text-gray-500">
                <th class="px-3 py-2 font-medium">变体名称</th>
                <th class="px-3 py-2 font-medium">表达值</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              ${record.variants.length === 0 ? `
                <tr><td colspan="3" class="px-3 py-8 text-center text-sm text-gray-500">暂无变体表达</td></tr>
              ` : record.variants.map((variant) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3">${escapeHtml(variant.name)}</td>
                  <td class="px-3 py-3">${escapeHtml(variant.value)}</td>
                  <td class="px-3 py-3 text-gray-500">${escapeHtml(variant.note || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold">引用关系</h2>
          <p class="text-xs text-gray-500">${record.references.length} 个款式引用</p>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b bg-gray-50 text-left text-gray-500">
                <th class="px-3 py-2 font-medium">款式编码</th>
                <th class="px-3 py-2 font-medium">款式名称</th>
                <th class="px-3 py-2 font-medium">阶段</th>
                <th class="px-3 py-2 font-medium">使用位置</th>
                <th class="px-3 py-2 font-medium">最近更新时间</th>
              </tr>
            </thead>
            <tbody>
              ${record.references.length === 0 ? `
                <tr><td colspan="5" class="px-3 py-8 text-center text-sm text-gray-500">当前暂无引用款式</td></tr>
              ` : record.references.map((reference) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3 font-medium">${escapeHtml(reference.styleCode)}</td>
                  <td class="px-3 py-3">${escapeHtml(reference.styleName)}</td>
                  <td class="px-3 py-3">${escapeHtml(reference.phase)}</td>
                  <td class="px-3 py-3">${escapeHtml(reference.usage)}</td>
                  <td class="px-3 py-3 text-gray-500">${escapeHtml(reference.updatedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold">操作日志</h2>
          <p class="text-xs text-gray-500">${record.logs.length} 条</p>
        </div>
        <div class="mt-4 space-y-3">
          ${record.logs.map((log) => `
            <article class="rounded-lg border bg-slate-50 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium">${escapeHtml(log.action)}</p>
                <p class="text-xs text-gray-500">${escapeHtml(log.time)} ｜ ${escapeHtml(log.operator)}</p>
              </div>
              <p class="mt-2 text-sm text-gray-600">${escapeHtml(log.detail)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    </div>
  `
}

function syncEditorState(kind: MaterialArchiveKind, recordId?: string): MaterialArchiveRecord | null {
  const contextKey = `${kind}:${recordId || 'new'}`
  if (state.editorContextKey === contextKey) {
    return recordId ? getMaterialArchiveRecord(kind, recordId) : null
  }

  state.editorContextKey = contextKey
  state.editorKind = kind
  state.editorMode = recordId ? 'edit' : 'create'
  state.editorRecordId = recordId || null

  const record = recordId ? getMaterialArchiveRecord(kind, recordId) : null
  state.editorForm = record ? mapRecordToEditorForm(record) : createEmptyEditorForm(kind)
  return record
}

function renderMaterialArchiveEditorPage(kind: MaterialArchiveKind, recordId?: string): string {
  const meta = MATERIAL_ARCHIVE_META[kind]
  const record = syncEditorState(kind, recordId)
  const isEdit = Boolean(recordId)
  const form = state.editorForm

  if (isEdit && !record) {
    return `
      <div class="space-y-4">
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-material-archive-action="go-list" data-kind="${kind}">
          返回${escapeHtml(meta.label)}
        </button>
        <section class="rounded-lg border border-dashed bg-white px-6 py-16 text-center text-sm text-gray-500">未找到待编辑的${escapeHtml(meta.singular)}主档</section>
      </div>
    `
  }

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-gray-500">${escapeHtml(meta.breadcrumb)} / ${isEdit ? '编辑' : '新建'}</p>
          <h1 class="mt-2 text-2xl font-semibold">${isEdit ? `编辑${escapeHtml(meta.singular)}档案` : `新建${escapeHtml(meta.singular)}档案`}</h1>
          <p class="mt-1 text-sm text-gray-500">${isEdit ? '修改主档表达、规格信息与适用范围。' : '建立可复用主档，不录入供应商、价格和库存。'}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-material-archive-action="${isEdit ? 'go-detail' : 'go-list'}" data-kind="${kind}" ${isEdit ? `data-record-id="${recordId}"` : ''}>
            ${isEdit ? '返回详情' : `返回${escapeHtml(meta.label)}`}
          </button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50" data-material-archive-action="save-draft" data-kind="${kind}">
            保存草稿
          </button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700" data-material-archive-action="save-record" data-kind="${kind}">
            ${isEdit ? '保存修改' : '创建档案'}
          </button>
        </div>
      </header>

      ${renderArchiveNotice(kind)}

      <section class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-4">
          <article class="rounded-lg border bg-white p-4">
            <h2 class="text-base font-semibold">基础识别</h2>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              ${renderLabeledInput('档案编码', { value: form.archiveCode, placeholder: buildArchiveCode(kind), prefix: 'materialArchive', field: 'archiveCode' }, true)}
              ${renderLabeledInput('档案名称', { value: form.name, placeholder: `请输入${meta.singular}名称`, prefix: 'materialArchive', field: 'name' }, true)}
              ${renderLabeledInput('别名 / 英文名', { value: form.alias, placeholder: '可选', prefix: 'materialArchive', field: 'alias' })}
              ${renderLabeledSelect('分类', {
                value: form.subCategory,
                options: meta.categoryOptions.map((option) => ({ value: option, label: option })),
                prefix: 'materialArchive',
                field: 'subCategory',
              }, true)}
              ${renderLabeledInput('主材表达', { value: form.materialSummary, placeholder: '如：100%涤纶 / 提花雪纺', prefix: 'materialArchive', field: 'materialSummary' }, true)}
              ${renderLabeledInput('关键规格', { value: form.specSummary, placeholder: '如：145cm / 92g / 无弹', prefix: 'materialArchive', field: 'specSummary' }, true)}
            </div>
          </article>

          <article class="rounded-lg border bg-white p-4">
            <h2 class="text-base font-semibold">规格表达</h2>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              ${renderLabeledInput(meta.fieldALabel, { value: form.fieldA, placeholder: meta.fieldAPlaceholder, prefix: 'materialArchive', field: 'fieldA' }, true)}
              ${renderLabeledInput(meta.fieldBLabel, { value: form.fieldB, placeholder: meta.fieldBPlaceholder, prefix: 'materialArchive', field: 'fieldB' }, true)}
              ${renderLabeledInput(meta.fieldCLabel, { value: form.fieldC, placeholder: meta.fieldCPlaceholder, prefix: 'materialArchive', field: 'fieldC' })}
              ${renderLabeledSelect('计量单位', {
                value: form.unit,
                options: meta.unitOptions.map((option) => ({ value: option, label: option })),
                prefix: 'materialArchive',
                field: 'unit',
              }, true)}
            </div>
          </article>

          <article class="rounded-lg border bg-white p-4">
            <h2 class="text-base font-semibold">适用范围</h2>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              ${renderLabeledInput('适用范围', { value: form.useScope, placeholder: '如：连衣裙、上衣、长裙', prefix: 'materialArchive', field: 'useScope' }, true)}
              ${renderLabeledInput('适用品类', { value: form.applicableCategories, placeholder: '多个值请用中文逗号分隔', prefix: 'materialArchive', field: 'applicableCategories' }, true)}
              ${renderLabeledInput('工艺 / 风格标签', { value: form.processTags, placeholder: '多个值请用中文逗号分隔', prefix: 'materialArchive', field: 'processTags' })}
              ${renderLabeledInput('图片地址', { value: form.imageUrl, placeholder: '请输入图片 URL', prefix: 'materialArchive', field: 'imageUrl' })}
            </div>
            <div class="mt-4">
              ${renderLabeledTextarea('主档摘要', { value: form.summary, placeholder: '描述主档定位和主要使用方向', rows: 3, prefix: 'materialArchive', field: 'summary' }, true)}
            </div>
            <div class="mt-4">
              ${renderLabeledTextarea('补充备注', { value: form.notes, placeholder: '填写迁移说明、限制条件或引用提示', rows: 3, prefix: 'materialArchive', field: 'notes' })}
            </div>
          </article>
        </div>

        <aside class="space-y-4">
          <article class="rounded-lg border bg-white p-4">
            <h2 class="text-base font-semibold">治理信息</h2>
            <div class="mt-4 space-y-4">
              ${renderLabeledSelect('来源', {
                value: form.source,
                options: SOURCE_OPTIONS.map((option) => ({ value: option, label: option })),
                prefix: 'materialArchive',
                field: 'source',
              }, true)}
              ${renderLabeledSelect('治理状态', {
                value: form.status,
                options: [
                  { value: 'ACTIVE', label: '启用' },
                  { value: 'DRAFT', label: '草稿' },
                  { value: 'INACTIVE', label: '停用' },
                ],
                prefix: 'materialArchive',
                field: 'status',
              }, true)}
              ${renderLabeledInput('治理负责人', { value: form.governanceOwner, placeholder: '输入负责人', prefix: 'materialArchive', field: 'governanceOwner' }, true)}
            </div>
          </article>

          <article class="rounded-lg border bg-white p-4">
            <h2 class="text-base font-semibold">图片预览</h2>
            <img src="${escapeHtml(form.imageUrl || '/placeholder.svg')}" alt="${escapeHtml(form.name || meta.singular)}" class="mt-4 h-56 w-full rounded-md border object-cover bg-gray-50" />
            <p class="mt-3 text-xs text-gray-500">用于列表缩略图和详情主图。若暂未准备图片，可先保留占位图。</p>
          </article>
        </aside>
      </section>
    </div>
  `
}

function buildDraftFromEditor(kind: MaterialArchiveKind, forceDraftStatus: boolean): MaterialArchiveDraft {
  const meta = MATERIAL_ARCHIVE_META[kind]
  return {
    archiveCode: state.editorForm.archiveCode.trim() || buildArchiveCode(kind),
    name: state.editorForm.name.trim() || `未命名${meta.singular}`,
    alias: state.editorForm.alias.trim(),
    subCategory: state.editorForm.subCategory.trim() || meta.categoryOptions[0],
    materialSummary: state.editorForm.materialSummary.trim() || state.editorForm.fieldA.trim() || '待补充',
    specSummary: state.editorForm.specSummary.trim() || state.editorForm.fieldB.trim() || '待补充',
    fieldA: state.editorForm.fieldA.trim(),
    fieldB: state.editorForm.fieldB.trim(),
    fieldC: state.editorForm.fieldC.trim(),
    unit: state.editorForm.unit,
    useScope: state.editorForm.useScope.trim() || '待补充适用范围',
    applicableCategories: normalizeMultiValueInput(state.editorForm.applicableCategories),
    processTags: normalizeMultiValueInput(state.editorForm.processTags),
    source: state.editorForm.source,
    status: forceDraftStatus ? 'DRAFT' : state.editorForm.status,
    governanceOwner: state.editorForm.governanceOwner.trim() || `${meta.singular}治理组`,
    imageUrl: state.editorForm.imageUrl.trim() || '/placeholder.svg',
    summary: state.editorForm.summary.trim() || `${meta.singular}主档待补充摘要`,
    notes: state.editorForm.notes.trim(),
  }
}

function saveEditorRecord(forceDraftStatus: boolean): MaterialArchiveRecord {
  const kind = state.editorKind
  const draft = buildDraftFromEditor(kind, forceDraftStatus)

  if (state.editorMode === 'edit' && state.editorRecordId) {
    const updated = updateMaterialArchiveRecord(kind, state.editorRecordId, draft)
    if (updated) return updated
  }

  return createMaterialArchiveRecord(kind, draft)
}

export function handleMaterialArchiveEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-material-archive-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.materialArchiveAction
  const kind = actionNode.dataset.kind as MaterialArchiveKind | undefined
  const recordId = actionNode.dataset.recordId

  switch (action) {
    case 'go-create':
      if (kind) appStore.navigate(`/pcs/materials/${kind}/new`)
      return true
    case 'go-list':
      if (kind) appStore.navigate(`/pcs/materials/${kind}`)
      return true
    case 'go-detail':
      if (kind && recordId) appStore.navigate(`/pcs/materials/${kind}/${recordId}`)
      return true
    case 'go-edit':
      if (kind && recordId) appStore.navigate(`/pcs/materials/${kind}/${recordId}/edit`)
      return true
    case 'reset-filters':
      if (kind) state.listFilters[kind] = { search: '', status: 'all', category: 'all' }
      return true
    case 'save-draft': {
      const saved = saveEditorRecord(true)
      state.editorContextKey = ''
      appStore.navigate(`/pcs/materials/${saved.kind}/${saved.id}`)
      return true
    }
    case 'save-record': {
      const saved = saveEditorRecord(false)
      state.editorContextKey = ''
      appStore.navigate(`/pcs/materials/${saved.kind}/${saved.id}`)
      return true
    }
    default:
      return false
  }
}

export function handleMaterialArchiveInput(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-material-archive-filter]')
  if (filterNode) {
    const filter = filterNode.dataset.materialArchiveFilter
    const kind = filterNode.dataset.kind as MaterialArchiveKind | undefined
    const value = (filterNode as HTMLInputElement | HTMLSelectElement).value
    if (!kind) return false

    switch (filter) {
      case 'search':
        state.listFilters[kind].search = value
        return true
      case 'status':
        state.listFilters[kind].status = value as MaterialListFilterState['status']
        return true
      case 'category':
        state.listFilters[kind].category = value
        return true
      default:
        break
    }
  }

  const fieldNode = target.closest<HTMLElement>('[data-material-archive-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.materialArchiveField as keyof MaterialArchiveEditorForm | undefined
    const value = (fieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
    if (field && field in state.editorForm) {
      state.editorForm[field] = value as never
      return true
    }
  }

  return false
}

export function renderPcsMaterialArchiveListPage(kind: MaterialArchiveKind): string {
  return renderMaterialArchiveListPage(kind)
}

export function renderPcsMaterialArchiveDetailPage(kind: MaterialArchiveKind, recordId: string): string {
  return renderMaterialArchiveDetailPage(kind, recordId)
}

export function renderPcsMaterialArchiveEditorPage(kind: MaterialArchiveKind, recordId?: string): string {
  return renderMaterialArchiveEditorPage(kind, recordId)
}
