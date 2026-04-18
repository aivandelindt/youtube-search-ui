import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

/**
 * Bundle almost everything into worker.cjs so Docker standalone (traced from
 * Next server only) does not need a complete node_modules for BullMQ/ioredis.
 * Keep native modules external so they load from standalone's node_modules.
 */
await esbuild.build({
  entryPoints: [path.join(apiRoot, "workers/download-worker.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(apiRoot, ".next/worker.cjs"),
  tsconfig: path.join(apiRoot, "tsconfig.json"),
  external: [
    "better-sqlite3",
    "bindings",
    "cpu-features",
    "msgpackr-extract",
  ],
});
