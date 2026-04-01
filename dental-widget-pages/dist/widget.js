/**
 * 아임웹 임플란트 상담 위젯 (Cloudflare Pages 배포용)
 * v2.2.0 - CSS 격리 강화 (아임웹 스타일 충돌 방지)
 * API: dental-estimate-api.dentalkmovie.workers.dev
 * 사용법: <div id="dentalWidgetRoot"></div>
 *         <script src="https://dental-widget.pages.dev/widget.js" charset="utf-8"></script>
 */
(function() {
  'use strict';

  // ====== 설정 ======
  var DENTAL_API = 'https://dental-estimate-api.dentalkmovie.workers.dev';
  var VERSION = '2.2.0';
  var FA_CSS = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';

  console.log('[DentalWidget] v' + VERSION + ' loaded (external)');

  // ====== Font Awesome 로드 ======
  if (!document.querySelector('link[href*="fontawesome"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FA_CSS;
    document.head.appendChild(link);
  }

  // ====== CSS 삽입 (모든 셀렉터를 #dentalWidgetRoot 하위로 격리) ======
  // R = #dentalWidgetRoot (아임웹 스타일과 충돌 방지)
  var R = '#dentalWidgetRoot';
  var css = [
    /* 루트 격리 - 아임웹 상속 차단 */
    R+'{all:initial!important;display:block!important;visibility:visible!important;opacity:1!important;max-width:100%!important;margin:0 auto!important;padding:12px!important;background:#f8f9fa!important;font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif!important;font-size:14px!important;line-height:1.5!important;color:#1f2937!important;-webkit-text-size-adjust:100%!important;box-sizing:border-box!important}',
    R+' *,'+R+' *::before,'+R+' *::after{margin:0;padding:0;box-sizing:border-box!important;font-family:inherit;line-height:inherit;-webkit-font-smoothing:antialiased}',
    /* 기본 요소 리셋 - 아임웹이 덮어쓸 수 있는 요소들 */
    R+' div,'+R+' span,'+R+' p,'+R+' h2,'+R+' h3,'+R+' label,'+R+' button,'+R+' input,'+R+' select,'+R+' option,'+R+' optgroup{display:revert;visibility:visible!important;opacity:1!important;float:none;position:static;transform:none;letter-spacing:normal;text-transform:none;text-indent:0;text-decoration:none;list-style:none}',
    R+' h2{font-size:18px!important;font-weight:700!important;margin:0 0 2px 0!important}',
    R+' p{font-size:13px!important;margin:0!important}',
    R+' button{cursor:pointer;border:none;background:transparent;font-family:inherit;font-size:inherit}',
    R+' input,'+R+' select{font-family:inherit;font-size:14px;color:#1f2937}',
    R+' select option,'+R+' select optgroup{font-family:inherit;font-size:14px;color:#1f2937}',
    /* 로딩 */
    R+' .dental-loading{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:60px 20px!important}',
    R+' .dental-spinner{width:40px!important;height:40px!important;border:3px solid #e5e7eb!important;border-top-color:#667eea!important;border-radius:50%!important;animation:dental-spin .8s linear infinite!important}',
    '@keyframes dental-spin{to{transform:rotate(360deg)}}',
    R+' .dental-loading-text{margin-top:12px!important;font-size:13px!important;color:#6b7280!important}',
    /* 카드 */
    R+' .dental-card{display:block!important;visibility:visible!important;background:#fff!important;border-radius:16px!important;box-shadow:0 2px 12px rgba(0,0,0,.06)!important;padding:20px!important;margin-bottom:16px!important}',
    R+' .dental-card-header{display:block!important;visibility:visible!important;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)!important;color:#fff!important;padding:20px!important;border-radius:16px!important;margin-bottom:16px!important;text-align:center!important}',
    R+' .dental-card-header h2{font-size:18px!important;font-weight:700!important;margin-bottom:2px!important;color:#fff!important}',
    R+' .dental-card-header p{font-size:13px!important;opacity:.85!important;color:#fff!important}',
    R+' .dental-card-header-icon{width:48px!important;height:48px!important;background:rgba(255,255,255,.2)!important;border-radius:12px!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0 auto 10px!important;font-size:22px!important}',
    /* 섹션 제목 */
    R+' .dental-section-title{display:flex!important;visibility:visible!important;align-items:center!important;gap:8px!important;font-size:15px!important;font-weight:700!important;color:#1f2937!important;margin-bottom:14px!important}',
    R+' .dental-section-title i{color:#667eea!important}',
    /* 폼 */
    R+' .dental-form-group{display:block!important;visibility:visible!important;margin-bottom:14px!important}',
    R+' .dental-label{display:block!important;font-size:12px!important;font-weight:600!important;color:#4b5563!important;margin-bottom:5px!important}',
    R+' .dental-label .required{color:#ef4444!important;margin-left:2px!important}',
    R+' .dental-input,'+R+' .dental-select{display:block!important;width:100%!important;padding:11px 14px!important;border:1px solid #e5e7eb!important;border-radius:10px!important;font-size:14px!important;transition:all .2s!important;outline:none!important;background:#fff!important;color:#1f2937!important;height:auto!important;min-height:0!important;appearance:auto!important;-webkit-appearance:auto!important}',
    R+' .dental-input:focus,'+R+' .dental-select:focus{border-color:#667eea!important;box-shadow:0 0 0 3px rgba(102,126,234,.12)!important}',
    R+' .dental-input::placeholder{color:#9ca3af!important}',
    R+' .dental-input.error{border-color:#ef4444!important}',
    /* 버튼 */
    R+' .dental-btn{display:inline-flex!important;visibility:visible!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:11px 18px!important;border:none!important;border-radius:10px!important;font-size:14px!important;font-weight:600!important;cursor:pointer!important;transition:all .2s!important;text-decoration:none!important;line-height:1.2!important}',
    R+' .dental-btn-primary{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)!important;color:#fff!important;width:100%!important}',
    R+' .dental-btn-primary:hover{transform:translateY(-1px)!important;box-shadow:0 4px 12px rgba(102,126,234,.35)!important}',
    R+' .dental-btn-primary:active{transform:translateY(0)!important}',
    R+' .dental-btn-secondary{background:#f3f4f6!important;color:#374151!important;border:1px solid #e5e7eb!important}',
    R+' .dental-btn-secondary:hover{background:#e5e7eb!important}',
    R+' .dental-btn-sm{padding:6px 12px!important;font-size:12px!important;border-radius:8px!important}',
    R+' .dental-btn-outline{background:transparent!important;border:1px solid #667eea!important;color:#667eea!important}',
    R+' .dental-btn-outline:hover{background:#667eea!important;color:#fff!important}',
    /* 브랜드 선택 */
    R+' .dental-brand-section{display:block!important;margin-bottom:16px!important}',
    R+' .dental-brand-tabs{display:flex!important;gap:6px!important;margin-bottom:12px!important}',
    R+' .dental-brand-tab{flex:1!important;padding:8px 4px!important;border:1px solid #e5e7eb!important;border-radius:8px!important;font-size:12px!important;font-weight:600!important;text-align:center!important;cursor:pointer!important;transition:all .2s!important;background:#fff!important;color:#6b7280!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:4px!important}',
    R+' .dental-brand-tab.active{border-color:#667eea!important;background:#667eea!important;color:#fff!important}',
    R+' .dental-brand-tab:hover:not(.active){border-color:#c7d2fe!important;background:#f0f4ff!important}',
    R+' .dental-brand-dropdown-wrap{position:relative!important;display:block!important}',
    R+' .dental-brand-dropdown-wrap .dental-select{padding-right:36px!important}',
    R+' .dental-brand-info-btn{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important;width:24px!important;height:24px!important;border:none!important;border-radius:50%!important;background:#667eea!important;color:#fff!important;font-size:11px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:all .2s!important}',
    R+' .dental-brand-info-btn:hover{background:#5a6fd6!important;transform:translateY(-50%) scale(1.1)!important}',
    R+' .dental-brand-info-btn.hidden{display:none!important}',
    /* 브랜드 카테고리 */
    R+' .dental-brand-category{display:inline-flex!important;align-items:center!important;gap:4px!important;padding:3px 8px!important;border-radius:12px!important;font-size:11px!important;font-weight:600!important}',
    R+' .dental-brand-category.domestic{background:#dbeafe!important;color:#1d4ed8!important}',
    R+' .dental-brand-category.foreign{background:#fef3c7!important;color:#92400e!important}',
    /* 모달 - body 직접 자식이므로 ID 셀렉터 불필요 */
    '.dental-modal-overlay{display:none!important;position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;background:rgba(0,0,0,.5)!important;z-index:10000!important;align-items:center!important;justify-content:center!important;padding:16px!important}',
    '.dental-modal-overlay.active{display:flex!important}',
    '.dental-modal{background:#fff!important;border-radius:20px!important;width:100%!important;max-width:480px!important;max-height:85vh!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;animation:dental-modal-in .3s ease!important;font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif!important}',
    '@keyframes dental-modal-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
    '.dental-modal-header{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:18px 20px!important;border-bottom:1px solid #f3f4f6!important}',
    '.dental-modal-header h3{font-size:16px!important;font-weight:700!important;color:#1f2937!important}',
    '.dental-modal-close{width:32px!important;height:32px!important;border:none!important;border-radius:8px!important;background:#f3f4f6!important;color:#6b7280!important;font-size:16px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important}',
    '.dental-modal-close:hover{background:#e5e7eb!important}',
    '.dental-modal-body{flex:1!important;overflow-y:auto!important;padding:20px!important}',
    '.dental-modal-footer{padding:14px 20px!important;border-top:1px solid #f3f4f6!important}',
    '.dental-content-section{margin-bottom:16px!important}',
    '.dental-content-section-title{font-size:13px!important;font-weight:700!important;color:#374151!important;margin-bottom:8px!important;padding:6px 10px!important;background:#f9fafb!important;border-radius:8px!important;display:flex!important;align-items:center!important;gap:6px!important}',
    '.dental-content-section-title i{color:#667eea!important;font-size:11px!important}',
    '.dental-content-item{padding:10px 12px!important;background:#fff!important;border:1px solid #f3f4f6!important;border-radius:8px!important;margin-bottom:6px!important;font-size:13px!important;color:#374151!important;line-height:1.6!important}',
    '.dental-content-empty{text-align:center!important;padding:30px 20px!important;color:#9ca3af!important;font-size:13px!important}',
    '.dental-content-empty i{font-size:28px!important;display:block!important;margin-bottom:8px!important;color:#d1d5db!important}',
    /* 치아 선택 */
    R+' .dental-tooth-section{display:block!important;visibility:visible!important;margin-bottom:16px!important}',
    R+' .dental-tooth-grid{display:grid!important;visibility:visible!important;grid-template-columns:repeat(8,1fr)!important;gap:3px!important;margin-bottom:6px!important}',
    R+' .dental-tooth-btn{display:flex!important;visibility:visible!important;align-items:center!important;justify-content:center!important;padding:6px 2px!important;border:1px solid #e5e7eb!important;border-radius:6px!important;font-size:11px!important;font-weight:600!important;text-align:center!important;cursor:pointer!important;transition:all .15s!important;background:#fff!important;color:#374151!important;min-height:28px!important}',
    R+' .dental-tooth-btn:hover{border-color:#c7d2fe!important;background:#f0f4ff!important}',
    R+' .dental-tooth-btn.selected{border-color:#667eea!important;background:#667eea!important;color:#fff!important}',
    R+' .dental-tooth-divider{display:block!important;text-align:center!important;font-size:10px!important;color:#9ca3af!important;padding:4px 0!important;border-top:1px dashed #e5e7eb!important;border-bottom:1px dashed #e5e7eb!important;margin:4px 0!important}',
    R+' .dental-tooth-selected-list{display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin-top:8px!important}',
    R+' .dental-tooth-tag{display:inline-flex!important;align-items:center!important;gap:4px!important;padding:4px 8px!important;background:#ede9fe!important;color:#7c3aed!important;border-radius:12px!important;font-size:11px!important;font-weight:500!important}',
    R+' .dental-tooth-tag-remove{cursor:pointer!important;font-size:10px!important;opacity:.7!important}',
    R+' .dental-tooth-tag-remove:hover{opacity:1!important}',
    /* 수량 */
    R+' .dental-qty-group{display:flex!important;align-items:center!important;gap:8px!important}',
    R+' .dental-qty-btn{width:32px!important;height:32px!important;border:1px solid #e5e7eb!important;border-radius:8px!important;background:#fff!important;font-size:16px!important;font-weight:700!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#374151!important;transition:all .15s!important}',
    R+' .dental-qty-btn:hover{border-color:#667eea!important;background:#f0f4ff!important}',
    R+' .dental-qty-value{font-size:16px!important;font-weight:700!important;color:#1f2937!important;min-width:24px!important;text-align:center!important}',
    R+' .dental-price-input{width:120px!important;text-align:right!important}',
    /* 치료 항목 */
    R+' .dental-treatment-item{display:block!important;visibility:visible!important;padding:14px!important;background:#f9fafb!important;border-radius:12px!important;margin-bottom:10px!important;border:1px solid #f3f4f6!important}',
    R+' .dental-treatment-item-header{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:8px!important}',
    R+' .dental-treatment-item-name{font-size:14px!important;font-weight:600!important;color:#1f2937!important}',
    R+' .dental-treatment-item-price{font-size:13px!important;color:#667eea!important;font-weight:600!important}',
    R+' .dental-treatment-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}',
    /* 견적 요약 */
    R+' .dental-estimate-summary{display:block!important;visibility:visible!important;padding:16px!important;background:linear-gradient(135deg,#f0f4ff 0%,#faf0ff 100%)!important;border:1px solid #e0e7ff!important;border-radius:12px!important}',
    R+' .dental-estimate-row{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:6px 0!important}',
    R+' .dental-estimate-row.total{border-top:2px solid #c7d2fe!important;margin-top:8px!important;padding-top:10px!important}',
    R+' .dental-estimate-label{font-size:13px!important;color:#4b5563!important}',
    R+' .dental-estimate-value{font-size:14px!important;font-weight:600!important;color:#1f2937!important}',
    R+' .dental-estimate-row.total .dental-estimate-label{font-size:15px!important;font-weight:700!important;color:#1f2937!important}',
    R+' .dental-estimate-row.total .dental-estimate-value{font-size:18px!important;font-weight:800!important;color:#667eea!important}',
    /* 설정 */
    R+' .dental-settings-section{display:block!important;visibility:visible!important;margin-top:16px!important}',
    R+' .dental-settings-toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:12px!important;background:#f9fafb!important;border-radius:10px!important;cursor:pointer!important;margin-bottom:8px!important}',
    R+' .dental-settings-toggle span{font-size:13px!important;color:#374151!important;font-weight:500!important}',
    R+' .dental-settings-toggle i{color:#9ca3af!important;transition:transform .2s!important}',
    R+' .dental-settings-toggle.open i{transform:rotate(180deg)!important}',
    R+' .dental-settings-body{display:none!important;padding:12px!important;background:#f9fafb!important;border-radius:10px!important}',
    R+' .dental-settings-body.open{display:block!important}',
    /* 커스텀 항목 */
    R+' .dental-custom-item{display:flex!important;align-items:center!important;gap:8px!important;padding:8px!important;background:#fff!important;border:1px solid #e5e7eb!important;border-radius:8px!important;margin-bottom:6px!important}',
    R+' .dental-custom-item input{flex:1!important}',
    R+' .dental-custom-item-remove{width:28px!important;height:28px!important;border:none!important;border-radius:6px!important;background:#fee2e2!important;color:#dc2626!important;font-size:12px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important}',
    R+' .dental-custom-item-remove:hover{background:#fecaca!important}',
    /* 토스트 */
    '.dental-toast{position:fixed!important;top:16px!important;right:16px!important;z-index:99999!important;padding:12px 20px!important;border-radius:10px!important;color:#fff!important;font-size:13px!important;font-weight:500!important;box-shadow:0 4px 12px rgba(0,0,0,.15)!important;animation:dental-toast-in .3s ease!important;font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif!important}',
    '@keyframes dental-toast-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}',
    '.dental-toast.success{background:#22c55e!important}',
    '.dental-toast.error{background:#ef4444!important}',
    '.dental-toast.info{background:#667eea!important}',
    /* 인쇄 */
    '@media print{'+R+'{padding:0!important;background:#fff!important}'+R+' .dental-card{box-shadow:none!important;border:1px solid #e5e7eb!important}'+R+' .dental-btn,'+R+' .dental-settings-section,'+R+' .dental-tooth-section{display:none!important}}',
    /* 반응형 */
    '@media(max-width:480px){'+R+'{padding:8px!important}'+R+' .dental-card{padding:16px!important}'+R+' .dental-tooth-grid{grid-template-columns:repeat(8,1fr)!important;gap:2px!important}'+R+' .dental-tooth-btn{padding:5px 1px!important;font-size:10px!important}}'
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.setAttribute('id', 'dentalWidgetStyles');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ====== HTML 템플릿 ======
  var root = document.getElementById('dentalWidgetRoot');
  if (!root) {
    console.error('[DentalWidget] #dentalWidgetRoot not found!');
    return;
  }

  // 아임웹 기존 class 제거하고 위젯 전용 class 설정
  root.className = '';
  root.setAttribute('data-dental-widget', 'true');
  root.innerHTML = [
    '<div class="dental-loading" id="dentalLoading">',
    '  <div class="dental-spinner"></div>',
    '  <div class="dental-loading-text">위젯을 초기화하는 중...</div>',
    '</div>',
    '<div id="dentalMainContent" style="display:none !important">',
    '  <div class="dental-card-header">',
    '    <div class="dental-card-header-icon"><i class="fas fa-tooth"></i></div>',
    '    <h2>임플란트 상담 견적</h2>',
    '    <p id="dentalHeaderClinic">치과 이름</p>',
    '  </div>',
    '  <div class="dental-card">',
    '    <div class="dental-section-title"><i class="fas fa-tags"></i> 임플란트 브랜드 선택</div>',
    '    <div class="dental-brand-tabs">',
    '      <div class="dental-brand-tab active" data-tab="master" onclick="dentalSwitchBrandTab(\'master\')"><i class="fas fa-list"></i> 브랜드 목록</div>',
    '      <div class="dental-brand-tab" data-tab="custom" onclick="dentalSwitchBrandTab(\'custom\')"><i class="fas fa-pen"></i> 직접 입력</div>',
    '    </div>',
    '    <div id="dentalBrandMasterPanel">',
    '      <div class="dental-form-group" style="margin-bottom:8px"><div style="display:flex;gap:6px;">',
    '        <button class="dental-btn dental-btn-sm dental-brand-filter active" data-filter="all" onclick="dentalFilterBrands(\'all\')">전체</button>',
    '        <button class="dental-btn dental-btn-sm dental-brand-filter" data-filter="domestic" onclick="dentalFilterBrands(\'domestic\')">🇰🇷 국산</button>',
    '        <button class="dental-btn dental-btn-sm dental-brand-filter" data-filter="foreign" onclick="dentalFilterBrands(\'foreign\')">🌍 외산</button>',
    '      </div></div>',
    '      <div class="dental-form-group"><div class="dental-brand-dropdown-wrap">',
    '        <select class="dental-select" id="dentalBrandSelect" onchange="dentalOnBrandSelect()"><option value="">브랜드를 선택하세요</option></select>',
    '        <button class="dental-brand-info-btn hidden" id="dentalBrandInfoBtn" onclick="dentalShowBrandContent()" title="브랜드 상세 정보"><i class="fas fa-info"></i></button>',
    '      </div></div>',
    '      <div id="dentalBrandPreview" style="display:none">',
    '        <div style="display:flex;align-items:center;gap:8px;padding:10px;background:#f0f4ff;border-radius:10px;border:1px solid #e0e7ff;">',
    '          <div style="flex:1"><div style="font-size:14px;font-weight:600;color:#1f2937;" id="dentalBrandPreviewName"></div><div style="font-size:12px;color:#6b7280;margin-top:2px;" id="dentalBrandPreviewCategory"></div></div>',
    '          <button class="dental-btn dental-btn-sm dental-btn-outline" onclick="dentalShowBrandContent()"><i class="fas fa-info-circle"></i> 상세</button>',
    '        </div>',
    '      </div>',
    '    </div>',
    '    <div id="dentalBrandCustomPanel" style="display:none">',
    '      <div class="dental-form-group"><label class="dental-label">브랜드명 직접 입력</label>',
    '        <input type="text" class="dental-input" id="dentalBrandCustomInput" placeholder="예: 오스템임플란트 TS III">',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="dental-card">',
    '    <div class="dental-section-title"><i class="fas fa-tooth"></i> 임플란트</div>',
    '    <div class="dental-tooth-section">',
    '      <div class="dental-label">치아 위치 선택 (클릭)</div>',
    '      <div class="dental-tooth-grid" id="dentalTeethUpper"></div>',
    '      <div class="dental-tooth-divider">상악 ↑ · ↓ 하악</div>',
    '      <div class="dental-tooth-grid" id="dentalTeethLower"></div>',
    '      <div class="dental-tooth-selected-list" id="dentalSelectedTeeth"></div>',
    '    </div>',
    '    <div class="dental-treatment-item">',
    '      <div class="dental-treatment-item-header"><span class="dental-treatment-item-name">임플란트</span><span class="dental-treatment-item-price" id="dentalImplantSubtotal">0원</span></div>',
    '      <div class="dental-treatment-row">',
    '        <div class="dental-qty-group"><button class="dental-qty-btn" onclick="dentalChangeQty(\'implant\',-1)">−</button><span class="dental-qty-value" id="dentalImplantQty">0</span><button class="dental-qty-btn" onclick="dentalChangeQty(\'implant\',1)">+</button></div>',
    '        <div><input type="text" class="dental-input dental-price-input" id="dentalImplantPrice" placeholder="단가(원)" oninput="dentalCalcTotal()"></div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="dental-card">',
    '    <div class="dental-section-title"><i class="fas fa-plus-circle"></i> 추가 항목</div>',
    '    <div class="dental-treatment-item"><div class="dental-treatment-item-header"><span class="dental-treatment-item-name">🦴 뼈이식 (Bone Graft)</span><span class="dental-treatment-item-price" id="dentalBoneSubtotal">0원</span></div><div class="dental-treatment-row"><div class="dental-qty-group"><button class="dental-qty-btn" onclick="dentalChangeQty(\'bone\',-1)">−</button><span class="dental-qty-value" id="dentalBoneQty">0</span><button class="dental-qty-btn" onclick="dentalChangeQty(\'bone\',1)">+</button></div><input type="text" class="dental-input dental-price-input" id="dentalBonePrice" placeholder="단가(원)" oninput="dentalCalcTotal()"></div></div>',
    '    <div class="dental-treatment-item"><div class="dental-treatment-item-header"><span class="dental-treatment-item-name">🏥 상악동거상술 (Sinus Lift)</span><span class="dental-treatment-item-price" id="dentalSinusSubtotal">0원</span></div><div class="dental-treatment-row"><div class="dental-qty-group"><button class="dental-qty-btn" onclick="dentalChangeQty(\'sinus\',-1)">−</button><span class="dental-qty-value" id="dentalSinusQty">0</span><button class="dental-qty-btn" onclick="dentalChangeQty(\'sinus\',1)">+</button></div><input type="text" class="dental-input dental-price-input" id="dentalSinusPrice" placeholder="단가(원)" oninput="dentalCalcTotal()"></div></div>',
    '    <div class="dental-treatment-item"><div class="dental-treatment-item-header"><span class="dental-treatment-item-name">🦷 임시치아 (Temporary Crown)</span><span class="dental-treatment-item-price" id="dentalTempSubtotal">0원</span></div><div class="dental-treatment-row"><div class="dental-qty-group"><button class="dental-qty-btn" onclick="dentalChangeQty(\'temp\',-1)">−</button><span class="dental-qty-value" id="dentalTempQty">0</span><button class="dental-qty-btn" onclick="dentalChangeQty(\'temp\',1)">+</button></div><input type="text" class="dental-input dental-price-input" id="dentalTempPrice" placeholder="단가(원)" oninput="dentalCalcTotal()"></div></div>',
    '    <div id="dentalCustomItems"></div>',
    '    <button class="dental-btn dental-btn-secondary" style="width:100%;margin-top:8px;" onclick="dentalAddCustomItem()"><i class="fas fa-plus"></i> 항목 추가</button>',
    '  </div>',
    '  <div class="dental-card">',
    '    <div class="dental-section-title"><i class="fas fa-calculator"></i> 견적 요약</div>',
    '    <div class="dental-estimate-summary" id="dentalEstimateSummary">',
    '      <div class="dental-estimate-row"><span class="dental-estimate-label">선택 브랜드</span><span class="dental-estimate-value" id="dentalEstBrand">-</span></div>',
    '      <div class="dental-estimate-row"><span class="dental-estimate-label">임플란트</span><span class="dental-estimate-value" id="dentalEstImplant">0원</span></div>',
    '      <div class="dental-estimate-row"><span class="dental-estimate-label">추가 항목</span><span class="dental-estimate-value" id="dentalEstAdditional">0원</span></div>',
    '      <div id="dentalEstCustomRows"></div>',
    '      <div class="dental-estimate-row total"><span class="dental-estimate-label">총 견적 금액</span><span class="dental-estimate-value" id="dentalEstTotal">0원</span></div>',
    '    </div>',
    '    <div style="margin-top:14px;display:flex;gap:8px;">',
    '      <button class="dental-btn dental-btn-primary" style="flex:1" onclick="dentalSaveEstimate()"><i class="fas fa-save"></i> 저장</button>',
    '      <button class="dental-btn dental-btn-secondary" style="flex:0 0 auto;" onclick="dentalResetForm()"><i class="fas fa-redo"></i> 초기화</button>',
    '    </div>',
    '  </div>',
    '  <div class="dental-card dental-settings-section">',
    '    <div class="dental-settings-toggle" onclick="dentalToggleSettings()"><span><i class="fas fa-cog" style="margin-right:6px;color:#667eea;"></i> 설정</span><i class="fas fa-chevron-down" id="dentalSettingsArrow"></i></div>',
    '    <div class="dental-settings-body" id="dentalSettingsBody">',
    '      <div class="dental-form-group"><label class="dental-label">치과 이름</label><input type="text" class="dental-input" id="dentalClinicNameInput" placeholder="치과 이름"></div>',
    '      <div class="dental-form-group"><label class="dental-label">전화번호</label><input type="tel" class="dental-input" id="dentalClinicPhoneInput" placeholder="02-1234-5678"></div>',
    '      <button class="dental-btn dental-btn-primary" onclick="dentalSaveSettings()"><i class="fas fa-save"></i> 설정 저장</button>',
    '    </div>',
    '  </div>',
    '  <div style="height:20px;"></div>',
    '</div>'
  ].join('\n');

  // 모달 (body에 추가 - 위젯 밖에 있어야 z-index 동작)
  var modalHtml = [
    '<div class="dental-modal-overlay" id="dentalBrandModal">',
    '  <div class="dental-modal">',
    '    <div class="dental-modal-header"><h3 id="dentalBrandModalTitle">브랜드 정보</h3><button class="dental-modal-close" onclick="dentalCloseBrandModal()"><i class="fas fa-times"></i></button></div>',
    '    <div class="dental-modal-body" id="dentalBrandModalBody"><div class="dental-content-empty"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div></div>',
    '    <div class="dental-modal-footer"><button class="dental-btn dental-btn-primary" onclick="dentalCloseBrandModal()">닫기</button></div>',
    '  </div>',
    '</div>'
  ].join('\n');

  // 기존 모달이 있으면 제거
  var existingModal = document.getElementById('dentalBrandModal');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // ====== 치아 그리드 동적 생성 ======
  var upperTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  var lowerTeeth = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

  function renderTeethGrid(containerId, teeth) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = teeth.map(function(t) {
      return '<div class="dental-tooth-btn" data-tooth="' + t + '" onclick="dentalToggleTooth(this)">' + t + '</div>';
    }).join('');
  }
  renderTeethGrid('dentalTeethUpper', upperTeeth);
  renderTeethGrid('dentalTeethLower', lowerTeeth);

  // ====== 상태 (24개 기본 브랜드 사전 로드) ======
  var _defaultBrands = [
    {id:'brand_osstem',name:'\uC624\uC2A4\uD15C\uC784\uD50C\uB780\uD2B8',category:'domestic',order:0},
    {id:'brand_dentium',name:'\uB374\uD2F0\uC6C0',category:'domestic',order:1},
    {id:'brand_megagen',name:'\uBA54\uAC00\uC820\uC784\uD50C\uB780\uD2B8',category:'domestic',order:2},
    {id:'brand_neobiotech',name:'\uB124\uC624\uBC14\uC774\uC624\uD14D',category:'domestic',order:3},
    {id:'brand_dio',name:'\uB514\uC624',category:'domestic',order:4},
    {id:'brand_dentis',name:'\uB374\uD2F0\uC2A4',category:'domestic',order:5},
    {id:'brand_shinhung',name:'\uC2E0\uD765 / evertis',category:'domestic',order:6},
    {id:'brand_ibs',name:'IBS Implant',category:'domestic',order:7},
    {id:'brand_point',name:'\uD3EC\uC778\uD2B8\uC784\uD50C\uB780\uD2B8',category:'domestic',order:8},
    {id:'brand_cowell',name:'\uCF54\uC6F0\uBA54\uB514',category:'domestic',order:9},
    {id:'brand_warantec',name:'\uC6CC\uB7F0\uD14D',category:'domestic',order:10},
    {id:'brand_biotem',name:'\uBC14\uC774\uC624\uD15C',category:'domestic',order:11},
    {id:'brand_snucone',name:'SNUCONE',category:'domestic',order:12},
    {id:'brand_cubotech',name:'\uCFE0\uBCF4\uD14D(\uCFE0\uC6CC\uD14D)',category:'domestic',order:13},
    {id:'brand_cybermed',name:'\uC0AC\uC774\uBC84\uBA54\uB4DC',category:'domestic',order:14},
    {id:'brand_highness',name:'\uD558\uC774\uB2C8\uC2A4',category:'domestic',order:15},
    {id:'brand_arum',name:'\uC544\uB8F8(ARUM Dentistry)',category:'domestic',order:16},
    {id:'brand_chaorum',name:'\uCC28\uC624\uB984(Chaorum)',category:'domestic',order:17},
    {id:'brand_straumann',name:'\uC2A4\uD2B8\uB77C\uC6B0\uB9CC',category:'foreign',order:18},
    {id:'brand_nobel',name:'\uB178\uBCA8\uBC14\uC774\uC624\uCF00\uC5B4',category:'foreign',order:19},
    {id:'brand_astra',name:'\uC544\uC2A4\uD2B8\uB77C \uD14C\uD06C',category:'foreign',order:20},
    {id:'brand_zimvie',name:'ZimVie',category:'foreign',order:21},
    {id:'brand_sic',name:'SIC',category:'foreign',order:22},
    {id:'brand_anthogyr',name:'Anthogyr',category:'foreign',order:23}
  ];

  var state = {
    userKey: '',
    clinicName: '',
    clinicPhone: '',
    masterBrands: _defaultBrands.slice(),
    masterBrandsFiltered: _defaultBrands.slice(),
    brandContentsCache: {},
    selectedBrandId: '',
    selectedBrandName: '',
    brandMode: 'master',
    brandFilter: 'all',
    selectedTeeth: [],
    quantities: { implant: 0, bone: 0, sinus: 0, temp: 0 },
    customItems: [],
    isMaster: false
  };

  // ====== 아임웹 회원 감지 ======
  function getImwebMemberCode() {
    try {
      if (window.__IMWEB__ && window.__IMWEB__.member) {
        var mc = window.__IMWEB__.member.code || window.__IMWEB__.member.id || '';
        if (mc && String(mc).length >= 4 && !/^\d+$/.test(mc)) return String(mc);
      }
    } catch(e) {}
    try {
      var bs = window.__bs_imweb;
      if (!bs) {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
          var c = cookies[i].trim();
          if (c.indexOf('__bs_imweb=') === 0) {
            bs = JSON.parse(decodeURIComponent(c.substring(11)));
            break;
          }
        }
      }
      if (bs) {
        if (bs.sdk_jwt) {
          try {
            var parts = bs.sdk_jwt.split('.');
            if (parts.length === 3) {
              var p = JSON.parse(atob(parts[1]));
              var sub = p.sub || p.member_code || p.mc || '';
              if (sub && sub !== 'null' && String(sub).length >= 4 && !/^\d+$/.test(sub)) return String(sub);
            }
          } catch(e) {}
        }
        var bc = bs.member_code || (bs.member && (bs.member.code || bs.member.member_code)) || '';
        if (bc && String(bc).length >= 4 && !/^\d+$/.test(bc)) return String(bc);
      }
    } catch(e) {}
    var globals = ['member_data', 'JEJU_MEMBER', '__MEMBER__', 'memberData', '_member', 'member', 'user_data'];
    for (var g = 0; g < globals.length; g++) {
      try {
        var obj = window[globals[g]];
        if (obj && typeof obj === 'object') {
          var mid = obj.member_code || obj.memberCode || obj.code || '';
          if (mid && String(mid).length >= 4 && !/^\d+$/.test(mid)) return String(mid);
        }
      } catch(e) {}
    }
    return '';
  }

  function getUserKey() {
    var mc = getImwebMemberCode();
    if (mc) return mc;
    var saved = localStorage.getItem('dental_widget_user_key');
    if (saved) return saved;
    var key = 'dw_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('dental_widget_user_key', key);
    return key;
  }

  // ====== API ======
  function apiCall(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    if (!options.noAuth && state.userKey) headers['X-User-Key'] = state.userKey;
    if (options.headers) { for (var k in options.headers) headers[k] = options.headers[k]; }
    var fetchOpts = { method: options.method || 'GET', headers: headers };
    if (options.body) fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    return fetch(DENTAL_API + path, fetchOpts).then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok) throw new Error(data.error || 'API error ' + r.status);
        return data;
      });
    });
  }

  function showToast(msg, type) {
    type = type || 'info';
    var d = document.createElement('div');
    d.className = 'dental-toast ' + type;
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function() { d.style.transition = 'opacity 0.3s'; d.style.opacity = '0'; setTimeout(function() { d.remove(); }, 300); }, 2500);
  }

  function formatPrice(n) { return Number(n || 0).toLocaleString('ko-KR') + '\uC6D0'; }
  function parsePrice(s) { return parseInt(String(s || '0').replace(/[^0-9]/g, ''), 10) || 0; }
  function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ====== 초기화 ======
  function init() {
    state.userKey = getUserKey();
    console.log('[DentalWidget] userKey:', state.userKey);
    // 기본 24개 브랜드로 드롭다운 즉시 렌더링 (API 응답 전)
    renderBrandDropdown();
    Promise.all([loadMasterBrands(), loadUserData(), checkMasterPermission()]).then(function() {
      var loadingEl = document.getElementById('dentalLoading');
      var mainEl = document.getElementById('dentalMainContent');
      if (loadingEl) loadingEl.style.cssText = 'display:none!important';
      if (mainEl) mainEl.style.cssText = 'display:block!important;visibility:visible!important';
      updateUI();
    }).catch(function(err) {
      console.error('[DentalWidget] Init error:', err);
      var loadingEl = document.getElementById('dentalLoading');
      if (loadingEl) loadingEl.innerHTML =
        '<div style="color:#ef4444;font-size:13px;text-align:center;padding:20px;">' +
        '<i class="fas fa-exclamation-triangle" style="font-size:24px;display:block;margin-bottom:8px;"></i>' +
        '\uCD08\uAE30\uD654 \uC2E4\uD328: ' + (err.message || '\uC54C \uC218 \uC5C6\uB294 \uC624\uB958') +
        '<br><button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;border:none;border-radius:8px;background:#667eea;color:#fff;cursor:pointer;">\uC0C8\uB85C\uACE0\uCE68</button></div>';
    });
  }

  function loadMasterBrands() {
    return apiCall('/api/master/brands', { noAuth: true }).then(function(data) {
      state.masterBrands = (data.brands || []).sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      state.masterBrandsFiltered = state.masterBrands.slice();
      renderBrandDropdown();
      console.log('[DentalWidget] Loaded', state.masterBrands.length, 'master brands (source:', data.source + ')');
    }).catch(function(err) {
      console.warn('[DentalWidget] Master brands load failed, using defaults:', err);
      state.masterBrands = getDefaultBrands();
      state.masterBrandsFiltered = state.masterBrands.slice();
      renderBrandDropdown();
    });
  }

  function getDefaultBrands() {
    return _defaultBrands.slice();
  }

  function loadUserData() {
    return apiCall('/api/user-data').then(function(data) {
      if (data.clinic_name) state.clinicName = data.clinic_name;
      if (data.clinic_phone) state.clinicPhone = data.clinic_phone;
      var hdr = document.getElementById('dentalHeaderClinic');
      var nameInput = document.getElementById('dentalClinicNameInput');
      var phoneInput = document.getElementById('dentalClinicPhoneInput');
      if (hdr) hdr.textContent = state.clinicName || '\uCE58\uACFC \uC774\uB984';
      if (nameInput) nameInput.value = state.clinicName || '';
      if (phoneInput) phoneInput.value = state.clinicPhone || '';
    }).catch(function(err) {
      console.warn('[DentalWidget] User data load failed:', err);
      state.clinicName = localStorage.getItem('dental_clinic_name') || '';
      state.clinicPhone = localStorage.getItem('dental_clinic_phone') || '';
    });
  }

  function checkMasterPermission() {
    return apiCall('/api/master/check', { noAuth: true }).then(function(data) {
      state.isMaster = data.is_master || false;
    }).catch(function() { state.isMaster = false; });
  }

  function renderBrandDropdown() {
    var select = document.getElementById('dentalBrandSelect');
    if (!select) return;
    var html = '<option value="">\uBE0C\uB79C\uB4DC\uB97C \uC120\uD0DD\uD558\uC138\uC694</option>';
    var domestic = [], foreign = [];
    state.masterBrandsFiltered.forEach(function(b) { if (b.category === 'foreign') foreign.push(b); else domestic.push(b); });
    if (state.brandFilter === 'all' || state.brandFilter === 'domestic') {
      if (domestic.length > 0) {
        html += '<optgroup label="\uD83C\uDDF0\uD83C\uDDF7 \uAD6D\uC0B0 (' + domestic.length + '\uAC1C)">';
        domestic.forEach(function(b) { html += '<option value="' + b.id + '"' + (state.selectedBrandId === b.id ? ' selected' : '') + '>' + escHtml(b.name) + '</option>'; });
        html += '</optgroup>';
      }
    }
    if (state.brandFilter === 'all' || state.brandFilter === 'foreign') {
      if (foreign.length > 0) {
        html += '<optgroup label="\uD83C\uDF0D \uC678\uC0B0 (' + foreign.length + '\uAC1C)">';
        foreign.forEach(function(b) { html += '<option value="' + b.id + '"' + (state.selectedBrandId === b.id ? ' selected' : '') + '>' + escHtml(b.name) + '</option>'; });
        html += '</optgroup>';
      }
    }
    select.innerHTML = html;
  }

  // ====== 이벤트 핸들러 (전역 노출) ======
  window.dentalSwitchBrandTab = function(tab) {
    state.brandMode = tab;
    document.querySelectorAll('#dentalWidgetRoot .dental-brand-tab').forEach(function(el) { el.classList.toggle('active', el.dataset.tab === tab); });
    var masterPanel = document.getElementById('dentalBrandMasterPanel');
    var customPanel = document.getElementById('dentalBrandCustomPanel');
    if (masterPanel) masterPanel.style.cssText = (tab === 'master') ? 'display:block!important' : 'display:none!important';
    if (customPanel) customPanel.style.cssText = (tab === 'custom') ? 'display:block!important' : 'display:none!important';
    updateBrandSelection();
  };

  window.dentalFilterBrands = function(filter) {
    state.brandFilter = filter;
    document.querySelectorAll('#dentalWidgetRoot .dental-brand-filter').forEach(function(el) {
      el.classList.toggle('active', el.dataset.filter === filter);
      if (el.dataset.filter === filter) { el.style.cssText = 'background:#667eea!important;color:#fff!important;border-color:#667eea!important;padding:6px 12px!important;font-size:12px!important;border-radius:8px!important'; }
      else { el.style.cssText = 'background:#f3f4f6!important;color:#374151!important;border-color:#e5e7eb!important;padding:6px 12px!important;font-size:12px!important;border-radius:8px!important'; }
    });
    if (filter === 'all') state.masterBrandsFiltered = state.masterBrands.slice();
    else state.masterBrandsFiltered = state.masterBrands.filter(function(b) { return b.category === filter; });
    renderBrandDropdown();
  };

  window.dentalOnBrandSelect = function() {
    var select = document.getElementById('dentalBrandSelect');
    var brandId = select.value;
    var infoBtn = document.getElementById('dentalBrandInfoBtn');
    var preview = document.getElementById('dentalBrandPreview');
    if (brandId) {
      var brand = state.masterBrands.find(function(b) { return b.id === brandId; });
      state.selectedBrandId = brandId;
      state.selectedBrandName = brand ? brand.name : '';
      infoBtn.classList.remove('hidden');
      preview.style.cssText = 'display:block!important';
      document.getElementById('dentalBrandPreviewName').textContent = brand ? brand.name : '';
      document.getElementById('dentalBrandPreviewCategory').innerHTML = brand ?
        '<span class="dental-brand-category ' + brand.category + '">' + (brand.category === 'domestic' ? '\uD83C\uDDF0\uD83C\uDDF7 \uAD6D\uC0B0' : '\uD83C\uDF0D \uC678\uC0B0') + '</span>' : '';
      preloadBrandContent(brandId);
    } else {
      state.selectedBrandId = ''; state.selectedBrandName = '';
      infoBtn.classList.add('hidden'); preview.style.cssText = 'display:none!important';
    }
    updateBrandSelection(); dentalCalcTotal();
  };

  function preloadBrandContent(brandId) {
    if (state.brandContentsCache[brandId]) return;
    apiCall('/api/master/brand-contents/' + brandId, { noAuth: true }).then(function(data) {
      state.brandContentsCache[brandId] = { categories: data.categories || [], contents: data.contents || {} };
    }).catch(function(err) { console.warn('[DentalWidget] Brand content preload failed:', err); });
  }

  window.dentalShowBrandContent = function() {
    var brandId = state.selectedBrandId;
    if (!brandId) { showToast('\uBE0C\uB79C\uB4DC\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.', 'error'); return; }
    var brand = state.masterBrands.find(function(b) { return b.id === brandId; });
    var modal = document.getElementById('dentalBrandModal');
    var title = document.getElementById('dentalBrandModalTitle');
    var body = document.getElementById('dentalBrandModalBody');
    title.textContent = brand ? brand.name + ' \uC0C1\uC138 \uC815\uBCF4' : '\uBE0C\uB79C\uB4DC \uC815\uBCF4';
    modal.classList.add('active');
    if (state.brandContentsCache[brandId]) { renderBrandContentModal(state.brandContentsCache[brandId], brand); return; }
    body.innerHTML = '<div class="dental-content-empty"><i class="fas fa-spinner fa-spin"></i> \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911...</div>';
    apiCall('/api/master/brand-contents/' + brandId, { noAuth: true }).then(function(data) {
      var content = { categories: data.categories || [], contents: data.contents || {} };
      state.brandContentsCache[brandId] = content;
      renderBrandContentModal(content, brand);
    }).catch(function(err) {
      body.innerHTML = '<div class="dental-content-empty"><i class="fas fa-exclamation-circle"></i> \uCF58\uD150\uCE20\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.<br><small>' + escHtml(err.message) + '</small></div>';
    });
  };

  function renderBrandContentModal(content, brand) {
    var body = document.getElementById('dentalBrandModalBody');
    var html = '<div style="padding:12px;background:linear-gradient(135deg,#f0f4ff,#faf0ff);border-radius:10px;margin-bottom:16px;">';
    html += '<div style="font-size:16px;font-weight:700;color:#1f2937;">' + escHtml(brand ? brand.name : '') + '</div>';
    if (brand) html += '<div style="margin-top:4px;"><span class="dental-brand-category ' + brand.category + '">' + (brand.category === 'domestic' ? '\uD83C\uDDF0\uD83C\uDDF7 \uAD6D\uC0B0' : '\uD83C\uDF0D \uC678\uC0B0') + '</span></div>';
    html += '</div>';
    if (content.categories && content.categories.length > 0) {
      content.categories.forEach(function(cat) {
        html += '<div class="dental-content-section"><div class="dental-content-section-title"><i class="fas fa-folder"></i> ' + escHtml(cat) + '</div>';
        var items = content.contents[cat];
        if (items && Array.isArray(items) && items.length > 0) {
          items.forEach(function(item) {
            if (typeof item === 'string') html += '<div class="dental-content-item">' + escHtml(item) + '</div>';
            else if (typeof item === 'object') {
              html += '<div class="dental-content-item">';
              if (item.title) html += '<strong>' + escHtml(item.title) + '</strong><br>';
              if (item.description) html += escHtml(item.description);
              if (item.url) html += '<br><a href="' + escHtml(item.url) + '" target="_blank" style="color:#667eea;font-size:12px;">\uC790\uC138\uD788 \uBCF4\uAE30</a>';
              html += '</div>';
            }
          });
        } else html += '<div class="dental-content-item" style="color:#9ca3af;font-style:italic;">\uB4F1\uB85D\uB41C \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
        html += '</div>';
      });
    } else {
      html += '<div class="dental-content-empty"><i class="fas fa-info-circle"></i> \uC544\uC9C1 \uB4F1\uB85D\uB41C \uC0C1\uC138 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.';
      if (state.isMaster) html += '<br><small style="margin-top:4px;display:block;">\uB9C8\uC2A4\uD130 \uAD00\uB9AC \uD398\uC774\uC9C0\uC5D0\uC11C \uCF58\uD150\uCE20\uB97C \uCD94\uAC00\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</small>';
      html += '</div>';
    }
    body.innerHTML = html;
  }

  window.dentalCloseBrandModal = function() { document.getElementById('dentalBrandModal').classList.remove('active'); };

  function updateBrandSelection() {
    if (state.brandMode === 'master' && state.selectedBrandId) {
      var brand = state.masterBrands.find(function(b) { return b.id === state.selectedBrandId; });
      state.selectedBrandName = brand ? brand.name : '';
    } else if (state.brandMode === 'custom') {
      state.selectedBrandName = (document.getElementById('dentalBrandCustomInput') || {}).value || '';
    } else { state.selectedBrandName = ''; }
    dentalCalcTotal();
  }

  window.dentalToggleTooth = function(el) {
    var tooth = el.dataset.tooth;
    var idx = state.selectedTeeth.indexOf(tooth);
    if (idx === -1) { state.selectedTeeth.push(tooth); el.classList.add('selected'); }
    else { state.selectedTeeth.splice(idx, 1); el.classList.remove('selected'); }
    state.quantities.implant = state.selectedTeeth.length;
    var qtyEl = document.getElementById('dentalImplantQty');
    if (qtyEl) qtyEl.textContent = state.quantities.implant;
    renderSelectedTeeth(); dentalCalcTotal();
  };

  function renderSelectedTeeth() {
    var container = document.getElementById('dentalSelectedTeeth');
    if (!container) return;
    if (state.selectedTeeth.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = state.selectedTeeth.map(function(t) {
      return '<span class="dental-tooth-tag">#' + t + ' <span class="dental-tooth-tag-remove" onclick="dentalRemoveTooth(\'' + t + '\')">x</span></span>';
    }).join('');
  }

  window.dentalRemoveTooth = function(tooth) {
    var idx = state.selectedTeeth.indexOf(tooth);
    if (idx !== -1) state.selectedTeeth.splice(idx, 1);
    var btn = document.querySelector('#dentalWidgetRoot .dental-tooth-btn[data-tooth="' + tooth + '"]');
    if (btn) btn.classList.remove('selected');
    state.quantities.implant = state.selectedTeeth.length;
    var qtyEl = document.getElementById('dentalImplantQty');
    if (qtyEl) qtyEl.textContent = state.quantities.implant;
    renderSelectedTeeth(); dentalCalcTotal();
  };

  window.dentalChangeQty = function(type, delta) {
    var newQty = Math.max(0, (state.quantities[type] || 0) + delta);
    state.quantities[type] = newQty;
    var qtyEl = document.getElementById('dental' + capitalize(type) + 'Qty');
    if (qtyEl) qtyEl.textContent = newQty;
    dentalCalcTotal();
  };

  window.dentalAddCustomItem = function() {
    var id = 'ci_' + Date.now();
    state.customItems.push({ id: id, name: '', price: 0, qty: 1 });
    renderCustomItems();
  };

  window.dentalRemoveCustomItem = function(id) {
    state.customItems = state.customItems.filter(function(i) { return i.id !== id; });
    renderCustomItems(); dentalCalcTotal();
  };

  function renderCustomItems() {
    var container = document.getElementById('dentalCustomItems');
    if (!container) return;
    container.innerHTML = state.customItems.map(function(item) {
      return '<div class="dental-custom-item" data-id="' + item.id + '">' +
        '<input type="text" class="dental-input" placeholder="\uD56D\uBAA9\uBA85" value="' + escHtml(item.name) + '" oninput="dentalUpdateCustomItem(\'' + item.id + '\',\'name\',this.value)" style="flex:1.5">' +
        '<input type="text" class="dental-input dental-price-input" placeholder="\uAE08\uC561" value="' + (item.price || '') + '" oninput="dentalUpdateCustomItem(\'' + item.id + '\',\'price\',this.value)" style="flex:1">' +
        '<button class="dental-custom-item-remove" onclick="dentalRemoveCustomItem(\'' + item.id + '\')"><i class="fas fa-trash"></i></button></div>';
    }).join('');
  }

  window.dentalUpdateCustomItem = function(id, field, value) {
    var item = state.customItems.find(function(i) { return i.id === id; });
    if (item) { if (field === 'price') item.price = parsePrice(value); else item[field] = value; dentalCalcTotal(); }
  };

  window.dentalCalcTotal = function() {
    var implantPrice = parsePrice((document.getElementById('dentalImplantPrice') || {}).value);
    var bonePrice = parsePrice((document.getElementById('dentalBonePrice') || {}).value);
    var sinusPrice = parsePrice((document.getElementById('dentalSinusPrice') || {}).value);
    var tempPrice = parsePrice((document.getElementById('dentalTempPrice') || {}).value);
    var implantTotal = implantPrice * state.quantities.implant;
    var boneTotal = bonePrice * state.quantities.bone;
    var sinusTotal = sinusPrice * state.quantities.sinus;
    var tempTotal = tempPrice * state.quantities.temp;
    var additionalTotal = boneTotal + sinusTotal + tempTotal;
    var customTotal = 0;
    state.customItems.forEach(function(item) { customTotal += (item.price || 0) * (item.qty || 1); });
    var grandTotal = implantTotal + additionalTotal + customTotal;
    var el;
    el = document.getElementById('dentalImplantSubtotal'); if (el) el.textContent = formatPrice(implantTotal);
    el = document.getElementById('dentalBoneSubtotal'); if (el) el.textContent = formatPrice(boneTotal);
    el = document.getElementById('dentalSinusSubtotal'); if (el) el.textContent = formatPrice(sinusTotal);
    el = document.getElementById('dentalTempSubtotal'); if (el) el.textContent = formatPrice(tempTotal);
    var brandName = state.selectedBrandName || (document.getElementById('dentalBrandCustomInput') || {}).value || '-';
    el = document.getElementById('dentalEstBrand'); if (el) el.textContent = brandName;
    el = document.getElementById('dentalEstImplant'); if (el) el.textContent = formatPrice(implantTotal);
    el = document.getElementById('dentalEstAdditional'); if (el) el.textContent = formatPrice(additionalTotal);
    var customRowsHtml = '';
    state.customItems.forEach(function(item) {
      if (item.name && item.price) customRowsHtml += '<div class="dental-estimate-row"><span class="dental-estimate-label">' + escHtml(item.name) + '</span><span class="dental-estimate-value">' + formatPrice(item.price * (item.qty || 1)) + '</span></div>';
    });
    el = document.getElementById('dentalEstCustomRows'); if (el) el.innerHTML = customRowsHtml;
    el = document.getElementById('dentalEstTotal'); if (el) el.textContent = formatPrice(grandTotal);
  };

  window.dentalToggleSettings = function() {
    var body = document.getElementById('dentalSettingsBody');
    if (!body) return;
    var toggle = body.previousElementSibling;
    body.classList.toggle('open'); if (toggle) toggle.classList.toggle('open');
  };

  window.dentalSaveSettings = function() {
    var nameInput = document.getElementById('dentalClinicNameInput');
    var phoneInput = document.getElementById('dentalClinicPhoneInput');
    var name = nameInput ? nameInput.value.trim() : '';
    var phone = phoneInput ? phoneInput.value.trim() : '';
    if (!name) { showToast('\uCE58\uACFC \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.', 'error'); return; }
    state.clinicName = name; state.clinicPhone = phone;
    localStorage.setItem('dental_clinic_name', name);
    localStorage.setItem('dental_clinic_phone', phone);
    apiCall('/api/user-data', { method: 'PUT', body: { clinic_name: name, clinic_phone: phone } }).then(function() {
      var hdr = document.getElementById('dentalHeaderClinic');
      if (hdr) hdr.textContent = name;
      showToast('\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
    }).catch(function() {
      var hdr = document.getElementById('dentalHeaderClinic');
      if (hdr) hdr.textContent = name;
      showToast('\uC124\uC815 \uC800\uC7A5\uB428 (\uB85C\uCEEC)', 'info');
    });
  };

  window.dentalSaveEstimate = function() {
    var brandName = state.selectedBrandName || (document.getElementById('dentalBrandCustomInput') || {}).value || '';
    if (!brandName) { showToast('\uBE0C\uB79C\uB4DC\uB97C \uC120\uD0DD \uB610\uB294 \uC785\uB825\uD574\uC8FC\uC138\uC694.', 'error'); return; }
    var estimate = {
      brand_name: brandName, brand_id: state.selectedBrandId || null, brand_mode: state.brandMode,
      teeth: state.selectedTeeth.slice(),
      implant: { qty: state.quantities.implant, unit_price: parsePrice((document.getElementById('dentalImplantPrice') || {}).value), total: parsePrice((document.getElementById('dentalImplantPrice') || {}).value) * state.quantities.implant },
      bone_graft: { qty: state.quantities.bone, unit_price: parsePrice((document.getElementById('dentalBonePrice') || {}).value), total: parsePrice((document.getElementById('dentalBonePrice') || {}).value) * state.quantities.bone },
      sinus_lift: { qty: state.quantities.sinus, unit_price: parsePrice((document.getElementById('dentalSinusPrice') || {}).value), total: parsePrice((document.getElementById('dentalSinusPrice') || {}).value) * state.quantities.sinus },
      temp_crown: { qty: state.quantities.temp, unit_price: parsePrice((document.getElementById('dentalTempPrice') || {}).value), total: parsePrice((document.getElementById('dentalTempPrice') || {}).value) * state.quantities.temp },
      custom_items: state.customItems.map(function(i) { return { name: i.name, price: i.price, qty: i.qty || 1 }; }).filter(function(i) { return i.name && i.price; }),
      clinic_name: state.clinicName, saved_at: new Date().toISOString()
    };
    estimate.grand_total = estimate.implant.total + estimate.bone_graft.total + estimate.sinus_lift.total + estimate.temp_crown.total;
    estimate.custom_items.forEach(function(i) { estimate.grand_total += i.price * i.qty; });
    apiCall('/api/user-data', { method: 'PUT', body: { clinic_name: state.clinicName, clinic_phone: state.clinicPhone, last_estimate: estimate, estimates_history: true } }).then(function() {
      showToast('\uACAC\uC801\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4!', 'success');
    }).catch(function() { localStorage.setItem('dental_last_estimate', JSON.stringify(estimate)); showToast('\uACAC\uC801 \uC800\uC7A5\uB428 (\uB85C\uCEEC)', 'info'); });
  };

  window.dentalResetForm = function() {
    state.selectedBrandId = ''; state.selectedBrandName = '';
    var sel = document.getElementById('dentalBrandSelect'); if (sel) sel.value = '';
    var cust = document.getElementById('dentalBrandCustomInput'); if (cust) cust.value = '';
    var infoBtn = document.getElementById('dentalBrandInfoBtn'); if (infoBtn) infoBtn.classList.add('hidden');
    var preview = document.getElementById('dentalBrandPreview'); if (preview) preview.style.cssText = 'display:none!important';
    state.selectedTeeth = [];
    document.querySelectorAll('#dentalWidgetRoot .dental-tooth-btn.selected').forEach(function(el) { el.classList.remove('selected'); });
    var selTeeth = document.getElementById('dentalSelectedTeeth'); if (selTeeth) selTeeth.innerHTML = '';
    state.quantities = { implant: 0, bone: 0, sinus: 0, temp: 0 };
    var ids = ['dentalImplantQty','dentalBoneQty','dentalSinusQty','dentalTempQty'];
    ids.forEach(function(id) { var e = document.getElementById(id); if (e) e.textContent = '0'; });
    var priceIds = ['dentalImplantPrice','dentalBonePrice','dentalSinusPrice','dentalTempPrice'];
    priceIds.forEach(function(id) { var e = document.getElementById(id); if (e) e.value = ''; });
    state.customItems = [];
    var ci = document.getElementById('dentalCustomItems'); if (ci) ci.innerHTML = '';
    dentalCalcTotal();
    showToast('\uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'info');
  };

  function updateUI() {
    var hdr = document.getElementById('dentalHeaderClinic');
    var nameInput = document.getElementById('dentalClinicNameInput');
    var phoneInput = document.getElementById('dentalClinicPhoneInput');
    if (hdr) hdr.textContent = state.clinicName || '\uCE58\uACFC \uC774\uB984';
    if (nameInput) nameInput.value = state.clinicName || '';
    if (phoneInput) phoneInput.value = state.clinicPhone || '';
    dentalFilterBrands('all');
    dentalCalcTotal();
  }

  // ====== 이벤트 리스너 ======
  var modalEl = document.getElementById('dentalBrandModal');
  if (modalEl) modalEl.addEventListener('click', function(e) { if (e.target === this) dentalCloseBrandModal(); });

  var customInput = document.getElementById('dentalBrandCustomInput');
  if (customInput) customInput.addEventListener('input', function() { updateBrandSelection(); });

  // ====== 시작 ======
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
