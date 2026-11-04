// Simple extract and save mapping objects from .eleventy.js as JSON
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '.eleventy.js'), 'utf8');

// Extract slugMap (lines 25-43)
const slugMap = {};
const slugMapMatch = content.match(/const slugMap = ({[^;]+});/s);
if (slugMapMatch) {
  const slugMapContent = slugMapMatch[1];
  const lines = slugMapContent.replace('{', '').replace('}', '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':', 2);
      const k = key.trim().replace(/['"]/g, '');
      const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
      if (k && v) slugMap[k] = v;
    }
  }
  console.log('slugMap entries:', Object.keys(slugMap).length);
}

// Extract zoneImage (lines 46-61)
const zoneImage = {};
const zoneImageMatch = content.match(/const zoneImage = ({[^;]+});/s);
if (zoneImageMatch) {
  const zoneImageContent = zoneImageMatch[1];
  const lines = zoneImageContent.replace('{', '').replace('}', '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':', 2);
      const k = key.trim().replace(/['"]/g, '');
      const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
      if (k && v) zoneImage[k] = v;
    }
  }
  console.log('zoneImage entries:', Object.keys(zoneImage).length);
}

// Extract attractionImage (lines 140-215)
const attractionImage = {};
const attractionImageMatch = content.match(/const attractionImage = ({[^;]+});/s);
if (attractionImageMatch) {
  const attractionImageContent = attractionImageMatch[1];
  const lines = attractionImageContent.replace('{', '').replace('}', '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':', 2);
      const k = key.trim().replace(/['"]/g, '');
      const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
      if (k && v) attractionImage[k] = v;
    }
  }
  console.log('attractionImage entries:', Object.keys(attractionImage).length);
}

// Extract zoneAliases (lines 279-289)
const zoneAliases = {};
const zoneAliasesMatch = content.match(/const zoneAliases = ({[^;]+});/s);
if (zoneAliasesMatch) {
  const zoneAliasesContent = zoneAliasesMatch[1];
  const lines = zoneAliasesContent.replace('{', '').replace('}', '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':', 2);
      const k = key.trim().replace(/['"]/g, '');
      const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
      if (k && v) zoneAliases[k] = v;
    }
  }
  console.log('zoneAliases entries:', Object.keys(zoneAliases).length);
}

// Extract zonePatterns (lines 291-306)
const zonePatterns = {};
const zonePatternsMatch = content.match(/const zonePatterns = ({[^;]+});/s);
if (zonePatternsMatch) {
  const zonePatternsContent = zonePatternsMatch[1];
  const lines = zonePatternsContent.replace('{', '').replace('}', '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':', 2);
      const k = key.trim().replace(/['"]/g, '');
      const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
      if (k && v) zonePatterns[k] = v;
    }
  }
  console.log('zonePatterns entries:', Object.keys(zonePatterns).length);
}

// Extract attrCategoryArrays (lines 224-231)
const attrCategoryArrays = {};
const attrCategoryArraysMatch = content.match(/const attrCategoryArrays = ({[^;]+});/s);
if (attrCategoryArraysMatch) {
  const attrCategoryArraysContent = attrCategoryArraysMatch[1];
  const lines = attrCategoryArraysContent.replace('{', '').replace('}', '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':', 2);
      const k = key.trim().replace(/['"]/g, '');
      const v = value.trim().replace(/['"]/g, '').replace(/,/g, '');
      if (k && v) attrCategoryArrays[k] = v;
    }
  }
  console.log('attrCategoryArrays entries:', Object.keys(attrCategoryArrays).length);
}

// Create mappings object
const mappings = {
  slugMap: slugMap,
  zoneImage: zoneImage,
  attractionImage: attractionImage,
  zoneAliases: zoneAliases,
  zonePatterns: zonePatterns,
  attrCategoryArrays: attrCategoryArrays
};

// Write to JSON file
const outputPath = path.join(__dirname, 'eleventy_mappings.json');
fs.writeFileSync(outputPath, JSON.stringify(mappings, null, 2));
console.log(`\nMappings saved to ${outputPath}`);