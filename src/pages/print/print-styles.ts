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

        .print-card-sheet {
          padding: 0;
        }
      }
    </style>
  `
}
