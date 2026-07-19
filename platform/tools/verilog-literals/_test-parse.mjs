import * as hdl from "../../vendor/systemverilog-simulator/engine.mjs";

const tests = [
  "8'hAA",
  "8'b11111111",
  "8'sd42",
  "12'o3777",
  "8'b1010_1100",
  "16'h00FF",
  "8'H2a",
  "'sd-5",
  "'s'hF",
];

for (const t of tests) {
  const r = hdl.parseLiteral(t);
  console.log(t, JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}
