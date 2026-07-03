---
name: higood-indonesia-factory-design
description: Use when designing, modifying, or reviewing HiGood prototype pages, routes, UI, copy, mock data, workflow states, Web/PDA execution flows, factory handoff, warehouse, QC, settlement, or technical-data surfaces used by Indonesian factory staff in FCS, PFOS, WLS, or PCS.
---

# HiGood 印尼工厂现场协同设计

## Overview

Use this skill to keep HiGood prototype work aligned with the Indonesian factory product-design governance docs. Treat the repo docs as the source of truth; this skill is the workflow that forces them into every relevant design and review.

## Required Project Sources

Always work from the current repository files:

- `AGENTS.md`
- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/prototype-review-record-template.md`
- `scripts/check-prototype-design-governance.ts`

For quick navigation, see:

- `references/product-design-guidelines.md`
- `references/prototype-review-checklist.md`

If project docs and skill references disagree, trust the project docs.

## When This Skill Applies

Use for any change or review involving:

- FCS、PFOS、WLS、PCS surfaces used by factory staff.
- `src/pages/`, `src/components/`, `src/data/`, `src/router/`, `src/main-handlers/`.
- Page prototype structure, UI styling, interaction, copy, status labels, mock data, route entries, workflow actions.
- PDA, factory Web, warehouse, handoff, QC, abnormal/difference, settlement, technical-pack or BOM views.
- Reviewing whether an already-built prototype can work in Indonesian factory conditions.

Do not use for unrelated backend-only checks, generic code cleanup, or purely non-prototype build tooling.

## Workflow

1. **Read current context first.** Run `codegraph sync && codegraph status`, then inspect the relevant routes/pages/data with CodeGraph before proposing or editing.
2. **Classify the surface.** Identify system, page path, role, and端类型：管理端、主管端、员工执行端.
3. **Design against constraints.** Use `docs/higood-indonesia-factory-product-design-guidelines.md` before editing or proposing UI. Pay special attention to现场能力假设、协作关系、任务动作、界面用语、UI 样式、防错、异常兜底.
4. **Keep the implementation small.** This repo is a prototype. Prefer existing string-template patterns and existing `src/components/ui/` helpers. Do not introduce new infrastructure.
5. **Create or update a review record when prototype files change.** Copy `docs/prototype-review-record-template.md` into `docs/prototype-review-records/YYYY-MM-DD-<topic>.md` and fill only the sections needed for the touched surface.
6. **Run checks.** At minimum run `npm run check:prototype-design-governance`. For code changes, also run the smallest relevant project check or `npm run build`.
7. **Report the governance result.** Final response must mention which design-guideline areas mattered, whether the prototype checklist passed, and whether any exception remains.

## Review Record Rule

If a change touches prototype-relevant files under:

- `src/pages/`
- `src/components/`
- `src/data/`
- `src/router/`
- `src/main-handlers/`

then it needs a review record in `docs/prototype-review-records/`, unless the user explicitly asks only for analysis and no file changes are made.

The governance script checks staged files by default. Use `npm run check:prototype-design-governance -- --all` only when you intentionally want to audit the whole dirty worktree.

## Core Design Lens

Do not split thinking by Web vs PDA. Split by role and task:

- **管理端:** high-density, full-chain, traceable decisions.
- **主管端:** exceptions, assignment, review, fallback.
- **员工执行端:** current task, current object, current action, current result.

For Indonesian frontline staff, optimize for:

- 少读。
- 少想。
- 少算。
- 少选。
- 少填。
- 系统多判断。
- 主管可兜底。

## Common Failure Modes

- Treating UI style as separate from product design.
- Copying management-table density into employee execution pages.
- Using abstract copy such as 写回、投影、执行对象、来源记录、状态流转 on frontline pages.
- Letting workers calculate quantity differences manually.
- Adding multiple primary actions to the same frontline screen.
- Forgetting the review record because the change is “only copy” or “only mock data.”
- Running build but skipping `check:prototype-design-governance`.
