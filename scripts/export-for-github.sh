#!/usr/bin/env bash
# Builds a Lovable-ready export of the web app and chunked push_files payloads
# for the GitHub connector (rork connect call github push_files).
#
# Outputs:
#   journeys-for-lovable.zip          — full app incl. binary/large files (zip at repo root layout)
#   $TMPDIR/gh-chunk-*.json           — args files for push_files (branch: main, root layout)
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE="${TMPDIR:-/tmp}/gh-export"
rm -rf "$STAGE"; mkdir -p "$STAGE"

# Web app -> repo root (Lovable-ready layout)
cp -r web/src "$STAGE/src"
mkdir -p "$STAGE/public"
cp web/public/robots.txt web/public/placeholder.svg "$STAGE/public/"
cp web/index.html web/package.json web/bun.lock web/components.json \
   web/tailwind.config.ts web/postcss.config.js web/tsconfig.json \
   web/tsconfig.app.json web/tsconfig.node.json web/vite.config.ts \
   web/eslint.config.js web/vitest.config.ts web/vitest.browser.config.ts \
   web/.gitignore "$STAGE/"
# Supabase setup files for reference
mkdir -p "$STAGE/supabase/migrations"
cp backend/migrations/*.sql "$STAGE/supabase/migrations/"

# Fresh README + the list of old files to delete in Lovable (one cleanup prompt)
find travel-planner-home -path '*/node_modules' -prune -o -path '*/.git*' -prune -o -type f -print 2>/dev/null \
  | sed 's|^travel-planner-home/||' | sort > /tmp/old-files.txt
find "$STAGE" -type f | sed "s|$STAGE/||" | sort > /tmp/new-files.txt
comm -23 /tmp/old-files.txt /tmp/new-files.txt > /tmp/stale-files.txt
{
  echo '# Old files to delete'
  echo
  echo 'These are leftovers from the previous version of this app. They are no longer used and can all be deleted.'
  echo
  while read -r f; do echo "- $f"; done < /tmp/stale-files.txt
} > "$STAGE/DELETED-FILES.md"
cat > "$STAGE/README.md" <<'EOF'
# Journeys — Road trip stop planner

Plan road trips: pick a start and end point, find towns along the drive, and build day-by-day plans with stays, food and activities. Live hotel prices on the map, document storage for confirmations and tickets, and saved trips.

Built with React, Vite, Tailwind and Supabase (auth + database + file storage).

## Develop

```bash
bun install
bun run dev
```

## Environment

Set these in your hosting provider's app settings (not in files):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable (anon) key
- `VITE_STAY22_AID` — Stay22 affiliate ID (live hotel price map)

Database and storage setup live in `supabase/migrations/`.
EOF

# Chunked args JSON for push_files (text files only)
python3 - "$STAGE" <<'PY'
import json, os, sys
stage = sys.argv[1]
files = []
for root, dirs, names in os.walk(stage):
    for n in sorted(names):
        p = os.path.join(root, n)
        rel = os.path.relpath(p, stage)
        files.append({"path": rel, "content": open(p, encoding="utf-8").read()})
groups = [
    ("src/lib, integrations, hooks", lambda r: r[0] in ("src",) and (r[1] in {"lib","integrations","hooks","context"} if len(r)>1 else False) or r == ("src",)),
    ("components", lambda r: len(r)>1 and r[0]=="src" and r[1]=="components"),
    ("pages, app entry, configs, migrations", lambda r: True),
]
assigned = [False]*len(files)
def take(pred):
    got = []
    for i, f in enumerate(files):
        rel = f["path"]
        parts = rel.split("/")
        if not assigned[i] and pred(parts):
            got.append(f); assigned[i] = True
    return got
def in_group(parts, dirs):
    return parts[0]=="src" and len(parts)>1 and parts[1] in dirs
chunks = [
    take(lambda p: p==["src"] or in_group(p, {"lib","integrations","hooks","context"})),
    take(lambda p: in_group(p, {"components"})),
    take(lambda p: True),
]
msgs = [
    "Replace app source with the Rork version: libs, integrations, hooks",
    "Replace app source with the Rork version: components",
    "Replace app source with the Rork version: pages, entry, configs, db setup",
]
for i, (chunk, msg) in enumerate(zip(chunks, msgs), 1):
    args = {"owner":"sqwadam","repo":"travel-planner-home","branch":"main","message":msg,"files":chunk}
    out = f"{os.environ.get('TMPDIR','/tmp')}/gh-chunk-{i}.json"
    with open(out,"w") as fh: json.dump(args, fh)
    kb = os.path.getsize(out)//1024
    print(f"chunk {i}: {len(chunk)} files, args {kb} KB -> {out}")
    for f in chunk:
        if f["path"].endswith((".png",".jpg",".ico",".woff",".woff2")) or os.path.getsize(os.path.join(stage,f["path"])) > 1_500_000:
            print("  !! TOO BIG/BINARY — remove from chunk:", f["path"]); sys.exit(1)
leftover = [f["path"] for i,f in enumerate(files) if not assigned[i]]
if leftover: print("UNASSIGNED:", leftover); sys.exit(1)
PY

# Add binary/large files the connector can't carry; user uploads these via GitHub web
cp web/public/towns-data.json web/public/icon.png web/public/favicon.png "$STAGE/public/"
rm -f journeys-for-lovable.zip
python3 - "$STAGE" <<'PY'
import os, sys, zipfile
stage = sys.argv[1]
with zipfile.ZipFile("journeys-for-lovable.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, names in os.walk(stage):
        for n in sorted(names):
            p = os.path.join(root, n)
            z.write(p, os.path.relpath(p, stage))
PY
echo "zip:"; du -h journeys-for-lovable.zip
