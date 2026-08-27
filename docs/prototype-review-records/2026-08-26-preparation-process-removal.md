# 生产准备历史工序删除原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-27 |
| 相关需求 / 任务 | 彻底删除两项已取消准备工序及全部用户可见入口 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS、PCS |
| 涉及页面路径 | 工序工艺字典、工厂档案、技术包 BOM、技术包工序工艺、PCS 技术资料 |
| 端类型 | 管理端 |
| 主要角色与任务 | 工艺、生产工程、计划和工厂运营人员维护产品资料、工序和承接能力 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：删除 BOM 字段、技术包准备工序、字典结果、工厂类型、页面预留项和 Mock 文案；其他准备工序及既有角色操作保持不变。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 字典、工厂档案、技术资料和裁床捆条加工单仍按原管理角色和页面模式展示现行业务。 |
| 文案、状态、数量与单位 | 通过 | 旧字段、旧预留状态和专属工厂文案消失；现行数量与单位未改动。 |
| 扫码、真实图片与对象识别 | 不适用 | 本次不新增款式或物料图片，也不调整扫码。 |
| 防错、危险确认与主管兜底 | 通过 | 旧缓存中的非现行裁床特殊工艺类型直接丢弃，不会被改判为捆条工艺。 |
| 交接、跨端事实与异常追溯 | 通过 | 现行加工单生成、任务打印、生产确认、裁床主链路和进度统计专项均通过。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 删除项没有完整 PDA 与上传闭环。 |
| 命名路由、交互、图片大图与打印 | 通过 | 字典、工厂、技术资料、裁床捆条加工单和任务分配弹窗五处验收通过；本次无图片和版式变化。 |

## 4. 问题标签

- `选不对`
- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 已取消能力仍以字段、预留和历史定义存在 | 选不对、视觉干扰 | 工艺、生产工程、计划 | 删除事实源、读取者、页面、Mock、旧缓存兼容和旧契约 | 否 |

## 6. 最终结论

结论：通过

说明：原子需求 `PREP-REMOVE-001` 至 `PREP-REMOVE-009` 均已实现并由当前分支证据验证。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/cut-piece-orders.ts`
- `src/data/fcs/cutting/material-prep.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/factory-types.ts`
- `src/data/fcs/indonesia-factories.ts`
- `src/data/fcs/kol-goto-tech-pack-fixtures.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-preparation-timing.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/special-craft-task-generation.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-progress.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-change-workspace.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-tech-pack-workspace.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-sample-cost-review-pricing.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-tech-pack-review-diff.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/print/templates/production-material-confirmation-template.ts`
- `src/pages/process-factory/cutting/cutting-summary-checks.ts`
- `src/pages/process-factory/cutting/fei-qr-model.ts`
- `src/pages/process-factory/cutting/special-processes-domain.ts`
- `src/pages/process-factory/cutting/special-processes-model.ts`
- `src/pages/process-factory/cutting/summary-model.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`

相关 Mock、检查、测试和历史文档已按相同口径收口；3 个专属文件实际删除。

### 页面路由

- `/fcs/production/craft-dict`
- `/fcs/factories/profile`
- `/pcs/products/styles/style_demand_SPU_2024_009/technical-data/tdv_demand_SPU_2024_009`
- `/fcs/craft/cutting/special-processes`
- `/fcs/dispatch/workbench`

### 验证命令

- `npm run build`：通过
- `node --import tsx scripts/check-process-craft-dictionary-rebuild.ts`：通过
- `npm run check:process-craft-final-taxonomy`：通过
- `node --import tsx scripts/check-tech-pack-garment-bom.ts`：通过
- `node --import tsx scripts/check-tech-pack-special-craft-target-object-and-versioning.ts`：通过
- `node --import tsx scripts/check-production-process-work-order-generation.ts`：通过
- `node --import tsx scripts/check-task-print-cards-foundation.ts`：通过
- `node --import tsx scripts/check-cutting-binding-strip-flow.ts`：通过
- `node --import tsx scripts/check-cutting-clean-mainline.ts`：通过
- `node --import tsx scripts/check-progress-statistics-linkage.ts`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `codegraph sync`：通过（已是最新，待同步文件 0）
- 全工作区双轮反向扫描：通过（旧中文名称、代码标识、字段、文件名和隐含业务表达均为 0）
- Playwright CLI 五处命名页面／弹窗验收：通过
- `npm run workflow:verify`：通过（`verified`，阻断项 0）

### 例外

- 无旧名称语义例外；相关辅料与面料物性统一改用不含旧工序字样的现行名称。
- `check-fcs-sewing-preparation-return-preview.ts` 在本次改名断言前，被仓库既有“标准派单价实际 1,600、旧基线期望 1,200”阻断；价格不在本次范围，任务分配弹窗中的辅料新名称已独立浏览器验证。
- 额外重跑的历史专项中，还有 8 个检查在与本次删除对象无关的既有断言上停止：任务二维码、工厂能力导出、纸样结构、裁片数量列、逐片实例、两步维护、PDA 中转袋和差异上报；没有将这些失败冒充为通过。
- 额外浏览器规格中，字典重建用例通过；两个历史字典详情用例因页面已无旧详情抽屉而失败，逐片工艺用例因页面已无旧“添加纸样”入口而失败，两个 PCS 用例分别被首单资格事实和 BOM 方案条件阻断；这些旧用例未作为本次零残留结论的证据。
- 独立 `tsc --noEmit` 仍命中仓库既有的导入扩展名和类型基线问题；本次以 Vite 生产构建、受影响专项和命名页面作为直接通过证据，未把既有错误表述为本次通过。
