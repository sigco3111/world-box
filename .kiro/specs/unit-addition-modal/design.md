# Design Document: 유닛 추가 모달

## Overview

이 디자인 문서는 국가 선택 후 유닛 추가 기능을 모달 인터페이스로 구현하는 방법을 설명합니다. 현재 구현에서는 국가를 선택하면 유닛 추가 메뉴가 국가 탭 내에 직접 표시되고 있습니다. 새로운 디자인에서는 모달 창을 통해 유닛 추가 인터페이스를 제공하여 사용자 경험을 개선합니다.

## Architecture

유닛 추가 모달 기능은 기존 코드베이스에 통합되며, 다음과 같은 구성 요소로 이루어집니다:

1. **HTML 구조**: 모달 컨테이너와 내부 요소들을 정의합니다.
2. **CSS 스타일**: 모달의 시각적 표현과 애니메이션을 정의합니다.
3. **JavaScript 기능**: 모달의 표시, 숨김, 이벤트 처리를 담당합니다.

이 기능은 기존의 `NationManager` 클래스의 `showUnitAddMenu` 메서드를 수정하여 구현됩니다.

## Components and Interfaces

### 1. 모달 컨테이너

모달 컨테이너는 다음 요소들을 포함합니다:
- 모달 오버레이: 배경을 어둡게 하고 모달 외부 클릭 이벤트를 처리합니다.
- 모달 콘텐츠: 실제 모달 내용을 담는 컨테이너입니다.
- 닫기 버튼: 모달을 닫는 기능을 제공합니다.
- 제목: 선택된 국가 이름과 함께 "유닛 추가"를 표시합니다.
- 유닛 버튼 컨테이너: 다양한 유닛 유형 버튼을 담습니다.

```html
<div id="modal-overlay" class="modal-overlay">
  <div id="unit-add-modal" class="unit-add-modal">
    <button class="modal-close-btn">&times;</button>
    <h3 id="modal-title">국가명 유닛 추가</h3>
    <div class="unit-buttons">
      <!-- 유닛 버튼들이 여기에 동적으로 추가됩니다 -->
    </div>
  </div>
</div>
```

### 2. 유닛 유형 버튼

각 유닛 유형 버튼은 다음과 같은 특성을 가집니다:
- 고유한 색상: 유닛 유형을 시각적으로 구분합니다.
- 아이콘 또는 텍스트: 유닛 유형을 나타냅니다.
- 클릭 이벤트: 해당 유형의 유닛을 추가하는 기능을 트리거합니다.

```html
<button class="unit-button" data-type="A" style="background-color: #ff6666;">
  <span class="unit-icon">⚔️</span>
  <span class="unit-name">전쟁</span>
</button>
```

## Data Models

유닛 유형 데이터 모델:

```javascript
const unitTypes = [
  { type: 'A', name: '전쟁', color: '#ff6666', icon: '⚔️' },
  { type: 'W', name: '농업', color: '#66ff66', icon: '🌾' },
  { type: 'T', name: '무역', color: '#66aaff', icon: '🛒' },
  { type: 'M', name: '광업', color: '#aa66aa', icon: '⛏️' },
  { type: 'F', name: '어업', color: '#66cccc', icon: '🐟' },
  { type: 'C', name: '건설', color: '#ffaa66', icon: '🏗️' }
];
```

## Error Handling

1. **모달 표시 실패**: 모달 요소를 찾을 수 없거나 표시할 수 없는 경우, 콘솔에 오류를 기록하고 기존 방식으로 유닛 추가 메뉴를 표시합니다.
2. **유닛 추가 실패**: 유닛 추가 과정에서 오류가 발생하면, 사용자에게 알림을 표시하고 콘솔에 오류를 기록합니다.
3. **이벤트 처리 오류**: 이벤트 리스너 등록 실패 시 콘솔에 오류를 기록합니다.

## Testing Strategy

1. **단위 테스트**:
   - 모달 표시/숨김 기능 테스트
   - 유닛 버튼 클릭 이벤트 테스트
   - 모달 외부 클릭 시 닫힘 기능 테스트

2. **통합 테스트**:
   - 국가 선택 후 모달 표시 흐름 테스트
   - 유닛 추가 후 맵 업데이트 확인
   - 다양한 유닛 유형 추가 테스트

3. **UI/UX 테스트**:
   - 모달 애니메이션 확인
   - 다양한 화면 크기에서의 반응형 디자인 테스트
   - 접근성 테스트 (키보드 탐색, 스크린 리더 호환성)

## 디자인 상세

### CSS 스타일

모달 오버레이와 모달 콘텐츠에 대한 CSS 스타일:

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

.unit-add-modal {
  background-color: #1e1e1e;
  border: 2px solid #66aa66;
  border-radius: 8px;
  padding: 20px;
  width: 320px;
  max-width: 90%;
  transform: scale(0.8);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  position: relative;
}

.modal-overlay.active .unit-add-modal {
  transform: scale(1);
  opacity: 1;
}

.modal-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #f0f0f0;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  color: #ff6666;
  background-color: rgba(255, 102, 102, 0.2);
  transform: rotate(90deg);
}

.unit-add-modal h3 {
  text-align: center;
  margin-bottom: 15px;
  color: #f0f0f0;
  border-bottom: 1px solid #444;
  padding-bottom: 10px;
}

.unit-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
}

.unit-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: none;
  border-radius: 6px;
  color: #111;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.unit-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.unit-icon {
  font-size: 24px;
  margin-bottom: 5px;
}

.unit-name {
  font-size: 14px;
}
```

### JavaScript 기능

모달 표시 및 이벤트 처리를 위한 JavaScript 코드:

```javascript
// 모달 초기화 및 DOM에 추가
function initializeUnitAddModal() {
  // 이미 존재하는 모달 제거
  const existingModal = document.getElementById('modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }

  // 새 모달 생성
  const modalHTML = `
    <div id="modal-overlay" class="modal-overlay">
      <div id="unit-add-modal" class="unit-add-modal">
        <button class="modal-close-btn">&times;</button>
        <h3 id="modal-title"></h3>
        <div class="unit-buttons"></div>
      </div>
    </div>
  `;

  // DOM에 모달 추가
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // 모달 닫기 이벤트 설정
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('unit-add-modal');
  const closeBtn = document.querySelector('.modal-close-btn');

  closeBtn.addEventListener('click', () => {
    closeUnitAddModal();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeUnitAddModal();
    }
  });

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeUnitAddModal();
    }
  });
}

// 모달 표시 함수
function showUnitAddModal(nation) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const buttonsContainer = document.querySelector('.unit-buttons');

  // 제목 설정
  title.textContent = `${nation.name} 유닛 추가`;

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

  unitTypes.forEach(unit => {
    const button = document.createElement('button');
    button.className = 'unit-button';
    button.style.backgroundColor = unit.color;
    button.dataset.type = unit.type;
    
    button.innerHTML = `
      <span class="unit-icon">${unit.icon}</span>
      <span class="unit-name">${unit.name}</span>
    `;
    
    button.addEventListener('click', () => {
      addUnitToNation(nation, unit.type);
      closeUnitAddModal();
    });
    
    buttonsContainer.appendChild(button);
  });

  // 모달 표시
  overlay.classList.add('active');
}

// 모달 닫기 함수
function closeUnitAddModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
}
```

## 구현 계획

1. HTML 구조를 index.html에 추가하거나 JavaScript를 통해 동적으로 생성합니다.
2. CSS 스타일을 styles.css에 추가합니다.
3. NationManager 클래스의 showUnitAddMenu 메서드를 수정하여 모달을 사용하도록 합니다.
4. 모달 표시/숨김 및 이벤트 처리 기능을 구현합니다.
5. 유닛 추가 기능을 모달과 통합합니다.

## 결론

이 디자인은 기존 유닛 추가 기능을 모달 인터페이스로 개선하여 사용자 경험을 향상시킵니다. 모달은 사용자의 주의를 집중시키고, 유닛 유형을 시각적으로 명확하게 구분하여 선택할 수 있게 합니다. 또한, 애니메이션 효과와 반응형 디자인을 통해 현대적인 웹 인터페이스 경험을 제공합니다.