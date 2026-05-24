import { listProjectPhaseContracts } from './pcs-project-domain-contract.ts';
const PHASE_DEFINITIONS = listProjectPhaseContracts().map((item) => ({
    phaseCode: item.phaseCode,
    phaseName: item.phaseName,
    phaseOrder: item.phaseOrder,
    description: item.description,
    defaultOpenFlag: item.defaultOpenFlag,
}));
const LEGACY_PHASE_NAME_MAP = {
    立项阶段: 'PHASE_01',
    立项获取: 'PHASE_01',
    打样阶段: 'PHASE_02',
    评估定价: 'PHASE_02',
    样衣与评估: 'PHASE_02',
    市场测款: 'PHASE_03',
    商品上架与市场测款: 'PHASE_03',
    测款阶段: 'PHASE_03',
    工程准备: 'PHASE_04',
    结论与推进: 'PHASE_04',
    开发推进: 'PHASE_04',
    款式档案与开发推进: 'PHASE_04',
    资产处置: 'PHASE_05',
    项目收尾: 'PHASE_05',
};
function normalizePhaseAlias(name) {
    return name.trim().replace(/^\d+\s*/, '').replace(/\s+/g, '');
}
export function listProjectPhaseDefinitions() {
    return PHASE_DEFINITIONS.map((item) => ({ ...item }));
}
export function getProjectPhaseDefinitionByCode(phaseCode) {
    const found = PHASE_DEFINITIONS.find((item) => item.phaseCode === phaseCode);
    return found ? { ...found } : null;
}
export function resolveProjectPhaseCodeFromLegacyName(name) {
    const normalized = normalizePhaseAlias(name);
    const matched = Object.entries(LEGACY_PHASE_NAME_MAP).find(([alias]) => normalizePhaseAlias(alias) === normalized);
    return matched?.[1] ?? null;
}
export function getProjectPhaseNameByCode(phaseCode) {
    return getProjectPhaseDefinitionByCode(phaseCode)?.phaseName ?? phaseCode;
}
