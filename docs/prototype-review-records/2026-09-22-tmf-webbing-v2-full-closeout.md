# TMF 织带厂管理 V2.0 全量收口审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-22 |
| 相关需求 / 任务 | docs/product-design/tmf-webbing/织带厂管理产品方案.md（V2.0 修订1～8）；WP09～WP13；原子需求 OVR／TERM／DYE／MASTER／IMG／PAGE-013～016／HIST／LINK／EVID 共 34 条，见需求追踪矩阵 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PMS / PCS / WLS |
| 涉及页面路径 | /fcs/craft/accessory/webbing/work-orders、base-orders、pending-receipts、handover-records、pda；/wls/accessory-continuous-stock；/fcs/progress/production-orders/detail；染色/印花产出与终止处置入口 |
| 端类型 | 管理端、主管端、员工执行端（PDA） |
| 主要角色与任务 | 主管确认超产/超收与终止处置；染色直交接续；采购主档映射；仓管分批实收；PDA 接收/截断/打头/交出；主生产单只读投影 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增 4 个命名路由页面（待接收、交出记录、半成品库存、PDA 工厂执行）与菜单入口；基础单新增超产/超收二次确认与主档映射展示；终止处置台新增 5 类处置、缺口补做结案；染色上游页签新增直交绑定/分配/实收；5 张对象对应图片绑定到产出与规格/表单；主生产单进度页新增织带只读投影面板。
- 设计基线：AGENTS.md 第 4 节现场基线、第 5 节列表及真实图片、第 7 节验证及小于 500ms 性能门禁。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 主管端突出超收/终止二次确认；员工 PDA 单一主动作任务卡；管理端只读投影不越权 |
| 文案、状态、数量与单位 | 通过 | 全部中文业务文案；差异以“少/多多少”表达；计划量不因超产超收扩张 |
| 扫码、真实图片与对象识别 | 通过 | 5 张对象对应图（染色/印花/三类端头）可访问可解码，来源登记齐全，缩略图与对象同块 |
| 防错、危险确认与主管兜底 | 通过 | 超产/超收/报废/留用/结案均二次确认；缺口 85 阻断后补做关联可结案；缺失主档具名阻断 |
| 交接、跨端事实与异常追溯 | 通过 | dyeHandover 唯一数量事实；Web/PDA/打印同一口径；23 项场景检查重放通过 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | PDA 360×640 命名路由验收；PDA 入口 max 297ms |
| 命名路由、交互、图片大图与打印 | 通过 | 59/59 浏览器脚本；20/20 路由 1590 样本 max 465ms strictGate；打印样本 max 159ms |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 否 |

## 6. 最终结论

结论：通过

说明：

- 单元测试 411/411、构建通过、trace-audit 161/161 evidence_bound、全量浏览器 59/59、严格性能 strictGate 通过（max 465.44ms < 500ms）、页面/PDA/打印专项门禁通过，全部绑定 head `0ad80208`、分支 `codex/zhidaichangguanli`。
- 无例外批准；第 7.2 节性能门禁以 1590 条原始样本全量通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/tmf-process-continuation.ts`
- `src/data/fcs/tmf-reference-images.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/data/pms/tmf-master-registry.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/pages/process-factory/accessory/webbing/base-orders.ts`
- `src/pages/process-factory/accessory/webbing/continuous-stock.ts`
- `src/pages/process-factory/accessory/webbing/handover-records.ts`
- `src/pages/process-factory/accessory/webbing/material-preparation.ts`
- `src/pages/process-factory/accessory/webbing/pda-execution.ts`
- `src/pages/process-factory/accessory/webbing/pending-receipts.ts`
- `src/pages/process-factory/accessory/webbing/production-control-dialog.ts`
- `src/pages/process-factory/accessory/webbing/termination-disposition-dialog.ts`
- `src/pages/process-factory/accessory/webbing/tip-material-dispatch-form.ts`
- `src/pages/process-factory/accessory/webbing/tipping-form.ts`
- `src/pages/process-factory/accessory/webbing/version-replan-dialog.ts`
- `src/pages/process-factory/accessory/webbing/work-order-detail.ts`
- `src/pages/production-order-progress-tracking.ts`
- `src/pages/tech-pack/webbing-specification-dialog.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes.ts`

### 页面路由

- `/fcs/craft/accessory/webbing/work-orders`
- `/fcs/craft/accessory/webbing/base-orders`
- `/fcs/craft/accessory/webbing/pending-receipts`
- `/fcs/craft/accessory/webbing/handover-records`
- `/fcs/craft/accessory/webbing/pda`
- `/wls/accessory-continuous-stock`
- `/fcs/progress/production-orders/detail`

### 验证命令

- `npm test`：通过（411/411）
- `npm run build`：通过
- `npm run check:prototype-design-governance`：通过
- `node docs/product-design/tmf-webbing/trace-audit.py`：通过（161/161 evidence_bound）
- `node docs/product-design/tmf-webbing/validate-design-data.py`：通过
- `node docs/product-design/tmf-webbing/evidence/run-all-browser-current.mjs`：通过（59/59，head 0ad80208）
- `node docs/product-design/tmf-webbing/evidence/2026-09-21-tmf-strict-performance.mjs`：通过（1590 样本 max 465.44ms strictGate true）
- `node docs/product-design/tmf-webbing/evidence/2026-09-22-v2-features-browser.mjs`：通过（8/8 check）

### 真实图片验证

- `webbing-dyed-blue.jpg`（染色蓝织带）：来源 Wikimedia Commons CC BY-SA，1280×744；产出页缩略图与色号同块，大图可关闭。
- `webbing-printed-pattern.jpg`（印花织带）：来源 made-in-china 产品图，1280×1280；印花产出绑定。
- `tip-plastic-aglet.jpg`（塑料包头）：Wikimedia Commons CC BY-SA，1280×960；规格弹窗与打头表单同块展示。
- `tip-metal-aglet.jpg`（金属头）：Wikimedia Commons PD，800×600；同上。
- `tip-silicone-dip.jpg`（硅胶浸头）：made-in-china 产品图，800×800；同上。
- 来源登记：`docs/product-design/tmf-webbing/evidence/2026-09-22-tmf-image-sources.json`；页面标注“厂商/公共来源参考图”，不冒充工厂实拍；浏览器证据 5/5 可访问可解码。

### 例外

- 无
