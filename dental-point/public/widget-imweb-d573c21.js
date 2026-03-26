(function(){
  /* v4.9.41 - 아임웹 그룹 기반 클리닉 공유: 같은 그룹 계정은 같은 클리닉 데이터 공유 */

  var API = 'https://dental-point.pages.dev';
  /* 전역 상태 - pgSet과 showTemplateModal 간 공유 */
  var _autoRules = [];

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
    st.textContent = '@keyframes dptSpin{to{transform:rotate(360deg)}}@keyframes dptFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(st);
  }

  var debugLog = [];
  function dlog(msg) { debugLog.push('[' + new Date().toISOString().substr(11,8) + '] ' + msg); try { console.log('DPT: ' + msg); } catch(e){} }

  function spin(msg) {
    root.innerHTML = '<div style="padding:20px;text-align:center"><div style="display:inline-block;width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:dptSpin .7s linear infinite"></div><p style="font-size:13px;color:#9ca3af;margin:8px 0 0">' + (msg||'확인 중...') + '</p></div>';
  }

  function errUI(msg) {
    root.innerHTML = '<div style="padding:20px;background:#fff;border-radius:12px;border:1px solid #fee2e2">'
      + '<p style="font-size:13px;color:#ef4444;margin:0 0 8px">' + msg + '</p>'
      + '<button onclick="location.reload()" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;font-family:inherit">새로고침</button>'
      + '<details style="margin-top:8px"><summary style="font-size:11px;color:#9ca3af;cursor:pointer">디버그 로그</summary>'
      + '<pre style="font-size:9px;color:#6b7280;background:#f9fafb;padding:8px;border-radius:6px;margin-top:4px;white-space:pre-wrap;max-height:200px;overflow-y:auto">' + debugLog.join('\n') + '</pre></details></div>';
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
    '아임웹 사용자','관리','admin','Admin','포인트','쿠폰','쿠폰관리','설정','대시보드','브랜드관리',
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
  dlog('위젯시작 v4.9.21');

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

  /* ===== 3.6단계: 아임웹 그룹 감지 ===== */
  /* 아임웹에서 같은 치과 소속 계정들을 그룹으로 묶을 수 있음 */
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
  function CID() { return currentClinic && currentClinic.id || 0; }
  function CN() { return currentClinic && currentClinic.name || '치과'; }
  function toast(msg, type) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:dptFadeIn .3s ease;font-family:Noto Sans KR,sans-serif';
    d.style.background = type === 'error' ? '#ef4444' : '#2563eb';
    d.textContent = msg; document.body.appendChild(d);
    setTimeout(function() { d.remove(); }, 3000);
  }
  var SPIN_HTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px"><span style="display:inline-block;width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:dptSpin .6s linear infinite"></span></div>';

  function callAPI(path, opts) {
    opts = opts || {};
    var hd = { 'Content-Type': 'application/json' };
    if (authToken) hd['Authorization'] = 'Bearer ' + authToken;
    var fo = { method: opts.method || 'GET', headers: Object.assign(hd, opts.headers || {}) };
    if (opts.body) fo.body = opts.body;
    return fetch(API + '/api' + path, fo)
      .then(function(r) {
        return r.json().then(function(data) {
          if (!r.ok) throw new Error(data.error || '서버오류(' + r.status + ')');
          return data;
        });
      });
  }

  function showConfirmModal(title, msg, onOk) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:380px">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 8px">' + title + '</h3>'
      + '<p style="font-size:13px;color:#6b7280;margin:0 0 20px">' + msg + '</p>'
      + '<div style="display:flex;gap:8px"><button id="dpt-cfm-cc" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button><button id="dpt-cfm-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">확인</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    document.getElementById('dpt-cfm-cc').addEventListener('click', function() { m.remove(); });
    document.getElementById('dpt-cfm-ok').addEventListener('click', function() { m.remove(); onOk(); });
  }

  /* ==================== 관리자 UI ==================== */
  function renderAdmin() {
    var cn = CN();
    var mn = authMember.name || cn; /* 닉네임(member.name) */
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
    var nav = document.getElementById('dpt-nav');
    tabs.forEach(function(t) {
      var b = document.createElement('button');
      b.className = 'dpt-nb'; b.setAttribute('data-p', t[0]);
      b.style.cssText = 'display:inline-block;padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap';
      b.textContent = t[1];
      b.addEventListener('click', function() { currentPage = t[0]; renderPage(); });
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

  function renderPage() {
    updNav();
    var pg = document.getElementById('dpt-pg');
    if (!pg) return;
    var pages = { dashboard: pgDash, payment: pgPay, patients: pgPat, coupons: pgCpn, bulk: pgBulk, dentweb: pgDentweb, settings: pgSet };
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
        var maxShow = 3;
        var showList = birthdays.slice(0, maxShow);
        var hiddenCount = birthdays.length - maxShow;
        bdHtml = '<div style="background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;margin-bottom:14px;overflow:hidden">'
          + '<div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #bfdbfe">'
          + '<span style="font-size:14px;font-weight:700;color:#1d4ed8">오늘 생일 환자</span>'
          + '<span style="font-size:11px;color:#2563eb;background:#dbeafe;border-radius:20px;padding:2px 8px;font-weight:600">' + birthdays.length + '명</span>'
          + '<span style="font-size:11px;color:#93c5fd;margin-left:auto">' + todayStr + '</span></div>'
          + '<div>' + showList.map(function(p) {
            var age = p.birth_date ? (new Date().getFullYear() - parseInt(p.birth_date.slice(0,4))) + '세' : '';
            var hasIssued = false;
            var issuedName = '';
            if (p.all_coupons) {
              var cArr = p.all_coupons.split('||');
              var currentYear = new Date().getFullYear().toString();
              for (var i=0; i<cArr.length; i++) {
                var parts = cArr[i].split('::');
                var cname = parts[0] || '';
                var cstatus = parts[1] || '';
                var isBday = parts[2] || '0';
                var cdate = parts[3] || '';
                if ((isBday === '1' || cname.indexOf('생일') !== -1) && cdate.indexOf(currentYear) === 0) {
                  hasIssued = true;
                  issuedName = cname;
                  break;
                }
              }
            }
            
            var actionHtml = hasIssued 
              ? '<span style="margin-top:4px;padding:3px 8px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:11px;font-weight:600;display:inline-block;white-space:normal;word-break:keep-all;">발행완료: ' + issuedName + '</span>'
              : '<button class="dpt-bd-coupon" data-id="' + p.id + '" data-name="' + p.name + '" style="margin-top:4px;padding:3px 10px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">쿠폰발행</button>';
            
            return '<div style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dbeafe">'
              + '<div><p style="font-size:13px;font-weight:600;color:#1f2937;margin:0">' + p.name + (age ? ' <span style="font-size:11px;color:#93c5fd;font-weight:400">(' + age + ')</span>' : '') + '</p>'
              + '<p style="font-size:11px;color:#9ca3af;margin:1px 0 0">' + (p.phone || '-') + (p.chart_number ? ' · ' + p.chart_number : '') + '</p></div>'
              + '<div style="text-align:right;max-width:50%;">'
              + '<p style="font-size:12px;font-weight:600;color:#2563eb;margin:0">' + F(p.available_points) + 'P</p>'
              + actionHtml
              + '</div></div>';
          }).join('')
          + (hiddenCount > 0 ? '<div style="padding:8px 16px;text-align:center;font-size:12px;color:#2563eb;background:#eff6ff;cursor:pointer" onclick="document.getElementById(\'dpt-tab-patients\').click ? document.getElementById(\'dpt-tab-patients\').click() : null">+ ' + hiddenCount + '명 더 보기 (환자관리에서 확인)</div>' : '')
          + '</div></div>';
      }

      el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<span style="font-size:18px;font-weight:700;color:#1f2937">대시보드</span>'
        + '<span style="font-size:12px;color:#9ca3af">' + new Date().toLocaleDateString('ko-KR') + '</span></div>'
        + '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
        + '<button id="dpt-dash-issue" style="flex:1;min-width:100px;padding:10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">쿠폰 발행</button>'
        + '<button id="dpt-dash-point" style="flex:1;min-width:100px;padding:10px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151">포인트 적립</button></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">'
        + card('오늘 결제', F(d.today && d.today.payment_amount) + '원', d.today && d.today.payment_count + '건', '#1f2937')
        + card('오늘 적립', F(d.today && d.today.point_earned) + 'P', '', '#2563eb')
        + card('전체 환자', F(d.total_patients) + '명', '', '#1f2937')
        + card('활성 쿠폰', (d.active_coupons || 0) + '장', '', '#1f2937')
        + '</div>'
        + bdHtml
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
        + '<div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#1f2937">최근 결제</div>'
        + '<div>' + ((d.recent_payments && d.recent_payments.length > 0) ? d.recent_payments.slice(0,5).map(function(p) {
          return '<div style="padding:10px 16px;display:flex;justify-content:space-between;border-bottom:1px solid #f9fafb">'
            + '<div><p style="font-size:13px;font-weight:500;color:#1f2937;margin:0">' + p.patient_name + ' <span style="font-size:11px;font-weight:400;color:#6b7280">(총 ' + F(p.available_points) + 'P)</span></p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + p.category + ' · ' + p.payment_date + '</p></div>'
            + '<div style="text-align:right"><p style="font-size:13px;font-weight:600;color:#1f2937;margin:0">' + F(p.amount) + '원</p><p style="font-size:11px;color:#2563eb;margin:2px 0 0">+' + F(p.point_earned) + 'P</p></div></div>';
        }).join('') : '<p style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">결제 내역 없음</p>') + '</div></div></div>';

      document.getElementById('dpt-dash-issue') && document.getElementById('dpt-dash-issue').addEventListener('click', function() { currentPage = 'patients'; renderPage(); });
      document.getElementById('dpt-dash-point') && document.getElementById('dpt-dash-point').addEventListener('click', function() { currentPage = 'payment'; renderPage(); });
      /* 생일 환자 쿠폰 발행 버튼 */
      document.querySelectorAll('.dpt-bd-coupon').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showCouponIssueModal(btn.getAttribute('data-id'), btn.getAttribute('data-name'));
        });
      });
    }).catch(function(e) { el.innerHTML = '<p style="padding:20px;color:#ef4444;text-align:center;font-size:13px">' + e.message + '</p>'; });
  }
  function card(lb, v, sub, c) {
    return '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #f3f4f6"><p style="font-size:12px;color:#9ca3af;margin:0 0 4px">' + lb + '</p><p style="font-size:18px;font-weight:700;color:' + c + ';margin:0">' + v + '</p>' + (sub ? '<p style="font-size:11px;color:#9ca3af;margin:3px 0 0">' + sub + '</p>' : '') + '</div>';
  }
  function cardH(lb, v, sub, c) {
    return '<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #f3f4f6"><p style="font-size:10px;color:#9ca3af;margin:0 0 4px">' + lb + '</p><p style="font-size:15px;font-weight:700;color:' + c + ';margin:0">' + v + '</p>' + (sub ? '<p style="font-size:10px;color:#9ca3af;margin:2px 0 0">' + sub + '</p>' : '') + '</div>';
  }

  /* --- 결제등록 --- */
  function pgPay(el) {
    el.innerHTML = SPIN_HTML;
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
      var IS = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;';
      el.innerHTML = '<div style="animation:dptFadeIn .3s ease"><div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">포인트 적립</div>'
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
        + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">환자 선택</label>'
        + '<div style="display:flex;gap:8px;margin-bottom:8px;"><input id="dpt-pay-pat-search" type="text" placeholder="이름 또는 전화번호 검색" style="' + IS + '"><button id="dpt-pay-pat-btn" style="padding:10px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">검색</button></div>'
        + '<select id="dpt-pay-pat" style="' + IS + '"><option value="">-- 환자 선택 --</option>'
        + patients.map(function(p) { return '<option value="' + p.id + '">' + p.name + ' (' + p.phone + ') ' + F(p.available_points) + 'P</option>'; }).join('') + '</select></div>'
        + '<div id="dpt-new-pat-toggle" style="margin-bottom:12px;font-size:13px;color:#2563eb;cursor:pointer">+ 신규 환자 등록</div>'
        + '<div id="dpt-new-pat-form" style="display:none;background:#f0f7ff;border-radius:8px;padding:12px;margin-bottom:12px">'
        + '<div style="margin-bottom:8px"><label style="font-size:12px;color:#374151;display:block;margin-bottom:3px">이름</label><input id="dpt-np-name" type="text" placeholder="홍길동" style="' + IS + '" /></div>'
        + '<div style="margin-bottom:8px"><label style="font-size:12px;color:#374151;display:block;margin-bottom:3px">전화번호</label><input id="dpt-np-phone" type="tel" placeholder="010-0000-0000" style="' + IS + '" /></div>'
        + '<button id="dpt-np-save" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;cursor:pointer;font-family:inherit">등록</button></div>'
        + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">금액</label>'
        + '<input id="dpt-pay-amt" type="text" inputmode="numeric" placeholder="0" style="' + IS + '" /></div>'
        + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">진료 카테고리</label>'
        + '<select id="dpt-pay-cat" style="' + IS + '">' + cats.map(function(c) { return '<option value="' + c.name + '">' + c.name + ' (' + c.rate + '%)</option>'; }).join('') + '</select></div>'
        + '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">결제일</label>'
        + '<input id="dpt-pay-date" type="date" value="' + new Date().toISOString().split('T')[0] + '" style="' + IS + '" /></div>'
        + '<div id="dpt-pay-preview" style="background:#f0f7ff;border-radius:8px;padding:12px;margin-bottom:12px;display:none">'
        + '<p style="font-size:13px;font-weight:600;color:#1d4ed8;margin:0">예상 적립 포인트: <span id="dpt-pay-pts">0</span> P</p></div>'
        + '<button id="dpt-pay-submit" style="width:100%;padding:12px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">포인트 적립</button></div></div>';

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
          toast('결제 내역 및 포인트가 적립되었습니다.'); 
          var sel = document.getElementById('dpt-pay-pat');
          if(sel && sel.selectedIndex >= 0) {
            var patName = sel.options[sel.selectedIndex].text.split('(')[0].trim();
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
    var currentQ = globalPatQ;
    globalPatQ = ''; // reset after consuming
    var birthdayMode = false;  /* 생일 필터 모드 */

    el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div style="font-size:18px;font-weight:700;color:#1f2937">환자 관리 <span id="dpt-pat-cnt" style="font-size:14px;font-weight:400;color:#6b7280"></span></div><button id="dpt-pat-delete-all" style="padding:6px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">전체 환자 삭제</button>'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:4px">'
      + '<input id="dpt-pat-q" type="text" placeholder="이름, 전화번호, 차트번호 검색" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;font-family:inherit" />'
      + '<button id="dpt-pat-search" style="padding:10px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">검색</button>'
      + '<button id="dpt-pat-birthday" style="padding:10px 14px;border-radius:8px;border:1px solid #bfdbfe;background:#fff;color:#2563eb;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">생일</button>'
      + '</div>'
      + '<p id="dpt-pat-filter-note" style="font-size:12px;color:#9ca3af;margin:0 0 10px;padding-left:2px">기본: 포인트 보유 환자만 표시 · 검색 시 전체 조회</p>'
      + '<div id="dpt-pat-result">' + SPIN_HTML + '</div></div>';

    function renderTable(pts, meta) {
      var TH = 'padding:10px 12px;font-size:12px;font-weight:600;color:#6b7280;text-align:left;white-space:nowrap;border-bottom:1px solid #e5e7eb;background:#f9fafb;';
      var TD = 'padding:10px 12px;font-size:13px;color:#1f2937;border-bottom:1px solid #f3f4f6;vertical-align:middle;';

      var html = '';

      if (pts.length === 0) {
        html += '<p style="text-align:center;padding:30px;color:#9ca3af;font-size:13px">'
          + (meta.has_point_filter ? '포인트 보유 환자가 없습니다. 검색으로 전체 환자를 조회하세요.' : '검색 결과가 없습니다.')
          + '</p>';
      } else {
        html += '<div style="overflow-x:auto;border-radius:10px;border:1px solid #e5e7eb">'
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
          var todayMD = new Date().toISOString().split('T')[0].slice(5);
          var isBirthday = p.birth_date && p.birth_date.length >= 7 && p.birth_date.slice(5,10) === todayMD;
          var nameCell = p.name + (isBirthday ? ' <span style="font-size:10px;color:#2563eb;background:#dbeafe;border-radius:4px;padding:1px 5px;font-weight:600;vertical-align:middle">생일</span>' : '');
          html += '<tr style="transition:background .15s;' + (isBirthday ? 'background:#fff7fc' : '') + '" data-patid="' + p.id + '" onmouseover="this.style.background=\'#f8faff\'" onmouseout="this.style.background=\'' + (isBirthday ? '#fff7fc' : '') + '\'">'
            + '<td style="' + TD + 'color:#6b7280;font-size:12px">' + chartNo + '</td>'
            + '<td style="' + TD + 'font-weight:500">' + nameCell + '</td>'
            + '<td style="' + TD + '">' + birth + '</td>'
            + '<td style="' + TD + '">' + (p.phone||'-') + '</td>'
            + '<td style="' + TD + '">' + treatment + '</td>'
            + '<td style="' + TD + 'text-align:right">' + payStr + '</td>'
            + '<td style="' + TD + 'text-align:right;font-weight:700;color:' + ptsColor + '" class="dpt-pts-cell">' + F(pts_val) + 'P</td>'
            + '<td style="' + TD + 'text-align:center" class="dpt-cpn-cell">' 
            + '<div style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;">' 
            + '<button class="dpt-cpn-btn" data-id="' + p.id + '" data-name="' + p.name + '" style="padding:4px 10px;border-radius:6px;border:none;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">발행</button>' 
            + '<div style="position:relative;" class="dpt-dropdown-container">'
            + '<button class="dpt-cpn-toggle" style="padding:4px 8px;background:#f9fafb;border:1px solid #e5e7eb;color:#4b5563;border-radius:4px;font-size:11px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;">'
            + '보유 쿠폰 <span style="background:#dbeafe;color:#2563eb;padding:1px 4px;border-radius:99px;font-size:10px;line-height:1;">' + (p.all_coupons ? p.all_coupons.split('||').filter(function(x){return x.includes('::active');}).length : 0) + '</span>'
            + '<svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>'
            + '</button>'
            + '<div class="dpt-dropdown-menu" style="display:none;position:absolute;z-index:10;margin-top:4px;width:max-content;min-width:120px;max-width:200px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);padding:8px;text-align:left;">'
            + (p.all_coupons ? p.all_coupons.split('||').map(function(cn) {
              var parts = cn.split('::');
              var cname = parts[0];
              var cstatus = parts[1] || 'active';
              var bg = cstatus === 'active' ? '#eff6ff' : '#f3f4f6';
              var fg = cstatus === 'active' ? '#2563eb' : '#6b7280';
              var lbl = cstatus === 'active' ? '사용가능' : (cstatus === 'used' ? '사용완료' : '만료');
              var c_id = parts[4] || '';
              return '<div style="font-size:11px;font-weight:500;color:'+fg+';background:'+bg+';padding:4px 8px;border-radius:4px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;justify-content:space-between;align-items:center;" title="' + cname + '"><span>' + cname + '</span><div style="display:flex;align-items:center;gap:4px;"><span style="font-size:9px;background:#fff;padding:1px 4px;border-radius:4px;margin-left:6px">' + lbl + '</span>' + (cstatus === 'active' && c_id ? '<button class="dpt-del-coupon" data-cid="'+c_id+'" data-cname="'+cname+'" style="background:none;border:none;color:#ef4444;font-size:10px;cursor:pointer;padding:0 2px;">×</button>' : '') + '</div></div>';
            }).join('') : '<div style="font-size:11px;color:#9ca3af;text-align:center;padding:4px 0;">보유 쿠폰 없음</div>')
            + '</div></div>' 
            + '</div></td>'
            + '<td style="' + TD + 'text-align:center;white-space:nowrap">'
            + '<button class="dpt-pat-edit" data-id="' + p.id + '" style="padding:4px 10px;border-radius:6px;border:none;background:#f3f4f6;color:#374151;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">수정</button>'
            + '<button class="dpt-pat-del" data-id="' + p.id + '" data-name="' + p.name + '" style="padding:4px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit">삭제</button>'
            + '</td></tr>';
        });
        html += '</tbody></table></div>';
        setTimeout(function() {
            var delBtns = el.querySelectorAll('.dpt-del-coupon');
            delBtns.forEach(function(btn) {
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var cid = this.dataset.cid;
                var cname = this.dataset.cname;
                if (!confirm('[' + cname + '] 쿠폰을 삭제하시겠습니까?')) return;
                callAPI('/coupons/' + cid, { method: 'DELETE' })
                  .then(function() {
                    toast('쿠폰이 삭제되었습니다.');
                    if (typeof loadPat === 'function') loadPat('', window.dptCurrentPage || 1);
                  })
                  .catch(function(err) {
                    toast(err.message, 'error');
                  });
              });
            });

            var toggles = el.querySelectorAll('.dpt-cpn-toggle');
            toggles.forEach(function(toggle) {
                toggle.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var menu = this.nextElementSibling;
                    var isHidden = menu.style.display === 'none';
                    el.querySelectorAll('.dpt-dropdown-menu').forEach(function(m) { m.style.display = 'none'; });
                    if (isHidden) menu.style.display = 'block';
                });
            });
            document.addEventListener('click', function() {
                el.querySelectorAll('.dpt-dropdown-menu').forEach(function(m) { m.style.display = 'none'; });
            });
        }, 50);

      }

      // 페이지네이션
      if (meta.total_pages > 1) {
        var pg = meta.page, tp = meta.total_pages;
        var pgHtml = '<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-top:14px;flex-wrap:wrap">';
        // 이전
        pgHtml += '<button class="dpt-pg-btn" data-page="' + (pg-1) + '" ' + (pg<=1?'disabled':'') + ' style="padding:6px 12px;border-radius:6px;border:1px solid #d1d5db;background:' + (pg<=1?'#f9fafb':'#fff') + ';color:' + (pg<=1?'#9ca3af':'#374151') + ';font-size:13px;cursor:' + (pg<=1?'default':'pointer') + ';font-family:inherit">‹</button>';
        // 페이지 번호 (최대 5개 표시)
        var startP = Math.max(1, pg-2), endP = Math.min(tp, startP+4);
        if (endP - startP < 4) startP = Math.max(1, endP-4);
        for (var i = startP; i <= endP; i++) {
          var isActive = i === pg;
          pgHtml += '<button class="dpt-pg-btn" data-page="' + i + '" style="padding:6px 12px;border-radius:6px;border:1px solid ' + (isActive?'#2563eb':'#d1d5db') + ';background:' + (isActive?'#2563eb':'#fff') + ';color:' + (isActive?'#fff':'#374151') + ';font-size:13px;cursor:pointer;font-weight:' + (isActive?'700':'400') + ';font-family:inherit">' + i + '</button>';
        }
        // 다음
        pgHtml += '<button class="dpt-pg-btn" data-page="' + (pg+1) + '" ' + (pg>=tp?'disabled':'') + ' style="padding:6px 12px;border-radius:6px;border:1px solid #d1d5db;background:' + (pg>=tp?'#f9fafb':'#fff') + ';color:' + (pg>=tp?'#9ca3af':'#374151') + ';font-size:13px;cursor:' + (pg>=tp?'default':'pointer') + ';font-family:inherit">›</button>';
        pgHtml += '<span style="font-size:12px;color:#9ca3af;margin-left:4px">' + pg + ' / ' + tp + '페이지</span>';
        pgHtml += '</div>';
        html += pgHtml;
      }
      return html;
    }

    function bindTableEvents() {
      document.querySelectorAll('.dpt-cpn-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { showCouponIssueModal(btn.getAttribute('data-id'), btn.getAttribute('data-name')); });
      });
      document.querySelectorAll('.dpt-pat-edit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showPatEditModal(btn.getAttribute('data-id'), function() { loadPat(currentQ, currentPage); });
        });
      });
      document.querySelectorAll('.dpt-pat-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showConfirmModal('환자 삭제', '"' + btn.getAttribute('data-name') + '" 환자를 삭제할까요?', function() {
            callAPI('/clinics/' + CID() + '/patients/' + btn.getAttribute('data-id'), { method: 'DELETE' })
            .then(function() { toast('삭제되었습니다.'); loadPat(currentQ, currentPage); })
            .catch(function(e) { toast(e.message, 'error'); });
          });
        });
      });
      document.querySelectorAll('.dpt-pg-btn').forEach(function(btn) {
        if (btn.disabled) return;
        btn.addEventListener('click', function() {
          var pg = parseInt(btn.getAttribute('data-page'));
          if (!isNaN(pg) && pg >= 1) { currentPage = pg; loadPat(currentQ, currentPage); }
        });
      });
    }

    function loadPat(q, page) {
      document.getElementById('dpt-pat-result').innerHTML = SPIN_HTML;
      var url = '/clinics/' + CID() + '/patients?page=' + page;
      if (birthdayMode) {
        url += '&birthday=today';
      } else if (q) {
        url += '&search=' + encodeURIComponent(q);
      }
      callAPI(url).then(function(d) {
        var pts = d.patients || [];
        var meta = { total: d.total||0, page: d.page||1, total_pages: d.total_pages||1, has_point_filter: d.has_point_filter };
        var cntEl = document.getElementById('dpt-pat-cnt');
        if (cntEl) {
          var label = birthdayMode ? '오늘 생일 ' + meta.total + '명'
            : (meta.has_point_filter ? '포인트 보유 ' + meta.total + '명' : '검색결과 ' + meta.total + '명');
          cntEl.textContent = '[' + label + ']';
        }
        /* 생일 모드일 때 필터 노트 업데이트 */
        var noteEl = document.getElementById('dpt-pat-filter-note');
        if (noteEl) {
          noteEl.textContent = birthdayMode
            ? '오늘 생일인 환자 목록입니다'
            : '기본: 포인트 보유 환자만 표시 · 검색 시 전체 조회';
          noteEl.style.color = birthdayMode ? '#2563eb' : '#9ca3af';
        }
        /* 생일 버튼 스타일 업데이트 */
        var bdBtn = document.getElementById('dpt-pat-birthday');
        if (bdBtn) {
          bdBtn.style.background = birthdayMode ? '#eff6ff' : '#fff';
          bdBtn.style.borderColor = birthdayMode ? '#93c5fd' : '#bfdbfe';
          bdBtn.style.fontWeight = birthdayMode ? '700' : '600';
        }
        document.getElementById('dpt-pat-result').innerHTML = renderTable(pts, meta);
        bindTableEvents();
      }).catch(function(e) { document.getElementById('dpt-pat-result').innerHTML = '<p style="color:#ef4444;padding:20px;text-align:center;font-size:13px">' + e.message + '</p>'; });
    }

    loadPat('', 1);
    
    var btnDelAll = document.getElementById('dpt-pat-delete-all');
    if(btnDelAll) {
      btnDelAll.addEventListener('click', function() {
        if(!confirm('정말 현재 치과의 [모든 환자]와 [결제내역/포인트/쿠폰]을 전체 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        btnDelAll.textContent = '삭제 중...';
        btnDelAll.disabled = true;
        callAPI('/clinics/' + CID() + '/patients_all', { method: 'DELETE' })
        .then(function(r) {
          toast(r.message || '전체 환자가 삭제되었습니다.');
          loadPat('', 1);
        })
        .catch(function(e) {
          toast(e.message, 'error');
        })
        .finally(function() {
          btnDelAll.textContent = '전체 환자 삭제';
          btnDelAll.disabled = false;
        });
      });
    }

    document.getElementById('dpt-pat-search').addEventListener('click', function() {
      birthdayMode = false;
      currentQ = document.getElementById('dpt-pat-q').value.trim();
      currentPage = 1;
      loadPat(currentQ, 1);
    });
    document.getElementById('dpt-pat-q').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        birthdayMode = false;
        currentQ = this.value.trim();
        currentPage = 1;
        loadPat(currentQ, 1);
      }
    });
    // 검색어 지우면 자동 초기화
    document.getElementById('dpt-pat-q').addEventListener('input', function() {
      if (this.value === '') { currentQ = ''; birthdayMode = false; currentPage = 1; loadPat('', 1); }
    });
    // 생일 필터 버튼
    document.getElementById('dpt-pat-birthday').addEventListener('click', function() {
      birthdayMode = !birthdayMode;
      if (birthdayMode) { currentQ = ''; document.getElementById('dpt-pat-q').value = ''; }
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
    overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:32px;text-align:center"><div style="font-size:14px;color:#374151">환자 정보 불러오는 중...</div></div>';
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
        + '<div style="border-top:1px solid #f3f4f6;margin:12px 0 14px"></div>'
        + '<div style="background:#f0f7ff;border-radius:10px;padding:12px;margin-bottom:12px">'
        + '<p style="font-size:12px;font-weight:600;color:#6b7280;margin:0 0 6px">포인트 조정</p>'
        + '<p style="font-size:13px;color:#1f2937;margin:0 0 8px">현재 보유: <strong style="color:#2563eb">' + F(avail) + ' P</strong></p>'
        + '<div style="display:flex;gap:8px;align-items:center">'
        + '<select id="dpt-pe-adj-type" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit">'
        + '<option value="adjust_add">+ 추가</option><option value="adjust_sub">- 차감</option><option value="adjust_set">= 직접설정</option>'
        + '</select>'
        + '<input id="dpt-pe-adj-amt" type="number" min="0" placeholder="포인트" style="flex:1;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box">'
        + '<span style="font-size:13px;color:#6b7280;white-space:nowrap">P</span>'
        + '</div>'
        + '<p style="font-size:11px;color:#9ca3af;margin:6px 0 0">빈 칸이면 포인트 변경 없음</p>'
        + '</div>'
        + '<div style="display:flex;gap:8px"><button id="dpt-pe-cancel" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
        + '<button id="dpt-pe-save" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">저장</button></div></div>';
      document.body.appendChild(m);
      document.getElementById('dpt-pe-cancel').addEventListener('click', function() { m.remove(); });
      document.getElementById('dpt-pe-save').addEventListener('click', function() {
        var body = {
          name: document.getElementById('dpt-pe-name').value.trim(),
          phone: document.getElementById('dpt-pe-phone').value.trim(),
          chart_number: document.getElementById('dpt-pe-chart').value.trim(),
          birth_date: document.getElementById('dpt-pe-birth').value.trim(),
          last_treatment: document.getElementById('dpt-pe-treatment').value.trim()
        };
        var adjAmt = document.getElementById('dpt-pe-adj-amt').value.trim();
        var adjType = document.getElementById('dpt-pe-adj-type').value;
        var btn = this; btn.textContent = '저장 중...'; btn.disabled = true;
        var saveInfo = callAPI('/clinics/' + CID() + '/patients/' + pid, { method: 'PUT', body: JSON.stringify(body) });
        if (adjAmt && parseInt(adjAmt) >= 0) {
          var adjVal = parseInt(adjAmt);
          var newTotal;
          if (adjType === 'adjust_set') {
            newTotal = adjVal;
          } else if (adjType === 'adjust_add') {
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
  function showIssuedCouponModal(couponData) {
    var code = couponData.code;
    var tname = couponData.template_name || '';
    var pname = couponData.patient_name || '';
    var expires = couponData.expires_at || '-';
    var dtype = couponData.discount_type;
    var dval = couponData.discount_value;
    var shareUrl = API + '/coupon/' + code + '?v=' + new Date().getTime();
    var qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(shareUrl);

    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px';
    m.innerHTML = '<div style="background:#fff;border-radius:20px;width:100%;max-width:360px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
      /* 상단 헤더 */
      + '<div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:20px;text-align:center;color:#fff">'
      + '<div style="font-size:11px;opacity:.8;margin-bottom:4px;letter-spacing:1px">COUPON ISSUED</div>'
      + '<div style="font-size:22px;font-weight:800;margin-bottom:4px">' + tname + '</div>'
      + '</div>'
      /* QR 코드 */
      + '<div style="padding:20px;text-align:center;border-bottom:1px dashed #e5e7eb">'
      + '<p style="font-size:11px;color:#9ca3af;margin:0 0 12px">QR코드를 스캔하거나 아래 링크를 공유하세요</p>'
      + '<img src="' + qrApiUrl + '" style="width:160px;height:160px;border-radius:8px;border:1px solid #f3f4f6" alt="QR" />'
      + '<p style="font-size:11px;font-family:monospace;font-weight:700;color:#2563eb;margin:10px 0 0;letter-spacing:1px">' + code + '</p>'
      + '</div>'
      /* 환자 정보 */
      + '<div style="padding:14px 20px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between">'
      + '<div style="font-size:12px;color:#9ca3af">수신인</div>'
      + '<div style="font-size:13px;font-weight:600;color:#1f2937">' + pname + '</div>'
      + '</div>'
      + '<div style="padding:8px 20px 14px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between">'
      + '<div style="font-size:12px;color:#9ca3af">유효기간</div>'
      + '<div style="font-size:13px;color:#1f2937">' + expires + '</div>'
      + '</div>'
      /* 공유 버튼 */
      + '<div style="padding:16px 20px;display:flex;flex-direction:column;gap:8px">'
      + '<button id="dpt-ic-copy" style="width:100%;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
      + '링크 복사</button>'
      + '<button id="dpt-ic-close" style="width:100%;padding:10px;border-radius:10px;border:none;background:#f3f4f6;color:#6b7280;font-size:13px;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(m);

    /* 링크 복사 */
    document.getElementById('dpt-ic-copy').addEventListener('click', function() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(function() { toast('링크가 복사되었습니다!'); })
        .catch(function() { fallbackCopy(shareUrl); toast('링크가 복사되었습니다!'); });
      } else { fallbackCopy(shareUrl); toast('링크가 복사되었습니다!'); }
    });

    document.getElementById('dpt-ic-close').addEventListener('click', function() { m.remove(); });
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  }

  /* 쿠폰 즉시 발행 모달 (환자관리에서 호출) */
  function showCouponIssueModal(pid, pname) {
    /* 환자 포인트 + 템플릿 목록 동시 로드 */
    Promise.all([
      callAPI('/coupons/templates?clinic_id=' + CID()),
      callAPI('/clinics/' + CID() + '/patients/' + pid).catch(function() { return {}; })
    ]).then(function(results) {
      var res = results[0];
      var patData = results[1];
      var availPts = (patData.patient && patData.patient.available_points != null)
        ? Number(patData.patient.available_points) : 0;
      var allTemplates = (res.templates || []).filter(function(t) { return t.status === 'active'; });
      if (allTemplates.length === 0) { toast('등록된 쿠폰 템플릿이 없습니다. 설정에서 먼저 등록하세요.', 'error'); return; }

      /* 포인트 충족 여부: required_points 기준 (생일 쿠폰도 차감 설정시 필요) */
      function canIssue(t) {
        var cost = t.required_points ? Number(t.required_points) : 0;
        return cost === 0 || availPts >= cost;
      }

      /* 정렬: 발행 가능 먼저, 그 다음 포인트 부족 */
      var canList = allTemplates.filter(function(t) { return canIssue(t); });
      var cantList = allTemplates.filter(function(t) { return !canIssue(t); });
      var templates = canList.concat(cantList);

      var m = document.createElement('div');
      m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;padding:16px';

      /* 쿠폰 카드 HTML 생성 */
      var tplCardsHtml = templates.map(function(t) {
        var cost = t.required_points ? Number(t.required_points) : 0;
        var ok = canIssue(t);
        var isBday = !!t.is_birthday;
        var isFirst = (canList.length > 0 && t === canList[0]);

        var borderColor = isFirst ? '#2563eb' : '#e5e7eb';
        var bgColor = isFirst ? '#eff6ff' : (ok ? '#fff' : '#fafafa');
        var radioFill = isFirst ? '#2563eb' : 'transparent';
        var radioBorder = isFirst ? '#2563eb' : (ok ? '#d1d5db' : '#e5e7eb');

        var pointBadge = '';
        var bdayBadge = isBday ? '<span style="font-size:11px;color:#d97706;font-weight:600;background:#fef3c7;padding:1px 6px;border-radius:4px;margin-right:6px">생일 쿠폰</span>' : '';
        
        if (cost > 0) {
          if (ok) {
            pointBadge = bdayBadge + '<span style="font-size:11px;color:#dc2626;font-weight:600">' + F(cost) + 'P 차감</span>';
          } else {
            var need = cost - availPts;
            pointBadge = bdayBadge + '<span style="font-size:11px;color:#9ca3af">' + F(cost) + 'P 필요 (' + F(need) + 'P 부족)</span>';
          }
        } else {
          pointBadge = bdayBadge + '<span style="font-size:11px;color:#6b7280">포인트 차감 없음 (무료)</span>';
        }

        var opacity = ok ? '1' : '0.45';
        var cursor = ok ? 'pointer' : 'not-allowed';

        return '<div class="dpt-tpl-card" data-id="' + t.id + '" data-ok="' + (ok ? '1' : '0') + '" '
          + 'style="padding:14px;border:2px solid ' + borderColor + ';border-radius:10px;cursor:' + cursor + ';'
          + 'transition:all .15s;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;'
          + 'background:' + bgColor + ';opacity:' + opacity + '">'
          + '<div><div style="font-size:14px;font-weight:600;color:#1f2937">' + t.name + '</div>'
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

      m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto">'
        + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 4px">쿠폰 발행</h3>'
        + '<p style="font-size:13px;color:#6b7280;margin:0 0 12px">' + pname + ' 환자에게 발행</p>'
        + ptInfo
        + tplCardsHtml
        + '<div style="display:flex;gap:8px;margin-top:16px">'
        + '<button id="dpt-ci-cancel" style="flex:1;padding:11px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
        + '<button id="dpt-ci-ok" style="flex:2;padding:11px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">발행하기</button>'
        + '</div></div>';
      document.body.appendChild(m);

      /* 첫 번째 발행 가능 템플릿 기본 선택 */
      var selectedId = canList.length > 0 ? String(canList[0].id) : null;

      m.querySelectorAll('.dpt-tpl-card').forEach(function(card) {
        if (card.getAttribute('data-ok') === '0') return; /* 포인트 부족 카드 클릭 불가 */
        card.addEventListener('click', function() {
          m.querySelectorAll('.dpt-tpl-card[data-ok="1"]').forEach(function(c) {
            c.style.borderColor = '#e5e7eb'; c.style.background = '#fff';
            c.querySelector('.dpt-tpl-radio').style.borderColor = '#d1d5db';
            c.querySelector('.dpt-tpl-radio').style.background = 'transparent';
          });
          card.style.borderColor = '#2563eb'; card.style.background = '#eff6ff';
          card.querySelector('.dpt-tpl-radio').style.borderColor = '#2563eb';
          card.querySelector('.dpt-tpl-radio').style.background = '#2563eb';
          selectedId = card.getAttribute('data-id');
        });
      });

      document.getElementById('dpt-ci-cancel').addEventListener('click', function() { m.remove(); });
      document.getElementById('dpt-ci-ok').addEventListener('click', function() {
        if (!selectedId) { toast('발행 가능한 쿠폰이 없습니다.', 'error'); return; }
        /* 선택된 템플릿 포인트 재확인 (프론트 이중 검증) */
        var selTpl = allTemplates.find(function(t) { return String(t.id) === String(selectedId); });
        if (selTpl && !canIssue(selTpl)) {
          toast('포인트가 부족합니다. 필요: ' + F(selTpl.required_points) + 'P, 보유: ' + F(availPts) + 'P', 'error');
          return;
        }
        var btn = this; btn.textContent = '발행 중...'; btn.disabled = true;
        callAPI('/coupons/issue', { method: 'POST', body: JSON.stringify({ clinic_id: CID(), patient_id: pid, template_id: selectedId }) })
        .then(function(r) {
          m.remove();
          if (r.coupon && r.coupon.point_deducted > 0) {
            toast('쿠폰 발행 완료! ' + r.coupon.point_deducted.toLocaleString() + 'P 차감되었습니다.');
          } else {
            toast('쿠폰이 발행되었습니다!');
          }
          /* 발행 후 해당 환자 포인트 즉시 업데이트 */
          if (r.patient_points) {
            var rows = document.querySelectorAll('tr[data-patid="' + pid + '"]');
            rows.forEach(function(row) {
              var ptCell = row.querySelector('.dpt-pts-cell');
              if (ptCell) ptCell.textContent = (r.patient_points.available_points || 0).toLocaleString() + 'P';
            });
          }
          
          /* 대시보드 생일 환자 리스트 뱃지 표시 */
          var bdBtns = document.querySelectorAll('.dpt-bd-coupon[data-id="' + pid + '"]');
          bdBtns.forEach(function(btn) {
            btn.style.display = 'none';
            var badge = document.createElement('span');
            badge.style.cssText = 'margin-top:4px;padding:3px 8px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:11px;font-weight:600;display:inline-block;white-space:normal;word-break:keep-all;vertical-align:middle;';
            var tplName = selTpl ? selTpl.name : '쿠폰';
            badge.textContent = '발행완료: ' + tplName;
            btn.parentNode.appendChild(badge);
          });
          
          if (typeof loadPat === 'function') { setTimeout(function(){ loadPat(currentQ, currentPage); }, 400); }
          if (r.coupon) { showIssuedCouponModal(r.coupon); }
        })
        .catch(function(e) { toast(e.message, 'error'); btn.textContent = '발행하기'; btn.disabled = false; });
      });
    }).catch(function(e) { toast(e.message, 'error'); });
  }

  /* --- 쿠폰관리 --- */
  function pgCpn(el) {
    if (!CID()) { el.innerHTML = '<p style="padding:20px;color:#ef4444;text-align:center;font-size:13px">클리닉 정보를 불러올 수 없습니다.</p>'; return; }
    el.innerHTML = SPIN_HTML;
    Promise.all([
      callAPI('/coupons/clinic?clinic_id=' + CID()),
      callAPI('/coupons/templates?clinic_id=' + CID()),
      callAPI('/clinics/' + CID() + '/patients')
    ]).then(function(results) {
      var coupons = results[0].coupons || [];
      var templates = (results[1].templates || []).filter(function(t) { return t.status === 'active'; });
      var patients = results[2].patients || [];
      var sc = { active:'background:#dbeafe;color:#1d4ed8', used:'background:#f3f4f6;color:#6b7280', expired:'background:#fee2e2;color:#ef4444', revoked:'background:#fef3c7;color:#d97706' };
      var sl = { active:'활성', used:'사용완료', expired:'만료', revoked:'회수' };
      var SS = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;font-family:inherit;';
      el.innerHTML = '<div style="animation:dptFadeIn .3s ease">'
        + '<div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">쿠폰 관리</div>'
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:16px">'
        + '<h3 style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 12px">쿠폰 발행</h3>'
        + (templates.length === 0
          ? '<div style="text-align:center;padding:16px;background:#fef3c7;border-radius:8px"><p style="font-size:13px;color:#92400e;margin:0">등록된 쿠폰 템플릿이 없습니다. 설정에서 먼저 등록하세요.</p></div>'
          : '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
            + '<div style="flex:1;min-width:140px"><label style="font-size:12px;font-weight:500;color:#6b7280;display:block;margin-bottom:4px">환자 선택</label><div style="display:flex;gap:4px;margin-bottom:4px;"><input id="dpt-cpn-pat-search" type="text" placeholder="이름 검색" style="flex:1;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;font-family:inherit"><button id="dpt-cpn-pat-btn" style="padding:6px 10px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;font-family:inherit">검색</button></div><select id="dpt-cpn-patient" style="' + SS + '"><option value="">-- 환자 선택 --</option>' + patients.map(function(p) { return '<option value="' + p.id + '">' + p.name + ' (' + p.phone + ')</option>'; }).join('') + '</select></div>'
            + '<div style="flex:1;min-width:140px"><label style="font-size:12px;font-weight:500;color:#6b7280;display:block;margin-bottom:4px">쿠폰 템플릿</label><select id="dpt-cpn-tpl" style="' + SS + '"><option value="">-- 쿠폰 선택 --</option>' + templates.map(function(t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('') + '</select></div>'
            + '<button id="dpt-cpn-issue-btn" style="padding:10px 20px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;height:42px">발행</button></div>')
        + '</div>'
        + '<div style="background:#fff;border-radius:12px;border:1px solid #f3f4f6;overflow:hidden">'
        + '<div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center"><h3 style="font-size:14px;font-weight:600;color:#1f2937;margin:0">발행된 쿠폰</h3><span style="font-size:12px;color:#9ca3af">' + coupons.length + '건</span></div>'
        + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f9fafb"><th style="text-align:left;padding:10px 12px;font-weight:600;color:#6b7280">쿠폰</th><th style="text-align:left;padding:10px 12px;font-weight:600;color:#6b7280">환자</th><th style="text-align:center;padding:10px 12px;font-weight:600;color:#6b7280">코드</th><th style="text-align:center;padding:10px 12px;font-weight:600;color:#6b7280">상태</th><th style="text-align:center;padding:10px 12px;font-weight:600;color:#6b7280">관리</th></tr></thead><tbody>'
        + (coupons.length === 0
          ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af">발행된 쿠폰이 없습니다.</td></tr>'
          : coupons.map(function(x) {
            return '<tr style="border-top:1px solid #f9fafb">'
              + '<td style="padding:10px 12px"><p style="font-weight:500;color:#1f2937;margin:0;font-size:13px">' + x.template_name + '</p></td>'
              + '<td style="padding:10px 12px;color:#6b7280">' + x.patient_name + '</td>'
              + '<td style="padding:10px 12px;text-align:center"><span style="font-family:monospace;font-size:12px;font-weight:600;color:#2563eb">' + x.code + '</span></td>'
              + '<td style="padding:10px 12px;text-align:center"><span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:500;' + (sc[x.status] || '') + '">' + (sl[x.status] || x.status) + '</span></td>'
              + '<td style="padding:10px 12px;text-align:center">' + (x.status === 'active'
                ? '<button class="dpt-cpn-share" data-code="' + x.code + '" data-tname="' + (x.template_name||'') + '" data-pname="' + (x.patient_name||'') + '" data-dtype="' + x.discount_type + '" data-dval="' + x.discount_value + '" data-expires="' + x.expires_at + '" style="padding:4px 8px;border-radius:6px;border:none;background:#e0e7ff;color:#1d4ed8;font-size:11px;cursor:pointer;font-family:inherit;margin-right:4px">공유</button>'
                + '<button class="dpt-cpn-revoke" data-code="' + x.code + '" data-pname="' + (x.patient_name||'') + '" data-tname="' + (x.template_name||'') + '" style="padding:4px 8px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit">회수</button>'
                : '<span style="color:#d1d5db;font-size:11px">-</span>') + '</td></tr>';
          }).join(''))
        + '</tbody></table></div></div></div>';

      var cpnPatBtn = document.getElementById('dpt-cpn-pat-btn');
      if (cpnPatBtn) {
        cpnPatBtn.addEventListener('click', function() {
          var q = document.getElementById('dpt-cpn-pat-search').value.trim();
          var sel = document.getElementById('dpt-cpn-patient');
          sel.innerHTML = '<option value="">검색 중...</option>';
          callAPI('/clinics/' + CID() + '/patients' + (q ? '?search=' + encodeURIComponent(q) : ''))
          .then(function(res) {
            var pts = res.patients || [];
            if (pts.length === 0) {
              sel.innerHTML = '<option value="">검색 결과가 없습니다</option>';
            } else {
              sel.innerHTML = '<option value="">-- 환자 선택 --</option>' + pts.map(function(p) { return '<option value="' + p.id + '">' + p.name + ' (' + p.phone + ')</option>'; }).join('');
            }
          }).catch(function(e) { sel.innerHTML = '<option value="">오류 발생</option>'; });
        });
      }
      var issueBtn = document.getElementById('dpt-cpn-issue-btn');
      if (issueBtn) {
        issueBtn.addEventListener('click', function() {
          var pid = document.getElementById('dpt-cpn-patient').value;
          var tid = document.getElementById('dpt-cpn-tpl').value;
          if (!pid) { toast('환자를 선택하세요.', 'error'); return; }
          if (!tid) { toast('쿠폰 템플릿을 선택하세요.', 'error'); return; }
          var pname = document.getElementById('dpt-cpn-patient').options[document.getElementById('dpt-cpn-patient').selectedIndex].text.split(' (')[0];
          issueBtn.textContent = '발행 중...'; issueBtn.disabled = true;
          callAPI('/coupons/issue', { method: 'POST', body: JSON.stringify({ template_id: Number(tid), clinic_id: CID(), patient_id: Number(pid) }) })
          .then(function(d) { toast(pname + '님에게 쿠폰이 발행되었습니다!'); pgCpn(el); })
          .catch(function(e) { toast(e.message, 'error'); issueBtn.textContent = '발행'; issueBtn.disabled = false; });
        });
      }
      document.querySelectorAll('.dpt-cpn-share').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var code = btn.getAttribute('data-code');
          var shareUrl = API + '/coupon/' + code + '?v=' + new Date().getTime();
          var msg = CN() + ' ' + btn.getAttribute('data-tname') + ' 쿠폰\n만료: ' + btn.getAttribute('data-expires') + '\n확인: ' + shareUrl;
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(function() { toast('쿠폰 정보가 복사되었습니다!'); }).catch(function() { fallbackCopy(msg); toast('쿠폰 정보가 복사되었습니다!'); });
          else { fallbackCopy(msg); toast('쿠폰 정보가 복사되었습니다!'); }
        });
      });
      document.querySelectorAll('.dpt-cpn-revoke').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var code = btn.getAttribute('data-code'); var pname = btn.getAttribute('data-pname'); var tname = btn.getAttribute('data-tname');
          showConfirmModal('쿠폰 회수', '<strong>' + pname + '</strong>님의 <strong>' + tname + '</strong> 쿠폰을 회수할까요?', function() {
            btn.textContent = '처리중...'; btn.disabled = true;
            callAPI('/coupons/' + code + '/revoke', { method: 'POST' }).then(function() { toast('쿠폰이 회수되었습니다.'); pgCpn(el); }).catch(function(e) { toast(e.message, 'error'); btn.textContent = '회수'; btn.disabled = false; });
          });
        });
      });
    }).catch(function(e) { el.innerHTML = '<p style="text-align:center;padding:30px;color:#ef4444;font-size:13px">' + e.message + '</p>'; });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  }

  /* --- 대량업로드 --- */
  function pgBulk(el) {
    el.innerHTML = '<div style="animation:dptFadeIn .3s ease"><div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">대량 업로드</div>'
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
              + '<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">' + r.name + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;color:#2563eb;font-weight:500">' + (r.treatment || '-') + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right">' + (r.payment_amount ? r.payment_amount.toLocaleString()+'원' : '-') + '</td>'
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
                    if (typeof loadPat === 'function') loadPat('', 1);
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
          + '<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #f3f4f6">'
            + '<p style="font-size:10px;color:#9ca3af;margin:0 0 4px">연동 코드</p>'
            + '<div id="dpt-dw-code-area">'
              + (activeCode
                ? '<div style="display:flex;align-items:center;gap:4px"><span id="dpt-code-display" style="font-family:monospace;font-weight:700;font-size:15px;color:#4f46e5;letter-spacing:2px">' + activeCode + '</span><button id="dpt-copy-code" style="border:none;background:none;cursor:pointer;color:#9ca3af;padding:2px;font-size:12px" title="복사">📋</button></div><p style="font-size:9px;color:#9ca3af;margin:2px 0 0" id="dpt-code-timer">' + Math.floor(codeExpSec / 60) + ':' + String(codeExpSec % 60).padStart(2, '0') + ' 남음</p>'
                : '<button id="dpt-gen-code" style="font-size:11px;padding:5px 10px;border-radius:6px;border:none;background:#4f46e5;color:#fff;cursor:pointer;font-family:inherit;font-weight:500;margin-top:2px">코드 생성</button>')
            + '</div>'
          + '</div>'
          + cardH('연동 환자', F(dwPatients) + '명', '', '#2563eb')
          + cardH('마지막 동기화', (lastSync ? lastSync.created_at.replace('T', ' ').substring(11, 16) : '—'), '', '#1f2937')
          + cardH('동기화 횟수', totalSyncs + '회', '', '#1f2937')
        + '</div>'

        /* 연동 가이드 (접이식) */
        + '<details style="background:#fff;border-radius:10px;border:1px solid #f3f4f6;margin-bottom:10px" open>'
          + '<summary style="padding:12px 14px;font-size:13px;font-weight:600;color:#1f2937;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#9ca3af">▼</span> 연동 가이드 (4단계)</summary>'
          + '<div style="padding:0 14px 14px;font-size:12px;display:flex;flex-direction:column;gap:12px;">'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb">1</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">브릿지 프로그램 다운로드</p><p style="color:#6b7280;margin:4px 0 0;font-size:11px">실제 DentWeb 메인/서버 PC에서 아래 버튼을 눌러 다운로드하세요.</p><a href="/static/DentWebBridge.zip" download="DentWebBridge.zip" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:8px 14px;background:#4f46e5;color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.1)">DentWebBridge.zip 다운로드</a><p style="color:#9ca3af;margin:6px 0 0;font-size:10px">파이썬(Python) 자동 설치 기능이 포함되어 있습니다.</p></div></div>'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb">2</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">연동 코드 생성</p><p style="color:#6b7280;margin:4px 0 0;font-size:11px">위쪽의 <strong>[코드 생성]</strong> 버튼을 클릭하여 6자리 코드를 발급받으세요. (30분간 유효)</p></div></div>'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb">3</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">압축 해제 및 프로그램 실행</p><div style="margin-top:6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 다운로드 받은 <code style="background:#fff;padding:1px 4px;border:1px solid #e5e7eb;border-radius:3px">DentWebBridge.zip</code> 파일의 <strong>압축을 풉니다.</strong></p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 폴더 안의 <code style="background:#fff;padding:1px 4px;border:1px solid #e5e7eb;border-radius:3px;font-weight:bold;color:#2563eb">DentWebBridge.bat</code> 파일을 <strong>더블클릭</strong>하여 실행합니다.</p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#4b5563;line-height:1.4">- 까만 DOS 창이 뜨고 컴퓨터에 파이썬이 없다면 <strong>약 1~2분간 자동 설치가 진행</strong>됩니다. (창을 끄지 마세요)</p></div></div></div></div>'
            
            + '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex-shrink:0;width:22px;height:22px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#16a34a">4</span><div style="flex:1"><p style="font-weight:600;color:#1f2937;margin:0">연동 코드 입력 및 동기화 시작</p><div style="margin-top:6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 설치가 완료되면 DOS 창에 <strong>"6자리 연동 코드를 입력하세요:"</strong> 문구가 나옵니다.</p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- 2번에서 발급받은 <strong>연동 코드 6자리를 키보드로 입력하고 엔터</strong>를 누르세요.</p></div><div style="display:flex;gap:6px;align-items:flex-start"><p style="margin:0;font-size:11px;color:#374151;line-height:1.4">- "연동 성공!" 메시지가 뜨면 <strong>5분 간격으로 자동으로 동기화</strong>됩니다.</p></div></div></div></div>'
            
          + '</div>'
        + '</details>'

        /* 동기화 로그 (접이식) */
        + '<details style="background:#fff;border-radius:10px;border:1px solid #f3f4f6;margin-bottom:10px">'
          + '<summary style="padding:12px 14px;font-size:13px;font-weight:600;color:#1f2937;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#9ca3af">▶</span> 동기화 이력</div><span style="font-size:11px;color:#9ca3af;font-weight:400">' + recentLogs.length + '건</span></summary>'
          + '<div style="padding:0 4px 8px">'
          + (recentLogs.length === 0 ? '<p style="padding:16px;text-align:center;color:#9ca3af;font-size:12px">아직 기록 없음</p>'
          : '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f9fafb"><th style="text-align:left;padding:6px 8px;font-weight:600;color:#6b7280">시간</th><th style="text-align:left;padding:6px 8px;font-weight:600;color:#6b7280">유형</th><th style="text-align:center;padding:6px 8px;font-weight:600;color:#6b7280">전체</th><th style="text-align:center;padding:6px 8px;font-weight:600;color:#6b7280">신규</th><th style="text-align:center;padding:6px 8px;font-weight:600;color:#6b7280">오류</th></tr></thead><tbody>'
          + recentLogs.map(function(l) {
              var tc = l.sync_type === 'patients' ? 'background:#dbeafe;color:#1d4ed8' : l.sync_type === 'payments' ? 'background:#dcfce7;color:#16a34a' : 'background:#f3e8ff;color:#7c3aed';
              var tl = l.sync_type === 'patients' ? '환자' : l.sync_type === 'payments' ? '결제' : '내원';
              return '<tr style="border-top:1px solid #f9fafb"><td style="padding:5px 8px;color:#6b7280;font-size:10px;white-space:nowrap">' + (l.created_at || '').replace('T', ' ').substring(5, 16) + '</td><td style="padding:5px 8px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500;' + tc + '">' + tl + '</span></td><td style="padding:5px 8px;text-align:center">' + (l.total_rows || 0) + '</td><td style="padding:5px 8px;text-align:center;color:#2563eb;font-weight:500">' + (l.new_rows || 0) + '</td><td style="padding:5px 8px;text-align:center;' + (l.error_rows > 0 ? 'color:#ef4444;font-weight:500' : 'color:#9ca3af') + '">' + (l.error_rows || 0) + '</td></tr>';
            }).join('')
          + '</tbody></table></div>')
          + '</div>'
        + '</details>'

        /* config.ini + 수동 연동 + FAQ (접이식) */
        + '<details style="background:#fff;border-radius:10px;border:1px solid #f3f4f6;margin-bottom:10px">'
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
    Promise.all([callAPI('/clinics/' + CID()), callAPI('/coupons/templates?clinic_id=' + CID())])
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
      var CARD_HDR = 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #f3f4f6';
      var INP = 'padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;width:100%';
      var SAVEBTN = 'padding:7px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit';
      var GBTN = 'padding:7px 16px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit';
      var EDITBTN = 'padding:6px 14px;border-radius:7px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:12px;cursor:pointer;font-family:inherit';

      /* ── 치과 정보 테이블 행 ── */
      function infoRow(id, label, value, placeholder, isLast) {
        var bs = isLast ? '' : 'border-bottom:1px solid #f3f4f6;';
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
            /* 규칙 설정이 있으면 규칙만 표시 (auto_issue_points 무시) */
            matchedRules.forEach(function(rule) {
              autoLines.push(F(rule.min_points) + 'P 달성 시 자동 등록');
            });
          } else if (t.auto_issue_points) {
            /* 규칙 설정이 없을 때만 템플릿 자체 값 표시 */
            autoLines.push(F(t.auto_issue_points) + 'P 달성 시 자동 등록');
          }
          var requiredPtsHtml = t.required_points > 0
            ? '<div style="font-size:12px;color:#dc2626;font-weight:600;margin-top:2px">발행 비용: ' + F(t.required_points) + 'P</div>'
            : (t.is_birthday ? '' : '<div style="font-size:12px;color:#9ca3af;margin-top:2px">무료 발행</div>');
          var autoStr = autoLines.length > 0
            ? autoLines.map(function(line) {
                return '<div style="font-size:12px;color:#2563eb;font-weight:500;margin-top:3px">' + line + '</div>';
              }).join('')
            : '';

          var imgHtml = t.image_url
            ? '<img src="' + t.image_url + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              + '<div style="width:64px;height:64px;border-radius:8px;background:#f3f4f6;display:none;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>'
            : '<div style="width:64px;height:64px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#9ca3af">NO IMG</div>';
          var statusBadge = (t.status === 'active')
            ? '<span style="display:inline-block;padding:4px 12px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;color:#374151;font-weight:500">활성</span>'
            : '<span style="display:inline-block;padding:4px 12px;border-radius:8px;border:1px solid #fecaca;background:#fee2e2;font-size:12px;color:#ef4444;font-weight:500">비활성</span>';
          return '<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #f3f4f6">'
            + imgHtml
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:600;color:#1f2937">' + t.name + (t.is_birthday ? ' <span style="font-size:10px;background:#fef3c7;color:#d97706;border-radius:4px;padding:1px 5px;font-weight:600">생일</span>' : '') + '</div>'
            + '<div style="font-size:12px;color:#6b7280;margin-top:3px">유효 ' + (t.valid_days||365) + '일</div>'
            + autoStr
            + requiredPtsHtml
            + '</div>'
            + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'
            + statusBadge
            + '<div style="display:flex;gap:4px">'
            + '<button class="dpt-set-tedit" data-id="' + t.id + '" data-name="' + (t.name||'').replace(/"/g,'&quot;') + '" data-dtype="' + t.discount_type + '" data-dval="' + t.discount_value + '" data-days="' + (t.valid_days||90) + '" data-auto="' + (t.auto_issue_points||'') + '" data-imgurl="' + (t.image_url||'') + '" data-birthday="' + (t.is_birthday ? '1' : '0') + '" data-required="' + (t.required_points||0) + '" style="padding:3px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:11px;cursor:pointer;font-family:inherit">수정</button>'
            + '<button class="dpt-set-tdel" data-id="' + t.id + '" style="padding:3px 10px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;font-size:11px;cursor:pointer;font-family:inherit">삭제</button>'
            + '</div></div>'
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
        + '<button id="dpt-set-tadd" style="' + SAVEBTN + '">+ 새 템플릿</button>'
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
      + '<div style="border-top:1px solid #f3f4f6;margin:12px 0 14px"></div>'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:14px;padding:10px 12px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb">'
      + '<input type="checkbox" id="dpt-tm-birthday" ' + (tpl && tpl.is_birthday ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#d97706;flex-shrink:0">'
      + '<span style="font-size:13px;font-weight:600;color:#92400e">생일 쿠폰 <span style="font-size:11px;font-weight:400;color:#a16207">(포인트 관계없이 생일 환자에게 발행 가능)</span></span>'
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
    document.getElementById('dpt-tm-cancel').addEventListener('click', function() { m.remove(); });
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    /* 규칙 행 삭제 (이벤트 위임) */
    document.getElementById('dpt-tm-rule-list').addEventListener('click', function(e) {
      if (e.target.classList.contains('dpt-tm-rule-del')) e.target.closest('.dpt-tm-rule-row').remove();
    });
    /* + 규칙 추가 */
    document.getElementById('dpt-tm-rule-add').addEventListener('click', function() {
      var list = document.getElementById('dpt-tm-rule-list');
      var div = document.createElement('div');
      div.innerHTML = ruleRowHtml('');
      list.appendChild(div.firstChild);
    });
    document.getElementById('dpt-tm-save').addEventListener('click', function() {
      var name = document.getElementById('dpt-tm-name').value.trim();
      var days = parseInt(document.getElementById('dpt-tm-days').value) || 90;
      var imgUrl = document.getElementById('dpt-tm-imgurl').value.trim();
      var isBirthday = document.getElementById('dpt-tm-birthday').checked;
      var requiredPoints = parseInt(document.getElementById('dpt-tm-required').value) || 0;
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

  /* ==================== 환자 UI ==================== */
  function renderPatient() {
    var cn = CN();
    root.innerHTML = '<div class="dpt-app-loaded" id="dpt-app" style="font-family:Noto Sans KR,sans-serif">'
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-size:16px;font-weight:700">' + cn + '</div><div style="font-size:12px;opacity:.8;margin-top:2px">' + (authMember.name || '') + '님</div></div>'
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
        .then(function(d) { var l = d.logs || []; c.innerHTML = l.length === 0 ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">내역 없음</p>' : l.map(function(x) { return '<div style="background:#fff;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #f3f4f6"><div><p style="font-size:13px;font-weight:500;color:#1f2937;margin:0">' + (x.description||x.type) + '</p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + (x.created_at ? x.created_at.split('T')[0] : '') + '</p></div><div style="text-align:right"><p style="font-size:13px;font-weight:700;margin:0;color:' + (x.amount > 0 ? '#2563eb' : '#ef4444') + '">' + (x.amount > 0 ? '+' : '') + F(x.amount) + ' P</p></div></div>'; }).join(''); }).catch(function(e) { c.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;font-size:13px">' + e.message + '</p>'; });
      } else if (t === 'coupons') {
        callAPI('/coupons/my?clinic_id=' + CID() + '&patient_id=' + authMember.id + '&status=active')
        .then(function(d) { var l = d.coupons || []; c.innerHTML = l.length === 0 ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">쿠폰 없음</p>' : l.map(function(x) { return '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #f3f4f6"><div style="display:flex;justify-content:space-between"><p style="font-size:14px;font-weight:600;color:#1f2937;margin:0">' + x.template_name + '</p></div><div style="display:flex;justify-content:space-between;margin-top:10px"><span style="font-size:11px;color:#9ca3af">~' + x.expires_at + '</span><span style="font-size:12px;font-weight:600;color:#2563eb;font-family:monospace">' + x.code + '</span></div></div>'; }).join(''); }).catch(function(e) { c.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;font-size:13px">' + e.message + '</p>'; });
      } else {
        callAPI('/payments?clinic_id=' + CID() + '&patient_id=' + authMember.id + '&limit=50')
        .then(function(d) { var l = d.payments || []; c.innerHTML = l.length === 0 ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">내역 없음</p>' : l.map(function(x) { return '<div style="background:#fff;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #f3f4f6"><div><p style="font-size:13px;font-weight:500;color:#1f2937;margin:0">' + x.category + '</p><p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + x.payment_date + '</p></div><div style="text-align:right"><p style="font-size:13px;font-weight:700;color:#1f2937;margin:0">' + F(x.amount) + '원</p><p style="font-size:11px;color:#2563eb;margin:2px 0 0">+' + F(x.point_earned) + 'P</p></div></div>'; }).join(''); }).catch(function(e) { c.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;font-size:13px">' + e.message + '</p>'; });
      }
    }
    loadTab('points');
    document.querySelectorAll('.dpt-pt').forEach(function(b) { b.addEventListener('click', function() { loadTab(b.getAttribute('data-t')); }); });
  }

})();
