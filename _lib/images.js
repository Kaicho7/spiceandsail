const fs = require("fs");
const path = require("path");

const IMG_ROOT = path.join(__dirname, "..", "public", "images");
const PLACEHOLDER = "/images/placeholders/image-not-available.jpg";
const STRICT = process.env.STRICT_IMAGES === "1";

function exists(p) {
  if (!p) return false;
  return fs.existsSync(path.join(IMG_ROOT, p.replace(/^\/+/, "")));
}

function resolveImage(candidate, context) {
  if (exists(candidate)) return candidate;
  if (STRICT) {
    throw new Error(`Missing image for ${context}: ${candidate || "(no field)"}`);
  }
  console.warn(`[img] placeholder used for ${context}`);
  return PLACEHOLDER;
}

module.exports = { resolveImage, PLACEHOLDER };
