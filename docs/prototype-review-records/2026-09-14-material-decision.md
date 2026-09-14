# 物料监控与决策原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-14 |
| 相关需求 / 任务 | material-decision-product-v2.md；原子矩阵对应条款及AT01—AT40 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | DDS / 供应链域 |
| 涉及页面路径 | /dds/supply-chain/materials/{overview,panorama,planning,consumption,risks,quality,configuration} |
| 端类型 | 管理端 |
| 主要角色与任务 | 物料计划员、规则批准人、只读查看者；判断缺口与试算方案 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增七入口、物料明细、供需日历、加工/包材演算、SKU策略、风险处理及本地方案记录；保留其他DDS入口。未接入生产账务或真实权限。
- 基线：AGENTS.md 第4、5、7节；所有数量为演示快照，不与线上库存混淆。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 有条件通过 | 七入口与主路径浏览器通过；完整方案仍有未实施条款，见矩阵 |
| 文案、状态、数量与单位 | 有条件通过 | 专项66测试通过；实际源账务、BOM、成本及单位确认仍缺 |
| 扫码、真实图片与对象识别 | 不通过 | 43条目录物料与加工演示物料没有经核实的对应图片；明确显示待提供，未使用通用图冒充；扫码非本阶段范围 |
| 防错、危险确认与主管兜底 | 有条件通过 | 重复策略、数据过期、缺映射、草稿失效、风险关闭有本地阻断；服务端控制未接入 |
| 交接、跨端事实与异常追溯 | 有条件通过 | 加工分段及本地单号关联可演示，真实执行回传与生产跨域联动未接入 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 1366×768和1280×720浏览器通过；本阶段无PDA、上传、打印新入口；模拟水位中断，不代表弱网端到端 |
| 命名路由、交互、图片大图与打印 | 不通过 | 15组浏览器交互通过；图片缺失导致大图验收阻塞；无新增打印功能 |

## 4. 问题标签

- 追溯不足：真实源系统尚未接入。
- 图片素材缺失：对应实物图、大图及失败态尚不能验收。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 无正式图片来源 | 图片素材缺失 | 所有物料查看者 | 已向用户询问来源地址；逐对象标注，未虚构 | 是 |
| 完整方案含生产侧契约 | 追溯不足 | 计划、采购、仓储 | 矩阵独立列阻塞，原型不发真实指令 | 是 |
| 仍有配置审批排期、批量决策等扩展未实施 | 功能覆盖 | 规则及计划负责人 | 矩阵保持待实施，不将阶段原型当完整交付 | 是 |

本轮增补：库存健康、预警、物料日报、商品分析、生产备料五视图已实现并通过本机专项验收；跨视图统一快照与口径发布仍待完成。逐条证据见 `docs/2026-09-14-material-existing-demand-coverage.md`。

本轮UI修复：一级功能只显示所属子页面，直接访问子页也高亮父级；总览恢复综合决策内容。规则与配置按适用范围、统计口径、补充策略及版本拆分，独立业务规则明确列出管理位置；SKU数量单位随选择变化。15组浏览器用例通过，包括原有试算发布回归。

## 6. 最终结论

结论：不通过

可操作原型的当前自动化与命名页面专项已通过；完整产品方案验收尚未完成。缺图门禁、生产集成和矩阵未实施条款不能由构建通过替代。本次不标记accepted或完整verified。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/material-decision/model.ts`
- `src/data/material-decision/fixtures.ts`
- `src/data/material-decision/calculations.ts`
- `src/data/material-decision/workflow.ts`
- `src/pages/material-decision/index.ts`
- `src/pages/material-decision/views.ts`
- `src/pages/material-decision/events.ts`
- `src/pages/material-decision/processing.ts`
- `src/pages/material-decision/packaging.ts`
- `src/router/routes.ts`

- `src/pages/material-decision/health.ts`
- `src/pages/material-decision/warnings.ts`
- `src/pages/material-decision/daily.ts`
- `src/pages/material-decision/preparation.ts`

### 页面路由

- `/dds/supply-chain/materials/health`
- `/dds/supply-chain/materials/warnings`
- `/dds/supply-chain/materials/daily`
- `/dds/supply-chain/materials/goods`
- `/dds/supply-chain/materials/preparation`

- `/dds/supply-chain/materials/overview`
- `/dds/supply-chain/materials/panorama`
- `/dds/supply-chain/materials/planning`
- `/dds/supply-chain/materials/consumption`
- `/dds/supply-chain/materials/risks`
- `/dds/supply-chain/materials/quality`
- `/dds/supply-chain/materials/configuration`

### 验证命令

- `node --import tsx --test tests/unit/material-decision*.test.ts`：通过（66项）。
- `npx playwright test --config tests/material-decision.config.ts --workers=1`：通过（15组），当前独立工作树服务43241。
- `npm run build`：通过（最终构建，包含类型及全部单元测试）。
- `npm run check:list-page-governance:static`：通过。
- `node --import tsx scripts/check-menu-routes.mjs --systems=dds`：通过（10个DDS菜单，无重复无缺失）。
- `git diff --check`：通过。

图片证据：`output/material-decision-configuration.png`、`output/material-decision-panorama-1280.png`（仅布局证据，不是实物图验收）。

### 例外

- 真实物料图片缺失属于未通过项，不申请豁免；完整方案未验收完成。
- 本次无PDA或打印新入口；生产集成未实现，界面明确Mock。
