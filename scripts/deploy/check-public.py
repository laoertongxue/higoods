#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from receiver import check_health

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--manifest', default='dist/deployment.json')
parser.add_argument('--probe', action='append', default=[])
args = parser.parse_args()
if not args.url.startswith('https://'):
    parser.error('Public verification requires HTTPS')
manifest = json.loads(Path(args.manifest).read_text())
check_health(args.url, manifest, args.probe)
print(json.dumps({'status': 'verified', 'url': args.url, 'sha': manifest['sha']}))
