# 加工 SKU 标准费用自动折算审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-10-08 |
| 相关需求 / 任务 | 用户确认优化“投入到产出的计量关系”，自动取值、展示来源与成本结果 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/materials/fabric/:materialId/skus/:skuId/process` 与投入 SKU 计量单位 Tab |
| 端类型 | 管理端 |
| 主要角色与任务 | 物料资料维护人员维护加工费，核对上道成本的单位折算依据 |
| 验证版本 | main，HEAD `3ba8e323d12c7cf4f8f524bb908e5d95b8a54417` 上的本次工作区差异 |
| 实际服务 | 本工作树 Vite `http://127.0.0.1:4206` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：移除通用计量关系选择，改为自动展示上道成本、折算后成本、本次加工费、合计和来源。仅多个包装规格存在歧义时展示选择。缺依据时可进入投入物料的计量单位 Tab；放弃未保存输入只确认一次。
- 基线：AGENTS.md 第 4、5、7 节与用户本次确认。不改变标准成本口径，不加入实际用量、库存、损耗、缩率或后续运输费用。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 保持原五个 Tab；费用页只有三个输入字段，核对信息在独立成本区展示 |
| 文案、状态、数量与单位 | 通过 | 改为“加工费计价单位”“上道成本折算”；每项费用带元/单位，未知关系不猜测 1:1 |
| 防错、确认与恢复 | 通过 | 零费用合法；负费用不计算合计；缺关系提示补齐；包装规格须明确选择；取消跳转保留输入 |
| 图片与对象识别 | 通过 | 保留投入物料真实图片与编码；实际上传后保存，刷新成本一致 |
| 低分辨率 | 通过 | 1366×768 操作验收；1280×720 无页面横向溢出，原有内容区可纵向滚动 |
| 命名路由、交互与性能 | 通过 | 29 项操作各 5 次，共 145 个原始样本，最长 347ms，错误与超时均为零 |

## 4. 问题标签

- `读不懂`
- `选不对`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 用户不理解投入到产出的计量关系且需要人工选择 | 读不懂、选不对 | 物料维护人员 | 同单位与固定换算自动采用；跨维度读取投入 SKU 换算依据，只有包装歧义需选择 | 否 |
| 固定单位配置展示与公式重复维护 | 追溯不足 | 物料维护人员 | 固定公式共用 `listFixedMaterialConversions`；预览与持久成本共用同一折算结果 | 否 |
| 跳往计量单位触发两次离开确认 | 选不对 | 物料维护人员 | 自定义确认后清除待离开标记，取消保持当前输入；浏览器重测确认与取消 | 否 |

## 6. 最终结论

结论：通过

- 本次范围为原型加工 SKU 的标准成本取值与表达，不代表真实采购或加工已发生。
- 同单位直接承接；固定单位来自基础配置；跨维度或包装来自投入 SKU 的计量单位。缺数据不计算，多个包装不自动猜选。
- 浏览器验证了页面预览、保存后成本、刷新后成本一致；单元契约覆盖换算新版本自动生效与历史成本快照保持不变。
- 本次未新增业务存储对象或整包写入；继续使用现有 IndexedDB 业务动作，固定演示数据不在读取时落盘。验收只使用隔离浏览器上下文，未清理用户浏览器数据。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-material-archives.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-rules.ts`
- `src/data/pcs-material-config.ts`

### 需求与直接证据

| 需求 | 实现 | 验证 |
| --- | --- | --- |
| 同单位自动，无通用选择框 | `renderProcessCostPreview` | 专项测试与浏览器 `fee-live-update` |
| 固定换算共用基础配置 | `fixedMaterialFactor` | 四项配置正反向契约、浏览器 `fixed-unit-live-update` |
| 投入 SKU 关系自动取值，来源可核对 | `getMaterialCostUnitConversion` | SKU 版本契约、浏览器 `sku-unit-live-update` |
| 缺依据提示维护，确认与取消可用 | 费用预览与 `cost-input-units` | 浏览器缺关系、确认、取消、站内返回 |
| 多包装明确选择，不影响其他单位 | 费用预览包装选择 | 浏览器 100/600 两种包装切换及切回 KG |
| 预览与保存一致，历史快照独立 | `calculateCost` 与 `processDraft` | 53 项相关契约，实际保存、整页刷新 |
| 1 秒性能门禁 | 当前命名路由 | 145 个样本，每个操作 5 次，最大 347ms |

### 页面路由

- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/skus/material-r1-MAT-FB-00000001-B01/process`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/skus/material-r1-MAT-FB-00000001-B01` 的计量单位 Tab
- 同一主档下实际保存生成的加工 SKU 详情，直读与刷新验证

### 验证命令

- `node --import tsx --test tests/pcs-material-cost-folding.test.ts tests/pcs-r1-material-rules.test.ts tests/pcs-r1-material-transfer.test.ts tests/pcs-r1-material-list-read.test.ts tests/pcs-r1-config.test.ts`：通过，53 项。
- Playwright CLI 执行 `browser-check.js`：通过，5 个独立上下文、145 个加载与操作样本。计时覆盖导航/动作、数据与图片就绪、双帧绘制；浏览器模块缓存冷态，Vite 服务已运行。
- `npm run typecheck:engineering`：通过渐进门禁；仓库既有 3 项全量类型错误不在本次文件内。
- `git diff --check`：通过。
- `codegraph sync`：通过，索引已同步。
- `npm run workflow:verify`：通过，收据状态 `verified`、无阻塞项；构建含 593 项项目测试，治理与列表浏览器检查通过。收据路径 `/private/tmp/material-cost-task-receipt.json`。首次执行因浏览器沙箱权限及记录结果格式失败，修正后重跑通过。

### 验收证据

- [浏览器脚本](../reviews/2026-10-08-material-cost-folding/browser-check.js)
- [全部原始性能与错误结果](../reviews/2026-10-08-material-cost-folding/browser-results.json)
- [相关契约日志](../reviews/2026-10-08-material-cost-folding/contracts.log)
- [固定换算页面](../reviews/2026-10-08-material-cost-folding/fixed-conversion.png)
- [缺换算依据页面](../reviews/2026-10-08-material-cost-folding/missing-conversion.png)
- [1280×720 页面](../reviews/2026-10-08-material-cost-folding/minimum-viewport.png)

### 真实图片验证

- 投入物料沿用主档对应实物图片；新 SKU 上传项目静态实物图片 `/materials/process-orders/white-black-cotton-jersey.jpg`，验收等待图片解码完成后才计为可用。
- 此次不修改图片展示、大图入口、扫码或打印映射；PDA、打印和真实后端不适用。

### 例外

- 无。
