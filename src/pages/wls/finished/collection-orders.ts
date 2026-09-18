import type { AppState } from '../../../state/store'

type Line = { sku: string; name: string; need: number; collected: number; stock: number; occupied: number; productionNo: string; cutStatus: string; location: string; zone: string }
type Order = { id: string; preNo: string; shipNo: string; platform: string; status: string; box?: string; created: string; deadline: string; lines: Line[] }
type RetryCandidate = { preNo: string; description: string; skuCount: number; status: 'WAIT_RETRY' | 'INVALID'; reason: string }

const statusLabel: Record<string, string> = {
  WAIT_WAVE: '待集货', WAVE_CREATED: '已创建波次', COLLECTING: '集货中', PARTIAL_COLLECTED: '部分集货',
  COLLECTED: '已集齐', REMOVING: '移出中', REMOVED: '已移出', SHIPPED: '已发货',
}

function badgeClass(s: string): string {
  if (['COMPLETED', 'COLLECTED'].includes(s)) return 'bg-emerald-50 text-emerald-700'
  if (s === 'PARTIAL_COLLECTED') return 'bg-amber-50 text-amber-700'
  if (['EXCEPTION', 'REMOVING'].includes(s)) return 'bg-orange-50 text-orange-700'
  return 'bg-blue-50 text-blue-700'
}

const seedOrders: Order[] = [
  { id: 'JH-20260829-001', preNo: 'POUT-20260829-A', shipNo: 'SO-20260829-001', platform: 'TikTok', status: 'WAIT_WAVE', created: '2026-08-29 09:00', deadline: '2026-08-31 18:00', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', need: 2, collected: 0, stock: 8, occupied: 0, productionNo: 'MO-260801', cutStatus: '已裁剪', location: 'A01-01', zone: 'A区' },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', need: 1, collected: 0, stock: 4, occupied: 0, productionNo: 'MO-260802', cutStatus: '已裁剪', location: 'A02-03', zone: 'A区' },
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', need: 1, collected: 0, stock: 0, occupied: 0, productionNo: 'MO-260803', cutStatus: '已裁剪', location: 'B01-02', zone: 'B区' },
  ]},
  { id: 'JH-20260829-002', preNo: 'POUT-20260829-D', shipNo: 'SO-20260829-004', platform: 'Shopee', status: 'WAIT_WAVE', created: '2026-08-29 09:30', deadline: '2026-08-31 12:00', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', need: 3, collected: 0, stock: 8, occupied: 0, productionNo: 'MO-260801', cutStatus: '已裁剪', location: 'A01-01', zone: 'A区' },
    { sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', need: 2, collected: 0, stock: 5, occupied: 0, productionNo: 'MO-260810', cutStatus: '已裁剪', location: 'B03-01', zone: 'B区' },
  ]},
  { id: 'JH-20260829-003', preNo: 'POUT-20260829-E', shipNo: 'SO-20260829-005', platform: '独立站', status: 'WAIT_WAVE', created: '2026-08-29 10:00', deadline: '2026-09-01 10:00', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', need: 1, collected: 0, stock: 8, occupied: 0, productionNo: 'MO-260801', cutStatus: '已裁剪', location: 'A01-01', zone: 'A区' },
    { sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', need: 2, collected: 0, stock: 6, occupied: 0, productionNo: 'MO-260811', cutStatus: '已裁剪', location: 'C01-01', zone: 'C区' },
  ]},
  { id: 'JH-20260820-018', preNo: 'POUT-20260820-X', shipNo: 'SO-20260820-018', platform: 'TikTok', status: 'COLLECTING', box: 'BOX-001', created: '2026-08-20 08:30', deadline: '2026-08-25 18:00', lines: [
    { sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', need: 1, collected: 1, stock: 5, occupied: 0, productionNo: 'MO-260700', cutStatus: '已裁剪', location: 'A03-08', zone: 'A区' },
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', need: 1, collected: 0, stock: 0, occupied: 0, productionNo: 'MO-260803', cutStatus: '已裁剪', location: 'B01-02', zone: 'B区' },
  ]},
]

const seedRetryCandidates: RetryCandidate[] = [
  { preNo: 'POUT-20260829-B', description: '有效3 SKU预售订单，全部无库存', skuCount: 3, status: 'WAIT_RETRY', reason: '库存条件暂未满足' },
  { preNo: 'POUT-20260829-C', description: '有效2 SKU预售订单，夹克未达到裁剪状态', skuCount: 2, status: 'WAIT_RETRY', reason: '生产裁剪条件暂未满足' },
  { preNo: 'POUT-20260829-D', description: '单商品订单', skuCount: 1, status: 'INVALID', reason: '订单类型不符合，不进入重试' },
]

export function renderCollectionOrders(_state: AppState): string {
  const rows = seedOrders.map(o => {
    const skuCount = o.lines.length
    const collectedSku = o.lines.filter(l => l.collected >= l.need).length
    const pickable = o.lines.reduce((s, l) => s + Math.min(Math.max(0, l.need - l.collected - l.occupied), Math.max(0, l.stock - l.occupied)), 0)
    const occupied = o.lines.reduce((s, l) => s + l.occupied, 0)
    const label = statusLabel[o.status] || o.status
    const cls = badgeClass(o.status)
    const canSelect = ['WAIT_WAVE', 'PARTIAL_COLLECTED'].includes(o.status)
    const isCollected = o.status === 'COLLECTED'
    return `
      <tr class="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
        <td class="px-3 py-3"><input type="checkbox" class="collection-order-check" data-id="${o.id}" ${canSelect ? '' : 'disabled'} /></td>
        <td class="px-3 py-3 font-medium text-[var(--link)]">${o.id}</td>
        <td class="px-3 py-3">${o.preNo}</td>
        <td class="px-3 py-3">${o.shipNo}</td>
        <td class="px-3 py-3">${o.platform}</td>
        <td class="px-3 py-3 text-center">${skuCount}</td>
        <td class="px-3 py-3 text-center">${skuCount}</td>
        <td class="px-3 py-3 text-center">${collectedSku}</td>
        <td class="px-3 py-3 text-center">${pickable}</td>
        <td class="px-3 py-3 text-center">${occupied}</td>
        <td class="px-3 py-3">${o.box || '-'}</td>
        <td class="px-3 py-3"><span class="rounded-full px-2 py-0.5 text-xs ${cls}">${label}</span></td>
        <td class="px-3 py-3 whitespace-nowrap">${o.created}</td>
        <td class="px-3 py-3 whitespace-nowrap">${o.deadline}</td>
        <td class="px-3 py-3">
          <div class="flex gap-1.5">
            <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" onclick="window.__wlsCollectionOrders?.viewDetail('${o.id}')">查看详情</button>
            ${isCollected ? `<button class="rounded-md border border-[var(--link)] bg-[var(--link)] px-3 py-1.5 text-xs font-medium text-white" onclick="window.__wlsCollectionOrders?.goPacking()">多件打包</button>` : ''}
          </div>
        </td>
      </tr>
    `
  }).join('')

  const retryCards = seedRetryCandidates.map(x => `
    <div class="rounded-md bg-[var(--bg-subtle)] p-3 text-xs">
      <b class="text-[var(--text-primary)]">${x.preNo}</b>
      <p class="my-1 text-[var(--text-muted)]">${x.description}</p>
      <span class="${x.status === 'WAIT_RETRY' ? 'text-amber-600' : 'text-[var(--text-muted)]'}">${x.status} · ${x.reason}</span>
    </div>
  `).join('')

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">集货订单</h2>
        <p class="mt-1 text-[13px] text-[var(--text-muted)]">成衣仓预售订单提前集货流程</p>
      </div>

      <div class="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-white p-3">
        <span class="text-sm text-[var(--text-secondary)]">已选择 <b id="collection-selected-count">0</b> 个集货订单</span>
        <button class="rounded-md border border-[var(--link)] bg-[var(--link)] px-3 py-1.5 text-xs font-medium text-white" onclick="window.__wlsCollectionOrders?.buildWave()">创建拣货波次</button>
      </div>

      <div class="overflow-auto rounded-lg border border-[var(--border-default)] bg-white">
        <table class="min-w-[1400px] w-full text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="px-3 py-3 text-left font-medium">选择</th>
              <th class="px-3 py-3 text-left font-medium">集货订单号</th>
              <th class="px-3 py-3 text-left font-medium">预出库订单号</th>
              <th class="px-3 py-3 text-left font-medium">发货单号</th>
              <th class="px-3 py-3 text-left font-medium">平台</th>
              <th class="px-3 py-3 text-center font-medium">SKU数</th>
              <th class="px-3 py-3 text-center font-medium">应集 SKU</th>
              <th class="px-3 py-3 text-center font-medium">已集 SKU</th>
              <th class="px-3 py-3 text-center font-medium">可拣件数</th>
              <th class="px-3 py-3 text-center font-medium">波次占用</th>
              <th class="px-3 py-3 text-left font-medium">集货箱</th>
              <th class="px-3 py-3 text-left font-medium">状态</th>
              <th class="px-3 py-3 text-left font-medium">创建时间</th>
              <th class="px-3 py-3 text-left font-medium">发货截止</th>
              <th class="px-3 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div class="grid grid-cols-4 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 text-xs">
        <div class="text-[var(--text-muted)]">最近执行<br/><b class="text-[var(--text-primary)]">2026-08-29 10:30:00</b></div>
        <div class="text-[var(--text-muted)]">下次执行<br/><b class="text-[var(--text-primary)]">2026-08-29 11:00:00</b></div>
        <div class="text-[var(--text-muted)]">最近扫描<br/><b class="text-[var(--text-primary)]">2 单</b></div>
        <div class="text-[var(--text-muted)]">本轮生成<br/><b class="text-[var(--text-primary)]">0 单</b></div>
      </div>

      <div class="rounded-lg border border-[var(--border-default)] bg-white p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-[var(--text-primary)]">自动生成规则 · 订单创建时实时判断 + 未满足条件每 30 分钟重试</div>
            <div class="mt-1 text-xs text-[var(--text-muted)]">数据来源：成衣厂预出库订单；首次判断：订单创建后立即执行；定时重试：仅检查 WAIT_RETRY 候选；防重复：pre_outbound_order_no 唯一</div>
          </div>
          <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" onclick="window.__wlsCollectionOrders?.runRule()">模拟待重试候选规则执行</button>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-3">
          ${retryCards}
        </div>
      </div>

      <div class="rounded-lg border border-[var(--border-default)] bg-white">
        <div class="border-b border-[var(--border-subtle)] px-5 py-3 text-sm font-medium text-[var(--text-primary)]">功能逻辑说明</div>
        <div class="space-y-5 px-5 py-4 text-[13px] leading-6">
          <section class="space-y-2">
            <h4 class="text-[14px] font-semibold text-[var(--text-primary)]">1. 页面说明</h4>
            <p class="text-[var(--text-muted)]">【集货订单】是预售订单提前集货生命周期的唯一主单；商品分批到仓时，同一订单可多次创建波次、多次拣货及二次分拨，直至全部 SKU 集齐。</p>
            <ul class="grid list-disc grid-cols-2 gap-x-8 pl-5 text-[var(--text-muted)]">
              <li>预出库订单创建后立即执行首次判断</li>
              <li>仅暂未满足库存或生产条件的候选订单定时重试</li>
              <li>订单类型不符合时不进入重试池</li>
              <li>不生成补集货单或二次集货单</li>
            </ul>
          </section>
          <section class="space-y-2">
            <h4 class="text-[14px] font-semibold text-[var(--text-primary)]">2. 集货订单生成规则</h4>
            <div class="overflow-hidden rounded-md border border-[var(--border-subtle)]">
              <table class="w-full text-left text-[12px]">
                <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]"><tr><th class="px-3 py-2 font-medium">判断阶段</th><th class="px-3 py-2 font-medium">规则</th></tr></thead>
                <tbody>
                  <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-2 font-medium text-[var(--text-primary)]">订单类型</td><td class="px-3 py-2 text-[var(--text-muted)]">必须为有效多商品预售订单，SKU 种类 > 1，且未取消、未关闭、未发货</td></tr>
                  <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-2 font-medium text-[var(--text-primary)]">库存条件</td><td class="px-3 py-2 text-[var(--text-muted)]">至少 1 个 SKU 当前有可用于集货的库存</td></tr>
                  <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-2 font-medium text-[var(--text-primary)]">生产条件</td><td class="px-3 py-2 text-[var(--text-muted)]">全部 SKU 均存在有效生产单并达到允许集货的裁剪状态</td></tr>
                  <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-2 font-medium text-[var(--text-primary)]">防重复</td><td class="px-3 py-2 text-[var(--text-muted)]">同一预出库订单只能存在一个有效集货订单</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <section class="space-y-2">
            <h4 class="text-[14px] font-semibold text-[var(--text-primary)]">3. 创建拣货波次</h4>
            <ul class="grid list-disc grid-cols-2 gap-x-8 pl-5 text-[var(--text-muted)]">
              <li>波次必须由仓库人员人工创建</li>
              <li>同一集货订单允许分批、多次推波</li>
              <li>每次只计算未集货且未被有效波次占用的数量</li>
              <li>波次唯一拆分维度为【库区】</li>
              <li>同一库区所有待拣 SKU 进入同一波次</li>
              <li>同一 SKU 分布不同库区时分别进入对应波次</li>
              <li class="col-span-2">已集货、已交接待分拨或已被有效波次占用的数量不得重复生成</li>
            </ul>
          </section>
        </div>
      </div>
    </div>

    <script>
      ;(function() {
        var checkboxes = document.querySelectorAll('.collection-order-check:not([disabled])');
        var countEl = document.getElementById('collection-selected-count');
        function updateCount() {
          var c = document.querySelectorAll('.collection-order-check:checked').length;
          if (countEl) countEl.textContent = c;
        }
        checkboxes.forEach(function(cb) { cb.addEventListener('change', updateCount) });
      })();
      window.__wlsCollectionOrders = {
        viewDetail: function(id) { console.log('查看集货订单详情', id) },
        buildWave: function() {
          var checked = document.querySelectorAll('.collection-order-check:checked');
          if (!checked.length) return alert('请先勾选至少一个待创建波次的集货订单。');
          console.log('创建拣货波次', Array.from(checked).map(function(cb) { return cb.dataset.id }));
        },
        runRule: function() { console.log('模拟规则执行') },
        goPacking: function() { console.log('跳转多件打包') }
      }
    </script>
  `
}
