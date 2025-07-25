/**
 * GameDataUI - 게임 데이터 관리 UI 시스템
 * 설정 탭의 게임 데이터 관리 섹션을 담당하는 클래스
 */
class GameDataUI {
    constructor(gameStateManager) {
        this.gameStateManager = gameStateManager;
        this.notificationContainer = null;
        this.confirmationDialog = null;
        this.pendingAction = null;
        
        this.init();
    }
    
    /**
     * UI 초기화
     */
    init() {
        this.setupElements();
        this.setupEventListeners();
        this.updateDataInfo();
        
        // 주기적으로 데이터 정보 업데이트 (30초마다)
        setInterval(() => {
            this.updateDataInfo();
        }, 30000);
    }
    
    /**
     * DOM 요소 설정
     */
    setupElements() {
        this.notificationContainer = document.getElementById('game-state-notifications');
        this.confirmationDialog = document.getElementById('confirmation-dialog');
        
        // 알림 컨테이너가 없으면 생성
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'game-state-notifications';
            this.notificationContainer.className = 'state-notifications';
            document.body.appendChild(this.notificationContainer);
        }
        
        // 확인 대화상자가 없으면 생성
        if (!this.confirmationDialog) {
            this.createConfirmationDialog();
        }
    }
    
    /**
     * 확인 대화상자 생성
     */
    createConfirmationDialog() {
        this.confirmationDialog = document.createElement('div');
        this.confirmationDialog.id = 'confirmation-dialog';
        this.confirmationDialog.className = 'confirmation-dialog';
        this.confirmationDialog.innerHTML = `
            <h3 id="dialog-title">확인</h3>
            <p id="dialog-message">정말로 실행하시겠습니까?</p>
            <div class="confirmation-buttons">
                <button id="dialog-confirm" class="confirm-btn">확인</button>
                <button id="dialog-cancel" class="cancel-btn">취소</button>
            </div>
        `;
        document.body.appendChild(this.confirmationDialog);
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 수동 저장 버튼
        const manualSaveBtn = document.getElementById('manual-save-btn');
        if (manualSaveBtn) {
            manualSaveBtn.addEventListener('click', () => this.handleManualSave());
        }
        
        // 게임 초기화 버튼
        const resetGameBtn = document.getElementById('reset-game-btn');
        if (resetGameBtn) {
            resetGameBtn.addEventListener('click', () => this.handleResetGame());
        }
        
        // 모든 데이터 삭제 버튼
        const clearDataBtn = document.getElementById('clear-data-btn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => this.handleClearData());
        }
        
        // 확인 대화상자 버튼들
        const dialogConfirm = document.getElementById('dialog-confirm');
        const dialogCancel = document.getElementById('dialog-cancel');
        
        if (dialogConfirm) {
            dialogConfirm.addEventListener('click', () => this.handleDialogConfirm());
        }
        
        if (dialogCancel) {
            dialogCancel.addEventListener('click', () => this.handleDialogCancel());
        }
        
        // 대화상자 외부 클릭 시 닫기
        if (this.confirmationDialog) {
            this.confirmationDialog.addEventListener('click', (e) => {
                if (e.target === this.confirmationDialog) {
                    this.hideConfirmationDialog();
                }
            });
        }
        
        // ESC 키로 대화상자 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.confirmationDialog.style.display === 'block') {
                this.hideConfirmationDialog();
            }
        });
    }
    
    /**
     * 데이터 정보 업데이트
     */
    updateDataInfo() {
        this.updateDataSize();
        this.updateLastSaveTime();
    }
    
    /**
     * 저장된 데이터 크기 업데이트
     */
    updateDataSize() {
        const dataSizeElement = document.getElementById('data-size');
        if (!dataSizeElement) return;
        
        try {
            const storageUsage = this.getStorageUsage();
            const sizeText = this.formatBytes(storageUsage.gameDataSize);
            const totalText = this.formatBytes(storageUsage.totalSize);
            
            dataSizeElement.innerHTML = `${sizeText} (전체: ${totalText})`;
            
            // 용량 경고 표시
            if (storageUsage.percentage > 80) {
                dataSizeElement.style.color = '#ff6666';
                dataSizeElement.title = '저장 공간이 부족합니다';
            } else if (storageUsage.percentage > 60) {
                dataSizeElement.style.color = '#ffaa66';
                dataSizeElement.title = '저장 공간 사용량이 높습니다';
            } else {
                dataSizeElement.style.color = '#f0f0f0';
                dataSizeElement.title = '';
            }
            
        } catch (error) {
            console.error('데이터 크기 업데이트 실패:', error);
            dataSizeElement.textContent = '계산 실패';
            dataSizeElement.style.color = '#ff6666';
        }
    }
    
    /**
     * 마지막 저장 시간 업데이트
     */
    updateLastSaveTime() {
        const lastSaveElement = document.getElementById('last-save-time');
        if (!lastSaveElement) return;
        
        try {
            const savedData = localStorage.getItem(this.gameStateManager.storageKey);
            if (!savedData) {
                lastSaveElement.textContent = '없음';
                lastSaveElement.style.color = '#aaa';
                return;
            }
            
            const gameState = JSON.parse(savedData);
            if (gameState.timestamp) {
                const saveTime = new Date(gameState.timestamp);
                const timeText = this.formatRelativeTime(saveTime);
                lastSaveElement.textContent = timeText;
                lastSaveElement.style.color = '#f0f0f0';
                lastSaveElement.title = saveTime.toLocaleString();
            } else {
                lastSaveElement.textContent = '알 수 없음';
                lastSaveElement.style.color = '#aaa';
            }
            
        } catch (error) {
            console.error('마지막 저장 시간 업데이트 실패:', error);
            lastSaveElement.textContent = '오류';
            lastSaveElement.style.color = '#ff6666';
        }
    }
    
    /**
     * 저장 공간 사용량 계산
     * @returns {Object} 저장 공간 사용량 정보
     */
    getStorageUsage() {
        let gameDataSize = 0;
        let totalSize = 0;
        
        // 게임 데이터 크기
        const gameData = localStorage.getItem(this.gameStateManager.storageKey);
        if (gameData) {
            gameDataSize = new Blob([gameData]).size;
        }
        
        // 백업 데이터 크기
        const backupData = localStorage.getItem(this.gameStateManager.backupKey);
        let backupSize = 0;
        if (backupData) {
            backupSize = new Blob([backupData]).size;
        }
        
        // 전체 localStorage 크기 (근사치)
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += new Blob([localStorage[key]]).size;
            }
        }
        
        // 추정 할당량 (5MB)
        const estimatedQuota = 5 * 1024 * 1024;
        const percentage = (totalSize / estimatedQuota) * 100;
        
        return {
            gameDataSize,
            backupSize,
            totalSize,
            estimatedQuota,
            percentage: Math.min(percentage, 100)
        };
    }
    
    /**
     * 바이트를 읽기 쉬운 형태로 변환
     * @param {number} bytes - 바이트 수
     * @returns {string} 포맷된 크기 문자열
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * 상대적 시간 포맷
     * @param {Date} date - 날짜 객체
     * @returns {string} 상대적 시간 문자열
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) {
            return '방금 전';
        } else if (diffMin < 60) {
            return `${diffMin}분 전`;
        } else if (diffHour < 24) {
            return `${diffHour}시간 전`;
        } else if (diffDay < 7) {
            return `${diffDay}일 전`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    /**
     * 수동 저장 처리
     */
    handleManualSave() {
        const saveBtn = document.getElementById('manual-save-btn');
        if (!saveBtn) return;
        
        // 버튼 상태 변경
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '저장 중...';
        saveBtn.disabled = true;
        
        try {
            const success = this.gameStateManager.saveGameState(true);
            
            if (success) {
                // 데이터 정보 즉시 업데이트
                setTimeout(() => {
                    this.updateDataInfo();
                }, 100);
            }
            
        } catch (error) {
            console.error('수동 저장 실패:', error);
            this.showNotification('error', '저장 실패', '게임을 저장할 수 없습니다.');
        } finally {
            // 버튼 상태 복원
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1000);
        }
    }
    
    /**
     * 게임 초기화 처리
     */
    handleResetGame() {
        this.showConfirmationDialog(
            '게임 초기화',
            '모든 게임 데이터가 삭제되고 초기 상태로 돌아갑니다.\n정말로 게임을 초기화하시겠습니까?',
            () => {
                try {
                    const success = this.gameStateManager.resetGame();
                    if (success) {
                        // 데이터 정보 업데이트
                        this.updateDataInfo();
                    }
                } catch (error) {
                    console.error('게임 초기화 실패:', error);
                    this.showNotification('error', '초기화 실패', '게임을 초기화할 수 없습니다.');
                }
            }
        );
    }
    
    /**
     * 모든 데이터 삭제 처리
     */
    handleClearData() {
        this.showConfirmationDialog(
            '모든 데이터 삭제',
            '저장된 게임 데이터와 백업이 모두 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.\n정말로 삭제하시겠습니까?',
            () => {
                try {
                    // 게임 데이터 삭제
                    localStorage.removeItem(this.gameStateManager.storageKey);
                    
                    // 백업 데이터 삭제
                    localStorage.removeItem(this.gameStateManager.backupKey);
                    
                    // 데이터 정보 업데이트
                    this.updateDataInfo();
                    
                    this.showNotification('success', '삭제 완료', '모든 데이터가 삭제되었습니다.');
                    
                } catch (error) {
                    console.error('데이터 삭제 실패:', error);
                    this.showNotification('error', '삭제 실패', '데이터를 삭제할 수 없습니다.');
                }
            }
        );
    }
    
    /**
     * 확인 대화상자 표시
     * @param {string} title - 대화상자 제목
     * @param {string} message - 대화상자 메시지
     * @param {Function} onConfirm - 확인 시 실행할 함수
     */
    showConfirmationDialog(title, message, onConfirm) {
        if (!this.confirmationDialog) return;
        
        const titleElement = document.getElementById('dialog-title');
        const messageElement = document.getElementById('dialog-message');
        
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        
        this.pendingAction = onConfirm;
        this.confirmationDialog.style.display = 'block';
        
        // 포커스를 취소 버튼에 설정
        const cancelBtn = document.getElementById('dialog-cancel');
        if (cancelBtn) {
            setTimeout(() => cancelBtn.focus(), 100);
        }
    }
    
    /**
     * 확인 대화상자 숨기기
     */
    hideConfirmationDialog() {
        if (this.confirmationDialog) {
            this.confirmationDialog.style.display = 'none';
        }
        this.pendingAction = null;
    }
    
    /**
     * 대화상자 확인 처리
     */
    handleDialogConfirm() {
        if (this.pendingAction && typeof this.pendingAction === 'function') {
            this.pendingAction();
        }
        this.hideConfirmationDialog();
    }
    
    /**
     * 대화상자 취소 처리
     */
    handleDialogCancel() {
        this.hideConfirmationDialog();
    }
    
    /**
     * 알림 표시
     * @param {string} type - 알림 타입 (success, error, warning, info)
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     */
    showNotification(type, title, message) {
        if (!this.notificationContainer) return;
        
        const notification = document.createElement('div');
        notification.className = `state-notification notification-${type}`;
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        `;
        
        this.notificationContainer.appendChild(notification);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// GameStateManager의 알림 메서드들을 GameDataUI와 연결
if (typeof GameStateManager !== 'undefined') {
    // GameStateManager 프로토타입에 알림 메서드 추가
    GameStateManager.prototype.showSuccessNotification = function(title, message) {
        if (window.gameDataUI) {
            window.gameDataUI.showNotification('success', title, message);
        }
    };
    
    GameStateManager.prototype.showErrorNotification = function(title, message) {
        if (window.gameDataUI) {
            window.gameDataUI.showNotification('error', title, message);
        }
    };
    
    GameStateManager.prototype.showWarningNotification = function(title, message) {
        if (window.gameDataUI) {
            window.gameDataUI.showNotification('warning', title, message);
        }
    };
    
    GameStateManager.prototype.showInfoNotification = function(title, message) {
        if (window.gameDataUI) {
            window.gameDataUI.showNotification('info', title, message);
        }
    };
}