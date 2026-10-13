"""Isolated publication contracts; no network outside a loopback HTTP server.

Run with: python3 -m unittest discover -s tests/deploy -v
"""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import io
import json
import mimetypes
import sys
import tarfile
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "higoods_deployment_receiver", REPO_ROOT / "scripts/deploy/receiver.py"
)
assert SPEC is not None and SPEC.loader is not None
receiver = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = receiver
SPEC.loader.exec_module(receiver)
DeploymentError = receiver.DeploymentError

PROJECT = "higoods"
SHA_A = "a" * 40
SHA_B = "b" * 40
SHA_C = "c" * 40


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def files_for(label: str) -> dict[str, bytes]:
    return {
        "index.html": (
            '<!doctype html><html><head>'
            f'<link rel="stylesheet" href="/assets/{label}.css">'
            '</head><body>'
            f'<main>Release {label}</main>'
            f'<script type="module" src="/assets/{label}.js"></script>'
            '</body></html>'
        ).encode(),
        f"assets/{label}.js": f"console.log('{label}');\n".encode(),
        f"assets/{label}.css": b"body { color: #111; }\n",
    }


def manifest_for(
    files: dict[str, bytes], sha: str = SHA_A, run_id: int = 100,
    project: str = PROJECT,
) -> dict:
    return {
        "schema": 1,
        "project": project,
        "sha": sha,
        "run_id": run_id,
        "built_at": "2026-10-13T12:00:00Z",
        "files": {path: sha256(content) for path, content in files.items()},
        "entrypoints": [
            f"/{path}" for path in files if path.endswith((".js", ".css"))
        ],
    }


def archive_for(
    files: dict[str, bytes], manifest: dict | None = None,
    extra_members: list[tuple[tarfile.TarInfo, bytes | None]] | None = None,
) -> io.BytesIO:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        contents = {
            "deployment.json": json.dumps(manifest or manifest_for(files)).encode(),
            **files,
        }
        for path, content in contents.items():
            info = tarfile.TarInfo(path)
            info.size = len(content)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(content))
        for info, content in extra_members or []:
            archive.addfile(info, None if content is None else io.BytesIO(content))
    output.seek(0)
    return output


class InterruptedUpload(io.BytesIO):
    """Fail after gzip has begun reading, like an SSH upload dropping midway."""

    def __init__(self, content: bytes):
        super().__init__(content)
        self.reads = 0

    def read(self, size: int = -1) -> bytes:
        self.reads += 1
        if self.reads > 2:
            raise OSError("simulated interrupted upload")
        return super().read(min(size, 32) if size >= 0 else 32)


class LocalSite:
    """Minimal observable site behavior used by receiver's real HTTP probes."""

    def __init__(self, root: Path):
        self.root = root
        self.fail = False
        self.responses: dict[str, tuple[int, bytes, str]] = {}
        self.compress = False
        self.gzip_paths: set[str] = set()
        self.gate_entered: threading.Event | None = None
        self.gate_release: threading.Event | None = None
        self.gate_used = False
        site = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if site.gate_entered is not None and not site.gate_used:
                    site.gate_used = True
                    site.gate_entered.set()
                    assert site.gate_release is not None
                    site.gate_release.wait(10)
                if site.fail:
                    self.reply(503, b"simulated unhealthy release", "text/plain")
                    return
                path = unquote(urlsplit(self.path).path).lstrip("/")
                if path in site.responses:
                    self.reply(*site.responses[path])
                    return
                if ".." in Path(path).parts:
                    self.reply(404, b"not found", "text/plain")
                    return
                current = site.root / "current"
                if not current.is_dir():
                    self.reply(404, b"no release", "text/plain")
                    return
                file = current / (path or "index.html")
                if not file.is_file() and path.startswith("assets/"):
                    file = site.root / "previous" / path
                if not file.is_file() and not path.startswith("assets/"):
                    if Path(path).suffix:
                        self.reply(404, b"not found", "text/plain")
                        return
                    file = current / "index.html"
                if not file.is_file():
                    self.reply(404, b"not found", "text/plain")
                    return
                mime = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
                self.reply(200, file.read_bytes(), mime)

            def do_HEAD(self):
                self.do_GET()

            def reply(self, status: int, content: bytes, mime: str):
                encoded = (site.compress and status == 200
                           and "gzip" in self.headers.get("Accept-Encoding", ""))
                if encoded:
                    content = gzip.compress(content)
                    site.gzip_paths.add(urlsplit(self.path).path)
                self.send_response(status)
                self.send_header("Content-Type", mime)
                if encoded:
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Vary", "Accept-Encoding")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(content)

            def log_message(self, *_args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(
            target=lambda: self.server.serve_forever(poll_interval=0.05), daemon=True
        )
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def close(self):
        if self.gate_release is not None:
            self.gate_release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)


class ReceiverContracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="higoods-deploy-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "site"
        self.root.mkdir()
        self.site = LocalSite(self.root)
        self.addCleanup(self.site.close)
        self.files_a = files_for("a")
        self.files_b = files_for("b")

    def publish(
        self, files: dict[str, bytes] | None = None, sha: str = SHA_A,
        run_id: int = 100, archive: io.BytesIO | None = None,
        project: str = PROJECT,
    ) -> dict:
        chosen_files = self.files_a if files is None else files
        if archive is None:
            archive = archive_for(
                chosen_files, manifest_for(chosen_files, sha, run_id, project)
            )
        return receiver.deploy(
            root=self.root,
            project=project,
            sha=sha,
            run_id=run_id,
            archive=archive,
            health_url=self.site.url,
            probes=["/pcs/products/styles", "/fcs/craft/dyeing/work-orders"],
        )

    def assert_release(self, name: str, sha: str, files: dict[str, bytes]):
        link = self.root / name
        self.assertTrue(link.is_symlink(), f"{name} must point to a release")
        actual_manifest = json.loads((link / "deployment.json").read_text())
        self.assertEqual(actual_manifest["sha"], sha)
        for path, content in files.items():
            self.assertEqual((link / path).read_bytes(), content)

    def snapshot(self) -> dict:
        result = {}
        for name in ("current", "previous"):
            link = self.root / name
            result[name] = (
                (str(link.readlink()), (link / "deployment.json").read_bytes(),
                 (link / "index.html").read_bytes())
                if link.is_symlink() else None
            )
        return result

    def assert_rejected_without_switch(self, archive: io.BytesIO, **kwargs):
        before = self.snapshot()
        with self.assertRaises(DeploymentError):
            self.publish(archive=archive, **kwargs)
        self.assertEqual(self.snapshot(), before)

    def test_normal_publications_switch_current_and_keep_previous(self):
        self.assertEqual(self.publish()["status"], "deployed")
        self.assert_release("current", SHA_A, self.files_a)
        self.assertFalse((self.root / "previous").exists())
        self.assertEqual(self.publish(self.files_b, SHA_B, 101)["status"], "deployed")
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)

    def test_published_files_are_readable_by_an_unrelated_web_service_user(self):
        # Caddy has neither the publisher UID nor its group: inspect the POSIX
        # "other" bits instead of os.access(), which would test this process UID.
        self.root.chmod(0o755)
        self.publish()

        def assert_web_readable():
            release = (self.root / "current").resolve()
            site_root = self.root.resolve()
            directories = [site_root, release.parent, release]
            directories.extend(path for path in release.rglob("*") if path.is_dir())
            for directory in directories:
                with self.subTest(directory=directory.relative_to(site_root)):
                    self.assertTrue(directory.stat().st_mode & 0o001,
                                    "independent Web service requires directory traversal")
            manifest = json.loads((release / "deployment.json").read_text())
            for name in ["deployment.json", "index.html", *[
                path.lstrip("/") for path in manifest["entrypoints"]
            ]]:
                with self.subTest(file=name):
                    self.assertTrue((release / name).stat().st_mode & 0o004,
                                    "independent Web service requires file read permission")

        assert_web_readable()
        # A retry also repairs a retained release directory from the original
        # mkdtemp 0700 behavior before checking or serving the release again.
        (self.root / "current").resolve().chmod(0o700)
        self.assertEqual(self.publish()["status"], "unchanged")
        assert_web_readable()

    def test_old_higoods_uses_the_same_publication_contract(self):
        result = self.publish(project="old-higoods")
        self.assertEqual(result["status"], "deployed")
        manifest = json.loads((self.root / "current/deployment.json").read_text())
        self.assertEqual(manifest["project"], "old-higoods")

    def test_health_failure_restores_both_current_and_previous(self):
        self.publish()
        self.publish(self.files_b, SHA_B, 101)
        before = self.snapshot()
        self.site.fail = True
        with self.assertRaises(DeploymentError):
            self.publish(files_for("c"), SHA_C, 102)
        self.assertEqual(self.snapshot(), before)

    def test_first_health_failure_leaves_no_published_site(self):
        self.site.fail = True
        with self.assertRaises(DeploymentError):
            self.publish()
        self.assertFalse((self.root / "current").is_symlink())
        self.assertFalse((self.root / "current").exists())
        self.assertFalse((self.root / "previous").is_symlink())

    def test_success_status_with_stale_or_broken_content_rolls_back(self):
        self.publish()
        before = self.snapshot()
        cases = {
            "stale-manifest": {
                "deployment.json": (200, json.dumps(manifest_for(self.files_a)).encode(),
                                    "application/json"),
            },
            "stale-homepage": {
                "": (200, self.files_a["index.html"], "text/html"),
                "index.html": (200, self.files_a["index.html"], "text/html"),
            },
            "broken-deep-route": {
                "pcs/products/styles": (200, b"wrong route", "text/html"),
            },
            "missing-entrypoint": {
                "assets/b.js": (404, b"not found", "text/plain"),
            },
            "stale-entrypoint": {
                "assets/b.js": (200, b"console.log('stale');", "text/javascript"),
            },
            "missing-resource-returns-html": {
                f"__deploy_missing__{SHA_B}.js": (200, self.files_b["index.html"],
                                                   "text/html"),
            },
        }
        for name, responses in cases.items():
            with self.subTest(name=name):
                self.site.responses = responses
                with self.assertRaises(DeploymentError):
                    self.publish(self.files_b, SHA_B, 101)
                self.assertEqual(self.snapshot(), before)
        self.site.responses = {}

    def test_gzip_health_responses_publish_the_expected_application(self):
        self.site.compress = True
        self.assertEqual(self.publish()["status"], "deployed")
        self.assertEqual(self.publish(self.files_b, SHA_B, 101)["status"], "deployed")
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)
        expected_paths = {
            "/deployment.json", "/", "/pcs/products/styles",
            "/fcs/craft/dyeing/work-orders", "/assets/b.js", "/assets/b.css",
        }
        self.assertTrue(expected_paths.issubset(self.site.gzip_paths),
                        "manifest, pages and entry resources were all served compressed")

    def test_gzip_with_wrong_content_rejects_release_and_preserves_previous(self):
        self.publish()
        before = self.snapshot()
        self.site.compress = True
        cases = {
            "manifest": ("deployment.json", json.dumps(manifest_for(self.files_a)).encode(),
                         "application/json"),
            "homepage": ("", self.files_a["index.html"], "text/html"),
            "entrypoint": ("assets/b.js", b"console.log('wrong compressed resource');",
                           "text/javascript"),
        }
        for name, (path, body, mime) in cases.items():
            with self.subTest(name=name):
                self.site.responses = {path: (200, body, mime)}
                self.site.gzip_paths.clear()
                with self.assertRaises(DeploymentError):
                    self.publish(self.files_b, SHA_B, 101)
                self.assertIn("/" + path, self.site.gzip_paths,
                              "the incorrect content actually used gzip transport")
                self.assertEqual(self.snapshot(), before)
        self.site.responses = {}

    def test_missing_extra_and_tampered_files_are_rejected(self):
        self.publish()
        manifest = manifest_for(self.files_b, SHA_B, 101)
        cases = {
            "missing": {path: data for path, data in self.files_b.items()
                        if not path.endswith(".css")},
            "extra": {**self.files_b, "unexpected.txt": b"unlisted"},
            "tampered": {**self.files_b, "assets/b.js": b"changed bytes"},
        }
        for name, files in cases.items():
            with self.subTest(name=name):
                self.assert_rejected_without_switch(
                    archive_for(files, manifest), sha=SHA_B, run_id=101
                )

    def test_manifest_identity_must_match_deployment_request(self):
        self.publish()
        cases = {
            "project": {"project": "old-higoods"},
            "sha": {"sha": SHA_C},
            "run_id": {"run_id": 999},
            "schema": {"schema": 999},
        }
        for name, overrides in cases.items():
            with self.subTest(name=name):
                manifest = {**manifest_for(self.files_b, SHA_B, 101), **overrides}
                self.assert_rejected_without_switch(
                    archive_for(self.files_b, manifest), sha=SHA_B, run_id=101
                )

    def test_invalid_request_identity_is_rejected_without_switch(self):
        self.publish()
        for args in (
            {"project": "../another-site"},
            {"sha": "not-a-full-commit-sha"},
            {"run_id": -1},
        ):
            with self.subTest(args=args):
                before = self.snapshot()
                request = {"files": self.files_b, "sha": SHA_B, "run_id": 101,
                           "project": PROJECT, **args}
                with self.assertRaises(DeploymentError):
                    self.publish(**request)
                self.assertEqual(self.snapshot(), before)

    def test_archive_paths_cannot_escape_release_directory(self):
        self.publish()
        absolute_target = self.root.parent / "absolute.txt"
        for path in ("../outside.txt", str(absolute_target), "assets/../../outside.txt"):
            with self.subTest(path=path):
                files = {**self.files_b, path: b"escape"}
                self.assert_rejected_without_switch(
                    archive_for(files, manifest_for(files, SHA_B, 101)),
                    sha=SHA_B, run_id=101,
                )
        self.assertFalse((self.root.parent / "outside.txt").exists())
        self.assertFalse(absolute_target.exists())

    def test_archive_links_and_special_members_are_rejected(self):
        self.publish()
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE,
                     tarfile.CHRTYPE, tarfile.BLKTYPE):
            with self.subTest(kind=kind):
                info = tarfile.TarInfo("assets/special")
                info.type = kind
                info.linkname = "index.html"
                manifest = manifest_for(self.files_b, SHA_B, 101)
                manifest["files"][info.name] = sha256(b"")
                self.assert_rejected_without_switch(
                    archive_for(self.files_b, manifest, [(info, None)]),
                    sha=SHA_B, run_id=101,
                )

    def test_duplicate_archive_paths_are_rejected(self):
        self.publish()
        duplicate = tarfile.TarInfo("index.html")
        duplicate.size = len(self.files_b["index.html"])
        self.assert_rejected_without_switch(
            archive_for(self.files_b, manifest_for(self.files_b, SHA_B, 101),
                        [(duplicate, self.files_b["index.html"])]),
            sha=SHA_B, run_id=101,
        )

    def test_bad_gzip_truncation_and_upload_interruption_keep_current(self):
        self.publish()
        good = archive_for(self.files_b, manifest_for(self.files_b, SHA_B, 101)).getvalue()
        cases = {
            "not-gzip": io.BytesIO(b"this is not an archive"),
            "truncated": io.BytesIO(good[:len(good) // 2]),
            "interrupted": InterruptedUpload(good),
        }
        for name, archive in cases.items():
            with self.subTest(name=name):
                self.assert_rejected_without_switch(archive, sha=SHA_B, run_id=101)

    def test_older_run_cannot_replace_newer_release(self):
        self.publish(run_id=200)
        self.assert_rejected_without_switch(
            archive_for(self.files_b, manifest_for(self.files_b, SHA_B, 199)),
            sha=SHA_B, run_id=199,
        )

    def test_identical_retry_is_unchanged_and_does_not_move_previous(self):
        self.publish()
        self.publish(self.files_b, SHA_B, 101)
        before = self.snapshot()
        self.assertEqual(self.publish(self.files_b, SHA_B, 101)["status"], "unchanged")
        self.assertEqual(self.snapshot(), before)

    def test_same_run_id_with_different_commit_is_rejected(self):
        self.publish()
        self.assert_rejected_without_switch(
            archive_for(self.files_b, manifest_for(self.files_b, SHA_B, 100)),
            sha=SHA_B, run_id=100,
        )

    def test_failed_run_can_retry_after_health_recovers(self):
        self.publish()
        self.site.fail = True
        with self.assertRaises(DeploymentError):
            self.publish(self.files_b, SHA_B, 101)
        self.site.fail = False
        self.assertEqual(self.publish(self.files_b, SHA_B, 101)["status"], "deployed")
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)

    def test_public_rollback_of_first_release_leaves_no_published_site(self):
        self.publish()
        result = receiver.rollback(
            self.root, PROJECT, SHA_A, 100, self.site.url,
            ["/pcs/products/styles"],
        )
        self.assertEqual(result["status"], "rolled-back")
        for name in ("current", "previous"):
            self.assertFalse((self.root / name).is_symlink())
            self.assertFalse((self.root / name).exists())

    def test_public_rollback_restores_current_and_previous_exactly(self):
        self.publish()
        self.publish(self.files_b, SHA_B, 101)
        before = self.snapshot()
        self.publish(files_for("c"), SHA_C, 102)
        result = receiver.rollback(
            self.root, PROJECT, SHA_C, 102, self.site.url,
            ["/pcs/products/styles"],
        )
        self.assertEqual(result["status"], "rolled-back")
        self.assertEqual(self.snapshot(), before)
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)

    def test_public_rollback_keeps_prior_files_after_multiple_failed_uploads(self):
        self.publish()
        self.publish(self.files_b, SHA_B, 101)
        before = self.snapshot()
        self.site.fail = True
        for run_id in range(102, 109):
            with self.subTest(failed_run=run_id):
                with self.assertRaises(DeploymentError):
                    self.publish(files_for(str(run_id)), f"{run_id:040x}", run_id)
                self.assertEqual(self.snapshot(), before)
        self.site.fail = False
        self.publish(files_for("c"), SHA_C, 109)
        result = receiver.rollback(
            self.root, PROJECT, SHA_C, 109, self.site.url,
            ["/pcs/products/styles"],
        )
        self.assertEqual(result["status"], "rolled-back")
        self.assertEqual(self.snapshot(), before)
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)

    def test_stale_public_rollback_cannot_replace_a_newer_publication(self):
        self.publish()
        self.publish(self.files_b, SHA_B, 101)
        self.publish(files_for("c"), SHA_C, 102)
        before = self.snapshot()
        for sha, run_id in ((SHA_B, 101), (SHA_B, 102), (SHA_C, 101)):
            with self.subTest(sha=sha, run_id=run_id):
                with self.assertRaises(DeploymentError):
                    receiver.rollback(
                        self.root, PROJECT, sha, run_id, self.site.url,
                        ["/pcs/products/styles"],
                    )
                self.assertEqual(self.snapshot(), before)

    def test_public_rollback_allows_republishing_the_same_run(self):
        self.publish()
        self.publish(self.files_b, SHA_B, 101)
        receiver.rollback(
            self.root, PROJECT, SHA_B, 101, self.site.url,
            ["/pcs/products/styles"],
        )
        self.assertEqual(self.publish(self.files_b, SHA_B, 101)["status"], "deployed")
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)

    def test_concurrent_old_run_cannot_interrupt_a_newer_release(self):
        self.publish()
        self.site.gate_entered = threading.Event()
        self.site.gate_release = threading.Event()
        older_started = threading.Event()
        older_done = threading.Event()
        outcomes = {}

        def newer():
            try:
                outcomes["newer"] = self.publish(self.files_b, SHA_B, 200)
            except Exception as error:
                outcomes["newer"] = error

        def older():
            older_started.set()
            try:
                outcomes["older"] = self.publish(files_for("c"), SHA_C, 199)
            except Exception as error:
                outcomes["older"] = error
            finally:
                older_done.set()

        newer_thread = threading.Thread(target=newer, daemon=True)
        older_thread = threading.Thread(target=older, daemon=True)
        newer_thread.start()
        self.assertTrue(self.site.gate_entered.wait(5), "new publication reached HTTP checks")
        older_thread.start()
        self.assertTrue(older_started.wait(2))
        try:
            self.assertFalse(older_done.wait(0.15), "old publication must await the site lock")
        finally:
            self.site.gate_release.set()
            newer_thread.join(10)
            older_thread.join(10)
        self.assertFalse(newer_thread.is_alive())
        self.assertFalse(older_thread.is_alive())
        self.assertIsInstance(outcomes.get("newer"), dict)
        self.assertEqual(outcomes["newer"]["status"], "deployed")
        self.assertIsInstance(outcomes.get("older"), DeploymentError)
        self.assert_release("current", SHA_B, self.files_b)
        self.assert_release("previous", SHA_A, self.files_a)

    def incremental_archive(self, target, uploaded=None, base=None):
        manifest = manifest_for(target, SHA_B, 101)
        manifest['base'] = base or {'sha': SHA_A, 'run_id': 100}
        if uploaded is None:
            uploaded = {k: v for k, v in target.items() if self.files_a.get(k) != v}
        return archive_for(uploaded, manifest)

    def test_incremental_reuses_verified_files_and_does_not_revive_removed_files(self):
        self.files_a['images/shared.jpg'] = b'original photo bytes'
        self.files_a['obsolete.json'] = b'old-only'
        self.publish()
        target = {**self.files_b, 'images/shared.jpg': b'original photo bytes', 'new.json': b'new'}
        self.publish(target, SHA_B, 101, self.incremental_archive(target))
        self.assert_release('current', SHA_B, target)
        self.assertFalse((self.root / 'current/obsolete.json').exists())
        self.assertFalse((self.root / 'current/assets/a.js').exists())
        self.assertEqual((self.root / 'current/images/shared.jpg').stat().st_ino,
                         (self.root / 'previous/images/shared.jpg').stat().st_ino)
        self.assert_release('previous', SHA_A, self.files_a)

    def test_incremental_changed_file_omission_keeps_active_release(self):
        self.publish()
        target = {**self.files_a, 'assets/a.js': b'changed'}
        with self.assertRaises(DeploymentError):
            self.publish(target, SHA_B, 101, self.incremental_archive(target, {}))
        self.assert_release('current', SHA_A, self.files_a)
        self.assertFalse((self.root / 'previous').exists())

    def test_incremental_corrupt_base_is_rejected_before_publication(self):
        self.publish()
        (self.root / 'current/assets/a.js').write_bytes(b'corrupt old bytes')
        before = receiver.link_target(self.root / 'current')
        with self.assertRaises(DeploymentError):
            self.publish(self.files_a, SHA_B, 101, self.incremental_archive(self.files_a, {}))
        self.assertEqual(receiver.link_target(self.root / 'current'), before)
        self.assertFalse((self.root / 'releases' / (SHA_B + '-101')).exists())

    def test_incremental_missing_base_keeps_active_release(self):
        self.publish()
        with self.assertRaises(DeploymentError):
            self.publish(self.files_b, SHA_B, 101,
                         self.incremental_archive(self.files_b, base={'sha': SHA_C, 'run_id': 99}))
        self.assert_release('current', SHA_A, self.files_a)

    def test_incremental_unsafe_base_identity_is_rejected(self):
        self.publish()
        for base in [{'sha': '../escape', 'run_id': 100}, {'sha': SHA_A, 'run_id': True},
                     {'sha': SHA_A, 'run_id': 0}]:
            with self.subTest(base=base), self.assertRaises(DeploymentError):
                self.publish(self.files_b, SHA_B, 101, self.incremental_archive(self.files_b, base=base))
        self.assert_release('current', SHA_A, self.files_a)

    def test_incremental_unsafe_target_path_is_rejected(self):
        self.publish()
        target = {**self.files_a, '../escape': b'new'}
        with self.assertRaises(DeploymentError):
            self.publish(target, SHA_B, 101, self.incremental_archive(target, {}))
        self.assert_release('current', SHA_A, self.files_a)
        self.assertFalse((self.root / 'escape').exists())

    def test_incremental_extra_uploaded_file_is_rejected(self):
        self.publish()
        archive = self.incremental_archive(self.files_a, {'unlisted.txt': b'extra'})
        with self.assertRaises(DeploymentError):
            self.publish(self.files_a, SHA_B, 101, archive)
        self.assert_release('current', SHA_A, self.files_a)

    def test_incremental_publication_health_failure_restores_both_pointers(self):
        self.publish()
        original_current = receiver.link_target(self.root / 'current')
        self.site.responses['assets/b.js'] = (200, b'wrong asset bytes', 'application/javascript')
        with self.assertRaises(DeploymentError):
            self.publish(self.files_b, SHA_B, 101, self.incremental_archive(self.files_b))
        self.assertEqual(receiver.link_target(self.root / 'current'), original_current)
        self.assertIsNone(receiver.link_target(self.root / 'previous'))


if __name__ == "__main__":
    unittest.main()
