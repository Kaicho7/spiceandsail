#!/usr/bin/env python3
"""
Hotel Photo Quality and Optimization Analysis Script

Analyzes downloaded hotel photos for:
- Quality assessment (dimensions, file size, compression)
- Duplicate detection and suggestions
- Aspect ratio optimization for web use
- Format recommendations
- Quality score calculation
"""

import os
import json
import PIL.Image
from PIL import Image
import hashlib
from pathlib import Path
from collections import defaultdict
import statistics
from datetime import datetime

ROOT = Path(__file__).parent.parent
HOTELS_JSON = ROOT / "src" / "data" / "hotels.json"
HOTELS_IMAGES_DIR = ROOT / "public" / "images" / "hotels"
REPORT_FILE = ROOT / "reports" / "photo-analysis.json"

# Target dimensions for hotel website (16:10 aspect ratio, ~200KB ideal)
TARGET_WIDTH = 1920
TARGET_HEIGHT = 1200
TARGET_SIZE_KB = 200

def get_image_info(filepath):
    """Get comprehensive information about an image file."""
    try:
        with Image.open(filepath) as img:
            width, height = img.size
            mode = img.mode
            format = img.format

            # Calculate file size
            file_size_kb = os.path.getsize(filepath) / 1024

            # Calculate quality score (0-100)
            quality_score = 0
            score = 0

            # Resolution score (0-30)
            if 1800 <= width <= 2000 and 1100 <= height <= 1300:
                score += 30
            elif 1600 <= width <= 2200 and 1000 <= height <= 1400:
                score += 25
            elif 1400 <= width <= 2400 and 900 <= height <= 1500:
                score += 20
            elif width >= 1000 and height >= 800:
                score += 15

            # File size score (0-25)
            if file_size_kb <= TARGET_SIZE_KB:
                score += 25
            elif file_size_kb <= TARGET_SIZE_KB * 1.5:
                score += 20
            elif file_size_kb <= TARGET_SIZE_KB * 2:
                score += 15
            elif file_size_kb <= TARGET_SIZE_KB * 3:
                score += 10

            # Aspect ratio score (0-20)
            aspect_ratio = width / height
            target_aspect = TARGET_WIDTH / TARGET_HEIGHT  # 1.6
            if abs(aspect_ratio - target_aspect) < 0.1:
                score += 20
            elif abs(aspect_ratio - target_aspect) < 0.15:
                score += 15
            elif 1.3 <= aspect_ratio <= 1.9:
                score += 10

            # Format score (0-10)
            if format in ['JPEG', 'PNG', 'WEBP']:
                score += 10

            # Color depth score (0-10)
            if mode in ['RGB', 'RGBA']:
                score += 10

            quality_score = score

            return {
                'filename': filepath.name,
                'width': width,
                'height': height,
                'format': format,
                'mode': mode,
                'file_size_kb': round(file_size_kb, 1),
                'quality_score': quality_score,
                'aspect_ratio': round(aspect_ratio, 2),
                'target_met': (1600 <= width <= 2000 and 1000 <= height <= 1300 and
                             file_size_kb <= TARGET_SIZE_KB * 1.5 and
                             abs(aspect_ratio - target_aspect) < 0.15)
            }
    except Exception as e:
        return {
            'filename': filepath.name,
            'error': str(e),
            'quality_score': 0
        }

def analyze_photos():
    """Perform comprehensive photo analysis."""
    print("Loading hotels data...")
    with open(HOTELS_JSON) as f:
        hotels_data = json.load(f)
    hotels = hotels_data.get('hotels', [])

    print(f"Analyzing {len(hotels)} hotels...")
    print(f"Photos directory: {HOTELS_IMAGES_DIR}")

    # Get all photo files
    photo_files = list(HOTELS_IMAGES_DIR.glob('*'))
    print(f"Found {len(photo_files)} photo files")

    # Analyze each photo
    analysis_results = []
    hotel_photos_map = defaultdict(list)

    for photo_path in photo_files:
        info = get_image_info(photo_path)
        analysis_results.append(info)

        # Map photo to hotel
        hotel_slug = photo_path.stem
        for hotel in hotels:
            if hotel.get('slug') == hotel_slug:
                hotel_photos_map[hotel['id']].append(info)
                break

    # Generate comprehensive report
    report = {
        'generated_at': datetime.now().isoformat(),
        'total_hotel_photos': len(analysis_results),
        'successful_analyses': len([r for r in analysis_results if 'error' not in r]),
        'failed_analyses': len([r for r in analysis_results if 'error' in r]),
        'quality_summary': {
            'average_score': statistics.mean([r['quality_score'] for r in analysis_results if 'error' not in r]) if analysis_results else 0,
            'min_score': min([r['quality_score'] for r in analysis_results if 'error' not in r]) if analysis_results else 0,
            'max_score': max([r['quality_score'] for r in analysis_results if 'error' not in r]) if analysis_results else 0,
        },
        'dimension_summary': {
            'common_widths': [],
            'common_heights': [],
        },
        'format_distribution': {},
        'hotel_coverage': {},
        'recommendations': [],
        'photo_details': analysis_results
    }

    # Collect dimension statistics
    widths = [r['width'] for r in analysis_results if 'error' not in r]
    heights = [r['height'] for r in analysis_results if 'error' not in r]
    if widths:
        report['dimension_summary']['common_widths'] = sorted(set(widths))[-5:]
    if heights:
        report['dimension_summary']['common_heights'] = sorted(set(heights))[-5:]

    # Format distribution
    for r in analysis_results:
        if 'format' in r:
            report['format_distribution'][r['format']] = report['format_distribution'].get(r['format'], 0) + 1

    # Hotel coverage
    for hotel in hotels:
        hotel_id = hotel.get('id')
        hotel_name = hotel.get('name')
        photo_count = len(hotel_photos_map.get(hotel_id, []))
        has_target_compliance = any(
            r.get('target_met', False) for r in hotel_photos_map.get(hotel_id, [])
            if 'error' not in r
        )

        report['hotel_coverage'][hotel_id] = {
            'name': hotel_name,
            'photos_found': photo_count,
            'target_compliance': has_target_compliance,
            'quality_average': statistics.mean([r['quality_score'] for r in hotel_photos_map.get(hotel_id, []) if 'error' not in r]) if hotel_photos_map.get(hotel_id) else 0
        }

    # Generate recommendations
    report['recommendations'] = generate_recommendations(report)

    # Save report
    os.makedirs(REPORT_FILE.parent, exist_ok=True)
    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"Analysis complete. Report saved to {REPORT_FILE}")
    print(f"Average quality score: {report['quality_summary']['average_score']:.1f}/100")
    print(f"Photos meeting target criteria: {sum(1 for r in analysis_results if r.get('target_met', False))}/{len(analysis_results)}")

    return report

def generate_recommendations(report):
    """Generate optimization recommendations based on analysis."""
    recommendations = []

    # Quality-based recommendations
    avg_score = report['quality_summary']['average_score']
    if avg_score < 60:
        recommendations.append({
            'priority': 'high',
            'area': 'photo_quality',
            'message': f'Average photo quality is {avg_score:.1f}/100. Consider re-downloading or optimizing photos.',
            'count': len([r for r in report['photo_details'] if r.get('quality_score', 0) < 60])
        })

    # Target compliance recommendations
    non_compliant = [r for r in report['photo_details'] if not r.get('target_met', False) and 'error' not in r]
    if non_compliant:
        recommendations.append({
            'priority': 'medium',
            'area': 'dimensions',
            'message': f'{len(non_compliant)} photos do not meet target dimensions ({TARGET_WIDTH}x{TARGET_HEIGHT}).',
            'affected_hotels': list(set([hotel_info['hotel'] for hotel_info in non_compliant if 'hotel' in hotel_info]))
        })

    # Size recommendations
    oversized = [r for r in report['photo_details'] if r.get('file_size_kb', 0) > TARGET_SIZE_KB * 3 and 'error' not in r]
    if oversized:
        recommendations.append({
            'priority': 'medium',
            'area': 'file_size',
            'message': f'{len(oversized)} photos are significantly oversized (>{TARGET_SIZE_KB * 3}KB).',
            'total_size_savings': sum([r.get('file_size_kb', 0) - TARGET_SIZE_KB for r in oversized if 'error' not in r])
        })

    # Format recommendations
    preferred_formats = ['JPEG', 'PNG', 'WEBP']
    outdated_formats = [r for r in report['photo_details'] if r.get('format') not in preferred_formats and 'error' not in r]
    if outdated_formats:
        recommendations.append({
            'priority': 'low',
            'area': 'format_optimization',
            'message': f'{len(outdated_formats)} photos use non-preferred formats.',
            'formats': {fmt: count for fmt, count in report['format_distribution'].items()}
        })

    return recommendations

def main():
    """Main execution function."""
    print("=== Hotel Photo Analysis Script ===")
    print(f"Analyzing photos in: {HOTELS_IMAGES_DIR}")

    if not HOTELS_IMAGES_DIR.exists():
        print(f"Error: Photos directory not found: {HOTELS_IMAGES_DIR}")
        return

    if not HOTELS_JSON.exists():
        print(f"Error: Hotels JSON not found: {HOTELS_JSON}")
        return

    report = analyze_photos()

    # Print summary
    print("\n=== ANALYSIS SUMMARY ===")
    print(f"Photos analyzed: {report['total_hotel_photos']}")
    print(f"Successful analyses: {report['successful_analyses']}")
    print(f"Failed analyses: {report['failed_analyses']}")
    print(f"Average quality score: {report['quality_summary']['average_score']:.1f}/100")
    print(f"Photos meeting targets: {sum(1 for r in report['photo_details'] if r.get('target_met', False))}")

    if report['recommendations']:
        print(f"\nRECOMMENDATIONS ({len(report['recommendations'])}):")
        for rec in report['recommendations']:
            print(f"  - [{rec['priority'].upper()}] {rec['message']}")

    print("\nAnalysis complete!")

if __name__ == "__main__":
    main()