import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = fileURLToPath(new URL(".", import.meta.url));
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

let supabaseClient;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseClient;
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

function parseJsonBody(rawBody) {
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    const error = new Error("Invalid JSON request body.");
    error.status = 400;
    throw error;
  }
}

function createSlug() {
  return crypto.randomBytes(6).toString("base64url");
}

function splitLetterMessage(message) {
  const lines = String(message || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [customerName = "My Love"] = lines;
  return customerName.replace(/,$/, "");
}

function pickValue(payload, keys, fallback = "") {
  for (const key of keys) {
    if (payload[key] !== undefined) return payload[key];
  }
  return fallback;
}

function cleanRevealPayload(payload, existing = {}) {
  const letterMessage = String(pickValue(payload, ["letterMessage", "letter_message"], existing.letter_message || ""));
  const finalMessage = String(pickValue(payload, ["finalMessage", "final_message"], existing.final_message || ""));
  const futureImageUrl = String(
    pickValue(payload, ["dreamPhoto", "futureImageUrl", "future_image_url"], existing.future_image_url || ""),
  );
  const backgroundMusicUrl = String(
    pickValue(payload, ["music", "backgroundMusicUrl", "background_music_url"], existing.background_music_url || ""),
  );

  return {
    slug: existing.slug || String(payload.slug || createSlug()),
    customer_name: String(
      pickValue(payload, ["customerName", "customer_name"], existing.customer_name || splitLetterMessage(letterMessage)),
    ),
    customer_details: pickValue(payload, ["customerDetails", "customer_details"], existing.customer_details || {}),
    letter_message: letterMessage,
    final_message: finalMessage,
    future_image_url: futureImageUrl,
    background_music_url: backgroundMusicUrl,
    destination_result_data: pickValue(
      payload,
      ["destinationResultData", "destination_result_data"],
      existing.destination_result_data || {},
    ),
    admin_created: pickValue(payload, ["adminCreated", "admin_created"], existing.admin_created ?? true),
  };
}

function toClientReveal(row) {
  return {
    id: row.id,
    slug: row.slug,
    customerName: row.customer_name,
    customerDetails: row.customer_details || {},
    letterMessage: row.letter_message || "",
    dreamPhoto: row.future_image_url || "",
    futureImageUrl: row.future_image_url || "",
    music: row.background_music_url || "",
    backgroundMusicUrl: row.background_music_url || "",
    finalMessage: row.final_message || "",
    destinationResultData: row.destination_result_data || {},
    adminCreated: row.admin_created,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRevealBySlug(slug) {
  const { data, error } = await getSupabase()
    .from("reveal_entries")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
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

async function handleApi(request, response, url) {
  if (request.method === "POST" && url.pathname === "/api/reveals") {
    const payload = parseJsonBody(await readBody(request));
    const reveal = cleanRevealPayload(payload);
    const { data, error } = await getSupabase().from("reveal_entries").insert(reveal).select("*").single();

    if (error) throw error;

    sendJson(response, 201, {
      ...toClientReveal(data),
      url: `/reveal/${data.slug}`,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/reveals") {
    const { data, error } = await getSupabase()
      .from("reveal_entries")
      .select("id, slug, customer_name, letter_message, future_image_url, destination_result_data, admin_created, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    sendJson(response, 200, { reveals: data.map(toClientReveal) });
    return true;
  }

  if (url.pathname.startsWith("/api/reveals/")) {
    const slug = url.pathname.split("/").pop();
    if (!slug) {
      sendJson(response, 400, { error: "Missing reveal slug." });
      return true;
    }

    if (request.method === "GET") {
      const row = await getRevealBySlug(slug);
      if (!row) {
        sendJson(response, 404, { error: "Reveal not found." });
        return true;
      }

      sendJson(response, 200, toClientReveal(row));
      return true;
    }

    if (request.method === "PUT" || request.method === "PATCH") {
      const existing = await getRevealBySlug(slug);
      if (!existing) {
        sendJson(response, 404, { error: "Reveal not found." });
        return true;
      }

      const payload = parseJsonBody(await readBody(request));
      const reveal = cleanRevealPayload(payload, existing);
      const { data, error } = await getSupabase()
        .from("reveal_entries")
        .update(reveal)
        .eq("slug", slug)
        .select("*")
        .single();

      if (error) throw error;

      sendJson(response, 200, toClientReveal(data));
      return true;
    }

    if (request.method === "DELETE") {
      const { error } = await getSupabase().from("reveal_entries").delete().eq("slug", slug);
      if (error) throw error;

      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  return false;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(request, response, url);
      if (!handled) {
        sendJson(response, 404, { error: "API route not found." });
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/reveal/") && extname(url.pathname)) {
      await serveFile(response, `/${url.pathname.split("/").slice(2).join("/")}`);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/reveal/")) {
      await serveFile(response, "/index.html");
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/r/")) {
      response.writeHead(302, { Location: url.pathname.replace(/^\/r\//, "/reveal/") });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/admin") {
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
    const status = error.status || 500;
    sendJson(response, status, {
      error: status === 500 ? "Server error." : error.message,
      detail: status === 500 ? error.message : undefined,
    });
  }
});

server.listen(port, host, () => {
  console.log(`Dream Reveal Letter running at http://${host}:${port}`);
});
