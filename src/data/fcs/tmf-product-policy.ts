/** TMF V1 原型冻结口径；现场确认后只允许升版，不能静默覆盖历史记录。 */
export const TMF_PRODUCT_POLICY_VERSION = 'TMF-POLICY-V1'
export const tmfProductPolicy = {
  scope: {
    included: ['PMS面辅料采购→基础生产→上游染色/印花→TMF截断/打头→辅料仓→生产单实收'] as const,
    excludesFinishedLongTermStock: true,
    prototypeOnly: true,
  },
  factories: {
    spf: 'FAC-SPF',
    tmf: 'FAC-TMF',
    apf: 'FAC-APF',
  },
  roles: {
    ordinaryWarehouse: '仓管',
    warehouseSupervisor: '仓库主管',
    tmfSupervisor: '织带厂主管',
    productionReceiver: '生产领料人',
  },
  device: {
    pdaViewport: { width: 360, height: 640 },
    webSupervisorViewport: { width: 1024, height: 768 },
    labelSizes: ['150×100mm', 'A4'] as const,
    maxLabelAgeHours: 24,
  },
  controls: {
    overReceiptRequiresSupervisor: true,
    hazardousDispositionRequiresSecondConfirmation: true,
    skuLineageKeepsPurchaseLineId: true,
    resetIsolatedFixtureOnly: true,
  },
} as const
