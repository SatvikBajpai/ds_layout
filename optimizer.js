// Dark Store Rack Optimizer JavaScript Implementation
class RackOptimizer {
    constructor() {
        this.rackSpecs = {
            standard: { width: 1.2, height: 2.4, capacity: 200, color: '#4CAF50' },
            'high-density': { width: 0.8, height: 3.0, capacity: 300, color: '#2196F3' },
            freezer: { width: 1.5, height: 2.0, capacity: 150, color: '#00BCD4' },
            bulk: { width: 2.0, height: 1.5, capacity: 100, color: '#FF9800' }
        };
        
        this.minAisleWidth = 1.8;
        this.mainAisleWidth = 2.5;
        this.safetyClearance = 0.5;
        
        this.constraints = [
            { name: 'office', position: { x: 0, y: 0 }, dimensions: { width: 4, height: 4 }, type: 'office', color: '#9C27B0' },
            { name: 'exit', position: { x: 18, y: 0 }, dimensions: { width: 2, height: 2 }, type: 'exit', color: '#F44336' },
            { name: 'utility', position: { x: 0, y: 26 }, dimensions: { width: 3, height: 4 }, type: 'utility', color: '#795548' },
            { name: 'pillar1', position: { x: 10, y: 15 }, dimensions: { width: 0.5, height: 0.5 }, type: 'pillar', color: '#424242' }
        ];
        
        this.entrance = { x: 19, y: 1 };
        this.loadingDock = { x: 1, y: 29 };
    }
    
    optimizeLayout(config) {
        const layout = {
            width: config.storeWidth,
            height: config.storeHeight,
            constraints: this.getActiveConstraints(config),
            entrance: this.entrance,
            loadingDock: this.loadingDock
        };
        
        const racks = this.generateRacks(config);
        const solution = this.placeRacks(racks, layout);
        
        return {
            racks: solution.racks,
            score: solution.score,
            metrics: solution.metrics,
            layout: layout
        };
    }
    
    getActiveConstraints(config) {
        const activeConstraints = [];
        
        if (config.officeConstraint) {
            activeConstraints.push(this.constraints.find(c => c.name === 'office'));
        }
        if (config.exitConstraint) {
            activeConstraints.push(this.constraints.find(c => c.name === 'exit'));
        }
        if (config.utilityConstraint) {
            activeConstraints.push(this.constraints.find(c => c.name === 'utility'));
        }
        if (config.pillarConstraint) {
            activeConstraints.push(this.constraints.find(c => c.name === 'pillar1'));
        }
        
        return activeConstraints.filter(Boolean);
    }
    
    generateRacks(config) {
        const racks = [];
        let id = 1;
        
        // Generate standard racks
        for (let i = 0; i < config.standardRacks; i++) {
            racks.push({
                id: `standard_${id++}`,
                type: 'standard',
                ...this.rackSpecs.standard,
                position: null
            });
        }
        
        // Generate high-density racks
        for (let i = 0; i < config.highDensityRacks; i++) {
            racks.push({
                id: `high-density_${id++}`,
                type: 'high-density',
                ...this.rackSpecs['high-density'],
                position: null
            });
        }
        
        // Generate freezer racks
        for (let i = 0; i < config.freezerRacks; i++) {
            racks.push({
                id: `freezer_${id++}`,
                type: 'freezer',
                ...this.rackSpecs.freezer,
                position: null
            });
        }
        
        // Generate bulk racks
        for (let i = 0; i < config.bulkRacks; i++) {
            racks.push({
                id: `bulk_${id++}`,
                type: 'bulk',
                ...this.rackSpecs.bulk,
                position: null
            });
        }
        
        return racks;
    }
    
    placeRacks(racks, layout) {
        const placedRacks = [];
        const maxAttempts = 100;
        
        // Calculate grid dimensions
        const gridStepX = 2.0; // 2m grid
        const gridStepY = 2.0; // 2m grid
        const gridX = Math.floor(layout.width / gridStepX);
        const gridY = Math.floor(layout.height / gridStepY);
        
        // Try to place each rack
        for (const rack of racks) {
            let placed = false;
            let attempts = 0;
            
            // Try grid positions
            for (let i = 0; i < gridX && !placed && attempts < maxAttempts; i++) {
                for (let j = 0; j < gridY && !placed && attempts < maxAttempts; j++) {
                    attempts++;
                    
                    const x = i * gridStepX;
                    const y = j * gridStepY;
                    const position = { x, y };
                    
                    if (this.isValidPlacement(rack, position, layout, placedRacks)) {
                        rack.position = position;
                        placedRacks.push(rack);
                        placed = true;
                    }
                }
            }
        }
        
        // Calculate scores and metrics
        const score = this.calculateScore(placedRacks, layout);
        const metrics = this.calculateMetrics(placedRacks, layout);
        
        return {
            racks: placedRacks,
            score: score.totalScore,
            metrics: {
                ...metrics,
                layoutEfficiency: score.layoutEfficiency,
                accessibility: score.accessibility,
                workflow: score.workflow
            }
        };
    }
    
    isValidPlacement(rack, position, layout, placedRacks) {
        // Check bounds
        if (position.x < 0 || position.y < 0 ||
            position.x + rack.width > layout.width ||
            position.y + rack.height > layout.height) {
            return false;
        }
        
        // Check constraints
        for (const constraint of layout.constraints) {
            if (this.rectanglesOverlap(
                position, { width: rack.width, height: rack.height },
                constraint.position, constraint.dimensions
            )) {
                return false;
            }
        }
        
        // Check collision with other racks
        for (const placedRack of placedRacks) {
            if (placedRack.position && this.rectanglesOverlap(
                position, { width: rack.width, height: rack.height },
                placedRack.position, { width: placedRack.width, height: placedRack.height }
            )) {
                return false;
            }
        }
        
        // Check aisle requirements
        return this.hasAdequateAisles(rack, position, placedRacks);
    }
    
    rectanglesOverlap(pos1, dim1, pos2, dim2) {
        return !(pos1.x + dim1.width <= pos2.x ||
                pos2.x + dim2.width <= pos1.x ||
                pos1.y + dim1.height <= pos2.y ||
                pos2.y + dim2.height <= pos1.y);
    }
    
    hasAdequateAisles(rack, position, placedRacks) {
        const minClearance = this.minAisleWidth;
        
        for (const placedRack of placedRacks) {
            if (!placedRack.position) continue;
            
            const distance = this.calculateDistance(
                { x: position.x + rack.width/2, y: position.y + rack.height/2 },
                { x: placedRack.position.x + placedRack.width/2, y: placedRack.position.y + placedRack.height/2 }
            );
            
            const minRequiredDistance = minClearance + (rack.width + rack.height + placedRack.width + placedRack.height) / 4;
            
            if (distance < minRequiredDistance) {
                return false;
            }
        }
        
        return true;
    }
    
    calculateDistance(pos1, pos2) {
        return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
    }
    
    calculateScore(racks, layout) {
        if (!racks.length) {
            return { totalScore: 0, layoutEfficiency: 0, accessibility: 0, workflow: 0 };
        }
        
        const totalRackArea = racks.reduce((sum, rack) => sum + (rack.width * rack.height), 0);
        const layoutArea = layout.width * layout.height;
        const layoutEfficiency = totalRackArea / layoutArea;
        
        const accessibility = this.calculateAccessibility(racks, layout);
        const workflow = this.calculateWorkflow(racks);
        
        const totalScore = (
            layoutEfficiency * 30 +
            accessibility * 25 +
            workflow * 25 +
            0.2 * 20 // Density placeholder
        );
        
        return {
            totalScore: Math.min(100, Math.max(0, totalScore)),
            layoutEfficiency,
            accessibility,
            workflow
        };
    }
    
    calculateAccessibility(racks, layout) {
        if (!racks.length) return 0;
        
        const maxDistance = Math.sqrt(layout.width * layout.width + layout.height * layout.height);
        let totalScore = 0;
        
        for (const rack of racks) {
            if (!rack.position) continue;
            
            const rackCenter = {
                x: rack.position.x + rack.width / 2,
                y: rack.position.y + rack.height / 2
            };
            
            const entranceDistance = this.calculateDistance(rackCenter, layout.entrance);
            const dockDistance = this.calculateDistance(rackCenter, layout.loadingDock);
            
            const entranceScore = 1 - (entranceDistance / maxDistance);
            const dockScore = 1 - (dockDistance / maxDistance);
            
            totalScore += (entranceScore + dockScore) / 2;
        }
        
        return totalScore / racks.length;
    }
    
    calculateWorkflow(racks) {
        if (racks.length < 2) return 1;
        
        const positions = racks.filter(rack => rack.position).map(rack => ({
            x: rack.position.x,
            y: rack.position.y
        }));
        
        if (positions.length < 2) return 0.5;
        
        // Calculate grid regularity
        const xCoords = [...new Set(positions.map(p => p.x))].sort((a, b) => a - b);
        const yCoords = [...new Set(positions.map(p => p.y))].sort((a, b) => a - b);
        
        let regularityScore = 0;
        
        if (xCoords.length > 1 && yCoords.length > 1) {
            const xSpacings = [];
            const ySpacings = [];
            
            for (let i = 1; i < xCoords.length; i++) {
                xSpacings.push(xCoords[i] - xCoords[i-1]);
            }
            
            for (let i = 1; i < yCoords.length; i++) {
                ySpacings.push(yCoords[i] - yCoords[i-1]);
            }
            
            const xVariance = this.calculateVariance(xSpacings);
            const yVariance = this.calculateVariance(ySpacings);
            
            regularityScore = 1 / (1 + xVariance + yVariance);
        }
        
        return Math.min(1, Math.max(0, regularityScore));
    }
    
    calculateVariance(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        
        return variance;
    }
    
    calculateMetrics(racks, layout) {
        const totalCapacity = racks.reduce((sum, rack) => sum + rack.capacity, 0);
        const totalRacks = racks.length;
        const avgDistanceToEntrance = this.calculateAverageDistance(racks, layout.entrance);
        const avgDistanceToDock = this.calculateAverageDistance(racks, layout.loadingDock);
        
        return {
            totalRacks,
            totalCapacity,
            avgDistanceToEntrance,
            avgDistanceToDock,
            areaUtilization: racks.reduce((sum, rack) => sum + (rack.width * rack.height), 0) / (layout.width * layout.height)
        };
    }
    
    calculateAverageDistance(racks, point) {
        if (!racks.length) return 0;
        
        const distances = racks.map(rack => {
            if (!rack.position) return 0;
            
            const rackCenter = {
                x: rack.position.x + rack.width / 2,
                y: rack.position.y + rack.height / 2
            };
            
            return this.calculateDistance(rackCenter, point);
        });
        
        return distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    }
}

// DOM Manipulation and Event Handlers
document.addEventListener('DOMContentLoaded', function() {
    const optimizer = new RackOptimizer();
    
    // Animated score counter
    animateScore();
    
    // Initialize optimizer
    window.optimizeLayout = function() {
        const config = {
            storeWidth: parseFloat(document.getElementById('storeWidth').value),
            storeHeight: parseFloat(document.getElementById('storeHeight').value),
            standardRacks: parseInt(document.getElementById('standardRacks').value),
            highDensityRacks: parseInt(document.getElementById('highDensityRacks').value),
            freezerRacks: parseInt(document.getElementById('freezerRacks').value),
            bulkRacks: parseInt(document.getElementById('bulkRacks').value),
            officeConstraint: document.getElementById('officeConstraint').checked,
            exitConstraint: document.getElementById('exitConstraint').checked,
            utilityConstraint: document.getElementById('utilityConstraint').checked,
            pillarConstraint: document.getElementById('pillarConstraint').checked
        };
        
        try {
            const result = optimizer.optimizeLayout(config);
            displayOptimizationResult(result);
        } catch (error) {
            console.error('Optimization error:', error);
            alert('An error occurred during optimization. Please check your inputs.');
        }
    };
    
    function displayOptimizationResult(result) {
        // Update score
        document.getElementById('optimizationScore').textContent = result.score.toFixed(1);
        
        // Update metrics
        document.getElementById('layoutEfficiency').textContent = (result.metrics.layoutEfficiency * 100).toFixed(1) + '%';
        document.getElementById('accessibility').textContent = (result.metrics.accessibility * 100).toFixed(1) + '%';
        document.getElementById('workflow').textContent = (result.metrics.workflow * 100).toFixed(1) + '%';
        document.getElementById('totalCapacity').textContent = result.metrics.totalCapacity.toLocaleString() + ' units';
        
        // Show metrics panel
        document.getElementById('metricsPanel').style.display = 'block';
        
        // Visualize layout
        visualizeLayout(result);
    }
    
    function visualizeLayout(result) {
        const canvas = document.getElementById('layoutCanvas');
        canvas.innerHTML = '';
        
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        
        const scaleX = canvasWidth / result.layout.width;
        const scaleY = canvasHeight / result.layout.height;
        const scale = Math.min(scaleX, scaleY) * 0.9; // Leave some margin
        
        const offsetX = (canvasWidth - result.layout.width * scale) / 2;
        const offsetY = (canvasHeight - result.layout.height * scale) / 2;
        
        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        
        // Draw layout boundary
        const boundary = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        boundary.setAttribute('x', offsetX);
        boundary.setAttribute('y', offsetY);
        boundary.setAttribute('width', result.layout.width * scale);
        boundary.setAttribute('height', result.layout.height * scale);
        boundary.setAttribute('fill', 'none');
        boundary.setAttribute('stroke', '#333');
        boundary.setAttribute('stroke-width', '2');
        svg.appendChild(boundary);
        
        // Draw constraints
        for (const constraint of result.layout.constraints) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', offsetX + constraint.position.x * scale);
            rect.setAttribute('y', offsetY + constraint.position.y * scale);
            rect.setAttribute('width', constraint.dimensions.width * scale);
            rect.setAttribute('height', constraint.dimensions.height * scale);
            rect.setAttribute('fill', constraint.color);
            rect.setAttribute('stroke', '#000');
            rect.setAttribute('stroke-width', '1');
            rect.setAttribute('opacity', '0.7');
            svg.appendChild(rect);
            
            // Add constraint label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', offsetX + (constraint.position.x + constraint.dimensions.width/2) * scale);
            text.setAttribute('y', offsetY + (constraint.position.y + constraint.dimensions.height/2) * scale);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '10px');
            text.setAttribute('font-weight', 'bold');
            text.textContent = constraint.name;
            svg.appendChild(text);
        }
        
        // Draw entrance
        const entrance = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        entrance.setAttribute('cx', offsetX + result.layout.entrance.x * scale);
        entrance.setAttribute('cy', offsetY + result.layout.entrance.y * scale);
        entrance.setAttribute('r', 5);
        entrance.setAttribute('fill', '#22c55e');
        entrance.setAttribute('stroke', '#000');
        entrance.setAttribute('stroke-width', '1');
        svg.appendChild(entrance);
        
        // Draw loading dock
        const dock = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        dock.setAttribute('x', offsetX + (result.layout.loadingDock.x - 1) * scale);
        dock.setAttribute('y', offsetY + (result.layout.loadingDock.y - 1) * scale);
        dock.setAttribute('width', 2 * scale);
        dock.setAttribute('height', 2 * scale);
        dock.setAttribute('fill', '#f97316');
        dock.setAttribute('stroke', '#000');
        dock.setAttribute('stroke-width', '1');
        svg.appendChild(dock);
        
        // Draw racks
        for (const rack of result.racks) {
            if (!rack.position) continue;
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', offsetX + rack.position.x * scale);
            rect.setAttribute('y', offsetY + rack.position.y * scale);
            rect.setAttribute('width', rack.width * scale);
            rect.setAttribute('height', rack.height * scale);
            rect.setAttribute('fill', rack.color);
            rect.setAttribute('stroke', '#000');
            rect.setAttribute('stroke-width', '1');
            rect.setAttribute('opacity', '0.8');
            svg.appendChild(rect);
            
            // Add rack ID
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', offsetX + (rack.position.x + rack.width/2) * scale);
            text.setAttribute('y', offsetY + (rack.position.y + rack.height/2) * scale);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '8px');
            text.setAttribute('font-weight', 'bold');
            text.textContent = rack.id.split('_')[1];
            svg.appendChild(text);
        }
        
        canvas.appendChild(svg);
    }
    
    function animateScore() {
        const scoreElement = document.getElementById('animated-score');
        const targetScore = 85.2;
        let currentScore = 0;
        const increment = targetScore / 100;
        
        const animation = setInterval(() => {
            currentScore += increment;
            if (currentScore >= targetScore) {
                currentScore = targetScore;
                clearInterval(animation);
            }
            scoreElement.textContent = currentScore.toFixed(1);
        }, 30);
    }
});

// Smooth scrolling functions
function scrollToOptimizer() {
    document.getElementById('optimizer').scrollIntoView({ behavior: 'smooth' });
}

function scrollToSpecs() {
    document.getElementById('dimensions').scrollIntoView({ behavior: 'smooth' });
}

// Download functions (placeholder)
function downloadReport() {
    // In a real implementation, this would generate and download the optimization report
    alert('Optimization report download would be implemented in the backend.');
}

function downloadData() {
    // In a real implementation, this would generate and download the JSON data
    alert('Data export download would be implemented in the backend.');
}

function downloadVisualization() {
    // In a real implementation, this would generate and download the visualization
    alert('Visualization download would be implemented in the backend.');
}