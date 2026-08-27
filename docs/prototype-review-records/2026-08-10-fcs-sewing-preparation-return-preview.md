# FCS 车缝准备事实与回货预览原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-10 |
| 相关需求 / 任务 | 任务分配弹窗按 SKU 展示裁片事实、展示生产单车缝辅料库存/配料、在业务日期下展示 30/70/100 回货预览 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS；读取 PFOS 裁片事实和配料/库存事实 |
| 涉及页面路径 | `/fcs/dispatch/workbench` |
| 端类型 | 管理端 |
| 主要角色与任务 | 生产计划员/PPIC 为车缝或固定合并任务进行直接派单、发起竞价和改派前核对准备事实与回货承诺 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：直接派单/竞价/改派弹窗新增 SKU 维度裁片目标与放行表、生产单辅料库存与配料表、真实物料图及大图、业务分配日期下方的三段回货预览；选择 SKU 或日期时预览实时变化。准备风险仍是提示，不改变既有派单阻断边界。生产合同主模板没有变更。

完整产品审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端生产计划员在原任务分配弹窗完成核对，不新增旁路页面。 |
| 文案、状态、数量与单位 | 通过 | 裁片和任务数量使用“件”；辅料按条/套/公斤展示；风险放行直接说明差额；自然日和累计数量均明确。 |
| 扫码、真实图片与对象识别 | 通过 | 本场景不需要扫码；四种辅料均有对应物料图、同一信息块标识和高清大图，存在加载失败态。 |
| 防错、危险确认与主管兜底 | 通过 | 同一 SKU 不拆数量、价格二次确认保留；准备不足只提示不阻断，符合已确认边界。 |
| 交接、跨端事实与异常追溯 | 通过 | 裁片读取当前有效目标/放行版本，辅料读取生产单配料事实；回货预览与有效快照共用构造。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 本次为 1366×768 管理端；PDA、弱网、上传不在本次交互范围。整页无横向溢出，宽表在弹窗内滚动。 |
| 命名路由、交互、图片大图与打印 | 通过 | 命名路由、SKU 切换、日期重算、二次确认、大图及合同模板保真均已验收；合同主模板无差异。 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 裁片摘要最近时间最初只取矩阵时间，未纳入放行确认时间 | 算不准 | 生产计划员 | 取矩阵更新时间与当前有效放行确认时间中的较晚值，并增加固定断言 | 否 |
| 大图 Esc 最初会连同派单弹窗一起关闭 | 点错风险 | 生产计划员 | Esc 优先只清空大图预览，保留派单上下文 | 否 |
| 定标二次确认的回货比例标签最初读取了不存在的字段 | 算不准 | 平台定标员 | 直接从里程碑比例生成 30%/70%/100%，并加入源码契约 | 否 |
| 招标管理仍读取已删除的旧看板状态，无法接收任务分配新发起的竞价 | 走不通 | 生产计划员、平台定标员 | 建立共享招标事实，任务分配写入、招标管理读取，竞价业务日期贯穿定标 | 否 |
| 可直接承接车缝的工厂中包含明确不可竞价的主管指定工厂 | 点错风险 | 生产计划员、平台定标员 | 发起竞价时在能力匹配之后再执行竞价资格过滤，不可竞价工厂不进入候选池 | 否 |

## 6. 最终结论

结论：有条件通过。

说明：

- 两项业务契约和两条命名页面 Playwright 场景已通过；合同保真、原型治理、构建、CodeGraph 与第二轮正反向追踪均已完成。
- 全局列表治理仍被本次未改动的 `src/pages/wls-fabric-demand-board.ts` 阻断，因此项目任务收据如实为 `implemented`，不声明整库 `verified`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/production-demands.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-task-tenders.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/unified-dispatch-workbench.ts`

### 页面路由

- `/fcs/dispatch/workbench`

### 验证命令

- `npm run check:fcs-sewing-preparation-return-preview`：通过。
- `npm run check:fcs-unified-assignment-foundation`：通过。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43223 npx playwright test tests/fcs-unified-dispatch-preparation-return-preview.spec.ts --workers=1 --reporter=line`：通过，2/2。
- `npm run check:production-contract-template-fidelity`：通过。
- `npm run check:fcs-dispatch-bagging`：通过。
- `npm run check:sewing-reassignment-cold-start`：通过。
- `npm run check:standard-list-page-template`：通过。
- `npm run check:list-page-governance`：失败（本次未改动的 `src/pages/wls-fabric-demand-board.ts` 不在历史基线；本任务不越界修改 WLS 页面）。
- `npm run check:prototype-design-governance -- --all`：通过，9 个受管文件、1 份完整审查记录。
- `npm run build`：通过，2,323 个模块；无包体超阈值警告。
- `codegraph sync` / `codegraph status`：通过（同步成功；1,463 个文件、44,942 个节点、173,407 条边，待同步 0）。
- `npm run workflow:verify -- --output /private/tmp/higoods-fcs-prep-return-receipt.json --task-boundary "FCS任务分配车缝SKU裁片/辅料准备事实与30/70/100回货预览，含直接派单、竞价定标、改派一致性"`：失败（已生成收据，状态 `implemented`；唯一阻塞为上述全局 WLS 列表治理项）。
- `git diff --check`：通过。

### 真实图片验证

- 图片来源：仓库 `public/materials/` 中与前中拉链、主唛、洗护唛、缝纫线一一对应的正式物料图片。
- 对象对应：每行同时展示缩略图、物料名称、物料编码、颜色和规格。
- 缩略图：4/4 在命名页面加载成功，`naturalWidth > 0`。
- 大图：点击前中拉链缩略图打开高清预览；图片加载成功；Esc 关闭大图后派单弹窗仍保留。
- 失败态：缩略图和大图均保留可见错误文案，不以无关占位图替代。
- 截图证据：`/private/tmp/higoods-fcs-prep-return-evidence/direct-second-confirm.png`、`bidding-return-preview.png`、`tender-award-second-confirm.png`、`reassignment-readonly-scope.png`。

### 例外

- 本次验收不修改、不迁移 `src/pages/wls-fabric-demand-board.ts`，也不修改标准列表历史基线。该全局治理失败与本次 FCS 调整无文件或业务范围交集，但会阻止项目级任务收据进入 `verified`。
- 构建仍提示 Browserslist 数据较旧和 Node 26 `module.register()` 弃用；二者属于仓库工具链依赖提示，本次未进行依赖升级，且不影响命名页面、专项契约与合同保真结果。
