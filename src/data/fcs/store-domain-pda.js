// =============================================
// PDA / 权限域 — 当前原型仓直接使用的数据域定义
// 无 React 依赖，供页面与数据模块直接引用
// =============================================
import { getBrowserLocalStorage, readBrowserStorageItem, removeBrowserStorageItem, writeBrowserStorageItem, } from '../browser-storage.ts';
import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts';
import { OWN_WOOL_FACTORY_ID, OWN_WOOL_FACTORY_NAME, TEST_FACTORY_ID, TEST_FACTORY_NAME, specialCraftDedicatedFactories, } from './factory-mock-data.ts';
import { indonesiaFactories } from './indonesia-factories';
export const allFactoryMobileAppPermissionKeys = [
    'TASK_ACCEPT',
    'TASK_REJECT',
    'QUOTE_SUBMIT',
    'QUOTE_VIEW',
    'TASK_START',
    'TASK_MILESTONE_REPORT',
    'TASK_FINISH',
    'TASK_BLOCK',
    'TASK_UNBLOCK',
    'CUTTING_PICKUP_CONFIRM',
    'CUTTING_PICKUP_LENGTH_DISPUTE',
    'CUTTING_SPREADING_SAVE',
    'CUTTING_REPLENISHMENT_FEEDBACK',
    'CUTTING_HANDOVER_CONFIRM',
    'CUTTING_INBOUND_CONFIRM',
    'PICKUP_CONFIRM',
    'PICKUP_QTY_DISPUTE',
    'HANDOUT_CREATE',
    'HANDOUT_QTY_DISPUTE',
    'QC_CONFIRM_DEDUCTION',
    'QC_DISPUTE',
    'SETTLEMENT_VIEW',
    'SETTLEMENT_CONFIRM',
    'SETTLEMENT_DISPUTE',
    'SETTLEMENT_CHANGE_REQUEST',
];
export const operatorFactoryMobileAppPermissionKeys = allFactoryMobileAppPermissionKeys.filter((permissionKey) => permissionKey !== 'TASK_ACCEPT' &&
    permissionKey !== 'TASK_REJECT' &&
    permissionKey !== 'QUOTE_SUBMIT' &&
    permissionKey !== 'QUOTE_VIEW' &&
    permissionKey !== 'SETTLEMENT_VIEW' &&
    permissionKey !== 'SETTLEMENT_CONFIRM' &&
    permissionKey !== 'SETTLEMENT_DISPUTE' &&
    permissionKey !== 'SETTLEMENT_CHANGE_REQUEST');
// =============================================
// 角色模板（固定少量）
// =============================================
export const defaultFactoryRoles = [
    {
        roleId: 'ROLE_ADMIN',
        roleName: '管理员',
        permissionKeys: [...allFactoryMobileAppPermissionKeys],
    },
    {
        roleId: 'ROLE_OPERATOR',
        roleName: '操作工',
        permissionKeys: [...operatorFactoryMobileAppPermissionKeys],
    },
];
export const DEFAULT_FACTORY_MOBILE_APP_ROLE_ID = 'ROLE_OPERATOR';
function buildFactoryMobileAppNamePrefix(factoryName) {
    return factoryName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('_');
}
// 旧版简单模型仍保留兼容，不参与工厂档案中的工厂端移动应用账号默认展示。
export function generateFactoryUsers(factories) {
    const users = [];
    const userTemplates = [
        { suffix: 'dispatch', name: '调度员', roleIds: ['ROLE_DISPATCH', 'ROLE_HANDOVER'] },
        { suffix: 'prod', name: '生产员', roleIds: ['ROLE_PRODUCTION'] },
        { suffix: 'qc', name: '质检员', roleIds: ['ROLE_QC'] },
    ];
    factories
        .filter((factory) => factory.status === 'ACTIVE')
        .forEach((factory) => {
        const namePrefix = buildFactoryMobileAppNamePrefix(factory.name);
        userTemplates.forEach((tpl) => {
            users.push({
                userId: `${factory.id}_${tpl.suffix}`,
                factoryId: factory.id,
                name: `${namePrefix}_${tpl.name}`,
                status: 'ACTIVE',
                roleIds: tpl.roleIds,
            });
        });
        users.push({
            userId: `${factory.id}_admin`,
            factoryId: factory.id,
            name: `${namePrefix}_管理员`,
            status: 'ACTIVE',
            roleIds: ['ROLE_ADMIN'],
        });
    });
    return users;
}
export const initialFactoryUsers = generateFactoryUsers(indonesiaFactories);
export const initialFactoryRoles = defaultFactoryRoles;
export const pdaRoleTemplates = [
    { roleId: 'ROLE_ADMIN', roleName: '管理员', permissionKeys: [...allFactoryMobileAppPermissionKeys] },
    { roleId: 'ROLE_OPERATOR', roleName: '操作工', permissionKeys: [...operatorFactoryMobileAppPermissionKeys] },
];
export const FACTORY_MOCK_PDA_PASSWORD = '123456';
const FACTORY_MOCK_PDA_PASSWORD_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
const LEGACY_DEFAULT_PDA_PASSWORD_HASH = FACTORY_MOCK_PDA_PASSWORD_HASH;
export function createFactoryPdaUsersForFactory(factoryId, factoryName, now = '2024-01-01 00:00:00') {
    const namePrefix = buildFactoryMobileAppNamePrefix(factoryName);
    return [
        {
            userId: `${factoryId}_operator`,
            factoryId,
            name: `${namePrefix}_操作工`,
            loginId: `${factoryId}_operator`,
            passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
            passwordUpdatedAt: now,
            status: 'ACTIVE',
            roleId: 'ROLE_OPERATOR',
            createdAt: now,
            createdBy: 'SYSTEM',
        },
        {
            userId: `${factoryId}_admin`,
            factoryId,
            name: `${namePrefix}_管理员`,
            loginId: `${factoryId}_admin`,
            passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
            passwordUpdatedAt: now,
            status: 'ACTIVE',
            roleId: 'ROLE_ADMIN',
            createdAt: now,
            createdBy: 'SYSTEM',
        },
    ];
}
export function generateFactoryPdaUsers(factories, now = '2024-01-01 00:00:00') {
    return factories
        .filter((factory) => factory.status === 'ACTIVE')
        .flatMap((factory) => createFactoryPdaUsersForFactory(factory.id, factory.name, now));
}
const fullCapabilityTestFactoryPdaUsers = createFactoryPdaUsersForFactory(TEST_FACTORY_ID, TEST_FACTORY_NAME);
const ownWoolFactoryPdaUsers = createFactoryPdaUsersForFactory(OWN_WOOL_FACTORY_ID, OWN_WOOL_FACTORY_NAME);
const specialCraftDedicatedFactoryPdaUsers = specialCraftDedicatedFactories.flatMap((factory) => createFactoryPdaUsersForFactory(factory.id, factory.name));
const onboardingOfficialFactoryPdaUsers = [34, 35, 36].map((seed) => {
    const factoryId = `FACTORY-ONBOARD-${String(seed).padStart(4, '0')}`;
    const now = '2026-05-09 16:00:00';
    return {
        userId: `PDAU-${factoryId}-ADMIN`,
        factoryId,
        name: `申请人${seed}`,
        loginId: `onboarding_${seed}`,
        passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
        passwordUpdatedAt: now,
        status: 'ACTIVE',
        roleId: 'ROLE_ADMIN',
        roleName: '工厂管理员',
        onboardingApplicationId: `FOA-${String(seed).padStart(4, '0')}`,
        convertedAt: now,
        isTemporary: false,
        createdAt: now,
        createdBy: '平台转档',
    };
});
export const initialFactoryPdaUsers = [
    ...generateFactoryPdaUsers(indonesiaFactories).filter((user) => user.factoryId !== TEST_FACTORY_ID),
    ...fullCapabilityTestFactoryPdaUsers,
    ...ownWoolFactoryPdaUsers,
    ...specialCraftDedicatedFactoryPdaUsers,
    ...onboardingOfficialFactoryPdaUsers,
];
const initialFactoryPdaUserIds = new Set(initialFactoryPdaUsers.map((user) => user.userId));
const initialFactoryPdaLoginIds = new Set(initialFactoryPdaUsers.map((user) => normalizePdaLoginId(user.loginId)));
function isInitialFactoryPdaUser(user) {
    return initialFactoryPdaUserIds.has(user.userId) || initialFactoryPdaLoginIds.has(normalizePdaLoginId(user.loginId));
}
function normalizeInitialFactoryPdaPassword(user, now) {
    if (!isInitialFactoryPdaUser(user))
        return user;
    if (user.passwordHash === FACTORY_MOCK_PDA_PASSWORD_HASH)
        return user;
    return {
        ...user,
        passwordHash: FACTORY_MOCK_PDA_PASSWORD_HASH,
        passwordUpdatedAt: user.passwordUpdatedAt || now,
    };
}
export const permissionCatalog = [
    { key: 'TASK_ACCEPT', nameZh: '接受任务', group: '接单', descriptionZh: '允许在工厂端移动应用中接受分配的生产任务。' },
    { key: 'TASK_REJECT', nameZh: '拒绝接单', group: '接单', descriptionZh: '允许在工厂端移动应用中拒绝不合适的生产任务。' },
    { key: 'QUOTE_SUBMIT', nameZh: '提交报价', group: '报价', descriptionZh: '允许对待报价招标单提交报价。' },
    { key: 'QUOTE_VIEW', nameZh: '查看报价结果', group: '报价', descriptionZh: '允许查看已报价、已中标等报价结果。' },
    { key: 'TASK_START', nameZh: '开工', group: '执行', descriptionZh: '允许在执行模块中将任务推进为生产中。' },
    { key: 'TASK_MILESTONE_REPORT', nameZh: '关键节点上报', group: '执行', descriptionZh: '允许在执行模块中上报关键节点。' },
    { key: 'TASK_BLOCK', nameZh: '生产暂停上报', group: '执行', descriptionZh: '允许上报生产暂停并填写原因。' },
    { key: 'TASK_UNBLOCK', nameZh: '恢复执行', group: '执行', descriptionZh: '允许解除生产暂停并填写处理说明。' },
    { key: 'TASK_FINISH', nameZh: '完工', group: '执行', descriptionZh: '允许在执行模块中提交完工。' },
    { key: 'CUTTING_PICKUP_CONFIRM', nameZh: '确认领料', group: '裁片执行', descriptionZh: '允许在裁片执行中确认领料结果。' },
    { key: 'CUTTING_PICKUP_LENGTH_DISPUTE', nameZh: '提交领料长度异议', group: '裁片执行', descriptionZh: '允许在裁片执行中提交领料长度异议。' },
    { key: 'CUTTING_SPREADING_SAVE', nameZh: '保存铺布记录', group: '裁片执行', descriptionZh: '允许在裁片执行中保存铺布记录。' },
    { key: 'CUTTING_REPLENISHMENT_FEEDBACK', nameZh: '提交补料反馈', group: '裁片执行', descriptionZh: '允许在裁片执行中提交补料反馈。' },
    { key: 'CUTTING_HANDOVER_CONFIRM', nameZh: '确认交接', group: '裁片执行', descriptionZh: '允许在裁片执行中确认裁片交接。' },
    { key: 'CUTTING_INBOUND_CONFIRM', nameZh: '确认入仓', group: '裁片执行', descriptionZh: '允许在裁片执行中确认入仓。' },
    { key: 'PICKUP_CONFIRM', nameZh: '领料确认', group: '交接', descriptionZh: '允许在交接模块中确认仓库回写的领料记录。' },
    { key: 'PICKUP_QTY_DISPUTE', nameZh: '提交领料对象数量异议', group: '交接', descriptionZh: '允许在交接模块中对领料对象数量发起异议。' },
    { key: 'HANDOUT_CREATE', nameZh: '新增交出记录', group: '交接', descriptionZh: '允许在交接模块中新增交出记录。' },
    { key: 'HANDOUT_QTY_DISPUTE', nameZh: '提交交出对象数量异议', group: '交接', descriptionZh: '允许在交接模块中对交出对象数量发起异议。' },
    { key: 'QC_CONFIRM_DEDUCTION', nameZh: '确认处理质量扣款', group: '质检', descriptionZh: '允许确认质量扣款处理结果。' },
    { key: 'QC_DISPUTE', nameZh: '发起质检异议', group: '质检', descriptionZh: '允许对质量扣款或责任判定发起异议。' },
    { key: 'SETTLEMENT_VIEW', nameZh: '查看结算', group: '结算', descriptionZh: '允许查看结算单与结算资料。' },
    { key: 'SETTLEMENT_CONFIRM', nameZh: '确认对账单', group: '结算', descriptionZh: '允许确认对账单金额。' },
    { key: 'SETTLEMENT_DISPUTE', nameZh: '发起对账单异议', group: '结算', descriptionZh: '允许对对账单发起异议。' },
    { key: 'SETTLEMENT_CHANGE_REQUEST', nameZh: '申请修改结算资料', group: '结算', descriptionZh: '允许提交结算资料调整申请。' },
];
const PRESET_ROLE_PERMISSIONS = {
    ROLE_ADMIN: [...allFactoryMobileAppPermissionKeys],
    ROLE_OPERATOR: [...operatorFactoryMobileAppPermissionKeys],
};
const PRESET_ROLE_NAMES = {
    ROLE_ADMIN: '管理员',
    ROLE_OPERATOR: '操作工',
};
const LEGACY_COMPAT_ROLE_NAMES = {
    ROLE_DISPATCH: '调度员',
    ROLE_PRODUCTION: '生产员',
    ROLE_HANDOVER: '交接员',
    ROLE_QC: '质检员',
    ROLE_FINANCE: '财务',
    ROLE_VIEWER: '只读',
};
export function getFactoryMobileAppRoleName(roleId) {
    return PRESET_ROLE_NAMES[roleId] || LEGACY_COMPAT_ROLE_NAMES[roleId] || roleId;
}
export function generatePresetRolesForFactory(factoryId, now) {
    return Object.keys(PRESET_ROLE_PERMISSIONS).map((roleId) => ({
        roleId,
        factoryId,
        roleName: PRESET_ROLE_NAMES[roleId],
        status: 'ACTIVE',
        permissionKeys: PRESET_ROLE_PERMISSIONS[roleId],
        isSystemPreset: true,
        createdAt: now,
        createdBy: 'SYSTEM',
        auditLogs: [],
    }));
}
const INIT_NOW = '2024-01-01 00:00:00';
export const initialFactoryPdaRoles = [
    ...indonesiaFactories
        .filter((factory) => factory.status === 'ACTIVE' && factory.id !== TEST_FACTORY_ID)
        .flatMap((factory) => generatePresetRolesForFactory(factory.id, INIT_NOW)),
    ...generatePresetRolesForFactory(TEST_FACTORY_ID, INIT_NOW),
    ...generatePresetRolesForFactory(OWN_WOOL_FACTORY_ID, INIT_NOW),
    ...specialCraftDedicatedFactories.flatMap((factory) => generatePresetRolesForFactory(factory.id, INIT_NOW)),
    ...[34, 35, 36].flatMap((seed) => generatePresetRolesForFactory(`FACTORY-ONBOARD-${String(seed).padStart(4, '0')}`, '2026-05-09 16:00:00')),
];
// =============================================
// 本地持久化 PDA 用户 / 角色 / 会话
// =============================================
const PDA_USER_STORE_KEY = 'fcs_pda_user_store_v1';
const PDA_ROLE_STORE_KEY = 'fcs_pda_role_store_v1';
const PDA_SESSION_KEY = 'fcs_pda_session';
let cachedPdaUsers = null;
let cachedPdaRoles = null;
function clonePermissionKeys(permissionKeys) {
    return [...permissionKeys];
}
function clonePdaUser(user) {
    return {
        ...user,
    };
}
function clonePdaRole(role) {
    return {
        ...role,
        permissionKeys: clonePermissionKeys(role.permissionKeys),
        auditLogs: role.auditLogs.map((item) => ({ ...item })),
    };
}
function clonePdaSession(session) {
    return {
        ...session,
    };
}
function getStorage() {
    const storage = getBrowserLocalStorage();
    if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
        return null;
    }
    return storage;
}
export function normalizePdaLoginId(loginId) {
    return loginId.trim().toLowerCase();
}
export function normalizePdaPassword(password) {
    return password.trim();
}
function getPdaSubtleCrypto() {
    if (globalThis.crypto?.subtle)
        return globalThis.crypto.subtle;
    throw new Error('当前环境不支持密码摘要。');
}
export async function hashPdaPassword(rawPassword) {
    const normalizedPassword = normalizePdaPassword(rawPassword);
    const digest = await getPdaSubtleCrypto().digest('SHA-256', new TextEncoder().encode(normalizedPassword));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}
export async function verifyPdaPassword(rawPassword, passwordHash) {
    const normalizedHash = String(passwordHash || '').trim().toLowerCase();
    if (!normalizedHash)
        return false;
    const nextHash = await hashPdaPassword(rawPassword);
    return nextHash === normalizedHash;
}
function readStoredJson(key) {
    const raw = readBrowserStorageItem(getStorage(), key);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeStoredJson(key, value) {
    writeBrowserStorageItem(getStorage(), key, JSON.stringify(value));
}
function normalizeStoredPdaUser(input) {
    const userId = String(input.userId || '').trim();
    const factoryId = String(input.factoryId || '').trim();
    const loginId = String(input.loginId || '').trim();
    const name = String(input.name || '').trim();
    const roleId = String(input.roleId || '').trim();
    const createdAt = String(input.createdAt || '').trim();
    const createdBy = String(input.createdBy || '').trim();
    if (!userId || !factoryId || !loginId || !name || !roleId || !createdAt || !createdBy) {
        return null;
    }
    return {
        userId,
        factoryId,
        loginId,
        passwordHash: String(input.passwordHash || '').trim().toLowerCase(),
        passwordUpdatedAt: input.passwordUpdatedAt?.trim() || undefined,
        name,
        roleId: roleId,
        roleName: input.roleName?.trim() || undefined,
        onboardingApplicationId: input.onboardingApplicationId?.trim() || undefined,
        convertedAt: input.convertedAt?.trim() || undefined,
        isTemporary: typeof input.isTemporary === 'boolean' ? input.isTemporary : undefined,
        status: input.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
        createdAt,
        createdBy,
        updatedAt: input.updatedAt?.trim() || undefined,
        updatedBy: input.updatedBy?.trim() || undefined,
    };
}
function normalizeStoredPdaRole(input) {
    const roleId = String(input.roleId || '').trim();
    const factoryId = String(input.factoryId || '').trim();
    const roleName = String(input.roleName || '').trim();
    const createdAt = String(input.createdAt || '').trim();
    const createdBy = String(input.createdBy || '').trim();
    if (!roleId || !factoryId || !roleName || !createdAt || !createdBy) {
        return null;
    }
    return {
        roleId,
        factoryId,
        roleName,
        status: input.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
        permissionKeys: clonePermissionKeys((input.permissionKeys ?? [])),
        isSystemPreset: Boolean(input.isSystemPreset),
        createdAt,
        createdBy,
        updatedAt: input.updatedAt?.trim() || undefined,
        updatedBy: input.updatedBy?.trim() || undefined,
        auditLogs: Array.isArray(input.auditLogs) ? input.auditLogs.map((item) => ({ ...item })) : [],
    };
}
function ensurePdaUserStore() {
    if (cachedPdaUsers)
        return cachedPdaUsers;
    const stored = readStoredJson(PDA_USER_STORE_KEY);
    if (Array.isArray(stored) && stored.length > 0) {
        const now = nowTimestamp();
        let needsMigration = false;
        cachedPdaUsers = stored
            .map((item) => normalizeStoredPdaUser(item))
            .filter((item) => Boolean(item))
            .map((item) => {
            const withPasswordHash = item.passwordHash
                ? item
                : {
                    ...item,
                    passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
                    passwordUpdatedAt: item.passwordUpdatedAt || now,
                };
            const normalized = normalizeInitialFactoryPdaPassword(withPasswordHash, now);
            if (normalized !== item)
                needsMigration = true;
            return normalized;
        });
        const userIds = new Set(cachedPdaUsers.map((item) => item.userId));
        const missingSeedUsers = initialFactoryPdaUsers.filter((item) => !userIds.has(item.userId)).map(clonePdaUser);
        if (missingSeedUsers.length > 0) {
            cachedPdaUsers = [...cachedPdaUsers, ...missingSeedUsers];
            needsMigration = true;
        }
        if (needsMigration) {
            writeStoredJson(PDA_USER_STORE_KEY, cachedPdaUsers);
        }
        return cachedPdaUsers;
    }
    cachedPdaUsers = initialFactoryPdaUsers.map((item) => normalizeInitialFactoryPdaPassword(clonePdaUser(item), nowTimestamp()));
    writeStoredJson(PDA_USER_STORE_KEY, cachedPdaUsers);
    return cachedPdaUsers;
}
function ensurePdaRoleStore() {
    if (cachedPdaRoles)
        return cachedPdaRoles;
    const stored = readStoredJson(PDA_ROLE_STORE_KEY);
    if (Array.isArray(stored) && stored.length > 0) {
        cachedPdaRoles = stored
            .map((item) => normalizeStoredPdaRole(item))
            .filter((item) => Boolean(item));
        const roleKeys = new Set(cachedPdaRoles.map((item) => `${item.factoryId}:${item.roleId}`));
        const missingSeedRoles = initialFactoryPdaRoles.filter((item) => !roleKeys.has(`${item.factoryId}:${item.roleId}`)).map(clonePdaRole);
        if (missingSeedRoles.length > 0) {
            cachedPdaRoles = [...cachedPdaRoles, ...missingSeedRoles];
            writeStoredJson(PDA_ROLE_STORE_KEY, cachedPdaRoles);
        }
        return cachedPdaRoles;
    }
    cachedPdaRoles = initialFactoryPdaRoles.map(clonePdaRole);
    writeStoredJson(PDA_ROLE_STORE_KEY, cachedPdaRoles);
    return cachedPdaRoles;
}
function persistPdaUsers(users) {
    cachedPdaUsers = users.map(clonePdaUser);
    writeStoredJson(PDA_USER_STORE_KEY, cachedPdaUsers);
}
function persistPdaRoles(roles) {
    cachedPdaRoles = roles.map(clonePdaRole);
    writeStoredJson(PDA_ROLE_STORE_KEY, cachedPdaRoles);
}
function nowTimestamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
function getFactoryName(factoryId) {
    const runtimeFactory = getFactoryMasterRecordById(factoryId);
    if (runtimeFactory)
        return runtimeFactory.name;
    const seedFactory = indonesiaFactories.find((item) => item.id === factoryId);
    return seedFactory?.name ?? factoryId;
}
function isRuntimeFactoryExisting(factoryId) {
    return listFactoryMasterRecords().some((factory) => factory.id === factoryId);
}
function normalizeSession(session) {
    if (!session)
        return null;
    const userId = String(session.userId || '').trim();
    const loginId = String(session.loginId || '').trim();
    const userName = String(session.userName || '').trim();
    const roleId = String(session.roleId || '').trim();
    const factoryId = String(session.factoryId || '').trim();
    const factoryName = String(session.factoryName || '').trim();
    const loggedAt = String(session.loggedAt || '').trim();
    if (!userId || !loginId || !userName || !roleId || !factoryId || !factoryName || !loggedAt)
        return null;
    return {
        userId,
        loginId,
        userName,
        roleId,
        factoryId,
        factoryName,
        loggedAt,
    };
}
export function createPdaSessionFromUser(user) {
    return {
        userId: user.userId,
        loginId: user.loginId,
        userName: user.name,
        roleId: user.roleId,
        factoryId: user.factoryId,
        factoryName: getFactoryName(user.factoryId),
        loggedAt: nowTimestamp(),
    };
}
export function listAllFactoryPdaUsers() {
    return ensurePdaUserStore().map(clonePdaUser);
}
export function listFactoryPdaUsers(factoryId) {
    return ensurePdaUserStore()
        .filter((item) => item.factoryId === factoryId)
        .map(clonePdaUser);
}
export function listAllFactoryPdaRoles() {
    return ensurePdaRoleStore().map(clonePdaRole);
}
export function listFactoryPdaRoles(factoryId) {
    return ensurePdaRoleStore()
        .filter((item) => item.factoryId === factoryId)
        .map(clonePdaRole);
}
export function findFactoryPdaRoleById(roleId, factoryId) {
    return (ensurePdaRoleStore().find((item) => item.roleId === roleId && (!factoryId || item.factoryId === factoryId)) ?? null);
}
export function replaceFactoryPdaRoles(factoryId, roles) {
    const current = ensurePdaRoleStore().filter((item) => item.factoryId !== factoryId);
    persistPdaRoles([...current, ...roles.map(clonePdaRole)]);
}
export function findFactoryPdaUserByLoginId(loginId) {
    const normalizedLoginId = normalizePdaLoginId(loginId);
    if (!normalizedLoginId)
        return null;
    return (ensurePdaUserStore().find((item) => normalizePdaLoginId(item.loginId) === normalizedLoginId) ?? null);
}
export function getFactoryPdaUserById(userId) {
    return ensurePdaUserStore().find((item) => item.userId === userId) ?? null;
}
function validateGlobalUniqueLoginId(loginId, excludeUserId) {
    const normalizedLoginId = normalizePdaLoginId(loginId);
    const duplicated = ensurePdaUserStore().some((item) => item.userId !== excludeUserId && normalizePdaLoginId(item.loginId) === normalizedLoginId);
    if (duplicated) {
        throw new Error('登录账户已存在，必须在所有工厂中唯一');
    }
}
export async function createFactoryPdaUser(input) {
    const factoryId = input.factoryId.trim();
    const name = input.name.trim();
    const loginId = input.loginId.trim();
    const password = normalizePdaPassword(input.password);
    const roleId = input.roleId.trim();
    if (!factoryId || !name || !loginId || !password || !roleId) {
        throw new Error('新增账号需要填写姓名和登录账户。');
    }
    validateGlobalUniqueLoginId(loginId);
    const passwordHash = await hashPdaPassword(password);
    const now = nowTimestamp();
    const user = {
        userId: `PDAU-${Date.now()}`,
        factoryId,
        name,
        loginId,
        passwordHash,
        passwordUpdatedAt: now,
        status: 'ACTIVE',
        roleId: roleId,
        createdAt: now,
        createdBy: input.createdBy?.trim() || 'ADMIN',
    };
    persistPdaUsers([user, ...ensurePdaUserStore()]);
    return clonePdaUser(user);
}
export async function resetFactoryPdaUserPassword(userId, rawPassword, updatedBy = 'ADMIN') {
    const current = getFactoryPdaUserById(userId);
    if (!current)
        return null;
    const password = normalizePdaPassword(rawPassword);
    if (!password) {
        throw new Error('请输入登录密码');
    }
    const passwordHash = await hashPdaPassword(password);
    const updated = {
        ...current,
        passwordHash,
        passwordUpdatedAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
        updatedBy,
    };
    persistPdaUsers(ensurePdaUserStore().map((item) => (item.userId === current.userId ? updated : item)));
    const session = getPdaSession();
    if (session && session.userId === current.userId) {
        setPdaSession(createPdaSessionFromUser(updated));
    }
    return clonePdaUser(updated);
}
export function updateFactoryPdaUser(userId, patch) {
    const current = getFactoryPdaUserById(userId);
    if (!current)
        return null;
    const nextLoginId = patch.loginId !== undefined ? String(patch.loginId).trim() : current.loginId;
    if (!nextLoginId) {
        throw new Error('登录账户不能为空。');
    }
    validateGlobalUniqueLoginId(nextLoginId, current.userId);
    const updated = {
        ...current,
        name: patch.name !== undefined ? String(patch.name).trim() || current.name : current.name,
        loginId: nextLoginId,
        status: patch.status === 'LOCKED' ? 'LOCKED' : patch.status === 'ACTIVE' ? 'ACTIVE' : current.status,
        roleId: patch.roleId ? patch.roleId : current.roleId,
        updatedAt: nowTimestamp(),
        updatedBy: patch.updatedBy?.trim() || 'ADMIN',
    };
    persistPdaUsers(ensurePdaUserStore().map((item) => (item.userId === current.userId ? updated : item)));
    const session = getPdaSession();
    if (session && session.userId === current.userId) {
        setPdaSession(createPdaSessionFromUser(updated));
    }
    return clonePdaUser(updated);
}
export function toggleFactoryPdaUserLock(userId, updatedBy = 'ADMIN') {
    const current = getFactoryPdaUserById(userId);
    if (!current)
        return null;
    const nextStatus = current.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    return updateFactoryPdaUser(userId, {
        status: nextStatus,
        updatedBy,
    });
}
export function setFactoryPdaUserRole(userId, roleId, updatedBy = 'ADMIN') {
    return updateFactoryPdaUser(userId, {
        roleId,
        updatedBy,
    });
}
export function ensureFactoryPdaSeed(factoryId, factoryName) {
    const users = ensurePdaUserStore();
    const roles = ensurePdaRoleStore();
    const nextUsers = users.some((item) => item.factoryId === factoryId)
        ? users
        : [...users, ...createFactoryPdaUsersForFactory(factoryId, factoryName, nowTimestamp())];
    const nextRoles = roles.some((item) => item.factoryId === factoryId)
        ? roles
        : [...roles, ...generatePresetRolesForFactory(factoryId, nowTimestamp())];
    if (nextUsers !== users)
        persistPdaUsers(nextUsers);
    if (nextRoles !== roles)
        persistPdaRoles(nextRoles);
}
export async function upsertOfficialFactoryAdminFromOnboarding(input) {
    const loginId = input.loginId.trim();
    const adminName = input.adminName.trim();
    const rawPassword = normalizePdaPassword(input.password);
    if (!loginId || !adminName || !input.createdFactory.id) {
        throw new Error('当前申请缺少管理员账号，不能转正式。');
    }
    const now = input.convertedAt || nowTimestamp();
    const roles = ensurePdaRoleStore();
    const existingRoleKeys = new Set(roles.map((role) => `${role.factoryId}:${role.roleId}`));
    const missingRoles = generatePresetRolesForFactory(input.createdFactory.id, now)
        .filter((role) => !existingRoleKeys.has(`${role.factoryId}:${role.roleId}`));
    if (missingRoles.length > 0) {
        persistPdaRoles([...roles, ...missingRoles]);
    }
    const users = ensurePdaUserStore();
    const existingByLogin = users.find((user) => normalizePdaLoginId(user.loginId) === normalizePdaLoginId(loginId));
    const passwordHash = existingByLogin?.passwordHash || await hashPdaPassword(rawPassword || '123456');
    const userId = existingByLogin?.userId || `PDAU-${input.createdFactory.id}-ADMIN`;
    const officialUser = {
        ...(existingByLogin || {
            createdAt: now,
            createdBy: input.updatedBy?.trim() || '平台转档',
        }),
        userId,
        factoryId: input.createdFactory.id,
        name: adminName,
        loginId,
        passwordHash,
        passwordUpdatedAt: existingByLogin?.passwordUpdatedAt || now,
        status: 'ACTIVE',
        roleId: 'ROLE_ADMIN',
        roleName: '工厂管理员',
        onboardingApplicationId: input.applicationId,
        convertedAt: now,
        isTemporary: false,
        updatedAt: now,
        updatedBy: input.updatedBy?.trim() || '平台转档',
    };
    const withoutCurrent = users.filter((user) => user.userId !== userId);
    persistPdaUsers([officialUser, ...withoutCurrent]);
    return clonePdaUser(officialUser);
}
export function removeFactoryPdaDataByFactory(factoryId) {
    persistPdaUsers(ensurePdaUserStore().filter((item) => item.factoryId !== factoryId));
    persistPdaRoles(ensurePdaRoleStore().filter((item) => item.factoryId !== factoryId));
    const session = getPdaSession();
    if (session?.factoryId === factoryId) {
        clearPdaSession();
    }
}
function readRawPdaSession() {
    return normalizeSession(readStoredJson(PDA_SESSION_KEY));
}
export function getPdaSession() {
    const session = readRawPdaSession();
    if (!session)
        return null;
    const user = getFactoryPdaUserById(session.userId);
    if (!user) {
        clearPdaSession();
        return null;
    }
    if (user.status === 'LOCKED') {
        clearPdaSession();
        return null;
    }
    if (!isRuntimeFactoryExisting(user.factoryId)) {
        clearPdaSession();
        return null;
    }
    return {
        ...session,
        loginId: user.loginId,
        userName: user.name,
        roleId: user.roleId,
        factoryId: user.factoryId,
        factoryName: getFactoryName(user.factoryId),
    };
}
export function setPdaSession(session) {
    if (!session) {
        clearPdaSession();
        return;
    }
    writeStoredJson(PDA_SESSION_KEY, clonePdaSession(session));
}
export function clearPdaSession() {
    removeBrowserStorageItem(getStorage(), PDA_SESSION_KEY);
}
export function getCurrentPdaFactoryId() {
    return getPdaSession()?.factoryId ?? null;
}
export function getCurrentPdaUser() {
    const session = getPdaSession();
    if (!session)
        return null;
    return getFactoryPdaUserById(session.userId);
}
export function authenticateFactoryPdaUserByLoginId(loginId) {
    const user = findFactoryPdaUserByLoginId(loginId);
    if (!user) {
        return {
            user: null,
            error: 'NOT_FOUND',
        };
    }
    if (user.status === 'LOCKED') {
        return {
            user,
            error: 'LOCKED',
        };
    }
    return {
        user,
        error: '',
    };
}
export async function authenticateFactoryPdaUserByCredentials(loginId, rawPassword) {
    const loginResult = authenticateFactoryPdaUserByLoginId(loginId);
    if (!loginResult.user || loginResult.error) {
        return {
            user: loginResult.user,
            error: loginResult.error || 'NOT_FOUND',
        };
    }
    const passwordValid = await verifyPdaPassword(rawPassword, loginResult.user.passwordHash);
    if (!passwordValid) {
        return {
            user: null,
            error: 'INVALID_CREDENTIALS',
        };
    }
    return {
        user: loginResult.user,
        error: '',
    };
}
