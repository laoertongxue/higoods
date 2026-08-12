# PCS 技术包模板库删除原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-12 |
| 相关需求 / 任务 | ADJ-042：完整删除误建的“技术包模板库” |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/technical-data/tech-packs`、`/pcs/technical-data/bom-pricing`；删除 `/pcs/technical-data/tech-pack-templates` |
| 端类型 | 管理端 |
| 主要角色与任务 | 跟单、买手、版师查看技术包和 BOM 与价格；不再进入无业务事实来源的模板页 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：技术资料左侧菜单删除“技术包模板库”；对应路由、渲染器、静态页面和三条模板 Mock 同步删除。技术包、BOM 与价格、花型库、部位模板库保持不变。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 删除无真实使用任务的独立模板结果页，保留真实技术资料入口。 |
| 文案、状态、数量与单位 | 通过 | 不再展示“用于工程主单生成技术包时确定资料结构”的错误业务说明和虚构模板状态。 |
| 扫码、真实图片与对象识别 | 不适用 | 删除页不包含款式、物料、扫码或图片对象；保留页面行为未修改。 |
| 防错、危险确认与主管兜底 | 通过 | 旧路由不保留兼容入口，避免用户继续把静态页面误认为技术包生成依据。 |
| 交接、跨端事实与异常追溯 | 通过 | 技术包继续由工程主单或工程变更成果形成，不增加第二套结构来源。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 本次只删除管理端静态入口，不涉及 PDA、上传或弱网。 |
| 命名路由、交互、图片大图与打印 | 通过 | 保留技术包和 BOM 路由可进入；被删除地址不再命中 PCS 页面；不涉及打印。 |

## 4. 问题标签

- `读不懂`
- `状态抽象`
- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 静态模板页没有被工程主单、BOM 或技术包版本生成读取，却以正式菜单出现 | 读不懂、状态抽象 | 跟单、买手、版师 | 完整删除菜单、路由、渲染器、页面、Mock 和肯定性测试 | 否 |
| “模板库也放入技术资料”被误解为新增技术包模板库 | 视觉干扰 | 产品及研发 | 权威文档明确仅保留部位模板库，不再设置技术包模板库 | 否 |

## 6. 最终结论

结论：通过

说明：

- 技术包结构继续直接来自工程主单或工程变更的真实 BOM 与专业成果。
- 删除项不承担任何真实生成、审核、发布或版本能力，因此删除不会切断技术包主链路。
- 回归契约明确禁止重新出现同名菜单、路由、渲染器和静态 Mock。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/router/routes-pcs.ts`
- `src/router/route-renderers.ts`
- `src/pages/pcs-technical-data.ts`

### 页面路由

- `/pcs/technical-data/tech-packs`
- `/pcs/technical-data/bom-pricing`
- `/pcs/technical-data/tech-pack-templates`（应不再进入技术包模板库页面）

### 验证命令

- `node --experimental-strip-types --experimental-specifier-resolution=node tests/pcs-engineering-navigation-removal.spec.ts`：通过
- `node --import tsx --test tests/pcs-engineering-technical-data-and-change.spec.ts`：通过
- `npm run check:pcs-engineering-master`：通过（23／23）
- `npm run build`：通过（2,340 个模块）
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:menu-routes`：通过（160 个菜单地址、0 个遗漏、0 个重复）
- Playwright 命名页面验收：通过；技术包与 BOM 页面正常，技术资料菜单仅有 4 个保留入口，旧地址显示通用已下线页而非模板页

### 例外

- 隔离工作树任务收据为 `implemented`：本次菜单路由、构建、原型治理和 CodeGraph 均通过；项目级列表治理被未修改的 `src/pages/process-factory/cutting/fei-tickets.ts` 既有欠账阻断。该欠账不属于 ADJ-042，不在本次 PCS 删除中顺带修改。
