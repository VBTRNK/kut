import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function normalizeSchema(schema) {
  const output = [];
  let grants = [];
  let acl = false;
  for (const line of schema.split("\n")) {
    if (line.startsWith("-- Name: ")) acl = line.includes("; Type: ACL;");
    // pg_dump can emit equivalent ACL grants in different role orders.
    if (acl && /^GRANT .*;$/.test(line)) {
      grants.push(line);
      continue;
    }
    output.push(...grants.sort());
    grants = [];
    if (!/^\\(?:un)?restrict /.test(line)) output.push(line);
  }
  return [...output, ...grants.sort()].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(process.argv[3], normalizeSchema(readFileSync(process.argv[2], "utf8")));
}
