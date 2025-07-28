
# 자동 저장 및 불러오기 기능 추가 계획

## 1. 데이터 구조 분석 (완료)

- [x] `app.js`, `map.js`, `nations.js`, `provinces.js`, `terrain.js` 코드 분석
- [x] 저장할 데이터 식별:
    - `pixelMap` 객체: `terrainMap`, `nationMap`, `cityMap`, `provinceMap`, `provinceNames`
    - `nations` 배열: 모든 국가의 상세 정보
    - `currentYear`: 현재 시뮬레이션 연도

## 2. 자동 저장 기능 구현

- [ ] **게임 상태 저장 함수 생성 (`saveGameState`)**
    - `pixelMap` 객체의 주요 데이터를 JSON으로 변환
    - `nations` 배열을 JSON으로 변환
    - `currentYear` 변수 저장
    - 위 데이터들을 하나의 객체로 묶어 `localStorage`에 'worldBoxSaveData' 키로 저장

- [ ] **자동 저장 트리거 설정**
    - `setInterval`을 사용하여 1분마다 `saveGameState` 함수를 호출
    - 시뮬레이션이 실행 중일 때만 자동 저장 활성화

## 3. 불러오기 기능 구현

- [ ] **게임 상태 불러오기 함수 생성 (`loadGameState`)**
    - `localStorage`에서 'worldBoxSaveData' 키로 저장된 데이터 조회
    - 데이터가 존재하면 JSON을 파싱하여 `pixelMap`, `nations`, `currentYear` 등 관련 변수 및 객체에 복원
    - 데이터 복원 후 지도 및 UI를 다시 렌더링하여 변경사항 반영

- [ ] **불러오기 버튼 추가**
    - `index.html` 파일에 '마지막 저장 불러오기' 버튼 추가
    - 버튼 클릭 시 `loadGameState` 함수를 호출하는 이벤트 리스너 연결

## 4. UI/UX 개선

- [ ] **상태 알림 기능**
    - 게임이 저장될 때 사용자에게 "게임이 자동 저장되었습니다."와 같은 알림 메시지 표시
    - 게임을 성공적으로 불러왔을 때 "저장된 게임을 불러왔습니다." 알림 메시지 표시
    - 저장된 데이터가 없을 경우, "저장된 데이터가 없습니다." 알림 표시

## 5. 테스트

- [ ] 자동 저장이 주기적으로 정상 동작하는지 확인
- [ ] 브라우저를 새로고침하거나 재시작한 후 '불러오기' 버튼으로 게임 상태가 정확히 복원되는지 테스트
- [ ] 시뮬레이션 진행 중 데이터가 올바르게 저장되고 불러와지는지 확인
