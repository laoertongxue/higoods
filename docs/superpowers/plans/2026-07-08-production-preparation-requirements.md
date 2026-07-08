# 生产准备工作项要求维护实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 `生产准备时效` 页面中补齐跟单确认工作项的面料/做款要求、责任团队角色映射，以及染色工作项下独立的 `维护染色要求` 入口。

**架构：** 继续沿用当前 Vanilla TypeScript 字符串模板和 localStorage runtime。记录级保存跟单确认要求，染色项保存独立染色要求；页面只做原型表达，不新增真实权限系统和买手审核流程。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript、现有 `scripts/check-production-preparation-timing.ts` 自检脚本。

---

## 文件结构

- 修改：`src/data/fcs/production-preparation-timing.ts`
  - 增加记录级面料/做款要求字段。
  - 增加责任团队角色映射。
  - 增加染色要求类型和 mock 数据。
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`
  - 在 runtime 确认记录中保存面料、做款要求、通用备注。
  - 保存和合并染色要求。
- 修改：`src/pages/production/preparation-timing.ts`
  - 确认工作项弹窗增加面料、做款/打板要求、通用备注。
  - 操作栏增加 `维护染色要求` 独立入口。
  - 增加染色要求维护弹窗。
  - 详情抽屉和工作项卡片展示新增信息。
- 修改：`scripts/check-production-preparation-timing.ts`
  - 为新增字段、入口、状态和统计口径增加自检。
- 更新：`docs/prototype-review-records/`
  - 新增本次原型审查记录，满足项目设计治理要求。

## 任务 1：先补自检约束

**文件：**
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：添加失败断言**

在现有 `confirmItemsHtml` 检查附近加入断言：

```ts
assertHtmlIncludes(confirmItemsHtml, 'name="materialNo"', '确认工作项弹窗必须提交本次用料编号')
assertHtmlIncludes(confirmItemsHtml, 'name="materialName"', '确认工作项弹窗必须提交本次用料名称')
assertHtmlIncludes(confirmItemsHtml, 'name="sampleRequirementText"', '确认工作项弹窗必须提交做款/打板要求')
assertHtmlIncludes(confirmItemsHtml, 'name="confirmationRemark"', '确认工作项弹窗必须提交通用备注')
assert.ok(!confirmItemsHtml.includes('修正原因'), '确认工作项弹窗不应继续展示修正原因')
```

在操作栏检查附近加入断言：

```ts
assertHtmlIncludes(adjustedLedgerHtml, '维护染色要求', '已确认且选择染色项的记录必须展示维护染色要求入口')
assert.ok(!pendingOutputHtml.includes('维护染色要求'), '未确认工作项前不得展示维护染色要求入口')
```

在数据检查附近加入断言：

```ts
assert.ok(preparationOwnerRoleRules.length >= 6, '责任团队角色映射必须覆盖主要准备团队')
for (const team of preparationOwnerTeams) {
  assert.ok(preparationOwnerRoleRules.some((rule) => rule.ownerTeam === team), `责任团队 ${team} 缺少角色映射`)
}
```

在统计检查附近加入断言：

```ts
assert.ok(!detailStatsHtml.includes('维护染色要求完成'), '染色要求维护不得作为月度完成准备项统计')
assert.ok(!pageSource.includes('染色买手审核'), '本次不应新增染色买手审核流程')
assert.ok(!pageSource.includes('印花买手审核'), '本次不应新增印花买手审核流程')
```

- [ ] **步骤 2：运行自检确认失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：失败，至少提示确认工作项弹窗缺少 `materialNo` 或 `sampleRequirementText`。

- [ ] **步骤 3：Commit 失败约束**

```bash
git add scripts/check-production-preparation-timing.ts
git commit -m "test: cover production preparation requirement fields"
```

## 任务 2：补数据模型、角色映射和 mock 数据

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：扩展类型**

在 `ProductionPreparationItem` 前增加：

```ts
export interface PreparationMaterialRequirement {
  materialNo: string
  materialName: string
}

export interface PreparationDyeRequirement extends PreparationMaterialRequirement {
  colorName: string
  pantoneCode: string
  remark: string
  maintainedBy: string
  maintainedAt: string
}

export interface PreparationOwnerRoleRule {
  ownerTeam: string
  roleLabels: string[]
  actionScope: string
}
```

在 `ProductionPreparationItem` 增加：

```ts
dyeRequirement?: PreparationDyeRequirement
```

在 `ProductionPreparationRecord` 增加：

```ts
materialRequirement: PreparationMaterialRequirement
sampleRequirementText: string
confirmationRemark: string
```

- [ ] **步骤 2：增加责任团队角色映射**

在 `preparationOwnerTeams` 后增加：

```ts
export const preparationOwnerRoleRules: PreparationOwnerRoleRule[] = [
  { ownerTeam: '版师团队', roleLabels: ['版师', '版师主管'], actionScope: '操作梭织基码纸样、梭织齐码纸样' },
  { ownerTeam: '毛织团队', roleLabels: ['毛织版师', '毛织主管'], actionScope: '操作毛织基码纸样、毛织齐码纸样' },
  { ownerTeam: '车板团队', roleLabels: ['车版', '车版主管'], actionScope: '操作版衣制作' },
  { ownerTeam: '花型团队', roleLabels: ['花型师', '花型主管'], actionScope: '操作数码印/DTF/DTG花型' },
  { ownerTeam: '染色团队', roleLabels: ['染厂公共账号'], actionScope: '上传染色调色结果' },
  { ownerTeam: '采购团队', roleLabels: ['采购', '辅料采购'], actionScope: '操作辅料下单' },
  { ownerTeam: '跟单角色', roleLabels: ['跟单'], actionScope: '确认工作项、维护染色要求' },
]
```

- [ ] **步骤 3：补 mock 字段**

给每条 `productionPreparationRecords` seed 补齐：

```ts
materialRequirement: { materialNo: 'FAB-202603-001', materialName: '40S 棉弹府绸' },
sampleRequirementText: '按 S 码打基码，门襟和袖口按原样保留。',
confirmationRemark: '系统推导为纯梭织，跟单确认无需染色。',
```

给已选择染色项补齐：

```ts
dyeRequirement: {
  materialNo: 'FAB-202603-004',
  materialName: '12GG 羊毛混纺纱',
  colorName: '雾蓝',
  pantoneCode: 'PANTONE 14-4318 TPX',
  remark: '先出 1 张色卡给跟单确认。',
  maintainedBy: '当前跟单',
  maintainedAt: '2026-03-04T10:20:00',
}
```

未选择染色项不要写 `dyeRequirement`。

- [ ] **步骤 4：运行自检**

运行：

```bash
npm run check:production-preparation-timing
```

预期：仍可能失败在页面字段未渲染，但数据模型相关断言通过。

- [ ] **步骤 5：Commit 数据模型**

```bash
git add src/data/fcs/production-preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: model production preparation requirements"
```

## 任务 3：runtime 保存确认要求和染色要求

**文件：**
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`

- [ ] **步骤 1：扩展 runtime 状态**

在 `ConfirmedPreparationRecord` 增加：

```ts
materialRequirement?: PreparationMaterialRequirement
sampleRequirementText?: string
confirmationRemark?: string
```

在 `PreparationRuntimeState` 增加：

```ts
dyeRequirements: Record<string, PreparationDyeRequirement>
```

其中 key 使用 `itemId`。

- [ ] **步骤 2：加载 runtime 时兼容旧数据**

在 `EMPTY_PREPARATION_RUNTIME_STATE` 增加：

```ts
dyeRequirements: {},
```

在 `loadPreparationRuntimeState()` 返回值增加：

```ts
dyeRequirements: parsed.dyeRequirements ?? {},
```

- [ ] **步骤 3：合并记录级确认要求**

在 `mergePreparationRuntimeRecords()` return 对象中加入：

```ts
materialRequirement: confirmation?.materialRequirement ?? record.materialRequirement,
sampleRequirementText: confirmation?.sampleRequirementText ?? record.sampleRequirementText,
confirmationRemark: confirmation?.confirmationRemark ?? record.confirmationRemark,
```

- [ ] **步骤 4：合并染色要求到 item**

在 `mergePreparationRuntimeItem()` 中合并：

```ts
const dyeRequirement = runtime.dyeRequirements[item.itemId] ?? item.dyeRequirement
return {
  ...item,
  dyeRequirement,
  uploads,
  downloads,
  ...completionPatch,
}
```

按该函数当前结构放入最小位置，避免改动无关逻辑。

- [ ] **步骤 5：运行自检**

运行：

```bash
npm run check:production-preparation-timing
```

预期：runtime 编译通过；页面渲染相关断言可能继续失败。

- [ ] **步骤 6：Commit runtime**

```bash
git add src/data/fcs/production-preparation-timing-runtime.ts
git commit -m "feat: persist preparation requirement runtime"
```

## 任务 4：改确认工作项弹窗和提交处理

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`

- [ ] **步骤 1：渲染确认字段**

在 `renderConfirmItemsDialog()` 的准备项 section 后、备注前加入：

```ts
<section class="rounded-lg border p-4">
  <div class="text-sm font-semibold">3. 维护面料和做款要求</div>
  <div class="mt-3 grid gap-3 md:grid-cols-2">
    <label class="block text-sm">
      <span class="text-muted-foreground">面料编号</span>
      <input name="materialNo" value="${escapeHtml(record.materialRequirement.materialNo)}" class="mt-1 w-full rounded-md border px-3 py-2" required />
    </label>
    <label class="block text-sm">
      <span class="text-muted-foreground">面料名称</span>
      <input name="materialName" value="${escapeHtml(record.materialRequirement.materialName)}" class="mt-1 w-full rounded-md border px-3 py-2" required />
    </label>
  </div>
  <label class="mt-3 block text-sm">
    <span class="text-muted-foreground">做款/打板要求</span>
    <textarea name="sampleRequirementText" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2" required>${escapeHtml(record.sampleRequirementText)}</textarea>
  </label>
</section>
<label class="block text-sm">
  <span class="text-muted-foreground">通用备注</span>
  <textarea name="confirmationRemark" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2">${escapeHtml(record.confirmationRemark)}</textarea>
</label>
```

删除原 `修正原因` label。

- [ ] **步骤 2：保存确认字段**

在 `handleProductionPreparationTimingSubmit()` 的确认表单分支读取：

```ts
const materialRequirement = {
  materialNo: String(formData.get('materialNo') ?? '').trim(),
  materialName: String(formData.get('materialName') ?? '').trim(),
}
const sampleRequirementText = String(formData.get('sampleRequirementText') ?? '').trim()
const confirmationRemark = String(formData.get('confirmationRemark') ?? '').trim()
```

保存到 `confirmedRecords[recordId]`：

```ts
materialRequirement,
sampleRequirementText,
confirmationRemark,
overrideReason: confirmationRemark,
```

`overrideReason` 保留给现有 runtime 兼容，页面不再展示这个名字。

- [ ] **步骤 3：详情展示确认要求**

在详情抽屉来源信息或商品类型确认区后展示：

```ts
<section class="rounded-xl border bg-card p-4">
  <h3 class="font-semibold">跟单确认要求</h3>
  <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
    <div><p class="text-xs text-muted-foreground">本次用料</p><p>${escapeHtml(record.materialRequirement.materialNo)} ${escapeHtml(record.materialRequirement.materialName)}</p></div>
    <div><p class="text-xs text-muted-foreground">做款/打板要求</p><p>${escapeHtml(record.sampleRequirementText || '-')}</p></div>
    <div><p class="text-xs text-muted-foreground">通用备注</p><p>${escapeHtml(record.confirmationRemark || '-')}</p></div>
  </div>
</section>
```

- [ ] **步骤 4：运行自检**

运行：

```bash
npm run check:production-preparation-timing
```

预期：确认弹窗字段断言通过；染色要求入口相关断言可能仍失败。

- [ ] **步骤 5：Commit 确认弹窗**

```bash
git add src/pages/production/preparation-timing.ts
git commit -m "feat: capture preparation confirmation requirements"
```

## 任务 5：增加维护染色要求入口和弹窗

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`

- [ ] **步骤 1：增加判断函数**

在页面文件中增加：

```ts
function isDyeItem(item: ProductionPreparationItem): boolean {
  return item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）'
}
```

- [ ] **步骤 2：操作栏渲染维护入口**

在 `renderLedgerActions()` 中为可操作染色项追加独立按钮：

```ts
const dyeRequirementHref = buildLedgerActionHref(params, month, {
  recordId: record.recordId,
  itemId: item.itemId,
  action: 'maintain-dye-requirement',
})
```

染色项按钮组渲染为：

```ts
return `
  <button type="button" class="text-left text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(href)}">${escapeHtml(preparationActionLabel(item))}</button>
  <button type="button" class="text-left text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(dyeRequirementHref)}">维护染色要求</button>
`
```

非染色项保持原逻辑。

- [ ] **步骤 3：增加染色要求弹窗**

新增 `renderDyeRequirementDialog(record, item, params, month)`：

```ts
function renderDyeRequirementDialog(
  record: ProductionPreparationRecord,
  item: ProductionPreparationItem,
  params: URLSearchParams,
  month: string,
): string {
  if (valueOf(params, 'action') !== 'maintain-dye-requirement' || !isDyeItem(item)) return ''
  const closeHref = buildLedgerHrefFromParams(params, month)
  const req = item.dyeRequirement
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">维护染色要求</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(item.itemType)}</p>
        <form class="mt-4 space-y-4" data-prep-dye-requirement-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          <div class="grid gap-3 md:grid-cols-2">
            <label class="block text-sm"><span class="text-muted-foreground">面料编号</span><input name="materialNo" required value="${escapeHtml(req?.materialNo || record.materialRequirement.materialNo)}" class="mt-1 w-full rounded-md border px-3 py-2" /></label>
            <label class="block text-sm"><span class="text-muted-foreground">面料名称</span><input name="materialName" required value="${escapeHtml(req?.materialName || record.materialRequirement.materialName)}" class="mt-1 w-full rounded-md border px-3 py-2" /></label>
            <label class="block text-sm"><span class="text-muted-foreground">颜色名称</span><input name="colorName" required value="${escapeHtml(req?.colorName || '')}" class="mt-1 w-full rounded-md border px-3 py-2" /></label>
            <label class="block text-sm"><span class="text-muted-foreground">潘通色号</span><input name="pantoneCode" required value="${escapeHtml(req?.pantoneCode || '')}" class="mt-1 w-full rounded-md border px-3 py-2" placeholder="PANTONE 14-4318 TPX" /></label>
          </div>
          <label class="block text-sm"><span class="text-muted-foreground">染色备注</span><textarea name="remark" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2">${escapeHtml(req?.remark || '')}</textarea></label>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">保存染色要求</button>
          </div>
        </form>
      </section>
    </div>
  `
}
```

把它接入页面弹窗渲染处，和 `renderOperateItemDialog()` 同级。

- [ ] **步骤 4：提交染色要求**

在 `handleProductionPreparationTimingSubmit()` 中新增表单分支：

```ts
if (form.matches('[data-prep-dye-requirement-form]')) {
  const recordId = String(formData.get('recordId') ?? '').trim()
  const itemId = String(formData.get('itemId') ?? '').trim()
  if (!recordId || !itemId) return true
  const runtime = loadPreparationRuntimeState()
  savePreparationRuntimeState({
    ...runtime,
    dyeRequirements: {
      ...runtime.dyeRequirements,
      [itemId]: {
        materialNo: String(formData.get('materialNo') ?? '').trim(),
        materialName: String(formData.get('materialName') ?? '').trim(),
        colorName: String(formData.get('colorName') ?? '').trim(),
        pantoneCode: String(formData.get('pantoneCode') ?? '').trim(),
        remark: String(formData.get('remark') ?? '').trim(),
        maintainedBy: '当前跟单',
        maintainedAt: currentIsoMinute(),
      },
    },
  })
  closePreparationDialog()
  return true
}
```

- [ ] **步骤 5：显示染色要求**

在 `renderItemCard()` 中，染色项额外展示：

```ts
${isDyeItem(item) ? renderDyeRequirementFields(item) : ''}
```

新增：

```ts
function renderDyeRequirementFields(item: ProductionPreparationItem): string {
  const req = item.dyeRequirement
  if (!req) return '<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">待跟单维护染色要求</p>'
  return `
    <div class="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-muted-foreground">对应面料：</span>${escapeHtml(req.materialNo)} ${escapeHtml(req.materialName)}</div>
        <div><span class="text-muted-foreground">颜色名称：</span>${escapeHtml(req.colorName)}</div>
        <div><span class="text-muted-foreground">潘通色号：</span>${escapeHtml(req.pantoneCode)}</div>
        <div><span class="text-muted-foreground">维护人：</span>${escapeHtml(req.maintainedBy)} ${escapeHtml(formatDateTime(req.maintainedAt))}</div>
        <div class="col-span-2"><span class="text-muted-foreground">染色备注：</span>${escapeHtml(req.remark || '-')}</div>
      </div>
    </div>
  `
}
```

- [ ] **步骤 6：运行自检**

运行：

```bash
npm run check:production-preparation-timing
```

预期：新增入口、弹窗、染色要求字段相关断言通过。

- [ ] **步骤 7：Commit 染色要求入口**

```bash
git add src/pages/production/preparation-timing.ts src/data/fcs/production-preparation-timing-runtime.ts
git commit -m "feat: add dye requirement maintenance"
```

## 任务 6：补原型审查、全量验证和收口

**文件：**
- 创建：`docs/prototype-review-records/2026-07-08-production-preparation-requirements.md`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：新增审查记录**

使用 `docs/prototype-review-record-template.md` 的结构创建审查记录，必须包含：

```md
# 生产准备工作项要求维护原型审查记录

## 改动范围

- 生产准备时效确认工作项弹窗
- 染色工作项维护染色要求入口
- 责任团队角色标签展示
- Mock 数据和自检脚本

## 自查结论

- 页面仍为 FCS 后台原型，不引入真实权限系统。
- 染色潘通信息放在染色工作项独立入口。
- 买手审核未新增流程卡点。
- 维护染色要求不计入完成数量统计。
```

- [ ] **步骤 2：运行产品设计治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 3：运行生产准备时效检查**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS。

- [ ] **步骤 4：运行构建**

运行：

```bash
npm run build
```

预期：PASS，Vite 正常输出 `dist`。

- [ ] **步骤 5：CodeGraph 同步**

运行：

```bash
codegraph sync && codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 6：Commit 收口**

```bash
git add scripts/check-production-preparation-timing.ts docs/prototype-review-records/2026-07-08-production-preparation-requirements.md
git commit -m "chore: verify production preparation requirements"
```

## 任务 7：最终人工核查点

**文件：**
- 查看：`src/pages/production/preparation-timing.ts`
- 查看：`src/data/fcs/production-preparation-timing.ts`
- 查看：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：核查业务边界**

确认代码中满足：

```text
确认工作项 = 商品类型 + 准备项 + 本次用料 + 做款/打板要求 + 通用备注
维护染色要求 = 染色工作项独立入口
染色完成 = 上传调色结果，不是维护潘通信息
买手审核 = 仅保留现有花型项，不扩展到染色/印花
```

- [ ] **步骤 2：核查无过度实现**

运行：

```bash
rg -n "permission|role engine|auth|鉴权|组织架构|买手审核" src/data/fcs/production-preparation-timing.ts src/pages/production/preparation-timing.ts
```

预期：

- 不出现真实权限引擎。
- 不出现染色或印花买手审核流程。
- 只出现角色标签展示或现有花型买手确认。

- [ ] **步骤 3：最终状态检查**

运行：

```bash
git status --short
```

预期：工作区干净。
