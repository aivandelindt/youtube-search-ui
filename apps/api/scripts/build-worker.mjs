import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(apiRoot, "workers/download-worker.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(apiRoot, ".next/worker.cjs"),
  packages: "external",
  tsconfig: path.join(apiRoot, "tsconfig.json"),
});
