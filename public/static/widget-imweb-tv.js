(function(){
  var API = 'https://dental-tv-app.pages.dev';
  var VERSION = '3.0.0';

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

  /* ===== show loading skeleton immediately ===== */
  function showSkeleton() {
    root.innerHTML = '<div class="dtv-iframe-ok" style="position:relative;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#fff">'
      + '<div id="dtv-skeleton" style="padding:0">'
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;border-radius:12px 12px 0 0">'
      + '<div style="width:120px;height:20px;background:rgba(255,255,255,.3);border-radius:4px;margin-bottom:6px"></div>'
      + '<div style="width:180px;height:14px;background:rgba(255,255,255,.15);border-radius:4px"></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid #e5e7eb;background:#fff">'
      + '<div style="width:48px;height:16px;background:#e5e7eb;border-radius:4px"></div>'
      + '<div style="width:40px;height:16px;background:#e5e7eb;border-radius:4px"></div>'
      + '<div style="width:56px;height:16px;background:#e5e7eb;border-radius:4px"></div>'
      + '<div style="width:40px;height:16px;background:#e5e7eb;border-radius:4px"></div>'
      + '</div>'
      + '<div style="padding:16px;background:#f9fafb;min-height:200px">'
      + '<div style="width:160px;height:20px;background:#e5e7eb;border-radius:4px;margin-bottom:16px"></div>'
      + '<div style="background:#fff;border-radius:8px;padding:16px;border:1px solid #e5e7eb">'
      + '<div style="width:100%;height:16px;background:#e5e7eb;border-radius:4px;margin-bottom:10px"></div>'
      + '<div style="width:70%;height:16px;background:#e5e7eb;border-radius:4px;margin-bottom:10px"></div>'
      + '<div style="width:50%;height:16px;background:#e5e7eb;border-radius:4px"></div>'
      + '</div></div></div>'
      + '<iframe id="dtv-main-iframe" style="width:100%;border:none;display:none;min-height:600px" frameborder="0" allowfullscreen></iframe>'
      + '</div>';
  }

  /* ===== load iframe ===== */
  function loadEmbed(mc, em) {
    showSkeleton();

    var url = API + '/embed/' + encodeURIComponent(mc);
    var params = [];
    if (em) params.push('email=' + encodeURIComponent(em));
    if (params.length) url += '?' + params.join('&');

    var iframe = document.getElementById('dtv-main-iframe');
    if (!iframe) return;

    iframe.onload = function() {
      // Hide skeleton, show iframe
      var sk = document.getElementById('dtv-skeleton');
      if (sk) sk.style.display = 'none';
      iframe.style.display = 'block';
    };

    iframe.src = url;
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
      // Content ready - hide skeleton, show iframe
      var sk = document.getElementById('dtv-skeleton');
      if (sk) sk.style.display = 'none';
      iframe.style.display = 'block';
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
    // Show skeleton immediately while waiting for member code
    showSkeleton();
    var n = 0, iv = setInterval(function() {
      info = getMC();
      if (info && info.mc) {
        clearInterval(iv);
        loadEmbed(info.mc, info.em);
      } else if (++n >= 50) {
        clearInterval(iv);
        root.innerHTML = '<div style="padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;text-align:center"><p style="font-size:13px;color:#9ca3af;margin:0">\ub85c\uadf8\uc778 \ud6c4 \uc774\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</p></div>';
      }
    }, 100);
  }
})();
