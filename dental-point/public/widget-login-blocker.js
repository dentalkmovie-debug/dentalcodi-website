/* ============================================================
   아임웹 동시접속 차단 스크립트 v24.15
   ============================================================
   v24.15: DVUE sdk_jwt 직접 읽기, IMWEB_DEPLOY_STRATEGY 감지,
           MAX_WAIT 30초, isLoggedIn M20캡처 직접체크
   ============================================================ */
(function () {
  'use strict';
  if (window.__lbLoaded) return;
  window.__lbLoaded = true;

  var VER      = 'v24.15';
  var SERVER   = 'https://dental-point.pages.dev';
  var LOGIN_URL= 'https://impiantpoint.imweb.me/login';
  var INTERVAL = 5000;
  var MAX_WAIT = 30000;
  var POLL_MS  = 1000;
  var RETRY    = 3;

  console.log('[LB] ' + VER + ' start');

  /* ── M20 콘솔 캡처 ── */
  var _m20 = '';
  (function () {
    function wrap(orig) {
      return function () {
        try {
          var s = Array.prototype.slice.call(arguments).join(' ');
          var r1 = s.match(/\b(m20[0-9a-f]{8,})\b/i);
          if (r1 && !_m20) { _m20 = r1[1]; }
          var r2 = s.match(/sub[=:\s]+(m20[0-9a-f]{8,})/i);
          if (r2 && !_m20) { _m20 = r2[1]; }
          var r3 = s.match(/"member_code"\s*:\s*"([^"]{4,})"/);
          if (r3 && !_m20) { _m20 = r3[1]; }
        } catch (e) { /* silent */ }
        return orig.apply(this, arguments);
      };
    }
    if (console.log)   { try { console.log   = wrap(console.log);   } catch (e) {} }
    if (console.info)  { try { console.info  = wrap(console.info);  } catch (e) {} }
    if (console.warn)  { try { console.warn  = wrap(console.warn);  } catch (e) {} }
    if (console.debug) { try { console.debug = wrap(console.debug); } catch (e) {} }
  }());

  /* ── 헬퍼 ── */
  function jwtParse(t) {
    try {
      return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) { return null; }
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function store(method, key, val) {
    try { return localStorage[method](key, val); } catch (e) {}
    try { return sessionStorage[method](key, val); } catch (e) {}
  }

  /* ── member_id 감지 ── */
  var _mid = '';

  function getMid() {
    if (_mid) return _mid;

    /* 1. __bs_imweb SDK */
    try {
      var bs = window.__bs_imweb || {};
      if (bs.sdk_jwt) {
        var p = jwtParse(bs.sdk_jwt);
        if (p) {
          var v = p.member_code || p.sub || p.mc || p.id || '';
          if (v && v !== 'null' && v.length > 2) return String(v);
        }
      }
      if (bs.member_no && bs.member_no !== '0') return String(bs.member_no);
      if (bs.memberNo  && bs.memberNo  !== '0') return String(bs.memberNo);
      if (bs.member_code && bs.member_code.length > 2) return String(bs.member_code);
    } catch (e) {}

    /* 2. DVUE 전역 */
    var dvKeys = ['__DVUE__', 'DVUE_MEMBER', 'dvue_member', 'bsMemberInfo', '_dvueMember'];
    for (var d = 0; d < dvKeys.length; d++) {
      try {
        var dv = window[dvKeys[d]];
        if (dv && typeof dv === 'object') {
          var dval = dv.member_code || dv.sub || dv.memberId || dv.member_id || dv.member_no || dv.id || '';
          if (dval && String(dval).length > 4) return String(dval);
          if (dv.sdk_jwt) {
            var dp = jwtParse(dv.sdk_jwt);
            if (dp) {
              var dpv = dp.member_code || dp.sub || dp.mc || '';
              if (dpv && dpv !== 'null' && dpv.length > 2) return String(dpv);
            }
          }
        }
      } catch (e) {}
    }

    /* 3. 쿠키 */
    var ck = getCookie('imweb_member_no') || getCookie('member_no') ||
             getCookie('mb_code') || getCookie('member_code');
    if (ck && ck.length > 2 && ck !== '0') return ck;

    /* 4. localStorage */
    var lsKeys = ['imweb_member_no', 'member_no', 'member_code', 'mb_code', 'imweb_user', 'bs_member_code'];
    for (var i = 0; i < lsKeys.length; i++) {
      try {
        var raw = localStorage.getItem(lsKeys[i]) || sessionStorage.getItem(lsKeys[i]) || '';
        if (raw && raw !== 'null' && raw !== 'undefined') {
          try {
            var obj = JSON.parse(raw);
            var cv = obj.member_code || obj.member_no || obj.code || obj.no || obj.id || obj.sub || '';
            if (cv && String(cv).length > 2) return String(cv);
          } catch (e) {}
          if (raw.length > 2 && !/[{}\[\]]/.test(raw)) return raw;
        }
      } catch (e) {}
    }

    /* 5. 전역변수 */
    var gvars = ['member_data', '__MEMBER__', 'memberData', '_member', 'user_data', 'currentMember', 'loginMember'];
    for (var g = 0; g < gvars.length; g++) {
      try {
        var o = window[gvars[g]];
        if (o && typeof o === 'object') {
          var fv = o.member_code || o.member_no || o.code || o.no || o.id || o.memberCode || o.sub || '';
          if (fv && String(fv).length > 2) return String(fv);
        }
      } catch (e) {}
    }

    /* 6. M20 캡처값 */
    if (_m20 && _m20.length > 4) return _m20;

    /* 7. DOM */
    try {
      var els = document.querySelectorAll('[data-member-code],[data-member-no],[data-member-id]');
      for (var e = 0; e < els.length; e++) {
        var dv2 = els[e].getAttribute('data-member-code') ||
                  els[e].getAttribute('data-member-no') ||
                  els[e].getAttribute('data-member-id') || '';
        if (dv2 && dv2.length > 2 && dv2 !== '0') return dv2;
      }
    } catch (e) {}

    return '';
  }

  /* ── 로그인 여부 ── */
  function isLoggedIn() {
    try {
      var bs = window.__bs_imweb || {};
      if (bs.sdk_jwt) {
        var p = jwtParse(bs.sdk_jwt);
        if (p && p.sub && p.sub !== 'null' && p.sub.length > 2) return true;
        if (p && p.member_code && p.member_code.length > 2) return true;
      }
      if (bs.member_no && bs.member_no !== 0 && bs.member_no !== '0') return true;
      if (bs.memberNo  && bs.memberNo  !== 0 && bs.memberNo  !== '0') return true;
      if (bs.member_code && bs.member_code.length > 2) return true;
    } catch (e) {}

    var ck = getCookie('imweb_member_no') || getCookie('member_no') || getCookie('mb_code');
    if (ck && ck.length > 2 && ck !== '0') return true;

    if (_m20 && _m20.length > 4) return true;

    var mid = getMid();
    if (mid && mid.length > 4 && mid.indexOf('ANON_') !== 0) return true;

    return false;
  }

  /* ── Device / Token 저장 ── */
  function getDeviceId() {
    var KEY = 'lb_did';
    var id = store('getItem', KEY) || '';
    if (!id) {
      id = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(KEY, id); } catch (e) {}
      try { sessionStorage.setItem(KEY, id); } catch (e) {}
    }
    return id;
  }

  function getToken()   { return store('getItem', 'lb_tok') || ''; }
  function saveToken(v) { store('setItem', 'lb_tok', v); try { localStorage.setItem('lb_tok', v); } catch (e) {} }
  function clearToken() { store('removeItem', 'lb_tok');  try { localStorage.removeItem('lb_tok'); } catch (e) {} }
  function getUser()    { return store('getItem', 'lb_uid') || ''; }
  function saveUser(v)  { store('setItem', 'lb_uid', v); try { localStorage.setItem('lb_uid', v); } catch (e) {} }
  function clearUser()  { store('removeItem', 'lb_uid'); try { localStorage.removeItem('lb_uid'); } catch (e) {} }

  /* ── API ── */
  function api(method, path, data, hdrs, cb, retryN) {
    retryN = retryN || 0;
    var opts = { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, hdrs || {}) };
    if (method !== 'GET' && data) opts.body = JSON.stringify(data);
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
  function makeOverlay(html) {
    var old = document.getElementById('__lb_ov');
    if (old) old.remove();
    var d = document.createElement('div');
    d.id = '__lb_ov';
    d.setAttribute('style', [
      'position:fixed!important', 'top:0!important', 'left:0!important',
      'width:100%!important', 'height:100%!important',
      'z-index:2147483647!important', 'background:rgba(0,0,0,.75)!important',
      'display:flex!important', 'align-items:center!important', 'justify-content:center!important',
      'box-sizing:border-box!important', 'margin:0!important', 'padding:0!important',
      'transform:none!important',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif!important'
    ].join(';'));
    d.innerHTML = html;
    (document.body || document.documentElement).appendChild(d);
    return d;
  }

  var S_BOX = 'background:#fff;border-radius:16px;padding:32px 24px 24px;max-width:320px;width:calc(100% - 32px);text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.4);box-sizing:border-box;';
  var S_BTN = 'width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;display:block;box-sizing:border-box;margin-top:16px;';
  var S_BTN2= 'width:100%;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:14px;cursor:pointer;display:block;box-sizing:border-box;margin-top:8px;';
  var S_TTL = 'font-size:17px;font-weight:700;color:#111;margin:0 0 10px;';
  var S_TXT = 'font-size:13px;color:#555;margin:0;line-height:1.65;';

  function showOccupied(uid, did) {
    makeOverlay(
      '<div style="' + S_BOX + '">' +
        '<h3 style="' + S_TTL + '">다른 기기에서 접속 중</h3>' +
        '<p style="' + S_TXT + '">현재 다른 기기에서 접속 중입니다.<br>이 기기로 로그인하시겠습니까?<br>' +
        '<span style="font-size:11px;color:#9ca3af;">(기존 기기는 자동 로그아웃됩니다)</span></p>' +
        '<button id="__lb_force" style="' + S_BTN + '">로그인</button>' +
        '<button id="__lb_cancel" style="' + S_BTN2 + '">취소</button>' +
      '</div>'
    );
    document.getElementById('__lb_force').onclick = function () {
      hideModal();
      _isForcing = true;
      doLogin(uid, did, true);
    };
    document.getElementById('__lb_cancel').onclick = function () {
      hideModal();
      location.href = LOGIN_URL;
    };
  }

  function showKicked() {
    makeOverlay(
      '<div style="' + S_BOX + '">' +
        '<h3 style="' + S_TTL + '">로그아웃되었습니다</h3>' +
        '<p style="' + S_TXT + '">다른 기기에서 로그인하여<br>자동으로 로그아웃되었습니다.</p>' +
        '<button id="__lb_ok" style="' + S_BTN + '">로그인</button>' +
      '</div>'
    );
    document.getElementById('__lb_ok').onclick = function () {
      clearToken();
      clearUser();
      location.href = LOGIN_URL + '?from=' + encodeURIComponent(location.pathname);
    };
  }

  function hideModal() {
    var el = document.getElementById('__lb_ov');
    if (el) el.remove();
  }

  /* ── 세션 ── */
  var _uid = '', _did = '', _tok = '', _timer = null, _regOk = false, _isForcing = false;

  function doLogin(uid, did, force) {
    api('POST', '/api/login',
      { userId: uid, deviceId: did, force: !!force, currentToken: getToken() },
      {},
      function (err, res, st) {
        if (err) {
          setTimeout(function () { doLogin(uid, did, force); }, 3000);
          return;
        }
        if (!res.success && res.code === 'OCCUPIED') {
          _isForcing = false;
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
          _isForcing = false;
          setTimeout(function () {
            startCheck();
            if (!_regOk) { regLogout(); _regOk = true; }
          }, 2000);
          console.log('[LB] login OK uid=' + uid.slice(0, 6) + '***');
        }
      }
    );
  }

  function startCheck() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(doCheck, INTERVAL);
  }

  function doCheck() {
    if (!_tok || !_uid || _isForcing) return;
    api('GET', '/api/protected-data', null,
      { Authorization: 'Bearer ' + _tok, 'X-User-Id': _uid, 'X-Device-Id': _did },
      function (err, res, st) {
        if (err || _isForcing) return;
        if (st === 403) {
          clearInterval(_timer); _timer = null;
          clearToken(); clearUser();
          console.warn('[LB] kicked 403');
          showKicked();
        } else if (st === 401) {
          clearInterval(_timer); _timer = null;
          doLogin(_uid, _did, false);
        }
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
        var href   = (el.getAttribute && el.getAttribute('href'))        || '';
        var action = (el.getAttribute && el.getAttribute('data-action')) || '';
        var page   = (el.getAttribute && el.getAttribute('data-page'))   || '';
        if (href.indexOf('logout') > -1 || action === 'logout' || page === 'logout') {
          doLogout(_uid, _tok, _did);
          clearToken();
          clearUser();
          break;
        }
      }
    }, true);
  }

  /* ── 초기화 폴링 ── */
  var _pollN = 0;
  var _pollMax = Math.ceil(MAX_WAIT / POLL_MS);
  var _started = false;

  function tryStart() {
    if (_started) return;

    var loggedIn = isLoggedIn();
    var uid = getMid();

    if (!loggedIn && !uid) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, POLL_MS);
      } else {
        console.log('[LB] ' + (MAX_WAIT / 1000) + 's 비로그인 → 종료');
      }
      return;
    }

    if (!uid) {
      _pollN++;
      if (_pollN < _pollMax) {
        setTimeout(tryStart, POLL_MS);
        return;
      }
      uid = 'ANON_' + getDeviceId();
    }

    _started = true;
    _mid = uid;
    var did = getDeviceId();
    console.log('[LB] init uid=' + uid.slice(0, 6) + '*** poll=' + _pollN);

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

  /* IMWEB_DEPLOY_STRATEGY 이벤트 → 재시도 */
  window.addEventListener('IMWEB_DEPLOY_STRATEGY', function () {
    console.log('[LB] IMWEB_DEPLOY_STRATEGY → retry');
    if (!_started) { _pollN = 0; setTimeout(tryStart, 300); }
  });

  /* SPA 이동 감지 */
  var _prevUrl = location.href;
  setInterval(function () {
    if (location.href !== _prevUrl) {
      _prevUrl = location.href;
      _pollN = 0; _started = false; _mid = '';
      setTimeout(tryStart, 1000);
    }
    if (_uid) {
      var cur = getMid();
      if (cur && cur !== _uid) {
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
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tryStart, 1500); });
  } else {
    setTimeout(tryStart, 1500);
  }

  /* ── 디버그 API ── */
  window._lb = {
    ver: VER,
    status: function () {
      console.table({
        ver:     VER,
        uid:     _uid  || '(없음)',
        did:     _did  || '(없음)',
        token:   _tok  ? _tok.slice(0, 12) + '...' : '(없음)',
        timer:   _timer ? 'ON' : 'OFF',
        isLogin: isLoggedIn(),
        mid:     getMid() || '(미감지)',
        m20:     _m20  || '(없음)',
        pollN:   _pollN,
        forcing: _isForcing
      });
    },
    mid:      function () { return getMid(); },
    did:      function () { return getDeviceId(); },
    tok:      function () { return _tok; },
    check:    function () { doCheck(); },
    kick:     function () { if (_timer) clearInterval(_timer); showKicked(); },
    occupied: function () { showOccupied(_uid || 'test', _did || 'test'); },
    dump:     function () {
      console.log('__bs_imweb :', window.__bs_imweb);
      console.log('_m20       :', _m20);
      console.log('getMid()   :', getMid());
      console.log('isLoggedIn :', isLoggedIn());
      console.log('cookies    :', document.cookie);
    },
    reset: function () {
      if (_timer) clearInterval(_timer);
      clearToken(); clearUser();
      _tok = ''; _uid = ''; _did = ''; _mid = ''; _m20 = '';
      _started = false; _pollN = 0; _regOk = false; _timer = null; _isForcing = false;
      delete window.__lbLoaded;
      setTimeout(function () { window.__lbLoaded = true; tryStart(); }, 300);
    }
  };

  console.log('[LB] ' + VER + ' ready');
}());
