# PCS BOM 与工程任务联动审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-02 |
| 相关需求 / 任务 | Task 8：BOM 工艺要求联动工程任务骨架 |
| 涉及系统 | PCS |
| 涉及页面路径 | 工程主单、技术包 BOM 与价格 |
| 端类型 | 管理端 |
| 主要角色 | 买手、跟单、花型团队、染厂 |
| 主要任务 | 买手维护 BOM 工艺要求后，按物料行启用工程主单既有花型或调色任务骨架 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 本次业务事实

- 工程主单发布时一次性生成完整任务骨架；BOM 联动只能启用已有骨架，不能另建任务。
- 技术包只在版本的 `sourceProjectId` 明确指向工程主单，或 `createdFromTaskId` 明确指向该主单任务时联动；同款式但无权威来源时不得猜测关联。
- 每条印花、染色要求都按 BOM 行关联到真实任务物料行，同类多物料不得合并。
- 新增要求时，未开始任务直接增加物料行；已有成果的任务进入新返工轮次，并保留历史成果和审核记录。
- 取消单条要求或删除物料时，只将对应物料行标记为“因需求变更结束”；其他物料继续执行。
- 即使取消的是任务最后一条有效物料要求，也只结束对应物料行，工程任务保留同步前状态及全部成果、审核历史。
- 技术包版本同时记录工程主单来源和来源任务时，两者必须归属同一张工程主单；来源冲突明确阻断。
- 技术包内容与工程任务联动通过同一保存入口执行；技术版本仓和工程主单仓各自在事务内部捕获并恢复快照，页面只恢复其余关联仓，任一步失败仍保持六类事实源一致。
- 水溶只保留在技术包工艺中，不生成工程任务，也不进入生产准备时效。
- 固定依赖只从已确认的任务策略读取；启用任务时自动补齐其固定前置，不提供人工调整依赖入口。
- 本切片不涉及老任务、任务迁移、人工取消及异常处理。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 买手维护 BOM，专业团队执行花型和调色，跟单读取工程主单进度。 |
| 任务清晰度 | 通过 | BOM 行、任务物料行和专业任务一一可追溯。 |
| 信息架构与导航 | 通过 | 未增加平行入口或第二套任务事实。 |
| 页面模式 | 通过 | 本次只补领域联动，不改变既有页面模式。 |
| 信息负荷 | 通过 | 不增加说明性文案，仅保留必要状态。 |
| 文案 | 通过 | 新增错误和状态均为中文业务文案。 |
| 数量与状态 | 通过 | 任务和物料行状态分别维护，最后一行结束也不改写任务状态。 |
| 防错 | 通过 | 缺少骨架和双来源冲突时整次阻断；重复同步幂等；固定前置自动补齐；跨仓失败恢复快照。 |
| UI 样式 | 通过 | 本次无 UI 样式变化。 |
| 组件交互 | 通过 | 本次无新增组件交互。 |
| 协作关系 | 通过 | BOM 为要求来源，工程主单为任务执行事实源，技术包保留三类专属工艺。 |
| 异常与追溯 | 通过 | 只保留正常业务的历史成果、审核轮次和需求变更结束记录，不扩展异常处理。 |
| 现场设备可用性 | 通过 | 管理端领域联动，不涉及 PDA。 |

## 4. 问题标签

- 无命中标签。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 同类多个物料若只启用任务不保存行关系，会丢失逐项成果和审核事实 | 追溯不足 | 买手、花型团队、染厂 | 使用 BOM 行 ID 生成稳定任务物料行；重复同步不重复新增 | 否 |
| 已有成果后新增要求若覆盖原任务，会丢失历史 | 追溯不足 | 买手、专业团队 | 新增返工轮次，保留原成果与审核轮次 | 否 |
| 单条要求取消若结束整张任务，会影响其他物料 | 点错风险 | 专业团队 | 仅结束对应物料行，仍有有效物料时保持任务继续 | 否 |
| 三类技术包工艺误投影为工程任务或准备时效项 | 协作断裂 | 跟单、生产团队 | 联动结果只返回技术包工艺，不创建任务 | 否 |
| 仅凭款式推断工程主单会把无来源版本写入错误主单 | 选不对 | 买手、跟单 | 只接受技术包版本记录中的工程主单或来源任务引用 | 否 |
| 两个权威来源指向不同主单时按列表顺序命中，会写错工程任务 | 选不对 | 买手、跟单 | 分别解析两个来源，冲突时明确阻断 | 否 |
| 技术包保存会继续写项目关系、款式档案、商品项目和项目归档，若任一仓未恢复会留下半状态 | 协作断裂 | 买手、跟单 | 技术版本仓和工程主单仓由各自事务内部恢复；页面恢复项目关系、款式档案、商品项目和项目归档，款式仓最后精确恢复，保留原错误并附加回滚错误 | 否 |

## 6. 最终结论

结论：通过。

- BOM 工艺要求与工程主单既有骨架之间形成物料行级、幂等、可追溯联动。
- 现有技术包印花、染色和水溶工艺路线保持不变。
- 无产品设计规范例外。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/context.ts`
- `tests/pcs-engineering-bom-task-linkage.spec.ts`
- `tests/pcs-engineering-bom-task-linkage-page.spec.ts`
- `scripts/check-tech-pack-process-route.ts`
- `scripts/check-water-soluble-process.ts`

### 验证命令

- `npx tsx tests/pcs-engineering-bom-task-linkage.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-bom-task-linkage-page.spec.ts`：通过；覆盖真实技术包保存链、权威来源门禁，以及技术保存中途失败和工程同步失败时六仓逐一恢复。
- `npx tsx tests/pcs-engineering-master-domain.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-material-review.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-color-stages.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-task-submit.spec.ts`：通过。
- `npm run check:tech-pack-process-route`：通过。
- `npm run check:water-soluble-process`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:menu-routes`：通过。
- `npm run build`：通过。

### 例外

- 无。
