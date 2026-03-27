export const CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY = 'cuttingSpecialProcessOrders'
export const CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY = 'cuttingSpecialProcessBindingPayloads'
export const CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY = 'cuttingSpecialProcessAuditTrail'
export const CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY = 'cuttingSpecialProcessScopeLines'
export const CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY = 'cuttingSpecialProcessExecutionLogs'
export const CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY = 'cuttingSpecialProcessFollowupActions'

function parseArray(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
  } catch {
    return []
  }
}

export const deserializeSpecialProcessOrdersStorage = parseArray
export const deserializeBindingStripPayloadsStorage = parseArray
export const deserializeSpecialProcessScopeLinesStorage = parseArray
export const deserializeSpecialProcessExecutionLogsStorage = parseArray
export const deserializeSpecialProcessFollowupActionsStorage = parseArray
export const deserializeSpecialProcessAuditTrailStorage = parseArray
