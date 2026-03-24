(function(){
  var API = 'https://dental-tv-app.pages.dev';
  var VERSION = '1.1.0';

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

  /* ===== inline SVG icons (no FontAwesome needed) ===== */
  var IC = {
    couch: '<svg width="14" height="14" viewBox="0 0 640 512" fill="#fff"><path d="M64 160C64 89.3 121.3 32 192 32H448c70.7 0 128 57.3 128 128v33.6c-36.5 7.4-64 39.7-64 78.4v48H128V272c0-38.7-27.5-71-64-78.4V160zM544 272c0-20.9 13.4-38.7 32-45.3V272c0 26.5-21.5 48-48 48H112c-26.5 0-48-21.5-48-48V226.7c18.6 6.6 32 24.4 32 45.3v80h448V272zm32 128H64v32c0 17.7 14.3 32 32 32H544c17.7 0 32-14.3 32-32V400z"/></svg>',
    tv: '<svg width="14" height="14" viewBox="0 0 640 512" fill="#fff"><path d="M64 64V352H576V64H64zM0 64C0 28.7 28.7 0 64 0H576c35.3 0 64 28.7 64 64V352c0 35.3-28.7 64-64 64H400v32h80c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h80V416H64c-35.3 0-64-28.7-64-64V64z"/></svg>'
  };

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
  var ADMIN_CODE = '', BASE_URL = API, DATA = null;

  /* ===== render functions ===== */
  function card(p, type) {
    var on = !!(p.is_tv_active);
    var never = !p.last_active_at && !p.external_short_url;
    var off = !on && !never && (p.last_active_at || p.external_short_url);
    var ch = type === 'chair';
    var grad = on ? 'linear-gradient(135deg,#22c55e,#16a34a)' : (ch ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'linear-gradient(135deg,#3b82f6,#2563eb)');
    var icon = ch ? IC.tv : IC.couch;
    var bc = on ? '#bbf7d0' : '#e5e7eb';
    var url = p.external_short_url ? p.external_short_url.replace('https://', '') : BASE_URL.replace('https://', '').replace('http://', '') + '/' + p.short_code;
    var badge = '';
    if (on) badge = '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#15803d;font-size:10px;font-weight:700">&#9679; \uc0ac\uc6a9\uc911</span>';
    else if (off) badge = '<span style="padding:2px 8px;border-radius:20px;background:#f3f4f6;color:#6b7280;font-size:10px;font-weight:700">&#9679; \uc624\ud504\ub77c\uc778</span>';
    else if (never) badge = '<span style="padding:2px 8px;border-radius:20px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700">' + (ch ? '\uccb4\uc5b4 \uc124\uc815 \ud544\uc694' : 'TV \uc5f0\uacb0 \ud544\uc694') + '</span>';
    return '<div data-pid="' + p.id + '" style="background:#fff;border-radius:12px;border:1px solid ' + bc + ';overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)"><div style="padding:14px 16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:4px"><div style="width:36px;height:36px;border-radius:10px;background:' + grad + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative">' + icon + (on ? '<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #fff"></span>' : '') + '</div><div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700;color:#1f2937">' + p.name + '</span>' + badge + '</div><p style="font-size:11px;color:#9ca3af;margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="color:#2563eb;font-family:monospace;font-size:10px">' + url + '</span><span style="margin:0 6px;color:#d1d5db">\u00b7</span>' + (p.item_count || 0) + '\uac1c \ubbf8\ub514\uc5b4</p></div></div></div></div>';
  }

  function render(d, ac, bu) {
    ADMIN_CODE = ac; BASE_URL = bu; DATA = d;
    var pl = d.playlists || [];
    var cn = d.clinicName || '';
    var mn = d.memberName || '';
    var ue = d.userEmail || '';
    var sa = d.isSuperAdmin;
    var oa = d.isOwnerAdmin;
    var dn = (cn && cn !== '\ub0b4 \uce58\uacfc') ? cn : (mn || (sa ? '\uad00\ub9ac\uc790' : '\ub0b4 \uce58\uacfc'));
    var role = sa ? '\ucd5c\uace0\uad00\ub9ac\uc790' : (oa ? '\uad00\ub9ac\uc790' : '\ub300\uae30\uc2e4 TV \uad00\ub9ac\uc790');
    var sub = role + (ue ? ' \u00b7 ' + ue : '');
    var wr = pl.filter(function(p) { return p.name.indexOf('\uccb4\uc5b4') === -1; }).sort(function(a, b) { return (a.sort_order || 999) - (b.sort_order || 999); });
    var cr = pl.filter(function(p) { return p.name.indexOf('\uccb4\uc5b4') !== -1; }).sort(function(a, b) { return (a.sort_order || 999) - (b.sort_order || 999); });
    var wrH = wr.length ? '<div style="display:grid;gap:10px">' + wr.map(function(p) { return card(p, 'wr'); }).join('') + '</div>' : '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;text-align:center"><p style="font-size:14px;color:#6b7280;margin:0">\ub4f1\ub85d\ub41c \ub300\uae30\uc2e4\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p></div>';
    var crH = cr.length ? '<div style="display:grid;gap:10px">' + cr.map(function(p) { return card(p, 'chair'); }).join('') + '</div>' : '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;text-align:center"><p style="font-size:14px;color:#6b7280;margin:0">\ub4f1\ub85d\ub41c \uccb4\uc5b4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</p></div>';
    var adm = sa ? 'inline-block' : 'none';

    root.innerHTML = '<div class="dtv-ok" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">'
      + '<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:16px 20px;border-radius:12px 12px 0 0"><div style="font-size:18px;font-weight:700;color:#fff">' + dn + '</div><div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:4px">' + sub + '</div></div>'
      + '<div id="dtv-tabs" style="display:flex;border-bottom:1px solid #e5e7eb;padding:0 8px;background:#fff;overflow-x:auto">'
      + '<button data-t="wr" class="dtv-tb dtv-act" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:700;cursor:pointer;color:#2563eb;border-bottom:2px solid #2563eb;font-family:inherit;white-space:nowrap">\ub300\uae30\uc2e4</button>'
      + '<button data-t="ch" class="dtv-tb" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">\uccb4\uc5b4</button>'
      + '<button data-t="no" class="dtv-tb" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">\uacf5\uc9c0\uc0ac\ud56d</button>'
      + '<button data-t="st" class="dtv-tb" style="padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">\uc124\uc815</button>'
      + '<button data-t="ad" class="dtv-tb" style="display:' + adm + ';padding:11px 14px;border:none;background:none;font-size:13px;font-weight:500;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap">\uad00\ub9ac</button>'
      + '</div>'
      + '<div style="padding:16px;background:#f9fafb;min-height:400px">'
      + '<div id="dtv-p-wr"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:15px;font-weight:700;color:#1f2937">\ub300\uae30\uc2e4 \uad00\ub9ac</span><span style="font-size:11px;background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:10px;font-weight:600">' + wr.length + '\uac1c</span></div>' + wrH + '</div>'
      + '<div id="dtv-p-ch" style="display:none"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:15px;font-weight:700;color:#1f2937">\uccb4\uc5b4 \uad00\ub9ac</span><span style="font-size:11px;background:#e0e7ff;color:#6366f1;padding:2px 8px;border-radius:10px;font-weight:600">' + cr.length + '\uac1c</span></div>' + crH + '</div>'
      + '<div id="dtv-p-no" style="display:none"><div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">\uc804\uccb4 \uae30\ub2a5 \ub85c\ub529 \uc911...</div></div>'
      + '<div id="dtv-p-st" style="display:none"><div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">\uc804\uccb4 \uae30\ub2a5 \ub85c\ub529 \uc911...</div></div>'
      + '<div id="dtv-p-ad" style="display:none"><div style="padding:40px;text-align:center;color:#9ca3af;font-size:13px">\uc804\uccb4 \uae30\ub2a5 \ub85c\ub529 \uc911...</div></div>'
      + '</div></div>';

    /* tab events */
    var tbs = root.querySelectorAll('.dtv-tb');
    var pnl = { wr: 'dtv-p-wr', ch: 'dtv-p-ch', no: 'dtv-p-no', st: 'dtv-p-st', ad: 'dtv-p-ad' };
    for (var i = 0; i < tbs.length; i++) {
      tbs[i].addEventListener('click', function() {
        var t = this.getAttribute('data-t');
        for (var j = 0; j < tbs.length; j++) { tbs[j].style.color = '#6b7280'; tbs[j].style.fontWeight = '500'; tbs[j].style.borderBottom = '2px solid transparent'; }
        this.style.color = '#2563eb'; this.style.fontWeight = '700'; this.style.borderBottom = '2px solid #2563eb';
        for (var k in pnl) { var el = document.getElementById(pnl[k]); if (el) el.style.display = k === t ? 'block' : 'none'; }
        if (t === 'no' || t === 'st' || t === 'ad') loadFull(t);
      });
    }
  }

  /* ===== full admin (iframe) for advanced tabs ===== */
  function loadFull(t) {
    var el = document.getElementById('dtv-p-' + t);
    if (!el || el.querySelector('iframe')) return;
    var map = { no: 'notice', st: 'settings', ad: 'admin' };
    var url = API + '/embed/' + encodeURIComponent(ADMIN_CODE) + '?email=' + encodeURIComponent((DATA && DATA.userEmail) || '') + '&tab=' + (map[t] || t);
    el.innerHTML = '<iframe src="' + url + '" width="100%" height="700" frameborder="0" style="border:none;border-radius:8px"></iframe>';
  }

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
    var url = API + '/api/widget/init/' + encodeURIComponent(mc);
    if (em) url += '?email=' + encodeURIComponent(em);
    fetch(url).then(function(r) { return r.json(); }).then(function(res) {
      if (!res.ok) { root.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">' + (res.error || '\ub370\uc774\ud130 \uc624\ub958') + '</div>'; return; }
      render(res.data, res.adminCode, res.baseUrl);
    }).catch(function(e) {
      root.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:13px">\uc11c\ubc84 \uc5f0\uacb0 \uc2e4\ud328</div>';
    });
  }
})();
