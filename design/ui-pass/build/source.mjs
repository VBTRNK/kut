// Loads real FLUT modules from the kut checkout for design-only rendering:
// TypeScript is transpiled in memory and "@/..." imports resolve into src/.
// Next's router pieces are stubbed so the real components render statically.
// Restored from design/midweek/build/source.mjs (tag docs-archive-2026-10).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const here = path.dirname(fileURLToPath(import.meta.url));
/** The kut checkout this folder sits in (design/ui-pass/build). */
export const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
export const React = require("react");
export const { renderToStaticMarkup } = require("react-dom/server");

const STUBS = {
  "next/link": {
    __esModule: true,
    // Next-only props are dropped so React renders a plain <a>.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: ({ href, children, prefetch, scroll, replace, ...rest }) =>
      React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children),
  },
  "next/navigation": {
    usePathname: () => globalThis.__mockPath ?? "/midweek",
    useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
    notFound: () => {
      throw new Error("notFound");
    },
  },
  "@/app/(app)/midweek/actions": { saveMidweekCall: async () => ({ ok: true }) },
};

const cache = new Map();

export function sourceModule(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const compiled = { exports: {} };
  cache.set(filename, compiled.exports);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const localRequire = (name) => {
    if (STUBS[name]) return STUBS[name];
    const local = name.startsWith("@/") || name.startsWith(".");
    if (!local) return require(name);
    const base = name.startsWith("@/")
      ? path.join(root, "src", name.slice(2))
      : path.resolve(path.dirname(filename), name);
    const target = [".tsx", ".ts", "/index.ts", "/index.tsx", ""]
      .map((ext) => base + ext)
      .find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!target) throw new Error(`Missing design source ${name} (from ${filename})`);
    if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
    return sourceModule(target);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    localRequire,
    compiled,
    compiled.exports,
  );
  cache.set(filename, compiled.exports);
  return compiled.exports;
}

/** A module from kut's src/. */
export const src = (rel) => sourceModule(path.join(root, "src", rel));
/** A module from kut's tests/ (the sample world). */
export const tests = (rel) => sourceModule(path.join(root, "tests", rel));
/** A design-only module beside this file (the MM3 mock components). */
export const mock = (rel) => sourceModule(path.join(here, rel));
export const html = (element) => renderToStaticMarkup(element);
export const h = React.createElement;
