/* ============================================================
   아임웹 동시접속 차단 스크립트 v24.14
   ============================================================
   동작 구조:
   A 접속 중 → B 로그인 시도
   → [B에게] "다른 기기 접속 중, 로그인하겠습니까?" 모달
      ├─ 확인(강제 로그인) → A kick → [A에게] "로그아웃되었습니다" 모달 → A 로그인페이지
      │                              [B는] 정상 로그인, 모달 없음
      └─ 취소 → 로그인 페이지로 이동
   ============================================================ */
(function () {
  'use strict';

  if (window.__lbLoaded) return;
  window.__lbLoaded = true;

  var VER       = 'v24.14';
  var SERVER    = 'https://dental-point.pages.dev';
  var LOGIN_URL = 'https://impiantpoint.imweb.me/login';
  var INTERVAL  = 5000;
  var MAX_WAIT  = 15000;
  var RETRY     = 3;

  console.log('[LB] ' + VER + ' start');

  /* ─────────────────────────────────────────
     M20 콘솔 캡처 (즉시 실행)
  ───────────────────────────────────────── */
  var _m20 = '';
  (function () {
    var wrap = function (orig) {
      return function () {
        try {
          var s = [].slice.call(arguments).join(' ');
          var m = s.match(/\bm20(\d{6,})\b/i);
          if (m && !_m20) _m20 = 'm20' + m[1];
          var m2 = s.match(/"member_code"\s*:\s*"([^"]{4,})"/);
          if (m2 && !_m20) _m20 = m2[1];
        } catch (_) {}
        return orig.apply(this, arguments);
      };
    };
    try { console.log   = wrap(console.log);   } catch (_) {}
    try { console.info  = wrap(console.info);  } catch (_) {}
    try { console.warn  = wrap(console.warn);  } catch (_) {}
    try { console.debug = wrap(console.debug); } catch (_) {}
  })();

  /* ─────────────────────────────────────────
     헬퍼
  ───────────────────────────────────────── */
  function _jwt(t) {
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }
    catch (_) { return null; }
  }
  function _cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function _ls(method, key, val) {
    try { return localStorage[method](key, val); } catch (_) {}
    try { return sessionStorage[method](key, val); } catch (_) {}
  }

  /* ─────────────────────────────────────────
     member_id 감지
  ───────────────────────────────────────── */
  var _mid = '';

  function getMid() {
    if (_mid) return _mid;

    /* ① __bs_imweb SDK */
    try {
      var bs = window.__bs_imweb || {};
      if (bs.sdk_jwt) {
        var p = _jwt(bs.sdk_jwt);
        if (p) {
          var v = p.member_code || p.sub || p.mc || p.id || '';
          if (v && v !== 'null' && v.length > 2) return v + '';
        }
      }
      var no = bs.member_no || bs.memberNo || (bs.member && bs.member.no) || '';
      if (no) return no + '';
      var mc = bs.member_code || bs.memberCode || bs.code || '';
      if (mc) return mc + '';
    } catch (_) {}

    /* ② 쿠키 */
    var ck = _cookie('imweb_member_no') || _cookie('member_no') ||
             _cookie('mb_code') || _cookie('imweb_mc') || _cookie('member_code');
    if (ck && ck.length > 2) return ck;

    /* ③ localStorage / sessionStorage */
    var lsKeys = ['imweb_member_no','member_no','imweb_member_code',
                  'member_code','mb_code','__imweb_mc','imweb_user'];
    for (var i = 0; i < lsKeys.length; i++) {
      try {
        var raw = localStorage.getItem(lsKeys[i]) || sessionStorage.getItem(lsKeys[i]) || '';
        if (raw) {
          try {
            var obj = JSON.parse(raw);
            var cv  = obj.member_code || obj.member_no || obj.code || obj.no || obj.id || '';
            if (cv && (cv+'') !== 'null' && (cv+'').length > 2) return cv + '';
          } catch (_) {}
          if (raw.length > 2 && raw !== 'null' && raw !== 'undefined') return raw;
        }
      } catch (_) {}
    }

    /* ④ 전역 변수 */
    var gvars = ['member_data','__MEMBER__','memberData','_member',
                 'JEJU_MEMBER','user_data','_imwebMember','imwebMember'];
    for (var g = 0; g < gvars.length; g++) {
      try {
        var o = window[gvars[g]];
        if (o && typeof o === 'object') {
          var fv = o.member_code || o.member_no || o.code || o.no || o.id || o.memberCode || '';
          if (fv && (fv+'').length > 2) return fv + '';
        }
      } catch (_) {}
    }

    /* ⑤ M20 캡처 */
    if (_m20) return _m20;

    /* ⑥ DOM 속성 */
    try {
      var els = document.querySelectorAll('[data-member-code],[data-member-no],[data-member-id]');
      for (var e = 0; e < els.length; e++) {
        var dv = els[e].getAttribute('data-member-code') ||
                 els[e].getAttribute('data-member-no')   ||
                 els[e].getAttribute('data-member-id') || '';
        if (dv && dv.length > 2) return dv;
      }
    } catch (_) {}

    return '';
  }

  /* ─────────────────────────────────────────
     로그인 여부 — 엄격하게 판단
     (logout 링크 체크 제거: 비로그인 시에도 존재)
  ───────────────────────────────────────── */
  function isLoggedIn() {
    /* ① SDK에 실제 회원 데이터가 있을 때만 */
    try {
      var bs = window.__bs_imweb || {};
      /* sdk_jwt가 있고 sub가 실제 값일 때 */
      if (bs.sdk_jwt) {
        var p = _jwt(bs.sdk_jwt);
        if (p && p.sub && p.sub !== 'null' && p.sub.length > 2) return true;
        if (p && p.member_code && p.member_code.length > 2) return true;
      }
      /* member_no/member_code 직접 값 */
      if (bs.member_no && bs.member_no !== 0 && bs.member_no !== '0') return true;
      if (bs.memberNo  && bs.memberNo  !== 0 && bs.memberNo  !== '0') return true;
      if (bs.member_code && bs.member_code.length > 2) return true;
    } catch (_) {}

    /* ② 쿠키에 member_no 실제 값 있을 때 */
    var ck = _cookie('imweb_member_no') || _cookie('member_no') || _cookie('mb_code');
    if (ck && ck.length > 2 && ck !== '0') return true;

    /* ③ getMid()가 실제 member_id를 반환할 때 */
    var mid = getMid();
    if (mid && mid.length > 4 && mid.indexOf('ANON_') !== 0) return true;

    return false;
  }

  /* ─────────────────────────────────────────
     토큰 / 유저 저장
  ───────────────────────────────────────── */
  function getDeviceId() {
    var KEY = 'lb_did';
    var id  = _ls('getItem', KEY) || '';
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(KEY, id);   } catch (_) {}
      try { sessionStorage.setItem(KEY, id); } catch (_) {}
    }
    return id;
  }

  function getToken()   { return _ls('getItem', 'lb_tok')  || ''; }
  function saveToken(v) { _ls('setItem', 'lb_tok', v);  try{localStorage.setItem('lb_tok',v);}catch(_){} }
  function clearToken() { _ls('removeItem', 'lb_tok');   try{localStorage.removeItem('lb_tok');}catch(_){} }
  function getUser()    { return _ls('getItem', 'lb_uid') || ''; }
  function saveUser(v)  { _ls('setItem', 'lb_uid', v);  try{localStorage.setItem('lb_uid',v);}catch(_){} }
  function clearUser()  { _ls('removeItem', 'lb_uid');   try{localStorage.removeItem('lb_uid');}catch(_){} }

  /* ─────────────────────────────────────────
     API
  ───────────────────────────────────────── */
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
          setTimeout(function () { api(method, path, data, hdrs, cb, retry+1); }, 1000 * Math.pow(2, retry));
        } else {
          cb(err, null, 0);
        }
      });
  }

  function doLogout(uid, tok, did) {
    api('POST', '/api/logout', { userId: uid, deviceId: did }, {}, function () {});
  }

  /* ─────────────────────────────────────────
     모달 공통 overlay
     (이미지/아이콘 없음, 텍스트만)
  ───────────────────────────────────────── */
  function _overlay(html) {
    var old = document.getElementById('__lb_ov');
    if (old) old.remove();

    var d = document.createElement('div');
    d.id = '__lb_ov';
    d.style.cssText = [
      'position:fixed','top:0','left:0','width:100%','height:100%',
      'z-index:2147483647','background:rgba(0,0,0,.75)',
      'display:flex','align-items:center','justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif',
      'box-sizing:border-box','margin:0','padding:0','transform:none',
    ].join('!important;') + '!important';

    d.innerHTML = html;
    (document.body || document.documentElement).appendChild(d);
    return d;
  }

  /* 박스 / 버튼 공통 스타일 (아이콘 없음) */
  var BOX = 'style="background:#fff;border-radius:16px;padding:32px 24px 24px;' +
            'max-width:320px;width:calc(100% - 32px);text-align:center;' +
            'box-shadow:0 16px 48px rgba(0,0,0,.4);box-sizing:border-box;"';
  var BTN = 'style="width:100%;padding:12px;background:#2563eb;color:#fff;' +
            'border:none;border-radius:8px;font-size:15px;font-weight:700;' +
            'cursor:pointer;display:block;box-sizing:border-box;font-family:inherit;margin-top:16px;"';
  var BTN2 = 'style="width:100%;padding:11px;background:#f3f4f6;color:#374151;' +
             'border:none;border-radius:8px;font-size:14px;cursor:pointer;' +
             'display:block;box-sizing:border-box;font-family:inherit;margin-top:8px;"';
  var TTL = 'style="font-size:17px;font-weight:700;color:#111;margin:0 0 10px;"';
  var TXT = 'style="font-size:13px;color:#555;margin:0;line-height:1.65;"';

  /* ─────────────────────────────────────────
     모달 ① — B에게: "다른 기기 접속 중" (점유)
     A가 접속 중인데 B가 로그인 시도 시 B 화면에 표시
  ───────────────────────────────────────── */
  function showOccupied(uid, did) {
    _overlay(
      '<div ' + BOX + '>' +
        '<h3 ' + TTL + '>다른 기기에서 접속 중</h3>' +
        '<p ' + TXT + '>현재 다른 기기에서 접속 중입니다.<br>이 기기로 로그인하시겠습니까?<br>' +
          '<span style="font-size:11px;color:#9ca3af;">(기존 기기는 자동 로그아웃됩니다)</span></p>' +
        '<button id="__lb_force" ' + BTN + '>로그인</button>' +
        '<button id="__lb_cancel" ' + BTN2 + '>취소</button>' +
      '</div>'
    );
    document.getElementById('__lb_force').onclick = function () {
      hideModal();
      _isForcing = true;          /* ★ 강제 로그인 진행 중 플래그 */
      doLogin(uid, did, true);
    };
    document.getElementById('__lb_cancel').onclick = function () {
      hideModal();
      location.href = LOGIN_URL;  /* 취소 → 로그인 페이지 */
    };
  }

  /* ─────────────────────────────────────────
     모달 ② — A에게: "로그아웃되었습니다" (kicked)
     B가 강제 로그인하여 A 세션이 kick됐을 때 A 화면에 표시
  ───────────────────────────────────────── */
  function showKicked() {
    _overlay(
      '<div ' + BOX + '>' +
        '<h3 ' + TTL + '>로그아웃되었습니다</h3>' +
        '<p ' + TXT + '>다른 기기에서 로그인하여<br>자동으로 로그아웃되었습니다.</p>' +
        '<button id="__lb_ok" ' + BTN + '>로그인</button>' +
      '</div>'
    );
    document.getElementById('__lb_ok').onclick = function () {
      clearToken(); clearUser();
      location.href = LOGIN_URL + '?from=' + encodeURIComponent(location.pathname);
    };
  }

  function hideModal() {
    var el = document.getElementById('__lb_ov');
    if (el) el.remove();
  }

  /* ─────────────────────────────────────────
     세션 관리
  ───────────────────────────────────────── */
  var _uid      = '';
  var _did      = '';
  var _tok      = '';
  var _timer    = null;
  var _regOk    = false;
  var _isForcing = false;  /* 강제 로그인 진행 중이면 check 결과 무시 */

  /* /api/login 호출 */
  function doLogin(uid, did, force) {
    api('POST', '/api/login',
      { userId: uid, deviceId: did, force: !!force, currentToken: getToken() },
      {},
      function (err, res, st) {
        if (err) {
          console.warn('[LB] login error, retry 3s');
          setTimeout(function () { doLogin(uid, did, force); }, 3000);
          return;
        }

        /* 다른 기기 점유 → B에게 점유 모달 */
        if (!res.success && res.code === 'OCCUPIED') {
          _isForcing = false;
          showOccupied(uid, did);
          return;
        }

        /* 로그인 성공 */
        if (res.success && res.token) {
          _tok = res.token;
          _uid = uid;
          _did = did;
          saveToken(_tok);
          saveUser(uid);
          hideModal();
          _isForcing = false;
          /* 로그인 직후 짧은 딜레이 후 check 시작 (서버 DB 반영 대기) */
          setTimeout(function () {
            startCheck();
            if (!_regOk) { regLogout(); _regOk = true; }
          }, 2000);
          console.log('[LB] ✓ uid=' + uid.slice(0,6) + '***');
        }
      }
    );
  }

  /* /api/protected-data 주기 체크 */
  function startCheck() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(doCheck, INTERVAL);
  }

  function doCheck() {
    if (!_tok || !_uid) return;
    if (_isForcing) return;   /* 강제 로그인 진행 중에는 체크 건너뜀 */

    api('GET', '/api/protected-data', null,
      { Authorization: 'Bearer ' + _tok, 'X-User-Id': _uid, 'X-Device-Id': _did },
      function (err, res, st) {
        if (err) return;           /* 네트워크 오류 → 차단 안 함 */
        if (_isForcing) return;    /* 응답 도착 시점에도 플래그 재확인 */

        if (st === 403) {
          /* A의 토큰이 B의 강제 로그인으로 무효화됨 */
          clearInterval(_timer); _timer = null;
          clearToken(); clearUser();
          console.warn('[LB] kicked (403) → 로그아웃 모달');
          showKicked();
        } else if (st === 401) {
          clearInterval(_timer); _timer = null;
          console.warn('[LB] 세션 만료 (401), 재로그인');
          doLogin(_uid, _did, false);
        }
        /* 200 → 정상 */
      }
    );
  }

  /* 로그아웃 이벤트 등록 */
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

  /* ─────────────────────────────────────────
     초기화 (폴링)
  ───────────────────────────────────────── */
  var _pollN   = 0;
  var _pollMax = Math.ceil(MAX_WAIT / 500);
  var _started = false;

  function tryStart() {
    if (_started) return;

    if (!isLoggedIn()) {
      _pollN++;
      if (_pollN < _pollMax) setTimeout(tryStart, 500);
      else console.log('[LB] 비로그인 상태');
      return;
    }

    var uid = getMid();
    if (!uid) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, 500);
      } else {
        console.warn('[LB] member_id 미감지, fallback');
        uid = 'ANON_' + getDeviceId();
      }
      if (!uid) return;
    }

    _started = true;
    _mid = uid;
    var did = getDeviceId();
    console.log('[LB] 초기화 uid=' + uid.slice(0,6) + '***');

    /* 저장된 토큰 재사용 (새로고침) */
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

  /* SPA 이동 감지 */
  var _prevUrl = location.href;
  setInterval(function () {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      _pollN = 0; _started = false; _mid = '';
      setTimeout(tryStart, 1000);
    }
    /* 계정 변경 */
    if (_uid) {
      var cur = getMid();
      if (cur && cur !== _uid) {
        console.log('[LB] 계정 변경');
        if (_timer) clearInterval(_timer);
        doLogout(_uid, _tok, _did);
        clearToken(); clearUser();
        _tok = ''; _uid = ''; _did = ''; _mid = ''; _m20 = '';
        _started = false; _pollN = 0; _regOk = false; _isForcing = false;
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

  /* ─────────────────────────────────────────
     디버그 API
  ───────────────────────────────────────── */
  window._lb = {
    ver: VER,
    status: function () {
      console.table({
        ver:      VER,
        uid:      _uid   || '(없음)',
        did:      _did   || '(없음)',
        token:    _tok   ? _tok.slice(0,10)+'...' : '(없음)',
        timer:    _timer ? '✅ 실행중' : '❌ 정지',
        isLogin:  isLoggedIn(),
        mid:      getMid() || '(미감지)',
        m20:      _m20  || '(없음)',
        forcing:  _isForcing,
      });
    },
    mid:   function () { return getMid(); },
    did:   function () { return getDeviceId(); },
    tok:   function () { return _tok; },
    check: function () { doCheck(); },
    kick:  function () { if (_timer) clearInterval(_timer); showKicked(); },
    occupied: function () { showOccupied(_uid || 'test', _did || 'test'); },
    dump:  function () {
      console.log('__bs_imweb:', window.__bs_imweb);
      console.log('cookies:', document.cookie);
      console.log('lb_uid:', getUser(), '| lb_tok:', getToken() ? 'exists' : 'none');
      console.log('getMid():', getMid());
      console.log('isLoggedIn():', isLoggedIn());
    },
    reset: function () {
      if (_timer) clearInterval(_timer);
      clearToken(); clearUser();
      _tok = ''; _uid = ''; _did = ''; _mid = ''; _m20 = '';
      _started = false; _pollN = 0; _regOk = false; _timer = null; _isForcing = false;
      delete window.__lbLoaded;
      console.log('[LB] reset → re-init...');
      setTimeout(function () { window.__lbLoaded = true; tryStart(); }, 200);
    },
  };

  console.log('[LB] ' + VER + ' ready — 진단: window._lb.status()');
})();
