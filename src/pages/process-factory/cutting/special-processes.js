import { productionOrders } from '../../../data/fcs/production-orders.ts';
import { getProductionOrderTechPackSnapshot } from '../../../data/fcs/production-order-tech-pack-runtime.ts';
import { escapeHtml } from '../../../utils.ts';
import { renderMaterialIdentityBlock } from './material-identity.ts';
const formatNumber = (value) => value.toLocaleString('zh-CN');
const pickText = (...values) => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim())
            return value.trim();
        if (typeof value === 'number' && Number.isFinite(value))
            return String(value);
    }
    return '';
};
const pickNumber = (...values) => {
    for (const value of values) {
        const numberValue = Number(value);
        if (Number.isFinite(numberValue) && numberValue > 0)
            return numberValue;
    }
    return 0;
};
const collectOrderDemandQty = (order) => {
    const skuLines = Array.isArray(order.demandSnapshot?.skuLines) ? order.demandSnapshot.skuLines : [];
    const lineTotal = skuLines.reduce((sum, line) => {
        return sum + pickNumber(line.qty, line.quantity, line.orderQty, line.plannedQty);
    }, 0);
    return lineTotal || pickNumber(order.totalQty, order.plannedQty, order.quantity);
};
const isBindingPart = (part) => {
    const bundleWidth = pickNumber(part.bundleWidthCm, part.bindingWidthCm, part.stripWidthCm);
    const stripCount = pickNumber(part.stripCount, part.bindingStripCount);
    const text = JSON.stringify({
        craftName: part.craftName,
        operationName: part.operationName,
        specialCrafts: part.specialCrafts,
        craftTags: part.craftTags,
        remark: part.remark,
    });
    return bundleWidth > 0 || stripCount > 0 || text.includes('捆条');
};
const buildStripSpec = (part) => {
    const width = pickNumber(part.bundleWidthCm, part.bindingWidthCm, part.stripWidthCm);
    const count = pickNumber(part.stripCount, part.bindingStripCount);
    const pieces = [
        width ? `宽 ${width} cm` : '',
        count ? `${formatNumber(count)} 条/件` : '',
    ].filter(Boolean);
    return pieces.join(' / ') || '按正式技术包捆条要求';
};
const resolveMaterialIdentity = (snapshot, materialSku) => {
    const bomItems = Array.isArray(snapshot.bomItems) ? snapshot.bomItems : [];
    const normalizedSku = materialSku.trim().toLowerCase();
    const matchedBom = bomItems.find((item) => {
        const candidates = [
            item.materialSku,
            item.materialCode,
            item.materialName,
            item.materialLabel,
            item.name,
            item.sku,
        ];
        return candidates.some((value) => String(value || '').trim().toLowerCase() === normalizedSku);
    }) || null;
    const patternFiles = Array.isArray(snapshot.patternFiles) ? snapshot.patternFiles : [];
    const matchedPattern = patternFiles.find((file) => {
        const candidates = [file.linkedMaterialSku, file.materialSku, file.linkedMaterialAlias];
        return candidates.some((value) => String(value || '').trim().toLowerCase() === normalizedSku);
    }) || null;
    return {
        materialAlias: pickText(matchedBom?.materialAlias, matchedPattern?.linkedMaterialAlias),
        materialImageUrl: pickText(matchedBom?.materialImageUrl, matchedPattern?.imageUrl),
    };
};
const collectBindingParts = (snapshot) => {
    const parts = [];
    const cutPieceParts = Array.isArray(snapshot.cutPieceParts) ? snapshot.cutPieceParts : [];
    cutPieceParts.forEach((part) => {
        if (isBindingPart(part))
            parts.push(part);
    });
    const patternFiles = Array.isArray(snapshot.patternFiles) ? snapshot.patternFiles : [];
    patternFiles.forEach((file) => {
        const pieceRows = Array.isArray(file.pieceRows) ? file.pieceRows : [];
        pieceRows.forEach((part) => {
            const mergedPart = { ...part, materialSku: part.materialSku ?? file.materialSku };
            if (isBindingPart(mergedPart))
                parts.push(mergedPart);
        });
    });
    return parts;
};
const buildBindingProcessOrders = () => {
    const rows = [];
    productionOrders.forEach((order) => {
        const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId);
        if (!snapshot)
            return;
        const bindingParts = collectBindingParts(snapshot);
        if (!bindingParts.length)
            return;
        const baseQty = collectOrderDemandQty(order) || 1;
        bindingParts.forEach((part, index) => {
            const plannedQty = baseQty * Math.max(1, pickNumber(part.stripCount, part.bindingStripCount, 1));
            const materialSku = pickText(part.materialSku, part.materialName, snapshot.mainMaterialSku, '主面料');
            const materialIdentity = resolveMaterialIdentity(snapshot, materialSku);
            rows.push({
                id: `${order.productionOrderId}-BIND-${index + 1}`,
                orderNo: `BT-${String(order.productionOrderNo ?? order.productionOrderId).replace(/^PO-/, '')}-${String(index + 1).padStart(2, '0')}`,
                productionOrderNo: pickText(order.productionOrderNo, order.productionOrderId),
                spuCode: pickText(snapshot.spuCode, order.spuCode),
                spuName: pickText(snapshot.spuName, order.spuName),
                materialSku,
                materialAlias: materialIdentity.materialAlias,
                materialImageUrl: materialIdentity.materialImageUrl,
                color: pickText(part.color, part.colorName, snapshot.colors?.[0], '按技术包'),
                partName: pickText(part.partName, part.name, part.pieceName, '捆条部位'),
                stripSpec: buildStripSpec(part),
                plannedQty,
                warehouseState: index % 3 === 0 ? '待加工仓已入' : '待加工仓待入',
                assignmentState: index % 2 === 0 ? '待分配' : '已分配',
                executionState: index % 2 === 0 ? '待开工' : '进行中',
            });
        });
    });
    return rows.slice(0, 30);
};
const renderStateBadge = (value, tone = 'blue') => {
    const toneClass = tone === 'green'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : tone === 'orange'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-blue-50 text-blue-700 border-blue-200';
    return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}">${escapeHtml(value)}</span>`;
};
function showBindingToast(message) {
    const rootId = 'cutting-binding-toast-root';
    let root = document.getElementById(rootId);
    if (!root) {
        root = document.createElement('div');
        root.id = rootId;
        root.className = 'fixed right-6 top-20 z-50 flex flex-col gap-2';
        document.body.appendChild(root);
    }
    const toast = document.createElement('div');
    toast.className = 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg';
    toast.textContent = message;
    root.appendChild(toast);
    window.setTimeout(() => {
        toast.remove();
        if (root && root.childElementCount === 0)
            root.remove();
    }, 1800);
}
export function renderCraftCuttingSpecialProcessesPage() {
    const rows = buildBindingProcessOrders();
    const totalQty = rows.reduce((sum, row) => sum + row.plannedQty, 0);
    const pendingCount = rows.filter((row) => row.assignmentState === '待分配').length;
    const inProgressCount = rows.filter((row) => row.executionState === '进行中').length;
    return `
    <section class="space-y-6 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-950">捆条加工单</h1>
        </div>
        <div class="flex items-center gap-2">
          <button class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" data-cutting-binding-action="refresh">刷新</button>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm text-slate-500">捆条加工单</div>
          <div class="mt-2 text-2xl font-semibold text-slate-950">${formatNumber(rows.length)} 单</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm text-slate-500">待分配</div>
          <div class="mt-2 text-2xl font-semibold text-amber-600">${formatNumber(pendingCount)} 单</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm text-slate-500">计划捆条数量</div>
          <div class="mt-2 text-2xl font-semibold text-slate-950">${formatNumber(totalQty)} 条</div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 class="text-base font-semibold text-slate-950">捆条加工单列表</h2>
          <span class="text-sm text-slate-500">进行中 ${formatNumber(inProgressCount)} 单</span>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th class="px-4 py-3">捆条加工单号</th>
                <th class="px-4 py-3">生产单</th>
                <th class="px-4 py-3">款号 / SPU</th>
                <th class="px-4 py-3">面料 / 颜色</th>
                <th class="px-4 py-3">裁片关联</th>
                <th class="px-4 py-3">条带规格</th>
                <th class="px-4 py-3">计划数量</th>
                <th class="px-4 py-3">裁床仓库</th>
                <th class="px-4 py-3">分配</th>
                <th class="px-4 py-3">执行</th>
                <th class="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${rows.length
        ? rows
            .map((row) => {
            return `
                          <tr class="hover:bg-slate-50">
                            <td class="px-4 py-3 font-semibold text-slate-950">${escapeHtml(row.orderNo)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.productionOrderNo)}</td>
                            <td class="px-4 py-3">
                              <div class="font-semibold text-slate-950">${escapeHtml(row.spuCode)}</div>
                              <div class="text-xs text-slate-500">${escapeHtml(row.spuName)}</div>
                            </td>
                            <td class="px-4 py-3">
                              ${renderMaterialIdentityBlock(row, { compact: true })}
                              <div class="text-xs text-slate-500">${escapeHtml(row.color)}</div>
                            </td>
                            <td class="px-4 py-3">${escapeHtml(row.partName)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.stripSpec)}</td>
                            <td class="px-4 py-3 font-semibold">${formatNumber(row.plannedQty)} 条</td>
                            <td class="px-4 py-3">${renderStateBadge(row.warehouseState, row.warehouseState.includes('已入') ? 'green' : 'orange')}</td>
                            <td class="px-4 py-3">${renderStateBadge(row.assignmentState, row.assignmentState === '已分配' ? 'green' : 'orange')}</td>
                            <td class="px-4 py-3">${renderStateBadge(row.executionState, row.executionState === '进行中' ? 'blue' : 'orange')}</td>
                            <td class="px-4 py-3">
                              <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" data-cutting-binding-action="detail" data-row-id="${escapeHtml(row.id)}">查看</button>
                            </td>
                          </tr>
                        `;
        })
            .join('')
        : `<tr><td class="px-4 py-10 text-center text-slate-500" colspan="11">暂无捆条加工单</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
export function handleCraftCuttingSpecialProcessesEvent(target) {
    const button = target.closest('[data-cutting-binding-action]');
    if (!button)
        return false;
    const action = button.dataset.cuttingBindingAction;
    if (action === 'refresh') {
        showBindingToast('捆条加工单已刷新');
        return true;
    }
    if (action === 'detail') {
        showBindingToast('捆条加工单详情已打开');
        return true;
    }
    return false;
}
export function isCraftCuttingSpecialProcessesDialogOpen() {
    return false;
}
