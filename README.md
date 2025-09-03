# Dark Store Rack Optimizer - Website

This is the web interface for the Dark Store Rack Placement Optimizer, an industry-level tool for optimal dark store rack placement with comprehensive scoring and visualization.

## 🌐 Live Website

Visit the live website at: https://satvikbajpai.github.io/ds_layout/

## Features

### Interactive Optimizer
- Real-time rack placement optimization
- Configurable store dimensions (10-50m)
- Multiple rack types with different specifications
- Constraint handling (office, exit, utility, pillars)
- Live visualization with SVG rendering

### Comprehensive Documentation
- **Detailed Specifications**: Complete rack dimensions and capacities
- **Industry Standards**: Aisle widths, safety requirements, performance benchmarks
- **Optimization Methodology**: Scoring algorithm breakdown with weights
- **Assumptions & Limitations**: Transparent about system constraints

### Professional Design
- Responsive layout for all devices
- Interactive animations and transitions
- Industry-grade color scheme and typography
- Professional data visualization

## Rack Specifications

| Rack Type | Width | Height | Capacity | Color Code |
|-----------|-------|--------|----------|------------|
| **Standard** | 1.2m | 2.4m | 200 units | #4CAF50 (Green) |
| **High-Density** | 0.8m | 3.0m | 300 units | #2196F3 (Blue) |
| **Freezer** | 1.5m | 2.0m | 150 units | #00BCD4 (Cyan) |
| **Bulk Storage** | 2.0m | 1.5m | 100 units | #FF9800 (Orange) |

## Optimization Algorithm

The scoring system uses a weighted approach:

- **Layout Efficiency (30%)**: Rack area utilization ratio
- **Accessibility Score (25%)**: Distance to entrance/loading dock
- **Workflow Score (25%)**: Grid regularity and arrangement patterns
- **Density Score (20%)**: Space utilization within rack clusters

## Safety & Industry Standards

### Aisle Requirements
- **Minimum Aisle Width**: 1.8 meters
- **Main Aisle Width**: 2.5 meters  
- **Safety Clearance**: 0.5 meters
- **Optimal Aisle Ratio**: 30-40% of total floor space

### Compliance Standards
- OSHA warehouse safety requirements
- International dark store best practices
- Based on Amazon, Instacart, and Ocado operations
- Emergency egress and fire safety compliance

## Technical Implementation

### Frontend Stack
- **HTML5**: Semantic structure with accessibility features
- **CSS3**: Modern grid layout with animations and responsive design
- **Vanilla JavaScript**: Real-time optimization engine
- **SVG**: Scalable vector graphics for layout visualization

### Core JavaScript Classes
- `RackOptimizer`: Main optimization engine
- Constraint validation system
- Grid-based placement algorithm
- Real-time scoring calculations

### Optimization Features
- Grid-based rack placement (2m × 2m grid)
- Rectangle overlap detection
- Aisle width validation
- Distance-based scoring
- Variance calculation for workflow assessment

## File Structure

```
ds_layout/
├── index.html          # Main website structure
├── styles.css          # Complete styling and responsive design
├── optimizer.js        # JavaScript optimization engine
├── rack_optimizer.py   # Python backend reference
├── visualizer.py       # Python visualization tools
├── demo.py            # Python demo implementation
└── README.md          # This documentation
```

## Development

### Local Development
1. Clone the repository
2. Open `index.html` in a modern web browser
3. No build process required - uses vanilla JavaScript

### Deployment
The site is automatically deployed to GitHub Pages from the main branch.

## Browser Support

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance

- Optimization runs client-side in <100ms
- SVG rendering scales to any screen size  
- Responsive design for mobile, tablet, desktop
- No external dependencies required

## Industry Applications

Perfect for:
- Grocery fulfillment centers
- E-commerce dark stores
- Warehouse layout optimization
- Retail distribution centers
- Cold storage facilities

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with proper testing
4. Submit a pull request with detailed description

## License

Industry-level tool for educational and commercial use.

---

**Visit the live optimizer**: https://satvikbajpai.github.io/ds_layout/