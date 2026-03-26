/* ============================================================
   동시접속 차단 위젯 v24.12
   임웹 푸터에 삽입하는 독립 스크립트
   
   변경 이력:
   v24.12 - API 서버를 dental-point.pages.dev로 통합
            콘솔 M20 패턴 캡처 범위 확대
   v24.6  - deviceId 처리 강화 (기기 고유 식별)
   v24.2  - JWT 파싱으로 member_id 추출 개선
   v24.1  - 세션스토리지 + localStorage 이중 저장
   v24    - 초기 배포: 동시접속 차단 기본 기능
   ============================================================ */
(function() {
  'use strict';

  var _BLK_VER = 'v24.12';
  var API = 'https://dental-point.pages.dev';
  var LOGIN_URL = 'https://impiantpoint.imweb.me/login';
  var CHECK_INTERVAL = 30000;   // 30초마다 세션 확인
  var RETRY_LIMIT = 3;          // API 실패 시 최대 재시도 횟수

  console.log('[LoginBlocker] ' + _BLK_VER + ' loaded');

  /* ===== 디바이스 ID (기기 고유 식별자) ===== */
  function getDeviceId() {
    var key = 'lb_device_id';
    var id = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(key, id); } catch(e) {}
      try { sessionStorage.setItem(key, id); } catch(e) {}
    }
    return id;
  }

  /* ===== 세션 토큰 저장/조회 ===== */
  function getSessionToken() {
    return sessionStorage.getItem('lb_session_token') || localStorage.getItem('lb_session_token') || '';
  }
  function setSessionToken(token) {
    try { sessionStorage.setItem('lb_session_token', token); } catch(e) {}
    try { localStorage.setItem('lb_session_token', token); } catch(e) {}
  }

  /* ===== member_id 추출 ===== */
  // 방법1: 임웹 SDK JWT 파싱
  // 방법2: 콘솔 M20 패턴 감지
  // 방법3: localStorage/cookie 조회
  var _resolvedMemberId = null;

  function parseMemberIdFromJWT(jwt) {
    try {
      if (!jwt || typeof jwt !== 'string') return null;
      var parts = jwt.split('.');
      if (parts.length < 2) return null;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      // 임웹 JWT 구조: member_code 또는 sub 필드
      return payload.member_code || payload.sub || payload.id || null;
    } catch(e) { return null; }
  }

  function getMemberIdFromSDK() {
    try {
      var bs = window.__bs_imweb;
      if (!bs) return null;
      // SDK jwt
      if (bs.sdk_jwt) {
        var id = parseMemberIdFromJWT(bs.sdk_jwt);
        if (id) return id;
      }
      // 직접 member_code
      if (bs.member_code) return bs.member_code;
      if (bs.memberCode) return bs.memberCode;
    } catch(e) {}
    return null;
  }

  function getMemberIdFromCookie() {
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        // 임웹 쿠키: imweb_member_id, member_id 등
        if (c.indexOf('imweb_member') !== -1 || c.indexOf('member_code') !== -1) {
          var val = c.split('=')[1];
          if (val && val.startsWith('m20')) return val.trim();
        }
      }
    } catch(e) {}
    return null;
  }

  function getMemberIdFromStorage() {
    try {
      // 임웹이 localStorage에 저장하는 패턴 조회
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        var v = localStorage.getItem(k);
        if (v && v.startsWith && v.startsWith('m20') && v.length > 6 && v.length < 30) return v;
        // JSON 값에서 member_code 추출
        if (v && v.indexOf('member_code') !== -1) {
          try {
            var obj = JSON.parse(v);
            var mc = obj.member_code || obj.memberCode || (obj.member && obj.member.member_code);
            if (mc && mc.startsWith('m20')) return mc;
          } catch(e) {}
        }
      }
    } catch(e) {}
    return null;
  }

  /* ===== M20 콘솔 패턴 캡처 ===== */
  // 임웹이 console에 출력하는 회원 코드 패턴을 가로챔
  var _origConsoleLog = console.log;
  var _origConsoleInfo = console.info;
  var _capturedM20 = null;

  function interceptConsole(fn, name) {
    return function() {
      try {
        var args = Array.prototype.slice.call(arguments);
        var str = args.join(' ');
        // M20 패턴: m2024XXXXXXXX 형태
        var match = str.match(/\b(m20\d{8,})\b/);
        if (match) {
          _capturedM20 = match[1];
          if (!_resolvedMemberId) {
            _resolvedMemberId = _capturedM20;
          }
        }
      } catch(e) {}
      return fn.apply(console, arguments);
    };
  }

  try {
    console.log = interceptConsole(_origConsoleLog, 'log');
    console.info = interceptConsole(_origConsoleInfo, 'info');
  } catch(e) {}

  /* ===== 전체 member_id 조회 ===== */
  function resolveMemberId() {
    if (_resolvedMemberId) return _resolvedMemberId;
    var id = getMemberIdFromSDK()
      || _capturedM20
      || getMemberIdFromCookie()
      || getMemberIdFromStorage();
    if (id) _resolvedMemberId = id;
    return id;
  }

  /* ===== 로그인 여부 확인 ===== */
  function isLoggedIn() {
    // 임웹 로그인 상태 감지
    try {
      if (window.__bs_imweb && window.__bs_imweb.member_code) return true;
      if (window.__bs_imweb && window.__bs_imweb.sdk_jwt) return true;
    } catch(e) {}
    // 로그인 버튼/마이페이지 요소로 판단
    var loginBtn = document.querySelector('[data-page="login"]') || document.querySelector('.imweb-member-login');
    var myBtn = document.querySelector('[data-page="mypage"]') || document.querySelector('.imweb-member-mypage');
    if (myBtn && myBtn.style.display !== 'none') return true;
    if (loginBtn && loginBtn.style.display !== 'none') return false;
    // member_id가 있으면 로그인 상태
    return !!resolveMemberId();
  }

  /* ===== API 호출 (재시도 포함) ===== */
  function apiCall(path, data, retries, cb) {
    retries = retries || 0;
    fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(r) { return r.json(); })
    .then(function(res) { cb(null, res); })
    .catch(function(err) {
      if (retries < RETRY_LIMIT) {
        setTimeout(function() { apiCall(path, data, retries + 1, cb); }, 1000 * (retries + 1));
      } else {
        cb(err, null);
      }
    });
  }

  /* ===== 차단 모달 UI ===== */
  function showBlockModal(reason) {
    // 이미 표시 중이면 스킵
    if (document.getElementById('lb-block-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'lb-block-modal';
    modal.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
      'background:rgba(0,0,0,0.75)', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,Noto Sans KR,sans-serif'
    ].join(';');

    var reasonText = reason === 'kicked'
      ? '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.'
      : '동시 접속이 감지되었습니다. 보안을 위해 재로그인이 필요합니다.';

    modal.innerHTML = [
      '<div style="background:#fff;border-radius:16px;padding:32px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">',
        '<div style="width:56px;height:56px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px">🔒</div>',
        '<h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px">세션 종료</h2>',
        '<p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">' + reasonText + '</p>',
        '<button id="lb-relogin-btn" style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer">다시 로그인</button>',
        '<p style="font-size:11px;color:#9ca3af;margin:12px 0 0">' + _BLK_VER + '</p>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    document.getElementById('lb-relogin-btn').addEventListener('click', function() {
      // 세션 토큰 초기화
      try { sessionStorage.removeItem('lb_session_token'); } catch(e) {}
      try { localStorage.removeItem('lb_session_token'); } catch(e) {}
      try { sessionStorage.removeItem('lb_device_id'); } catch(e) {}
      window.location.href = LOGIN_URL;
    });
  }

  function removeBlockModal() {
    var m = document.getElementById('lb-block-modal');
    if (m) m.remove();
  }

  /* ===== 세션 등록 ===== */
  function registerSession(memberId) {
    var deviceId = getDeviceId();
    var token = 'ST' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    setSessionToken(token);

    apiCall('/api/session/register', {
      member_id: memberId,
      device_id: deviceId,
      session_token: token,
      ip_addr: '',
      user_agent: navigator.userAgent.slice(0, 200)
    }, 0, function(err, res) {
      if (err) {
        console.warn('[LoginBlocker] register failed:', err);
        return;
      }
      console.log('[LoginBlocker] session registered, expires:', res && res.expires_at);
    });
  }

  /* ===== 세션 유효성 주기적 확인 ===== */
  var _checkTimer = null;

  function startSessionCheck(memberId) {
    if (_checkTimer) clearInterval(_checkTimer);
    _checkTimer = setInterval(function() {
      checkSession(memberId);
    }, CHECK_INTERVAL);
  }

  function checkSession(memberId) {
    var deviceId = getDeviceId();
    var token = getSessionToken();

    apiCall('/api/session/check', {
      member_id: memberId,
      device_id: deviceId,
      session_token: token
    }, 0, function(err, res) {
      if (err) {
        // 네트워크 오류 시 차단하지 않음 (서비스 연속성 우선)
        console.warn('[LoginBlocker] check failed (network):', err);
        return;
      }
      if (!res) return;
      if (res.valid === false) {
        // 다른 기기에서 로그인 → 현재 세션 차단
        console.warn('[LoginBlocker] session invalid, reason:', res.reason);
        if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
        showBlockModal(res.reason || 'kicked');
      } else {
        // 정상 세션
        removeBlockModal();
      }
    });
  }

  /* ===== 초기화 ===== */
  function init() {
    // 로그인 상태가 아니면 스킵
    if (!isLoggedIn()) {
      // 로그인 페이지에서는 기존 차단 모달 제거
      removeBlockModal();
      return;
    }

    var memberId = resolveMemberId();
    if (!memberId) {
      // member_id를 아직 모름 → 잠시 후 재시도
      setTimeout(init, 2000);
      return;
    }

    console.log('[LoginBlocker] member detected:', memberId.slice(0, 6) + '...');

    // 세션 등록
    registerSession(memberId);

    // 주기적 확인 시작
    startSessionCheck(memberId);
  }

  /* ===== 페이지 로드 완료 후 실행 ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 500); // 임웹 SDK 초기화 대기
    });
  } else {
    setTimeout(init, 500);
  }

  /* ===== 페이지 이동 감지 (SPA) ===== */
  var _lastHref = location.href;
  setInterval(function() {
    if (location.href !== _lastHref) {
      _lastHref = location.href;
      setTimeout(init, 500);
    }
  }, 1000);

  /* ===== 전역 노출 (외부 제어용) ===== */
  window._loginBlocker = {
    version: _BLK_VER,
    getDeviceId: getDeviceId,
    getMemberId: resolveMemberId,
    checkNow: function() {
      var mid = resolveMemberId();
      if (mid) checkSession(mid);
    },
    kick: function() {
      if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
      showBlockModal('kicked');
    }
  };

})();
