import { menusBySystem, systems } from '../data/app-shell-config.ts';
const TABS_STORAGE_KEY = 'higood-tabs';
const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';
const LEGACY_DISPATCH_EXCEPTIONS_KEY = 'dispatch-exceptions';
const LEGACY_DISPATCH_EXCEPTIONS_PATH = '/fcs/dispatch/exceptions';
const UNIFIED_PROGRESS_EXCEPTIONS_KEY = 'progress-exceptions';
const UNIFIED_PROGRESS_EXCEPTIONS_PATH = '/fcs/progress/exceptions';
const UNIFIED_PROGRESS_EXCEPTIONS_TITLE = '异常定位与处理';
const PCS_TAB_REDIRECTS = {
    '/pcs/channels/products': { href: '/pcs/products/channel-products', title: '渠道店铺商品' },
    '/pcs/channels/products/mapping': { href: '/pcs/products/channel-attributes', title: '渠道属性对应' },
    '/pcs/channels/products/store': { href: '/pcs/products/channel-products/store', title: '渠道店铺商品店铺视图' },
    '/pcs/products/spu': { href: '/pcs/products/styles', title: '款式档案' },
    '/pcs/products/sku': { href: '/pcs/products/specifications', title: '规格档案' },
    '/pcs/products/yarn': { href: '/pcs/materials/yarn', title: '纱线档案' },
};
const CUTTING_TAB_REDIRECTS = {
    '/fcs/craft/cutting': { href: '/fcs/craft/cutting/production-progress', title: '生产单进度' },
};
const REMOVED_CUTTING_TAB_PATHS = new Set([
    '/fcs/craft/cutting/settlement-scoring',
    '/fcs/settlement/cutting-input',
]);
const REMOVED_FCS_TAB_KEYS = new Set(['workbench-risks', 'process-dependencies', 'process-qc-standards']);
const REMOVED_FCS_TAB_PATHS = new Set(['/fcs/workbench/risks', '/fcs/process/dependencies', '/fcs/process/qc-standards']);
const PFOS_ROUTE_PREFIXES = ['/fcs/craft', '/fcs/process-factory/special-craft'];
function createEmptyTabs() {
    const tabs = {};
    for (const system of systems) {
        tabs[system.id] = {
            systemId: system.id,
            tabs: [],
            activeKey: '',
        };
    }
    return tabs;
}
function getStoredTabs() {
    const emptyTabs = createEmptyTabs();
    try {
        const raw = localStorage.getItem(TABS_STORAGE_KEY);
        if (!raw)
            return emptyTabs;
        const parsed = JSON.parse(raw);
        for (const system of systems) {
            if (!parsed[system.id]) {
                parsed[system.id] = emptyTabs[system.id];
            }
        }
        const migrated = pruneRemovedPfosTabs(migrateCraftTabsToPfos(migratePcsTabs(pruneRemovedFcsTabs(migrateFcsTabTitles(migrateCuttingTabs(migrateLegacyDispatchExceptionsTabs(parsed)))))));
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
    }
    catch {
        return emptyTabs;
    }
}
function migratePcsTabs(allTabs) {
    const pcsTabs = allTabs.pcs;
    if (!pcsTabs)
        return allTabs;
    let changed = false;
    const nextTabs = pcsTabs.tabs.map((tab) => {
        const normalizedHref = normalizePathname(tab.href);
        const migration = PCS_TAB_REDIRECTS[normalizedHref];
        const canonicalHref = migration?.href ?? normalizedHref;
        const canonicalItem = findMenuItemByPath(canonicalHref);
        const nextTitle = migration?.title ?? canonicalItem?.title ?? tab.title;
        const nextKey = canonicalItem?.key ?? tab.key;
        if (canonicalHref === tab.href && nextTitle === tab.title && nextKey === tab.key) {
            return tab;
        }
        changed = true;
        return {
            ...tab,
            key: nextKey,
            title: nextTitle,
            href: canonicalHref,
        };
    });
    const activeTab = pcsTabs.tabs.find((tab) => tab.key === pcsTabs.activeKey);
    let nextActiveKey = pcsTabs.activeKey;
    if (activeTab) {
        const normalizedHref = normalizePathname(activeTab.href);
        const migration = PCS_TAB_REDIRECTS[normalizedHref];
        const canonicalHref = migration?.href ?? normalizedHref;
        const canonicalItem = findMenuItemByPath(canonicalHref);
        if (canonicalItem?.key && canonicalItem.key !== nextActiveKey) {
            nextActiveKey = canonicalItem.key;
            changed = true;
        }
    }
    if (!changed)
        return allTabs;
    return {
        ...allTabs,
        pcs: {
            ...pcsTabs,
            tabs: nextTabs,
            activeKey: nextActiveKey,
        },
    };
}
function pruneRemovedFcsTabs(allTabs) {
    const fcsTabs = allTabs.fcs;
    if (!fcsTabs)
        return allTabs;
    const nextTabs = fcsTabs.tabs.filter((tab) => !REMOVED_FCS_TAB_KEYS.has(tab.key) &&
        !REMOVED_FCS_TAB_PATHS.has(tab.href) &&
        !isRemovedCuttingGroupTab(tab));
    const nextActiveKey = nextTabs.some((tab) => tab.key === fcsTabs.activeKey) ? fcsTabs.activeKey : '';
    if (nextTabs.length === fcsTabs.tabs.length && nextActiveKey === fcsTabs.activeKey) {
        return allTabs;
    }
    return {
        ...allTabs,
        fcs: {
            ...fcsTabs,
            tabs: nextTabs,
            activeKey: nextActiveKey,
        },
    };
}
function pruneRemovedPfosTabs(allTabs) {
    const pfosTabs = allTabs.pfos;
    if (!pfosTabs)
        return allTabs;
    const nextTabs = pfosTabs.tabs.filter((tab) => !isRemovedCuttingGroupTab(tab));
    const nextActiveKey = nextTabs.some((tab) => tab.key === pfosTabs.activeKey)
        ? pfosTabs.activeKey
        : (nextTabs[0]?.key ?? '');
    if (nextTabs.length === pfosTabs.tabs.length && nextActiveKey === pfosTabs.activeKey) {
        return allTabs;
    }
    return {
        ...allTabs,
        pfos: {
            ...pfosTabs,
            tabs: nextTabs,
            activeKey: nextActiveKey,
        },
    };
}
function isRemovedCuttingGroupTab(tab) {
    const normalizedHref = normalizePathname(tab.href);
    return isUnknownCuttingTabPath(normalizedHref);
}
function isUnknownCuttingTabPath(pathname) {
    return (pathname.startsWith('/fcs/craft/cutting/') &&
        !findMenuItemByPath(pathname));
}
function migrateLegacyDispatchExceptionsTabs(allTabs) {
    const fcsTabs = allTabs.fcs;
    if (!fcsTabs)
        return allTabs;
    let changed = false;
    const deduped = new Map();
    for (const tab of fcsTabs.tabs) {
        const isLegacy = tab.key === LEGACY_DISPATCH_EXCEPTIONS_KEY ||
            tab.href === LEGACY_DISPATCH_EXCEPTIONS_PATH;
        const normalizedTab = isLegacy
            ? {
                ...tab,
                key: UNIFIED_PROGRESS_EXCEPTIONS_KEY,
                title: UNIFIED_PROGRESS_EXCEPTIONS_TITLE,
                href: UNIFIED_PROGRESS_EXCEPTIONS_PATH,
            }
            : tab.key === UNIFIED_PROGRESS_EXCEPTIONS_KEY
                ? {
                    ...tab,
                    title: UNIFIED_PROGRESS_EXCEPTIONS_TITLE,
                    href: UNIFIED_PROGRESS_EXCEPTIONS_PATH,
                }
                : tab;
        if (isLegacy || normalizedTab !== tab)
            changed = true;
        if (!deduped.has(normalizedTab.key)) {
            deduped.set(normalizedTab.key, normalizedTab);
        }
        else {
            changed = true;
        }
    }
    const nextActiveKey = fcsTabs.activeKey === LEGACY_DISPATCH_EXCEPTIONS_KEY
        ? UNIFIED_PROGRESS_EXCEPTIONS_KEY
        : fcsTabs.activeKey;
    if (nextActiveKey !== fcsTabs.activeKey)
        changed = true;
    if (!changed)
        return allTabs;
    return {
        ...allTabs,
        fcs: {
            ...fcsTabs,
            tabs: Array.from(deduped.values()),
            activeKey: nextActiveKey,
        },
    };
}
function migrateCuttingTabs(allTabs) {
    const fcsTabs = allTabs.fcs;
    if (!fcsTabs)
        return allTabs;
    let changed = false;
    const nextTabs = [];
    const seenKeys = new Set();
    const normalizeTab = (tab) => {
        const normalizedHref = normalizePathname(tab.href);
        if (REMOVED_CUTTING_TAB_PATHS.has(normalizedHref)) {
            changed = true;
            return null;
        }
        const migration = CUTTING_TAB_REDIRECTS[normalizedHref];
        if (!migration)
            return tab;
        const canonicalItem = findMenuItemByPath(migration.href);
        const nextTab = {
            ...tab,
            key: canonicalItem?.key ?? tab.key,
            title: migration.title,
            href: migration.href,
        };
        if (nextTab.key !== tab.key ||
            nextTab.title !== tab.title ||
            nextTab.href !== tab.href) {
            changed = true;
        }
        return nextTab;
    };
    for (const tab of fcsTabs.tabs) {
        const nextTab = normalizeTab(tab);
        if (!nextTab)
            continue;
        if (seenKeys.has(nextTab.key)) {
            changed = true;
            continue;
        }
        seenKeys.add(nextTab.key);
        nextTabs.push(nextTab);
    }
    const activeTab = fcsTabs.tabs.find((tab) => tab.key === fcsTabs.activeKey);
    const normalizedActiveTab = activeTab ? normalizeTab(activeTab) : null;
    let nextActiveKey = normalizedActiveTab?.key ?? '';
    if (nextActiveKey && !nextTabs.some((tab) => tab.key === nextActiveKey)) {
        nextActiveKey = '';
    }
    if (!nextActiveKey && nextTabs.length > 0) {
        nextActiveKey = nextTabs[0].key;
    }
    if (nextActiveKey !== fcsTabs.activeKey)
        changed = true;
    if (!changed)
        return allTabs;
    return {
        ...allTabs,
        fcs: {
            ...fcsTabs,
            tabs: nextTabs,
            activeKey: nextActiveKey,
        },
    };
}
function migrateFcsTabTitles(allTabs) {
    const fcsTabs = allTabs.fcs;
    if (!fcsTabs)
        return allTabs;
    let changed = false;
    const nextTabs = fcsTabs.tabs.map((tab) => {
        const canonicalItem = findMenuItemByPath(tab.href);
        const nextTitle = canonicalItem?.title?.trim();
        if (!nextTitle || nextTitle === tab.title)
            return tab;
        changed = true;
        return {
            ...tab,
            title: nextTitle,
        };
    });
    if (!changed)
        return allTabs;
    return {
        ...allTabs,
        fcs: {
            ...fcsTabs,
            tabs: nextTabs,
        },
    };
}
function isPfosPath(pathname) {
    const normalizedPathname = normalizePathname(pathname);
    return PFOS_ROUTE_PREFIXES.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`));
}
function migrateCraftTabsToPfos(allTabs) {
    const fcsTabs = allTabs.fcs;
    const pfosTabs = allTabs.pfos;
    if (!fcsTabs || !pfosTabs)
        return allTabs;
    const craftTabsFromFcs = fcsTabs.tabs.filter((tab) => isPfosPath(tab.href));
    if (craftTabsFromFcs.length === 0 && pfosTabs.tabs.length === 0) {
        return allTabs;
    }
    let changed = false;
    const nextFcsTabs = fcsTabs.tabs.filter((tab) => !isPfosPath(tab.href));
    if (nextFcsTabs.length !== fcsTabs.tabs.length) {
        changed = true;
    }
    const nextPfosTabs = [];
    const seenKeys = new Set();
    const pushTab = (tab) => {
        const normalizedHref = normalizePathname(tab.href);
        const canonicalItem = findMenuItemByPath(normalizedHref);
        const nextTab = {
            ...tab,
            key: canonicalItem?.key ?? tab.key,
            title: canonicalItem?.title ?? tab.title,
            href: normalizedHref,
        };
        if (nextTab.key !== tab.key ||
            nextTab.title !== tab.title ||
            nextTab.href !== tab.href) {
            changed = true;
        }
        if (seenKeys.has(nextTab.key)) {
            changed = true;
            return;
        }
        seenKeys.add(nextTab.key);
        nextPfosTabs.push(nextTab);
    };
    for (const tab of pfosTabs.tabs) {
        pushTab(tab);
    }
    for (const tab of craftTabsFromFcs) {
        pushTab(tab);
    }
    const activeCraftTab = fcsTabs.tabs.find((tab) => tab.key === fcsTabs.activeKey && isPfosPath(tab.href));
    const normalizedActiveCraftKey = activeCraftTab
        ? (findMenuItemByPath(activeCraftTab.href)?.key ?? activeCraftTab.key)
        : '';
    const nextFcsActiveKey = nextFcsTabs.some((tab) => tab.key === fcsTabs.activeKey)
        ? fcsTabs.activeKey
        : '';
    const nextPfosActiveKey = normalizedActiveCraftKey && nextPfosTabs.some((tab) => tab.key === normalizedActiveCraftKey)
        ? normalizedActiveCraftKey
        : nextPfosTabs.some((tab) => tab.key === pfosTabs.activeKey)
            ? pfosTabs.activeKey
            : nextPfosTabs[0]?.key ?? '';
    if (nextPfosTabs.length !== pfosTabs.tabs.length ||
        nextFcsActiveKey !== fcsTabs.activeKey ||
        nextPfosActiveKey !== pfosTabs.activeKey) {
        changed = true;
    }
    if (!changed)
        return allTabs;
    return {
        ...allTabs,
        fcs: {
            ...fcsTabs,
            tabs: nextFcsTabs,
            activeKey: nextFcsActiveKey,
        },
        pfos: {
            ...pfosTabs,
            tabs: nextPfosTabs,
            activeKey: nextPfosActiveKey,
        },
    };
}
function saveTabs(allTabs) {
    try {
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(allTabs));
    }
    catch {
        // ignore storage errors
    }
}
function getCurrentSystemId(pathname) {
    const normalizedPathname = normalizePathname(pathname);
    if (isPfosPath(normalizedPathname)) {
        return 'pfos';
    }
    const segments = normalizedPathname.split('/').filter(Boolean);
    const candidate = segments[0];
    const matched = systems.find((system) => system.id === candidate);
    return matched?.id ?? 'fcs';
}
function flattenMenus(groups) {
    return groups.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]));
}
function normalizePathname(pathname) {
    return pathname.split('#')[0].split('?')[0] || '/';
}
function findMenuItemByPath(pathname) {
    const normalizedPathname = normalizePathname(pathname);
    const systemId = getCurrentSystemId(normalizedPathname);
    const groups = menusBySystem[systemId] ?? [];
    const item = flattenMenus(groups).find((menu) => menu.href === normalizedPathname);
    return item ?? null;
}
function readSidebarCollapsed() {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}
const defaultPath = '/fcs/workbench/overview';
function readInitialPathname() {
    if (typeof window === 'undefined')
        return defaultPath;
    const pathname = window.location.pathname || '/';
    const search = window.location.search || '';
    return `${pathname}${search}` || defaultPath;
}
class AppStore {
    state = {
        pathname: readInitialPathname(),
        sidebarOpen: false,
        sidebarCollapsed: false,
        allTabs: createEmptyTabs(),
        expandedGroups: {},
        expandedItems: {},
    };
    listeners = new Set();
    init() {
        this.state.allTabs = getStoredTabs();
        this.state.sidebarCollapsed = readSidebarCollapsed();
        const systemId = getCurrentSystemId(this.state.pathname);
        const systemTabs = this.state.allTabs[systemId];
        const hasDirectLocationPath = normalizePathname(this.state.pathname) !== normalizePathname(defaultPath);
        const hasValidActiveTab = !!systemTabs?.activeKey &&
            systemTabs.tabs.some((tab) => tab.key === systemTabs.activeKey);
        if (!hasValidActiveTab && !hasDirectLocationPath) {
            const fallback = systems.find((item) => item.id === systemId)?.defaultPage ?? defaultPath;
            this.state.pathname = fallback;
        }
        this.syncTabWithPath(this.state.pathname);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    getState() {
        return this.state;
    }
    emit() {
        for (const listener of this.listeners) {
            listener();
        }
    }
    syncBrowserHistory(pathname, historyMode = 'push') {
        if (typeof window === 'undefined')
            return;
        const nextPath = pathname || defaultPath;
        const currentPath = `${window.location.pathname}${window.location.search}` || defaultPath;
        if (currentPath === nextPath)
            return;
        window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({}, '', nextPath);
    }
    patch(next) {
        this.state = { ...this.state, ...next };
        this.emit();
    }
    syncTabWithPath(pathname) {
        const systemId = getCurrentSystemId(pathname);
        const item = findMenuItemByPath(pathname);
        if (!item?.href) {
            return;
        }
        const systemTabs = this.state.allTabs[systemId] ?? {
            systemId,
            tabs: [],
            activeKey: '',
        };
        const exists = systemTabs.tabs.find((tab) => tab.key === item.key);
        const nextTabs = exists
            ? systemTabs.tabs
            : [...systemTabs.tabs, { key: item.key, title: item.title, href: item.href, closable: true }];
        const nextAllTabs = {
            ...this.state.allTabs,
            [systemId]: {
                ...systemTabs,
                tabs: nextTabs,
                activeKey: item.key,
            },
        };
        this.state.allTabs = nextAllTabs;
        saveTabs(nextAllTabs);
    }
    navigate(pathname, options = {}) {
        if (this.state.pathname === pathname)
            return;
        this.state.pathname = pathname;
        this.syncTabWithPath(pathname);
        this.syncBrowserHistory(pathname, options.historyMode ?? 'push');
        this.patch({ pathname });
    }
    syncFromBrowser(pathname) {
        const nextPath = pathname || defaultPath;
        if (this.state.pathname === nextPath)
            return;
        this.state.pathname = nextPath;
        this.syncTabWithPath(nextPath);
        this.patch({ pathname: nextPath });
    }
    switchSystem(systemId) {
        const system = systems.find((item) => item.id === systemId);
        if (!system)
            return;
        this.navigate(system.defaultPage);
    }
    openTab(tab) {
        const systemId = getCurrentSystemId(tab.href);
        const systemTabs = this.state.allTabs[systemId] ?? {
            systemId,
            tabs: [],
            activeKey: '',
        };
        const exists = systemTabs.tabs.find((item) => item.key === tab.key);
        const tabs = exists ? systemTabs.tabs : [...systemTabs.tabs, tab];
        const nextAllTabs = {
            ...this.state.allTabs,
            [systemId]: {
                ...systemTabs,
                tabs,
                activeKey: tab.key,
            },
        };
        this.state.allTabs = nextAllTabs;
        saveTabs(nextAllTabs);
        this.syncBrowserHistory(tab.href, 'push');
        this.patch({ allTabs: nextAllTabs, pathname: tab.href });
    }
    activateTab(tabKey) {
        const systemId = getCurrentSystemId(this.state.pathname);
        const systemTabs = this.state.allTabs[systemId];
        if (!systemTabs)
            return;
        const tab = systemTabs.tabs.find((item) => item.key === tabKey);
        if (!tab)
            return;
        const nextAllTabs = {
            ...this.state.allTabs,
            [systemId]: {
                ...systemTabs,
                activeKey: tabKey,
            },
        };
        this.state.allTabs = nextAllTabs;
        saveTabs(nextAllTabs);
        this.syncBrowserHistory(tab.href, 'push');
        this.patch({ allTabs: nextAllTabs, pathname: tab.href });
    }
    closeTab(tabKey) {
        const systemId = getCurrentSystemId(this.state.pathname);
        const systemTabs = this.state.allTabs[systemId];
        if (!systemTabs)
            return;
        const tabIndex = systemTabs.tabs.findIndex((item) => item.key === tabKey);
        if (tabIndex < 0)
            return;
        const nextTabs = systemTabs.tabs.filter((item) => item.key !== tabKey);
        let nextActiveKey = systemTabs.activeKey;
        let nextPath = this.state.pathname;
        if (systemTabs.activeKey === tabKey) {
            if (nextTabs.length > 0) {
                const nextIndex = Math.min(tabIndex, nextTabs.length - 1);
                const nextTab = nextTabs[nextIndex];
                nextActiveKey = nextTab.key;
                nextPath = nextTab.href;
            }
            else {
                const fallback = systems.find((item) => item.id === systemId)?.defaultPage ?? defaultPath;
                nextActiveKey = '';
                nextPath = fallback;
            }
        }
        const nextAllTabs = {
            ...this.state.allTabs,
            [systemId]: {
                ...systemTabs,
                tabs: nextTabs,
                activeKey: nextActiveKey,
            },
        };
        this.state.allTabs = nextAllTabs;
        saveTabs(nextAllTabs);
        this.syncBrowserHistory(nextPath, 'replace');
        this.patch({ allTabs: nextAllTabs, pathname: nextPath });
    }
    closeAllTabs() {
        const system = getCurrentSystem(this.state.pathname);
        const systemId = system.id;
        const systemTabs = this.state.allTabs[systemId] ?? {
            systemId,
            tabs: [],
            activeKey: '',
        };
        const defaultItem = findMenuItemByPath(system.defaultPage);
        const pinnedTabs = systemTabs.tabs.filter((tab) => !tab.closable);
        const nextTabs = [...pinnedTabs];
        if (defaultItem?.href && !nextTabs.some((tab) => tab.key === defaultItem.key)) {
            const existingDefaultTab = systemTabs.tabs.find((tab) => tab.key === defaultItem.key);
            nextTabs.unshift(existingDefaultTab ?? {
                key: defaultItem.key,
                title: defaultItem.title,
                href: defaultItem.href,
                closable: true,
            });
        }
        const nextActiveTab = nextTabs.find((tab) => tab.key === defaultItem?.key) ??
            nextTabs[0] ??
            null;
        const nextPath = nextActiveTab?.href ?? system.defaultPage ?? defaultPath;
        const nextActiveKey = nextActiveTab?.key ?? '';
        const nextAllTabs = {
            ...this.state.allTabs,
            [systemId]: {
                ...systemTabs,
                tabs: nextTabs,
                activeKey: nextActiveKey,
            },
        };
        this.state.allTabs = nextAllTabs;
        saveTabs(nextAllTabs);
        this.syncBrowserHistory(nextPath, 'replace');
        this.patch({ allTabs: nextAllTabs, pathname: nextPath });
    }
    setSidebarOpen(open) {
        this.patch({ sidebarOpen: open });
    }
    toggleSidebarCollapsed() {
        const next = !this.state.sidebarCollapsed;
        try {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        }
        catch {
            // ignore storage errors
        }
        this.patch({ sidebarCollapsed: next });
    }
    toggleGroup(groupKey) {
        const nextValue = !this.state.expandedGroups[groupKey];
        this.patch({
            expandedGroups: {
                ...this.state.expandedGroups,
                [groupKey]: nextValue,
            },
        });
    }
    toggleItem(itemKey) {
        const nextValue = !this.state.expandedItems[itemKey];
        this.patch({
            expandedItems: {
                ...this.state.expandedItems,
                [itemKey]: nextValue,
            },
        });
    }
}
export const appStore = new AppStore();
export function getCurrentSystem(pathname) {
    const systemId = getCurrentSystemId(pathname);
    return systems.find((system) => system.id === systemId) ?? systems[0];
}
export function getCurrentMenus(pathname) {
    const system = getCurrentSystem(pathname);
    return menusBySystem[system.id] ?? [];
}
export function getCurrentTabs(pathname, allTabs) {
    const system = getCurrentSystem(pathname);
    const systemTabs = allTabs[system.id];
    return {
        tabs: systemTabs?.tabs ?? [],
        activeKey: systemTabs?.activeKey ?? '',
    };
}
