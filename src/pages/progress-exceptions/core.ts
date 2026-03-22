import { syncPdaStartRiskAndExceptions, syncMilestoneOverdueExceptions, syncFromQuery, filterCases, getKpis, getAggregates } from './context'
import { syncExceptionResolvedByBusiness } from './actions'
import { renderHeader, renderUpstreamHint, renderKpiCards, renderAggregateCards, renderCategoryQuickSwitch, renderFilters, renderTable } from './overview-domain'
import { renderDetailDrawer, renderCloseDialog, renderUnblockDialog, renderExtendDialog, renderPauseFollowUpDialog } from './detail-domain'

export function renderProgressExceptionsPage(): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
  syncFromQuery()
  syncExceptionResolvedByBusiness()

  const now = new Date()
  const filtered = filterCases()
  const kpis = getKpis(now)
  const aggregates = getAggregates()

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderUpstreamHint()}
      ${renderKpiCards(kpis)}
      ${renderAggregateCards(aggregates)}
      ${renderCategoryQuickSwitch()}
      ${renderFilters()}
      ${renderTable(filtered)}
      ${renderDetailDrawer()}
      ${renderCloseDialog()}
      ${renderUnblockDialog()}
      ${renderExtendDialog()}
      ${renderPauseFollowUpDialog()}
    </div>
  `
}
