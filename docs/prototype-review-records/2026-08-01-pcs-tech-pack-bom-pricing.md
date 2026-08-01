# PCS 技术包 BOM 与价格原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | 技术包 BOM 与价格页面迁移 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/products/styles/:styleId/technical-data/:technicalVersionId` |
| 端类型 | 管理端 |
| 主要角色 | 买手；版师、跟单等只读角色 |
| 主要任务 | 维护 BOM 用量、打样数量、损耗、用量单位及 SPU 级自定义费用，核对双币种综合成本 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 仅买手显示编辑入口，数据服务同步校验买手角色 |
| 任务清晰度 | 通过 | 页面集中呈现 BOM 物料、费用和综合成本 |
| 信息架构与导航 | 通过 | 沿用技术资料版本页的“BOM 与价格”页签 |
| 页面模式 | 通过 | 管理端明细维护页，未改变全局导航 |
| 信息负荷 | 通过 | 物料与费用分区展示，明细均分页 |
| 文案 | 通过 | 币种、价格状态、错误提示均使用中文业务语义 |
| 数量与状态 | 通过 | 用量四位精度、打样数量、损耗率、价格有效性明确展示 |
| 扫码与识别 | 通过 | 本页面不涉及扫码 |
| 防错 | 通过 | 缺标准单价或单位换算时禁止写入；正式版本禁止编辑 |
| UI 样式 | 通过 | 延续企业后台表格、状态标签与汇总卡片样式 |
| 组件交互 | 通过 | 输入保存成功后只局部更新当前物料行成本、状态和双币汇总；不替换工作区、不丢失滚动位置与输入焦点，分页继续限制明细首屏数量 |
| 协作关系 | 通过 | 标准单价与计价单位读取物料档案，技术包只维护业务用量与费用 |
| 异常与追溯 | 通过 | 标准单价失效状态可见，正式版本以技术包内容形成价格事实快照 |
| 现场设备可用性 | 通过 | 管理端宽表在容器内横向滚动，不产生页面级横向溢出 |

## 4. 问题标签

- `算不准`
- `点错风险`
- `字段过载`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧页面允许手工修改物料单价、币种和运费 | 算不准 | 买手 | 标准单价、币种、计价单位和换算系数改为只读并取自物料档案 | 否 |
| 非买手可能通过事件入口修改价格信息 | 点错风险 | 版师、跟单 | 页面和数据服务同时执行角色门禁 | 否 |
| 明细过多影响首屏阅读 | 字段过载 | 买手 | 物料和自定义费用分别分页，宽表仅在表格容器内滚动 | 否 |
| 输入已保存但行小计与双币汇总仍显示旧值 | 算不准 | 买手 | 保存服务返回最新工作区后，事件入口按稳定数据属性只更新物料行小计、价格状态、物料成本、自定义费用、汇率及综合成本 | 否 |
| 标准单价失效且单位换算也缺失时整页只显示换算错误 | 算不准 | 买手 | 先展示“标准单价失效”并阻断；标准单价恢复后仍按既有规则校验单位换算 | 否 |

## 6. 最终结论

结论：通过

说明：页面已按确认口径统一为“BOM 与价格”，使用技术资料版本内容中的 `bomItems` 与 `bomCustomCosts` 作为同一事实源；未新增真实后端、审批流或异常处理体系。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/tech-pack/cost-domain.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/context.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/fcs/tech-packs.ts`

### 页面路由

- `/pcs/products/styles/:styleId/technical-data/:technicalVersionId`

### 验证命令

- `npm test -- tests/pcs-tech-pack-bom-pricing-page.spec.ts`：通过
- `npm test -- tests/pcs-engineering-bom-pricing.spec.ts`：通过
- `npm test -- tests/pcs-tech-pack-bom-review-activation-atomic.spec.ts`：通过
- `npm run check:pcs-material-archive-units`：通过
- `npm run check:tech-pack-bom-unit-guard`：通过
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过

### 例外

- 无
