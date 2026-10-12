// Compiles the app's real src/app/globals.css with Tailwind v4, scanning kut's
// src/ and the DR5 design components here, so every class a mock uses is the
// app's own utility with the app's tokens. The DR5 type scale (`text-title` …
// `text-label`) has lived in globals.css since S4 (ADR-153).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { here, root } from "./source.mjs";

const require = createRequire(path.join(root, "package.json"));
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");

export async function compileCss() {
  const globals = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const fwd = (p) => p.replace(/\\/g, "/");
  const input =
    globals.replace(
      '@import "tailwindcss";',
      [
        '@import "tailwindcss" source(none);',
        `@source "${fwd(path.join(root, "src"))}";`,
        `@source "${fwd(here)}/*.tsx";`,
      ].join("\n"),
    );
  const result = await postcss([tailwind({ optimize: { minify: true } })]).process(input, {
    from: path.join(root, "src/app/dr5-design.css"),
  });
  return result.css;
}
