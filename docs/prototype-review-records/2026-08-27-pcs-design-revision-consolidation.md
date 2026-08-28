# PCS 设计改款合并、工程变更删除与生产准备时效收口审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-27 |
| 相关需求 / 任务 | 合并“改款打样”与“设计打样”为“设计改款任务”；删除工程变更；技术包仅由工程主单生成；生产准备时效仅读工程主单事实 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | `/pcs/engineering/design-revision`、`/pcs/engineering/design-revision/:taskId`、`/pcs/engineering/masters`、`/pcs/technical-data/tech-packs`、`/fcs/production/preparation-timing` |
| 端类型 | 管理端 |
| 主要角色与任务 | 买手准备目标颜色、BOM 与价格；跟单上传设计稿、确认工作安排和整单；专业团队执行真实任务；FCS 只读工程主单准备进度 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：生产工程菜单、列表、详情步骤、任务类型、编号、设计稿真实上传、BOM 与价格、专业任务投影、技术包来源、生产准备时效数据源、旧路由和旧工程变更能力均发生可见变化。

完整产品审查使用当前治理基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 买手→跟单→专业团队→跟单四步明确；列表仅保留“当前需处理的团队”筛选。 |
| 文案、状态、数量与单位 | 通过 | 统一为“设计改款任务”和 `ES-DR-*`；样衣要求按颜色×尺码×数量表达。 |
| 扫码、真实图片与对象识别 | 通过 | 款式图与对象同块展示；设计稿、任务效果图、PRJ/Zip 纸样文件必须真实上传并可回读。本次不涉及扫码。 |
| 防错、危险确认与主管兜底 | 通过 | A/B 款必须已建档且不得相同；设计稿、颜色 BOM 与价格、前置任务均有提交门禁。 |
| 交接、跨端事实与异常追溯 | 通过 | 完成每步后从领域事实重新读取最新步骤；上传和替换保留操作历史。 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 本次为管理端桌面页，PDA 不适用；真实上传已验证成功路径与阻断，原型不实现真实离线队列。 |
| 命名路由、交互、图片大图与打印 | 通过 | 统一路由、详情四步、旧路由下线、实际上传及纸样下载已验证；本次不涉及打印。 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 设计与改款被拆成两套同质流程 | 读不懂 | 跟单、买手 | 合并为一套设计改款任务，统一对象、页面、状态和编号 | 否 |
| 技术包存在制版、花型、手工新增等绕行来源 | 协作断裂 | 跟单、研发 | 仅保留工程主单“技术包确认任务”生成入口 | 否 |
| 生产准备时效可能读取独立打样或保留写入操作 | 追溯不足 | 跟单、生产管理 | 收口为仅读工程主单及其专业任务 | 否 |
| 成功动作后页面可能停在旧步骤 | 状态不一致 | 买手、跟单 | 动作成功后重新读取事实并进入最新步骤 | 否 |
| A 款存在多份已确认 BOM 时来源不确定 | 易选错 | 买手 | 按完成确认时间或更新时间倒序选择最近一份 | 否 |
| 项目详情缺少实例字段渲染函数 | 页面不可用 | 项目跟单 | 补齐字段渲染并重跑项目实例、关系与一致性检查 | 否 |
| 项目详情和渠道写入结果残留旧改款字段 | 术语残留 | 研发、产品 | 删除旧动态支持声明、死函数和旧返回字段，保留统一设计改款关系 | 否 |

## 6. 最终结论

结论：通过。

说明：

- 业务边界、菜单和路由、四步交接、真实上传、技术包唯一入口、FCS 时效只读已形成同一事实口径。
- 第一轮正向追踪与第二轮反向追踪均已通过；第二轮在最终源码上重新执行核心专项、构建、列表治理和真实文件浏览器场景。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/production-tech-pack-snapshot-types.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-version.ts`
- `src/data/pcs-engineering-change-workspace.ts`
- `src/data/pcs-engineering-file-upload.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-preparation-projection.ts`
- `src/data/pcs-engineering-task-field-policy.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-first-sample-project-writeback.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-plate-making-repository.ts`
- `src/data/pcs-plate-making-types.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-project-archive-collector.ts`
- `src/data/pcs-project-archive-sync.ts`
- `src/data/pcs-project-archive-types.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-project-detail-support.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-project-relation-types.ts`
- `src/data/pcs-project-technical-data-writeback.ts`
- `src/data/pcs-revision-task-file-types.ts`
- `src/data/pcs-revision-task-material-types.ts`
- `src/data/pcs-revision-task-repository.ts`
- `src/data/pcs-revision-task-types.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-task-source-normalizer.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-tech-pack-version-log-types.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-project-source.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/pages/fcs-production-tech-pack-snapshot.ts`
- `src/pages/pcs-channel-products.ts`
- `src/pages/pcs-engineering-change.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/revision-task.ts`
- `src/pages/pcs-engineering-tasks/shared.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/production/context.ts`
- `src/pages/production/orders-domain.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- `/pcs/engineering/design-revision`
- `/pcs/engineering/design-revision/ES-ID-DR-001`
- `/pcs/engineering/masters`
- `/pcs/engineering/plate-making`
- `/pcs/engineering/pattern`
- `/pcs/engineering/color`
- `/pcs/engineering/tech-pack`
- `/pcs/technical-data/tech-packs`
- `/fcs/production/preparation-timing`
- 已删除路由：`/pcs/engineering/revision-sampling`、`/pcs/engineering/design-sampling`、`/pcs/engineering/changes`。

### 验证命令

- 当前范围 Node 专项套件：通过（56/56）。
- `npm run check:pcs-design-revision-consolidation`：通过。
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-engineering-master.ts`：通过（22/22）。
- `node --import tsx scripts/check-production-preparation-timing-readonly.ts`：通过。
- `node --import tsx scripts/check-menu-routes.mjs`：通过。
- `node --import tsx scripts/check-tech-pack-process-route.ts`：通过。
- `node --import tsx scripts/check-pcs-plate-making-mock-data.ts`：通过。
- `npm run check:list-page-governance:static`：通过。
- `npm run check:pcs-engineering-delivery-matrix -- --allow-incomplete`：通过（81 条原子需求双向一致）。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4197 npx playwright test tests/pcs-engineering-pre-production-sample-submit-dom.spec.ts tests/pcs-engineering-task-review-ui.spec.ts tests/pcs-tech-pack-real-pattern-file.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts --workers=1 --reporter=line`：通过（6/6）。
- `npm run build`：通过。
- `npm run check:standard-list-page-template`：通过；Chromium 列拖动、存储和取消拖动行为均符合要求。
- `npm run check:prototype-design-governance -- --all`：通过。
- `codegraph sync`、`codegraph status`：通过；工作树本地索引最新（1,485 个文件、45,982 个节点、177,742 条边）。
- 第二轮正向 / 反向 81 条需求追踪：通过；未发现无说明的未验证项。
- `npm run workflow:verify -- --output /tmp/pcs-design-revision-consolidation/task-receipt.json --task-boundary "PCS 设计改款合并、工程变更删除、技术包入口与生产准备时效收口"`：通过，收据见所列临时路径。

### 真实图片验证

- 列表与详情使用款式档案对应图片，与款号、款式名同块展示。
- 设计稿由跟单选择真实图片文件，读取成功后才允许进入工作安排，替换保留历史。
- 产前版样衣、花型、调色和制版任务已通过 Playwright 上传真实 JPG / PRJ 验收；技术包纸样已通过 Zip 上传与原文件下载回读。
- 验收截图：`output/playwright/pcs-design-revision-list-pass2.png`、`output/playwright/pcs-design-revision-detail-pass2.png`、`output/playwright/pcs-tech-pack-list-pass2.png`、`output/playwright/fcs-preparation-timing-readonly-pass2.png`。

### 例外

- PDA 与打印不适用：本次调整是 PCS / FCS 管理端流程和资料来源，未改动现场扫码、PDA 执行或打印格式。

## 7. 双案例、双轮次全流程复核

- 第 1 轮：独立进程、干净存储，连续完成 CASE-A（无调色）与 CASE-B（含面料调色），共 44 个步骤，结果通过。
- 第 2 轮：重新启动独立进程、干净存储，再次连续完成同样两类案例，共 44 个步骤，结果通过。
- 每条链均从设计改款开始，依次经过买手资料准备、跟单工作安排、专业团队真实文件交付、工程主单、工程专业任务、技术包草稿、买手／版师／跟单审核、正式发布、主单关闭、FCS 技术包快照和生产准备时效只读投影。
- 原始记录：`docs/product-design/test-records/pcs-production-engineering-full-flow-pass-1.json`、`docs/product-design/test-records/pcs-production-engineering-full-flow-pass-2.json`。
- 人工可读记录：`docs/product-design/PCS生产工程管理全流程模拟测试执行记录.md`。
- 复核中曾发现同一毫秒内多次上传可能产生重复文件编号；已在上传事实源修正，并增加“全部真实上传文件编号唯一”断言。修正前记录作废，以上两轮均为修正后重新生成的证据。
