import "./styles.css";
import { hydrateRealQRCodes } from "./components/real-qr";
import { hydrateIcons, renderAppShell, renderSidebar } from "./components/shell";
import { appStore } from "./state/store";
let fcsHandlersModulePromise = null;
let pcsHandlersModulePromise = null;
let pdaHandlersModulePromise = null;
let dispatchBoardPageModulePromise = null;
let factoryProfilePageModulePromise = null;
let craftCuttingMarkerPlanPageModulePromise = null;
let craftCuttingMarkerSpreadingPageModulePromise = null;
let craftPrintingWarehousePageModulePromise = null;
let craftDyeingWarehousePageModulePromise = null;
let factoryWarehouseSharedModulePromise = null;
let printPreviewPageModulePromise = null;
let pdaExecPageModulePromise = null;
let routesModulePromise = null;
let nextStoreRenderMode = "full";
function getFcsHandlersModule() {
  if (!fcsHandlersModulePromise) {
    fcsHandlersModulePromise = import("./main-handlers/fcs-handlers").catch((error) => {
      fcsHandlersModulePromise = null;
      throw error;
    });
  }
  return fcsHandlersModulePromise;
}
function getPcsHandlersModule() {
  if (!pcsHandlersModulePromise) {
    pcsHandlersModulePromise = import("./main-handlers/pcs-handlers").catch((error) => {
      pcsHandlersModulePromise = null;
      throw error;
    });
  }
  return pcsHandlersModulePromise;
}
function getPdaHandlersModule() {
  if (!pdaHandlersModulePromise) {
    pdaHandlersModulePromise = import("./main-handlers/pda-handlers").catch((error) => {
      pdaHandlersModulePromise = null;
      throw error;
    });
  }
  return pdaHandlersModulePromise;
}
function getDispatchBoardPageModule() {
  if (!dispatchBoardPageModulePromise) {
    dispatchBoardPageModulePromise = import("./pages/dispatch-board").catch((error) => {
      dispatchBoardPageModulePromise = null;
      throw error;
    });
  }
  return dispatchBoardPageModulePromise;
}
function getFactoryProfilePageModule() {
  if (!factoryProfilePageModulePromise) {
    factoryProfilePageModulePromise = import("./pages/factory-profile").catch((error) => {
      factoryProfilePageModulePromise = null;
      throw error;
    });
  }
  return factoryProfilePageModulePromise;
}
function getCraftCuttingMarkerPlanPageModule() {
  if (!craftCuttingMarkerPlanPageModulePromise) {
    craftCuttingMarkerPlanPageModulePromise = import("./pages/process-factory/cutting/marker-plan").catch((error) => {
      craftCuttingMarkerPlanPageModulePromise = null;
      throw error;
    });
  }
  return craftCuttingMarkerPlanPageModulePromise;
}
function getCraftCuttingMarkerSpreadingPageModule() {
  if (!craftCuttingMarkerSpreadingPageModulePromise) {
    craftCuttingMarkerSpreadingPageModulePromise = import("./pages/process-factory/cutting/marker-spreading").catch((error) => {
      craftCuttingMarkerSpreadingPageModulePromise = null;
      throw error;
    });
  }
  return craftCuttingMarkerSpreadingPageModulePromise;
}
function getCraftPrintingWarehousePageModule() {
  if (!craftPrintingWarehousePageModulePromise) {
    craftPrintingWarehousePageModulePromise = import("./pages/process-factory/printing/warehouse").catch((error) => {
      craftPrintingWarehousePageModulePromise = null;
      throw error;
    });
  }
  return craftPrintingWarehousePageModulePromise;
}
function getCraftDyeingWarehousePageModule() {
  if (!craftDyeingWarehousePageModulePromise) {
    craftDyeingWarehousePageModulePromise = import("./pages/process-factory/dyeing/warehouse").catch((error) => {
      craftDyeingWarehousePageModulePromise = null;
      throw error;
    });
  }
  return craftDyeingWarehousePageModulePromise;
}
function getFactoryWarehouseSharedModule() {
  if (!factoryWarehouseSharedModulePromise) {
    factoryWarehouseSharedModulePromise = import("./pages/process-factory/shared/warehouse-standard").catch((error) => {
      factoryWarehouseSharedModulePromise = null;
      throw error;
    });
  }
  return factoryWarehouseSharedModulePromise;
}
function getPrintPreviewPageModule() {
  if (!printPreviewPageModulePromise) {
    printPreviewPageModulePromise = import("./pages/print/print-preview").catch((error) => {
      printPreviewPageModulePromise = null;
      throw error;
    });
  }
  return printPreviewPageModulePromise;
}
function getPdaExecPageModule() {
  if (!pdaExecPageModulePromise) {
    pdaExecPageModulePromise = import("./pages/pda-exec").catch((error) => {
      pdaExecPageModulePromise = null;
      throw error;
    });
  }
  return pdaExecPageModulePromise;
}
function getRoutesModule() {
  if (!routesModulePromise) {
    routesModulePromise = import("./router/routes").catch((error) => {
      routesModulePromise = null;
      throw error;
    });
  }
  return routesModulePromise;
}
function getCurrentHandlerSystem(pathname) {
  if (pathname.startsWith("/pcs")) return "pcs";
  if (pathname.startsWith("/fcs/pda")) return "pda";
  if (pathname.startsWith("/fcs")) return "fcs";
  return "all";
}
const rootNode = document.querySelector("#app");
if (!(rootNode instanceof HTMLDivElement)) {
  throw new Error("Missing #app root node");
}
const root = rootNode;
appStore.init();
const PRELOAD_ERROR_RELOAD_KEY = "higood-vite-preload-reload";
let dynamicModuleReloadScheduled = false;
function clearPreloadReloadFlag() {
  try {
    sessionStorage.removeItem(PRELOAD_ERROR_RELOAD_KEY);
  } catch {
  }
}
function isDynamicModuleLoadError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Failed to fetch dynamically imported module") || message.includes("error loading dynamically imported module") || message.includes("Importing a module script failed") || message.includes("ChunkLoadError");
}
function shouldReloadForModuleLoadError() {
  try {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const current = sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      const samePath = parsed.path === currentPath;
      const recentlyReloaded = typeof parsed.at === "number" && Date.now() - parsed.at < 3e4;
      if (samePath && recentlyReloaded) return false;
    }
    sessionStorage.setItem(
      PRELOAD_ERROR_RELOAD_KEY,
      JSON.stringify({ path: currentPath, at: Date.now() })
    );
    return true;
  } catch {
    return true;
  }
}
function reloadForDynamicModuleLoadError(error, source) {
  if (!isDynamicModuleLoadError(error)) return false;
  if (!shouldReloadForModuleLoadError()) {
    console.error(`${source}\u52A8\u6001\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\uFF0C\u81EA\u52A8\u5237\u65B0\u540E\u4ECD\u672A\u6062\u590D\u3002`, error);
    return true;
  }
  console.warn(`${source}\u52A8\u6001\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\uFF0C\u5C06\u6309\u5F53\u524D\u5730\u5740\u5237\u65B0\u4E00\u6B21\u3002`, error);
  dynamicModuleReloadScheduled = true;
  window.location.reload();
  return true;
}
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const preloadError = "payload" in event ? event.payload : event instanceof CustomEvent ? event.detail : event;
  reloadForDynamicModuleLoadError(preloadError, "Vite \u9884\u52A0\u8F7D");
});
window.addEventListener("unhandledrejection", (event) => {
  if (reloadForDynamicModuleLoadError(event.reason, "\u672A\u5904\u7406 Promise ")) {
    event.preventDefault();
  }
});
window.addEventListener("error", (event) => {
  if (reloadForDynamicModuleLoadError(event.error ?? event.message, "\u5168\u5C40\u811A\u672C")) {
    event.preventDefault();
  }
});
async function dispatchPageEvent(target) {
  const eventTarget = target;
  const pathname = appStore.getState().pathname;
  if (pathname.startsWith("/fcs/factories/profile")) {
    try {
      const factoryProfilePage = await getFactoryProfilePageModule();
      return factoryProfilePage.handleFactoryPageEvent(eventTarget);
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, "\u5DE5\u5382\u6863\u6848\u4E8B\u4EF6\u5904\u7406\u5668")) return false;
      console.error("\u5DE5\u5382\u6863\u6848\u4E8B\u4EF6\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u4E0D\u5904\u7406", error);
      return false;
    }
  }
  if (pathname.startsWith("/fcs/dispatch/board")) {
    const dispatchBoardPage = await getDispatchBoardPageModule();
    return dispatchBoardPage.handleDispatchBoardEvent(eventTarget);
  }
  if (pathname.startsWith("/fcs/craft/cutting/marker-list") || pathname.startsWith("/fcs/craft/cutting/marker-create") || pathname.startsWith("/fcs/craft/cutting/marker-edit") || pathname.startsWith("/fcs/craft/cutting/marker-detail")) {
    const markerPlanPage = await getCraftCuttingMarkerPlanPageModule();
    return markerPlanPage.handleCraftCuttingMarkerPlanEvent(eventTarget);
  }
  if (pathname.startsWith("/fcs/craft/cutting/spreading") || pathname.startsWith("/fcs/craft/cutting/spreading-create") || pathname.startsWith("/fcs/craft/cutting/spreading-detail")) {
    const markerSpreadingPage = await getCraftCuttingMarkerSpreadingPageModule();
    return markerSpreadingPage.handleCraftCuttingMarkerSpreadingEvent(eventTarget);
  }
  const handlerSystem = getCurrentHandlerSystem(pathname);
  try {
    if (handlerSystem === "pcs") {
      const pcsHandlers2 = await getPcsHandlersModule();
      return pcsHandlers2.dispatchPcsPageEvent(eventTarget);
    }
    if (handlerSystem === "fcs") {
      const fcsHandlers2 = await getFcsHandlersModule();
      return fcsHandlers2.dispatchFcsPageEvent(eventTarget);
    }
    if (handlerSystem === "pda") {
      const pdaHandlers2 = await getPdaHandlersModule();
      return pdaHandlers2.dispatchPdaPageEvent(eventTarget);
    }
    const [fcsHandlers, pcsHandlers, pdaHandlers] = await Promise.all([
      getFcsHandlersModule(),
      getPcsHandlersModule(),
      getPdaHandlersModule()
    ]);
    if (await fcsHandlers.dispatchFcsPageEvent(eventTarget)) {
      return true;
    }
    if (await pcsHandlers.dispatchPcsPageEvent(eventTarget)) {
      return true;
    }
    return pdaHandlers.dispatchPdaPageEvent(eventTarget);
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, "\u9875\u9762\u4E8B\u4EF6\u5904\u7406\u5668")) return false;
    console.error("\u9875\u9762\u4E8B\u4EF6\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u4E0D\u5904\u7406", error);
    return false;
  }
}
async function dispatchPageSubmit(form) {
  const pathname = appStore.getState().pathname;
  if (pathname.startsWith("/fcs/factories/profile")) {
    try {
      const factoryProfilePage = await getFactoryProfilePageModule();
      return factoryProfilePage.handleFactoryPageSubmit(form);
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, "\u5DE5\u5382\u6863\u6848\u63D0\u4EA4\u5904\u7406\u5668")) return false;
      console.error("\u5DE5\u5382\u6863\u6848\u63D0\u4EA4\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u4E0D\u63D0\u4EA4", error);
      return false;
    }
  }
  try {
    const fcsHandlers = await getFcsHandlersModule();
    return fcsHandlers.dispatchFcsPageSubmit(form);
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, "\u9875\u9762\u63D0\u4EA4\u5904\u7406\u5668")) return false;
    console.error("\u9875\u9762\u63D0\u4EA4\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u4E0D\u63D0\u4EA4", error);
    return false;
  }
}
async function dispatchPcsInputEvent(target) {
  const pathname = appStore.getState().pathname || "";
  if (pathname.startsWith("/fcs/pda")) return false;
  try {
    const pcsHandlers = await getPcsHandlersModule();
    return pcsHandlers.dispatchPcsInputEvent(target);
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, "\u8F93\u5165\u5904\u7406\u5668")) return false;
    console.error("\u8F93\u5165\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u4E0D\u5904\u7406", error);
    return false;
  }
}
async function closeDialogsOnEscape() {
  const pathname = appStore.getState().pathname;
  if (pathname.startsWith("/fcs/factories/profile")) {
    try {
      const factoryProfilePage = await getFactoryProfilePageModule();
      if (!factoryProfilePage.isFactoryPageOpenDialog()) return false;
      const fakeButton = document.createElement("button");
      fakeButton.dataset.factoryAction = "close-dialog";
      return factoryProfilePage.handleFactoryPageEvent(fakeButton);
    } catch (error) {
      if (reloadForDynamicModuleLoadError(error, "\u5DE5\u5382\u6863\u6848\u5F39\u7A97\u5904\u7406\u5668")) return false;
      console.error("\u5DE5\u5382\u6863\u6848\u5F39\u7A97\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25", error);
      return false;
    }
  }
  const handlerSystem = getCurrentHandlerSystem(pathname);
  try {
    if (handlerSystem === "pcs") {
      const pcsHandlers2 = await getPcsHandlersModule();
      return pcsHandlers2.closePcsDialogsOnEscape();
    }
    if (handlerSystem === "fcs") {
      const fcsHandlers2 = await getFcsHandlersModule();
      return fcsHandlers2.closeFcsDialogsOnEscape();
    }
    if (handlerSystem === "pda") {
      const pdaHandlers2 = await getPdaHandlersModule();
      return pdaHandlers2.closePdaDialogsOnEscape();
    }
    const [fcsHandlers, pcsHandlers, pdaHandlers] = await Promise.all([
      getFcsHandlersModule(),
      getPcsHandlersModule(),
      getPdaHandlersModule()
    ]);
    if (fcsHandlers.closeFcsDialogsOnEscape()) {
      return true;
    }
    if (await pcsHandlers.closePcsDialogsOnEscape()) {
      return true;
    }
    return pdaHandlers.closePdaDialogsOnEscape();
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, "\u5F39\u7A97\u5904\u7406\u5668")) return false;
    console.error("\u5F39\u7A97\u5904\u7406\u5668\u52A0\u8F7D\u5931\u8D25", error);
    return false;
  }
}
let renderSerial = 0;
async function renderCurrentPageContent(pathname) {
  try {
    const normalizedPathname = pathname.split("?")[0].split("#")[0];
    if (normalizedPathname === "/fcs/pda/exec") {
      const pdaExecPage = await getPdaExecPageModule();
      return pdaExecPage.renderPdaExecPage();
    }
    if (normalizedPathname === "/fcs/craft/printing/wait-process-warehouse") {
      const printingWarehousePage = await getCraftPrintingWarehousePageModule();
      return printingWarehousePage.renderCraftPrintingWaitProcessWarehousePage();
    }
    if (normalizedPathname === "/fcs/craft/printing/wait-handover-warehouse") {
      const printingWarehousePage = await getCraftPrintingWarehousePageModule();
      return printingWarehousePage.renderCraftPrintingWaitHandoverWarehousePage();
    }
    if (normalizedPathname === "/fcs/craft/dyeing/wait-process-warehouse") {
      const dyeingWarehousePage = await getCraftDyeingWarehousePageModule();
      return dyeingWarehousePage.renderCraftDyeingWaitProcessWarehousePage();
    }
    if (normalizedPathname === "/fcs/craft/dyeing/wait-handover-warehouse") {
      const dyeingWarehousePage = await getCraftDyeingWarehousePageModule();
      return dyeingWarehousePage.renderCraftDyeingWaitHandoverWarehousePage();
    }
    if (normalizedPathname === "/fcs/print/preview") {
      const printPreviewPage = await getPrintPreviewPageModule();
      return printPreviewPage.renderPrintPreviewPage();
    }
    const { resolvePage } = await getRoutesModule();
    return resolvePage(pathname);
  } catch (error) {
    if (reloadForDynamicModuleLoadError(error, "\u8DEF\u7531\u6A21\u5757")) {
      return '<section class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">\u9875\u9762\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\uFF0C\u6B63\u5728\u5237\u65B0\u5F53\u524D\u9875\u9762\u3002</section>';
    }
    console.error("\u8DEF\u7531\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\uFF0C\u8FDB\u5165\u964D\u7EA7\u9875", error);
    return '<section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">\u9875\u9762\u5185\u5BB9\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002</section>';
  }
}
async function render() {
  const currentSerial = ++renderSerial;
  const state = appStore.getState();
  const pageContent = await renderCurrentPageContent(state.pathname);
  if (currentSerial !== renderSerial) {
    return;
  }
  root.innerHTML = renderAppShell(state, pageContent);
  hydrateIcons(root);
  hydrateRealQRCodes(root);
  if (!dynamicModuleReloadScheduled) {
    clearPreloadReloadFlag();
  }
}
async function renderSidebarOnly() {
  const sidebarHost = root.querySelector('[data-shell-sidebar-root="true"]');
  if (!(sidebarHost instanceof HTMLElement)) {
    await render();
    return;
  }
  sidebarHost.innerHTML = renderSidebar(appStore.getState());
  hydrateIcons(sidebarHost);
}
function markNextStoreRenderAsSidebarOnly() {
  nextStoreRenderMode = "sidebar";
}
function getPageContentHost() {
  const host = root.querySelector('[data-page-content-root="true"]');
  return host instanceof HTMLDivElement ? host : null;
}
function normalizePathname(pathname) {
  return pathname.split("?")[0].split("#")[0] || "/";
}
function isTechPackPageMounted() {
  return Boolean(root.querySelector('[data-tech-pack-page-root="true"]'));
}
function shouldUseTechPackScopedRender(target, previousPathname, nextPathname) {
  if (!(target instanceof Element)) return false;
  if (normalizePathname(previousPathname) !== normalizePathname(nextPathname)) return false;
  const isTechPackTarget = Boolean(target.closest('[data-tech-pack-page-root="true"]'));
  const isCuttingMarkerTarget = Boolean(target.closest([
    '[data-testid="cutting-marker-plan-list-page"]',
    '[data-testid="cutting-marker-plan-create-page"]',
    '[data-testid="cutting-marker-plan-edit-page"]',
    '[data-testid="cutting-marker-plan-detail-page"]'
  ].join(",")));
  if (!isTechPackTarget && !isCuttingMarkerTarget) return false;
  const actionNode = target.closest("[data-tech-action]");
  const action = actionNode?.dataset.techAction;
  if (action === "tech-back") return false;
  return true;
}
async function renderPageContentOnly() {
  const currentSerial = ++renderSerial;
  const state = appStore.getState();
  const pageContent = await renderCurrentPageContent(state.pathname);
  if (currentSerial !== renderSerial) {
    return;
  }
  const pageContentHost = getPageContentHost();
  if (!pageContentHost) {
    await render();
    return;
  }
  pageContentHost.innerHTML = pageContent;
  hydrateRealQRCodes(pageContentHost);
  queueMicrotask(() => {
    hydrateIcons(pageContentHost);
  });
}
function escapeCssValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
function datasetKeyToAttribute(key) {
  return `data-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}
function isFocusableField(element) {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}
function buildFocusSelector(element) {
  const tagName = element.tagName.toLowerCase();
  if (element.id) {
    return `${tagName}#${escapeCssValue(element.id)}`;
  }
  const selectorParts = [];
  const datasetEntries = Object.entries(element.dataset);
  for (const [key, value] of datasetEntries) {
    selectorParts.push(`[${datasetKeyToAttribute(key)}="${escapeCssValue(value)}"]`);
  }
  const name = element.getAttribute("name");
  if (name) {
    selectorParts.push(`[name="${escapeCssValue(name)}"]`);
  }
  if (element instanceof HTMLInputElement && element.type) {
    selectorParts.push(`[type="${escapeCssValue(element.type)}"]`);
  }
  return selectorParts.length > 0 ? `${tagName}${selectorParts.join("")}` : null;
}
function buildFocusPath(element) {
  const path = [];
  let current = element;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent) break;
    const index = Array.prototype.indexOf.call(parent.children, current);
    path.unshift(index);
    current = parent;
  }
  return path;
}
function captureFocusSnapshot() {
  const activeElement = document.activeElement;
  if (!isFocusableField(activeElement) || !root.contains(activeElement)) return null;
  if (activeElement instanceof HTMLInputElement && activeElement.type === "file") return null;
  return {
    selector: buildFocusSelector(activeElement),
    path: buildFocusPath(activeElement),
    selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement ? activeElement.selectionStart : null,
    selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement ? activeElement.selectionEnd : null,
    scrollTop: activeElement instanceof HTMLTextAreaElement ? activeElement.scrollTop : null
  };
}
function resolveFocusByPath(path) {
  let current = root;
  for (const childIndex of path) {
    const next = current.children.item(childIndex);
    if (!(next instanceof Element)) return null;
    current = next;
  }
  return current;
}
function restoreFocusSnapshot(snapshot) {
  if (!snapshot) return;
  const candidate = (snapshot.selector ? root.querySelector(snapshot.selector) : null) ?? resolveFocusByPath(snapshot.path);
  if (!isFocusableField(candidate)) return;
  candidate.focus();
  if ((candidate instanceof HTMLInputElement || candidate instanceof HTMLTextAreaElement) && snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
    try {
      candidate.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {
    }
  }
  if (candidate instanceof HTMLTextAreaElement && snapshot.scrollTop !== null) {
    candidate.scrollTop = snapshot.scrollTop;
  }
}
async function renderWithFocusRestore(snapshot) {
  await render();
  restoreFocusSnapshot(snapshot);
}
async function renderPageContentOnlyWithFocusRestore(snapshot) {
  await renderPageContentOnly();
  restoreFocusSnapshot(snapshot);
}
function closeMobileSidebar() {
  const { sidebarOpen } = appStore.getState();
  if (sidebarOpen) {
    markNextStoreRenderAsSidebarOnly();
    appStore.setSidebarOpen(false);
  }
}
function navigateWithImmediateSidebar(pathname) {
  markNextStoreRenderAsSidebarOnly();
  appStore.navigate(pathname);
  closeMobileSidebar();
  void renderPageContentOnly();
}
function hasDatasetAction(node) {
  return Object.keys(node.dataset).some((key) => key === "action" || key.endsWith("Action"));
}
function hasDatasetFieldLike(node) {
  return Object.keys(node.dataset).some(
    (key) => key === "field" || key === "filter" || key.endsWith("Field") || key.endsWith("Filter")
  );
}
function shouldBypassClickDispatch(target) {
  const controlNode = target.closest("input, textarea, select, option");
  if (!controlNode) return false;
  const actionBound = hasDatasetAction(controlNode);
  if (controlNode instanceof HTMLSelectElement || controlNode instanceof HTMLOptionElement) return true;
  if (controlNode.closest("select") instanceof HTMLSelectElement) return true;
  if (controlNode instanceof HTMLTextAreaElement && !actionBound) return true;
  if (controlNode instanceof HTMLInputElement) {
    const inputType = (controlNode.type || "text").toLowerCase();
    if (inputType === "file") return true;
    const clickDrivenTypes = /* @__PURE__ */ new Set(["checkbox", "radio", "button", "submit", "reset", "range", "file", "color"]);
    if (!clickDrivenTypes.has(inputType) && !actionBound) return true;
  }
  if (hasDatasetFieldLike(controlNode) && !actionBound) return true;
  return false;
}
function shouldSkipInputRerender(target) {
  const techFieldNode = target.closest("[data-tech-field]");
  if (techFieldNode) {
    const field = techFieldNode.dataset.techField || "";
    if (field === "pattern-template-search-keyword") return false;
    if (field === "new-pattern-piece-color-count") return false;
    if (techFieldNode instanceof HTMLTextAreaElement) return true;
    if (techFieldNode instanceof HTMLInputElement) {
      const inputType = (techFieldNode.type || "text").toLowerCase();
      const rerenderDrivenTypes = /* @__PURE__ */ new Set(["checkbox", "radio", "file", "range", "color"]);
      return !rerenderDrivenTypes.has(inputType);
    }
    return false;
  }
  const pdaLoginFieldNode = target.closest("[data-pda-login-field]");
  if (pdaLoginFieldNode instanceof HTMLInputElement || pdaLoginFieldNode instanceof HTMLTextAreaElement) {
    return true;
  }
  const markerPlanInputNode = target.closest(
    [
      "[data-marker-plan-filter-field]",
      "[data-marker-plan-context-field]",
      "[data-marker-plan-basic-field]",
      "[data-marker-plan-textarea-field]",
      "[data-marker-plan-size-piece-per-layer]",
      "[data-marker-plan-matrix-cell]",
      "[data-marker-plan-matrix-row-length]",
      "[data-marker-plan-bed-field]",
      "[data-marker-plan-fold-field]",
      "[data-marker-plan-mapping-field]"
    ].join(", ")
  );
  if (markerPlanInputNode instanceof HTMLInputElement || markerPlanInputNode instanceof HTMLTextAreaElement) {
    const inputType = markerPlanInputNode instanceof HTMLInputElement ? (markerPlanInputNode.type || "text").toLowerCase() : "text";
    if (inputType === "checkbox" || inputType === "radio") return false;
    return true;
  }
  const pdaOnboardingFieldNode = target.closest("[data-pda-onboarding-field], [data-pda-onboarding-machine-field]");
  if (pdaOnboardingFieldNode instanceof HTMLInputElement || pdaOnboardingFieldNode instanceof HTMLTextAreaElement) {
    return true;
  }
  const factoryOnboardingFieldNode = target.closest("[data-factory-onboarding-field]");
  if (factoryOnboardingFieldNode instanceof HTMLInputElement || factoryOnboardingFieldNode instanceof HTMLTextAreaElement) {
    if (factoryOnboardingFieldNode instanceof HTMLInputElement) {
      const inputType = (factoryOnboardingFieldNode.type || "text").toLowerCase();
      if (inputType === "radio" || inputType === "checkbox") return false;
    }
    return true;
  }
  const factoryProfileFieldNode = target.closest("[data-factory-field], [data-pda-field]");
  if (factoryProfileFieldNode instanceof HTMLInputElement || factoryProfileFieldNode instanceof HTMLTextAreaElement) {
    const inputType = factoryProfileFieldNode instanceof HTMLInputElement ? (factoryProfileFieldNode.type || "text").toLowerCase() : "text";
    return !["checkbox", "radio", "file", "range", "color"].includes(inputType);
  }
  return false;
}
function shouldSkipChangeRerender(target) {
  const techFieldNode = target.closest("[data-tech-field]");
  if (techFieldNode) {
    const field = techFieldNode.dataset.techField || "";
    const rerenderDrivenFields = /* @__PURE__ */ new Set([
      "new-pattern-material-type",
      "new-pattern-linked-bom-item",
      "new-pattern-prj-file",
      "new-pattern-marker-image-file",
      "new-pattern-dxf-file",
      "new-pattern-rul-file",
      "new-pattern-single-file",
      "new-pattern-piece-is-template",
      "pattern-template-search-keyword",
      "new-bom-print-requirement",
      "new-bom-print-side-mode",
      "new-design-file"
    ]);
    return !rerenderDrivenFields.has(field);
  }
  const pdaLoginFieldNode = target.closest("[data-pda-login-field]");
  if (pdaLoginFieldNode instanceof HTMLInputElement || pdaLoginFieldNode instanceof HTMLTextAreaElement) {
    return true;
  }
  const pdaOnboardingFieldNode = target.closest("[data-pda-onboarding-field], [data-pda-onboarding-machine-field]");
  if (pdaOnboardingFieldNode instanceof HTMLInputElement || pdaOnboardingFieldNode instanceof HTMLTextAreaElement) {
    return true;
  }
  const factoryOnboardingFieldNode = target.closest("[data-factory-onboarding-field]");
  if (factoryOnboardingFieldNode instanceof HTMLInputElement || factoryOnboardingFieldNode instanceof HTMLTextAreaElement) {
    if (factoryOnboardingFieldNode instanceof HTMLInputElement) {
      const inputType = (factoryOnboardingFieldNode.type || "text").toLowerCase();
      if (inputType === "radio" || inputType === "checkbox") return false;
    }
    return true;
  }
  const factoryProfileFieldNode = target.closest("[data-factory-field], [data-pda-field]");
  if (factoryProfileFieldNode instanceof HTMLInputElement || factoryProfileFieldNode instanceof HTMLTextAreaElement) {
    const inputType = factoryProfileFieldNode instanceof HTMLInputElement ? (factoryProfileFieldNode.type || "text").toLowerCase() : "text";
    return !["checkbox", "radio", "file", "range", "color"].includes(inputType);
  }
  return false;
}
function resolveEventElementTarget(eventTarget) {
  if (eventTarget instanceof Element) return eventTarget;
  if (eventTarget instanceof Node) return eventTarget.parentElement;
  return null;
}
function isComposingInputEvent(event) {
  return event instanceof InputEvent && event.isComposing;
}
const SHELL_ACTIONS = /* @__PURE__ */ new Set([
  "switch-system",
  "set-sidebar-open",
  "toggle-sidebar-collapsed",
  "toggle-menu-group",
  "toggle-menu-item",
  "open-tab",
  "activate-tab",
  "close-tab",
  "close-all-tabs"
]);
function handleShellAction(actionNode) {
  const action = actionNode.dataset.action;
  if (!action || !SHELL_ACTIONS.has(action)) return false;
  if (action === "switch-system") {
    const systemId = actionNode.dataset.systemId;
    if (systemId) {
      appStore.switchSystem(systemId);
      closeMobileSidebar();
    }
    return true;
  }
  if (action === "set-sidebar-open") {
    markNextStoreRenderAsSidebarOnly();
    appStore.setSidebarOpen(actionNode.dataset.sidebarOpen === "true");
    return true;
  }
  if (action === "toggle-sidebar-collapsed") {
    markNextStoreRenderAsSidebarOnly();
    appStore.toggleSidebarCollapsed();
    return true;
  }
  if (action === "toggle-menu-group") {
    const groupKey = actionNode.dataset.groupKey;
    if (groupKey) {
      markNextStoreRenderAsSidebarOnly();
      appStore.toggleGroup(groupKey);
    }
    return true;
  }
  if (action === "toggle-menu-item") {
    const itemKey = actionNode.dataset.itemKey;
    if (itemKey) {
      markNextStoreRenderAsSidebarOnly();
      appStore.toggleItem(itemKey);
    }
    return true;
  }
  if (action === "open-tab") {
    const href = actionNode.dataset.tabHref;
    const key = actionNode.dataset.tabKey;
    const title = actionNode.dataset.tabTitle;
    if (href && key && title) {
      appStore.openTab({
        href,
        key,
        title,
        closable: true
      });
      closeMobileSidebar();
    }
    return true;
  }
  if (action === "activate-tab") {
    const key = actionNode.dataset.tabKey;
    if (key) appStore.activateTab(key);
    return true;
  }
  if (action === "close-tab") {
    const key = actionNode.dataset.tabKey;
    if (key) appStore.closeTab(key);
    return true;
  }
  if (action === "close-all-tabs") {
    appStore.closeAllTabs();
    return true;
  }
  return false;
}
root.addEventListener("click", async (event) => {
  const target = resolveEventElementTarget(event.target);
  if (!target) return;
  const focusSnapshot = captureFocusSnapshot();
  const previousPathname = appStore.getState().pathname;
  if (shouldBypassClickDispatch(target)) return;
  const shellActionNode = target.closest("[data-action]");
  if (shellActionNode && handleShellAction(shellActionNode)) {
    event.preventDefault();
    return;
  }
  const warehouseSharedNode = target.closest("[data-warehouse-flow-action], [data-factory-warehouse-location-action]");
  if (warehouseSharedNode) {
    event.preventDefault();
    const warehouseShared = await getFactoryWarehouseSharedModule();
    if (await warehouseShared.handleFactoryWarehouseSharedEvent(warehouseSharedNode)) {
      return;
    }
  }
  const pdaCutInboundActionNode = target.closest("[data-pda-cut-inbound-action]");
  if (pdaCutInboundActionNode) {
    event.preventDefault();
    const pdaCuttingInboundPage = await import("./pages/pda-cutting-inbound");
    if (pdaCuttingInboundPage.handlePdaCuttingInboundEvent(pdaCutInboundActionNode)) {
      await renderWithFocusRestore(focusSnapshot);
      return;
    }
  }
  const directNavNode = target.closest("[data-nav]");
  if (directNavNode?.dataset.nav && !hasDatasetAction(directNavNode)) {
    event.preventDefault();
    navigateWithImmediateSidebar(directNavNode.dataset.nav);
    return;
  }
  if (await dispatchPageEvent(target)) {
    event.preventDefault();
    if (target.closest('[data-skip-page-rerender="true"]')) {
      return;
    }
    const nextPathname = appStore.getState().pathname;
    if (target.closest("[data-fast-page-render]") || shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot);
    } else {
      await renderWithFocusRestore(focusSnapshot);
    }
    return;
  }
  const navNode = target.closest("[data-nav]");
  if (navNode?.dataset.nav) {
    event.preventDefault();
    navigateWithImmediateSidebar(navNode.dataset.nav);
    return;
  }
  const actionNode = target.closest("[data-action]");
  if (!actionNode) return;
  if (handleShellAction(actionNode)) {
    event.preventDefault();
  }
});
root.addEventListener("input", async (event) => {
  const target = resolveEventElementTarget(event.target);
  if (!target) return;
  if (isComposingInputEvent(event)) return;
  const focusSnapshot = captureFocusSnapshot();
  const previousPathname = appStore.getState().pathname;
  if (await dispatchPcsInputEvent(target)) {
    await renderWithFocusRestore(focusSnapshot);
    return;
  }
  if (await dispatchPageEvent(target)) {
    if (shouldSkipInputRerender(target)) return;
    const nextPathname = appStore.getState().pathname;
    if (shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot);
    } else {
      await renderWithFocusRestore(focusSnapshot);
    }
  }
});
root.addEventListener("compositionend", async (event) => {
  const target = resolveEventElementTarget(event.target);
  if (!target) return;
  const focusSnapshot = captureFocusSnapshot();
  const previousPathname = appStore.getState().pathname;
  if (await dispatchPcsInputEvent(target)) {
    await renderWithFocusRestore(focusSnapshot);
    return;
  }
  if (await dispatchPageEvent(target)) {
    if (shouldSkipInputRerender(target)) return;
    const nextPathname = appStore.getState().pathname;
    if (shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot);
    } else {
      await renderWithFocusRestore(focusSnapshot);
    }
  }
});
root.addEventListener("change", async (event) => {
  const target = resolveEventElementTarget(event.target);
  if (!target) return;
  const focusSnapshot = captureFocusSnapshot();
  const previousPathname = appStore.getState().pathname;
  if (await dispatchPageEvent(target)) {
    if (shouldSkipChangeRerender(target)) return;
    const nextPathname = appStore.getState().pathname;
    if (shouldUseTechPackScopedRender(target, previousPathname, nextPathname)) {
      await renderPageContentOnlyWithFocusRestore(focusSnapshot);
    } else {
      await renderWithFocusRestore(focusSnapshot);
    }
  }
});
root.addEventListener("submit", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  if (await dispatchPageSubmit(target)) {
    event.preventDefault();
    await render();
  }
});
document.addEventListener("keydown", async (event) => {
  if (event.key !== "Escape") return;
  const shouldUseScopedRender = isTechPackPageMounted();
  if (await closeDialogsOnEscape()) {
    if (shouldUseScopedRender) {
      await renderPageContentOnly();
    } else {
      await render();
    }
    return;
  }
  if (appStore.getState().sidebarOpen) {
    appStore.setSidebarOpen(false);
  }
});
window.addEventListener("popstate", () => {
  const pathname = `${window.location.pathname}${window.location.search}` || "/";
  appStore.syncFromBrowser(pathname);
});
appStore.subscribe(() => {
  const renderMode = nextStoreRenderMode;
  nextStoreRenderMode = "full";
  if (renderMode === "sidebar") {
    void renderSidebarOnly();
    return;
  }
  void render();
});
window.addEventListener("higood:request-render", () => {
  const focusSnapshot = captureFocusSnapshot();
  if (isTechPackPageMounted()) {
    void renderPageContentOnlyWithFocusRestore(focusSnapshot);
    return;
  }
  void renderWithFocusRestore(focusSnapshot);
});
void render();
