#!/usr/bin/env python3
"""
Hotel Photo Analysis Script

This script analyzes hotels.json to:
1. Identify all hotels needing photos
2. Group by type for prioritized fetching
3. Generate a comprehensive plan for photo acquisition
4. Create metadata for tracking
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime

def load_hotels():
    """Load hotels.json and return the data"""
    with open('src/data/hotels.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    hotels = data['hotels'] if isinstance(data, dict) else data
    return hotels

def categorize_hotels(hotels):
    """Categorize hotels by photo complexity and priority"""
    categories = {
        'simple': [],      # Standard hotels, likely one hotel photo
        'complex': [],     # Luxury resorts, multiple photo requirements
        'unique': [],      # Hotels with unique selling points
        'chain': [],       # Chain hotels with standardized imagery
        'island': [],      # Island/private properties
    }

    for hotel in hotels:
        name = hotel['name'].lower()
        category = hotel['category'].lower()
        zone = hotel['zone'].lower()

        # Simple hotels
        if any(keyword in name or keyword in category
               for keyword in ['hotel', 'guesthouse', 'b&b', 'lodge']):
            categories['simple'].append(hotel)

        # Complex hotels
        elif any(keyword in category or 'luxury' in category
                 for keyword in ['resort', 'luxury boutique']):
            categories['complex'].append(hotel)

        # Unique hotels
        elif any(phrase in name
                 for phrase in ['&beyond', 'penthouse', 'villa', 'private']):
            categories['unique'].append(hotel)

        # Chain hotels
        elif any(site in name.lower() or 'andbeyond' in hotel.get('website_domain', '').lower()
                 for site in ['sandals', 'beaches', 'cs', 'club']):
            categories['chain'].append(hotel)

        # Island properties
        elif 'island' in name or 'private island' in category:
            categories['island'].append(hotel)

        else:
            categories['simple'].append(hotel)

    return categories

def generate_photo_plan(categories):
    """Generate photo acquisition plan by category"""
    plan = {}

    for category, hotels in categories.items():
        plan[category] = []
        for hotel in hotels:
            plan[category].append({
                'name': hotel['name'],
                'id': hotel['id'],
                'slug': hotel['slug'],
                'zone': hotel['zone'],
                'category': hotel['category'],
                'website': hotel['website'],
                'website_domain': hotel['website_domain'],
                'photo_requirements': determine_photo_requirements(hotel),
                'priority': determine_priority(hotel),
                'estimated_time': estimate_photos_time(hotel)
            })

    return plan

def determine_photo_requirements(hotel):
    """Determine specific photo requirements for a hotel"""
    name = hotel['name'].lower()
    category = hotel['category'].lower()

    requirements = []

    # Check hotel type
    if 'resort' in category or 'luxury' in category:
        requirements.extend([
            'exterior facade',
            'lobby/interior',
            'pool area',
            'room view',
            'beach access'
        ])
    elif 'boutique' in category:
        requirements.extend([
            'facade',
            'interior detail',
            'signature feature'
        ])

    # Check hotel name for special requirements
    if 'private island' in name or 'island' in name:
        requirements.append('island exterior aerial view')
    if 'villa' in name:
        requirements.append('villa exterior and pool')

    # Default requirements
    if not requirements:
        requirements.extend([
            'exterior facade',
            'lobby/interior',
            'room view'
        ])

    return requirements

def determine_priority(hotel):
    """Determine priority level for photo acquisition"""
    name = hotel['name'].lower()
    zone = hotel['zone'].lower()

    # High priority - major zones, luxury properties
    if any(zone in ['stone town', 'nungwi', 'paje'] for zone in zone.split()):
        return 'high'
    elif 'andbeyond' in hotel.get('website_domain', '').lower():
        return 'high'
    elif 'luxury' in hotel['category'].lower():
        return 'medium'
    else:
        return 'low'

def estimate_photos_time(hotel):
    """Estimate time needed for photo acquisition"""
    category = hotel['category'].lower()

    if 'resort' in category:
        return 5  # 5 photos needed
    elif 'luxury' in category:
        return 3  # 3 photos needed
    elif 'hotel' in category:
        return 2  # 2 photos needed
    else:
        return 1  # 1 photo needed

def check_existing_images(plan):
    """Check which hotels already have images in the system"""
    all_images = []
    try:
        images_dir = Path('dist/images')
        if images_dir.exists():
            all_images = [f.name for f in images_dir.glob('*.jpg') if f.name != 'default-tour-hero.jpg']
    except:
        pass

    need_photos = []
    have_photos = []

    for category, hotels in plan.items():
        for hotel in hotels:
            # Check if hotel has images in the system
            # This is a simplified check - in reality we'd need to check the mapping logic
            if any(hotel['name'].split()[:2] in img.replace('_', ' ').split()[:2]
                   for img in all_images if len(img.split('_')) > 2):
                have_photos.append(hotel)
            else:
                need_photos.append(hotel)

    return need_photos, have_photos

def create_metadata(plan):
    """Create metadata for photo tracking"""
    metadata = {
        'generated': datetime.now().isoformat(),
        'total_hotels': len([h for cat in plan.values() for h in cat]),
        'by_category': {},
        'priorities': defaultdict(list),
        'zones': defaultdict(list)
    }

    for category, hotels in plan.items():
        metadata['by_category'][category] = len(hotels)

        for hotel in hotels:
            metadata['priorities'][hotel['priority']].append(hotel['name'])
            metadata['zones'][hotel['zone']].append(hotel['name'])

    return metadata

def generate_report(plan, metadata, need_photos, have_photos):
    """Generate a comprehensive report"""
    report = f"""# Hotel Photo Acquisition Report

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Total Hotels:** {metadata['total_hotels']}
**Hotels Needing Photos:** {len(need_photos)}
**Hotels Already Mapped:** {len(have_photos)}

## Summary by Category

"""

    for category, count in metadata['by_category'].items():
        report += f"- **{category.title()}:** {count} hotels\n"

    report += "\n## Priority Breakdown\n"
    for priority, hotels in metadata['priorities'].items():
        report += f"- **{priority.title()}:** {len(hotels)} hotels\n"

    report += "\n## Top Zones by Hotel Count\n"
    for zone, hotels in sorted(metadata['zones'].items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        report += f"- **{zone}:** {len(hotels)} hotels\n"

    report += "\n## Hotels Needing Photos (First 20)" + "\n"
    for hotel in need_photos[:20]:
        report += f"1. **{hotel['name']}** (ID: {hotel['id']}) - {hotel['category']} - {hotel['zone']}\n"
        report += f"   - Website: {hotel['website']}\n"
        report += f"   - Requirements: {', '.join(hotel['photo_requirements'][:3])}...\n"
        report += f"   - Priority: {hotel['priority']}\n\n"

    if len(need_photos) > 20:
        report += f"... and {len(need_photos) - 20} more hotels\n\n"

    report += """
## Recommendations

1. **Immediate Action:** Focus on hotels in Stone Town, Nungwi, and Paje zones (high priority)
2. **Chain Hotels:** Process &Beyond properties first (consistent photo style)
3. **Luxury Properties:** Prioritize luxury resorts and boutiques for better visual impact
4. **Source Strategy:** Use hotel websites, booking platforms, and Google Street View where appropriate
5. **Timeline:** Estimated completion: 2-3 weeks for all photos

## Next Steps

1. Create photo acquisition spreadsheet with hotel details
2. Develop automated script to download photos from hotel websites
3. Manual verification and quality control process
4. Update hotels.json with photo fields
5. Test system integration
"""

    return report

def main():
    """Main execution function"""
    print("Loading hotels.json...")
    hotels = load_hotels()

    print("Categorizing hotels...")
    categories = categorize_hotels(hotels)

    print("Generating photo plan...")
    plan = generate_photo_plan(categories)

    print("Creating metadata...")
    metadata = create_metadata(plan)

    print("Checking existing images...")
    need_photos, have_photos = check_existing_images(plan)

    print("Generating report...")
    report = generate_report(plan, metadata, need_photos, have_photos)

    # Write report to file
    with open('hotel-photo-analysis-report.md', 'w', encoding='utf-8') as f:
        f.write(report)

    # Write plan to JSON for further processing
    plan_json = {
        'metadata': metadata,
        'plan': {cat: hotels for cat, hotels in plan.items()}
    }

    with open('hotel-photo-plan.json', 'w', encoding='utf-8') as f:
        json.dump(plan_json, f, indent=2)

    print("\n" + "="*60)
    print("ANALYSIS COMPLETE")
    print("="*60)
    print(f"Total hotels analyzed: {len(hotels)}")
    print(f"Hotels needing photos: {len(need_photos)}")
    print(f"Hotels already mapped: {len(have_photos)}")
    print(f"Report written to: hotel-photo-analysis-report.md")
    print(f"Plan written to: hotel-photo-plan.json")
    print("="*60)

if __name__ == "__main__":
    main()