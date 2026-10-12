// Compiles the app's real src/app/globals.css with Tailwind v4, scanning kut's
// src/ and the DR5 design components here, so every class a mock uses is the
// app's own utility with the app's tokens. DR5 adds the proposed type scale
// (TOKENS below), which S4 moves into globals.css as it stands here.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { here, root } from "./source.mjs";

const require = createRequire(path.join(root, "package.json"));
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");

/**
 * The DR5 type scale: six roles, each a Tailwind text utility with its own
 * line height (`text-title`, `text-figure`, ...). Title steps up to 40 px from
 * `sm` as `sm:text-title-lg`; it is the same role.
 */
export const TOKENS = `
@theme {
  --text-title: 2rem;
  --text-title--line-height: 1.1;
  --text-title-lg: 2.5rem;
  --text-title-lg--line-height: 1.05;
  --text-figure: 2.5rem;
  --text-figure--line-height: 1;
  --text-heading: 1.25rem;
  --text-heading--line-height: 1.3;
  --text-body: 1rem;
  --text-body--line-height: 1.5;
  --text-small: 0.875rem;
  --text-small--line-height: 1.45;
  --text-label: 0.75rem;
  --text-label--line-height: 1.35;
}
`;

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
    ) + TOKENS;
  const result = await postcss([tailwind({ optimize: { minify: true } })]).process(input, {
    from: path.join(root, "src/app/dr5-design.css"),
  });
  return result.css;
}
