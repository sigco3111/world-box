/**
 * AutoSaveSystem - 자동저장 시스템
 * 게임 상태 변경을 감지하고 자동으로 저장하는 시스템
 */
class AutoSaveSystem {
    constructor(gameStateManager) {
        this.gameStateManager = gameStateManager;
        this.saveQueue = [];
        this.isProcessing = false;
        this.debounceTimer = null;
        this.debounceDelay = 2000; // 2초 디바운스
        this.periodicSaveInterval = 30000; // 30초마다 주기적 저장
        this.periodicSaveTimer = null;
        this.lastSaveTime = 0;
        this.minSaveInterval = 5000; // 최소 저장 간격 5초
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 주기적 자동저장 시작
        this.startPeriodicSave();
        
        console.log('AutoSaveSystem 초기화 완료');
    }
    
    /**
     * 자동저장 트리거
     * @param {string} reason - 저장 이유
     * @param {boolean} immediate - 즉시 저장 여부
     */
    triggerAutoSave(reason = 'auto', immediate = false) {
        const now = Date.now();
        
        // 최소 저장 간격 체크
        if (now - this.lastSaveTime < this.minSaveInterval && !immediate) {
            console.log(`자동저장 스킵: 최소 간격 미달 (${reason})`);
            return;
        }
        
        console.log(`자동저장 트리거: ${reason}`);
        
        if (immediate) {
            this.performSave(reason);
        } else {
            this.debouncedSave(reason);
        }
    }
    
    /**
     * 디바운스된 저장
     * @param {string} reason - 저장 이유
     */
    debouncedSave(reason = 'auto') {
        // 기존 타이머 취소
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // 새 타이머 설정
        this.debounceTimer = setTimeout(() => {
            this.performSave(reason);
        }, this.debounceDelay);
    }
    
    /**
     * 실제 저장 수행
     * @param {string} reason - 저장 이유
     */
    performSave(reason = 'auto') {
        if (this.isProcessing) {
            console.log('이미 저장 중입니다.');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // 저장 시작 알림
            this.gameStateManager.showInfoNotification('저장 중', '게임 상태를 저장하고 있습니다...');
            
            // 게임 상태 저장
            const success = this.gameStateManager.saveGameState(false); // 알림 비활성화
            
            if (success) {
                this.lastSaveTime = Date.now();
                console.log(`자동저장 완료: ${reason} (${new Date().toLocaleString()})`);
                
                // 저장 완료 알림 (짧게 표시)
                this.gameStateManager.showSuccessNotification('자동저장 완료', '게임 상태가 저장되었습니다.');
            } else {
                console.error(`자동저장 실패: ${reason}`);
                this.gameStateManager.showErrorNotification('자동저장 실패', '게임 상태 저장에 실패했습니다.');
            }
            
        } catch (error) {
            console.error('자동저장 중 오류 발생:', error);
            this.gameStateManager.showErrorNotification('자동저장 오류', '저장 중 오류가 발생했습니다.');
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * 게임 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 국가 관련 이벤트
        this.setupNationEvents();
        
        // 맵 관련 이벤트
        this.setupMapEvents();
        
        // 게임 설정 이벤트
        this.setupGameSettingsEvents();
        
        // 시뮬레이션 이벤트
        this.setupSimulationEvents();
        
        // 페이지 언로드 이벤트 (브라우저 종료 시 저장)
        this.setupPageUnloadEvents();
    }
    
    /**
     * 국가 관련 이벤트 설정
     */
    setupNationEvents() {
        // 국가 추가 버튼
        const addNationBtn = document.getElementById('add-nation');
        if (addNationBtn) {
            addNationBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.triggerAutoSave('nation_added');
                }, 100); // DOM 업데이트 후 저장
            });
        }
        
        // 국가 목록 변경 감지 (MutationObserver 사용)
        const nationsList = document.getElementById('nations-list');
        if (nationsList) {
            const observer = new MutationObserver((mutations) => {
                let shouldSave = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                            shouldSave = true;
                        }
                    }
                });
                
                if (shouldSave) {
                    this.triggerAutoSave('nations_list_changed');
                }
            });
            
            observer.observe(nationsList, {
                childList: true,
                subtree: true
            });
        }
        
        // 전역 nations 배열 변경 감지 (Proxy 사용)
        if (window.nations && Array.isArray(window.nations)) {
            this.setupNationsArrayProxy();
        }
    }
    
    /**
     * nations 배열에 Proxy 설정하여 변경 감지
     */
    setupNationsArrayProxy() {
        const originalNations = window.nations;
        
        window.nations = new Proxy(originalNations, {
            set: (target, property, value) => {
                const result = Reflect.set(target, property, value);
                
                // 배열 길이 변경이나 요소 변경 시 자동저장
                if (property === 'length' || !isNaN(property)) {
                    this.triggerAutoSave('nations_array_changed');
                }
                
                return result;
            }
        });
        
        // 배열 메서드 오버라이드
        const methodsToWatch = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
        
        methodsToWatch.forEach(method => {
            const originalMethod = window.nations[method];
            if (typeof originalMethod === 'function') {
                window.nations[method] = function(...args) {
                    const result = originalMethod.apply(this, args);
                    window.autoSaveSystem?.triggerAutoSave(`nations_${method}`);
                    return result;
                };
            }
        });
    }
    
    /**
     * 맵 관련 이벤트 설정
     */
    setupMapEvents() {
        // 맵 클리어 버튼
        const clearMapBtn = document.getElementById('clear-map');
        if (clearMapBtn) {
            clearMapBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.triggerAutoSave('map_cleared');
                }, 100);
            });
        }
        
        // 랜덤 맵 생성 버튼
        const generateMapBtn = document.getElementById('generate-map');
        if (generateMapBtn) {
            generateMapBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.triggerAutoSave('map_generated');
                }, 1000); // 맵 생성 완료 후 저장
            });
        }
        
        // 맵 가져오기
        const importMapBtn = document.getElementById('import-map');
        if (importMapBtn) {
            importMapBtn.addEventListener('click', () => {
                // 파일 선택 후 저장은 파일 로드 완료 시점에서 처리
                setTimeout(() => {
                    this.triggerAutoSave('map_imported');
                }, 2000);
            });
        }
        
        // 맵 설정 적용
        const applySettingsBtn = document.getElementById('apply-settings');
        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.triggerAutoSave('map_settings_applied');
                }, 500);
            });
        }
    }
    
    /**
     * 게임 설정 이벤트 설정
     */
    setupGameSettingsEvents() {
        // 세계 공격성 설정
        const worldAggressionSelect = document.getElementById('world-aggression');
        if (worldAggressionSelect) {
            worldAggressionSelect.addEventListener('change', () => {
                this.triggerAutoSave('world_aggression_changed');
            });
        }
        
        // 반란 빈도 설정
        const rebellionFrequencySelect = document.getElementById('rebellion-frequency');
        if (rebellionFrequencySelect) {
            rebellionFrequencySelect.addEventListener('change', () => {
                this.triggerAutoSave('rebellion_frequency_changed');
            });
        }
        
        // 시뮬레이션 속도 설정
        const simSpeedSelect = document.getElementById('sim-speed');
        if (simSpeedSelect) {
            simSpeedSelect.addEventListener('change', () => {
                this.triggerAutoSave('sim_speed_changed');
            });
        }
    }
    
    /**
     * 시뮬레이션 이벤트 설정
     */
    setupSimulationEvents() {
        // 시뮬레이션 시작 버튼
        const startSimBtn = document.getElementById('start-simulation');
        if (startSimBtn) {
            startSimBtn.addEventListener('click', () => {
                this.triggerAutoSave('simulation_started');
                // 시뮬레이션 중 주기적 저장 활성화
                this.startSimulationAutoSave();
            });
        }
        
        // 시뮬레이션 중지 버튼
        const stopSimBtn = document.getElementById('stop-simulation');
        if (stopSimBtn) {
            stopSimBtn.addEventListener('click', () => {
                this.triggerAutoSave('simulation_stopped');
                // 시뮬레이션 중 주기적 저장 비활성화
                this.stopSimulationAutoSave();
            });
        }
    }
    
    /**
     * 페이지 언로드 이벤트 설정
     */
    setupPageUnloadEvents() {
        // 페이지 언로드 전 저장
        window.addEventListener('beforeunload', (e) => {
            // 동기적으로 즉시 저장
            this.performSave('page_unload');
        });
        
        // 페이지 숨김 시 저장 (모바일 대응)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.triggerAutoSave('page_hidden', true);
            }
        });
        
        // 포커스 잃을 때 저장
        window.addEventListener('blur', () => {
            this.triggerAutoSave('window_blur');
        });
    }
    
    /**
     * 주기적 자동저장 시작
     */
    startPeriodicSave() {
        if (this.periodicSaveTimer) {
            clearInterval(this.periodicSaveTimer);
        }
        
        this.periodicSaveTimer = setInterval(() => {
            // 시뮬레이션 실행 중이거나 게임 상태가 변경된 경우에만 저장
            if (window.simulationRunning || this.hasGameStateChanged()) {
                this.triggerAutoSave('periodic_save');
            }
        }, this.periodicSaveInterval);
        
        console.log('주기적 자동저장 시작 (30초 간격)');
    }
    
    /**
     * 주기적 자동저장 중지
     */
    stopPeriodicSave() {
        if (this.periodicSaveTimer) {
            clearInterval(this.periodicSaveTimer);
            this.periodicSaveTimer = null;
        }
        
        console.log('주기적 자동저장 중지');
    }
    
    /**
     * 시뮬레이션 중 자동저장 시작 (더 빈번한 저장)
     */
    startSimulationAutoSave() {
        // 시뮬레이션 중에는 더 자주 저장 (15초 간격)
        if (this.periodicSaveTimer) {
            clearInterval(this.periodicSaveTimer);
        }
        
        this.periodicSaveTimer = setInterval(() => {
            if (window.simulationRunning) {
                this.triggerAutoSave('simulation_periodic_save');
            }
        }, 15000); // 15초 간격
        
        console.log('시뮬레이션 중 자동저장 시작 (15초 간격)');
    }
    
    /**
     * 시뮬레이션 중 자동저장 중지
     */
    stopSimulationAutoSave() {
        // 일반 주기적 저장으로 복원
        this.startPeriodicSave();
        console.log('시뮬레이션 중 자동저장 중지, 일반 주기적 저장으로 복원');
    }
    
    /**
     * 게임 상태 변경 여부 확인
     * @returns {boolean} 변경 여부
     */
    hasGameStateChanged() {
        try {
            // 현재 게임 상태 수집
            const currentState = this.gameStateManager.collectCurrentGameState();
            
            // 마지막 저장된 상태와 비교
            const savedData = localStorage.getItem(this.gameStateManager.storageKey);
            if (!savedData) {
                return true; // 저장된 데이터가 없으면 변경된 것으로 간주
            }
            
            const savedState = JSON.parse(savedData);
            
            // 간단한 비교 (JSON 문자열 비교)
            const currentStateStr = JSON.stringify(currentState.gameData);
            const savedStateStr = JSON.stringify(savedState.gameData);
            
            return currentStateStr !== savedStateStr;
            
        } catch (error) {
            console.error('게임 상태 변경 확인 중 오류:', error);
            return true; // 오류 시 변경된 것으로 간주
        }
    }
    
    /**
     * 특정 이벤트에 대한 자동저장 트리거 (외부에서 호출 가능)
     * @param {string} eventType - 이벤트 타입
     * @param {Object} eventData - 이벤트 데이터
     */
    onGameEvent(eventType, eventData = {}) {
        const eventSaveMap = {
            'nation_created': 'nation_created',
            'nation_deleted': 'nation_deleted',
            'nation_modified': 'nation_modified',
            'unit_added': 'unit_added',
            'war_started': 'war_started',
            'war_ended': 'war_ended',
            'alliance_formed': 'alliance_formed',
            'alliance_broken': 'alliance_broken',
            'territory_changed': 'territory_changed',
            'city_added': 'city_added',
            'city_removed': 'city_removed',
            'trade_route_created': 'trade_route_created',
            'trade_route_destroyed': 'trade_route_destroyed',
            'year_advanced': 'year_advanced'
        };
        
        const saveReason = eventSaveMap[eventType];
        if (saveReason) {
            // 일부 이벤트는 즉시 저장
            const immediateEvents = ['nation_created', 'nation_deleted', 'war_started', 'war_ended'];
            const immediate = immediateEvents.includes(eventType);
            
            this.triggerAutoSave(saveReason, immediate);
        }
    }
    
    /**
     * 자동저장 시스템 정리
     */
    destroy() {
        // 타이머 정리
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        if (this.periodicSaveTimer) {
            clearInterval(this.periodicSaveTimer);
        }
        
        // 마지막 저장
        this.performSave('system_destroy');
        
        console.log('AutoSaveSystem 정리 완료');
    }
    
    /**
     * 자동저장 설정 변경
     * @param {Object} settings - 설정 객체
     */
    updateSettings(settings = {}) {
        if (settings.debounceDelay !== undefined) {
            this.debounceDelay = Math.max(1000, settings.debounceDelay);
        }
        
        if (settings.periodicSaveInterval !== undefined) {
            this.periodicSaveInterval = Math.max(10000, settings.periodicSaveInterval);
            this.startPeriodicSave(); // 새 간격으로 재시작
        }
        
        if (settings.minSaveInterval !== undefined) {
            this.minSaveInterval = Math.max(1000, settings.minSaveInterval);
        }
        
        console.log('AutoSaveSystem 설정 업데이트:', settings);
    }
    
    /**
     * 자동저장 통계 정보
     * @returns {Object} 통계 정보
     */
    getStats() {
        return {
            lastSaveTime: this.lastSaveTime,
            isProcessing: this.isProcessing,
            debounceDelay: this.debounceDelay,
            periodicSaveInterval: this.periodicSaveInterval,
            minSaveInterval: this.minSaveInterval,
            hasPeriodicTimer: !!this.periodicSaveTimer,
            hasDebounceTimer: !!this.debounceTimer
        };
    }
}

// 전역 AutoSaveSystem 인스턴스 생성 (GameStateManager 초기화 후)
document.addEventListener('DOMContentLoaded', () => {
    // GameStateManager가 초기화된 후 AutoSaveSystem 생성
    if (window.gameStateManager) {
        window.autoSaveSystem = new AutoSaveSystem(window.gameStateManager);
        console.log('전역 AutoSaveSystem 인스턴스 생성 완료');
    } else {
        console.error('GameStateManager가 초기화되지 않았습니다.');
    }
});