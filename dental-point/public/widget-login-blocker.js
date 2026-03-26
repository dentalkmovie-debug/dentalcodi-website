/* ============================================================
   아임웹 동시접속 차단 위젯 v24.13
   dental-point.pages.dev 통합
   ============================================================ */
(function () {
  'use strict';

  if (window.__lbLoaded) return;
  window.__lbLoaded = true;

  var VER        = 'v24.13';
  var SERVER     = 'https://dental-point.pages.dev';
  var LOGIN_URL  = 'https://impiantpoint.imweb.me/login';
  var INTERVAL   = 5000;   // 5초마다 체크
  var MAX_WAIT   = 15000;  // member_id 최대 15초 대기
  var RETRY      = 3;

  console.log('[LB] ' + VER + ' start');

  /* ═══════════════════════════════════════════
     1. member_id 감지 — 임웹 실제 환경 기준
     임웹은 로그인한 회원의 정보를 여러 곳에 노출:
     (a) window.__bs_imweb.sdk_jwt (JWT)
     (b) window.__bs_imweb.member_no
     (c) 쿠키 imweb_member_no 또는 mb_code
     (d) console.log M20 패턴 캡처
     (e) 임웹 테마 전역 변수
  ═══════════════════════════════════════════ */
  var _mid = '';   // 확정된 member_id
  var _m20 = '';   // 콘솔 캡처값

  /* ─ 콘솔 M20 캡처 (스크립트 로드 즉시 실행) ─ */
  (function () {
    var _wrap = function (orig) {
      return function () {
        try {
          var s = [].slice.call(arguments).join(' ');
          /* m20 + 숫자 6자리 이상 패턴 */
          var m = s.match(/\bm20(\d{6,})\b/i);
          if (m && !_m20) {
            _m20 = 'm20' + m[1];
            console.info('[LB] M20 감지:', _m20.slice(0, 9) + '***');
          }
          /* "member_code":"xxx" JSON 패턴 */
          var m2 = s.match(/"member_code"\s*:\s*"([^"]{4,})"/);
          if (m2 && !_m20) _m20 = m2[1];
        } catch (_) {}
        return orig.apply(this, arguments);
      };
    };
    try { console.log  = _wrap(console.log);  } catch (_) {}
    try { console.info = _wrap(console.info); } catch (_) {}
    try { console.warn = _wrap(console.warn); } catch (_) {}
    try { console.debug = _wrap(console.debug); } catch (_) {}
  })();

  /* ─ JWT 파싱 ─ */
  function _jwt(t) {
    try {
      return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) { return null; }
  }

  /* ─ 쿠키 읽기 ─ */
  function _cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ─ member_id 추출 ─ */
  function getMid() {
    if (_mid) return _mid;

    /* ① window.__bs_imweb (임웹 공식 SDK) */
    try {
      var bs = window.__bs_imweb || {};

      // sdk_jwt 파싱
      if (bs.sdk_jwt) {
        var p = _jwt(bs.sdk_jwt);
        if (p) {
          var v = p.member_code || p.sub || p.mc || p.id || '';
          if (v && v !== 'null' && v.length > 2) return v + '';
        }
      }
      // member_no / memberNo
      var no = bs.member_no || bs.memberNo || (bs.member && bs.member.no) || '';
      if (no) return no + '';

      // member_code 직접
      var mc = bs.member_code || bs.memberCode || bs.code || '';
      if (mc) return mc + '';
    } catch (_) {}

    /* ② 쿠키 */
    var ck = _cookie('imweb_member_no') || _cookie('member_no') ||
             _cookie('mb_code') || _cookie('imweb_mc') || _cookie('member_code');
    if (ck && ck.length > 2) return ck;

    /* ③ localStorage / sessionStorage */
    var lsKeys = ['imweb_member_no', 'member_no', 'imweb_member_code',
                  'member_code', 'mb_code', '__imweb_mc', 'imweb_user'];
    for (var i = 0; i < lsKeys.length; i++) {
      try {
        var raw = localStorage.getItem(lsKeys[i]) || sessionStorage.getItem(lsKeys[i]) || '';
        if (raw) {
          // JSON인 경우 파싱
          try {
            var obj = JSON.parse(raw);
            var cv  = obj.member_code || obj.member_no || obj.code || obj.no || obj.id || '';
            if (cv && cv + '' !== 'null' && (cv + '').length > 2) return cv + '';
          } catch (_) {}
          if (raw.length > 2 && raw !== 'null' && raw !== 'undefined') return raw;
        }
      } catch (_) {}
    }

    /* ④ 전역 변수 */
    var gvars = ['member_data', '__MEMBER__', 'memberData', '_member',
                 'JEJU_MEMBER', 'user_data', '_imwebMember', 'imwebMember'];
    for (var g = 0; g < gvars.length; g++) {
      try {
        var o = window[gvars[g]];
        if (o && typeof o === 'object') {
          var fv = o.member_code || o.member_no || o.code || o.no ||
                   o.id || o.member_id || o.memberCode || '';
          if (fv && (fv + '').length > 2) return fv + '';
        }
      } catch (_) {}
    }

    /* ⑤ M20 콘솔 캡처 */
    if (_m20) return _m20;

    /* ⑥ 임웹 DOM에서 회원 관련 숨긴 필드 탐색 */
    try {
      var els = document.querySelectorAll(
        '[data-member-code],[data-member-no],[data-member-id],[data-mb-code]'
      );
      for (var e = 0; e < els.length; e++) {
        var dv = els[e].getAttribute('data-member-code') ||
                 els[e].getAttribute('data-member-no')   ||
                 els[e].getAttribute('data-member-id')   ||
                 els[e].getAttribute('data-mb-code') || '';
        if (dv && dv.length > 2) return dv;
      }
    } catch (_) {}

    return '';
  }

  /* ─ 로그인 여부 (느슨하게 판단) ─ */
  function isLoggedIn() {
    /* SDK 존재 + 값 있음 */
    try {
      var bs = window.__bs_imweb || {};
      if (bs.member_no || bs.memberNo || bs.sdk_jwt || bs.member_code) return true;
    } catch (_) {}

    /* 쿠키에 member 관련 키 있음 */
    if (_cookie('imweb_member_no') || _cookie('member_no') ||
        _cookie('mb_code') || _cookie('imweb_session')) return true;

    /* member_id 감지 성공 */
    if (getMid()) return true;

    /* DOM: 로그아웃 버튼 있으면 로그인 상태 */
    if (document.querySelector(
      '[data-page="logout"],[data-action="logout"],.imweb-member-logout,[href*="logout"]'
    )) return true;

    /* DOM: 마이페이지 링크 보이면 로그인 상태 */
    var my = document.querySelector(
      '[data-page="mypage"],.imweb-member-mypage,[href*="mypage"]'
    );
    if (my && my.offsetParent !== null) return true;

    return false;
  }

  /* ═══════════════════════════════════════════
     2. DeviceId / Token / User 저장
  ═══════════════════════════════════════════ */
  function _ls(method, key, val) {
    try { return localStorage[method](key, val); } catch (_) {}
    try { return sessionStorage[method](key, val); } catch (_) {}
  }

  function getDeviceId() {
    var KEY = 'lb_did';
    var id  = _ls('getItem', KEY) || '';
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      _ls('setItem', KEY, id);
      try { localStorage.setItem(KEY, id);   } catch (_) {}
      try { sessionStorage.setItem(KEY, id); } catch (_) {}
    }
    return id;
  }

  function getToken()    { return _ls('getItem', 'lb_tok') || ''; }
  function saveToken(v)  { _ls('setItem', 'lb_tok', v); try{localStorage.setItem('lb_tok',v);}catch(_){} }
  function clearToken()  { _ls('removeItem', 'lb_tok'); try{localStorage.removeItem('lb_tok');}catch(_){} }
  function getUser()     { return _ls('getItem', 'lb_uid') || ''; }
  function saveUser(v)   { _ls('setItem', 'lb_uid', v); try{localStorage.setItem('lb_uid',v);}catch(_){} }
  function clearUser()   { _ls('removeItem', 'lb_uid'); try{localStorage.removeItem('lb_uid');}catch(_){} }

  /* ═══════════════════════════════════════════
     3. API
  ═══════════════════════════════════════════ */
  function api(method, path, data, hdrs, cb, retry) {
    retry = retry || 0;
    var opts = {
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, hdrs || {}),
    };
    if (method !== 'GET' && data) opts.body = JSON.stringify(data);
    fetch(SERVER + path, opts)
      .then(function (r) {
        var st = r.status;
        return r.json().then(function (j) { return { s: st, j: j }; });
      })
      .then(function (res) { cb(null, res.j, res.s); })
      .catch(function (err) {
        if (retry < RETRY) {
          setTimeout(function () { api(method, path, data, hdrs, cb, retry + 1); },
            1000 * Math.pow(2, retry));
        } else {
          cb(err, null, 0);
        }
      });
  }

  function doLogout(uid, tok, did) {
    api('POST', '/api/logout', { userId: uid, deviceId: did }, {}, function () {});
  }

  /* ═══════════════════════════════════════════
     4. 모달
  ═══════════════════════════════════════════ */
  function _overlay(html) {
    var old = document.getElementById('__lb_ov');
    if (old) old.remove();

    var d = document.createElement('div');
    d.id = '__lb_ov';
    /* inline style + !important 이중 적용 */
    d.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:2147483647', 'background:rgba(0,0,0,.75)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif',
      'box-sizing:border-box', 'margin:0', 'padding:0',
    ].join('!important;') + '!important';

    d.innerHTML = html;
    (document.body || document.documentElement).appendChild(d);
    return d;
  }

  /* 스타일 공통 */
  var BOX  = 'style="background:#fff;border-radius:18px;padding:36px 24px 28px;' +
             'max-width:340px;width:calc(100% - 32px);text-align:center;' +
             'box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;box-sizing:border-box;"';
  var BTN  = 'style="width:100%;padding:13px;background:#2563eb;color:#fff;' +
             'border:none;border-radius:10px;font-size:15px;font-weight:700;' +
             'cursor:pointer;display:block;box-sizing:border-box;font-family:inherit;"';
  var BTN2 = 'style="width:100%;padding:11px;background:#f3f4f6;color:#374151;' +
             'border:none;border-radius:10px;font-size:14px;cursor:pointer;' +
             'display:block;margin-top:8px;box-sizing:border-box;font-family:inherit;"';
  var ICN  = 'style="width:60px;height:60px;border-radius:50%;display:flex;' +
             'align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;"';

  function showKicked(reason) {
    var ov = _overlay(
      '<div ' + BOX + '>' +
        '<div ' + ICN + ' style="background:#fee2e2">🔒</div>' +
        '<h3 style="font-size:17px;font-weight:700;color:#111;margin:0 0 8px;">세션이 종료되었습니다</h3>' +
        '<p style="font-size:13px;color:#6b7280;margin:0 0 22px;line-height:1.6;">' +
          '다른 기기에서 로그인하여<br>현재 세션이 종료되었습니다.' +
        '</p>' +
        '<button id="__lb_ok" ' + BTN + '>🔑 다시 로그인</button>' +
        '<p style="font-size:11px;color:#ccc;margin:10px 0 0;">' + VER + '</p>' +
      '</div>'
    );
    document.getElementById('__lb_ok').onclick = function () {
      clearToken(); clearUser();
      location.href = LOGIN_URL + '?from=' + encodeURIComponent(location.pathname);
    };
  }

  function showOccupied(uid, did) {
    var ov = _overlay(
      '<div ' + BOX + '>' +
        '<div ' + ICN + ' style="background:#fef3c7">⚠️</div>' +
        '<h3 style="font-size:17px;font-weight:700;color:#111;margin:0 0 8px;">다른 기기에서 사용 중</h3>' +
        '<p style="font-size:13px;color:#6b7280;margin:0 0 20px;line-height:1.6;">' +
          '현재 다른 기기에서 접속 중입니다.<br>' +
          '이 기기로 강제 로그인 하시겠습니까?<br>' +
          '<span style="font-size:11px;color:#9ca3af;">(기존 기기는 자동 로그아웃됩니다)</span>' +
        '</p>' +
        '<button id="__lb_force" ' + BTN + '>📲 이 기기로 강제 로그인</button>' +
        '<button id="__lb_cancel" ' + BTN2 + '>취소</button>' +
        '<p style="font-size:11px;color:#ccc;margin:10px 0 0;">' + VER + '</p>' +
      '</div>'
    );
    document.getElementById('__lb_force').onclick = function () {
      hideModal();
      doLogin(uid, did, true);
    };
    document.getElementById('__lb_cancel').onclick = hideModal;
  }

  function hideModal() {
    var el = document.getElementById('__lb_ov');
    if (el) el.remove();
  }

  /* ═══════════════════════════════════════════
     5. 세션 관리
  ═══════════════════════════════════════════ */
  var _uid   = '';
  var _did   = '';
  var _tok   = '';
  var _timer = null;
  var _regOk = false;

  function doLogin(uid, did, force) {
    api('POST', '/api/login',
      { userId: uid, deviceId: did, force: !!force, currentToken: getToken() },
      {},
      function (err, res, st) {
        if (err) {
          /* 네트워크 오류 → 3초 후 재시도 (차단 안 함) */
          console.warn('[LB] login api error, retry in 3s');
          setTimeout(function () { doLogin(uid, did, force); }, 3000);
          return;
        }
        if (!res.success && res.code === 'OCCUPIED') {
          showOccupied(uid, did);
          return;
        }
        if (res.success && res.token) {
          _tok = res.token;
          _uid = uid;
          _did = did;
          saveToken(_tok);
          saveUser(uid);
          hideModal();
          startCheck();
          if (!_regOk) { regLogout(); _regOk = true; }
          console.log('[LB] 세션 등록 완료 ✓ uid=' + uid.slice(0, 6) + '***');
        }
      }
    );
  }

  function startCheck() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(doCheck, INTERVAL);
  }

  function doCheck() {
    if (!_tok || !_uid) return;
    api('GET', '/api/protected-data', null,
      { Authorization: 'Bearer ' + _tok, 'X-User-Id': _uid, 'X-Device-Id': _did },
      function (err, res, st) {
        if (err) return; /* 네트워크 오류 → 차단 안 함 */
        if (st === 403) {
          clearInterval(_timer); _timer = null;
          clearToken(); clearUser();
          console.warn('[LB] kicked (403)');
          showKicked('kicked');
        } else if (st === 401) {
          clearInterval(_timer); _timer = null;
          console.warn('[LB] session expired (401), re-login');
          doLogin(_uid, _did, false);
        }
        /* 200 → 정상 */
      }
    );
  }

  function regLogout() {
    window.addEventListener('beforeunload', function () {
      doLogout(_uid, _tok, _did);
    });
    document.addEventListener('click', function (e) {
      var el = e.target;
      for (var i = 0; i < 4 && el; i++, el = el.parentElement) {
        var href   = el.getAttribute && el.getAttribute('href')        || '';
        var action = el.getAttribute && el.getAttribute('data-action') || '';
        var page   = el.getAttribute && el.getAttribute('data-page')   || '';
        if (href.indexOf('logout') > -1 || action === 'logout' || page === 'logout') {
          doLogout(_uid, _tok, _did);
          clearToken(); clearUser();
          break;
        }
      }
    }, true);
  }

  /* ═══════════════════════════════════════════
     6. 초기화 (폴링 방식, 최대 MAX_WAIT 대기)
  ═══════════════════════════════════════════ */
  var _pollN = 0;
  var _pollMax = Math.ceil(MAX_WAIT / 500);
  var _started = false;

  function tryStart() {
    if (_started) return;

    /* 비로그인 → 대기 or 포기 */
    if (!isLoggedIn()) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, 500);
      } else {
        console.log('[LB] 비로그인 상태 확인 — 차단 비활성');
      }
      return;
    }

    var uid = getMid();
    if (!uid) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, 500);
      } else {
        console.warn('[LB] member_id 미감지 (' + MAX_WAIT + 'ms 초과)');
        /* ── 최후 수단: member_id 없이도 deviceId 기반으로 차단 ── */
        uid = 'ANON_' + getDeviceId();
        console.warn('[LB] fallback uid:', uid);
      }
      if (!uid) return;
    }

    _started = true;
    _mid = uid;
    var did = getDeviceId();
    console.log('[LB] 초기화 uid=' + uid.slice(0, 6) + '*** did=' + did.slice(0, 5) + '***');

    /* 이미 토큰 있으면 재사용 */
    var savedTok  = getToken();
    var savedUser = getUser();
    if (savedTok && savedUser === uid) {
      _tok = savedTok; _uid = uid; _did = did;
      startCheck();
      if (!_regOk) { regLogout(); _regOk = true; }
      return;
    }
    doLogin(uid, did, false);
  }

  /* SPA 페이지 이동 감지 */
  var _prevUrl = location.href;
  setInterval(function () {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      _pollN   = 0;
      _started = false;
      _mid     = '';
      setTimeout(tryStart, 1000);
    }
    /* 계정 변경 감지 */
    if (_uid) {
      var cur = getMid();
      if (cur && cur !== _uid) {
        console.log('[LB] 계정 변경 감지, 재초기화');
        if (_timer) clearInterval(_timer);
        doLogout(_uid, _tok, _did);
        clearToken(); clearUser();
        _tok = ''; _uid = ''; _did = ''; _started = false; _mid = ''; _pollN = 0;
        setTimeout(tryStart, 500);
      }
    }
  }, 1500);

  /* 진입점 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tryStart, 1000); });
  } else {
    setTimeout(tryStart, 1000);
  }

  /* ═══════════════════════════════════════════
     7. 전역 디버그 API
  ═══════════════════════════════════════════ */
  window._lb = {
    ver: VER,
    status: function () {
      console.table({
        ver:      VER,
        uid:      _uid    || '(없음)',
        did:      _did    || '(없음)',
        token:    _tok    ? _tok.slice(0, 10) + '...' : '(없음)',
        timer:    _timer  ? '✅ 실행중' : '❌ 정지',
        isLogin:  isLoggedIn(),
        detectedMid: getMid() || '(미감지)',
        m20cap:   _m20    || '(없음)',
      });
    },
    mid:    function () { return getMid(); },
    did:    function () { return getDeviceId(); },
    tok:    function () { return _tok; },
    check:  function () { doCheck(); },
    kick:   function () { if (_timer) clearInterval(_timer); showKicked('test'); },
    reset:  function () {
      if (_timer) clearInterval(_timer);
      clearToken(); clearUser();
      _tok = ''; _uid = ''; _did = ''; _mid = ''; _m20 = '';
      _started = false; _pollN = 0; _regOk = false; _timer = null;
      delete window.__lbLoaded;
      console.log('[LB] reset → re-init...');
      setTimeout(function () { window.__lbLoaded = true; tryStart(); }, 200);
    },
    /* 진단: 임웹 SDK 전체 dump */
    dump: function () {
      console.log('__bs_imweb:', window.__bs_imweb);
      console.log('cookies:', document.cookie);
      console.log('lb_uid:', getUser(), '| lb_tok:', getToken() ? 'exists' : 'none');
      console.log('getMid():', getMid());
      console.log('isLoggedIn():', isLoggedIn());
    },
  };

  console.log('[LB] ' + VER + ' ready — 진단: window._lb.dump()');
})();
