"""Exercise the release CLI and independently decode its compressed artifacts."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PREPARE = REPO_ROOT / "scripts/deploy/prepare-release.py"
SPEC = importlib.util.spec_from_file_location(
    "higoods_prepare_receiver", REPO_ROOT / "scripts/deploy/receiver.py"
)
assert SPEC is not None and SPEC.loader is not None
receiver = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = receiver
SPEC.loader.exec_module(receiver)
PREPARE_SPEC = importlib.util.spec_from_file_location("higoods_prepare_cli", PREPARE)
assert PREPARE_SPEC is not None and PREPARE_SPEC.loader is not None
prepare = importlib.util.module_from_spec(PREPARE_SPEC)
PREPARE_SPEC.loader.exec_module(prepare)

PROJECT = "higoods"
SHA = "d" * 40
RUN_ID = 501


class PrepareReleaseContracts(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(shutil.which("node"), "release packaging requires Node on PATH")
        self.temp = tempfile.TemporaryDirectory(prefix="higoods-prepare-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.dist = self.root / "dist"
        self.dist.mkdir()
        self.archive = self.root / "release.tar.gz"
        self.sources = {
            "index.html": (
                '<!doctype html><html><head>'
                '<link rel="stylesheet" href="/assets/main.css">'
                '</head><body><main>服装原型</main>'
                '<script type="module" src="/assets/main.js"></script>'
                '</body></html>'
            ).encode(),
            "assets/main.js": "console.log('构建产物');\n".encode(),
            "assets/main.css": b"body { color: #123; }\n",
            "data/settings.json": json.dumps(
                {"title": "技术包", "enabled": True, "quantity": 12},
                ensure_ascii=False,
            ).encode(),
            "images/sample.png": b"\x89PNG\r\n\x1a\nfixture-binary-\x00\xff",
        }
        self.compressible = {path for path in self.sources
                             if Path(path).suffix in {".html", ".js", ".css", ".json"}}
        for path, content in self.sources.items():
            target = self.dist / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)

    def package(self, sha: str = SHA, run_id: int = RUN_ID,
                extra_args: list[str] | None = None) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(PREPARE), "--project", PROJECT,
             "--sha", sha, "--run-id", str(run_id),
             "--dist", str(self.dist), "--output", str(self.archive),
             *(extra_args or [])],
            cwd=self.root, capture_output=True, text=True, timeout=30,
        )

    def assert_package_succeeded(self) -> dict:
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["sha"], SHA)
        return json.loads((self.dist / "deployment.json").read_text())

    def brotli_decode(self, path: Path) -> bytes:
        result = subprocess.run(
            ["node", "--input-type=module", "-e",
             "import { readFileSync } from 'node:fs';"
             "import { brotliDecompressSync } from 'node:zlib';"
             "process.stdout.write(brotliDecompressSync(readFileSync(process.argv[1])));",
             str(path)],
            cwd=self.root, capture_output=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        return result.stdout

    def test_sidecars_decode_exactly_and_complete_archive_is_receiver_valid(self):
        manifest = self.assert_package_succeeded()
        expected = set(self.sources) | {
            path + suffix for path in self.compressible for suffix in (".br", ".gz")
        }
        self.assertEqual(set(manifest["files"]), expected)
        self.assertEqual(set(manifest["entrypoints"]),
                         {"/assets/main.js", "/assets/main.css"})
        for path, content in self.sources.items():
            with self.subTest(original=path):
                self.assertEqual((self.dist / path).read_bytes(), content)
        for path in self.compressible:
            with self.subTest(compressed=path):
                self.assertEqual(gzip.decompress((self.dist / (path + ".gz")).read_bytes()),
                                 self.sources[path])
                self.assertEqual(self.brotli_decode(self.dist / (path + ".br")),
                                 self.sources[path])
        for path, checksum in manifest["files"].items():
            with self.subTest(checksum=path):
                self.assertEqual(hashlib.sha256((self.dist / path).read_bytes()).hexdigest(),
                                 checksum)

        unpacked = self.root / "unpacked"
        unpacked.mkdir()
        with self.archive.open("rb") as stream:
            receiver.extract(stream, unpacked)
        verified = receiver.verify(unpacked, PROJECT, SHA, RUN_ID)
        self.assertEqual(verified, manifest)
        actual = {str(path.relative_to(unpacked)) for path in unpacked.rglob("*")
                  if path.is_file()}
        self.assertEqual(actual, expected | {"deployment.json"})
        for path in expected:
            with self.subTest(archived=path):
                self.assertEqual((unpacked / path).read_bytes(), (self.dist / path).read_bytes())

    def test_repeated_packaging_replaces_old_manifest_without_compressing_it(self):
        old_manifest = b'{"sha":"obsolete","files":{"deployment.json":"wrong"}}'
        (self.dist / "deployment.json").write_bytes(old_manifest)
        first = self.assert_package_succeeded()
        first_content = {path: (self.dist / path).read_bytes() for path in first["files"]}
        second = self.assert_package_succeeded()
        self.assertEqual(second["files"], first["files"])
        self.assertEqual(second["entrypoints"], first["entrypoints"])
        self.assertNotEqual((self.dist / "deployment.json").read_bytes(), old_manifest)
        self.assertNotIn("deployment.json", second["files"])
        for path, content in first_content.items():
            with self.subTest(stable_artifact=path):
                self.assertEqual((self.dist / path).read_bytes(), content)
                self.assertFalse(path.endswith((".gz.gz", ".gz.br", ".br.gz", ".br.br")))
        self.assertFalse((self.dist / "deployment.json.br").exists())
        self.assertFalse((self.dist / "deployment.json.gz").exists())
        unpacked = self.root / "repeated-unpacked"
        unpacked.mkdir()
        with self.archive.open("rb") as stream:
            receiver.extract(stream, unpacked)
        self.assertEqual(receiver.verify(unpacked, PROJECT, SHA, RUN_ID), second)

    def test_missing_entry_resources_rejects_packaging(self):
        for html in (b"<!doctype html><main>No entry resources</main>",
                     b'<script type="module" src="/assets/missing.js"></script>'):
            with self.subTest(html=html):
                (self.dist / "index.html").write_bytes(html)
                result = self.package()
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.archive.exists())
                self.assertFalse((self.dist / "deployment.json").exists())

    def test_invalid_commit_identity_rejects_before_emitting_release(self):
        for sha in ("short", "a" * 39, "G" * 40):
            with self.subTest(sha=sha):
                result = self.package(sha=sha)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.archive.exists())
                self.assertFalse((self.dist / "deployment.json").exists())
                self.assertFalse((self.dist / "index.html.gz").exists())

    def archive_content(self):
        with tarfile.open(self.archive, 'r:gz') as archive:
            return {member.name: archive.extractfile(member).read()
                    for member in archive.getmembers() if member.isfile()}

    def saved_base(self):
        base = self.assert_package_succeeded()
        path = self.root / 'base.json'
        path.write_text(json.dumps(base))
        return base, path

    def test_incremental_tar_contains_only_changed_added_files_and_full_target_manifest(self):
        removed = self.dist / 'assets/obsolete.js'
        removed.write_bytes(b'console.log("old only");')
        base, path = self.saved_base()
        releases = self.root / 'server' / 'releases'
        base_directory = releases / f'{SHA}-{RUN_ID}'
        base_directory.mkdir(parents=True)
        with self.archive.open('rb') as stream:
            receiver.extract(stream, base_directory)
        changed = b'console.log("new target");'
        (self.dist / 'assets/main.js').write_bytes(changed)
        added = b'{"new":true,"quantity":24}'
        (self.dist / 'data/added.json').write_bytes(added)
        for suffix in ('', '.br', '.gz'):
            (self.dist / ('assets/obsolete.js' + suffix)).unlink()
        new_sha, new_run = 'e' * 40, RUN_ID + 1
        result = self.package(new_sha, new_run, ['--base-manifest', str(path)])
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.dist / 'deployment.json').read_text())
        self.assertEqual(manifest['base'], {'sha': SHA, 'run_id': RUN_ID})
        expected_payload = {name + suffix for name in ('assets/main.js', 'data/added.json')
                            for suffix in ('', '.br', '.gz')}
        content = self.archive_content()
        self.assertEqual(set(content), expected_payload | {'deployment.json'})
        for name, source in (('assets/main.js', changed), ('data/added.json', added)):
            self.assertEqual(content[name], source)
            self.assertEqual(gzip.decompress(content[name + '.gz']), source)
            self.assertEqual(self.brotli_decode(self.dist / (name + '.br')), source)
        expected_full = (set(base['files']) - {'assets/obsolete.js' + suffix
                         for suffix in ('', '.br', '.gz')}) | {
                         'data/added.json' + suffix for suffix in ('', '.br', '.gz')}
        self.assertEqual(set(manifest['files']), expected_full)
        for name, checksum in manifest['files'].items():
            self.assertEqual(hashlib.sha256((self.dist / name).read_bytes()).hexdigest(), checksum)
        summary = json.loads(result.stdout)
        self.assertEqual(summary['mode'], 'incremental')
        self.assertEqual(summary['payload_files'], len(expected_payload))
        self.assertEqual(summary['total_files'], len(expected_full))
        self.assertEqual(summary['archive_bytes'], self.archive.stat().st_size)
        target = self.root / 'incremental-unpacked'
        target.mkdir()
        with self.archive.open('rb') as stream:
            receiver.extract(stream, target)
        receiver.complete_from_base(target, self.root / 'server', PROJECT)
        self.assertEqual(receiver.verify(target, PROJECT, new_sha, new_run), manifest)
        self.assertFalse((target / 'assets/obsolete.js').exists())
        self.assertFalse((target / 'assets/obsolete.js.br').exists())
        self.assertFalse((target / 'assets/obsolete.js.gz').exists())
        for name in expected_full:
            self.assertEqual((target / name).read_bytes(), (self.dist / name).read_bytes())

    def test_unchanged_incremental_release_uploads_only_new_identity_manifest(self):
        base, path = self.saved_base()
        before = {name: (self.dist / name).read_bytes() for name in base['files']}
        result = self.package('e' * 40, RUN_ID + 1, ['--base-manifest', str(path)])
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.dist / 'deployment.json').read_text())
        self.assertEqual(manifest['files'], base['files'])
        self.assertEqual(set(self.archive_content()), {'deployment.json'})
        self.assertEqual(json.loads(result.stdout)['payload_files'], 0)
        for name, original in before.items():
            self.assertEqual((self.dist / name).read_bytes(), original)

    def test_invalid_base_falls_back_to_complete_archive_without_logging_contents(self):
        base, path = self.saved_base()
        cases = [b'PRIVATE-invalid-json', dict(base, schema=2), dict(base, schema=True),
                 dict(base, sha='short'), dict(base, run_id=True), dict(base, run_id=0),
                 dict(base, files={**base['files'], 'assets/main.js': 'wrong'}),
                 dict(base, files={**base['files'], '../PRIVATE': 'a' * 64}),
                 dict(base, entrypoints=['/assets/not-present.js'])]
        for invalid in cases:
            with self.subTest(invalid=type(invalid).__name__):
                path.write_bytes(invalid if isinstance(invalid, bytes) else json.dumps(invalid).encode())
                result = self.package('e' * 40, RUN_ID + 1, ['--base-manifest', str(path)])
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('sending full release', result.stderr)
                self.assertNotIn('PRIVATE', result.stderr)
                manifest = json.loads((self.dist / 'deployment.json').read_text())
                self.assertNotIn('base', manifest)
                self.assertEqual(set(self.archive_content()), set(manifest['files']) | {'deployment.json'})
                self.assertEqual(json.loads(result.stdout)['mode'], 'full')

    def test_base_for_other_project_falls_back_to_complete_archive(self):
        base, path = self.saved_base()
        path.write_text(json.dumps(dict(base, project='old-higoods')))
        result = self.package(extra_args=['--base-manifest', str(path)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('different project', result.stderr)
        self.assertNotIn('base', json.loads((self.dist / 'deployment.json').read_text()))
        self.assertEqual(json.loads(result.stdout)['payload_files'], len(base['files']))

    def test_missing_local_base_falls_back_to_complete_archive(self):
        result = self.package(extra_args=['--base-manifest', str(self.root / 'missing.json')])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('sending full release', result.stderr)
        manifest = json.loads((self.dist / 'deployment.json').read_text())
        self.assertNotIn('base', manifest)
        self.assertEqual(set(self.archive_content()), set(manifest['files']) | {'deployment.json'})

    def test_base_sources_are_mutually_exclusive_and_http_is_rejected_before_packaging(self):
        for arguments in (['--base-url', 'http://example.test'],
                          ['--base-url', 'https://user:PRIVATE@example.test'],
                          ['--base-url', 'https://example.test?PRIVATE=1'],
                          ['--base-manifest', 'base.json', '--base-url', 'https://example.test']):
            with self.subTest(arguments=arguments):
                result = self.package(extra_args=arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('PRIVATE', result.stderr)
                self.assertFalse(self.archive.exists())
                self.assertFalse((self.dist / 'index.html.gz').exists())

    def fake_response(self, content, encoding=''):
        response = io.BytesIO(content)
        response.headers = {'Content-Encoding': encoding}
        response.geturl = lambda: 'https://example.test/deployment.json'
        return response

    def test_https_base_download_decodes_gzip_and_uses_bounded_read_and_timeout(self):
        base, _ = self.saved_base()
        response = self.fake_response(gzip.compress(json.dumps(base).encode()), 'gzip')
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(prepare.urllib.request, 'build_opener', return_value=opener):
            self.assertEqual(prepare.load_base(PROJECT, site_url='https://example.test/'), base)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, 'https://example.test/deployment.json')
        self.assertEqual(request.get_header('Accept-encoding'), 'gzip')
        self.assertEqual(opener.open.call_args.kwargs, {'timeout': 20})
        self.assertTrue(response.closed)

    def test_oversized_raw_or_gzip_decoded_base_falls_back_without_unbounded_read(self):
        for content, encoding in ((b' ' * (prepare.MAX_MANIFEST_BYTES + 1), ''),
                                  (gzip.compress(b' ' * (prepare.MAX_MANIFEST_BYTES + 1)), 'gzip')):
            with self.subTest(encoding=encoding):
                response = self.fake_response(content, encoding)
                opener = mock.Mock()
                opener.open.return_value = response
                stderr = io.StringIO()
                with mock.patch.object(prepare.urllib.request, 'build_opener', return_value=opener), \
                        mock.patch.object(prepare.sys, 'stderr', stderr):
                    self.assertIsNone(prepare.load_base(PROJECT, site_url='https://example.test'))
                self.assertIn('2 MiB', stderr.getvalue())
                self.assertIn('sending full release', stderr.getvalue())

    def test_http_missing_or_network_failure_falls_back_without_logging_response_data(self):
        body = io.BytesIO(b'PRIVATE response data')
        missing = urllib.error.HTTPError('https://example.test/deployment.json', 404,
                                         'PRIVATE reason', {}, body)
        for error in (missing, urllib.error.URLError('PRIVATE network data'), TimeoutError('PRIVATE')):
            with self.subTest(error=type(error).__name__):
                opener = mock.Mock()
                opener.open.side_effect = error
                stderr = io.StringIO()
                with mock.patch.object(prepare.urllib.request, 'build_opener', return_value=opener), \
                        mock.patch.object(prepare.sys, 'stderr', stderr):
                    self.assertIsNone(prepare.load_base(PROJECT, site_url='https://example.test'))
                self.assertIn('sending full release', stderr.getvalue())
                self.assertNotIn('PRIVATE', stderr.getvalue())
        self.assertTrue(body.closed)

    def test_redirect_to_plain_http_is_rejected_before_following(self):
        handler = prepare.HTTPSOnlyRedirects()
        with self.assertRaises(prepare.BaseManifestError):
            handler.redirect_request(urllib.request.Request('https://example.test'), None,
                                     302, 'Found', {}, 'http://example.test/deployment.json')


if __name__ == "__main__":
    unittest.main()
