---
name: higood-indonesia-factory-design
description: Use when designing, modifying, or reviewing HiGood prototype pages, routes, UI, copy, mock data, workflow states, Web/PDA execution flows, factory handoff, warehouse, QC, settlement, or technical-data surfaces used by Indonesian factory staff in FCS, PFOS, WLS, or PCS.
---

# HiGood 印尼工厂现场协同设计

## Overview

Use this skill to apply the compact project governance embedded in `AGENTS.md` to Indonesian factory prototype work. Do not turn the skill into a second policy source or reread historical long documents during ordinary tasks.

## Current Project Sources

Always use the current repository files:

- `AGENTS.md` sections 4, 5, and 7 — current design, UI, image, review, and verification rules.
- `docs/prototype-review-record-template.md` — two-mode governance record.
- `scripts/check-prototype-design-governance.ts` — automated coverage gate.

The following files are historical detail only. Read them only when the user asks to trace historical rationale, when changing the embedded governance baseline, or when `AGENTS.md` does not resolve a disputed case:

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

If sources disagree, follow current `AGENTS.md` and the user's latest confirmed business facts.

## Workflow

1. Confirm task scope, branch / HEAD, actual route or runtime, role, and端类型.
2. Use CodeGraph for structural context and `rg` for literal routes, labels, and states; do not repeat already sufficient evidence.
3. Apply the role, task, quantity, language, handoff, fallback, device, and real-image gates in `AGENTS.md`.
4. Keep implementation within the existing string-template architecture and task-owned files.
5. Classify impact before creating governance evidence:
   - **User-visible impact:** complete the full product review in `docs/prototype-review-record-template.md`.
   - **No user-visible impact:** complete only the lightweight impact declaration and technical verification.
   - **Uncertain:** treat as user-visible.
6. Run the smallest relevant checks and named browser / PDA / print acceptance. Run `npm run check:prototype-design-governance` before submission or delivery.
7. Report the applicable design gates, result, and any exception without restating the full checklist.

## User-visible Impact

User-visible impact includes changes to page structure, style, copy, fields, status, quantity, images, rendered Mock data, routes, navigation, buttons, interactions, error prevention, abnormal flows, or shared components / data / handlers that change those results.

Pure internal refactoring, type or naming cleanup, internal utilities, implementation-only performance work, and test maintenance may use the lightweight declaration only when direct technical evidence proves the rendered facts, routes, and interactions remain unchanged. Never label real copy, Mock, image, status, route, or interaction changes as technical-only.

## Core Design Lens

- **管理端:** high-density, full-chain, traceable decisions.
- **主管端:** exceptions, assignment, review, fallback.
- **员工执行端:** current task, current object, current action, current result.

For frontline staff: 少读、少想、少算、少选、少填、系统多判断、主管可兜底. Style and material objects always require real corresponding images, same-column or same-block thumbnails, and clickable large-image dialogs.
