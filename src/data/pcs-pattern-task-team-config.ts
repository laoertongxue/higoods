import type { PatternTaskTeamCode } from './pcs-pattern-task-types.ts'

export interface PatternTaskTeamOption {
  teamCode: PatternTaskTeamCode
  teamName: string
}

export interface PatternTaskMemberOption {
  memberId: string
  memberName: string
  teamCode: PatternTaskTeamCode
}

export const PATTERN_TASK_TEAMS: PatternTaskTeamOption[] = [
  { teamCode: 'CN_TEAM', teamName: '中国团队' },
  { teamCode: 'BDG_TEAM', teamName: '万隆团队' },
  { teamCode: 'JKT_TEAM', teamName: '雅加达团队' },
]

export const PATTERN_TASK_MEMBERS: PatternTaskMemberOption[] = [
  { teamCode: 'CN_TEAM', memberId: 'cn_bing_bing', memberName: 'bing bing' },
  { teamCode: 'CN_TEAM', memberId: 'cn_dandan', memberName: '单单' },
  { teamCode: 'CN_TEAM', memberId: 'cn_guanhao', memberName: '关浩' },
  { teamCode: 'BDG_TEAM', memberId: 'bdg_ramzi_adli', memberName: 'ramzi adli' },
  { teamCode: 'BDG_TEAM', memberId: 'bdg_micin', memberName: 'micin' },
  { teamCode: 'BDG_TEAM', memberId: 'bdg_irfan', memberName: 'Irfan' },
  { teamCode: 'BDG_TEAM', memberId: 'bdg_usman', memberName: 'Usman' },
  { teamCode: 'BDG_TEAM', memberId: 'bdg_zaenal_abidin', memberName: 'zaenal Abidin' },
  { teamCode: 'JKT_TEAM', memberId: 'jkt_bandung', memberName: 'Bandung' },
]

export function getPatternTaskTeamName(teamCode: string): string {
  return PATTERN_TASK_TEAMS.find((item) => item.teamCode === teamCode)?.teamName || ''
}

export function listPatternTaskMembersByTeam(teamCode: string): PatternTaskMemberOption[] {
  return PATTERN_TASK_MEMBERS.filter((item) => item.teamCode === teamCode)
}

export function getPatternTaskMember(teamCode: string, memberId: string): PatternTaskMemberOption | null {
  return listPatternTaskMembersByTeam(teamCode).find((item) => item.memberId === memberId) || null
}

export function assertPatternTaskMemberInTeam(teamCode: string, memberId: string): void {
  if (!teamCode) throw new Error('请先选择团队。')
  if (!memberId) throw new Error('请先选择花型师。')
  if (!getPatternTaskMember(teamCode, memberId)) {
    throw new Error('花型师必须来自所选团队。')
  }
}
