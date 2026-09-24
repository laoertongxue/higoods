# 生产准备七类专业任务列表与多明细进度

## 1. 基本信息

- 日期：2026-09-25；分支 codex/preparation-list-business，基线 aac68249a0d32dcd71807811684ebf94dbf7cc79。
- 工作树：/tmp/higoods-preparation-list-business；预览端口 4192，由此工作树 dist 提供。
- 需求：`docs/product-design/生产准备专业任务列表与多明细完成规则-2026-09-25.md`。
- 完整产品审查，管理端。用户明确覆盖制版、花型、调色、辅料下单、首单样衣、销售展示样衣、技术包确认与准备单。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：七类列表的信息、查询、统计、导出、列设置和明细展开，以及准备单内部明细进度改变。
- 基线：AGENTS.md 第 4、5、7 节；参照 `/fcs/craft/dyeing/work-orders`。

## 3. 自查结论

| 项目 | 结论 | 依据 |
| --- | --- | --- |
| 对象与完成条件 | 通过 | 任务与内部有效需求行分别计数；同SKU多颜色要求不合并；已结束需求排除；没有需求不视为全部完成 |
| 责任与动作 | 通过 | 当前团队、执行人、跟单、计划、阻断和真实详情入口；展示样衣保留设计改款来源 |
| 明细事实 | 通过 | 花型/调色全部有效行审核；辅料全部SKU覆盖下单；无需到货即可满足下单完成口径 |
| 查询交互 | 通过 | 条件在内存，查询才生效；统计/表格/导出同范围；无结果及倒置日期有反馈 |
| 图片与设备 | 通过 | 真实款图/物料图同单元格、明细展开、图片失败/大图/Escape；1366和1280 |
| 性能 | 通过 | 本轮页面最终复验全部低于500ms；原始样本见下方证据 |

## 4. 问题标签

- 业务推进信息不足：新增责任、计划、要求、完成明细、结果及下一步。
- 多明细误读：显示已通过/全部有效项，辅料显示覆盖下单而非到货。

## 5. 主要问题与处理

原专业列表多数仅有团队筛选和简略字段。现在七类共用 `business-list.ts`，复用染色页统计和标准列表控制器，删除旧重复列表与无引用的 master-task-page 工厂。专业详情与执行服务不改变。

只读进度在 `pcs-engineering-task-item-progress.ts`；不依据展示状态回写业务记录。原花型、调色、辅料服务已经具备全部完成门禁，通过相关专项重新验证。调色旧测试改用满足测款通过规则的统一测试数据。

## 6. 最终结论

结论：通过

本轮已完成实现与命名页面验证。代码留在独立工作树，未提交、合并、推送或声明线上完成；用户最终页面验收尚待进行。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-task-item-progress.ts`
- `src/pages/pcs-engineering-tasks/business-list.ts`
- `src/pages/pcs-engineering-tasks/master-task-page.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/purchase-task.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/pages/pcs-engineering-master-list.ts`

### 页面路由

- `/pcs/production-preparation/orders`
- `/pcs/production-preparation/plate-making`
- `/pcs/production-preparation/artwork`
- `/pcs/production-preparation/color`
- `/pcs/production-preparation/purchase`
- `/pcs/production-preparation/first-sample`
- `/pcs/production-preparation/display-sample`
- `/pcs/production-preparation/tech-pack`

### 验证命令

- `node --import tsx tests/pcs-engineering-material-review.spec.ts`：通过，多花型部分通过/返工/全部通过。
- `node --import tsx tests/pcs-engineering-color-stages.spec.ts`：通过，多调色有效行与结束行、部分审核、返工及完成时间。
- `node --import tsx tests/pcs-engineering-purchase-linkage.spec.ts`：通过，多采购单覆盖、无效/缺失事实等边界。
- `node --import tsx --test tests/unit/pcs-professional-item-progress.test.ts tests/unit/pcs-professional-list-query.test.ts tests/unit/pcs-preparation-list-business.test.ts`：通过，进度/筛选。
- `npm run build`：通过，458项测试通过，构建日志 `/tmp/professional-complete-build.log`。
- `npx tsc --noEmit --pretty false`：失败，仓库原有的 FCS dye-work-order-online-view、factory-receiving-source-sync 和 PMS tmf-material-purchases 类型错误；本次修改文件无类型报错，不修改无关文件。

### 浏览器证据

- `output/playwright/professional-list-check.json`：首轮900样本，最高282.7ms，35组合场景，无页面错误。最终版本复验另行记录。
- `output/playwright/professional-*-1366.png` 与 `*-1280.png`：七类页面，分别在1366×768和1280×720查看。
- `output/playwright/professional-*-export-*.csv`：每类有结果场景5份；全筛选范围（如制版32条、花型20条、展示样衣11条），不局限当前页。
- 所有多行数据为隔离验收浏览器中的构造场景，未新增线上业务事实或更改用户浏览器。

### 真实图片验证

- 款式读取款式档案或设计改款设计文件；物料读取物料SKU/档案真实图；图片和对象标识同一单元格。
- 款图、物料图打开原图，遮罩/按钮/Escape关闭，加载和失败提示。
- 缺失图片明确显示，不用通用占位图。没有新增图片数据与业务附件写入。

### 例外

- 按用户明确要求使用染色页72px六卡统计样式，覆盖旧48px标准；无工厂Tab，不照搬染色专用动作。
- 查询与行展示不新增业务保存。既有生产准备仓储/演示初始化/独立任务仍存在旧存储依赖，本次没有宣称迁移完成。未初始化演示且无用户任务时列表显示空；既有用户数据可直接从各专业路由读取，不要求先开准备单。
- 路由偏好键为 `higood:pcs:<path>:business-list:v1`，固定6列顺序、显隐、冻结和每页数量，大小有界小于1KiB，默认10条、不冻结。沿用原标准列表控制器，不更改公共组件或业务存储后备。
- 不涉及PDA、打印或新增业务状态写入。全量类型检查的无关基线错误保留。

### 旁路发现与范围收口

相邻参考页核查发现设计改款首次进入1次504ms、染色加工单518.2–677.3ms，原始数据保留 professional-adjacent-check.json。这两页不在本次改造范围；没有将其标为性能通过。公共控制器额外的偏好保护改动已撤回，保持原实现，本次不借列表改造扩大为全站性能或存储修复。七类专业列表和准备单的验收单独记录。相邻核查初次脚本等待了屏外懒加载图片，并误假定列设置有dialog语义；脚本修正后执行，原失败日志保留。

### 最终版本证据（覆盖此前阶段记录）

- `professional-delivery-check.json`：七类页面900个样本，最大262.6ms，无页面错误；35个分辨率/场景组合核查。
- `professional-delivery-extra.json` 中 extra：320个首访/来源与任务跳转/列拖动/图片场景样本，最大437.1ms，无超时、页面错误或缺图对象。
- `professional-parent-final.json`：准备单内部花型只通过1/2项时显示剩余1项，5次刷新116.9–125.8ms；截图 `professional-parent-progress.png`。最终补齐已因需求变更结束的前置不再显示为等待事项，与仓储解锁口径一致，相关单测通过。
- `professional-filter-controls.json`：七类列表的团队、来源、执行人条件共105次操作，全部低于500ms。
- 最终受影响场景共1330个计时样本，最大437.1ms。证据均在 `output/playwright/`，当前源码SHA256见 `professional-version.json`。
- `professional-export-validation.json`：30份CSV逐份读取，列数、记录数、全筛选范围和无操作列通过。
- `/tmp/professional-complete-build.log`：当前完整构建与458项单测通过。专项花型/调色/辅料门禁及列表治理通过。
- `npm run check:list-page-governance`：通过，含真实Chromium列拖动和原型审查覆盖；公共列表控制器已恢复原实现，没有公共组件差异。
- 最终完整diff已审查：七类旧重复列表收口、详情事件与路由保留、没有新业务保存入口、没有夹带主工作树改动。

### 发布核对

- 发布前重新获取 origin/main：仍为 aac68249a0d32dcd71807811684ebf94dbf7cc79，无并发主线差异。
- professional-version.json 中11个源码文件 SHA256 与待发布代码一致，沿用最终页面与性能证据。
- 任务收据输出位置：/tmp/preparation-list-task-receipt.json；远端交付状态以该收据及 GitHub main 提交为准。
- 首次 workflow:verify 因隔离工作树尚未初始化 CodeGraph 而提前失败；初始化索引后重新运行，不将首次失败算作通过。
- 主工作区已有的裁后处理产品方案未纳入本次发布。
