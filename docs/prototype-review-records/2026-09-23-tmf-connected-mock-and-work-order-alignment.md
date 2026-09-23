# TMF 串联 Mock 与加工单对齐审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | 采购需求、半成品加工单、织带加工单、待接收、交出记录串联；加工单对齐染色加工单；删除接单／开工业务动作 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS / PMS / WLS |
| 涉及页面路径 | `/fcs/craft/accessory/webbing/purchase-demands`、`/semi-finished-orders`、`/work-orders`、`/pending-receipts`、`/handover-records` |
| 端类型 | 管理端 / 主管端 |
| 主要角色与任务 | 采购查看 PMS 来源和半成品生成结果；织带厂主管确认接收、加工填报、发起交出；仓管查看待接收及交出记录 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：五个页面进入时自动准备同一套串联 Mock；采购需求改成采购业务列；基础生产单完整更名为半成品加工单并迁移页面地址；生产加工单更名为织带加工单；两种加工单统一为染色加工单的七组信息结构；删除接单、开工、完工按钮、领域动作和状态门禁。
- 设计基线：`AGENTS.md` 第 4 节现场基线、第 5 节列表与真实图片门禁、第 7 节运行时及性能门禁。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 采购需求是采购视图；两类加工单是主管加工视图；待接收和交出记录是仓储协作视图 |
| 文案、状态、数量与单位 | 通过 | 页面统一使用米、条／根及中文状态；加工单只保留确认接收、加工填报、发起交出 |
| 扫码、真实图片与对象识别 | 通过 | Mock 物料绑定现有 TMF 本地参考实物图，缩略图与编码同块，采购需求大图可打开并用 Esc 关闭 |
| 防错、危险确认与主管兜底 | 通过 | 数量和角色门禁继续由同一领域动作校验；重复初始化不覆盖已填报事实 |
| 交接、跨端事实与异常追溯 | 通过 | 采购单、半成品单、批次、加工单、投入发料和交出单使用同一编号链投影到五个页面 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 本轮五页为管理／主管端；1024×768 主体无横向溢出；未新增上传和 PDA 动作 |
| 命名路由、交互、图片大图与打印 | 通过 | 新地址 `/semi-finished-orders` 生效，旧 `/base-orders` 注册已删除；查询、重置、列设置和图片弹窗通过；本轮未改变打印模板 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧执行契约仍要求接单、开工、完工 | 状态抽象 | 织带厂主管 | 删除 `workExecutions` 事实、动作函数和加工填报门禁；旧存储字段读取时丢弃 | 否 |
| 采购需求与加工单字段同质 | 字段过载 | 采购、织带厂主管 | 采购需求改为采购来源、款式、物料、数量、交期、供应商、变更与生成结果；加工单改为七组加工模型 | 否 |

## 6. 最终结论

结论：通过。

说明：同一最终工作树上，45/45 条 TMF 相关专项单测、4/4 个浏览器业务场景和 195/195 个性能样本通过；性能最大值 266.97ms，严格低于 500ms。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/tmf-base-demo.ts`
- `src/data/fcs/tmf-work-order-times.ts`
- `src/data/fcs/tmf-work-order-view.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/pages/process-factory/accessory/webbing/semi-finished-orders.ts`
- `src/pages/process-factory/accessory/webbing/work-orders.ts`
- `src/pages/process-factory/accessory/webbing/work-order-detail.ts`
- `src/pages/process-factory/accessory/webbing/work-times.ts`
- `src/pages/process-factory/accessory/webbing/pending-receipts.ts`
- `src/pages/process-factory/accessory/webbing/handover-records.ts`
- `src/pages/wls-accessory-receipts.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes.ts`

### 页面路由

- `/fcs/craft/accessory/webbing/purchase-demands`
- `/fcs/craft/accessory/webbing/semi-finished-orders`
- `/fcs/craft/accessory/webbing/work-orders`
- `/fcs/craft/accessory/webbing/pending-receipts`
- `/fcs/craft/accessory/webbing/handover-records`

### 验证命令

- `node --import tsx --test tests/unit/tmf-purchase-base-flow.test.ts tests/unit/tmf-base-demo.test.ts tests/unit/tmf-supply-purchase-receipts.test.ts`：通过，45/45。
- `npx vite build`：通过，2677 个模块完成生产构建。
- `npm run check:list-page-governance:static`：通过，扫描 556 个页面。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4327 npx playwright test tests/tmf-webbing-connected-lists.spec.ts --workers=1 --reporter=line`：通过，4/4。
- `CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4328 npx playwright test tests/tmf-webbing-connected-performance.spec.ts --workers=1 --reporter=line`：通过，195/195，最大 266.97ms。

### 真实图片验证

- 采购、半成品和织带加工 Mock 继续绑定 `tmfReferenceSkus` 的本地 TMF 物料参考图；不是色块、图标或首字母占位。
- 浏览器验收确认列表缩略图可见，采购需求大图弹窗可打开并通过 `Esc` 关闭；缺少图片地址时页面保留“缺实物图”阻断提示。

### 例外

- 无。
