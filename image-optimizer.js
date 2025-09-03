// Image-Based Dark Store Optimizer
class ImageLayoutOptimizer {
    constructor() {
        this.rackSpecs = {
            standard: { width: 4, height: 8, capacity: 200, color: '#4CAF50', name: 'Standard' },
            'high-density': { width: 2.5, height: 10, capacity: 300, color: '#2196F3', name: 'High-Density' },
            freezer: { width: 5, height: 6.5, capacity: 150, color: '#00BCD4', name: 'Freezer' },
            bulk: { width: 6.5, height: 5, capacity: 100, color: '#FF9800', name: 'Bulk Storage' }
        };
        
        this.minAisleWidth = 2.5;
        this.uploadedImage = null;
        this.canvas = null;
        this.ctx = null;
        this.dimensions = [];
        this.scale = 1; // pixels per foot
        this.isDimensionMode = false;
        this.currentDimensionPoints = [];
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        this.populationSize = 50;
        this.generations = 100;
        this.mutationRate = 0.1;
        this.eliteCount = 5;
    }
    
    initializeCanvas() {
        this.canvas = document.getElementById('layoutCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Add click event for dimension marking
        this.canvas.addEventListener('click', (e) => {
            if (this.isDimensionMode) {
                this.handleDimensionClick(e);
            }
        });
        
        // Add zoom and pan functionality
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomLevel *= delta;
            this.zoomLevel = Math.max(1, Math.min(5, this.zoomLevel)); // Limit zoom
            this.drawImageToCanvas();
        });
        
        // Pan functionality
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.isDimensionMode) {
                this.isDragging = true;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && !this.isDimensionMode) {
                const dx = e.clientX - this.lastMousePos.x;
                const dy = e.clientY - this.lastMousePos.y;
                this.panOffset.x += dx;
                this.panOffset.y += dy;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
                this.drawImageToCanvas();
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
    }
    
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.uploadedImage = img;
                    this.drawImageToCanvas();
                    resolve(img);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    drawImageToCanvas() {
        if (!this.uploadedImage || !this.canvas) return;
        
        // Calculate base canvas size to fit image while maintaining aspect ratio
        const maxWidth = this.isDimensionMode ? 600 : 400; // Larger when in dimension mode
        const maxHeight = this.isDimensionMode ? 450 : 300;
        const imgRatio = this.uploadedImage.width / this.uploadedImage.height;
        
        let baseWidth, baseHeight;
        if (imgRatio > maxWidth / maxHeight) {
            baseWidth = maxWidth;
            baseHeight = maxWidth / imgRatio;
        } else {
            baseHeight = maxHeight;
            baseWidth = maxHeight * imgRatio;
        }
        
        this.canvas.width = baseWidth;
        this.canvas.height = baseHeight;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply zoom and pan transforms
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        
        // Draw image
        this.ctx.drawImage(this.uploadedImage, 0, 0, baseWidth, baseHeight);
        
        this.ctx.restore();
        
        // Redraw dimensions (with transforms)
        this.drawDimensions();
    }
    
    handleDimensionClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for zoom and pan in coordinate calculation
        const x = (e.clientX - rect.left - this.panOffset.x) / this.zoomLevel;
        const y = (e.clientY - rect.top - this.panOffset.y) / this.zoomLevel;
        
        this.currentDimensionPoints.push({ x, y });
        
        if (this.currentDimensionPoints.length === 2) {
            // Ask user for dimension value
            const measurement = prompt('Enter the actual measurement for this distance (in feet):');
            if (measurement && !isNaN(measurement) && parseFloat(measurement) > 0) {
                this.addDimension(
                    this.currentDimensionPoints[0],
                    this.currentDimensionPoints[1],
                    parseFloat(measurement)
                );
            }
            this.currentDimensionPoints = [];
        }
        
        // Draw temporary point
        this.drawImageToCanvas();
        this.drawTemporaryPoints();
    }
    
    drawTemporaryPoints() {
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        
        this.ctx.fillStyle = '#ff0000';
        for (const point of this.currentDimensionPoints) {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 3 / this.zoomLevel, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    addDimension(point1, point2, measurement) {
        const pixelDistance = Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
        );
        
        const dimension = {
            id: Date.now(),
            point1,
            point2,
            pixelDistance,
            realMeasurement: measurement,
            pixelsPerFoot: pixelDistance / measurement
        };
        
        this.dimensions.push(dimension);
        this.updateDimensionsList();
        this.calculateScale();
        this.drawImageToCanvas();
    }
    
    calculateScale() {
        if (this.dimensions.length > 0) {
            // Use average scale from all dimensions
            const scales = this.dimensions.map(d => d.pixelsPerFoot);
            this.scale = scales.reduce((a, b) => a + b, 0) / scales.length;
        }
    }
    
    drawDimensions() {
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        
        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 2 / this.zoomLevel;
        this.ctx.fillStyle = '#2563eb';
        this.ctx.font = `${12 / this.zoomLevel}px Arial`;
        
        for (const dimension of this.dimensions) {
            // Draw dimension line
            this.ctx.beginPath();
            this.ctx.moveTo(dimension.point1.x, dimension.point1.y);
            this.ctx.lineTo(dimension.point2.x, dimension.point2.y);
            this.ctx.stroke();
            
            // Draw end points
            this.ctx.beginPath();
            this.ctx.arc(dimension.point1.x, dimension.point1.y, 3 / this.zoomLevel, 0, 2 * Math.PI);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(dimension.point2.x, dimension.point2.y, 3 / this.zoomLevel, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Draw measurement text
            const midX = (dimension.point1.x + dimension.point2.x) / 2;
            const midY = (dimension.point1.y + dimension.point2.y) / 2;
            this.ctx.fillText(`${dimension.realMeasurement}'`, midX, midY - 5 / this.zoomLevel);
        }
        
        this.ctx.restore();
    }
    
    updateDimensionsList() {
        const container = document.getElementById('addedDimensions');
        container.innerHTML = '';
        
        for (const dimension of this.dimensions) {
            const item = document.createElement('div');
            item.className = 'dimension-item';
            item.innerHTML = `
                <span class="dimension-line">Line ${dimension.id.toString().substr(-4)}</span>
                <span class="dimension-value">${dimension.realMeasurement}'</span>
                <button class="remove-btn" onclick="removeDimension(${dimension.id})">×</button>
            `;
            container.appendChild(item);
        }
    }
    
    removeDimension(id) {
        this.dimensions = this.dimensions.filter(d => d.id !== id);
        this.updateDimensionsList();
        this.calculateScale();
        this.drawImageToCanvas();
    }
    
    // Convert pixel coordinates to real-world coordinates
    pixelsToFeet(pixels) {
        return pixels / this.scale;
    }
    
    feetToPixels(feet) {
        return feet * this.scale;
    }
    
    // Extract store boundary from image (simplified polygon detection)
    extractStoreBoundary() {
        if (!this.uploadedImage || this.dimensions.length < 2) {
            throw new Error('Please add at least 2 dimensions to establish scale');
        }
        
        // For now, create a simple rectangular boundary based on image dimensions
        // In a more advanced version, this could use edge detection algorithms
        const width = this.pixelsToFeet(this.canvas.width);
        const height = this.pixelsToFeet(this.canvas.height);
        
        return [{
            x: 0,
            y: 0,
            width: width,
            height: height
        }];
    }
    
    // Get processing area (user can click to define it later)
    getProcessingArea(processingAreaSize) {
        return {
            name: 'processing',
            position: { x: 5, y: 5 }, // Default position
            dimensions: { 
                width: Math.sqrt(processingAreaSize), 
                height: Math.sqrt(processingAreaSize) 
            },
            type: 'processing',
            color: '#9C27B0'
        };
    }
    
    optimizeLayout(config) {
        try {
            const storeBoundary = this.extractStoreBoundary();
            const processingArea = this.getProcessingArea(config.processingArea);
            
            const layout = {
                width: storeBoundary[0].width,
                height: storeBoundary[0].height,
                storeShape: storeBoundary,
                constraints: [processingArea],
                entrance: { x: storeBoundary[0].width - 5, y: 5 },
                loadingDock: { x: 5, y: storeBoundary[0].height - 5 },
                image: this.uploadedImage,
                scale: this.scale,
                dimensions: this.dimensions
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
        } catch (error) {
            console.error('Optimization error:', error);
            throw error;
        }
    }
    
    generateRacks(config) {
        const racks = [];
        let id = 1;
        
        const rackTypes = [
            { type: 'standard', count: config.standardRacks },
            { type: 'high-density', count: config.highDensityRacks },
            { type: 'freezer', count: config.freezerRacks },
            { type: 'bulk', count: config.bulkRacks }
        ];
        
        for (const rackType of rackTypes) {
            for (let i = 0; i < rackType.count; i++) {
                racks.push({
                    id: `${rackType.type}_${id++}`,
                    type: rackType.type,
                    ...this.rackSpecs[rackType.type],
                    position: null
                });
            }
        }
        
        return racks;
    }
    
    // Simplified grid-based optimization for image layouts
    gridBasedOptimization(racks, layout) {
        console.log('Optimizing layout for image-based store...');
        
        const placedRacks = [];
        const gridSize = 4; // 4 ft grid
        
        for (const rack of racks) {
            let placed = false;
            let attempts = 0;
            const maxAttempts = 100;
            
            while (!placed && attempts < maxAttempts) {
                const x = Math.floor(Math.random() * (layout.width - rack.width) / gridSize) * gridSize;
                const y = Math.floor(Math.random() * (layout.height - rack.height) / gridSize) * gridSize;
                
                const position = { x, y };
                
                if (this.isValidPlacement(rack, position, layout, placedRacks)) {
                    rack.position = position;
                    placedRacks.push({ ...rack });
                    placed = true;
                }
                attempts++;
            }
        }
        
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
    
    // Basic genetic algorithm (simplified for image layouts)
    geneticAlgorithmOptimization(racks, layout) {
        console.log('Using genetic algorithm for image-based optimization...');
        
        let population = [];
        let bestSolution = null;
        let bestScore = 0;
        
        // Initialize population
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.createRandomIndividual(racks, layout));
        }
        
        for (let generation = 0; generation < this.generations; generation++) {
            // Evaluate population
            const evaluated = population.map(individual => {
                const solution = this.evaluateIndividual(individual, layout);
                if (solution.score > bestScore) {
                    bestScore = solution.score;
                    bestSolution = solution;
                }
                return { individual, fitness: solution.score };
            });
            
            // Sort by fitness
            evaluated.sort((a, b) => b.fitness - a.fitness);
            
            // Create next generation
            const nextGen = [];
            
            // Keep elite
            for (let i = 0; i < this.eliteCount; i++) {
                nextGen.push([...evaluated[i].individual]);
            }
            
            // Generate offspring
            while (nextGen.length < this.populationSize) {
                const parent1 = this.tournamentSelection(evaluated);
                const parent2 = this.tournamentSelection(evaluated);
                const offspring = this.crossover(parent1, parent2);
                nextGen.push(this.mutate(offspring, layout));
            }
            
            population = nextGen;
            
            if (generation % 25 === 0) {
                console.log(`Generation ${generation}: Best score = ${bestScore.toFixed(2)}`);
            }
        }
        
        console.log(`Final score: ${bestScore.toFixed(2)}`);
        return bestSolution;
    }
    
    createRandomIndividual(racks, layout) {
        const individual = [];
        
        for (const rack of racks) {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 50) {
                const x = Math.random() * (layout.width - rack.width);
                const y = Math.random() * (layout.height - rack.height);
                const position = { x, y };
                
                if (this.isValidPlacement(rack, position, layout, individual)) {
                    individual.push({ ...rack, position });
                    placed = true;
                }
                attempts++;
            }
            
            if (!placed) {
                individual.push({ ...rack, position: null });
            }
        }
        
        return individual;
    }
    
    tournamentSelection(population, size = 3) {
        const tournament = [];
        for (let i = 0; i < size; i++) {
            tournament.push(population[Math.floor(Math.random() * population.length)]);
        }
        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].individual;
    }
    
    crossover(parent1, parent2) {
        const crossPoint = Math.floor(Math.random() * parent1.length);
        return [
            ...parent1.slice(0, crossPoint),
            ...parent2.slice(crossPoint)
        ];
    }
    
    mutate(individual, layout) {
        return individual.map(rack => {
            if (Math.random() < this.mutationRate && rack.position) {
                const newX = Math.max(0, Math.min(layout.width - rack.width, 
                    rack.position.x + (Math.random() - 0.5) * 10));
                const newY = Math.max(0, Math.min(layout.height - rack.height, 
                    rack.position.y + (Math.random() - 0.5) * 10));
                
                const newPosition = { x: newX, y: newY };
                const others = individual.filter(r => r !== rack && r.position);
                
                if (this.isValidPlacement(rack, newPosition, layout, others)) {
                    return { ...rack, position: newPosition };
                }
            }
            return { ...rack };
        });
    }
    
    evaluateIndividual(individual, layout) {
        const placedRacks = individual.filter(rack => rack.position);
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
    
    isValidPlacement(rack, position, layout, otherRacks) {
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
        
        // Check other racks
        for (const other of otherRacks) {
            if (other.position && this.rectanglesOverlap(
                position, { width: rack.width, height: rack.height },
                other.position, { width: other.width, height: other.height }
            )) {
                return false;
            }
        }
        
        // Check aisle width
        return this.hasAdequateAisles(rack, position, otherRacks);
    }
    
    rectanglesOverlap(pos1, dim1, pos2, dim2) {
        return !(pos1.x + dim1.width <= pos2.x ||
                pos2.x + dim2.width <= pos1.x ||
                pos1.y + dim1.height <= pos2.y ||
                pos2.y + dim2.height <= pos1.y);
    }
    
    hasAdequateAisles(rack, position, otherRacks) {
        for (const other of otherRacks) {
            if (!other.position) continue;
            
            const distance = Math.sqrt(
                Math.pow(position.x - other.position.x, 2) +
                Math.pow(position.y - other.position.y, 2)
            );
            
            const minDistance = this.minAisleWidth + (rack.width + rack.height + other.width + other.height) / 4;
            
            if (distance < minDistance) {
                return false;
            }
        }
        
        return true;
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
            0.3 * 20
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
            
            const entranceDistance = Math.sqrt(
                Math.pow(rack.position.x - layout.entrance.x, 2) +
                Math.pow(rack.position.y - layout.entrance.y, 2)
            );
            
            const dockDistance = Math.sqrt(
                Math.pow(rack.position.x - layout.loadingDock.x, 2) +
                Math.pow(rack.position.y - layout.loadingDock.y, 2)
            );
            
            const entranceScore = 1 - (entranceDistance / maxDistance);
            const dockScore = 1 - (dockDistance / maxDistance);
            
            totalScore += (entranceScore + dockScore) / 2;
        }
        
        return totalScore / racks.length;
    }
    
    calculateWorkflow(racks) {
        if (racks.length < 2) return 1;
        
        const positions = racks.filter(r => r.position).map(r => r.position);
        if (positions.length < 2) return 0.5;
        
        // Simple regularity check
        const xCoords = [...new Set(positions.map(p => Math.round(p.x / 4) * 4))].sort((a, b) => a - b);
        const yCoords = [...new Set(positions.map(p => Math.round(p.y / 4) * 4))].sort((a, b) => a - b);
        
        if (xCoords.length < 2 || yCoords.length < 2) return 0.5;
        
        return 0.8; // Simplified workflow score
    }
    
    calculateMetrics(racks, layout) {
        const totalCapacity = racks.reduce((sum, rack) => sum + rack.capacity, 0);
        const totalRacks = racks.length;
        const totalArea = layout.width * layout.height;
        const usedArea = racks.reduce((sum, rack) => sum + (rack.width * rack.height), 0);
        
        return {
            totalRacks,
            totalCapacity,
            areaUtilization: usedArea / totalArea,
            avgDistanceToEntrance: this.calculateAverageDistance(racks, layout.entrance),
            avgDistanceToDock: this.calculateAverageDistance(racks, layout.loadingDock)
        };
    }
    
    calculateAverageDistance(racks, point) {
        if (!racks.length) return 0;
        
        const distances = racks.map(rack => {
            if (!rack.position) return 0;
            return Math.sqrt(
                Math.pow(rack.position.x - point.x, 2) +
                Math.pow(rack.position.y - point.y, 2)
            );
        });
        
        return distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    }
}

// Global variables and DOM handlers
let imageOptimizer = null;

document.addEventListener('DOMContentLoaded', function() {
    imageOptimizer = new ImageLayoutOptimizer();
    
    // Image upload handling
    const imageInput = document.getElementById('layoutImageInput');
    imageInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                await imageOptimizer.loadImage(file);
                document.getElementById('imageUploadArea').style.display = 'none';
                document.getElementById('uploadedImageContainer').style.display = 'block';
                imageOptimizer.initializeCanvas();
            } catch (error) {
                console.error('Error loading image:', error);
                alert('Error loading image. Please try a different file.');
            }
        }
    });
    
    // Global functions for HTML onclick handlers
    window.clearImage = function() {
        imageOptimizer.uploadedImage = null;
        imageOptimizer.dimensions = [];
        document.getElementById('imageUploadArea').style.display = 'block';
        document.getElementById('uploadedImageContainer').style.display = 'none';
        document.getElementById('dimensionsInputGroup').style.display = 'none';
        document.getElementById('layoutImageInput').value = '';
    };
    
    
    window.removeDimension = function(id) {
        imageOptimizer.removeDimension(id);
    };
    
    window.optimizeLayout = function() {
        if (!imageOptimizer.uploadedImage) {
            alert('Please upload a store layout image first.');
            return;
        }
        
        if (imageOptimizer.dimensions.length < 2) {
            alert('Please add at least 2 dimensions to establish scale.');
            return;
        }
        
        const optimizationMethod = document.querySelector('input[name="optimizationMethod"]:checked')?.value || 'grid';
        
        const config = {
            standardRacks: parseInt(document.getElementById('standardRacks').value) || 0,
            highDensityRacks: parseInt(document.getElementById('highDensityRacks').value) || 0,
            freezerRacks: parseInt(document.getElementById('freezerRacks').value) || 0,
            bulkRacks: parseInt(document.getElementById('bulkRacks').value) || 0,
            processingArea: parseFloat(document.getElementById('processingArea').value) || 150,
            optimizationMethod: optimizationMethod
        };
        
        try {
            const result = imageOptimizer.optimizeLayout(config);
            displayOptimizationResult(result);
        } catch (error) {
            console.error('Optimization error:', error);
            alert('Error during optimization: ' + error.message);
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
        
        // Visualize results on the main canvas
        visualizeOptimizedLayout(result);
    }
    
    function visualizeOptimizedLayout(result) {
        const canvas = document.getElementById('layoutCanvas');
        const ctx = canvas.getContext('2d');
        
        // Clear and redraw base image
        imageOptimizer.drawImageToCanvas();
        
        // Draw optimized racks on top
        for (let i = 0; i < result.racks.length; i++) {
            const rack = result.racks[i];
            if (!rack.position) continue;
            
            // Convert real coordinates to pixel coordinates
            const x = imageOptimizer.feetToPixels(rack.position.x);
            const y = imageOptimizer.feetToPixels(rack.position.y);
            const width = imageOptimizer.feetToPixels(rack.width);
            const height = imageOptimizer.feetToPixels(rack.height);
            
            // Draw rack
            ctx.fillStyle = rack.color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(x, y, width, height);
            
            // Draw border
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 1;
            ctx.strokeRect(x, y, width, height);
            
            // Draw label
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            const rackSpec = imageOptimizer.rackSpecs[rack.type];
            ctx.fillText(rackSpec.name, x + width/2, y + height/2 - 5);
            ctx.fillText(`${rack.width}'×${rack.height}'`, x + width/2, y + height/2 + 8);
        }
        
        // Reset global alpha
        ctx.globalAlpha = 1;
    }
});

// Initialize the optimizer when DOM is loaded
let optimizer = null;

document.addEventListener('DOMContentLoaded', function() {
    optimizer = new ImageLayoutOptimizer();
    optimizer.initializeCanvas();
    setupEventListeners();
});

function setupEventListeners() {
    // File upload handler
    const imageInput = document.getElementById('layoutImageInput');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
        console.log('Image upload listener added');
    }
    
    // Dimension mode button
    const dimensionBtn = document.getElementById('dimensionModeBtn');
    if (dimensionBtn) {
        dimensionBtn.addEventListener('click', startDimensionMode);
        console.log('Dimension button listener added');
    } else {
        console.error('Dimension button not found!');
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        optimizer.loadImage(file).then(() => {
            // Show the uploaded image container
            document.getElementById('uploadedImageContainer').style.display = 'block';
            document.getElementById('imageUploadArea').style.display = 'none';
        }).catch(error => {
            console.error('Error loading image:', error);
            alert('Error loading image. Please try again.');
        });
    }
}

function clearImage() {
    optimizer.uploadedImage = null;
    optimizer.dimensions = [];
    optimizer.scale = 1;
    optimizer.currentDimensionPoints = [];
    
    document.getElementById('uploadedImageContainer').style.display = 'none';
    document.getElementById('imageUploadArea').style.display = 'block';
    document.getElementById('dimensionsInputGroup').style.display = 'none';
    document.getElementById('addedDimensions').innerHTML = '';
    
    // Clear file input
    document.getElementById('layoutImageInput').value = '';
}

function startDimensionMode() {
    console.log('startDimensionMode called');
    
    if (!optimizer) {
        console.error('Optimizer not initialized');
        return;
    }
    
    if (!optimizer.uploadedImage) {
        alert('Please upload an image first.');
        return;
    }
    
    console.log('Entering dimension mode');
    optimizer.isDimensionMode = true;
    optimizer.zoomLevel = 2; // Auto-zoom when entering dimension mode
    optimizer.panOffset = { x: 0, y: 0 }; // Reset pan
    
    document.getElementById('dimensionsInputGroup').style.display = 'block';
    document.getElementById('dimensionModeBtn').textContent = 'Click 2 points to add dimension';
    document.getElementById('dimensionModeBtn').classList.add('active');
    
    // Redraw with zoom
    optimizer.drawImageToCanvas();
    
    // Add exit dimension mode button
    if (!document.getElementById('exitDimensionBtn')) {
        const exitBtn = document.createElement('button');
        exitBtn.id = 'exitDimensionBtn';
        exitBtn.type = 'button';
        exitBtn.className = 'btn-small';
        exitBtn.textContent = 'Exit Dimension Mode';
        exitBtn.onclick = exitDimensionMode;
        document.querySelector('.image-controls').appendChild(exitBtn);
    }
}

function exitDimensionMode() {
    optimizer.isDimensionMode = false;
    optimizer.zoomLevel = 1; // Reset zoom
    optimizer.panOffset = { x: 0, y: 0 }; // Reset pan
    optimizer.currentDimensionPoints = [];
    
    document.getElementById('dimensionModeBtn').textContent = 'Add Dimensions';
    document.getElementById('dimensionModeBtn').classList.remove('active');
    
    // Remove exit button
    const exitBtn = document.getElementById('exitDimensionBtn');
    if (exitBtn) exitBtn.remove();
    
    // Redraw without zoom
    optimizer.drawImageToCanvas();
}

function optimizeLayout() {
    if (!optimizer.uploadedImage) {
        alert('Please upload a store layout image first.');
        return;
    }
    
    if (optimizer.dimensions.length < 2) {
        alert('Please add at least 2 dimensions to establish scale.');
        return;
    }
    
    // Get rack quantities
    const rackCounts = {
        standard: parseInt(document.getElementById('standardRacks').value) || 0,
        'high-density': parseInt(document.getElementById('highDensityRacks').value) || 0,
        freezer: parseInt(document.getElementById('freezerRacks').value) || 0,
        bulk: parseInt(document.getElementById('bulkRacks').value) || 0
    };
    
    const processingArea = parseInt(document.getElementById('processingArea').value) || 150;
    const method = document.querySelector('input[name="optimizationMethod"]:checked').value;
    
    // Show loading state
    const optimizeBtn = document.querySelector('.btn-primary');
    const originalText = optimizeBtn.textContent;
    optimizeBtn.textContent = 'Optimizing...';
    optimizeBtn.disabled = true;
    
    // Run optimization
    setTimeout(() => {
        try {
            const result = optimizer.optimize(rackCounts, processingArea, method);
            
            // Update UI with results
            document.getElementById('optimizationScore').textContent = Math.round(result.score);
            document.getElementById('layoutEfficiency').textContent = Math.round(result.layoutEfficiency * 100) + '%';
            document.getElementById('accessibility').textContent = Math.round(result.accessibilityScore * 100) + '%';
            document.getElementById('workflow').textContent = Math.round(result.workflowScore * 100) + '%';
            document.getElementById('totalCapacity').textContent = result.totalCapacity.toLocaleString();
            
            // Show metrics panel
            document.getElementById('metricsPanel').style.display = 'block';
            
            // Update canvas placeholder
            const placeholder = document.querySelector('.canvas-placeholder');
            if (placeholder) {
                placeholder.innerHTML = `<p>Optimization Complete! Score: ${Math.round(result.score)}/100</p>`;
            }
            
        } catch (error) {
            console.error('Optimization error:', error);
            alert('Error during optimization. Please check your inputs and try again.');
        } finally {
            // Restore button
            optimizeBtn.textContent = originalText;
            optimizeBtn.disabled = false;
        }
    }, 1000);
}