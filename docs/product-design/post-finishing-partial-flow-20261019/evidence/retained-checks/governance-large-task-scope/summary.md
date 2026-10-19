# Governance buffer and command-scope repair

Only four existing files changed. Product/build/browser/performance and full governance suite remain root-owned.

- Real red: 6906 paths, 6838 docs, 1188589-byte Git output, ENOBUFS; longest original governance command 1191853 bytes.
- New targeted red: 0/3 passed, all intended failures.
- Full two-file green: 63/63 passed, 2.494 seconds.
- Real green: all 6916 current paths and 6847 docs equal raw Git output; every frozen red path retained; both scoped gates use full worktree and the frozen base, excluded paths 0, max command 61 bytes.
- Existing governance-scope buffer was already 16 MiB. Short exact paths and comma rejection remain covered.
- First strict replay failed only because 10 new root-owned paths appeared; original context log retained.

See manifest.json for source/artifact hashes and exact logs.
