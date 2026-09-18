import type { AppState } from '../../../state/store'

type ScoreReason = { reason: string; count: number; ratio: string }

type ScoreDetail = {
  spu: string; productName: string; styleCode: string
  salesCount: number; score: number; totalBadReviews: number
  fabricBadReviews: number; fabricRatio: string; reasons: ScoreReason[]
}

type ScoreItem = {
  id: string; image: string; spu: string; fabricName: string
  relatedSpuCount: number; totalSales: number; totalBadReviews: number
  fabricBadReviews: number; badReviewRatio: string; ratioLevel: string
  reasons: ScoreReason[]; details: ScoreDetail[]
}

const seedScores: ScoreItem[] = [
  { id: 'FS-001', image: '', spu: 'SPU-ML-1001', fabricName: '莫代尔基础打底面料', relatedSpuCount: 6, totalSales: 12480, totalBadReviews: 186, fabricBadReviews: 142, badReviewRatio: '1.14%', ratioLevel: 'low', reasons: [{ reason: '起球', count: 52, ratio: '36.6%' }, { reason: '掉色', count: 38, ratio: '26.8%' }, { reason: '缩水', count: 32, ratio: '22.5%' }, { reason: '其他', count: 20, ratio: '14.1%' }], details: [
    { spu: 'SPU-FS-1001-A', productName: '基础打底长袖衫', styleCode: '36-基础服装-基础打底', salesCount: 3200, score: 4.6, totalBadReviews: 72, fabricBadReviews: 48, fabricRatio: '0.67%', reasons: [{ reason: '起球', count: 18, ratio: '37.5%' }, { reason: '掉色', count: 14, ratio: '29.2%' }, { reason: '缩水', count: 10, ratio: '20.8%' }, { reason: '其他', count: 6, ratio: '12.5%' }] },
    { spu: 'SPU-FS-1001-B', productName: '圆领轻薄短袖', styleCode: '42-基础服装-基础T恤', salesCount: 2800, score: 4.7, totalBadReviews: 54, fabricBadReviews: 38, fabricRatio: '0.57%', reasons: [{ reason: '起球', count: 14, ratio: '36.8%' }, { reason: '掉色', count: 10, ratio: '26.3%' }, { reason: '缩水', count: 8, ratio: '21.1%' }, { reason: '其他', count: 6, ratio: '15.8%' }] },
    { spu: 'SPU-FS-1001-C', productName: '基础修身内搭', styleCode: '51-基础服装-基础衬衫', salesCount: 1600, score: 4.8, totalBadReviews: 28, fabricBadReviews: 18, fabricRatio: '0.45%', reasons: [{ reason: '起球', count: 6, ratio: '33.3%' }, { reason: '掉色', count: 5, ratio: '27.8%' }, { reason: '缩水', count: 4, ratio: '22.2%' }, { reason: '其他', count: 3, ratio: '16.7%' }] },
  ]},
  { id: 'FS-002', image: '', spu: 'SPU-ML-1012', fabricName: '精梳棉轻薄T恤面料', relatedSpuCount: 4, totalSales: 8640, totalBadReviews: 128, fabricBadReviews: 96, badReviewRatio: '1.11%', ratioLevel: 'low', reasons: [{ reason: '扎肤', count: 36, ratio: '37.5%' }, { reason: '透气性差', count: 24, ratio: '25.0%' }, { reason: '色差', count: 20, ratio: '20.8%' }, { reason: '其他', count: 16, ratio: '16.7%' }], details: [
    { spu: 'SPU-FS-1012-A', productName: '亲肤弹力针织衫', styleCode: '63-基础服装-基础卫衣', salesCount: 2400, score: 4.5, totalBadReviews: 48, fabricBadReviews: 32, fabricRatio: '0.53%', reasons: [{ reason: '扎肤', count: 12, ratio: '37.5%' }, { reason: '透气性差', count: 8, ratio: '25.0%' }, { reason: '色差', count: 7, ratio: '21.9%' }, { reason: '其他', count: 5, ratio: '15.6%' }] },
    { spu: 'SPU-FS-1012-B', productName: '轻暖磨毛打底衫', styleCode: '74-基础服装-基础针织', salesCount: 1800, score: 4.6, totalBadReviews: 36, fabricBadReviews: 24, fabricRatio: '0.44%', reasons: [{ reason: '扎肤', count: 9, ratio: '37.5%' }, { reason: '透气性差', count: 6, ratio: '25.0%' }, { reason: '色差', count: 5, ratio: '20.8%' }, { reason: '其他', count: 4, ratio: '16.7%' }] },
  ]},
  { id: 'FS-003', image: '', spu: 'SPU-ML-1038', fabricName: '弹力罗纹针织面料', relatedSpuCount: 5, totalSales: 9200, totalBadReviews: 248, fabricBadReviews: 198, badReviewRatio: '2.15%', ratioLevel: 'medium', reasons: [{ reason: '起球', count: 72, ratio: '36.4%' }, { reason: '变形', count: 48, ratio: '24.2%' }, { reason: '掉色', count: 42, ratio: '21.2%' }, { reason: '其他', count: 36, ratio: '18.2%' }], details: [
    { spu: 'SPU-FS-1038-A', productName: '简约百搭上衣', styleCode: '86-基础服装-基础外套', salesCount: 2200, score: 4.3, totalBadReviews: 66, fabricBadReviews: 48, fabricRatio: '0.87%', reasons: [{ reason: '起球', count: 18, ratio: '37.5%' }, { reason: '变形', count: 12, ratio: '25.0%' }, { reason: '掉色', count: 10, ratio: '20.8%' }, { reason: '其他', count: 8, ratio: '16.7%' }] },
  ]},
  { id: 'FS-004', image: '', spu: 'SPU-ML-1060', fabricName: '磨毛保暖内搭面料', relatedSpuCount: 3, totalSales: 5400, totalBadReviews: 92, fabricBadReviews: 68, badReviewRatio: '1.26%', ratioLevel: 'low', reasons: [{ reason: '掉毛', count: 24, ratio: '35.3%' }, { reason: '缩水', count: 18, ratio: '26.5%' }, { reason: '色差', count: 14, ratio: '20.6%' }, { reason: '其他', count: 12, ratio: '17.6%' }], details: [] },
  { id: 'FS-005', image: '', spu: 'SPU-ML-1061', fabricName: '棉氨弹力打底面料', relatedSpuCount: 4, totalSales: 7800, totalBadReviews: 312, fabricBadReviews: 256, badReviewRatio: '3.28%', ratioLevel: 'high', reasons: [{ reason: '起球', count: 96, ratio: '37.5%' }, { reason: '掉色', count: 64, ratio: '25.0%' }, { reason: '缩水', count: 52, ratio: '20.3%' }, { reason: '其他', count: 44, ratio: '17.2%' }], details: [] },
  { id: 'FS-006', image: '', spu: 'SPU-ML-1062', fabricName: '莱赛尔垂感衬衫面料', relatedSpuCount: 3, totalSales: 6200, totalBadReviews: 78, fabricBadReviews: 52, badReviewRatio: '0.84%', ratioLevel: 'low', reasons: [{ reason: '勾丝', count: 18, ratio: '34.6%' }, { reason: '缩水', count: 14, ratio: '26.9%' }, { reason: '色差', count: 10, ratio: '19.2%' }, { reason: '其他', count: 10, ratio: '19.2%' }], details: [] },
  { id: 'FS-007', image: '', spu: 'SPU-ML-1063', fabricName: '空气层卫衣面料', relatedSpuCount: 5, totalSales: 10800, totalBadReviews: 216, fabricBadReviews: 168, badReviewRatio: '1.56%', ratioLevel: 'medium', reasons: [{ reason: '起球', count: 60, ratio: '35.7%' }, { reason: '变形', count: 42, ratio: '25.0%' }, { reason: '掉色', count: 36, ratio: '21.4%' }, { reason: '其他', count: 30, ratio: '17.9%' }], details: [] },
  { id: 'FS-008', image: '', spu: 'SPU-ML-1064', fabricName: '亲肤针织家居面料', relatedSpuCount: 2, totalSales: 4200, totalBadReviews: 56, fabricBadReviews: 38, badReviewRatio: '0.90%', ratioLevel: 'low', reasons: [{ reason: '扎肤', count: 14, ratio: '36.8%' }, { reason: '起球', count: 10, ratio: '26.3%' }, { reason: '缩水', count: 8, ratio: '21.1%' }, { reason: '其他', count: 6, ratio: '15.8%' }], details: [] },
]

function ratioBadge(level: string): string {
  if (level === 'high') return 'bg-red-50 text-red-700 border border-red-200'
  if (level === 'medium') return 'bg-orange-50 text-orange-700 border border-orange-200'
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}

function renderReasons(reasons: ScoreReason[]): string {
  return reasons.map(r => `<div class="text-xs text-slate-600">${r.reason}（${r.ratio}）</div>`).join('')
}

function renderDetailSubRow(d: ScoreDetail): string {
  const initial = d.productName.charAt(0)
  return `
    <tr class="border-t border-slate-50 hover:bg-slate-50 bg-slate-50/50">
      <td class="px-3 py-2"><div class="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-medium">${initial}</div></td>
      <td class="px-3 py-2 font-mono text-xs text-blue-600">${d.spu}</td>
      <td class="px-3 py-2 text-slate-700 text-xs">${d.productName}</td>
      <td class="px-3 py-2 text-slate-500 text-xs font-mono">${d.styleCode}</td>
      <td class="px-3 py-2 text-right text-slate-600 text-xs">${d.salesCount.toLocaleString()}</td>
      <td class="px-3 py-2 text-right text-slate-700 text-xs font-medium">${d.score}</td>
      <td class="px-3 py-2 text-right text-slate-600 text-xs">${d.totalBadReviews}</td>
      <td class="px-3 py-2 text-right text-slate-600 text-xs">${d.fabricBadReviews}</td>
      <td class="px-3 py-2 text-right text-xs font-medium text-slate-700">${d.fabricRatio}</td>
      <td class="px-3 py-2 text-xs" style="min-width:16rem">${renderReasons(d.reasons)}</td>
    </tr>`
}

export function renderRawFabricScore(_state: AppState): string {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">面料评分</h1>
        <p class="text-sm text-slate-500 mt-0.5">用于查看面料维度差评表现，聚焦差评数量和原因占比分布。</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawFSSearch" type="text" placeholder="输入面料SPU（多个用中文逗号分隔）" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-80 focus:border-blue-400 focus:outline-none">
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">查询</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedScores.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1500px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">面料图片</th>
            <th class="px-3 py-2 text-left font-medium">面料SPU</th>
            <th class="px-3 py-2 text-left font-medium">面料名称</th>
            <th class="px-3 py-2 text-right font-medium">关联商品SPU数量</th>
            <th class="px-3 py-2 text-right font-medium">总销量</th>
            <th class="px-3 py-2 text-right font-medium">总差评数</th>
            <th class="px-3 py-2 text-right font-medium">面料总差评数</th>
            <th class="px-3 py-2 text-right font-medium cursor-pointer select-none">面料总差评数占比 <span class="text-slate-400">⇅</span></th>
            <th class="px-3 py-2 text-left font-medium" style="min-width:16rem">总差评原因占比</th>
            <th class="px-3 py-2 text-center font-medium">详情</th>
          </tr></thead>
          <tbody id="wlsRawFSBody">
            ${seedScores.map(s => `
              <tr class="border-t border-slate-100 hover:bg-slate-50 wls-fs-row" data-id="${s.id}">
                <td class="px-3 py-2">
                  <div class="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm text-slate-400 font-medium">${s.fabricName.charAt(0)}</div>
                </td>
                <td class="px-3 py-2"><a href="javascript:void(0)" class="text-blue-600 hover:underline text-xs font-mono">${s.spu}</a></td>
                <td class="px-3 py-2 text-slate-700">${s.fabricName}</td>
                <td class="px-3 py-2 text-right text-slate-600">${s.relatedSpuCount}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${s.totalSales.toLocaleString()}</td>
                <td class="px-3 py-2 text-right text-slate-600">${s.totalBadReviews}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${s.fabricBadReviews}</td>
                <td class="px-3 py-2 text-right"><span class="rounded-full px-2 py-0.5 text-xs font-medium ${ratioBadge(s.ratioLevel)}">${s.badReviewRatio}</span></td>
                <td class="px-3 py-2" style="min-width:16rem">${renderReasons(s.reasons)}</td>
                <td class="px-3 py-2 text-center">
                  <button class="wls-fs-toggle rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" data-id="${s.id}" data-expanded="false">
                    展开
                  </button>
                </td>
              </tr>
              ${s.details.length > 0 ? `
              <tr class="wls-fs-detail hidden" data-detail-for="${s.id}">
                <td colspan="10" class="px-0 py-0">
                  <div class="bg-white border-t border-slate-100">
                    <table class="w-full text-sm">
                      <thead><tr class="bg-slate-50/80 text-slate-400 text-xs">
                        <th class="px-3 py-1.5 text-left font-medium">商品图片</th>
                        <th class="px-3 py-1.5 text-left font-medium">商品SPU</th>
                        <th class="px-3 py-1.5 text-left font-medium">商品名称</th>
                        <th class="px-3 py-1.5 text-left font-medium">款式编号</th>
                        <th class="px-3 py-1.5 text-right font-medium">商品SPU销量</th>
                        <th class="px-3 py-1.5 text-right font-medium">评分</th>
                        <th class="px-3 py-1.5 text-right font-medium">差评数</th>
                        <th class="px-3 py-1.5 text-right font-medium">面料差评数</th>
                        <th class="px-3 py-1.5 text-right font-medium">面料差评数占比</th>
                        <th class="px-3 py-1.5 text-left font-medium">差评原因占比</th>
                      </tr></thead>
                      <tbody>
                        ${s.details.map(d => renderDetailSubRow(d)).join('')}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>` : ''}
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawFabricScore = {
      init() {
        document.querySelectorAll('.wls-fs-toggle').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const detailRow = document.querySelector('.wls-fs-detail[data-detail-for="' + id + '"]');
            if (!detailRow) return;
            const expanded = btn.getAttribute('data-expanded') === 'true';
            if (expanded) {
              detailRow.classList.add('hidden');
              btn.textContent = '展开';
              btn.setAttribute('data-expanded', 'false');
            } else {
              detailRow.classList.remove('hidden');
              btn.textContent = '收起';
              btn.setAttribute('data-expanded', 'true');
            }
          });
        });
      }
    };
    window.__wlsRawFabricScore.init();
  </script>`
}
