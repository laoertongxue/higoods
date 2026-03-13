import sys

file_path = '/home/user/components/fcs/progress/progress-board-page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"[v0] Total lines before: {len(lines)}")

# Find the second occurrence of "export function ProgressBoardPage"
marker = "export function ProgressBoardPage"
occurrences = [i for i, line in enumerate(lines) if marker in line]
print(f"[v0] Found '{marker}' at lines: {[o+1 for o in occurrences]}")

if len(occurrences) >= 2:
    # Cut off everything from the line before the second occurrence
    # Go back a few lines to remove blank/stale lines before the duplicate
    cut_at = occurrences[1]
    # Walk back to also remove blank lines before the duplicate declaration
    while cut_at > 0 and lines[cut_at - 1].strip() == '':
        cut_at -= 1
    print(f"[v0] Cutting at line: {cut_at + 1}")
    truncated = lines[:cut_at]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(truncated)
    print(f"[v0] Total lines after: {len(truncated)}")
    print(f"[v0] Last 3 lines: {repr(''.join(truncated[-3:]))}")
else:
    print("[v0] Only one occurrence found, no truncation needed")
    print(f"[v0] All occurrences: {occurrences}")
