import { expect, it } from "vitest";
import { normalizeSchema } from "../../scripts/ci/backup/normalize-schema.mjs";

const header =
  "--\n-- Name: TABLE pack_settings_changes; Type: ACL; Schema: kut; Owner: postgres\n--\n\n";
const grants = ["authenticated", "service_role", "kut_backup"].map(
  (role) => `GRANT SELECT ON TABLE kut.pack_settings_changes TO ${role};`,
);
const schema = (statements: string[]) => `${header}${statements.join("\n")}\n\n`;

it("accepts the reordered grants from the production restore failure", () => {
  expect(normalizeSchema(schema(grants))).toBe(
    normalizeSchema(schema([grants[2], grants[0], grants[1]])),
  );
});

it("still detects missing grants, changed privileges, recipients and grant options", () => {
  for (const changed of [
    grants.slice(1),
    [...grants, "GRANT UPDATE ON TABLE kut.pack_settings_changes TO authenticated;"],
    grants.map((line) => line.replace("SELECT", "UPDATE")),
    grants.map((line) => line.replace("kut_backup", "PUBLIC")),
    grants.map((line) => line.replace(";", " WITH GRANT OPTION;")),
  ]) {
    expect(normalizeSchema(schema(changed))).not.toBe(normalizeSchema(schema(grants)));
  }
});

it("preserves revoke ordering and grants inside function bodies", () => {
  const revoke = "REVOKE SELECT ON TABLE kut.pack_settings_changes FROM authenticated;";
  expect(normalizeSchema(schema([grants[0], revoke]))).not.toBe(
    normalizeSchema(schema([revoke, grants[0]])),
  );
  const functionBody = `-- Name: example(); Type: FUNCTION; Schema: kut; Owner: postgres\nCREATE FUNCTION kut.example() RETURNS void AS $$\n${grants.join("\n")}\n$$ LANGUAGE plpgsql;\n`;
  expect(normalizeSchema(functionBody)).toBe(functionBody);
});

it("removes random pg_dump restrict keys while preserving schema changes", () => {
  const ddl = "CREATE TABLE kut.example (id integer);\n";
  expect(normalizeSchema(`\\restrict first\n${ddl}\\unrestrict first\n`)).toBe(ddl);
  expect(normalizeSchema(ddl.replace("integer", "text"))).not.toBe(normalizeSchema(ddl));
});
