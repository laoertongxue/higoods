#!/usr/bin/env python3
"""Receive one verified static release for a fixed site; no privileged commands."""
import argparse
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
import uuid

MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
MAX_FILES = 20000


class DeploymentError(Exception):
    pass


def safe_path(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or '\\' in value or any(ord(c) < 32 for c in value):
        raise DeploymentError('Archive contains an unsafe path')
    if str(path) in ('', '.'):
        raise DeploymentError('Archive contains an empty path')
    return str(path)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def extract(archive, directory):
    seen, total = set(), 0
    try:
        with tarfile.open(fileobj=archive, mode='r|gz') as bundle:
            for member in bundle:
                relative = safe_path(member.name)
                if relative in seen:
                    raise DeploymentError('Archive contains duplicate paths')
                seen.add(relative)
                if len(seen) > MAX_FILES:
                    raise DeploymentError('Archive contains too many entries')
                target = directory / relative
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True, mode=0o755)
                    continue
                if not member.isfile():
                    raise DeploymentError('Archive links and special files are forbidden')
                total += member.size
                if total > MAX_ARCHIVE_BYTES:
                    raise DeploymentError('Archive exceeds the release size limit')
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                source = bundle.extractfile(member)
                if source is None:
                    raise DeploymentError('Archive entry cannot be read')
                with source, target.open('xb') as destination:
                    shutil.copyfileobj(source, destination)
                if target.stat().st_size != member.size:
                    raise DeploymentError('Archive entry is incomplete')
                target.chmod(0o644)
    except (tarfile.TarError, EOFError, OSError, ValueError) as error:
        raise DeploymentError('Archive is invalid or incomplete') from error


def verify(directory, project, sha, run_id):
    try:
        manifest = json.loads((directory / 'deployment.json').read_text())
    except (OSError, ValueError) as error:
        raise DeploymentError('Release manifest is missing or invalid') from error
    if not isinstance(manifest, dict) or manifest.get('schema') != 1:
        raise DeploymentError('Unsupported release manifest')
    if (manifest.get('project'), manifest.get('sha'), manifest.get('run_id')) != (project, sha, run_id):
        raise DeploymentError('Release identity does not match this deployment')
    files = manifest.get('files')
    if not isinstance(files, dict) or not files or 'index.html' not in files or 'deployment.json' in files:
        raise DeploymentError('Release file manifest is incomplete')
    actual = {str(path.relative_to(directory)) for path in directory.rglob('*') if path.is_file()}
    if actual != set(files) | {'deployment.json'}:
        raise DeploymentError('Release contains missing or unexpected files')
    for relative, expected in files.items():
        if safe_path(relative) != relative or not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected):
            raise DeploymentError('Release contains an invalid file checksum')
        if sha256(directory / relative) != expected:
            raise DeploymentError('Release file checksum does not match')
    entrypoints = manifest.get('entrypoints')
    if not isinstance(entrypoints, list) or not entrypoints:
        raise DeploymentError('Release entry resources are missing')
    for path in entrypoints:
        if not isinstance(path, str) or not path.startswith('/') or safe_path(path[1:]) not in files:
            raise DeploymentError('Release entry resource is invalid')
    return manifest


def complete_from_base(directory, root, project):
    """Reuse verified immutable files; the incoming manifest remains authoritative."""
    try:
        target = json.loads((directory / 'deployment.json').read_text())
    except (OSError, ValueError) as error:
        raise DeploymentError('Release manifest is missing or invalid') from error
    if not isinstance(target, dict):
        raise DeploymentError('Release manifest is invalid')
    base = target.get('base')
    if base is None:
        return
    if not isinstance(base, dict) or not re.fullmatch(r'[0-9a-f]{40}', str(base.get('sha', ''))):
        raise DeploymentError('Incremental base identity is invalid')
    base_run = base.get('run_id')
    if not isinstance(base_run, int) or isinstance(base_run, bool) or base_run < 1:
        raise DeploymentError('Incremental base run ID is invalid')
    source = root / 'releases' / (base['sha'] + '-' + str(base_run))
    if source.is_symlink() or not source.is_dir():
        raise DeploymentError('Incremental base is no longer available')
    old = verify(source, project, base['sha'], base_run)
    files = target.get('files')
    if not isinstance(files, dict) or len(files) > MAX_FILES:
        raise DeploymentError('Incremental file manifest is invalid')
    for relative, checksum in files.items():
        if safe_path(relative) != relative or relative == 'deployment.json':
            raise DeploymentError('Incremental file path is invalid')
        destination = directory / relative
        if destination.exists():
            continue
        if old['files'].get(relative) != checksum:
            raise DeploymentError('A changed release file was not uploaded')
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        os.link(source / relative, destination)


def make_web_readable(directory):
    directory.chmod(0o755)
    for path in directory.rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)


def link_target(path):
    if path.is_symlink():
        return os.readlink(path)
    if path.exists():
        raise DeploymentError('Publication pointer must be a symbolic link')
    return None


def replace_link(path, target):
    if target is None:
        path.unlink(missing_ok=True)
        return
    temporary = path.with_name('.' + path.name + '-' + uuid.uuid4().hex)
    try:
        temporary.symlink_to(target)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def request(base, path):
    url = base.rstrip('/') + path
    req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'Accept-Encoding': 'gzip'})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            content = response.read()
            return gzip.decompress(content) if response.headers.get('Content-Encoding') == 'gzip' else content
    except urllib.error.HTTPError as error:
        error.close()
        raise


def check_health(base, manifest, probes):
    try:
        published = json.loads(request(base, '/deployment.json'))
        if (published.get('project'), published.get('sha'), published.get('run_id')) != (manifest['project'], manifest['sha'], manifest['run_id']):
            raise DeploymentError('Published version does not match the uploaded release')
        for path in ['/', *probes]:
            if hashlib.sha256(request(base, path)).hexdigest() != manifest['files']['index.html']:
                raise DeploymentError('Published page is not the expected application entry')
        for path in manifest['entrypoints']:
            if hashlib.sha256(request(base, path)).hexdigest() != manifest['files'][path[1:]]:
                raise DeploymentError('Published entry resource does not match')
        missing = '/__deploy_missing__' + manifest['sha'] + '.js'
        try:
            request(base, missing)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise DeploymentError('Missing resource does not return 404') from error
        else:
            raise DeploymentError('Missing resource incorrectly returns an application page')
    except DeploymentError:
        raise
    except (urllib.error.URLError, OSError, ValueError, AttributeError) as error:
        raise DeploymentError('Published application health check failed') from error


def deploy(root, project, sha, run_id, archive, health_url, probes):
    if not re.fullmatch(r'[a-z][a-z0-9_-]{0,40}', project) or not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise DeploymentError('Invalid project or commit SHA')
    if not isinstance(run_id, int) or isinstance(run_id, bool) or run_id < 1:
        raise DeploymentError('Invalid deployment run ID')
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    root.chmod(0o755)
    releases = root / 'releases'
    releases.mkdir(exist_ok=True)
    releases.chmod(0o755)
    temporary = Path(tempfile.mkdtemp(prefix='.incoming-', dir=root))
    try:
        extract(archive, temporary)
        with (root / '.deploy.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            # Hold the same lock as cleanup while validating and linking the base.
            complete_from_base(temporary, root, project)
            manifest = verify(temporary, project, sha, run_id)
            # The publisher and Caddy run as different users. mkdtemp starts at 0700.
            make_web_readable(temporary)
            current, previous = root / 'current', root / 'previous'
            old_current, old_previous = link_target(current), link_target(previous)
            if old_current:
                try:
                    active = json.loads((current / 'deployment.json').read_text())
                    if active['project'] != project:
                        raise DeploymentError('Active release belongs to a different project')
                    if active['run_id'] > run_id:
                        raise DeploymentError('An older deployment cannot replace the active release')
                    if active['run_id'] == run_id and active['sha'] != sha:
                        raise DeploymentError('Deployment run ID was reused for a different commit')
                except (OSError, ValueError, KeyError, TypeError) as error:
                    raise DeploymentError('Active release cannot be verified') from error
            release_name = sha + '-' + str(run_id)
            destination = releases / release_name
            if destination.exists():
                existing = verify(destination, project, sha, run_id)
                if existing['files'] != manifest['files'] or existing['entrypoints'] != manifest['entrypoints']:
                    raise DeploymentError('An immutable release cannot be overwritten')
                make_web_readable(destination)
            else:
                os.replace(temporary, destination)
            target = 'releases/' + release_name
            if old_current == target:
                check_health(health_url, manifest, probes)
                return {'status': 'unchanged', 'project': project, 'sha': sha, 'run_id': run_id}
            try:
                replace_link(previous, old_current)
                replace_link(current, target)
                check_health(health_url, manifest, probes)
                state = {'project': project, 'sha': sha, 'run_id': run_id, 'current': target, 'old_current': old_current, 'old_previous': old_previous}
                state_file = root / '.publication.json'
                state_temp = root / ('.publication-' + uuid.uuid4().hex)
                try:
                    state_temp.write_text(json.dumps(state))
                    state_temp.chmod(0o600)
                    os.replace(state_temp, state_file)
                finally:
                    state_temp.unlink(missing_ok=True)
            except Exception:
                replace_link(current, old_current)
                replace_link(previous, old_previous)
                raise
            # Keep the current release plus four earlier releases; never remove an active pointer.
            protected = {current.resolve()}
            for pointer in (old_current, old_previous):
                if pointer:
                    protected.add((root / pointer).resolve())
            versions = sorted((p for p in releases.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime, reverse=True)
            for stale in versions[5:]:
                if stale.resolve() not in protected:
                    try:
                        shutil.rmtree(stale)
                    except OSError as error:
                        print('Retained an old release after cleanup failed: ' + str(error), file=sys.stderr)
            return {'status': 'deployed', 'project': project, 'sha': sha, 'run_id': run_id}
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def rollback(root, project, sha, run_id, health_url, probes):
    root = Path(root)
    with (root / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads((root / '.publication.json').read_text())
        if (state.get('project'), state.get('sha'), state.get('run_id')) != (project, sha, run_id):
            raise DeploymentError('A stale rollback cannot affect another release')
        if link_target(root / 'current') != state['current']:
            raise DeploymentError('The release to roll back is no longer active')
        replace_link(root / 'current', state['old_current'])
        replace_link(root / 'previous', state['old_previous'])
        if state['old_current']:
            manifest = json.loads((root / 'current' / 'deployment.json').read_text())
            check_health(health_url, manifest, probes)
        return {'status': 'rolled-back', 'project': project, 'rejected_sha': sha}


def main():
    os.umask(0o022)
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', required=True, choices=['higoods', 'old-higoods'])
    parser.add_argument('--config', default='/etc/higoods-deploy/sites.json')
    args = parser.parse_args()
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    match = re.fullmatch(r'(deploy|rollback) ([0-9a-f]{40}) ([1-9][0-9]*)', command)
    if not match:
        raise DeploymentError('Only a fixed-site deployment command is allowed')
    config = json.loads(Path(args.config).read_text())[args.site]
    if match[1] == 'deploy':
        result = deploy(Path(config['root']), args.site, match[2], int(match[3]), sys.stdin.buffer, config['health_url'], config['probes'])
    else:
        result = rollback(Path(config['root']), args.site, match[2], int(match[3]), config['health_url'], config['probes'])
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except (DeploymentError, OSError, ValueError, KeyError) as error:
        print('Deployment rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
