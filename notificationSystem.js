/**
 * NotificationSystem - 상태 알림 UI 시스템
 * 저장/불러오기 상태를 표시하는 알림 컴포넌트
 */
class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.notificationCounter = 0;
        this.defaultDuration = 5000; // 5초
        this.maxNotifications = 5;
        
        this.init();
    }
    
    /**
     * 알림 시스템 초기화
     */
    init() {
        // 알림 컨테이너 찾기 또는 생성
        this.container = document.getElementById('game-state-notifications');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'game-state-notifications';
            this.container.className = 'state-notifications';
            document.body.appendChild(this.container);
        }
        
        console.log('알림 시스템 초기화 완료');
    }
    
    /**
     * 성공 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @param {number} duration - 표시 시간 (밀리초)
     */
    showSuccess(title, message, duration = this.defaultDuration) {
        return this.showNotification('success', title, message, duration);
    }
    
    /**
     * 오류 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @param {number} duration - 표시 시간 (밀리초)
     */
    showError(title, message, duration = this.defaultDuration) {
        return this.showNotification('error', title, message, duration);
    }
    
    /**
     * 경고 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @param {number} duration - 표시 시간 (밀리초)
     */
    showWarning(title, message, duration = this.defaultDuration) {
        return this.showNotification('warning', title, message, duration);
    }
    
    /**
     * 정보 알림 표시
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @param {number} duration - 표시 시간 (밀리초)
     */
    showInfo(title, message, duration = this.defaultDuration) {
        return this.showNotification('info', title, message, duration);
    }
    
    /**
     * 진행 상태 알림 표시 (자동으로 사라지지 않음)
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @returns {string} 알림 ID (업데이트나 제거에 사용)
     */
    showProgress(title, message) {
        return this.showNotification('info', title, message, 0, true);
    }
    
    /**
     * 진행 상태 알림 업데이트
     * @param {string} notificationId - 알림 ID
     * @param {string} title - 새 제목
     * @param {string} message - 새 메시지
     */
    updateProgress(notificationId, title, message) {
        const notification = this.notifications.get(notificationId);
        if (!notification) {
            console.warn(`알림 ID ${notificationId}를 찾을 수 없습니다`);
            return;
        }
        
        const titleElement = notification.element.querySelector('.notification-title');
        const messageElement = notification.element.querySelector('.notification-message');
        
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        
        // 알림 데이터 업데이트
        notification.title = title;
        notification.message = message;
        notification.timestamp = Date.now();
    }
    
    /**
     * 특정 알림 제거
     * @param {string} notificationId - 제거할 알림 ID
     */
    removeNotification(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) {
            return;
        }
        
        // 페이드아웃 애니메이션
        notification.element.style.animation = 'slideOutRight 0.3s ease forwards';
        
        // 애니메이션 완료 후 DOM에서 제거
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            
            // 타이머 정리
            if (notification.timer) {
                clearTimeout(notification.timer);
            }
            
            // 맵에서 제거
            this.notifications.delete(notificationId);
        }, 300);
    }
    
    /**
     * 모든 알림 제거
     */
    clearAll() {
        const notificationIds = Array.from(this.notifications.keys());
        notificationIds.forEach(id => this.removeNotification(id));
    }
    
    /**
     * 알림 표시 (내부 메서드)
     * @param {string} type - 알림 타입 (success, error, warning, info)
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @param {number} duration - 표시 시간 (0이면 자동으로 사라지지 않음)
     * @param {boolean} isProgress - 진행 상태 알림 여부
     * @returns {string} 알림 ID
     */
    showNotification(type, title, message, duration = this.defaultDuration, isProgress = false) {
        // 최대 알림 수 제한
        if (this.notifications.size >= this.maxNotifications) {
            // 가장 오래된 알림 제거
            const oldestId = Array.from(this.notifications.keys())[0];
            this.removeNotification(oldestId);
        }
        
        // 고유 ID 생성
        const notificationId = `notification_${++this.notificationCounter}_${Date.now()}`;
        
        // 알림 요소 생성
        const notificationElement = this.createNotificationElement(type, title, message, notificationId, isProgress);
        
        // 컨테이너에 추가
        this.container.appendChild(notificationElement);
        
        // 자동 제거 타이머 설정
        let timer = null;
        if (duration > 0) {
            timer = setTimeout(() => {
                this.removeNotification(notificationId);
            }, duration);
        }
        
        // 알림 정보 저장
        this.notifications.set(notificationId, {
            id: notificationId,
            type: type,
            title: title,
            message: message,
            element: notificationElement,
            timer: timer,
            timestamp: Date.now(),
            isProgress: isProgress
        });
        
        // 슬라이드인 애니메이션 트리거
        setTimeout(() => {
            notificationElement.classList.add('show');
        }, 10);
        
        console.log(`알림 표시: [${type.toUpperCase()}] ${title} - ${message}`);
        
        return notificationId;
    }
    
    /**
     * 알림 요소 생성
     * @param {string} type - 알림 타입
     * @param {string} title - 알림 제목
     * @param {string} message - 알림 메시지
     * @param {string} notificationId - 알림 ID
     * @param {boolean} isProgress - 진행 상태 알림 여부
     * @returns {HTMLElement} 알림 요소
     */
    createNotificationElement(type, title, message, notificationId, isProgress) {
        const notification = document.createElement('div');
        notification.className = `state-notification notification-${type}`;
        notification.setAttribute('data-notification-id', notificationId);
        
        // 진행 상태 알림인 경우 특별한 클래스 추가
        if (isProgress) {
            notification.classList.add('notification-progress');
        }
        
        // 알림 내용 구성
        const content = document.createElement('div');
        content.className = 'notification-content';
        
        // 제목 요소
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        titleElement.textContent = title;
        content.appendChild(titleElement);
        
        // 메시지 요소
        if (message) {
            const messageElement = document.createElement('div');
            messageElement.className = 'notification-message';
            messageElement.textContent = message;
            content.appendChild(messageElement);
        }
        
        notification.appendChild(content);
        
        // 닫기 버튼 추가
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', '알림 닫기');
        closeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.removeNotification(notificationId);
        });
        
        notification.appendChild(closeButton);
        
        // 진행 상태 표시기 추가 (진행 상태 알림인 경우)
        if (isProgress) {
            const progressIndicator = document.createElement('div');
            progressIndicator.className = 'notification-progress-indicator';
            
            const spinner = document.createElement('div');
            spinner.className = 'notification-spinner';
            progressIndicator.appendChild(spinner);
            
            notification.appendChild(progressIndicator);
        }
        
        // 클릭 시 제거 (진행 상태 알림 제외)
        if (!isProgress) {
            notification.addEventListener('click', () => {
                this.removeNotification(notificationId);
            });
        }
        
        return notification;
    }
    
    /**
     * 특정 타입의 알림 개수 반환
     * @param {string} type - 알림 타입
     * @returns {number} 해당 타입의 알림 개수
     */
    getNotificationCount(type = null) {
        if (!type) {
            return this.notifications.size;
        }
        
        return Array.from(this.notifications.values())
            .filter(notification => notification.type === type).length;
    }
    
    /**
     * 진행 중인 알림들 반환
     * @returns {Array} 진행 중인 알림 목록
     */
    getProgressNotifications() {
        return Array.from(this.notifications.values())
            .filter(notification => notification.isProgress);
    }
    
    /**
     * 알림 시스템 상태 정보 반환
     * @returns {Object} 상태 정보
     */
    getStatus() {
        return {
            totalNotifications: this.notifications.size,
            maxNotifications: this.maxNotifications,
            notificationsByType: {
                success: this.getNotificationCount('success'),
                error: this.getNotificationCount('error'),
                warning: this.getNotificationCount('warning'),
                info: this.getNotificationCount('info')
            },
            progressNotifications: this.getProgressNotifications().length
        };
    }
}

// 전역 알림 시스템 인스턴스 생성
window.notificationSystem = new NotificationSystem();