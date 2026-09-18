import type { AppState } from '../../../state/store';

const PAGE_SIZE = 20;

type StockFlowRecord = {
  id: string;
  operateTime: string;
  warehouseName: string;
  spu: string;
  sku: string;
  productName: string;
  businessNo: string;
  docType: string;
  actionType: string;
  inboundChange: number;
  inboundBefore: number;
  putawayChange: number;
  putawayBefore: number;
  transferChange: number;
  transferBefore: number;
  pickChange: number;
  pickBefore: number;
  outboundChange: number;
  outboundBefore: number;
  locationCode: string;
  operatorName: string;
  operationTime: string;
  remark: string;
};

const STOCK_FLOW_SEED: StockFlowRecord[] = (() => {
  const docTypes = ['入库单', '上架单', '调拨单', '拣货单', '出库单'];
  const actionTypes = ['入库', '上架', '库内调拨', '拣货', '出库'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const locations = ['A01-01', 'A01-02', 'A02-03', 'B01-02', 'B03-01', 'C01-01', 'C02-01'];
  const operators = ['张仓管', '李操作员', '王组长', '赵仓管', '刘操作员'];
  const records: StockFlowRecord[] = [];

  for (let i = 0; i < 56; i++) {
    const actionIdx = i % 5;
    const change = 5 + (i * 3) % 30;
    const before = 50 + (i * 7) % 200;
    const dayOffset = Math.floor(i / 10);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 8 + (i % 10), (i * 13) % 60);
    const timeStr = baseDate.toISOString().slice(0, 16).replace('T', ' ');

    records.push({
      id: `SF-${String(i + 1).padStart(5, '0')}`,
      operateTime: timeStr,
      warehouseName: warehouses[i % warehouses.length],
      spu: `SPU-GC-${String(10001 + (i % 20)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      productName: ['黑色连衣裙 M', '白色短袖 L', '灰色百褶裙 M', '卡其夹克 S', '蓝色牛仔裤 L'][i % 5],
      businessNo: `BZ2026${String(5000 + i).padStart(6, '0')}`,
      docType: docTypes[actionIdx],
      actionType: actionTypes[actionIdx],
      inboundChange: actionIdx === 0 ? change : 0,
      inboundBefore: actionIdx === 0 ? before : 0,
      putawayChange: actionIdx === 1 ? change : 0,
      putawayBefore: actionIdx === 1 ? before : 0,
      transferChange: actionIdx === 2 ? change : 0,
      transferBefore: actionIdx === 2 ? before : 0,
      pickChange: actionIdx === 3 ? -change : 0,
      pickBefore: actionIdx === 3 ? before : 0,
      outboundChange: actionIdx === 4 ? -change : 0,
      outboundBefore: actionIdx === 4 ? before : 0,
      locationCode: locations[i % locations.length],
      operatorName: operators[i % operators.length],
      operationTime: timeStr,
      remark: i % 8 === 0 ? '进入质检区' : '',
    });
  }
  return records;
})();

const METRIC_COLUMNS = [
  { label: '入库', changeKey: 'inboundChange', beforeKey: 'inboundBefore' },
  { label: '上架', changeKey: 'putawayChange', beforeKey: 'putawayBefore' },
  { label: '库内调拨', changeKey: 'transferChange', beforeKey: 'transferBefore' },
  { label: '拣货', changeKey: 'pickChange', beforeKey: 'pickBefore' },
  { label: '出库', changeKey: 'outboundChange', beforeKey: 'outboundBefore' },
];

function renderMetricCells(record: StockFlowRecord): string {
  return METRIC_COLUMNS.map((col, index) => {
    const change = record[col.changeKey as keyof StockFlowRecord] as number;
    const before = record[col.beforeKey as keyof StockFlowRecord] as number;
    const after = before + change;
    const changeClass = change > 0 ? 'text-[#067647]' : change < 0 ? 'text-[#B42318]' : 'text-[var(--text-secondary)]';
    const borderLeft = index > 0 ? 'border-l-2 border-[#D0D5DD]' : '';
    return `<td class="min-w-[5.5rem] whitespace-nowrap border-b border-[var(--border-subtle)] px-2 font-semibold ${changeClass} ${borderLeft}">${change > 0 ? `+${change}` : change}</td>
      <td class="min-w-[5.5rem] whitespace-nowrap border-b border-[var(--border-subtle)] px-2">${before}</td>
      <td class="min-w-[5.5rem] whitespace-nowrap border-b border-[var(--border-subtle)] px-2">${after}</td>`;
  }).join('');
}

export function renderFinishedStockFlow(_state: AppState): string {
  const allRecords = STOCK_FLOW_SEED;
  const pageRecords = allRecords.slice(0, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(allRecords.length / PAGE_SIZE));

  return `<section>
    <div class="mb-4">
      <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">库存流水查询</h2>
      <p class="mt-1 text-[13px] text-[var(--text-muted)]">用于追溯每次库存变动来源、前后数量及即时库存快照。</p>
    </div>

    <div class="mb-3 rounded-[12px] border border-[var(--border-default)] bg-white p-3">
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <input value="" placeholder="搜索业务单号 / SPU / SKU / 商品 / 仓库 / 库位" class="w-[380px] rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            <div class="inline-flex items-center rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
              ${['全部', '入库', '上架', '库内调拨', '拣货', '出库'].map((type) => `<button type="button" class="rounded-[6px] px-3 py-1 text-[12px] transition text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onclick="window.__wlsStockFlow?.toggleType('${type}')">${type}</button>`).join('')}
            </div>
            <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1 text-[12px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]">仅看报废上架</button>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">导出Excel</button>
            <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsStockFlow?.toggleFilter()">收起筛选</button>
          </div>
        </div>

        <div id="wls-sf-extra-filters" class="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-4">
          <select class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option>中央总仓-成衣仓</option>
            <option>成衣仓-深圳仓01</option>
            <option>成衣仓-武汉仓01</option>
          </select>
          <input class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="SPU编码" />
          <input class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="SKU编码" />
          <input class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="商品名称" />
          <input class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="业务单号" />
          <select class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option>全部单据类型</option>
            <option>入库单</option><option>上架单</option><option>调拨单</option><option>拣货单</option><option>出库单</option>
          </select>
          <select class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20">
            <option>全部动作类型</option>
            <option>入库</option><option>上架</option><option>库内调拨</option><option>拣货</option><option>出库</option>
          </select>
          <input class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" placeholder="操作人" />
          <input type="date" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
          <input type="date" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
          <div class="flex items-center gap-2">
            <button type="button" class="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-[7px] text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsStockFlow?.reset()">重置</button>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-[12px] border border-[var(--border-default)] bg-white">
      <div class="max-h-[560px] overflow-auto rounded-[10px] border border-[var(--border-default)]">
        <table class="w-full min-w-[4200px] text-[13px]">
          <thead class="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="w-[7rem] min-w-[7rem] sticky z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap" style="left:0">发生时间</th>
              <th class="w-[7rem] min-w-[7rem] sticky z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap" style="left:7rem">仓库名称</th>
              <th class="w-[7rem] min-w-[7rem] sticky z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap" style="left:14rem">商品SPU</th>
              <th class="w-[7rem] min-w-[7rem] sticky z-20 border-b border-[var(--border-subtle)] border-r-2 border-[#D0D5DD] bg-[var(--bg-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap" style="left:21rem">商品SKU</th>
              <th class="min-w-[9rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">商品名称</th>
              <th class="min-w-[9rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">业务单号</th>
              <th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">单据类型</th>
              <th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">动作类型</th>
              ${METRIC_COLUMNS.map((col, index) => `<th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-center text-[12px] font-medium whitespace-nowrap ${index > 0 ? 'border-l-2 border-[#D0D5DD]' : ''}" colspan="3">${col.label}</th>`).join('')}
              <th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">库位</th>
              <th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">操作人</th>
              <th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">操作时间</th>
              <th class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 text-left text-[12px] font-medium whitespace-nowrap">备注</th>
            </tr>
            <tr>
              ${METRIC_COLUMNS.map((col, index) => `<th class="min-w-[5.5rem] border-b border-[var(--border-subtle)] px-2 py-1 text-left text-[12px] font-medium whitespace-nowrap ${index > 0 ? 'border-l-2 border-[#D0D5DD]' : ''}">变动</th>
              <th class="min-w-[5.5rem] border-b border-[var(--border-subtle)] px-2 py-1 text-left text-[12px] font-medium whitespace-nowrap">变动前</th>
              <th class="min-w-[5.5rem] border-b border-[var(--border-subtle)] px-2 py-1 text-left text-[12px] font-medium whitespace-nowrap">变动后</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${pageRecords.map((record) => `<tr class="hover:bg-[var(--bg-hover)]">
              <td class="w-[7rem] min-w-[7rem] sticky z-[2] border-b border-[var(--border-subtle)] bg-white px-2 py-2 whitespace-nowrap" style="left:0">${record.operateTime}</td>
              <td class="w-[7rem] min-w-[7rem] sticky z-[2] border-b border-[var(--border-subtle)] bg-white px-2 py-2 whitespace-nowrap" style="left:7rem">${record.warehouseName}</td>
              <td class="w-[7rem] min-w-[7rem] sticky z-[2] border-b border-[var(--border-subtle)] bg-white px-2 py-2 whitespace-nowrap" style="left:14rem">${record.spu}</td>
              <td class="w-[7rem] min-w-[7rem] sticky z-[2] border-b border-[var(--border-subtle)] border-r-2 border-[#D0D5DD] bg-white px-2 py-2 whitespace-nowrap text-[var(--link)]" style="left:21rem">${record.sku}</td>
              <td class="min-w-[9rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">${record.productName}</td>
              <td class="min-w-[9rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap text-[var(--link)]">${record.businessNo}</td>
              <td class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">${record.docType}</td>
              <td class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">${record.actionType}</td>
              ${renderMetricCells(record)}
              <td class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">${record.locationCode}</td>
              <td class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">${record.operatorName}</td>
              <td class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">${record.operationTime}</td>
              <td class="min-w-[7rem] border-b border-[var(--border-subtle)] px-2 py-2 whitespace-nowrap">
                <div class="inline-flex items-center gap-2">
                  ${record.remark.includes('质检区') ? '<span class="inline-flex rounded-[999px] border border-[#B2DDFF] bg-[#EFF8FF] px-2 py-0.5 text-[12px] font-medium text-[#175CD3]">退货质检入区</span>' : ''}
                  <span>${record.remark}</span>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] px-3 pt-3">
        <span class="text-[12px] text-[var(--text-muted)]">共 ${allRecords.length} 条记录，第 1/${totalPages} 页</span>
        <div class="flex items-center gap-1">
          <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40" disabled>上一页</button>
          <button type="button" class="rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] px-2 py-1 text-[12px] text-white">1</button>
          <button type="button" class="rounded-[6px] border border-[var(--border-default)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]" onclick="window.__wlsStockFlow?.goPage(2)">下一页</button>
        </div>
      </div>
    </div>

    <script>
    (function() {
      window.__wlsStockFlow = {
        toggleType: function(type) { console.log('Toggle type:', type); },
        toggleFilter: function() {
          var el = document.getElementById('wls-sf-extra-filters');
          if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
        },
        goPage: function(page) { console.log('Go to page:', page); },
        reset: function() { console.log('Reset filters'); }
      };
    })();
    </script>
  </section>`;
}
