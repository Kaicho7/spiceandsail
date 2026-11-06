const fs = require('fs');
const path = require('path');

// Read existing image-metadata.json
const existing = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'image-metadata.json'), 'utf8'));
// Read personal photo metadata
const personal = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'personal-photo-metadata.json'), 'utf8'));
// Read stock photo metadata
const stock = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'stock-photo-metadata.json'), 'utf8'));

// Combine all images
const allImages = [
  ...existing.images,
  ...personal.images,
  ...stock.images
];

const combined = {
  images: allImages,
  metadata: {
    total_images: allImages.length,
    date_created: new Date().toISOString().split('T')[0],
    source: 'Combined: Original 15 SEO images + 85 Personal 2020 photos + 302 Stock images (Unsplash/Pexels/Pixabay)',
    purpose: 'Complete SEO-optimized image library for Dhow Coast Travels tourism website',
    categories_covered: [...new Set(allImages.map(i => i.category))],
    optimization_schedule: 'Convert to WebP and AVIF formats, implement responsive srcset, add to sitemap',
    next_steps: [
      'Convert all images to WebP/AVIF formats',
      'Implement image tags in Nunjucks templates with proper alt text',
      'Add structured data image metadata to tour/area pages',
      'Create image sitemap for SEO',
      'Set up responsive srcset for all hero and content images',
      'Integrate personal photos into key page heroes for authenticity'
    ],
    breakdown: {
      original_seo: existing.images.length,
      personal_2020: personal.images.length,
      stock_royalty_free: stock.images.length
    }
  }
};

fs.writeFileSync(
  path.join(__dirname, 'complete-image-metadata.json'),
  JSON.stringify(combined, null, 2)
);

console.log(`Total combined images: ${allImages.length}`);
console.log('Categories covered:', combined.metadata.categories_covered.length);
console.log('Breakdown:', combined.metadata.breakdown);
