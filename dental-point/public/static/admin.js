// 치과 포인트 관리 시스템 - 관리자 프론트엔드 v4.8.8
// 버그 수정: 로그인 계정과 쿠폰 관리자 페이지 계정 불일치 수정
// ============================================================
(function () {
  'use strict';
  window.dptGoToPatients = function(name) {
    window.__dptNextPatientSearch = name || '';
    let tab = document.querySelector('[data-page="patients"]');
    if (tab) tab.click();
    else if (typeof window.__dptRenderPage === 'function') window.__dptRenderPage('patients');
  };
  const API = window.__DENTAL_POINT__?.API || '';
  let state = {
    token: localStorage.getItem('dpt_admin_token') || '',
    member: JSON.parse(localStorage.getItem('dpt_admin_member') || 'null'),
    clinics: JSON.parse(localStorage.getItem('dpt_admin_clinics') || '[]'),
    currentClinic: JSON.parse(localStorage.getItem('dpt_admin_current_clinic') || 'null'),
    currentPage: localStorage.getItem('dpt_admin_currentPage') || 'dashboard',
    imwebClinicName: localStorage.getItem('dpt_imweb_clinic_name') || '',
  };

  // ==================== Broadcast Channel for Realtime Updates ====================
  if (window.BroadcastChannel) {
    const bc = new BroadcastChannel('dental-point-events');
    bc.onmessage = (e) => {
      if (e.data && e.data.type === 'coupon_used') {
        if (state.currentPage === 'patients' && typeof renderPatients === 'function') {
          toast('스캐너에서 쿠폰 사용이 처리되었습니다. 목록을 새로고침합니다.');
          renderPatients(document.querySelector('#dpt-content'));
        } else if (state.currentPage === 'dashboard' && typeof renderDashboard === 'function') {
          toast('스캐너에서 쿠폰 사용이 처리되었습니다. 대시보드를 새로고침합니다.');
          renderDashboard(document.querySelector('#dpt-content'));
        }
      }
    };
  }


  // ==================== postMessage from QR scanner (for cross-origin or fallback) ====================
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'coupon_used') {
      if (state.currentPage === 'patients' && typeof renderPatients === 'function') {
          toast('스캐너에서 쿠폰 사용이 처리되었습니다. 목록을 새로고침합니다.');
          renderPatients(document.querySelector('#dpt-content'));
        } else if (state.currentPage === 'dashboard' && typeof renderDashboard === 'function') {
          toast('스캐너에서 쿠폰 사용이 처리되었습니다. 대시보드를 새로고침합니다.');
          renderDashboard(document.querySelector('#dpt-content'));
        }
    }
  });

  // ==================== 토큰 유효성 검증 (시작 시 서버에서 재확인) ====================
  // localStorage에 캐시된 토큰이 다른 계정 것일 수 있으므로, 앱 시작 시 서버에서 검증
  async function verifyAndSyncSession() {
    if (!state.token) return false;
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${state.token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        // 토큰 만료 또는 무효 → 로그아웃 처리
        clearSession();
        return false;
      }
      const data = await res.json();
      // 서버에서 반환된 멤버 정보로 state 업데이트 (캐시와 불일치 방지)
      if (data.member && state.member && data.member.id !== state.member.id) {
        // 다른 계정의 토큰이 캐시됨 → 클리닉 정보도 초기화
        state.member = data.member;
        state.clinics = [];
        state.currentClinic = null;
        localStorage.setItem('dpt_admin_member', JSON.stringify(data.member));
        localStorage.removeItem('dpt_admin_clinics');
        localStorage.removeItem('dpt_admin_current_clinic');
      } else if (data.member) {
        state.member = data.member;
        localStorage.setItem('dpt_admin_member', JSON.stringify(data.member));
      }
      return true;
    } catch (e) {
      return false; // 네트워크 오류 시 캐시 사용 허용
    }
  }

  function clearSession() {
    state.token = ''; state.member = null; state.clinics = []; state.currentClinic = null; state.imwebClinicName = '';
    localStorage.removeItem('dpt_admin_token'); localStorage.removeItem('dpt_admin_member');
    localStorage.removeItem('dpt_admin_clinics'); localStorage.removeItem('dpt_admin_current_clinic');
    localStorage.removeItem('dpt_imweb_clinic_name');
  }

  const $ = (sel) => document.querySelector(sel);
  const $root = document.getElementById('dpt-admin-app');

  // ==================== API 헬퍼 ====================
  async function api(path, options = {}) {
    let url = `${API}/api${path}`;
    if (!options.method || options.method.toUpperCase() === 'GET') { url += (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`; }
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      let data;
      try { data = await res.json(); } catch(err) { throw new Error('서버 응답 오류 (JSON 파싱 실패): ' + await res.text()); }
      if (!res.ok) throw new Error(data.error || '요청 실패');
      return data;
    } catch (e) {
      console.error('API Error:', e);
      throw e;
    }
  }

  
  function showConfirmModal(msg, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 animate-fade-in-up">
        <h3 class="text-lg font-bold text-gray-800 mb-2">안내</h3>
        <p class="text-sm text-gray-600 mb-6 whitespace-pre-line">${msg}</p>
        <div class="flex gap-2 w-full">
          <button id="dpt-conf-cancel" class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">취소</button>
          <button id="dpt-conf-ok" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">확인</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#dpt-conf-cancel').onclick = () => modal.remove();
    modal.querySelector('#dpt-conf-ok').onclick = () => { modal.remove(); onConfirm(); };
  }

  function toast(msg, type = 'success') {
    const div = document.createElement('div');
    div.className = 'dpt-toast';
    const bg = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
    div.innerHTML = `<div class="px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${bg}">${msg}</div>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // 모달 알림 (확인 버튼 있는 다이얼로그)
  function showAlertModal(title, message, type = 'info') {
    console.log('[DPT] showAlertModal:', title);
    /* 기존 모달 제거 */
    const old = document.getElementById('dpt-alert-modal-overlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'dpt-alert-modal-overlay';
    overlay.setAttribute('style', 'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100vw !important;height:100vh !important;background:rgba(0,0,0,0.6) !important;z-index:2147483647 !important;display:flex !important;align-items:center !important;justify-content:center !important;margin:0 !important;padding:0 !important;');
    const iconMap = { info: '💡', warning: '⚠️', error: '❌', success: '✅' };
    const colorMap = { info: '#3B82F6', warning: '#F59E0B', error: '#EF4444', success: '#10B981' };
    overlay.innerHTML = `
      <div style="background:#fff !important;border-radius:16px !important;padding:32px 28px !important;max-width:400px !important;width:90% !important;text-align:center !important;box-shadow:0 25px 60px rgba(0,0,0,0.4) !important;position:relative !important;z-index:2147483647 !important;animation:dptModalIn 0.3s ease;">
        <div style="font-size:48px;margin-bottom:16px;">${iconMap[type] || iconMap.info}</div>
        <div style="font-size:18px !important;font-weight:700 !important;color:#1F2937 !important;margin-bottom:12px !important;word-break:keep-all !important;line-height:1.5 !important;">${title}</div>
        <div style="font-size:14px !important;color:#6B7280 !important;margin-bottom:24px !important;word-break:keep-all !important;line-height:1.6 !important;">${message}</div>
        <button id="dpt-alert-modal-ok" style="background:${colorMap[type] || colorMap.info} !important;color:#fff !important;border:none !important;padding:12px 40px !important;border-radius:10px !important;font-size:15px !important;font-weight:600 !important;cursor:pointer !important;outline:none !important;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">확인</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const style = document.createElement('style');
    style.textContent = '@keyframes dptModalIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}';
    document.head.appendChild(style);
    const closeModal = () => { overlay.remove(); style.remove(); };
    overlay.querySelector('#dpt-alert-modal-ok').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    /* 5초 후 자동 닫기 fallback */
    setTimeout(() => { if (document.getElementById('dpt-alert-modal-overlay')) closeModal(); }, 5000);
  }

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function getClinicName() {
    return state.imwebClinicName || state.currentClinic?.name || '치과 관리';
  }

  // ==================== 로그인 ====================
  function renderLogin() {
    $root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md dpt-fade-in">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span class="text-[#7258db] text-2xl font-bold">P</span>
          </div>
          <h1 class="text-2xl font-bold text-gray-800">포인트 관리 시스템</h1>
          <p class="text-gray-500 mt-2 text-sm">관리자 로그인</p>
        </div>
        <form id="dpt-login-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <input type="tel" id="dpt-login-phone" placeholder="010-0000-0000"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input type="password" id="dpt-login-pw" placeholder="비밀번호"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
          </div>
          <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition">
            로그인
          </button>
        </form>
        <p class="text-center text-xs text-gray-400 mt-6">관리자 계정으로 로그인해주세요.</p>
      </div>
    </div>`;

    $('#dpt-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.textContent = '로그인 중...'; btn.disabled = true;
      try {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ phone: $('#dpt-login-phone').value, password: $('#dpt-login-pw').value }),
        });
        state.token = data.token;
        state.member = data.member;
        state.clinics = data.clinics;
        state.currentClinic = data.clinics[0] || null;
        localStorage.setItem('dpt_admin_token', state.token);
        localStorage.setItem('dpt_admin_member', JSON.stringify(state.member));
        localStorage.setItem('dpt_admin_clinics', JSON.stringify(state.clinics));
        localStorage.setItem('dpt_admin_current_clinic', JSON.stringify(state.currentClinic));
        toast('로그인 성공!');
        renderApp();
      } catch (e) { toast(e.message, 'error'); btn.textContent = '로그인'; btn.disabled = false; }
    });
  }


  // Background Polling for Patients List
  setInterval(() => {
    if (state.currentPage === 'patients') {
      const el = document.querySelector('#dpt-content');
      if (!el) return;
      // Do not poll if user is typing, has a dropdown open, or has a modal open
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;
      if (document.querySelector('.dpt-dropdown-menu:not(.hidden)')) return;
      if (document.querySelector('.fixed.inset-0.bg-black\\/50')) return; // Check for any modal overlays
      if (document.querySelector('[id$="-modal"]')) return;
      
      // Save scroll position
      const scrollPos = el.scrollTop;
      renderPatients(el, true).then(() => {
        el.scrollTop = scrollPos;
      }).catch(()=>{});
    }
  }, 4000);

  // ==================== 메인 레이아웃 ====================
  function renderApp() {
    if (!state.token || !state.member) return renderLogin();

    // ★ 핵심 버그 수정: 현재 클리닉이 현재 로그인 계정의 클리닉인지 확인
    // clinics 목록에 없는 clinic이 currentClinic으로 설정된 경우 (다른 계정 캐시) 초기화
    if (state.currentClinic && state.clinics && state.clinics.length > 0) {
      const validClinic = state.clinics.find(c => c.id === state.currentClinic.id);
      if (!validClinic) {
        // 현재 계정에 속하지 않는 클리닉 → 첫 번째 클리닉으로 리셋
        state.currentClinic = state.clinics[0] || null;
        localStorage.setItem('dpt_admin_current_clinic', JSON.stringify(state.currentClinic));
      }
    } else if (!state.currentClinic && state.clinics && state.clinics.length > 0) {
      state.currentClinic = state.clinics[0];
      localStorage.setItem('dpt_admin_current_clinic', JSON.stringify(state.currentClinic));
    }

    const cName = getClinicName();

    $root.innerHTML = `
    <div class="flex h-screen bg-[#ebeef3] font-sans text-slate-600">
      <aside class="w-[280px] bg-[#1a174d] text-slate-300 border-r border-[#26235b] flex flex-col shrink-0 hidden lg:flex shadow-[0_0_20px_rgba(0,0,0,0.1)] z-10">
        <div class="p-6 border-b border-[#26235b] flex flex-col items-center justify-center">
          <div class="w-16 h-16 bg-[#7258db] rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg shadow-[#7258db]/20">
            ${cName.charAt(0)}
          </div>
          <h2 class="font-bold text-white text-base truncate w-full text-center">${cName}</h2>
          <p class="text-sm text-slate-400 mt-1">${state.member.name}</p>
        </div>
        <nav class="flex-1 p-3 space-y-0.5" id="dpt-nav">
          <a data-page="dashboard" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">대시보드</a>
          <a data-page="payment" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">포인트 적립</a>
          <a data-page="patients" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">환자 관리</a>
          <a data-page="coupons" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">쿠폰 관리</a>
          <a data-page="bulk" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">대량 업로드</a>
          <a data-page="dentweb" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">DentWeb 연동</a>
          <a data-page="settings" class="dpt-nav-item flex items-center px-5 py-3.5 mx-2 rounded-xl text-[15px] font-medium cursor-pointer  transition-all duration-200">설정</a>
          <a data-page="mall" class="dpt-nav-item flex items-center px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-purple-50 hover:text-purple-700 transition font-bold text-purple-600 mt-2 border border-purple-100 bg-purple-50/50">🎁 쇼핑몰</a>
          ${state.member.role === 'admin' ? `<a data-page="mall_hq" class="dpt-nav-item flex items-center px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-red-50 hover:text-red-700 transition font-bold text-red-600 mt-1 border border-red-100 bg-red-50/50">👑 본사 몰 관리</a>` : ''}
        </nav>
        <div class="p-4 border-t border-[#26235b]">
          <a href="${API}/scan?clinic_id=${state.currentClinic?.id || ''}" target="_blank" class="w-full mb-2 flex items-center px-4 py-3 rounded-xl text-sm text-emerald-400 font-medium hover:bg-[#26235b] hover:text-emerald-300 cursor-pointer transition-all">📷 QR 스캔 열기</a>
          <button id="dpt-logout" class="w-full text-left px-4 py-3 rounded-xl text-sm text-red-400 font-medium hover:bg-[#26235b] hover:text-red-300 cursor-pointer transition-all">로그아웃</button>
        </div>
      </aside>
      <main class="flex-1 flex flex-col overflow-hidden">
        <header class="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button id="dpt-mobile-menu" class="text-gray-600 text-lg">&#9776;</button>
          <h1 class="font-bold text-blue-700 text-sm">${cName}</h1>
          <div class="flex gap-3 items-center"><a href="${API}/scan?clinic_id=${state.currentClinic?.id || ''}" target="_blank" class="text-green-600 font-semibold text-sm">📷 QR</a><button id="dpt-mobile-logout" class="text-gray-400 text-sm">로그아웃</button></div>
        </header>
        <div id="dpt-mobile-nav" class="lg:hidden bg-white border-b border-gray-200 overflow-x-auto hidden">
          <div class="flex px-2 py-2 gap-1 min-w-max">
            <button data-page="dashboard" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">대시보드</button>
            <button data-page="payment" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">포인트 적립</button>
            <button data-page="patients" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">환자관리</button>
            <button data-page="coupons" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">쿠폰관리</button>
            <button data-page="bulk" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">대량업로드</button>
            <button data-page="dentweb" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">DentWeb</button>
            <button data-page="settings" class="dpt-mnav-item px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">설정</button>
          </div>
        </div>
        <div id="dpt-content" class="flex-1 overflow-y-auto p-4 lg:p-6"></div>
      </main>
    </div>`;

    document.querySelectorAll('.dpt-nav-item, .dpt-mnav-item').forEach(el => {
      el.addEventListener('click', () => { 
      if (el.dataset.page === 'patients' && window.__dptNextPatientSearch == null) {
        patientSearchQuery = ''; // clear search when manually clicking tab
        patientFilterState = '';
      }
      state.currentPage = el.dataset.page;
      localStorage.setItem('dpt_admin_currentPage', state.currentPage);
      renderPage(); 
    });
    });
    const mNav = $('#dpt-mobile-nav');
    $('#dpt-mobile-menu')?.addEventListener('click', () => mNav.classList.toggle('hidden'));
    const logout = () => {
      clearSession();
      renderLogin();
    };
    $('#dpt-logout')?.addEventListener('click', logout);
    $('#dpt-mobile-logout')?.addEventListener('click', logout);
    renderPage();
  }

  function updateNav() {
    document.querySelectorAll('.dpt-nav-item').forEach(el => {
      const a = el.dataset.page === state.currentPage;
      el.classList.toggle('bg-[#7258db]', a); el.classList.toggle('text-white', a); el.classList.toggle('shadow-lg', a); el.classList.toggle('shadow-[#7258db]/10', a);
      el.classList.toggle('text-slate-400', !a); el.classList.toggle('hover:text-white', !a); el.classList.toggle('hover:bg-[#26235b]', !a); el.classList.remove('');
    });
    document.querySelectorAll('.dpt-mnav-item').forEach(el => {
      const a = el.dataset.page === state.currentPage;
      el.classList.toggle('bg-blue-100', a); el.classList.toggle('text-blue-700', a);
      el.classList.toggle('bg-gray-100', !a); el.classList.toggle('text-gray-600', !a);
    });
  }

  window.__dptRenderPage = function(page) { if (page) { state.currentPage = page; } renderPage(); };
  function renderPage() {
    updateNav();
    const c = $('#dpt-content');
    if (!c) return;
    switch (state.currentPage) {
      case 'dashboard': renderDashboard(c); break;
      case 'payment': renderPayment(c); break;
      case 'patients': renderPatients(c); break;
      case 'coupons': renderCoupons(c); break;
      case 'bulk': renderBulkUpload(c); break;
      case 'dentweb': renderDentwebSync(c); break;
      case 'settings': renderSettings(c); break;
      case 'mall': renderMall(c); break;
      case 'mall_hq': renderMallHQ(c); break;
    }
  }

  // ==================== 대시보드 (최근결제 + 최근등록환자 + DentWeb 상태) ====================
  async function renderDashboard(el, silent = false) {
    if (!silent) el.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    try {
      const [data, syncData] = await Promise.all([
        api(`/dashboard?clinic_id=${state.currentClinic?.id}`),
        api(`/sync/status?clinic_id=${state.currentClinic?.id}`).catch(() => ({ last_sync: null, dentweb_patients: 0 }))
      ]);
      const lastSync = syncData.last_sync;
      
      // 대시보드 진입 시에도 백그라운드 자동발행 실행
      if (state.currentClinic?.id) {
        (async function autoIssueBg() {
          try {
            const r = await api('/coupons/auto-issue-background', { method: 'POST', body: JSON.stringify({ clinic_id: state.currentClinic?.id }) });
            console.log('[auto-issue-bg] dashboard result:', r);
            if (r.issued > 0) {
              toast(`🎉 자동 쿠폰 ${r.issued}건 발행 완료`, 'success');
              if (r.has_more) {
                setTimeout(autoIssueBg, 500);
              } else {
                renderDashboard(el, true);
              }
            }
          } catch(e) { console.error('[auto-issue-bg] dashboard error:', e); }
        })();
      }

      el.innerHTML = `
      <div class="dpt-fade-in space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800">대시보드</h2>
          <span class="text-sm text-gray-400">${new Date().toLocaleDateString('ko-KR')}</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="dpt-dash-issue" class="px-5 py-2.5 bg-[#7258db] hover:bg-[#634bc4] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#7258db]/20">쿠폰 발행</button>
          
          <button id="dpt-dash-dentweb" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition">DentWeb 연동</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <p class="text-sm text-slate-500 font-medium mb-1">오늘 결제</p>
              <h3 class="text-2xl font-black text-slate-800">${fmt(data.today.payment_amount)}<span class="text-sm text-slate-400 ml-1 font-medium">원</span></h3>
              <p class="text-xs text-emerald-500 mt-1 font-medium">${data.today.payment_count}건 처리됨</p>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <div>
              <p class="text-sm text-slate-500 font-medium mb-1">오늘 적립</p>
              <h3 class="text-2xl font-black text-slate-800">${fmt(data.today.point_earned)}<span class="text-sm text-slate-400 ml-1 font-medium">P</span></h3>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 rounded-full bg-[#f0edff] flex items-center justify-center text-[#7258db] shrink-0">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <div>
              <p class="text-sm text-slate-500 font-medium mb-1">전체 환자</p>
              <h3 class="text-2xl font-black text-slate-800">${fmt(data.total_patients)}<span class="text-sm text-slate-400 ml-1 font-medium">명</span></h3>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
            </div>
            <div>
              <p class="text-sm text-slate-500 font-medium mb-1">활성 쿠폰</p>
              <h3 class="text-2xl font-black text-slate-800">${data.active_coupons}<span class="text-sm text-slate-400 ml-1 font-medium">장</span></h3>
            </div>
          </div>
        </div>

        <!-- 오늘 생일 환자 -->
        ${(data.birthday_patients && data.birthday_patients.length > 0) ? `
        <div class="bg-[#f0f4ff] rounded-2xl border border-blue-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
          <div class="px-5 py-4 border-b border-blue-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
            <h3 class="font-bold text-blue-800 flex items-center gap-2">
              오늘 생일 환자 
              <span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">${data.birthday_patients.length}명</span>
            </h3>
            <span class="text-xs font-medium text-blue-400">${new Date().getMonth()+1}월 ${new Date().getDate()}일</span>
          </div>
          <div class="divide-y divide-blue-100/50 bg-white/30">
            ${data.birthday_patients.map(p => {
              
              // 나이 계산
              let ageStr = '';
              if (p.birth_date) {
                const bYear = parseInt(p.birth_date.substring(0,4));
                if (!isNaN(bYear)) {
                  const age = new Date().getFullYear() - bYear;
                  ageStr = ` <span class="text-xs text-blue-400 font-normal">(${age}세)</span>`;
                }
              }
              
              // 발급된 생일 쿠폰 확인 (DB 필드 우선, fallback으로 all_coupons 파싱)
              let bdayCouponIssued = !!p.birthday_coupon_issued;
              let bdayCouponName = p.birthday_coupon_name || '';
              let bdayCouponStatus = p.birthday_coupon_status || '';
              let bdayCouponShared = p.birthday_coupon_shared_at || '';
              let bdayCouponUsed = (bdayCouponStatus === 'used');
              
              // DB 필드가 없을 경우 all_coupons에서 파싱 (하위 호환)
              if (!bdayCouponIssued && p.all_coupons) {
                const coupons = p.all_coupons.split('||').sort(function(a,b){return (Number(b.split('::')[4])||0)-(Number(a.split('::')[4])||0);});
                const currentYear = new Date(new Date().getTime() + 9 * 3600000).toISOString().substring(0, 4);
                for (let c of coupons) {
                  const parts = c.split('::');
                  const couponKind = parts[2] || 'general';
                  if (couponKind === 'birthday' && parts[3] && parts[3].indexOf(currentYear) === 0) {
                    bdayCouponIssued = true;
                    bdayCouponName = parts[0];
                    bdayCouponStatus = parts[1] || '';
                    if (parts[1] === 'used') bdayCouponUsed = true;
                    break;
                  }
                }
              }
              
              // 배지 및 버튼 스타일 결정
              let bdayBadgeHtml = '';
              let btnClass = '';
              let btnText = '';
              if (bdayCouponUsed) {
                bdayBadgeHtml = `<span class="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">✓ 사용완료</span>`;
                btnClass = 'dpt-issue-coupon px-3 py-1.5 bg-gray-300 text-gray-500 rounded-lg text-xs font-semibold transition-all cursor-default';
                btnText = '사용완료';
              } else if (bdayCouponIssued && bdayCouponShared) {
                bdayBadgeHtml = `<span class="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ 공유완료</span>`;
                btnClass = 'dpt-issue-coupon px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-emerald-500/20';
                btnText = '공유됨';
              } else if (bdayCouponIssued) {
                bdayBadgeHtml = `<span class="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🎫 발행됨</span>`;
                btnClass = 'dpt-issue-coupon px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-amber-500/20';
                btnText = '발행됨 · 공유';
              } else {
                bdayBadgeHtml = '';
                btnClass = 'dpt-issue-coupon px-3 py-1.5 bg-[#7258db] hover:bg-[#634bc4] text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-[#7258db]/20';
                btnText = '쿠폰발행';
              }
              
              return `
              <div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/50 transition">
                <div class="cursor-pointer" onclick="window.dptGoToPatients('${p.name}')">
                  <p class="font-bold text-slate-800 text-sm hover:text-blue-600 underline decoration-blue-200 underline-offset-2">${p.name}${ageStr} ${bdayBadgeHtml}</p>
                  <p class="text-xs text-slate-500 mt-0.5">${p.phone || '-'} &middot; ${p.chart_number || '차트번호 없음'}${bdayCouponName ? ` &middot; <span class="text-amber-600">${bdayCouponName}</span>` : ''}</p>
                </div>
                <div class="flex flex-col sm:items-end gap-1.5 shrink-0">
                  <p class="font-semibold text-sm text-[#7258db]">${fmt(p.available_points)}<span class="text-xs ml-0.5">P</span></p>
                  <button class="${btnClass}" data-bday-issued="${bdayCouponIssued ? '1' : '0'}" data-bday-cname="${bdayCouponName}" data-patient="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}">${btnText}</button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <!-- DentWeb 연동 상태 카드 -->
        <div class="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border ${lastSync ? 'border-l-4 border-l-emerald-500 border-y-slate-50 border-r-slate-50' : 'border-l-4 border-l-orange-400 border-y-slate-50 border-r-slate-50'} p-6 cursor-pointer hover:shadow-lg transition-all duration-300" id="dpt-dash-dw-card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 ${lastSync ? 'bg-green-100' : 'bg-orange-100'} rounded-xl flex items-center justify-center">
                <span class="text-lg">${lastSync ? '🔗' : '⚠️'}</span>
              </div>
              <div>
                <p class="font-semibold text-sm text-gray-800">DentWeb 연동 ${lastSync ? '<span class="text-green-600">활성</span>' : '<span class="text-orange-500">미연결</span>'}</p>
                <p class="text-xs text-gray-400">${lastSync ? '마지막 동기화: ' + lastSync.created_at.replace('T', ' ').substring(0, 16) + ' | 연동 환자: ' + fmt(syncData.dentweb_patients) + '명' : '브릿지 프로그램을 설치하면 DentWeb 데이터가 자동 동기화됩니다.'}</p>
              </div>
            </div>
            <span class="text-gray-300 text-lg">&rsaquo;</span>
          </div>
        </div>

        <!-- 최근 결제 -->
        <div class="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50">
          <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-semibold text-gray-800">최근 결제</h3>
            <span class="text-xs text-gray-400">최신 5건</span>
          </div>
          <div class="divide-y divide-gray-50">
            ${(data.recent_payments || []).length === 0 ? '<p class="p-5 text-center text-gray-400 text-sm">결제 내역이 없습니다.</p>' :
          (data.recent_payments || []).map(p => `
              <div class="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer" onclick="window.dptGoToPatients('${p.patient_name}')">
                <div>
                  <p class="font-medium text-sm text-gray-800 hover:text-blue-600 underline decoration-blue-200 underline-offset-2">${p.patient_name} <span class="text-xs font-normal text-gray-500 no-underline">(총 ${fmt(p.available_points)}P)</span></p>
                  <p class="text-xs text-gray-400 no-underline">${p.category || '일반진료'} &middot; ${p.payment_date}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-sm text-gray-800">${fmt(p.amount)}원</p>
                  <p class="text-xs text-blue-500">+${fmt(p.point_earned)}P</p>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- 최근 등록 환자 -->
        <div class="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50">
          <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-semibold text-gray-800">최근 등록 환자</h3>
            <span class="text-xs text-gray-400">최신 5명</span>
          </div>
          <div class="divide-y divide-gray-50">
            ${(data.recent_patients || []).length === 0 ? '<p class="p-5 text-center text-gray-400 text-sm">등록된 환자가 없습니다.</p>' :
          (data.recent_patients || []).map(p => `
              <div class="px-5 py-3 flex items-center justify-between">
                <div>
                  <p class="font-medium text-sm text-gray-800">${p.name}</p>
                  <p class="text-xs text-gray-400">${p.phone || '-'} &middot; 등록: ${p.joined_at ? p.joined_at.replace('T',' ').substring(0,16) : '-'}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-sm text-blue-600">${fmt((p.total_points || 0) - (p.used_points || 0))}P</p>
                  <p class="text-xs text-gray-400">${p.last_treatment || ''}</p>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    } catch (e) {
      el.innerHTML = `<div class="text-center py-20 text-red-500"><p>${e.message}</p></div>`;
    }
    document.getElementById('dpt-dash-issue')?.addEventListener('click', () => { state.currentPage = 'patients'; renderPage(); });
    document.getElementById('dpt-dash-dentweb')?.addEventListener('click', () => { state.currentPage = 'dentweb'; renderPage(); });
    document.getElementById('dpt-dash-dw-card')?.addEventListener('click', () => { state.currentPage = 'dentweb'; renderPage(); });
  }

  // ==================== 결제 등록 ====================
  async function renderPayment(el) {
    let patients = [], categories = [];
    try { const d = await api(`/clinics/${state.currentClinic?.id}/patients`); patients = d.patients || []; } catch {}
    try { const d = await api(`/clinics/${state.currentClinic?.id}`); categories = d.settings?.category_rates || []; } catch {}

    el.innerHTML = `
    <div class="dpt-fade-in space-y-6 max-w-2xl">
      <h2 class="text-xl font-bold text-gray-800">포인트 적립</h2>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">환자 선택 *</label>
          <div class="flex gap-2 mb-2">
            <input id="dpt-pay-pat-search" type="text" placeholder="이름 검색" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <button id="dpt-pay-pat-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition whitespace-nowrap">검색</button>
          </div>
          <div class="flex gap-2">
            <select id="dpt-pay-patient" class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">환자를 선택하세요</option>
              ${patients.map(p => `<option value="${p.id}">${p.name} (${p.phone}) - ${fmt(p.available_points)}P</option>`).join('')}
            </select>
            <button id="dpt-pay-new-patient" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 whitespace-nowrap transition">+ 신규</button>
          </div>
        </div>
        <div id="dpt-new-patient-form" class="hidden bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 class="text-sm font-semibold text-gray-700">신규 환자 등록</h4>
          <div class="grid grid-cols-2 gap-3">
            <input id="dpt-np-name" placeholder="이름 *" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input id="dpt-np-phone" placeholder="전화번호 *" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button id="dpt-np-save" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition">등록</button>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">결제 금액 *</label>
            <input type="text" id="dpt-pay-amount" placeholder="0" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">진료 항목</label>
            <select id="dpt-pay-category" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="일반진료">일반진료</option>
              ${categories.map(c => `<option value="${c.category}" data-rate="${c.rate}">${c.category} (${c.rate}%)</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">적립율 (%)</label>
            <input type="number" id="dpt-pay-rate" step="0.1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">결제일</label>
            <input type="date" id="dpt-pay-date" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">메모</label>
          <input type="text" id="dpt-pay-desc" placeholder="진료 내용" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div id="dpt-pay-preview" class="bg-blue-50 rounded-lg p-4 hidden">
          <div class="flex justify-between items-center">
            <span class="text-sm text-blue-700 font-medium">적립 예정 포인트</span>
            <span id="dpt-pay-preview-points" class="text-lg font-bold text-blue-700">0 P</span>
          </div>
        </div>
        <button id="dpt-pay-submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition">결제 내역 및 포인트 적립 완료</button>
      </div>
    </div>`;

    el.querySelector('#dpt-pay-date').value = new Date().toISOString().split('T')[0];
    el.querySelector('#dpt-pay-amount').addEventListener('input', (e) => {
      let v = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = v ? Number(v).toLocaleString('ko-KR') : '';
      updatePreview();
    });
    $('#dpt-pay-category').addEventListener('change', (e) => {
      const r = e.target.selectedOptions[0].dataset.rate;
      if (r) el.querySelector('#dpt-pay-rate').value = r;
      updatePreview();
    });
    el.querySelector('#dpt-pay-rate').addEventListener('input', updatePreview);

    function updatePreview() {
      const amount = Number((el.querySelector('#dpt-pay-amount')?.value || '').replace(/,/g, '')) || 0;
      const rate = Number(el.querySelector('#dpt-pay-rate')?.value) || 0;
      const pts = Math.floor(amount * (rate / 100));
      if (amount > 0 && rate > 0) {
        el.querySelector('#dpt-pay-preview').classList.remove('hidden');
        el.querySelector('#dpt-pay-preview-points').textContent = `${fmt(pts)} P`;
      } else { el.querySelector('#dpt-pay-preview').classList.add('hidden'); }
    }

    el.querySelector('#dpt-pay-pat-btn')?.addEventListener('click', async () => {
      const q = el.querySelector('#dpt-pay-pat-search').value.trim();
      const sel = el.querySelector('#dpt-pay-patient');
      sel.innerHTML = '<option value="">검색 중...</option>';
      try {
        const res = await api('/clinics/' + state.currentClinic.id + '/patients' + (q ? '?search=' + encodeURIComponent(q) : ''));
        const pts = res.patients || [];
        if (pts.length === 0) {
          sel.innerHTML = '<option value="">검색 결과가 없습니다</option>';
          toast('검색된 환자가 없습니다.', 'error');
        } else {
          sel.innerHTML = '<option value="">' + pts.length + '명 검색됨 (선택하세요)</option>' + pts.map(p => `<option value="${p.id}">${p.name} (${p.phone}) - ${fmt(p.available_points)}P</option>`).join('');
          if (pts.length === 1) {
            sel.selectedIndex = 1;
            toast(pts[0].name + ' 환자가 자동 선택되었습니다.');
          } else {
            sel.focus();
            toast(pts.length + '명의 환자가 검색되었습니다.');
          }
        }
      } catch {
        sel.innerHTML = '<option value="">오류 발생</option>';
      }
    });
    el.querySelector('#dpt-pay-new-patient').addEventListener('click', () => el.querySelector('#dpt-new-patient-form').classList.toggle('hidden'));
    el.querySelector('#dpt-np-save')?.addEventListener('click', async () => {
      const name = el.querySelector('#dpt-np-name').value, phone = el.querySelector('#dpt-np-phone').value;
      if (!name || !phone) return toast('이름과 전화번호를 입력하세요.', 'error');
      try {
        await api(`/clinics/${state.currentClinic?.id}/patients`, { method: 'POST', body: JSON.stringify({ name, phone }) });
        toast('환자가 등록되었습니다!'); renderPayment(el);
      } catch (e) { toast(e.message, 'error'); }
    });

    el.querySelector('#dpt-pay-submit').addEventListener('click', async () => {
      const patient_id = el.querySelector('#dpt-pay-patient').value;
      const amount = Number((el.querySelector('#dpt-pay-amount').value || '').replace(/,/g, ''));
      if (!patient_id) return toast('환자를 선택하세요.', 'error');
      if (!amount || amount <= 0) return toast('결제 금액을 입력하세요.', 'error');
      const btn = el.querySelector('#dpt-pay-submit'); btn.textContent = '처리 중...'; btn.disabled = true;
      try {
        const data = await api('/payments', {
          method: 'POST',
          body: JSON.stringify({
            clinic_id: state.currentClinic?.id, patient_id: Number(patient_id), amount,
            category: $('#dpt-pay-category').value,
            point_rate_override: Number(el.querySelector('#dpt-pay-rate').value) || undefined,
            payment_date: el.querySelector('#dpt-pay-date').value,
            description: $('#dpt-pay-desc').value,
          }),
        });
        toast(`결제 등록! +${fmt(data.point_earned)}P 적립`);
        // 자동 쿠폰 발행 알림
        if (data.auto_issued_coupons && data.auto_issued_coupons.length > 0) {
          data.auto_issued_coupons.forEach(c => {
            setTimeout(() => toast(`🎉 자동 쿠폰 발행: ${c.template_name} (${c.code})`, 'success'), 500);
          });
        }
        btn.textContent = '결제 내역 및 포인트 적립 완료'; btn.disabled = false;
        
        const sel = el.querySelector('#dpt-pay-patient');
        if (sel && sel.selectedIndex >= 0) {
          const patName = sel.options[sel.selectedIndex].text.split(' (')[0].trim();
          patientSearchQuery = patName;
        }
        state.currentPage = 'patients';
        renderPage();
      } catch (e) { toast(e.message, 'error'); btn.textContent = '결제 내역 및 포인트 적립 완료'; btn.disabled = false; }
    });
  }

  let showOnlyPoints = false;
  // ==================== 환자 관리 (검색 후 전체 리렌더링) ====================
  let patientSearchQuery = '';
  let patientFilterState = ''; // "birthday" or "points" or ""

  async function renderPatients(el, silent = false) {
    el.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    try {
      if (window.__dptNextPatientSearch !== undefined && window.__dptNextPatientSearch !== null) {
        patientSearchQuery = window.__dptNextPatientSearch;
        window.__dptNextPatientSearch = null;
      }
      patientFilterState = ''; // Reset filters when navigating

      let url = `/clinics/${state.currentClinic?.id}/patients`;
      let queryParams = [];
      if (patientSearchQuery) queryParams.push(`search=${encodeURIComponent(patientSearchQuery)}`);
      if (patientFilterState === 'birthday') queryParams.push(`birthday=today`);
      if (patientFilterState && patientFilterState !== 'birthday') queryParams.push(`point_filter=${encodeURIComponent(patientFilterState)}`);
      if (queryParams.length > 0) url += `?` + queryParams.join('&');
      const data = await api(url);
      const patients = data.patients || [];
      
      // 백그라운드 자동발행: 포인트 충족 환자에게 쿠폰 자동 발행 (비동기, UI 차단 안 함)
      if (!patientSearchQuery && !patientFilterState) {
        (async function autoIssueBg() {
          try {
            const r = await api('/coupons/auto-issue-background', { method: 'POST', body: JSON.stringify({ clinic_id: state.currentClinic?.id }) });
            console.log('[auto-issue-bg] patients result:', r);
            if (r.issued > 0) {
              toast(`🎉 자동 쿠폰 ${r.issued}건 발행 완료`, 'success');
              if (r.has_more) {
                setTimeout(autoIssueBg, 500);
              } else {
                renderPatients(el, true);
              }
            }
          } catch(e) { console.error('[auto-issue-bg] patients error:', e); }
        })();
      }
      el.innerHTML = `
      <div class="dpt-fade-in space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black text-slate-800">환자 관리 <span class="text-sm font-medium bg-[#f3f0ff] text-[#605da8] px-2 py-0.5 rounded-full ml-2">${patients.length}명</span></h2>
          <button id="dpt-patient-delete-all-btn" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition border border-red-200">전체 환자 삭제</button>
        </div>
        <div class="flex gap-2">
          <input id="dpt-patient-search" placeholder="이름, 전화번호, 차트번호 검색" value="${patientSearchQuery}" class="flex-1 px-5 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#7258db] focus:border-[#7258db] outline-none shadow-sm transition-all" />
          <button id="dpt-patient-search-btn" class="px-5 py-2 bg-[#7258db] text-white rounded-xl text-sm font-medium hover:bg-[#634bc4] transition-all shadow-md shadow-[#7258db]/20">검색</button>
          <button id="dpt-patient-bday-btn" class="px-3 py-2 ${patientFilterState==='birthday'?'bg-amber-100 text-amber-700 border border-amber-200':'bg-blue-50 text-blue-600 border border-blue-100'} rounded-lg text-sm transition">생일</button>
          <select id="dpt-patient-pts-btn" class="px-3 py-2 ${patientFilterState && patientFilterState !== 'birthday' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-600 border border-blue-100'} rounded-lg text-sm transition outline-none cursor-pointer">
            <option value="">포인트 검색 (전체)</option>
            <option value="1" ${patientFilterState==='1'?'selected':''}>1P 이상 보유</option>
            ${(data.point_filters && data.point_filters.length > 0) ? data.point_filters.map(f => `<option value="${f.points}" ${patientFilterState===String(f.points)?'selected':''}>${f.label}</option>`).join('') : `
            <option value="1000" ${patientFilterState==='1000'?'selected':''}>1,000P</option>
            <option value="5000" ${patientFilterState==='5000'?'selected':''}>5,000P</option>
            <option value="10000" ${patientFilterState==='10000'?'selected':''}>10,000P</option>
            <option value="30000" ${patientFilterState==='30000'?'selected':''}>30,000P</option>
            <option value="50000" ${patientFilterState==='50000'?'selected':''}>50,000P</option>
            <option value="100000" ${patientFilterState==='100000'?'selected':''}>100,000P</option>
            `}
          </select>
          ${patientSearchQuery || patientFilterState ? '<button id="dpt-patient-clear-btn" class="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-300 transition">초기화</button>' : ''}
        </div>
        ${patientFilterState === 'birthday' ? '<p class="text-xs text-amber-600 font-medium">오늘 생일인 환자 목록입니다.</p>' : ''}
        ${patientFilterState && patientFilterState !== 'birthday' ? '<p class="text-xs text-purple-600 font-medium">' + Number(patientFilterState).toLocaleString() + 'P 이상 보유한 환자 목록입니다.</p>' : ''}
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
          <div class="overflow-x-auto" style="min-height: 280px; padding-bottom: 80px;">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">차트번호</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">이름</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">생년월일</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">연락처</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">진료내용</th>
                  <th class="text-right px-4 py-3 font-semibold text-gray-600">결제내역</th>
                  <th class="text-center px-4 py-3 font-semibold text-gray-600">쿠폰</th>
                  <th class="text-right px-4 py-3 font-semibold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${patients.length === 0 ? '<tr><td colspan="8" class="p-6 text-center text-gray-400 text-sm">등록된 환자가 없습니다.</td></tr>' : patients.map(p => `
                <tr class="hover:bg-gray-50 cursor-pointer dpt-patient-row" data-pid="${p.id}" data-pname="${(p.name || '').replace(/"/g, '&quot;')}">
                  <td class="px-4 py-3 text-gray-500 text-xs font-mono">${p.chart_number || '<span class="text-gray-300">-</span>'}</td>
                  <td class="px-4 py-3 font-medium text-gray-800">${p.name}</td>
                  <td class="px-4 py-3 text-gray-600 text-xs">${p.birth_date || '-'}</td>
                  <td class="px-4 py-3 text-gray-600">${p.phone}</td>
                  <td class="px-4 py-3 text-gray-600 text-xs">${p.last_treatment || (p.last_payment_amount ? '<span class="text-gray-400">일반진료</span>' : '<span class="text-gray-300">-</span>')}</td>
                  <td class="px-4 py-3 text-right">${p.last_payment_amount ? `<span class="font-medium text-gray-800">${fmt(p.last_payment_amount)}원</span><br><span class="text-xs text-gray-400">${p.last_payment_date || ''}</span>` : '<span class="text-gray-300">-</span>'}</td>
                  <td class="px-4 py-3 text-center">
                    <div class="flex flex-row items-center justify-center gap-2">
                      <button class="dpt-issue-coupon px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-[11px] hover:bg-blue-100 transition whitespace-nowrap" data-patient="${p.id}" data-name="${(p.name || '').replace(/"/g, '&quot;')}">공유</button>
                      <div class="relative dpt-dropdown-container">
                        <button class="dpt-cpn-toggle px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded text-[11px] font-medium flex items-center gap-1 hover:bg-gray-100 transition whitespace-nowrap">
                          보유 쿠폰 <span class="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px] leading-none">${p.all_coupons ? p.all_coupons.split('||').filter(x => x.includes('::active')).length : 0}</span>
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div class="absolute z-10 hidden mt-1 w-max min-w-[140px] max-w-[240px] left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-left dpt-dropdown-menu">
                          ${p.all_coupons ? p.all_coupons.split('||').sort(function(a,b){return (Number(b.split('::')[4])||0)-(Number(a.split('::')[4])||0);}).map(cn => {
                            const parts = cn.split('::');
                            let cname = parts[0];
                            const cstatus = parts[1] || 'active';
                            const couponKind = parts[2] || 'general';
                            const is_bday = couponKind === 'birthday';
                            const c_code = parts[5] || '';
                            const shared_at = parts[6] || '';
                            
                            
                            let bg = 'bg-transparent';
                            let fg = 'text-slate-800 font-bold';
                            let lbl = '만료';
                            let showLbl = true;

                            if (cstatus === 'active') {
                              if (shared_at) { bg = 'bg-purple-50'; fg = 'text-purple-600'; lbl = '지급(전송됨)'; }
                              else { bg = 'bg-blue-50'; fg = 'text-blue-600'; lbl = '지급(미전송)'; showLbl = true; }
                            } else if (cstatus === 'used') {
                              lbl = '사용완료'; bg = 'bg-transparent'; fg = 'text-slate-800 text-[13px] font-bold'; showLbl = false;
                            }
                            
                            let btns = '';
                            const delivType = parts[7] || '';
                            if (cstatus === 'active' && parts[4]) {
                              if (delivType === 'direct') {
                                btns += `<button class="dpt-req-delivery px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-[10px] font-medium transition hidden group-hover:block w-full text-center whitespace-nowrap" data-code="${c_code}" data-cname="${cname}" data-pname="${(p.name || '').replace(/"/g, '&quot;')}" data-pphone="${p.phone || ''}">배송입력</button>`;
                              } else {
                                if (!shared_at) {
                                  btns += `<button class="dpt-share-coupon px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-[10px] font-medium transition hidden group-hover:block w-full text-center" data-code="${c_code}">공유</button>`;
                                }
                              }
                              btns += `<button class="dpt-del-coupon text-red-400 hover:text-red-600 hover:bg-red-50 rounded px-1 hidden group-hover:block transition" data-cid="${parts[4]}" data-cname="${cname}">삭제</button>`;
                            }
                            return `<div class="text-[11px] font-medium ${bg} ${fg} px-2 py-1.5 rounded mb-1 flex justify-between items-center gap-2 group">
                                     <span class="flex-1 text-left break-keep" title="${cname}">${is_bday ? '<span class="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[9px] mr-1">생일쿠폰</span>' : '<span class="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[9px] mr-1">일반쿠폰</span>'}${cname}</span>
                                     <div class="flex items-center gap-1">
                                       ${showLbl ? `<span class="text-[9px] bg-white px-1 py-0.5 rounded shadow-sm whitespace-nowrap">${lbl}</span>` : ''}
                                       ${btns}
                                     </div>
                                   </div>`;
                          }).join('') : '<div class="text-[11px] text-gray-400 text-center py-1">보유 쿠폰 없음</div>'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button class="dpt-edit-patient px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition mr-1" data-patient="${p.id}">수정</button>
                    <button class="dpt-del-patient px-2 py-1 bg-red-50 text-red-500 rounded text-xs hover:bg-red-100 transition" data-patient="${p.id}" data-name="${(p.name || '').replace(/"/g, '&quot;')}">삭제</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

      

      // 검색 이벤트
      const doSearch = () => {
        patientSearchQuery = $('#dpt-patient-search')?.value?.trim() || '';
        patientFilterState = '';
        renderPatients(el);
      };
      
      // 필터 버튼 이벤트
      const bdayBtn = el.querySelector('#dpt-patient-bday-btn');
      if (bdayBtn) {
        bdayBtn.onclick = () => {
          patientFilterState = patientFilterState === 'birthday' ? '' : 'birthday';
          if (patientFilterState) patientSearchQuery = '';
          renderPatients(el);
        };
      }
      const ptsBtn = el.querySelector('#dpt-patient-pts-btn');
      if (ptsBtn) {
        ptsBtn.onchange = (e) => {
          patientFilterState = e.target.value;
          if (patientFilterState) patientSearchQuery = '';
          renderPatients(el);
        };
      }

      $('#dpt-patient-search-btn')?.addEventListener('click', doSearch);
      const debouncedSearch = debounce(doSearch, 400);
      $('#dpt-patient-search')?.addEventListener('input', debouncedSearch);
      $('#dpt-patient-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
      $('#dpt-patient-clear-btn')?.addEventListener('click', () => { patientSearchQuery = ''; patientFilterState = ''; renderPatients(el); });
      
      $('#dpt-patient-delete-all-btn')?.addEventListener('click', async () => {
        showConfirmModal('정말 현재 치과의 [모든 환자]와 [결제내역/포인트/쿠폰]을 전체 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.', async () => {
          btn.textContent = '삭제 중...'; btn.disabled = true;
          try {
            await api(`/clinics/${state.currentClinic?.id}/patients_all`, { method: 'DELETE' });
            toast('전체 데이터가 삭제되었습니다.');
            patientSearchQuery = '';
            renderPatients(el);
          } catch (err) { toast(err.message, 'error'); btn.textContent = '모든 환자 전체 삭제'; btn.disabled = false; }
        });
        return;
        try {
          const btn = $('#dpt-patient-delete-all-btn');
          const originalText = btn.textContent;
          btn.textContent = '삭제 중...';
          btn.disabled = true;
          const res = await api('/clinics/' + state.currentClinic?.id + '/patients_all', { method: 'DELETE' });
          toast(res.message || '전체 환자가 삭제되었습니다.');
          patientSearchQuery = '';
          renderPatients(el);
        } catch (e) {
          toast(e.message, 'error');
          $('#dpt-patient-delete-all-btn').textContent = '전체 환자 삭제';
          $('#dpt-patient-delete-all-btn').disabled = false;
        }
      });

      
      // 쿠폰 드롭다운 토글 이벤트
      el.querySelectorAll('.dpt-cpn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const menu = btn.nextElementSibling;
          const isHidden = menu.classList.contains('hidden');
          // Close all other dropdowns
          el.querySelectorAll('.dpt-dropdown-menu').forEach(m => m.classList.add('hidden'));
          el.querySelectorAll('.dpt-patient-row').forEach(r => {
            r.style.backgroundColor = '';
            r.removeAttribute('data-active');
          });
          if (isHidden) {
            menu.classList.remove('hidden');
            const tr = btn.closest('.dpt-patient-row');
            if (tr) {
              tr.style.backgroundColor = '#f3f4f6';
              tr.setAttribute('data-active', 'true');
            }
          }
        });
      });
      
      // 외부 클릭 시 드롭다운 닫기
      if (!window._dptDdListener) { window._dptDdListener = true; document.addEventListener('click', (e) => {
        if (!e.target.closest('.dpt-dropdown-container')) {
          document.querySelectorAll('.dpt-dropdown-menu').forEach(m => m.classList.add('hidden'));
          document.querySelectorAll('.dpt-patient-row').forEach(r => {
            if (r.getAttribute('data-active') === 'true') {
              r.style.backgroundColor = '';
              r.removeAttribute('data-active');
            }
          });
        }
      }); }

      // 이벤트 위임 (중복 등록 방지)
      el.onclick = async (e) => {
        
                const useOwnedBtn = e.target.closest('.dpt-use-coupon');
        if (useOwnedBtn) {
          e.stopPropagation();
          const code = useOwnedBtn.dataset.code;
          const cname = useOwnedBtn.dataset.cname;
          try {
            useOwnedBtn.textContent = '...';
            await api(`/coupons/use/${code}`, { method: 'POST' });
            toast('쿠폰이 사용 처리되었습니다.');
            await renderPatients(el);
          } catch(err) { 
            toast(err.message, 'error'); 
            useOwnedBtn.textContent = '사용'; 
          }
          return;
        }

        const reqDelivBtn = e.target.closest('.dpt-req-delivery');
        if (reqDelivBtn) {
          e.stopPropagation();
          showDeliveryRequestModal(reqDelivBtn.dataset.code, reqDelivBtn.dataset.cname, reqDelivBtn.dataset.pname, reqDelivBtn.dataset.pphone, () => {
            renderPatients(el);
          });
          return;
        }

        const shareOwnedBtn = e.target.closest('.dpt-share-coupon');
        if (shareOwnedBtn) {
          e.stopPropagation();
          const code = shareOwnedBtn.dataset.code;
          try {
            shareOwnedBtn.textContent = '...';
            const res = await api(`/coupons/check/${code}`);
            await api(`/coupons/${code}/share`, { method: 'POST' }).catch(()=>{});
            showCouponIssueModal_from_owned(res.coupon, async () => {
              // On close, refresh the patient list to show badge
              
              await renderPatients(el);
            });
            shareOwnedBtn.textContent = '발행';
          } catch(err) { toast(err.message, 'error'); shareOwnedBtn.textContent = '발행'; }
          return;
        }

        const delCouponBtn = e.target.closest('.dpt-del-coupon');
        if (delCouponBtn) {
          e.stopPropagation();
          showConfirmModal(`'${delCouponBtn.dataset.cname}' 쿠폰을 삭제하시겠습니까?\n(포인트 차감 쿠폰의 경우 자동 환불됩니다)`, async () => {
            try {
              await api(`/coupons/${delCouponBtn.dataset.cid}`, { method: 'DELETE' });
              toast('쿠폰이 삭제되었습니다.');
              await renderPatients(el);
            } catch(err) { toast(err.message, 'error'); }
          });
          return;
          try {
              await api(`/coupons/${delCouponBtn.dataset.cid}`, { method: 'DELETE' });
              toast('쿠폰이 삭제되었습니다.');
              await renderPatients(el);
          } catch (err) { toast(err.message, 'error'); }
          return;
        }
        const issueBtn = e.target.closest('.dpt-issue-coupon');
        if (issueBtn) { e.stopPropagation(); return showCouponIssueModal(issueBtn.dataset.patient, issueBtn.dataset.name); }
        const editBtn = e.target.closest('.dpt-edit-patient');
        if (editBtn) {
          e.stopPropagation();
          try { const d = await api(`/clinics/${state.currentClinic?.id}/patients/${editBtn.dataset.patient}`); showPatientEditModal(editBtn.dataset.patient, d.patient, el); } catch (err) { toast(err.message, 'error'); }
          return;
        }
        const delBtn = e.target.closest('.dpt-del-patient');
        if (delBtn) {
          e.stopPropagation();
          showConfirmModal(`${delBtn.dataset.name} 환자를 정말 삭제하시겠습니까?\n(포인트/결제내역은 유지되며 치과-환자 연결만 해제됩니다.)`, async () => {
            try {
              await api(`/clinics/${state.currentClinic?.id}/patients/${delBtn.dataset.id}`, { method: 'DELETE' });
              toast('환자가 삭제되었습니다.');
              renderPatients(el);
            } catch (err) { toast(err.message, 'error'); }
          });
          return;
          try { await api(`/clinics/${state.currentClinic?.id}/patients/${delBtn.dataset.patient}`, { method: 'DELETE' }); toast(`${delBtn.dataset.name} 환자가 삭제되었습니다.`); renderPatients(el); } catch (err) { toast(err.message, 'error'); }
          return;
        }
        const row = e.target.closest('.dpt-patient-row');
        if (row && !e.target.closest('button')) {
          try { const d = await api(`/clinics/${state.currentClinic?.id}/patients/${row.dataset.pid}`); showPatientDetailModal(row.dataset.pid, d, el); } catch (err) { toast(err.message, 'error'); }
        }
      };
    } catch (e) { el.innerHTML = `<p class="text-red-500 text-center py-10">${e.message}</p>`; }
  }

  // ==================== 환자 상세 모달 ====================
  function showPatientDetailModal(pid, data, parentEl) {
    const pt = data.patient;
    const pays = data.payments || [];
    const cpns = data.coupons || [];
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl">
      <div class="p-5 border-b flex justify-between items-center">
        <h3 class="text-lg font-bold text-gray-800">환자 상세정보</h3>
        <button class="dpt-modal-close text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>
      <div class="p-5 overflow-y-auto flex-1 space-y-4">
        <div class="bg-blue-50 rounded-xl p-4">
          <div class="flex justify-between items-start mb-3">
            <div><p class="text-lg font-bold text-gray-800">${pt.name}</p><p class="text-xs text-gray-500">${pt.chart_number || '차트번호 미등록'}</p></div>
            <button class="dpt-detail-edit px-3 py-1 bg-white rounded-lg text-xs border text-gray-600 hover:bg-gray-50">수정</button>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="text-gray-500">생년월일</span><br><strong>${pt.birth_date || '-'}</strong></div>
            <div><span class="text-gray-500">연락처</span><br><strong>${pt.phone}</strong></div>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-3">
            <div class="bg-white rounded-lg p-2 text-center"><p class="text-[10px] text-gray-400">적립</p><p class="text-sm font-bold">${fmt(pt.total_points)}</p></div>
            <div class="bg-white rounded-lg p-2 text-center"><p class="text-[10px] text-gray-400">사용</p><p class="text-sm font-bold text-red-500">${fmt(pt.used_points||0)}</p></div>
            <div class="bg-white rounded-lg p-2 text-center"><p class="text-[10px] text-gray-400">잔여</p><p class="text-sm font-bold text-blue-600">${fmt(pt.available_points)}P</p></div>
          </div>
        </div>
        <div>
          <div class="flex justify-between items-center mb-2"><span class="text-sm font-semibold text-gray-800">진료/결제내역</span><span class="text-xs text-gray-400">최근 20건</span></div>
          <div class="bg-white rounded-xl border overflow-hidden">
            ${pays.length === 0 ? '<p class="p-4 text-center text-gray-400 text-sm">결제 내역이 없습니다.</p>' :
            `<table class="w-full text-xs"><thead class="bg-gray-50"><tr><th class="text-left p-2 text-gray-500">날짜</th><th class="text-left p-2 text-gray-500">진료</th><th class="text-right p-2 text-gray-500">금액</th><th class="text-right p-2 text-gray-500">적립</th></tr></thead><tbody>${pays.map(p=>`<tr class="border-t"><td class="p-2 text-gray-500">${p.payment_date}</td><td class="p-2 font-medium">${p.category}</td><td class="p-2 text-right">${fmt(p.amount)}원</td><td class="p-2 text-right text-blue-600">+${fmt(p.point_earned)}P</td></tr>`).join('')}</tbody></table>`}
          </div>
        </div>
        <div>
          <div class="flex justify-between items-center mb-2"><span class="text-sm font-semibold text-gray-800">활성 쿠폰</span><button class="dpt-detail-issue px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">+ 발행</button></div>
          ${cpns.length === 0 ? '<p class="text-center text-gray-400 text-xs py-3 bg-gray-50 rounded-lg">활성 쿠폰 없음</p>' :
          cpns.map(c=>`<div class="flex justify-between items-center bg-gray-50 rounded-lg p-3 mb-1"><div><p class="text-xs font-medium">${c.template_name}</p><p class="text-[10px] text-gray-400">${c.discount_type==='fixed'?fmt(c.discount_value)+'원':c.discount_value+'%'} 할인 | ~${c.expires_at}</p></div><span class="text-xs font-mono text-blue-600">${c.code}</span></div>`).join('')}
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    
    // Fetch products and populate select
    api('/mall/products').then(res => {
      const select = modal.querySelector('#dpt-tpl-product');
      if (res && res.products) {
        res.products.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `[${p.type === 'b2b_delivery' ? '치과배송' : '환자배송'}] ${p.name}`;
          if (isEdit && existing.product_id === p.id) opt.selected = true;
          select.appendChild(opt);
        });
      }
    }).catch(err => console.error('Failed to load products for template', err));

    modal.querySelector('.dpt-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('.dpt-detail-edit')?.addEventListener('click', () => { modal.remove(); showPatientEditModal(pid, pt, parentEl); });
    modal.querySelector('.dpt-detail-issue')?.addEventListener('click', () => { modal.remove(); showCouponIssueModal(pid, pt.name); });
  }

  // ==================== 환자 수정 모달 ====================
  function showPatientEditModal(pid, pt, parentEl) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
      <h3 class="text-lg font-bold text-gray-800">환자 정보 수정</h3>
      <div class="space-y-3">
        <div><label class="block text-xs font-medium text-gray-500 mb-1">이름</label><input id="dpt-pe-name" value="${pt.name||''}" class="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1">차트번호</label><input id="dpt-pe-chart" value="${pt.chart_number||''}" placeholder="C-2024-0001" class="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-medium text-gray-500 mb-1">생년월일</label><input id="dpt-pe-birth" type="date" value="${pt.birth_date||''}" class="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1">연락처</label><input id="dpt-pe-phone" value="${pt.phone||''}" class="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
        </div>
        <div><label class="block text-xs font-medium text-gray-500 mb-1">이메일</label><input id="dpt-pe-email" value="${pt.email||''}" class="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
      </div>
      <div class="flex gap-2">
        <button id="dpt-pe-cancel" class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition">취소</button>
        <button id="dpt-pe-save" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">저장</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#dpt-pe-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#dpt-pe-save').addEventListener('click', async () => {
      const btn = modal.querySelector('#dpt-pe-save');
      btn.textContent = '저장 중...'; btn.disabled = true;
      try {
        await api(`/clinics/${state.currentClinic?.id}/patients/${pid}`, { method: 'PUT', body: JSON.stringify({
          name: modal.querySelector('#dpt-pe-name').value.trim() || null,
          chart_number: modal.querySelector('#dpt-pe-chart').value.trim() || null,
          birth_date: modal.querySelector('#dpt-pe-birth').value || null,
          phone: modal.querySelector('#dpt-pe-phone').value.trim() || null,
          email: modal.querySelector('#dpt-pe-email').value.trim() || null,
        })});
        toast('환자 정보가 수정되었습니다.'); modal.remove();
        if (parentEl) renderPatients(parentEl);
      } catch (e) { toast(e.message, 'error'); btn.textContent = '저장'; btn.disabled = false; }
    });
  }

  // ==================== 쿠폰 발행 모달 ====================
  async function showCouponIssueModal(patientId, patientName) {
    let templates = [];
    let patData = null;
    let activeCoupons = [];
    try {
      const [d, p] = await Promise.all([
        api(`/coupons/templates?clinic_id=${state.currentClinic?.id}`),
        api(`/clinics/${state.currentClinic?.id}/patients/${patientId}`)
      ]);
      templates = (d.templates || []).filter(t => t.status === 'active').map(t => ({ ...t, coupon_kind: t.coupon_kind || ((t.is_birthday == 1 || t.is_birthday === 'true') ? 'birthday' : 'general') }));
      patData = p.patient;
      activeCoupons = p.coupons || [];
    } catch {}
    
    const availPts = patData ? Number(patData.available_points || 0) : 0;
    
    const todayMD = new Date(Date.now() + 9*3600000).toISOString().substring(5, 10);
    const pBirth = patData ? patData.birth_date : '';
    const isPatBday = pBirth && pBirth.length >= 7 && pBirth.substring(5, 10) === todayMD;
    
    function canIssue(t) {
      // Check if already has active coupon of this template
      // Duplicates handled separately
      const isBdayCoupon = t.coupon_kind === 'birthday';
      if (isBdayCoupon) return isPatBday;
      const cost = t.required_points ? Number(t.required_points) : 0;
      return cost === 0 || availPts >= cost;
    }
    
    const canList = templates.filter(t => canIssue(t));
    const cantList = templates.filter(t => !canIssue(t));
    const sortedTpls = [...canList, ...cantList];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    
    let tplHtml = sortedTpls.map(t => {
      const alreadyIssued = activeCoupons.some(c => String(c.template_id) === String(t.id));
      const cost = t.required_points ? Number(t.required_points) : 0;
      const ok = canIssue(t);
      const isBday = t.coupon_kind === 'birthday';
      
      let badge = '';
      const kindBadge = isBday ? '<span class="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded mr-1">생일쿠폰</span>' : '<span class="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded mr-1">일반쿠폰</span>';
      
      if (alreadyIssued) {
         badge = `${kindBadge}<span class="text-red-500 font-bold">이미 발행됨 → 링크 전송</span>`;
      } else if (cost > 0) {
        if (isBday) {
          badge = isPatBday
            ? `${kindBadge}<span class="text-blue-600 font-medium">오늘 생일로 발행 가능</span>`
            : `${kindBadge}<span class="text-red-500 font-bold">생일 당일만 발행 가능</span>`;
        } else if (availPts >= cost) {
          badge = `${kindBadge}<span class="text-red-500 font-medium">${fmt(cost)}P 차감</span>`;
        } else {
          badge = `${kindBadge}<span class="text-red-500 font-bold">포인트 부족</span> <span class="text-gray-500 text-[10px]">(${fmt(cost)}P 필요)</span>`;
        }
      } else {
        badge = isBday
          ? (isPatBday
              ? `${kindBadge}<span class="text-blue-600 font-medium">오늘 생일로 무료 발행 가능</span>`
              : `${kindBadge}<span class="text-red-500 font-bold">생일 당일만 무료 발행 가능</span>`)
          : `${kindBadge}<span class="text-gray-500">포인트 차감 없음(무료)</span>`;
      }
      
      return `
        <div class="p-3 border rounded-lg flex justify-between items-center cursor-pointer transition dpt-issue-opt ${ok ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50' : 'opacity-50 bg-gray-50'}" data-id="${t.id}" data-ok="${ok ? '1' : '0'}" data-already="${alreadyIssued ? '1' : '0'}">
          <div>
            <div class="font-medium text-sm text-gray-800">${t.name}</div>
            <div class="text-[11px] mt-1">${badge}</div>
          </div>
          <div class="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 dpt-issue-radio flex items-center justify-center"></div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] flex flex-col">
      <div class="mb-4">
        <h3 class="text-lg font-bold text-gray-800">쿠폰 전송 / 발행</h3>
        <p class="text-xs text-gray-500 mt-1">${patientName} 환자 · 보유 쿠폰은 링크 전송, 미보유 쿠폰은 새 발행</p>
        <div class="mt-2 bg-blue-50 text-blue-700 text-sm px-3 py-2 rounded-lg font-medium">보유 포인트: ${fmt(availPts)}P</div>
      </div>
      <div class="flex-1 overflow-y-auto space-y-2 mb-4 dpt-scroll">
        ${sortedTpls.length === 0 ? '<p class="text-sm text-center py-4 text-gray-400">발행 가능한 쿠폰 템플릿이 없습니다.</p>' : tplHtml}
      </div>
      <div class="flex gap-2 shrink-0">
        <button id="dpt-issue-cancel" class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition">취소</button>
        <button id="dpt-issue-confirm" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition" disabled>선택 후 발행</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    
    let selectedTid = null;
    const confirmBtn = modal.querySelector('#dpt-issue-confirm');
    
    modal.querySelectorAll('.dpt-issue-opt').forEach(opt => {
      if (opt.dataset.already === '1') { 
         // Allow clicking but require confirmation later
      }
      if (opt.dataset.ok === '0') { opt.addEventListener('click', () => toast('포인트가 부족하여 선택할 수 없습니다.', 'error')); return; }
      opt.addEventListener('click', () => {
        modal.querySelectorAll('.dpt-issue-opt').forEach(o => {
          o.classList.remove('border-blue-500', 'bg-blue-50');
          o.classList.add('border-gray-200');
          const r = o.querySelector('.dpt-issue-radio');
          r.classList.remove('border-blue-500');
          r.classList.add('border-gray-300');
          r.innerHTML = '';
        });
        opt.classList.remove('border-gray-200');
        opt.classList.add('border-blue-500', 'bg-blue-50');
        const r = opt.querySelector('.dpt-issue-radio');
        r.classList.remove('border-gray-300');
        r.classList.add('border-blue-500');
        r.innerHTML = '<div class="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>';
        
        selectedTid = opt.dataset.id;
        confirmBtn.disabled = false;
        confirmBtn.textContent = '발행하기';
      });
    });
    
    // Auto-select removed to prevent accidental issue
    const confirmBtnRef = modal.querySelector('#dpt-issue-confirm');
    confirmBtnRef.disabled = true;
    confirmBtnRef.textContent = '선택 후 발행';

    modal.querySelector('#dpt-issue-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    confirmBtn.addEventListener('click', async () => {
      if (!selectedTid) return toast('쿠폰 템플릿을 선택하세요.', 'error');
      
      const selectedOpt = modal.querySelector('.dpt-issue-opt[data-id="' + selectedTid + '"]');
      if (selectedOpt && selectedOpt.dataset.already === '1') {
         // 이미 보유한 쿠폰 → 기존 쿠폰 링크 전송 OR 중복 발행 선택
         const ownedCoupon = activeCoupons.find(c => String(c.template_id) === String(selectedTid));
         if (ownedCoupon && ownedCoupon.code) {
           // 기존 쿠폰 링크 전송 모달 열기
           modal.remove();
           showCouponIssueModal_from_owned({
             code: ownedCoupon.code,
             template_name: ownedCoupon.template_name || ownedCoupon.name || '',
             patient_name: patientName,
             discount_type: ownedCoupon.discount_type,
             discount_value: ownedCoupon.discount_value,
             expires_at: ownedCoupon.expires_at,
             image_url: ownedCoupon.image_url || '',
           }, async () => {
             if (state.currentPage === 'dashboard') { renderDashboard(document.querySelector('#dpt-content')); } else { renderPatients(document.querySelector('#dpt-content')); }
           });
         } else {
           // 쿠폰 코드를 못 찾으면 중복 발행 확인
           showConfirmModal('이미 해당 환자가 보유하고 있는 (지급된) 쿠폰입니다.\n추가로 1장 더 중복 발행하시겠습니까?', async () => {
             confirmBtn.textContent = '발행 중...'; confirmBtn.disabled = true;
             try {
               const data = await api('/coupons/issue', { method: 'POST', body: JSON.stringify({ template_id: Number(selectedTid), clinic_id: state.currentClinic?.id, patient_id: Number(patientId), force_duplicate: true }) });
               modal.remove(); toast('쿠폰이 성공적으로 발행되었습니다.');
               if (state.currentPage === 'dashboard') { renderDashboard(document.querySelector('#dpt-content')); } else { renderPatients(document.querySelector('#dpt-content')); }
             } catch (e) { toast(e.message, 'error'); confirmBtn.textContent = '발행하기'; confirmBtn.disabled = false; }
           });
         }
         return;
      }
      
      confirmBtn.textContent = '발행 중...'; confirmBtn.disabled = true;
      try {
        const data = await api('/coupons/issue', { method: 'POST', body: JSON.stringify({ template_id: Number(selectedTid), clinic_id: state.currentClinic?.id, patient_id: Number(patientId), force_duplicate: true }) });
        modal.remove(); toast('쿠폰이 성공적으로 발행되었습니다.');
        if (state.currentPage === 'dashboard') { renderDashboard(document.querySelector('#dpt-content')); } else { renderPatients(document.querySelector('#dpt-content')); }
      } catch (e) { toast(e.message, 'error'); confirmBtn.textContent = '발행하기'; confirmBtn.disabled = false; }
    });
  }

  // ==================== 쿠폰 공유 모달 ====================
  function showCouponIssueModal_from_owned(coupon, onClose) {
    const shareUrl = `${API || window.location.origin}/coupon/${coupon.code}?v=${Date.now()}`;
    const shareText = `${getClinicName()}\n${coupon.patient_name || ''}님, ${coupon.template_name}이 발행되었습니다!\n${shareUrl}`;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
      <div class="bg-blue-600 text-white w-full text-center relative pt-8 pb-6">
        <div class="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span class="text-white text-2xl font-bold">&#10003;</span>
        </div>
        <h3 class="text-xl font-bold text-white mb-4">쿠폰 발행 완료!</h3>
        ${coupon.image_url ? `<div class="w-full bg-blue-600 mb-4 flex justify-center items-center"><img src="${coupon.image_url}" class="w-full object-cover" style="max-height: 200px;" onerror="this.style.display='none'" /></div>` : ''}
        <p class="text-xl font-bold text-white px-4 break-words">${coupon.template_name}</p>
      </div>
      <div class="p-6 space-y-4">
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p class="text-sm text-blue-600 font-semibold mb-1">${coupon.discount_type === 'fixed' ? fmt(coupon.discount_value) + '원' : coupon.discount_value + '%'} 할인 | ~${coupon.expires_at}</p>
          <p class="font-mono font-bold text-2xl text-blue-700 tracking-widest">${coupon.code}</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button id="dpt-share-copy" class="flex flex-col items-center justify-center gap-1 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer text-blue-700">
            <span class="text-xl">&#128203;</span><span class="text-xs font-semibold">링크 복사</span>
          </button>
          <button id="dpt-share-native" class="flex flex-col items-center justify-center gap-1 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer text-indigo-700">
            <span class="text-xl">&#8599;</span><span class="text-xs font-semibold">공유하기</span>
          </button>
        </div>
        <button id="dpt-share-close" class="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition mt-2">닫기</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#dpt-share-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(shareText); toast('링크가 복사되었습니다!'); }
      catch { const ta = document.createElement('textarea'); ta.value = shareText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('링크가 복사되었습니다!'); }
      api('/coupons/' + coupon.code + '/share', { method: 'POST' }).catch(()=>{});
      modal.remove();
      if(onClose) onClose();
    });
    modal.querySelector('#dpt-share-native').addEventListener('click', async () => {
      api('/coupons/' + coupon.code + '/share', { method: 'POST' }).catch(()=>{});
      if (navigator.share) { try { await navigator.share({ title: `${getClinicName()} 쿠폰`, text: shareText, url: shareUrl }); } catch {} }
      else { try { await navigator.clipboard.writeText(shareText); toast('쿠폰 내용이 복사되었습니다!'); } catch {} }
      modal.remove();
      if(onClose) onClose();
    });
    modal.querySelector('#dpt-share-close').addEventListener('click', () => { modal.remove(); if(onClose) onClose(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  // ==================== 쿠폰 관리 (수정/삭제/이미지 표시 추가) ====================
  // 쿠폰 검색 상태 변수
  let cpnSearchQ = '';
  let cpnStatusF = '';
  let cpnTemplateF = '';

  async function renderCoupons(el, keepFilters) {
    if (!keepFilters) { cpnSearchQ = ''; cpnStatusF = ''; cpnTemplateF = ''; }
    console.log('[DPT admin] renderCoupons: keepFilters=' + keepFilters + ' cpnSearchQ=' + cpnSearchQ + ' cpnStatusF=' + cpnStatusF + ' cpnTemplateF=' + cpnTemplateF);
    el.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    // ★ 버그 수정: 현재 클리닉이 로그인 계정에 속하는지 확인
    if (!state.currentClinic) {
      el.innerHTML = `<div class="text-center py-20 text-gray-400"><p>선택된 치과가 없습니다.</p></div>`;
      return;
    }
    try {
      // 서버사이드 검색: search, status, template_name 파라미터 전달
      let cpnUrl = `/coupons/clinic?clinic_id=${state.currentClinic?.id}&limit=200`;
      if (cpnSearchQ) cpnUrl += `&search=${encodeURIComponent(cpnSearchQ)}`;
      if (cpnStatusF) cpnUrl += `&status=${encodeURIComponent(cpnStatusF)}`;
      if (cpnTemplateF) cpnUrl += `&template_name=${encodeURIComponent(cpnTemplateF)}`;
      console.log('[DPT admin] API URL:', cpnUrl);
      const [couponData, tplData] = await Promise.all([
        api(cpnUrl),
        api(`/coupons/templates?clinic_id=${state.currentClinic?.id}`)
      ]);
      const cpns = couponData.coupons || [];
      const tpls = tplData.templates || [];
      const serverTemplateNames = couponData.template_names || []; /* 서버에서 모든 쿠폰 종류 목록 */
      console.log('[DPT admin] API result: cpns=' + cpns.length + ' total=' + couponData.total + ' total_all=' + couponData.total_all + ' templateNames=' + serverTemplateNames.length);
      
      // 검색어가 있는데 쿠폰 결과 0건 → 모달 알림
      if (cpnSearchQ && cpns.length === 0) {
        console.log('[DPT admin] SHOWING MODAL for: ' + cpnSearchQ);
        showAlertModal(
          `'${cpnSearchQ}' 님은 발행된 쿠폰이 없습니다`,
          '해당 환자에게 아직 쿠폰이 발행된 적이 없습니다.<br>환자관리 페이지에서 쿠폰을 발행해 주세요.',
          'warning'
        );
      }
      const sc = { active: 'bg-blue-100 text-blue-700', used: 'bg-transparent text-slate-800 text-sm font-bold', expired: 'bg-red-100 text-red-500', revoked: 'bg-yellow-100 text-yellow-600' };
      const sl = { active: '활성', used: '사용완료', expired: '만료', revoked: '회수' };
      const getStatusLabel = (c) => {
        if (c.status === 'active') return c.shared_at ? '지급(전송됨)' : '지급(미전송)';
        return sl[c.status] || c.status;
      };
      const getStatusClass = (c) => {
        if (c.status === 'active') return c.shared_at ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
        return sc[c.status] || '';
      };

      el.innerHTML = `
      <div class="dpt-fade-in space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800">쿠폰 관리</h2>
        </div>

        <!-- 쿠폰 템플릿 관리 섹션 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-semibold text-gray-800">쿠폰 템플릿</h3>
            <button id="dpt-cpn-new-tpl" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition">+ 새 템플릿</button>
          </div>
          <div class="space-y-3" id="dpt-tpl-list">
            ${tpls.length === 0 ? '<p class="text-center text-gray-400 text-sm py-4">등록된 쿠폰 템플릿이 없습니다.</p>' :
            tpls.map(t => `
            <div class="border ${t.status==='active'?'border-gray-200':'border-gray-100 opacity-60'} rounded-xl p-4 flex items-start gap-3">
              ${t.image_url ? `<img src="${t.image_url}" class="w-20 h-14 rounded-lg object-cover flex-shrink-0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-20 h-14 bg-gray-100 rounded-lg flex-shrink-0 items-center justify-center text-gray-400 text-xs hidden">NO IMG</div>` : '<div class="w-20 h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">NO IMG</div>'}
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-medium text-sm text-gray-800">${t.name}</p>
                    <p class="text-xs text-gray-400 mt-0.5">${t.discount_type==='fixed'?fmt(t.discount_value)+'원':t.discount_value+'%'} 할인 | 유효 ${t.valid_days || 90}일 | ${t.coupon_kind === 'birthday' ? '<span class="text-amber-600 font-medium">생일쿠폰</span>' : '<span class="text-slate-600 font-medium">일반쿠폰</span>'}${t.required_points > 0 ? ' | <span class="text-red-500 font-medium">' + fmt(t.required_points) + 'P 차감</span>' : ''}</p>
                    ${t.auto_issue_points ? `<p class="text-xs text-blue-500 mt-0.5">${fmt(t.auto_issue_points)}P 달성 시 자동발행</p>` : ''}
                    ${t.description ? `<p class="text-xs text-gray-400 mt-0.5">${t.description}</p>` : ''}
                    ${t.product_id ? `<p class="text-xs text-purple-600 mt-0.5 font-medium">🎁 쇼핑몰 상품 연동 (재고 차감)</p>` : ''}
                  </div>
                  <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span class="text-xs px-2 py-0.5 rounded-full ${t.status==='active'?'bg-blue-100 text-blue-600':'bg-gray-100 text-gray-400'}">${t.status==='active'?'활성':'비활성'}</span>
                    <button class="dpt-tpl-edit text-gray-400 hover:text-blue-600 text-xs" data-tid="${t.id}" data-tname="${(t.name||'').replace(/"/g,'&quot;')}" data-tdesc="${(t.description||'').replace(/"/g,'&quot;')}" data-timg="${t.image_url||''}" data-tdtype="${t.discount_type}" data-tdval="${t.discount_value}" data-tminpay="${t.min_payment||0}" data-tdays="${t.valid_days||90}" data-treq="${t.required_points||0}" data-tbday="${t.is_birthday||0}" data-tkind="${t.coupon_kind||'general'}" data-tauto="${t.auto_issue_points||''}" data-tstatus="${t.status}" data-tprod="${t.product_id||''}" data-tglobal="${t.is_global||0}" data-tglobalact="${t.is_global_activated||0}">수정</button>
                    <button class="dpt-tpl-del text-gray-400 hover:text-red-500 text-xs" data-tid="${t.id}" data-tname="${(t.name||'').replace(/"/g,'&quot;')}" data-tglobal="${t.is_global||0}" data-tglobalact="${t.is_global_activated||0}">삭제</button>
                  </div>
                </div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <!-- 발행된 쿠폰 목록 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
          <div class="px-5 py-4 border-b border-gray-100">
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-semibold text-gray-800">발행된 쿠폰 <span class="text-blue-600">${couponData.total_all || 0}</span>건</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              <select id="dpt-cpn-filter" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" style="max-width:100%">
                <option value="">모든 쿠폰</option>
                ${(serverTemplateNames.length > 0 ? serverTemplateNames : Array.from(new Set([...tpls.map(t => t.name), ...cpns.map(c => c.template_name)].filter(Boolean)))).map(name => `<option value="${name.replace(/"/g, '&quot;')}"${cpnTemplateF === name ? ' selected' : ''}>${name}</option>`).join('')}
              </select>
              <select id="dpt-cpn-status-filter" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value=""${cpnStatusF===''?' selected':''}>모든 상태</option>
                <option value="active"${cpnStatusF==='active'?' selected':''}>활성</option>
                <option value="unshared"${cpnStatusF==='unshared'?' selected':''}>미전송</option>
                <option value="used"${cpnStatusF==='used'?' selected':''}>사용완료</option>
                <option value="expired"${cpnStatusF==='expired'?' selected':''}>만료</option>
                <option value="revoked"${cpnStatusF==='revoked'?' selected':''}>회수</option>
              </select>
              <input type="text" id="dpt-cpn-search" placeholder="환자명 검색" value="${(cpnSearchQ||'').replace(/"/g,'&quot;')}" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[120px]" />
              <button id="dpt-cpn-search-btn" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">검색</button>
            </div>
            ${(cpnSearchQ || cpnStatusF || cpnTemplateF) ? `<div class="mt-2 text-xs text-gray-500">검색 결과: ${couponData.total || 0}건 / 전체 ${couponData.total_all || 0}건</div>` : ''}
          </div>
          <div class="overflow-x-auto max-h-[500px] overflow-y-auto" style="min-height: 280px; padding-bottom: 80px;">
            <table class="w-full text-sm" style="word-break:keep-all;table-layout:auto;">
              <thead class="bg-gray-50 sticky top-0 shadow-sm z-10">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">쿠폰</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">환자</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">코드</th>
                  <th class="text-center px-4 py-3 font-semibold text-gray-600">상태</th>
                  <th class="text-left px-4 py-3 font-semibold text-gray-600">만료일</th>
                  <th class="text-center px-4 py-3 font-semibold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${cpns.length === 0 ? '<tr><td colspan="6" class="p-8 text-center">' + (cpnSearchQ ? '<div class="inline-flex flex-col items-center gap-2 py-4"><div class="text-3xl">⚠️</div><div class="text-base font-bold text-red-600">\'' + cpnSearchQ + '\' 님은 발행된 쿠폰이 없습니다</div><div class="text-sm text-gray-500">해당 환자에게 아직 쿠폰이 발행된 적이 없습니다.</div><div class="text-xs text-gray-400 mt-1">환자관리 페이지에서 쿠폰을 발행해 주세요.</div></div>' : (cpnStatusF || cpnTemplateF) ? '<div class="text-gray-400">해당 조건의 쿠폰이 없습니다.</div>' : '<div class="text-gray-400">발행된 쿠폰이 없습니다.</div>') + '</td></tr>' :
                cpns.map(c => `
                <tr class="hover:bg-gray-50 dpt-cpn-row" data-pname="${c.patient_name}" data-tname="${c.template_name}">
                  <td class="px-4 py-3" style="word-break:keep-all;white-space:normal;"><p class="font-medium text-gray-800" style="word-break:keep-all;">${c.template_name}</p><p class="text-xs text-gray-400">${c.discount_type === 'fixed' ? fmt(c.discount_value) + '원' : c.discount_value + '%'} 할인 | ${c.coupon_kind === 'birthday' ? '<span class="text-amber-600 font-medium">생일쿠폰</span>' : '<span class="text-slate-600 font-medium">일반쿠폰</span>'}</p></td>
                  <td class="px-4 py-3"><p class="text-gray-800 font-medium">${c.patient_name}</p><p class="text-xs text-gray-400 mt-0.5">${c.patient_phone || '-'}</p></td>
                  <td class="px-4 py-3 font-mono text-xs text-blue-600 font-medium">${c.code}</td>
                  <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-[10px] font-medium ${getStatusClass(c)}">${getStatusLabel(c)}</span></td>
                  <td class="px-4 py-3 text-gray-500 text-xs">${c.expires_at}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    ${c.status === 'active' ? `
                      ${!c.shared_at ? `<button class="dpt-cpn-share text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs mr-1 transition" data-code="${c.code}" data-name="${(c.template_name||'').replace(/"/g,'&quot;')}" data-patient="${(c.patient_name||'').replace(/"/g,'&quot;')}" data-dtype="${c.discount_type}" data-dval="${c.discount_value}" data-expires="${c.expires_at}">공유</button>` : ''}
                      <button class="dpt-cpn-revoke text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs transition" data-code="${c.code}" data-name="${(c.template_name||'').replace(/"/g,'&quot;')}" data-patient="${(c.patient_name||'').replace(/"/g,'&quot;')}">회수</button>
                    ` : `
                      <button class="dpt-del-coupon-direct text-gray-500 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-medium transition" data-cid="${c.id}" data-cname="${(c.template_name||'').replace(/"/g,'&quot;')}">삭제</button>
                    `}
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

      // 이벤트 바인딩
      el.querySelector('#dpt-cpn-new-tpl')?.addEventListener('click', () => showTemplateModal(null, el));

      // 쿠폰 서버사이드 검색 (필터 변경 시 API 재호출)
      const cpnSearchBtn = el.querySelector('#dpt-cpn-search-btn');
      const cpnSearchInput = el.querySelector('#dpt-cpn-search');
      const cpnFilter = el.querySelector('#dpt-cpn-filter');
      const cpnStatusFilter = el.querySelector('#dpt-cpn-status-filter');
      // 검색 버튼/엔터: 검색어 적용 (드롭다운 초기화 후 검색)
      const doTextSearch = async () => {
        const q = (cpnSearchInput?.value || '').trim();
        console.log('[DPT admin] doTextSearch q=' + q);
        if (!q) { cpnSearchQ = ''; cpnTemplateF = ''; cpnStatusF = ''; renderCoupons(el, true); return; }
        cpnSearchQ = q;
        cpnTemplateF = '';
        cpnStatusF = '';
        await renderCoupons(el, true);
      };
      // 드롭다운 변경: 검색어 초기화 (input value도 함께 클리어)
      const doFilterChange = () => {
        cpnSearchQ = '';
        if (cpnSearchInput) cpnSearchInput.value = '';
        cpnTemplateF = cpnFilter?.value || '';
        cpnStatusF = cpnStatusFilter?.value || '';
        renderCoupons(el, true);
      };
      if (cpnSearchBtn) cpnSearchBtn.addEventListener('click', doTextSearch);
      if (cpnSearchInput) cpnSearchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') doTextSearch(); });
      if (cpnFilter) cpnFilter.addEventListener('change', doFilterChange);
      if (cpnStatusFilter) cpnStatusFilter.addEventListener('change', doFilterChange);


      el.onclick = async (e) => {
        // 템플릿 수정
        const editBtn = e.target.closest('.dpt-tpl-edit');
        if (editBtn) {
          const t = {
            id: editBtn.dataset.tid,
            name: editBtn.dataset.tname,
            description: editBtn.dataset.tdesc,
            image_url: editBtn.dataset.timg,
            discount_type: editBtn.dataset.tdtype,
            discount_value: editBtn.dataset.tdval,
            min_payment: editBtn.dataset.tminpay,
            valid_days: editBtn.dataset.tdays,
            required_points: editBtn.dataset.treq,
            is_birthday: editBtn.dataset.tbday == '1' || editBtn.dataset.tbday === 'true',
            coupon_kind: editBtn.dataset.tkind || ((editBtn.dataset.tbday == '1' || editBtn.dataset.tbday === 'true') ? 'birthday' : 'general'),
            auto_issue_points: editBtn.dataset.tauto,
            status: editBtn.dataset.tstatus,
            is_global: editBtn.dataset.tglobal == '1',
            is_global_activated: editBtn.dataset.tglobalact == '1',
          };
          showTemplateModal(t, el);
          return;
        }
        // 템플릿 삭제
        const delBtn = e.target.closest('.dpt-tpl-del');
        if (delBtn) {
          const isGlobalTpl = delBtn.dataset.tglobal == '1';
          showConfirmModal(`'${delBtn.dataset.tname}' 템플릿을 비활성화하시겠습니까?`, async () => {
            try {
              if (isGlobalTpl) {
                await api('/coupons/templates/deactivate-global', { method: 'POST', body: JSON.stringify({ clinic_id: state.currentClinic?.id, global_template_id: delBtn.dataset.tid }) });
              } else {
                await api(`/coupons/templates/${delBtn.dataset.tid}`, { method: 'DELETE' });
              }
              toast('템플릿이 비활성화되었습니다.');
              renderCoupons(el);
            } catch (err) { toast(err.message, 'error'); }
          });
          return;
          try {
            await api(`/coupons/templates/${delBtn.dataset.tid}`, { method: 'DELETE' });
            toast('템플릿이 비활성화되었습니다.');
            renderCoupons(el);
          } catch (err) { toast(err.message, 'error'); }
          return;
        }
        // 쿠폰 공유
        const shareBtn = e.target.closest('.dpt-cpn-share');
        if (shareBtn) {
          showCouponIssueModal_from_owned({
            code: shareBtn.dataset.code,
            template_name: shareBtn.dataset.name,
            patient_name: shareBtn.dataset.patient,
            discount_type: shareBtn.dataset.dtype,
            discount_value: shareBtn.dataset.dval,
            expires_at: shareBtn.dataset.expires,
          });
          return;
        }
        // 쿠폰 직접 삭제 (쿠폰관리 탭)
        const delDirectBtn = e.target.closest('.dpt-del-coupon-direct');
        if (delDirectBtn) {
          showConfirmModal(`'${delDirectBtn.dataset.cname}' 쿠폰 기록을 삭제하시겠습니까?`, async () => {
            try {
              await api(`/coupons/${delDirectBtn.dataset.cid}`, { method: 'DELETE' });
              toast('쿠폰 기록이 삭제되었습니다.');
              renderCoupons(el);
            } catch (err) { toast(err.message, 'error'); }
          });
          return;
          try {
            await api(`/coupons/${delDirectBtn.dataset.cid}`, { method: 'DELETE' });
            toast('쿠폰 기록이 삭제되었습니다.');
            renderCoupons(el);
          } catch (err) { toast(err.message, 'error'); }
          return;
        }
        // 쿠폰 회수
        const revokeBtn = e.target.closest('.dpt-cpn-revoke');
        if (revokeBtn) {
          showConfirmModal(`${revokeBtn.dataset.patient}님의 '${revokeBtn.dataset.name}' 쿠폰을 회수하시겠습니까?`, async () => {
            try {
              await api(`/coupons/${revokeBtn.dataset.code}/revoke`, { method: 'POST' });
              toast('쿠폰이 회수되었습니다.');
              renderCoupons(el);
            } catch (err) { toast(err.message, 'error'); }
          });
          return;
          try {
            await api(`/coupons/${revokeBtn.dataset.code}/revoke`, { method: 'POST' });
            toast('쿠폰이 회수되었습니다.');
            renderCoupons(el);
          } catch (err) { toast(err.message, 'error'); }
        }
      };
    } catch (e) { el.innerHTML = `<p class="text-red-500 text-center py-10">${e.message}</p>`; }
  }

  // ==================== 대량 업로드 ====================
  function renderBulkUpload(el) {
    el.innerHTML = `
    <div class="dpt-fade-in space-y-6 max-w-3xl">
      <h2 class="text-xl font-bold text-gray-800">대량 업로드</h2>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <h3 class="font-semibold text-gray-800 mb-2">STEP 1: 엑셀 템플릿 다운로드</h3>
          <p class="text-sm text-gray-500 mb-3">양식에 맞게 데이터를 입력한 후 업로드하세요.</p>
          <button id="dpt-bulk-download-tpl" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition">엑셀 템플릿 다운로드</button>
        </div>
        <hr class="border-gray-100">
        <div>
          <h3 class="font-semibold text-gray-800 mb-2">STEP 2: 파일 업로드</h3>
          <div id="dpt-bulk-dropzone" class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
            <p class="text-sm text-gray-500">파일을 드래그하거나 클릭하세요</p>
            <p class="text-xs text-gray-400 mt-1">.xlsx, .csv (최대 5MB, 5000행)</p>
            <input type="file" id="dpt-bulk-file" accept=".xlsx,.csv" class="hidden" />
          </div>
        </div>
        <div id="dpt-bulk-validation" class="hidden space-y-4"><hr class="border-gray-100"><h3 class="font-semibold text-gray-800">STEP 3: 검증 결과</h3><div id="dpt-bulk-validation-content"></div></div>
      </div>
    </div>`;

    $('#dpt-bulk-download-tpl').addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return toast('엑셀 라이브러리 로딩 중입니다.', 'warning');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['이름','차트번호','생년월일','연락처','진료내용','결제금액'],['박환자','C-2024-0001','1985-03-15','010-1234-5678','임플란트',3000000],['최환자','C-2024-0002','1990-07-22','010-9876-5432','충치치료',800000],['정환자','','','010-5555-1234','','']]);
      ws['!cols'] = [{wch:10},{wch:16},{wch:12},{wch:15},{wch:14},{wch:14}];
      XLSX.utils.book_append_sheet(wb, ws, '환자+결제');
      XLSX.writeFile(wb, '치과포인트_업로드템플릿.xlsx');
      toast('템플릿이 다운로드되었습니다.');
    });

    const dz = $('#dpt-bulk-dropzone'), fi = $('#dpt-bulk-file');
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('border-blue-400','bg-blue-50'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('border-blue-400','bg-blue-50'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('border-blue-400','bg-blue-50'); if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]); });
    fi.addEventListener('change', (e) => { if (e.target.files.length) processFile(e.target.files[0]); });

    function processFile(file) {
      if (typeof XLSX === 'undefined') return toast('엑셀 라이브러리 로딩 중...', 'warning');
      dz.innerHTML = `<div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div><p class="text-sm text-blue-600">${file.name} 분석 중...</p>`;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          if (rawData.length < 2) throw new Error('데이터가 없습니다.');
          const rows = rawData.slice(1).filter(r => r.some(c => c != null && c !== ''));
          const parsed = [], errors = [];
          rows.forEach((row, idx) => {
            const obj = { name: String(row[0]||'').trim(), chart_number: String(row[1]||'').trim(), birth_date: row[2] ? fmtExcelDate(row[2]) : '', phone: String(row[3]||'').trim(), treatment: String(row[4]||'').trim(), payment_amount: Number(String(row[5]||'').replace(/,/g, '')) || 0 };
            if (!obj.name) errors.push({ row: idx+2, error: '이름 누락' });
            
            else parsed.push(obj);
          });
          showValidation(parsed, errors, file.name);
        } catch (err) { toast('파일 분석 실패: ' + err.message, 'error'); renderBulkUpload(el); }
      };
      reader.readAsArrayBuffer(file);
    }
    function fmtExcelDate(v) { if (typeof v === 'number') { const d = new Date((v - 25569) * 86400000); return d.toISOString().split('T')[0]; } return String(v).split('T')[0]; }
    function showValidation(parsed, errors, fn) {
      dz.innerHTML = `<p class="text-sm font-medium text-gray-700">${fn}</p><p class="text-xs text-gray-400">${parsed.length + errors.length}행 분석 완료</p>`;
      const vDiv = $('#dpt-bulk-validation'), cDiv = $('#dpt-bulk-validation-content');
      vDiv.classList.remove('hidden');
      cDiv.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-4 space-y-2">
          <div class="flex justify-between text-sm"><span class="text-blue-600">정상</span><strong>${parsed.length}건</strong></div>
          <div class="flex justify-between text-sm"><span class="text-gray-500">- 결제 포함</span><span>${parsed.filter(r=>r.payment_amount>0).length}건</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-500">- 환자만 등록</span><span>${parsed.filter(r=>!r.payment_amount).length}건</span></div>
          ${errors.length > 0 ? `<div class="flex justify-between text-sm"><span class="text-red-500">에러</span><strong>${errors.length}건</strong></div>` : ''}
        </div>
        <div class="mt-3 overflow-x-auto border border-gray-200 rounded-lg max-h-60">
          <table class="w-full text-left border-collapse min-w-max">
            <thead class="bg-gray-50 text-xs font-semibold text-gray-600 sticky top-0 shadow-sm">
              <tr>
                <th class="px-3 py-2 border-b">이름</th>
                <th class="px-3 py-2 border-b">차트번호</th>
                <th class="px-3 py-2 border-b">연락처</th>
                <th class="px-3 py-2 border-b">진료과목</th>
                <th class="px-3 py-2 border-b text-right">결제금액</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-xs text-gray-700">
              ${parsed.slice(0, 50).map(r => `
                <tr>
                  <td class="px-3 py-2">${r.name}</td>
                  <td class="px-3 py-2">${r.chart_number || '-'}</td>
                  <td class="px-3 py-2">${r.phone || '-'}</td>
                  <td class="px-3 py-2 font-medium text-blue-600">${r.treatment || '-'}</td>
                  <td class="px-3 py-2 text-right">${r.payment_amount ? r.payment_amount.toLocaleString()+'원' : '-'}</td>
                </tr>
              `).join('')}
              ${parsed.length > 50 ? `<tr><td colspan="5" class="px-3 py-2 text-center text-gray-400 bg-gray-50">...외 ${parsed.length - 50}건 생략됨</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        ${errors.length > 0 ? `<div class="mt-3 bg-red-50 rounded-lg p-3"><p class="text-sm text-red-600 font-semibold mb-2">에러 상세:</p>${errors.map(e=>`<p class="text-xs text-red-500">행 ${e.row}: ${e.error}</p>`).join('')}</div>` : ''}
        <div class="flex gap-2 mt-4">
          <button id="dpt-bulk-process" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">정상 ${parsed.length}건 처리하기</button>
          <button id="dpt-bulk-cancel" class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition">취소</button>
        </div>`;
      cDiv.querySelector('#dpt-bulk-cancel')?.addEventListener('click', () => renderBulkUpload(el));
      cDiv.querySelector('#dpt-bulk-process')?.addEventListener('click', function() {
        const btn = cDiv.querySelector('#dpt-bulk-process');
        if(!btn) return;
        btn.disabled = true;
        btn.textContent = '업로드 시작 중...';
        
        const chunkSize = 500;
        const chunks = [];
        for (let i = 0; i < parsed.length; i += chunkSize) {
          chunks.push(parsed.slice(i, i + chunkSize));
        }
        
        let totalSuccess = 0;
        let totalError = 0;
        let c = 0;
        
        function uploadNextChunk() {
          if (c >= chunks.length) {
            toast(`${totalSuccess}건 처리 완료!` + (totalError > 0 ? ` (중복/실패 ${totalError}건)` : ''));
            nav('patients');
            return;
          }
          
          const startProcessed = c * chunkSize;
          const currentProcessed = Math.min((c + 1) * chunkSize, parsed.length);
          
          let displayCount = startProcessed;
          
          const setBtnText = (txt, num) => {
            btn.innerHTML = `<span style="display:inline-block; min-width:180px; text-align:center; font-variant-numeric:tabular-nums;">${txt} (${num} / ${parsed.length})</span>`;
          };
          
          setBtnText('데이터 전송 준비', displayCount);
          
          const interval = setInterval(() => {
            if (displayCount < currentProcessed - 5) {
              displayCount += Math.floor(Math.random() * 15) + 5; 
              if (displayCount >= currentProcessed) displayCount = currentProcessed - 1;
              setBtnText('데이터 전송 중', displayCount);
            } else {
              setBtnText('데이터 저장 중', currentProcessed);
            }
          }, 80);
          
          api('/payments/bulk', { method: 'POST', body: JSON.stringify({ clinic_id: state.currentClinic?.id, rows: chunks[c] }) })
          .then(res => {
            clearInterval(interval);
            setBtnText('저장 완료', currentProcessed);
            totalSuccess += (res.success_count || 0);
            totalError += (res.error_count || 0);
            c++;
            setTimeout(uploadNextChunk, 10);
          })
          .catch(err => {
            clearInterval(interval);
            toast(err.message, 'error');
            btn.textContent = '업로드 실패. 다시 시도';
            btn.disabled = false;
          });
        }
        
        uploadNextChunk();
      });
    }
  }

  // ==================== 설정 (치과정보 편집 가능, DB에서 자동 로드) ====================
  async function renderSettings(el) {
    el.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    try {
      const data = await api(`/clinics/${state.currentClinic?.id}`);
      const clinic = data.clinic, settings = data.settings || {};
      const categoryRates = settings.category_rates || [];
      const tplData = await api(`/coupons/templates?clinic_id=${state.currentClinic?.id}`);
      const templates = tplData.templates || [];

      el.innerHTML = `
      <div class="dpt-fade-in space-y-6 max-w-3xl">
        <h2 class="text-xl font-bold text-gray-800">설정</h2>

        <!-- 치과 정보 (편집 가능 - DB에서 자동 로드) -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 class="font-semibold text-gray-800">치과 정보</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="block text-xs font-medium text-gray-500 mb-1">치과명</label><input id="dpt-ci-name" value="${clinic.name || ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label class="block text-xs font-medium text-gray-500 mb-1">전화번호</label><input id="dpt-ci-phone" value="${clinic.phone || ''}" placeholder="02-1234-5678" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div class="md:col-span-2"><label class="block text-xs font-medium text-gray-500 mb-1">주소</label><input id="dpt-ci-addr" value="${clinic.address || ''}" placeholder="서울시 강남구..." class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label class="block text-xs font-medium text-gray-500 mb-1">사업자번호</label><input id="dpt-ci-biz" value="${clinic.business_number || ''}" placeholder="123-45-67890" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label class="block text-xs font-medium text-gray-500 mb-1">담당자</label><input id="dpt-ci-manager" value="${state.member.name || ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          </div>
          ${state.imwebClinicName ? `<div class="bg-blue-50 rounded-lg p-3"><p class="text-xs text-blue-600">아임웹 연동 치과명: <strong>${state.imwebClinicName}</strong></p></div>` : ''}
          <button id="dpt-ci-save" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">치과 정보 저장</button>
        </div>

        <!-- 포인트 설정 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 class="font-semibold text-gray-800">포인트 설정</h3>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-medium text-gray-500 mb-1">기본 적립율</label><div class="flex items-center gap-2"><input type="number" id="dpt-set-rate" value="${settings.default_point_rate||5}" step="0.1" class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /><span class="text-sm text-gray-500">%</span></div></div>
            <div><label class="block text-xs font-medium text-gray-500 mb-1">포인트 유효기간</label><div class="flex items-center gap-2"><input type="number" id="dpt-set-expiry" value="${settings.point_expiry_days||365}" class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /><span class="text-sm text-gray-500">일</span></div></div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-2">진료항목별 적립율</label>
            <div id="dpt-category-list" class="space-y-2">
              ${categoryRates.map(cr => `<div class="flex items-center gap-2 dpt-cat-row"><input type="text" value="${cr.category}" class="dpt-cat-name flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="항목명" /><input type="number" value="${cr.rate}" step="0.1" class="dpt-cat-rate w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="%" /><span class="text-sm text-gray-500">%</span><button class="dpt-cat-remove text-red-400 hover:text-red-600 text-sm px-1">&#10005;</button></div>`).join('')}
            </div>
            <button id="dpt-add-category" class="mt-2 text-sm text-blue-600 hover:text-blue-700">+ 항목 추가</button>
          </div>
          <button id="dpt-save-settings" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">포인트 설정 저장</button>
        </div>

        <!-- 쿠폰 자동 발행 규칙 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 class="font-semibold text-gray-800">쿠폰 자동 발행 규칙</h3>
          <p class="text-xs text-gray-500">환자의 누적 포인트가 설정한 기준에 도달하면 쿠폰이 자동으로 발행됩니다.</p>
          <div id="dpt-auto-rules-list" class="space-y-3">
            ${(settings.coupon_auto_rules || []).map((rule, idx) => {
              const tpl = templates.find(t => t.id === rule.template_id);
              return `
              <div class="flex items-center gap-3 dpt-auto-rule-row bg-gray-50 rounded-lg p-3" data-idx="${idx}">
                <div class="flex-1">
                  <select class="dpt-rule-template w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">쿠폰 템플릿 선택</option>
                    ${templates.filter(t=>t.status==='active').map(t => `<option value="${t.id}" ${t.id === rule.template_id ? 'selected' : ''}>${t.name} (${t.discount_type==='fixed'?fmt(t.discount_value)+'원':t.discount_value+'%'})</option>`).join('')}
                  </select>
                </div>
                <div class="flex items-center gap-1">
                  <input type="number" class="dpt-rule-points w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right" value="${rule.min_points || ''}" placeholder="100000" />
                  <span class="text-sm text-gray-500 whitespace-nowrap">P 이상</span>
                </div>
                <button class="dpt-rule-remove text-red-400 hover:text-red-600 text-lg px-1">&#10005;</button>
              </div>`;
            }).join('')}
          </div>
          <button id="dpt-add-auto-rule" class="text-sm text-blue-600 hover:text-blue-700">+ 규칙 추가</button>
          <button id="dpt-save-auto-rules" class="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">자동 발행 규칙 저장</button>
        </div>

        <!-- 일괄 자동발행 실행 -->
        <div class="bg-white rounded-xl shadow-sm border border-orange-100 p-6 space-y-4">
          <h3 class="font-semibold text-gray-800">🚀 일괄 자동발행 실행</h3>
          <p class="text-xs text-gray-500">포인트 조건을 충족하지만 아직 쿠폰이 발행되지 않은 환자들에게 일괄로 쿠폰을 자동 발행합니다.</p>
          <div class="flex items-center gap-3">
            <select id="dpt-bulk-auto-tpl" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
              <option value="">쿠폰 템플릿 선택</option>
              ${templates.filter(t => t.status === 'active' && (t.auto_issue_points > 0 || t.required_points > 0)).map(t => 
                '<option value="' + t.id + '">' + t.name + ' (' + fmt(t.auto_issue_points || t.required_points) + 'P 이상)</option>'
              ).join('')}
            </select>
            <button id="dpt-bulk-auto-run" class="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap">일괄 발행 실행</button>
          </div>
          <div id="dpt-bulk-auto-result" class="hidden bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800"></div>
        </div>

        <!-- 쿠폰 템플릿 미리보기 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-semibold text-gray-800">쿠폰 템플릿</h3>
            <button id="dpt-add-template" class="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg text-xs font-medium transition">+ 새 템플릿</button>
          </div>
          <div id="dpt-template-list" class="space-y-3">
            ${templates.map(t => `
            <div class="border border-gray-200 rounded-lg p-4 flex items-start gap-3 ${t.status==='inactive'?'opacity-50':''}">
              ${t.image_url ? `<img src="${t.image_url}" class="w-20 h-14 rounded-lg object-cover flex-shrink-0" onerror="this.style.display='none'" />` : '<div class="w-20 h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">NO IMG</div>'}
              <div class="flex-1">
                <p class="font-medium text-sm text-gray-800">${t.name}</p>
                <p class="text-xs text-gray-400">${t.discount_type==='fixed'?fmt(t.discount_value)+'원':t.discount_value+'%'} 할인 | 유효 ${t.valid_days}일 | ${t.coupon_kind === 'birthday' ? '<span class="text-amber-600 font-medium">생일쿠폰</span>' : '<span class="text-slate-600 font-medium">일반쿠폰</span>'}${t.required_points > 0 ? ' | <span class="text-red-500 font-medium">' + fmt(t.required_points) + 'P 차감</span>' : ''}</p>
                ${t.auto_issue_points ? `<p class="text-xs text-blue-500 mt-1">${fmt(t.auto_issue_points)}P 달성 시 자동발행</p>` : ''}
              </div>
              <span class="text-xs px-2 py-1 rounded ${t.status==='active'?'bg-blue-100 text-blue-600':'bg-gray-100 text-gray-400'}">${t.status==='active'?'활성':'비활성'}</span>
            </div>`).join('')}
            ${templates.length === 0 ? '<p class="text-center text-gray-400 text-sm py-4">등록된 쿠폰 템플릿이 없습니다.</p>' : ''}
          </div>
        </div>
      </div>`;

      // 치과정보 저장
      $('#dpt-ci-save').addEventListener('click', async () => {
        const btn = $('#dpt-ci-save'); btn.textContent = '저장 중...'; btn.disabled = true;
        try {
          // 치과 정보 저장
          await api(`/clinics/${state.currentClinic?.id}`, { method: 'PUT', body: JSON.stringify({
            name: $('#dpt-ci-name').value.trim() || null,
            phone: $('#dpt-ci-phone').value.trim() || null,
            address: $('#dpt-ci-addr').value.trim() || null,
            business_number: $('#dpt-ci-biz').value.trim() || null,
          })});
          // 담당자 이름 저장
          const managerName = $('#dpt-ci-manager').value.trim();
          if (managerName) {
            await api('/auth/me', { method: 'PUT', body: JSON.stringify({ name: managerName }) });
            state.member.name = managerName;
            localStorage.setItem('dpt_admin_member', JSON.stringify(state.member));
          }
          // currentClinic 이름 업데이트
          const newName = $('#dpt-ci-name').value.trim();
          if (newName && state.currentClinic) {
            state.currentClinic.name = newName;
            localStorage.setItem('dpt_admin_current_clinic', JSON.stringify(state.currentClinic));
          }
          toast('치과 정보가 저장되었습니다!');
          btn.textContent = '치과 정보 저장'; btn.disabled = false;
        } catch (e) { toast(e.message, 'error'); btn.textContent = '치과 정보 저장'; btn.disabled = false; }
      });

      // 진료항목 추가/삭제
      $('#dpt-add-category').addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 dpt-cat-row';
        row.innerHTML = `<input type="text" class="dpt-cat-name flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="항목명" /><input type="number" step="0.1" class="dpt-cat-rate w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="%" /><span class="text-sm text-gray-500">%</span><button class="dpt-cat-remove text-red-400 hover:text-red-600 text-sm px-1">&#10005;</button>`;
        $('#dpt-category-list').appendChild(row);
      });
      el.onclick = (e) => { const btn = e.target.closest('.dpt-cat-remove'); if (btn) btn.closest('.dpt-cat-row').remove(); };

      // 포인트 설정 저장
      $('#dpt-save-settings').addEventListener('click', async () => {
        const cats = [];
        document.querySelectorAll('.dpt-cat-row').forEach(row => {
          const n = row.querySelector('.dpt-cat-name').value.trim(), r = Number(row.querySelector('.dpt-cat-rate').value);
          if (n && r > 0) cats.push({ category: n, rate: r });
        });
        const btn = $('#dpt-save-settings'); btn.textContent = '저장 중...'; btn.disabled = true;
        try {
          await api(`/clinics/${state.currentClinic?.id}/settings`, { method: 'PUT', body: JSON.stringify({ default_point_rate: Number($('#dpt-set-rate').value), point_expiry_days: Number($('#dpt-set-expiry').value), category_rates: cats }) });
          toast('포인트 설정이 저장되었습니다!');
          btn.textContent = '포인트 설정 저장'; btn.disabled = false;
        } catch (e) { toast(e.message, 'error'); btn.textContent = '포인트 설정 저장'; btn.disabled = false; }
      });

      // 새 템플릿
      $('#dpt-add-template').addEventListener('click', () => showTemplateModal(null, el));

      // 자동 발행 규칙 추가
      $('#dpt-add-auto-rule')?.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 dpt-auto-rule-row bg-gray-50 rounded-lg p-3';
        row.innerHTML = `
          <div class="flex-1">
            <select class="dpt-rule-template w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">쿠폰 템플릿 선택</option>
              ${templates.filter(t=>t.status==='active').map(t => `<option value="${t.id}">${t.name} (${t.discount_type==='fixed'?fmt(t.discount_value)+'원':t.discount_value+'%'})</option>`).join('')}
            </select>
          </div>
          <div class="flex items-center gap-1">
            <input type="number" class="dpt-rule-points w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right" placeholder="100000" />
            <span class="text-sm text-gray-500 whitespace-nowrap">P 이상</span>
          </div>
          <button class="dpt-rule-remove text-red-400 hover:text-red-600 text-lg px-1">&#10005;</button>`;
        $('#dpt-auto-rules-list').appendChild(row);
      });
      el.onclick = (e) => { const btn = e.target.closest('.dpt-rule-remove'); if (btn) btn.closest('.dpt-auto-rule-row').remove(); };

      // 자동 발행 규칙 저장
      $('#dpt-save-auto-rules')?.addEventListener('click', async () => {
        const rules = [];
        document.querySelectorAll('.dpt-auto-rule-row').forEach(row => {
          const tid = Number(row.querySelector('.dpt-rule-template').value);
          const pts = Number(row.querySelector('.dpt-rule-points').value);
          if (tid && pts > 0) rules.push({ template_id: tid, min_points: pts });
        });
        const btn = $('#dpt-save-auto-rules'); btn.textContent = '저장 중...'; btn.disabled = true;
        try {
          await api(`/clinics/${state.currentClinic?.id}/settings`, { method: 'PUT', body: JSON.stringify({ coupon_auto_rules: rules }) });
          toast('자동 발행 규칙이 저장되었습니다!');
          btn.textContent = '자동 발행 규칙 저장'; btn.disabled = false;
        } catch (e) { toast(e.message, 'error'); btn.textContent = '자동 발행 규칙 저장'; btn.disabled = false; }
      });

      // 일괄 자동발행 실행 버튼
      $('#dpt-bulk-auto-run')?.addEventListener('click', async () => {
        const tplSelect = $('#dpt-bulk-auto-tpl');
        const resultDiv = $('#dpt-bulk-auto-result');
        if (!tplSelect || !tplSelect.value) return toast('쿠폰 템플릿을 선택하세요.', 'error');
        
        const btn = $('#dpt-bulk-auto-run');
        const tplId = tplSelect.value;
        const tplName = tplSelect.options[tplSelect.selectedIndex]?.text || '';
        
        showConfirmModal(`'${tplName}' 쿠폰을 조건 충족 환자에게 일괄 자동발행하시겠습니까?`, async () => {
          btn.textContent = '발행 중...'; btn.disabled = true;
          try {
            const data = await api('/coupons/bulk-auto-issue', {
              method: 'POST',
              body: JSON.stringify({ clinic_id: state.currentClinic?.id, template_id: Number(tplId) })
            });
            if (resultDiv) {
              resultDiv.classList.remove('hidden');
              resultDiv.innerHTML = `✅ <strong>${data.template_name || tplName}</strong> 일괄 발행 완료<br>발행: <strong>${data.issued_count}건</strong>${data.error_count > 0 ? ` | 실패: ${data.error_count}건` : ''} | 대상: ${data.total_eligible}명`;
            }
            toast(`${data.issued_count}건 일괄 발행 완료!`);
            btn.textContent = '일괄 발행 실행'; btn.disabled = false;
          } catch (e) {
            toast(e.message, 'error');
            btn.textContent = '일괄 발행 실행'; btn.disabled = false;
          }
        });
      });
    } catch (e) { el.innerHTML = `<p class="text-red-500 text-center py-10">${e.message}</p>`; }
  }

  // ==================== 쿠폰 템플릿 모달 (신규 + 수정) ====================
  function showTemplateModal(existing, parentEl) {
    const isEdit = !!existing;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
      <h3 class="text-lg font-bold text-gray-800">${isEdit ? '쿠폰 템플릿 수정' : '새 쿠폰 템플릿'}</h3>
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">쿠폰 이름 *</label><input id="dpt-tpl-name" value="${isEdit ? existing.name : ''}" placeholder="예: 10만원 할인쿠폰" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">설명</label><input id="dpt-tpl-desc" value="${isEdit ? existing.description || '' : ''}" placeholder="쿠폰 설명" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">쿠폰 이미지 (URL)</label>
          <input id="dpt-tpl-image" value="${isEdit ? existing.image_url || '' : ''}" placeholder="https://..." class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <div id="dpt-tpl-img-preview" class="mt-2 ${(isEdit && existing.image_url) ? '' : 'hidden'}">
            <img id="dpt-tpl-img-tag" src="${(isEdit && existing.image_url) || ''}" class="w-full h-32 object-cover rounded-lg" onerror="this.parentElement.classList.add('hidden')" />
          </div>
          <p class="text-xs text-gray-400 mt-1">이미지 URL을 입력하세요 (권장: 640x360px)</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">할인 유형</label><select id="dpt-tpl-dtype" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="fixed" ${isEdit && existing.discount_type==='fixed'?'selected':''}>정액 (원)</option><option value="percent" ${isEdit && existing.discount_type==='percent'?'selected':''}>정율 (%)</option></select></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">할인 값 *</label><input type="number" id="dpt-tpl-dvalue" value="${isEdit ? existing.discount_value : ''}" placeholder="100000" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">최소 결제금액</label><input type="number" id="dpt-tpl-minpay" value="${isEdit ? existing.min_payment || 0 : ''}" placeholder="0" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">유효기간 (일)</label><input type="number" id="dpt-tpl-days" value="${isEdit ? existing.valid_days : 90}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
        </div>
        
        <div class="bg-purple-50 rounded-lg p-4 mb-4">
          <label class="block text-sm font-medium text-purple-800 mb-1">🎁 쇼핑몰 상품 연동 (재고 차감)</label>
          <select id="dpt-tpl-product" class="w-full px-4 py-2.5 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none">
            <option value="">연동 안 함 (포인트 쿠폰 등)</option>
          </select>
          <p class="text-xs text-purple-600 mt-1">선택 시, 쿠폰 발행마다 해당 상품의 '치과 재고'가 1개씩 차감됩니다.</p>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">쿠폰 구분</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="dpt-tpl-kind" value="general" ${!isEdit || existing.coupon_kind !== 'birthday' ? 'checked' : ''} /> 일반쿠폰</label>
            <label class="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="dpt-tpl-kind" value="birthday" ${isEdit && existing.coupon_kind === 'birthday' ? 'checked' : ''} /> 생일쿠폰</label>
          </div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">발행 필요 포인트 (차감 포인트)</label><input type="number" id="dpt-tpl-req-points" value="${isEdit ? existing.required_points || 0 : 0}" placeholder="0" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /><p class="text-xs text-gray-400 mt-1">수동 발행 시 차감될 포인트입니다. (0이면 무료)</p></div>
        <div class="bg-blue-50 rounded-lg p-4">
          <label class="block text-sm font-medium text-blue-700 mb-2">자동 발행 조건</label>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600">포인트</span>
            <input type="number" id="dpt-tpl-auto-points" value="${isEdit ? existing.auto_issue_points || '' : ''}" placeholder="100000" class="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <span class="text-sm text-gray-600">P 이상 시 자동 발행</span>
          </div>
          <p class="text-xs text-gray-400 mt-1">비워두면 수동 발행만 가능합니다.</p>
        </div>
        ${isEdit ? `<div>
          <label class="block text-sm font-medium text-gray-700 mb-1">상태</label>
          <select id="dpt-tpl-status" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="active" ${existing.status==='active'?'selected':''}>활성</option>
            <option value="inactive" ${existing.status==='inactive'?'selected':''}>비활성</option>
          </select>
        </div>` : ''}
      </div>
      <div class="flex gap-2 pt-2">
        <button id="dpt-tpl-cancel" class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition">취소</button>
        <button id="dpt-tpl-save" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">${isEdit ? '수정' : '저장'}</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    // 이미지 미리보기
    modal.querySelector('#dpt-tpl-image').addEventListener('input', (e) => {
      const url = e.target.value.trim();
      const preview = modal.querySelector('#dpt-tpl-img-preview');
      const img = modal.querySelector('#dpt-tpl-img-tag');
      if (url) {
        img.src = url;
        preview.classList.remove('hidden');
        img.onerror = () => preview.classList.add('hidden');
      } else {
        preview.classList.add('hidden');
      }
    });

    modal.querySelector('#dpt-tpl-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#dpt-tpl-save').addEventListener('click', async () => {
      const name = modal.querySelector('#dpt-tpl-name').value.trim();
      const dvalue = Number(modal.querySelector('#dpt-tpl-dvalue').value);
      if (!name || !dvalue) return toast('쿠폰 이름과 할인 값을 입력하세요.', 'error');

      const btn = modal.querySelector('#dpt-tpl-save');
      btn.textContent = '저장 중...'; btn.disabled = true;

      const body = {
        clinic_id: state.currentClinic?.id,
        name,
        description: modal.querySelector('#dpt-tpl-desc').value.trim() || null,
        image_url: modal.querySelector('#dpt-tpl-image').value.trim() || null,
        discount_type: modal.querySelector('#dpt-tpl-dtype').value,
        discount_value: dvalue,
        min_payment: Number(modal.querySelector('#dpt-tpl-minpay').value) || 0,
        valid_days: Number(modal.querySelector('#dpt-tpl-days').value) || 90,
        required_points: Number(modal.querySelector('#dpt-tpl-req-points').value) || 0,
        is_birthday: modal.querySelector('#dpt-tpl-birthday').checked ? 1 : 0,
        auto_issue_points: Number(modal.querySelector('#dpt-tpl-auto-points').value) || null,
        product_id: modal.querySelector('#dpt-tpl-product').value ? Number(modal.querySelector('#dpt-tpl-product').value) : null,
      };

      try {
        if (isEdit) {
          if (existing.is_global) {
            // 글로벌 템플릿 → activate-global API로 치과별 설정 저장
            const globalBody = {
              clinic_id: state.currentClinic?.id,
              global_template_id: existing.id,
              name: body.name,
              required_points: body.required_points,
              valid_days: body.valid_days,
              is_birthday: body.is_birthday,
              coupon_kind: body.is_birthday ? 'birthday' : 'general',
              auto_issue_points: body.auto_issue_points,
            };
            await api('/coupons/templates/activate-global', { method: 'POST', body: JSON.stringify(globalBody) });
            toast('글로벌 템플릿 설정이 저장되었습니다!');
          } else {
            body.status = modal.querySelector('#dpt-tpl-status')?.value || 'active';
            await api(`/coupons/templates/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) });
            toast('템플릿이 수정되었습니다!');
          }
        } else {
          await api('/coupons/templates', { method: 'POST', body: JSON.stringify(body) });
          toast('쿠폰 템플릿이 등록되었습니다!');
        }
        modal.remove();
        // 부모 페이지 새로고침
        const content = $('#dpt-content');
        if (state.currentPage === 'coupons') renderCoupons(content);
        else if (state.currentPage === 'settings') renderSettings(content);
      } catch (e) { toast(e.message, 'error'); btn.textContent = isEdit ? '수정' : '저장'; btn.disabled = false; }
    });
  }

  // ==================== DentWeb 연동 상태 탭 ====================
  let dwCodeTimer = null;
  let dwRemainSec = 0;
  async function renderDentwebSync(el) {
    el.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    try {
      const [data, codeData] = await Promise.all([
        api(`/sync/status?clinic_id=${state.currentClinic?.id}`),
        api(`/setup/active?clinic_id=${state.currentClinic?.id}`).catch(() => ({ active: false }))
      ]);
      const logs = data.sync_logs || [];
      const lastSync = data.last_sync;
      const dwPatients = data.dentweb_patients || 0;
      const hasCode = codeData.active;
      const activeCode = codeData.code || '';
      dwRemainSec = codeData.remaining_seconds || 0;

      el.innerHTML = `
      <div class="dpt-fade-in space-y-5 max-w-4xl">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800">DentWeb 연동</h2>
          <div class="flex items-center gap-2">
            <button id="dpt-dw-refresh" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition">새로고침</button>
            <span class="text-xs px-2.5 py-1 rounded-full ${lastSync ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${lastSync ? '연동됨' : '미연결'}</span>
          </div>
        </div>

        <!-- 상태 카드: 연동코드 + 환자수 + 동기화 한줄로 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 md:col-span-1">
            <p class="text-[11px] text-gray-400 mb-1">연동 코드</p>
            <div id="dpt-dw-code-area">
              ${hasCode ? `
                <div class="flex items-center gap-1.5">
                  <span id="dpt-dw-code-display" class="font-mono font-bold text-lg text-indigo-600 tracking-wider">${activeCode}</span>
                  <button id="dpt-dw-code-copy" class="text-gray-400 hover:text-indigo-600 transition" title="복사">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-0.5" id="dpt-dw-code-timer"></p>
              ` : `
                <button id="dpt-dw-gen-code" class="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition mt-0.5">코드 생성</button>
              `}
            </div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p class="text-[11px] text-gray-400 mb-1">연동 환자</p>
            <p class="text-xl font-bold text-blue-600">${fmt(dwPatients)}<span class="text-[11px] text-gray-400 ml-0.5">명</span></p>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p class="text-[11px] text-gray-400 mb-1">마지막 동기화</p>
            <p class="text-sm font-semibold text-gray-800">${lastSync ? lastSync.created_at.replace('T', ' ').substring(11, 19) : '-'}</p>
            ${lastSync ? `<p class="text-[10px] text-gray-400">${lastSync.created_at.substring(0,10)}</p>` : ''}
          </div>
          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p class="text-[11px] text-gray-400 mb-1">동기화 횟수</p>
            <p class="text-xl font-bold text-gray-800">${logs.length}<span class="text-[11px] text-gray-400 ml-0.5">회</span></p>
          </div>
        </div>

        <!-- 간단 설치 가이드 (접이식) -->
        <div class="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50">
          <button id="dpt-dw-guide-toggle" class="w-full px-5 py-4 flex items-center justify-between text-left">
            <div class="flex items-center gap-2">
              <span class="text-base">📋</span>
              <span class="font-semibold text-gray-800 text-sm">연동 가이드 (3단계)</span>
            </div>
            <svg id="dpt-dw-guide-chevron" class="w-5 h-5 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="dpt-dw-guide-body" class="hidden px-5 pb-5 space-y-4">
            <!-- STEP 1 -->
            <div class="flex gap-3">
              <span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
              <div>
                <p class="text-sm font-semibold text-gray-800">DentWeb dwpublic 계정 확인</p>
                <p class="text-xs text-gray-500 mt-0.5">DentWeb 환자검색에서 <code class="bg-blue-100 px-1 rounded text-blue-700 font-mono text-[11px]">dwpublic</code> 검색 → 표시되면 OK</p>
              </div>
            </div>
            <!-- STEP 2 -->
            <div class="flex gap-3">
              <span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
              <div class="w-full">
                <p class="text-sm font-semibold text-gray-800">브릿지 프로그램 다운로드</p>
                <p class="text-xs text-gray-500 mt-0.5 mb-2">실제 덴트웹(DentWeb) 메인/서버 PC에서 이 페이지에 접속하여 아래 버튼을 눌러주세요.</p>
                <div class="mt-1 mb-3">
                  <a href="/static/DentWebBridge.zip" download="DentWebBridge.zip" class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    DentWebBridge.zip 다운로드
                  </a>
                  <span class="text-[11px] text-gray-500 ml-2">파이썬(Python) 자동 설치 기능 포함됨</span>
                </div>
              </div>
            </div>
            <!-- STEP 3 -->
            <div class="flex gap-3">
              <span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
              <div class="w-full">
                <p class="text-sm font-semibold text-gray-800">압축 해제 및 프로그램 실행</p>
                <div class="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                  <div class="flex gap-2 items-start">
                    <span class="text-blue-500 mt-0.5"><i class="fas fa-check-circle text-xs"></i></span>
                    <p class="text-xs text-gray-700">다운로드 받은 <code class="bg-white px-1 py-0.5 rounded border font-mono">DentWebBridge.zip</code> 파일의 <strong>압축을 풉니다.</strong></p>
                  </div>
                  <div class="flex gap-2 items-start">
                    <span class="text-blue-500 mt-0.5"><i class="fas fa-check-circle text-xs"></i></span>
                    <p class="text-xs text-gray-700">폴더 안에 있는 <code class="bg-white px-1 py-0.5 rounded border font-mono font-bold text-blue-600">DentWebBridge.bat</code> 파일을 <strong>더블클릭</strong>하여 실행합니다.</p>
                  </div>
                  <div class="flex gap-2 items-start">
                    <span class="text-orange-500 mt-0.5"><i class="fas fa-exclamation-triangle text-xs"></i></span>
                    <p class="text-xs text-gray-600">까만 DOS 창이 뜨고 컴퓨터에 파이썬이 없다면 <strong>약 1~2분간 자동 설치가 진행</strong>됩니다. (창을 끄지 마시고 기다려주세요!)</p>
                  </div>
                </div>
              </div>
            </div>
            <!-- STEP 4 -->
            <div class="flex gap-3">
              <span class="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
              <div class="w-full">
                <p class="text-sm font-semibold text-gray-800">연동 코드 입력 및 동기화 시작</p>
                <div class="mt-2 bg-green-50 border border-green-100 rounded-lg p-3 space-y-2">
                  <div class="flex gap-2 items-start">
                    <span class="text-green-600 mt-0.5"><i class="fas fa-keyboard text-xs"></i></span>
                    <p class="text-xs text-gray-700">설치가 완료되면 DOS 창에 <strong>"6자리 연동 코드를 입력하세요:"</strong> 라는 문구가 나타납니다.</p>
                  </div>
                  <div class="flex gap-2 items-start">
                    <span class="text-green-600 mt-0.5"><i class="fas fa-key text-xs"></i></span>
                    <p class="text-xs text-gray-700">바로 위에서 발급받은 <strong>[연동 코드 6자리]를 키보드로 입력하고 엔터</strong>를 누르세요.</p>
                  </div>
                  <div class="flex gap-2 items-start">
                    <span class="text-green-600 mt-0.5"><i class="fas fa-sync text-xs"></i></span>
                    <p class="text-xs text-gray-700">"연동 성공!" 메시지가 뜨면 완료입니다. 창을 켜두시면 <strong>5분 간격으로 자동으로 환자/결제 정보를 불러옵니다.</strong></p>
                  </div>
                </div>
              </div>
            </div>

            <!-- config.ini (접이식) -->
            <details class="bg-gray-50 rounded-lg">
              <summary class="px-4 py-2.5 text-xs font-medium text-gray-600 cursor-pointer select-none">고급: config.ini 직접 설정</summary>
              <div class="px-4 pb-3">
                <div class="bg-gray-900 rounded-lg p-3 font-mono text-[11px] text-green-400 overflow-x-auto mt-2 leading-relaxed">
                  <p class="text-gray-500"># DentWeb DB</p>
                  <p>[dentweb]</p>
                  <p>server = <span class="text-yellow-300">localhost</span></p>
                  <p>port = 1436</p>
                  <p>instance = DENTWEB</p>
                  <p>user = dwpublic</p>
                  <p>password = dwpublic2!</p>
                  <p class="mt-1 text-gray-500"># Dental Point API</p>
                  <p>[dental_point]</p>
                  <p>api_url = <span class="text-cyan-300">https://dental-point.pages.dev/api</span></p>
                  <p>admin_phone = <span class="text-yellow-300">${(state.member?.phone && !state.member.phone.startsWith('imweb-')) ? state.member.phone : '010-0000-0000'}</span>${(state.member?.phone?.startsWith('imweb-')) ? ' <span class="text-red-400">⚠ 설정에서 실제 전화번호 등록 필요</span>' : ''}</p>
                  <p>admin_password = <span class="text-yellow-300">비밀번호</span></p>
                  <p>clinic_id = <span class="text-yellow-300">${state.currentClinic?.id || 1}</span></p>
                  <p class="mt-1 text-gray-500"># Sync</p>
                  <p>[sync]</p>
                  <p>interval_minutes = 5</p>
                  <p>payment_days_back = 3</p>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                  <div class="text-[11px] text-gray-500"><strong>필수:</strong> server, admin_phone, admin_password, clinic_id (<span class="text-blue-600 font-bold">${state.currentClinic?.id || 1}</span>)</div>
                  <div class="text-[11px] text-gray-500"><strong>선택:</strong> port(1436), interval_minutes(5), payment_days_back(3)</div>
                </div>
              </div>
            </details>

            <!-- 실행 방법 -->
            <details class="bg-gray-50 rounded-lg">
              <summary class="px-4 py-2.5 text-xs font-medium text-gray-600 cursor-pointer select-none">고급: 실행 및 자동화 옵션</summary>
              <div class="px-4 pb-3 text-xs text-gray-600 space-y-1 mt-1">
                <p><code class="bg-gray-200 px-1 rounded font-mono">DentWebBridge.bat</code> — 일반 실행 (5분 간격 반복)</p>
                <p><code class="bg-gray-200 px-1 rounded font-mono">DentWebBridge.bat --setup</code> — 연동 코드로 초기 설정</p>
                <p><code class="bg-gray-200 px-1 rounded font-mono">DentWebBridge.bat --test</code> — 연결 테스트만</p>
                <p><code class="bg-gray-200 px-1 rounded font-mono">DentWebBridge.bat --once</code> — 1회 동기화</p>
                <p><code class="bg-gray-200 px-1 rounded font-mono">DentWebBridge.bat --install</code> — Windows 작업 스케줄러 등록</p>
                <p class="text-[11px] text-gray-400 mt-1">💡 Python: <code class="bg-gray-200 px-1 rounded">pip install pymssql requests</code> → <code class="bg-gray-200 px-1 rounded">python dentweb_bridge.py --setup</code></p>
              </div>
            </details>
          </div>
        </div>

        <!-- 동기화 로그 -->
        <div class="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-50">
          <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800 text-sm">동기화 이력</h3>
            <span class="text-[11px] text-gray-400">${logs.length}건</span>
          </div>
          ${logs.length === 0 ? '<p class="p-5 text-center text-gray-400 text-xs">아직 동기화 기록이 없습니다.</p>' : `
          <div class="overflow-x-auto" style="min-height: 280px; padding-bottom: 80px;">
            <table class="w-full text-xs">
              <thead class="bg-gray-50">
                <tr>
                  <th class="text-left px-3 py-2 font-semibold text-gray-500">시간</th>
                  <th class="text-left px-3 py-2 font-semibold text-gray-500">유형</th>
                  <th class="text-center px-3 py-2 font-semibold text-gray-500">전체</th>
                  <th class="text-center px-3 py-2 font-semibold text-gray-500">신규</th>
                  <th class="text-center px-3 py-2 font-semibold text-gray-500">업데이트</th>
                  <th class="text-center px-3 py-2 font-semibold text-gray-500">오류</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${logs.slice(0,10).map(l => `
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2 text-gray-500">${l.created_at.replace('T',' ').substring(5,19)}</td>
                  <td class="px-3 py-2"><span class="px-1.5 py-0.5 rounded text-[11px] font-medium ${l.sync_type==='patients'?'bg-blue-100 text-blue-700':l.sync_type==='payments'?'bg-green-100 text-green-700':'bg-purple-100 text-purple-700'}">${l.sync_type==='patients'?'환자':l.sync_type==='payments'?'결제':'내원'}</span></td>
                  <td class="px-3 py-2 text-center">${l.total_rows}</td>
                  <td class="px-3 py-2 text-center text-blue-600 font-medium">${l.new_rows}</td>
                  <td class="px-3 py-2 text-center text-gray-600">${l.updated_rows}</td>
                  <td class="px-3 py-2 text-center ${l.error_rows>0?'text-red-500 font-medium':'text-gray-400'}">${l.error_rows}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <!-- FAQ (접이식) -->
        <details class="bg-white rounded-xl shadow-sm border border-gray-100">
          <summary class="px-5 py-3 font-semibold text-gray-800 text-sm cursor-pointer select-none">자주 묻는 질문</summary>
          <div class="px-5 pb-4 space-y-2">
            <div class="border border-gray-100 rounded-lg p-3">
              <p class="text-xs font-medium text-gray-800 mb-0.5">Q. 연결이 안 됩니다</p>
              <p class="text-[11px] text-gray-500">server IP, 방화벽 1436 포트, 같은 PC면 localhost 확인</p>
            </div>
            <div class="border border-gray-100 rounded-lg p-3">
              <p class="text-xs font-medium text-gray-800 mb-0.5">Q. 환자가 중복 등록됩니다</p>
              <p class="text-[11px] text-gray-500">dentweb_id → 차트번호 → 전화번호 순 매칭으로 중복 방지됨</p>
            </div>
            <div class="border border-gray-100 rounded-lg p-3">
              <p class="text-xs font-medium text-gray-800 mb-0.5">Q. 동기화 주기 변경</p>
              <p class="text-[11px] text-gray-500">config.ini의 interval_minutes 값 변경 (기본 5분)</p>
            </div>
            <div class="border border-gray-100 rounded-lg p-3">
              <p class="text-xs font-medium text-gray-800 mb-0.5">Q. 결제 데이터 누락</p>
              <p class="text-[11px] text-gray-500">payment_days_back 값 증가. dentweb_receipt_id로 중복 방지</p>
            </div>
          </div>
        </details>

        <!-- 데이터 매핑 (접이식) -->
        <details class="bg-white rounded-xl shadow-sm border border-gray-100">
          <summary class="px-5 py-3 font-semibold text-gray-800 text-sm cursor-pointer select-none">데이터 매핑 상세</summary>
          <div class="px-5 pb-4">
            <div class="overflow-x-auto" style="min-height: 280px; padding-bottom: 80px;">
              <table class="w-full text-[11px]">
                <thead class="bg-gray-50"><tr><th class="text-left p-2 text-gray-500">DentWeb</th><th class="p-2 text-center">→</th><th class="text-left p-2 text-gray-500">필드</th><th class="text-left p-2 text-gray-500">설명</th></tr></thead>
                <tbody class="divide-y divide-gray-50">
                  <tr><td class="p-2 font-mono bg-gray-50">n환자ID</td><td class="p-2 text-center">→</td><td class="p-2 font-medium">dentweb_id</td><td class="p-2 text-gray-400">고유 ID</td></tr>
                  <tr><td class="p-2 font-mono bg-gray-50">sz차트번호</td><td class="p-2 text-center">→</td><td class="p-2 font-medium">차트번호</td><td class="p-2 text-gray-400">차트 번호</td></tr>
                  <tr><td class="p-2 font-mono bg-gray-50">sz이름/sz휴대폰</td><td class="p-2 text-center">→</td><td class="p-2 font-medium">이름/연락처</td><td class="p-2 text-gray-400">기본 정보</td></tr>
                  <tr><td class="p-2 font-mono bg-gray-50">n본인부담금+n비급여</td><td class="p-2 text-center">→</td><td class="p-2 font-medium">결제금액</td><td class="p-2 text-gray-400">포인트 적립</td></tr>
                  <tr><td class="p-2 font-mono bg-gray-50">접수목록.날짜</td><td class="p-2 text-center">→</td><td class="p-2 font-medium">내원일</td><td class="p-2 text-gray-400">마지막 방문</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>`;
    } catch (e) {
      el.innerHTML = `<div class="text-center py-20"><p class="text-red-500">${e.message}</p><p class="text-gray-400 text-sm mt-2">DentWeb 연동 상태를 조회할 수 없습니다.</p></div>`;
    }

    // 가이드 토글
    document.getElementById('dpt-dw-guide-toggle')?.addEventListener('click', () => {
      const body = document.getElementById('dpt-dw-guide-body');
      const chevron = document.getElementById('dpt-dw-guide-chevron');
      body.classList.toggle('hidden');
      chevron.classList.toggle('rotate-180');
    });

    // 새로고침 버튼
    document.getElementById('dpt-dw-refresh')?.addEventListener('click', () => renderDentwebSync(el));

    // 코드 생성 버튼
    document.getElementById('dpt-dw-gen-code')?.addEventListener('click', async () => {
      const btn = document.getElementById('dpt-dw-gen-code');
      btn.textContent = '생성중...'; btn.disabled = true;
      try {
        const res = await api('/setup/code', { method: 'POST', body: JSON.stringify({ clinic_id: state.currentClinic?.id }) });
        renderDentwebSync(el);
      } catch (e) { toast(e.message, 'error'); btn.textContent = '코드 생성'; btn.disabled = false; }
    });

    // 코드 복사
    document.getElementById('dpt-dw-code-copy')?.addEventListener('click', async () => {
      const code = document.getElementById('dpt-dw-code-display')?.textContent || '';
      try { await navigator.clipboard.writeText(code); toast('연동 코드가 복사되었습니다!'); }
      catch { toast('복사 실패', 'error'); }
    });

    // 카운트다운 타이머
    if (dwCodeTimer) clearInterval(dwCodeTimer);
    const timerEl = document.getElementById('dpt-dw-code-timer');
    if (timerEl && dwRemainSec > 0) {
      let sec = dwRemainSec;
      const tick = () => {
        if (sec <= 0) { clearInterval(dwCodeTimer); renderDentwebSync(el); return; }
        const m = Math.floor(sec / 60), s = sec % 60;
        timerEl.textContent = `${m}:${String(s).padStart(2,'0')} 남음`;
        sec--;
      };
      tick();
      dwCodeTimer = setInterval(tick, 1000);
    }
  }

  
  // ==================== MALL ====================
  let mallCart = [];
  
  async function renderMall(cnt) {
    cnt.innerHTML = '<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>';
    try {
      const [{ products }, { inventory }, { orders }, { deliveries }] = await Promise.all([
        api('/mall/products'),
        api(`/mall/inventory/${state.currentClinic.id}`),
        api(`/mall/orders/${state.currentClinic.id}`),
        api(`/mall/delivery/clinic/${state.currentClinic.id}`)
      ]);
      
      const el = document.createElement('div');
      el.className = 'max-w-6xl mx-auto space-y-6 animate-fade-in';
      
      let html = `
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">덴탈포인트 쇼핑몰</h2>
            <p class="text-sm text-gray-500 mt-1">치과 전용 구강용품을 B2B 단가로 구매하고 바로 환자 쿠폰으로 발행하세요.</p>
          </div>
          <button id="dpt-mall-cart-btn" class="relative px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition shadow-sm flex items-center gap-2">
            장바구니
            <span id="dpt-mall-cart-count" class="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">${mallCart.length}</span>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          ${products.map(p => `
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
              <div class="aspect-video bg-gray-50 relative">
                <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover mix-blend-multiply opacity-90" />
                <span class="absolute top-2 left-2 px-2 py-1 text-[10px] font-bold rounded shadow-sm ${p.delivery_type==='stock'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${p.delivery_type==='stock'?'치과 비치용':'환자 직배송용'}</span>
              </div>
              <div class="p-4 flex-1 flex flex-col">
                <p class="text-[10px] text-gray-400 mb-1">${p.vendor_name || '본사'}</p>
                <h3 class="font-bold text-gray-800 text-sm leading-snug mb-1">${p.name}</h3>
                <p class="text-xs text-gray-500 line-clamp-2 flex-1">${p.description}</p>
                
                <div class="mt-4 pt-4 border-t border-gray-50 flex items-end justify-between">
                  <div>
                    <p class="text-[10px] text-gray-400">단가</p>
                    <p class="font-bold text-lg text-gray-900">${fmt(p.price)}<span class="text-sm font-normal">원</span></p>
                  </div>
                  <button class="dpt-add-cart px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-sm font-medium transition" 
                    data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">
                    담기
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        

        <div class="mt-12 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100">
            <h3 class="font-bold text-gray-800">최근 주문 내역</h3>
          </div>
          <table class="w-full text-sm text-left">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="px-6 py-3 font-medium">주문일자 / 번호</th>
                <th class="px-6 py-3 font-medium">주문 상품</th>
                <th class="px-6 py-3 font-medium text-right">결제 금액</th>
                <th class="px-6 py-3 font-medium text-center">상태</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${orders && orders.length > 0 ? orders.map(o => {
                let itemsStr = '';
                try {
                  const itemsArr = JSON.parse(o.items);
                  itemsStr = itemsArr.map(i => `${i.name} <span class="text-gray-400 text-xs">x${i.qty}</span>`).join('<br>');
                } catch(e) { itemsStr = '상품 정보 오류'; }
                
                return `
                <tr class="hover:bg-gray-50 transition">
                  <td class="px-6 py-4">
                    <p class="text-xs text-gray-500">${o.created_at.replace('T', ' ').substring(0, 16)}</p>
                    <p class="font-medium text-gray-800">${o.order_no}</p>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-600">${itemsStr}</td>
                  <td class="px-6 py-4 text-right font-bold text-gray-800">${fmt(o.total_amount)}원</td>
                  <td class="px-6 py-4 text-center">
                    ${o.status === 'pending' 
                      ? '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">입금대기</span>'
                      : '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">결제/충전완료</span>'}
                  </td>
                </tr>
                `;
              }).join('') : '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">주문 내역이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>


        <div class="mt-12 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-gray-800">우리 치과 환자 배송 현황</h3>
            <span class="text-xs text-gray-500">직배송 쿠폰 사용 내역</span>
          </div>
          <table class="w-full text-sm text-left">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="px-6 py-3 font-medium">요청일자</th>
                <th class="px-6 py-3 font-medium">환자명</th>
                <th class="px-6 py-3 font-medium">상품명</th>
                <th class="px-6 py-3 font-medium text-center">상태</th>
                <th class="px-6 py-3 font-medium text-center">운송장</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${deliveries && deliveries.length > 0 ? deliveries.map(d => `
                <tr class="hover:bg-gray-50 transition">
                  <td class="px-6 py-4 text-xs text-gray-500">${d.created_at.substring(0, 16)}</td>
                  <td class="px-6 py-4 font-medium text-gray-800">${d.patient_name || d.receiver_name}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">${d.product_name}</td>
                  <td class="px-6 py-4 text-center">
                    ${d.status === 'pending' ? '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">배송준비중</span>' :
                       d.status === 'shipping' ? '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">배송중</span>' :
                       '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">배송완료</span>'}
                  </td>
                  <td class="px-6 py-4 text-center text-xs text-gray-500">
                    ${d.tracking_number ? `${d.courier_company}<br>${d.tracking_number}` : '-'}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">환자 배송 요청 내역이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
            내 치과 보유 재고 현황
            <span class="text-xs font-normal bg-gray-100 text-gray-600 px-2 py-1 rounded">쿠폰으로 즉시 발행 가능한 수량</span>
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            ${inventory.length ? inventory.map(i => `
              <div class="border border-gray-100 rounded-lg p-3 bg-gray-50 flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-500 truncate w-32" title="${i.name}">${i.name}</p>
                  <p class="font-bold text-gray-800 text-lg mt-0.5">${fmt(i.quantity)}<span class="text-xs font-normal ml-1 text-gray-500">개</span></p>
                </div>
              </div>
            `).join('') : '<p class="text-sm text-gray-400 col-span-full">보유중인 재고가 없습니다.</p>'}
          </div>
        </div>
      `;
      
      el.innerHTML = html;
      
      // 장바구니 담기 이벤트
      el.querySelectorAll('.dpt-add-cart').forEach(btn => {
        btn.onclick = () => {
          const id = Number(btn.dataset.id);
          const exist = mallCart.find(c => c.product_id === id);
          if (exist) exist.quantity++;
          else mallCart.push({ product_id: id, name: btn.dataset.name, price: Number(btn.dataset.price), quantity: 1 });
          
          el.querySelector('#dpt-mall-cart-count').textContent = mallCart.length;
          toast(btn.dataset.name + ' 상품이 장바구니에 담겼습니다.');
        };
      });
      
      // 장바구니 보기
      el.querySelector('#dpt-mall-cart-btn').onclick = () => showCartModal();
      
      cnt.innerHTML = '';
      cnt.appendChild(el);
      
    } catch(e) {
      cnt.innerHTML = `<div class="p-6 text-red-500 text-sm">오류: ${e.message}</div>`;
    }
  }
  
  function showCartModal() {
    if(!mallCart.length) return alert('장바구니가 비어 있습니다.');
    
    const div = document.createElement('div');
    div.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm animate-fade-in p-4';
    
    const total = mallCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    div.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 class="font-bold text-gray-800">장바구니</h3>
          <button class="dpt-cart-close text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 overflow-y-auto flex-1">
          <div class="space-y-3">
            ${mallCart.map((item, idx) => `
              <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div class="flex-1 pr-3">
                  <p class="text-sm font-medium text-gray-800 line-clamp-1">${item.name}</p>
                  <p class="text-xs text-gray-500 mt-1">${fmt(item.price)}원</p>
                </div>
                <div class="flex items-center gap-3">
                  <div class="flex items-center bg-gray-50 rounded border border-gray-200">
                    <button class="dpt-qty-btn px-2 text-gray-500 hover:bg-gray-200" data-idx="${idx}" data-dir="-1">-</button>
                    <span class="text-xs font-bold w-6 text-center">${item.quantity}</span>
                    <button class="dpt-qty-btn px-2 text-gray-500 hover:bg-gray-200" data-idx="${idx}" data-dir="1">+</button>
                  </div>
                  <button class="dpt-qty-rm text-red-400 hover:text-red-600 text-xs font-medium" data-idx="${idx}">삭제</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="p-5 bg-gray-50 border-t border-gray-100">
          <div class="flex justify-between items-center mb-4">
            <span class="text-sm text-gray-600">총 결제금액</span>
            <span class="text-xl font-bold text-purple-600">${fmt(total)}<span class="text-sm font-normal text-gray-600 ml-1">원</span></span>
          </div>
          <button id="dpt-cart-order-btn" class="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-sm">무통장 입금으로 주문하기</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(div);
    
    div.querySelector('.dpt-cart-close').onclick = () => div.remove();
    div.addEventListener('click', (e) => { if(e.target === div) div.remove(); });
    
    div.querySelectorAll('.dpt-qty-btn').forEach(b => {
      b.onclick = () => {
        const idx = Number(b.dataset.idx);
        const dir = Number(b.dataset.dir);
        mallCart[idx].quantity += dir;
        if(mallCart[idx].quantity < 1) mallCart[idx].quantity = 1;
        div.remove(); showCartModal(); // re-render
      }
    });
    
    div.querySelectorAll('.dpt-qty-rm').forEach(b => {
      b.onclick = () => {
        const idx = Number(b.dataset.idx);
        mallCart.splice(idx, 1);
        div.remove();
        if(mallCart.length) showCartModal();
        else renderMall(document.getElementById('dpt-content'));
      }
    });
    
    div.querySelector('#dpt-cart-order-btn').onclick = async () => {
      showConfirmModal('주문을 진행하시겠습니까?', async () => {
        const btn = modal.querySelector('#dpt-mall-checkout');
        btn.textContent = '주문 중...'; btn.disabled = true;
        try {
          await api('/mall/orders', { method: 'POST', body: JSON.stringify({ clinic_id: state.currentClinic?.id, items: reqItems }) });
          toast('주문이 접수되었습니다.');
          modal.remove();
          renderMall(document.getElementById('dpt-content'));
        } catch(err) {
          toast(err.message, 'error');
          btn.textContent = '주문하기'; btn.disabled = false;
        }
      });
      return;
      const btn = div.querySelector('#dpt-cart-order-btn');
      const originHtml = btn.innerHTML;
      btn.innerHTML = '주문 처리 중...'; btn.disabled = true;
      
      try {
        const res = await api('/mall/orders', {
          method: 'POST',
          body: JSON.stringify({ clinic_id: state.currentClinic.id, items: mallCart })
        });
        div.remove();
        mallCart = []; // clear cart
        renderMall(document.getElementById('dpt-content'));
        
        // Show success modal
        alert(`주문이 성공적으로 접수되었습니다.\n\n[주문번호] ${res.order_no}\n[입금계좌] ${res.bank_info}\n[입금금액] ${fmt(res.total_amount)}원\n\n입금이 확인되면 치과 시스템에 재고가 즉시 충전됩니다.`);
      } catch(err) {
        alert('주문 실패: ' + err.message);
        btn.innerHTML = originHtml; btn.disabled = false;
      }
    };
  }

  
  // ==================== MALL HQ (본사 주문 승인) ====================
  let hqTab = 'orders'; // 'orders' or 'products'
  
  async function renderMallHQ(cnt) {
    cnt.innerHTML = '<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>';
    try {
      const el = document.createElement('div');
      el.className = 'max-w-6xl mx-auto space-y-6 animate-fade-in';
      
      let html = `
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">👑 본사 몰 관리</h2>
            <p class="text-sm text-gray-500 mt-1">치과 주문 내역을 승인하고 쇼핑몰 상품을 관리하세요.</p>
          </div>
        </div>
        
        <!-- Tabs -->
        <div class="flex border-b border-gray-200">
          <button class="px-6 py-3 font-medium text-sm border-b-2 ${hqTab === 'orders' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" onclick="window.__hqSetTab('orders')">주문 승인 관리</button>
          <button class="px-6 py-3 font-medium text-sm border-b-2 ${hqTab === 'products' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" onclick="window.__hqSetTab('products')">쇼핑몰 상품 관리</button>
          <button class="px-6 py-3 font-medium text-sm border-b-2 ${hqTab === 'deliveries' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" onclick="window.__hqSetTab('deliveries')">환자 배송 관리</button>
        </div>
        
        <div id="dpt-hq-content"></div>
      `;
      
      el.innerHTML = html;
      
      // We need a global helper to switch tabs
      window.__hqSetTab = function(tab) {
        hqTab = tab;
        renderMallHQ(document.getElementById('dpt-content'));
      };
      
      cnt.innerHTML = '';
      cnt.appendChild(el);
      
      const hqCnt = el.querySelector('#dpt-hq-content');
      hqCnt.innerHTML = '<div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>';
      
      if (hqTab === 'orders') {
        const { orders } = await api('/mall/admin/orders');
        hqCnt.innerHTML = `
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th class="px-4 py-3 font-medium">주문일시 / 주문번호</th>
                  <th class="px-4 py-3 font-medium">치과명</th>
                  <th class="px-4 py-3 font-medium">주문 상품</th>
                  <th class="px-4 py-3 font-medium text-right">총 결제금액</th>
                  <th class="px-4 py-3 font-medium text-center">상태</th>
                  <th class="px-4 py-3 font-medium text-center">관리</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${orders.length === 0 ? '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">들어온 주문이 없습니다.</td></tr>' : ''}
                ${orders.map(o => {
                  let itemsStr = '';
                  try {
                    const itemsArr = JSON.parse(o.items);
                    itemsStr = itemsArr.map(i => `${i.name} <span class="text-gray-400">x${i.qty}</span>`).join('<br>');
                  } catch(e) { itemsStr = '상품 정보 오류'; }
                  
                  return `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-3">
                      <p class="text-xs text-gray-500">${o.created_at.replace('T', ' ').substring(0, 16)}</p>
                      <p class="font-medium text-gray-800">${o.order_no}</p>
                    </td>
                    <td class="px-4 py-3 font-bold text-gray-800">${o.clinic_name}</td>
                    <td class="px-4 py-3 text-xs text-gray-600">${itemsStr}</td>
                    <td class="px-4 py-3 text-right font-bold text-purple-600">${fmt(o.total_amount)}원</td>
                    <td class="px-4 py-3 text-center">
                      ${o.status === 'pending' 
                        ? '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">입금대기</span>'
                        : '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">결제/충전완료</span>'}
                    </td>
                    <td class="px-4 py-3 text-center">
                      ${o.status === 'pending' 
                        ? `<button class="dpt-approve-order bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm" data-id="${o.id}">입금 승인</button>`
                        : '<span class="text-gray-400 text-xs">-</span>'}
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
        
        hqCnt.querySelectorAll('.dpt-approve-order').forEach(btn => {
          btn.onclick = async () => {
            showConfirmModal('해당 치과의 입금을 확인하셨습니까?\n승인 시 즉시 치과 시스템에 재고가 충전됩니다.', async () => {
              const originHtml = btn.innerHTML;
              btn.innerHTML = '승인 중...'; btn.disabled = true;
              try {
                await api(`/mall/admin/orders/${btn.dataset.id}/approve`, { method: 'POST' });
                toast('승인 및 재고 충전이 완료되었습니다.');
                renderMallHQ(document.getElementById('dpt-content'));
              } catch(err) {
                alert('승인 오류: ' + err.message);
                btn.innerHTML = originHtml; btn.disabled = false;
              }
            });
            return;
            const originHtml = btn.innerHTML;
            btn.innerHTML = '승인 중...'; btn.disabled = true;
            try {
              await api(`/mall/admin/orders/${btn.dataset.id}/approve`, { method: 'POST' });
              toast('승인 및 재고 충전이 완료되었습니다.');
              renderMallHQ(document.getElementById('dpt-content'));
            } catch(err) {
              alert('승인 오류: ' + err.message);
              btn.innerHTML = originHtml; btn.disabled = false;
            }
          };
        });
      } 
      else if (hqTab === 'products') {
        const { products } = await api('/mall/admin/products');
        hqCnt.innerHTML = `
          <div class="flex justify-end mb-4">
            <button id="dpt-hq-add-prod" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold shadow hover:bg-green-700">추가하기</button>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th class="px-4 py-3 font-medium">ID / 썸네일</th>
                  <th class="px-4 py-3 font-medium">상품명 / 설명</th>
                  <th class="px-4 py-3 font-medium text-center">배송 타입</th>
                  <th class="px-4 py-3 font-medium text-right">단가</th>
                  <th class="px-4 py-3 font-medium text-center">상태</th>
                  <th class="px-4 py-3 font-medium text-center">관리</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${products.map(p => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 flex gap-3 items-center">
                      <span class="text-xs text-gray-400">#${p.id}</span>
                      ${p.image_url ? `<img src="${p.image_url}" class="w-12 h-12 object-cover rounded bg-gray-100" />` : '<div class="w-12 h-12 bg-gray-100 rounded text-[10px] text-gray-400 flex items-center justify-center">No Img</div>'}
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-bold text-gray-800">${p.name}</p>
                      <p class="text-xs text-gray-500 mt-1 truncate max-w-xs">${p.description || ''}</p>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="text-xs font-bold px-2 py-1 rounded ${p.delivery_type==='stock'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${p.delivery_type==='stock'?'치과 비치용':'환자 직배송용'}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-bold text-gray-800">${fmt(p.price)}원</td>
                    <td class="px-4 py-3 text-center">
                      ${p.status === 'active' ? '<span class="text-green-600 text-xs font-bold">활성</span>' : '<span class="text-gray-400 text-xs font-bold">비활성</span>'}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <button class="dpt-hq-edit-prod text-blue-500 text-xs font-medium hover:underline" data-prod='${JSON.stringify(p).replace(/'/g, "&#39;")}'>수정</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        
        hqCnt.querySelector('#dpt-hq-add-prod').onclick = () => showProductModal();
        hqCnt.querySelectorAll('.dpt-hq-edit-prod').forEach(btn => {
          btn.onclick = () => {
            const p = JSON.parse(btn.dataset.prod.replace(/&#39;/g, "'"));
            showProductModal(p);
          };
        });
      }
      else if (hqTab === 'deliveries') {
        const { deliveries } = await api('/mall/admin/deliveries');
        hqCnt.innerHTML = `
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th class="px-4 py-3 font-medium">요청일 / 치과명</th>
                  <th class="px-4 py-3 font-medium">상품 / 배송지 정보</th>
                  <th class="px-4 py-3 font-medium text-center">진행 상태</th>
                  <th class="px-4 py-3 font-medium text-center">운송장 등록/수정</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${deliveries.length === 0 ? '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">배송 요청 내역이 없습니다.</td></tr>' : ''}
                ${deliveries.map(d => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-3">
                      <p class="text-xs text-gray-500">${d.created_at.substring(0, 16)}</p>
                      <p class="font-bold text-gray-800">${d.clinic_name}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-bold text-purple-700 text-xs mb-1">${d.product_name}</p>
                      <p class="text-sm font-medium text-gray-800">${d.receiver_name} <span class="text-xs font-normal text-gray-500">${d.phone}</span></p>
                      <p class="text-xs text-gray-600 mt-0.5">${d.address}</p>
                    </td>
                    <td class="px-4 py-3 text-center">
                      ${d.status === 'pending' ? '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">배송준비중</span>' :
                         d.status === 'shipping' ? '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">배송중</span>' :
                         '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">배송완료</span>'}
                      ${d.tracking_number ? `<p class="text-[10px] text-gray-500 mt-1">${d.courier_company}<br/>${d.tracking_number}</p>` : ''}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <button class="dpt-hq-edit-tracking text-blue-500 text-xs font-medium hover:underline border border-blue-200 px-2 py-1 rounded" data-del='${JSON.stringify(d).replace(/'/g, "&#39;")}'>운송장 입력</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        
        hqCnt.querySelectorAll('.dpt-hq-edit-tracking').forEach(btn => {
          btn.onclick = () => {
            const d = JSON.parse(btn.dataset.del.replace(/&#39;/g, "'"));
            showTrackingModal(d);
          };
        });
      }
      
    } catch(e) {
      cnt.innerHTML = `<div class="p-6 text-red-500 text-sm">오류: ${e.message}</div>`;
    }
  }
  
  function showProductModal(existing = null) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
        <h3 class="text-lg font-bold text-gray-800">${existing ? '상품 수정' : '새 상품 추가'}</h3>
        <div class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">상품명 *</label><input id="hq-p-name" value="${existing ? existing.name : ''}" class="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">단가 (원) *</label><input type="number" id="hq-p-price" value="${existing ? existing.price : ''}" class="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">설명</label><input id="hq-p-desc" value="${existing ? existing.description || '' : ''}" class="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label><input id="hq-p-img" value="${existing ? existing.image_url || '' : ''}" class="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">배송 타입</label>
              <select id="hq-p-type" class="w-full px-4 py-2 border rounded-lg text-sm">
                <option value="stock" ${existing && existing.delivery_type==='stock' ? 'selected':''}>치과 비치용</option>
                <option value="direct" ${existing && existing.delivery_type==='direct' ? 'selected':''}>환자 직배송용</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select id="hq-p-status" class="w-full px-4 py-2 border rounded-lg text-sm">
                <option value="active" ${existing && existing.status==='active' ? 'selected':''}>활성</option>
                <option value="inactive" ${existing && existing.status==='inactive' ? 'selected':''}>비활성</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex gap-2 pt-4">
          <button id="hq-p-cancel" class="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-medium">취소</button>
          <button id="hq-p-save" class="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">저장</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('#hq-p-cancel').onclick = () => modal.remove();
    modal.querySelector('#hq-p-save').onclick = async () => {
      const body = {
        name: modal.querySelector('#hq-p-name').value.trim(),
        price: Number(modal.querySelector('#hq-p-price').value),
        description: modal.querySelector('#hq-p-desc').value.trim(),
        image_url: modal.querySelector('#hq-p-img').value.trim(),
        delivery_type: modal.querySelector('#hq-p-type').value,
        status: modal.querySelector('#hq-p-status').value
      };
      if(!body.name || !body.price) return toast('상품명과 단가를 입력하세요.', 'error');
      
      const btn = modal.querySelector('#hq-p-save');
      btn.textContent = '저장 중...'; btn.disabled = true;
      try {
        if(existing) {
          await api(`/mall/admin/products/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('수정 완료');
        } else {
          await api('/mall/admin/products', { method: 'POST', body: JSON.stringify(body) });
          toast('추가 완료');
        }
        modal.remove();
        renderMallHQ(document.getElementById('dpt-content'));
      } catch(err) {
        alert(err.message);
        btn.textContent = '저장'; btn.disabled = false;
      }
    };
  }


  
  function showTrackingModal(d) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 my-8">
        <h3 class="text-lg font-bold text-gray-800">운송장 정보 입력</h3>
        <p class="text-sm text-gray-600">${d.receiver_name} 님의 배송 정보를 업데이트합니다.</p>
        <div class="space-y-4 mt-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select id="hq-t-status" class="w-full px-4 py-2 border rounded-lg text-sm">
              <option value="pending" ${d.status==='pending'?'selected':''}>배송준비중</option>
              <option value="shipping" ${d.status==='shipping'?'selected':''}>배송중</option>
              <option value="completed" ${d.status==='completed'?'selected':''}>배송완료</option>
            </select>
          </div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">택배사</label><input id="hq-t-company" value="${d.courier_company || ''}" placeholder="예: CJ대한통운" class="w-full px-4 py-2 border rounded-lg text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">운송장 번호</label><input id="hq-t-number" value="${d.tracking_number || ''}" placeholder="- 없이 숫자만 입력" class="w-full px-4 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div class="flex gap-2 pt-4">
          <button id="hq-t-cancel" class="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-medium">취소</button>
          <button id="hq-t-save" class="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">저장</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('#hq-t-cancel').onclick = () => modal.remove();
    modal.querySelector('#hq-t-save').onclick = async () => {
      const body = {
        status: modal.querySelector('#hq-t-status').value,
        courier_company: modal.querySelector('#hq-t-company').value.trim(),
        tracking_number: modal.querySelector('#hq-t-number').value.trim()
      };
      const btn = modal.querySelector('#hq-t-save');
      btn.textContent = '저장 중...'; btn.disabled = true;
      try {
        await api(`/mall/admin/deliveries/${d.id}/tracking`, { method: 'PUT', body: JSON.stringify(body) });
        toast('운송장 정보가 업데이트 되었습니다.');
        modal.remove();
        renderMallHQ(document.getElementById('dpt-content'));
      } catch(err) {
        alert(err.message);
        btn.textContent = '저장'; btn.disabled = false;
      }
    };
  }

  // ==================== 초기화 ====================

  window.__DPT_RENDER_APP__ = function(imwebData) {
    if (imwebData) {
      if (imwebData.clinicName) {
        state.imwebClinicName = imwebData.clinicName;
        localStorage.setItem('dpt_imweb_clinic_name', imwebData.clinicName);
      }
      // 아임웹에서 특정 페이지를 지정할 수 있음
      if (imwebData.page) {
        state.currentPage = imwebData.page;
        localStorage.setItem('dpt_admin_currentPage', imwebData.page);
      }
    }
    state.token = localStorage.getItem('dpt_admin_token') || '';
    state.member = JSON.parse(localStorage.getItem('dpt_admin_member') || 'null');
    state.clinics = JSON.parse(localStorage.getItem('dpt_admin_clinics') || '[]');
    state.currentClinic = JSON.parse(localStorage.getItem('dpt_admin_current_clinic') || 'null');
    state.imwebClinicName = localStorage.getItem('dpt_imweb_clinic_name') || '';
    if (state.token && state.member) {
      // 서버에서 토큰 유효성 검증 후 렌더
      verifyAndSyncSession().then(valid => {
        if (valid || state.token) renderApp();
        else renderLogin();
      });
    } else {
      renderLogin();
    }
  };

  // URL 해시 또는 쿼리 파라미터에서 페이지 읽기 (아임웹 메뉴 연동)
  // 예: #coupons, ?dpt_page=coupons
  (function initPageFromURL() {
    const validPages = ['dashboard','payment','patients','coupons','bulk','dentweb','settings','mall','mall_hq'];
    const hash = window.location.hash.replace('#','');
    if (hash && validPages.includes(hash)) {
      state.currentPage = hash;
      localStorage.setItem('dpt_admin_currentPage', hash);
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('dpt_page');
    if (pageParam && validPages.includes(pageParam)) {
      state.currentPage = pageParam;
      localStorage.setItem('dpt_admin_currentPage', pageParam);
    }
  })();

  if (state.token && state.member) {
    // 서버에서 토큰 유효성 검증 후 렌더 (다른 계정 캐시 방지)
    verifyAndSyncSession().then(valid => {
      if (valid || state.token) renderApp();
      else renderLogin();
    });
  } else {
    if (window.__DPT_EMBED__) {
      $root.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="text-center"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p class="text-gray-400 text-sm">인증 대기중...</p></div></div>';
    } else {
      renderLogin();
    }
  }
})();
