#!/usr/bin/env python3
"""Run the current forward/reverse trace audit for the TMF delivery matrix."""
from pathlib import Path
import re, subprocess

ROOT = Path(__file__).resolve().parents[3]
MATRIX = ROOT / 'docs/product-design/tmf-webbing/需求追踪矩阵.md'
text = MATRIX.read_text()
rows = {}
for line in text.splitlines():
    if not line.startswith('| ') or line.startswith('| 需求编号'):
        continue
    cells = [c.strip() for c in line.strip('|').split('|')]
    if len(cells) >= 10 and re.match(r'^[A-Z]+-\d{3}$', cells[0]):
        rows[cells[0]] = cells

required = {'来源文档和章节': 1}
missing_fields = [rid for rid, c in rows.items() if len(c) < 10 or any(not c[i] for i in range(1, 10))]
source_ok = sum(1 for c in rows.values() if c[1].startswith('产品方案§'))
evidence_ok = sum(1 for c in rows.values() if 'evidence/' in c[8] or 'V1冻结/核验' in c[8])

changed = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD'], cwd=ROOT, text=True).splitlines()
changed += [line[3:] for line in subprocess.check_output(['git', 'status', '--short'], cwd=ROOT, text=True).splitlines() if len(line) > 3 and line[:2].strip() in {'M', '??', 'A'}]
changed = sorted(set(changed))
governed = [p for p in changed if p.startswith(('src/', 'tests/', 'scripts/')) and any(token in p for token in ('tmf', 'webbing', 'central-craft-factories', 'pcs-tmf-material-reference', 'tmf-product-policy'))]
unbound = []
for path in governed:
    if path not in text and Path(path).name not in text:
        unbound.append(path)

print('TMF_TRACE_AUDIT=PASS' if not missing_fields and not unbound else 'TMF_TRACE_AUDIT=FAIL')
print(f'atomic_rows={len(rows)} unique_ids={len(rows) == len(set(rows))}')
print(f'forward_source_rows={source_ok}/{len(rows)} evidence_bound_rows={evidence_ok}/{len(rows)}')
print(f'reverse_governed_files={len(governed)} bound_files={len(governed)-len(unbound)}')
if missing_fields:
    print('missing_fields=' + ','.join(missing_fields))
if unbound:
    print('unbound_governed_files=' + ','.join(unbound))
