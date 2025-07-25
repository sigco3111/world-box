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

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // 탭 메뉴 기능 설정
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 모든 탭 버튼에서 active 클래스 제거
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // 모든 탭 콘텐츠에서 active 클래스 제거
            tabContents.forEach(content => content.classList.remove('active'));

            // 클릭한 버튼에 active 클래스 추가
            button.classList.add('active');

            // 해당 탭 콘텐츠 표시
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    const canvas = document.getElementById('map');
    // pixelMap을 전역 변수로 노출
    window.pixelMap = new PixelMap(canvas);
    
    let terrainGenerator, nationManager, provinceGenerator, economyManager;
    
    try {
        terrainGenerator = new TerrainGenerator(window.pixelMap);
        console.log('TerrainGenerator 초기화 완료');
    } catch (error) {
        console.error('TerrainGenerator 초기화 실패:', error);
    }
    
    try {
        nationManager = new NationManager(window.pixelMap);
        console.log('NationManager 초기화 완료');
    } catch (error) {
        console.error('NationManager 초기화 실패:', error);
    }
    
    try {
        provinceGenerator = new ProvinceGenerator(window.pixelMap);
        console.log('ProvinceGenerator 초기화 완료');
    } catch (error) {
        console.error('ProvinceGenerator 초기화 실패:', error);
    }
    
    try {
        economyManager = new EconomyManager(window.pixelMap);
        console.log('EconomyManager 초기화 완료');
    } catch (error) {
        console.error('EconomyManager 초기화 실패:', error);
    }

    // Set the year display
    document.getElementById('year-display').textContent = `연도: ${currentYear}`;
    document.getElementById('world-economy').textContent = `세계 무역: 0`;

    // Create zoom controls
    setupZoomControls(pixelMap);

    // Render initial map
    pixelMap.render();

    // 그리기 모드 비활성화
    let currentInteractionMode = 'zoom'; // 항상 zoom 모드만 사용
    
    const mapPanOverlay = document.querySelector('.map-pan-overlay');
    const zoomControls = document.querySelector('.zoom-controls');

    // World aggression control
    const worldAggressionSelect = document.getElementById('world-aggression');
    worldAggressionSelect.addEventListener('change', () => {
        console.log(`세계 공격성이 ${worldAggressionSelect.value}(으)로 설정되었습니다.`);
    });

    // 도구 버튼 관련 코드 제거 (그리기 모드 비활성화)

    // 그리기 모드 비활성화 - 호버 정보만 처리
    canvas.addEventListener('mousemove', handleHoverInfo);
    canvas.addEventListener('mouseleave', () => {
        hideNationHoverInfo();
    });

    // Nation Info Popups
    const nationHoverInfoDiv = document.getElementById('nation-hover-info');
    const nationDetailedInfoDiv = document.getElementById('nation-detailed-info');
    const closeDetailedInfoBtn = nationDetailedInfoDiv.querySelector('.close-btn');

    closeDetailedInfoBtn.addEventListener('click', () => {
        nationDetailedInfoDiv.style.display = 'none';
    });

    let hoveredNation = null;
    function handleHoverInfo(e) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        const mapCoords = pixelMap.screenToMap(screenX, screenY);
        const x = mapCoords.x;
        const y = mapCoords.y;

        if (x < 0 || x >= pixelMap.mapWidth || y < 0 || y >= pixelMap.mapHeight) {
            hideNationHoverInfo();
            return;
        }

        const nationId = pixelMap.nationMap[y] ? pixelMap.nationMap[y][x] : null;
        const nation = nationId !== null ? nations.find(n => n.id === nationId) : null;

        if (nation && nation !== hoveredNation) {
            showNationHoverInfo(nation, e.clientX, e.clientY);
            hoveredNation = nation;
        } else if (!nation && hoveredNation) {
            hideNationHoverInfo();
            hoveredNation = null;
        }
    }

    function showNationHoverInfo(nation, clientX, clientY) {
        nationHoverInfoDiv.innerHTML = `<strong>${nation.name}</strong><br>인구: ${formatNumber(nation.population)}<br>안정도: ${nation.stability}%`;

        // Position the popup relative to the mouse
        nationHoverInfoDiv.style.left = `${clientX + 15}px`;
        nationHoverInfoDiv.style.top = `${clientY + 15}px`;
        nationHoverInfoDiv.style.display = 'block';
    }

    function hideNationHoverInfo() {
        nationHoverInfoDiv.style.display = 'none';
    }

    // Handle click for detailed info
    canvas.addEventListener('click', (e) => {
        if (currentInteractionMode === 'zoom') {
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const mapCoords = pixelMap.screenToMap(screenX, screenY);
            const x = mapCoords.x;
            const y = mapCoords.y;

            if (x < 0 || x >= pixelMap.mapWidth || y < 0 || y >= pixelMap.mapHeight) return;

            const nationId = pixelMap.nationMap[y] ? pixelMap.nationMap[y][x] : null;
            const nation = nationId !== null ? nations.find(n => n.id === nationId) : null;

            if (nation) {
                showNationDetailedInfo(nation);
            } else {
                nationDetailedInfoDiv.style.display = 'none';
            }
        }
    });

    function showNationDetailedInfo(nation) {
        document.getElementById('info-nation-name').textContent = nation.name;
        document.getElementById('info-nation-gov').textContent = nation.government;
        document.getElementById('info-nation-founded').textContent = nation.founded;
        document.getElementById('info-nation-pop').textContent = formatNumber(nation.population);
        document.getElementById('info-nation-gdp').textContent = formatNumber(nation.gdp);
        document.getElementById('info-nation-army').textContent = nation.armyStrength;
        document.getElementById('info-nation-stability').textContent = `${nation.stability}%`;
        document.getElementById('info-nation-traits').textContent = nation.culturalTraits.join(', ');
        document.getElementById('info-nation-cities').textContent = nation.cities ? nation.cities.length : 0;

        // Add vassal status
        const vassalStatus = nation.overlord ? `${nations.find(n => n.id === nation.overlord)?.name || '알 수 없음'}의 속국` : '독립국';

        // Add alliances
        const alliesText = nation.allies && nation.allies.length > 0
            ? nation.allies.map(allyId => nations.find(n => n.id === allyId)?.name || '알 수 없음').join(', ')
            : '없음';

        // Add wars
        const warsText = nation.atWarWith && nation.atWarWith.length > 0
            ? nation.atWarWith.map(enemyId => nations.find(n => n.id === enemyId)?.name || '알 수 없음').join(', ')
            : '없음';

        // Add rebellion status
        const rebellionStatus = nation.isRebel ? '반란 국가' : '합법 국가';

        // Add vassals
        const vassalsText = nation.vassals && nation.vassals.length > 0
            ? nation.vassals.map(vassalId => nations.find(n => n.id === vassalId)?.name || '알 수 없음').join(', ')
            : '없음';

        // Create additional info section
        const additionalInfo = document.createElement('div');
        additionalInfo.innerHTML = `
            <p><strong>상태:</strong> ${vassalStatus}</p>
            <p><strong>반란 상태:</strong> ${rebellionStatus}</p>
            <p><strong>동맹:</strong> ${alliesText}</p>
            <p><strong>현재 전쟁:</strong> ${warsText}</p>
            <p><strong>속국:</strong> ${vassalsText}</p>
        `;

        // Add editable fields
        const editSection = document.createElement('div');
        editSection.innerHTML = `
            <h4>국가 편집</h4>
            <div>
                <label>군사력 (1-6):</label>
                <input type="number" id="edit-army-${nation.id}" min="1" max="6" value="${nation.armyStrength}">
            </div>
            <div>
                <label>인구:</label>
                <input type="number" id="edit-pop-${nation.id}" value="${nation.population}">
            </div>
            <div>
                <label>GDP:</label>
                <input type="number" id="edit-gdp-${nation.id}" value="${nation.gdp}">
            </div>
            <div>
                <label>안정도 (0-100):</label>
                <input type="number" id="edit-stab-${nation.id}" min="0" max="100" value="${nation.stability}">
            </div>
            <button onclick="updateNation(${nation.id})">변경 적용</button>
        `;

        // Clear and rebuild content
        const infoDiv = document.getElementById('nation-detailed-info');
        infoDiv.appendChild(additionalInfo);
        infoDiv.appendChild(editSection);
        infoDiv.style.display = 'block';
    }

    // 도시 추가 버튼 제거

    // 국가 선택 처리
    document.getElementById('nations-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('nation-select')) {
            e.preventDefault();
            e.stopPropagation();
            
            const nationItem = e.target.closest('.nation-item');
            if (nationItem) {
                const nationNameElement = nationItem.querySelector('.nation-name');
                if (nationNameElement) {
                    const nationName = nationNameElement.firstChild ? nationNameElement.firstChild.textContent : nationNameElement.textContent;
                    selectedNation = nations.find(n => n.name === nationName);
                    
                    // 맵 중앙 정렬 기능 제거됨
                    
                    if (typeof updateSelectedNation === 'function') {
                        updateSelectedNation();
                    }
                }
            }
        }
    });

    // 지방 생성 버튼 제거

    // Clear map button
    document.getElementById('clear-map').addEventListener('click', () => {
        pixelMap.clearMap();
    });

    // Generate random map button
    document.getElementById('generate-map').addEventListener('click', () => {
        try {
            console.log('랜덤 지도 생성 시작');
            terrainGenerator.generateRandomMap();
            console.log('랜덤 지도 생성 완료');
        } catch (error) {
            console.error('랜덤 지도 생성 중 오류 발생:', error);
        }
    });

    // 제거된 버튼들의 이벤트 리스너

    // Map size control
    document.getElementById('apply-settings').addEventListener('click', () => {
        const mapSizeSelect = document.getElementById('map-size');
        const size = mapSizeSelect.value;

        let width, height;
        if (size === 'small') {
            width = 800;
            height = 600;
        } else if (size === 'large') {
            width = 1600;
            height = 1000;
        } else {
            // medium
            width = 1200;
            height = 800;
        }

        canvas.width = width;
        canvas.height = height;
        pixelMap.width = width;
        pixelMap.height = height;
        pixelMap.mapWidth = Math.floor(width / pixelMap.pixelSize);
        pixelMap.mapHeight = Math.floor(height / pixelMap.pixelSize);
        pixelMap.initializeMaps();
        pixelMap.render();
    });

    // Set up the rebellion frequency control
    const rebellionFrequency = document.getElementById('rebellion-frequency');
    rebellionFrequency.addEventListener('change', () => {
        console.log(`반란 빈도가 ${rebellionFrequency.value}(으)로 설정되었습니다.`);
    });

    // Export/Import functionality
    document.getElementById('export-map').addEventListener('click', () => {
        const mapData = {
            terrain: pixelMap.terrainMap,
            nations: pixelMap.nationMap,
            cities: pixelMap.cityMap,
            provinces: pixelMap.provinceMap,
            provinceNames: pixelMap.provinceNames,
            nationsList: nations
        };

        const dataStr = JSON.stringify(mapData);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportLink = document.createElement('a');
        exportLink.setAttribute('href', dataUri);
        exportLink.setAttribute('download', 'world-box-map.json');
        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);
    });

    document.getElementById('import-map').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = event => {
                try {
                    const mapData = JSON.parse(event.target.result);
                    pixelMap.terrainMap = mapData.terrain;
                    pixelMap.nationMap = mapData.nations;
                    pixelMap.cityMap = mapData.cities;
                    pixelMap.provinceMap = mapData.provinces;
                    pixelMap.provinceNames = mapData.provinceNames;
                    nations = mapData.nationsList;
                    nextNationId = Math.max(...nations.map(n => n.id)) + 1;

                    nationManager.renderNationsList();
                    pixelMap.render();
                } catch (error) {
                    alert('지도 가져오기 오류: ' + error.message);
                }
            };

            reader.readAsText(file);
        };

        input.click();
    });

    // Function to setup zoom controls
    function setupZoomControls(pixelMap) {
        // Create container for zoom controls
        const mapContainer = document.querySelector('.map-container');

        // Add pan overlay
        const panOverlay = document.createElement('div');
        panOverlay.className = 'map-pan-overlay';
        mapContainer.appendChild(panOverlay);

        // Add zoom controls
        const zoomControls = document.createElement('div');
        zoomControls.className = 'zoom-controls';

        const zoomInBtn = document.createElement('div');
        zoomInBtn.className = 'zoom-btn';
        zoomInBtn.innerHTML = '＋';
        zoomInBtn.addEventListener('click', () => {
            const newZoom = pixelMap.zoomIn();
            updateZoomLevel(newZoom);
        });

        const zoomOutBtn = document.createElement('div');
        zoomOutBtn.className = 'zoom-btn';
        zoomOutBtn.innerHTML = '－';
        zoomOutBtn.addEventListener('click', () => {
            const newZoom = pixelMap.zoomOut();
            updateZoomLevel(newZoom);
        });

        const resetZoomBtn = document.createElement('div');
        resetZoomBtn.className = 'zoom-btn';
        resetZoomBtn.innerHTML = '⌂';
        resetZoomBtn.addEventListener('click', () => {
            const newZoom = pixelMap.resetZoom();
            updateZoomLevel(newZoom);
        });

        const zoomLevelDisplay = document.createElement('div');
        zoomLevelDisplay.className = 'zoom-level';
        zoomLevelDisplay.innerHTML = '100%';

        zoomControls.appendChild(zoomInBtn);
        zoomControls.appendChild(zoomLevelDisplay);
        zoomControls.appendChild(zoomOutBtn);
        zoomControls.appendChild(resetZoomBtn);

        mapContainer.appendChild(zoomControls);

        // Setup pan functionality with improved performance
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;
        let panThrottle = 0;

        panOverlay.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                isPanning = true;
                lastX = e.clientX;
                lastY = e.clientY;
                panOverlay.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const now = Date.now();
                if (now - panThrottle > 16) { // ~60fps
                    const deltaX = e.clientX - lastX;
                    const deltaY = e.clientY - lastY;
                    pixelMap.pan(deltaX, deltaY);
                    lastX = e.clientX;
                    lastY = e.clientY;
                    panThrottle = now;
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                panOverlay.style.cursor = 'grab';
            }
        });

        // Add mousewheel zoom with improved performance
        let wheelThrottle = 0;
        mapContainer.addEventListener('wheel', (e) => {
            e.preventDefault();

            const now = Date.now();
            if (now - wheelThrottle < 50) return; // Throttle wheel events
            wheelThrottle = now;

            if (currentInteractionMode === 'zoom') {
                if (e.deltaY < 0) {
                    const newZoom = pixelMap.zoomIn();
                    updateZoomLevel(newZoom);
                } else {
                    const newZoom = pixelMap.zoomOut();
                    updateZoomLevel(newZoom);
                }
            }
        });

        // Function to update zoom level display
        function updateZoomLevel(zoom) {
            const percentage = Math.round(zoom * 100);
            zoomLevelDisplay.innerHTML = `${percentage}%`;
        }

        // Create container for people (no longer used, rendered directly to canvas)
        const peopleContainer = document.createElement('div');
        peopleContainer.className = 'people-container';
        mapContainer.appendChild(peopleContainer);

        // Create container for expansion effects (no longer used for drawing)
        const expansionContainer = document.createElement('div');
        expansionContainer.className = 'expansion-container';
        mapContainer.appendChild(expansionContainer);
    }

    // 게임 상태 자동 복원 시도
    let gameStateRestored = false;
    
    try {
        if (window.gameStateManager) {
            console.log('게임 상태 자동 복원 시도...');
            gameStateRestored = await window.gameStateManager.autoRestoreOnPageLoad();
            
            if (gameStateRestored) {
                console.log('게임 상태가 성공적으로 복원되었습니다.');
            } else {
                console.log('복원할 게임 상태가 없거나 복원에 실패했습니다.');
            }
        }
    } catch (error) {
        console.error('게임 상태 자동 복원 중 오류:', error);
        gameStateRestored = false;
    }
    
    // 게임 상태가 복원되지 않은 경우에만 초기 맵 생성
    if (!gameStateRestored) {
        try {
            if (terrainGenerator) {
                console.log('초기 랜덤 지도 생성 시작');
                terrainGenerator.generateRandomMap();
                console.log('초기 랜덤 지도 생성 완료');
            } else {
                console.error('TerrainGenerator가 초기화되지 않았습니다.');
            }
        } catch (error) {
            console.error('초기 지도 생성 중 오류 발생:', error);
        }

        // 도시 이름을 한글로 변환
        try {
            pixelMap.koreanizeCityNames();
        } catch (error) {
            console.error('도시 이름 한글 변환 중 오류 발생:', error);
        }
    } else {
        // 복원된 경우 UI만 업데이트
        try {
            if (window.gameStateManager) {
                window.gameStateManager.updateUI();
            }
        } catch (error) {
            console.error('복원 후 UI 업데이트 중 오류:', error);
        }
    }
});

// 국가 정보 업데이트 함수
function updateNation(nationId) {
    const nation = nations.find(n => n.id === nationId);
    if (!nation) {
        console.error('국가를 찾을 수 없습니다:', nationId);
        return;
    }
    
    try {
        // 입력 값 가져오기
        const armyInput = document.getElementById(`edit-army-${nationId}`);
        const popInput = document.getElementById(`edit-pop-${nationId}`);
        const gdpInput = document.getElementById(`edit-gdp-${nationId}`);
        const stabInput = document.getElementById(`edit-stab-${nationId}`);
        
        // 값 업데이트
        if (armyInput) {
            const newArmy = parseInt(armyInput.value);
            if (newArmy >= 1 && newArmy <= 6) {
                nation.armyStrength = newArmy;
            }
        }
        
        if (popInput) {
            const newPop = parseInt(popInput.value);
            if (newPop > 0) {
                nation.population = newPop;
            }
        }
        
        if (gdpInput) {
            const newGdp = parseInt(gdpInput.value);
            if (newGdp > 0) {
                nation.gdp = newGdp;
            }
        }
        
        if (stabInput) {
            const newStab = parseInt(stabInput.value);
            if (newStab >= 0 && newStab <= 100) {
                nation.stability = newStab;
            }
        }
        
        // UI 업데이트
        if (window.nationManager) {
            window.nationManager.renderNationsList();
        }
        
        // 자동저장 트리거
        if (window.autoSaveSystem) {
            window.autoSaveSystem.onGameEvent('nation_modified', { 
                nationId: nationId, 
                nationName: nation.name 
            });
        }
        
        console.log(`국가 ${nation.name} 정보가 업데이트되었습니다.`);
        
    } catch (error) {
        console.error('국가 정보 업데이트 중 오류 발생:', error);
    }
}