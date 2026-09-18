# WLS 标准列表页可用性与交互修复（2026-09-19）

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-19 |
| 相关需求 / 任务 | WLS 迁移后用户验收发现的三类可见缺陷：表格列缺失、操作按钮无响应、菜单死链接 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | WLS |
| 涉及页面路径 | /wls/finished/*、/wls/transit/*、/wls/raw/*（共 54 个标准列表页） |
| 端类型 | 管理端 |
| 主要角色与任务 | 仓管与中转仓作业员查看单据列表、推进收货/上架/出库/调拨状态、导出查询结果 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：
  1. **表格列**：44 个页面默认只渲染“主单号 + 操作”两列（其余列被错误默认隐藏），现改为默认全部列可见，与参照页 `/fcs/craft/dyeing/work-orders` 一致。
  2. **操作按钮**：WLS 页面事件处理器从未接入 `main.ts` 分发链路，且 44 个文件用 `EVENT_PREFIX.replace(/-/g, '')` 生成全小写 dataset 键（真实键是驼峰），导致分页、排序、筛选、列设置与行操作全部无响应。现已接入分发并改用运行时派生的 `DATASET_PREFIX`。
  3. **行操作语义**：为 27 个页面的行操作补齐真实行为——查看详情打开行详情弹窗；收货/上架/出库/调拨/作废/交接等推进类动作先二次确认再改状态并给出结果反馈；导出改为真实 CSV 下载并反馈条数。
  4. **菜单**：删除两个无路由注册的死链接（库存管理 `/wls/inventory`、出库管理 `/wls/outbound`），其功能由成衣仓/原料仓分组内已存在页面覆盖。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端标准列表，按“标题与主操作 → 查询卡片 → 统计卡片 → 列表卡片 → 分页”排列 |
| 文案、状态、数量与单位 | 通过 | 反馈与确认文案带单号、数量和单位，如“已发出 15 件，运往 自有工厂D组” |
| 扫码、真实图片与对象识别 | 不适用 | 本轮改动不新增款式/物料图片位；原有图片列未变更 |
| 防错、危险确认与主管兜底 | 通过 | 收货/上架/出库/调拨发出/签收/作废/工厂确认与拒绝均走二次确认并说明不可撤销；库位仍有物料时阻断释放并提示原因 |
| 交接、跨端事实与异常追溯 | 通过 | 确认文案明确交出方与接收方、应交与实交数量；异常记录标记已处理时写入处理人与处理时间 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 详情与确认弹窗使用 `max-w-[90vw]` 与内部滚动，1280×720 不溢出；PDA 页面未改动 |
| 命名路由、交互、图片大图与打印 | 通过 | 见第 7 节验证命令与浏览器实测 |

## 4. 问题标签

- `组件误用`
- `点错风险`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 44 个列表页默认隐藏业务列，只剩主单号与操作 | 组件误用 | 仓管、作业员 | 默认 `visibleKeys` 改为全部列，与参照页一致 | 否 |
| 全部 WLS 按钮无响应（事件未分发 + dataset 键名大小写错误） | 组件误用 | 全部 WLS 角色 | 新增 `dispatchWlsPageEvent` 接入 75 条路由；187 处键名改为运行时派生驼峰 | 否 |
| 行操作按钮存在但无行为 | 点错风险 | 仓管、作业员 | 详情弹窗、二次确认 + 状态推进 + 结果反馈、真实 CSV 导出、跨页跳转 | 否 |
| 菜单存在两个无路由死链接 | 组件误用 | 全部 WLS 角色 | 删除死链接，保留有真实页面的入库管理与成衣仓收货 | 否 |

## 6. 最终结论

结论：通过

说明：

- 三类用户可见缺陷均已修复并在当前分支、当前工作树、实际运行页面上复验。
- 二次确认覆盖交接与不可逆动作，符合第 4.2 节防错要求。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/list-export.ts`
- `src/components/ui/list-feedback.ts`
- `src/components/ui/list-table.ts`
- `src/data/app-shell-config.ts`
- `src/main-handlers/wls-page-handlers.ts`
- `src/main.ts`
- `src/pages/wls/finished/basic-barcode-rule.ts`
- `src/pages/wls/finished/basic-basket.ts`
- `src/pages/wls/finished/basic-collection-box.ts`
- `src/pages/wls/finished/basic-label-config.ts`
- `src/pages/wls/finished/basic-processor.ts`
- `src/pages/wls/finished/basic-product-center.ts`
- `src/pages/wls/finished/basic-subject.ts`
- `src/pages/wls/finished/basic-supplier.ts`
- `src/pages/wls/finished/basic-warehouse.ts`
- `src/pages/wls/finished/basic-zone-location.ts`
- `src/pages/wls/finished/collection-orders.ts`
- `src/pages/wls/finished/collection-picking.ts`
- `src/pages/wls/finished/collection-records.ts`
- `src/pages/wls/finished/collection-removal.ts`
- `src/pages/wls/finished/collection-sorting.ts`
- `src/pages/wls/finished/inventory-count.ts`
- `src/pages/wls/finished/outbound-orders.ts`
- `src/pages/wls/finished/pre-inbound.ts`
- `src/pages/wls/finished/pre-outbound.ts`
- `src/pages/wls/finished/putaway.ts`
- `src/pages/wls/finished/return-inbound.ts`
- `src/pages/wls/finished/return-orders.ts`
- `src/pages/wls/finished/return-quality.ts`
- `src/pages/wls/finished/ship-scan.ts`
- `src/pages/wls/finished/sorter-gate-config.ts`
- `src/pages/wls/finished/sorter-machine-config.ts`
- `src/pages/wls/finished/sorter-records.ts`
- `src/pages/wls/finished/stock-flow.ts`
- `src/pages/wls/finished/stock-location.ts`
- `src/pages/wls/finished/stock-realtime.ts`
- `src/pages/wls/finished/stock-transfer.ts`
- `src/pages/wls/finished/wave-manage.ts`
- `src/pages/wls/raw/accessory-inventory-count.ts`
- `src/pages/wls/raw/accessory-transfer.ts`
- `src/pages/wls/raw/arrival-list.ts`
- `src/pages/wls/raw/fabric-inventory-count.ts`
- `src/pages/wls/raw/fabric-score.ts`
- `src/pages/wls/raw/fabric-transfer.ts`
- `src/pages/wls/raw/inbound-list.ts`
- `src/pages/wls/raw/issue-list.ts`
- `src/pages/wls/raw/outbound-list.ts`
- `src/pages/wls/raw/requisition-list.ts`
- `src/pages/wls/raw/stock-flow.ts`
- `src/pages/wls/raw/stock-location.ts`
- `src/pages/wls/transit/allocation-manage.ts`
- `src/pages/wls/transit/inbound-manage.ts`
- `src/pages/wls/transit/inventory-manage.ts`
- `src/pages/wls/transit/kit-center.ts`
- `src/pages/wls/transit/location.ts`
- `src/pages/wls/transit/outbound-manage.ts`
- `src/pages/wls/transit/putaway-manage.ts`
- `src/pages/wls/transit/receive-manage.ts`
- `src/pages/wls/transit/warehouse-transfer.ts`
- `src/pages/wls/transit/work-area-manage.ts`

### 页面路由

- `/wls/transit/allocation-manage`：17 列全部渲染；查看详情打开 16 字段弹窗；裁厂接收二次确认后状态变为“已接收”、按钮消失并给出反馈；导出提示“已导出 5 条记录”；排序、列设置、每页条数均生效
- `/wls/raw/arrival-list`：11 列渲染；详情弹窗 10 字段；导出 12 条
- `/wls/transit/warehouse-transfer`：12 列；提交后反馈“调拨单 TR-TF-20260716-005 已提交，等待 自有工厂C组 拣货”；确认发出弹窗 → 确认后反馈“已发出 15 件，运往 自有工厂D组”
- `/wls/finished/basic/label-config`：12 列；编辑弹窗预填 3 个字段，保存后表格尺寸列更新为 80×120mm 且更新时间刷新
- `/wls/finished/collection/picking`：12 列；作废二次确认后反馈“拣货波次 JH-WAVE-20260829-001 已作废，占用库存已释放”
- `/wls/finished/dashboard`、`/wls/finished/collection/orders`：站内导航与列表渲染正常

### 验证命令

- `npx tsc --noEmit`（WLS 页面、共享组件、main.ts、router 范围）：通过，0 错误
- `npm run check:list-page-governance:static`：通过（scanned 499 pages, baseline 17）
- `npm run check:standard-list-page-template`：通过（含 Chromium 列拖拽实测）
- `npm run check:prototype-design-governance -- --all`：通过（补齐本记录并列全 60 个受管文件后复跑）
- 浏览器实测（本地 Vite 服务 http://localhost:5190，逐路由见上一节）：通过

### 性能验证（AGENTS.md 第 7.2 节）

测量环境：`npm run build` 产物 + `npm run preview` 本地服务 http://localhost:5191，Chromium，无节流；计时终点为“应展示内容就绪且可交互”，使用注入在应用代码之前的 MutationObserver 记录，不使用平均值、不剔除慢样本。

| 路由 | 场景 | 样本 | 最大值 | 判定 |
| --- | --- | --- | --- | --- |
| `/wls/transit/allocation-manage` | 冷加载内容就绪 | 1 | 63.9ms（导航起算 81.2ms） | 通过 |
| `/wls/transit/allocation-manage` | 站内切换进入 | 5 | 12.9ms | 通过 |
| `/wls/transit/allocation-manage` | 打开详情弹窗 | 1 | 28.2ms | 通过 |
| `/wls/transit/allocation-manage` | 关闭详情弹窗 | 1 | 6.1ms | 通过 |
| `/wls/transit/allocation-manage` | 打开二次确认 | 1 | 7.9ms | 通过 |
| `/wls/transit/allocation-manage` | 确认执行 | 1 | 6.4ms | 通过 |
| `/wls/transit/allocation-manage` | 导出 | 1 | 5.5ms | 通过 |
| `/wls/finished/collection/orders` | 冷加载内容就绪 | 1 | 129.6ms | 通过 |
| `/wls/raw/issue-list` | 冷加载内容就绪 | 1 | 344.5ms | 通过 |
| `/wls/raw/issue-list` | 工厂确认 → 确认执行 | 1 / 1 | 9.1ms / 4.0ms | 通过 |

- 全部样本最大值 344.5ms，严格低于 500ms；无样本达到或超过 500ms。
- 覆盖范围说明：本轮按风险抽样覆盖三个模块各 1 条冷加载路由与改动最密集的配料任务页全部新增交互入口；其余标准列表页共用同一套渲染与事件分发路径，未逐条出具 5 次样本。
- 结论：**第 7.2 节门禁在本次抽样的路由与交互上通过**；未抽样的路由按“抽样充分证据 + 共用代码路径”判定，如需逐路由回执需再补测。

### 例外

- 9 个非标准列表页（`*/dashboard`、`*/pda`、`*/overview`、`multi-item-packing`）不导出页面事件处理器，本轮未接入 `dispatchWlsPageEvent`；其页面为工作台/PDA 形态，标准列表按钮不受影响。
