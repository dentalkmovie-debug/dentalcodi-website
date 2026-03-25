(function(){
  var API = 'https://dental-tv-app.pages.dev';
  var VERSION = '3.2.0';

  /* ===== root ===== */
  var root = document.getElementById('dtv-widget-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dtv-widget-root';
    root.style.cssText = 'display:block;width:100%;';
    var cs = document.currentScript;
    if (cs && cs.parentNode) cs.parentNode.insertBefore(root, cs);
    else document.body.appendChild(root);
  }
  if (root.querySelector('.dtv-iframe-ok')) return;

  /* ===== preconnect (DNS+TLS 사전 연결) ===== */
  try {
    var pc = document.createElement('link');
    pc.rel = 'preconnect';
    pc.href = API;
    pc.crossOrigin = '';
    document.head.appendChild(pc);
  } catch(e) {}

  /* ===== skeleton HTML ===== */
  var SK = '<div id="dtv-skeleton" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif">'
    + '<style>@keyframes dtvPulse{0%,100%{opacity:1}50%{opacity:.4}}.dtv-sk{animation:dtvPulse 1.5s ease-in-out infinite;background:#e5e7eb;border-radius:8px}</style>'
    + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;border-radius:12px 12px 0 0">'
    + '<div class="dtv-sk" style="height:20px;width:120px;background:rgba(255,255,255,.3);border-radius:4px;margin-bottom:6px"></div>'
    + '<div class="dtv-sk" style="height:12px;width:200px;background:rgba(255,255,255,.15);border-radius:4px"></div></div>'
    + '<div style="display:flex;gap:0;border-bottom:1px solid #e5e7eb;padding:0 8px">'
    + '<span style="padding:11px 14px;font-size:13px;color:#2563eb;font-weight:700;border-bottom:2px solid #2563eb">\ub300\uae30\uc2e4</span>'
    + '<span style="padding:11px 14px;font-size:13px;color:#6b7280">\uccb4\uc5b4</span>'
    + '<span style="padding:11px 14px;font-size:13px;color:#6b7280">\uacf5\uc9c0\uc0ac\ud56d</span>'
    + '<span style="padding:11px 14px;font-size:13px;color:#6b7280">\uc124\uc815</span></div>'
    + '<div style="padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<div style="display:flex;align-items:center;gap:8px"><div class="dtv-sk" style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#2563eb,#3b82f6)"></div><div class="dtv-sk" style="height:18px;width:90px"></div></div>'
    + '<div class="dtv-sk" style="height:32px;width:100px;border-radius:10px"></div></div>'
    + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:14px 16px;margin-bottom:10px">'
    + '<div style="display:flex;align-items:center;gap:10px"><div class="dtv-sk" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb)"></div>'
    + '<div style="flex:1"><div class="dtv-sk" style="height:14px;width:100px;margin-bottom:6px"></div><div class="dtv-sk" style="height:10px;width:160px"></div></div></div>'
    + '<div style="display:flex;gap:6px;margin-top:10px;padding-left:46px"><div class="dtv-sk" style="height:28px;width:80px;border-radius:8px"></div><div class="dtv-sk" style="height:28px;width:80px;border-radius:8px"></div></div></div>'
    + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:14px 16px">'
    + '<div style="display:flex;align-items:center;gap:10px"><div class="dtv-sk" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb)"></div>'
    + '<div style="flex:1"><div class="dtv-sk" style="height:14px;width:100px;margin-bottom:6px"></div><div class="dtv-sk" style="height:10px;width:160px"></div></div></div>'
    + '<div style="display:flex;gap:6px;margin-top:10px;padding-left:46px"><div class="dtv-sk" style="height:28px;width:80px;border-radius:8px"></div><div class="dtv-sk" style="height:28px;width:80px;border-radius:8px"></div></div></div>'
    + '</div></div>';

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

  /* ===== load: skeleton 위에 iframe 겹치기 ===== */
  function loadEmbed(mc, em) {
    var url = API + '/embed/' + encodeURIComponent(mc);
    if (em) url += '?email=' + encodeURIComponent(em);

    root.innerHTML = '<div class="dtv-iframe-ok" style="width:100%;position:relative">'
      + SK
      + '<iframe id="dtv-main-iframe" src="' + url + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;opacity:0;transition:opacity .15s ease" frameborder="0" allowfullscreen></iframe>'
      + '</div>';
  }

  /* ===== message handler ===== */
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    var iframe = document.getElementById('dtv-main-iframe');
    if (!iframe) return;

    if (e.data.type === 'setHeight' && e.data.height) {
      var h = e.data.height + 30;
      iframe.style.height = h + 'px';
      iframe.parentNode.style.height = h + 'px';
    }
    if (e.data.type === 'contentReady') {
      // iframe 콘텐츠 로드 완료 → skeleton 숨기고 iframe 표시
      iframe.style.opacity = '1';
      iframe.style.position = 'relative';
      var sk = document.getElementById('dtv-skeleton');
      if (sk) sk.style.display = 'none';
      iframe.style.minHeight = '0';
    }
    if (e.data.type === 'scrollToTop') {
      root.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });

  /* ===== start ===== */
  var info = getMC();
  if (info && info.mc) {
    loadEmbed(info.mc, info.em);
  } else {
    // skeleton 즉시 표시 (멤버코드 폴링 중에도 UI 보임)
    root.innerHTML = SK;
    var n = 0, iv = setInterval(function() {
      info = getMC();
      if (info && info.mc) { clearInterval(iv); loadEmbed(info.mc, info.em); }
      else if (++n >= 50) { clearInterval(iv); root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">\ub85c\uadf8\uc778 \ud6c4 \uc774\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</p></div>'; }
    }, 100);
  }
})();
