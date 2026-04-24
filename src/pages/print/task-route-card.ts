import { renderRealQrPlaceholder } from '../../components/real-qr.ts'
import {
  buildTaskRouteCardPrintDoc,
  isTaskRouteCardSourceType,
  TASK_ROUTE_CARD_NAME,
  type TaskRouteCardPrintDoc,
} from '../../data/fcs/task-print-cards.ts'
import { escapeHtml } from '../../utils.ts'
import {
  getCurrentPrintSearchParams,
  renderFailure,
  renderImageSection,
  renderInfoGrid,
  renderPrintStyles,
  renderRouteRecordTable,
} from './task-card-shared.ts'

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function resolveSourceParams(sourceTypeParam?: string, sourceIdParam?: string): {
  sourceType: string
  sourceId: string
} {
  const params = getCurrentPrintSearchParams()
  return {
    sourceType: sourceTypeParam ? decodeParam(sourceTypeParam) : params.get('sourceType') || '',
    sourceId: sourceIdParam ? decodeParam(sourceIdParam) : params.get('sourceId') || '',
  }
}

function renderRouteCard(doc: TaskRouteCardPrintDoc): string {
  const sourceLabel: Record<TaskRouteCardPrintDoc['sourceType'], string> = {
    RUNTIME_TASK: '任务进度看板任务',
    PRINTING_WORK_ORDER: '印花加工单',
    DYEING_WORK_ORDER: '染色加工单',
    SPECIAL_CRAFT_TASK_ORDER: '特殊工艺任务单',
    CUTTING_ORIGINAL_ORDER: '原始裁片单',
    CUTTING_MERGE_BATCH: '裁片批次',
  }

  return `
    ${renderPrintStyles()}
    <div class="print-page space-y-4 bg-muted/20 p-4">
      <header class="print-actions flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">${TASK_ROUTE_CARD_NAME}打印预览</h1>
          <p class="mt-1 text-sm text-muted-foreground">任务级单据，随任务执行链路流转。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/progress/board">返回任务进度看板</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onclick="window.print()">打印</button>
        </div>
      </header>

      <article class="print-sheet space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <section class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <h2 class="text-2xl font-semibold">${escapeHtml(doc.title)}</h2>
              <p class="mt-2 text-sm text-muted-foreground">来源：${escapeHtml(sourceLabel[doc.sourceType])}</p>
            </div>
            <div class="grid gap-2 text-right text-sm">
              <div>任务编号：<span class="font-mono font-medium">${escapeHtml(doc.taskNo || '待确认')}</span></div>
              <div>生产单号：<span class="font-mono font-medium">${escapeHtml(doc.productionOrderNo || '待确认')}</span></div>
              <div>状态：<span class="font-medium">${escapeHtml(doc.statusLabel)}</span></div>
            </div>
          </div>
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
                  title: `${TASK_ROUTE_CARD_NAME} ${doc.taskNo || doc.sourceId}`,
                  label: `${TASK_ROUTE_CARD_NAME} ${doc.taskNo || doc.sourceId} 二维码`,
                  className: 'rounded-md border bg-white p-2',
                })}
              </div>
              <p class="mt-3 text-sm font-medium">任务二维码</p>
              <p class="mt-1 text-xs text-muted-foreground">绑定当前任务详情与执行链路</p>
            </div>
          </section>
        </div>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">任务摘要区</h3>
          ${renderInfoGrid(doc.summaryRows, ['任务编号', '生产单号', '计划数量'])}
        </section>

        <section class="space-y-4">
          <h3 class="text-lg font-semibold">任务补充信息区</h3>
          ${renderInfoGrid(doc.extraRows)}
        </section>

        ${renderRouteRecordTable(doc.nodeRows)}
      </article>
    </div>
  `
}

export function renderTaskRouteCardPrintPage(sourceTypeParam?: string, sourceIdParam?: string): string {
  const { sourceType, sourceId } = resolveSourceParams(sourceTypeParam, sourceIdParam)
  if (!isTaskRouteCardSourceType(sourceType)) {
    return renderFailure(
      {
        ok: false,
        title: TASK_ROUTE_CARD_NAME,
        message: `未识别的打印来源：${sourceType || '空'}`,
      },
      '/fcs/progress/board',
    )
  }

  try {
    const doc = buildTaskRouteCardPrintDoc({ sourceType, sourceId })
    return renderRouteCard(doc)
  } catch (error) {
    return renderFailure(
      {
        ok: false,
        title: TASK_ROUTE_CARD_NAME,
        message: error instanceof Error ? error.message : String(error),
      },
      '/fcs/progress/board',
    )
  }
}
