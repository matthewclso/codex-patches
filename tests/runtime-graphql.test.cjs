"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditGraphql } = require("../tools/audit-graphql.cjs");
const archive = process.env.CODEX_PATCHES_TEST_ASAR;

test("current stock GitHub and WSL command generators preserve GraphQL variables without the retired guard", {
  skip: !archive || process.platform === "win32", timeout: 30000,
}, async () => {
  const report = await auditGraphql(archive);
  assert.equal(report.stockQueryVariablesPreserved, true);
  assert.equal(report.externalRequests, 0);
});
