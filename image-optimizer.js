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
        this.detectedEdges = [];
        this.edgeDimensions = {}; // stores user-entered dimensions for each edge
        this.layoutBounds = { width: 0, height: 0 };
        this.hoveredEdge = null;
        this.selectedEdges = new Set();
        
        this.populationSize = 50;
        this.generations = 100;
        this.mutationRate = 0.1;
        this.eliteCount = 5;
    }
    
    initializeCanvas() {
        this.canvas = document.getElementById('layoutCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Add hover functionality for edge detection
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.checkEdgeHover(x, y);
        });
        
        this.canvas.addEventListener('click', (e) => {
            if (this.hoveredEdge) {
                this.selectEdge(this.hoveredEdge);
            }
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredEdge = null;
            this.drawImageToCanvas();
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
        
        // Use much larger canvas size for full layout view
        const maxWidth = Math.min(window.innerWidth - 100, 1200);
        const maxHeight = Math.min(window.innerHeight * 0.8, 800);
        const imgRatio = this.uploadedImage.width / this.uploadedImage.height;
        
        let canvasWidth, canvasHeight;
        if (imgRatio > maxWidth / maxHeight) {
            canvasWidth = maxWidth;
            canvasHeight = maxWidth / imgRatio;
        } else {
            canvasHeight = maxHeight;
            canvasWidth = maxHeight * imgRatio;
        }
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw image
        this.ctx.drawImage(this.uploadedImage, 0, 0, canvasWidth, canvasHeight);
        
        // Store layout bounds for calculations
        this.layoutBounds = { width: canvasWidth, height: canvasHeight };
        
        // Detect and draw edges
        this.detectEdges();
        this.drawDetectedEdges();
        
        // Optional: Draw edge detection debug overlay
        if (window.location.hash === '#debug') {
            this.drawEdgeDetectionDebug();
        }
    }
    
    detectEdges() {
        // Real edge detection using image analysis
        const { width, height } = this.layoutBounds;
        const imageData = this.ctx.getImageData(0, 0, width, height);
        const edges = [];
        
        // Apply Sobel edge detection
        const sobelData = this.applySobelFilter(imageData);
        
        // Find connected edge components using line detection
        const detectedLines = this.detectLines(sobelData, width, height);
        
        // Convert detected lines to edge objects
        for (let i = 0; i < detectedLines.length; i++) {
            const line = detectedLines[i];
            edges.push({
                id: `edge_${i}`,
                name: `${line.direction === 'horizontal' ? 'Horizontal' : 'Vertical'} Wall ${i + 1}`,
                start: { x: line.x1, y: line.y1 },
                end: { x: line.x2, y: line.y2 },
                length: line.length,
                direction: line.direction,
                strength: line.strength
            });
        }
        
        this.detectedEdges = edges;
        console.log(`Detected ${edges.length} actual building edges`);
        
        // Log details about detected edges for debugging
        edges.forEach((edge, i) => {
            console.log(`Edge ${i}: ${edge.name} - ${edge.direction} from (${Math.round(edge.start.x)},${Math.round(edge.start.y)}) to (${Math.round(edge.end.x)},${Math.round(edge.end.y)}) length=${Math.round(edge.length)} strength=${edge.strength}`);
        });
    }
    
    applySobelFilter(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const edgeData = new Float32Array(width * height);
        
        // Sobel kernels
        const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                
                // Apply Sobel kernels
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
                        const gray = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
                        
                        gx += gray * sobelX[ky + 1][kx + 1];
                        gy += gray * sobelY[ky + 1][kx + 1];
                    }
                }
                
                // Calculate gradient magnitude
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edgeData[y * width + x] = magnitude;
            }
        }
        
        return edgeData;
    }
    
    detectLines(edgeData, width, height) {
        const lines = [];
        const threshold = 100; // Edge strength threshold
        const minLength = 30; // Minimum line length
        
        // Use simple line detection - scan for strong continuous edges
        
        // Detect horizontal lines
        for (let y = 10; y < height - 10; y += 3) {
            let lineStart = null;
            let strongPixels = 0;
            
            for (let x = 5; x < width - 5; x++) {
                const edgeStrength = edgeData[y * width + x];
                
                if (edgeStrength > threshold) {
                    if (!lineStart) {
                        lineStart = x;
                        strongPixels = 1;
                    } else {
                        strongPixels++;
                    }
                } else {
                    if (lineStart && strongPixels > minLength) {
                        lines.push({
                            x1: lineStart,
                            y1: y,
                            x2: x - 1,
                            y2: y,
                            length: x - lineStart,
                            direction: 'horizontal',
                            strength: strongPixels
                        });
                    }
                    lineStart = null;
                    strongPixels = 0;
                }
            }
            
            // Check for line at end of row
            if (lineStart && strongPixels > minLength) {
                lines.push({
                    x1: lineStart,
                    y1: y,
                    x2: width - 5,
                    y2: y,
                    length: width - 5 - lineStart,
                    direction: 'horizontal',
                    strength: strongPixels
                });
            }
        }
        
        // Detect vertical lines
        for (let x = 10; x < width - 10; x += 3) {
            let lineStart = null;
            let strongPixels = 0;
            
            for (let y = 5; y < height - 5; y++) {
                const edgeStrength = edgeData[y * width + x];
                
                if (edgeStrength > threshold) {
                    if (!lineStart) {
                        lineStart = y;
                        strongPixels = 1;
                    } else {
                        strongPixels++;
                    }
                } else {
                    if (lineStart && strongPixels > minLength) {
                        lines.push({
                            x1: x,
                            y1: lineStart,
                            x2: x,
                            y2: y - 1,
                            length: y - lineStart,
                            direction: 'vertical',
                            strength: strongPixels
                        });
                    }
                    lineStart = null;
                    strongPixels = 0;
                }
            }
            
            // Check for line at end of column
            if (lineStart && strongPixels > minLength) {
                lines.push({
                    x1: x,
                    y1: lineStart,
                    x2: x,
                    y2: height - 5,
                    length: height - 5 - lineStart,
                    direction: 'vertical',
                    strength: strongPixels
                });
            }
        }
        
        // Filter and merge nearby similar lines
        return this.mergeSimilarLines(lines);
    }
    
    mergeSimilarLines(lines) {
        const merged = [];
        const used = new Set();
        const tolerance = 15; // Pixel tolerance for merging
        
        for (let i = 0; i < lines.length; i++) {
            if (used.has(i)) continue;
            
            const line1 = lines[i];
            const similarLines = [line1];
            used.add(i);
            
            // Find similar lines to merge
            for (let j = i + 1; j < lines.length; j++) {
                if (used.has(j)) continue;
                
                const line2 = lines[j];
                
                if (line1.direction === line2.direction) {
                    let similar = false;
                    
                    if (line1.direction === 'horizontal') {
                        // Same horizontal line if y values are close
                        if (Math.abs(line1.y1 - line2.y1) < tolerance) {
                            similar = true;
                        }
                    } else {
                        // Same vertical line if x values are close
                        if (Math.abs(line1.x1 - line2.x1) < tolerance) {
                            similar = true;
                        }
                    }
                    
                    if (similar) {
                        similarLines.push(line2);
                        used.add(j);
                    }
                }
            }
            
            // Merge similar lines into one
            if (similarLines.length > 0) {
                const mergedLine = this.mergeLineGroup(similarLines);
                merged.push(mergedLine);
            }
        }
        
        return merged;
    }
    
    mergeLineGroup(lineGroup) {
        const direction = lineGroup[0].direction;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let totalStrength = 0;
        
        for (const line of lineGroup) {
            minX = Math.min(minX, line.x1, line.x2);
            maxX = Math.max(maxX, line.x1, line.x2);
            minY = Math.min(minY, line.y1, line.y2);
            maxY = Math.max(maxY, line.y1, line.y2);
            totalStrength += line.strength;
        }
        
        if (direction === 'horizontal') {
            const avgY = Math.round((minY + maxY) / 2);
            return {
                x1: minX,
                y1: avgY,
                x2: maxX,
                y2: avgY,
                length: maxX - minX,
                direction: 'horizontal',
                strength: totalStrength
            };
        } else {
            const avgX = Math.round((minX + maxX) / 2);
            return {
                x1: avgX,
                y1: minY,
                x2: avgX,
                y2: maxY,
                length: maxY - minY,
                direction: 'vertical',
                strength: totalStrength
            };
        }
    }
    
    drawDetectedEdges() {
        for (const edge of this.detectedEdges) {
            // Determine edge styling based on state
            let strokeStyle = '#ff6b35';
            let lineWidth = 2;
            let dashPattern = [5, 3];
            
            if (this.selectedEdges.has(edge.id)) {
                strokeStyle = '#22c55e'; // Green for selected
                lineWidth = 4;
                dashPattern = [];
            } else if (this.hoveredEdge === edge.id) {
                strokeStyle = '#3b82f6'; // Blue for hovered
                lineWidth = 4;
                dashPattern = [8, 4];
            }
            
            this.ctx.strokeStyle = strokeStyle;
            this.ctx.lineWidth = lineWidth;
            this.ctx.setLineDash(dashPattern);
            
            this.ctx.beginPath();
            this.ctx.moveTo(edge.start.x, edge.start.y);
            this.ctx.lineTo(edge.end.x, edge.end.y);
            this.ctx.stroke();
            
            // Draw edge label only for selected or hovered edges
            if (this.selectedEdges.has(edge.id) || this.hoveredEdge === edge.id) {
                const midX = (edge.start.x + edge.end.x) / 2;
                const midY = (edge.start.y + edge.end.y) / 2;
                
                this.ctx.fillStyle = strokeStyle;
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                
                const labelY = edge.direction === 'horizontal' ? 
                    (edge.start.y < midY ? midY + 20 : midY - 10) : midY;
                const labelX = edge.direction === 'vertical' ?
                    (edge.start.x < midX ? midX + 50 : midX - 50) : midX;
                    
                // Add background to label
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                const textWidth = this.ctx.measureText(edge.name).width;
                this.ctx.fillRect(labelX - textWidth/2 - 4, labelY - 8, textWidth + 8, 16);
                
                this.ctx.fillStyle = strokeStyle;
                this.ctx.fillText(edge.name, labelX, labelY + 4);
            }
        }
        
        this.ctx.setLineDash([]);
    }
    
    drawEdgeDetectionDebug() {
        // Show edge detection results as debug overlay
        const { width, height } = this.layoutBounds;
        const imageData = this.ctx.getImageData(0, 0, width, height);
        const sobelData = this.applySobelFilter(imageData);
        
        // Create debug canvas overlay
        const debugImageData = this.ctx.createImageData(width, height);
        
        for (let i = 0; i < sobelData.length; i++) {
            const edgeStrength = Math.min(255, sobelData[i]);
            const pixelIndex = i * 4;
            
            // Show edges in red
            debugImageData.data[pixelIndex] = edgeStrength; // R
            debugImageData.data[pixelIndex + 1] = 0; // G  
            debugImageData.data[pixelIndex + 2] = 0; // B
            debugImageData.data[pixelIndex + 3] = edgeStrength > 50 ? 128 : 0; // A (semi-transparent)
        }
        
        // Draw debug overlay
        this.ctx.putImageData(debugImageData, 0, 0);
    }
    
    checkEdgeHover(mouseX, mouseY) {
        const tolerance = 10; // Pixels
        let foundEdge = null;
        
        for (const edge of this.detectedEdges) {
            const distance = this.distanceToLine(
                mouseX, mouseY,
                edge.start.x, edge.start.y,
                edge.end.x, edge.end.y
            );
            
            if (distance < tolerance) {
                foundEdge = edge.id;
                break;
            }
        }
        
        if (foundEdge !== this.hoveredEdge) {
            this.hoveredEdge = foundEdge;
            this.canvas.style.cursor = foundEdge ? 'pointer' : 'default';
            this.drawImageToCanvas();
        }
    }
    
    distanceToLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));
        
        const xx = x1 + param * C;
        const yy = y1 + param * D;
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    selectEdge(edgeId) {
        const edge = this.detectedEdges.find(e => e.id === edgeId);
        if (!edge) return;
        
        if (this.selectedEdges.has(edgeId)) {
            // Deselect
            this.selectedEdges.delete(edgeId);
            delete this.edgeDimensions[edgeId];
        } else {
            // Select and prompt for dimension
            const dimension = prompt(`Enter dimension for ${edge.name} (in feet):`);
            if (dimension && !isNaN(dimension) && parseFloat(dimension) > 0) {
                this.selectedEdges.add(edgeId);
                this.edgeDimensions[edgeId] = parseFloat(dimension);
            }
        }
        
        this.updateDimensionsList();
        this.drawImageToCanvas();
    }
    
    showDimensionInputs() {
        const container = document.getElementById('addedDimensions');
        container.innerHTML = '<h4>Hover over edges to highlight, click to add dimensions:</h4>';
        
        const instructionDiv = document.createElement('div');
        instructionDiv.className = 'dimension-instructions';
        instructionDiv.innerHTML = `
            <p><strong>🎯 How to use:</strong></p>
            <p>• Orange lines: Detected edges</p>
            <p>• Blue highlight: Hover over edge</p>
            <p>• Green lines: Selected with dimensions</p>
            <p>• Click any edge to add its measurement</p>
        `;
        container.appendChild(instructionDiv);
        
        this.updateDimensionsList();
    }
    
    updateDimensionsList() {
        const container = document.getElementById('addedDimensions');
        
        // Remove existing selected dimensions list
        const existingList = container.querySelector('.selected-dimensions');
        if (existingList) existingList.remove();
        
        if (this.selectedEdges.size > 0) {
            const selectedDiv = document.createElement('div');
            selectedDiv.className = 'selected-dimensions';
            selectedDiv.innerHTML = '<h4>Selected Edges:</h4>';
            
            for (const edgeId of this.selectedEdges) {
                const edge = this.detectedEdges.find(e => e.id === edgeId);
                const dimension = this.edgeDimensions[edgeId];
                
                if (edge && dimension) {
                    const item = document.createElement('div');
                    item.className = 'dimension-item';
                    item.innerHTML = `
                        <span class="dimension-line">${edge.name}</span>
                        <span class="dimension-value">${dimension} ft</span>
                        <button class="remove-btn" onclick="optimizer.removeEdgeDimension('${edgeId}')">×</button>
                    `;
                    selectedDiv.appendChild(item);
                }
            }
            
            if (this.selectedEdges.size >= 2) {
                const calculateBtn = document.createElement('button');
                calculateBtn.className = 'btn btn-primary';
                calculateBtn.textContent = 'Calculate Optimal Layout';
                calculateBtn.onclick = () => this.calculateOptimalLayout();
                selectedDiv.appendChild(calculateBtn);
            } else {
                const message = document.createElement('p');
                message.textContent = 'Add at least 2 edge dimensions to calculate layout.';
                message.style.color = '#666';
                message.style.fontStyle = 'italic';
                selectedDiv.appendChild(message);
            }
            
            container.appendChild(selectedDiv);
        }
    }
    
    removeEdgeDimension(edgeId) {
        this.selectedEdges.delete(edgeId);
        delete this.edgeDimensions[edgeId];
        this.updateDimensionsList();
        this.drawImageToCanvas();
    }
    
    calculateOptimalLayout() {
        // Get dimensions from inputs
        let validDimensions = 0;
        for (const edge of this.detectedEdges) {
            const input = document.getElementById(`edge-${edge.id}`);
            const value = parseFloat(input.value);
            if (value && value > 0) {
                this.edgeDimensions[edge.id] = value;
                validDimensions++;
            }
        }
        
        if (validDimensions < 2) {
            alert('Please enter at least 2 edge dimensions to establish scale.');
            return;
        }
        
        // Calculate scale and layout dimensions
        this.calculateScale();
        this.calculateOptimalRackCount();
        this.runOptimization();
    }
    
    calculateScale() {
        // Use first available dimension to calculate pixels per foot
        for (const edge of this.detectedEdges) {
            if (this.edgeDimensions[edge.id]) {
                this.scale = edge.length / this.edgeDimensions[edge.id];
                break;
            }
        }
    }
    
    calculateOptimalRackCount() {
        // Get layout dimensions in feet
        const widthFeet = this.edgeDimensions.top || this.edgeDimensions.bottom;
        const heightFeet = this.edgeDimensions.left || this.edgeDimensions.right;
        
        if (!widthFeet || !heightFeet) return 0;
        
        const totalArea = widthFeet * heightFeet;
        const processingArea = 150; // Fixed processing area
        const aisleArea = (widthFeet + heightFeet) * 3; // Approximate aisle space
        const usableArea = totalArea - processingArea - aisleArea;
        
        // Standard rack is 4x8 = 32 sq ft
        const rackArea = 32;
        const maxRacks = Math.floor(usableArea / rackArea);
        
        // Update the input field
        document.getElementById('totalRacks').value = Math.max(5, maxRacks);
        
        return maxRacks;
    }
    
    runOptimization() {
        // Trigger the existing optimization with calculated values
        optimizeLayout();
    }
    
    handleDimensionClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = this.canvas.getBoundingClientRect();
        // Much more accurate coordinate calculation
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = ((e.clientX - rect.left) * scaleX - this.panOffset.x) / this.zoomLevel;
        const y = ((e.clientY - rect.top) * scaleY - this.panOffset.y) / this.zoomLevel;
        
        this.currentDimensionPoints.push({ x, y });
        console.log(`Clicked point: (${Math.round(x)}, ${Math.round(y)})`);
        
        // Show visual feedback
        this.drawImageToCanvas();
        this.drawTemporaryPoints();
        
        if (this.currentDimensionPoints.length === 1) {
            // First point clicked, show instruction for second point
            const btn = document.getElementById('dimensionModeBtn');
            btn.textContent = 'Click second point to complete dimension';
        }
        
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
            
            // Reset button text
            const btn = document.getElementById('dimensionModeBtn');
            btn.textContent = 'Click 2 points to add dimension';
        }
    }
    
    drawTemporaryPoints() {
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2 / this.zoomLevel;
        
        for (const point of this.currentDimensionPoints) {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 5 / this.zoomLevel, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        // Draw line between points if we have 2
        if (this.currentDimensionPoints.length === 2) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 3 / this.zoomLevel;
            this.ctx.setLineDash([5 / this.zoomLevel, 5 / this.zoomLevel]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentDimensionPoints[0].x, this.currentDimensionPoints[0].y);
            this.ctx.lineTo(this.currentDimensionPoints[1].x, this.currentDimensionPoints[1].y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
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
            // Switch to full layout view
            document.querySelector('.optimizer-container').classList.add('full-layout');
            document.getElementById('uploadedImageContainer').style.display = 'block';
            document.getElementById('imageUploadArea').style.display = 'none';
            document.getElementById('dimensionsInputGroup').style.display = 'block';
            
            // Hide the old dimension mode button and show dimension inputs
            document.getElementById('dimensionModeBtn').style.display = 'none';
            optimizer.showDimensionInputs();
            
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
    optimizer.zoomLevel = 1.5; // Moderate zoom for better accuracy
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
    
    // Get rack quantity (simplified to one type)
    const totalRacks = parseInt(document.getElementById('totalRacks').value) || 25;
    const rackCounts = {
        standard: totalRacks
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