// Extract and save mapping objects from .eleventy.js as JSON
const fs = require('fs');
const path = require('path');

// Read the .eleventy.js file
const eleventyPath = path.join(__dirname, '.eleventy.js');
const content = fs.readFileSync(eleventyPath, 'utf8');

// Extract mapping objects using regex
const extractMap = (text, varName) => {
  const pattern = new RegExp(`${varName}\s*=\s*({.*?});\s*(?=//|$)`, 's');
  const matches = text.match(pattern);
  if (!matches) return null;

  try {
    // First try to parse as JSON
    return JSON.parse(matches[1]);
  } catch (e) {
    // If JSON parsing fails, try to extract key-value pairs
    const result = {};
    const lines = matches[1].replace('{', '').replace('}', '').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes(':') && !trimmed.startsWith('//')) {
        const [key, value] = trimmed.split(':', 2);
        const k = key.trim().replace(/['"]/g, '');
        const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
        if (k) result[k] = v;
      }
    }
    return result;
  }
};

// Extract all mappings
const mappings = {
  slugMap: extractMap(content, 'const slugMap'),
  zoneImage: extractMap(content, 'const zoneImage'),
  attractionImage: extractMap(content, 'const attractionImage'),
  zoneAliases: extractMap(content, 'const zoneAliases'),
  zonePatterns: extractMap(content, 'const zonePatterns'),
  attrCategoryArrays: extractMap(content, 'const attrCategoryArrays'),
};

// Remove null/undefined entries
const cleanMappings = {};
for (const [key, value] of Object.entries(mappings)) {
  if (value) {
    cleanMappings[key] = value;
    console.log(`${key}: Extracted ${Object.keys(value).length} entries`);
  }
}

// Write to JSON file
const outputPath = path.join(__dirname, 'eleventy_mappings.json');
fs.writeFileSync(outputPath, JSON.stringify(cleanMappings, null, 2));
console.log(`\nMappings saved to ${outputPath}`);