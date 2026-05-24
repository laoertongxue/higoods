import { menusBySystem } from '../data/app-shell-config';
import { normalizePathname, renderRouteRedirect } from './route-utils';
function createAsyncRenderer(importModule, exportName) {
    let modulePromise = null;
    return async (...args) => {
        if (!modulePromise) {
            modulePromise = importModule().catch((error) => {
                modulePromise = null;
                throw error;
            });
        }
        const module = await modulePromise;
        const renderer = module[exportName];
        if (typeof renderer !== 'function') {
            throw new Error(`页面渲染函数不存在: ${exportName}`);
        }
        return renderer(...args);
    };
}
const renderFcsWorkbenchOverviewPage = createAsyncRenderer(() => import('../pages/workbench'), 'renderOverviewPage');
const renderPlaceholderPage = createAsyncRenderer(() => import('../pages/placeholder'), 'renderPlaceholderPage');
const renderRouteNotFound = createAsyncRenderer(() => import('../pages/placeholder'), 'renderRouteNotFound');
const exactBaseRoutes = {
    '/': async () => {
        return renderFcsWorkbenchOverviewPage();
    },
    '/pcs': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
    '/pcs/workspace': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
    '/fcs/workspace': () => renderRouteRedirect('/fcs/workbench/overview', '正在跳转到工厂生产协同工作台'),
    '/fcs': () => renderRouteRedirect('/fcs/workbench/overview', '正在跳转到工厂生产协同工作台'),
};
let fcsRoutesPromise = null;
let pcsRoutesPromise = null;
let pdaRoutesPromise = null;
function getFcsRoutes() {
    if (!fcsRoutesPromise) {
        fcsRoutesPromise = import('./routes-fcs')
            .then((module) => module.routes)
            .catch((error) => {
            fcsRoutesPromise = null;
            throw error;
        });
    }
    return fcsRoutesPromise;
}
function getPcsRoutes() {
    if (!pcsRoutesPromise) {
        pcsRoutesPromise = import('./routes-pcs')
            .then((module) => module.routes)
            .catch((error) => {
            pcsRoutesPromise = null;
            throw error;
        });
    }
    return pcsRoutesPromise;
}
function getPdaRoutes() {
    if (!pdaRoutesPromise) {
        pdaRoutesPromise = import('./routes-pda')
            .then((module) => module.routes)
            .catch((error) => {
            pdaRoutesPromise = null;
            throw error;
        });
    }
    return pdaRoutesPromise;
}
function getRoutesByPathname(normalizedPathname) {
    if (normalizedPathname.startsWith('/fcs/pda')) {
        return getPdaRoutes();
    }
    if (normalizedPathname.startsWith('/fcs')) {
        return getFcsRoutes();
    }
    if (normalizedPathname.startsWith('/pcs')) {
        return getPcsRoutes();
    }
    return Promise.resolve(null);
}
function findMenuByPath(pathname) {
    const normalizedPathname = normalizePathname(pathname);
    const allGroups = Object.values(menusBySystem).flat();
    for (const group of allGroups) {
        for (const item of group.items) {
            if (item.href === normalizedPathname) {
                return { group, item };
            }
            if (item.children) {
                const child = item.children.find((childItem) => childItem.href === normalizedPathname);
                if (child) {
                    return { group, item: child };
                }
            }
        }
    }
    return null;
}
function resolveFromRegistry(registry, normalizedPathname) {
    const directRenderer = registry.exactRoutes[normalizedPathname];
    if (directRenderer) {
        return directRenderer(normalizedPathname);
    }
    for (const route of registry.dynamicRoutes) {
        const matched = route.pattern.exec(normalizedPathname);
        if (matched) {
            return route.render(matched);
        }
    }
    return Promise.resolve(null);
}
export async function resolvePage(pathname) {
    const normalizedPathname = normalizePathname(pathname);
    const baseRenderer = exactBaseRoutes[normalizedPathname];
    if (baseRenderer) {
        return baseRenderer();
    }
    const registry = await getRoutesByPathname(normalizedPathname);
    if (registry) {
        const matchedContent = await resolveFromRegistry(registry, normalizedPathname);
        if (matchedContent !== null) {
            return matchedContent;
        }
    }
    const menu = findMenuByPath(normalizedPathname);
    if (menu) {
        return renderPlaceholderPage(menu.item.title, `${menu.item.title} 页面已接入路由与菜单联动，待迁移完整 UI 与交互。`, menu.group.title);
    }
    return renderRouteNotFound(pathname);
}
