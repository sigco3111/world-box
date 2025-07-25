class TerrainGenerator {
    constructor(map) {
        this.map = map;
    }
    
    generateRandomMap() {
        // Reset the map
        this.map.clearMap();
        
        // Generate a perlin noise-like terrain
        this.generateContinents();
        this.addMountains();
        this.addHills();
        this.addJungles();
        this.addForests();
        this.addMarshes();
        this.addSnow();
        this.addSavanna();
        
        // Render the new map
        this.map.render();
    }
    
    generateContinents() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Create more realistic continental plates
        const numContinents = Math.floor(Math.random() * 3) + 3; // 3-5 continents
        const continentCenters = [];
        
        for (let i = 0; i < numContinents; i++) {
            continentCenters.push({
                x: Math.floor(Math.random() * width),
                y: Math.floor(Math.random() * height),
                size: Math.floor(Math.random() * 50) + 30,
                shape: Math.random() * 0.4 + 0.6, // Shape factor (0.6-1.0) - lower values = more irregular shapes
                elevation: Math.random() * 0.5 + 0.5, // Random elevation factor for more variety
                distortion: Math.random() * 0.3 + 0.1 // Distortion factor for more natural shapes
            });
        }
        
        // Generate Perlin noise for natural terrain variation
        const perlinNoise = this.generatePerlinNoise(width, height, 8); // 8 = octaves
        const secondaryNoise = this.generatePerlinNoise(width, height, 4); // For additional variation
        
        // Generate landmass based on distance from continent centers plus noise
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Find minimum distance to any continent center
                let minDistance = Number.MAX_VALUE;
                let continentIndex = -1;
                
                for (let i = 0; i < continentCenters.length; i++) {
                    const center = continentCenters[i];
                    // Use stretched distance for more realistic continents with distortion
                    const angle = Math.atan2(y - center.y, x - center.x);
                    const distortionFactor = 1 + center.distortion * Math.sin(angle * 3);
                    const dx = (x - center.x) * (1 + 0.5 * Math.sin(x * 0.05 + y * 0.03));
                    const dy = (y - center.y) * (1 + 0.5 * Math.cos(y * 0.05 + x * 0.02));
                    
                    // Apply shape factor for less round continents
                    const distance = Math.sqrt(dx * dx + dy * dy) / (center.size * center.shape * distortionFactor);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        continentIndex = i;
                    }
                }
                
                // Add Perlin noise to the distance (30% influence)
                const noiseValue = perlinNoise[y][x];
                const secondNoiseValue = secondaryNoise[y][x];
                const noiseInfluence = 0.3 + secondNoiseValue * 0.1; // Variable noise influence
                minDistance = minDistance * (1 - noiseInfluence) + (1 - noiseValue) * noiseInfluence;
                
                // Apply elevation factor of the continent
                if (continentIndex >= 0) {
                    minDistance *= 1 / continentCenters[continentIndex].elevation;
                }
                
                // Set terrain based on distance with more gradual transitions
                if (minDistance < 0.45) {
                    this.map.terrainMap[y][x] = 'grassland';
                } else if (minDistance < 0.55) {
                    this.map.terrainMap[y][x] = 'sand';
                } else if (minDistance < 0.65) {
                    this.map.terrainMap[y][x] = 'shallow-water';
                } else if (minDistance < 0.8) {
                    this.map.terrainMap[y][x] = 'medium-water';
                } else {
                    this.map.terrainMap[y][x] = 'deep-water';
                }
            }
        }
        
        // Add continent drift features (faults, mountain ranges at edges)
        this.addContinentDriftFeatures(continentCenters);
        
        // Add rivers to the terrain
        this.addRivers();
        
        // Smooth the terrain
        this.smoothTerrain(3);
    }
    
    generatePerlinNoise(width, height, octaves) {
        const noise = [];
        
        // Initialize 2D array
        for (let y = 0; y < height; y++) {
            noise[y] = [];
            for (let x = 0; x < width; x++) {
                noise[y][x] = 0;
            }
        }
        
        // Generate white noise base
        const baseNoise = [];
        for (let y = 0; y < height; y++) {
            baseNoise[y] = [];
            for (let x = 0; x < width; x++) {
                baseNoise[y][x] = Math.random();
            }
        }
        
        // Generate Perlin noise using multiple octaves
        let amplitude = 1.0;
        let totalAmplitude = 0.0;
        
        // Add multiple layers of noise at different frequencies
        for (let octave = 0; octave < octaves; octave++) {
            amplitude *= 0.5;
            totalAmplitude += amplitude;
            
            const period = Math.pow(2, octave);
            const frequency = 1.0 / period;
            
            for (let y = 0; y < height; y++) {
                const y0 = Math.floor(y * frequency) % height;
                const y1 = (y0 + 1) % height;
                const yBlend = (y * frequency) - Math.floor(y * frequency);
                
                for (let x = 0; x < width; x++) {
                    const x0 = Math.floor(x * frequency) % width;
                    const x1 = (x0 + 1) % width;
                    const xBlend = (x * frequency) - Math.floor(x * frequency);
                    
                    // Bilinear interpolation of base noise values
                    const top = this.interpolate(baseNoise[y0][x0], baseNoise[y0][x1], xBlend);
                    const bottom = this.interpolate(baseNoise[y1][x0], baseNoise[y1][x1], xBlend);
                    
                    noise[y][x] += this.interpolate(top, bottom, yBlend) * amplitude;
                }
            }
        }
        
        // Normalize values to range [0, 1]
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                noise[y][x] /= totalAmplitude;
            }
        }
        
        return noise;
    }
    
    interpolate(a, b, blend) {
        // Cosine interpolation
        const theta = blend * Math.PI;
        const f = (1 - Math.cos(theta)) * 0.5;
        return a * (1 - f) + b * f;
    }
    
    addContinentDriftFeatures(continentCenters) {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Create fault lines between continents
        for (let i = 0; i < continentCenters.length; i++) {
            for (let j = i + 1; j < continentCenters.length; j++) {
                const center1 = continentCenters[i];
                const center2 = continentCenters[j];
                
                // Check if continents are close enough to interact
                const dx = center2.x - center1.x;
                const dy = center2.y - center1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < (center1.size + center2.size) * 1.5) {
                    // Create a mountain range between these continents
                    this.createFaultMountains(center1, center2);
                }
            }
        }
    }
    
    createFaultMountains(center1, center2) {
        // Create a mountain range along the fault line between two continents
        const steps = Math.floor(Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2)) / 2);
        
        // Find the midpoint between continents
        const midX = (center1.x + center2.x) / 2;
        const midY = (center1.y + center2.y) / 2;
        
        // Calculate perpendicular vector to create a curved fault line
        const dx = center2.x - center1.x;
        const dy = center2.y - center1.y;
        const perpX = -dy;
        const perpY = dx;
        
        // Normalize perpendicular vector
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        const normPerpX = perpX / perpLength;
        const normPerpY = perpY / perpLength;
        
        // Create mountain range along a curved path
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1); // 0 to 1
            
            // Create curved path using quadratic interpolation
            const curveAmount = Math.sin(t * Math.PI) * 10; // Maximum curve in the middle
            
            const x = Math.floor(center1.x + dx * t + normPerpX * curveAmount);
            const y = Math.floor(center1.y + dy * t + normPerpY * curveAmount);
            
            // Place mountains with randomness
            if (x >= 0 && x < this.map.mapWidth && y >= 0 && y < this.map.mapHeight) {
                // Only place mountains on land
                if (this.map.terrainMap[y][x] !== 'shallow-water' && 
                    this.map.terrainMap[y][x] !== 'medium-water' && 
                    this.map.terrainMap[y][x] !== 'deep-water') {
                    
                    this.map.terrainMap[y][x] = 'mountains';
                    
                    // Add surrounding mountains and hills
                    const radius = Math.floor(Math.random() * 2) + 2;
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                
                                if (distance <= radius * 0.7 && Math.random() < 0.7) {
                                    if (this.map.terrainMap[ny][nx] !== 'shallow-water' && 
                                        this.map.terrainMap[ny][nx] !== 'medium-water' && 
                                        this.map.terrainMap[ny][nx] !== 'deep-water') {
                                        
                                        this.map.terrainMap[ny][nx] = 'mountains';
                                    }
                                } else if (distance <= radius && Math.random() < 0.8) {
                                    if (this.map.terrainMap[ny][nx] !== 'shallow-water' && 
                                        this.map.terrainMap[ny][nx] !== 'medium-water' && 
                                        this.map.terrainMap[ny][nx] !== 'deep-water') {
                                        
                                        this.map.terrainMap[ny][nx] = 'hills';
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    generateContinent() {
        // Reset the map to all deep water
        this.map.clearMap();
        
        // Generate a single large continent
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const continentRadius = Math.min(width, height) * 0.4;
        
        // Generate a more complex continent shape using perlin noise
        const baseNoise = this.generatePerlinNoise(width, height, 6);
        const detailNoise = this.generatePerlinNoise(width, height, 3);
        
        // Apply fractal distortion to create more realistic coastlines
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                
                // Base distance from center
                let distanceFromCenter = Math.sqrt(dx * dx + dy * dy) / continentRadius;
                
                // Apply angular distortion for less circular shape
                const angle = Math.atan2(dy, dx);
                const distortion = 0.2 * Math.sin(angle * 3) + 0.1 * Math.cos(angle * 7);
                distanceFromCenter += distortion;
                
                // Add noise-based coastline variation
                const noiseValue = baseNoise[y % height][x % width];
                const detailNoiseValue = detailNoise[y % height][x % width];
                const coastNoiseInfluence = 0.3 + 0.1 * Math.sin(angle * 5);
                
                // Final distance with noise
                const adjustedDistance = distanceFromCenter - coastNoiseInfluence * noiseValue - 0.1 * detailNoiseValue;
                
                // Determine terrain type based on distance
                if (adjustedDistance < 0.55) {
                    this.map.terrainMap[y][x] = 'grassland';
                } else if (adjustedDistance < 0.65) {
                    this.map.terrainMap[y][x] = 'sand';
                } else if (adjustedDistance < 0.75) {
                    this.map.terrainMap[y][x] = 'shallow-water';
                } else if (adjustedDistance < 0.85) {
                    this.map.terrainMap[y][x] = 'medium-water';
                } else {
                    this.map.terrainMap[y][x] = 'deep-water';
                }
            }
        }
        
        // Add rivers
        this.addRiversToContinent();
        
        // Add more geographic features
        this.smoothTerrain(2);
        this.addMountains();
        this.addHills();
        this.addJungles();
        this.addForests();
        this.addMarshes();
        this.addSnow();
        this.addSavanna();
        
        this.map.render();
    }
    
    generateArchipelago() {
        // Reset the map to all deep water
        this.map.clearMap();
        
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Generate base noise for island distribution
        const baseNoise = this.generatePerlinNoise(width, height, 4);
        const detailNoise = this.generatePerlinNoise(width, height, 8);
        
        // Generate many islands with diverse shapes
        const numIslands = Math.floor(Math.random() * 30) + 20; // 20-50 islands
        const islands = [];
        
        // Create primary island clusters
        for (let i = 0; i < numIslands; i++) {
            islands.push({
                centerX: Math.random() * width,
                centerY: Math.random() * height,
                size: Math.random() * 15 + 5, // Island radius 5-20
                shape: Math.random() * 0.5 + 0.5, // Shape factor for irregularity
                orientation: Math.random() * Math.PI * 2, // Random orientation
                elongation: Math.random() * 0.7 + 0.5 // How elongated the island is
            });
        }
        
        // Create island chains (5-8 chains)
        const numChains = Math.floor(Math.random() * 4) + 5;
        for (let i = 0; i < numChains; i++) {
            // Start point of the chain
            const startX = Math.random() * width;
            const startY = Math.random() * height;
            
            // Direction of the chain
            const angle = Math.random() * Math.PI * 2;
            const length = Math.random() * 15 + 10;
            
            // Create 3-7 islands along the chain
            const chainIslands = Math.floor(Math.random() * 5) + 3;
            for (let j = 0; j < chainIslands; j++) {
                const distance = (j / (chainIslands - 1)) * length;
                const islandX = startX + Math.cos(angle) * distance * 10;
                const islandY = startY + Math.sin(angle) * distance * 10;
                
                // Slight variation in position
                const jitter = 3 + Math.random() * 2;
                const jitterAngle = Math.random() * Math.PI * 2;
                
                islands.push({
                    centerX: islandX + Math.cos(jitterAngle) * jitter,
                    centerY: islandY + Math.sin(jitterAngle) * jitter,
                    size: Math.random() * 8 + 3, // Smaller islands in chains
                    shape: Math.random() * 0.3 + 0.7, // More regular shape
                    orientation: angle + Math.PI/2, // Perpendicular to chain direction
                    elongation: Math.random() * 0.3 + 0.8 // More elongated for chain islands
                });
            }
        }
        
        // Apply islands to the map
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate influence from all islands
                let minIslandDistance = 1.0;
                
                for (const island of islands) {
                    // Calculate distance with shape distortion
                    const dx = (x - island.centerX);
                    const dy = (y - island.centerY);
                    
                    // Rotate coordinates based on island orientation
                    const rotatedX = dx * Math.cos(island.orientation) - dy * Math.sin(island.orientation);
                    const rotatedY = dx * Math.sin(island.orientation) + dy * Math.cos(island.orientation);
                    
                    // Apply elongation
                    const stretchedX = rotatedX / island.elongation;
                    const stretchedY = rotatedY;
                    
                    // Calculate base distance
                    const distance = Math.sqrt(stretchedX * stretchedX + stretchedY * stretchedY) / island.size;
                    
                    // Apply noise distortion
                    const noiseValue = 0.7 * baseNoise[y % height][x % width] + 0.3 * detailNoise[y % height][x % width];
                    const adjustedDistance = distance * (1 + 0.3 * (noiseValue - 0.5));
                    
                    // Keep track of minimum distance
                    minIslandDistance = Math.min(minIslandDistance, adjustedDistance);
                }
                
                // Set terrain based on distance
                if (minIslandDistance < 0.7) {
                    this.map.terrainMap[y][x] = 'grassland';
                } else if (minIslandDistance < 0.9) {
                    this.map.terrainMap[y][x] = 'sand';
                } else if (minIslandDistance < 1.1) {
                    this.map.terrainMap[y][x] = 'shallow-water';
                } else if (minIslandDistance < 1.3) {
                    this.map.terrainMap[y][x] = 'medium-water';
                } else {
                    this.map.terrainMap[y][x] = 'deep-water';
                }
            }
        }
        
        // Add additional features
        this.smoothTerrain(2);
        this.addHills();
        this.addJungles();
        this.addForests();
        this.addCoralReefs();
        
        this.map.render();
    }
    
    addMountains() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add mountain ranges
        const numMountainRanges = Math.floor(Math.random() * 4) + 2; // 2-5 mountain ranges
        
        for (let i = 0; i < numMountainRanges; i++) {
            const startX = Math.floor(Math.random() * width);
            const startY = Math.floor(Math.random() * height);
            const length = Math.floor(Math.random() * 30) + 20;
            const angle = Math.random() * Math.PI * 2;
            
            let x = startX;
            let y = startY;
            
            for (let j = 0; j < length; j++) {
                // Only place mountains on land
                if (y >= 0 && y < height && x >= 0 && x < width) {
                    if (this.map.terrainMap[y][x] !== 'shallow-water' && 
                        this.map.terrainMap[y][x] !== 'medium-water' && 
                        this.map.terrainMap[y][x] !== 'deep-water') {
                        
                        // Place a mountain with some surrounding mountains
                        this.map.setTerrain(x, y, 'mountains', 2);
                    }
                }
                
                // Move in the direction of the mountain range with some randomness
                x += Math.cos(angle + (Math.random() * 0.5 - 0.25));
                y += Math.sin(angle + (Math.random() * 0.5 - 0.25));
                x = Math.floor(x);
                y = Math.floor(y);
            }
        }
    }
    
    addHills() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add hills around mountains and in other areas
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Add hills around mountains
                if (this.map.terrainMap[y][x] === 'mountains') {
                    this.addHillsAroundMountain(x, y);
                }
                
                // Random hills on grassland (7% chance)
                if (this.map.terrainMap[y][x] === 'grassland' && Math.random() < 0.07) {
                    this.map.setTerrain(x, y, 'hills', 1 + Math.floor(Math.random() * 2));
                }
            }
        }
    }
    
    addHillsAroundMountain(x, y) {
        const radius = 3;
        const startX = Math.max(0, x - radius);
        const endX = Math.min(this.map.mapWidth - 1, x + radius);
        const startY = Math.max(0, y - radius);
        const endY = Math.min(this.map.mapHeight - 1, y + radius);

        for (let y2 = startY; y2 <= endY; y2++) {
            for (let x2 = startX; x2 <= endX; x2++) {
                const distance = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2);
                if (distance > 2 && distance <= radius) {
                    if (this.map.terrainMap[y2][x2] === 'grassland' && Math.random() < 0.7) {
                        this.map.terrainMap[y2][x2] = 'hills';
                    }
                }
            }
        }
    }
    
    addJungles() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add jungle areas
        const numJungleAreas = Math.floor(Math.random() * 4) + 3; // 3-6 jungle areas
        
        for (let i = 0; i < numJungleAreas; i++) {
            const centerX = Math.floor(Math.random() * width);
            const centerY = Math.floor(Math.random() * height);
            const radius = Math.floor(Math.random() * 15) + 10;
            
            // Fill the jungle area
            for (let y = Math.max(0, centerY - radius); y < Math.min(height, centerY + radius); y++) {
                for (let x = Math.max(0, centerX - radius); x < Math.min(width, centerX + radius); x++) {
                    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    if (distance < radius * (0.8 + Math.random() * 0.4)) {
                        // Only place jungle on grassland
                        if (this.map.terrainMap[y][x] === 'grassland') {
                            this.map.terrainMap[y][x] = 'jungle';
                        }
                    }
                }
            }
        }
    }
    
    addForests() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add forest areas
        const numForestAreas = Math.floor(Math.random() * 4) + 3; 
        
        for (let i = 0; i < numForestAreas; i++) {
            const centerX = Math.floor(Math.random() * width);
            const centerY = Math.floor(Math.random() * height);
            const radius = Math.floor(Math.random() * 15) + 10;
            
            // Fill the forest area
            for (let y = Math.max(0, centerY - radius); y < Math.min(height, centerY + radius); y++) {
                for (let x = Math.max(0, centerX - radius); x < Math.min(width, centerX + radius); x++) {
                    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    if (distance < radius * (0.8 + Math.random() * 0.4)) {
                        // Only place forest on grassland
                        if (this.map.terrainMap[y][x] === 'grassland') {
                            this.map.terrainMap[y][x] = 'forest';
                        }
                    }
                }
            }
        }
    }
    
    addMarshes() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add marsh areas near water
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                // Check if near water
                let nearWater = false;
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const terrain = this.map.terrainMap[ny][nx];
                            if (terrain.includes('water')) {
                                nearWater = true;
                                break;
                            }
                        }
                    }
                    if (nearWater) break;
                }
                
                // Place marsh on grassland near water with 25% chance
                if (nearWater && this.map.terrainMap[y][x] === 'grassland' && Math.random() < 0.25) {
                    this.map.terrainMap[y][x] = 'marsh';
                }
            }
        }
    }
    
    addSnow() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add snow at mountain peaks and in northern regions
        for (let y = 0; y < Math.floor(height * 0.2); y++) {
            for (let x = 0; x < width; x++) {
                // Northern snow region with some randomness
                if (this.map.terrainMap[y][x] !== 'shallow-water' && 
                    this.map.terrainMap[y][x] !== 'medium-water' && 
                    this.map.terrainMap[y][x] !== 'deep-water' && 
                    Math.random() < 0.7 - (y / (height * 0.25))) {
                    this.map.terrainMap[y][x] = 'snow';
                }
            }
        }
        
        // Snow on mountains
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.map.terrainMap[y][x] === 'mountains' && Math.random() < 0.4) {
                    this.map.terrainMap[y][x] = 'snow';
                }
            }
        }
    }
    
    addSavanna() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Add savanna areas near desert
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Check if near desert
                let nearDesert = false;
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (this.map.terrainMap[ny][nx] === 'sand') {
                                nearDesert = true;
                                break;
                            }
                        }
                    }
                    if (nearDesert) break;
                }
                
                // Place savanna on grassland near desert with 40% chance
                if (nearDesert && this.map.terrainMap[y][x] === 'grassland' && Math.random() < 0.4) {
                    this.map.terrainMap[y][x] = 'savanna';
                }
            }
        }
    }
    
    smoothTerrain(iterations) {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        for (let iter = 0; iter < iterations; iter++) {
            const newTerrain = JSON.parse(JSON.stringify(this.map.terrainMap));
            
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    // Count neighboring terrain types
                    const neighbors = {};
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const nx = x + dx;
                            const ny = y + dy;
                            const terrain = this.map.terrainMap[ny][nx];
                            
                            if (!neighbors[terrain]) {
                                neighbors[terrain] = 0;
                            }
                            neighbors[terrain]++;
                        }
                    }
                    
                    // Find most common neighboring terrain
                    let maxCount = 0;
                    let mostCommon = this.map.terrainMap[y][x];
                    
                    for (const terrain in neighbors) {
                        if (neighbors[terrain] > maxCount) {
                            maxCount = neighbors[terrain];
                            mostCommon = terrain;
                        }
                    }
                    
                    // If most neighbors are a different terrain, switch to that terrain
                    if (maxCount > 5) {
                        newTerrain[y][x] = mostCommon;
                    }
                }
            }
            
            this.map.terrainMap = newTerrain;
        }
    }
    
    addRivers() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Number of rivers to attempt
        const numRivers = Math.floor(Math.random() * 5) + 5;
        
        for (let i = 0; i < numRivers; i++) {
            // Find a suitable mountain or hill tile to start the river
            const potentialSources = [];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (this.map.terrainMap[y][x] === 'mountains' || this.map.terrainMap[y][x] === 'hills') {
                        potentialSources.push({x, y});
                    }
                }
            }
            
            if (potentialSources.length === 0) continue;
            
            const source = potentialSources[Math.floor(Math.random() * potentialSources.length)];
            let current = {x: source.x, y: source.y};
            let riverLength = 0;
            const maxLength = 100;
            
            // Create the river path
            while (riverLength < maxLength) {
                // Mark current tile as shallow water
                if (this.map.terrainMap[current.y][current.x] !== 'mountains') {
                    this.map.terrainMap[current.y][current.x] = 'shallow-water';
                }
                
                // Find the lowest neighbor
                const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0},
                                   {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}];
                
                let lowestElevation = Number.MAX_VALUE;
                let nextTile = null;
                const terrainElevation = {
                    'deep-water': 0,
                    'medium-water': 1,
                    'shallow-water': 2,
                    'sand': 3,
                    'marsh': 4,
                    'grassland': 5,
                    'savanna': 6,
                    'forest': 7,
                    'jungle': 8,
                    'hills': 9,
                    'mountains': 10,
                    'snow': 11
                };
                
                // Add some randomness to the flow direction
                directions.sort(() => Math.random() - 0.5);
                
                for (const dir of directions) {
                    const nx = current.x + dir.x;
                    const ny = current.y + dir.y;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const terrain = this.map.terrainMap[ny][nx];
                        const elevation = terrainElevation[terrain] || 5;
                        
                        // Prefer flowing downhill and avoid existing rivers
                        if (elevation < lowestElevation && (terrain !== 'shallow-water' || terrain.includes('water'))) {
                            lowestElevation = elevation;
                            nextTile = {x: nx, y: ny};
                        }
                    }
                }
                
                // If no suitable tile found or reached water, end the river
                if (!nextTile || lowestElevation <= 2) {
                    break;
                }
                
                current = nextTile;
                riverLength++;
            }
        }
    }
    
    addRiversToContinent() {
        // Similar to addRivers but specifically for single continent
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Number of rivers for a single continent
        const numRivers = Math.floor(Math.random() * 4) + 3;
        
        // Find the center of the continent
        let centerX = 0, centerY = 0, landCount = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.map.terrainMap[y][x] === 'grassland' || 
                    this.map.terrainMap[y][x] === 'hills' || 
                    this.map.terrainMap[y][x] === 'mountains') {
                    centerX += x;
                    centerY += y;
                    landCount++;
                }
            }
        }
        
        if (landCount === 0) return;
        
        centerX = Math.floor(centerX / landCount);
        centerY = Math.floor(centerY / landCount);
        
        // Create rivers radiating from near center
        for (let i = 0; i < numRivers; i++) {
            // Start near but not at center
            const angle = (i / numRivers) * Math.PI * 2;
            const distance = Math.random() * 20 + 10;
            const startX = Math.floor(centerX + Math.cos(angle) * distance);
            const startY = Math.floor(centerY + Math.sin(angle) * distance);
            
            // Ensure we're on land
            if (startX < 0 || startX >= width || startY < 0 || startY >= height ||
                this.map.terrainMap[startY][startX].includes('water')) {
                continue;
            }
            
            // Generate a river path toward the coast
            let current = {x: startX, y: startY};
            let riverLength = 0;
            const maxLength = 100;
            const riverPath = [{x: startX, y: startY}];
            
            while (riverLength < maxLength) {
                // Mark current tile as shallow water
                this.map.terrainMap[current.y][current.x] = 'shallow-water';
                
                // Flow generally outward from center
                const dx = current.x - centerX;
                const dy = current.y - centerY;
                const outwardAngle = Math.atan2(dy, dx);
                
                // Choose direction biased toward outward
                const directions = [];
                for (let dir = 0; dir < 8; dir++) {
                    const dirAngle = dir * Math.PI / 4;
                    // Calculate how close this direction is to outward
                    const angleDiff = Math.abs(((dirAngle - outwardAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
                    // Lower score is better
                    const score = angleDiff + Math.random() * 0.5;
                    directions.push({
                        dx: Math.round(Math.cos(dirAngle)),
                        dy: Math.round(Math.sin(dirAngle)),
                        score: score
                    });
                }
                
                // Sort by score (lowest first)
                directions.sort((a, b) => a.score - b.score);
                
                // Try directions in order
                let foundNext = false;
                for (const dir of directions) {
                    const nx = current.x + dir.dx;
                    const ny = current.y + dir.dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        // Check if we've reached the coast
                        const terrainType = this.map.terrainMap[ny][nx];
                        
                        if (terrainType === 'medium-water' || terrainType === 'deep-water') {
                            // Reached the sea, end river
                            foundNext = false;
                            break;
                        }
                        
                        // Avoid crossing other rivers
                        if (!riverPath.some(p => p.x === nx && p.y === ny)) {
                            current = {x: nx, y: ny};
                            riverPath.push(current);
                            foundNext = true;
                            break;
                        }
                    }
                }
                
                if (!foundNext) break;
                riverLength++;
            }
        }
    }
    
    addCoralReefs() {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Look for shallow water near islands
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.map.terrainMap[y][x] === 'shallow-water') {
                    // Check if near land
                    let nearLand = false;
                    const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0},
                                       {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}];
                    
                    for (const dir of directions) {
                        const nx = x + dir.x;
                        const ny = y + dir.y;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const terrain = this.map.terrainMap[ny][nx];
                            if (terrain === 'sand') {
                                nearLand = true;
                                break;
                            }
                        }
                    }
                    
                    // 25% chance to place coral reef near land
                    if (nearLand && Math.random() < 0.25) {
                        this.map.terrainMap[y][x] = 'coral';
                    }
                }
            }
        }
    }
    
    generateEarthLike() {
        // Reset the map
        this.map.clearMap();
        
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Create approximate Earth-like layout
        // This is a simplified version with major continents in roughly Earth-like positions
        
        // Fill the map with deep water
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.map.terrainMap[y][x] = 'deep-water';
            }
        }
        
        // North America
        this.createContinent({
            centerX: width * 0.25,
            centerY: height * 0.35,
            size: Math.min(width, height) * 0.25,
            shape: 0.65
        });
        
        // South America
        this.createContinent({
            centerX: width * 0.3,
            centerY: height * 0.7,
            size: Math.min(width, height) * 0.15,
            shape: 0.7
        });
        
        // Europe
        this.createContinent({
            centerX: width * 0.55,
            centerY: height * 0.3,
            size: Math.min(width, height) * 0.1,
            shape: 0.5
        });
        
        // Africa
        this.createContinent({
            centerX: width * 0.55,
            centerY: height * 0.55,
            size: Math.min(width, height) * 0.2,
            shape: 0.8
        });
        
        // Asia
        this.createContinent({
            centerX: width * 0.7,
            centerY: height * 0.35,
            size: Math.min(width, height) * 0.3,
            shape: 0.6
        });
        
        // Australia
        this.createContinent({
            centerX: width * 0.8,
            centerY: height * 0.7,
            size: Math.min(width, height) * 0.12,
            shape: 0.9
        });
        
        // Add polar ice caps
        const polarRegionSize = height * 0.15;
        for (let y = 0; y < polarRegionSize; y++) {
            for (let x = 0; x < width; x++) {
                if (this.map.terrainMap[y][x] !== 'deep-water' && 
                    this.map.terrainMap[y][x] !== 'medium-water' && 
                    this.map.terrainMap[y][x] !== 'shallow-water') {
                    this.map.terrainMap[y][x] = 'snow';
                }
            }
        }
        
        for (let y = height - polarRegionSize; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.map.terrainMap[y][x] !== 'deep-water' && 
                    this.map.terrainMap[y][x] !== 'medium-water' && 
                    this.map.terrainMap[y][x] !== 'shallow-water') {
                    this.map.terrainMap[y][x] = 'snow';
                }
            }
        }
        
        // Add geographic features
        this.addMountains();
        this.addHills();
        this.addJungles();
        this.addForests();
        this.addMarshes();
        this.addSavanna();
        this.addRivers();
        
        // Smooth the terrain
        this.smoothTerrain(2);
        
        // Render the map
        this.map.render();
    }
    
    createContinent(options) {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Generate perlin noise for continent shape
        const noise = this.generatePerlinNoise(width, height, 4);
        
        // Create the continent
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate distance from center with distortion
                const angle = Math.atan2(y - options.centerY, x - options.centerX);
                const distortion = 0.3 * Math.sin(angle * 2) + 0.2 * Math.cos(angle * 4);
                
                let dx = x - options.centerX;
                let dy = y - options.centerY;
                
                // Apply shape distortion based on angle
                dx *= (1 + distortion);
                dy *= (1 + distortion);
                
                const distance = Math.sqrt(dx * dx + dy * dy) / options.size;
                
                // Apply noise-based coastline variation
                const noiseValue = noise[y % height][x % width];
                const adjustedDistance = distance * (1 + 0.4 * (noiseValue - 0.5));
                
                // Set terrain type based on distance
                if (adjustedDistance < options.shape * 0.8) {
                    // Check if we're overwriting existing land
                    const currentTerrain = this.map.terrainMap[y][x];
                    if (currentTerrain === 'deep-water') {
                        this.map.terrainMap[y][x] = 'grassland';
                    }
                } else if (adjustedDistance < options.shape * 0.9) {
                    const currentTerrain = this.map.terrainMap[y][x];
                    if (currentTerrain === 'deep-water') {
                        this.map.terrainMap[y][x] = 'sand';
                    }
                } else if (adjustedDistance < options.shape) {
                    const currentTerrain = this.map.terrainMap[y][x];
                    if (currentTerrain === 'deep-water') {
                        this.map.terrainMap[y][x] = 'shallow-water';
                    }
                } else if (adjustedDistance < options.shape * 1.1) {
                    const currentTerrain = this.map.terrainMap[y][x];
                    if (currentTerrain === 'deep-water') {
                        this.map.terrainMap[y][x] = 'medium-water';
                    }
                }
            }
        }
    }
}