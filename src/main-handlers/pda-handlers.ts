import { handlePdaNotifyEvent } from '../pages/pda-notify'
import { handlePdaNotifyDueSoonEvent } from '../pages/pda-notify-due-soon'
import { handlePdaNotifyDetailEvent } from '../pages/pda-notify-detail'
import { handlePdaTaskReceiveEvent } from '../pages/pda-task-receive'
import { handlePdaTaskReceiveDetailEvent } from '../pages/pda-task-receive-detail'
import { handlePdaExecEvent } from '../pages/pda-exec'
import { handlePdaExecDetailEvent } from '../pages/pda-exec-detail'
import { handlePdaHandoverEvent } from '../pages/pda-handover'
import { handlePdaHandoverDetailEvent } from '../pages/pda-handover-detail'
import { handlePdaSettlementEvent } from '../pages/pda-settlement'

export function dispatchPdaPageEvent(target: HTMLElement): boolean {
  return (
    handlePdaNotifyEvent(target) ||
    handlePdaNotifyDueSoonEvent(target) ||
    handlePdaNotifyDetailEvent(target) ||
    handlePdaTaskReceiveEvent(target) ||
    handlePdaTaskReceiveDetailEvent(target) ||
    handlePdaExecEvent(target) ||
    handlePdaExecDetailEvent(target) ||
    handlePdaHandoverEvent(target) ||
    handlePdaHandoverDetailEvent(target) ||
    handlePdaSettlementEvent(target)
  )
}

export function closePdaDialogsOnEscape(): boolean {
  return false
}
