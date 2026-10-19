# Stage23 QC rendered identity collector failure

Actual QC_ORDER cold594.8ms reached source/geometry verification. Its only failed content assertion was Printed document identity mismatch; expected QC document number was now correct. Actual geometry, factory, production style, price, materials, image and size assertions passed. It remains an invalid acceptance sample and the phase stopped. OUTBOUND_BARCODE1000cold750.8ms/PDF371.8ms and POST_ORDER612.2ms passed all applicable checks.

The existing QC master/detail template places documentNo on data-print-document-no and passes it to renderCode128Barcode. renderBarcode emits only an SVG. real-barcode.ts returns bars plus aria-label/data-barcode-value; no documentNo text child is rendered. The common collector requires body.textContent to contain documentNo, incorrectly rejecting a correctly bound barcode/root identity. The existing subsequent actual CODE128-value assertion passed. The productionOrderNo text remains a real visible field.

A minimal identity-equivalent collector can use exact root data-print-document-no plus the existing exact barcode-value check, retaining productionOrderNo body text and all other source/geometry requirements. No product/collector change was made here. Root chooses the fix; no fresh browser or CPU profile is authorized or started.

QC_DETAIL,15routepreflight and formal100/520 remain pending; browser closed and window released.
