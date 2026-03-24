(function(){
  var API = 'https://dental-tv-app.pages.dev';
  var VERSION = '1.0.0';

  /* ===== root 찾기 또는 생성 ===== */
  var root = document.getElementById('dtv-widget-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dtv-widget-root';
    root.style.cssText = 'display:block;width:100%;font-family:Noto Sans KR,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
    var cs = document.currentScript;
    if (cs && cs.parentNode) cs.parentNode.insertBefore(root, cs);
    else document.body.appendChild(root);
  }
  if (root.querySelector('.dtv-app-loaded')) return;

  /* ===== CSS ===== */
  if (!document.getElementById('dtv-style')) {
    var st = document.createElement('style');
    st.id = 'dtv-style';
    st.textContent = '@keyframes dtvSpin{to{transform:rotate(360deg)}}@keyframes dtvFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(st);
  }

  /* ===== 상태 ===== */
  var ADMIN_CODE = '';
  var BASE_URL = API;
  var INITIAL_DATA = null;

  /* ===== 유틸 ===== */
  function spin(msg) {
    root.innerHTML = '<div style="padding:40px;text-align:center"><div style="display:inline-block;width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:dtvSpin .7s linear infinite"></div><p style="font-size:13px;color:#9ca3af;margin:8px 0 0">' + (msg||'로딩 중...') + '</p></div>';
  }

  function errUI(msg) {
    root.innerHTML = '<div style="padding:20px;background:#fff;border-radius:12px;border:1px solid #fee2e2">'
      + '<p style="font-size:13px;color:#ef4444;margin:0 0 8px">' + msg + '</p>'
      + '<button onclick="location.reload()" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;font-family:inherit">새로고침</button></div>';
  }

  /* ===== 1단계: member_code 감지 ===== */
  function getMemberCode() {
    var mc = '', em = '';
    try { var m = window.__IMWEB__ && window.__IMWEB__.member; if (m && (m.code || m.id)) { mc = String(m.code || m.id); em = m.email || ''; } } catch(e) {}
    if (!mc) {
      try {
        var cookies = document.cookie.split('; ');
        for (var i = 0; i < cookies.length; i++) {
          if (cookies[i].startsWith('__bs_imweb=')) {
            var data = JSON.parse(decodeURIComponent(cookies[i].substring('__bs_imweb='.length)));
            if (data.sdk_jwt) {
              var parts = data.sdk_jwt.split('.');
              if (parts.length === 3) {
                var p = JSON.parse(atob(parts[1]));
                var c = p.sub || p.member_code || p.mc || '';
                if (c && c.startsWith('m')) { mc = c; em = p.email || ''; }
              }
            }
            if (!mc) { var match = JSON.stringify(data).match(/m\d{8,}[a-f0-9]+/); if (match) mc = match[0]; }
          }
        }
      } catch(e) {}
    }
    if (!mc) { try { var info = window._imweb_page_info; if (info && info.member_code) { mc = info.member_code; em = info.member_email || info.email || ''; } } catch(e) {} }
    return mc ? { mc: mc, em: em } : null;
  }

  /* ===== 2단계: API로 데이터 가져오기 ===== */
  function fetchInit(mc, em) {
    var url = API + '/api/widget/init/' + encodeURIComponent(mc);
    if (em) url += '?email=' + encodeURIComponent(em);
    return fetch(url).then(function(r) { return r.json(); });
  }

  /* ===== 3단계: UI 렌더링 ===== */
  function renderApp(data, adminCode, baseUrl) {
    ADMIN_CODE = adminCode;
    BASE_URL = baseUrl;
    INITIAL_DATA = data;

    var playlists = data.playlists || [];
    var notices = data.notices || [];
    var clinicName = data.clinicName || '';
    var memberName = data.memberName || '';
    var userEmail = data.userEmail || '';
    var isSuperAdmin = data.isSuperAdmin;
    var isOwnerAdmin = data.isOwnerAdmin;

    var effectiveName = (clinicName && clinicName !== '내 치과') ? clinicName : '';
    var defaultName = isSuperAdmin ? '관리자' : '내 치과';
    var displayName = effectiveName || memberName || defaultName;
    var role = isSuperAdmin ? '최고관리자' : (isOwnerAdmin ? '관리자' : '대기실 TV 관리자');
    var subtitle = role;
    if (userEmail) subtitle += ' · ' + userEmail;

    var waitingRooms = playlists.filter(function(p) { return p.name.indexOf('체어') === -1; }).sort(function(a, b) { return (a.sort_order || 999) - (b.sort_order || 999); });
    var chairs = playlists.filter(function(p) { return p.name.indexOf('체어') !== -1; }).sort(function(a, b) { return (a.sort_order || 999) - (b.sort_order || 999); });
    var adminTabDisplay = isSuperAdmin ? 'inline-block' : 'none';

    function playlistCard(p, type) {
      var isActive = !!(p.is_tv_active);
      var neverConnected = !p.last_active_at && !p.external_short_url;
      var isOffline = !isActive && !neverConnected && (p.last_active_at || p.external_short_url);
      var isChair = type === 'chair';
      var gradActive = isChair ? 'linear-gradient(135deg,#22c55e,#16a34a)' : (isActive ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#3b82f6,#2563eb)');
      var iconClass = isChair ? 'fa-tv' : 'fa-couch';
      var borderColor = isActive ? '#bbf7d0' : '#e5e7eb';
      var urlDisplay = p.external_short_url ? p.external_short_url.replace('https://', '') : baseUrl.replace('https://', '').replace('http://', '') + '/' + p.short_code;

      var statusBadge = '';
      if (isActive) statusBadge = '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#15803d;font-size:10px;font-weight:700">● 사용중</span>';
      else if (isOffline) statusBadge = '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb);color:#6b7280;font-size:10px;font-weight:700">● 오프라인</span>';
      else if (neverConnected) statusBadge = '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;font-size:10px;font-weight:700">' + (isChair ? '체어 설정 필요' : 'TV 연결 필요') + '</span>';

      return '<div class="playlist-sortable-item" data-playlist-id="' + p.id + '" style="background:#fff;border-radius:12px;border:1px solid ' + borderColor + ';overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">'
        + '<div style="padding:14px 16px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<div style="width:36px;height:36px;border-radius:10px;background:' + gradActive + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative"><i class="fas ' + iconClass + '" style="color:#fff;font-size:14px"></i>' + (isActive ? '<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #fff"></span>' : '') + '</div>'
        + '<div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700;color:#1f2937">' + p.name + '</span>' + statusBadge + '</div>'
        + '<p style="font-size:11px;color:#9ca3af;margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="color:#2563eb;font-family:monospace;font-size:10px">' + urlDisplay + '</span><span style="margin:0 6px;color:#d1d5db">·</span>' + (p.item_count || 0) + '개 미디어</p></div></div>'
        + '</div></div>';
    }

    var wrHtml = waitingRooms.length === 0
      ? '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;text-align:center"><p style="font-size:14px;color:#6b7280;margin:0">등록된 대기실이 없습니다.</p></div>'
      : '<div style="display:grid;gap:10px">' + waitingRooms.map(function(p) { return playlistCard(p, 'waitingroom'); }).join('') + '</div>';

    var chHtml = chairs.length === 0
      ? '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;text-align:center"><p style="font-size:14px;color:#6b7280;margin:0">등록된 체어가 없습니다.</p></div>'
      : '<div style="display:grid;gap:10px">' + chairs.map(function(p) { return playlistCard(p, 'chair'); }).join('') + '</div>';

    // 전체 앱 HTML
    root.innerHTML = '<div class="dtv-app-loaded" style="font-family:Noto Sans KR,-apple-system,sans-serif;animation:dtvFadeIn .3s ease">'
      // 헤더
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;border-radius:12px 12px 0 0">'
      + '<div style="font-size:18px;font-weight:700;color:#fff">' + displayName + '</div>'
      + '<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:4px">' + subtitle + '</div>'
      + '</div>'
      // 탭
      + '<div style="display:flex;border-bottom:1px solid #e5e7eb;padding:0 8px;background:#fff;overflow-x:auto">'
      + '<button data-dtv-tab="waitingroom" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:700;cursor:pointer;color:#2563eb;border-bottom:2px solid #2563eb;font-family:inherit;white-space:nowrap">대기실</button>'
      + '<button data-dtv-tab="chair" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">체어</button>'
      + '<button data-dtv-tab="notice" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">공지사항</button>'
      + '<button data-dtv-tab="settings" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">설정</button>'
      + '<button data-dtv-tab="admin" style="display:' + adminTabDisplay + ';padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">관리</button>'
      + '</div>'
      // 콘텐츠
      + '<div style="padding:16px;background:#f9fafb;min-height:400px">'
      + '<div id="dtv-tab-waitingroom">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:15px;font-weight:700;color:#1f2937">대기실 관리</span><span style="font-size:11px;background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:10px;font-weight:600">' + waitingRooms.length + '개</span></div></div>'
      + wrHtml
      + '</div>'
      + '<div id="dtv-tab-chair" style="display:none">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:15px;font-weight:700;color:#1f2937">체어 관리</span><span style="font-size:11px;background:#e0e7ff;color:#6366f1;padding:2px 8px;border-radius:10px;font-weight:600">' + chairs.length + '개</span></div></div>'
      + chHtml
      + '</div>'
      + '<div id="dtv-tab-notice" style="display:none"><div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">전체 기능은 로딩 중...</div></div>'
      + '<div id="dtv-tab-settings" style="display:none"><div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">전체 기능은 로딩 중...</div></div>'
      + '<div id="dtv-tab-admin" style="display:none"><div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">전체 기능은 로딩 중...</div></div>'
      + '</div>'
      + '</div>';

    // 탭 클릭 이벤트
    var tabs = root.querySelectorAll('[data-dtv-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function() {
        var target = this.getAttribute('data-dtv-tab');
        // 탭 스타일 변경
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].style.color = '#6b7280';
          tabs[j].style.fontWeight = '500';
          tabs[j].style.borderBottom = '2px solid transparent';
        }
        this.style.color = '#2563eb';
        this.style.fontWeight = '700';
        this.style.borderBottom = '2px solid #2563eb';
        // 콘텐츠 전환
        var panels = ['waitingroom', 'chair', 'notice', 'settings', 'admin'];
        for (var k = 0; k < panels.length; k++) {
          var panel = root.querySelector('#dtv-tab-' + panels[k]);
          if (panel) panel.style.display = panels[k] === target ? 'block' : 'none';
        }
        // 전체 기능 탭은 iframe으로 전환
        if (target === 'notice' || target === 'settings' || target === 'admin') {
          loadFullAdmin(target);
        }
      });
    }

    // FontAwesome 로드 (아이콘용)
    if (!document.getElementById('dtv-fa')) {
      var fa = document.createElement('link');
      fa.id = 'dtv-fa';
      fa.rel = 'stylesheet';
      fa.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';
      document.head.appendChild(fa);
    }
  }

  /* ===== 4단계: 전체 기능 로드 (공지, 설정 등은 iframe으로) ===== */
  function loadFullAdmin(tab) {
    var panel = root.querySelector('#dtv-tab-' + tab);
    if (!panel || panel.querySelector('iframe')) return;
    var url = API + '/embed/' + encodeURIComponent(ADMIN_CODE) + '?email=' + encodeURIComponent(INITIAL_DATA.userEmail || '') + '&tab=' + tab;
    panel.innerHTML = '<iframe src="' + url + '" width="100%" height="700" frameborder="0" style="border:none;border-radius:8px"></iframe>';
  }

  /* ===== 실행 ===== */
  function tryStart() {
    var info = getMemberCode();
    if (!info || !info.mc) {
      // 폴링 (최대 5초)
      var n = 0;
      var t = setInterval(function() {
        info = getMemberCode();
        if (info && info.mc) {
          clearInterval(t);
          doStart(info.mc, info.em);
        } else if (++n >= 50) {
          clearInterval(t);
          root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">로그인 후 이용할 수 있습니다.</p></div>';
        }
      }, 100);
      return;
    }
    doStart(info.mc, info.em);
  }

  function doStart(mc, em) {
    spin('로딩 중...');
    fetchInit(mc, em).then(function(res) {
      if (res.error) { errUI(res.error); return; }
      if (!res.ok) { errUI('데이터를 불러올 수 없습니다.'); return; }
      renderApp(res.data, res.adminCode, res.baseUrl);
    }).catch(function(e) {
      errUI('서버 연결 실패: ' + (e.message || e));
    });
  }

  // 즉시 실행
  tryStart();
})();
