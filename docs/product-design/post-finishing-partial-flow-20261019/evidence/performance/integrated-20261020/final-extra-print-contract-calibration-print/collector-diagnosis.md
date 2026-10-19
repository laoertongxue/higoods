# Stage22 QC identity collector failure

Fixed QC row PF-QC-PF-ACCEPT-PO-1-1 also legitimately contains postTaskId PF-POST-PF-ACCEPT-PO-1-1 and both corresponding task numbers. The collector selected the qcTasks collection but compared `(row.postTaskId||row.qcTaskId)` to the QC ID. This picked the post ID first, so no matching source could be found. The subsequent expected document number used the same incorrect fallback and must likewise be selected explicitly by print type. This is a collector source identity error, with no wrong QC business record or wrong printed document established.

Prior1000barcode cold796.3ms/PDF378.4ms and POST_ORDER cold635.0ms passed actual source/geometry. QC_ORDER614.5ms timing reached completion, then expectation construction failed; it lacks completed source/geometry validation and must not count as accepted. Its existing report sample timing pass=true is not sufficient; overall phase error is retained. No next QC_DETAIL/route/formal run occurred.

No product or collector changes were made by the performance agent. Browser closed and window released. Exact collector and source manifest copies are retained.
