export type SampleMaterialMode = '替代布' | '正确布'
export type FirstSamplePurpose = '首版确认' | '产前复用候选'

export type SampleChainMode = '直接复用首版样衣' | '新增一件产前版样衣' | '双样衣'
export type SampleSpecialSceneReasonCode = '定位印' | '大货量大' | '工厂参照样' | '正确布确认' | '其它'

export type SamplePlanRole = '复用首版样衣' | '替代布确认样' | '正确布确认样' | '工厂参照样'
export type SamplePlanMaterialMode = '复用首版' | '替代布' | '正确布'
export type SamplePlanLineStatus = '待计划' | '待打样' | '已发样' | '已到样' | '已确认' | '已取消'

export interface SamplePlanLine {
  lineId: string
  sampleRole: SamplePlanRole
  materialMode: SamplePlanMaterialMode
  quantity: number
  targetFactoryId: string
  targetFactoryName: string
  linkedSampleAssetId: string
  linkedSampleCode: string
  status: SamplePlanLineStatus
  note: string
}
