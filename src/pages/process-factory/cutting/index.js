import { renderCraftCuttingProductionProgressPage } from "./production-progress.ts";
import { renderCraftCuttingCutOrdersPage } from "./cut-orders.ts";
import { renderCraftCuttingReplenishmentPage } from "./replenishment.ts";
import { renderCraftCuttingSummaryPage } from "./cutting-summary.ts";
import { renderCraftCuttingCuttablePoolPage } from "./cuttable-pool.ts";
import {
  renderCraftCuttingMarkerListPage,
  renderCraftCuttingMarkerCreatePage,
  renderCraftCuttingMarkerPlanEditPage,
  renderCraftCuttingMarkerPlanDetailPage
} from "./marker-plan.ts";
import {
  renderCraftCuttingSpreadingListPage,
  renderCraftCuttingSpreadingCreatePage,
  renderCraftCuttingMarkerSpreadingPage,
  renderCraftCuttingMarkerDetailPage,
  renderCraftCuttingMarkerEditPage,
  renderCraftCuttingSpreadingDetailPage,
  renderCraftCuttingSpreadingEditPage
} from "./marker-spreading.ts";
import {
  renderCraftCuttingFeiTicketsPage,
  renderCraftCuttingFeiTicketDetailPage,
  renderCraftCuttingFeiTicketPrintedPage,
  renderCraftCuttingFeiTicketRecordsPage,
  renderCraftCuttingFeiTicketPrintPage,
  renderCraftCuttingFeiTicketReprintPage,
  renderCraftCuttingFeiTicketVoidPage
} from "./fei-tickets.ts";
import { renderCraftCuttingSampleWarehousePage } from "./sample-warehouse.ts";
import {
  renderCraftCuttingWarehouseManagementWaitProcessPage,
  renderCraftCuttingWarehouseManagementWaitHandoverPage
} from "./warehouse-hub.ts";
import {
  renderCraftCuttingTransferBagsPage,
  renderCraftCuttingTransferBagDetailPage
} from "./transfer-bags.ts";
import {
  renderCraftCuttingHandoverOrdersPage,
  renderCraftCuttingHandoverOrderDetailPage,
  renderCraftCuttingHandoverOrderRecordsPage,
  renderCraftCuttingHandoverRecordDetailPage
} from "./handover-orders.ts";
import { renderCraftCuttingSpecialProcessesPage } from "./special-processes.ts";
import {
  CUTTING_PAGE_META,
  getCanonicalCuttingMeta,
  getCanonicalCuttingPath,
  isCuttingAliasPath,
  renderCuttingPageHeader
} from "./meta.ts";
export {
  CUTTING_PAGE_META,
  getCanonicalCuttingMeta,
  getCanonicalCuttingPath,
  isCuttingAliasPath,
  renderCraftCuttingCutOrdersPage,
  renderCraftCuttingCuttablePoolPage,
  renderCraftCuttingFeiTicketDetailPage,
  renderCraftCuttingFeiTicketPrintPage,
  renderCraftCuttingFeiTicketPrintedPage,
  renderCraftCuttingFeiTicketRecordsPage,
  renderCraftCuttingFeiTicketReprintPage,
  renderCraftCuttingFeiTicketVoidPage,
  renderCraftCuttingFeiTicketsPage,
  renderCraftCuttingHandoverOrderDetailPage,
  renderCraftCuttingHandoverOrderRecordsPage,
  renderCraftCuttingHandoverOrdersPage,
  renderCraftCuttingHandoverRecordDetailPage,
  renderCraftCuttingMarkerCreatePage,
  renderCraftCuttingMarkerDetailPage,
  renderCraftCuttingMarkerEditPage,
  renderCraftCuttingMarkerListPage,
  renderCraftCuttingMarkerPlanDetailPage,
  renderCraftCuttingMarkerPlanEditPage,
  renderCraftCuttingMarkerSpreadingPage,
  renderCraftCuttingProductionProgressPage,
  renderCraftCuttingReplenishmentPage,
  renderCraftCuttingSampleWarehousePage,
  renderCraftCuttingSpecialProcessesPage,
  renderCraftCuttingSpreadingCreatePage,
  renderCraftCuttingSpreadingDetailPage,
  renderCraftCuttingSpreadingEditPage,
  renderCraftCuttingSpreadingListPage,
  renderCraftCuttingSummaryPage,
  renderCraftCuttingTransferBagDetailPage,
  renderCraftCuttingTransferBagsPage,
  renderCraftCuttingWarehouseManagementWaitHandoverPage,
  renderCraftCuttingWarehouseManagementWaitProcessPage,
  renderCuttingPageHeader
};
