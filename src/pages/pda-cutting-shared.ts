import { escapeHtml } from '../utils'
import {
  buildPdaCuttingRoute,
  getPdaCuttingTaskDetail,
  getPdaTaskFlowTaskById,
  type PdaCuttingTaskDetailData,
  type PdaTaskFlowMock,
} from '../data/fcs/pda-cutting-special'
import { renderPdaFrame, type PdaTabKey } from './pda-shell'

interface CuttingSummaryItem {
  label: string
  value: string
  hint?: string
}

interface CuttingPageLayoutOptions {
  taskId: string
  title: string
  subtitle: string
  activeTab: PdaTabKey
  body: string
  backHref?: string
}

export interface PdaCuttingPageContext {
  task: PdaTaskFlowMock
  detail: PdaCuttingTaskDetailData
}

function renderChip(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

export function getPdaCuttingPageContext(taskId: string): PdaCuttingPageContext | null {
  const task = getPdaTaskFlowTaskById(taskId)
  const detail = getPdaCuttingTaskDetail(taskId)

  if (!task || !detail) return null

  return { task, detail }
}

export function renderPdaCuttingSummaryGrid(items: CuttingSummaryItem[]): string {
  return `
    <section class="grid grid-cols-2 gap-3">
      ${items
        .map(
          (item) => `
            <article class="rounded-xl border bg-card px-3 py-3 shadow-sm">
              <div class="text-xs text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-2 text-sm font-semibold text-foreground">${escapeHtml(item.value)}</div>
              ${item.hint ? `<div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</div>` : ''}
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

export function renderPdaCuttingSection(title: string, _description: string, content: string): string {
  return `
    <section class="rounded-2xl border bg-card shadow-sm">
      <header class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </header>
      <div class="px-4 py-4">${content}</div>
    </section>
  `
}

export function renderPdaCuttingEmptyState(title: string, _description: string): string {
  return `
    <section class="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center">
      <div class="text-sm font-medium text-foreground">${escapeHtml(title)}</div>
    </section>
  `
}

export function renderPdaCuttingTaskHero(detail: PdaCuttingTaskDetailData): string {
  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">裁片任务</div>
          <div class="text-lg font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
          <div class="text-xs text-muted-foreground">生产单 ${escapeHtml(detail.productionOrderNo)} / 裁片单 ${escapeHtml(detail.cutPieceOrderNo)}</div>
        </div>
        ${renderChip(detail.currentStage, 'border-blue-200 bg-blue-50 text-blue-700')}
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div class="rounded-xl bg-muted/40 px-3 py-3">
          <div class="text-muted-foreground">面料信息</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.materialSku)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.materialTypeLabel)}</div>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-3">
          <div class="text-muted-foreground">裁片单主码摘要</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.qrCodeValue)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.qrVersionNote)}</div>
        </div>
      </div>
    </section>
  `
}

export function renderPdaCuttingRiskList(riskTips: string[]): string {
  if (!riskTips.length) {
    return renderPdaCuttingEmptyState('当前无专项风险提示', '裁片专项页会在这里展示扫码、铺布、入仓和交接过程中的重点风险。')
  }

  return `
    <div class="space-y-2">
      ${riskTips
        .map(
          (tip) => `
            <div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
              ${escapeHtml(tip)}
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

export function renderPdaCuttingPageLayout(options: CuttingPageLayoutOptions): string {
  const context = getPdaCuttingPageContext(options.taskId)
  const backHref = options.backHref ?? '/fcs/pda/exec'

  if (!context) {
    return renderPdaFrame(
      `
        <section class="space-y-4 px-4 py-4">
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(backHref)}">
            返回
          </button>
          ${renderPdaCuttingEmptyState('未找到裁片任务', '当前任务不存在或不属于裁片专项任务，请返回工厂端任务流重新进入。')}
        </section>
      `,
      options.activeTab,
    )
  }

  const { detail } = context

  return renderPdaFrame(
    `
      <section class="space-y-4 px-4 py-4">
        <header class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(backHref)}">
              返回
            </button>
            ${renderChip(detail.taskTypeLabel, 'border-slate-200 bg-slate-50 text-slate-700')}
          </div>
          <div>
            <h1 class="text-xl font-semibold text-foreground">${escapeHtml(options.title)}</h1>
          </div>
        </header>
        ${options.body}
      </section>
    `,
    options.activeTab,
  )
}

export function renderPdaCuttingQuickLinks(taskId: string, options?: { includeTaskDetail?: boolean }): string {
  const links = [
    options?.includeTaskDetail !== false
      ? { label: '返回裁片任务详情', href: buildPdaCuttingRoute(taskId, 'task') }
      : null,
    { label: '扫裁片单主码领料', href: buildPdaCuttingRoute(taskId, 'pickup') },
    { label: '铺布录入', href: buildPdaCuttingRoute(taskId, 'spreading') },
    { label: '入仓扫码', href: buildPdaCuttingRoute(taskId, 'inbound') },
    { label: '交接扫码', href: buildPdaCuttingRoute(taskId, 'handover') },
    { label: '补料反馈', href: buildPdaCuttingRoute(taskId, 'replenishment-feedback') },
  ].filter(Boolean) as Array<{ label: string; href: string }>

  return `
    <div class="grid grid-cols-2 gap-2">
      ${links
        .map(
          (link) => `
            <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted" data-nav="${escapeHtml(link.href)}">
              ${escapeHtml(link.label)}
            </button>
          `,
        )
        .join('')}
    </div>
  `
}
