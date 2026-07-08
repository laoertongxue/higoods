import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../data/fcs/production-order-tech-pack-runtime.ts'
import { getTechnicalDataVersionById, getTechnicalDataVersionContentById } from '../data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalColorMaterialMappingLine,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalPatternDesign,
  TechnicalPatternFile,
  TechnicalProcessEntry,
  TechnicalSizeRow,
} from '../data/pcs-technical-data-version-types.ts'

type SnapshotTabKey =
  | 'pattern'
  | 'bom'
  | 'process'
  | 'size'
  | 'color-mapping'
  | 'design'

const tabItems: Array<{ key: SnapshotTabKey; label: string }> = [
  { key: 'pattern', label: '纸样管理' },
  { key: 'bom', label: '物料清单' },
  { key: 'process', label: '工序工艺' },
  { key: 'size', label: '放码规则' },
  { key: 'color-mapping', label: '款色用料对应' },
  { key: 'design', label: '花型设计' },
]

type SourceTechPack = {
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
}

function getActiveTab(): SnapshotTabKey {
  const pathname = appStore.getState().pathname || ''
  const queryString = pathname.split('?')[1] || ''
  const params = new URLSearchParams(queryString)
  const tab = params.get('tab')
  if (tabItems.some((item) => item.key === tab)) return tab as SnapshotTabKey
  return 'pattern'
}

function renderEmptyState(text: string): string {
  return `<div class="rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">${escapeHtml(text)}</div>`
}

function renderTextValue(value: string | number | undefined | null): string {
  const normalized = String(value ?? '').trim()
  return normalized ? escapeHtml(normalized) : '<span class="text-muted-foreground">暂无数据</span>'
}

function renderReadonlyMaintainerStatus(value: string | undefined): string {
  const normalized = String(value ?? '').trim()
  if (normalized === '已解析待确认') return '已完成'
  return renderTextValue(normalized)
}

function renderFileName(file?: { fileName?: string } | null): string {
  return renderTextValue(file?.fileName)
}

function buildPrototypeDownloadUrl(fileName: string): string {
  const payload = [
    'HiGood 技术包快照演示文件',
    `文件名：${fileName}`,
    '用途：纸样管理下载演示',
  ].join('\n')
  return `data:text/plain;charset=utf-8,${encodeURIComponent(payload)}`
}

function buildPatternPreviewUrl(title: string, fileName: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <rect width="960" height="540" fill="#f8fafc"/>
      <rect x="40" y="40" width="880" height="460" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
      <path d="M250 126 C180 170 174 300 238 386 C306 478 464 462 526 366 C582 280 542 156 448 126 C382 104 310 108 250 126 Z" fill="#e0f2fe" stroke="#0284c7" stroke-width="5"/>
      <path d="M548 128 C632 110 726 146 760 230 C796 318 746 424 656 454 C586 478 494 440 464 372 C506 310 530 224 548 128 Z" fill="#dcfce7" stroke="#16a34a" stroke-width="5"/>
      <text x="60" y="84" font-size="28" font-weight="700" fill="#111827">${escapeHtml(title)}</text>
      <text x="60" y="472" font-size="22" fill="#475569">${escapeHtml(fileName)}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function renderPatternDownloadLink(fileName?: string | null, label?: string): string {
  const normalized = String(fileName || '').trim()
  if (!normalized) return '<span class="text-muted-foreground">暂无数据</span>'
  return `
    <a
      class="inline-flex items-center rounded border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
      href="${escapeHtml(buildPrototypeDownloadUrl(normalized))}"
      download="${escapeHtml(normalized)}"
    >
      ${escapeHtml(label || normalized)}
    </a>
  `
}

function getPatternTechnicalFiles(pattern: TechnicalPatternFile): Array<{ label: string; fileName: string }> {
  const displayFile = String(pattern.fileName || '').includes(' / ') ? '' : pattern.fileName
  const candidates = [
    { label: 'PRJ', fileName: pattern.prjFile?.fileName || '' },
    { label: 'DXF', fileName: pattern.dxfFileName || pattern.dxfFile?.fileName || '' },
    { label: 'RUL', fileName: pattern.rulFileName || pattern.rulFile?.fileName || '' },
    { label: '纸样文件', fileName: pattern.singlePatternFileName || displayFile || '' },
  ]
  const seen = new Set<string>()
  return candidates.filter((item) => {
    const fileName = item.fileName.trim()
    if (!fileName || seen.has(fileName)) return false
    seen.add(fileName)
    return true
  })
}

function renderPatternTechnicalFileLinks(pattern: TechnicalPatternFile): string {
  const files = getPatternTechnicalFiles(pattern)
  if (files.length === 0) return '<span class="text-muted-foreground">暂无数据</span>'
  return `<div class="flex flex-wrap gap-1">${files.map((file) => renderPatternDownloadLink(file.fileName, file.label)).join('')}</div>`
}

function renderPatternImagePreview(pattern: TechnicalPatternFile): string {
  const fileName = pattern.markerImage?.fileName || pattern.imageUrl || ''
  if (!fileName) return '<span class="text-muted-foreground">暂无图片</span>'
  const previewUrl =
    pattern.markerImage?.previewUrl && pattern.markerImage.previewUrl.startsWith('data:')
      ? pattern.markerImage.previewUrl
      : buildPatternPreviewUrl(resolvePatternTitle(pattern), fileName)
  return `
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded border bg-white p-1 text-xs text-blue-700 hover:border-blue-300 hover:bg-blue-50"
      data-tech-action="open-pattern-image-preview"
      data-tech-pattern-preview-url="${escapeHtml(previewUrl)}"
      data-tech-pattern-preview-title="${escapeHtml(resolvePatternTitle(pattern))}"
      data-tech-pattern-preview-file="${escapeHtml(fileName)}"
      data-skip-page-rerender="true"
    >
      <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(fileName)}" class="h-12 w-20 rounded object-cover" />
      <span>查看大图</span>
    </button>
  `
}

function renderPatternFileBadge(label: string): string {
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(label || '暂无数据')}</span>`
}

function renderReadonlyTagList(labels: string[], emptyText = '暂无数据'): string {
  const normalized = labels.map((item) => String(item || '').trim()).filter(Boolean)
  if (normalized.length === 0) return `<span class="text-muted-foreground">${escapeHtml(emptyText)}</span>`
  return `<div class="flex flex-wrap gap-1">${normalized
    .map((label) => `<span class="inline-flex rounded border px-1.5 py-0.5 text-[10px]">${escapeHtml(label)}</span>`)
    .join('')}</div>`
}

function renderPieceColorQuantitySummary(row: NonNullable<TechnicalPatternFile['pieceRows']>[number]): string {
  const colorQuantities = (row.colorPieceQuantities ?? []).filter((item) => item.enabled)
  if (colorQuantities.length > 0) {
    return `<div class="space-y-1">${colorQuantities
      .map((item) => `<div class="text-xs"><span class="text-muted-foreground">${escapeHtml(item.colorName)}</span>：${escapeHtml(String(item.pieceQty || 0))} 片</div>`)
      .join('')}</div>`
  }

  const allocations = row.colorAllocations ?? []
  if (allocations.length === 0) return '<span class="text-muted-foreground">暂无数据</span>'
  return `<div class="space-y-1">${allocations
    .map((item) => `<div class="text-xs"><span class="text-muted-foreground">${escapeHtml(item.colorName)}</span>：${escapeHtml(String(item.pieceCount || 0))} 片</div>`)
    .join('')}</div>`
}

function renderPieceSpecialCraftSummary(row: NonNullable<TechnicalPatternFile['pieceRows']>[number]): string {
  const labels = (row.specialCrafts ?? []).map((craft) => craft.displayName || craft.craftName)
  return renderReadonlyTagList(labels, '无')
}

function renderPieceInstanceCraftSummary(pattern: TechnicalPatternFile, sourcePieceId: string): string {
  const instances = (pattern.pieceInstances ?? []).filter((instance) => instance.sourcePieceId === sourcePieceId)
  const labels = instances
    .flatMap((instance) =>
      instance.specialCraftAssignments.map((assignment) =>
        `${instance.displayName}：${assignment.craftName}（${assignment.craftPositionName}）`,
      ),
    )
    .slice(0, 3)
  if (labels.length === 0) return `<span class="text-muted-foreground">已配置 0 / 共 ${escapeHtml(String(instances.length))} 片</span>`
  return `<div class="space-y-1"><div>已配置 ${escapeHtml(String(labels.length))} / 共 ${escapeHtml(String(instances.length))} 片</div>${renderReadonlyTagList(labels, '暂无逐片工艺')}</div>`
}

function getPatternTotalPieceQty(pattern: TechnicalPatternFile): number {
  return (pattern.pieceRows ?? []).reduce((sum, row) => sum + Number(row.totalPieceQty ?? row.count ?? 0), 0)
}

function resolvePatternTitle(pattern: TechnicalPatternFile): string {
  return pattern.patternName || pattern.sourcePatternPackageName || pattern.fileName || pattern.singlePatternFileName || pattern.id
}

function resolvePatternMaterialTypeLabel(pattern: TechnicalPatternFile): string {
  return pattern.patternMaterialTypeLabel || (pattern.patternMaterialType === 'WOOL' ? '毛织纸样' : pattern.patternMaterialType === 'WOVEN' ? '布料纸样' : '暂无数据')
}

function resolvePatternFileType(pattern: TechnicalPatternFile): string {
  return pattern.patternMaterialTypeLabel || (pattern.patternMaterialType === 'WOOL' ? '毛织纸样' : '布料纸样')
}

function renderPatternPool(patternRows: TechnicalPatternFile[]): string {
  const explicitPackages = patternRows.filter((item) => item.recordKind === 'PACKAGE')
  const rows = explicitPackages.length > 0 ? explicitPackages : patternRows

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold">纸样池</h4>
        <span class="text-xs text-muted-foreground">${escapeHtml(String(rows.length))} 个纸样包</span>
      </div>
      ${
        rows.length === 0
          ? '<div class="rounded-lg border py-8 text-center text-muted-foreground">暂无纸样包</div>'
          : `
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              ${rows
                .map((item) => `
                  <section class="rounded-lg border p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="font-medium">${escapeHtml(resolvePatternTitle(item))}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${resolvePatternMaterialTypeLabel(item)} · ${item.patternCategory || '-'}`)}</div>
                      </div>
                      ${renderPatternFileBadge(resolvePatternMaterialTypeLabel(item))}
                    </div>
                    <div class="mt-3 space-y-2 text-xs">
                      <div>
                        <div class="mb-1 text-muted-foreground">技术文件</div>
                        ${renderPatternTechnicalFileLinks(item)}
                      </div>
                      <div>
                        <div class="mb-1 text-muted-foreground">纸样图</div>
                        ${renderPatternImagePreview(item)}
                      </div>
                    </div>
                    <div class="mt-3 text-xs text-blue-700">${item.patternMaterialType === 'WOOL' ? `毛织部位明细 ${escapeHtml(String((item.pieceRows ?? []).length))} 项` : `已解析 ${escapeHtml(String((item.pieceRows ?? []).length))} 个部位`}</div>
                  </section>
                `)
                .join('')}
            </div>
          `
      }
    </div>
  `
}

function renderMaterialPatternLinks(content: TechnicalDataVersionContent): string {
  const bomById = new Map(content.bomItems.map((item) => [item.id, item]))
  const explicitLinks = content.patternFiles.filter((item) => item.recordKind !== 'PACKAGE')
  const rows = explicitLinks.length > 0 ? explicitLinks : content.patternFiles

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold">物料&纸样关联管理</h4>
        <span class="text-xs text-muted-foreground">${escapeHtml(String(rows.length))} 条关联</span>
      </div>
      ${
        rows.length === 0
          ? '<div class="rounded-lg border py-8 text-center text-muted-foreground">暂无物料与纸样关联</div>'
          : `
            <div class="overflow-x-auto rounded-lg border">
              <table class="w-full min-w-[1280px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">物料</th>
                    <th class="px-3 py-2 text-left">规格</th>
                    <th class="px-3 py-2 text-left">关联纸样</th>
                    <th class="px-3 py-2 text-left">纸样文件类型</th>
                    <th class="px-3 py-2 text-left">纸样分类</th>
                    <th class="px-3 py-2 text-left">维护状态</th>
                    <th class="px-3 py-2 text-left">捆条数量</th>
                    <th class="px-3 py-2 text-right">部位总片数</th>
                    <th class="px-3 py-2 text-left">部位明细</th>
                    <th class="px-3 py-2 text-left">技术文件</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map((item) => {
                      const bom = item.linkedBomItemId ? bomById.get(item.linkedBomItemId) : null
                      const totalPieceQty = getPatternTotalPieceQty(item)
                      return `
                        <tr class="border-b align-top last:border-0">
                          <td class="px-3 py-2">
                            <div>${bom ? escapeHtml(`${bom.name} · ${bom.id}`) : renderTextValue(item.linkedMaterialName || item.linkedMaterialSku)}</div>
                            ${item.linkedMaterialAlias ? `<div class="mt-1 text-xs text-muted-foreground">别名：${escapeHtml(item.linkedMaterialAlias)}</div>` : ''}
                          </td>
                          <td class="px-3 py-2">${renderTextValue(bom?.spec || item.sizeRange)}</td>
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.sourcePatternPackageName || resolvePatternTitle(item))}</td>
                          <td class="px-3 py-2">${escapeHtml(resolvePatternFileType(item))}</td>
                          <td class="px-3 py-2">${renderTextValue(item.patternCategory)}</td>
                          <td class="px-3 py-2">${renderReadonlyMaintainerStatus(item.maintainerStepStatus || item.parseStatusLabel || item.parseStatus)}</td>
                          <td class="px-3 py-2">${escapeHtml(String((item.bindingStrips ?? []).length))} 条</td>
                          <td class="px-3 py-2 text-right">${escapeHtml(String(totalPieceQty))} 片</td>
                          <td class="px-3 py-2">${escapeHtml(String((item.pieceRows ?? []).length))} 项明细</td>
                          <td class="px-3 py-2 text-xs">
                            <div class="space-y-2">
                              ${renderPatternTechnicalFileLinks(item)}
                              ${renderPatternImagePreview(item)}
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </div>
  `
}

function renderPatternPieceTable(patternRows: TechnicalPatternFile[]): string {
  const rows = patternRows.flatMap((pattern) =>
    (pattern.pieceRows ?? []).map((piece) => ({ pattern, piece })),
  )
  if (rows.length === 0) return renderEmptyState('暂无部位明细。')

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[1280px] text-xs">
        <thead>
          <tr class="border-b bg-muted/20">
            <th class="px-2 py-1 text-left">关联纸样</th>
            <th class="px-2 py-1 text-left">部位名称</th>
            <th class="px-2 py-1 text-left">原始名称</th>
            <th class="px-2 py-1 text-left">尺码</th>
            <th class="px-2 py-1 text-left">解析参考片数</th>
            <th class="px-2 py-1 text-left">适用颜色 / 每种颜色的片数</th>
            <th class="px-2 py-1 text-right">当前部位总片数</th>
            <th class="px-2 py-1 text-left">部位特殊工艺</th>
            <th class="px-2 py-1 text-left">是否为模板</th>
            <th class="px-2 py-1 text-left">部位模板ID</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(({ pattern, piece }) => `
              <tr class="border-b align-top last:border-0">
                <td class="px-2 py-1">${escapeHtml(resolvePatternTitle(pattern))}</td>
                <td class="px-2 py-1 font-medium">${escapeHtml(piece.name)}</td>
                <td class="px-2 py-1">${renderTextValue(piece.sourcePartName || piece.systemPieceName)}</td>
                <td class="px-2 py-1">${renderTextValue(piece.sizeCode)}</td>
                <td class="px-2 py-1">${renderTextValue(piece.parsedQuantity)}</td>
                <td class="px-2 py-1">${renderPieceColorQuantitySummary(piece)}</td>
                <td class="px-2 py-1 text-right">${escapeHtml(String(piece.totalPieceQty ?? piece.count ?? 0))} 片</td>
                <td class="px-2 py-1">${renderPieceSpecialCraftSummary(piece)}<div class="mt-1">${renderPieceInstanceCraftSummary(pattern, piece.id)}</div></td>
                <td class="px-2 py-1">${piece.isTemplate ? '是' : '否'}</td>
                <td class="px-2 py-1">${renderTextValue(piece.partTemplateId)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderPatternTab(source: SourceTechPack): string {
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4" data-testid="production-tech-pack-pattern-tab">
      <header class="border-b px-4 py-3">
        <h3 class="text-base font-semibold">纸样管理</h3>
      </header>
      ${renderPatternPool(source.content.patternFiles)}
      ${renderMaterialPatternLinks(source.content)}
      <div class="space-y-3">
        <h4 class="text-sm font-semibold">部位明细</h4>
        ${renderPatternPieceTable(source.content.patternFiles)}
      </div>
    </section>
  `
}

function renderBomTab(items: TechnicalBomItem[]): string {
  if (items.length === 0) return renderEmptyState('暂无物料清单。')
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[1180px] text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">物料名称</th>
            <th class="px-3 py-2 text-left font-medium">物料类型</th>
            <th class="px-3 py-2 text-left font-medium">规格</th>
            <th class="px-3 py-2 text-left font-medium">适用 SKU</th>
            <th class="px-3 py-2 text-left font-medium">关联纸样</th>
            <th class="px-3 py-2 text-left font-medium">单件用量</th>
            <th class="px-3 py-2 text-left font-medium">损耗率</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((row) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2 font-medium">${escapeHtml(row.name)}</td>
                <td class="px-3 py-2">${escapeHtml(row.type)}</td>
                <td class="px-3 py-2">${renderTextValue(row.spec || row.colorLabel)}</td>
                <td class="px-3 py-2">${renderReadonlyTagList(row.applicableSkuCodes ?? [])}</td>
                <td class="px-3 py-2">${renderReadonlyTagList(row.linkedPatternIds ?? [])}</td>
                <td class="px-3 py-2">${escapeHtml(String(row.unitConsumption))}</td>
                <td class="px-3 py-2">${escapeHtml(`${row.lossRate}%`)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderProcessTab(rows: TechnicalProcessEntry[]): string {
  if (rows.length === 0) return renderEmptyState('暂无工序工艺。')
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">阶段</th>
            <th class="px-3 py-2 text-left font-medium">工序</th>
            <th class="px-3 py-2 text-left font-medium">工艺</th>
            <th class="px-3 py-2 text-left font-medium">任务模式</th>
            <th class="px-3 py-2 text-left font-medium">拆分维度</th>
            <th class="px-3 py-2 text-left font-medium">作用对象</th>
            <th class="px-3 py-2 text-left font-medium">完成交出</th>
            <th class="px-3 py-2 text-left font-medium">执行要求</th>
            <th class="px-3 py-2 text-left font-medium">产值</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2">${escapeHtml(row.stageName || row.stageCode)}</td>
                <td class="px-3 py-2 font-medium">${escapeHtml(row.processName || row.processCode)}</td>
                <td class="px-3 py-2">${renderTextValue(row.craftName)}</td>
                <td class="px-3 py-2">${renderTextValue(row.taskTypeMode)}</td>
                <td class="px-3 py-2">${renderReadonlyTagList(row.detailSplitDimensions || [], '整单')}</td>
                <td class="px-3 py-2">${renderTextValue(row.targetObjectName || row.selectedTargetObject)}</td>
                <td class="px-3 py-2">${renderTextValue(row.downstreamTarget)}</td>
                <td class="px-3 py-2 text-xs text-muted-foreground">${[
                  row.materialIssueMode === 'WAREHOUSE_DELIVERY' ? '染厂/面料仓送料到厂' : '',
                  row.requiresFeiTicket ? '打印毛织菲票' : '',
                  row.packagingRequired ? '毛织厂包装' : '',
                ].filter(Boolean).map((item) => escapeHtml(item)).join(' / ') || '—'}</td>
                <td class="px-3 py-2">${row.outputValuePerUnit ? `${escapeHtml(String(row.outputValuePerUnit))} ${escapeHtml(row.outputValueUnit || '产值/件')}` : '暂无数据'}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSizeTab(rows: TechnicalSizeRow[]): string {
  if (rows.length === 0) return renderEmptyState('暂无放码规则。')
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">部位</th>
            <th class="px-3 py-2 text-left font-medium">S</th>
            <th class="px-3 py-2 text-left font-medium">M</th>
            <th class="px-3 py-2 text-left font-medium">L</th>
            <th class="px-3 py-2 text-left font-medium">XL</th>
            <th class="px-3 py-2 text-left font-medium">公差</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => `
              <tr class="border-b last:border-0">
                <td class="px-3 py-2 font-medium">${escapeHtml(row.part)}</td>
                <td class="px-3 py-2">${escapeHtml(String(row.S))}</td>
                <td class="px-3 py-2">${escapeHtml(String(row.M))}</td>
                <td class="px-3 py-2">${escapeHtml(String(row.L))}</td>
                <td class="px-3 py-2">${escapeHtml(String(row.XL))}</td>
                <td class="px-3 py-2">${escapeHtml(String(row.tolerance))}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

const colorMappingStatusLabel: Record<string, string> = {
  AUTO_CONFIRMED: '已确认',
  AUTO_DRAFT: '待人工确认',
  CONFIRMED: '已确认',
  MANUAL_ADJUSTED: '人工调整',
}

function normalizeSnapshotMaterialType(value: string | undefined): TechnicalColorMaterialMappingLine['materialType'] {
  if (value === '面料' || value === '辅料' || value === '半成品' || value === '包装材料') return value
  return '其他'
}

function resolveColorMappingLineFromSources(
  line: TechnicalColorMaterialMappingLine,
  content: TechnicalDataVersionContent,
): TechnicalColorMaterialMappingLine | null {
  const bom =
    (line.bomItemId ? content.bomItems.find((item) => item.id === line.bomItemId) : null)
    || content.bomItems.find((item) => item.name === line.materialName)
    || null
  if (!bom) return null

  const linkedPatterns = content.patternFiles.filter(
    (pattern) =>
      pattern.recordKind !== 'PACKAGE'
      && (pattern.linkedBomItemId === bom.id || (bom.linkedPatternIds ?? []).includes(pattern.id)),
  )
  const pattern =
    (line.patternId ? linkedPatterns.find((item) => item.id === line.patternId) : null)
    || linkedPatterns.find((item) => resolvePatternTitle(item) === line.patternName)
    || linkedPatterns[0]
    || null
  if (!pattern) return null

  const pieces = pattern.pieceRows ?? []
  const piece =
    (line.pieceId ? pieces.find((item) => item.id === line.pieceId) : null)
    || pieces.find((item) => item.name === line.pieceName)
    || pieces[0]
    || null
  if (!piece) return null

  return {
    ...line,
    bomItemId: bom.id,
    materialName: bom.name || line.materialName,
    materialType: normalizeSnapshotMaterialType(bom.type),
    patternId: pattern.id,
    patternName: resolvePatternTitle(pattern),
    pieceId: piece.id,
    pieceName: piece.name,
    pieceCountPerUnit: Number(line.pieceCountPerUnit || piece.count || piece.totalPieceQty || 0) || undefined,
    unit: line.unit || '片',
  }
}

function buildResolvedColorMappingRows(content: TechnicalDataVersionContent): TechnicalColorMaterialMapping[] {
  if (content.colorMaterialMappings.length === 0) return []
  return content.colorMaterialMappings.map((mapping) => ({
    ...mapping,
    lines: mapping.lines
      .map((line) => resolveColorMappingLineFromSources(line, content))
      .filter((line): line is TechnicalColorMaterialMappingLine => Boolean(line)),
  }))
}

function renderColorMappingTab(rows: TechnicalColorMaterialMapping[]): string {
  if (rows.length === 0) return renderEmptyState('暂无款色用料对应。')
  return `
    <div class="space-y-3">
      ${rows
        .map((row) => `
          <section class="rounded-lg border bg-card p-4">
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-sm font-medium">${escapeHtml(row.colorName || row.colorCode)}</h3>
              <span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">${escapeHtml(colorMappingStatusLabel[row.status] || row.status)}</span>
            </div>
            <div class="mt-3 overflow-x-auto rounded-lg border">
              <table class="w-full min-w-[900px] text-sm">
                <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">物料</th>
                    <th class="px-3 py-2 text-left font-medium">纸样</th>
                    <th class="px-3 py-2 text-left font-medium">裁片</th>
                    <th class="px-3 py-2 text-left font-medium">适用 SKU</th>
                    <th class="px-3 py-2 text-left font-medium">单件片数</th>
                  </tr>
                </thead>
                <tbody>
                  ${row.lines
                    .map((line) => `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-2">${escapeHtml(line.materialName)}</td>
                        <td class="px-3 py-2">${renderTextValue(line.patternName)}</td>
                        <td class="px-3 py-2">${renderTextValue(line.pieceName)}</td>
                        <td class="px-3 py-2">${renderReadonlyTagList(line.applicableSkuCodes ?? [])}</td>
                        <td class="px-3 py-2">${escapeHtml(String(line.pieceCountPerUnit || 0))}</td>
                      </tr>
                    `)
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>
        `)
        .join('')}
    </div>
  `
}

function isAllowedLocalImage(url: string | undefined | null): url is string {
  const normalized = String(url || '').trim()
  if (!normalized || normalized === '#') return false
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return false
  return !['/placeholder.svg', 'picsum', 'unsplash', 'dummyimage', 'loremflickr'].some((marker) => normalized.includes(marker))
}

function renderDesignTab(rows: TechnicalPatternDesign[]): string {
  if (rows.length === 0) return renderEmptyState('暂无花型设计。')
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows
        .map((row) => `
          <section class="rounded-lg border bg-card p-4">
            <p class="text-sm font-medium">${escapeHtml(row.name)}</p>
            ${
              isAllowedLocalImage(row.previewThumbnailDataUrl || row.imageUrl)
                ? `<img src="${escapeHtml(row.previewThumbnailDataUrl || row.imageUrl || '')}" alt="${escapeHtml(row.name)}" class="mt-3 h-40 w-full rounded-lg border object-cover" />`
                : '<div class="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无图片</div>'
            }
          </section>
        `)
        .join('')}
    </div>
  `
}

function renderTabContent(tab: SnapshotTabKey, source: SourceTechPack): string {
  if (tab === 'bom') return renderBomTab(source.content.bomItems)
  if (tab === 'process') return renderProcessTab(source.content.processEntries)
  if (tab === 'size') return renderSizeTab(source.content.sizeTable)
  if (tab === 'color-mapping') return renderColorMappingTab(buildResolvedColorMappingRows(source.content))
  if (tab === 'design') return renderDesignTab(source.content.patternDesigns)
  return renderPatternTab(source)
}

function getSourceTechPack(sourceTechPackVersionId: string): SourceTechPack | null {
  const record = getTechnicalDataVersionById(sourceTechPackVersionId)
  const content = getTechnicalDataVersionContentById(sourceTechPackVersionId)
  if (!record || !content) return null
  return { record, content }
}

export function renderFcsProductionTechPackSnapshotPage(productionOrderId: string): string {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId) || null
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  const activeTab = getActiveTab()

  if (!order || !snapshot) {
    return `
      <div class="flex min-h-[320px] items-center justify-center">
        <section class="rounded-lg border bg-card p-8 text-center">
          <p class="text-base font-medium">未找到技术包快照</p>
        </section>
      </div>
    `
  }

  const source = getSourceTechPack(snapshot.sourceTechPackVersionId)
  if (!source) {
    return `
      <div class="flex min-h-[320px] items-center justify-center">
        <section class="rounded-lg border bg-card p-8 text-center">
          <p class="text-base font-medium">未找到来源技术包版本</p>
        </section>
      </div>
    `
  }

  const taskChain = [
    source.record.linkedRevisionTaskIds.length > 0 ? `改版任务 ${source.record.linkedRevisionTaskIds.length}` : '',
    source.record.linkedPatternTaskIds.length > 0 ? `制版任务 ${source.record.linkedPatternTaskIds.length}` : '',
    source.record.linkedArtworkTaskIds.length > 0 ? `花型任务 ${source.record.linkedArtworkTaskIds.length}` : '',
  ]
    .filter(Boolean)
    .join(' / ') || '未记录来源任务链'

  return `
    <div class="space-y-4">
      <header class="rounded-lg border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold">技术包快照 - ${escapeHtml(order.productionOrderNo)}</h1>
          </div>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(order.productionOrderId)}">返回生产单</button>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6 text-sm">
          <div><p class="text-xs text-muted-foreground">生产单号</p><p class="mt-1 font-medium">${escapeHtml(order.productionOrderNo)}</p></div>
          <div><p class="text-xs text-muted-foreground">来源款式</p><p class="mt-1 font-medium">${escapeHtml(source.record.styleName || snapshot.styleName)}</p></div>
          <div><p class="text-xs text-muted-foreground">来源技术包版本编号</p><p class="mt-1 font-medium">${escapeHtml(source.record.technicalVersionCode)}</p></div>
          <div><p class="text-xs text-muted-foreground">来源技术包版本标签</p><p class="mt-1 font-medium">${escapeHtml(source.record.versionLabel)}</p></div>
          <div><p class="text-xs text-muted-foreground">快照冻结时间</p><p class="mt-1 font-medium">${escapeHtml(snapshot.snapshotAt || source.record.publishedAt || '-')}</p></div>
          <div><p class="text-xs text-muted-foreground">来源任务链</p><p class="mt-1 font-medium">${escapeHtml(taskChain)}</p></div>
        </div>
      </header>

      <nav class="grid w-full grid-cols-4 gap-2 rounded-lg border bg-muted/20 p-2 lg:grid-cols-7">
        ${tabItems
          .map((item) => `
            <button
              class="rounded-md px-3 py-2 text-sm ${item.key === activeTab ? 'bg-background font-medium shadow-sm' : 'hover:bg-muted'}"
              data-nav="/fcs/production/orders/${escapeHtml(order.productionOrderId)}/tech-pack?tab=${item.key}"
            >${escapeHtml(item.label)}</button>
          `)
          .join('')}
      </nav>

      ${renderTabContent(activeTab, source)}
    </div>
  `
}
