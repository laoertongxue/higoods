import {
  listSpreadingResultGeneratedFeiTickets
} from "./generated-fei-tickets.ts";
const HANDOVER_RECEIVER_TYPES = ["\u8F66\u7F1D\u5382", "\u8F85\u52A9\u5DE5\u827A\u5382", "\u7279\u79CD\u5DE5\u827A\u5382", "\u4ED3\u5E93", "\u5176\u4ED6\u5BF9\u8C61"];
const HANDOVER_TYPES = ["\u8F66\u7F1D\u4EA4\u51FA", "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA", "\u4ED3\u5E93\u4EA4\u51FA", "\u5176\u4ED6\u4EA4\u51FA"];
function q(input) {
  const unit = input.unit || "\u7247";
  const label = input.label || "\u672C\u6B21\u4EA4\u51FA";
  return {
    ...input,
    unit,
    summaryText: `${input.partName} ${input.size} ${label} ${input.pieceQty} ${unit}`
  };
}
function ticket(input) {
  return {
    markerPlanNo: "MKP-260324-010",
    spreadingOrderNo: "PB-260324-010-A",
    pieceSequenceLabel: "1-80",
    currentInventoryStatus: "\u5DF2\u88C5\u888B\u5F85\u4EA4\u51FA",
    sourceTempBagCode: "TB-IN-0301",
    ...input
  };
}
function buildShortageResultItem(record, item) {
  const source = record.cumulativeHandedOverSummary.find((summary) => summary.partCode === item.partCode && summary.size === item.size) || record.currentHandedOverSummary.find((summary) => summary.size === item.size) || record.currentHandedOverSummary[0] || record.previousHandedOverSummary[0];
  return {
    productionOrderNo: source?.productionOrderNo || record.relatedProductionOrderIds[0] || "",
    cutOrderNo: source?.cutOrderNo || record.relatedCutOrderIds[0] || "",
    color: source?.color || record.feiTicketItems[0]?.color || "",
    size: item.size,
    partCode: item.partCode,
    partName: item.partName,
    requiredQty: item.requiredQty,
    cumulativeHandedOverQty: item.handedOverQty,
    shortageQty: item.shortageQty,
    unit: item.unit,
    shortageReason: item.reason
  };
}
const commonSource = {
  sourceSystem: "\u88C1\u5E8A\u5382\u7BA1\u7406\u539F\u578B",
  sourceFactoryId: "factory-cutting-main",
  sourceFactoryCode: "CUT-FAC-001",
  sourceFactoryName: "\u88C1\u5E8A\u5382",
  sourceWarehouseId: "cutting-wait-handover",
  sourceWarehouseName: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3"
};
const handoverOrders = [
  {
    handoverOrderId: "HO-CUT-SEW-260324-001",
    handoverOrderNo: "JCD-260324-001",
    handoverType: "\u8F66\u7F1D\u4EA4\u51FA",
    ...commonSource,
    receiverType: "\u8F66\u7F1D\u5382",
    receiverId: "sew-factory-01",
    receiverCode: "SEW-001",
    receiverName: "PT Indo Sewing Center",
    receiverFactoryType: "\u8F66\u7F1D\u5382",
    relatedProductionOrderIds: ["PO-202603-0101", "PO-202603-0102"],
    relatedCutOrderIds: ["CUT-260306-101-01", "CUT-260306-101-02"],
    relatedSewingTaskId: "ST-260324-001",
    relatedPickingTaskId: "PK-260324-001",
    handoverBasis: "\u57FA\u4E8E\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599\u4EFB\u52A1\u548C\u4EA4\u51FA\u88C5\u888B\u7ED3\u679C",
    status: "\u90E8\u5206\u63A5\u6536",
    totalRecordCount: 3,
    totalPlannedPieceQty: 460,
    totalHandedOverPieceQty: 430,
    totalReceivedPieceQty: 412,
    shortageAfterLatestRecord: 30,
    latestRecordId: "HR-CUT-SEW-260324-001-003",
    latestRecordAt: "2026-04-24 16:20",
    createdAt: "2026-04-24 09:10",
    createdBy: "\u4ED3\u5E93\u4E3B\u7BA1",
    updatedAt: "2026-04-24 16:20",
    remark: "\u8F66\u7F1D\u5382\u5206\u6279\u63A5\u6536\uFF0C\u9F50\u5957\u548C\u7F3A\u53E3\u6309\u4EA4\u51FA\u540E\u7ED3\u679C\u5C55\u793A\u3002"
  },
  {
    handoverOrderId: "HO-CUT-AUX-260324-001",
    handoverOrderNo: "JCD-260324-002",
    handoverType: "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA",
    ...commonSource,
    receiverType: "\u8F85\u52A9\u5DE5\u827A\u5382",
    receiverId: "aux-craft-emb-01",
    receiverCode: "AUX-EMB-001",
    receiverName: "Aux Embroidery Factory A",
    receiverFactoryType: "\u8F85\u52A9\u5DE5\u827A\u5382",
    relatedProductionOrderIds: ["PO-202603-0101"],
    relatedCutOrderIds: ["CUT-260306-101-01"],
    relatedSpecialCraftTaskId: "SC-EMB-260324-001",
    handoverBasis: "\u57FA\u4E8E\u83F2\u7968\u7279\u6B8A\u5DE5\u827A\u627F\u63A5\u5DE5\u5382",
    status: "\u5DF2\u4EA4\u51FA\u5F85\u63A5\u6536",
    totalRecordCount: 1,
    totalPlannedPieceQty: 80,
    totalHandedOverPieceQty: 80,
    totalReceivedPieceQty: 0,
    shortageAfterLatestRecord: 0,
    latestRecordId: "HR-CUT-AUX-260324-001-001",
    latestRecordAt: "2026-04-24 11:30",
    createdAt: "2026-04-24 11:20",
    createdBy: "\u7279\u6B8A\u5DE5\u827A\u5458",
    updatedAt: "2026-04-24 11:30"
  },
  {
    handoverOrderId: "HO-CUT-SPC-260324-001",
    handoverOrderNo: "JCD-260324-003",
    handoverType: "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA",
    ...commonSource,
    receiverType: "\u7279\u79CD\u5DE5\u827A\u5382",
    receiverId: "special-craft-laser-01",
    receiverCode: "SPC-LSR-001",
    receiverName: "Laser Pocket Workshop C",
    receiverFactoryType: "\u7279\u79CD\u5DE5\u827A\u5382",
    relatedProductionOrderIds: ["PO-202603-0102"],
    relatedCutOrderIds: ["CUT-260306-102-01"],
    relatedSpecialCraftTaskId: "SC-LSR-260324-001",
    handoverBasis: "\u57FA\u4E8E\u83F2\u7968\u7279\u6B8A\u5DE5\u827A\u627F\u63A5\u5DE5\u5382",
    status: "\u5DEE\u5F02\u5904\u7406\u4E2D",
    totalRecordCount: 1,
    totalPlannedPieceQty: 48,
    totalHandedOverPieceQty: 48,
    totalReceivedPieceQty: 46,
    shortageAfterLatestRecord: 2,
    latestRecordId: "HR-CUT-SPC-260324-001-001",
    latestRecordAt: "2026-04-24 13:50",
    createdAt: "2026-04-24 13:20",
    createdBy: "\u7279\u6B8A\u5DE5\u827A\u5458",
    updatedAt: "2026-04-24 15:05"
  },
  {
    handoverOrderId: "HO-CUT-WH-260324-001",
    handoverOrderNo: "JCD-260324-004",
    handoverType: "\u4ED3\u5E93\u4EA4\u51FA",
    ...commonSource,
    receiverType: "\u4ED3\u5E93",
    receiverId: "central-accessory-warehouse",
    receiverCode: "WH-ACC-001",
    receiverName: "\u4E2D\u592E\u5DE5\u5382-\u8F85\u6599\u4ED3",
    receiverFactoryType: "\u4ED3\u5E93",
    relatedProductionOrderIds: ["PO-202603-0103"],
    relatedCutOrderIds: ["CUT-260307-201-01"],
    handoverBasis: "\u57FA\u4E8E\u4ED3\u5E93\u8C03\u62E8\u548C\u4EA4\u51FA\u88C5\u888B\u7ED3\u679C",
    status: "\u5DF2\u63A5\u6536",
    totalRecordCount: 1,
    totalPlannedPieceQty: 60,
    totalHandedOverPieceQty: 60,
    totalReceivedPieceQty: 60,
    shortageAfterLatestRecord: 0,
    latestRecordId: "HR-CUT-WH-260324-001-001",
    latestRecordAt: "2026-04-24 10:10",
    createdAt: "2026-04-24 09:40",
    createdBy: "\u4ED3\u5E93\u4E3B\u7BA1",
    updatedAt: "2026-04-24 10:45"
  }
];
const handoverRecords = [
  {
    handoverRecordId: "HR-CUT-SEW-260324-001-001",
    handoverRecordNo: "JCR-260324-001-001",
    handoverOrderId: "HO-CUT-SEW-260324-001",
    handoverOrderNo: "JCD-260324-001",
    recordSequence: 1,
    receiverType: "\u8F66\u7F1D\u5382",
    receiverId: "sew-factory-01",
    receiverCode: "SEW-001",
    receiverName: "PT Indo Sewing Center",
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ["PO-202603-0101"],
    relatedCutOrderIds: ["CUT-260306-101-01"],
    relatedSewingTaskId: "ST-260324-001",
    relatedPickingTaskId: "PK-260324-001",
    transferBagUses: [
      {
        bagUseId: "BU-HO-001-A",
        bagCode: "TB-OUT-0301",
        bagMasterId: "BAG-M-0301",
        useStage: "\u4EA4\u51FA\u88C5\u888B",
        relatedHandoverOrderId: "HO-CUT-SEW-260324-001",
        relatedHandoverRecordId: "HR-CUT-SEW-260324-001-001",
        relatedSewingTaskId: "ST-260324-001",
        receiverType: "\u8F66\u7F1D\u5382",
        receiverId: "sew-factory-01",
        containedFeiTicketIds: ["FT-260324-001", "FT-260324-002"],
        totalPieceQty: 120,
        packedAt: "2026-04-24 09:28",
        packedBy: "\u5206\u62E3\u5458A",
        signedAt: "2026-04-24 10:20"
      }
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: "FT-260324-001",
        feiTicketNo: "FT-260324-001",
        inventoryRecordId: "INV-FT-260324-001",
        productionOrderNo: "PO-202603-0101",
        cutOrderNo: "CUT-260306-101-01",
        spuCode: "SPU-2024-010",
        color: "Black",
        size: "M",
        partCode: "FRONT",
        partName: "\u524D\u7247",
        pieceQty: 60,
        hasSpecialCraft: false,
        specialCraftDisplay: "\u65E0",
        receiverFactoryDisplay: "\u65E0",
        targetTransferBagCode: "TB-OUT-0301"
      }),
      ticket({
        feiTicketId: "FT-260324-002",
        feiTicketNo: "FT-260324-002",
        inventoryRecordId: "INV-FT-260324-002",
        productionOrderNo: "PO-202603-0101",
        cutOrderNo: "CUT-260306-101-01",
        spuCode: "SPU-2024-010",
        color: "Black",
        size: "M",
        partCode: "BACK",
        partName: "\u540E\u7247",
        pieceQty: 60,
        hasSpecialCraft: false,
        specialCraftDisplay: "\u65E0",
        receiverFactoryDisplay: "\u65E0",
        targetTransferBagCode: "TB-OUT-0301"
      })
    ],
    previousHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 0, label: "\u4E4B\u524D\u5DF2\u4EA4" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "BACK", partName: "\u540E\u7247", pieceQty: 0, label: "\u4E4B\u524D\u5DF2\u4EA4" })
    ],
    currentHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 60, label: "\u672C\u6B21\u4EA4\u51FA" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "BACK", partName: "\u540E\u7247", pieceQty: 60, label: "\u672C\u6B21\u4EA4\u51FA" })
    ],
    cumulativeHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 60, label: "\u7D2F\u8BA1\u4EA4\u51FA" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "BACK", partName: "\u540E\u7247", pieceQty: 60, label: "\u7D2F\u8BA1\u4EA4\u51FA" })
    ],
    completenessAfterRecord: {
      isCompleteAfterRecord: false,
      completeBy: "\u90E8\u4F4D",
      checkedAt: "2026-04-24 10:05",
      summaryText: "\u4EA4\u51FA\u540E\u4ECD\u7F3A\u8896\u7247 M 30 \u7247\uFF0C\u53EF\u7EE7\u7EED\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u3002"
    },
    shortageAfterRecord: [
      { size: "M", partCode: "SLEEVE", partName: "\u8896\u7247", requiredQty: 30, handedOverQty: 0, shortageQty: 30, unit: "\u7247", reason: "\u8896\u7247\u5C1A\u5728\u5F85\u5206\u62E3" }
    ],
    receiverWritebackStatus: "\u5DF2\u56DE\u5199",
    receiverWritebackAt: "2026-04-24 10:22",
    receiverWritebackBy: "\u8F66\u7F1D\u6536\u8D27\u5458",
    receivedItems: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 60, label: "\u5DF2\u63A5\u6536" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "BACK", partName: "\u540E\u7247", pieceQty: 60, label: "\u5DF2\u63A5\u6536" })
    ],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: "\u5DF2\u63A5\u6536",
    handedOverAt: "2026-04-24 09:45",
    handedOverBy: "\u4ED3\u7BA1A",
    createdAt: "2026-04-24 09:35",
    createdBy: "\u4ED3\u7BA1A"
  },
  {
    handoverRecordId: "HR-CUT-SEW-260324-001-002",
    handoverRecordNo: "JCR-260324-001-002",
    handoverOrderId: "HO-CUT-SEW-260324-001",
    handoverOrderNo: "JCD-260324-001",
    recordSequence: 2,
    receiverType: "\u8F66\u7F1D\u5382",
    receiverId: "sew-factory-01",
    receiverCode: "SEW-001",
    receiverName: "PT Indo Sewing Center",
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ["PO-202603-0101"],
    relatedCutOrderIds: ["CUT-260306-101-01"],
    relatedSewingTaskId: "ST-260324-001",
    relatedPickingTaskId: "PK-260324-002",
    transferBagUses: [
      {
        bagUseId: "BU-HO-001-B",
        bagCode: "TB-OUT-0302",
        bagMasterId: "BAG-M-0302",
        useStage: "\u4EA4\u51FA\u88C5\u888B",
        relatedHandoverOrderId: "HO-CUT-SEW-260324-001",
        relatedHandoverRecordId: "HR-CUT-SEW-260324-001-002",
        relatedSewingTaskId: "ST-260324-001",
        receiverType: "\u8F66\u7F1D\u5382",
        receiverId: "sew-factory-01",
        containedFeiTicketIds: ["FT-260324-003"],
        totalPieceQty: 30,
        packedAt: "2026-04-24 12:12",
        packedBy: "\u5206\u62E3\u5458B",
        signedAt: "2026-04-24 13:00"
      },
      {
        bagUseId: "BU-HO-001-C",
        bagCode: "TB-OUT-0303",
        bagMasterId: "BAG-M-0303",
        useStage: "\u4EA4\u51FA\u88C5\u888B",
        relatedHandoverOrderId: "HO-CUT-SEW-260324-001",
        relatedHandoverRecordId: "HR-CUT-SEW-260324-001-002",
        relatedSewingTaskId: "ST-260324-001",
        receiverType: "\u8F66\u7F1D\u5382",
        receiverId: "sew-factory-01",
        containedFeiTicketIds: ["FT-260324-004"],
        totalPieceQty: 30,
        packedAt: "2026-04-24 12:18",
        packedBy: "\u5206\u62E3\u5458B",
        signedAt: "2026-04-24 13:00"
      }
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: "FT-260324-003",
        feiTicketNo: "FT-260324-003",
        inventoryRecordId: "INV-FT-260324-003",
        productionOrderNo: "PO-202603-0101",
        cutOrderNo: "CUT-260306-101-01",
        spuCode: "SPU-2024-010",
        color: "Black",
        size: "M",
        partCode: "SLEEVE",
        partName: "\u8896\u7247",
        pieceQty: 30,
        hasSpecialCraft: false,
        specialCraftDisplay: "\u65E0",
        receiverFactoryDisplay: "\u65E0",
        targetTransferBagCode: "TB-OUT-0302"
      }),
      ticket({
        feiTicketId: "FT-260324-004",
        feiTicketNo: "FT-260324-004",
        inventoryRecordId: "INV-FT-260324-004",
        productionOrderNo: "PO-202603-0101",
        cutOrderNo: "CUT-260306-101-01",
        spuCode: "SPU-2024-010",
        color: "Black",
        size: "M",
        partCode: "COLLAR",
        partName: "\u9886\u7247",
        pieceQty: 30,
        hasSpecialCraft: false,
        specialCraftDisplay: "\u65E0",
        receiverFactoryDisplay: "\u65E0",
        targetTransferBagCode: "TB-OUT-0303"
      })
    ],
    previousHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 60, label: "\u4E4B\u524D\u5DF2\u4EA4" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "BACK", partName: "\u540E\u7247", pieceQty: 60, label: "\u4E4B\u524D\u5DF2\u4EA4" })
    ],
    currentHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "SLEEVE", partName: "\u8896\u7247", pieceQty: 30, label: "\u672C\u6B21\u4EA4\u51FA" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "COLLAR", partName: "\u9886\u7247", pieceQty: 30, label: "\u672C\u6B21\u4EA4\u51FA" })
    ],
    cumulativeHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 60, label: "\u7D2F\u8BA1\u4EA4\u51FA" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "BACK", partName: "\u540E\u7247", pieceQty: 60, label: "\u7D2F\u8BA1\u4EA4\u51FA" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "SLEEVE", partName: "\u8896\u7247", pieceQty: 30, label: "\u7D2F\u8BA1\u4EA4\u51FA" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "COLLAR", partName: "\u9886\u7247", pieceQty: 30, label: "\u7D2F\u8BA1\u4EA4\u51FA" })
    ],
    completenessAfterRecord: {
      isCompleteAfterRecord: true,
      completeBy: "\u90E8\u4F4D",
      checkedAt: "2026-04-24 13:05",
      summaryText: "\u672C SKU \u5DF2\u6309\u53EF\u4EA4\u51FA\u90E8\u4F4D\u5B8C\u6210\u4EA4\u51FA\uFF0C\u7279\u6B8A\u5DE5\u827A\u90E8\u4F4D\u540E\u7EED\u53EF\u8865\u4EA4\u3002"
    },
    shortageAfterRecord: [],
    receiverWritebackStatus: "\u5DEE\u5F02\u56DE\u5199",
    receiverWritebackAt: "2026-04-24 13:08",
    receiverWritebackBy: "\u8F66\u7F1D\u6536\u8D27\u5458",
    receivedItems: [
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "SLEEVE", partName: "\u8896\u7247", pieceQty: 28, label: "\u5DF2\u63A5\u6536" }),
      q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "M", partCode: "COLLAR", partName: "\u9886\u7247", pieceQty: 30, label: "\u5DF2\u63A5\u6536" })
    ],
    discrepancyItems: [
      {
        discrepancyId: "DIS-HR-001-002",
        discrepancyType: "\u6570\u91CF\u5DEE\u5F02",
        expectedQty: 60,
        actualReceivedQty: 58,
        differenceQty: -2,
        unit: "\u7247",
        feiTicketId: "FT-260324-003",
        bagCode: "TB-OUT-0302",
        description: "\u8896\u7247\u63A5\u6536\u5C11 2 \u7247\uFF0C\u63A5\u6536\u65B9\u5DF2\u4E0A\u4F20\u7167\u7247\u3002",
        evidencePhotos: ["\u5DEE\u5F02\u7167\u7247-\u8896\u7247-001.jpg"],
        reportedAt: "2026-04-24 13:08",
        reportedBy: "\u8F66\u7F1D\u6536\u8D27\u5458",
        handlingStatus: "\u5904\u7406\u4E2D"
      }
    ],
    objectionItems: [],
    recordStatus: "\u5DEE\u5F02\u5904\u7406\u4E2D",
    handedOverAt: "2026-04-24 12:40",
    handedOverBy: "\u4ED3\u7BA1B",
    createdAt: "2026-04-24 12:25",
    createdBy: "\u4ED3\u7BA1B"
  },
  {
    handoverRecordId: "HR-CUT-SEW-260324-001-003",
    handoverRecordNo: "JCR-260324-001-003",
    handoverOrderId: "HO-CUT-SEW-260324-001",
    handoverOrderNo: "JCD-260324-001",
    recordSequence: 3,
    receiverType: "\u8F66\u7F1D\u5382",
    receiverId: "sew-factory-01",
    receiverCode: "SEW-001",
    receiverName: "PT Indo Sewing Center",
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ["PO-202603-0102"],
    relatedCutOrderIds: ["CUT-260306-101-02"],
    relatedSewingTaskId: "ST-260324-002",
    relatedPickingTaskId: "PK-260324-003",
    transferBagUses: [
      {
        bagUseId: "BU-HO-001-D",
        bagCode: "TB-OUT-0304",
        bagMasterId: "BAG-M-0304",
        useStage: "\u4EA4\u51FA\u88C5\u888B",
        relatedHandoverOrderId: "HO-CUT-SEW-260324-001",
        relatedHandoverRecordId: "HR-CUT-SEW-260324-001-003",
        relatedSewingTaskId: "ST-260324-002",
        receiverType: "\u8F66\u7F1D\u5382",
        receiverId: "sew-factory-01",
        containedFeiTicketIds: ["FT-260324-005"],
        totalPieceQty: 250,
        packedAt: "2026-04-24 15:50",
        packedBy: "\u5206\u62E3\u5458C"
      }
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: "FT-260324-005",
        feiTicketNo: "FT-260324-005",
        inventoryRecordId: "INV-FT-260324-005",
        productionOrderNo: "PO-202603-0102",
        cutOrderNo: "CUT-260306-101-02",
        markerPlanNo: "MKP-260324-011",
        spreadingOrderNo: "PB-260324-011-A",
        spuCode: "SPU-2024-010",
        color: "Charcoal",
        size: "L",
        partCode: "FRONT",
        partName: "\u524D\u7247",
        pieceQty: 250,
        pieceSequenceLabel: "1-250",
        hasSpecialCraft: false,
        specialCraftDisplay: "\u65E0",
        receiverFactoryDisplay: "\u65E0",
        targetTransferBagCode: "TB-OUT-0304"
      })
    ],
    previousHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-101-02", color: "Charcoal", size: "L", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 0, label: "\u4E4B\u524D\u5DF2\u4EA4" })
    ],
    currentHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-101-02", color: "Charcoal", size: "L", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 250, label: "\u672C\u6B21\u4EA4\u51FA" })
    ],
    cumulativeHandedOverSummary: [
      q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-101-02", color: "Charcoal", size: "L", partCode: "FRONT", partName: "\u524D\u7247", pieceQty: 250, label: "\u7D2F\u8BA1\u4EA4\u51FA" })
    ],
    completenessAfterRecord: {
      isCompleteAfterRecord: false,
      completeBy: "SKU",
      checkedAt: "2026-04-24 16:20",
      summaryText: "\u672C\u6B21\u53EA\u4EA4\u51FA\u524D\u7247\uFF0C\u540E\u7247\u548C\u8896\u7247\u540E\u7EED\u8865\u4EA4\u3002"
    },
    shortageAfterRecord: [
      { size: "L", partCode: "BACK", partName: "\u540E\u7247", requiredQty: 250, handedOverQty: 0, shortageQty: 250, unit: "\u7247", reason: "\u9762\u6599 02 \u5BF9\u5E94\u88C1\u7247\u5C1A\u672A\u5165\u4ED3\uFF0C\u5DF2\u88C1\u51FA\u524D\u7247\u53EF\u5148\u4EA4\u51FA" },
      { size: "L", partCode: "SLEEVE", partName: "\u8896\u7247", requiredQty: 250, handedOverQty: 0, shortageQty: 250, unit: "\u7247", reason: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\uFF0C\u5176\u4ED6\u5DF2\u88C1\u51FA\u90E8\u4F4D\u53EF\u7EE7\u7EED\u4EA4\u51FA" }
    ],
    receiverWritebackStatus: "\u5F85\u56DE\u5199",
    receivedItems: [],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: "\u5F85\u63A5\u6536\u56DE\u5199",
    handedOverAt: "2026-04-24 16:20",
    handedOverBy: "\u4ED3\u7BA1C",
    createdAt: "2026-04-24 16:05",
    createdBy: "\u4ED3\u7BA1C"
  },
  {
    handoverRecordId: "HR-CUT-AUX-260324-001-001",
    handoverRecordNo: "JCR-260324-002-001",
    handoverOrderId: "HO-CUT-AUX-260324-001",
    handoverOrderNo: "JCD-260324-002",
    handoverType: "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA",
    recordSequence: 1,
    receiverType: "\u8F85\u52A9\u5DE5\u827A\u5382",
    receiverId: "aux-craft-emb-01",
    receiverCode: "AUX-EMB-001",
    receiverName: "Aux Embroidery Factory A",
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ["PO-202603-0101"],
    relatedCutOrderIds: ["CUT-260306-101-01"],
    relatedSpecialCraftTaskId: "SC-EMB-260324-001",
    transferBagUses: [
      {
        bagUseId: "BU-HO-AUX-001",
        bagCode: "TB-OUT-0401",
        bagMasterId: "BAG-M-0401",
        useStage: "\u4EA4\u51FA\u88C5\u888B",
        relatedHandoverOrderId: "HO-CUT-AUX-260324-001",
        relatedHandoverRecordId: "HR-CUT-AUX-260324-001-001",
        receiverType: "\u8F85\u52A9\u5DE5\u827A\u5382",
        receiverId: "aux-craft-emb-01",
        containedFeiTicketIds: ["FT-260324-006"],
        totalPieceQty: 80,
        packedAt: "2026-04-24 11:25",
        packedBy: "\u7279\u6B8A\u5DE5\u827A\u5458"
      }
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: "FT-260324-006",
        feiTicketNo: "FT-260324-006",
        inventoryRecordId: "INV-FT-260324-006",
        productionOrderNo: "PO-202603-0101",
        cutOrderNo: "CUT-260306-101-01",
        spuCode: "SPU-2024-010",
        color: "Black",
        size: "S",
        partCode: "CHEST",
        partName: "\u80F8\u8D34\u7247",
        pieceQty: 80,
        hasSpecialCraft: true,
        specialCraftDisplay: "\u7EE3\u82B1",
        receiverFactoryDisplay: "Aux Embroidery Factory A",
        targetTransferBagCode: "TB-OUT-0401"
      })
    ],
    specialCraftItems: [
      {
        specialCraftId: "SC-FT-260324-006-EMB",
        craftCategory: "\u8F85\u52A9\u5DE5\u827A",
        craftType: "\u7EE3\u82B1",
        craftName: "\u7EE3\u82B1",
        receiverFactoryId: "aux-craft-emb-01",
        receiverFactoryName: "Aux Embroidery Factory A",
        partName: "\u80F8\u8D34\u7247",
        size: "S",
        pieceQty: 80,
        feiTicketId: "FT-260324-006"
      }
    ],
    previousHandedOverSummary: [q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "S", partCode: "CHEST", partName: "\u80F8\u8D34\u7247", pieceQty: 0, label: "\u4E4B\u524D\u5DF2\u4EA4" })],
    currentHandedOverSummary: [q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "S", partCode: "CHEST", partName: "\u80F8\u8D34\u7247", pieceQty: 80, label: "\u672C\u6B21\u4EA4\u51FA" })],
    cumulativeHandedOverSummary: [q({ productionOrderNo: "PO-202603-0101", cutOrderNo: "CUT-260306-101-01", color: "Black", size: "S", partCode: "CHEST", partName: "\u80F8\u8D34\u7247", pieceQty: 80, label: "\u7D2F\u8BA1\u4EA4\u51FA" })],
    completenessAfterRecord: { isCompleteAfterRecord: false, completeBy: "\u90E8\u4F4D", checkedAt: "2026-04-24 11:30", summaryText: "\u8F85\u52A9\u5DE5\u827A\u90E8\u4F4D\u5DF2\u4EA4\u51FA\uFF0C\u7B49\u5F85\u63A5\u6536\u56DE\u5199\u548C\u56DE\u4ED3\u3002" },
    shortageAfterRecord: [],
    receiverWritebackStatus: "\u5F85\u56DE\u5199",
    receivedItems: [],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: "\u5F85\u63A5\u6536\u56DE\u5199",
    handedOverAt: "2026-04-24 11:30",
    handedOverBy: "\u7279\u6B8A\u5DE5\u827A\u5458",
    createdAt: "2026-04-24 11:24",
    createdBy: "\u7279\u6B8A\u5DE5\u827A\u5458"
  },
  {
    handoverRecordId: "HR-CUT-SPC-260324-001-001",
    handoverRecordNo: "JCR-260324-003-001",
    handoverOrderId: "HO-CUT-SPC-260324-001",
    handoverOrderNo: "JCD-260324-003",
    handoverType: "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA",
    recordSequence: 1,
    receiverType: "\u7279\u79CD\u5DE5\u827A\u5382",
    receiverId: "special-craft-laser-01",
    receiverCode: "SPC-LSR-001",
    receiverName: "Laser Pocket Workshop C",
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ["PO-202603-0102"],
    relatedCutOrderIds: ["CUT-260306-102-01"],
    relatedSpecialCraftTaskId: "SC-LSR-260324-001",
    transferBagUses: [
      {
        bagUseId: "BU-HO-SPC-001",
        bagCode: "TB-OUT-0402",
        bagMasterId: "BAG-M-0402",
        useStage: "\u4EA4\u51FA\u88C5\u888B",
        relatedHandoverOrderId: "HO-CUT-SPC-260324-001",
        relatedHandoverRecordId: "HR-CUT-SPC-260324-001-001",
        receiverType: "\u7279\u79CD\u5DE5\u827A\u5382",
        receiverId: "special-craft-laser-01",
        containedFeiTicketIds: ["FT-260324-007"],
        totalPieceQty: 48,
        packedAt: "2026-04-24 13:42",
        packedBy: "\u7279\u6B8A\u5DE5\u827A\u5458",
        signedAt: "2026-04-24 14:15"
      }
    ],
    feiTicketItems: [
      ticket({
        feiTicketId: "FT-260324-007",
        feiTicketNo: "FT-260324-007",
        inventoryRecordId: "INV-FT-260324-007",
        productionOrderNo: "PO-202603-0102",
        cutOrderNo: "CUT-260306-102-01",
        spuCode: "SPU-2024-010",
        color: "Charcoal",
        size: "M",
        partCode: "POCKET",
        partName: "\u888B\u53E3\u7247",
        pieceQty: 48,
        hasSpecialCraft: true,
        specialCraftDisplay: "\u6FC0\u5149\u5F00\u888B",
        receiverFactoryDisplay: "Laser Pocket Workshop C",
        targetTransferBagCode: "TB-OUT-0402"
      })
    ],
    specialCraftItems: [
      {
        specialCraftId: "SC-FT-260324-007-LASER",
        craftCategory: "\u7279\u79CD\u5DE5\u827A",
        craftType: "\u6FC0\u5149\u5F00\u888B",
        craftName: "\u6FC0\u5149\u5F00\u888B",
        receiverFactoryId: "special-craft-laser-01",
        receiverFactoryName: "Laser Pocket Workshop C",
        partName: "\u888B\u53E3\u7247",
        size: "M",
        pieceQty: 48,
        feiTicketId: "FT-260324-007"
      }
    ],
    previousHandedOverSummary: [q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-102-01", color: "Charcoal", size: "M", partCode: "POCKET", partName: "\u888B\u53E3\u7247", pieceQty: 0, label: "\u4E4B\u524D\u5DF2\u4EA4" })],
    currentHandedOverSummary: [q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-102-01", color: "Charcoal", size: "M", partCode: "POCKET", partName: "\u888B\u53E3\u7247", pieceQty: 48, label: "\u672C\u6B21\u4EA4\u51FA" })],
    cumulativeHandedOverSummary: [q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-102-01", color: "Charcoal", size: "M", partCode: "POCKET", partName: "\u888B\u53E3\u7247", pieceQty: 48, label: "\u7D2F\u8BA1\u4EA4\u51FA" })],
    completenessAfterRecord: { isCompleteAfterRecord: true, completeBy: "\u90E8\u4F4D", checkedAt: "2026-04-24 14:20", summaryText: "\u7279\u79CD\u5DE5\u827A\u90E8\u4F4D\u672C\u6B21\u5DF2\u5168\u91CF\u4EA4\u51FA\u3002" },
    shortageAfterRecord: [],
    receiverWritebackStatus: "\u5F02\u8BAE\u4E2D",
    receiverWritebackAt: "2026-04-24 14:20",
    receiverWritebackBy: "\u7279\u79CD\u5DE5\u827A\u6536\u8D27\u5458",
    receivedItems: [q({ productionOrderNo: "PO-202603-0102", cutOrderNo: "CUT-260306-102-01", color: "Charcoal", size: "M", partCode: "POCKET", partName: "\u888B\u53E3\u7247", pieceQty: 46, label: "\u5DF2\u63A5\u6536" })],
    discrepancyItems: [
      { discrepancyId: "DIS-HR-SPC-001", discrepancyType: "\u63A5\u6536\u5DEE\u5F02", expectedQty: 48, actualReceivedQty: 46, differenceQty: -2, unit: "\u7247", bagCode: "TB-OUT-0402", description: "\u63A5\u6536\u65B9\u56DE\u5199\u5C11 2 \u7247\u3002", evidencePhotos: [], reportedAt: "2026-04-24 14:20", reportedBy: "\u7279\u79CD\u5DE5\u827A\u6536\u8D27\u5458", handlingStatus: "\u5904\u7406\u4E2D" }
    ],
    objectionItems: [
      { objectionId: "OBJ-HR-SPC-001", objectionType: "\u6570\u91CF\u5F02\u8BAE", raisedBy: "\u88C1\u5E8A\u4ED3\u7BA1", raisedAt: "2026-04-24 15:05", reason: "\u88C1\u5E8A\u626B\u63CF\u4EA4\u51FA\u4E3A 48 \u7247\uFF0C\u9700\u590D\u6838\u63A5\u6536\u73B0\u573A\u3002", evidence: ["PDA\u4EA4\u51FA\u622A\u56FE"], handlingStatus: "\u5904\u7406\u4E2D" }
    ],
    recordStatus: "\u5DEE\u5F02\u5904\u7406\u4E2D",
    handedOverAt: "2026-04-24 13:50",
    handedOverBy: "\u7279\u6B8A\u5DE5\u827A\u5458",
    createdAt: "2026-04-24 13:35",
    createdBy: "\u7279\u6B8A\u5DE5\u827A\u5458"
  },
  {
    handoverRecordId: "HR-CUT-WH-260324-001-001",
    handoverRecordNo: "JCR-260324-004-001",
    handoverOrderId: "HO-CUT-WH-260324-001",
    handoverOrderNo: "JCD-260324-004",
    recordSequence: 1,
    receiverType: "\u4ED3\u5E93",
    receiverId: "central-accessory-warehouse",
    receiverCode: "WH-ACC-001",
    receiverName: "\u4E2D\u592E\u5DE5\u5382-\u8F85\u6599\u4ED3",
    sourceWarehouseId: commonSource.sourceWarehouseId,
    sourceWarehouseName: commonSource.sourceWarehouseName,
    relatedProductionOrderIds: ["PO-202603-0103"],
    relatedCutOrderIds: ["CUT-260307-201-01"],
    transferBagUses: [
      { bagUseId: "BU-HO-WH-001", bagCode: "TB-OUT-0501", bagMasterId: "BAG-M-0501", useStage: "\u4EA4\u51FA\u88C5\u888B", relatedHandoverOrderId: "HO-CUT-WH-260324-001", relatedHandoverRecordId: "HR-CUT-WH-260324-001-001", receiverType: "\u4ED3\u5E93", receiverId: "central-accessory-warehouse", containedFeiTicketIds: ["FT-260324-008"], totalPieceQty: 60, packedAt: "2026-04-24 09:58", packedBy: "\u4ED3\u7BA1D", signedAt: "2026-04-24 10:30", returnedAt: "2026-04-24 16:00" }
    ],
    feiTicketItems: [
      ticket({ feiTicketId: "FT-260324-008", feiTicketNo: "FT-260324-008", inventoryRecordId: "INV-FT-260324-008", productionOrderNo: "PO-202603-0103", cutOrderNo: "CUT-260307-201-01", markerPlanNo: "MKP-260324-012", spreadingOrderNo: "PB-260324-012-A", spuCode: "SPU-2024-011", color: "Navy", size: "M", partCode: "PATCH", partName: "\u8D34\u5E03\u7247", pieceQty: 60, hasSpecialCraft: false, specialCraftDisplay: "\u65E0", receiverFactoryDisplay: "\u65E0", targetTransferBagCode: "TB-OUT-0501" })
    ],
    previousHandedOverSummary: [q({ productionOrderNo: "PO-202603-0103", cutOrderNo: "CUT-260307-201-01", color: "Navy", size: "M", partCode: "PATCH", partName: "\u8D34\u5E03\u7247", pieceQty: 0, label: "\u4E4B\u524D\u5DF2\u4EA4" })],
    currentHandedOverSummary: [q({ productionOrderNo: "PO-202603-0103", cutOrderNo: "CUT-260307-201-01", color: "Navy", size: "M", partCode: "PATCH", partName: "\u8D34\u5E03\u7247", pieceQty: 60, label: "\u672C\u6B21\u4EA4\u51FA" })],
    cumulativeHandedOverSummary: [q({ productionOrderNo: "PO-202603-0103", cutOrderNo: "CUT-260307-201-01", color: "Navy", size: "M", partCode: "PATCH", partName: "\u8D34\u5E03\u7247", pieceQty: 60, label: "\u7D2F\u8BA1\u4EA4\u51FA" })],
    completenessAfterRecord: { isCompleteAfterRecord: true, completeBy: "\u4EA4\u51FA\u5355", checkedAt: "2026-04-24 10:35", summaryText: "\u4ED3\u5E93\u63A5\u6536\u65E0\u5DEE\u5F02\u3002" },
    shortageAfterRecord: [],
    receiverWritebackStatus: "\u5DF2\u56DE\u5199",
    receiverWritebackAt: "2026-04-24 10:35",
    receiverWritebackBy: "\u4ED3\u5E93\u6536\u8D27\u5458",
    receivedItems: [q({ productionOrderNo: "PO-202603-0103", cutOrderNo: "CUT-260307-201-01", color: "Navy", size: "M", partCode: "PATCH", partName: "\u8D34\u5E03\u7247", pieceQty: 60, label: "\u5DF2\u63A5\u6536" })],
    discrepancyItems: [],
    objectionItems: [],
    recordStatus: "\u5DF2\u63A5\u6536",
    handedOverAt: "2026-04-24 10:10",
    handedOverBy: "\u4ED3\u7BA1D",
    createdAt: "2026-04-24 09:52",
    createdBy: "\u4ED3\u7BA1D"
  }
];
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function isMissingReceiverFactory(craft) {
  return !craft.receiverFactoryId || craft.receiverFactoryId.includes("PENDING") || craft.receiverFactoryName.includes("\u5F85\u8865\u5145");
}
function getReceiverTypeForSpecialCraft(craft) {
  if (craft.receiverFactoryType === "\u8F85\u52A9\u5DE5\u827A\u5382") return "\u8F85\u52A9\u5DE5\u827A\u5382";
  if (craft.receiverFactoryType === "\u7279\u79CD\u5DE5\u827A\u5382") return "\u7279\u79CD\u5DE5\u827A\u5382";
  return craft.craftCategory === "\u7279\u79CD\u5DE5\u827A" ? "\u7279\u79CD\u5DE5\u827A\u5382" : "\u8F85\u52A9\u5DE5\u827A\u5382";
}
function getSpecialCraftRecordKey(input) {
  return [
    input.feiTicketId,
    input.craftType,
    input.receiverFactoryName,
    input.partName,
    input.size
  ].join("|");
}
function getExistingSpecialCraftHandoverKeys() {
  return new Set(
    handoverRecords.flatMap(
      (record) => (record.specialCraftItems || []).map(
        (item) => getSpecialCraftRecordKey({
          feiTicketId: item.feiTicketId,
          craftType: item.craftType,
          receiverFactoryName: item.receiverFactoryName,
          partName: item.partName,
          size: item.size
        })
      )
    )
  );
}
function createSpecialCraftCandidateFromGeneratedRecord(record, craft, existingKeys) {
  const missingReceiver = isMissingReceiverFactory(craft);
  const alreadyHandedOver = craft.handoverStatus === "\u5DF2\u4EA4\u51FA" || existingKeys.has(
    getSpecialCraftRecordKey({
      feiTicketId: record.feiTicketId,
      craftType: craft.craftType,
      receiverFactoryName: craft.receiverFactoryName,
      partName: record.partName,
      size: record.skuSize
    })
  );
  const canCreateHandover = !missingReceiver && !alreadyHandedOver && record.printStatus !== "VOIDED";
  const reasonTexts = [
    record.printStatus === "VOIDED" ? "\u83F2\u7968\u5DF2\u4F5C\u5E9F\uFF0C\u4E0D\u80FD\u751F\u6210\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u5355" : "",
    missingReceiver ? "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145\uFF0C\u4E0D\u80FD\u751F\u6210\u6B63\u5F0F\u4EA4\u51FA\u5355" : "",
    alreadyHandedOver ? "\u540C\u4E00\u83F2\u7968\u540C\u4E00\u7279\u6B8A\u5DE5\u827A\u5DF2\u4EA4\u51FA\u672A\u56DE\u4ED3\uFF0C\u4E0D\u80FD\u91CD\u590D\u4EA4\u51FA" : ""
  ].filter(Boolean);
  return {
    candidateId: `SC-HO-CAND-${record.feiTicketId}-${craft.specialCraftId}`,
    feiTicketId: record.feiTicketId,
    feiTicketNo: record.feiTicketNo,
    inventoryRecordId: `INV-${record.feiTicketNo}`,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    spuCode: record.skuCode,
    color: record.skuColor,
    size: record.skuSize,
    partCode: record.partCode,
    partName: record.partName,
    pieceQty: record.actualCutPieceQty || record.qty,
    pieceSequenceLabel: record.pieceSequenceLabel,
    specialCraftId: craft.specialCraftId,
    craftCategory: craft.craftCategory,
    craftType: craft.craftType,
    craftName: craft.craftName,
    receiverFactoryId: craft.receiverFactoryId,
    receiverFactoryCode: craft.receiverFactoryCode,
    receiverFactoryName: craft.receiverFactoryName,
    receiverFactoryType: craft.receiverFactoryType,
    currentInventoryStatus: missingReceiver ? "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145" : alreadyHandedOver ? "\u7279\u6B8A\u5DE5\u827A\u52A0\u5DE5\u4E2D" : "\u5728\u5E93\u53EF\u5206\u914D",
    specialCraftHandoverStatus: missingReceiver ? "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145" : alreadyHandedOver ? "\u5DF2\u4EA4\u51FA\u672A\u56DE\u4ED3" : "\u5F85\u4EA4\u51FA",
    specialCraftReturnStatus: craft.returnStatus,
    canCreateHandover,
    reasonTexts
  };
}
function createSpecialCraftCandidateFromHandoverRecord(record, item) {
  const feiTicket = record.feiTicketItems.find((ticketItem) => ticketItem.feiTicketId === item.feiTicketId);
  const returnState = getSpecialCraftReturnStateForHandoverItem(record, item);
  return {
    candidateId: `SC-HO-CAND-EXISTING-${record.handoverRecordId}-${item.specialCraftId}`,
    feiTicketId: item.feiTicketId,
    feiTicketNo: feiTicket?.feiTicketNo || item.feiTicketId,
    inventoryRecordId: feiTicket?.inventoryRecordId || `INV-${item.feiTicketId}`,
    productionOrderId: record.relatedProductionOrderIds[0] || "",
    productionOrderNo: feiTicket?.productionOrderNo || record.relatedProductionOrderIds[0] || "",
    cutOrderId: record.relatedCutOrderIds[0] || "",
    cutOrderNo: feiTicket?.cutOrderNo || record.relatedCutOrderIds[0] || "",
    spuCode: feiTicket?.spuCode || "",
    color: feiTicket?.color || "",
    size: item.size,
    partCode: feiTicket?.partCode || "",
    partName: item.partName,
    pieceQty: item.pieceQty,
    pieceSequenceLabel: feiTicket?.pieceSequenceLabel || "\u6309\u83F2\u7968\u8FFD\u8E2A",
    specialCraftId: item.specialCraftId,
    craftCategory: item.craftCategory,
    craftType: item.craftType,
    craftName: item.craftName,
    receiverFactoryId: item.receiverFactoryId,
    receiverFactoryCode: record.receiverCode,
    receiverFactoryName: item.receiverFactoryName,
    receiverFactoryType: record.receiverType,
    currentInventoryStatus: returnState.currentInventoryStatus,
    specialCraftHandoverStatus: returnState.specialCraftHandoverStatus,
    specialCraftReturnStatus: returnState.specialCraftReturnStatus,
    canCreateHandover: false,
    reasonTexts: [returnState.reasonText]
  };
}
function listSpecialCraftHandoverCandidates() {
  const existingKeys = getExistingSpecialCraftHandoverKeys();
  const generatedCandidates = listSpreadingResultGeneratedFeiTickets().filter((record) => record.hasSpecialCraft && record.printStatus !== "VOIDED").flatMap(
    (record) => record.specialCrafts.map((craft) => createSpecialCraftCandidateFromGeneratedRecord(record, craft, existingKeys))
  );
  const existingCandidates = handoverRecords.filter((record) => record.handoverType === "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA" || record.relatedSpecialCraftTaskId).flatMap(
    (record) => (record.specialCraftItems || []).map((item) => createSpecialCraftCandidateFromHandoverRecord(record, item))
  );
  return clone([...generatedCandidates, ...existingCandidates]);
}
function buildSpecialCraftHandoverGroups(candidates = listSpecialCraftHandoverCandidates()) {
  const existingOrders = handoverOrders.filter((order) => order.handoverType === "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA");
  const groups = candidates.reduce((result, candidate) => {
    const receiverType = getReceiverTypeForSpecialCraft(candidate);
    const groupId = [
      candidate.receiverFactoryId || "PENDING",
      candidate.craftCategory,
      candidate.craftType
    ].join("__");
    const order = existingOrders.find((item) => item.receiverId === candidate.receiverFactoryId && item.handoverType === "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA");
    const record = handoverRecords.find(
      (item) => (item.specialCraftItems || []).some(
        (craft) => craft.receiverFactoryId === candidate.receiverFactoryId && craft.craftType === candidate.craftType
      )
    );
    if (!result[groupId]) {
      result[groupId] = {
        groupId,
        craftCategory: candidate.craftCategory,
        craftType: candidate.craftType,
        craftName: candidate.craftName,
        receiverFactoryId: candidate.receiverFactoryId,
        receiverFactoryCode: candidate.receiverFactoryCode,
        receiverFactoryName: candidate.receiverFactoryName,
        receiverType,
        candidates: [],
        totalPieceQty: 0,
        canCreateHandover: true,
        reasonTexts: [],
        handoverOrderId: order?.handoverOrderId,
        handoverOrderNo: order?.handoverOrderNo,
        handoverRecordId: record?.handoverRecordId,
        handoverRecordNo: record?.handoverRecordNo
      };
    }
    result[groupId].candidates.push(candidate);
    result[groupId].totalPieceQty += candidate.pieceQty;
    if (!candidate.canCreateHandover) {
      result[groupId].canCreateHandover = false;
      result[groupId].reasonTexts = Array.from(/* @__PURE__ */ new Set([...result[groupId].reasonTexts, ...candidate.reasonTexts]));
    }
    if (record && !result[groupId].handoverRecordId) {
      result[groupId].handoverRecordId = record.handoverRecordId;
      result[groupId].handoverRecordNo = record.handoverRecordNo;
    }
    return result;
  }, {});
  return clone(Object.values(groups).sort(
    (left, right) => left.receiverFactoryName.localeCompare(right.receiverFactoryName, "zh-CN") || left.craftType.localeCompare(right.craftType, "zh-CN")
  ));
}
function getSpecialCraftReturnStateForHandoverItem(record, item) {
  const returnRecord = getSpecialCraftReturnRecordForItem(record.handoverRecordId, item.specialCraftId, item.feiTicketId);
  if (!returnRecord) {
    return {
      currentInventoryStatus: "\u7279\u6B8A\u5DE5\u827A\u52A0\u5DE5\u4E2D",
      specialCraftHandoverStatus: "\u5DF2\u4EA4\u51FA\u672A\u56DE\u4ED3",
      specialCraftReturnStatus: "\u672A\u56DE\u4ED3",
      reasonText: "\u540C\u4E00\u83F2\u7968\u540C\u4E00\u7279\u6B8A\u5DE5\u827A\u5DF2\u4EA4\u51FA\u672A\u56DE\u4ED3\uFF0C\u4E0D\u80FD\u91CD\u590D\u4EA4\u51FA"
    };
  }
  if (returnRecord.returnStatus === "\u5DF2\u56DE\u4ED3") {
    return {
      currentInventoryStatus: "\u5728\u5E93\u53EF\u5206\u914D",
      specialCraftHandoverStatus: "\u5DF2\u751F\u6210\u4EA4\u51FA\u5355",
      specialCraftReturnStatus: "\u5DF2\u56DE\u4ED3",
      reasonText: "\u7279\u6B8A\u5DE5\u827A\u5DF2\u56DE\u4ED3\uFF0C\u56DE\u4ED3\u88C1\u7247\u91CD\u65B0\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58"
    };
  }
  return {
    currentInventoryStatus: "\u7279\u6B8A\u5DE5\u827A\u52A0\u5DE5\u4E2D",
    specialCraftHandoverStatus: "\u5DF2\u4EA4\u51FA\u672A\u56DE\u4ED3",
    specialCraftReturnStatus: returnRecord.returnStatus === "\u90E8\u5206\u56DE\u4ED3" ? "\u90E8\u5206\u56DE\u4ED3" : "\u56DE\u4ED3\u5DEE\u5F02\u5904\u7406\u4E2D",
    reasonText: "\u7279\u6B8A\u5DE5\u827A\u5DF2\u6709\u56DE\u4ED3\u8BB0\u5F55\u4F46\u4ECD\u5B58\u5728\u90E8\u5206\u56DE\u4ED3\u6216\u56DE\u4ED3\u5DEE\u5F02\uFF0C\u4E0D\u80FD\u91CD\u590D\u53D1\u8D77\u540C\u4E00\u5DE5\u827A\u4EA4\u51FA"
  };
}
function findSourceSpecialCraftHandoverRecord(sourceHandoverRecordId) {
  return handoverRecords.find((record) => record.handoverRecordId === sourceHandoverRecordId || record.handoverRecordNo === sourceHandoverRecordId);
}
function buildSpecialCraftReturnRecord(input) {
  const sourceRecord = findSourceSpecialCraftHandoverRecord(input.sourceHandoverRecordId);
  const sourceOrder = sourceRecord ? handoverOrders.find((order) => order.handoverOrderId === sourceRecord.handoverOrderId) : void 0;
  const craft = sourceRecord?.specialCraftItems?.find((item) => item.specialCraftId === input.specialCraftId);
  const feiTicket = craft ? sourceRecord?.feiTicketItems.find((item) => item.feiTicketId === craft.feiTicketId) : void 0;
  if (!sourceRecord || !sourceOrder || !craft || !feiTicket) return null;
  const expectedQty = craft.pieceQty;
  const differenceQty = input.actualQty - expectedQty;
  const returnStatus = input.status || (differenceQty === 0 ? "\u5DF2\u56DE\u4ED3" : input.actualQty > 0 && input.actualQty < expectedQty ? "\u90E8\u5206\u56DE\u4ED3" : "\u56DE\u4ED3\u5DEE\u5F02\u5904\u7406\u4E2D");
  const returnedItem = {
    feiTicketId: feiTicket.feiTicketId,
    feiTicketNo: feiTicket.feiTicketNo,
    inventoryRecordId: feiTicket.inventoryRecordId,
    productionOrderNo: feiTicket.productionOrderNo,
    cutOrderNo: feiTicket.cutOrderNo,
    spuCode: feiTicket.spuCode,
    color: feiTicket.color,
    size: feiTicket.size,
    partCode: feiTicket.partCode,
    partName: feiTicket.partName,
    pieceQty: expectedQty,
    returnedQty: input.actualQty,
    pieceSequenceLabel: feiTicket.pieceSequenceLabel,
    specialCraftId: craft.specialCraftId,
    craftType: craft.craftType,
    receiverFactoryName: craft.receiverFactoryName,
    returnCheckResult: differenceQty === 0 ? "\u6B63\u5E38" : input.actualQty < expectedQty ? "\u90E8\u5206\u56DE\u4ED3" : "\u6570\u91CF\u5DEE\u5F02",
    allRequiredCraftsReturned: input.allRequiredCraftsReturned ?? differenceQty === 0,
    remainingSpecialCrafts: input.remainingSpecialCrafts || []
  };
  const discrepancyItems = differenceQty === 0 && !input.discrepancyType ? [] : [
    {
      discrepancyId: `SCR-DIFF-${input.returnRecordId}`,
      discrepancyType: input.discrepancyType || (differenceQty < 0 ? "\u56DE\u4ED3\u6570\u91CF\u5C0F\u4E8E\u4EA4\u51FA\u6570\u91CF" : "\u56DE\u4ED3\u6570\u91CF\u5927\u4E8E\u4EA4\u51FA\u6570\u91CF"),
      expectedQty,
      actualQty: input.actualQty,
      differenceQty,
      unit: "\u7247",
      feiTicketId: feiTicket.feiTicketId,
      sourceHandoverRecordId: sourceRecord.handoverRecordId,
      returnRecordId: input.returnRecordId,
      description: input.discrepancyDescription || `\u5E94\u56DE ${expectedQty} \u7247\uFF0C\u5B9E\u56DE ${input.actualQty} \u7247\u3002`,
      evidencePhotos: [],
      reportedAt: input.returnedAt,
      reportedBy: input.returnedBy,
      handlingStatus: "\u5904\u7406\u4E2D"
    }
  ];
  return {
    returnRecordId: input.returnRecordId,
    returnRecordNo: input.returnRecordNo,
    sourceHandoverOrderId: sourceRecord.handoverOrderId,
    sourceHandoverOrderNo: sourceRecord.handoverOrderNo,
    sourceHandoverRecordId: sourceRecord.handoverRecordId,
    sourceHandoverRecordNo: sourceRecord.handoverRecordNo,
    receiverFactoryId: sourceRecord.receiverId,
    receiverFactoryCode: sourceRecord.receiverCode,
    receiverFactoryName: sourceRecord.receiverName,
    craftCategory: craft.craftCategory,
    craftType: craft.craftType,
    craftName: craft.craftName,
    returnedFeiTicketItems: [returnedItem],
    expectedReturnSummary: [
      q({
        productionOrderNo: feiTicket.productionOrderNo,
        cutOrderNo: feiTicket.cutOrderNo,
        color: feiTicket.color,
        size: feiTicket.size,
        partCode: feiTicket.partCode,
        partName: feiTicket.partName,
        pieceQty: expectedQty,
        label: "\u672C\u6B21\u4EA4\u51FA"
      })
    ],
    actualReturnSummary: [
      q({
        productionOrderNo: feiTicket.productionOrderNo,
        cutOrderNo: feiTicket.cutOrderNo,
        color: feiTicket.color,
        size: feiTicket.size,
        partCode: feiTicket.partCode,
        partName: feiTicket.partName,
        pieceQty: input.actualQty,
        label: "\u5DF2\u63A5\u6536"
      })
    ],
    discrepancyItems,
    returnStatus,
    returnedAt: input.returnedAt,
    returnedBy: input.returnedBy,
    receivedWarehouseId: "cutting-wait-handover",
    receivedWarehouseName: "\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3",
    receivedWarehouseArea: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u533A",
    receivedLocationCode: input.locationCode,
    createdAt: input.returnedAt,
    createdBy: input.returnedBy,
    remark: input.remark
  };
}
function buildSpecialCraftReturnRecords() {
  const records = [
    buildSpecialCraftReturnRecord({
      returnRecordId: "SCR-260324-001",
      returnRecordNo: "SCHR-260324-001",
      sourceHandoverRecordId: "HR-CUT-AUX-260324-001-001",
      specialCraftId: "SC-FT-260324-006-EMB",
      actualQty: 80,
      returnedAt: "2026-04-26 10:20",
      returnedBy: "\u88C1\u5E8A\u56DE\u4ED3\u5458",
      locationCode: "SP-RETURN-01",
      allRequiredCraftsReturned: true,
      remark: "\u7EE3\u82B1\u5B8C\u6210\u5168\u91CF\u56DE\u4ED3\uFF0C\u91CD\u65B0\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58\u3002"
    }),
    buildSpecialCraftReturnRecord({
      returnRecordId: "SCR-260324-002",
      returnRecordNo: "SCHR-260324-002",
      sourceHandoverRecordId: "HR-CUT-SPC-260324-001-001",
      specialCraftId: "SC-FT-260324-007-LASER",
      actualQty: 46,
      returnedAt: "2026-04-26 14:10",
      returnedBy: "\u88C1\u5E8A\u56DE\u4ED3\u5458",
      status: "\u90E8\u5206\u56DE\u4ED3",
      locationCode: "SP-RETURN-02",
      allRequiredCraftsReturned: false,
      remainingSpecialCrafts: ["\u6FC0\u5149\u5F00\u888B\u5DEE\u5F02\u590D\u6838"],
      discrepancyDescription: "\u6FC0\u5149\u5F00\u888B\u56DE\u4ED3\u5C11 2 \u7247\uFF0C\u5148\u751F\u6210\u90E8\u5206\u56DE\u4ED3\u5E76\u8BB0\u5F55\u5DEE\u5F02\u3002"
    }),
    buildSpecialCraftReturnRecord({
      returnRecordId: "SCR-260324-003",
      returnRecordNo: "SCHR-260324-003",
      sourceHandoverRecordId: "HR-CUT-SPC-260324-001-001",
      specialCraftId: "SC-FT-260324-007-LASER",
      actualQty: 50,
      returnedAt: "2026-04-26 16:35",
      returnedBy: "\u88C1\u5E8A\u56DE\u4ED3\u5458",
      status: "\u56DE\u4ED3\u5DEE\u5F02\u5904\u7406\u4E2D",
      locationCode: "SP-RETURN-03",
      allRequiredCraftsReturned: false,
      discrepancyType: "\u56DE\u4ED3\u6570\u91CF\u5927\u4E8E\u4EA4\u51FA\u6570\u91CF",
      discrepancyDescription: "\u627F\u63A5\u5DE5\u5382\u56DE\u4ED3\u626B\u63CF\u4E3A 50 \u7247\uFF0C\u5927\u4E8E\u539F\u4EA4\u51FA 48 \u7247\uFF0C\u9700\u590D\u6838\u888B\u7801\u548C\u83F2\u7968\u3002"
    })
  ].filter((record) => Boolean(record));
  return records;
}
function getSpecialCraftReturnRecordForItem(sourceHandoverRecordId, specialCraftId, feiTicketId) {
  return buildSpecialCraftReturnRecords().filter(
    (record) => record.sourceHandoverRecordId === sourceHandoverRecordId && record.returnedFeiTicketItems.some((item) => item.specialCraftId === specialCraftId && item.feiTicketId === feiTicketId)
  ).sort((left, right) => Number(right.returnStatus === "\u5DF2\u56DE\u4ED3") - Number(left.returnStatus === "\u5DF2\u56DE\u4ED3") || right.returnedAt.localeCompare(left.returnedAt, "zh-CN"))[0];
}
function listSpecialCraftReturnRecords() {
  return clone(buildSpecialCraftReturnRecords());
}
function listSpecialCraftReturnInventoryRecords(records = listSpecialCraftReturnRecords()) {
  return records.flatMap(
    (record) => record.returnedFeiTicketItems.filter((item) => item.returnedQty > 0).map((item) => {
      const readyForSewing = record.returnStatus === "\u5DF2\u56DE\u4ED3" && item.allRequiredCraftsReturned;
      return {
        inventoryRecordId: `INV-SCR-${record.returnRecordId}-${item.feiTicketId}`,
        sourceType: "\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
        sourceReturnRecordId: record.returnRecordId,
        sourceHandoverOrderId: record.sourceHandoverOrderId,
        sourceHandoverRecordId: record.sourceHandoverRecordId,
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        productionOrderId: item.productionOrderNo,
        productionOrderNo: item.productionOrderNo,
        cutOrderId: item.cutOrderNo,
        cutOrderNo: item.cutOrderNo,
        spuCode: item.spuCode,
        color: item.color,
        size: item.size,
        partName: item.partName,
        pieceQty: item.returnedQty,
        pieceSequenceLabel: item.pieceSequenceLabel,
        warehouseArea: record.receivedWarehouseArea,
        locationCode: record.receivedLocationCode,
        inventoryStatus: readyForSewing ? "\u5F85\u5206\u914D" : record.returnStatus === "\u56DE\u4ED3\u5DEE\u5F02\u5904\u7406\u4E2D" ? "\u56DE\u4ED3\u5DEE\u5F02\u5904\u7406\u4E2D" : "\u7279\u6B8A\u5DE5\u827A\u5DF2\u56DE\u4ED3",
        specialCraftReadyForSewing: readyForSewing,
        inboundAt: record.returnedAt,
        inboundBy: record.returnedBy,
        specialCraftDisplay: `${record.craftType}\u5DF2\u56DE\u4ED3`,
        receiverFactoryDisplay: record.receiverFactoryName,
        remainingSpecialCraftDisplay: item.remainingSpecialCrafts.join("\u3001") || "\u65E0"
      };
    })
  );
}
function buildSpecialCraftReturnProjection() {
  const records = listSpecialCraftReturnRecords();
  const inventoryRecords = listSpecialCraftReturnInventoryRecords(records);
  const waitingRecords = records.filter((record) => record.returnStatus === "\u5F85\u56DE\u4ED3");
  const returnedRecords = records.filter((record) => record.returnStatus === "\u5DF2\u56DE\u4ED3");
  const partialReturnedRecords = records.filter((record) => record.returnStatus === "\u90E8\u5206\u56DE\u4ED3");
  const discrepancyRecords = records.filter((record) => record.returnStatus === "\u56DE\u4ED3\u5DEE\u5F02\u5904\u7406\u4E2D" || record.discrepancyItems.length > 0);
  return {
    records,
    inventoryRecords,
    waitingRecords,
    returnedRecords,
    partialReturnedRecords,
    discrepancyRecords,
    summary: {
      returnRecordCount: records.length,
      waitingReturnCount: waitingRecords.length,
      returnedCount: returnedRecords.length,
      partialReturnCount: partialReturnedRecords.length,
      discrepancyCount: discrepancyRecords.length,
      returnedInventoryCount: inventoryRecords.length,
      readyForSewingCount: inventoryRecords.filter((record) => record.specialCraftReadyForSewing).length
    }
  };
}
function buildHandoverAfterRecordResult(record) {
  if (record.afterRecordResult) return clone(record.afterRecordResult);
  const shortageItems = record.shortageAfterRecord.map((item) => buildShortageResultItem(record, item));
  const specialCraftPendingItems = shortageItems.filter((item) => item.shortageReason.includes("\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3")).map((item, index) => ({
    feiTicketId: `PENDING-SC-${record.handoverRecordId}-${index + 1}`,
    partName: item.partName,
    size: item.size,
    pendingQty: item.shortageQty,
    specialCraftType: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3",
    receiverFactoryName: record.receiverName,
    expectedReturnText: "\u56DE\u4ED3\u540E\u91CD\u65B0\u8FDB\u5165\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58\uFF0C\u53EF\u7EE7\u7EED\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u3002"
  }));
  const riskTips = [];
  if (shortageItems.length) {
    riskTips.push({
      tipType: "\u4EA4\u51FA\u540E\u7F3A\u53E3",
      tipText: "\u672C\u6B21\u63D0\u4EA4\u4E0D\u56E0\u90E8\u4F4D\u3001\u5C3A\u7801\u6216\u591A\u9762\u6599\u7F3A\u53E3\u88AB\u62E6\u622A\uFF1B\u7F3A\u53E3\u4F5C\u4E3A\u4EA4\u51FA\u540E\u7ED3\u679C\u7EE7\u7EED\u8FFD\u8E2A\u3002",
      severity: "\u9700\u5173\u6CE8"
    });
  }
  if (specialCraftPendingItems.length) {
    riskTips.push({
      tipType: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u63D0\u793A",
      tipText: "\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u53EA\u5F71\u54CD\u5BF9\u5E94\u90E8\u4F4D\uFF0C\u5176\u4ED6\u5DF2\u88C1\u51FA\u5E76\u5728\u5E93\u88C1\u7247\u53EF\u7EE7\u7EED\u4EA4\u51FA\u3002",
      severity: "\u9700\u5173\u6CE8"
    });
  }
  if (record.discrepancyItems.length) {
    riskTips.push({
      tipType: "\u63A5\u6536\u5DEE\u5F02\u63D0\u793A",
      tipText: "\u63A5\u6536\u65B9\u5DF2\u6709\u5DEE\u5F02\u56DE\u5199\uFF0C\u672C\u6B21\u4ECD\u53EF\u7EE7\u7EED\u4EA4\u51FA\u6709\u6548\u5BF9\u8C61\uFF0C\u5DEE\u5F02\u72EC\u7ACB\u8DDF\u8FDB\u3002",
      severity: "\u9AD8"
    });
  }
  if (record.objectionItems.length) {
    riskTips.push({
      tipType: "\u5F02\u8BAE\u63D0\u793A",
      tipText: "\u63A5\u6536\u65B9\u5F02\u8BAE\u4E0D\u6539\u5199\u88C1\u7247\u5355\u4E3B\u72B6\u6001\uFF0C\u6309\u4EA4\u51FA\u8BB0\u5F55\u7EE7\u7EED\u8FFD\u8E2A\u3002",
      severity: "\u9AD8"
    });
  }
  const currentQty = record.currentHandedOverSummary.reduce((total, item) => total + item.pieceQty, 0);
  const canSubmitNextRecord = !["\u5DF2\u5173\u95ED", "\u5DF2\u53D6\u6D88"].includes(record.recordStatus) && currentQty > 0;
  if (!canSubmitNextRecord) {
    riskTips.push({
      tipType: "\u64CD\u4F5C\u6761\u4EF6",
      tipText: currentQty > 0 ? "\u4EA4\u51FA\u8BB0\u5F55\u5DF2\u5173\u95ED\u6216\u53D6\u6D88\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u63D0\u4EA4\u3002" : "\u5F53\u524D\u6CA1\u6709\u6709\u6548\u53EF\u4EA4\u5BF9\u8C61\uFF0C\u4E0D\u80FD\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u3002",
      severity: "\u9AD8"
    });
  }
  return {
    handoverRecordId: record.handoverRecordId,
    handoverOrderId: record.handoverOrderId,
    calculatedAt: record.handedOverAt,
    previousSummary: clone(record.previousHandedOverSummary),
    currentSummary: clone(record.currentHandedOverSummary),
    cumulativeSummary: clone(record.cumulativeHandedOverSummary),
    completenessResult: {
      isComplete: record.completenessAfterRecord.isCompleteAfterRecord,
      completeBy: record.completenessAfterRecord.completeBy,
      summaryText: record.completenessAfterRecord.summaryText
    },
    shortageItems,
    specialCraftPendingItems,
    riskTips,
    canSubmitNextRecord
  };
}
function listHandoverOrders() {
  return clone(handoverOrders);
}
function listHandoverRecords() {
  return clone(handoverRecords);
}
function getUniversalHandoverOrderById(handoverOrderId) {
  return listHandoverOrders().find((order) => order.handoverOrderId === handoverOrderId || order.handoverOrderNo === handoverOrderId);
}
function getUniversalHandoverRecordById(handoverRecordId) {
  return listHandoverRecords().find((record) => record.handoverRecordId === handoverRecordId || record.handoverRecordNo === handoverRecordId);
}
function buildUniversalHandoverProjection() {
  const orders = listHandoverOrders();
  const records = listHandoverRecords();
  const recordsByOrderId = records.reduce((result, record) => {
    result[record.handoverOrderId] = [...result[record.handoverOrderId] || [], record];
    return result;
  }, {});
  return {
    orders,
    records,
    recordsByOrderId,
    receiverTypes: HANDOVER_RECEIVER_TYPES,
    handoverTypes: HANDOVER_TYPES,
    summary: {
      orderCount: orders.length,
      recordCount: records.length,
      receiverTypeCount: new Set(orders.map((order) => order.receiverType)).size,
      pendingWritebackCount: records.filter((record) => record.receiverWritebackStatus === "\u5F85\u56DE\u5199").length,
      discrepancyCount: records.reduce((sum, record) => sum + record.discrepancyItems.length, 0),
      objectionCount: records.reduce((sum, record) => sum + record.objectionItems.length, 0)
    }
  };
}
function listHandoverAfterRecordResults() {
  return listHandoverRecords().map((record) => buildHandoverAfterRecordResult(record));
}
function buildPdaUniversalHandoverRecordDraft(handoverOrderId = "HO-CUT-SEW-260324-001") {
  const projection = buildUniversalHandoverProjection();
  const order = projection.orders.find((item) => item.handoverOrderId === handoverOrderId) || projection.orders[0];
  const records = projection.recordsByOrderId[order.handoverOrderId] || [];
  const latestResult = records.length ? buildHandoverAfterRecordResult(records[records.length - 1]) : void 0;
  return {
    handoverOrderId: order.handoverOrderId,
    handoverOrderNo: order.handoverOrderNo,
    nextRecordSequence: records.length + 1,
    receiverName: order.receiverName,
    receiverType: order.receiverType,
    sourceWarehouseName: order.sourceWarehouseName,
    recordStatus: "\u5F85\u63D0\u4EA4",
    writebackStatus: "\u5F85\u56DE\u5199",
    modelHint: "PDA \u6BCF\u6B21\u63D0\u4EA4\u53EA\u65B0\u589E\u4E00\u6761\u4EA4\u51FA\u8BB0\u5F55\uFF0C\u63A5\u6536\u65B9\u540E\u7EED\u6309\u4EA4\u51FA\u8BB0\u5F55\u56DE\u5199\u5DEE\u5F02\u6216\u5F02\u8BAE\u3002",
    submitConditionText: "\u63D0\u4EA4\u53EA\u6821\u9A8C\u6709\u6548\u83F2\u7968\u3001\u5728\u5E93\u88C1\u7247\u3001\u4E2D\u8F6C\u888B\u548C\u672C\u6B21\u6570\u91CF\uFF1B\u9F50\u5957\u4E0D\u662F\u63D0\u4EA4\u524D\u7F6E\u6761\u4EF6\u3002",
    riskTips: latestResult?.riskTips.slice(0, 3) || []
  };
}
export {
  HANDOVER_RECEIVER_TYPES,
  HANDOVER_TYPES,
  buildHandoverAfterRecordResult,
  buildPdaUniversalHandoverRecordDraft,
  buildSpecialCraftHandoverGroups,
  buildSpecialCraftReturnProjection,
  buildUniversalHandoverProjection,
  getUniversalHandoverOrderById,
  getUniversalHandoverRecordById,
  handoverOrders,
  handoverRecords,
  listHandoverAfterRecordResults,
  listHandoverOrders,
  listHandoverRecords,
  listSpecialCraftHandoverCandidates,
  listSpecialCraftReturnInventoryRecords,
  listSpecialCraftReturnRecords
};
