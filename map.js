class PixelMap {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.pixelSize = 4; // Each pixel is 4x4 actual pixels
        this.hdMode = false; // HD graphics mode
        this.mapWidth = Math.floor(this.width / this.pixelSize);
        this.mapHeight = Math.floor(this.height / this.pixelSize);
        this.terrainMap = [];
        this.nationMap = [];
        this.cityMap = [];
        this.provinceMap = [];
        this.provinceNames = [];
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.peopleMap = []; // Clear people too
        this.showPeople = false;
        this.battleEffects = []; // For war battle visualization
        this.initializeMaps();
    }

    initializeMaps() {
        // Initialize terrain map
        this.terrainMap = new Array(this.mapHeight);
        for (let y = 0; y < this.mapHeight; y++) {
            this.terrainMap[y] = new Array(this.mapWidth).fill('deep-water');
        }

        // Initialize nation map (null means no nation)
        this.nationMap = new Array(this.mapHeight);
        for (let y = 0; y < this.mapHeight; y++) {
            this.nationMap[y] = new Array(this.mapWidth).fill(null);
        }

        // Initialize city map (empty array for each pixel)
        this.cityMap = [];

        // Initialize province map (null means no province)
        this.provinceMap = new Array(this.mapHeight);
        for (let y = 0; y < this.mapHeight; y++) {
            this.provinceMap[y] = new Array(this.mapWidth).fill(null);
        }
    }

    clearMap() {
        this.initializeMaps();
        this.cityMap = [];
        this.provinceNames = [];
        this.peopleMap = []; // Clear people too
        this.battleEffects = []; // Clear battle effects
        this.render();
    }

    // 도시 이름을 한글로 변환하는 함수
    koreanizeCityNames() {
        const nameMap = {
            'Berlin': '베를린',
            'Romehaven': '로메헤이븐',
            'York': '요크',
            'Londonfield': '런던필드',
            'Paris': '파리',
            'Athens': '아테네',
            'Delhi': '델리',
            'Limahaven': '리마헤이븐',
            'Oslo': '오슬로',
            'Rome': '로마',
            'London': '런던',
            'Bern': '베른',
            'Lima': '리마',
            'Cairo': '카이로',
            'New': '신',
            'Old': '구',
            'Fort': '요새',
            'Port': '항구',
            'Mount': '산',
            'Lake': '호수',
            'North': '북',
            'South': '남',
            'East': '동',
            'West': '서',
            'Upper': '상',
            'Lower': '하',
            'Great': '대',
            'Little': '소',
            'Black': '흑',
            'White': '백',
            'ville': '빌',
            'burg': '부르크',
            'ton': '톤',
            'field': '필드',
            'ford': '포드',
            'haven': '헤이븐',
            'port': '포트',
            'wood': '우드',
            'land': '랜드',
            'shire': '샤이어',
            'grad': '그라드',
            'ia': '이아',
            'mouth': '마우스',
            'bridge': '브릿지',
            'castle': '캐슬',
            'holm': '홀름',
            'by': '비'
        };

        // 도시 이름 변환
        for (const city of this.cityMap) {
            let koreanName = city.name;

            // 완전히 일치하는 이름 먼저 확인
            if (nameMap[city.name]) {
                koreanName = nameMap[city.name];
            } else {
                // 부분 일치 확인 (접두사, 어근, 접미사)
                for (const [eng, kor] of Object.entries(nameMap)) {
                    // 단어 경계에서만 대체하도록 정규식 사용
                    const regex = new RegExp(`\\b${eng}\\b`, 'g');
                    koreanName = koreanName.replace(regex, kor);
                }
            }

            city.name = koreanName;
        }

        this.render();
    }

    setTerrain(x, y, terrainType, radius = 1) {
        const startX = Math.max(0, x - radius);
        const endX = Math.min(this.mapWidth - 1, x + radius);
        const startY = Math.max(0, y - radius);
        const endY = Math.min(this.mapHeight - 1, y + radius);

        for (let y2 = startY; y2 <= endY; y2++) {
            for (let x2 = startX; x2 <= endX; x2++) {
                const distance = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2);
                if (distance <= radius) {
                    this.terrainMap[y2][x2] = terrainType;
                }
            }
        }
    }

    setNation(x, y, nation, radius = 1) {
        if (!nation) return;

        const startX = Math.max(0, x - radius);
        const endX = Math.min(this.mapWidth - 1, x + radius);
        const startY = Math.max(0, y - radius);
        const endY = Math.min(this.mapHeight - 1, y + radius);

        for (let y2 = startY; y2 <= endY; y2++) {
            for (let x2 = startX; x2 <= endX; x2++) {
                const distance = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2);
                if (distance <= radius) {
                    // Only place nations on land
                    if (this.terrainMap[y2][x2] !== 'shallow-water' &&
                        this.terrainMap[y2][x2] !== 'medium-water' &&
                        this.terrainMap[y2][x2] !== 'deep-water') {
                        this.nationMap[y2][x2] = nation.id;
                    }
                }
            }
        }
    }

    addCity(x, y, name, size, nationId) {
        const city = {
            x: x,
            y: y,
            name: name,
            size: size,
            nationId: nationId
        };

        this.cityMap.push(city);
    }

    setProvince(provinceId, name, color, points) {
        this.provinceNames.push({
            id: provinceId,
            name: name,
            color: color,
            centerX: Math.floor(points.reduce((sum, p) => sum + p.x, 0) / points.length),
            centerY: Math.floor(points.reduce((sum, p) => sum + p.y, 0) / points.length)
        });

        // Fill the province area
        for (const point of points) {
            const { x, y } = point;
            if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
                this.provinceMap[y][x] = provinceId;
            }
        }
    }

    getTerrainColor(terrainType) {
        const colors = {
            // 물 - 더 생동감 있는 블루 톤
            'shallow-water': '#5BA3D4',    // 밝은 하늘색
            'medium-water': '#3E8CC7',     // 중간 바다색
            'deep-water': '#2C5F7C',       // 깊은 바다색
            
            // 육지 - 자연스럽고 현대적인 색상
            'sand': '#E8D5A3',             // 따뜻한 모래색
            'grassland': '#7BC142',         // 생생한 초록
            'jungle': '#2D5016',            // 깊은 정글 녹색
            'forest': '#4A7C59',            // 숲 녹색
            'savanna': '#C4B454',           // 사바나 황금색
            
            // 지형 - 자연스러운 대비
            'hills': '#8FAE5D',             // 언덕 올리브 그린
            'mountains': '#8B7D6B',         // 산 회갈색
            'snow': '#F5F5F5',              // 순백색 눈
            'marsh': '#6B9080',             // 습지 청록색
            'coral': '#FF6B9D'              // 생생한 산호색
        };
        return colors[terrainType] || '#2A2A2A';
    }

    render() {
        // Update people movement and battle effects
        if (this.showPeople) {
            this.updatePeopleMovement();
        }
        this.updateBattleEffects();

        // Apply transformations for zoom and pan
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Apply zoom and pan
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(-this.width / 2 - this.panX, -this.height / 2 - this.panY); // Corrected pan application

        // Clear canvas
        // This clearRect ensures only the visible portion is cleared relative to the current transform
        this.ctx.clearRect(
            (-this.width / 2 + this.panX) / this.zoomLevel,
            (-this.height / 2 + this.panY) / this.zoomLevel,
            this.width / this.zoomLevel,
            this.height / this.zoomLevel
        );

        // Render base terrain
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const terrainType = this.terrainMap[y][x];
                this.ctx.fillStyle = this.getTerrainColor(terrainType);

                if (this.hdMode) {
                    // HD rendering with texture
                    this.renderHDTerrain(x, y, terrainType);
                } else {
                    // Standard pixel rendering with subtle border
                    this.ctx.fillRect(
                        x * this.pixelSize,
                        y * this.pixelSize,
                        this.pixelSize,
                        this.pixelSize
                    );

                    // Add subtle terrain borders for better visibility
                    if (this.zoomLevel >= 2) {
                        this.ctx.strokeStyle = this.darkenColor(this.getTerrainColor(terrainType), 0.1);
                        this.ctx.lineWidth = 0.5;
                        this.ctx.strokeRect(
                            x * this.pixelSize,
                            y * this.pixelSize,
                            this.pixelSize,
                            this.pixelSize
                        );
                    }
                }
            }
        }

        // 해상 구조물 렌더링 제거
        // if (this.zoomLevel >= 2) {
        //     this.renderOffshoreOilPlatforms();
        // }

        // Render nations with transparency, better borders, and invaded territory visualization
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const nationId = this.nationMap[y][x];
                if (nationId !== null) {
                    const nation = nations.find(n => n.id === nationId);
                    if (nation) {
                        // Check if this is invaded territory (lighter color)
                        const isInvaded = this.isInvadedTerritory(x, y, nationId, window.aiController); // Pass aiController

                        let nationColor = nation.color;
                        if (isInvaded) {
                            nationColor = this.lightenColor(nation.color, 0.4); // Lighter color for invaded
                        }

                        // Main nation color
                        this.ctx.fillStyle = nationColor + '99'; // 60% opacity
                        this.ctx.fillRect(
                            x * this.pixelSize,
                            y * this.pixelSize,
                            this.pixelSize,
                            this.pixelSize
                        );

                        // Add nation borders when zoomed in
                        if (this.zoomLevel >= 2) {
                            this.renderNationBorders(x, y, nationId, nationColor);
                        }
                    }
                }
            }
        }

        // Render trade routes
        this.renderTradeRoutes();

        // Render province borders
        this.renderProvinceBorders();

        // Render province names
        this.ctx.font = '10px Courier New';
        this.ctx.textAlign = 'center';
        for (const province of this.provinceNames) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(
                province.name,
                province.centerX * this.pixelSize,
                province.centerY * this.pixelSize
            );
        }

        // 항구 렌더링 제거
        // if (this.zoomLevel >= 3) {
        //     const aiController = new NationAI(this);
        //     if (aiController.ports && aiController.ports.length > 0) {
        //         for (const port of aiController.ports) {
        //             const nation = nations.find(n => n.id === port.nationId);
        //             if (nation) {
        //                 const portX = port.x * this.pixelSize + this.pixelSize / 2;
        //                 const portY = port.y * this.pixelSize + this.pixelSize / 2;
        //                 
        //                 // Detailed port at high zoom levels
        //                 // Port base
        //                 this.ctx.fillStyle = '#a67c52';
        //                 this.ctx.fillRect(portX - this.pixelSize * 0.7, portY - this.pixelSize * 0.2, this.pixelSize * 1.4, this.pixelSize * 0.4);
        //                 
        //                 // Docks extending into water
        //                 this.ctx.fillStyle = '#8b4513';
        //                 this.ctx.fillRect(portX - this.pixelSize * 0.6, portY, this.pixelSize * 0.3, this.pixelSize * 0.5);
        //                 this.ctx.fillRect(portX + this.pixelSize * 0.3, portY, this.pixelSize * 0.3, this.pixelSize * 0.5);
        //                 
        //                 // Port buildings
        //                 this.ctx.fillStyle = nation.color;
        //                 this.ctx.fillRect(portX - this.pixelSize * 0.5, portY - this.pixelSize * 0.5, this.pixelSize * 0.3, this.pixelSize * 0.3);
        //                 this.ctx.fillRect(portX + this.pixelSize * 0.2, portY - this.pixelSize * 0.5, this.pixelSize * 0.3, this.pixelSize * 0.3);
        //                 
        //                 // Port flag
        //                 this.ctx.fillStyle = nation.color;
        //                 this.ctx.fillRect(portX, portY - this.pixelSize * 0.7, this.pixelSize * 0.05, this.pixelSize * 0.5);
        //                 this.ctx.fillRect(portX, portY - this.pixelSize * 0.7, this.pixelSize * 0.3, this.pixelSize * 0.15);
        //             }
        //         }
        //     }
        // }

        // Render cities
        for (const city of this.cityMap) {
            // City dot
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(
                city.x * this.pixelSize + this.pixelSize / 2,
                city.y * this.pixelSize + this.pixelSize / 2,
                city.size * 1.5,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // City name
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                city.name,
                city.x * this.pixelSize + this.pixelSize / 2,
                city.y * this.pixelSize + this.pixelSize / 2 + 15
            );
        }

        // Render people when zoomed in enough
        if (this.zoomLevel >= 3 && this.showPeople) {
            this.renderPeople();
        }

        // Render battle effects (white dots)
        this.renderBattleEffects();

        // Restore original transform
        this.ctx.restore();
    }

    isInvadedTerritory(x, y, nationId, aiController) {
        // This function now checks if a tile belonging to `nationId` is currently bordering an enemy,
        // which implies it's on a "front line" and can be considered "invaded" from the enemy's perspective.
        // It's still using a lighter color, as per previous request that this should remain.
        const nation = nations.find(n => n.id === nationId);
        if (!nation || !nation.atWarWith || nation.atWarWith.length === 0) {
            return false;
        }

        const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;

            if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
                const neighborNationId = this.nationMap[ny][nx];
                if (neighborNationId && nation.atWarWith.includes(neighborNationId)) {
                    // Check if this tile is truly on the border and not just surrounded by same nation
                    // Ensure the neighbor is not also owned by this nation (shouldn't happen with nationMap)
                    // The lighter color applies to any territory that is "at war" on its border
                    return true;
                }
            }
        }

        return false;
    }

    lightenColor(color, factor) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
        const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
        const newB = Math.min(255, Math.floor(b + (255 - b) * factor));

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    darkenColor(color, factor) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const newR = Math.floor(r * (1 - factor));
        const newG = Math.floor(g * (1 - factor));
        const newB = Math.floor(b * (1 - factor));

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    renderNationBorders(x, y, nationId, nationColor) {
        const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;

            if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
                const neighborNationId = this.nationMap[ny][nx];

                if (neighborNationId !== nationId) {
                    // Draw border
                    this.ctx.strokeStyle = this.darkenColor(nationColor, 0.3);
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();

                    if (dir.x === 1) { // Right border
                        this.ctx.moveTo((x + 1) * this.pixelSize, y * this.pixelSize);
                        this.ctx.lineTo((x + 1) * this.pixelSize, (y + 1) * this.pixelSize);
                    } else if (dir.y === 1) { // Bottom border
                        this.ctx.moveTo(x * this.pixelSize, (y + 1) * this.pixelSize);
                        this.ctx.lineTo((x + 1) * this.pixelSize, (y + 1) * this.pixelSize);
                    } else if (dir.x === -1 && x > 0) { // Left border
                        this.ctx.moveTo(x * this.pixelSize, y * this.pixelSize);
                        this.ctx.lineTo(x * this.pixelSize, (y + 1) * this.pixelSize);
                    } else if (dir.y === -1 && y > 0) { // Top border
                        this.ctx.moveTo(x * this.pixelSize, y * this.pixelSize);
                        this.ctx.lineTo((x + 1) * this.pixelSize, y * this.pixelSize);
                    }

                    this.ctx.stroke();
                }
            }
        }
    }

    renderHDTerrain(x, y, terrainType) {
        const px = x * this.pixelSize;
        const py = y * this.pixelSize;
        const size = this.pixelSize;

        // Draw base color
        this.ctx.fillStyle = this.getTerrainColor(terrainType);
        this.ctx.fillRect(px, py, size, size);

        // Add texture based on terrain type
        this.ctx.globalAlpha = 0.3;

        if (terrainType === 'mountains') {
            // Draw mountain texture
            this.ctx.fillStyle = '#464646';
            this.ctx.beginPath();
            this.ctx.moveTo(px, py + size);
            this.ctx.lineTo(px + size / 2, py + size / 4);
            this.ctx.lineTo(px + size, py + size);
            this.ctx.fill();
        } else if (terrainType.includes('water')) {
            // Draw water waves
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 0.5;
            const waveHeight = size / 5;
            this.ctx.beginPath();
            this.ctx.moveTo(px, py + size / 2);
            this.ctx.quadraticCurveTo(px + size / 3, py + size / 2 - waveHeight, px + size / 2, py + size / 2);
            this.ctx.quadraticCurveTo(px + 2 * size / 3, py + size / 2 + waveHeight, px + size, py + size / 2);
            this.ctx.stroke();
        } else if (terrainType === 'forest' || terrainType === 'jungle') {
            // Draw tree texture
            this.ctx.fillStyle = '#1a3a1a';
            this.ctx.beginPath();
            this.ctx.arc(px + size / 2, py + size / 3, size / 3, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (terrainType === 'coral') {
            // Draw coral texture
            this.ctx.fillStyle = '#ffaabb';
            this.ctx.beginPath();
            this.ctx.arc(px + size / 3, py + size / 3, size / 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(px + 2 * size / 3, py + size / 2, size / 5, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (terrainType === 'shallow-water') {
            // Draw ripples for shallow water
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 0.3;
            this.ctx.beginPath();
            this.ctx.arc(px + size / 2, py + size / 2, size / 4, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1.0;
    }

    renderOffshoreOilPlatforms() {
        // Generate deterministic oil platform locations based on map seed
        // Place them in medium or deep water
        const seed = 12345; // Fixed seed for consistent generation

        for (let y = 0; y < this.mapHeight; y += 10) {
            for (let x = 0; x < this.mapWidth; x += 10) {
                // Deterministic random check based on position
                const hash = (x * 73856093) ^ (y * 19349663) ^ seed;
                const normalized = (hash % 100) / 100;

                // Only 2% chance to place an oil platform
                if (normalized < 0.02) {
                    // Check if location is in medium/deep water
                    if (y < this.mapHeight && x < this.mapWidth &&
                        (this.terrainMap[y][x] === 'medium-water' ||
                            this.terrainMap[y][x] === 'deep-water')) {

                        this.drawOffshoreOilPlatform(x, y);
                    }
                }
            }
        }
    }

    drawOffshoreOilPlatform(x, y) {
        const px = x * this.pixelSize;
        const py = y * this.pixelSize;
        const size = this.pixelSize;

        // Check if there's a nation nearby to "claim" this platform
        let platformNation = null;
        const searchRadius = 15;

        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
                    const nationId = this.nationMap[ny][nx];
                    if (nationId !== null) {
                        const nation = nations.find(n => n.id === nationId);
                        if (nation) {
                            platformNation = nation;
                            break;
                        }
                    }
                }
            }
            if (platformNation) break;
        }

        // Draw platform with different detail based on zoom level
        if (this.zoomLevel >= 3) {
            // Detailed oil platform
            // Platform base
            this.ctx.fillStyle = '#555555';
            this.ctx.fillRect(px - size, py - size, size * 2, size * 2);

            // Platform structure
            this.ctx.fillStyle = '#777777';
            this.ctx.fillRect(px - size * 0.8, py - size * 0.8, size * 1.6, size * 1.6);

            // Central tower
            this.ctx.fillStyle = '#444444';
            this.ctx.fillRect(px - size * 0.3, py - size * 0.3, size * 0.6, size * 0.6);

            // Oil derrick
            this.ctx.strokeStyle = '#222222';
            this.ctx.lineWidth = size * 0.1;
            this.ctx.beginPath();
            this.ctx.moveTo(px - size * 0.4, py - size * 0.4);
            this.ctx.lineTo(px + size * 0.4, py + size * 0.4); // Corrected this line to form derrick shape
            this.ctx.lineTo(px, py - size * 1.2);
            this.ctx.closePath();
            this.ctx.stroke();

            // Flag if claimed by nation
            if (platformNation) {
                this.ctx.fillStyle = platformNation.color;
                this.ctx.fillRect(px + size * 0.6, py - size * 0.7, size * 0.05, size * 0.4);
                this.ctx.fillRect(px + size * 0.6, py - size * 0.7, size * 0.3, size * 0.15);
            }
        } else {
            // Simple oil platform for lower zoom
            this.ctx.fillStyle = '#555555';
            this.ctx.fillRect(px - size * 0.75, py - size * 0.75, size * 1.5, size * 1.5);

            // Oil derrick
            this.ctx.strokeStyle = '#222222';
            this.ctx.lineWidth = size * 0.1;
            this.ctx.beginPath();
            this.ctx.moveTo(px - size * 0.3, py - size * 0.3);
            this.ctx.lineTo(px + size * 0.3, py + size * 0.3); // Corrected this line to form derrick shape
            this.ctx.lineTo(px, py - size * 0.8);
            this.ctx.closePath();
            this.ctx.stroke();

            // Nation marker if claimed
            if (platformNation) {
                this.ctx.fillStyle = platformNation.color;
                this.ctx.fillRect(px + size * 0.4, py - size * 0.4, size * 0.2, size * 0.2);
            }
        }
    }

    renderProvinceBorders() {
        // For each pixel, check if its neighbors are from different provinces
        this.ctx.strokeStyle = '#ffffffaa';
        this.ctx.lineWidth = 0.5;

        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const currentProvince = this.provinceMap[y][x];
                if (currentProvince === null) continue;

                // Check right neighbor
                if (x < this.mapWidth - 1) {
                    const rightNeighbor = this.provinceMap[y][x + 1];
                    if (rightNeighbor !== currentProvince) {
                        this.ctx.beginPath();
                        this.ctx.moveTo((x + 1) * this.pixelSize, y * this.pixelSize);
                        this.ctx.lineTo((x + 1) * this.pixelSize, (y + 1) * this.pixelSize);
                        this.ctx.stroke();
                    }
                }

                // Check bottom neighbor
                if (y < this.mapHeight - 1) {
                    const bottomNeighbor = this.provinceMap[y + 1][x];
                    if (bottomNeighbor !== currentProvince) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x * this.pixelSize, (y + 1) * this.pixelSize);
                        this.ctx.lineTo((x + 1) * this.pixelSize, (y + 1) * this.pixelSize);
                        this.ctx.stroke();
                    }
                }
            }
        }
    }

    toggleHDMode() {
        this.hdMode = !this.hdMode;
        this.render();
    }

    renderTradeRoutes() {
        // Get trade routes from AI controller
        // Ensure aiController is globally accessible
        const aiController = window.aiController;
        if (!aiController || !aiController.tradeRoutes || aiController.tradeRoutes.length === 0) return;

        for (const route of aiController.tradeRoutes) {
            const nation1 = nations.find(n => n.id === route.nation1Id);
            const nation2 = nations.find(n => n.id === route.nation2Id);

            if (!nation1 || !nation2) continue;

            // Find the territory centers of both nations
            const territory1 = this.getNationCenter(route.nation1Id);
            const territory2 = this.getNationCenter(route.nation2Id);

            if (!territory1 || !territory2) continue;

            // Check if nations are at war
            const atWar = (nation1.atWarWith && nation1.atWarWith.includes(nation2.id)) ||
                (nation2.atWarWith && nation2.atWarWith.includes(nation1.id));

            // Draw dotted line for trade route
            this.ctx.beginPath();
            this.ctx.setLineDash([5, 5]);
            this.ctx.lineWidth = Math.min(5, route.value);

            // Use a gradient color based on both nations
            const grad = this.ctx.createLinearGradient(
                territory1.x * this.pixelSize,
                territory1.y * this.pixelSize,
                territory2.x * this.pixelSize,
                territory2.y * this.pixelSize
            );

            if (atWar || route.value === 0) { // If at war or value is 0, show as red/broken
                grad.addColorStop(0, '#ff0000');
                grad.addColorStop(1, '#ff0000');
                this.ctx.globalAlpha = 0.3; // Faded to show disruption
            } else {
                grad.addColorStop(0, nation1.color);
                grad.addColorStop(1, nation2.color);
                this.ctx.globalAlpha = 0.7;
            }

            this.ctx.strokeStyle = grad;

            this.ctx.moveTo(territory1.x * this.pixelSize, territory1.y * this.pixelSize);
            this.ctx.lineTo(territory2.x * this.pixelSize, territory2.y * this.pixelSize);
            this.ctx.stroke();

            // Add visual indicator of trade value
            if (route.value >= 3 && !atWar) {
                // Draw small circles along the route to indicate value
                const midX = (territory1.x + territory2.x) / 2 * this.pixelSize;
                const midY = (territory1.y + territory2.y) / 2 * this.pixelSize;

                this.ctx.setLineDash([]);
                this.ctx.fillStyle = '#ffcc44';
                this.ctx.beginPath();
                this.ctx.arc(midX, midY, route.value, 0, Math.PI * 2);
                this.ctx.fill();

                // Add value text
                if (route.value >= 5) {
                    this.ctx.fillStyle = '#000000';
                    this.ctx.font = '8px Courier New';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(route.value.toString(), midX, midY + 3);
                }
            }

            // Reset line dash and alpha
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = 1.0;
        }
    }

    getNationCenter(nationId) {
        // Find all tiles belonging to the nation
        let sumX = 0, sumY = 0, count = 0;

        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this.nationMap[y][x] === nationId) {
                    sumX += x;
                    sumY += y;
                    count++;
                }
            }
        }

        if (count === 0) return null;

        return {
            x: Math.floor(sumX / count),
            y: Math.floor(sumY / count)
        };
    }

    zoomIn() {
        this.zoomLevel = Math.min(6, this.zoomLevel * 1.2);
        if (this.zoomLevel >= 3 && !this.showPeople) {
            this.showPeople = true;
            this.generatePeople();
        }
        this.render();
        return this.zoomLevel;
    }

    zoomOut() {
        this.zoomLevel = Math.max(0.5, this.zoomLevel / 1.2);
        if (this.zoomLevel < 3) {
            this.showPeople = false;
        }
        this.render();
        return this.zoomLevel;
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.showPeople = false;
        this.render();
        return this.zoomLevel;
    }

    pan(deltaX, deltaY) {
        // Adjust pan speed based on zoom level
        const panSpeed = 1 / this.zoomLevel;
        this.panX -= deltaX * panSpeed; // Invert pan direction to match intuition
        this.panY -= deltaY * panSpeed; // Invert pan direction to match intuition

        // Limit panning to reasonable bounds
        const maxPanX = (this.mapWidth * this.pixelSize * this.zoomLevel - this.width) / 2;
        const maxPanY = (this.mapHeight * this.pixelSize * this.zoomLevel - this.height) / 2;

        this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
        this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));

        this.render();
    }
    
    // 맵 중앙 정렬 기능 제거됨

    generatePeople() {
        // Generate people with W/A indicators
        for (const nation of nations) {
            const territory = this.getNationTerritory(nation.id);

            // Generate workers
            const workerCount = Math.floor(nation.population / 1000000) + 5;
            for (let i = 0; i < workerCount; i++) {
                const tile = territory[Math.floor(Math.random() * territory.length)];
                const city = nation.cities?.find(c =>
                    Math.sqrt(Math.pow(c.x - tile.x, 2) + Math.pow(c.y - tile.y, 2)) < 3
                );

                this.peopleMap.push({
                    x: tile.x * this.pixelSize + Math.random() * this.pixelSize,
                    y: tile.y * this.pixelSize + Math.random() * this.pixelSize,
                    nationId: nation.id,
                    color: nation.color,
                    type: city ? 'W' : 'W', // Workers near cities
                    directionX: (Math.random() < 0.5 ? 1 : -1),
                    directionY: (Math.random() < 0.5 ? 1 : -1),
                    speed: 0.1
                });
            }

            // Generate army
            const armyCount = Math.floor(nation.armyStrength * 2);
            for (let i = 0; i < armyCount; i++) {
                const tile = territory[Math.floor(Math.random() * territory.length)];

                this.peopleMap.push({
                    x: tile.x * this.pixelSize + Math.random() * this.pixelSize,
                    y: tile.y * this.pixelSize + Math.random() * this.pixelSize,
                    nationId: nation.id,
                    color: nation.color,
                    type: 'A', // Army
                    directionX: (Math.random() < 0.5 ? 1 : -1),
                    directionY: (Math.random() < 0.5 ? 1 : -1),
                    speed: 0.2
                });
            }
        }
    }

    updatePeopleMovement() {
        for (const person of this.peopleMap) {
            // Move army to front lines if at war
            const nation = nations.find(n => n.id === person.nationId);
            if (nation && nation.atWarWith && nation.atWarWith.length > 0 && person.type === 'A') {
                // Move army toward borders
                person.x += person.directionX * person.speed * 2;
                person.y += person.directionY * person.speed * 2;
            } else {
                // Regular movement
                person.x += person.directionX * person.speed;
                person.y += person.directionY * person.speed;
            }

            // Keep within territory
            const tileX = Math.floor(person.x / this.pixelSize);
            const tileY = Math.floor(person.y / this.pixelSize);

            if (tileX < 0 || tileX >= this.mapWidth ||
                tileY < 0 || tileY >= this.mapHeight ||
                this.nationMap[tileY][tileX] !== person.nationId) {
                // Bounce back
                person.directionX *= -1;
                person.directionY *= -1;
            }
        }

        // Remove dead soldiers from battles
        this.peopleMap = this.peopleMap.filter(person => {
            if (person.type === 'A' && Math.random() < 0.001) {
                return Math.random() > 0.1; // 10% chance of death
            }
            return true;
        });

        // Add new people based on population
        for (const nation of nations) {
            const currentPeople = this.peopleMap.filter(p => p.nationId === nation.id).length;
            const expectedPeople = Math.floor(nation.population / 1000000) + 5;

            if (currentPeople < expectedPeople) {
                const territory = this.getNationTerritory(nation.id);
                if (territory.length > 0) {
                    const tile = territory[Math.floor(Math.random() * territory.length)];
                    this.peopleMap.push({
                        x: tile.x * this.pixelSize + Math.random() * this.pixelSize,
                        y: tile.y * this.pixelSize + Math.random() * this.pixelSize,
                        nationId: nation.id,
                        color: nation.color,
                        type: Math.random() < 0.8 ? 'W' : 'A',
                        directionX: (Math.random() < 0.5 ? 1 : -1),
                        directionY: (Math.random() < 0.5 ? 1 : -1),
                        speed: 0.1
                    });
                }
            } else if (currentPeople > expectedPeople) {
                // Remove excess people
                const excess = this.peopleMap.filter(p => p.nationId === nation.id);
                const toRemove = excess.length - expectedPeople;
                for (let i = 0; i < toRemove; i++) {
                    const index = this.peopleMap.findIndex(p => p.nationId === nation.id);
                    if (index !== -1) this.peopleMap.splice(index, 1);
                }
            }
        }
    }

    renderPeople() {
        for (const person of this.peopleMap) {
            this.ctx.fillStyle = person.color;

            // 활동 유형에 따라 다른 모양으로 표시
            if (person.type === 'A') { // 전쟁(Army)
                // 삼각형 모양으로 표시
                this.ctx.beginPath();
                this.ctx.moveTo(person.x, person.y - 3);
                this.ctx.lineTo(person.x - 2, person.y + 1.5);
                this.ctx.lineTo(person.x + 2, person.y + 1.5);
                this.ctx.closePath();
                this.ctx.fill();
            } else if (person.type === 'W') { // 농업(Worker)
                // 원 모양으로 표시
                this.ctx.beginPath();
                this.ctx.arc(person.x, person.y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (person.type === 'T') { // 무역(Trade)
                // 사각형 모양으로 표시
                this.ctx.fillRect(person.x - 1.5, person.y - 1.5, 3, 3);
            } else if (person.type === 'F') { // 어업(Fishing)
                // 다이아몬드 모양으로 표시
                this.ctx.beginPath();
                this.ctx.moveTo(person.x, person.y - 2);
                this.ctx.lineTo(person.x + 2, person.y);
                this.ctx.lineTo(person.x, person.y + 2);
                this.ctx.lineTo(person.x - 2, person.y);
                this.ctx.closePath();
                this.ctx.fill();
            } else if (person.type === 'M') { // 광업(Mining)
                // 오각형 모양으로 표시
                this.ctx.beginPath();
                this.ctx.moveTo(person.x, person.y - 2);
                this.ctx.lineTo(person.x + 1.9, person.y - 0.6);
                this.ctx.lineTo(person.x + 1.2, person.y + 1.6);
                this.ctx.lineTo(person.x - 1.2, person.y + 1.6);
                this.ctx.lineTo(person.x - 1.9, person.y - 0.6);
                this.ctx.closePath();
                this.ctx.fill();
            } else if (person.type === 'C') { // 건설(Construction)
                // 십자가 모양으로 표시
                this.ctx.fillRect(person.x - 0.5, person.y - 2, 1, 4);
                this.ctx.fillRect(person.x - 2, person.y - 0.5, 4, 1);
            } else {
                // 기본 모양 (원)
                this.ctx.beginPath();
                this.ctx.arc(person.x, person.y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    addBattleEffect(x, y) {
        const effect = {
            x: x * this.pixelSize + this.pixelSize / 2,
            y: y * this.pixelSize + this.pixelSize / 2,
            radius: this.pixelSize * 0.8,
            alpha: 1.0,
            duration: 30, // frames
            currentFrame: 0
        };
        this.battleEffects.push(effect);
    }

    updateBattleEffects() {
        this.battleEffects = this.battleEffects.filter(effect => {
            effect.currentFrame++;
            // Fade out
            effect.alpha = 1.0 * (1 - (effect.currentFrame / effect.duration));
            return effect.currentFrame < effect.duration;
        });
    }

    renderBattleEffects() {
        for (const effect of this.battleEffects) {
            this.ctx.save();
            this.ctx.globalAlpha = effect.alpha;
            this.ctx.fillStyle = '#ffffff'; // White dots for battles
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    // Convert screen coordinates to map coordinates
    screenToMap(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = screenX; // screenX is already relative to canvas left
        const clientY = screenY; // screenY is already relative to canvas top

        // Adjust for current pan and zoom
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;

        const transformedX = (clientX * scaleX) / this.zoomLevel - (this.width / this.zoomLevel / 2) + (this.width / 2 + this.panX) / this.zoomLevel;
        const transformedY = (clientY * scaleY) / this.zoomLevel - (this.height / this.zoomLevel / 2) + (this.height / 2 + this.panY) / this.zoomLevel;

        return {
            x: Math.floor(transformedX / this.pixelSize),
            y: Math.floor(transformedY / this.pixelSize)
        };
    }

    getNationTerritory(nationId) {
        // Find all tiles belonging to the nation
        let territory = [];

        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this.nationMap[y][x] === nationId) {
                    territory.push({ x, y });
                }
            }
        }

        return territory;
    }
}