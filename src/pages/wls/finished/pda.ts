// 成衣仓 PDA — 手持终端作业主页

import type { AppState } from '../../../state/store';

interface PdaMenuItem {
  key: string;
  title: string;
  desc: string;
  icon: string;
  badge?: number;
}

interface PdaMenuGroup {
  groupTitle: string;
  items: PdaMenuItem[];
}

const MENU_GROUPS: PdaMenuGroup[] = [
  {
    groupTitle: '入库作业',
    items: [
      { key: 'receive-scan', title: '收货扫描', desc: '扫描单据或条码收货', icon: '📦', badge: 3 },
      { key: 'putaway', title: '上架', desc: '将货物放到指定库位', icon: '📤', badge: 5 },
    ],
  },
  {
    groupTitle: '出库作业',
    items: [
      { key: 'picking', title: '拣货', desc: '按出库单拣选货物', icon: '🛒', badge: 8 },
      { key: 'ship-scan', title: '发货扫描', desc: '扫描确认发货', icon: '🚚' },
    ],
  },
  {
    groupTitle: '库存作业',
    items: [
      { key: 'transfer', title: '移库', desc: '库位之间移动货物', icon: '🔄' },
      { key: 'stocktake', title: '盘点', desc: '库存数量核对', icon: '📋' },
    ],
  },
  {
    groupTitle: '退货作业',
    items: [
      { key: 'return-receive', title: '退货收货', desc: '接收退回货物', icon: '↩️', badge: 2 },
    ],
  },
];

const PENDING_SUMMARY = [
  { label: '待上架', count: 3, tone: 'bg-amber-500' },
  { label: '待拣货', count: 5, tone: 'bg-blue-500' },
  { label: '待收货', count: 2, tone: 'bg-rose-500' },
];

export function renderFinishedPda(): string {
  const pendingTotal = PENDING_SUMMARY.reduce((s, p) => s + p.count, 0);

  const pendingBanner = `
    <div class="mx-4 mt-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">${pendingTotal}</span>
          <span class="text-sm font-medium">待处理任务</span>
        </div>
        <span class="text-xs text-blue-100">点击菜单开始作业</span>
      </div>
      <div class="mt-2.5 flex gap-2">
        ${PENDING_SUMMARY.map(
          (p) => `
          <span class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
            <span class="h-1.5 w-1.5 rounded-full ${p.tone}"></span>
            ${p.count} ${p.label}
          </span>`,
        ).join('')}
      </div>
    </div>`;

  const renderMenuItem = (item: PdaMenuItem): string => `
    <button
      class="pda-menu-card group flex flex-col items-center rounded-xl bg-white p-3 shadow-sm active:scale-[0.97] active:bg-slate-50 transition-all duration-100"
      data-action="${item.key}"
    >
      <div class="relative mb-1.5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-2xl">
        ${item.icon}
        ${item.badge ? `<span class="absolute -right-1 -top-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">${item.badge}</span>` : ''}
      </div>
      <span class="text-[13px] font-semibold text-slate-800 leading-tight">${item.title}</span>
      <span class="mt-0.5 text-[10px] text-slate-400 leading-tight text-center line-clamp-1">${item.desc}</span>
    </button>`;

  const menuGroupsHtml = MENU_GROUPS.map(
    (group) => `
    <div class="mx-4 mt-4">
      <h3 class="mb-2 text-xs font-semibold text-slate-500 tracking-wide">${group.groupTitle}</h3>
      <div class="grid grid-cols-4 gap-2.5">
        ${group.items.map(renderMenuItem).join('')}
      </div>
    </div>`,
  ).join('');

  const scanArea = `
    <div class="fixed bottom-0 left-1/2 w-[470px] -translate-x-1/2 border-t border-slate-200 bg-white px-4 pb-5 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">⎚</span>
          <input
            id="pda-scan-input"
            type="text"
            placeholder="扫码输入 — 请扫描条码或单据号"
            class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            autocomplete="off"
          />
        </div>
        <button
          id="pda-scan-confirm"
          class="flex h-[42px] items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white active:bg-blue-700 transition"
        >
          确认
        </button>
      </div>
      <p id="pda-scan-feedback" class="mt-1.5 text-xs text-slate-400 text-center hidden"></p>
    </div>`;

  const operatorBar = `
    <div class="mx-4 mt-6 mb-28 flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">张</span>
        <div>
          <p class="text-xs font-semibold text-slate-700 leading-none">张伟</p>
          <p class="mt-0.5 text-[10px] text-slate-400">OP-001</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-slate-400">
        <button class="text-xs text-slate-500 active:text-slate-700" data-action="refresh">刷新</button>
        <span class="h-3 w-px bg-slate-200"></span>
        <button class="text-xs text-slate-500 active:text-slate-700" data-action="logout">退出</button>
      </div>
    </div>`;

  return `
    <div class="min-h-screen bg-slate-100" style="padding-bottom: env(safe-area-inset-bottom, 0);">
      <div class="relative mx-auto min-h-screen max-w-[470px] bg-slate-100">

        <!-- Top Bar -->
        <div class="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 shadow-md">
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base">🏭</span>
            <div>
              <h1 class="text-sm font-bold text-white leading-none">成衣仓 PDA</h1>
              <p class="mt-0.5 text-[10px] text-slate-400">手持终端作业中心</p>
            </div>
          </div>
          <button class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white active:bg-white/20 transition" data-action="scan-toggle" title="扫码">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="7" y1="12" x2="17" y2="12"/>
              <line x1="7" y1="8" x2="9" y2="8"/>
              <line x1="7" y1="16" x2="9" y2="16"/>
              <line x1="11" y1="8" x2="13" y2="8"/>
              <line x1="11" y1="16" x2="13" y2="16"/>
              <line x1="15" y1="8" x2="17" y2="8"/>
              <line x1="15" y1="16" x2="17" y2="16"/>
            </svg>
          </button>
        </div>

        <!-- Pending Tasks Banner -->
        ${pendingBanner}

        <!-- Menu Groups -->
        ${menuGroupsHtml}

        <!-- Operator Info -->
        ${operatorBar}

        <!-- Scan Input Area (fixed bottom) -->
        ${scanArea}

      </div>

      <script>
        (function() {
          var ns = window.__wlsFinishedPda = window.__wlsFinishedPda || {};

          var scanInput = document.getElementById('pda-scan-input');
          var scanConfirm = document.getElementById('pda-scan-confirm');
          var feedback = document.getElementById('pda-scan-feedback');

          function showFeedback(msg, isError) {
            if (!feedback) return;
            feedback.textContent = msg;
            feedback.className = 'mt-1.5 text-xs text-center ' + (isError ? 'text-rose-500' : 'text-emerald-600');
            feedback.classList.remove('hidden');
            clearTimeout(ns._feedbackTimer);
            ns._feedbackTimer = setTimeout(function() {
              feedback.classList.add('hidden');
            }, 3000);
          }

          function handleScan() {
            var val = (scanInput && scanInput.value || '').trim();
            if (!val) {
              showFeedback('请先扫描或输入条码号', true);
              if (scanInput) scanInput.focus();
              return;
            }
            showFeedback('已识别: ' + val + ' — 正在跳转...', false);
            if (scanInput) scanInput.value = '';
          }

          if (scanConfirm) {
            scanConfirm.addEventListener('click', handleScan);
          }

          if (scanInput) {
            scanInput.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') handleScan();
            });
          }

          // Menu card clicks
          document.addEventListener('click', function(e) {
            var card = e.target.closest('.pda-menu-card');
            if (!card) return;
            var action = card.getAttribute('data-action');
            if (!action) return;
            var title = card.querySelector('span')?.textContent || action;
            showFeedback('进入: ' + title, false);
          });

          // Operator actions
          document.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            if (action === 'refresh') {
              showFeedback('已刷新', false);
            } else if (action === 'logout') {
              showFeedback('已退出登录', false);
            } else if (action === 'scan-toggle') {
              if (scanInput) {
                scanInput.focus();
                showFeedback('请扫描条码', false);
              }
            }
          });

          ns.showFeedback = showFeedback;
          ns.handleScan = handleScan;
        })();
      </script>
    </div>`;
}
