---
name: chinese-encoding-guard
description: Diagnose and prevent Chinese mojibake in this repository. Use this skill when HTML, JS, CSS, JSON, or Markdown files show garbled Chinese text such as `浠〃鐩?`, especially before editing or after pulling files from Git.
---

# Chinese Encoding Guard

## Overview

Use this skill when project files appear to contain garbled Chinese text. It helps distinguish three cases quickly:

1. The Git content is correct, but the current reader/editor is decoding it wrong.
2. The file on disk is encoded correctly, but terminal output is misleading.
3. The file content itself is already corrupted and must be restored before editing.

## Workflow

### 1. Verify Git content first

Run `git show HEAD:path/to/file` on the suspect file.

- If `git show` displays normal Chinese, the repository content is fine.
- If `git show` is already garbled, the corruption exists in Git history or the current checkout source.

### 2. Verify raw file bytes

Inspect the local file bytes with `Format-Hex`.

- UTF-8 Chinese should appear as multi-byte sequences such as `E4 BB AA E8 A1 A8 E7 9B 98` for `仪表盘`.
- If bytes are valid UTF-8 but the terminal shows mojibake, treat it as a display-layer problem.

### 3. Verify the reader path

Check whether the tool reading the file is forcing the wrong encoding.

- In PowerShell, prefer explicit UTF-8 reads when validating text.
- In editors/IDEs, reopen the file with UTF-8 or reload the tab/window after checkout.
- Do not trust one broken viewer as proof that the file itself is corrupted.

### 4. Restore before editing

If the file content on disk is actually corrupted:

- Restore from Git first with `git checkout -- path` or reset the repo to the target commit if the user explicitly wants a full overwrite.
- Only edit after the clean version is restored.
- Avoid mixing encoding recovery with feature edits in the same step.

### 5. Guardrails for future edits

- Prefer UTF-8 when writing files.
- After any bulk replace or scripted rewrite, re-check one Chinese string with `git diff` and a hex/UTF-8 read.
- If terminal output and `git show` disagree, assume the terminal may be lying until bytes are checked.

## Repository Note

For this project, the dashboard page was re-synced from `origin/main`, and `git show` plus raw byte inspection confirmed that the repository copy is normal UTF-8. The visible mojibake was caused by decoding/display, not by a failed GitHub download.