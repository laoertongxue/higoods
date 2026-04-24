export type SampleMaterialMode = '替代布' | '正确布'
export type FirstSamplePurpose = '首版确认' | '首单复用候选'

export type SampleChainMode = '复用首版结论' | '新增首单样衣确认' | '替代布与正确布双确认'
export type SampleSpecialSceneReasonCode = '定位印' | '大货量大' | '工厂参照样' | '正确布确认' | '其它'

export type SamplePlanRole = '复用首版结论' | '替代布确认样' | '正确布确认样' | '工厂参照确认'
export type SamplePlanMaterialMode = '沿用首版' | '替代布' | '正确布'
export type SamplePlanLineStatus = '待确认' | '已确认' | '需补样' | '已取消'

export interface SamplePlanLine {
  lineId: string
  sampleRole: SamplePlanRole
  materialMode: SamplePlanMaterialMode
  quantity: number
  targetFactoryId: string
  targetFactoryName: string
  linkedSampleCode: string
  status: SamplePlanLineStatus
  note: string
}
