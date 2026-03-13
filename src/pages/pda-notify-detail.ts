import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { initialNotifications, type Notification } from '../data/fcs/store-domain-progress'
import { renderPdaFrame } from './pda-shell'

const TYPE_LABELS: Record<string, string> = {
  NEW_TASK: '新派单通知',
  TENDER_BID: '报价提醒',
  TENDER_AWARDED: '中标通知',
  HANDOVER: '交接提醒',
  EXEC_RISK: '执行风险提醒',
  QUALITY: '质量/争议提醒',
  SETTLEMENT: '结算提醒',
}

const SOURCE_LABELS: Record<string, string> = {
  接单: '接单',
  执行: '执行',
  交接: '交接',
  结算: '结算',
  系统: '系统',
}

const NEEDS_EVIDENCE_TYPES = new Set(['HANDOVER', 'QUALITY'])

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function buildPath(path: string, query?: Record<string, string>): string {
  if (!query) return path
  const search = new URLSearchParams(query).toString()
  return search ? `${path}?${search}` : path
}

function markNotificationRead(notificationId: string): void {
  const index = initialNotifications.findIndex((item) => item.notificationId === notificationId)
  if (index < 0) return

  const current = initialNotifications[index]
  if (current.readAt) return

  initialNotifications[index] = {
    ...current,
    readAt: nowTimestamp(),
  }
}

function renderLevelBadge(level: Notification['level']): string {
  if (level === 'CRITICAL') {
    return '<span class="inline-flex h-4 items-center rounded bg-destructive px-1.5 py-0 text-[10px] text-destructive-foreground">紧急</span>'
  }

  if (level === 'WARN') {
    return '<span class="inline-flex h-4 items-center rounded bg-amber-500 px-1.5 py-0 text-[10px] text-white">警告</span>'
  }

  return '<span class="inline-flex h-4 items-center rounded bg-secondary px-1.5 py-0 text-[10px] text-secondary-foreground">通知</span>'
}

export function renderPdaNotifyDetailPage(notificationId: string): string {
  const found = initialNotifications.find((item) => item.notificationId === notificationId)

  if (!found) {
    const content = `
      <div class="flex min-h-[760px] flex-col bg-muted/30">
        <header class="sticky top-0 z-20 border-b bg-background px-4 py-3">
          <button class="inline-flex items-center gap-1 text-sm text-muted-foreground" data-pda-notify-detail-action="back">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
            返回
          </button>
        </header>

        <div class="px-4 py-16 text-center text-muted-foreground">
          <i data-lucide="alert-circle" class="mx-auto mb-2 h-10 w-10 opacity-30"></i>
          <p class="text-sm">通知不存在或已删除</p>
        </div>
      </div>
    `
    return renderPdaFrame(content, 'notify')
  }

  if (!found.readAt) {
    markNotificationRead(notificationId)
  }

  const notification = initialNotifications.find((item) => item.notificationId === notificationId) || found
  const n = notification as Notification & {
    notificationType?: string
    sourceModule?: string
    body?: string
    actionLabel?: string
  }

  const notifType = n.notificationType || 'NEW_TASK'
  const sourceModule = n.sourceModule || '系统'
  const isRead = !!notification.readAt
  const needsEvidence = NEEDS_EVIDENCE_TYPES.has(notifType)
  const related = n.related as (typeof n.related & { settlementId?: string }) | undefined

  const relatedItems: Array<{ label: string; value: string }> = []
  if (related?.taskId) relatedItems.push({ label: '任务编号', value: related.taskId })
  if (related?.tenderId) relatedItems.push({ label: '招标单号', value: related.tenderId })
  if (related?.productionOrderId) relatedItems.push({ label: '生产单号', value: related.productionOrderId })
  if (related?.handoverEventId) relatedItems.push({ label: '交接事件号', value: related.handoverEventId })
  if (related?.settlementId) relatedItems.push({ label: '结算周期号', value: related.settlementId })
  if (related?.caseId) relatedItems.push({ label: '异常单号', value: related.caseId })

  const actionHref = n.deepLink?.path ? buildPath(n.deepLink.path, n.deepLink.query) : ''

  const content = `
    <div class="flex min-h-[760px] flex-col bg-muted/30">
      <header class="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-4 py-3">
        <button
          class="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="返回"
          data-pda-notify-detail-action="back"
        >
          <i data-lucide="arrow-left" class="h-5 w-5"></i>
        </button>
        <h1 class="flex-1 truncate text-base font-semibold">通知详情</h1>
        <span class="rounded-full border px-2 py-0.5 text-xs ${toClassName(
          isRead
            ? 'border-border bg-muted text-muted-foreground'
            : 'border-primary/40 bg-primary/5 text-primary',
        )}">${isRead ? '已读' : '未读'}</span>
      </header>

      <div class="flex-1 space-y-3 p-4">
        <article class="rounded-lg border bg-background p-4">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              ${renderLevelBadge(notification.level)}
              <span class="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">${escapeHtml(
                TYPE_LABELS[notifType] || notifType,
              )}</span>
              <span class="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">来源：${escapeHtml(
                SOURCE_LABELS[sourceModule] || sourceModule,
              )}</span>
            </div>

            <h2 class="text-base font-semibold leading-snug">${escapeHtml(notification.title)}</h2>

            <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <i data-lucide="clock" class="h-3.5 w-3.5"></i>
              <span>${escapeHtml(notification.createdAt)}</span>
              ${
                isRead && notification.readAt
                  ? `<span class="mx-1">·</span><i data-lucide="check-circle-2" class="h-3.5 w-3.5 text-green-500"></i><span class="text-green-600">已读 ${escapeHtml(notification.readAt.slice(5, 16))}</span>`
                  : ''
              }
            </div>
          </div>
        </article>

        <article class="rounded-lg border bg-background p-4">
          <div class="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <i data-lucide="file-text" class="h-3.5 w-3.5"></i>
            通知正文
          </div>
          <p class="text-sm leading-relaxed text-foreground">${escapeHtml(n.content || n.body || '暂无详情')}</p>
        </article>

        ${
          relatedItems.length > 0
            ? `
              <article class="rounded-lg border bg-background p-4">
                <div class="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <i data-lucide="link-2" class="h-3.5 w-3.5"></i>
                  关联对象
                </div>
                <div class="space-y-1.5">
                  ${relatedItems
                    .map(
                      (item) =>
                        `<div class="flex items-center justify-between text-sm"><span class="text-xs text-muted-foreground">${escapeHtml(
                          item.label,
                        )}</span><span class="font-mono text-xs font-medium">${escapeHtml(item.value)}</span></div>`,
                    )
                    .join('')}
                </div>
              </article>
            `
            : ''
        }

        ${
          needsEvidence
            ? `
              <article class="rounded-lg border bg-background p-4">
                <div class="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <i data-lucide="camera" class="h-3.5 w-3.5"></i>
                  相关凭证
                </div>
                <div class="flex gap-2">
                  <button class="flex h-8 flex-1 items-center justify-center rounded-md border px-2 text-xs text-muted-foreground opacity-70" disabled>
                    <i data-lucide="camera" class="mr-1 h-3.5 w-3.5"></i>
                    查看凭证
                  </button>
                  <button class="flex h-8 flex-1 items-center justify-center rounded-md border px-2 text-xs text-muted-foreground opacity-70" disabled>
                    <i data-lucide="upload" class="mr-1 h-3.5 w-3.5"></i>
                    去上传凭证
                  </button>
                </div>
                <p class="mt-2 text-[10px] text-muted-foreground">凭证上传功能即将开放</p>
              </article>
            `
            : ''
        }

        ${
          n.actionLabel && actionHref
            ? `
              <div class="pt-1">
                <button
                  class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                  data-pda-notify-detail-action="open-action"
                  data-href="${escapeHtml(actionHref)}"
                >
                  ${escapeHtml(n.actionLabel)}
                </button>
              </div>
            `
            : ''
        }
      </div>
    </div>
  `

  return renderPdaFrame(content, 'notify')
}

export function handlePdaNotifyDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-notify-detail-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaNotifyDetailAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate('/fcs/pda/notify')
    return true
  }

  if (action === 'open-action') {
    const href = actionNode.dataset.href
    if (href) {
      appStore.navigate(href)
    }
    return true
  }

  return false
}
