const specialCraftOrders = /^\/fcs\/process-factory\/special-craft\/(?:aux-op-(?:embroidery|strip|pleating|dalan|heat-transfer|direct-print|seam-embroidery|button-loop|covered-button-making|flower-making|gathering|hotfix-rhinestone)|spc-op-(?:template-process|laser-pocket|pattern-machine-sewing|elastic-fixed-length-cutting))\/work-orders(?:\/[^/]+)?\/?$/
const woolStageOrders = /^\/fcs\/craft\/wool\/(?:knitting-orders|linking-orders)(?:\/[^/]+)?\/?$/
const woolPendingReceipts = /^\/fcs\/(?:craft|pda)\/wool\/pending-receipts\/?$/
const craftSourceReports = /^\/fcs\/(?:settlement\/(?:adjustments|statements)|quality\/deduction-analysis|craft\/dyeing\/reports)$/

/** Identify the bounded craft read entry without loading any business domain. */
export function isIsolatedCraftReadEntry(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? ''
  if (specialCraftOrders.test(path) || woolStageOrders.test(path) || woolPendingReceipts.test(path) || craftSourceReports.test(path)) {
    return true
  }

  const executionTask = path.match(/^\/fcs\/pda\/exec\/([^/]+)\/?$/)?.[1]
  if (!executionTask) return false
  try {
    return /:(KNITTING|LINKING)$/.test(decodeURIComponent(executionTask))
  } catch {
    return false
  }
}
