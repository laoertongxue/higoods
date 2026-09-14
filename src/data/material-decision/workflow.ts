import type { Runtime, Policy, Trial, RiskState, Assessment } from './model'
import { defaultPolicy, snapshot } from './fixtures'
import { validatePolicy } from './calculations'
export function initialRuntime(): Runtime { return { schema: 1, active: { ...defaultPolicy }, draft: { ...defaultPolicy, version: 2 }, trial: null, versions: [{ policy: { ...defaultPolicy }, at: '2026-09-14 09:00', action: '演示基线' }], risks: {}, decisions: [] } }
export function fingerprint(p: Policy): string { return JSON.stringify(p) }
export function editDraft(r: Runtime, draft: Policy): void { r.draft = { ...draft }; r.trial = null }
export function publishTrial(r: Runtime, role: string): void {
 if (role !== '规则批准人') throw new Error('当前角色无发布权限（本地演示）')
 const errors = validatePolicy(r.draft); if (errors.length) throw new Error(errors.join('；'))
 if (!r.trial || r.trial.fingerprint !== fingerprint(r.draft)) throw new Error('草稿已改变，请先重新试算')
 r.active = { ...r.draft, version: r.active.version + 1, snapshot }
 r.versions.push({ policy: { ...r.active }, at: new Date().toISOString(), action: '本地模拟发布' })
 r.draft = { ...r.active, version: r.active.version + 1 }; r.trial = null
}
export function compareTrial(before: Assessment[], after: Assessment[], policy: Policy): Trial { return { fingerprint: fingerprint(policy), rows: before.map((a,i) => ({ sku: a.material.sku, before: a.recommended, after: after[i].recommended, gapBefore: a.shortage, gapAfter: after[i].shortage })) } }
const transitions: Record<RiskState,RiskState[]> = { '待确认':['处理中','暂缓处理'], '处理中':['等待执行结果','待复核'], '等待执行结果':['处理中','待复核'], '待复核':['已解决','处理中'], '已解决':['待确认'], '暂缓处理':['待确认'] }
export function moveRisk(r: Runtime, sku: string, next: RiskState, reason: string, date: string, a: Assessment): void {
 const risk = r.risks[sku] ?? { status: '待确认' as const, owner: a.material.owner, reason: '', reviewDate: '', log: [] }
 if (!transitions[risk.status].includes(next)) throw new Error('不允许跨过处理和复核步骤')
 if (!reason.trim()) throw new Error('请填写处理依据')
 if (next === '暂缓处理' && (!date || date < new Date().toISOString().slice(0,10))) throw new Error('暂缓必须填写有效复查日期')
 if (next === '已解决' && (a.shortage > 0 || a.issues.length)) throw new Error('缺口或数据问题尚未解除，不能关闭客观风险')
 if (next === '等待执行结果' && !r.decisions.some(d => d.sku === sku && d.sourceNo)) throw new Error('先关联执行单号，再等待结果')
 risk.status = next; risk.reason = reason; risk.reviewDate = date; risk.log.push(`${new Date().toISOString()} ${next}：${reason}`); r.risks[sku] = risk
}
