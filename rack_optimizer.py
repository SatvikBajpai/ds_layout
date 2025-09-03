#!/usr/bin/env python3
"""
Dark Store Rack Placement Optimizer
Industry-level tool for optimal rack placement with scoring
"""

import math
import json
from typing import List, Tuple, Dict, Optional, NamedTuple
from dataclasses import dataclass
from enum import Enum
import itertools


class RackType(Enum):
    STANDARD = "standard"
    HIGH_DENSITY = "high_density"
    FREEZER = "freezer"
    BULK = "bulk"


@dataclass
class Dimensions:
    width: float
    height: float
    
    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass
class Position:
    x: float
    y: float
    rotation: float = 0.0  # degrees


@dataclass
class Rack:
    id: str
    dimensions: Dimensions
    rack_type: RackType
    capacity: int
    position: Optional[Position] = None
    
    @property
    def footprint_area(self) -> float:
        return self.dimensions.area


@dataclass
class Constraint:
    name: str
    position: Position
    dimensions: Dimensions
    constraint_type: str  # 'exit', 'utility', 'pillar', 'office'


@dataclass
class Layout:
    dimensions: Dimensions
    constraints: List[Constraint]
    entrance_position: Position
    loading_dock_position: Position


@dataclass
class PlacementSolution:
    racks: List[Rack]
    score: float
    metrics: Dict[str, float]
    layout_efficiency: float
    accessibility_score: float
    workflow_score: float


class RackOptimizer:
    def __init__(self):
        # Standard rack dimensions (in meters)
        self.rack_specs = {
            RackType.STANDARD: Dimensions(1.2, 2.4),
            RackType.HIGH_DENSITY: Dimensions(0.8, 3.0),
            RackType.FREEZER: Dimensions(1.5, 2.0),
            RackType.BULK: Dimensions(2.0, 1.5)
        }
        
        # Minimum aisle widths (in meters)
        self.min_aisle_width = 1.8
        self.main_aisle_width = 2.5
        self.safety_clearance = 0.5
        
    def create_standard_racks(self, count: int, rack_type: RackType = RackType.STANDARD) -> List[Rack]:
        """Generate standard racks for placement"""
        racks = []
        capacity_map = {
            RackType.STANDARD: 200,
            RackType.HIGH_DENSITY: 300,
            RackType.FREEZER: 150,
            RackType.BULK: 100
        }
        
        for i in range(count):
            rack = Rack(
                id=f"{rack_type.value}_{i+1}",
                dimensions=self.rack_specs[rack_type],
                rack_type=rack_type,
                capacity=capacity_map[rack_type]
            )
            racks.append(rack)
        
        return racks
    
    def is_valid_placement(self, rack: Rack, position: Position, layout: Layout, placed_racks: List[Rack]) -> bool:
        """Check if rack placement is valid"""
        # Check bounds
        if (position.x < 0 or position.y < 0 or 
            position.x + rack.dimensions.width > layout.dimensions.width or
            position.y + rack.dimensions.height > layout.dimensions.height):
            return False
        
        # Check constraints
        for constraint in layout.constraints:
            if self._overlaps(
                position, rack.dimensions,
                constraint.position, constraint.dimensions
            ):
                return False
        
        # Check collision with other racks
        for placed_rack in placed_racks:
            if placed_rack.position and self._overlaps(
                position, rack.dimensions,
                placed_rack.position, placed_rack.dimensions
            ):
                return False
        
        # Check aisle requirements
        if not self._has_adequate_aisles(rack, position, placed_racks):
            return False
        
        return True
    
    def _overlaps(self, pos1: Position, dim1: Dimensions, pos2: Position, dim2: Dimensions) -> bool:
        """Check if two rectangles overlap"""
        return not (pos1.x + dim1.width <= pos2.x or 
                   pos2.x + dim2.width <= pos1.x or
                   pos1.y + dim1.height <= pos2.y or 
                   pos2.y + dim2.height <= pos1.y)
    
    def _has_adequate_aisles(self, rack: Rack, position: Position, placed_racks: List[Rack]) -> bool:
        """Check if rack has adequate aisle space"""
        min_clearance = self.min_aisle_width
        
        for placed_rack in placed_racks:
            if not placed_rack.position:
                continue
                
            # Check horizontal clearance
            if (abs(position.y - placed_rack.position.y) < max(rack.dimensions.height, placed_rack.dimensions.height) and
                abs(position.x - placed_rack.position.x) < rack.dimensions.width + placed_rack.dimensions.width + min_clearance):
                return False
            
            # Check vertical clearance  
            if (abs(position.x - placed_rack.position.x) < max(rack.dimensions.width, placed_rack.dimensions.width) and
                abs(position.y - placed_rack.position.y) < rack.dimensions.height + placed_rack.dimensions.height + min_clearance):
                return False
        
        return True
    
    def calculate_score(self, solution: List[Rack], layout: Layout) -> PlacementSolution:
        """Calculate comprehensive score for rack arrangement"""
        total_rack_area = sum(rack.footprint_area for rack in solution)
        layout_area = layout.dimensions.area
        
        # Layout efficiency (rack area / total area)
        layout_efficiency = total_rack_area / layout_area
        
        # Accessibility score (distance to entrance/loading dock)
        accessibility_score = self._calculate_accessibility(solution, layout)
        
        # Workflow score (rack arrangement optimization)
        workflow_score = self._calculate_workflow_efficiency(solution)
        
        # Density score (how well space is utilized)
        density_score = self._calculate_density_score(solution, layout)
        
        # Final weighted score
        final_score = (
            layout_efficiency * 0.3 +
            accessibility_score * 0.25 +
            workflow_score * 0.25 +
            density_score * 0.2
        ) * 100
        
        metrics = {
            'total_racks': len(solution),
            'total_capacity': sum(rack.capacity for rack in solution),
            'area_utilization': layout_efficiency,
            'average_distance_to_entrance': self._avg_distance_to_entrance(solution, layout),
            'average_distance_to_dock': self._avg_distance_to_dock(solution, layout),
            'aisle_efficiency': self._calculate_aisle_efficiency(solution, layout)
        }
        
        return PlacementSolution(
            racks=solution,
            score=final_score,
            metrics=metrics,
            layout_efficiency=layout_efficiency,
            accessibility_score=accessibility_score,
            workflow_score=workflow_score
        )
    
    def _calculate_accessibility(self, racks: List[Rack], layout: Layout) -> float:
        """Calculate accessibility score based on distances to key points"""
        if not racks:
            return 0.0
        
        entrance_distances = []
        dock_distances = []
        
        for rack in racks:
            if rack.position:
                # Distance to entrance
                entrance_dist = math.sqrt(
                    (rack.position.x - layout.entrance_position.x) ** 2 +
                    (rack.position.y - layout.entrance_position.y) ** 2
                )
                entrance_distances.append(entrance_dist)
                
                # Distance to loading dock
                dock_dist = math.sqrt(
                    (rack.position.x - layout.loading_dock_position.x) ** 2 +
                    (rack.position.y - layout.loading_dock_position.y) ** 2
                )
                dock_distances.append(dock_dist)
        
        # Lower average distances = higher score
        max_possible_distance = math.sqrt(layout.dimensions.width**2 + layout.dimensions.height**2)
        avg_entrance_dist = sum(entrance_distances) / len(entrance_distances)
        avg_dock_dist = sum(dock_distances) / len(dock_distances)
        
        entrance_score = 1.0 - (avg_entrance_dist / max_possible_distance)
        dock_score = 1.0 - (avg_dock_dist / max_possible_distance)
        
        return (entrance_score + dock_score) / 2
    
    def _calculate_workflow_efficiency(self, racks: List[Rack]) -> float:
        """Calculate workflow efficiency based on rack arrangement"""
        if len(racks) < 2:
            return 1.0
        
        # Check for grid-like arrangement
        positions = [(rack.position.x, rack.position.y) for rack in racks if rack.position]
        
        if len(positions) < 2:
            return 0.5
        
        # Calculate arrangement regularity
        x_coords = sorted(set(pos[0] for pos in positions))
        y_coords = sorted(set(pos[1] for pos in positions))
        
        # Grid regularity score
        grid_score = 0.0
        if len(x_coords) > 1 and len(y_coords) > 1:
            x_spacing_variance = self._calculate_spacing_variance([x_coords])
            y_spacing_variance = self._calculate_spacing_variance([y_coords])
            grid_score = 1.0 / (1.0 + x_spacing_variance + y_spacing_variance)
        
        return min(grid_score, 1.0)
    
    def _calculate_density_score(self, racks: List[Rack], layout: Layout) -> float:
        """Calculate how efficiently the space is used"""
        if not racks:
            return 0.0
        
        # Calculate bounding box of all racks
        positions = [rack.position for rack in racks if rack.position]
        if not positions:
            return 0.0
        
        min_x = min(pos.x for pos in positions)
        max_x = max(pos.x + rack.dimensions.width for rack, pos in zip(racks, positions) if pos)
        min_y = min(pos.y for pos in positions)
        max_y = max(pos.y + rack.dimensions.height for rack, pos in zip(racks, positions) if pos)
        
        used_area = (max_x - min_x) * (max_y - min_y)
        total_rack_area = sum(rack.footprint_area for rack in racks)
        
        if used_area == 0:
            return 0.0
        
        return total_rack_area / used_area
    
    def _calculate_spacing_variance(self, coord_lists: List[List[float]]) -> float:
        """Calculate variance in spacing between coordinates"""
        total_variance = 0.0
        for coords in coord_lists:
            if len(coords) < 2:
                continue
            spacings = [coords[i+1] - coords[i] for i in range(len(coords)-1)]
            if spacings:
                mean_spacing = sum(spacings) / len(spacings)
                variance = sum((s - mean_spacing)**2 for s in spacings) / len(spacings)
                total_variance += variance
        return total_variance
    
    def _avg_distance_to_entrance(self, racks: List[Rack], layout: Layout) -> float:
        """Calculate average distance to entrance"""
        distances = []
        for rack in racks:
            if rack.position:
                dist = math.sqrt(
                    (rack.position.x - layout.entrance_position.x) ** 2 +
                    (rack.position.y - layout.entrance_position.y) ** 2
                )
                distances.append(dist)
        return sum(distances) / len(distances) if distances else 0.0
    
    def _avg_distance_to_dock(self, racks: List[Rack], layout: Layout) -> float:
        """Calculate average distance to loading dock"""
        distances = []
        for rack in racks:
            if rack.position:
                dist = math.sqrt(
                    (rack.position.x - layout.loading_dock_position.x) ** 2 +
                    (rack.position.y - layout.loading_dock_position.y) ** 2
                )
                distances.append(dist)
        return sum(distances) / len(distances) if distances else 0.0
    
    def _calculate_aisle_efficiency(self, racks: List[Rack], layout: Layout) -> float:
        """Calculate efficiency of aisle usage"""
        if not racks:
            return 0.0
        
        total_area = layout.dimensions.area
        rack_area = sum(rack.footprint_area for rack in racks)
        aisle_area = total_area - rack_area
        
        # Ideal aisle ratio (industry standard ~30-40%)
        ideal_aisle_ratio = 0.35
        actual_aisle_ratio = aisle_area / total_area
        
        # Score based on how close to ideal
        efficiency = 1.0 - abs(actual_aisle_ratio - ideal_aisle_ratio) / ideal_aisle_ratio
        return max(0.0, efficiency)
    
    def optimize_placement(self, layout: Layout, racks: List[Rack], max_iterations: int = 1000) -> PlacementSolution:
        """Find optimal rack placement using greedy algorithm with local optimization"""
        best_solution = None
        best_score = 0.0
        
        # Grid-based placement strategy
        grid_x = int(layout.dimensions.width / (self.rack_specs[RackType.STANDARD].width + self.min_aisle_width))
        grid_y = int(layout.dimensions.height / (self.rack_specs[RackType.STANDARD].height + self.min_aisle_width))
        
        for attempt in range(min(max_iterations, 100)):  # Limit attempts for performance
            placed_racks = []
            
            # Try to place each rack
            for rack in racks:
                best_position = None
                best_local_score = -1
                
                # Try grid positions
                for i in range(grid_x):
                    for j in range(grid_y):
                        x = i * (rack.dimensions.width + self.min_aisle_width)
                        y = j * (rack.dimensions.height + self.min_aisle_width)
                        
                        position = Position(x, y)
                        
                        if self.is_valid_placement(rack, position, layout, placed_racks):
                            # Quick local score calculation
                            temp_rack = Rack(rack.id, rack.dimensions, rack.rack_type, rack.capacity, position)
                            temp_placed = placed_racks + [temp_rack]
                            local_score = self._quick_score(temp_placed, layout)
                            
                            if local_score > best_local_score:
                                best_local_score = local_score
                                best_position = position
                
                # Place rack at best found position
                if best_position:
                    rack.position = best_position
                    placed_racks.append(rack)
            
            # Calculate full solution score
            if placed_racks:
                solution = self.calculate_score(placed_racks, layout)
                if solution.score > best_score:
                    best_score = solution.score
                    best_solution = solution
        
        return best_solution or PlacementSolution([], 0.0, {}, 0.0, 0.0, 0.0)
    
    def _quick_score(self, racks: List[Rack], layout: Layout) -> float:
        """Quick scoring for intermediate evaluations"""
        if not racks:
            return 0.0
        
        total_area = sum(rack.footprint_area for rack in racks)
        layout_efficiency = total_area / layout.dimensions.area
        
        # Quick accessibility check
        avg_dist = sum(
            math.sqrt((rack.position.x - layout.entrance_position.x)**2 + 
                     (rack.position.y - layout.entrance_position.y)**2)
            for rack in racks if rack.position
        ) / len(racks)
        
        max_dist = math.sqrt(layout.dimensions.width**2 + layout.dimensions.height**2)
        accessibility = 1.0 - (avg_dist / max_dist)
        
        return (layout_efficiency * 0.6 + accessibility * 0.4) * 100


def create_sample_layout() -> Layout:
    """Create a sample dark store layout for testing"""
    layout = Layout(
        dimensions=Dimensions(20.0, 30.0),  # 20m x 30m store
        constraints=[
            Constraint("office", Position(0, 0), Dimensions(4, 4), "office"),
            Constraint("exit", Position(18, 0), Dimensions(2, 2), "exit"),
            Constraint("utility", Position(0, 26), Dimensions(3, 4), "utility"),
            Constraint("pillar1", Position(10, 15), Dimensions(0.5, 0.5), "pillar"),
        ],
        entrance_position=Position(19, 1),
        loading_dock_position=Position(1, 29)
    )
    return layout


def main():
    """Main execution function"""
    print("Dark Store Rack Placement Optimizer")
    print("=" * 50)
    
    # Create sample layout and racks
    layout = create_sample_layout()
    optimizer = RackOptimizer()
    
    # Create mix of rack types
    racks = (
        optimizer.create_standard_racks(15, RackType.STANDARD) +
        optimizer.create_standard_racks(8, RackType.HIGH_DENSITY) +
        optimizer.create_standard_racks(4, RackType.FREEZER) +
        optimizer.create_standard_racks(3, RackType.BULK)
    )
    
    print(f"Layout: {layout.dimensions.width}m x {layout.dimensions.height}m")
    print(f"Total racks to place: {len(racks)}")
    print(f"Rack types: {len([r for r in racks if r.rack_type == RackType.STANDARD])} standard, "
          f"{len([r for r in racks if r.rack_type == RackType.HIGH_DENSITY])} high-density, "
          f"{len([r for r in racks if r.rack_type == RackType.FREEZER])} freezer, "
          f"{len([r for r in racks if r.rack_type == RackType.BULK])} bulk")
    
    print("\nOptimizing placement...")
    solution = optimizer.optimize_placement(layout, racks)
    
    print(f"\n🏆 OPTIMIZATION RESULTS")
    print("=" * 50)
    print(f"Overall Score: {solution.score:.1f}/100")
    print(f"Racks Placed: {len(solution.racks)}/{len(racks)}")
    print(f"Layout Efficiency: {solution.layout_efficiency:.1%}")
    print(f"Accessibility Score: {solution.accessibility_score:.1%}")
    print(f"Workflow Score: {solution.workflow_score:.1%}")
    
    print(f"\n📊 DETAILED METRICS")
    print("=" * 30)
    for key, value in solution.metrics.items():
        if isinstance(value, float):
            if key.endswith('_distance'):
                print(f"{key.replace('_', ' ').title()}: {value:.2f}m")
            elif key.endswith('_utilization') or key.endswith('_efficiency'):
                print(f"{key.replace('_', ' ').title()}: {value:.1%}")
            else:
                print(f"{key.replace('_', ' ').title()}: {value:.2f}")
        else:
            print(f"{key.replace('_', ' ').title()}: {value}")
    
    print(f"\n🗺️  PLACEMENT MAP")
    print("=" * 30)
    for i, rack in enumerate(solution.racks[:10]):  # Show first 10 racks
        if rack.position:
            print(f"{rack.id}: ({rack.position.x:.1f}, {rack.position.y:.1f}) "
                  f"[{rack.dimensions.width}x{rack.dimensions.height}m]")
    
    if len(solution.racks) > 10:
        print(f"... and {len(solution.racks) - 10} more racks")
    
    return solution


if __name__ == "__main__":
    main()