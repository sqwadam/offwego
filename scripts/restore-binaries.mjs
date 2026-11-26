#!/usr/bin/env node
// Decodes the .b64 files back into the real binary assets
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
const map = [["assets/generated/icon.png.b64","assets/generated/icon.png"],["web/public/favicon.png.b64","web/public/favicon.png"],["web/public/icon.png.b64","web/public/icon.png"]];
for (const [from, to] of map) {
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, Buffer.from(readFileSync(from, "utf8"), "base64"));
  console.log("restored", to);
}
