// Global array to store all nations - window.nations를 직접 사용
if (!window.nations) window.nations = [];
if (!window.selectedNation) window.selectedNation = null;
if (!window.nextNationId) window.nextNationId = 1;

// 로컬 참조를 window 객체로 연결
let nations = window.nations;
let selectedNation = window.selectedNation;
let nextNationId = window.nextNationId;
let simulationRunning = false;
let currentYear = 0;
let simulationInterval = null;
let lastRevoltYear = -50; // Track when the last revolt happened

// 숫자 포맷팅 함수
function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num.toString();
    }
}

class NationManager {
    constructor(map) {
        this.map = map;
        this.setupNationTools();
        this.aiController = new NationAI(this.map);
        // Make aiController globally accessible
        window.aiController = this.aiController;
        this.setupSimulationControls();
        this.economyManager = new EconomyManager(this.map);
        this.economyManager.aiController = this.aiController; // Pass aiController to economyManager
        this.worldTradeValue = 0;
    }
    
    setupNationTools() {
        const addNationBtn = document.getElementById('add-nation');
        const nationsList = document.getElementById('nations-list');
        
        addNationBtn.addEventListener('click', () => {
            const colorInput = document.getElementById('nation-color');
            const nameInput = document.getElementById('nation-name');
            
            const color = colorInput.value;
            const name = nameInput.value.trim() || `Nation ${window.nextNationId}`;
            
            this.addNation(name, color);
            nameInput.value = '';
        });
    }
    
    setupSimulationControls() {
        const startSimBtn = document.getElementById('start-simulation');
        const stopSimBtn = document.getElementById('stop-simulation');
        const simSpeedSelect = document.getElementById('sim-speed');
        
        startSimBtn.addEventListener('click', () => {
            this.startSimulation();
            startSimBtn.disabled = true;
            stopSimBtn.disabled = false;
        });
        
        stopSimBtn.addEventListener('click', () => {
            this.stopSimulation();
            startSimBtn.disabled = false;
            stopSimBtn.disabled = true;
        });
        
        simSpeedSelect.addEventListener('change', () => {
            if (simulationRunning) {
                this.updateSimulationSpeed();
            }
        });
    }
    
    startSimulation() {
        simulationRunning = true;
        this.updateSimulationSpeed();
        
        // 자동저장 트리거
        if (window.autoSaveSystem) {
            window.autoSaveSystem.onGameEvent('simulation_started', { year: currentYear });
        }
    }
    
    stopSimulation() {
        simulationRunning = false;
        clearInterval(simulationInterval);
        
        // 자동저장 트리거
        if (window.autoSaveSystem) {
            window.autoSaveSystem.onGameEvent('simulation_stopped', { year: currentYear });
        }
    }
    
    updateSimulationSpeed() {
        if (simulationInterval) {
            clearInterval(simulationInterval);
        }
        
        const speedSelect = document.getElementById('sim-speed');
        let interval;
        
        switch(speedSelect.value) {
            case 'slow':
                interval = 2000;
                break;
            case 'fast':
                interval = 500;
                break;
            case 'very-fast':
                interval = 200; // Very fast speed (10x normal speed)
                break;
            case 'ultra-fast':
                interval = 50; // Ultra fast speed (40x normal speed)
                break;
            default:
                interval = 1000;
        }
        
        simulationInterval = setInterval(() => {
            this.simulationStep();
        }, interval);
    }
    
    simulationStep() {
        // Advance year
        currentYear++;
        document.getElementById('year-display').textContent = `Year: ${currentYear}`;
        
        // 자동저장 트리거 (매 10년마다)
        if (currentYear % 10 === 0 && window.autoSaveSystem) {
            window.autoSaveSystem.onGameEvent('year_advanced', { year: currentYear });
        }
        
        // Get world aggression setting
        const worldAggression = document.getElementById('world-aggression').value;
        
        // Random nation formation (5% chance each year if there's land available - increased from 2%)
        if (Math.random() < 0.05) {
            this.attemptRandomNationFormation();
        }
        
        // Run AI for each nation
        if (nations.length > 0) {
            // Each nation gets a turn
            for (const nation of nations) {
                // Remove defeated nations
                const territory = this.aiController.getNationTerritory(nation.id);
                if (territory.length === 0 && nation.overlord === null) { // Only remove truly eliminated nations
                     this.removeNation(nation.id);
                     continue; // Skip processing for this nation
                }

                // 60% chance to take an action each turn (increased from 30%)
                if (Math.random() < 0.6) {
                    // 15% chance for nation split if nation is big enough (increased from 10%)
                    if (Math.random() < 0.15) {
                        this.aiController.attemptNationSplit(nation);
                    } else {
                        this.aiController.processNationTurn(nation, worldAggression);
                    }
                }
            }
            
            // Handle active wars
            this.aiController.conductWars();

            // Update global economy
            this.economyManager.updateGlobalEconomy();
            this.worldTradeValue = this.economyManager.globalTradeVolume; // Use globalTradeVolume from EconomyManager
            document.getElementById('world-economy').textContent = `World Trade: ${this.worldTradeValue}`;
            
            // Debug log
            if (currentYear % 10 === 0) { // Log every 10 years
                console.log(`Year ${currentYear}: World Trade Volume = ${this.worldTradeValue}`);
            }
            
            // Render the updated map
            this.map.render();
        }
    }
    
    removeNation(nationId) {
        // Remove nation from global list
        window.nations = window.nations.filter(n => n.id !== nationId);

        // Clear its territory on the map
        for (let y = 0; y < this.map.mapHeight; y++) {
            for (let x = 0; x < this.map.mapWidth; x++) {
                if (this.map.nationMap[y][x] === nationId) {
                    this.map.nationMap[y][x] = null;
                }
                if (this.map.provinceMap[y][x] === nationId) { // Provinces are linked to nations
                    this.map.provinceMap[y][x] = null;
                }
            }
        }

        // Remove cities belonging to the nation
        this.map.cityMap = this.map.cityMap.filter(city => city.nationId !== nationId);

        // Remove provinces belonging to the nation (if any)
        this.map.provinceNames = this.map.provinceNames.filter(p => p.nationId !== nationId);

        // Clean up alliances and wars for other nations
        for (const otherNation of nations) {
            if (otherNation.allies) {
                otherNation.allies = otherNation.allies.filter(allyId => allyId !== nationId);
            }
            if (otherNation.atWarWith) {
                otherNation.atWarWith = otherNation.atWarWith.filter(enemyId => enemyId !== nationId);
            }
            if (otherNation.vassals) {
                otherNation.vassals = otherNation.vassals.filter(vassalId => vassalId !== nationId);
            }
            if (otherNation.overlord === nationId) {
                otherNation.overlord = null;
            }
        }
        
        // Clear selected nation if it was the one removed
        if (selectedNation && selectedNation.id === nationId) {
            selectedNation = null;
        }

        this.renderNationsList();
        this.map.render();
        
        // 자동저장 트리거
        if (window.autoSaveSystem) {
            window.autoSaveSystem.onGameEvent('nation_deleted', { nationId: nationId });
        }
    }
    
    attemptRandomNationFormation() {
        // Find unclaimed land tiles
        const unclaimedLand = [];
        for (let y = 0; y < this.map.mapHeight; y++) {
            for (let x = 0; x < this.map.mapWidth; x++) {
                if (this.map.nationMap[y][x] === null && 
                    this.map.terrainMap[y][x] !== 'shallow-water' && 
                    this.map.terrainMap[y][x] !== 'medium-water' && 
                    this.map.terrainMap[y][x] !== 'deep-water') {
                    unclaimedLand.push({x, y});
                }
            }
        }
        
        // If there's unclaimed land, try to form a new nation
        if (unclaimedLand.length > 15) { // Need at least 15 tiles of unclaimed land (reduced from 20)
            const startingPoint = unclaimedLand[Math.floor(Math.random() * unclaimedLand.length)];
            
            // Generate random color and name
            const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            const name = this.generateRandomNationName();
            
            // Create the nation
            const nation = {
                id: window.nextNationId++,
                name: name,
                color: color,
                cities: [],
                capitals: [],
                population: Math.floor(Math.random() * 5000000) + 500000,
                founded: currentYear,
                government: this.randomGovernment(),
                culturalTraits: this.randomCulturalTraits(),
                stability: 100, // Initialize stability
                gdp: Math.floor(Math.random() * 1000) + 500, // Initialize GDP (reduced range)
                armyStrength: Math.floor(Math.random() * 6) + 1, // Initialize army strength (1-6)
                atWarWith: [],
                allies: [],
                vassals: [],
                overlord: null,
                warStartYears: {} // Track when wars started
            };
            
            // Initialize economy for the new nation
            nation.economy = {
                tradeRoutes: [],
                resources: this.generateRandomResources(),
                industries: this.generateRandomIndustries()
            };
            
            window.nations.push(nation);
            this.renderNationsList();
            
            // Claim initial territory
            const initialSize = Math.floor(Math.random() * 8) + 12; // 12-20 tiles (increased from 10-15)
            let claimedTiles = 0;
            
            // Claim the starting point
            this.map.nationMap[startingPoint.y][startingPoint.x] = nation.id;
            claimedTiles++;
            
            // Expand from the starting point using a queue (BFS-like)
            const queue = [startingPoint];
            const visited = new Set([`${startingPoint.x},${startingPoint.y}`]);
            const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];

            while (queue.length > 0 && claimedTiles < initialSize) {
                const current = queue.shift();
                
                // Randomize expansion direction slightly
                directions.sort(() => Math.random() - 0.5);

                for (const dir of directions) {
                    const nx = current.x + dir.x;
                    const ny = current.y + dir.y;
                    const key = `${nx},${ny}`;
                    
                    if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight && !visited.has(key)) {
                        if (this.map.nationMap[ny][nx] === null && 
                            this.map.terrainMap[ny][nx] !== 'shallow-water' && 
                            this.map.terrainMap[ny][nx] !== 'medium-water' && 
                            this.map.terrainMap[ny][nx] !== 'deep-water') {
                            
                            this.map.nationMap[ny][nx] = nation.id;
                            claimedTiles++;
                            visited.add(key);
                            queue.push({x: nx, y: ny});
                            
                            if (claimedTiles >= initialSize) break;
                        }
                    }
                }
            }
            
            // Show notification
            this.aiController.showNotification(
                '새로운 국가',
                `${nation.name}이(가) ${currentYear}년에 건국되었습니다!`,
                '#4466aa'
            );
        }
    }
    
    generateRandomNationName() {
        const prefixes = ['공화국', '왕국', '제국', '연합', '자유국', '공국', '대공국', '연방', '자치령'];
        const roots = ['알바', '메리디아', '젠스', '켈토르', '빈도르', '아르곤', '툴레', '노르덴', '수덴', '오스텐', '베스텐', '노스마크', '발로리아', '시그너스', '에셀', '글래스톤', '칼레돈', '세레니아', '자일로스'];
        const suffixes = ['이아', '랜드', '마크', '스탄', '오르', '이움', '엔', '이카', '에스', '오니아', '아리아', '도르', '가르드', '부르크', '돈', '민스터', '샤이어'];
        
        let name = '';
        
        // 50% chance for prefix
        if (Math.random() < 0.5) {
            name += prefixes[Math.floor(Math.random() * prefixes.length)] + ' ';
        }
        
        // Always add a root
        name += roots[Math.floor(Math.random() * roots.length)];
        
        // 70% chance for suffix
        if (Math.random() < 0.7) {
            name += suffixes[Math.floor(Math.random() * suffixes.length)];
        }
        
        return name.trim();
    }
    
    addNation(name, color) {
        const nation = {
            id: window.nextNationId++,
            name: name,
            color: color,
            cities: [],
            capitals: [],
            population: Math.floor(Math.random() * 9000000) + 1000000,
            founded: currentYear,
            government: this.randomGovernment(),
            culturalTraits: this.randomCulturalTraits(),
            stability: 100, // New property: stability percentage (100% = perfectly stable)
            gdp: Math.floor(Math.random() * 1000) + 500, // GDP per capita in fictional currency (reduced range)
            armyStrength: Math.floor(Math.random() * 6) + 1, // Army strength 1-6
            atWarWith: [],
            allies: [],
            vassals: [],
            overlord: null,
            warStartYears: {} // Track when wars started
        };
        
        nation.economy = {
            tradeRoutes: [],
            resources: this.generateRandomResources(),
            industries: this.generateRandomIndustries()
        };
        
        window.nations.push(nation);
        this.renderNationsList();
        
        // Select the newly added nation
        selectedNation = nation;
        this.updateSelectedNation();
        
        // 자동저장 트리거
        if (window.autoSaveSystem) {
            window.autoSaveSystem.onGameEvent('nation_created', { nationId: nation.id, nationName: nation.name });
        }
    }
    
    randomGovernment() {
        const governments = [
            '군주제', '공화국', '민주주의', '제국', '연방',
            '독재', '과두제', '신정', '귀족제', '기술관료제', '조합', '공동체'
        ];
        return governments[Math.floor(Math.random() * governments.length)];
    }
    
    randomCulturalTraits() {
        const traits = [
            '항해민족', '산악민족', '사막 유목민', '숲 거주민',
            '종교적', '예술적', '호전적', '평화적', '상인', 
            '고립주의', '팽창주의', '전통주의', '산업적', '농경적', '학문적', '군국주의'
        ];
        
        const numTraits = Math.floor(Math.random() * 2) + 1;
        const selectedTraits = [];
        
        for (let i = 0; i < numTraits; i++) {
            const trait = traits[Math.floor(Math.random() * traits.length)];
            if (!selectedTraits.includes(trait)) {
                selectedTraits.push(trait);
            }
        }
        
        return selectedTraits;
    }
    
    generateRandomResources() {
        const resources = ['금', '철', '석탄', '목재', '어류', '농작물', '가축', '석유', '보석', '향신료', '은', '구리', '비단', '모피', '설탕'];
        const nationResources = {};
        
        // Generate 2-5 resources
        const resourceCount = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < resourceCount; i++) {
            const resource = resources[Math.floor(Math.random() * resources.length)];
            nationResources[resource] = Math.floor(Math.random() * 5) + 1; // Resource abundance (1-5)
        }
        
        return nationResources;
    }
    
    generateRandomIndustries() {
        const industries = ['농업', '광업', '제조업', '어업', '무역', '수공업', '조선업', '섬유업', '도구제작', '벌목업'];
        const nationIndustries = {};
        
        // Generate 1-3 industries
        const industryCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < industryCount; i++) {
            const industry = industries[Math.floor(Math.random() * industries.length)];
            nationIndustries[industry] = Math.floor(Math.random() * 5) + 1; // Industry development (1-5)
        }
        
        return nationIndustries;
    }
    
    renderNationsList() {
        const nationsList = document.getElementById('nations-list');
        nationsList.innerHTML = '';
        
        // Sort nations by territory size or population
        const sortedNations = [...window.nations].sort((a, b) => {
            const popA = a.population || 0;
            const popB = b.population || 0;
            return popB - popA;
        });

        sortedNations.forEach(nation => {
            const nationItem = document.createElement('div');
            nationItem.className = 'nation-item';
            
            const colorSample = document.createElement('div');
            colorSample.className = 'nation-color-sample';
            colorSample.style.backgroundColor = nation.color;
            
            const nationName = document.createElement('div');
            nationName.className = 'nation-name';
            nationName.textContent = nation.name;

            // Add vassal badge if applicable
            if (nation.overlord) {
                const overlord = nations.find(n => n.id === nation.overlord);
                const vassalBadge = document.createElement('span');
                vassalBadge.className = 'vassal-badge';
                vassalBadge.textContent = `(${overlord ? overlord.name : '알 수 없음'}의 속국)`;
                nationName.appendChild(vassalBadge);
            }
            
            // Add stability indicator
            const stabilityClass = nation.stability >= 80 ? 'high-stability' : 
                                 nation.stability >= 50 ? 'medium-stability' : 'low-stability';
            
            const nationDetails = document.createElement('div');
            nationDetails.className = 'nation-details';
            nationDetails.innerHTML = `정부: ${nation.government} | 인구: ${formatNumber(nation.population)} | <span class="${stabilityClass}">안정도: ${nation.stability}%</span> | GDP: ${formatNumber(nation.gdp)} | 군사력: ${nation.armyStrength}`;
            
            const nationControls = document.createElement('div');
            nationControls.className = 'nation-controls';
            
            const selectBtn = document.createElement('button');
            selectBtn.className = 'nation-select';
            selectBtn.textContent = '선택';
            selectBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`국가 선택됨: ${nation.name} (ID: ${nation.id})`);
                selectedNation = nation;
                this.updateSelectedNation();
                
                // 유닛 추가 메뉴 표시
                this.showUnitAddMenu(nation);
            });
            
            nationControls.appendChild(selectBtn);
            
            nationItem.appendChild(colorSample);
            nationItem.appendChild(nationName);
            nationItem.appendChild(nationDetails);
            nationItem.appendChild(nationControls);
            nationsList.appendChild(nationItem);
        });
    }
    
    // The showNationInfo function is now handled by the UI elements in app.js.
    // This is a placeholder to prevent errors if old code calls it.
    showNationInfo(nation) {
        console.log(`Displaying info for ${nation.name}`);
        // The actual display logic is now in app.js showNationDetailedInfo
        const infoDiv = document.getElementById('nation-detailed-info');
        if (infoDiv && typeof window.showNationDetailedInfo === 'function') {
            window.showNationDetailedInfo(nation);
        }
    }
    
    updateSelectedNation() {
        const nationItems = document.querySelectorAll('.nation-item');
        nationItems.forEach(item => {
            item.classList.remove('active');
            
            const nationNameElement = item.querySelector('.nation-name');
            const nationDisplayName = nationNameElement.firstChild.textContent; // Get only text node, ignore vassal badge
            
            if (selectedNation && nationDisplayName === selectedNation.name) {
                item.classList.add('active');
            }
        });
    }
    
    // 유닛 추가 메뉴를 모달로 표시하는 함수
    showUnitAddMenu(nation) {
        try {
            // nation 객체 유효성 검사
            if (!nation || typeof nation !== 'object' || !nation.id || !nation.name) {
                console.error('유효하지 않은 국가 객체:', nation);
                throw new Error('유효하지 않은 국가 객체');
            }
            
            console.log('showUnitAddMenu 호출됨, 국가:', nation.name);
            
            // 기존 모달 제거
            const existingModal = document.getElementById('modal-overlay');
            if (existingModal) {
                existingModal.remove();
            }
            
            // 직접 모달 생성 및 표시
            this.createAndShowModal(nation);
            
        } catch (error) {
            console.error('유닛 추가 모달 표시 중 오류 발생:', error);
            // 오류 발생 시 기존 방식으로 폴백
            this.showUnitAddMenuLegacy(nation);
        }
    }
    
    // 모달 초기화 및 DOM에 추가
    initializeUnitAddModal() {
        try {
            console.log('유닛 추가 모달 초기화 시작');
            
            // 이미 존재하는 모달 제거
            const existingModal = document.getElementById('modal-overlay');
            if (existingModal) {
                console.log('기존 모달 제거');
                existingModal.remove();
            }

            // 새 모달 생성
            const modalHTML = `
                <div id="modal-overlay" class="modal-overlay">
                    <div id="unit-add-modal" class="unit-add-modal">
                        <button class="modal-close-btn">&times;</button>
                        <h3 id="modal-title"></h3>
                        
                        <!-- 탭 메뉴 -->
                        <div class="modal-tabs">
                            <button class="modal-tab-btn active" data-tab="units">유닛 추가</button>
                            <button class="modal-tab-btn" data-tab="info">국가 정보</button>
                        </div>
                        
                        <!-- 유닛 추가 탭 -->
                        <div id="units-tab" class="modal-tab-content active">
                            <div class="unit-modal-buttons"></div>
                        </div>
                        
                        <!-- 국가 정보 탭 -->
                        <div id="info-tab" class="modal-tab-content">
                            <div class="nation-edit-form">
                                <div class="form-group">
                                    <label for="nation-name-input">국가 이름:</label>
                                    <input type="text" id="nation-name-input" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label for="nation-government-select">정부 형태:</label>
                                    <select id="nation-government-select" class="form-select">
                                        <option value="군주제">군주제</option>
                                        <option value="공화국">공화국</option>
                                        <option value="민주주의">민주주의</option>
                                        <option value="제국">제국</option>
                                        <option value="연방">연방</option>
                                        <option value="독재">독재</option>
                                        <option value="과두제">과두제</option>
                                        <option value="신정">신정</option>
                                        <option value="귀족제">귀족제</option>
                                        <option value="기술관료제">기술관료제</option>
                                        <option value="조합">조합</option>
                                        <option value="공동체">공동체</option>
                                    </select>
                                </div>
                                <button id="save-nation-info" class="save-btn">변경사항 저장</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // DOM에 모달 추가
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            console.log('모달 DOM에 추가 완료');
            
            // 추가된 요소들 확인
            const addedTabs = document.querySelector('.modal-tabs');
            const addedTabButtons = document.querySelectorAll('.modal-tab-btn');
            const addedTabContents = document.querySelectorAll('.modal-tab-content');
            
            console.log('추가된 모달 요소들:', {
                tabs: !!addedTabs,
                tabButtons: addedTabButtons.length,
                tabContents: addedTabContents.length
            });

            // 모달 닫기 이벤트 설정
            const overlay = document.getElementById('modal-overlay');
            const modal = document.getElementById('unit-add-modal');
            const closeBtn = document.querySelector('.modal-close-btn');

            if (!overlay || !modal || !closeBtn) {
                console.error('모달 요소를 찾을 수 없습니다:', {
                    overlay: !!overlay,
                    modal: !!modal,
                    closeBtn: !!closeBtn
                });
                throw new Error('모달 요소를 찾을 수 없습니다');
            }

            closeBtn.addEventListener('click', () => {
                console.log('닫기 버튼 클릭');
                this.closeUnitAddModal();
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    console.log('오버레이 클릭');
                    this.closeUnitAddModal();
                }
            });

            // ESC 키로 모달 닫기
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.classList.contains('active')) {
                    console.log('ESC 키 누름');
                    this.closeUnitAddModal();
                }
            });
            
            // 탭 기능 설정
            this.setupModalTabs();
            
            console.log('유닛 추가 모달 초기화 완료');
        } catch (error) {
            console.error('모달 초기화 중 오류 발생:', error);
            throw error;
        }
    }

    // 모달 표시 함수
    showUnitAddModal(nation) {
        try {
            const overlay = document.getElementById('modal-overlay');
            if (!overlay) {
                console.error('모달 오버레이 요소를 찾을 수 없습니다.');
                throw new Error('모달 오버레이 요소를 찾을 수 없습니다.');
            }
            
            const title = document.getElementById('modal-title');
            if (!title) {
                console.error('모달 제목 요소를 찾을 수 없습니다.');
                throw new Error('모달 제목 요소를 찾을 수 없습니다.');
            }
            
            const buttonsContainer = document.querySelector('.unit-modal-buttons');
            if (!buttonsContainer) {
                console.error('모달 버튼 컨테이너를 찾을 수 없습니다.');
                throw new Error('모달 버튼 컨테이너를 찾을 수 없습니다.');
            }

            // 제목 설정
            title.textContent = `${nation.name} 관리`;

            // 버튼 컨테이너 초기화
            buttonsContainer.innerHTML = '';

            // 유닛 유형 버튼 추가
            const unitTypes = [
                { type: 'A', name: '전쟁', color: '#ff6666', icon: '⚔️' },
                { type: 'W', name: '농업', color: '#66ff66', icon: '🌾' },
                { type: 'T', name: '무역', color: '#66aaff', icon: '🛒' },
                { type: 'M', name: '광업', color: '#aa66aa', icon: '⛏️' },
                { type: 'F', name: '어업', color: '#66cccc', icon: '🐟' },
                { type: 'C', name: '건설', color: '#ffaa66', icon: '🏗️' }
            ];

            const self = this; // this 참조 저장

            unitTypes.forEach(unit => {
                try {
                    const button = document.createElement('button');
                    button.className = 'unit-modal-button';
                    button.style.backgroundColor = unit.color;
                    button.dataset.type = unit.type;
                    
                    button.innerHTML = `
                        <span class="unit-icon">${unit.icon}</span>
                        <span class="unit-name">${unit.name}</span>
                    `;
                    
                    button.addEventListener('click', function() {
                        try {
                            self.addUnitToNation(nation, unit.type);
                            self.closeUnitAddModal();
                        } catch (clickError) {
                            console.error('유닛 추가 중 오류 발생:', clickError);
                            self.showErrorNotification('유닛 추가 실패', `${unit.name} 유닛 추가 중 오류가 발생했습니다.`);
                        }
                    });
                    
                    buttonsContainer.appendChild(button);
                } catch (buttonError) {
                    console.error('유닛 버튼 생성 중 오류 발생:', buttonError);
                }
            });

            // 국가 정보 탭 설정
            console.log('국가 정보 탭 설정 시작');
            this.setupNationInfoTab(nation);
            
            // 모달 표시
            console.log('모달 표시 중');
            overlay.classList.add('active');
        } catch (error) {
            console.error('모달 표시 중 오류 발생:', error);
            throw error; // 상위 함수에서 처리하도록 오류 전파
        }
    }
    
    // 직접 모달 생성 및 표시
    createAndShowModal(nation) {
        console.log('createAndShowModal 시작');
        
        // 모달 오버레이 생성
        const overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        
        // 모달 컨테이너 생성
        const modal = document.createElement('div');
        modal.id = 'unit-add-modal';
        modal.className = 'unit-add-modal';
        
        // 닫기 버튼
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            overlay.remove();
        });
        
        // 제목
        const title = document.createElement('h3');
        title.id = 'modal-title';
        title.textContent = `${nation.name} 관리`;
        
        // 탭 메뉴
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'modal-tabs';
        
        const unitsTabBtn = document.createElement('button');
        unitsTabBtn.className = 'modal-tab-btn active';
        unitsTabBtn.textContent = '유닛 추가';
        unitsTabBtn.dataset.tab = 'units';
        
        const infoTabBtn = document.createElement('button');
        infoTabBtn.className = 'modal-tab-btn';
        infoTabBtn.textContent = '국가 정보';
        infoTabBtn.dataset.tab = 'info';
        
        tabsContainer.appendChild(unitsTabBtn);
        tabsContainer.appendChild(infoTabBtn);
        
        // 유닛 추가 탭 콘텐츠
        const unitsTab = document.createElement('div');
        unitsTab.id = 'units-tab';
        unitsTab.className = 'modal-tab-content active';
        
        const unitsButtonsContainer = document.createElement('div');
        unitsButtonsContainer.className = 'unit-modal-buttons';
        
        // 유닛 버튼들 생성
        const unitTypes = [
            { type: 'A', name: '전쟁', color: '#ff6666', icon: '⚔️' },
            { type: 'W', name: '농업', color: '#66ff66', icon: '🌾' },
            { type: 'T', name: '무역', color: '#66aaff', icon: '🛒' },
            { type: 'M', name: '광업', color: '#aa66aa', icon: '⛏️' },
            { type: 'F', name: '어업', color: '#66cccc', icon: '🐟' },
            { type: 'C', name: '건설', color: '#ffaa66', icon: '🏗️' }
        ];
        
        unitTypes.forEach(unit => {
            const button = document.createElement('button');
            button.className = 'unit-modal-button';
            button.style.backgroundColor = unit.color;
            button.innerHTML = `
                <span class="unit-icon">${unit.icon}</span>
                <span class="unit-name">${unit.name}</span>
            `;
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.addUnitToNation(nation, unit.type);
                overlay.remove();
            });
            unitsButtonsContainer.appendChild(button);
        });
        
        unitsTab.appendChild(unitsButtonsContainer);
        
        // 국가 정보 탭 콘텐츠
        const infoTab = document.createElement('div');
        infoTab.id = 'info-tab';
        infoTab.className = 'modal-tab-content';
        
        const form = document.createElement('div');
        form.className = 'nation-edit-form';
        
        // 국가 이름 입력
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = '국가 이름:';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-input';
        nameInput.value = nation.name;
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        
        // 정부 형태 선택
        const govGroup = document.createElement('div');
        govGroup.className = 'form-group';
        const govLabel = document.createElement('label');
        govLabel.textContent = '정부 형태:';
        const govSelect = document.createElement('select');
        govSelect.className = 'form-select';
        
        const governments = ['군주제', '공화국', '민주주의', '제국', '연방', '독재', '과두제', '신정', '귀족제', '기술관료제', '조합', '공동체'];
        governments.forEach(gov => {
            const option = document.createElement('option');
            option.value = gov;
            option.textContent = gov;
            if (gov === nation.government) {
                option.selected = true;
            }
            govSelect.appendChild(option);
        });
        
        govGroup.appendChild(govLabel);
        govGroup.appendChild(govSelect);
        
        // 저장 버튼
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '변경사항 저장';
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.saveNationInfo(nation, nameInput.value, govSelect.value);
        });
        
        form.appendChild(nameGroup);
        form.appendChild(govGroup);
        form.appendChild(saveBtn);
        infoTab.appendChild(form);
        
        // 탭 전환 기능
        const tabButtons = [unitsTabBtn, infoTabBtn];
        const tabContents = [unitsTab, infoTab];
        
        tabButtons.forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 모든 탭 비활성화
                tabButtons.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // 선택된 탭 활성화
                btn.classList.add('active');
                tabContents[index].classList.add('active');
            });
        });
        
        // 모달 구조 조립
        modal.appendChild(closeBtn);
        modal.appendChild(title);
        modal.appendChild(tabsContainer);
        modal.appendChild(unitsTab);
        modal.appendChild(infoTab);
        overlay.appendChild(modal);
        
        // 오버레이 클릭으로 닫기
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // DOM에 추가 및 표시
        document.body.appendChild(overlay);
        
        // 약간의 지연 후 활성화 (애니메이션을 위해)
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
        
        console.log('모달 생성 및 표시 완료');
    }
    
    // 오류 알림 표시 함수
    showErrorNotification(title, message) {
        const notification = document.createElement('div');
        notification.className = 'war-notification';
        notification.style.borderLeft = '4px solid #ff6666';
        notification.innerHTML = `
            <strong>${title}</strong><br>
            ${message}
        `;
        document.body.appendChild(notification);
        
        // 3초 후 알림 제거
        setTimeout(() => {
            notification.classList.add('fadeOut');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
    
    // 국가 정보 탭 설정
    setupNationInfoTab(nation) {
        console.log('setupNationInfoTab 함수 호출됨, 국가:', nation.name);
        
        const nameInput = document.getElementById('nation-name-input');
        const governmentSelect = document.getElementById('nation-government-select');
        const saveBtn = document.getElementById('save-nation-info');
        
        console.log('국가 정보 탭 요소들:', {
            nameInput: !!nameInput,
            governmentSelect: !!governmentSelect,
            saveBtn: !!saveBtn
        });
        
        if (!nameInput || !governmentSelect || !saveBtn) {
            console.error('국가 정보 탭 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 현재 국가 정보로 폼 초기화
        nameInput.value = nation.name;
        governmentSelect.value = nation.government;
        
        console.log('국가 정보 폼 초기화 완료:', {
            name: nameInput.value,
            government: governmentSelect.value
        });
        
        // 저장 버튼 이벤트 리스너
        const self = this;
        saveBtn.addEventListener('click', function() {
            console.log('저장 버튼 클릭됨');
            self.saveNationInfo(nation, nameInput.value, governmentSelect.value);
        });
    }
    
    // 국가 정보 저장
    saveNationInfo(nation, newName, newGovernment) {
        try {
            console.log('saveNationInfo 호출됨:', { oldName: nation.name, newName, newGovernment });
            
            const oldName = nation.name;
            
            // 이름 유효성 검사
            if (!newName || newName.trim().length === 0) {
                alert('국가 이름을 입력해주세요.');
                return;
            }
            
            // 중복 이름 검사
            const existingNation = nations.find(n => n.id !== nation.id && n.name === newName.trim());
            if (existingNation) {
                alert('이미 존재하는 국가 이름입니다.');
                return;
            }
            
            // 국가 정보 업데이트
            nation.name = newName.trim();
            nation.government = newGovernment;
            
            console.log('국가 정보 업데이트 완료:', { name: nation.name, government: nation.government });
            
            // 국가 목록 다시 렌더링
            this.renderNationsList();
            
            // 모달 제목 업데이트
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) {
                modalTitle.textContent = `${nation.name} 관리`;
            }
            
            // 성공 알림
            const message = oldName !== newName 
                ? `국가 이름이 "${oldName}"에서 "${newName}"으로 변경되고, 정부 형태가 "${newGovernment}"으로 설정되었습니다.`
                : `정부 형태가 "${newGovernment}"으로 설정되었습니다.`;
            
            alert('저장 완료: ' + message);
            
        } catch (error) {
            console.error('국가 정보 저장 중 오류 발생:', error);
            alert('저장 실패: 국가 정보 저장 중 오류가 발생했습니다.');
        }
    }

    // 모달 닫기 함수
    closeUnitAddModal() {
        try {
            const overlay = document.getElementById('modal-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            } else {
                console.warn('모달 오버레이 요소를 찾을 수 없습니다. 닫기 작업을 건너뜁니다.');
            }
        } catch (error) {
            console.error('모달 닫기 중 오류 발생:', error);
        }
    }
    
    // 모달 탭 기능 설정
    setupModalTabs() {
        console.log('setupModalTabs 함수 호출됨');
        const tabButtons = document.querySelectorAll('.modal-tab-btn');
        const tabContents = document.querySelectorAll('.modal-tab-content');
        
        console.log(`탭 버튼 개수: ${tabButtons.length}, 탭 콘텐츠 개수: ${tabContents.length}`);
        
        if (tabButtons.length === 0) {
            console.error('탭 버튼을 찾을 수 없습니다.');
            return;
        }
        
        tabButtons.forEach((button, index) => {
            console.log(`탭 버튼 ${index} 설정 중:`, button.textContent);
            button.addEventListener('click', () => {
                console.log(`탭 버튼 클릭됨: ${button.getAttribute('data-tab')}`);
                
                // 모든 탭 버튼에서 active 클래스 제거
                tabButtons.forEach(btn => btn.classList.remove('active'));
                // 모든 탭 콘텐츠에서 active 클래스 제거
                tabContents.forEach(content => content.classList.remove('active'));
                
                // 클릭한 버튼에 active 클래스 추가
                button.classList.add('active');
                
                // 해당 탭 콘텐츠 표시
                const tabId = button.getAttribute('data-tab');
                const targetTab = document.getElementById(`${tabId}-tab`);
                if (targetTab) {
                    targetTab.classList.add('active');
                    console.log(`탭 콘텐츠 활성화됨: ${tabId}-tab`);
                } else {
                    console.error(`탭 콘텐츠를 찾을 수 없습니다: ${tabId}-tab`);
                }
            });
        });
    }
    
    // 기존 메뉴 표시 방식 (폴백용)
    showUnitAddMenuLegacy(nation) {
        try {
            // 기존 메뉴가 있으면 제거
            const existingMenu = document.getElementById('unit-add-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
            
            // 새 메뉴 생성
            const menu = document.createElement('div');
            menu.id = 'unit-add-menu';
            menu.className = 'unit-add-menu';
            
            // 메뉴 제목
            const title = document.createElement('h3');
            title.textContent = `${nation.name} 유닛 추가`;
            menu.appendChild(title);
            
            // 유닛 유형 버튼들
            const unitTypes = [
                { type: 'A', name: '전쟁', color: '#ff6666' },
                { type: 'W', name: '농업', color: '#66ff66' },
                { type: 'T', name: '무역', color: '#66aaff' },
                { type: 'M', name: '광업', color: '#aa66aa' },
                { type: 'F', name: '어업', color: '#66cccc' },
                { type: 'C', name: '건설', color: '#ffaa66' }
            ];
            
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'unit-buttons';
            
            const self = this; // this 참조 저장
            
            unitTypes.forEach(unit => {
                const button = document.createElement('button');
                button.className = 'unit-button';
                button.textContent = unit.name;
                button.style.backgroundColor = unit.color;
                button.addEventListener('click', function() {
                    self.addUnitToNation(nation, unit.type);
                    menu.remove(); // 버튼 클릭 후 메뉴 닫기
                });
                buttonsContainer.appendChild(button);
            });
            
            menu.appendChild(buttonsContainer);
            
            // 닫기 버튼
            const closeButton = document.createElement('button');
            closeButton.className = 'close-btn';
            closeButton.textContent = '닫기';
            closeButton.addEventListener('click', function() {
                menu.remove();
            });
            menu.appendChild(closeButton);
            
            // 메뉴를 국가 탭에 추가
            const nationsTab = document.getElementById('nations-tab');
            if (nationsTab) {
                nationsTab.appendChild(menu);
            } else {
                console.error('nations-tab 요소를 찾을 수 없습니다.');
                document.body.appendChild(menu); // 대체 방법
            }
        } catch (error) {
            console.error('유닛 추가 메뉴 표시 중 오류 발생:', error);
        }
    }
    
    // 선택한 유형의 유닛을 국가에 추가하는 함수
    addUnitToNation(nation, unitType) {
        // 맵 객체 가져오기
        const pixelMap = window.pixelMap || document.getElementById('map').pixelMap;
        if (!pixelMap) {
            console.error('맵 객체를 찾을 수 없습니다.');
            return;
        }
        
        const territory = pixelMap.getNationTerritory(nation.id);
        if (territory.length === 0) return;
        
        // 유닛 수 결정
        let unitCount;
        switch(unitType) {
            case 'A': // 전쟁
                unitCount = 5;
                break;
            case 'W': // 농업
                unitCount = 10;
                break;
            case 'T': // 무역
                unitCount = 3;
                break;
            case 'M': // 광업
                unitCount = 4;
                break;
            case 'F': // 어업
                unitCount = 4;
                break;
            case 'C': // 건설
                unitCount = 3;
                break;
            default:
                unitCount = 5;
        }
        
        // 기존 유닛 수 확인 (디버깅용)
        console.log(`기존 유닛 수: ${pixelMap.peopleMap.length}`);
        
        // 유닛 생성
        for (let i = 0; i < unitCount; i++) {
            const tile = territory[Math.floor(Math.random() * territory.length)];
            
            pixelMap.peopleMap.push({
                x: tile.x * pixelMap.pixelSize + Math.random() * pixelMap.pixelSize,
                y: tile.y * pixelMap.pixelSize + Math.random() * pixelMap.pixelSize,
                nationId: nation.id,
                color: nation.color,
                type: unitType,
                directionX: (Math.random() < 0.5 ? 1 : -1),
                directionY: (Math.random() < 0.5 ? 1 : -1),
                speed: 0.15
            });
        }
        
        // 추가 후 유닛 수 확인 (디버깅용)
        console.log(`추가 후 유닛 수: ${pixelMap.peopleMap.length}`);
        
        // 맵 다시 렌더링
        pixelMap.render();
        
        // 유닛이 제대로 표시되도록 설정
        pixelMap.showPeople = true;
        
        // 알림 표시
        const unitNames = {
            'A': '전쟁',
            'W': '농업',
            'T': '무역',
            'M': '광업',
            'F': '어업',
            'C': '건설'
        };
        
        // 알림 표시 (showNotification 함수가 없을 경우 대비)
        try {
            if (typeof this.aiController !== 'undefined' && typeof this.aiController.showNotification === 'function') {
                this.aiController.showNotification(
                    '유닛 추가',
                    `${nation.name}에 ${unitNames[unitType]} 유닛 ${unitCount}개가 추가되었습니다.`,
                    '#66aa66'
                );
            } else {
                console.log(`${nation.name}에 ${unitNames[unitType]} 유닛 ${unitCount}개가 추가되었습니다.`);
                
                // 애니메이션 효과가 있는 알림 표시
                const notification = document.createElement('div');
                notification.className = 'war-notification';
                notification.style.borderLeft = `4px solid ${nation.color}`;
                notification.innerHTML = `
                    <strong>유닛 추가</strong><br>
                    ${nation.name}에 ${unitNames[unitType]} 유닛 ${unitCount}개가 추가되었습니다.
                `;
                document.body.appendChild(notification);
                
                // 3초 후 알림 제거
                setTimeout(() => {
                    notification.classList.add('fadeOut');
                    setTimeout(() => {
                        notification.remove();
                    }, 500);
                }, 3000);
            }
        } catch (error) {
            console.error('알림 표시 중 오류 발생:', error);
        }
    }
    
    addRandomCity(x, y) {
        if (!selectedNation) return;
        
        // Check if position is on land and belongs to the selected nation
        if (y >= 0 && y < this.map.mapHeight && 
            x >= 0 && x < this.map.mapWidth) {
            
            const terrain = this.map.terrainMap[y][x];
            const nationId = this.map.nationMap[y][x];
            
            if (terrain !== 'shallow-water' && 
                terrain !== 'medium-water' && 
                terrain !== 'deep-water' && 
                nationId === selectedNation.id) {
                
                // Get selected city size
                const citySize = parseInt(document.getElementById('city-size').value);
                
                // Generate a random city name
                const cityName = this.generateCityName();
                
                // Add city to map
                this.map.addCity(x, y, cityName, citySize, selectedNation.id);
                
                // Add city to nation's city list
                const nation = nations.find(n => n.id === selectedNation.id);
                if (nation) {
                    nation.cities.push({
                        name: cityName,
                        size: citySize,
                        x: x,
                        y: y
                    });
                    
                    // If it's a capital (size 4), add to capitals
                    if (citySize === 4) {
                        nation.capitals.push(cityName);
                    }
                }
                
                this.map.render();
            }
        }
    }
    
    generateCityName() {
        const prefixes = ['신', '구', '요새', '항구', '산', '호수', '북', '남', '동', '서', '상', '하', '대', '소', '흑', '백'];
        const roots = ['요크', '런던', '파리', '로마', '베를린', '아테네', '카이로', '델리', '베른', '오슬로', '리마', '리오', '헤이븐', '우드', '필드', '데일', '보르그', '폴리', '그라드', '슈타인', '비스타', '리버'];
        const suffixes = ['빌', '부르크', '톤', '필드', '포드', '헤이븐', '포트', '우드', '랜드', '샤이어', '그라드', '이아', '마우스', '브릿지', '캐슬', '홀름', '비'];
        
        // 30% chance to use a prefix
        let name = '';
        if (Math.random() < 0.3) {
            name += prefixes[Math.floor(Math.random() * prefixes.length)] + ' ';
        }
        
        // Always use a root
        name += roots[Math.floor(Math.random() * roots.length)];
        
        // 40% chance to use a suffix
        if (Math.random() < 0.4) {
            name += suffixes[Math.floor(Math.random() * suffixes.length)];
        }
        
        return name.trim();
    }
}

class NationAI {
    constructor(map) {
        this.map = map;
        this.navies = []; // Store all navies
        this.activeWars = []; // Track active wars: {attackerId, defenderId, warStartYear, battleCooldown}
        this.worldWarActive = false;
        this.worldWarParticipants = {alliance1: [], alliance2: []};
        this.tradeRoutes = []; // Store all trade routes
        this.ports = []; // Store all ports
    }
    
    processNationTurn(nation, worldAggression = 'balanced') {
        // Update stability based on wars
        this.updateNationStability(nation);
        
        // Update economy and GDP
        this.updateEconomy(nation);

        // Randomly adjust army strength (1-6)
        if (Math.random() < 0.2) { // 20% chance to change strength
            nation.armyStrength = Math.max(1, Math.min(6, nation.armyStrength + (Math.random() < 0.5 ? 1 : -1)));
        }
        
        // Decide what action to take
        const actionRoll = Math.random();
        
        // Check if nation has access to sea for naval operations
        const hasSeaAccess = this.nationHasSeaAccess(nation.id);
        
        // Manage existing navies
        this.manageNavies(nation);
        
        // Check for possible rebellion based on stability - significantly reduced chance
        // Also ensure at least 50 years between global revolts
        if (nation.stability < 55 && Math.random() < (55 - nation.stability) / 300 && 
            currentYear - lastRevoltYear > 50 && nation.id !== undefined) {
            this.attemptNationSplit(nation);
            return;
        }
        
        // Adjust war chance based on world aggression setting
        let warChance = 0.07; // Default 7% chance
        let expansionChance = 0.85; // Default 85% chance
        
        switch(worldAggression) {
            case 'peaceful':
                warChance = 0.02; // 2% chance
                expansionChance = 0.75; // 75% chance
                break;
            case 'cautious':
                warChance = 0.05; // 5% chance
                expansionChance = 0.80; // 80% chance
                break;
            case 'aggressive':
                warChance = 0.12; // 12% chance
                expansionChance = 0.88; // 88% chance
                break;
            case 'warmonger':
                warChance = 0.20; // 20% chance
                expansionChance = 0.90; // 90% chance
                break;
            default: // 'balanced'
                warChance = 0.07; // 7% chance
                expansionChance = 0.85; // 85% chance
        }
        
        // Increased chance to expand
        if (actionRoll < expansionChance) {
            // Chance to expand
            this.expandNation(nation);
            
            // Sometimes create a city after expansion (20% chance, increased from 15%)
            if (Math.random() < 0.2) {
                this.createRandomCity(nation);
            }
            
            // Create navy if nation has sea access (15% chance, increased from 10%)
            if (hasSeaAccess && Math.random() < 0.15) {
                this.createNavy(nation);
            }
            
            // Attempt overseas colonization (12% chance if has naval power, increased from 8%)
            if (hasSeaAccess && this.nationHasNavies(nation.id) && Math.random() < 0.12) {
                this.attemptColonization(nation);
            }
        } else if (actionRoll < expansionChance + warChance) {
            // Chance to consider war (adjusted based on world aggression)
            this.considerWar(nation);
        } else if (actionRoll < expansionChance + warChance + 0.03) {
            // 3% chance to consider peace treaty if at war
            this.considerPeaceTreaty(nation);
        } else if (actionRoll < expansionChance + warChance + 0.05) {
            // 2% chance to consider forming alliances
            this.considerAlliance(nation);
        } else if (actionRoll < expansionChance + warChance + 0.06) {
            // 1% chance to consider creating trade agreement
            this.considerTradeAgreement(nation);
        } else if (actionRoll < expansionChance + warChance + 0.07) {
            // 1% chance to consider creating vassal relationship
            this.considerVassalization(nation);
        } else if (!this.worldWarActive && actionRoll >= 0.98) {
            // 2% chance to trigger world war if not already active and world is aggressive enough
            if (worldAggression === 'peaceful') {
                // No world wars in peaceful mode
                return;
            } else if (worldAggression === 'cautious' && Math.random() < 0.7) {
                // 30% chance to skip world war in cautious mode
                return;
            }
            this.considerWorldWar(nation);
        }
    }
    
    updateNationStability(nation) {
        // Base stability - tends to recover slowly if not at war
        if (!nation.atWarWith || nation.atWarWith.length === 0) {
            // Peaceful recovery of stability
            nation.stability = Math.min(100, nation.stability + 1);
        } else {
            // At war - stability decreases
            nation.stability = Math.max(10, nation.stability - 2);
            
            // Check if nation is winning or losing the war
            for (const enemyId of nation.atWarWith) {
                const enemy = nations.find(n => n.id === enemyId);
                if (!enemy) continue;
                
                const nationTerritory = this.getNationTerritory(nation.id).length;
                const enemyTerritory = this.getNationTerritory(enemyId).length;
                
                // If significantly stronger, gain stability
                if (nationTerritory > enemyTerritory * 1.5) {
                    nation.stability = Math.min(100, nation.stability + 1);
                }
                
                // If significantly weaker, lose more stability
                if (nationTerritory * 1.5 < enemyTerritory) {
                    nation.stability = Math.max(10, nation.stability - 2);
                }
            }
        }
    }
    
    updateEconomy(nation) {
        if (!nation.economy) {
            nation.economy = {
                tradeRoutes: [],
                resources: this.generateRandomResources(),
                industries: this.generateRandomIndustries(),
                economicPower: 1.0 // Base economic power
            };
        }
        
        // Base GDP growth
        let gdpGrowth = 0.005; // 0.5% base growth (much more conservative)
        
        // Calculate economic power based on trade
        let economicPower = 1.0;
        
        // Trade routes boost economy
        if (nation.economy.tradeRoutes && nation.economy.tradeRoutes.length > 0) {
            gdpGrowth += 0.002 * nation.economy.tradeRoutes.length; // Reduced from 0.01 to 0.002
            
            // Sum total trade value
            let totalTradeValue = 0;
            for (const route of nation.economy.tradeRoutes) {
                totalTradeValue += route.value;
            }
            
            // More trade = more economic power
            economicPower += totalTradeValue * 0.05;
        }
        
        // Industries boost economy
        if (nation.economy.industries) {
            const industryLevels = Object.values(nation.economy.industries);
            const industrySum = industryLevels.reduce((sum, level) => sum + level, 0);
            gdpGrowth += 0.001 * industrySum; // Reduced from 0.005 to 0.001
            economicPower += industrySum * 0.1;
        }
        
        // Population affects economy
        const populationInMillions = nation.population / 1000000;
        economicPower += Math.sqrt(populationInMillions) * 0.2;
        
        // War reduces GDP more significantly
        if (nation.atWarWith && nation.atWarWith.length > 0) {
            gdpGrowth -= 0.01 * nation.atWarWith.length; // Increased from 0.005 to 0.01
            economicPower -= 0.3 * nation.atWarWith.length; // Increased from 0.2 to 0.3
            
            // Long wars cause additional economic damage
            for (const enemyId of nation.atWarWith) {
                const warStartYear = nation.warStartYears[enemyId] || currentYear;
                const warDuration = currentYear - warStartYear;
                if (warDuration > 10) { // Wars longer than 10 years cause severe damage
                    gdpGrowth -= 0.005 * Math.min(warDuration - 10, 20); // Up to -0.1 for very long wars
                }
            }
        }
        
        // Low stability reduces GDP more significantly
        if (nation.stability < 50) {
            gdpGrowth -= (50 - nation.stability) / 500; // Increased from /1000 to /500
            economicPower -= (50 - nation.stability) / 80; // Increased from /100 to /80
            
            // Very low stability causes severe economic problems
            if (nation.stability < 25) {
                gdpGrowth -= 0.01; // Additional -1% for very unstable nations
                
                // Chance of economic crisis
                if (Math.random() < 0.1) {
                    nation.gdp = Math.floor(nation.gdp * 0.95); // 5% GDP loss from crisis
                    nation.population = Math.floor(nation.population * 0.98); // 2% population loss from crisis
                }
            }
        }
        
        // Update economic power
        nation.economy.economicPower = Math.max(0.1, economicPower);
        
        // Apply growth rate with very conservative limits (can be negative)
        const maxGdpGrowth = 0.01; // Maximum 1% growth per turn
        const minGdpGrowth = -0.02; // Maximum 2% decline per turn
        gdpGrowth = Math.max(minGdpGrowth, Math.min(maxGdpGrowth, gdpGrowth));
        nation.gdp = Math.max(100, Math.floor(nation.gdp * (1 + gdpGrowth)));
        
        // Population growth based on economic conditions with realistic limits
        let populationGrowth = 0.001; // 0.1% base population growth (much more realistic)
        
        // Adjust based on economic conditions (reduced impact)
        populationGrowth += gdpGrowth / 10; // Reduced from /2 to /10
        
        // War reduces population growth more significantly
        if (nation.atWarWith && nation.atWarWith.length > 0) {
            populationGrowth -= 0.005 * nation.atWarWith.length; // Increased from 0.002 to 0.005
            
            // Long wars cause population decline
            for (const enemyId of nation.atWarWith) {
                const warStartYear = nation.warStartYears[enemyId] || currentYear;
                const warDuration = currentYear - warStartYear;
                if (warDuration > 5) { // Wars longer than 5 years cause population decline
                    populationGrowth -= 0.002 * Math.min(warDuration - 5, 15); // Up to -0.03 for very long wars
                }
            }
        }
        
        // Cap population growth to realistic levels
        const maxPopGrowth = 0.003; // Maximum 0.3% growth per turn
        const minPopGrowth = -0.01; // Maximum 1% decline per turn
        populationGrowth = Math.max(minPopGrowth, Math.min(maxPopGrowth, populationGrowth));
        
        // Apply population growth
        nation.population = Math.floor(nation.population * (1 + populationGrowth));
        
        // Random disasters (very rare but impactful)
        if (Math.random() < 0.001) { // 0.1% chance per turn
            const disasterType = Math.random();
            if (disasterType < 0.3) {
                // Plague
                nation.population = Math.floor(nation.population * 0.85); // 15% population loss
                nation.stability = Math.max(10, nation.stability - 20);
            } else if (disasterType < 0.6) {
                // Economic collapse
                nation.gdp = Math.floor(nation.gdp * 0.7); // 30% GDP loss
                nation.stability = Math.max(10, nation.stability - 15);
            } else {
                // Natural disaster
                nation.population = Math.floor(nation.population * 0.95); // 5% population loss
                nation.gdp = Math.floor(nation.gdp * 0.9); // 10% GDP loss
                nation.stability = Math.max(10, nation.stability - 10);
            }
        }
    }
    
    generateRandomResources() {
        const resources = ['gold', 'iron', 'coal', 'timber', 'fish', 'crops', 'livestock', 'oil', 'gems', 'spices'];
        const nationResources = {};
        
        // Generate 2-5 resources
        const resourceCount = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < resourceCount; i++) {
            const resource = resources[Math.floor(Math.random() * resources.length)];
            nationResources[resource] = Math.floor(Math.random() * 5) + 1; // Resource abundance (1-5)
        }
        
        return nationResources;
    }
    
    generateRandomIndustries() {
        const industries = ['agriculture', 'mining', 'manufacturing', 'fishing', 'trade', 'crafts', 'shipbuilding'];
        const nationIndustries = {};
        
        // Generate 1-3 industries
        const industryCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < industryCount; i++) {
            const industry = industries[Math.floor(Math.random() * industries.length)];
            nationIndustries[industry] = Math.floor(Math.random() * 5) + 1; // Industry development (1-5)
        }
        
        return nationIndustries;
    }
    
    expandNation(nation) {
        // Get nation territory
        const territory = this.getNationTerritory(nation.id);
        if (territory.length === 0) return;
        
        // Find border tiles
        const borderTiles = this.findBorderTiles(territory, nation.id);
        if (borderTiles.length === 0) return;
        
        // Choose random tiles to expand from - increased expansion attempts based on army strength
        const baseExpansionAttempts = 7; 
        const expansionAttempts = Math.floor(baseExpansionAttempts * (nation.armyStrength / 3)); // More attempts for stronger armies
        
        for (let i = 0; i < expansionAttempts; i++) {
            if (borderTiles.length === 0) break;
            
            const tileIndex = Math.floor(Math.random() * borderTiles.length);
            const tile = borderTiles[tileIndex];
            
            // Find expandable adjacent tiles
            const expandableTiles = this.findExpandableTiles(tile.x, tile.y, nation.id);
            
            if (expandableTiles.length > 0) {
                // Choose a random tile to expand into
                const targetTile = expandableTiles[Math.floor(Math.random() * expandableTiles.length)];
                
                // Check if it belongs to another nation
                const targetNationId = this.map.nationMap[targetTile.y][targetTile.x];
                
                if (targetNationId !== null) {
                    // Expansion into another nation's territory - only allow if at war
                    const targetNation = nations.find(n => n.id === targetNationId);
                    if (targetNation && nation.atWarWith && nation.atWarWith.includes(targetNationId)) {
                        // At war, can take territory - increased chance of successful capture (85% vs default 50%)
                        if (Math.random() < 0.85) {
                            this.map.nationMap[targetTile.y][targetTile.x] = nation.id;
                            // No glowing expansion effects per user request
                        }
                    }
                } else {
                    // Unclaimed land, can expand freely
                    this.map.nationMap[targetTile.y][targetTile.x] = nation.id;
                    // No glowing expansion effects per user request
                }
            }
            
            // Remove the used tile from border tiles to avoid duplicates (important for performance)
            borderTiles.splice(tileIndex, 1);
        }
    }
    
    nationHasSeaAccess(nationId) {
        const territory = this.getNationTerritory(nationId);
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const tile of territory) {
            for (const dir of directions) {
                const nx = tile.x + dir.x;
                const ny = tile.y + dir.y;
                
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    const terrain = this.map.terrainMap[ny][nx];
                    if (terrain === 'shallow-water' || terrain === 'medium-water' || 
                        terrain === 'deep-water' || terrain === 'coral') {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    createNavy(nation) {
        // Find a coastal tile for this nation
        const coastalTiles = this.getCoastalTiles(nation.id);
        if (coastalTiles.length === 0) return;
        
        const coastalTile = coastalTiles[Math.floor(Math.random() * coastalTiles.length)];
        
        // Find adjacent water tile
        const waterTile = this.findAdjacentWaterTile(coastalTile.x, coastalTile.y);
        if (!waterTile) return;
        
        // Create a port at the coastal tile if there isn't one already
        if (!this.portExistsAt(coastalTile.x, coastalTile.y)) {
            this.createPort(coastalTile.x, coastalTile.y, nation.id);
        }
        
        // Create a navy
        const navyTypes = ['trade', 'transport', 'battle'];
        const navyType = navyTypes[Math.floor(Math.random() * navyTypes.length)];
        
        const navy = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            nationId: nation.id,
            x: waterTile.x,
            y: waterTile.y,
            type: navyType,
            strength: Math.floor(Math.random() * 5) + 1, // 1-5 strength
            homePort: {x: coastalTile.x, y: coastalTile.y},
            mission: 'patrol', // patrol, trade, colonize, attack
            targetLocation: null,
            name: this.generateNavyName(nation.name, navyType)
        };
        
        this.navies.push(navy);
        
        // Notification for large navies
        if (navy.strength >= 4) {
            this.showNotification(
                '새로운 해군',
                `${nation.name}이(가) "${navy.name}"이라는 강력한 ${navyType} 함대를 건설했습니다!`,
                '#4a7496'
            );
        }
        
        // Economic benefit for trade navies (further reduced)
        if (navyType === 'trade' && nation.economy) {
            nation.gdp += 1; // Boost GDP (reduced from 5 to 1)
        }
    }
    
    createPort(x, y, nationId) {
        this.ports.push({
            x: x,
            y: y,
            nationId: nationId
        });
    }
    
    portExistsAt(x, y) {
        return this.ports.some(port => port.x === x && port.y === y);
    }
    
    generateNavyName(nationName, navyType) {
        const prefixes = {
            'trade': ['Merchant', 'Trading', 'Commerce', 'Exchange', 'Bounty', 'Golden'],
            'transport': ['Transport', 'Carrier', 'Convoy', 'Passage', 'Journey', 'Voyage'],
            'battle': ['Dreadnought', 'Vengeance', 'Sovereign', 'Guardian', 'Victory', 'Ironclad']
        };
        
        const suffixes = {
            'trade': ['Fleet', 'Company', 'Expedition', 'Venture', 'Guild', 'Line'],
            'transport': ['Flotilla', 'Brigade', 'Corps', 'Squadron', 'Division', 'Armada'],
            'battle': ['Armada', 'Legion', 'Navy', 'Fleet', 'Squadron', 'Force']
        };
        
        const prefix = prefixes[navyType][Math.floor(Math.random() * prefixes[navyType].length)];
        const suffix = suffixes[navyType][Math.floor(Math.random() * suffixes[navyType].length)];
        
        return `${prefix} ${suffix} of ${nationName}`;
    }
    
    getCoastalTiles(nationId) {
        const territory = this.getNationTerritory(nationId);
        const coastalTiles = [];
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const tile of territory) {
            for (const dir of directions) {
                const nx = tile.x + dir.x;
                const ny = tile.y + dir.y;
                
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    const terrain = this.map.terrainMap[ny][nx];
                    if (terrain === 'shallow-water' || terrain === 'medium-water' || 
                        terrain === 'deep-water' || terrain === 'coral') {
                        coastalTiles.push(tile);
                        break;
                    }
                }
            }
        }
        
        return coastalTiles;
    }
    
    findAdjacentWaterTile(x, y) {
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            
            if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                const terrain = this.map.terrainMap[ny][nx];
                if (terrain === 'shallow-water' || terrain === 'medium-water' || 
                    terrain === 'deep-water' || terrain === 'coral') {
                    return {x: nx, y: ny};
                }
            }
        }
        
        return null;
    }
    
    manageNavies(nation) {
        // Update each navy belonging to this nation
        const nationNavies = this.navies.filter(navy => navy.nationId === nation.id);
        
        for (const navy of nationNavies) {
            switch(navy.mission) {
                case 'patrol':
                    this.patrolNavy(navy);
                    break;
                case 'trade':
                    this.tradeNavy(navy);
                    break;
                case 'colonize':
                    this.colonizeNavy(navy);
                    break;
                case 'attack':
                    this.attackNavy(navy);
                    break;
                default:
                    this.patrolNavy(navy);
            }
        }
        // Remove destroyed navies (strength 0 or less)
        this.navies = this.navies.filter(navy => navy.strength > 0);
    }
    
    patrolNavy(navy) {
        // 5% chance to change mission
        if (Math.random() < 0.05) {
            const missions = ['patrol', 'trade', 'colonize'];
            navy.mission = missions[Math.floor(Math.random() * missions.length)];
            
            // If nation is at war, 40% chance to set to attack mission
            const nation = nations.find(n => n.id === navy.nationId);
            if (nation && nation.atWarWith && nation.atWarWith.length > 0 && Math.random() < 0.4) {
                navy.mission = 'attack';
                
                // Find an enemy coastal tile to attack
                const enemyId = nation.atWarWith[Math.floor(Math.random() * nation.atWarWith.length)];
                const enemyCoastalTiles = this.getCoastalTiles(enemyId);
                
                if (enemyCoastalTiles.length > 0) {
                    const target = enemyCoastalTiles[Math.floor(Math.random() * enemyCoastalTiles.length)];
                    navy.targetLocation = target;
                }
            }
            return;
        }
        
        // Move randomly in water
        this.moveNavyRandomly(navy);
    }
    
    tradeNavy(navy) {
        const nation = nations.find(n => n.id === navy.nationId);
        if (!nation || !nation.economy) return;
        
        // Trading gives a very small GDP and population boost
        nation.gdp += Math.floor(Math.random() * 2) + 1; // 1-2 GDP growth (further reduced)
        nation.population += Math.floor(Math.random() * 500) + 200; // 200-700 population growth (further reduced)
        
        // Add a small stability boost if nation is at war (supplies coming in)
        if (nation.atWarWith && nation.atWarWith.length > 0) {
            nation.stability = Math.min(100, nation.stability + 1);
        }
        
        // 8% chance to switch back to patrol
        if (Math.random() < 0.08) {
            navy.mission = 'patrol';
            return;
        }
        
        // Move toward friendly ports occasionally, otherwise random
        if (Math.random() < 0.3) {
            this.moveNavyToHomePort(navy);
        } else {
            this.moveNavyRandomly(navy);
        }
    }
    
    colonizeNavy(navy) {
        const nation = nations.find(n => n.id === navy.nationId);
        if (!nation) return;
        
        // Find unclaimed land tiles near water
        if (!navy.targetLocation) {
            const potentialColonies = this.findColonizableTiles();
            
            if (potentialColonies.length > 0) {
                navy.targetLocation = potentialColonies[Math.floor(Math.random() * potentialColonies.length)];
            } else {
                // No colonizable tiles found, revert to patrol
                navy.mission = 'patrol';
                return;
            }
        }
        
        // Move toward target
        const arrived = this.moveNavyToward(navy, navy.targetLocation);
        
        // If arrived at colonization target
        if (arrived) {
            // Find land adjacent to the navy
            const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
            let colonized = false;
            
            for (const dir of directions) {
                const nx = navy.x + dir.x;
                const ny = navy.y + dir.y;
                
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    const terrain = this.map.terrainMap[ny][nx];
                    const currentOwner = this.map.nationMap[ny][nx];
                    
                    // If it's land and unclaimed
                    if (terrain !== 'shallow-water' && terrain !== 'medium-water' && 
                        terrain !== 'deep-water' && currentOwner === null) {
                        
                        // Create a port at the colonization point
                        this.createPort(nx, ny, navy.nationId);
                        
                        // Establish colony
                        this.map.nationMap[ny][nx] = navy.nationId;
                        
                        // Expand colony by claiming additional tiles
                        // Transport ships get larger colonies (25-40 tiles vs 5-15)
                        const colonySize = navy.type === 'transport' ? 
                                          Math.floor(Math.random() * 16) + 25 : 
                                          Math.floor(Math.random() * 11) + 5;
                        let claimed = 1;
                        
                        const queue = [{x: nx, y: ny}];
                        const visited = new Set([`${nx},${ny}`]);
                        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];

                        while (queue.length > 0 && claimed < colonySize) {
                            const currentTile = queue.shift();
                            
                            for (const d of directions) {
                                const cx = currentTile.x + d.x;
                                const cy = currentTile.y + d.y;
                                const key = `${cx},${cy}`;
                                
                                if (cx >= 0 && cx < this.map.mapWidth && cy >= 0 && cy < this.map.mapHeight && 
                                    !visited.has(key)) {
                                    
                                    visited.add(key);
                                    const terrainType = this.map.terrainMap[cy][cx];
                                    const owner = this.map.nationMap[cy][cx];
                                    
                                    if (terrainType !== 'shallow-water' && terrainType !== 'medium-water' && 
                                        terrainType !== 'deep-water' && owner === null) {
                                        
                                        this.map.nationMap[cy][cx] = navy.nationId;
                                        claimed++;
                                        queue.push({x: cx, y: cy});
                                        
                                        if (claimed >= colonySize) break;
                                    }
                                }
                            }
                        }
                        
                        // Create a city in the colony
                        if (claimed >= 5) {
                            const cityX = nx;
                            const cityY = ny;
                            const cityName = this.generateColonialCityName(nation.name);
                            // Larger city for transport ships
                            const citySize = navy.type === 'transport' ? 
                                           Math.min(4, Math.floor(Math.random() * 2) + 2) : // 2-3 or capital
                                           Math.min(3, Math.floor(Math.random() * 2) + 1);  // 1-2
                            
                            this.map.addCity(cityX, cityY, cityName, citySize, navy.nationId);
                            
                            if (!nation.cities) nation.cities = [];
                            nation.cities.push({
                                name: cityName,
                                size: citySize,
                                x: cityX,
                                y: cityY,
                                isColony: true
                            });
                            
                            // Economic benefits from colony
                            if (nation.economy) {
                                // Add new random resources from the colony
                                const colonyResources = this.generateRandomResources();
                                
                                for (const [resource, value] of Object.entries(colonyResources)) {
                                    if (nation.economy.resources[resource]) {
                                        nation.economy.resources[resource] += value;
                                    } else {
                                        nation.economy.resources[resource] = value;
                                    }
                                }
                                
                                // GDP boost from colony (further reduced)
                                nation.gdp += 2;
                            }
                            
                            // Stability boost from successful colonization
                            nation.stability = Math.min(100, nation.stability + 5);
                            
                            // Show notification
                            this.showNotification(
                                '새로운 식민지',
                                `${nation.name}이(가) ${cityName} 식민지를 설립했습니다!`,
                                '#66aa66'
                            );
                        }
                        
                        colonized = true;
                        break;
                    }
                }
            }
            
            // Reset navy mission after colonization attempt
            if (colonized) {
                // 50% chance to return home
                if (Math.random() < 0.5) {
                    navy.mission = 'patrol';
                    navy.targetLocation = navy.homePort;
                } else {
                    // Look for more colonies
                    navy.targetLocation = null;
                }
            } else {
                // Failed to colonize, switch to patrol
                navy.mission = 'patrol';
                navy.targetLocation = null;
            }
        }
    }
    
    findColonizableTiles() {
        const colonizableTiles = [];
        
        // Look for land tiles that are near water and unclaimed
        for (let y = 0; y < this.map.mapHeight; y++) {
            for (let x = 0; x < this.map.mapWidth; x++) {
                const terrain = this.map.terrainMap[y][x];
                const owner = this.map.nationMap[y][x];
                
                // If it's unclaimed land, check if there's shallow water nearby
                if (owner === null && 
                    (terrain !== 'shallow-water' && terrain !== 'medium-water' && 
                    terrain !== 'deep-water')) {

                    const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0},
                                        {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}]; // Check diagonals too
                    
                    for (const dir of directions) {
                        const nx = x + dir.x;
                        const ny = y + dir.y;
                        
                        if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                            const neighborTerrain = this.map.terrainMap[ny][nx];
                            
                            if (neighborTerrain === 'shallow-water' || neighborTerrain === 'coral') {
                                colonizableTiles.push({x, y});
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        return colonizableTiles;
    }
    
    attackNavy(navy) {
        const nation = nations.find(n => n.id === navy.nationId);
        if (!nation || !nation.atWarWith || nation.atWarWith.length === 0) {
            // No war, switch to patrol
            navy.mission = 'patrol';
            navy.targetLocation = null;
            return;
        }
        
        // If no target, find one
        if (!navy.targetLocation) {
            const enemyId = nation.atWarWith[Math.floor(Math.random() * nation.atWarWith.length)];
            const enemyCoastalTiles = this.getCoastalTiles(enemyId);
            
            if (enemyCoastalTiles.length > 0) {
                navy.targetLocation = enemyCoastalTiles[Math.floor(Math.random() * enemyCoastalTiles.length)];
            } else {
                // No coastal targets, revert to patrol
                navy.mission = 'patrol';
                return;
            }
        }
        
        // Move toward target
        const arrived = this.moveNavyToward(navy, navy.targetLocation);
        
        // If arrived at attack target
        if (arrived) {
            // Attack the enemy territory
            // Find a tile near the navy's current location that belongs to the enemy
            let targetLandTile = null;
            const landDirections = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
            for (const dir of landDirections) {
                const nx = navy.x + dir.x;
                const ny = navy.y + dir.y;
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    const terrain = this.map.terrainMap[ny][nx];
                    const owner = this.map.nationMap[ny][nx];
                    if (owner && nation.atWarWith.includes(owner) && !terrain.includes('water')) {
                        targetLandTile = {x: nx, y: ny, ownerId: owner};
                        break;
                    }
                }
            }

            if (targetLandTile) {
                const enemyId = targetLandTile.ownerId;
                const enemy = nations.find(n => n.id === enemyId);
                
                if (enemy) {
                    // Naval invasion - take a chunk of coastal territory
                    const attackPower = navy.strength + Math.floor(Math.random() * 3);
                    const tilesToCapture = Math.min(20, attackPower * 3); // Up to 20 tiles based on strength
                    
                    let captured = 0;
                    const queue = [targetLandTile];
                    const visited = new Set([`${targetLandTile.x},${targetLandTile.y}`]);
                    
                    while (queue.length > 0 && captured < tilesToCapture) {
                        const tile = queue.shift();
                        
                        // Capture this tile
                        if (this.map.nationMap[tile.y][tile.x] === enemyId) {
                            this.map.nationMap[tile.y][tile.x] = navy.nationId;
                            captured++;
                        }
                        
                        // Add neighboring tiles to the queue
                        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
                        for (const dir of directions) {
                            const nx = tile.x + dir.x;
                            const ny = tile.y + dir.y;
                            const key = `${nx},${ny}`;
                            
                            if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight && 
                                !visited.has(key)) {
                                
                                visited.add(key);
                                
                                if (this.map.nationMap[ny][nx] === enemyId) {
                                    queue.push({x: nx, y: ny});
                                }
                            }
                        }
                    }
                    
                    if (captured > 0) {
                        this.showNotification(
                            '해군 공격',
                            `${nation.name}의 해군이 ${enemy.name}으로부터 ${captured}개의 영토를 점령했습니다!`,
                            '#ff6666'
                        );
                    }
                    
                    // 25% chance of naval battle with enemy navy
                    const enemyNavies = this.navies.filter(n => n.nationId === enemyId &&
                                                           Math.abs(n.x - navy.x) <= 3 &&
                                                           Math.abs(n.y - navy.y) <= 3);
                    
                    if (enemyNavies.length > 0 && Math.random() < 0.25) {
                        const enemyNavy = enemyNavies[Math.floor(Math.random() * enemyNavies.length)];
                        
                        // Naval battle outcome
                        if (navy.strength > enemyNavy.strength) {
                            // Victory
                            this.showNotification(
                                '해전',
                                `${nation.name}의 해군이 전투에서 ${enemy.name}의 해군을 격파했습니다!`,
                                '#ff6666'
                            );
                            
                            // Remove enemy navy
                            this.navies = this.navies.filter(n => n.id !== enemyNavy.id);
                            
                            // 30% chance to damage this navy too
                            if (Math.random() < 0.3) {
                                navy.strength = Math.max(0, navy.strength - 1);
                            }
                        } else {
                            // Defeat or draw
                            this.showNotification(
                                '해전',
                                `${enemy.name}의 해군이 ${nation.name}의 해군 공격을 격퇴했습니다!`,
                                '#ff6666'
                            );
                            
                            // Damage this navy
                            navy.strength = Math.max(0, navy.strength - 1);
                            
                            // 40% chance to damage enemy navy too
                            if (Math.random() < 0.4) {
                                enemyNavy.strength = Math.max(0, enemyNavy.strength - 1);
                            }
                        }
                    }
                }
            }
            
            // Reset after attack
            navy.mission = 'patrol';
            navy.targetLocation = null;
        }
    }
    
    moveNavyRandomly(navy) {
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, 
                          {x: -1, y: -1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: 1, y: 1}];
        
        // Try up to 5 directions to find a valid water tile
        for (let i = 0; i < 5; i++) {
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const nx = navy.x + dir.x;
            const ny = navy.y + dir.y;
            
            if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                const terrain = this.map.terrainMap[ny][nx];
                
                if (terrain === 'shallow-water' || terrain === 'medium-water' || terrain === 'deep-water') {
                    navy.x = nx;
                    navy.y = ny;
                    break;
                }
            }
        }
    }
    
    moveNavyToHomePort(navy) {
        this.moveNavyToward(navy, navy.homePort);
    }
    
    moveNavyToward(navy, target) {
        if (!target) return false;
        
        // Calculate direction to target
        const dx = target.x - navy.x;
        const dy = target.y - navy.y;
        
        // If already at target
        if (dx === 0 && dy === 0) return true;
        
        // Normalize direction
        const length = Math.sqrt(dx * dx + dy * dy);
        const ndx = dx / length;
        const ndy = dy / length;
        
        // Move 1 or 2 tiles in the target direction
        const moveDistance = Math.min(length, Math.random() < 0.7 ? 1 : 2);
        let newX = navy.x + Math.round(ndx * moveDistance);
        let newY = navy.y + Math.round(ndy * moveDistance);
        
        // Make sure we're moving at least 1 tile
        if (newX === navy.x && newY === navy.y) {
            if (Math.abs(dx) > Math.abs(dy)) {
                newX += dx > 0 ? 1 : -1;
            } else {
                newY += dy > 0 ? 1 : -1;
            }
        }
        
        // Check if the new position is water
        if (newX >= 0 && newX < this.map.mapWidth && newY >= 0 && newY < this.map.mapHeight) {
            const terrain = this.map.terrainMap[newY][newX];
            
            if (terrain === 'shallow-water' || terrain === 'medium-water' || terrain === 'deep-water') {
                navy.x = newX;
                navy.y = newY;
            } else {
                // If target is on land and we're adjacent to it, we've "arrived"
                const distance = Math.sqrt(Math.pow(target.x - navy.x, 2) + Math.pow(target.y - navy.y, 2));
                if (distance <= 1.5) {
                    return true;
                }
            }
        }
        
        // Check if arrived at target
        const finalDistance = Math.sqrt(Math.pow(target.x - navy.x, 2) + Math.pow(target.y - navy.y, 2));
        return finalDistance < 1.5;
    }
    
    nationHasNavies(nationId) {
        return this.navies.some(navy => navy.nationId === nationId);
    }
    
    attemptColonization(nation) {
        // Find a navy to assign colonization mission
        const availableNavies = this.navies.filter(navy => 
            navy.nationId === nation.id && 
            (navy.mission === 'patrol' || navy.mission === 'trade')
        );
        
        if (availableNavies.length === 0) return;
        
        // Select a random navy
        const navy = availableNavies[Math.floor(Math.random() * availableNavies.length)];
        
        // 35% chance to create a transport fleet for better colonization (up from implicit 0%)
        if (Math.random() < 0.35) {
            navy.type = 'transport';
            navy.strength = Math.min(5, navy.strength + 1); // Boost strength for colonization
        }
        
        // Set to colonization mission
        navy.mission = 'colonize';
        navy.targetLocation = null; // Will be set during colonize operation
    }
    
    attemptNationSplit(nation) {
        // Get current rebellion frequency setting
        const rebellionFrequency = document.getElementById('rebellion-frequency').value;
        
        // Exit early if rebellions are turned off
        if (rebellionFrequency === 'off') return;
        
        // Get nation territory
        const territory = this.getNationTerritory(nation.id);
        
        // Track that a revolt happened
        lastRevoltYear = currentYear;
        
        // Only consider splits for nations with significant territory (at least 50 tiles)
        if (territory.length < 50) return;
        
        // Check rebellion frequency multiplier
        let chanceMultiplier = 1.0;
        if (rebellionFrequency === 'low') {
            chanceMultiplier = 0.5;
        } else if (rebellionFrequency === 'high') {
            chanceMultiplier = 2.0;
        }
        
        // Stability check - only low stability nations have rebellions
        if (nation.stability >= 55 || Math.random() > ((55 - nation.stability) / 300) * chanceMultiplier) {
            return;
        }

        // Rebellion starts in cities. Find a city that's not the capital.
        let rebellionCity = null;
        const potentialRebellionCities = nation.cities.filter(city => !nation.capitals.includes(city.name));

        if (potentialRebellionCities.length > 0) {
            rebellionCity = potentialRebellionCities[Math.floor(Math.random() * potentialRebellionCities.length)];
        } else if (nation.cities.length > 0) {
            // If no non-capital cities, any city can rebel if it's large enough
            rebellionCity = nation.cities.find(city => city.size >= 2);
        }

        if (!rebellionCity) {
            // No suitable city found for rebellion
            return;
        }
        
        // Create a new nation with similar but distinct traits
        const newNationColor = this.generateDistinctColor(nation.color);
        const newNationName = this.generateSplitNationName(nation.name);
        
        const newNation = {
            id: window.nextNationId++,
            name: newNationName,
            color: newNationColor,
            cities: [],
            capitals: [],
            population: Math.floor(nation.population * (0.1 + Math.random() * 0.2)), // 10-30% of parent population
            founded: currentYear,
            government: this.randomRelatedGovernment(nation.government),
            culturalTraits: [...nation.culturalTraits],
            atWarWith: [nation.id], // Always at war with parent
            stability: 70, 
            gdp: Math.floor(nation.gdp * 0.3), // Reduced from 0.5 to 0.3 
            armyStrength: 2, 
            isRebel: true,
            overlord: null,
            vassals: [],
            warStartYears: { [nation.id]: currentYear }
        };
        
        // Add the new nation
        window.nations.push(newNation);
        
        // New nation starts at war with parent
        if (!nation.atWarWith) nation.atWarWith = [];
        nation.atWarWith.push(newNation.id);
        nation.warStartYears[newNation.id] = currentYear;

        // Claim initial territory around the rebellion city
        const maxTilesToClaim = Math.floor(territory.length * (0.1 + Math.random() * 0.15)); // 10-25% of parent nation's territory
        let claimedTiles = 0;
        
        const queue = [{x: rebellionCity.x, y: rebellionCity.y}];
        const visited = new Set();
        const key = (x, y) => `${x},${y}`;
        
        // Initial city and its immediate surroundings become part of the rebel nation
        // This ensures the rebellion has a small starting foothold.
        const startRadius = 3; 
        const startX = Math.max(0, rebellionCity.x - startRadius);
        const endX = Math.min(this.map.mapWidth - 1, rebellionCity.x + startRadius);
        const startY = Math.max(0, rebellionCity.y - startRadius);
        const endY = Math.min(this.map.mapHeight - 1, rebellionCity.y + startRadius);

        for (let y2 = startY; y2 <= endY; y2++) {
            for (let x2 = startX; x2 <= endX; x2++) {
                const distance = Math.sqrt((x2 - rebellionCity.x) ** 2 + (y2 - rebellionCity.y) ** 2);
                if (distance <= startRadius && this.map.nationMap[y2][x2] === nation.id) {
                    this.map.nationMap[y2][x2] = newNation.id;
                    claimedTiles++;
                    if (!visited.has(key(x2,y2))) {
                        visited.add(key(x2,y2));
                        queue.push({x:x2, y:y2});
                    }
                }
            }
        }
        
        // Continue floodfill for a contiguous region
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];

        while (queue.length > 0 && claimedTiles < maxTilesToClaim) {
            const current = queue.shift();
            
            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                const nextKey = key(nx, ny);
                
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight && !visited.has(nextKey)) {
                    if (this.map.nationMap[ny][nx] === nation.id) {
                        this.map.nationMap[ny][nx] = newNation.id;
                        claimedTiles++;
                        visited.add(nextKey);
                        queue.push({x: nx, y: ny});
                        if (claimedTiles >= maxTilesToClaim) break;
                    }
                }
            }
        }
        
        // Transfer the rebellion city to the new nation
        newNation.cities.push({ ...rebellionCity, nationId: newNation.id });
        if (rebellionCity.size === 4) { // If it was a capital, set it as capital for the new nation
            newNation.capitals.push(rebellionCity.name);
        }
        // Remove the city from parent nation's list
        nation.cities = nation.cities.filter(city => city.name !== rebellionCity.name);
        nation.capitals = nation.capitals.filter(capital => capital !== rebellionCity.name);


        // Show notification about the split
        this.showNotification(
            '국가 분열',
            `${newNation.name} 지역이 ${nation.name}으로부터 독립을 선언하고 전쟁이 시작되었습니다!`,
            '#aa66aa'
        );
        
        // Update the nations list
        const nationManager = new NationManager(this.map);
        nationManager.renderNationsList();
    }
    
    calculateNationCenter(territory) {
        let sumX = 0, sumY = 0;
        for (const tile of territory) {
            sumX += tile.x;
            sumY += tile.y;
        }
        return {
            x: Math.floor(sumX / territory.length),
            y: Math.floor(sumY / territory.length)
        };
    }
    
    generateDistinctColor(baseColor) {
        // Parse the base color
        let r = parseInt(baseColor.slice(1, 3), 16);
        let g = parseInt(baseColor.slice(3, 5), 16);
        let b = parseInt(baseColor.slice(5, 7), 16);
        
        // Convert to HSL
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b);
        let min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        // Shift the hue significantly (e.g., by 90-270 degrees)
        h = (h + (0.25 + Math.random() * 0.5)) % 1; // Shift by 0.25 to 0.75 of the color wheel

        // Slightly vary saturation and lightness to make it more distinct
        s = Math.max(0.4, Math.min(0.9, s + (Math.random() * 0.4 - 0.2))); // 0.4-0.9
        l = Math.max(0.3, Math.min(0.7, l + (Math.random() * 0.4 - 0.2))); // 0.3-0.7

        // Convert back to RGB
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);

        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);
        
        // Ensure minimum brightness
        if ((r + g + b) / 3 < 50) { // If too dark, lighten it
            const factor = 50 / ((r + g + b) / 3 || 1);
            r = Math.min(255, r * factor);
            g = Math.min(255, g * factor);
            b = Math.min(255, b * factor);
        }

        return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    }
    
    generateSplitNationName(baseName) {
        const prefixes = ['New', 'Free', 'Democratic', 'United', 'Independent', 'Autonomous', 'Sovereign', 'Revolutionary', 'Peoples', 'Rebel'];
        const suffixes = ['Republic', 'Kingdom', 'State', 'Federation', 'Alliance', 'Dominion', 'Coalition', 'Front', 'Nation', 'Union'];
        
        // Remove common prefixes/suffixes from the base name
        let cleanName = baseName;
        const commonPrefixes = ['공화국', '왕국', '제국', '연합', '자유국', '공국', '대공국', '연방', '자치령'];
        for (const prefix of commonPrefixes) {
            if (cleanName.startsWith(prefix + ' ')) {
                cleanName = cleanName.substring(prefix.length + 1);
                break;
            }
        }
        const commonSuffixes = ['ia', 'land', 'mark', 'stan', 'or', 'ium', 'en', 'ica', 'eth', 'onia', 'aria', 'dor', 'gard', 'burg', 'don', 'minster', 'shire'];
        for (const suffix of commonSuffixes) {
            if (cleanName.endsWith(suffix)) {
                cleanName = cleanName.substring(0, cleanName.length - suffix.length);
                break;
            }
        }

        cleanName = cleanName.trim();
        if (cleanName.length < 3) cleanName = "Region"; // Fallback if name is too short after cleaning
        
        // 50% chance to use prefix, 50% chance to use suffix
        if (Math.random() < 0.5) {
            return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${cleanName}`;
        } else {
            return `${cleanName} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
        }
    }
    
    randomRelatedGovernment(currentGovernment) {
        const governments = {
            'Monarchy': ['Constitutional Monarchy', 'Principality', 'Grand Duchy', 'Empire'],
            'Republic': ['Democratic Republic', 'Federal Republic', 'People\'s Republic', 'Constitutional Republic', 'Commune'],
            'Democracy': ['Direct Democracy', 'Representative Democracy', 'Constitutional Democracy', 'Republic'],
            'Empire': ['Monarchy', 'Dominion', 'Hegemony', 'Imperium'],
            'Federation': ['Confederation', 'Union', 'Alliance', 'Republic'],
            'Dictatorship': ['Military Junta', 'Authoritarian Regime', 'Totalitarian State', 'Empire'],
            'Oligarchy': ['Plutocracy', 'Aristocracy', 'Corporatocracy', 'Council State'],
            'Theocracy': ['Religious State', 'Divine Monarchy', 'Pontificate', 'Holy Republic'],
            'Aristocracy': ['Oligarchy', 'Monarchy', 'Noble Republic', 'Feudal State'],
            'Technocracy': ['Scientific State', 'Cybernetic Regime', 'Logocracy'],
            'Syndicate': ['Council State', 'Union', 'Collective'],
            'Commune': ['Direct Democracy', 'Council State', 'People\'s Republic']
        };
        
        // If the current government is in our list, choose a related one
        if (governments[currentGovernment]) {
            return governments[currentGovernment][Math.floor(Math.random() * governments[currentGovernment].length)];
        }
        
        // Otherwise, choose a random government type
        const allGovernments = Object.keys(governments);
        return allGovernments[Math.floor(Math.random() * allGovernments.length)];
    }
    
    showNotification(title, message, color) {
        const notification = document.createElement('div');
        notification.className = 'war-notification';
        notification.style.borderLeft = `4px solid ${color}`;
        notification.innerHTML = `<strong>${title}:</strong> ${message}`;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
    }
    
    showWarNotification(nation1, nation2, message) {
        this.showNotification('전쟁 선포', message, '#ff6666');
    }
    
    getNationTerritory(nationId) {
        const territory = [];
        
        for (let y = 0; y < this.map.mapHeight; y++) {
            for (let x = 0; x < this.map.mapWidth; x++) {
                if (this.map.nationMap[y][x] === nationId) {
                    territory.push({x, y});
                }
            }
        }
        
        return territory;
    }
    
    findBorderTiles(territory, nationId, targetNationId = null) {
        const borderTiles = [];
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const tile of territory) {
            for (const dir of directions) {
                const nx = tile.x + dir.x;
                const ny = tile.y + dir.y;
                
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    const neighborNationId = this.map.nationMap[ny][nx];
                    
                    // If targeting a specific nation, only consider borders with that nation
                    if (targetNationId !== null) {
                        if (neighborNationId === targetNationId) {
                            borderTiles.push(tile);
                            break;
                        }
                    } 
                    // Otherwise consider any border with non-nation or different nation
                    else if (neighborNationId !== nationId) {
                        borderTiles.push(tile);
                        break;
                    }
                }
            }
        }
        
        return borderTiles;
    }
    
    findExpandableTiles(x, y, nationId) {
        const expandableTiles = [];
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            
            if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                // Can expand into territory that's not water and either unclaimed or belongs to another nation
                if (this.map.terrainMap[ny][nx] !== 'shallow-water' && 
                    this.map.terrainMap[ny][nx] !== 'medium-water' && 
                    this.map.terrainMap[ny][nx] !== 'deep-water' &&
                    this.map.nationMap[ny][nx] !== nationId) {
                    expandableTiles.push({x: nx, y: ny});
                }
            }
        }
        
        return expandableTiles;
    }
    
    findEnemyTiles(x, y, nationId, targetNationId) {
        const enemyTiles = [];
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            
            if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                // Look specifically for tiles owned by the target nation
                if (this.map.terrainMap[ny][nx] !== 'shallow-water' && 
                    this.map.terrainMap[ny][nx] !== 'medium-water' && 
                    this.map.terrainMap[ny][nx] !== 'deep-water' &&
                    this.map.nationMap[ny][nx] === targetNationId) {
                    enemyTiles.push({x: nx, y: ny});
                }
            }
        }
        
        return enemyTiles;
    }
    
    findNeighboringNations(nationId) {
        const territory = this.getNationTerritory(nationId);
        const neighbors = new Set();
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        for (const tile of territory) {
            for (const dir of directions) {
                const nx = tile.x + dir.x;
                const ny = tile.y + dir.y;
                
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    const neighborNationId = this.map.nationMap[ny][nx];
                    if (neighborNationId !== null && neighborNationId !== nationId) {
                        neighbors.add(neighborNationId);
                    }
                }
            }
        }
        
        return Array.from(neighbors);
    }
    
    considerVassalization(nation) {
        // Find smaller neighboring nations to potentially vassalize
        const neighbors = this.findNeighboringNations(nation.id);
        const potentialVassals = neighbors.filter(neighborId => {
            const neighbor = nations.find(n => n.id === neighborId);
            if (!neighbor) return false;
            
            // Check if neighbor is much smaller
            const nationTerritory = this.getNationTerritory(nation.id).length;
            const neighborTerritory = this.getNationTerritory(neighborId).length;
            
            return neighborTerritory < nationTerritory * 0.5 && // Less than 50% the size
                   (!neighbor.overlord) && // Not already a vassal
                   (!nation.vassals || !nation.vassals.includes(neighborId)) && // Not already our vassal
                   (!this.areNationsAllied(nation.id, neighborId)) && // Not allies
                   (!nation.atWarWith.includes(neighborId)); // Not at war
        });
        
        if (potentialVassals.length === 0) return;
        
        // Choose a random nation to vassalize
        const vassalId = potentialVassals[Math.floor(Math.random() * potentialVassals.length)];
        const vassal = nations.find(n => n.id === vassalId);
        if (!vassal) return;
        
        // Determine if vassalization succeeds (50% base chance)
        const nationStrength = this.getNationTerritory(nation.id).length + 
                              (this.nationHasNavies(nation.id) ? 20 : 0) +
                              (nation.armyStrength * 10); // Add army strength
        const vassalStrength = this.getNationTerritory(vassalId).length +
                             (this.nationHasNavies(vassalId) ? 10 : 0) +
                             (vassal.armyStrength * 10); // Add army strength
        
        const successChance = 0.5 * (nationStrength / (nationStrength + vassalStrength));
        
        if (Math.random() < successChance) {
            // Vassalization succeeds
            if (!nation.vassals) nation.vassals = [];
            nation.vassals.push(vassalId);
            vassal.overlord = nation.id; // Set overlord
            vassal.isRebel = false; // Cannot be a rebel if vassalized

            // Remove any existing alliances between them
            if (nation.allies) {
                nation.allies = nation.allies.filter(allyId => allyId !== vassalId);
            }
            if (vassal.allies) {
                vassal.allies = vassal.allies.filter(allyId => allyId !== nation.id);
            }
            
            // End any wars between them
            if (nation.atWarWith) {
                nation.atWarWith = nation.atWarWith.filter(enemyId => enemyId !== vassalId);
            }
            if (vassal.atWarWith) {
                vassal.atWarWith = vassal.atWarWith.filter(enemyId => enemyId !== nation.id);
            }
            
            this.showNotification(
                '속국화',
                `${vassal.name}이(가) ${nation.name}의 속국이 되었습니다!`,
                '#aa66aa'
            );
            // Re-render the nations list to update vassal badges
            const nationManager = new NationManager(this.map);
            nationManager.renderNationsList();
        }
    }
    
    considerWorldWar(nation) {
        // Need at least 6 nations for a world war
        if (nations.length < 6) return;
        
        // Need at least 2 major alliances
        const alliances = this.identifyMajorAlliances();
        if (alliances.length < 2) return;
        
        // Select two opposing alliances
        const alliance1 = alliances[0];
        const alliance2 = alliances[1];
        
        // Check if they're big enough to be meaningful
        if (alliance1.members.length < 2 || alliance2.members.length < 2) return;
        
        // Start the world war
        this.worldWarActive = true;
        this.worldWarParticipants.alliance1 = alliance1.members.map(n => n.id);
        this.worldWarParticipants.alliance2 = alliance2.members.map(n => n.id);
        
        // Create war links between all participants
        for (const nationId1 of this.worldWarParticipants.alliance1) {
            const nation1 = nations.find(n => n.id === nationId1);
            if (!nation1) continue;
            
            if (!nation1.atWarWith) nation1.atWarWith = [];
            
            for (const nationId2 of this.worldWarParticipants.alliance2) {
                if (!nation1.atWarWith.includes(nationId2)) {
                    nation1.atWarWith.push(nationId2);
                    nation1.warStartYears[nationId2] = currentYear;
                    this.activeWars.push({
                        attackerId: nationId1, 
                        defenderId: nationId2, 
                        warStartYear: currentYear,
                        battleCooldown: 0 // Ready for battle
                    });
                }
            }
        }
        
        for (const nationId2 of this.worldWarParticipants.alliance2) {
            const nation2 = nations.find(n => n.id === nationId2);
            if (!nation2) continue;
            
            if (!nation2.atWarWith) nation2.atWarWith = [];
            
            for (const nationId1 of this.worldWarParticipants.alliance1) {
                if (!nation2.atWarWith.includes(nationId1)) {
                    nation2.atWarWith.push(nationId1);
                    nation2.warStartYears[nationId1] = currentYear;
                }
            }
        }
        
        // Convert some navies to battle navies
        for (const navy of this.navies) {
            const isAlliance1 = this.worldWarParticipants.alliance1.includes(navy.nationId);
            const isAlliance2 = this.worldWarParticipants.alliance2.includes(navy.nationId);
            
            if (isAlliance1 || isAlliance2) {
                if (Math.random() < 0.6) {
                    navy.type = 'battle';
                    navy.mission = 'attack';
                    
                    // Target an enemy
                    const enemyAlliance = isAlliance1 ? 
                        this.worldWarParticipants.alliance2 : 
                        this.worldWarParticipants.alliance1;
                        
                    if (enemyAlliance.length > 0) {
                        const enemyId = enemyAlliance[Math.floor(Math.random() * enemyAlliance.length)];
                        const enemyCoastalTiles = this.getCoastalTiles(enemyId);
                        
                        if (enemyCoastalTiles.length > 0) {
                            navy.targetLocation = enemyCoastalTiles[Math.floor(Math.random() * enemyCoastalTiles.length)];
                        }
                    }
                }
            }
        }
        
        // Display world war notification
        const alliance1Names = alliance1.members.map(n => n.name).join(', ');
        const alliance2Names = alliance2.members.map(n => n.name).join(', ');
        
        this.showNotification(
            '세계 대전',
            `두 동맹 간의 세계적 분쟁이 발발했습니다: ${alliance1Names} 대 ${alliance2Names}!`,
            '#ff0000'
        );
        
        // Set world war to end after 20-40 turns
        setTimeout(() => {
            this.endWorldWar();
        }, (20 + Math.floor(Math.random() * 20)) * 1000);
    }
    
    identifyMajorAlliances() {
        const alliances = [];
        const processed = new Set();
        
        for (const nation of nations) {
            if (processed.has(nation.id)) continue;
            
            // Skip vassals (they follow their overlord)
            if (nation.overlord) {
                processed.add(nation.id);
                continue;
            }
            
            if (nation.allies && nation.allies.length > 0) {
                const allianceMembers = [nation];
                processed.add(nation.id);
                
                // Add all allies
                for (const allyId of nation.allies) {
                    if (!processed.has(allyId)) {
                        const ally = nations.find(n => n.id === allyId);
                        if (ally && !ally.overlord) { // Skip vassals
                            allianceMembers.push(ally);
                            processed.add(allyId);
                        }
                    }
                }
                
                // Add all vassals
                if (nation.vassals) {
                    for (const vassalId of nation.vassals) {
                        if (!processed.has(vassalId)) {
                            const vassal = nations.find(n => n.id === vassalId);
                            if (vassal) {
                                allianceMembers.push(vassal);
                                processed.add(vassalId);
                            }
                        }
                    }
                }
                
                if (allianceMembers.length > 1) {
                    alliances.push({
                        leader: nation,
                        members: allianceMembers,
                        power: this.calculateAlliancePower(allianceMembers)
                    });
                }
            }
        }
        
        // Sort by power, descending
        return alliances.sort((a, b) => b.power - a.power);
    }
    
    calculateAlliancePower(members) {
        let power = 0;
        
        for (const nation of members) {
            // Territory size
            power += this.getNationTerritory(nation.id).length;
            
            // Cities
            if (nation.cities) {
                power += nation.cities.length * 5;
            }
            
            // Navies
            const navies = this.navies.filter(navy => navy.nationId === nation.id);
            power += navies.length * 3;
            
            // Battle navies worth more
            const battleNavies = navies.filter(navy => navy.type === 'battle');
            power += battleNavies.length * 5;

            // Army Strength
            power += nation.armyStrength * 10;
        }
        
        return power;
    }
    
    endWorldWar() {
        if (!this.worldWarActive) return;
        
        // Calculate which alliance won
        let alliance1Power = 0;
        let alliance2Power = 0;
        
        // Calculate remaining power
        for (const nationId of this.worldWarParticipants.alliance1) {
            const nation = nations.find(n => n.id === nationId);
            if (nation) {
                alliance1Power += this.getNationTerritory(nationId).length;
            }
        }
        
        for (const nationId of this.worldWarParticipants.alliance2) {
            const nation = nations.find(n => n.id === nationId);
            if (nation) {
                alliance2Power += this.getNationTerritory(nationId).length;
            }
        }
        
        // Determine winner
        let winnerAllianceIds, loserAllianceIds;
        if (alliance1Power > alliance2Power) {
            winnerAllianceIds = this.worldWarParticipants.alliance1;
            loserAllianceIds = this.worldWarParticipants.alliance2;
        } else {
            winnerAllianceIds = this.worldWarParticipants.alliance2;
            loserAllianceIds = this.worldWarParticipants.alliance1;
        }
        
        // Resolve territorial changes and vassalizations
        for (const winnerId of winnerAllianceIds) {
            const winner = nations.find(n => n.id === winnerId);
            if (!winner) continue;
            
            for (const loserId of loserAllianceIds) {
                const loser = nations.find(n => n.id === loserId);
                if (!loser) continue;
                
                // If there's an active war entry for this pair, resolve it as peace
                const warIndex = this.activeWars.findIndex(w => 
                    (w.attackerId === winnerId && w.defenderId === loserId) ||
                    (w.attackerId === loserId && w.defenderId === winnerId)
                );
                if (warIndex !== -1) {
                    this.resolvePeaceTreaty(this.activeWars[warIndex], winnerId); // Pass winner for resolution
                }
            }
        }
        
        // Ensure all war states are cleared for participants
        for (const nation of nations) {
            if (this.worldWarParticipants.alliance1.includes(nation.id) || 
                this.worldWarParticipants.alliance2.includes(nation.id)) {
                
                if (nation.atWarWith) {
                    nation.atWarWith = nation.atWarWith.filter(enemyId => 
                        !this.worldWarParticipants.alliance1.includes(enemyId) && 
                        !this.worldWarParticipants.alliance2.includes(enemyId)
                    );
                }
            }
        }
        
        // Reset world war state
        this.worldWarActive = false;
        this.worldWarParticipants = {alliance1: [], alliance2: []};
        
        // Show peace notification
        const winnerNames = winnerAllianceIds.map(id => {
            const nation = nations.find(n => n.id === id);
            return nation ? nation.name : "Unknown";
        }).join(", ");
        
        this.showNotification(
            '세계 대전 종료',
            `세계적 분쟁이 ${winnerNames}의 승리로 종료되었습니다!`,
            '#66aa66'
        );

        // Update nations list for potential vassal changes
        const nationManager = new NationManager(this.map);
        nationManager.renderNationsList();
    }
    
    areNationsAllied(nationId1, nationId2) {
        const nation1 = nations.find(n => n.id === nationId1);
        return nation1 && nation1.allies && nation1.allies.includes(nationId2);
    }
    
    createRandomCity(nation) {
        // Get nation territory
        const territory = this.getNationTerritory(nation.id);
        if (territory.length < 10) return; // Need some minimum territory
        
        // Choose a random spot that's not near existing cities
        const validSpots = territory.filter(tile => {
            // Check if this tile is far enough from existing cities
            for (const city of this.map.cityMap) {
                const dx = tile.x - city.x;
                const dy = tile.y - city.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < 10) return false; // Too close to existing city
            }
            return true;
        });
        
        if (validSpots.length === 0) return;
        
        // Select random spot
        const spot = validSpots[Math.floor(Math.random() * validSpots.length)];
        
        // Generate city name
        const cityName = this.generateCityName();
        
        // Determine city size (1-3, 10% chance for capital)
        let citySize = Math.floor(Math.random() * 3) + 1;
        const isCapital = Math.random() < 0.1;
        if (isCapital) citySize = 4;
        
        // Add city to map
        this.map.addCity(spot.x, spot.y, cityName, citySize, nation.id);
        
        // Add city to nation's city list
        if (!nation.cities) nation.cities = [];
        nation.cities.push({
            name: cityName,
            size: citySize,
            x: spot.x,
            y: spot.y
        });
        
        // If it's a capital, add to capitals
        if (isCapital) {
            if (!nation.capitals) nation.capitals = [];
            nation.capitals.push(cityName);
        }
        
        // Show notification for large cities and capitals
        if (citySize >= 3) {
            const cityType = isCapital ? "capital city" : "major city";
            this.showNotification(
                '새로운 도시',
                `${nation.name}이(가) ${cityName} ${cityType === "capital city" ? "수도" : "대도시"}를 설립했습니다!`,
                '#66aa66'
            );
        }
    }
    
    generateCityName() {
        const prefixes = ['신', '구', '요새', '항구', '산', '호수', '북', '남', '동', '서', '상', '하', '대', '소', '흑', '백'];
        const roots = ['요크', '런던', '파리', '로마', '베를린', '아테네', '카이로', '델리', '베른', '오슬로', '리마', '리오', '헤이븐', '우드', '필드', '데일', '보르그', '폴리', '그라드', '슈타인', '비스타', '리버'];
        const suffixes = ['빌', '부르크', '톤', '필드', '포드', '헤이븐', '포트', '우드', '랜드', '샤이어', '그라드', '이아', '마우스', '브릿지', '캐슬', '홀름', '비'];
        
        // 30% chance to use a prefix
        let name = '';
        if (Math.random() < 0.3) {
            name += prefixes[Math.floor(Math.random() * prefixes.length)] + ' ';
        }
        
        // Always use a root
        name += roots[Math.floor(Math.random() * roots.length)];
        
        // 40% chance to use a suffix
        if (Math.random() < 0.4) {
            name += suffixes[Math.floor(Math.random() * suffixes.length)];
        }
        
        return name.trim();
    }
    
    generateColonialCityName(nationName) {
        const prefixes = ['신', '항구', '요새', '곶', '만', '산'];
        const suffix = nationName.split(' ').pop(); // 국가 이름의 마지막 단어 사용
        
        // 70% chance to use "신 X" 형식
        if (Math.random() < 0.7) {
            return `신${suffix}`;
        } else {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            return `${prefix} ${suffix}`;
        }
    }
    
    considerTradeAgreement(nation) {
        // Find potential trade partners (nations that aren't enemies or vassals/overlords)
        const potentialPartners = nations.filter(other => 
            other.id !== nation.id && 
            (!nation.atWarWith || !nation.atWarWith.includes(other.id)) &&
            other.overlord !== nation.id && // Not their vassal
            nation.overlord !== other.id // Not their overlord
        );
        
        if (potentialPartners.length === 0) return;
        
        // Choose a random nation to trade with
        const partner = potentialPartners[Math.floor(Math.random() * potentialPartners.length)];
        
        // Initialize economy object if it doesn't exist
        if (!nation.economy) {
            nation.economy = {
                tradeRoutes: [],
                resources: this.generateRandomResources(),
                industries: this.generateRandomIndustries()
            };
        }
        
        if (!partner.economy) {
            partner.economy = {
                tradeRoutes: [],
                resources: this.generateRandomResources(),
                industries: this.generateRandomIndustries()
            };
        }
        
        // Check if trade route already exists
        if (nation.economy.tradeRoutes && 
            nation.economy.tradeRoutes.some(route => route.partnerId === partner.id)) {
            return;
        }
        
        // Calculate trade value based on complementary resources and distance
        let tradeValue = Math.floor(Math.random() * 5) + 1; // Base trade value (1-5)
        
        // Boost value if nations have complementary resources
        if (nation.economy.resources && partner.economy.resources) {
            const nationResources = Object.keys(nation.economy.resources);
            const partnerResources = Object.keys(partner.economy.resources);
            
            // Resources the partner has that this nation doesn't
            const complementaryResources = partnerResources.filter(r => !nationResources.includes(r));
            tradeValue += complementaryResources.length;
            
            // Resources this nation has that the partner doesn't
            const reverseComplementaryResources = nationResources.filter(r => !partnerResources.includes(r));
            tradeValue += reverseComplementaryResources.length;
        }
        
        // Create trade routes for both nations
        if (!nation.economy.tradeRoutes) nation.economy.tradeRoutes = [];
        if (!partner.economy.tradeRoutes) partner.economy.tradeRoutes = [];
        
        nation.economy.tradeRoutes.push({
            partnerId: partner.id,
            value: tradeValue,
            resourcesTraded: this.generateTradedResources(nation, partner)
        });
        
        partner.economy.tradeRoutes.push({
            partnerId: nation.id,
            value: tradeValue,
            resourcesTraded: this.generateTradedResources(partner, nation)
        });
        
        // Create a visual trade route
        this.tradeRoutes.push({
            nation1Id: nation.id,
            nation2Id: partner.id,
            value: tradeValue,
            yearEstablished: currentYear
        });
        
        console.log(`Trade route established between ${nation.name} and ${partner.name} with value ${tradeValue}`);
        
        // GDP boost from new trade (further reduced)
        nation.gdp += Math.floor(tradeValue * 0.5);
        partner.gdp += Math.floor(tradeValue * 0.5);
        
        // Population growth from trade (further reduced)
        nation.population += Math.floor(tradeValue * 20);
        partner.population += Math.floor(tradeValue * 20);
        
        // Show notification
        this.showNotification(
            '무역 협정',
            `${nation.name}와(과) ${partner.name}이(가) ${tradeValue} 가치의 무역 경로를 설립했습니다!`,
            '#66aaff'
        );
    }
    
    generateTradedResources(nation1, nation2) {
        if (!nation1.economy || !nation1.economy.resources || 
            !nation2.economy || !nation2.economy.resources) {
            return ['goods'];
        }
        
        const nation1Resources = Object.keys(nation1.economy.resources);
        const nation2Resources = Object.keys(nation2.economy.resources);
        
        // Resources nation1 has that nation2 doesn't
        const tradedResources = nation1Resources.filter(r => !nation2Resources.includes(r));
        
        // If no unique resources, just trade generic goods
        if (tradedResources.length === 0) {
            return ['goods'];
        }
        
        return tradedResources;
    }
    
    considerAlliance(nation) {
        // Find neighboring nations that aren't enemies or vassals/overlords
        const neighbors = this.findNeighboringNations(nation.id);
        const potentialAllies = neighbors.filter(neighborId => {
            const neighbor = nations.find(n => n.id === neighborId);
            return neighbor && 
                (!nation.atWarWith || !nation.atWarWith.includes(neighborId)) &&
                (!this.areNationsAllied(nation.id, neighborId)) &&
                neighbor.overlord !== nation.id && // Not their vassal
                nation.overlord !== neighbor.id; // Not their overlord
        });
        
        if (potentialAllies.length === 0) return;
        
        // Choose a random nation to ally with
        const allyId = potentialAllies[Math.floor(Math.random() * potentialAllies.length)];
        const ally = nations.find(n => n.id === allyId);
        if (!ally) return;
        
        // Form alliance
        if (!nation.allies) nation.allies = [];
        if (!ally.allies) ally.allies = [];
        
        nation.allies.push(allyId);
        ally.allies.push(nation.id);
        
        // Show alliance notification
        this.showNotification(
            '동맹 형성',
            `${nation.name}와(과) ${ally.name}이(가) 동맹을 맺었습니다!`,
            '#66aaff'
        );
    }
    
    considerWar(nation) {
        // Nations with an overlord cannot declare war directly
        if (nation.overlord) return;

        // Find neighboring nations (excluding vassals and overlords)
        const neighbors = this.findNeighboringNations(nation.id);
        const potentialEnemies = neighbors.filter(neighborId => {
            const neighbor = nations.find(n => n.id === neighborId);
            // Cannot declare war on self, allies, vassals, or overlord
            return neighbor && 
                   neighbor.id !== nation.id &&
                   (!nation.allies || !nation.allies.includes(neighborId)) &&
                   (!nation.vassals || !nation.vassals.includes(neighborId)) &&
                   neighbor.overlord !== nation.id &&
                   nation.overlord !== neighbor.id &&
                   (!nation.atWarWith || !nation.atWarWith.includes(neighborId)); // Not already at war
        });

        if (potentialEnemies.length === 0) return;
        
        // Stability check - unstable nations less likely to declare war (unless desperate)
        // If stability is low, they might declare war out of desperation
        let warDesire = (100 - nation.stability) / 100; // Higher when stability is low
        let baseWarChance = 0.05; // Base chance to start a war
        
        if (Math.random() > (baseWarChance + warDesire * 0.1)) { // Increased chance if desperate
            return;
        }

        // Choose a random neighbor to attack
        const targetNationId = potentialEnemies[Math.floor(Math.random() * potentialEnemies.length)];
        const targetNation = nations.find(n => n.id === targetNationId);
        if (!targetNation) return;
        
        // Track war state
        if (!nation.atWarWith) nation.atWarWith = [];
        if (!nation.atWarWith.includes(targetNationId)) {
            nation.atWarWith.push(targetNationId);
            nation.warStartYears[targetNationId] = currentYear;
            
            // Same for target nation
            if (!targetNation.atWarWith) targetNation.atWarWith = [];
            if (!targetNation.atWarWith.includes(nation.id)) {
                targetNation.atWarWith.push(nation.id);
                targetNation.warStartYears[nation.id] = currentYear;
            }

            // Add to active wars list
            this.activeWars.push({
                attackerId: nation.id,
                defenderId: targetNationId,
                warStartYear: currentYear,
                battleCooldown: 0
            });
            
            // Reduce stability for both nations
            nation.stability = Math.max(10, nation.stability - 10);
            targetNation.stability = Math.max(10, targetNation.stability - 15); // Defender loses more stability initially
            
            // Check if allies should join the war
            this.considerAllySupport(nation, targetNation);
        }
        
        // Declare war message
        this.showWarNotification(nation.name, targetNation.name, `${nation.name}와(과) ${targetNation.name} 사이에 전쟁이 발발했습니다!`);
    }

    // New function to manage ongoing wars and battles
    conductWars() {
        const warsToEnd = [];
        const newActiveWars = [];

        for (const war of this.activeWars) {
            const attacker = nations.find(n => n.id === war.attackerId);
            const defender = nations.find(n => n.id === war.defenderId);

            if (!attacker || !defender || !attacker.atWarWith.includes(defender.id)) {
                // War has ended or one participant is gone
                continue;
            }

            war.battleCooldown = Math.max(0, war.battleCooldown - 1);

            // Conduct battles frequently
            if (war.battleCooldown === 0) {
                this.conductWarBattle(attacker, defender);
                // Set cooldown for next battle (e.g., 1-3 turns)
                war.battleCooldown = Math.floor(Math.random() * 3) + 1;
            }

            // Check for war conclusion (one nation eliminated or war duration)
            const attackerTerritory = this.getNationTerritory(attacker.id).length;
            const defenderTerritory = this.getNationTerritory(defender.id).length;

            if (attackerTerritory === 0 || defenderTerritory === 0) {
                warsToEnd.push(war);
            } else if (currentYear - war.warStartYear >= (20 + Math.random() * 10)) { // War lasts 20-30 years max before auto-peace
                warsToEnd.push(war);
            } else {
                newActiveWars.push(war);
            }
        }
        this.activeWars = newActiveWars;

        // Resolve ended wars
        for (const war of warsToEnd) {
            this.considerPeaceTreaty(nations.find(n => n.id === war.attackerId), war);
        }
    }

    conductWarBattle(attackingNation, defendingNation) {
        // Find a battle location (border tile)
        const attackingNationTerritory = this.getNationTerritory(attackingNation.id);
        const borderTiles = this.findBorderTiles(attackingNationTerritory, attackingNation.id, defendingNation.id);

        if (borderTiles.length === 0) {
            // No direct border, can't fight here right now, maybe a naval invasion needed
            return;
        }

        const battleLocation = borderTiles[Math.floor(Math.random() * borderTiles.length)];
        const targetTiles = this.findEnemyTiles(battleLocation.x, battleLocation.y, attackingNation.id, defendingNation.id);
        
        if (targetTiles.length === 0) {
            // No direct enemy tile to attack, means border is odd or already captured.
            return;
        }
        const battleTarget = targetTiles[Math.floor(Math.random() * targetTiles.length)];
        
        // Determine winner
        // Attacker wins if their army strength + random factor > defender army strength + random factor
        const attackerPower = attackingNation.armyStrength + Math.random() * 3;
        const defenderPower = defendingNation.armyStrength + Math.random() * 3;

        let winner = null;
        let loser = null;
        let capturedTiles = 0;

        if (attackerPower > defenderPower) {
            winner = attackingNation;
            loser = defendingNation;
            // Attacker expands. Number of tiles based on difference in army strength
            capturedTiles = Math.max(1, Math.floor((attackerPower - defenderPower) * (Math.random() * 0.5 + 0.5))); // 1-3 tiles
            capturedTiles = Math.min(capturedTiles, 5); // Max 5 tiles per battle

            // Annex territory
            const queue = [battleTarget];
            const visited = new Set([`${battleTarget.x},${battleTarget.y}`]);
            let tilesAnnexed = 0;
            const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];

            while (queue.length > 0 && tilesAnnexed < capturedTiles) {
                const current = queue.shift();
                const currentKey = `${current.x},${current.y}`;

                if (this.map.nationMap[current.y][current.x] === loser.id) {
                    this.map.nationMap[current.y][current.x] = winner.id;
                    tilesAnnexed++;
                }

                for (const dir of directions) {
                    const nx = current.x + dir.x;
                    const ny = current.y + dir.y;
                    const nextKey = `${nx},${ny}`;
                    if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight && !visited.has(nextKey)) {
                        visited.add(nextKey);
                        if (this.map.nationMap[ny][nx] === loser.id) {
                            queue.push({x: nx, y: ny});
                        }
                    }
                }
            }
            if (tilesAnnexed > 0) {
                // Small stability boost for winner, larger drop for loser
                winner.stability = Math.min(100, winner.stability + 1);
                loser.stability = Math.max(10, loser.stability - 3);
            }
        } else {
            // Defender wins (or draw, attacker loses slight ground)
            winner = defendingNation;
            loser = attackingNation;
            // Defender pushes back, maybe recaptures 1 tile or just holds ground
            if (Math.random() < 0.3) { // 30% chance to recapture 1 tile
                // Find a tile of winner that was previously loser's
                const winnerTerritory = this.getNationTerritory(winner.id);
                const borderWithLoser = this.findBorderTiles(winnerTerritory, winner.id, loser.id);
                if (borderWithLoser.length > 0) {
                    const recapturedTile = borderWithLoser[Math.floor(Math.random() * borderWithLoser.length)];
                    this.map.nationMap[recapturedTile.y][recapturedTile.x] = loser.id; // Loser reclaims
                }
            }
            winner.stability = Math.min(100, winner.stability + 1);
            loser.stability = Math.max(10, loser.stability - 1);
        }

        // Add battle effect (white dot)
        this.map.addBattleEffect(battleTarget.x, battleTarget.y);
        
        // Check if a nation has been eliminated
        if (this.getNationTerritory(defendingNation.id).length === 0) {
            // Defender eliminated, mark war for ending
            // This will be handled by conductWars which calls considerPeaceTreaty
            // with the war object, including the winner.
        } else if (this.getNationTerritory(attackingNation.id).length === 0) {
            // Attacker eliminated (shouldn't happen often, but just in case)
            // This also gets handled by conductWars.
        }
    }
    
    considerAllySupport(attackingNation, defendingNation) {
        // Check if attacking nation has allies
        if (attackingNation.allies && attackingNation.allies.length > 0) {
            // 60% chance for each ally to join the war
            for (const allyId of attackingNation.allies) {
                if (Math.random() < 0.6) {
                    const ally = nations.find(n => n.id === allyId);
                    if (!ally) continue;
                    
                    // Join the war
                    if (!ally.atWarWith) ally.atWarWith = [];
                    if (!ally.atWarWith.includes(defendingNation.id)) {
                        ally.atWarWith.push(defendingNation.id);
                        ally.warStartYears[defendingNation.id] = currentYear;
                        
                        // Update defending nation as well
                        if (!defendingNation.atWarWith) defendingNation.atWarWith = [];
                        if (!defendingNation.atWarWith.includes(ally.id)) {
                            defendingNation.atWarWith.push(ally.id);
                            defendingNation.warStartYears[ally.id] = currentYear;
                        }

                        // Add to active wars list (new pair)
                        this.activeWars.push({
                            attackerId: ally.id,
                            defenderId: defendingNation.id,
                            warStartYear: currentYear,
                            battleCooldown: 0
                        });
                        this.showNotification(
                            '동맹 전쟁',
                            `${ally.name}이(가) 동맹국 ${attackingNation.name}과(와) 함께 ${defendingNation.name}에 대한 전쟁에 참여했습니다!`,
                            '#ff6666'
                        );
                    }
                }
            }
        }
        
        // Check if defending nation has allies
        if (defendingNation.allies && defendingNation.allies.length > 0) {
            // 60% chance for each ally to join the war
            for (const allyId of defendingNation.allies) {
                if (Math.random() < 0.6) {
                    const ally = nations.find(n => n.id === allyId);
                    if (!ally) continue;
                    
                    // Join the war
                    if (!ally.atWarWith) ally.atWarWith = [];
                    if (!ally.atWarWith.includes(attackingNation.id)) {
                        ally.atWarWith.push(attackingNation.id);
                        ally.warStartYears[attackingNation.id] = currentYear;
                        
                        // Update attacking nation as well
                        if (!attackingNation.atWarWith) attackingNation.atWarWith = [];
                        if (!attackingNation.atWarWith.includes(ally.id)) {
                            attackingNation.atWarWith.push(ally.id);
                            attackingNation.warStartYears[ally.id] = currentYear;
                        }

                        // Add to active wars list (new pair)
                        this.activeWars.push({
                            attackerId: attackingNation.id, // Attacker from defending nation's perspective
                            defenderId: ally.id,
                            warStartYear: currentYear,
                            battleCooldown: 0
                        });
                        this.showNotification(
                            '동맹 전쟁',
                            `${ally.name}이(가) 동맹국 ${defendingNation.name}을(를) 방어하기 위해 ${attackingNation.name}에 대항하는 전쟁에 참여했습니다!`,
                            '#ff6666'
                        );
                    }
                }
            }
        }
    }
    
    considerPeaceTreaty(nation, warObject = null) {
        // If specific war object provided, use that to resolve it directly.
        // This is used by conductWars to end wars.
        if (warObject) {
            const attacker = nations.find(n => n.id === warObject.attackerId);
            const defender = nations.find(n => n.id === warObject.defenderId);
            
            if (!attacker || !defender) { // One nation is already eliminated
                if (attacker) { // Attacker survived, defender eliminated
                    this.showNotification(
                        '전쟁 종료',
                        `${attacker.name}이(가) 적을 물리쳤습니다!`,
                        '#66aa66'
                    );
                    attacker.stability = Math.min(100, attacker.stability + 20); // Big boost for winning war
                } else if (defender) { // Defender survived, attacker eliminated
                     this.showNotification(
                        '전쟁 종료',
                        `${defender.name}이(가) 성공적으로 방어했습니다!`,
                        '#66aa66'
                    );
                    defender.stability = Math.min(100, defender.stability + 20); // Big boost for winning war
                }
                // Remove from atWarWith for remaining nations
                if (attacker) attacker.atWarWith = attacker.atWarWith.filter(id => id !== defender.id);
                if (defender) defender.atWarWith = defender.atWarWith.filter(id => id !== attacker.id);
                return;
            }

            this.resolvePeaceTreaty({
                attackerId: attacker.id,
                defenderId: defender.id,
                attackerTerritory: this.getNationTerritory(attacker.id).length,
                defenderTerritory: this.getNationTerritory(defender.id).length,
                isRebellion: defender.isRebel || attacker.isRebel // Check if this is a rebellion war
            });
            return;
        }

        // Standard AI-driven peace proposal (only if not a world war participant)
        if (this.worldWarActive && (this.worldWarParticipants.alliance1.includes(nation.id) || this.worldWarParticipants.alliance2.includes(nation.id))) {
            return; // World war is resolved separately
        }

        // Only consider peace if at war with at least one nation
        if (!nation.atWarWith || nation.atWarWith.length === 0) return;
        
        // Choose a random enemy to make peace with
        const enemyId = nation.atWarWith[Math.floor(Math.random() * nation.atWarWith.length)];
        const enemy = nations.find(n => n.id === enemyId);
        if (!enemy) return;

        const warEntry = this.activeWars.find(w => 
            (w.attackerId === nation.id && w.defenderId === enemy.id) ||
            (w.attackerId === enemy.id && w.defenderId === nation.id)
        );
        if (!warEntry) return; // Should not happen if atWarWith is correct

        // Calculate war duration
        const warDuration = currentYear - warEntry.warStartYear;
        
        // Longer wars are more likely to end, unstable nations seek peace
        const basePeaceChance = 0.3 + (warDuration / 100);
        const stabilityFactor = (nation.stability < 50) ? (50 - nation.stability) / 100 : 0;
        const peaceChance = basePeaceChance + stabilityFactor;
        
        if (Math.random() < peaceChance) {
            this.resolvePeaceTreaty({
                attackerId: nation.id,
                defenderId: enemy.id,
                attackerTerritory: this.getNationTerritory(nation.id).length,
                defenderTerritory: this.getNationTerritory(enemy.id).length,
                isRebellion: enemy.isRebel || nation.isRebel
            });
        }
    }

    resolvePeaceTreaty(warData, specificWinnerId = null) {
        const attacker = nations.find(n => n.id === warData.attackerId);
        const defender = nations.find(n => n.id === warData.defenderId);

        if (!attacker || !defender) return; // One nation already eliminated

        const attackerTerritoryCount = this.getNationTerritory(attacker.id).length;
        const defenderTerritoryCount = this.getNationTerritory(defender.id).length;

        let winner = null;
        let loser = null;

        if (specificWinnerId) { // Winner determined externally (e.g., world war)
            winner = (specificWinnerId === attacker.id) ? attacker : defender;
            loser = (specificWinnerId === attacker.id) ? defender : attacker;
        } else if (attackerTerritoryCount > defenderTerritoryCount * 1.2) { // Attacker significantly stronger
            winner = attacker;
            loser = defender;
        } else if (defenderTerritoryCount > attackerTerritoryCount * 1.2) { // Defender significantly stronger
            winner = defender;
            loser = attacker;
        } else { // Close match or status quo
            winner = null; // Indicate white peace
            loser = null;
        }

        // Clear war status for both
        attacker.atWarWith = attacker.atWarWith.filter(id => id !== defender.id);
        defender.atWarWith = defender.atWarWith.filter(id => id !== attacker.id);
        delete attacker.warStartYears[defender.id];
        delete defender.warStartYears[attacker.id];

        // Remove this specific war from active wars list
        this.activeWars = this.activeWars.filter(w => 
            !( (w.attackerId === attacker.id && w.defenderId === defender.id) ||
               (w.attackerId === defender.id && w.defenderId === attacker.id) )
        );

        if (warData.isRebellion) { // Special handling for rebellions
            if (winner === attacker && attacker.id === warData.attackerId) { // Parent nation wins
                this.showNotification(
                    '반란 진압',
                    `${winner.name}이(가) ${loser.name}의 반란을 진압했습니다!`,
                    '#66aa66'
                );
                winner.stability = Math.min(100, winner.stability + 15);
                
                // Reintegrate all rebel territory and eliminate rebel nation
                const loserTerritory = this.getNationTerritory(loser.id);
                for (const tile of loserTerritory) {
                    this.map.nationMap[tile.y][tile.x] = winner.id;
                }
                // Transfer cities back
                if (loser.cities) {
                    if (!winner.cities) winner.cities = [];
                    winner.cities.push(...loser.cities.map(city => ({...city, nationId: winner.id, isColony: false})));
                    winner.capitals.push(...loser.capitals); // If rebel had capital, parent reclaims it
                }
                const nationManager = new NationManager(this.map);
                nationManager.removeNation(loser.id);

            } else if (winner === defender && defender.id === warData.attackerId) { // Rebel nation wins (is attacker in some cases)
                this.showNotification(
                    '독립!',
                    `${winner.name}이(가) ${loser.name}으로부터 독립을 쟁취했습니다!`,
                    '#aa66aa'
                );
                winner.stability = Math.min(100, winner.stability + 20); // Huge boost for independence
                loser.stability = Math.max(10, loser.stability - 15); // Big hit for losing territory/vassal

                // Rebel nation is now a full, independent nation, just remove its 'isRebel' flag.
                winner.isRebel = false;
                winner.overlord = null;
                // No territory transfer needed, rebel kept what it had.
                const nationManager = new NationManager(this.map);
                nationManager.renderNationsList(); // Update list to reflect new independent nation
            } else { // White peace in rebellion
                this.showNotification(
                    '반란 평화',
                    `${attacker.name}와(과) ${defender.name} 사이에 평화가 중재되었습니다.`,
                    '#aaaaaa'
                );
                attacker.stability = Math.min(100, attacker.stability + 5);
                defender.stability = Math.min(100, defender.stability + 5);
            }

        } else { // Regular war
            if (winner) {
                const invadedTilesCount = this.countInvadedTiles(winner.id, loser.id);
                this.showNotification(
                    '평화 조약',
                    `${winner.name}이(가) ${loser.name}와(과)의 전쟁에서 승리하여 ${invadedTilesCount}개의 영토를 합병했습니다!`,
                    '#66aa66'
                );
                // No explicit annexation needed, territory is already transferred by battles.
                winner.stability = Math.min(100, winner.stability + 15);
                loser.stability = Math.max(10, loser.stability - 10);

                // Check for nation elimination
                if (this.getNationTerritory(loser.id).length === 0) {
                    const nationManager = new NationManager(this.map);
                    nationManager.removeNation(loser.id);
                    this.showNotification('국가 소멸', `${loser.name}이(가) 지도에서 사라졌습니다!`, '#ff6666');
                } else if (Math.random() < 0.2 && loser.overlord === null && this.getNationTerritory(loser.id).length < this.getNationTerritory(winner.id).length / 2) {
                    // Small chance to vassalize the loser if they are much smaller now and not already a vassal
                    if (!winner.vassals) winner.vassals = [];
                    if (!winner.vassals.includes(loser.id)) {
                        winner.vassals.push(loser.id);
                        loser.overlord = winner.id;
                        this.showNotification(
                            '속국화',
                            `${loser.name}이(가) 패배 후 ${winner.name}의 속국이 되었습니다!`,
                            '#aa66aa'
                        );
                        const nationManager = new NationManager(this.map);
                        nationManager.renderNationsList();
                    }
                }
            } else { // White peace
                this.showNotification(
                    '평화 조약',
                    `${attacker.name}와(과) ${defender.name}이(가) 영토 변경 없이 백지 평화에 합의했습니다.`,
                    '#aaaaaa'
                );
                attacker.stability = Math.min(100, attacker.stability + 5);
                defender.stability = Math.min(100, defender.stability + 5);
            }
        }
        // Ensure UI is updated
        const nationManager = new NationManager(this.map);
        nationManager.renderNationsList();
    }
    
    countInvadedTiles(attackerId, defenderId) {
        let count = 0;
        // Count tiles currently owned by attacker that were originally part of defender's initial territory
        // This is complex. A simpler approach is to count current border tiles.
        // Or, more accurately, count tiles now owned by attacker that were previously owned by defender.
        // For now, will simplify to counting tiles owned by attacker adjacent to defender.
        // As per current implementation, tiles are directly annexed during battles, so
        // the "invaded" state is implicitly the new ownership.
        
        // Instead, we just count the number of tiles that are now owned by the attacker, but previously owned by the defender.
        // This requires tracking original ownership, which is not currently done.
        // For the current request, I will simplify this to mean "territory difference gained by winner"
        // which is already handled by the direct tile capture in conductWarBattle.
        
        // So, this function will simply return the number of tiles held by attacker that are adjacent to defender.
        // This is primarily for the notification message.
        const territory = this.getNationTerritory(attackerId);
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];

        for (const tile of territory) {
            for (const dir of directions) {
                const nx = tile.x + dir.x;
                const ny = tile.y + dir.y;
                if (nx >= 0 && nx < this.map.mapWidth && ny >= 0 && ny < this.map.mapHeight) {
                    if (this.map.nationMap[ny][nx] === defenderId) {
                        count++;
                        break;
                    }
                }
            }
        }
        return count;
    }
    
    // Pirate ships and related functions removed as per user request
    // spawnPirateShip(), generatePirateName(), managePirateShips(), movePirateRandomly(), movePirateToward()
}

class EconomyManager {
    constructor(map) {
        this.map = map;
        this.globalResources = {
            gold: 0,
            iron: 0,
            coal: 0,
            timber: 0,
            fish: 0,
            crops: 0,
            livestock: 0,
            oil: 0,
            gems: 0,
            spices: 0,
            silver: 0, // Added
            copper: 0, // Added
            silk: 0, // Added
            furs: 0, // Added
            sugar: 0 // Added
        };
        this.globalTradeVolume = 0;
        this.economicCenters = [];
        this.worldGDP = 0;
    }
    
    updateGlobalEconomy() {
        // Reset global metrics
        this.globalTradeVolume = 0;
        this.worldGDP = 0;
        
        // Process all trade routes
        this.processTradeRoutes();
        
        // Update GDP for all nations
        this.updateNationGDPs();
        
        // Update resource availability
        this.updateGlobalResources();
        
        // Identify economic centers
        this.identifyEconomicCenters();
    }
    
    processTradeRoutes() {
        // Use the aiController passed from NationManager
        const aiController = this.aiController || window.aiController;
        
        if (!aiController || !aiController.tradeRoutes) {
            console.log('No aiController or tradeRoutes found');
            return;
        }
        
        // Process each trade route
        // Filter out trade routes where one of the nations no longer exists
        aiController.tradeRoutes = aiController.tradeRoutes.filter(route => {
            const nation1Exists = nations.some(n => n.id === route.nation1Id);
            const nation2Exists = nations.some(n => n.id === route.nation2Id);
            return nation1Exists && nation2Exists;
        });

        console.log(`Processing ${aiController.tradeRoutes.length} trade routes`);

        for (const route of aiController.tradeRoutes) {
            const nation1 = nations.find(n => n.id === route.nation1Id);
            const nation2 = nations.find(n => n.id === route.nation2Id);
            
            if (!nation1 || !nation2) continue;
            
            // Check if nations are at war
            const atWar = (nation1.atWarWith && nation1.atWarWith.includes(nation2.id)) ||
                        (nation2.atWarWith && nation2.atWarWith.includes(nation1.id));
            
            if (atWar) {
                // War disrupts trade - reduce trade value
                route.value = Math.max(0, route.value - 1); // Value can go to 0
            } else {
                // Peaceful trade may grow
                if (Math.random() < 0.1) {
                    route.value = Math.min(10, route.value + 1);
                }
            }
            
            // Apply trade benefits if not at war and value > 0
            if (!atWar && route.value > 0) {
                // GDP boost from trade (further reduced)
                nation1.gdp += Math.floor(route.value * 0.1);
                nation2.gdp += Math.floor(route.value * 0.1);
                
                // Track global trade volume
                this.globalTradeVolume += route.value;
                
                // Check if we need to create new trade-based resources
                if (Math.random() < 0.05 && nation1.economy && nation2.economy) {
                    // 5% chance to discover new resources through trade
                    this.developNewTradeResource(nation1, nation2);
                }
            }
            
            // Update trade route age
            route.age = currentYear - (route.yearEstablished || currentYear - 1);
            
            // Very old trade routes may become more efficient
            if (route.age > 20 && Math.random() < 0.1) {
                route.value = Math.min(15, route.value + 1); // Maximum value of 15 for very established routes
            }
        }
    }
    
    developNewTradeResource(nation1, nation2) {
        const allResources = ['gold', 'iron', 'coal', 'timber', 'fish', 'crops', 'livestock', 'oil', 'gems', 'spices', 'silver', 'copper', 'silk', 'furs', 'sugar'];
        
        // Find resources neither nation has
        const nation1Resources = Object.keys(nation1.economy.resources || {});
        const nation2Resources = Object.keys(nation2.economy.resources || {});
        
        const missingResources = allResources.filter(r => 
            !nation1Resources.includes(r) && !nation2Resources.includes(r));
        
        if (missingResources.length > 0) {
            // Add a new resource to one or both nations
            const newResource = missingResources[Math.floor(Math.random() * missingResources.length)];
            
            // 50% chance for each nation to develop this resource
            if (Math.random() < 0.5) {
                if (!nation1.economy.resources) nation1.economy.resources = {};
                nation1.economy.resources[newResource] = Math.floor(Math.random() * 3) + 1;
            }
            
            if (Math.random() < 0.5) {
                if (!nation2.economy.resources) nation2.economy.resources = {};
                nation2.economy.resources[newResource] = Math.floor(Math.random() * 3) + 1;
            }
        }
    }
    
    updateNationGDPs() {
        this.worldGDP = 0;
        
        for (const nation of nations) {
            if (!nation.gdp) nation.gdp = 500; // Default GDP if not set
            
            // Base growth rate
            let growthRate = 0.002; // 0.2% base growth (much more conservative)
            
            // Stability affects growth more significantly
            if (nation.stability < 50) {
                growthRate -= (50 - nation.stability) / 500; // Increased from /1000 to /500
                
                // Very low stability causes economic collapse
                if (nation.stability < 20) {
                    growthRate -= 0.01; // Additional -1% for very unstable nations
                }
            } else {
                growthRate += (nation.stability - 50) / 1500; // Slightly increased from /2000 to /1500
            }
            
            // War reduces growth more significantly
            if (nation.atWarWith && nation.atWarWith.length > 0) {
                growthRate -= 0.008 * nation.atWarWith.length; // Increased from 0.003 to 0.008
                
                // Multiple wars are devastating
                if (nation.atWarWith.length > 1) {
                    growthRate -= 0.005 * (nation.atWarWith.length - 1);
                }
            }
            
            // Trade boosts growth
            if (nation.economy && nation.economy.tradeRoutes) {
                growthRate += 0.001 * nation.economy.tradeRoutes.length; // Reduced from 0.005 to 0.001
            }

            // Army strength affects GDP (positive or negative based on efficiency)
            growthRate += (nation.armyStrength - 3.5) * 0.0005; // Reduced from 0.002 to 0.0005

            // Apply growth rate with very conservative limits (can be negative)
            const maxGrowthRate = 0.005; // Maximum 0.5% growth per turn
            const minGrowthRate = -0.01; // Maximum 1% decline per turn
            growthRate = Math.max(minGrowthRate, Math.min(maxGrowthRate, growthRate));
            nation.gdp = Math.max(100, Math.floor(nation.gdp * (1 + growthRate)));
            
            // Add to world GDP
            this.worldGDP += nation.gdp;
        }
    }
    
    updateGlobalResources() {
        // Reset global resource counters
        for (const resource in this.globalResources) {
            this.globalResources[resource] = 0;
        }
        
        // Count all resources from all nations
        for (const nation of nations) {
            if (nation.economy && nation.economy.resources) {
                for (const [resource, amount] of Object.entries(nation.economy.resources)) {
                    if (this.globalResources[resource] !== undefined) {
                        this.globalResources[resource] += amount;
                    }
                }
            }
        }
    }
    
    identifyEconomicCenters() {
        this.economicCenters = [];
        
        // Find the top 3 nations by GDP
        const sortedNations = [...window.nations].sort((a, b) => (b.gdp || 0) - (a.gdp || 0));
        const topEconomies = sortedNations.slice(0, 3);
        
        for (const nation of topEconomies) {
            // Find a city to be the economic center (prefer larger cities)
            if (nation.cities && nation.cities.length > 0) {
                const sortedCities = [...nation.cities].sort((a, b) => (b.size || 1) - (a.size || 1));
                const economicCapital = sortedCities[0];
                
                if (economicCapital) {
                    this.economicCenters.push({
                        x: economicCapital.x,
                        y: economicCapital.y,
                        nationId: nation.id,
                        gdp: nation.gdp,
                        name: economicCapital.name
                    });
                }
            }
        }
    }
}
