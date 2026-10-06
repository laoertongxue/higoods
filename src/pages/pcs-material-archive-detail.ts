// @page-pattern: detail
// Detail and edit pages use the same canonical SKU event chain; no root-level unit writer.
export {
 renderPcsMaterialArchiveDetailPage,
 renderPcsMaterialSkuDetailPage,
 renderPcsMaterialArchiveEditPage,
 renderPcsMaterialSkuEditPage,
 handlePcsMaterialArchiveEvent as handlePcsMaterialArchiveDetailEvent,
 handlePcsMaterialArchiveInput as handlePcsMaterialArchiveDetailInput,
 isPcsMaterialArchiveDialogOpen as isPcsMaterialArchiveDetailDialogOpen,
 resetPcsMaterialArchiveState as resetPcsMaterialArchiveDetailState,
} from './pcs-material-archives.ts'
