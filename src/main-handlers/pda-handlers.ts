import { handlePdaNotifyEvent } from '../pages/pda-notify'
import { handlePdaNotifyDueSoonEvent } from '../pages/pda-notify-due-soon'
import { handlePdaNotifyDetailEvent } from '../pages/pda-notify-detail'
import { handlePdaQualityEvent } from '../pages/pda-quality'
import { handlePdaTaskReceiveEvent } from '../pages/pda-task-receive'
import { handlePdaTaskReceiveDetailEvent } from '../pages/pda-task-receive-detail'
import { handlePdaExecEvent } from '../pages/pda-exec'
import { handlePdaExecDetailEvent } from '../pages/pda-exec-detail'
import { handlePdaHandoverEvent } from '../pages/pda-handover'
import { handlePdaHandoverDetailEvent } from '../pages/pda-handover-detail'
import { handlePdaSettlementEvent } from '../pages/pda-settlement'
import { handlePdaCuttingTaskDetailEvent } from '../pages/pda-cutting-task-detail'
import { handlePdaCuttingPickupEvent } from '../pages/pda-cutting-pickup'
import { handlePdaCuttingSpreadingEvent } from '../pages/pda-cutting-spreading'
import { handlePdaCuttingInboundEvent } from '../pages/pda-cutting-inbound'
import { handlePdaCuttingHandoverEvent } from '../pages/pda-cutting-handover'
import { handlePdaCuttingReplenishmentFeedbackEvent } from '../pages/pda-cutting-replenishment-feedback'

export function dispatchPdaPageEvent(target: HTMLElement): boolean {
  return (
    handlePdaNotifyEvent(target) ||
    handlePdaNotifyDueSoonEvent(target) ||
    handlePdaNotifyDetailEvent(target) ||
    handlePdaQualityEvent(target) ||
    handlePdaTaskReceiveEvent(target) ||
    handlePdaTaskReceiveDetailEvent(target) ||
    handlePdaExecEvent(target) ||
    handlePdaExecDetailEvent(target) ||
    handlePdaCuttingTaskDetailEvent(target) ||
    handlePdaCuttingPickupEvent(target) ||
    handlePdaCuttingSpreadingEvent(target) ||
    handlePdaCuttingInboundEvent(target) ||
    handlePdaCuttingHandoverEvent(target) ||
    handlePdaCuttingReplenishmentFeedbackEvent(target) ||
    handlePdaHandoverEvent(target) ||
    handlePdaHandoverDetailEvent(target) ||
    handlePdaSettlementEvent(target)
  )
}

export function closePdaDialogsOnEscape(): boolean {
  return false
}
