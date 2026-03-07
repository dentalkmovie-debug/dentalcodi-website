# 치과 TV 관리 시스템 (Dental TV)

## 📌 프로젝트 개요
치과 대기실 TV 및 체어 모니터에 홍보 영상, 주의사항 등을 송출하는 관리 시스템입니다.
아임웹(Imweb) 사이트에 연동하여 별도 로그인 없이 관리자 페이지에 접속할 수 있습니다.

## ✅ 핵심 기능
*   **멀티룸 독립 재생**: 대기실, 체어1, 체어2 등을 동시에 켜도 서로 간섭 없이 독립적으로 재생됩니다.
*   **안정적 재생**: 네트워크 변동 시 자동 복구, 재생 워치독(정지 감지 후 자동 재생) 기능이 탑재되어 있습니다.
*   **활성 아이템 자동 복원**: 활성 목록이 비어 있어도 기존 전체 영상 재생으로 자동 복귀합니다.
*   **활성 ID 정규화**: 재생목록 ID를 숫자로 정규화하여 추가 영상이 즉시 재생됩니다.
*   **빈 플레이리스트 대기 화면**: 재생 목록이 비어 있어도 에러 대신 대기 화면을 유지합니다.
*   **백그라운드 재생**: 브라우저 창을 가리거나 다른 탭을 봐도 영상이 멈추지 않습니다.
*   **아임웹 연동**: 아임웹 회원 정보를 자동으로 불러와 치과명을 표시합니다.

## 🛠 설치 및 배포 방법

### 1. 필수 준비물
*   Node.js (v18 이상)
*   Cloudflare 계정

### 2. 설치
```bash
# 1. 의존성 설치
npm install

# 2. 데이터베이스 생성 (Cloudflare D1)
npx wrangler d1 create dental-tv-db

# 3. 데이터베이스 설정 (wrangler.jsonc 수정)
# 위 명령어로 생성된 database_id를 wrangler.jsonc 파일의 database_id 부분에 붙여넣으세요.
```

### 3. 배포
```bash
# Cloudflare Pages에 배포
npm run deploy
```

## 📺 아임웹 연동 코드
아임웹 디자인 모드에서 [코드 위젯]을 추가하고 아래 코드를 붙여넣으세요.
(`dentalTvHost` 주소는 실제 배포된 주소로 변경해야 합니다)

```html
<iframe 
  id="dental-tv-frame"
  src=""
  width="100%" 
  height="800" 
  frameborder="0" 
  allow="clipboard-write; autoplay; fullscreen"
  scrolling="no"
  style="overflow: hidden;"
></iframe>

<script>
  // 아임웹 변수 가져오기
  var rawMemberCode = '{{ member_code }}';
  var rawMemberName = '{{ user_name }}';
  var rawMemberEmail = '{{ user_email }}';
  
  // 변수 정제
  var memberCode = rawMemberCode.indexOf('{{') === -1 ? rawMemberCode : '';
  var memberName = rawMemberName.indexOf('{{') === -1 ? rawMemberName : '내 치과';
  var memberEmail = rawMemberEmail.indexOf('{{') === -1 ? rawMemberEmail : '';
  
  // ★ 배포된 주소로 변경하세요 ★
  var dentalTvHost = 'https://your-project.pages.dev'; 
  
  if (memberCode && memberEmail) {
    var targetUrl = dentalTvHost + '/login?memberCode=' + encodeURIComponent(memberCode)
      + '&email=' + encodeURIComponent(memberEmail)
      + '&name=' + encodeURIComponent(memberName);
    document.getElementById('dental-tv-frame').src = targetUrl;
  } else {
    // memberCode/email 치환이 안 되면 /login 단일 페이지에서 이메일 입력
    document.getElementById('dental-tv-frame').src = dentalTvHost + '/login';
  }

  // 자동 높이 조절
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'setHeight') {
      var newHeight = e.data.height + 30;
      document.getElementById('dental-tv-frame').style.height = newHeight + 'px';
    }
  });
</script>
```

## 🔐 자동 매칭 로그인 흐름 (아임웹 → 관리자 모드)
- **치환코드 지원 환경**: `/login?memberCode=...&email=...&name=...` 형태로 자동 진입
- **치환코드 미지원 환경**: `/login` 단일 URL로 접속 후 **가입 이메일 입력** → 서버가 아임웹 API로 승인 여부 검증 → 자동 로그인
- 첫 로그인 이후에는 **저장된 세션으로 자동 진입**되어 이메일 입력 없이 접속됩니다.
- 승인되지 않은 이메일은 차단됩니다.

### 예시 URL
```
/login?memberCode=회원코드&email=가입이메일&name=치과명
/login
```

## 🔗 치과별 로그인 링크 자동 생성
- **URL**: `/master/links` 또는 `/master`의 **아임웹 링크** 탭
- 마스터 비밀번호 입력 후 아임웹 회원 목록을 불러오면 치과별 로그인 링크가 자동 생성됩니다.
- 생성된 링크를 아임웹의 **페이지 제목 링크**에 연결하면 각 치과가 독립적으로 접속합니다.

## 🔄 아임웹 자동 동기화 (신규 가입 즉시 등록)
- 마스터 페이지 로그인 시 **자동 동기화**가 1회 실행됩니다.
- 이후 **5분마다 자동 동기화**가 수행되어 신규 회원이 자동으로 등록됩니다.
- Cloudflare 환경 특성상 **백그라운드 작업은 불가**하며, 마스터 페이지가 열려 있을 때 동기화가 동작합니다.

## ⚠️ 재생이 안 될 경우 (트러블슈팅)
대부분의 최신 브라우저(TV 포함)는 **"소리가 있는 자동 재생"**을 차단합니다.
본 시스템은 이를 우회하기 위해 **"무조건 음소거"**로 시작합니다.

그래도 영상이 안 나온다면:
1.  **TV 리모컨의 [확인] 버튼을 한 번 눌러주세요.** (사용자 상호작용이 발생하면 브라우저가 재생을 허용합니다)
2.  인터넷 연결을 확인하세요.
3.  관리자 페이지에서 플레이리스트에 영상이 정상적으로 추가되었는지 확인하세요.
