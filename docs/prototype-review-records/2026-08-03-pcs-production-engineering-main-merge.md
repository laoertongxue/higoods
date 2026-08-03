# PCS 生产工程主线合并审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-03 |
| 相关需求 / 任务 | PCS 生产工程模块合并进入主线 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | 商品项目、工程主单、专业任务、商品档案与样衣相关页面 |
| 端类型 | 管理端 |
| 主要角色 | 跟单、买手、版师、制作团队、花型团队、染厂、采购人员 |
| 用户可见影响 | 是 |

## 2. 适用规则

- `AGENTS.md`
- 保留已经确认的固定步骤、专业任务边界与工程主单事实源。
- 删除工作项、工作项模板及其运行时兼容入口。
- 管理端页面继续使用中文业务语义、真实对象图片和必要防错。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与主动作 | 通过 | 工程主单由跟单统筹，专业任务由对应团队执行。 |
| 信息结构 | 通过 | 商品项目、工程主单、专业任务和技术资料边界清晰。 |
| 状态与依赖 | 通过 | 固定依赖不可调整，条件任务按业务事实启用。 |
| 图片识别 | 通过 | 款式与物料页面沿用真实图片及大图查看能力。 |
| 防错与门禁 | 通过 | 首单、唯一未关闭主单、BOM、技术包与关闭门禁均由专项契约覆盖。 |
| 旧模块删除 | 通过 | 工作项、模板页面、配置和运行时载体同步删除。 |
| 页面性能 | 通过 | 大型检索与 PDA 路由按需加载，复用运行时结果。 |

## 4. 问题标签

- `协作断裂`
- `状态不一致`
- `重复入口`

## 5. 主要问题与处理

| 问题 | 标签 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- |
| 长期功能分支与主线治理规则存在时间差 | 状态不一致 | 合并时补齐全部受管文件审查覆盖，并重新执行专项契约和构建 | 否 |
| 旧工作项体系与新工程主单并存 | 重复入口 | 删除旧页面、配置、模板及运行时兼容代码 | 否 |

## 6. 最终结论

结论：通过

说明：生产工程分支的业务边界、旧模块删除、工程任务与主线共享逻辑已完成合并审查。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-dependency-policy.ts`
- `src/data/pcs-engineering-task-field-policy.ts`
- `src/data/pcs-first-sample-repository.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-plate-making-repository.ts`
- `src/data/pcs-plate-making-types.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-project-archive-bootstrap.ts`
- `src/data/pcs-project-archive-collector.ts`
- `src/data/pcs-project-archive-repository.ts`
- `src/data/pcs-project-archive-types.ts`
- `src/data/pcs-project-bootstrap.ts`
- `src/data/pcs-project-closure-view-model.ts`
- `src/data/pcs-project-decision-flow-service.ts`
- `src/data/pcs-project-decision-migration.ts`
- `src/data/pcs-project-definition-normalizer.ts`
- `src/data/pcs-project-demo-seed-service.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-image-types.ts`
- `src/data/pcs-project-image-view-model.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-inline-node-record-repository.ts`
- `src/data/pcs-project-inline-node-record-types.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-list-store.ts`
- `src/data/pcs-project-node-factory.ts`
- `src/data/pcs-project-node-instance-registry.ts`
- `src/data/pcs-project-phase-definitions.ts`
- `src/data/pcs-project-repository.ts`
- `src/data/pcs-project-sample-return-defaults.ts`
- `src/data/pcs-project-style-archive-generation.ts`
- `src/data/pcs-project-types.ts`
- `src/data/pcs-revision-task-repository.ts`
- `src/data/pcs-revision-task-types.ts`
- `src/data/pcs-sample-management.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-style-archive-image-selection.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-task-source-normalizer.ts`
- `src/data/pcs-template-domain-view-model.ts`
- `src/data/pcs-templates.ts`
- `src/data/pcs-work-item-configs.ts`
- `src/data/pcs-work-item-configs/core.ts`
- `src/data/pcs-work-item-configs/engineering-configs.ts`
- `src/data/pcs-work-item-configs/mappings.ts`
- `src/data/pcs-work-item-configs/market-configs.ts`
- `src/data/pcs-work-item-configs/project-configs.ts`
- `src/data/pcs-work-item-configs/sample-configs.ts`
- `src/data/pcs-work-item-configs/types.ts`
- `src/data/pcs-work-item-runtime-carrier.ts`
- `src/data/pcs-work-items.ts`
- `src/pages/pcs-channel-products.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/master-task-page.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- `src/pages/pcs-live-testing.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-projects-list.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-templates.ts`
- `src/pages/pcs-video-testing.ts`
- `src/pages/pcs-work-items.ts`

### 验证命令

- `npm run check:pcs-engineering-master`：通过（16/16）
- `npx tsx tests/pcs-engineering-master-task-plan-confirmation.spec.ts`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过
- `git diff --check`：通过

### 例外

- 无
