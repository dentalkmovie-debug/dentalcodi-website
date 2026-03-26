/* ============================================================
   동시접속 차단 위젯 v24.12
   임웹 푸터에 스크립트 태그 1줄 삽입으로 동작
   
   사용법:
     <script src="https://dental-point.pages.dev/widget-login-blocker.js"></script>

   변경 이력:
   v24.12 - API 서버를 dental-point.pages.dev로 통합
            imweb-login-blocker.pages.dev 서버 제거(DNS 없음) 대응
            기존 포인트관리 위젯과 동일한 member_id 감지 로직 적용
   v24.6  - deviceId 처리 강화
   v24.2  - JWT 파싱 개선
   v24.1  - sessionStorage + localStorage 이중 저장
   v24    - 초기 배포
   ============================================================ */
(function() {
  'use strict';

  var _VER = 'v24.12';
  var API = 'https://dental-point.pages.dev';    // ★ dental-point 서버로 통합
  var LOGIN_URL = 'https://impiantpoint.imweb.me/login';
  var CHECK_INTERVAL_MS = 30000;  // 30초마다 세션 확인
  var RETRY_MAX = 3;

  console.log('[LoginBlocker] ' + _VER + ' loaded');

  /* ===================================================
     디바이스 ID (브라우저/기기 고유 식별자)
     - localStorage + sessionStorage 이중 저장
     - 새 기기에서 처음 열면 새 ID 생성
  =================================================== */
  function getDeviceId() {
    var KEY = 'lb_device_id';
    var id = '';
    try { id = localStorage.getItem(KEY) || ''; } catch(e) {}
    if (!id) { try { id = sessionStorage.getItem(KEY) || ''; } catch(e) {} }
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      try { localStorage.setItem(KEY, id); } catch(e) {}
      try { sessionStorage.setItem(KEY, id); } catch(e) {}
    }
    return id;
  }

  /* ===================================================
     세션 토큰 저장/조회
  =================================================== */
  function getSessionToken() {
    var t = '';
    try { t = sessionStorage.getItem('lb_st') || ''; } catch(e) {}
    if (!t) { try { t = localStorage.getItem('lb_st') || ''; } catch(e) {} }
    return t;
  }
  function saveSessionToken(token) {
    try { sessionStorage.setItem('lb_st', token); } catch(e) {}
    try { localStorage.setItem('lb_st', token); } catch(e) {}
  }

  /* ===================================================
     member_id 감지 (기존 포인트관리 위젯과 동일 로직)
  =================================================== */
  var _memberId = null;

  function getMemberId() {
    if (_memberId) return _memberId;

    /* 방법1: window.__bs_imweb (임웹 SDK) */
    try {
      var bs = window.__bs_imweb;
      if (!bs) {
        // 쿠키에서 __bs_imweb 파싱
        var ck = document.cookie.split(';');
        for (var i = 0; i < ck.length; i++) {
          var c = ck[i].trim();
          if (c.indexOf('__bs_imweb=') === 0) {
            try { bs = JSON.parse(decodeURIComponent(c.substring(11))); } catch(e) {}
            break;
          }
        }
      }
      if (bs) {
        // member_no (숫자 ID)
        var no = bs.member_no || bs.memberNo || (bs.member && bs.member.no);
        if (no) { return String(no); }
        // sdk_jwt 파싱
        if (bs.sdk_jwt) {
          try {
            var parts = bs.sdk_jwt.split('.');
            var payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
            var sub = payload.sub || payload.member_code || payload.mc || '';
            if (sub && sub !== 'null') return String(sub);
          } catch(e) {}
        }
        // 직접 필드
        var direct = bs.member_code || bs.memberCode || bs.code;
        if (direct) return String(direct);
      }
    } catch(e) {}

    /* 방법2: 전역 변수 (임웹 테마/플러그인이 세팅하는 경우) */
    var globals = ['member_data','JEJU_MEMBER','__MEMBER__','memberData','_member','member','user_data'];
    for (var g = 0; g < globals.length; g++) {
      try {
        var obj = window[globals[g]];
        if (obj && typeof obj === 'object') {
          var mid = obj.member_code || obj.code || obj.id || obj.no || obj.member_id || obj.memberCode || '';
          if (mid && String(mid).length > 3) return String(mid);
        }
      } catch(e) {}
    }

    /* 방법3: M20 콘솔 캡처값 */
    if (_capturedM20) return _capturedM20;

    return '';
  }

  /* ===================================================
     콘솔 M20 패턴 캡처
     임웹이 console.log에 member_code를 출력하는 경우 가로챔
  =================================================== */
  var _capturedM20 = null;
  var _origLog = console.log;
  var _origInfo = console.info;

  function _wrapConsole(fn) {
    return function() {
      try {
        var str = Array.prototype.slice.call(arguments).join(' ');
        var m = str.match(/\b(m20\d{6,})\b/);
        if (m && !_capturedM20) {
          _capturedM20 = m[1];
          if (!_memberId) _memberId = _capturedM20;
        }
      } catch(e) {}
      return fn.apply(console, arguments);
    };
  }
  try {
    console.log = _wrapConsole(_origLog);
    console.info = _wrapConsole(_origInfo);
  } catch(e) {}

  /* ===================================================
     로그인 여부 확인
  =================================================== */
  function isLoggedIn() {
    // 임웹 SDK 확인
    try {
      var bs = window.__bs_imweb;
      if (bs && (bs.member_code || bs.memberCode || bs.member_no || bs.sdk_jwt)) return true;
    } catch(e) {}
    // 마이페이지 메뉴 표시 여부 (로그인 시 표시)
    var myEl = document.querySelector('[data-page="mypage"], .imweb-member-mypage, [href*="mypage"]');
    if (myEl && myEl.offsetParent !== null) return true;
    // 로그인 버튼이 숨겨져 있으면 로그인 상태
    var loginEl = document.querySelector('[data-page="login"], .imweb-member-login, [href*="/login"]');
    if (loginEl && loginEl.style.display === 'none') return true;
    // member_id가 감지되면 로그인 상태
    return !!getMemberId();
  }

  /* ===================================================
     API 호출 (지수 백오프 재시도)
  =================================================== */
  function apiPost(path, data, cb, retries) {
    retries = retries || 0;
    fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(r) { return r.json(); })
    .then(function(res) { cb(null, res); })
    .catch(function(err) {
      if (retries < RETRY_MAX) {
        setTimeout(function() { apiPost(path, data, cb, retries + 1); }, 1000 * Math.pow(2, retries));
      } else {
        cb(err, null);
      }
    });
  }

  /* ===================================================
     차단 모달 UI
  =================================================== */
  function showBlockModal(reason) {
    if (document.getElementById('lb-modal')) return;

    var msg = (reason === 'kicked' || reason === 'token_mismatch')
      ? '다른 기기 또는 브라우저에서 로그인하여<br>현재 세션이 종료되었습니다.'
      : '동시 접속이 감지되었습니다.<br>보안을 위해 다시 로그인해 주세요.';

    var el = document.createElement('div');
    el.id = 'lb-modal';
    el.setAttribute('style', [
      'position:fixed','top:0','left:0','right:0','bottom:0',
      'background:rgba(15,23,42,0.82)','z-index:2147483647',
      'display:flex','align-items:center','justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif',
      'animation:lbFadeIn .25s ease'
    ].join(';'));

    el.innerHTML = [
      '<style>',
        '@keyframes lbFadeIn{from{opacity:0}to{opacity:1}}',
        '@keyframes lbSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
        '#lb-modal .lb-box{animation:lbSlideUp .3s ease}',
        '#lb-relogin:hover{background:#1d4ed8}',
      '</style>',
      '<div class="lb-box" style="background:#fff;border-radius:20px;padding:36px 28px;',
        'max-width:360px;width:calc(100% - 40px);text-align:center;',
        'box-shadow:0 24px 64px rgba(0,0,0,.35)">',
        '<div style="width:60px;height:60px;background:#fee2e2;border-radius:50%;',
          'display:flex;align-items:center;justify-content:center;',
          'margin:0 auto 20px;font-size:28px">🔒</div>',
        '<h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 10px">',
          '세션이 종료되었습니다</h2>',
        '<p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.65">',
          msg + '</p>',
        '<button id="lb-relogin" style="width:100%;padding:13px;',
          'background:#2563eb;color:#fff;border:none;border-radius:12px;',
          'font-size:15px;font-weight:600;cursor:pointer;',
          'transition:background .15s;font-family:inherit">',
          '🔑 다시 로그인</button>',
        '<p style="font-size:11px;color:#d1d5db;margin:14px 0 0">' + _VER + '</p>',
      '</div>'
    ].join('');

    document.body.appendChild(el);

    document.getElementById('lb-relogin').onclick = function() {
      // 로컬 토큰 초기화
      try { sessionStorage.removeItem('lb_st'); localStorage.removeItem('lb_st'); } catch(e) {}
      window.location.href = LOGIN_URL + '?from=' + encodeURIComponent(location.pathname);
    };
  }

  function hideBlockModal() {
    var m = document.getElementById('lb-modal');
    if (m) m.remove();
  }

  /* ===================================================
     세션 등록
     - 새 토큰 생성 후 서버에 등록
     - 기존 세션은 서버에서 자동 kick
  =================================================== */
  function registerSession(memberId) {
    var deviceId = getDeviceId();
    var token = 'ST' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    saveSessionToken(token);

    apiPost('/api/session/register', {
      member_id: memberId,
      device_id: deviceId,
      session_token: token,
      user_agent: (navigator.userAgent || '').slice(0, 200)
    }, function(err, res) {
      if (err) {
        console.warn('[LoginBlocker] register error (will retry on next check)');
        return;
      }
      console.log('[LoginBlocker] registered, expires:', res && res.expires_at);
      // 등록 성공 후 즉시 확인 시작
      startChecking(memberId);
    });
  }

  /* ===================================================
     주기적 세션 확인
  =================================================== */
  var _timer = null;

  function startChecking(memberId) {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(function() { doCheck(memberId); }, CHECK_INTERVAL_MS);
  }

  function doCheck(memberId) {
    apiPost('/api/session/check', {
      member_id: memberId,
      device_id: getDeviceId(),
      session_token: getSessionToken()
    }, function(err, res) {
      if (err) {
        // 네트워크 오류: 차단하지 않음 (서비스 연속성 우선)
        return;
      }
      if (res && res.valid === false) {
        if (_timer) { clearInterval(_timer); _timer = null; }
        console.warn('[LoginBlocker] kicked! reason:', res.reason);
        showBlockModal(res.reason);
      } else {
        hideBlockModal();
      }
    });
  }

  /* ===================================================
     초기화
  =================================================== */
  var _inited = false;
  var _pollCount = 0;
  var _pollMax = 20;  // 최대 10초(500ms × 20) 대기

  function tryInit() {
    if (_inited) return;
    if (!isLoggedIn()) {
      hideBlockModal();
      return;  // 비로그인 상태 → 아무것도 안 함
    }
    var mid = getMemberId();
    if (!mid) {
      _pollCount++;
      if (_pollCount < _pollMax) {
        setTimeout(tryInit, 500);
      } else {
        console.warn('[LoginBlocker] member_id not detected after ' + (_pollMax * 500) + 'ms');
      }
      return;
    }
    _inited = true;
    _memberId = mid;
    console.log('[LoginBlocker] member:', mid.slice(0, 5) + '...');
    registerSession(mid);
  }

  /* ===================================================
     실행 진입점
  =================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(tryInit, 600); });
  } else {
    setTimeout(tryInit, 600);  // 임웹 SDK 초기화 대기
  }

  // SPA 페이지 이동 감지 (임웹은 부분 새로고침 방식 사용)
  var _prevUrl = location.href;
  setInterval(function() {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      _inited = false;
      _pollCount = 0;
      setTimeout(tryInit, 600);
    }
  }, 1000);

  /* ===================================================
     전역 API (외부 디버그/제어용)
     콘솔에서 window._lb.check() 등으로 호출 가능
  =================================================== */
  window._lb = {
    ver: _VER,
    deviceId: getDeviceId,
    memberId: function() { return _memberId || getMemberId(); },
    check: function() { if (_memberId) doCheck(_memberId); else console.log('[LB] member_id 없음'); },
    kick: function() { if (_timer) clearInterval(_timer); showBlockModal('manual'); },
    reset: function() {
      _inited = false; _pollCount = 0; _memberId = null;
      try { sessionStorage.removeItem('lb_st'); localStorage.removeItem('lb_st'); } catch(e) {}
      console.log('[LB] reset, re-init...');
      setTimeout(tryInit, 200);
    }
  };

})();
