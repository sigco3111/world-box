class ProvinceGenerator {
    constructor(map) {
        this.map = map;
        this.provinceColors = ['#ff8080', '#80ff80', '#8080ff', '#ffff80', '#ff80ff', '#80ffff', 
                             '#ff8040', '#40ff80', '#8040ff', '#ff4080', '#80ff40', '#4080ff'];
    }
    
    generateProvinces() {
        // Only generate provinces for land areas
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Reset existing provinces
        this.map.provinceMap = new Array(height);
        for (let y = 0; y < height; y++) {
            this.map.provinceMap[y] = new Array(width).fill(null);
        }
        this.map.provinceNames = [];
        
        // Find all nations
        const nationTerritories = {};
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const nationId = this.map.nationMap[y][x];
                if (nationId !== null) {
                    if (!nationTerritories[nationId]) {
                        nationTerritories[nationId] = [];
                    }
                    nationTerritories[nationId].push({ x, y });
                }
            }
        }
        
        // For each nation, create provinces
        let provinceId = 1;
        for (const nationId in nationTerritories) {
            const territory = nationTerritories[nationId];
            const nation = nations.find(n => n.id === parseInt(nationId));
            
            if (!nation) continue;
            
            // Determine number of provinces based on territory size
            const provinceSize = 400; // Target pixels per province
            const numProvinces = Math.max(1, Math.floor(territory.length / provinceSize));
            
            if (numProvinces <= 1) {
                // Just one province for the entire territory
                const provinceName = this.generateProvinceName();
                const colorIndex = Math.floor(Math.random() * this.provinceColors.length);
                const color = this.adjustColor(this.provinceColors[colorIndex], nation.color);
                
                this.map.setProvince(provinceId, provinceName, color, territory);
                provinceId++;
            } else {
                // Use k-means to cluster territory into provinces
                this.createProvincesWithKMeans(territory, numProvinces, provinceId, nation);
                provinceId += numProvinces;
            }
        }
        
        this.map.render();
    }
    
    generateProvincesForNation(nationId, nationTerritories) {
        const width = this.map.mapWidth;
        const height = this.map.mapHeight;
        
        // Get the next available province ID
        let provinceId = 1;
        if (this.map.provinceNames.length > 0) {
            provinceId = Math.max(...this.map.provinceNames.map(p => p.id)) + 1;
        }
        
        // Clear existing provinces for this nation
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.map.nationMap[y][x] === nationId) {
                    this.map.provinceMap[y][x] = null;
                }
            }
        }
        
        // Filter out province names belonging to this nation
        this.map.provinceNames = this.map.provinceNames.filter(p => {
            const x = p.centerX;
            const y = p.centerY;
            return y < height && x < width && this.map.nationMap[y][x] !== nationId;
        });
        
        const territory = nationTerritories[nationId];
        const nation = nations.find(n => n.id === parseInt(nationId));
        
        if (!nation || !territory || territory.length === 0) return;
        
        // Determine number of provinces based on territory size
        const provinceSize = 400; // Target pixels per province
        const numProvinces = Math.max(1, Math.floor(territory.length / provinceSize));
        
        if (numProvinces <= 1) {
            // Just one province for the entire territory
            const provinceName = this.generateProvinceName();
            const colorIndex = Math.floor(Math.random() * this.provinceColors.length);
            const color = this.adjustColor(this.provinceColors[colorIndex], nation.color);
            
            this.map.setProvince(provinceId, provinceName, color, territory);
        } else {
            // Use k-means to cluster territory into provinces
            this.createProvincesWithKMeans(territory, numProvinces, provinceId, nation);
        }
        
        this.map.render();
    }
    
    createProvincesWithKMeans(points, k, startId, nation) {
        // Initialize centroids randomly
        const centroids = [];
        for (let i = 0; i < k; i++) {
            const randomIndex = Math.floor(Math.random() * points.length);
            centroids.push({
                x: points[randomIndex].x,
                y: points[randomIndex].y
            });
        }
        
        // Run k-means for a few iterations
        const iterations = 5;
        let clusters = [];
        
        for (let iter = 0; iter < iterations; iter++) {
            // Assign each point to nearest centroid
            clusters = Array(k).fill().map(() => []);
            
            for (const point of points) {
                let minDist = Number.MAX_VALUE;
                let minIndex = 0;
                
                for (let i = 0; i < k; i++) {
                    const dx = point.x - centroids[i].x;
                    const dy = point.y - centroids[i].y;
                    const dist = dx * dx + dy * dy;
                    
                    if (dist < minDist) {
                        minDist = dist;
                        minIndex = i;
                    }
                }
                
                clusters[minIndex].push(point);
            }
            
            // Update centroids
            for (let i = 0; i < k; i++) {
                if (clusters[i].length > 0) {
                    let sumX = 0, sumY = 0;
                    for (const point of clusters[i]) {
                        sumX += point.x;
                        sumY += point.y;
                    }
                    centroids[i].x = sumX / clusters[i].length;
                    centroids[i].y = sumY / clusters[i].length;
                }
            }
        }
        
        // Create provinces from clusters
        for (let i = 0; i < k; i++) {
            if (clusters[i].length > 0) {
                const provinceName = this.generateProvinceName();
                const colorIndex = Math.floor(Math.random() * this.provinceColors.length);
                const color = this.adjustColor(this.provinceColors[colorIndex], nation.color);
                
                this.map.setProvince(startId + i, provinceName, color, clusters[i]);
            }
        }
    }
    
    generateProvinceName() {
        const prefixes = ['North', 'South', 'East', 'West', 'Central', 'Upper', 'Lower', 'Greater', 'New', 'Old', 'Grand', 'Royal'];
        const roots = ['land', 'field', 'wood', 'hill', 'lake', 'river', 'mount', 'valley', 'bay', 'port', 'town', 'shire', 'gate', 'crest', 'mire', 'marsh', 'fort', 'point', 'haven', 'dale', 'glen', 'ridge', 'stone', 'water'];
        const suffixes = ['ia', 'ium', 'istan', 'onia', 'any', 'ark', 'land', 'dom', 'ica', 'borough', 'ton', 'ham', 'gard', 'burg', 'don', 'minster', 'shire', 'ford', 'hurst', 'wick', 'mere'];
        
        // Random generated name
        let name = '';
        
        // 40% chance for prefix
        if (Math.random() < 0.4) {
            name += prefixes[Math.floor(Math.random() * prefixes.length)] + ' ';
        }
        
        // Create a base name
        const syllables = ['ak', 'al', 'ar', 'an', 'bor', 'bar', 'ber', 'dal', 'dar', 'den', 'ell', 'en', 'gar', 'gan', 
                         'gor', 'han', 'har', 'hel', 'ir', 'im', 'ith', 'kad', 'kal', 'lan', 'lor', 'mar', 'mor', 'nar', 
                         'nor', 'or', 'orn', 'rak', 'ran', 'sar', 'sel', 'tal', 'tar', 'th', 'tir', 'tor', 'var', 'vor',
                         'aen', 'ael', 'bal', 'bel', 'cai', 'cel', 'dor', 'dov', 'fen', 'fae', 'gri', 'gwi', 'hel', 'hol', 
                         'ili', 'ira', 'jor', 'jul', 'kae', 'kel', 'lin', 'lor', 'mira', 'myr', 'nal', 'nir', 'oli', 'ora', 
                         'qua', 'qel', 'rae', 'ren', 'sil', 'sol', 'tar', 'thal', 'ula', 'ura', 'val', 'vel', 'wyn', 'xen', 
                         'yla', 'yul', 'zyl', 'zir'];
                  
        // 1-3 syllables
        const numSyllables = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < numSyllables; i++) {
            name += syllables[Math.floor(Math.random() * syllables.length)];
        }
        
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
        
        // 50% chance for suffix
        if (Math.random() < 0.5) {
            name += suffixes[Math.floor(Math.random() * suffixes.length)];
        }
        
        return name.trim(); // Trim any trailing space
    }
    
    adjustColor(baseColor, nationColor) {
        // Blend the base province color with the nation color
        const r1 = parseInt(baseColor.slice(1, 3), 16);
        const g1 = parseInt(baseColor.slice(3, 5), 16);
        const b1 = parseInt(baseColor.slice(5, 7), 16);
        
        const r2 = parseInt(nationColor.slice(1, 3), 16);
        const g2 = parseInt(nationColor.slice(3, 5), 16);
        const b2 = parseInt(nationColor.slice(5, 7), 16);
        
        const r = Math.floor((r1 * 0.7) + (r2 * 0.3));
        const g = Math.floor((g1 * 0.7) + (g2 * 0.3));
        const b = Math.floor((b1 * 0.7) + (b2 * 0.3));
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}