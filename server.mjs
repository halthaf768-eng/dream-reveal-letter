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
const revealsTable = "reveals";

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
    if (!supabaseUrl) {
      console.error("[Supabase config] Missing SUPABASE_URL");
    }
    if (!serviceRoleKey) {
      console.error("[Supabase config] Missing SUPABASE_SERVICE_ROLE_KEY");
    }
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

function parseMessagePayload(message) {
  if (!message) return {};
  try {
    return JSON.parse(message);
  } catch {
    return {
      letterMessage: String(message),
      finalMessage: "",
      music: "",
      destinationResultData: {},
    };
  }
}

function cleanRevealPayload(payload, existing = {}) {
  const existingPayload = parseMessagePayload(existing.message);
  const letterMessage = String(pickValue(payload, ["letterMessage", "letter_message"], existingPayload.letterMessage || ""));
  const finalMessage = String(pickValue(payload, ["finalMessage", "final_message"], existingPayload.finalMessage || ""));
  const futureImageUrl = String(
    pickValue(payload, ["dreamPhoto", "futureImageUrl", "future_image_url", "future_image"], existing.future_image || ""),
  );
  const backgroundMusicUrl = String(
    pickValue(payload, ["music", "backgroundMusicUrl", "background_music_url"], existingPayload.music || ""),
  );
  const destinationResultData = pickValue(
    payload,
    ["destinationResultData", "destination_result_data"],
    existingPayload.destinationResultData || {},
  );
  const name = String(pickValue(payload, ["customerName", "customer_name", "name"], existing.name || splitLetterMessage(letterMessage)));
  const destination = String(
    pickValue(
      payload,
      ["destination", "destinationResult", "destination_result"],
      existing.destination || destinationResultData.destination || destinationResultData.result || finalMessage,
    ),
  );
  const email = String(pickValue(payload, ["email", "customerEmail", "customer_email"], existing.email || ""));

  const messagePayload = {
    letterMessage,
    finalMessage,
    music: backgroundMusicUrl,
    backgroundMusicUrl,
    destinationResultData,
  };

  return {
    slug: existing.slug || String(payload.slug || createSlug()),
    name,
    message: JSON.stringify(messagePayload),
    future_image: futureImageUrl,
    destination,
    email,
  };
}

function toClientReveal(row) {
  const messagePayload = parseMessagePayload(row.message);
  return {
    id: row.id,
    slug: row.slug,
    customerName: row.name || "",
    customerDetails: {},
    letterMessage: messagePayload.letterMessage || row.message || "",
    dreamPhoto: row.future_image || "",
    futureImageUrl: row.future_image || "",
    music: messagePayload.music || messagePayload.backgroundMusicUrl || "",
    backgroundMusicUrl: messagePayload.backgroundMusicUrl || messagePayload.music || "",
    finalMessage: messagePayload.finalMessage || row.destination || "",
    destination: row.destination || "",
    destinationResultData: messagePayload.destinationResultData || {},
    email: row.email || "",
    adminCreated: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRevealBySlug(slug) {
  const { data, error } = await getSupabase()
    .from(revealsTable)
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
    console.error("[Create reveal] Request body:", payload);
    const reveal = cleanRevealPayload(payload);
    const { data, error } = await getSupabase().from(revealsTable).insert(reveal).select("*").single();

    if (error) {
      console.error("[Create reveal] Supabase insert error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        insertObject: reveal,
      });
      throw error;
    }

    sendJson(response, 201, {
      ...toClientReveal(data),
      url: `/reveal/${data.slug}`,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/reveals") {
    const { data, error } = await getSupabase()
      .from(revealsTable)
      .select("id, slug, name, message, future_image, destination, email, created_at, updated_at")
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
        .from(revealsTable)
        .update(reveal)
        .eq("slug", slug)
        .select("*")
        .single();

      if (error) throw error;

      sendJson(response, 200, toClientReveal(data));
      return true;
    }

    if (request.method === "DELETE") {
      const { error } = await getSupabase().from(revealsTable).delete().eq("slug", slug);
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
    console.error("[Server error]", {
      path: url.pathname,
      method: request.method,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      stack: error.stack,
    });
    sendJson(response, status, {
      error: error.message || "Server error.",
      details: error.details || error.hint || error.code || error.stack || "",
    });
  }
});

server.listen(port, host, () => {
  console.log(`Dream Reveal Letter running at http://${host}:${port}`);
});
