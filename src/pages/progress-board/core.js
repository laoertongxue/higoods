import {
  state,
  syncPdaStartRiskAndExceptions,
  syncMilestoneOverdueExceptions,
  syncPresetFromQuery,
  resetTaskBoardSummaryCache,
  getFilteredTasks,
  getPoViewRows,
  renderBadge,
  escapeHtml
} from "./context.ts";
import { renderTaskDimension, renderTaskDrawer, renderBlockDialog, renderBatchConfirmDialog } from "./task-domain.ts";
import { renderOrderDimension, renderOrderDrawer } from "./order-domain.ts";
import { getProgressStatisticsDashboard } from "../../data/fcs/progress-statistics-linkage.ts";
import { listPlatformPostFinishingResultViews } from "../../data/fcs/platform-process-result-view.ts";
import { PLATFORM_PROCESS_STATUS_CLASS } from "../../data/fcs/process-platform-status-adapter.ts";
function renderProductionProgressLinkage() {
  const dashboard = getProgressStatisticsDashboard();
  const { kpiSummary, productionSnapshots } = dashboard;
  const visibleRows = productionSnapshots.slice(0, 8);
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">\u751F\u4EA7\u8FDB\u5EA6</h2>
          <p class="mt-1 text-xs text-muted-foreground">\u8FDB\u5EA6\u603B\u89C8\u8054\u52A8\u751F\u4EA7\u5355\u3001\u88C1\u5E8A\u3001\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u3001\u4EA4\u51FA\u5355\u3001\u8F66\u7F1D\u56DE\u5199\u3001\u4EA4\u63A5\u5DEE\u5F02\u4E0E\u5DE5\u5382\u4ED3\u5E93\u6570\u636E\u3002</p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span class="rounded-full border px-2 py-1">\u98CE\u9669\u539F\u56E0</span>
          <span class="rounded-full border px-2 py-1">\u4EA4\u51FA\u540E\u7ED3\u679C</span>
          <span class="rounded-full border px-2 py-1">\u7D27\u6025\u7A0B\u5EA6</span>
        </div>
      </div>
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-9">
        ${[
    ["\u751F\u4EA7\u5355\u603B\u6570", kpiSummary.totalProductionOrders],
    ["\u751F\u4EA7\u4E2D", kpiSummary.inProgressOrders],
    ["\u6709\u98CE\u9669", kpiSummary.blockedOrders],
    ["\u53EF\u4EA4\u51FA", kpiSummary.readyForSewingDispatchOrders],
    ["\u90E8\u5206\u4EA4\u51FA", kpiSummary.partiallyDispatchedOrders],
    ["\u5DF2\u5168\u90E8\u4EA4\u51FA", kpiSummary.fullyDispatchedOrders],
    ["\u5DEE\u5F02", kpiSummary.differenceOrders],
    ["\u5F02\u8BAE\u4E2D", kpiSummary.objectionOrders],
    ["\u7D27\u6025", kpiSummary.urgentOrders]
  ].map(([label, value]) => `
            <article class="rounded-lg border bg-background px-3 py-3">
              <div class="text-xs text-muted-foreground">${label}</div>
              <div class="mt-1 text-lg font-semibold text-foreground">${value}</div>
            </article>
          `).join("")}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1480px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${["\u751F\u4EA7\u5355", "\u6B3E\u5F0F", "\u751F\u4EA7\u6570\u91CF", "\u4EA4\u671F", "\u7D27\u6025\u7A0B\u5EA6", "\u9762\u6599\u914D\u7F6E", "\u88C1\u5E8A\u9886\u6599", "\u88C1\u526A", "\u83F2\u7968", "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3", "\u4EA4\u51FA\u5355", "\u8F66\u7F1D\u56DE\u5199", "\u98CE\u9669\u4E0E\u5DEE\u5F02", "\u4E0B\u4E00\u6B65", "\u64CD\u4F5C"].map((item) => `<th class="px-3 py-2 font-medium">${item}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${visibleRows.map(
    (row) => {
      const productionOrderNo = row.productionOrderNo || row.productionOrderId || "\u5F85\u5173\u8054\u751F\u4EA7\u5355";
      return `
                  <tr class="border-b align-top">
                    <td class="px-3 py-3 font-medium text-blue-700">${escapeHtml(productionOrderNo)}</td>
                    <td class="px-3 py-3">
                      <div>${row.styleNo}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${row.styleName}</div>
                    </td>
                    <td class="px-3 py-3">${row.totalQty}</td>
                    <td class="px-3 py-3">${row.dueDate || "\u5F85\u4EBA\u5DE5\u6838\u5BF9\uFF1A\u7F3A\u5C11\u4EA4\u671F"}</td>
                    <td class="px-3 py-3">${renderBadge(row.urgencyLevel, row.urgencyLevel.includes("\u7D27\u6025") || row.urgencyLevel === "\u5341\u4E07\u706B\u6025" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700")}</td>
                    <td class="px-3 py-3">${row.materialPrepStatus}</td>
                    <td class="px-3 py-3">${row.cuttingPickupStatus}</td>
                    <td class="px-3 py-3">${row.cuttingStatus}</td>
                    <td class="px-3 py-3">${row.feiTicketStatus}</td>
                    <td class="px-3 py-3">${row.specialCraftReturnStatus}</td>
                    <td class="px-3 py-3">${row.sewingDispatchStatus}</td>
                    <td class="px-3 py-3">${row.sewingReceiveStatus}</td>
                    <td class="px-3 py-3">${row.blockingReasons.length ? row.blockingReasons.slice(0, 2).map((item) => item.blockingLabel).join("\u3001") : "\u6682\u65E0\u98CE\u9669"}</td>
                    <td class="px-3 py-3">${row.nextActionLabel}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/production/orders/${encodeURIComponent(row.productionOrderId)}">\u67E5\u770B\u751F\u4EA7\u5355</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/craft/cutting/production-progress">\u67E5\u770B\u88C1\u5E8A\u8FDB\u5EA6</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders">\u67E5\u770B\u4EA4\u51FA\u5355</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-route="/fcs/progress/handover">\u67E5\u770B\u4EA4\u63A5\u8BB0\u5F55</button>
                      </div>
                    </td>
                  </tr>
                `;
    }
  ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderPostFinishingPlatformResults() {
  const rows = listPlatformPostFinishingResultViews().slice(0, 8);
  if (rows.length === 0) return "";
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">\u540E\u9053\u5E73\u53F0\u7ED3\u679C</h2>
          <p class="mt-1 text-xs text-muted-foreground">\u5E73\u53F0\u4FA7\u53EA\u770B\u540E\u9053\u805A\u5408\u72B6\u6001\u3001\u98CE\u9669\u3001\u8DDF\u5355\u52A8\u4F5C\u3001\u4EA4\u51FA\u548C\u5DEE\u5F02\u7ED3\u679C\u3002</p>
        </div>
        <div class="text-xs text-muted-foreground">\u7EDF\u4E00\u7ED3\u679C\u89C6\u56FE\uFF1A\u540E\u9053\u5355 / \u8D28\u68C0\u5355 / \u590D\u68C0\u5355</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              ${["\u540E\u9053\u5355\u53F7", "\u751F\u4EA7\u5355", "\u5E73\u53F0\u72B6\u6001", "\u5DE5\u5382\u5185\u90E8\u72B6\u6001", "\u98CE\u9669\u63D0\u793A", "\u4E0B\u4E00\u6B65\u52A8\u4F5C", "\u5F53\u524D\u8D23\u4EFB\u65B9", "\u5173\u952E\u6570\u91CF", "\u540C\u6B65\u7ED3\u679C", "\u6700\u65B0\u6765\u6E90"].map((item) => `<th class="px-3 py-2 font-medium">${item}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
    const quantityText = row.quantityDisplayFields.slice(0, 4).map((field) => field.text).join("\uFF1B");
    const linkedResult = [
      row.hasWaitProcessRecord ? "\u5F85\u52A0\u5DE5\u4ED3" : "",
      row.hasWaitHandoverRecord ? "\u5F85\u4EA4\u51FA\u4ED3" : "",
      row.hasHandoverRecord ? "\u4EA4\u51FA\u8BB0\u5F55" : "",
      row.hasReviewRecord ? "\u5BA1\u6838\u8BB0\u5F55" : "",
      row.hasDifferenceRecord ? "\u5DEE\u5F02\u8BB0\u5F55" : ""
    ].filter(Boolean).join(" / ") || "\u6682\u65E0\u4ED3\u4EA4\u51FA\u7ED3\u679C";
    return `
                <tr class="border-b align-top">
                  <td class="px-3 py-3 font-medium text-blue-700">${row.workOrderNo}</td>
                  <td class="px-3 py-3">${row.productionOrderNo}</td>
                  <td class="px-3 py-3">${renderBadge(row.platformStatusLabel, PLATFORM_PROCESS_STATUS_CLASS[row.platformStatusLabel])}</td>
                  <td class="px-3 py-3">\u5DE5\u5382\u5185\u90E8\u72B6\u6001\uFF1A${row.factoryInternalStatusLabel}</td>
                  <td class="px-3 py-3">${row.platformRiskLabel}</td>
                  <td class="px-3 py-3">${row.platformActionHint}<div class="mt-1 text-xs text-muted-foreground">\u8DDF\u5355\u52A8\u4F5C\uFF1A${row.followUpActionLabel}</div></td>
                  <td class="px-3 py-3">${row.platformOwnerHint}</td>
                  <td class="px-3 py-3">${quantityText}</td>
                  <td class="px-3 py-3">${linkedResult}</td>
                  <td class="px-3 py-3">${row.latestOperationChannel || "\u2014"}</td>
                </tr>
              `;
  }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderHeader(filteredTasks) {
  const selectedCount = state.selectedTaskIds.length;
  return `
    <header class="flex items-center justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="kanban-square" class="h-5 w-5"></i>
          \u4EFB\u52A1\u8FDB\u5EA6\u770B\u677F
        </h1>
        <p class="text-sm text-muted-foreground">\u6309\u4EFB\u52A1/\u751F\u4EA7\u5355\u53CC\u7EF4\u5EA6\u8FFD\u8E2A\u6267\u884C\u8FDB\u5EA6\u3001\u751F\u4EA7\u6682\u505C\u4E0E\u98CE\u9669</p>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex rounded-md border">
          <button class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.dimension === "task" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}" data-progress-action="switch-dimension" data-dimension="task">
            <i data-lucide="clipboard-list" class="mr-1.5 h-4 w-4"></i>\u4EFB\u52A1\u7EF4\u5EA6
          </button>
          <button class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.dimension === "order" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}" data-progress-action="switch-dimension" data-dimension="order">
            <i data-lucide="layers" class="mr-1.5 h-4 w-4"></i>\u751F\u4EA7\u5355\u7EF4\u5EA6
          </button>
        </div>

        ${state.dimension === "task" && selectedCount > 0 ? `
              ${renderBadge(`\u5DF2\u9009\u62E9 ${selectedCount} \u9879`, "border-border bg-background text-foreground")}
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-urge">
                <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>\u6279\u91CF\u50AC\u529E
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-start">
                <i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>\u6279\u91CF\u6807\u8BB0\u5F00\u59CB
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-finish">
                <i data-lucide="check-circle-2" class="mr-1.5 h-4 w-4"></i>\u6279\u91CF\u6807\u8BB0\u5B8C\u5DE5
              </button>
            ` : ""}

        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>\u5237\u65B0
        </button>

        <div class="flex rounded-md border">
          <button class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}" data-progress-action="switch-view" data-view="list">
            <i data-lucide="list" class="mr-1.5 h-4 w-4"></i>\u5217\u8868\u89C6\u56FE
          </button>
          <button class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}" data-progress-action="switch-view" data-view="kanban">
            <i data-lucide="kanban-square" class="mr-1.5 h-4 w-4"></i>\u770B\u677F\u89C6\u56FE
          </button>
        </div>
      </div>
    </header>
  `;
}
function renderProgressBoardPage() {
  syncPdaStartRiskAndExceptions();
  syncMilestoneOverdueExceptions();
  syncPresetFromQuery();
  resetTaskBoardSummaryCache();
  const filteredTasks = getFilteredTasks();
  const poRows = getPoViewRows();
  return `
    <div class="space-y-4">
      ${renderHeader(filteredTasks)}
      ${state.dimension === "task" ? renderTaskDimension(filteredTasks) : renderOrderDimension(poRows)}
      ${renderTaskDrawer()}
      ${renderOrderDrawer(poRows)}
      ${renderBlockDialog()}
      ${renderBatchConfirmDialog()}
    </div>
  `;
}
export {
  renderProgressBoardPage
};
