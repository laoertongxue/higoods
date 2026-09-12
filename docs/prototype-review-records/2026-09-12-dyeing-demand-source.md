# 染色加工单需求来源审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 | 2026-09-12 |
| 需求 | DS-001..005，见需求来源设计与追踪矩阵 |
| 系统与角色 | PFOS 染厂管理，管理端/主管端，跟单查看与打印染色单 |
| 端类型 | Web 管理列表、详情、编辑弹窗、A4 流程卡 |
| 版本 | codex/dyeing-demand-source，基于 996fae8d；当前目录 Vite 5188 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：加工单/商品第一部分加工厂下方增加浅蓝来源块；编辑增加只读来源，独立详情统一名称；流程卡新增来源类型，查询及三种导出补上来源。既有字段顺序、分组和数量规则保留。
- 基线：AGENTS.md 第 4、5、7 节；仅原型展示，不代表真实工厂业务发生。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 保留管理表格、详情和编辑弹窗，沿用分页/列设置 |
| 文案、状态、数量、单位 | 通过 | 来源复用已有枚举，不改变状态、数量或上下游；22 行来源均有具体值 |
| 来源对象识别 | 通过 | 生产来源与备货来源区分；补料标签不覆盖订单来源类型 |
| 防错与危险动作 | 通过 | 来源只读且无提交字段；没有新增危险动作 |
| 交接、跨端与追溯 | 不适用 | 只增来源展示，不改变接收/交出/库存规则 |
| 分辨率、交互、图片 | 通过 | 1366×768、1280×720；编辑保存刷新及大图/失败恢复 |
| 打印 | 通过 | 单张与混合来源批量 A4，每张保留需求单号和签认区 |

## 4. 问题与处理

| 问题 | 处理 |
| --- | --- |
| 来源数据存在但列表漏显 | 加工厂下方蓝底展示，其他内容顺序保持 |
| 编辑缺少来源、独立详情名称不同 | 只读来源，统一“需求来源” |
| 流程卡只有需求单号没有来源类型 | 增加双语来源行，保留原需求单号 |
| 查询和导出漏来源 | 三种 CSV 同列，综合查询同源 |

## 6. 最终结论

结论：通过

两轮原型验收通过：22 行需求来源具体，列表/查看/独立详情/只读编辑一致，保存刷新保留；单张 PDF 为 1 页，3 单混合来源批量 PDF 为 3 页。原需求单号、签认区及图片完整。最终交付门禁结果另见任务收据；不声明产品接受。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/dye-work-order-online-view.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/print/templates/dye-work-order-flow-card-template.ts`

### 页面路由

- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/dyeing/work-orders/DWO-001`
- `/fcs/craft/dyeing/work-orders/DWO-013`
- `/fcs/craft/dyeing/work-orders/DYE-WATER-PO-202603-081`
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001`
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001,DWO-013,DWO-002`

### 验证命令

- `node --import tsx scripts/check-dyeing-demand-source.ts`：通过
- `node --import tsx scripts/check-dyeing-list-sections.ts`：通过
- `node --import tsx scripts/check-dyeing-single-upstream.ts`：通过
- `npm run typecheck:engineering`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:list-page-governance:static`：通过
- `npm run check:standard-list-page-template`：通过
- `npm run build`：通过
- `node /private/tmp/dye-demand-source-acceptance/browser.mjs`：通过
- `npm run workflow:verify -- --output /private/tmp/dye-demand-source-acceptance/task-receipt.json --task-boundary "DS-001..005 染色加工单需求来源展示"`：失败（首次仅审查记录章节编号不符合检查器；已修正。最终重跑结果以同路径任务收据为准）

第一轮为 22 行数据、详情/编辑/打印渲染与原数量/上游回归；第二轮为当前工作树页面交互和 PDF 验收。证据目录 `/private/tmp/dye-demand-source-acceptance/`。

### 真实图片验证

- 沿用原商品与物料图片，包括 `public/materials/fei-ticket/` 和 `public/materials/process-orders/`，没有替换或新增图片。
- 第一部分仍以商品图片、名称、编码同块展示；打印沿用商品、投入物料和目标色样。
- 本地列表缩略图加载、大图 Esc 关闭、加载失败提示与恢复已核对；打印图片均加载成功；PDF 渲染检查单张与补料页，签认区及页尾完整。

### 例外

- 不修改毛织、印花、PDA、条码内容或订单生成规则。
- 既有“裁片补料生成”枚举保留，不为了演示此标签而伪造当前 22 行染色来源。
- 本次只增加来源类型显示，既有需求单号使用当前原型原有字段，未新增来源维护入口。

浏览器结果：`/private/tmp/dye-demand-source-acceptance/browser-results.json`。截图：`source-cell-1366.png`、`list-1280.png`、`view-DWO-001.png`、`edit-DWO-013.png`、`detail-DYE-WATER-PO-202603-081.png`、`print-single.png`。PDF：`single.pdf`（1 页）、`batch.pdf`（3 页）；打印渲染图 `pdf-single.png`、`pdf-batch-supplement.png`。
