import type { AppState } from '../../../state/store'

/* ── types ── */
type ScanResult = 'success' | 'exception'
type ExceptionReason = '运单未找到' | '仓库不匹配' | '已出库' | '非成衣出库'

interface ScanRecord {
  id: string
  waybillNo: string
  expressCompany: string
  result: ScanResult
  exceptionReason?: ExceptionReason
  timestamp: string
}

/* ── constants ── */
const EXPRESS_COMPANIES = ['顺丰', '中通', '圆通', '韵达', '申通', '极兔'] as const

const BATCH_NO = 'SHIP-SCAN-20260918-001'

/* ── mock scan records (newest first) ── */
const MOCK_SCANS: ScanRecord[] = [
  { id: 's1', waybillNo: 'SF1098765432100', expressCompany: '顺丰', result: 'success', timestamp: '14:32:08' },
  { id: 's2', waybillNo: 'ZT2098765432200', expressCompany: '中通', result: 'success', timestamp: '14:31:45' },
  { id: 's3', waybillNo: 'YT3098765432300', expressCompany: '圆通', result: 'exception', exceptionReason: '运单未找到', timestamp: '14:31:12' },
  { id: 's4', waybillNo: 'SF1098765432400', expressCompany: '顺丰', result: 'success', timestamp: '14:30:50' },
  { id: 's5', waybillNo: 'YD4098765432500', expressCompany: '韵达', result: 'success', timestamp: '14:30:22' },
  { id: 's6', waybillNo: 'ST5098765432600', expressCompany: '申通', result: 'exception', exceptionReason: '仓库不匹配', timestamp: '14:29:58' },
  { id: 's7', waybillNo: 'JT6098765432700', expressCompany: '极兔', result: 'success', timestamp: '14:29:30' },
  { id: 's8', waybillNo: 'SF1098765432800', expressCompany: '顺丰', result: 'success', timestamp: '14:28:55' },
]

const TOTAL_SCANNED = 24
const TOTAL_SUCCESS = 22
const TOTAL_EXCEPTION = 2

/* ── helpers ── */
function resultBadge(r: ScanRecord): string {
  if (r.result === 'success') {
    return `<span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <svg class="mr-0.5 h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      成功
    </span>`
  }
  return `<span class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
    <svg class="mr-0.5 h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
    异常
  </span>`
}

function expressTag(company: string): string {
  const colors: Record<string, string> = {
    '顺丰': 'bg-slate-100 text-slate-700',
    '中通': 'bg-orange-100 text-orange-700',
    '圆通': 'bg-blue-100 text-blue-700',
    '韵达': 'bg-purple-100 text-purple-700',
    '申通': 'bg-yellow-100 text-yellow-800',
    '极兔': 'bg-pink-100 text-pink-700',
  }
  const cls = colors[company] || 'bg-slate-100 text-slate-700'
  return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}">${company}</span>`
}

/* ── render ── */
export function renderFinishedPdaShipScan(): string {
  const scanListHtml = MOCK_SCANS.map((s) => {
    const exceptionTag = s.exceptionReason
      ? `<span class="mt-1 inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">${s.exceptionReason}</span>`
      : ''
    return `<div class="flex items-start justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 ${s.result === 'exception' ? 'border-red-200 bg-red-50/40' : ''}">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="truncate font-mono text-[13px] font-semibold text-slate-800">${s.waybillNo}</span>
          ${resultBadge(s)}
        </div>
        <div class="mt-1 flex items-center gap-2">
          ${expressTag(s.expressCompany)}
          <span class="text-[11px] text-slate-400">${s.timestamp}</span>
          ${exceptionTag}
        </div>
      </div>
    </div>`
  }).join('')

  return `<div class="mx-auto max-w-[470px] min-h-screen bg-slate-100">
    <!-- top bar -->
    <div class="sticky top-0 z-20 flex items-center justify-between bg-white px-3 py-2.5 shadow-sm">
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100" onclick="history.back()">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="text-center">
        <div class="text-[15px] font-semibold text-slate-800">扫码出库</div>
        <div class="text-[10px] text-slate-400 font-mono">${BATCH_NO}</div>
      </div>
      <div class="h-8 w-8"></div>
    </div>

    <!-- express company selector -->
    <div class="px-3 pt-3">
      <label class="mb-1 block text-[12px] font-medium text-slate-500">快递公司</label>
      <div class="relative">
        <select id="pda-ship-express" class="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-[14px] text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
          ${EXPRESS_COMPANIES.map((c, i) => `<option value="${c}"${i === 0 ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
        <svg class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
      </div>
    </div>

    <!-- scan input -->
    <div class="px-3 pt-3">
      <label class="mb-1 block text-[12px] font-medium text-slate-500">扫描运单号</label>
      <div class="relative">
        <input
          id="pda-ship-scan-input"
          type="text"
          placeholder="扫描或输入运单条码…"
          autocomplete="off"
          class="w-full rounded-lg border-2 border-blue-300 bg-white px-3 py-3 pr-11 font-mono text-[15px] text-slate-800 shadow-sm outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button type="button" class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-blue-400 active:bg-blue-50" title="扫码" onclick="window.__wlsPdaShipScan?.triggerScan()">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- confirm button -->
    <div class="px-3 pt-3">
      <button
        type="button"
        id="pda-ship-confirm-btn"
        class="w-full rounded-lg bg-emerald-600 px-4 py-3 text-[15px] font-semibold text-white shadow-sm active:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        onclick="window.__wlsPdaShipScan?.confirmScan()"
      >
        确认扫描
      </button>
    </div>

    <!-- summary bar -->
    <div class="mx-3 mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
      <div class="flex items-center gap-3">
        <span class="text-[12px] text-slate-500">已扫描</span>
        <span class="text-[16px] font-bold text-slate-800">${TOTAL_SCANNED} <span class="text-[12px] font-normal text-slate-400">件</span></span>
      </div>
      <div class="h-4 w-px bg-slate-200"></div>
      <div class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
        <span class="text-[12px] text-slate-500">成功</span>
        <span class="text-[14px] font-bold text-emerald-600">${TOTAL_SUCCESS}</span>
      </div>
      <div class="h-4 w-px bg-slate-200"></div>
      <div class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full bg-red-500"></span>
        <span class="text-[12px] text-slate-500">异常</span>
        <span class="text-[14px] font-bold text-red-600">${TOTAL_EXCEPTION}</span>
      </div>
    </div>

    <!-- scan results list -->
    <div class="px-3 pt-3 pb-2">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-[12px] font-medium text-slate-500">最近扫描</span>
        <span class="text-[11px] text-slate-400">共 ${TOTAL_SCANNED} 条</span>
      </div>
      <div class="space-y-2" id="pda-ship-scan-list">
        ${scanListHtml}
      </div>
    </div>

    <!-- operator info -->
    <div class="mx-3 mb-4 mt-1 flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
      <div class="flex items-center gap-2">
        <div class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[12px] font-semibold text-blue-600">张</div>
        <div>
          <div class="text-[13px] font-medium text-slate-700">张伟</div>
          <div class="text-[10px] text-slate-400">工号 W0382 · 成衣仓</div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-[11px] text-slate-400">开始时间</div>
        <div class="font-mono text-[12px] text-slate-600">14:00:00</div>
      </div>
    </div>

    <script>
    (function () {
      var expressSelect = document.getElementById('pda-ship-express');
      var scanInput = document.getElementById('pda-ship-scan-input');
      var listEl = document.getElementById('pda-ship-scan-list');

      /* focus scan input on load */
      if (scanInput) scanInput.focus();

      /* enter key triggers confirm */
      if (scanInput) {
        scanInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            window.__wlsPdaShipScan.confirmScan();
          }
        });
      }

      window.__wlsPdaShipScan = {
        triggerScan: function () {
          if (scanInput) {
            scanInput.focus();
            scanInput.select();
          }
        },

        confirmScan: function () {
          var val = (scanInput && scanInput.value || '').trim();
          if (!val) {
            scanInput && scanInput.focus();
            return;
          }
          var company = expressSelect ? expressSelect.value : '';
          console.log('[PDA-ShipScan] confirm:', val, 'company:', company);
          /* prototype: clear input and re-focus for next scan */
          if (scanInput) {
            scanInput.value = '';
            scanInput.focus();
          }
        },

        setExpress: function (name) {
          if (expressSelect) expressSelect.value = name;
        }
      };
    })();
    </script>
  </div>`
}
