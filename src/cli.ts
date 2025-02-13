import { defineCommand, createMain } from "citty";
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createServer, searchForWorkspaceRoot, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { type RouterContext, addRoute, findRoute, createRouter } from "rou3";
import { globSync } from "glob";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const SOURCE_DIR = join(fileURLToPath(import.meta.url), "../");
const HEAD_TEMPLATE = `<!-- %nixt_head% -->`;
const BODY_TEMPLATE = `<!-- %nixt_body% -->`;

type Route = {
  is_server?: boolean;
  file: string;
};

const dev = defineCommand({
  meta: {
    name: "dev",
    description: "Run the development server",
    version: pkg.version,
  },

  args: {
    cwd: {
      type: "positional",
      description: "The current working directory",
      default: process.cwd(),
    },
  },
  async run({ args }) {
    if (!isAbsolute(args.cwd))
      args.cwd = join(process.cwd(), args.cwd).replaceAll("\\", "/");

    const server = await createServer({
      server: {
        fs: {
          allow: [args.cwd, process.cwd(), searchForWorkspaceRoot(args.cwd)],
        },
      },
      root: args.cwd,
      appType: "custom",
      plugins: [svelte(), nixt(args.cwd)],
    });
    await server.listen();
    server.printUrls();
  },
});

const main = createMain({
  meta: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  },
  subCommands: { dev },
});

function nixt(cwd = process.cwd()): Plugin {
  const router = createRouter<Route>();
  resolveRoutes({ cwd, router });

  return {
    name: "vite-plugin-nixt",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const route = findRoute(router, "", req.originalUrl || "/");

          if (!route) return next();

          if (route.data.is_server) {
            try {
              // Enable Vite's debug logging
              process.env.DEBUG = "vite:*";

              const resolvedId = await server.moduleGraph.resolveUrl(
                route.data.file,
              );
              console.log("[Debug] Vite resolved path:", resolvedId);

              const functions = await import(`/${route.data.file}`);
              console.log("[Debug] Successfully imported:", functions);
            } catch (error) {
              console.error("[Debug] Import failed:", error);
              return next(error);
            }
          }

          return res.end(`<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!-- %nixt_head% -->
            </head>
            <body>
            <!-- %nixt_body% -->
            <script type="module" src="/@fs/${SOURCE_DIR}/entry.mjs"></script>
            </body>
            </html>`);
        });
      };
    },
  };
}

async function resolveRoutes({
  cwd,
  router,
}: {
  cwd: string;
  router: RouterContext;
}) {
  const globs = globSync(["**/*.{svelte,ts,js}"], {
    cwd: join(cwd, "/routes"),
    ignore: ["**/+page.{server.,}{ts,js}"],
  });

  for (const glob of globs) {
    const is_server = glob.endsWith(".ts") || glob.endsWith(".js");
    let path = glob
      .replaceAll("\\", "/")
      .replace(/(index|\+server|\+page)\.(svelte|ts|js)$/, "")
      .replace(/\.(svelte|ts|js)$/, "");
    if (!path.startsWith("/")) path = `/${path}`;

    addRoute(router, "", path, {
      is_server,
      file: join(cwd, "routes", glob),
    });
  }
}

main();
