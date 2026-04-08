import { renderDrawer as uiDrawer } from '../components/ui'
import { escapeHtml, formatDateTime } from '../utils'
import {
  getPartTemplateRecordById,
  listPartTemplatePackages,
  listPartTemplateRecords,
  listSiblingPartTemplateRecords,
  recommendPartTemplateRecords,
  savePartTemplatePackage,
  updatePartTemplateRecord,
  type PartTemplateRecord,
  type PartTemplateRecommendation,
  type PartTemplateDraftSaveRow,
} from '../data/pcs-part-template-library'
import {
  PART_TEMPLATE_STANDARD_NAME_OPTIONS,
  parsePartTemplateFiles,
  resolveTemplateFilePair,
  suggestStandardPartName,
  type ParsedPartInstance,
  type ParsedPartTemplateResult,
} from '../utils/pcs-part-template-parser'

interface PartTemplateLibraryState {
  search: string
  standardPartFilter: string
  sizeFilter: string
  parserStatusFilter: string
  machineReadyFilter: string
  createDrawerOpen: boolean
  detailDrawerOpen: boolean
  detailRecordId: string | null
  detailStandardPartName: string
  templateName: string
  selectedDxfFile: File | null
  selectedRulFile: File | null
  uploadError: string | null
  parseError: string | null
  parsing: boolean
  parseResult: ParsedPartTemplateResult | null
  draftStandardNames: Record<string, string>
  notice: string | null
}

const state: PartTemplateLibraryState = {
  search: '',
  standardPartFilter: '全部',
  sizeFilter: '全部',
  parserStatusFilter: '全部',
  machineReadyFilter: '全部',
  createDrawerOpen: false,
  detailDrawerOpen: false,
  detailRecordId: null,
  detailStandardPartName: '',
  templateName: '',
  selectedDxfFile: null,
  selectedRulFile: null,
  uploadError: null,
  parseError: null,
  parsing: false,
  parseResult: null,
  draftStandardNames: {},
  notice: null,
}

const APP_RENDER_EVENT = 'higood:request-render'
let currentParseRequestId = 0

function requestRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_RENDER_EVENT))
  }
}

function getPartDraftKey(part: ParsedPartInstance): string {
  return `${part.sourceBlockIndex}-${part.sourceBlockName}`
}

function resetCreateDrawerState(): void {
  currentParseRequestId += 1
  state.templateName = ''
  state.selectedDxfFile = null
  state.selectedRulFile = null
  state.uploadError = null
  state.parseError = null
  state.parsing = false
  state.parseResult = null
  state.draftStandardNames = {}
}

function getFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName)
  return match ? match[1].toLowerCase() : ''
}

function getSelectedTemplateFiles(): File[] {
  return [state.selectedDxfFile, state.selectedRulFile].filter((file): file is File => file instanceof File)
}

function getSingleUploadError(file: File | null, expectedExtension: 'dxf' | 'rul', label: string): string | null {
  if (!file) return null
  if (getFileExtension(file.name) !== expectedExtension) {
    return `${label}必须上传 .${expectedExtension} 文件。`
  }
  return null
}

function getCreateUploadError(): string | null {
  return (
    getSingleUploadError(state.selectedDxfFile, 'dxf', 'DXF 文件') ??
    getSingleUploadError(state.selectedRulFile, 'rul', 'RUL 文件')
  )
}

function getParserBadgeClass(status: PartTemplateRecord['parserStatus'] | ParsedPartInstance['parserStatus']): string {
  if (status === '解析成功') return 'bg-emerald-100 text-emerald-700'
  if (status === '待人工矫正') return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

function getMachineBadgeClass(status: PartTemplateRecord['machineReadyStatus'] | ParsedPartInstance['machineReadyStatus']): string {
  if (status === '可模板机处理') return 'bg-blue-100 text-blue-700'
  if (status === '待评估') return 'bg-slate-100 text-slate-700'
  return 'bg-gray-100 text-gray-600'
}

function formatMetric(value?: number, suffix = ''): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  return `${value}${suffix}`
}

function renderCandidateTags(values: string[]): string {
  if (values.length === 0) return '<span class="text-xs text-gray-400">未识别</span>'
  return values
    .slice(0, 4)
    .map(
      (value) =>
        `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(
          value,
        )}</span>`,
    )
    .join('')
}

function getRecords() {
  return listPartTemplateRecords()
}

function getFilteredRecords(): PartTemplateRecord[] {
  const keyword = state.search.trim().toLowerCase()

  return getRecords().filter((record) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [
        record.templateName,
        record.standardPartName,
        record.sourcePartName,
        record.systemPieceName ?? '',
        record.sourceDxfFileName,
        ...record.candidatePartNames,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    const matchesStandard =
      state.standardPartFilter === '全部' || record.standardPartName === state.standardPartFilter
    const matchesSize = state.sizeFilter === '全部' || (record.sizeCode ?? '-') === state.sizeFilter
    const matchesParser =
      state.parserStatusFilter === '全部' || record.parserStatus === state.parserStatusFilter
    const matchesMachine =
      state.machineReadyFilter === '全部' || record.machineReadyStatus === state.machineReadyFilter

    return matchesKeyword && matchesStandard && matchesSize && matchesParser && matchesMachine
  })
}

function getFilterOptions(records: PartTemplateRecord[]) {
  const standardParts = Array.from(new Set(records.map((record) => record.standardPartName).filter(Boolean)))
  const sizes = Array.from(new Set(records.map((record) => record.sizeCode ?? '-')))

  return {
    standardParts,
    sizes,
  }
}

function getKpis(records: PartTemplateRecord[]) {
  const now = Date.now()
  const recentHitCount = records.reduce((sum, record) => {
    if (!record.lastMatchedAt) return sum
    const deltaDays = (now - new Date(record.lastMatchedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (deltaDays <= 30) {
      return sum + Math.max(1, Math.round(record.reuseHitCount * 0.4))
    }
    return sum
  }, 0)

  return {
    total: records.length,
    machineReady: records.filter((record) => record.machineReadyStatus === '可模板机处理').length,
    manualCorrection: records.filter((record) => record.parserStatus === '待人工矫正').length,
    recentHitCount,
    hotTemplateCount: records.filter((record) => record.hotStyleCount > 0).length,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="h-8 rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-100" data-part-template-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(records: PartTemplateRecord[]): string {
  const kpis = getKpis(records)

  return `
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">部位模板库</h1>
          <p class="mt-1 text-sm text-gray-500">上传一对纸样包后，系统按部位拆成多条模板记录沉淀，用于后续制版任务的模板推荐与人工复核。</p>
        </div>
        <button class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-part-template-action="open-create-drawer">
          <i data-lucide="plus" class="h-4 w-4"></i>
          新增模板
        </button>
      </div>
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">部位模板总数</p>
          <p class="mt-2 text-2xl font-semibold">${kpis.total}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">可直接机做部位数</p>
          <p class="mt-2 text-2xl font-semibold text-blue-700">${kpis.machineReady}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">待人工矫正数</p>
          <p class="mt-2 text-2xl font-semibold text-amber-700">${kpis.manualCorrection}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">近 30 天命中次数</p>
          <p class="mt-2 text-2xl font-semibold text-emerald-700">${kpis.recentHitCount}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">爆款模板数</p>
          <p class="mt-2 text-2xl font-semibold text-rose-700">${kpis.hotTemplateCount}</p>
        </article>
      </section>
    </header>
  `
}

function renderFilters(records: PartTemplateRecord[]): string {
  const options = getFilterOptions(records)

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_180px_180px_180px_auto]">
        <div>
          <label class="mb-1 block text-xs text-gray-500">搜索</label>
          <input
            class="h-9 w-full rounded-md border px-3 text-sm"
            placeholder="模板名称 / 标准部位 / 原始部位 / 候选名称"
            value="${escapeHtml(state.search)}"
            data-part-template-field="search"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">标准部位</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-part-template-field="standardPartFilter">
            <option value="全部">全部</option>
            ${options.standardParts
              .map(
                (value) =>
                  `<option value="${escapeHtml(value)}" ${state.standardPartFilter === value ? 'selected' : ''}>${escapeHtml(
                    value,
                  )}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">尺码</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-part-template-field="sizeFilter">
            <option value="全部">全部</option>
            ${options.sizes
              .map(
                (value) =>
                  `<option value="${escapeHtml(value)}" ${state.sizeFilter === value ? 'selected' : ''}>${escapeHtml(
                    value,
                  )}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">解析状态</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-part-template-field="parserStatusFilter">
            ${['全部', '解析成功', '待人工矫正', '解析异常']
              .map(
                (value) =>
                  `<option value="${value}" ${state.parserStatusFilter === value ? 'selected' : ''}>${value}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">模板机适配状态</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-part-template-field="machineReadyFilter">
            ${['全部', '可模板机处理', '待评估', '不适用']
              .map(
                (value) =>
                  `<option value="${value}" ${state.machineReadyFilter === value ? 'selected' : ''}>${value}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="flex items-end justify-end">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-part-template-action="reset-filters">重置筛选</button>
        </div>
      </div>
    </section>
  `
}

function renderRecordRows(records: PartTemplateRecord[]): string {
  if (records.length === 0) {
    return `
      <tr>
        <td colspan="11" class="px-4 py-16 text-center text-sm text-gray-500">
          <i data-lucide="folder-search-2" class="mx-auto h-10 w-10 text-gray-300"></i>
          <p class="mt-3">当前还没有部位模板记录</p>
          <p class="mt-1 text-xs text-gray-400">上传一对 .dxf + .rul 后，系统会按部位拆分成多条记录进入主表。</p>
        </td>
      </tr>
    `
  }

  return records
    .map((record) => {
      const recommendationPreview = recommendPartTemplateRecords(
        {
          sourceBlockIndex: 0,
          sourceBlockName: record.templateName,
          sourcePartName: record.sourcePartName,
          systemPieceName: record.systemPieceName,
          candidatePartNames: record.candidatePartNames,
          sizeCode: record.sizeCode,
          annotation: record.annotation,
          quantity: record.quantity,
          category: record.category,
          outerBoundary: undefined,
          innerBoundary: undefined,
          grainLines: [],
          pointLayerStats: {},
          metrics:
            record.width !== undefined &&
            record.height !== undefined &&
            record.area !== undefined &&
            record.perimeter !== undefined
              ? {
                  width: record.width,
                  height: record.height,
                  area: record.area,
                  perimeter: record.perimeter,
                }
              : undefined,
          geometryHash: record.geometryHash,
          previewSvg: record.previewSvg,
          parserStatus: record.parserStatus,
          machineReadyStatus: record.machineReadyStatus,
          issues: [],
          rawTextLabels: [],
          insertRefs: [],
        },
        1,
      )[0]

      return `
        <tr class="border-b last:border-b-0 hover:bg-gray-50">
          <td class="px-3 py-3 align-top">
            <div>
              <p class="font-medium">${escapeHtml(record.templateName)}</p>
              <p class="mt-1 text-xs text-gray-500">包号：${escapeHtml(record.templatePackageId)}</p>
            </div>
          </td>
          <td class="px-3 py-3 align-top">
            <div class="space-y-1">
              <p class="font-medium text-slate-900">${escapeHtml(record.standardPartName || '待补充')}</p>
              <p class="text-xs text-gray-500">${escapeHtml(record.systemPieceName ?? '未识别系统 Piece Name')}</p>
            </div>
          </td>
          <td class="px-3 py-3 align-top">
            <p class="text-sm">${escapeHtml(record.sourcePartName)}</p>
          </td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">${renderCandidateTags(record.candidatePartNames)}</div>
          </td>
          <td class="px-3 py-3 align-top text-sm">${escapeHtml(record.sizeCode ?? '-')}</td>
          <td class="px-3 py-3 align-top text-sm text-gray-600">
            <p>${formatMetric(record.width)} x ${formatMetric(record.height)}</p>
            <p class="mt-1 text-xs text-gray-500">面积 ${formatMetric(record.area)} / 周长 ${formatMetric(record.perimeter)}</p>
          </td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getParserBadgeClass(record.parserStatus)}">${record.parserStatus}</span>
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getMachineBadgeClass(record.machineReadyStatus)}">${record.machineReadyStatus}</span>
            </div>
          </td>
          <td class="px-3 py-3 align-top text-sm text-gray-600">
            <p>命中 ${record.reuseHitCount}</p>
            <p class="mt-1 text-xs text-gray-500">爆款 ${record.hotStyleCount} / 下单 ${record.cumulativeOrderQty}</p>
          </td>
          <td class="px-3 py-3 align-top text-sm text-gray-600">
            <p>${formatDateTime(record.updatedAt)}</p>
            <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.lastMatchedAt ? `最近命中 ${formatDateTime(record.lastMatchedAt)}` : '暂无命中记录')}</p>
          </td>
          <td class="px-3 py-3 align-top text-xs text-gray-500">
            ${recommendationPreview ? escapeHtml(`推荐参考分 ${recommendationPreview.matchScore}`) : '-'}
          </td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-2">
              <button class="h-8 rounded-md border px-3 text-xs hover:bg-gray-50" data-part-template-action="open-detail" data-record-id="${escapeHtml(record.id)}">详情</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(records: PartTemplateRecord[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1500px] text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-600">
              <th class="px-3 py-3 font-medium">模板名称</th>
              <th class="px-3 py-3 font-medium">标准部位名</th>
              <th class="px-3 py-3 font-medium">原始部位名</th>
              <th class="px-3 py-3 font-medium">候选名称</th>
              <th class="px-3 py-3 font-medium">尺码</th>
              <th class="px-3 py-3 font-medium">尺寸</th>
              <th class="px-3 py-3 font-medium">状态</th>
              <th class="px-3 py-3 font-medium">历史统计</th>
              <th class="px-3 py-3 font-medium">更新时间</th>
              <th class="px-3 py-3 font-medium">推荐参考</th>
              <th class="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRecordRows(records)}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderParsedSummary(result: ParsedPartTemplateResult): string {
  return `
    <section class="rounded-lg border bg-slate-50 p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p class="text-xs text-gray-500">模板包名称</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(result.templateName)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">单位 / 基码</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(result.rul.units ?? '-')} / ${escapeHtml(result.rul.sampleSize ?? '-')}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">尺码列表</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(result.rul.sizeList.join(', ') || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">部位实例数</p>
          <p class="mt-1 text-sm font-medium">${result.parts.length}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">DXF 文件</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(result.dxfFileName)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">RUL 文件</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(result.rulFileName)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">解码方式</p>
          <p class="mt-1 text-sm font-medium">DXF: ${escapeHtml(result.dxfEncoding)} / RUL: ${escapeHtml(result.rulEncoding)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">放码规则</p>
          <p class="mt-1 text-sm font-medium">${result.rul.deltaRules.length} 条 DELTA 规则</p>
        </div>
      </div>
    </section>
  `
}

function renderPartDraftCards(result: ParsedPartTemplateResult): string {
  return result.parts
    .map((part) => {
      const partKey = getPartDraftKey(part)
      const standardName = state.draftStandardNames[partKey] ?? suggestStandardPartName(part)

      return `
        <article class="rounded-lg border bg-white p-4">
          <div class="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div class="overflow-hidden rounded-lg border bg-slate-50 p-3">
              <div class="aspect-[11/8]">${part.previewSvg ?? '<div class="flex h-full items-center justify-center text-xs text-gray-400">暂无预览</div>'}</div>
            </div>
            <div class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold">${escapeHtml(part.sourcePartName)}</h3>
                  <p class="mt-1 text-xs text-gray-500">Piece Name：${escapeHtml(part.systemPieceName ?? '未识别')}</p>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getParserBadgeClass(part.parserStatus)}">${part.parserStatus}</span>
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getMachineBadgeClass(part.machineReadyStatus)}">${part.machineReadyStatus}</span>
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <p class="mb-1 text-xs text-gray-500">候选名称</p>
                  <div class="flex flex-wrap gap-1">${renderCandidateTags(part.candidatePartNames)}</div>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-gray-500">人工矫正部位名称</label>
                  <input
                    class="h-9 w-full rounded-md border px-3 text-sm"
                    list="pcs-standard-part-name-options"
                    value="${escapeHtml(standardName)}"
                    data-part-template-field="draft-standard-name"
                    data-part-key="${escapeHtml(partKey)}"
                  />
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p class="text-xs text-gray-500">尺码</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(part.sizeCode ?? '-')}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">数量</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(part.quantity ?? '-')}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">注释</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(part.annotation ?? '-')}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">分类</p>
                  <p class="mt-1 text-sm font-medium">${escapeHtml(part.category ?? '-')}</p>
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p class="text-xs text-gray-500">宽</p>
                  <p class="mt-1 text-sm font-medium">${formatMetric(part.metrics?.width)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">高</p>
                  <p class="mt-1 text-sm font-medium">${formatMetric(part.metrics?.height)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">面积</p>
                  <p class="mt-1 text-sm font-medium">${formatMetric(part.metrics?.area)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">周长</p>
                  <p class="mt-1 text-sm font-medium">${formatMetric(part.metrics?.perimeter)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">geometryHash</p>
                  <p class="mt-1 break-all text-sm font-medium">${escapeHtml(part.geometryHash ?? '-')}</p>
                </div>
              </div>

              ${
                part.issues.length > 0
                  ? `
                    <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                      ${part.issues.map((issue) => `<p>${escapeHtml(issue)}</p>`).join('')}
                    </div>
                  `
                  : ''
              }

              <div class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-500">
                保存后将写入部位模板库 1 条记录。本次模板包预计新增 ${result.parts.length} 条部位模板记录。
              </div>
            </div>
          </div>
        </article>
      `
    })
    .join('')
}

function renderFileStatus(): string {
  const message =
    state.uploadError ??
    `DXF：${state.selectedDxfFile?.name ?? '未上传'}；RUL：${state.selectedRulFile?.name ?? '未上传'}`
  const toneClass = state.uploadError ? 'text-rose-600' : 'text-gray-500'

  return `<p class="text-xs ${toneClass}">${escapeHtml(message)}</p>`
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''

  const parsedCount = state.parseResult?.parts.length ?? 0
  const canSave = !!state.parseResult && !state.parsing && state.parseResult.parts.length > 0

  const content = `
    <div class="space-y-6">
      <section class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-900">模板名称 <span class="text-rose-500">*</span></label>
          <input
            class="h-10 w-full rounded-md border px-3 text-sm"
            placeholder="例如：领子模板"
            value="${escapeHtml(state.templateName)}"
            data-part-template-field="templateName"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-900">上传纸样包 <span class="text-rose-500">*</span></label>
          <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-lg border bg-white p-3">
                <label class="mb-2 block text-sm font-medium text-gray-900">DXF 文件</label>
                <input
                  type="file"
                  class="w-full text-sm"
                  accept=".dxf"
                  data-part-template-action="select-dxf-file"
                />
                <p class="mt-2 text-xs text-gray-500">${escapeHtml(state.selectedDxfFile?.name ?? '未上传 DXF 文件')}</p>
              </div>
              <div class="rounded-lg border bg-white p-3">
                <label class="mb-2 block text-sm font-medium text-gray-900">RUL 文件</label>
                <input
                  type="file"
                  class="w-full text-sm"
                  accept=".rul"
                  data-part-template-action="select-rul-file"
                />
                <p class="mt-2 text-xs text-gray-500">${escapeHtml(state.selectedRulFile?.name ?? '未上传 RUL 文件')}</p>
              </div>
            </div>
            <div class="mt-3 space-y-2">
              ${renderFileStatus()}
              <p class="text-xs text-gray-400">严格校验：必须同时上传 1 份 DXF 和 1 份 RUL；重复选择会覆盖当前文件。</p>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="h-9 rounded-md border px-3 text-sm hover:bg-white ${state.parsing ? 'cursor-not-allowed opacity-60' : ''}" data-part-template-action="parse-template" ${state.parsing ? 'disabled' : ''}>${state.parsing ? '解析中...' : '解析模板'}</button>
              <button class="h-9 rounded-md border px-3 text-sm hover:bg-white" data-part-template-action="clear-files">清空已上传文件</button>
            </div>
            ${state.parseError ? `<p class="mt-3 text-sm text-rose-600">${escapeHtml(state.parseError)}</p>` : ''}
          </div>
        </div>
      </section>

      ${
        state.parseResult
          ? `
            ${renderParsedSummary(state.parseResult)}
            <section class="space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-base font-semibold">部位卡片</h3>
                  <p class="mt-1 text-xs text-gray-500">每张卡片保存后都会生成 1 条独立的部位模板记录。</p>
                </div>
                <div class="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">保存后预计新增 ${parsedCount} 条记录</div>
              </div>
              <div class="space-y-3">${renderPartDraftCards(state.parseResult)}</div>
            </section>
          `
          : ''
      }
    </div>
  `

  return uiDrawer(
    {
      title: '新增部位模板',
      subtitle: '上传一对纸样包，系统会按部位拆分并入库。',
      closeAction: { prefix: 'part-template', action: 'close-create-drawer' },
      width: 'xl',
    },
    content,
    {
      cancel: { prefix: 'part-template', action: 'close-create-drawer', label: '取消' },
      confirm: {
        prefix: 'part-template',
        action: 'save-template',
        label: canSave ? `保存并写入 ${parsedCount} 条部位模板` : '等待解析完成',
        variant: 'primary',
        disabled: !canSave,
      },
    },
  )
}

function renderDetailRecommendations(record: PartTemplateRecord): string {
  const matches = recommendPartTemplateRecords(
    {
      sourceBlockIndex: 0,
      sourceBlockName: record.templateName,
      sourcePartName: record.sourcePartName,
      systemPieceName: record.systemPieceName,
      candidatePartNames: record.candidatePartNames,
      sizeCode: record.sizeCode,
      annotation: record.annotation,
      quantity: record.quantity,
      category: record.category,
      outerBoundary: undefined,
      innerBoundary: undefined,
      grainLines: [],
      pointLayerStats: {},
      metrics:
        record.width !== undefined &&
        record.height !== undefined &&
        record.area !== undefined &&
        record.perimeter !== undefined
          ? {
              width: record.width,
              height: record.height,
              area: record.area,
              perimeter: record.perimeter,
            }
          : undefined,
      geometryHash: record.geometryHash,
      previewSvg: record.previewSvg,
      parserStatus: record.parserStatus,
      machineReadyStatus: record.machineReadyStatus,
      issues: [],
      rawTextLabels: [],
      insertRefs: [],
    },
    3,
  ).filter((item) => item.record.id !== record.id)

  if (matches.length === 0) {
    return '<p class="text-sm text-gray-500">当前模板库中暂无其他可对比模板。</p>'
  }

  return matches
    .map(
      (match) => `
        <article class="rounded-lg border bg-slate-50 p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium">${escapeHtml(match.record.templateName)} / ${escapeHtml(match.record.standardPartName)}</p>
              <p class="mt-1 text-xs text-gray-500">${escapeHtml(match.record.sourcePartName)} · 尺码 ${escapeHtml(match.record.sizeCode ?? '-')}</p>
            </div>
            <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${match.matchScore} 分</span>
          </div>
          <div class="mt-2 space-y-1 text-xs text-gray-600">
            ${match.reasons.slice(0, 3).map((reason) => `<p>${escapeHtml(reason)}</p>`).join('')}
          </div>
        </article>
      `,
    )
    .join('')
}

function renderDetailDrawer(): string {
  if (!state.detailDrawerOpen || !state.detailRecordId) return ''

  const record = getPartTemplateRecordById(state.detailRecordId)
  if (!record) return ''

  const templatePackage = listPartTemplatePackages().find((item) => item.id === record.templatePackageId)
  const siblingRecords = listSiblingPartTemplateRecords(record.templatePackageId).filter((item) => item.id !== record.id)

  const content = `
    <div class="space-y-6">
      <section class="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div class="overflow-hidden rounded-lg border bg-slate-50 p-3">
          <div class="aspect-[11/8]">${record.previewSvg ?? '<div class="flex h-full items-center justify-center text-xs text-gray-400">暂无预览</div>'}</div>
        </div>
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getParserBadgeClass(record.parserStatus)}">${record.parserStatus}</span>
            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getMachineBadgeClass(record.machineReadyStatus)}">${record.machineReadyStatus}</span>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs text-gray-500">标准部位名</label>
              <input class="h-9 w-full rounded-md border px-3 text-sm" list="pcs-standard-part-name-options" value="${escapeHtml(state.detailStandardPartName)}" data-part-template-field="detail-standard-name" />
            </div>
            <div>
              <p class="mb-1 text-xs text-gray-500">原始部位名</p>
              <p class="text-sm font-medium">${escapeHtml(record.sourcePartName)}</p>
            </div>
            <div>
              <p class="mb-1 text-xs text-gray-500">Piece Name</p>
              <p class="text-sm font-medium">${escapeHtml(record.systemPieceName ?? '-')}</p>
            </div>
            <div>
              <p class="mb-1 text-xs text-gray-500">候选名称</p>
              <div class="flex flex-wrap gap-1">${renderCandidateTags(record.candidatePartNames)}</div>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p class="text-xs text-gray-500">尺码</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.sizeCode ?? '-')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">数量</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.quantity ?? '-')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">注释</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.annotation ?? '-')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">分类</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(record.category ?? '-')}</p>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p class="text-xs text-gray-500">宽</p>
              <p class="mt-1 text-sm font-medium">${formatMetric(record.width)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">高</p>
              <p class="mt-1 text-sm font-medium">${formatMetric(record.height)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">面积</p>
              <p class="mt-1 text-sm font-medium">${formatMetric(record.area)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">周长</p>
              <p class="mt-1 text-sm font-medium">${formatMetric(record.perimeter)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold">所属模板包信息</h3>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p class="text-xs text-gray-500">模板包名称</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(record.templateName)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">DXF 文件</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(record.sourceDxfFileName)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">RUL 文件</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(record.sourceRulFileName)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">解析时间</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(formatDateTime(record.parsedAt))}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">单位</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(templatePackage?.rulSummary.units ?? '-')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">基码</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(templatePackage?.rulSummary.sampleSize ?? '-')}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-xs text-gray-500">尺码列表</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(templatePackage?.rulSummary.sizeList.join(', ') || '-')}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold">历史复用统计</h3>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p class="text-xs text-gray-500">历史命中次数</p>
            <p class="mt-1 text-sm font-medium">${record.reuseHitCount}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">爆款命中次数</p>
            <p class="mt-1 text-sm font-medium">${record.hotStyleCount}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">累计下单量</p>
            <p class="mt-1 text-sm font-medium">${record.cumulativeOrderQty}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">最近一次命中</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(record.lastMatchedAt ? formatDateTime(record.lastMatchedAt) : '-')}</p>
          </div>
        </div>
        <div class="mt-3">
          <p class="text-xs text-gray-500">关联爆款样式</p>
          <div class="mt-2 flex flex-wrap gap-1">
            ${record.hotStyleNames.map((name) => `<span class="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">${escapeHtml(name)}</span>`).join('')}
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold">同模板包其他兄弟部位</h3>
        ${
          siblingRecords.length === 0
            ? '<p class="mt-3 text-sm text-gray-500">当前模板包下暂无其他兄弟部位记录。</p>'
            : `
              <div class="mt-3 space-y-2">
                ${siblingRecords
                  .map(
                    (item) => `
                      <div class="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2">
                        <div>
                          <p class="text-sm font-medium">${escapeHtml(item.standardPartName)}</p>
                          <p class="mt-1 text-xs text-gray-500">${escapeHtml(item.sourcePartName)} · 尺码 ${escapeHtml(item.sizeCode ?? '-')}</p>
                        </div>
                        <button class="h-8 rounded-md border px-3 text-xs hover:bg-white" data-part-template-action="open-detail" data-record-id="${escapeHtml(item.id)}">切换查看</button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
        }
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold">推荐参考</h3>
        <div class="mt-3 space-y-2">${renderDetailRecommendations(record)}</div>
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: '部位模板详情',
      subtitle: `${record.templateName} / ${record.standardPartName}`,
      closeAction: { prefix: 'part-template', action: 'close-detail-drawer' },
      width: 'xl',
    },
    content,
    {
      cancel: { prefix: 'part-template', action: 'close-detail-drawer', label: '关闭' },
      confirm: {
        prefix: 'part-template',
        action: 'save-detail-standard-name',
        label: '保存矫正结果',
        variant: 'primary',
        disabled: state.detailStandardPartName.trim().length === 0,
      },
    },
  )
}

function renderStandardNameDatalist(): string {
  return `
    <datalist id="pcs-standard-part-name-options">
      ${PART_TEMPLATE_STANDARD_NAME_OPTIONS.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('')}
    </datalist>
  `
}

function renderPage(): string {
  const records = getRecords()
  const filteredRecords = getFilteredRecords()

  return `
    <div class="space-y-4">
      ${renderHeader(records)}
      ${renderNotice()}
      ${renderFilters(records)}
      ${renderTable(filteredRecords)}
      ${renderStandardNameDatalist()}
    </div>
    ${renderCreateDrawer()}
    ${renderDetailDrawer()}
  `
}

function startParsingTemplate(): void {
  let resolvedFiles

  if (!state.templateName.trim()) {
    state.parseError = '模板名称不能为空。'
    return
  }

  try {
    resolvedFiles = resolveTemplateFilePair(getSelectedTemplateFiles())
  } catch (error) {
    state.parseError = error instanceof Error ? error.message : '文件校验失败。'
    return
  }

  if (!resolvedFiles) {
    state.parseError = '请先选择一对 .dxf + .rul 文件。'
    return
  }

  state.parsing = true
  state.parseError = null
  state.uploadError = null
  state.parseResult = null
  state.draftStandardNames = {}
  currentParseRequestId += 1
  const requestId = currentParseRequestId

  void parsePartTemplateFiles({
    templateName: state.templateName,
    dxfFile: resolvedFiles.dxfFile,
    rulFile: resolvedFiles.rulFile,
  })
    .then((result) => {
      if (requestId !== currentParseRequestId) return
      state.parseResult = result
      state.draftStandardNames = Object.fromEntries(
        result.parts.map((part) => [getPartDraftKey(part), suggestStandardPartName(part)]),
      )
      state.parseError = null
    })
    .catch((error) => {
      if (requestId !== currentParseRequestId) return
      state.parseResult = null
      state.draftStandardNames = {}
      state.parseError = error instanceof Error ? error.message : '解析失败，请检查文件内容。'
    })
    .finally(() => {
      if (requestId !== currentParseRequestId) return
      state.parsing = false
      requestRender()
    })
}

function saveParsedRows(): void {
  if (!state.parseResult) {
    state.parseError = '请先完成模板解析。'
    return
  }

  const rows: PartTemplateDraftSaveRow[] = state.parseResult.parts.map((part) => ({
    part,
    standardPartName: state.draftStandardNames[getPartDraftKey(part)] ?? suggestStandardPartName(part),
  }))

  const saved = savePartTemplatePackage({
    templateName: state.parseResult.templateName,
    sourceDxfFileName: state.parseResult.dxfFileName,
    sourceRulFileName: state.parseResult.rulFileName,
    rulSummary: {
      units: state.parseResult.rul.units,
      sampleSize: state.parseResult.rul.sampleSize,
      sizeList: state.parseResult.rul.sizeList,
    },
    rows,
  })

  state.notice = `模板包“${saved.templatePackage.templateName}”已按部位拆分保存 ${saved.records.length} 条记录。`
  state.createDrawerOpen = false
  resetCreateDrawerState()
}

function openRecordDetail(recordId: string): void {
  const record = getPartTemplateRecordById(recordId)
  if (!record) return
  state.detailDrawerOpen = true
  state.detailRecordId = record.id
  state.detailStandardPartName = record.standardPartName
}

export function handlePcsPartTemplateLibraryEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-part-template-action]')
  const action = actionNode?.dataset.partTemplateAction

  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    state.notice = null
    return true
  }

  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    resetCreateDrawerState()
    return true
  }

  if (action === 'close-detail-drawer') {
    state.detailDrawerOpen = false
    state.detailRecordId = null
    state.detailStandardPartName = ''
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'reset-filters') {
    state.search = ''
    state.standardPartFilter = '全部'
    state.sizeFilter = '全部'
    state.parserStatusFilter = '全部'
    state.machineReadyFilter = '全部'
    return true
  }

  if (action === 'select-dxf-file') {
    if (actionNode instanceof HTMLInputElement) {
      state.selectedDxfFile = actionNode.files?.[0] ?? null
      state.parseError = null
      state.uploadError = getCreateUploadError()

      return true
    }
  }

  if (action === 'select-rul-file') {
    if (actionNode instanceof HTMLInputElement) {
      state.selectedRulFile = actionNode.files?.[0] ?? null
      state.parseError = null
      state.uploadError = getCreateUploadError()
      return true
    }
  }

  if (action === 'clear-files') {
    state.selectedDxfFile = null
    state.selectedRulFile = null
    state.uploadError = null
    state.parseError = null
    state.parseResult = null
    state.draftStandardNames = {}
    return true
  }

  if (action === 'parse-template') {
    startParsingTemplate()
    return true
  }

  if (action === 'save-template') {
    saveParsedRows()
    return true
  }

  if (action === 'open-detail') {
    const recordId = actionNode?.dataset.recordId
    if (recordId) {
      openRecordDetail(recordId)
      return true
    }
  }

  if (action === 'save-detail-standard-name') {
    if (!state.detailRecordId) return true
    const updated = updatePartTemplateRecord(state.detailRecordId, {
      standardPartName: state.detailStandardPartName,
      parserStatus: state.detailStandardPartName.trim() ? '解析成功' : '待人工矫正',
    })

    if (updated) {
      state.notice = `已更新部位模板“${updated.standardPartName || updated.sourcePartName}”的标准部位名。`
    }

    return true
  }

  return false
}

export function handlePcsPartTemplateLibraryInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-part-template-field]')
  const field = fieldNode?.dataset.partTemplateField

  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.search = fieldNode.value
    return true
  }

  if (field === 'standardPartFilter' && fieldNode instanceof HTMLSelectElement) {
    state.standardPartFilter = fieldNode.value
    return true
  }

  if (field === 'sizeFilter' && fieldNode instanceof HTMLSelectElement) {
    state.sizeFilter = fieldNode.value
    return true
  }

  if (field === 'parserStatusFilter' && fieldNode instanceof HTMLSelectElement) {
    state.parserStatusFilter = fieldNode.value
    return true
  }

  if (field === 'machineReadyFilter' && fieldNode instanceof HTMLSelectElement) {
    state.machineReadyFilter = fieldNode.value
    return true
  }

  if (field === 'templateName' && fieldNode instanceof HTMLInputElement) {
    state.templateName = fieldNode.value
    return true
  }

  if (field === 'draft-standard-name' && fieldNode instanceof HTMLInputElement) {
    const partKey = fieldNode.dataset.partKey
    if (partKey) {
      state.draftStandardNames[partKey] = fieldNode.value
      return true
    }
  }

  if (field === 'detail-standard-name' && fieldNode instanceof HTMLInputElement) {
    state.detailStandardPartName = fieldNode.value
    return true
  }

  return false
}

export function isPcsPartTemplateLibraryDialogOpen(): boolean {
  return state.createDrawerOpen || state.detailDrawerOpen
}

export function renderPcsPartTemplateLibraryPage(): string {
  return renderPage()
}
