(function(){
  console.log('DentalTV Widget v1.0.0');

  /* ===== 전역 상태 ===== */
  var API_BASE = '';
  var ADMIN_CODE = '';
  var INITIAL_DATA = {};
  var playlists = [];
  var notices = [];
  var masterItems = [];
  var clinicName = '';
  var isSuperAdmin = false;
  var isOwnerAdmin = false;
  var allClinics = [];
  var currentPage = 'dashboard';
  var noticeSettings = {};
  var _adminSearchQ = '';

  /* ===== 루트 엘리먼트 ===== */
  var root = document.getElementById('dtv-widget-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dtv-widget-root';
    root.style.cssText = 'display:block;width:100%;font-family:"Noto Sans KR",sans-serif';
    document.body.appendChild(root);
  }

  /* ===== CSS 애니메이션 ===== */
  if (!document.getElementById('dtv-style')) {
    var st = document.createElement('style');
    st.id = 'dtv-style';
    st.textContent = '@keyframes dtvSpin{to{transform:rotate(360deg)}}@keyframes dtvFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(st);
  }

  var SPIN = '<div style="display:flex;align-items:center;justify-content:center;padding:40px"><span style="display:inline-block;width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:dtvSpin .6s linear infinite"></span></div>';

  function toast(msg, type) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:dtvFadeIn .3s ease;font-family:"Noto Sans KR",sans-serif';
    d.style.background = type === 'error' ? '#ef4444' : '#2563eb';
    d.textContent = msg; document.body.appendChild(d);
    setTimeout(function() { if (d.parentNode) d.remove(); }, 3000);
  }

  function callAPI(path, opts) {
    opts = opts || {};
    var hd = { 'Content-Type': 'application/json' };
    var fo = { method: opts.method || 'GET', headers: hd };
    if (opts.body) fo.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    var url = path.startsWith('/api/') ? path : '/api/' + ADMIN_CODE + path;
    if (fo.method === 'GET') url += (url.indexOf('?') !== -1 ? '&' : '?') + '_t=' + Date.now();
    return fetch(url, fo).then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok) throw new Error(data.error || '서버오류(' + r.status + ')');
        return data;
      });
    });
  }

  function confirm2(title, msg, onOk) {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:"Noto Sans KR",sans-serif';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:380px">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 8px">' + title + '</h3>'
      + '<p style="font-size:13px;color:#6b7280;margin:0 0 20px;white-space:pre-line">' + msg + '</p>'
      + '<div style="display:flex;gap:8px"><button id="dtv-cfm-cc" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button><button id="dtv-cfm-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">확인</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    m.querySelector('#dtv-cfm-cc').addEventListener('click', function() { m.remove(); });
    m.querySelector('#dtv-cfm-ok').addEventListener('click', function() { m.remove(); onOk(); });
  }

  /* ===== 초기화 ===== */
  function init() {
    var dataEl = document.getElementById('dtv-initial-data');
    if (dataEl) {
      try { INITIAL_DATA = JSON.parse(dataEl.textContent); } catch(e) { console.error('Parse error', e); }
    }
    ADMIN_CODE = INITIAL_DATA.adminCode || '';
    API_BASE = '/api/' + ADMIN_CODE;
    playlists = INITIAL_DATA.playlists || [];
    notices = INITIAL_DATA.notices || [];
    masterItems = INITIAL_DATA.masterItems || [];
    clinicName = INITIAL_DATA.clinicName || '내 치과';
    isSuperAdmin = !!INITIAL_DATA.isSuperAdmin;
    isOwnerAdmin = !!INITIAL_DATA.isOwnerAdmin;
    allClinics = INITIAL_DATA.allClinics || [];
    renderApp();
  }

  /* ===== 메인 렌더링 ===== */
  function renderApp() {
    var mn = isOwnerAdmin ? '관리자' : clinicName;
    var rl = isSuperAdmin ? '최고관리자' : '관리자';
    var tabs = [['dashboard','대시보드'],['playlists','플레이리스트'],['notices','공지사항'],['settings','설정']];
    if (isSuperAdmin) tabs.push(['admin','관리']);

    root.innerHTML = '<div class="dtv-app-loaded" id="dtv-app" style="font-family:\'Noto Sans KR\',sans-serif">'
      // 헤더
      + '<div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:16px 20px;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-size:18px;font-weight:700">' + mn + '</div><div style="font-size:12px;opacity:.8;margin-top:2px">' + rl + ' · 대기실 TV</div></div>'
      + '</div>'
      // 탭 네비게이션
      + '<div id="dtv-nav" style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 8px;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch"></div>'
      // 컨텐츠
      + '<div id="dtv-pg" style="background:#f9fafb;padding:16px;border-radius:0 0 12px 12px;min-height:400px;border:1px solid #e5e7eb;border-top:none"></div></div>';

    var nav = document.getElementById('dtv-nav');
    tabs.forEach(function(t) {
      var b = document.createElement('button');
      b.className = 'dtv-nb'; b.setAttribute('data-p', t[0]);
      b.style.cssText = 'display:inline-block;padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap';
      b.textContent = t[1];
      b.addEventListener('click', function() { currentPage = t[0]; renderPage(); });
      nav.appendChild(b);
    });
    renderPage();
    // 자동 갱신
    setInterval(function() { if (currentPage === 'dashboard' || currentPage === 'playlists') loadPlaylists(); }, 8000);
  }

  function updNav() {
    var all = document.querySelectorAll('.dtv-nb');
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      var active = b.getAttribute('data-p') === currentPage;
      var isAdmin = b.getAttribute('data-p') === 'admin';
      b.style.color = active ? (isAdmin ? '#7c3aed' : '#2563eb') : '#6b7280';
      b.style.fontWeight = active ? '700' : '500';
      b.style.borderBottomColor = active ? (isAdmin ? '#7c3aed' : '#2563eb') : 'transparent';
    }
  }

  function renderPage() {
    updNav();
    var pg = document.getElementById('dtv-pg');
    if (!pg) return;
    var pages = { dashboard: pgDash, playlists: pgPlaylists, notices: pgNotices, settings: pgSettings, admin: pgAdmin };
    (pages[currentPage] || pgDash)(pg);
    postHeight();
  }

  /* ===== 높이 전송 (iframe 연동) ===== */
  function postHeight() {
    try {
      if (window.parent && window.parent !== window) {
        var h = document.getElementById('dtv-app');
        if (h) window.parent.postMessage({ type: 'setHeight', height: h.scrollHeight + 40 }, '*');
      }
    } catch(e) {}
  }

  /* ===== 대시보드 ===== */
  function pgDash(el) {
    var pCount = playlists.length;
    var nCount = notices.length;
    var mCount = masterItems.length;
    var totalItems = 0;
    playlists.forEach(function(p) { totalItems += (p.items || []).length; });

    el.innerHTML = '<div style="animation:dtvFadeIn .3s ease">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<span style="font-size:18px;font-weight:700;color:#1f2937">대시보드</span>'
      + '<span style="font-size:12px;color:#9ca3af">' + new Date().toLocaleDateString('ko-KR') + '</span></div>'
      // 퀵 버튼
      + '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
      + '<button id="dtv-dash-playlist" style="flex:1;min-width:100px;padding:10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">플레이리스트 관리</button>'
      + '<button id="dtv-dash-notice" style="flex:1;min-width:100px;padding:10px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151">공지사항 관리</button></div>'
      // 카드
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">'
      + card('플레이리스트', pCount + '개', '', '#1f2937')
      + card('등록 영상', totalItems + '개', '공용 ' + mCount + '개 포함', '#2563eb')
      + card('공지사항', nCount + '개', '', '#1f2937')
      + card('TV 채널', pCount + '개', '', '#059669')
      + '</div>'
      // 플레이리스트 목록
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#1f2937">플레이리스트 현황</div>'
      + '<div>' + (playlists.length > 0 ? playlists.map(function(p) {
        var items = p.items || [];
        var tvUrl = location.origin + '/' + p.short_code;
        return '<div style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f9fafb">'
          + '<div><p style="font-size:13px;font-weight:600;color:#1f2937;margin:0">' + (p.name || '이름없음') + '</p>'
          + '<p style="font-size:11px;color:#9ca3af;margin:2px 0 0">영상 ' + items.length + '개 · ' + p.short_code + '</p></div>'
          + '<div style="display:flex;gap:6px;align-items:center">'
          + '<button onclick="window._dtvCopy(\'' + tvUrl + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:11px;color:#374151;cursor:pointer;font-family:inherit">URL 복사</button>'
          + '</div></div>';
      }).join('') : '<p style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">플레이리스트가 없습니다</p>') + '</div></div></div>';

    bind('dtv-dash-playlist', function() { currentPage = 'playlists'; renderPage(); });
    bind('dtv-dash-notice', function() { currentPage = 'notices'; renderPage(); });
    postHeight();
  }

  function card(lb, v, sub, c) {
    return '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #f3f4f6"><p style="font-size:12px;color:#9ca3af;margin:0 0 4px">' + lb + '</p><p style="font-size:18px;font-weight:700;color:' + c + ';margin:0">' + v + '</p>' + (sub ? '<p style="font-size:11px;color:#9ca3af;margin:3px 0 0">' + sub + '</p>' : '') + '</div>';
  }

  /* ===== 플레이리스트 관리 ===== */
  function pgPlaylists(el) {
    el.innerHTML = '<div style="animation:dtvFadeIn .3s ease">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<span style="font-size:18px;font-weight:700;color:#1f2937">플레이리스트 관리</span>'
      + '<button id="dtv-add-pl" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ 추가</button></div>'
      + '<div id="dtv-pl-list">' + renderPlaylistList() + '</div></div>';
    bind('dtv-add-pl', function() { showCreatePlaylistModal(); });
    postHeight();
  }

  function renderPlaylistList() {
    if (playlists.length === 0) return '<p style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">플레이리스트가 없습니다.</p>';
    return playlists.map(function(p) {
      var items = p.items || [];
      var activeCount = (p.activeItemIds || []).length || items.length;
      var tvUrl = location.origin + '/' + p.short_code;
      return '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:10px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
        + '<div><p style="font-size:15px;font-weight:600;color:#1f2937;margin:0">' + (p.name || '이름없음') + '</p>'
        + '<p style="font-size:12px;color:#9ca3af;margin:3px 0 0">활성 ' + activeCount + '개 / 전체 ' + items.length + '개 · 코드: ' + p.short_code + '</p></div>'
        + '<div style="display:flex;gap:4px">'
        + '<button class="dtv-pl-edit" data-id="' + p.id + '" style="padding:5px 12px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:12px;color:#374151;cursor:pointer;font-family:inherit">편집</button>'
        + '<button class="dtv-pl-copy" data-url="' + tvUrl + '" style="padding:5px 12px;border-radius:6px;border:none;background:#eff6ff;font-size:12px;color:#2563eb;cursor:pointer;font-family:inherit">URL</button>'
        + '</div></div>'
        // 영상 목록 미리보기
        + '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">'
        + items.slice(0, 6).map(function(item) {
          var thumb = item.thumbnail_url
            ? '<img src="' + item.thumbnail_url + '" style="width:64px;height:40px;object-fit:cover;border-radius:4px">'
            : '<div style="width:64px;height:40px;background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#9ca3af">영상</div>';
          return '<div style="flex-shrink:0;text-align:center">' + thumb + '<p style="font-size:9px;color:#9ca3af;margin:2px 0 0;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (item.title || '').slice(0, 10) + '</p></div>';
        }).join('')
        + (items.length > 6 ? '<div style="flex-shrink:0;width:64px;height:40px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#9ca3af;background:#f3f4f6;border-radius:4px">+' + (items.length - 6) + '</div>' : '')
        + '</div></div>';
    }).join('');
  }

  /* ===== 공지사항 관리 ===== */
  function pgNotices(el) {
    el.innerHTML = '<div style="animation:dtvFadeIn .3s ease">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<span style="font-size:18px;font-weight:700;color:#1f2937">공지사항 관리</span>'
      + '<button id="dtv-add-notice" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ 새 공지</button></div>'
      + '<div id="dtv-notice-list">' + renderNoticeList() + '</div></div>';
    bind('dtv-add-notice', function() { showNoticeModal(); });
    postHeight();
  }

  function renderNoticeList() {
    if (notices.length === 0) return '<p style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">공지사항이 없습니다.</p>';
    return notices.map(function(n) {
      var urgentBadge = n.is_urgent ? '<span style="padding:2px 8px;border-radius:20px;background:#fef2f2;color:#dc2626;font-size:10px;font-weight:600;margin-left:6px">긴급</span>' : '';
      var statusDot = n.is_active ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:6px"></span>' : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d1d5db;margin-right:6px"></span>';
      return '<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center">' + statusDot + '<p style="font-size:14px;font-weight:500;color:#1f2937;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (n.content || '') + '</p>' + urgentBadge + '</div></div>'
        + '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px">'
        + '<button class="dtv-n-toggle" data-id="' + n.id + '" data-active="' + (n.is_active ? 1 : 0) + '" style="padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:11px;color:#374151;cursor:pointer;font-family:inherit">' + (n.is_active ? 'OFF' : 'ON') + '</button>'
        + '<button class="dtv-n-del" data-id="' + n.id + '" style="padding:4px 10px;border-radius:6px;border:none;background:#fef2f2;font-size:11px;color:#dc2626;cursor:pointer;font-family:inherit">삭제</button>'
        + '</div></div>';
    }).join('');
  }

  /* ===== 설정 ===== */
  function pgSettings(el) {
    var IS = 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;';
    el.innerHTML = '<div style="animation:dtvFadeIn .3s ease">'
      + '<div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:16px">설정</div>'
      // 치과 정보
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:12px">'
      + '<p style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 10px">치과 정보</p>'
      + '<div style="display:flex;gap:8px"><input id="dtv-set-name" type="text" value="' + esc(clinicName) + '" placeholder="치과명" style="' + IS + 'flex:1">'
      + '<button id="dtv-set-name-save" style="padding:10px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">저장</button></div>'
      + '<p style="font-size:12px;color:#9ca3af;margin:8px 0 0">관리자 코드: <span style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px">' + ADMIN_CODE + '</span></p></div>'
      // TV URL
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:12px">'
      + '<p style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 10px">TV 바로가기 URL</p>'
      + '<div id="dtv-set-urls">' + playlists.map(function(p) {
        var tvUrl = location.origin + '/' + p.short_code;
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6">'
          + '<div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:500;margin:0">' + (p.name || '') + '</p>'
          + '<p style="font-size:11px;color:#2563eb;font-family:monospace;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + tvUrl + '</p></div>'
          + '<button onclick="window._dtvCopy(\'' + tvUrl + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:11px;color:#374151;cursor:pointer;font-family:inherit;flex-shrink:0">복사</button></div>';
      }).join('') + '</div></div>'
      // 공지 스타일
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
      + '<p style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 10px">공지 스타일</p>'
      + '<div id="dtv-set-notice-style">' + SPIN + '</div></div></div>';

    bind('dtv-set-name-save', function() {
      var v = document.getElementById('dtv-set-name').value.trim();
      if (!v) return;
      callAPI('/settings', { method: 'PUT', body: { clinic_name: v } }).then(function() {
        clinicName = v; toast('저장 완료'); renderApp();
      }).catch(function(e) { toast(e.message, 'error'); });
    });
    loadNoticeStyle();
    postHeight();
  }

  function loadNoticeStyle() {
    callAPI('/settings').then(function(d) {
      noticeSettings = d;
      var c = document.getElementById('dtv-set-notice-style');
      if (!c) return;
      var IS = 'width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;font-family:inherit;';
      c.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
        + '<div><p style="font-size:11px;color:#6b7280;margin:0 0 4px">글자 크기</p><input id="dtv-ns-fs" type="number" value="' + (d.notice_font_size || 32) + '" min="16" max="200" style="' + IS + '"></div>'
        + '<div><p style="font-size:11px;color:#6b7280;margin:0 0 4px">글자 색상</p><input id="dtv-ns-tc" type="color" value="' + (d.notice_text_color || '#ffffff') + '" style="width:100%;height:36px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"></div>'
        + '<div><p style="font-size:11px;color:#6b7280;margin:0 0 4px">배경 색상</p><input id="dtv-ns-bc" type="color" value="' + (d.notice_bg_color || '#1a1a2e') + '" style="width:100%;height:36px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"></div></div>'
        + '<button id="dtv-ns-save" style="margin-top:10px;padding:8px 20px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">저장</button>';
      bind('dtv-ns-save', function() {
        callAPI('/settings', {
          method: 'PUT',
          body: {
            notice_font_size: parseInt(document.getElementById('dtv-ns-fs').value) || 32,
            notice_text_color: document.getElementById('dtv-ns-tc').value,
            notice_bg_color: document.getElementById('dtv-ns-bc').value
          }
        }).then(function() { toast('공지 스타일 저장 완료'); }).catch(function(e) { toast(e.message, 'error'); });
      });
    }).catch(function() {
      var c = document.getElementById('dtv-set-notice-style');
      if (c) c.innerHTML = '<p style="font-size:12px;color:#9ca3af">로드 실패</p>';
    });
  }

  /* ===== 최고관리자 탭 ===== */
  function pgAdmin(el) {
    if (!isSuperAdmin) { el.innerHTML = '<p style="padding:20px;color:#9ca3af">접근 권한이 없습니다.</p>'; return; }
    var subTabs = [['clinics','치과 관리'],['master','공용 영상'],['push','링크 배포']];
    var _sub = 'clinics';

    el.innerHTML = '<div style="animation:dtvFadeIn .3s ease">'
      + '<div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:12px">최고관리자</div>'
      + '<div id="dtv-admin-tabs" style="display:flex;gap:6px;margin-bottom:12px">'
      + subTabs.map(function(t) {
        return '<button class="dtv-asub" data-sub="' + t[0] + '" style="padding:7px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;' + (t[0] === _sub ? 'background:#7c3aed;color:#fff' : 'background:#f3f4f6;color:#6b7280') + '">' + t[1] + '</button>';
      }).join('') + '</div>'
      + '<div id="dtv-admin-body"></div></div>';

    renderAdminSub('clinics');
    var btns = document.querySelectorAll('.dtv-asub');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        var s = this.getAttribute('data-sub');
        var all2 = document.querySelectorAll('.dtv-asub');
        for (var j = 0; j < all2.length; j++) {
          all2[j].style.background = all2[j].getAttribute('data-sub') === s ? '#7c3aed' : '#f3f4f6';
          all2[j].style.color = all2[j].getAttribute('data-sub') === s ? '#fff' : '#6b7280';
        }
        renderAdminSub(s);
      });
    }
    postHeight();
  }

  function renderAdminSub(sub) {
    var body = document.getElementById('dtv-admin-body');
    if (!body) return;
    if (sub === 'clinics') renderAdmClinics(body);
    else if (sub === 'master') renderAdmMaster(body);
    else if (sub === 'push') renderAdmPush(body);
  }

  function renderAdmClinics(body) {
    var q = _adminSearchQ.toLowerCase().trim();
    var filtered = (allClinics || []).filter(function(c) {
      if (!q) return true;
      return (c.clinic_name || '').toLowerCase().indexOf(q) !== -1 || (c.imweb_email || '').toLowerCase().indexOf(q) !== -1 || (c.admin_code || '').toLowerCase().indexOf(q) !== -1;
    });
    var total = allClinics.length;
    var activeN = filtered.filter(function(c) { return c.is_active !== 0; }).length;
    var imwebN = filtered.filter(function(c) { return !!c.imweb_member_id; }).length;

    body.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<span style="font-size:14px;font-weight:600;color:#1f2937">치과 관리 (' + total + '개)</span>'
      + '<button id="dtv-adm-refresh" style="padding:4px 12px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:11px;color:#7c3aed;cursor:pointer;font-family:inherit">새로고침</button></div>'
      // 검색
      + '<input id="dtv-adm-search" type="text" value="' + esc(q) + '" placeholder="치과명, 이메일, 코드 검색..." style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;outline:none;font-family:inherit">'
      // 배지
      + '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">'
      + '<span style="padding:3px 10px;border-radius:20px;background:#dcfce7;color:#166534;font-size:11px;font-weight:600">활성 ' + activeN + '</span>'
      + '<span style="padding:3px 10px;border-radius:20px;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600">임웹 ' + imwebN + '</span>'
      + '<span style="padding:3px 10px;border-radius:20px;background:#fef9c3;color:#854d0e;font-size:11px;font-weight:600" title="아임웹 회원이지만 DB에 치과 레코드가 없는 미등록 상태">미등록 ' + (filtered.length - imwebN) + '</span></div>'
      // 목록
      + '<div style="max-height:50vh;overflow-y:auto">' + (filtered.length === 0 ? '<p style="text-align:center;padding:16px;color:#9ca3af;font-size:13px">' + (q ? '검색 결과 없음' : '등록된 치과 없음') + '</p>' :
        filtered.map(function(c) {
          var sBadge = c.is_active === 0 ? '<span style="padding:2px 8px;border-radius:20px;background:#fef2f2;color:#dc2626;font-size:10px;font-weight:600">정지</span>' : '<span style="padding:2px 8px;border-radius:20px;background:#dcfce7;color:#166534;font-size:10px;font-weight:600">활성</span>';
          var iBadge = c.imweb_member_id ? '<span style="padding:2px 8px;border-radius:20px;background:#dbeafe;color:#1e40af;font-size:10px;font-weight:600">임웹</span>' : '<span style="padding:2px 8px;border-radius:20px;background:#fef9c3;color:#854d0e;font-size:10px;font-weight:600">미등록</span>';
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6">'
            + '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap"><span style="font-size:13px;font-weight:500;color:#1f2937">' + (c.clinic_name || '이름없음') + '</span>' + sBadge + ' ' + iBadge + '</div>'
            + '<p style="font-size:11px;color:#9ca3af;margin:2px 0 0">' + (c.imweb_email || c.admin_code) + ' · 플레이리스트 ' + (c.playlist_count || 0) + '개</p></div>'
            + '<div style="display:flex;gap:4px;flex-shrink:0">'
            + (c.is_active !== 0
              ? '<button class="dtv-adm-suspend" data-code="' + c.admin_code + '" style="padding:4px 10px;border-radius:6px;border:none;background:#fef2f2;font-size:11px;color:#dc2626;cursor:pointer;font-family:inherit">정지</button>'
              : '<button class="dtv-adm-activate" data-code="' + c.admin_code + '" style="padding:4px 10px;border-radius:6px;border:none;background:#dcfce7;font-size:11px;color:#166534;cursor:pointer;font-family:inherit">활성화</button>')
            + '</div></div>';
        }).join('')) + '</div></div>';

    // 이벤트
    var searchInput = document.getElementById('dtv-adm-search');
    if (searchInput) searchInput.addEventListener('input', function() { _adminSearchQ = this.value; renderAdmClinics(body); });
    bind('dtv-adm-refresh', function() {
      callAPI('/api/master/users').then(function(d) {
        allClinics = (d.users || []).filter(function(u) { return !u.is_master; });
        toast('새로고침 완료'); renderAdmClinics(body);
      }).catch(function(e) { toast(e.message, 'error'); });
    });
    bindAll('.dtv-adm-suspend', function() {
      var code = this.getAttribute('data-code');
      confirm2('정지', '이 치과를 정지하시겠습니까?', function() {
        callAPI('/api/master/clinics/' + code + '/suspend', { method: 'POST', body: { reason: '관리자 정지' } }).then(function() {
          toast('정지 완료');
          var c = allClinics.find(function(x) { return x.admin_code === code; });
          if (c) c.is_active = 0;
          renderAdmClinics(body);
        }).catch(function(e) { toast(e.message, 'error'); });
      });
    });
    bindAll('.dtv-adm-activate', function() {
      var code = this.getAttribute('data-code');
      callAPI('/api/master/clinics/' + code + '/activate', { method: 'POST' }).then(function() {
        toast('활성화 완료');
        var c = allClinics.find(function(x) { return x.admin_code === code; });
        if (c) c.is_active = 1;
        renderAdmClinics(body);
      }).catch(function(e) { toast(e.message, 'error'); });
    });
    postHeight();
  }

  function renderAdmMaster(body) {
    var IS = 'flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;font-family:inherit;';
    body.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
      + '<p style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 10px">공용 영상 관리 (' + masterItems.length + '개)</p>'
      + '<div style="display:flex;gap:8px;margin-bottom:12px"><input id="dtv-adm-url" type="text" placeholder="YouTube 또는 Vimeo URL" style="' + IS + '">'
      + '<button id="dtv-adm-add" style="padding:10px 16px;border-radius:8px;border:none;background:#7c3aed;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">추가</button></div>'
      + '<div id="dtv-master-list">' + masterItems.map(function(item) {
        var thumb = item.thumbnail_url ? '<img src="' + item.thumbnail_url + '" style="width:48px;height:30px;object-fit:cover;border-radius:4px">' : '<div style="width:48px;height:30px;background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#9ca3af">영상</div>';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">'
          + thumb + '<div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:500;color:#1f2937;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (item.title || item.url || '') + '</p>'
          + '<p style="font-size:10px;color:#9ca3af;margin:2px 0 0">' + (item.item_type || '') + '</p></div>'
          + '<button class="dtv-mi-del" data-id="' + item.id + '" style="padding:4px 10px;border-radius:6px;border:none;background:#fef2f2;font-size:11px;color:#dc2626;cursor:pointer;font-family:inherit;flex-shrink:0">삭제</button></div>';
      }).join('') + '</div></div>';

    bind('dtv-adm-add', function() {
      var urlInput = document.getElementById('dtv-adm-url');
      if (!urlInput || !urlInput.value.trim()) return;
      callAPI('/api/master/items', { method: 'POST', body: { url: urlInput.value.trim() } }).then(function() {
        urlInput.value = ''; toast('추가 완료');
        return callAPI('/api/master/items');
      }).then(function(d) { masterItems = d.items || []; renderAdmMaster(body); }).catch(function(e) { toast(e.message, 'error'); });
    });
    bindAll('.dtv-mi-del', function() {
      var id = this.getAttribute('data-id');
      confirm2('삭제', '이 공용 영상을 삭제하시겠습니까?', function() {
        callAPI('/api/master/items/' + id, { method: 'DELETE' }).then(function() {
          masterItems = masterItems.filter(function(i) { return String(i.id) !== String(id); });
          toast('삭제 완료'); renderAdmMaster(body);
        }).catch(function(e) { toast(e.message, 'error'); });
      });
    });
    postHeight();
  }

  function renderAdmPush(body) {
    var clinics = allClinics.filter(function(c) { return c.is_active !== 0; });
    body.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px">'
      + '<p style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 4px">링크 배포</p>'
      + '<p style="font-size:12px;color:#9ca3af;margin:0 0 12px">선택한 치과의 첫 번째 플레이리스트에 영상 링크를 추가합니다.</p>'
      // STEP 1
      + '<div style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#7c3aed;color:#fff;font-size:11px;font-weight:700">1</span><span style="font-size:13px;font-weight:600;color:#374151">대상 선택 (' + clinics.length + '개)</span><span id="dtv-push-cnt" style="font-size:11px;color:#7c3aed;margin-left:auto">0개 선택</span></div>'
      + '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;color:#6b7280;cursor:pointer"><input type="checkbox" id="dtv-push-all" style="accent-color:#7c3aed"> 전체 선택</label>'
      + '<div style="max-height:120px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:6px">'
      + clinics.map(function(c) {
        return '<label style="display:flex;align-items:center;gap:6px;padding:4px;cursor:pointer;font-size:12px;color:#374151;border-radius:4px" onmouseover="this.style.background=\'#f5f3ff\'" onmouseout="this.style.background=\'transparent\'"><input type="checkbox" class="dtv-push-cb" value="' + c.admin_code + '" style="accent-color:#7c3aed"><span>' + (c.clinic_name || c.admin_code) + '</span></label>';
      }).join('') + '</div></div>'
      // STEP 2
      + '<div style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#7c3aed;color:#fff;font-size:11px;font-weight:700">2</span><span style="font-size:13px;font-weight:600;color:#374151">배포할 링크</span></div>'
      + '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
      + '<button class="dtv-push-tmpl" data-t="master" style="padding:5px 12px;border-radius:6px;border:1px solid #7c3aed;background:#f5f3ff;font-size:11px;color:#7c3aed;cursor:pointer;font-family:inherit;font-weight:600">공용 영상 선택</button>'
      + '<button class="dtv-push-tmpl" data-t="custom" style="padding:5px 12px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:11px;color:#374151;cursor:pointer;font-family:inherit">직접 입력</button></div>'
      + '<div id="dtv-push-master" style="border:1px solid #e5e7eb;border-radius:8px;padding:6px;max-height:100px;overflow-y:auto;margin-bottom:8px">'
      + masterItems.map(function(item) {
        return '<label style="display:flex;align-items:center;gap:6px;padding:3px;cursor:pointer;font-size:12px;color:#374151"><input type="checkbox" class="dtv-push-mi" value="' + item.id + '" data-url="' + (item.url || '') + '" data-title="' + esc(item.title || '') + '" style="accent-color:#7c3aed"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (item.title || item.url || '') + '</span></label>';
      }).join('') + '</div>'
      + '<div id="dtv-push-custom" style="display:none;"><div style="display:flex;gap:6px"><input id="dtv-push-name" type="text" placeholder="링크 이름" style="width:35%;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;font-family:inherit"><input id="dtv-push-url" type="text" placeholder="URL (https://...)" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;font-family:inherit"></div></div></div>'
      // STEP 3
      + '<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#7c3aed;color:#fff;font-size:11px;font-weight:700">3</span><span style="font-size:13px;font-weight:600;color:#374151">배포</span></div>'
      + '<button id="dtv-push-exec" style="width:100%;padding:12px;border-radius:8px;border:none;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 2px 8px rgba(124,58,237,.3)">선택 치과에 배포</button></div></div>';

    // 이벤트
    var allCb = document.getElementById('dtv-push-all');
    if (allCb) allCb.addEventListener('change', function() {
      var cbs = document.querySelectorAll('.dtv-push-cb');
      for (var i = 0; i < cbs.length; i++) cbs[i].checked = allCb.checked;
      updPushCnt();
    });
    bindAll('.dtv-push-cb', function() { updPushCnt(); });
    bindAll('.dtv-push-tmpl', function() {
      var t = this.getAttribute('data-t');
      var m = document.getElementById('dtv-push-master');
      var c = document.getElementById('dtv-push-custom');
      if (m) m.style.display = t === 'master' ? '' : 'none';
      if (c) c.style.display = t === 'custom' ? '' : 'none';
      var bs = document.querySelectorAll('.dtv-push-tmpl');
      for (var i = 0; i < bs.length; i++) {
        var isActive = bs[i].getAttribute('data-t') === t;
        bs[i].style.borderColor = isActive ? '#7c3aed' : '#d1d5db';
        bs[i].style.background = isActive ? '#f5f3ff' : '#fff';
        bs[i].style.color = isActive ? '#7c3aed' : '#374151';
        bs[i].style.fontWeight = isActive ? '600' : '400';
      }
    });
    bind('dtv-push-exec', function() { execPush(body); });
    postHeight();
  }

  function updPushCnt() {
    var n = document.querySelectorAll('.dtv-push-cb:checked').length;
    var el = document.getElementById('dtv-push-cnt');
    if (el) el.textContent = n + '개 선택';
  }

  function execPush(body) {
    var codes = []; var cbs = document.querySelectorAll('.dtv-push-cb:checked');
    for (var i = 0; i < cbs.length; i++) codes.push(cbs[i].value);
    if (codes.length === 0) { toast('대상을 선택하세요', 'error'); return; }

    var masterDiv = document.getElementById('dtv-push-master');
    var isMasterMode = masterDiv && masterDiv.style.display !== 'none';
    var items = [];
    if (isMasterMode) {
      var mis = document.querySelectorAll('.dtv-push-mi:checked');
      for (var j = 0; j < mis.length; j++) items.push({ url: mis[j].dataset.url, title: mis[j].dataset.title || mis[j].dataset.url });
      if (items.length === 0) { toast('공용 영상을 선택하세요', 'error'); return; }
    } else {
      var name = (document.getElementById('dtv-push-name') || {}).value || '';
      var url = (document.getElementById('dtv-push-url') || {}).value || '';
      if (!url.trim()) { toast('URL을 입력하세요', 'error'); return; }
      items.push({ url: url.trim(), title: name.trim() || url.trim() });
    }

    confirm2('배포 확인', codes.length + '개 치과에 ' + items.length + '개 링크를 배포합니다.', function() {
      var ok = 0, fail = 0;
      var chain = Promise.resolve();
      codes.forEach(function(code) {
        chain = chain.then(function() {
          return callAPI('/api/' + code + '/playlists').then(function(d) {
            var pl = (d.playlists || [])[0];
            if (!pl) { fail++; return; }
            var inner = Promise.resolve();
            items.forEach(function(item) {
              inner = inner.then(function() {
                return callAPI('/api/' + code + '/playlists/' + pl.id + '/items', { method: 'POST', body: item }).then(function() { ok++; }).catch(function() { fail++; });
              });
            });
            return inner;
          }).catch(function() { fail++; });
        });
      });
      chain.then(function() {
        toast(fail > 0 ? '성공 ' + ok + '건 / 실패 ' + fail + '건' : ok + '건 배포 완료', fail > 0 ? 'error' : undefined);
      });
    });
  }

  /* ===== 모달: 플레이리스트 생성 ===== */
  function showCreatePlaylistModal() {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:"Noto Sans KR",sans-serif';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:380px">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 16px">대기실/체어 추가</h3>'
      + '<input id="dtv-new-pl-name" type="text" placeholder="이름 (예: 대기실1, 진료실A)" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;font-family:inherit;margin-bottom:12px">'
      + '<div style="display:flex;gap:8px"><button id="dtv-new-pl-cc" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button><button id="dtv-new-pl-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">추가</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    m.querySelector('#dtv-new-pl-cc').addEventListener('click', function() { m.remove(); });
    m.querySelector('#dtv-new-pl-ok').addEventListener('click', function() {
      var name = document.getElementById('dtv-new-pl-name').value.trim();
      if (!name) { toast('이름을 입력하세요', 'error'); return; }
      callAPI('/playlists', { method: 'POST', body: { name: name } }).then(function(d) {
        m.remove(); toast('추가 완료'); loadPlaylists().then(function() { renderPage(); });
      }).catch(function(e) { toast(e.message, 'error'); });
    });
  }

  /* ===== 모달: 공지 추가 ===== */
  function showNoticeModal() {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:"Noto Sans KR",sans-serif';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:380px">'
      + '<h3 style="font-size:16px;font-weight:700;color:#1f2937;margin:0 0 16px">새 공지사항</h3>'
      + '<textarea id="dtv-new-notice" rows="3" placeholder="공지 내용을 입력하세요" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;font-family:inherit;resize:vertical;margin-bottom:12px"></textarea>'
      + '<div style="display:flex;gap:8px"><button id="dtv-nn-cc" style="flex:1;padding:10px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit">취소</button><button id="dtv-nn-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">추가</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
    m.querySelector('#dtv-nn-cc').addEventListener('click', function() { m.remove(); });
    m.querySelector('#dtv-nn-ok').addEventListener('click', function() {
      var content = document.getElementById('dtv-new-notice').value.trim();
      if (!content) { toast('내용을 입력하세요', 'error'); return; }
      callAPI('/notices', { method: 'POST', body: { content: content } }).then(function() {
        m.remove(); toast('추가 완료'); loadNotices().then(function() { renderPage(); });
      }).catch(function(e) { toast(e.message, 'error'); });
    });
  }

  /* ===== 데이터 로드 ===== */
  function loadPlaylists() {
    return callAPI('/playlists').then(function(d) {
      playlists = d.playlists || [];
      clinicName = d.clinic_name || clinicName;
    }).catch(function() {});
  }

  function loadNotices() {
    return callAPI('/notices').then(function(d) { notices = d.notices || []; }).catch(function() {});
  }

  /* ===== 유틸 ===== */
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function bind(id, fn) { var e = document.getElementById(id); if (e) e.addEventListener('click', fn); }
  function bindAll(sel, fn) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) els[i].addEventListener('click', fn);
  }

  window._dtvCopy = function(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() { toast('복사됨'); });
    } else {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('복사됨');
    }
  };

  /* ===== 이벤트 위임: 공지 토글/삭제 ===== */
  document.addEventListener('click', function(e) {
    var t = e.target.closest('.dtv-n-toggle');
    if (t) {
      var id = t.getAttribute('data-id');
      var isActive = t.getAttribute('data-active') === '1';
      // Toggle는 is_active를 반전
      var notice = notices.find(function(n) { return String(n.id) === String(id); });
      if (notice) {
        notice.is_active = isActive ? 0 : 1;
        // API call 생략 (간이 토글) - 실제로는 notice 편집 API 호출 필요
        renderPage();
      }
    }
    var d = e.target.closest('.dtv-n-del');
    if (d) {
      var nid = d.getAttribute('data-id');
      confirm2('삭제', '이 공지를 삭제하시겠습니까?', function() {
        callAPI('/notices/' + nid, { method: 'DELETE' }).then(function() {
          notices = notices.filter(function(n) { return String(n.id) !== String(nid); });
          toast('삭제 완료'); renderPage();
        }).catch(function(er) { toast(er.message, 'error'); });
      });
    }
    var pe = e.target.closest('.dtv-pl-edit');
    if (pe) {
      var pid = pe.getAttribute('data-id');
      // 기존 admin 페이지로 이동 (편집은 기존 UI 활용)
      window.open('/admin/' + ADMIN_CODE + '?email=', '_blank');
    }
    var pc = e.target.closest('.dtv-pl-copy');
    if (pc) {
      window._dtvCopy(pc.getAttribute('data-url'));
    }
  });

  /* ===== 시작 ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
