import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import {
  getProductionOrderAttachments,
  getProductionOrderBomItems,
  getProductionOrderCutPieceParts,
  getProductionOrderColorMaterialMappings,
  getProductionOrderPatternDesigns,
  getProductionOrderPatternFiles,
  getProductionOrderProcessEntries,
  getProductionOrderQualityRules,
  getProductionOrderSizeMeasurements,
  getProductionOrderSizeTable,
  getProductionOrderTechPackSnapshot,
} from '../data/fcs/production-order-tech-pack-runtime.ts'

type SnapshotTabKey =
  | 'pattern'
  | 'bom'
  | 'process'
  | 'size'
  | 'quality'
  | 'color-mapping'
  | 'design'
  | 'attachments'

const tabItems: Array<{ key: SnapshotTabKey; label: string }> = [
  { key: 'pattern', label: '纸样管理' },
  { key: 'bom', label: '物料清单' },
  { key: 'process', label: '工序工艺' },
  { key: 'size', label: '放码规则' },
  { key: 'quality', label: '质检标准' },
  { key: 'color-mapping', label: '款色用料对应' },
  { key: 'design', label: '花型设计' },
  { key: 'attachments', label: '附件' },
]

function getActiveTab(productionOrderId: string): SnapshotTabKey {
  const pathname = appStore.getState().pathname || ''
  const queryString = pathname.split('?')[1] || ''
  const params = new URLSearchParams(queryString)
  const tab = params.get('tab')
  if (tabItems.some((item) => item.key === tab)) {
    return tab as SnapshotTabKey
  }
  return 'pattern'
}

function renderEmptyState(text: string): string {
  return `<div class="rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">${escapeHtml(text)}</div>`
}

function renderTextValue(value: string | number | undefined | null): string {
  const normalized = String(value ?? '').trim()
  return normalized ? escapeHtml(normalized) : '暂无数据'
}

function renderPatternSizeSummary(selectedSizeCodes: string[], sizeRange?: string): string {
  if (selectedSizeCodes.length > 0) {
    return escapeHtml(selectedSizeCodes.join(' / '))
  }
  return renderTextValue(sizeRange)
}

function renderTemplatePreview(previewSvg?: string): string {
  if (!previewSvg) return '暂无数据'
  return `
    <div class="flex h-12 w-16 items-center justify-center overflow-hidden rounded border bg-white">
      ${previewSvg}
    </div>
  `
}

function renderPatternPieceDetailTable(
  rows: ReturnType<typeof getProductionOrderPatternFiles>,
): string {
  const pieceRows = rows.flatMap((patternRow) =>
    (patternRow.pieceRows ?? []).map((pieceRow) => ({
      patternName: patternRow.patternFileName || '暂无数据',
      ...pieceRow,
    })),
  )

  if (pieceRows.length === 0) {
    return renderEmptyState('当前快照未冻结裁片明细。')
  }

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">纸样</th>
            <th class="px-3 py-2 text-left font-medium">部位名称</th>
            <th class="px-3 py-2 text-right font-medium">片数</th>
            <th class="px-3 py-2 text-left font-medium">适用颜色</th>
            <th class="px-3 py-2 text-left font-medium">每种颜色的片数</th>
            <th class="px-3 py-2 text-left font-medium">特殊工艺</th>
            <th class="px-3 py-2 text-left font-medium">是否为模板</th>
            <th class="px-3 py-2 text-left font-medium">部位模板ID</th>
            <th class="px-3 py-2 text-left font-medium">部位模板缩略图</th>
          </tr>
        </thead>
        <tbody>
          ${pieceRows
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.patternName)}</td>
                  <td class="px-3 py-2 font-medium">${escapeHtml(row.name)}</td>
                  <td class="px-3 py-2 text-right">${escapeHtml(String(row.count))}</td>
                  <td class="px-3 py-2">${
                    (row.colorAllocations ?? []).length > 0
                      ? escapeHtml((row.colorAllocations ?? []).map((allocation) => allocation.colorName).join('、'))
                      : '暂无数据'
                  }</td>
                  <td class="px-3 py-2">${
                    (row.colorAllocations ?? []).length > 0
                      ? escapeHtml(
                          (row.colorAllocations ?? [])
                            .map((allocation) => `${allocation.colorName}：${allocation.pieceCount}`)
                            .join('；'),
                        )
                      : '暂无数据'
                  }</td>
                  <td class="px-3 py-2">${
                    (row.specialCrafts ?? []).length > 0
                      ? escapeHtml((row.specialCrafts ?? []).map((craft) => craft.displayName || craft.craftName).join('、'))
                      : '无'
                  }</td>
                  <td class="px-3 py-2">${row.isTemplate ? '是' : '否'}</td>
                  <td class="px-3 py-2">${renderTextValue(row.partTemplateId)}</td>
                  <td class="px-3 py-2">${renderTemplatePreview(row.partTemplatePreviewSvg)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderYesNo(value: boolean): string {
  return value ? '需要' : '不需要'
}

function isAllowedLocalImage(url: string | undefined | null): url is string {
  const normalized = String(url || '').trim()
  if (!normalized || normalized === '#') return false
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return false
  return !['/placeholder.svg', 'picsum', 'unsplash', 'dummyimage', 'loremflickr'].some((marker) =>
    normalized.includes(marker),
  )
}

function renderPatternTab(productionOrderId: string): string {
  const rows = getProductionOrderPatternFiles(productionOrderId)
  const cutPieceParts = getProductionOrderCutPieceParts(productionOrderId)
  const sizeMeasurements = getProductionOrderSizeMeasurements(productionOrderId)

  if (rows.length === 0 && cutPieceParts.length === 0) return renderEmptyState('当前快照未冻结纸样内容。')

  return `
    <div class="space-y-4">
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1100px] text-sm">
          <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">纸样类型</th>
              <th class="px-3 py-2 text-left font-medium">纸样分类</th>
              <th class="px-3 py-2 text-left font-medium">纸样文件</th>
              <th class="px-3 py-2 text-left font-medium">纸样版本</th>
              <th class="px-3 py-2 text-left font-medium">打版软件</th>
              <th class="px-3 py-2 text-left font-medium">尺码范围</th>
              <th class="px-3 py-2 text-left font-medium">关联物料</th>
              <th class="px-3 py-2 text-right font-medium">总裁片数</th>
              <th class="px-3 py-2 text-left font-medium">冻结时间</th>
              <th class="px-3 py-2 text-left font-medium">冻结人</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td colspan="10" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : rows
                    .map(
                      (row) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(row.patternMaterialTypeLabel)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternCategory)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternFileName)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternVersion)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternSoftwareName)}</td>
                          <td class="px-3 py-2">${renderPatternSizeSummary(row.selectedSizeCodes ?? [], row.sizeRange)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.linkedBomItemId)}</td>
                          <td class="px-3 py-2 text-right">${renderTextValue(row.totalPieceCount)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.uploadedAt)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.uploadedBy)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div>
        <h4 class="mb-2 text-sm font-medium text-foreground">裁片明细</h4>
      </div>
      ${renderPatternPieceDetailTable(rows)}

      <div>
        <h4 class="mb-2 text-sm font-medium text-foreground">裁片部位</h4>
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[920px] text-sm">
          <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">部位名称</th>
              <th class="px-3 py-2 text-right font-medium">每件用片数</th>
              <th class="px-3 py-2 text-left font-medium">对应面料</th>
              <th class="px-3 py-2 text-left font-medium">适用颜色</th>
              <th class="px-3 py-2 text-left font-medium">适用尺码</th>
              <th class="px-3 py-2 text-left font-medium">人工确认</th>
            </tr>
          </thead>
          <tbody>
            ${
              cutPieceParts.length === 0
                ? `
                  <tr>
                    <td colspan="6" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : cutPieceParts
                    .map(
                      (row) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(row.partNameCn)}</td>
                          <td class="px-3 py-2 text-right">${escapeHtml(String(row.pieceCountPerGarment))}</td>
                          <td class="px-3 py-2">${renderTextValue(row.materialName || row.materialSku)}</td>
                          <td class="px-3 py-2">${row.applicableColorList.length ? escapeHtml(row.applicableColorList.join('、')) : '暂无数据'}</td>
                          <td class="px-3 py-2">${row.applicableSizeList.length ? escapeHtml(row.applicableSizeList.join('、')) : '暂无数据'}</td>
                          <td class="px-3 py-2">${escapeHtml(renderYesNo(row.manualConfirmRequired))}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[720px] text-sm">
          <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">尺寸表</th>
              <th class="px-3 py-2 text-left font-medium">尺码</th>
              <th class="px-3 py-2 text-right font-medium">尺寸值</th>
              <th class="px-3 py-2 text-left font-medium">单位</th>
              <th class="px-3 py-2 text-right font-medium">公差</th>
            </tr>
          </thead>
          <tbody>
            ${
              sizeMeasurements.length === 0
                ? `
                  <tr>
                    <td colspan="5" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : sizeMeasurements
                    .map(
                      (row) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(row.measurementPart)}</td>
                          <td class="px-3 py-2">${escapeHtml(row.sizeCode)}</td>
                          <td class="px-3 py-2 text-right">${renderTextValue(row.measurementValue)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.measurementUnit)}</td>
                          <td class="px-3 py-2 text-right">${renderTextValue(row.tolerance)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderBomTab(productionOrderId: string): string {
  const rows = getProductionOrderBomItems(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结物料清单。')

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">物料名称</th>
            <th class="px-3 py-2 text-left font-medium">物料类型</th>
            <th class="px-3 py-2 text-left font-medium">规格</th>
            <th class="px-3 py-2 text-left font-medium">单件用量</th>
            <th class="px-3 py-2 text-left font-medium">损耗率</th>
            <th class="px-3 py-2 text-left font-medium">适用工序</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.name)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.type)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.spec || '-')}</td>
                  <td class="px-3 py-2">${escapeHtml(String(row.unitConsumption))}</td>
                  <td class="px-3 py-2">${escapeHtml(`${row.lossRate}%`)}</td>
                  <td class="px-3 py-2">${escapeHtml((row.usageProcessCodes || []).join('、') || '全部')}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderProcessTab(productionOrderId: string): string {
  const rows = getProductionOrderProcessEntries(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结工序工艺。')

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">阶段</th>
            <th class="px-3 py-2 text-left font-medium">工序</th>
            <th class="px-3 py-2 text-left font-medium">工艺</th>
            <th class="px-3 py-2 text-left font-medium">拆分维度</th>
            <th class="px-3 py-2 text-left font-medium">标准工时</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.stageName || row.stageCode)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.processName || row.processCode)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.craftName || '-')}</td>
                  <td class="px-3 py-2">${escapeHtml((row.detailSplitDimensions || []).join('、') || '整单')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.standardTimeMinutes ? `${row.standardTimeMinutes} ${row.timeUnit || '分钟/件'}` : '-')}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSizeTab(productionOrderId: string): string {
  const rows = getProductionOrderSizeTable(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结放码规则。')

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
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.part)}</td>
                  <td class="px-3 py-2">${escapeHtml(String(row.S))}</td>
                  <td class="px-3 py-2">${escapeHtml(String(row.M))}</td>
                  <td class="px-3 py-2">${escapeHtml(String(row.L))}</td>
                  <td class="px-3 py-2">${escapeHtml(String(row.XL))}</td>
                  <td class="px-3 py-2">${escapeHtml(String(row.tolerance))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderQualityTab(productionOrderId: string): string {
  const rows = getProductionOrderQualityRules(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结质检标准。')

  return `
    <div class="space-y-3">
      ${rows
        .map(
          (row) => `
            <section class="rounded-lg border bg-card p-4">
              <h3 class="text-sm font-medium">${escapeHtml(row.checkItem)}</h3>
              <p class="mt-2 text-sm text-muted-foreground">标准：${escapeHtml(row.standardText || '-')}</p>
              <p class="mt-1 text-sm text-muted-foreground">抽检规则：${escapeHtml(row.samplingRule || '-')}</p>
              <p class="mt-1 text-sm text-muted-foreground">备注：${escapeHtml(row.note || '-')}</p>
            </section>
          `,
        )
        .join('')}
    </div>
  `
}

function renderColorMappingTab(productionOrderId: string): string {
  const rows = getProductionOrderColorMaterialMappings(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结款色用料对应。')

  return `
    <div class="space-y-3">
      ${rows
        .map(
          (row) => `
            <section class="rounded-lg border bg-card p-4">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-sm font-medium">${escapeHtml(row.colorName || row.colorCode)}</h3>
                <span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">${escapeHtml(row.status)}</span>
              </div>
              <div class="mt-3 overflow-x-auto rounded-lg border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">物料</th>
                      <th class="px-3 py-2 text-left font-medium">纸样</th>
                      <th class="px-3 py-2 text-left font-medium">裁片</th>
                      <th class="px-3 py-2 text-left font-medium">单件片数</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${row.lines
                      .map(
                        (line) => `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2">${escapeHtml(line.materialName)}</td>
                            <td class="px-3 py-2">${escapeHtml(line.patternName || '-')}</td>
                            <td class="px-3 py-2">${escapeHtml(line.pieceName || '-')}</td>
                            <td class="px-3 py-2">${escapeHtml(String(line.pieceCountPerUnit || 0))}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </section>
          `,
        )
        .join('')}
    </div>
  `
}

function renderDesignTab(productionOrderId: string): string {
  const rows = getProductionOrderPatternDesigns(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结花型设计。')

  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows
        .map(
          (row) => `
            <section class="rounded-lg border bg-card p-4">
              <p class="text-sm font-medium">${escapeHtml(row.name)}</p>
              ${
                isAllowedLocalImage(row.previewThumbnailDataUrl || row.imageUrl)
                  ? `<img src="${escapeHtml(row.previewThumbnailDataUrl || row.imageUrl || '')}" alt="${escapeHtml(row.name)}" class="mt-3 h-40 w-full rounded-lg border object-cover" />`
                  : '<div class="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无图片</div>'
              }
            </section>
          `,
        )
        .join('')}
    </div>
  `
}

function renderAttachmentsTab(productionOrderId: string): string {
  const rows = getProductionOrderAttachments(productionOrderId)
  if (rows.length === 0) return renderEmptyState('当前快照未冻结附件。')

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">附件名称</th>
            <th class="px-3 py-2 text-left font-medium">附件类型</th>
            <th class="px-3 py-2 text-left font-medium">文件大小</th>
            <th class="px-3 py-2 text-left font-medium">冻结时间</th>
            <th class="px-3 py-2 text-left font-medium">冻结人</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.fileName)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.fileType)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.fileSize)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.uploadedAt || '-')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.uploadedBy || '-')}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderTabContent(tab: SnapshotTabKey, productionOrderId: string): string {
  if (tab === 'bom') return renderBomTab(productionOrderId)
  if (tab === 'process') return renderProcessTab(productionOrderId)
  if (tab === 'size') return renderSizeTab(productionOrderId)
  if (tab === 'quality') return renderQualityTab(productionOrderId)
  if (tab === 'color-mapping') return renderColorMappingTab(productionOrderId)
  if (tab === 'design') return renderDesignTab(productionOrderId)
  if (tab === 'attachments') return renderAttachmentsTab(productionOrderId)
  return renderPatternTab(productionOrderId)
}

export function renderFcsProductionTechPackSnapshotPage(productionOrderId: string): string {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId) || null
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  const activeTab = getActiveTab(productionOrderId)

  if (!order || !snapshot) {
    return `
      <div class="flex min-h-[320px] items-center justify-center">
        <section class="rounded-lg border bg-card p-8 text-center">
          <p class="text-base font-medium">未找到技术包快照</p>
          <p class="mt-1 text-sm text-muted-foreground">当前生产单尚未冻结技术包快照。</p>
        </section>
      </div>
    `
  }

  const taskChain = [
    snapshot.linkedRevisionTaskIds.length > 0 ? `改版任务 ${snapshot.linkedRevisionTaskIds.length}` : '',
    snapshot.linkedPatternTaskIds.length > 0 ? `制版任务 ${snapshot.linkedPatternTaskIds.length}` : '',
    snapshot.linkedArtworkTaskIds.length > 0 ? `花型任务 ${snapshot.linkedArtworkTaskIds.length}` : '',
  ]
    .filter(Boolean)
    .join(' / ') || '暂无来源任务链'

  return `
    <div class="space-y-4">
      <header class="rounded-lg border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold">技术包快照 - ${escapeHtml(order.productionOrderNo)}</h1>
            <p class="mt-2 text-sm text-muted-foreground">当前页面为生产单技术包快照查看页，仅供查看，不可编辑。</p>
          </div>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(order.productionOrderId)}">返回生产单</button>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6 text-sm">
          <div><p class="text-xs text-muted-foreground">生产单号</p><p class="mt-1 font-medium">${escapeHtml(order.productionOrderNo)}</p></div>
          <div><p class="text-xs text-muted-foreground">来源款式</p><p class="mt-1 font-medium">${escapeHtml(snapshot.styleName)}</p></div>
          <div><p class="text-xs text-muted-foreground">来源技术包版本编号</p><p class="mt-1 font-medium">${escapeHtml(snapshot.sourceTechPackVersionCode || '-')}</p></div>
          <div><p class="text-xs text-muted-foreground">来源技术包版本标签</p><p class="mt-1 font-medium">${escapeHtml(snapshot.sourceTechPackVersionLabel || '-')}</p></div>
          <div><p class="text-xs text-muted-foreground">快照冻结时间</p><p class="mt-1 font-medium">${escapeHtml(snapshot.snapshotAt || '-')}</p></div>
          <div><p class="text-xs text-muted-foreground">来源任务链</p><p class="mt-1 font-medium">${escapeHtml(taskChain)}</p></div>
        </div>
      </header>

      <nav class="grid w-full grid-cols-4 gap-2 rounded-lg border bg-muted/20 p-2 lg:grid-cols-8">
        ${tabItems
          .map(
            (item) => `
              <button
                class="rounded-md px-3 py-2 text-sm ${item.key === activeTab ? 'bg-background font-medium shadow-sm' : 'hover:bg-muted'}"
                data-nav="/fcs/production/orders/${escapeHtml(order.productionOrderId)}/tech-pack?tab=${item.key}"
              >${item.label}</button>
            `,
          )
          .join('')}
      </nav>

      ${renderTabContent(activeTab, productionOrderId)}
    </div>
  `
}
