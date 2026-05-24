import { CUTTING_QR_VERSION, validateFeiCraftSequence, } from '../../../data/fcs/cutting/qr-codes.ts';
import { getFeiTicketById, getFeiTicketByNo, } from '../../../data/fcs/cutting/generated-fei-tickets.ts';
import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { buildActiveTicketPocketBindingMap, } from './transfer-bags-model.ts';
import { deserializeFeiQrPayload, } from './fei-qr-model.ts';
import { buildCuttingTraceabilityProjectionContext, } from './traceability-projection-helpers.ts';
export function buildCraftTraceProjection(snapshot = buildFcsCuttingDomainSnapshot(), options) {
    const context = buildCuttingTraceabilityProjectionContext(snapshot, options?.transferBagStore);
    const ticketRecords = options?.ticketRecords || context.ticketRecords;
    const activeBindings = buildActiveTicketPocketBindingMap(context.transferBagStore);
    const items = ticketRecords.map((record) => {
        const generated = getFeiTicketById(record.ticketRecordId) || getFeiTicketByNo(record.ticketNo);
        const payload = deserializeFeiQrPayload(record.qrSerializedValue || record.qrValue);
        const secondaryCrafts = payload?.secondaryCrafts || generated?.secondaryCrafts || record.processTags || [];
        const craftSequenceVersion = payload?.craftSequenceVersion || generated?.craftSequenceVersion || CUTTING_QR_VERSION;
        const currentCraftStage = payload?.currentCraftStage || generated?.currentCraftStage || '';
        const currentCraftType = options?.currentCraftType || currentCraftStage || secondaryCrafts[0] || '';
        const completedCrafts = options?.completedCraftsByTicketId?.[record.ticketRecordId] || [];
        const validation = payload && currentCraftType
            ? validateFeiCraftSequence(payload, currentCraftType, completedCrafts)
            : {
                allowed: secondaryCrafts.length === 0,
                reason: secondaryCrafts.length ? '当前未指定扫码工艺，已保留正式顺序数据。' : '当前菲票未配置二级工艺顺序。',
                currentCraftType,
                requiredPreviousCrafts: [],
            };
        const binding = activeBindings[record.ticketRecordId];
        return {
            feiTicketId: generated?.feiTicketId || record.ticketRecordId,
            feiTicketNo: generated?.feiTicketNo || record.ticketNo,
            cutOrderId: record.cutOrderId,
            cutOrderNo: record.cutOrderNo,
            productionOrderNo: record.productionOrderNo,
            materialSku: record.materialSku,
            secondaryCrafts,
            craftSequenceVersion,
            currentCraftStage,
            completedCrafts,
            validation,
            carrierCode: binding?.pocketNo || record.boundPocketNo || '',
            usageNo: binding?.usageNo || record.boundUsageNo || '',
            qrValue: record.qrSerializedValue || record.qrValue,
        };
    });
    return {
        items,
        itemsByTicketId: Object.fromEntries(items.map((item) => [item.feiTicketId, item])),
        itemsByTicketNo: Object.fromEntries(items.map((item) => [item.feiTicketNo, item])),
    };
}
