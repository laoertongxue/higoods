# Stage21 POST_ORDER collector failure

Five actual1000-unit print types completed cold/content/geometry and PDF calibration. POST_ORDER cold635.3ms reached its actual content/geometry collector; geometry and every content assertion except factory passed. The sample remains pass=false and the phase stopped; no QC extra, route preflight or formal samples were attempted.

Root cause: collector printExpectation applies delivery.managedPostFactoryName (`PT Prima Printing Center`) to all extra documents, then common non-label check requires its text. The preserved POST_ORDER template (full-flow-print.ts201 onward) has no factory field: its page receives parent/QC/production/return/process quantities/all child numbers/time, plus frozen SKU rows. No wrong factory name is printed. This exact absence was not a product change introduced by stage21. The confirmed section5.6 requires the existing parent flow card plus per-item/multiple-child totals; it does not introduce a new parent factory field.

The failure is an inapplicable collector expectation, not a measured over1000ms event. No collector or product edit was made during diagnosis. The failed DOM body itself was not snapshotted before close; report.printChecks records the actual failed text inclusion and passed frozen field/geometry checks, while the preserved exact template shows the missing field. Do not call this an archived HTML snapshot.

Candidate fix for root review: scope factory assertion to document types that actually display it, keeping outbound and QC checks. No blanket weakening of printed object identity, quantities, source images, barcodes, children or geometry.

Browser and CPU window released after original report; evidence references retain stage21 source/index and8341 collector.
