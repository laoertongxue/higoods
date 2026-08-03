import { closePdaShellDialogsOnEscape, handlePdaShellEvent } from '../pages/pda-shell'
import { handlePdaLoginEvent } from '../pages/pda-login'
import { handlePdaOnboardingEvent } from '../pages/pda-onboarding'
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
import { handlePdaSewingSelfReturnEvent } from '../pages/pda-sewing-self-return'
import { handlePdaSettlementEvent } from '../pages/pda-settlement'
import { handlePdaWarehouseEvent } from '../pages/pda-warehouse'
import { handlePdaWarehouseWaitProcessEvent } from '../pages/pda-warehouse-wait-process'
import { handlePdaWarehouseWaitHandoverEvent } from '../pages/pda-warehouse-wait-handover'
import { handlePdaWarehouseInboundRecordsEvent } from '../pages/pda-warehouse-inbound-records'
import { handlePdaWarehouseOutboundRecordsEvent } from '../pages/pda-warehouse-outbound-records'
import { handlePdaWarehouseStocktakeEvent } from '../pages/pda-warehouse-stocktake'
import { handlePdaCuttingTaskDetailEvent } from '../pages/pda-cutting-task-detail'
import { handlePdaCuttingExecutionUnitEvent } from '../pages/pda-cutting-execution-unit'
import { handlePdaCuttingSpreadingEvent } from '../pages/pda-cutting-spreading'
import { handlePdaCuttingInboundEvent } from '../pages/pda-cutting-inbound'
import { handlePdaCuttingHandoverEvent } from '../pages/pda-cutting-handover'
import { handlePdaCuttingTransferBagRepackEvent } from '../pages/pda-cutting-transfer-bag-repack'
import { handlePdaCuttingTransferBagRecoveryEvent } from '../pages/pda-cutting-transfer-bag-recovery'
import { handlePdaCuttingTransferBagScrapEvent } from '../pages/pda-cutting-transfer-bag-scrap'
import { showPdaWarehouseActionToast } from '../pages/pda-warehouse-shared'
import { normalizePdaPageEventResult } from './pda-local-action-result'

export async function dispatchPdaPageEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  try {
    return normalizePdaPageEventResult(
      await handlePdaShellEvent(target) ||
      await handlePdaLoginEvent(target) ||
      await handlePdaOnboardingEvent(target) ||
      await handlePdaNotifyEvent(target) ||
      await handlePdaNotifyDueSoonEvent(target) ||
      await handlePdaNotifyDetailEvent(target) ||
      await handlePdaQualityEvent(target) ||
      await handlePdaTaskReceiveEvent(target) ||
      await handlePdaTaskReceiveDetailEvent(target) ||
      await handlePdaExecEvent(target) ||
      await handlePdaExecDetailEvent(target) ||
      await handlePdaWarehouseEvent(target) ||
      await handlePdaWarehouseWaitProcessEvent(target) ||
      await handlePdaWarehouseWaitHandoverEvent(target) ||
      await handlePdaWarehouseInboundRecordsEvent(target) ||
      await handlePdaWarehouseOutboundRecordsEvent(target) ||
      await handlePdaWarehouseStocktakeEvent(target) ||
      await handlePdaCuttingTaskDetailEvent(target) ||
      await handlePdaCuttingExecutionUnitEvent(target) ||
      await handlePdaCuttingSpreadingEvent(target) ||
      await handlePdaCuttingInboundEvent(target, event) ||
      await handlePdaCuttingHandoverEvent(target, event) ||
      await handlePdaCuttingTransferBagRepackEvent(target) ||
      await handlePdaCuttingTransferBagRecoveryEvent(target) ||
      await handlePdaCuttingTransferBagScrapEvent(target) ||
      await handlePdaSewingSelfReturnEvent(target) ||
      await handlePdaHandoverEvent(target) ||
      await handlePdaHandoverDetailEvent(target) ||
      await handlePdaSettlementEvent(target),
    )
  } catch (error) {
    showPdaWarehouseActionToast(error instanceof Error ? error.message : 'PDA 操作失败，请按最新页面重试。')
    return true
  }
}

export function closePdaDialogsOnEscape(): boolean {
  return closePdaShellDialogsOnEscape()
}
