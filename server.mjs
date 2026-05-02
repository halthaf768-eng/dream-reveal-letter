import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = fileURLToPath(new URL(".", import.meta.url));
const dbDir = join(root, "database");
const dbPath = join(dbDir, "reveals.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const maxBodyBytes = 24 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".json": "application/json; charset=utf-8",
};

async function ensureDb() {
  await mkdir(dbDir, { recursive: true });
  if (!existsSync(dbPath)) {
    await writeFile(dbPath, "{}\n", "utf8");
  }
}

async function readDb() {
  await ensureDb();
  return JSON.parse(await readFile(dbPath, "utf8"));
}

async function writeDb(data) {
  await ensureDb();
  await writeFile(dbPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBodyBytes) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function cleanRevealPayload(payload) {
  return {
    letterMessage: String(payload.letterMessage || ""),
    dreamPhoto: String(payload.dreamPhoto || ""),
    music: String(payload.music || ""),
    finalMessage: String(payload.finalMessage || ""),
    createdAt: new Date().toISOString(),
  };
}

async function serveFile(response, pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  try {
    if (request.method === "POST" && url.pathname === "/api/reveals") {
      const payload = JSON.parse(await readBody(request));
      const id = crypto.randomBytes(6).toString("base64url");
      const db = await readDb();
      db[id] = cleanRevealPayload(payload);
      await writeDb(db);
      sendJson(response, 201, { id, url: `/r/${id}` });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/reveals/")) {
      const id = url.pathname.split("/").pop();
      const db = await readDb();
      if (!id || !db[id]) {
        sendJson(response, 404, { error: "Reveal not found" });
        return;
      }
      sendJson(response, 200, db[id]);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/r/") && extname(url.pathname)) {
      await serveFile(response, `/${url.pathname.split("/").slice(2).join("/")}`);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/r/")) {
      await serveFile(response, "/index.html");
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveFile(response, url.pathname);
      return;
    }

    response.writeHead(405);
    response.end("Method not allowed");
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
});

await ensureDb();
server.listen(port, host, () => {
  console.log(`Dream Reveal Letter running at http://${host}:${port}`);
});
