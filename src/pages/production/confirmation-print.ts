import { escapeHtml } from '../../utils.ts'
import {
  getOrCreateProductionConfirmation,
  getPostIncludedRemark,
  getProductionConfirmationByOrderId,
  getProductionConfirmationSnapshotById,
  isProductionConfirmationPrintable,
  listProductionConfirmationsByOrderId,
  productionConfirmationStatusLabels,
  type ProductionConfirmationImage,
  type ProductionConfirmationSnapshot,
} from '../../data/fcs/production-confirmation.ts'

function renderTextValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return '<span class="text-muted-foreground">暂无数据</span>'
  }
  return escapeHtml(String(value))
}

function renderPatternSizeSummary(selectedSizeCodes: string[], sizeRange?: string): string {
  if (selectedSizeCodes.length > 0) {
    return escapeHtml(selectedSizeCodes.join(' / '))
  }
  return renderTextValue(sizeRange)
}

function renderTemplatePreview(previewSvg?: string): string {
  if (!previewSvg) {
    return '<span class="text-muted-foreground">-</span>'
  }
  return `
    <div class="flex h-12 w-16 items-center justify-center overflow-hidden rounded border bg-white">
      ${previewSvg}
    </div>
  `
}

function renderPatternPieceDetailTable(snapshot: ProductionConfirmationSnapshot): string {
  const rows = snapshot.patternSnapshot.rows.flatMap((patternRow) =>
    patternRow.pieceRows.map((pieceRow) => ({
      patternName: patternRow.patternFileName || '暂无数据',
      ...pieceRow,
    })),
  )

  if (rows.length === 0) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无数据</div>'
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
          ${rows
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.patternName)}</td>
                  <td class="px-3 py-2 font-medium">${escapeHtml(row.name)}</td>
                  <td class="px-3 py-2 text-right">${escapeHtml(String(row.count))}</td>
                  <td class="px-3 py-2">${
                    row.colorAllocations.length > 0
                      ? escapeHtml(row.colorAllocations.map((allocation) => allocation.colorName).join('、'))
                      : '<span class="text-muted-foreground">暂无数据</span>'
                  }</td>
                  <td class="px-3 py-2">${
                    row.colorAllocations.length > 0
                      ? escapeHtml(
                          row.colorAllocations
                            .map((allocation) => `${allocation.colorName}：${allocation.pieceCount}`)
                            .join('；'),
                        )
                      : '<span class="text-muted-foreground">暂无数据</span>'
                  }</td>
                  <td class="px-3 py-2">${
                    row.specialCrafts.length > 0
                      ? escapeHtml(row.specialCrafts.map((craft) => craft.displayName || craft.craftName).join('、'))
                      : '<span class="text-muted-foreground">无</span>'
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

function renderImageGroup(title: string, images: ProductionConfirmationImage[]): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
      ${
        images.length === 0
          ? '<div class="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无图片</div>'
          : `
            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              ${images
                .map(
                  (image) => `
                    <figure class="overflow-hidden rounded-lg border bg-muted/10">
                      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.label)}" class="h-44 w-full object-cover" />
                      <figcaption class="border-t px-3 py-2 text-xs text-muted-foreground">${escapeHtml(image.label)}</figcaption>
                    </figure>
                  `,
                )
                .join('')}
            </div>
          `
      }
    </section>
  `
}

function renderKeyValueGrid(rows: Array<{ label: string; value: string }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${rows
        .map(
          (row) => `
            <div class="rounded-lg border bg-card p-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(row.label)}</div>
              <div class="mt-1 text-sm font-medium">${row.value}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSizeQtyMatrix(snapshot: ProductionConfirmationSnapshot): string {
  const { sizes, rows } = snapshot.sizeQtySnapshot

  if (rows.length === 0 || sizes.length === 0) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无数据</div>'
  }

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[720px] text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">颜色</th>
            ${sizes.map((size) => `<th class="px-3 py-2 text-right font-medium">${escapeHtml(size)}</th>`).join('')}
            <th class="px-3 py-2 text-right font-medium">合计</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b last:border-0">
                  <td class="px-3 py-2 font-medium">${escapeHtml(row.color)}</td>
                  ${sizes
                    .map((size) => `<td class="px-3 py-2 text-right">${escapeHtml(String(row.sizeQtyMap[size] ?? 0))}</td>`)
                    .join('')}
                  <td class="px-3 py-2 text-right font-medium">${escapeHtml(String(row.totalQty))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderBomTable(snapshot: ProductionConfirmationSnapshot): string {
  if (snapshot.bomSnapshot.length === 0) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无数据</div>'
  }

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[1160px] text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">类型</th>
            <th class="px-3 py-2 text-left font-medium">物料名称</th>
            <th class="px-3 py-2 text-left font-medium">物料 SKU</th>
            <th class="px-3 py-2 text-left font-medium">颜色</th>
            <th class="px-3 py-2 text-left font-medium">规格</th>
            <th class="px-3 py-2 text-right font-medium">单件用量</th>
            <th class="px-3 py-2 text-right font-medium">损耗率</th>
            <th class="px-3 py-2 text-right font-medium">计划用量</th>
            <th class="px-3 py-2 text-left font-medium">单位</th>
            <th class="px-3 py-2 text-left font-medium">图片</th>
            <th class="px-3 py-2 text-left font-medium">适用 SKU</th>
            <th class="px-3 py-2 text-left font-medium">印花要求</th>
            <th class="px-3 py-2 text-left font-medium">染色要求</th>
          </tr>
        </thead>
        <tbody>
          ${snapshot.bomSnapshot
            .map(
              (row) => `
                <tr class="border-b align-top last:border-0">
                  <td class="px-3 py-2">${escapeHtml(row.materialType)}</td>
                  <td class="px-3 py-2 font-medium">${escapeHtml(row.materialName)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.materialSku)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.materialColor)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.spec)}</td>
                  <td class="px-3 py-2 text-right">${renderTextValue(row.unitConsumption)}</td>
                  <td class="px-3 py-2 text-right">${row.lossRate === null ? '<span class="text-muted-foreground">暂无数据</span>' : `${escapeHtml(String(row.lossRate))}%`}</td>
                  <td class="px-3 py-2 text-right">${renderTextValue(row.plannedUsageQty)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.usageUnit)}</td>
                  <td class="px-3 py-2 text-muted-foreground">${row.materialImageUrl ? `<img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(row.materialName)}" class="h-12 w-12 rounded border object-cover" />` : '暂无图片'}</td>
                  <td class="px-3 py-2">${row.applicableSkuCodes.length ? escapeHtml(row.applicableSkuCodes.join('、')) : '<span class="text-muted-foreground">暂无数据</span>'}</td>
                  <td class="px-3 py-2">${renderTextValue(row.printRequirement)}</td>
                  <td class="px-3 py-2">${renderTextValue(row.dyeRequirement)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderTaskAssignmentTable(snapshot: ProductionConfirmationSnapshot): string {
  if (snapshot.taskAssignmentSnapshot.length === 0) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无数据</div>'
  }

  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[1100px] text-sm">
        <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">任务号</th>
            <th class="px-3 py-2 text-left font-medium">阶段</th>
            <th class="px-3 py-2 text-left font-medium">工序</th>
            <th class="px-3 py-2 text-left font-medium">工艺</th>
            <th class="px-3 py-2 text-left font-medium">工厂</th>
            <th class="px-3 py-2 text-left font-medium">分配方式</th>
            <th class="px-3 py-2 text-left font-medium">分配时间</th>
            <th class="px-3 py-2 text-right font-medium">数量</th>
            <th class="px-3 py-2 text-left font-medium">单位</th>
            <th class="px-3 py-2 text-left font-medium">接收方</th>
            <th class="px-3 py-2 text-left font-medium">备注</th>
          </tr>
        </thead>
        <tbody>
          ${snapshot.taskAssignmentSnapshot
            .map(
              (row) => `
                <tr class="border-b align-top last:border-0">
                  <td class="px-3 py-2 font-mono">${escapeHtml(row.taskNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.stageName)}</td>
                  <td class="px-3 py-2 font-medium">${escapeHtml(row.processName)}</td>
                  <td class="px-3 py-2">${renderTextValue(row.craftName)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.assignedFactoryName)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.assignmentMode)}</td>
                  <td class="px-3 py-2">${renderTextValue(row.assignedAt)}</td>
                  <td class="px-3 py-2 text-right">${escapeHtml(String(row.taskQty))}</td>
                  <td class="px-3 py-2">${escapeHtml(row.qtyUnit)}</td>
                  <td class="px-3 py-2">${renderTextValue(row.receiverName)}</td>
                  <td class="px-3 py-2">${renderTextValue(row.remark)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderPatternSection(snapshot: ProductionConfirmationSnapshot): string {
  const patternRows = snapshot.patternSnapshot.rows
  const sizeMeasurements = snapshot.patternSnapshot.sizeMeasurements
  const cutPieceParts = snapshot.patternSnapshot.cutPieceParts

  return `
    <div class="space-y-4">
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1040px] text-sm">
          <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">纸样类型</th>
              <th class="px-3 py-2 text-left font-medium">纸样分类</th>
              <th class="px-3 py-2 text-left font-medium">纸样文件</th>
              <th class="px-3 py-2 text-left font-medium">纸样版本</th>
              <th class="px-3 py-2 text-left font-medium">打版软件</th>
              <th class="px-3 py-2 text-left font-medium">尺码范围</th>
              <th class="px-3 py-2 text-right font-medium">门幅</th>
              <th class="px-3 py-2 text-right font-medium">唛架长度</th>
              <th class="px-3 py-2 text-right font-medium">裁片总片数</th>
            </tr>
          </thead>
          <tbody>
            ${
              patternRows.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : patternRows
                    .map(
                      (row) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(row.patternMaterialTypeLabel)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternCategory)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternFileName)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternVersion)}</td>
                          <td class="px-3 py-2">${renderTextValue(row.patternSoftwareName)}</td>
                          <td class="px-3 py-2">${renderPatternSizeSummary(row.selectedSizeCodes, row.sizeRange)}</td>
                          <td class="px-3 py-2 text-right">${renderTextValue(row.widthCm)}</td>
                          <td class="px-3 py-2 text-right">${renderTextValue(row.markerLengthM)}</td>
                          <td class="px-3 py-2 text-right">${renderTextValue(row.totalPieceCount)}</td>
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
      ${renderPatternPieceDetailTable(snapshot)}

      <div>
        <h4 class="mb-2 text-sm font-medium text-foreground">裁片部位</h4>
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[760px] text-sm">
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
                          <td class="px-3 py-2">${row.applicableColorList.length ? escapeHtml(row.applicableColorList.join('、')) : '<span class="text-muted-foreground">暂无数据</span>'}</td>
                          <td class="px-3 py-2">${row.applicableSizeList.length ? escapeHtml(row.applicableSizeList.join('、')) : '<span class="text-muted-foreground">暂无数据</span>'}</td>
                          <td class="px-3 py-2">${row.manualConfirmRequired ? '需要' : '不需要'}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[860px] text-sm">
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
                          <td class="px-3 py-2 font-medium">${escapeHtml(row.measurementPart)}</td>
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

function renderImageSection(snapshot: ProductionConfirmationSnapshot): string {
  const groups = [
    { title: '商品图片', items: snapshot.imageSnapshot.productImages },
    { title: '款式图片', items: snapshot.imageSnapshot.styleImages },
    { title: '样衣图片', items: snapshot.imageSnapshot.sampleImages },
    { title: '面料图片', items: snapshot.imageSnapshot.materialImages },
    { title: '辅料图片', items: snapshot.imageSnapshot.accessoryImages },
    { title: '纸样图片', items: snapshot.imageSnapshot.patternImages },
    { title: '唛架图', items: snapshot.imageSnapshot.markerImages },
    { title: '花型图', items: snapshot.imageSnapshot.artworkImages },
  ]

  return `<div class="grid gap-4 xl:grid-cols-2">${groups.map((group) => renderImageGroup(group.title, group.items)).join('')}</div>`
}

function renderConfirmationDocument(snapshot: ProductionConfirmationSnapshot, statusLabel: string, meta: {
  confirmationNo: string
  confirmationVersion: number
  printedAt?: string
  printedBy?: string
  historyCount: number
}): string {
  const orderInfo = snapshot.productionOrderSnapshot
  const styleInfo = snapshot.styleSnapshot
  const hasPostTask = snapshot.taskAssignmentSnapshot.some((item) => item.processName === '后道')

  return `
    <style>
      @media print {
        .print-actions { display: none !important; }
        .print-page {
          padding: 0 !important;
          background: #fff !important;
        }
        .print-sheet {
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
        }
      }
    </style>
    <div class="print-page space-y-4 bg-muted/20 p-4">
      <header class="print-actions flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">生产确认单</h1>
          <p class="mt-1 text-sm text-muted-foreground">工厂分配完成后可打印</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(snapshot.productionOrderId)}">返回</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onclick="window.print()">打印</button>
        </div>
      </header>

      <article class="print-sheet space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <section class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <h2 class="text-2xl font-semibold">生产确认单</h2>
              <p class="mt-2 text-sm text-muted-foreground">当前版本：V${escapeHtml(String(meta.confirmationVersion))}</p>
            </div>
            <div class="grid gap-2 text-sm text-right">
              <div>生产确认单号：<span class="font-mono font-medium">${escapeHtml(meta.confirmationNo)}</span></div>
              <div>生产单号：<span class="font-mono font-medium">${escapeHtml(snapshot.productionOrderNo)}</span></div>
              <div>确认单状态：<span class="font-medium">${escapeHtml(statusLabel)}</span></div>
              <div>历史版本：<span class="font-medium">${escapeHtml(String(meta.historyCount))}</span></div>
            </div>
          </div>
          ${renderKeyValueGrid([
            { label: '旧系统单号', value: renderTextValue(orderInfo.legacyOrderNo) },
            { label: '来源需求单号', value: orderInfo.sourceDemandNos.length ? escapeHtml(orderInfo.sourceDemandNos.join('、')) : '<span class="text-muted-foreground">暂无数据</span>' },
            { label: '打印时间', value: renderTextValue(meta.printedAt) },
            { label: '打印人', value: renderTextValue(meta.printedBy) },
          ])}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">生产单基本信息</h3>
          ${renderKeyValueGrid([
            { label: '款号', value: renderTextValue(styleInfo.styleCode) },
            { label: '款式名称', value: renderTextValue(styleInfo.styleName) },
            { label: 'SPU', value: renderTextValue(styleInfo.spuCode) },
            { label: '首单 / 翻单', value: renderTextValue(orderInfo.orderType) },
            { label: '要求交期', value: renderTextValue(orderInfo.requiredDeliveryDate) },
            { label: '计划开始', value: renderTextValue(orderInfo.plannedStartDate) },
            { label: '计划完成', value: renderTextValue(orderInfo.plannedFinishDate) },
            { label: '生产备注', value: renderTextValue(orderInfo.productionRemark) },
          ])}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">图片区</h3>
          ${renderImageSection(snapshot)}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">规格数量</h3>
          ${renderSizeQtyMatrix(snapshot)}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">面辅料信息</h3>
          ${renderBomTable(snapshot)}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">工序工艺任务分配</h3>
          ${renderTaskAssignmentTable(snapshot)}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">纸样和尺寸</h3>
          ${renderPatternSection(snapshot)}
        </section>

        <section class="space-y-3">
          <h3 class="text-lg font-semibold">补充说明</h3>
          ${
            snapshot.remarkSnapshot.length === 0
              ? hasPostTask
                ? `<div class="space-y-2">
                     <div class="rounded-lg border bg-card px-4 py-3 text-sm text-foreground">${escapeHtml(getPostIncludedRemark())}</div>
                   </div>`
                : '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无数据</div>'
              : `
                <div class="space-y-2">
                  ${snapshot.remarkSnapshot
                    .map(
                      (item) => `<div class="rounded-lg border bg-card px-4 py-3 text-sm text-foreground">${escapeHtml(item)}</div>`,
                    )
                    .join('')}
                  ${
                    hasPostTask
                      ? `<div class="rounded-lg border bg-card px-4 py-3 text-sm text-foreground">${escapeHtml(getPostIncludedRemark())}</div>`
                      : ''
                  }
                </div>
              `
          }
        </section>
      </article>
    </div>
  `
}

export function renderProductionConfirmationPrintPage(productionOrderId: string): string {
  const printableState = isProductionConfirmationPrintable(productionOrderId)
  const existingConfirmation = getProductionConfirmationByOrderId(productionOrderId)
  const confirmation = existingConfirmation
    || (printableState.printable ? getOrCreateProductionConfirmation(productionOrderId) : undefined)

  if (!confirmation) {
    return `
      <div class="space-y-4 p-4">
        <header class="flex items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">生产确认单</h1>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(productionOrderId)}">返回</button>
        </header>
        <section class="rounded-xl border bg-background p-6">
          <div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">${escapeHtml(printableState.reason || '未完成工厂分配')}</div>
        </section>
      </div>
    `
  }

  const snapshot = getProductionConfirmationSnapshotById(confirmation.snapshotId)
  if (!snapshot) {
    return `
      <div class="space-y-4 p-4">
        <header class="flex items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">生产确认单</h1>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/orders/${escapeHtml(productionOrderId)}">返回</button>
        </header>
        <section class="rounded-xl border bg-background p-6">
          <div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无数据</div>
        </section>
      </div>
    `
  }

  const historyCount = listProductionConfirmationsByOrderId(productionOrderId).length

  return renderConfirmationDocument(
    snapshot,
    productionConfirmationStatusLabels[confirmation.status],
    {
      confirmationNo: confirmation.confirmationNo,
      confirmationVersion: confirmation.confirmationVersion,
      printedAt: confirmation.printedAt,
      printedBy: confirmation.printedBy,
      historyCount,
    },
  )
}
