(function(){
  var API = 'https://dental-tv-app.pages.dev';
  var VERSION = '2.0.0';

  /* ===== root ===== */
  var root = document.getElementById('dtv-widget-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dtv-widget-root';
    root.style.cssText = 'display:block;width:100%;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
    var cs = document.currentScript;
    if (cs && cs.parentNode) cs.parentNode.insertBefore(root, cs);
    else document.body.appendChild(root);
  }
  if (root.querySelector('.dtv-ok')) return;

  /* ===== member_code detection ===== */
  function getMC() {
    var mc = '', em = '';
    try { var m = window.__IMWEB__ && window.__IMWEB__.member; if (m && (m.code || m.id)) { mc = String(m.code || m.id); em = m.email || ''; } } catch(e) {}
    if (!mc) {
      try {
        var ck = document.cookie.split('; ');
        for (var i = 0; i < ck.length; i++) {
          if (ck[i].indexOf('__bs_imweb=') === 0) {
            var d = JSON.parse(decodeURIComponent(ck[i].substring(11)));
            if (d.sdk_jwt) { var pp = d.sdk_jwt.split('.'); if (pp.length === 3) { var j = JSON.parse(atob(pp[1])); var c = j.sub || j.member_code || j.mc || ''; if (c && c.charAt(0) === 'm') { mc = c; em = j.email || ''; } } }
            if (!mc) { var mt = JSON.stringify(d).match(/m\d{8,}[a-f0-9]+/); if (mt) mc = mt[0]; }
          }
        }
      } catch(e) {}
    }
    if (!mc) { try { var info = window._imweb_page_info; if (info && info.member_code) { mc = info.member_code; em = info.member_email || info.email || ''; } } catch(e) {} }
    return mc ? { mc: mc, em: em } : null;
  }

  /* ===== state ===== */
  var MC = '', EM = '', currentTab = 'waitingrooms';
  var frames = {};

  /* ===== build iframe URL ===== */
  function iframeUrl(tab) {
    return API + '/embed/' + encodeURIComponent(MC) + '?email=' + encodeURIComponent(EM) + '&widget=1&tab=' + tab;
  }

  /* ===== render shell (header + tabs only, content = iframe) ===== */
  function renderShell(data) {
    var cn = data.clinicName || '';
    var mn = data.memberName || '';
    var ue = data.userEmail || '';
    var sa = data.isSuperAdmin;
    var oa = data.isOwnerAdmin;
    var dn = (cn && cn !== '\ub0b4 \uce58\uacfc') ? cn : (mn || (sa ? '\uad00\ub9ac\uc790' : '\ub0b4 \uce58\uacfc'));
    var role = sa ? '\ucd5c\uace0\uad00\ub9ac\uc790' : (oa ? '\uad00\ub9ac\uc790' : '\ub300\uae30\uc2e4 TV \uad00\ub9ac\uc790');
    var sub = role + (ue ? ' \u00b7 ' + ue : '');
    var adm = sa ? 'inline-block' : 'none';

    var tabs = [
      { id: 'waitingrooms', label: '\ub300\uae30\uc2e4' },
      { id: 'chairs', label: '\uccb4\uc5b4' },
      { id: 'notices', label: '\uacf5\uc9c0\uc0ac\ud56d' },
      { id: 'settings', label: '\uc124\uc815' },
      { id: 'admin', label: '\uad00\ub9ac', display: adm }
    ];

    var tabHtml = '';
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var isActive = t.id === 'waitingrooms';
      var disp = t.display || 'inline-block';
      tabHtml += '<button data-t="' + t.id + '" class="dtv-tb" style="display:' + disp + ';padding:11px 14px;border:none;background:none;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;'
        + (isActive ? 'font-weight:700;color:#2563eb;border-bottom:2px solid #2563eb' : 'font-weight:500;color:#6b7280;border-bottom:2px solid transparent')
        + '">' + t.label + '</button>';
    }

    root.innerHTML = '<div class="dtv-ok" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">'
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;border-radius:12px 12px 0 0"><div style="font-size:18px;font-weight:700;color:#fff">' + dn + '</div><div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:4px">' + sub + '</div></div>'
      + '<div style="display:flex;border-bottom:1px solid #e5e7eb;padding:0 8px;background:#fff;overflow-x:auto">' + tabHtml + '</div>'
      + '<div id="dtv-frame-container" style="background:#f9fafb;min-height:500px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;overflow:hidden"></div>'
      + '</div>';

    // Load default tab iframe
    switchTab('waitingrooms');

    // Tab click events
    var tbs = root.querySelectorAll('.dtv-tb');
    for (var j = 0; j < tbs.length; j++) {
      tbs[j].addEventListener('click', function() {
        var tid = this.getAttribute('data-t');
        // Update tab styles
        for (var k = 0; k < tbs.length; k++) {
          tbs[k].style.color = '#6b7280';
          tbs[k].style.fontWeight = '500';
          tbs[k].style.borderBottom = '2px solid transparent';
        }
        this.style.color = '#2563eb';
        this.style.fontWeight = '700';
        this.style.borderBottom = '2px solid #2563eb';
        switchTab(tid);
      });
    }
  }

  /* ===== switch tab: show/hide cached iframes ===== */
  function switchTab(tab) {
    currentTab = tab;
    var container = document.getElementById('dtv-frame-container');
    if (!container) return;

    // Hide all existing iframes
    for (var k in frames) {
      if (frames[k]) frames[k].style.display = 'none';
    }

    // Create or show iframe for this tab
    if (frames[tab]) {
      frames[tab].style.display = 'block';
    } else {
      var f = document.createElement('iframe');
      f.src = iframeUrl(tab);
      f.style.cssText = 'width:100%;border:none;min-height:500px;display:block';
      f.setAttribute('frameborder', '0');
      container.appendChild(f);
      frames[tab] = f;
    }
  }

  /* ===== message handler for iframe height ===== */
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'setHeight') {
      // Find the visible iframe and set height
      var f = frames[currentTab];
      if (f) f.style.height = (e.data.height + 30) + 'px';
    }
    if (e.data.type === 'contentReady') {
      var f = frames[currentTab];
      if (f) f.style.minHeight = '0';
    }
    if (e.data.type === 'scrollToTop') {
      root.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });

  /* ===== start ===== */
  var info = getMC();
  if (info && info.mc) {
    go(info.mc, info.em);
  } else {
    var n = 0, iv = setInterval(function() {
      info = getMC();
      if (info && info.mc) { clearInterval(iv); go(info.mc, info.em); }
      else if (++n >= 50) { clearInterval(iv); root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">\ub85c\uadf8\uc778 \ud6c4 \uc774\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</p></div>'; }
    }, 100);
  }

  function go(mc, em) {
    MC = mc; EM = em;
    var url = API + '/api/widget/init/' + encodeURIComponent(mc);
    if (em) url += '?email=' + encodeURIComponent(em);
    fetch(url).then(function(r) { return r.json(); }).then(function(res) {
      if (!res.ok) { root.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">' + (res.error || '\ub370\uc774\ud130 \uc624\ub958') + '</div>'; return; }
      renderShell(res.data);
    }).catch(function(e) {
      root.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">\uc11c\ubc84 \uc5f0\uacb0 \uc2e4\ud328</div>';
    });
  }
})();
