# ⚠️ DEV WARNINGS — READ BEFORE EDITING FILES IN THIS REPO

## 1. DO NOT use the Edit / Write tools on files in this folder. They TRUNCATE.

When editing files under `Inventory Management Application/` (this mounted folder),
the `Edit` and `Write` tools **silently truncate the file mid-content**. The tool
reports success, but the file on disk is cut off — usually partway through a later
function — which breaks the build with errors like:

```
ERROR: Unexpected end of file
ERROR: Expected identifier but found end of file
```

This has happened **repeatedly** (notably on `client/src/api/client.ts`, a ~1000-line
file). It is NOT a code bug — it is a write-layer problem with this specific mounted
folder. The larger the file, the more likely it truncates.

### ✅ The safe pattern — write via Python in `mcp__workspace__bash`

Edit and write files by running a Python script that reads/replaces/writes the full
content to the VM mount path. Example:

```bash
cd "/sessions/<session>/mnt/Inventory Management Application"
python3 - <<'PYEOF'
f = 'client/src/api/client.ts'
s = open(f).read()
s = s.replace(OLD, NEW)          # do your edits in-memory
open(f, 'w').write(s)            # single atomic write of the WHOLE file
print("braces", s.count('{'), s.count('}'), "lines", s.count(chr(10))+1)
PYEOF
```

### ✅ ALWAYS verify after every write
1. Check brace/paren balance in the Python output (`{` count == `}` count).
2. Check the last line is what you expect (e.g. `};` for `client.ts`, not a dangling
   comment or half-statement).
3. Run a build:
   ```bash
   npx vite build --config client/vite.config.ts --outDir /tmp/check --emptyOutDir 2>&1 | grep -aiE "error|built|✓"
   ```
   `✓ NNNN modules transformed` + `✓ built` = good. Any "Unexpected end of file" =
   the file truncated; re-append the missing tail via Python and rebuild.

### If a file IS already truncated
Read the tail (`tail -15 <file>`), find the cut point, and re-append the missing
remainder via Python (cut back to a clean boundary first, then append the full rest).
This was done twice on `client.ts` — the `releaseToPicking` method + closing `};`
were the part that kept getting cut.

---

## 2. Other standing gotchas
- **`.git/index.lock`** sometimes lingers and blocks commits. Delete it:
  `del "...\Inventory Management Application\.git\index.lock"` (Windows side).
- **Vite `envDir`**: `.env` lives at project root, not in `client/`. `vite.config.ts`
  has `envDir: ".."` — keep it.
- **Vite temp files** `client/vite.config.ts.timestamp-*.mjs` are git-ignored; don't commit them.
- **Supabase grants are broad dev-time grants** (anon can read/write inventory tables).
  Tighten to per-role RLS before production.
