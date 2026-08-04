# 裁片补料供应节点与独立配料需求原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-04 |
| 相关需求 / 任务 | 按《补料业务调整方案》《补料业务实施计划》完成唯一创建入口、供应判断、采购缺口、先染后印、独立配料需求、六列节点详情和裁片单完成入口 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS / WLS |
| 涉及页面路径 | 补料管理、补料详情、裁片单列表、布料业务详情、中转仓裁床配料、仓库 PDA 待处理 |
| 端类型 | 管理端 / 主管端 / 员工执行端 |
| 主要角色与任务 | 裁床业务创建和完成人员核对补料；仓管查看独立需求并配料；染色、印花执行人员按加工准入处理；PDA 操作员只领取当前物理可领物料 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：补料创建增加全仓库存、采购在途和缺口风险确认；列表与详情调整为统一节点事实；裁片单只保留只读布料业务详情和操作栏完成；中转仓新增独立补料需求组；染色、印花增加先染后印执行阻断；Web 与 PDA 的需求、到仓、可配、已领口径统一；款式与物料图片补齐真实缩略图和大图查看。

当前审查依据：

- `AGENTS.md` 第 4 节印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节 UI、标准列表和真实图片门禁。
- `AGENTS.md` 第 7 节分层验证与证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 补料管理是唯一创建入口；裁片单只读查看并从操作栏完成；仓库与 PDA 不提供创建、编辑或完成补料。 |
| 文案、状态、数量与单位 | 通过 | 主状态只有未完成/已完成；库存、采购、加工、配料使用中文节点状态；批准需求、加工可供、到仓、可配、已配、已领、剩余分开并带单位。 |
| 扫码、真实图片与对象识别 | 通过 | 补料列表、详情、裁片单和配料列表中的款式与物料均使用对应本地图片；PDA 继续使用当前仓库任务身份和扫码入口。 |
| 防错、危险确认与主管兜底 | 通过 | 无库存无在途先提示不建议创建，再由业务二次确认；单位不一致不参与覆盖；未处理差异阻断完成；染色未合格完成阻断印花。 |
| 交接、跨端事实与异常追溯 | 通过 | Web、仓库列表、PDA 和加工节点读取同一补料、采购、加工及独立配料事实；单号、人员、时间、数量和来源可追溯。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 中转仓配料在 1024×768 可查看主要任务；PDA 在 390×844 可完成现有待处理任务；本次未新增上传，弱网继续沿用现有明确反馈。 |
| 命名路由、交互、图片大图与打印 | 通过 | 命名 Web/PDA 路由已实际验收；缩略图可打开高清大图并支持 Esc；本次未新增或修改打印入口、模板与路由。 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 裁片放行快照创建时曾读取到通用占位款式图 | 选不对 | 裁床业务 | 改为从同一生产单中选择已配置的真实款式图，并在确认前执行图片硬校验 | 否 |
| PDA 仓库待处理页缺少共享库位函数导入 | 协作断裂 | PDA 仓管 | 补齐共享事实函数导入并回归实际 PDA 路由 | 否 |
| 旧页面自动化仍等待旧确认按钮与旧详情完成旁路 | 点错风险 | 裁床业务 | 按当前风险知悉和操作栏完成交互更新自动化契约 | 否 |
| 合并主干时自动合并漏掉生产单身份与确认键防重判断 | 重复处理 | 裁床业务 | 恢复生产单身份、按生产单查询和确认键跨单防重，并在主干重跑 22 项生命周期检查 | 否 |

## 6. 最终结论

结论：通过

说明：补料唯一入口、供应判断、采购缺口、加工顺序、独立配料需求、节点详情、裁片单完成和 Web/PDA 同源均形成当前工作树直接证据；没有保留采购失败、调拨单、整体预计可配料时间或详情完成旁路。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/cut-order-supplement-fixture.ts`
- `src/data/fcs/cutting/order-progress.ts`
- `src/data/fcs/cutting/pickup-demand-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/supplement-order-registry.ts`
- `src/data/fcs/cutting/supplement-records.ts`

上述旧补料记录文件已删除，由唯一补料生命周期事实源替代。
- `src/data/fcs/cutting/supplement-material-prep-demand-registry.ts`
- `src/data/fcs/cutting/supplement-node-facts.ts`
- `src/data/fcs/cutting/supplement-purchase-order-registry.ts`
- `src/data/fcs/cutting/supplement-supply-domain.ts`
- `src/data/fcs/supplement-print-prerequisite.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/pages/process-factory/cutting/supplement-management.ts`
- `src/pages/process-factory/cutting/cut-orders.ts`
- `src/pages/process-factory/cutting/meta.ts`
- `src/pages/process-factory/cutting/pickup-management-list.ts`
- `src/pages/process-factory/cutting/pickup-management-projection.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/runtime/fcs/cutting/pickup-management-runtime.ts`

### 页面路由

- `/fcs/craft/cutting/supplement-management`
- `/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=cpr-target-po-14671-v9`
- `/fcs/craft/cutting/cut-orders?cutOrderNo=CUT14671-B`
- `/fcs/material-prep/cutting/pickup?tab=incomplete&keyword=SUP-CUT14671-B-002`
- `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup`

### 验证命令

- `npx tsx --test tests/supplement-order-registry.test.ts`：通过，22 项。
- `npm run check:cutting-supplement-supply-decision`：通过。
- `npm run check:cutting-supplement-node-facts`：通过。
- `npm run check:cutting-supplement-process-work-orders`：通过。
- `npm run check:material-prep-pickup-management`：通过。
- `npm run check:cutting-pickup-three-list`：通过。
- `npm run check:pda-pickup-flow`：通过。
- `npm run check:cutting-pickup-data-closure`：通过。
- `npm run check:list-page-governance`：通过；静态规则、标准列表浏览器列拖拽及 20 个用户可见文件的原型治理记录均通过。
- `npm run check:prototype-design-governance -- --all`：通过；由列表治理命令一并执行。
- `npm run build`：通过。
- 合并至 `main` 后重新执行补料生命周期、供应决策、节点事实、加工单、中转仓/PDA、列表治理和构建检查；主干冲突修复后的补料生命周期检查为 22/22 通过。
- `npx playwright test tests/cut-order-supplement-linkage.spec.ts --grep '放行快照创建真实补料'`：通过，确认风险确认后生成真实补料单并回到对应裁片单。
- `npx playwright test tests/cut-order-supplement-linkage.spec.ts --grep '补料详情只读|操作栏一次只完成'`：通过 2 项，确认裁片单详情只读且只能从操作栏逐单完成。
- `npx playwright test tests/supplement-management-list-template.spec.ts --grep '放行目标快照直接预填多物料多部位缺口|快照补料确认后冻结来源与数量'`：通过 2 项，确认快照涉及多张裁片单时分别选择，创建后冻结所选原裁片单及数量。
- `npx playwright test tests/supplement-management-list-template.spec.ts --grep '默认分页、三态排序|筛选与重置|列显示、顺序、冻结和每页条数持久化' --workers=1`：通过 3 项；首次下一页 DOM 响应 123.7ms，列表筛选、分页、排序、列偏好及局部刷新均符合要求。
- `npx playwright test tests/cutting-pickup-three-list.spec.ts --grep '同一物料 SKU 的两次补料'`：通过，确认两次补料保持独立需求和独立物料行。
- `npx playwright test tests/cutting-pickup-three-list.spec.ts --grep '加工路线筛选覆盖'`：通过，确认无需加工、染色、印花、先染后印四类可分别筛选。

### 真实图片验证

- 款式图：本地 `/tshirt-sample.jpg`，对应 ASYSA26060310 女式基础圆领短袖；与款号、款名同一信息块展示。
- 物料图：本地 `/materials/fabric-main.jpg`、`/materials/fabric-contrast.jpg`、`/materials/fabric-lining.jpg` 等，按冻结物料身份对应展示，不使用无关通用图。
- 补料列表、详情、裁片单和中转仓配料均显示缩略图；缩略图可打开保持比例的大图，支持关闭按钮、遮罩和 Esc。
- 图片缺失和加载失败有明确可见状态；确认补料前对缺少真实图片进行阻断，不显示静默破图。
- 使用 Playwright CLI 在当前服务实际打开补料管理，确认款式图与物料图均有可理解的替代说明；款式大图弹窗正常显示并通过 Esc 关闭，截图保存在 `.playwright-cli/page-2026-08-04T13-19-51-766Z.png`。

### 例外

- 无
