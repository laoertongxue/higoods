export interface ProcessOrderInputTransferFixture {
  workOrderId: string
  productionOrderId: string
  taskId: string
  materialCode: string
  materialName: string
  qty: number
  unit: string
  targetFactoryId: string
  targetFactoryName: string
  issuedAt: string
  sourceType: 'PRODUCTION_ORDER' | 'STOCK'
}

// 演示中的加工投入必须由仓库调拨事实支撑；加工、交出和下游接收不得凭空出现。
export const DYE_INPUT_TRANSFER_FIXTURES: readonly ProcessOrderInputTransferFixture[] = [
  { workOrderId: 'DWO-004', productionOrderId: 'PO-202603-0001', taskId: 'TASK-DYE-000724', materialCode: 'tdv_demand_SPU_2024_004-kol-fabric-main', materialName: '针织棉主面料 / White 纯棉针织布', qty: 5600, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 09:35:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-005', productionOrderId: 'PO-202603-0002', taskId: 'TASK-DYE-000725', materialCode: 'tdv_demand_SPU_2024_005-bom-main', materialName: '主面料 / Grey 主面料', qty: 2800, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 09:40:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-006', productionOrderId: 'PO-202603-0003', taskId: 'TASK-DYE-000726', materialCode: 'tdv_demand_SPU_2024_009-bom-main', materialName: '主面料 / White 主面料', qty: 6720, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 08:45:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-007', productionOrderId: 'PO-202603-086', taskId: 'TASK-DYE-000727', materialCode: 'tdv_demand_SPU_SHIRT_086-bom-main', materialName: '主面料 / 蓝白印花 主面料', qty: 3360, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 09:00:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-008', productionOrderId: 'PO-202603-088', taskId: 'TASK-DYE-000728', materialCode: 'tdv_demand_SPU_TSHIRT_081-bom-main', materialName: '主面料 / White / Black 主面料', qty: 2016, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 09:10:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-009', productionOrderId: 'po-14671', taskId: 'TASK-DYE-000734', materialCode: 'tdv-po-14671-v1-bom-A', materialName: '面料 A · 净色 / 放行目标补料', qty: 3798, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 09:20:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-010', productionOrderId: 'PO-202603-0001', taskId: 'TASK-DYE-000730', materialCode: 'tdv_demand_SPU_2024_004-kol-fabric-main', materialName: '针织棉主面料 / White 纯棉针织布', qty: 5600, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 09:25:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-011', productionOrderId: 'PO-202603-0002', taskId: 'TASK-DYE-000731', materialCode: 'tdv_demand_SPU_2024_005-bom-main', materialName: '主面料 / Grey 主面料', qty: 2800, unit: '米', targetFactoryId: 'F090', targetFactoryName: '全能力测试工厂', issuedAt: '2026-03-28 07:30:00', sourceType: 'PRODUCTION_ORDER' },
  { workOrderId: 'DWO-013', productionOrderId: 'STOCK-DYE-FABRIC-013', taskId: 'TASK-DYE-000733', materialCode: 'FAB-DYE-013', materialName: '备货棉涤坯布', qty: 940, unit: '米', targetFactoryId: 'ID-F002', targetFactoryName: 'PT Prima Printing Center', issuedAt: '2026-03-29 09:30:00', sourceType: 'STOCK' },
] as const
