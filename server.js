// Load variables from .env into process.env before anything else
require("dotenv").config();

const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the front-end
app.use(express.static(path.join(__dirname, "public")));

// The browser cannot read .env directly, so the server exposes the values here
app.get("/api/env", (req, res) => {
  res.json({
    TESTING: process.env.TESTING ?? null,
    KUNLE_API: process.env.KUNLE_API ?? null,
  });
});

app.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
  console.log("TESTING loaded:", process.env.TESTING ? "yes" : "no");
  console.log("KUNLE_API loaded:", process.env.KUNLE_API ? "yes" : "no");
});
