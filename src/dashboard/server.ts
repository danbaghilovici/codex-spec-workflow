import path from "node:path";

import websocket from "@fastify/websocket";
import chokidar from "chokidar";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

import { WORKFLOW_ROOT } from "../constants.js";
import { dashboardPage } from "./page.js";
import { createDashboardSnapshot, type DashboardSnapshot } from "./snapshot.js";

export interface DashboardOptions {
  projects: string[];
  host?: string;
  port?: number;
  readOnly?: boolean;
  logger?: boolean;
}

export interface RunningDashboard {
  server: FastifyInstance;
  url: string;
  close: () => Promise<void>;
}

export function isMutationMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export async function buildDashboardServer(options: DashboardOptions): Promise<{
  server: FastifyInstance;
  closeWatcher: () => Promise<void>;
}> {
  const projects = [
    ...new Set(options.projects.map((project) => path.resolve(project))),
  ];
  const server = Fastify({ logger: options.logger ?? false });
  await server.register(websocket);
  const clients = new Set<WebSocket>();
  let snapshot: DashboardSnapshot = await createDashboardSnapshot(projects);
  let refreshTimer: NodeJS.Timeout | undefined;

  const refresh = (): void => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void createDashboardSnapshot(projects).then((next) => {
        snapshot = next;
        const payload = JSON.stringify(next);
        for (const client of clients) {
          if (client.readyState === client.OPEN) client.send(payload);
        }
      });
    }, 80);
  };

  if (options.readOnly) {
    server.addHook("onRequest", async (request, reply) => {
      if (isMutationMethod(request.method)) {
        await reply.code(405).send({ error: "Dashboard is read-only." });
      }
    });
  }

  server.get("/", (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(dashboardPage),
  );
  server.get("/api/snapshot", () => snapshot);
  server.get("/health", () => ({
    ok: true,
    readOnly: Boolean(options.readOnly),
  }));
  server.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify(snapshot));
    socket.on("close", () => clients.delete(socket));
  });

  const watcher = chokidar.watch(
    projects.map((project) => path.join(project, WORKFLOW_ROOT)),
    { ignoreInitial: true },
  );
  watcher.on("all", refresh);
  return {
    server,
    closeWatcher: async () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      await watcher.close();
    },
  };
}

export async function startDashboard(
  options: DashboardOptions,
): Promise<RunningDashboard> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8247;
  const { server, closeWatcher } = await buildDashboardServer(options);
  await server.listen({ host, port });
  return {
    server,
    url: `http://${host}:${port}`,
    close: async () => {
      await closeWatcher();
      await server.close();
    },
  };
}
