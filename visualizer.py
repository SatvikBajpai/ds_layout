#!/usr/bin/env python3
"""
Dark Store Layout Visualizer
Creates visual representations of optimized rack placements
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.colors import ListedColormap
import numpy as np
from rack_optimizer import Layout, Rack, RackType, PlacementSolution, Position
import json
from typing import List, Dict, Tuple


class LayoutVisualizer:
    def __init__(self):
        self.rack_colors = {
            RackType.STANDARD: '#4CAF50',      # Green
            RackType.HIGH_DENSITY: '#2196F3',  # Blue  
            RackType.FREEZER: '#00BCD4',       # Cyan
            RackType.BULK: '#FF9800'           # Orange
        }
        self.constraint_colors = {
            'office': '#9C27B0',    # Purple
            'exit': '#F44336',      # Red
            'utility': '#795548',   # Brown
            'pillar': '#424242'     # Dark Gray
        }
    
    def visualize_solution(self, solution: PlacementSolution, layout: Layout, 
                          save_path: str = None, show_plot: bool = True) -> None:
        """Create a comprehensive visualization of the rack placement solution"""
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle(f'Dark Store Layout Optimization (Score: {solution.score:.1f}/100)', 
                    fontsize=16, fontweight='bold')
        
        # Main layout visualization
        self._plot_layout(ax1, solution, layout)
        ax1.set_title('Optimized Rack Placement')
        
        # Heatmap of accessibility
        self._plot_accessibility_heatmap(ax2, solution, layout)
        ax2.set_title('Accessibility Heatmap')
        
        # Score breakdown
        self._plot_score_breakdown(ax3, solution)
        ax3.set_title('Performance Metrics')
        
        # Rack type distribution
        self._plot_rack_distribution(ax4, solution)
        ax4.set_title('Rack Type Distribution')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"Visualization saved to: {save_path}")
        
        if show_plot:
            plt.show()
    
    def _plot_layout(self, ax, solution: PlacementSolution, layout: Layout):
        """Plot the main layout with racks and constraints"""
        ax.set_xlim(0, layout.dimensions.width)
        ax.set_ylim(0, layout.dimensions.height)
        ax.set_aspect('equal')
        
        # Draw layout boundary
        layout_rect = patches.Rectangle((0, 0), layout.dimensions.width, layout.dimensions.height,
                                       linewidth=3, edgecolor='black', facecolor='none')
        ax.add_patch(layout_rect)
        
        # Draw constraints
        for constraint in layout.constraints:
            color = self.constraint_colors.get(constraint.constraint_type, '#666666')
            constraint_rect = patches.Rectangle(
                (constraint.position.x, constraint.position.y),
                constraint.dimensions.width, constraint.dimensions.height,
                facecolor=color, edgecolor='black', alpha=0.7
            )
            ax.add_patch(constraint_rect)
            
            # Add label
            ax.text(constraint.position.x + constraint.dimensions.width/2,
                   constraint.position.y + constraint.dimensions.height/2,
                   constraint.name, ha='center', va='center', fontsize=8, color='white')
        
        # Draw entrance and loading dock
        entrance_marker = patches.Circle((layout.entrance_position.x, layout.entrance_position.y),
                                       0.5, facecolor='green', edgecolor='black')
        ax.add_patch(entrance_marker)
        ax.text(layout.entrance_position.x, layout.entrance_position.y + 1,
               'Entrance', ha='center', va='bottom', fontweight='bold')
        
        dock_marker = patches.Rectangle((layout.loading_dock_position.x - 1, layout.loading_dock_position.y - 1),
                                       2, 2, facecolor='orange', edgecolor='black')
        ax.add_patch(dock_marker)
        ax.text(layout.loading_dock_position.x, layout.loading_dock_position.y + 1.5,
               'Loading Dock', ha='center', va='bottom', fontweight='bold')
        
        # Draw racks
        for rack in solution.racks:
            if rack.position:
                color = self.rack_colors[rack.rack_type]
                rack_rect = patches.Rectangle(
                    (rack.position.x, rack.position.y),
                    rack.dimensions.width, rack.dimensions.height,
                    facecolor=color, edgecolor='black', alpha=0.8, linewidth=1
                )
                ax.add_patch(rack_rect)
                
                # Add rack ID
                ax.text(rack.position.x + rack.dimensions.width/2,
                       rack.position.y + rack.dimensions.height/2,
                       rack.id.split('_')[1], ha='center', va='center', 
                       fontsize=6, color='white', fontweight='bold')
        
        # Add legend
        legend_elements = []
        for rack_type, color in self.rack_colors.items():
            legend_elements.append(patches.Patch(color=color, label=rack_type.value.replace('_', ' ').title()))
        
        ax.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(1, 1))
        ax.set_xlabel('Width (m)')
        ax.set_ylabel('Height (m)')
        ax.grid(True, alpha=0.3)
    
    def _plot_accessibility_heatmap(self, ax, solution: PlacementSolution, layout: Layout):
        """Create accessibility heatmap showing distance to entrance and loading dock"""
        # Create grid for heatmap
        resolution = 50
        x = np.linspace(0, layout.dimensions.width, resolution)
        y = np.linspace(0, layout.dimensions.height, resolution)
        X, Y = np.meshgrid(x, y)
        
        # Calculate combined distance score for each point
        entrance_distances = np.sqrt((X - layout.entrance_position.x)**2 + (Y - layout.entrance_position.y)**2)
        dock_distances = np.sqrt((X - layout.loading_dock_position.x)**2 + (Y - layout.loading_dock_position.y)**2)
        
        # Normalize and combine (lower distance = higher score)
        max_dist = np.sqrt(layout.dimensions.width**2 + layout.dimensions.height**2)
        entrance_scores = 1 - (entrance_distances / max_dist)
        dock_scores = 1 - (dock_distances / max_dist)
        combined_scores = (entrance_scores + dock_scores) / 2
        
        # Create heatmap
        im = ax.imshow(combined_scores, extent=[0, layout.dimensions.width, 0, layout.dimensions.height],
                      cmap='RdYlGn', alpha=0.7, origin='lower')
        
        # Overlay rack positions
        for rack in solution.racks:
            if rack.position:
                ax.scatter(rack.position.x + rack.dimensions.width/2,
                          rack.position.y + rack.dimensions.height/2,
                          c='black', s=30, marker='s', alpha=0.8)
        
        # Add entrance and loading dock
        ax.scatter(layout.entrance_position.x, layout.entrance_position.y,
                  c='blue', s=100, marker='*', label='Entrance')
        ax.scatter(layout.loading_dock_position.x, layout.loading_dock_position.y,
                  c='orange', s=100, marker='D', label='Loading Dock')
        
        plt.colorbar(im, ax=ax, label='Accessibility Score')
        ax.set_xlabel('Width (m)')
        ax.set_ylabel('Height (m)')
        ax.legend()
    
    def _plot_score_breakdown(self, ax, solution: PlacementSolution):
        """Create bar chart of score components"""
        categories = ['Layout\nEfficiency', 'Accessibility', 'Workflow', 'Overall\nScore']
        scores = [
            solution.layout_efficiency * 100,
            solution.accessibility_score * 100,
            solution.workflow_score * 100,
            solution.score
        ]
        colors = ['#2196F3', '#4CAF50', '#FF9800', '#F44336']
        
        bars = ax.bar(categories, scores, color=colors, alpha=0.8)
        ax.set_ylim(0, 100)
        ax.set_ylabel('Score')
        ax.grid(True, alpha=0.3, axis='y')
        
        # Add value labels on bars
        for bar, score in zip(bars, scores):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                   f'{score:.1f}', ha='center', va='bottom', fontweight='bold')
    
    def _plot_rack_distribution(self, ax, solution: PlacementSolution):
        """Create pie chart of rack type distribution"""
        rack_counts = {}
        total_capacity = 0
        
        for rack in solution.racks:
            if rack.rack_type not in rack_counts:
                rack_counts[rack.rack_type] = {'count': 0, 'capacity': 0}
            rack_counts[rack.rack_type]['count'] += 1
            rack_counts[rack.rack_type]['capacity'] += rack.capacity
            total_capacity += rack.capacity
        
        # Prepare data for pie chart
        labels = []
        sizes = []
        colors = []
        
        for rack_type, data in rack_counts.items():
            labels.append(f"{rack_type.value.replace('_', ' ').title()}\n({data['count']} racks)")
            sizes.append(data['count'])
            colors.append(self.rack_colors[rack_type])
        
        # Create pie chart
        wedges, texts, autotexts = ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%',
                                         startangle=90, textprops={'fontsize': 10})
        
        # Add total capacity text
        ax.text(0, -1.3, f'Total Capacity: {total_capacity:,} units',
               ha='center', va='center', fontsize=12, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8))
    
    def export_solution_data(self, solution: PlacementSolution, layout: Layout, 
                           filename: str = 'solution_data.json'):
        """Export solution data to JSON for further analysis"""
        data = {
            'layout': {
                'dimensions': {
                    'width': layout.dimensions.width,
                    'height': layout.dimensions.height
                },
                'entrance': {
                    'x': layout.entrance_position.x,
                    'y': layout.entrance_position.y
                },
                'loading_dock': {
                    'x': layout.loading_dock_position.x,
                    'y': layout.loading_dock_position.y
                },
                'constraints': [
                    {
                        'name': c.name,
                        'type': c.constraint_type,
                        'position': {'x': c.position.x, 'y': c.position.y},
                        'dimensions': {'width': c.dimensions.width, 'height': c.dimensions.height}
                    } for c in layout.constraints
                ]
            },
            'solution': {
                'score': solution.score,
                'layout_efficiency': solution.layout_efficiency,
                'accessibility_score': solution.accessibility_score,
                'workflow_score': solution.workflow_score,
                'metrics': solution.metrics,
                'racks': [
                    {
                        'id': rack.id,
                        'type': rack.rack_type.value,
                        'capacity': rack.capacity,
                        'dimensions': {'width': rack.dimensions.width, 'height': rack.dimensions.height},
                        'position': {'x': rack.position.x, 'y': rack.position.y} if rack.position else None
                    } for rack in solution.racks
                ]
            }
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"Solution data exported to: {filename}")
        return data


def create_detailed_report(solution: PlacementSolution, layout: Layout) -> str:
    """Generate a detailed text report of the optimization results"""
    report = []
    report.append("DARK STORE RACK PLACEMENT OPTIMIZATION REPORT")
    report.append("=" * 60)
    report.append("")
    
    # Executive Summary
    report.append("EXECUTIVE SUMMARY")
    report.append("-" * 20)
    report.append(f"Overall Optimization Score: {solution.score:.1f}/100")
    report.append(f"Racks Successfully Placed: {len(solution.racks)}")
    report.append(f"Total Storage Capacity: {sum(rack.capacity for rack in solution.racks):,} units")
    report.append(f"Floor Space Utilization: {solution.layout_efficiency:.1%}")
    report.append("")
    
    # Performance Breakdown
    report.append("PERFORMANCE BREAKDOWN")
    report.append("-" * 25)
    report.append(f"• Layout Efficiency:    {solution.layout_efficiency:.1%}")
    report.append(f"• Accessibility Score:  {solution.accessibility_score:.1%}")
    report.append(f"• Workflow Efficiency:  {solution.workflow_score:.1%}")
    report.append("")
    
    # Detailed Metrics
    report.append("OPERATIONAL METRICS")
    report.append("-" * 20)
    for key, value in solution.metrics.items():
        display_key = key.replace('_', ' ').title()
        if isinstance(value, float):
            if 'distance' in key:
                report.append(f"• {display_key}: {value:.2f}m")
            elif any(x in key for x in ['utilization', 'efficiency']):
                report.append(f"• {display_key}: {value:.1%}")
            else:
                report.append(f"• {display_key}: {value:.2f}")
        else:
            report.append(f"• {display_key}: {value:,}")
    report.append("")
    
    # Rack Distribution
    report.append("RACK DISTRIBUTION")
    report.append("-" * 18)
    rack_types = {}
    for rack in solution.racks:
        if rack.rack_type not in rack_types:
            rack_types[rack.rack_type] = []
        rack_types[rack.rack_type].append(rack)
    
    for rack_type, racks in rack_types.items():
        total_capacity = sum(r.capacity for r in racks)
        avg_distance_entrance = np.mean([
            np.sqrt((r.position.x - layout.entrance_position.x)**2 + 
                   (r.position.y - layout.entrance_position.y)**2)
            for r in racks if r.position
        ]) if racks else 0
        
        report.append(f"• {rack_type.value.replace('_', ' ').title()}:")
        report.append(f"  - Count: {len(racks)} racks")
        report.append(f"  - Total Capacity: {total_capacity:,} units")
        report.append(f"  - Avg Distance to Entrance: {avg_distance_entrance:.1f}m")
    
    report.append("")
    
    # Recommendations
    report.append("RECOMMENDATIONS")
    report.append("-" * 15)
    
    if solution.score >= 80:
        report.append("✅ Excellent optimization achieved!")
        report.append("• Layout is highly efficient and well-optimized")
        report.append("• Consider this configuration for implementation")
    elif solution.score >= 60:
        report.append("⚠️  Good optimization with room for improvement:")
        if solution.layout_efficiency < 0.4:
            report.append("• Consider adding more racks to improve space utilization")
        if solution.accessibility_score < 0.6:
            report.append("• Relocate high-turnover racks closer to entrance/loading dock")
        if solution.workflow_score < 0.6:
            report.append("• Improve rack arrangement regularity for better workflow")
    else:
        report.append("❌ Optimization needs significant improvement:")
        report.append("• Review layout constraints and rack requirements")
        report.append("• Consider alternative rack configurations")
        report.append("• Evaluate if layout dimensions are appropriate")
    
    report.append("")
    report.append("Generated by Dark Store Rack Placement Optimizer")
    
    return "\n".join(report)


if __name__ == "__main__":
    # Example usage
    from rack_optimizer import main, create_sample_layout, RackOptimizer
    
    # Run optimization
    solution = main()
    
    # Create visualizer
    visualizer = LayoutVisualizer()
    layout = create_sample_layout()
    
    # Generate visualizations
    visualizer.visualize_solution(solution, layout, save_path='optimization_results.png')
    
    # Export data
    visualizer.export_solution_data(solution, layout, 'solution_data.json')
    
    # Generate report
    report = create_detailed_report(solution, layout)
    with open('optimization_report.txt', 'w') as f:
        f.write(report)
    
    print(report)