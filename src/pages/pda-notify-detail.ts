import { initialNotifications, type Notification } from '../data/fcs/store-domain-progress.ts'
import { getFactoryMobileTodoActionRoute, getFactoryMobileTodoById } from '../data/fcs/factory-mobile-todos.ts'
import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { renderPdaFrame } from './pda-shell'
import { ensurePdaSessionForAction, renderPdaLoginRedirect } from './pda-runtime'

const TYPE_LABELS: Record<string, string> = {
  NEW_TASK: '新派单通知',
  TENDER_BID: '报价提醒',
  TENDER_AWARDED: '中标通知',
  HANDOVER: '交接提醒',
  EXEC_RISK: '执行风险提醒',
  QUALITY: '质量提醒',
  SETTLEMENT: '结算提醒',
}

const SOURCE_LABELS: Record<string, string> = {
  接单: '接单',
  执行: '执行',
  交接: '交接',
  结算: '结算',
  系统: '系统',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function markNotificationRead(notificationId: string): void {
  const index = initialNotifications.findIndex((item) => item.notificationId === notificationId)
  if (index < 0) return
  if (initialNotifications[index].readAt) return
  initialNotifications[index] = {
    ...initialNotifications[index],
    readAt: nowTimestamp(),
  }
}

function renderTodoDetail(todoId: string): string {
  const todo = getFactoryMobileTodoById(todoId)
  if (!todo) {
    return renderPdaFrame(
      `
        <div class="px-4 py-10">
          <div class="rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
            <div class="text-base font-medium text-foreground">待办不存在</div>
            <div class="mt-2 text-xs text-muted-foreground">请返回待办汇总重新选择处理项。</div>
            <button type="button" class="mt-4 rounded-xl border px-4 py-2 text-sm" data-pda-notify-detail-action="back">返回</button>
          </div>
        </div>
      `,
      null,
      { headerTitle: '待办详情' },
    )
  }

  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <button type="button" class="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground" data-pda-notify-detail-action="back">
          <i data-lucide="arrow-left" class="h-3.5 w-3.5"></i>返回
        </button>
        <div class="text-lg font-semibold text-foreground">待办详情</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(todo.todoType)} · ${escapeHtml(todo.todoNo)}</div>
      </section>

      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="space-y-2 text-sm">
          <div><span class="text-muted-foreground">待办类型：</span>${escapeHtml(todo.todoType)}</div>
          <div><span class="text-muted-foreground">待办标题：</span>${escapeHtml(todo.todoTitle)}</div>
          <div><span class="text-muted-foreground">关联单号：</span>${escapeHtml(todo.relatedTaskNo || todo.relatedHandoverOrderId || todo.relatedSettlementId || '-')}</div>
          <div><span class="text-muted-foreground">所属工厂：</span>${escapeHtml(todo.factoryName)}</div>
          <div><span class="text-muted-foreground">关联任务：</span>${escapeHtml(todo.relatedTaskId || '-')}</div>
          <div><span class="text-muted-foreground">关联交出单：</span>${escapeHtml(todo.relatedHandoverOrderId || '-')}</div>
          <div><span class="text-muted-foreground">关联交出记录：</span>${escapeHtml(todo.relatedHandoverRecordId || '-')}</div>
          <div><span class="text-muted-foreground">关联入库记录：</span>${escapeHtml(todo.relatedInboundRecordId || '-')}</div>
          <div><span class="text-muted-foreground">关联出库记录：</span>${escapeHtml(todo.relatedOutboundRecordId || '-')}</div>
          <div><span class="text-muted-foreground">优先级：</span>${escapeHtml(todo.priority)}</div>
          <div><span class="text-muted-foreground">到期时间：</span>${escapeHtml(todo.dueAt || '-')}</div>
          <div><span class="text-muted-foreground">状态：</span>${escapeHtml(todo.status)}</div>
          <div><span class="text-muted-foreground">操作建议：</span>${escapeHtml(todo.actionLabel)}</div>
        </div>
        <div class="mt-4 flex gap-2">
          <button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-nav="${escapeHtml(getFactoryMobileTodoActionRoute(todo))}">去处理</button>
          <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-notify-detail-action="back">返回</button>
        </div>
      </section>
    </div>
  `

  return renderPdaFrame(content, null, { headerTitle: '待办详情' })
}

function renderNotificationDetail(notificationId: string): string {
  const found = initialNotifications.find((item) => item.notificationId === notificationId)
  if (!found) {
    return renderPdaFrame(
      `
        <div class="px-4 py-10">
          <div class="rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
            <div class="text-base font-medium text-foreground">通知不存在</div>
            <button type="button" class="mt-4 rounded-xl border px-4 py-2 text-sm" data-pda-notify-detail-action="back">返回</button>
          </div>
        </div>
      `,
      null,
      { headerTitle: '待办详情' },
    )
  }

  if (!found.readAt) {
    markNotificationRead(notificationId)
  }

  const notification = initialNotifications.find((item) => item.notificationId === notificationId) || found
  const actionHref = notification.deepLink?.path || '/fcs/pda/notify'
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <button type="button" class="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground" data-pda-notify-detail-action="back">
          <i data-lucide="arrow-left" class="h-3.5 w-3.5"></i>返回
        </button>
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(TYPE_LABELS[notification.notificationType || 'NEW_TASK'] || '通知')}</span>
          <span class="rounded-full px-2 py-0.5 text-[11px] ${toClassName(notification.readAt ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}">${notification.readAt ? '已读' : '未读'}</span>
        </div>
        <div class="mt-3 text-lg font-semibold text-foreground">${escapeHtml(notification.title)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(notification.createdAt)} · ${escapeHtml(SOURCE_LABELS[notification.sourceModule || '系统'] || '系统')}</div>
      </section>
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-sm leading-6 text-foreground">${escapeHtml(notification.content || '暂无详情')}</div>
        <div class="mt-4 flex gap-2">
          <button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-nav="${escapeHtml(actionHref)}">去处理</button>
          <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-notify-detail-action="back">返回</button>
        </div>
      </section>
    </div>
  `
  return renderPdaFrame(content, null, { headerTitle: '待办详情' })
}

export function renderPdaNotifyDetailPage(id: string): string {
  if (!ensurePdaSessionForAction()) {
    return renderPdaLoginRedirect()
  }
  if (id.startsWith('todo-')) {
    return renderTodoDetail(id)
  }
  return renderNotificationDetail(id)
}

export function handlePdaNotifyDetailEvent(target: HTMLElement): boolean {
  if (!ensurePdaSessionForAction()) return true
  const actionNode = target.closest<HTMLElement>('[data-pda-notify-detail-action]')
  const action = actionNode?.dataset.pdaNotifyDetailAction
  if (action === 'back') {
    appStore.navigate('/fcs/pda/notify')
    return true
  }
  return false
}
