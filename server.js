const path = require("path");

// Always load the .env that sits next to this file, no matter where the server is started from
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { STATES, ZONES } = require("./data/states");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const startedAt = Date.now();

/* ------------------------------------------------------------------ */
/* API keys from .env                                                  */
/*   TESTING   -> sandbox key: read only, 20 requests per minute       */
/*   KUNLE_API -> live key:    read and write, 120 requests per minute */
/* ------------------------------------------------------------------ */

const KEYS = new Map();

if (process.env.TESTING) {
  KEYS.set(process.env.TESTING, { mode: "sandbox", scopes: ["read"], limit: 20 });
}
if (process.env.KUNLE_API) {
  KEYS.set(process.env.KUNLE_API, { mode: "live", scopes: ["read", "write"], limit: 120 });
}

const WINDOW_MS = 60 * 1000;
const buckets = new Map();

function apiError(res, status, code, message, extra) {
  return res.status(status).json({ error: Object.assign({ status, code, message }, extra || {}) });
}

function requireKey(scope) {
  return function (req, res, next) {
    const key = req.get("x-api-key");

    if (!key) {
      return apiError(res, 401, "missing_api_key", "No API key sent. Add your key in the x-api-key header.");
    }

    const client = KEYS.get(key);
    if (!client) {
      return apiError(res, 401, "invalid_api_key", "That API key is not recognised. Check the value in your .env file.");
    }

    // Simple fixed-window rate limit per key
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, client.limit - bucket.count);
    const resetIn = Math.ceil((bucket.resetAt - now) / 1000);
    res.set("X-RateLimit-Limit", String(client.limit));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Reset", String(resetIn));

    if (bucket.count > client.limit) {
      res.set("Retry-After", String(resetIn));
      return apiError(res, 429, "rate_limited", "Too many requests. The " + client.mode + " key allows " + client.limit + " per minute. Try again in " + resetIn + "s.");
    }

    if (scope && !client.scopes.includes(scope)) {
      return apiError(res, 403, "insufficient_scope", "The " + client.mode + " key is read only. Use the live key (KUNLE_API) to change data.");
    }

    req.client = Object.assign({}, client, { remaining: remaining, resetIn: resetIn });
    next();
  };
}

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------------ Public ------------------------------ */

app.get("/api/health", function (req, res) {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    keysLoaded: {
      TESTING: Boolean(process.env.TESTING),
      KUNLE_API: Boolean(process.env.KUNLE_API),
    },
  });
});

/* ------------------------------ Account ----------------------------- */

app.get("/api/me", requireKey("read"), function (req, res) {
  res.json({
    mode: req.client.mode,
    scopes: req.client.scopes,
    rateLimit: {
      limitPerMinute: req.client.limit,
      remaining: req.client.remaining,
      resetsInSeconds: req.client.resetIn,
    },
  });
});

/* ------------------------------ States ------------------------------ */

app.get("/api/states", requireKey("read"), function (req, res) {
  let results = STATES;
  const zone = (req.query.zone || "").toString().toLowerCase();
  const q = (req.query.q || "").toString().toLowerCase().trim();

  if (zone) {
    if (!ZONES[zone]) {
      return apiError(res, 400, "invalid_zone", "Unknown zone. Use one of: " + Object.keys(ZONES).join(", "));
    }
    results = results.filter(function (s) { return s.zone === zone; });
  }
  if (q) {
    results = results.filter(function (s) {
      return s.name.toLowerCase().includes(q) || s.capital.toLowerCase().includes(q);
    });
  }

  res.json({ count: results.length, data: results });
});

app.get("/api/states/:slug", requireKey("read"), function (req, res) {
  const state = STATES.find(function (s) { return s.slug === req.params.slug.toLowerCase(); });
  if (!state) {
    return apiError(res, 404, "not_found", "No state with slug '" + req.params.slug + "'. Try lagos, oyo or fct.");
  }
  res.json({ data: state });
});

/* ------------------------------ Tasks ------------------------------- */
/* Stored in memory, so they reset every time the server restarts.     */

let nextId = 3;
let tasks = [
  { id: 1, title: "Read about HTTP status codes", done: true, createdAt: new Date().toISOString() },
  { id: 2, title: "Call the API with the live key", done: false, createdAt: new Date().toISOString() },
];

function findTask(req, res) {
  const id = Number(req.params.id);
  const task = tasks.find(function (t) { return t.id === id; });
  if (!task) {
    apiError(res, 404, "not_found", "No task with id " + req.params.id + ".");
    return null;
  }
  return task;
}

function validTitle(title) {
  return typeof title === "string" && title.trim().length > 0 && title.trim().length <= 120;
}

app.get("/api/tasks", requireKey("read"), function (req, res) {
  res.json({ count: tasks.length, data: tasks });
});

app.get("/api/tasks/:id", requireKey("read"), function (req, res) {
  const task = findTask(req, res);
  if (task) res.json({ data: task });
});

app.post("/api/tasks", requireKey("write"), function (req, res) {
  const title = req.body && req.body.title;
  if (!validTitle(title)) {
    return apiError(res, 422, "validation_failed", "Body must include a title between 1 and 120 characters.", { example: { title: "Learn REST" } });
  }
  const task = { id: nextId++, title: title.trim(), done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  res.status(201).json({ data: task });
});

app.patch("/api/tasks/:id", requireKey("write"), function (req, res) {
  const task = findTask(req, res);
  if (!task) return;

  const body = req.body || {};
  if (body.title !== undefined && !validTitle(body.title)) {
    return apiError(res, 422, "validation_failed", "title must be between 1 and 120 characters.");
  }
  if (body.done !== undefined && typeof body.done !== "boolean") {
    return apiError(res, 422, "validation_failed", "done must be true or false.");
  }
  if (body.title === undefined && body.done === undefined) {
    return apiError(res, 422, "validation_failed", "Send title or done to update.", { example: { done: true } });
  }

  if (body.title !== undefined) task.title = body.title.trim();
  if (body.done !== undefined) task.done = body.done;
  res.json({ data: task });
});

app.delete("/api/tasks/:id", requireKey("write"), function (req, res) {
  const task = findTask(req, res);
  if (!task) return;
  tasks = tasks.filter(function (t) { return t.id !== task.id; });
  res.json({ deleted: true, data: task });
});

/* ------------------------------ Errors ------------------------------ */

app.use("/api", function (req, res) {
  apiError(res, 404, "route_not_found", req.method + " " + req.originalUrl + " does not exist.");
});

app.use(function (err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return apiError(res, 400, "invalid_json", "The request body is not valid JSON.");
  }
  console.error(err);
  apiError(res, 500, "server_error", "Something went wrong on the server.");
});

app.listen(PORT, function () {
  console.log("");
  console.log("  Kunle API running at http://localhost:" + PORT);
  console.log("  TESTING   (sandbox key): " + (process.env.TESTING ? "loaded" : "MISSING"));
  console.log("  KUNLE_API (live key):    " + (process.env.KUNLE_API ? "loaded" : "MISSING"));
  if (!process.env.TESTING || !process.env.KUNLE_API) {
    console.log("  Add the missing key(s) to .env and restart the server.");
  }
  console.log("");
});
