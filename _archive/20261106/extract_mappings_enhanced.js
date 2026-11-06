#!/usr/bin/env node
// extract_mappings_enhanced.js — dump the mapping tables from .eleventy.js as JSON, preserving RegExp values as strings.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, ".eleventy.js"), "utf8");

// Keep track of RegExp definitions to extract them as {re: sourcePattern, flags}
const regexSources = {};

// First, extract object literals we care about, preserving regex as strings
const WANT = ["slugMap", "zoneImage", "attractionImage", "zoneAliases"];
const WANT_SRC = ["zonePatterns", "attrCategoryArrays", "zoneAliases"];

const out = {};

function extractObjectLiteral(varName, preserveRegexStrings = false) {
  const re = new RegExp(`const\\s+${varName}\\s*=\\s*(\\{)`, "m");
  const m = re.exec(src);
  if (!m) return {};
  const start = m.index + m[0].length - 1;
  let depth = 0, inStr = false, esc = false, inRegex = false, regexStart = -1;
  const chars = [];
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      chars.push(c);
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; chars.push(c); continue; }
    if (c === "/" && src[i + 1] !== "/" && src[i + 1] !== "*" && !inStr) {
      if (inRegex) {
        // end of regex literal
        const regexContent = chars.join("");
        const match = regexContent.match(/^\"(.*?)\"$/s);
        if (match) {
          const pattern = match[1];
          const flagsMatch = regexContent.match(/,\\s*([a-z]+)\)$/) || [null, ""];
          const flags = flagsMatch[1];
          regexSources[varName] = regexSources[varName] || {};
          regexSources[varName][pattern] = flags;
        }
        // replace with placeholder
        chars.length = 0;
        inRegex = false;
        // continue parsing the comma or property after the regex
        continue;
      } else {
        inRegex = true;
        regexStart = chars.length;
        // start building the regex string literal
        inStr = true;
        chars.push('"');
        continue;
      }
    }
    if (inRegex) {
      // inside regex string literal — already captured via inStr logic
      if (c === "\\" && src[i + 1] === "g") {
        // actually we just rely on inStr to capture the whole string
      }
    }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) break; }
    chars.push(c);
  }
  const literal = chars.join("");
  try {
    return new Function("return " + literal)();
  } catch (e) {
    return {};
  }
}

for (const name of WANT) {
  out[name] = extractObjectLiteral(name);
}

// For src maps that contain regex, we output as { pattern: "reStr", flags: "" }
for (const name of WANT_SRC) {
  const obj = extractObjectLiteral(name);
  if (!obj) continue;
  out[name] = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.startsWith("/") && v.endsWith("/")) {
      const flagsMatch = v.slice(1).match(/([^/]+)\/(.+)/);
      if (flagsMatch) {
        const pattern = flagsMatch[1];
        const flags = flagsMatch[2];
        out[name][k] = { pattern, flags };
      } else {
        out[name][k] = v;
      }
    } else {
      out[name][k] = v;
    }
  }
}

console.log(JSON.stringify(out, null, 2));
