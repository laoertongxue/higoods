import os

# Debug: find where files actually are
print("[v0] cwd:", os.getcwd())
print("[v0] checking path:", os.path.exists('/vercel/share/v0-project/components/fcs/progress/progress-board-page.tsx'))

# List the project root to find actual location
for root, dirs, files in os.walk('/vercel'):
    for f in files:
        if f == 'progress-board-page.tsx':
            print("[v0] found at:", os.path.join(root, f))
    # Don't recurse too deep
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.next']]
