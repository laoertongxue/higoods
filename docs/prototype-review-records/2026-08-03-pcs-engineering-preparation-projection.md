# 生产准备时效工程事件只读记录审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-03 |
| 相关需求 / 任务 | PCS 生产工程管理实施计划任务 11：生产准备时效改为工程事件只读幂等记录 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | `/fcs/production/preparation-timing`、`/fcs/production/preparation-timing-statistics` |
| 端类型 | 管理端 |
| 主要角色 | 跟单、买手、版师、花型团队、染厂、采购人员 |
| 主要任务 | 查看工程主单 11 个固定准备项的状态、时间与关联成果，不在时效页面执行任务 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-pcs-production-engineering-master-design.md`
- `docs/superpowers/plans/2026-07-30-pcs-production-engineering-master-implementation.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 页面保持 FCS 管理端时效查询职责，实际任务继续由 PCS 专业团队办理。 |
| 任务清晰度 | 通过 | 工程来源记录只提供查看详情、工程主单、专业任务、采购单和正式技术包入口。 |
| 信息架构与导航 | 通过 | 工程主单是执行事实源，FCS 只显示时间与结果；没有第二套任务入口。 |
| 页面模式 | 通过 | 保留标准管理端列表、详情抽屉和统计页；工程详情使用固定准备项卡片。 |
| 信息负荷 | 通过 | 工程详情删除商品类型确认、物料要求维护、上传记录等时效页编辑内容。 |
| 文案 | 通过 | 页面只展示中文业务名称，不展示工程状态码；查看动作均指向实际业务对象。 |
| 数量与状态 | 通过 | 11 个准备项状态来自工程任务；复用成果不计完成数量、完成时长和准时率。 |
| 扫码与识别 | 通过 | 本页面为管理端时间记录，不涉及现场扫码。 |
| 防错 | 通过 | 页面隐藏编辑入口，提交处理和运行态合并再次阻断工程来源确认、修改、上传、维护和审核。 |
| UI 样式 | 通过 | 复用现有标准列表、抽屉、卡片和状态徽章，没有新增视觉范式。 |
| 组件交互 | 通过 | 列表继续分页；详情、列设置和筛选保持局部交互，不增加整页输入重绘。 |
| 协作关系 | 通过 | 每个准备项保留工程主单、专业任务及适用的采购单链接，正式技术包发布后保留正式版本链接。 |
| 异常与追溯 | 通过 | 返工同时展示首次完成与当前有效完成；重复轮次不会重复累计。 |
| 现场设备可用性 | 通过 | 本次未增加弹窗或输入控件，既有宽表继续在容器内滚动并固定操作列。 |

## 4. 问题标签

- `协作断裂`
- `追溯不足`
- `点错风险`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 时效页原先可以确认准备项、上传专业成果和维护染色要求，形成第二套执行事实 | `协作断裂`、`点错风险` | 跟单、专业团队 | 工程来源记录能力固定为只读；页面和动作入口双重阻断 | 否 |
| 过渡实现只读取纱线、面料调色的两个完成节点 | `追溯不足` | 跟单、管理人员 | 删除过渡视图，由固定策略一次生成全部 11 项 | 否 |
| 重复返工轮次可能重复累计，或覆盖首次完成时间 | `追溯不足` | 跟单、管理人员 | 事件按主单、任务和轮次去重，分别保存首次与当前有效完成时间 | 否 |
| 前期成果复用可能被误记为本次执行完成 | `追溯不足` | 跟单、管理人员 | 复用项不生成本次开始、完成时间，并排除完成与时长统计 | 否 |

## 6. 最终结论

结论：通过

说明：工程主单继续承担唯一执行事实，生产准备时效只承担记录、查看和统计；固定依赖不提供调整入口，缺失事件只补齐固定显示项，不反向创建任务。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-preparation-projection.ts`
- `src/data/pcs-engineering-preparation-timing-view.ts`（删除，由完整 11 项投影替代）
- `src/data/fcs/production-preparation-timing.ts`
- `src/data/fcs/production-preparation-timing-runtime.ts`
- `src/pages/production/preparation-timing.ts`

### 页面路由

- `/fcs/production/preparation-timing`
- `/fcs/production/preparation-timing-statistics`

### 验证命令

- `npm test -- tests/pcs-engineering-preparation-projection.spec.ts`：通过
- `npm run check:production-preparation-timing`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:list-page-governance`：通过
- `npm run build`：通过（仅保留仓库既有 Browserslist 数据与大包体提示）
- `git diff --check`：通过

### 例外

- 无。非工程主单来源记录不在本任务边界。
