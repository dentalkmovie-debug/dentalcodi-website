(function(){
  console.log('Codi widget v3.6.0 loaded');
  var debugLog = [];
  function dlog(m) { debugLog.push(m); console.log('[Codi] ' + m); }

  /* API 기본 URL 자동 감지 */
  var API = (function() {
    var loc = window.location;
    if (loc.pathname === '/codi' || loc.pathname.indexOf('/codi') === 0) return loc.origin;
    return 'https://dental-point.pages.dev';
  })();

  var root = document.getElementById('codi-widget-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'codi-widget-root';
    root.style.cssText = 'display:block;width:100%;font-family:Noto Sans KR,sans-serif';
    var cs = document.currentScript;
    if (cs && cs.parentNode) cs.parentNode.insertBefore(root, cs);
    else document.body.appendChild(root);
  }
  if (root.querySelector('.codi-app-loaded')) return;

  if (!document.getElementById('codi-style')) {
    var st = document.createElement('style');
    st.id = 'codi-style';
    st.textContent = '@keyframes codiSpin{to{transform:rotate(360deg)}}@keyframes codiFadeIn{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(st);
  }

  /* ===== 유틸리티 ===== */
  function escH(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function F(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  var SPIN = '<div style="padding:40px;text-align:center"><div style="display:inline-block;width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:codiSpin .7s linear infinite"></div></div>';

  function toast(msg, type) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:codiFadeIn .3s ease;font-family:Noto Sans KR,sans-serif';
    d.style.background = type === 'error' ? '#ef4444' : '#2563eb';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function() { d.style.transition='opacity .3s'; d.style.opacity='0'; setTimeout(function(){d.remove();},300); }, 2500);
  }

  function fallbackCopy(text) {
    try { var ta=document.createElement('textarea'); ta.value=text; ta.style.cssText='position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch(e) {}
  }

  /* ===== 삭제 확인 모달 (confirm 대체) ===== */
  function showDeleteModal(msg, onConfirm) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;animation:codiFadeIn .2s ease';
    m.innerHTML = '<div style="background:#fff;border-radius:14px;padding:24px;width:85%;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2)">' 
      + '<p style="font-size:15px;color:#1f2937;font-weight:600;margin:0 0 20px">삭제하시겠습니까?</p>'
      + '<div style="display:flex;gap:8px">'
      + '<button id="cdm-cancel" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
      + '<button id="cdm-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#dc2626;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">삭제</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    m.querySelector('#cdm-cancel').addEventListener('click', function() { m.remove(); });
    m.querySelector('#cdm-ok').addEventListener('click', function() { m.remove(); if (onConfirm) onConfirm(); });
  }

  /* ===== 확인 모달 (배포 등) ===== */
  function showConfirmModal(msg, onConfirm) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif;animation:codiFadeIn .2s ease';
    m.innerHTML = '<div style="background:#fff;border-radius:14px;padding:24px;width:85%;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2)">' 
      + '<p style="font-size:15px;color:#1f2937;font-weight:600;margin:0 0 20px">' + escH(msg) + '</p>'
      + '<div style="display:flex;gap:8px">'
      + '<button id="ccm-cancel" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
      + '<button id="ccm-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">확인</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    m.querySelector('#ccm-cancel').addEventListener('click', function() { m.remove(); });
    m.querySelector('#ccm-ok').addEventListener('click', function() { m.remove(); if (onConfirm) onConfirm(); });
  }

  /* ===== 인증 ===== */
  var authToken='', authMember=null, currentClinic=null, currentPage='patients';
  function CID() { return currentClinic && currentClinic.id || 0; }
  function CN() { return currentClinic && currentClinic.name || '치과'; }
  function CPHONE() { return currentClinic && currentClinic.phone || ''; }

  /* ===== API 캐시 (stale-while-revalidate) + 인플라이트 중복 방지 ===== */
  var _apiCache = {};
  var _apiCacheTTL = 30000;
  var _inflight = {}; /* 진행 중인 GET 요청 공유 */
  function _cacheKey(p) { return p.replace(/[&?]_t=\d+/, ''); }
  function _getCached(p) { var k=_cacheKey(p),c=_apiCache[k]; return (c && Date.now()-c.ts<_apiCacheTTL) ? c.data : null; }
  function _getStale(p) { var k=_cacheKey(p),c=_apiCache[k]; return c ? c.data : null; }
  function _setCache(p,d) { _apiCache[_cacheKey(p)] = {data:d, ts:Date.now()}; }

  function callAPI(path, opts) {
    opts = opts || {};
    var hd = {'Content-Type':'application/json'};
    if (authToken) hd['Authorization'] = 'Bearer ' + authToken;
    var fo = { method: opts.method||'GET', headers: Object.assign(hd, opts.headers||{}) };
    if (opts.body) fo.body = opts.body;
    var isGet = !fo.method || fo.method.toUpperCase()==='GET';
    /* GET 캐시 히트 */
    if (isGet && !opts.noCache) {
      var cached = _getCached(path);
      if (cached) return Promise.resolve(JSON.parse(JSON.stringify(cached)));
      /* 인플라이트 중복 방지: 동일 경로 fetch가 이미 진행 중이면 재사용 */
      var ck = _cacheKey(path);
      if (_inflight[ck]) return _inflight[ck].then(function(d){ return JSON.parse(JSON.stringify(d)); });
      /* stale-while-revalidate */
      var stale = _getStale(path);
      if (stale) {
        var bgPath = path + (path.indexOf('?')!==-1?'&':'?') + '_t=' + Date.now();
        fetch(API+'/api'+bgPath, fo).then(function(r){ if(r.ok) r.json().then(function(d){_setCache(path,d);}); }).catch(function(){});
        return Promise.resolve(JSON.parse(JSON.stringify(stale)));
      }
    }
    if (isGet) path += (path.indexOf('?')!==-1?'&':'?') + '_t=' + Date.now();
    var p = fetch(API + '/api' + path, fo).then(function(r) {
      return r.text().then(function(text) {
        var data; try { data=JSON.parse(text); } catch(e) { throw new Error('서버 응답 오류'); }
        if (!r.ok) {
          /* 401 Unauthorized → 세션 만료: 캐시 클리어 후 재인증 */
          if (r.status === 401) {
            dlog('401 토큰만료 감지 - 세션 클리어');
            authToken=''; authMember=null; currentClinic=null;
            try{localStorage.removeItem('dpt_admin_token');localStorage.removeItem('dpt_admin_member');localStorage.removeItem('dpt_admin_clinics');localStorage.removeItem('dpt_admin_current_clinic');}catch(e2){}
            errUI('세션이 만료되었습니다. 새로고침해 주세요.');
          }
          throw new Error(data.error||'서버오류('+r.status+')');
        }
        if (isGet) _setCache(path, data);
        if (!isGet) Object.keys(_apiCache).forEach(function(k){ _apiCache[k].ts=0; });
        return data;
      });
    });
    /* 인플라이트 등록 (GET만) */
    if (isGet) {
      var ik = _cacheKey(path);
      _inflight[ik] = p.then(function(d){ delete _inflight[ik]; return d; }).catch(function(e){ delete _inflight[ik]; throw e; });
    }
    return p;
  }

  function spin(msg) {
    root.innerHTML='<div style="padding:40px;text-align:center;font-family:Noto Sans KR,sans-serif">'
      +'<div style="display:inline-block;width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:codiSpin .7s linear infinite;margin-bottom:12px"></div>'
      +'<p style="font-size:13px;color:#6b7280">'+(msg||'로딩 중...')+'</p></div>';
  }

  function errUI(msg) {
    root.innerHTML='<div style="padding:20px;text-align:center;font-family:Noto Sans KR,sans-serif">'
      +'<p style="font-size:13px;color:#ef4444;margin-bottom:12px">'+escH(msg)+'</p>'
      +'<button onclick="location.reload()" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;font-family:inherit">새로고침</button>'
      +'<details style="margin-top:8px"><summary style="font-size:11px;color:#9ca3af;cursor:pointer">디버그</summary>'
      +'<pre style="font-size:9px;color:#6b7280;background:#f9fafb;padding:8px;border-radius:6px;margin-top:4px;white-space:pre-wrap;max-height:200px;overflow-y:auto">'+escH(debugLog.join('\n'))+'</pre></details></div>';
  }

  /* ===== 아임웹 SDK 회원 감지 ===== */
  function getMemberId() {
    try {
      var bs = window.__bs_imweb;
      if (!bs) { var ck=document.cookie.split(';'); for(var i=0;i<ck.length;i++){ var c=ck[i].trim(); if(c.indexOf('__bs_imweb=')===0){bs=JSON.parse(decodeURIComponent(c.substring(11)));break;} } }
      if (bs) {
        /* ★ v5.10.15: member_code(m...) 우선 → 서버 DB 키와 일치 보장 */
        /* sdk_jwt.sub = member_code(m으로 시작) → DB의 imweb_member_id와 동일 형식 */
        if(bs.sdk_jwt){try{var p=JSON.parse(atob(bs.sdk_jwt.split('.')[1]));var sub=p.sub||p.member_code||p.mc||'';if(sub&&sub!=='null'&&String(sub).indexOf('m')===0){dlog('ID:jwt_mc='+sub);return String(sub);}}catch(e){}}
        /* bs 직접 필드에 member_code가 있으면 우선 사용 */
        if(bs.member_code&&String(bs.member_code).indexOf('m')===0){dlog('ID:bs_mc='+bs.member_code);return String(bs.member_code);}
        /* member 객체에 code/member_code가 있으면 사용 */
        if(bs.member&&bs.member.code&&String(bs.member.code).indexOf('m')===0){dlog('ID:member_code='+bs.member.code);return String(bs.member.code);}
        /* member_no(숫자) - fallback. 서버에서 member_code로 변환 처리 */
        var no=bs.member_no||bs.memberNo||(bs.member&&bs.member.no);
        if(no){dlog('ID:member_no='+no);return 'mno_'+String(no);}
        /* jwt에 숫자 sub가 있는 경우 */
        if(bs.sdk_jwt){try{var p2=JSON.parse(atob(bs.sdk_jwt.split('.')[1]));var sub2=p2.sub||p2.member_code||p2.mc||'';if(sub2&&sub2!=='null'){dlog('ID:jwt='+sub2);return String(sub2);}}catch(e){}}
      }
    } catch(e){dlog('ID오류:'+e.message);}
    var gk=['member_data','JEJU_MEMBER','__MEMBER__','memberData','_member','member','user_data'];
    for(var g=0;g<gk.length;g++){try{var o=window[gk[g]];if(o&&typeof o==='object'){var mid=o.member_code||o.code||o.id||o.no||o.member_id||o.memberCode||'';if(mid){dlog('ID:'+gk[g]+'='+mid);return String(mid);}}}catch(e){}}
    return '';
  }
  function getLoginName() {
    /* ★ v5.10.13: bs.name(아임웹 최상위 이름필드) 우선 체크 추가 */
    try{var bs=window.__bs_imweb;if(bs){var fl=['member_name','memberName','nick','nickname','user_name','name'];for(var f=0;f<fl.length;f++){if(bs[fl[f]]&&typeof bs[fl[f]]==='string'){var n=bs[fl[f]].trim();if(n&&n.length>=1&&!isSysWord(n))return n;}}var m=bs.member||bs.memberData;if(m){var mf=['name','nick','nickname'];for(var mi=0;mi<mf.length;mi++){if(m[mf[mi]]&&!isSysWord(m[mf[mi]]))return m[mf[mi]].trim();}}}}catch(e){}
    try{var bt=(document.body.textContent||'').replace(/\s+/g,' ');var m1=bt.match(/([^\s|│\/]{1,20})\s*[|│]\s*Logout/);if(m1){var c=m1[1].trim().replace(/님$/,'');if(!isSysWord(c)&&c.length>=1)return c;}var m2=bt.match(/([가-힣a-zA-Z0-9]{2,15})님\s*(?:\||로그아웃|Logout)/);if(m2&&!isSysWord(m2[1]))return m2[1];}catch(e){}
    try{var links=document.querySelectorAll('a');var lo=null;for(var li=0;li<links.length;li++){var lt=(links[li].textContent||'').trim();var lh=(links[li].getAttribute('href')||'');if(lt==='Logout'||lt==='로그아웃'||lh.indexOf('logout')!==-1){lo=links[li];break;}}if(lo){var prev=lo.previousSibling;if(prev&&prev.nodeType===3){var pn=prev.textContent.trim().replace(/^[\s|│\/·•]+|[\s|│\/·•]+$/g,'').replace(/님$/,'').trim();if(pn&&!isSysWord(pn))return pn;}var prevE=lo.previousElementSibling;if(prevE){var pen=prevE.textContent.trim().replace(/^[\s|│\/]+|[\s|│\/]+$/g,'').replace(/님$/,'');if(pen==='|'||pen==='│'){var pp=prevE.previousElementSibling;if(pp){var ppn=pp.textContent.trim().replace(/님$/,'');if(!isSysWord(ppn))return ppn;}}if(!isSysWord(pen))return pen;}var par=lo.parentElement;if(par){var ch=par.childNodes;for(var ci=ch.length-1;ci>=0;ci--){var cn=ch[ci];if(cn===lo||(cn.contains&&cn.contains(lo)))continue;var cnt=(cn.textContent||'').trim().replace(/^[\s|│\/·•]+|[\s|│\/·•]+$/g,'').replace(/님$/,'').trim();if(cnt==='Logout'||cnt==='로그아웃'||cnt==='|'||cnt==='│')continue;if(cnt&&cnt.length>=1&&!isSysWord(cnt))return cnt;}}}}catch(e){}
    return '';
  }
  function getLoginEmail() {
    try{var bs=window.__bs_imweb;if(!bs){var ck=document.cookie.split(';');for(var i=0;i<ck.length;i++){var c=ck[i].trim();if(c.indexOf('__bs_imweb=')===0){bs=JSON.parse(decodeURIComponent(c.substring(11)));break;}}}if(bs){var ef=['email','member_email','memberEmail','user_email'];for(var f=0;f<ef.length;f++){if(bs[ef[f]]&&bs[ef[f]].indexOf('@')>0)return bs[ef[f]];}var m=bs.member||bs.memberData;if(m){for(var mf=0;mf<ef.length;mf++){if(m[ef[mf]]&&m[ef[mf]].indexOf('@')>0)return m[ef[mf]];}}if(bs.sdk_jwt){try{var p=JSON.parse(atob(bs.sdk_jwt.split('.')[1]));if(p.email&&p.email.indexOf('@')>0)return p.email;}catch(e){}}}}catch(e){}
    return '';
  }
  function getLoginGroup() {
    try{var bs=window.__bs_imweb;if(bs){var gf=['member_group','memberGroup','group','grade','member_grade'];for(var f=0;f<gf.length;f++){if(bs[gf[f]])return String(bs[gf[f]]);}var m=bs.member||bs.memberData;if(m){for(var mf=0;mf<gf.length;mf++){if(m[gf[mf]])return String(m[gf[mf]]);}}}}catch(e){}
    return '';
  }
  var SYSWORDS=['마이페이지','로그인','회원가입','로그아웃','Logout','Login','Sign Up','My Page','MyPage','홈','메뉴','치료계획','상담','공지사항','소개','갤러리','문의','예약','게시판','Home','Menu','아임웹 사용자','임플란트코디 사용자','관리','admin','Admin','포인트','쿠폰','쿠폰관리','설정','대시보드','브랜드관리','장바구니','주문조회','Cart','Order','결제','마이','My','더보기','브랜드','서비스','About','Contact','Shop','Blog','Search','검색','Profile','프로필','회원정보','내정보','개인정보','멤버십관리','멤버십','모바일코디','모바일 코디','대기실TV','대기실 TV','임플란트코디','임플란트 코디','관리자','최고관리자','치과관리','사이트관리','사이트','포인트관리시스템','Alarm','alarm','알림','Notification','notification','포인트쿠폰','포인트관리','쿠폰발급','회원관리','고객관리'];
  function isSysWord(n){if(!n)return true;var t=n.trim();if(!t||t.length<1||t.length>30)return true;for(var i=0;i<SYSWORDS.length;i++){if(t===SYSWORDS[i])return true;}if(/^[\d\s|│\/·•\-_=+]+$/.test(t))return true;return false;}
  function isLoggedIn(){try{var links=document.querySelectorAll('a');for(var i=0;i<links.length;i++){var t=(links[i].textContent||'').trim();var h=(links[i].getAttribute('href')||'');if(t==='Logout'||t==='로그아웃'||h.indexOf('logout')!==-1)return true;}}catch(e){}return false;}

  /* ===== imweb-match 인증 ===== */
  function doMatch(memberId, loginName) {
    var loginEmail=getLoginEmail(), loginGroup=getLoginGroup();
    var clinicName='',clinicPhone='',clinicAddr='';
    try{
      /* ★ v5.10.12: loginName(닉네임) 우선 - title보다 닉네임이 정확함 */
      /* title은 사이트 공통 제목이어서 다른 계정 이름이 들어갈 수 있음 */
      if(loginName&&!isSysWord(loginName))clinicName=loginName;
      /* loginName 없을 때만 title 사용 (isSysWord 체크 강화) */
      if(!clinicName){var te=document.querySelector('title');if(te){var tr=te.textContent.split('|')[0].split('-')[0].trim();if(!isSysWord(tr))clinicName=tr;}}
      var tls=document.querySelectorAll('a[href^="tel:"]');if(tls.length)clinicPhone=(tls[0].getAttribute('href')||'').replace('tel:','');
    }catch(e){}
    var prevId='';try{prevId=localStorage.getItem('dpt_imweb_prev_id')||'';}catch(e){}
    try{localStorage.setItem('dpt_imweb_prev_id',memberId);}catch(e){}
    var body={imweb_member_id:memberId,imweb_name:loginName||'',imweb_email:loginEmail||'',imweb_group:loginGroup||'',imweb_phone:'',imweb_clinic_name:clinicName||'',imweb_clinic_phone:clinicPhone||'',imweb_clinic_addr:clinicAddr||''};
    if(prevId&&prevId!==memberId)body.previous_id=prevId;
    dlog('매칭요청:'+JSON.stringify(body));
    fetch(API+'/api/auth/imweb-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json();})
    .then(function(d){
      dlog('매칭응답:matched='+d.matched);
      if(d.matched&&d.token){
        authToken=d.token;authMember=d.member;var clinics=d.clinics||[];currentClinic=clinics[0]||null;
        /* ★ v5.10.14: imweb_member_id를 localStorage에 저장 → 캐시 계정 검증에 활용 */
        try{localStorage.setItem('dpt_admin_token',d.token);localStorage.setItem('dpt_admin_member',JSON.stringify(d.member));localStorage.setItem('dpt_admin_clinics',JSON.stringify(clinics));if(currentClinic)localStorage.setItem('dpt_admin_current_clinic',JSON.stringify(currentClinic));if(memberId)localStorage.setItem('dpt_imweb_id',memberId);}catch(e){}
        if(_instantRendered){
          dlog('즉시렌더 후 doMatch 성공 - 계정/클리닉 검증 후 UI 갱신');
          /* ★ v5.10.14: _instantRendered 후 doMatch 성공 시도 항상 renderApp 재호출 */
          /* 이전 계정 캐시로 렌더된 화면을 정확한 계정으로 즉시 교체 */
          renderApp();
        }
        else{renderApp();}
      }
      else if(d.need_name){
        if(_instantRendered){authToken='';authMember=null;currentClinic=null;try{localStorage.removeItem('dpt_admin_token');localStorage.removeItem('dpt_admin_member');localStorage.removeItem('dpt_admin_clinics');localStorage.removeItem('dpt_admin_current_clinic');}catch(e){}}
        showNameInputUI(memberId,clinicName,clinicPhone,clinicAddr,prevId);}
      else{
        if(_instantRendered){authToken='';authMember=null;currentClinic=null;try{localStorage.removeItem('dpt_admin_token');localStorage.removeItem('dpt_admin_member');localStorage.removeItem('dpt_admin_clinics');localStorage.removeItem('dpt_admin_current_clinic');}catch(e){}}
        errUI((d.error||'연결 실패')+' (ID: '+memberId+')');}
    }).catch(function(e){dlog('매칭오류:'+e.message);errUI('서버 연결 오류: '+e.message);});
  }

  function showNameInputUI(memberId,clinicName,clinicPhone,clinicAddr,prevId) {
    root.innerHTML='<div style="padding:20px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">'
      +'<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:14px 18px;color:#fff;border-radius:10px;margin-bottom:16px">'
      +'<div style="font-size:15px;font-weight:700">모바일 코디</div>'
      +'<div style="font-size:12px;opacity:.8;margin-top:2px">처음 접속하셨나요? 치과 이름을 입력해 주세요.</div></div>'
      +'<div style="margin-bottom:10px"><label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">치과(클리닉) 이름</label>'
      +'<input id="codi-ni" type="text" placeholder="예: 임플란트코디치과" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit" /></div>'
      +'<button id="codi-ns" style="width:100%;padding:11px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">시작하기</button></div>';
    var inp=document.getElementById('codi-ni');if(inp)inp.focus();
    var btn=document.getElementById('codi-ns');
    if(btn){btn.addEventListener('click',function(){var name=(document.getElementById('codi-ni').value||'').trim();if(!name){document.getElementById('codi-ni').style.borderColor='#ef4444';return;}btn.textContent='확인 중...';btn.disabled=true;var body2={imweb_member_id:memberId,imweb_name:name,imweb_email:'',imweb_phone:'',imweb_clinic_name:clinicName||name,imweb_clinic_phone:clinicPhone||'',imweb_clinic_addr:clinicAddr||''};if(prevId&&prevId!==memberId)body2.previous_id=prevId;fetch(API+'/api/auth/imweb-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body2)}).then(function(r){return r.json();}).then(function(d){if(d.matched&&d.token){authToken=d.token;authMember=d.member;var clinics=d.clinics||[];currentClinic=clinics[0]||null;try{localStorage.setItem('dpt_admin_token',d.token);localStorage.setItem('dpt_admin_member',JSON.stringify(d.member));localStorage.setItem('dpt_admin_clinics',JSON.stringify(clinics));if(currentClinic)localStorage.setItem('dpt_admin_current_clinic',JSON.stringify(currentClinic));}catch(e){}renderApp();}else errUI(d.error||'등록 실패');}).catch(function(e){errUI('오류: '+e.message);});});inp.addEventListener('keypress',function(e){if(e.key==='Enter')btn.click();});}
  }

  /* ===== localStorage API 캐시 복원/저장 ===== */
  /* ★ v5.10.20: imweb-members는 항상 실시간 조회 - localStorage 캐시에서 제외 */
  var _CACHE_VER = 'v5.10.20'; /* 버전 변경 시 기존 캐시 전체 무효화 */
  var _NO_PERSIST_KEYS = ['/codi/admin/imweb-members', '/imweb/members'];
  function _isNoPersist(k) {
    return _NO_PERSIST_KEYS.some(function(p) { return k.indexOf(p) !== -1; });
  }
  function _restoreApiCache() {
    try {
      /* ★ 캐시 버전 체크: 버전이 다르면 기존 캐시 전체 삭제 (imweb-members 20개 캐시 강제 제거) */
      var storedVer = localStorage.getItem('codi_cache_ver');
      if (storedVer !== _CACHE_VER) {
        localStorage.removeItem('codi_api_cache');
        localStorage.setItem('codi_cache_ver', _CACHE_VER);
        dlog('캐시 버전 변경(' + storedVer + '→' + _CACHE_VER + ') - 기존 캐시 초기화');
        return;
      }
      var raw = localStorage.getItem('codi_api_cache');
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        Object.keys(saved).forEach(function(k) {
          if (_isNoPersist(k)) return; /* imweb-members는 캐시 복원 제외 */
          _apiCache[k] = { data: saved[k], ts: Date.now() }; /* 복원된 데이터는 fresh로 취급 */
        });
        dlog('API캐시 복원: ' + Object.keys(saved).length + '개');
      }
    } catch(e) { dlog('API캐시복원오류:' + e.message); }
  }
  function _persistApiCache() {
    try {
      var toSave = {};
      Object.keys(_apiCache).forEach(function(k) {
        if (_isNoPersist(k)) return; /* imweb-members는 캐시 저장 제외 */
        if (_apiCache[k] && _apiCache[k].data) toSave[k] = _apiCache[k].data;
      });
      localStorage.setItem('codi_api_cache', JSON.stringify(toSave));
      localStorage.setItem('codi_cache_ver', _CACHE_VER);
    } catch(e) {}
  }

  /* ===== 인증 시작 ===== */
  var _instantRendered = false;
  /* ★ v5.10.14: 캐시 무효화 헬퍼 */
  function _clearAuthCache(){
    authToken='';authMember=null;currentClinic=null;
    try{localStorage.removeItem('dpt_admin_token');localStorage.removeItem('dpt_admin_member');
        localStorage.removeItem('dpt_admin_clinics');localStorage.removeItem('dpt_admin_current_clinic');
        localStorage.removeItem('dpt_imweb_id');}catch(e){}
  }
  function tryAuth() {
    try{authToken=localStorage.getItem('dpt_admin_token')||'';authMember=JSON.parse(localStorage.getItem('dpt_admin_member')||'null');var clinics=JSON.parse(localStorage.getItem('dpt_admin_clinics')||'[]');var saved=localStorage.getItem('dpt_admin_current_clinic');currentClinic=saved?JSON.parse(saved):(clinics[0]||null);}catch(e){}
    if(authToken&&authMember&&currentClinic){
      /* ★ v5.10.17: 이메일 비교 강화 - cachedEmail 없어도 curEmail 있으면 항상 검증 */
      /* __bs_imweb 쿠키는 SDK보다 먼저 읽힘 → 이메일로 신뢰도 높은 비교 가능 */
      var curEmail=getLoginEmail();
      var cachedEmail=(authMember&&authMember.email)||'';
      /* cachedEmail이 없는 오래된 캐시: curEmail이 있으면 무조건 _bgReauth에서 재검증 */
      if(curEmail&&cachedEmail&&curEmail!==cachedEmail){
        dlog('계정 불일치(이메일) - 캐시 무효화: cached='+cachedEmail+' cur='+curEmail);
        _clearAuthCache();
      }
      /* cachedEmail 없는 구버전 캐시: imweb_member_id로 한번 더 검증 */
      if(authToken&&authMember&&!cachedEmail&&curEmail){
        var curMidCheck=getMemberId();
        var storedId=localStorage.getItem('dpt_imweb_id')||'';
        /* storedId가 있고 curMid와 다르면 다른 계정 → 캐시 무효화 */
        if(storedId&&curMidCheck&&!curMidCheck.startsWith('site_')&&storedId!==curMidCheck){
          dlog('계정 불일치(구캐시+ID) - 캐시 무효화: stored='+storedId+' cur='+curMidCheck);
          _clearAuthCache();
        } else if(!storedId){
          /* storedId도 없는 아주 오래된 캐시 → 안전하게 캐시 삭제 후 재인증 */
          dlog('구버전 캐시(email/id 없음) - 캐시 무효화 후 재인증');
          _clearAuthCache();
        }
      }
    }
    if(authToken&&authMember&&currentClinic){
      /* member_id 비교 (SDK 로드됐을 때 추가 검증) */
      var curMidImmediate=getMemberId();
      var cachedMid=(authMember&&authMember.imweb_member_id)||localStorage.getItem('dpt_imweb_id')||'';
      if(curMidImmediate&&!curMidImmediate.startsWith('site_')&&cachedMid&&cachedMid!==curMidImmediate){
        dlog('계정 불일치(ID) - 캐시 무효화: cached='+cachedMid+' cur='+curMidImmediate);
        _clearAuthCache();
      }
    }
    if(authToken&&authMember&&currentClinic){
      dlog('localStorage 즉시 렌더');
      _instantRendered = true;
      _restoreApiCache(); /* ★ API 캐시 복원 → pgPatients에서 캐시 히트 */
      renderApp();
      /* 백그라운드에서 auth 재검증 - 계정/클리닉 불일치 시 renderApp 재호출 */
      _bgReauth();
      return;
    }
    dlog('SDK 감지 시작');spin('계정 확인 중...');
    function tryImmediate(){var mid=getMemberId();var li=isLoggedIn();if(mid&&!mid.startsWith('site_')&&li){var ln=getLoginName();dlog('즉시:id='+mid);try{localStorage.setItem('dpt_imweb_id',mid);}catch(e){}doMatch(mid,ln);return true;}return false;}
    if(!tryImmediate()){var pc=0,pm=20;function tryStart(){var mid=getMemberId();var li=isLoggedIn();if(!li){if(pc>=pm){root.innerHTML='<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af">로그인 후 이용할 수 있습니다.</p></div>';}else{pc++;setTimeout(tryStart,pc<4?100:300);}return;}var isReal=mid&&!mid.startsWith('site_');if(!isReal){if(pc>=pm){mid='site_'+window.location.hostname.replace(/[^a-z0-9]/gi,'');var lnf=getLoginName();if(!lnf){root.innerHTML='<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af">로그인 후 이용할 수 있습니다.</p></div>';return;}doMatch(mid,lnf);return;}else{pc++;setTimeout(tryStart,pc<4?100:300);return;}}try{localStorage.setItem('dpt_imweb_id',mid);}catch(e){}var ln=getLoginName();if(!ln&&pc<pm){pc++;setTimeout(tryStart,pc<4?100:300);return;}doMatch(mid,ln);}tryStart();}
  }

  /* ===== 백그라운드 재인증 (즉시렌더 후 토큰 갱신) ===== */
  function _bgReauth() {
    var mid = getMemberId();
    var curEmail = getLoginEmail();
    /* ★ v5.10.18: 이메일 불일치 또는 구버전 캐시 → 항상 현재 계정으로 재인증 */
    var cachedEmail=(authMember&&authMember.email)||'';
    /* 케이스1: cachedEmail 있고 현재 이메일과 다름 → 확실한 계정 불일치 */
    if(curEmail&&cachedEmail&&curEmail!==cachedEmail){
      dlog('_bgReauth: 이메일 불일치 - 캐시 무효화: cached='+cachedEmail+' cur='+curEmail);
      _clearAuthCache();
      var ln=getLoginName();
      if(!mid||mid.startsWith('site_'))mid='';
      doMatch(mid,ln);
      return;
    }
    /* 케이스2: cachedEmail 없는 구버전 캐시 + 현재 이메일 있음 → 재인증으로 검증 */
    if(curEmail&&!cachedEmail&&authMember){
      dlog('_bgReauth: 구캐시(email없음) - 이메일로 재검증: '+curEmail);
      _clearAuthCache();
      var ln2=getLoginName();
      if(!mid||mid.startsWith('site_'))mid='';
      doMatch(mid,ln2);
      return;
    }
    /* ★ v5.10.18 핵심: mid가 있어도 curEmail이 있으면 서버에 이메일도 함께 전송
       → 서버가 imweb_member_id + email 두 정보로 올바른 계정 특정 가능 */
    /* SDK ID 기반 불일치 감지 */
    if(mid&&!mid.startsWith('site_')){
      var cachedMid=(authMember&&authMember.imweb_member_id)||'';
      if(cachedMid&&cachedMid!==mid){
        dlog('_bgReauth: ID 불일치 - 캐시 무효화 후 신규 매칭: cached='+cachedMid+' sdk='+mid);
        _clearAuthCache();
        var ln=getLoginName();
        doMatch(mid,ln);
        return;
      }
    }
    /* ★ v5.10.16: SDK 미로드 시 localStorage 이전 ID 재사용 금지 */
    /* mid가 빈값이면 현재 로그인 이메일로만 재인증 */
    if (!mid) {
      if(curEmail){
        dlog('_bgReauth: SDK 미로드, 이메일로 재인증: '+curEmail);
        var ln=getLoginName()||'';
        var body={imweb_member_id:'',imweb_name:ln,imweb_email:curEmail,imweb_group:getLoginGroup()||'',imweb_phone:'',imweb_clinic_name:'',imweb_clinic_phone:'',imweb_clinic_addr:''};
        fetch(API+'/api/auth/imweb-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json();})
        .then(function(d){
          if(d.matched&&d.token){
            var prevId=authMember&&authMember.id;var prevCid=currentClinic&&currentClinic.id;
            authToken=d.token;if(d.member)authMember=d.member;var cls=d.clinics||[];if(cls.length)currentClinic=cls[0];
            try{localStorage.setItem('dpt_admin_token',d.token);localStorage.setItem('dpt_admin_member',JSON.stringify(authMember));localStorage.setItem('dpt_admin_clinics',JSON.stringify(cls));if(currentClinic)localStorage.setItem('dpt_admin_current_clinic',JSON.stringify(currentClinic));}catch(e){}
            if((authMember&&authMember.id)!==prevId||(currentClinic&&currentClinic.id)!==prevCid){dlog('이메일 재인증 성공 - renderApp 재호출');renderApp();}
          }
        }).catch(function(e){dlog('이메일재인증오류:'+e.message);});
        return;
      }
      return; /* 이메일도 없으면 스킵 */
    }
    var ln = getLoginName() || (authMember && authMember.name) || '';
    var le = getLoginEmail() || '';
    var lg = getLoginGroup() || '';
    var cn='',cp='';
    try{var te=document.querySelector('title');if(te){var tr=te.textContent.split('|')[0].split('-')[0].trim();if(!isSysWord(tr))cn=tr;}var tls=document.querySelectorAll('a[href^="tel:"]');if(tls.length)cp=(tls[0].getAttribute('href')||'').replace('tel:','');}catch(e){}
    var body={imweb_member_id:mid,imweb_name:ln,imweb_email:le,imweb_group:lg,imweb_phone:'',imweb_clinic_name:cn,imweb_clinic_phone:cp,imweb_clinic_addr:''};
    dlog('백그라운드 auth 시작: id='+mid+' email='+le);
    fetch(API+'/api/auth/imweb-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.matched&&d.token){
        dlog('백그라운드 auth 성공 - 토큰 갱신');
        var prevMemberId=authMember&&authMember.id;
        var prevClinicId=currentClinic&&currentClinic.id;
        var prevName=authMember&&authMember.name;
        authToken=d.token;
        if(d.member)authMember=d.member;
        var clinics=d.clinics||[];
        if(clinics.length)currentClinic=clinics[0];
        try{localStorage.setItem('dpt_admin_token',d.token);localStorage.setItem('dpt_admin_member',JSON.stringify(authMember));localStorage.setItem('dpt_admin_clinics',JSON.stringify(clinics));if(currentClinic)localStorage.setItem('dpt_admin_current_clinic',JSON.stringify(currentClinic));}catch(e){}
        /* ★ v5.10.18: 계정/클리닉/이름 중 하나라도 변경되면 renderApp 재호출 */
        var newMemberId=d.member&&d.member.id;
        var newClinicId=currentClinic&&currentClinic.id;
        var newName=d.member&&d.member.name;
        if(prevMemberId!==newMemberId||prevClinicId!==newClinicId||prevName!==newName){
          dlog('백그라운드 auth: 변경 감지(id:'+prevMemberId+'→'+newMemberId+' name:'+prevName+'→'+newName+') → renderApp 재호출');
          renderApp();
        }
      } else if(d.need_name || !d.matched) {
        dlog('백그라운드 auth 실패 - 세션 클리어');
        authToken='';authMember=null;currentClinic=null;
        try{localStorage.removeItem('dpt_admin_token');localStorage.removeItem('dpt_admin_member');localStorage.removeItem('dpt_admin_clinics');localStorage.removeItem('dpt_admin_current_clinic');}catch(e){}
        errUI('세션이 만료되었습니다. 새로고침해 주세요.');
      }
    }).catch(function(e){dlog('백그라운드 auth 오류(무시):'+e.message);});
  }

  /* ===== 메인 렌더링 ===== */
  function renderApp() {
    var mn=escH(authMember.name||CN());
    var rl={super_admin:'최고관리자',clinic_admin:'관리자'}[authMember.role]||'관리자';
    root.innerHTML='<div class="codi-app-loaded" id="codi-app" style="font-family:Noto Sans KR,sans-serif">'
      +'<div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:16px 20px;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">'
      +'<div><div style="font-size:18px;font-weight:700">'+mn+'</div><div style="font-size:12px;opacity:.8;margin-top:2px">'+rl+' · 모바일 코디</div></div>'
      +'<button id="codi-lo" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">로그아웃</button></div>'
      +'<div id="codi-nav" style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 8px;overflow-x:auto;white-space:nowrap"></div>'
      +'<div id="codi-pg" style="background:#f9fafb;padding:16px;border-radius:0 0 12px 12px;min-height:400px;border:1px solid #e5e7eb;border-top:none"></div></div>';
    var tabs=[['patients','오늘 환자'],['links','링크 관리'],['history','전송 기록'],['settings','설정']];
    if (authMember && authMember.role === 'super_admin') tabs.push(['admin','관리']);
    var nav=document.getElementById('codi-nav');
    tabs.forEach(function(t){
      var b=document.createElement('button');
      b.className='codi-nb';b.setAttribute('data-p',t[0]);
      b.style.cssText='display:inline-block;padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap';
      b.textContent=t[1];
      b.addEventListener('click',function(){currentPage=t[0];renderPage();});
      nav.appendChild(b);
    });
    document.getElementById('codi-lo').addEventListener('click',function(){
      authToken='';authMember=null;currentClinic=null;
      try{localStorage.removeItem('dpt_admin_token');localStorage.removeItem('dpt_admin_member');localStorage.removeItem('dpt_admin_clinics');localStorage.removeItem('dpt_admin_current_clinic');localStorage.removeItem('codi_api_cache');}catch(e){}
      root.innerHTML='<div style="padding:20px;text-align:center"><p style="color:#2563eb;font-weight:600;font-size:14px">로그아웃 되었습니다.<br>새로고침해 주세요.</p></div>';
    });
    /* ★ 프리페치를 renderPage 전에 fire → pgPatients의 callAPI가 이미 진행 중인 fetch를 재사용 */
    var _cid = CID();
    var _prefetchList = [];
    if (_cid) {
      _prefetchList.push(callAPI('/codi/summary?clinic_id=' + _cid).catch(function(){}));
      _prefetchList.push(callAPI('/codi/link-templates?clinic_id=' + _cid).catch(function(){}));
      _prefetchList.push(callAPI('/codi/patients?clinic_id=' + _cid + '&today=true&limit=50').catch(function(){}));
      var _today = new Date().toISOString().slice(0,10);
      _prefetchList.push(callAPI('/codi/patient-links?clinic_id=' + _cid + '&from=' + _today + '&to=' + _today).catch(function(){}));
      /* super_admin이면 관리 탭 API도 프리페치 */
      if (authMember && authMember.role === 'super_admin') {
        _prefetchList.push(callAPI('/codi/admin/clinics').catch(function(){}));
        /* ★ v5.10.20: imweb-members는 항상 실시간 조회이므로 프리페치에서 제외 */
      }
      /* 프리페치 완료 후 API 캐시를 localStorage에 저장 (다음 진입 시 즉시 렌더용) */
      Promise.all(_prefetchList).then(function(){ _persistApiCache(); }).catch(function(){});
    }
    renderPage();
  }

  function updNav(){document.querySelectorAll('.codi-nb').forEach(function(b){var a=b.getAttribute('data-p')===currentPage;b.style.color=a?'#2563eb':'#6b7280';b.style.fontWeight=a?'700':'500';b.style.borderBottomColor=a?'#2563eb':'transparent';});}

  function renderPage(){updNav();var pg=document.getElementById('codi-pg');if(!pg)return;var prevH=pg.offsetHeight;if(prevH>0)pg.style.minHeight=prevH+'px';({patients:pgPatients,links:pgLinks,history:pgHistory,settings:pgSettings,admin:pgAdmin}[currentPage]||pgPatients)(pg);setTimeout(function(){pg.style.minHeight='400px';},50);}

  /* ================================================================ */
  /* 메모 폴더 시스템 (localStorage)                                    */
  /* ================================================================ */
  function loadMemoData() {
    try {
      var d = JSON.parse(localStorage.getItem('codi_memo_' + CID()) || 'null');
      if (d && d.folders) return d;
    } catch(e) {}
    return { folders: [], templates: {} };
  }
  function saveMemoData(d) { try { localStorage.setItem('codi_memo_' + CID(), JSON.stringify(d)); } catch(e) {} }

  function addMemoFolder(name) {
    var d = loadMemoData();
    if (d.folders.indexOf(name) === -1) { d.folders.push(name); d.templates[name] = d.templates[name] || []; saveMemoData(d); }
  }
  function deleteMemoFolder(name) {
    var d = loadMemoData();
    d.folders = d.folders.filter(function(f) { return f !== name; });
    delete d.templates[name];
    saveMemoData(d);
  }
  function addMemoTemplate(folder, tpl) {
    var d = loadMemoData();
    if (!d.templates[folder]) d.templates[folder] = [];
    if (d.templates[folder].indexOf(tpl) === -1) { d.templates[folder].push(tpl); saveMemoData(d); }
  }
  function deleteMemoTemplate(folder, tpl) {
    var d = loadMemoData();
    if (d.templates[folder]) {
      d.templates[folder] = d.templates[folder].filter(function(t) { return t !== tpl; });
      saveMemoData(d);
    }
  }

  /* ================================================================ */
  /* 탭 1: 오늘 환자 - 환자 리스트 + 링크전송 확장                       */
  /* ================================================================ */
  var searchTimer = null;

  function pgPatients(el) {
    if (!_getStale('/codi/summary?clinic_id=' + CID()) || !_getStale('/codi/link-templates?clinic_id=' + CID()) || !_getStale('/codi/patients?clinic_id=' + CID() + '&today=true&limit=50')) el.innerHTML = SPIN;

    Promise.all([
      callAPI('/codi/summary?clinic_id=' + CID()),
      callAPI('/codi/link-templates?clinic_id=' + CID()),
      callAPI('/codi/patients?clinic_id=' + CID() + '&today=true&limit=50')
    ]).then(function(res) {
      var summary = res[0] || {};
      var templates = res[1].templates || [];
      var initPats = res[2].patients || [];
      var totalPats = res[2].total || 0;
      var showingToday = true;

      dlog('tpl=' + templates.length + ', todayPats=' + totalPats);

      /* 백그라운드에서 최신 summary/templates 가져와 카드 갱신 */
      Promise.all([
        callAPI('/codi/summary?clinic_id=' + CID(), {noCache:true}),
        callAPI('/codi/link-templates?clinic_id=' + CID(), {noCache:true})
      ]).then(function(fresh) {
        var fs = fresh[0] || {};
        var ft = fresh[1].templates || [];
        var cards = el.querySelectorAll('[data-scard]');
        cards.forEach(function(card) {
          var label = card.getAttribute('data-scard');
          var valEl = card.querySelector('div:last-child');
          if (!valEl) return;
          if (label === '오늘 전송') valEl.textContent = F(fs.today_count||0) + '건';
          else if (label === '전체 환자') valEl.textContent = F(fs.total_patients||0) + '명';
          else if (label === '등록 링크') valEl.textContent = F(ft.length) + '개';
        });
      }).catch(function(){});

      el.innerHTML = '<div style="animation:codiFadeIn .3s ease">'
        /* 요약 */
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">'
        + sCard('오늘 전송', F(summary.today_count||0)+'건','#2563eb', true)
        + sCard('전체 환자', F(summary.total_patients||0)+'명','#374151', false)
        + sCard('등록 링크', F(templates.length)+'개','#374151', false)
        + '</div>'
        /* 직접 입력 카드 */
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:14px">' 
        + '<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px">' 
        + '<span style="font-size:15px;font-weight:700;color:#1f2937">직접 입력</span>' 
        + '<span style="font-size:11px;color:#9ca3af">새 환자 / 업로드 전 환자</span></div>' 
        + '<div style="padding:12px 16px">' 
        + '<div style="display:flex;gap:6px;align-items:center">' 
        + '<input id="codi-direct-name" type="text" placeholder="환자 이름" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">' 
        + '<input id="codi-direct-phone" type="text" placeholder="전화번호 (선택)" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">' 
        + '<button id="codi-direct-btn" style="padding:10px 16px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">링크전송</button>' 
        + '</div></div></div>' 
        /* 환자 카드 */
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
        + '<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:15px;font-weight:700;color:#1f2937">환자 선택</span>'
        + '<span id="codi-badge" style="font-size:11px;color:#9ca3af;margin-left:auto">오늘 '+F(totalPats)+'명</span></div>'
        + '<div style="padding:12px 16px">'
        + '<input id="codi-search" type="text" placeholder="이름, 전화번호, 차트번호로 전체 검색" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;margin-bottom:12px">'
        + '<div id="codi-plist" style="overflow-y:auto"></div>'
        + '<div id="codi-more-wrap" style="text-align:center;padding:8px;display:none"><button id="codi-more-btn" style="padding:8px 20px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit">더 보기</button></div>'
        + '</div></div></div>';

      var listEl = document.getElementById('codi-plist');
      var curPats = initPats, curPage = 1, curSearch = '', loading = false;

      function renderList(pats, append) {
        if (!append && pats.length === 0) {
          listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">'
            + (showingToday ? '오늘 방문 환자가 없습니다.'
              + '<br><button id="codi-show-all" style="margin-top:10px;padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">전체 환자 보기</button>'
              : '검색 결과가 없습니다')
            + '</div>';
          document.getElementById('codi-more-wrap').style.display='none';
          /* 전체 환자 보기 버튼 */
          var saBtn = document.getElementById('codi-show-all');
          if (saBtn) saBtn.addEventListener('click', function() {
            showingToday = false; curSearch = ''; curPage = 1;
            listEl.innerHTML = SPIN;
            callAPI('/codi/patients?clinic_id=' + CID() + '&limit=50').then(function(r) {
              curPats = r.patients || [];
              document.getElementById('codi-badge').textContent = '전체 ' + F(r.total || 0) + '명';
              renderList(curPats, false);
              document.getElementById('codi-more-wrap').style.display = curPats.length >= 50 ? 'block' : 'none';
              document.getElementById('codi-search').placeholder = '이름, 전화번호, 차트번호로 검색';
            });
          });
          return;
        }
        var html = pats.map(function(p) {
          var lv = p.last_visit_date ? p.last_visit_date.slice(0,10) : (p.last_payment_date ? p.last_payment_date.slice(0,10) : '');
          var tr = p.last_treatment||'';
          var pts = p.available_points||0;
          return '<div data-pid="'+p.id+'" style="padding:12px 0;border-bottom:1px solid #f3f4f6">'
            +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
            +'<div style="flex:1;min-width:0">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
            +'<span style="font-size:14px;font-weight:600;color:#1f2937">'+escH(p.name)+'</span>'
            +(p.chart_number?'<span style="font-size:11px;color:#9ca3af;background:#f3f4f6;padding:1px 6px;border-radius:4px">'+escH(p.chart_number)+'</span>':'')
            +'</div>'
            +'<div style="font-size:12px;color:#6b7280">'+(p.phone?escH(p.phone):'<span style="color:#d1d5db">번호없음</span>')+(lv?' · '+lv:'')+(tr?' · '+escH(tr):'')+'</div>'
            +(pts>0?'<div style="font-size:11px;color:#2563eb;margin-top:2px">포인트 '+F(pts)+'P</div>':'')
            +'</div>'
            +'<button data-send="'+p.id+'" style="padding:6px 12px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;margin-left:8px">링크전송</button>'
            +'</div>'
            +'<div id="codi-ex-'+p.id+'" style="display:none"></div>'
            +'</div>';
        }).join('');
        if (append) listEl.insertAdjacentHTML('beforeend', html);
        else listEl.innerHTML = html;
      }

      renderList(initPats, false);
      if (initPats.length >= 50) document.getElementById('codi-more-wrap').style.display='block';

      /* 더보기 */
      document.getElementById('codi-more-btn').addEventListener('click', function() {
        if(loading)return; loading=true; this.textContent='로딩 중...'; var btn=this;
        curPage++;
        var url='/codi/patients?clinic_id='+CID()+'&page='+curPage+'&limit=50';
        if(curSearch)url+='&search='+encodeURIComponent(curSearch); else url+='&today=true';
        callAPI(url).then(function(r){var np=r.patients||[];curPats=curPats.concat(np);renderList(np,true);if(np.length<50)document.getElementById('codi-more-wrap').style.display='none';btn.textContent='더 보기';loading=false;}).catch(function(){btn.textContent='더 보기';loading=false;});
      });

      /* 검색 */
      document.getElementById('codi-search').addEventListener('input', function() {
        var q=this.value.trim(); curSearch=q; curPage=1;
        clearTimeout(searchTimer);
        searchTimer=setTimeout(function(){
          listEl.innerHTML=SPIN;
          if(!q){showingToday=true;callAPI('/codi/patients?clinic_id='+CID()+'&today=true&limit=50').then(function(r){curPats=r.patients||[];document.getElementById('codi-badge').textContent='오늘 '+F(r.total||0)+'명';renderList(curPats,false);document.getElementById('codi-more-wrap').style.display=curPats.length>=50?'block':'none';});return;}
          showingToday=false;
          callAPI('/codi/patients?clinic_id='+CID()+'&search='+encodeURIComponent(q)+'&limit=50').then(function(r){curPats=r.patients||[];document.getElementById('codi-badge').textContent='검색 '+F(r.total||0)+'명';renderList(curPats,false);document.getElementById('codi-more-wrap').style.display=curPats.length>=50?'block':'none';}).catch(function(err){listEl.innerHTML='<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';});
        },300);
      });

      /* 직접 입력 -> 확장 영역 */
      var directEx = null;
      document.getElementById('codi-direct-btn').addEventListener('click', function() {
        var dname = document.getElementById('codi-direct-name').value.trim();
        if (!dname) { toast('환자 이름을 입력하세요', 'error'); return; }
        var dphone = document.getElementById('codi-direct-phone').value.trim();
        /* 직접 입력용 가상 환자 */
        var directPatient = { id: 'direct_' + Date.now(), name: dname, phone: dphone };
        /* 기존 확장 영역 닫기 */
        document.querySelectorAll('[id^="codi-ex-"]').forEach(function(el2) { el2.style.display='none'; });
        if (directEx) directEx.remove();
        directEx = document.createElement('div');
        directEx.id = 'codi-ex-direct';
        directEx.style.cssText = 'margin-top:10px';
        document.getElementById('codi-direct-btn').parentNode.parentNode.appendChild(directEx);
        directEx.innerHTML = SPIN;
        /* 항상 최신 템플릿 로드 */
        callAPI('/codi/link-templates?clinic_id=' + CID(), {noCache:true}).then(function(r) {
          var freshTpls = r.templates || [];
          renderExpandArea(directEx, directPatient, freshTpls, function onLinkCreated() {
            directEx.remove(); directEx = null;
            document.getElementById('codi-direct-name').value = '';
            document.getElementById('codi-direct-phone').value = '';
            /* 검색창 초기화 → 오늘 환자 목록으로 복귀 */
            var searchBox = document.getElementById('codi-search');
            if (searchBox && searchBox.value) {
              searchBox.value = '';
              searchBox.dispatchEvent(new Event('input'));
            }
            callAPI('/codi/summary?clinic_id=' + CID()).then(function(s) {
              var cards = summaryEl.querySelectorAll('[data-scard]');
              if (cards.length >= 1) cards[0].querySelector('div:last-child').textContent = F(s.today_count||0)+'건';
            }).catch(function(){});
          });
        }).catch(function() { renderExpandArea(directEx, directPatient, templates, function() { directEx.remove(); directEx=null; }); });
      });

      /* 링크전송 버튼 -> 확장 영역 */
      var summaryEl = el; /* 요약 갱신을 위한 참조 */
      listEl.addEventListener('click', function(e) {
        var sb = e.target.closest('[data-send]');
        if (!sb) return;
        var pid = sb.getAttribute('data-send');
        var ex = document.getElementById('codi-ex-' + pid);
        if (!ex) return;
        if (ex.style.display === 'block') { ex.style.display = 'none'; return; }
        document.querySelectorAll('[id^="codi-ex-"]').forEach(function(el2) { el2.style.display='none'; });
        var patient = curPats.find(function(p) { return String(p.id) === String(pid); });
        if (!patient) return;
        ex.style.display = 'block';
        ex.innerHTML = SPIN;
        /* 항상 최신 템플릿을 가져와서 드롭다운에 표시 */
        callAPI('/codi/link-templates?clinic_id=' + CID(), {noCache:true}).then(function(r) {
          var freshTpls = r.templates || [];
          renderExpandArea(ex, patient, freshTpls, function onLinkCreated() {
            /* 링크 생성 후: 확장영역 초기화 + 닫기 + 요약카드 갱신 + 검색 리셋 */
            ex.innerHTML = '';
            ex.style.display = 'none';
            /* 검색창 초기화 → 오늘 환자 목록으로 복귀 */
            var searchBox = document.getElementById('codi-search');
            if (searchBox && searchBox.value) {
              searchBox.value = '';
              searchBox.dispatchEvent(new Event('input'));
            }
            callAPI('/codi/summary?clinic_id=' + CID()).then(function(s) {
              var cards = summaryEl.querySelectorAll('[data-scard]');
              if (cards.length >= 1) cards[0].querySelector('div:last-child').textContent = F(s.today_count||0)+'건';
            }).catch(function(){});
          });
        }).catch(function() { renderExpandArea(ex, patient, templates, function() { ex.style.display='none'; }); });
      });

    }).catch(function(err) {
      el.innerHTML='<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';
    });
  }

  /* ===== 링크전송 확장 영역 (v1.7: 문구선택 항상표시, 생성후 닫기+갱신) ===== */
  function renderExpandArea(ex, patient, templates, onDone) {
    var pid = patient.id;
    var memoData = loadMemoData();

    /* 커스텀 드롭다운용 데이터 준비 - 공용/개별 분리 */
    var globalTpls = templates.filter(function(t) { return String(t.clinic_id) === '0' || !t.clinic_id; });
    var clinicTpls = templates.filter(function(t) { return t.clinic_id && String(t.clinic_id) !== '0'; });
    var allItems = [];
    /* 개별 치과 링크가 있을 때만 그룹 분리, 없으면 전체를 플랫하게 표시 */
    if (clinicTpls.length > 0) {
      if (globalTpls.length > 0) {
        allItems.push({type:'header', label:'공용 전체 링크'});
        globalTpls.forEach(function(t) { allItems.push({type:'item', tpl:t}); });
      }
      allItems.push({type:'header', label:'우리 치과 링크'});
      clinicTpls.forEach(function(t) { allItems.push({type:'item', tpl:t}); });
    } else {
      /* 개별 없으면 그냥 전체를 헤더 없이 표시 */
      globalTpls.forEach(function(t) { allItems.push({type:'item', tpl:t}); });
    }

    function buildDropdownItems() {
      return allItems.map(function(item, idx) {
        if (item.type === 'header') {
          return '<div style="padding:6px 10px;font-size:11px;font-weight:700;color:#6b7280;background:#f3f4f6;border-bottom:1px solid #e5e7eb">' + item.label + '</div>';
        }
        var t = item.tpl;
        var thumb = t.thumbnail
          ? '<img src="'+escH(t.thumbnail)+'" style="width:32px;height:32px;border-radius:4px;object-fit:cover;flex-shrink:0;border:1px solid #e5e7eb">'
          : '<div style="width:32px;height:32px;border-radius:4px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #e5e7eb"><i class="fas fa-link" style="color:#9ca3af;font-size:11px"></i></div>';
        return '<div data-tplid="'+escH(t.id)+'" style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background .1s" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'#fff\'">'
          + thumb
          + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
          + '<div style="font-size:10px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div></div>';
      }).join('');
    }

    ex.innerHTML = '<div style="margin-top:8px;padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;animation:codiFadeIn .3s ease">'

      /* 1. 커스텀 링크선택 드롭다운 */
      + '<div id="codi-dd-wrap-' + pid + '" style="position:relative;margin-bottom:6px">'
      + '<div id="codi-dd-btn-' + pid + '" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;background:#fff;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;min-height:38px">'
      + '<span id="codi-dd-label-' + pid + '" style="flex:1;color:#9ca3af">링크를 선택하세요</span>'
      + '<i class="fas fa-chevron-down" style="color:#9ca3af;font-size:10px"></i></div>'
      + '<div id="codi-dd-list-' + pid + '" style="display:none;position:relative;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.08);z-index:9999;margin-top:2px">'
      + buildDropdownItems() + '</div>'
      + '<input type="hidden" id="codi-tpl-' + pid + '" value="">'
      + '</div>'

      /* 2. 환자이름 (자동입력) */
      + '<input id="codi-pname-' + pid + '" type="text" value="' + escH(patient.name) + '" placeholder="환자 이름" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;background:#fff;margin-bottom:6px">'

      /* 3. 문구 태그 영역 (링크명과 일치하는 폴더의 문구 자동 표시) */
      + '<div id="codi-mtpl-' + pid + '" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;min-height:0"></div>'

      /* 4. 메모 입력 */
      + '<input id="codi-memo-' + pid + '" type="text" placeholder="메모 입력 (선택)" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;background:#fff;margin-bottom:6px">'

      /* 5. 생성 버튼 */
      + '<div>'
      + '<button id="codi-gen-' + pid + '" style="width:100%;padding:10px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">링크 생성 + 복사</button></div>'
      + '</div>';

    /* === 커스텀 드롭다운 이벤트 === */
    var ddBtn = document.getElementById('codi-dd-btn-' + pid);
    var ddList = document.getElementById('codi-dd-list-' + pid);
    var ddLabel = document.getElementById('codi-dd-label-' + pid);
    var ddHidden = document.getElementById('codi-tpl-' + pid);
    var ddOpen = false;

    ddBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      ddOpen = !ddOpen;
      ddList.style.display = ddOpen ? 'block' : 'none';
    });
    document.addEventListener('click', function(e) {
      if (ddOpen && !ddBtn.contains(e.target) && !ddList.contains(e.target)) {
        ddOpen = false; ddList.style.display = 'none';
      }
    });
    ddList.addEventListener('click', function(e) {
      var item = e.target.closest('[data-tplid]');
      if (!item) return;
      var tid = item.getAttribute('data-tplid');
      var tpl = templates.find(function(t) { return String(t.id) === String(tid); });
      if (!tpl) return;
      ddHidden.value = tid;
      /* 선택된 항목을 버튼에 썸네일+이름으로 표시 */
      var thumb = tpl.thumbnail
        ? '<img src="'+escH(tpl.thumbnail)+'" style="width:28px;height:28px;border-radius:4px;object-fit:cover;flex-shrink:0;border:1px solid #e5e7eb">'
        : '<div style="width:28px;height:28px;border-radius:4px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #e5e7eb"><i class="fas fa-link" style="color:#9ca3af;font-size:10px"></i></div>';
      ddLabel.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' + thumb + '<span style="color:#1f2937;font-weight:500">'+escH(tpl.name)+'</span></div>';
      ddOpen = false; ddList.style.display = 'none';
      /* 트리거 change 로직 */
      onTplSelect(tpl);
    });

    function onTplSelect(tpl) {
      var memoEl = document.getElementById('codi-memo-' + pid);
      /* 링크명과 일치하는 폴더의 문구 표시 */
      var d = loadMemoData();
      var linkedTpls = d.templates[tpl.name] || [];
      dlog('링크선택: ' + tpl.name + ', 연동문구=' + linkedTpls.length + '개');
      renderLinkedMemos(tpl.name);
      /* 연동된 문구가 있으면 첫 번째 문구를 메모에 자동 입력, 없으면 default_memo 또는 빈칸 */
      if (memoEl) {
        if (linkedTpls.length > 0) {
          memoEl.value = linkedTpls[0];
          memoEl.style.borderColor = '#2563eb';
          memoEl.style.background = '#f0f7ff';
          setTimeout(function() { memoEl.style.borderColor = '#d1d5db'; memoEl.style.background = '#fff'; }, 1500);
        } else if (tpl.default_memo) {
          memoEl.value = tpl.default_memo;
        } else {
          memoEl.value = '';
        }
      }
    }

    function renderLinkedMemos(linkName) {
      var box = document.getElementById('codi-mtpl-' + pid);
      if (!box) return;
      if (!linkName) { box.innerHTML = ''; return; }
      var d = loadMemoData();
      var tpls = d.templates[linkName] || [];
      if (tpls.length === 0) { box.innerHTML = ''; return; }
      box.innerHTML = tpls.map(function(t) {
        return '<span data-mpick="' + escH(t) + '" style="display:inline-block;padding:5px 10px;background:#fef3c7;border:1px solid #fde68a;border-radius:16px;font-size:12px;cursor:pointer;color:#92400e">' + escH(t) + '</span>';
      }).join(' ');
    }

    /* === 문구 클릭 → 메모창에 입력 === */
    document.getElementById('codi-mtpl-' + pid).addEventListener('click', function(ev) {
      var pick = ev.target.closest('[data-mpick]');
      if (pick) { document.getElementById('codi-memo-' + pid).value = pick.getAttribute('data-mpick'); }
    });

    /* === 폼 초기화 함수 === */
    function resetForm() {
      document.getElementById('codi-tpl-' + pid).value = '';
      ddLabel.innerHTML = '<span style="color:#9ca3af">링크를 선택하세요</span>';
      document.getElementById('codi-memo-' + pid).value = '';
      renderLinkedMemos('');
    }

    /* === 링크 생성 === */
    document.getElementById('codi-gen-' + pid).addEventListener('click', function() {
      var tplId = document.getElementById('codi-tpl-' + pid).value;
      if (!tplId) { toast('링크를 선택하세요', 'error'); return; }
      var tpl = templates.find(function(t) { return t.id === tplId; });
      if (!tpl) return;
      var pname = document.getElementById('codi-pname-' + pid).value.trim() || patient.name;
      var memo = document.getElementById('codi-memo-' + pid).value.trim();
      var pphone = patient.phone || CPHONE() || '';
      var clinicName = CN() || '';
      /* 원본 URL만 서버로 전달 (파라미터 없이) - 서버가 short URL 생성 */
      var btn = this;
      btn.disabled = true; btn.textContent = '생성 중...';

      callAPI('/codi/patient-links', {
        method: 'POST',
        body: JSON.stringify({
          patient: pname, patient_id: patient.id, memo: memo,
          clinic: clinicName, phone: pphone,
          url: tpl.url, link_name: tpl.name, thumbnail: tpl.thumbnail || '',
          clinic_id: CID()
        })
      }).then(function(r) {
        btn.disabled = false; btn.textContent = '링크 생성 + 복사';
        if (r.success) {
          /* 자동 복사 후 바로 닫기 (결과 박스 없음) */
          if (navigator.clipboard) navigator.clipboard.writeText(r.shortUrl).then(function() { toast('링크가 복사되었습니다! ' + r.shortUrl); });
          else { fallbackCopy(r.shortUrl); toast('링크가 복사되었습니다!'); }
          resetForm();
          if (onDone) setTimeout(function() { onDone(); }, 800);
        } else toast(r.error || '생성 실패', 'error');
      }).catch(function(err) { btn.disabled = false; btn.textContent = '링크 생성 + 복사'; toast('오류: ' + err.message, 'error'); });
    });

  }

  function sCard(label, value, color, isAccent) {
    var border = isAccent ? 'border-left:3px solid '+color+';border-top:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb' : 'border:1px solid #e5e7eb';
    return '<div data-scard="'+label+'" style="background:#fff;border-radius:10px;padding:12px 14px;'+border+'">'
      +'<div style="font-size:11px;color:#6b7280;margin-bottom:4px">'+label+'</div>'
      +'<div style="font-size:18px;font-weight:700;color:'+color+'">'+value+'</div></div>';
  }

  /* ================================================================ */
  /* 탭 2: 링크 관리                                                   */
  /* ================================================================ */
  function pgLinks(el) {
    if (!_getStale('/codi/link-templates?clinic_id=' + CID())) el.innerHTML = SPIN;
    callAPI('/codi/link-templates?clinic_id=' + CID()).then(function(res) {
      var tpls = res.templates || [];
      var globalTpls = tpls.filter(function(t) { return !t.clinic_id || String(t.clinic_id) === '0'; });
      var clinicTpls = tpls.filter(function(t) { return t.clinic_id && String(t.clinic_id) !== '0'; });
      renderLinksUI(el, tpls, globalTpls, clinicTpls);
      /* 백그라운드 최신 데이터로 UI 갱신 */
      callAPI('/codi/link-templates?clinic_id=' + CID(), {noCache:true}).then(function(res2) {
        var tpls2 = res2.templates || [];
        var g2 = tpls2.filter(function(t) { return !t.clinic_id || String(t.clinic_id) === '0'; });
        var c2 = tpls2.filter(function(t) { return t.clinic_id && String(t.clinic_id) !== '0'; });
        /* 데이터가 달라졌으면 리렌더 */
        if (JSON.stringify(tpls) !== JSON.stringify(tpls2)) {
          dlog('link-templates 캐시 불일치 - UI 갱신');
          renderLinksUI(el, tpls2, g2, c2);
        }
      }).catch(function(){});
    }).catch(function(err){el.innerHTML='<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';});
  }

  function renderLinksUI(el, tpls, globalTpls, clinicTpls) {

      function renderLinkGroup(items) {
        return items.map(function(t){
          var isGlobal = String(t.clinic_id) === '0';
          var badge = isGlobal ? '<span style="display:inline-block;padding:1px 6px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:10px;font-size:9px;margin-left:6px">공용</span>' : '';
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6">'
            +(t.thumbnail?'<img src="'+escH(t.thumbnail)+'" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid #e5e7eb">':'<div style="width:52px;height:52px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #e5e7eb"><i class="fas fa-link" style="color:#9ca3af;font-size:16px"></i></div>')
            +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">'+escH(t.name)+badge+'</div>'
            +'<div style="font-size:11px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div>'
            +(t.default_memo?'<div style="font-size:10px;color:#2563eb;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><i class="fas fa-comment-dots" style="margin-right:3px;font-size:9px"></i>'+escH(t.default_memo)+'</div>':'')+'</div>'
            +(isGlobal ? '' : '<div style="display:flex;gap:4px;flex-shrink:0">'
            +'<button data-et="'+t.id+'" style="padding:5px 10px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit">수정</button>'
            +'<button data-dt="'+t.id+'" style="padding:5px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit">삭제</button></div>')
            +'</div>';
        }).join('');
      }

      var globalHtml = globalTpls.length > 0
        ? '<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:#16a34a;margin-bottom:6px;padding:4px 0">공용 전체 링크 ('+globalTpls.length+'개)</div>' + renderLinkGroup(globalTpls) + '</div>' : '';
      var clinicHtml = clinicTpls.length > 0
        ? '<div><div style="font-size:12px;font-weight:600;color:#2563eb;margin-bottom:6px;padding:4px 0">우리 치과 링크 ('+clinicTpls.length+'개)</div>' + renderLinkGroup(clinicTpls) + '</div>' : '';

      el.innerHTML = '<div style="animation:codiFadeIn .3s ease">'
        /* 링크 추가 (상단) */
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:14px">'
        + '<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:15px;font-weight:700;color:#1f2937">우리 치과 링크 추가</span></div>'
        + '<div style="padding:12px 16px">'
        + '<div style="font-size:12px;color:#6b7280;margin-bottom:10px">우리 치과 전용 링크를 추가합니다. 추가된 링크는 전체 링크와 링크전송에 자동 반영됩니다.</div>'
        + '<button id="codi-add-link" style="width:100%;padding:10px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ 새 링크 추가</button>'
        + '</div></div>'
        /* 전체 링크 목록 */
        + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
        + '<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb">'
        + '<span style="font-size:15px;font-weight:700;color:#1f2937">전체 링크</span></div>'
        + '<div id="codi-ll" style="padding:12px 16px">'
        + (tpls.length===0?'<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">등록된 링크가 없습니다.</div>':
          globalHtml + clinicHtml)
        +'</div></div>'
        + '</div>';
      document.getElementById('codi-add-link').addEventListener('click',function(){showLinkModal(null,function(){pgLinks(el);});});
      el.addEventListener('click',function(e){
        var eb=e.target.closest('[data-et]');if(eb){var t=tpls.find(function(x){return x.id===eb.getAttribute('data-et');});if(t)showLinkModal(t,function(){pgLinks(el);});}
        var db=e.target.closest('[data-dt]');if(db){showDeleteModal('이 링크를 삭제하시겠습니까?',function(){callAPI('/codi/link-templates/'+db.getAttribute('data-dt'),{method:'DELETE'}).then(function(){toast('삭제됨');pgLinks(el);});});}
      });
  }

  function showLinkModal(tpl, onDone) {
    var m=document.createElement('div');
    m.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif';
    m.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:400px;max-height:90vh;overflow-y:auto">'
      +'<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 16px">'+(tpl?'링크 수정':'링크 추가')+'</h3>'
      +'<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">이름</label><input id="codi-m-n" type="text" value="'+escH(tpl?tpl.name:'')+'" placeholder="예: All-on-4 안내" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box"></div>'
      +'<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">URL</label><input id="codi-m-u" type="text" value="'+escH(tpl?tpl.url:'')+'" placeholder="https://..." style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box"></div>'
      +'<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">썸네일 <span style="color:#9ca3af;font-weight:400">(자동 추출 - URL 입력 시 자동으로 가져옵니다)</span></label>'
      +'<div style="display:flex;gap:6px;align-items:center"><input id="codi-m-t" type="text" value="'+escH(tpl?tpl.thumbnail||'':'')+'" placeholder="자동 추출 또는 직접 입력" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
      +'<button id="codi-m-og" style="padding:10px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap" title="URL에서 썸네일 자동 추출"><i class="fas fa-image" style="margin-right:4px"></i>추출</button></div>'
      +'<div id="codi-m-t-preview" style="margin-top:6px"></div></div>'
      +'<div style="margin-bottom:16px"><label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">기본 메모 <span style="color:#9ca3af;font-weight:400">(링크 선택 시 자동 입력)</span></label><textarea id="codi-m-dm" rows="3" placeholder="링크 선택 시 메모에 자동 표시될 문구" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;resize:vertical">'+escH(tpl?tpl.default_memo||'':'')+'</textarea></div>'
      +'<div style="display:flex;gap:8px"><button id="codi-m-c" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button>'
      +'<button id="codi-m-s" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">저장</button></div></div>';
    document.body.appendChild(m);
    
    /* 썸네일 미리보기 */
    function updateThumbPreview() {
      var preview = document.getElementById('codi-m-t-preview');
      var th = document.getElementById('codi-m-t').value.trim();
      if (th && preview) {
        preview.innerHTML = '<img src="'+escH(th)+'" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:1px solid #e5e7eb">';
      } else if (preview) { preview.innerHTML = ''; }
    }
    updateThumbPreview();
    document.getElementById('codi-m-t').addEventListener('change', updateThumbPreview);
    
    /* OG 이미지 자동 추출 */
    function fetchOgImage() {
      var url = document.getElementById('codi-m-u').value.trim();
      if (!url) { toast('URL을 먼저 입력하세요', 'error'); return; }
      var ogBtn = document.getElementById('codi-m-og');
      ogBtn.disabled = true; ogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      callAPI('/codi/og-image?url=' + encodeURIComponent(url)).then(function(r) {
        ogBtn.disabled = false; ogBtn.innerHTML = '<i class="fas fa-image" style="margin-right:4px"></i>추출';
        if (r.thumbnail) {
          document.getElementById('codi-m-t').value = r.thumbnail;
          updateThumbPreview();
          toast('썸네일을 자동으로 가져왔습니다!');
        } else { toast('이 URL에서 썸네일을 찾을 수 없습니다', 'error'); }
      }).catch(function() {
        ogBtn.disabled = false; ogBtn.innerHTML = '<i class="fas fa-image" style="margin-right:4px"></i>추출';
        toast('썸네일 추출 실패', 'error');
      });
    }
    document.getElementById('codi-m-og').addEventListener('click', fetchOgImage);
    /* URL 입력 시 자동 추출 시도 (신규 링크만, 썸네일 비어있을 때) */
    var urlFetchTimer = null;
    document.getElementById('codi-m-u').addEventListener('blur', function() {
      if (!tpl && !document.getElementById('codi-m-t').value.trim() && this.value.trim()) {
        fetchOgImage();
      }
    });
    
    m.addEventListener('click',function(e){if(e.target===m)m.remove();});
    document.getElementById('codi-m-c').addEventListener('click',function(){m.remove();});
    document.getElementById('codi-m-s').addEventListener('click',function(){
      var n=document.getElementById('codi-m-n').value.trim(),u=document.getElementById('codi-m-u').value.trim(),th=document.getElementById('codi-m-t').value.trim(),dm=document.getElementById('codi-m-dm').value.trim();
      if(!n||!u){toast('이름과 URL 필수','error');return;}
      var ap,op;
      if(tpl){ap='/codi/link-templates/'+tpl.id;op={method:'PUT',body:JSON.stringify({name:n,url:u,thumbnail:th,default_memo:dm})};}
      else{ap='/codi/link-templates';op={method:'POST',body:JSON.stringify({name:n,url:u,thumbnail:th,default_memo:dm,clinic_id:CID()})};}
      callAPI(ap,op).then(function(){m.remove();toast('저장!');if(onDone)onDone();}).catch(function(err){toast('오류: '+err.message,'error');});
    });
  }

  /* ================================================================ */
  /* 탭 3: 전송 기록 (오늘 기본 + 이름 검색 + 기간 필터)                    */
  /* ================================================================ */
  function pgHistory(el) {
    var now = new Date(); var today = new Date(now.getTime() + 9*60*60*1000).toISOString().slice(0,10);
    var hFrom = today, hTo = today, hSearch = '';

    function buildUI() {
      el.innerHTML = '<div style="animation:codiFadeIn .3s ease"><div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
        +'<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb"><div style="font-size:15px;font-weight:700;color:#1f2937;margin-bottom:10px">전송 기록</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
        +'<input id="ch-search" type="text" placeholder="이름 검색" value="'+escH(hSearch)+'" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;width:100px;outline:none;font-family:inherit">'
        +'<input id="ch-from" type="date" value="'+hFrom+'" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;font-family:inherit">'
        +'<span style="font-size:12px;color:#9ca3af">~</span>'
        +'<input id="ch-to" type="date" value="'+hTo+'" style="padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;font-family:inherit">'
        +'<button id="ch-go" style="padding:7px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">조회</button>'
        +'<button id="ch-all" style="padding:7px 12px;background:#fff;color:#6b7280;border:1px solid #d1d5db;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit">전체</button>'
        +'</div></div>'
        +'<div id="ch-list" style="max-height:500px;overflow-y:auto">'+SPIN+'</div></div></div>';
      document.getElementById('ch-go').addEventListener('click', function() {
        hFrom = document.getElementById('ch-from').value;
        hTo = document.getElementById('ch-to').value;
        hSearch = document.getElementById('ch-search').value.trim();
        loadHistory();
      });
      document.getElementById('ch-all').addEventListener('click', function() {
        hFrom=''; hTo=''; hSearch='';
        document.getElementById('ch-from').value='';
        document.getElementById('ch-to').value='';
        document.getElementById('ch-search').value='';
        loadHistory();
      });
      document.getElementById('ch-search').addEventListener('keypress', function(e) { if(e.key==='Enter') document.getElementById('ch-go').click(); });
      loadHistory(true);
    }

    function loadHistory(useCache) {
      var listEl = document.getElementById('ch-list');
      if (!listEl) return;
      var q = '/codi/patient-links?clinic_id=' + CID();
      if (hSearch) q += '&search=' + encodeURIComponent(hSearch);
      if (hFrom) q += '&from=' + hFrom;
      if (hTo) q += '&to=' + hTo;
      /* stale 데이터 있으면 즉시 표시 */
      var stale = useCache ? _getStale(q) : null;
      if (!stale) listEl.innerHTML = SPIN;
      callAPI(q, useCache ? {} : {noCache:true}).then(function(res) {
        var lks = res.links || [];
        /* 오늘 전송 요약 표시 */
        var isToday = (hFrom === today && hTo === today);
        var summaryHtml = '';
        if (isToday) {
          summaryHtml = '<div style="padding:12px 16px;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px">'
            +'<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#2563eb,#3b82f6);display:flex;align-items:center;justify-content:center"><i class="fas fa-paper-plane" style="color:#fff;font-size:13px"></i></div>'
            +'<div><div style="font-size:13px;font-weight:700;color:#1f2937">오늘 전송 <span style="color:#2563eb">'+lks.length+'건</span></div>'
            +'<div style="font-size:11px;color:#6b7280">'+today+'</div></div></div>';
        }
        if (lks.length === 0) {
          listEl.innerHTML = summaryHtml + '<div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px">전송 기록이 없습니다</div>';
          return;
        }
        listEl.innerHTML = summaryHtml + lks.map(function(l) {
          var d=new Date(l.created_at);var ds=(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
          return '<div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">'
            +'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="font-size:13px;font-weight:600;color:#1f2937">'+escH(l.patient)+'</span>'
            +(l.phone?'<span style="font-size:11px;color:#6b7280">'+escH(l.phone)+'</span>':'')
            +'<span style="font-size:11px;color:#9ca3af">'+ds+'</span></div>'
            +'<div style="font-size:11px;color:#6b7280">'+escH(l.link_name||'')+'</div>'
            +(l.memo?'<div style="font-size:11px;color:#92400e;background:#fef3c7;padding:1px 6px;border-radius:4px;display:inline-block;margin-top:2px">'+escH(l.memo)+'</div>':'')+'</div>'
            +'<button data-hc="'+escH(API+'/v/'+l.id)+'" style="padding:4px 10px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0">복사</button></div>';
        }).join('');
      }).catch(function(err) { listEl.innerHTML='<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>'; });
    }

    el.addEventListener('click',function(e){var b=e.target.closest('[data-hc]');if(!b)return;var url=b.getAttribute('data-hc');if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){b.textContent='완료!';setTimeout(function(){b.textContent='복사';},800);});else{fallbackCopy(url);b.textContent='완료!';setTimeout(function(){b.textContent='복사';},800);}});
    buildUI();
  }

  /* ================================================================ */
  /* 탭 4: 설정 - 문구 템플릿 폴더 관리                                  */
  /* ================================================================ */
  function pgSettings(el) {
    if (!_getStale('/codi/link-templates?clinic_id=' + CID())) el.innerHTML = SPIN;

    /* 링크 템플릿 목록 로드 (폴더 추가 시 링크 선택용) */
    callAPI('/codi/link-templates?clinic_id=' + CID()).then(function(res) {
      var linkTpls = res.templates || [];
      var md = loadMemoData();

      var linkOpts = '<option value="">링크 선택</option>';
      linkTpls.forEach(function(t) {
        linkOpts += '<option value="' + escH(t.name) + '">' + escH(t.name) + '</option>';
      });

      el.innerHTML = '<div style="animation:codiFadeIn .3s ease">'
        +'<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:14px;overflow:hidden">'
        +'<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb">'
        +'<span style="font-size:15px;font-weight:700;color:#1f2937">문구 템플릿 관리</span>'
        +'<div style="font-size:11px;color:#6b7280;margin-top:2px">링크별로 문구를 등록하면, 링크 선택 시 메모에 자동 표시됩니다.</div></div>'
        +'<div style="padding:16px">'

        /* 문구 추가 (상단) - 드롭다운에 전체 링크 표시, 폴더 자동 생성 */
        +'<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">'
        +'<div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">문구 추가</div>'
        +'<div style="display:flex;gap:6px">'
        +'<select id="codi-s-fs" style="min-width:120px;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;background:#fff">'
        + linkOpts
        +'</select>'
        +'<input id="codi-s-nm" type="text" placeholder="문구 입력..." style="flex:1;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box">'
        +'<button id="codi-s-am" style="padding:8px 16px;min-width:64px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">추가</button></div>'
        +'</div>'

        /* 폴더 목록 */
        +'<div id="codi-s-folders"></div>'
        +'</div></div>'

      +'<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
      +'<div style="padding:14px 16px;border-bottom:1px solid #e5e7eb"><span style="font-size:15px;font-weight:700;color:#1f2937">정보</span></div>'
      +'<div style="padding:16px;font-size:13px;color:#6b7280;line-height:1.8">'
      +'<div>치과: <strong style="color:#1f2937">'+escH(CN())+'</strong></div>'
      +'<div>전화: <strong style="color:#1f2937">'+escH(CPHONE()||'미등록')+'</strong></div>'
      +'<div>관리자: <strong style="color:#1f2937">'+escH(authMember.name||'')+'</strong></div>'
      +'<div style="margin-top:8px;font-size:11px;color:#9ca3af">모바일 코디 v3.7.0</div>'
      +'</div></div></div>';

    function renderFolders() {
      var d = loadMemoData();
      var box = document.getElementById('codi-s-folders');
      if (!box) return;
      if (d.folders.length === 0) { box.innerHTML = '<div style="font-size:13px;color:#9ca3af;padding:8px 0">등록된 링크 문구가 없습니다. 아래에서 링크를 선택하고 문구를 추가하세요.</div>'; return; }
      box.innerHTML = d.folders.map(function(f) {
        var tpls = d.templates[f] || [];
        return '<div style="margin-bottom:12px;padding:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
          +'<span style="font-size:13px;font-weight:600;color:#1e40af">'+escH(f)+' <span style="font-size:11px;color:#9ca3af;font-weight:400">(문구 '+tpls.length+'개)</span></span>'
          +'<button data-delfolder="'+escH(f)+'" style="padding:2px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit">삭제</button></div>'
          +'<div style="display:flex;flex-wrap:wrap;gap:4px">'
          +(tpls.length===0?'<span style="font-size:11px;color:#9ca3af">문구 없음 - 아래에서 추가하세요</span>':
            tpls.map(function(t){return '<span style="display:inline-flex;align-items:center;gap:2px;padding:3px 8px;background:#fef3c7;border:1px solid #fde68a;border-radius:12px;font-size:11px">'
              +'<span style="color:#92400e">'+escH(t)+'</span>'
              +'<span data-deltpl="'+escH(f)+'|'+escH(t)+'" style="cursor:pointer;color:#dc2626;font-size:9px;font-weight:700;margin-left:2px">X</span></span>';}).join(' '))
          +'</div></div>';
      }).join('');
    }
    renderFolders();

    /* 문구 추가 - 폴더 자동 생성 */
    document.getElementById('codi-s-am').addEventListener('click', function() {
      var folder = document.getElementById('codi-s-fs').value;
      var v = document.getElementById('codi-s-nm').value.trim();
      if (!folder) { toast('링크를 선택하세요', 'error'); return; }
      if (!v) { toast('문구를 입력하세요', 'error'); return; }
      /* 폴더가 없으면 자동 생성 */
      var d = loadMemoData();
      if (d.folders.indexOf(folder) === -1) { addMemoFolder(folder); }
      addMemoTemplate(folder, v); document.getElementById('codi-s-nm').value = '';
      renderFolders(); toast('문구 추가됨');
    });
    document.getElementById('codi-s-nm').addEventListener('keypress',function(e){if(e.key==='Enter')document.getElementById('codi-s-am').click();});

    /* 폴더/메모 삭제 */
    el.addEventListener('click', function(e) {
      var df = e.target.closest('[data-delfolder]');
      if (df) { var fn=df.getAttribute('data-delfolder'); showDeleteModal('"'+fn+'" 문구 삭제?',function(){ deleteMemoFolder(fn); var nd=loadMemoData(); var fs=document.getElementById('codi-s-fs'); fs.innerHTML='<option value="">링크 선택</option>'+nd.folders.map(function(f){return '<option value="'+escH(f)+'">'+escH(f)+'</option>';}).join(''); renderFolders(); }); }
      var dt = e.target.closest('[data-deltpl]');
      if (dt) { var p=dt.getAttribute('data-deltpl').split('|'); if(p.length===2){deleteMemoTemplate(p[0],p[1]);renderFolders();} }
    });

    }).catch(function(err) {
      el.innerHTML='<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';
    });
  }

  /* ================================================================ */
  /* 탭 5: 관리 (super_admin 전용)                                      */
  /* ================================================================ */
  var adminClinics = null;
  var adminImwebClinics = null;
  var adminDirectClinics = null;
  var adminImwebMembers = null;
  var adminDirectMembers = null;
  var adminTab = 'push';

  function pgAdmin(el) {
    if (!authMember || authMember.role !== 'super_admin') {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px">최고관리자 권한이 필요합니다.</div>';
      return;
    }

    function renderAdminContent() {
      var tabDefs = [['push','링크 배포'],['shared','공용 링크'],['all','전체 현황']];
      var tabBtns = tabDefs.map(function(td) {
        var active = adminTab === td[0];
        return '<button data-at="'+td[0]+'" style="padding:8px 16px;border-radius:8px;border:1px solid '+(active?'#1e40af':'#d1d5db')+';font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:'+(active?'#1e40af':'#fff')+';color:'+(active?'#fff':'#374151')+'">'+td[1]+'</button>';
      }).join('');
      el.innerHTML = '<div style="animation:codiFadeIn .3s ease">'
        +'<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'+tabBtns+'</div>'
        +'<div id="codi-admin-body"></div></div>';

      el.querySelectorAll('[data-at]').forEach(function(b) {
        b.addEventListener('click', function() { adminTab = b.getAttribute('data-at'); renderAdminContent(); });
      });

      var body = document.getElementById('codi-admin-body');
      if (!body) return;

      if (!adminClinics) {
        delete _apiCache[_cacheKey('/codi/admin/clinics')];
        body.innerHTML = SPIN;
        callAPI('/codi/admin/clinics', {noCache:true}).then(function(d) {
          adminClinics = d.clinics || [];
          adminImwebClinics = d.imweb_clinics || [];
          adminDirectClinics = d.direct_clinics || [];
          adminImwebMembers = d.imweb_members || [];
          adminDirectMembers = d.direct_members || [];
          renderAdminTab(body);
        }).catch(function(err) {
          body.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';
        });
      } else {
        renderAdminTab(body);
      }
    }

    function renderAdminTab(body) {
      ({push:adminPush, shared:adminShared, all:adminAll}[adminTab] || adminPush)(body);
    }

    /* --- 링크 배포 --- */
    function adminPush(body) {
      /* 클리닉 + 아임웹 회원을 병렬로 로드
         ★ /api/imweb/members: 아임웹 API 실시간 조회 (아임웹 API 연동 시 17명 등 최신 목록)
         ★ fallback: /api/codi/admin/imweb-members (DB 기반) */
      if (!_getStale('/codi/admin/clinics')) body.innerHTML = SPIN;
      Promise.all([
        adminClinics ? Promise.resolve(null) : callAPI('/codi/admin/clinics'),
        callAPI('/imweb/members', {noCache:true}).catch(function() { return callAPI('/codi/admin/imweb-members', {noCache:true}); }) /* ★ v5.10.20: 항상 실시간 조회 */
      ]).then(function(res) {
        if (res[0]) {
          adminClinics = res[0].clinics || [];
          adminImwebClinics = res[0].imweb_clinics || [];
          adminDirectClinics = res[0].direct_clinics || [];
          adminImwebMembers = res[0].imweb_members || [];
          adminDirectMembers = res[0].direct_members || [];
        }
        var imMembers = (res[1] && res[1].members) || [];
        dlog('imweb members loaded: ' + imMembers.length + ' (source:' + (res[1] && res[1].source || 'unknown') + ')');
        renderPushUI(body, imMembers);
      }).catch(function(err) {
        dlog('admin push load error: ' + err.message);
        /* fallback: 클리닉만으로 */
        renderPushUI(body, []);
        toast('데이터 로드 오류: ' + err.message, 'error');
      });
    }

    function renderPushUI(body, imMembers) {
      var allTargets = [];
      var usedIds = {};
      /* 아임웹 회원만 표시 (직접등록 치과 목록 미추가) */
      imMembers.forEach(function(m) {
        var mid = m.imweb_member_id || m.member_code || m.id;
        if (!mid || usedIds[mid]) return;
        usedIds[mid] = true;
        var clinicId = m.admin_clinic_id ? String(m.admin_clinic_id) : '';
        var displayName = m.clinic_name || m.name || '(미지정)';
        allTargets.push({ type: 'imweb', id: mid, name: displayName, email: m.email || '', registered: !!m.admin_clinic_id, clinic_id: clinicId, data: m });
      });

      var totalCount = allTargets.length;
      var searchQuery = '';
      var collapsed = totalCount > 10;

      function getFiltered() {
        if (!searchQuery) return allTargets;
        var q = searchQuery.toLowerCase();
        return allTargets.filter(function(t) {
          return (t.name && t.name.toLowerCase().indexOf(q) !== -1) || (t.email && t.email.toLowerCase().indexOf(q) !== -1);
        });
      }

      function renderTargetList() {
        var filtered = getFiltered();
        var box = document.getElementById('codi-push-targets');
        if (!box) return;

        if (filtered.length === 0) {
          box.innerHTML = '<div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px">' + (searchQuery ? '검색 결과가 없습니다' : '대상이 없습니다') + '</div>';
          return;
        }

        var html = filtered.map(function(t) {
          var isImweb = t.type === 'imweb';
          var statusDot = t.registered
            ? '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0"></span>'
            : '<span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0"></span>';
          var chipBorder = t.registered ? '#e5e7eb' : '#fde68a';
          var chipBg = t.registered ? '#fff' : '#fffbeb';
          return '<label style="display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border:1px solid '+chipBorder+';border-radius:20px;cursor:pointer;font-size:12px;background:'+chipBg+';transition:all .15s;white-space:nowrap;user-select:none" onmouseover="if(!this.querySelector(\'input\').checked){this.style.borderColor=\'#93c5fd\';this.style.background=\'#eff6ff\'}" onmouseout="if(!this.querySelector(\'input\').checked){this.style.borderColor=\''+chipBorder+'\';this.style.background=\''+chipBg+'\'}">'
            + '<input type="checkbox" value="'+escH(t.id)+'" class="codi-acb" data-type="'+t.type+'" data-name="'+escH(t.name)+'" data-email="'+escH(t.email)+'" data-clinic-id="'+(t.clinic_id||'')+'" onchange="var l=this.closest(\'label\');if(this.checked){l.style.borderColor=\'#1e40af\';l.style.background=\'#dbeafe\';l.style.boxShadow=\'0 0 0 1px #1e40af\'}else{l.style.borderColor=\''+chipBorder+'\';l.style.background=\''+chipBg+'\';l.style.boxShadow=\'none\'}" style="width:14px;height:14px;accent-color:#1e40af;flex-shrink:0">'
            + statusDot
            + '<span style="font-weight:500;color:#1f2937">'+escH(t.name)+'</span>'
            + '</label>';
        }).join('');
        box.innerHTML = html;
      }

      /* 카운트 표시 */
      var countLabel = '아임웹 ' + totalCount + '명';

      body.innerHTML = 
        /* STEP 1: 대상 클리닉 선택 */
        '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#1e40af;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">1</span>'
        + '<div style="font-size:15px;font-weight:700;color:#1f2937">대상 클리닉 선택 <span style="font-size:12px;font-weight:500;color:#6b7280">('+countLabel+')</span></div>'
        + '</div>'
        /* 검색 */
        + '<div style="position:relative;margin-bottom:6px"><i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:11px"></i>'
        + '<input id="codi-push-search" type="text" placeholder="이름 또는 이메일로 검색..." style="width:100%;padding:8px 10px 8px 30px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;font-family:inherit;box-sizing:border-box"></div>'
        /* 전체선택 + 선택수 */
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<label style="font-size:12px;color:#1e40af;cursor:pointer;display:flex;align-items:center;gap:5px"><input type="checkbox" id="codi-a-all" style="width:15px;height:15px;accent-color:#1e40af"> 전체선택</label>'
        + '<span id="codi-push-count" style="font-size:12px;color:#1e40af;font-weight:600">0/'+totalCount+'개</span></div>'
        /* 대상 목록 */
        + '<div id="codi-push-targets" style="display:flex;flex-wrap:wrap;gap:5px;max-height:220px;overflow-y:auto;padding:2px"></div>'
        + '</div>'

        /* STEP 2: 배포할 링크 */
        + '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#1e40af;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">2</span>'
        + '<div style="font-size:15px;font-weight:700;color:#1f2937">배포할 링크</div>'
        + '</div>'
        + '<div id="codi-a-queue" style="margin-bottom:8px"></div>'
        + '<div style="display:grid;gap:6px">'
        + '<input id="codi-a-name" type="text" placeholder="링크 이름 (예: 임플란트 안내)" style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
        + '<input id="codi-a-url" type="text" placeholder="URL (https://...)" style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
        + '<div style="display:flex;gap:6px;align-items:center">'
        + '<input id="codi-a-thumb" type="text" placeholder="썸네일 (자동 추출)" style="flex:1;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
        + '<button id="codi-a-og" style="padding:9px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap" title="URL에서 썸네일 자동 추출"><i class="fas fa-image"></i></button>'
        + '<button id="codi-a-add" style="padding:9px 16px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap"><i class="fas fa-plus" style="margin-right:4px"></i>추가</button></div>'
        + '<div id="codi-a-thumb-preview" style="min-height:0"></div>'
        + '<input id="codi-a-memo" type="text" placeholder="기본 메모 (링크 선택 시 자동 입력, 선택)" style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box"></div>'
        + '</div>'

        /* 배포 버튼 */
        + '<button id="codi-a-push" style="width:100%;padding:14px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(30,64,175,.3);transition:opacity .15s" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">'
        + '<i class="fas fa-paper-plane" style="margin-right:8px"></i>선택 대상에 배포</button>';

      /* 대상 목록 렌더링 */
      renderTargetList();

      /* 검색 */
      var pushSearchTimer = null;
      document.getElementById('codi-push-search').addEventListener('input', function() {
        searchQuery = this.value.trim();
        clearTimeout(pushSearchTimer);
        pushSearchTimer = setTimeout(renderTargetList, 200);
      });

      /* 선택 수 업데이트 */
      function updateCount() {
        var cnt = document.querySelectorAll('.codi-acb:checked').length;
        var ttl = document.querySelectorAll('.codi-acb').length;
        var el2 = document.getElementById('codi-push-count');
        if (el2) el2.textContent = cnt + '/' + ttl + '개';
        var sa = document.getElementById('codi-a-all');
        if (sa) sa.checked = (ttl > 0 && cnt === ttl);
      }
      document.getElementById('codi-push-targets').addEventListener('change', updateCount);

      /* 전체선택 */
      document.getElementById('codi-a-all').addEventListener('change', function() {
        var ch = this.checked;
        document.querySelectorAll('.codi-acb').forEach(function(cb) { cb.checked = ch; });
        updateCount();
      });

      /* 큐 */
      var queue = [];
      function renderQ() {
        var box = document.getElementById('codi-a-queue');
        if (!box) return;
        if (queue.length === 0) { box.innerHTML = '<div style="padding:8px;text-align:center;color:#9ca3af;font-size:12px;background:#f9fafb;border-radius:6px"><i class="fas fa-info-circle" style="margin-right:4px"></i>여러 링크를 한번에 배포하려면 추가 버튼으로 등록하세요.<br><span style="font-size:11px">추가 없이도 위 입력란에 입력 후 바로 배포할 수 있습니다.</span></div>'; return; }
        box.innerHTML = queue.map(function(t,i) {
          return '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:4px">'
            + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#1e40af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
            + '<div style="font-size:10px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
            + '<span data-qrm="'+i+'" style="cursor:pointer;color:#dc2626;font-size:11px;font-weight:700">X</span></div>';
        }).join('');
      }
      renderQ();

      document.getElementById('codi-a-add').addEventListener('click', function() {
        var n=document.getElementById('codi-a-name').value.trim(), u=document.getElementById('codi-a-url').value.trim(), th=document.getElementById('codi-a-thumb').value.trim(), dm=document.getElementById('codi-a-memo').value.trim();
        if(!n||!u){toast('이름과 URL을 입력하세요','error');return;}
        queue.push({name:n,url:u,thumbnail:th,default_memo:dm});
        document.getElementById('codi-a-name').value=''; document.getElementById('codi-a-url').value=''; document.getElementById('codi-a-thumb').value=''; document.getElementById('codi-a-memo').value='';
        var preview = document.getElementById('codi-a-thumb-preview'); if(preview) preview.innerHTML='';
        renderQ(); toast('"'+n+'" 추가됨');
      });

      /* 배포 탭 OG 이미지 자동 추출 */
      function pushFetchOg() {
        var url = document.getElementById('codi-a-url').value.trim();
        if (!url) { toast('URL을 먼저 입력하세요', 'error'); return; }
        var ogBtn = document.getElementById('codi-a-og');
        ogBtn.disabled = true; ogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        callAPI('/codi/og-image?url=' + encodeURIComponent(url)).then(function(r) {
          ogBtn.disabled = false; ogBtn.innerHTML = '<i class="fas fa-image"></i>';
          if (r.thumbnail) {
            document.getElementById('codi-a-thumb').value = r.thumbnail;
            var preview = document.getElementById('codi-a-thumb-preview');
            if (preview) preview.innerHTML = '<img src="'+escH(r.thumbnail)+'" style="width:48px;height:48px;border-radius:6px;object-fit:cover;border:1px solid #e5e7eb">';
            toast('썸네일 자동 추출 완료!');
          } else { toast('이 URL에서 썸네일을 찾을 수 없습니다', 'error'); }
        }).catch(function() {
          ogBtn.disabled = false; ogBtn.innerHTML = '<i class="fas fa-image"></i>';
          toast('추출 실패', 'error');
        });
      }
      document.getElementById('codi-a-og').addEventListener('click', pushFetchOg);
      document.getElementById('codi-a-url').addEventListener('blur', function() {
        if (!document.getElementById('codi-a-thumb').value.trim() && this.value.trim()) { pushFetchOg(); }
      });

      document.getElementById('codi-a-queue').addEventListener('click', function(e) {
        var rm = e.target.closest('[data-qrm]');
        if(rm){queue.splice(parseInt(rm.getAttribute('data-qrm')),1);renderQ();}
      });

      document.getElementById('codi-a-push').addEventListener('click', function() {
        /* 선택된 대상 수집 */
        var clinicIds=[], imwebCodes=[];
        document.querySelectorAll('.codi-acb:checked').forEach(function(cb) {
          var cid = cb.getAttribute('data-clinic-id');
          if (cid) {
            /* clinic_id를 직접 수집 (중복 제거) */
            if (clinicIds.indexOf(parseInt(cid)) === -1) clinicIds.push(parseInt(cid));
          } else if (cb.getAttribute('data-type') === 'imweb') {
            imwebCodes.push({member_code:cb.value, name:cb.getAttribute('data-name')||'', email:cb.getAttribute('data-email')||''});
          } else {
            clinicIds.push(parseInt(cb.value));
          }
        });
        if(clinicIds.length===0 && imwebCodes.length===0){toast('대상을 선택하세요','error');return;}
        /* 대기실TV와 동일: 큐에 있으면 큐 사용, 없으면 입력 필드에서 직접 가져오기 */
        var pushItems = [];
        if (queue.length > 0) {
          pushItems = queue.slice();
        } else {
          var linkName = (document.getElementById('codi-a-name') || {}).value || '';
          var linkUrl = (document.getElementById('codi-a-url') || {}).value || '';
          var linkThumb = (document.getElementById('codi-a-thumb') || {}).value || '';
          var linkMemo = (document.getElementById('codi-a-memo') || {}).value || '';
          if (!linkUrl.trim()) { toast('URL을 입력하세요', 'error'); return; }
          pushItems.push({ name: linkName.trim() || linkUrl.trim(), url: linkUrl.trim(), thumbnail: linkThumb.trim(), default_memo: linkMemo.trim() });
        }
        var total = clinicIds.length + imwebCodes.length;
        var btn2=this;
        showConfirmModal(total+'개 대상에 '+pushItems.length+'개 링크를 배포하시겠습니까?', function(){
          btn2.disabled=true; btn2.innerHTML='<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>배포 중...';
          callAPI('/codi/admin/push-templates',{method:'POST',body:JSON.stringify({clinic_ids:clinicIds,imweb_members:imwebCodes,templates:pushItems})})
          .then(function(d){btn2.disabled=false;btn2.innerHTML='<i class="fas fa-paper-plane" style="margin-right:8px"></i>선택 대상에 배포';toast('배포 완료! '+d.pushed+'개 등록됨');queue=[];renderQ();adminClinics=null;
            var ne=document.getElementById('codi-a-name');var ue=document.getElementById('codi-a-url');var te=document.getElementById('codi-a-thumb');var me=document.getElementById('codi-a-memo');
            if(ne)ne.value='';if(ue)ue.value='';if(te)te.value='';if(me)me.value='';})
          .catch(function(err){btn2.disabled=false;btn2.innerHTML='<i class="fas fa-paper-plane" style="margin-right:8px"></i>선택 대상에 배포';toast('오류: '+err.message,'error');});
        });
      });
    }

    /* --- 공용 링크 (전체 치과 일괄 배포) --- */
    function adminShared(body) {
      /* 기존 공용링크 현황 로드 */
      if (!_getStale('/codi/admin/all-templates')) body.innerHTML = SPIN;
      callAPI('/codi/admin/all-templates').then(function(d) {
        var tpls = d.templates || [];

        /* 공용링크 = 모든 치과에 동일하게 존재하는 링크를 표시 */
        var sharedQueue = [];

        function renderSharedQueue() {
          var area = document.getElementById('codi-shared-queue');
          if (!area) return;
          if (sharedQueue.length === 0) { area.innerHTML = ''; return; }
          area.innerHTML = '<div style="margin-bottom:8px;font-size:12px;color:#6b7280;font-weight:500">등록할 링크 ('+sharedQueue.length+'개)</div>'
            + sharedQueue.map(function(t,i) {
              return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:6px">'
                + (t.thumbnail ? '<img src="'+escH(t.thumbnail)+'" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0">' : '<div style="width:36px;height:36px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-link" style="color:#9ca3af;font-size:12px"></i></div>')
                + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#1e40af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
                + '<div style="font-size:11px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
                + '<span data-shrm="'+i+'" style="cursor:pointer;color:#dc2626;font-size:12px;font-weight:700;padding:4px 8px">✕</span></div>';
            }).join('');
        }

        /* 공용 링크만 필터링 (clinic_id=0) */
        var globalTpls = tpls.filter(function(t) { return !t.clinic_id || t.clinic_id === '0'; });

        body.innerHTML =
          /* 공용 링크 등록 영역 */
          '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:12px">'
          + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
          + '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:13px;flex-shrink:0"><i class="fas fa-globe"></i></span>'
          + '<div><div style="font-size:16px;font-weight:700;color:#1f2937">공용 링크 등록</div>'
          + '<div style="font-size:12px;color:#6b7280">모든 치과에 한번에 링크를 배포합니다</div></div></div>'

          + '<div id="codi-shared-queue" style="margin-bottom:10px"></div>'

          + '<div style="display:grid;gap:6px;margin-bottom:10px">'
          + '<input id="codi-sh-name" type="text" placeholder="링크 이름 (예: 임플란트 안내)" style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
          + '<input id="codi-sh-url" type="text" placeholder="URL (https://...)" style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
          + '<div style="display:flex;gap:6px;align-items:center">'
          + '<input id="codi-sh-thumb" type="text" placeholder="썸네일 (자동 추출)" style="flex:1;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
          + '<button id="codi-sh-og" style="padding:9px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap" title="URL에서 썸네일 자동 추출"><i class="fas fa-image"></i></button>'
          + '<button id="codi-sh-add" style="padding:9px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap"><i class="fas fa-plus" style="margin-right:4px"></i>추가</button></div>'
          + '<div id="codi-sh-thumb-preview" style="min-height:0"></div>'
          + '<input id="codi-sh-memo" type="text" placeholder="기본 메모 (선택)" style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box">'
          + '</div>'

          + '<button id="codi-sh-push" style="width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(124,58,237,.3);transition:opacity .15s" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">'
          + '<i class="fas fa-globe" style="margin-right:8px"></i>전체 치과에 배포</button>'
          + '</div>'

          /* 공용 링크 현황 */
          + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
          + '<div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:10px">공용 링크 현황 <span style="font-size:12px;color:#6b7280;font-weight:400">'+globalTpls.length+'개</span></div>'
          + '<div id="codi-shared-overview"></div>'
          + '</div>';

        /* 현황 렌더링 — 공용 링크만 표시 */
        var overviewEl = document.getElementById('codi-shared-overview');
        if (overviewEl) {
          if (globalTpls.length === 0) {
            overviewEl.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">등록된 공용 링크가 없습니다.</div>';
          } else {
            var ohtml = '';
            globalTpls.forEach(function(t) {
              ohtml += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6">'
                + (t.thumbnail ? '<img src="'+escH(t.thumbnail)+'" style="width:32px;height:32px;border-radius:4px;object-fit:cover;flex-shrink:0">' : '<div style="width:32px;height:32px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-link" style="color:#9ca3af;font-size:12px"></i></div>')
                + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
                + '<div style="font-size:10px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
                + '<button data-shdt="'+t.id+'" style="padding:3px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;flex-shrink:0">삭제</button></div>';
            });
            overviewEl.innerHTML = ohtml;
          }
        }

        /* 큐에 추가 */
        document.getElementById('codi-sh-add').addEventListener('click', function() {
          var n = document.getElementById('codi-sh-name').value.trim();
          var u = document.getElementById('codi-sh-url').value.trim();
          var th = document.getElementById('codi-sh-thumb').value.trim();
          var dm = document.getElementById('codi-sh-memo').value.trim();
          if (!n || !u) { toast('이름과 URL을 입력하세요', 'error'); return; }
          sharedQueue.push({name:n, url:u, thumbnail:th, default_memo:dm});
          document.getElementById('codi-sh-name').value = '';
          document.getElementById('codi-sh-url').value = '';
          document.getElementById('codi-sh-thumb').value = '';
          document.getElementById('codi-sh-memo').value = '';
          renderSharedQueue();
          toast('"'+n+'" 추가됨');
        });

        /* 큐에서 제거 */
        document.getElementById('codi-shared-queue').addEventListener('click', function(e) {
          var rm = e.target.closest('[data-shrm]');
          if (rm) { sharedQueue.splice(parseInt(rm.getAttribute('data-shrm')), 1); renderSharedQueue(); }
        });

        /* 공용 링크 OG 이미지 자동 추출 */
        function sharedFetchOg() {
          var url = document.getElementById('codi-sh-url').value.trim();
          if (!url) { toast('URL을 먼저 입력하세요', 'error'); return; }
          var ogBtn = document.getElementById('codi-sh-og');
          ogBtn.disabled = true; ogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          callAPI('/codi/og-image?url=' + encodeURIComponent(url)).then(function(r) {
            ogBtn.disabled = false; ogBtn.innerHTML = '<i class="fas fa-image"></i>';
            if (r.thumbnail) {
              document.getElementById('codi-sh-thumb').value = r.thumbnail;
              var preview = document.getElementById('codi-sh-thumb-preview');
              if (preview) preview.innerHTML = '<img src="'+escH(r.thumbnail)+'" style="width:48px;height:48px;border-radius:6px;object-fit:cover;border:1px solid #e5e7eb">';
              toast('썸네일 자동 추출 완료!');
            } else { toast('이 URL에서 썸네일을 찾을 수 없습니다', 'error'); }
          }).catch(function() {
            ogBtn.disabled = false; ogBtn.innerHTML = '<i class="fas fa-image"></i>';
            toast('추출 실패', 'error');
          });
        }
        document.getElementById('codi-sh-og').addEventListener('click', sharedFetchOg);
        /* URL 입력 후 blur 시 자동 추출 (썸네일 비어있을 때만) */
        document.getElementById('codi-sh-url').addEventListener('blur', function() {
          if (!document.getElementById('codi-sh-thumb').value.trim() && this.value.trim()) {
            sharedFetchOg();
          }
        });

        /* 개별 삭제 */
        if (overviewEl) {
          overviewEl.addEventListener('click', function(e) {
            var db = e.target.closest('[data-shdt]');
            if (db) {
              showConfirmModal('이 링크를 삭제하시겠습니까?', function() {
                callAPI('/codi/link-templates/' + db.getAttribute('data-shdt'), {method:'DELETE'}).then(function() {
                  toast('삭제됨');
                  delete _apiCache[_cacheKey('/codi/admin/all-templates')];
                  delete _apiCache[_cacheKey('/codi/link-templates?clinic_id=' + CID())];
                  setTimeout(function() { adminShared(body); }, 300);
                }).catch(function(err) { toast('오류: '+err.message, 'error'); });
              });
            }
          });
        }

        /* 전체 배포 실행 */
        document.getElementById('codi-sh-push').addEventListener('click', function() {
          var pushItems = [];
          if (sharedQueue.length > 0) {
            pushItems = sharedQueue.slice();
          } else {
            var linkName = (document.getElementById('codi-sh-name') || {}).value || '';
            var linkUrl = (document.getElementById('codi-sh-url') || {}).value || '';
            var linkThumb = (document.getElementById('codi-sh-thumb') || {}).value || '';
            var linkMemo = (document.getElementById('codi-sh-memo') || {}).value || '';
            if (!linkUrl.trim()) { toast('URL을 입력하세요', 'error'); return; }
            pushItems.push({name: linkName.trim() || linkUrl.trim(), url: linkUrl.trim(), thumbnail: linkThumb.trim(), default_memo: linkMemo.trim()});
          }
          var btn3 = this;
          showConfirmModal('전체 치과에 ' + pushItems.length + '개 링크를 배포하시겠습니까?', function() {
            btn3.disabled = true; btn3.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>배포 중...';
            callAPI('/codi/admin/push-templates-all', {method:'POST', body:JSON.stringify({templates:pushItems})})
            .then(function(d) {
              btn3.disabled = false; btn3.innerHTML = '<i class="fas fa-globe" style="margin-right:8px"></i>전체 치과에 배포';
              toast('공용 링크 등록 완료! ' + d.pushed + '개 (' + d.clinics + ')');
              sharedQueue = []; renderSharedQueue(); adminClinics = null;
              /* 캐시 완전 삭제 후 현황 갱신 */
              delete _apiCache[_cacheKey('/codi/admin/all-templates')];
              delete _apiCache[_cacheKey('/codi/link-templates?clinic_id=' + CID())];
              setTimeout(function() { adminShared(body); }, 500);
            })
            .catch(function(err) {
              btn3.disabled = false; btn3.innerHTML = '<i class="fas fa-globe" style="margin-right:8px"></i>전체 치과에 배포';
              toast('오류: ' + err.message, 'error');
            });
          });
        });

      }).catch(function(err) {
        body.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';
      });
    }

    /* --- 전체 현황 (아임웹 회원 기반 치과별 배포 링크) --- */
    function adminAll(body) {
      body.innerHTML = SPIN;
      Promise.all([
        callAPI('/codi/admin/all-templates', {noCache:true}),
        callAPI('/codi/admin/imweb-members', {noCache:true}) /* ★ v5.10.20: 항상 실시간 조회 */
      ]).then(function(results) {
        var tpls = (results[0] && results[0].templates) || [];
        var imMembers = (results[1] && results[1].members) || [];
        dlog('adminAll: templates=' + tpls.length + ', imMembers=' + imMembers.length);

        /* 공용 제외, clinic_id별 + clinic_name별 링크 맵 */
        var linkMap = {};
        var linkMapByName = {};
        tpls.forEach(function(t) {
          var key = String(t.clinic_id || '0');
          if (key === '0') return;
          if (!linkMap[key]) linkMap[key] = [];
          linkMap[key].push(t);
          /* clinic_name으로도 매핑 (fallback용) */
          var cname = (t.clinic_name || '').trim();
          if (cname && cname !== '공용 전체') {
            if (!linkMapByName[cname]) linkMapByName[cname] = [];
            linkMapByName[cname].push(t);
          }
        });
        dlog('adminAll linkMap keys: ' + Object.keys(linkMap).join(',') + ' | byName: ' + Object.keys(linkMapByName).join(','));

        /* 아임웹 회원 → 대상 목록 생성 (renderPushUI와 완전 동일한 로직) */
        var allGroups = [];
        var usedIds = {};
        imMembers.forEach(function(m) {
          var mid = m.imweb_member_id || m.member_code || m.id;
          if (!mid || usedIds[mid]) return;
          usedIds[mid] = true;
          /* clinic_id 매칭: admin_clinic_id > clinic_id 순서로 시도 */
          var rawCid = m.admin_clinic_id || m.clinic_id || '';
          var clinicId = rawCid ? String(rawCid) : '';
          var displayName = m.clinic_name || m.name || '(미지정)';
          /* 1차: clinic_id로 매칭, 2차: clinic_name으로 매칭 */
          var matchedItems = [];
          if (clinicId && linkMap[clinicId]) {
            matchedItems = linkMap[clinicId];
          } else if (displayName && linkMapByName[displayName]) {
            matchedItems = linkMapByName[displayName];
          }
          dlog('  ' + displayName + ': cid=' + rawCid + '→"' + clinicId + '" links=' + matchedItems.length);
          allGroups.push({ name: displayName, clinic_id: clinicId, items: matchedItems });
        });

        allGroups.sort(function(a, b) {
          return b.items.length - a.items.length || a.name.localeCompare(b.name);
        });

        var totalClinicLinks = 0;
        allGroups.forEach(function(g) { totalClinicLinks += g.items.length; });

        /* HTML 구성 */
        var html = '<div style="animation:codiFadeIn .3s ease">';

        /* 요약 배너 */
        html += '<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:12px;padding:16px;margin-bottom:12px;color:#fff">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="fas fa-hospital" style="font-size:18px"></i></div>'
          + '<div><div style="font-size:20px;font-weight:800">치과별 배포 링크</div>'
          + '<div style="font-size:12px;opacity:0.8">아임웹 ' + allGroups.length + '개 치과 · 총 ' + totalClinicLinks + '개 링크 (공용 제외)</div></div></div></div>';

        /* 검색 */
        html += '<div style="margin-bottom:12px">'
          + '<input id="codi-all-search" type="text" placeholder="치과명 또는 링크명 검색…" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:13px;font-family:inherit;box-sizing:border-box;background:#fff">'
          + '</div>';

        /* 치과 목록 */
        html += '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
          + '<div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:12px"><i class="fas fa-list" style="margin-right:6px;color:#3b82f6"></i>치과별 링크 현황 <span id="codi-all-count" style="font-size:12px;color:#6b7280;font-weight:400">(' + allGroups.length + '개 치과)</span></div>'
          + '<div id="codi-all-list">';

        if (allGroups.length === 0) {
          html += '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">등록된 치과가 없습니다.</div>';
        } else {
          allGroups.forEach(function(g, gi) {
            var hasLinks = g.items.length > 0;
            html += '<div class="codi-ac-group" data-search-name="' + escH(g.name.toLowerCase()) + '" data-search-links="' + g.items.map(function(t){return (t.name+' '+t.url).toLowerCase();}).join(' ') + '" style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;overflow:hidden">'
              /* 헤더 */
              + '<div data-toggle-ac="' + gi + '" style="display:flex;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;background:#f9fafb;transition:background .15s" onmouseover="this.style.background=\'#f3f4f6\'" onmouseout="this.style.background=\'#f9fafb\'">'
              + '<i class="fas fa-chevron-right" data-achev="' + gi + '" style="font-size:10px;color:#6b7280;width:12px;transition:transform .2s"></i>'
              + '<div style="flex:1;min-width:0">'
              + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
              + '<span style="font-size:13px;font-weight:700;color:#1f2937">' + escH(g.name) + '</span>'
              + '<span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;' + (hasLinks ? 'background:#dbeafe;color:#2563eb' : 'background:#f3f4f6;color:#9ca3af') + '">' + g.items.length + '개 링크</span>'
              + '</div></div></div>'
              /* 본문 (기본 닫힘) */
              + '<div data-ac-body="' + gi + '" style="display:none;padding:0 14px 10px">';

            if (!hasLinks) {
              html += '<div style="padding:12px 0;text-align:center;color:#9ca3af;font-size:12px">배포된 링크가 없습니다</div>';
            } else {
              g.items.forEach(function(t) {
                html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6">'
                  + (t.thumbnail ? '<img src="' + escH(t.thumbnail) + '" style="width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0">' : '<div style="width:32px;height:32px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-link" style="color:#9ca3af;font-size:11px"></i></div>')
                  + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(t.name) + '</div>'
                  + '<div style="font-size:10px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(t.url) + '</div></div>'
                  + '<button data-adel="' + escH(t.id) + '" style="padding:2px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;flex-shrink:0">삭제</button></div>';
              });
            }

            html += '</div></div>';
          });
        }

        html += '</div></div></div>';
        body.innerHTML = html;

        /* 검색: DOM 재생성 없이 display 토글 방식 */
        var searchEl = document.getElementById('codi-all-search');
        if (searchEl) {
          var searchTimer = null;
          searchEl.addEventListener('input', function() {
            var self = this;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
              var q = self.value.trim().toLowerCase();
              var groups = body.querySelectorAll('.codi-ac-group');
              var visibleCount = 0;
              groups.forEach(function(grp) {
                var nameMatch = grp.getAttribute('data-search-name').indexOf(q) >= 0;
                var linkMatch = grp.getAttribute('data-search-links').indexOf(q) >= 0;
                if (!q || nameMatch || linkMatch) {
                  grp.style.display = '';
                  visibleCount++;
                } else {
                  grp.style.display = 'none';
                }
              });
              var countEl = document.getElementById('codi-all-count');
              if (countEl) countEl.textContent = '(' + visibleCount + '개 치과)';
            }, 150);
          });
        }

        /* 접기/펼치기 */
        body.querySelectorAll('[data-toggle-ac]').forEach(function(h) {
          h.addEventListener('click', function() {
            var idx = h.getAttribute('data-toggle-ac');
            var bd = body.querySelector('[data-ac-body="' + idx + '"]');
            var chev = body.querySelector('[data-achev="' + idx + '"]');
            if (!bd) return;
            var isHidden = bd.style.display === 'none';
            bd.style.display = isHidden ? 'block' : 'none';
            if (chev) { chev.className = 'fas fa-chevron-' + (isHidden ? 'down' : 'right'); }
          });
        });

        /* 삭제 */
        body.addEventListener('click', function(e) {
          var db = e.target.closest('[data-adel]');
          if (!db) return;
          showDeleteModal('이 링크를 삭제하시겠습니까?', function() {
            callAPI('/codi/link-templates/' + db.getAttribute('data-adel'), { method: 'DELETE' })
              .then(function() {
                toast('삭제됨');
                delete _apiCache[_cacheKey('/codi/admin/all-templates')];
                delete _apiCache[_cacheKey('/codi/link-templates?clinic_id=' + CID())];
                setTimeout(function() { adminAll(body); }, 300);
              }).catch(function(err) { toast('오류: ' + err.message, 'error'); });
          });
        });

      }).catch(function(err) { body.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">' + escH(err.message) + '</div>'; });
    }

    /* --- 회원 관리 --- */
    function adminMembers(body) {
      var imw = adminImwebMembers || [];
      var dir = adminDirectMembers || [];
      var html = '<div style="animation:codiFadeIn .3s ease">';

      /* 아임웹 회원 섹션 */
      html += '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px;margin-bottom:12px">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:#2563eb"></div>'
        +'<span style="font-size:14px;font-weight:700;color:#1f2937">아임웹 회원</span>'
        +'<span style="font-size:12px;color:#6b7280;font-weight:400">'+imw.length+'명</span></div>';
      if (imw.length === 0) {
        html += '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">아임웹 연동 회원이 없습니다</div>';
      } else {
        imw.forEach(function(m) {
          var clinicNames = '';
          if (m.clinic_info) {
            clinicNames = m.clinic_info.split('|').map(function(ci) {
              var parts = ci.split(':'); return parts.length > 1 ? parts.slice(1).join(':') : parts[0];
            }).join(', ');
          }
          var roleLabel = {super_admin:'최고관리자',clinic_admin:'관리자'}[m.role] || m.role;
          html += '<div style="padding:10px 0;border-bottom:1px solid #f3f4f6">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            +'<div style="width:32px;height:32px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#2563eb;font-weight:700;flex-shrink:0">'+escH((m.name||'?').charAt(0))+'</div>'
            +'<div style="flex:1;min-width:0">'
            +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
            +'<span style="font-size:13px;font-weight:700;color:#1f2937">'+escH(m.name)+'</span>'
            +'<span style="font-size:10px;padding:2px 6px;background:#dbeafe;color:#2563eb;border-radius:10px;font-weight:600">아임웹</span>'
            +'<span style="font-size:10px;padding:2px 6px;background:#f3f4f6;color:#6b7280;border-radius:10px">'+escH(roleLabel)+'</span></div>'
            +'<div style="font-size:11px;color:#6b7280;margin-top:2px">'
            +(m.email ? escH(m.email) : '')
            +(m.phone && m.email ? ' · ' : '')+(m.phone ? escH(m.phone) : '')
            +'</div>'
            +(m.imweb_member_id ? '<div style="font-size:10px;color:#9ca3af;margin-top:1px">ImWeb ID: '+escH(m.imweb_member_id)+(m.imweb_group ? ' · 그룹: '+escH(m.imweb_group) : '')+'</div>' : '')
            +(clinicNames ? '<div style="font-size:10px;color:#2563eb;margin-top:1px">클리닉: '+escH(clinicNames)+'</div>' : '')
            +'</div></div></div>';
        });
      }
      html += '</div>';

      /* 직접 등록 회원 섹션 */
      html += '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:#16a34a"></div>'
        +'<span style="font-size:14px;font-weight:700;color:#1f2937">직접 등록 회원</span>'
        +'<span style="font-size:12px;color:#6b7280;font-weight:400">'+dir.length+'명</span></div>';
      if (dir.length === 0) {
        html += '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">직접 등록 회원이 없습니다</div>';
      } else {
        dir.forEach(function(m) {
          var clinicNames = '';
          if (m.clinic_info) {
            clinicNames = m.clinic_info.split('|').map(function(ci) {
              var parts = ci.split(':'); return parts.length > 1 ? parts.slice(1).join(':') : parts[0];
            }).join(', ');
          }
          var roleLabel = {super_admin:'최고관리자',clinic_admin:'관리자'}[m.role] || m.role;
          html += '<div style="padding:10px 0;border-bottom:1px solid #f3f4f6">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            +'<div style="width:32px;height:32px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#16a34a;font-weight:700;flex-shrink:0">'+escH((m.name||'?').charAt(0))+'</div>'
            +'<div style="flex:1;min-width:0">'
            +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
            +'<span style="font-size:13px;font-weight:700;color:#1f2937">'+escH(m.name)+'</span>'
            +'<span style="font-size:10px;padding:2px 6px;background:#dcfce7;color:#16a34a;border-radius:10px;font-weight:600">직접등록</span>'
            +'<span style="font-size:10px;padding:2px 6px;background:#f3f4f6;color:#6b7280;border-radius:10px">'+escH(roleLabel)+'</span></div>'
            +'<div style="font-size:11px;color:#6b7280;margin-top:2px">'
            +(m.email ? escH(m.email) : '')
            +(m.phone && m.email ? ' · ' : '')+(m.phone ? escH(m.phone) : '')
            +'</div>'
            +(clinicNames ? '<div style="font-size:10px;color:#16a34a;margin-top:1px">클리닉: '+escH(clinicNames)+'</div>' : '')
            +'</div></div></div>';
        });
      }
      html += '</div></div>';
      body.innerHTML = html;
    }

    /* --- 클리닉 목록 --- */
    function clinicRow(c) {
      var ownerBadge = c.imweb_member_id
        ? '<span style="font-size:9px;padding:1px 5px;background:#dbeafe;color:#2563eb;border-radius:8px;font-weight:600">아임웹</span>'
        : '<span style="font-size:9px;padding:1px 5px;background:#dcfce7;color:#16a34a;border-radius:8px;font-weight:600">직접등록</span>';
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6">'
        +'<div style="width:32px;height:32px;background:#eff6ff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;color:#2563eb;font-weight:700;flex-shrink:0">'+c.id+'</div>'
        +'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap"><span style="font-size:13px;font-weight:600;color:#1f2937">'+escH(c.name)+'</span>'+ownerBadge+'</div>'
        +(c.owner_name?'<div style="font-size:10px;color:#6b7280;margin-top:1px">소유자: '+escH(c.owner_name)+(c.owner_email?' ('+escH(c.owner_email)+')':'')+'</div>':'')
        +(c.phone?'<div style="font-size:10px;color:#9ca3af">'+escH(c.phone)+'</div>':'')
        +'<div style="font-size:10px;color:#9ca3af;margin-top:1px">환자 '+F(c.patient_count||0)+'명 · 템플릿 '+F(c.template_count||0)+'개</div></div>'
        +'<button data-vc="'+c.id+'" style="padding:4px 10px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">템플릿</button></div>';
    }

    function adminClinicsList(body) {
      var html = '<div style="animation:codiFadeIn .3s ease">';

      /* 아임웹 클리닉 */
      html += '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px;margin-bottom:12px">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:#2563eb"></div>'
        +'<span style="font-size:14px;font-weight:700;color:#1f2937">아임웹 회원 클리닉</span>'
        +'<span style="font-size:12px;color:#6b7280;font-weight:400">'+adminImwebClinics.length+'개</span></div>'
        + (adminImwebClinics.length === 0 ? '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">아임웹 클리닉 없음</div>' :
          adminImwebClinics.map(clinicRow).join(''))
        +'</div>';

      /* 직접 등록 클리닉 */
      html += '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:#16a34a"></div>'
        +'<span style="font-size:14px;font-weight:700;color:#1f2937">직접 등록 클리닉</span>'
        +'<span style="font-size:12px;color:#6b7280;font-weight:400">'+adminDirectClinics.length+'개</span></div>'
        + (adminDirectClinics.length === 0 ? '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">직접 등록 클리닉 없음</div>' :
          adminDirectClinics.map(clinicRow).join(''))
        +'</div>';

      html += '</div>';
      body.innerHTML = html;

      body.addEventListener('click', function(e) {
        var vb = e.target.closest('[data-vc]');
        if (!vb) return;
        var cid = vb.getAttribute('data-vc');
        var clinic = adminClinics.find(function(c){return String(c.id)===cid;});
        showClinicTplModal(cid, clinic ? clinic.name : 'ID:'+cid);
      });
    }

    function showClinicTplModal(clinicId, clinicName) {
      var m = document.createElement('div');
      m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif';

      function load() {
        m.innerHTML = '<div style="background:#fff;border-radius:14px;padding:20px;width:90%;max-width:440px;max-height:80vh;overflow-y:auto">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
          +'<h3 style="font-size:15px;font-weight:700;color:#1f2937;margin:0">'+escH(clinicName)+'</h3>'
          +'<button id="cm-x" style="padding:4px 10px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit">닫기</button></div>'
          +'<div id="cm-l" style="margin-bottom:12px">'+SPIN+'</div>'
          +'<div style="display:flex;gap:4px">'
          +'<input id="cm-n" type="text" placeholder="이름" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box">'
          +'<input id="cm-u" type="text" placeholder="URL" style="flex:2;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box">'
          +'<button id="cm-a" style="padding:8px 12px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">추가</button></div></div>';

        m.querySelector('#cm-x').addEventListener('click', function(){m.remove();});
        m.addEventListener('click', function(e){if(e.target===m)m.remove();});

        callAPI('/codi/link-templates?clinic_id='+clinicId).then(function(d) {
          var tpls = d.templates||[];
          var list = m.querySelector('#cm-l');
          if(tpls.length===0){list.innerHTML='<div style="text-align:center;padding:14px;color:#9ca3af;font-size:12px">없음</div>';}
          else {
            list.innerHTML = tpls.map(function(t){
              return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #f3f4f6">'
                +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
                +'<div style="font-size:10px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
                +'<button data-md="'+escH(t.id)+'" style="padding:2px 6px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit">삭제</button></div>';
            }).join('');
          }
          list.addEventListener('click',function(e){
            var db=e.target.closest('[data-md]');if(!db)return;
            showDeleteModal('이 템플릿을 삭제하시겠습니까?',function(){callAPI('/codi/link-templates/'+db.getAttribute('data-md'),{method:'DELETE'}).then(function(){toast('삭제됨');load();}).catch(function(err){toast(err.message,'error');});});
          });
        });

        m.querySelector('#cm-a').addEventListener('click',function(){
          var n=m.querySelector('#cm-n').value.trim(), u=m.querySelector('#cm-u').value.trim();
          if(!n||!u){toast('이름과 URL 필수','error');return;}
          callAPI('/codi/link-templates',{method:'POST',body:JSON.stringify({name:n,url:u,clinic_id:clinicId})})
          .then(function(){toast('추가됨');load();}).catch(function(err){toast(err.message,'error');});
        });
      }
      document.body.appendChild(m);
      load();
    }

    renderAdminContent();
  }

  /* ===== 시작 ===== */
  tryAuth();
})();
