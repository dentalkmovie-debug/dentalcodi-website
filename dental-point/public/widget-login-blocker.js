/* 아임웹 동시접속 차단 v24.15 */
(function () {
  'use strict';
  if (window.__lbLoaded) { return; }
  window.__lbLoaded = true;

  var VER      = 'v24.15';
  var SERVER   = 'https://dental-point.pages.dev';
  var LOGINURL = 'https://impiantpoint.imweb.me/login';
  var INTERVAL = 5000;
  var MAXWAIT  = 30000;
  var POLLMS   = 1000;
  var RETRY    = 3;

  console.log('[LB] ' + VER + ' start');

  /* ── 콘솔 캡처: DVUE가 출력하는 m20xxx 값을 가로챔 ── */
  var _m20 = '';
  var _origLog  = console.log;
  var _origInfo = console.info;
  var _origWarn = console.warn;

  function _capture(orig) {
    return function () {
      var s = '';
      try { s = Array.prototype.slice.call(arguments).join(' '); } catch (e) {}
      if (s && !_m20) {
        var r1 = s.match(/\b(m20[0-9a-f]{8,})\b/i);
        if (r1) { _m20 = r1[1]; }
        var r2 = s.match(/sub[=:\s]+(m20[0-9a-f]{8,})/i);
        if (r2) { _m20 = r2[1]; }
        var r3 = s.match(/"member_code"\s*:\s*"([^"]{4,})"/);
        if (r3) { _m20 = r3[1]; }
      }
      return orig.apply(this, arguments);
    };
  }

  try { console.log  = _capture(_origLog);  } catch (e) {}
  try { console.info = _capture(_origInfo); } catch (e) {}
  try { console.warn = _capture(_origWarn); } catch (e) {}

  /* ── 유틸 ── */
  function _jwt(t) {
    try {
      var payload = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload));
    } catch (e) { return null; }
  }

  function _ck(name) {
    var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function _store(method, key, val) {
    try { return localStorage[method](key, val); } catch (e) {}
    try { return sessionStorage[method](key, val); } catch (e) {}
    return null;
  }

  /* ── member_id 감지 ── */
  var _mid = '';

  function getMid() {
    if (_mid) { return _mid; }

    /* 1. __bs_imweb SDK */
    try {
      var bs = window.__bs_imweb;
      if (bs) {
        if (bs.sdk_jwt) {
          var p = _jwt(bs.sdk_jwt);
          if (p) {
            var v = p.member_code || p.sub || p.mc || p.id || '';
            if (v && v !== 'null' && v.length > 2) { return String(v); }
          }
        }
        var no = bs.member_no || bs.memberNo || '';
        if (no && no !== '0') { return String(no); }
        var mc = bs.member_code || bs.memberCode || '';
        if (mc && mc.length > 2) { return String(mc); }
      }
    } catch (e) {}

    /* 2. 쿠키 */
    var ck = _ck('imweb_member_no') || _ck('member_no') || _ck('mb_code') || _ck('member_code');
    if (ck && ck.length > 2 && ck !== '0') { return ck; }

    /* 3. localStorage */
    var lsKeys = ['imweb_member_no', 'member_no', 'member_code', 'mb_code', 'imweb_user'];
    for (var i = 0; i < lsKeys.length; i++) {
      try {
        var raw = localStorage.getItem(lsKeys[i]) || sessionStorage.getItem(lsKeys[i]) || '';
        if (raw && raw !== 'null' && raw !== 'undefined') {
          try {
            var obj = JSON.parse(raw);
            var cv = obj.member_code || obj.member_no || obj.code || obj.id || obj.sub || '';
            if (cv && String(cv).length > 2) { return String(cv); }
          } catch (e) {}
          if (raw.length > 2 && raw.indexOf('{') < 0) { return raw; }
        }
      } catch (e) {}
    }

    /* 4. 전역 변수 */
    var gvars = ['member_data', '__MEMBER__', 'memberData', '_member', 'user_data', 'loginMember', 'currentMember'];
    for (var g = 0; g < gvars.length; g++) {
      try {
        var o = window[gvars[g]];
        if (o && typeof o === 'object') {
          var fv = o.member_code || o.member_no || o.code || o.id || o.sub || '';
          if (fv && String(fv).length > 2) { return String(fv); }
        }
      } catch (e) {}
    }

    /* 5. M20 콘솔 캡처 */
    if (_m20 && _m20.length > 4) { return _m20; }

    return '';
  }

  /* ── 로그인 여부 ── */
  function isLoggedIn() {
    /* SDK */
    try {
      var bs = window.__bs_imweb;
      if (bs) {
        if (bs.sdk_jwt) {
          var p = _jwt(bs.sdk_jwt);
          if (p && p.sub && p.sub !== 'null' && p.sub.length > 2) { return true; }
          if (p && p.member_code && p.member_code.length > 2) { return true; }
        }
        if (bs.member_no && bs.member_no !== 0 && bs.member_no !== '0') { return true; }
        if (bs.member_code && bs.member_code.length > 2) { return true; }
      }
    } catch (e) {}

    /* 쿠키 */
    var ck = _ck('imweb_member_no') || _ck('member_no') || _ck('mb_code');
    if (ck && ck.length > 2 && ck !== '0') { return true; }

    /* M20 캡처값 */
    if (_m20 && _m20.length > 4) { return true; }

    /* getMid */
    var mid = getMid();
    if (mid && mid.length > 4 && mid.indexOf('ANON_') !== 0) { return true; }

    return false;
  }

  /* ── 기기 ID / 토큰 저장 ── */
  function getDeviceId() {
    var K = 'lb_did';
    var id = _store('getItem', K) || '';
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(K, id); } catch (e) {}
      try { sessionStorage.setItem(K, id); } catch (e) {}
    }
    return id;
  }

  function getToken()    { return _store('getItem', 'lb_tok') || ''; }
  function saveToken(v)  { _store('setItem', 'lb_tok', v); try { localStorage.setItem('lb_tok', v); } catch (e) {} }
  function clearToken()  { _store('removeItem', 'lb_tok');   try { localStorage.removeItem('lb_tok'); } catch (e) {} }
  function getUser()     { return _store('getItem', 'lb_uid') || ''; }
  function saveUser(v)   { _store('setItem', 'lb_uid', v);  try { localStorage.setItem('lb_uid', v); } catch (e) {} }
  function clearUser()   { _store('removeItem', 'lb_uid');   try { localStorage.removeItem('lb_uid'); } catch (e) {} }

  /* ── API 호출 ── */
  function api(method, path, data, hdrs, cb, retryN) {
    retryN = retryN || 0;
    var opts = { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, hdrs || {}) };
    if (method !== 'GET' && data) { opts.body = JSON.stringify(data); }
    fetch(SERVER + path, opts)
      .then(function (r) {
        var st = r.status;
        return r.json().then(function (j) { return { s: st, j: j }; });
      })
      .then(function (res) { cb(null, res.j, res.s); })
      .catch(function (err) {
        if (retryN < RETRY) {
          setTimeout(function () { api(method, path, data, hdrs, cb, retryN + 1); }, 1000 * Math.pow(2, retryN));
        } else {
          cb(err, null, 0);
        }
      });
  }

  function doLogout(uid, tok, did) {
    api('POST', '/api/logout', { userId: uid, deviceId: did }, {}, function () {});
  }

  /* ── 모달 ── */
  function _overlay(html) {
    var old = document.getElementById('__lb_ov');
    if (old) { old.remove(); }
    var d = document.createElement('div');
    d.id = '__lb_ov';
    d.setAttribute('style',
      'position:fixed!important;top:0!important;left:0!important;' +
      'width:100%!important;height:100%!important;' +
      'z-index:2147483647!important;background:rgba(0,0,0,.75)!important;' +
      'display:flex!important;align-items:center!important;justify-content:center!important;' +
      'box-sizing:border-box!important;margin:0!important;padding:0!important;' +
      'transform:none!important;font-family:sans-serif!important;'
    );
    d.innerHTML = html;
    var root = document.body || document.documentElement;
    root.appendChild(d);
    return d;
  }

  var SBOX = 'style="background:#fff;border-radius:16px;padding:32px 24px 24px;max-width:320px;width:calc(100% - 32px);text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.4);box-sizing:border-box;"';
  var SBTN = 'style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;display:block;margin-top:16px;box-sizing:border-box;"';
  var SBTNG = 'style="width:100%;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:14px;cursor:pointer;display:block;margin-top:8px;box-sizing:border-box;"';
  var STTL = 'style="font-size:17px;font-weight:700;color:#111;margin:0 0 10px;"';
  var STXT = 'style="font-size:13px;color:#555;margin:0;line-height:1.65;"';

  /* 모달①: B에게 — 다른 기기 접속 중 */
  function showOccupied(uid, did) {
    _overlay(
      '<div ' + SBOX + '>' +
      '<h3 ' + STTL + '>다른 기기에서 접속 중</h3>' +
      '<p ' + STXT + '>현재 다른 기기에서 접속 중입니다.<br>이 기기로 로그인하시겠습니까?<br>' +
      '<span style="font-size:11px;color:#9ca3af;">(기존 기기는 자동 로그아웃됩니다)</span></p>' +
      '<button id="__lb_force" ' + SBTN + '>로그인</button>' +
      '<button id="__lb_cancel" ' + SBTNG + '>취소</button>' +
      '</div>'
    );
    document.getElementById('__lb_force').onclick = function () {
      hideModal();
      _isForcing = true;
      doLogin(uid, did, true);
    };
    document.getElementById('__lb_cancel').onclick = function () {
      hideModal();
      location.href = LOGINURL;
    };
  }

  /* 모달②: A에게 — 로그아웃됨 */
  function showKicked() {
    _overlay(
      '<div ' + SBOX + '>' +
      '<h3 ' + STTL + '>로그아웃되었습니다</h3>' +
      '<p ' + STXT + '>다른 기기에서 로그인하여<br>자동으로 로그아웃되었습니다.</p>' +
      '<button id="__lb_ok" ' + SBTN + '>로그인</button>' +
      '</div>'
    );
    document.getElementById('__lb_ok').onclick = function () {
      clearToken();
      clearUser();
      location.href = LOGINURL + '?from=' + encodeURIComponent(location.pathname);
    };
  }

  function hideModal() {
    var el = document.getElementById('__lb_ov');
    if (el) { el.remove(); }
  }

  /* ── 세션 관리 ── */
  var _uid       = '';
  var _did       = '';
  var _tok       = '';
  var _timer     = null;
  var _regOk     = false;
  var _isForcing = false;

  function doLogin(uid, did, force) {
    api('POST', '/api/login',
      { userId: uid, deviceId: did, force: !!force, currentToken: getToken() },
      {},
      function (err, res, st) {
        if (err) {
          console.warn('[LB] login err, retry 3s');
          setTimeout(function () { doLogin(uid, did, force); }, 3000);
          return;
        }
        if (res && !res.success && res.code === 'OCCUPIED') {
          _isForcing = false;
          showOccupied(uid, did);
          return;
        }
        if (res && res.success && res.token) {
          _tok = res.token;
          _uid = uid;
          _did = did;
          saveToken(_tok);
          saveUser(uid);
          hideModal();
          _isForcing = false;
          setTimeout(function () {
            startCheck();
            if (!_regOk) { regLogout(); _regOk = true; }
          }, 2000);
          console.log('[LB] 로그인 완료 uid=' + uid.slice(0, 6) + '***');
        }
      }
    );
  }

  function startCheck() {
    if (_timer) { clearInterval(_timer); }
    _timer = setInterval(doCheck, INTERVAL);
  }

  function doCheck() {
    if (!_tok || !_uid || _isForcing) { return; }
    api('GET', '/api/protected-data', null,
      { 'Authorization': 'Bearer ' + _tok, 'X-User-Id': _uid, 'X-Device-Id': _did },
      function (err, res, st) {
        if (err || _isForcing) { return; }
        if (st === 403) {
          clearInterval(_timer);
          _timer = null;
          clearToken();
          clearUser();
          console.warn('[LB] kicked(403)');
          showKicked();
        } else if (st === 401) {
          clearInterval(_timer);
          _timer = null;
          doLogin(_uid, _did, false);
        }
      }
    );
  }

  function regLogout() {
    window.addEventListener('beforeunload', function () { doLogout(_uid, _tok, _did); });
    document.addEventListener('click', function (e) {
      var el = e.target;
      for (var i = 0; i < 4 && el; i++) {
        var href   = (el.getAttribute && el.getAttribute('href'))        || '';
        var action = (el.getAttribute && el.getAttribute('data-action')) || '';
        var page   = (el.getAttribute && el.getAttribute('data-page'))   || '';
        if (href.indexOf('logout') > -1 || action === 'logout' || page === 'logout') {
          doLogout(_uid, _tok, _did);
          clearToken();
          clearUser();
          break;
        }
        el = el.parentElement;
      }
    }, true);
  }

  /* ── 초기화 폴링 ── */
  var _pollN   = 0;
  var _pollMax = Math.ceil(MAXWAIT / POLLMS);
  var _started = false;

  function tryStart() {
    if (_started) { return; }

    var logged = isLoggedIn();
    var uid    = getMid();

    if (!logged && !uid) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, POLLMS);
      } else {
        console.log('[LB] ' + (MAXWAIT / 1000) + '초 비로그인 → 종료');
      }
      return;
    }

    if (!uid) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, POLLMS);
        return;
      }
      uid = 'ANON_' + getDeviceId();
    }

    _started = true;
    _mid = uid;
    var did = getDeviceId();
    console.log('[LB] 초기화 uid=' + uid.slice(0, 6) + '*** (poll:' + _pollN + ')');

    var savedTok  = getToken();
    var savedUser = getUser();
    if (savedTok && savedUser === uid) {
      _tok = savedTok;
      _uid = uid;
      _did = did;
      startCheck();
      if (!_regOk) { regLogout(); _regOk = true; }
      return;
    }

    doLogin(uid, did, false);
  }

  /* IMWEB_DEPLOY_STRATEGY 이벤트 → 재시도
     DVUE가 이 이벤트 발생 후 __bs_imweb 세팅하므로 충분히 기다림 */
  window.addEventListener('IMWEB_DEPLOY_STRATEGY', function () {
    console.log('[LB] IMWEB_DEPLOY_STRATEGY 감지 → 2초 후 재시도');
    if (!_started) {
      _pollN = 0;
      /* 500ms, 1s, 2s, 3s, 5s 순서로 여러 번 재시도 */
      var delays = [500, 1000, 2000, 3000, 5000];
      for (var di = 0; di < delays.length; di++) {
        (function (delay) {
          setTimeout(function () { if (!_started) { tryStart(); } }, delay);
        }(delays[di]));
      }
    }
  });

  /* SPA / 계정변경 감지 */
  var _prevUrl = location.href;
  setInterval(function () {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      _pollN = 0;
      _started = false;
      _mid = '';
      setTimeout(tryStart, 1000);
    }
    if (_uid) {
      var cur = getMid();
      if (cur && cur !== _uid) {
        if (_timer) { clearInterval(_timer); }
        doLogout(_uid, _tok, _did);
        clearToken();
        clearUser();
        _tok = ''; _uid = ''; _did = ''; _mid = ''; _m20 = '';
        _started = false; _pollN = 0; _regOk = false; _isForcing = false;
        setTimeout(tryStart, 500);
      }
    }
  }, 1500);

  /* 진입 — 1.5초, 3초, 6초 세 번 시도 (DVUE 로드 타이밍 커버) */
  function _initTry(delay) {
    setTimeout(function () { if (!_started) { tryStart(); } }, delay);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      _initTry(1500); _initTry(3000); _initTry(6000);
    });
  } else {
    _initTry(1500); _initTry(3000); _initTry(6000);
  }

  /* ── 디버그 API ── */
  window._lb = {
    ver: VER,
    status: function () {
      console.table({
        ver:     VER,
        uid:     _uid    || '없음',
        did:     _did    || '없음',
        token:   _tok    ? _tok.slice(0, 12) + '...' : '없음',
        timer:   _timer  ? '실행중' : '정지',
        isLogin: isLoggedIn(),
        mid:     getMid() || '미감지',
        m20:     _m20    || '없음',
        pollN:   _pollN,
        forcing: _isForcing
      });
    },
    mid:      function () { return getMid(); },
    did:      function () { return getDeviceId(); },
    tok:      function () { return _tok; },
    check:    function () { doCheck(); },
    kick:     function () { if (_timer) { clearInterval(_timer); } showKicked(); },
    occupied: function () { showOccupied(_uid || 'test', _did || 'test'); },
    dump:     function () {
      console.log('__bs_imweb:', window.__bs_imweb);
      console.log('_m20:', _m20);
      console.log('getMid():', getMid());
      console.log('isLoggedIn():', isLoggedIn());
      console.log('cookie:', document.cookie.slice(0, 200));
      console.log('lb_uid:', getUser(), '| lb_tok:', getToken() ? 'exists' : 'none');
    },
    reset: function () {
      if (_timer) { clearInterval(_timer); }
      clearToken(); clearUser();
      _tok = ''; _uid = ''; _did = ''; _mid = ''; _m20 = '';
      _started = false; _pollN = 0; _regOk = false; _timer = null; _isForcing = false;
      delete window.__lbLoaded;
      console.log('[LB] reset');
      setTimeout(function () { window.__lbLoaded = true; tryStart(); }, 300);
    }
  };

  console.log('[LB] ' + VER + ' ready');
}());
