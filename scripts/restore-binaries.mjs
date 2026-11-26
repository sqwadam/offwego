#!/usr/bin/env node
// Decodes the .b64 files back into the real binary assets.
// Run: node scripts/restore-binaries.mjs
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
const map = [["assets/generated/icon.png.b64","assets/generated/icon.png",false],["web/public/favicon.png.b64","web/public/favicon.png",false],["web/public/icon.png.b64","web/public/icon.png",false],["web/public/towns-data.json.gz.b64","web/public/towns-data.json",true]];
for (const [from, to, gunzip] of map) {
  mkdirSync(dirname(to), { recursive: true });
  const raw = Buffer.from(readFileSync(from, "utf8"), "base64");
  if (gunzip) {
    const { gunzipSync } = await import("zlib");
    writeFileSync(to, gunzipSync(raw));
  } else {
    writeFileSync(to, raw);
  }
  console.log("restored", to);
}
