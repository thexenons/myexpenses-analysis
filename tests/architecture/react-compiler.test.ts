import assert from "node:assert/strict";
import test from "node:test";

import { transformSync } from "@babel/core";

// Covers the compatibility patch until React Compiler ships the upstream fix:
// https://github.com/react/react/pull/37492
const FIXTURES = [
  {
    name: "plain props",
    source: "export function Fixture({ value }) { return <div>{value}</div>; }",
  },
  {
    name: "parameter defaults",
    source: "export function Fixture({ value = 1 }) { return <div>{value}</div>; }",
  },
  {
    name: "local destructuring defaults",
    source: "export function Fixture(props) { const { value = 1 } = props; return <div>{value}</div>; }",
  },
  {
    name: "nested defaults",
    source: "export function Fixture({ data: { value = 1 } = {} }) { return <div>{value}</div>; }",
  },
  {
    name: "defaults with rest props",
    source: "export function Fixture({ value = 1, ...rest }) { return <div {...rest}>{value}</div>; }",
  },
  {
    name: "destructuring assignment defaults",
    source: "export function Fixture(props) { let value; ({ value = 1 } = props); return <div>{value}</div>; }",
  },
  {
    name: "renamed default props",
    source: "export function Fixture({ input: value = 1 }) { return <div>{value}</div>; }",
  },
] as const;

for (const fixture of FIXTURES) {
  test(`React Compiler emits memoization for ${fixture.name}`, () => {
    const result = transformSync(fixture.source, {
      babelrc: false,
      configFile: false,
      filename: "compiler-fixture.jsx",
      parserOpts: { plugins: ["jsx"] },
      plugins: [["babel-plugin-react-compiler", { panicThreshold: "all_errors" }]],
    });

    // A successful transform can still silently skip compilation. Check that
    // the memo cache is emitted, including Babel 8's AssignmentPattern paths.
    assert.match(result?.code ?? "", /from ["']react\/compiler-runtime["']/u);
  });
}
