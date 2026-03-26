/* ============================================================
   아임웹 동시접속 차단 스크립트 v24.12
   ============================================================
   변경 이력:
   v24.12 - 서버 dental-point.pages.dev 통합 (imweb-login-blocker.pages.dev 폐기 대응)
            M20 패턴 캡처 확장
            member_id 감지 로직 강화 (4가지 방법)
            네트워크 오류시 차단하지 않음 (서비스 연속성)
   v24.6  - deviceId 처리 강화
   v24.2  - JWT 파싱 개선 (sub / member_code / mc 필드 지원)
   v24.1  - sessionStorage + localStorage 이중 저장
   v24    - 초기 배포
   ============================================================ */
(function () {
  'use strict';

  /* ── 중복 실행 방지 ─────────────────────────────────────── */
  if (window.__imwebLoginBlockerLoaded) return;
  window.__imwebLoginBlockerLoaded = true;

  /* ── 설정 ─────────────────────────────────────────────── */
  var VERSION = 'v24.12';
  var SERVER  = 'https://dental-point.pages.dev';   // ★ 서버 주소 (여기만 바꾸면 됨)
  var LOGIN_PAGE = 'https://impiantpoint.imweb.me/login';
  var CHECK_INTERVAL = 3000;   // 3초마다 세션 확인 (보안 강화)
  var RETRY_LIMIT    = 3;
  var MEMBER_WAIT_MS = 10000;  // member_id 최대 대기 10초

  console.log('[LB] ' + VERSION + ' loading...');

  /* ── CSS 인젝션 ────────────────────────────────────────── */
  (function injectCSS() {
    var s = document.createElement('style');
    s.id = 'lb-styles';
    s.textContent = [
      '@keyframes lbFadeIn   { from { opacity:0 }                     to { opacity:1 } }',
      '@keyframes lbSlideUp  { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }',
      '#lb-overlay {',
      '  position:fixed; inset:0; z-index:2147483647;',
      '  background:rgba(15,23,42,0.85);',
      '  display:flex; align-items:center; justify-content:center;',
      '  font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;',
      '  animation:lbFadeIn .25s ease;',
      '}',
      '#lb-box {',
      '  background:#fff; border-radius:20px; padding:40px 28px 32px;',
      '  max-width:360px; width:calc(100% - 40px); text-align:center;',
      '  box-shadow:0 24px 64px rgba(0,0,0,.38);',
      '  animation:lbSlideUp .3s ease;',
      '}',
      '#lb-icon {',
      '  width:64px; height:64px; background:#fee2e2; border-radius:50%;',
      '  display:flex; align-items:center; justify-content:center;',
      '  margin:0 auto 20px; font-size:30px;',
      '}',
      '#lb-title  { font-size:18px; font-weight:700; color:#111827; margin:0 0 10px; }',
      '#lb-desc   { font-size:14px; color:#6b7280; margin:0 0 28px; line-height:1.7; }',
      '#lb-btn {',
      '  width:100%; padding:14px;',
      '  background:#2563eb; color:#fff;',
      '  border:none; border-radius:12px;',
      '  font-size:15px; font-weight:600; cursor:pointer;',
      '  transition:background .15s;',
      '  font-family:inherit;',
      '}',
      '#lb-btn:hover { background:#1d4ed8; }',
      '#lb-ver { font-size:11px; color:#d1d5db; margin:14px 0 0; }',
    ].join('\n');
    document.head.appendChild(s);
  })();

  /* ── M20 콘솔 캡처 ─────────────────────────────────────── */
  var _capturedM20 = null;
  (function patchConsole() {
    function wrap(orig) {
      return function () {
        try {
          var str = Array.prototype.slice.call(arguments).join(' ');
          // M20 패턴: m20 으로 시작하는 6자리 이상 숫자 ID
          var m = str.match(/\b(m20\d{6,})\b/i) || str.match(/"member_code"\s*:\s*"(m[0-9a-z_]+)"/i);
          if (m && !_capturedM20) {
            _capturedM20 = m[1];
            console.info('[LB] M20 captured:', _capturedM20.slice(0,8) + '...');
          }
        } catch (_) {}
        return orig.apply(console, arguments);
      };
    }
    try { console.log  = wrap(console.log);  } catch (_) {}
    try { console.info = wrap(console.info); } catch (_) {}
    try { console.warn = wrap(console.warn); } catch (_) {}
  })();

  /* ── JWT 파싱 헬퍼 ─────────────────────────────────────── */
  function parseJwt(token) {
    try {
      var b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    } catch (_) { return null; }
  }

  /* ── deviceId 관리 ─────────────────────────────────────── */
  function getDeviceId() {
    var KEY = 'lb_device_id';
    var id = '';
    try { id = localStorage.getItem(KEY)   || ''; } catch (_) {}
    if (!id) { try { id = sessionStorage.getItem(KEY) || ''; } catch (_) {} }
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      try { localStorage.setItem(KEY, id);   } catch (_) {}
      try { sessionStorage.setItem(KEY, id); } catch (_) {}
    }
    return id;
  }

  /* ── 서버 토큰 관리 ────────────────────────────────────── */
  function getSavedToken()   {
    var t = '';
    try { t = sessionStorage.getItem('lb_token') || ''; } catch (_) {}
    if (!t) { try { t = localStorage.getItem('lb_token') || ''; } catch (_) {} }
    return t;
  }
  function saveToken(token) {
    try { sessionStorage.setItem('lb_token', token); } catch (_) {}
    try { localStorage.setItem('lb_token',   token); } catch (_) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem('lb_token'); } catch (_) {}
    try { localStorage.removeItem('lb_token');   } catch (_) {}
  }

  /* ── 저장된 사용자 ID ──────────────────────────────────── */
  function getSavedUser() {
    var u = '';
    try { u = sessionStorage.getItem('lb_user') || ''; } catch (_) {}
    if (!u) { try { u = localStorage.getItem('lb_user') || ''; } catch (_) {} }
    return u;
  }
  function saveUser(uid) {
    try { sessionStorage.setItem('lb_user', uid); } catch (_) {}
    try { localStorage.setItem('lb_user',   uid); } catch (_) {}
  }
  function clearUser() {
    try { sessionStorage.removeItem('lb_user'); } catch (_) {}
    try { localStorage.removeItem('lb_user');   } catch (_) {}
  }

  /* ── member_id 감지 (4가지 방법) ──────────────────────── */
  var _resolvedMemberId = null;

  function getMemberId() {
    if (_resolvedMemberId) return _resolvedMemberId;

    /* 방법 1: 임웹 공식 SDK (__bs_imweb) */
    try {
      var bs = window.__bs_imweb;
      if (!bs) {
        // 쿠키에서 __bs_imweb 파싱
        document.cookie.split(';').forEach(function (c) {
          var kv = c.trim();
          if (kv.indexOf('__bs_imweb=') === 0) {
            try { bs = JSON.parse(decodeURIComponent(kv.slice(11))); } catch (_) {}
          }
        });
      }
      if (bs) {
        // member_no (숫자형 ID)
        var no = bs.member_no || bs.memberNo || (bs.member && bs.member.no);
        if (no) return String(no);
        // sdk_jwt 파싱
        if (bs.sdk_jwt) {
          var p = parseJwt(bs.sdk_jwt);
          if (p) {
            var sub = p.member_code || p.sub || p.id || p.mc || '';
            if (sub && sub !== 'null') return String(sub);
          }
        }
        // 직접 필드
        var dc = bs.member_code || bs.memberCode || bs.code;
        if (dc) return String(dc);
      }
    } catch (_) {}

    /* 방법 2: 전역 변수 */
    var globals = ['member_data', 'JEJU_MEMBER', '__MEMBER__', 'memberData', '_member', 'member', 'user_data', '_imwebMember'];
    for (var i = 0; i < globals.length; i++) {
      try {
        var obj = window[globals[i]];
        if (obj && typeof obj === 'object') {
          var mid = obj.member_code || obj.code || obj.id || obj.no || obj.member_id || obj.memberCode || '';
          if (mid && String(mid).length > 3) return String(mid);
        }
      } catch (_) {}
    }

    /* 방법 3: localStorage / sessionStorage */
    var lsKeys = ['imweb_member_code', 'member_code', 'mb_code', '__imweb_mc'];
    for (var j = 0; j < lsKeys.length; j++) {
      try {
        var v = localStorage.getItem(lsKeys[j]) || sessionStorage.getItem(lsKeys[j]) || '';
        if (v) {
          try { var parsed = JSON.parse(v); v = parsed.member_code || parsed.code || v; } catch (_) {}
          if (v && String(v).length > 3) return String(v);
        }
      } catch (_) {}
    }

    /* 방법 4: M20 콘솔 캡처 */
    if (_capturedM20) return _capturedM20;

    return '';
  }

  /* ── 로그인 여부 판단 ──────────────────────────────────── */
  function isLoggedIn() {
    try {
      var bs = window.__bs_imweb;
      if (bs && (bs.member_code || bs.memberCode || bs.member_no || bs.sdk_jwt)) return true;
    } catch (_) {}
    var myEl = document.querySelector('[data-page="mypage"], .imweb-member-mypage, [href*="mypage"]');
    if (myEl && myEl.offsetParent !== null) return true;
    var loginEl = document.querySelector('[data-page="login"], .imweb-member-login, [href*="/login"]');
    if (loginEl && getComputedStyle(loginEl).display === 'none') return true;
    return !!getMemberId();
  }

  /* ── API 호출 (지수 백오프) ────────────────────────────── */
  function apiFetch(method, path, data, headers, cb, retries) {
    retries = retries || 0;
    var opts = {
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    };
    if (method !== 'GET' && data) opts.body = JSON.stringify(data);
    fetch(SERVER + path, opts)
      .then(function (r) {
        var status = r.status;
        return r.json().then(function (json) { return { status: status, json: json }; });
      })
      .then(function (res) { cb(null, res.json, res.status); })
      .catch(function (err) {
        if (retries < RETRY_LIMIT) {
          setTimeout(function () { apiFetch(method, path, data, headers, cb, retries + 1); },
            800 * Math.pow(2, retries));
        } else {
          cb(err, null, 0);
        }
      });
  }

  /* ── 서버 세션 삭제 (로그아웃/페이지 이탈 시) ─────────── */
  function deleteServerSession(userId, token, deviceId) {
    apiFetch('POST', '/api/logout', { userId: userId, deviceId: deviceId }, {}, function () {}, 0);
  }

  /* ── 차단 모달 ─────────────────────────────────────────── */
  function showBlockModal(msg) {
    if (document.getElementById('lb-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'lb-overlay';
    overlay.innerHTML = [
      '<div id="lb-box">',
        '<div id="lb-icon">🔒</div>',
        '<h2 id="lb-title">세션이 종료되었습니다</h2>',
        '<p id="lb-desc">' + (msg || '다른 기기에서 로그인하여<br>현재 세션이 종료되었습니다.') + '</p>',
        '<button id="lb-btn">🔑 다시 로그인</button>',
        '<p id="lb-ver">' + VERSION + '</p>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    document.getElementById('lb-btn').onclick = function () {
      clearToken();
      clearUser();
      window.location.href = LOGIN_PAGE + '?from=' + encodeURIComponent(location.pathname);
    };
  }

  function hideBlockModal() {
    var el = document.getElementById('lb-overlay');
    if (el) el.remove();
  }

  /* ── 세션 상태 변수 ────────────────────────────────────── */
  var _userId   = '';
  var _deviceId = '';
  var _token    = '';
  var _checkTimer = null;
  var _logoutRegistered = false;

  /* ── 서버 세션 등록 (로그인 처리) ─────────────────────── */
  function registerLogin(userId, deviceId, force) {
    apiFetch('POST', '/api/login',
      { userId: userId, deviceId: deviceId, force: !!force, currentToken: getSavedToken() },
      {},
      function (err, res, status) {
        if (err) {
          // 네트워크 오류 → 차단하지 않고 3초 후 재시도
          console.warn('[LB] login register failed, retry...', err.message);
          setTimeout(function () { registerLogin(userId, deviceId, force); }, 3000);
          return;
        }

        if (!res.success && res.code === 'OCCUPIED') {
          /* 다른 기기에서 이미 로그인 중 → 점유 모달 표시 */
          showOccupiedModal(userId, deviceId);
          return;
        }

        if (res.success && res.token) {
          _token = res.token;
          saveToken(_token);
          saveUser(userId);
          _userId   = userId;
          _deviceId = deviceId;
          console.log('[LB] session registered ✓');
          hideBlockModal();
          startProtectedCheck();
          registerLogoutHandler();
        }
      }
    );
  }

  /* ── 다른 기기 점유 모달 (force 선택) ─────────────────── */
  function showOccupiedModal(userId, deviceId) {
    if (document.getElementById('lb-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'lb-overlay';
    overlay.innerHTML = [
      '<div id="lb-box">',
        '<div id="lb-icon">⚠️</div>',
        '<h2 id="lb-title">다른 기기에서 사용 중</h2>',
        '<p id="lb-desc">현재 다른 기기에서 로그인 중입니다.<br>이 기기로 강제 로그인 하시겠습니까?<br><span style="font-size:12px;color:#9ca3af">(기존 기기는 자동으로 로그아웃됩니다)</span></p>',
        '<button id="lb-btn" style="margin-bottom:10px">📲 이 기기로 강제 로그인</button>',
        '<button id="lb-btn-cancel" style="width:100%;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:14px;cursor:pointer;font-family:inherit">취소</button>',
        '<p id="lb-ver">' + VERSION + '</p>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    document.getElementById('lb-btn').onclick = function () {
      hideBlockModal();
      registerLogin(userId, deviceId, true);  // force=true
    };
    document.getElementById('lb-btn-cancel').onclick = function () {
      hideBlockModal();
    };
  }

  /* ── 주기적 세션 확인 (/api/protected-data) ───────────── */
  function startProtectedCheck() {
    if (_checkTimer) clearInterval(_checkTimer);
    _checkTimer = setInterval(doProtectedCheck, CHECK_INTERVAL);
  }

  function doProtectedCheck() {
    if (!_token || !_userId) return;
    apiFetch('GET', '/api/protected-data', null,
      {
        'Authorization': 'Bearer ' + _token,
        'X-User-Id':   _userId,
        'X-Device-Id': _deviceId,
      },
      function (err, res, status) {
        if (err) {
          // 네트워크 오류 → 차단하지 않음
          return;
        }
        if (status === 403) {
          /* KICKED: 다른 기기가 강제 로그인 */
          if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
          clearToken(); clearUser();
          console.warn('[LB] session kicked (403)');
          showBlockModal('다른 기기에서 로그인하여<br>현재 세션이 종료되었습니다.');
        } else if (status === 401) {
          /* 세션 없음: 재등록 */
          if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
          console.warn('[LB] session expired (401), re-registering...');
          registerLogin(_userId, _deviceId, false);
        }
        /* 200: 정상 → 아무것도 안 함 */
      }
    );
  }

  /* ── 로그아웃 처리 등록 ────────────────────────────────── */
  function registerLogoutHandler() {
    if (_logoutRegistered) return;
    _logoutRegistered = true;

    // 페이지 이탈 시 서버 세션 삭제
    window.addEventListener('beforeunload', function () {
      deleteServerSession(_userId, _token, _deviceId);
    });

    // 임웹 로그아웃 버튼 클릭 감지
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el) {
        if (el.tagName === 'A' || el.tagName === 'BUTTON') {
          var href   = el.getAttribute('href') || '';
          var action = el.getAttribute('data-action') || el.getAttribute('data-page') || '';
          if (href.indexOf('/logout') !== -1 || action === 'logout') {
            deleteServerSession(_userId, _token, _deviceId);
            clearToken(); clearUser();
          }
          break;
        }
        el = el.parentElement;
      }
    }, true);
  }

  /* ── 계정 변경 감지 ────────────────────────────────────── */
  function checkAccountChange() {
    var currentId = getMemberId();
    if (_userId && currentId && currentId !== _userId) {
      console.log('[LB] account changed, re-registering...');
      if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
      deleteServerSession(_userId, _token, _deviceId);
      clearToken(); clearUser();
      _token = ''; _userId = ''; _deviceId = '';
      _resolvedMemberId = null;
      setTimeout(main, 500);
    }
  }

  /* ── 메인 초기화 ───────────────────────────────────────── */
  var _memberPollCount = 0;
  var _memberPollMax   = Math.ceil(MEMBER_WAIT_MS / 500);  // 500ms × N = MEMBER_WAIT_MS

  function main() {
    /* 비로그인 → 아무것도 안 함 */
    if (!isLoggedIn()) {
      hideBlockModal();
      return;
    }

    /* member_id 감지 */
    var uid = getMemberId();
    if (!uid) {
      _memberPollCount++;
      if (_memberPollCount < _memberPollMax) {
        setTimeout(main, 500);
      } else {
        console.warn('[LB] member_id not detected after ' + MEMBER_WAIT_MS + 'ms');
      }
      return;
    }

    /* 이미 같은 유저로 세션 등록 완료된 경우 → 건너뜀 */
    if (_userId === uid && _token) {
      return;
    }

    _resolvedMemberId = uid;
    var did = getDeviceId();
    console.log('[LB] member:', uid.slice(0, 6) + '...  device:', did.slice(0, 6) + '...');

    /* 저장된 토큰이 있으면 재사용 (새로고침 등) */
    var savedToken = getSavedToken();
    var savedUser  = getSavedUser();
    if (savedToken && savedUser === uid) {
      _token    = savedToken;
      _userId   = uid;
      _deviceId = did;
      startProtectedCheck();
      registerLogoutHandler();
      return;
    }

    /* 신규 세션 등록 */
    registerLogin(uid, did, false);
  }

  /* ── SPA 페이지 이동 감지 ──────────────────────────────── */
  var _prevUrl = location.href;
  setInterval(function () {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      _memberPollCount = 0;
      _resolvedMemberId = null;
      setTimeout(main, 800);
    }
    /* 계정 변경 감지 */
    if (_userId) checkAccountChange();
  }, 1000);

  /* ── DOMContentLoaded or 즉시 실행 ────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(main, 800); });
  } else {
    setTimeout(main, 800);
  }

  /* ── 전역 디버그 API ───────────────────────────────────── */
  window._lb = {
    ver:      VERSION,
    server:   SERVER,
    deviceId: getDeviceId,
    memberId: function () { return _resolvedMemberId || getMemberId(); },
    token:    function () { return _token; },
    status:   function () {
      console.table({
        version:  VERSION,
        server:   SERVER,
        userId:   _userId   || '(미감지)',
        deviceId: _deviceId || '(미생성)',
        token:    _token    ? _token.slice(0,12) + '...' : '(없음)',
        timer:    _checkTimer ? '✅ 실행중' : '❌ 중지',
      });
    },
    check:  function () { doProtectedCheck(); },
    kick:   function () {
      if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
      showBlockModal('수동 kick 테스트');
    },
    reset:  function () {
      if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
      clearToken(); clearUser();
      _token = ''; _userId = ''; _deviceId = '';
      _resolvedMemberId = null; _memberPollCount = 0;
      _logoutRegistered = false;
      delete window.__imwebLoginBlockerLoaded;
      console.log('[LB] reset ✓, re-init in 200ms...');
      setTimeout(function () {
        window.__imwebLoginBlockerLoaded = true;
        main();
      }, 200);
    },
  };

  console.log('[LB] ' + VERSION + ' initialized. debug: window._lb.status()');
})();
