# 技术包编辑入口与操作规则对齐线上

依据 `AGENTS.md` 的 SCOPE-02、SCOPE-03、LIST-01、IMAGE-01、UI-01 与 STORE-02；本次只调整入口裁剪、编辑承载方式和顶部字段，不改业务模型与存储契约。

## 基本信息

- 日期：2026-10-13
- 任务 / 需求编号：技术资料 → 技术包，对齐 manage.higood.ai 技术包列表操作栏与编辑入口
- 验证人：Mavis（main 代理，代理技术验证）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：技术包列表操作栏按线上规则裁剪按钮（草稿才有编辑/删除，已是默认不再显示设为默认）；「编辑」由三字段弹窗改为进入既有完整技术包编辑页；技术包编辑页顶部新增类型 radio 并落库。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 列表操作栏按钮按状态裁剪 | 通过 | 列表页表格文本核对：草稿行含查看/编辑/日志/删除，已发布行仅查看/日志/设为默认，默认版本行无「设为默认」 |
| 「编辑」进入完整技术包编辑页 | 通过 | 点击草稿行「编辑」跳转 `/pcs/products/styles/<styleId>/technical-data/<versionId>`，页面渲染标题、难度、类型、关键项检查与 7 个资料页签 |
| 原三字段编辑弹窗已移除 | 通过 | `renderTechnicalEditModal`、`technicalEditModal` 及其 open/close/submit 事件分支均已删除，源码检索无残留引用 |
| 类型 radio 双向落库并跨页保留 | 通过 | 草稿技术包 22 切换为「成衣烫画」后重新加载页面仍显示「成衣烫画」；再切回「普通」即时生效 |
| 已发布技术包顶部只读 | 通过 | 已发布技术包 ASYSA26060310 顶部渲染为「做货难度：B」「类型：普通」纯文本，无 radio |
| 已发布版本不可编辑/删除 | 通过 | 列表已发布行不渲染编辑与删除按钮，入口层已阻断 |
| 类型字段权限归属 | 通过 | `getTechPackFieldModuleKey` 将 `tech-pack-type` 归入 QUALITY，与做货难度共用模块只读判断 |
| 存储写入原子性与冲突提示 | 通过 | 类型保存经 `runPcsRecordCommand` 提交，声明 `higood-pcs-technical-data-version-store-v5` 与 `higood-pcs-tech-pack-version-log-store-v1` 两个集合 |
| 图片与附件 | 不适用 | 本次只调整入口与顶部字段，未改动物料图片、花型图与附件渲染 |
| 打印 | 不适用 | 本次未触及打印映射与版式 |
| PDA | 不适用 | 技术包为桌面端管理页面，无 PDA 入口 |
| 性能 | 不适用 | 本次未改变列表分页、页签渲染或数据加载方式，仅按状态条件渲染少量按钮 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/pcs-tech-pack-version-log-types.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/pages/pcs-technical-data-tech-pack-list.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/tech-pack/core.ts`
- `src/pages/tech-pack/events.ts`

### 页面证据

- 版本：分支工作区，HEAD `ee149499`，已暂存差异 SHA256 前缀 `3899a4d9f4495dff`；Vite dev 服务 `http://localhost:5173`（Node v26.8.2，Electron 内置浏览器，视口 1393×1419 / 1257×1280）
- 证据：路由 `/pcs/technical-data/tech-packs` 表格文本核对草稿行与已发布行按钮集合；路由 `/pcs/products/styles/style_demand_SPU_QC_001/technical-data/tdv_demand_SPU_QC_001` 顶部显示做货难度与类型 radio、关键项检查 7 项、7 个资料页签，类型改为「成衣烫画」后重新加载页面仍为「成衣烫画」，改回「普通」即时生效；路由 `/pcs/products/styles/style_demand_ASYSA26060310/technical-data/tdv_demand_ASYSA26060310` 顶部为只读文本「做货难度：B」「类型：普通」；线上基准 `https://manage.higood.ai/pcs/techpack/index` 编辑按钮打开 94% 宽 iframe 完整技术包编辑页，含 BOM/纸样/款式-物料-纸样映射/工序/工艺路线/核价/尺码表/花型设计/附件页签。

### 性能结论

- 结论：不适用
- 依据：本次未修改列表分页、页签渲染与数据加载链路，操作栏仅按状态条件增减按钮，不引入新的首屏量或事件链。

### 验证命令

- `npm run typecheck:entrypoints`：通过
- `npm run check:list-page-governance`：通过

### 例外

- 线上编辑以 94% 宽 iframe 弹层承载，原型采用整页路由 `/pcs/products/styles/<styleId>/technical-data/<versionId>`；承载方式不同，编辑能力、顶部字段与页签结构按线上一致范围实现。
- 线上编辑页另有「工序」与「附件」独立页签，原型现有 7 个页签中以「工艺路线」承载工序内容、「纸样管理」承载物料&纸样关联，本次未新增「附件」页签；如需对齐需单独确认附件数据范围。
- 原型新建流程第 3 步选择的复制来源目前仅记录来源版本与日志，尚未克隆源版本的 BOM、尺寸表等资料内容。