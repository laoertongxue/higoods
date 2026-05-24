import { mockFactories } from './factory-mock-data.ts';
import { getProcessDefinitionByCode } from './process-craft-dict.ts';
import { listWarehouseIssueOrders } from './warehouse-material-execution.ts';
import { getPdaPickupRecordsByHead, getPdaHandoverRecordsByHead, listPdaHandoverHeads, } from './pda-handover-events.ts';
const DEFAULT_AREA_NAMES = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区', '异常区', '待确认区'];
const NORMAL_AREA_NAMES = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区'];
const SEWING_FACTORY_TYPES = new Set(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING']);
let internalWarehouseStore = null;
function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}
function nowTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
function roundQty(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.round(Number(value) * 100) / 100;
}
function hashCode(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
}
function isSewingFactory(factory) {
    return SEWING_FACTORY_TYPES.has(factory.factoryType);
}
function isNonSewingFactory(factory) {
    return !isSewingFactory(factory);
}
function getWarehouseShortName(warehouseKind) {
    return warehouseKind === 'WAIT_PROCESS' ? '待加工仓' : '待交出仓';
}
function getWarehouseKindLabel(warehouseKind) {
    return getWarehouseShortName(warehouseKind);
}
function getWarehouseLocationStatusLabel(status) {
    return status === 'AVAILABLE' ? '可用' : '停用';
}
function resolvePrimaryFactoryProcess(factory) {
    const explicitProcessCode = factory.factoryType === 'CENTRAL_PRINT'
        ? 'PRINT'
        : factory.factoryType === 'CENTRAL_DYE'
            ? 'DYE'
            : factory.factoryType === 'CENTRAL_CUTTING'
                ? 'CUT_PANEL'
                : factory.factoryType === 'SATELLITE_FINISHING' || factory.factoryType === 'CENTRAL_AUX' || factory.factoryType === 'CENTRAL_LACE'
                    ? 'POST_FINISHING'
                    : factory.factoryType === 'CENTRAL_DENIM_WASH' || factory.factoryType === 'CENTRAL_SPECIAL'
                        ? 'SPECIAL_CRAFT'
                        : factory.factoryType === 'CENTRAL_WOOL'
                            ? 'PLEATING'
                            : undefined;
    if (explicitProcessCode) {
        const processDefinition = getProcessDefinitionByCode(explicitProcessCode);
        return {
            processCode: explicitProcessCode,
            processName: processDefinition?.processName ?? explicitProcessCode,
        };
    }
    const ability = factory.processAbilities.find((item) => item.processCode !== 'SEW') || factory.processAbilities[0];
    if (!ability)
        return {};
    return {
        processCode: ability.processCode,
        processName: ability.processName || getProcessDefinitionByCode(ability.processCode)?.processName || ability.processCode,
    };
}
function buildDefaultLocations(areaName) {
    const prefix = areaName.replace('区', '');
    return [
        {
            locationId: `LOC-${prefix}-01-01`,
            locationNo: `${prefix}-01-01`,
            locationName: `${prefix}-01-01`,
            status: 'AVAILABLE',
            remark: areaName === '异常区' ? '用于差异与破损暂存' : areaName === '待确认区' ? '待领料或待确认明细' : '',
        },
        {
            locationId: `LOC-${prefix}-01-02`,
            locationNo: `${prefix}-01-02`,
            locationName: `${prefix}-01-02`,
            status: 'AVAILABLE',
            remark: '',
        },
    ];
}
function buildDefaultShelf(areaName) {
    const prefix = areaName.replace('区', '');
    return [
        {
            shelfId: `SHELF-${prefix}-01`,
            shelfNo: `${prefix}-01`,
            shelfName: `${prefix}-01`,
            locationList: buildDefaultLocations(areaName),
            status: 'AVAILABLE',
            remark: areaName === '异常区' ? '异常件集中放置' : '',
        },
    ];
}
function buildDefaultAreaList() {
    return DEFAULT_AREA_NAMES.map((areaName) => ({
        areaId: `AREA-${areaName}`,
        areaName,
        shelfList: buildDefaultShelf(areaName),
        status: 'AVAILABLE',
        remark: areaName === '待确认区' ? '待接收或待复核' : '',
    }));
}
export function buildDefaultFactoryInternalWarehouses(factories = mockFactories) {
    return factories
        .filter((factory) => isNonSewingFactory(factory))
        .flatMap((factory) => {
        const createdAt = factory.createdAt || '2026-04-01 08:00:00';
        const updatedAt = factory.updatedAt || createdAt;
        return ['WAIT_PROCESS', 'WAIT_HANDOVER'].map((warehouseKind) => {
            const warehouseShortName = getWarehouseShortName(warehouseKind);
            return {
                warehouseId: `FIW-${factory.id}-${warehouseKind}`,
                factoryId: factory.id,
                factoryName: factory.name,
                factoryKind: factory.factoryType,
                warehouseKind,
                warehouseName: `${factory.name} · ${warehouseShortName}`,
                warehouseShortName,
                isDefault: true,
                isEnabled: true,
                areaList: buildDefaultAreaList(),
                createdAt,
                updatedAt,
            };
        });
    });
}
function pickWarehouseLocation(warehouse, seed, status) {
    const preferredAreaName = status === '差异待处理' || status === '差异' || status === '异议中'
        ? '异常区'
        : status === '待领料' || status === '待确认'
            ? '待确认区'
            : NORMAL_AREA_NAMES[hashCode(seed) % NORMAL_AREA_NAMES.length];
    const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName) || warehouse.areaList[0];
    const shelf = area.shelfList[0];
    const location = shelf.locationList[hashCode(seed) % shelf.locationList.length];
    return {
        areaName: area.areaName,
        shelfNo: shelf.shelfNo,
        locationNo: location.locationNo,
        locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
    };
}
function resolvePickupRecordStatus(doc, line) {
    const receivedQty = doc.status === 'RECEIVED' ? roundQty(line.issuedQty || line.transferredQty || line.preparedQty) : 0;
    const differenceQty = roundQty(receivedQty - line.plannedQty);
    if (differenceQty !== 0)
        return '差异待处理';
    return doc.status === 'RECEIVED' ? '已入库' : '待确认';
}
function resolveWaitProcessStockStatus(record) {
    if (record.status === '差异待处理')
        return '差异待处理';
    if (record.status === '已入库')
        return '已入待加工仓';
    return '待领料';
}
function resolveHandoutStatus(record) {
    if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING')
        return '异议中';
    const handoverDiffQty = roundQty(record.diffQty ?? (typeof record.receiverWrittenQty === 'number'
        ? record.receiverWrittenQty - (record.submittedQty ?? record.plannedQty ?? 0)
        : 0));
    if (typeof record.receiverWrittenQty === 'number' && handoverDiffQty !== 0)
        return '差异';
    if (typeof record.receiverWrittenQty === 'number')
        return '已回写';
    return '已出库';
}
function resolveWaitHandoverStatus(record) {
    if (record.status === '异议中')
        return '异议中';
    if (record.status === '差异')
        return '差异';
    if (record.status === '已回写')
        return '已回写';
    return '已交出';
}
function resolveFactoryByName(factoryName, fallbackType) {
    if (factoryName) {
        const exact = mockFactories.find((factory) => factory.name === factoryName);
        if (exact)
            return exact;
    }
    if (factoryName?.includes('后道')) {
        return mockFactories.find((factory) => factory.factoryType === 'SATELLITE_FINISHING');
    }
    if (fallbackType) {
        return mockFactories.find((factory) => factory.factoryType === fallbackType);
    }
    return undefined;
}
function normalizeWarehouseReceiverKind(head) {
    const receiverText = `${head.receiverName || ''}${head.targetName || ''}`;
    if (receiverText.includes('中转'))
        return '中转仓';
    if (receiverText.includes('裁片仓'))
        return '裁片仓';
    if (receiverText.includes('裁床'))
        return '裁床厂';
    if (receiverText.includes('成衣仓'))
        return '成衣仓';
    if (receiverText.includes('后道'))
        return '后道工厂';
    return '其他接收方';
}
function resolveSourceObjectKindFromHead(head) {
    if ((head.processBusinessCode || '').includes('CUT'))
        return '裁床厂';
    if (head.processBusinessCode === 'PRINT')
        return '印花厂';
    if (head.processBusinessCode === 'DYE')
        return '染厂';
    if (head.processBusinessCode === 'POST_FINISHING' || head.sourceFactoryName.includes('后道'))
        return '后道工厂';
    if (head.isSpecialCraft || head.sourceFactoryName.includes('特'))
        return '特殊工艺厂';
    if (head.sourceFactoryName.includes('中转'))
        return '中转仓';
    return '上游工厂仓';
}
function deriveFactoryItemKind(input) {
    if (input.handoutObjectType === 'CUT_PIECE' || input.partName)
        return '裁片';
    if (input.handoutObjectType === 'SEMI_FINISHED_GARMENT')
        return '成衣半成品';
    if (input.handoutObjectType === 'FABRIC')
        return '面料';
    if (input.processCode === 'POST_FINISHING')
        return '成衣半成品';
    const materialName = input.lineMaterialName || '';
    if (materialName.includes('面料') || materialName.includes('布'))
        return '面料';
    if (materialName.includes('辅'))
        return '辅料';
    return '其他半成品';
}
function buildInboundRecordFromPickupInput(input) {
    const { warehouse, factory, doc, line, lineIndex } = input;
    const status = resolvePickupRecordStatus(doc, line);
    const receivedQty = status === '已入库' || status === '差异待处理' ? roundQty(line.issuedQty || line.transferredQty || line.preparedQty) : 0;
    const differenceQty = roundQty(receivedQty - line.plannedQty);
    const location = pickWarehouseLocation(warehouse, `${doc.id}-${line.lineId}`, status);
    const factoryProcess = resolvePrimaryFactoryProcess(factory);
    return {
        inboundRecordId: `INB-${doc.id}-${String(lineIndex + 1).padStart(3, '0')}`,
        inboundRecordNo: `RK-${doc.docNo}-${String(lineIndex + 1).padStart(2, '0')}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: factory.id,
        factoryName: factory.name,
        factoryKind: factory.factoryType,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        sourceRecordId: doc.id,
        sourceRecordNo: doc.docNo,
        sourceRecordType: 'MATERIAL_PICKUP',
        sourceObjectName: doc.warehouseName || '面辅料仓',
        taskId: doc.runtimeTaskId,
        taskNo: doc.taskNo,
        itemKind: deriveFactoryItemKind({ lineMaterialName: line.materialName }),
        itemName: line.materialName,
        materialSku: line.materialCode,
        partName: line.pieceName,
        fabricColor: line.skuColor,
        sizeCode: line.skuSize,
        fabricRollNo: line.materialSpec,
        expectedQty: roundQty(line.plannedQty),
        receivedQty,
        differenceQty,
        unit: line.unit,
        receiverName: factory.name,
        receivedAt: doc.updatedAt,
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status,
        abnormalReason: differenceQty !== 0 ? '数量不符' : undefined,
        photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
        remark: '由领料记录生成',
    };
}
export function buildInboundRecordFromPickup(doc, line, factory, warehouse, lineIndex = 0) {
    return buildInboundRecordFromPickupInput({ doc, line, factory, warehouse, lineIndex });
}
function shouldSeedInboundFromPickupRecord(record) {
    return ['RECEIVED', 'OBJECTION_REPORTED', 'OBJECTION_PROCESSING', 'OBJECTION_RESOLVED'].includes(record.status);
}
function resolveInboundStatusFromPickupRecord(record) {
    return record.status === 'RECEIVED' ? '已入库' : '差异待处理';
}
function resolvePickupRecordReceivedQty(record) {
    if (typeof record.finalResolvedQty === 'number')
        return roundQty(record.finalResolvedQty);
    if (typeof record.factoryReportedQty === 'number')
        return roundQty(record.factoryReportedQty);
    if (typeof record.factoryConfirmedQty === 'number')
        return roundQty(record.factoryConfirmedQty);
    if (typeof record.warehouseHandedQty === 'number')
        return roundQty(record.warehouseHandedQty);
    return roundQty(record.qtyExpected);
}
function buildInboundRecordFromPickupRecordInput(input) {
    const { warehouse, factory, head, record, recordIndex } = input;
    const expectedQty = roundQty(record.qtyExpected);
    const receivedQty = resolvePickupRecordReceivedQty(record);
    const differenceQty = roundQty(receivedQty - expectedQty);
    const status = resolveInboundStatusFromPickupRecord(record);
    const location = pickWarehouseLocation(warehouse, `${head.handoverId}-${record.recordId}`, status);
    const factoryProcess = resolvePrimaryFactoryProcess(factory);
    return {
        inboundRecordId: `INB-${head.handoverId}-${String(recordIndex + 1).padStart(3, '0')}`,
        inboundRecordNo: `RK-${head.handoverOrderNo || head.handoverId}-${String(recordIndex + 1).padStart(2, '0')}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: factory.id,
        factoryName: factory.name,
        factoryKind: factory.factoryType,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        sourceRecordId: record.recordId,
        sourceRecordNo: record.recordId,
        sourceRecordType: 'MATERIAL_PICKUP',
        sourceObjectName: head.sourceFactoryName || '上游仓库',
        taskId: head.taskId,
        taskNo: head.taskNo,
        itemKind: deriveFactoryItemKind({
            lineMaterialName: record.materialName,
            partName: record.pieceName,
            processCode: head.processBusinessCode,
        }),
        itemName: record.materialSummary || record.materialName || head.processName,
        materialSku: record.materialCode || record.skuCode,
        partName: record.pieceName,
        fabricColor: record.skuColor,
        sizeCode: record.skuSize,
        expectedQty,
        receivedQty,
        differenceQty,
        unit: record.qtyUnit,
        receiverName: head.targetName || factory.name,
        receivedAt: record.factoryConfirmedAt || record.finalResolvedAt || record.submittedAt,
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status,
        abnormalReason: differenceQty !== 0 ? record.objectionReason || '数量不符' : undefined,
        photoList: differenceQty !== 0
            ? ((record.objectionProofFiles?.length || 0) > 0 ? record.objectionProofFiles.map(() => '/placeholder.svg') : ['/placeholder.svg'])
            : [],
        remark: '由领料记录生成',
    };
}
function derivePartNameFromRecord(record) {
    return record.pieceName || record.cutPieceLines?.[0]?.piecePartLabel;
}
function deriveSkuFromRecord(record) {
    const firstLine = record.recordLines?.[0];
    return {
        materialSku: record.materialCode || firstLine?.materialSku || record.skuCode || firstLine?.garmentSkuCode,
        fabricColor: record.skuColor || firstLine?.garmentColor,
        sizeCode: record.skuSize || firstLine?.sizeCode,
        feiTicketNo: firstLine?.feiTicketNo,
    };
}
function buildInboundRecordFromHandoverReceiveInput(input) {
    const { warehouse, factory, head, record, recordIndex } = input;
    const expectedQty = roundQty(record.submittedQty ?? record.plannedQty ?? 0);
    const receivedQty = roundQty(record.receiverWrittenQty ?? 0);
    const differenceQty = roundQty(receivedQty - expectedQty);
    const status = typeof record.receiverWrittenQty !== 'number'
        ? '待确认'
        : differenceQty !== 0
            ? '差异待处理'
            : '已入库';
    const location = pickWarehouseLocation(warehouse, `${head.handoverId}-${record.recordId}`, status);
    const skuInfo = deriveSkuFromRecord(record);
    const factoryProcess = resolvePrimaryFactoryProcess(factory);
    return {
        inboundRecordId: `INB-${head.handoverId}-${String(recordIndex + 1).padStart(3, '0')}`,
        inboundRecordNo: `RK-${head.handoverOrderNo || head.handoverId}-${String(recordIndex + 1).padStart(2, '0')}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: factory.id,
        factoryName: factory.name,
        factoryKind: factory.factoryType,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        sourceRecordId: record.handoverRecordId || record.recordId,
        sourceRecordNo: record.handoverRecordNo || head.handoverOrderNo || head.handoverId,
        sourceRecordType: 'HANDOVER_RECEIVE',
        sourceObjectName: head.sourceFactoryName,
        taskId: head.taskId,
        taskNo: head.taskNo,
        itemKind: deriveFactoryItemKind({
            partName: derivePartNameFromRecord(record),
            handoutObjectType: record.objectType,
            processCode: head.processBusinessCode,
        }),
        itemName: record.handoutItemLabel || record.materialName || head.processName,
        materialSku: skuInfo.materialSku,
        partName: derivePartNameFromRecord(record),
        fabricColor: skuInfo.fabricColor,
        sizeCode: skuInfo.sizeCode,
        feiTicketNo: skuInfo.feiTicketNo,
        expectedQty,
        receivedQty,
        differenceQty,
        unit: record.qtyUnit || head.qtyUnit || '件',
        receiverName: head.receiverName || head.targetName,
        receivedAt: record.receiverWrittenAt || record.factorySubmittedAt,
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status,
        abnormalReason: differenceQty !== 0 ? record.diffReason || '数量不符' : undefined,
        photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
        remark: '由交出接收生成',
    };
}
export function buildInboundRecordFromHandoverReceive(head, record, factory, warehouse, recordIndex = 0) {
    return buildInboundRecordFromHandoverReceiveInput({ head, record, factory, warehouse, recordIndex });
}
function buildWaitProcessStockItemFromInbound(record) {
    return {
        stockItemId: `WPS-${record.inboundRecordId}`,
        warehouseId: record.warehouseId,
        factoryId: record.factoryId,
        factoryName: record.factoryName,
        factoryKind: record.factoryKind,
        warehouseName: record.warehouseName,
        processCode: record.processCode,
        processName: record.processName,
        craftCode: record.craftCode,
        craftName: record.craftName,
        sourceRecordId: record.sourceRecordId,
        sourceRecordNo: record.sourceRecordNo,
        sourceRecordType: record.sourceRecordType,
        sourceObjectKind: record.sourceRecordType === 'MATERIAL_PICKUP'
            ? '面辅料仓'
            : resolveSourceObjectKindFromHead({
                handoverId: '',
                headType: 'HANDOUT',
                qrCodeValue: '',
                taskId: record.taskId || '',
                taskNo: record.taskNo || '',
                productionOrderNo: '',
                processName: record.processName || '',
                sourceFactoryName: record.sourceObjectName,
                targetName: record.factoryName,
                targetKind: 'FACTORY',
                qtyUnit: record.unit,
                factoryId: record.factoryId,
                taskStatus: 'DONE',
                summaryStatus: 'WRITTEN_BACK',
                recordCount: 1,
                pendingWritebackCount: 0,
                writtenBackQtyTotal: record.receivedQty,
                objectionCount: 0,
                completionStatus: 'COMPLETED',
                qtyExpectedTotal: record.expectedQty,
                qtyActualTotal: record.receivedQty,
                qtyDiffTotal: record.differenceQty,
            }),
        sourceObjectName: record.sourceObjectName,
        taskId: record.taskId,
        taskNo: record.taskNo,
        productionOrderId: record.taskId,
        productionOrderNo: record.taskNo,
        itemKind: record.itemKind,
        itemName: record.itemName,
        materialSku: record.materialSku,
        partName: record.partName,
        fabricColor: record.fabricColor,
        sizeCode: record.sizeCode,
        feiTicketNo: record.feiTicketNo,
        transferBagNo: record.transferBagNo,
        fabricRollNo: record.fabricRollNo,
        expectedQty: record.expectedQty,
        receivedQty: record.receivedQty,
        differenceQty: record.differenceQty,
        unit: record.unit,
        receiverName: record.receiverName,
        receivedAt: record.receivedAt,
        locationText: `${record.areaName} / ${record.shelfNo} / ${record.locationNo}`,
        areaName: record.areaName,
        shelfNo: record.shelfNo,
        locationNo: record.locationNo,
        status: resolveWaitProcessStockStatus(record),
        abnormalReason: record.abnormalReason,
        photoList: [...record.photoList],
        remark: record.remark,
    };
}
function buildOutboundRecordFromHandoverRecordInput(input) {
    const { warehouse, factory, head, record, recordIndex } = input;
    const outboundQty = roundQty(record.submittedQty ?? record.plannedQty ?? 0);
    const receiverWrittenQty = typeof record.receiverWrittenQty === 'number' ? roundQty(record.receiverWrittenQty) : undefined;
    const differenceQty = typeof receiverWrittenQty === 'number' ? roundQty(receiverWrittenQty - outboundQty) : undefined;
    const status = resolveHandoutStatus(record);
    const skuInfo = deriveSkuFromRecord(record);
    const factoryProcess = resolvePrimaryFactoryProcess(factory);
    return {
        outboundRecordId: `OUT-${head.handoverId}-${String(recordIndex + 1).padStart(3, '0')}`,
        outboundRecordNo: `CK-${head.handoverOrderNo || head.handoverId}-${String(recordIndex + 1).padStart(2, '0')}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: factory.id,
        factoryName: factory.name,
        factoryKind: factory.factoryType,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        sourceTaskId: head.taskId,
        sourceTaskNo: head.taskNo,
        handoverOrderId: head.handoverOrderId || head.handoverId,
        handoverOrderNo: head.handoverOrderNo || head.handoverId,
        handoverRecordId: record.handoverRecordId || record.recordId,
        handoverRecordNo: record.handoverRecordNo || record.recordId,
        handoverRecordQrValue: record.handoverRecordQrValue,
        receiverKind: normalizeWarehouseReceiverKind(head),
        receiverName: head.receiverName || head.targetName,
        itemKind: deriveFactoryItemKind({
            partName: derivePartNameFromRecord(record),
            handoutObjectType: record.objectType,
            processCode: head.processBusinessCode,
        }),
        itemName: record.handoutItemLabel || record.materialName || head.processName,
        materialSku: skuInfo.materialSku,
        partName: derivePartNameFromRecord(record),
        fabricColor: skuInfo.fabricColor,
        sizeCode: skuInfo.sizeCode,
        feiTicketNo: skuInfo.feiTicketNo,
        outboundQty,
        receiverWrittenQty,
        differenceQty,
        unit: record.qtyUnit || head.qtyUnit || '件',
        operatorName: record.factorySubmittedBy || head.sourceFactoryName,
        outboundAt: record.factorySubmittedAt,
        status,
        abnormalReason: differenceQty ? record.diffReason || '数量不符' : record.objectionReason,
        photoList: record.receiverProofFiles?.map((file) => file.name) || [],
        remark: '由交出记录生成',
    };
}
export function buildOutboundRecordFromHandoverRecord(head, record, factory, warehouse, recordIndex = 0) {
    return buildOutboundRecordFromHandoverRecordInput({ head, record, factory, warehouse, recordIndex });
}
function buildWaitHandoverStockItemFromOutbound(record) {
    return {
        stockItemId: `WHS-${record.outboundRecordId}`,
        warehouseId: record.warehouseId,
        factoryId: record.factoryId,
        factoryName: record.factoryName,
        factoryKind: record.factoryKind,
        warehouseName: record.warehouseName,
        processCode: record.processCode,
        processName: record.processName,
        craftCode: record.craftCode,
        craftName: record.craftName,
        taskId: record.sourceTaskId,
        taskNo: record.sourceTaskNo,
        productionOrderId: record.sourceTaskId,
        productionOrderNo: record.sourceTaskNo,
        itemKind: record.itemKind,
        itemName: record.itemName,
        materialSku: record.materialSku,
        partName: record.partName,
        fabricColor: record.fabricColor,
        sizeCode: record.sizeCode,
        feiTicketNo: record.feiTicketNo,
        transferBagNo: record.transferBagNo,
        fabricRollNo: record.fabricRollNo,
        completedQty: record.outboundQty,
        lossQty: record.differenceQty && record.differenceQty < 0 ? Math.abs(record.differenceQty) : 0,
        waitHandoverQty: 0,
        unit: record.unit,
        receiverKind: record.receiverKind,
        receiverName: record.receiverName,
        handoverOrderId: record.handoverOrderId,
        handoverOrderNo: record.handoverOrderNo,
        handoverRecordId: record.handoverRecordId,
        handoverRecordNo: record.handoverRecordNo,
        handoverRecordQrValue: record.handoverRecordQrValue,
        receiverWrittenQty: record.receiverWrittenQty,
        differenceQty: record.differenceQty,
        objectionStatus: record.status === '异议中' ? '处理中' : undefined,
        areaName: record.status === '已出库' ? '待确认区' : record.status === '差异' || record.status === '异议中' ? '异常区' : 'B区',
        shelfNo: record.status === '已出库' ? '待确认-01' : record.status === '差异' || record.status === '异议中' ? '异常-01' : 'B-01',
        locationNo: record.status === '已出库' ? '待确认-01-01' : record.status === '差异' || record.status === '异议中' ? '异常-01-01' : 'B-01-01',
        status: resolveWaitHandoverStatus(record),
        abnormalReason: record.abnormalReason,
        photoList: [...record.photoList],
        remark: record.remark,
    };
}
function buildPendingWaitHandoverStockItem(input) {
    const { warehouse, factory, head } = input;
    const remainingQty = roundQty(head.qtyExpectedTotal - (head.submittedQtyTotal ?? 0));
    if (remainingQty <= 0)
        return null;
    const location = pickWarehouseLocation(warehouse, head.handoverId, '待交出');
    const factoryProcess = resolvePrimaryFactoryProcess(factory);
    return {
        stockItemId: `WHS-${head.handoverId}-PENDING`,
        warehouseId: warehouse.warehouseId,
        factoryId: factory.id,
        factoryName: factory.name,
        factoryKind: factory.factoryType,
        warehouseName: warehouse.warehouseName,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        taskId: head.taskId,
        taskNo: head.taskNo,
        productionOrderId: head.taskId,
        productionOrderNo: head.productionOrderNo,
        itemKind: deriveFactoryItemKind({
            processCode: head.processBusinessCode,
        }),
        itemName: `${head.processName}待交出`,
        completedQty: roundQty(head.qtyExpectedTotal),
        lossQty: 0,
        waitHandoverQty: remainingQty,
        unit: head.qtyUnit,
        receiverKind: normalizeWarehouseReceiverKind(head),
        receiverName: head.receiverName || head.targetName,
        handoverOrderId: head.handoverOrderId || head.handoverId,
        handoverOrderNo: head.handoverOrderNo || head.handoverId,
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status: '待交出',
        photoList: [],
        remark: '待交出库存',
    };
}
function buildMockCompletedWaitHandoverStockItem(input) {
    const { warehouse, factory } = input;
    const location = pickWarehouseLocation(warehouse, input.taskId, '待交出');
    const factoryProcess = resolvePrimaryFactoryProcess(factory);
    return {
        stockItemId: `WHS-${input.taskId}-PENDING`,
        warehouseId: warehouse.warehouseId,
        factoryId: factory.id,
        factoryName: factory.name,
        factoryKind: factory.factoryType,
        warehouseName: warehouse.warehouseName,
        processCode: factoryProcess.processCode,
        processName: factoryProcess.processName,
        taskId: input.taskId,
        taskNo: input.taskNo,
        productionOrderId: input.taskId,
        productionOrderNo: input.productionOrderNo,
        itemKind: input.itemKind,
        itemName: input.itemName,
        materialSku: input.materialSku,
        partName: input.partName,
        fabricColor: input.fabricColor,
        sizeCode: input.sizeCode,
        completedQty: roundQty(input.completedQty),
        lossQty: roundQty(input.lossQty),
        waitHandoverQty: roundQty(input.waitHandoverQty),
        unit: input.unit,
        receiverKind: input.receiverKind,
        receiverName: input.receiverName,
        areaName: location.areaName,
        shelfNo: location.shelfNo,
        locationNo: location.locationNo,
        status: '待交出',
        photoList: [],
        remark: input.remark,
    };
}
function buildStocktakeLineFromWaitProcess(orderId, item) {
    const bookQty = roundQty(item.receivedQty || item.expectedQty);
    const countedQty = item.status === '差异待处理' ? roundQty(Math.max(bookQty - 1, 0)) : bookQty;
    const differenceQty = roundQty((countedQty ?? 0) - bookQty);
    return {
        lineId: `${orderId}-${item.stockItemId}`,
        stocktakeOrderId: orderId,
        stockItemId: item.stockItemId,
        itemKind: item.itemKind,
        itemName: item.itemName,
        materialSku: item.materialSku,
        partName: item.partName,
        fabricColor: item.fabricColor,
        sizeCode: item.sizeCode,
        feiTicketNo: item.feiTicketNo,
        transferBagNo: item.transferBagNo,
        fabricRollNo: item.fabricRollNo,
        bookQty,
        countedQty,
        differenceQty,
        unit: item.unit,
        areaName: item.areaName,
        shelfNo: item.shelfNo,
        locationNo: item.locationNo,
        differenceReason: differenceQty !== 0 ? '数量不符' : '',
        photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
        status: differenceQty !== 0 ? '差异' : '已盘',
        reviewStatus: differenceQty !== 0 ? '待审核' : undefined,
    };
}
function buildStocktakeLineFromWaitHandover(orderId, item) {
    const bookQty = roundQty(item.waitHandoverQty || item.completedQty);
    const countedQty = item.status === '异议中' ? roundQty(Math.max(bookQty - 2, 0)) : bookQty;
    const differenceQty = roundQty((countedQty ?? 0) - bookQty);
    return {
        lineId: `${orderId}-${item.stockItemId}`,
        stocktakeOrderId: orderId,
        stockItemId: item.stockItemId,
        itemKind: item.itemKind,
        itemName: item.itemName,
        materialSku: item.materialSku,
        partName: item.partName,
        fabricColor: item.fabricColor,
        sizeCode: item.sizeCode,
        feiTicketNo: item.feiTicketNo,
        transferBagNo: item.transferBagNo,
        fabricRollNo: item.fabricRollNo,
        bookQty,
        countedQty,
        differenceQty,
        unit: item.unit,
        areaName: item.areaName,
        shelfNo: item.shelfNo,
        locationNo: item.locationNo,
        differenceReason: differenceQty !== 0 ? '漏扫' : '',
        photoList: differenceQty !== 0 ? ['/placeholder.svg'] : [],
        status: differenceQty !== 0 ? '差异' : '已盘',
        reviewStatus: differenceQty !== 0 ? '待审核' : undefined,
    };
}
function buildStocktakeDifferenceReview(order, line, createdAt = nowTimestamp()) {
    return {
        reviewId: `STR-${line.lineId.replace(/[^A-Za-z0-9]/g, '').slice(-16)}`,
        stocktakeOrderId: order.stocktakeOrderId,
        stocktakeOrderNo: order.stocktakeOrderNo,
        lineId: line.lineId,
        stockItemId: line.stockItemId,
        warehouseId: order.warehouseId,
        warehouseName: order.warehouseName,
        factoryId: order.factoryId,
        factoryName: order.factoryName,
        warehouseKind: order.warehouseKind,
        itemKind: line.itemKind,
        itemName: line.itemName,
        materialSku: line.materialSku,
        partName: line.partName,
        fabricColor: line.fabricColor,
        sizeCode: line.sizeCode,
        feiTicketNo: line.feiTicketNo,
        transferBagNo: line.transferBagNo,
        fabricRollNo: line.fabricRollNo,
        bookQty: line.bookQty,
        countedQty: roundQty(line.countedQty ?? 0),
        differenceQty: roundQty(line.differenceQty ?? 0),
        unit: line.unit,
        reviewStatus: line.reviewStatus || '待审核',
        reviewRemark: line.differenceReason,
        adjustmentOrderId: line.adjustmentOrderId,
        createdAt,
    };
}
function ensureStocktakeDifferenceReviewForLine(store, order, line) {
    const existed = store.stocktakeDifferenceReviews.find((item) => item.stocktakeOrderId === order.stocktakeOrderId && item.lineId === line.lineId);
    if (existed) {
        existed.bookQty = line.bookQty;
        existed.countedQty = roundQty(line.countedQty ?? 0);
        existed.differenceQty = roundQty(line.differenceQty ?? 0);
        existed.reviewRemark = line.differenceReason || existed.reviewRemark;
        existed.reviewStatus = line.reviewStatus || existed.reviewStatus;
        existed.adjustmentOrderId = line.adjustmentOrderId || existed.adjustmentOrderId;
        line.differenceReviewId = existed.reviewId;
        line.reviewStatus = existed.reviewStatus;
        return existed;
    }
    const review = buildStocktakeDifferenceReview(order, line);
    store.stocktakeDifferenceReviews.unshift(review);
    line.differenceReviewId = review.reviewId;
    line.reviewStatus = review.reviewStatus;
    return review;
}
function refreshStocktakeOrderStatusAfterAdjustment(order) {
    const differenceLines = order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0);
    if (differenceLines.length === 0) {
        order.status = '已完成';
        return;
    }
    order.status = differenceLines.every((line) => line.reviewStatus === '已调整') ? '已完成' : '待确认';
}
function seedFactoryWarehouseStore() {
    const warehouses = buildDefaultFactoryInternalWarehouses(mockFactories);
    const warehouseMap = new Map();
    const waitProcessWarehouseMap = new Map();
    const waitHandoverWarehouseMap = new Map();
    const factoryMap = new Map(mockFactories.map((factory) => [factory.id, factory]));
    warehouses.forEach((warehouse) => {
        warehouseMap.set(warehouse.warehouseId, warehouse);
        if (warehouse.warehouseKind === 'WAIT_PROCESS') {
            waitProcessWarehouseMap.set(warehouse.factoryId, warehouse);
        }
        else {
            waitHandoverWarehouseMap.set(warehouse.factoryId, warehouse);
        }
    });
    const inboundRecords = [];
    const pickupFallbackFactories = mockFactories.filter((factory) => isNonSewingFactory(factory));
    listWarehouseIssueOrders().forEach((doc, docIndex) => {
        const targetFactory = (doc.targetFactoryId ? factoryMap.get(doc.targetFactoryId) : undefined)
            || pickupFallbackFactories[docIndex % pickupFallbackFactories.length];
        if (!targetFactory || !isNonSewingFactory(targetFactory))
            return;
        const warehouse = waitProcessWarehouseMap.get(targetFactory.id);
        if (!warehouse)
            return;
        doc.lines.forEach((line, index) => {
            inboundRecords.push(buildInboundRecordFromPickup(doc, line, targetFactory, warehouse, index));
        });
    });
    listPdaHandoverHeads()
        .filter((head) => head.headType === 'PICKUP' && !!head.factoryId)
        .forEach((head) => {
        const targetFactory = factoryMap.get(head.factoryId);
        if (!targetFactory || !isNonSewingFactory(targetFactory))
            return;
        const warehouse = waitProcessWarehouseMap.get(targetFactory.id);
        if (!warehouse)
            return;
        getPdaPickupRecordsByHead(head.handoverId)
            .filter((record) => shouldSeedInboundFromPickupRecord(record))
            .forEach((record, index) => {
            inboundRecords.push(buildInboundRecordFromPickupRecordInput({ head, record, warehouse, factory: targetFactory, recordIndex: index }));
        });
    });
    listPdaHandoverHeads()
        .filter((head) => head.headType === 'HANDOUT')
        .forEach((head) => {
        const receivingFactory = resolveFactoryByName(head.receiverName || head.targetName, head.targetName.includes('后道') ? 'SATELLITE_FINISHING' : undefined);
        if (!receivingFactory || !isNonSewingFactory(receivingFactory))
            return;
        const warehouse = waitProcessWarehouseMap.get(receivingFactory.id);
        if (!warehouse)
            return;
        getPdaHandoverRecordsByHead(head.handoverId).forEach((record, index) => {
            inboundRecords.push(buildInboundRecordFromHandoverReceive(head, record, receivingFactory, warehouse, index));
        });
    });
    const firstWarehouseFactory = factoryMap.get('ID-F002');
    const firstWaitProcessWarehouse = firstWarehouseFactory ? waitProcessWarehouseMap.get(firstWarehouseFactory.id) : undefined;
    if (firstWarehouseFactory && firstWaitProcessWarehouse && !inboundRecords.some((record) => record.factoryId === firstWarehouseFactory.id)) {
        const location = pickWarehouseLocation(firstWaitProcessWarehouse, 'TASK-PRINT-COMPLETE-SEED-001', '已入库');
        const factoryProcess = resolvePrimaryFactoryProcess(firstWarehouseFactory);
        inboundRecords.push({
            inboundRecordId: 'INB-TASK-PRINT-COMPLETE-SEED-001',
            inboundRecordNo: 'RK-WL-PRINT-SEED-001',
            warehouseId: firstWaitProcessWarehouse.warehouseId,
            warehouseName: firstWaitProcessWarehouse.warehouseName,
            factoryId: firstWarehouseFactory.id,
            factoryName: firstWarehouseFactory.name,
            factoryKind: firstWarehouseFactory.factoryType,
            processCode: factoryProcess.processCode,
            processName: factoryProcess.processName,
            sourceRecordId: 'ISSUE-PRINT-SEED-001',
            sourceRecordNo: 'WL-PRINT-SEED-001',
            sourceRecordType: 'MATERIAL_PICKUP',
            sourceObjectName: '面辅料仓',
            taskId: 'TASK-PRINT-COMPLETE-SEED-001',
            taskNo: 'TASK-PRINT-COMPLETE-SEED-001',
            itemKind: '面料',
            itemName: '印花底布',
            materialSku: 'FAB-PRINT-COMPLETE-001',
            fabricColor: '青石灰',
            sizeCode: '整匹',
            expectedQty: 180,
            receivedQty: 180,
            differenceQty: 0,
            unit: '匹',
            receiverName: firstWarehouseFactory.name,
            receivedAt: '2026-04-15 09:00:00',
            areaName: location.areaName,
            shelfNo: location.shelfNo,
            locationNo: location.locationNo,
            status: '已入库',
            photoList: [],
            remark: '由领料记录生成',
        });
    }
    const waitProcessStockItems = inboundRecords.map((record) => buildWaitProcessStockItemFromInbound(record));
    inboundRecords.forEach((record, index) => {
        record.generatedStockItemId = waitProcessStockItems[index]?.stockItemId;
    });
    const outboundRecords = [];
    const waitHandoverStockItems = [];
    listPdaHandoverHeads()
        .filter((head) => head.headType === 'HANDOUT')
        .forEach((head) => {
        const sourceFactory = resolveFactoryByName(head.sourceFactoryName, head.processBusinessCode === 'POST_FINISHING' ? 'SATELLITE_FINISHING' : undefined);
        if (!sourceFactory || !isNonSewingFactory(sourceFactory))
            return;
        const warehouse = waitHandoverWarehouseMap.get(sourceFactory.id);
        if (!warehouse)
            return;
        const pendingItem = buildPendingWaitHandoverStockItem({ factory: sourceFactory, warehouse, head });
        if (pendingItem) {
            waitHandoverStockItems.push(pendingItem);
        }
        getPdaHandoverRecordsByHead(head.handoverId).forEach((record, index) => {
            const outbound = buildOutboundRecordFromHandoverRecord(head, record, sourceFactory, warehouse, index);
            outboundRecords.push(outbound);
            const stockItem = buildWaitHandoverStockItemFromOutbound(outbound);
            waitHandoverStockItems.push(stockItem);
            outbound.relatedWaitHandoverStockItemId = stockItem.stockItemId;
        });
    });
    if (!outboundRecords.some((record) => record.status === '差异')) {
        const baseOutbound = outboundRecords.find((record) => record.status === '已回写') || outboundRecords[0];
        if (baseOutbound) {
            const diffOutbound = {
                ...baseOutbound,
                outboundRecordId: 'OUT-FIW-DIFF-SEED-001',
                outboundRecordNo: 'CK-FIW-DIFF-SEED-001',
                handoverOrderId: 'HOH-FIW-DIFF-SEED',
                handoverOrderNo: 'HDO-FIW-DIFF-SEED',
                handoverRecordId: 'HOR-FIW-DIFF-SEED-001',
                handoverRecordNo: 'HDR-FIW-DIFF-SEED-001',
                receiverWrittenQty: Math.max(baseOutbound.outboundQty - 1, 0),
                differenceQty: -1,
                status: '差异',
                abnormalReason: '数量不符',
            };
            const diffWaitHandoverStockItem = {
                ...buildFactoryWaitHandoverStockItemFromOutboundRecord(diffOutbound),
                stockItemId: 'WHS-FIW-DIFF-SEED-001',
                handoverOrderId: diffOutbound.handoverOrderId,
                handoverOrderNo: diffOutbound.handoverOrderNo,
                handoverRecordId: diffOutbound.handoverRecordId,
                handoverRecordNo: diffOutbound.handoverRecordNo,
                receiverWrittenQty: diffOutbound.receiverWrittenQty,
                differenceQty: diffOutbound.differenceQty,
                status: '差异',
                abnormalReason: '数量不符',
            };
            diffOutbound.relatedWaitHandoverStockItemId = diffWaitHandoverStockItem.stockItemId;
            outboundRecords.push(diffOutbound);
            waitHandoverStockItems.push(diffWaitHandoverStockItem);
        }
    }
    const completionSeedFactory = factoryMap.get('ID-F002');
    const completionSeedWarehouse = completionSeedFactory ? waitHandoverWarehouseMap.get(completionSeedFactory.id) : undefined;
    if (completionSeedFactory && completionSeedWarehouse) {
        waitHandoverStockItems.push(buildMockCompletedWaitHandoverStockItem({
            warehouse: completionSeedWarehouse,
            factory: completionSeedFactory,
            taskId: 'TASK-PRINT-COMPLETE-SEED-001',
            taskNo: 'TASK-PRINT-COMPLETE-SEED-001',
            productionOrderNo: 'PO-20260330-PRINT-001',
            itemKind: '面料',
            itemName: '印花面料待交出',
            materialSku: 'FAB-PRINT-COMPLETE-001',
            fabricColor: '青石灰',
            sizeCode: '整匹',
            completedQty: 180,
            lossQty: 6,
            waitHandoverQty: 174,
            unit: '匹',
            receiverKind: '中转仓',
            receiverName: '中转仓',
            remark: '任务完工后待交出',
        }));
        if (!outboundRecords.some((record) => record.factoryId === completionSeedFactory.id)) {
            const factoryProcess = resolvePrimaryFactoryProcess(completionSeedFactory);
            const outbound = {
                outboundRecordId: 'OUT-TASK-PRINT-COMPLETE-SEED-001',
                outboundRecordNo: 'CK-PRINT-SEED-001',
                warehouseId: completionSeedWarehouse.warehouseId,
                warehouseName: completionSeedWarehouse.warehouseName,
                factoryId: completionSeedFactory.id,
                factoryName: completionSeedFactory.name,
                factoryKind: completionSeedFactory.factoryType,
                processCode: factoryProcess.processCode,
                processName: factoryProcess.processName,
                sourceTaskId: 'TASK-PRINT-COMPLETE-SEED-001',
                sourceTaskNo: 'TASK-PRINT-COMPLETE-SEED-001',
                handoverOrderId: 'HOH-PRINT-SEED-001',
                handoverOrderNo: 'HDO-PRINT-SEED-001',
                handoverRecordId: 'HOR-PRINT-SEED-001',
                handoverRecordNo: 'HDR-PRINT-SEED-001',
                handoverRecordQrValue: 'QR:HDR-PRINT-SEED-001',
                receiverKind: '中转仓',
                receiverName: '中转仓',
                itemKind: '面料',
                itemName: '印花面料待交出',
                materialSku: 'FAB-PRINT-COMPLETE-001',
                fabricColor: '青石灰',
                sizeCode: '整匹',
                outboundQty: 120,
                receiverWrittenQty: 120,
                differenceQty: 0,
                unit: '匹',
                operatorName: '印花工厂仓管',
                outboundAt: '2026-04-16 16:30:00',
                status: '已回写',
                photoList: [],
                remark: '由交出记录生成',
            };
            outboundRecords.push(outbound);
            const stockItem = buildWaitHandoverStockItemFromOutbound(outbound);
            outbound.relatedWaitHandoverStockItemId = stockItem.stockItemId;
            waitHandoverStockItems.push(stockItem);
        }
    }
    const completedStocktakeOrderId = 'STO-FIW-001';
    const pendingStocktakeOrderId = 'STO-FIW-002';
    const completedWarehouse = warehouses.find((warehouse) => warehouse.factoryId === 'ID-F002' && warehouse.warehouseKind === 'WAIT_PROCESS') || warehouses[0];
    const pendingWarehouse = warehouses.find((warehouse) => warehouse.factoryId === 'ID-F004' && warehouse.warehouseKind === 'WAIT_HANDOVER') || warehouses[1];
    const completedLines = waitProcessStockItems
        .filter((item) => item.warehouseId === completedWarehouse.warehouseId)
        .slice(0, 3)
        .map((item) => buildStocktakeLineFromWaitProcess(completedStocktakeOrderId, item));
    const pendingLines = waitHandoverStockItems
        .filter((item) => item.warehouseId === pendingWarehouse.warehouseId)
        .slice(0, 3)
        .map((item) => buildStocktakeLineFromWaitHandover(pendingStocktakeOrderId, item));
    const stocktakeOrders = [
        {
            stocktakeOrderId: completedStocktakeOrderId,
            stocktakeOrderNo: 'PD-202604-001',
            factoryId: completedWarehouse.factoryId,
            factoryName: completedWarehouse.factoryName,
            warehouseId: completedWarehouse.warehouseId,
            warehouseName: completedWarehouse.warehouseName,
            warehouseKind: completedWarehouse.warehouseKind,
            stocktakeScope: '全盘',
            status: '已完成',
            createdBy: '仓库专员',
            createdAt: '2026-04-18 09:10:00',
            startedAt: '2026-04-18 09:20:00',
            completedAt: '2026-04-18 10:05:00',
            lineList: completedLines,
            remark: '默认全盘',
        },
        {
            stocktakeOrderId: pendingStocktakeOrderId,
            stocktakeOrderNo: 'PD-202604-002',
            factoryId: pendingWarehouse.factoryId,
            factoryName: pendingWarehouse.factoryName,
            warehouseId: pendingWarehouse.warehouseId,
            warehouseName: pendingWarehouse.warehouseName,
            warehouseKind: pendingWarehouse.warehouseKind,
            stocktakeScope: '全盘',
            status: '待确认',
            createdBy: '仓库专员',
            createdAt: '2026-04-20 14:10:00',
            startedAt: '2026-04-20 14:20:00',
            completedAt: '2026-04-20 16:05:00',
            lineList: pendingLines,
            remark: '存在差异待确认',
        },
    ];
    const stocktakeDifferenceReviews = [];
    const adjustmentOrders = [];
    stocktakeOrders
        .filter((order) => order.status === '待确认')
        .forEach((order) => {
        order.lineList
            .filter((line) => (line.differenceQty ?? 0) !== 0)
            .forEach((line) => {
            const review = buildStocktakeDifferenceReview(order, line, order.completedAt || nowTimestamp());
            line.differenceReviewId = review.reviewId;
            line.reviewStatus = review.reviewStatus;
            stocktakeDifferenceReviews.push(review);
        });
    });
    return {
        warehouses,
        waitProcessStockItems,
        waitHandoverStockItems,
        inboundRecords,
        outboundRecords,
        stocktakeOrders,
        stocktakeDifferenceReviews,
        adjustmentOrders,
    };
}
function ensureFactoryInternalWarehouseStore() {
    if (!internalWarehouseStore) {
        internalWarehouseStore = seedFactoryWarehouseStore();
    }
    return internalWarehouseStore;
}
function findWarehouseByFactoryAndKindInternal(factoryId, warehouseKind) {
    return ensureFactoryInternalWarehouseStore().warehouses.find((warehouse) => warehouse.factoryId === factoryId && warehouse.warehouseKind === warehouseKind);
}
function findWaitProcessStockIndexBySourceRecordId(sourceRecordId) {
    return ensureFactoryInternalWarehouseStore().waitProcessStockItems.findIndex((item) => item.sourceRecordId === sourceRecordId);
}
function findWaitHandoverStockIndexByHandoverRecordId(handoverRecordId) {
    return ensureFactoryInternalWarehouseStore().waitHandoverStockItems.findIndex((item) => item.handoverRecordId === handoverRecordId);
}
function findPendingWaitHandoverStockIndexByOrderId(handoverOrderId) {
    return ensureFactoryInternalWarehouseStore().waitHandoverStockItems.findIndex((item) => item.handoverOrderId === handoverOrderId
        && !item.handoverRecordId
        && item.status === '待交出');
}
export function listFactoryInternalWarehouses() {
    return cloneValue(ensureFactoryInternalWarehouseStore().warehouses);
}
export function listFactoryInternalWarehouseFactoryOptions() {
    return cloneValue(mockFactories.filter((factory) => isNonSewingFactory(factory)));
}
export function listFactoryWaitProcessStockItems() {
    return cloneValue(ensureFactoryInternalWarehouseStore().waitProcessStockItems);
}
export function listFactoryWaitHandoverStockItems() {
    return cloneValue(ensureFactoryInternalWarehouseStore().waitHandoverStockItems);
}
export function listFactoryWarehouseInboundRecords() {
    return cloneValue(ensureFactoryInternalWarehouseStore().inboundRecords);
}
export function listFactoryWarehouseOutboundRecords() {
    return cloneValue(ensureFactoryInternalWarehouseStore().outboundRecords);
}
export function listFactoryWarehouseStocktakeOrders() {
    return cloneValue(ensureFactoryInternalWarehouseStore().stocktakeOrders);
}
export function listFactoryWarehouseStocktakeDifferenceReviews() {
    return cloneValue(ensureFactoryInternalWarehouseStore().stocktakeDifferenceReviews);
}
export function listFactoryWarehouseStocktakeDifferenceReviewsByOrder(stocktakeOrderId) {
    return cloneValue(ensureFactoryInternalWarehouseStore().stocktakeDifferenceReviews.filter((item) => item.stocktakeOrderId === stocktakeOrderId));
}
export function getFactoryWarehouseStocktakeDifferenceReview(reviewId) {
    const review = ensureFactoryInternalWarehouseStore().stocktakeDifferenceReviews.find((item) => item.reviewId === reviewId);
    return review ? cloneValue(review) : undefined;
}
export function listFactoryWarehouseAdjustmentOrders() {
    return cloneValue(ensureFactoryInternalWarehouseStore().adjustmentOrders);
}
export function listFactoryWarehouseAdjustmentOrdersByStocktake(stocktakeOrderId) {
    return cloneValue(ensureFactoryInternalWarehouseStore().adjustmentOrders.filter((item) => item.sourceStocktakeOrderId === stocktakeOrderId));
}
export function getFactoryWarehouseAdjustmentOrder(adjustmentOrderId) {
    const order = ensureFactoryInternalWarehouseStore().adjustmentOrders.find((item) => item.adjustmentOrderId === adjustmentOrderId);
    return order ? cloneValue(order) : undefined;
}
export function getFactoryWarehouseSourceRecordTypeLabel(sourceRecordType) {
    if (sourceRecordType === 'MATERIAL_PICKUP')
        return '领料记录';
    if (sourceRecordType === 'HANDOVER_RECEIVE')
        return '交出接收';
    return '转入接收';
}
export function getFactoryWarehouseInboundSourceLabel(sourceRecordType) {
    if (sourceRecordType === 'MATERIAL_PICKUP')
        return '由领料记录生成';
    if (sourceRecordType === 'HANDOVER_RECEIVE')
        return '由交出接收生成';
    return '由转入接收生成';
}
export function getFactoryWarehouseOutboundSourceLabel() {
    return '由交出记录生成';
}
export function findFactoryInternalWarehouseByFactoryAndKind(factoryId, warehouseKind) {
    const warehouse = findWarehouseByFactoryAndKindInternal(factoryId, warehouseKind);
    return warehouse ? cloneValue(warehouse) : undefined;
}
export function findFactoryWarehouseInboundRecordBySourceRecordId(sourceRecordId) {
    const record = ensureFactoryInternalWarehouseStore().inboundRecords.find((item) => item.sourceRecordId === sourceRecordId);
    return record ? cloneValue(record) : undefined;
}
export function findFactoryWarehouseOutboundRecordByHandoverRecordId(handoverRecordId) {
    const record = ensureFactoryInternalWarehouseStore().outboundRecords.find((item) => item.handoverRecordId === handoverRecordId);
    return record ? cloneValue(record) : undefined;
}
export function findFactoryWaitProcessStockItemBySourceRecordId(sourceRecordId) {
    const record = ensureFactoryInternalWarehouseStore().waitProcessStockItems.find((item) => item.sourceRecordId === sourceRecordId);
    return record ? cloneValue(record) : undefined;
}
export function findFactoryWaitHandoverStockItemByHandoverRecordId(handoverRecordId) {
    const record = ensureFactoryInternalWarehouseStore().waitHandoverStockItems.find((item) => item.handoverRecordId === handoverRecordId);
    return record ? cloneValue(record) : undefined;
}
export function findPendingFactoryWaitHandoverStockItemByOrderId(handoverOrderId) {
    const record = ensureFactoryInternalWarehouseStore().waitHandoverStockItems.find((item) => item.handoverOrderId === handoverOrderId && !item.handoverRecordId);
    return record ? cloneValue(record) : undefined;
}
export function buildFactoryWaitProcessStockItemFromInboundRecord(record) {
    return cloneValue(buildWaitProcessStockItemFromInbound(record));
}
export function buildFactoryWaitHandoverStockItemFromOutboundRecord(record) {
    return cloneValue(buildWaitHandoverStockItemFromOutbound(record));
}
export function upsertFactoryWarehouseInboundRecord(record) {
    const store = ensureFactoryInternalWarehouseStore();
    const index = store.inboundRecords.findIndex((item) => item.inboundRecordId === record.inboundRecordId || item.sourceRecordId === record.sourceRecordId);
    const nextRecord = cloneValue(record);
    if (index >= 0) {
        store.inboundRecords[index] = nextRecord;
    }
    else {
        store.inboundRecords.unshift(nextRecord);
    }
    return cloneValue(nextRecord);
}
export function upsertFactoryWaitProcessStockItem(item) {
    const store = ensureFactoryInternalWarehouseStore();
    const index = store.waitProcessStockItems.findIndex((stockItem) => stockItem.stockItemId === item.stockItemId || stockItem.sourceRecordId === item.sourceRecordId);
    const nextItem = cloneValue(item);
    if (index >= 0) {
        store.waitProcessStockItems[index] = nextItem;
    }
    else {
        store.waitProcessStockItems.unshift(nextItem);
    }
    return cloneValue(nextItem);
}
export function upsertFactoryWarehouseOutboundRecord(record) {
    const store = ensureFactoryInternalWarehouseStore();
    const index = store.outboundRecords.findIndex((item) => item.outboundRecordId === record.outboundRecordId
        || (item.handoverRecordId && item.handoverRecordId === record.handoverRecordId));
    const nextRecord = cloneValue(record);
    if (index >= 0) {
        store.outboundRecords[index] = nextRecord;
    }
    else {
        store.outboundRecords.unshift(nextRecord);
    }
    return cloneValue(nextRecord);
}
export function upsertFactoryWaitHandoverStockItem(item) {
    const store = ensureFactoryInternalWarehouseStore();
    const index = store.waitHandoverStockItems.findIndex((stockItem) => stockItem.stockItemId === item.stockItemId
        || (!!item.handoverRecordId && stockItem.handoverRecordId === item.handoverRecordId));
    const nextItem = cloneValue(item);
    if (index >= 0) {
        store.waitHandoverStockItems[index] = nextItem;
    }
    else {
        store.waitHandoverStockItems.unshift(nextItem);
    }
    return cloneValue(nextItem);
}
export function decreasePendingFactoryWaitHandoverQty(handoverOrderId, handoverQty) {
    const store = ensureFactoryInternalWarehouseStore();
    const index = findPendingWaitHandoverStockIndexByOrderId(handoverOrderId);
    if (index < 0)
        return null;
    const item = store.waitHandoverStockItems[index];
    item.waitHandoverQty = roundQty(Math.max(item.waitHandoverQty - handoverQty, 0));
    if (item.waitHandoverQty === 0) {
        item.status = '已交出';
    }
    return cloneValue(item);
}
export function findFactoryInternalWarehouseById(warehouseId) {
    return cloneValue(ensureFactoryInternalWarehouseStore().warehouses.find((warehouse) => warehouse.warehouseId === warehouseId));
}
export function listFactoryWarehouseNodeRows(factoryId) {
    return listFactoryInternalWarehouses()
        .filter((warehouse) => (factoryId ? warehouse.factoryId === factoryId : true))
        .flatMap((warehouse) => warehouse.areaList.flatMap((area) => {
        const areaRow = {
            rowType: 'AREA',
            warehouseId: warehouse.warehouseId,
            warehouseName: warehouse.warehouseName,
            factoryId: warehouse.factoryId,
            factoryName: warehouse.factoryName,
            areaId: area.areaId,
            areaName: area.areaName,
            status: area.status,
            remark: area.remark,
        };
        const shelfRows = area.shelfList.flatMap((shelf) => {
            const shelfRow = {
                rowType: 'SHELF',
                warehouseId: warehouse.warehouseId,
                warehouseName: warehouse.warehouseName,
                factoryId: warehouse.factoryId,
                factoryName: warehouse.factoryName,
                areaId: area.areaId,
                areaName: area.areaName,
                shelfId: shelf.shelfId,
                shelfNo: shelf.shelfNo,
                shelfName: shelf.shelfName,
                status: shelf.status,
                remark: shelf.remark,
            };
            const locationRows = shelf.locationList.map((location) => ({
                rowType: 'LOCATION',
                warehouseId: warehouse.warehouseId,
                warehouseName: warehouse.warehouseName,
                factoryId: warehouse.factoryId,
                factoryName: warehouse.factoryName,
                areaId: area.areaId,
                areaName: area.areaName,
                shelfId: shelf.shelfId,
                shelfNo: shelf.shelfNo,
                shelfName: shelf.shelfName,
                locationId: location.locationId,
                locationNo: location.locationNo,
                locationName: location.locationName,
                status: location.status,
                remark: location.remark,
            }));
            return [shelfRow, ...locationRows];
        });
        return [areaRow, ...shelfRows];
    }));
}
function mutateWarehouseNode(rowType, ids, updater) {
    const store = ensureFactoryInternalWarehouseStore();
    const warehouse = store.warehouses.find((item) => item.warehouseId === ids.warehouseId);
    if (!warehouse)
        return false;
    const area = warehouse.areaList.find((item) => item.areaId === ids.areaId);
    if (!area)
        return false;
    if (rowType === 'AREA') {
        updater(area);
        warehouse.updatedAt = nowTimestamp();
        return true;
    }
    const shelf = area.shelfList.find((item) => item.shelfId === ids.shelfId);
    if (!shelf)
        return false;
    if (rowType === 'SHELF') {
        updater(shelf);
        warehouse.updatedAt = nowTimestamp();
        return true;
    }
    const location = shelf.locationList.find((item) => item.locationId === ids.locationId);
    if (!location)
        return false;
    updater(location);
    warehouse.updatedAt = nowTimestamp();
    return true;
}
export function createFactoryWarehouseArea(warehouseId) {
    const store = ensureFactoryInternalWarehouseStore();
    const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId);
    if (!warehouse)
        return null;
    const nextIndex = warehouse.areaList.length + 1;
    const areaName = `扩展区${nextIndex}`;
    const area = {
        areaId: `AREA-${warehouseId}-${nextIndex}`,
        areaName,
        shelfList: [
            {
                shelfId: `SHELF-${warehouseId}-${nextIndex}-01`,
                shelfNo: `扩展-${nextIndex}-01`,
                shelfName: `扩展-${nextIndex}-01`,
                locationList: [
                    {
                        locationId: `LOC-${warehouseId}-${nextIndex}-01-01`,
                        locationNo: `扩展-${nextIndex}-01-01`,
                        locationName: `扩展-${nextIndex}-01-01`,
                        status: 'AVAILABLE',
                        remark: '',
                    },
                ],
                status: 'AVAILABLE',
                remark: '',
            },
        ],
        status: 'AVAILABLE',
        remark: '',
    };
    warehouse.areaList.push(area);
    warehouse.updatedAt = nowTimestamp();
    return cloneValue(area);
}
export function createFactoryWarehouseShelf(warehouseId, areaId) {
    const store = ensureFactoryInternalWarehouseStore();
    const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId);
    if (!warehouse)
        return null;
    const area = warehouse.areaList.find((item) => item.areaId === areaId) || warehouse.areaList[0];
    if (!area)
        return null;
    const nextIndex = area.shelfList.length + 1;
    const prefix = area.areaName.replace('区', '');
    const shelf = {
        shelfId: `SHELF-${area.areaId}-${nextIndex}`,
        shelfNo: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
        shelfName: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
        locationList: [
            {
                locationId: `LOC-${area.areaId}-${nextIndex}-01`,
                locationNo: `${prefix}-${String(nextIndex).padStart(2, '0')}-01`,
                locationName: `${prefix}-${String(nextIndex).padStart(2, '0')}-01`,
                status: 'AVAILABLE',
                remark: '',
            },
        ],
        status: 'AVAILABLE',
        remark: '',
    };
    area.shelfList.push(shelf);
    warehouse.updatedAt = nowTimestamp();
    return cloneValue(shelf);
}
export function createFactoryWarehouseLocation(warehouseId, areaId, shelfId) {
    const store = ensureFactoryInternalWarehouseStore();
    const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId);
    if (!warehouse)
        return null;
    const area = warehouse.areaList.find((item) => item.areaId === areaId) || warehouse.areaList[0];
    if (!area)
        return null;
    const shelf = area.shelfList.find((item) => item.shelfId === shelfId) || area.shelfList[0];
    if (!shelf)
        return null;
    const nextIndex = shelf.locationList.length + 1;
    const location = {
        locationId: `LOC-${shelf.shelfId}-${nextIndex}`,
        locationNo: `${shelf.shelfNo}-${String(nextIndex).padStart(2, '0')}`,
        locationName: `${shelf.shelfNo}-${String(nextIndex).padStart(2, '0')}`,
        status: 'AVAILABLE',
        remark: '',
    };
    shelf.locationList.push(location);
    warehouse.updatedAt = nowTimestamp();
    return cloneValue(location);
}
export function updateFactoryWarehouseNodeRemark(rowType, ids, remark) {
    return mutateWarehouseNode(rowType, ids, (target) => {
        target.remark = remark.trim();
    });
}
export function toggleFactoryWarehouseNodeStatus(rowType, ids) {
    return mutateWarehouseNode(rowType, ids, (target) => {
        target.status = target.status === 'AVAILABLE' ? 'STOPPED' : 'AVAILABLE';
    });
}
export function updateWaitProcessStockLocation(stockItemId, input) {
    const store = ensureFactoryInternalWarehouseStore();
    const item = store.waitProcessStockItems.find((stockItem) => stockItem.stockItemId === stockItemId);
    if (!item)
        return false;
    item.areaName = input.areaName;
    item.shelfNo = input.shelfNo;
    item.locationNo = input.locationNo;
    item.locationText = `${input.areaName} / ${input.shelfNo} / ${input.locationNo}`;
    if (typeof input.remark === 'string') {
        item.remark = input.remark.trim();
    }
    store.inboundRecords
        .filter((record) => record.generatedStockItemId === stockItemId)
        .forEach((record) => {
        record.areaName = input.areaName;
        record.shelfNo = input.shelfNo;
        record.locationNo = input.locationNo;
        if (typeof input.remark === 'string') {
            record.remark = input.remark.trim() || record.remark;
        }
    });
    return true;
}
export function updateWaitHandoverStockLocation(stockItemId, input) {
    const store = ensureFactoryInternalWarehouseStore();
    const item = store.waitHandoverStockItems.find((stockItem) => stockItem.stockItemId === stockItemId);
    if (!item)
        return false;
    item.areaName = input.areaName;
    item.shelfNo = input.shelfNo;
    item.locationNo = input.locationNo;
    if (typeof input.remark === 'string') {
        item.remark = input.remark.trim();
    }
    store.outboundRecords
        .filter((record) => record.relatedWaitHandoverStockItemId === stockItemId)
        .forEach((record) => {
        record.remark = input.remark?.trim() || `${record.remark || ''}`.trim() || '由交出记录生成';
    });
    return true;
}
export function createFactoryWarehouseStocktakeOrder(factoryId, warehouseId, createdBy = '仓库专员') {
    const store = ensureFactoryInternalWarehouseStore();
    const warehouse = store.warehouses.find((item) => item.warehouseId === warehouseId && item.factoryId === factoryId);
    if (!warehouse)
        return null;
    const orderId = `STO-${factoryId}-${String(store.stocktakeOrders.length + 1).padStart(3, '0')}`;
    const sourceItems = warehouse.warehouseKind === 'WAIT_PROCESS'
        ? store.waitProcessStockItems.filter((item) => item.warehouseId === warehouseId)
        : store.waitHandoverStockItems.filter((item) => item.warehouseId === warehouseId);
    const lineList = sourceItems.map((item) => 'expectedQty' in item
        ? buildStocktakeLineFromWaitProcess(orderId, item)
        : buildStocktakeLineFromWaitHandover(orderId, item));
    const now = nowTimestamp();
    const order = {
        stocktakeOrderId: orderId,
        stocktakeOrderNo: `PD-${factoryId.slice(-3)}-${String(store.stocktakeOrders.length + 1).padStart(3, '0')}`,
        factoryId,
        factoryName: warehouse.factoryName,
        warehouseId,
        warehouseName: warehouse.warehouseName,
        warehouseKind: warehouse.warehouseKind,
        stocktakeScope: '全盘',
        status: '盘点中',
        createdBy,
        createdAt: now,
        startedAt: now,
        lineList: lineList.map((line) => ({
            ...line,
            countedQty: undefined,
            differenceQty: undefined,
            differenceReason: '',
            photoList: [],
            status: '未盘',
            reviewStatus: undefined,
            differenceReviewId: undefined,
            adjustmentOrderId: undefined,
            adjustedAt: undefined,
        })),
        remark: '全盘',
    };
    store.stocktakeOrders.unshift(order);
    return cloneValue(order);
}
export function updateFactoryWarehouseStocktakeLine(stocktakeOrderId, lineId, input) {
    const store = ensureFactoryInternalWarehouseStore();
    const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === stocktakeOrderId);
    if (!order)
        return false;
    const line = order.lineList.find((item) => item.lineId === lineId);
    if (!line)
        return false;
    if (typeof input.countedQty === 'number') {
        line.countedQty = roundQty(input.countedQty);
    }
    if (typeof input.differenceReason === 'string') {
        line.differenceReason = input.differenceReason.trim();
    }
    const countedQty = roundQty(line.countedQty ?? 0);
    line.differenceQty = line.countedQty === undefined ? undefined : roundQty(countedQty - line.bookQty);
    if (line.countedQty === undefined) {
        line.status = '未盘';
        line.reviewStatus = undefined;
        line.differenceReviewId = undefined;
        line.adjustmentOrderId = undefined;
        line.adjustedAt = undefined;
    }
    else if (line.differenceQty !== 0) {
        line.status = '差异';
        line.reviewStatus = '待审核';
        line.adjustedAt = undefined;
    }
    else {
        line.status = '已盘';
        line.reviewStatus = undefined;
        line.differenceReviewId = undefined;
        line.adjustmentOrderId = undefined;
        line.adjustedAt = undefined;
    }
    return true;
}
export function completeFactoryWarehouseStocktakeOrder(stocktakeOrderId) {
    const store = ensureFactoryInternalWarehouseStore();
    const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === stocktakeOrderId);
    if (!order)
        return false;
    const differenceLines = order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0);
    if (differenceLines.length > 0) {
        differenceLines.forEach((line) => {
            line.reviewStatus = line.reviewStatus || '待审核';
            ensureStocktakeDifferenceReviewForLine(store, order, line);
        });
        order.status = '待确认';
    }
    else {
        order.status = '已完成';
    }
    order.completedAt = nowTimestamp();
    return true;
}
export function getFactoryWarehouseCurrentQtyByStockItemId(stockItemId) {
    const store = ensureFactoryInternalWarehouseStore();
    const waitProcessItem = store.waitProcessStockItems.find((item) => item.stockItemId === stockItemId);
    if (waitProcessItem)
        return waitProcessItem.receivedQty;
    const waitHandoverItem = store.waitHandoverStockItems.find((item) => item.stockItemId === stockItemId);
    if (waitHandoverItem)
        return waitHandoverItem.waitHandoverQty;
    return 0;
}
export function approveFactoryWarehouseStocktakeDifferenceReview(input) {
    const store = ensureFactoryInternalWarehouseStore();
    const review = store.stocktakeDifferenceReviews.find((item) => item.reviewId === input.reviewId);
    if (!review)
        return null;
    const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === review.stocktakeOrderId);
    const line = order?.lineList.find((item) => item.lineId === review.lineId);
    if (!order || !line)
        return null;
    const now = input.reviewedAt || nowTimestamp();
    review.reviewStatus = '审核通过';
    review.reviewedBy = input.reviewedBy;
    review.reviewedAt = now;
    review.reviewRemark = input.reviewRemark?.trim() || review.reviewRemark || '盘点差异审核通过';
    line.reviewStatus = '审核通过';
    line.differenceReviewId = review.reviewId;
    const adjustmentOrderId = `ADJ-${review.reviewId.replace(/[^A-Za-z0-9]/g, '').slice(-12)}`;
    let adjustment = store.adjustmentOrders.find((item) => item.adjustmentOrderId === adjustmentOrderId);
    if (!adjustment) {
        adjustment = {
            adjustmentOrderId,
            adjustmentOrderNo: `TZ-${review.stocktakeOrderNo.replace(/[^A-Za-z0-9]/g, '').slice(-8)}-${String(store.adjustmentOrders.length + 1).padStart(3, '0')}`,
            sourceStocktakeOrderId: review.stocktakeOrderId,
            sourceStocktakeOrderNo: review.stocktakeOrderNo,
            sourceLineId: review.lineId,
            reviewId: review.reviewId,
            warehouseId: review.warehouseId,
            warehouseName: review.warehouseName,
            factoryId: review.factoryId,
            factoryName: review.factoryName,
            warehouseKind: review.warehouseKind,
            stockItemId: review.stockItemId,
            itemKind: review.itemKind,
            itemName: review.itemName,
            materialSku: review.materialSku,
            partName: review.partName,
            fabricColor: review.fabricColor,
            sizeCode: review.sizeCode,
            feiTicketNo: review.feiTicketNo,
            transferBagNo: review.transferBagNo,
            fabricRollNo: review.fabricRollNo,
            bookQty: review.bookQty,
            countedQty: review.countedQty,
            adjustmentQty: roundQty(review.countedQty - review.bookQty),
            unit: review.unit,
            status: '待执行',
            createdAt: now,
            createdBy: input.reviewedBy,
            remark: review.reviewRemark,
        };
        store.adjustmentOrders.unshift(adjustment);
    }
    review.adjustmentOrderId = adjustment.adjustmentOrderId;
    line.adjustmentOrderId = adjustment.adjustmentOrderId;
    return cloneValue(adjustment);
}
export function rejectFactoryWarehouseStocktakeDifferenceReview(input) {
    const store = ensureFactoryInternalWarehouseStore();
    const review = store.stocktakeDifferenceReviews.find((item) => item.reviewId === input.reviewId);
    if (!review)
        return null;
    const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === review.stocktakeOrderId);
    const line = order?.lineList.find((item) => item.lineId === review.lineId);
    const now = input.reviewedAt || nowTimestamp();
    review.reviewStatus = '已驳回';
    review.reviewedBy = input.reviewedBy;
    review.reviewedAt = now;
    review.reviewRemark = input.reviewRemark?.trim() || '盘点差异已驳回';
    if (line) {
        line.reviewStatus = '已驳回';
    }
    if (order) {
        order.status = '待确认';
    }
    return cloneValue(review);
}
export function executeFactoryWarehouseAdjustmentOrder(input) {
    const store = ensureFactoryInternalWarehouseStore();
    const adjustment = store.adjustmentOrders.find((item) => item.adjustmentOrderId === input.adjustmentOrderId);
    if (!adjustment || adjustment.status !== '待执行')
        return adjustment ? cloneValue(adjustment) : null;
    const now = input.executedAt || nowTimestamp();
    if (adjustment.warehouseKind === 'WAIT_PROCESS') {
        const stockItem = store.waitProcessStockItems.find((item) => item.stockItemId === adjustment.stockItemId);
        if (stockItem) {
            stockItem.receivedQty = roundQty(adjustment.countedQty);
            stockItem.differenceQty = roundQty(stockItem.receivedQty - stockItem.expectedQty);
            stockItem.status = stockItem.differenceQty === 0 ? '已入待加工仓' : '差异待处理';
        }
    }
    else {
        const stockItem = store.waitHandoverStockItems.find((item) => item.stockItemId === adjustment.stockItemId);
        if (stockItem) {
            stockItem.waitHandoverQty = roundQty(adjustment.countedQty);
            stockItem.differenceQty = roundQty(stockItem.waitHandoverQty - stockItem.completedQty);
            stockItem.status = stockItem.differenceQty === 0 ? '待交出' : '差异';
        }
    }
    adjustment.status = '已完成';
    adjustment.executedAt = now;
    adjustment.executedBy = input.executedBy;
    adjustment.remark = input.remark?.trim() || adjustment.remark;
    const review = store.stocktakeDifferenceReviews.find((item) => item.reviewId === adjustment.reviewId);
    const order = store.stocktakeOrders.find((item) => item.stocktakeOrderId === adjustment.sourceStocktakeOrderId);
    const line = order?.lineList.find((item) => item.lineId === adjustment.sourceLineId);
    if (review) {
        review.reviewStatus = '已调整';
        review.adjustmentOrderId = adjustment.adjustmentOrderId;
        review.reviewRemark = input.remark?.trim() || review.reviewRemark;
    }
    if (line) {
        line.reviewStatus = '已调整';
        line.adjustmentOrderId = adjustment.adjustmentOrderId;
        line.adjustedAt = now;
    }
    if (order) {
        refreshStocktakeOrderStatusAfterAdjustment(order);
    }
    return cloneValue(adjustment);
}
export function getFactoryWarehousePositionStatusOptions() {
    return [
        { value: 'AVAILABLE', label: '可用' },
        { value: 'STOPPED', label: '停用' },
    ];
}
export function getFactoryWarehouseSummary(input) {
    const store = ensureFactoryInternalWarehouseStore();
    const keyword = input.keyword?.trim().toLowerCase() || '';
    const now = Date.now();
    const rangeMs = input.timeRange === '7D' ? 7 * 24 * 3600 * 1000 : input.timeRange === '30D' ? 30 * 24 * 3600 * 1000 : Number.POSITIVE_INFINITY;
    const withinRange = (value) => {
        if (!value || !Number.isFinite(rangeMs))
            return true;
        const time = new Date(value.replace(' ', 'T')).getTime();
        if (!Number.isFinite(time))
            return true;
        return now - time <= rangeMs;
    };
    const byFactory = (item) => {
        if (input.factoryId && item.factoryId !== input.factoryId)
            return false;
        if (input.processCode && item.processCode !== input.processCode)
            return false;
        if (input.warehouseKind) {
            const warehouse = store.warehouses.find((entry) => entry.warehouseId === item.warehouseId || entry.warehouseName === item.warehouseName);
            if (!warehouse || warehouse.warehouseKind !== input.warehouseKind)
                return false;
        }
        return true;
    };
    const matchesKeyword = (tokens) => {
        if (!keyword)
            return true;
        return tokens.some((token) => token?.toLowerCase().includes(keyword));
    };
    const waitReceiveQty = store.inboundRecords
        .filter((record) => byFactory(record))
        .filter((record) => withinRange(record.receivedAt))
        .filter((record) => matchesKeyword([record.inboundRecordNo, record.sourceRecordNo, record.materialSku, record.feiTicketNo, record.fabricRollNo]))
        .filter((record) => (input.status ? record.status === input.status : record.status === '待确认'))
        .reduce((sum, record) => sum + record.expectedQty, 0);
    const waitProcessQty = store.waitProcessStockItems
        .filter((item) => byFactory(item))
        .filter((item) => withinRange(item.receivedAt))
        .filter((item) => matchesKeyword([item.sourceRecordNo, item.taskNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo]))
        .filter((item) => (input.status ? item.status === input.status : item.status === '已入待加工仓'))
        .reduce((sum, item) => sum + item.receivedQty, 0);
    const waitHandoverQty = store.waitHandoverStockItems
        .filter((item) => byFactory(item))
        .filter((item) => matchesKeyword([item.taskNo, item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo]))
        .filter((item) => (input.status ? item.status === input.status : item.status === '待交出'))
        .reduce((sum, item) => sum + item.waitHandoverQty, 0);
    const handedOutQty = store.outboundRecords
        .filter((item) => byFactory(item))
        .filter((item) => withinRange(item.outboundAt))
        .filter((item) => matchesKeyword([item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo]))
        .filter((item) => (input.status ? item.status === input.status : item.status !== '已作废'))
        .reduce((sum, item) => sum + item.outboundQty, 0);
    const differenceQty = store.inboundRecords
        .filter((item) => byFactory(item))
        .reduce((sum, item) => sum + Math.abs(item.differenceQty), 0)
        + store.outboundRecords
            .filter((item) => byFactory(item))
            .reduce((sum, item) => sum + Math.abs(item.differenceQty || 0), 0);
    const abnormalCount = store.waitProcessStockItems.filter((item) => byFactory(item) && item.status === '差异待处理').length
        + store.waitHandoverStockItems.filter((item) => byFactory(item) && (item.status === '差异' || item.status === '异议中')).length;
    const stocktakeDifferenceCount = store.stocktakeOrders
        .filter((order) => (!input.factoryId || order.factoryId === input.factoryId))
        .reduce((sum, order) => sum + order.lineList.filter((line) => (line.differenceQty ?? 0) !== 0).length, 0);
    const stocktakeWaitReviewCount = store.stocktakeDifferenceReviews
        .filter((review) => (!input.factoryId || review.factoryId === input.factoryId))
        .filter((review) => review.reviewStatus === '待审核' || review.reviewStatus === '审核通过' || review.reviewStatus === '已驳回')
        .length;
    const stocktakeAdjustedCount = store.stocktakeDifferenceReviews
        .filter((review) => (!input.factoryId || review.factoryId === input.factoryId))
        .filter((review) => review.reviewStatus === '已调整')
        .length;
    return {
        waitReceiveQty: roundQty(waitReceiveQty),
        waitProcessQty: roundQty(waitProcessQty),
        waitHandoverQty: roundQty(waitHandoverQty),
        handedOutQty: roundQty(handedOutQty),
        differenceQty: roundQty(differenceQty),
        abnormalCount,
        stocktakeDifferenceCount,
        stocktakeWaitReviewCount,
        stocktakeAdjustedCount,
    };
}
export function getFactoryWarehouseFilterStatusOptions() {
    return [
        { value: 'ALL', label: '全部' },
        { value: '待领料', label: '待领料' },
        { value: '已入待加工仓', label: '已入待加工仓' },
        { value: '差异待处理', label: '差异待处理' },
        { value: '待交出', label: '待交出' },
        { value: '已交出', label: '已交出' },
        { value: '已回写', label: '已回写' },
        { value: '差异', label: '差异' },
        { value: '异议中', label: '异议中' },
    ];
}
export function getFactoryWarehouseTimeRangeOptions() {
    return [
        { value: '7D', label: '最近 7 天' },
        { value: '30D', label: '最近 30 天' },
        { value: 'ALL', label: '全部' },
    ];
}
export function getFactoryWarehouseKindOptions() {
    return [
        { value: '', label: '全部' },
        { value: 'WAIT_PROCESS', label: '待加工仓' },
        { value: 'WAIT_HANDOVER', label: '待交出仓' },
    ];
}
export function getFactoryWarehouseProcessOptions(factoryId) {
    const factories = listFactoryInternalWarehouseFactoryOptions();
    const selectedFactory = factoryId ? factories.find((factory) => factory.id === factoryId) : undefined;
    const abilitySource = selectedFactory ? selectedFactory.processAbilities : factories.flatMap((factory) => factory.processAbilities);
    const entries = abilitySource
        .map((ability) => ({
        value: ability.processCode,
        label: ability.processName || getProcessDefinitionByCode(ability.processCode)?.processName || ability.processCode,
    }))
        .filter((item, index, list) => list.findIndex((entry) => entry.value === item.value) === index);
    return entries;
}
export function getFactoryWarehouseKindLabel(warehouseKind) {
    return getWarehouseKindLabel(warehouseKind);
}
export function getFactoryWarehousePositionLabel(status) {
    return getWarehouseLocationStatusLabel(status);
}
