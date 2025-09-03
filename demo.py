#!/usr/bin/env python3
"""
Demo script showcasing the Dark Store Rack Optimizer
"""

from rack_optimizer import *
from visualizer import LayoutVisualizer, create_detailed_report
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend


def main():
    print("🏪 DARK STORE RACK PLACEMENT OPTIMIZER DEMO")
    print("=" * 60)
    
    # Create sample layout
    layout = create_sample_layout()
    print(f"📐 Layout: {layout.dimensions.width}m × {layout.dimensions.height}m")
    print(f"📍 Constraints: {len(layout.constraints)} (office, exit, utility, pillar)")
    
    # Initialize optimizer
    optimizer = RackOptimizer()
    
    # Create different rack configurations for comparison
    configurations = [
        {
            'name': 'Standard Configuration',
            'racks': optimizer.create_standard_racks(20, RackType.STANDARD) + 
                    optimizer.create_standard_racks(5, RackType.FREEZER) + 
                    optimizer.create_standard_racks(5, RackType.BULK)
        },
        {
            'name': 'High Density Configuration', 
            'racks': optimizer.create_standard_racks(25, RackType.HIGH_DENSITY) +
                    optimizer.create_standard_racks(3, RackType.FREEZER) +
                    optimizer.create_standard_racks(2, RackType.BULK)
        },
        {
            'name': 'Mixed Configuration',
            'racks': optimizer.create_standard_racks(12, RackType.STANDARD) +
                    optimizer.create_standard_racks(8, RackType.HIGH_DENSITY) +
                    optimizer.create_standard_racks(6, RackType.FREEZER) +
                    optimizer.create_standard_racks(4, RackType.BULK)
        }
    ]
    
    results = []
    
    for i, config in enumerate(configurations, 1):
        print(f"\n🔄 Testing Configuration {i}: {config['name']}")
        print(f"   Racks: {len(config['racks'])} total")
        
        # Get rack type breakdown
        rack_counts = {}
        for rack in config['racks']:
            rack_counts[rack.rack_type] = rack_counts.get(rack.rack_type, 0) + 1
        
        breakdown = ', '.join([f"{count} {rtype.value}" for rtype, count in rack_counts.items()])
        print(f"   Types: {breakdown}")
        
        # Optimize placement
        solution = optimizer.optimize_placement(layout, config['racks'].copy())
        results.append({
            'name': config['name'],
            'solution': solution,
            'config': config
        })
        
        print(f"   📊 Score: {solution.score:.1f}/100")
        print(f"   📦 Placed: {len(solution.racks)}/{len(config['racks'])}")
        print(f"   📏 Efficiency: {solution.layout_efficiency:.1%}")
    
    # Find best solution
    best_result = max(results, key=lambda x: x['solution'].score)
    
    print(f"\n🏆 BEST CONFIGURATION: {best_result['name']}")
    print("=" * 50)
    
    best_solution = best_result['solution']
    
    print(f"🎯 Overall Score: {best_solution.score:.1f}/100")
    print(f"📦 Racks Placed: {len(best_solution.racks)}")
    print(f"📊 Performance Breakdown:")
    print(f"   • Layout Efficiency: {best_solution.layout_efficiency:.1%}")
    print(f"   • Accessibility: {best_solution.accessibility_score:.1%}")
    print(f"   • Workflow: {best_solution.workflow_score:.1%}")
    
    print(f"\n📈 Key Metrics:")
    for key, value in best_solution.metrics.items():
        if isinstance(value, float):
            if 'distance' in key:
                print(f"   • {key.replace('_', ' ').title()}: {value:.2f}m")
            elif any(x in key for x in ['utilization', 'efficiency']):
                print(f"   • {key.replace('_', ' ').title()}: {value:.1%}")
            else:
                print(f"   • {key.replace('_', ' ').title()}: {value:.2f}")
        else:
            print(f"   • {key.replace('_', ' ').title()}: {value:,}")
    
    # Generate visualization and reports
    print(f"\n📋 Generating Reports...")
    
    visualizer = LayoutVisualizer()
    
    # Save visualization (without showing)
    visualizer.visualize_solution(
        best_solution, 
        layout, 
        save_path='best_optimization_results.png',
        show_plot=False
    )
    
    # Export data
    visualizer.export_solution_data(best_solution, layout, 'best_solution_data.json')
    
    # Generate detailed report
    report = create_detailed_report(best_solution, layout)
    with open('detailed_optimization_report.txt', 'w') as f:
        f.write(report)
    
    print(f"✅ Files generated:")
    print(f"   📊 best_optimization_results.png - Visual layout")
    print(f"   📄 detailed_optimization_report.txt - Full report")
    print(f"   📋 best_solution_data.json - Raw data export")
    
    # Show rack positions for the first few racks
    print(f"\n🗺️  SAMPLE RACK POSITIONS:")
    print("-" * 30)
    for i, rack in enumerate(best_solution.racks[:8]):
        if rack.position:
            print(f"{rack.id}: ({rack.position.x:.1f}, {rack.position.y:.1f}) "
                  f"[{rack.dimensions.width}×{rack.dimensions.height}m] "
                  f"Capacity: {rack.capacity}")
    
    if len(best_solution.racks) > 8:
        print(f"... and {len(best_solution.racks) - 8} more racks")
    
    print(f"\n🎉 Optimization Complete!")
    print(f"The tool has successfully generated an optimized rack layout with a score of {best_solution.score:.1f}/100")
    
    return best_solution


if __name__ == "__main__":
    main()