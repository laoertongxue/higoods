"""只读检查方案与追踪表；--implementation 校验实施状态，不冒充业务验收。"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
AUDIT = HERE.parent / '2026-10-04-product-material-domain-audit-v2'
parser = argparse.ArgumentParser()
parser.add_argument('--implementation', action='store_true')
args = parser.parse_args()


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


fields = read_csv(HERE / 'field-dictionary.csv')
requirements = read_csv(HERE / 'requirement-traceability.csv')
decisions = read_csv(HERE / 'decision-coverage.csv')
dispositions = read_csv(HERE / 'prototype-field-disposition.csv')
online = read_csv(HERE / 'online-information-coverage.csv')
source_fields = read_csv(AUDIT / 'prototype-fields.csv')
source_online = read_csv(AUDIT / 'online-field-mapping.csv')
checks = []


def check(name, passed, detail):
    checks.append({'check': name, 'passed': bool(passed), 'detail': detail})


for label, rows, key in [
    ('字段', fields, 'field_id'), ('需求', requirements, 'requirement_id'),
    ('决策', decisions, 'decision_id'), ('原型处置', dispositions, 'source_index'), ('线上承接', online, 'source_id')
]:
    counts = Counter(r[key] for r in rows)
    check(label + '编号唯一', all(n == 1 for n in counts.values()), len(rows))
    missing = [(i + 1, k) for i, r in enumerate(rows) for k, v in r.items() if v is None or not v.strip()]
    check(label + '表格必填列非空', not missing, missing)

check('决策64项完整', len(decisions) == 64, len(decisions))
decision_ids = {r['decision_id'] for r in decisions}
req_ids = {r['requirement_id'] for r in requirements}
unlinked = [r['decision_id'] for r in decisions if not r['requirement_ids'] or not set(r['requirement_ids'].split(';')).issubset(req_ids)]
check('64决策均指向有效原子需求', not unlinked, unlinked)
bad_sources = [(r['requirement_id'], ref) for r in requirements for ref in r['decision_refs'].split('/')
               if ref not in decision_ids and ref not in {'USR-010', 'USR-011', 'USR-013', 'AGENTS'}]
check('需求来源编号有效', not bad_sources, bad_sources)
if args.implementation:
    allowed = {'待实施', '实施中', '已实现待验证', '已验证', '已阻塞', '不适用'}
    check('实施状态有效', all(r['status'] in allowed for r in requirements), dict(Counter(r['status'] for r in requirements)))
    unbound = [r['requirement_id'] for r in requirements if r['status'] in {'已实现待验证', '已验证'}
               and any(v in r['implementation_position'] for v in ['待绑定', '待实施'])]
    check('已实现需求绑定实现位置', not unbound, unbound)
    unsupported = [r['requirement_id'] for r in requirements if r['status'] == '已验证'
                   and any(any(v in r[k] for v in ['待实施', '尚无', '待验证']) for k in ['automation', 'page_device_performance', 'evidence'])]
    check('已验证条目不保留未验证声明', not unsupported, unsupported)
else:
    check('所有需求保持待实施', all(r['status'] == '待实施' for r in requirements), dict(Counter(r['status'] for r in requirements)))
check('10个工作包被覆盖', {r['work_package'] for r in requirements} == {f'WP{i:02}' for i in range(1, 11)},
      dict(Counter(r['work_package'] for r in requirements)))

coverage_sections = set()
for r in requirements:
    coverage_sections.update(int(v) for v in re.findall(r'§(\d+)', r['source'].split('prototype-adjustment-proposal.md')[-1]))
check('正文15主章节均有需求关联', coverage_sections == set(range(1, 16)), sorted(coverage_sections))

field_refs = {r['field_id'].split('-')[0] + '.' + r['field_key'] for r in fields}
bad_refs = []
for name, rows, column in [('原型', dispositions, 'target_contract'), ('线上', online, 'target_fields')]:
    for r in rows:
        for ref in re.findall(r'\b[A-Z]+\.[A-Za-z][A-Za-z0-9]*', r[column]):
            if ref not in field_refs:
                bad_refs.append((name, r.get('source_index', r.get('source_id')), ref))
check('目标字段引用均存在', not bad_refs, bad_refs)
check('403字段来源逐行保留', len(dispositions) == len(source_fields) == 403 and all(
    d['source_file'] == s['file'] and d['source_object'] == s['object'] and d['source_field'] == s['field']
    and d['source_type'] == s['type'] and d['source_optional'] == s['optional'] and d['source_line'] == s['line']
    for d, s in zip(dispositions, source_fields)), len(dispositions))
check('69线上组来源逐行保留', len(online) == len(source_online) == 69 and all(
    d['source_id'] == s['id'] and d['source_page'] == s['source_page'] and d['observed_fields'] == s['visible_fields']
    for d, s in zip(online, source_online)), len(online))

bad_links = []
for f in HERE.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)', f.read_text()):
        target = target.strip('<>').split('#')[0]
        if not target or re.match(r'https?://', target):
            continue
        target = re.sub(r':\d+$', '', target)
        if not (f.parent / target).exists():
            bad_links.append((f.name, target))
check('Markdown本地文件链接存在', not bad_links, bad_links)

plan = (HERE / 'implementation-and-validation-plan.md').read_text()
scenario_ids = re.findall(r'^\| (S\d{2}) ', plan, re.M)
check('41场景编号完整唯一', len(scenario_ids) == 41 and set(scenario_ids) == {f'S{i:02}' for i in range(1, 42)}, len(scenario_ids))
proposal = (HERE / 'prototype-adjustment-proposal.md').read_text()
page_ids = re.findall(r'^\| (P\d{2}) ', proposal, re.M)
check('17页面编号完整唯一', len(page_ids) == 17 and set(page_ids) == {f'P{i:02}' for i in range(1, 18)}, len(page_ids))
check('Markdown代码围栏成对', all(f.read_text().count('```') % 2 == 0 for f in HERE.glob('*.md')), '结构检查，不代表Mermaid已渲染验收')

baseline = json.loads((HERE / 'source-baseline.json').read_text())
baseline_sources = {key: digest for key, digest in baseline['sha256'].items()
                    if not args.implementation or key.startswith('docs/reviews/2026-10-04-product-material-domain-audit-v2/')}
changed = [key for key, digest in baseline_sources.items()
           if not (ROOT / key).exists() or hashlib.sha256((ROOT / key).read_bytes()).hexdigest() != digest]
check('原始审计依据未改变' if args.implementation else '原始依据及已登记源码未改变', not changed,
      {'tracked_sources': len(baseline_sources), 'changed': changed})

result = {'scope': '实施追踪结构检查；业务结果以逐项证据为准' if args.implementation else '文档结构/引用/数量/来源完整性检查；不是业务实现验证',
          'counts': {'fields': len(fields), 'requirements': len(requirements), 'decisions': len(decisions),
                     'prototype_fields': len(dispositions), 'online_groups': len(online), 'scenarios': len(scenario_ids),
                     'pages': len(page_ids), 'mermaid_blocks': proposal.count('```mermaid')},
          'all_passed': all(c['passed'] for c in checks), 'checks': checks}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result['all_passed'] else 1)
