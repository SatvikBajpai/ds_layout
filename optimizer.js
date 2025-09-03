// Enhanced Dark Store Rack Optimizer with Genetic Algorithm
class RackOptimizer {
    constructor() {
        // Rack specifications in feet (converted from meters)
        this.rackSpecs = {
            standard: { width: 4, height: 8, capacity: 200, color: '#4CAF50', name: 'Standard' },
            'high-density': { width: 2.5, height: 10, capacity: 300, color: '#2196F3', name: 'High-Density' },
            freezer: { width: 5, height: 6.5, capacity: 150, color: '#00BCD4', name: 'Freezer' },
            bulk: { width: 6.5, height: 5, capacity: 100, color: '#FF9800', name: 'Bulk Storage' }
        };
        
        // Constraints in feet
        this.minAisleWidth = 2.5; // Minimum 2.5 ft aisles as requested
        this.mainAisleWidth = 4.0; // Main aisles wider
        this.safetyClearance = 1.0;
        
        // Genetic Algorithm parameters
        this.populationSize = 50;
        this.generations = 100;
        this.mutationRate = 0.1;
        this.eliteCount = 5;
    }
    
    // Store shape definitions
    getStoreShape(shapeType, width, height) {
        const shapes = {
            rectangular: [
                { x: 0, y: 0, width: width, height: height }
            ],
            'l-shaped': [
                { x: 0, y: 0, width: width * 0.6, height: height },
                { x: width * 0.6, y: height * 0.4, width: width * 0.4, height: height * 0.6 }
            ],
            't-shaped': [
                { x: 0, y: 0, width: width, height: height * 0.4 },
                { x: width * 0.3, y: height * 0.4, width: width * 0.4, height: height * 0.6 }
            ]
        };
        return shapes[shapeType] || shapes.rectangular;
    }
    
    // Check if a point is inside the store shape
    isPointInStore(x, y, storeShape) {
        for (const section of storeShape) {
            if (x >= section.x && x <= section.x + section.width &&
                y >= section.y && y <= section.y + section.height) {
                return true;
            }
        }
        return false;
    }
    
    // Get processing area constraint
    getProcessingArea(storeShape, processingAreaSize) {
        // Place processing area in corner of first section
        const firstSection = storeShape[0];
        const processingWidth = Math.sqrt(processingAreaSize);
        const processingHeight = processingAreaSize / processingWidth;
        
        return {
            name: 'processing',
            position: { x: firstSection.x, y: firstSection.y },
            dimensions: { width: processingWidth, height: processingHeight },
            type: 'processing',
            color: '#9C27B0'
        };
    }
    
    optimizeLayout(config) {
        const storeShape = this.getStoreShape(config.storeShape, config.storeWidth, config.storeHeight);
        const processingArea = this.getProcessingArea(storeShape, config.processingArea);
        
        const layout = {
            width: config.storeWidth,
            height: config.storeHeight,
            shape: config.storeShape,
            storeShape: storeShape,
            constraints: [processingArea],
            entrance: this.getEntrancePosition(storeShape),
            loadingDock: this.getLoadingDockPosition(storeShape)
        };
        
        const racks = this.generateRacks(config);
        
        let solution;
        if (config.optimizationMethod === 'genetic') {
            solution = this.geneticAlgorithmOptimization(racks, layout);
        } else {
            solution = this.gridBasedOptimization(racks, layout);
        }
        
        return {
            racks: solution.racks,
            score: solution.score,
            metrics: solution.metrics,
            layout: layout
        };
    }
    
    getEntrancePosition(storeShape) {
        // Place entrance at front-right of first section
        const firstSection = storeShape[0];
        return { 
            x: firstSection.x + firstSection.width - 2, 
            y: firstSection.y + 2 
        };
    }
    
    getLoadingDockPosition(storeShape) {
        // Place loading dock at back-left of first section
        const firstSection = storeShape[0];
        return { 
            x: firstSection.x + 2, 
            y: firstSection.y + firstSection.height - 4 
        };
    }
    
    // Genetic Algorithm Implementation
    geneticAlgorithmOptimization(racks, layout) {
        console.log('Starting Genetic Algorithm optimization...');
        
        // Initialize population
        let population = this.initializePopulation(racks, layout);
        let bestSolution = null;
        let bestScore = 0;
        
        for (let generation = 0; generation < this.generations; generation++) {
            // Evaluate fitness
            const evaluatedPopulation = population.map(individual => {
                const solution = this.evaluateIndividual(individual, layout);
                if (solution.score > bestScore) {
                    bestScore = solution.score;
                    bestSolution = solution;
                }
                return { individual, fitness: solution.score, solution };
            });
            
            // Sort by fitness
            evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);
            
            // Create next generation
            const nextGeneration = [];
            
            // Elite selection
            for (let i = 0; i < this.eliteCount; i++) {
                nextGeneration.push(evaluatedPopulation[i].individual);
            }
            
            // Generate offspring
            while (nextGeneration.length < this.populationSize) {
                const parent1 = this.tournamentSelection(evaluatedPopulation);
                const parent2 = this.tournamentSelection(evaluatedPopulation);
                const offspring = this.crossover(parent1, parent2);
                const mutatedOffspring = this.mutate(offspring, layout);
                nextGeneration.push(mutatedOffspring);
            }
            
            population = nextGeneration;
            
            if (generation % 20 === 0) {
                console.log(`Generation ${generation}: Best score = ${bestScore.toFixed(2)}`);
            }
        }
        
        console.log(`Optimization complete. Final score: ${bestScore.toFixed(2)}`);
        return bestSolution;
    }
    
    initializePopulation(racks, layout) {
        const population = [];
        
        for (let i = 0; i < this.populationSize; i++) {
            const individual = this.createRandomIndividual(racks, layout);
            population.push(individual);
        }
        
        return population;
    }
    
    createRandomIndividual(racks, layout) {
        const individual = [];
        
        for (const rack of racks) {
            let attempts = 0;
            let placed = false;
            
            while (!placed && attempts < 100) {
                const x = Math.random() * (layout.width - rack.width);
                const y = Math.random() * (layout.height - rack.height);
                const position = { x, y };
                
                if (this.isValidPlacement(rack, position, layout, individual)) {
                    individual.push({
                        ...rack,
                        position: position
                    });
                    placed = true;
                }
                attempts++;
            }
            
            if (!placed) {
                // If can't place, add with null position
                individual.push({
                    ...rack,
                    position: null
                });
            }
        }
        
        return individual;
    }
    
    tournamentSelection(population, tournamentSize = 3) {
        const tournament = [];
        
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push(population[randomIndex]);
        }
        
        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].individual;
    }
    
    crossover(parent1, parent2) {
        const offspring = [];
        const crossoverPoint = Math.floor(Math.random() * parent1.length);
        
        for (let i = 0; i < parent1.length; i++) {
            if (i < crossoverPoint) {
                offspring.push({ ...parent1[i] });
            } else {
                offspring.push({ ...parent2[i] });
            }
        }
        
        return offspring;
    }
    
    mutate(individual, layout) {
        const mutated = individual.map(rack => ({ ...rack }));
        
        for (let i = 0; i < mutated.length; i++) {
            if (Math.random() < this.mutationRate && mutated[i].position) {
                // Small position adjustment
                const maxAdjustment = 5; // feet
                const deltaX = (Math.random() - 0.5) * maxAdjustment;
                const deltaY = (Math.random() - 0.5) * maxAdjustment;
                
                const newX = Math.max(0, Math.min(layout.width - mutated[i].width, 
                                                 mutated[i].position.x + deltaX));
                const newY = Math.max(0, Math.min(layout.height - mutated[i].height, 
                                                 mutated[i].position.y + deltaY));
                
                const newPosition = { x: newX, y: newY };
                
                // Check if new position is valid
                const otherRacks = mutated.filter((_, idx) => idx !== i && mutated[idx].position);
                if (this.isValidPlacement(mutated[i], newPosition, layout, otherRacks)) {
                    mutated[i].position = newPosition;
                }
            }
        }
        
        return mutated;
    }
    
    evaluateIndividual(individual, layout) {
        const placedRacks = individual.filter(rack => rack.position !== null);
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
    
    // Grid-based optimization (fallback method)
    gridBasedOptimization(racks, layout) {
        console.log('Using grid-based optimization...');
        return this.placeRacks(racks, layout);
    }
    
    placeRacks(racks, layout) {
        const placedRacks = [];
        const maxAttempts = 100;
        
        // Calculate grid dimensions
        const gridStepX = 4.0; // 4ft grid
        const gridStepY = 4.0; // 4ft grid
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
    
    isValidPlacement(rack, position, layout, placedRacks) {
        // Check bounds
        if (position.x < 0 || position.y < 0 ||
            position.x + rack.width > layout.width ||
            position.y + rack.height > layout.height) {
            return false;
        }
        
        // Check if position is within store shape
        if (layout.storeShape && !this.isRackInStoreShape(rack, position, layout.storeShape)) {
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
    
    isRackInStoreShape(rack, position, storeShape) {
        const rackCorners = [
            { x: position.x, y: position.y },
            { x: position.x + rack.width, y: position.y },
            { x: position.x, y: position.y + rack.height },
            { x: position.x + rack.width, y: position.y + rack.height }
        ];
        
        // All corners must be inside store shape
        for (const corner of rackCorners) {
            if (!this.isPointInStore(corner.x, corner.y, storeShape)) {
                return false;
            }
        }
        
        return true;
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
        const layoutArea = this.calculateLayoutArea(layout);
        const layoutEfficiency = totalRackArea / layoutArea;
        
        const accessibility = this.calculateAccessibility(racks, layout);
        const workflow = this.calculateWorkflow(racks);
        
        const totalScore = (
            layoutEfficiency * 30 +
            accessibility * 25 +
            workflow * 25 +
            0.3 * 20 // Density placeholder
        );
        
        return {
            totalScore: Math.min(100, Math.max(0, totalScore)),
            layoutEfficiency,
            accessibility,
            workflow
        };
    }
    
    calculateLayoutArea(layout) {
        if (layout.storeShape) {
            return layout.storeShape.reduce((sum, section) => sum + (section.width * section.height), 0);
        }
        return layout.width * layout.height;
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
        
        // Calculate arrangement regularity
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
            areaUtilization: racks.reduce((sum, rack) => sum + (rack.width * rack.height), 0) / this.calculateLayoutArea(layout)
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
    
    // Update area calculation when dimensions change
    function updateAreaCalculation() {
        const width = parseFloat(document.getElementById('storeWidth').value) || 0;
        const height = parseFloat(document.getElementById('storeHeight').value) || 0;
        const area = (width * height).toLocaleString();
        document.getElementById('totalArea').textContent = area;
    }
    
    document.getElementById('storeWidth').addEventListener('input', updateAreaCalculation);
    document.getElementById('storeHeight').addEventListener('input', updateAreaCalculation);
    
    // Initialize optimizer
    window.optimizeLayout = function() {
        const storeShape = document.querySelector('input[name="storeShape"]:checked').value;
        const optimizationMethod = document.querySelector('input[name="optimizationMethod"]:checked').value;
        
        const config = {
            storeWidth: parseFloat(document.getElementById('storeWidth').value),
            storeHeight: parseFloat(document.getElementById('storeHeight').value),
            storeShape: storeShape,
            standardRacks: parseInt(document.getElementById('standardRacks').value),
            highDensityRacks: parseInt(document.getElementById('highDensityRacks').value),
            freezerRacks: parseInt(document.getElementById('freezerRacks').value),
            bulkRacks: parseInt(document.getElementById('bulkRacks').value),
            processingArea: parseFloat(document.getElementById('processingArea').value),
            optimizationMethod: optimizationMethod
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
        const scale = Math.min(scaleX, scaleY) * 0.8; // Leave margin for labels
        
        const offsetX = (canvasWidth - result.layout.width * scale) / 2;
        const offsetY = (canvasHeight - result.layout.height * scale) / 2;
        
        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        
        // Draw store shape
        if (result.layout.storeShape) {
            for (const section of result.layout.storeShape) {
                const sectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                sectionRect.setAttribute('x', offsetX + section.x * scale);
                sectionRect.setAttribute('y', offsetY + section.y * scale);
                sectionRect.setAttribute('width', section.width * scale);
                sectionRect.setAttribute('height', section.height * scale);
                sectionRect.setAttribute('fill', '#f9f9f9');
                sectionRect.setAttribute('stroke', '#333');
                sectionRect.setAttribute('stroke-width', '2');
                svg.appendChild(sectionRect);
            }
        }
        
        // Add dimension labels for store
        if (result.layout.storeShape) {
            const mainSection = result.layout.storeShape[0];
            // Width dimension
            addDimensionLabel(svg, 
                offsetX + mainSection.x * scale, 
                offsetY + (mainSection.y + mainSection.height) * scale + 20,
                offsetX + (mainSection.x + mainSection.width) * scale, 
                offsetY + (mainSection.y + mainSection.height) * scale + 20,
                `${mainSection.width}'`);
            
            // Height dimension  
            addDimensionLabel(svg,
                offsetX + (mainSection.x + mainSection.width) * scale + 20,
                offsetY + mainSection.y * scale,
                offsetX + (mainSection.x + mainSection.width) * scale + 20,
                offsetY + (mainSection.y + mainSection.height) * scale,
                `${mainSection.height}'`);
        }
        
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
            text.textContent = constraint.name.toUpperCase();
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
        
        // Draw racks with professional labeling
        for (let i = 0; i < result.racks.length; i++) {
            const rack = result.racks[i];
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
            
            // Professional rack labeling
            const rackSpec = optimizer.rackSpecs[rack.type];
            const rackLabel = `${rackSpec.name}\n${rack.width}'×${rack.height}'\nID: ${rack.type.toUpperCase()}-${String(i+1).padStart(2, '0')}`;
            
            // Multi-line rack label
            const lines = rackLabel.split('\n');
            const centerX = offsetX + (rack.position.x + rack.width/2) * scale;
            const centerY = offsetY + (rack.position.y + rack.height/2) * scale;
            
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                textElement.setAttribute('x', centerX);
                textElement.setAttribute('y', centerY + (lineIdx - 1) * 10);
                textElement.setAttribute('text-anchor', 'middle');
                textElement.setAttribute('dominant-baseline', 'middle');
                textElement.setAttribute('fill', 'white');
                textElement.setAttribute('font-size', lineIdx === 0 ? '10px' : '8px');
                textElement.setAttribute('font-weight', lineIdx === 0 ? 'bold' : 'normal');
                textElement.textContent = lines[lineIdx];
                svg.appendChild(textElement);
            }
        }
        
        // Add professional title and scale
        const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleText.setAttribute('x', 20);
        titleText.setAttribute('y', 30);
        titleText.setAttribute('fill', '#333');
        titleText.setAttribute('font-size', '16px');
        titleText.setAttribute('font-weight', 'bold');
        titleText.textContent = `${result.layout.shape.toUpperCase()} DARK STORE LAYOUT`;
        svg.appendChild(titleText);
        
        // Add scale reference
        const scaleReference = 20; // 20 feet reference
        const scaleRefLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        scaleRefLine.setAttribute('x1', 20);
        scaleRefLine.setAttribute('y1', canvasHeight - 40);
        scaleRefLine.setAttribute('x2', 20 + scaleReference * scale);
        scaleRefLine.setAttribute('y2', canvasHeight - 40);
        scaleRefLine.setAttribute('stroke', '#333');
        scaleRefLine.setAttribute('stroke-width', '2');
        svg.appendChild(scaleRefLine);
        
        const scaleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scaleText.setAttribute('x', 20 + (scaleReference * scale / 2));
        scaleText.setAttribute('y', canvasHeight - 45);
        scaleText.setAttribute('text-anchor', 'middle');
        scaleText.setAttribute('fill', '#333');
        scaleText.setAttribute('font-size', '10px');
        scaleText.textContent = `${scaleReference}'`;
        svg.appendChild(scaleText);
        
        canvas.appendChild(svg);
    }
    
    // Helper function to add dimension labels
    function addDimensionLabel(svg, x1, y1, x2, y2, label) {
        // Draw dimension line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#666');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2,2');
        svg.appendChild(line);
        
        // Add dimension text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (x1 + x2) / 2);
        text.setAttribute('y', (y1 + y2) / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', '#666');
        text.setAttribute('font-size', '10px');
        text.setAttribute('font-weight', 'bold');
        text.textContent = label;
        svg.appendChild(text);
        
        // Add dimension arrows
        const arrowSize = 4;
        const arrow1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow1.setAttribute('points', `${x1-arrowSize},${y1-arrowSize} ${x1},${y1} ${x1-arrowSize},${y1+arrowSize}`);
        arrow1.setAttribute('fill', '#666');
        svg.appendChild(arrow1);
        
        const arrow2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow2.setAttribute('points', `${x2+arrowSize},${y2-arrowSize} ${x2},${y2} ${x2+arrowSize},${y2+arrowSize}`);
        arrow2.setAttribute('fill', '#666');
        svg.appendChild(arrow2);
    }
});