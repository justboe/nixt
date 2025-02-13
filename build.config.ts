import { defineBuildConfig } from "unbuild";
import svelte from "rollup-plugin-svelte";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineBuildConfig({
  entries: ["src/cli.ts", "src/index.ts", "src/entry.ts"],
  externals: [],
  declaration: true,
  failOnWarn: false,
  hooks: {
    "rollup:options"(ctx, opts) {
      opts.plugins.push(svelte());
    },
  },
});
