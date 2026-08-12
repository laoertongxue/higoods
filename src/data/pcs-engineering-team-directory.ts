// PCS 生产工程原型的当前登录团队成员目录。
// 任务创建时只记录处理团队；成员只有在真实点击开始、提交或审核后才写入操作记录。

export interface EngineeringTeamOperator {
  operatorId: string
  operatorName: string
  teamName: string
}

const TEAM_OPERATORS: Record<string, EngineeringTeamOperator> = {
  版师: { operatorId: 'PCS-PATTERN-MAKER-ZHOU', operatorName: '周师傅', teamName: '版师' },
  毛织团队: { operatorId: 'PCS-KNIT-MAKER-AYU', operatorName: 'Ayu', teamName: '毛织团队' },
  制作团队: { operatorId: 'PCS-SAMPLE-MAKER-LINA', operatorName: 'Lina', teamName: '制作团队' },
  花型团队: { operatorId: 'PCS-ARTWORK-MAKER-CHEN', operatorName: '陈敏', teamName: '花型团队' },
  染厂: { operatorId: 'PCS-DYE-FACTORY-RUDI', operatorName: 'Rudi', teamName: '染厂' },
  采购人员: { operatorId: 'PCS-BUYER-PURCHASER-WANG', operatorName: '王丽', teamName: '采购人员' },
  跟单: { operatorId: 'PCS-MERCHANDISER-LIN', operatorName: '林晓', teamName: '跟单' },
  买手: { operatorId: 'PCS-BUYER-LE', operatorName: '阿乐', teamName: '买手' },
}

export function getEngineeringTeamCurrentOperator(teamName: string): EngineeringTeamOperator {
  const operator = TEAM_OPERATORS[teamName]
  if (!operator) throw new Error(`当前没有配置${teamName || '该'}团队的登录成员，不能推进任务。`)
  return { ...operator }
}

export function listEngineeringTeamOperators(): EngineeringTeamOperator[] {
  return Object.values(TEAM_OPERATORS).map((operator) => ({ ...operator }))
}
