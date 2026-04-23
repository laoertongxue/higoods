export type PlateMakingProductHistoryType = '' | '未卖过' | '已卖过补纸样'
export type PlateMakingPatternArea = '' | '印尼' | '深圳'

export interface PlateMakingPatternImageLine {
  lineId: string
  imageId: string
  materialPartName: string
  materialDescription: string
  pieceCount: number
}

export interface PlateMakingPartTemplateLink {
  templateId: string
  templateCode: string
  templateName: string
  matchedPartNames: string[]
}

