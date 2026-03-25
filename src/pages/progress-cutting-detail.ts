import type { PlatformCuttingDetailIssueItem } from '../domain/cutting-platform/detail.adapter'
import { buildPlatformCuttingDetailView } from '../domain/cutting-platform/detail.adapter'
import {
  buildPlatformCuttingDetailRoute,
} from '../domain/cutting-platform/detail.helpers'
import {
  platformCuttingRiskMeta,
  platformCuttingStageMeta,
  platformCuttingUrgencyMeta,
} from '../domain/cutting-platform/overview.helpers'
import { appStore } from '../state/store'
import { escapeHtml, formatDateTime } from '../utils'

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderIssueCard(issue: PlatformCuttingDetailIssueItem): string {
  return `
    <article class="rounded-lg border p-4">
      <div class="flex flex-wrap items-center gap-2">
        ${renderBadge(platformCuttingRiskMeta[issue.level].label, platformCuttingRiskMeta[issue.level].className)}
        ${renderBadge(issue.sourceLabel, 'bg-slate-100 text-slate-700')}
      </div>
      <h3 class="mt-3 font-semibold text-foreground">${escapeHtml(issue.title)}</h3>
      <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(issue.description)}</p>
      <p class="mt-3 text-xs text-muted-foreground">建议动作：${escapeHtml(issue.suggestedAction)}</p>
      <div class="mt-4">
        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-platform-cutting-detail-action="go-route" data-route="${issue.suggestedRoute}">
          去对应页面
        </button>
      </div>
    </article>
  `
}

function renderNotApplicable(): string {
  return `
    <div class="space-y-6 p-6">
      <header class="space-y-3">
        <h1 class="text-2xl font-bold">裁片任务详情</h1>
      </header>
      <section class="rounded-lg border bg-card p-6">
        <p class="text-sm text-muted-foreground">未找到对应的裁片任务详情，请返回裁片任务总览重新选择需要查看的记录。</p>
        <div class="mt-4">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-overview">返回裁片任务总览</button>
        </div>
      </section>
    </div>
  `
}

function renderPageHeader(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return renderNotApplicable()
  const { row } = detail

  return `
    <header class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">裁片任务详情</h1>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-overview">返回裁片任务总览</button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${renderBadge(platformCuttingUrgencyMeta[row.urgencyLevel].label, platformCuttingUrgencyMeta[row.urgencyLevel].className)}
        ${renderBadge(platformCuttingStageMeta[row.currentStage].label, platformCuttingStageMeta[row.currentStage].className)}
        ${renderBadge(platformCuttingRiskMeta[row.overallRiskLevel].label, platformCuttingRiskMeta[row.overallRiskLevel].className)}
      </div>
    </header>
  `
}

function renderBasicInfo(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''
  const { row } = detail

  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">基础信息</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5 text-sm">
        <div>
          <p class="text-xs text-muted-foreground">生产单号</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.productionOrderNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">裁片任务号</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">采购日期</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.purchaseDate)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">下单数量</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(String(row.orderQty))}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">计划发货日期</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.plannedShipDate)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前分配工厂</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.assignedFactoryName)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前阶段</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(platformCuttingStageMeta[row.currentStage].label)}</p>
        </div>
        <div class="md:col-span-2">
          <p class="text-xs text-muted-foreground">平台阶段摘要</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.platformStageSummary)}</p>
        </div>
        <div class="md:col-span-2">
          <p class="text-xs text-muted-foreground">最近更新时间 / 来源</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(row.record.lastUpdatedAt))} · ${escapeHtml(row.record.lastUpdatedSource === 'PLATFORM' ? '平台侧' : row.record.lastUpdatedSource === 'PCS' ? 'PCS' : '工厂端')}</p>
        </div>
      </div>
    </section>
  `
}

function renderChainProgress(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">链路进度摘要</h2>
          <p class="mt-1 text-sm text-muted-foreground">按平台视角拆解配料 / 领料、裁片执行、补料、仓务和样衣五段摘要。</p>
        </div>
        <span class="text-sm text-muted-foreground">${escapeHtml(detail.latestFactoryActionText)}</span>
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-5">
        ${detail.chainSections
          .map(
            (section) => `
              <article class="rounded-lg border bg-muted/20 p-4">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="font-medium text-foreground">${escapeHtml(section.title)}</h3>
                  <span class="text-xs text-muted-foreground">${escapeHtml(section.statusLabel)}</span>
                </div>
                <p class="mt-3 text-sm text-foreground">${escapeHtml(section.summaryText)}</p>
                <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(section.latestActionText)}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  ${
                    section.riskTags.length
                      ? section.riskTags
                          .map((tag) => renderBadge(tag, 'bg-slate-100 text-slate-700'))
                          .join('')
                      : '<span class="text-xs text-muted-foreground">当前无额外风险标签</span>'
                  }
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderPickupSection(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''
  const { row } = detail

  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">领料与单据摘要</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm">
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">领料单号</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.pickupSummary.pickupSlipNo)}</p>
          <p class="mt-2 text-xs text-muted-foreground">最新打印版本：${escapeHtml(row.pickupSummary.latestPrintVersionNo)}</p>
          <p class="mt-1 text-xs text-muted-foreground">已打印次数：${row.pickupSummary.printCopyCount}</p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">裁片单主码 / 扫描结果</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.pickupSummary.qrStatus)} · ${escapeHtml(row.pickupSummary.latestResultLabel)}</p>
          <p class="mt-2 text-xs text-muted-foreground">最近扫码：${escapeHtml(row.pickupSummary.latestScannedAt)}</p>
          <p class="mt-1 text-xs text-muted-foreground">扫码人：${escapeHtml(row.pickupSummary.latestScannedBy)}</p>
          <p class="mt-1 text-xs text-muted-foreground">回执状态：${escapeHtml(row.pickupSummary.receiptStatusLabel)}</p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">复核与凭证</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${row.pickupSummary.needsRecheck ? renderBadge('需复核', 'bg-amber-50 text-amber-700') : renderBadge('无需复核', 'bg-emerald-50 text-emerald-700')}
            ${row.pickupSummary.hasPhotoEvidence ? renderBadge('有照片凭证', 'bg-blue-50 text-blue-700') : renderBadge('无照片凭证', 'bg-slate-100 text-slate-700')}
          </div>
          <p class="mt-3 text-xs text-muted-foreground">${escapeHtml(row.pickupSummary.summaryText)}</p>
        </article>
      </div>
    </section>
  `
}

function renderExecutionSection(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''
  const { row } = detail

  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">执行摘要</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm">
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">裁片单与唛架</p>
          <p class="mt-1 font-medium text-foreground">裁片单 ${row.record.cutPieceOrderCount} 张 · 唛架已维护 ${row.record.markerSummary.markerMaintainedCount} 张</p>
          <p class="mt-2 text-xs text-muted-foreground">唛架图已上传 ${row.record.markerSummary.markerImageUploadedCount} 张</p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">铺布记录</p>
          <p class="mt-1 font-medium text-foreground">${row.record.spreadingSummary.spreadingRecordCount} 条 · 总长度 ${escapeHtml(String(row.record.spreadingSummary.totalSpreadLength))}</p>
          <p class="mt-2 text-xs text-muted-foreground">
            最近铺布：${row.record.spreadingSummary.latestSpreadingAt ? escapeHtml(row.record.spreadingSummary.latestSpreadingAt) : '暂无'}${row.record.spreadingSummary.latestSpreadingBy ? ` · ${escapeHtml(row.record.spreadingSummary.latestSpreadingBy)}` : ''}
          </p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">当前执行进度说明</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(row.executionSummaryText)}</p>
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.platformStageSummary)}</p>
        </article>
      </div>
    </section>
  `
}

function renderReplenishmentSection(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''
  const { row } = detail

  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">补料摘要</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm">
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">补料建议</p>
          <p class="mt-1 font-medium text-foreground">建议 ${row.record.replenishmentSummary.suggestionCount} 条</p>
          <p class="mt-2 text-xs text-muted-foreground">待审核 ${row.record.replenishmentSummary.pendingReviewCount} · 已通过 ${row.record.replenishmentSummary.approvedCount} · 已驳回 ${row.record.replenishmentSummary.rejectedCount}</p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">高风险与补充说明</p>
          <p class="mt-1 font-medium text-foreground">高风险 ${row.record.replenishmentSummary.highRiskCount} 条</p>
          <p class="mt-2 text-xs text-muted-foreground">待补充说明 ${row.record.replenishmentSummary.needMoreInfoCount} 条</p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">影响摘要</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${row.record.replenishmentSummary.mayAffectPrintingCount > 0 ? renderBadge('可能影响印花', 'bg-fuchsia-50 text-fuchsia-700') : ''}
            ${row.record.replenishmentSummary.mayAffectDyeingCount > 0 ? renderBadge('可能影响染色', 'bg-sky-50 text-sky-700') : ''}
            ${row.record.replenishmentSummary.mayAffectPrintingCount === 0 && row.record.replenishmentSummary.mayAffectDyeingCount === 0 ? renderBadge('当前无跨工艺影响', 'bg-emerald-50 text-emerald-700') : ''}
          </div>
        </article>
      </div>
    </section>
  `
}

function renderWarehouseSection(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''
  const { row } = detail

  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">仓务与样衣摘要</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm">
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">入仓状态</p>
          <p class="mt-1 font-medium text-foreground">待入仓 ${row.record.warehouseSummary.cutPiecePendingInboundCount} · 已入仓 ${row.record.warehouseSummary.cutPieceInboundedCount}</p>
          <p class="mt-2 text-xs text-muted-foreground">未分配区域 ${row.record.warehouseSummary.unassignedZoneCount}</p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">交接状态</p>
          <p class="mt-1 font-medium text-foreground">待发后道 ${row.record.warehouseSummary.waitingHandoverCount} · 已交接 ${row.record.warehouseSummary.handedOverCount}</p>
          <p class="mt-2 text-xs text-muted-foreground">
            最近入仓：${row.record.warehouseSummary.latestInboundAt ? escapeHtml(row.record.warehouseSummary.latestInboundAt) : '暂无'}${row.record.warehouseSummary.latestInboundBy ? ` · ${escapeHtml(row.record.warehouseSummary.latestInboundBy)}` : ''}
          </p>
        </article>
        <article class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">样衣摘要</p>
          <p class="mt-1 font-medium text-foreground">使用中 ${row.record.sampleSummary.sampleInUseCount} · 待归还 ${row.record.sampleSummary.sampleWaitingReturnCount}</p>
          <p class="mt-2 text-xs text-muted-foreground">超期风险 ${row.record.sampleSummary.overdueReturnCount} · 可调用 ${row.record.sampleSummary.sampleAvailableCount}</p>
        </article>
      </div>
    </section>
  `
}

function renderIssueSection(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">问题清单</h2>
          <p class="mt-1 text-sm text-muted-foreground">按来源页面和风险等级拆解当前裁片任务的关键问题。</p>
        </div>
        <span class="text-sm text-muted-foreground">异常种子 ${detail.suggestedExceptionSeedCount} 项</span>
      </div>
      <div class="mt-4 space-y-4">
        ${
          detail.issues.length
            ? detail.issues.map((issue) => renderIssueCard(issue)).join('')
            : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">当前没有待跟进的问题项，裁片任务已接近收口。</div>'
        }
      </div>
    </section>
  `
}

function renderAttentionSection(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return ''

  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">平台关注提示</h2>
      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        ${detail.attentionItems
          .map(
            (item) => `
              <article class="rounded-lg border bg-muted/20 p-4">
                <div class="flex items-center gap-2">
                  ${renderBadge(platformCuttingRiskMeta[item.level].label, platformCuttingRiskMeta[item.level].className)}
                  <h3 class="font-medium text-foreground">${escapeHtml(item.title)}</h3>
                </div>
                <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(item.description)}</p>
                <p class="mt-3 text-xs text-muted-foreground">建议关注：${escapeHtml(item.suggestedFollowUp)}</p>
              </article>
            `,
          )
          .join('')}
      </div>
      <div class="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        后续步骤会在这里继续衔接异常中心与结算 / 评分输入，本步只做只读提示，不新增平台工作流。
      </div>
    </section>
  `
}

function renderQuickLinks(): string {
  return `
    <section class="rounded-lg border bg-card p-5">
      <h2 class="text-base font-semibold text-foreground">快捷跳转区</h2>
      <div class="mt-4 flex flex-wrap gap-2">
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-order-progress">去订单进度</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-material-prep">去仓库配料</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-cut-piece-orders">去裁片单</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-replenishment">去补料管理</button>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-platform-cutting-detail-action="go-warehouse-management">去仓库管理</button>
      </div>
    </section>
  `
}

export function renderProgressCuttingDetailPage(recordId: string): string {
  const detail = buildPlatformCuttingDetailView(recordId)
  if (!detail) return renderNotApplicable()

  return `
    <div class="space-y-6 p-6">
      ${renderPageHeader(recordId)}
      ${renderBasicInfo(recordId)}
      ${renderChainProgress(recordId)}
      ${renderPickupSection(recordId)}
      ${renderExecutionSection(recordId)}
      ${renderReplenishmentSection(recordId)}
      ${renderWarehouseSection(recordId)}
      ${renderIssueSection(recordId)}
      ${renderAttentionSection(recordId)}
      ${renderQuickLinks()}
    </div>
  `
}

export function handleProgressCuttingDetailEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-platform-cutting-detail-action]')
  const action = actionNode?.dataset.platformCuttingDetailAction
  if (!action) return false

  const route = actionNode?.dataset.route ?? ''

  if (action === 'go-overview') {
    appStore.navigate('/fcs/progress/cutting-overview')
    return true
  }

  if (action === 'go-route' && route) {
    appStore.navigate(route)
    return true
  }

  if (action === 'go-order-progress') {
    appStore.navigate('/fcs/craft/cutting/order-progress')
    return true
  }

  if (action === 'go-material-prep') {
    appStore.navigate('/fcs/craft/cutting/material-prep')
    return true
  }

  if (action === 'go-cut-piece-orders') {
    appStore.navigate('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  if (action === 'go-replenishment') {
    appStore.navigate('/fcs/craft/cutting/replenishment')
    return true
  }

  if (action === 'go-warehouse-management') {
    appStore.navigate('/fcs/craft/cutting/warehouse-management')
    return true
  }

  return false
}

export function extractProgressCuttingDetailId(pathname: string): string {
  const matched = /^\/fcs\/progress\/cutting-overview\/([^/]+)$/.exec(pathname.split('?')[0].split('#')[0])
  return matched?.[1] ?? ''
}
