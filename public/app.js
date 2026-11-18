(function () {
  "use strict";

  var ENDPOINTS = [
    { group: "Public", method: "GET", path: "/api/health", desc: "Server status. No key needed.", open: true },
    { group: "Account", method: "GET", path: "/api/me", desc: "Shows which key you used, its scopes and quota." },
    { group: "Nigerian states", method: "GET", path: "/api/states", desc: "All 36 states and the FCT." },
    { group: "Nigerian states", method: "GET", path: "/api/states?zone=south-west", desc: "Filter by geopolitical zone." },
    { group: "Nigerian states", method: "GET", path: "/api/states?q=port", desc: "Search by state or capital." },
    { group: "Nigerian states", method: "GET", path: "/api/states/lagos", desc: "One state by its slug." },
    { group: "Tasks", method: "GET", path: "/api/tasks", desc: "List tasks (kept in server memory)." },
    { group: "Tasks", method: "POST", path: "/api/tasks", desc: "Create a task. Live key only.", body: { title: "Finish my API class assignment" } },
    { group: "Tasks", method: "PATCH", path: "/api/tasks/2", desc: "Mark a task done. Live key only.", body: { done: true } },
    { group: "Tasks", method: "DELETE", path: "/api/tasks/1", desc: "Delete a task. Live key only." }
  ];

  var EXPLAIN = {
    200: ["ok", "200 OK. The key was accepted and the server sent back the data."],
    201: ["ok", "201 Created. The live key is allowed to write, so a new task was saved."],
    400: ["warn", "400 Bad Request. The server could not understand what you sent. Check the JSON body or query values."],
    401: ["bad", "401 Unauthorized. The server does not know who you are: the key is missing or does not match .env."],
    403: ["bad", "403 Forbidden. The key is valid, but it is not allowed to do this. The sandbox key can only read."],
    404: ["warn", "404 Not Found. That route or item does not exist."],
    422: ["warn", "422 Unprocessable. The JSON is valid but the values break the rules, like an empty title."],
    429: ["bad", "429 Too Many Requests. This key used up its quota for the minute. Wait for the reset."],
    500: ["bad", "500 Server Error. Something broke on the server side."]
  };

  var WRONG_KEY = "wrong-key-000";
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    list: $("endpointList"),
    desc: $("endpointDesc"),
    method: $("method"),
    path: $("path"),
    key: $("key"),
    toggleKey: $("toggleKey"),
    bodyWrap: $("bodyWrap"),
    body: $("body"),
    send: $("send"),
    status: $("status"),
    time: $("time"),
    quota: $("quota"),
    explain: $("explain"),
    output: $("output"),
    curl: $("curl"),
    copyCurl: $("copyCurl"),
    history: $("history"),
    clearHistory: $("clearHistory")
  };

  var history = [];
  var activeIndex = 0;

  /* ---------------- Storage (safe) ---------------- */

  function store(name, value) {
    try { localStorage.setItem(name, value); } catch (e) { /* storage unavailable */ }
  }
  function load(name) {
    try { return localStorage.getItem(name); } catch (e) { return null; }
  }

  /* ---------------- Helpers ---------------- */

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(json) {
    return escapeHtml(json).replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        var cls = "n";
        if (/^"/.test(match)) cls = /:$/.test(match) ? "k" : "s";
        else if (/true|false/.test(match)) cls = "b";
        else if (/null/.test(match)) cls = "nl";
        return '<span class="' + cls + '">' + match + "</span>";
      }
    );
  }

  function tone(status) {
    if (status >= 200 && status < 300) return "ok";
    if (status === 401 || status === 403 || status === 429 || status >= 500) return "bad";
    return "warn";
  }

  function hasBody(method) {
    return method === "POST" || method === "PATCH";
  }

  function keyLabel(key, limit) {
    if (!key) return "no key";
    if (limit === "120") return "live key";
    if (limit === "20") return "sandbox key";
    if (key === WRONG_KEY) return "wrong key";
    return "key •••" + key.slice(-3);
  }

  /* ---------------- Endpoint list ---------------- */

  function renderEndpoints() {
    var html = "";
    var lastGroup = "";
    ENDPOINTS.forEach(function (ep, i) {
      if (ep.group !== lastGroup) {
        html += '<p class="group-label">' + escapeHtml(ep.group) + "</p>";
        lastGroup = ep.group;
      }
      html +=
        '<button class="ep' + (i === activeIndex ? " active" : "") + '" data-index="' + i + '" type="button">' +
          '<span class="method m-' + ep.method + '">' + ep.method + "</span>" +
          '<span class="ep-path">' + escapeHtml(ep.path) + "</span>" +
          (ep.open ? '<span class="lock">open</span>' : "") +
        "</button>";
    });
    els.list.innerHTML = html;
  }

  function selectEndpoint(i) {
    activeIndex = i;
    var ep = ENDPOINTS[i];
    els.method.value = ep.method;
    els.path.value = ep.path;
    els.desc.textContent = ep.desc;
    els.body.value = ep.body ? JSON.stringify(ep.body, null, 2) : "";
    syncBody();
    renderEndpoints();
    updateCurl();
  }

  function syncBody() {
    els.bodyWrap.classList.toggle("show", hasBody(els.method.value));
  }

  /* ---------------- curl snippet (Windows cmd friendly) ---------------- */

  function updateCurl() {
    var method = els.method.value;
    var url = window.location.origin + els.path.value.trim();
    var key = els.key.value.trim();
    var parts = ["curl -i"];
    if (method !== "GET") parts.push("-X " + method);
    parts.push('"' + url + '"');
    if (key) parts.push('-H "x-api-key: ' + key + '"');
    if (hasBody(method)) {
      var raw = els.body.value.trim();
      try { raw = JSON.stringify(JSON.parse(raw)); } catch (e) { /* keep as typed */ }
      parts.push('-H "Content-Type: application/json"');
      parts.push('-d "' + raw.replace(/"/g, '\\"') + '"');
    }
    els.curl.textContent = parts.join(" ");
  }

  /* ---------------- Send ---------------- */

  function send() {
    var method = els.method.value;
    var path = els.path.value.trim();
    var key = els.key.value.trim();

    if (!path.startsWith("/")) {
      path = "/" + path;
      els.path.value = path;
    }

    var options = { method: method, headers: {} };
    if (key) options.headers["x-api-key"] = key;
    if (hasBody(method)) {
      options.headers["Content-Type"] = "application/json";
      options.body = els.body.value;
    }

    els.send.disabled = true;
    els.status.className = "status idle";
    els.status.textContent = "Sending";
    var started = performance.now();

    fetch(path, options)
      .then(function (res) {
        return res.text().then(function (text) { return { res: res, text: text }; });
      })
      .then(function (result) {
        var ms = Math.round(performance.now() - started);
        showResponse(result.res, result.text, ms);
        addHistory({ method: method, path: path, key: key, body: els.body.value, status: result.res.status, ms: ms, limit: result.res.headers.get("X-RateLimit-Limit") });
      })
      .catch(function () {
        els.status.className = "status bad";
        els.status.textContent = "Network error";
        els.explain.className = "explain bad";
        els.explain.textContent = "Could not reach the server. Is it running? Start it with npm start.";
        els.output.textContent = "";
      })
      .then(function () {
        els.send.disabled = false;
      });
  }

  function showResponse(res, text, ms) {
    var t = tone(res.status);
    els.status.className = "status " + t;
    els.status.textContent = res.status + " " + (res.statusText || "");
    els.time.textContent = ms + " ms";

    var limit = res.headers.get("X-RateLimit-Limit");
    var remaining = res.headers.get("X-RateLimit-Remaining");
    els.quota.textContent = limit ? remaining + " / " + limit + " left this minute" : "";

    var info = EXPLAIN[res.status];
    els.explain.className = "explain " + t;
    els.explain.textContent = info ? info[1] : "Status " + res.status + ".";

    try {
      els.output.innerHTML = highlight(JSON.stringify(JSON.parse(text), null, 2));
    } catch (e) {
      els.output.textContent = text || "(empty body)";
    }
  }

  /* ---------------- History ---------------- */

  function addHistory(item) {
    history.unshift(item);
    history = history.slice(0, 8);
    renderHistory();
  }

  function renderHistory() {
    if (!history.length) {
      els.history.innerHTML = '<li class="muted small">No requests yet.</li>';
      return;
    }
    els.history.innerHTML = history.map(function (h, i) {
      return (
        "<li><button type=\"button\" data-h=\"" + i + "\">" +
          '<span class="method m-' + h.method + '">' + h.method + "</span>" +
          '<span class="h-path">' + escapeHtml(h.path) + "</span>" +
          '<span class="h-key">' + escapeHtml(keyLabel(h.key, h.limit)) + "</span>" +
          '<span class="h-status ' + tone(h.status) + '">' + h.status + "</span>" +
        "</button></li>"
      );
    }).join("");
  }

  /* ---------------- Health chips ---------------- */

  function loadHealth() {
    fetch("/api/health")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var chips = document.querySelectorAll("#health .chip");
        chips.forEach(function (chip) {
          var loaded = data.keysLoaded && data.keysLoaded[chip.dataset.key];
          chip.classList.add(loaded ? "on" : "off");
          chip.title = loaded ? "Loaded from .env" : "Missing from .env";
        });
      })
      .catch(function () { /* server offline: chips stay grey */ });
  }

  /* ---------------- Events ---------------- */

  els.list.addEventListener("click", function (e) {
    var btn = e.target.closest(".ep");
    if (btn) selectEndpoint(Number(btn.dataset.index));
  });

  els.method.addEventListener("change", function () { syncBody(); updateCurl(); });
  els.path.addEventListener("input", updateCurl);
  els.body.addEventListener("input", updateCurl);

  els.key.addEventListener("input", function () {
    store("kunle-api-key", els.key.value);
    updateCurl();
  });

  els.toggleKey.addEventListener("click", function () {
    var hidden = els.key.type === "password";
    els.key.type = hidden ? "text" : "password";
    els.toggleKey.textContent = hidden ? "Hide" : "Show";
  });

  document.querySelectorAll("[data-preset]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      els.key.value = btn.dataset.preset === "wrong" ? WRONG_KEY : "";
      store("kunle-api-key", els.key.value);
      updateCurl();
    });
  });

  els.send.addEventListener("click", send);

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

  els.copyCurl.addEventListener("click", function () {
    var text = els.curl.textContent;
    var done = function () {
      els.copyCurl.textContent = "Copied";
      setTimeout(function () { els.copyCurl.textContent = "Copy"; }, 1400);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
    }
  });

  els.history.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-h]");
    if (!btn) return;
    var h = history[Number(btn.dataset.h)];
    els.method.value = h.method;
    els.path.value = h.path;
    els.key.value = h.key;
    els.body.value = h.body;
    syncBody();
    updateCurl();
  });

  els.clearHistory.addEventListener("click", function () {
    history = [];
    renderHistory();
  });

  /* ---------------- Start ---------------- */

  els.key.value = load("kunle-api-key") || "";
  selectEndpoint(0);
  loadHealth();
})();
