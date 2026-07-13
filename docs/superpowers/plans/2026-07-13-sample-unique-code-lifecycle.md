# 样衣一物一码全生命周期实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让每件样衣拥有 HiGood 自行生成的唯一码，并逐件追踪采购、到货、使用、流转、归还、退货和处置。

**架构：** `PcsSampleRecord` 代表单件实物，唯一码在采购明细确认后按计划数量预生成，到货扫码后激活。库存、流转、台账和退货案件都引用 `sampleId/sampleCode`，商品项目只读取案件是否全部结案。

**技术栈：** TypeScript、Vanilla TypeScript、localStorage Mock、字符串模板、Node 检查脚本。

---

## 文件职责

- 创建 `src/data/pcs-sample-asset-domain.ts`：唯一码生成、激活和闭环规则。
- 重写 `src/data/pcs-sample-management.ts`：单件样衣资产及事件仓储。
- 修改 `src/pages/pcs-sample-management.ts`：采购来源、打印、扫码、流转和逐件退货页面。
- 修改 `src/pages/pcs-projects.ts`：读取样衣和退货案件结果。
- 创建 `scripts/check-pcs-sample-unique-code.ts` 和治理记录。

### 任务 1：建立唯一码生成和激活规则

**文件：**
- 创建：`src/data/pcs-sample-asset-domain.ts`
- 创建：`tests/pcs-sample-asset-domain.spec.ts`

- [ ] **步骤 1：编写失败测试**

```typescript
const assets = allocateSampleAssets({ purchaseLineId: 'line-1', skuCode: 'SKU-A', plannedQty: 3, date: '2026-07-13' })
assert.equal(new Set(assets.map((item) => item.sampleCode)).size, 3)
assert.ok(assets.every((item) => item.activationStatus === '待到货激活'))
assert.throws(
  () => activateSampleAsset(assets[0], { scannedCode: assets[1].sampleCode, operator: '仓管甲' }),
  /条码不匹配/,
)
```

- [ ] **步骤 2：运行并确认失败**

```bash
npm test -- tests/pcs-sample-asset-domain.spec.ts
```

- [ ] **步骤 3：实现最小规则**

```typescript
export type SampleActivationStatus = '待到货激活' | '已激活' | '未到货取消'

export interface SampleAssetIdentity {
  sampleId: string
  sampleCode: string
  skuCode: string
  purchaseLineId: string
  activationStatus: SampleActivationStatus
}

export function allocateSampleAssets(input: {
  purchaseLineId: string
  skuCode: string
  plannedQty: number
  date: string
}): SampleAssetIdentity[] {
  return Array.from({ length: input.plannedQty }, (_, index) => ({
    sampleId: `${input.purchaseLineId}-${index + 1}`,
    sampleCode: `HG${input.date.replaceAll('-', '')}${String(index + 1).padStart(4, '0')}`,
    skuCode: input.skuCode,
    purchaseLineId: input.purchaseLineId,
    activationStatus: '待到货激活',
  }))
}
```

正式实现通过仓储全局序列保证跨采购单不重复；测试追加两个采购明细生成码集合无交集的断言。

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/pcs-sample-asset-domain.spec.ts
git add src/data/pcs-sample-asset-domain.ts tests/pcs-sample-asset-domain.spec.ts
git commit -m "feat: add unique sample asset identities"
```

### 任务 2：重构样衣资产仓储

**文件：**
- 修改：`src/data/pcs-sample-management.ts`
- 创建：`tests/pcs-sample-management-lifecycle.spec.ts`

- [ ] **步骤 1：编写采购、到货和补码测试**

测试计划 3 件实际到 2 件时两个码激活、一个码取消；实际多到 1 件时新增一个唯一码；损坏补打返回原码。

- [ ] **步骤 2：扩展单件资产字段**

```typescript
export interface PcsSampleRecord {
  sampleId: string
  sampleCode: string
  productArchiveId: string
  projectId: string
  purchaseOrderId: string
  purchaseLineId: string
  spuCode: string
  skuCode: string
  activationStatus: '待到货激活' | '已激活' | '未到货取消'
  status: PcsSampleStatus
  responsibleSite: '深圳样衣间' | '雅加达样衣间'
  currentLocation: string
  currentHolder: string
  currentPurpose: string
  activatedAt: string
  activatedBy: string
  updatedAt: string
  updatedBy: string
}
```

删除 `relatedWorkItemName/workItemName`，请求、流转和台账全部引用具体 `sampleId`。

- [ ] **步骤 3：实现仓储动作**

```typescript
createSampleAssetsForPurchaseLine(input)
activateSampleAssetByScan(input)
cancelUnreceivedSampleAssets(input)
allocateExtraReceivedSampleAsset(input)
reprintSampleCode(sampleId)
```

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/pcs-sample-management-lifecycle.spec.ts
git add src/data/pcs-sample-management.ts tests/pcs-sample-management-lifecycle.spec.ts
git commit -m "refactor: track samples as individual assets"
```

### 任务 3：逐件流转和退货闭环

**文件：**
- 修改：`src/data/pcs-sample-management.ts`
- 创建：`tests/pcs-sample-return-closure.spec.ts`

- [ ] **步骤 1：编写失败测试**

创建含三件样衣的案件，断言只有三件全部进入终态后案件才能结案；任一件在途或异常时项目保持“不通过待退货”。

- [ ] **步骤 2：将退货案件改成多实物明细**

```typescript
export interface PcsSampleReturnCaseLine {
  lineId: string
  sampleId: string
  sampleCode: string
  result: '待处理' | '退货中' | '已退货' | '已留样' | '已报废' | '已清仓' | '异常'
  carrier: string
  trackingNo: string
  logisticsEvidence: string
  completedAt: string
  completedBy: string
}

export interface PcsSampleReturnCase {
  caseId: string
  projectId: string
  productArchiveId: string
  status: '待审批' | '待执行' | '执行中' | '已结案' | '已驳回'
  lines: PcsSampleReturnCaseLine[]
}
```

- [ ] **步骤 3：实现关闭规则**

`closeReturnCase()` 验证每条明细属于终态；扫描不属于案件的样衣时报错；每次状态变化追加单件台账事件。

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/pcs-sample-return-closure.spec.ts
git add src/data/pcs-sample-management.ts tests/pcs-sample-return-closure.spec.ts
git commit -m "feat: close sample returns per physical asset"
```

### 任务 4：重写样衣页面和商品项目回读

**文件：**
- 修改：`src/pages/pcs-sample-management.ts`
- 修改：`src/pages/pcs-projects.ts`
- 创建：`scripts/check-pcs-sample-unique-code.ts`
- 修改：`package.json`
- 创建：`docs/prototype-review-records/2026-07-13-sample-unique-code.md`

- [ ] **步骤 1：编写失败的页面检查**

断言页面包含“样衣唯一码、采购单、SKU、扫码激活、补打原条码、逐件退货”，列表使用分页组件，源码不存在 `relatedWorkItemName`。

- [ ] **步骤 2：实现局部交互**

到货弹窗按采购明细展示待激活实物；扫码后只更新当前行。退货详情按单件展示状态、物流和异常；商品项目只显示案件汇总和跳转入口。

- [ ] **步骤 3：运行验证**

```bash
npm run check:pcs-sample-unique-code
npm run check:prototype-design-governance -- --all
npm run build
```

- [ ] **步骤 4：提交**

```bash
git add src/pages/pcs-sample-management.ts src/pages/pcs-projects.ts scripts/check-pcs-sample-unique-code.ts package.json docs/prototype-review-records/2026-07-13-sample-unique-code.md
git commit -m "feat: add sample unique code lifecycle pages"
```

