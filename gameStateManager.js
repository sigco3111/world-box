/**
 * GameStateManager - 게임 상태 관리 시스템
 * 게임 상태의 자동저장, 불러오기, 초기화를 담당하는 메인 클래스
 */
class GameStateManager {
    constructor() {
        this.storageKey = 'worldbox-lite-game-state';
        this.backupKey = 'worldbox-lite-backup';
        this.maxBackups = 5;
        this.currentVersion = '1.0.0';
        this.isLoading = false;
        this.isSaving = false;
        
        // 게임 상태 데이터 스키마 정의
        this.gameStateSchema = {
            version: this.currentVersion,
            timestamp: null,
            gameData: {
                // 국가 데이터
                nations: [],
                nextNationId: 1,
                selectedNation: null,
                
                // 맵 데이터
                mapData: {
                    terrainMap: [],
                    nationMap: [],
                    cityMap: [],
                    provinceMap: [],
                    provinceNames: []
                },
                
                // 게임 설정
                gameSettings: {
                    currentYear: 0,
                    simulationRunning: false,
                    worldAggression: 'balanced',
                    rebellionFrequency: 'medium',
                    simSpeed: 'medium'
                },
                
                // 맵 뷰 설정
                viewSettings: {
                    zoomLevel: 1,
                    panX: 0,
                    panY: 0,
                    mapWidth: 1200,
                    mapHeight: 800
                }
            }
        };
    }
    
    /**
     * 게임 상태 저장
     * @param {boolean} showNotification - 저장 완료 알림 표시 여부
     * @returns {boolean} 저장 성공 여부
     */
    saveGameState(showNotification = true) {
        if (this.isSaving) {
            console.warn('이미 저장 중입니다.');
            return false;
        }
        
        this.isSaving = true;
        let progressNotificationId = null;
        
        try {
            // 진행 상태 알림 표시
            if (showNotification) {
                progressNotificationId = this.showProgressNotification('저장 중', '게임 상태를 저장하고 있습니다...');
            }
            
            // 현재 게임 상태 수집
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '저장 중', '게임 데이터를 수집하고 있습니다...');
            }
            const gameState = this.collectCurrentGameState();
            
            // 데이터 검증
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '저장 중', '데이터 무결성을 검증하고 있습니다...');
            }
            if (!this.validateGameData(gameState)) {
                throw new Error('게임 데이터 검증 실패');
            }
            
            // 백업 생성 (저장 전)
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '저장 중', '백업을 생성하고 있습니다...');
            }
            this.createBackup('before_save');
            
            // localStorage에 저장
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '저장 중', '데이터를 저장하고 있습니다...');
            }
            const serializedData = JSON.stringify(gameState);
            localStorage.setItem(this.storageKey, serializedData);
            
            // 진행 상태 알림 제거
            if (progressNotificationId) {
                this.removeNotification(progressNotificationId);
            }
            
            // 저장 성공 로그
            console.log(`게임 상태 저장 완료 (${new Date().toLocaleString()})`);
            
            if (showNotification) {
                this.showSuccessNotification('저장 완료', '게임 상태가 성공적으로 저장되었습니다.');
            }
            
            return true;
            
        } catch (error) {
            // 진행 상태 알림 제거
            if (progressNotificationId) {
                this.removeNotification(progressNotificationId);
            }
            
            console.error('게임 저장 실패:', error);
            
            // 저장 공간 부족 처리
            if (error.name === 'QuotaExceededError') {
                console.warn('저장 공간 부족, 정리 후 재시도...');
                this.handleStorageQuotaExceeded();
                
                // 백업도 정리
                try {
                    localStorage.removeItem(this.backupKey);
                    console.log('백업 데이터 정리 완료');
                } catch (cleanupError) {
                    console.error('백업 정리 실패:', cleanupError);
                }
                
                // 재시도
                try {
                    const gameState = this.collectCurrentGameState();
                    const serializedData = JSON.stringify(gameState);
                    localStorage.setItem(this.storageKey, serializedData);
                    
                    if (showNotification) {
                        this.showSuccessNotification('저장 완료', '저장 공간을 정리한 후 저장되었습니다.');
                    }
                    return true;
                } catch (retryError) {
                    console.error('저장 재시도 실패:', retryError);
                    this.showErrorNotification('저장 실패', '저장 공간이 부족합니다.');
                    return false;
                }
            } else {
                this.showErrorNotification('저장 실패', '게임 상태를 저장할 수 없습니다.');
                return false;
            }
        } finally {
            this.isSaving = false;
        }
    }
    
    /**
     * 게임 상태 불러오기
     * @param {boolean} showNotifications - 알림 표시 여부
     * @returns {boolean} 불러오기 성공 여부
     */
    loadGameState(showNotifications = true) {
        if (this.isLoading) {
            console.warn('이미 불러오는 중입니다.');
            return false;
        }
        
        this.isLoading = true;
        
        let progressNotificationId = null;
        if (showNotifications) {
            progressNotificationId = this.showProgressNotification('불러오는 중', '저장된 게임 상태를 불러오고 있습니다...');
        }
        
        try {
            // localStorage에서 데이터 가져오기
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '불러오는 중', '저장된 데이터를 읽고 있습니다...');
            }
            const savedData = localStorage.getItem(this.storageKey);
            
            if (!savedData) {
                console.log('저장된 게임 상태가 없습니다.');
                if (progressNotificationId) {
                    this.removeNotification(progressNotificationId);
                }
                this.isLoading = false;
                return false;
            }
            
            // 데이터 파싱 시도
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '불러오는 중', '데이터를 파싱하고 있습니다...');
            }
            let gameState;
            try {
                gameState = JSON.parse(savedData);
            } catch (parseError) {
                console.error('저장된 데이터 파싱 실패:', parseError);
                if (progressNotificationId) {
                    this.removeNotification(progressNotificationId);
                }
                this.handleCorruptedData('JSON 파싱 실패', showNotifications);
                return false;
            }
            
            // 버전 호환성 확인 및 마이그레이션 (검증 전에 수행)
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '불러오는 중', '버전 호환성을 확인하고 있습니다...');
            }
            const migrationResult = this.checkVersionCompatibilityAndMigrate(gameState);
            if (!migrationResult.success) {
                console.error('데이터 마이그레이션 실패:', migrationResult.error);
                if (progressNotificationId) {
                    this.removeNotification(progressNotificationId);
                }
                this.handleCorruptedData(`버전 호환성 문제: ${migrationResult.error}`, showNotifications);
                return false;
            }
            
            gameState = migrationResult.data;
            
            // 마이그레이션 후 데이터 무결성 검증
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '불러오는 중', '데이터 무결성을 검증하고 있습니다...');
            }
            const validationResult = this.validateGameDataWithDetails(gameState);
            if (!validationResult.isValid) {
                console.warn('마이그레이션 후 데이터 검증 실패:', validationResult.errors);
                if (progressNotificationId) {
                    this.removeNotification(progressNotificationId);
                }
                this.handleCorruptedData(`데이터 검증 실패: ${validationResult.errors.join(', ')}`, showNotifications);
                return false;
            }
            
            // 백업 생성 (복원 전)
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '불러오는 중', '백업을 생성하고 있습니다...');
            }
            this.createBackup('before_restore');
            
            // 게임 상태 복원 시도
            if (progressNotificationId) {
                this.updateProgressNotification(progressNotificationId, '불러오는 중', '게임 상태를 복원하고 있습니다...');
            }
            const restoreResult = this.restoreGameStateWithValidation(gameState);
            if (!restoreResult.success) {
                console.error('게임 상태 복원 실패:', restoreResult.error);
                if (progressNotificationId) {
                    this.removeNotification(progressNotificationId);
                }
                this.handleRestoreFailure(restoreResult.error, showNotifications);
                return false;
            }
            
            // 진행 상태 알림 제거
            if (progressNotificationId) {
                this.removeNotification(progressNotificationId);
            }
            
            console.log(`게임 상태 복원 완료 (저장 시간: ${new Date(gameState.timestamp).toLocaleString()})`);
            
            if (showNotifications) {
                this.showSuccessNotification('복원 완료', '이전 게임 상태가 성공적으로 복원되었습니다.');
            }
            
            return true;
            
        } catch (error) {
            // 진행 상태 알림 제거
            if (progressNotificationId) {
                this.removeNotification(progressNotificationId);
            }
            console.error('게임 불러오기 중 예상치 못한 오류:', error);
            this.handleUnexpectedError(error, showNotifications);
            return false;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 페이지 로드 시 자동 상태 복원
     * @returns {Promise<boolean>} 복원 성공 여부
     */
    async autoRestoreOnPageLoad() {
        console.log('페이지 로드 시 자동 상태 복원 시작...');
        
        try {
            // 게임 초기화가 완료될 때까지 잠시 대기
            await this.waitForGameInitialization();
            
            // 저장된 상태가 있는지 확인
            const hasSavedState = this.hasSavedGameState();
            
            if (!hasSavedState) {
                console.log('저장된 게임 상태가 없습니다. 새 게임으로 시작합니다.');
                // 새 게임 초기화
                this.initializeNewGame();
                return false;
            }
            
            // 자동 복원 시도
            const restoreSuccess = this.loadGameState(false); // 알림 비활성화
            
            if (restoreSuccess) {
                console.log('자동 상태 복원 성공');
                // 복원 성공 시 간단한 알림만 표시
                setTimeout(() => {
                    this.showInfoNotification('게임 복원', '이전 게임 상태가 자동으로 복원되었습니다.');
                }, 1000);
                return true;
            } else {
                console.log('자동 상태 복원 실패 - 새 게임으로 시작');
                // 복원 실패 시 새 게임 초기화
                this.initializeNewGame();
                return false;
            }
            
        } catch (error) {
            console.error('자동 상태 복원 중 오류:', error);
            // 오류 발생 시 새 게임 초기화
            this.initializeNewGame();
            return false;
        }
    }
    
    /**
     * 저장된 게임 상태 존재 여부 확인
     * @returns {boolean} 저장된 상태 존재 여부
     */
    hasSavedGameState() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            return savedData !== null && savedData.trim() !== '';
        } catch (error) {
            console.error('저장된 상태 확인 중 오류:', error);
            return false;
        }
    }
    
    /**
     * 게임 초기화 완료 대기
     * @returns {Promise<void>}
     */
    async waitForGameInitialization() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5초 타임아웃
            
            const checkInitialization = () => {
                attempts++;
                
                // 필요한 전역 객체들 초기화 확인 및 생성
                if (!window.nations) {
                    window.nations = [];
                }
                if (!window.nextNationId) {
                    window.nextNationId = 1;
                }
                if (!window.currentYear) {
                    window.currentYear = 0;
                }
                if (window.simulationRunning === undefined) {
                    window.simulationRunning = false;
                }
                
                // pixelMap이 있으면 초기화 완료로 간주
                if (window.pixelMap) {
                    console.log('게임 초기화 완료 확인');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('게임 초기화 대기 타임아웃');
                    reject(new Error('게임 초기화 타임아웃'));
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        });
    }
    
    /**
     * 게임 초기화
     * @returns {boolean} 초기화 성공 여부
     */
    resetGame() {
        try {
            // 백업 생성 (초기화 전)
            this.createBackup('before_reset');
            
            // localStorage에서 게임 데이터 삭제
            localStorage.removeItem(this.storageKey);
            
            // 게임을 초기 상태로 리셋
            this.initializeGameToDefaultState();
            
            console.log('게임이 초기 상태로 리셋되었습니다.');
            this.showSuccessNotification('초기화 완료', '게임이 초기 상태로 리셋되었습니다.');
            
            // 페이지 새로고침으로 완전 초기화
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
            return true;
            
        } catch (error) {
            console.error('게임 초기화 실패:', error);
            this.showErrorNotification('초기화 실패', '게임을 초기화할 수 없습니다.');
            return false;
        }
    }
    
    /**
     * 게임 데이터 검증 (기존 호환성 유지)
     * @param {Object} data - 검증할 게임 데이터
     * @returns {boolean} 검증 성공 여부
     */
    validateGameData(data) {
        const result = this.validateGameDataWithDetails(data);
        return result.isValid;
    }
    
    /**
     * 게임 데이터 상세 검증
     * @param {Object} data - 검증할 게임 데이터
     * @returns {Object} 검증 결과 및 오류 세부사항
     */
    validateGameDataWithDetails(data) {
        const errors = [];
        
        try {
            // 기본 구조 검증
            if (!data || typeof data !== 'object') {
                errors.push('데이터가 객체가 아닙니다');
                return { isValid: false, errors };
            }
            
            // 필수 필드 검증
            const requiredFields = ['version', 'timestamp', 'gameData'];
            for (const field of requiredFields) {
                if (!(field in data)) {
                    errors.push(`필수 필드 누락: ${field}`);
                }
            }
            
            // timestamp 유효성 검증
            if (data.timestamp && (typeof data.timestamp !== 'number' || data.timestamp <= 0)) {
                errors.push('timestamp가 유효하지 않습니다');
            }
            
            // gameData 구조 검증
            const gameData = data.gameData;
            if (!gameData || typeof gameData !== 'object') {
                errors.push('gameData가 객체가 아닙니다');
                return { isValid: false, errors };
            }
            
            // nations 배열 검증
            if (!Array.isArray(gameData.nations)) {
                errors.push('nations가 배열이 아닙니다');
            } else {
                // 각 국가 데이터 검증
                gameData.nations.forEach((nation, index) => {
                    if (!nation || typeof nation !== 'object') {
                        errors.push(`nations[${index}]가 객체가 아닙니다`);
                        return;
                    }
                    
                    const requiredNationFields = ['id', 'name', 'population', 'stability'];
                    requiredNationFields.forEach(field => {
                        if (!(field in nation)) {
                            errors.push(`nations[${index}]에 필수 필드 ${field}가 없습니다`);
                        }
                    });
                    
                    // 국가 ID 중복 검사
                    const duplicateIds = gameData.nations.filter(n => n.id === nation.id);
                    if (duplicateIds.length > 1) {
                        errors.push(`중복된 국가 ID: ${nation.id}`);
                    }
                });
            }
            
            // mapData 구조 검증
            if (!gameData.mapData || typeof gameData.mapData !== 'object') {
                errors.push('mapData가 객체가 아닙니다');
            } else {
                // 맵 데이터 배열 검증
                const mapArrays = ['terrainMap', 'nationMap', 'cityMap', 'provinceMap', 'provinceNames'];
                for (const arrayName of mapArrays) {
                    if (!Array.isArray(gameData.mapData[arrayName])) {
                        errors.push(`mapData.${arrayName}이 배열이 아닙니다`);
                    }
                }
                
                // 맵 크기 일관성 검증
                const { terrainMap, nationMap, cityMap, provinceMap } = gameData.mapData;
                if (Array.isArray(terrainMap) && Array.isArray(nationMap)) {
                    if (terrainMap.length !== nationMap.length) {
                        errors.push('terrainMap과 nationMap의 크기가 일치하지 않습니다');
                    }
                }
            }
            
            // gameSettings 검증
            if (!gameData.gameSettings || typeof gameData.gameSettings !== 'object') {
                errors.push('gameSettings가 객체가 아닙니다');
            } else {
                const settings = gameData.gameSettings;
                
                // 숫자 필드 검증
                if ('currentYear' in settings && (typeof settings.currentYear !== 'number' || settings.currentYear < 0)) {
                    errors.push('currentYear가 유효하지 않습니다');
                }
                
                // 불린 필드 검증
                if ('simulationRunning' in settings && typeof settings.simulationRunning !== 'boolean') {
                    errors.push('simulationRunning이 불린 값이 아닙니다');
                }
                
                // 열거형 필드 검증
                const validAggressionLevels = ['peaceful', 'balanced', 'aggressive'];
                if (settings.worldAggression && !validAggressionLevels.includes(settings.worldAggression)) {
                    errors.push(`worldAggression 값이 유효하지 않습니다: ${settings.worldAggression}`);
                }
            }
            
            // viewSettings 검증
            if (!gameData.viewSettings || typeof gameData.viewSettings !== 'object') {
                errors.push('viewSettings가 객체가 아닙니다');
            } else {
                const viewSettings = gameData.viewSettings;
                
                // 숫자 필드 검증
                const numericFields = ['zoomLevel', 'panX', 'panY', 'mapWidth', 'mapHeight'];
                numericFields.forEach(field => {
                    if (field in viewSettings && typeof viewSettings[field] !== 'number') {
                        errors.push(`viewSettings.${field}가 숫자가 아닙니다`);
                    }
                });
                
                // 범위 검증
                if (viewSettings.zoomLevel && (viewSettings.zoomLevel <= 0 || viewSettings.zoomLevel > 10)) {
                    errors.push('zoomLevel이 유효한 범위를 벗어났습니다');
                }
            }
            
            return {
                isValid: errors.length === 0,
                errors: errors
            };
            
        } catch (error) {
            console.error('데이터 검증 중 오류 발생:', error);
            errors.push(`검증 중 예외 발생: ${error.message}`);
            return { isValid: false, errors };
        }
    }
    
    /**
     * 백업 생성
     * @param {string} reason - 백업 생성 이유
     */
    createBackup(reason = 'manual') {
        try {
            // 기존 백업 데이터 가져오기
            const existingBackups = this.getBackups();
            
            // 현재 게임 상태 수집
            const currentState = this.collectCurrentGameState();
            
            // 새 백업 생성
            const newBackup = {
                id: `backup_${Date.now()}`,
                timestamp: Date.now(),
                reason: reason,
                data: currentState
            };
            
            // 백업 목록에 추가
            existingBackups.backups.unshift(newBackup);
            
            // 최대 백업 수 제한
            if (existingBackups.backups.length > this.maxBackups) {
                existingBackups.backups = existingBackups.backups.slice(0, this.maxBackups);
            }
            
            // 백업 저장 시도
            try {
                localStorage.setItem(this.backupKey, JSON.stringify(existingBackups));
                console.log(`백업 생성 완료: ${reason} (${new Date().toLocaleString()})`);
            } catch (storageError) {
                // 저장 공간 부족 시 백업 수를 줄여서 재시도
                if (storageError.name === 'QuotaExceededError') {
                    console.warn('백업 저장 공간 부족, 백업 수를 줄여서 재시도...');
                    
                    // 백업 수를 절반으로 줄임
                    existingBackups.backups = existingBackups.backups.slice(0, Math.max(1, Math.floor(this.maxBackups / 2)));
                    
                    try {
                        localStorage.setItem(this.backupKey, JSON.stringify(existingBackups));
                        console.log(`백업 생성 완료 (축소됨): ${reason} (${new Date().toLocaleString()})`);
                    } catch (retryError) {
                        // 그래도 실패하면 백업을 완전히 정리
                        console.warn('백업 저장 재시도 실패, 모든 백업 정리...');
                        localStorage.removeItem(this.backupKey);
                        
                        // 새 백업만 저장
                        const minimalBackup = { backups: [newBackup] };
                        try {
                            localStorage.setItem(this.backupKey, JSON.stringify(minimalBackup));
                            console.log(`백업 생성 완료 (최소화됨): ${reason} (${new Date().toLocaleString()})`);
                        } catch (finalError) {
                            console.error('백업 생성 최종 실패:', finalError);
                        }
                    }
                } else {
                    throw storageError;
                }
            }
            
        } catch (error) {
            console.error('백업 생성 실패:', error);
        }
    }
    
    /**
     * 오래된 백업 정리
     */
    cleanupOldBackups() {
        try {
            const backups = this.getBackups();
            
            // 최대 백업 수만큼만 유지
            if (backups.backups.length > this.maxBackups) {
                backups.backups = backups.backups.slice(0, this.maxBackups);
                localStorage.setItem(this.backupKey, JSON.stringify(backups));
                console.log('오래된 백업을 정리했습니다.');
            }
            
        } catch (error) {
            console.error('백업 정리 실패:', error);
        }
    }
    
    /**
     * 백업 목록 가져오기
     * @returns {Object} 백업 데이터
     */
    getBackups() {
        try {
            const backupData = localStorage.getItem(this.backupKey);
            if (!backupData) {
                return { backups: [] };
            }
            return JSON.parse(backupData);
        } catch (error) {
            console.error('백업 데이터 읽기 실패:', error);
            return { backups: [] };
        }
    }
    
    /**
     * 현재 게임 상태 수집
     * @returns {Object} 현재 게임 상태
     */
    collectCurrentGameState() {
        // 디버그: 저장 시점의 데이터 확인
        console.log('=== 게임 상태 수집 시작 ===');
        console.log('window.nations:', window.nations);
        console.log('window.nextNationId:', window.nextNationId);
        console.log('window.currentYear:', window.currentYear);
        console.log('window.simulationRunning:', window.simulationRunning);
        
        const gameState = {
            version: this.currentVersion,
            timestamp: Date.now(),
            gameData: {
                // 국가 데이터
                nations: window.nations || [],
                nextNationId: window.nextNationId || 1,
                selectedNation: window.selectedNation || null,
                
                // 맵 데이터
                mapData: {
                    terrainMap: window.pixelMap ? window.pixelMap.terrainMap : [],
                    nationMap: window.pixelMap ? window.pixelMap.nationMap : [],
                    cityMap: window.pixelMap ? window.pixelMap.cityMap : [],
                    provinceMap: window.pixelMap ? window.pixelMap.provinceMap : [],
                    provinceNames: window.pixelMap ? window.pixelMap.provinceNames : []
                },
                
                // 게임 설정
                gameSettings: {
                    currentYear: window.currentYear || 0,
                    simulationRunning: window.simulationRunning || false,
                    worldAggression: this.getSelectValue('world-aggression') || 'balanced',
                    rebellionFrequency: this.getSelectValue('rebellion-frequency') || 'medium',
                    simSpeed: this.getSelectValue('sim-speed') || 'medium'
                },
                
                // 맵 뷰 설정
                viewSettings: {
                    zoomLevel: window.pixelMap ? window.pixelMap.zoomLevel : 1,
                    panX: window.pixelMap ? window.pixelMap.panX : 0,
                    panY: window.pixelMap ? window.pixelMap.panY : 0,
                    mapWidth: window.pixelMap ? window.pixelMap.mapWidth : 1200,
                    mapHeight: window.pixelMap ? window.pixelMap.mapHeight : 800
                }
            }
        };
        
        // 디버그: 수집된 데이터 확인
        console.log('=== 수집된 게임 상태 ===');
        console.log('nations 개수:', gameState.gameData.nations.length);
        console.log('currentYear:', gameState.gameData.gameSettings.currentYear);
        console.log('simSpeed:', gameState.gameData.gameSettings.simSpeed);
        console.log('========================');
        
        return gameState;
    }
    
    /**
     * 검증과 함께 게임 상태 복원
     * @param {Object} gameState - 복원할 게임 상태
     * @returns {Object} 복원 결과
     */
    restoreGameStateWithValidation(gameState) {
        try {
            const data = gameState.gameData;
            
            // 복원 전 현재 상태 백업
            const currentState = this.collectCurrentGameState();
            
            // 단계별 복원 시도
            const steps = [
                { name: '국가 데이터 복원', fn: () => this.restoreNationsData(data) },
                { name: '맵 데이터 복원', fn: () => this.restoreMapData(data) },
                { name: '게임 설정 복원', fn: () => this.restoreGameSettings(data) },
                { name: '뷰 설정 복원', fn: () => this.restoreViewSettings(data) },
                { name: 'UI 업데이트', fn: () => this.updateUI() }
            ];
            
            for (const step of steps) {
                try {
                    step.fn();
                    console.log(`✓ ${step.name} 완료`);
                } catch (stepError) {
                    console.error(`✗ ${step.name} 실패:`, stepError);
                    
                    // 실패 시 이전 상태로 롤백
                    this.rollbackToState(currentState);
                    
                    return {
                        success: false,
                        error: `${step.name} 중 오류: ${stepError.message}`,
                        step: step.name
                    };
                }
            }
            
            // 복원 후 상태 검증
            const postRestoreValidation = this.validateRestoredState();
            if (!postRestoreValidation.isValid) {
                console.error('복원 후 상태 검증 실패:', postRestoreValidation.errors);
                this.rollbackToState(currentState);
                
                return {
                    success: false,
                    error: `복원 후 검증 실패: ${postRestoreValidation.errors.join(', ')}`,
                    step: '복원 후 검증'
                };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('게임 상태 복원 중 예상치 못한 오류:', error);
            return {
                success: false,
                error: `복원 중 예외 발생: ${error.message}`,
                step: '전체 복원 과정'
            };
        }
    }
    
    /**
     * 국가 데이터 복원
     * @param {Object} data - 게임 데이터
     */
    restoreNationsData(data) {
        if (!data.nations || !Array.isArray(data.nations)) {
            throw new Error('nations 데이터가 유효하지 않습니다');
        }
        
        // 국가 데이터 검증
        data.nations.forEach((nation, index) => {
            if (!nation || typeof nation !== 'object') {
                throw new Error(`nations[${index}]가 유효하지 않습니다`);
            }
            if (!nation.id || !nation.name) {
                throw new Error(`nations[${index}]에 필수 필드가 없습니다`);
            }
        });
        
        window.nations = data.nations;
        window.nextNationId = data.nextNationId || (Math.max(...data.nations.map(n => n.id), 0) + 1);
        window.selectedNation = data.selectedNation || null;
        
        console.log(`${data.nations.length}개 국가 데이터 복원 완료`);
    }
    
    /**
     * 맵 데이터 복원
     * @param {Object} data - 게임 데이터
     */
    restoreMapData(data) {
        if (!window.pixelMap) {
            throw new Error('pixelMap이 초기화되지 않았습니다');
        }
        
        if (!data.mapData || typeof data.mapData !== 'object') {
            throw new Error('mapData가 유효하지 않습니다');
        }
        
        const mapData = data.mapData;
        const mapArrays = ['terrainMap', 'nationMap', 'cityMap', 'provinceMap', 'provinceNames'];
        
        // 맵 배열 검증
        for (const arrayName of mapArrays) {
            if (!Array.isArray(mapData[arrayName])) {
                throw new Error(`${arrayName}이 배열이 아닙니다`);
            }
        }
        
        // 맵 크기 일관성 검증
        const { terrainMap, nationMap } = mapData;
        if (terrainMap.length > 0 && nationMap.length > 0) {
            if (terrainMap.length !== nationMap.length) {
                throw new Error('맵 데이터 크기가 일치하지 않습니다');
            }
        }
        
        // 맵 데이터 복원
        window.pixelMap.terrainMap = mapData.terrainMap || [];
        window.pixelMap.nationMap = mapData.nationMap || [];
        window.pixelMap.cityMap = mapData.cityMap || [];
        window.pixelMap.provinceMap = mapData.provinceMap || [];
        window.pixelMap.provinceNames = mapData.provinceNames || [];
        
        console.log('맵 데이터 복원 완료');
    }
    
    /**
     * 게임 설정 복원
     * @param {Object} data - 게임 데이터
     */
    restoreGameSettings(data) {
        if (!data.gameSettings || typeof data.gameSettings !== 'object') {
            console.warn('gameSettings가 없어 기본값을 사용합니다');
            return;
        }
        
        const settings = data.gameSettings;
        
        // 숫자 필드 검증 및 복원
        if (typeof settings.currentYear === 'number' && settings.currentYear >= 0) {
            window.currentYear = settings.currentYear;
        } else {
            window.currentYear = 0;
        }
        
        // 불린 필드 복원
        if (typeof settings.simulationRunning === 'boolean') {
            window.simulationRunning = settings.simulationRunning;
        } else {
            window.simulationRunning = false;
        }
        
        // 선택 요소 복원
        this.setSelectValue('world-aggression', settings.worldAggression || 'balanced');
        this.setSelectValue('rebellion-frequency', settings.rebellionFrequency || 'medium');
        this.setSelectValue('sim-speed', settings.simSpeed || 'medium');
        
        // 연도 표시 업데이트
        const yearDisplay = document.getElementById('year-display');
        if (yearDisplay) {
            yearDisplay.textContent = `연도: ${window.currentYear}`;
        }
        
        console.log('게임 설정 복원 완료');
    }
    
    /**
     * 뷰 설정 복원
     * @param {Object} data - 게임 데이터
     */
    restoreViewSettings(data) {
        if (!window.pixelMap) {
            throw new Error('pixelMap이 초기화되지 않았습니다');
        }
        
        if (!data.viewSettings || typeof data.viewSettings !== 'object') {
            console.warn('viewSettings가 없어 기본값을 사용합니다');
            return;
        }
        
        const viewSettings = data.viewSettings;
        
        // 숫자 필드 검증 및 복원
        if (typeof viewSettings.zoomLevel === 'number' && viewSettings.zoomLevel > 0 && viewSettings.zoomLevel <= 10) {
            window.pixelMap.zoomLevel = viewSettings.zoomLevel;
        }
        
        if (typeof viewSettings.panX === 'number') {
            window.pixelMap.panX = viewSettings.panX;
        }
        
        if (typeof viewSettings.panY === 'number') {
            window.pixelMap.panY = viewSettings.panY;
        }
        
        if (typeof viewSettings.mapWidth === 'number' && viewSettings.mapWidth > 0) {
            window.pixelMap.mapWidth = viewSettings.mapWidth;
        }
        
        if (typeof viewSettings.mapHeight === 'number' && viewSettings.mapHeight > 0) {
            window.pixelMap.mapHeight = viewSettings.mapHeight;
        }
        
        console.log('뷰 설정 복원 완료');
    }
    
    /**
     * 복원된 상태 검증
     * @returns {Object} 검증 결과
     */
    validateRestoredState() {
        const errors = [];
        
        try {
            // 전역 변수 검증
            if (!Array.isArray(window.nations)) {
                errors.push('nations가 배열이 아닙니다');
            }
            
            if (typeof window.nextNationId !== 'number' || window.nextNationId < 1) {
                errors.push('nextNationId가 유효하지 않습니다');
            }
            
            if (typeof window.currentYear !== 'number' || window.currentYear < 0) {
                errors.push('currentYear가 유효하지 않습니다');
            }
            
            // pixelMap 검증
            if (!window.pixelMap) {
                errors.push('pixelMap이 없습니다');
            } else {
                if (!Array.isArray(window.pixelMap.terrainMap)) {
                    errors.push('terrainMap이 배열이 아닙니다');
                }
                
                if (typeof window.pixelMap.zoomLevel !== 'number' || window.pixelMap.zoomLevel <= 0) {
                    errors.push('zoomLevel이 유효하지 않습니다');
                }
            }
            
            return {
                isValid: errors.length === 0,
                errors: errors
            };
            
        } catch (error) {
            console.error('복원 상태 검증 중 오류:', error);
            errors.push(`검증 중 예외: ${error.message}`);
            return { isValid: false, errors };
        }
    }
    
    /**
     * 이전 상태로 롤백
     * @param {Object} previousState - 이전 상태
     */
    rollbackToState(previousState) {
        try {
            console.log('이전 상태로 롤백 중...');
            this.restoreGameState(previousState);
            console.log('롤백 완료');
        } catch (rollbackError) {
            console.error('롤백 실패:', rollbackError);
            // 롤백도 실패한 경우 기본 상태로 초기화
            this.initializeGameToDefaultState();
        }
    }
    
    /**
     * 게임 상태 복원 (기존 호환성 유지)
     * @param {Object} gameState - 복원할 게임 상태
     */
    restoreGameState(gameState) {
        const result = this.restoreGameStateWithValidation(gameState);
        if (!result.success) {
            throw new Error(result.error);
        }
    }
    
    /**
     * 게임을 초기 상태로 초기화
     */
    initializeGameToDefaultState() {
        // 전역 변수 초기화
        window.nations = [];
        window.nextNationId = 1;
        window.selectedNation = null;
        window.currentYear = 0;
        window.simulationRunning = false;
        
        // 맵 초기화
        if (window.pixelMap) {
            window.pixelMap.clearMap();
            window.pixelMap.zoomLevel = 1;
            window.pixelMap.panX = 0;
            window.pixelMap.panY = 0;
        }
        
        // UI 초기화
        this.resetUI();
    }
    
    /**
     * 새 게임 초기화 (UI 업데이트만)
     */
    initializeNewGame() {
        console.log('새 게임 초기화 시작...');
        
        try {
            // 기본 상태로 초기화
            this.initializeGameToDefaultState();
            
            // UI 업데이트 (맵 생성은 app.js에서 처리)
            this.updateUI();
            
            console.log('새 게임 초기화 완료');
            
        } catch (error) {
            console.error('새 게임 초기화 실패:', error);
        }
    }
    
    /**
     * 버전 호환성 확인 및 마이그레이션
     * @param {Object} data - 확인할 데이터
     * @returns {Object} 마이그레이션 결과
     */
    checkVersionCompatibilityAndMigrate(data) {
        try {
            const dataVersion = data.version || '0.0.0';
            
            console.log(`버전 호환성 확인: ${dataVersion} -> ${this.currentVersion}`);
            
            // 동일한 버전인 경우 마이그레이션 불필요
            if (dataVersion === this.currentVersion) {
                return { success: true, data: data, migrated: false };
            }
            
            // 버전별 마이그레이션 수행
            const migrationResult = this.performVersionMigration(data, dataVersion);
            
            if (migrationResult.success) {
                console.log(`데이터 마이그레이션 완료: ${dataVersion} -> ${this.currentVersion}`);
                return { success: true, data: migrationResult.data, migrated: true };
            } else {
                return { success: false, error: migrationResult.error };
            }
            
        } catch (error) {
            console.error('버전 호환성 확인 중 오류:', error);
            return { success: false, error: `버전 확인 실패: ${error.message}` };
        }
    }
    
    /**
     * 버전별 마이그레이션 수행
     * @param {Object} data - 마이그레이션할 데이터
     * @param {string} fromVersion - 원본 버전
     * @returns {Object} 마이그레이션 결과
     */
    performVersionMigration(data, fromVersion) {
        try {
            let migratedData = JSON.parse(JSON.stringify(data)); // 깊은 복사
            
            // 버전별 마이그레이션 로직
            if (this.compareVersions(fromVersion, '1.0.0') < 0) {
                // 1.0.0 이전 버전에서 마이그레이션
                migratedData = this.migrateToV1_0_0(migratedData);
            }
            
            // 최종 버전 업데이트
            migratedData.version = this.currentVersion;
            migratedData.timestamp = migratedData.timestamp || Date.now();
            
            // 마이그레이션된 데이터 검증
            const validationResult = this.validateGameDataWithDetails(migratedData);
            if (!validationResult.isValid) {
                return { 
                    success: false, 
                    error: `마이그레이션 후 검증 실패: ${validationResult.errors.join(', ')}` 
                };
            }
            
            return { success: true, data: migratedData };
            
        } catch (error) {
            console.error('마이그레이션 수행 중 오류:', error);
            return { success: false, error: `마이그레이션 실패: ${error.message}` };
        }
    }
    
    /**
     * 1.0.0 버전으로 마이그레이션
     * @param {Object} data - 마이그레이션할 데이터
     * @returns {Object} 마이그레이션된 데이터
     */
    migrateToV1_0_0(data) {
        const migratedData = {
            version: '1.0.0',
            timestamp: data.timestamp || Date.now(),
            gameData: {
                nations: [],
                nextNationId: 1,
                selectedNation: null,
                mapData: {
                    terrainMap: [],
                    nationMap: [],
                    cityMap: [],
                    provinceMap: [],
                    provinceNames: []
                },
                gameSettings: {
                    currentYear: 0,
                    simulationRunning: false,
                    worldAggression: 'balanced',
                    rebellionFrequency: 'medium',
                    simSpeed: 'medium'
                },
                viewSettings: {
                    zoomLevel: 1,
                    panX: 0,
                    panY: 0,
                    mapWidth: 1200,
                    mapHeight: 800
                }
            }
        };
        
        // 기존 데이터가 있으면 병합
        if (data.gameData) {
            // 국가 데이터 마이그레이션
            if (Array.isArray(data.gameData.nations)) {
                migratedData.gameData.nations = data.gameData.nations.map(nation => ({
                    id: nation.id || 0,
                    name: nation.name || '무명 국가',
                    population: nation.population || 1000000,
                    stability: nation.stability || 50,
                    government: nation.government || '왕국',
                    founded: nation.founded || 0,
                    gdp: nation.gdp || 1000000,
                    armyStrength: nation.armyStrength || 3,
                    culturalTraits: nation.culturalTraits || [],
                    cities: nation.cities || [],
                    allies: nation.allies || [],
                    atWarWith: nation.atWarWith || [],
                    vassals: nation.vassals || [],
                    overlord: nation.overlord || null,
                    isRebel: nation.isRebel || false
                }));
            }
            
            // 맵 데이터 마이그레이션
            if (data.gameData.mapData) {
                Object.assign(migratedData.gameData.mapData, data.gameData.mapData);
            }
            
            // 게임 설정 마이그레이션
            if (data.gameData.gameSettings) {
                Object.assign(migratedData.gameData.gameSettings, data.gameData.gameSettings);
            }
            
            // 뷰 설정 마이그레이션
            if (data.gameData.viewSettings) {
                Object.assign(migratedData.gameData.viewSettings, data.gameData.viewSettings);
            }
            
            // 기타 필드들
            if ('nextNationId' in data.gameData) {
                migratedData.gameData.nextNationId = data.gameData.nextNationId;
            }
            if ('selectedNation' in data.gameData) {
                migratedData.gameData.selectedNation = data.gameData.selectedNation;
            }
        }
        
        return migratedData;
    }
    
    /**
     * 버전 비교
     * @param {string} version1 - 첫 번째 버전
     * @param {string} version2 - 두 번째 버전
     * @returns {number} -1: version1 < version2, 0: 같음, 1: version1 > version2
     */
    compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part < v2Part) return -1;
            if (v1Part > v2Part) return 1;
        }
        
        return 0;
    }
    
    /**
     * 데이터 마이그레이션 (기존 호환성 유지)
     * @param {Object} data - 마이그레이션할 데이터
     * @returns {Object} 마이그레이션된 데이터
     */
    migrateData(data) {
        const result = this.checkVersionCompatibilityAndMigrate(data);
        return result.success ? result.data : data;
    }
    
    /**
     * 저장 공간 부족 처리
     */
    handleStorageQuotaExceeded() {
        console.warn('저장 공간이 부족합니다. 오래된 백업을 정리합니다.');
        
        // 오래된 백업 정리
        this.cleanupOldBackups();
        
        // 추가 정리가 필요한 경우 다른 localStorage 항목도 정리
        const storageUsage = this.getStorageUsage();
        if (storageUsage.percentage > 80) {
            this.showWarningNotification('저장 공간 부족', '오래된 백업을 정리했습니다.');
        }
    }
    
    /**
     * 저장 공간 사용량 확인
     * @returns {Object} 사용량 정보
     */
    getStorageUsage() {
        try {
            let used = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage[key].length;
                }
            }
            
            const quota = 5 * 1024 * 1024; // 5MB 추정
            const percentage = (used / quota) * 100;
            
            return {
                used: used,
                quota: quota,
                percentage: percentage,
                usedFormatted: this.formatBytes(used),
                quotaFormatted: this.formatBytes(quota)
            };
        } catch (error) {
            console.error('저장 공간 사용량 확인 실패:', error);
            return { used: 0, quota: 0, percentage: 0 };
        }
    }
    
    /**
     * 바이트를 읽기 쉬운 형태로 포맷
     * @param {number} bytes - 바이트 수
     * @returns {string} 포맷된 문자열
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * select 요소의 값 가져오기
     * @param {string} id - 요소 ID
     * @returns {string} 선택된 값
     */
    getSelectValue(id) {
        const element = document.getElementById(id);
        return element ? element.value : null;
    }
    
    /**
     * select 요소의 값 설정
     * @param {string} id - 요소 ID
     * @param {string} value - 설정할 값
     */
    setSelectValue(id, value) {
        const element = document.getElementById(id);
        if (element && value) {
            element.value = value;
        }
    }
    
    /**
     * UI 업데이트
     */
    updateUI() {
        // 국가 목록 업데이트
        if (window.nationManager && typeof window.nationManager.renderNationsList === 'function') {
            window.nationManager.renderNationsList();
        }
        
        // 맵 렌더링
        if (window.pixelMap && typeof window.pixelMap.render === 'function') {
            window.pixelMap.render();
        }
        
        // 시뮬레이션 버튼 상태 업데이트
        const startBtn = document.getElementById('start-simulation');
        const stopBtn = document.getElementById('stop-simulation');
        
        if (startBtn && stopBtn) {
            if (window.simulationRunning) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        }
    }
    
    /**
     * UI 초기화
     */
    resetUI() {
        // 연도 표시 초기화
        const yearDisplay = document.getElementById('year-display');
        if (yearDisplay) {
            yearDisplay.textContent = '연도: 0';
        }
        
        // 세계 경제 표시 초기화
        const worldEconomy = document.getElementById('world-economy');
        if (worldEconomy) {
            worldEconomy.textContent = '세계 무역: 0';
        }
        
        // 선택 요소들 기본값으로 리셋
        this.setSelectValue('world-aggression', 'balanced');
        this.setSelectValue('rebellion-frequency', 'medium');
        this.setSelectValue('sim-speed', 'medium');
        
        // 시뮬레이션 버튼 상태 리셋
        const startBtn = document.getElementById('start-simulation');
        const stopBtn = document.getElementById('stop-simulation');
        
        if (startBtn && stopBtn) {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
        
        this.updateUI();
    }
    
    /**
     * 성공 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     */
    showSuccessNotification(title, message) {
        console.log(`✅ ${title}: ${message}`);
        if (window.notificationSystem) {
            return window.notificationSystem.showSuccess(title, message);
        }
    }
    
    /**
     * 오류 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     */
    showErrorNotification(title, message) {
        console.error(`❌ ${title}: ${message}`);
        if (window.notificationSystem) {
            return window.notificationSystem.showError(title, message);
        }
    }
    
    /**
     * 경고 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     */
    showWarningNotification(title, message) {
        console.warn(`⚠️ ${title}: ${message}`);
        if (window.notificationSystem) {
            return window.notificationSystem.showWarning(title, message);
        }
    }
    
    /**
     * 정보 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     */
    showInfoNotification(title, message) {
        console.info(`ℹ️ ${title}: ${message}`);
        if (window.notificationSystem) {
            return window.notificationSystem.showInfo(title, message);
        }
    }
    
    /**
     * 진행 상태 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @returns {string} 알림 ID
     */
    showProgressNotification(title, message) {
        console.info(`🔄 ${title}: ${message}`);
        if (window.notificationSystem) {
            return window.notificationSystem.showProgress(title, message);
        }
        return null;
    }
    
    /**
     * 진행 상태 알림 업데이트
     * @param {string} notificationId - 알림 ID
     * @param {string} title - 새 제목
     * @param {string} message - 새 메시지
     */
    updateProgressNotification(notificationId, title, message) {
        if (window.notificationSystem && notificationId) {
            window.notificationSystem.updateProgress(notificationId, title, message);
        }
    }
    
    /**
     * 특정 알림 제거
     * @param {string} notificationId - 제거할 알림 ID
     */
    removeNotification(notificationId) {
        if (window.notificationSystem && notificationId) {
            window.notificationSystem.removeNotification(notificationId);
        }
    }
    
    /**
     * 손상된 데이터 처리
     * @param {string} reason - 손상 이유
     * @param {boolean} showNotifications - 알림 표시 여부
     */
    handleCorruptedData(reason, showNotifications = true) {
        console.warn(`데이터 손상 감지: ${reason}`);
        
        // 백업에서 복구 시도
        const backupRestoreResult = this.tryRestoreFromBackup();
        
        if (backupRestoreResult.success) {
            console.log('백업에서 성공적으로 복구했습니다');
            if (showNotifications) {
                this.showWarningNotification(
                    '데이터 복구', 
                    '저장된 데이터가 손상되어 백업에서 복구했습니다.'
                );
            }
        } else {
            console.log('백업 복구 실패, 기본 상태로 시작합니다');
            this.fallbackToDefaultState();
            
            if (showNotifications) {
                this.showWarningNotification(
                    '새 게임 시작', 
                    '저장된 데이터를 복구할 수 없어 새 게임으로 시작합니다.'
                );
            }
        }
    }
    
    /**
     * 복원 실패 처리
     * @param {string} error - 오류 메시지
     * @param {boolean} showNotifications - 알림 표시 여부
     */
    handleRestoreFailure(error, showNotifications = true) {
        console.error(`게임 상태 복원 실패: ${error}`);
        
        // 백업에서 복구 시도
        const backupRestoreResult = this.tryRestoreFromBackup();
        
        if (backupRestoreResult.success) {
            console.log('백업에서 성공적으로 복구했습니다');
            if (showNotifications) {
                this.showWarningNotification(
                    '백업에서 복구', 
                    '최신 데이터 복원에 실패하여 백업에서 복구했습니다.'
                );
            }
        } else {
            console.log('백업 복구도 실패, 기본 상태로 시작합니다');
            this.fallbackToDefaultState();
            
            if (showNotifications) {
                this.showErrorNotification(
                    '복원 실패', 
                    '게임 상태를 복원할 수 없어 새 게임으로 시작합니다.'
                );
            }
        }
    }
    
    /**
     * 예상치 못한 오류 처리
     * @param {Error} error - 오류 객체
     * @param {boolean} showNotifications - 알림 표시 여부
     */
    handleUnexpectedError(error, showNotifications = true) {
        console.error('예상치 못한 오류 발생:', error);
        
        // 기본 상태로 폴백
        this.fallbackToDefaultState();
        
        if (showNotifications) {
            this.showErrorNotification(
                '시스템 오류', 
                '예상치 못한 오류가 발생하여 새 게임으로 시작합니다.'
            );
        }
    }
    
    /**
     * 백업에서 복구 시도
     * @returns {Object} 복구 결과
     */
    tryRestoreFromBackup() {
        try {
            const backups = this.getBackups();
            
            if (!backups.backups || backups.backups.length === 0) {
                return { success: false, error: '사용 가능한 백업이 없습니다' };
            }
            
            // 가장 최근 백업부터 시도
            for (const backup of backups.backups) {
                try {
                    console.log(`백업 복구 시도: ${backup.id} (${new Date(backup.timestamp).toLocaleString()})`);
                    
                    // 백업 데이터 검증
                    const validationResult = this.validateGameDataWithDetails(backup.data);
                    if (!validationResult.isValid) {
                        console.warn(`백업 ${backup.id} 검증 실패:`, validationResult.errors);
                        continue;
                    }
                    
                    // 백업에서 복원 시도
                    const restoreResult = this.restoreGameStateWithValidation(backup.data);
                    if (restoreResult.success) {
                        console.log(`백업 ${backup.id}에서 성공적으로 복구`);
                        return { success: true, backupId: backup.id };
                    } else {
                        console.warn(`백업 ${backup.id} 복원 실패:`, restoreResult.error);
                    }
                    
                } catch (backupError) {
                    console.error(`백업 ${backup.id} 처리 중 오류:`, backupError);
                    continue;
                }
            }
            
            return { success: false, error: '모든 백업 복구 시도 실패' };
            
        } catch (error) {
            console.error('백업 복구 시도 중 오류:', error);
            return { success: false, error: `백업 복구 오류: ${error.message}` };
        }
    }
    
    /**
     * 기본 상태로 폴백
     */
    fallbackToDefaultState() {
        try {
            console.log('기본 상태로 폴백 중...');
            
            // 손상된 데이터 제거
            localStorage.removeItem(this.storageKey);
            
            // 게임을 기본 상태로 초기화
            this.initializeGameToDefaultState();
            
            console.log('기본 상태로 폴백 완료');
            
        } catch (error) {
            console.error('기본 상태 폴백 중 오류:', error);
            // 최후의 수단으로 페이지 새로고침
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    }
}

// 전역 GameStateManager 인스턴스 생성
window.gameStateManager = new GameStateManager();

// GameDataUI 초기화 (DOM이 로드된 후)
document.addEventListener('DOMContentLoaded', () => {
    if (typeof GameDataUI !== 'undefined') {
        window.gameDataUI = new GameDataUI(window.gameStateManager);
        console.log('GameDataUI 초기화 완료');
    }
});