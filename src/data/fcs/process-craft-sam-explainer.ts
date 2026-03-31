import { type SamCalcMode } from './process-craft-dict.ts'

export interface SamFormulaGuide {
  formulaText: string
  explanationLines: string[]
  exampleIntro: string
  exampleResult: string
  factoryFieldNote: string
}

const SAM_FORMULA_GUIDE_DICT: Record<SamCalcMode, SamFormulaGuide> = {
  DISCRETE: {
    formulaText: '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟',
    explanationLines: [
      '“数量”就是这批任务有多少件。',
      '“每单位工时”就是每 1 件通常需要多少分钟。',
      '“固定准备分钟”是开机、上料、准备动作要花的时间。',
      '“切换准备分钟”是换款、换模、换线、换版等额外花的时间。',
    ],
    exampleIntro:
      '如果一批任务有 1000 件，每 1 件需要 0.3 分钟，固定准备 20 分钟，切换准备 10 分钟，那么：',
    exampleResult: '总SAM = 1000 × 0.3 + 20 + 10 = 330 分钟',
    factoryFieldNote: '因为要知道单位工时和可投入资源，才能算出这家工厂一天能提供多少标准工时能力。',
  },
  CONTINUOUS: {
    formulaText: '总SAM = 总量 ÷ 每分钟速度 + 固定准备分钟 + 切换准备分钟',
    explanationLines: [
      '“总量”通常是总米数。',
      '“每分钟速度”就是设备或产线每分钟能做多少米。',
      '“固定准备分钟”是开机、调机、上料等准备时间。',
      '“切换准备分钟”是换版、换刀、换色等切换时间。',
    ],
    exampleIntro: '如果这批任务总共有 500 米，每分钟能做 5 米，固定准备 20 分钟，切换准备 10 分钟，那么：',
    exampleResult: '总SAM = 500 ÷ 5 + 20 + 10 = 130 分钟',
    factoryFieldNote: '因为要知道速度和可投入资源，才能把长度类产能换算成标准工时能力。',
  },
  BATCH: {
    formulaText: '总SAM = 批次数 × 每批循环分钟 + 固定准备分钟 + 切换准备分钟',
    explanationLines: [
      '“批次数”就是这批任务要分几批做。',
      '“每批循环分钟”就是做完 1 批通常需要多少分钟。',
      '“固定准备分钟”是开机、清缸、准备动作的时间。',
      '“切换准备分钟”是换批次、换配方、换色等切换时间。',
    ],
    exampleIntro: '如果这批任务要分 3 批做，每 1 批要 90 分钟，固定准备 20 分钟，切换准备 10 分钟，那么：',
    exampleResult: '总SAM = 3 × 90 + 20 + 10 = 300 分钟',
    factoryFieldNote: '因为要知道单批装载和循环时间，才能把批次型能力换算成标准工时能力。',
  },
}

export function getSamFormulaGuide(calcMode: SamCalcMode): SamFormulaGuide {
  return SAM_FORMULA_GUIDE_DICT[calcMode]
}
