#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", ".eleventy.js");
let src = fs.readFileSync(file, "utf8");

const backup = file + ".backup";
fs.writeFileSync(backup, src);
console.log("backup:", backup);

const newFilter = `  eleventyConfig.addFilter("hotelPhoto", (hotel) => {
    const name = (hotel && hotel.name) || "unknown hotel";
    const photo = hotel && hotel.photo;
    if (photo && typeof photo === "string") {
      const cleaned = String(photo).replace(/^\\//, "");
      const normalized = cleaned.replace(/^hotels\\//, "").replace(/^images\\/hotels\\//, "");
      if (fs.existsSync(path.join(__dirname, "public", "images", "hotels", normalized))) {
        return "hotels/" + normalized;
      }
      console.warn("[hotelPhoto] MISSING file for \\"" + name + "\\": hotels/" + normalized);
    } else {
      console.warn("[hotelPhoto] NO photo field for \\"" + name + "\\"");
    }
    return "image-not-available.svg";
  });`;

const re = /eleventyConfig\.addFilter\("hotelPhoto",[\s\S]*?\n  \}\);/;
if (!re.test(src)) {
  console.error("Could not find hotelPhoto filter block. Aborting.");
  process.exit(1);
}
src = src.replace(re, newFilter);

// hotelImg — same random-pick bug
src = src.replace(
  /eleventyConfig\.addFilter\("hotelImg",[\s\S]*?\}\);/,
  'eleventyConfig.addFilter("hotelImg", () => "image-not-available.svg");'
);

fs.writeFileSync(file, src);
console.log("wrote", file);
