import { renderRealQrPlaceholder } from '../../components/real-qr.ts'
import {
  buildTaskDeliveryCardPrintDocByRecordId,
  TASK_DELIVERY_CARD_NAME,
  type TaskDeliveryCardLine,
  type TaskDeliveryCardPrintDoc,
} from '../../data/fcs/task-print-cards.ts'
import { escapeHtml } from '../../utils.ts'
import {
  getCurrentPrintSearchParams,
  renderFailure,
  renderImageSection,
  renderInfoGrid,
  renderPrintStyles,
} from './task-card-shared.ts'

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function resolveHandoverRecordId(handoverRecordIdParam?: string): string {
  if (handoverRecordIdParam) return decodeParam(handoverRecordIdParam)
  return getCurrentPrintSearchParams().get('handoverRecordId') || ''
}

function renderDeliveryLines(lines: TaskDeliveryCardLine[]): string {
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
              lines.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-3 py-6 text-center text-sm text-muted-foreground">当前交出记录暂无明细，已保留明细区。</td>
                  </tr>
                `
                : lines
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

function renderOptionalSection(title: string, rows: TaskDeliveryCardPrintDoc['writebackRows']): string {
  if (!rows || rows.length === 0) return ''
  return `
    <section class="space-y-3">
      <h3 class="text-lg font-semibold">${escapeHtml(title)}</h3>
      ${renderInfoGrid(rows)}
    </section>
  `
}

function renderDeliveryCard(doc: TaskDeliveryCardPrintDoc): string {
  const headerRows = doc.summaryRows.slice(0, 3)
  const summaryRows = doc.summaryRows.slice(3)

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
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onclick="window.print()">打印</button>
        </div>
      </header>

      <article class="print-sheet space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <section class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <h2 class="text-2xl font-semibold">${escapeHtml(doc.title)}</h2>
              <p class="mt-2 inline-flex rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">${escapeHtml(doc.deliverySequenceLabel)}</p>
            </div>
            <div class="grid gap-2 text-right text-sm">
              <div>交出单号：<span class="font-mono font-medium">${escapeHtml(doc.handoverOrderNo)}</span></div>
              <div>交货记录号：<span class="font-mono font-medium">${escapeHtml(doc.handoverRecordNo)}</span></div>
              <div>第几次交货：<span class="font-medium">${escapeHtml(doc.deliverySequenceLabel)}</span></div>
            </div>
          </div>
          ${renderInfoGrid(headerRows, ['交出单号', '交货记录号', '第几次交货'])}
        </section>

        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          ${renderImageSection({
            imageUrl: doc.imageUrl,
            imageLabel: doc.imageLabel,
            imageSourceLabel: doc.imageSourceLabel,
            title: doc.title,
          })}
          <section class="print-break-avoid space-y-3">
            <h3 class="text-lg font-semibold">二维码区</h3>
            <div class="rounded-lg border bg-white p-4 text-center">
              <div class="mx-auto inline-flex">
                ${renderRealQrPlaceholder({
                  value: doc.qrValue,
                  size: 188,
                  title: `${TASK_DELIVERY_CARD_NAME} ${doc.handoverRecordNo}`,
                  label: `${TASK_DELIVERY_CARD_NAME} ${doc.handoverRecordNo} 二维码`,
                  className: 'rounded-md border bg-white p-2',
                })}
              </div>
              <p class="mt-3 text-sm font-medium">任务交货二维码</p>
              <p class="mt-1 text-xs text-muted-foreground">绑定当前任务、交出单与本次交出记录</p>
            </div>
          </section>
        </div>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">交货摘要</h3>
          ${renderInfoGrid(summaryRows, ['任务编号', '生产单号', '本次交货数量'])}
        </section>

        ${renderDeliveryLines(doc.lineRows)}
        ${renderOptionalSection('接收方回写', doc.writebackRows)}
        ${renderOptionalSection('备注', doc.remarkRows)}
      </article>
    </div>
  `
}

export function renderTaskDeliveryCardPrintPage(_handoverOrderIdParam?: string, handoverRecordIdParam?: string): string {
  const handoverRecordId = resolveHandoverRecordId(handoverRecordIdParam)
  if (!handoverRecordId) {
    return renderFailure(
      {
        ok: false,
        title: TASK_DELIVERY_CARD_NAME,
        message: '缺少交出记录号，无法生成任务交货卡。',
      },
      '/fcs/progress/handover',
    )
  }

  try {
    const doc = buildTaskDeliveryCardPrintDocByRecordId(handoverRecordId)
    return renderDeliveryCard(doc)
  } catch (error) {
    return renderFailure(
      {
        ok: false,
        title: TASK_DELIVERY_CARD_NAME,
        message: error instanceof Error ? error.message : String(error),
      },
      '/fcs/progress/handover',
    )
  }
}
