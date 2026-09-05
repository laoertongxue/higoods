# 孤立脚本审计证据

## 1. 审计口径

- 候选范围：文件名未被 `package.json`、其他脚本、测试或现行文档引用的 24 个脚本。
- 保留条件：脚本当前可独立运行通过，且验证的业务面没有更直接的替代入口。
- 删除条件：脚本当前失败且断言明显对应旧实现，并已有现行专项入口；或脚本无调用、无验证价值；或脚本会写入仓库范围外路径。
- 执行方式：`node --import tsx <脚本路径>`。各脚本在独立进程中执行，避免共享模块状态影响结论。

## 2. 审计结果

| 脚本 | 独立执行 | 处理 | 依据 |
|---|---:|---|---|
| `check-factory-onboarding-step1-model-state-form.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-factory-onboarding-step2-platform-review.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-factory-onboarding-step3-sample-issue.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-factory-onboarding-step4-factory-sample-submit.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-factory-onboarding-step5-sample-review.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-fcs-cutting-prep-scope.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-fcs-money-unit-idr.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-pcs-channel-listing-images.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-pcs-project-data-consistency.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-pcs-project-image-assets.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-pcs-sample-shoot-images.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-pcs-style-archive-images.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-print-dye-requirement-residue.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-process-platform-status-mapping.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-technical-version-storage-migration.ts` | 通过 | 保留并接入统一入口 | 当前契约有效 |
| `check-auxiliary-craft-warehouse-unified-model.ts` | 失败 | 删除 | 旧断言要求“辅助工艺待加工仓差异待处理状态”；现行辅助工艺/辅料专项检查已覆盖该业务面 |
| `check-factory-onboarding-step6-official-conversion.ts` | 失败 | 删除 | 依赖已不存在的 `listBusinessFactoryMasterRecords` 页面实现；现有同名 Playwright 验收覆盖第 6 步 |
| `check-pattern-piece-instance-special-craft.ts` | 失败 | 删除 | 依赖旧 `pieceInstances` 初始化结构；现行技术包特殊工艺专项检查覆盖目标对象和版本 |
| `check-pcs-page-slimming.ts` | 失败 | 删除 | 仅检查旧静态文案，已与当前 PCS 工程任务页结构脱节 |
| `check-platform-process-result-view.ts` | 失败 | 删除 | 旧“交出待收货”断言不成立；保留且通过的状态映射检查更贴近当前实现 |
| `check-print-governance-final.ts` | 失败 | 删除 | 依赖已不存在的 `docs/fcs-print-service-plan.md`；现行打印工作流与加工单检查已接管 |
| `check-shared-process-action-writeback.ts` | 失败 | 删除 | 依赖已移除的 `CUTTING_START_SPREADING` 旧动作；现行移动执行写回检查已接管 |
| `export-cut-orders.ts` | 未执行 | 删除 | 无调用且写入仓库外 `../higoods-next/`，不应作为本仓检查工具保留 |
| `pcs-project-management-acceptance-tasks.ts` | 未执行 | 删除 | 只导出未使用的静态任务数组，无运行入口或消费方 |

## 3. 接入结果

15 个保留脚本统一由 `npm run check:retained-contracts` 运行。删除脚本与历史文件均保留在 Git 历史中，需要时可按提交恢复。
