(function(){
  var API = 'https://dental-tv-app.pages.dev';
  var VERSION = '3.1.0';

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

  /* ===== load iframe directly (no skeleton) ===== */
  function loadEmbed(mc, em) {
    var url = API + '/embed/' + encodeURIComponent(mc);
    if (em) url += '?email=' + encodeURIComponent(em);

    root.innerHTML = '<div class="dtv-iframe-ok" style="width:100%">'
      + '<iframe id="dtv-main-iframe" src="' + url + '" style="width:100%;border:none;min-height:800px;display:block" frameborder="0" allowfullscreen></iframe>'
      + '</div>';
  }

  /* ===== message handler for iframe height ===== */
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    var iframe = document.getElementById('dtv-main-iframe');
    if (!iframe) return;

    if (e.data.type === 'setHeight' && e.data.height) {
      iframe.style.height = (e.data.height + 30) + 'px';
    }
    if (e.data.type === 'contentReady') {
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
    var n = 0, iv = setInterval(function() {
      info = getMC();
      if (info && info.mc) { clearInterval(iv); loadEmbed(info.mc, info.em); }
      else if (++n >= 50) { clearInterval(iv); root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">\ub85c\uadf8\uc778 \ud6c4 \uc774\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</p></div>'; }
    }, 100);
  }
})();
