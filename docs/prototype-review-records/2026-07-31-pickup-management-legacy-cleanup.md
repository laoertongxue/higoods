# HiGood 原型审查记录：领料管理旧节点级工作台清理

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-31 |
| 相关需求 / 任务 | 清理废弃的领料节点级工作台（旧 pickup-management.ts 整条链路） |
| 涉及系统 | PFOS（裁床厂管理） |
| 涉及页面路径 | /fcs/craft/cutting/pickup-management（旧工作台与旧详情，均已移除入口） |
| 端类型 | 管理端 |
| 主要角色 | 裁床领料员、裁床仓管 |
| 主要任务 | 领料管理三列表（已配齐待领料 / 未配齐配料 / 已领料） |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 保留的三列表对应裁床领料员 / 仓管现场协同，与 PDA 领料共用同一数据源 |
| 任务清晰度 | 通过 | 移除节点级工作台后，页面入口与菜单（三个二级菜单）一一对应，无悬挂路由 |
| 信息架构与导航 | 通过 | 旧工作台路由 /fcs/craft/cutting/pickup-management 保留 302 重定向到 /ready，外部旧链接不落空 |
| 页面模式 | 通过 | 三列表均为标准列表页，满足 @page-pattern: list 门禁 |
| 信息负荷 | 通过 | 删除详情页（信息已被列表行内与领料记录抽屉覆盖），页面数量收敛 |
| 文案 | 通过 | 无英文状态码；中文字段与状态沿用 pickupStatusLabelMap 统一字典 |
| 数量与状态 | 通过 | 领料状态（暂不可领 / 待领料 / 打回待仓库处理 / 已领料完结 / 按实完结）定义保留且被 material-prep 系列共用 |
| 扫码与识别 | 通过 | 不涉及扫码；PDA 领料链路未受影响 |
| 防错 | 通过 | "PC 不得硬编码收货人直接确认领料""PC 列表不得直接确认领取""领料记录必须展示节点版本"三条防错契约迁移至新列表页继续生效 |
| UI 样式 | 通过 | 仅删除，未改动既有三列表样式 |
| 组件交互 | 通过 | 领料记录抽屉、去领料 / 上报领料差异入口均保留在新列表页 |
| 协作关系 | 通过 | Web 三列表与 PDA 现场领料继续通过 pickup-management-runtime 共享节点事实 |
| 异常与追溯 | 通过 | 仓储回写异常、领料差异上报入口不受影响；e2e 用例 2 已改用新入口并通过 |
| 现场设备可用性 | 通过 | PDA 页面零改动 |

## 4. 问题标签

无命中标签（本次为纯删除型清理，不引入新页面、新文案、新交互）。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧节点级工作台无路由注册，仅剩不可达的详情页（链接只来自旧工作台），构成死链路 | 追溯不足 | 裁床领料员 | 整条链路删除：页面文件、详情路由、渲染器、事件分发、meta 条目、check 脚本契约、e2e 旧入口 | 否 |
| 领料详情路由 /pickup-management-detail 无任何入口可达 | 追溯不足 | 裁床领料员 | 一并删除；其信息（节点版本、领料会话、仓储同步状态）已由新列表行内与"查看领料记录"抽屉覆盖 | 否 |
| e2e 用例 2 依赖旧页面"办理领料入库"按钮，清理后必然失败 | 点错风险 | 裁床仓管 | 改为从 /fcs/craft/cutting/pickup-management/ready 列表"去领料"入口进入 PDA 并完成全链路断言 | 否 |
| 性能检查脚本与状态样例检查脚本引用旧页面渲染与 pickupWorkbenchTabs | 组件误用 | 无 | 改为引用新列表页渲染与 pickupStatusLabelMap 状态字典 | 否 |

## 6. 最终结论

结论：通过

说明：本次为废弃链路清理，业务可见形态收敛为三菜单列表 + PDA 现场执行，无新增页面与交互；所有受影响检查脚本、e2e 用例与构建门禁均通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/pickup-management.ts`（删除，1105 行旧链路）
- `src/pages/process-factory/cutting/meta.ts`（删除 pickup-management 元数据条目与类型成员）
- `src/router/route-renderers-fcs.ts`（删除旧工作台与旧详情渲染器包装）
- `src/router/routes-fcs.ts`（删除详情路由与 import；保留旧路径重定向）
- `src/main-handlers/fcs-handlers.ts`（删除旧事件处理器引用与分发分支）
- `src/data/fcs/cutting/production-material-prep.ts`（删除仅旧页面使用的 pickupWorkbenchTabs，保留 pickupStatusLabelMap）
- `tests/cutting-warehouse-location-map.spec.ts`（用例 2 改用新列表页入口）

### 页面路由

- `/fcs/craft/cutting/pickup-management` → 302 重定向到 `/fcs/craft/cutting/pickup-management/ready`（保留）
- `/fcs/craft/cutting/pickup-management/ready`、`/incomplete`、`/history`（保留，业务目标页面）
- `/fcs/craft/cutting/pickup-management-detail`（已删除）

### 验证命令

- `npm run build`：通过（含列表页治理门禁）
- `npm run check:prototype-design-governance`：通过
- `npm run check:cutting-pickup-ui-closure`：通过
- `npm run check:material-prep-pickup-management`：通过
- `npm run check:cutting-prep-pickup-return-linkage`：通过
- `npx playwright test tests/cutting-warehouse-location-map.spec.ts -g "PDA 中转仓领料"`：通过

### 例外

- 无
