// TV Player - auto-extracted from src/index.tsx
(function() {
const IS_PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';
let playlist = null;
let notices = [];
let currentIndex = 0;
let isYTReady = false;
let transitionEffect = 'fade';
let transitionDuration = 500;

// 이 TV의 실제 admin_code와 email (API에서 수신 - 로그인 계정과 독립적으로 저장)
let tvAdminCode = null;
let tvAdminEmail = null;

// ★ 광고 스케줄러 (ratio:auto + every:N 조합)
let _adScheduler = {
  broadcastAds: [],        // 배포 광고 아이템 목록 (repeat_every_n > 0인 것만)
  regularItems: [],        // 일반 아이템 (광고 제외)
  loopCount: 0,            // 플레이리스트 전체 루프 횟수
  playCountSinceAd: 0,     // 마지막 광고 이후 재생된 일반 영상 수
  adRoundRobin: 0,         // 라운드 로빈 광고 인덱스
  isFirstLoop: true,       // 첫 바퀴 여부
  everyN: 0                // every:N 값 (0이면 비활성)
};

// 로딩 화면 관리
let _loadingScreenHidden = false;
function hideLoadingScreen() {
  if (_loadingScreenHidden) return;
  _loadingScreenHidden = true;
  const ls = document.getElementById('loading-screen');
  if (ls) {
    // fade-out 후 hidden 처리 (썸네일 → 영상 자연스러운 전환)
    ls.classList.add('fade-out');
    setTimeout(() => ls.classList.add('hidden'), 500);
  }
}

// 안정성 강화 변수
let isTransitioning = false; // 중복 전환 방지
let wakeLock = null; // 화면 꺼짐 방지
let lastPlaybackTime = Date.now(); // 워치독용
let isLoadingData = false;
let pendingLoad = false;
let playbackWatchdog = null;

// 미디어 아이템별 관리
let players = {};  // index -> player
let itemsReady = {};  // index -> boolean
let allItemsLoaded = false;
let currentTimer = null;
let dataVersion = '';

// 전체화면 상태 추적 (DOM 조작 중에도 유지) - TV는 항상 전체화면
let shouldBeFullscreen = true;

// 미리보기 모드일 때 스타일 조정
if (IS_PREVIEW) {
  document.body.classList.add('preview-mode');
}

// 공통 공지 설정
let noticeSettings = { font_size: 32, letter_spacing: 0, text_color: '#ffffff', bg_color: '#1a1a2e', bg_opacity: 100, scroll_speed: 50, position: 'bottom' };

// 로고 설정
let logoSettings = { url: '', size: 150, opacity: 90, position: 'right' };

// 자막 관련
let subtitles = {};  // vimeoId -> parsed subtitles
let currentSubtitleTimer = null;

// 자막 스타일 설정
let subtitleSettings = { font_size: 28, bg_opacity: 80, text_color: '#ffffff', bg_color: '#000000', position: 'bottom', bottom_offset: 80 };

// 재생 시간 설정
let scheduleSettings = { enabled: 0, start: '', end: '' };
let scheduleCheckInterval = null;
let isScheduleActive = true;

// Wake Lock 활성화 (화면 꺼짐 방지)
async function enableWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock active');
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
        // 다시 활성화 시도
        setTimeout(enableWakeLock, 1000);
      });
    }
  } catch (err) {
    console.error('Wake Lock failed:', err);
  }
}

// [핵심] 백그라운드 재생 유지 (Page Visibility API 무력화)
Object.defineProperty(document, 'hidden', { get: () => false });
Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });

// [핵심] 브라우저 스로틀링 방지용 무음 오디오
let audioCtx;
function startKeepAlive() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 1; 
    gain.gain.value = 0.001; 
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    console.log('🔊 Background keep-alive active');
  } catch(e) {}
}
document.addEventListener('click', startKeepAlive);
document.addEventListener('touchstart', startKeepAlive);

// ★★ Vimeo iframe autoplay 정책 대응: iframe 생성 직후 allow 속성 패치
// Chrome은 iframe의 allow="autoplay" 속성이 iframe 생성 시점에 있어야 autoplay 허용
// Vimeo SDK가 iframe을 동적 생성하므로, 생성 직후 즉시 패치해야 함
function patchVimeoIframe(containerId) {
  try {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;
    const iframe = container.tagName === 'IFRAME' ? container : container.querySelector('iframe');
    if (iframe) {
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
      iframe.setAttribute('allowfullscreen', '');
      // ★ BUG-1 FIX: src 변경 제거 - iframe src를 바꾸면 브라우저가 iframe을 리로드하여
      // Vimeo SDK 초기화가 취소되고 PlayInterrupted 에러 발생
      // Vimeo SDK가 muted:true 옵션으로 이미 muted=1을 URL에 포함시킴
    }
  } catch(e) { console.log('[patchVimeoIframe] error:', e); }
}

// MutationObserver로 Vimeo iframe 생성 감지 → 즉시 allow 속성 패치
const _vimeoIframeObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.tagName === 'IFRAME' && (node.src || '').includes('vimeo')) {
        node.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
        node.setAttribute('allowfullscreen', '');
      }
      // div 안에 iframe이 추가된 경우
      if (node.querySelectorAll) {
        node.querySelectorAll('iframe').forEach(iframe => {
          if ((iframe.src || '').includes('vimeo')) {
            iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
            iframe.setAttribute('allowfullscreen', '');
          }
        });
      }
    }
  }
});
// media-container가 있으면 감시 시작
setTimeout(() => {
  const mc = document.getElementById('media-container');
  if (mc) _vimeoIframeObserver.observe(mc, { childList: true, subtree: true });
}, 0);

// 워치독: 단순 감시 모드
function initWatchdog() {
  setInterval(() => {
    const now = Date.now();
    if (now - lastPlaybackTime > 300000 && !isScheduleActive) {
      console.log('Watchdog: Stuck > 5min, reloading');
      window.location.reload();
    }
  }, 10000);
}

// YouTube/Vimeo API 동적 로드
let isVimeoReady = false;

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      isYTReady = true;
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = function() {
      isYTReady = true;
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
}

function loadVimeoAPI() {
  return new Promise((resolve) => {
    if (window.Vimeo && window.Vimeo.Player) {
      isVimeoReady = true;
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://player.vimeo.com/api/player.js';
    tag.onload = function() {
      isVimeoReady = true;
      resolve();
    };
    document.head.appendChild(tag);
  });
}

function onYouTubeIframeAPIReady() {
  isYTReady = true;
}

// 재생 시간 체크
function checkSchedule() {
  // 재생시간 설정이 비활성화되어 있거나 시간 설정이 없으면 항상 재생
  if (!scheduleSettings.enabled || (!scheduleSettings.start && !scheduleSettings.end)) {
    if (!isScheduleActive) {
      isScheduleActive = true;
      hideScheduleScreen();
    }
    return true;
  }
  
  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  
  let inSchedule = true;
  
  if (scheduleSettings.start && scheduleSettings.end) {
    // 시작/종료 모두 설정된 경우
    if (scheduleSettings.start <= scheduleSettings.end) {
      // 같은 날 (예: 09:00 ~ 18:00)
      inSchedule = currentTime >= scheduleSettings.start && currentTime <= scheduleSettings.end;
    } else {
      // 자정 넘김 (예: 22:00 ~ 06:00)
      inSchedule = currentTime >= scheduleSettings.start || currentTime <= scheduleSettings.end;
    }
  } else if (scheduleSettings.start) {
    // 시작 시간만 설정
    inSchedule = currentTime >= scheduleSettings.start;
  } else if (scheduleSettings.end) {
    // 종료 시간만 설정
    inSchedule = currentTime <= scheduleSettings.end;
  }
  
  if (inSchedule && !isScheduleActive) {
    isScheduleActive = true;
    hideScheduleScreen();
    // 재생 재시작
    if (playlist && playlist.items && playlist.items.length > 0) {
      startPlayback();
    }
  } else if (!inSchedule && isScheduleActive) {
    isScheduleActive = false;
    showScheduleScreen();
    // 모든 재생 중지
    stopAllPlayback();
  }
  
  // 시간 외 화면 시계 업데이트
  if (!inSchedule) {
    updateScheduleClock();
  }
  
  return inSchedule;
}

function showScheduleScreen() {
  document.getElementById('schedule-screen').style.display = 'flex';
  const info = document.getElementById('schedule-info');
  if (scheduleSettings.start && scheduleSettings.end) {
    info.textContent = '재생 시간: ' + scheduleSettings.start + ' ~ ' + scheduleSettings.end;
  } else if (scheduleSettings.start) {
    info.textContent = '재생 시작 시간: ' + scheduleSettings.start;
  } else if (scheduleSettings.end) {
    info.textContent = '재생 종료 시간: ' + scheduleSettings.end;
  }
}

function hideScheduleScreen() {
  document.getElementById('schedule-screen').style.display = 'none';
}

function updateScheduleClock() {
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  document.getElementById('current-clock').textContent = timeStr;
}

function stopAllPlayback() {
  // 모든 플레이어 정지
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  Object.keys(players).forEach(idx => {
    const p = players[idx];
    if (p) {
      try {
        if (p.pause) p.pause();
        else if (p.pauseVideo) p.pauseVideo();
      } catch(e) {}
    }
  });
}

// 로고 표시
function showLogo() {
  if (logoSettings.url) {
    const overlay = document.getElementById('logo-overlay');
    const img = document.getElementById('logo-img');
    img.src = logoSettings.url;
    img.style.width = logoSettings.size + 'px';
    img.style.opacity = (logoSettings.opacity / 100).toString();
    // 위치 적용 (좌/우)
    if (logoSettings.position === 'left') {
      overlay.style.left = '20px';
      overlay.style.right = 'auto';
    } else {
      overlay.style.right = '20px';
      overlay.style.left = 'auto';
    }
    overlay.style.display = 'block';
  } else {
    document.getElementById('logo-overlay').style.display = 'none';
  }
}

let currentTempVideo = null; // 현재 클라이언트의 임시 영상 상태
let tempVideoLoopCount = 0; // 임시 영상 반복 횟수 추적
let originalPlaylist = null; // 원본 플레이리스트 저장
let _lastClearedTempUrl = null; // ★★ 마지막으로 클리어한 임시영상 URL (재등장 방지)
let _lastClearedTempTime = 0; // ★★ 클리어한 시각 (일정 시간 내 같은 URL 무시)

// 서버에 임시 영상 해제 요청 (영상 끝나면 자동 복귀용)
// ★★ 재시도 로직 추가: 실패 시 DB에 이전 영상이 남아 다시 재생되는 문제 방지
// ★★ 경쟁 조건 방지: 클리어할 URL을 명시해서 다른 영상이 새로 설정됐으면 건드리지 않음
let _clearTempRetryCount = 0;
let _clearTempTargetUrl = null; // 클리어 대상 URL
const MAX_CLEAR_RETRIES = 5;
async function clearTempVideoOnServer(targetUrl) {
  _clearTempTargetUrl = targetUrl || _clearTempTargetUrl;
  console.log('=== clearTempVideoOnServer (retry:', _clearTempRetryCount, ', url:', _clearTempTargetUrl, ') ===');
  
  try {
    const res = await fetch('/api/tv/' + SHORT_CODE + '/clear-temp', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: _clearTempTargetUrl })
    });
    if (res.ok) {
      console.log('Temp video cleared on server successfully');
      _clearTempRetryCount = 0;
      _clearTempTargetUrl = null;
    } else {
      throw new Error('HTTP_' + res.status);
    }
  } catch (e) {
    console.log('Clear temp error:', e);
    _clearTempRetryCount++;
    if (_clearTempRetryCount <= MAX_CLEAR_RETRIES) {
      console.log('[clearTemp] Retry', _clearTempRetryCount, '/', MAX_CLEAR_RETRIES, 'in 2s');
      setTimeout(() => clearTempVideoOnServer(), 2000);
    } else {
      console.log('[clearTemp] All retries failed, will try on next poll');
      _clearTempRetryCount = 0;
      _clearTempTargetUrl = null;
    }
  }
}

// 안전한 재생 재시작 (전체화면 유지, DOM 파괴 최소화)
function safeRestartPlayback() {
  // 빈 플레이리스트 처리
  if (!playlist || !playlist.items || playlist.items.length === 0) {
    console.log('[safeRestartPlayback] Playlist is empty, showing waiting screen');
    showEmptyPlaylistScreen();
    return;
  }
  
  console.log('safeRestartPlayback called, items:', playlist.items.length);
  
  // 전체화면 상태 저장
  const wasFullscreen = !!document.fullscreenElement;
  
  // 타이머 정리
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  clearVimeoTimers();
  hideSubtitle(); // 자막 타이머 및 표시 정리
  vimeoSessionId++;
  cachedVimeoDuration = 0; // ★★ duration 캐시 초기화 (새 영상에 이전 값 사용 방지)
  _watchdogLastVimeoTime = 0; // ★ BUG-10 FIX: 워치독 시간 리셋
  _watchdogNoProgressCount = 0; // ★ BUG-10 FIX: 워치독 카운터 리셋
  _watchdogRestartCount = 0; // ★ BUG-10 FIX: 재시작 카운터 리셋
  
  // ★ 전체화면 유지: iframe 파괴 전 전환 플래그 설정
  markMediaTransitionStart();
  
  // ★★ 시나리오 6 수정: 플레이어를 destroy 한 후 참조 초기화
  // (이전: pause만 하고 참조 초기화 → destroy 누락으로 이전 이벤트가 계속 발생)
  const oldPlayers = Object.assign({}, players);
  const oldPreloaded = Object.assign({}, preloadedPlayers);
  
  // 참조 먼저 초기화 (이후 이벤트 콜백에서 players[idx]를 찾지 못하게)
  players = {};
  itemsReady = {};
  preloadedPlayers = {};
  
  // 이전 플레이어 파괴 (참조 끊긴 후이므로 이벤트가 발생해도 영향 없음)
  Object.values(oldPlayers).forEach(p => {
    if (p) {
      try { if (p.destroy) p.destroy(); else if (p.pause) p.pause(); } catch(e) {}
    }
  });
  Object.values(oldPreloaded).forEach(p => {
    if (p) {
      try { p.destroy(); } catch(e) {}
    }
  });
  
  // 인덱스 범위 체크
  if (currentIndex >= playlist.items.length) {
    currentIndex = 0;
  }
  
  // 새 미디어 초기화 (initializeAllMedia가 기존 DOM을 안전하게 정리)
  initializeAllMedia();
  startPlaybackWatchdog();
  
  // 전체화면은 CSS 의사 전체화면(100vw x 100vh)으로 처리
  // requestFullscreen 반복 호출 제거 - Vimeo iframe과 충돌하여 영상 끊김/멈춤 유발 (특히 노트북)
}

let _consecutive404Count = 0; // 연속 404 횟수
let _initialLoadRetries = 0; // 초기 로드 재시도 횟수
const MAX_INITIAL_RETRIES = 10; // 초기 로드 최대 재시도 (30초)

async function loadData(isInitial = false) {
  if (isLoadingData) {
    pendingLoad = true;
    return;
  }
  isLoadingData = true;
  try {
    const res = await fetch('/api/tv/' + SHORT_CODE + '?t=' + Date.now() + '&cid=' + CLIENT_ID);
    if (!res.ok) {
      const err = new Error('HTTP_' + res.status);
      err.httpStatus = res.status;
      throw err;
    }
    
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.log('[loadData] JSON parse error, skipping this poll');
      throw new Error('JSON_PARSE_ERROR');
    }
    const serverTempVideo = data.tempVideo;
    
    // ★★ 방금 클리어한 임시영상이 서버에 아직 남아있으면 무시 (clear 반영 전 폴링 방어)
    // 30초 이내에 클리어한 같은 URL이면 서버 응답을 무시
    let effectiveTempVideo = serverTempVideo;
    if (serverTempVideo && _lastClearedTempUrl && serverTempVideo.url === _lastClearedTempUrl) {
      const sinceClear = Date.now() - _lastClearedTempTime;
      if (sinceClear < 30000) {
        console.log('[loadData] Ignoring stale temp video (cleared', Math.round(sinceClear/1000), 's ago):', serverTempVideo.url);
        effectiveTempVideo = null;
      } else {
        // 30초 지났으면 관리자가 의도적으로 같은 영상을 다시 전송한 것으로 간주
        _lastClearedTempUrl = null;
        _lastClearedTempTime = 0;
      }
    }
    // 서버에서 temp가 null이면 클리어 기록도 리셋 (정상 clear 확인됨)
    if (!serverTempVideo) {
      _lastClearedTempUrl = null;
      _lastClearedTempTime = 0;
    }
    
    // 디버그: TV API 응답 로깅
    if (data._debug) {
      console.log('[TV DEBUG]', JSON.stringify(data._debug));
    }
    if (isInitial) {
      console.log('[TV Initial] items:', (data.playlist?.items || []).map(i => i.id + ':' + (i.title || '?')));
      // URL에 ?debug=1이면 화면에 디버그 오버레이 표시
      if (new URLSearchParams(window.location.search).get('debug') === '1' && data._debug) {
        var dbgDiv = document.createElement('div');
        dbgDiv.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;padding:12px;border-radius:8px;font-size:11px;max-width:400px;max-height:50vh;overflow:auto;font-family:monospace';
        dbgDiv.innerHTML = '<b>TV Debug</b><pre style="margin:4px 0;white-space:pre-wrap">' + JSON.stringify(data._debug, null, 1) + '</pre>'
          + '<b>Items (' + (data.playlist?.items?.length||0) + ')</b><pre style="margin:4px 0">' 
          + (data.playlist?.items || []).map(function(i){return i.id+': '+i.title}).join('\n') + '</pre>';
        document.body.appendChild(dbgDiv);
        setTimeout(function(){ dbgDiv.remove(); }, 30000);
      }
    }
    
    // 이전에 에러 화면이 표시되었다면 숨기고 정상 복구
    const errorScreen = document.getElementById('error-screen');
    const wasErrorVisible = errorScreen && errorScreen.style.display !== 'none';
    if (wasErrorVisible) {
      errorScreen.style.display = 'none';
      console.log('[loadData] Recovered from error screen');
      // 에러 복구 시: 현재 재생 중인 플레이어가 있으면 재시작하지 않음 (끊김 방지)
      // 재생 중이 아닌 경우에만 재시작
      if (!isInitial) {
        const currentItem = playlist?.items?.[currentIndex];
        const currentPlayer = players?.[currentIndex];
        let isPlaying = false;
        if (currentItem?.item_type === 'vimeo' && currentPlayer && typeof currentPlayer.getPaused === 'function') {
          try {
            const paused = await currentPlayer.getPaused();
            isPlaying = !paused;
          } catch(e) {}
        } else if (currentItem?.item_type === 'youtube' && currentPlayer && typeof currentPlayer.getPlayerState === 'function') {
          try {
            isPlaying = currentPlayer.getPlayerState() === 1;
          } catch(e) {}
        } else if (currentItem?.item_type === 'image') {
          isPlaying = !!currentTimer;
        }
        if (!isPlaying) {
          console.log('[loadData] Not playing, restarting playback');
          try { safeRestartPlayback(); } catch(_) {}
        } else {
          console.log('[loadData] Already playing, skipping restart (preventing stutter)');
        }
      }
    }
    _consecutive404Count = 0;
    _initialLoadRetries = 0; // 성공하면 초기 재시도 카운터도 리셋
    
    // 이 TV의 실제 admin_code/email을 저장 (관리자 페이지 이동 시 올바른 계정으로 연결)
    if (data.adminCode) {
      tvAdminCode = data.adminCode;
      tvAdminEmail = data.adminEmail || null;
    }
    
    // 원본 플레이리스트 항상 저장 (structuredClone 사용 - JSON.stringify보다 빠름)
    originalPlaylist = typeof structuredClone === 'function' 
      ? structuredClone(data.playlist) 
      : JSON.parse(JSON.stringify(data.playlist));
    
    // 임시 영상 상태 변경 감지 (effectiveTempVideo 사용 - 클리어 방어 적용됨)
    const hadTempVideo = currentTempVideo !== null;
    const hasTempVideo = effectiveTempVideo !== null;
    const tempUrlChanged = (currentTempVideo?.url || null) !== (effectiveTempVideo?.url || null);
    
    console.log('[loadData] hadTemp:', hadTempVideo, 'hasTemp:', hasTempVideo, 'urlChanged:', tempUrlChanged,
      'serverUrl:', serverTempVideo?.url || null, 'effectiveUrl:', effectiveTempVideo?.url || null);
    
    // 임시 영상 상태가 변경됨
    if (tempUrlChanged) {
      if (hasTempVideo && !hadTempVideo) {
        // 새 임시 영상 시작
        console.log('>>> 임시 영상 시작:', effectiveTempVideo.title);
        currentTempVideo = effectiveTempVideo;
        tempVideoLoopCount = 0;
        
        showSyncIndicator();
        playlist.items = [{
          id: 'temp-video',
          item_type: effectiveTempVideo.type,
          url: effectiveTempVideo.url,
          title: effectiveTempVideo.title,
          duration: 0,
          sort_order: 0
        }];
        currentIndex = 0;
        safeRestartPlayback();
        return;
        
      } else if (!hasTempVideo && hadTempVideo) {
        // 임시 영상 해제 - 기본 플레이리스트로 복귀
        console.log('>>> 기본 플레이리스트로 복귀');
        currentTempVideo = null;
        
        showSyncIndicator();
        playlist = originalPlaylist;
        currentIndex = 0;
        safeRestartPlayback();
        return;
        
      } else if (hasTempVideo && hadTempVideo) {
        // 임시 영상이 다른 영상으로 교체됨
        console.log('>>> 임시 영상 교체:', effectiveTempVideo.title);
        currentTempVideo = effectiveTempVideo;
        tempVideoLoopCount = 0;
        
        showSyncIndicator();
        playlist.items = [{
          id: 'temp-video',
          item_type: effectiveTempVideo.type,
          url: effectiveTempVideo.url,
          title: effectiveTempVideo.title,
          duration: 0,
          sort_order: 0
        }];
        currentIndex = 0;
        safeRestartPlayback();
        return;
      }
    }
    
    // 초기 로드 시 임시 영상 처리
    if (isInitial) {
      currentTempVideo = effectiveTempVideo;
      if (effectiveTempVideo) {
        console.log('[Initial] 임시 영상 있음:', effectiveTempVideo.title);
        playlist = {
          ...data.playlist,
          items: [{
            id: 'temp-video',
            item_type: effectiveTempVideo.type,
            url: effectiveTempVideo.url,
            title: effectiveTempVideo.title,
            duration: 0,
            sort_order: 0
          }]
        };
      } else {
        playlist = data.playlist;
      }
      // ★ 광고 스케줄러 초기화
      _initAdScheduler(playlist);
    }
    
    // 현재 임시 영상 재생 중이면 playlist 덮어쓰기 방지
    if (currentTempVideo) {
      // 임시 영상 상태 유지, playlist.items는 건드리지 않음
      // 공지/로고 등 다른 설정만 업데이트
    } else if (!isInitial) {
      // 일반 플레이리스트 업데이트
      const newItems = data.playlist.items || [];
      const oldItems = playlist?.items || [];
      const newItemCount = newItems.length;
      const oldItemCount = oldItems.length;
      
      // 아이템 개수 또는 내용이 변경되었는지 확인 (가벼운 비교)
      const itemsChanged = newItemCount !== oldItemCount || 
        newItems.some((item, i) => item.id !== oldItems[i]?.id);
      
      if (itemsChanged) {
        console.log('[loadData] Playlist changed, items:', oldItemCount, '->', newItemCount);
        showSyncIndicator();
        
        // 현재 재생 중인 아이템의 URL 저장
        const currentItem = oldItems[currentIndex];
        const currentUrl = currentItem?.url;
        
        // 새 플레이리스트로 교체
        playlist = data.playlist;
        _initAdScheduler(playlist);
        
        // 현재 재생 중이던 아이템이 새 플레이리스트에 있는지 확인
        if (currentUrl && newItemCount > 0) {
          const newIndex = newItems.findIndex(item => item.url === currentUrl);
          if (newIndex >= 0) {
            currentIndex = newIndex;
            // ★ 현재 재생 아이템이 그대로 있으면 재시작하지 않음 (끊김 방지)
            console.log('[loadData] Same item found at new index:', newIndex, '- continuing playback (no restart)');
          } else {
            // 현재 아이템이 삭제됨 - 재시작 필요
            currentIndex = Math.min(currentIndex, newItemCount - 1);
            if (currentIndex < 0) currentIndex = 0;
            console.log('[loadData] Current item deleted, restarting at index:', currentIndex);
            safeRestartPlayback();
          }
        } else if (newItemCount > 0) {
          console.log('[loadData] Playlist updated, restarting from start');
          currentIndex = 0;
          safeRestartPlayback();
        } else {
          // 모든 아이템 삭제됨
          console.log('[loadData] All items removed');
        }
      } else {
        // 아이템 목록은 같음 → 메타 설정만 업데이트 (items 참조 유지, 재생 중단 없음)
        const currentItems = playlist.items;
        playlist = data.playlist;
        playlist.items = currentItems; // items 참조 유지 (Vimeo 플레이어 안정성)
      }
    }
    
    // 공지/설정 항상 업데이트 - 단, 변경된 경우에만 DOM 조작
    const newNotices = data.notices || [];
    const newNoticeSettings = { ...noticeSettings, ...(data.noticeSettings || {}) };
    const parsedLetterSpacing = parseFloat((newNoticeSettings.letter_spacing ?? 0).toString());
    newNoticeSettings.letter_spacing = Number.isFinite(parsedLetterSpacing) ? parsedLetterSpacing : 0;
    const newLogoSettings = data.logoSettings || logoSettings;
    const newScheduleSettings = data.scheduleSettings || scheduleSettings;
    const newSubtitleSettings = data.subtitleSettings || subtitleSettings;
    const newTransitionEffect = playlist.transition_effect || 'fade';
    const newTransitionDuration = playlist.transition_duration || 500;
    
    // 변경 감지 후 업데이트 (JSON.stringify 대신 가벼운 키 비교 - 메인스레드 부하 감소)
    const noticesChanged = newNotices.length !== notices.length || 
      newNotices.some((n, i) => n.id !== notices[i]?.id || n.content !== notices[i]?.content || n.is_urgent !== notices[i]?.is_urgent);
    const noticeSettingsChanged = newNoticeSettings.font_size !== noticeSettings.font_size ||
      newNoticeSettings.enabled !== noticeSettings.enabled ||
      newNoticeSettings.bg_color !== noticeSettings.bg_color ||
      newNoticeSettings.text_color !== noticeSettings.text_color ||
      newNoticeSettings.scroll_speed !== noticeSettings.scroll_speed ||
      newNoticeSettings.position !== noticeSettings.position ||
      newNoticeSettings.letter_spacing !== noticeSettings.letter_spacing ||
      newNoticeSettings.bg_opacity !== noticeSettings.bg_opacity;
    const logoChanged = newLogoSettings.url !== logoSettings.url || 
      newLogoSettings.size !== logoSettings.size || 
      newLogoSettings.opacity !== logoSettings.opacity ||
      newLogoSettings.position !== logoSettings.position;
    const subtitleChanged = newSubtitleSettings.font_size !== subtitleSettings.font_size ||
      newSubtitleSettings.bg_opacity !== subtitleSettings.bg_opacity ||
      newSubtitleSettings.text_color !== subtitleSettings.text_color ||
      newSubtitleSettings.bg_color !== subtitleSettings.bg_color ||
      newSubtitleSettings.position !== subtitleSettings.position ||
      newSubtitleSettings.bottom_offset !== subtitleSettings.bottom_offset;
    
    notices = newNotices;
    noticeSettings = newNoticeSettings;
    logoSettings = newLogoSettings;
    scheduleSettings = newScheduleSettings;
    subtitleSettings = newSubtitleSettings;
    transitionEffect = newTransitionEffect;
    transitionDuration = newTransitionDuration;
    
    document.documentElement.style.setProperty('--transition-duration', transitionDuration + 'ms');
    
    // 자막 스타일 변경 시에만 적용 (매번 호출하면 DOM 리렌더링 발생)
    if (subtitleChanged) {
      applySubtitleSettings();
    }
    
    // 빈 플레이리스트 처리: 오류 대신 대기 화면 표시
    if (!playlist.items || playlist.items.length === 0) {
      console.log('[loadData] Playlist is empty, showing waiting screen');
      showEmptyPlaylistScreen();
      
      // 초기 로드 시 로딩 화면 숨기기
      if (isInitial) {
        hideLoadingScreen();
      }
      
      // 공지와 로고는 계속 표시
      if (noticeSettings.enabled !== 0) {
        showNotices();
      }
      showLogo();
      return; // 재생 시작하지 않음
    }
    
    // 플레이리스트에 아이템이 있으면 대기 화면 숨기기
    hideEmptyPlaylistScreen();
    
    // 공지 표시 (변경 시에만 - 불필요한 CSS 애니메이션 리셋 방지)
    if (noticesChanged || noticeSettingsChanged) {
      if (noticeSettings.enabled !== 0) {
        showNotices();
      } else {
        document.getElementById('notice-bar').style.display = 'none';
      }
    }
    
    // 로고 표시 (변경 시에만)
    if (logoChanged) {
      showLogo();
    }
    
    if (isInitial) {
      // ★★ 로딩 화면은 첫 미디어 재생 시작 시 숨김 (빈 검은 화면 방지)
      // 안전장치: 3초 후 강제 숨김 (썸네일이 있으므로 빨리 전환)
      setTimeout(hideLoadingScreen, 3000);
      
      // ★★ API는 이미 페이지 시작 시 프리로드됨 (loadVimeoAPI/loadYouTubeAPI 미리 호출)
      const hasYouTube = playlist.items.some(i => i.item_type === 'youtube');
      const hasVimeo = playlist.items.some(i => i.item_type === 'vimeo');
      
      const loadPromises = [];
      if (hasYouTube) loadPromises.push(loadYouTubeAPI());
      if (hasVimeo) loadPromises.push(loadVimeoAPI());
      
      if (loadPromises.length > 0) {
        // API가 이미 프리로드 중이므로 최대 2초만 대기
        await Promise.race([
          Promise.all(loadPromises),
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);
      }
      
      // 재생 시간 체크 시작
      if (scheduleCheckInterval) clearInterval(scheduleCheckInterval);
      scheduleCheckInterval = setInterval(checkSchedule, 30000); // 30초마다 체크
      
      // 초기 재생 시간 체크
      if (checkSchedule()) {
        startPlayback();
      }
    }
    
  } catch (e) {
    // ===== 핵심 원칙: 이미 재생 중인 영상은 절대 중단하지 않음 =====
    console.log('[loadData] Error:', e.message || e, 'httpStatus:', e.httpStatus || 'N/A');
    
    if (isInitial) {
      // 초기 로드 실패: 자동 재시도 (최대 MAX_INITIAL_RETRIES회)
      _initialLoadRetries++;
      console.log('[loadData] Initial load failed, retry', _initialLoadRetries, '/', MAX_INITIAL_RETRIES);
      
      if (_initialLoadRetries < MAX_INITIAL_RETRIES) {
        // 3초 후 자동 재시도 (폴링과 동일 주기)
        setTimeout(() => loadData(true), 3000);
      } else {
        // 재시도 횟수 초과: 에러 화면 표시 (초기 로드에서만)
        hideLoadingScreen();
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('error-message').textContent = (e.httpStatus === 404)
          ? '채널을 찾을 수 없습니다. 주소를 확인해주세요.'
          : '서버에 연결할 수 없습니다. 페이지를 새로고침해주세요.';
        // 그래도 폴링은 계속 (복구 대비)
      }
    }
    // 폴링 중 에러: 아무것도 하지 않음 - 현재 재생 유지, 다음 폴링에서 재시도
    // 영상 중단, 에러 화면 표시 등 절대 금지
  } finally {
    isLoadingData = false;
    if (pendingLoad) {
      pendingLoad = false;
      setTimeout(() => loadData(false), 0);
    }
  }
}

function showSyncIndicator() {
  const indicator = document.getElementById('sync-indicator');
  indicator.classList.add('show');
  setTimeout(() => indicator.classList.remove('show'), 2000);
}

// 대기 화면 표시 상태 추적
let isEmptyScreenShown = false;

// 빈 플레이리스트 대기 화면 표시
function showEmptyPlaylistScreen() {
  // 이미 대기 화면이 표시된 상태면 중복 처리 안 함
  if (isEmptyScreenShown) {
    return;
  }
  
  isEmptyScreenShown = true;
  
  const emptyScreen = document.getElementById('empty-playlist-screen');
  const mediaContainer = document.getElementById('media-container');
  
  if (emptyScreen) {
    emptyScreen.style.display = 'flex';
  }
  if (mediaContainer) {
    mediaContainer.style.display = 'none';
  }
  
  // 재생 중인 것 모두 정리 (한 번만)
  stopAllPlayback();
}

// 빈 플레이리스트 대기 화면 숨기기
function hideEmptyPlaylistScreen() {
  isEmptyScreenShown = false;
  
  const emptyScreen = document.getElementById('empty-playlist-screen');
  const mediaContainer = document.getElementById('media-container');
  
  if (emptyScreen) {
    emptyScreen.style.display = 'none';
  }
  if (mediaContainer) {
    mediaContainer.style.display = 'block';
  }
}

// 모든 재생 정지 (타이머, 플레이어 정리)
function stopAllPlayback() {
  console.log('[stopAllPlayback] Stopping all playback');
  
  // 타이머 정리
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  clearVimeoTimers();
  
  // 모든 플레이어 정리
  Object.values(players).forEach(player => {
    if (player) {
      try { player.destroy(); } catch(e) {}
    }
  });
  players = {};
  itemsReady = {};
  preloadedPlayers = {};
  
  // 미디어 컨테이너 비우기
  const container = document.getElementById('media-container');
  if (container) {
    container.innerHTML = '';
  }
}

// 여러 공지를 연달아 보여주기 (무한 연속 스크롤)
let _lastNoticeSignature = '';
function showNotices() {
  const bar = document.getElementById('notice-bar');
  const wrapper = document.getElementById('notice-text-wrapper');
  const text1 = document.getElementById('notice-text-1');
  const text2 = document.getElementById('notice-text-2');
  
  // 활성화된 공지가 없으면 숨김
  if (!notices || notices.length === 0) {
    bar.style.display = 'none';
    _lastNoticeSignature = '';
    return;
  }
  
  // 공지 내용이 변경되지 않았으면 스킵 (CSS 애니메이션 리셋 방지)
  const sig = notices.map(n => n.id + ':' + n.content + ':' + n.is_urgent).join('|') + 
    '#' + noticeSettings.font_size + ',' + noticeSettings.enabled + ',' + noticeSettings.bg_color + ',' + noticeSettings.scroll_speed;
  if (sig === _lastNoticeSignature && bar.style.display === 'block') return;
  _lastNoticeSignature = sig;
  
  const fontSize = noticeSettings.font_size || 32;
  
  // 긴급공지가 있는지 확인
  const hasUrgent = notices.some(n => n.is_urgent);
  
  // 배경색 설정 (긴급공지가 있으면 파란색)
  let bgColor, bgOpacity, textColor;
  if (hasUrgent) {
    bgColor = '#2563eb'; // blue-600
    bgOpacity = 0.95;
    textColor = '#ffffff';
  } else {
    bgColor = noticeSettings.bg_color || '#1a1a2e';
    bgOpacity = (noticeSettings.bg_opacity ?? 100) / 100;
    textColor = noticeSettings.text_color || '#ffffff';
  }
  
  // hex를 rgba로 변환
  const r = parseInt(bgColor.slice(1,3), 16);
  const g = parseInt(bgColor.slice(3,5), 16);
  const b = parseInt(bgColor.slice(5,7), 16);
  bar.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
  bar.style.display = 'block';
  
  // 공지 위치 적용
  const position = noticeSettings.position || 'bottom';
  bar.classList.remove('position-top', 'position-bottom');
  bar.classList.add('position-' + position);
  
  // 각 공지 사이에 짧은 간격만 (별표 없음)
  const spacer = '\u00A0\u00A0\u00A0\u00A0';
  const combinedContent = notices.map(n => n.content).join(spacer);
  
  // 두 개의 동일한 텍스트로 연속 스크롤 효과 (끝에도 간격 추가)
  text1.textContent = combinedContent + spacer;
  text2.textContent = combinedContent + spacer;
  
  // 스타일 적용
  const letterSpacing = noticeSettings.letter_spacing ?? 0;
  const safeLetterSpacing = Number.isFinite(Number(letterSpacing)) ? Number(letterSpacing) : 0;
  [text1, text2].forEach(el => {
    el.style.color = textColor;
    el.style.fontSize = fontSize + 'px';
    el.style.letterSpacing = safeLetterSpacing + 'px';
    el.style.fontWeight = 'bold';
    el.style.textShadow = 'none'; // 겹침 현상 방지
  });
  
  // 공지창 패딩 최소화 - 폰트가 꽉 차게
  const padding = Math.max(4, Math.round(fontSize * 0.1));
  bar.style.padding = padding + 'px 0';
  bar.style.minHeight = (fontSize + padding * 2 + 4) + 'px';
  
  // 스크롤 속도 계산 - 더 부드럽고 구분되게
  const speed = noticeSettings.scroll_speed || 50;
  // 속도 구간별로 명확한 차이
  // 10-30: 매우 느림 (60-40초)
  // 30-70: 보통 (40-25초)  
  // 70-120: 빠름 (25-12초)
  // 120-200: 매우 빠름 (12-5초)
  let baseDuration;
  if (speed <= 30) {
    baseDuration = 60 - (speed - 10) * 1;  // 60 ~ 40초
  } else if (speed <= 70) {
    baseDuration = 40 - (speed - 30) * 0.375;  // 40 ~ 25초
  } else if (speed <= 120) {
    baseDuration = 25 - (speed - 70) * 0.26;  // 25 ~ 12초
  } else {
    baseDuration = 12 - (speed - 120) * 0.0875;  // 12 ~ 5초
  }
  baseDuration = Math.max(5, baseDuration);
  
  // 공지 개수에 따른 추가 시간 (개당 40% 증가)
  const totalDuration = baseDuration * Math.max(1, 1 + (notices.length - 1) * 0.4);
  wrapper.style.animationDuration = totalDuration + 's';
}

// ========== 새로운 재생 시스템: 프리로드 방식 ==========

let preloadedPlayers = {};  // 프리로드된 Vimeo 플레이어
let preloadingIndex = -1;   // 현재 프리로드 중인 인덱스

// 모든 미디어 아이템을 미리 로드
function initializeAllMedia() {
  const container = document.getElementById('media-container');
  if (!container) {
    console.error('media-container not found');
    return;
  }
  
  // 안전 체크: playlist가 없거나 비어있으면 대기 화면 표시
  if (!playlist || !playlist.items || playlist.items.length === 0) {
    console.log('[initializeAllMedia] Playlist is empty, showing waiting screen');
    showEmptyPlaylistScreen();
    return;
  }
  
  // 대기 화면 숨기기 (아이템이 있으므로)
  hideEmptyPlaylistScreen();
  
  // currentIndex 범위 체크
  if (currentIndex >= playlist.items.length) {
    console.log('initializeAllMedia: adjusting currentIndex', currentIndex, '->', 0);
    currentIndex = 0;
  }
  
  // ★ 전체화면 유지: iframe 파괴 전 전환 플래그 설정
  markMediaTransitionStart();
  
  // ★ 기존 플레이어 먼저 파괴 (메모리 누수 방지)
  // 참조를 별도로 저장한 후 즉시 초기화 (이벤트 콜백 차단)
  const oldPlayers = Object.assign({}, players);
  const oldPreloaded = Object.assign({}, preloadedPlayers);
  players = {};
  itemsReady = {};
  preloadedPlayers = {};
  
  Object.values(oldPlayers).forEach(p => {
    if (p) {
      try { if (p.destroy) p.destroy(); else if (p.pause) p.pause(); } catch(e) {}
    }
  });
  Object.values(oldPreloaded).forEach(p => {
    if (p) {
      try { p.destroy(); } catch(e) {}
    }
  });
  
  // ★ 기존 자식들 즉시 ID 변경 + 숨기기 (새 아이템과 ID 충돌 방지)
  const oldChildren = Array.from(container.children);
  oldChildren.forEach(child => {
    if (child.id) child.id = '_old_' + child.id + '_' + Date.now();
    child.style.display = 'none';
  });
  
  // 비동기로 DOM 제거 (이미 숨겨져 있으므로 시각적 영향 없음)
  setTimeout(() => {
    oldChildren.forEach(child => {
      try { container.removeChild(child); } catch(e) {}
    });
  }, 100);
  
  // players, itemsReady, preloadedPlayers는 위에서 이미 초기화됨
  
  playlist.items.forEach((item, index) => {
    const div = document.createElement('div');
    div.id = 'media-item-' + index;
    div.className = 'media-item' + (index === currentIndex ? ' active' : '');
    container.appendChild(div);
    
    itemsReady[index] = false;
    
    switch (item.item_type) {
      case 'youtube':
        setupYouTube(item, index);
        break;
      case 'vimeo':
        // Vimeo는 처음에 컨테이너만 생성, 플레이어는 나중에
        setupVimeoContainer(item, index);
        break;
      case 'image':
        setupImage(item, index);
        break;
    }
  });
  
  // 현재 인덱스 기준으로 프리로드 후 재생 시작
  preloadAndStart(currentIndex);
}

// Vimeo 컨테이너만 생성 (플레이어는 나중에)
function setupVimeoContainer(item, index) {
  const container = document.getElementById('media-item-' + index);
  // 배경 투명하게 - 전환 중에 이전 영상이 보이도록
  container.innerHTML = '<div id="vimeo-' + index + '" style="width:100%;height:100%;"></div>';
  itemsReady[index] = true;  // 컨테이너 준비 완료
}

// Vimeo 플레이어 프리로드
function preloadVimeo(index, callback) {
  const item = playlist.items[index];
  if (!item || item.item_type !== 'vimeo') {
    if (callback) callback();
    return;
  }
  
  const videoId = extractVimeoId(item.url);
  if (!videoId) {
    if (callback) callback();
    return;
  }
  
  // ★★ 시나리오 5 핵심 수정: 현재 재생 중인 인덱스는 절대 파괴하지 않음
  if (index === currentIndex) {
    console.log('[preload] Skipping preload for currently playing index:', index);
    if (callback) callback();
    return;
  }
  
  // 기존 프리로드 정리 (매번 새로 생성)
  if (preloadedPlayers[index]) {
    try { preloadedPlayers[index].destroy(); } catch(e) {}
    delete preloadedPlayers[index];
  }
  // ★ players[index]는 현재 재생 중이 아닐 때만 파괴
  if (players[index] && index !== currentIndex) {
    try { players[index].destroy(); } catch(e) {}
    players[index] = null;
  }
  
  console.log('Preloading Vimeo:', index, videoId);
  preloadingIndex = index;
  
  const container = document.getElementById('media-item-' + index);
  if (!container) {
    if (callback) callback();
    return;
  }
  
  container.innerHTML = '<div id="vimeo-preload-' + index + '" style="width:100%;height:100%;"></div>';
  
  try {
    const player = new Vimeo.Player('vimeo-preload-' + index, {
      id: videoId,
      width: '100%',
      height: '100%',
      autoplay: false,
      controls: false,
      loop: false,
      muted: true,
      background: false,
      playsinline: true,
      transparent: false,
      texttrack: 'ko'
    });
    // ★ iframe 생성 직후 allow 속성 패치
    patchVimeoIframe('vimeo-preload-' + index);
    
    // ★ BUG-5 FIX: callback 중복 호출 방지 플래그
    let preloadCompleted = false;
    const completePreload = (fromReady) => {
      if (preloadCompleted) return;
      preloadCompleted = true;
      preloadedPlayers[index] = player;
      preloadingIndex = -1;
      if (fromReady) {
        markMediaTransitionEnd();
        setTimeout(ensureFullscreen, 200);
      }
      if (callback) callback();
    };
    
    player.ready().then(() => {
      console.log('Vimeo preload ready:', index);
      completePreload(true);
    }).catch((err) => {
      console.log('Vimeo preload error:', index, err);
      if (!preloadCompleted) {
        preloadingIndex = -1;
        if (callback) { preloadCompleted = true; callback(); }
      }
    });
    
    // 3초 타임아웃
    setTimeout(() => {
      if (preloadingIndex === index) {
        console.log('Vimeo preload timeout:', index);
        completePreload(false);
      }
    }, 3000);
    
  } catch (e) {
    console.log('Vimeo preload exception:', index, e);
    preloadingIndex = -1;
    if (callback) callback();
  }
}

// 프리로드 후 재생 시작
function preloadAndStart(index) {
  console.log('Starting playback from index:', index);
  currentIndex = index;
  
  const item = playlist.items[index];
  
  // 첫 번째 아이템 표시
  const firstDiv = document.getElementById('media-item-' + index);
  if (firstDiv) firstDiv.classList.add('active');
  
  // Vimeo는 플레이어 생성 후 재생
  if (item.item_type === 'vimeo') {
    createAndPlayVimeoForStart(index, item);
  } else if (item.item_type === 'youtube') {
    // YouTube는 플레이어가 준비된 후 재생
    startYouTubeWhenReady(index, item);
  } else {
    // Image는 바로 재생
    startCurrentItem();
  }
}

// YouTube 플레이어가 준비된 후 재생 시작
function startYouTubeWhenReady(index, item) {
  console.log('startYouTubeWhenReady:', index, 'isYTReady:', isYTReady);
  
  // YouTube API가 아직 로드되지 않았으면 로드 후 재시도
  if (!isYTReady) {
    console.log('YouTube API not ready, loading...');
    loadYouTubeAPI().then(() => {
      console.log('YouTube API loaded, setting up player');
      setupYouTube(item, index);
      startYouTubeWhenReady(index, item);
    });
    return;
  }
  
  // 플레이어가 아직 없으면 생성 시도
  if (!players[index]) {
    console.log('YouTube player not found, setting up...');
    setupYouTube(item, index);
  }
  
  const check = setInterval(() => {
    if (players[index] && typeof players[index].playVideo === 'function') {
      clearInterval(check);
      console.log('YouTube player ready, starting:', index);
      try {
        players[index].mute();
        players[index].setVolume(0);
        players[index].seekTo(0);
        players[index].playVideo();
      } catch(e) {
        console.log('YouTube play error:', e);
      }
    }
  }, 100);
  
  // 15초 타임아웃
  setTimeout(() => {
    clearInterval(check);
    if (!players[index] || typeof players[index].playVideo !== 'function') {
      console.log('YouTube player timeout, moving to next');
      goToNext();
    }
  }, 15000);
}

// 첫 시작용 Vimeo 플레이어 생성
function createAndPlayVimeoForStart(idx, item) {
  const videoId = extractVimeoId(item.url);
  if (!videoId) {
    currentTimer = setTimeout(() => goToNext(), 3000);
    return;
  }
  
  const container = document.getElementById('media-item-' + idx);
  if (!container) {
    currentTimer = setTimeout(() => goToNext(), 3000);
    return;
  }
  
  // 기존 플레이어 파괴
  if (players[idx]) {
    try { players[idx].destroy(); } catch(e) {}
    players[idx] = null;
  }
  
  // 세션 설정
  clearVimeoTimers();
  vimeoSessionId++;
  _watchdogLastVimeoTime = 0; // ★ BUG-10 FIX: 워치독 시간 리셋
  _watchdogNoProgressCount = 0; // ★ BUG-10 FIX
  const thisSession = vimeoSessionId;
  console.log('[createVimeoForStart] session:', thisSession, 'idx:', idx);
  
  container.innerHTML = '<div id="vimeo-player-' + idx + '-' + Date.now() + '" style="width:100%;height:100%;"></div>';
  const playerId = container.firstChild.id;
  
  try {
    const player = new Vimeo.Player(playerId, {
      id: videoId,
      width: '100%',
      height: '100%',
      autoplay: false,
      controls: false,
      loop: false,
      muted: true,
      background: false,
      playsinline: true,
      transparent: false,
      texttrack: 'ko'
    });
    // ★ iframe 생성 직후 allow 속성 패치
    patchVimeoIframe(playerId);
    
    players[idx] = player;
    
    // 에러는 로그만
    player.on('error', (err) => {
      console.log('[Vimeo] error (ignored):', err.name, 'idx:', idx);
    });
    
    player.ready().then(() => {
      if (thisSession !== vimeoSessionId) {
        console.log('[createVimeoForStart] Session changed, skipping');
        return;
      }
      if (currentIndex === idx) {
        console.log('[createVimeoForStart] Ready:', idx, 'session:', thisSession);
        markMediaTransitionEnd();
        // ★ ready 시점에 로딩 화면 숨기기 (play 전이라도 iframe이 보이므로)
        hideLoadingScreen();
        // ★ 재생 전 muted 상태 확실히 보장 (Chrome autoplay 정책)
        player.setVolume(0).catch(() => {});
        startVimeoPlayback(player, idx);
        // Vimeo iframe 생성 후 전체화면 복원
        setTimeout(ensureFullscreen, 200);
        // ★ 다음 영상 프리로드 스케줄링
        scheduleNextPreload(idx);
      }
    }).catch((e) => {
      console.log('[createVimeoForStart] Ready failed:', e);
      if (thisSession === vimeoSessionId) {
        currentTimer = setTimeout(() => goToNext(), 3000);
      }
    });
    
    // ★ 10초 안에 ready가 안 되면 강제 재시도 (최대 3회)
    // ★ FIX: _startRetryCount를 클로저로 관리하여 무한 재귀 방지
    const _startRetryCount = (item._startRetryCount || 0);
    setTimeout(() => {
      if (thisSession !== vimeoSessionId) return;
      if (!players[idx] || players[idx] !== player) return;
      // ready가 됐으면 startVimeoPlayback에서 폴링이 돌고 있을 것
      if (!vimeoPollingInterval) {
        if (_startRetryCount >= 3) {
          console.log('[createVimeoForStart] 10s timeout - max retries reached, waiting for watchdog');
          return;
        }
        console.log('[createVimeoForStart] 10s timeout - player not started, retry', _startRetryCount + 1, '/3');
        markMediaTransitionStart(); // ★ 전체화면 유지
        try { player.destroy(); } catch(e) {}
        players[idx] = null;
        item._startRetryCount = _startRetryCount + 1;
        createAndPlayVimeoForStart(idx, item);
      }
    }, 10000);
    
  } catch (e) {
    console.log('[createVimeoForStart] Creation failed:', e);
    currentTimer = setTimeout(() => goToNext(), 3000);
  }
}

function setupYouTube(item, index) {
  const videoId = extractYouTubeId(item.url);
  if (!videoId) { 
    itemsReady[index] = true;
    return; 
  }
  
  const container = document.getElementById('media-item-' + index);
  container.innerHTML = '<div id="yt-' + index + '" style="width:100%;height:100%;"></div>';
  
  function create() {
    players[index] = new YT.Player('yt-' + index, {
      videoId: videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0, disablekb: 1, fs: 0, modestbranding: 1,
        rel: 0, showinfo: 0, iv_load_policy: 3, playsinline: 1,
        cc_load_policy: 1, cc_lang_pref: 'ko',
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          console.log('YouTube ready:', index);
          itemsReady[index] = true;
          markMediaTransitionEnd(); // ★ 전체화면 유지
          try {
            players[index].mute();
            players[index].setVolume(0);
          } catch(e) {}
          // 자막 활성화 시도
          try {
            players[index].setOption('captions', 'track', {'languageCode': 'ko'});
          } catch(e) {}
          // YouTube iframe 생성 후 전체화면 복원
          setTimeout(ensureFullscreen, 200);
          // ★ ready 시점에 로딩 화면 숨기기 (iframe 로드 완료 → 썸네일에서 자연스럽게 전환)
          if (currentIndex === index) {
            hideLoadingScreen();
            try { players[index].playVideo(); } catch (e) {}
          }
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) {
            hideLoadingScreen();
          }
          if (e.data === YT.PlayerState.ENDED && currentIndex === index) {
            console.log('YouTube ended:', index);
            goToNext();
          }
        },
        onError: () => {
          itemsReady[index] = true;
          if (currentIndex === index) goToNext();
        }
      }
    });
  }
  
  if (isYTReady) create();
  else {
    const check = setInterval(() => {
      if (isYTReady) { clearInterval(check); create(); }
    }, 50);
  }
}

// setupVimeo는 더 이상 사용하지 않음 - preloadVimeo와 createAndPlayVimeo 사용

function setupImage(item, index) {
  const container = document.getElementById('media-item-' + index);
  
  const img = new Image();
  img.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:100%;min-height:100%;width:auto;height:auto;object-fit:cover;';
  
  img.onload = () => {
    container.appendChild(img);
    console.log('Image ready:', index);
    itemsReady[index] = true;
    if (index === currentIndex) hideLoadingScreen();
  };
  
  img.onerror = () => {
    itemsReady[index] = true;
  };
  
  img.src = item.url;
}

// ========== 자막 관련 함수 ==========

// 자막 스타일 적용
function applySubtitleSettings() {
  const overlay = document.getElementById('subtitle-overlay');
  const textEl = document.getElementById('subtitle-text');
  if (!textEl || !overlay) return;
  
  const r = parseInt(subtitleSettings.bg_color.slice(1,3), 16);
  const g = parseInt(subtitleSettings.bg_color.slice(3,5), 16);
  const b = parseInt(subtitleSettings.bg_color.slice(5,7), 16);
  
  textEl.style.fontSize = subtitleSettings.font_size + 'px';
  textEl.style.color = subtitleSettings.text_color;
  textEl.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + (subtitleSettings.bg_opacity / 100) + ')';
  
  // 위치 적용
  overlay.style.bottom = subtitleSettings.bottom_offset + 'px';
}

// SRT 자막 파싱
function parseSRT(srtContent) {
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1];
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/);
      
      if (timeMatch) {
        const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        const text = lines.slice(2).join('\n');
        
        subtitles.push({ startTime, endTime, text });
      }
    }
  }
  
  return subtitles;
}

// 자막 로드
async function loadSubtitleForVimeo(vimeoId) {
  if (subtitles[vimeoId]) return subtitles[vimeoId];
  
  try {
    const res = await fetch('/api/subtitles/' + vimeoId);
    const data = await res.json();
    
    if (data.subtitle && data.subtitle.content) {
      subtitles[vimeoId] = parseSRT(data.subtitle.content);
      console.log('Subtitle loaded for Vimeo:', vimeoId, subtitles[vimeoId].length, 'cues');
      return subtitles[vimeoId];
    }
  } catch (e) {
    console.log('Subtitle load error:', e);
  }
  
  return null;
}

// 자막 표시
function showSubtitle(text) {
  const overlay = document.getElementById('subtitle-overlay');
  const textEl = document.getElementById('subtitle-text');
  
  if (!overlay || !textEl) return;
  
  if (text) {
    // 기존 내용 완전히 제거 후 새로 설정
    textEl.textContent = '';
    textEl.innerHTML = text.replace(/\n/g, '<br>');
    overlay.style.display = 'block';
  } else {
    textEl.textContent = '';
    textEl.innerHTML = '';
    overlay.style.display = 'none';
  }
}

// 자막 숨기기
function hideSubtitle() {
  document.getElementById('subtitle-overlay').style.display = 'none';
  if (currentSubtitleTimer) {
    clearInterval(currentSubtitleTimer);
    currentSubtitleTimer = null;
  }
}

// 자막 동기화 시작
function startSubtitleSync(player, vimeoId, idx) {
  const subs = subtitles[vimeoId];
  if (!subs || subs.length === 0) return;
  
  // 기존 타이머 정리 및 자막 숨기기
  if (currentSubtitleTimer) {
    clearInterval(currentSubtitleTimer);
    currentSubtitleTimer = null;
  }
  hideSubtitle(); // 새 자막 시작 전 기존 자막 숨기기
  
  console.log('Starting subtitle sync for:', vimeoId, 'idx:', idx);
  
  // ★★ 노트북 대응: 자막 동기화 간격을 1초로 완화 (500ms → 1000ms)
  // getCurrentTime() 호출이 메인 스레드를 차단하므로 빈도 감소
  currentSubtitleTimer = setInterval(() => {
    if (currentIndex !== idx) {
      hideSubtitle();
      return;
    }
    
    player.getCurrentTime().then((currentTime) => {
      let foundSub = null;
      for (const sub of subs) {
        if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
          foundSub = sub;
          break;
        }
      }
      
      if (foundSub) {
        showSubtitle(foundSub.text);
      } else {
        showSubtitle(null);
      }
    }).catch(() => {});
  }, 1000); // 1000ms (500→1000ms, 노트북 성능 최적화)
}

// Vimeo 세션별 상태 (각 재생 세션마다 고유 ID)
let vimeoSessionId = 0;
let vimeoPollingInterval = null;
let vimeoSafetyTimeout = null;
let cachedVimeoDuration = 0; // 영상 길이 캐시 (반복 재생용)

// 모든 Vimeo 타이머 정리
function clearVimeoTimers() {
  if (vimeoPollingInterval) {
    clearInterval(vimeoPollingInterval);
    vimeoPollingInterval = null;
  }
  if (vimeoSafetyTimeout) {
    clearTimeout(vimeoSafetyTimeout);
    vimeoSafetyTimeout = null;
  }
}

// Vimeo 재생 시작 (강화된 버전 - ended 이벤트 + 폴링 이중 감지)
// 참고: 세션 ID는 이미 호출자(recreateVimeoPlayer, prepareAndTransitionVimeo)에서 설정됨
function startVimeoPlayback(player, idx) {
  const thisSession = vimeoSessionId; // 현재 세션 캡처 (호출자가 이미 설정함)
  
  clearVimeoTimers();
  
  console.log('startVimeoPlayback session:', thisSession, 'idx:', idx);
  
  // ★★ 문제 D 수정: 기존 ended 리스너를 모두 제거한 후 새로 등록
  // player.off('ended')로 이전 호출에서 등록된 리스너 정리 → 누적 방지
  try { player.off('ended'); } catch(e) {}
  
  let endedHandled = false;
  const handleEnded = () => {
    if (endedHandled || thisSession !== vimeoSessionId) return;
    endedHandled = true;
    console.log('[Vimeo] ended event fired - idx:', idx, 'session:', thisSession);
    clearVimeoTimers();
    goToNext();
  };
  player.on('ended', handleEnded);
  
  // 재생 시작 (실패 시 재시도 - 최대 5회, 간격 점점 넓게)
  // ★★ BUG-2 FIX: async/await로 단순화 - nested .then/.catch 체인의 에러 처리 누락 방지
  const tryPlay = async (attempt) => {
    if (thisSession !== vimeoSessionId) return;
    console.log('Vimeo play attempt:', attempt, 'session:', thisSession);
    
    try {
      // ★ 매 시도마다 muted 상태 확실히 보장 (Chrome autoplay 정책)
      try { await player.setVolume(0); } catch(e) { /* setVolume 실패 무시 */ }
      await player.play();
      console.log('Vimeo play SUCCESS, attempt:', attempt);
      hideLoadingScreen();
    } catch(err) {
      const errName = err?.name || '';
      console.log('Vimeo play FAILED, attempt:', attempt, 'error:', errName, err?.message);
      if (attempt < 5 && thisSession === vimeoSessionId) {
        // ★ PlayInterrupted는 이전 load가 아직 진행 중 → 더 긴 대기
        const delay = errName === 'NotAllowedError' ? (attempt * 1500) : (attempt * 1000);
        setTimeout(() => tryPlay(attempt + 1), delay);
      } else if (thisSession === vimeoSessionId) {
        // ★ FIX: 노트북에서 5회 실패 시 즉시 goToNext가 전체 스킵 루프를 유발
        // goToNext 대신 워치독/안전타이머에 위임 (이미 vimeoSafetyTimeout이 동작 중)
        console.log('[Vimeo] All play attempts failed, waiting for safety timer/watchdog');
        // ★★ 최후 수단: iframe allow 속성 재패치 후 한 번 더 시도
        patchVimeoIframe(document.getElementById('media-item-' + idx));
        setTimeout(async () => {
          if (thisSession !== vimeoSessionId) return;
          try { await player.setVolume(0); } catch(e) {}
          try {
            await player.play();
            console.log('Vimeo FINAL play SUCCESS after patch');
            hideLoadingScreen();
          } catch(e) {}
        }, 2000);
      }
    }
  };
  tryPlay(1);
  
  // duration 가져오고 폴링 시작
  player.getDuration().then((dur) => {
    // 세션이 변경되었으면 무시
    if (thisSession !== vimeoSessionId) {
      console.log('Session changed, ignoring:', thisSession, '!=', vimeoSessionId);
      return;
    }
    
    // duration 캐시 (반복 재생 시 사용)
    if (dur > 0) cachedVimeoDuration = dur;
    const effectiveDuration = dur > 0 ? dur : cachedVimeoDuration;
    
    console.log('Vimeo duration:', effectiveDuration, 'session:', thisSession, '(cached:', cachedVimeoDuration, ')');
    
    // ★★ 시나리오 3 수정: duration이 0이면 폴링 종료 감지를 건너뛰고
    // 안전 타이머에만 의존 (즉시 ended 처리 방지)
    const hasDuration = effectiveDuration > 2; // 2초 미만은 유효하지 않은 duration
    
    // 멈춤 감지용 변수
    let lastTime = 0;
    let stuckCount = 0;
    let pollCount = 0;
    let hasEverProgressed = false;
    
    // 폴링: 영상 끝 감지 + 멈춤 감지 (3초마다 - 노트북 대응: 2→3초로 완화)
    vimeoPollingInterval = setInterval(() => {
      if (thisSession !== vimeoSessionId) {
        clearVimeoTimers();
        return;
      }
      
      pollCount++;
      
      player.getCurrentTime().then((time) => {
        if (thisSession !== vimeoSessionId) return;
        
        if (time > 1) hasEverProgressed = true;
        
        // 15초마다 진행 상황 로그 (3초 × 5회)
        if (pollCount % 5 === 0) {
          console.log('Vimeo progress:', Math.round(time), '/', effectiveDuration, 'session:', thisSession);
        }
        
        // 멈춤 감지: 10번 연속(30초) 시간이 안 변하면 play() 재시도
        // ★ FIX: 8회(24초) → 10회(30초)로 완화 (노트북 postMessage 지연 고려)
        // 노트북에서 getCurrentTime() 응답이 2-3초 지연되면 실제로는 재생 중이어도
        // 연속으로 같은 값이 올 수 있음 → stuckCount 오판 → 불필요한 play() 호출
        if (hasEverProgressed && time > 0 && Math.abs(time - lastTime) < 0.5) {
          stuckCount++;
          if (stuckCount >= 10) { // ★ FIX: 8→10회 (30초, 노트북 postMessage 지연 여유)
            console.log('[Vimeo] stuck detected at', Math.round(time), '/', effectiveDuration, '(', stuckCount * 3, 's)');
            stuckCount = 0;
            // 영상 끝 근처에서 멈췄으면 다음으로 전환
            if (hasDuration && time >= effectiveDuration - 2) {
              console.log('[Vimeo] stuck near end, treating as ended');
              if (!endedHandled) {
                endedHandled = true;
                clearVimeoTimers();
                goToNext();
              }
              return;
            }
            // ★ play() 한 번만 시도 (반복 호출 방지) + muted 보장
            player.setVolume(0).catch(() => {});
            player.play().catch(() => {});
          }
        } else {
          stuckCount = 0;
        }
        lastTime = time;
        
        // 영상 끝 감지 (폴링 백업 - ended 이벤트가 놓칠 경우 대비)
        // ★ hasDuration 체크: duration이 유효할 때만 종료 감지
        if (hasDuration && time >= effectiveDuration - 0.5) {
          if (!endedHandled) {
            console.log('[Vimeo] polling detected end:', Math.round(time), '/', effectiveDuration);
            endedHandled = true;
            clearVimeoTimers();
            goToNext();
          }
        }
      }).catch(() => {});
    }, 3000); // 3초 간격 (노트북: getCurrentTime() 호출로 인한 메인 스레드 차단 최소화)
    
    // 안전 타이머 (영상길이 + 10초 - 노트북 버퍼링 여유 확대)
    // ★ hasDuration이 false여도 동작 - 이 경우 30초 후 강제 전환
    const safetyDuration = hasDuration ? effectiveDuration + 10 : 60; // +10초 (5→10), fallback 60초 (30→60)
    vimeoSafetyTimeout = setTimeout(() => {
        if (thisSession !== vimeoSessionId) return;
        if (endedHandled) return; // 이미 처리됨
        console.log('[Vimeo] safety timeout after', safetyDuration, 's, session:', thisSession);
        endedHandled = true;
        clearVimeoTimers();
        goToNext();
      }, safetyDuration * 1000);
  }).catch((err) => {
    console.log('Vimeo getDuration failed:', err, 'using cached:', cachedVimeoDuration);
    if (thisSession !== vimeoSessionId) return;
    
    // ★★ 문제 E 수정: getDuration 실패해도 폴링 시작 (멈춤 감지 필수)
    const fallbackDuration = cachedVimeoDuration > 0 ? cachedVimeoDuration : 0;
    let lastTimeFb = 0;
    let stuckCountFb = 0;
    let pollCountFb = 0;
    let _fbGotDuration = false; // ★ FIX: duration 획득 후 중복 재귀 방지
    
    // ★ FIX: catch 경로 진입 시 then 경로에서 이미 시작된 폴링이 있으면 정리
    clearVimeoTimers();
    
    vimeoPollingInterval = setInterval(() => {
      if (thisSession !== vimeoSessionId) {
        clearVimeoTimers();
        return;
      }
      pollCountFb++;
      player.getCurrentTime().then((time) => {
        if (thisSession !== vimeoSessionId) return;
        if (pollCountFb % 4 === 0) {
          console.log('Vimeo progress (fb):', Math.round(time), 'session:', thisSession);
        }
        // 멈춤 감지 (fallback - 30초로 완화)
        if (time > 0 && Math.abs(time - lastTimeFb) < 0.5) {
          stuckCountFb++;
          if (stuckCountFb >= 10) { // ★ FIX: 8→10회 (30초, 노트북 일관성)
            stuckCountFb = 0;
            player.setVolume(0).catch(() => {});
            player.play().catch(() => {});
          }
        } else {
          stuckCountFb = 0;
        }
        lastTimeFb = time;
        // duration을 동적으로 가져오기 시도
        // ★ FIX: _fbGotDuration 플래그로 1회만 재귀 (무한 재귀 + 폴링 누적 방지)
        if (fallbackDuration === 0 && !_fbGotDuration) {
          player.getDuration().then((d) => {
            if (d > 2 && thisSession === vimeoSessionId && !_fbGotDuration) {
              _fbGotDuration = true;
              console.log('[Vimeo] Got duration dynamically:', d);
              cachedVimeoDuration = d;
              // 폴링 재시작 (duration 확보했으므로 정상 모드로)
              clearVimeoTimers();
              startVimeoPlayback(player, idx);
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }, 3000); // 3초 간격 (fallback 모드도 완화)
    
    // 안전 타이머: 캐시된 duration 사용, 없으면 60초 (노트북 여유 확대)
    const safetyFallback = fallbackDuration > 0 ? fallbackDuration + 10 : 60;
    vimeoSafetyTimeout = setTimeout(() => {
      if (thisSession !== vimeoSessionId) return;
      if (endedHandled) return;
      endedHandled = true;
      clearVimeoTimers();
      goToNext();
    }, safetyFallback * 1000);
  });
  
  // ★★ 자막 로드 (임시영상 포함)
  const item = playlist.items[idx];
  if (item) {
    const vimeoId = extractVimeoId(item.url);
    if (vimeoId) {
      console.log('[subtitle] Loading for vimeoId:', vimeoId, 'idx:', idx, 'session:', thisSession);
      loadSubtitleForVimeo(vimeoId).then((subs) => {
        if (thisSession !== vimeoSessionId) {
          console.log('[subtitle] Session changed, skipping subtitle sync');
          return;
        }
        if (subs && subs.length > 0) {
          // 커스텀 자막이 있으면 Vimeo 내장 자막 비활성화 후 커스텀 자막 사용
          console.log('[subtitle] Custom subtitle found:', subs.length, 'cues, starting sync');
          player.disableTextTrack().catch(() => {});
          startSubtitleSync(player, vimeoId, idx);
        } else {
          // 커스텀 자막이 없으면 Vimeo 내장 자막 명시적 활성화
          console.log('[subtitle] No custom subtitle, enabling Vimeo built-in texttrack:ko');
          player.enableTextTrack('ko').catch(() => {
            console.log('[subtitle] Built-in ko track not available');
          });
        }
      });
    }
  }
}

// Vimeo 플레이어 재시작 (단일 아이템 반복용) - 검정화면 없이 즉시 재생
function createAndPlayVimeo(idx, item) {
  const videoId = extractVimeoId(item.url);
  if (!videoId) {
    console.log('Invalid Vimeo ID:', item.url);
    currentTimer = setTimeout(() => goToNext(), 3000);
    return;
  }
  
  console.log('>>> createAndPlayVimeo called - idx:', idx);
  
  // 타이머 정리
  clearVimeoTimers();
  
  // 새 세션 시작
  vimeoSessionId++;
  _watchdogLastVimeoTime = 0; // ★ BUG-10 FIX: 워치독 시간 리셋
  _watchdogNoProgressCount = 0; // ★ BUG-10 FIX
  const thisSession = vimeoSessionId;
  console.log('New session:', thisSession);
  
  // 항상 플레이어를 새로 생성 (재사용 시 재생 안 되는 문제 해결)
  console.log('Recreating player for loop');
  recreateVimeoPlayer(idx, item, videoId, thisSession);
}

// Vimeo 플레이어 완전 재생성 (검정화면 방지: 기존 위에 오버레이)
function recreateVimeoPlayer(idx, item, videoId, sessionOverride = null) {
  // 세션은 호출자가 전달하거나 새로 생성
  if (sessionOverride === null) {
    vimeoSessionId++;
  }
  const thisSession = sessionOverride !== null ? sessionOverride : vimeoSessionId;
  
  const container = document.getElementById('media-item-' + idx);
  if (!container) {
    console.log('Container not found:', idx);
    currentTimer = setTimeout(() => goToNext(), 3000);
    return;
  }
  
  // ★ 기존 플레이어 위에 새 플레이어 오버레이 (검정화면 최소화)
  const oldPlayer = players[idx];
  const newPlayerId = 'vimeo-player-' + idx + '-' + Date.now();
  const newDiv = document.createElement('div');
  newDiv.id = newPlayerId;
  newDiv.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;z-index:10;opacity:0;transition:opacity 0.5s ease;';
  container.style.position = 'relative';
  container.appendChild(newDiv);
  
  console.log('[recreateVimeo] Creating player:', idx, videoId, 'session:', thisSession);
  
  try {
    const player = new Vimeo.Player(newPlayerId, {
      id: videoId,
      width: '100%',
      height: '100%',
      autoplay: false,
      controls: false,
      loop: false,
      muted: true,
      background: false,
      playsinline: true,
      transparent: false,
      texttrack: 'ko'
    });
    // ★ iframe 생성 직후 allow 속성 패치
    patchVimeoIframe(newPlayerId);
    
    players[idx] = player;
    
    player.ready().then(() => {
      // 세션 체크
      if (thisSession !== vimeoSessionId) {
        console.log('[recreateVimeo] Session changed during ready, destroying player');
        try { player.destroy(); } catch(e) {}
        return;
      }
      
      console.log('[recreateVimeo] Player ready:', idx, 'session:', thisSession);
      
      // ★ BUG-3 FIX: 여기서 play()를 직접 호출하지 않음
      // startVimeoPlayback 내부의 tryPlay()가 play()를 호출하므로 이중 호출 방지
      // 대신 새 div를 즉시 페이드인 (startVimeoPlayback이 재생 시작함)
      newDiv.style.opacity = '1';
      
      // ★ 약간의 딜레이 후 기존 플레이어 정리 (새 영상이 보인 후 - 0.8초)
      setTimeout(() => {
        if (oldPlayer && oldPlayer !== player) {
          try { oldPlayer.destroy(); } catch(e) {}
        }
        const children = Array.from(container.children);
        children.forEach(child => {
          if (child.id !== newPlayerId) {
            try { container.removeChild(child); } catch(e) {}
          }
        });
        newDiv.style.opacity = '';
        newDiv.style.transition = '';
      }, 800);
      
      if (thisSession === vimeoSessionId) {
        startVimeoPlayback(player, idx);
      }
    }).catch((err) => {
      console.log('[recreateVimeo] Ready error:', idx, err);
      // 에러 시 기존 플레이어 정리
      if (oldPlayer) {
        try { oldPlayer.destroy(); } catch(e) {}
      }
      if (thisSession === vimeoSessionId) {
        currentTimer = setTimeout(() => goToNext(), 5000);
      }
    });
    
  } catch (e) {
    console.log('[recreateVimeo] Create error:', idx, e);
    currentTimer = setTimeout(() => goToNext(), 5000);
  }
}

// 모든 플레이어 정리 및 재시작 (사용 중지 - safeRestartPlayback 사용)
function clearAllPlayers() {
  console.log('clearAllPlayers -> safeRestartPlayback');
  safeRestartPlayback();
}

// 현재 아이템 재생 시작 (YouTube, Image 전용 - Vimeo는 prepareAndTransitionVimeo에서 처리)
function startCurrentItem() {
  // 안전 체크
  if (!playlist || !playlist.items || playlist.items.length === 0) {
    console.error('startCurrentItem: playlist is empty');
    return;
  }
  if (currentIndex >= playlist.items.length) {
    console.log('startCurrentItem: adjusting currentIndex', currentIndex, '->', 0);
    currentIndex = 0;
  }
  
  const item = playlist.items[currentIndex];
  if (!item) {
    console.error('startCurrentItem: item is undefined at index', currentIndex);
    return;
  }
  console.log('Starting item:', currentIndex, item.item_type, item.url);
  
  if (item.item_type === 'youtube') {
    // YouTube 플레이어가 준비되었는지 확인
    if (players[currentIndex] && typeof players[currentIndex].playVideo === 'function') {
      try {
        players[currentIndex].mute();
        players[currentIndex].setVolume(0);
        players[currentIndex].seekTo(0);
        players[currentIndex].playVideo();
      } catch(e) {
        console.log('YouTube play error:', e);
      }
    } else {
      // 플레이어가 아직 준비되지 않음 - 준비될 때까지 대기
      startYouTubeWhenReady(currentIndex, item);
    }
  } else if (item.item_type === 'image') {
    const displayTime = (item.display_time || 10) * 1000;
    console.log('Image display time:', displayTime);
    currentTimer = setTimeout(() => goToNext(), displayTime);
  }
  // Vimeo는 prepareAndTransitionVimeo에서 직접 처리함
}

// 강화된 워치독 - 멈춤/검정화면 감지 및 자동 복구
// ★★ 노트북 대응: safeRestartPlayback 절대 호출 안 함 (처음으로 돌아가는 원인)
// 대신 play() 재시도만 하고, 정말 죽은 경우에만 최소한의 복구
let _watchdogCallCount = 0;
let _watchdogNoProgressCount = 0; // 재생 진행 없는 연속 횟수
let _watchdogLastVimeoTime = 0; // ★ 워치독 Vimeo 시간 추적 (실제 진행 판단용)
let _transitionStartTime = 0; // isTransitioning이 true가 된 시각
let _watchdogRestartCount = 0; // safeRestartPlayback 호출 횟수 (과잉 방지)

function ensurePlaybackAlive() {
  if (!playlist || !playlist.items || playlist.items.length === 0) return;
  if (currentIndex >= playlist.items.length) return;
  
  _watchdogCallCount++;
  
  // ★★ isTransitioning 강제 해제 (브라우저 탭 비활성화 등으로 setTimeout 안 될 때)
  if (isTransitioning) {
    const transitionElapsed = Date.now() - _transitionStartTime;
    if (transitionElapsed > 12000) { // ★ FIX: 8→12초로 완화 (goToNext의 10초와 여유 확보)
      console.log('[watchdog] FORCE: isTransitioning stuck for', Math.round(transitionElapsed/1000), 's - releasing lock');
      isTransitioning = false;
      _watchdogNoProgressCount = 0;
    } else {
      return; // 아직 정상 범위 내 전환 중
    }
  }

  const item = playlist.items[currentIndex];
  if (!item) return;
  
  // ★ 플레이어 존재 여부 체크
  const hasPlayer = !!players[currentIndex];
  if (!hasPlayer && item.item_type !== 'image') {
    _watchdogNoProgressCount++;
    // ★ FIX: 노트북에서 iframe 생성이 느려 플레이어 참조가 늦게 설정됨
    // 30초 → 60초로 완화 (12회), safeRestartPlayback 대신 최대 2회로 제한
    if (_watchdogNoProgressCount >= 12) { // 60초간 플레이어 없음 (30→60초 완화)
      console.log('[watchdog] No player for 60s, idx:', currentIndex, '- restarting');
      _watchdogNoProgressCount = 0;
      _watchdogRestartCount++;
      if (_watchdogRestartCount <= 2) { // 최대 2회만 재시작 (3→2 축소)
        safeRestartPlayback();
      } else {
        console.log('[watchdog] Too many restarts, waiting for next poll');
      }
      return;
    }
  }
  
  // ★ Vimeo 폴링/안전타이머가 없는 경우 - 폴링만 다시 시작 (플레이어 유지)
  if (item.item_type === 'vimeo' && hasPlayer && !vimeoPollingInterval && !vimeoSafetyTimeout) {
    _watchdogNoProgressCount++;
    if (_watchdogNoProgressCount >= 8) { // 40초 (30→40초 완화, 노트북 여유 확보)
      console.log('[watchdog] Vimeo unmonitored for 40s, restarting tracking only');
      _watchdogNoProgressCount = 0;
      // ★★ 핵심: 폴링만 다시 시작, safeRestartPlayback 절대 안 함
      startVimeoPlayback(players[currentIndex], currentIndex);
      return;
    }
  }

  if (item.item_type === 'youtube') {
    const ytPlayer = players[currentIndex];
    if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' && window.YT && YT.PlayerState) {
      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        _watchdogNoProgressCount = 0;
        _watchdogRestartCount = 0; // 정상 재생 → 재시작 카운터 리셋
      } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
        _watchdogNoProgressCount++;
        console.log('[watchdog] YouTube not playing, state:', state, 'count:', _watchdogNoProgressCount);
        try {
          ytPlayer.mute();
          ytPlayer.setVolume(0);
          ytPlayer.playVideo();
        } catch (e) {}
        if (_watchdogNoProgressCount >= 6) { // 30초 (20→30초 완화)
          console.log('[watchdog] YouTube stuck for 30s, skipping to next');
          _watchdogNoProgressCount = 0;
          goToNext();
        }
      } else if (state === YT.PlayerState.ENDED) {
        console.log('[watchdog] YouTube ended but goToNext not called, forcing...');
        _watchdogNoProgressCount = 0;
        goToNext();
      }
    }
  } else if (item.item_type === 'vimeo') {
    // ★★ 노트북 균형 수정: Vimeo 워치독은 매 3번째 호출(15초)로 완화
    // 하지만 진짜 멈춤일 때는 적절히 복구
    if (_watchdogCallCount % 3 === 0) {
      const vimeoPlayer = players[currentIndex];
      if (vimeoPlayer && typeof vimeoPlayer.getPaused === 'function') {
        // ★★ 핵심 수정: getPaused()만 믿지 않고 getCurrentTime()으로 실제 진행 확인
        // 노트북에서 Vimeo가 muted autoplay일 때 getPaused()=true인데 실제로는 재생 중인 경우 다수
        // progress 폴링(3초)이 이미 진행을 감지하고 있으므로 그쪽의 시간 변화를 교차 검증
        Promise.all([
          vimeoPlayer.getPaused(),
          vimeoPlayer.getCurrentTime()
        ]).then(([paused, currentTime]) => {
          // ★ 실제 진행 여부 판단: 시간이 변하고 있으면 재생 중 (getPaused 무시)
          const isActuallyProgressing = (currentTime > 0 && Math.abs(currentTime - (_watchdogLastVimeoTime || 0)) > 0.3);
          _watchdogLastVimeoTime = currentTime;
          
          if (isActuallyProgressing) {
            // 시간이 진행 중 → 정상 재생 (getPaused가 뭘 리턴하든 무관)
            if (paused) {
              console.log('[watchdog] Vimeo getPaused=true BUT time progressing:', Math.round(currentTime), '- ignoring paused state');
            }
            _watchdogNoProgressCount = 0;
            _watchdogRestartCount = 0;
          } else if (paused && currentIndex < playlist.items.length) {
            _watchdogNoProgressCount++;
            console.log('[watchdog] Vimeo truly paused at', Math.round(currentTime), ', count:', _watchdogNoProgressCount);
            // 2회(30초) 연속 진짜 멈춤: play() 한 번 시도
            if (_watchdogNoProgressCount === 2) {
              console.log('[watchdog] Vimeo paused 30s, gentle play retry');
              vimeoPlayer.setVolume(0).catch(() => {});
              vimeoPlayer.play().catch(() => {});
            }
            // 4회(60초): play() 한 번 더 시도
            if (_watchdogNoProgressCount === 4) {
              console.log('[watchdog] Vimeo paused 60s, second play retry before restart');
              vimeoPlayer.setVolume(0).catch(() => {});
              vimeoPlayer.play().catch(() => {});
            }
            if (_watchdogNoProgressCount >= 6) { // 90초
              console.log('[watchdog] Vimeo stuck for 90s, forcing restart');
              _watchdogNoProgressCount = 0;
              _watchdogRestartCount++;
              if (_watchdogRestartCount <= 2) {
                safeRestartPlayback();
              } else {
                console.log('[watchdog] Too many restarts, reloading page');
                window.location.reload();
              }
            }
          } else {
            _watchdogNoProgressCount = 0;
            _watchdogRestartCount = 0;
          }
        }).catch(() => {
          // getPaused/getCurrentTime 자체가 실패 = iframe이 죽은 것
          _watchdogNoProgressCount++;
          console.log('[watchdog] Vimeo API call failed, count:', _watchdogNoProgressCount);
          if (_watchdogNoProgressCount >= 6) { // 90초
            _watchdogNoProgressCount = 0;
            _watchdogRestartCount++;
            if (_watchdogRestartCount <= 2) {
              safeRestartPlayback();
            } else {
              window.location.reload();
            }
          }
        });
      } else if (!vimeoPlayer) {
        _watchdogNoProgressCount++;
        if (_watchdogNoProgressCount >= 8) { // 40초 (30→40초 완화)
          _watchdogNoProgressCount = 0;
          _watchdogRestartCount++;
          if (_watchdogRestartCount <= 2) {
            safeRestartPlayback();
          }
        }
      }
    }
  } else if (item.item_type === 'image') {
    if (!currentTimer) {
      console.log('[watchdog] Image has no timer, setting one');
      const displayTime = (item.display_time || 10) * 1000;
      currentTimer = setTimeout(() => goToNext(), displayTime);
    }
    _watchdogNoProgressCount = 0;
    _watchdogRestartCount = 0;
  }
}

function startPlaybackWatchdog() {
  if (playbackWatchdog) {
    clearInterval(playbackWatchdog);
  }
  _watchdogNoProgressCount = 0;
  playbackWatchdog = setInterval(ensurePlaybackAlive, 5000);
}

// ★ 광고 스케줄러 초기화
function _initAdScheduler(pl) {
  if (!pl || !pl.items) return;
  // repeat_every_n > 0인 배포 광고만 추출 (인덱스도 기록)
  var ads = [];
  var everyN = 0;
  pl.items.forEach(function(item, idx) {
    if (item.is_broadcast && item.repeat_every_n > 0) {
      ads.push({ item: item, index: idx });
      if (everyN === 0 || item.repeat_every_n < everyN) everyN = item.repeat_every_n;
    }
  });
  _adScheduler = {
    broadcastAds: ads,
    regularItems: [],
    loopCount: 0,
    playCountSinceAd: 0,
    adRoundRobin: 0,
    isFirstLoop: true,
    everyN: everyN,
    _pendingReturnIndex: -1
  };
  console.log('[AdScheduler] init: ads=' + ads.length + ', everyN=' + everyN);
}

// ★ 광고 스케줄러: every:N 모드에서 다음에 광고를 재생해야 하는지 확인
// 반환: 재생할 광고의 playlist 인덱스, 또는 -1
function _adSchedulerCheck() {
  if (!_adScheduler.broadcastAds.length || _adScheduler.everyN < 1) return -1;
  if (_adScheduler.isFirstLoop) return -1;
  _adScheduler.playCountSinceAd++;
  if (_adScheduler.playCountSinceAd >= _adScheduler.everyN) {
    _adScheduler.playCountSinceAd = 0;
    var adEntry = _adScheduler.broadcastAds[_adScheduler.adRoundRobin % _adScheduler.broadcastAds.length];
    _adScheduler.adRoundRobin++;
    console.log('[AdScheduler] every:' + _adScheduler.everyN + ' trigger → ad index:' + adEntry.index + ' "' + adEntry.item.title + '" (round:' + _adScheduler.adRoundRobin + ')');
    return adEntry.index;
  }
  return -1;
}

// 다음 아이템으로 전환 (디졸브/크로스페이드)
function goToNext() {
  // 중복 실행 방지 (transition 중 호출 무시)
  if (isTransitioning) {
    // ★ FIX: 5초 → 10초로 확대 (노트북에서 Vimeo ready()가 5초+ 걸릴 수 있음)
    // 5초에서 강제 해제하면 전환 완료 전에 다시 goToNext가 진입하여 이중 전환 발생
    const elapsed = Date.now() - _transitionStartTime;
    if (elapsed > 10000) {
      console.log('[goToNext] Force releasing stale transition lock after', Math.round(elapsed/1000), 's');
      isTransitioning = false;
    } else {
      console.log('Skipping goToNext: transition in progress (' + Math.round(elapsed/1000) + 's)');
      return;
    }
  }
  isTransitioning = true;
  _transitionStartTime = Date.now(); // ★ 전환 시작 시각 기록
  markMediaTransitionStart(); // ★ 전체화면 유지: iframe 전환 중 fullscreenchange 무시
  // ★ FIX: 전환 락 duration을 transition + 1000ms로 (최소 1500ms, 최대 3초)
  // 기존 최소 800ms는 너무 짧아서 Vimeo 프레임 렌더링 전에 해제될 수 있음
  const transitionLockDuration = Math.min(Math.max(transitionDuration + 1000 || 1500, 1500), 3000);
  // ★★ 전환 락 타이머를 변수로 관리 (취소 가능하게)
  if (window._transitionLockTimer) clearTimeout(window._transitionLockTimer);
  window._transitionLockTimer = setTimeout(() => { 
    isTransitioning = false; 
    _watchdogNoProgressCount = 0;
    window._transitionLockTimer = null;
  }, transitionLockDuration);
  
  // 워치독 시간 업데이트
  lastPlaybackTime = Date.now();

  // 안전 체크: playlist가 없거나 비어있으면 대기 화면 표시
  if (!playlist || !playlist.items || playlist.items.length === 0) {
    console.log('[goToNext] Playlist is empty, showing waiting screen');
    isTransitioning = false; // ★★ 문제 F 수정: 즉시 해제
    showEmptyPlaylistScreen();
    return;
  }
  
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  
  // 자막 숨기기
  hideSubtitle();
  
  const prevIndex = currentIndex;
  let nextIndex = (currentIndex + 1) % playlist.items.length;
  
  // ★ 루프 완료 감지 (nextIndex가 0으로 돌아가면)
  if (nextIndex === 0 && _adScheduler.broadcastAds.length > 0 && _adScheduler.isFirstLoop) {
    _adScheduler.loopCount++;
    _adScheduler.isFirstLoop = false;
    _adScheduler.playCountSinceAd = 0;
    _adScheduler.adRoundRobin = 0;
    console.log('[AdScheduler] 1st loop complete → every:' + _adScheduler.everyN + ' mode ON');
  }
  
  // ★ every:N 광고 체크: 현재 아이템이 일반 영상이면 카운트, N에 도달하면 광고 인덱스로 점프
  const curItem = playlist.items[currentIndex];
  if (!_adScheduler.isFirstLoop && _adScheduler.everyN > 0 && curItem && !curItem.is_broadcast) {
    const adIdx = _adSchedulerCheck();
    if (adIdx >= 0 && adIdx !== nextIndex) {
      // 광고를 먼저 재생하고, 광고 종료 후 원래 nextIndex로 복귀하기 위해 기록
      _adScheduler._pendingReturnIndex = nextIndex;
      nextIndex = adIdx;
      console.log('[AdScheduler] redirecting to ad at index:' + adIdx + ', will return to:' + _adScheduler._pendingReturnIndex);
    }
  }
  // ★ 광고 재생 후 원래 위치로 복귀
  if (curItem && curItem.is_broadcast && _adScheduler._pendingReturnIndex >= 0) {
    nextIndex = _adScheduler._pendingReturnIndex;
    _adScheduler._pendingReturnIndex = -1;
    console.log('[AdScheduler] ad finished, returning to index:' + nextIndex);
  }
  
  const nextItem = playlist.items[nextIndex];
  
  // 안전 체크: nextItem이 없으면 대기 화면 표시
  if (!nextItem) {
    console.log('[goToNext] nextItem is undefined, showing waiting screen');
    isTransitioning = false; // ★★ 즉시 해제
    showEmptyPlaylistScreen();
    return;
  }
  
  console.log('Transition:', prevIndex, '->', nextIndex, nextItem.item_type);
  
  // 단일 아이템(임시 영상)일 때 return_time 체크
  if (prevIndex === nextIndex && playlist.items.length === 1) {
    // 임시 영상의 return_time 확인
    const returnTime = currentTempVideo ? currentTempVideo.return_time : null;
    console.log('========================================');
    console.log('SINGLE ITEM - checking return_time');
    console.log('currentTempVideo:', JSON.stringify(currentTempVideo));
    console.log('return_time value:', returnTime);
    console.log('return_time === "end":', returnTime === 'end');
    console.log('========================================');
    
    // 'end' = 영상 끝나면 자동 복귀 (반복 안함)
    if (returnTime === 'end') {
      console.log('>>> RETURN TIME IS END - CLEARING TEMP VIDEO <<<');
      
      // ★★ 즉시 전환 락 해제 + 타이머 취소 (safeRestartPlayback이 새 전환을 시작할 수 있도록)
      isTransitioning = false;
      if (window._transitionLockTimer) { clearTimeout(window._transitionLockTimer); window._transitionLockTimer = null; }
      
      // 즉시 재생 중단 + 타이머 정리 (검정화면/재재생 방지)
      clearVimeoTimers();
      if (currentTimer) { clearTimeout(currentTimer); currentTimer = null; }
      hideSubtitle(); // ★ 자막 타이머도 정리
      vimeoSessionId++; // 기존 세션 무효화
      Object.values(players).forEach(p => {
        if (p) { try { if (p.pause) p.pause(); else if (p.pauseVideo) p.pauseVideo(); } catch(e) {} }
      });
      
      // 임시 영상 상태 즉시 클리어 (다음 폴링 전에)
      // ★★ 클리어한 URL 기록 (서버 clear 실패 시 같은 영상이 다시 시작되는 것 방지)
      _lastClearedTempUrl = currentTempVideo ? currentTempVideo.url : null;
      _lastClearedTempTime = Date.now();
      currentTempVideo = null;
      tempVideoLoopCount = 0;
      cachedVimeoDuration = 0; // ★★ 이전 영상의 duration 캐시 초기화 (잘못된 종료 감지 방지)
      
      // 서버에 임시 영상 해제 요청 (★ 해당 URL만 클리어 - 새로 전송된 영상 보호)
      clearTempVideoOnServer(_lastClearedTempUrl);
      
      // 원본 플레이리스트로 즉시 복귀 (10초 폴링 대기 없이)
      if (originalPlaylist && originalPlaylist.items && originalPlaylist.items.length > 0) {
        console.log('>>> Immediate restore to original playlist <<<');
        playlist = typeof structuredClone === 'function' 
          ? structuredClone(originalPlaylist) 
          : JSON.parse(JSON.stringify(originalPlaylist));
        currentIndex = 0;
        showSyncIndicator();
        safeRestartPlayback();
      }
      return;
    }
    
    // 'manual' 또는 시간 설정 = 반복 재생
    // ★★ 반복 재생 시 전환 락 즉시 해제 (같은 아이템이므로 전환이 아님)
    isTransitioning = false;
    if (window._transitionLockTimer) { clearTimeout(window._transitionLockTimer); window._transitionLockTimer = null; }
    
    tempVideoLoopCount++;
    console.log('========================================');
    console.log('>>> LOOP RESTART #' + tempVideoLoopCount + ' <<<');
    console.log('return_time:', returnTime);
    console.log('item_type:', nextItem.item_type);
    console.log('========================================');
    
    if (nextItem.item_type === 'vimeo') {
      // ★★ 시나리오 4 수정: 기존 폴링/타이머를 먼저 정리하여 세션 경쟁 방지
      clearVimeoTimers();
      hideSubtitle(); // ★ 기존 자막 타이머 정리
      // 기존 플레이어가 있으면 seek(0)으로 처음부터 재생 (검정화면 없음)
      const existingPlayer = players[nextIndex];
      if (existingPlayer && typeof existingPlayer.setCurrentTime === 'function') {
        console.log('Vimeo single loop - seeking to start (no black screen)');
        existingPlayer.setCurrentTime(0).then(() => {
          existingPlayer.setVolume(0).catch(() => {});
          existingPlayer.play().catch(() => {});
          // 재생 시간 추적 다시 시작 (자막도 재동기화됨)
          startVimeoPlayback(existingPlayer, nextIndex);
        }).catch(() => {
          // seek 실패 시 플레이어 재생성
          console.log('Vimeo seek failed, recreating player');
          createAndPlayVimeo(nextIndex, nextItem);
        });
      } else {
        // 플레이어가 없으면 새로 생성
        console.log('Vimeo single loop - creating new player');
        createAndPlayVimeo(nextIndex, nextItem);
      }
      return;
    } else if (nextItem.item_type === 'youtube') {
      // YouTube도 seek(0)으로 처음부터 재생
      const ytPlayer = players[nextIndex];
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        console.log('YouTube single loop - seeking to start');
        ytPlayer.seekTo(0);
        ytPlayer.playVideo();
      } else {
        startYouTubeWhenReady(nextIndex, nextItem);
      }
      return;
    } else if (nextItem.item_type === 'image') {
      const displayTime = (nextItem.display_time || 10) * 1000;
      currentTimer = setTimeout(() => goToNext(), displayTime);
      return;
    }
  }
  
  // 다음 인덱스로 업데이트
  currentIndex = nextIndex;
  
  // Vimeo는 플레이어가 준비된 후에 전환 시작
  if (nextItem.item_type === 'vimeo') {
    prepareAndTransitionVimeo(prevIndex, nextIndex, nextItem);
  } else if (nextItem.item_type === 'youtube') {
    // YouTube는 실제 재생 시작까지 이전 화면 유지
    startYouTubeWhenReady(nextIndex, nextItem);
    const startAt = Date.now();
    const check = setInterval(() => {
      const ytPlayer = players[nextIndex];
      if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' && window.YT && YT.PlayerState) {
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
          clearInterval(check);
          doTransition(prevIndex, nextIndex);
          return;
        }
      }
      if (Date.now() - startAt > 3000) {
        clearInterval(check);
        doTransition(prevIndex, nextIndex);
        // 안전하게 재생 보장
        try { ytPlayer && ytPlayer.playVideo && ytPlayer.playVideo(); } catch(e) {}
      }
    }, 100);
  } else {
    // Image는 로드 완료까지 이전 화면 유지
    const startAt = Date.now();
    const check = setInterval(() => {
      if (itemsReady[nextIndex]) {
        clearInterval(check);
        doTransition(prevIndex, nextIndex);
        startCurrentItem();
        return;
      }
      if (Date.now() - startAt > 2000) {
        clearInterval(check);
        doTransition(prevIndex, nextIndex);
        startCurrentItem();
      }
    }, 100);
  }
}

// Vimeo: 플레이어가 실제 재생 시작한 후 전환 (검정화면 방지)
function prepareAndTransitionVimeo(prevIndex, nextIndex, item) {
  const videoId = extractVimeoId(item.url);
  if (!videoId) {
    doTransition(prevIndex, nextIndex);
    currentTimer = setTimeout(() => goToNext(), 3000);
    return;
  }
  
  // 새 세션 시작 (이 전환의 고유 ID)
  clearVimeoTimers();
  vimeoSessionId++;
  cachedVimeoDuration = 0; // ★ 새 영상에 이전 duration 캐시 사용 방지
  _watchdogLastVimeoTime = 0; // ★ BUG-10 FIX: 새 영상 시작 시 워치독 시간 리셋 (오판 방지)
  _watchdogNoProgressCount = 0; // ★ BUG-10 FIX: 카운터도 리셋
  const thisSession = vimeoSessionId;
  console.log('[prepareVimeo] new session:', thisSession, 'prev:', prevIndex, '-> next:', nextIndex);
  
  const container = document.getElementById('media-item-' + nextIndex);
  if (!container) {
    doTransition(prevIndex, nextIndex);
    currentTimer = setTimeout(() => goToNext(), 3000);
    return;
  }
  
  // ★ 프리로드된 플레이어가 있으면 우선 사용 (가장 빠른 전환)
  if (preloadedPlayers[nextIndex]) {
    console.log('[prepareVimeo] Using preloaded player at index:', nextIndex);
    const preloadedPlayer = preloadedPlayers[nextIndex];
    players[nextIndex] = preloadedPlayer;
    delete preloadedPlayers[nextIndex];
    
    // ★★ 문제 C 수정: startVimeoPlayback 중복 호출 방지 플래그
    let playbackStarted = false;
    const startOnce = () => {
      if (playbackStarted) return;
      playbackStarted = true;
      doTransition(prevIndex, nextIndex);
      startVimeoPlayback(preloadedPlayer, nextIndex);
      setTimeout(ensureFullscreen, 200);
      scheduleNextPreload(nextIndex);
    };
    
    // ★★ 프리로드된 플레이어: 이미 iframe이 준비되어 있으므로 거의 즉시 전환 가능
    // ★ muted 보장 후 play()
    preloadedPlayer.setVolume(0).catch(() => {});
    preloadedPlayer.play().then(() => {
      if (thisSession !== vimeoSessionId) return;
      startOnce();
    }).catch(() => {
      if (thisSession !== vimeoSessionId) return;
      startOnce();
    });
    // 1.5초 안전 타임아웃 (프리로드는 빨라야 하므로 줄임)
    setTimeout(() => {
      if (thisSession !== vimeoSessionId) return;
      startOnce();
    }, 1500);
    return;
  }
  
  // ★ 기존 플레이어가 있으면 seek(0)으로 재사용 시도 (DOM 파괴 없이 전환 - 끊김 방지)
  const existingPlayer = players[nextIndex];
  if (existingPlayer && typeof existingPlayer.setCurrentTime === 'function') {
    console.log('[prepareVimeo] Reusing existing player at index:', nextIndex);
    // ★★ 문제 C 수정: 중복 호출 방지
    let playbackStarted = false;
    const startOnce = () => {
      if (playbackStarted) return;
      playbackStarted = true;
      doTransition(prevIndex, nextIndex);
      startVimeoPlayback(existingPlayer, nextIndex);
    };
    
    existingPlayer.setCurrentTime(0).then(() => {
      if (thisSession !== vimeoSessionId) return;
      // ★ muted 보장 후 play()
      existingPlayer.setVolume(0).catch(() => {});
      existingPlayer.play().then(() => {
        if (thisSession !== vimeoSessionId) return;
        startOnce();
      }).catch(() => {
        if (thisSession !== vimeoSessionId) return;
        startOnce();
      });
    }).catch(() => {
      // seek 실패 시 새 플레이어 생성
      console.log('[prepareVimeo] seek failed, creating new player');
      createNewVimeoForTransition(prevIndex, nextIndex, item, videoId, thisSession, container);
    });
    return;
  }
  
  // 기존 플레이어 없으면 새로 생성
  createNewVimeoForTransition(prevIndex, nextIndex, item, videoId, thisSession, container);
}

// Vimeo 새 플레이어 생성 및 전환 (검정화면 방지: 이전 영상 유지하면서 새 영상 준비)
// ★★ 문제 B 수정: retryCount를 파라미터로 전달 (재귀 호출 시에도 카운터 유지)
function createNewVimeoForTransition(prevIndex, nextIndex, item, videoId, thisSession, container, retryCount) {
  const _retryCount = retryCount || 0;
  const MAX_RETRIES = 3;
  
  // ★ 기존 플레이어는 즉시 제거하지 않음 - 새 플레이어가 준비될 때까지 유지
  const oldPlayer = players[nextIndex];
  
  // 새 div를 기존 위에 겹쳐서 생성 (기존 영상이 보이는 상태에서)
  const newPlayerId = 'vimeo-player-' + nextIndex + '-' + Date.now();
  const newDiv = document.createElement('div');
  newDiv.id = newPlayerId;
  newDiv.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;z-index:10;opacity:0;transition:opacity 0.5s ease;';
  container.style.position = 'relative';
  container.appendChild(newDiv);
  
  let transitionStarted = false;
  
  try {
    const player = new Vimeo.Player(newPlayerId, {
      id: videoId,
      width: '100%',
      height: '100%',
      autoplay: false,
      controls: false,
      loop: false,
      muted: true,
      background: false,
      playsinline: true,
      transparent: false,
      texttrack: 'ko'
    });
    // ★ iframe 생성 직후 allow 속성 패치
    patchVimeoIframe(newPlayerId);
    
    players[nextIndex] = player;
    
    const startTransitionIfNeeded = () => {
      if (transitionStarted) return;
      transitionStarted = true;
      markMediaTransitionEnd(); // ★ 전체화면 유지: 전환 완료 신호
      // ★ 새 영상이 시작되면 부드러운 페이드인 (0.5초)
      newDiv.style.opacity = '1';
      // ★★ 핵심: doTransition보다 페이드인을 먼저 시작
      // 새 영상이 완전히 보인 후에만 이전 영상을 제거
      setTimeout(() => {
        doTransition(prevIndex, nextIndex);
      }, 100); // 페이드인이 시작된 후 100ms 뒤에 전환 처리
      startVimeoPlayback(player, nextIndex);
      setTimeout(ensureFullscreen, 200);
      // ★ 전환 완료 후 기존 플레이어/DOM 정리 (충분한 여유 - 0.8초)
      setTimeout(() => {
        if (oldPlayer && oldPlayer !== player) {
          try { oldPlayer.destroy(); } catch(e) {}
        }
        const children = Array.from(container.children);
        children.forEach(child => {
          if (child.id !== newPlayerId) {
            try { container.removeChild(child); } catch(e) {}
          }
        });
        newDiv.style.opacity = '';
        newDiv.style.transition = '';
      }, 800);
      
      // ★ 다음 영상 프리로드 시작
      scheduleNextPreload(nextIndex);
    };
    
    // 플레이어 준비되면 재생 시작
    player.ready().then(() => {
      if (thisSession !== vimeoSessionId) {
        try { player.destroy(); } catch(e) {}
        return;
      }
      if (currentIndex !== nextIndex) return;
      
      // ★★ 핵심 개선: play() 호출하고 실제 재생이 시작될 때 전환
      // 'playing' 이벤트가 가장 확실 (실제 프레임이 렌더링됨)
      let playEventReceived = false;
      const onPlaying = () => {
        playEventReceived = true;
        // ★ FIX: 일회성 리스너 - 전환 완료 후 즉시 제거 (리스너 누적 방지)
        try { player.off('playing', onPlaying); } catch(e) {}
        try { player.off('play', onPlay); } catch(e) {}
        startTransitionIfNeeded();
      };
      const onPlay = () => {
        // play 이벤트는 playing보다 먼저 올 수 있음 - 0.1초 대기 후 전환
        setTimeout(() => {
          if (!playEventReceived) {
            try { player.off('playing', onPlaying); } catch(e) {}
            try { player.off('play', onPlay); } catch(e) {}
            startTransitionIfNeeded();
          }
        }, 150);
      };
      player.on('playing', onPlaying);
      player.on('play', onPlay);
      // ★ muted 보장 후 play() (Chrome autoplay 정책)
      player.setVolume(0).catch(() => {});
      player.play().catch(() => {});
      
      // 2초 안에 재생 이벤트가 없으면 강제 전환 (이전 영상은 아직 보이는 상태)
      setTimeout(() => {
        if (thisSession !== vimeoSessionId) return;
        startTransitionIfNeeded();
      }, 2000);
    }).catch(() => {
      if (thisSession !== vimeoSessionId) return;
      // ★★ 문제 B 수정: _retryCount를 파라미터로 전달하여 재귀에서도 유지
      if (_retryCount < MAX_RETRIES) {
        console.log('[Vimeo] ready() failed, retry', _retryCount + 1, '/', MAX_RETRIES);
        try { player.destroy(); } catch(e) {}
        try { container.removeChild(newDiv); } catch(e) {}
        setTimeout(() => {
          if (thisSession !== vimeoSessionId) return;
          createNewVimeoForTransition(prevIndex, nextIndex, item, videoId, thisSession, container, _retryCount + 1);
        }, 2000);
      } else {
        console.log('[Vimeo] ready() failed after', MAX_RETRIES, 'retries, skipping');
        startTransitionIfNeeded();
        currentTimer = setTimeout(() => goToNext(), 5000);
      }
    });
    
  } catch (e) {
    console.log('Vimeo transition player creation failed:', e);
    if (!transitionStarted) doTransition(prevIndex, nextIndex);
    clearVimeoTimers();
    currentTimer = setTimeout(() => goToNext(), 5000);
  }
}

// ★★ 다음 영상 프리로드 스케줄링 (부드러운 전환의 핵심)
// ★ FIX: 현재 재생이 안정화된 후 5초 뒤에 프리로드 시작 (2→5초, 노트북 버퍼링 완료 대기)
function scheduleNextPreload(currentIdx) {
  if (!playlist || !playlist.items || playlist.items.length <= 1) return;
  const nextIdx = (currentIdx + 1) % playlist.items.length;
  const nextItem = playlist.items[nextIdx];
  if (!nextItem || nextItem.item_type !== 'vimeo') return;
  // ★ 현재 재생 중인 인덱스와 프리로드 대상이 같으면 건너뛰기
  if (nextIdx === currentIndex && playlist.items.length > 1) return;
  setTimeout(() => {
    if (currentIndex !== currentIdx) return; // 이미 전환됨
    if (preloadedPlayers[nextIdx]) return; // 이미 프리로드됨
    if (nextIdx === currentIndex) return; // ★ 재확인: 현재 재생 중이면 건너뛰기
    // ★ FIX: 현재 영상이 실제로 재생 중인지 확인 후에만 프리로드
    // 노트북에서 현재 영상 버퍼링 중에 프리로드하면 네트워크/GPU 경쟁 발생
    const currentPlayer = players[currentIdx];
    if (currentPlayer && typeof currentPlayer.getPaused === 'function') {
      currentPlayer.getPaused().then((paused) => {
        if (!paused && currentIndex === currentIdx) {
          console.log('[preload] Current video playing, scheduling preload for next item:', nextIdx);
          preloadVimeo(nextIdx);
        } else {
          console.log('[preload] Current video not stable yet, skipping preload');
        }
      }).catch(() => {
        // getPaused 실패해도 프리로드는 진행 (iframe은 살아있을 수 있음)
        if (currentIndex === currentIdx) preloadVimeo(nextIdx);
      });
    } else {
      // Vimeo 아닌 경우 (YouTube/이미지) 바로 프리로드
      console.log('[preload] Scheduling preload for next item:', nextIdx);
      preloadVimeo(nextIdx);
    }
  }, 5000); // ★ FIX: 2초 → 5초 (노트북 안정화 대기 확대)
}

// 실제 전환 수행 (디졸브)
// ★★ 실제 전환 수행 (디졸브) - 이전 영상을 충분히 유지하여 검정화면 방지
function doTransition(prevIndex, nextIndex) {
  // ★ BUG-8 FIX: 실제 전환이 시작되면 전환 락 타이머 취소 (이중 해제 방지)
  // doTransition이 호출되었다 = 새 영상이 준비됨 = 정상 전환 진행 중
  if (window._transitionLockTimer) {
    clearTimeout(window._transitionLockTimer);
    window._transitionLockTimer = null;
  }
  
  // 먼저 모든 아이템 숨기기 (현재 재생 중인 것 제외하고 정리)
  const allItems = document.querySelectorAll('.media-item');
  allItems.forEach((item, idx) => {
    if (idx !== nextIndex && idx !== prevIndex) {
      item.classList.remove('active');
    }
  });
  
  // 다음 아이템 보이기
  const nextDiv = document.getElementById('media-item-' + nextIndex);
  if (nextDiv) {
    nextDiv.classList.add('active');
  }

  const duration = transitionDuration || 500;

  // ★★ 핵심 개선: 이전 아이템 제거는 transition duration + 500ms 후
  // 새 영상의 페이드인(0.5초)이 완료된 후에만 이전 영상을 숨김
  // 이로써 검정 화면 갭이 절대 발생하지 않음
  setTimeout(() => {
    if (prevIndex === nextIndex) return;
    
    const prevItem = playlist?.items?.[prevIndex];
    if (prevItem) {
      if (prevItem.item_type === 'vimeo' && players[prevIndex] && players[prevIndex] !== players[nextIndex]) {
        players[prevIndex].pause().catch(() => {});
      } else if (prevItem.item_type === 'youtube' && players[prevIndex] && players[prevIndex] !== players[nextIndex]) {
        try { players[prevIndex].pauseVideo(); } catch(e) {}
      }
    }
    
    const prevDiv = document.getElementById('media-item-' + prevIndex);
    if (prevDiv && prevIndex !== nextIndex) prevDiv.classList.remove('active');
    
    // ★ BUG-8 FIX: 전환 완료 후 안전하게 락 해제
    isTransitioning = false;
  }, duration + 500);
}

// 재생 시작 (초기화)
function startPlayback() {
  // 빈 플레이리스트 처리
  if (!playlist || !playlist.items || playlist.items.length === 0) {
    console.log('[startPlayback] Playlist is empty, showing waiting screen');
    showEmptyPlaylistScreen();
    return;
  }
  
  currentIndex = 0;
  initializeAllMedia();
  startPlaybackWatchdog();
}

function extractYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

function extractVimeoId(url) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

// 전체화면 상태 관리 - TV에서는 항상 전체화면 유지
let userHasInteracted = false; // 사용자 상호작용 여부
let fullscreenRestoreTimer = null; // 전체화면 복원 타이머
let _lastFullscreenRestoreTime = 0; // 마지막 복원 시도 시각 (디바운스용)
let _fullscreenLostCount = 0; // 연속 전체화면 이탈 횟수 (빈도 추적용)
let _isMediaTransitioning = false; // ★ 미디어 전환 중 플래그 (iframe 파괴/생성 시)
let _mediaTransitionTimer = null; // 전환 타이머
let _fullscreenLostResetTimer = null; // 이탈 카운터 리셋 타이머

// ★ 미디어 전환 시작 표시 (Vimeo iframe 파괴/생성으로 인한 fullscreenchange 무시용)
function markMediaTransitionStart() {
  _isMediaTransitioning = true;
  if (_mediaTransitionTimer) clearTimeout(_mediaTransitionTimer);
  _mediaTransitionTimer = setTimeout(() => { _isMediaTransitioning = false; }, 3000);
}

// ★ 미디어 전환 종료 표시
function markMediaTransitionEnd() {
  if (_mediaTransitionTimer) clearTimeout(_mediaTransitionTimer);
  _mediaTransitionTimer = setTimeout(() => { _isMediaTransitioning = false; }, 500);
}

function updateFullscreenState() {
  if (document.fullscreenElement) {
    document.body.classList.add('is-fullscreen');
    document.body.classList.remove('not-fullscreen');
    shouldBeFullscreen = true;
    userHasInteracted = true;
    _fullscreenLostCount = 0; // 정상 복원됨
    // ★ 전체화면 진입 시 힌트 메시지 숨기기 (inline style 제거)
    const hint = document.getElementById('fullscreen-hint');
    if (hint) hint.style.display = '';
    // 복원 타이머 취소
    if (fullscreenRestoreTimer) {
      clearTimeout(fullscreenRestoreTimer);
      fullscreenRestoreTimer = null;
    }
  } else {
    document.body.classList.remove('is-fullscreen');
    document.body.classList.add('not-fullscreen');
    document.body.classList.remove('mouse-active');
    
    // ★★ 전체화면 복원 로직 (노트북 안정성 개선)
    if (shouldBeFullscreen && userHasInteracted) {
      
      // ★★ 미디어 전환 중이면 iframe 파괴/생성으로 인한 이벤트 → 이탈 카운터 증가 안 함
      if (_isMediaTransitioning) {
        console.log('[fullscreen] Lost during media transition, restoring...');
        if (fullscreenRestoreTimer) clearTimeout(fullscreenRestoreTimer);
        // 전환 중에는 짧은 대기 후 복원 (iframe 안정화 후)
        fullscreenRestoreTimer = setTimeout(() => {
          if (!document.fullscreenElement && shouldBeFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }, 800);
        return;
      }
      
      _fullscreenLostCount++;
      
      // ★★ 디바운스 1초: 연쇄 fullscreenchange 무시
      const now = Date.now();
      if (now - _lastFullscreenRestoreTime < 1000) return;
      _lastFullscreenRestoreTime = now;
      
      // ★★ 사용자 의도 감지: 2초 내에 3회 이상 ESC를 누르면 의도적 종료로 간주
      // (미디어 전환 중 이탈은 카운터에 포함되지 않으므로 정확한 감지 가능)
      if (_fullscreenLostCount >= 3) {
        console.log('[fullscreen] User exited', _fullscreenLostCount, 'times, respecting user intent');
        shouldBeFullscreen = false;
        return;
      }
      
      console.log('[fullscreen] Lost, restore attempt #' + _fullscreenLostCount);
      
      // ★★ 30초 후 이탈 카운터 리셋 (시간이 지나면 의도적 종료가 아닌 것으로 간주)
      if (_fullscreenLostResetTimer) clearTimeout(_fullscreenLostResetTimer);
      _fullscreenLostResetTimer = setTimeout(() => { _fullscreenLostCount = 0; }, 30000);
      
      if (fullscreenRestoreTimer) clearTimeout(fullscreenRestoreTimer);
      // ★★ 1초 대기 후 복원 (iframe 렌더링이 안정된 후)
      fullscreenRestoreTimer = setTimeout(() => {
        if (!document.fullscreenElement && shouldBeFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            // 실패해도 CSS 의사 전체화면이 이미 동작 중
          });
        }
      }, 1000);
    }
  }
}

// 전체화면 변경 이벤트 감지
document.addEventListener('fullscreenchange', updateFullscreenState);

// 초기 상태 설정
updateFullscreenState();

// 전체화면 주기적 감시 제거 - requestFullscreen 반복 호출이 Vimeo iframe과 충돌
// 노트북 등 저사양 환경에서 영상 끊김/멈춤/처음으로 돌아가는 문제의 핵심 원인
// CSS 의사 전체화면(100vw x 100vh)이 항상 적용되므로 불필요

// 전체화면에서 마우스 움직이면 버튼 표시 (2초 후 자동 숨김)
// CSS 의사 전체화면이므로 전체화면 여부와 관계없이 동작
let mouseTimer = null;
function showControlsBriefly() {
  document.body.classList.add('mouse-active');
  if (mouseTimer) clearTimeout(mouseTimer);
  mouseTimer = setTimeout(() => {
    document.body.classList.remove('mouse-active');
  }, 3000);
}
document.addEventListener('mousemove', showControlsBriefly);
document.addEventListener('pointermove', showControlsBriefly);
// 호버 존에서도 감지 (iframe 위를 우회)
var hoverZone = document.getElementById('controls-hover-zone');
if (hoverZone) {
  hoverZone.addEventListener('mouseenter', showControlsBriefly);
  hoverZone.addEventListener('touchstart', showControlsBriefly);
}

// 전체화면 진입
// 전체화면 복원 헬퍼 - iframe allow 속성만 설정 (requestFullscreen 제거)
// requestFullscreen이 Vimeo iframe 재생을 방해하여 끊김/멈춤 유발
function ensureFullscreen() {
  document.querySelectorAll('#media-container iframe').forEach(iframe => {
    if (!iframe.getAttribute('allow') || !iframe.getAttribute('allow').includes('encrypted-media')) {
      // ★ BUG-4 FIX: patchVimeoIframe과 동일한 allow 값 사용 (encrypted-media 포함)
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    }
    if (!iframe.hasAttribute('allowfullscreen')) {
      iframe.setAttribute('allowfullscreen', '');
    }
  });
}

function enterFullscreen() {
  shouldBeFullscreen = true;
  userHasInteracted = true;
  _fullscreenLostCount = 0; // ★ 사용자가 클릭으로 전체화면 진입 → 카운터 리셋
  // ★ 전체화면 진입 시 힌트 즉시 숨기기
  const hint = document.getElementById('fullscreen-hint');
  if (hint) hint.style.display = '';
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

// 전체화면 종료 (실제로는 동작 안 함 - TV에서는 항상 전체화면)
function exitFullscreen() {
  // TV에서는 전체화면 종료 불가
}

// 전체화면 버튼 이벤트
document.getElementById('btn-fullscreen').addEventListener('click', (e) => {
  e.stopPropagation();
  enterFullscreen();
});

// 관리자 버튼 이벤트 - tvAdminCode/tvAdminEmail로 직접 이동 (세션/localStorage 우회)
document.getElementById('btn-admin').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!tvAdminCode) {
    alert('관리자 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  const adminUrl = new URL(location.origin + '/admin/' + tvAdminCode);
  if (tvAdminEmail) adminUrl.searchParams.set('email', tvAdminEmail);
  window.location.href = adminUrl.toString();
});

const fullscreenHint = document.getElementById('fullscreen-hint');
if (fullscreenHint) {
  fullscreenHint.addEventListener('click', (e) => {
    e.stopPropagation();
    enterFullscreen();
  });
}

// 화면 클릭 시 전체화면 (버튼 외 영역)
document.addEventListener('click', (e) => {
  // 버튼 클릭은 제외
  if (e.target.closest('#fullscreen-controls')) return;
  if (!document.fullscreenElement) {
    enterFullscreen();
  }
});

// 시작
enableWakeLock(); // Wake Lock 활성화
initWatchdog(); // 워치독 시작

// ★★ Vimeo/YouTube API를 loadData 이전에 미리 로드 시작 (병렬)
// preload 힌트와 함께 실제 스크립트도 동시에 로드하여 latency 최소화
loadVimeoAPI();
loadYouTubeAPI();

// ★★ SSR 데이터 사용: 서버에서 인라인된 데이터가 있으면 첫 API 호출 스킵
// 검정화면 제거 - 즉시 재생 시작
if (window.__INITIAL_TV_DATA__) {
  console.log('[SSR] Using inline initial data - skipping first API call');
  // SSR 데이터로 초기화 (loadData의 isInitial=true 로직 인라인)
  (async function ssrInit() {
    try {
      const data = window.__INITIAL_TV_DATA__;
      delete window.__INITIAL_TV_DATA__; // 메모리 해제
      
      // adminCode/email 설정
      if (data.adminCode) tvAdminCode = data.adminCode;
      if (data.adminEmail) tvAdminEmail = data.adminEmail;
      
      // 플레이리스트 설정
      if (data.playlist) {
        playlist = data.playlist;
        transitionEffect = data.playlist.transition_effect || 'fade';
        transitionDuration = data.playlist.transition_duration || 500;
        document.documentElement.style.setProperty('--transition-duration', transitionDuration + 'ms');
      }
      
      // 임시 영상 처리
      if (data.tempVideo && data.tempVideo.url) {
        playlist._tempVideo = data.tempVideo;
      }
      
      // 공지 설정
      if (data.noticeSettings) {
        Object.assign(noticeSettings, data.noticeSettings);
      }
      if (data.notices && data.notices.length > 0 && noticeSettings.enabled) {
        notices = data.notices;
        showNotices();
      }
      
      // 로고 설정
      if (data.logoSettings) {
        Object.assign(logoSettings, data.logoSettings);
        showLogo();
      }
      
      // 재생 시간 설정
      if (data.scheduleSettings) {
        Object.assign(scheduleSettings, data.scheduleSettings);
      }
      
      // 자막 설정
      if (data.subtitleSettings) {
        Object.assign(subtitleSettings, data.subtitleSettings);
      }
      
      // 빈 플레이리스트 처리
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        showEmptyPlaylistScreen();
        hideLoadingScreen();
      } else {
        // API 로드 (최대 2초 대기)
        const loadPromises = [];
        if (playlist.items.some(i => i.item_type === 'youtube')) loadPromises.push(loadYouTubeAPI());
        if (playlist.items.some(i => i.item_type === 'vimeo')) loadPromises.push(loadVimeoAPI());
        if (loadPromises.length > 0) {
          await Promise.race([Promise.all(loadPromises), new Promise(r => setTimeout(r, 2000))]);
        }
        
        // 재생 시간 체크 시작
        if (scheduleCheckInterval) clearInterval(scheduleCheckInterval);
        scheduleCheckInterval = setInterval(checkSchedule, 30000);
        
        if (checkSchedule()) {
          startPlayback();
        }
      }
      
      // 3초 안전장치 (썸네일이 있으므로 빨리 전환)
      setTimeout(hideLoadingScreen, 3000);
      
    } catch(e) {
      console.error('[SSR] Init failed, falling back to API:', e);
      loadData(true);
    }
  })();
} else {
  loadData(true);
}

// ★★ autoplay=1: 자동 전체화면 진입 (사용자 상호작용 없이)
// 관리자 페이지에서 '내보내기' 클릭 시 새 탭으로 열리므로 사용자 제스처가 있음
if (typeof IS_AUTOPLAY !== 'undefined' && IS_AUTOPLAY) {
  // 즉시 전체화면 시도 (새 탭 열기는 사용자 제스처로 간주됨)
  userHasInteracted = true;
  shouldBeFullscreen = true;
  setTimeout(() => {
    document.documentElement.requestFullscreen().catch(() => {
      // 전체화면 실패 시 클릭 한번으로 진입하도록 힌트 표시
      const hint = document.getElementById('fullscreen-hint');
      if (hint) {
        hint.style.display = 'block';
        hint.textContent = '클릭하면 전체화면으로 재생됩니다';
        // ★ 5초 후 자동 숨김 (클릭 안 해도 사라지도록)
        setTimeout(() => {
          hint.style.display = '';
        }, 5000);
      }
    });
  }, 500);
}

// 실시간 동기화 (15초마다 - 노트북 대응: 네트워크/메인스레드 부하 최소화)
// loadData가 이미 last_active_at을 업데이트하므로 별도 heartbeat 불필요
const POLL_INTERVAL = 15000;
setInterval(() => loadData(false), POLL_INTERVAL);

// ★★ 빠른 변경 감지 폴링 (2초마다 - 경량 엔드포인트 사용)
// 임시영상 전송 + 공지사항 변경 시 즉시 반영
let _lastKnownTempUrl = null; // 마지막으로 인지한 임시영상 URL
let _lastKnownTempStarted = null; // 마지막 started_at 값
let _lastKnownNoticeHash = null; // 마지막 공지 해시 (공지 변경 감지용)
const FAST_TEMP_POLL = 3000; // 2→3초 (노트북 대응: 메인 스레드 호흡 확보)
let _fastPollRunning = false; // ★ FIX: fast-poll 자체의 동시 실행 방지
setInterval(async () => {
  // ★ loadData 실행 중이면 fast poll 스킵 (메인 스레드 과부하 방지 - 노트북 대응)
  if (isLoadingData) return;
  // ★ FIX: 이전 fast-poll이 아직 실행 중이면 스킵 (느린 네트워크에서 fetch 응답 지연 시 누적 방지)
  if (_fastPollRunning) return;
  _fastPollRunning = true;
  try {
    const res = await fetch('/api/tv/' + SHORT_CODE + '/temp-check?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    
    const newUrl = data.url || null;
    const newStarted = data.started_at || null;
    const newNoticeHash = data.notice_hash || '';
    
    // 임시영상 변경 감지: URL이 바뀌었거나, 같은 URL이지만 started_at이 바뀜 (재전송)
    const tempChanged = (newUrl !== _lastKnownTempUrl) || 
                    (newUrl && newStarted && newStarted !== _lastKnownTempStarted);
    
    // 공지사항 변경 감지: 해시가 바뀜 (공지 추가/삭제/수정/활성화/비활성화/설정변경)
    const noticeChanged = (_lastKnownNoticeHash !== null) && (newNoticeHash !== _lastKnownNoticeHash);
    
    if (tempChanged) {
      console.log('[fastPoll] Temp video changed! url:', newUrl, 'started:', newStarted, 
        '(was:', _lastKnownTempUrl, 'started:', _lastKnownTempStarted, ')');
      _lastKnownTempUrl = newUrl;
      _lastKnownTempStarted = newStarted;
      _lastKnownNoticeHash = newNoticeHash;
      // 즉시 전체 데이터 로드 (임시영상 반영)
      loadData(false);
    } else if (noticeChanged) {
      console.log('[fastPoll] Notice changed! hash:', newNoticeHash, '(was:', _lastKnownNoticeHash, ')');
      _lastKnownTempUrl = newUrl;
      _lastKnownTempStarted = newStarted;
      _lastKnownNoticeHash = newNoticeHash;
      // 즉시 전체 데이터 로드 (공지 반영)
      loadData(false);
    } else {
      _lastKnownTempUrl = newUrl;
      _lastKnownTempStarted = newStarted;
      _lastKnownNoticeHash = newNoticeHash;
    }
  } catch (e) {
    // 네트워크 오류는 무시 (메인 폴링이 처리)
  } finally {
    _fastPollRunning = false; // ★ FIX: 항상 해제 (성공/실패 무관)
  }
}, FAST_TEMP_POLL);

// 탭 닫힘/내비게이션 시에만 비활성화 (sendBeacon - 언로드 중에도 전송 보장)
function deactivateTV() {
  navigator.sendBeacon('/api/tv/' + SHORT_CODE + '/deactivate');
}
// visibilitychange: 탭이 보이면 즉시 loadData로 빠른 복원
// ★ FIX: document.hidden이 항상 false로 고정되어 있으므로 실제 상태를 별도 추적
// 기존 코드는 visibilitychange 발생 시 항상 loadData를 호출하여 불필요한 부하 유발
// ★ FIX2: 토글 방식 대신 마지막 호출 시각 기반 디바운스 (Chrome에서 이벤트 중복 방지)
let _lastVisibilityChange = 0;
document.addEventListener('visibilitychange', function() {
  // 디바운스: 3초 이내 중복 호출 무시 (Chrome에서 visibilitychange가 여러 번 발생 가능)
  const now = Date.now();
  if (now - _lastVisibilityChange < 3000) return;
  _lastVisibilityChange = now;
  // document.hidden은 false로 고정되어 있으므로 이벤트 발생 자체가 탭 복귀 신호
  loadData(false);
}, true);
// pagehide/beforeunload: 실제로 탭 닫기/페이지 떠남 시에만 비활성화
window.addEventListener('pagehide', deactivateTV, true);
window.addEventListener('beforeunload', deactivateTV, true);

// 매 클릭 전체화면 진입 제거 - Vimeo 재생/일시정지 클릭과 충돌
// autoplay 시 한 번만 시도 (위의 IS_AUTOPLAY 블록에서 처리)

// 전체화면 주기적 복원 제거 - CSS 의사 전체화면이 항상 활성화되므로 불필요
// requestFullscreen 반복 호출이 Vimeo iframe과 충돌하여 영상 끊김/깜빡임 유발

// ★★ 실시간 진단 오버레이 (?diag=1 파라미터로 활성화)
const IS_DIAG = new URLSearchParams(window.location.search).get('diag') === '1';
if (IS_DIAG) {
  var _diagEl = document.createElement('div');
  _diagEl.id = 'diag-overlay';
  _diagEl.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;padding:10px 14px;border-radius:8px;font:12px/1.5 monospace;max-width:500px;pointer-events:none';
  document.body.appendChild(_diagEl);
  var _diagLog = [];
  var _origLog = console.log;
  console.log = function() {
    _origLog.apply(console, arguments);
    var msg = Array.prototype.slice.call(arguments).join(' ');
    if (/watchdog|stuck|restart|goToNext|transition|paused|ended|error|FORCE|CRITICAL|progress|safeRestart|loadData.*had/.test(msg)) {
      var t = new Date();
      _diagLog.push(t.toTimeString().slice(0,8) + ' ' + msg.slice(0, 140));
      if (_diagLog.length > 20) _diagLog.shift();
    }
  };
  setInterval(function() {
    var p = players[currentIndex];
    var state = 'none';
    if (p && typeof p.getPaused === 'function') {
      p.getPaused().then(function(paused) {
        state = paused ? 'PAUSED' : 'PLAYING';
        _updateDiag(state);
      }).catch(function() { _updateDiag('ERROR'); });
    } else if (p && typeof p.getPlayerState === 'function') {
      var s = p.getPlayerState();
      state = s === 1 ? 'PLAYING' : s === 2 ? 'PAUSED' : 'state=' + s;
      _updateDiag(state);
    } else {
      _updateDiag(p ? 'unknown' : 'NO_PLAYER');
    }
  }, 3000); // 3초 (노트북 대응: 진단 폴링도 완화)
  function _updateDiag(state) {
    var item = playlist && playlist.items && playlist.items[currentIndex];
    _diagEl.innerHTML = '<b>DIAG</b> idx:' + currentIndex + ' sess:' + vimeoSessionId 
      + ' <span style="color:' + (state === 'PLAYING' ? '#0f0' : '#f00') + '">' + state + '</span>'
      + '<br>trans:' + isTransitioning + ' poll:' + !!vimeoPollingInterval + ' safety:' + !!vimeoSafetyTimeout
      + '<br>wdg:' + _watchdogNoProgressCount + ' restart:' + _watchdogRestartCount + ' items:' + (playlist ? playlist.items.length : 0)
      + ' type:' + (item ? item.item_type : '?')
      + '<br><hr style="border-color:#333;margin:4px 0"><span style="color:#ff0;font-size:11px">' 
      + _diagLog.slice(-10).join('<br>') + '</span>';
  }
}

})();
