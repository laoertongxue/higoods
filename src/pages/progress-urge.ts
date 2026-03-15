import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import {
  processTasks,
  type ProcessTask,
  type TaskStatus,
} from '../data/fcs/process-tasks'
import { productionOrders } from '../data/fcs/production-orders'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { initialTenders } from '../data/fcs/store-domain-dispatch-process'
import {
  initialExceptions,
  initialHandoverEvents,
  initialNotifications,
  initialUrges,
  mockInternalUsers,
  generateNotificationId,
  generateUrgeId,
  type Notification,
  type NotificationDeepLink,
  type NotificationLevel,
  type RecipientType,
  type TargetType,
  type UrgeLog,
  type UrgeStatus,
  type UrgeType,
} from '../data/fcs/store-domain-progress'

type UrgeTab = 'inbox' | 'outbox'
type TargetTypeWithoutTechPack = Exclude<TargetType, 'TECH_PACK'>

interface ProgressUrgeState {
  lastQueryKey: string
  activeTab: UrgeTab

  nRecipientType: 'ALL' | RecipientType
  nRecipientId: string
  nLevel: 'ALL' | NotificationLevel
  nTargetType: 'ALL' | TargetType
  nReadStatus: 'ALL' | 'UNREAD' | 'READ'
  nKeyword: string

  uUrgeType: 'ALL' | UrgeType
  uToType: 'ALL' | RecipientType
  uToId: string
  uTargetType: 'ALL' | TargetTypeWithoutTechPack
  uStatus: 'ALL' | UrgeStatus
  uKeyword: string

  notificationMenuId: string | null
  urgeMenuId: string | null

  notificationDetailId: string | null
  urgeDetailId: string | null
  newUrgeOpen: boolean
  resendUrgeId: string | null

  formTargetType: TargetTypeWithoutTechPack
  formTargetId: string
  formToType: RecipientType
  formToId: string
  formUrgeType: UrgeType
  formMessage: string
}

const state: ProgressUrgeState = {
  lastQueryKey: '',
  activeTab: 'inbox',

  nRecipientType: 'ALL',
  nRecipientId: 'ALL',
  nLevel: 'ALL',
  nTargetType: 'ALL',
  nReadStatus: 'ALL',
  nKeyword: '',

  uUrgeType: 'ALL',
  uToType: 'ALL',
  uToId: 'ALL',
  uTargetType: 'ALL',
  uStatus: 'ALL',
  uKeyword: '',

  notificationMenuId: null,
  urgeMenuId: null,

  notificationDetailId: null,
  urgeDetailId: null,
  newUrgeOpen: false,
  resendUrgeId: null,

  formTargetType: 'TASK',
  formTargetId: '',
  formToType: 'FACTORY',
  formToId: '',
  formUrgeType: 'URGE_START',
  formMessage: '',
}

const LEVEL_CONFIG: Record<NotificationLevel, { label: string; className: string; icon: string }> = {
  INFO: { label: '信息', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'info' },
  WARN: { label: '警告', className: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'alert-triangle' },
  CRITICAL: { label: '紧急', className: 'bg-red-100 text-red-700 border-red-200', icon: 'alert-circle' },
}

const RECIPIENT_CONFIG: Record<RecipientType, { label: string; icon: string }> = {
  INTERNAL_USER: { label: '内部用户', icon: 'user' },
  FACTORY: { label: '工厂', icon: 'factory' },
}

const TARGET_CONFIG: Record<TargetType, { label: string; icon: string }> = {
  TASK: { label: '任务', icon: 'clock' },
  CASE: { label: '异常单', icon: 'alert-circle' },
  HANDOVER: { label: '交接事件', icon: 'truck' },
  TENDER: { label: '竞价单', icon: 'gavel' },
  ORDER: { label: '生产单', icon: 'file-text' },
  TECH_PACK: { label: '技术包', icon: 'package' },
}

const URGE_TYPE_LABEL: Record<UrgeType, string> = {
  URGE_ASSIGN_ACK: '催确认接单',
  URGE_START: '催开工',
  URGE_FINISH: '催完工',
  URGE_UNBLOCK: '催尽快处理',
  URGE_TENDER_BID: '催报价',
  URGE_TENDER_AWARD: '催定标',
  URGE_HANDOVER_CONFIRM: '催交接确认',
  URGE_HANDOVER_EVIDENCE: '催补证据/处理差异',
  URGE_CASE_HANDLE: '催处理异常',
}

const URGE_STATUS_CONFIG: Record<UrgeStatus, { label: string; className: string }> = {
  SENT: { label: '已发送', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ACKED: { label: '已确认', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  RESOLVED: { label: '已处理', className: 'bg-green-100 text-green-700 border-green-200' },
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateTime(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function isTargetType(value: string | null): value is TargetType {
  if (!value) return false
  return Object.prototype.hasOwnProperty.call(TARGET_CONFIG, value)
}

function isTargetTypeWithoutTechPack(value: string | null): value is TargetTypeWithoutTechPack {
  return value === 'TASK' || value === 'CASE' || value === 'HANDOVER' || value === 'TENDER' || value === 'ORDER'
}

function isRecipientType(value: string | null): value is RecipientType {
  return value === 'INTERNAL_USER' || value === 'FACTORY'
}

function isUrgeType(value: string | null): value is UrgeType {
  if (!value) return false
  return Object.prototype.hasOwnProperty.call(URGE_TYPE_LABEL, value)
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function showProgressUrgeToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-urge-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'

  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'

  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'

    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function closeRowMenus(): void {
  state.notificationMenuId = null
  state.urgeMenuId = null
}

function getNotificationById(notificationId: string): Notification | undefined {
  return initialNotifications.find((item) => item.notificationId === notificationId)
}

function getUrgeById(urgeId: string): UrgeLog | undefined {
  return initialUrges.find((item) => item.urgeId === urgeId)
}

function updateNotification(updated: Notification): void {
  const index = initialNotifications.findIndex((item) => item.notificationId === updated.notificationId)
  if (index >= 0) {
    initialNotifications[index] = updated
  }
}

function createNotification(payload: Omit<Notification, 'notificationId' | 'createdAt'>): Notification {
  const notification: Notification = {
    ...payload,
    notificationId: generateNotificationId(),
    createdAt: nowTimestamp(),
  }

  initialNotifications.push(notification)
  return notification
}

function markNotificationRead(notificationId: string): void {
  const notification = getNotificationById(notificationId)
  if (!notification || notification.readAt) return

  updateNotification({
    ...notification,
    readAt: nowTimestamp(),
  })
}

function markAllNotificationsRead(filter?: { recipientType?: RecipientType; recipientId?: string }): void {
  const readAt = nowTimestamp()

  for (let i = 0; i < initialNotifications.length; i += 1) {
    const item = initialNotifications[i]
    if (item.readAt) continue
    if (filter?.recipientType && item.recipientType !== filter.recipientType) continue
    if (filter?.recipientId && item.recipientId !== filter.recipientId) continue

    initialNotifications[i] = {
      ...item,
      readAt,
    }
  }
}

function createUrge(payload: Omit<UrgeLog, 'urgeId' | 'createdAt' | 'status' | 'auditLogs'>): UrgeLog {
  const createdAt = nowTimestamp()

  const urge: UrgeLog = {
    ...payload,
    urgeId: generateUrgeId(),
    createdAt,
    status: 'SENT',
    auditLogs: [
      {
        id: `UAL-${Date.now()}`,
        action: 'SEND',
        detail: '发送催办',
        at: createdAt,
        by: payload.fromName,
      },
    ],
  }

  initialUrges.push(urge)

  createNotification({
    level: 'INFO',
    title: '收到催办',
    content: `${payload.fromName}：${URGE_TYPE_LABEL[payload.urgeType]} - ${payload.message}`,
    recipientType: payload.toType,
    recipientId: payload.toId,
    recipientName: payload.toName,
    targetType: payload.targetType,
    targetId: payload.targetId,
    related: {},
    deepLink: payload.deepLink,
    createdBy: payload.fromId,
  })

  return urge
}

function recomputeAutoNotifications(): number {
  const now = new Date()
  const nowStr = nowTimestamp(now)
  const newNotifications: Notification[] = []

  const existingKeys = new Set(
    initialNotifications
      .filter((item) => {
        const createdAt = new Date(item.createdAt.replace(' ', 'T'))
        return now.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000
      })
      .map((item) => `${item.recipientType}_${item.recipientId}_${item.targetType}_${item.targetId}_${item.title}`),
  )

  const shouldAdd = (notification: Omit<Notification, 'notificationId' | 'createdAt'>): boolean => {
    const key = `${notification.recipientType}_${notification.recipientId}_${notification.targetType}_${notification.targetId}_${notification.title}`
    if (existingKeys.has(key)) return false
    existingKeys.add(key)
    return true
  }

  // A. S1 异常单 SLA
  initialExceptions.forEach((exception) => {
    if (exception.severity !== 'S1') return
    if (!['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'].includes(exception.caseStatus)) return
    if (!exception.slaDueAt) return

    const slaDue = new Date(exception.slaDueAt.replace(' ', 'T'))
    const owner = exception.ownerUserId
      ? mockInternalUsers.find((item) => item.id === exception.ownerUserId)
      : mockInternalUsers[0]

    const recipientId = owner?.id || 'U001'
    const recipientName = owner?.name || '管理员'

    if (now > slaDue) {
      const notification: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'CRITICAL',
        title: 'SLA逾期提醒',
        content: `异常单${exception.caseId}已超过SLA时限，需立即处理`,
        recipientType: 'INTERNAL_USER',
        recipientId,
        recipientName,
        targetType: 'CASE',
        targetId: exception.caseId,
        related: {
          caseId: exception.caseId,
          productionOrderId: exception.relatedOrderIds[0],
        },
        deepLink: {
          path: '/fcs/progress/exceptions',
          query: { caseId: exception.caseId },
        },
        createdBy: 'SYSTEM',
      }

      if (shouldAdd(notification)) {
        newNotifications.push({
          ...notification,
          notificationId: generateNotificationId(),
          createdAt: nowStr,
        })
      }
    } else if (slaDue.getTime() - now.getTime() < 8 * 60 * 60 * 1000) {
      const notification: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'WARN',
        title: 'SLA即将到期',
        content: `异常单${exception.caseId}将在8小时内到期，请尽快处理`,
        recipientType: 'INTERNAL_USER',
        recipientId,
        recipientName,
        targetType: 'CASE',
        targetId: exception.caseId,
        related: {
          caseId: exception.caseId,
          productionOrderId: exception.relatedOrderIds[0],
        },
        deepLink: {
          path: '/fcs/progress/exceptions',
          query: { caseId: exception.caseId },
        },
        createdBy: 'SYSTEM',
      }

      if (shouldAdd(notification)) {
        newNotifications.push({
          ...notification,
          notificationId: generateNotificationId(),
          createdAt: nowStr,
        })
      }
    }
  })

  // B. 交接待确认超时
  initialHandoverEvents.forEach((event) => {
    if (event.status !== 'PENDING_CONFIRM') return

    const occurredAt = new Date(event.occurredAt.replace(' ', 'T'))
    if (now.getTime() - occurredAt.getTime() < 4 * 60 * 60 * 1000) return

    if (event.toParty.kind === 'FACTORY' && event.toParty.id) {
      const factoryNotification: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'WARN',
        title: '交接待确认超时',
        content: `交接事件${event.eventId}已超过4小时未确认`,
        recipientType: 'FACTORY',
        recipientId: event.toParty.id,
        recipientName: event.toParty.name,
        targetType: 'HANDOVER',
        targetId: event.eventId,
        related: {
          handoverEventId: event.eventId,
          productionOrderId: event.productionOrderId,
        },
        deepLink: {
          path: '/fcs/progress/handover',
          query: { eventId: event.eventId },
        },
        createdBy: 'SYSTEM',
      }

      if (shouldAdd(factoryNotification)) {
        newNotifications.push({
          ...factoryNotification,
          notificationId: generateNotificationId(),
          createdAt: nowStr,
        })
      }
    }

    const internalNotification: Omit<Notification, 'notificationId' | 'createdAt'> = {
      level: 'INFO',
      title: '交接待确认超时',
      content: `交接事件${event.eventId}（${event.toParty.name}）已超过4小时未确认`,
      recipientType: 'INTERNAL_USER',
      recipientId: 'U001',
      recipientName: '管理员',
      targetType: 'HANDOVER',
      targetId: event.eventId,
      related: {
        handoverEventId: event.eventId,
        productionOrderId: event.productionOrderId,
      },
      deepLink: {
        path: '/fcs/progress/handover',
        query: { eventId: event.eventId },
      },
      createdBy: 'SYSTEM',
    }

    if (shouldAdd(internalNotification)) {
      newNotifications.push({
        ...internalNotification,
        notificationId: generateNotificationId(),
        createdAt: nowStr,
      })
    }
  })

  // C. 竞价临近截止/逾期
  initialTenders.forEach((tender) => {
    if (tender.status !== 'OPEN') return

    const deadline = new Date(tender.deadline.replace(' ', 'T'))

    if (now > deadline) {
      const notification: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'CRITICAL',
        title: '竞价已逾期',
        content: `竞价单${tender.tenderId}已超过截止时间，需延期或处理`,
        recipientType: 'INTERNAL_USER',
        recipientId: 'U001',
        recipientName: '管理员',
        targetType: 'TENDER',
        targetId: tender.tenderId,
        related: { tenderId: tender.tenderId },
        deepLink: {
          path: '/fcs/dispatch/board',
          query: { tenderId: tender.tenderId },
        },
        createdBy: 'SYSTEM',
      }

      if (shouldAdd(notification)) {
        newNotifications.push({
          ...notification,
          notificationId: generateNotificationId(),
          createdAt: nowStr,
        })
      }
    } else if (deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
      const notification: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'WARN',
        title: '竞价临近截止',
        content: `竞价单${tender.tenderId}将于24小时内截止`,
        recipientType: 'INTERNAL_USER',
        recipientId: 'U001',
        recipientName: '管理员',
        targetType: 'TENDER',
        targetId: tender.tenderId,
        related: { tenderId: tender.tenderId },
        deepLink: {
          path: '/fcs/dispatch/board',
          query: { tenderId: tender.tenderId },
        },
        createdBy: 'SYSTEM',
      }

      if (shouldAdd(notification)) {
        newNotifications.push({
          ...notification,
          notificationId: generateNotificationId(),
          createdAt: nowStr,
        })
      }
    }
  })

  // D. 任务暂不能继续
  processTasks.forEach((task) => {
    if (task.status !== 'BLOCKED') return

    const merchNotification: Omit<Notification, 'notificationId' | 'createdAt'> = {
      level: 'WARN',
      title: '任务暂不能继续提醒',
      content: `任务${task.taskId}因${task.blockReason || '未知原因'}暂不能继续`,
      recipientType: 'INTERNAL_USER',
      recipientId: 'U002',
      recipientName: '跟单A',
      targetType: 'TASK',
      targetId: task.taskId,
      related: {
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
      },
      deepLink: {
        path: '/fcs/progress/board',
        query: { taskId: task.taskId },
      },
      createdBy: 'SYSTEM',
    }

    if (shouldAdd(merchNotification)) {
      newNotifications.push({
        ...merchNotification,
        notificationId: generateNotificationId(),
        createdAt: nowStr,
      })
    }

    if (['CAPACITY', 'EQUIPMENT'].includes(task.blockReason || '') && task.assignedFactoryId) {
      const factory = indonesiaFactories.find((item) => item.id === task.assignedFactoryId)
      const factoryNotification: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'WARN',
        title: '任务暂不能继续建议',
        content: `任务${task.taskId}暂不能继续，请尽快解除`,
        recipientType: 'FACTORY',
        recipientId: task.assignedFactoryId,
        recipientName: factory?.name || task.assignedFactoryId,
        targetType: 'TASK',
        targetId: task.taskId,
        related: {
          taskId: task.taskId,
          productionOrderId: task.productionOrderId,
        },
        deepLink: {
          path: '/fcs/progress/board',
          query: { taskId: task.taskId },
        },
        createdBy: 'SYSTEM',
      }

      if (shouldAdd(factoryNotification)) {
        newNotifications.push({
          ...factoryNotification,
          notificationId: generateNotificationId(),
          createdAt: nowStr,
        })
      }
    }
  })

  // E. 派单未确认
  processTasks.forEach((task) => {
    if (task.assignmentStatus !== 'ASSIGNED') return
    if (task.status !== 'NOT_STARTED') return
    if (!task.assignedFactoryId) return

    const assignLog = task.auditLogs.find((log) => log.action === 'ASSIGN' || log.action === 'DISPATCH')
    if (!assignLog) return

    const assignedAt = new Date(assignLog.at.replace(' ', 'T'))
    if (now.getTime() - assignedAt.getTime() < 4 * 60 * 60 * 1000) return

    const factory = indonesiaFactories.find((item) => item.id === task.assignedFactoryId)
    const notification: Omit<Notification, 'notificationId' | 'createdAt'> = {
      level: 'WARN',
      title: '派单待确认',
      content: `任务${task.taskId}已分配超过4小时未确认接单`,
      recipientType: 'FACTORY',
      recipientId: task.assignedFactoryId,
      recipientName: factory?.name || task.assignedFactoryId,
      targetType: 'TASK',
      targetId: task.taskId,
      related: {
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
      },
      deepLink: {
        path: '/fcs/dispatch/board',
        query: { taskId: task.taskId },
      },
      createdBy: 'SYSTEM',
    }

    if (shouldAdd(notification)) {
      newNotifications.push({
        ...notification,
        notificationId: generateNotificationId(),
        createdAt: nowStr,
      })
    }
  })

  if (newNotifications.length > 0) {
    initialNotifications.push(...newNotifications)
  }

  return newNotifications.length
}

function getDefaultUrgeType(targetType: TargetTypeWithoutTechPack, taskStatus?: TaskStatus): UrgeType {
  switch (targetType) {
    case 'TASK':
      if (taskStatus === 'NOT_STARTED') return 'URGE_START'
      if (taskStatus === 'IN_PROGRESS') return 'URGE_FINISH'
      if (taskStatus === 'BLOCKED') return 'URGE_UNBLOCK'
      return 'URGE_ASSIGN_ACK'
    case 'CASE':
      return 'URGE_CASE_HANDLE'
    case 'HANDOVER':
      return 'URGE_HANDOVER_CONFIRM'
    case 'TENDER':
      return 'URGE_TENDER_BID'
    case 'ORDER':
      return 'URGE_CASE_HANDLE'
    default:
      return 'URGE_CASE_HANDLE'
  }
}

function getAvailableUrgeTypes(targetType: TargetTypeWithoutTechPack): UrgeType[] {
  switch (targetType) {
    case 'TASK':
      return ['URGE_ASSIGN_ACK', 'URGE_START', 'URGE_FINISH', 'URGE_UNBLOCK']
    case 'CASE':
      return ['URGE_CASE_HANDLE']
    case 'HANDOVER':
      return ['URGE_HANDOVER_CONFIRM', 'URGE_HANDOVER_EVIDENCE']
    case 'TENDER':
      return ['URGE_TENDER_BID', 'URGE_TENDER_AWARD']
    case 'ORDER':
      return ['URGE_CASE_HANDLE', 'URGE_START', 'URGE_FINISH']
    default:
      return ['URGE_CASE_HANDLE']
  }
}

function isMaterialRelated(title: string, content: string, tags?: string[]): boolean {
  const keywords = ['领料', '物料', '配料', '缺口', '齐套', 'material', 'picking']
  const text = `${title} ${content} ${(tags || []).join(' ')}`.toLowerCase()
  return keywords.some((keyword) => text.includes(keyword))
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return processTasks.find((item) => item.taskId === taskId)
}

function getTargetOptions(targetType: TargetTypeWithoutTechPack): Array<{ id: string; label: string }> {
  switch (targetType) {
    case 'TASK':
      return processTasks.map((task) => ({ id: task.taskId, label: `${task.taskId} - ${task.processNameZh}` }))
    case 'CASE':
      return initialExceptions.map((exception) => ({ id: exception.caseId, label: `${exception.caseId} - ${exception.summary}` }))
    case 'HANDOVER':
      return initialHandoverEvents.map((event) => ({
        id: event.eventId,
        label: `${event.eventId} - ${event.fromParty.name} → ${event.toParty.name}`,
      }))
    case 'TENDER':
      return initialTenders.map((tender) => ({ id: tender.tenderId, label: `${tender.tenderId} - ${tender.taskIds.length}个任务` }))
    case 'ORDER':
      return productionOrders.map((order) => ({ id: order.productionOrderId, label: `${order.productionOrderId} - ${order.demandSnapshot.spuName}` }))
    default:
      return []
  }
}

function getRecipientOptions(recipientType: RecipientType): Array<{ id: string; name: string }> {
  if (recipientType === 'INTERNAL_USER') {
    return mockInternalUsers.map((user) => ({ id: user.id, name: user.name }))
  }

  return indonesiaFactories.map((factory) => ({ id: factory.id, name: factory.name }))
}

function inferRecipient(targetType: TargetTypeWithoutTechPack, targetId: string): { toType: RecipientType; toId: string; toName: string } {
  switch (targetType) {
    case 'TASK': {
      const task = processTasks.find((item) => item.taskId === targetId)
      if (task?.assignedFactoryId) {
        const factory = indonesiaFactories.find((item) => item.id === task.assignedFactoryId)
        return {
          toType: 'FACTORY',
          toId: task.assignedFactoryId,
          toName: factory?.name || task.assignedFactoryId,
        }
      }

      return { toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员' }
    }
    case 'CASE': {
      const exception = initialExceptions.find((item) => item.caseId === targetId)
      if (exception?.ownerUserId) {
        const user = mockInternalUsers.find((item) => item.id === exception.ownerUserId)
        return {
          toType: 'INTERNAL_USER',
          toId: exception.ownerUserId,
          toName: user?.name || exception.ownerUserName || exception.ownerUserId,
        }
      }

      return { toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员' }
    }
    case 'HANDOVER': {
      const event = initialHandoverEvents.find((item) => item.eventId === targetId)
      if (event?.toParty.kind === 'FACTORY' && event.toParty.id) {
        return {
          toType: 'FACTORY',
          toId: event.toParty.id,
          toName: event.toParty.name,
        }
      }

      return { toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员' }
    }
    case 'TENDER':
      return { toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员' }
    case 'ORDER':
      return { toType: 'INTERNAL_USER', toId: 'U002', toName: '跟单A' }
    default:
      return { toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员' }
  }
}

function getDeepLink(targetType: TargetTypeWithoutTechPack, targetId: string): NotificationDeepLink {
  const task = processTasks.find((item) => item.taskId === targetId)
  const handover = initialHandoverEvents.find((item) => item.eventId === targetId)

  switch (targetType) {
    case 'TASK':
      return {
        path: '/fcs/progress/board',
        query: {
          taskId: targetId,
          po: task?.productionOrderId || '',
        },
      }
    case 'CASE':
      return {
        path: '/fcs/progress/exceptions',
        query: { caseId: targetId },
      }
    case 'HANDOVER':
      return {
        path: '/fcs/progress/handover',
        query: {
          eventId: targetId,
          po: handover?.productionOrderId || '',
        },
      }
    case 'TENDER':
      return {
        path: '/fcs/dispatch/board',
        query: { tenderId: targetId },
      }
    case 'ORDER':
      return {
        path: `/fcs/production/orders/${targetId}`,
      }
    default:
      return { path: '/fcs/progress/board' }
  }
}

function buildHref(deepLink: NotificationDeepLink): string {
  const path = deepLink.path
  if (!deepLink.query) return path

  const params = new URLSearchParams()
  Object.entries(deepLink.query).forEach(([key, value]) => {
    params.set(key, value)
  })

  const queryString = params.toString()
  return queryString ? `${path}?${queryString}` : path
}

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function openDeepLink(deepLink: NotificationDeepLink, title: string): void {
  openLinkedPage(title, buildHref(deepLink))
}

function resetNotificationFilters(): void {
  state.nRecipientType = 'ALL'
  state.nRecipientId = 'ALL'
  state.nLevel = 'ALL'
  state.nTargetType = 'ALL'
  state.nReadStatus = 'ALL'
  state.nKeyword = ''
}

function resetUrgeFilters(): void {
  state.uUrgeType = 'ALL'
  state.uToType = 'ALL'
  state.uToId = 'ALL'
  state.uTargetType = 'ALL'
  state.uStatus = 'ALL'
  state.uKeyword = ''
}

function resetForm(): void {
  state.formTargetType = 'TASK'
  state.formTargetId = ''
  state.formToType = 'FACTORY'
  state.formToId = ''
  state.formUrgeType = 'URGE_START'
  state.formMessage = ''
}

function applyTargetTypeFilterFromQuery(activeTab: UrgeTab): void {
  const params = getCurrentSearchParams()
  const targetType = params.get('targetType')
  if (!isTargetType(targetType)) return

  if (activeTab === 'inbox') {
    state.nTargetType = targetType
    return
  }

  if (targetType !== 'TECH_PACK') {
    state.uTargetType = targetType
  }
}

function syncFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey
  const params = getCurrentSearchParams()

  const tab = params.get('tab')
  if (tab === 'inbox' || tab === 'outbox') {
    state.activeTab = tab
  }

  const targetType = params.get('targetType')
  const targetId = params.get('targetId')
  const toType = params.get('toType')
  const toId = params.get('toId')
  const urgeType = params.get('urgeType')
  const openNew = params.get('openNew')

  if (openNew === 'true' && isTargetTypeWithoutTechPack(targetType) && targetId) {
    state.formTargetType = targetType
    state.formTargetId = targetId

    if (isRecipientType(toType)) {
      state.formToType = toType
    }

    if (toId) {
      state.formToId = toId
    }

    if (isUrgeType(urgeType)) {
      state.formUrgeType = urgeType
    } else {
      const taskStatus = targetType === 'TASK' ? getTaskById(targetId)?.status : undefined
      state.formUrgeType = getDefaultUrgeType(targetType, taskStatus)
    }

    state.newUrgeOpen = true
  }

  applyTargetTypeFilterFromQuery(state.activeTab)
}

function getFilteredNotifications(): Notification[] {
  return initialNotifications
    .filter((notification) => {
      if (state.nRecipientType !== 'ALL' && notification.recipientType !== state.nRecipientType) return false
      if (state.nRecipientId !== 'ALL' && notification.recipientId !== state.nRecipientId) return false
      if (state.nLevel !== 'ALL' && notification.level !== state.nLevel) return false
      if (state.nTargetType !== 'ALL' && notification.targetType !== state.nTargetType) return false
      if (state.nReadStatus === 'UNREAD' && notification.readAt) return false
      if (state.nReadStatus === 'READ' && !notification.readAt) return false

      const keyword = state.nKeyword.trim().toLowerCase()
      if (keyword) {
        const combined = `${notification.title} ${notification.content} ${notification.notificationId} ${notification.targetId}`.toLowerCase()
        if (!combined.includes(keyword)) return false
      }

      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function getFilteredUrges(): UrgeLog[] {
  return initialUrges
    .filter((urge) => {
      if (state.uUrgeType !== 'ALL' && urge.urgeType !== state.uUrgeType) return false
      if (state.uToType !== 'ALL' && urge.toType !== state.uToType) return false
      if (state.uToId !== 'ALL' && urge.toId !== state.uToId) return false
      if (state.uTargetType !== 'ALL' && urge.targetType !== state.uTargetType) return false
      if (state.uStatus !== 'ALL' && urge.status !== state.uStatus) return false

      const keyword = state.uKeyword.trim().toLowerCase()
      if (keyword) {
        const combined = `${urge.urgeId} ${urge.message} ${urge.targetId} ${urge.toName}`.toLowerCase()
        if (!combined.includes(keyword)) return false
      }

      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function getKpiStats(): { unreadCount: number; criticalCount: number; factoryCount: number; sentUrgeCount: number } {
  const unreadCount = initialNotifications.filter((notification) => !notification.readAt).length
  const criticalCount = initialNotifications.filter((notification) => notification.level === 'CRITICAL' && !notification.readAt).length
  const factoryCount = initialNotifications.filter((notification) => notification.recipientType === 'FACTORY' && !notification.readAt).length
  const sentUrgeCount = initialUrges.filter((urge) => urge.status === 'SENT').length

  return {
    unreadCount,
    criticalCount,
    factoryCount,
    sentUrgeCount,
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

function renderBadge(label: string, className: string, icon?: string): string {
  return `
    <span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${className}">
      ${icon ? `<i data-lucide="${icon}" class="h-3 w-3"></i>` : ''}
      <span class="${icon ? 'ml-1' : ''}">${escapeHtml(label)}</span>
    </span>
  `
}

function renderTargetTypeOptions(includeTechPack: boolean, selectedValue: string): string {
  return Object.entries(TARGET_CONFIG)
    .filter(([key]) => includeTechPack || key !== 'TECH_PACK')
    .map(([key, config]) => `<option value="${key}" ${selectedValue === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
    .join('')
}

function getNotificationMaterialPo(notification: Notification): string {
  if (notification.targetType === 'ORDER') {
    return notification.targetId
  }

  return notification.deepLink.query?.po || notification.related.productionOrderId || ''
}

function getUrgeMaterialPo(urge: UrgeLog): string {
  if (urge.targetType === 'ORDER') {
    return urge.targetId
  }

  return urge.deepLink.query?.po || ''
}

function renderNotificationActionMenu(notification: Notification): string {
  const isOpen = state.notificationMenuId === notification.notificationId
  const po = getNotificationMaterialPo(notification)
  const showMaterialAction = notification.targetType === 'ORDER' || isMaterialRelated(notification.title, notification.content)

  return `
    <div class="relative inline-flex" data-urge-stop="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-urge-action="toggle-notification-menu" data-id="${escapeAttr(notification.notificationId)}">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-20 min-w-[168px] rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="notification-handle" data-id="${escapeAttr(notification.notificationId)}">
                <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>立即处理
              </button>
              ${
                showMaterialAction
                  ? `
                    <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="notification-view-material" data-po="${escapeAttr(po)}">
                      <i data-lucide="package" class="mr-2 h-4 w-4"></i>查看领料进度
                    </button>
                  `
                  : ''
              }
              ${
                !notification.readAt
                  ? `
                    <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="notification-mark-read" data-id="${escapeAttr(notification.notificationId)}">
                      <i data-lucide="check" class="mr-2 h-4 w-4"></i>标记已读
                    </button>
                  `
                  : ''
              }
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="notification-view-detail" data-id="${escapeAttr(notification.notificationId)}">
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>查看详情
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderUrgeActionMenu(urge: UrgeLog): string {
  const isOpen = state.urgeMenuId === urge.urgeId
  const po = getUrgeMaterialPo(urge)
  const showMaterialAction = ['ORDER', 'TASK', 'CASE'].includes(urge.targetType)

  return `
    <div class="relative inline-flex" data-urge-stop="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-urge-action="toggle-urge-menu" data-id="${escapeAttr(urge.urgeId)}">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-20 min-w-[168px] rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="urge-view-detail" data-id="${escapeAttr(urge.urgeId)}">
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>查看详情
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="urge-resend" data-id="${escapeAttr(urge.urgeId)}">
                <i data-lucide="send" class="mr-2 h-4 w-4"></i>再次催办
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="urge-goto" data-id="${escapeAttr(urge.urgeId)}">
                <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>跳转处理页
              </button>
              ${
                showMaterialAction
                  ? `
                    <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-urge-action="urge-view-material" data-po="${escapeAttr(po)}">
                      <i data-lucide="package" class="mr-2 h-4 w-4"></i>查看领料进度
                    </button>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="bell" class="h-5 w-5"></i>
          催办与通知
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">管理催办信息与系统通知</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="recompute">
          <i data-lucide="refresh-cw" class="mr-2 h-4 w-4"></i>重新计算提醒
        </button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="mark-all-read">
          <i data-lucide="check-check" class="mr-2 h-4 w-4"></i>全部标记已读
        </button>
        <button class="inline-flex h-8 items-center rounded-md border bg-primary px-3 text-sm text-primary-foreground hover:opacity-90" data-urge-action="open-new-urge">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>新建催办
        </button>
      </div>
    </header>
  `
}

function renderKpiCards(kpi: { unreadCount: number; criticalCount: number; factoryCount: number; sentUrgeCount: number }): string {
  return `
    <section class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">未读</p>
            <p class="text-2xl font-bold">${kpi.unreadCount}</p>
          </div>
          <i data-lucide="bell" class="h-8 w-8 text-blue-500/30"></i>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">紧急</p>
            <p class="text-2xl font-bold text-red-600">${kpi.criticalCount}</p>
          </div>
          <i data-lucide="alert-circle" class="h-8 w-8 text-red-500/30"></i>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">工厂端(PDA)待办</p>
            <p class="text-2xl font-bold">${kpi.factoryCount}</p>
          </div>
          <i data-lucide="factory" class="h-8 w-8 text-green-500/30"></i>
        </div>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">已发送</p>
            <p class="text-2xl font-bold">${kpi.sentUrgeCount}</p>
          </div>
          <i data-lucide="send" class="h-8 w-8 text-orange-500/30"></i>
        </div>
      </article>
    </section>
  `
}

function renderTabs(kpi: { unreadCount: number }): string {
  return `
    <div class="inline-flex rounded-md border p-1 text-sm">
      <button
        class="inline-flex h-8 items-center gap-1.5 rounded px-3 ${state.activeTab === 'inbox' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
        data-urge-action="switch-tab"
        data-tab="inbox"
      >
        <i data-lucide="bell" class="h-4 w-4"></i>
        通知中心
        ${
          kpi.unreadCount > 0
            ? `<span class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded border border-blue-200 bg-blue-100 px-1.5 text-xs text-blue-700">${kpi.unreadCount}</span>`
            : ''
        }
      </button>
      <button
        class="inline-flex h-8 items-center gap-1.5 rounded px-3 ${state.activeTab === 'outbox' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
        data-urge-action="switch-tab"
        data-tab="outbox"
      >
        <i data-lucide="send" class="h-4 w-4"></i>
        催办台账
      </button>
    </div>
  `
}

function renderInboxFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">接收方类型</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="nRecipientType">
            <option value="ALL" ${state.nRecipientType === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="INTERNAL_USER" ${state.nRecipientType === 'INTERNAL_USER' ? 'selected' : ''}>内部用户</option>
            <option value="FACTORY" ${state.nRecipientType === 'FACTORY' ? 'selected' : ''}>工厂</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">级别</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="nLevel">
            <option value="ALL" ${state.nLevel === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="INFO" ${state.nLevel === 'INFO' ? 'selected' : ''}>信息</option>
            <option value="WARN" ${state.nLevel === 'WARN' ? 'selected' : ''}>警告</option>
            <option value="CRITICAL" ${state.nLevel === 'CRITICAL' ? 'selected' : ''}>紧急</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">对象类型</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="nTargetType">
            <option value="ALL" ${state.nTargetType === 'ALL' ? 'selected' : ''}>全部</option>
            ${renderTargetTypeOptions(true, state.nTargetType)}
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">已读状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="nReadStatus">
            <option value="ALL" ${state.nReadStatus === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="UNREAD" ${state.nReadStatus === 'UNREAD' ? 'selected' : ''}>未读</option>
            <option value="READ" ${state.nReadStatus === 'READ' ? 'selected' : ''}>已读</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">搜索通知/催办</span>
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="请输入关键词"
            value="${escapeAttr(state.nKeyword)}"
            data-urge-field="nKeyword"
          />
        </label>

        <div class="flex items-end">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="reset-notification-filters">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderOutboxFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">催办类型</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="uUrgeType">
            <option value="ALL" ${state.uUrgeType === 'ALL' ? 'selected' : ''}>全部</option>
            ${Object.entries(URGE_TYPE_LABEL)
              .map(([key, label]) => `<option value="${key}" ${state.uUrgeType === key ? 'selected' : ''}>${escapeHtml(label)}</option>`)
              .join('')}
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">被催对象</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="uToType">
            <option value="ALL" ${state.uToType === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="INTERNAL_USER" ${state.uToType === 'INTERNAL_USER' ? 'selected' : ''}>内部用户</option>
            <option value="FACTORY" ${state.uToType === 'FACTORY' ? 'selected' : ''}>工厂</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">对象类型</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="uTargetType">
            <option value="ALL" ${state.uTargetType === 'ALL' ? 'selected' : ''}>全部</option>
            ${renderTargetTypeOptions(false, state.uTargetType)}
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">催办状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="uStatus">
            <option value="ALL" ${state.uStatus === 'ALL' ? 'selected' : ''}>全部</option>
            ${Object.entries(URGE_STATUS_CONFIG)
              .map(([key, config]) => `<option value="${key}" ${state.uStatus === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
              .join('')}
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">搜索通知/催办</span>
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="请输入关键词"
            value="${escapeAttr(state.uKeyword)}"
            data-urge-field="uKeyword"
          />
        </label>

        <div class="flex items-end">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="reset-urge-filters">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderNotificationTable(rows: Notification[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">级别</th>
              <th class="px-3 py-2 font-medium">标题</th>
              <th class="px-3 py-2 font-medium">内容</th>
              <th class="px-3 py-2 font-medium">接收方</th>
              <th class="px-3 py-2 font-medium">关联对象</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">已读时间</th>
              <th class="px-3 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td class="px-3 py-12 text-center text-muted-foreground" colspan="8">暂无通知</td>
                  </tr>
                `
                : rows
                    .map((notification) => {
                      const level = LEVEL_CONFIG[notification.level]
                      const recipient = RECIPIENT_CONFIG[notification.recipientType]
                      const target = TARGET_CONFIG[notification.targetType]

                      return `
                        <tr class="border-b ${!notification.readAt ? 'bg-blue-50/50' : ''}">
                          <td class="px-3 py-2">
                            ${renderBadge(level.label, level.className, level.icon)}
                          </td>
                          <td class="px-3 py-2 font-medium">${escapeHtml(notification.title)}</td>
                          <td class="max-w-[280px] px-3 py-2 text-muted-foreground">${escapeHtml(truncate(notification.content, 50))}</td>
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-1.5">
                              <i data-lucide="${recipient.icon}" class="h-3.5 w-3.5"></i>
                              <span>${escapeHtml(notification.recipientName)}</span>
                            </span>
                          </td>
                          <td class="px-3 py-2">
                            ${renderBadge(notification.targetId, 'bg-background text-foreground border-border', target.icon)}
                          </td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(notification.createdAt)}</td>
                          <td class="px-3 py-2 text-xs">
                            ${
                              notification.readAt
                                ? `<span class="text-green-600">${escapeHtml(notification.readAt)}</span>`
                                : renderBadge('未读', 'bg-muted text-muted-foreground border-border')
                            }
                          </td>
                          <td class="px-3 py-2 text-right">${renderNotificationActionMenu(notification)}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderUrgeTable(rows: UrgeLog[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">催办ID</th>
              <th class="px-3 py-2 font-medium">催办类型</th>
              <th class="px-3 py-2 font-medium">被催方</th>
              <th class="px-3 py-2 font-medium">关联对象</th>
              <th class="px-3 py-2 font-medium">催办内容</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td class="px-3 py-12 text-center text-muted-foreground" colspan="8">暂无催办记录</td>
                  </tr>
                `
                : rows
                    .map((urge) => {
                      const recipient = RECIPIENT_CONFIG[urge.toType]
                      const target = TARGET_CONFIG[urge.targetType]
                      const statusConfig = URGE_STATUS_CONFIG[urge.status]

                      return `
                        <tr class="border-b">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(urge.urgeId)}</td>
                          <td class="px-3 py-2">${renderBadge(URGE_TYPE_LABEL[urge.urgeType], 'bg-background text-foreground border-border')}</td>
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-1.5">
                              <i data-lucide="${recipient.icon}" class="h-3.5 w-3.5"></i>
                              <span>${escapeHtml(urge.toName)}</span>
                            </span>
                          </td>
                          <td class="px-3 py-2">${renderBadge(urge.targetId, 'bg-background text-foreground border-border', target.icon)}</td>
                          <td class="max-w-[260px] px-3 py-2 text-muted-foreground">${escapeHtml(truncate(urge.message, 40))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(urge.createdAt)}</td>
                          <td class="px-3 py-2">${renderBadge(statusConfig.label, statusConfig.className)}</td>
                          <td class="px-3 py-2 text-right">${renderUrgeActionMenu(urge)}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderNotificationDetailDrawer(): string {
  if (!state.notificationDetailId) return ''

  const notification = getNotificationById(state.notificationDetailId)
  if (!notification) return ''

  const level = LEVEL_CONFIG[notification.level]
  const recipient = RECIPIENT_CONFIG[notification.recipientType]
  const target = TARGET_CONFIG[notification.targetType]

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-urge-action="close-notification-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[450px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">通知详情</h3>
              <p class="font-mono text-xs text-muted-foreground">${escapeHtml(notification.notificationId)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-urge-action="close-notification-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-4 px-5 py-5">
          <div class="flex items-center gap-2">
            ${renderBadge(level.label, level.className, level.icon)}
            ${!notification.readAt ? renderBadge('未读', 'bg-muted text-muted-foreground border-border') : ''}
          </div>

          <div class="space-y-3">
            <div>
              <p class="text-xs text-muted-foreground">标题</p>
              <p class="font-medium">${escapeHtml(notification.title)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">内容</p>
              <p class="text-sm">${escapeHtml(notification.content)}</p>
            </div>

            <div class="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">接收方类型</p>
                <p class="mt-1 inline-flex items-center gap-1.5">
                  <i data-lucide="${recipient.icon}" class="h-3.5 w-3.5"></i>
                  ${escapeHtml(recipient.label)}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">接收方</p>
                <p class="mt-1">${escapeHtml(notification.recipientName)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">对象类型</p>
                <p class="mt-1 inline-flex items-center gap-1.5">
                  <i data-lucide="${target.icon}" class="h-3.5 w-3.5"></i>
                  ${escapeHtml(target.label)}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">关联对象</p>
                <p class="mt-1 font-mono">${escapeHtml(notification.targetId)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">创建时间</p>
                <p class="mt-1">${escapeHtml(notification.createdAt)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">已读时间</p>
                <p class="mt-1">${escapeHtml(notification.readAt || '-')}</p>
              </div>
            </div>
          </div>
        </div>

        <footer class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="close-notification-detail">取消</button>
          ${
            !notification.readAt
              ? `
                <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="notification-detail-mark-read" data-id="${escapeAttr(notification.notificationId)}">
                  <i data-lucide="check" class="mr-1.5 h-4 w-4"></i>标记已读
                </button>
              `
              : ''
          }
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-3 text-sm text-primary-foreground hover:opacity-90" data-urge-action="notification-detail-handle" data-id="${escapeAttr(notification.notificationId)}">
            <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>立即处理
          </button>
        </footer>
      </section>
    </div>
  `
}

function renderUrgeDetailDrawer(): string {
  if (!state.urgeDetailId) return ''

  const urge = getUrgeById(state.urgeDetailId)
  if (!urge) return ''

  const recipient = RECIPIENT_CONFIG[urge.toType]
  const target = TARGET_CONFIG[urge.targetType]
  const statusConfig = URGE_STATUS_CONFIG[urge.status]

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-urge-action="close-urge-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[450px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">催办详情</h3>
              <p class="font-mono text-xs text-muted-foreground">${escapeHtml(urge.urgeId)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-urge-action="close-urge-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-4 px-5 py-5">
          <div class="flex items-center gap-2">
            ${renderBadge(URGE_TYPE_LABEL[urge.urgeType], 'bg-background text-foreground border-border')}
            ${renderBadge(statusConfig.label, statusConfig.className)}
          </div>

          <div>
            <p class="text-xs text-muted-foreground">催办内容</p>
            <p class="mt-1 rounded-lg bg-muted p-3 text-sm">${escapeHtml(urge.message)}</p>
          </div>

          <div class="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">发起方</p>
              <p class="mt-1 inline-flex items-center gap-1.5">
                <i data-lucide="user" class="h-3.5 w-3.5"></i>
                ${escapeHtml(urge.fromName)}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">被催方</p>
              <p class="mt-1 inline-flex items-center gap-1.5">
                <i data-lucide="${recipient.icon}" class="h-3.5 w-3.5"></i>
                ${escapeHtml(urge.toName)}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">对象类型</p>
              <p class="mt-1 inline-flex items-center gap-1.5">
                <i data-lucide="${target.icon}" class="h-3.5 w-3.5"></i>
                ${escapeHtml(target.label)}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">关联对象</p>
              <p class="mt-1 font-mono">${escapeHtml(urge.targetId)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">创建时间</p>
              <p class="mt-1">${escapeHtml(urge.createdAt)}</p>
            </div>
          </div>

          <div class="border-t pt-3">
            <p class="text-xs text-muted-foreground">操作日志</p>
            <div class="mt-2 space-y-2">
              ${urge.auditLogs
                .map(
                  (log) => `
                    <div class="flex items-start gap-2 text-sm">
                      ${renderBadge(log.action, 'bg-background text-foreground border-border')}
                      <div class="flex-1">
                        <p>${escapeHtml(log.detail)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(log.at)} - ${escapeHtml(log.by)}</p>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>

        <footer class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="close-urge-detail">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-urge-action="urge-detail-resend" data-id="${escapeAttr(urge.urgeId)}">
            <i data-lucide="send" class="mr-1.5 h-4 w-4"></i>再次催办
          </button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-3 text-sm text-primary-foreground hover:opacity-90" data-urge-action="urge-detail-goto" data-id="${escapeAttr(urge.urgeId)}">
            <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>跳转处理页
          </button>
        </footer>
      </section>
    </div>
  `
}

function renderNewUrgeDrawer(): string {
  if (!state.newUrgeOpen) return ''

  const targetOptions = getTargetOptions(state.formTargetType)
  const recipientOptions = getRecipientOptions(state.formToType)
  const urgeTypeOptions = getAvailableUrgeTypes(state.formTargetType)
  const canSend = Boolean(state.formTargetId && state.formToId && state.formMessage.trim())

  return `
    <div class="fixed inset-0 z-[55]">
      <button class="absolute inset-0 bg-black/45" data-urge-action="close-new-urge" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[500px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">新建催办</h3>
              <p class="text-sm text-muted-foreground">管理催办信息与系统通知</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-urge-action="close-new-urge" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-5 px-5 py-5">
          <section class="space-y-3">
            <h4 class="text-sm font-medium">目标对象</h4>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-sm">选择对象类型 *</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="formTargetType">
                  ${Object.entries(TARGET_CONFIG)
                    .filter(([key]) => key !== 'TECH_PACK')
                    .map(([key, config]) => `<option value="${key}" ${state.formTargetType === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`)
                    .join('')}
                </select>
              </label>

              <label class="space-y-1">
                <span class="text-sm">选择对象 *</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="formTargetId">
                  <option value="">请选择对象</option>
                  ${targetOptions
                    .map((option) => `<option value="${escapeAttr(option.id)}" ${state.formTargetId === option.id ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
                    .join('')}
                </select>
              </label>
            </div>

            ${
              state.formTargetType === 'ORDER' && state.formTargetId
                ? `
                  <button class="inline-flex items-center rounded px-0 py-1 text-sm text-teal-700 hover:underline" data-urge-action="new-urge-view-material" data-po="${escapeAttr(state.formTargetId)}">
                    <i data-lucide="package" class="mr-1 h-3.5 w-3.5"></i>查看领料进度（新标签）
                  </button>
                `
                : ''
            }
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">接收方</h4>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-sm">接收方类型</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="formToType">
                  <option value="INTERNAL_USER" ${state.formToType === 'INTERNAL_USER' ? 'selected' : ''}>内部用户</option>
                  <option value="FACTORY" ${state.formToType === 'FACTORY' ? 'selected' : ''}>工厂</option>
                </select>
              </label>

              <label class="space-y-1">
                <span class="text-sm">选择接收方 *</span>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="formToId">
                  <option value="">请选择接收方</option>
                  ${recipientOptions
                    .map((option) => `<option value="${escapeAttr(option.id)}" ${state.formToId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`)
                    .join('')}
                </select>
              </label>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">催办内容</h4>

            <label class="space-y-1">
              <span class="text-sm">选择催办类型</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-urge-field="formUrgeType">
                ${urgeTypeOptions
                  .map((urgeType) => `<option value="${urgeType}" ${state.formUrgeType === urgeType ? 'selected' : ''}>${escapeHtml(URGE_TYPE_LABEL[urgeType])}</option>`)
                  .join('')}
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-sm">催办内容 *</span>
              <textarea class="min-h-[108px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入催办内容（必填）" data-urge-field="formMessage">${escapeHtml(state.formMessage)}</textarea>
            </label>
          </section>
        </div>

        <footer class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-urge-action="close-new-urge">取消</button>
          <button
            class="${toClassName(
              'inline-flex h-9 items-center rounded-md px-4 text-sm',
              canSend
                ? 'border bg-primary text-primary-foreground hover:opacity-90'
                : 'cursor-not-allowed border border-muted-foreground/20 bg-muted text-muted-foreground',
            )}"
            data-urge-action="send-urge"
            ${canSend ? '' : 'disabled'}
          >
            <i data-lucide="send" class="mr-1.5 h-4 w-4"></i>发送催办
          </button>
        </footer>
      </section>
    </div>
  `
}

function renderResendDialog(): string {
  if (!state.resendUrgeId) return ''

  const urge = getUrgeById(state.resendUrgeId)
  if (!urge) return ''

  return `
    <div class="fixed inset-0 z-[70]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-urge-action="close-resend-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">再次催办</h3>
          <p class="text-sm text-muted-foreground">确认再次催办？</p>
        </header>

        <div class="mt-4 space-y-2 text-sm">
          <p><span class="font-medium">被催方：</span>${escapeHtml(urge.toName)}</p>
          <p><span class="font-medium">催办类型：</span>${escapeHtml(URGE_TYPE_LABEL[urge.urgeType])}</p>
          <p><span class="font-medium">催办内容：</span>${escapeHtml(urge.message)}</p>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-urge-action="close-resend-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-urge-action="confirm-resend">
            <i data-lucide="send" class="mr-1.5 h-4 w-4"></i>确认
          </button>
        </footer>
      </section>
    </div>
  `
}

function renderInboxTab(rows: Notification[]): string {
  return `
    <div class="space-y-4">
      ${renderInboxFilters()}
      ${renderNotificationTable(rows)}
    </div>
  `
}

function renderOutboxTab(rows: UrgeLog[]): string {
  return `
    <div class="space-y-4">
      ${renderOutboxFilters()}
      ${renderUrgeTable(rows)}
    </div>
  `
}

function handleSendUrge(): void {
  if (!state.formTargetId || !state.formToId || !state.formMessage.trim()) {
    showProgressUrgeToast('请填写完整信息', 'error')
    return
  }

  const recipient = getRecipientOptions(state.formToType).find((item) => item.id === state.formToId)

  createUrge({
    urgeType: state.formUrgeType,
    fromType: 'INTERNAL_USER',
    fromId: 'U001',
    fromName: '管理员',
    toType: state.formToType,
    toId: state.formToId,
    toName: recipient?.name || state.formToId,
    targetType: state.formTargetType,
    targetId: state.formTargetId,
    message: state.formMessage.trim(),
    deepLink: getDeepLink(state.formTargetType, state.formTargetId),
  })

  showProgressUrgeToast('催办已发送')
  state.newUrgeOpen = false
  resetForm()
}

function handleResend(): void {
  if (!state.resendUrgeId) return

  const urge = getUrgeById(state.resendUrgeId)
  if (!urge) {
    state.resendUrgeId = null
    return
  }

  createUrge({
    urgeType: urge.urgeType,
    fromType: 'INTERNAL_USER',
    fromId: 'U001',
    fromName: '管理员',
    toType: urge.toType,
    toId: urge.toId,
    toName: urge.toName,
    targetType: urge.targetType,
    targetId: urge.targetId,
    message: urge.message,
    deepLink: urge.deepLink,
  })

  showProgressUrgeToast('催办已发送')
  state.resendUrgeId = null
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'nKeyword' && node instanceof HTMLInputElement) {
    state.nKeyword = node.value
    return
  }

  if (field === 'uKeyword' && node instanceof HTMLInputElement) {
    state.uKeyword = node.value
    return
  }

  if (field === 'nRecipientType' && node instanceof HTMLSelectElement) {
    state.nRecipientType = node.value === 'ALL' ? 'ALL' : isRecipientType(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'nLevel' && node instanceof HTMLSelectElement) {
    if (node.value === 'ALL' || node.value === 'INFO' || node.value === 'WARN' || node.value === 'CRITICAL') {
      state.nLevel = node.value
    }
    return
  }

  if (field === 'nTargetType' && node instanceof HTMLSelectElement) {
    state.nTargetType = node.value === 'ALL' ? 'ALL' : isTargetType(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'nReadStatus' && node instanceof HTMLSelectElement) {
    if (node.value === 'ALL' || node.value === 'UNREAD' || node.value === 'READ') {
      state.nReadStatus = node.value
    }
    return
  }

  if (field === 'uUrgeType' && node instanceof HTMLSelectElement) {
    state.uUrgeType = node.value === 'ALL' ? 'ALL' : isUrgeType(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'uToType' && node instanceof HTMLSelectElement) {
    state.uToType = node.value === 'ALL' ? 'ALL' : isRecipientType(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'uTargetType' && node instanceof HTMLSelectElement) {
    state.uTargetType = node.value === 'ALL' ? 'ALL' : isTargetTypeWithoutTechPack(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'uStatus' && node instanceof HTMLSelectElement) {
    if (node.value === 'ALL' || node.value === 'SENT' || node.value === 'ACKED' || node.value === 'RESOLVED') {
      state.uStatus = node.value
    }
    return
  }

  if (field === 'formTargetType' && node instanceof HTMLSelectElement) {
    if (!isTargetTypeWithoutTechPack(node.value)) return
    state.formTargetType = node.value
    state.formTargetId = ''
    state.formToId = ''
    state.formUrgeType = getDefaultUrgeType(node.value)
    return
  }

  if (field === 'formTargetId' && node instanceof HTMLSelectElement) {
    state.formTargetId = node.value

    if (state.formTargetId) {
      const inferred = inferRecipient(state.formTargetType, state.formTargetId)
      state.formToType = inferred.toType
      state.formToId = inferred.toId

      const taskStatus = state.formTargetType === 'TASK' ? getTaskById(state.formTargetId)?.status : undefined
      state.formUrgeType = getDefaultUrgeType(state.formTargetType, taskStatus)
    }

    return
  }

  if (field === 'formToType' && node instanceof HTMLSelectElement) {
    if (!isRecipientType(node.value)) return
    state.formToType = node.value
    state.formToId = ''
    return
  }

  if (field === 'formToId' && node instanceof HTMLSelectElement) {
    state.formToId = node.value
    return
  }

  if (field === 'formUrgeType' && node instanceof HTMLSelectElement) {
    if (isUrgeType(node.value)) {
      state.formUrgeType = node.value
    }
    return
  }

  if (field === 'formMessage' && node instanceof HTMLTextAreaElement) {
    state.formMessage = node.value
  }
}

function openMaterialPage(po: string): void {
  const title = po ? `领料进度-${po}` : '领料进度'
  const href = `/fcs/progress/material${po ? `?po=${encodeURIComponent(po)}` : ''}`
  openLinkedPage(title, href)
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab
    if (tab === 'inbox' || tab === 'outbox') {
      state.activeTab = tab
      applyTargetTypeFilterFromQuery(tab)
      closeRowMenus()
    }
    return true
  }

  if (action === 'recompute') {
    const added = recomputeAutoNotifications()
    showProgressUrgeToast(added > 0 ? `已重新计算提醒，新增 ${added} 条通知` : '已重新计算提醒')
    return true
  }

  if (action === 'mark-all-read') {
    const filter: { recipientType?: RecipientType; recipientId?: string } = {}
    if (state.nRecipientType !== 'ALL') {
      filter.recipientType = state.nRecipientType
    }
    if (state.nRecipientId !== 'ALL') {
      filter.recipientId = state.nRecipientId
    }

    markAllNotificationsRead(Object.keys(filter).length > 0 ? filter : undefined)
    showProgressUrgeToast('已标记为已读')
    return true
  }

  if (action === 'open-new-urge') {
    resetForm()
    state.newUrgeOpen = true
    return true
  }

  if (action === 'reset-notification-filters') {
    resetNotificationFilters()
    return true
  }

  if (action === 'reset-urge-filters') {
    resetUrgeFilters()
    return true
  }

  if (action === 'toggle-notification-menu') {
    const notificationId = actionNode.dataset.id
    if (notificationId) {
      state.notificationMenuId = state.notificationMenuId === notificationId ? null : notificationId
      state.urgeMenuId = null
    }
    return true
  }

  if (action === 'toggle-urge-menu') {
    const urgeId = actionNode.dataset.id
    if (urgeId) {
      state.urgeMenuId = state.urgeMenuId === urgeId ? null : urgeId
      state.notificationMenuId = null
    }
    return true
  }

  if (action === 'notification-handle') {
    const notificationId = actionNode.dataset.id
    const notification = notificationId ? getNotificationById(notificationId) : undefined
    if (notification) {
      openDeepLink(notification.deepLink, notification.title)
    }
    closeRowMenus()
    return true
  }

  if (action === 'notification-view-material') {
    openMaterialPage(actionNode.dataset.po || '')
    closeRowMenus()
    return true
  }

  if (action === 'notification-mark-read') {
    const notificationId = actionNode.dataset.id
    if (notificationId) {
      markNotificationRead(notificationId)
      showProgressUrgeToast('已标记为已读')
    }
    closeRowMenus()
    return true
  }

  if (action === 'notification-view-detail') {
    const notificationId = actionNode.dataset.id
    if (notificationId) {
      state.notificationDetailId = notificationId
    }
    closeRowMenus()
    return true
  }

  if (action === 'urge-view-detail') {
    const urgeId = actionNode.dataset.id
    if (urgeId) {
      state.urgeDetailId = urgeId
    }
    closeRowMenus()
    return true
  }

  if (action === 'urge-resend') {
    const urgeId = actionNode.dataset.id
    if (urgeId) {
      state.resendUrgeId = urgeId
    }
    closeRowMenus()
    return true
  }

  if (action === 'urge-goto') {
    const urgeId = actionNode.dataset.id
    const urge = urgeId ? getUrgeById(urgeId) : undefined
    if (urge) {
      openDeepLink(urge.deepLink, URGE_TYPE_LABEL[urge.urgeType])
    }
    closeRowMenus()
    return true
  }

  if (action === 'urge-view-material') {
    openMaterialPage(actionNode.dataset.po || '')
    closeRowMenus()
    return true
  }

  if (action === 'close-notification-detail') {
    state.notificationDetailId = null
    return true
  }

  if (action === 'notification-detail-mark-read') {
    const notificationId = actionNode.dataset.id
    if (notificationId) {
      markNotificationRead(notificationId)
      showProgressUrgeToast('已标记为已读')
    }
    return true
  }

  if (action === 'notification-detail-handle') {
    const notificationId = actionNode.dataset.id
    const notification = notificationId ? getNotificationById(notificationId) : undefined
    if (notification) {
      openDeepLink(notification.deepLink, notification.title)
      state.notificationDetailId = null
    }
    return true
  }

  if (action === 'close-urge-detail') {
    state.urgeDetailId = null
    return true
  }

  if (action === 'urge-detail-resend') {
    const urgeId = actionNode.dataset.id
    if (urgeId) {
      state.resendUrgeId = urgeId
      state.urgeDetailId = null
    }
    return true
  }

  if (action === 'urge-detail-goto') {
    const urgeId = actionNode.dataset.id
    const urge = urgeId ? getUrgeById(urgeId) : undefined
    if (urge) {
      openDeepLink(urge.deepLink, URGE_TYPE_LABEL[urge.urgeType])
      state.urgeDetailId = null
    }
    return true
  }

  if (action === 'close-new-urge') {
    state.newUrgeOpen = false
    resetForm()
    return true
  }

  if (action === 'send-urge') {
    handleSendUrge()
    return true
  }

  if (action === 'new-urge-view-material') {
    openMaterialPage(actionNode.dataset.po || '')
    return true
  }

  if (action === 'close-resend-dialog') {
    state.resendUrgeId = null
    return true
  }

  if (action === 'confirm-resend') {
    handleResend()
    return true
  }

  return false
}

export function renderProgressUrgePage(): string {
  syncFromQuery()

  const filteredNotifications = getFilteredNotifications()
  const filteredUrges = getFilteredUrges()
  const kpi = getKpiStats()

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderKpiCards(kpi)}
      ${renderTabs(kpi)}
      ${state.activeTab === 'inbox' ? renderInboxTab(filteredNotifications) : renderOutboxTab(filteredUrges)}
      ${renderNotificationDetailDrawer()}
      ${renderUrgeDetailDrawer()}
      ${renderNewUrgeDrawer()}
      ${renderResendDialog()}
    </div>
  `
}

export function handleProgressUrgeEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-urge-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.urgeField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-urge-action]')
  if (!actionNode) {
    if (state.notificationMenuId || state.urgeMenuId) {
      closeRowMenus()
      return true
    }
    return false
  }

  const action = actionNode.dataset.urgeAction
  if (!action) return false

  return handleAction(action, actionNode)
}

export function isProgressUrgeDialogOpen(): boolean {
  return Boolean(state.notificationDetailId || state.urgeDetailId || state.newUrgeOpen || state.resendUrgeId)
}
