export function renderUnifiedPrintStyles(): string {
  return `
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm;
      }

      .print-preview-root {
        min-height: 100vh;
        background: #f1f5f9;
        color: #111827;
      }

      .print-preview-toolbar {
        margin: 0 auto;
        max-width: 210mm;
        padding: 16px 0;
      }

      .print-paper-a4 {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto 24px;
        background: #fff;
        color: #111827;
        box-shadow: 0 20px 60px rgb(15 23 42 / 14%);
      }

      .print-card-sheet {
        padding: 10mm;
        font-family: Arial, "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
        font-size: 11px;
        line-height: 1.45;
      }

      .print-card-title {
        font-size: 21px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .print-card-subtitle {
        margin-top: 4px;
        color: #475569;
        font-size: 11px;
      }

      .print-section {
        margin-top: 10px;
        break-inside: avoid;
      }

      .print-section-title {
        margin-bottom: 5px;
        border-left: 3px solid #111827;
        padding-left: 6px;
        font-size: 12px;
        font-weight: 700;
      }

      .print-field-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-left: 1px solid #111827;
        border-top: 1px solid #111827;
      }

      .print-field {
        min-height: 28px;
        border-right: 1px solid #111827;
        border-bottom: 1px solid #111827;
        padding: 4px 5px;
      }

      .print-field-label {
        color: #475569;
        font-size: 9px;
      }

      .print-field-value {
        margin-top: 1px;
        font-size: 10.5px;
        font-weight: 600;
      }

      .print-field-emphasis .print-field-value {
        font-size: 11px;
        font-weight: 700;
      }

      .print-main-grid {
        display: grid;
        grid-template-columns: 38mm 1fr 34mm;
        gap: 8px;
        margin-top: 10px;
        align-items: stretch;
      }

      .print-production-header {
        display: grid;
        grid-template-columns: 1fr 34mm;
        gap: 8px;
        align-items: start;
      }

      .print-production-image-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .print-production-image-grid-prominent {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .print-production-image-card {
        margin: 0;
        border: 1px solid #111827;
        padding: 4px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .print-production-image-card figcaption {
        margin-bottom: 3px;
        font-size: 9.5px;
        font-weight: 700;
      }

      .print-production-image-frame {
        display: flex;
        height: 30mm;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        background: #fff;
      }

      .print-production-image-grid-prominent .print-production-image-frame {
        height: 38mm;
      }

      .print-production-image-frame img {
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
      }

      .print-production-table th,
      .print-production-table td {
        overflow-wrap: anywhere;
      }

      .print-production-barcode {
        margin-top: 4px;
        overflow-wrap: anywhere;
        border-top: 1px solid #111827;
        padding-top: 3px;
        font-size: 7.5px;
      }

      .print-image-box,
      .print-qr-box {
        border: 1px solid #111827;
        padding: 5px;
        break-inside: avoid;
      }

      .print-image-frame {
        display: flex;
        height: 36mm;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        background: #fff;
      }

      .print-image-frame img {
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
      }

      .print-image-placeholder {
        display: flex;
        height: 22mm;
        align-items: center;
        justify-content: center;
        border: 1px dashed #94a3b8;
        color: #64748b;
        font-size: 10px;
      }

      .print-qr-inner {
        display: flex;
        min-height: 36mm;
        align-items: center;
        justify-content: center;
      }

      .print-qr-inner svg {
        height: 30mm;
        width: 30mm;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #111827;
        padding: 4px 5px;
        text-align: left;
        vertical-align: top;
      }

      .print-table th {
        background: #f8fafc;
        color: #334155;
        font-size: 9.5px;
        font-weight: 700;
      }

      .print-table td {
        min-height: 22px;
        font-size: 10px;
      }

      .print-table tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .print-note {
        margin-top: 5px;
        color: #475569;
        font-size: 10px;
      }

      .print-signatures {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .print-signature-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
      }

      .print-signature-cell {
        min-height: 24mm;
        border: 1px solid #111827;
        padding: 5px;
        break-inside: avoid;
      }

      .print-signature-label {
        color: #334155;
        font-size: 10px;
        font-weight: 700;
      }

      .print-signature-role {
        margin-top: 12mm;
        border-top: 1px solid #111827;
        padding-top: 3px;
        font-size: 10px;
      }

      .print-signature-box {
        min-height: 28mm;
        border: 1px solid #111827;
        padding: 5px;
        break-inside: avoid;
      }

      .print-signature-line {
        margin-top: 14mm;
        border-top: 1px solid #111827;
        padding-top: 3px;
      }

      .print-footer-fields {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
        border-top: 1px solid #111827;
        padding-top: 6px;
        color: #475569;
        font-size: 9px;
      }

      .print-label-paper {
        margin: 0 auto 20px;
        background: #fff;
        color: #111827;
        box-shadow: 0 14px 40px rgb(15 23 42 / 14%);
      }

      .print-label-single-sheet {
        height: 100%;
        padding: 2mm;
        font-family: Arial, "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      }

      .label-paper-label-80-50 {
        width: 80mm;
        min-height: 50mm;
      }

      .label-paper-label-100-60 {
        width: 100mm;
        min-height: 60mm;
      }

      .label-paper-label-60-40 {
        width: 60mm;
        min-height: 40mm;
      }

      .print-label-grid-a4 {
        padding: 8mm;
      }

      .print-label-grid-sheet {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4mm;
        font-family: Arial, "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      }

      .print-label-card {
        min-height: 46mm;
        border: 1px solid #111827;
        padding: 2mm;
        background: #fff;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .print-label-card.label-paper-a4-label-grid {
        min-height: 50mm;
      }

      .print-label-card-void {
        border-width: 2px;
      }

      .print-label-card-reprint {
        border-style: dashed;
      }

      .print-label-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 6px;
        border-bottom: 1px solid #111827;
        padding-bottom: 2mm;
      }

      .print-label-title {
        font-size: 14px;
        font-weight: 800;
        line-height: 1.1;
      }

      .print-label-subtitle {
        margin-top: 1mm;
        color: #475569;
        font-size: 8px;
      }

      .print-label-mode {
        border: 1px solid #111827;
        padding: 1mm 2mm;
        font-size: 9px;
        font-weight: 700;
        white-space: nowrap;
      }

      .print-label-body {
        display: grid;
        grid-template-columns: 1fr 28mm;
        gap: 2mm;
        margin-top: 2mm;
      }

      .label-paper-label-100-60 .print-label-body {
        grid-template-columns: 1fr 31mm;
      }

      .print-label-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1mm 2mm;
      }

      .print-label-field {
        min-width: 0;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 0.5mm;
      }

      .print-label-field span {
        display: block;
        color: #64748b;
        font-size: 7px;
        line-height: 1.15;
      }

      .print-label-field strong {
        display: block;
        overflow-wrap: anywhere;
        color: #111827;
        font-size: 8.5px;
        line-height: 1.15;
      }

      .print-label-field-emphasis strong {
        font-size: 9.5px;
      }

      .print-label-qr-panel {
        text-align: center;
      }

      .print-label-qr {
        display: flex;
        min-height: 26mm;
        align-items: center;
        justify-content: center;
        border: 1px solid #111827;
      }

      .print-label-qr svg {
        height: 26mm;
        width: 26mm;
      }

      .label-paper-label-100-60 .print-label-qr svg {
        height: 30mm;
        width: 30mm;
      }

      .print-label-qr-desc {
        margin-top: 1mm;
        font-size: 7px;
      }

      .print-label-barcode {
        margin-top: 1mm;
      }

      .print-label-barcode-lines {
        height: 7mm;
        background: repeating-linear-gradient(90deg, #111827 0 1px, #fff 1px 3px, #111827 3px 4px, #fff 4px 6px);
      }

      .print-label-barcode-text {
        overflow-wrap: anywhere;
        font-size: 6.5px;
      }

      .print-label-warnings {
        display: flex;
        flex-wrap: wrap;
        gap: 1mm;
        margin-top: 2mm;
      }

      .print-label-warnings span {
        border: 1px solid #111827;
        padding: 0.5mm 1mm;
        font-size: 7px;
        font-weight: 700;
      }

      @media print {
        html,
        body {
          background: #fff !important;
        }

        body * {
          visibility: hidden !important;
        }

        .print-preview-root,
        .print-preview-root * {
          visibility: visible !important;
        }

        .print-preview-root {
          position: absolute;
          inset: 0;
          min-height: 0 !important;
          background: #fff !important;
        }

        .print-hidden,
        .print-hidden * {
          display: none !important;
          visibility: hidden !important;
        }

        .print-paper-a4 {
          width: auto;
          min-height: auto;
          margin: 0;
          box-shadow: none;
        }

        .print-label-paper {
          margin: 0;
          box-shadow: none;
        }

        .print-card-sheet {
          padding: 0;
        }

        .print-label-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    </style>
  `
}
