// Sortable 인스턴스 (함수 호이스팅을 위해 최상단 선언)
let sortableInstance = null;
let playlistItemsSortableInstance = null;
let noticeSortableInstance = null;

let clinicName = INITIAL_DATA.clinicName || '';
let playlists = INITIAL_DATA.playlists || [];
let notices = INITIAL_DATA.notices || [];
let masterItems = INITIAL_DATA.masterItems || [];
let cachedMasterItems = masterItems || [];
let masterItemsCache = masterItems || [];
let currentPlaylist = null;
const playlistCacheById = {};
const tempVideoCacheByPlaylist = {};
let noticeSettings = { font_size: 32, letter_spacing: 0, text_color: '#ffffff', bg_color: '#1a1a2e', bg_opacity: 100, scroll_speed: 50, position: 'bottom' };
let playlistSearchQuery = '';
let masterItemsSignature = '';
let playlistEditorSignature = '';
let masterItemsRefreshTimer = null;
// 아임웹 iframe의 페이지 상단으로부터 top offset (헤더 높이 보정용)
let iframePageTop = 0;
// 스크롤 완료 후 모달 top 재조정 콜백
let pendingModalAdjust = null;
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'iframeTop') {
    iframePageTop = e.data.top || 0;
    // scrollToTop 완료 후 열린 모달의 top을 iframePageTop 기준으로 재조정
    if (pendingModalAdjust) {
      var fn = pendingModalAdjust;
      pendingModalAdjust = null;
      fn(iframePageTop);
    }
  }
});

function getMasterItemsSignature(items) {
  return (items || [])
    .map(item => String(item.id) + ':' + String(item.sort_order || 0))
    .join('|');
}

function getPlaylistEditorSignature(masterItems, playlist) {
  const masterSig = getMasterItemsSignature(masterItems);
  const itemSig = (playlist?.items || [])
    .map(item => String(item.id) + ':' + String(item.sort_order || 0))
    .join('|');
  const activeSig = (playlist?.activeItemIds || [])
    .map(id => String(id))
    .join('|');
  return [masterSig, itemSig, activeSig].join('||');
}

async function refreshPlaylistEditorData() {
  if (!currentPlaylist) return;
  const editModal = document.getElementById('edit-playlist-modal');
  if (!editModal || editModal.classList.contains('hidden')) return;

  try {
    const masterRes = await fetch(window.location.origin + '/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
    if (masterRes.ok) {
      const masterData = await masterRes.json();
      cachedMasterItems = masterData.items || [];
      masterItemsCache = cachedMasterItems;
    }
  } catch (e) {}

  // playlist items(라이브러리 항목)만 갱신 - activeItemIds는 로컬 유지
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '?ts=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.playlist) {
        const savedActiveIds = currentPlaylist.activeItemIds; // 로컬 상태 보존
        currentPlaylist = data.playlist;
        currentPlaylist.activeItemIds = savedActiveIds;       // 덮어쓰기 방지
        playlistCacheById[currentPlaylist.id] = currentPlaylist;
      }
    }
  } catch (e) {}

  // 라이브러리 패널만 갱신
  if (typeof renderLibraryOnly === 'function') renderLibraryOnly();
}

function startMasterItemsAutoRefresh() {
  if (masterItemsRefreshTimer) clearInterval(masterItemsRefreshTimer);
  // 30초마다 라이브러리만 조용히 갱신
  masterItemsRefreshTimer = setInterval(refreshPlaylistEditorData, 30000);
}

function normalizePlaylistSearchValue(value) {
  return (value || '')
    .toString()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/[._-]/g, '');
}

function getPlaylistSearchText(item) {
  return [item.title, item.name, item.display_title, item.original_title, item.url]
    .filter(Boolean)
    .join(' ');
}

function updatePlaylistSearch() {
  const input = document.getElementById('playlist-search');
  playlistSearchQuery = (input?.value || '').trim();
  renderPlaylistSearchResults();
}

function updateLibrarySearch() {
  const input = document.getElementById('library-search');
  playlistSearchQuery = (input?.value || '').trim();
  renderLibrarySearchResults();
}

function renderLibrarySearchResults() {
  const resultsContainer = document.getElementById('library-search-results');
  const messageEl = document.getElementById('library-search-message');
  if (!resultsContainer) return;

  const query = (playlistSearchQuery || '').trim();
  const normalizedQuery = normalizePlaylistSearchValue(query);
  if (!normalizedQuery) {
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('hidden');
    if (messageEl) messageEl.classList.add('hidden');
    return;
  }

  const items = currentPlaylist?.items || [];
  const masterItemsList = masterItemsCache || [];
  const allItems = [
    ...masterItemsList.map(item => ({ ...item, is_master: true })),
    ...items.map(item => ({ ...item, is_master: false }))
  ];

  const matches = allItems.filter(item => {
    const text = getPlaylistSearchText(item);
    const normalizedText = normalizePlaylistSearchValue(text);
    return normalizedText.includes(normalizedQuery);
  });

  if (matches.length === 0) {
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('hidden');
    if (messageEl) messageEl.classList.remove('hidden');
    return;
  }

  if (messageEl) messageEl.classList.add('hidden');
  resultsContainer.innerHTML = matches.map(item => {
    const itemId = String(item.id);
    const itemType = item.item_type || item.type || '';
    const thumb = item.thumbnail_url
      ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">'
      : itemType === 'image'
        ? '<img src="' + item.url + '" class="w-full h-full object-cover">'
        : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-' + itemType + ' text-gray-400"></i></div>';
    const badge = item.is_master
      ? '<span class="text-xs bg-purple-100 text-purple-600 px-1 rounded">공용</span>'
      : '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">내 영상</span>';

    return ''
      + '<button type="button" class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left" data-library-search-item="1" data-item-id="' + itemId + '" data-item-master="' + (item.is_master ? 1 : 0) + '" onclick="handleLibrarySearchSelect(this.dataset.itemId, this.dataset.itemMaster)">'
      + '<div class="w-12 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">' + thumb + '</div>'
      + '<div class="flex-1 min-w-0">'
      + '<p class="text-sm truncate">' + (item.title || item.url) + '</p>'
      + '<p class="text-xs text-gray-400">' + itemType + ' ' + badge + '</p>'
      + '</div>'
      + '</button>';
  }).join('');
  resultsContainer.classList.remove('hidden');
  const buttons = resultsContainer.querySelectorAll('[data-library-search-item="1"]');
  buttons.forEach((btn) => {
    const itemId = btn.getAttribute('data-item-id');
    const isMaster = btn.getAttribute('data-item-master') === '1';
    btn.addEventListener('click', () => handleLibrarySearchSelect(itemId, isMaster));
  });
}

function focusLibraryItem(itemId, isMaster) {
  const container = document.getElementById('library-user-list')?.parentElement;
  if (!container) return;
  const selector = '[data-library-id="' + itemId + '"][data-library-master="' + isMaster + '"]';
  const itemEl = container.querySelector(selector);
  if (!itemEl) return;
  itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  itemEl.classList.add('library-item-highlight');
  setTimeout(() => {
    itemEl.classList.remove('library-item-highlight');
  }, 1500);
}

function handleLibrarySearchSelect(itemId, isMaster) {
  addToPlaylistFromLibrary(itemId);
  const input = document.getElementById('library-search');
  if (input) input.value = '';
  playlistSearchQuery = '';
  const messageEl = document.getElementById('library-search-message');
  if (messageEl) messageEl.classList.add('hidden');
  const resultsContainer = document.getElementById('library-search-results');
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('hidden');
  }
  renderLibrarySearchResults();
}

function renderPlaylistSearchResults() {
  const resultsContainer = document.getElementById('playlist-search-results');
  if (!resultsContainer) return;

  const query = playlistSearchQuery;
  if (!query) {
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('hidden');
    return;
  }

  const normalizedQuery = normalizePlaylistSearchValue(query);
  const filteredItems = playlistSearchItems.filter(item => {
    const searchText = getPlaylistSearchText(item);
    return searchText.includes(query) || normalizePlaylistSearchValue(searchText).includes(normalizedQuery);
  });

  if (filteredItems.length === 0) {
    resultsContainer.innerHTML = '<div class="text-center py-3 text-gray-400 text-sm">검색 결과가 없습니다</div>';
    resultsContainer.classList.remove('hidden');
    return;
  }

  resultsContainer.innerHTML = filteredItems.map(item => {
    const itemId = String(item.id);
    const itemType = item.item_type || item.type || '';
    const thumb = item.thumbnail_url
      ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">'
      : itemType === 'image'
        ? '<img src="' + item.url + '" class="w-full h-full object-cover">'
        : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-' + itemType + ' text-gray-400"></i></div>';
    const badge = item.is_master
      ? '<span class="text-xs bg-purple-100 text-purple-600 px-1 rounded">공용</span>'
      : '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">내 영상</span>';

    return ''
      + '<button type="button" class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left" onclick="focusPlaylistItem(&quot;' + itemId + '&quot;, ' + (item.is_master ? 1 : 0) + ')">'
      + '<div class="w-12 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">' + thumb + '</div>'
      + '<div class="flex-1 min-w-0">'
      + '<p class="text-sm truncate">' + (item.title || item.url) + '</p>'
      + '<p class="text-xs text-gray-400">' + itemType + ' ' + badge + '</p>'
      + '</div>'
      + '</button>';
  }).join('');

  resultsContainer.classList.remove('hidden');
}

function focusPlaylistItem(itemId, isMaster) {
  const container = document.getElementById('playlist-items-container');
  if (!container) return;

  const selector = '[data-id="' + itemId + '"][data-master="' + isMaster + '"]';
  const itemEl = container.querySelector(selector);
  if (!itemEl) return;

  itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  itemEl.classList.add('playlist-item-highlight');
  setTimeout(() => {
    itemEl.classList.remove('playlist-item-highlight');
  }, 1500);
}

function init() {
  // 초기 데이터로 즉시 렌더링 (API 호출 없이)
  const loadingDiv = document.getElementById('loading');
  const dashboardDiv = document.getElementById('dashboard');
  if (loadingDiv) loadingDiv.style.display = 'none';
  // dashboard는 이미 표시 상태이므로 추가 처리 불필요

  if (INITIAL_DATA.isOwnerAdmin) {
    document.getElementById('clinic-name-text').textContent = '관리자';
    document.getElementById('clinic-name-text').classList.remove('cursor-pointer');
    document.getElementById('clinic-name-text').onclick = null;
  } else {
    document.getElementById('clinic-name-text').innerHTML = clinicName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
  }
  
  // 이미 로드된 데이터로 즉시 렌더링
  renderPlaylists();
  renderNotices();
  checkMasterLoginStatus();
  
  // 설정은 백그라운드에서 로드 (UI 업데이트용)
  loadNoticeSettings();
  setupAutoHeight();
  
  // 5초마다 플레이리스트 자동 갱신 (사용중 상태 실시간 반영)
  // 편집 모달이 열려있을 때는 갱신 skip (덮어쓰기 방지)
  setInterval(async () => {
    const editModal = document.getElementById('edit-playlist-modal');
    if (editModal && editModal.style.display !== 'none') return;
    await loadPlaylists();
  }, 5000);
}

// DOMContentLoaded 또는 즉시 실행 (이미 fired된 경우 대비)
function runInit() {
  try {
    init();
  } catch (e) {
    console.error('Admin init error:', e);
    const loadingEl = document.getElementById('loading');
    const dashboardEl = document.getElementById('dashboard');
    if (loadingEl) loadingEl.style.display = 'none';
    // dashboard는 이미 표시 상태
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}

// 공용자료 로드 (관리자 페이지용)
async function loadMasterItemsForAdmin() {
  try {
    const res = await fetch('/api/master/items');
    const data = await res.json();
    masterItems = data.items || [];
  } catch (e) {
    console.error('Load master items error:', e);
    masterItems = [];
  }
}

async function loadNoticeSettings() {
  try {
    const res = await fetch(API_BASE + '/settings');
    const data = await res.json();
    noticeSettings = {
      font_size: data.notice_font_size || 32,
      letter_spacing: data.notice_letter_spacing ?? 0,
      text_color: data.notice_text_color || '#ffffff',
      bg_color: data.notice_bg_color || '#1a1a2e',
      bg_opacity: data.notice_bg_opacity ?? 100,
      scroll_speed: data.notice_scroll_speed || 50,
      enabled: data.notice_enabled ?? 0,
      position: data.notice_position || 'bottom'
    };
    // UI 업데이트
    document.getElementById('global-notice-font-size').value = noticeSettings.font_size;
    document.getElementById('global-notice-letter-spacing').value = noticeSettings.letter_spacing;
    document.getElementById('global-notice-scroll-speed').value = noticeSettings.scroll_speed;
    document.getElementById('global-notice-text-color').value = noticeSettings.text_color;
    document.getElementById('global-notice-bg-color').value = noticeSettings.bg_color;
    document.getElementById('global-notice-bg-opacity').value = noticeSettings.bg_opacity;
    
    // 공지 위치 설정
    const positionEl = document.getElementById('global-notice-position');
    if (positionEl) {
      positionEl.value = noticeSettings.position;
      updateNoticePositionButtons(noticeSettings.position);
    }
    
    // 공지 전체 ON/OFF 상태
    const enabledCheckbox = document.getElementById('notice-global-enabled') || document.getElementById('global-notice-enabled');
    const styleSettings = document.getElementById('notice-style-settings');
    if (enabledCheckbox) {
      enabledCheckbox.checked = noticeSettings.enabled === 1;
      if (styleSettings && !enabledCheckbox.checked) {
        styleSettings.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    
    updateNoticePreview();
    updateScrollSpeedLabel();
    updateNoticeOpacityLabel();
  } catch (e) {
    console.error('Load notice settings error:', e);
  }
}

function updateNoticePreview() {
  const fontSize = parseInt(document.getElementById('global-notice-font-size').value);
  const letterSpacing = parseFloat(document.getElementById('global-notice-letter-spacing').value || '0');
  const textColor = document.getElementById('global-notice-text-color').value;
  const bgColor = document.getElementById('global-notice-bg-color').value;
  const bgOpacity = parseInt(document.getElementById('global-notice-bg-opacity').value) / 100;
  
  const previewBar = document.getElementById('notice-preview-bar');
  const previewText = document.getElementById('notice-preview-text');
  if (!previewBar || !previewText) return;
  
  // hex를 rgba로 변환
  const r = parseInt(bgColor.slice(1,3), 16);
  const g = parseInt(bgColor.slice(3,5), 16);
  const b = parseInt(bgColor.slice(5,7), 16);
  previewBar.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
  previewText.style.color = textColor;
  // 미리보기는 최대 24px로 제한 (실제 TV에서는 설정된 크기로 표시)
  previewText.style.fontSize = Math.min(fontSize, 24) + 'px';
  previewText.style.letterSpacing = letterSpacing + 'px';
  previewText.style.fontWeight = 'bold';
  previewText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
  previewText.textContent = '공지 미리보기 (' + fontSize + 'px)';
  
  // 미리보기 바의 패딩 - 컴팩트하게
  previewBar.style.padding = '8px 15px';
}

let noticeSaveTimer = null;
function scheduleSaveNoticeSettings() {
  if (noticeSaveTimer) clearTimeout(noticeSaveTimer);
  noticeSaveTimer = setTimeout(() => {
    saveGlobalNoticeSettings();
  }, 400);
}

function updateScrollSpeedLabel() {
  const speed = parseInt(document.getElementById('global-notice-scroll-speed').value);
  const label = document.getElementById('scroll-speed-label');
  if (label) {
    if (speed <= 30) label.textContent = '느림 (' + speed + ')';
    else if (speed <= 70) label.textContent = '보통 (' + speed + ')';
    else if (speed <= 120) label.textContent = '빠름 (' + speed + ')';
    else label.textContent = '매우 빠름 (' + speed + ')';
  }
  updateNoticePreview();
}

async function toggleGlobalNotice() {
  const enabledCheckbox = document.getElementById('notice-global-enabled') || document.getElementById('global-notice-enabled');
  if (!enabledCheckbox) return;
  const enabled = enabledCheckbox.checked;
  const styleSettings = document.getElementById('notice-style-settings');
  
  // UI 토글
  if (enabled) {
    styleSettings.classList.remove('opacity-50', 'pointer-events-none');
  } else {
    styleSettings.classList.add('opacity-50', 'pointer-events-none');
  }
  
  // 서버에 저장
  try {
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice_enabled: enabled ? 1 : 0 })
    });
    showToast(enabled ? '공지가 활성화되었습니다.' : '공지가 비활성화되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

function updateNoticeOpacityLabel() {
  const opacity = document.getElementById('global-notice-bg-opacity').value;
  const label = document.getElementById('notice-opacity-label');
  if (label) label.textContent = opacity + '%';
  updateNoticePreview();
}

async function saveGlobalNoticeSettings() {
  const positionEl = document.getElementById('global-notice-position');
  const settings = {
    notice_font_size: parseInt(document.getElementById('global-notice-font-size').value),
    notice_letter_spacing: parseFloat(document.getElementById('global-notice-letter-spacing').value || '0'),
    notice_scroll_speed: parseInt(document.getElementById('global-notice-scroll-speed').value),
    notice_text_color: document.getElementById('global-notice-text-color').value,
    notice_bg_color: document.getElementById('global-notice-bg-color').value,
    notice_bg_opacity: parseInt(document.getElementById('global-notice-bg-opacity').value),
    notice_position: positionEl ? positionEl.value : 'bottom'
  };
  
  updateNoticePreview();
  
  try {
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    showToast('공지 스타일이 저장되었습니다. TV에 곧 반영됩니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

// 공지 위치 설정
function setNoticePosition(position) {
  document.getElementById('global-notice-position').value = position;
  updateNoticePositionButtons(position);
  saveGlobalNoticeSettings();
}

function updateNoticePositionButtons(position) {
  const topBtn = document.getElementById('position-top-btn');
  const bottomBtn = document.getElementById('position-bottom-btn');
  if (!topBtn || !bottomBtn) return;
  
  if (position === 'top') {
    topBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-indigo-500 text-white';
    bottomBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200';
  } else {
    topBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200';
    bottomBtn.className = 'flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-indigo-500 text-white';
  }
}

function showTab(tab) {
  ['playlists', 'notices', 'master'].forEach(t => {
    const content = document.getElementById('content-' + t);
    const tabBtn = document.getElementById('tab-' + t);
    if (content) content.classList.toggle('hidden', t !== tab);
    if (tabBtn) {
      if (t === 'master') {
        tabBtn.classList.toggle('border-purple-500', t === tab);
        tabBtn.classList.toggle('text-purple-600', t === tab);
      } else {
        tabBtn.classList.toggle('border-blue-500', t === tab);
        tabBtn.classList.toggle('text-blue-500', t === tab);
      }
      tabBtn.classList.toggle('border-transparent', t !== tab);
      tabBtn.classList.toggle('text-gray-500', t !== tab);
    }
  });
}

// ============================================
// 마스터 관리자 기능 (아임웹 관리자 전용)
// ============================================
let isMasterLoggedIn = sessionStorage.getItem('masterLoggedIn') === 'true';
const MASTER_API = '/api/master';

// 페이지 로드 시 로그인 상태 확인
function checkMasterLoginStatus() {
  const loginSection = document.getElementById('master-login-section');
  const contentSection = document.getElementById('master-content-section');
  if (!loginSection || !contentSection) return;
  
  if (isMasterLoggedIn) {
    loginSection.classList.add('hidden');
    contentSection.classList.remove('hidden');
    loadMasterData();
  }
}

async function masterLogin() {
  const password = document.getElementById('master-password-input').value;
  try {
    const res = await fetch(MASTER_API + '/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    if (res.ok) {
      isMasterLoggedIn = true;
      sessionStorage.setItem('masterLoggedIn', 'true');
      document.getElementById('master-login-section').classList.add('hidden');
      document.getElementById('master-content-section').classList.remove('hidden');
      document.getElementById('master-login-error').classList.add('hidden');
      loadMasterData();
    } else {
      document.getElementById('master-login-error').classList.remove('hidden');
    }
  } catch (e) {
    console.error(e);
    document.getElementById('master-login-error').classList.remove('hidden');
  }
}

function masterLogout() {
  isMasterLoggedIn = false;
  sessionStorage.removeItem('masterLoggedIn');
  document.getElementById('master-login-section').classList.remove('hidden');
  document.getElementById('master-content-section').classList.add('hidden');
  document.getElementById('master-password-input').value = '';
}

async function loadMasterData() {
  try {
    const infoRes = await fetch(MASTER_API + '/info');
    const infoData = await infoRes.json();
    
    if (!infoData.masterPlaylist) {
      await fetch(MASTER_API + '/playlist', { method: 'POST' });
    }
    
    await loadMasterItems();
  } catch (e) {
    console.error(e);
  }
}

async function loadMasterItems() {
  try {
    const res = await fetch(MASTER_API + '/items');
    const data = await res.json();
    const items = data.items || [];
    
    const countEl = document.getElementById('master-item-count');
    if (countEl) countEl.textContent = items.length + '개';
    
    const container = document.getElementById('master-items-container');
    if (!container) return;
    
    if (items.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-center py-8">동영상을 추가해주세요</p>';
      return;
    }
    
    container.innerHTML = items.map((item, idx) => `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <span class="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">${idx + 1}</span>
        <div class="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 master-thumb-loading" data-item-id="${item.id}" data-type="${item.item_type}" data-url="${item.url}">
          ${item.thumbnail_url ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">` : 
            `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-spinner fa-spin"></i></div>`}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-800 truncate" id="master-title-${item.id}">${item.title || item.url}</p>
          <p class="text-xs text-gray-500">${item.item_type.toUpperCase()}</p>
        </div>
        <button onclick="masterDeleteItem(${item.id})" class="text-red-500 hover:text-red-600 p-2">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');
    
    loadMasterThumbnails();
  } catch (e) {
    console.error(e);
  }
}

async function loadMasterThumbnails() {
  const thumbs = document.querySelectorAll('.master-thumb-loading');
  for (const el of thumbs) {
    if (el.querySelector('img')) continue;
    const type = el.dataset.type;
    const url = el.dataset.url;
    
    if (type === 'vimeo') {
      const match = url.match(/vimeo\.com\/(\d+)/);
      if (match) {
        try {
          const res = await fetch('/api/vimeo-thumbnail/' + match[1]);
          const data = await res.json();
          if (data.success && data.thumbnail) {
            el.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
          } else {
            el.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
          }
        } catch (e) {
          el.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
        }
      }
    } else if (type === 'youtube') {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if (match) {
        el.innerHTML = '<img src="https://img.youtube.com/vi/' + match[1] + '/mqdefault.jpg" class="w-full h-full object-cover">';
      }
    }
  }
}

async function masterAddItem() {
  const input = document.getElementById('master-new-url');
  const url = input.value.trim();
  if (!url) {
    showToast('URL을 입력해주세요.', 'error');
    return;
  }
  if (!url.includes('vimeo.com')) {
    showToast('Vimeo URL만 지원됩니다.', 'error');
    return;
  }
  
  try {
    const res = await fetch(MASTER_API + '/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (res.ok) {
      input.value = '';
      showToast('추가되었습니다.');
      loadMasterItems();
    } else {
      const data = await res.json();
      showToast(data.error || '추가 실패', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('추가 실패', 'error');
  }
}

async function masterDeleteItem(itemId) {
  if (!confirm('이 동영상을 삭제하시겠습니까?\n삭제하면 모든 치과에서 즉시 제거됩니다.')) return;
  
  try {
    await fetch(MASTER_API + '/items/' + itemId, { method: 'DELETE' });
    showToast('삭제되었습니다.');
    loadMasterItems();
  } catch (e) {
    console.error(e);
    showToast('삭제 실패', 'error');
  }
}

async function loadPlaylists() {
  try {
    const res = await fetch(API_BASE + '/playlists');
    const data = await res.json();
    playlists = data.playlists || [];
    clinicName = data.clinic_name || '내 치과';
    document.getElementById('clinic-name-text').innerHTML = clinicName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
    renderPlaylists();
  } catch (e) {
    console.error('Load playlists error:', e);
  }
}

function renderPlaylists() {
  const container = document.getElementById('playlists-container');
  
  // 초기 설정 섹션 열림 상태 미리 저장 (innerHTML 교체 전)
  const exportSectionBefore = document.getElementById('export-section-content');
  const wasExportOpen = exportSectionBefore && exportSectionBefore.style.display === 'block';
  
  // 체크박스 선택 상태 미리 저장 (innerHTML 교체 후 복원용)
  const checkedIds = new Set(
    Array.from(document.querySelectorAll('.chair-checkbox:checked'))
      .map(cb => cb.dataset.id)
  );
  
  if (playlists.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <i class="fas fa-folder-open text-4xl text-gray-300 mb-4"></i>
        <p class="text-gray-500 mb-4">등록된 대기실/체어가 없습니다.</p>
        <button onclick="showCreatePlaylistModal()" class="text-blue-500 hover:text-blue-600">
          <i class="fas fa-plus mr-2"></i>대기실/체어 추가
        </button>
      </div>
    `;
    return;
  }
  
  // =========================================================
  // 체어와 대기실 분리
  // - 체어: 이름에 '체어'가 포함된 항목 (스크립트 다운로드 방식)
  // - 대기실: 이름에 '체어'가 없는 항목 (단축 URL + USB 북마크 방식)
  // =========================================================
  const chairs = playlists
    .filter(p => p.name.includes('체어'))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  const waitingRooms = playlists
    .filter(p => !p.name.includes('체어'))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  
  // 대기실/체어 분리하여 표시
  container.innerHTML = `
    <!-- =========================================================
         대기실 목록
         ========================================================= -->
    ${waitingRooms.length > 0 ? `
    <div class="mb-6">
      <h3 class="text-sm font-bold text-teal-600 mb-3 flex items-center">
        <i class="fas fa-couch mr-2"></i>대기실 (${waitingRooms.length}개)
        <span class="ml-2 text-xs text-gray-400 font-normal">드래그하여 순서 변경</span>
      </h3>
      <div id="waitingroom-sortable-container" class="grid gap-3">
        ${waitingRooms.map((p, idx) => {
          const isActive = p.is_tv_active === true;
          return `
        <div class="bg-white rounded-xl shadow-sm overflow-hidden playlist-sortable-item cursor-move border-l-4 ${isActive ? 'border-green-500' : 'border-teal-400'}" 
             id="playlist-card-main-${p.id}" data-playlist-id="${p.id}" draggable="true">
          <div class="p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 flex items-center justify-center text-gray-300 cursor-grab drag-handle">
                <i class="fas fa-grip-vertical"></i>
              </div>
              <div class="w-10 h-10 ${isActive ? 'bg-green-100' : 'bg-teal-100'} rounded-lg flex items-center justify-center relative">
                <i class="fas fa-couch ${isActive ? 'text-green-500' : 'text-teal-500'}"></i>
                ${isActive ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" title="TV 사용중"></span>' : ''}
              </div>
              <div>
                <h3 class="font-bold text-gray-800">
                  ${p.name}
                  ${isActive ? '<span class="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">사용중</span>' : ''}
                  ${!p.external_short_url ? '<span id="badge-setup-' + p.id + '" class="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">TV 설정 필요</span>' : ''}
                </h3>
                <p class="text-xs text-gray-500">
                  <span class="text-teal-600 font-mono">${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}</span>
                  <span class="mx-2">•</span>
                  ${p.item_count || 0}개 미디어
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="openPlaylistEditor(${p.id})" 
                class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs">
                플레이리스트
              </button>
              <button onclick="openTVMirror('${p.short_code}', ${p.item_count || 0})" 
                class="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded text-xs">
                TV로 내보내기
              </button>
              <button onclick="copyToClipboard('${p.external_short_url || location.origin + '/' + p.short_code}')" 
                class="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-xs">
                URL 복사
              </button>
              <button onclick="deletePlaylist(${p.id})" 
                class="p-2 text-red-400 hover:text-red-600" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
        `}).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- =========================================================
         체어 목록
         ========================================================= -->
    ${chairs.length > 0 ? `
    <div class="mb-4">
      <h3 class="text-sm font-bold text-indigo-600 mb-3 flex items-center">
        <i class="fas fa-tv mr-2"></i>체어 (${chairs.length}개)
        <span class="ml-2 text-xs text-gray-400 font-normal">드래그하여 순서 변경</span>
      </h3>
      <div id="chair-sortable-container" class="grid gap-3">
        ${chairs.map((p, idx) => {
          const isActive = p.is_tv_active === true;
          return `
        <div class="bg-white rounded-xl shadow-sm overflow-hidden playlist-sortable-item cursor-move border-l-4 ${isActive ? 'border-green-500' : 'border-indigo-400'}" 
             id="playlist-card-main-${p.id}" data-playlist-id="${p.id}" draggable="true">
          <div class="p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 flex items-center justify-center text-gray-300 cursor-grab drag-handle">
                <i class="fas fa-grip-vertical"></i>
              </div>
              <div class="w-10 h-10 ${isActive ? 'bg-green-100' : 'bg-indigo-100'} rounded-lg flex items-center justify-center relative">
                <i class="fas fa-tv ${isActive ? 'text-green-500' : 'text-indigo-500'}"></i>
                ${isActive ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" title="TV 사용중"></span>' : ''}
                <span id="temp-indicator-${p.id}" class="hidden absolute -top-1 -left-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" title="임시 영상 재생 중"></span>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">
                  ${p.name}
                  ${isActive ? '<span class="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">사용중</span>' : ''}
                  ${!p.last_active_at ? '<span class="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">체어 설치 필요</span>' : ''}
                </h3>
                <p class="text-xs text-gray-500">
                  <span class="text-indigo-600 font-mono">${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}</span>
                  <span class="mx-2">•</span>
                  ${p.item_count || 0}개 미디어
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="openPlaylistEditor(${p.id})" 
                class="px-3 py-1.5 w-[110px] bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs text-center">
                플레이리스트
              </button>
              <button onclick="openTVMirror('${p.short_code}', ${p.item_count || 0})" 
                class="px-3 py-1.5 w-[110px] bg-green-50 hover:bg-green-100 text-green-600 rounded text-xs text-center">
                TV로 내보내기
              </button>
              <button onclick="showTempVideoModal(${p.id}, '${p.name}', '${p.short_code}')" 
                class="px-3 py-1.5 w-[110px] bg-orange-50 hover:bg-orange-100 text-orange-600 rounded text-xs text-center">
                임시 영상 전송
              </button>
              <button id="stop-temp-btn-${p.id}" onclick="stopTempVideoForPlaylist(${p.id})" 
                class="px-3 py-1.5 w-[110px] bg-gray-50 text-gray-600 border border-gray-200 rounded text-xs font-medium text-center cursor-not-allowed inline-flex items-center justify-center gap-1 opacity-100 visible whitespace-nowrap" aria-disabled="true">
                <i class="fas fa-stop"></i>
                <span>기본으로 복귀</span>
              </button>
              <button onclick="copyToClipboard('${p.external_short_url || location.origin + '/' + p.short_code}')" 
                class="px-3 py-1.5 w-[110px] bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-xs text-center">
                URL 복사
              </button>
              <button onclick="deletePlaylist(${p.id})" 
                class="p-2 text-red-400 hover:text-red-600" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
        `}).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- =========================================================
         초기 설정 섹션 (접기/펼치기)
         ========================================================= -->
    <div class="border border-gray-300 rounded-xl overflow-hidden bg-gray-50">
      <button onclick="toggleExportSection()" class="w-full p-4 bg-gray-100 flex items-center justify-between hover:bg-gray-200 transition">
        <span class="font-bold text-gray-700 flex items-center gap-2">
          <i class="fas fa-cog"></i>초기 설정 (TV 연결)
        </span>
        <i id="export-toggle-icon" class="fas fa-chevron-down text-gray-400"></i>
      </button>
      <div id="export-section-content" style="display:none" class="bg-gray-50 p-4">
        
        <!-- 체어 설정 -->
        <div class="mb-4">
          <div class="flex items-center gap-2 mb-3 pb-2 border-b-2 border-indigo-400">
            <i class="fas fa-tv text-indigo-500"></i>
            <span class="font-bold text-gray-800">체어 설정</span>
            <span class="text-xs text-gray-500">(PC 모니터 자동 실행)</span>
          </div>
          
          ${chairs.length > 0 ? `
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex flex-wrap gap-2 mb-3">
              ${chairs.map(p => `
                <label class="flex items-center gap-2 bg-gray-100 hover:bg-indigo-50 px-3 py-2 rounded-lg cursor-pointer transition border border-gray-200">
                  <input type="checkbox" class="chair-checkbox rounded text-indigo-500" data-id="${p.id}" data-code="${p.short_code}" data-name="${p.name}">
                  <span class="text-sm text-gray-700">${p.name}</span>
                  <span class="text-xs text-gray-400">(${p.item_count || 0})</span>
                  ${!p.last_active_at ? '<span class="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">미설치</span>' : '<span class="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded">연결됨</span>'}
                </label>
              `).join('')}
            </div>
            <div class="flex flex-wrap gap-2">
              <button onclick="exportSelectedScripts()" class="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 text-sm">
                스크립트 다운로드
              </button>
              <button onclick="downloadAutoRunScript(this)" class="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 text-sm">
                설치 방법
              </button>
            </div>
          </div>
          ` : `
          <div class="bg-white rounded-lg p-4 border border-gray-200 text-center text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>
            등록된 체어가 없습니다. 위에서 체어를 추가하세요.
          </div>
          `}
        </div>
        
        <!-- 대기실 설정 -->
        <div>
          <div class="flex items-center gap-2 mb-3 pb-2 border-b-2 border-teal-400">
            <i class="fas fa-couch text-teal-500"></i>
            <span class="font-bold text-gray-800">대기실 설정</span>
            <span class="text-xs text-gray-500">(스마트 TV 연결)</span>
          </div>
          
          ${waitingRooms.length > 0 ? `
          <div class="space-y-3">
            ${waitingRooms.map(p => `
            <div class="bg-white rounded-lg p-4 border border-gray-200">
              <div class="flex items-center gap-2 mb-3">
                <span class="font-medium text-gray-800">${p.name}</span>
                <span class="text-xs text-gray-400">(${p.item_count || 0}개 미디어)</span>
              </div>
              
              <!-- URL 복사 -->
              <div class="flex items-center gap-2 mb-3">
                <input type="text" id="setting-url-${p.id}" value="${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}" 
                  class="flex-1 bg-gray-100 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-mono" readonly>
                <button onclick="copySettingUrl(${p.id})" 
                  class="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm text-gray-600">
                  복사
                </button>
                ${!p.external_short_url ? `
                <button id="btn-shorten-${p.id}" onclick="generateShortUrl(${p.id}, '${p.short_code}')" 
                  class="bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded text-sm">
                  단축 URL 생성
                </button>
                ` : ''}
              </div>
              
              <!-- 사용법 안내 -->
              <div class="flex flex-wrap gap-2">
                <button onclick="showTvExportModal(${p.id}, '${p.name}', '${p.short_code}')"
                  class="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded text-xs">
                  사용법 (URL 직접 입력)
                </button>
              </div>
              <p class="mt-2 text-xs text-blue-700">
                <i class="fas fa-info-circle mr-1"></i>
                USB 인식 문제로 <strong>URL 직접 입력 방식</strong>만 제공합니다.
              </p>
            </div>
            `).join('')}
          </div>
          ` : `
          <div class="bg-white rounded-lg p-4 border border-gray-200 text-center text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>
            등록된 대기실이 없습니다. 위에서 대기실을 추가하세요.
          </div>
          `}
        </div>
        
      </div>
    </div>
  `;
  
  // 임시 영상 상태 확인
  checkTempVideoStatus();
  
  // 임시 영상 상태 주기적 확인 (5초마다) - 자동복귀 감지용
  if (!window.tempStatusInterval) {
    window.tempStatusInterval = setInterval(checkTempVideoStatus, 5000);
  }
  
  // 초기 설정 섹션 열림 상태 복원 (innerHTML 교체로 style이 리셋되기 때문)
  const exportSectionAfter = document.getElementById('export-section-content');
  const exportIconAfter = document.getElementById('export-toggle-icon');
  if (exportSectionAfter && wasExportOpen) {
    exportSectionAfter.style.display = 'block';
    if (exportIconAfter) {
      exportIconAfter.classList.remove('fa-chevron-down');
      exportIconAfter.classList.add('fa-chevron-up');
    }
  }
  
  // 체크박스 선택 상태 복원
  if (checkedIds.size > 0) {
    document.querySelectorAll('.chair-checkbox').forEach(cb => {
      if (checkedIds.has(cb.dataset.id)) cb.checked = true;
    });
  }
  
  // 드래그 정렬 초기화
  initPlaylistSortable();
}

// 임시 영상 상태 확인
async function checkTempVideoStatus() {
  for (const p of playlists) {
    try {
      const res = await fetch(API_BASE + '/playlists/' + p.id + '/temp-video');
      const data = await res.json();
      const indicator = document.getElementById('temp-indicator-' + p.id);
      const stopBtn = document.getElementById('stop-temp-btn-' + p.id);
      
      if (data.active) {
        // 임시 영상 재생 중 - 인디케이터와 복귀 버튼 표시
        if (indicator) indicator.classList.remove('hidden');
        setStopButtonState(p.id, true);
      } else {
        // 임시 영상 없음 (자동복귀 포함) - 인디케이터와 복귀 버튼 숨김
        if (indicator) indicator.classList.add('hidden');
        setStopButtonState(p.id, false);
      }
    } catch (e) {}
  }
}

// TV 섹션 토글
function toggleTvSection(id) {
  const section = document.getElementById('tv-section-' + id);
  const btn = document.getElementById('tv-toggle-btn-' + id);
  if (section.classList.contains('hidden')) {
    section.classList.remove('hidden');
    btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
  } else {
    section.classList.add('hidden');
    btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
  if (typeof postParentHeight === 'function') {
    setTimeout(postParentHeight, 50);
    setTimeout(postParentHeight, 300);
  }
}

// 내보내기 섹션 토글
function toggleExportSection() {
  const content = document.getElementById('export-section-content');
  const icon = document.getElementById('export-toggle-icon');
  const isHidden = content.style.display === 'none' || content.style.display === '';
  if (isHidden) {
    content.style.display = 'block';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
    // 초기 설정 섹션으로 스크롤
    setTimeout(() => {
      const btn = content.closest('.border.border-gray-300');
      if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  } else {
    content.style.display = 'none';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
  if (typeof postParentHeight === 'function') {
    setTimeout(postParentHeight, 50);
    setTimeout(postParentHeight, 300);
  }
}

// 전체 선택 토글
function toggleSelectAllChairs() {
  const selectAll = document.getElementById('select-all-chairs');
  const checkboxes = document.querySelectorAll('.chair-checkbox');
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

// 선택된 체어 가져오기
function getSelectedChairs() {
  const checkboxes = document.querySelectorAll('.chair-checkbox:checked');
  return Array.from(checkboxes).map(cb => ({
    id: cb.dataset.id,
    code: cb.dataset.code,
    name: cb.dataset.name
  }));
}

// 선택된 스크립트 다운로드 (설명 포함 + BAT/VBS 선택)
function exportSelectedScripts() {
  const selected = getSelectedChairs();
  if (selected.length === 0) {
    showToast('체어를 선택하세요', 'error', 1200, document.querySelector('[onclick="exportSelectedScripts()"]'));
    return;
  }
  
  // 형식 선택 모달 표시 - openModal 방식으로 body에 고정
  var modal = document.getElementById('script-type-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'script-type-modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.5)" onclick="closeModal(\'script-type-modal\')"></div>' +
    '<div style="position:relative;background:white;border-radius:12px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
      '<h3 style="font-size:17px;font-weight:700;margin-bottom:12px"><i class="fas fa-download" style="color:#6366f1;margin-right:8px"></i>스크립트 다운로드</h3>' +
      '<p style="font-size:13px;color:#666;margin-bottom:16px">선택된 ' + selected.length + '개 체어의 스크립트를 다운로드합니다.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<button onclick="downloadSelectedBat(); closeModal(\'script-type-modal\')" style="background:#3b82f6;color:white;padding:12px;border-radius:8px;border:none;cursor:pointer;text-align:center">' +
          '<i class="fas fa-file-code" style="font-size:24px;display:block;margin-bottom:4px"></i>' +
          '<span style="font-weight:700;display:block">BAT 파일</span>' +
          '<span style="font-size:11px;color:#bfdbfe">일반적인 경우</span>' +
        '</button>' +
        '<button onclick="downloadSelectedVbs(); closeModal(\'script-type-modal\')" style="background:#22c55e;color:white;padding:12px;border-radius:8px;border:none;cursor:pointer;text-align:center">' +
          '<i class="fas fa-shield-alt" style="font-size:24px;display:block;margin-bottom:4px"></i>' +
          '<span style="font-weight:700;display:block">VBS 파일</span>' +
          '<span style="font-size:11px;color:#bbf7d0">백신 차단 시</span>' +
        '</button>' +
      '</div>' +
      '<button onclick="closeModal(\'script-type-modal\')" style="width:100%;margin-top:12px;color:#888;font-size:13px;background:none;border:none;cursor:pointer">취소</button>' +
    '</div>';
  // 스크립트 전용 표시 (openModal 사용 안 함)
  _showScriptModal(modal);
}

// 선택된 체어 BAT 다운로드
function downloadSelectedBat() {
  const selected = getSelectedChairs();
  const today = new Date().toLocaleDateString('ko-KR');
  const chairNames = selected.map(p => p.name).join(', ');
  
  let batContent = '@echo off\n';
  batContent += 'chcp 65001 > nul\n';
  batContent += 'REM =========================================================\n';
  batContent += 'REM 치과 TV 스크립트 (선택된 체어)\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM 생성일: ' + today + '\n';
  batContent += 'REM 체어 수: ' + selected.length + '개\n';
  batContent += 'REM 체어 목록: ' + chairNames + '\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM [사용 방법]\n';
  batContent += 'REM 1. 이 파일을 더블클릭하면 선택된 체어의 크롬 창이 열립니다\n';
  batContent += 'REM 2. 열린 창을 해당 모니터로 드래그해서 배치하세요\n';
  batContent += 'REM 3. 화면을 클릭하면 전체화면 모드로 전환됩니다\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM [자동 실행] Win+R -> shell:startup -> 이 파일 복사\n';
  batContent += 'REM =========================================================\n\n';
  batContent += 'echo =========================================================\n';
  batContent += 'echo   치과 TV - ' + selected.length + '개 체어 실행\n';
  batContent += 'echo =========================================================\n\n';
  
  selected.forEach((p, idx) => {
    const url = location.origin + '/' + p.code;
    batContent += 'REM [' + (idx + 1) + '] ' + p.name + ': ' + url + '\n';
    batContent += 'echo [' + (idx + 1) + '/' + selected.length + '] ' + p.name + ' 실행...\n';
    batContent += 'start "" chrome --kiosk --new-window "' + url + '"\n';
    batContent += 'timeout /t 3 /nobreak > nul\n\n';
  });
  
  batContent += 'echo.\n';
  batContent += 'echo =========================================================\n';
  batContent += 'echo   모든 체어 화면 실행 완료!\n';
  batContent += 'echo =========================================================\n';
  batContent += 'timeout /t 5\n';
  
  const blob = new Blob([batContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_' + selected.length + '개체어.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('✅ ' + selected.length + '개 체어 BAT 스크립트 다운로드 완료');
}

// 선택된 체어 VBS 다운로드
function downloadSelectedVbs() {
  const selected = getSelectedChairs();
  const today = new Date().toLocaleDateString('ko-KR');
  const chairNames = selected.map(p => p.name).join(', ');
  
  let vbsContent = '\'=========================================================\n';
  vbsContent += '\' 치과 TV 스크립트 (선택된 체어)\n';
  vbsContent += '\'---------------------------------------------------------\n';
  vbsContent += '\' 생성일: ' + today + '\n';
  vbsContent += '\' 체어 수: ' + selected.length + '개\n';
  vbsContent += '\' 체어 목록: ' + chairNames + '\n';
  vbsContent += '\'---------------------------------------------------------\n';
  vbsContent += '\' [사용 방법]\n';
  vbsContent += '\' 1. 이 파일을 더블클릭하면 선택된 체어의 크롬 창이 열립니다\n';
  vbsContent += '\' 2. 열린 창을 해당 모니터로 드래그해서 배치하세요\n';
  vbsContent += '\' [자동 실행] Win+R -> shell:startup -> 이 파일 복사\n';
  vbsContent += '\' (백신이 BAT 파일 차단 시 이 VBS 파일 사용)\n';
  vbsContent += '\'=========================================================\n\n';
  vbsContent += 'Set WshShell = CreateObject("WScript.Shell")\n\n';
  
  selected.forEach((p, idx) => {
    const url = location.origin + '/' + p.code;
    vbsContent += '\' [' + (idx + 1) + '] ' + p.name + ': ' + url + '\n';
    vbsContent += 'WshShell.Run "chrome --kiosk --new-window ""' + url + '"""\n';
    vbsContent += 'WScript.Sleep 3000\n\n';
  });
  
  const blob = new Blob([vbsContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_' + selected.length + '개체어.vbs';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('✅ ' + selected.length + '개 체어 VBS 스크립트 다운로드 완료');
}

// 선택된 TV URL 복사
function copySelectedLinks() {
  const selected = getSelectedChairs();
  if (selected.length === 0) {
    showToast('복사할 체어를 선택하세요', 'error');
    return;
  }
  const links = selected.map(p => p.name + ' TV: ' + location.origin + '/' + p.code).join('\n');
  navigator.clipboard.writeText(links);
  showToast('📋 ' + selected.length + '개 체어 TV URL 복사됨\n(각 체어 PC에서 이 URL을 열어주세요)');
}

// 카카오톡으로 공유
function shareSelectedViaKakao() {
  const selected = getSelectedChairs();
  if (selected.length === 0) {
    showToast('공유할 체어를 선택하세요', 'error');
    return;
  }
  const links = selected.map(p => p.name + ': ' + location.origin + '/' + p.code).join('\n');
  const text = '📺 체어 TV URL\n\n' + links + '\n\n각 체어 PC에서 해당 URL을 열어주세요.';
  
  // 클립보드에 복사
  navigator.clipboard.writeText(text).then(() => {
    // 복사 성공 후 카카오톡 열기 시도 (모바일만)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // 카카오톡 앱 열기 시도
      window.location.href = 'kakaotalk://';
    }
    // 복사 완료 메시지 표시
    showToast('✅ 클립보드에 복사되었습니다!\n카카오톡에서 Ctrl+V로 붙여넣기 하세요', 'success', 4000);
  }).catch(() => {
    showToast('복사 실패', 'error');
  });
}

// 문자로 공유
function shareSelectedViaSMS() {
  const selected = getSelectedChairs();
  if (selected.length === 0) {
    showToast('공유할 체어를 선택하세요', 'error');
    return;
  }
  const links = selected.map(p => p.name + ': ' + location.origin + '/' + p.code).join('\n');
  const text = '체어 TV URL\n' + links + '\n\n각 체어 PC에서 해당 URL을 열어주세요.';
  window.location.href = 'sms:?body=' + encodeURIComponent(text);
}

// ===== TV로 내보내기 모달 =====
function showTvExportModal(playlistId, playlistName, shortCode) {
  const playlist = playlists.find(p => p.id === playlistId);
  const isChair = playlistName.includes('체어');
  
  if (isChair) {
    // 체어: 스크립트 다운로드 모달 열기
    showScriptDownloadModal();
  } else {
    // 대기실: URL 가이드 모달 열기
    newlyCreatedPlaylist = playlist;
    if (playlist.external_short_url) {
      document.getElementById('guide-short-url').textContent = playlist.external_short_url.replace('https://', '');
    } else {
      document.getElementById('guide-short-url').textContent = location.host + '/' + shortCode;
    }
    openModal('guide-url-modal');
  }
}

// ===== 플레이리스트 드래그 정렬 =====
function initPlaylistSortable() {
  // 대기실과 체어 각각의 컨테이너에 드래그 기능 적용
  const waitingRoomContainer = document.getElementById('waitingroom-sortable-container');
  const chairContainer = document.getElementById('chair-sortable-container');
  
  [waitingRoomContainer, chairContainer].forEach(container => {
    if (!container) return;
    initSortableContainer(container);
  });
}

function initSortableContainer(container) {
  if (!container) return;
  
  let draggedItem = null;
  
  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.playlist-sortable-item');
    if (item) {
      draggedItem = item;
      item.classList.add('opacity-50');
      e.dataTransfer.effectAllowed = 'move';
    }
  });
  
  container.addEventListener('dragend', (e) => {
    const item = e.target.closest('.playlist-sortable-item');
    if (item) {
      item.classList.remove('opacity-50');
      draggedItem = null;
    }
  });
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(container, e.clientY);
    if (draggedItem) {
      if (afterElement == null) {
        container.appendChild(draggedItem);
      } else {
        container.insertBefore(draggedItem, afterElement);
      }
    }
  });
  
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    // 대기실과 체어 컨테이너를 모두 읽어 전체 순서를 한번에 저장
    // (각 컨테이너가 따로 0부터 시작하면 sort_order 충돌 → 두 그룹을 합쳐서 연속된 인덱스 부여)
    const waitingItems = document.querySelectorAll('#waitingroom-sortable-container .playlist-sortable-item');
    const chairItems   = document.querySelectorAll('#chair-sortable-container .playlist-sortable-item');
    
    let idx = 0;
    const newOrder = [];
    waitingItems.forEach(item => {
      newOrder.push({ id: parseInt(item.dataset.playlistId), sort_order: idx++ });
    });
    chairItems.forEach(item => {
      newOrder.push({ id: parseInt(item.dataset.playlistId), sort_order: idx++ });
    });
    
    // playlists 배열도 동기화 (30초 자동갱신 시 renderPlaylists가 새 순서 유지)
    newOrder.forEach(({ id, sort_order }) => {
      const p = playlists.find(p => p.id === id);
      if (p) p.sort_order = sort_order;
    });
    
    // API 호출하여 순서 저장
    try {
      const res = await fetch(API_BASE + '/playlists/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder })
      });
      if (res.ok) {
        showToast('순서가 저장되었습니다.');
      }
    } catch (e) {
      console.error('순서 저장 실패:', e);
    }
  });
  
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.playlist-sortable-item:not(.opacity-50)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

// ===== 임시 영상 전송 기능 =====
let selectedTempVideoItem = null;
let tempVideoSearchQuery = '';

// 임시 영상 전송용 플레이리스트 아이템
let tempVideoPlaylistItems = [];

// 임시 영상 전송 모달 열기
function showTempVideoModal(playlistId, playlistName, shortCode) {
  document.getElementById('temp-video-playlist-id').value = playlistId;
  document.getElementById('temp-video-short-code').value = shortCode;
  document.getElementById('temp-video-target-name').textContent = playlistName + '에 전송';
  document.getElementById('temp-video-url').value = '';
  const searchInput = document.getElementById('temp-video-search');
  if (searchInput) searchInput.value = '';
  tempVideoSearchQuery = '';
  selectedTempVideoItem = null;
  
  // 모달 즉시 열기
  openModal('temp-video-modal');
  
  // 재생목록 탭으로 초기화
  switchTempVideoTab('shared');
  
  // ── 즉시 렌더링: masterItemsCache + playlists에서 items 사용 ──
  const cachedItems = tempVideoCacheByPlaylist[playlistId];
  if (cachedItems && cachedItems.length) {
    // 캐시 우선
    tempVideoPlaylistItems = cachedItems;
    renderTempVideoSharedList();
  } else if (masterItemsCache && masterItemsCache.length > 0) {
    // masterItemsCache로 즉시 렌더링 (API fetch 없이)
    const basePlaylist = playlists.find(p => p.id == playlistId);
    const userItems = (basePlaylist?.items || []).map(item => ({ ...item, is_master: false }));
    const masterItemsWithFlag = masterItemsCache.map(item => ({ ...item, is_master: true }));
    tempVideoPlaylistItems = [...masterItemsWithFlag, ...userItems];
    tempVideoCacheByPlaylist[playlistId] = tempVideoPlaylistItems;
    renderTempVideoSharedList();
  } else {
    document.getElementById('temp-video-shared-list').innerHTML = '<div class="text-center py-4 text-gray-500">로딩 중...</div>';
  }
  
  // 백그라운드에서 최신 데이터 로드 (캐시 갱신 + 현재 전송 영상 확인)
  // 이미 즉시 렌더링된 경우 재렌더링 없이 캐시만 갱신
  const alreadyRendered = tempVideoPlaylistItems.length > 0;
  Promise.all([
    loadTempVideoPlaylistItems(playlistId),
    checkCurrentTempVideo(playlistId)
  ]).then(() => {
    if (!alreadyRendered) {
      // 즉시 렌더링 못 한 경우(masterItemsCache 없었을 때)만 렌더링
      renderTempVideoSharedList();
    }
    // 현재 전송 중인 영상 상태 표시는 항상 갱신
    checkCurrentTempVideo(playlistId);
  });
}

// 플레이리스트 아이템 로드 (공용 + 내 영상)
async function loadTempVideoPlaylistItems(playlistId) {
  try {
    const [playlistRes, masterRes] = await Promise.all([
      fetch(API_BASE + '/playlists/' + playlistId),
      fetch('/api/master/items')
    ]);
    const data = await playlistRes.json();
    const masterData = await masterRes.json().catch(() => ({}));

    const latestMasterItems = (masterData.items || masterItems || []);
    masterItems = latestMasterItems;

    // 공용 영상 (최신 masterItems)
    const masterItemsWithFlag = (latestMasterItems || []).map(item => ({
      ...item,
      is_master: true
    }));
    
    // 내 영상
    const userItems = (data.playlist?.items || []).map(item => ({
      ...item,
      is_master: false
    }));
    
    // 합치기: 공용 먼저, 내 영상 나중
    tempVideoPlaylistItems = [...masterItemsWithFlag, ...userItems];
    tempVideoCacheByPlaylist[playlistId] = tempVideoPlaylistItems;
  } catch (e) {
    console.error('Failed to load playlist items:', e);
    tempVideoPlaylistItems = [];
  }
}

// 탭 전환
function switchTempVideoTab(tab) {
  const sharedTab = document.getElementById('temp-tab-shared');
  const urlTab = document.getElementById('temp-tab-url');
  const sharedContent = document.getElementById('temp-video-shared-tab');
  const urlContent = document.getElementById('temp-video-url-tab');
  
  if (tab === 'shared') {
    sharedTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
    sharedTab.classList.remove('text-gray-500');
    urlTab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
    urlTab.classList.add('text-gray-500');
    sharedContent.classList.remove('hidden');
    urlContent.classList.add('hidden');
  } else {
    urlTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
    urlTab.classList.remove('text-gray-500');
    sharedTab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
    sharedTab.classList.add('text-gray-500');
    urlContent.classList.remove('hidden');
    sharedContent.classList.add('hidden');
  }
}

const normalizeSearchValue = (value) => {
  const base = (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFKC');

  const stripped = base
    .replace(/\s/g, '')
    .replace(/[._-]/g, '');

  return stripped.replace(/[^a-z0-9가-힣]/g, '');
};

const getTempVideoSearchText = (item) => {
  return [item.title, item.name, item.display_title, item.original_title, item.url]
    .filter(Boolean)
    .join(' ');
};

function updateTempVideoSearch() {
  const input = document.getElementById('temp-video-search');
  tempVideoSearchQuery = (input?.value || '').trim();
  renderTempVideoSearchResults();
}

function renderTempVideoSearchResults() {
  const resultsContainer = document.getElementById('temp-video-search-results');
  const query = tempVideoSearchQuery;
  const rawQuery = (query || '').toLowerCase().trim();
  const normalizedQuery = normalizeSearchValue(query);

  if (!resultsContainer) return;

  if (!rawQuery) {
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
    return;
  }

  const filteredItems = tempVideoPlaylistItems.filter(item => {
    const rawText = (getTempVideoSearchText(item) || '').toLowerCase();
    const normalizedText = normalizeSearchValue(getTempVideoSearchText(item));
    return (normalizedQuery && normalizedText.includes(normalizedQuery)) || rawText.includes(rawQuery);
  });

  resultsContainer.classList.remove('hidden');
  if (filteredItems.length === 0) {
    resultsContainer.innerHTML = '<div class="text-center text-gray-500 py-3">검색 결과가 없습니다.</div>';
  } else {
    let resultHtml = '<div class="px-3 py-1 bg-indigo-50 text-xs text-indigo-600 font-medium">검색 결과</div>';
    resultHtml += filteredItems.map((item, idx) => renderTempVideoItem(item, idx)).join('');
    resultsContainer.innerHTML = resultHtml;
  }
}

// 재생 목록 렌더링 (공용 + 내 영상)
function renderTempVideoSharedList() {
  const container = document.getElementById('temp-video-shared-list');

  if (tempVideoPlaylistItems.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-4">등록된 영상이 없습니다.</div>';
    return;
  }

  const selectedKey = selectedTempVideoItem
    ? ((selectedTempVideoItem.is_master ? 'm' : 'u') + '-' + selectedTempVideoItem.id)
    : null;

  // 공용 영상과 내 영상 분리 (전체 목록 유지)
  const masterVideos = tempVideoPlaylistItems.filter(item => item.is_master)
    .filter(item => ((item.is_master ? 'm' : 'u') + '-' + item.id) !== selectedKey);
  const userVideos = tempVideoPlaylistItems.filter(item => !item.is_master)
    .filter(item => ((item.is_master ? 'm' : 'u') + '-' + item.id) !== selectedKey);
  
  let html = '';

  if (selectedTempVideoItem) {
    html += '<div class="px-3 py-1 bg-indigo-50 text-xs text-indigo-600 font-medium">선택된 영상</div>';
    html += renderTempVideoItem(selectedTempVideoItem, 0);
  }
  
  if (masterVideos.length > 0) {
    html += '<div class="px-3 py-1 bg-purple-50 text-xs text-purple-600 font-medium">공용 영상</div>';
    html += masterVideos.map((item, idx) => renderTempVideoItem(item, idx)).join('');
  }
  
  if (userVideos.length > 0) {
    html += '<div class="px-3 py-1 bg-blue-50 text-xs text-blue-600 font-medium">내 영상</div>';
    html += userVideos.map((item, idx) => renderTempVideoItem(item, masterVideos.length + idx)).join('');
  }
  
  container.innerHTML = html;
  renderTempVideoSearchResults();
}

// 개별 아이템 렌더링
function renderTempVideoItem(item, idx) {
  const isSelected = String(selectedTempVideoItem?.id) === String(item.id)
    && Boolean(selectedTempVideoItem?.is_master) === Boolean(item.is_master);
  const itemData = JSON.stringify(item).replace(/"/g, '&quot;');
  
  return `
    <div class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition ${isSelected ? 'bg-indigo-100' : ''}"
      onclick="selectTempVideoItem(${itemData})">
      <input type="radio" name="temp-video-item" ${isSelected ? 'checked' : ''} class="text-indigo-600 flex-shrink-0">
      <div class="w-10 h-10 ${item.is_master ? 'bg-purple-100' : 'bg-gray-100'} rounded overflow-hidden flex-shrink-0">
        ${item.thumbnail_url 
          ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
          : `<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fab fa-${item.item_type}"></i></div>`
        }
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-800 truncate">${item.title || item.url}</p>
      </div>
      <span class="text-xs ${item.is_master ? 'text-purple-400' : 'text-gray-400'} flex-shrink-0">${item.item_type}</span>
    </div>
  `;
}

// 영상 선택
function selectTempVideoItem(item) {
  selectedTempVideoItem = item;
  const searchInput = document.getElementById('temp-video-search');
  if (searchInput) searchInput.value = '';
  tempVideoSearchQuery = '';
  const resultsContainer = document.getElementById('temp-video-search-results');
  if (resultsContainer) {
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
  }
  renderTempVideoSharedList();
  const sharedList = document.getElementById('temp-video-shared-list');
  if (sharedList) {
    sharedList.scrollTop = 0;
  }
}

// 현재 임시 영상 상태 확인
async function checkCurrentTempVideo(playlistId) {
  try {
    const res = await fetch(API_BASE + '/playlists/' + playlistId + '/temp-video');
    const data = await res.json();
    const statusDiv = document.getElementById('temp-video-current-status');
    
    if (data.active) {
      statusDiv.classList.remove('hidden');
    } else {
      statusDiv.classList.add('hidden');
    }
  } catch (e) {
    document.getElementById('temp-video-current-status').classList.add('hidden');
  }
}

// 임시 영상 전송
function setStopButtonState(playlistId, active) {
  const stopBtn = document.getElementById('stop-temp-btn-' + playlistId);
  if (!stopBtn) return;

  stopBtn.classList.remove('opacity-0', 'pointer-events-none', 'invisible', 'hidden');
  stopBtn.classList.add('opacity-100', 'visible', 'inline-flex', 'items-center', 'justify-center', 'gap-1');
  stopBtn.style.opacity = '1';
  stopBtn.style.visibility = 'visible';
  stopBtn.removeAttribute('disabled');

  if (active) {
    stopBtn.classList.remove('bg-gray-50', 'text-gray-600', 'border-gray-200', 'cursor-not-allowed');
    stopBtn.classList.add('bg-red-50', 'text-red-600', 'hover:bg-red-100');
    stopBtn.removeAttribute('aria-disabled');
    delete stopBtn.dataset.disabled;
    stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>기본으로 복귀</span>';
  } else {
    stopBtn.classList.remove('bg-red-50', 'text-red-600', 'hover:bg-red-100');
    stopBtn.classList.add('bg-gray-50', 'text-gray-600', 'border-gray-200', 'cursor-not-allowed');
    stopBtn.setAttribute('aria-disabled', 'true');
    stopBtn.dataset.disabled = 'true';
    stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>기본으로 복귀</span>';
  }
}

async function sendTempVideo() {
  const playlistId = document.getElementById('temp-video-playlist-id').value;
  const shortCode = document.getElementById('temp-video-short-code').value;
  const urlInput = document.getElementById('temp-video-url').value.trim();
  const returnTime = document.getElementById('temp-return-time').value;
  
  // URL 또는 공용자료 선택 확인
  let videoUrl = '';
  let videoTitle = '';
  let videoType = '';
  
  if (urlInput) {
    videoUrl = urlInput;
    // YouTube/Vimeo 타입 감지
    if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
      videoType = 'youtube';
      videoTitle = 'YouTube 영상';
    } else if (urlInput.includes('vimeo.com')) {
      videoType = 'vimeo';
      videoTitle = 'Vimeo 영상';
    } else {
      showToast('YouTube 또는 Vimeo URL을 입력해주세요', 'error');
      return;
    }
  } else if (selectedTempVideoItem) {
    videoUrl = selectedTempVideoItem.url;
    videoTitle = selectedTempVideoItem.title || '공용 영상';
    videoType = selectedTempVideoItem.item_type;
  } else {
    showToast('영상을 선택하거나 URL을 입력해주세요', 'error');
    return;
  }
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + playlistId + '/temp-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: videoUrl,
        title: videoTitle,
        type: videoType,
        return_time: returnTime
      })
    });
    
    if (res.ok) {
      showToast('✅ 임시 영상이 전송되었습니다!');
      closeModal('temp-video-modal');
      // 상태 업데이트 - 인디케이터와 기본으로 복귀 버튼 표시
      const indicator = document.getElementById('temp-indicator-' + playlistId);
      if (indicator) indicator.classList.remove('hidden');
      setStopButtonState(playlistId, true);
    } else {
      showToast('전송 실패', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('전송 실패', 'error');
  }
}

// 임시 영상 중지 (기본으로 복귀) - 모달 내부용
async function stopTempVideo() {
  const playlistId = document.getElementById('temp-video-playlist-id').value;
  await stopTempVideoForPlaylist(playlistId);
}

// 임시 영상 중지 (기본으로 복귀) - 플레이리스트 카드에서 직접 호출
async function stopTempVideoForPlaylist(playlistId) {
  const stopBtn = document.getElementById('stop-temp-btn-' + playlistId);
  if (stopBtn?.dataset?.disabled === 'true') return;

  console.log('stopTempVideoForPlaylist called:', playlistId);
  console.log('API_BASE:', API_BASE);
  const url = API_BASE + '/playlists/' + playlistId + '/temp-video';
  console.log('DELETE URL:', url);
  
  try {
    const res = await fetch(url, { method: 'DELETE' });
    console.log('Response status:', res.status);
    
    if (res.ok) {
      showToast('✅ 기본 재생목록으로 복귀합니다');
      document.getElementById('temp-video-current-status')?.classList.add('hidden');
      // 인디케이터 숨기기
      const indicator = document.getElementById('temp-indicator-' + playlistId);
      if (indicator) indicator.classList.add('hidden');
      // 기본으로 복귀 버튼 숨기기
      setStopButtonState(playlistId, false);
    } else {
      const text = await res.text();
      console.log('Response error:', text);
      showToast('복귀 실패: ' + res.status, 'error');
    }
  } catch (e) {
    console.error('stopTempVideoForPlaylist error:', e);
    showToast('복귀 실패', 'error');
  }
}

// 새로 생성된 플레이리스트 정보 저장용
let newlyCreatedPlaylist = null;

function showCreatePlaylistModal() {
  // 모든 단계 초기화
  document.getElementById('create-step-1').classList.remove('hidden');
  document.getElementById('create-step-waiting').classList.add('hidden');
  document.getElementById('create-step-chair').classList.add('hidden');
  document.getElementById('new-waiting-name').value = '';
  document.getElementById('new-chair-name').value = '';
  openModal('create-playlist-modal');
}

function selectCreateType(type) {
  document.getElementById('create-step-1').classList.add('hidden');
  if (type === 'waiting') {
    document.getElementById('create-step-waiting').classList.remove('hidden');
    document.getElementById('new-waiting-name').focus();
  } else {
    document.getElementById('create-step-chair').classList.remove('hidden');
    document.getElementById('new-chair-name').focus();
  }
}

function backToStep1() {
  document.getElementById('create-step-1').classList.remove('hidden');
  document.getElementById('create-step-waiting').classList.add('hidden');
  document.getElementById('create-step-chair').classList.add('hidden');
}

// 대기실 생성
async function createWaitingRoom() {
  const name = document.getElementById('new-waiting-name').value.trim();
  if (!name) {
    showToast('대기실 이름을 입력하세요', 'error');
    return;
  }

  // 프론트엔드 중복 체크
  if (playlists && playlists.some(p => p.name === name)) {
    showToast('"' + name + '" 이름이 이미 존재합니다. 다른 이름을 사용해주세요.', 'error');
    return;
  }
  
  try {
    const res = await fetch(API_BASE + '/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const data = await res.json();
    
    if (data.success) {
      closeModal('create-playlist-modal');
      newlyCreatedPlaylist = data.playlist;
      await loadPlaylists();
      
      // URL 직접 입력 가이드 모달 표시 (초기설정 탭은 자동으로 열지 않음)
      showUrlGuide(data.playlist);
    } else {
      showToast(data.error || '생성 실패', 'error');
    }
  } catch (e) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// 체어 생성
async function createChair() {
  let name = document.getElementById('new-chair-name').value.trim();
  if (!name) {
    showToast('체어 이름을 입력하세요', 'error');
    return;
  }
  
  // 이름에 '체어'가 없으면 자동으로 추가
  if (!name.includes('체어')) {
    name = '체어' + name;
  }

  // 프론트엔드 중복 체크
  if (playlists && playlists.some(p => p.name === name)) {
    showToast('"' + name + '" 이름이 이미 존재합니다. 다른 이름을 사용해주세요.', 'error');
    return;
  }
  
  try {
    const res = await fetch(API_BASE + '/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const data = await res.json();
    
    if (data.success) {
      closeModal('create-playlist-modal');
      await loadPlaylists();
      showToast('✅ ' + name + ' 추가 완료! 초기 설정 탭에서 스크립트를 다운로드하세요.');
    } else {
      showToast(data.error || '생성 실패', 'error');
    }
  } catch (e) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// 단축 URL 가이드 표시
function showUrlGuide(playlist) {
  newlyCreatedPlaylist = playlist;
  document.getElementById('guide-short-url').textContent = location.host + '/' + playlist.short_code;
  openModal('guide-url-modal');
}

// USB 가이드 제거: URL 직접 입력만 사용

// 가이드 모달용 URL 복사
function copyGuideUrl() {
  if (!newlyCreatedPlaylist) return;
  const url = location.origin + '/' + newlyCreatedPlaylist.short_code;
  navigator.clipboard.writeText(url);
  showToast('URL이 복사되었습니다!');
}

// 더 짧은 URL 만들기 (팝업창에서 호출)
async function makeUrlShorter() {
  if (!newlyCreatedPlaylist) return;
  try {
    showToast('단축 URL 생성 중...', 'info');
    const res = await fetch(API_BASE + '/playlists/' + newlyCreatedPlaylist.id + '/external-shorten', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success && data.shortUrl) {
      const shortUrlDisplay = data.shortUrl.replace('https://', '');
      newlyCreatedPlaylist.externalShortUrl = data.shortUrl;
      
      // 모든 관련 입력창 업데이트
      updateAllUrlDisplays(newlyCreatedPlaylist.id, shortUrlDisplay, data.shortUrl);
      
      // 팝업창 URL 업데이트 (별도로 처리)
      const guideEl = document.getElementById('guide-short-url');
      if (guideEl) guideEl.textContent = shortUrlDisplay;
      
      // 클립보드에 복사 (iframe 환경에서 실패해도 무시)
      try {
        await navigator.clipboard.writeText(data.shortUrl);
        showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay + ' (클립보드 복사됨)', 'success', 5000);
      } catch (clipErr) {
        showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay, 'success', 5000);
      }
    } else {
      showToast(data.error || '단축 URL 생성 실패', 'error');
    }
  } catch (e) {
    showToast('단축 URL 생성 실패: ' + e.message, 'error');
  }
}

// 가이드 모달용 북마크 다운로드
function downloadGuideBookmark(variant = 'universal') {
  if (!newlyCreatedPlaylist) return;
  const url = location.origin + '/' + newlyCreatedPlaylist.short_code;
  downloadBookmark(newlyCreatedPlaylist.name, url, newlyCreatedPlaylist.short_code, variant);
  const label = variant === 'samsung'
    ? '삼성 TV용'
    : variant === 'lg'
      ? 'LG TV용'
      : variant === 'android'
        ? 'Android TV용'
        : '공통';
  showToast(label + ' HTML 파일이 다운로드되었습니다!');
}

// 가이드 모달용 URL 파일 다운로드
function downloadGuideUrlFile() {
  if (!newlyCreatedPlaylist) return;
  const url = location.origin + '/' + newlyCreatedPlaylist.short_code;
  downloadUrlFile(newlyCreatedPlaylist.name, url);
  showToast('URL 바로가기 파일이 다운로드되었습니다!');
}

function showTvGuideModal() {
  openModal('tv-guide-modal');
}

// 기존 createPlaylist 함수 (이전 버전 호환용)
async function createPlaylist(e) {
  if (e) e.preventDefault();
  const nameEl = document.getElementById('new-playlist-name');
  if (!nameEl) return;
  const name = nameEl.value;
  
  try {
    const res = await fetch(API_BASE + '/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const data = await res.json();
    
    if (data.success) {
      closeModal('create-playlist-modal');
      loadPlaylists();
      showToast('생성 완료! 단축 URL: ' + data.playlist.short_code);
    } else {
      showToast(data.error || '생성 실패', 'error');
    }
  } catch (e) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

async function deletePlaylist(id) {
  // 마지막 플레이리스트인지 확인
  if (playlists.length <= 1) {
    showToast('최소 1개의 대기실/체어가 필요합니다.', 'error');
    return;
  }
  
  if (!confirm('정말 삭제하시겠습니까?')) return;
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadPlaylists();
      showToast('삭제되었습니다.');
    } else {
      showToast(data.error || '삭제 실패', 'error');
    }
  } catch (e) {
    showToast('삭제 실패', 'error');
  }
}

let isOpeningEditor = false;

function resetPlaylistEditorScroll() {
  const playlistContainer = document.getElementById('playlist-items-container');
  if (playlistContainer) playlistContainer.scrollTop = 0;

  const libraryContainer = document.getElementById('library-scroll-container');
  if (libraryContainer) libraryContainer.scrollTop = 0;
}

async function openPlaylistEditor(id) {
  if (isOpeningEditor) return;
  isOpeningEditor = true;
  
  // 즉시 모달 열기
  openModal('edit-playlist-modal');
  
  // UI 초기화
  resetPlaylistEditorScroll();
  playlistSearchQuery = '';
  const librarySearchInput = document.getElementById('library-search');
  if (librarySearchInput) librarySearchInput.value = '';
  const librarySearchMessage = document.getElementById('library-search-message');
  if (librarySearchMessage) librarySearchMessage.classList.add('hidden');
  const librarySearchResults = document.getElementById('library-search-results');
  if (librarySearchResults) {
    librarySearchResults.innerHTML = '';
    librarySearchResults.classList.add('hidden');
  }

  // sortable 인스턴스 제거
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  if (typeof playlistSortableInstance !== 'undefined' && playlistSortableInstance) {
    playlistSortableInstance.destroy();
    playlistSortableInstance = null;
  }

  // ── 1단계: playlists 배열에서 기본 정보를 즉시 사용 ──
  // playlists 배열(INITIAL_DATA)에는 이제 items, activeItemIds도 포함됨
  const basePlaylist = playlists.find(p => p.id == id);
  
  if (basePlaylist) {
    // INITIAL_DATA에서 items 포함한 전체 정보로 즉시 설정
    currentPlaylist = Object.assign({ items: [], activeItemIds: [] }, basePlaylist);
    document.getElementById('edit-playlist-title').textContent = currentPlaylist.name + ' 편집';
    document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
    document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
    updateDurationLabel();
  } else {
    // playlists 배열에 없으면 임시 객체로 설정
    currentPlaylist = {
      id: id,
      name: '재생목록',
      items: [],
      activeItemIds: [],
      transition_effect: 'fade',
      transition_duration: 1000
    };
    document.getElementById('edit-playlist-title').textContent = '불러오는 중...';
  }

  // ── 2단계: INITIAL_DATA로 즉시 전체 렌더링 ──
  // masterItemsCache + currentPlaylist.items 모두 이미 있으므로 즉시 렌더링
  if (masterItemsCache && masterItemsCache.length > 0 && currentPlaylist) {
    // renderLibraryAndPlaylist()는 currentPlaylist.items와 masterItemsCache를 모두 사용
    // 캐시에 있으면 즉시 동기적으로 렌더링 가능 (API fetch 불필요)
    playlistEditorSignature = getPlaylistEditorSignature(masterItemsCache, currentPlaylist);
    await renderLibraryAndPlaylist();
    loadPlaylistOrder();
    // 설정은 백그라운드에서 로드 (UI 블로킹 없음)
    loadPlaylistSettings().catch(() => {});
    if (typeof startMasterItemsAutoRefresh === 'function') {
      startMasterItemsAutoRefresh();
    }
    // 3단계 API fetch는 캐시 업데이트 전용 (재렌더링 없음)
    // INITIAL_DATA가 이미 완전한 데이터를 포함하므로 화면 갱신 불필요
    fetch(API_BASE + '/playlists/' + id + '?ts=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.playlist) {
          // 캐시만 업데이트 (다음 번 편집창 열 때 사용)
          playlistCacheById[id] = data.playlist;
        }
      })
      .catch(() => {});
    isOpeningEditor = false;
    return;
  } else {
    // masterItemsCache가 없으면 스켈레톤 표시
    const skeletonItem = '<div class="animate-pulse flex items-center gap-3 p-3 border-b"><div class="w-20 h-14 bg-gray-200 rounded flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-3 bg-gray-200 rounded w-3/4"></div><div class="h-3 bg-gray-200 rounded w-1/2"></div></div></div>';
    const libraryMasterList = document.getElementById('library-master-list');
    if (libraryMasterList) libraryMasterList.innerHTML = skeletonItem.repeat(4);
    const libraryUserList = document.getElementById('library-user-list');
    if (libraryUserList) libraryUserList.innerHTML = skeletonItem.repeat(3);
    const playlistContainer = document.getElementById('playlist-items-container');
    if (playlistContainer) playlistContainer.innerHTML = skeletonItem.repeat(4);
  }

  // ── 3단계: 백그라운드에서 playlist 상세(items) fetch ──
  try {
    const fetchWithTimeout = async (url, timeoutMs) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // 캐시에 있으면 즉시 사용
    const cachedPlaylist = playlistCacheById[id];
    let fullPlaylist = cachedPlaylist || null;

    if (!fullPlaylist) {
      let res = await fetchWithTimeout(API_BASE + '/playlists/' + id + '?ts=' + Date.now(), 3000);
      if (!res || !res.ok) {
        await new Promise(resolve => setTimeout(resolve, 300));
        res = await fetchWithTimeout(API_BASE + '/playlists/' + id + '?retry=1', 3000);
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.playlist) {
          fullPlaylist = data.playlist;
          playlistCacheById[id] = fullPlaylist;
        }
      }
    }

    if (fullPlaylist) {
      currentPlaylist = fullPlaylist;
      document.getElementById('edit-playlist-title').textContent = (currentPlaylist.name || '재생목록') + ' 편집';
      document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
      document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
      updateDurationLabel();
    }

    // 완전한 데이터로 전체 렌더링
    const newSignature = getPlaylistEditorSignature(masterItemsCache || [], currentPlaylist);
    playlistEditorSignature = newSignature;
    await renderLibraryAndPlaylist();
    loadPlaylistOrder();

    // 설정은 렌더링 완료 후 백그라운드에서 로드 (UI 블로킹 없음)
    loadPlaylistSettings().catch(() => {});

    if (typeof startMasterItemsAutoRefresh === 'function') {
      startMasterItemsAutoRefresh();
    }
  } catch (e) {
    console.error('플레이리스트 편집기 오류:', e);
    if (typeof renderLibraryAndPlaylist === 'function') {
      await renderLibraryAndPlaylist();
    }
  } finally {
    isOpeningEditor = false;
  }
}

async function loadPlaylistSettings() {
  try {
    const res = await fetch(API_BASE + '/settings');
    const settings = await res.json();
    
    // 로고 설정 로드 (요소가 존재하는 경우에만)
    const logoUrl = document.getElementById('logo-url');
    const logoSize = document.getElementById('logo-size');
    const logoOpacity = document.getElementById('logo-opacity');
    if (logoUrl) logoUrl.value = settings.logo_url || '';
    if (logoSize) logoSize.value = settings.logo_size || 150;
    if (logoOpacity) logoOpacity.value = settings.logo_opacity || 90;
    if (typeof updateLogoSizeLabel === 'function') updateLogoSizeLabel();
    if (typeof updateLogoOpacityLabel === 'function') updateLogoOpacityLabel();
    
    // 재생시간 설정 로드
    const scheduleEnabled = settings.schedule_enabled || 0;
    const scheduleEnabledEl = document.getElementById('schedule-enabled');
    const scheduleStart = document.getElementById('schedule-start');
    const scheduleEnd = document.getElementById('schedule-end');
    if (scheduleEnabledEl) scheduleEnabledEl.checked = scheduleEnabled === 1;
    if (scheduleStart) scheduleStart.value = settings.schedule_start || '';
    if (scheduleEnd) scheduleEnd.value = settings.schedule_end || '';
    if (typeof toggleScheduleInputs === 'function') toggleScheduleInputs(scheduleEnabled === 1);
    
    // 공용 플레이리스트 설정 로드
    const useMasterPlaylist = settings.use_master_playlist ?? 1;
    const useMasterEl = document.getElementById('use-master-playlist');
    const masterModeEl = document.getElementById('master-playlist-mode');
    if (useMasterEl) useMasterEl.checked = useMasterPlaylist === 1;
    if (masterModeEl) masterModeEl.value = settings.master_playlist_mode || 'before';
    if (typeof toggleMasterPlaylistInputs === 'function') toggleMasterPlaylistInputs(useMasterPlaylist === 1);
  } catch (e) {
    console.error('설정 로드 오류:', e);
  }
}

function toggleScheduleSettings() {
  const enabled = document.getElementById('schedule-enabled').checked;
  toggleScheduleInputs(enabled);
  saveScheduleSettings();
}

function toggleScheduleInputs(enabled) {
  const inputs = document.getElementById('schedule-inputs');
  if (enabled) {
    inputs.classList.remove('opacity-50', 'pointer-events-none');
  } else {
    inputs.classList.add('opacity-50', 'pointer-events-none');
  }
}

function toggleMasterPlaylistSettings() {
  const enabled = document.getElementById('use-master-playlist').checked;
  toggleMasterPlaylistInputs(enabled);
  saveMasterPlaylistSettings();
}

function toggleMasterPlaylistInputs(enabled) {
  const inputs = document.getElementById('master-playlist-inputs');
  if (!inputs) return;
  if (enabled) {
    inputs.classList.remove('opacity-50', 'pointer-events-none');
  } else {
    inputs.classList.add('opacity-50', 'pointer-events-none');
  }
}

async function saveMasterPlaylistSettings() {
  try {
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        use_master_playlist: document.getElementById('use-master-playlist').checked ? 1 : 0,
        master_playlist_mode: document.getElementById('master-playlist-mode').value
      })
    });
    showToast('공용 플레이리스트 설정이 저장되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

function updateDurationLabel() {
  const duration = document.getElementById('transition-duration').value;
  document.getElementById('duration-label').textContent = (duration / 1000).toFixed(1) + '초';
}

function updateLogoSizeLabel() {
  const size = document.getElementById('logo-size').value;
  document.getElementById('logo-size-value').textContent = size + 'px';
}

function updateLogoOpacityLabel() {
  const opacity = document.getElementById('logo-opacity').value;
  document.getElementById('logo-opacity-value').textContent = opacity + '%';
}

async function saveTransitionSettings() {
  if (!currentPlaylist) return;
  
  const effect = document.getElementById('transition-effect').value;
  const duration = parseInt(document.getElementById('transition-duration').value);
  
  try {
    await fetch(API_BASE + '/playlists/' + currentPlaylist.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        transition_effect: effect,
        transition_duration: duration
      })
    });
    
    currentPlaylist.transition_effect = effect;
    currentPlaylist.transition_duration = duration;
    
    showToast('전환 효과가 저장되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

async function saveLogoSettings() {
  try {
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logo_url: document.getElementById('logo-url').value,
        logo_size: parseInt(document.getElementById('logo-size').value),
        logo_opacity: parseInt(document.getElementById('logo-opacity').value)
      })
    });
    showToast('로고 설정이 저장되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

async function saveScheduleSettings() {
  try {
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_enabled: document.getElementById('schedule-enabled').checked ? 1 : 0,
        schedule_start: document.getElementById('schedule-start').value,
        schedule_end: document.getElementById('schedule-end').value
      })
    });
    showToast('재생 시간 설정이 저장되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

// sortableInstance는 JS 블록 상단에 선언됨

async function renderPlaylistItems() {
  const container = document.getElementById('playlist-items-container');
  const items = currentPlaylist.items || [];
  
  // 공용 영상 로드 (상단 섹션 숨기고 목록에 통합)
  const masterSection = document.getElementById('master-items-section');
  if (masterSection) masterSection.classList.add('hidden');
  
  // 공용 영상 가져오기 (캐시 우선)
  if (!masterItemsCache) {
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(baseUrl + '/api/master/items');
      const data = await res.json();
      masterItemsCache = data.items || [];
    } catch (e) {
      masterItemsCache = masterItemsCache || [];
    }
  }

  
  // 기존 sortable 인스턴스 제거
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  
  // 공용 영상 + 내 영상 = 전체 표시
  const hasUserItems = items.length > 0;
  const hasMasterItems = masterItemsCache && masterItemsCache.length > 0;
  
  if (!hasUserItems && !hasMasterItems) {
    container.innerHTML = `
      <div class="bg-gray-50 rounded-lg p-8 text-center">
        <i class="fas fa-video text-3xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">추가된 미디어가 없습니다.</p>
        <p class="text-sm text-gray-400 mt-1">위에서 YouTube 또는 Vimeo URL을 추가해주세요.</p>
      </div>
    `;
    return;
  }
  
  // 공용 영상 HTML 생성 (맨 위에 표시, 수정 불가)
  const masterItemsHtml = masterItemsCache.map((item, index) => `
    <div class="playlist-item bg-purple-50 rounded-lg p-4 flex items-center gap-4 border-l-4 border-purple-400" data-master="true">
      <div class="text-purple-300 p-2">
        <i class="fas fa-lock text-lg"></i>
      </div>
      <span class="text-purple-400 font-bold w-6 text-center">${index + 1}</span>
      <div class="w-24 h-16 bg-purple-100 rounded overflow-hidden flex-shrink-0 editor-master-thumb" data-type="${item.item_type}" data-url="${item.url}">
        ${item.thumbnail_url 
          ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
          : `<div class="w-full h-full flex items-center justify-center"><i class="fas fa-spinner fa-spin text-purple-400"></i></div>`
        }
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-purple-800 truncate">${item.title || item.url}</p>
        <p class="text-sm text-purple-500">
          <i class="fab fa-${item.item_type} mr-1"></i>${item.item_type} · <span class="bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded text-xs">공용</span>
        </p>
      </div>
    </div>
  `).join('');
  
  // 내 영상 HTML 생성 (수정 가능)
  const userItemsHtml = items.map((item, index) => `
    <div class="playlist-item bg-gray-50 rounded-lg p-4 flex items-center gap-4 ${item.item_type === 'image' ? 'border-l-4 border-green-400' : ''}" data-id="${item.id}">
      <div class="drag-handle text-gray-400 hover:text-gray-600 p-2 cursor-grab active:cursor-grabbing">
        <i class="fas fa-grip-vertical text-lg"></i>
      </div>
      <span class="item-number text-gray-400 font-bold w-6 text-center">${masterItemsCache.length + index + 1}</span>
      <div class="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 relative" id="thumb-${item.id}">
        ${item.item_type === 'image' 
          ? `<img src="${item.url}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center bg-purple-100\\'><i class=\\'fas fa-image text-purple-400 text-xl\\'></i></div>'">`
          : (item.thumbnail_url && !item.thumbnail_url.includes('vimeo.com/') && !item.thumbnail_url.includes('youtube.com/'))
            ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/120x80?text=Video'">`
            : `<div class="w-full h-full flex items-center justify-center thumb-loading" data-type="${item.item_type}" data-url="${item.url}" data-item-id="${item.id}">
                <i class="fas fa-spinner fa-spin ${item.item_type === 'youtube' ? 'text-red-500' : 'text-blue-400'} text-xl"></i>
              </div>`
        }
        ${item.item_type === 'image' ? `<div class="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-tl">${item.display_time}s</div>` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-gray-800 truncate" id="title-${item.id}">${item.title || (item.item_type === 'image' ? '이미지' : item.url)}</p>
        <p class="text-sm ${item.item_type === 'image' ? 'text-green-500' : 'text-gray-500'}">
          ${item.item_type === 'youtube' 
            ? '<i class="fab fa-youtube text-red-500 mr-1"></i>YouTube'
            : item.item_type === 'vimeo'
              ? '<i class="fab fa-vimeo text-blue-400 mr-1"></i>Vimeo'
              : '<i class="fas fa-image text-green-400 mr-1"></i>이미지'
          }
          ${item.item_type === 'image' ? ` · <i class="fas fa-clock mr-1"></i>${item.display_time}초 표시` : ''}
        </p>
      </div>
      ${item.item_type === 'image' ? `
        <div class="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
          <i class="fas fa-clock text-green-400"></i>
          <input type="number" value="${item.display_time}" min="1" max="300"
            class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-green-300"
            onchange="updateItemDisplayTime(${item.id}, this.value)">
          <span class="text-sm text-gray-500">초</span>
        </div>
      ` : ''}
      <button onclick="deletePlaylistItem(${item.id})" class="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
  
  // 공용 영상이 있으면 구분선 추가
  if (hasMasterItems && hasUserItems) {
    container.innerHTML = masterItemsHtml + 
      '<div class="border-t-2 border-dashed border-gray-300 my-4 relative"><span class="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-3 text-xs text-gray-400">↓ 내 영상 ↓</span></div>' + 
      userItemsHtml;
  } else if (hasMasterItems) {
    container.innerHTML = masterItemsHtml + 
      '<div class="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm mt-4"><i class="fas fa-plus mr-2"></i>위에서 내 영상을 추가하세요</div>';
  } else {
    container.innerHTML = userItemsHtml;
  }
  
  // Sortable 초기화 (내 영상만 드래그 가능)
  initSortable();
  
  // 썸네일이 없는 아이템에 대해 자동으로 로드
  loadMissingThumbnails();
  loadEditorMasterThumbnails();
}

// 편집기에서 마스터 영상 표시 (읽기 전용)
async function renderMasterItemsInEditor() {
  const section = document.getElementById('master-items-section');
  const container = document.getElementById('master-items-list');
  
  try {
    const baseUrl = window.location.origin;
    const res = await fetch(baseUrl + '/api/master/items');
    const data = await res.json();
    const items = data.items || [];
    
    if (items.length === 0) {
      section.classList.add('hidden');
      return;
    }
    
    section.classList.remove('hidden');
    container.innerHTML = items.map((item, idx) => `
      <div class="flex items-center gap-4 bg-white bg-opacity-70 p-4 rounded-lg border border-purple-200">
        <i class="fas fa-lock text-purple-300"></i>
        <span class="text-purple-400 font-bold w-6 text-center">${idx + 1}</span>
        <div class="w-24 h-16 bg-purple-100 rounded overflow-hidden flex-shrink-0 editor-master-thumb" data-type="${item.item_type}" data-url="${item.url}">
          ${item.thumbnail_url 
            ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center"><i class="fas fa-spinner fa-spin text-purple-400"></i></div>`
          }
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-purple-800 truncate">${item.title || item.url}</p>
          <p class="text-sm text-purple-400">
            <i class="fab fa-${item.item_type} mr-1"></i>${item.item_type} · 공용
          </p>
        </div>
      </div>
    `).join('');
    
    // 썸네일 자동 로드
    loadEditorMasterThumbnails();
  } catch (e) {
    section.classList.add('hidden');
  }
}

// 편집기 마스터 영상 썸네일 로드
async function loadEditorMasterThumbnails() {
  const thumbs = document.querySelectorAll('.editor-master-thumb');
  for (const el of thumbs) {
    if (el.querySelector('img')) continue;
    const type = el.dataset.type;
    const url = el.dataset.url;
    
    if (type === 'vimeo') {
      const match = url.match(/vimeo\.com\/(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        try {
          const res = await fetch('/api/vimeo-thumbnail/' + videoId);
          const data = await res.json();
          if (data.success && data.thumbnail) {
            el.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
          } else {
            el.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>';
          }
        } catch (e) {
          el.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>';
        }
      }
    } else if (type === 'youtube') {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        el.innerHTML = '<img src="https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg" class="w-full h-full object-cover">';
      }
    }
  }
}

// 썸네일이 없는 아이템에 대해 자동으로 로드 (서버 API 사용)
async function loadMissingThumbnails() {
  const loadingThumbs = document.querySelectorAll('.thumb-loading');
  
  for (const el of loadingThumbs) {
    const type = el.dataset.type;
    const url = el.dataset.url;
    const container = el.parentElement;
    const itemId = container.id.replace('thumb-', '');
    
    if (type === 'vimeo') {
      const videoId = extractVimeoIdFront(url);
      if (videoId) {
        try {
          // 서버 API 사용 (CORS 문제 해결)
          const res = await fetch('/api/vimeo-thumbnail/' + videoId);
          const data = await res.json();
          if (data.success && data.thumbnail) {
            container.innerHTML = '<img src="' + data.thumbnail + '" class="w-full h-full object-cover">';
            updateItemThumbnail(itemId, data.thumbnail, data.title);
            
            // 제목도 업데이트
            const titleEl = document.getElementById('title-' + itemId);
            if (titleEl && data.title && titleEl.textContent.startsWith('http')) {
              titleEl.textContent = data.title;
            }
          } else {
            container.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
          }
        } catch (e) {
          container.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-blue-100"><i class="fab fa-vimeo text-blue-400 text-xl"></i></div>';
        }
      }
    } else if (type === 'youtube') {
      const videoId = extractYouTubeIdFront(url);
      if (videoId) {
        const thumbUrl = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
        container.innerHTML = '<img src="' + thumbUrl + '" class="w-full h-full object-cover">';
        updateItemThumbnail(itemId, thumbUrl, '');
      }
    }
  }
}

function extractVimeoIdFront(url) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function extractYouTubeIdFront(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

async function updateItemThumbnail(itemId, thumbnailUrl, title) {
  try {
    await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbnail_url: thumbnailUrl, title: title || '' })
    });
    
    // 제목도 업데이트
    if (title) {
      const titleEl = document.getElementById('title-' + itemId);
      if (titleEl && titleEl.textContent.startsWith('http')) {
        titleEl.textContent = title;
      }
    }
  } catch (e) {
    console.error('썸네일 업데이트 실패:', e);
  }
}

function initSortable() {
  const container = document.getElementById('playlist-items-container');
  if (!container || !window.Sortable) return;
  
  sortableInstance = new Sortable(container, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onEnd: async function(evt) {
      // 순서 번호 업데이트 (UI)
      updateItemNumbers();
      
      // 서버에 순서 저장
      await saveItemOrder();
    }
  });
}

function updateItemNumbers() {
  const items = document.querySelectorAll('.playlist-item');
  items.forEach((item, index) => {
    const numberEl = item.querySelector('.item-number');
    if (numberEl) {
      numberEl.textContent = index + 1;
    }
  });
}

async function saveItemOrder() {
  const items = document.querySelectorAll('.playlist-item');
  const orderData = [];
  
  items.forEach((item, index) => {
    const id = parseInt(item.dataset.id);
    orderData.push({ id, sort_order: index + 1 });
  });
  
  // currentPlaylist.items 순서도 업데이트
  const newItems = [];
  items.forEach(item => {
    const id = parseInt(item.dataset.id);
    const found = currentPlaylist.items.find(i => i.id === id);
    if (found) newItems.push(found);
  });
  currentPlaylist.items = newItems;
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: orderData })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('순서가 저장되었습니다.');
    }
  } catch (e) {
    showToast('순서 저장 실패', 'error');
  }
}

function switchMediaTab(tab) {
  document.getElementById('tab-video').className = tab === 'video' 
    ? 'flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition'
    : 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition';
  document.getElementById('tab-image').className = tab === 'image'
    ? 'flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition'
    : 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition';
  
  document.getElementById('input-video').classList.toggle('hidden', tab !== 'video');
  document.getElementById('input-image').classList.toggle('hidden', tab !== 'image');
}

// 설정 패널 토글
function togglePlaylistSettings() {
  const panel = document.getElementById('playlist-settings-panel');
  const icon = document.getElementById('settings-toggle-icon');
  panel.classList.toggle('hidden');
  icon.classList.toggle('fa-chevron-down');
  icon.classList.toggle('fa-chevron-up');
  if (typeof postParentHeight === 'function') {
    setTimeout(postParentHeight, 50);
    setTimeout(postParentHeight, 300);
  }
}

function toggleSettingsSection(key) {
  const panel = document.getElementById('settings-section-' + key);
  const icon = document.getElementById('settings-section-icon-' + key);
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (icon) {
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
  }
  if (typeof postParentHeight === 'function') {
    setTimeout(postParentHeight, 50);
    setTimeout(postParentHeight, 300);
  }
}

// 라이브러리에 동영상 추가 (기존 addVideoItem 대체)
async function addVideoToLibrary() {
  const url = document.getElementById('new-video-url').value.trim();
  if (!url) {
    showToast('동영상 URL을 입력해주세요.', 'error');
    return;
  }
  
  if (!url.includes('vimeo.com')) {
    showToast('Vimeo URL만 지원됩니다.', 'error');
    return;
  }
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, add_to_playlist: false }) // 라이브러리에만 추가
    });
    
    const data = await res.json();
    
    if (data.success) {
      // 서버에서 최신 데이터 다시 가져오기 (activeItemIds는 로컬 유지)
      const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
      const playlistData = await playlistRes.json();
      const savedActiveIds = currentPlaylist.activeItemIds;
      currentPlaylist = playlistData.playlist;
      currentPlaylist.activeItemIds = savedActiveIds;
      
      renderLibraryOnly();
      _renderPlaylistOnly();
      document.getElementById('new-video-url').value = '';
      showToast('라이브러리에 추가되었습니다.');
    } else {
      showToast(data.error || '추가 실패', 'error');
    }
  } catch (e) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// 라이브러리에 이미지 추가
async function addImageToLibrary() {
  const url = document.getElementById('new-image-url').value.trim();
  const displayTime = parseInt(document.getElementById('new-image-display-time').value) || 10;
  
  if (!url) {
    showToast('이미지 URL을 입력해주세요.', 'error');
    return;
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    showToast('올바른 URL 형식을 입력해주세요.', 'error');
    return;
  }
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url, 
        item_type: 'image', 
        display_time: displayTime,
        add_to_playlist: false
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      // 서버에서 최신 데이터 다시 가져오기 (activeItemIds는 로컬 유지)
      const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
      const playlistData = await playlistRes.json();
      const savedActiveIds = currentPlaylist.activeItemIds;
      currentPlaylist = playlistData.playlist;
      currentPlaylist.activeItemIds = savedActiveIds;
      
      renderLibraryOnly();
      _renderPlaylistOnly();
      document.getElementById('new-image-url').value = '';
      showToast('라이브러리에 추가되었습니다.');
    } else {
      showToast(data.error || '추가 실패', 'error');
    }
  } catch (e) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// 라이브러리에서 플레이리스트로 아이템 추가
function addToPlaylistFromLibrary(itemId) {
  if (!currentPlaylist) return;
  const sid = String(itemId);
  const allItems = [...(masterItemsCache || []), ...(currentPlaylist.items || [])];
  const item = allItems.find(i => String(i.id) === sid);
  if (!item) { console.warn('[Playlist] item not found:', itemId); return; }

  if (!Array.isArray(currentPlaylist.activeItemIds)) currentPlaylist.activeItemIds = [];

  // 이미 있으면 무시
  if (currentPlaylist.activeItemIds.some(id => String(id) === sid)) {
    showToast('이미 재생목록에 있습니다.');
    return;
  }

  // 항상 String 타입으로 통일 저장 (숫자 vs 문자열 불일치 방지)
  currentPlaylist.activeItemIds.push(sid);
  _renderPlaylistOnly();
  _updateLibraryPlusButtons();
  saveActiveItems().then(ok => {
    if (ok) showToast('재생목록에 추가되었습니다.');
    else showToast('저장 실패', 'error');
  });
}

// 플레이리스트에서 제거 - itemId 기반 (index는 DOM 재렌더 후 불일치 발생)
function removeFromPlaylist(itemId) {
  if (!currentPlaylist || !Array.isArray(currentPlaylist.activeItemIds)) return;
  const sid = String(itemId);
  const before = currentPlaylist.activeItemIds.length;
  currentPlaylist.activeItemIds = currentPlaylist.activeItemIds.filter(
    id => String(id) !== sid
  );
  if (currentPlaylist.activeItemIds.length === before) {
    console.warn('[Playlist] removeFromPlaylist: item not found', itemId);
    return;
  }
  _renderPlaylistOnly();
  _updateLibraryPlusButtons();
  saveActiveItems().then(ok => {
    if (ok) showToast('재생목록에서 제거되었습니다.');
    else showToast('저장 실패', 'error');
  });
}

// 활성 아이템 목록 서버에 저장 (공용 영상 포함 모든 ID 저장)
async function saveActiveItems() {
  // 모든 activeItemIds를 그대로 저장 (공용/사용자 모두 포함)
  const allItemIds = currentPlaylist.activeItemIds || [];
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/active-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeItemIds: allItemIds })
    });

    if (!res.ok) {
      console.error('[Playlist] Failed to save active items:', await res.text());
      return false;
    }

    console.log('[Playlist] Active items saved:', allItemIds);
    return true;
  } catch (e) {
    console.error('[Playlist] Failed to save active items:', e);
    return false;
  }
}

async function refreshCurrentPlaylist() {
  if (!currentPlaylist?.id) return;
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
    if (!res.ok) return;
    const data = await res.json();
    // activeItemIds는 로컬 상태 유지 (서버 응답으로 덮어쓰지 않음)
    const localActiveIds = currentPlaylist.activeItemIds;
    currentPlaylist = data.playlist;
    currentPlaylist.activeItemIds = localActiveIds;
    _renderPlaylistOnly();
    _updateLibraryPlusButtons();
  } catch (e) {
    console.error('[Playlist] Refresh failed:', e);
  }
}

// 플레이리스트 순서 저장 (기존 reorder API 사용)
async function savePlaylistOrder() {
  // playlistOrder에 있는 아이템들의 sort_order를 업데이트
  const order = currentPlaylist.playlistOrder || [];
  const userItems = (currentPlaylist.items || []);
  
  // userItems 중에서 playlistOrder에 있는 것들만 순서 업데이트
  const itemsToReorder = order
    .map((id, index) => ({ id, sort_order: index }))
    .filter(item => userItems.some(ui => ui.id === item.id));
  
  if (itemsToReorder.length === 0) return;
  
  try {
    await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToReorder })
    });
    console.log('[Playlist] Order saved to server');
  } catch (e) {
    console.log('[Playlist] Order saved locally only');
  }
}

// 플레이리스트 활성 아이템 로드 (서버에서 받은 activeItemIds 사용)
function loadPlaylistOrder() {
  const items = currentPlaylist.items || [];
  const masterItems = masterItemsCache || [];
  
  // 서버에서 받은 activeItemIds 그대로 사용 (하위 호환성은 서버에서 처리)
  // 빈 배열이면 플레이리스트도 비어있는 것
  currentPlaylist.activeItemIds = currentPlaylist.activeItemIds || [];
  console.log('[Playlist] Loaded activeItemIds:', currentPlaylist.activeItemIds);
}

// 라이브러리 전체 렌더 (공용영상 캐시 로드 포함) - 모달 열릴 때 1회만 호출
async function renderLibraryAndPlaylist() {
  if (!currentPlaylist) return;

  const libraryMasterList = document.getElementById('library-master-list');
  const libraryUserList = document.getElementById('library-user-list');
  const playlistContainer = document.getElementById('playlist-items-container');
  const libraryMasterSection = document.getElementById('library-master-section');
  
  const items = currentPlaylist.items || [];
  const activeItemIds = Array.isArray(currentPlaylist.activeItemIds) ? currentPlaylist.activeItemIds : [];
  
  const editModal = document.getElementById('edit-playlist-modal');
  const isEditOpen = editModal && !editModal.classList.contains('hidden');

  // 공용 영상 로드 (캐시 우선, 없을 때만 네트워크)
  if (!masterItemsCache || masterItemsCache.length === 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const baseUrl = window.location.origin;
      const cacheBuster = isEditOpen ? ('?ts=' + Date.now()) : '';
      const res = await fetch(baseUrl + '/api/master/items' + cacheBuster, { cache: 'no-store', signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        masterItemsCache = data.items || [];
        cachedMasterItems = masterItemsCache;
      } else {
        masterItemsCache = cachedMasterItems || masterItemsCache || [];
      }
    } catch (e) {
      masterItemsCache = cachedMasterItems || masterItemsCache || [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  
  // 라이브러리: 공용 영상
  if (masterItemsCache && masterItemsCache.length > 0 && libraryMasterSection) {
    libraryMasterSection.classList.remove('hidden');
    libraryMasterList.innerHTML = masterItemsCache.map(item => `
      <div class="flex items-center gap-2 p-2 bg-purple-100 rounded cursor-pointer hover:bg-purple-200 transition"
           data-library-id="${item.id}" data-library-master="1"
           onclick="addToPlaylistFromLibrary(${item.id})">
        <div class="w-16 h-10 bg-purple-200 rounded overflow-hidden flex-shrink-0">
          ${item.thumbnail_url 
            ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center"><i class="fab fa-${item.item_type} text-purple-400"></i></div>`
          }
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-purple-800 truncate">${item.title || item.url}</p>
          <p class="text-xs text-purple-500"><i class="fas fa-crown mr-1"></i>공용</p>
        </div>
        <i class="fas fa-plus text-purple-400"></i>
      </div>
    `).join('');
  } else if (libraryMasterSection) {
    libraryMasterSection.classList.add('hidden');
  }
  
  // 라이브러리: 내 영상
  if (items.length > 0) {
    libraryUserList.innerHTML = items.map(item => `
      <div class="flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-blue-100 transition group" data-library-id="${item.id}" data-library-master="0">
        <div class="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 cursor-pointer"
             onclick="addToPlaylistFromLibrary(${item.id})">
          ${item.item_type === 'image'
            ? `<img src="${item.url}" class="w-full h-full object-cover">`
            : item.thumbnail_url 
              ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
              : `<div class="w-full h-full flex items-center justify-center"><i class="fab fa-${item.item_type} ${item.item_type === 'youtube' ? 'text-red-500' : 'text-blue-400'}"></i></div>`
          }
        </div>
        <div class="flex-1 min-w-0 cursor-pointer" data-item-id="${item.id}" onclick="editItemTitleById(this.dataset.itemId)">
          <p class="text-xs font-medium text-gray-800 truncate hover:text-blue-600" title="클릭하여 제목 수정">${item.title || item.url}</p>
          <p class="text-xs text-gray-500">
            ${item.item_type === 'youtube' ? '<i class="fab fa-youtube text-red-500"></i>' : 
              item.item_type === 'vimeo' ? '<i class="fab fa-vimeo text-blue-400"></i>' : 
              '<i class="fas fa-image text-green-400"></i>'}
            <i class="fas fa-pencil-alt ml-1 text-gray-400 text-xs"></i>
          </p>
        </div>
        <button onclick="addToPlaylistFromLibrary(${item.id})" 
                class="text-gray-400 hover:text-blue-500 p-1" title="재생목록에 추가">
          <i class="fas fa-plus"></i>
        </button>
        <button onclick="deletePlaylistItem(${item.id})" 
                class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100" title="삭제">
          <i class="fas fa-trash text-xs"></i>
        </button>
      </div>
    `).join('');
  } else {
    libraryUserList.innerHTML = '<div class="text-center py-4 text-gray-400 text-xs">영상을 추가하세요</div>';
  }

  renderLibrarySearchResults();
  
  // 플레이리스트 순서대로 렌더링
  const allItems = [...masterItemsCache, ...items];
  const playlistItems = activeItemIds
    .map(id => allItems.find(item => String(item.id) === String(id)))
    .filter(item => item);
  
  // 플레이리스트 카운트 업데이트
  const countEl = document.getElementById('playlist-count');
  if (countEl) countEl.textContent = playlistItems.length + '개';
  
  if (playlistItems.length === 0) {
    playlistContainer.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">왼쪽 라이브러리에서 영상을 클릭하여 추가하세요</div>';
    return;
  }
  
  playlistContainer.innerHTML = playlistItems.map((item, index) => `
    <div class="flex items-center gap-2 p-2 ${item.is_master ? 'bg-purple-50 border border-purple-200' : 'bg-green-50 border border-green-200'} rounded group"
         data-playlist-index="${index}" data-id="${item.id}" data-master="${item.is_master ? 1 : 0}">
      <div class="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
        <i class="fas fa-grip-vertical"></i>
      </div>
      <span class="text-sm font-bold ${item.is_master ? 'text-purple-500' : 'text-green-600'} w-6">${index + 1}</span>
      <div class="w-14 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0">
        ${item.item_type === 'image'
          ? `<img src="${item.url}" class="w-full h-full object-cover">`
          : item.thumbnail_url 
            ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center"><i class="fab fa-${item.item_type} text-gray-400"></i></div>`
        }
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-800 truncate">${item.title || item.url}</p>
      </div>
      <button onclick="removeFromPlaylist('${item.id}')" 
              class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
  
  // Sortable 초기화 (플레이리스트 에디터 내 영상 순서)
  initPlaylistItemsSortable();
  // 라이브러리 + 버튼 상태 초기화
  _updateLibraryPlusButtons();
}

// 플레이리스트 오른쪽만 동기 렌더 (추가/제거 시 즉시 호출)
function _renderPlaylistOnly() {
  if (!currentPlaylist) return;
  const playlistContainer = document.getElementById('playlist-items-container');
  if (!playlistContainer) return;
  const activeItemIds = Array.isArray(currentPlaylist.activeItemIds) ? currentPlaylist.activeItemIds : [];
  const items = currentPlaylist.items || [];
  const allItems = [...(masterItemsCache || []), ...items];
  const playlistItems = activeItemIds
    .map(id => allItems.find(item => String(item.id) === String(id)))
    .filter(item => item);
  const countEl = document.getElementById('playlist-count');
  if (countEl) countEl.textContent = playlistItems.length + '개';
  if (playlistItems.length === 0) {
    playlistContainer.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">왼쪽 라이브러리에서 영상을 클릭하여 추가하세요</div>';
    return;
  }
  playlistContainer.innerHTML = playlistItems.map((item, index) => `
    <div class="flex items-center gap-2 p-2 ${item.is_master ? 'bg-purple-50 border border-purple-200' : 'bg-green-50 border border-green-200'} rounded group"
         data-playlist-index="${index}" data-id="${item.id}" data-master="${item.is_master ? 1 : 0}">
      <div class="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
        <i class="fas fa-grip-vertical"></i>
      </div>
      <span class="text-sm font-bold ${item.is_master ? 'text-purple-500' : 'text-green-600'} w-6">${index + 1}</span>
      <div class="w-14 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0">
        ${item.item_type === 'image'
          ? `<img src="${item.url}" class="w-full h-full object-cover">`
          : item.thumbnail_url
            ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center"><i class="fab fa-${item.item_type} text-gray-400"></i></div>`
        }
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-800 truncate">${item.title || item.url}</p>
      </div>
      <button onclick="removeFromPlaylist('${item.id}')"
              class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
  initPlaylistItemsSortable();
}

// 라이브러리의 + 버튼 상태 업데이트 (렌더 후 호출)
function _updateLibraryPlusButtons() {
  if (!currentPlaylist) return;
  const activeIds = (currentPlaylist.activeItemIds || []).map(id => String(id));
  // 공용 영상
  document.querySelectorAll('[data-library-id][data-library-master="1"]').forEach(el => {
    const id = String(el.getAttribute('data-library-id'));
    const inPlaylist = activeIds.includes(id);
    el.style.opacity = inPlaylist ? '0.5' : '';
    el.style.pointerEvents = inPlaylist ? 'none' : '';
    const icon = el.querySelector('i');
    if (icon) icon.className = inPlaylist ? 'fas fa-check text-green-500' : 'fas fa-plus text-purple-400';
  });
  // 내 영상
  document.querySelectorAll('[data-library-id][data-library-master="0"]').forEach(el => {
    const id = String(el.getAttribute('data-library-id'));
    const inPlaylist = activeIds.includes(id);
    const btn = el.querySelector('button[title="재생목록에 추가"]');
    if (btn) {
      btn.innerHTML = inPlaylist ? '<i class="fas fa-check text-green-500"></i>' : '<i class="fas fa-plus"></i>';
      btn.disabled = inPlaylist;
    }
  });
}

// 라이브러리 왼쪽 패널만 렌더 (자동 리프레시 시 플레이리스트는 건드리지 않음)
function renderLibraryOnly() {
  if (!currentPlaylist) return;
  const libraryMasterList = document.getElementById('library-master-list');
  const libraryUserList = document.getElementById('library-user-list');
  const libraryMasterSection = document.getElementById('library-master-section');
  const items = currentPlaylist.items || [];

  if (masterItemsCache && masterItemsCache.length > 0 && libraryMasterSection) {
    libraryMasterSection.classList.remove('hidden');
    libraryMasterList.innerHTML = masterItemsCache.map(item => `
      <div class="flex items-center gap-2 p-2 bg-purple-100 rounded cursor-pointer hover:bg-purple-200 transition"
           data-library-id="${item.id}" data-library-master="1"
           onclick="addToPlaylistFromLibrary(${item.id})">
        <div class="w-16 h-10 bg-purple-200 rounded overflow-hidden flex-shrink-0">
          ${item.thumbnail_url
            ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center"><i class="fab fa-${item.item_type} text-purple-400"></i></div>`
          }
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-purple-800 truncate">${item.title || item.url}</p>
          <p class="text-xs text-purple-500"><i class="fas fa-crown mr-1"></i>공용</p>
        </div>
        <i class="fas fa-plus text-purple-400"></i>
      </div>
    `).join('');
  } else if (libraryMasterSection) {
    libraryMasterSection.classList.add('hidden');
  }

  if (items.length > 0 && libraryUserList) {
    libraryUserList.innerHTML = items.map(item => `
      <div class="flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-blue-100 transition group" data-library-id="${item.id}" data-library-master="0">
        <div class="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 cursor-pointer"
             onclick="addToPlaylistFromLibrary(${item.id})">
          ${item.item_type === 'image'
            ? `<img src="${item.url}" class="w-full h-full object-cover">`
            : item.thumbnail_url
              ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover">`
              : `<div class="w-full h-full flex items-center justify-center"><i class="fab fa-${item.item_type} ${item.item_type === 'youtube' ? 'text-red-500' : 'text-blue-400'}"></i></div>`
          }
        </div>
        <div class="flex-1 min-w-0 cursor-pointer" data-item-id="${item.id}" onclick="editItemTitleById(this.dataset.itemId)">
          <p class="text-xs font-medium text-gray-800 truncate hover:text-blue-600">${item.title || item.url}</p>
          <p class="text-xs text-gray-500">
            ${item.item_type === 'youtube' ? '<i class="fab fa-youtube text-red-500"></i>' :
              item.item_type === 'vimeo' ? '<i class="fab fa-vimeo text-blue-400"></i>' :
              '<i class="fas fa-image text-green-400"></i>'}
          </p>
        </div>
        <button onclick="addToPlaylistFromLibrary(${item.id})"
                class="text-gray-400 hover:text-blue-500 p-1" title="재생목록에 추가">
          <i class="fas fa-plus"></i>
        </button>
        <button onclick="deletePlaylistItem(${item.id})"
                class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100" title="삭제">
          <i class="fas fa-trash text-xs"></i>
        </button>
      </div>
    `).join('');
  }
  _updateLibraryPlusButtons();
}

// 영상 제목 수정 (ID로 아이템 찾아서 수정)
async function editItemTitleById(itemId) {
  console.log('[EditTitle] itemId:', itemId, 'currentPlaylist:', currentPlaylist);
  const id = parseInt(itemId);
  const item = currentPlaylist.items.find(i => i.id === id);
  console.log('[EditTitle] Found item:', item);
  if (!item) {
    showToast('아이템을 찾을 수 없습니다.', 'error');
    return;
  }
  
  const currentTitle = item.title || item.url;
  const newTitle = prompt('영상 제목을 입력하세요:', currentTitle);
  console.log('[EditTitle] newTitle:', newTitle, 'currentTitle:', currentTitle);
  if (newTitle === null || newTitle.trim() === currentTitle) return;
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() })
    });
    
    if (res.ok) {
      // 로컬 데이터 업데이트
      item.title = newTitle.trim();
      renderLibraryAndPlaylist();
      showToast('제목이 수정되었습니다.');
    } else {
      showToast('수정 실패', 'error');
    }
  } catch (e) {
    console.error('Title edit error:', e);
    showToast('오류가 발생했습니다.', 'error');
  }
}

// 플레이리스트 에디터 내 영상 순서 Sortable 초기화 (playlistItemsSortableInstance는 JS 블록 상단에 선언됨)
function initPlaylistItemsSortable() {
  const container = document.getElementById('playlist-items-container');
  if (playlistItemsSortableInstance) {
    playlistItemsSortableInstance.destroy();
  }
  
  playlistItemsSortableInstance = new Sortable(container, {
    animation: 150,
    handle: '.drag-handle',
    onEnd: function(evt) {
      if (evt.oldIndex === evt.newIndex) return;
      const activeIds = (currentPlaylist.activeItemIds || []).map(id => String(id));
      const [moved] = activeIds.splice(evt.oldIndex, 1);
      activeIds.splice(evt.newIndex, 0, moved);
      currentPlaylist.activeItemIds = activeIds;
      _renderPlaylistOnly();
      saveActiveItems();
    }
  });
}

async function addVideoItem() {
  await addVideoToLibrary();
}

async function addImageItem() {
  await addImageToLibrary();
}

async function deletePlaylistItem(itemId) {
  try {
    const res = await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      throw new Error('삭제 실패');
    }
    
    // 서버에서 최신 데이터 다시 가져오기 (activeItemIds에서도 해당 항목 제거)
    const playlistRes = await fetch(API_BASE + '/playlists/' + currentPlaylist.id);
    const data = await playlistRes.json();
    // activeItemIds에서 삭제된 항목 제거
    const prevActiveIds = (currentPlaylist.activeItemIds || [])
      .map(id => String(id))
      .filter(id => id !== String(itemId));
    currentPlaylist = data.playlist;
    currentPlaylist.activeItemIds = prevActiveIds;
    
    // 공용 영상 캐시도 새로 로드
    masterItemsCache = null;
    
    // 2컬럼 레이아웃 또는 기존 레이아웃 렌더링
    if (document.getElementById('library-master-list')) {
      await renderLibraryAndPlaylist();
    } else {
      renderPlaylistItems();
    }
    loadPlaylists();
    showToast('삭제되었습니다.');
  } catch (e) {
    showToast('삭제 실패', 'error');
  }
}

async function updateItemDisplayTime(itemId, time) {
  try {
    await fetch(API_BASE + '/playlists/' + currentPlaylist.id + '/items/' + itemId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_time: parseInt(time) })
    });
    showToast('저장되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

async function shortenUrl(playlistId, currentCode) {
  if (currentCode.length <= 5) {
    showToast('이미 최단 URL입니다.');
    return;
  }
  
  if (!confirm('URL을 5자리로 단축하시겠습니까?\n기존 URL(' + currentCode + ')은 더 이상 작동하지 않습니다.')) {
    return;
  }
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + playlistId + '/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) throw new Error('단축 실패');
    
    const data = await res.json();
    showToast('URL이 단축되었습니다: ' + data.short_code);
    
    // UI 업데이트
    await loadPlaylists();
    
  } catch (e) {
    showToast('단축 실패: ' + e.message, 'error');
  }
}

// TV 코드 생성
async function generateTvCode(playlistId) {
  const codeEl = document.getElementById('tv-code-' + playlistId);
  
  try {
    const res = await fetch('/api/playlist/' + playlistId + '/tv-code', {
      method: 'POST'
    });
    
    if (res.ok) {
      const data = await res.json();
      if (codeEl) {
        codeEl.textContent = data.tvCode;
        codeEl.classList.add('animate-pulse');
        setTimeout(() => codeEl.classList.remove('animate-pulse'), 1000);
      }
      showToast('TV 코드: ' + data.tvCode + ' (TV에서 /tv 접속 후 입력)');
    } else {
      throw new Error('코드 생성 실패');
    }
  } catch (e) {
    showToast('TV 코드 생성 실패', 'error');
  }
}

async function createShortUrl(url, playlistId) {
  // generateShortUrl로 위임
  const playlist = playlists.find(p => p.id == playlistId);
  const shortCode = playlist ? playlist.short_code : '';
  await generateShortUrl(playlistId, shortCode);
}

// USB 북마크 파일 다운로드
// 바로가기 명령어 복사
function copyShortcutCommand() {
  const cmd = document.getElementById('shortcut-command').textContent;
  navigator.clipboard.writeText(cmd);
  showToast('📋 명령어가 복사되었습니다');
}

// 바로가기 가이드 모달 열 때 URL 목록 업데이트
function showShortcutGuide() {
  closeModal('script-download-modal');
  
  // 첫 번째 체어 명령어 업데이트
  if (playlists.length > 0) {
    document.getElementById('shortcut-command').textContent = 
      'chrome --kiosk "' + location.origin + '/' + playlists[0].short_code + '"';
  }
  
  // 모든 체어 URL 목록 업데이트
  const urlsDiv = document.getElementById('all-chair-urls');
  urlsDiv.innerHTML = playlists.map(p => 
    '<div class="flex justify-between items-center py-1 border-b border-purple-100">' +
    '<span class="text-purple-700">' + p.name + ':</span>' +
    '<span class="text-gray-600">' + location.origin + '/' + p.short_code + '</span>' +
    '</div>'
  ).join('');
  
  openModal('shortcut-guide-modal');
}

function downloadBookmark(name, url, shortCode, variant = 'universal') {
  const safeName = (name || '치과TV').replace(/[^a-zA-Z0-9가-힣]/g, '_');
  const profiles = {
    universal: { label: '공통', fileSuffix: '', fontSize: 18, buttonSize: 18, fontFamily: 'Arial, sans-serif' },
    samsung: { label: 'Samsung', fileSuffix: '_Samsung', fontSize: 22, buttonSize: 22, fontFamily: 'SamsungOne, Arial, sans-serif' },
    lg: { label: 'LG', fileSuffix: '_LG', fontSize: 22, buttonSize: 22, fontFamily: 'LG Smart, Arial, sans-serif' },
    android: { label: 'Android TV', fileSuffix: '_AndroidTV', fontSize: 22, buttonSize: 22, fontFamily: 'Roboto, Arial, sans-serif' }
  };
  const profile = profiles[variant] || profiles.universal;
  const noteSize = Math.max(12, profile.fontSize - 6);
  const bookmarkHtmlTv = [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>' + safeName + ' - 치과TV (' + profile.label + ')</title>',
    '  <style>',
    '    body { font-family: ' + profile.fontFamily + '; text-align: center; padding: 32px; font-size: ' + profile.fontSize + 'px; }',
    '    a { display: inline-block; padding: 16px 28px; background: #2563eb; color: #fff; border-radius: 12px; text-decoration: none; font-size: ' + profile.buttonSize + 'px; }',
    '    p { color: #555; margin-top: 12px; }',
    '    .note { margin-top: 14px; color: #92400e; font-size: ' + noteSize + 'px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <h2>' + safeName + ' - 치과TV (' + profile.label + ')</h2>',
    '  <a href="' + url + '">TV 화면 열기</a>',
    '  <p>링크가 안 열리면 주소창에 아래 URL을 입력하세요.</p>',
    '  <p style="font-family: monospace;">' + url + '</p>',
    '  <p class="note">파일이 TV에서 열리지 않으면 <strong>단축 URL을 직접 입력</strong>해 주세요.</p>',
    '</body>',
    '</html>'
  ].join('\n');

  const blob = new Blob(['\ufeff' + bookmarkHtmlTv], { type: 'text/html;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_' + safeName + profile.fileSuffix + '.htm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('📁 TV 전용 HTML(.htm) 다운로드 완료!\nUSB에 복사 후 TV에서 열기');
}

// =========================================================
// URL 바로가기 파일 다운로드 (.url 형식)
// - Windows 인터넷 바로가기 형식
// - 일부 스마트 TV에서 지원
// =========================================================
function downloadUrlFile(name, url) {
  const today = new Date().toLocaleDateString('ko-KR');
  // Windows 인터넷 바로가기 형식 (.url)
  let urlContent = '[InternetShortcut]\n';
  urlContent += 'URL=' + url + '\n';
  urlContent += '; =========================================================\n';
  urlContent += '; 치과 TV URL 바로가기 - ' + name + '\n';
  urlContent += '; 생성일: ' + today + '\n';
  urlContent += '; ---------------------------------------------------------\n';
  urlContent += '; [사용 방법]\n';
  urlContent += '; 1. 이 파일을 USB에 복사\n';
  urlContent += '; 2. TV USB 포트에 연결\n';
  urlContent += '; 3. TV 파일 탐색기에서 이 파일 실행\n';
  urlContent += '; =========================================================\n';
  
  const blob = new Blob([urlContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_' + name.replace(/[^a-zA-Z0-9가-힣]/g, '_') + '.url';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('📁 URL 바로가기 다운로드 완료!\nUSB에 복사 후 TV에서 열기');
}

// =========================================================
// 단축 URL 생성 (is.gd API 사용)
// - TV 리모컨으로 입력하기 쉬운 짧은 URL 생성
// - 대기실 TV에 유용
// =========================================================
async function generateShortUrl(playlistId, shortCode) {
  try {
    showToast('단축 URL 생성 중...', 'info');
    
    // 서버 API를 통해 단축 URL 생성
    const res = await fetch(API_BASE + '/playlists/' + playlistId + '/external-shorten', {
      method: 'POST'
    });
    
    const data = await res.json();
    
    if (data.success && data.shortUrl) {
      const shortUrlDisplay = data.shortUrl.replace('https://', '');
      
      // 모든 관련 입력창 업데이트
      updateAllUrlDisplays(playlistId, shortUrlDisplay, data.shortUrl);
      
      // 클립보드 복사 (iframe 환경에서 실패해도 무시)
      try {
        await navigator.clipboard.writeText(data.shortUrl);
        showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay + ' (클립보드 복사됨)', 'success', 5000);
      } catch (clipErr) {
        showToast('✅ 단축 URL 생성 완료! ' + shortUrlDisplay, 'success', 5000);
      }
    } else {
      showToast('단축 URL 생성 실패: ' + (data.error || ''), 'error');
    }
  } catch (e) {
    console.error('단축 URL 생성 오류:', e);
    showToast('단축 URL 생성 실패: ' + e.message, 'error');
  }
}

// 모든 URL 표시 영역 업데이트
function updateAllUrlDisplays(playlistId, shortUrlDisplay, fullUrl) {
  // 1. 초기 설정 섹션 입력창
  const settingInputEl = document.getElementById('setting-url-' + playlistId);
  if (settingInputEl) {
    settingInputEl.value = shortUrlDisplay;
  }
  
  // 2. 전체 목록 div
  const mainDivEl = document.getElementById('tv-short-url-' + playlistId);
  if (mainDivEl) {
    mainDivEl.textContent = shortUrlDisplay;
    mainDivEl.setAttribute('data-url', fullUrl);
  }
  
  // 3. 팝업창 (열려있다면)
  const guideUrlEl = document.getElementById('guide-short-url');
  if (guideUrlEl && newlyCreatedPlaylist && newlyCreatedPlaylist.id == playlistId) {
    guideUrlEl.textContent = shortUrlDisplay;
  }
  
  // 4. 'TV 설정 필요' 배지 제거
  const badgeEl = document.getElementById('badge-setup-' + playlistId);
  if (badgeEl) badgeEl.remove();
  
  // 5. '단축 URL 생성' 버튼 제거
  const btnShortenEl = document.getElementById('btn-shorten-' + playlistId);
  if (btnShortenEl) btnShortenEl.remove();
}

// 초기 설정 섹션 URL 복사
function copySettingUrl(playlistId) {
  const inputEl = document.getElementById('setting-url-' + playlistId);
  if (inputEl) {
    const url = inputEl.value.startsWith('http') ? inputEl.value : 'https://' + inputEl.value;
    navigator.clipboard.writeText(url);
    showToast('URL이 복사되었습니다!');
  }
}

// 전체 자동 실행 스크립트 다운로드
// 모달용 선택 체어 저장 변수
var selectedChairsForModal = [];

function downloadAutoRunScript(btnEl) {
  if (playlists.length === 0) {
    showToast('체어를 먼저 추가해주세요', 'error', 1200, btnEl);
    return;
  }
  const selected = getSelectedChairs();
  if (selected.length === 0) {
    showToast('체어를 먼저 선택하세요', 'error', 1200, btnEl);
    return;
  }
  // 선택 체어를 전역에 저장해서 모달 안에서도 사용
  selectedChairsForModal = selected;
  showScriptDownloadModal();
}

// 스크립트 전용 모달 표시 (openModal 사용 안 함 - iframe 위치 독립적)
function _showScriptModal(el) {
  if (!el) return;
  if (el.parentElement !== document.body) document.body.appendChild(el);
  // iframe 내부를 스크롤 최상단으로
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  // iframePageTop: 위젯에서 받은 iframe의 페이지 내 top (= 아임웹 헤더 높이)
  // 이 값만큼 top을 내려야 모달이 iframe 뷰포트 최상단에 표시됨
  var topVal = (iframePageTop > 0 && iframePageTop < 300) ? iframePageTop : 0;
  el.style.cssText = 'display:flex !important; position:fixed; top:' + topVal + 'px; left:0; right:0; bottom:0; width:100%; z-index:99999; align-items:flex-start; justify-content:center; padding-top:40px; box-sizing:border-box;';
  document.body.classList.add('modal-open');
  // 부모(아임웹)에 iframe 높이 확보 + 스크롤 최상단 요청
  try {
    if (window.parent && window.parent !== window) {
      var h = Math.max(Math.round(window.screen.height * 0.92), 700);
      window.parent.postMessage({ type: 'setHeight', height: h }, '*');
      window.parent.postMessage({ type: 'scrollToTop' }, '*');
    }
  } catch(e) {}
}

// 스크립트 다운로드 모달 표시 (설치 방법 안내용)
function showScriptDownloadModal() {
  _showScriptModal(document.getElementById('script-download-modal'));
}

// 선택된 체어의 링크 복사
function copyInstallLink() {
  const selected = selectedChairsForModal.length > 0 ? selectedChairsForModal : getSelectedChairs();
  if (selected.length === 0) {
    showToast('체어를 선택해주세요', 'error');
    return;
  }
  const links = selected.map(c => location.origin + '/' + c.code).join('\n');
  navigator.clipboard.writeText(links).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = links;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  });
  showToast(selected.length + '개 체어 URL 복사됨');
}

// 선택된 체어의 스크립트 다운로드
function downloadInstallScript() {
  const selected = selectedChairsForModal.length > 0 ? selectedChairsForModal : getSelectedChairs();
  const scriptType = document.querySelector('input[name="script-type"]:checked').value;
  
  if (selected.length === 0) {
    showToast('체어를 먼저 선택하세요', 'error');
    return;
  }
  
  if (scriptType === 'vbs') {
    selected.forEach(c => downloadSingleVbs(c.code, c.name));
  } else {
    selected.forEach(c => downloadSingleScript(c.code, c.name));
  }
  showToast(selected.length + '개 스크립트 다운로드');
}

// 개별 스크립트 다운로드 (설명 포함)
function downloadSingleScript(shortCode, name) {
  const today = new Date().toLocaleDateString('ko-KR');
  const url = location.origin + '/' + shortCode;
  let batContent = '@echo off\n';
  batContent += 'chcp 65001 > nul\n';
  batContent += 'REM =========================================================\n';
  batContent += 'REM 치과 TV 개별 스크립트 - ' + name + '\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM 생성일: ' + today + '\n';
  batContent += 'REM URL: ' + url + '\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM [사용 방법]\n';
  batContent += 'REM 1. 이 파일을 더블클릭하면 크롬 전체화면이 열립니다\n';
  batContent += 'REM 2. ESC 키로 전체화면 해제, 화면 클릭으로 다시 전체화면\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM [자동 실행 설정]\n';
  batContent += 'REM Win+R -> shell:startup -> 이 파일을 복사\n';
  batContent += 'REM PC 부팅 시 자동으로 TV 화면이 실행됩니다\n';
  batContent += 'REM =========================================================\n\n';
  batContent += 'echo ' + name + ' TV 화면을 실행합니다...\n';
  batContent += 'start "" chrome --kiosk "' + url + '"\n';
  
  const blob = new Blob([batContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_' + name.replace(/[^a-zA-Z0-9가-힣]/g, '_') + '.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('✅ ' + name + ' 스크립트 다운로드 완료');
}

// 개별 설치 모달 표시
function showIndividualInstall() {
  const container = document.getElementById('individual-chair-scripts');
  if (!container) return;
  
  container.innerHTML = playlists.map((p, idx) => {
    const url = location.origin + '/' + p.short_code;
    return '<div class="bg-orange-50 border border-orange-200 rounded-lg p-3">' +
      '<div class="flex items-center justify-between">' +
        '<div class="flex items-center gap-2">' +
          '<span class="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">' + (idx + 1) + '</span>' +
          '<span class="font-bold text-orange-800">' + p.name + '</span>' +
        '</div>' +
        '<div class="flex gap-1">' +
          '<button onclick="downloadSingleScript(\'' + p.short_code + '\', \'' + p.name + '\')" class="bg-blue-500 text-white text-xs px-3 py-1 rounded hover:bg-blue-600">BAT</button>' +
          '<button onclick="downloadSingleVbs(\'' + p.short_code + '\', \'' + p.name + '\')" class="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600">VBS</button>' +
        '</div>' +
      '</div>' +
      '<p class="text-xs text-gray-500 mt-2 break-all">' + url + '</p>' +
    '</div>';
  }).join('');
  
  openModal('individual-install-modal');
}

// 개별 VBS 다운로드 (설명 포함)
function downloadSingleVbs(shortCode, name) {
  const today = new Date().toLocaleDateString('ko-KR');
  const url = location.origin + '/' + shortCode;
  let vbsContent = "'=========================================================\n";
  vbsContent += "' 치과 TV 개별 스크립트 - " + name + "\n";
  vbsContent += "'---------------------------------------------------------\n";
  vbsContent += "' 생성일: " + today + "\n";
  vbsContent += "' URL: " + url + "\n";
  vbsContent += "'---------------------------------------------------------\n";
  vbsContent += "' [사용 방법]\n";
  vbsContent += "' 1. 이 파일을 더블클릭하면 크롬 전체화면이 열립니다\n";
  vbsContent += "' 2. ESC 키로 전체화면 해제, 화면 클릭으로 다시 전체화면\n";
  vbsContent += "'---------------------------------------------------------\n";
  vbsContent += "' [자동 실행 설정] Win+R -> shell:startup -> 이 파일 복사\n";
  vbsContent += "' (백신이 BAT 파일 차단 시 이 VBS 파일 사용)\n";
  vbsContent += "'=========================================================\n\n";
  vbsContent += 'CreateObject("WScript.Shell").Run "chrome --kiosk ""' + url + '"""\n';
  
  const blob = new Blob([vbsContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_' + name.replace(/[^a-zA-Z0-9가-힣]/g, '_') + '.vbs';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('✅ ' + name + ' VBS 스크립트 다운로드 완료');
}

// =========================================================
// 네트워크 통합 관리 기능 (로컬 네트워크 IP 방식)
// - 데스크 PC에서 같은 네트워크의 모든 체어 PC를 관리
// =========================================================

// 네트워크 관리용 BAT 파일 다운로드 (체어 PC가 아닌 데스크 PC에서 모든 체어 URL 열기)
function downloadNetworkManageBat() {
  const today = new Date().toLocaleDateString('ko-KR');
  const chairs = playlists;
  
  let batContent = '@echo off\n';
  batContent += 'chcp 65001 > nul\n';
  batContent += 'REM =========================================================\n';
  batContent += 'REM 치과 TV 통합 관리 스크립트 (로컬 네트워크)\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM 생성일: ' + today + '\n';
  batContent += 'REM 체어 수: ' + chairs.length + '개\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM [이 스크립트의 용도]\n';
  batContent += 'REM - 데스크 PC에서 모든 체어 TV URL을 한번에 열기\n';
  batContent += 'REM - 모니터링 및 테스트 용도\n';
  batContent += 'REM ---------------------------------------------------------\n';
  batContent += 'REM [실제 운영 시 주의]\n';
  batContent += 'REM - 실제로는 각 체어 PC에 개별 스크립트 설치 필요\n';
  batContent += 'REM - 이 스크립트는 데스크 PC에서 확인용\n';
  batContent += 'REM =========================================================\n\n';
  batContent += 'echo =========================================================\n';
  batContent += 'echo   치과 TV 통합 관리 - 로컬 네트워크 모드\n';
  batContent += 'echo   ' + chairs.length + '개 체어 화면을 확인합니다...\n';
  batContent += 'echo =========================================================\n\n';
  
  chairs.forEach((p, index) => {
    const url = location.origin + '/' + p.short_code;
    batContent += 'REM ' + (index + 1) + '. ' + p.name + '\n';
    batContent += 'REM TV URL: ' + url + '\n';
    batContent += 'echo [' + (index + 1) + '/' + chairs.length + '] ' + p.name + ' 열기...\n';
    batContent += 'start "" chrome --new-window "' + url + '"\n';
    batContent += 'timeout /t 2 /nobreak > nul\n\n';
  });
  
  batContent += 'echo.\n';
  batContent += 'echo =========================================================\n';
  batContent += 'echo   모든 TV 화면이 열렸습니다!\n';
  batContent += 'echo   각 창에서 TV 화면을 확인하세요.\n';
  batContent += 'echo =========================================================\n';
  
  batContent += 'echo.\n';
  batContent += 'pause\n';
  
  const blob = new Blob([batContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_통합관리_네트워크_' + chairs.length + '체어.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  showToast('✅ 네트워크 관리 BAT 파일 다운로드 완료');
}

// 네트워크 관리용 HTML 대시보드 다운로드
function downloadNetworkManageHtml() {
  const chairs = playlists;
  
  // 체어 정보를 텍스트로 생성
  let chairList = chairs.map((p, idx) => {
    return (idx + 1) + '. ' + p.name + ' - ' + location.origin + '/' + p.short_code;
  }).join('\n');
  
  // 간단한 HTML 생성
  const html = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="UTF-8"><title>치과TV 관리</title>',
    '<style>body{font-family:sans-serif;padding:20px;background:#f5f5f5;}',
    '.card{background:white;padding:20px;margin:10px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}',
    'a{color:#3b82f6;}</style></head>',
    '<body><h1>치과 TV 통합 관리</h1>',
    '<div class="card"><h2>체어 목록</h2><pre>' + chairList + '</pre></div>',
    '<div class="card"><a href="' + location.origin + '/login" target="_blank">관리자 페이지 열기</a></div>',
    '</body></html>'
  ].join('');
  
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dental_tv_dashboard.html';
  a.click();
  URL.revokeObjectURL(url);
  showToast('대시보드 HTML 다운로드 완료');
}

// 카카오톡 공유
function shareViaKakao() {
  const links = playlists.map(p => p.name + ': ' + location.origin + '/' + p.short_code).join('\n');
  const text = '📺 치과 TV 링크\n\n' + links;
  
  // 카카오톡 URL scheme (모바일 앱 열기)
  const kakaoUrl = 'kakaotalk://msg/text/' + encodeURIComponent(text);
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // 모바일: 카카오톡 앱 열기 시도
    window.location.href = kakaoUrl;
    setTimeout(() => {
      navigator.clipboard.writeText(text);
      showToast('📋 카카오톡이 없으면 링크가 복사됩니다. 붙여넣기 하세요!');
    }, 1500);
  } else {
    // PC: 클립보드 복사 후 안내
    navigator.clipboard.writeText(text);
    showToast('📋 링크가 복사되었습니다. 카카오톡에 붙여넣기 하세요!');
  }
}

// 문자 공유
function shareViaSMS() {
  const links = playlists.map(p => p.name + ': ' + location.origin + '/' + p.short_code).join('\n');
  const text = '치과 TV 링크\n' + links;
  
  // SMS URL scheme
  window.location.href = 'sms:?body=' + encodeURIComponent(text);
}

// 이메일 공유
function shareViaEmail() {
  const links = playlists.map(p => p.name + ': ' + location.origin + '/' + p.short_code).join('\n');
  const subject = '치과 TV 체어별 링크';
  const body = '안녕하세요,\n\n치과 TV 체어별 링크입니다:\n\n' + links + '\n\n각 체어 PC에서 해당 링크를 열어주세요.';
  
  const mailUrl = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  window.open(mailUrl);
}

// 링크 시트 인쇄
function printLinkSheet() {
  const printContent = '<html><head><title>치과 TV 체어별 링크</title>' +
    '<style>body{font-family:sans-serif;padding:20px;} h1{color:#333;} .chair{border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:8px;} .name{font-weight:bold;font-size:18px;} .url{color:#666;margin-top:5px;} .qr{text-align:center;margin-top:10px;}</style>' +
    '</head><body>' +
    '<h1>📺 치과 TV 체어별 링크</h1>' +
    '<p>각 체어 PC에서 해당 URL을 열어주세요.</p>' +
    playlists.map((p, idx) => {
      const url = location.origin + '/' + p.short_code;
      const qrUrl = 'https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=' + encodeURIComponent(url);
      return '<div class="chair">' +
        '<div class="name">' + (idx + 1) + '. ' + p.name + '</div>' +
        '<div class="url">' + url + '</div>' +
        '<div class="qr"><img src="' + qrUrl + '"></div>' +
      '</div>';
    }).join('') +
    '</body></html>';
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
}

// BAT 파일 다운로드 (키오스크 모드)
function downloadBatScript() {
  let batContent = '@echo off\n';
  batContent += 'chcp 65001 > nul\n';
  batContent += 'echo 치과 TV 자동 실행 중...\n';
  
  playlists.forEach((p, index) => {
    const url = location.origin + '/' + p.short_code;
    batContent += 'start "" chrome --kiosk --new-window "' + url + '"\n';
    batContent += 'timeout /t 3 /nobreak > nul\n';
  });
  
  const blob = new Blob([batContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_자동실행.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  closeModal('script-download-modal');
  showToast('✅ BAT 파일 다운로드 완료!');
  showAutoRunGuide();
}

// VBS 파일 다운로드 (백신 우회용)
function downloadVbsScript() {
  let vbsContent = '';
  
  playlists.forEach((p, index) => {
    const url = location.origin + '/' + p.short_code;
    vbsContent += 'CreateObject("WScript.Shell").Run "chrome --kiosk --new-window ""' + url + '"""\n';
    vbsContent += 'WScript.Sleep 3000\n';
  });
  
  const blob = new Blob([vbsContent.replace(/\\n/g, '\r\n')], { type: 'text/plain' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '치과TV_자동실행.vbs';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  
  closeModal('script-download-modal');
  showToast('✅ VBS 파일 다운로드 완료!');
  showAutoRunGuide();
}

// 바로가기 생성 안내 (showShortcutGuide는 8841줄에 정의됨)

// 자동 실행 가이드 모달
function showAutoRunGuide() {
  openModal('autorun-guide-modal');
}

function openPreviewModal() {
  const shortCode = currentPlaylist.short_code;
  document.getElementById('preview-iframe').src = '/tv/' + shortCode + '?preview=1';
  openModal('preview-modal');
}

function openQuickPreview(shortCode) {
  document.getElementById('preview-iframe').src = '/tv/' + shortCode + '?preview=1';
  openModal('preview-modal');
}

// TV 미러링 열기 (팝업 차단 방지를 위해 동기적으로 창 열기)
function openTVMirror(shortCode, itemCount) {
  if (!shortCode) {
    alert('TV 코드가 없습니다. 관리자에게 문의하세요.');
    return;
  }
  // 아이템 개수 검증은 서버에서 처리 (공용 영상 포함 시 0일 수 있음)
  const url = '/tv/' + shortCode;
  const opened = window.open(url, '_blank');
  if (!opened) {
    window.location.href = url;
  }
}

function showQrCode(url) {
  // Google Charts QR API 사용
  const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=' + encodeURIComponent(url);
  document.getElementById('qr-code-container').innerHTML = '<img src="' + qrUrl + '" alt="QR Code" class="rounded-lg shadow-md">';
  document.getElementById('qr-url-text').textContent = url;
  openModal('qr-modal');
}

function sendToTv() {
  const shortCode = currentPlaylist ? currentPlaylist.short_code : '';
  if (shortCode) {
    openTVMirror(shortCode, 0);
  }
}

// 공지사항
async function loadNotices() {
  try {
    const res = await fetch(API_BASE + '/notices');
    const data = await res.json();
    notices = data.notices || [];
    renderNotices();
  } catch (e) {
    console.error('Load notices error:', e);
  }
}

// noticeSortableInstance는 JS 블록 상단에 선언됨

function renderNotices() {
  const container = document.getElementById('notices-container');
  
  // 기존 sortable 인스턴스 제거
  if (noticeSortableInstance) {
    noticeSortableInstance.destroy();
    noticeSortableInstance = null;
  }
  
  if (notices.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <i class="fas fa-bullhorn text-4xl text-gray-300 mb-4"></i>
        <p class="text-gray-500">공지사항이 없습니다.</p>
        <p class="text-sm text-gray-400 mt-2">새 공지사항을 추가해보세요.</p>
      </div>
    `;
    return;
  }
  
  // 긴급공지와 일반공지 분리
  const urgentNotices = notices.filter(n => n.is_urgent);
  const normalNotices = notices.filter(n => !n.is_urgent);
  
  let html = '';
  
  // 긴급공지 섹션
  if (urgentNotices.length > 0) {
    html += `
      <div class="mb-4">
        <h4 class="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
          <i class="fas fa-exclamation-circle"></i>긴급공지 (${urgentNotices.length}개)
        </h4>
        <div class="bg-red-50 rounded-xl p-3 space-y-2">
    `;
    urgentNotices.forEach((n, index) => {
      html += `
        <div class="notice-item bg-white rounded-lg p-3 border-l-4 border-red-500" data-id="${n.id}">
          <div class="flex items-center justify-between">
            <div class="notice-drag-handle text-gray-400 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing mr-2">
              <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">긴급</span>
                <span class="px-2 py-0.5 rounded text-xs font-medium ${n.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}">
                  ${n.is_active ? '✓ TV에 표시중' : '숨김'}
                </span>
              </div>
              <p class="text-gray-800 whitespace-pre-wrap">${n.content}</p>
            </div>
            <div class="flex items-center gap-1 ml-4">
              <button onclick="toggleUrgent(${n.id}, 0)"
                class="px-2 py-1 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200">
                긴급해제
              </button>
              <button onclick="toggleNotice(${n.id}, ${n.is_active ? 0 : 1})"
                class="px-2 py-1 rounded text-xs ${n.is_active ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}">
                ${n.is_active ? '숨기기' : '표시'}
              </button>
              <button onclick="editNotice(${n.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200">
                수정
              </button>
              <button onclick="deleteNotice(${n.id})" class="p-1.5 text-red-400 hover:text-red-600" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  // 일반공지 섹션
  if (normalNotices.length > 0) {
    html += `
      <div>
        <h4 class="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
          <i class="fas fa-bullhorn"></i>일반공지 (${normalNotices.length}개)
        </h4>
        <div class="space-y-2">
    `;
    normalNotices.forEach((n, index) => {
      html += `
        <div class="notice-item bg-white rounded-xl shadow-sm p-3" data-id="${n.id}">
          <div class="flex items-center justify-between">
            <div class="notice-drag-handle text-gray-400 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing mr-2">
              <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded text-xs font-medium ${n.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}">
                  ${n.is_active ? '✓ TV에 표시중' : '숨김'}
                </span>
              </div>
              <p class="text-gray-800 whitespace-pre-wrap">${n.content}</p>
            </div>
            <div class="flex items-center gap-1 ml-4">
              <button onclick="toggleUrgent(${n.id}, 1)"
                class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 hover:bg-gray-200">
                긴급설정
              </button>
              <button onclick="toggleNotice(${n.id}, ${n.is_active ? 0 : 1})"
                class="px-2 py-1 rounded text-xs ${n.is_active ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}">
                ${n.is_active ? '숨기기' : '표시'}
              </button>
              <button onclick="editNotice(${n.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200">
                수정
              </button>
              <button onclick="deleteNotice(${n.id})" class="p-1.5 text-red-400 hover:text-red-600" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  container.innerHTML = html;
  
  // Sortable 초기화
  initNoticeSortable();
}

function initNoticeSortable() {
  const container = document.getElementById('notices-container');
  if (!container || container.children.length === 0) return;
  
  noticeSortableInstance = new Sortable(container, {
    animation: 150,
    handle: '.notice-drag-handle',
    onEnd: function(evt) {
      updateNoticeNumbers();
      saveNoticeOrder();
    }
  });
}

function updateNoticeNumbers() {
  const items = document.querySelectorAll('.notice-item');
  items.forEach((item, index) => {
    const num = item.querySelector('.notice-number');
    if (num) num.textContent = (index + 1).toString();
  });
}

async function saveNoticeOrder() {
  const items = document.querySelectorAll('.notice-item');
  const order = Array.from(items).map(item => parseInt(item.dataset.id));
  
  try {
    await fetch(API_BASE + '/notices/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });
    showToast('순서가 저장되었습니다.');
  } catch (e) {
    showToast('순서 저장 실패', 'error');
  }
}

function showCreateNoticeModal() {
  document.getElementById('notice-modal-title').textContent = '새 공지사항';
  document.getElementById('notice-id').value = '';
  document.getElementById('notice-content').value = '';
  document.getElementById('notice-urgent').checked = false;
  openModal('notice-modal');
}

function editNotice(id) {
  const notice = notices.find(n => n.id === id);
  if (!notice) return;
  
  document.getElementById('notice-modal-title').textContent = '공지사항 편집';
  document.getElementById('notice-id').value = notice.id;
  document.getElementById('notice-content').value = notice.content;
  document.getElementById('notice-urgent').checked = notice.is_urgent === 1;
  openModal('notice-modal');
}

async function toggleUrgent(id, isUrgent) {
  try {
    await fetch(API_BASE + '/notices/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_urgent: isUrgent })
    });
    loadNotices();
    showToast(isUrgent ? '긴급공지로 설정되었습니다.' : '긴급공지가 해제되었습니다.');
  } catch (e) {
    showToast('변경 실패', 'error');
  }
}

async function saveNotice(e) {
  e.preventDefault();
  
  const id = document.getElementById('notice-id').value;
  const data = {
    content: document.getElementById('notice-content').value,
    is_urgent: document.getElementById('notice-urgent').checked ? 1 : 0
  };
  
  try {
    const url = id ? API_BASE + '/notices/' + id : API_BASE + '/notices';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    
    if (result.success) {
      closeModal('notice-modal');
      loadNotices();
      showToast('저장되었습니다. TV에 곧 반영됩니다.');
    } else {
      showToast(result.error || '저장 실패', 'error');
    }
  } catch (e) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

async function toggleNotice(id, isActive) {
  try {
    await fetch(API_BASE + '/notices/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    loadNotices();
    showToast(isActive ? 'TV에 표시됩니다.' : 'TV에서 숨겨집니다.');
  } catch (e) {
    showToast('변경 실패', 'error');
  }
}

async function deleteNotice(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  
  try {
    await fetch(API_BASE + '/notices/' + id, { method: 'DELETE' });
    loadNotices();
    showToast('삭제되었습니다.');
  } catch (e) {
    showToast('삭제 실패', 'error');
  }
}

function editClinicName() {
  document.getElementById('edit-clinic-name').value = clinicName;
  openModal('clinic-name-modal');
}

async function saveClinicName(e) {
  e.preventDefault();
  const newName = document.getElementById('edit-clinic-name').value;
  
  try {
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic_name: newName })
    });
    
    clinicName = newName;
    document.getElementById('clinic-name-text').innerHTML = newName + ' <i class="fas fa-pencil-alt ml-2 text-sm text-blue-200"></i>';
    closeModal('clinic-name-modal');
    showToast('저장되었습니다.');
  } catch (e) {
    showToast('저장 실패', 'error');
  }
}

// zoom이 필요한 가이드 모달 목록 (이것들만 dashboard 숨김 + scroll 처리)
const GUIDE_MODALS = new Set([
  'tv-guide-modal', 'shortcut-guide-modal',
  'autorun-guide-modal', 'guide-url-modal', 'individual-install-modal'
]);

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const isGuideModal = GUIDE_MODALS.has(id);

  if (isGuideModal) {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.style.display = 'none';
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  // 모달을 body 직접 자식으로 이동
  if (el.parentElement !== document.body) {
    document.body.appendChild(el);
  }

  // 내부 wrapper paddingTop 제거
  const wrapperEl = el.querySelector('.absolute.inset-0.flex, .inset-0.flex');
  if (wrapperEl) { wrapperEl.style.paddingTop = ''; }

  // 아임웹 헤더 높이 계산
  const headerH = (!isGuideModal && iframePageTop > 0) ? Math.min(iframePageTop, 160) : 0;

  el.style.cssText = 'display:flex !important; position:fixed; top:' + headerH + 'px; left:0; right:0; bottom:0; width:100%; z-index:9999;';
  document.body.classList.add('modal-open');

  try {
    if (window.parent && window.parent !== window) {
      const needH = isGuideModal
        ? (() => {
            const box = wrapperEl ? wrapperEl.querySelector(':scope > div') : null;
            return Math.max(box ? box.scrollHeight + 80 : 650, 600);
          })()
        : Math.max(Math.round(window.screen.height * 0.92), 700);
      window.parent.postMessage({ type: 'setHeight', height: needH }, '*');
      window.parent.postMessage({ type: 'scrollToTop' }, '*');
    }
  } catch(e) {}

  if (isGuideModal) {
    try { if (typeof postParentHeight === 'function') postParentHeight(); } catch(e) {}
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    // cssText로 일괄 초기화
    el.style.cssText = 'display:none;';
    // 모달 박스 zoom/transform/paddingTop 초기화
    const wrapper = el.querySelector('.absolute.inset-0.flex, .inset-0.flex');
    const box = wrapper ? wrapper.querySelector(':scope > div') : null;
    if (wrapper) { wrapper.style.paddingTop = ''; }
    if (box) { box.style.zoom = ''; box.style.transform = ''; box.style.transformOrigin = ''; }
  }
  
  // 열린 모달이 없을 때 공통 처리
  const openModals = document.querySelectorAll('[style*="position: fixed"][style*="display: flex"]');
  if (openModals.length === 0) {
    document.body.classList.remove('modal-open');

    // 가이드 모달이 닫힐 때만 dashboard 복원 + iframe 높이 원상 복구
    if (GUIDE_MODALS.has(id)) {
      const dashboard = document.getElementById('dashboard');
      if (dashboard) dashboard.style.display = '';
      try {
        if (window.parent && window.parent !== window) {
          modalHeightLocked = false;
          setTimeout(() => { if (typeof postParentHeight === 'function') postParentHeight(); }, 100);
        }
      } catch(e) {}
    }
  }
  if (id === 'preview-modal') {
    document.getElementById('preview-iframe').src = '';
  }
  if (id === 'edit-playlist-modal') {
    currentPlaylist = null;
    if (masterItemsRefreshTimer) {
      clearInterval(masterItemsRefreshTimer);
      masterItemsRefreshTimer = null;
    }
    loadPlaylists();
  }
  // 스크립트/설치방법 모달 닫힐 때 체크박스 전체 해제
  if (id === 'script-download-modal' || id === 'script-type-modal') {
    document.querySelectorAll('.chair-checkbox').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('select-all-chairs');
    if (selectAll) selectAll.checked = false;
  }
}

function copyToClipboard(text) {
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    showToast('클립보드에 복사되었습니다.');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('클립보드에 복사되었습니다.');
    }).catch(fallback);
  } else {
    fallback();
  }
}

function showToast(message, type = 'success', duration = 1200, anchorEl) {
  const toast = document.getElementById('admin-toast');
  const toastMessage = document.getElementById('admin-toast-message');
  
  toastMessage.innerHTML = message.replace(/\n/g, '<br>');
  toast.querySelector('div').className = `${type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-gray-800'} text-white px-6 py-3 rounded-lg shadow-lg toast`;

  if (anchorEl) {
    var rect = anchorEl.getBoundingClientRect();
    // 버튼 바로 위에 표시 (top 기준)
    var toastTop = Math.max(4, rect.top - 52);
    toast.style.cssText = 'display:block;position:fixed;top:' + toastTop + 'px;left:50%;bottom:auto;right:auto;transform:translateX(-50%);z-index:999999;';
  } else {
    var topPx = (iframePageTop > 0 && iframePageTop < 300) ? iframePageTop + 16 : 80;
    toast.style.cssText = 'display:block;position:fixed;top:' + topPx + 'px;left:50%;bottom:auto;right:auto;transform:translateX(-50%);z-index:999999;';
  }

  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() {
    toast.style.display = 'none';
  }, duration);
}

// 임베드 높이 자동 전송
let lastSentHeight = 0;
function postParentHeight() {
  try {
    if (window.parent && window.parent !== window) {
      const appEl = document.getElementById('app');
      const dashboardEl = document.getElementById('dashboard');
      const targetEl = (dashboardEl && dashboardEl.style.display !== 'none') ? dashboardEl : appEl;
      const rect = targetEl ? targetEl.getBoundingClientRect() : document.body.getBoundingClientRect();
      const height = Math.ceil(rect.top + rect.height + window.scrollY);
      if (Math.abs(height - lastSentHeight) > 5) {
        lastSentHeight = height;
        window.parent.postMessage({ type: 'setHeight', height }, '*');
      }
    }
  } catch (e) {}
}

function setupAutoHeight() {
  postParentHeight();
  setTimeout(postParentHeight, 200);
  setTimeout(postParentHeight, 800);
  window.addEventListener('resize', postParentHeight);
  try {
    const observer = new MutationObserver(() => postParentHeight());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  } catch (e) {}
}

init();
