(function(){
  console.log('Widget script v5.9.27 loaded');
  /* v4.9.41 - 임플란트코디 그룹 기반 클리닉 공유: 같은 그룹 계정은 같은 클리닉 데이터 공유 */

  var API = 'https://dental-point.pages.dev';
  window.dptGoToPatients = function(name) {
    globalPatQ = name || '';
    if (typeof window !== 'undefined') window._dpt_global_q = name || '';
    var btn = document.querySelector('[data-p="patients"]');
    if (btn) btn.click();
    else if (typeof window.__dptRenderPage === 'function') window.__dptRenderPage('patients');
  };
  /* 전역 상태 - pgSet과 showTemplateModal 간 공유 */
  var _autoRules = [];
  /* 세션 중 share 처리된 쿠폰 코드 캐시 (페이지 이동 후 돌아와도 유지) */
  var _sharedCodesCache = {};
  try { _sharedCodesCache = JSON.parse(sessionStorage.getItem('dpt_shared_codes') || '{}'); } catch(e) {}
  function markSharedCode(code) {
    if (_sharedCodesCache[code]) return; /* 이미 처리된 코드는 무시 */
    _sharedCodesCache[code] = Date.now();
    try { sessionStorage.setItem('dpt_shared_codes', JSON.stringify(_sharedCodesCache)); } catch(e) {}
  }
  function isSharedCode(code) { return !!_sharedCodesCache[code]; }
  /* 세션 중 shared 코드 수 → 대시보드 카운트 보정용 */
  function getSharedCount() { return Object.keys(_sharedCodesCache).length; }

  /* root 찾기 또는 생성 */
  // Ensure XLSX library is loaded dynamically if not present
  if (typeof window.XLSX === 'undefined' && !document.getElementById('dpt-xlsx-script')) {
    var script = document.createElement('script');
    script.id = 'dpt-xlsx-script';
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    document.head.appendChild(script);
  }

  var root = document.getElementById('dpt-widget-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dpt-widget-root';
    root.style.cssText = 'display:block;width:100%;font-family:Noto Sans KR,sans-serif';
    var cs = document.currentScript;
    if (cs && cs.parentNode) cs.parentNode.insertBefore(root, cs);
    else document.body.appendChild(root);
  }

  /* 이미 앱이 정상 렌더링된 경우만 재실행 차단 */
  if (root.querySelector('.dpt-app-loaded')) return;

  /* CSS 애니메이션 */
  if (!document.getElementById('dpt-style')) {
    var st = document.createElement('style');
    st.id = 'dpt-style';
    st.textContent = '@keyframes dptSpin{to{transform:rotate(360deg)}}@keyframes dptFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes dptSlideDown{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(st);
  }

  var debugLog = [];
  function dlog(msg) { debugLog.push('[' + new Date().toISOString().substr(11,8) + '] ' + msg); try { console.log('DPT: ' + msg); } catch(e){} }

  /* ===== XSS 방지: HTML 이스케이프 ===== */
  function escH(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  /* ===== tooltip: JS 기반 풍선말 ===== */
  var _tipEl = null;
  function _showTip(el) {
    var msg = el.getAttribute('data-tooltip');
    if (!msg) return;
    _hideTip();
    _tipEl = document.createElement('div');
    _tipEl.style.cssText = 'position:fixed;z-index:999999;background:#1e293b;color:#fff;font-size:11px;font-weight:500;padding:6px 12px;border-radius:8px;white-space:nowrap;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.2);line-height:1.4;font-family:Noto Sans KR,sans-serif;opacity:0;transition:opacity .15s ease';
    _tipEl.textContent = msg;
    var arrow = document.createElement('div');
    arrow.style.cssText = 'position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #1e293b';
    _tipEl.appendChild(arrow);
    document.body.appendChild(_tipEl);
    var r = el.getBoundingClientRect();
    var tw = _tipEl.offsetWidth;
    var left = r.left + r.width / 2 - tw / 2;
    if (left < 4) left = 4;
    if (left + tw > window.innerWidth - 4) left = window.innerWidth - 4 - tw;
    _tipEl.style.left = left + 'px';
    _tipEl.style.top = (r.top - _tipEl.offsetHeight - 8) + 'px';
    setTimeout(function() { if (_tipEl) _tipEl.style.opacity = '1'; }, 10);
  }
  function _hideTip() {
    if (_tipEl) { _tipEl.remove(); _tipEl = null; }
  }
  /* 이벤트 위임: document 레벨에서 모든 .dpt-tooltip 요소 감지 */
  document.addEventListener('mouseover', function(e) {
    var t = e.target.closest('.dpt-tooltip[data-tooltip]');
    if (t) _showTip(t);
  });
  document.addEventListener('mouseout', function(e) {
    var t = e.target.closest('.dpt-tooltip[data-tooltip]');
    if (t) _hideTip();
  });

  /* ===== fallbackCopy: 클립보드 폴백 ===== */
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch(e) { dlog('fallbackCopy 실패: ' + e.message); }
  }

  function spin(msg) {
    root.innerHTML = '<div style="padding:20px;text-align:center"><div style="display:inline-block;width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:dptSpin .7s linear infinite"></div><p style="font-size:13px;color:#9ca3af;margin:8px 0 0">' + (msg||'확인 중...') + '</p></div>';
  }

  function errUI(msg) {
    root.innerHTML = '<div style="padding:20px;background:#fff;border-radius:12px;border:1px solid #fee2e2">'
      + '<p style="font-size:13px;color:#ef4444;margin:0 0 8px">' + escH(msg) + '</p>'
      + '<button onclick="location.reload()" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;font-family:inherit">새로고침</button>'
      + '<details style="margin-top:8px"><summary style="font-size:11px;color:#9ca3af;cursor:pointer">디버그 로그</summary>'
      + '<pre style="font-size:9px;color:#6b7280;background:#f9fafb;padding:8px;border-radius:6px;margin-top:4px;white-space:pre-wrap;max-height:200px;overflow-y:auto">' + escH(debugLog.join('\n')) + '</pre></details></div>';
  }

  /* ===== 1단계: imweb_member_id 감지 ===== */
  function getMemberId() {
    /* 방법1: __bs_imweb sdk_jwt */
    try {
      var bs = window.__bs_imweb;
      if (!bs) {
        var ck = document.cookie.split(';');
        for (var i = 0; i < ck.length; i++) {
          var c = ck[i].trim();
          if (c.indexOf('__bs_imweb=') === 0) { bs = JSON.parse(decodeURIComponent(c.substring(11))); break; }
        }
      }
      if (bs) {
        var no = bs.member_no || bs.memberNo || (bs.member && bs.member.no);
        if (no) { dlog('ID:member_no=' + no); return String(no); }
        if (bs.sdk_jwt) {
          var p = JSON.parse(atob(bs.sdk_jwt.split('.')[1]));
          var sub = p.sub || p.member_code || p.mc || '';
          if (sub && sub !== 'null') { dlog('ID:jwt.sub=' + sub); return String(sub); }
        }
      }
    } catch(e) { dlog('ID오류:' + e.message); }

    /* 방법2: 전역 변수 */
    var gk = ['member_data','JEJU_MEMBER','__MEMBER__','memberData','_member','member','user_data'];
    for (var g = 0; g < gk.length; g++) {
      try {
        var o = window[gk[g]];
        if (o && typeof o === 'object') {
          var mid = o.member_code || o.code || o.id || o.no || o.member_id || o.memberCode || '';
          if (mid) { dlog('ID:window.' + gk[g] + '=' + mid); return String(mid); }
        }
      } catch(e) {}
    }

    /* 방법3: localStorage - ★ SDK/전역변수로 못 잡았을 때만, 현재 로그인 중일 때만 사용 */
    /* ★ 이미 로그인 확인(isLoggedIn)은 상위 tryImmediate/tryStart에서 체크됨 */
    /* ★ 단, 로그아웃 상태인지 명시적으로 확인할 수 없으므로 prev_id 용도로만 사용 금지 */
    /* ★ localStorage는 저장만 하고, 직접 읽어서 member_id로 사용하지 않음 */
    /* (같은 브라우저에서 다른 계정으로 전환 시 오매칭 방지) */
    dlog('ID:SDK/전역변수 감지 실패');

    /* 방법4: URL/cookie 기반 안정 ID - ★ 최후 수단으로만 사용 (실제 member_id 아님) */
    /* ★ site_ ID는 폴링 타임아웃 후에만 사용, 즉시실행(tryImmediate)에서는 사용 안 함 */
    return '';  /* ★ 즉시실행에서는 site_ ID 사용 안 함 - SDK가 준비될 때까지 폴링 */
  }

  /* ===== 2단계: 로그인 이름 감지 ===== */
  function getLoginName() {
    /* 방법1: SDK */
    try {
      var bs = window.__bs_imweb;
      if (bs) {
        var fields = ['member_name','memberName','nick','nickname','user_name'];
        for (var f = 0; f < fields.length; f++) {
          if (bs[fields[f]] && typeof bs[fields[f]] === 'string') {
            var n = bs[fields[f]].trim();
            if (n && n.length >= 1 && !isSysWord(n)) { dlog('이름:SDK=' + n); return n; }
          }
        }
        /* member 하위 */
        var m = bs.member || bs.memberData;
        if (m) {
          var mf = ['name','nick','nickname'];
          for (var mfi = 0; mfi < mf.length; mfi++) {
            if (m[mf[mfi]] && !isSysWord(m[mf[mfi]])) { dlog('이름:SDK.member=' + m[mf[mfi]]); return m[mf[mfi]].trim(); }
          }
        }
      }
    } catch(e) {}

    /* 방법2: "XXX | Logout" 또는 "XXX님" 패턴 */
    try {
      var bt = (document.body.textContent || '').replace(/\s+/g, ' ');
      /* "이름 | Logout" 패턴 */
      var m1 = bt.match(/([^\s|│\/]{1,20})\s*[|│]\s*Logout/);
      if (m1) {
        var candidate = m1[1].trim().replace(/님$/, '');
        if (!isSysWord(candidate) && candidate.length >= 1) { dlog('이름:body패턴=' + candidate); return candidate; }
      }
      /* "이름님" 패턴 */
      var m2 = bt.match(/([가-힣a-zA-Z0-9]{2,15})님\s*(?:\||로그아웃|Logout)/);
      if (m2 && !isSysWord(m2[1])) { dlog('이름:님패턴=' + m2[1]); return m2[1]; }
    } catch(e) {}

    /* 방법3: DOM 탐색 */
    try {
      var links = document.querySelectorAll('a');
      var logoutEl = null;
      for (var li = 0; li < links.length; li++) {
        var lt = (links[li].textContent || '').trim();
        var lh = (links[li].getAttribute('href') || '');
        if (lt === 'Logout' || lt === '로그아웃' || lh.indexOf('logout') !== -1) { logoutEl = links[li]; break; }
      }
      if (logoutEl) {
        /* 앞 형제 텍스트 */
        var prev = logoutEl.previousSibling;
        if (prev && prev.nodeType === 3) {
          var pn = prev.textContent.trim().replace(/^[\s|│\/·•]+|[\s|│\/·•]+$/g, '').replace(/님$/, '').trim();
          if (pn && !isSysWord(pn)) { dlog('이름:앞텍스트=' + pn); return pn; }
        }
        /* 앞 형제 요소 */
        var prevE = logoutEl.previousElementSibling;
        if (prevE) {
          var pen = prevE.textContent.trim().replace(/^[\s|│\/]+|[\s|│\/]+$/g, '').replace(/님$/, '');
          if (pen === '|' || pen === '│') {
            var pp = prevE.previousElementSibling;
            if (pp) { var ppn = pp.textContent.trim().replace(/님$/, ''); if (!isSysWord(ppn)) { dlog('이름:구분자앞=' + ppn); return ppn; } }
          }
          if (!isSysWord(pen)) { dlog('이름:앞형제=' + pen); return pen; }
        }
        /* 부모 자식들 순회 */
        var par = logoutEl.parentElement;
        if (par) {
          var ch = par.childNodes;
          for (var ci = ch.length - 1; ci >= 0; ci--) {
            var cn = ch[ci];
            if (cn === logoutEl || (cn.contains && cn.contains(logoutEl))) continue;
            var cnt = (cn.textContent || '').trim().replace(/^[\s|│\/·•]+|[\s|│\/·•]+$/g, '').replace(/님$/, '').trim();
            if (cnt === 'Logout' || cnt === '로그아웃' || cnt === '|' || cnt === '│') continue;
            if (cnt && cnt.length >= 1 && !isSysWord(cnt)) { dlog('이름:부모자식=' + cnt); return cnt; }
          }
        }
      }
    } catch(e) { dlog('이름감지오류:' + e.message); }

    return '';
  }

  /* ★ SYSWORDS: 메뉴/시스템 텍스트만 포함 - 치과명/사람이름이 될 수 있는 단어는 제외 */
  var SYSWORDS = ['마이페이지','로그인','회원가입','로그아웃','Logout','Login','Sign Up','My Page','MyPage',
    '홈','메뉴','치료계획','상담','공지사항','소개','갤러리','문의','예약','게시판','Home','Menu',
    '아임웹 사용자','임플란트코디 사용자','관리','admin','Admin','포인트','쿠폰','쿠폰관리','설정','대시보드','브랜드관리',
    '장바구니','주문조회','Cart','Order','결제','마이','My','더보기',
    '브랜드','서비스','About','Contact','Shop','Blog',
    'Alarm','alarm','알림','Notification','notification','알림함','Bell','bell',
    'Search','검색','Profile','프로필','회원정보','내정보','개인정보',
    '포인트쿠폰','포인트관리','쿠폰발급','회원관리','고객관리','주문관리','재고관리'];
  function isSysWord(n) {
    if (!n) return true;
    var t = n.trim();
    if (!t || t.length < 1 || t.length > 30) return true;
    for (var i = 0; i < SYSWORDS.length; i++) { if (t === SYSWORDS[i]) return true; }
    if (/^[\d\s|│\/·•\-_=+]+$/.test(t)) return true;
    return false;
  }

  /* ===== 3단계: 로그인 여부 확인 ===== */
  function isLoggedIn() {
    try {
      var links = document.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        var t = (links[i].textContent || '').trim();
        var h = (links[i].getAttribute('href') || '');
        if (t === 'Logout' || t === '로그아웃' || h.indexOf('logout') !== -1) return true;
      }
    } catch(e) {}
    return false;
  }

  /* ===== 메인 시작 ===== */
  spin('계정 확인 중...');
  dlog('위젯시작 v5.9.6');

  /* ★ 즉시 시도: SDK(__bs_imweb)에 데이터가 이미 있으면 폴링 없이 바로 실행 */
  /* ★ 방법4(site_ ID)는 여기서 사용 안 함 - 진짜 SDK member_id가 있을 때만 즉시실행 */
  function tryImmediate() {
    var memberId = getMemberId();  /* site_ fallback 없이 SDK/전역변수만 확인 */
    var loggedIn = isLoggedIn();
    /* ★ site_ ID면 즉시실행 안 함 (SDK가 아직 준비 안 된 것) */
    if (memberId && !memberId.startsWith('site_') && loggedIn) {
      var loginName = getLoginName();
      dlog('즉시감지:id=' + memberId + ',name=' + (loginName||'없음') + ',login=' + loggedIn);
      try { localStorage.setItem('dpt_imweb_id', memberId); } catch(e) {}
      doMatch(memberId, loginName);
      return true;
    }
    return false;
  }

  /* 즉시 가능하면 폴링 없이 실행, 아니면 폴링 시작 */
  if (!tryImmediate()) {
    var pollCount = 0;
    var pollMax = 12; /* 최대 12회 × 300ms = 3.6초 */

    function tryStart() {
      var memberId = getMemberId();
      var loggedIn = isLoggedIn();
      dlog('시도' + pollCount + ':id=' + (memberId||'없음') + ',로그인=' + loggedIn);

      if (!loggedIn) {
        if (pollCount >= pollMax) {
          dlog('로그인안됨-종료');
          root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">로그인 후 이용할 수 있습니다.</p></div>';
        } else {
          pollCount++;
          setTimeout(tryStart, 300);
        }
        return;
      }

      /* ★ memberId가 없거나 site_ ID(실제 SDK member_id 아님)이면 폴링 */
      var isRealId = memberId && !memberId.startsWith('site_');
      if (!isRealId) {
        if (pollCount >= pollMax) {
          /* 타임아웃 - site_ 안정ID 사용 (마이그레이션 케이스나 이전 계정 연결용) */
          memberId = 'site_' + window.location.hostname.replace(/[^a-z0-9]/gi, '');
          dlog('안정ID사용(타임아웃):' + memberId);
          /* ★ site_ ID는 이름이 없으면 서버에 보내지 않음 */
          var loginNameFallback = getLoginName();
          if (!loginNameFallback) {
            dlog('site_ID + 이름없음 → 로그인요청');
            root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">로그인 후 이용할 수 있습니다.</p></div>';
            return;
          }
          doMatch(memberId, loginNameFallback);
          return;
        } else {
          pollCount++;
          setTimeout(tryStart, 300);
          return;
        }
      }

      try { localStorage.setItem('dpt_imweb_id', memberId); } catch(e) {}
      var loginName = getLoginName();
      dlog('이름감지:' + (loginName || '없음'));

      if (!loginName && pollCount < pollMax) {
        pollCount++;
        setTimeout(tryStart, 300);
        return;
      }

      doMatch(memberId, loginName);
    }

    setTimeout(tryStart, 150);
  }

  /* ===== 3.5단계: 이메일 감지 ===== */
  function getLoginEmail() {
    try {
      var bs = window.__bs_imweb;
      if (!bs) {
        var ck = document.cookie.split(';');
        for (var i = 0; i < ck.length; i++) {
          var c = ck[i].trim();
          if (c.indexOf('__bs_imweb=') === 0) { bs = JSON.parse(decodeURIComponent(c.substring(11))); break; }
        }
      }
      if (bs) {
        /* 직접 email 필드 */
        var ef = ['email','member_email','memberEmail','user_email'];
        for (var f = 0; f < ef.length; f++) {
          if (bs[ef[f]] && bs[ef[f]].indexOf('@') > 0) { dlog('이메일:SDK=' + bs[ef[f]]); return bs[ef[f]]; }
        }
        /* member 하위 */
        var m = bs.member || bs.memberData;
        if (m) {
          for (var mf = 0; mf < ef.length; mf++) {
            if (m[ef[mf]] && m[ef[mf]].indexOf('@') > 0) { dlog('이메일:SDK.member=' + m[ef[mf]]); return m[ef[mf]]; }
          }
        }
        /* JWT 클레임 */
        if (bs.sdk_jwt) {
          try {
            var p = JSON.parse(atob(bs.sdk_jwt.split('.')[1]));
            if (p.email && p.email.indexOf('@') > 0) { dlog('이메일:jwt=' + p.email); return p.email; }
          } catch(e) {}
        }
      }
    } catch(e) {}
    /* 전역 변수 */
    var gk = ['member_data','JEJU_MEMBER','__MEMBER__','memberData','_member','member','user_data'];
    for (var g = 0; g < gk.length; g++) {
      try {
        var o = window[gk[g]];
        if (o && typeof o === 'object' && o.email && o.email.indexOf('@') > 0) { dlog('이메일:window.' + gk[g] + '=' + o.email); return o.email; }
      } catch(e) {}
    }
    return '';
  }

  /* ===== 3.6단계: 임플란트코디 그룹 감지 ===== */
  /* 임플란트코디에서 같은 치과 소속 계정들을 그룹으로 묶을 수 있음 */
  /* SDK의 member_grade(회원 등급/그룹) 값을 그룹 식별자로 사용 */
  function getLoginGroup() {
    try {
      var bs = window.__bs_imweb;
      if (!bs) {
        var ck = document.cookie.split(';');
        for (var i = 0; i < ck.length; i++) {
          var c = ck[i].trim();
          if (c.indexOf('__bs_imweb=') === 0) { bs = JSON.parse(decodeURIComponent(c.substring(11))); break; }
        }
      }
      if (bs) {
        /* 그룹/등급 직접 필드 */
        var gf = ['member_grade','memberGrade','group','group_code','groupCode','grade','grade_code'];
        for (var f = 0; f < gf.length; f++) {
          var gv = bs[gf[f]];
          if (gv && typeof gv === 'string' && gv.length > 0) { dlog('그룹:SDK.' + gf[f] + '=' + gv); return gv; }
          if (gv && typeof gv === 'number') { dlog('그룹:SDK.' + gf[f] + '=' + gv); return String(gv); }
        }
        /* member 하위 객체 */
        var m = bs.member || bs.memberData;
        if (m) {
          for (var fi = 0; fi < gf.length; fi++) {
            var mv = m[gf[fi]];
            if (mv && (typeof mv === 'string' || typeof mv === 'number') && String(mv).length > 0) {
              dlog('그룹:SDK.member.' + gf[fi] + '=' + mv); return String(mv);
            }
          }
        }
        /* JWT 클레임에서 그룹 정보 추출 */
        if (bs.sdk_jwt) {
          try {
            var p = JSON.parse(atob(bs.sdk_jwt.split('.')[1]));
            var jg = p.group || p.grade || p.member_grade || p.grp || '';
            if (jg) { dlog('그룹:JWT=' + jg); return String(jg); }
          } catch(e) {}
        }
      }
    } catch(e) {}
    /* 전역 변수 탐색 */
    var wk = ['member_data','JEJU_MEMBER','__MEMBER__','memberData','_member','member'];
    var wgf = ['member_grade','group','group_code','grade'];
    for (var g = 0; g < wk.length; g++) {
      try {
        var wo = window[wk[g]];
        if (wo && typeof wo === 'object') {
          for (var wf = 0; wf < wgf.length; wf++) {
            if (wo[wgf[wf]]) { dlog('그룹:window.' + wk[g] + '.' + wgf[wf] + '=' + wo[wgf[wf]]); return String(wo[wgf[wf]]); }
          }
        }
      } catch(e) {}
    }
    dlog('그룹:감지실패');
    return '';
  }

  /* ===== 4단계: 서버 매칭 ===== */
  function doMatch(memberId, loginName) {
    var loginEmail = getLoginEmail();
    var loginGroup = getLoginGroup();
    dlog('doMatch:id=' + memberId + ',name=' + loginName + ',email=' + (loginEmail ? loginEmail.substring(0,5)+'***' : '없음') + ',group=' + (loginGroup||'없음'));

    /* 클리닉 정보 수집 */
    var clinicName = '', clinicPhone = '', clinicAddr = '';
    try {
      var sk = ['JEJU_SITE','site_info','__SITE__','siteInfo'];
      for (var s = 0; s < sk.length; s++) { var so = window[sk[s]]; if (so && so.name) { clinicName = so.name; clinicPhone = so.phone || so.tel || ''; clinicAddr = so.address || so.addr || ''; break; } }
      /* ★ title 태그에서 클리닉명 추출 시 SYSWORDS 필터 적용 */
      /* (쿠폰관리, 마이페이지 같은 페이지명이 clinicName으로 들어오는 것 방지) */
      if (!clinicName) {
        var te = document.querySelector('title');
        if (te) {
          var titleRaw = te.textContent.split('|')[0].split('-')[0].trim();
          if (!isSysWord(titleRaw)) clinicName = titleRaw;
        }
      }
      /* ★ 닉네임이 있으면 clinicName 우선순위: 글로벌변수 > 닉네임 > title */
      /* 닉네임 자체가 치과명인 경우 clinicName이 없거나 isSysWord인 경우 닉네임 사용 */
      if (!clinicName && loginName && !isSysWord(loginName)) clinicName = loginName;
      if (!clinicPhone) { var tls = document.querySelectorAll('a[href^="tel:"]'); if (tls.length) clinicPhone = (tls[0].getAttribute('href')||'').replace('tel:',''); }
    } catch(e) {}

    var prevId = '';
    try { prevId = localStorage.getItem('dpt_imweb_prev_id') || ''; } catch(e) {}
    try { localStorage.setItem('dpt_imweb_prev_id', memberId); } catch(e) {}

    var body = {
      imweb_member_id: memberId,
      imweb_name: loginName || '',
      imweb_email: loginEmail || '',
      imweb_group: loginGroup || '',
      imweb_phone: '',
      imweb_clinic_name: clinicName || '',
      imweb_clinic_phone: clinicPhone || '',
      imweb_clinic_addr: clinicAddr || ''
    };
    if (prevId && prevId !== memberId) body.previous_id = prevId;

    dlog('요청:' + JSON.stringify(body));

    fetch(API + '/api/auth/imweb-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      dlog('응답:matched=' + d.matched + ',need_name=' + d.need_name);
      if (d.matched && d.token) {
        renderApp(d.token, d.member, d.clinics || []);
      } else if (d.need_name) {
        showNameInputUI(memberId, clinicName, clinicPhone, clinicAddr, prevId);
      } else {
        errUI((d.error || '연결 실패') + ' (ID: ' + memberId + ')');
      }
    })
    .catch(function(e) {
      dlog('오류:' + e.message);
      errUI('서버 연결 오류: ' + e.message);
    });
  }

  /* ===== 이름 직접 입력 UI ===== */
  function showNameInputUI(memberId, clinicName, clinicPhone, clinicAddr, prevId) {
    dlog('이름입력UI표시');
    root.innerHTML = '<div style="padding:20px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">'
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:14px 18px;color:#fff;border-radius:10px;margin-bottom:16px">'
      + '<div style="font-size:15px;font-weight:700">포인트 & 쿠폰 관리</div>'
      + '<div style="font-size:12px;opacity:.8;margin-top:2px">처음 접속하셨나요? 치과 이름을 입력해 주세요.</div></div>'
      + '<div style="margin-bottom:10px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">치과(클리닉) 이름</label>'
      + '<input id="dpt-ni" type="text" placeholder="예: 임플란트코디치과" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit" /></div>'
      + '<button id="dpt-ns" style="width:100%;padding:11px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">시작하기</button>'
      + '<p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:8px">처음 1회만 입력 후 자동 연결됩니다.</p></div>';
    var inp = document.getElementById('dpt-ni');
    if (inp) inp.focus();
    var btn = document.getElementById('dpt-ns');
    if (btn) {
      btn.addEventListener('click', function() {
        var name = (document.getElementById('dpt-ni').value || '').trim();
        if (!name) { document.getElementById('dpt-ni').style.borderColor = '#ef4444'; return; }
        btn.textContent = '확인 중...'; btn.disabled = true;
        var body2 = { imweb_member_id: memberId, imweb_name: name, imweb_email: '', imweb_phone: '', imweb_clinic_name: clinicName || name, imweb_clinic_phone: clinicPhone || '', imweb_clinic_addr: clinicAddr || '' };
        if (prevId && prevId !== memberId) body2.previous_id = prevId;
        fetch(API + '/api/auth/imweb-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body2) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.matched && d.token) renderApp(d.token, d.member, d.clinics || []);
          else errUI(d.error || '등록 실패. 새로고침 후 다시 시도해 주세요.');
        })
        .catch(function(e) { errUI('오류: ' + e.message); });
      });
      inp.addEventListener('keypress', function(e) { if (e.key === 'Enter') btn.click(); });
    }
  }

  /* ===== 5단계: 앱 렌더링 ===== */
  var authToken = '', authMember = null, authClinics = [], currentClinic = null, currentPage = 'dashboard';

  function renderApp(token, member, clinics) {
    authToken = token; authMember = member; authClinics = clinics;
    currentClinic = clinics[0] || null;
    dlog('렌더:role=' + member.role + ',clinic=' + (currentClinic ? currentClinic.name : '없음'));
    if (member.role === 'super_admin' || member.role === 'clinic_admin') renderAdmin();
    else renderPatient();
  }

  function F(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  // Listen for postMessage from QR scanner
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'coupon_used') {
      _handleCouponUsed();
    }
  });
  // BroadcastChannel listener (same-origin tabs)
  if (window.BroadcastChannel) {
    try {
      var _bc = new BroadcastChannel('dental-point-events');
      _bc.onmessage = function(e) {
        if (e.data && e.data.type === 'coupon_used') { _handleCouponUsed(); }
      };
    } catch(e) {}
  }
  function _handleCouponUsed() {
    toast('쿠폰 사용이 처리되었습니다. 목록을 새로고침합니다.');
    if (typeof renderPage === 'function') {
      var pg = document.getElementById('dpt-pg');
      if (pg) {
        if (document.getElementById('dpt-pat-search')) {
          var m = document.getElementById('dpt-issued-modal');
          if (m) m.remove();
          document.querySelector('[data-p="patients"]')?.click();
        } else if (document.getElementById('dpt-cpn-tbody')) {
          document.querySelector('[data-p="coupons"]')?.click();
        } else {
          renderPage();
        }
      }
    }
  }

  function CID() { return currentClinic && currentClinic.id || 0; }
  function CN() { return currentClinic && currentClinic.name || '치과'; }
  function toast(msg, type) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:dptFadeIn .3s ease;font-family:Noto Sans KR,sans-serif';
    d.style.background = type === 'error' ? '#ef4444' : '#2563eb';
    d.textContent = msg; document.body.appendChild(d);
    setTimeout(function() { d.remove(); }, 3000);
  }
  var SPIN_HTML = '<div style="padding:40px;text-align:center"><div style="display:inline-block;width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:dptSpin .7s linear infinite"></div></div>';
  var SKEL_ROW = '<div style="padding:10px 14px;border-bottom:1px solid #d1d5db"><div style="height:13px;width:55%;background:#f3f4f6;border-radius:4px;margin-bottom:8px"></div><div style="height:11px;width:35%;background:#f9fafb;border-radius:4px"></div></div>';
  var SKEL_CARD = '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e5e7eb"><div style="height:11px;width:50%;background:#f3f4f6;border-radius:4px;margin-bottom:8px"></div><div style="height:18px;width:40%;background:#f3f4f6;border-radius:4px"></div></div>';
  var SKEL_TABLE = SKEL_ROW + SKEL_ROW + SKEL_ROW;

  function callAPI(path, opts) {
    opts = opts || {};
    var hd = { 'Content-Type': 'application/json' };
    if (authToken) hd['Authorization'] = 'Bearer ' + authToken;
    var fo = { method: opts.method || 'GET', headers: Object.assign(hd, opts.headers || {}) };
    if (opts.body) fo.body = opts.body;
    if (!fo.method || fo.method.toUpperCase() === 'GET') { path += (path.indexOf('?') !== -1 ? '&' : '?') + '_t=' + Date.now(); }
    return fetch(API + '/api' + path, fo)
      .then(function(r) {
        return r.text().then(function(text) {
          var data;
          try { data = JSON.parse(text); } catch(e) { throw new Error('서버 응답 오류: ' + text); }
          if (!r.ok) throw new Error(data.error || '서버오류(' + r.status + ')');
          return data;
        });
      });
  }

  function showConfirmModal(title, msg, onOk) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:380px">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 8px">' + escH(title) + '</h3>'
      + '<p style="font-size:13px;color:#6b7280;margin:0 0 20px;white-space:pre-line">' + escH(msg) + '</p>'
      + '<div style="display:flex;gap:8px"><button id="dpt-cfm-cc" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button><button id="dpt-cfm-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">확인</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    document.getElementById('dpt-cfm-cc').addEventListener('click', function() { m.remove(); });
    document.getElementById('dpt-cfm-ok').addEventListener('click', function() { m.remove(); onOk(); });
  }

  /* ==================== 관리자 UI ==================== */
  function renderAdmin() {
    var cn = CN();
    var mn = escH(authMember.name || cn);
    var rl = { super_admin: '최고관리자', clinic_admin: '관리자' }[authMember.role] || '관리자';
    /* ★ 헤더: 큰 글씨 = 닉네임, 작은 글씨 = 역할만 표시 (클리닉명 제거) */
    root.innerHTML = '<div class="dpt-app-loaded" id="dpt-app" style="font-family:Noto Sans KR,sans-serif">'
      + '<div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:16px 20px;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-size:18px;font-weight:700">' + mn + '</div><div style="font-size:12px;opacity:.8;margin-top:2px">' + rl + '</div></div>'
      + '<div style="display:flex;gap:8px;"><button id="dpt-qr-scan" style="background:#fff;border:none;color:#2563eb;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 2px 4px rgba(0,0,0,0.1)">QR 스캔</button>'
      + '<button id="dpt-lo" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">로그아웃</button></div></div>'
      + '<div id="dpt-nav" style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 8px;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch"></div>'
      + '<div id="dpt-pg" style="background:#f9fafb;padding:16px;border-radius:0 0 12px 12px;min-height:400px;border:1px solid #e5e7eb;border-top:none"></div></div>';

    var tabs = [['dashboard','대시보드'],['payment','포인트 적립'],['patients','환자관리'],['coupons','쿠폰관리'],['bulk','대량업로드'],['dentweb','DentWeb'],['settings','설정']];
    if (authMember && authMember.role === 'super_admin') { tabs.push(['global','쿠폰 템플릿']); }
    var nav = document.getElementById('dpt-nav');
    tabs.forEach(function(t) {
      var b = document.createElement('button');
      b.className = 'dpt-nb'; b.setAttribute('data-p', t[0]);
      b.style.cssText = 'display:inline-block;padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap';
      b.textContent = t[1];
      b.addEventListener('click', function() { 
        if (t[0] === 'patients' && !window._dpt_global_q) {
          globalPatQ = ''; // Clear search when manually clicking tab
        }
        currentPage = t[0]; 
        renderPage(); 
      });
      nav.appendChild(b);
    });
    document.getElementById('dpt-qr-scan').addEventListener('click', function() {
      window.open(API + '/scan?clinic_id=' + CID(), '_blank', 'width=500,height=800');
    });
    document.getElementById('dpt-lo').addEventListener('click', function() {
      authToken = ''; authMember = null; authClinics = []; currentClinic = null;
      try {
        ['dpt_admin_token','dpt_admin_member','dpt_admin_clinics','dpt_admin_current_clinic','dpt_imweb_clinic_name','dpt_imweb_id'].forEach(function(k) { localStorage.removeItem(k); });
      } catch(e) {}
      root.innerHTML = '<div style="padding:20px;text-align:center"><p style="color:#2563eb;font-weight:600;font-size:14px">로그아웃 되었습니다.<br>페이지를 새로고침해 주세요.</p></div>';
    });
    renderPage();
  }

  function updNav() {
    document.querySelectorAll('.dpt-nb').forEach(function(b) {
      var active = b.getAttribute('data-p') === currentPage;
      b.style.color = active ? '#2563eb' : '#6b7280';
      b.style.fontWeight = active ? '700' : '500';
      b.style.borderBottomColor = active ? '#2563eb' : 'transparent';
    });
  }

  window.__dptRenderPage = function(page) { if (page) { currentPage = page; } renderPage(); };
  function renderPage() {
    updNav();
    var pg = document.getElementById('dpt-pg');
    if (!pg) return;
    var pages = { dashboard: pgDash, payment: pgPay, patients: pgPat, coupons: pgCpn, bulk: pgBulk, dentweb: pgDentweb, settings: pgSet, global: pgGlobal };
    (pages[currentPage] || pgDash)(pg);
  }

  /* --- 대시보드 --- */
  function pgDash(el) {
    el.innerHTML = SPIN_HTML;
    Promise.all([callAPI('/dashboard?clinic_id=' + CID()), callAPI('/sync/status?clinic_id=' + CID())])
    .then(function(res) {
      var d = res[0]; var sync = res[1];
      var birthdays = d.birthday_patients || [];
      var todayStr = new Date().toLocaleDateString('ko-KR', {month:'long', day:'numeric'});

      /* 생일 환자 섹션 HTML */
      var bdHtml = '';
      if (birthdays.length > 0) {
        var showList = birthdays;
        bdHtml = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:14px;overflow:hidden">'
          + '<div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #d1d5db">'
          + '<span style="font-size:14px;font-weight:700;color:#1f2937">오늘 생일 환자</span>'
          + '<span style="font-size:11px;color:#6b7280;background:#f3f4f6;border-radius:20px;padding:2px 8px;font-weight:600">' + birthdays.length + '명</span>'
          + '<span style="font-size:11px;color:#9ca3af;margin-left:auto">' + todayStr + '</span></div>'
          + '<div>' + showList.map(function(p) {
            var age = p.birth_date ? (new Date().getFullYear() - parseInt(p.birth_date.slice(0,4))) + '세' : '';
            /* active + used 쿠폰 수집 - pp[2]=coupon_kind, pp[8]=is_birthday_issue */
            var issuedCoupons = [];
            if (p.all_coupons) {
              var cArr2 = p.all_coupons.split('||');
              for (var j=0; j<cArr2.length; j++) {
                var pp = cArr2[j].split('::');
                var cStatus = pp[1] || '';
                if (cStatus === 'active' || cStatus === 'used') {
                  var isBd = (pp[2] === 'birthday') || (pp[8] === '1');
                  issuedCoupons.push({name:pp[0]||'',status:cStatus,isBday:isBd,shared:pp[6]||'',code:pp[5]||'',cpId:pp[4]||''});
                }
              }
            }

            /* 뱃지 HTML: 생일 섹션이므로 모두 동일한 생일 컬러로 통일 */
            var badgesArr = [];
            issuedCoupons.forEach(function(ic){
              var isUsed = ic.status === 'used';
              var isShared = ic.status === 'active' && !!ic.shared;
              var stLabel = isUsed ? '사용완료' : (isShared ? '전송' : '발행');
              /* 생일 뱃지: 핑크/로즈, 발행/전송/사용완료 뱃지: 색상 구별 */
              var stBg = isUsed ? '#fee2e2' : (isShared ? '#d1fae5' : '#dbeafe');
              var stFg = isUsed ? '#dc2626' : (isShared ? '#059669' : '#1d4ed8');
              /* 발행 상태(미전송)이면 클릭 가능하게 */
              var isClickable = !isUsed && !isShared && ic.code;
              var clickAttr = isClickable ? ' class="dpt-bd-badge-share" data-code="'+escH(ic.code)+'" data-tname="'+escH(ic.name)+'" data-pname="'+escH(p.name)+'" style="display:inline-flex;align-items:center;gap:3px;white-space:nowrap;vertical-align:middle;cursor:pointer;padding:2px 4px;border-radius:6px;border:1px dashed #93c5fd;background:#f0f7ff;transition:background .2s"' : ' style="display:inline-flex;align-items:center;gap:3px;white-space:nowrap;vertical-align:middle"';
              var stTooltip = isUsed ? '' : (isShared ? '' : ' class="dpt-tooltip" data-tooltip="클릭하여 링크를 전송하세요"');
              badgesArr.push('<span' + clickAttr + '>'
                + '<span style="font-size:9px;padding:1px 4px;border-radius:4px;background:#fce7f3;color:#be185d;font-weight:700;line-height:1.3">생일</span>'
                + '<span' + stTooltip + ' style="font-size:10px;padding:1px 5px;border-radius:4px;background:'+stBg+';color:'+stFg+';font-weight:700;line-height:1.3">'+escH(stLabel)+'</span>'
                + '<span style="font-size:12px;color:#374151;font-weight:500;vertical-align:middle;line-height:1.3">'+escH(ic.name)+'</span>'
                + (isClickable ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" style="margin-left:2px;flex-shrink:0"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' : '')
                + '</span>');
            });
            var badgesHtml = badgesArr.join('<span style="color:#6b7280;margin:0 6px;font-size:13px;font-weight:700">/</span>');

            var bdIssued = issuedCoupons.length > 0 ? '1' : '0';
            var bdCname = issuedCoupons.length > 0 ? escH(issuedCoupons[issuedCoupons.length-1].name) : '';

            /* 한 행: 이름 | 뱃지들 | 발행버튼 */
            return '<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #d1d5db;min-height:40px">'
              /* 1열: 이름(나이) 포인트 - 고정 너비 */
              + '<div style="flex:0 0 130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
              + '<span class="dpt-birthday-patient-link" data-name="'+escH(p.name)+'" style="cursor:pointer;font-size:12px;font-weight:600;color:#1f2937;text-decoration:underline;text-decoration-color:#bfdbfe;text-underline-offset:2px">'+escH(p.name)+'</span>'
              + (age ? '<span style="font-size:10px;color:#2563eb;margin-left:2px">(' + escH(age) + ')</span>' : '')
              + ' <span style="font-size:11px;font-weight:600;color:#2563eb">'+F(p.available_points)+'P</span>'
              + '</div>'
              /* 2열: 뱃지 - 유연 너비, 줄바꿈 허용 */
              + '<div style="flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;padding:0 8px">'
              + badgesHtml
              + '</div>'
              /* 3열: 발행 버튼 - 고정 너비 */
              + '<div style="flex:0 0 50px;text-align:left">'
              + '<button class="dpt-bd-coupon" data-bday-issued="'+bdIssued+'" data-bday-cname="'+bdCname+'" data-id="'+p.id+'" data-name="'+escH(p.name)+'" style="padding:4px 12px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">발행</button>'
              + '</div>'
              + '</div>';
          }).join('')
          + '</div></div>';
      }

      /* 카드 HTML */
      var cardsHtml = card('오늘 결제', F(d.today && d.today.payment_amount) + '원', d.today && d.today.payment_count + '건', '#1f2937') + card('오늘 적립', F(d.today && d.today.point_earned) + 'P', '', '#2563eb') + card('전체 환자', F(d.total_patients) + '명', '', '#1f2937') + card('활성 쿠폰', (d.active_coupons || 0) + '장', '', '#1f2937');
      /* 자동 쿠폰 발행 대상 & 미전송 쿠폰 — 요약 박스 */
      var autoList = d.auto_eligible || [];
      var dbg = d._debug_auto || {};
      var undelList = d.undelivered_coupons || [];
      var autoTotal = d.auto_eligible_total || autoList.length;
      var undelTotal = d.undelivered_total || undelList.length;
      dlog('pgDash: autoList=' + autoList.length + '/' + autoTotal + ' (pts=' + autoList.filter(function(a){return a.type==='points'}).length + ', bday=' + autoList.filter(function(a){return a.type==='birthday'}).length + '), undelList=' + undelList.length + '/' + undelTotal);
      console.log('%c[DPT] _debug_auto (v5.8.3):', 'color:#2563eb;font-weight:bold', dbg);
      if (dbg.tpl_general === 0 && dbg.tpl_birthday === 0) {
        console.warn('[DPT] auto 템플릿 없음: 일반=' + dbg.tpl_general + ', 생일=' + dbg.tpl_birthday);
      }
      if (dbg.error) {
        console.error('[DPT] auto_eligible 에러:', dbg.error);
      }
      if (dbg.skip_log && dbg.skip_log.length > 0) {
        console.log('%c[DPT] skip된 환자:', 'color:#dc2626;font-weight:bold', dbg.skip_log);
      }

      /* 2개 요약 박스 (파란 테두리, 클릭→쿠폰관리) */
      var autoCount = autoTotal;
      var undelCount = undelTotal;
      var couponBoxesHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">'
        + '<div id="dpt-dash-auto-box" style="background:#fff;border-radius:10px;padding:14px;border:2px solid ' + (autoCount > 0 ? '#3b82f6' : '#e5e7eb') + ';cursor:pointer;transition:box-shadow .2s">'
        + '<p style="font-size:11px;color:#6b7280;margin:0 0 4px;display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>발행 대상</p>'
        + '<p style="font-size:22px;font-weight:700;color:' + (autoCount > 0 ? '#2563eb' : '#9ca3af') + ';margin:0">' + autoCount + '<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">명</span></p>'
        + '<p style="font-size:10px;color:#9ca3af;margin:4px 0 0">최초 발행 · 링크 미전달</p>'
        + '</div>'
        + '<div id="dpt-dash-undel-box" style="background:#fff;border-radius:10px;padding:14px;border:2px solid ' + (undelCount > 0 ? '#3b82f6' : '#e5e7eb') + ';cursor:pointer;transition:box-shadow .2s">'
        + '<p style="font-size:11px;color:#6b7280;margin:0 0 4px;display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>미전송 쿠폰</p>'
        + '<p style="font-size:22px;font-weight:700;color:' + (undelCount > 0 ? '#2563eb' : '#9ca3af') + ';margin:0">' + undelCount + '<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">건</span></p>'
        + '<p style="font-size:10px;color:#9ca3af;margin:4px 0 0">발행 완료 · 미전달</p>'
        + '</div></div>';

      /* 최근 결제 HTML */
      var recentHtml = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="padding:12px 16px;border-bottom:1px solid #d1d5db;font-size:14px;font-weight:600;color:#1f2937">최근 결제</div><div>' + ((d.recent_payments && d.recent_payments.length > 0) ? d.recent_payments.slice(0,5).map(function(p) {
          return '<div style="padding:10px 16px;display:flex;justify-content:space-between;border-bottom:1px solid #d1d5db;cursor:pointer;" onclick="window.dptGoToPatients(\'' + escH(p.patient_name).replace(/'/g, "\\'") + '\')">'
            + '<div><p style="font-size:13px;font-weight:600;color:#1f2937;margin:0;text-decoration:underline;text-decoration-color:#bfdbfe;text-underline-offset:2px;">' + escH(p.patient_name) + ' <span style="font-size:11px;font-weight:400;color:#6b7280;text-decoration:none;">(총 ' + F(p.available_points) + 'P)</span></p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + escH(p.category) + ' · ' + escH(p.payment_date) + '</p></div>'
            + '<div style="text-align:right"><p style="font-size:13px;font-weight:600;color:#1f2937;margin:0">' + F(p.amount) + '원</p><p style="font-size:11px;color:#2563eb;margin:2px 0 0">+' + F(p.point_earned) + 'P</p></div></div>';
        }).join('') : '<p style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">결제 내역 없음</p>') + '</div></div>';

      /* 전체 페이지를 한번에 렌더링 */
      el.innerHTML = '<div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:18px;font-weight:700;color:#1f2937">대시보드</span><span style="font-size:12px;color:#9ca3af">' + new Date().toLocaleDateString('ko-KR') + '</span></div>'
        + '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button id="dpt-dash-issue" style="flex:1;min-width:100px;padding:10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">쿠폰 발행</button><button id="dpt-dash-point" style="flex:1;min-width:100px;padding:10px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151">포인트 적립</button></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' + cardsHtml + '</div>'
        + couponBoxesHtml
        + bdHtml
        + recentHtml
        + '</div>';

      /* 이벤트 바인딩 */
      document.getElementById('dpt-dash-issue') && document.getElementById('dpt-dash-issue').addEventListener('click', function() { currentPage = 'patients'; renderPage(); });
      document.getElementById('dpt-dash-point') && document.getElementById('dpt-dash-point').addEventListener('click', function() { currentPage = 'payment'; renderPage(); });
      document.querySelectorAll('.dpt-birthday-patient-link').forEach(function(link) {
        link.addEventListener('click', function() {
          var patientName = link.getAttribute('data-name') || '';
          globalPatQ = patientName;
          if (typeof window !== 'undefined') window._dpt_global_q = patientName;
          currentPage = 'patients';
          renderPage();
          setTimeout(function() {
            var qInput = document.getElementById('dpt-pat-q');
            var qBtn = document.getElementById('dpt-pat-search');
            if (qInput) qInput.value = patientName;
            if (qBtn) qBtn.click();
          }, 30);
        });
      });
      document.querySelectorAll('.dpt-bd-coupon').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (btn.getAttribute('data-bday-issued') === '1') {
            var cname = btn.getAttribute('data-bday-cname') || '';
            showConfirmModal('안내', '이미 [' + cname + '] 쿠폰을 발행했습니다.\n추가로 쿠폰을 중복 발행하시겠습니까?', function() {
              showCouponIssueModal(btn.getAttribute('data-id'), btn.getAttribute('data-name'), true, [], true);
            });
          } else {
            showCouponIssueModal(btn.getAttribute('data-id'), btn.getAttribute('data-name'), true, [], true);
          }
        });
      });
      /* 발행 배지 클릭 → 해당 쿠폰 공유(링크 전달) 모달 */
      document.querySelectorAll('.dpt-bd-badge-share').forEach(function(badge) {
        badge.addEventListener('click', function(e) {
          e.stopPropagation();
          var code = badge.getAttribute('data-code');
          var tname = badge.getAttribute('data-tname');
          var pname = badge.getAttribute('data-pname');
          dlog('생일배지 클릭 공유: code=' + code + ', tname=' + tname);
          showIssuedCouponModal({code: code, template_name: tname, patient_name: pname}, null, function() {
            /* 공유 성공 시 배지 업데이트 */
            markSharedCode(code);
            var stBadge = badge.querySelector('span:nth-child(2)');
            if (stBadge) { stBadge.textContent = '전송'; stBadge.style.background = '#d1fae5'; stBadge.style.color = '#059669'; }
            badge.style.cursor = 'default'; badge.style.border = 'none'; badge.style.background = 'transparent';
            badge.classList.remove('dpt-bd-badge-share');
            var svgEl = badge.querySelector('svg'); if (svgEl) svgEl.remove();
          });
        });
      });
      /* 대시보드 발행대상 카운트 업데이트 함수 등록 */
      window._dptAutoUpdateCount = function(delta) {
        var dashAutoBox = document.getElementById('dpt-dash-auto-box');
        if (dashAutoBox) {
          var ns = dashAutoBox.querySelector('p[style*="font-size:22px"]');
          if (ns) {
            var cur = parseInt(ns.textContent) || 0;
            var nv = Math.max(0, cur + delta);
            var sub = ns.querySelector('span');
            ns.innerHTML = nv + (sub ? sub.outerHTML : '<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">명</span>');
            ns.style.color = nv > 0 ? '#2563eb' : '#9ca3af';
          }
        }
        /* 쿠폰관리 페이지 카드도 업데이트 */
        var cpnAutoCard = document.querySelector('#dpt-cpn-auto-card');
        if (cpnAutoCard) {
          var cns = cpnAutoCard.querySelector('span[style*="font-size:18px"]');
          if (cns) {
            var ccur = parseInt(cns.textContent) || 0;
            var cnv = Math.max(0, ccur + delta);
            var csub = cns.querySelector('span');
            cns.innerHTML = cnv + (csub ? csub.outerHTML : '<span style="font-size:11px;color:#6b7280;font-weight:500">명</span>');
            cns.style.color = cnv > 0 ? '#2563eb' : '#9ca3af';
          }
        }
      };
      /* 요약 박스 클릭 → 쿠폰관리 페이지로 이동 + 필터 자동 적용 */
      document.getElementById('dpt-dash-auto-box') && document.getElementById('dpt-dash-auto-box').addEventListener('click', function() {
        window._dptCpnAutoFilter = 'auto_eligible';
        currentPage = 'coupons'; renderPage();
      });
      document.getElementById('dpt-dash-undel-box') && document.getElementById('dpt-dash-undel-box').addEventListener('click', function() {
        window._dptCpnAutoFilter = 'unshared';
        currentPage = 'coupons'; renderPage();
      });
      /* 호버 효과 */
      ['dpt-dash-auto-box','dpt-dash-undel-box'].forEach(function(id) {
        var box = document.getElementById(id);
        if (box) {
          box.addEventListener('mouseenter', function() { box.style.boxShadow = '0 2px 8px rgba(37,99,235,.15)'; });
          box.addEventListener('mouseleave', function() { box.style.boxShadow = 'none'; });
        }
      });
      /* 대시보드 카운트 비동기 보정: shared 캐시가 있으면 실시간 API로 정확한 수를 가져옴 */
      if (getSharedCount() > 0) {
        var _cid = CID();
        Promise.all([
          callAPI('/coupons/auto-eligible?clinic_id=' + _cid + '&page=1&limit=1'),
          callAPI('/coupons/undelivered?clinic_id=' + _cid + '&page=1&limit=1')
        ]).then(function(results) {
          var aeTotal = results[0].total_all || results[0].total || 0;
          var udTotal = results[1].total_all || results[1].total || 0;
          /* API 결과에서도 sessionStorage 캐시 보정 (D1 consistency 지연 대비) */
          var aeItems = results[0].coupons || results[0].patients || [];
          var udItems = results[1].coupons || results[1].patients || [];
          var aeCacheMiss = aeItems.filter(function(c) { return isSharedCode(c.code); }).length;
          var udCacheMiss = udItems.filter(function(c) { return isSharedCode(c.code); }).length;
          var finalAe = Math.max(0, aeTotal - aeCacheMiss);
          var finalUd = Math.max(0, udTotal - udCacheMiss);
          /* 발행대상 박스 업데이트 */
          var autoBox = document.getElementById('dpt-dash-auto-box');
          if (autoBox) {
            var aeNum = autoBox.querySelector('p[style*="font-size:22px"]');
            if (aeNum) {
              var aeSub = aeNum.querySelector('span');
              aeNum.innerHTML = finalAe + (aeSub ? aeSub.outerHTML : '<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">명</span>');
              aeNum.style.color = finalAe > 0 ? '#2563eb' : '#9ca3af';
            }
            autoBox.style.borderColor = finalAe > 0 ? '#3b82f6' : '#e5e7eb';
          }
          /* 미전송 쿠폰 박스 업데이트 */
          var undelBox = document.getElementById('dpt-dash-undel-box');
          if (undelBox) {
            var udNum = undelBox.querySelector('p[style*="font-size:22px"]');
            if (udNum) {
              var udSub = udNum.querySelector('span');
              udNum.innerHTML = finalUd + (udSub ? udSub.outerHTML : '<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">건</span>');
              udNum.style.color = finalUd > 0 ? '#2563eb' : '#9ca3af';
            }
            undelBox.style.borderColor = finalUd > 0 ? '#3b82f6' : '#e5e7eb';
          }
        }).catch(function() { /* 보정 실패 시 무시 - 기본값 유지 */ });
      }
    }).catch(function(e) { el.innerHTML = '<p style="padding:20px;color:#ef4444;text-align:center;font-size:13px">' + e.message + '</p>'; });
  }
  function card(lb, v, sub, c) {
    return '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e5e7eb"><p style="font-size:12px;color:#9ca3af;margin:0 0 4px">' + lb + '</p><p style="font-size:18px;font-weight:700;color:' + c + ';margin:0">' + v + '</p>' + (sub ? '<p style="font-size:11px;color:#9ca3af;margin:3px 0 0">' + sub + '</p>' : '') + '</div>';
  }
  function cardH(lb, v, sub, c) {
    return '<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #e5e7eb"><p style="font-size:10px;color:#9ca3af;margin:0 0 4px">' + lb + '</p><p style="font-size:15px;font-weight:700;color:' + c + ';margin:0">' + v + '</p>' + (sub ? '<p style="font-size:10px;color:#9ca3af;margin:2px 0 0">' + sub + '</p>' : '') + '</div>';
  }

  /* --- 결제등록 --- */
  function pgPay(el) {
    var IS = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;';
    el.innerHTML = '<div><div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">포인트 적립</div>'
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
      + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">환자 선택</label>'
      + '<div style="display:flex;gap:8px;margin-bottom:8px;"><input id="dpt-pay-pat-search" type="text" placeholder="이름 또는 전화번호 검색" style="' + IS + '"><button id="dpt-pay-pat-btn" style="padding:10px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">검색</button></div>'
      + '<select id="dpt-pay-pat" style="' + IS + '"><option value="">불러오는 중...</option></select></div>'
      + '<div id="dpt-new-pat-toggle" style="margin-bottom:12px;font-size:13px;color:#2563eb;cursor:pointer">+ 신규 환자 등록</div>'
      + '<div id="dpt-new-pat-form" style="display:none;background:#f0f7ff;border-radius:8px;padding:12px;margin-bottom:12px">'
      + '<div style="margin-bottom:8px"><label style="font-size:12px;color:#374151;display:block;margin-bottom:3px">이름</label><input id="dpt-np-name" type="text" placeholder="홍길동" style="' + IS + '" /></div>'
      + '<div style="margin-bottom:8px"><label style="font-size:12px;color:#374151;display:block;margin-bottom:3px">전화번호</label><input id="dpt-np-phone" type="tel" placeholder="010-0000-0000" style="' + IS + '" /></div>'
      + '<button id="dpt-np-save" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;cursor:pointer;font-family:inherit">등록</button></div>'
      + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">금액</label>'
      + '<input id="dpt-pay-amt" type="text" inputmode="numeric" placeholder="0" style="' + IS + '" /></div>'
      + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">진료 카테고리</label>'
      + '<select id="dpt-pay-cat" style="' + IS + '"><option value="일반진료">불러오는 중...</option></select></div>'
      + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">결제일</label>'
      + '<input id="dpt-pay-date" type="date" value="' + new Date().toISOString().split('T')[0] + '" style="' + IS + '" /></div>'
      + '<div id="dpt-pay-preview" style="background:#f0f7ff;border-radius:8px;padding:12px;margin-bottom:12px;display:none">'
      + '<p style="font-size:13px;font-weight:600;color:#1d4ed8;margin:0">예상 적립 포인트: <span id="dpt-pay-pts">0</span> P</p></div>'
      + '<button id="dpt-pay-submit" style="width:100%;padding:12px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">포인트 적립</button></div></div>';
    Promise.all([callAPI('/clinics/' + CID() + '/patients'), callAPI('/clinics/' + CID())])
    .then(function(res) {
      var patients = res[0].patients || []; var raw = res[1];
      var clinic = raw.clinic || raw;
      var settings = raw.settings || {};
      var defaultRate = settings.default_point_rate !== undefined ? settings.default_point_rate : (clinic.point_rate || 5);
      var catRateList = [];
      try {
        var cr = settings.category_rates;
        if (Array.isArray(cr)) catRateList = cr;
        else if (typeof cr === 'string' && cr) catRateList = JSON.parse(cr);
      } catch(e) {}
      /* 카테고리: category_rates 항목명 기준으로 드롭다운 구성 (적립률 표시 포함) */
      /* catRateList에 없는 기본 카테고리는 defaultRate 적용 */
      var defaultCats = (clinic.categories || '일반진료,보철치료,교정치료,임플란트,기타').split(',').map(function(s){ return s.trim(); });
      var cats; /* { name, rate }[] */
      if (catRateList.length > 0) {
        /* catRateList 카테고리 + 거기 없는 defaultCats도 포함 */
        var rateMap = {};
        catRateList.forEach(function(r) { rateMap[r.category] = r.rate; });
        var allCatNames = catRateList.map(function(r) { return r.category; });
        defaultCats.forEach(function(n) { if (allCatNames.indexOf(n) === -1) allCatNames.push(n); });
        if (allCatNames.indexOf('일반진료') === -1) allCatNames = ['일반진료'].concat(allCatNames);
        cats = allCatNames.map(function(n) { return { name: n, rate: rateMap[n] !== undefined ? rateMap[n] : defaultRate }; });
      } else {
        if (defaultCats.indexOf('일반진료') === -1) defaultCats = ['일반진료'].concat(defaultCats);
        cats = defaultCats.map(function(n) { return { name: n, rate: defaultRate }; });
      }
      /* 환자 select 업데이트 */
      var patSel = document.getElementById('dpt-pay-pat');
      if (patSel) patSel.innerHTML = '<option value="">-- 환자 선택 --</option>' + patients.map(function(p) { return '<option value="' + p.id + '">' + p.name + ' (' + p.phone + ') ' + F(p.available_points) + 'P</option>'; }).join('');
      /* 카테고리 select 업데이트 */
      var catSel = document.getElementById('dpt-pay-cat');
      if (catSel) catSel.innerHTML = cats.map(function(c) { return '<option value="' + c.name + '">' + c.name + ' (' + c.rate + '%)</option>'; }).join('');

      /* 이벤트 */
      var updatePreview = function() {
        var amt = parseInt((document.getElementById('dpt-pay-amt').value || '0').replace(/,/g,'')) || 0;
        var cat = document.getElementById('dpt-pay-cat') ? document.getElementById('dpt-pay-cat').value : '';
        /* cats 배열에서 직접 rate 조회 (name은 value와 동일) */
        var catObj = cats.find(function(c) { return c.name === cat; });
        var rate = catObj ? catObj.rate : defaultRate;
        var pts = Math.floor(amt * (rate / 100));
        if (amt > 0) {
          document.getElementById('dpt-pay-preview').style.display = 'block';
          document.getElementById('dpt-pay-pts').textContent = F(pts);
          document.getElementById('dpt-pay-pts').title = rate + '% 적립';
        } else {
          document.getElementById('dpt-pay-preview').style.display = 'none';
        }
      };
      document.getElementById('dpt-pay-pat-btn').addEventListener('click', function() {
        var q = document.getElementById('dpt-pay-pat-search').value.trim();
        var sel = document.getElementById('dpt-pay-pat');
        sel.innerHTML = '<option value="">검색 중...</option>';
        callAPI('/clinics/' + CID() + '/patients' + (q ? '?search=' + encodeURIComponent(q) : ''))
        .then(function(res) {
          var pts = res.patients || [];
          if (pts.length === 0) {
            sel.innerHTML = '<option value="">검색 결과가 없습니다</option>';
            toast('검색된 환자가 없습니다.', 'error');
          } else {
            sel.innerHTML = '<option value="">' + pts.length + '명 검색됨 (선택하세요)</option>' + pts.map(function(p) { return '<option value="' + p.id + '">' + p.name + ' (' + p.phone + ') ' + F(p.available_points) + 'P</option>'; }).join('');
            if (pts.length === 1) {
              sel.selectedIndex = 1;
              toast(pts[0].name + ' 환자가 자동 선택되었습니다.');
            } else {
              sel.focus();
              toast(pts.length + '명의 환자가 검색되었습니다.');
            }
          }
        }).catch(function(e) { sel.innerHTML = '<option value="">오류 발생</option>'; });
      });
      document.getElementById('dpt-pay-amt').addEventListener('input', function() {
        var v = this.value.replace(/[^0-9]/g,'');
        this.value = v ? Number(v).toLocaleString() : '';
        updatePreview();
      });
      document.getElementById('dpt-pay-cat').addEventListener('change', function() { updatePreview(); });
      document.getElementById('dpt-new-pat-toggle').addEventListener('click', function() {
        var f = document.getElementById('dpt-new-pat-form');
        f.style.display = f.style.display === 'none' ? 'block' : 'none';
      });
      document.getElementById('dpt-np-save').addEventListener('click', function() {
        var name = document.getElementById('dpt-np-name').value.trim();
        var phone = document.getElementById('dpt-np-phone').value.trim();
        if (!name || !phone) { toast('이름과 전화번호를 입력하세요.', 'error'); return; }
        callAPI('/clinics/' + CID() + '/patients', { method:'POST', body: JSON.stringify({name, phone}) })
        .then(function(r) { toast(name + '님이 등록되었습니다.'); pgPay(el); })
        .catch(function(e) { toast(e.message, 'error'); });
      });
      document.getElementById('dpt-pay-submit').addEventListener('click', function() {
        var patId = document.getElementById('dpt-pay-pat').value;
        var amt = parseInt((document.getElementById('dpt-pay-amt').value || '0').replace(/,/g,'')) || 0;
        var cat = document.getElementById('dpt-pay-cat').value;
        var date = document.getElementById('dpt-pay-date').value;
        if (!patId) { toast('환자를 선택하세요.', 'error'); return; }
        if (!amt) { toast('금액을 입력하세요.', 'error'); return; }
        this.textContent = '등록 중...'; this.disabled = true;
        var btn = this;
        callAPI('/payments', { method:'POST', body: JSON.stringify({clinic_id: CID(), patient_id: Number(patId), amount: amt, category: cat, payment_date: date}) })
        .then(function(r) { 
          var msg = '결제 내역 및 포인트가 적립되었습니다.'; if (r.auto_issued_coupons && r.auto_issued_coupons.length > 0) msg += '\n(자동발행 차감: ' + r.auto_issued_coupons.map(function(c){return c.template_name;}).join(', ') + ')'; toast(msg); 
          var sel = document.getElementById('dpt-pay-pat');
          if(sel && sel.selectedIndex >= 0) {
            var patName = sel.options[sel.selectedIndex].text.split(' (')[0].trim();
            globalPatQ = patName;
          }
          currentPage = 'patients'; 
          renderPage(); 
        })
        .catch(function(e) { toast(e.message, 'error'); btn.textContent = '포인트 적립'; btn.disabled = false; });
      });
    }).catch(function(e) { el.innerHTML = '<p style="padding:20px;color:#ef4444;font-size:13px;text-align:center">' + e.message + '</p>'; });
  }

  var globalPatQ = ''; // added global for passing search query
  /* --- 환자관리 --- */
  function pgPat(el) {
    var currentPage = 1;
    var currentQ = (typeof window._dpt_global_q !== 'undefined' && window._dpt_global_q) ? window._dpt_global_q : globalPatQ;
    globalPatQ = ''; // reset after consuming
    if (typeof window !== 'undefined') window._dpt_global_q = ''; // FIX: also clear the window global so it doesn't persist!
    var birthdayMode = false;
    var pointsMode = false;
    var showOnlyPoints = false;  /* 생일 필터 모드 */

    el.innerHTML = '<div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div style="font-size:18px;font-weight:700;color:#1f2937">환자 관리 <span id="dpt-pat-cnt" style="font-size:14px;font-weight:400;color:#6b7280"></span></div><button id="dpt-pat-delete-all" style="padding:6px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">전체 환자 삭제</button>'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:4px">'
      + '<input id="dpt-pat-q" type="text" placeholder="이름, 전화번호, 차트번호" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;min-width:120px;" value="' + currentQ + '" />'
      + '<button id="dpt-pat-search" style="padding:10px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">검색</button>'
      + '<select id="dpt-pat-points" style="padding:10px 14px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#4b5563;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;outline:none;">\n\          <option value="">포인트 검색 (전체)</option>\n\          <option value="1">1P 이상 보유</option>\n\          <option value="1000">1,000P</option>\n\          <option value="5000">5,000P</option>\n\          <option value="10000">10,000P</option>\n\          <option value="30000">30,000P</option>\n\          <option value="50000">50,000P</option>\n\          <option value="100000">100,000P</option>\n\        </select>'
      + '<button id="dpt-pat-birthday" style="padding:10px 14px;border-radius:8px;border:1px solid #bfdbfe;background:#fff;color:#2563eb;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">생일</button>'
      + '</div>'
      + '<p id="dpt-pat-filter-note" style="font-size:12px;color:#9ca3af;margin:0 0 10px;padding-left:2px">전체 환자 목록입니다.</p>'
      + '<div id="dpt-pat-result">' + SPIN_HTML + '</div></div>';

    function renderTable(pts, meta) {
      var TH = 'padding:10px 12px;font-size:12px;font-weight:600;color:#6b7280;text-align:left;white-space:nowrap;border-bottom:1px solid #e5e7eb;background:#f9fafb;';
      var TD = 'padding:10px 12px;font-size:13px;color:#1f2937;border-bottom:1px solid #d1d5db;vertical-align:middle;';

      var html = '';

      if (pts.length === 0) {
        html += '<p style="text-align:center;padding:30px;color:#9ca3af;font-size:13px">'
          + (meta.has_point_filter ? '포인트 보유 환자가 없습니다. 검색으로 전체 환자를 조회하세요.' : '검색 결과가 없습니다.')
          + '</p>';
      } else {
        html += '<div style="overflow-x:auto;border-radius:10px;border:1px solid #e5e7eb;min-height:280px;padding-bottom:80px">'
          + '<table style="width:100%;border-collapse:collapse;background:#fff;min-width:700px">'
          + '<thead><tr>'
          + '<th style="' + TH + '">차트번호</th>'
          + '<th style="' + TH + '">이름</th>'
          + '<th style="' + TH + '">생년월일</th>'
          + '<th style="' + TH + '">연락처</th>'
          + '<th style="' + TH + '">진료내용</th>'
          + '<th style="' + TH + 'text-align:right">결제내역</th>'
          + '<th style="' + TH + 'text-align:right">포인트</th>'
          + '<th style="' + TH + 'text-align:center">쿠폰</th>'
          + '<th style="' + TH + 'text-align:center">관리</th>'
          + '</tr></thead><tbody>';
        pts.forEach(function(p) {
          var chartNo = p.chart_number || '-';
          var birth = p.birth_date ? p.birth_date.substring(0,10) : '-';
          var treatment = p.last_treatment || '-';
          var payStr = p.last_payment_amount
            ? '<span style="font-weight:600">' + F(p.last_payment_amount) + '원</span>'
              + (p.last_payment_date ? '<br><span style="font-size:11px;color:#9ca3af">' + p.last_payment_date.substring(0,10) + '</span>' : '')
            : '<span style="color:#d1d5db">-</span>';
          var pts_val = p.available_points || 0;
          var ptsColor = pts_val > 0 ? '#2563eb' : '#9ca3af';
          /* 오늘 생일 여부 */
          var kstNow = new Date(new Date().getTime() + 9 * 3600000);
          var todayMD = kstNow.toISOString().split('T')[0].slice(5);
          var isBirthday = p.birth_date && p.birth_date.length >= 7 && p.birth_date.slice(5,10) === todayMD;
          var nameCell = escH(p.name);
          
          var bdayCouponIssued = !!p.birthday_coupon_issued;
          var bdayCouponName = p.birthday_coupon_name || '';
          var bdayCouponStatus = p.birthday_coupon_status || '';
          var bdayCouponShared = p.birthday_coupon_shared_at || '';
          var bdayCouponBadge = '';
          if (bdayCouponIssued) {
            if (bdayCouponStatus === 'used') {
              bdayCouponBadge = '<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:3px 8px;border-radius:999px;font-weight:700;white-space:nowrap;display:inline-block">사용처리</span>';
            } else if (bdayCouponShared) {
              bdayCouponBadge = '<span style="font-size:10px;background:#d1fae5;color:#059669;padding:3px 8px;border-radius:999px;font-weight:700;white-space:nowrap;display:inline-block">전송</span>';
            } else {
              bdayCouponBadge = '<span class="dpt-tooltip" data-tooltip="카톡 링크 미전송 상태" style="font-size:10px;background:#dbeafe;color:#1d4ed8;padding:3px 8px;border-radius:999px;font-weight:700;white-space:nowrap;display:inline-block">발행</span>';
            }
          }
          
          html += '<tr data-bday="' + (isBirthday ? '1' : '0') + '" style="transition:background .15s;' + (isBirthday ? 'background:#fff7fc' : '') + '" data-patid="' + p.id + '" onmouseover="if(this.getAttribute(\'data-active\')!==\'true\') this.style.background=\'#f8faff\'; else this.style.background=\'#f3f4f6\';" onmouseout="if(this.getAttribute(\'data-active\')!==\'true\') this.style.background=\'' + (isBirthday ? '#fff7fc' : '') + '\'; else this.style.background=\'#f3f4f6\';">'
            + '<td style="' + TD + 'color:#6b7280;font-size:12px">' + escH(chartNo) + '</td>'
            + '<td style="' + TD + 'font-weight:500">' + nameCell + '</td>'
            + '<td style="' + TD + '">' + escH(birth) + '</td>'
            + '<td style="' + TD + '">' + escH(p.phone||'-') + '</td>'
            + '<td style="' + TD + '">' + escH(treatment) + '</td>'
            + '<td style="' + TD + 'text-align:right">' + payStr + '</td>'
            + '<td style="' + TD + 'text-align:right;font-weight:700;color:' + ptsColor + '" class="dpt-pts-cell">' + F(pts_val) + 'P</td>'
            + '<td style="' + TD + 'text-align:center" class="dpt-cpn-cell">' 
            + '<div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;">'
            + '<div style="display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:6px;">' 
            + '<button class="dpt-cpn-btn" data-id="' + p.id + '" data-name="' + escH(p.name) + '" data-birth="' + escH(p.birth_date||'') + '" style="padding:4px 10px;border-radius:6px;border:none;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">발행</button>'
            + '<div style="position:relative;" class="dpt-dropdown-container">'
            + '<button class="dpt-cpn-toggle" style="padding:4px 8px;background:#f9fafb;border:1px solid #e5e7eb;color:#4b5563;border-radius:4px;font-size:11px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;">'
            + '보유 쿠폰 <span style="background:#dbeafe;color:#2563eb;padding:1px 4px;border-radius:99px;font-size:10px;line-height:1;">' + (p.all_coupons ? p.all_coupons.split('||').filter(function(x){return x.includes('::active');}).length : 0) + '</span>'
            + '<svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>'
            + '</button>'
            + '<div class="dpt-dropdown-menu" style="display:none;position:fixed;z-index:99998;width:max-content;min-width:280px;max-width:480px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:6px;text-align:left;white-space:nowrap;">'
            + (p.all_coupons ? p.all_coupons.split('||').sort(function(a,b){return (Number(b.split('::')[4])||0)-(Number(a.split('::')[4])||0);}).map(function(cn) {
              var parts = cn.split('::');
              var cname = parts[0];
              var cstatus = parts[1] || 'active';
              var c_id = parts[4] || '';
              var c_code = parts[5] || '';
              var shared_at = parts[6] || '';

              var statusBg = '#dbeafe';
              var statusFg = '#1d4ed8';
              var lbl = '발행';

              if (cstatus === 'active' && shared_at) {
                statusBg = '#d1fae5';
                statusFg = '#059669';
                lbl = '전송';
              } else if (cstatus === 'used') {
                statusBg = '#fee2e2';
                statusFg = '#dc2626';
                lbl = '사용처리';
              } else if (cstatus === 'expired' || cstatus === 'revoked') {
                statusBg = '#f3f4f6';
                statusFg = '#6b7280';
                lbl = cstatus === 'expired' ? '만료' : '회수';
              }

              /* active + 미전송(발행)이면 배지 자체를 클릭 가능하게 */
              var btns = '';
              var isUnshared = cstatus === 'active' && !shared_at && c_code;
              if (c_id) {
                btns += '<button class="dpt-del-coupon" data-cid="'+c_id+'" data-cname="'+escH(cname)+'" style="background:none;border:none;color:#ef4444;font-size:12px;font-weight:700;cursor:pointer;padding:0 2px;margin-left:4px;flex-shrink:0;">×</button>';
              }
              /* 생일 구분: parts[8]=is_birthday_issue (실제 생일 발행 시에만 표시) */
              var isBdayCpn = (parts[8] === '1');
              var bdayBadge = isBdayCpn ? '<span style="font-size:9px;padding:1px 4px;border-radius:4px;background:#fef3c7;color:#d97706;font-weight:700;line-height:1.3">생일</span>' : '';
              /* 발행 배지: 미전송이면 클릭 시 전송, 스타일은 통일 (녹색=전송완료, 파란=미전송) */
              var badgeClass = isUnshared ? ' dpt-share-coupon' : '';
              var badgeAttr = isUnshared
                ? ' data-code="'+escH(c_code)+'" style="font-size:10px;background:#dbeafe;color:#1d4ed8;padding:3px 8px;border-radius:999px;white-space:nowrap;font-weight:700;display:inline-flex;align-items:center;gap:3px;text-align:center;cursor:pointer;transition:background .2s"'
                : ' style="font-size:10px;background:' + statusBg + ';color:' + statusFg + ';padding:3px 8px;border-radius:999px;white-space:nowrap;font-weight:700;display:inline-block;text-align:center"';
              var badgeSvg = isUnshared ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' : '';
              return '<div style="font-size:12px;font-weight:600;color:#1f2937;background:#fff;padding:6px 8px;border-radius:6px;margin-bottom:3px;display:flex;align-items:center;gap:0;white-space:nowrap;border-bottom:1px solid #d1d5db;" title="' + escH(cname) + '">'
                + '<span style="display:inline-block;width:32px;text-align:center;flex-shrink:0">' + bdayBadge + '</span>'
                + '<span style="display:inline-block;width:56px;text-align:center;flex-shrink:0"><span class="' + badgeClass.trim() + '"' + badgeAttr + '>' + escH(lbl) + badgeSvg + '</span></span>'
                + '<span style="white-space:nowrap;flex:1;padding-left:8px">' + escH(cname) + '</span>' + btns + '</div>';
            }).join('') : '<div style="font-size:11px;color:#9ca3af;text-align:center;padding:4px 0;">보유 쿠폰 없음</div>')
            + '</div></div>' 
            + '</div></td>'
            + '<td style="' + TD + 'text-align:center;white-space:nowrap">'
            + '<button class="dpt-pat-edit" data-id="' + p.id + '" style="padding:4px 10px;border-radius:6px;border:none;background:#f3f4f6;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">수정</button>'
            + '<button class="dpt-pat-del" data-id="' + p.id + '" data-name="' + escH(p.name) + '" style="padding:4px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit">삭제</button>'
            + '</td></tr>';
        });
        html += '</tbody></table></div>';
        /* 페이지네이션 */
        if (meta.total_pages > 1) {
          var PB = 'padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid #d1d5db;';
          html += '<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-top:12px;padding:8px 0">';
          /* 처음 - 항상 표시 (1페이지가 아닌 경우) */
          if (meta.page > 1) {
            html += '<button class="dpt-page-btn" data-page="1" style="' + PB + 'background:#fff;color:#374151">처음</button>';
          }
          if (meta.page > 1) {
            html += '<button class="dpt-page-btn" data-page="' + (meta.page - 1) + '" style="' + PB + 'background:#fff;color:#374151">이전</button>';
          }
          var startP = Math.max(1, meta.page - 2);
          var endP = Math.min(meta.total_pages, meta.page + 2);
          for (var pi = startP; pi <= endP; pi++) {
            if (pi === meta.page) {
              html += '<span style="' + PB + 'background:#2563eb;color:#fff;border-color:#2563eb">' + pi + '</span>';
            } else {
              html += '<button class="dpt-page-btn" data-page="' + pi + '" style="' + PB + 'background:#fff;color:#374151">' + pi + '</button>';
            }
          }
          if (meta.page < meta.total_pages) {
            html += '<button class="dpt-page-btn" data-page="' + (meta.page + 1) + '" style="' + PB + 'background:#fff;color:#374151">다음</button>';
          }
          /* 마지막 - 항상 표시 (마지막 페이지가 아닌 경우) */
          if (meta.page < meta.total_pages) {
            html += '<button class="dpt-page-btn" data-page="' + meta.total_pages + '" style="' + PB + 'background:#fff;color:#374151">마지막</button>';
          }
          html += '</div>';
          /* 페이지 정보 */
          html += '<div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:4px">' + meta.page + ' / ' + meta.total_pages + ' 페이지 (총 ' + F(meta.total) + '명)</div>';
        }
              }
      return html;
    }

    function bindTableEvents() {
      var container = document.getElementById('dpt-pat-result');
      if (!container) return;
      
      // Clone to remove all existing event listeners
      var newContainer = container.cloneNode(true);
      if (container.parentNode) container.parentNode.replaceChild(newContainer, container);
      
      newContainer.addEventListener('click', function(e) {
        // Page navigation
        var pageBtn = e.target.closest('.dpt-page-btn');
        if (pageBtn) {
          e.stopPropagation();
          var pg = parseInt(pageBtn.getAttribute('data-page'));
          if (pg) { currentPage = pg; loadPat(currentQ, pg); }
          return;
        }
        // Dropdown toggle
        var toggleBtn = e.target.closest('.dpt-cpn-toggle');
        if (toggleBtn) {
          e.stopPropagation();
          var menu = toggleBtn.nextElementSibling;
          var isHidden = menu.style.display === 'none';
          document.querySelectorAll('.dpt-dropdown-menu').forEach(function(m) { m.style.display = 'none'; });
          document.querySelectorAll('tr[data-patid]').forEach(function(r) { 
            r.removeAttribute('data-active'); 
            r.style.background = r.getAttribute('data-bday') === '1' ? '#fff7fc' : ''; 
          });
          if (isHidden) {
            /* position:fixed 드롭다운 위치 계산 */
            var rect = toggleBtn.getBoundingClientRect();
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.left = rect.left + 'px';
            /* 화면 오른쪽 밖으로 나가면 보정 */
            menu.style.display = 'block';
            var menuRect = menu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth - 8) {
              menu.style.left = Math.max(8, window.innerWidth - menuRect.width - 8) + 'px';
            }
            /* 화면 아래로 나가면 위로 표시 */
            if (menuRect.bottom > window.innerHeight - 8) {
              menu.style.top = (rect.top - menuRect.height - 4) + 'px';
            }
            var tr = toggleBtn.closest('tr');
            if (tr) {
              tr.setAttribute('data-active', 'true');
              tr.style.background = '#f3f4f6';
            }
          }
          return;
        }

        // Issue Coupon Button — 환자 생일이면 자동으로 forceBday 전달
        var cpnBtn = e.target.closest('.dpt-cpn-btn');
        if (cpnBtn) {
          e.stopPropagation();
          var cpnPid = cpnBtn.getAttribute('data-id');
          var cpnPname = cpnBtn.getAttribute('data-name');
          var cpnBirth = cpnBtn.getAttribute('data-birth') || '';
          var nowMD = new Date(Date.now() + 9*3600000).toISOString().substring(5, 10);
          var isTodayBday = cpnBirth && cpnBirth.length >= 7 && cpnBirth.substring(5, 10) === nowMD;
          showCouponIssueModal(cpnPid, cpnPname, !!isTodayBday);
          return;
        }

        // Delete Coupon
        var delCpn = e.target.closest('.dpt-del-coupon');
        if (delCpn) {
          e.stopPropagation();
          var cid = delCpn.dataset.cid;
          var cname = delCpn.dataset.cname;
          showConfirmModal('삭제 확인', '[' + cname + '] 쿠폰을 삭제하시겠습니까?', function() {
            callAPI('/coupons/' + cid, { method: 'DELETE' })
              .then(function() {
                toast('쿠폰이 삭제되었습니다.');
                if (typeof window._dptLoadPat === 'function') window._dptLoadPat(document.getElementById('dpt-pat-q') ? document.getElementById('dpt-pat-q').value.trim() : '', window.dptCurrentPage || 1);
              })
              .catch(function(err) { toast(err.message, 'error'); });
          });
          return;
        }

        // Share Coupon
        var shareCpn = e.target.closest('.dpt-share-coupon');
        if (shareCpn) {
          e.stopPropagation();
          var code = shareCpn.dataset.code;
          shareCpn.disabled = true; shareCpn.textContent = '...';
          callAPI('/coupons/check/' + code)
            .then(function(res) {
              /* share API는 showIssuedCouponModal 내부에서 링크 복사 시 호출됨 (중복 호출 제거) */
              showIssuedCouponModal(res.coupon, function() {
                /* onClose: 환자 목록 새로고침 */
                if (typeof window._dptLoadPat === 'function') window._dptLoadPat(document.getElementById('dpt-pat-q') ? document.getElementById('dpt-pat-q').value.trim() : '', window.dptCurrentPage || 1);
              }, function() {
                /* onCopy: share API 성공 확인됨 → 드롭다운 배지 '전송'으로 변경 */
                dlog('환자관리 공유 링크복사(share API 성공): code=' + code);
                if (typeof window._dptLoadPat === 'function') window._dptLoadPat(document.getElementById('dpt-pat-q') ? document.getElementById('dpt-pat-q').value.trim() : '', window.dptCurrentPage || 1);
              });
              shareCpn.disabled = false; shareCpn.textContent = '전송';
            })
            .catch(function(err) {
              toast(err.message, 'error');
              shareCpn.disabled = false; shareCpn.textContent = '전송';
            });
          return;
        }

        // Use Coupon
        var useCpn = e.target.closest('.dpt-use-coupon');
        if (useCpn) {
          e.stopPropagation();
          var uCode = useCpn.dataset.code;
          var uCname = useCpn.dataset.cname;
          useCpn.textContent = '...';
          callAPI('/coupons/use/' + uCode, { method: 'POST' })
            .then(function() {
              toast('쿠폰이 사용 처리되었습니다.');
              if (typeof window._dptLoadPat === 'function') window._dptLoadPat(document.getElementById('dpt-pat-q') ? document.getElementById('dpt-pat-q').value.trim() : '', window.dptCurrentPage || 1);
            })
            .catch(function(err) { toast(err.message, 'error'); useCpn.textContent = '사용'; });
          return;
        }

        // Edit Patient
        var editPat = e.target.closest('.dpt-pat-edit');
        if (editPat) {
          e.stopPropagation();
          showPatEditModal(editPat.getAttribute('data-id'), function() { 
            if (typeof window._dptLoadPat === 'function') window._dptLoadPat(document.getElementById('dpt-pat-q') ? document.getElementById('dpt-pat-q').value.trim() : '', window.dptCurrentPage || 1); 
          });
          return;
        }

        // Delete Patient
        var delPat = e.target.closest('.dpt-pat-del');
        if (delPat) {
          e.stopPropagation();
          showConfirmModal('환자 삭제', '"' + delPat.getAttribute('data-name') + '" 환자를 삭제할까요?', function() {
            callAPI('/clinics/' + CID() + '/patients/' + delPat.getAttribute('data-id'), { method: 'DELETE' })
            .then(function() { 
              toast('환자가 삭제되었습니다.'); 
              if (typeof window._dptLoadPat === 'function') window._dptLoadPat(document.getElementById('dpt-pat-q') ? document.getElementById('dpt-pat-q').value.trim() : '', window.dptCurrentPage || 1); 
            })
            .catch(function(err) { toast(err.message, 'error'); });
          });
          return;
        }
      });
      
      // Global click to close dropdowns
      if (!window._dptDdListenerW) { 
        window._dptDdListenerW = true; 
        document.addEventListener('click', function(e) { 
          if (!e.target.closest('.dpt-dropdown-container')) { 
            document.querySelectorAll('.dpt-dropdown-menu').forEach(function(m) { m.style.display = 'none'; }); 
            document.querySelectorAll('tr[data-patid]').forEach(function(r) { 
              if (r.getAttribute('data-active') === 'true') {
                r.removeAttribute('data-active'); 
                r.style.background = r.getAttribute('data-bday') === '1' ? '#fff7fc' : '';
              }
            }); 
          } 
        }); 
      }
    }

    function loadPat(q, page, silent) {
      if (q === undefined) q = currentQ;
      if (!page) page = currentPage;
      window.dptCurrentPage = page; /* 이벤트 위임에서 참조 가능하도록 */
      if (!silent) document.getElementById('dpt-pat-result').innerHTML = SPIN_HTML;
      var url = '/clinics/' + CID() + '/patients?page=' + page;
      if (birthdayMode) {
        url += '&birthday=today';
      } else if (pointsMode) {
        url += '&point_filter=' + encodeURIComponent(pointsMode);
      } else if (q) {
        url += '&search=' + encodeURIComponent(q);
      }
      callAPI(url).then(function(d) {
        var pts = d.patients || [];
        var meta = { total: d.total||0, total_all: d.total_all||d.total||0, page: d.page||1, total_pages: d.total_pages||1, has_point_filter: d.has_point_filter };
        var cntEl = document.getElementById('dpt-pat-cnt');
        if (cntEl) {
          var pageInfo = meta.total_pages > 1 ? ' (' + meta.page + '/' + meta.total_pages + '페이지)' : '';
          var label = birthdayMode ? '오늘 생일 ' + meta.total + '명'
            : (meta.has_point_filter ? '포인트 보유 ' + meta.total + '명' 
            : (currentQ ? '검색결과 ' + meta.total + '명' : meta.total + '명'));
          var totalAll = !birthdayMode && !meta.has_point_filter && !currentQ ? '' : ' / 전체 ' + F(meta.total_all) + '명';
          cntEl.textContent = label + totalAll + pageInfo;
        }
        /* 생일 모드일 때 필터 노트 업데이트 */
        var noteEl = document.getElementById('dpt-pat-filter-note');
        if (noteEl) {
          noteEl.textContent = birthdayMode
            ? '오늘 생일인 환자 목록입니다'
            : (meta.has_point_filter ? '포인트 보유 환자만 표시' : '전체 환자 목록입니다');
          noteEl.style.color = birthdayMode ? '#2563eb' : '#9ca3af';
        }
        /* 생일 버튼 스타일 업데이트 */
        var bdBtn = document.getElementById('dpt-pat-birthday');
        if (bdBtn) {
          bdBtn.style.background = birthdayMode ? '#eff6ff' : '#fff';
          bdBtn.style.borderColor = birthdayMode ? '#93c5fd' : '#bfdbfe';
          bdBtn.style.fontWeight = birthdayMode ? '700' : '600';
        }
        
        var ptsSel = document.getElementById('dpt-pat-points');
        if (ptsSel) {
          if (d.point_filters && d.point_filters.length > 0 && !ptsSel.dataset.loaded) {
            var opts = '<option value="">포인트 검색 (전체)</option>\n<option value="1">1P 이상 보유</option>\n';
            d.point_filters.forEach(function(f) {
              opts += '<option value="' + f.points + '">' + f.label + '</option>\n';
            });
            ptsSel.innerHTML = opts;
            ptsSel.dataset.loaded = '1';
          }
          ptsSel.value = pointsMode || '';
          ptsSel.style.background = pointsMode ? '#f3e8ff' : '#fff';
          ptsSel.style.borderColor = pointsMode ? '#d8b4fe' : '#d1d5db';
          ptsSel.style.color = pointsMode ? '#7e22ce' : '#4b5563';
        }
        document.getElementById('dpt-pat-result').innerHTML = renderTable(pts, meta);
        bindTableEvents();
      }).catch(function(e) { document.getElementById('dpt-pat-result').innerHTML = '<p style="color:#ef4444;padding:20px;text-align:center;font-size:13px">' + escH(e.message) + '</p>'; });
    }
    /* loadPat을 window에 노출 - 이벤트 위임에서도 접근 가능 */
    window._dptLoadPat = loadPat;

    loadPat(currentQ, 1);

    // Background Polling for Patients List
    if (window._dptPatPollTimer) clearInterval(window._dptPatPollTimer);
    window._dptPatPollTimer = setInterval(function() {
      if (document.getElementById('dpt-pg') && document.getElementById('dpt-pat-search')) {
        // Only if we are on the patients page
        // Do not poll if user is typing or if there is an active modal/dropdown
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;
        if (document.querySelector('[id$="-modal"]')) return;
        var dds = document.querySelectorAll('.dpt-dropdown-menu'); for (var i=0; i<dds.length; i++) { if (dds[i].style.display === 'block') return; }
        
        var el = document.getElementById('dpt-pg');
        if (!el) return;
        // Check for any overlays
        var hasOverlay = false;
        var divs = document.querySelectorAll('div');
        for (var i = 0; i < divs.length; i++) {
          if (divs[i].style.position === 'fixed' && divs[i].style.zIndex === '99999') {
             hasOverlay = true; break;
          }
        }
        if (hasOverlay) return;

        // Note scroll pos if it exists (widget doesn't scroll much, but window might)
        loadPat(currentQ, currentPage, true);
      } else {
        clearInterval(window._dptPatPollTimer);
      }
    }, 15000);
    
    var btnDelAll = document.getElementById('dpt-pat-delete-all');
    if(btnDelAll) {
      btnDelAll.addEventListener('click', function() {
        showConfirmModal('전체 삭제 경고', '정말 현재 치과의 [모든 환자]와 [결제내역/포인트/쿠폰]을 전체 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.', function() {
            var btn = document.getElementById('dpt-pat-delete-all');
            btn.textContent = '삭제 중...'; btn.disabled = true;
            callAPI('/clinics/' + CID() + '/patients_all', { method: 'DELETE' })
              .then(function() { toast('전체 데이터가 삭제되었습니다.'); setTimeout(function(){location.reload();}, 1000); })
              .catch(function(e) { toast(e.message, 'error'); btn.textContent = '전체 환자 삭제'; btn.disabled = false; });
          });
      });
    }

    var _patSearch = el.querySelector('#dpt-pat-search');
    var _patQ = el.querySelector('#dpt-pat-q');
    var _patBirthday = el.querySelector('#dpt-pat-birthday');
    var _patPoints = el.querySelector('#dpt-pat-points');
    if (!_patSearch || !_patQ) { el.innerHTML = '<p style="color:#ef4444;padding:20px;text-align:center">환자관리 UI 로딩 실패. 다시 시도해 주세요.</p>'; return; }
    _patSearch.addEventListener('click', function() {
      birthdayMode = false;
      pointsMode = false;
      currentQ = _patQ.value.trim();
      currentPage = 1;
      loadPat(currentQ, 1);
    });
    _patQ.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        birthdayMode = false;
        currentQ = this.value.trim();
        currentPage = 1;
        loadPat(currentQ, 1);
      }
    });
    // 검색어 지우면 자동 초기화
    _patQ.addEventListener('input', function() {
      if (this.value === '') { currentQ = ''; birthdayMode = false; pointsMode = false; currentPage = 1; loadPat(currentQ, 1); }
    });
    // 생일 필터 버튼
    if (_patBirthday) _patBirthday.addEventListener('click', function() {
      birthdayMode = !birthdayMode;
      pointsMode = false;
      if (birthdayMode) { currentQ = ''; _patQ.value = ''; }
      currentPage = 1;
      loadPat(currentQ, 1);
    });
    // 포인트 필터 버튼
    if (_patPoints) _patPoints.addEventListener('change', function() {
      pointsMode = this.value;
      birthdayMode = false;
      if (pointsMode) { currentQ = ''; _patQ.value = ''; }
      currentPage = 1;
      loadPat(currentQ, 1);
    });
  }

  /* 환자 수정 모달 */
  function showPatEditModal(pid, onSaved) {
    /* 로딩 오버레이 먼저 표시 */
    var overlay = document.createElement('div');
    overlay.id = 'dpt-pe-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif';
    overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:32px;text-align:center">' + SPIN_HTML + '</div>';
    document.body.appendChild(overlay);

    callAPI('/clinics/' + CID() + '/patients/' + pid).then(function(res) {
      overlay.remove();
      /* API 응답: { patient: {...}, payments: [...], coupons: [...] } */
      if (res.error || !res.patient) {
        toast((res.error || '환자 정보를 불러올 수 없습니다.'), 'error');
        return;
      }
      var p = res.patient;
      var m = document.createElement('div');
      m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px;overflow-y:auto';
      var IS = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:8px';
      var avail = (p.available_points || 0);
      m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:400px;margin:auto">'
        + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 16px">환자 정보 수정</h3>'
        + '<input id="dpt-pe-name" type="text" placeholder="이름" value="' + (p.name||'') + '" style="' + IS + '">'
        + '<input id="dpt-pe-phone" type="text" placeholder="전화번호" value="' + (p.phone||'') + '" style="' + IS + '">'
        + '<input id="dpt-pe-chart" type="text" placeholder="차트번호" value="' + (p.chart_number||'') + '" style="' + IS + '">'
        + '<input id="dpt-pe-birth" type="text" placeholder="생년월일 (YYYY-MM-DD)" value="' + (p.birth_date||'') + '" style="' + IS + '">'
        + '<input id="dpt-pe-treatment" type="text" placeholder="진료내용" value="' + (p.last_treatment||'') + '" style="' + IS + '">'
        + '<div style="border-top:1px solid #d1d5db;margin:12px 0 14px"></div>'
        + '<div style="background:#f0f7ff;border-radius:10px;padding:12px;margin-bottom:12px">'
        + '<p style="font-size:12px;font-weight:600;color:#6b7280;margin:0 0 6px">포인트 조정</p>'
        + '<p style="font-size:13px;color:#1f2937;margin:0 0 8px">현재 보유: <strong style="color:#2563eb">' + F(avail) + ' P</strong></p>'
        + '<div style="display:flex;gap:8px;align-items:center">'
        + '<select id="dpt-pe-adj-type" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit">'
        + '<option value="adjust_add">+ 추가</option><option value="adjust_sub">- 차감</option>'
        + '</select>'
        + '<input id="dpt-pe-adj-amt" type="number" min="0" placeholder="포인트" style="flex:1;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box">'
        + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P</span>'
        + '</div>'
        + '<p style="font-size:11px;color:#9ca3af;margin:6px 0 0">빈 칸이면 포인트 변경 없음</p>'
        + '</div>'
        + '<div style="display:flex;gap:8px"><button id="dpt-pe-cancel" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
        + '<button id="dpt-pe-save" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">저장</button></div></div>';
      document.body.appendChild(m);
      m.querySelector('#dpt-pe-cancel').addEventListener('click', function() { m.remove(); });
      m.querySelector('#dpt-pe-save').addEventListener('click', function() {
        var body = {
          name: m.querySelector('#dpt-pe-name').value.trim(),
          phone: m.querySelector('#dpt-pe-phone').value.trim(),
          chart_number: m.querySelector('#dpt-pe-chart').value.trim(),
          birth_date: m.querySelector('#dpt-pe-birth').value.trim(),
          last_treatment: m.querySelector('#dpt-pe-treatment').value.trim()
        };
        var adjAmt = m.querySelector('#dpt-pe-adj-amt').value.trim();
        var adjType = m.querySelector('#dpt-pe-adj-type').value;
        var btn = this; btn.textContent = '저장 중...'; btn.disabled = true;
        var saveInfo = callAPI('/clinics/' + CID() + '/patients/' + pid, { method: 'PUT', body: JSON.stringify(body) });
        if (adjAmt && parseInt(adjAmt) >= 0) {
          var adjVal = parseInt(adjAmt);
          var newTotal;
          if (adjType === 'adjust_add') {
            newTotal = avail + adjVal;
          } else {
            newTotal = Math.max(0, avail - adjVal);
          }
          saveInfo = saveInfo.then(function() {
            return callAPI('/points/adjust', { method: 'POST', body: JSON.stringify({ clinic_id: CID(), patient_id: pid, new_balance: newTotal, description: '관리자 포인트 조정' }) });
          });
        }
        saveInfo.then(function() { toast('저장되었습니다.'); m.remove(); if (onSaved) onSaved(); })
        .catch(function(e) { toast(e.message, 'error'); btn.textContent = '저장'; btn.disabled = false; });
      });
    }).catch(function(e) { var ov = document.getElementById('dpt-pe-overlay'); if (ov) ov.remove(); toast(e.message, 'error'); });
  }

  /* 발행된 쿠폰 공유 모달 (QR + 링크복사 + 카카오) */
  function showIssuedCouponModal(couponData, onClose, onCopy) {
    var code = couponData.code;
    var tname = couponData.template_name || '';
    var pname = couponData.patient_name || '';
    var expires = couponData.expires_at || '-';
    var dtype = couponData.discount_type;
    var dval = couponData.discount_value;
    var shareUrl = API + '/coupon/' + code;
    var qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=' + encodeURIComponent(shareUrl);

    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px';
    m.innerHTML = '<div style="background:#fff;border-radius:20px;width:100%;max-width:360px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
      /* 상단 헤더 */
      + '<div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:20px;text-align:center;color:#fff">'
      + '<div style="font-size:11px;opacity:.8;margin-bottom:4px;letter-spacing:1px">COUPON ISSUED</div>'
      + '<div style="font-size:22px;font-weight:800;margin-bottom:4px">' + escH(tname) + '</div>'
      + '</div>'
      /* QR 코드 */
      + '<div style="padding:20px;text-align:center;border-bottom:1px dashed #e5e7eb">'
      + '<p style="font-size:11px;color:#9ca3af;margin:0 0 12px">QR코드를 스캔하거나 아래 링크를 공유하세요</p>'
      + '<img src="' + qrApiUrl + '" style="width:160px;height:160px;border-radius:8px;border:1px solid #e5e7eb" alt="QR" />'
      + '<p style="font-size:11px;font-family:monospace;font-weight:700;color:#2563eb;margin:10px 0 0;letter-spacing:1px">' + escH(code) + '</p>'
      + '</div>'
      /* 환자 정보 */
      + '<div style="padding:14px 20px;border-bottom:1px solid #d1d5db;display:flex;justify-content:space-between">'
      + '<div style="font-size:12px;color:#9ca3af">수신인</div>'
      + '<div style="font-size:13px;font-weight:600;color:#1f2937">' + escH(pname) + '</div>'
      + '</div>'
      + '<div style="padding:8px 20px 14px;border-bottom:1px solid #d1d5db;display:flex;justify-content:space-between">'
      + '<div style="font-size:12px;color:#9ca3af">유효기간</div>'
      + '<div style="font-size:13px;color:#1f2937">' + escH(expires) + '</div>'
      + '</div>'
      /* 공유 버튼 */
      + '<div style="padding:16px 20px;display:flex;flex-direction:column;gap:8px">'
      + '<button id="dpt-ic-copy" style="width:100%;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
      + '링크 복사</button>'
      + '<button id="dpt-ic-close" style="width:100%;padding:10px;border-radius:10px;border:none;background:#f3f4f6;color:#6b7280;font-size:13px;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(m);

    /* 링크 복사 — share API 성공 확인 후 UI 업데이트 */
    document.getElementById('dpt-ic-copy').addEventListener('click', function() {
      var copyBtn = this;
      copyBtn.disabled = true;
      copyBtn.innerHTML = '<span style="color:#9ca3af">전송 처리 중...</span>';
      dlog('링크복사 클릭: code=' + code);

      /* 1) 클립보드 복사 (비동기) */
      var clipDone = false;
      function doClipCopy() {
        if (clipDone) return;
        clipDone = true;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).catch(function() { fallbackCopy(shareUrl); });
        } else { fallbackCopy(shareUrl); }
      }

      /* 2) share API 호출 — 반드시 성공 확인 후 UI 업데이트 */
      callAPI('/coupons/' + encodeURIComponent(code) + '/share', { method: 'POST' })
        .then(function(r) {
          dlog('share API 성공: ' + JSON.stringify(r));
          markSharedCode(code);
          doClipCopy();
          toast('링크가 복사되고 전송 처리되었습니다!');
          m.remove();
          if (onCopy) onCopy();
        })
        .catch(function(e) {
          dlog('share API 실패: ' + e.message);
          /* API 실패해도 링크는 복사해주되, 전송 상태 미반영을 안내 */
          doClipCopy();
          toast('링크 복사됨 (전송 기록 실패: ' + e.message + ')', 'error');
          copyBtn.disabled = false;
          copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> 다시 시도';
          /* API 실패 시 onCopy 호출하지 않음 → UI 상태 변경 안 함 */
        });
    });

    document.getElementById('dpt-ic-close').addEventListener('click', function() { m.remove(); if (onClose) onClose(); });
    m.addEventListener('click', function(e) { if (e.target === m) { m.remove(); if (onClose) onClose(); } });
  }

  /* 쿠폰 즉시 발행 모달 (환자관리에서 호출) */
  function showCouponIssueModal(pid, pname, forceBday, preselectTemplateIds, skipDashRefresh) {
    dlog('showCouponIssueModal 호출: pid=' + pid + ', pname=' + pname + ', preIds=' + JSON.stringify(preselectTemplateIds));
    /* 데이터를 먼저 로드하고 완성된 모달을 한번에 표시 */
    Promise.all([
      callAPI('/coupons/templates?clinic_id=' + CID()),
      callAPI('/clinics/' + CID() + '/patients/' + pid).catch(function() { return {}; })
    ]).then(function(results) {
      var res = results[0];
      var patData = results[1];
      var activeCoupons = patData.coupons || [];
      var availPts = (patData.patient && patData.patient.available_points != null)
        ? Number(patData.patient.available_points) : 0;
      
      var todayMD = new Date(Date.now() + 9*3600000).toISOString().substring(5, 10);
      var pBirth = patData.patient ? patData.patient.birth_date : '';
      var isPatBday = forceBday || (pBirth && pBirth.length >= 7 && pBirth.substring(5, 10) === todayMD);
      var allTemplates = (res.templates || []).filter(function(t) { return t.status === 'active'; });
      dlog('showCouponIssueModal: allTemplates=' + allTemplates.length + ', preselectTemplateIds=' + JSON.stringify(preselectTemplateIds) + ', pid=' + pid);
      if (allTemplates.length === 0) { toast('등록된 쿠폰 템플릿이 없습니다. 설정에서 먼저 등록하세요.', 'error'); return; }

      /* 포인트 충족 여부: 생일 쿠폰은 생일인 경우에만 포인트 무관 발행 가능 */
      dlog('canIssue 환경: forceBday=' + forceBday + ', isPatBday=' + isPatBday + ', availPts=' + availPts + ', todayMD=' + todayMD + ', pBirth=' + pBirth);
      function canIssue(t) {
        var isBdayCoupon = (t.is_birthday == 1 || t.is_birthday === 'true' || t.coupon_kind === 'birthday');
        if (isBdayCoupon && isPatBday) return true;
        var cost = t.required_points ? Number(t.required_points) : 0;
        return cost === 0 || availPts >= cost;
      }

      /* 정렬: 발행 가능 먼저, 그 다음 포인트 부족 */
      var canList = allTemplates.filter(function(t) { return canIssue(t); });
      var cantList = allTemplates.filter(function(t) { return !canIssue(t); });
      var templates = canList.concat(cantList);

      /* 쿠폰 카드 HTML 생성 */
      var tplCardsHtml = templates.map(function(t) {
        var alreadyIssued = activeCoupons.some(function(c) { return String(c.template_id) === String(t.id); });
        var cost = t.required_points ? Number(t.required_points) : 0;
        var ok = canIssue(t);
        var isBday = (t.is_birthday == 1 || t.is_birthday === 'true' || t.coupon_kind === 'birthday');
        var isFirst = false; // Auto-select removed

        var borderColor = isFirst ? '#2563eb' : '#e5e7eb';
        var bgColor = isFirst ? '#eff6ff' : (ok ? '#fff' : '#fafafa');
        var radioFill = isFirst ? '#2563eb' : 'transparent';
        var radioBorder = isFirst ? '#2563eb' : (ok ? '#d1d5db' : '#e5e7eb');

        var pointBadge = '';
        
        if (alreadyIssued) {
          pointBadge = '<span style="font-size:11px;color:#2563eb;font-weight:700">이미 발행됨 → 링크 전송</span>';
        } else if (isBday) {
          if (isPatBday) {
            pointBadge = '<span style="font-size:11px;color:#2563eb;font-weight:600">생일 무상발행</span> <span style="font-size:10px;color:#6b7280">(차감없음)</span>';
          } else {
            if (cost > 0) {
              if (availPts >= cost) pointBadge = '<span style="font-size:11px;color:#dc2626;font-weight:600">-' + F(cost) + 'P 차감</span>';
              else pointBadge = '<span style="font-size:11px;color:#dc2626;font-weight:600">포인트 부족</span> <span style="font-size:10px;color:#6b7280">(' + F(cost) + 'P 필요)</span>';
            } else {
              pointBadge = '<span style="font-size:11px;color:#6b7280">포인트 차감 없음 (무료)</span>';
            }
          }
        } else {
          if (cost > 0) {
            if (ok) pointBadge = '<span style="font-size:11px;color:#dc2626;font-weight:600">-' + F(cost) + 'P 차감</span>';
            else pointBadge = '<span style="font-size:11px;color:#dc2626;font-weight:600">포인트 부족</span> <span style="font-size:10px;color:#6b7280">(' + F(cost) + 'P 필요)</span>';
          } else {
            pointBadge = '<span style="font-size:11px;color:#6b7280">포인트 차감 없음 (무료)</span>';
          }
        }

        var opacity = ok ? '1' : '0.45';
        var cursor = ok ? 'pointer' : 'not-allowed';

        return '<div class="dpt-tpl-card" data-id="' + t.id + '" data-ok="' + (ok ? '1' : '0') + '" '
          + 'style="padding:14px;border:2px solid ' + borderColor + ';border-radius:10px;cursor:' + cursor + ';'
          + 'transition:all .15s;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;'
          + 'background:' + bgColor + ';opacity:' + opacity + '">'
          + '<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:14px;font-weight:600;color:#1f2937">' + escH(t.name) + '</span></div>'
          + '<div style="margin-top:3px">' + pointBadge + '</div></div>'
          + '<div style="width:20px;height:20px;border-radius:50%;border:2px solid ' + radioBorder + ';flex-shrink:0;'
          + 'background:' + radioFill + '" class="dpt-tpl-radio"></div>'
          + '</div>';
      }).join('');

      var ptInfo = '<div style="background:#f0f9ff;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:#0369a1">'
        + '보유 포인트: <strong>' + F(availPts) + 'P</strong></div>';

      /* 포인트 부족 쿠폰이 있으면 구분선 표시 */
      if (cantList.length > 0 && canList.length > 0) {
        var dividerIdx = tplCardsHtml.lastIndexOf('</div>', tplCardsHtml.length);
        /* 구분선을 canList/cantList 사이에 삽입 */
        var firstCantId = cantList[0].id;
        var insertPoint = tplCardsHtml.indexOf('<div class="dpt-tpl-card" data-id="' + firstCantId + '"');
        if (insertPoint >= 0) {
          tplCardsHtml = tplCardsHtml.substring(0, insertPoint)
            + '<div style="text-align:center;font-size:11px;color:#9ca3af;padding:4px 0 8px;border-top:1px dashed #e5e7eb;margin-top:4px">포인트 부족 (발행 불가)</div>'
            + tplCardsHtml.substring(insertPoint);
        }
      }

      /* 이미 발행된 쿠폰이 있는지 확인 → 모달 제목 변경 */
      var hasIssuedCoupons = activeCoupons.length > 0;
      var modalTitle = hasIssuedCoupons ? '쿠폰 전송 / 발행' : '쿠폰 발행';
      var modalDesc = hasIssuedCoupons 
        ? escH(pname) + ' 환자 · 보유 쿠폰은 링크 전송, 미보유 쿠폰은 새 발행'
        : escH(pname) + ' 환자에게 발행';

      /* 완성된 모달을 한번에 생성하여 DOM에 추가 */
      var m = document.createElement('div');
      m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px';
      m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto">'
        + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 4px">' + modalTitle + '</h3>'
        + '<p style="font-size:12px;color:#6b7280;margin:0 0 12px">' + modalDesc + '</p>'
        + ptInfo + tplCardsHtml
        + '<div style="display:flex;gap:8px;margin-top:16px">'
        + '<button id="dpt-ci-cancel" style="flex:1;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
        + '<button id="dpt-ci-ok" style="flex:2;padding:11px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">발행하기</button>'
        + '</div></div>';
      m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
      document.body.appendChild(m);

      /* 첫 번째 발행 가능 템플릿 기본 선택 */
      var selectedId = null;
      var okBtn = m.querySelector('#dpt-ci-ok');
      if (okBtn) { okBtn.disabled = true; okBtn.textContent = '선택 후 발행'; okBtn.style.opacity = '0.5'; okBtn.style.cursor = 'not-allowed'; }

      /* preselect: 발행대상 섹션에서 클릭한 경우 해당 템플릿만 활성화 */
      var preIds = preselectTemplateIds || [];
      m.querySelectorAll('.dpt-tpl-card').forEach(function(card) {
        var cid = card.getAttribute('data-id');
        var isOk = card.getAttribute('data-ok') === '1';
        /* preselect 모드: 해당 템플릿만 클릭 가능, 나머지 비활성 */
        if (preIds.length > 0) {
          var isTarget = preIds.indexOf(String(cid)) >= 0;
          if (!isTarget) {
            card.style.opacity = '0.3'; card.style.cursor = 'not-allowed';
            card.addEventListener('click', function(e) { e.stopPropagation(); });
            return;
          }
        }
        if (!isOk) { card.addEventListener('click', function() { toast('포인트가 부족하여 선택할 수 없습니다.', 'error'); }); return; }
        card.addEventListener('click', function() {
          m.querySelectorAll('.dpt-tpl-card').forEach(function(c) {
            if (c.getAttribute('data-ok') === '1' && (preIds.length === 0 || preIds.indexOf(c.getAttribute('data-id')) >= 0)) {
              c.style.borderColor = '#e5e7eb'; c.style.background = '#fff';
              c.querySelector('.dpt-tpl-radio').style.borderColor = '#d1d5db';
              c.querySelector('.dpt-tpl-radio').style.background = 'transparent';
            }
          });
          card.style.borderColor = '#2563eb'; card.style.background = '#eff6ff';
          card.querySelector('.dpt-tpl-radio').style.borderColor = '#2563eb';
          card.querySelector('.dpt-tpl-radio').style.background = '#2563eb';
          selectedId = card.getAttribute('data-id');
          var selAlready = activeCoupons.some(function(c) { return String(c.template_id) === String(selectedId); });
          var btn = m.querySelector('#dpt-ci-ok');
          btn.disabled = false;
          btn.textContent = selAlready ? '링크 전송' : '발행하기';
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        });
        /* preselect가 1개면 자동 선택 */
        if (preIds.length === 1 && preIds[0] === String(cid) && isOk) {
          card.click();
        }
      });

      m.querySelector('#dpt-ci-cancel').addEventListener('click', function() { m.remove(); });
      m.querySelector('#dpt-ci-ok').addEventListener('click', function() {
        var btn = this;
        if (!selectedId) { toast('발행 가능한 쿠폰이 없습니다.', 'error'); return; }
        var selTpl = allTemplates.find(function(t) { return String(t.id) === String(selectedId); });
        dlog('발행클릭: selectedId=' + selectedId + ', selTpl=' + (selTpl ? selTpl.name : 'null') + ', is_birthday=' + (selTpl ? selTpl.is_birthday : '?') + ', coupon_kind=' + (selTpl ? selTpl.coupon_kind : '?') + ', forceBday=' + forceBday + ', isPatBday=' + isPatBday);
        
        /* 중복 발행 확인 */
        var alreadyIssued = selTpl ? activeCoupons.some(function(c) { return String(c.template_id) === String(selTpl.id); }) : false;
        
        /* 이미 보유한 쿠폰 → 발행하지 않고 링크 전송 모달로 이동 */
        if (alreadyIssued) {
          var ownedCpn = activeCoupons.find(function(c) { return String(c.template_id) === String(selectedId); });
          if (ownedCpn) {
            m.remove();
            showIssuedCouponModal({
              code: ownedCpn.code,
              template_name: selTpl ? selTpl.name : (ownedCpn.template_name || ''),
              patient_name: pname,
              expires_at: ownedCpn.expires_at || ''
            }, null, function() {
              /* 전송 완료 → UI 업데이트 */
              dlog('보유 쿠폰 링크 전송 완료: pid=' + pid + ', code=' + ownedCpn.code);
              /* 쿠폰관리 테이블 배지 업데이트 */
              var badge = document.querySelector('.dpt-cpn-status-badge[data-code="' + ownedCpn.code + '"]');
              if (badge) { badge.innerHTML = '전송'; badge.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:#d1fae5;color:#059669'; }
              /* 환자관리 드롭다운 배지 업데이트 */
              document.querySelectorAll('.dpt-dropdown-menu span').forEach(function(s) {
                if (s.textContent === '발행' && s.closest('[title]')) {
                  var parentDiv = s.closest('div[title]');
                  if (parentDiv && parentDiv.getAttribute('title') === (selTpl ? selTpl.name : '')) {
                    s.textContent = '전송'; s.style.background = '#d1fae5'; s.style.color = '#059669';
                  }
                }
              });
              if (currentPage === 'coupons' && typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
              if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
              toast(escH(pname) + '님에게 쿠폰 링크가 전송되었습니다!');
            });
            return;
          }
        }
        
        function doIssue() {
          btn.textContent = '발행 중...'; btn.disabled = true;
          callAPI('/coupons/issue', { method: 'POST', body: JSON.stringify({ clinic_id: CID(), patient_id: pid, template_id: selectedId, force_duplicate: true, force_birthday: !!isPatBday }) })
          .then(function(r) {
            m.remove();
            if (r.coupon && r.coupon.point_deducted > 0) {
              toast('쿠폰 발행 완료! ' + r.coupon.point_deducted.toLocaleString() + 'P 차감되었습니다.');
            } else {
              toast('쿠폰이 발행되었습니다!');
            }
            /* 발행 후 링크복사 모달 표시 */
            if (r.coupon) {
              var issuedCode = r.coupon.code || '';
              var issuedTplName = r.coupon.template_name || '';
              /* 쿠폰관리 페이지: 새 행 테이블에 삽입 */
              if (currentPage === 'coupons') {
                var tbody = document.getElementById('dpt-cpn-tbody');
                if (tbody) {
                  var sc2 = { active:'background:#dbeafe;color:#1d4ed8', shared:'background:#d1fae5;color:#059669', used:'background:#f3f4f6;color:#6b7280', expired:'background:#fee2e2;color:#ef4444', revoked:'background:#fef3c7;color:#d97706' };
                  var newRow = document.createElement('tr');
                  newRow.className = 'dpt-cpn-row';
                  newRow.setAttribute('data-pname', pname);
                  newRow.setAttribute('data-tname', issuedTplName);
                  newRow.setAttribute('data-status', 'active');
                  newRow.setAttribute('data-display-status', 'active');
                  newRow.setAttribute('data-shared', '0');
                  newRow.setAttribute('data-expiring', '0');
                  newRow.setAttribute('data-unshared', '1');
                  newRow.setAttribute('data-unused', '0');
                  newRow.style.borderTop = '1px solid #f9fafb';
                  newRow.innerHTML = '<td style="padding:10px 12px"><p style="font-weight:500;color:#1f2937;margin:0;font-size:13px">' + escH(issuedTplName) + '</p><span class="dpt-unsent-label" style="font-size:10px;color:#1d4ed8;font-weight:600;margin-left:4px">미전송</span></td>'
                    + '<td style="padding:10px 12px;white-space:nowrap;"><p class="dpt-cpn-pat-link" data-name="' + escH(pname) + '" style="font-weight:500;color:#374151;margin:0;font-size:13px;cursor:pointer;text-decoration:underline;text-decoration-color:#bfdbfe;text-underline-offset:2px">' + escH(pname) + '</p></td>'
                    + '<td style="padding:10px 12px;text-align:center"><span style="font-family:monospace;font-size:12px;font-weight:600;color:#2563eb">' + escH(issuedCode) + '</span></td>'
                    + '<td style="padding:10px 12px;text-align:center"><span class="dpt-cpn-status-badge dpt-cpn-share dpt-tooltip" data-tooltip="클릭하여 링크를 전송하세요" data-code="' + escH(issuedCode) + '" data-tname="' + escH(issuedTplName) + '" data-pname="' + escH(pname) + '" style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:#dbeafe;color:#1d4ed8;cursor:pointer;border:1px dashed #93c5fd;transition:background .2s">발행<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></span></td>'
                    + '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">'
                    + '<button class="dpt-cpn-share" data-code="' + escH(issuedCode) + '" data-tname="' + escH(issuedTplName) + '" data-pname="' + escH(pname) + '" style="padding:4px 8px;border-radius:6px;border:none;background:#e0e7ff;color:#1d4ed8;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">공유</button>'
                    + '<button class="dpt-cpn-revoke" data-code="' + escH(issuedCode) + '" data-pname="' + escH(pname) + '" data-tname="' + escH(issuedTplName) + '" style="padding:4px 8px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">회수</button>'
                    + '<button class="dpt-del-coupon-direct" data-cid="' + (r.coupon.id||'') + '" data-cname="' + escH(issuedTplName) + '" style="padding:4px 8px;border-radius:6px;border:none;background:#f3f4f6;color:#6b7280;font-size:11px;cursor:pointer;font-family:inherit">삭제</button></td>';
                  tbody.insertBefore(newRow, tbody.firstChild);
                  /* 새 행에 이벤트 바인딩 */
                  newRow.querySelectorAll('.dpt-cpn-share').forEach(function(s) {
                    s.addEventListener('click', function(ev) {
                      var btn2 = ev.target.closest('.dpt-cpn-share') || ev.target;
                      var ds2 = btn2.dataset;
                      showIssuedCouponModal({ code: ds2.code, template_name: ds2.tname, patient_name: ds2.pname }, null, function() {
                        var badge2 = document.querySelector('.dpt-cpn-status-badge[data-code="' + ds2.code + '"]');
                        if (badge2) { badge2.innerHTML = '전송'; badge2.className = 'dpt-cpn-status-badge'; badge2.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:#d1fae5;color:#059669'; }
                        newRow.setAttribute('data-shared', '1'); newRow.setAttribute('data-unshared', '0'); newRow.setAttribute('data-unused', '1'); newRow.setAttribute('data-display-status', 'shared');
                        var unsent3 = newRow.querySelector('.dpt-unsent-label');
                        if (unsent3 && unsent3.textContent.indexOf('미전송') >= 0) unsent3.remove();
                        toast('쿠폰 링크가 전송 처리되었습니다.');
                        if (typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
                        if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
                      });
                    });
                  });
                  /* 필터 재적용 */
                  if (typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
                }
              }
              showIssuedCouponModal(r.coupon, null, function() {
                /* onCopy: share API 성공 확인됨 → 배지를 '전송'으로 변경 */
                markSharedCode(r.coupon.code);
                dlog('발행 후 링크복사 완료(share API 성공): pid=' + pid + ', tplId=' + selectedId);
                /* 환자관리 페이지의 드롭다운 배지도 업데이트 */
                document.querySelectorAll('.dpt-dropdown-menu span').forEach(function(s) {
                  if (s.textContent === '발행' && s.closest('[title]')) {
                    var parentDiv = s.closest('div[title]');
                    if (parentDiv && parentDiv.getAttribute('title') === issuedTplName) {
                      s.textContent = '전송'; s.style.background = '#d1fae5'; s.style.color = '#059669';
                    }
                  }
                });
                /* 쿠폰관리 페이지: 새로고침 대신 필터 재적용 + 미전송 카운트 차감 */
                if (currentPage === 'coupons' && typeof window._dptCpnDoSearch === 'function') {
                  window._dptCpnDoSearch();
                }
                if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
              });
            }
            if (r.patient_points) {
              var rows = document.querySelectorAll('tr[data-patid="' + pid + '"]');
              rows.forEach(function(row) {
                var ptCell = row.querySelector('.dpt-pts-cell');
                if (ptCell) ptCell.textContent = (r.patient_points.available_points || 0).toLocaleString() + 'P';
              });
            }
            /* 발행 후 대시보드: DOM 직접 업데이트 (pgDash 호출 안 함) */
            /* 1) 대시보드 발행 대상 행 처리 (skipDashRefresh=true인 경우) */
            if (skipDashRefresh) {
              var autoBtn = document.querySelector('.dpt-auto-issue-btn[data-pid="' + pid + '"]');
              if (autoBtn) {
                var curIds = (autoBtn.getAttribute('data-tpl-ids') || '').split(',').filter(function(x){ return x; });
                var issuedTid = String(selectedId);
                curIds = curIds.filter(function(x){ return x !== issuedTid; });
                autoBtn.setAttribute('data-tpl-ids', curIds.join(','));
                if (curIds.length === 0) {
                  autoBtn.textContent = '완료'; autoBtn.style.background = '#16a34a'; autoBtn.disabled = true; autoBtn.style.cursor = 'not-allowed';
                }
              }
            }
            /* 2) 쿠폰관리 페이지 발행대상 행 처리 */
            var autoBtn2 = document.querySelector('.dpt-auto-issue-btn2[data-pid="' + pid + '"]');
            if (autoBtn2) {
              autoBtn2.textContent = '완료';
              autoBtn2.style.background = '#16a34a';
              autoBtn2.disabled = true;
            }
            /* 3) 새 쿠폰 발행됨 → 미전송 카운트 +1 (share 하면 -1 되므로 상쇄) */
            if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(1);
            /* 4) 발행대상 카운트 -1 */
            if (typeof window._dptAutoUpdateCount === 'function') window._dptAutoUpdateCount(-1);
            if (!skipDashRefresh && typeof window._dptLoadPat === 'function') { setTimeout(function(){ window._dptLoadPat(); }, 400); }
          })
          .catch(function(e) { dlog('발행API에러: ' + e.message); toast(e.message, 'error'); btn.textContent = '발행하기'; btn.disabled = false; });
        }
        
        if (alreadyIssued) {
          /* 이미 보유중 → 발행 대신 기존 쿠폰의 링크 전송 모달 열기 */
          var existingCoupon = activeCoupons.find(function(c) { return String(c.template_id) === String(selectedId); });
          if (existingCoupon && existingCoupon.code) {
            m.remove();
            showIssuedCouponModal({ code: existingCoupon.code, template_name: selTpl.name, patient_name: pname, expires_at: existingCoupon.expires_at || '' }, null, function() {
              toast(pname + '님 쿠폰 링크가 전송 처리되었습니다.');
              if (typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
              if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
            });
            return;
          }
          showConfirmModal('중복 발행', '이미 해당 환자가 보유하고 있는 (발행된) 쿠폰입니다.\n추가로 1장 더 중복 발행하시겠습니까?', doIssue);
        } else {
          doIssue();
        }
      });
    }).catch(function(e) { dlog('showCouponIssueModal 에러: ' + e.message); toast(e.message || '쿠폰 발행 창을 열 수 없습니다.', 'error'); });
  }

    /* --- 쿠폰관리 --- */
  function pgCpn(el) {
    if (!CID()) { el.innerHTML = '<p style="padding:20px;color:#ef4444;text-align:center;font-size:13px">클리닉 정보를 불러올 수 없습니다.</p>'; return; }
    el.innerHTML = SPIN_HTML;
    /* 성능 최적화: patients API 제거 (쿠폰에 이미 JOIN됨), templates는 지연로드 */
    Promise.all([
      callAPI('/coupons/clinic?clinic_id=' + CID()),
      callAPI('/dashboard?clinic_id=' + CID())
    ]).then(function(results) {
      var coupons = results[0].coupons || [];
      var couponTotal = results[0].total || coupons.length;
      var templateNames = results[0].template_names || []; /* 서버에서 모든 쿠폰 종류 목록 반환 */
      var patients = []; /* 미사용 - 쿠폰에 patient_name/phone/chart 포함 */
      var templates = []; /* 지연 로드: 발행 시 callAPI로 로드 */
      var dashData = results[1] || {};
      var autoEligible = dashData.auto_eligible || [];
      var autoEligibleTotal = dashData.auto_eligible_total || autoEligible.length;
      var undelivered = dashData.undelivered_coupons || [];
      var undeliveredTotal = dashData.undelivered_total || undelivered.length;
      var sc = { active:'background:#dbeafe;color:#1d4ed8', shared:'background:#d1fae5;color:#059669', used:'background:#f3f4f6;color:#6b7280', expired:'background:#fee2e2;color:#ef4444', revoked:'background:#fef3c7;color:#d97706' };
      var sl = { active:'발행', shared:'전송', used:'사용완료', expired:'만료', revoked:'회수' };

      /* 자동 필터 체크 */
      var autoFilter = window._dptCpnAutoFilter || '';
      window._dptCpnAutoFilter = ''; /* 한번 사용 후 초기화 */
      
      el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'
        + '<div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">쿠폰 관리</div>'
        /* 요약 카드 2개 */
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">'
        + '<div id="dpt-cpn-auto-card" style="background:' + (autoFilter === 'auto_eligible' ? '#eff6ff' : '#fff') + ';border-radius:10px;padding:12px 14px;border:2px solid ' + (autoFilter === 'auto_eligible' ? '#3b82f6' : '#e5e7eb') + ';cursor:pointer;transition:all .2s">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:12px;font-weight:600;color:#1d4ed8">발행 대상</span>'
        + '<span id="dpt-dash-auto-count" style="font-size:18px;font-weight:700;color:' + (autoEligibleTotal > 0 ? '#2563eb' : '#9ca3af') + '">' + autoEligibleTotal + '<span style="font-size:11px;color:#6b7280;font-weight:500">명</span></span>'
        + '</div>'
        + '<p style="font-size:10px;color:#9ca3af;margin:4px 0 0">최초 발행 · 링크 미전달</p></div>'
        + '<div id="dpt-cpn-undel-card" style="background:' + (autoFilter === 'unshared' ? '#eff6ff' : '#fff') + ';border-radius:10px;padding:12px 14px;border:2px solid ' + (autoFilter === 'unshared' ? '#3b82f6' : '#e5e7eb') + ';cursor:pointer;transition:all .2s">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:12px;font-weight:600;color:#1d4ed8">미전송 쿠폰</span>'
        + '<span style="font-size:18px;font-weight:700;color:' + (undeliveredTotal > 0 ? '#2563eb' : '#9ca3af') + '">' + undeliveredTotal + '<span style="font-size:11px;color:#6b7280;font-weight:500">건</span></span>'
        + '</div>'
        + '<p style="font-size:10px;color:#9ca3af;margin:4px 0 0">발행 완료 · 미전달</p></div>'
        + '</div>'
        /* 기존 쿠폰 테이블 */
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
        + '<div style="padding:12px 16px;border-bottom:1px solid #d1d5db;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
        + '<div style="display:flex;align-items:center;gap:8px;"><h3 style="font-size:14px;font-weight:600;color:#1f2937;margin:0">발행된 쿠폰</h3><span style="font-size:12px;color:#9ca3af">' + couponTotal + '건</span></div>'
        + '<div style="display:flex;gap:4px;flex-wrap:wrap">'
        + '<select id="dpt-cpn-list-filter" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;font-family:inherit;max-width:160px;text-overflow:ellipsis;">'
        + '<option value="">모든 쿠폰</option>'
        + (templateNames.length > 0 ? templateNames : Array.from(new Set(coupons.map(function(c){return c.template_name;})))).map(function(name){return '<option value="'+escH(name)+'">'+escH(name)+'</option>';}).join('')
        + '</select>'
        + '<select id="dpt-cpn-status-filter" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;font-family:inherit;">'
        + '<option value=""' + (autoFilter === '' ? ' selected' : '') + '>모든 상태</option>'
        + '<option value="auto_eligible"' + (autoFilter === 'auto_eligible' ? ' selected' : '') + '>발행대상</option>'
        + '<option value="unshared"' + (autoFilter === 'unshared' ? ' selected' : '') + '>미전송(발행)</option>'
        + '<option value="unused">전송완료</option>'
        + '<option value="expiring">기간임박(7일)</option>'
        + '<option value="expired">만료</option>'
        + '<option value="active">활성(발행+전송)</option>'
        + '<option value="used">사용완료</option>'
        + '<option value="revoked">회수</option>'
        + '</select>'
        + '<input id="dpt-cpn-list-search" type="text" placeholder="환자명 검색" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;font-family:inherit;width:100px;"><button id="dpt-cpn-list-search-btn" style="padding:6px 12px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;font-family:inherit">검색</button></div>'
        + '</div>'
        + '<div id="dpt-cpn-table-body" style="overflow-x:auto;max-height:500px;overflow-y:auto;min-height:0;padding-bottom:' + (autoFilter ? '0' : '80px') + ';display:' + (autoFilter ? 'none' : 'block') + '"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead style="position:sticky;top:0;z-index:10;background:#f9fafb;"><tr style="background:#f9fafb"><th style="text-align:left;padding:10px 12px;font-weight:600;color:#6b7280;white-space:nowrap;">쿠폰</th><th style="text-align:left;padding:10px 12px;font-weight:600;color:#6b7280;white-space:nowrap;">환자</th><th style="text-align:center;padding:10px 12px;font-weight:600;color:#6b7280;white-space:nowrap;">코드</th><th style="text-align:center;padding:10px 12px;font-weight:600;color:#6b7280;white-space:nowrap;">상태</th><th style="text-align:right;padding:10px 12px;font-weight:600;color:#6b7280;white-space:nowrap;">관리</th></tr></thead><tbody id="dpt-cpn-tbody">'
        + (coupons.length === 0
          ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af">발행된 쿠폰이 없습니다.</td></tr>'
          : coupons.map(function(x) {
            var now = new Date(); var nowStr = now.toISOString().split('T')[0];
            var daysLeft = x.expires_at ? Math.ceil((new Date(x.expires_at) - now) / 86400000) : 999;
            var isExpiring = x.status === 'active' && daysLeft >= 0 && daysLeft <= 7;
            var isUnshared = x.status === 'active' && !x.shared_at;
            var isShared = x.status === 'active' && !!x.shared_at;
            var displayStatus = x.status === 'active' ? (isShared ? 'shared' : 'active') : x.status;
            return '<tr class="dpt-cpn-row" data-pname="' + escH(x.patient_name||'') + '" data-tname="' + escH(x.template_name||'') + '" data-status="' + escH(x.status) + '" data-display-status="' + displayStatus + '" data-shared="' + (x.shared_at ? '1' : '0') + '" data-expiring="' + (isExpiring ? '1' : '0') + '" data-unshared="' + (isUnshared ? '1' : '0') + '" data-unused="' + (isShared ? '1' : '0') + '" style="border-top:1px solid #d1d5db">'
              + '<td style="padding:10px 12px"><p style="font-weight:500;color:#1f2937;margin:0;font-size:13px">' + escH(x.template_name) + '</p>'
              + (isExpiring ? '<span style="font-size:10px;color:#ef4444;font-weight:600">만료 ' + daysLeft + '일 전</span>' : '')
              + (isUnshared ? '<span class="dpt-unsent-label" style="font-size:10px;color:#1d4ed8;font-weight:600;margin-left:4px">미전송</span>' : '')
              + '</td>'
              + '<td style="padding:10px 12px;white-space:nowrap;"><p class="dpt-cpn-pat-link" data-name="' + escH(x.patient_name||'') + '" style="font-weight:500;color:#374151;margin:0;font-size:13px;cursor:pointer;text-decoration:underline;text-decoration-color:#bfdbfe;text-underline-offset:2px">' + escH(x.patient_name) + '</p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0;">' + escH(x.patient_phone || '-') + '</p></td>'
              + '<td style="padding:10px 12px;text-align:center"><span style="display:inline-flex;align-items:center;gap:4px"><span style="font-family:monospace;font-size:12px;font-weight:600;color:#2563eb">' + escH(x.code) + '</span><svg class="dpt-copy-code" data-code="' + escH(x.code) + '" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;flex-shrink:0;transition:stroke .2s" onmouseenter="this.style.stroke=\'#2563eb\'" onmouseleave="this.style.stroke=\'#9ca3af\'"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></span></td>'
              + '<td style="padding:10px 12px;text-align:center"><span class="dpt-cpn-status-badge' + (isUnshared ? ' dpt-cpn-share dpt-tooltip' : '') + '"' + (isUnshared ? ' data-tooltip="클릭하여 링크를 전송하세요"' : '') + ' data-code="' + escH(x.code) + '"' + (isUnshared ? ' data-tname="' + escH(x.template_name||'') + '" data-pname="' + escH(x.patient_name||'') + '" data-dtype="' + x.discount_type + '" data-dval="' + x.discount_value + '" data-expires="' + escH(x.expires_at) + '"' : '') + ' style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;' + (sc[displayStatus] || '') + (isUnshared ? ';cursor:pointer;border:1px dashed #93c5fd;transition:background .2s' : '') + '">' + escH(sl[displayStatus] || x.status) + (isUnshared ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' : '') + '</span></td>'
              + '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' + (x.status === 'active'
                ? '<button class="dpt-cpn-share" data-code="' + escH(x.code) + '" data-tname="' + escH(x.template_name||'') + '" data-pname="' + escH(x.patient_name||'') + '" data-dtype="' + x.discount_type + '" data-dval="' + x.discount_value + '" data-expires="' + escH(x.expires_at) + '" style="padding:4px 8px;border-radius:6px;border:none;background:#e0e7ff;color:#1d4ed8;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">공유</button>'
                + '<button class="dpt-cpn-revoke" data-code="' + escH(x.code) + '" data-pname="' + escH(x.patient_name||'') + '" data-tname="' + escH(x.template_name||'') + '" style="padding:4px 8px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">회수</button>'
                + '<button class="dpt-del-coupon-direct" data-cid="' + x.id + '" data-cname="' + escH(x.template_name||'') + '" style="padding:4px 8px;border-radius:6px;border:none;background:#f3f4f6;color:#6b7280;font-size:11px;cursor:pointer;font-family:inherit">삭제</button>'
                : '<button class="dpt-del-coupon-direct" data-cid="' + x.id + '" data-cname="' + escH(x.template_name||'') + '" style="padding:4px 10px;border-radius:6px;border:none;background:#f3f4f6;color:#6b7280;font-size:11px;font-weight:500;cursor:pointer;font-family:inherit;">삭제</button>') + '</td></tr>';
          }).join(''))
        + '</tbody></table></div>'
        + '</div>'
        /* === 발행대상 리스트 (쿠폰 테이블 아래) === */
        + '<div id="dpt-cpn-auto-section" style="display:' + (autoFilter === 'auto_eligible' ? 'block' : 'none') + ';margin-top:14px">'
        + '<div style="background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;overflow:hidden">'
        + '<div style="padding:10px 16px;border-bottom:1px solid #bfdbfe">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:13px;font-weight:700;color:#1d4ed8">발행 대상 <span style="font-size:10px;font-weight:500;color:#6b7280">(최초 발행 · 링크 미전달)</span></span>'
        + '<span id="dpt-ae-badge" style="font-size:11px;color:#2563eb;background:#dbeafe;border-radius:20px;padding:2px 8px;font-weight:600">' + autoEligibleTotal + '명</span></div>'
        + '<select id="dpt-ae-period" style="padding:3px 8px;border:1px solid #93c5fd;border-radius:6px;font-size:11px;color:#1d4ed8;background:#dbeafe;outline:none;font-family:inherit;cursor:pointer;font-weight:600">'
        + '<option value="7">최근 1주</option>'
        + '<option value="30" selected>최근 1개월</option>'
        + '<option value="90">최근 3개월</option>'
        + '<option value="180">최근 6개월</option>'
        + '<option value="0">전체</option>'
        + '</select></div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px">'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<span id="dpt-ae-period-info" style="font-size:10px;color:#6b7280"></span>'
        + '<select id="dpt-ae-tpl-filter" style="padding:2px 6px;border:1px solid #93c5fd;border-radius:4px;font-size:10px;color:#1d4ed8;background:#fff;outline:none;font-family:inherit;cursor:pointer"><option value="">전체 쿠폰</option></select>'
        + '</div>'
        + '<span style="font-size:10px;color:#ef4444;font-weight:600">링크를 복사하여 카톡으로 전송하세요</span></div>'
        + '</div>'
        + '<div id="dpt-ae-list"></div>'
        + '<div id="dpt-ae-pager" style="padding:8px 12px;border-top:1px solid #bfdbfe;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap"></div>'
        + '</div></div>'
        /* === 미전송 쿠폰 섹션 (쿠폰 테이블 아래) === */
        + '<div id="dpt-cpn-undel-section" style="display:' + (autoFilter === 'unshared' ? 'block' : 'none') + ';margin-top:14px">'
        + '<div style="background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;overflow:hidden">'
        + '<div style="padding:10px 16px;border-bottom:1px solid #bfdbfe">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:13px;font-weight:700;color:#1d4ed8">미전송 쿠폰</span>'
        + '<span id="dpt-ud-badge" style="font-size:11px;color:#2563eb;background:#dbeafe;border-radius:20px;padding:2px 8px;font-weight:600">' + undeliveredTotal + '건</span></div>'
        + '<select id="dpt-ud-tpl-filter" style="padding:3px 8px;border:1px solid #93c5fd;border-radius:6px;font-size:11px;color:#1d4ed8;background:#dbeafe;outline:none;font-family:inherit;cursor:pointer;font-weight:600">'
        + '<option value="">모든 쿠폰</option></select></div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between">'
        + '<span id="dpt-ud-info" style="font-size:10px;color:#6b7280"></span>'
        + '<span style="font-size:10px;color:#ef4444;font-weight:600">링크 복사 → 카톡 전달 → 지급 완료</span></div>'
        + '</div>'
        + '<div id="dpt-ud-list"></div>'
        + '<div id="dpt-ud-pager" style="padding:8px 12px;border-top:1px solid #bfdbfe;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap"></div>'
        + '</div></div>'
        + '</div>';

      var searchInput = el.querySelector('#dpt-cpn-list-search');
      var searchBtn = el.querySelector('#dpt-cpn-list-search-btn');
      
      var filterSelect = el.querySelector('#dpt-cpn-list-filter');
      var statusFilter = el.querySelector('#dpt-cpn-status-filter');
      function doSearch() {
        var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
        var f = filterSelect ? filterSelect.value : '';
        var sf = statusFilter ? statusFilter.value : '';
        var rows = el.querySelectorAll('.dpt-cpn-row');
        var visCount = 0;
        console.log('[DPT doSearch] q=' + q + ' f=' + f + ' sf=' + sf + ' rows=' + rows.length);
        for (var i=0; i<rows.length; i++) {
          var pname = rows[i].getAttribute('data-pname') || '';
          var tname = rows[i].getAttribute('data-tname') || '';
          var status = rows[i].getAttribute('data-status') || '';
          var matchQ = pname.toLowerCase().indexOf(q) > -1;
          var matchF = f === '' || tname === f;
          var matchS = true;
          if (sf === 'unshared') matchS = rows[i].getAttribute('data-unshared') === '1';
          else if (sf === 'unused') matchS = rows[i].getAttribute('data-unused') === '1';
          else if (sf === 'expiring') matchS = rows[i].getAttribute('data-expiring') === '1';
          else if (sf === 'active') matchS = status === 'active';
          else if (sf !== '') matchS = status === sf;
          var show = matchQ && matchF && matchS;
          rows[i].style.display = show ? '' : 'none';
          if (show) visCount++;
        }
        /* 검색 결과 표시 업데이트 */
        var countEl = el.querySelector('#dpt-cpn-search-count');
        if (q || f || (sf && sf !== 'auto_eligible' && sf !== 'unshared')) {
          if (!countEl) {
            countEl = document.createElement('div');
            countEl.id = 'dpt-cpn-search-count';
            countEl.style.cssText = 'padding:8px 16px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;';
            var tableBody = document.getElementById('dpt-cpn-table-body');
            if (tableBody) tableBody.parentNode.insertBefore(countEl, tableBody);
          }
          countEl.innerHTML = '검색 결과: <strong style="color:#1f2937">' + visCount + '</strong>건 / 전체 ' + rows.length + '건';
        } else if (countEl) { countEl.remove(); }
        /* 검색어가 있는데 결과 0건 → 모달 알림 (아임웹 iframe/z-index 대응) */
        if (q && visCount === 0) {
          console.log('[DPT doSearch] 0 results for "' + q + '" → showing modal');
          /* 기존 모달 제거 */
          var oldModal = document.getElementById('dpt-no-coupon-modal');
          if (oldModal) oldModal.remove();
          var ov = document.createElement('div');
          ov.id = 'dpt-no-coupon-modal';
          ov.setAttribute('style', 'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100vw !important;height:100vh !important;background:rgba(0,0,0,0.6) !important;z-index:2147483647 !important;display:flex !important;align-items:center !important;justify-content:center !important;margin:0 !important;padding:0 !important;');
          var safeQ = searchInput ? searchInput.value.trim().replace(/[<>&"']/g, function(c) { return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]; }) : q;
          ov.innerHTML = '<div style="background:#fff !important;border-radius:16px !important;padding:32px 28px !important;max-width:400px !important;width:90% !important;text-align:center !important;box-shadow:0 25px 60px rgba(0,0,0,0.4) !important;position:relative !important;z-index:2147483647 !important;">'
            + '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>'
            + '<div style="font-size:18px !important;font-weight:700 !important;color:#1f2937 !important;margin-bottom:12px !important;word-break:keep-all !important;line-height:1.5 !important;">\'' + safeQ + '\' 님은 발행된 쿠폰이 없습니다</div>'
            + '<div style="font-size:14px !important;color:#6b7280 !important;margin-bottom:24px !important;word-break:keep-all !important;line-height:1.6 !important;">해당 환자에게 아직 쿠폰이 발행된 적이 없습니다.<br>환자관리에서 쿠폰을 발행해 주세요.</div>'
            + '<button id="dpt-no-coupon-modal-ok" style="background:#F59E0B !important;color:#fff !important;border:none !important;padding:12px 40px !important;border-radius:10px !important;font-size:15px !important;font-weight:600 !important;cursor:pointer !important;outline:none !important;">확인</button>'
            + '</div>';
          /* body에 추가 (iframe 내라도 최상단) */
          document.body.appendChild(ov);
          /* 이벤트: 확인 버튼 / 배경 클릭으로 닫기 */
          var closeModal = function() { var m = document.getElementById('dpt-no-coupon-modal'); if(m) m.remove(); };
          document.getElementById('dpt-no-coupon-modal-ok').onclick = closeModal;
          ov.addEventListener('click', function(e) { if (e.target === ov) closeModal(); });
          /* 5초 후 자동 닫기 (fallback) */
          setTimeout(closeModal, 5000);
        }
      }
      
      /* doSearch를 전역에 노출하여 공유/발행 후 필터 유지 가능 */
      window._dptCpnDoSearch = doSearch;

      /* 미전송 쿠폰 카운트 실시간 업데이트 헬퍼 */
      function updateUndelCount(delta) {
        var card = el.querySelector('#dpt-cpn-undel-card');
        if (!card) return;
        var numSpan = card.querySelector('span[style*="font-size:18px"]');
        if (!numSpan) return;
        var cur = parseInt(numSpan.textContent) || 0;
        var newVal = Math.max(0, cur + delta);
        var subSpan = numSpan.querySelector('span');
        numSpan.innerHTML = newVal + (subSpan ? subSpan.outerHTML : '<span style="font-size:11px;color:#6b7280;font-weight:500">건</span>');
        numSpan.style.color = newVal > 0 ? '#2563eb' : '#9ca3af';
        card.style.borderColor = newVal > 0 ? (card.style.borderColor === 'rgb(59, 130, 246)' ? '#3b82f6' : '#e5e7eb') : '#e5e7eb';
      }
      window._dptCpnUpdateUndelCount = updateUndelCount;

      /* 발행대상 카운트 실시간 업데이트 */
      function updateAutoCount(delta) {
        /* 쿠폰관리 페이지의 발행대상 카드 */
        var ac = el.querySelector('#dpt-cpn-auto-card');
        if (ac) {
          var ns = ac.querySelector('span[style*="font-size:18px"]');
          if (ns) {
            var cur = parseInt(ns.textContent) || 0;
            var nv = Math.max(0, cur + delta);
            var sub = ns.querySelector('span');
            ns.innerHTML = nv + (sub ? sub.outerHTML : '<span style="font-size:11px;color:#6b7280;font-weight:500">명</span>');
            ns.style.color = nv > 0 ? '#2563eb' : '#9ca3af';
          }
        }
        /* 발행대상 섹션 내 배지 */
        var badge = el.querySelector('#dpt-cpn-auto-section span[style*="border-radius:20px"]');
        if (badge) {
          var bcur = parseInt(badge.textContent) || 0;
          var bnv = Math.max(0, bcur + delta);
          badge.textContent = bnv + '명';
        }
        /* 대시보드의 발행대상 박스 (다른 페이지에 있을 수 있음) */
        var dashBox = document.querySelector('#dpt-dash-auto-box');
        if (dashBox) {
          var dns = dashBox.querySelector('p[style*="font-size:22px"]');
          if (dns) {
            var dcur = parseInt(dns.textContent) || 0;
            var dnv = Math.max(0, dcur + delta);
            var dsub = dns.querySelector('span');
            dns.innerHTML = dnv + (dsub ? dsub.outerHTML : '<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">명</span>');
            dns.style.color = dnv > 0 ? '#2563eb' : '#9ca3af';
          }
        }
      }
      window._dptAutoUpdateCount = updateAutoCount;

      /* 검색/필터 시 테이블 본체 복원 헬퍼 */
      function showTableBody() {
        var tb = document.getElementById('dpt-cpn-table-body');
        if (tb && tb.style.display === 'none') {
          tb.style.display = 'block'; tb.style.minHeight = '280px'; tb.style.paddingBottom = '80px';
        }
      }
      if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', function() { showTableBody(); doSearch(); });
        searchInput.addEventListener('keyup', function(e) { if(e.key==='Enter') { showTableBody(); doSearch(); } });
        if(filterSelect) filterSelect.addEventListener('change', function() { if(searchInput) searchInput.value = ''; showTableBody(); doSearch(); });
        if(statusFilter) statusFilter.addEventListener('change', function() {
          if(searchInput) searchInput.value = '';
          doSearch();
          /* 상태 필터 변경 시 카드 강조 업데이트 */
          var v = statusFilter.value;
          var autoCard = el.querySelector('#dpt-cpn-auto-card');
          var undelCard = el.querySelector('#dpt-cpn-undel-card');
          var autoSec = el.querySelector('#dpt-cpn-auto-section');
          var undelSec2 = el.querySelector('#dpt-cpn-undel-section');
          var tableBody = document.getElementById('dpt-cpn-table-body');
          if (autoCard) { autoCard.style.borderColor = '#e5e7eb'; autoCard.style.background = '#fff'; }
          if (undelCard) { undelCard.style.borderColor = '#e5e7eb'; undelCard.style.background = '#fff'; }
          if (autoSec) autoSec.style.display = 'none';
          if (undelSec2) undelSec2.style.display = 'none';
          if (v === 'auto_eligible' || v === 'unshared') {
            /* 발행대상/미전송 선택 시 테이블 본체 숨김 */
            if (tableBody) { tableBody.style.display = 'none'; }
            if (v === 'auto_eligible' && autoCard) { autoCard.style.borderColor = '#3b82f6'; autoCard.style.background = '#eff6ff'; if (autoSec) autoSec.style.display = 'block'; loadAutoEligible(1); }
            else if (v === 'unshared' && undelCard) { undelCard.style.borderColor = '#3b82f6'; undelCard.style.background = '#eff6ff'; if (undelSec2) { undelSec2.style.display = 'block'; loadUndelivered(1); } }
          } else {
            /* 다른 필터 선택 시 테이블 본체 표시 */
            if (tableBody) { tableBody.style.display = 'block'; tableBody.style.minHeight = '280px'; tableBody.style.paddingBottom = '80px'; }
          }
        });
      }

      /* 자동 필터 적용 (대시보드에서 진입 시) */
      if (autoFilter === 'unshared' || autoFilter === 'auto_eligible') {
        doSearch();
        if (autoFilter === 'auto_eligible') {
          var _as = el.querySelector('#dpt-cpn-auto-section');
          var _ac = el.querySelector('#dpt-cpn-auto-card');
          if (_as) _as.style.display = 'block';
          if (_ac) { _ac.style.borderColor = '#3b82f6'; _ac.style.background = '#eff6ff'; }
        }
        if (autoFilter === 'unshared') {
          var _uc = el.querySelector('#dpt-cpn-undel-card');
          var _us = el.querySelector('#dpt-cpn-undel-section');
          if (_uc) { _uc.style.borderColor = '#3b82f6'; _uc.style.background = '#eff6ff'; }
          if (_us) _us.style.display = 'block';
          loadUndelivered(1);
        }
      }

      /* 요약 카드 클릭 핸들러 */
      var autoCard = el.querySelector('#dpt-cpn-auto-card');
      var undelCard = el.querySelector('#dpt-cpn-undel-card');
      var autoSec = el.querySelector('#dpt-cpn-auto-section');
      if (autoCard) {
        autoCard.addEventListener('click', function() {
          /* 토글: 발행대상 섹션 표시/숨기기 */
          var showing = autoSec.style.display !== 'none';
          var tableBody = document.getElementById('dpt-cpn-table-body');
          autoSec.style.display = showing ? 'none' : 'block';
          if (!showing) loadAutoEligible(1);
          autoCard.style.borderColor = showing ? '#e5e7eb' : '#3b82f6';
          autoCard.style.background = showing ? '#fff' : '#eff6ff';
          /* 상태 필터 연동 */
          if (statusFilter) { statusFilter.value = showing ? '' : 'auto_eligible'; doSearch(); }
          if (undelCard) { undelCard.style.borderColor = '#e5e7eb'; undelCard.style.background = '#fff'; }
          var _undelSec = document.getElementById('dpt-cpn-undel-section');
          if (_undelSec) _undelSec.style.display = 'none';
          /* 테이블 본체 표시/숨김 */
          if (tableBody) {
            if (showing) { tableBody.style.display = 'block'; tableBody.style.minHeight = '280px'; tableBody.style.paddingBottom = '80px'; }
            else { tableBody.style.display = 'none'; }
          }
        });
        autoCard.addEventListener('mouseenter', function() { autoCard.style.boxShadow = '0 2px 8px rgba(37,99,235,.12)'; });
        autoCard.addEventListener('mouseleave', function() { autoCard.style.boxShadow = 'none'; });
      }
      if (undelCard) {
        undelCard.addEventListener('click', function() {
          /* 미전송 필터 토글 */
          var undelSec = document.getElementById('dpt-cpn-undel-section');
          var tableBody = document.getElementById('dpt-cpn-table-body');
          var isActive = statusFilter && statusFilter.value === 'unshared';
          if (statusFilter) { statusFilter.value = isActive ? '' : 'unshared'; doSearch(); }
          undelCard.style.borderColor = isActive ? '#e5e7eb' : '#3b82f6';
          undelCard.style.background = isActive ? '#fff' : '#eff6ff';
          if (autoCard) { autoCard.style.borderColor = '#e5e7eb'; autoCard.style.background = '#fff'; }
          if (autoSec) autoSec.style.display = 'none';
          if (undelSec) {
            undelSec.style.display = isActive ? 'none' : 'block';
            if (!isActive) loadUndelivered(1);
          }
          /* 테이블 본체 표시/숨김 */
          if (tableBody) {
            if (isActive) { tableBody.style.display = 'block'; tableBody.style.minHeight = '280px'; tableBody.style.paddingBottom = '80px'; }
            else { tableBody.style.display = 'none'; }
          }
        });
        undelCard.addEventListener('mouseenter', function() { undelCard.style.boxShadow = '0 2px 8px rgba(37,99,235,.12)'; });
        undelCard.addEventListener('mouseleave', function() { undelCard.style.boxShadow = 'none'; });
      }


      /* 발행대상 페이지네이션 로딩 */
      var _aePage = 1;
      var _aeLimit = 20;
      var _aeSinceDays = 30;
      var _aeTplFilter = '';
      function loadAutoEligible(page) {
        _aePage = page || 1;
        var listEl = document.getElementById('dpt-ae-list');
        var pagerEl = document.getElementById('dpt-ae-pager');
        if (!listEl) return;
        listEl.innerHTML = '<p style="text-align:center;padding:12px;color:#9ca3af;font-size:12px">로딩 중...</p>';
        var url = '/coupons/auto-eligible?clinic_id=' + CID() + '&page=' + _aePage + '&limit=' + _aeLimit + '&since_days=' + _aeSinceDays;
        if (_aeTplFilter) url += '&template_id=' + _aeTplFilter;
        callAPI(url)
          .then(function(r) {
            var rawItems = r.coupons || r.patients || [];
            /* 세션 캐시에서 이미 share된 쿠폰 필터링 */
            var items = rawItems.filter(function(cp) { return !isSharedCode(cp.code); });
            var sharedDiff = rawItems.length - items.length;
            var total = Math.max(0, (r.total || 0) - sharedDiff);
            var totalAll = Math.max(0, (r.total_all || total) - sharedDiff);
            var totalPages = r.total_pages || 0;
            var sinceDate = r.since_date || '';
            var sinceDays = r.since_days || 0;
            var templates = r.templates || [];
            /* 배지 업데이트 */
            var badge = document.getElementById('dpt-ae-badge');
            if (badge) badge.textContent = totalAll + '명';
            /* 기간 정보 업데이트 */
            var periodInfo = document.getElementById('dpt-ae-period-info');
            if (periodInfo) {
              if (sinceDays > 0) {
                periodInfo.innerHTML = '<span style="color:#2563eb;font-weight:600">' + sinceDate + '</span> 이후 | <b>' + total + '</b>명 / 총 <b>' + totalAll + '</b>명';
              } else {
                periodInfo.innerHTML = '전체 기간 | 총 대상자 <span style="color:#1d4ed8;font-weight:700">' + totalAll + '</span>명';
              }
            }
            /* 대시보드 카드 카운트도 업데이트 */
            var dashAutoCount = document.getElementById('dpt-dash-auto-count');
            if (dashAutoCount) { var dasub = dashAutoCount.querySelector('span'); dashAutoCount.innerHTML = totalAll + (dasub ? dasub.outerHTML : '<span style="font-size:11px;color:#6b7280;font-weight:500">명</span>'); dashAutoCount.style.color = totalAll > 0 ? '#2563eb' : '#9ca3af'; }
            /* 템플릿 필터 드롭다운 업데이트 */
            var tplFilter = document.getElementById('dpt-ae-tpl-filter');
            if (tplFilter && templates.length > 0) {
              var curVal = tplFilter.value;
              tplFilter.innerHTML = '<option value="">전체 쿠폰 (' + totalAll + ')</option>';
              templates.forEach(function(t) {
                tplFilter.innerHTML += '<option value="' + t.id + '"' + (String(t.id) === curVal ? ' selected' : '') + '>' + escH(t.name) + ' (' + t.count + ')</option>';
              });
            }
            /* 리스트 렌더 */
            if (items.length === 0) {
              listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af">'
                + '<p style="font-size:13px;margin:0 0 6px">현재 발행 대상이 없습니다.</p>'
                + '<p style="font-size:11px;margin:0">모든 최초 발행 쿠폰이 전달되었거나,<br>해당 기간에 발행 쿠폰이 없습니다.</p></div>';
            } else {
              listEl.innerHTML = items.map(function(cp) {
                var regDate = cp.registered_date || '';
                var issuedDate = cp.issued_date || '';
                return '<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #bfdbfe;min-height:40px;gap:6px">'
                  + '<div style="flex:0 0 80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
                  + '<span style="font-size:12px;font-weight:600;color:#1f2937">' + escH(cp.patient_name) + '</span></div>'
                  + '<div style="flex:0 0 55px;text-align:right"><span style="font-size:11px;font-weight:600;color:#2563eb">' + F(cp.available_points) + 'P</span></div>'
                  + '<div style="flex:1;min-width:0;padding:0 6px">'
                  + '<span style="font-size:10px;color:#1e40af;font-weight:600">' + escH(cp.template_name) + '</span>'
                  + '<br><span style="font-size:9px;color:#9ca3af">' + issuedDate + ' 발행' + (regDate ? ' · ' + regDate + ' 등록' : '') + '</span></div>'
                  + '<div style="flex:0 0 auto;display:flex;gap:4px">'
                  + '<button class="dpt-ae-copy-btn" data-code="' + escH(cp.code) + '" data-name="' + escH(cp.patient_name) + '" data-tpl="' + escH(cp.template_name) + '" style="padding:4px 8px;border-radius:6px;border:1px solid #2563eb;background:#fff;color:#2563eb;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">링크복사</button>'
                  + '<button class="dpt-ae-send-btn" data-code="' + escH(cp.code) + '" data-name="' + escH(cp.patient_name) + '" data-tpl="' + escH(cp.template_name) + '" data-expires="' + (cp.expires_at || '') + '" style="padding:4px 8px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">전송</button>'
                  + '</div></div>';
              }).join('');
            }
            /* 페이저 렌더 */
            if (pagerEl && totalPages > 1) {
              var startIdx = (_aePage - 1) * _aeLimit + 1;
              var endIdx = Math.min(_aePage * _aeLimit, total);
              var pgHtml = '<span style="font-size:10px;color:#6b7280;margin-right:8px">' + startIdx + '~' + endIdx + ' / ' + total + '명</span>';
              var btnStyle = 'padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;min-width:32px';
              var activeStyle = 'padding:4px 10px;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;font-size:11px;cursor:default;font-family:inherit;min-width:32px;font-weight:600';
              if (_aePage > 1) pgHtml += '<button class="dpt-ae-pg" data-pg="1" style="' + btnStyle + '">«</button>';
              if (_aePage > 1) pgHtml += '<button class="dpt-ae-pg" data-pg="' + (_aePage - 1) + '" style="' + btnStyle + '">‹</button>';
              var startPg = Math.max(1, _aePage - 2);
              var endPg = Math.min(totalPages, _aePage + 2);
              for (var pg = startPg; pg <= endPg; pg++) {
                pgHtml += '<button class="dpt-ae-pg" data-pg="' + pg + '" style="' + (pg === _aePage ? activeStyle : btnStyle) + '">' + pg + '</button>';
              }
              if (_aePage < totalPages) pgHtml += '<button class="dpt-ae-pg" data-pg="' + (_aePage + 1) + '" style="' + btnStyle + '">›</button>';
              if (_aePage < totalPages) pgHtml += '<button class="dpt-ae-pg" data-pg="' + totalPages + '" style="' + btnStyle + '">»</button>';
              pagerEl.innerHTML = pgHtml;
              pagerEl.querySelectorAll('.dpt-ae-pg').forEach(function(b) {
                b.addEventListener('click', function() { loadAutoEligible(Number(b.getAttribute('data-pg'))); });
              });
            } else if (pagerEl) {
              pagerEl.innerHTML = '';
            }
            /* 링크복사/전송 버튼 바인딩 */
            bindAeCopyBtns();
            bindAeSendBtns();
          })
          .catch(function(e) { listEl.innerHTML = '<p style="text-align:center;padding:12px;color:#ef4444;font-size:12px">' + escH(e.message) + '</p>'; });
      }
      /* 링크복사 버튼: 클릭 시 쿠폰 링크 복사 + share API 호출 */
      function bindAeCopyBtns() {
        el.querySelectorAll('.dpt-ae-copy-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var code = btn.getAttribute('data-code');
            var pname = btn.getAttribute('data-name');
            var shareUrl = API + '/coupon/' + code;
            btn.disabled = true;
            btn.textContent = '처리중...';
            /* share API 호출 → shared_at 업데이트 후 클립보드 복사 */
            callAPI('/coupons/' + encodeURIComponent(code) + '/share', { method: 'POST' })
              .then(function() {
                markSharedCode(code);
                /* 클립보드 복사 */
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(shareUrl).catch(function() { fallbackCopy(shareUrl); });
                } else { fallbackCopy(shareUrl); }
                /* 링크복사 버튼 → 지급완료 */
                btn.textContent = '지급완료';
                btn.style.background = '#dcfce7'; btn.style.color = '#16a34a'; btn.style.borderColor = '#16a34a';
                btn.style.cursor = 'default';
                /* 전송 버튼 → 지급 */
                var sendBtn = btn.parentElement.querySelector('.dpt-ae-send-btn');
                if (sendBtn) {
                  sendBtn.textContent = '지급';
                  sendBtn.style.background = '#16a34a'; sendBtn.style.cursor = 'default'; sendBtn.disabled = true;
                }
                /* 행 fade out → 제거 */
                var row = btn.closest('div[style*="border-bottom"]');
                if (row) {
                  row.style.transition = 'opacity .4s ease, max-height .4s ease';
                  row.style.opacity = '0'; row.style.maxHeight = row.offsetHeight + 'px'; row.style.overflow = 'hidden';
                  setTimeout(function() { row.style.maxHeight = '0'; row.style.padding = '0 12px'; row.style.minHeight = '0'; }, 400);
                  setTimeout(function() { row.remove(); }, 800);
                }
                toast(escH(pname) + '님 쿠폰 링크가 복사되었습니다!');
                /* 발행대상 카운트 차감 (카드+배지+대시보드 일괄) */
                if (typeof window._dptAutoUpdateCount === 'function') window._dptAutoUpdateCount(-1);
                /* 미전송 카운트 차감 (카드만) */
                if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
                /* 미전송 섹션 배지 + 정보 텍스트 차감 */
                var udBadge3 = document.getElementById('dpt-ud-badge');
                if (udBadge3) { var ub3 = parseInt(udBadge3.textContent)||0; udBadge3.textContent = Math.max(0,ub3-1) + '건'; }
                var udInfo3 = document.getElementById('dpt-ud-info');
                if (udInfo3) { var sp3 = udInfo3.querySelector('span'); if (sp3) { var uv3 = parseInt(sp3.textContent)||0; sp3.textContent = Math.max(0,uv3-1); } }
                /* 대시보드 미전송 박스 차감 */
                var dashUndel3 = document.getElementById('dpt-dash-undel-box');
                if (dashUndel3) { var dn3 = dashUndel3.querySelector('p[style*="font-size:22px"]'); if (dn3) { var dc3=parseInt(dn3.textContent)||0; var dv3=Math.max(0,dc3-1); var ds3=dn3.querySelector('span'); dn3.innerHTML=dv3+(ds3?ds3.outerHTML:'<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">건</span>'); dn3.style.color=dv3>0?'#2563eb':'#9ca3af'; } }
              })
              .catch(function(e) {
                /* 실패 시 원래 상태 복원 */
                btn.disabled = false;
                btn.textContent = '링크복사';
                toast('전송 처리 실패: ' + e.message, 'error');
              });
          });
        });
      }
      /* 전송 버튼: QR+링크 모달 열기 */
      function bindAeSendBtns() {
        el.querySelectorAll('.dpt-ae-send-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var code = btn.getAttribute('data-code');
            var pname = btn.getAttribute('data-name');
            var tplName = btn.getAttribute('data-tpl');
            var expires = btn.getAttribute('data-expires');
            showIssuedCouponModal({ code: code, template_name: tplName, patient_name: pname, expires_at: expires }, null, function() {
              markSharedCode(code);
              /* 전송 완료 후 → 행 fade out 제거 */
              var row = btn.closest('div[style*="border-bottom"]');
              if (row) {
                row.style.transition = 'opacity .4s ease, max-height .4s ease';
                row.style.opacity = '0'; row.style.maxHeight = row.offsetHeight + 'px'; row.style.overflow = 'hidden';
                setTimeout(function() { row.style.maxHeight = '0'; row.style.padding = '0 12px'; row.style.minHeight = '0'; }, 400);
                setTimeout(function() { row.remove(); }, 800);
              }
              /* 발행대상 카운트 차감 (카드+배지+대시보드 일괄) */
              if (typeof window._dptAutoUpdateCount === 'function') window._dptAutoUpdateCount(-1);
              /* 미전송 카운트 차감 (카드만) */
              if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
              /* 미전송 섹션 배지 + 정보 텍스트 + 대시보드 차감 */
              var udBadge4 = document.getElementById('dpt-ud-badge');
              if (udBadge4) { var ub4 = parseInt(udBadge4.textContent)||0; udBadge4.textContent = Math.max(0,ub4-1) + '건'; }
              var udInfo4 = document.getElementById('dpt-ud-info');
              if (udInfo4) { var sp4 = udInfo4.querySelector('span'); if (sp4) { var uv4 = parseInt(sp4.textContent)||0; sp4.textContent = Math.max(0,uv4-1); } }
              var dashUndel4 = document.getElementById('dpt-dash-undel-box');
              if (dashUndel4) { var dn4 = dashUndel4.querySelector('p[style*="font-size:22px"]'); if (dn4) { var dc4=parseInt(dn4.textContent)||0; var dv4=Math.max(0,dc4-1); var ds4=dn4.querySelector('span'); dn4.innerHTML=dv4+(ds4?ds4.outerHTML:'<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">건</span>'); dn4.style.color=dv4>0?'#2563eb':'#9ca3af'; } }
            });
          });
        });
      }
      /* 초기 로딩 */
      if (autoFilter === 'auto_eligible' || autoEligibleTotal > 0) {
        loadAutoEligible(1);
      }
      /* 기간 선택 드롭다운 이벤트 */
      var periodSel = document.getElementById('dpt-ae-period');
      if (periodSel) {
        periodSel.addEventListener('change', function() {
          _aeSinceDays = Number(this.value);
          loadAutoEligible(1);
        });
      }
      /* 템플릿 필터 드롭다운 이벤트 */
      var aeTplFilterSel = document.getElementById('dpt-ae-tpl-filter');
      if (aeTplFilterSel) {
        aeTplFilterSel.addEventListener('change', function() {
          _aeTplFilter = this.value;
          loadAutoEligible(1);
        });
      }

      /* ====== 미전송 쿠폰 페이지네이션 ====== */
      var _udPage = 1;
      var _udLimit = 20;
      var _udTplFilter = '';
      function loadUndelivered(page) {
        _udPage = page || 1;
        var listEl = document.getElementById('dpt-ud-list');
        var pagerEl = document.getElementById('dpt-ud-pager');
        if (!listEl) return;
        listEl.innerHTML = '<p style="text-align:center;padding:12px;color:#9ca3af;font-size:12px">로딩 중...</p>';
        var url = '/coupons/undelivered?clinic_id=' + CID() + '&page=' + _udPage + '&limit=' + _udLimit;
        if (_udTplFilter) url += '&template_id=' + _udTplFilter;
        callAPI(url)
          .then(function(r) {
            var rawUdItems = r.coupons || r.patients || [];
            /* 세션 캐시에서 이미 share된 쿠폰 필터링 */
            var items = rawUdItems.filter(function(c) { return !isSharedCode(c.code); });
            var udSharedDiff = rawUdItems.length - items.length;
            var total = Math.max(0, (r.total || 0) - udSharedDiff);
            var totalAll = Math.max(0, (r.total_all || total) - udSharedDiff);
            var totalPages = r.total_pages || 0;
            var templates = r.templates || [];
            /* 배지 업데이트 */
            var badge = document.getElementById('dpt-ud-badge');
            if (badge) badge.textContent = total + '건';
            /* 미전송 카드 큰 숫자 업데이트 */
            var udCard = document.getElementById('dpt-cpn-undel-card');
            if (udCard) { var udns = udCard.querySelector('span[style*="font-size:18px"]'); if (udns) { var udsub = udns.querySelector('span'); udns.innerHTML = totalAll + (udsub ? udsub.outerHTML : '<span style="font-size:11px;color:#6b7280;font-weight:500">건</span>'); udns.style.color = totalAll > 0 ? '#2563eb' : '#9ca3af'; } }
            /* 정보 업데이트 */
            var info = document.getElementById('dpt-ud-info');
            if (info) {
              info.innerHTML = '발행됨 · 전송 대기 중 | 전체 <span style="color:#1d4ed8;font-weight:700">' + totalAll + '</span>건';
            }
            /* 템플릿 필터 드롭다운 업데이트 (최초 로딩 시만) */
            if (_udPage === 1 && templates.length > 0) {
              var tplSel = document.getElementById('dpt-ud-tpl-filter');
              if (tplSel && tplSel.options.length <= 1) {
                templates.forEach(function(t) {
                  var opt = document.createElement('option');
                  opt.value = t.id;
                  opt.textContent = t.name + ' (' + t.count + ')';
                  tplSel.appendChild(opt);
                });
              }
            }
            /* 리스트 렌더 */
            if (items.length === 0) {
              listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af">'
                + '<p style="font-size:13px;margin:0 0 6px">미전송 쿠폰이 없습니다.</p>'
                + '<p style="font-size:11px;margin:0">모든 쿠폰이 전송 완료되었습니다.</p></div>';
            } else {
              listEl.innerHTML = items.map(function(c) {
                return '<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #bfdbfe;min-height:36px;gap:6px">'
                  + '<div style="flex:0 0 80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
                  + '<span style="font-size:12px;font-weight:600;color:#1f2937">' + escH(c.patient_name) + '</span></div>'
                  + '<div style="flex:0 0 55px;text-align:right"><span style="font-size:11px;font-weight:600;color:#2563eb">' + F(c.available_points) + 'P</span></div>'
                  + '<div style="flex:1;min-width:0;padding:0 4px"><span style="font-size:10px;color:#1e40af">' + escH(c.template_name) + '</span>'
                  + '<br><span style="font-size:9px;color:#9ca3af">' + (c.issued_date || '') + ' 발행</span></div>'
                  + '<div style="flex:0 0 auto;display:flex;gap:4px">'
                  + '<button class="dpt-ud-copy" data-code="' + escH(c.code) + '" data-tname="' + escH(c.template_name) + '" data-pname="' + escH(c.patient_name) + '" style="padding:4px 8px;border-radius:6px;border:1px solid #2563eb;background:#fff;color:#2563eb;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">링크복사</button>'
                  + '<button class="dpt-ud-share" data-code="' + escH(c.code) + '" data-tname="' + escH(c.template_name) + '" data-pname="' + escH(c.patient_name) + '" data-expires="' + escH(c.expires_at || '') + '" style="padding:4px 8px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">전송</button>'
                  + '</div></div>';
              }).join('');
            }
            /* 페이저 렌더 */
            if (pagerEl && totalPages > 1) {
              var startIdx = (_udPage - 1) * _udLimit + 1;
              var endIdx = Math.min(_udPage * _udLimit, total);
              var pgHtml = '<span style="font-size:10px;color:#6b7280;margin-right:8px">' + startIdx + '~' + endIdx + ' / ' + total + '건</span>';
              var btnStyle = 'padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;min-width:32px';
              var activeStyle = 'padding:4px 10px;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;font-size:11px;cursor:default;font-family:inherit;min-width:32px;font-weight:600';
              if (_udPage > 1) pgHtml += '<button class="dpt-ud-pg" data-pg="1" style="' + btnStyle + '">«</button>';
              if (_udPage > 1) pgHtml += '<button class="dpt-ud-pg" data-pg="' + (_udPage - 1) + '" style="' + btnStyle + '">‹</button>';
              var startPg = Math.max(1, _udPage - 2);
              var endPg = Math.min(totalPages, _udPage + 2);
              for (var pg = startPg; pg <= endPg; pg++) {
                pgHtml += '<button class="dpt-ud-pg" data-pg="' + pg + '" style="' + (pg === _udPage ? activeStyle : btnStyle) + '">' + pg + '</button>';
              }
              if (_udPage < totalPages) pgHtml += '<button class="dpt-ud-pg" data-pg="' + (_udPage + 1) + '" style="' + btnStyle + '">›</button>';
              if (_udPage < totalPages) pgHtml += '<button class="dpt-ud-pg" data-pg="' + totalPages + '" style="' + btnStyle + '">»</button>';
              pagerEl.innerHTML = pgHtml;
              pagerEl.querySelectorAll('.dpt-ud-pg').forEach(function(b) {
                b.addEventListener('click', function() { loadUndelivered(Number(b.getAttribute('data-pg'))); });
              });
            } else if (pagerEl) {
              pagerEl.innerHTML = '';
            }
            /* 링크복사 바인딩 */
            listEl.querySelectorAll('.dpt-ud-copy').forEach(function(btn) {
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var code = btn.getAttribute('data-code');
                var pname = btn.getAttribute('data-pname') || '';
                var shareUrl = API + '/coupon/' + code;
                btn.disabled = true;
                btn.textContent = '처리중...';
                /* share API 호출 → shared_at 업데이트 후 클립보드 복사 */
                callAPI('/coupons/' + encodeURIComponent(code) + '/share', { method: 'POST' })
                  .then(function() {
                    markSharedCode(code);
                    /* 클립보드 복사 */
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(shareUrl).catch(function() { fallbackCopy(shareUrl); });
                    } else { fallbackCopy(shareUrl); }
                    /* 행 fade out → 제거 */
                    var row = btn.closest('div[style*="border-bottom"]');
                    if (row) {
                      row.style.transition = 'opacity .4s ease, max-height .4s ease';
                      row.style.opacity = '0'; row.style.maxHeight = row.offsetHeight + 'px'; row.style.overflow = 'hidden';
                      setTimeout(function() { row.style.maxHeight = '0'; row.style.padding = '0 12px'; row.style.minHeight = '0'; }, 400);
                      setTimeout(function() { row.remove(); }, 800);
                    }
                    toast(pname ? escH(pname) + '님 쿠폰 링크가 복사되었습니다!' : '링크가 복사되었습니다!');
                    if (window._dptCpnUpdateUndelCount) window._dptCpnUpdateUndelCount(-1);
                    /* 미전송 섹션 배지 + 정보 텍스트 차감 */
                    var udBadge = document.getElementById('dpt-ud-badge');
                    if (udBadge) { var ub = parseInt(udBadge.textContent)||0; udBadge.textContent = Math.max(0,ub-1) + '건'; }
                    var udInfo = document.getElementById('dpt-ud-info');
                    if (udInfo) { var sp = udInfo.querySelector('span'); if (sp) { var uv = parseInt(sp.textContent)||0; sp.textContent = Math.max(0,uv-1); } }
                    /* 대시보드 미전송 박스도 차감 */
                    var dashUndel = document.getElementById('dpt-dash-undel-box');
                    if (dashUndel) { var dn = dashUndel.querySelector('p[style*="font-size:22px"]'); if (dn) { var dc=parseInt(dn.textContent)||0; var dv=Math.max(0,dc-1); var ds=dn.querySelector('span'); dn.innerHTML=dv+(ds?ds.outerHTML:'<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">건</span>'); dn.style.color=dv>0?'#2563eb':'#9ca3af'; } }
                    /* 대시보드 발행대상 박스도 차감 */
                    if (typeof window._dptAutoUpdateCount === 'function') window._dptAutoUpdateCount(-1);
                  })
                  .catch(function(e) {
                    /* 실패 시 원래 상태 복원 */
                    btn.disabled = false;
                    btn.textContent = '링크복사';
                    toast('전송 처리 실패: ' + e.message, 'error');
                  });
              });
            });
            /* 전송 버튼(모달) 바인딩 */
            listEl.querySelectorAll('.dpt-ud-share').forEach(function(btn) {
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
                showIssuedCouponModal({
                  code: btn.getAttribute('data-code'),
                  template_name: btn.getAttribute('data-tname'),
                  patient_name: btn.getAttribute('data-pname'),
                  expires_at: btn.getAttribute('data-expires')
                }, null, function() {
                  var udCode = btn.getAttribute('data-code');
                  markSharedCode(udCode);
                  /* 전송 완료 → 행 fade out 제거 */
                  var row = btn.closest('div[style*="border-bottom"]');
                  if (row) {
                    row.style.transition = 'opacity .4s ease, max-height .4s ease';
                    row.style.opacity = '0'; row.style.maxHeight = row.offsetHeight + 'px'; row.style.overflow = 'hidden';
                    setTimeout(function() { row.style.maxHeight = '0'; row.style.padding = '0 12px'; row.style.minHeight = '0'; }, 400);
                    setTimeout(function() { row.remove(); }, 800);
                  }
                  if (window._dptCpnUpdateUndelCount) window._dptCpnUpdateUndelCount(-1);
                  /* 미전송 섹션 배지 + 정보 텍스트 차감 */
                  var udBadge2 = document.getElementById('dpt-ud-badge');
                  if (udBadge2) { var ub2 = parseInt(udBadge2.textContent)||0; udBadge2.textContent = Math.max(0,ub2-1) + '건'; }
                  var udInfo2 = document.getElementById('dpt-ud-info');
                  if (udInfo2) { var sp2 = udInfo2.querySelector('span'); if (sp2) { var uv2 = parseInt(sp2.textContent)||0; sp2.textContent = Math.max(0,uv2-1); } }
                  /* 대시보드 미전송 박스도 차감 */
                  var dashUndel2 = document.getElementById('dpt-dash-undel-box');
                  if (dashUndel2) { var dn2 = dashUndel2.querySelector('p[style*="font-size:22px"]'); if (dn2) { var dc2=parseInt(dn2.textContent)||0; var dv2=Math.max(0,dc2-1); var ds2=dn2.querySelector('span'); dn2.innerHTML=dv2+(ds2?ds2.outerHTML:'<span style="font-size:13px;font-weight:500;color:#6b7280;margin-left:2px">건</span>'); dn2.style.color=dv2>0?'#2563eb':'#9ca3af'; } }
                  if (typeof window._dptAutoUpdateCount === 'function') window._dptAutoUpdateCount(-1);
                });
              });
            });
          })
          .catch(function(e) { listEl.innerHTML = '<p style="text-align:center;padding:12px;color:#ef4444;font-size:12px">' + escH(e.message) + '</p>'; });
      }
      /* 미전송 초기 로딩 */
      if (autoFilter === 'unshared' || undeliveredTotal > 0) {
        loadUndelivered(1);
      }
      /* 미전송 템플릿 필터 이벤트 */
      var udTplSel = document.getElementById('dpt-ud-tpl-filter');
      if (udTplSel) {
        udTplSel.addEventListener('change', function() {
          _udTplFilter = this.value;
          loadUndelivered(1);
        });
      }

      var shares = el.querySelectorAll('.dpt-cpn-share');
      for(var i=0; i<shares.length; i++) {
        shares[i].addEventListener('click', function(e) {
          var btn = e.target.closest('.dpt-cpn-share') || e.target;
          var ds = btn.dataset;
          var code = ds.code;
          showIssuedCouponModal({
            code: code,
            template_name: ds.tname,
            patient_name: ds.pname,
            discount_type: ds.dtype,
            discount_value: ds.dval,
            expires_at: ds.expires
          }, null, function() {
            /* 링크 복사 완료 콜백 → 상태 '전송'으로 변경 */
            markSharedCode(code);
            dlog('share 링크복사 완료(쿠폰관리): code=' + code);
            /* 상태 배지 업데이트 */
            var badge = el.querySelector('.dpt-cpn-status-badge[data-code="' + code + '"]');
            if (badge) {
              badge.innerHTML = '전송';
              badge.className = 'dpt-cpn-status-badge';
              badge.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:#d1fae5;color:#059669';
            }
            /* 행 data 속성 업데이트 */
            var row = btn.closest('.dpt-cpn-row');
            if (row) {
              row.setAttribute('data-shared', '1');
              row.setAttribute('data-unshared', '0');
              row.setAttribute('data-unused', '1');
              row.setAttribute('data-display-status', 'shared');
              /* 미전송 라벨 제거 */
              var unsent = row.querySelector('.dpt-unsent-label');
              if (unsent && unsent.textContent.indexOf('미전송') >= 0) unsent.remove();
            }
            toast('쿠폰 링크가 전송 처리되었습니다.');
            /* 필터 재적용 + 미전송 카운트 차감 */
            if (typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
            if (typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
          });
        });
      }
      var revokes = el.querySelectorAll('.dpt-cpn-revoke');
      for(var i=0; i<revokes.length; i++) {
        revokes[i].addEventListener('click', function(e) {
          var ds = e.target.dataset;
          showConfirmModal('회수 확인', ds.pname + '님의 [' + ds.tname + '] 쿠폰을 회수하시겠습니까?', function() {
            e.target.disabled = true; e.target.textContent = '...';
            callAPI('/coupons/' + ds.code + '/revoke', { method: 'POST' }).then(function() {
              toast('쿠폰이 회수되었습니다.');
              /* 행 DOM 업데이트: 상태를 '회수'로 변경 */
              var revokeRow = e.target.closest('.dpt-cpn-row');
              var wasUnshared = revokeRow && revokeRow.getAttribute('data-unshared') === '1';
              if (revokeRow) {
                revokeRow.setAttribute('data-status', 'revoked');
                revokeRow.setAttribute('data-display-status', 'revoked');
                revokeRow.setAttribute('data-unshared', '0');
                revokeRow.setAttribute('data-shared', '0');
                var rvBadge = revokeRow.querySelector('.dpt-cpn-status-badge');
                if (rvBadge) { rvBadge.innerHTML = '회수'; rvBadge.className = 'dpt-cpn-status-badge'; rvBadge.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:#fef3c7;color:#d97706'; }
                /* 관리 버튼 업데이트: 공유/회수 제거, 삭제만 남김 */
                var mgmtTd = revokeRow.querySelector('td:last-child');
                if (mgmtTd) {
                  var cid2 = revokeRow.querySelector('.dpt-del-coupon-direct');
                  var delCid = cid2 ? cid2.dataset.cid : '';
                  mgmtTd.innerHTML = '<button class="dpt-del-coupon-direct" data-cid="' + delCid + '" data-cname="' + escH(ds.tname||'') + '" style="padding:4px 10px;border-radius:6px;border:none;background:#f3f4f6;color:#6b7280;font-size:11px;font-weight:500;cursor:pointer;font-family:inherit;">삭제</button>';
                }
              /* 미전송 라벨 제거 */
                var unsent2 = revokeRow.querySelector('.dpt-unsent-label');
                if (unsent2 && unsent2.textContent.indexOf('미전송') >= 0) unsent2.remove();
              }
              if (typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
              if (wasUnshared && typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
            }).catch(function(err) { toast(err.message, 'error'); e.target.disabled = false; e.target.textContent = '회수'; });
          });
        });
      }
      var deletes = el.querySelectorAll('.dpt-del-coupon-direct');
      for(var i=0; i<deletes.length; i++) {
        deletes[i].addEventListener('click', function(e) {
          var ds = e.target.dataset;
          showConfirmModal('삭제 확인', '[' + ds.cname + '] 쿠폰 기록을 완전히 삭제하시겠습니까? (복구 불가)', function() {
            e.target.disabled = true; e.target.textContent = '...';
            /* 삭제 전에 미전송 여부 기록 */
            var delRow = e.target.closest('.dpt-cpn-row');
            var wasUnsharedDel = delRow && delRow.getAttribute('data-unshared') === '1';
            callAPI('/coupons/' + ds.cid, { method: 'DELETE' }).then(function() {
              toast('삭제되었습니다.');
              /* 행 DOM에서 제거 */
              if (delRow) delRow.remove();
              if (typeof window._dptCpnDoSearch === 'function') window._dptCpnDoSearch();
              if (wasUnsharedDel && typeof window._dptCpnUpdateUndelCount === 'function') window._dptCpnUpdateUndelCount(-1);
            }).catch(function(err) { toast(err.message, 'error'); e.target.disabled = false; e.target.textContent = '삭제'; });
          });
        });
      }
      /* 쿠폰 관리 테이블 환자 이름 클릭 → 환자관리 페이지 이동 */
      /* 코드 복사 아이콘 클릭 */
      var codeCopies = el.querySelectorAll('.dpt-copy-code');
      for(var i=0; i<codeCopies.length; i++) {
        codeCopies[i].addEventListener('click', function(e) {
          var svg = e.target.closest('.dpt-copy-code');
          if (!svg) return;
          var code = svg.getAttribute('data-code');
          if (!code) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(function() { toast('코드 복사됨: ' + code); }).catch(function() { fallbackCopy(code); toast('코드 복사됨: ' + code); });
          } else { fallbackCopy(code); toast('코드 복사됨: ' + code); }
          svg.style.stroke = '#10b981';
          setTimeout(function() { svg.style.stroke = '#9ca3af'; }, 1000);
        });
      }
      var patLinks = el.querySelectorAll('.dpt-cpn-pat-link');
      for(var i=0; i<patLinks.length; i++) {
        patLinks[i].addEventListener('click', function(e) {
          var patientName = e.target.getAttribute('data-name') || '';
          globalPatQ = patientName;
          if (typeof window !== 'undefined') window._dpt_global_q = patientName;
          currentPage = 'patients';
          renderPage();
          setTimeout(function() {
            var qInput = document.getElementById('dpt-pat-q');
            var qBtn = document.getElementById('dpt-pat-search');
            if (qInput) qInput.value = patientName;
            if (qBtn) qBtn.click();
          }, 200);
        });
      }
    }).catch(function(e) { el.innerHTML = '<p style="padding:20px;color:#ef4444">' + e.message + '</p>'; });
  }

  /* --- 대량업로드 --- */
  function pgBulk(el) {
    el.innerHTML = '<div><div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">대량 업로드</div>'
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
      + '<p style="font-size:13px;color:#6b7280;margin:0 0 12px">Excel 파일로 여러 환자의 결제 내역을 한 번에 등록합니다.</p>'
      + '<button id="dpt-bulk-tmpl" style="padding:8px 16px;border-radius:8px;border:1px solid #2563eb;background:#fff;color:#2563eb;font-size:13px;cursor:pointer;font-family:inherit;margin-bottom:12px">템플릿 다운로드</button>'
      + '<div id="dpt-bulk-drop" style="border:2px dashed #d1d5db;border-radius:8px;padding:30px;text-align:center;cursor:pointer">'
      + '<p style="font-size:14px;color:#9ca3af;margin:0">파일을 드래그하거나 클릭하여 업로드</p>'
      + '<input id="dpt-bulk-file" type="file" accept=".xlsx,.xls,.csv" style="display:none"/></div>'
      + '<div id="dpt-bulk-result" style="margin-top:12px"></div></div></div>';
    document.getElementById('dpt-bulk-tmpl').addEventListener('click', function() {
      if (typeof XLSX === 'undefined') { toast('XLSX 라이브러리 로딩 중...'); return; }
      var wb = XLSX.utils.book_new();
      var today = new Date().toISOString().split('T')[0];
      var ws = XLSX.utils.aoa_to_sheet([
        ['차트번호','이름','생년월일','연락처','진료내용','결제금액','결제일자'],
        ['C-2024-0001','홍길동','1985-03-15','010-1234-5678','임플란트','500000', today],
        ['C-2024-0002','김철수','1990-07-22','010-2222-3333','일반진료','150000', today]
      ]);
      // 컬럼 너비 설정
      ws['!cols'] = [{wch:14},{wch:10},{wch:12},{wch:14},{wch:12},{wch:10},{wch:12}];
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, 'patient_template.xlsx');
    });
    var drop = document.getElementById('dpt-bulk-drop');
    drop.addEventListener('click', function() { document.getElementById('dpt-bulk-file').click(); });
    drop.addEventListener('dragover', function(e) { e.preventDefault(); drop.style.borderColor = '#2563eb'; });
    drop.addEventListener('dragleave', function() { drop.style.borderColor = '#d1d5db'; });
    drop.addEventListener('drop', function(e) { e.preventDefault(); drop.style.borderColor = '#d1d5db'; if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); });
    document.getElementById('dpt-bulk-file').addEventListener('change', function() { if (this.files[0]) processFile(this.files[0]); });
    function processFile(file) {
      // Allow dynamic check since script might be still loading
      if (typeof window.XLSX === 'undefined') { 
        toast('엑셀 처리 모듈을 준비 중입니다. 1~2초 후 다시 시도해주세요.', 'warning');
        if (!document.getElementById('dpt-xlsx-script')) {
          var script = document.createElement('script');
          script.id = 'dpt-xlsx-script';
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          document.head.appendChild(script);
        }
        return; 
      }
      var drop = document.getElementById('dpt-bulk-drop');
      if(drop) drop.innerHTML = '<div style="padding:20px;text-align:center"><div style="width:24px;height:24px;border:3px solid #3b82f6;border-top-color:transparent;border-radius:50%;margin:0 auto 10px;animation:spin 1s linear infinite"></div><p style="color:#2563eb;font-size:13px;font-weight:600;margin:0">파일 분석 중...</p></div>';

      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var wb = window.XLSX.read(e.target.result, { type: 'array' });
          var rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          // 첫 번째 행은 헤더이므로 slice(1). 빈 이름(r[1])이 아닌 것만 필터링
          var dataRows = rows.slice(1).filter(function(r) { return r && r[1] && String(r[1]).trim() !== ''; });
          
          if(dataRows.length === 0) {
             toast('업로드할 유효한 환자 데이터(이름)가 없습니다.', 'error');
             if(drop) drop.innerHTML = '<p style="font-size:14px;color:#9ca3af;margin:0">파일을 다시 드래그하거나 클릭하여 업로드</p><input id="dpt-bulk-file" type="file" accept=".xlsx,.xls,.csv" style="display:none"/>';
             return;
          }

          var parsed = dataRows.map(function(r) {
            // Excel 날짜 숫자 변환 로직 추가
            var bDate = String(r[2]||'').trim();
            if (typeof r[2] === 'number') {
              var d = new Date((r[2] - 25569) * 86400000);
              bDate = d.toISOString().split('T')[0];
            }
            
            var pDate = String(r[6]||'').trim();
            if (typeof r[6] === 'number') {
              var d = new Date((r[6] - 25569) * 86400000);
              pDate = d.toISOString().split('T')[0];
            } else if (!pDate) {
              pDate = new Date().toISOString().split('T')[0];
            }

            return {
              chart_number: String(r[0]||'').trim(),
              name: String(r[1]||'').trim(),
              birth_date: bDate,
              phone: String(r[3]||'').trim(),
              treatment: String(r[4]||'일반진료').trim(),
              payment_amount: parseInt(String(r[5]||'0').replace(/,/g,''))||0,
              payment_date: pDate
            };
          });
          
          // Restore the dropzone UI after analyzing
          if(drop) drop.innerHTML = '<p style="font-size:14px;color:#9ca3af;margin:0">파일을 드래그하거나 클릭하여 업로드</p><input id="dpt-bulk-file" type="file" accept=".xlsx,.xls,.csv" style="display:none"/>';
          
          
          var tableHtml = '<div style="margin-top:10px;margin-bottom:12px;overflow-x:auto;max-height:200px;border:1px solid #e5e7eb;border-radius:6px">'
            + '<table style="width:100%;border-collapse:collapse;min-width:400px;font-size:12px;text-align:left">'
            + '<thead style="position:sticky;top:0;background:#f9fafb;color:#4b5563;box-shadow:0 1px 0 #e5e7eb"><tr>'
            + '<th style="padding:8px 10px;font-weight:600">이름</th>'
            + '<th style="padding:8px 10px;font-weight:600">진료과목</th>'
            + '<th style="padding:8px 10px;font-weight:600;text-align:right">결제금액</th>'
            + '</tr></thead><tbody>';
          
          parsed.slice(0, 30).forEach(function(r) {
            tableHtml += '<tr>'
              + '<td style="padding:8px 10px;border-bottom:1px solid #d1d5db">' + r.name + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid #d1d5db;color:#2563eb;font-weight:500">' + (r.treatment || '-') + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid #d1d5db;text-align:right">' + (r.payment_amount ? r.payment_amount.toLocaleString()+'원' : '-') + '</td>'
              + '</tr>';
          });
          if(parsed.length > 30) {
            tableHtml += '<tr><td colspan="3" style="padding:8px 10px;text-align:center;color:#9ca3af;background:#f9fafb">...외 ' + (parsed.length - 30) + '건 생략됨</td></tr>';
          }
          tableHtml += '</tbody></table></div>';

          document.getElementById('dpt-bulk-result').innerHTML = '<p style="font-size:13px;color:#1f2937;margin-bottom:8px"><strong>' + parsed.length + '건</strong> 데이터가 준비되었습니다.</p>' + tableHtml + '<button id="dpt-bulk-upload" style="padding:10px 20px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;width:100%">정상 ' + parsed.length + '건 업로드 시작</button>';
          document.getElementById('dpt-bulk-upload').addEventListener('click', function() {
            var btn = this;
            btn.textContent = '업로드 시작 중...';
            btn.disabled = true;
            
            var chunkSize = 500;
            var chunks = [];
            for (var i = 0; i < parsed.length; i += chunkSize) {
              chunks.push(parsed.slice(i, i + chunkSize));
            }
            
            var totalSuccess = 0;
            var totalError = 0;
            var c = 0;
            
            function uploadNextChunk() {
                if (c >= chunks.length) {
                    toast('업로드 완료! (성공: ' + totalSuccess + '건, 실패/중복: ' + totalError + '건)');
                    document.getElementById('dpt-bulk-result').innerHTML = '';
                    if (typeof window._dptLoadPat === 'function') window._dptLoadPat(currentQ, 1);
                    return;
                }
                var startProcessed = c * chunkSize;
                var currentProcessed = Math.min((c + 1) * chunkSize, parsed.length);
                
                var displayCount = startProcessed;
                var setBtnText = function(txt, num) {
                    btn.innerHTML = '<span style="display:inline-block; min-width:180px; text-align:center; font-variant-numeric:tabular-nums;">' + txt + ' (' + num + ' / ' + parsed.length + ')</span>';
                };
                
                setBtnText('데이터 전송 준비', displayCount);
                
                var interval = setInterval(function() {
                    if (displayCount < currentProcessed - 5) {
                        displayCount += Math.floor(Math.random() * 15) + 5;
                        if (displayCount >= currentProcessed) displayCount = currentProcessed - 1;
                        setBtnText('데이터 전송 중', displayCount);
                    } else {
                        setBtnText('데이터 저장 중', currentProcessed);
                    }
                }, 80);
                
                callAPI('/payments/bulk', { method: 'POST', body: JSON.stringify({ clinic_id: CID(), rows: chunks[c] }) })
                .then(function(res) {
                    clearInterval(interval);
                    setBtnText('저장 완료', currentProcessed);
                    totalSuccess += (res.success_count || 0);
                    totalError += (res.error_count || 0);
                    c++;
                    setTimeout(uploadNextChunk, 10);
                })
                .catch(function(e) {
                    clearInterval(interval);
                    toast('오류: ' + e.message, 'error');
                    btn.textContent = '업로드 실패. 다시 시도';
                    btn.disabled = false;
                });
            }
            
            uploadNextChunk();
          });
        } catch(e) { toast('파일 파싱 오류: ' + e.message, 'error'); }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  /* --- DentWeb --- */
  function pgDentweb(el) {
    el.innerHTML = SPIN_HTML;
    var syncP = callAPI('/sync/status?clinic_id=' + CID()).catch(function() { return {}; });
    var setupP = callAPI('/setup/active?clinic_id=' + CID()).catch(function() { return { active: false }; });
    Promise.all([syncP, setupP]).then(function(results) {
      var data = results[0] || {}; var setupData = results[1] || {};
      var logs = data.sync_logs || []; var lastSync = data.last_sync; var dwPatients = data.dentweb_patients || 0;
      var activeCode = setupData.active ? setupData.code : '';
      var codeExpSec = setupData.remaining_seconds || 0;
      var totalSyncs = logs.length;
      var recentLogs = logs.slice(0, 10);

      el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'
        /* 헤더 */
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<span style="font-size:18px;font-weight:700;color:#1f2937">DentWeb 연동</span>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<button id="dpt-dw-refresh" style="padding:6px 12px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;color:#6b7280;font-size:11px;cursor:pointer;font-family:inherit">새로고침</button>'
        + '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:600;' + (lastSync ? 'background:#dcfce7;color:#16a34a' : 'background:#f3f4f6;color:#9ca3af') + '">'
        + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;' + (lastSync ? 'background:#16a34a' : 'background:#d1d5db') + '"></span>'
        + (lastSync ? '연동됨' : '미연결') + '</span></div></div>'

        /* 상태 카드 그리드 */
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
          /* 연동 코드 셀 */
          + '<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #e5e7eb">'
            + '<p style="font-size:10px;color:#9ca3af;margin:0 0 4px">연동 코드</p>'
            + '<div id="dpt-dw-code-area">'
              + (activeCode
                ? '<div style="display:flex;align-items:center;gap:4px"><span id="dpt-code-display" style="font-family:monospace;font-weight:700;font-size:15px;color:#4f46e5;letter-spacing:2px">' + activeCode + '</span><button id="dpt-copy-code" style="border:none;background:none;cursor:pointer;color:#9ca3af;padding:2px;font-size:12px" title="복사"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div><p style="font-size:9px;color:#9ca3af;margin:2px 0 0" id="dpt-code-timer">' + Math.floor(codeExpSec / 60) + ':' + String(codeExpSec % 60).padStart(2, '0') + ' 남음</p>'
                : '<button id="dpt-gen-code" style="font-size:11px;padding:5px 10px;border-radius:6px;border:none;background:#4f46e5;color:#fff;cursor:pointer;font-family:inherit;font-weight:500;margin-top:2px">코드 생성</button>')
            + '</div>'
          + '</div>'
          + cardH('연동 환자', F(dwPatients) + '명', '', '#2563eb')
          + cardH('마지막 동기화', (lastSync ? lastSync.created_at.replace('T', ' ').substring(11, 16) : '—'), '', '#1f2937')
          + cardH('동기화 횟수', totalSyncs + '회', '', '#1f2937')
        + '</div>'

        /* 연동 가이드 (접이식) */
        + '<details style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:10px" open>'
          + '<summary style="padding:12px 14px;font-size:13px;font-weight:600;color:#1f2937;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#9ca3af">▼</span> 연동 가이드 (4단계)</summary>'
          + '<div style="padding:0 14px 14px;font-size:12px;display:flex;flex-direction:column;gap:12px;">'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb">1</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">브릿지 프로그램 다운로드</p><p style="color:#6b7280;margin:4px 0 0;font-size:11px">실제 DentWeb 메인/서버 PC에서 아래 버튼을 눌러 다운로드하세요.</p><a href="/static/DentWebBridge.zip" download="DentWebBridge.zip" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:8px 14px;background:#4f46e5;color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.1)">DentWebBridge.zip 다운로드</a><p style="color:#9ca3af;margin:6px 0 0;font-size:10px">파이썬(Python) 자동 설치 기능이 포함되어 있습니다.</p></div></div>'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb">2</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">연동 코드 생성</p><p style="color:#6b7280;margin:4px 0 0;font-size:11px">위쪽의 <strong>[코드 생성]</strong> 버튼을 클릭하여 6자리 코드를 발급받으세요. (30분간 유효)</p></div></div>'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb">3</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">압축 해제 및 프로그램 실행</p><div style="margin-top:6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 다운로드 받은 <code style="background:#fff;padding:1px 4px;border:1px solid #e5e7eb;border-radius:3px">DentWebBridge.zip</code> 파일의 <strong>압축을 풉니다.</strong></p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 폴더 안의 <code style="background:#fff;padding:1px 4px;border:1px solid #e5e7eb;border-radius:3px;font-weight:bold;color:#2563eb">DentWebBridge.bat</code> 파일을 <strong>더블클릭</strong>하여 실행합니다.</p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#4b5563;line-height:1.4">- 까만 DOS 창이 뜨고 컴퓨터에 파이썬이 없다면 <strong>약 1~2분간 자동 설치가 진행</strong>됩니다. (창을 끄지 마세요)</p></div></div></div></div>'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#16a34a">4</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">연동 코드 입력 및 동기화 시작</p><div style="margin-top:6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 설치가 완료되면 DOS 창에 <strong>"6자리 연동 코드를 입력하세요:"</strong> 문구가 나옵니다.</p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 2번에서 발급받은 <strong>연동 코드 6자리를 키보드로 입력하고 엔터</strong>를 누르세요.</p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- "연동 성공!" 메시지가 뜨면 <strong>5분 간격으로 자동으로 동기화</strong>됩니다.</p></div></div></div></div>'
            
          + '</div>'
        + '</details>'

        /* 동기화 로그 (접이식) */
        + '<details style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:10px">'
          + '<summary style="padding:12px 14px;font-size:13px;font-weight:600;color:#1f2937;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#9ca3af">▶</span> 동기화 이력</div><span style="font-size:11px;color:#9ca3af;font-weight:400">' + recentLogs.length + '건</span></summary>'
          + '<div style="padding:0 4px 8px">'
          + (recentLogs.length === 0 ? '<p style="padding:16px;text-align:center;color:#9ca3af;font-size:12px">아직 기록 없음</p>'
          : '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f9fafb"><th style="text-align:left;padding:6px 8px;font-weight:600;color:#6b7280">시간</th><th style="text-align:left;padding:6px 8px;font-weight:600;color:#6b7280">유형</th><th style="text-align:center;padding:6px 8px;font-weight:600;color:#6b7280">전체</th><th style="text-align:center;padding:6px 8px;font-weight:600;color:#6b7280">신규</th><th style="text-align:center;padding:6px 8px;font-weight:600;color:#6b7280">오류</th></tr></thead><tbody>'
          + recentLogs.map(function(l) {
              var tc = l.sync_type === 'patients' ? 'background:#dbeafe;color:#1d4ed8' : l.sync_type === 'payments' ? 'background:#dcfce7;color:#16a34a' : 'background:#f3e8ff;color:#7c3aed';
              var tl = l.sync_type === 'patients' ? '환자' : l.sync_type === 'payments' ? '결제' : '내원';
              return '<tr style="border-top:1px solid #d1d5db"><td style="padding:5px 8px;color:#6b7280;font-size:10px;white-space:nowrap">' + (l.created_at || '').replace('T', ' ').substring(5, 16) + '</td><td style="padding:5px 8px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500;' + tc + '">' + tl + '</span></td><td style="padding:5px 8px;text-align:center">' + (l.total_rows || 0) + '</td><td style="padding:5px 8px;text-align:center;color:#2563eb;font-weight:500">' + (l.new_rows || 0) + '</td><td style="padding:5px 8px;text-align:center;' + (l.error_rows > 0 ? 'color:#ef4444;font-weight:500' : 'color:#9ca3af') + '">' + (l.error_rows || 0) + '</td></tr>';
            }).join('')
          + '</tbody></table></div>')
          + '</div>'
        + '</details>'

        /* config.ini + 수동 연동 + FAQ (접이식) */
        + '<details style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:10px">'
          + '<summary style="padding:12px 14px;font-size:12px;font-weight:500;color:#6b7280;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#9ca3af">▶</span> 고급: config.ini / 수동 연동 / FAQ</summary>'
          + '<div style="padding:0 14px 14px;font-size:11px;color:#4b5563">'
            + '<div style="background:#111827;border-radius:6px;padding:10px;font-family:monospace;font-size:10px;color:#4ade80;overflow-x:auto;line-height:1.5;margin-bottom:10px">'
              + '<p style="color:#6b7280;margin:0"># config.ini (자동 생성됨)</p><p style="margin:2px 0 0">[dentweb]</p><p style="margin:0">server = <span style="color:#fbbf24">localhost</span> | port = 1436 | user = dwpublic</p><p style="margin:4px 0 0">[dental_point]</p><p style="margin:0">api_url = <span style="color:#fbbf24">https://dental-point.pages.dev/api</span> | clinic_id = <span style="color:#fbbf24">' + CID() + '</span></p><p style="margin:4px 0 0">[sync]</p><p style="margin:0">interval_minutes = 5 | payment_days_back = 3</p>'
            + '</div>'
            + '<p style="font-weight:600;color:#1f2937;margin:0 0 4px">수동 연동</p>'
            + '<ol style="margin:0 0 8px;padding-left:16px;color:#374151;line-height:1.8;font-size:11px"><li>DentWebBridge.exe + config.ini → DentWeb PC 복사</li><li>config.ini 수동 편집 (server, admin_phone, clinic_id)</li><li>DentWebBridge.exe --test (연결 테스트)</li><li>DentWebBridge.exe --install (자동 실행 등록)</li></ol>'
            + '<p style="font-weight:600;color:#1f2937;margin:0 0 4px">FAQ</p>'
            + '<p style="margin:0;line-height:1.7;color:#6b7280"><strong style="color:#374151">연결 안됨:</strong> 포트 1436 방화벽 확인, DentWeb 실행 확인, dwpublic 활성화 확인<br><strong style="color:#374151">코드 만료:</strong> 30분 유효 → 새 코드 생성<br><strong style="color:#374151">환자 중복:</strong> 전화번호/차트번호 기준 자동 매칭<br><strong style="color:#374151">자동 실행:</strong> DentWebBridge.exe --install (Windows 작업 스케줄러)</p>'
          + '</div>'
        + '</details>'
      + '</div>';

      /* 이벤트 바인딩 */
      document.getElementById('dpt-dw-refresh').addEventListener('click', function() { pgDentweb(el); });

      var copyBtn = document.getElementById('dpt-copy-code');
      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(activeCode).then(function() { toast('연동 코드 복사됨!'); }).catch(function() { fallbackCopy(activeCode); toast('복사됨!'); });
          } else { fallbackCopy(activeCode); toast('복사됨!'); }
        });
      }

      function genCode() {
        callAPI('/setup/code', { method: 'POST', body: JSON.stringify({ clinic_id: CID() }) })
          .then(function(d) { toast('연동 코드: ' + d.code + ' (30분간 유효)'); pgDentweb(el); })
          .catch(function(e) { toast(e.message, 'error'); });
      }
      var genBtn = document.getElementById('dpt-gen-code');
      if (genBtn) genBtn.addEventListener('click', genCode);

      if (activeCode && codeExpSec > 0) {
        var remaining = codeExpSec;
        var tmr = setInterval(function() {
          remaining--;
          if (remaining <= 0) { clearInterval(tmr); pgDentweb(el); return; }
          var te = document.getElementById('dpt-code-timer');
          if (te) te.textContent = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0') + ' 남음';
        }, 1000);
      }
    }).catch(function(e) {
      el.innerHTML = '<div style="text-align:center;padding:30px"><p style="color:#ef4444;font-size:13px">' + e.message + '</p><p style="color:#9ca3af;font-size:11px;margin-top:6px">DentWeb 연동 상태를 조회할 수 없습니다.</p></div>';
    });
  }

  /* --- 설정 --- */
  function pgSet(el) {
    el.innerHTML = SPIN_HTML;
    Promise.all([callAPI('/clinics/' + CID()), callAPI('/coupons/templates?clinic_id=' + CID() + '&include_global_inactive=1')])
    .then(function(res) {
      var raw = res[0];
      var clinic = raw.clinic || raw;
      var settings = raw.settings || {};
      var pointRate = (settings.default_point_rate !== undefined) ? settings.default_point_rate : (clinic.point_rate !== undefined ? clinic.point_rate : 5);
      var pointExpiry = settings.point_expiry_days || 365;
      var catRates = [];
      try {
        var cr = settings.category_rates;
        if (Array.isArray(cr)) { catRates = cr; }
        else if (typeof cr === 'string' && cr) { catRates = JSON.parse(cr); }
      } catch(e) {}
      if (!Array.isArray(catRates)) catRates = [];
      _autoRules = [];
      try {
        var ar = settings.coupon_auto_rules;
        if (Array.isArray(ar)) { _autoRules = ar; }
        else if (typeof ar === 'string' && ar) { _autoRules = JSON.parse(ar); }
      } catch(e) {}
      if (!Array.isArray(_autoRules)) _autoRules = [];
      var autoRules = _autoRules; /* 로컬 alias */
      var templates = (res[1].templates || []);

      var CARD = 'background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:0;margin-bottom:14px;overflow:hidden';
      var CARD_HDR = 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #d1d5db';
      var INP = 'padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;width:100%';
      var SAVEBTN = 'padding:7px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit';
      var GBTN = 'padding:7px 16px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit';
      var EDITBTN = 'padding:6px 14px;border-radius:7px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:12px;cursor:pointer;font-family:inherit';

      /* ── 치과 정보 테이블 행 ── */
      function infoRow(id, label, value, placeholder, isLast) {
        var bs = isLast ? '' : 'border-bottom:1px solid #d1d5db;';
        return '<tr>'
          + '<td style="padding:13px 16px;font-size:12px;font-weight:600;color:#6b7280;white-space:nowrap;width:90px;' + bs + '">' + label + '</td>'
          + '<td style="padding:13px 16px;font-size:14px;color:#1f2937;' + bs + '">'
          + '<span id="dpt-sv-' + id + '">' + (value || '<span style="color:#d1d5db">미입력</span>') + '</span>'
          + '<input id="dpt-si-' + id + '" type="text" value="' + (value||'') + '" placeholder="' + placeholder + '" style="' + INP + ';display:none">'
          + '</td></tr>';
      }

      /* ── 진료항목별 적립률 행 ── */
      function catRateRows(cats) {
        if (!cats || cats.length === 0) return '';
        return cats.map(function(c, i) {
          return '<div class="dpt-cat-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
            + '<input type="text" class="dpt-cat-name" placeholder="진료항목명" value="' + (c.category||'').replace(/"/g,'&quot;') + '" style="flex:1;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box">'
            + '<input type="number" class="dpt-cat-rate" min="0" max="100" step="0.1" value="' + (c.rate||0) + '" placeholder="%" style="width:70px;padding:9px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;text-align:center;box-sizing:border-box">'
            + '<span style="font-size:13px;color:#6b7280">%</span>'
            + '<button class="dpt-cat-del" style="padding:6px 8px;border-radius:6px;border:none;background:none;color:#ef4444;font-size:16px;cursor:pointer;line-height:1;font-family:inherit">×</button>'
            + '</div>';
        }).join('');
      }

      /* ── 쿠폰 템플릿 카드 ── */
      function tplCards() {
        if (templates.length === 0)
          return '<div style="padding:28px;text-align:center;color:#9ca3af;font-size:13px">등록된 쿠폰 템플릿이 없습니다</div>';
        return templates.map(function(t) {
          /* coupon_auto_rules 우선 표시, 없을 때만 auto_issue_points 사용 */
          var autoLines = [];
          var matchedRules = autoRules.filter(function(rule) {
            return String(rule.template_id) === String(t.id) && rule.min_points;
          });
          if (matchedRules.length > 0) {
            matchedRules.forEach(function(rule) {
              autoLines.push(F(rule.min_points) + 'P 달성 시 자동 등록');
            });
          } else if (t.auto_issue_points) {
            autoLines.push(F(t.auto_issue_points) + 'P 달성 시 자동 등록');
          }

          var isGlobal = !!t.is_global;
          var isGlobalActivated = isGlobal && t.is_global_activated;

          var requiredPtsHtml = '';
          if (isGlobal && !isGlobalActivated) {
            requiredPtsHtml = '<div style="font-size:12px;color:#9ca3af;margin-top:2px">세부 설정 후 활성화됩니다</div>';
          } else {
            requiredPtsHtml = t.required_points > 0
              ? '<div style="font-size:12px;color:#dc2626;font-weight:600;margin-top:2px">발행 비용: ' + F(t.required_points) + 'P</div>'
              : (t.is_birthday ? '' : '<div style="font-size:12px;color:#9ca3af;margin-top:2px">무료 발행</div>');
          }
          var autoStr = autoLines.length > 0
            ? autoLines.map(function(line) {
                return '<div style="font-size:12px;color:#2563eb;font-weight:500;margin-top:3px">' + line + '</div>';
              }).join('')
            : '';

          var imgHtml = t.image_url
            ? '<img src="' + t.image_url + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              + '<div style="width:64px;height:64px;border-radius:8px;background:#f3f4f6;display:none;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>'
            : '<div style="width:64px;height:64px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>';

          /* 상태 배지 */
          var statusBadge;
          if (isGlobal && !isGlobalActivated) {
            statusBadge = '<span style="display:inline-block;padding:4px 10px;border-radius:6px;border:1px solid #fecaca;background:#fee2e2;font-size:11px;color:#ef4444;font-weight:500;white-space:nowrap">비활성</span>';
          } else if (t.status === 'active' || isGlobalActivated) {
            statusBadge = '<span style="display:inline-block;padding:4px 10px;border-radius:6px;border:none;background:#2563eb;font-size:11px;color:#fff;font-weight:600;white-space:nowrap">활성</span>';
          } else {
            statusBadge = '<span style="display:inline-block;padding:4px 10px;border-radius:6px;border:1px solid #fecaca;background:#fee2e2;font-size:11px;color:#ef4444;font-weight:500;white-space:nowrap">비활성</span>';
          }

          var tplKind = (t.is_birthday || t.coupon_kind === 'birthday');
          var tplKindNote = tplKind
            ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap">생일용</span>'
            : '';
          var globalBadge = '';

          /* 액션 버튼 */
          var actionBtns;
          if (isGlobal && !isGlobalActivated) {
            /* 비활성 글로벌: 설정 버튼만 */
            actionBtns = '<button class="dpt-set-gsetup" data-id="' + t.id + '" data-name="' + escH(t.name||'') + '" data-imgurl="' + escH(t.image_url||'') + '" style="padding:3px 10px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;font-weight:600">설정</button>';
          } else if (isGlobal && isGlobalActivated) {
            /* 활성 글로벌: 활성 + 수정 + 삭제 (일반과 동일) */
            actionBtns = '<button class="dpt-set-gsetup" data-id="' + t.id + '" data-name="' + escH(t.name||'') + '" data-imgurl="' + escH(t.image_url||'') + '" data-rpts="' + (t.required_points||0) + '" data-days="' + (t.valid_days||90) + '" data-bday="' + (t.is_birthday?'1':'0') + '" data-auto="' + (t.auto_issue_points||'') + '" data-activated="1" style="padding:3px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">수정</button>'
              + '<button class="dpt-set-gdeact" data-id="' + t.id + '" data-name="' + escH(t.name||'') + '" style="padding:3px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">삭제</button>';
          } else {
            /* 일반 클리닉 템플릿 */
            actionBtns = '<button class="dpt-set-tedit" data-id="' + t.id + '" data-name="' + (t.name||'').replace(/"/g,'&quot;') + '" data-dtype="' + t.discount_type + '" data-dval="' + t.discount_value + '" data-days="' + (t.valid_days||90) + '" data-auto="' + (t.auto_issue_points||'') + '" data-imgurl="' + (t.image_url||'') + '" data-birthday="' + (t.is_birthday ? '1' : '0') + '" data-required="' + (t.required_points||0) + '" style="padding:3px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">수정</button>'
              + '<button class="dpt-set-tdel" data-id="' + t.id + '" style="padding:3px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">삭제</button>';
          }

          var rowBg = isGlobal ? (isGlobalActivated ? ';background:#eff6ff' : ';background:#fafafa;opacity:0.85') : '';
          return '<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #d1d5db' + rowBg + '">'
            + imgHtml
            + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">' + globalBadge + tplKindNote + '<span style="font-size:14px;font-weight:600;color:#1f2937">' + escH(t.name) + '</span></div>'
            + (isGlobal && !isGlobalActivated ? '' : '<div style="font-size:12px;color:#6b7280;margin-top:3px">유효 ' + (t.valid_days||365) + '일</div>')
            + autoStr
            + requiredPtsHtml
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">'
            + statusBadge
            + actionBtns
            + '</div>'
            + '</div>';
        }).join('');
      }

      el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'

        /* ── 페이지 헤더 ── */
        + '<div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">설정</div>'

        /* ── 1. 치과 정보 ── */
        + '<div style="' + CARD + '">'
        + '<div style="' + CARD_HDR + '">'
        + '<h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0">치과 정보</h3>'
        + '<div style="display:flex;gap:6px">'
        + '<button id="dpt-set-cedit" style="' + EDITBTN + '">수정</button>'
        + '<button id="dpt-set-csave" style="' + SAVEBTN + ';display:none">저장</button>'
        + '<button id="dpt-set-ccancel" style="' + EDITBTN + ';display:none">취소</button>'
        + '</div></div>'
        + '<table style="width:100%;border-collapse:collapse">'
        + infoRow('cname', '치과명', clinic.name, '치과명 입력', false)
        + infoRow('cphone', '전화번호', clinic.phone, '전화번호 입력', false)
        + infoRow('mname', '담당자명', authMember.name, '담당자명 입력', true)
        + '</table>'
        + '</div>'

        /* ── 2. 포인트 설정 ── */
        + '<div style="' + CARD + '">'
        + '<div style="' + CARD_HDR + '">'
        + '<h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0">포인트 설정</h3>'
        + '</div>'
        + '<div style="padding:16px">'
        /* 기본 적립률 + 유효기간 */
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'
        + '<div>'
        + '<label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:6px">기본 적립율</label>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<input id="dpt-set-rate" type="number" min="0" max="100" step="0.1" value="' + pointRate + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;font-family:inherit;box-sizing:border-box;font-weight:600">'
        + '<span style="font-size:14px;color:#374151;flex-shrink:0">%</span>'
        + '</div>'
        + '<p id="dpt-rate-preview" style="font-size:11px;color:#2563eb;margin:5px 0 0;padding-left:2px">10만원 결제 시 → ' + Math.floor(100000 * pointRate / 100).toLocaleString() + ' P 적립</p>'
        + '</div>'
        + '<div>'
        + '<label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:6px">포인트 유효기간</label>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<input id="dpt-set-expiry" type="number" min="1" value="' + pointExpiry + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;font-family:inherit;box-sizing:border-box;font-weight:600">'
        + '<span style="font-size:14px;color:#374151;flex-shrink:0">일</span>'
        + '</div>'
        + '</div>'
        + '</div>'
        /* 진료항목별 적립률 */
        + '<div style="margin-bottom:14px">'
        + '<label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:8px">진료항목별 적립율</label>'
        + '<div id="dpt-cat-list">' + catRateRows(catRates) + '</div>'
        + '<button id="dpt-cat-add" style="color:#2563eb;background:none;border:none;font-size:13px;font-weight:500;cursor:pointer;padding:4px 0;font-family:inherit">+ 항목 추가</button>'
        + '</div>'
        /* 저장 버튼 */
        + '<button id="dpt-set-psave" style="' + SAVEBTN + ';padding:11px 24px">포인트 설정 저장</button>'
        + '</div>'
        + '</div>'

        /* ── 3. 쿠폰 템플릿 ── */
        + '<div style="' + CARD + '">'
        + '<div style="' + CARD_HDR + '">'
        + '<h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0">쿠폰 템플릿 <span style="font-size:12px;font-weight:400;color:#6b7280">[' + templates.length + '개]</span></h3>'
        + '<div style="display:flex;gap:6px"><button id="dpt-set-tadd" style="' + SAVEBTN + '">+ 새 템플릿</button></div>'
        + '</div>'
        + '<div id="dpt-set-tlist">' + tplCards() + '</div>'
        + '</div>'

        + '</div>';

      /* ── 치과 정보 수정 모드 ── */
      function setEditMode(on) {
        ['cname','cphone','mname'].forEach(function(id) {
          document.getElementById('dpt-sv-' + id).style.display = on ? 'none' : '';
          document.getElementById('dpt-si-' + id).style.display = on ? '' : 'none';
        });
        document.getElementById('dpt-set-cedit').style.display = on ? 'none' : '';
        document.getElementById('dpt-set-csave').style.display = on ? '' : 'none';
        document.getElementById('dpt-set-ccancel').style.display = on ? '' : 'none';
      }
      document.getElementById('dpt-set-cedit').addEventListener('click', function() { setEditMode(true); });
      document.getElementById('dpt-set-ccancel').addEventListener('click', function() { setEditMode(false); });
      document.getElementById('dpt-set-csave').addEventListener('click', function() {
        var cname = document.getElementById('dpt-si-cname').value.trim();
        var cphone = document.getElementById('dpt-si-cphone').value.trim();
        var mname = document.getElementById('dpt-si-mname').value.trim();
        var btn = this; btn.textContent = '저장 중...'; btn.disabled = true;
        Promise.all([
          callAPI('/clinics/' + CID(), { method: 'PUT', body: JSON.stringify({ name: cname, phone: cphone }) }),
          mname ? callAPI('/auth/me', { method: 'PUT', body: JSON.stringify({ name: mname }) }) : Promise.resolve()
        ]).then(function() {
          if (mname) authMember.name = mname;
          if (cname && currentClinic) currentClinic.name = cname;
          document.getElementById('dpt-sv-cname').innerHTML = cname || '<span style="color:#d1d5db">미입력</span>';
          document.getElementById('dpt-sv-cphone').innerHTML = cphone || '<span style="color:#d1d5db">미입력</span>';
          document.getElementById('dpt-sv-mname').innerHTML = mname || '<span style="color:#d1d5db">미입력</span>';
          setEditMode(false); toast('저장되었습니다.');
          btn.textContent = '저장'; btn.disabled = false;
        }).catch(function(e) { toast(e.message, 'error'); btn.textContent = '저장'; btn.disabled = false; });
      });

      /* ── 진료항목 추가/삭제 ── */
      document.getElementById('dpt-cat-add').addEventListener('click', function() {
        var row = document.createElement('div');
        row.className = 'dpt-cat-row';
        row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
        row.innerHTML = '<input type="text" class="dpt-cat-name" placeholder="진료항목명" style="flex:1;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box">'
          + '<input type="number" class="dpt-cat-rate" min="0" max="100" step="0.1" placeholder="%" style="width:70px;padding:9px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;text-align:center;box-sizing:border-box">'
          + '<span style="font-size:13px;color:#6b7280">%</span>'
          + '<button class="dpt-cat-del" style="padding:6px 8px;border-radius:6px;border:none;background:none;color:#ef4444;font-size:16px;cursor:pointer;line-height:1;font-family:inherit">×</button>';
        document.getElementById('dpt-cat-list').appendChild(row);
        row.querySelector('.dpt-cat-del').addEventListener('click', function() { row.remove(); });
      });
      document.querySelectorAll('.dpt-cat-del').forEach(function(btn) {
        btn.addEventListener('click', function() { btn.closest('.dpt-cat-row').remove(); });
      });

      /* ── 적립률 미리보기 ── */
      document.getElementById('dpt-set-rate').addEventListener('input', function() {
        var r = parseFloat(this.value) || 0;
        var pts = Math.floor(100000 * r / 100);
        document.getElementById('dpt-rate-preview').textContent = '10만원 결제 시 → ' + pts.toLocaleString() + ' P 적립';
      });

      /* ── 포인트 설정 저장 ── */
      document.getElementById('dpt-set-psave').addEventListener('click', function() {
        var rate = parseFloat(document.getElementById('dpt-set-rate').value);
        var expiry = parseInt(document.getElementById('dpt-set-expiry').value) || 365;
        if (isNaN(rate) || rate < 0) { toast('올바른 적립률을 입력하세요.', 'error'); return; }
        var cats = [];
        document.querySelectorAll('#dpt-cat-list .dpt-cat-row').forEach(function(row) {
          var catName = row.querySelector('.dpt-cat-name').value.trim();
          var catRateStr = row.querySelector('.dpt-cat-rate').value.trim();
          var catRate = catRateStr === '' ? 0 : parseFloat(catRateStr);
          if (catName) {
            cats.push({ category: catName, rate: isNaN(catRate) ? 0 : catRate });
          }
        });
        var btn = this; btn.textContent = '저장 중...'; btn.disabled = true;
        callAPI('/clinics/' + CID() + '/settings', { method: 'PUT', body: JSON.stringify({ default_point_rate: rate, point_expiry_days: expiry, category_rates: cats }) })
        .then(function() {
          toast('포인트 설정이 저장되었습니다. (' + cats.length + '개 항목)');
          btn.textContent = '포인트 설정 저장'; btn.disabled = false;
        }).catch(function(e) { toast(e.message, 'error'); btn.textContent = '포인트 설정 저장'; btn.disabled = false; });
      });

      /* ── 쿠폰 템플릿 버튼 이벤트 ── */
      document.getElementById('dpt-set-tadd').addEventListener('click', function() { showTemplateModal(null, el); });

      /* 글로벌 템플릿 설정/활성화 버튼 */
      document.querySelectorAll('.dpt-set-gsetup').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var gid = btn.getAttribute('data-id');
          var gname = btn.getAttribute('data-name');
          var gimgurl = btn.getAttribute('data-imgurl') || '';
          var isEdit = btn.getAttribute('data-activated') === '1';
          showGlobalActivateModal({
            global_template_id: gid,
            name: gname,
            image_url: gimgurl,
            required_points: isEdit ? parseInt(btn.getAttribute('data-rpts')||'0') : 0,
            valid_days: isEdit ? parseInt(btn.getAttribute('data-days')||'90') : 90,
            is_birthday: isEdit ? (btn.getAttribute('data-bday') === '1' ? 1 : 0) : 0,
            auto_issue_points: isEdit && btn.getAttribute('data-auto') ? parseInt(btn.getAttribute('data-auto')) : null,
            isEdit: isEdit
          }, el);
        });
      });

      /* 글로벌 템플릿 비활성화 버튼 */
      document.querySelectorAll('.dpt-set-gdeact').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showConfirmModal('쿠폰 템플릿 삭제', '[' + btn.getAttribute('data-name') + '] 템플릿을 삭제할까요?\n이미 발행된 쿠폰에는 영향 없습니다.', function() {
            callAPI('/coupons/templates/deactivate-global', { method: 'POST', body: JSON.stringify({ clinic_id: CID(), global_template_id: btn.getAttribute('data-id') }) })
            .then(function() { toast('비활성화되었습니다.'); pgSet(el); })
            .catch(function(e) { toast(e.message, 'error'); });
          });
        });
      });

      /* 일반 클리닉 템플릿 수정 */
      document.querySelectorAll('.dpt-set-tedit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showTemplateModal({
            id: btn.getAttribute('data-id'),
            name: btn.getAttribute('data-name'),
            discount_type: btn.getAttribute('data-dtype'),
            discount_value: parseFloat(btn.getAttribute('data-dval')),
            valid_days: parseInt(btn.getAttribute('data-days')),
            auto_issue_points: btn.getAttribute('data-auto') ? parseInt(btn.getAttribute('data-auto')) : null,
            required_points: btn.getAttribute('data-required') ? parseInt(btn.getAttribute('data-required')) : 0,
            image_url: btn.getAttribute('data-imgurl') || '',
            is_birthday: btn.getAttribute('data-birthday') === '1' ? 1 : 0
          }, el);
        });
      });
      document.querySelectorAll('.dpt-set-tdel').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showConfirmModal('템플릿 삭제', '이 쿠폰 템플릿을 삭제할까요?', function() {
            callAPI('/coupons/templates/' + btn.getAttribute('data-id'), { method: 'DELETE' })
            .then(function() { toast('삭제되었습니다.'); pgSet(el); })
            .catch(function(e) { toast(e.message, 'error'); });
          });
        });
      });
    }).catch(function(e) { el.innerHTML = '<p style="padding:20px;color:#ef4444;font-size:13px;text-align:center">' + e.message + '</p>'; });
  }

  /* 글로벌 템플릿 활성화/수정 모달 - 치과별 세부 설정 */
  function showGlobalActivateModal(opts, parentEl) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px;overflow-y:auto';
    var IS2 = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:10px';
    var LBL2 = 'display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:420px;margin:auto">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 6px">쿠폰 템플릿 ' + (opts.isEdit ? '수정' : '활성화') + '</h3>'
      + '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#f0f9ff;border-radius:8px;margin-bottom:16px">'
      + (opts.image_url ? '<img src="' + escH(opts.image_url) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0" onerror="this.style.display=\'none\'">' : '')
      + '<span style="font-size:14px;font-weight:600;color:#0c4a6e">' + escH(opts.name) + '</span></div>'
      + '<label style="' + LBL2 + '">발행 비용 포인트 <span style="font-size:11px;color:#9ca3af;font-weight:400">(쿠폰 발행 시 차감할 포인트 · 0 = 무료 발행)</span></label>'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">'
      + '<input id="dpt-ga-required" type="number" min="0" step="100" placeholder="0 = 무료 발행" value="' + (opts.required_points||0) + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit">'
      + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P 차감</span></div>'
      + '<label style="' + LBL2 + '">유효 기간 (일)</label>'
      + '<input id="dpt-ga-days" type="number" placeholder="90" value="' + (opts.valid_days||90) + '" style="' + IS2 + '">'
      + '<div style="border-top:1px solid #e5e7eb;margin:10px 0 14px"></div>'
      + '<label style="' + LBL2 + '">쿠폰 유형</label>'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:14px;padding:12px 14px;border:2px solid #fde68a;border-radius:10px;background:#fffbeb;transition:all .15s">'
      + '<input type="checkbox" id="dpt-ga-bday" ' + (opts.is_birthday ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:#d97706;flex-shrink:0">'
      + '<div><span style="font-size:13px;font-weight:700;color:#92400e">생일 쿠폰으로 지정</span>'
      + '<p style="font-size:11px;font-weight:400;color:#a16207;margin:2px 0 0">체크하면 생일 환자에게 포인트 없이도 발행 가능합니다</p></div></label>'
      + '<label style="' + LBL2 + '">자동 발행 규칙 <span style="font-size:11px;color:#9ca3af;font-weight:400">(선택)</span></label>'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px">'
      + '<input id="dpt-ga-auto" type="number" min="0" step="1000" placeholder="0 = 수동 발행" value="' + (opts.auto_issue_points||0) + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit">'
      + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P 이상 시 자동</span></div>'
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button id="dpt-ga-cancel" style="flex:1;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
      + '<button id="dpt-ga-save" style="flex:1;padding:11px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">' + (opts.isEdit ? '저장' : '활성화') + '</button>'
      + '</div></div>';
    document.body.appendChild(m);
    m.querySelector('#dpt-ga-cancel').addEventListener('click', function() { m.remove(); });
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

    m.querySelector('#dpt-ga-save').addEventListener('click', function() {
      var btn = m.querySelector('#dpt-ga-save');
      btn.textContent = '저장 중...'; btn.disabled = true;
      var body = {
        clinic_id: CID(),
        global_template_id: opts.global_template_id,
        required_points: parseInt(m.querySelector('#dpt-ga-required').value) || 0,
        valid_days: parseInt(m.querySelector('#dpt-ga-days').value) || 90,
        is_birthday: m.querySelector('#dpt-ga-bday').checked ? 1 : 0,
        coupon_kind: m.querySelector('#dpt-ga-bday').checked ? 'birthday' : 'general',
        auto_issue_points: parseInt(m.querySelector('#dpt-ga-auto').value) || null
      };
      callAPI('/coupons/templates/activate-global', { method: 'POST', body: JSON.stringify(body) })
      .then(function() { toast(opts.isEdit ? '수정되었습니다.' : '활성화되었습니다.'); m.remove(); pgSet(parentEl); })
      .catch(function(e) { toast(e.message, 'error'); btn.textContent = opts.isEdit ? '저장' : '활성화'; btn.disabled = false; });
    });
  }

  function showTemplateModal(tpl, parentEl) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px;overflow-y:auto';
    var IS2 = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:10px';
    var LBL2 = 'display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px';
    /* 이 템플릿에 연결된 기존 자동 발행 규칙 포인트 목록 */
    var existingRulePts = _autoRules
      .filter(function(r) { return tpl && String(r.template_id) === String(tpl.id) && r.min_points; })
      .map(function(r) { return r.min_points; });
    /* 규칙 행 HTML */
    function ruleRowHtml(pts) {
      return '<div class="dpt-tm-rule-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<input type="number" class="dpt-tm-rule-pts" min="1" placeholder="예: 100000" value="' + (pts||'') + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit">'
        + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P 이상</span>'
        + '<button type="button" class="dpt-tm-rule-del" style="padding:4px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:12px;cursor:pointer;font-family:inherit">삭제</button>'
        + '</div>';
    }
    var initRuleRows = existingRulePts.length > 0
      ? existingRulePts.map(ruleRowHtml).join('')
      : '';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:420px;margin:auto">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 18px">쿠폰 템플릿 ' + (tpl ? '수정' : '추가') + '</h3>'
      + '<label style="' + LBL2 + '">쿠폰 이름 <span style="color:#ef4444">*</span></label>'
      + '<input id="dpt-tm-name" type="text" placeholder="예: 스케일링 무료 사용권" value="' + (tpl ? tpl.name : '') + '" style="' + IS2 + '">'
      + '<label style="' + LBL2 + '">발행 비용 포인트 <span style="font-size:11px;color:#9ca3af;font-weight:400">(쿠폰 발행 시 차감할 포인트 · 0 = 무료 발행)</span></label>'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">'
      + '<input id="dpt-tm-required" type="number" min="0" step="100" placeholder="0 = 무료 발행" value="' + (tpl ? (tpl.required_points||0) : 0) + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit">'
      + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P 차감</span></div>'
      + '<label style="' + LBL2 + '">유효 기간 (일)</label>'
      + '<input id="dpt-tm-days" type="number" placeholder="365" value="' + (tpl ? (tpl.valid_days||365) : 365) + '" style="' + IS2 + '">'
      + '<label style="' + LBL2 + '">쿠폰 이미지 URL <span style="font-size:11px;color:#9ca3af;font-weight:400">(선택)</span></label>'
      + '<input id="dpt-tm-imgurl" type="text" placeholder="https://..." value="' + (tpl ? (tpl.image_url||'') : '') + '" style="' + IS2 + '">'
      + '<div style="border-top:1px solid #d1d5db;margin:12px 0 14px"></div>'
      + '<label style="' + LBL2 + '">쿠폰 유형</label>'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:14px;padding:12px 14px;border:2px solid #fde68a;border-radius:10px;background:#fffbeb;transition:all .15s">'
      + '<input type="checkbox" id="dpt-tm-birthday" ' + (tpl && tpl.is_birthday ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:#d97706;flex-shrink:0">'
      + '<div><span style="font-size:13px;font-weight:700;color:#92400e">생일 쿠폰으로 지정</span>'
      + '<p style="font-size:11px;font-weight:400;color:#a16207;margin:2px 0 0">체크하면 생일 환자에게 포인트 없이도 발행 가능합니다</p>'
      + '<p style="font-size:11px;font-weight:400;color:#6b7280;margin:2px 0 0">체크하지 않으면 일반쿠폰으로 분류됩니다</p></div>'
      + '</label>'
      + '<label style="' + LBL2 + '">자동 발행 규칙 <span style="font-size:11px;color:#9ca3af;font-weight:400">(선택 · 복수 설정 가능)</span></label>'
      + '<p style="font-size:11px;color:#6b7280;margin:-2px 0 10px;line-height:1.5">설정한 포인트를 달성하면 이 쿠폰이 자동 생성됩니다.</p>'
      + '<div id="dpt-tm-rule-list">' + initRuleRows + '</div>'
      + '<button type="button" id="dpt-tm-rule-add" style="font-size:13px;color:#2563eb;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;margin-bottom:14px">+ 규칙 추가</button>'
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button id="dpt-tm-cancel" style="flex:1;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
      + '<button id="dpt-tm-save" style="flex:1;padding:11px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">저장</button>'
      + '</div></div>';
    document.body.appendChild(m);
    m.querySelector('#dpt-tm-cancel').addEventListener('click', function() { m.remove(); });
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    /* 규칙 행 삭제 (이벤트 위임) */
    m.querySelector('#dpt-tm-rule-list').addEventListener('click', function(e) {
      if (e.target.classList.contains('dpt-tm-rule-del')) e.target.closest('.dpt-tm-rule-row').remove();
    });
    /* + 규칙 추가 */
    m.querySelector('#dpt-tm-rule-add').addEventListener('click', function() {
      var list = m.querySelector('#dpt-tm-rule-list');
      var div = document.createElement('div');
      div.innerHTML = ruleRowHtml('');
      list.appendChild(div.firstChild);
    });
    m.querySelector('#dpt-tm-save').addEventListener('click', function() {
      var name = m.querySelector('#dpt-tm-name').value.trim();
      var days = parseInt(m.querySelector('#dpt-tm-days').value) || 90;
      var imgUrl = document.getElementById('dpt-tm-imgurl').value.trim();
      var isBirthday = m.querySelector('#dpt-tm-birthday').checked;
      var requiredPoints = parseInt(m.querySelector('#dpt-tm-required').value) || 0;
      if (!name) { toast('쿠폰 이름을 입력하세요.', 'error'); return; }
      /* 규칙 포인트 수집 */
      var newPts = [];
      document.querySelectorAll('#dpt-tm-rule-list .dpt-tm-rule-row').forEach(function(row) {
        var pts = parseInt(row.querySelector('.dpt-tm-rule-pts').value);
        if (pts > 0) newPts.push(pts);
      });
      var btn = this; btn.textContent = '저장 중...'; btn.disabled = true;
      /* 할인 정보는 기존 값 유지 또는 기본값 (서버 필수값이므로 최소 1 전달) */
      var body = {
        name: name,
        discount_type: (tpl ? tpl.discount_type : null) || 'fixed',
        discount_value: (tpl && tpl.discount_value != null) ? tpl.discount_value : 1,
        valid_days: days,
        clinic_id: CID(),
        status: 'active',
        is_birthday: isBirthday ? 1 : 0,
        required_points: requiredPoints
      };
      if (imgUrl) body.image_url = imgUrl;
      var req = tpl ? callAPI('/coupons/templates/' + tpl.id, { method:'PUT', body: JSON.stringify(body) })
                    : callAPI('/coupons/templates', { method:'POST', body: JSON.stringify(body) });
      req.then(function(res) {
        var savedId = tpl ? tpl.id : (res && (res.template_id || res.id || (res.template && res.template.id)));
        /* 저장 전 서버에서 최신 규칙을 다시 읽어 병합 (stale _autoRules 방지) */
        return callAPI('/clinics/' + CID()).then(function(latest) {
          var latestSettings = (latest.settings || latest.clinic && latest.clinic.settings) || {};
          var latestRules = [];
          try {
            var lr = latestSettings.coupon_auto_rules;
            if (Array.isArray(lr)) latestRules = lr;
            else if (typeof lr === 'string' && lr) latestRules = JSON.parse(lr);
          } catch(e) {}
          /* 이 템플릿에 기존 규칙이 있었는지 확인 */
          var hadRules = latestRules.some(function(r) { return String(r.template_id) === String(savedId); });
          /* 규칙 입력도 없고 기존 규칙도 없으면 settings 건드리지 않음 */
          if (newPts.length === 0 && !hadRules) {
            _autoRules = latestRules;
            toast('저장되었습니다.'); m.remove(); pgSet(parentEl);
            return;
          }
          /* 이 템플릿 외 기존 규칙 유지 + 새 규칙 병합 */
          var otherRules = latestRules.filter(function(r) {
            return String(r.template_id) !== String(savedId);
          });
          var merged = otherRules.concat(newPts.map(function(pts) {
            return { template_id: Number(savedId), min_points: pts };
          }));
          return callAPI('/clinics/' + CID() + '/settings', { method: 'PUT', body: JSON.stringify({ coupon_auto_rules: merged }) })
            .then(function() {
              _autoRules = merged;
              toast('저장되었습니다.'); m.remove(); pgSet(parentEl);
            });
        });
      }).catch(function(e) { toast(e.message, 'error'); btn.textContent = '저장'; btn.disabled = false; });
    });
  }

  /* ==================== 글로벌 템플릿 가져오기 모달 (설정 > 쿠폰 템플릿) ==================== */
  function showGlobalImportModal(parentEl) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99990;display:flex;align-items:center;justify-content:center;padding:16px;animation:dptFadeIn .2s ease';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)">'
      + '<div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0">글로벌 템플릿 가져오기</h3>'
      + '<button id="dpt-gi-close" style="border:none;background:none;font-size:20px;cursor:pointer;color:#9ca3af;line-height:1">×</button></div>'
      + '<div id="dpt-gi-body" style="padding:16px 20px">' + SPIN_HTML + '</div></div>';
    document.body.appendChild(m);
    document.getElementById('dpt-gi-close').addEventListener('click', function() { m.remove(); });
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

    callAPI('/templates/global').then(function(res) {
      var list = res.templates || [];
      var body = document.getElementById('dpt-gi-body');
      if (!body) return;
      if (list.length === 0) {
        body.innerHTML = '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px 0">등록된 글로벌 템플릿이 없습니다.</p>';
        return;
      }
      body.innerHTML = '<p style="font-size:12px;color:#6b7280;margin:0 0 12px">아래 템플릿을 선택하면 내 치과에 복사됩니다. 가져온 후 자유롭게 수정할 수 있습니다.</p>'
        + list.map(function(t) {
          var imgH = t.image_url
            ? '<img src="' + escH(t.image_url) + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display=\'none\'">'
            : '<div style="width:56px;height:56px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>';
          var kindBadge = t.is_birthday ? '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600">생일</span> ' : '';
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px">'
            + imgH
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:13px;font-weight:600;color:#1f2937">' + kindBadge + escH(t.name) + '</div>'
            + '<div style="font-size:11px;color:#6b7280;margin-top:2px">유효 ' + (t.valid_days||90) + '일' + (t.required_points > 0 ? ' · ' + F(t.required_points) + 'P 비용' : ' · 무료') + '</div>'
            + (t.description ? '<div style="font-size:11px;color:#9ca3af;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escH(t.description) + '</div>' : '')
            + '</div>'
            + '<button class="dpt-gi-btn" data-tid="' + t.id + '" style="padding:6px 14px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">가져오기</button>'
            + '</div>';
        }).join('');

      body.querySelectorAll('.dpt-gi-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          btn.textContent = '처리중...'; btn.disabled = true;
          callAPI('/templates/import', { method: 'POST', body: JSON.stringify({ clinic_id: CID(), template_id: parseInt(btn.getAttribute('data-tid')) }) })
          .then(function() {
            btn.textContent = '완료'; btn.style.background = '#16a34a';
            toast('템플릿을 가져왔습니다.');
            setTimeout(function() { m.remove(); pgSet(parentEl); }, 800);
          })
          .catch(function(e) {
            if (e.message && e.message.indexOf('이미') >= 0) { btn.textContent = '이미 추가됨'; btn.style.background = '#9ca3af'; }
            else { toast(e.message, 'error'); btn.textContent = '가져오기'; btn.disabled = false; }
          });
        });
      });
    }).catch(function(e) {
      var body = document.getElementById('dpt-gi-body');
      if (body) body.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:13px">' + e.message + '</p>';
    });
  }

  /* ==================== 글로벌 템플릿 관리 (super_admin 전용 탭) ==================== */
  function pgGlobal(el) {
    el.innerHTML = SPIN_HTML;
    callAPI('/admin/templates').then(function(res) {
      var templates = res.templates || [];
      var CARD = 'background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden';

      function renderList() {
        var listEl = document.getElementById('dpt-gl-list');
        if (!listEl) return;
        if (templates.length === 0) {
          listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">등록된 쿠폰 템플릿이 없습니다.<br>위의 버튼으로 추가하세요.</div>';
          return;
        }
        listEl.innerHTML = templates.map(function(t) {
          var imgH = t.image_url
            ? '<img src="' + escH(t.image_url) + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              + '<div style="width:64px;height:64px;border-radius:8px;background:#f3f4f6;display:none;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>'
            : '<div style="width:64px;height:64px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>';
          var kindBadge = t.is_birthday ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap">생일용</span>' : '';
          var statusBadge = t.status === 'active'
            ? '<span style="padding:3px 10px;border-radius:8px;background:#d1fae5;color:#059669;font-size:11px;font-weight:600">활성</span>'
            : '<span style="padding:3px 10px;border-radius:8px;background:#fee2e2;color:#ef4444;font-size:11px;font-weight:600">비활성</span>';
          return '<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #e5e7eb">'
            + imgH
            + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">' + kindBadge + '<span style="font-size:14px;font-weight:600;color:#1f2937">' + escH(t.name) + '</span></div>'
            + (t.description ? '<div style="font-size:12px;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escH(t.description) + '</div>' : '')
            + '<div style="font-size:12px;color:#9ca3af;margin-top:2px">유효 ' + (t.valid_days||90) + '일' + (t.required_points > 0 ? ' · 비용 ' + F(t.required_points) + 'P' : ' · 무료') + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">'
            + statusBadge
            + '<button class="dpt-gl-edit" data-id="' + t.id + '" style="padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">수정</button>'
            + '<button class="dpt-gl-del" data-id="' + t.id + '" data-name="' + escH(t.name) + '" style="padding:4px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">삭제</button>'
            + '</div></div>';
        }).join('');

        /* 수정 버튼 */
        listEl.querySelectorAll('.dpt-gl-edit').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var tid = btn.getAttribute('data-id');
            var t = templates.find(function(x) { return String(x.id) === tid; });
            if (t) showGlobalTemplateModal(t, el);
          });
        });
        /* 삭제 버튼 */
        listEl.querySelectorAll('.dpt-gl-del').forEach(function(btn) {
          btn.addEventListener('click', function() {
            showConfirmModal('쿠폰 템플릿 삭제', '[' + btn.getAttribute('data-name') + '] 템플릿을 삭제할까요?\n이미 가져간 치과의 복사본은 영향받지 않습니다.', function() {
              callAPI('/admin/templates/' + btn.getAttribute('data-id'), { method: 'DELETE' })
              .then(function() { toast('삭제되었습니다.'); pgGlobal(el); })
              .catch(function(e) { toast(e.message, 'error'); });
            });
          });
        });
      }

      el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
        + '<div><div style="font-size:18px;font-weight:700;color:#1f2937">쿠폰 템플릿</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-top:2px">모든 치과에서 가져갈 수 있는 공용 템플릿입니다</div></div>'
        + '<button id="dpt-gl-add" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ 새 쿠폰 템플릿</button>'
        + '</div>'
        + '<div style="' + CARD + '"><div id="dpt-gl-list"></div></div>'
        + '</div>';

      renderList();
      document.getElementById('dpt-gl-add').addEventListener('click', function() { showGlobalTemplateModal(null, el); });
    }).catch(function(e) { el.innerHTML = '<p style="padding:20px;color:#ef4444;font-size:13px;text-align:center">' + e.message + '</p>'; });
  }

  /* 글로벌 템플릿 생성/수정 모달 - showTemplateModal과 동일, URL 입력만 제거 */
  function showGlobalTemplateModal(tpl, parentEl) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px;overflow-y:auto';
    var IS2 = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:10px';
    var LBL2 = 'display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:420px;margin:auto">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 18px">쿠폰 템플릿 ' + (tpl ? '수정' : '추가') + '</h3>'
      + '<label style="' + LBL2 + '">쿠폰 이름 <span style="color:#ef4444">*</span></label>'
      + '<input id="dpt-gl-name" type="text" placeholder="예: 스케일링 무료 사용권" value="' + (tpl ? escH(tpl.name||'') : '') + '" style="' + IS2 + '">'
      + '<label style="' + LBL2 + '">발행 비용 포인트 <span style="font-size:11px;color:#9ca3af;font-weight:400">(쿠폰 발행 시 차감할 포인트 · 0 = 무료 발행)</span></label>'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">'
      + '<input id="dpt-gl-required" type="number" min="0" step="100" placeholder="0 = 무료 발행" value="' + (tpl ? (tpl.required_points||0) : 0) + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit">'
      + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P 차감</span></div>'
      + '<label style="' + LBL2 + '">유효 기간 (일)</label>'
      + '<input id="dpt-gl-days" type="number" placeholder="365" value="' + (tpl ? (tpl.valid_days||365) : 365) + '" style="' + IS2 + '">'
      + '<label style="' + LBL2 + '">쿠폰 이미지 URL <span style="font-size:11px;color:#9ca3af;font-weight:400">(선택)</span></label>'
      + '<input id="dpt-gl-imgurl" type="text" placeholder="https://..." value="' + (tpl ? escH(tpl.image_url||'') : '') + '" disabled style="' + IS2 + ';background:#f3f4f6;color:#9ca3af;cursor:not-allowed">'
      + '<div style="border-top:1px solid #d1d5db;margin:12px 0 14px"></div>'
      + '<label style="' + LBL2 + '">쿠폰 유형</label>'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:14px;padding:12px 14px;border:2px solid #fde68a;border-radius:10px;background:#fffbeb;transition:all .15s">'
      + '<input type="checkbox" id="dpt-gl-bday" ' + (tpl && tpl.is_birthday ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:#d97706;flex-shrink:0">'
      + '<div><span style="font-size:13px;font-weight:700;color:#92400e">생일 쿠폰으로 지정</span>'
      + '<p style="font-size:11px;font-weight:400;color:#a16207;margin:2px 0 0">체크하면 생일 환자에게 포인트 없이도 발행 가능합니다</p>'
      + '<p style="font-size:11px;font-weight:400;color:#6b7280;margin:2px 0 0">체크하지 않으면 일반쿠폰으로 분류됩니다</p></div>'
      + '</label>'
      + '<label style="' + LBL2 + '">자동 발행 규칙 <span style="font-size:11px;color:#9ca3af;font-weight:400">(선택 · 복수 설정 가능)</span></label>'
      + '<p style="font-size:11px;color:#6b7280;margin:-2px 0 10px;line-height:1.5">설정한 포인트를 달성하면 이 쿠폰이 자동 생성됩니다.</p>'
      + '<div id="dpt-gl-rule-list"></div>'
      + '<button type="button" id="dpt-gl-rule-add" style="font-size:13px;color:#2563eb;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;margin-bottom:14px">+ 규칙 추가</button>'
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button id="dpt-gl-cancel" style="flex:1;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
      + '<button id="dpt-gl-save" style="flex:1;padding:11px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">저장</button>'
      + '</div></div>';
    document.body.appendChild(m);
    m.querySelector('#dpt-gl-cancel').addEventListener('click', function() { m.remove(); });
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

    /* 규칙 행 */
    function glRuleRow(pts) {
      return '<div class="dpt-gl-rule-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<input type="number" class="dpt-gl-rule-pts" min="1" placeholder="예: 100000" value="' + (pts||'') + '" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit">'
        + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P 이상</span>'
        + '<button type="button" class="dpt-gl-rule-del" style="padding:4px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:12px;cursor:pointer;font-family:inherit">삭제</button>'
        + '</div>';
    }
    m.querySelector('#dpt-gl-rule-list').addEventListener('click', function(e) {
      if (e.target.classList.contains('dpt-gl-rule-del')) e.target.closest('.dpt-gl-rule-row').remove();
    });
    m.querySelector('#dpt-gl-rule-add').addEventListener('click', function() {
      var list = m.querySelector('#dpt-gl-rule-list');
      var div = document.createElement('div');
      div.innerHTML = glRuleRow('');
      list.appendChild(div.firstChild);
    });

    m.querySelector('#dpt-gl-save').addEventListener('click', function() {
      var name = m.querySelector('#dpt-gl-name').value.trim();
      if (!name) { toast('쿠폰 이름을 입력하세요.', 'error'); return; }
      var btn = m.querySelector('#dpt-gl-save');
      btn.textContent = '저장 중...'; btn.disabled = true;
      var body = {
        name: name,
        discount_type: (tpl ? tpl.discount_type : null) || 'fixed',
        discount_value: (tpl && tpl.discount_value != null) ? tpl.discount_value : 0,
        valid_days: parseInt(m.querySelector('#dpt-gl-days').value) || 90,
        required_points: parseInt(m.querySelector('#dpt-gl-required').value) || 0,
        is_birthday: m.querySelector('#dpt-gl-bday').checked ? 1 : 0,
        coupon_kind: m.querySelector('#dpt-gl-bday').checked ? 'birthday' : 'general',
        status: 'active'
      };
      var url = tpl ? '/admin/templates/' + tpl.id : '/admin/templates';
      var method = tpl ? 'PUT' : 'POST';
      callAPI(url, { method: method, body: JSON.stringify(body) })
      .then(function() { toast(tpl ? '수정되었습니다.' : '등록되었습니다.'); m.remove(); pgGlobal(parentEl); })
      .catch(function(e) { toast(e.message, 'error'); btn.textContent = '저장'; btn.disabled = false; });
    });
  }

  /* ==================== 환자 UI ==================== */
  function renderPatient() {
    var cn = CN();
    root.innerHTML = '<div class="dpt-app-loaded" id="dpt-app" style="font-family:Noto Sans KR,sans-serif">'
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-size:16px;font-weight:700">' + escH(cn) + '</div><div style="font-size:12px;opacity:.8;margin-top:2px">' + escH(authMember.name || '') + '님</div></div>'
      + '<button id="dpt-plo" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:5px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit">로그아웃</button></div>'
      + '<div style="background:#f9fafb;padding:16px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">'
      + '<div style="display:flex;gap:0;background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:16px;overflow:hidden">'
      + '<button class="dpt-pt" data-t="points" style="flex:1;padding:10px;border:none;background:none;font-size:12px;font-weight:600;cursor:pointer;border-bottom:2px solid #2563eb;color:#2563eb;font-family:inherit">포인트</button>'
      + '<button class="dpt-pt" data-t="coupons" style="flex:1;padding:10px;border:none;background:none;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;color:#6b7280;font-family:inherit">쿠폰함</button>'
      + '<button class="dpt-pt" data-t="history" style="flex:1;padding:10px;border:none;background:none;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;color:#6b7280;font-family:inherit">결제내역</button></div>'
      + '<div id="dpt-pbal-area"><p style="font-size:28px;font-weight:700;color:#2563eb;text-align:center;margin:16px 0" id="dpt-pbal">...</p></div>'
      + '<div id="dpt-pc"></div></div></div>';
    document.getElementById('dpt-plo').addEventListener('click', function() {
      authToken = ''; authMember = null;
      root.innerHTML = '<div style="padding:20px;text-align:center"><p style="color:#2563eb;font-weight:600;font-size:14px">로그아웃 되었습니다.</p></div>';
    });
    callAPI('/points/balance?clinic_id=' + CID() + '&patient_id=' + authMember.id)
    .then(function(b) { document.getElementById('dpt-pbal') && (document.getElementById('dpt-pbal').textContent = F(b.available_points) + ' P'); }).catch(function(){});
    var ptab = 'points';
    function loadTab(t) {
      ptab = t;
      document.querySelectorAll('.dpt-pt').forEach(function(b) {
        var a = b.getAttribute('data-t') === t;
        b.style.borderBottomColor = a ? '#2563eb' : 'transparent';
        b.style.color = a ? '#2563eb' : '#6b7280';
        b.style.fontWeight = a ? '600' : '400';
      });
      var c = document.getElementById('dpt-pc');
      c.innerHTML = SPIN_HTML;
      if (t === 'points') {
        callAPI('/points/history?clinic_id=' + CID() + '&patient_id=' + authMember.id + '&limit=50')
        .then(function(d) { var l = d.logs || []; c.innerHTML = l.length === 0 ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">내역 없음</p>' : l.map(function(x) { return '<div style="background:#fff;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e5e7eb"><div><p style="font-size:13px;font-weight:500;color:#1f2937;margin:0">' + escH(x.description||x.type) + '</p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + escH(x.created_at ? x.created_at.split('T')[0] : '') + '</p></div><div style="text-align:right"><p style="font-size:13px;font-weight:700;margin:0;color:' + (x.amount > 0 ? '#2563eb' : '#ef4444') + '">' + (x.amount > 0 ? '+' : '') + F(x.amount) + ' P</p></div></div>'; }).join(''); }).catch(function(e) { c.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;font-size:13px">' + escH(e.message) + '</p>'; });
      } else if (t === 'coupons') {
        callAPI('/coupons/my?clinic_id=' + CID() + '&patient_id=' + authMember.id + '&status=active')
        .then(function(d) { var l = d.coupons || []; c.innerHTML = l.length === 0 ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">쿠폰 없음</p>' : l.map(function(x) { return '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #e5e7eb"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:600;color:#2563eb;font-family:monospace">' + escH(x.code) + '</span></div><p style="font-size:14px;font-weight:600;color:#1f2937;margin:8px 0 0">' + escH(x.template_name) + '</p><div style="display:flex;justify-content:space-between;margin-top:10px"><span style="font-size:11px;color:#9ca3af">~' + escH(x.expires_at) + '</span></div></div>'; }).join(''); }).catch(function(e) { c.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;font-size:13px">' + escH(e.message) + '</p>'; });
      } else {
        callAPI('/payments?clinic_id=' + CID() + '&patient_id=' + authMember.id + '&limit=50')
        .then(function(d) { var l = d.payments || []; c.innerHTML = l.length === 0 ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">내역 없음</p>' : l.map(function(x) { return '<div style="background:#fff;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e5e7eb"><div><p style="font-size:13px;font-weight:500;color:#1f2937;margin:0">' + escH(x.category) + '</p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + escH(x.payment_date) + '</p></div><div style="text-align:right"><p style="font-size:13px;font-weight:700;color:#1f2937;margin:0">' + F(x.amount) + '원</p><p style="font-size:11px;color:#2563eb;margin:2px 0 0">+' + F(x.point_earned) + 'P</p></div></div>'; }).join(''); }).catch(function(e) { c.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;font-size:13px">' + escH(e.message) + '</p>'; });
      }
    }
    loadTab('points');
    document.querySelectorAll('.dpt-pt').forEach(function(b) { b.addEventListener('click', function() { loadTab(b.getAttribute('data-t')); }); });
  }

})();
