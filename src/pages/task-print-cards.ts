import { renderRealQrPlaceholder } from '../components/real-qr.ts'
import {
  buildTaskDeliveryCardByRecord,
  buildTaskRouteCardBySource,
  isTaskRouteCardSourceType,
  TASK_DELIVERY_CARD_NAME,
  TASK_ROUTE_CARD_NAME,
  type TaskDeliveryCardLine,
  type TaskDeliveryCardModel,
  type TaskPrintBuildFailure,
  type TaskRouteCardModel,
  type TaskRouteCardRecordRow,
} from '../data/fcs/task-print-cards.ts'
import { escapeHtml } from '../utils.ts'

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function renderPrintStyles(): string {
  return `
    <style>
      @media print {
        .print-actions { display: none !important; }
        .print-page { padding: 0 !important; background: #fff !important; }
        .print-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; }
        .print-break-avoid { break-inside: avoid; }
      }
    </style>
  `
}

function renderFailure(failure: TaskPrintBuildFailure, backHref: string): string {
  return `
    ${renderPrintStyles()}
    <div class="print-page bg-muted/20 p-4">
      <header class="print-actions mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">${escapeHtml(failure.title)}打印预览</h1>
          <p class="mt-1 text-sm text-muted-foreground">当前单据无法生成</p>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(backHref)}">返回</button>
      </header>
      <article class="print-sheet rounded-xl border bg-background p-6 shadow-sm">
        <div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">${escapeHtml(failure.message)}</div>
      </article>
    </div>
  `
}

function renderTextValue(value: string | number | undefined | null, fallback = '待确认'): string {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return fallback ? `<span class="text-muted-foreground">${escapeHtml(fallback)}</span>` : ''
  }
  return escapeHtml(String(value))
}

function renderInfoGrid(rows: Array<{ label: string; value: string | number | undefined | null; strong?: boolean }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${rows
        .map(
          (row) => `
            <div class="rounded-lg border bg-card p-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(row.label)}</div>
              <div class="mt-1 text-sm ${row.strong ? 'font-semibold' : 'font-medium'}">${renderTextValue(row.value)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderCardImage(card: Pick<TaskRouteCardModel | TaskDeliveryCardModel, 'image'>): string {
  return `
    <section class="print-break-avoid space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold">图片区</h3>
        <span class="rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground">${escapeHtml(card.image.sourceLabel)}</span>
      </div>
      <figure class="overflow-hidden rounded-lg border bg-white">
        <img src="${escapeHtml(card.image.url)}" alt="${escapeHtml(card.image.title)}" class="h-64 w-full object-contain" />
        <figcaption class="border-t px-3 py-2 text-xs text-muted-foreground">${escapeHtml(card.image.title)}</figcaption>
      </figure>
    </section>
  `
}

function renderDeliveryLines(lines: TaskDeliveryCardLine[]): string {
  const rows = lines.length > 0 ? lines : []

  return `
    <section class="space-y-3">
      <h3 class="text-lg font-semibold">交出记录明细</h3>
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1120px] text-sm">
          <thead class="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              ${['类型', '物料/裁片/半成品', '物料编码 / SKU', '颜色', '尺码', '部位', '卷号 / 菲票号 / 包号', '本次交货数量', '单位']
                .map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-3 py-6 text-center text-sm text-muted-foreground">当前交出记录暂无明细，已保留明细区。</td>
                  </tr>
                `
                : rows
                    .map(
                      (line) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(line.objectTypeLabel)}</td>
                          <td class="px-3 py-2 font-medium">${escapeHtml(line.itemName)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.materialOrSku)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.color)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.size)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.partName)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.carrierNo)}</td>
                          <td class="px-3 py-2 text-right font-medium">${escapeHtml(String(line.submittedQty))}</td>
                          <td class="px-3 py-2">${escapeHtml(line.qtyUnit)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDeliveryCard(card: TaskDeliveryCardModel): string {
  return `
    ${renderPrintStyles()}
    <div class="print-page space-y-4 bg-muted/20 p-4">
      <header class="print-actions flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">${TASK_DELIVERY_CARD_NAME}打印预览</h1>
          <p class="mt-1 text-sm text-muted-foreground">一条交出记录打印一张${TASK_DELIVERY_CARD_NAME}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/progress/handover">返回交接链路</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onclick="window.print()">正式打印</button>
        </div>
      </header>

      <article class="print-sheet space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <section class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <h2 class="text-2xl font-semibold">${TASK_DELIVERY_CARD_NAME}</h2>
              <p class="mt-2 inline-flex rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">${escapeHtml(card.deliverySequenceLabel)}</p>
            </div>
            <div class="grid gap-2 text-right text-sm">
              <div>交出单号：<span class="font-mono font-medium">${escapeHtml(card.handoverOrderNo)}</span></div>
              <div>交货记录号：<span class="font-mono font-medium">${escapeHtml(card.handoverRecordNo)}</span></div>
              <div>当前状态：<span class="font-medium">${escapeHtml(card.statusLabel)}</span></div>
            </div>
          </div>
          ${renderInfoGrid([
            { label: '当前任务号', value: card.taskNo, strong: true },
            { label: '当前生产单号', value: card.productionOrderNo, strong: true },
            { label: '工序 / 工艺', value: `${card.processName} / ${card.craftName}` },
            { label: '本次交货数量', value: `${card.submittedQty} ${card.qtyUnit}`, strong: true },
            { label: '上游工厂', value: card.upstreamFactoryName },
            { label: '下游工厂', value: card.downstreamFactoryName },
            { label: '交货时间', value: card.submittedAt },
            { label: '提交人', value: card.submittedBy },
          ])}
        </section>

        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          ${renderCardImage(card)}
          <section class="print-break-avoid space-y-3">
            <h3 class="text-lg font-semibold">二维码</h3>
            <div class="rounded-lg border bg-white p-4 text-center">
              <div class="mx-auto inline-flex">
                ${renderRealQrPlaceholder({
                  value: card.qrValue,
                  size: 188,
                  title: `${TASK_DELIVERY_CARD_NAME} ${card.handoverRecordNo}`,
                  label: `${TASK_DELIVERY_CARD_NAME} ${card.handoverRecordNo} 二维码`,
                  className: 'rounded-md border bg-white p-2',
                })}
              </div>
              <p class="mt-3 text-sm font-medium">任务交货二维码</p>
              <p class="mt-1 text-xs text-muted-foreground">绑定当前任务、交出单与本次交出记录</p>
            </div>
          </section>
        </div>

        ${renderDeliveryLines(card.lines)}

        <section class="space-y-3">
          <h3 class="text-lg font-semibold">备注</h3>
          <div class="rounded-lg border bg-card px-4 py-3 text-sm">${escapeHtml(card.remark)}</div>
        </section>
      </article>
    </div>
  `
}

function padRouteRows(rows: TaskRouteCardRecordRow[]): TaskRouteCardRecordRow[] {
  const minRows = 8
  if (rows.length >= minRows) return rows
  const appended = Array.from({ length: minRows - rows.length }, (_, index) => ({
    rowId: `EMPTY-${index + 1}`,
    node: '',
    startedAt: '',
    finishedAt: '',
    completedQty: '',
    exceptionQty: '',
    station: '',
    operator: '',
    remark: '',
  }))
  return [...rows, ...appended]
}

function renderRouteRecordTable(rows: TaskRouteCardRecordRow[]): string {
  return `
    <section class="space-y-3">
      <h3 class="text-lg font-semibold">流转记录表</h3>
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1180px] text-sm">
          <thead class="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              ${['节点', '开始时间', '结束时间', '完成数量', '异常数量', '设备/工位', '操作人', '备注', '签字']
                .map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${padRouteRows(rows)
              .map(
                (row) => `
                  <tr class="h-12 border-b last:border-0">
                    <td class="px-3 py-2 font-medium">${renderTextValue(row.node, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.startedAt, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.finishedAt, '')}</td>
                    <td class="px-3 py-2 text-right">${renderTextValue(row.completedQty, '')}</td>
                    <td class="px-3 py-2 text-right">${renderTextValue(row.exceptionQty, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.station, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.operator, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.remark, '')}</td>
                    <td class="px-3 py-2"></td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderRouteCard(card: TaskRouteCardModel): string {
  return `
    ${renderPrintStyles()}
    <div class="print-page space-y-4 bg-muted/20 p-4">
      <header class="print-actions flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">${TASK_ROUTE_CARD_NAME}打印预览</h1>
          <p class="mt-1 text-sm text-muted-foreground">来源：${escapeHtml(card.sourceLabel)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/progress/board">返回任务进度看板</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onclick="window.print()">正式打印</button>
        </div>
      </header>

      <article class="print-sheet space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <section class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <h2 class="text-2xl font-semibold">${TASK_ROUTE_CARD_NAME}</h2>
              <p class="mt-2 text-sm text-muted-foreground">任务级单据，随任务执行链路流转。</p>
            </div>
            <div class="grid gap-2 text-right text-sm">
              <div>任务编号：<span class="font-mono font-medium">${escapeHtml(card.taskNo)}</span></div>
              <div>生产单号：<span class="font-mono font-medium">${escapeHtml(card.productionOrderNo)}</span></div>
              <div>状态：<span class="font-medium">${escapeHtml(card.statusLabel)}</span></div>
            </div>
          </div>
        </section>

        ${renderCardImage(card)}

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">任务摘要区</h3>
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
            ${renderInfoGrid([
              { label: '任务编号', value: card.taskNo, strong: true },
              { label: '生产单号', value: card.productionOrderNo, strong: true },
              { label: '工序', value: card.processName },
              { label: '工艺', value: card.craftName },
              { label: '工厂', value: card.factoryName },
              { label: '状态', value: card.statusLabel },
              { label: '计划数量', value: card.plannedQty, strong: true },
              { label: '单位', value: card.qtyUnit },
              { label: '交期', value: card.dueAt },
            ])}
            <div class="rounded-lg border bg-white p-4 text-center">
              <div class="mx-auto inline-flex">
                ${renderRealQrPlaceholder({
                  value: card.qrValue,
                  size: 176,
                  title: `${TASK_ROUTE_CARD_NAME} ${card.taskNo}`,
                  label: `${TASK_ROUTE_CARD_NAME} ${card.taskNo} 二维码`,
                  className: 'rounded-md border bg-white p-2',
                })}
              </div>
              <p class="mt-3 text-sm font-medium">任务二维码</p>
              <p class="mt-1 text-xs text-muted-foreground">绑定当前任务详情与执行链路</p>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">任务补充信息区</h3>
          ${renderInfoGrid(card.supplementalItems.map((item) => ({ label: item.label, value: item.value })))}
          <div class="rounded-lg border bg-card px-4 py-3 text-sm">${escapeHtml(card.summaryRemark)}</div>
        </section>

        ${renderRouteRecordTable(card.routeRecords)}
      </article>
    </div>
  `
}

export function renderTaskDeliveryCardPrintPage(handoverOrderId: string, handoverRecordId: string): string {
  const result = buildTaskDeliveryCardByRecord(decodeParam(handoverOrderId), decodeParam(handoverRecordId))
  if (!result.ok) return renderFailure(result, '/fcs/progress/handover')
  return renderDeliveryCard(result.card)
}

export function renderTaskRouteCardPrintPage(sourceTypeParam: string, sourceIdParam: string): string {
  const sourceType = decodeParam(sourceTypeParam)
  if (!isTaskRouteCardSourceType(sourceType)) {
    return renderFailure(
      {
        ok: false,
        title: TASK_ROUTE_CARD_NAME,
        message: `未识别的打印来源：${sourceType}`,
      },
      '/fcs/progress/board',
    )
  }

  const result = buildTaskRouteCardBySource(sourceType, decodeParam(sourceIdParam))
  if (!result.ok) return renderFailure(result, '/fcs/progress/board')
  return renderRouteCard(result.card)
}
