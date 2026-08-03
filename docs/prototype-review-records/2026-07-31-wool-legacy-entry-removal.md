# 毛织旧入口与专属投影删除原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-31 |
| 相关需求 / 任务 | 毛织事实工作流任务 14：删除旧页面、旧路由、旧菜单、毛织菲票打印数据源和价格投影 |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | `/fcs/process-factory/wool/machine-associations`；删除毛织菲票、毛织统计和旧横机排产入口 |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 毛织主管、设备主管 |
| 主要任务 | 从毛织加工单或设备档案进入唯一横机生产关联工作台；不再误入旧节点页面 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 毛织主管和设备主管只维护当前设备生产关系 |
| 任务清晰度 | 通过 | 菜单固定显示“横机生产关联”，不再混入排产节点 |
| 信息架构与导航 | 通过 | 菜单、加工单和设备页统一指向唯一新路由 |
| 页面模式 | 通过 | 保留既有标准列表工作台，不新增重复页面 |
| 信息负荷 | 通过 | 删除旧菲票、统计和排产入口，减少重复信息 |
| 文案 | 通过 | 运行页面不再出现毛织菲票、横机排产和已排产 |
| 数量与状态 | 通过 | 不再以旧节点或价格形成毛织状态投影 |
| 扫码与识别 | 通过 | 本次不改变非毛织菲票扫码和打印 |
| 防错 | 通过 | 旧地址不做重定向，避免用户误以为旧业务仍受支持 |
| UI 样式 | 通过 | 唯一横机关联页继续复用标准列表组件 |
| 组件交互 | 通过 | 现有局部弹窗、筛选和分页交互保持不变 |
| 协作关系 | 通过 | 加工单与设备档案进入同一当前关系工作台 |
| 异常与追溯 | 通过 | 删除入口不改动毛织事实记录及操作日志 |
| 现场设备可用性 | 通过 | 本次为管理端导航收口，不影响 PDA 现场动作 |

## 4. 问题标签

- `读不懂`
- `状态抽象`
- `视觉干扰`
- `协作断裂`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 新旧横机关联路径并存会让用户误认排产仍是加工单节点 | `状态抽象` | 毛织主管、设备主管 | 删除旧排产页面和链接，只注册 `/fcs/process-factory/wool/machine-associations` | 否 |
| 毛织菲票和统计页面继续暴露已删除的节点、打印状态和统计口径 | `读不懂`、`视觉干扰` | 毛织主管 | 删除页面、菜单、路由、渲染器和链接，不做旧地址重定向 | 否 |
| 通用标签模板继续读取毛织菲票会让已删除业务从打印入口复活 | `协作断裂` | 毛织主管、仓管 | 仅移除毛织菲票数据源和分支，保留裁片、捆条及其他业务打印 | 否 |

## 6. 最终结论

结论：通过

说明：

- 毛织管理只保留事实加工和当前横机关系入口。
- 删除范围严格限定于毛织专属页面、路由、文案和打印数据源；非毛织菲票、价格、统计和交接能力不变。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/wool/fei-tickets.ts`（删除）
- `src/pages/process-factory/wool/statistics.ts`（删除）
- `src/pages/process-factory/wool/machine-schedule.ts`（删除）
- `src/pages/process-factory/wool/machine-associations.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/fcs-route-links.ts`
- `src/router/routes-fcs.ts`
- `src/router/route-renderers-fcs.ts`

### 页面路由

- `/fcs/process-factory/wool/machine-associations`

### 验证命令

- `npm run check:wool-fact-workflow`：通过，新增旧页面、路由、菜单、链接、打印数据源和旧语义负向门禁。
- `npm run check:wool-internal-style-code`：通过。
- `npm run check:wool-warehouse-unified-model`：通过，含 Web 仓库本地浏览器交互。
- `npm run check:process-factory-warehouse-menu-consolidation`：失败于既有染色菜单断言；实际菜单较旧断言多“合并染色、水溶加工单”，本次毛织差异未修改染色菜单。
- `npm run check:list-page-governance`：失败；静态列表检查通过，标准模板复验在既有补料页“列设置”按钮等待 30 秒超时，第一次运行同一 Chromium 拖拽检查曾通过。
- `npm run check:prototype-design-governance -- --all`：通过，覆盖 9 个受管文件和本审查记录。
- `npm run build`：通过，旧 `listWoolFeiTicketPrintRecords` 导入阻断已消除。

### 例外

- 既有 `check:process-factory-warehouse-menu-consolidation` 的染色菜单期望未包含“合并染色、水溶加工单”，与本次毛织删除无关；本任务不越界修改染色菜单或旧断言。
- `check:list-page-governance` 的静态门禁通过；标准模板 Chromium 复验在既有补料列表“列设置”按钮发生已知偶发超时，本次未修改补料页面、标准列表组件或该测试。
