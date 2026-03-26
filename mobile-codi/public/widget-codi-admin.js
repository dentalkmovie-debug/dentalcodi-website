(function(){
  'use strict';
  var API = window.location.origin;
  var root = document.getElementById('admin-root');
  var authToken = '', authMember = null, clinics = [], currentTab = 'push';

  function escH(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function toast(msg, type) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:fadeIn .3s ease;font-family:inherit';
    d.style.background = type === 'error' ? '#ef4444' : '#2563eb';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function() { d.style.transition='opacity .3s'; d.style.opacity='0'; setTimeout(function(){d.remove();},300); }, 2500);
  }

  function callAPI(path, opts) {
    opts = opts || {};
    var hd = {'Content-Type':'application/json'};
    if (authToken) hd['Authorization'] = 'Bearer ' + authToken;
    var fo = { method: opts.method||'GET', headers: hd };
    if (opts.body) fo.body = opts.body;
    return fetch(API + '/api' + path, fo).then(function(r) {
      return r.json().then(function(d) {
        if (!r.ok) throw new Error(d.error || '오류('+r.status+')');
        return d;
      });
    });
  }

  /* ===== 로그인 UI ===== */
  function showLogin() {
    root.innerHTML = '<div style="max-width:400px;margin:80px auto;padding:24px">'
      +'<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:20px;border-radius:12px 12px 0 0;color:#fff;text-align:center">'
      +'<div style="font-size:20px;font-weight:700">코디 관리자</div>'
      +'<div style="font-size:13px;opacity:.8;margin-top:4px">최고관리자 전용</div></div>'
      +'<div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">'
      +'<div style="margin-bottom:14px"><label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:4px">이메일</label>'
      +'<input id="ca-email" type="email" placeholder="admin@example.com" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;font-family:inherit"></div>'
      +'<div style="margin-bottom:16px"><label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:4px">비밀번호</label>'
      +'<input id="ca-pw" type="password" placeholder="비밀번호" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;font-family:inherit"></div>'
      +'<button id="ca-login" style="width:100%;padding:12px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">로그인</button></div></div>';

    document.getElementById('ca-login').addEventListener('click', doLogin);
    document.getElementById('ca-pw').addEventListener('keypress', function(e) { if (e.key==='Enter') doLogin(); });
  }

  function doLogin() {
    var email = document.getElementById('ca-email').value.trim();
    var pw = document.getElementById('ca-pw').value;
    if (!email || !pw) { toast('이메일과 비밀번호를 입력하세요', 'error'); return; }
    var btn = document.getElementById('ca-login');
    btn.disabled = true; btn.textContent = '로그인 중...';

    callAPI('/auth/login', { method:'POST', body:JSON.stringify({email:email,password:pw}) })
    .then(function(d) {
      if (!d.token) throw new Error('토큰 없음');
      authToken = d.token;
      authMember = d.member;
      if (authMember.role !== 'super_admin') {
        authToken = ''; authMember = null;
        throw new Error('최고관리자 계정만 접근 가능합니다.');
      }
      try { localStorage.setItem('codi_admin_token', authToken); localStorage.setItem('codi_admin_member', JSON.stringify(authMember)); } catch(e){}
      renderApp();
    })
    .catch(function(err) { btn.disabled = false; btn.textContent = '로그인'; toast(err.message, 'error'); });
  }

  /* ===== 메인 앱 렌더링 ===== */
  function renderApp() {
    root.innerHTML = '<div style="max-width:800px;margin:0 auto;padding:16px;font-family:Noto Sans KR,sans-serif">'
      +'<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:16px 20px;color:#fff;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      +'<div><div style="font-size:18px;font-weight:700">코디 관리자</div><div style="font-size:12px;opacity:.8;margin-top:2px">'+escH(authMember.name)+' · 최고관리자</div></div>'
      +'<button id="ca-logout" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">로그아웃</button></div>'
      +'<div id="ca-tabs" style="display:flex;gap:8px;margin-bottom:16px"></div>'
      +'<div id="ca-content"></div></div>';

    var tabs = [['push','링크 배포'],['templates','전체 템플릿'],['clinics','클리닉 목록']];
    var tabsEl = document.getElementById('ca-tabs');
    tabs.forEach(function(t) {
      var b = document.createElement('button');
      b.setAttribute('data-tab', t[0]);
      b.style.cssText = 'padding:10px 20px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151';
      b.textContent = t[1];
      b.addEventListener('click', function() { currentTab = t[0]; renderTab(); });
      tabsEl.appendChild(b);
    });

    document.getElementById('ca-logout').addEventListener('click', function() {
      authToken=''; authMember=null; try{localStorage.removeItem('codi_admin_token');localStorage.removeItem('codi_admin_member');}catch(e){}
      showLogin();
    });

    // 클리닉 목록 로드
    callAPI('/codi/admin/clinics').then(function(d) {
      clinics = d.clinics || [];
      renderTab();
    }).catch(function(err) { toast('클리닉 로드 실패: ' + err.message, 'error'); renderTab(); });
  }

  function renderTab() {
    // 탭 활성화 UI
    document.querySelectorAll('#ca-tabs button').forEach(function(b) {
      var active = b.getAttribute('data-tab') === currentTab;
      b.style.background = active ? '#2563eb' : '#fff';
      b.style.color = active ? '#fff' : '#374151';
      b.style.borderColor = active ? '#2563eb' : '#d1d5db';
    });
    var el = document.getElementById('ca-content');
    if (!el) return;
    ({push:tabPush,templates:tabTemplates,clinics:tabClinics}[currentTab]||tabPush)(el);
  }

  /* ===== 탭1: 링크 배포 ===== */
  function tabPush(el) {
    var clinicOpts = clinics.map(function(c) {
      return '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;background:#fff">'
        +'<input type="checkbox" value="'+c.id+'" class="ca-clinic-cb" style="width:16px;height:16px;accent-color:#2563eb">'
        +'<span style="font-weight:600;color:#1f2937">'+escH(c.name)+'</span>'
        +(c.phone?'<span style="font-size:11px;color:#9ca3af">'+escH(c.phone)+'</span>':'')
        +'</label>';
    }).join('');

    el.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
      +'<div style="padding:16px;border-bottom:1px solid #e5e7eb"><span style="font-size:16px;font-weight:700;color:#1f2937">링크 템플릿 배포</span>'
      +'<p style="font-size:12px;color:#6b7280;margin-top:4px">선택한 클리닉에 링크 템플릿을 일괄 등록합니다.</p></div>'
      +'<div style="padding:16px">'

      /* 클리닉 선택 */
      +'<div style="margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<label style="font-size:14px;font-weight:600;color:#1f2937">대상 클리닉 선택</label>'
      +'<label style="font-size:12px;color:#2563eb;cursor:pointer;display:flex;align-items:center;gap:4px"><input type="checkbox" id="ca-all-clinics" style="accent-color:#2563eb"> 전체선택</label></div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;max-height:200px;overflow-y:auto;padding:4px">'
      + clinicOpts
      +'</div></div>'

      /* 등록할 링크 */
      +'<div style="margin-bottom:16px">'
      +'<label style="font-size:14px;font-weight:600;color:#1f2937;display:block;margin-bottom:4px">배포할 링크</label>'
      +'<p style="font-size:11px;color:#6b7280;margin-bottom:8px">여러 링크를 한번에 배포하려면 추가 버튼으로 등록하세요.<br>추가 없이도 위 입력란에 입력 후 바로 배포할 수 있습니다.</p>'
      +'<div id="ca-tpl-list" style="margin-bottom:10px"></div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'
      +'<input id="ca-t-name" type="text" placeholder="링크 이름 (예: 임플란트 안내)" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box">'
      +'<input id="ca-t-url" type="text" placeholder="URL (https://...)" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box">'
      +'<div style="display:flex;gap:6px;align-items:center"><input id="ca-t-thumb" type="text" placeholder="썸네일 (자동 추출)" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box">'
      +'<button id="ca-t-og" style="padding:10px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap" title="URL에서 썸네일 자동 추출"><i class="fas fa-image"></i></button>'
      +'<button id="ca-t-add" style="padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">+ 추가</button></div>'
      +'<input id="ca-t-memo" type="text" placeholder="기본 메모 (링크 선택 시 자동 입력, 선택)" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box">'
      +'</div></div>'

      /* 배포 버튼 */
      +'<button id="ca-push-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">선택 클리닉에 배포</button>'
      +'</div></div>';

    /* 임시 템플릿 리스트 */
    var tplQueue = [];

    function renderQueue() {
      var box = document.getElementById('ca-tpl-list');
      if (!box) return;
      if (tplQueue.length === 0) { box.innerHTML = '<div style="padding:12px;text-align:center;color:#9ca3af;font-size:12px;background:#f9fafb;border-radius:8px">추가된 템플릿이 없습니다</div>'; return; }
      box.innerHTML = tplQueue.map(function(t, i) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:6px">'
          +(t.thumbnail?'<img src="'+escH(t.thumbnail)+'" style="width:32px;height:32px;border-radius:4px;object-fit:cover">':'')
          +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#1e40af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
          +'<div style="font-size:11px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
          +'<button data-rm="'+i+'" style="padding:2px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit">삭제</button></div>';
      }).join('');
    }
    renderQueue();

    /* 전체선택 */
    document.getElementById('ca-all-clinics').addEventListener('change', function() {
      var checked = this.checked;
      document.querySelectorAll('.ca-clinic-cb').forEach(function(cb) { cb.checked = checked; });
    });

    /* 썸네일 자동 추출 */
    document.getElementById('ca-t-og').addEventListener('click', function() {
      var url = document.getElementById('ca-t-url').value.trim();
      if (!url) { toast('URL을 먼저 입력하세요', 'error'); return; }
      var btn = this; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      callAPI('/codi/og-image?url=' + encodeURIComponent(url)).then(function(r) {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-image"></i>';
        if (r.thumbnail) { document.getElementById('ca-t-thumb').value = r.thumbnail; toast('썸네일 추출 완료'); }
        else toast('썸네일을 찾을 수 없습니다', 'error');
      }).catch(function() { btn.disabled = false; btn.innerHTML = '<i class="fas fa-image"></i>'; toast('추출 실패', 'error'); });
    });

    /* 템플릿 추가 */
    document.getElementById('ca-t-add').addEventListener('click', function() {
      var name = document.getElementById('ca-t-name').value.trim();
      var url = document.getElementById('ca-t-url').value.trim();
      var thumb = document.getElementById('ca-t-thumb').value.trim();
      var memo = document.getElementById('ca-t-memo').value.trim();
      if (!name || !url) { toast('이름과 URL을 입력하세요', 'error'); return; }
      tplQueue.push({ name:name, url:url, thumbnail:thumb, default_memo:memo });
      document.getElementById('ca-t-name').value = '';
      document.getElementById('ca-t-url').value = '';
      document.getElementById('ca-t-thumb').value = '';
      document.getElementById('ca-t-memo').value = '';
      renderQueue();
      toast('"'+name+'" 추가됨');
    });

    /* 템플릿 삭제 */
    document.getElementById('ca-tpl-list').addEventListener('click', function(e) {
      var rm = e.target.closest('[data-rm]');
      if (rm) { tplQueue.splice(parseInt(rm.getAttribute('data-rm')), 1); renderQueue(); }
    });

    /* 배포 */
    document.getElementById('ca-push-btn').addEventListener('click', function() {
      var selectedClinics = [];
      document.querySelectorAll('.ca-clinic-cb:checked').forEach(function(cb) { selectedClinics.push(parseInt(cb.value)); });
      if (selectedClinics.length === 0) { toast('클리닉을 선택하세요', 'error'); return; }
      /* 입력란에 있는 링크도 자동 추가 */
      var inName = document.getElementById('ca-t-name').value.trim();
      var inUrl = document.getElementById('ca-t-url').value.trim();
      if (inName && inUrl) {
        var inThumb = document.getElementById('ca-t-thumb').value.trim();
        var inMemo = document.getElementById('ca-t-memo').value.trim();
        tplQueue.push({ name:inName, url:inUrl, thumbnail:inThumb, default_memo:inMemo });
      }
      if (tplQueue.length === 0) { toast('배포할 템플릿을 추가하세요', 'error'); return; }
      if (!confirm(selectedClinics.length + '개 클리닉에 ' + tplQueue.length + '개 템플릿을 배포하시겠습니까?')) return;
      
      var btn = this; btn.disabled = true; btn.textContent = '배포 중...';
      callAPI('/codi/admin/push-templates', {
        method:'POST',
        body:JSON.stringify({ clinic_ids: selectedClinics, templates: tplQueue })
      }).then(function(d) {
        btn.disabled = false; btn.textContent = '선택 클리닉에 배포';
        toast('배포 완료! ' + d.pushed + '개 등록됨 (대상: ' + (d.targetClinicIds||[]).length + '개 클리닉)');
        tplQueue = []; renderQueue();
        /* 체크박스 + 전체선택 초기화 */
        document.querySelectorAll('.ca-clinic-cb').forEach(function(cb) { cb.checked = false; });
        var allCb = document.getElementById('ca-all-clinics'); if (allCb) allCb.checked = false;
        /* 입력필드 초기화 */
        var n=document.getElementById('ca-t-name'); if(n) n.value='';
        var u=document.getElementById('ca-t-url'); if(u) u.value='';
        var t=document.getElementById('ca-t-thumb'); if(t) t.value='';
      }).catch(function(err) {
        btn.disabled = false; btn.textContent = '선택 클리닉에 배포';
        toast('오류: ' + (err.message || JSON.stringify(err)), 'error');
        console.error('[push-templates] error:', err);
      });
    });
  }

  /* ===== 탭2: 전체 템플릿 현황 ===== */
  function tabTemplates(el) {
    el.innerHTML = '<div style="padding:40px;text-align:center"><div style="display:inline-block;width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite"></div></div>';

    callAPI('/codi/admin/all-templates').then(function(d) {
      var tpls = d.templates || [];
      /* 클리닉별 그룹 */
      var groups = {};
      tpls.forEach(function(t) {
        var key = t.clinic_id || '0';
        var cname = t.clinic_name || '(미지정)';
        if (!groups[key]) groups[key] = { name: cname, items: [] };
        groups[key].items.push(t);
      });

      var html = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
        +'<div style="padding:16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">'
        +'<span style="font-size:16px;font-weight:700;color:#1f2937">전체 링크 템플릿 현황</span>'
        +'<span style="font-size:13px;color:#6b7280">총 '+tpls.length+'개</span></div>'
        +'<div style="padding:16px">';

      Object.keys(groups).forEach(function(key) {
        var g = groups[key];
        html += '<div style="margin-bottom:16px"><div style="font-size:14px;font-weight:700;color:#1e40af;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #dbeafe">'+escH(g.name)+' <span style="font-size:12px;color:#6b7280;font-weight:400">('+g.items.length+'개)</span></div>';
        g.items.forEach(function(t) {
          html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6">'
            +(t.thumbnail?'<img src="'+escH(t.thumbnail)+'" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0">':'<div style="width:36px;height:36px;background:#f3f4f6;border-radius:6px;flex-shrink:0"></div>')
            +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
            +'<div style="font-size:11px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
            +'<button data-del-tpl="'+escH(t.id)+'" style="padding:3px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;flex-shrink:0">삭제</button></div>';
        });
        html += '</div>';
      });
      if (tpls.length === 0) html += '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">등록된 템플릿이 없습니다.</div>';
      html += '</div></div>';
      el.innerHTML = html;

      /* 삭제 이벤트 */
      el.addEventListener('click', function(e) {
        var db = e.target.closest('[data-del-tpl]');
        if (!db) return;
        if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
        callAPI('/codi/link-templates/' + db.getAttribute('data-del-tpl'), { method:'DELETE' })
        .then(function() { toast('삭제됨'); tabTemplates(el); })
        .catch(function(err) { toast('삭제 오류: ' + err.message, 'error'); });
      });
    }).catch(function(err) {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px">'+escH(err.message)+'</div>';
    });
  }

  /* ===== 탭3: 클리닉 목록 ===== */
  function tabClinics(el) {
    el.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
      +'<div style="padding:16px;border-bottom:1px solid #e5e7eb"><span style="font-size:16px;font-weight:700;color:#1f2937">등록된 클리닉</span>'
      +'<span style="font-size:13px;color:#6b7280;margin-left:8px">'+clinics.length+'개</span></div>'
      +'<div style="padding:16px">'
      + (clinics.length === 0 ? '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px">클리닉이 없습니다.</div>' :
        clinics.map(function(c) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6">'
            +'<div style="width:40px;height:40px;background:#eff6ff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#2563eb;font-weight:700;flex-shrink:0">'+c.id+'</div>'
            +'<div style="flex:1"><div style="font-size:14px;font-weight:600;color:#1f2937">'+escH(c.name)+'</div>'
            +(c.phone?'<div style="font-size:12px;color:#6b7280">'+escH(c.phone)+'</div>':'')+'</div>'
            +'<button data-view-clinic="'+c.id+'" style="padding:6px 12px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">템플릿 보기</button></div>';
        }).join(''))
      +'</div></div>';

    el.addEventListener('click', function(e) {
      var vb = e.target.closest('[data-view-clinic]');
      if (!vb) return;
      var cid = vb.getAttribute('data-view-clinic');
      showClinicTemplates(cid);
    });
  }

  function showClinicTemplates(clinicId) {
    var clinic = clinics.find(function(c) { return String(c.id) === String(clinicId); });
    var cname = clinic ? clinic.name : 'ID:' + clinicId;

    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:Noto Sans KR,sans-serif';

    function loadAndRender() {
      m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:500px;max-height:80vh;overflow-y:auto">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
        +'<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0">'+escH(cname)+' 링크</h3>'
        +'<button id="cm-close" style="padding:4px 12px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit">닫기</button></div>'
        +'<div id="cm-list" style="margin-bottom:16px"><div style="padding:20px;text-align:center;color:#9ca3af;font-size:12px">로딩 중...</div></div>'
        +'<div style="display:flex;gap:6px">'
        +'<input id="cm-name" type="text" placeholder="이름" style="flex:1;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box">'
        +'<input id="cm-url" type="text" placeholder="URL" style="flex:2;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box">'
        +'<button id="cm-add" style="padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">추가</button></div></div>';

      m.querySelector('#cm-close').addEventListener('click', function() { m.remove(); });
      m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

      callAPI('/codi/link-templates?clinic_id=' + clinicId).then(function(d) {
        var tpls = d.templates || [];
        var list = m.querySelector('#cm-list');
        if (tpls.length === 0) {
          list.innerHTML = '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">등록된 템플릿 없음</div>';
        } else {
          list.innerHTML = tpls.map(function(t) {
            return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6">'
              +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.name)+'</div>'
              +'<div style="font-size:11px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(t.url)+'</div></div>'
              +'<button data-mdel="'+escH(t.id)+'" style="padding:2px 8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit">삭제</button></div>';
          }).join('');
        }

        /* 삭제 */
        list.addEventListener('click', function(e) {
          var db = e.target.closest('[data-mdel]');
          if (!db) return;
          callAPI('/codi/link-templates/' + db.getAttribute('data-mdel'), { method:'DELETE' })
          .then(function() { toast('삭제됨'); loadAndRender(); })
          .catch(function(err) { toast('오류: ' + err.message, 'error'); });
        });
      });

      /* 추가 */
      m.querySelector('#cm-add').addEventListener('click', function() {
        var name = m.querySelector('#cm-name').value.trim();
        var url = m.querySelector('#cm-url').value.trim();
        if (!name || !url) { toast('이름과 URL을 입력하세요', 'error'); return; }
        callAPI('/codi/link-templates', { method:'POST', body:JSON.stringify({ name:name, url:url, clinic_id:clinicId }) })
        .then(function() { toast('추가됨'); loadAndRender(); })
        .catch(function(err) { toast('오류: ' + err.message, 'error'); });
      });
    }

    document.body.appendChild(m);
    loadAndRender();
  }

  /* ===== 시작 ===== */
  // localStorage 복원 시도
  try {
    authToken = localStorage.getItem('codi_admin_token') || '';
    authMember = JSON.parse(localStorage.getItem('codi_admin_member') || 'null');
  } catch(e) {}

  if (authToken && authMember && authMember.role === 'super_admin') {
    renderApp();
  } else {
    showLogin();
  }

  // CSS animation
  var st = document.createElement('style');
  st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(st);
})();
