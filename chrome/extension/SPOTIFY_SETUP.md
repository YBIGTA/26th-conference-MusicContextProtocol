# Spotify 설정 가이드

Music Context Protocol에서 Spotify Web Player를 사용하여 음악을 자동으로 재생합니다.

## 🎵 기본 사용법 (설정 불필요)

확장프로그램을 활성화하면 자동으로 다음과 같이 작동합니다:

1. **자동 검색**: 컨텍스트에 맞는 음악을 추천받습니다
2. **Spotify 웹 플레이어 열기**: 자동으로 Spotify 웹 사이트에서 해당 트랙을 검색합니다
3. **재생**: Spotify 웹 플레이어에서 음악이 재생됩니다 (Free/Premium 모두 지원)

## 🔧 선택사항: 더 정확한 검색을 위한 Spotify API 연동

더 정확한 트랙 검색을 원한다면 Spotify Developer 앱을 설정할 수 있습니다:

### 1. Spotify Developer 앱 생성

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에 접속
2. "Create App" 클릭
3. 앱 정보 입력:
   - App name: `Music Context Protocol`
   - App description: `Chrome extension for contextual music playback`
   - Redirect URI: `chrome-extension://[YOUR_EXTENSION_ID]/popup.html`

### 2. Client ID 설정

1. 생성된 앱의 Settings에서 Client ID 복사
2. `popup.js` 파일에서 다음 줄 수정:
   ```javascript
   const clientId = 'your_spotify_client_id'; // 여기에 Client ID 입력
   ```

### 3. 확장프로그램에서 로그인

1. 확장프로그램 팝업에서 "Login to Spotify (Optional)" 버튼 클릭
2. Spotify 로그인 및 권한 승인
3. 이후 더 정확한 검색 결과를 얻을 수 있습니다

## 💡 작동 방식

- **API 없음**: Spotify 웹에서 `아티스트명 + 곡명`으로 검색
- **API 연동 후**: 정확한 트랙 ID로 직접 접근

## 계정 요구사항

- **Spotify 무료 계정**: 기본 웹 플레이어 기능 사용 가능
- **Spotify Premium**: 더 나은 재생 품질 및 기능

## 주의사항

- Spotify 웹 플레이어는 별도 탭에서 열립니다
- 광고는 Spotify의 정책에 따라 재생될 수 있습니다 (무료 계정)
- 트랙이 종료되면 자동으로 다음 곡으로 넘어갑니다