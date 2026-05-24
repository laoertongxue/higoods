import { appStore } from "../state/store";
import {
  buildPdaCuttingRoute,
  resolvePdaTaskExecPath
} from "../data/fcs/pda-cutting-execution-source.ts";
function getCurrentPathname() {
  if (typeof window !== "undefined" && window.location?.pathname) {
    return `${window.location.pathname}${window.location.search}`;
  }
  return appStore.getState().pathname;
}
function splitPath(pathname) {
  const [path, queryString = ""] = pathname.split("?");
  return {
    path,
    params: new URLSearchParams(queryString)
  };
}
function withUpdatedParams(href, updater) {
  const { path, params } = splitPath(href);
  updater(params);
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
function readBoolean(value) {
  if (value == null || value === "") return void 0;
  return value === "1" || value === "true";
}
function writeBoolean(params, key, value) {
  if (value == null) return;
  params.set(key, value ? "1" : "0");
}
function readPdaCuttingNavContext(pathname) {
  const currentPathname = pathname ?? getCurrentPathname();
  const { params } = splitPath(currentPathname);
  return {
    sourcePageKey: params.get("sourcePageKey") ?? void 0,
    sourceSection: params.get("sourceSection") ?? void 0,
    taskId: params.get("taskId") ?? void 0,
    taskNo: params.get("taskNo") ?? void 0,
    productionOrderNo: params.get("productionOrderNo") ?? void 0,
    executionOrderId: params.get("executionOrderId") ?? void 0,
    executionOrderNo: params.get("executionOrderNo") ?? void 0,
    cutOrderId: params.get("cutOrderId") ?? void 0,
    cutOrderNo: params.get("cutOrderNo") ?? void 0,
    markerPlanId: params.get("markerPlanId") ?? void 0,
    markerPlanNo: params.get("markerPlanNo") ?? void 0,
    materialSku: params.get("materialSku") ?? void 0,
    focusTaskId: params.get("focusTaskId") ?? void 0,
    focusExecutionOrderId: params.get("focusExecutionOrderId") ?? void 0,
    focusExecutionOrderNo: params.get("focusExecutionOrderNo") ?? void 0,
    focusActionKey: params.get("focusActionKey") ?? void 0,
    returnTo: params.get("returnTo") ?? void 0,
    backMode: params.get("backMode") ?? void 0,
    autoFocus: readBoolean(params.get("autoFocus")),
    autoExpandActions: readBoolean(params.get("autoExpandActions")),
    justCompletedAction: params.get("justCompletedAction") ?? void 0,
    justSaved: readBoolean(params.get("justSaved")),
    highlightTask: readBoolean(params.get("highlightTask")),
    highlightCutPieceOrder: readBoolean(params.get("highlightCutPieceOrder"))
  };
}
function appendPdaCuttingNavContext(href, context) {
  return withUpdatedParams(href, (params) => {
    if (context.sourcePageKey) params.set("sourcePageKey", context.sourcePageKey);
    if (context.sourceSection) params.set("sourceSection", context.sourceSection);
    if (context.taskId) params.set("taskId", context.taskId);
    if (context.taskNo) params.set("taskNo", context.taskNo);
    if (context.productionOrderNo) params.set("productionOrderNo", context.productionOrderNo);
    if (context.executionOrderId) params.set("executionOrderId", context.executionOrderId);
    if (context.executionOrderNo) params.set("executionOrderNo", context.executionOrderNo);
    if (context.cutOrderId) params.set("cutOrderId", context.cutOrderId);
    if (context.cutOrderNo) params.set("cutOrderNo", context.cutOrderNo);
    if (context.markerPlanId) params.set("markerPlanId", context.markerPlanId);
    if (context.markerPlanNo) params.set("markerPlanNo", context.markerPlanNo);
    if (context.materialSku) params.set("materialSku", context.materialSku);
    if (context.focusTaskId) params.set("focusTaskId", context.focusTaskId);
    if (context.focusExecutionOrderId) params.set("focusExecutionOrderId", context.focusExecutionOrderId);
    if (context.focusExecutionOrderNo) params.set("focusExecutionOrderNo", context.focusExecutionOrderNo);
    if (context.focusActionKey) params.set("focusActionKey", context.focusActionKey);
    if (context.returnTo) params.set("returnTo", context.returnTo);
    if (context.backMode) params.set("backMode", context.backMode);
    writeBoolean(params, "autoFocus", context.autoFocus);
    writeBoolean(params, "autoExpandActions", context.autoExpandActions);
    if (context.justCompletedAction) params.set("justCompletedAction", context.justCompletedAction);
    writeBoolean(params, "justSaved", context.justSaved);
    writeBoolean(params, "highlightTask", context.highlightTask);
    writeBoolean(params, "highlightCutPieceOrder", context.highlightCutPieceOrder);
  });
}
function sanitizeTaskListPath(pathname) {
  const current = pathname?.trim() || "/fcs/pda/task-receive";
  if (current.startsWith("/fcs/pda/task-receive")) return current;
  return "/fcs/pda/task-receive";
}
function buildPdaTaskListFocusHref(pathname, context = {}) {
  const basePath = sanitizeTaskListPath(pathname);
  return appendPdaCuttingNavContext(basePath, {
    sourcePageKey: context.sourcePageKey ?? "task-list",
    focusTaskId: context.focusTaskId ?? context.taskId,
    taskId: context.taskId ?? context.focusTaskId,
    highlightTask: context.highlightTask ?? true,
    autoFocus: context.autoFocus ?? true
  });
}
function buildPdaTaskReceiveDetailNavHref(taskId, context = {}) {
  const listReturnTo = buildPdaTaskListFocusHref(context.returnTo, {
    sourcePageKey: "task-list",
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    highlightTask: true,
    autoFocus: true
  });
  return appendPdaCuttingNavContext(`/fcs/pda/task-receive/${taskId}`, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? "task-list",
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    returnTo: listReturnTo,
    highlightTask: context.highlightTask ?? true,
    autoFocus: context.autoFocus ?? true
  });
}
function buildPdaCuttingTaskDetailNavHref(taskId, context = {}) {
  const baseHref = buildPdaCuttingRoute(taskId, "task", {
    executionOrderId: context.executionOrderId,
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo
  });
  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? "task-receive-detail",
    taskId,
    focusTaskId: context.focusTaskId ?? taskId
  });
}
function buildPdaCuttingExecutionNavHref(taskId, routeKey, context = {}) {
  const baseHref = buildPdaCuttingRoute(taskId, routeKey, {
    executionOrderId: context.executionOrderId,
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo
  });
  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? "cutting-task-detail",
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? context.executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo,
    focusActionKey: routeKey
  });
}
function buildPdaCuttingExecutionUnitNavHref(taskId, executionOrderId, context = {}) {
  const baseHref = buildPdaCuttingRoute(taskId, "unit", {
    executionOrderId,
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo
  });
  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: context.sourcePageKey ?? "cutting-task-detail",
    taskId,
    executionOrderId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo
  });
}
function buildPdaCuttingDirectExecEntryHref(taskId, context = {}) {
  const baseHref = resolvePdaTaskExecPath(taskId, context.returnTo);
  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? context.executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo
  });
}
function buildPdaCuttingTaskDetailFocusHref(taskId, context = {}) {
  const baseHref = context.returnTo && context.returnTo.startsWith("/fcs/pda/cutting/task/") ? context.returnTo : buildPdaCuttingRoute(taskId, "task", {
    executionOrderId: context.executionOrderId,
    executionOrderNo: context.executionOrderNo,
    cutOrderId: context.cutOrderId,
    cutOrderNo: context.cutOrderNo,
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    materialSku: context.materialSku,
    returnTo: context.returnTo
  });
  return appendPdaCuttingNavContext(baseHref, {
    ...context,
    sourcePageKey: "cutting-task-detail",
    taskId,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: context.focusExecutionOrderId ?? context.executionOrderId,
    focusExecutionOrderNo: context.focusExecutionOrderNo ?? context.executionOrderNo,
    highlightCutPieceOrder: context.highlightCutPieceOrder ?? true,
    autoFocus: context.autoFocus ?? true
  });
}
function buildPdaCuttingCompletedReturnHref(taskId, executionOrderId, executionOrderNo, context, actionKey) {
  const returnTo = context.returnTo?.trim();
  const shouldReturnToExecutionUnit = context.sourcePageKey === "execution-unit" || Boolean(returnTo && returnTo.startsWith("/fcs/pda/cutting/unit/"));
  if (shouldReturnToExecutionUnit && executionOrderId) {
    const baseHref = returnTo && returnTo.startsWith("/fcs/pda/cutting/unit/") ? returnTo : buildPdaCuttingRoute(taskId, "unit", {
      executionOrderId,
      executionOrderNo: executionOrderNo ?? void 0,
      cutOrderId: context.cutOrderId,
      cutOrderNo: context.cutOrderNo,
      markerPlanId: context.markerPlanId,
      markerPlanNo: context.markerPlanNo,
      materialSku: context.materialSku,
      returnTo: context.returnTo
    });
    return appendPdaCuttingNavContext(baseHref, {
      ...context,
      sourcePageKey: "execution-unit",
      taskId,
      executionOrderId,
      executionOrderNo: executionOrderNo ?? void 0,
      focusTaskId: context.focusTaskId ?? taskId,
      focusExecutionOrderId: executionOrderId,
      focusExecutionOrderNo: executionOrderNo ?? void 0,
      focusActionKey: actionKey,
      justCompletedAction: actionKey,
      justSaved: true,
      autoFocus: true,
      highlightCutPieceOrder: true
    });
  }
  return buildPdaCuttingTaskDetailFocusHref(taskId, {
    executionOrderId: executionOrderId ?? void 0,
    executionOrderNo: executionOrderNo ?? void 0,
    returnTo: context.returnTo,
    focusTaskId: context.focusTaskId ?? taskId,
    focusExecutionOrderId: executionOrderId ?? void 0,
    focusExecutionOrderNo: executionOrderNo ?? void 0,
    focusActionKey: actionKey,
    justCompletedAction: actionKey,
    justSaved: true,
    autoFocus: true,
    autoExpandActions: true,
    highlightCutPieceOrder: true
  });
}
function resolvePdaCuttingBackHref(context, fallbackHref) {
  const returnTo = context?.returnTo?.trim();
  if (!returnTo || !returnTo.startsWith("/fcs/pda/")) {
    return fallbackHref;
  }
  return returnTo;
}
function getPdaCuttingCompletedActionLabel(actionKey) {
  if (actionKey === "spreading") return "\u5DF2\u4FDD\u5B58\u94FA\u5E03\u8BB0\u5F55";
  if (actionKey === "inbound") return "\u5DF2\u786E\u8BA4\u5165\u4ED3";
  if (actionKey === "handover") return "\u5DF2\u786E\u8BA4\u4EA4\u63A5";
  if (actionKey === "replenishment-feedback") return "\u5DF2\u63D0\u4EA4\u73B0\u573A\u5DEE\u5F02\u53CD\u9988";
  return "\u5DF2\u5B8C\u6210\u5F53\u524D\u64CD\u4F5C";
}
export {
  appendPdaCuttingNavContext,
  buildPdaCuttingCompletedReturnHref,
  buildPdaCuttingDirectExecEntryHref,
  buildPdaCuttingExecutionNavHref,
  buildPdaCuttingExecutionUnitNavHref,
  buildPdaCuttingTaskDetailFocusHref,
  buildPdaCuttingTaskDetailNavHref,
  buildPdaTaskListFocusHref,
  buildPdaTaskReceiveDetailNavHref,
  getPdaCuttingCompletedActionLabel,
  readPdaCuttingNavContext,
  resolvePdaCuttingBackHref
};
