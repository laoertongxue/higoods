#!/usr/bin/env python3
"""Package Vite output with commit identity and content hashes."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request

MAX_MANIFEST_BYTES = 2 * 1024 * 1024
MAX_BASE_FILES = 20000


class BaseManifestError(ValueError):
    pass


def require_https_url(value):
    try:
        parts = urllib.parse.urlsplit(value)
        if (parts.scheme != 'https' or not parts.hostname or parts.username is not None
                or parts.password is not None or parts.query or parts.fragment):
            raise BaseManifestError('Base URL must use HTTPS without credentials, query or fragment')
        _ = parts.port
    except ValueError as error:
        raise BaseManifestError('Base URL must use HTTPS without credentials, query or fragment') from error
    return parts


class HTTPSOnlyRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        require_https_url(new_url)
        return super().redirect_request(request, fp, code, message, headers, new_url)


def bounded_manifest(stream):
    content = stream.read(MAX_MANIFEST_BYTES + 1)
    if len(content) > MAX_MANIFEST_BYTES:
        raise BaseManifestError('Base manifest exceeds the 2 MiB limit')
    return content


def validate_base(data, project):
    if not isinstance(data, dict) or type(data.get('schema')) is not int or data['schema'] != 1:
        raise BaseManifestError('Base manifest schema is invalid')
    if data.get('project') != project:
        raise BaseManifestError('Base manifest belongs to a different project')
    if not isinstance(data.get('sha'), str) or not re.fullmatch(r'[0-9a-f]{40}', data['sha']):
        raise BaseManifestError('Base commit identity is invalid')
    if type(data.get('run_id')) is not int or data['run_id'] < 1:
        raise BaseManifestError('Base run identity is invalid')
    files = data.get('files')
    if (not isinstance(files, dict) or not files or len(files) > MAX_BASE_FILES
            or 'index.html' not in files or 'deployment.json' in files):
        raise BaseManifestError('Base file manifest is incomplete')
    for relative, checksum in files.items():
        path = PurePosixPath(relative)
        if (not relative or path.is_absolute() or '..' in path.parts or '\\' in relative
                or any(ord(c) < 32 for c in relative) or str(path) != relative
                or relative == '.' or not isinstance(checksum, str)
                or not re.fullmatch(r'[0-9a-f]{64}', checksum)):
            raise BaseManifestError('Base file path or checksum is invalid')
    entries = data.get('entrypoints')
    if not isinstance(entries, list) or not entries:
        raise BaseManifestError('Base entry resources are missing')
    for entry in entries:
        if not isinstance(entry, str) or not entry.startswith('/') or entry[1:] not in files:
            raise BaseManifestError('Base entry resources are invalid')
    return data


def load_base(project, manifest_path=None, site_url=None):
    if manifest_path is None and site_url is None:
        return None
    try:
        if manifest_path is not None:
            with Path(manifest_path).open('rb') as source:
                content = bounded_manifest(source)
        else:
            require_https_url(site_url)
            request = urllib.request.Request(site_url.rstrip('/') + '/deployment.json',
                                             headers={'Accept-Encoding': 'gzip'})
            opener = urllib.request.build_opener(HTTPSOnlyRedirects())
            with opener.open(request, timeout=20) as response:
                require_https_url(response.geturl())
                content = bounded_manifest(response)
                encoding = response.headers.get('Content-Encoding', '').strip().lower()
                if encoding == 'gzip':
                    with gzip.GzipFile(fileobj=io.BytesIO(content)) as decoded:
                        content = bounded_manifest(decoded)
                elif encoding not in ('', 'identity'):
                    raise BaseManifestError('Base manifest has unsupported content encoding')
        try:
            data = json.loads(content)
        except (ValueError, UnicodeError) as error:
            raise BaseManifestError('Base manifest JSON is invalid') from error
        return validate_base(data, project)
    except urllib.error.HTTPError as error:
        code = error.code
        error.close()
        print(f'Incremental base unavailable (HTTP {code}); sending full release.', file=sys.stderr)
    except BaseManifestError as error:
        print(f'Incremental base rejected ({error}); sending full release.', file=sys.stderr)
    except (OSError, ValueError, EOFError, urllib.error.URLError):
        print('Incremental base unavailable (read or network failure); sending full release.', file=sys.stderr)
    return None


class Entries(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        path = values.get('src') if tag == 'script' else values.get('href') if tag == 'link' and values.get('rel') == 'stylesheet' else None
        if path and path.startswith('/'):
            self.paths.append(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True, choices=['higoods', 'old-higoods'])
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run-id', required=True, type=int)
    parser.add_argument('--dist', default='dist')
    parser.add_argument('--output', default='release.tar.gz')
    base_source = parser.add_mutually_exclusive_group()
    base_source.add_argument('--base-manifest')
    base_source.add_argument('--base-url')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.sha) or args.run_id < 1:
        parser.error('Full commit SHA and a positive run ID are required')
    if args.base_url:
        try:
            require_https_url(args.base_url)
        except BaseManifestError as error:
            parser.error(str(error))
    directory = Path(args.dist)
    entry = directory / 'index.html'
    if not entry.is_file():
        parser.error('The Vite build is missing index.html')
    # The CI build already provides Node. Compress the exact generated bytes,
    # without adding an application dependency or making the server do this work.
    subprocess.run(['node', '--input-type=module', '-e', '''
      import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
      function walk(dir) {
        for (const item of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, item.name);
          if (item.isDirectory()) walk(path);
          else if (item.isFile() && /\\.(?:html|js|css|json)$/.test(item.name) && item.name !== 'deployment.json') {
            const source = readFileSync(path);
            writeFileSync(path + '.br', brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 7 } }));
            writeFileSync(path + '.gz', gzipSync(source, { level: 9 }));
          }
        }
      }
      walk(process.argv[1]);
    ''', str(directory)], check=True)
    files = {}
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            parser.error('Build output cannot contain symbolic links')
        if path.is_file() and path.name != 'deployment.json':
            with path.open('rb') as source:
                files[str(path.relative_to(directory))] = hashlib.file_digest(source, 'sha256').hexdigest()
    entries = Entries()
    entries.feed(entry.read_text())
    if not entries.paths or any(path[1:] not in files for path in entries.paths):
        parser.error('Application entry resources are missing')
    manifest = {'schema': 1, 'project': args.project, 'sha': args.sha, 'run_id': args.run_id,
                'built_at': datetime.now(timezone.utc).isoformat(), 'files': files, 'entrypoints': entries.paths}
    base = load_base(args.project, args.base_manifest, args.base_url)
    payload = list(files)
    if base is not None:
        manifest['base'] = {'sha': base['sha'], 'run_id': base['run_id']}
        payload = [relative for relative, checksum in files.items() if base['files'].get(relative) != checksum]
    (directory / 'deployment.json').write_text(json.dumps(manifest, sort_keys=True) + '\n')
    with tarfile.open(args.output, 'w:gz') as bundle:
        for relative in [*payload, 'deployment.json']:
            bundle.add(directory / relative, arcname=relative, recursive=False)
    print(json.dumps({'project': args.project, 'sha': args.sha, 'files': len(files),
                      'payload_files': len(payload), 'total_files': len(files),
                      'archive_bytes': Path(args.output).stat().st_size,
                      'mode': 'incremental' if base is not None else 'full', 'archive': args.output}))


if __name__ == '__main__':
    main()
