# PCS 测款单独立建单与商品档案属性审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | CREATE-001～004、SOURCE-001～002、INFO-001～015、PAGE-001～003；见 docs/product-design/PCS测款单建单与商品档案信息优化.md |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | /pcs/testing/orders、/pcs/testing/orders/create、/pcs/testing/orders/:id、/pcs/products/styles/:id |
| 端类型 | 管理端 |
| 主要角色与任务 | 买手选择商品档案和 SKU 建单，档案维护人员补齐商品属性 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：列表增加买手、独立新建页替代内嵌表单、档案增加商品属性维护、测款单只读展示档案信息。
- 当前基线：AGENTS.md 第 4、5、7 节。未更改线上系统或真实数据。验收数据为隔离本地预览端口的 Mock。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端；建单首要操作是选择档案、买手和 SKU；商品属性只在档案维护 |
| 文案、状态、数量与单位 | 通过 | 买手字段区别于步骤责任团队；旧单缺失显示待分配；属性缺失待完善 |
| 扫码、真实图片与对象识别 | 通过 | 沿用商品档案对应的本地实拍图；新增选款与 SKU 同块缩略图、大图和失败态 |
| 防错、危险确认与主管兜底 | 通过 | 空商品、空买手、空 SKU、错误 SKU、重复 SPU 阻断；品类编号和名称成对填写 |
| 交接、跨端事实与异常追溯 | 通过 | 测款属性不落独立副本，读取当前商品档案；不新增跨端交接 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768 / 1280×720；PDA、上传不适用 |
| 命名路由、交互、图片大图与打印 | 通过 | Web 验收见证据；打印不适用 |

## 4. 问题标签

- 字段过载
- 协作断裂

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 列表内嵌大表单抢占列表空间 | 字段过载 | 买手 | 独立新建页面 | 否 |
| 商品属性在建单时重复填写 | 协作断裂 | 买手、档案维护人员 | 档案唯一来源，建单只读 | 否 |
| 历史档案缺失新增字段 | 协作断裂 | 档案维护人员 | 缺失显示待完善，可在档案补齐；正式档案有值的既有核心字段仍只读 | 已明确缺失，不伪造资料 |

## 6. 最终结论

结论：通过

产品验收：用户本次文字要求已作为实施依据，页面产品接受尚未确认。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-style-archive-types.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/pages/pcs-product-information.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-testing-order-create.ts`
- `src/pages/pcs-testing-order-list.ts`
- `src/pages/pcs-testing-order-detail.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`
- `src/main-handlers/pcs-handlers.ts`

### 页面路由

- `/pcs/testing/orders`
- `/pcs/testing/orders/create`
- `/pcs/testing/orders/to_mudyo7c5_6`
- `/pcs/products/styles/style_demand_SPU_QC_002`

### 验证命令

- `npx tsc --noEmit`：通过；最后一次修改后复核通过
- `node --import tsx tests/pcs-testing-order.spec.ts`：通过
- `node --import tsx tests/pcs-testing-product-information.spec.ts`：通过
- `npm run build`：通过，417 项单元测试；最后视觉修正后 Vite 构建再次执行
- `npm run check:list-page-governance:static`：通过
- `npm run check:prototype-design-governance -- --all`：通过（覆盖 11 个有用户可见影响的文件；首次记录缺结果的问题已修正）

### 真实图片验证

沿用既有 `public/materials/archive/` 的款式实拍图及商品档案 SKU 图；不新增不对应的网络素材。各图绑定款号/SKU 和名称，缩略图按钮读取同一图片 URL；加载中、失败文案明确，大图使用现有全局预览器。命名页面对应关系与可访问性见浏览器证据。

### 例外

- 无；本任务没有继承之前印花列表的性能豁免。

### 当前版本浏览器证据

- 工作树：`/Users/laoer/.codex/worktrees/cekuanyouhua/higoods`；分支 `codex/cekuanyouhua`；基线 HEAD `00f7bba76a3e5cc148dee2b2be8f61f9523b69c8` 加本任务差异。逐文件 SHA-256 见 JSON。
- 预览：`http://127.0.0.1:4192`；同一工作树最终 Vite 构建；桌面 1366×768 和 1280×720。
- 原始证据：`docs/prototype-review-records/2026-09-23-pcs-testing-browser-evidence.json`；截图与图片失败证据：`output/verification/cekuanyouhua/`。
- 列表、详情、档案及建单共四条路由：无缓存与刷新各 5 次。最后仅修改新建页两列布局，其加载和关键交互已再测，旧样本保留并注明失效范围。当前有效页面加载最高 287.9ms；最终新建页 10 次加载最高 186.8ms。
- 交互原始记录共 313 个样本（包含保留的布局修改前样本），最高 77.7ms。最后布局后的建单关键交互重放 53 个样本，最高 60.6ms；图片失败阻断另重放 5 次。未将浏览器返回动作无事件计时的空结果计作通过。
- 保存买手后刷新仍可读；错误 SKU、无 SKU、重复 SPU、空买手与空选项验证；档案属性保存后建单及详情回读；建单不存在商品属性输入控件。
- 图片：款式、SKU 图片均加载成功，大图可关闭；临时缺失资源触发失败文案并阻断保存，测试后已刷新恢复。
- 页面无横向溢出；输入和商品选择只更新对应区域；列设置支持显示、冻结、排序及按路由保存偏好。

- 验收清理：删除本任务生成的 12 张临时测款单，保留 5 张原有 Mock 单；还原本任务测试修改的档案属性。临时图片失败注入及性能探针均已移除。
