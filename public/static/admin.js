
// ── 모달 HTML 동적 삽입 (서버 HTML 크기 55KB 절감) ──
(function() {
  var _modalsHtml = '  <!-- TV 연결 방법 가이드 모달 -->\n  <div id="tv-guide-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'tv-guide-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center pt-2 px-4 pointer-events-none" style="overflow-y:auto">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto" style="flex-shrink:0;margin-bottom:16px">\n        <!-- 헤더 -->\n        <div class="px-5 py-4 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl flex justify-between items-center">\n          <h3 class="font-bold"><i class="fas fa-tv mr-2"></i>TV 연결 방법</h3>\n          <button onclick="closeModal(\'tv-guide-modal\')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>\n        </div>\n        <!-- 방법 1 -->\n        <div class="px-5 py-4 space-y-3">\n          <div class="border-2 border-blue-200 rounded-xl p-3.5 bg-blue-50">\n            <div class="flex items-center gap-2 mb-2">\n              <span class="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">1</span>\n              <h4 class="font-bold text-blue-800 text-sm">URL 직접 입력</h4>\n            </div>\n            <ol class="space-y-1 text-gray-700 text-xs ml-1">\n              <li>① TV 웹브라우저 실행</li>\n              <li>② <strong>「단축」</strong> 버튼으로 짧은 URL 생성</li>\n              <li>③ TV에서 단축 URL 입력 후 전체화면</li>\n            </ol>\n          </div>\n          <!-- 방법 2 -->\n          <div class="border-2 border-green-200 rounded-xl p-3.5 bg-green-50">\n            <div class="flex items-center gap-2 mb-2">\n              <span class="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">2</span>\n              <h4 class="font-bold text-green-800 text-sm">USB 북마크</h4>\n              <span class="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-full">추천</span>\n            </div>\n            <ol class="space-y-1 text-gray-700 text-xs ml-1">\n              <li>① <strong>「USB 북마크 다운로드」</strong> 클릭</li>\n              <li>② HTML 파일을 USB에 복사 후 TV에 연결</li>\n              <li>③ TV 브라우저에서 파일 열기 → 링크 클릭</li>\n            </ol>\n          </div>\n        </div>\n        <!-- 버튼 -->\n        <div class="px-5 pb-4">\n          <button onclick="closeModal(\'tv-guide-modal\')"\n            class="w-full bg-indigo-500 text-white py-2.5 rounded-lg hover:bg-indigo-600 text-sm font-medium">\n            확인\n          </button>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- TV 설치 방법 모달 (통합) -->\n  <div id="script-download-modal" style="display:none">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'script-download-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center px-4 pt-2 pointer-events-none" style="overflow-y:auto">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg pointer-events-auto" style="margin-bottom:16px;flex-shrink:0">\n        <!-- 헤더 -->\n        <div class="px-4 py-3 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl flex justify-between items-center">\n          <h3 class="font-bold text-sm">유니트체어 모니터 설치 방법</h3>\n          <button onclick="closeModal(\'script-download-modal\')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>\n        </div>\n\n        <div class="px-4 py-3 space-y-2.5">\n          <!-- 설치 단계 3개 가로 배치 -->\n          <div class="flex gap-2">\n            <div class="flex-1 flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg">\n              <span class="bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">1</span>\n              <div>\n                <p class="font-medium text-gray-800 text-xs leading-tight">파일 다운로드</p>\n                <p class="text-xs text-gray-500 leading-tight mt-0.5">BAT 또는 VBS 선택</p>\n              </div>\n            </div>\n            <div class="flex-1 flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg">\n              <span class="bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">2</span>\n              <div>\n                <p class="font-medium text-gray-800 text-xs leading-tight">시작 폴더에 복사</p>\n                <p class="text-xs text-gray-500 leading-tight mt-0.5">Win+R → <span class="bg-yellow-100 px-0.5 rounded font-mono">shell:startup</span></p>\n              </div>\n            </div>\n            <div class="flex-1 flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg">\n              <span class="bg-indigo-500 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">3</span>\n              <div>\n                <p class="font-medium text-gray-800 text-xs leading-tight">파일 더블클릭</p>\n                <p class="text-xs text-gray-500 leading-tight mt-0.5">전체화면 재생 시작</p>\n              </div>\n            </div>\n          </div>\n\n          <!-- 파일 형식 선택 + 버튼 -->  \n          <div class="border rounded-lg p-2.5 bg-white">\n            <p class="text-xs font-medium text-gray-500 mb-1.5">파일 형식 선택</p>\n            <div class="flex gap-2 mb-2">\n              <label class="flex-1 cursor-pointer">\n                <input type="radio" name="script-type" value="bat" checked class="hidden peer">\n                <div class="py-1.5 px-2 text-center border-2 rounded-lg peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-all">\n                  <p class="font-bold text-gray-800 text-xs">BAT</p>\n                  <p class="text-xs text-gray-400">창이 잠깐 표시</p>\n                </div>\n              </label>\n              <label class="flex-1 cursor-pointer">\n                <input type="radio" name="script-type" value="vbs" class="hidden peer">\n                <div class="py-1.5 px-2 text-center border-2 rounded-lg peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-all">\n                  <p class="font-bold text-gray-800 text-xs">VBS</p>\n                  <p class="text-xs text-gray-400">창 없이 실행</p>\n                </div>\n              </label>\n            </div>\n            <div class="flex gap-2">\n              <button onclick="copyInstallLink()" class="flex-1 bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-600 text-sm font-medium">\n                링크 복사\n              </button>\n              <button onclick="downloadInstallScript()" class="flex-1 bg-gray-400 text-white py-2 rounded-lg hover:bg-gray-500 text-sm font-medium">\n                다운로드\n              </button>\n            </div>\n          </div>\n\n          <!-- 링크 복사 사용법 + 설치 후 사용법 가로 배치 -->\n          <div class="flex gap-2">\n            <div class="flex-1 bg-indigo-50 rounded-lg px-2.5 py-2">\n              <p class="text-xs font-medium text-indigo-800 mb-1">링크 복사 사용법</p>\n              <p class="text-xs text-indigo-600">• URL을 <strong>브라우저 주소창</strong>에 입력</p>\n              <p class="text-xs text-indigo-600">• 즐겨찾기 저장 후 재사용 가능</p>\n            </div>\n            <div class="flex-1 bg-blue-50 rounded-lg px-2.5 py-2">\n              <p class="text-xs font-medium text-blue-800 mb-1">설치 후 사용법</p>\n              <p class="text-xs text-blue-600">• 전체화면 해제: ESC 또는 F11</p>\n              <p class="text-xs text-blue-600">• 전체화면 복귀: 화면 아무곳 클릭</p>\n            </div>\n          </div>\n\n          <!-- 참고 -->\n          <div class="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">\n            <p class="text-xs text-gray-600"><strong>참고.</strong> PC 재부팅 시 자동으로 전체화면 시작. 필요 시 브라우저 감추기 후 다른 창 사용.</p>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- =========================================================\n       ========================================================= -->\n  \n  <!-- 바로가기 생성 가이드 모달 -->\n  <div id="shortcut-guide-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'shortcut-guide-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center pt-2 px-4 pointer-events-none" style="overflow-y:auto">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto" style="flex-shrink:0;margin-bottom:16px">\n        <div class="px-5 py-4 border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-xl flex justify-between items-center">\n          <h3 class="font-bold"><i class="fas fa-link mr-2"></i>바로가기 직접 만들기</h3>\n          <button onclick="closeModal(\'shortcut-guide-modal\')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>\n        </div>\n        <div class="px-5 py-4 space-y-3">\n          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs">\n            <i class="fas fa-info-circle text-yellow-500 mr-1"></i>스크립트 파일 없이 가장 안전한 방법\n          </div>\n          <ol class="space-y-2.5 text-xs">\n            <li class="flex gap-2.5 items-start">\n              <span class="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">1</span>\n              <p class="text-gray-700">바탕화면 우클릭 → 새로 만들기 → 바로 가기</p>\n            </li>\n            <li class="flex gap-2.5 items-start">\n              <span class="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">2</span>\n              <div class="flex-1">\n                <p class="text-gray-700 mb-1.5">아래 내용 복사해서 붙여넣기:</p>\n                <div class="bg-gray-100 p-2 rounded font-mono text-xs break-all" id="shortcut-command"></div>\n                <button onclick="copyShortcutCommand()" class="mt-1.5 text-purple-600 text-xs hover:underline">\n                  <i class="fas fa-copy mr-1"></i>복사하기\n                </button>\n              </div>\n            </li>\n            <li class="flex gap-2.5 items-start">\n              <span class="bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">3</span>\n              <p class="text-gray-700">이름 입력 후 → <kbd class="bg-gray-100 px-1 rounded font-mono">Win+R</kbd> → <kbd class="bg-gray-100 px-1 rounded font-mono">shell:startup</kbd> → 바로가기 복사</p>\n            </li>\n          </ol>\n          <div class="bg-purple-50 border border-purple-200 rounded-lg p-2.5">\n            <p class="text-xs font-medium text-purple-800 mb-1">각 체어 URL:</p>\n            <div class="space-y-1 text-xs font-mono max-h-24 overflow-y-auto" id="all-chair-urls"></div>\n          </div>\n        </div>\n        <div class="px-5 pb-4">\n          <button onclick="closeModal(\'shortcut-guide-modal\')"\n            class="w-full bg-purple-500 text-white py-2.5 rounded-lg hover:bg-purple-600 text-sm font-medium">\n            확인\n          </button>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 자동 실행 가이드 모달 -->\n  <div id="autorun-guide-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'autorun-guide-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center pt-2 px-4 pointer-events-none" style="overflow-y:auto">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto" style="flex-shrink:0;margin-bottom:16px">\n        <div class="px-5 py-4 border-b bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-xl flex justify-between items-center">\n          <h3 class="font-bold"><i class="fas fa-check-circle mr-2"></i>다운로드 완료!</h3>\n          <button onclick="closeModal(\'autorun-guide-modal\')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>\n        </div>\n        <div class="px-5 py-4 space-y-3">\n          <div class="bg-green-50 border border-green-200 rounded-lg p-3">\n            <p class="font-bold text-green-800 text-sm">📁 치과TV_자동실행.bat</p>\n            <p class="text-xs text-green-700 mt-1">실행하면 모든 체어 화면이 자동으로 열립니다</p>\n          </div>\n          <div>\n            <p class="text-xs font-bold text-gray-700 mb-1.5">사용 방법</p>\n            <ol class="space-y-1 text-xs text-gray-600">\n              <li>① 파일 더블클릭 → 모든 체어 화면이 크롬으로 열림</li>\n              <li>② 각 크롬 창을 해당 체어 모니터로 드래그</li>\n            </ol>\n          </div>\n          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">\n            <p class="text-xs font-bold text-blue-800 mb-1.5"><i class="fas fa-magic mr-1"></i>PC 시작 시 자동 실행</p>\n            <ol class="space-y-1 text-xs text-blue-700">\n              <li>① <kbd class="bg-white px-1 rounded border">Win+R</kbd> → <kbd class="bg-white px-1 rounded border font-mono">shell:startup</kbd> 입력</li>\n              <li>② 열린 폴더에 bat 파일 복사 → PC 켜면 자동 실행!</li>\n            </ol>\n          </div>\n        </div>\n        <div class="px-5 pb-4">\n          <button onclick="closeModal(\'autorun-guide-modal\')"\n            class="w-full bg-green-500 text-white py-2.5 rounded-lg hover:bg-green-600 text-sm font-medium">\n            확인\n          </button>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 대기실/체어 추가 모달 -->\n  <div id="create-playlist-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'create-playlist-modal\')"></div>\n    <div class="absolute inset-0 flex items-center justify-center p-2 pointer-events-none overflow-y-auto">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-md pointer-events-auto max-h-[95vh] overflow-y-auto">\n        <div class="px-5 py-3 border-b bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-xl">\n          <h3 class="text-base font-bold"><i class="fas fa-plus-circle mr-2"></i>새로 추가하기</h3>\n        </div>\n        \n        <!-- Step 1: 타입 선택 -->\n        <div id="create-step-1" class="p-4">\n          <p class="text-sm text-gray-600 mb-3">어떤 TV를 추가할까요?</p>\n          <div class="grid grid-cols-2 gap-3">\n            <button type="button" onclick="selectCreateType(\'waiting\')"\n              class="p-4 border-2 border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition group">\n              <div class="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-teal-200">\n                <i class="fas fa-couch text-teal-600 text-xl"></i>\n              </div>\n              <p class="font-bold text-gray-800">대기실</p>\n              <p class="text-xs text-gray-500 mt-1">스마트 TV에서 재생</p>\n            </button>\n            <button type="button" onclick="selectCreateType(\'chair\')"\n              class="p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition group">\n              <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-indigo-200">\n                <i class="fas fa-tv text-indigo-600 text-xl"></i>\n              </div>\n              <p class="font-bold text-gray-800">체어</p>\n              <p class="text-xs text-gray-500 mt-1">PC 모니터에서 재생</p>\n            </button>\n          </div>\n          <button type="button" onclick="closeModal(\'create-playlist-modal\')"\n            class="w-full mt-3 px-4 py-2 text-gray-500 hover:text-gray-700 text-sm">취소</button>\n        </div>\n        \n        <!-- Step 2: 대기실 설정 -->\n        <div id="create-step-waiting" class="hidden p-4">\n          <button onclick="backToStep1()" class="text-gray-500 hover:text-gray-700 mb-2 text-sm">\n            <i class="fas fa-arrow-left mr-1"></i>뒤로\n          </button>\n          \n          <div class="flex items-center gap-2 mb-3">\n            <div class="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">\n              <i class="fas fa-couch text-teal-600 text-sm"></i>\n            </div>\n            <div>\n              <h4 class="font-bold text-gray-800 text-sm">대기실 추가</h4>\n              <p class="text-xs text-gray-500">스마트 TV에서 재생됩니다</p>\n            </div>\n          </div>\n          \n          <div class="mb-3">\n            <label class="block text-gray-700 text-sm font-medium mb-1">대기실 이름</label>\n            <input type="text" id="new-waiting-name" \n              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"\n              placeholder="예: 대기실1, 로비">\n          </div>\n          \n          <div class="mb-3">\n            <label class="block text-gray-700 text-sm font-medium mb-1">TV 연결 방식</label>\n            <div class="p-3 border-2 border-blue-200 rounded-lg bg-blue-50">\n              <p class="font-bold text-gray-800 text-sm">\n                단축 URL 직접 입력\n                <span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">권장</span>\n              </p>\n              <div class="mt-1 text-xs text-gray-600 space-y-0.5">\n                <p><i class="fas fa-check text-green-500 mr-1"></i>TV 리모컨으로 짧은 주소 입력</p>\n                <p><i class="fas fa-check text-green-500 mr-1"></i>USB 없이 바로 연결</p>\n                <p><i class="fas fa-check text-green-500 mr-1"></i>인터넷만 되면 OK</p>\n              </div>\n              <p class="mt-1 text-xs text-gray-500"><i class="fas fa-info-circle mr-1"></i>TV 브라우저 → URL 입력 → 전체화면</p>\n            </div>\n          </div>\n          \n          <div class="flex gap-3">\n            <button type="button" onclick="closeModal(\'create-playlist-modal\')"\n              class="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 text-sm">취소</button>\n            <button type="button" onclick="createWaitingRoom()"\n              class="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-sm">\n              <i class="fas fa-plus mr-1"></i>추가하기\n            </button>\n          </div>\n        </div>\n        \n        <!-- Step 2: 체어 설정 -->\n        <div id="create-step-chair" class="hidden p-4">\n          <button onclick="backToStep1()" class="text-gray-500 hover:text-gray-700 mb-2 text-sm">\n            <i class="fas fa-arrow-left mr-1"></i>뒤로\n          </button>\n          \n          <div class="flex items-center gap-2 mb-3">\n            <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">\n              <i class="fas fa-tv text-indigo-600 text-sm"></i>\n            </div>\n            <div>\n              <h4 class="font-bold text-gray-800 text-sm">체어 추가</h4>\n              <p class="text-xs text-gray-500">PC 모니터에서 재생됩니다</p>\n            </div>\n          </div>\n          \n          <div class="mb-3">\n            <label class="block text-gray-700 text-sm font-medium mb-1">체어 이름</label>\n            <input type="text" id="new-chair-name" \n              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"\n              placeholder="예: 체어1, 진료실1">\n          </div>\n          \n          <div class="bg-indigo-50 p-2.5 rounded-lg mb-3">\n            <p class="text-xs text-indigo-700">\n              <i class="fas fa-info-circle mr-1"></i>\n              체어는 <strong>자동 실행 스크립트</strong>로 설정합니다. 추가 후 스크립트를 다운로드하세요.\n            </p>\n          </div>\n          \n          <div class="flex gap-3">\n            <button type="button" onclick="closeModal(\'create-playlist-modal\')"\n              class="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 text-sm">취소</button>\n            <button type="button" onclick="createChair()"\n              class="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-sm">\n              <i class="fas fa-plus mr-1"></i>추가하기\n            </button>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 삭제 확인 모달 -->\n  <div id="delete-confirm-modal" style="display:none" class="fixed inset-0 z-[10000]">\n    <div class="modal-backdrop absolute inset-0" onclick="cancelDeleteConfirm()"></div>\n    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">\n      <div class="bg-white rounded-xl shadow-2xl w-full max-w-xs pointer-events-auto animate-in">\n        <div class="p-5 text-center">\n          <div id="delete-confirm-icon" class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">\n            <i class="fas fa-exclamation-triangle text-red-500 text-lg"></i>\n          </div>\n          <h3 id="delete-confirm-title" class="font-bold text-gray-800 mb-1">확인</h3>\n          <p id="delete-confirm-message" class="text-sm text-gray-500">정말 진행하시겠습니까?</p>\n        </div>\n        <div class="flex border-t">\n          <button onclick="cancelDeleteConfirm()" class="flex-1 py-3 text-gray-600 hover:bg-gray-50 rounded-bl-xl font-medium text-sm">취소</button>\n          <button id="delete-confirm-btn" onclick="executeDeleteConfirm()" class="flex-1 py-3 text-red-600 hover:bg-red-50 rounded-br-xl font-bold text-sm border-l">확인</button>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <!-- 대기실 설치 가이드 모달 (단축 URL) -->\n  <div id="guide-url-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'guide-url-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center pt-4 px-4 pointer-events-none">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">\n        <!-- 헤더 -->\n        <div class="px-5 py-4 border-b bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-xl flex justify-between items-center">\n          <div>\n            <h3 class="font-bold"><i class="fas fa-link mr-2"></i>대기실 TV 연결</h3>\n            <p class="text-blue-100 text-xs mt-0.5">리모컨으로 주소 입력 후 접속</p>\n          </div>\n          <button onclick="closeModal(\'guide-url-modal\')" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>\n        </div>\n        <!-- URL 표시 -->\n        <div class="px-5 pt-4 pb-2">\n          <div class="bg-blue-50 border-2 border-blue-200 rounded-xl py-3 px-4 text-center">\n            <p class="text-xs text-blue-500 mb-1">TV에 입력할 주소</p>\n            <p id="guide-short-url" class="text-lg font-bold text-blue-800 font-mono break-all leading-snug"></p>\n            <button onclick="copyGuideUrl()" class="mt-2 px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs hover:bg-blue-200">\n              <i class="fas fa-copy mr-1"></i>복사하기\n            </button>\n          </div>\n        </div>\n        <!-- 3단계 -->\n        <div class="px-5 py-3 space-y-2">\n          <div class="flex items-center gap-3">\n            <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">1</div>\n            <div>\n              <p class="text-sm font-semibold text-gray-800">TV 웹브라우저 열기</p>\n              <p class="text-xs text-gray-500">리모컨에서 인터넷/웹브라우저 버튼</p>\n            </div>\n          </div>\n          <div class="flex items-center gap-3">\n            <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">2</div>\n            <div>\n              <p class="text-sm font-semibold text-gray-800">주소창에 위 URL 입력 후 이동</p>\n              <p class="text-xs text-gray-500">북마크로 저장하면 다음에도 바로 접속</p>\n            </div>\n          </div>\n          <div class="flex items-center gap-3">\n            <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">3</div>\n            <div>\n              <p class="text-sm font-semibold text-gray-800">화면 클릭 → 전체화면 재생</p>\n              <p class="text-xs text-gray-500">터치하거나 클릭하면 전체화면으로 전환</p>\n            </div>\n          </div>\n        </div>\n        <!-- 버튼 -->\n        <div class="px-5 pb-4 pt-2 flex gap-2">\n          <button onclick="makeUrlShorter()" class="flex-1 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm">\n            단축 URL 생성\n          </button>\n          <button onclick="closeModal(\'guide-url-modal\')" class="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">\n            확인\n          </button>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- USB 가이드 모달 제거: URL 직접 입력만 사용 -->\n  \n  <!-- 플레이리스트 편집 모달 -->\n  <div id="edit-playlist-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'edit-playlist-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center px-4 pointer-events-none">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden pointer-events-auto flex flex-col" style="max-height:100vh; height:100vh;">\n        <div class="p-4 border-b flex justify-between items-center bg-gray-50">\n          <h3 id="edit-playlist-title" class="text-lg font-bold">플레이리스트 편집</h3>\n          <button onclick="closeModal(\'edit-playlist-modal\')" class="text-gray-400 hover:text-gray-600">\n            <i class="fas fa-times text-xl"></i>\n          </button>\n        </div>\n        \n        <div class="flex flex-1 overflow-hidden">\n          <!-- 왼쪽: 라이브러리 (미디어 추가 + 전체 영상 목록) -->\n          <div class="w-1/2 border-r flex flex-col overflow-hidden">\n            <div class="p-4 bg-blue-50 border-b">\n              <div class="flex items-center gap-2 mb-3">\n                <i class="fas fa-photo-video text-blue-500"></i>\n                <span class="font-bold text-gray-800">라이브러리</span>\n                <span class="text-xs text-gray-500">(클릭하여 재생목록에 추가)</span>\n              </div>\n              \n              <!-- 미디어 추가 입력 -->\n              <div class="flex gap-2 mb-2">\n                <button id="tab-video" onclick="switchMediaTab(\'video\')" \n                  class="px-3 py-1.5 bg-blue-500 text-white rounded text-sm font-medium">\n                  <i class="fab fa-youtube mr-1"></i>동영상\n                </button>\n                <button id="tab-image" onclick="switchMediaTab(\'image\')" \n                  class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300">\n                  <i class="fas fa-image mr-1"></i>이미지\n                </button>\n              </div>\n\n              <!-- 동영상 입력 -->\n              <div id="input-video">\n                <div class="flex gap-2">\n                  <input type="text" id="new-video-url" \n                    class="flex-1 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"\n                    placeholder="Vimeo URL">\n                  <button onclick="addVideoToLibrary()" class="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600">\n                    <i class="fas fa-plus"></i>\n                  </button>\n                </div>\n                <p class="text-xs text-gray-500 mt-2">플레이리스트 업로드는 Vimeo URL만 가능합니다.</p>\n              </div>\n              \n              <!-- 이미지 입력 -->\n              <div id="input-image" class="hidden">\n                <div class="flex gap-2">\n                  <input type="text" id="new-image-url" \n                    class="flex-1 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"\n                    placeholder="이미지 URL">\n                  <input type="number" id="new-image-display-time" value="10" min="1" max="300"\n                    class="w-16 px-2 py-2 border rounded text-sm text-center" placeholder="초">\n                  <button onclick="addImageToLibrary()" class="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600">\n                    <i class="fas fa-plus"></i>\n                  </button>\n                </div>\n              </div>\n\n              <!-- 라이브러리 검색 -->\n              <div class="mt-3">\n                <input type="text" id="library-search" placeholder="라이브러리 검색"\n                  oninput="updateLibrarySearch()"\n                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">\n                <div id="library-search-results" class="mt-2 border rounded-lg max-h-40 overflow-y-auto hidden"></div>\n                <p id="library-search-message" class="text-xs text-red-500 mt-1 hidden">검색 결과가 없습니다</p>\n              </div>\n            </div>\n            \n            <!-- 라이브러리 목록 -->\n            <div id="library-scroll-container" class="p-4 flex-1 overflow-y-auto" style="min-height:0;">\n              <!-- 디버그: 로그 누적 패널 (문제 해결 후 제거) -->\n              <div id="debug-banner" style="display:none;background:#f8f8ff;border:1px solid #88f;padding:4px 8px;margin-bottom:4px;font-size:9px;color:#333;border-radius:4px;max-height:80px;overflow-y:auto;font-family:monospace;line-height:1.3;">\n                SSR=${initialData.masterItems?.length || 0}개\n              </div>\n              <!-- 공용 영상 (SSR - 모달 열릴 때 renderLibraryAndPlaylist가 덮어씀) -->\n              <div id="library-master-section" class="mb-4">\n                <div class="flex items-center gap-2 mb-2 text-sm">\n                  <i class="fas fa-crown text-purple-500"></i>\n                  <span class="font-medium text-purple-700">공용 영상</span>\n                </div>\n                <div id="library-master-list" class="space-y-2">\n                  <div class="text-xs text-gray-400 text-center py-3">로딩 중...</div>\n                </div>\n              </div>\n              \n              <!-- 내 영상 -->\n              <div class="mb-4">\n                <div class="flex items-center gap-2 mb-2 text-sm">\n                  <i class="fas fa-folder text-blue-500"></i>\n                  <span class="font-medium text-gray-700">내 영상</span>\n                </div>\n                <div id="library-user-list" class="space-y-2">\n                  <div class="text-center py-8 text-gray-400 text-sm">\n                    영상을 추가하세요\n                  </div>\n                </div>\n              </div>\n            </div>\n          </div>\n          \n          <!-- 오른쪽: 재생 플레이리스트 -->\n          <div class="w-1/2 flex flex-col overflow-hidden">\n            <div class="p-4 bg-green-50 border-b">\n              <div class="flex items-center justify-between">\n                <div class="flex items-center gap-2">\n                  <i class="fas fa-play-circle text-green-500"></i>\n                  <span class="font-bold text-gray-800">재생 플레이리스트</span>\n                  <span id="playlist-count" class="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">0개</span>\n                </div>\n                <span class="text-xs text-gray-400">\n                  <i class="fas fa-grip-vertical mr-1"></i>드래그하여 순서 변경\n                </span>\n              </div>\n              <p class="text-xs text-gray-500 mt-1">위에서부터 순서대로 재생됩니다</p>\n            </div>\n            \n            <div id="playlist-items-container" class="flex-1 overflow-y-auto p-4 space-y-2 border-t" style="min-height:0;">\n              <div class="text-center py-8 text-gray-400 text-sm">\n                왼쪽 라이브러리에서 영상을 클릭하여 추가하세요\n              </div>\n            </div>\n          </div>\n        </div>\n        \n        <!-- 하단 설정 영역 (접이식) -->\n        <div class="border-t">\n          <button onclick="togglePlaylistSettings()" class="w-full p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-2 text-sm text-gray-600">\n            <i id="settings-toggle-icon" class="fas fa-chevron-down"></i>\n            <span>추가 설정 (로고, 전환효과, 스케줄 등)</span>\n          </button>\n          <div id="playlist-settings-panel" class="hidden p-4 bg-gray-50 max-h-none overflow-visible">\n            <!-- 기존 설정들을 여기로 이동 -->\n            <div class="space-y-3">\n              <div class="bg-white rounded-lg border">\n                <button type="button" onclick="toggleSettingsSection(\'logo\')" class="w-full p-3 flex items-center justify-between text-sm text-gray-700">\n                  <span class="flex items-center gap-2">\n                    <i class="fas fa-image text-amber-500"></i>\n                    <span class="font-medium">로고 & 전환 효과</span>\n                  </span>\n                  <i id="settings-section-icon-logo" class="fas fa-chevron-down"></i>\n                </button>\n                <div id="settings-section-logo" class="hidden p-4 border-t">\n                  <div class="grid grid-cols-2 gap-4">\n                    <!-- 로고 설정 -->\n                    <div class="bg-white rounded-lg p-4 border">\n                      <div class="flex items-center gap-2 mb-3">\n                        <i class="fas fa-image text-amber-500"></i>\n                        <span class="font-medium text-gray-800 text-sm">로고</span>\n                      </div>\n                      <input type="text" id="logo-url" placeholder="로고 URL (PNG 권장)"\n                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-amber-500 mb-2"\n                        onchange="saveLogoSettings()">\n                      <div class="flex gap-2 mb-2">\n                        <div class="flex-1">\n                          <label class="text-xs text-gray-500">크기 <span id="logo-size-value">150px</span></label>\n                          <input type="range" id="logo-size" min="50" max="800" step="10" value="150"\n                            onchange="updateLogoSizeLabel(); saveLogoSettings()" class="w-full">\n                        </div>\n                        <div class="flex-1">\n                          <label class="text-xs text-gray-500">투명도 <span id="logo-opacity-value">90%</span></label>\n                          <input type="range" id="logo-opacity" min="10" max="100" step="5" value="90"\n                            onchange="updateLogoOpacityLabel(); saveLogoSettings()" class="w-full">\n                        </div>\n                      </div>\n                      <div class="mb-2">\n                        <label class="text-xs text-gray-500">로고 위치</label>\n                        <select id="logo-position" onchange="saveLogoSettings()"\n                          class="w-full px-2 py-1 border rounded text-sm mt-1">\n                          <option value="left">좌측 상단</option>\n                          <option value="right" selected>우측 상단</option>\n                        </select>\n                      </div>\n                    </div>\n                    \n                    <!-- 전환 효과 -->\n                    <div class="bg-white rounded-lg p-4 border">\n                      <div class="flex items-center gap-2 mb-3">\n                        <i class="fas fa-magic text-purple-500"></i>\n                        <span class="font-medium text-gray-800 text-sm">전환 효과</span>\n                      </div>\n                      <select id="transition-effect" onchange="saveTransitionSettings()"\n                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-purple-500 bg-white mb-2">\n                        <option value="fade">페이드</option>\n                        <option value="slide-left">슬라이드 왼쪽</option>\n                        <option value="slide-right">슬라이드 오른쪽</option>\n                        <option value="zoom">줌</option>\n                        <option value="none">없음</option>\n                      </select>\n                      <div>\n                        <label class="text-xs text-gray-500">전환 시간 <span id="transition-duration-value">500ms</span></label>\n                        <input type="range" id="transition-duration" min="100" max="2000" step="100" value="500"\n                          onchange="updateTransitionDurationLabel(); saveTransitionSettings()" class="w-full">\n                      </div>\n                    </div>\n                  </div>\n                </div>\n              </div>\n\n              <div class="bg-white rounded-lg border">\n                <button type="button" onclick="toggleSettingsSection(\'schedule\')" class="w-full p-3 flex items-center justify-between text-sm text-gray-700">\n                  <span class="flex items-center gap-2">\n                    <i class="fas fa-clock text-blue-500"></i>\n                    <span class="font-medium">스케줄 관리</span>\n                  </span>\n                  <i id="settings-section-icon-schedule" class="fas fa-chevron-down"></i>\n                </button>\n                <div id="settings-section-schedule" class="hidden p-4 border-t">\n                  <div class="flex items-center justify-between mb-3">\n                    <label class="flex items-center gap-2 text-sm text-gray-700">\n                      <input type="checkbox" id="schedule-enabled" onchange="toggleScheduleSettings()" class="rounded">\n                      <span class="font-medium">재생 시간 제한 사용</span>\n                    </label>\n                    <span class="text-xs text-gray-400">예: 09:00 ~ 18:00</span>\n                  </div>\n                  <div id="schedule-inputs" class="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">\n                    <div>\n                      <label class="text-xs text-gray-500">시작 시간</label>\n                      <input type="time" id="schedule-start" onchange="saveScheduleSettings()"\n                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500">\n                    </div>\n                    <div>\n                      <label class="text-xs text-gray-500">종료 시간</label>\n                      <input type="time" id="schedule-end" onchange="saveScheduleSettings()"\n                        class="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500">\n                    </div>\n                  </div>\n                  <p class="text-xs text-gray-500 mt-2">설정된 시간 외에는 대기 화면이 표시됩니다.</p>\n                </div>\n              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 기존 설정 영역 (숨김 처리) -->\n  <div class="hidden">\n          <!-- 로고 설정 -->\n          <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">\n            <div class="flex items-center gap-2 mb-3">\n              <i class="fas fa-image text-amber-500"></i>\n              <span class="font-bold text-gray-800">로고 URL (PNG 권장)</span>\n            </div>\n            <input type="text" id="logo-url" placeholder="https://example.com/logo.png"\n              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 mb-4"\n              onchange="saveLogoSettings()">\n            <div class="grid grid-cols-2 gap-4">\n              <div>\n                <label class="block text-sm text-gray-600 mb-2">로고 크기 (px) <span id="logo-size-value">150px</span></label>\n                <input type="range" id="logo-size" min="50" max="500" step="10" value="150"\n                  onchange="updateLogoSizeLabel(); saveLogoSettings()" class="w-full">\n                <div class="flex justify-between text-xs text-gray-400 mt-1">\n                  <span>50px</span><span>500px</span>\n                </div>\n              </div>\n              <div>\n                <label class="block text-sm text-gray-600 mb-2">로고 투명도 <span id="logo-opacity-value">90%</span></label>\n                <input type="range" id="logo-opacity" min="10" max="100" step="5" value="90"\n                  onchange="updateLogoOpacityLabel(); saveLogoSettings()" class="w-full">\n                <div class="flex justify-between text-xs text-gray-400 mt-1">\n                  <span>투명</span><span>불투명</span>\n                </div>\n              </div>\n            </div>\n          </div>\n          \n          <!-- 전환 효과 설정 -->\n          <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5 mb-6">\n            <div class="flex items-center gap-2 mb-3">\n              <i class="fas fa-magic text-purple-500"></i>\n              <span class="font-bold text-gray-800">전환 효과</span>\n            </div>\n            <div class="mb-4">\n              <label class="block text-sm text-gray-600 mb-2">✨ 전환 효과 선택</label>\n              <select id="transition-effect" onchange="saveTransitionSettings()"\n                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-white">\n                <option value="fade">✨ 페이드 (Fade)</option>\n                <option value="slide-left">⬅️ 슬라이드 왼쪽</option>\n                <option value="slide-right">➡️ 슬라이드 오른쪽</option>\n                <option value="slide-up">⬆️ 슬라이드 위로</option>\n                <option value="slide-down">⬇️ 슬라이드 아래로</option>\n                <option value="zoom">🔍 줌 (Zoom)</option>\n                <option value="flip">🔄 플립 (Flip)</option>\n                <option value="none">⏹️ 없음 (None)</option>\n              </select>\n            </div>\n            <div>\n              <label class="block text-sm text-gray-600 mb-2">전환 효과 지속 시간 <span id="duration-label">1.0초</span></label>\n              <input type="range" id="transition-duration" min="300" max="3000" step="100" value="1000"\n                onchange="updateDurationLabel(); saveTransitionSettings()" class="w-full">\n              <div class="flex justify-between text-xs text-gray-400 mt-1">\n                <span>빠름 (0.3초)</span><span>느림 (3.0초)</span>\n              </div>\n            </div>\n            <p class="text-xs text-gray-500 mt-3">\n              <i class="fas fa-info-circle mr-1"></i>영상/이미지 전환 시 적용되는 효과의 속도입니다\n            </p>\n          </div>\n          \n          <!-- 재생시간 설정 -->\n          <div class="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5 mb-6">\n            <div class="flex items-center justify-between mb-3">\n              <div class="flex items-center gap-2">\n                <i class="fas fa-clock text-teal-500"></i>\n                <span class="font-bold text-gray-800">재생시간 설정</span>\n              </div>\n              <label class="flex items-center gap-2 cursor-pointer">\n                <input type="checkbox" id="schedule-enabled" \n                  class="w-5 h-5 text-teal-500 rounded focus:ring-teal-500"\n                  onchange="toggleScheduleSettings()">\n                <span class="text-sm font-medium text-gray-700">사용</span>\n              </label>\n            </div>\n            <div id="schedule-inputs" class="grid grid-cols-2 gap-4 opacity-50 pointer-events-none">\n              <div>\n                <label class="block text-sm text-gray-600 mb-2">재생 시작시간</label>\n                <input type="time" id="schedule-start" \n                  class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"\n                  onchange="saveScheduleSettings()">\n              </div>\n              <div>\n                <label class="block text-sm text-gray-600 mb-2">재생 종료시간</label>\n                <input type="time" id="schedule-end"\n                  class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"\n                  onchange="saveScheduleSettings()">\n              </div>\n            </div>\n            <p class="text-xs text-gray-500 mt-3">\n              <i class="fas fa-info-circle mr-1"></i>체크하면 설정한 시간에만 재생됩니다. 예: 09:30 ~ 20:00\n            </p>\n          </div>\n  </div>\n  \n  <!-- 미리보기 모달 -->\n  <div id="preview-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'preview-modal\')"></div>\n    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-4xl pointer-events-auto">\n        <div class="p-4 border-b flex justify-between items-center">\n          <div class="flex items-center gap-3">\n            <i class="fas fa-tv text-blue-500"></i>\n            <h3 class="text-lg font-bold">TV 미리보기</h3>\n          </div>\n          <div class="flex items-center gap-2">\n            <button onclick="sendToTv()" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm">\n              <i class="fas fa-external-link-alt mr-2"></i>TV로 보내기 (새창)\n            </button>\n            <button onclick="closeModal(\'preview-modal\')" class="text-gray-400 hover:text-gray-600 p-2">\n              <i class="fas fa-times text-xl"></i>\n            </button>\n          </div>\n        </div>\n        <div class="p-4">\n          <div class="preview-frame rounded-lg overflow-hidden">\n            <iframe id="preview-iframe" class="w-full h-full" style="min-height: 400px;" allow="autoplay; fullscreen; picture-in-picture"></iframe>\n          </div>\n          <p class="text-center text-sm text-gray-500 mt-3">\n            <i class="fas fa-info-circle mr-1"></i>\n            실제 TV에서는 전체 화면으로 표시됩니다. 화면을 클릭하면 전체화면 모드로 전환됩니다.\n          </p>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 공지사항 생성/편집 모달 (내용만 입력, 스타일은 공통 설정) -->\n  <div id="notice-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'notice-modal\')"></div>\n    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg pointer-events-auto">\n        <div class="p-6 border-b flex items-center justify-between">\n          <h3 id="notice-modal-title" class="text-lg font-bold">새 공지사항</h3>\n          <label class="flex items-center gap-2 cursor-pointer select-none">\n            <input type="checkbox" id="notice-urgent" \n              class="w-4 h-4 text-red-500 rounded focus:ring-red-500" onchange="updateNoticeModalStyle()">\n            <span id="notice-urgent-label" class="text-xs font-semibold text-gray-500">일반</span>\n          </label>\n        </div>\n        <form onsubmit="saveNotice(event)" class="p-6">\n          <input type="hidden" id="notice-id">\n          <div id="notice-type-info" class="mb-4 p-3 rounded-lg border" style="background:#eff6ff;border-color:#dbeafe">\n            <div class="flex items-center gap-2">\n              <i id="notice-type-icon" class="fas fa-bullhorn text-blue-500 text-sm"></i>\n              <span id="notice-type-text" class="text-xs text-blue-600">일반 공지는 TV 하단에 스크롤되며 표시됩니다.</span>\n            </div>\n          </div>\n          <div class="mb-4">\n            <label class="block text-gray-700 text-sm font-medium mb-2">공지 내용</label>\n            <textarea id="notice-content" required rows="4"\n              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"\n              placeholder="TV 화면에 표시될 공지 내용을 입력하세요"></textarea>\n          </div>\n          <p class="text-xs text-gray-400 mb-4">\n            <i class="fas fa-info-circle mr-1"></i>\n            스타일 설정(글자 크기, 색상 등)은 공지사항 탭의 \'스타일 설정\'에서 공통으로 적용됩니다.\n          </p>\n          <div class="flex gap-3">\n            <button type="button" onclick="closeModal(\'notice-modal\')"\n              class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">취소</button>\n            <button type="submit" id="notice-save-btn"\n              class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">저장</button>\n          </div>\n        </form>\n      </div>\n    </div>\n  </div>\n  \n  <!-- QR 코드 모달 -->\n  <div id="qr-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'qr-modal\')"></div>\n    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm pointer-events-auto">\n        <div class="p-4 border-b flex justify-between items-center">\n          <h3 class="text-lg font-bold"><i class="fas fa-qrcode mr-2"></i>QR 코드</h3>\n          <button onclick="closeModal(\'qr-modal\')" class="text-gray-400 hover:text-gray-600">\n            <i class="fas fa-times text-xl"></i>\n          </button>\n        </div>\n        <div class="p-6 text-center">\n          <div id="qr-code-container" class="flex justify-center mb-4">\n            <!-- QR 코드 이미지 -->\n          </div>\n          <p id="qr-url-text" class="text-sm text-gray-600 break-all mb-4"></p>\n          <p class="text-xs text-gray-500">TV에서 이 QR 코드를 스캔하거나<br>위 주소를 직접 입력하세요</p>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 치과명 편집 모달 -->\n  <div id="clinic-name-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'clinic-name-modal\')"></div>\n    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">\n      <div class="bg-white rounded-xl shadow-xl w-full max-w-md pointer-events-auto">\n        <div class="p-6 border-b">\n          <h3 class="text-lg font-bold">치과명 변경</h3>\n        </div>\n        <form onsubmit="saveClinicName(event)" class="p-6">\n          <div class="mb-4">\n            <label class="block text-gray-700 text-sm font-medium mb-2">치과명</label>\n            <input type="text" id="edit-clinic-name" required\n              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"\n              placeholder="OO치과">\n          </div>\n          <div class="flex gap-3">\n            <button type="button" onclick="closeModal(\'clinic-name-modal\')"\n              class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">취소</button>\n            <button type="submit"\n              class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">저장</button>\n          </div>\n        </form>\n      </div>\n    </div>\n  </div>\n  \n  <!-- 임시 영상 전송 모달 -->\n  <div id="temp-video-modal" style="display:none" class="fixed inset-0 z-50">\n    <div class="modal-backdrop absolute inset-0" onclick="closeModal(\'temp-video-modal\')"></div>\n    <div class="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 pt-2" style="pointer-events:none">\n      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-[600px] my-2" style="pointer-events:auto;flex-shrink:0">\n        <div class="p-6">\n        <div class="flex items-center justify-between mb-4">\n          <div>\n            <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">\n              <i class="fas fa-paper-plane text-orange-500"></i>\n              임시 영상 전송\n            </h3>\n            <p class="text-sm text-gray-500 mt-1" id="temp-video-target-name">1번 체어에 전송</p>\n          </div>\n          <button onclick="closeModal(\'temp-video-modal\')" class="text-gray-400 hover:text-gray-600 p-2">\n            <i class="fas fa-times text-xl"></i>\n          </button>\n        </div>\n        \n        <input type="hidden" id="temp-video-playlist-id">\n        <input type="hidden" id="temp-video-short-code">\n        \n        <!-- 영상 선택 탭 -->\n        <div class="flex border-b mb-4">\n          <button onclick="switchTempVideoTab(\'shared\')" id="temp-tab-shared" \n            class="flex-1 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600">\n            재생목록\n          </button>\n          <button onclick="switchTempVideoTab(\'url\')" id="temp-tab-url"\n            class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">\n            URL 직접 입력\n          </button>\n        </div>\n        \n        <!-- 재생목록 (공용 + 내 영상) -->\n        <div id="temp-video-shared-tab">\n          <div class="mb-3 flex gap-2">\n            <input type="text" id="temp-video-search" placeholder="영상 이름 검색"\n              oninput="updateTempVideoSearch()"\n              class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">\n            <button type="button" onclick="updateTempVideoSearch()"\n              class="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600">검색</button>\n          </div>\n          <div id="temp-video-search-results" class="border rounded-lg max-h-40 overflow-y-auto mb-3 hidden"></div>\n          <div id="temp-video-shared-list" class="border rounded-lg max-h-60 overflow-y-auto mb-4">\n            <!-- 공용자료 목록이 여기에 렌더링됨 -->\n          </div>\n        </div>\n        \n        <!-- URL 직접 입력 -->\n        <div id="temp-video-url-tab" class="hidden">\n          <div class="mb-4">\n            <label class="block text-sm font-medium text-gray-700 mb-2">YouTube 또는 Vimeo URL</label>\n            <input type="text" id="temp-video-url" \n              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"\n              placeholder="https://youtube.com/watch?v=... 또는 https://vimeo.com/...">\n          </div>\n        </div>\n        \n        <!-- 자동 복귀 설정 (단순화) -->\n        <div class="bg-gray-50 rounded-lg p-4 mb-4">\n          <label class="block text-sm font-medium text-gray-700 mb-3">\n            복귀 설정\n          </label>\n          <div class="flex gap-3">\n            <label class="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition"\n              onclick="document.getElementById(\'temp-return-time\').value=\'end\'">\n              <input type="radio" name="return-type" value="end" class="text-indigo-600" checked>\n              <span class="text-sm font-medium">영상 끝나면 복귀</span>\n            </label>\n            <label class="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition"\n              onclick="document.getElementById(\'temp-return-time\').value=\'manual\'">\n              <input type="radio" name="return-type" value="manual" class="text-indigo-600">\n              <span class="text-sm font-medium">수동 복귀 (반복)</span>\n            </label>\n          </div>\n          <input type="hidden" id="temp-return-time" value="end">\n        </div>\n        \n        <!-- 현재 상태 표시 -->\n        <div id="temp-video-current-status" class="hidden bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">\n          <div class="flex items-center justify-between">\n            <div class="flex items-center gap-2">\n              <i class="fas fa-play-circle text-orange-500"></i>\n              <span class="text-sm text-orange-800">현재 임시 영상 재생 중</span>\n            </div>\n            <button onclick="stopTempVideo()" class="text-xs bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">\n              <i class="fas fa-stop mr-1"></i>기본으로 복귀\n            </button>\n          </div>\n        </div>\n        \n        <!-- 버튼 -->\n        <div class="flex gap-3">\n          <button onclick="closeModal(\'temp-video-modal\')" \n            class="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50 text-gray-700">\n            취소\n          </button>\n          <button onclick="sendTempVideo()" \n            class="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">\n            <i class="fas fa-paper-plane mr-2"></i>전송\n          </button>\n        </div>\n      </div>\n    </div>\n    </div>\n  </div>\n  \n  <!-- 토스트 -->\n  <div id="admin-toast" style="display:none;position:fixed;z-index:99999">\n    <div style="background:#1f2937;color:#fff;padding:12px 20px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;font-weight:500">\n      <span id="admin-toast-message"></span>\n    </div>\n  </div>\n';
  var _app = document.getElementById('app');
  if (_app) {
    var _div = document.createElement('div');
    _div.innerHTML = _modalsHtml;
    while (_div.firstChild) { _app.appendChild(_div.firstChild); }
  }
})();
// ── 삭제 확인 모달 (confirm 대체) ──
// 디버그 로그 헬퍼: 배너에 누적 로그
function _dbg(msg) {
  var db = document.getElementById('debug-banner');
  if(db) { db.innerHTML += '<br>' + msg; db.scrollTop = db.scrollHeight; }
}
// INITIAL_DATA 안전 참조: 인라인 스크립트에서 var로 선언 + window에 할당됨
// admin.js에서도 동일한 객체를 사용
// 디버그: admin.js 로드 확인
(function(){
  var _d = (typeof INITIAL_DATA !== 'undefined') ? INITIAL_DATA : (typeof window !== 'undefined' ? window.INITIAL_DATA : null);
  var mc = (_d && _d.masterItems) ? _d.masterItems.length : '?';
  var ml = document.getElementById('library-master-list');
  var mlc = ml ? ml.children.length : '?';
  _dbg('JS로드: var=' + (typeof INITIAL_DATA !== 'undefined') + ' win=' + (typeof window.INITIAL_DATA !== 'undefined') + ' master=' + mc + ' DOM=' + mlc);
})();
let _deleteConfirmCallback = null;
function showDeleteConfirm(message, callback, options) {
  _deleteConfirmCallback = callback;
  var modal = document.getElementById('delete-confirm-modal');
  var msgEl = document.getElementById('delete-confirm-message');
  var titleEl = document.getElementById('delete-confirm-title');
  var iconEl = document.getElementById('delete-confirm-icon');
  var btnEl = document.getElementById('delete-confirm-btn');
  var opt = options || {};
  if (msgEl) msgEl.textContent = message || '\uC815\uB9D0 \uC9C4\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?';
  if (titleEl) titleEl.textContent = opt.title || '\uD655\uC778';
  if (iconEl) {
    var isDestructive = opt.type !== 'info';
    iconEl.className = 'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ' + (isDestructive ? 'bg-red-100' : 'bg-blue-100');
    iconEl.innerHTML = '<i class="fas ' + (opt.icon || (isDestructive ? 'fa-exclamation-triangle' : 'fa-paper-plane')) + ' text-lg ' + (isDestructive ? 'text-red-500' : 'text-blue-500') + '"></i>';
  }
  if (btnEl) {
    btnEl.textContent = opt.confirmText || '\uD655\uC778';
    btnEl.className = 'flex-1 py-3 rounded-br-xl font-bold text-sm border-l ' + (opt.type === 'info' ? 'text-blue-600 hover:bg-blue-50' : 'text-red-600 hover:bg-red-50');
  }
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    modalHeightLocked = true;
  }
}
function cancelDeleteConfirm() {
  _deleteConfirmCallback = null;
  var modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.style.display = 'none';
  if (_openModalSet.size === 0) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    modalHeightLocked = false;
    try { if (typeof postParentHeight === 'function') setTimeout(postParentHeight, 100); } catch(e) {}
  }
}
function executeDeleteConfirm() {
  var cb = _deleteConfirmCallback;
  _deleteConfirmCallback = null;
  var modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.style.display = 'none';
  if (_openModalSet.size === 0) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    modalHeightLocked = false;
    try { if (typeof postParentHeight === 'function') setTimeout(postParentHeight, 100); } catch(e) {}
  }
  if (typeof cb === 'function') cb();
}

// Sortable 인스턴스 (함수 호이스팅을 위해 최상단 선언)
let sortableInstance = null;
let playlistItemsSortableInstance = null;
let noticeSortableInstance = null;

// INITIAL_DATA 안전 접근 (window 폴백)
var _ID = (typeof INITIAL_DATA !== 'undefined') ? INITIAL_DATA : (window.INITIAL_DATA || {});
let clinicName = _ID.clinicName || '';
let memberDisplayName = _ID.memberName || '';
let playlists = _ID.playlists || [];
let notices = _ID.notices || [];
let masterItems = _ID.masterItems || [];
let cachedMasterItems = masterItems || [];
let masterItemsCache = masterItems || [];
let currentPlaylist = null;

// INITIAL_DATA 안전 접근 헬퍼
function _getInitialData() {
  if (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA) return INITIAL_DATA;
  if (typeof window !== 'undefined' && window.INITIAL_DATA) return window.INITIAL_DATA;
  return {};
}
function _getMasterItems() {
  // API가 유일한 진실의 원천 - INITIAL_DATA에서 복원하지 않음
  return masterItems || [];
}

// SSR DOM에서 공용 영상 데이터를 복원하는 헬퍼 함수
// masterItemsCache가 비어있을 때 SSR로 렌더링된 DOM에서 아이템 정보를 파싱
function restoreMasterItemsFromDOM() {
  const list = document.getElementById('library-master-list');
  if (!list || list.children.length === 0) return [];
  const items = [];
  list.querySelectorAll('[data-library-id]').forEach(el => {
    const id = parseInt(el.getAttribute('data-library-id') || '0');
    const img = el.querySelector('img');
    const titleEl = el.querySelector('p.truncate');
    if (id > 0) {
      items.push({
        id: id,
        thumbnail_url: img ? img.src : '',
        title: titleEl ? titleEl.textContent : '',
        item_type: 'vimeo',
        url: ''
      });
    }
  });
  return items;
}
const playlistCacheById = {};
const tempVideoCacheByPlaylist = {};
const _tempVideoActiveCache = {}; // 임시 영상 활성 상태 캐시 { [playlistId]: { active: bool, return_time: string } }
let noticeSettings = { font_size: 32, letter_spacing: 0, text_color: '#ffffff', bg_color: '#1a1a2e', bg_opacity: 100, scroll_speed: 50, position: 'bottom' };
let playlistSearchQuery = '';
let masterItemsSignature = '';
let playlistEditorSignature = '';
let masterItemsRefreshTimer = null;
let _initDone = false;
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
  if (!editModal || editModal.style.display === 'none' || editModal.style.display === '') return;

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
  const masterItemsList = filterMasterItemsByPlaylist(masterItemsCache || []);
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

// 관리 탭 상태
let _adminLoaded = false;
let _subtitlesLoaded = false;
let _editingSubId = null;
let _adminSubTab = 'push';
let _allClinics = INITIAL_DATA.allClinics || [];
let _adminSearchQuery = '';

// ============================================
// localStorage 캐시 유틸 (삭제된 데이터 유령 방지)
// ============================================
const CACHE_KEY = 'dental_tv_cache_' + ADMIN_CODE;
const CACHE_EXPIRY = 60 * 1000; // 1분

// 앱 시작 시 무조건 이전 캐시 삭제 (서버 데이터가 진실의 원천)
try { localStorage.removeItem(CACHE_KEY); } catch(e) {}

function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      playlists: data.playlists || [],
      notices: data.notices || [],
      clinicName: data.clinicName || ''
    }));
  } catch(e) {}
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch(e) { return null; }
}

function init() {
  if (_initDone) return;
  _initDone = true;
  const t0 = performance.now();
  console.log('[DentalTV] init start, masterItemsCache:', masterItemsCache?.length, 'masterItems:', masterItems?.length);
  // 디버그 배너 업데이트
  var _db2 = document.getElementById('debug-banner');
  if(_db2) {
    var _ml2 = document.getElementById('library-master-list');
    _db2.textContent = '🚀 init() 실행 | cache=' + (masterItemsCache?.length||0) + ' | DOM=' + (_ml2?_ml2.children.length:'?');
    _db2.style.background = '#eef';
    _db2.style.borderColor = '#88f';
    _db2.style.color = '#008';
  }
  // 초기 데이터로 즉시 렌더링 (API 호출 없이)
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'none';

  // 헤더에 실제 계정 이름 표시 (이메일은 메인이름으로 사용하지 않음)
  // '내 치과'는 기본값이므로 의미있는 이름이 아님 → 폴백 계속 진행
  var effectiveName = (clinicName && clinicName !== '내 치과') ? clinicName : '';
  var defaultName = INITIAL_DATA.isSuperAdmin ? '관리자' : '내 치과';
  var displayName = effectiveName || memberDisplayName || defaultName;
  document.getElementById('clinic-name-text').textContent = displayName;
  if (INITIAL_DATA.isOwnerAdmin) {
    document.getElementById('clinic-name-text').style.cursor = 'default';
    document.getElementById('clinic-name-text').onclick = null;
  }

  // 서브타이틀: 역할 + 이메일 (항상 표시)
  var subtitle = document.getElementById('clinic-subtitle');
  if (subtitle) {
    var role = INITIAL_DATA.isSuperAdmin ? '최고관리자' : (INITIAL_DATA.isOwnerAdmin ? '관리자' : '대기실 TV 관리자');
    var email = INITIAL_DATA.userEmail || '';
    var parts = [role];
    if (email) parts.push(email);
    if (memberDisplayName && displayName !== memberDisplayName) parts.push(memberDisplayName);
    subtitle.textContent = parts.join(' · ');
  }
  
  // 최고관리자 탭 표시
  if (INITIAL_DATA.isSuperAdmin) {
    const adminTab = document.getElementById('tab-admin');
    if (adminTab) adminTab.style.display = 'inline-block';
  }
  
  // 이미 로드된 데이터로 즉시 렌더링
  renderPlaylists();
  renderNotices();
  checkMasterLoginStatus();
  
  // 캐시에 현재 데이터 저장
  saveToCache({ playlists, notices, clinicName });
  
  // 즉시 API에서 최신 플레이리스트 로드 (SSR 시점의 is_tv_active가 stale할 수 있으므로)
  loadPlaylists();
  
  // 백그라운드에서 최신 masterItems API 로드 (INITIAL_DATA 덮어쓰기)
  fetch('/api/master/items?ts=' + Date.now(), { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      masterItems = data.items || [];
      cachedMasterItems = masterItems;
      masterItemsCache = masterItems;
      console.log('[DentalTV] masterItems refreshed from API:', masterItems.length);
    })
    .catch(function(e) { console.error('[DentalTV] masterItems API error:', e); });
  
  // 설정은 백그라운드에서 로드 (UI 업데이트용)
  loadNoticeSettings();
  setupAutoHeight();
  
  console.log('[DentalTV] init done in', Math.round(performance.now() - t0), 'ms');
  
  // 부모 iframe에 콘텐츠 준비 완료 알림 (init 완료)
  try{if(window.parent!==window)window.parent.postMessage({type:'contentReady'},'*');}catch(e){}
  
  // 5초마다 플레이리스트 자동 갱신 (사용중 상태 실시간 반영)
  // 편집 모달이 열려있을 때는 갱신 skip (덮어쓰기 방지)
  setInterval(async () => {
    const editModal = document.getElementById('edit-playlist-modal');
    // 편집 모달이 보이면 (display가 none이 아니거나, dtv-pg의 자식이면) skip
    if (editModal && (editModal.style.display !== 'none' && editModal.style.display !== '')) return;
    if (currentPlaylist) return; // 편집 중이면 skip
    await loadPlaylists();
    saveToCache({ playlists, notices, clinicName });
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

// 안전장치: 3초 후에도 공용 영상이 비어있으면 API에서만 로드 (캐시 복원 금지)
// masterItemsCache/INITIAL_DATA에서 복원하면 삭제된 데이터가 유령처럼 남는 문제 발생
[3000, 8000].forEach(function(delay) {
  setTimeout(function() {
    var sec = document.getElementById('library-master-section');
    var list = document.getElementById('library-master-list');
    var modal = document.getElementById('edit-playlist-modal');
    if (!sec || !list || !modal || modal.style.display !== 'block') return;
    if (list.children.length > 0) return; // 이미 렌더링됨
    
    // 섹션이 숨겨져 있으면 표시
    sec.classList.remove('hidden');
    sec.style.display = '';
    
    // API에서만 로드 (캐시/INITIAL_DATA 복원 금지 - 삭제된 데이터 유령 방지)
    fetch(window.location.origin + '/api/master/items', { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var items = data.items || [];
        masterItemsCache = items;
        cachedMasterItems = items;
        masterItems = items;
        var filteredForFailsafe = filterMasterItemsByPlaylist(items);
        if (filteredForFailsafe.length > 0 && list.children.length === 0) {
          list.innerHTML = filteredForFailsafe.map(function(item) {
            return '<div class="flex items-center gap-2 p-2 bg-purple-100 rounded cursor-pointer hover:bg-purple-200 transition" data-library-id="' + item.id + '" data-library-master="1" onclick="addToPlaylistFromLibrary(' + item.id + ')">' +
              '<div class="w-16 h-10 bg-purple-200 rounded overflow-hidden flex-shrink-0">' +
              (item.thumbnail_url ? '<img src="' + item.thumbnail_url + '" class="w-full h-full object-cover">' : '<div class="w-full h-full flex items-center justify-center"><i class="fab fa-vimeo text-purple-400"></i></div>') +
              '</div><div class="flex-1 min-w-0"><p class="text-xs font-medium text-purple-800 truncate">' + (item.title || '') + '</p><p class="text-xs text-purple-500">' + getMasterTargetBadge(item) + '</p></div><i class="fas fa-plus text-purple-400"></i></div>';
          }).join('');
          console.log('[Library] Failsafe ' + delay + 'ms: rendered', filteredForFailsafe.length, 'from API (filtered)');
        } else if (items.length === 0) {
          // 서버에 공용 영상이 없어도 섹션은 유지 (빈 상태 메시지)
          sec.style.display = '';
          list.innerHTML = '<div class="text-xs text-gray-400 text-center py-3"><i class="fas fa-info-circle mr-1"></i>공용 영상이 없습니다.<br>마스터 관리에서 추가해주세요.</div>';
          console.log('[Library] Failsafe ' + delay + 'ms: no master items, showing empty message');
        }
      }).catch(function(e) {
        console.error('[Library] Failsafe ' + delay + 'ms: API error', e);
      });
  }, delay);
});
// 디버그: hash에 auto-open-{id}가 있으면 자동으로 편집창 열기
try {
  const hash = window.location.hash;
  const autoMatch = hash.match(/auto-open-(\d+)/);
  if (autoMatch) {
    const autoId = parseInt(autoMatch[1]);
    setTimeout(() => { openPlaylistEditor(autoId); }, 1500);
  }
} catch(e) {}

// 공용자료 로드 (관리자 페이지용)
async function loadMasterItemsForAdmin() {
  try {
    const res = await fetch('/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    masterItems = data.items || [];
    cachedMasterItems = masterItems;
    masterItemsCache = masterItems;
  } catch (e) {
    console.error('Load master items error:', e);
    masterItems = [];
    cachedMasterItems = [];
    masterItemsCache = [];
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

// 스타일 패널 접기/펼치기
function toggleNoticeStylePanel() {
  var body = document.getElementById('notice-style-body');
  var chevron = document.getElementById('notice-style-chevron');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    body.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
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

var _currentTab = 'waitingrooms';

function showTab(tab) {
  var isTabChanged = (_currentTab !== tab);
  _currentTab = tab;
  
  // ── 탭 전환 시 열려있는 플레이리스트 에디터 닫기 ──
  var editModal = document.getElementById('edit-playlist-modal');
  if (editModal && editModal.style.display !== 'none' && editModal.style.display !== '') {
    // 인라인 편집 패널이 열려있으면 닫기
    editModal.style.cssText = 'display:none;';
    currentPlaylist = null;
    if (masterItemsRefreshTimer) {
      clearInterval(masterItemsRefreshTimer);
      masterItemsRefreshTimer = null;
    }
    _openModalSet.delete('edit-playlist-modal');
    // _prevDisplay 정리
    var mainContent = document.getElementById('dtv-pg');
    if (mainContent) {
      mainContent.querySelectorAll(':scope > div[id^="content-"]').forEach(function(tc) {
        if (tc._prevDisplay !== undefined) delete tc._prevDisplay;
      });
    }
  }

  // ── 다른 탭으로 전환될 때만 아코디언 닫기 ──
  if (isTabChanged) {
    var wc = document.getElementById('wr-setup-content');
    var wi = document.getElementById('wr-setup-toggle-icon');
    if (wc) wc.style.display = 'none';
    if (wi) { wi.classList.remove('fa-chevron-up'); wi.classList.add('fa-chevron-down'); }
    var cc = document.getElementById('ch-setup-content');
    var ci = document.getElementById('ch-setup-toggle-icon');
    if (cc) cc.style.display = 'none';
    if (ci) { ci.classList.remove('fa-chevron-up'); ci.classList.add('fa-chevron-down'); }
  }

  ['waitingrooms', 'chairs', 'notices', 'settings', 'admin', 'master'].forEach(t => {
    const content = document.getElementById('content-' + t);
    const tabBtn = document.getElementById('tab-' + t);
    if (content) content.style.display = (t === tab) ? '' : 'none';
    if (tabBtn) {
      const isActive = (t === tab);
      tabBtn.style.color = isActive ? '#2563eb' : '#6b7280';
      tabBtn.style.fontWeight = isActive ? '700' : '500';
      tabBtn.style.borderBottomColor = isActive ? '#2563eb' : 'transparent';
    }
  });
  if (tab === 'admin') {
    if (!_adminLoaded) {
      _adminLoaded = true;
      _adminSubTab = 'push';
      loadMasterItemsForAdmin();
    }
    showAdminSubTab(_adminSubTab || 'push');
  }
  if (tab === 'settings') initSettingsTab();
  // 자막 관리는 관리 탭 서브탭으로 통합됨
  if (typeof postParentHeight === 'function') setTimeout(postParentHeight, 100);
}

// ============================================
// 자막 관리 기능 (일반 관리자 페이지)
// ============================================

function extractVimeoIdFromUrl(input) {
  if (!input) return null;
  input = input.trim();
  if (/^\d+$/.test(input)) return input;
  const m = input.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

async function loadSubtitlesAdmin() {
  try {
    const res = await fetch(API_BASE + '/subtitles');
    const data = await res.json();
    const subs = data.subtitles || [];
    document.getElementById('sub-count').textContent = subs.length + '개';
    const container = document.getElementById('sub-list');
    if (subs.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:24px 0;font-size:13px">등록된 자막이 없습니다</p>';
      return;
    }
    container.innerHTML = subs.map(sub => {
      const preview = sub.content.substring(0, 80).replace(/\n/g, ' ');
      return '<div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;margin-bottom:8px">'
        + '<div style="display:flex;justify-content:space-between;align-items:start">'
        + '<div style="flex:1">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
        + '<span style="font-weight:700;color:#7c3aed;font-size:14px">Vimeo: ' + sub.vimeo_id + '</span>'
        + '<span style="background:#dbeafe;color:#2563eb;padding:1px 8px;border-radius:10px;font-size:10px">' + (sub.language || 'ko') + '</span>'
        + '</div>'
        + '<div style="background:#fff;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;font-size:11px;color:#6b7280;font-family:monospace;max-height:40px;overflow:hidden">' + preview + '</div>'
        + '<p style="font-size:10px;color:#9ca3af;margin-top:4px">등록: ' + (sub.created_at || '') + '</p>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px;margin-left:8px">'
        + '<button onclick="editSubAdmin(' + sub.id + ',\'' + sub.vimeo_id + '\')" style="padding:6px 12px;border-radius:6px;border:none;background:#7c3aed;color:#fff;font-size:11px;cursor:pointer;font-family:inherit"><i class="fas fa-edit" style="margin-right:2px"></i>수정</button>'
        + '<button onclick="deleteSubAdmin(' + sub.id + ')" style="padding:6px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:11px;cursor:pointer;font-family:inherit"><i class="fas fa-trash" style="margin-right:2px"></i>삭제</button>'
        + '</div></div></div>';
    }).join('');
  } catch (e) {
    console.error('자막 로드 에러:', e);
  }
}

async function saveSubAdmin() {
  const vimeoInput = document.getElementById('sub-vimeo-id').value.trim();
  const content = document.getElementById('sub-content').value.trim();
  const vimeoId = extractVimeoIdFromUrl(vimeoInput);
  if (!vimeoId) { alert('올바른 Vimeo URL 또는 ID를 입력해주세요.'); return; }
  if (!content) { alert('자막 내용을 입력해주세요.'); return; }
  try {
    const res = await fetch(API_BASE + '/subtitles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vimeo_id: vimeoId, content, id: _editingSubId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(_editingSubId ? '자막이 수정되었습니다.' : '자막이 추가되었습니다.');
      clearSubForm();
      loadSubtitlesAdmin();
    } else { alert(data.error || '저장 실패'); }
  } catch (e) { alert('저장 실패'); }
}

async function editSubAdmin(id, vimeoId) {
  try {
    const res = await fetch('/api/subtitles/' + vimeoId);
    const data = await res.json();
    if (data.subtitle) {
      _editingSubId = id;
      document.getElementById('sub-vimeo-id').value = vimeoId;
      document.getElementById('sub-vimeo-id').readOnly = true;
      document.getElementById('sub-vimeo-id').style.background = '#f3f4f6';
      document.getElementById('sub-content').value = data.subtitle.content;
      document.getElementById('sub-form-title').innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#f5f3ff;color:#7c3aed;font-size:10px"><i class="fas fa-edit"></i></span> 자막 수정 (Vimeo: ' + vimeoId + ')';
      document.getElementById('sub-save-text').textContent = '수정';
    }
  } catch (e) { alert('자막 로드 실패'); }
}

async function deleteSubAdmin(id) {
  if (!confirm('이 자막을 삭제하시겠습니까?')) return;
  try {
    await fetch(API_BASE + '/subtitles/' + id, { method: 'DELETE' });
    showToast('자막이 삭제되었습니다.');
    loadSubtitlesAdmin();
  } catch (e) { alert('삭제 실패'); }
}

function clearSubForm() {
  _editingSubId = null;
  document.getElementById('sub-vimeo-id').value = '';
  document.getElementById('sub-vimeo-id').readOnly = false;
  document.getElementById('sub-vimeo-id').style.background = '';
  document.getElementById('sub-content').value = '';
  document.getElementById('sub-form-title').innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#f5f3ff;color:#7c3aed;font-size:10px"><i class="fas fa-plus-circle"></i></span> 자막 추가';
  document.getElementById('sub-save-text').textContent = '저장';
}

function handleSubSrtFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('sub-content').value = e.target.result;
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
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
    
    function _isValidThumb(url) {
      if (!url) return false;
      if (url.match(/^https?:\/\/(www\.)?vimeo\.com\/\d+$/)) return false;
      return true;
    }
    
    container.innerHTML = items.map((item, idx) => {
      const hasThumb = _isValidThumb(item.thumbnail_url);
      return `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <span class="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">${idx + 1}</span>
        <div class="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 master-thumb-loading" data-item-id="${item.id}" data-type="${item.item_type}" data-url="${item.url}">
          ${hasThumb ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center bg-blue-100\\' ><i class=\\'fab fa-vimeo text-blue-400 text-xl\\'></i></div>'">` : 
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
    `}).join('');
    
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
  showDeleteConfirm('이 동영상을 삭제하시겠습니까?\n삭제하면 모든 치과에서 즉시 제거됩니다.', async function() {
    try {
      await fetch(MASTER_API + '/items/' + itemId, { method: 'DELETE' });
      showToast('삭제되었습니다.');
      loadMasterItems();
    } catch (e) {
      console.error(e);
      showToast('삭제 실패', 'error');
    }
  });
}

async function loadPlaylists() {
  try {
    const res = await fetch(API_BASE + '/playlists');
    const data = await res.json();
    playlists = data.playlists || [];
    clinicName = data.clinic_name || '';
    var effectiveUpdated = (clinicName && clinicName !== '내 치과') ? clinicName : '';
    var updatedDefaultName = INITIAL_DATA.isSuperAdmin ? '관리자' : '내 치과';
    var updatedDisplay = effectiveUpdated || memberDisplayName || updatedDefaultName;
    document.getElementById('clinic-name-text').textContent = updatedDisplay;
    renderPlaylists();
  } catch (e) {
    console.error('Load playlists error:', e);
  }
}

function renderPlaylists() {
  const wrContainer = document.getElementById('waitingrooms-container');
  const chContainer = document.getElementById('chairs-container');
  const wrSetup = document.getElementById('waitingroom-setup-section');
  const chSetup = document.getElementById('chair-setup-section');
  
  // TV 연결 설정 토글 상태 미리 저장 (innerHTML 교체 전)
  const wrSetupContent = document.getElementById('wr-setup-content');
  const chSetupContent = document.getElementById('ch-setup-content');
  var wrSetupOpen = wrSetupContent && wrSetupContent.style.display === 'block';
  var chSetupOpen = chSetupContent && chSetupContent.style.display === 'block';
  
  // 편집 패널 닫기 플래그 → 강제로 닫기
  if (window._forceCloseSetupSections) {
    wrSetupOpen = false;
    chSetupOpen = false;
    window._forceCloseSetupSections = false;
  }
  
  // 체크박스 선택 상태 미리 저장 (innerHTML 교체 후 복원용)
  const checkedIds = new Set(
    Array.from(document.querySelectorAll('.chair-checkbox:checked'))
      .map(cb => cb.dataset.id)
  );
  
  // =========================================================
  // 체어와 대기실 분리
  // =========================================================
  const chairs = playlists
    .filter(p => p.name.includes('체어'))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  const waitingRooms = playlists
    .filter(p => !p.name.includes('체어'))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  
  // 카운트 배지 업데이트
  const wrBadge = document.getElementById('waitingroom-count-badge');
  const chBadge = document.getElementById('chair-count-badge');
  if (wrBadge) wrBadge.textContent = waitingRooms.length + '개';
  if (chBadge) chBadge.textContent = chairs.length + '개';
  
  // =========================================================
  // 대기실 탭 렌더링
  // =========================================================
  if (wrContainer) {
    if (waitingRooms.length === 0) {
      wrContainer.innerHTML = `
        <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;text-align:center">
          <i class="fas fa-couch" style="font-size:32px;color:#d1d5db;margin-bottom:12px;display:block"></i>
          <p style="font-size:14px;color:#6b7280;margin:0 0 12px">등록된 대기실이 없습니다.</p>
          <button onclick="showCreatePlaylistModal('waitingroom')" style="padding:8px 20px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
            <i class="fas fa-plus" style="margin-right:6px"></i>대기실 추가
          </button>
        </div>
      `;
    } else {
      wrContainer.innerHTML = `
      <div id="waitingroom-sortable-container" style="display:grid;gap:10px">
        ${waitingRooms.map((p, idx) => {
          const isActive = !!(p.is_tv_active);
          const neverConnected = !p.last_active_at && !p.external_short_url;
          const isOffline = !isActive && !neverConnected && (p.last_active_at || p.external_short_url);
          return `
        <div class="playlist-sortable-item" id="playlist-card-main-${p.id}" data-playlist-id="${p.id}" draggable="true"
             style="background:#fff;border-radius:12px;border:1px solid ${isActive ? '#bbf7d0' : '#e5e7eb'};overflow:hidden;cursor:move;box-shadow:0 1px 3px rgba(0,0,0,.04);transition:border-color .2s,box-shadow .2s"
             onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,.04)'">
          <div style="padding:14px 16px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div class="drag-handle" style="width:20px;display:flex;align-items:center;justify-content:center;color:#d1d5db;cursor:grab;flex-shrink:0">
                <i class="fas fa-grip-vertical"></i>
              </div>
              <div style="width:36px;height:36px;border-radius:10px;background:${isActive ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#3b82f6,#2563eb)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative">
                <i class="fas fa-couch" style="color:#fff;font-size:14px"></i>
                ${isActive ? '<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #fff" class="animate-pulse"></span>' : ''}
              </div>
              <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="font-size:14px;font-weight:700;color:#1f2937">${p.name}</span>
                  ${isActive ? '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#15803d;font-size:10px;font-weight:700">● 사용중</span>' : ''}
                  ${isOffline ? '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb);color:#6b7280;font-size:10px;font-weight:700">● 오프라인</span>' : ''}
                  ${neverConnected ? '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;font-size:10px;font-weight:700">체어 설정 필요</span>' : ''}
                </div>
                <p style="font-size:11px;color:#9ca3af;margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  <span style="color:#2563eb;font-family:monospace;font-size:10px">${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}</span>
                  <span style="margin:0 6px;color:#d1d5db">·</span>
                  ${p.item_count || 0}개 미디어
                </p>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;padding-left:30px">
              <button onclick="openPlaylistEditor(${p.id})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                플레이리스트
              </button>
              <button onclick="openTVMirror('${p.short_code}', ${p.item_count || 0})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                TV로 내보내기
              </button>
              <button onclick="copyToClipboard('${p.external_short_url || location.origin + '/' + p.short_code}'); markSingleChairSetup(${p.id})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                URL 복사
              </button>
              ${isActive ? `
              <button disabled
                style="padding:5px 8px;border:none;background:none;color:#e5e7eb;cursor:not-allowed;font-size:12px" title="사용중인 대기실은 삭제할 수 없습니다">
                <i class="fas fa-trash"></i>
              </button>
              ` : `
              <button onclick="deletePlaylist(${p.id})" 
                style="padding:5px 8px;border:none;background:none;color:#d1d5db;cursor:pointer;font-size:12px;transition:color .15s"
                onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
              `}
            </div>
          </div>
        </div>
        `}).join('')}
      </div>
      `;
    }
  }
  
  // 대기실 초기 설정 (TV 연결)
  if (wrSetup) {
    wrSetup.innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f9fafb">
      <button onclick="toggleWaitingRoomSetup()" style="width:100%;padding:12px 16px;background:#f3f4f6;display:flex;align-items:center;justify-content:space-between;border:none;cursor:pointer;font-family:inherit;transition:background .15s"
        onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
        <span style="font-weight:700;color:#374151;display:flex;align-items:center;gap:8px;font-size:12px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;font-size:10px"><i class="fas fa-cog"></i></span>
          TV 연결 설정
        </span>
        <i id="wr-setup-toggle-icon" class="fas fa-chevron-down" style="color:#9ca3af;font-size:12px"></i>
      </button>
      <div id="wr-setup-content" style="display:none;padding:16px">
        ${waitingRooms.length > 0 ? `
        <div style="display:grid;gap:10px">
          ${waitingRooms.map(p => `
          <div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e5e7eb">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
              <span style="font-size:13px;font-weight:600;color:#1f2937">${p.name}</span>
              <span style="font-size:11px;color:#9ca3af">(${p.item_count || 0}개 미디어)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
              <input type="text" id="setting-url-${p.id}" value="${p.external_short_url ? p.external_short_url.replace('https://', '') : ((location.host.includes('sandbox') || location.host.includes('localhost') ? 'dental-tv.pages.dev' : location.host) + '/' + p.short_code)}" 
                style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:12px;color:#374151;font-family:monospace" readonly>
              <button onclick="copySettingUrl(${p.id})" 
                style="padding:8px 14px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#6b7280;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s"
                onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'">
                복사
              </button>
              ${!p.external_short_url ? `
              <button id="btn-shorten-${p.id}" onclick="generateShortUrl(${p.id}, '${p.short_code}')" 
                style="padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .15s"
                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                단축 URL 생성
              </button>
              ` : ''}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              <button onclick="showTvExportModal(${p.id}, '${p.name}', '${p.short_code}')"
                style="padding:6px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .15s"
                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                사용법 (URL 직접 입력)
              </button>
            </div>
            <p style="margin:8px 0 0;font-size:11px;color:#2563eb">
              <i class="fas fa-info-circle" style="margin-right:4px"></i>
              USB 인식 문제로 <strong>URL 직접 입력 방식</strong>만 제공합니다.
            </p>
          </div>
          `).join('')}
        </div>
        ` : `
        <div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:13px">
          <i class="fas fa-info-circle" style="margin-right:4px"></i>
          등록된 대기실이 없습니다. 위에서 대기실을 추가하세요.
        </div>
        `}
      </div>
    </div>
    `;
  }
  
  // =========================================================
  // 체어 탭 렌더링
  // =========================================================
  if (chContainer) {
    if (chairs.length === 0) {
      chContainer.innerHTML = `
        <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;text-align:center">
          <i class="fas fa-tv" style="font-size:32px;color:#d1d5db;margin-bottom:12px;display:block"></i>
          <p style="font-size:14px;color:#6b7280;margin:0 0 12px">등록된 체어가 없습니다.</p>
          <button onclick="showCreatePlaylistModal('chair')" style="padding:8px 20px;border-radius:8px;border:none;background:#6366f1;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
            <i class="fas fa-plus" style="margin-right:6px"></i>체어 추가
          </button>
        </div>
      `;
    } else {
      chContainer.innerHTML = `
      <div id="chair-sortable-container" style="display:grid;gap:10px">
        ${chairs.map((p, idx) => {
          const isActive = !!(p.is_tv_active);
          const neverConnected = !p.last_active_at && !p.external_short_url;
          const isOffline = !isActive && !neverConnected && (p.last_active_at || p.external_short_url);
          return `
        <div class="playlist-sortable-item" id="playlist-card-main-${p.id}" data-playlist-id="${p.id}" draggable="true"
             style="background:#fff;border-radius:12px;border:1px solid ${isActive ? '#bbf7d0' : '#c7d2fe'};overflow:hidden;cursor:move;box-shadow:0 1px 3px rgba(0,0,0,.04);transition:border-color .2s,box-shadow .2s"
             onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,.04)'">
          <div style="padding:14px 16px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div class="drag-handle" style="width:20px;display:flex;align-items:center;justify-content:center;color:#d1d5db;cursor:grab;flex-shrink:0">
                <i class="fas fa-grip-vertical"></i>
              </div>
              <div style="width:36px;height:36px;border-radius:10px;background:${isActive ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#6366f1,#818cf8)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative">
                <i class="fas fa-tv" style="color:#fff;font-size:14px"></i>
                ${isActive ? '<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #fff" class="animate-pulse"></span>' : ''}
                <span id="temp-indicator-${p.id}" style="display:${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? 'block' : 'none'};position:absolute;top:-3px;left:-3px;width:10px;height:10px;background:#f97316;border-radius:50%;border:2px solid #fff" class="animate-pulse" title="수동 복귀 설정됨"></span>
              </div>
              <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="font-size:14px;font-weight:700;color:#1f2937">${p.name}</span>
                  ${isActive ? '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#15803d;font-size:10px;font-weight:700">● 사용중</span>' : ''}
                  ${isOffline ? '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb);color:#6b7280;font-size:10px;font-weight:700">● 오프라인</span>' : ''}
                  ${neverConnected ? '<span style="padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;font-size:10px;font-weight:700">체어 설정 필요</span>' : ''}
                </div>
                <p style="font-size:11px;color:#9ca3af;margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  <span style="color:#6366f1;font-family:monospace;font-size:10px">${p.external_short_url ? p.external_short_url.replace('https://', '') : location.host + '/' + p.short_code}</span>
                  <span style="margin:0 6px;color:#d1d5db">·</span>
                  ${p.item_count || 0}개 미디어
                </p>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;padding-left:30px">
              <button onclick="openPlaylistEditor(${p.id})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                플레이리스트
              </button>
              <button onclick="openTVMirror('${p.short_code}', ${p.item_count || 0})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                체어로 내보내기
              </button>
              <button onclick="showTempVideoModal(${p.id}, '${p.name}', '${p.short_code}')" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                임시 영상 전송
              </button>
              <button id="stop-temp-btn-${p.id}" onclick="stopTempVideoForPlaylist(${p.id})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid ${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? '#fecaca' : '#e5e7eb'};background:${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? '#fef2f2' : '#f9fafb'};color:${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? '#dc2626' : '#9ca3af'};font-size:11px;font-weight:${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? '600' : '500'};cursor:${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? 'pointer' : 'not-allowed'};font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap" ${(_tempVideoActiveCache[p.id]?.active && _tempVideoActiveCache[p.id]?.return_time === 'manual') ? '' : 'aria-disabled="true"'}>
                <i class="fas fa-stop"></i>
                <span>기본으로 복귀</span>
              </button>
              <button onclick="copyToClipboard('${p.external_short_url || location.origin + '/' + p.short_code}'); markSingleChairSetup(${p.id})" 
                style="padding:5px 14px;border-radius:8px;border:1px solid #d1d5db;background:linear-gradient(to bottom,#f9fafb,#f3f4f6);color:#374151;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s"
                onmouseover="this.style.background='linear-gradient(to bottom,#dbeafe,#bfdbfe)';this.style.color='#1d4ed8';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='linear-gradient(to bottom,#f9fafb,#f3f4f6)';this.style.color='#374151';this.style.borderColor='#d1d5db'">
                URL 복사
              </button>
              ${isActive ? `
              <button disabled
                style="padding:5px 8px;border:none;background:none;color:#e5e7eb;cursor:not-allowed;font-size:12px" title="사용중인 체어는 삭제할 수 없습니다">
                <i class="fas fa-trash"></i>
              </button>
              ` : `
              <button onclick="deletePlaylist(${p.id})" 
                style="padding:5px 8px;border:none;background:none;color:#d1d5db;cursor:pointer;font-size:12px;transition:color .15s"
                onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'" title="삭제">
                <i class="fas fa-trash"></i>
              </button>
              `}
            </div>
          </div>
        </div>
        `}).join('')}
      </div>
      `;
    }
  }
  
  // 체어 초기 설정 (스크립트 다운로드)
  if (chSetup) {
    chSetup.innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f9fafb">
      <button onclick="toggleChairSetup()" style="width:100%;padding:12px 16px;background:#f3f4f6;display:flex;align-items:center;justify-content:space-between;border:none;cursor:pointer;font-family:inherit;transition:background .15s"
        onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
        <span style="font-weight:700;color:#374151;display:flex;align-items:center;gap:8px;font-size:12px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;font-size:10px"><i class="fas fa-cog"></i></span>
          PC 모니터 설치 설정
        </span>
        <i id="ch-setup-toggle-icon" class="fas fa-chevron-down" style="color:#9ca3af;font-size:12px"></i>
      </button>
      <div id="ch-setup-content" style="display:none;padding:16px">
        ${chairs.length > 0 ? `
        <div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e5e7eb">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            ${chairs.map(p => `
              <label style="display:flex;align-items:center;gap:6px;background:#f9fafb;padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid #e5e7eb;font-size:13px;transition:background .15s"
                onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='#f9fafb'">
                <input type="checkbox" class="chair-checkbox" data-id="${p.id}" data-code="${p.short_code}" data-name="${p.name}" style="accent-color:#6366f1">
                <span style="color:#374151;font-weight:500">${p.name}</span>
                <span style="font-size:11px;color:#9ca3af">(${p.item_count || 0})</span>
                ${!p.last_active_at ? '<span style="padding:2px 6px;border-radius:4px;background:#fee2e2;color:#dc2626;font-size:10px;font-weight:600">미설치</span>' : '<span style="padding:2px 6px;border-radius:4px;background:#dcfce7;color:#16a34a;font-size:10px;font-weight:600">연결됨</span>'}
              </label>
            `).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button onclick="exportSelectedScripts()" style="padding:8px 16px;border-radius:8px;border:none;background:#6b7280;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s"
              onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
              스크립트 다운로드
            </button>
            <button onclick="downloadAutoRunScript(this)" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .15s"
              onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              설치 방법
            </button>
          </div>
        </div>
        ` : `
        <div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:13px">
          <i class="fas fa-info-circle" style="margin-right:4px"></i>
          등록된 체어가 없습니다. 위에서 체어를 추가하세요.
        </div>
        `}
      </div>
    </div>
    `;
  }
  
  // 임시 영상 상태 즉시 복원 (캐시에서 - API 응답 전 깜빡임 방지)
  for (const pId in _tempVideoActiveCache) {
    const cached = _tempVideoActiveCache[pId];
    if (cached && cached.active) {
      const indicator = document.getElementById('temp-indicator-' + pId);
      // 인디케이터는 수동복귀일 때만 표시
      if (indicator) indicator.style.display = cached.return_time === 'manual' ? '' : 'none';
      // return_time이 'manual'일 때만 복귀 버튼 활성화
      setStopButtonState(parseInt(pId), cached.return_time === 'manual');
    }
  }
  
  // 임시 영상 상태 확인
  checkTempVideoStatus();
  
  // 임시 영상 상태 주기적 확인 (5초마다) - 자동복귀 감지용
  if (!window.tempStatusInterval) {
    window.tempStatusInterval = setInterval(checkTempVideoStatus, 5000);
  }
  
  // 체크박스 선택 상태 복원
  if (checkedIds.size > 0) {
    document.querySelectorAll('.chair-checkbox').forEach(cb => {
      if (checkedIds.has(cb.dataset.id)) cb.checked = true;
    });
  }
  
  // TV 연결 설정: innerHTML 교체 후 이전 상태 복원
  if (wrSetupOpen) {
    var wc = document.getElementById('wr-setup-content');
    var wi = document.getElementById('wr-setup-toggle-icon');
    if (wc) wc.style.display = 'block';
    if (wi) { wi.classList.remove('fa-chevron-down'); wi.classList.add('fa-chevron-up'); }
  }
  if (chSetupOpen) {
    var cc = document.getElementById('ch-setup-content');
    var ci = document.getElementById('ch-setup-toggle-icon');
    if (cc) cc.style.display = 'block';
    if (ci) { ci.classList.remove('fa-chevron-down'); ci.classList.add('fa-chevron-up'); }
  }
  
  // 드래그 정렬 초기화
  initPlaylistSortable();
}

// 임시 영상 상태 확인 (배치 API 사용 - 1회 요청으로 모든 playlist 확인)
async function checkTempVideoStatus() {
  try {
    const ids = playlists.map(p => p.id).join(',');
    if (!ids) return;
    const res = await fetch(API_BASE + '/temp-video-batch?ids=' + ids);
    const data = await res.json();
    const statuses = data.statuses || {};
    
    for (const p of playlists) {
      const indicator = document.getElementById('temp-indicator-' + p.id);
      const status = statuses[p.id];
      
      if (status && status.active) {
        const rt = status.return_time || 'end';
        _tempVideoActiveCache[p.id] = { active: true, return_time: rt };
        if (indicator) indicator.style.display = (rt === 'manual') ? '' : 'none';
        setStopButtonState(p.id, rt === 'manual');
      } else {
        _tempVideoActiveCache[p.id] = { active: false, return_time: null };
        if (indicator) indicator.style.display = 'none';
        setStopButtonState(p.id, false);
      }
    }
  } catch (e) {}
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

// 대기실 초기 설정 토글
function toggleWaitingRoomSetup() {
  const content = document.getElementById('wr-setup-content');
  const icon = document.getElementById('wr-setup-toggle-icon');
  if (!content || !icon) return;
  const isHidden = content.style.display === 'none' || content.style.display === '';
  content.style.display = isHidden ? 'block' : 'none';
  icon.classList.toggle('fa-chevron-down', !isHidden);
  icon.classList.toggle('fa-chevron-up', isHidden);
  if (typeof postParentHeight === 'function') { setTimeout(postParentHeight, 50); setTimeout(postParentHeight, 300); }
}

// 체어 초기 설정 토글
function toggleChairSetup() {
  const content = document.getElementById('ch-setup-content');
  const icon = document.getElementById('ch-setup-toggle-icon');
  if (!content || !icon) return;
  const isHidden = content.style.display === 'none' || content.style.display === '';
  content.style.display = isHidden ? 'block' : 'none';
  icon.classList.toggle('fa-chevron-down', !isHidden);
  icon.classList.toggle('fa-chevron-up', isHidden);
  if (typeof postParentHeight === 'function') { setTimeout(postParentHeight, 50); setTimeout(postParentHeight, 300); }
}
// 설정탭 강제 닫기
function closeChairSetup() {
  const content = document.getElementById('ch-setup-content');
  const icon = document.getElementById('ch-setup-toggle-icon');
  if (content) content.style.display = 'none';
  if (icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
  if (typeof postParentHeight === 'function') { setTimeout(postParentHeight, 50); setTimeout(postParentHeight, 300); }
}

// TV 연결 설정 토글 상태 복원 (renderPlaylists 후 호출)
function restoreSetupToggleState(wrOpen, chOpen) {
  // 편집 패널 닫힐 때 설정 섹션도 자동 닫기
  if (window._forceCloseSetupSections) {
    window._forceCloseSetupSections = false;
    return; // 복원하지 않고 닫힌 상태(기본값) 유지
  }
  if (wrOpen) {
    const c = document.getElementById('wr-setup-content');
    const i = document.getElementById('wr-setup-toggle-icon');
    if (c) { c.style.display = 'block'; }
    if (i) { i.classList.remove('fa-chevron-down'); i.classList.add('fa-chevron-up'); }
  }
  if (chOpen) {
    const c = document.getElementById('ch-setup-content');
    const i = document.getElementById('ch-setup-toggle-icon');
    if (c) { c.style.display = 'block'; }
    if (i) { i.classList.remove('fa-chevron-down'); i.classList.add('fa-chevron-up'); }
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
  // 스크립트 전용 표시 (openModal 통합 사용)
  openModal(modal.id);
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
      // 프로덕션 URL 표시 (sandbox URL이 아닌 dental-tv.pages.dev 사용)
      const prodHost = location.host.includes('sandbox') || location.host.includes('localhost') 
        ? 'dental-tv.pages.dev' : location.host;
      document.getElementById('guide-short-url').textContent = prodHost + '/' + shortCode;
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
let _tempVideoIsChair = false; // 현재 임시영상 모달이 체어용인지

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
  _tempVideoIsChair = playlistName && playlistName.includes('체어');
  
  // 복귀 설정 기본값 리셋 (영상 끝나면 복귀)
  document.getElementById('temp-return-time').value = 'end';
  var radios = document.querySelectorAll('input[name="return-type"]');
  radios.forEach(function(r) { r.checked = (r.value === 'end'); });
  
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
    // masterItemsCache로 즉시 렌더링 (API fetch 없이) - target_type 필터링 적용
    const basePlaylist = playlists.find(p => p.id == playlistId);
    const currentItems = (basePlaylist?.items || []);
    const allUserItemsImmediate = [...currentItems];
    const seenUrlsImmediate = new Set(currentItems.map(i => i.url));
    // 다른 플레이리스트의 아이템도 통합
    if (Array.isArray(playlists)) {
      playlists.forEach(function(p) {
        if (String(p.id) === String(playlistId)) return;
        (p.items || []).forEach(function(item) {
          if (!seenUrlsImmediate.has(item.url)) {
            seenUrlsImmediate.add(item.url);
            allUserItemsImmediate.push(item);
          }
        });
      });
    }
    const userItems = allUserItemsImmediate.map(item => ({ ...item, is_master: false }));
    const filteredMasterForTemp = masterItemsCache.filter(function(item) {
      var tt = item.target_type || 'all';
      if (tt === 'all') return true;
      if (_tempVideoIsChair && tt === 'chair') return true;
      if (!_tempVideoIsChair && tt === 'waitingroom') return true;
      return false;
    });
    const masterItemsWithFlag = filteredMasterForTemp.map(item => ({ ...item, is_master: true }));
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

// 플레이리스트 아이템 로드 (공용 + 모든 플레이리스트의 내 영상 통합)
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

    // 공용 영상 (최신 masterItems) - target_type 필터링 적용
    const filteredMasterForTempLoad = (latestMasterItems || []).filter(function(item) {
      var tt = item.target_type || 'all';
      if (tt === 'all') return true;
      if (_tempVideoIsChair && tt === 'chair') return true;
      if (!_tempVideoIsChair && tt === 'waitingroom') return true;
      return false;
    });
    const masterItemsWithFlag = filteredMasterForTempLoad.map(item => ({
      ...item,
      is_master: true
    }));
    
    // 내 영상: 현재 플레이리스트 + 다른 모든 플레이리스트의 아이템을 통합 (중복 URL 제거)
    const currentItems = (data.playlist?.items || []);
    const allUserItems = [...currentItems];
    const seenUrls = new Set(currentItems.map(i => i.url));
    
    // playlists 전역 변수에서 다른 플레이리스트의 아이템도 수집
    if (typeof playlists !== 'undefined' && Array.isArray(playlists)) {
      playlists.forEach(function(p) {
        if (String(p.id) === String(playlistId)) return;
        (p.items || []).forEach(function(item) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            allUserItems.push(item);
          }
        });
      });
    }
    
    const userItems = allUserItems.map(item => ({
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
  const uniqueKey = (item.is_master ? 'm' : 'u') + '-' + item.id;
  
  return `
    <div class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition ${isSelected ? 'bg-indigo-100' : ''}"
      data-temp-key="${uniqueKey}"
      onclick="event.stopPropagation(); selectTempVideoByKey('${uniqueKey}')">
      <input type="radio" name="temp-video-item" ${isSelected ? 'checked' : ''} class="text-indigo-600 flex-shrink-0" style="pointer-events:none">
      <div class="w-10 h-10 ${item.is_master ? 'bg-purple-100' : 'bg-gray-100'} rounded overflow-hidden flex-shrink-0">
        ${item.thumbnail_url 
          ? `<img src="${item.thumbnail_url}" class="w-full h-full object-cover" style="pointer-events:none">`
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

// key로 영상 선택 (JSON inline 제거 - 이스케이프 문제 방지)
function selectTempVideoByKey(key) {
  var parts = key.split('-');
  var isMaster = parts[0] === 'm';
  var itemId = parts.slice(1).join('-');
  var found = tempVideoPlaylistItems.find(function(i) {
    return String(i.id) === itemId && Boolean(i.is_master) === isMaster;
  });
  if (found) selectTempVideoItem(found);
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

  // inline style로 직접 제어 (Tailwind 클래스보다 우선순위 높음)
  if (active) {
    stopBtn.style.background = '#fef2f2';
    stopBtn.style.color = '#dc2626';
    stopBtn.style.borderColor = '#fecaca';
    stopBtn.style.cursor = 'pointer';
    stopBtn.removeAttribute('aria-disabled');
    stopBtn.removeAttribute('disabled');
    stopBtn.onclick = function() { stopTempVideoForPlaylist(playlistId); };
    stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>기본으로 복귀</span>';
  } else {
    stopBtn.style.background = '#f9fafb';
    stopBtn.style.color = '#9ca3af';
    stopBtn.style.borderColor = '#e5e7eb';
    stopBtn.style.cursor = 'not-allowed';
    stopBtn.setAttribute('aria-disabled', 'true');
    stopBtn.onclick = null;
    stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>기본으로 복귀</span>';
  }
}

async function sendTempVideo() {
  console.log('[sendTempVideo] called');
  const playlistId = document.getElementById('temp-video-playlist-id').value;
  const shortCode = document.getElementById('temp-video-short-code').value;
  const urlInput = document.getElementById('temp-video-url').value.trim();
  const returnTime = document.getElementById('temp-return-time').value;
  
  console.log('[sendTempVideo] playlistId:', playlistId, 'shortCode:', shortCode, 'returnTime:', returnTime);
  
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
    console.warn('[sendTempVideo] No video selected or URL entered');
    showToast('영상을 선택하거나 URL을 입력해주세요', 'error');
    return;
  }
  
  console.log('[sendTempVideo] sending:', { url: videoUrl, title: videoTitle, type: videoType, return_time: returnTime });
  
  // 전송 버튼 비활성화 (중복 전송 방지)
  const sendBtn = document.querySelector('#temp-video-modal button[onclick="sendTempVideo()"]');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>전송 중...';
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
    
    console.log('[sendTempVideo] response status:', res.status);
    
    if (res.ok) {
      closeModal('temp-video-modal');
      // 캐시 업데이트
      _tempVideoActiveCache[playlistId] = { active: true, return_time: returnTime };
      // 상태 업데이트: 전송 직후 인디케이터와 복귀 버튼 항상 활성화 (전송 확인 피드백)
      const indicator = document.getElementById('temp-indicator-' + playlistId);
      if (indicator) indicator.style.display = '';
      setStopButtonState(playlistId, true);
      
      // return_time이 'end'이면 일정 시간 후 자동으로 비활성화 (영상 끝나면 서버에서 해제됨)
      if (returnTime === 'end') {
        setTimeout(function() { checkTempVideoStatus(); }, 15000); // 15초 후 상태 재확인
      }
      
      // 전송 성공 후 서버 확인 (TV에 반영되었는지 검증)
      try {
        const verifyRes = await fetch(API_BASE + '/playlists/' + playlistId + '/temp-video');
        const verifyData = await verifyRes.json();
        if (verifyData.active) {
          showToast('✅ 임시 영상이 전송되었습니다! (TV에 약 10초 내 반영)');
          console.log('[sendTempVideo] verified on server:', verifyData);
        } else {
          showToast('⚠️ 전송 요청은 성공했지만 서버에서 확인되지 않았습니다. 다시 시도해주세요.', 'error');
          console.warn('[sendTempVideo] not verified on server:', verifyData);
        }
      } catch (verifyErr) {
        // 검증 실패해도 전송 자체는 성공했으므로 성공 토스트
        showToast('✅ 임시 영상이 전송되었습니다!');
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error || ('전송 실패 (HTTP ' + res.status + ')');
      console.error('[sendTempVideo] error:', res.status, errData);
      showToast(errMsg, 'error');
    }
  } catch (e) {
    console.error('[sendTempVideo] exception:', e);
    showToast('전송 실패: ' + (e.message || '네트워크 오류'), 'error');
  } finally {
    // 전송 버튼 복원
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>전송';
    }
  }
}

// 임시 영상 중지 (기본으로 복귀) - 모달 내부용
async function stopTempVideo() {
  const playlistId = document.getElementById('temp-video-playlist-id').value;
  await stopTempVideoForPlaylist(playlistId);
  // 복귀 후 모달 자동 닫기
  closeModal('temp-video-modal');
}

// 임시 영상 중지 (기본으로 복귀) - 플레이리스트 카드에서 직접 호출
async function stopTempVideoForPlaylist(playlistId) {
  const stopBtn = document.getElementById('stop-temp-btn-' + playlistId);
  if (stopBtn?.getAttribute('aria-disabled') === 'true') return;

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
      // 캐시 업데이트
      _tempVideoActiveCache[playlistId] = { active: false, return_time: null };
      // 인디케이터 숨기기
      const indicator = document.getElementById('temp-indicator-' + playlistId);
      if (indicator) indicator.style.display = 'none';
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

function showCreatePlaylistModal(presetType) {
  // 모든 단계 초기화
  document.getElementById('create-step-1').classList.remove('hidden');
  document.getElementById('create-step-waiting').classList.add('hidden');
  document.getElementById('create-step-chair').classList.add('hidden');
  document.getElementById('new-waiting-name').value = '';
  document.getElementById('new-chair-name').value = '';
  openModal('create-playlist-modal');
  // 프리셋 타입이 있으면 바로 해당 단계로
  if (presetType === 'waitingroom') {
    selectCreateType('waiting');
  } else if (presetType === 'chair') {
    selectCreateType('chair');
  }
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
      
      // 모달 자동 닫기 + 플레이리스트 새로고침 (배지 업데이트)
      closeModal('guide-url-modal');
      loadPlaylists();
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
  
  // 사용중(TV 활성) 플레이리스트 삭제 차단
  const targetPlaylist = playlists.find(p => p.id === id || p.id === Number(id));
  if (targetPlaylist && !!(targetPlaylist.is_tv_active)) {
    showToast('사용중인 대기실/체어는 삭제할 수 없습니다. TV 연결을 해제한 후 삭제해주세요.', 'error');
    return;
  }
  
  showDeleteConfirm('이 대기실/체어를 삭제하시겠습니까?', async function() {
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
  });
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
  console.log('[Editor] openPlaylistEditor id:', id, 'masterItemsCache:', masterItemsCache?.length, 'masterItems:', masterItems?.length);
  // 디버그 배너 업데이트
  var _db3 = document.getElementById('debug-banner');
  if(_db3) {
    var _ml3 = document.getElementById('library-master-list');
    _db3.textContent = '📝 편집기 열림 | cache=' + (masterItemsCache?.length||0) + ' | DOM=' + (_ml3?_ml3.children.length:'?') + ' | id=' + id;
  }
  
  // ── 인라인 편집 모드: 대시보드 구조(헤더/탭) 유지, 콘텐츠 영역만 교체 ──
  var editModal = document.getElementById('edit-playlist-modal');
  var mainContent = document.getElementById('dtv-pg');
  if (!editModal || !mainContent) { isOpeningEditor = false; return; }
  
  // 현재 탭 콘텐츠 숨기기
  var tabContents = mainContent.querySelectorAll(':scope > div[id^="content-"]');
  tabContents.forEach(function(el) { el._prevDisplay = el.style.display; el.style.display = 'none'; });
  
  // edit-playlist-modal을 main 콘텐츠 안으로 이동 & 인라인 표시
  if (editModal.parentElement !== mainContent) {
    mainContent.appendChild(editModal);
  }
  // fixed/모달 스타일 제거 → 인라인(일반 블록) 표시
  editModal.style.cssText = 'display:block; position:relative; width:100%; z-index:auto;';
  editModal.className = '';  // fixed, inset-0 등 Tailwind 클래스 제거
  
  // 내부 backdrop 숨기기 (인라인에서는 불필요)
  var backdrop = editModal.querySelector('.modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
  
  // 내부 wrapper를 일반 블록으로 변경
  var innerWrapper = editModal.querySelector('.absolute.inset-0.flex');
  if (innerWrapper) {
    innerWrapper.style.cssText = 'position:relative; display:block; pointer-events:auto;';
    innerWrapper.className = '';
  }
  
  // 내부 컨텐츠 박스 (max-height/height 조정)
  var contentBox = editModal.querySelector('.bg-white.rounded-xl');
  if (contentBox) {
    contentBox.style.cssText = 'width:100%; max-height:none; height:auto; overflow:visible; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,.08); border:1px solid #e5e7eb;';
  }
  
  // 2칸 레이아웃 높이 조정 (화면에 맞게)
  var flexContainer = editModal.querySelector('.flex.flex-1.overflow-hidden');
  if (flexContainer) {
    flexContainer.style.cssText = 'display:flex; overflow:hidden; height:70vh; min-height:400px;';
  }
  
  // 스크롤 위치 초기화
  window.scrollTo({ top: 0, behavior: 'smooth' });
  var dashboard = document.getElementById('dashboard');
  if (dashboard) dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // body scroll 잠금 하지 않음 (인라인이므로)
  
  // 바탕(배경) 클릭 시 편집기 닫기
  if (!mainContent._editorBackdropHandler) {
    mainContent._editorBackdropHandler = function(e) {
      // dtv-pg 자체를 클릭했을 때만 (자식 요소가 아닌 빈 배경 영역)
      if (e.target === mainContent) {
        var em = document.getElementById('edit-playlist-modal');
        if (em && em.style.display !== 'none' && em.style.display !== '') {
          closeModal('edit-playlist-modal');
        }
      }
    };
    mainContent.addEventListener('click', mainContent._editorBackdropHandler);
  }
  
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

  // ★ 이전 대기실 데이터가 보이지 않도록 즉시 컨테이너 비우기
  var _playlistCont = document.getElementById('playlist-items-container');
  if (_playlistCont) _playlistCont.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af"><i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>불러오는 중...</div>';
  var _libMasterList = document.getElementById('library-master-list');
  if (_libMasterList) _libMasterList.innerHTML = '';
  var _libUserList = document.getElementById('library-user-list');
  if (_libUserList) _libUserList.innerHTML = '';

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

  // ── 2단계: API에서 최신 masterItems 로드 (캐시/INITIAL_DATA/DOM 복원 금지) ──
  try {
    const mRes = await fetch('/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
    if (mRes.ok) {
      const mData = await mRes.json();
      masterItemsCache = (mData.items || []).slice();
      cachedMasterItems = masterItemsCache;
      masterItems = masterItemsCache;
      console.log('[Editor] Loaded masterItems from API:', masterItemsCache.length);
    }
  } catch(e) {
    console.log('[Editor] Failed to load masterItems from API:', e);
  }
  
  // ── 2-b단계: 즉시 렌더링 (masterItems 유무와 무관하게 항상 실행) ──
  if (currentPlaylist) {
    playlistEditorSignature = getPlaylistEditorSignature(masterItemsCache || [], currentPlaylist);
    await renderLibraryAndPlaylist();
    ensureMasterLibraryVisible();
    loadPlaylistOrder();
    loadPlaylistSettings().catch(() => {});
    if (typeof startMasterItemsAutoRefresh === 'function') {
      startMasterItemsAutoRefresh();
    }
    // 캐시 업데이트만 (재렌더링 없음)
    fetch(API_BASE + '/playlists/' + id + '?ts=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.playlist) {
          playlistCacheById[id] = data.playlist;
        }
      })
      .catch(() => {});
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

    // ★ 항상 API에서 최신 데이터 가져오기 (캐시 사용 안 함 - 다른 대기실 데이터 방지)
    let fullPlaylist = null;
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

    if (fullPlaylist) {
      // 현재 편집 중인 대기실 ID가 바뀌지 않았는지 확인
      if (currentPlaylist && currentPlaylist.id == id) {
        // ★ 레이스 컨디션 방지: 사용자가 편집 중인 activeItemIds를 항상 보존
        // 백그라운드 fetch 중 사용자가 아이템을 추가/제거했을 수 있으므로
        // 로컬 activeItemIds를 우선시함 (빈 배열도 사용자의 의도적 삭제일 수 있음)
        const savedActiveIds = currentPlaylist.activeItemIds;
        currentPlaylist = fullPlaylist;
        if (Array.isArray(savedActiveIds)) {
          // 로컬에 activeItemIds가 이미 설정되어 있으면 항상 로컬 상태 유지
          currentPlaylist.activeItemIds = savedActiveIds;
        }
        document.getElementById('edit-playlist-title').textContent = (currentPlaylist.name || '재생목록') + ' 편집';
        document.getElementById('transition-effect').value = currentPlaylist.transition_effect || 'fade';
        document.getElementById('transition-duration').value = currentPlaylist.transition_duration || 1000;
        updateDurationLabel();

        // 완전한 데이터로 전체 렌더링
        const newSignature = getPlaylistEditorSignature(masterItemsCache || [], currentPlaylist);
        if (newSignature !== playlistEditorSignature) {
          playlistEditorSignature = newSignature;
          await renderLibraryAndPlaylist();
          ensureMasterLibraryVisible();
          loadPlaylistOrder();
        }
      }
    }

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
    ensureMasterLibraryVisible();
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
    const logoPos = document.getElementById('logo-position');
    if (logoUrl) logoUrl.value = settings.logo_url || '';
    if (logoSize) logoSize.value = settings.logo_size || 150;
    if (logoOpacity) logoOpacity.value = settings.logo_opacity || 90;
    if (logoPos) logoPos.value = settings.logo_position || 'right';
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
    const posEl = document.getElementById('logo-position');
    await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logo_url: document.getElementById('logo-url').value,
        logo_size: parseInt(document.getElementById('logo-size').value),
        logo_opacity: parseInt(document.getElementById('logo-opacity').value),
        logo_position: posEl ? posEl.value : 'right'
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

// 활성 아이템 목록 서버에 저장 (공용 영상 포함 모든 ID 저장, 실패 시 자동 재시도)
let _saveActiveItemsPending = false;
async function saveActiveItems(retryCount = 0) {
  // 모든 activeItemIds를 그대로 저장 (공용/사용자 모두 포함)
  const allItemIds = [...(currentPlaylist.activeItemIds || [])]; // 스냅샷 저장
  const playlistId = currentPlaylist.id;
  
  console.log('[Playlist] Saving active items for playlist', playlistId, ':', JSON.stringify(allItemIds), retryCount > 0 ? '(retry ' + retryCount + ')' : '');
  _saveActiveItemsPending = true;
  
  try {
    const res = await fetch(API_BASE + '/playlists/' + playlistId + '/active-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeItemIds: allItemIds })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Playlist] Failed to save active items:', res.status, errText);
      // 자동 재시도 (최대 2회)
      if (retryCount < 2) {
        console.log('[Playlist] Auto-retrying save... (' + (retryCount + 1) + '/2)');
        await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
        return saveActiveItems(retryCount + 1);
      }
      showToast('저장 실패 (서버 오류). 다시 시도해주세요.', 'error');
      return false;
    }

    console.log('[Playlist] Active items saved successfully:', allItemIds);
    
    // 저장 후 DB 상태 검증
    try {
      const verifyRes = await fetch(API_BASE + '/playlists/' + playlistId + '?ts=' + Date.now());
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        const savedIds = verifyData.playlist?.activeItemIds || [];
        const match = JSON.stringify(allItemIds.map(Number)) === JSON.stringify(savedIds.map(Number));
        if (!match) {
          console.warn('[Playlist] MISMATCH! sent:', allItemIds, 'saved:', savedIds);
          // 불일치 시 한 번 더 저장 시도
          if (retryCount < 2) {
            console.log('[Playlist] Mismatch detected, re-saving...');
            return saveActiveItems(retryCount + 1);
          }
          showToast('경고: 저장 데이터 불일치. 페이지를 새로고침해주세요.', 'error');
        }
      }
    } catch(e) {
      // 검증 실패는 무시 (저장 자체는 성공)
    }
    
    return true;
  } catch (e) {
    console.error('[Playlist] Failed to save active items (network):', e);
    // 네트워크 오류 시 재시도
    if (retryCount < 2) {
      console.log('[Playlist] Network error, auto-retrying... (' + (retryCount + 1) + '/2)');
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
      return saveActiveItems(retryCount + 1);
    }
    showToast('저장 실패 (네트워크 오류). 인터넷 연결을 확인해주세요.', 'error');
    return false;
  } finally {
    _saveActiveItemsPending = false;
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

// 공용 영상 target_type 필터링 (대기실/체어 구분)
function filterMasterItemsByPlaylist(items) {
  if (!items || !currentPlaylist) return items || [];
  var isChair = currentPlaylist.name && currentPlaylist.name.includes('체어');
  return items.filter(function(item) {
    var tt = item.target_type || 'all';
    if (tt === 'all') return true;
    if (isChair && tt === 'chair') return true;
    if (!isChair && tt === 'waitingroom') return true;
    return false;
  });
}

function getMasterTargetBadge(item) {
  var tt = item.target_type || 'all';
  if (tt === 'waitingroom') return '<span style="font-size:9px;padding:0px 4px;background:#dbeafe;color:#1d4ed8;border-radius:3px;font-weight:600">대기실</span>';
  if (tt === 'chair') return '<span style="font-size:9px;padding:0px 4px;background:#ede9fe;color:#7c3aed;border-radius:3px;font-weight:600">체어</span>';
  return '<span style="font-size:9px;padding:0px 4px;background:#ecfdf5;color:#059669;border-radius:3px;font-weight:600">공통</span>';
}

// 공용 영상 라이브러리 표시/숨기기 (API 결과 기반)
function ensureMasterLibraryVisible() {
  const section = document.getElementById('library-master-section');
  const list = document.getElementById('library-master-list');
  if (!section) return;
  
  // masterItemsCache가 서버에서 로드된 최신 데이터
  var filteredMaster = filterMasterItemsByPlaylist(masterItemsCache);
  if (filteredMaster && filteredMaster.length > 0) {
    section.classList.remove('hidden');
    section.style.display = '';
    if (section.style.visibility === 'hidden') section.style.visibility = '';
    
    if (list && (!list.innerHTML || list.innerHTML.trim() === '' || list.children.length === 0)) {
      console.log('[Library] Rendering master items:', filteredMaster.length);
      list.innerHTML = filteredMaster.map(item => `
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
            <p class="text-xs text-purple-500">${getMasterTargetBadge(item)}</p>
          </div>
          <i class="fas fa-plus text-purple-400"></i>
        </div>
      `).join('');
      _updateLibraryPlusButtons();
    }
  } else {
    // 공용 영상이 없어도 섹션은 항상 보이게 유지
    section.classList.remove('hidden');
    section.style.display = '';
    if (list) list.innerHTML = '<div class="text-xs text-gray-400 text-center py-3"><i class="fas fa-info-circle mr-1"></i>공용 영상이 없습니다.<br>마스터 관리에서 추가해주세요.</div>';
  }
}

// 라이브러리 전체 렌더 (공용영상 캐시 로드 포함) - 모달 열릴 때 1회만 호출
var _renderCallCount = 0;
async function renderLibraryAndPlaylist() {
  _renderCallCount++;
  var _callNum = _renderCallCount;
  if (!currentPlaylist) return;

  const libraryMasterList = document.getElementById('library-master-list');
  const libraryUserList = document.getElementById('library-user-list');
  const playlistContainer = document.getElementById('playlist-items-container');
  const libraryMasterSection = document.getElementById('library-master-section');
  
  // ★★★ API-first: 항상 서버에서 최신 데이터 가져오기 (캐시/DOM 복원 금지) ★★★
  _dbg('renderLib #' + _callNum + ': API에서 최신 데이터 로드');
  console.log('[Library] renderLibraryAndPlaylist #' + _callNum, 'playlist:', currentPlaylist?.id);
  
  // 서버가 유일한 진실의 원천 - 캐시/INITIAL_DATA/DOM 복원 절대 금지
  try {
    var _apiUrl = '/api/master/items?ts=' + Date.now();
    var res = await fetch(_apiUrl, { cache: 'no-store' });
    if (res.ok) {
      var data = await res.json();
      masterItemsCache = (data.items || []).slice();
      cachedMasterItems = masterItemsCache;
      masterItems = masterItemsCache;
      _dbg('#' + _callNum + ' API: ' + masterItemsCache.length + '개');
    }
  } catch (e) {
    _dbg('#' + _callNum + ' API에러: ' + (e.message || e));
    // API 실패 시에도 캐시 복원 안 함 - 현재 masterItemsCache 유지
  }
  
  const items = currentPlaylist.items || [];
  const activeItemIds = Array.isArray(currentPlaylist.activeItemIds) ? currentPlaylist.activeItemIds : [];
  
  const editModal = document.getElementById('edit-playlist-modal');
  const isEditOpen = editModal && !editModal.classList.contains('hidden');

  
  // 라이브러리: 공용 영상 (target_type 필터링 적용)
  var filteredMasterForLib = filterMasterItemsByPlaylist(masterItemsCache);
  _dbg('렌더링 진입: cache=' + (masterItemsCache ? masterItemsCache.length : 'null') + ', filtered=' + filteredMasterForLib.length);
  if (filteredMasterForLib && filteredMasterForLib.length > 0 && libraryMasterSection) {
    libraryMasterSection.classList.remove('hidden');
    libraryMasterSection.style.display = '';
    _dbg('공용영상 ' + filteredMasterForLib.length + '개 렌더링');
    libraryMasterList.innerHTML = filteredMasterForLib.map(item => `
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
          <p class="text-xs text-purple-500">${getMasterTargetBadge(item)}</p>
        </div>
        <i class="fas fa-plus text-purple-400"></i>
      </div>
    `).join('');
  } else if (libraryMasterSection) {
    // 공용 영상이 없어도 섹션은 항상 보이게 유지 (빈 상태 메시지 표시)
    libraryMasterSection.classList.remove('hidden');
    libraryMasterSection.style.display = '';
    if (libraryMasterList) libraryMasterList.innerHTML = '<div class="text-xs text-gray-400 text-center py-3"><i class="fas fa-info-circle mr-1"></i>공용 영상이 없습니다.<br>마스터 관리에서 추가해주세요.</div>';
    _dbg('공용영상 0개 - 빈 상태 메시지 표시');
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
        <div class="flex-1 min-w-0 cursor-pointer" onclick="addToPlaylistFromLibrary(${item.id})">
          <p class="text-xs font-medium text-gray-800 truncate hover:text-blue-600" title="클릭하여 재생목록에 추가">${item.title || item.url}</p>
          <p class="text-xs text-gray-500">
            ${item.item_type === 'youtube' ? '<i class="fab fa-youtube text-red-500"></i>' : 
              item.item_type === 'vimeo' ? '<i class="fab fa-vimeo text-blue-400"></i>' : 
              '<i class="fas fa-image text-green-400"></i>'}
          </p>
        </div>
        <button onclick="event.stopPropagation(); editItemTitleById(${item.id})" 
                class="text-gray-400 hover:text-blue-500 p-1 opacity-0 group-hover:opacity-100" title="제목 수정">
          <i class="fas fa-pencil-alt text-xs"></i>
        </button>
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
  const activeUserItems = activeItemIds
    .map(id => allItems.find(item => String(item.id) === String(id)))
    .filter(item => item);
  
  let playlistItems = activeUserItems;
  
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
      <div class="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"><i class="fas fa-grip-vertical"></i></div>
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
        ${item.is_master ? '<p class="text-xs text-purple-500">' + getMasterTargetBadge(item) + '</p>' : ''}
      </div>
      <button onclick="removeFromPlaylist('${item.id}')" class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100"><i class="fas fa-times"></i></button>
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
  
  // activeItemIds에서 매칭되는 아이템
  const activeUserItems = activeItemIds
    .map(id => allItems.find(item => String(item.id) === String(id)))
    .filter(item => item);
  
  let playlistItems = activeUserItems;
  
  const countEl = document.getElementById('playlist-count');
  if (countEl) countEl.textContent = playlistItems.length + '개';
  if (playlistItems.length === 0) {
    playlistContainer.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">왼쪽 라이브러리에서 영상을 클릭하여 추가하세요</div>';
    return;
  }
  playlistContainer.innerHTML = playlistItems.map((item, index) => `
    <div class="flex items-center gap-2 p-2 ${item.is_master ? 'bg-purple-50 border border-purple-200' : 'bg-green-50 border border-green-200'} rounded group"
         data-playlist-index="${index}" data-id="${item.id}" data-master="${item.is_master ? 1 : 0}">
      <div class="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"><i class="fas fa-grip-vertical"></i></div>
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
        ${item.is_master ? '<p class="text-xs text-purple-500">' + getMasterTargetBadge(item) + '</p>' : ''}
      </div>
      <button onclick="removeFromPlaylist('${item.id}')" class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100"><i class="fas fa-times"></i></button>
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
  // masterItemsCache는 이미 API에서 로드된 최신 데이터 사용
  const libraryMasterList = document.getElementById('library-master-list');
  const libraryUserList = document.getElementById('library-user-list');
  const libraryMasterSection = document.getElementById('library-master-section');
  const items = currentPlaylist.items || [];

  var filteredMasterForLibOnly = filterMasterItemsByPlaylist(masterItemsCache);
  if (filteredMasterForLibOnly && filteredMasterForLibOnly.length > 0 && libraryMasterSection) {
    libraryMasterSection.classList.remove('hidden');
    libraryMasterSection.style.display = '';
    libraryMasterList.innerHTML = filteredMasterForLibOnly.map(item => `
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
          <p class="text-xs text-purple-500">${getMasterTargetBadge(item)}</p>
        </div>
        <i class="fas fa-plus text-purple-400"></i>
      </div>
    `).join('');
  } else if (libraryMasterSection) {
    // masterItemsCache가 없어도 절대 숨기지 않음 — 섹션 보이게 유지
    libraryMasterSection.classList.remove('hidden');
    libraryMasterSection.style.display = '';
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
        <div class="flex-1 min-w-0 cursor-pointer" onclick="addToPlaylistFromLibrary(${item.id})">
          <p class="text-xs font-medium text-gray-800 truncate hover:text-blue-600" title="클릭하여 재생목록에 추가">${item.title || item.url}</p>
          <p class="text-xs text-gray-500">
            ${item.item_type === 'youtube' ? '<i class="fab fa-youtube text-red-500"></i>' :
              item.item_type === 'vimeo' ? '<i class="fab fa-vimeo text-blue-400"></i>' :
              '<i class="fas fa-image text-green-400"></i>'}
          </p>
        </div>
        <button onclick="event.stopPropagation(); editItemTitleById(${item.id})"
                class="text-gray-400 hover:text-blue-500 p-1 opacity-0 group-hover:opacity-100" title="제목 수정">
          <i class="fas fa-pencil-alt text-xs"></i>
        </button>
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
  ensureMasterLibraryVisible();
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
    
    // 공용 영상 캐시는 유지 (사용자 영상 삭제와 무관)
    // masterItemsCache = null; // 불필요한 재로드 방지
    
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
  
  showDeleteConfirm('URL을 5자리로 단축하시겠습니까?\n기존 URL(' + currentCode + ')은 더 이상 작동하지 않습니다.', async function() {
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
  });
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
      
      // 플레이리스트 새로고침 (배지 업데이트: 체어 설정 필요 → 오프라인)
      loadPlaylists();
      
      // TV 연결 설정 패널 자동 닫기
      var wrSetupContent = document.getElementById('wr-setup-content');
      if (wrSetupContent) wrSetupContent.style.display = 'none';
      var wrToggleIcon = document.getElementById('wr-setup-toggle-icon');
      if (wrToggleIcon) { wrToggleIcon.classList.remove('fa-chevron-up'); wrToggleIcon.classList.add('fa-chevron-down'); }
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
  
  // 4. 배지 상태는 TV 연결 시 자동 갱신됨 (5초 자동 갱신 기준)
  
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
// 스크립트 다운로드 모달 표시 (설치 방법 안내용) - openModal 통합 사용
function showScriptDownloadModal() {
  openModal('script-download-modal');
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
  // 설치 마킹 (체어 설정 필요 배지 제거)
  markChairsSetup(selected);
  // 모달 닫기 + 설정탭 접기
  closeModal('script-download-modal');
  closeChairSetup();
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
  // 설치 마킹 (체어 설정 필요 배지 제거)
  markChairsSetup(selected);
  // 모달 닫기 + 설정탭 접기
  closeModal('script-download-modal');
  closeChairSetup();
}
// 단일 체어 설치 마킹 (URL 복사 등에서 사용)
function markSingleChairSetup(playlistId) {
  markChairsSetup([{id: playlistId}]);
}

// 체어 설치 마킹 (서버에 알려서 '체어 설정 필요' 배지 제거)
function markChairsSetup(chairs) {
  chairs.forEach(c => {
    fetch('/api/' + ADMIN_CODE + '/playlists/' + c.id + '/mark-setup', { method: 'POST' })
      .catch(() => {});
  });
  // UI 즉시 반영: 배지 제거
  chairs.forEach(c => {
    const card = document.getElementById('playlist-card-main-' + c.id);
    if (card) {
      const badges = card.querySelectorAll('span');
      badges.forEach(badge => {
        if (badge.textContent.includes('체어 설정 필요')) {
          badge.textContent = '● 오프라인';
          badge.style.background = 'linear-gradient(135deg,#f3f4f6,#e5e7eb)';
          badge.style.color = '#6b7280';
        }
      });
    }
  });
}

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

// TV 미러링 열기 (새 탭에서 열고, TV 페이지에서 전체화면 자동 처리)
function openTVMirror(shortCode, itemCount) {
  if (!shortCode) {
    alert('TV 코드가 없습니다. 관리자에게 문의하세요.');
    return;
  }
  const url = '/tv/' + shortCode + '?autoplay=1';
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
var currentNoticeSubTab = 'normal'; // 'normal' or 'urgent'

function switchNoticeSubTab(tab) {
  currentNoticeSubTab = tab;
  var normalBtn = document.getElementById('notice-subtab-normal');
  var urgentBtn = document.getElementById('notice-subtab-urgent');
  var normalInfo = document.getElementById('notice-info-normal');
  var urgentInfo = document.getElementById('notice-info-urgent');
  if (tab === 'normal') {
    normalBtn.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:2px solid #2563eb;background:#eff6ff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#2563eb;border-radius:12px;transition:all .15s;box-shadow:0 2px 8px rgba(37,99,235,.15)';
    urgentBtn.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:2px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;color:#9ca3af;border-radius:12px;transition:all .15s';
    normalInfo.style.display = 'flex';
    urgentInfo.style.display = 'none';
  } else {
    normalBtn.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:2px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;color:#9ca3af;border-radius:12px;transition:all .15s';
    urgentBtn.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 12px;border:2px solid #dc2626;background:#fef2f2;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#dc2626;border-radius:12px;transition:all .15s;box-shadow:0 2px 8px rgba(220,38,38,.15)';
    normalInfo.style.display = 'none';
    urgentInfo.style.display = 'flex';
  }
  // 카운트 뱃지 스타일
  var normalCount = document.getElementById('notice-normal-count');
  var urgentCount = document.getElementById('notice-urgent-count');
  normalCount.style.background = tab === 'normal' ? '#2563eb' : '#f3f4f6';
  normalCount.style.color = tab === 'normal' ? '#fff' : '#9ca3af';
  urgentCount.style.background = tab === 'urgent' ? '#dc2626' : '#f3f4f6';
  urgentCount.style.color = tab === 'urgent' ? '#fff' : '#9ca3af';
  renderNotices();
}

function renderNotices() {
  var container = document.getElementById('notices-container');
  
  // 기존 sortable 인스턴스 제거
  if (noticeSortableInstance) {
    noticeSortableInstance.destroy();
    noticeSortableInstance = null;
  }
  
  // 카운트 업데이트
  var normalNotices = notices.filter(function(n) { return !n.is_urgent; });
  var urgentNotices = notices.filter(function(n) { return n.is_urgent === 1; });
  var normalCountEl = document.getElementById('notice-normal-count');
  var urgentCountEl = document.getElementById('notice-urgent-count');
  if (normalCountEl) normalCountEl.textContent = normalNotices.length;
  if (urgentCountEl) urgentCountEl.textContent = urgentNotices.length;
  
  // 현재 서브탭에 맞는 공지만 필터링
  var filtered = currentNoticeSubTab === 'urgent' ? urgentNotices : normalNotices;
  
  if (filtered.length === 0) {
    var emptyIcon = currentNoticeSubTab === 'urgent' ? 'fa-exclamation-triangle' : 'fa-bullhorn';
    var emptyColor = currentNoticeSubTab === 'urgent' ? '#dc2626' : '#6b7280';
    var emptyMsg = currentNoticeSubTab === 'urgent' ? '\uAE34\uAE09\uACF5\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : '\uC77C\uBC18\uACF5\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.';
    var emptyHint = currentNoticeSubTab === 'urgent' ? '\uAE34\uAE09 \uC0C1\uD669 \uC2DC \uAE34\uAE09\uACF5\uC9C0\uB97C \uCD94\uAC00\uD558\uC138\uC694.' : '\uC0C8 \uACF5\uC9C0\uC0AC\uD56D\uC744 \uCD94\uAC00\uD574\uBCF4\uC138\uC694.';
    container.innerHTML = '<div style="text-align:center;padding:32px 0;color:#9ca3af"><i class="fas ' + emptyIcon + '" style="font-size:28px;margin-bottom:10px;display:block;color:#d1d5db"></i><p style="margin:0;font-size:13px;color:' + emptyColor + '">' + emptyMsg + '</p><p style="margin:4px 0 0;font-size:11px;color:#d1d5db">' + emptyHint + '</p></div>';
    return;
  }
  
  var isUrgentTab = currentNoticeSubTab === 'urgent';
  var html = '';
  filtered.forEach(function(n, index) {
    var isActive = n.is_active;
    var borderColor = isUrgentTab ? (isActive ? '#ef4444' : '#fecaca') : (isActive ? '#3b82f6' : '#e5e7eb');
    var bgColor = isUrgentTab ? '#fef2f2' : '#fff';
    var borderSide = isUrgentTab ? '#fecaca' : '#f3f4f6';
    
    html += '<div class="notice-item" data-id="' + n.id + '" style="display:flex;align-items:stretch;gap:0;background:' + bgColor + ';border-radius:10px;border:1px solid ' + borderSide + ';border-left:4px solid ' + borderColor + ';overflow:hidden;transition:all .15s" onmouseover="this.style.boxShadow=\'0 2px 8px rgba(0,0,0,.06)\'" onmouseout="this.style.boxShadow=\'none\'">' +
      '<div class="notice-drag-handle" style="display:flex;align-items:center;padding:0 10px;cursor:grab;color:#d1d5db;font-size:12px;flex-shrink:0"><i class="fas fa-grip-vertical"></i></div>' +
      '<div style="display:flex;align-items:center;padding:12px 4px 12px 0;flex-shrink:0"><span class="notice-number" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:' + (isUrgentTab ? '#fee2e2' : '#f3f4f6') + ';color:' + (isUrgentTab ? '#dc2626' : '#9ca3af') + ';font-size:11px;font-weight:700">' + (index + 1) + '</span></div>' +
      '<div style="flex:1;padding:12px 8px;min-width:0">' +
        '<p style="font-size:13px;color:#1f2937;margin:0;white-space:pre-wrap;word-break:break-all;line-height:1.5">' + (n.content || '') + '</p>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;padding:12px 12px 12px 4px;flex-shrink:0">' +
        '<button onclick="toggleNotice(' + n.id + ',' + (isActive ? '0' : '1') + ')" title="' + (isActive ? '\uC228\uAE30\uAE30' : '\uD45C\uC2DC\uD558\uAE30') + '" style="padding:4px 10px;font-size:10px;border-radius:6px;border:1px solid ' + (isActive ? '#bfdbfe' : '#e5e7eb') + ';cursor:pointer;font-family:inherit;transition:all .15s;background:' + (isActive ? '#dbeafe' : '#f9fafb') + ';color:' + (isActive ? '#1d4ed8' : '#9ca3af') + ';font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:80px">' + (isActive ? '<i class="fas fa-eye" style="font-size:10px"></i>TV \uD45C\uC2DC\uC911' : '<i class="fas fa-eye-slash" style="font-size:10px"></i>\uC228\uAE40') + '</button>' +
        '<button onclick="editNotice(' + n.id + ')" title="\uC218\uC815" style="padding:6px 8px;font-size:11px;background:' + (isUrgentTab ? '#fef2f2' : '#eff6ff') + ';color:' + (isUrgentTab ? '#dc2626' : '#2563eb') + ';border-radius:6px;border:none;cursor:pointer;font-family:inherit;transition:background .15s"><i class="fas fa-pen"></i></button>' +
        '<button onclick="deleteNotice(' + n.id + ')" title="\uC0AD\uC81C" style="padding:6px 8px;font-size:11px;background:#fef2f2;color:#dc2626;border-radius:6px;border:none;cursor:pointer;font-family:inherit;transition:background .15s"><i class="fas fa-trash"></i></button>' +
      '</div>' +
    '</div>';
  });
  
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
  var isUrgentTab = currentNoticeSubTab === 'urgent';
  document.getElementById('notice-modal-title').textContent = isUrgentTab ? '\uC0C8 \uAE34\uAE09\uACF5\uC9C0' : '\uC0C8 \uC77C\uBC18\uACF5\uC9C0';
  document.getElementById('notice-id').value = '';
  document.getElementById('notice-content').value = '';
  document.getElementById('notice-urgent').checked = isUrgentTab;
  updateNoticeModalStyle();
  openModal('notice-modal');
}

function updateNoticeModalStyle() {
  var isUrgent = document.getElementById('notice-urgent').checked;
  var label = document.getElementById('notice-urgent-label');
  var infoDiv = document.getElementById('notice-type-info');
  var icon = document.getElementById('notice-type-icon');
  var text = document.getElementById('notice-type-text');
  var saveBtn = document.getElementById('notice-save-btn');
  if (isUrgent) {
    label.textContent = '\uAE34\uAE09';
    label.style.color = '#dc2626';
    infoDiv.style.background = '#fef2f2';
    infoDiv.style.borderColor = '#fecaca';
    icon.className = 'fas fa-exclamation-triangle text-red-500 text-sm';
    text.textContent = '\uAE34\uAE09\uACF5\uC9C0\uAC00 1\uAC1C\uB77C\uB3C4 \uD65C\uC131\uD654\uB418\uBA74, \uC77C\uBC18 \uACF5\uC9C0 \uB300\uC2E0 \uAE34\uAE09\uACF5\uC9C0\uB9CC TV\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.';
    text.style.color = '#dc2626';
    saveBtn.className = 'flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600';
  } else {
    label.textContent = '\uC77C\uBC18';
    label.style.color = '#6b7280';
    infoDiv.style.background = '#eff6ff';
    infoDiv.style.borderColor = '#dbeafe';
    icon.className = 'fas fa-bullhorn text-blue-500 text-sm';
    text.textContent = '\uC77C\uBC18 \uACF5\uC9C0\uB294 TV \uD558\uB2E8\uC5D0 \uC2A4\uD06C\uB864\uB418\uBA70 \uD45C\uC2DC\uB429\uB2C8\uB2E4.';
    text.style.color = '#2563eb';
    saveBtn.className = 'flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600';
  }
  // 모달 타이틀도 업데이트 (편집 모드가 아닐 때만)
  if (!document.getElementById('notice-id').value) {
    document.getElementById('notice-modal-title').textContent = isUrgent ? '\uC0C8 \uAE34\uAE09\uACF5\uC9C0' : '\uC0C8 \uC77C\uBC18\uACF5\uC9C0';
  }
}

function editNotice(id) {
  const notice = notices.find(n => n.id === id);
  if (!notice) return;
  
  var isUrgent = notice.is_urgent === 1;
  document.getElementById('notice-modal-title').textContent = isUrgent ? '\uAE34\uAE09\uACF5\uC9C0 \uD3B8\uC9D1' : '\uC77C\uBC18\uACF5\uC9C0 \uD3B8\uC9D1';
  document.getElementById('notice-id').value = notice.id;
  document.getElementById('notice-content').value = notice.content;
  document.getElementById('notice-urgent').checked = isUrgent;
  updateNoticeModalStyle();
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
  showDeleteConfirm('이 공지를 삭제하시겠습니까?', async function() {
    try {
      await fetch(API_BASE + '/notices/' + id, { method: 'DELETE' });
      loadNotices();
      showToast('삭제되었습니다.');
    } catch (e) {
      showToast('삭제 실패', 'error');
    }
  });
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
    document.getElementById('clinic-name-text').textContent = newName;
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

// ── 열린 모달 추적 Set (선택자 기반 감지 대신 확실한 추적) ──
var _openModalSet = new Set();

// ── 오버레이 모달 (fixed 위치, iframe 높이 변경 불필요) ──
var OVERLAY_MODALS = new Set([
  'create-playlist-modal', 'delete-confirm-modal', 'clinic-name-modal',
  'notice-modal', 'preview-modal', 'temp-video-modal', 'tv-export-modal',
  'script-download-modal', 'script-type-modal'
]);

function openModal(id) {
  // edit-playlist-modal은 인라인으로 표시 (openPlaylistEditor에서 처리)
  if (id === 'edit-playlist-modal') return;
  
  const el = document.getElementById(id);
  if (!el) return;

  // ── 단순 표시 ──
  el.style.display = 'flex';
  
  // ── 모달을 화면 중앙에 배치 (스크롤 없이) ──
  var innerWrap = el.querySelector('.absolute.inset-0.flex');
  if (innerWrap) {
    innerWrap.classList.remove('items-start');
    innerWrap.classList.add('items-center');
    innerWrap.style.overflowY = '';
    innerWrap.style.paddingTop = '0';
    var mc = innerWrap.querySelector('.bg-white');
    if (mc) {
      mc.style.maxHeight = '95vh';
      mc.style.overflowY = 'auto';
      mc.style.marginBottom = '0';
    }
  }
  
  // ── 모달 카드에 그림자 추가 (배경 대신) ──
  var card = el.querySelector('.bg-white');
  if (card) card.classList.add('modal-card-shadow');
  
  // ── 바깥 클릭 시 닫기 (backdrop 대신) ──
  if (!el._outsideClickHandler) {
    el._outsideClickHandler = function(e) {
      // detached DOM 클릭 무시 (innerHTML 교체로 인한 오탐 방지)
      if (!document.body.contains(e.target)) return;
      // 모달 카드 내부 클릭이 아니면 닫기
      var c = el.querySelector('.bg-white');
      if (c && !c.contains(e.target)) {
        closeModal(id);
      }
    };
  }
  el.addEventListener('click', el._outsideClickHandler);
  
  // ── 배경 스크롤 방지 ──
  if (_openModalSet.size === 0) {
    window._savedScrollY = window.scrollY || window.pageYOffset || 0;
  }
  document.body.classList.add('modal-open');
  document.documentElement.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  _openModalSet.add(id);
  
  // iframe 높이 변경 차단
  modalHeightLocked = true;
}


function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    // 그림자 제거
    var card = el.querySelector('.bg-white');
    if (card) card.classList.remove('modal-card-shadow');
    // 바깥 클릭 핸들러 제거
    if (el._outsideClickHandler) {
      el.removeEventListener('click', el._outsideClickHandler);
    }
    // ── 단순 숨김 ──
    el.style.display = 'none';
  }
  
  // 추적 Set에서 제거
  _openModalSet.delete(id);
  
  // 열린 모달이 없을 때 공통 처리
  if (_openModalSet.size === 0) {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    // iframe 높이 변경 차단 해제
    modalHeightLocked = false;
    // iframe 높이 복원
    try { 
      if (typeof postParentHeight === 'function') setTimeout(postParentHeight, 100);
    } catch(e) {}
    // 스크롤 위치 복원
    if (typeof window._savedScrollY === 'number' && window._savedScrollY > 0) {
      setTimeout(function() { window.scrollTo(0, window._savedScrollY); window._savedScrollY = 0; }, 150);
    }
  }
  
  // ── 안전장치: 모달 닫았는데 overflow가 hidden인 경우 강제 복원 ──
  setTimeout(function() {
    if (_openModalSet.size === 0) {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, 300);

  // 가이드 모달이 닫힐 때 iframe 높이 원상 복구
  if (GUIDE_MODALS.has(id)) {
    try {
      if (window.parent && window.parent !== window) {
        modalHeightLocked = false;
        setTimeout(() => { if (typeof postParentHeight === 'function') postParentHeight(); }, 100);
      }
    } catch(e) {}
  }

  // 가이드/스크립트 모달 닫힐 때 설정 아코디언도 접기
  if (GUIDE_MODALS.has(id) || id === 'script-download-modal' || id === 'script-type-modal') {
    var wc = document.getElementById('wr-setup-content');
    var wi = document.getElementById('wr-setup-toggle-icon');
    if (wc) wc.style.display = 'none';
    if (wi) { wi.classList.remove('fa-chevron-up'); wi.classList.add('fa-chevron-down'); }
    var cc = document.getElementById('ch-setup-content');
    var ci = document.getElementById('ch-setup-toggle-icon');
    if (cc) cc.style.display = 'none';
    if (ci) { ci.classList.remove('fa-chevron-up'); ci.classList.add('fa-chevron-down'); }
    window._forceCloseSetupSections = true;
  }

  if (id === 'preview-modal') {
    var previewIframe = document.getElementById('preview-iframe');
    if (previewIframe) previewIframe.src = '';
  }
  if (id === 'edit-playlist-modal') {
    currentPlaylist = null;
    if (masterItemsRefreshTimer) {
      clearInterval(masterItemsRefreshTimer);
      masterItemsRefreshTimer = null;
    }
    
    // ── 대기실/체어 설정 섹션 자동 닫기 플래그 ──
    window._forceCloseSetupSections = true;
    
    // ── 인라인 편집 패널 닫기: 원래 탭 콘텐츠 복원 ──
    var mainContent = document.getElementById('dtv-pg');
    if (mainContent) {
      var tabContents = mainContent.querySelectorAll(':scope > div[id^="content-"]');
      tabContents.forEach(function(tc) {
        // _prevDisplay가 저장되어 있으면 복원, 아니면 'none' 유지
        if (tc._prevDisplay !== undefined) {
          tc.style.display = tc._prevDisplay;
          delete tc._prevDisplay;
        }
      });
    }
    
    loadPlaylists();
    // 스크롤 복원
    setTimeout(function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      var dashboard = document.getElementById('dashboard');
      if (dashboard) {
        dashboard.style.display = '';
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'scrollToTop' }, '*');
          window.parent.postMessage({ type: 'scrollTo', top: 0 }, '*');
        }
      } catch(e) {}
      modalHeightLocked = false;
      if (typeof postParentHeight === 'function') {
        postParentHeight();
        setTimeout(postParentHeight, 300);
        setTimeout(postParentHeight, 800);
      }
    }, 150);
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
      // 오버레이 모달이 열려있으면 높이 변경 스킵
      for (var mid of _openModalSet) {
        if (OVERLAY_MODALS.has(mid)) return;
      }
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

// ============================================
// 설정 탭
// ============================================
function toggleSettingsUrlAccordion() {
  var content = document.getElementById('settings-url-content');
  var chevron = document.getElementById('settings-url-chevron');
  if (!content) return;
  var isHidden = content.style.display === 'none';
  content.style.display = isHidden ? 'block' : 'none';
  if (chevron) {
    chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
  }
  if (typeof postParentHeight === 'function') {
    setTimeout(postParentHeight, 50);
    setTimeout(postParentHeight, 300);
  }
}

function initSettingsTab() {
  const nameInput = document.getElementById('settings-clinic-name');
  if (nameInput) nameInput.value = clinicName || '';
  
  // admin code
  const codeEl = document.getElementById('settings-admin-code');
  if (codeEl) codeEl.textContent = ADMIN_CODE;
  
  // TV URLs - 가로로 길게 배치
  const urlsContainer = document.getElementById('settings-tv-urls');
  if (urlsContainer && playlists.length > 0) {
    urlsContainer.innerHTML = playlists.map(p => {
      const tvUrl = location.origin + '/' + p.short_code;
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f9fafb;border-radius:8px">'
        + '<span style="font-size:13px;font-weight:600;color:#374151;white-space:nowrap">' + (p.name || '') + '</span>'
        + '<span style="flex:1;font-size:12px;color:#2563eb;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + tvUrl + '</span>'
        + '<button onclick="copyToClipboard(\'' + tvUrl + '\')" style="padding:4px 10px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:11px;cursor:pointer;white-space:nowrap;font-family:inherit">\uBCF5\uC0AC</button>'
        + '</div>';
    }).join('');
  }
  
  // 로고/자막 설정 로드
  loadSettingsData();
}

async function loadSettingsData() {
  try {
    const res = await fetch(API_BASE + '/settings');
    const data = await res.json();
    // 로고 설정
    const logoUrl = document.getElementById('settings-logo-url');
    const logoSize = document.getElementById('settings-logo-size');
    const sizeLabel = document.getElementById('logo-size-label');
    if (logoUrl) logoUrl.value = data.logo_url || '';
    if (logoSize) logoSize.value = data.logo_size || 150;
    if (sizeLabel) sizeLabel.textContent = (data.logo_size || 150) + 'px';
    // 로고 위치 설정
    const logoPosition = document.getElementById('settings-logo-position');
    if (logoPosition) logoPosition.value = data.logo_position || 'right';
    // 로고 미리보기
    var preview = document.getElementById('settings-logo-preview');
    var img = document.getElementById('logo-preview-img');
    if (data.logo_url && preview && img) {
      img.src = data.logo_url;
      preview.style.display = 'block';
    } else if (preview) {
      preview.style.display = 'none';
    }
    // 자막 설정
    const sf = document.getElementById('settings-subtitle-font');
    const so = document.getElementById('settings-subtitle-opacity');
    const sp = document.getElementById('settings-subtitle-position');
    const soff = document.getElementById('settings-subtitle-offset');
    if (sf) sf.value = data.subtitle_font_size || 28;
    if (so) so.value = data.subtitle_bg_opacity ?? 80;
    if (sp) sp.value = data.subtitle_position || 'bottom';
    if (soff) soff.value = data.subtitle_bottom_offset || 80;
  } catch(e) { console.error('Load settings error:', e); }
}

async function saveSettingsTabLogo() {
  const logoUrl = (document.getElementById('settings-logo-url') || {}).value || '';
  const logoSize = parseInt((document.getElementById('settings-logo-size') || {}).value) || 150;
  const logoPosition = (document.getElementById('settings-logo-position') || {}).value || 'right';
  try {
    const res = await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: logoUrl, logo_size: logoSize, logo_position: logoPosition })
    });
    if (res.ok) {
      showToast('\uB85C\uACE0 \uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
      const preview = document.getElementById('settings-logo-preview');
      const img = document.getElementById('logo-preview-img');
      if (logoUrl && preview && img) { img.src = logoUrl; preview.style.display = 'block'; }
      else if (preview) preview.style.display = 'none';
    }
  } catch(e) { showToast('\uC800\uC7A5 \uC2E4\uD328', 'error'); }
}

async function saveSubtitleSettings() {
  const font = parseInt((document.getElementById('settings-subtitle-font') || {}).value) || 28;
  const opacity = parseInt((document.getElementById('settings-subtitle-opacity') || {}).value) ?? 80;
  const position = (document.getElementById('settings-subtitle-position') || {}).value || 'bottom';
  const offset = parseInt((document.getElementById('settings-subtitle-offset') || {}).value) || 80;
  try {
    const res = await fetch(API_BASE + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtitle_font_size: font, subtitle_bg_opacity: opacity, subtitle_position: position, subtitle_bottom_offset: offset })
    });
    if (res.ok) showToast('\uC790\uB9C9 \uC124\uC815 \uC800\uC7A5');
  } catch(e) { showToast('\uC800\uC7A5 \uC2E4\uD328', 'error'); }
}

function saveClinicNameFromSettings() {
  const nameInput = document.getElementById('settings-clinic-name');
  if (!nameInput || !nameInput.value.trim()) return;
  const newName = nameInput.value.trim();
  
  fetch(API_BASE + '/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinic_name: newName })
  }).then(res => {
    if (res.ok) {
      clinicName = newName;
      document.getElementById('clinic-name-text').textContent = newName;
      showToast('\uCE58\uACFC\uBA85\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
    }
  }).catch(() => showToast('\uC800\uC7A5 \uC2E4\uD328', 'error'));
}

// ============================================
// 최고관리자 탭
// ============================================
function showAdminSubTab(sub) {
  _adminSubTab = sub;
  var allSubs = ['push', 'master-videos', 'overview', 'subtitles'];
  allSubs.forEach(function(s) {
    var btn = document.getElementById('admin-sub-' + s);
    if (!btn) return;
    var isFirst = (s === 'push');
    var isLast = (s === 'subtitles');
    var radius = isFirst ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : '0';
    if (s === sub) {
      btn.style.cssText = 'padding:10px 20px;border:none;background:#3b82f6;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border-radius:' + radius;
    } else {
      btn.style.cssText = 'padding:10px 20px;border:1px solid #e5e7eb;border-left:none;background:#fff;color:#374151;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;border-radius:' + radius;
    }
  });
  var body = document.getElementById('admin-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:32px 0;color:#9ca3af"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>\uB85C\uB529 \uC911...</div>';
  if (sub === 'push') {
    refreshAdminClinics(true).then(function() { renderAdminPush(); }).catch(function() { renderAdminPush(); });
  } else if (sub === 'master-videos') {
    loadMasterItemsForAdmin().then(function() { renderAdminMasterItems(); }).catch(function() { renderAdminMasterItems(); });
  } else if (sub === 'overview') {
    Promise.all([
      loadMasterItemsForAdmin(),
      refreshAdminClinics(true).catch(function(){})
    ]).then(function() {
      renderAdminOverview();
    });
  } else if (sub === 'subtitles') {
    renderAdminSubtitles();
  }
}

function renderAdminSubtitles() {
  var body = document.getElementById('admin-body');
  if (!body) return;
  body.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'
    + '<h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 12px;display:flex;align-items:center;gap:8px" id="sub-form-title">'
    + '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#f5f3ff;color:#7c3aed;font-size:10px"><i class="fas fa-plus-circle"></i></span>'
    + '\uC790\uB9C9 \uCD94\uAC00</h3>'
    + '<div style="display:grid;gap:10px">'
    + '<div><label style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px">Vimeo URL \uB610\uB294 ID</label>'
    + '<input type="text" id="sub-vimeo-id" placeholder="\uC608: https://vimeo.com/123456789" style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box"></div>'
    + '<div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
    + '<label style="font-size:12px;color:#6b7280">\uC790\uB9C9 \uB0B4\uC6A9 (SRT \uD615\uC2DD)</label>'
    + '<button type="button" onclick="document.getElementById(\'sub-srt-file\').click()" style="font-size:11px;background:#f5f3ff;color:#7c3aed;padding:4px 10px;border:1px solid #ddd6fe;border-radius:6px;cursor:pointer;font-family:inherit"><i class="fas fa-folder-open" style="margin-right:4px"></i>\uD30C\uC77C \uBD88\uB7EC\uC624\uAE30</button></div>'
    + '<input type="file" id="sub-srt-file" accept=".srt,.txt" style="display:none" onchange="handleSubSrtFile(event)">'
    + '<textarea id="sub-content" rows="8" placeholder="1\n00:00:00,000 --> 00:00:03,000\n\uC548\uB155\uD558\uC138\uC694\n\n2\n00:00:03,500 --> 00:00:06,000\n\uCE58\uACFC\uC5D0 \uC624\uC2E0 \uAC83\uC744 \uD658\uC601\uD569\uB2C8\uB2E4" style="width:100%;border:2px dashed #d1d5db;border-radius:8px;padding:8px 12px;font-size:12px;font-family:monospace;resize:vertical;box-sizing:border-box"></textarea></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button id="sub-save-btn" onclick="saveSubAdmin()" style="padding:8px 16px;border-radius:8px;border:none;background:#7c3aed;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit"><i class="fas fa-save" style="margin-right:4px"></i><span id="sub-save-text">\uC800\uC7A5</span></button>'
    + '<button onclick="clearSubForm()" style="padding:8px 16px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#6b7280;font-size:12px;cursor:pointer;font-family:inherit"><i class="fas fa-times" style="margin-right:4px"></i>\uCD08\uAE30\uD654</button></div></div></div>'
    + '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<h3 style="font-size:13px;font-weight:700;color:#374151;margin:0;display:flex;align-items:center;gap:8px">'
    + '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#f5f3ff;color:#7c3aed;font-size:10px"><i class="fas fa-list"></i></span>'
    + '\uB4F1\uB85D\uB41C \uC790\uB9C9</h3>'
    + '<span id="sub-count" style="background:#f5f3ff;color:#7c3aed;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600">0\uAC1C</span></div>'
    + '<div id="sub-list"><p style="text-align:center;color:#9ca3af;padding:24px 0;font-size:13px">\uB85C\uB529 \uC911...</p></div></div>';
  loadSubtitlesAdmin();
}

function renderAdminClinics() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  const q = _adminSearchQuery.toLowerCase().trim();
  const clinics = (_allClinics || []).filter(c => {
    if (!q) return true;
    return (c.clinic_name || '').toLowerCase().includes(q) ||
           (c.imweb_email || '').toLowerCase().includes(q) ||
           (c.admin_code || '').toLowerCase().includes(q);
  });
  const totalCount = (_allClinics || []).length;
  const activeCount = clinics.filter(c => c.is_active !== 0).length;
  const suspendedCount = clinics.filter(c => c.is_active === 0).length;
  const imwebCount = clinics.filter(c => c.imweb_member_id).length;
  const unregCount = clinics.filter(c => !c.imweb_member_id).length;
  
  body.innerHTML = `<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0;display:flex;align-items:center;gap:8px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:10px"><i class="fas fa-hospital"></i></span>
        \uCE58\uACFC \uAD00\uB9AC (${totalCount}\uAC1C)
      </h3>
      <button onclick="refreshAdminClinics()" style="font-size:12px;color:#7c3aed;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:500"><i class="fas fa-sync-alt" style="margin-right:4px"></i>\uC0C8\uB85C\uACE0\uCE68</button>
    </div>
    <div style="margin-bottom:10px">
      <input type="text" id="admin-clinic-search" placeholder="\uCE58\uACFC\uBA85, \uC774\uBA54\uC77C, \uCF54\uB4DC \uAC80\uC0C9..." value="${q.replace(/"/g, '&quot;')}"
        style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box"
        oninput="_adminSearchQuery=this.value; renderAdminClinics()">
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;font-size:11px;flex-wrap:wrap">
      <span style="padding:3px 8px;background:#dcfce7;color:#15803d;border-radius:20px;font-weight:600">\uD65C\uC131 ${activeCount}</span>
      <span style="padding:3px 8px;background:#fee2e2;color:#991b1b;border-radius:20px;font-weight:600">\uC815\uC9C0 ${suspendedCount}</span>
      <span style="padding:3px 8px;background:#dbeafe;color:#1d4ed8;border-radius:20px;font-weight:600">\uC784\uC6F9\uC5F0\uB3D9 ${imwebCount}</span>
      <span style="padding:3px 8px;background:#fef3c7;color:#92400e;border-radius:20px;font-weight:600" title="\uC544\uC784\uC6F9 \uD68C\uC6D0\uC774\uC9C0\uB9CC DB\uC5D0 \uCE58\uACFC \uB808\uCF54\uB4DC\uAC00 \uC5C6\uB294 \uBBF8\uB4F1\uB85D \uC0C1\uD0DC">\uBBF8\uB4F1\uB85D ${unregCount}</span>
    </div>
    ${clinics.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:16px 0">' + (q ? '\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : '\uB4F1\uB85D\uB41C \uCE58\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.') + '</p>' :
    '<div style="max-height:60vh;overflow-y:auto;display:grid;gap:6px">' + clinics.map(c => {
      const statusBadge = c.is_active === 0 
        ? '<span style="padding:2px 6px;background:#fee2e2;color:#dc2626;font-size:10px;border-radius:4px;font-weight:600">\uC815\uC9C0</span>'
        : '<span style="padding:2px 6px;background:#dcfce7;color:#16a34a;font-size:10px;border-radius:4px;font-weight:600">\uD65C\uC131</span>';
      const imwebBadge = c.imweb_member_id
        ? '<span style="padding:2px 6px;background:#dbeafe;color:#2563eb;font-size:10px;border-radius:4px;font-weight:600">\uC784\uC6F9</span>'
        : '<span style="padding:2px 6px;background:#fef3c7;color:#92400e;font-size:10px;border-radius:4px;font-weight:600" title="\uC544\uC784\uC6F9 \uD68C\uC6D0\uC774\uC9C0\uB9CC DB\uC5D0 \uCE58\uACFC \uB808\uCF54\uB4DC\uAC00 \uC5C6\uC74C">\uBBF8\uB4F1\uB85D</span>';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:600;color:#1f2937">${c.clinic_name || '\uC774\uB984\uC5C6\uC74C'}</span>
            ${statusBadge} ${imwebBadge}
          </div>
          <p style="font-size:11px;color:#9ca3af;margin:3px 0 0">
            ${c.imweb_email || c.admin_code || ''} | \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8 ${c.playlist_count || 0}\uAC1C | \uACF5\uC9C0 ${c.notice_count || 0}\uAC1C
          </p>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button onclick="window.open('/admin/${c.admin_code}','_blank')" style="padding:4px 8px;font-size:11px;background:#eff6ff;color:#2563eb;border-radius:6px;border:none;cursor:pointer;font-family:inherit" title="\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0 \uC5F4\uAE30"><i class="fas fa-external-link-alt"></i></button>
          ${c.is_active !== 0 
            ? '<button onclick="adminSuspendClinic(\'' + c.admin_code + '\')" style="padding:4px 8px;font-size:11px;background:#fee2e2;color:#dc2626;border-radius:6px;border:none;cursor:pointer;font-family:inherit">\uC815\uC9C0</button>'
            : '<button onclick="adminActivateClinic(\'' + c.admin_code + '\')" style="padding:4px 8px;font-size:11px;background:#dcfce7;color:#16a34a;border-radius:6px;border:none;cursor:pointer;font-family:inherit">\uD65C\uC131\uD654</button>'}
        </div>
      </div>`;
    }).join('') + '</div>'}
  </div>`;
}

async function refreshAdminClinics(skipRender) {
  try {
    const res = await fetch('/api/master/users');
    if (res.ok) {
      const data = await res.json();
      _allClinics = (data.users || []).filter(u => !u.is_master);
      if (!skipRender) {
        if (_adminSubTab === 'overview') renderAdminOverview();
        else if (_adminSubTab === 'push') renderAdminPush();
      }
    }
  } catch(e) { /* silent */ }
}

async function adminSuspendClinic(adminCode) {
  showDeleteConfirm('\uC774 \uCE58\uACFC\uB97C \uC815\uC9C0\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', async function() {
    try {
      const res = await fetch('/api/master/clinics/' + adminCode + '/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '\uAD00\uB9AC\uC790\uC5D0 \uC758\uD574 \uC815\uC9C0' })
      });
      if (res.ok) { showToast('\uC815\uC9C0 \uCC98\uB9AC \uC644\uB8CC'); await refreshAdminClinics(); }
    } catch(e) { showToast('\uCC98\uB9AC \uC2E4\uD328', 'error'); }
  });
}

async function adminActivateClinic(adminCode) {
  try {
    const res = await fetch('/api/master/clinics/' + adminCode + '/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) { showToast('\uD65C\uC131\uD654 \uC644\uB8CC'); await refreshAdminClinics(); }
  } catch(e) { showToast('\uCC98\uB9AC \uC2E4\uD328', 'error'); }
}

// 전체 현황 탭 (치과 관리 + 공용 영상 통합)
function renderAdminOverview() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  
  // 치과 목록
  const q = _adminSearchQuery.toLowerCase().trim();
  const allC = _allClinics || [];
  const clinics = allC.filter(function(c) {
    if (!q) return true;
    return (c.clinic_name || '').toLowerCase().includes(q) ||
           (c.imweb_email || '').toLowerCase().includes(q) ||
           (c.admin_code || '').toLowerCase().includes(q);
  });
  const totalCount = allC.length;
  const activeCount = clinics.filter(function(c){ return c.is_active !== 0; }).length;
  const suspendedCount = clinics.filter(function(c){ return c.is_active === 0; }).length;
  const imwebCount = clinics.filter(function(c){ return !!c.imweb_member_id; }).length;
  const unregCount = clinics.filter(function(c){ return !c.imweb_member_id; }).length;
  
  var clinicsHtml = clinics.length === 0
    ? '<p style="color:#9ca3af;text-align:center;padding:16px 0">' + (q ? '\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : '\uB4F1\uB85D\uB41C \uCE58\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.') + '</p>'
    : '<div style="max-height:50vh;overflow-y:auto;display:grid;gap:6px">' + clinics.map(function(c) {
        var statusBadge = c.is_active === 0 
          ? '<span style="padding:2px 6px;background:#fee2e2;color:#dc2626;font-size:10px;border-radius:4px;font-weight:600">\uC815\uC9C0</span>'
          : '<span style="padding:2px 6px;background:#dcfce7;color:#16a34a;font-size:10px;border-radius:4px;font-weight:600">\uD65C\uC131</span>';
        var imwebBadge = c.imweb_member_id
          ? '<span style="padding:2px 6px;background:#dbeafe;color:#2563eb;font-size:10px;border-radius:4px;font-weight:600">\uC784\uC6F9</span>'
          : '<span style="padding:2px 6px;background:#fef3c7;color:#92400e;font-size:10px;border-radius:4px;font-weight:600">\uBBF8\uB4F1\uB85D</span>';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<span style="font-size:13px;font-weight:600;color:#1f2937">' + (c.clinic_name || '\uC774\uB984\uC5C6\uC74C') + '</span>' +
              statusBadge + ' ' + imwebBadge +
            '</div>' +
            '<p style="font-size:11px;color:#9ca3af;margin:3px 0 0">' + (c.imweb_email || c.admin_code || '') + ' | \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8 ' + (c.playlist_count || 0) + '\uAC1C | \uACF5\uC9C0 ' + (c.notice_count || 0) + '\uAC1C</p>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0">' +
            '<button onclick="window.open(\'/admin/' + c.admin_code + '\',\'_blank\')" style="padding:4px 8px;font-size:11px;background:#eff6ff;color:#2563eb;border-radius:6px;border:none;cursor:pointer;font-family:inherit" title="\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0 \uC5F4\uAE30"><i class="fas fa-external-link-alt"></i></button>' +
            (c.is_active !== 0 
              ? '<button onclick="adminSuspendClinic(\'' + c.admin_code + '\')" style="padding:4px 8px;font-size:11px;background:#fee2e2;color:#dc2626;border-radius:6px;border:none;cursor:pointer;font-family:inherit">\uC815\uC9C0</button>'
              : '<button onclick="adminActivateClinic(\'' + c.admin_code + '\')" style="padding:4px 8px;font-size:11px;background:#dcfce7;color:#16a34a;border-radius:6px;border:none;cursor:pointer;font-family:inherit">\uD65C\uC131\uD654</button>') +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
  
  // 공용 영상 - 대기실/체어/공통 분리 표시
  var masterAllOnly = (masterItems || []).filter(function(i) { return (i.target_type || 'all') === 'all'; });
  var masterWr = (masterItems || []).filter(function(i) { return (i.target_type || 'all') === 'waitingroom'; });
  var masterCh = (masterItems || []).filter(function(i) { return (i.target_type || 'all') === 'chair'; });
  
  function renderOverviewMasterGroup(groupItems) {
    if (groupItems.length === 0) return '<p style="font-size:12px;color:#9ca3af;text-align:center;padding:8px 0;margin:0">없음</p>';
    return groupItems.map(function(item) {
      var thumb = item.thumbnail_url 
        ? '<img src="' + item.thumbnail_url + '" style="width:48px;height:32px;object-fit:cover;border-radius:5px">'
        : '<div style="width:48px;height:32px;background:#e5e7eb;border-radius:5px;display:flex;align-items:center;justify-content:center"><i class="fas fa-video" style="color:#9ca3af;font-size:10px"></i></div>';
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#f9fafb;border-radius:6px;border:1px solid #f3f4f6">' +
        thumb +
        '<div style="flex:1;min-width:0"><p style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0">' + (item.title || item.url || '') + '</p></div>' +
        '<button onclick="adminDeleteMasterItem(' + item.id + ')" style="padding:3px 6px;font-size:10px;background:#fee2e2;color:#dc2626;border-radius:5px;border:none;cursor:pointer;font-family:inherit"><i class="fas fa-trash"></i></button>' +
      '</div>';
    }).join('');
  }
  
  var masterHtml = 
    '<div style="margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:#059669;padding:2px 8px;background:#ecfdf5;border-radius:4px">공통 (' + masterAllOnly.length + ')</span><span style="font-size:10px;color:#9ca3af">대기실+체어 모두 재생</span></div>' +
      '<div style="display:grid;gap:4px">' + renderOverviewMasterGroup(masterAllOnly) + '</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:#2563eb;padding:2px 8px;background:#dbeafe;border-radius:4px">대기실 전용 (' + masterWr.length + ')</span></div>' +
      '<div style="display:grid;gap:4px">' + renderOverviewMasterGroup(masterWr) + '</div>' +
    '</div>' +
    '<div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:#7c3aed;padding:2px 8px;background:#ede9fe;border-radius:4px">체어 전용 (' + masterCh.length + ')</span></div>' +
      '<div style="display:grid;gap:4px">' + renderOverviewMasterGroup(masterCh) + '</div>' +
    '</div>';
  
  body.innerHTML = 
    // 치과 관리 섹션
    '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0">\uCE58\uACFC \uAD00\uB9AC (' + totalCount + '\uAC1C)</h3>' +
        '<button onclick="refreshAdminClinics()" style="font-size:12px;color:#3b82f6;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:500"><i class="fas fa-sync-alt" style="margin-right:4px"></i>\uC0C8\uB85C\uACE0\uCE68</button>' +
      '</div>' +
      '<input type="text" id="admin-clinic-search" placeholder="\uCE58\uACFC\uBA85, \uC774\uBA54\uC77C, \uCF54\uB4DC \uAC80\uC0C9..." value="' + q.replace(/"/g, '&quot;') + '" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;margin-bottom:10px" oninput="_adminSearchQuery=this.value; renderAdminOverview()">' +
      '<div style="display:flex;gap:6px;margin-bottom:10px;font-size:11px;flex-wrap:wrap">' +
        '<span style="padding:3px 8px;background:#dcfce7;color:#15803d;border-radius:20px;font-weight:600">\uD65C\uC131 ' + activeCount + '</span>' +
        '<span style="padding:3px 8px;background:#fee2e2;color:#991b1b;border-radius:20px;font-weight:600">\uC815\uC9C0 ' + suspendedCount + '</span>' +
        '<span style="padding:3px 8px;background:#dbeafe;color:#1d4ed8;border-radius:20px;font-weight:600">\uC784\uC6F9\uC5F0\uB3D9 ' + imwebCount + '</span>' +
        '<span style="padding:3px 8px;background:#fef3c7;color:#92400e;border-radius:20px;font-weight:600">\uBBF8\uB4F1\uB85D ' + unregCount + '</span>' +
      '</div>' +
      clinicsHtml +
    '</div>' +
    
    // 공용 영상 섹션
    '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
      '<h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0 0 14px">\uACF5\uC6A9 \uC601\uC0C1 \uAD00\uB9AC (' + (masterItems || []).length + '\uAC1C)</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px;margin-bottom:14px">' +
        '<div style="display:flex;gap:8px">' +
          '<input type="text" id="admin-new-url" placeholder="YouTube \uB610\uB294 Vimeo URL" style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:13px;font-family:inherit">' +
          '<button onclick="adminAddMasterItem()" style="padding:8px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit"><i class="fas fa-plus" style="margin-right:4px"></i>\uCD94\uAC00</button>' +
        '</div>' +
      '</div>' +
      '<div id="admin-master-items-list" style="display:grid;gap:6px">' + masterHtml + '</div>' +
    '</div>';
}

var _masterFilterType = 'all_filter'; // all_filter, waitingroom, chair

function renderAdminMasterItems() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  const allItems = masterItems || [];
  
  // 필터링 (완전 분리 - 각 타입만 표시)
  var items = allItems;
  if (_masterFilterType === 'waitingroom') {
    items = allItems.filter(function(i) { return (i.target_type || 'all') === 'waitingroom'; });
  } else if (_masterFilterType === 'chair') {
    items = allItems.filter(function(i) { return (i.target_type || 'all') === 'chair'; });
  } else if (_masterFilterType === 'all_only') {
    items = allItems.filter(function(i) { return (i.target_type || 'all') === 'all'; });
  }
  
  // 카운트 (각 타입별 순수 개수)
  var allOnlyCount = allItems.filter(function(i) { return (i.target_type || 'all') === 'all'; }).length;
  var wrCount = allItems.filter(function(i) { return (i.target_type || 'all') === 'waitingroom'; }).length;
  var chCount = allItems.filter(function(i) { return (i.target_type || 'all') === 'chair'; }).length;
  
  var itemsHtml = '';
  if (items.length === 0) {
    itemsHtml = '<div style="text-align:center;padding:32px 0;color:#9ca3af"><i class="fas fa-video" style="font-size:24px;margin-bottom:8px;display:block"></i><p style="margin:0;font-size:13px">\uD574\uB2F9 \uC601\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p></div>';
  } else {
    itemsHtml = items.map(function(item, idx) {
      var thumb = item.thumbnail_url && !item.thumbnail_url.includes('vimeo.com/')
        ? '<img src="' + item.thumbnail_url + '" style="width:72px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0">'
        : '<div style="width:72px;height:48px;background:#e5e7eb;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-video" style="color:#9ca3af;font-size:14px"></i></div>';
      var typeLabel = (item.item_type || 'vimeo').toUpperCase();
      var typeBg = typeLabel === 'VIMEO' ? '#7c3aed' : '#dc2626';
      var tt = item.target_type || 'all';
      var targetBadge = '';
      if (tt === 'waitingroom') targetBadge = '<span style="font-size:9px;padding:1px 5px;background:#dbeafe;color:#1d4ed8;border-radius:3px;font-weight:600">\uB300\uAE30\uC2E4</span>';
      else if (tt === 'chair') targetBadge = '<span style="font-size:9px;padding:1px 5px;background:#ede9fe;color:#7c3aed;border-radius:3px;font-weight:600">\uCCB4\uC5B4</span>';
      else targetBadge = '<span style="font-size:9px;padding:1px 5px;background:#f3f4f6;color:#6b7280;border-radius:3px;font-weight:600">\uC804\uCCB4</span>';
      return '<div id="admin-master-item-' + item.id + '" data-id="' + item.id + '" style="display:flex;align-items:center;gap:12px;padding:12px;background:#f9fafb;border-radius:10px;border:1px solid #f3f4f6;transition:all .15s" onmouseover="this.style.borderColor=\'#c7d2fe\';this.style.background=\'#faf5ff\'" onmouseout="this.style.borderColor=\'#f3f4f6\';this.style.background=\'#f9fafb\'">' +
        '<div class="admin-drag-handle" style="cursor:grab;color:#9ca3af;padding:2px 4px;font-size:14px"><i class="fas fa-grip-vertical"></i></div>' +
        '<span style="font-size:11px;color:#9ca3af;font-weight:600;min-width:20px;text-align:center">' + (idx + 1) + '</span>' +
        thumb +
        '<div style="flex:1;min-width:0">' +
          '<p id="admin-master-title-' + item.id + '" style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;color:#1f2937">' + (item.title || 'Untitled') + '</p>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-top:3px">' +
            '<span style="font-size:10px;padding:1px 6px;background:' + typeBg + ';color:#fff;border-radius:4px;font-weight:600">' + typeLabel + '</span>' +
            targetBadge +
            '<span style="font-size:10px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (item.url || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
          '<button onclick="adminToggleTargetType(' + item.id + ')" title="\uB300\uC0C1 \uBCC0\uACBD (\uC804\uCCB4/\uB300\uAE30\uC2E4/\uCCB4\uC5B4)" style="padding:6px 8px;font-size:12px;background:#f0fdf4;color:#16a34a;border-radius:6px;border:none;cursor:pointer;font-family:inherit;transition:background .15s" onmouseover="this.style.background=\'#dcfce7\'" onmouseout="this.style.background=\'#f0fdf4\'"><i class="fas fa-exchange-alt"></i></button>' +
          '<button onclick="adminEditMasterItem(' + item.id + ')" title="\uC218\uC815" style="padding:6px 8px;font-size:12px;background:#ede9fe;color:#7c3aed;border-radius:6px;border:none;cursor:pointer;font-family:inherit;transition:background .15s" onmouseover="this.style.background=\'#ddd6fe\'" onmouseout="this.style.background=\'#ede9fe\'"><i class="fas fa-pen"></i></button>' +
          '<button onclick="adminRefreshMasterThumb(' + item.id + ')" title="\uC378\uB124\uC77C \uC0C8\uB85C\uACE0\uCE68" style="padding:6px 8px;font-size:12px;background:#e0f2fe;color:#0284c7;border-radius:6px;border:none;cursor:pointer;font-family:inherit;transition:background .15s" onmouseover="this.style.background=\'#bae6fd\'" onmouseout="this.style.background=\'#e0f2fe\'"><i class="fas fa-sync-alt"></i></button>' +
          '<button onclick="adminDeleteMasterItem(' + item.id + ')" title="\uC0AD\uC81C" style="padding:6px 8px;font-size:12px;background:#fee2e2;color:#dc2626;border-radius:6px;border:none;cursor:pointer;font-family:inherit;transition:background .15s" onmouseover="this.style.background=\'#fecaca\'" onmouseout="this.style.background=\'#fee2e2\'"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  
  // 필터 탭 스타일
  var fAll = _masterFilterType === 'all_filter';
  var fAllOnly = _masterFilterType === 'all_only';
  var fWr = _masterFilterType === 'waitingroom';
  var fCh = _masterFilterType === 'chair';
  var filterTabBase = 'padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:none;transition:all .15s;';
  var filterTabOn = function(bg, color) { return filterTabBase + 'background:' + bg + ';color:' + color + ';'; };
  var filterTabOff = filterTabBase + 'background:#f3f4f6;color:#6b7280;';

  body.innerHTML = '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<h3 style="font-size:14px;font-weight:700;color:#1f2937;margin:0;display:flex;align-items:center;gap:8px">' +
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:10px"><i class="fas fa-video"></i></span>' +
        '\uACF5\uC6A9 \uC601\uC0C1 \uAD00\uB9AC <span style="font-size:12px;font-weight:500;color:#6b7280">(' + allItems.length + '\uAC1C)</span>' +
      '</h3>' +
      '<button onclick="adminRefreshMasterList()" style="font-size:12px;color:#7c3aed;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:500"><i class="fas fa-sync-alt" style="margin-right:4px"></i>\uC0C8\uB85C\uACE0\uCE68</button>' +
    '</div>' +
    // 필터 탭
    '<div style="display:flex;gap:6px;margin-bottom:14px">' +
      '<button onclick="_masterFilterType=\'all_filter\';renderAdminMasterItems()" style="' + (fAll ? filterTabOn('#6b7280','#fff') : filterTabOff) + '">\uBAA8\uB450 ' + allItems.length + '</button>' +
      '<button onclick="_masterFilterType=\'all_only\';renderAdminMasterItems()" style="' + (fAllOnly ? filterTabOn('#059669','#fff') : filterTabOff) + '">\uACF5\uD1B5 ' + allOnlyCount + '</button>' +
      '<button onclick="_masterFilterType=\'waitingroom\';renderAdminMasterItems()" style="' + (fWr ? filterTabOn('#2563eb','#fff') : filterTabOff) + '">\uB300\uAE30\uC2E4 ' + wrCount + '</button>' +
      '<button onclick="_masterFilterType=\'chair\';renderAdminMasterItems()" style="' + (fCh ? filterTabOn('#7c3aed','#fff') : filterTabOff) + '">\uCCB4\uC5B4 ' + chCount + '</button>' +
    '</div>' +
    '<div style="background:#f5f3ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px;margin-bottom:14px">' +
      '<p style="font-size:11px;color:#6b7280;margin:0 0 8px"><i class="fas fa-info-circle" style="margin-right:4px;color:#7c3aed"></i>\uC5EC\uAE30\uC11C \uCD94\uAC00\uD55C \uC601\uC0C1\uC740 \uBAA8\uB4E0 \uCE58\uACFC\uC5D0 \uACF5\uC6A9\uB429\uB2C8\uB2E4.</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px">' +
        '<input type="text" id="admin-new-url" placeholder="Vimeo URL \uC785\uB825 (https://vimeo.com/...)" style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:13px;font-family:inherit">' +
        '<button onclick="adminAddMasterItem()" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap"><i class="fas fa-plus" style="margin-right:4px"></i>\uCD94\uAC00</button>' +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        '<span style="font-size:11px;color:#6b7280">\uB300\uC0C1:</span>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#374151;cursor:pointer"><input type="radio" name="admin-target-type" value="all" checked style="accent-color:#7c3aed"> \uC804\uCCB4</label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#2563eb;cursor:pointer"><input type="radio" name="admin-target-type" value="waitingroom" style="accent-color:#2563eb"> \uB300\uAE30\uC2E4</label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#7c3aed;cursor:pointer"><input type="radio" name="admin-target-type" value="chair" style="accent-color:#7c3aed"> \uCCB4\uC5B4</label>' +
      '</div>' +
    '</div>' +
    '<div id="admin-master-items-list" style="display:grid;gap:6px">' + itemsHtml + '</div>' +
  '</div>';
  // Sortable 초기화 (드래그 순서 변경)
  initAdminMasterSortable();
}

var _adminMasterSortable = null;
function initAdminMasterSortable() {
  var list = document.getElementById('admin-master-items-list');
  if (!list || typeof Sortable === 'undefined') return;
  if (_adminMasterSortable) { try { _adminMasterSortable.destroy(); } catch(e){} }
  _adminMasterSortable = new Sortable(list, {
    handle: '.admin-drag-handle',
    animation: 200,
    ghostClass: 'sortable-ghost',
    onEnd: function() {
      var items = list.querySelectorAll('[data-id]');
      var reorderData = [];
      items.forEach(function(el, idx) {
        var id = parseInt(el.getAttribute('data-id'));
        reorderData.push({ id: id, sort_order: idx + 1 });
        var badge = el.querySelector('span[style*="min-width:20px"]');
        if (badge) badge.textContent = (idx + 1);
      });
      // 서버에 순서 저장
      fetch('/api/master/items/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderData })
      }).then(function(res) {
        if (res.ok) {
          // masterItems 순서도 업데이트
          var newOrder = reorderData.map(function(r) { return r.id; });
          masterItems = newOrder.map(function(id) {
            return (masterItems || []).find(function(i) { return i.id === id; });
          }).filter(Boolean);
          cachedMasterItems = masterItems;
          masterItemsCache = masterItems;
          showToast('\uC21C\uC11C \uBCC0\uACBD \uC644\uB8CC');
        } else {
          showToast('\uC21C\uC11C \uC800\uC7A5 \uC2E4\uD328', 'error');
        }
      }).catch(function() { showToast('\uC21C\uC11C \uC800\uC7A5 \uC2E4\uD328', 'error'); });
    }
  });
}

async function adminAddMasterItem() {
  const urlInput = document.getElementById('admin-new-url');
  if (!urlInput || !urlInput.value.trim()) return;
  var targetTypeRadio = document.querySelector('input[name="admin-target-type"]:checked');
  var targetType = targetTypeRadio ? targetTypeRadio.value : 'all';
  try {
    const res = await fetch('/api/master/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value.trim(), target_type: targetType })
    });
    if (res.ok) {
      urlInput.value = '';
      const itemsRes = await fetch('/api/master/items');
      if (itemsRes.ok) { const data = await itemsRes.json(); masterItems = data.items || []; cachedMasterItems = masterItems; masterItemsCache = masterItems; }
      if (_adminSubTab === 'overview') renderAdminOverview(); else renderAdminMasterItems();
      showToast('\uC601\uC0C1 \uCD94\uAC00 \uC644\uB8CC');
    } else { const err = await res.json(); showToast(err.error || '\uCD94\uAC00 \uC2E4\uD328', 'error'); }
  } catch(e) { showToast('\uCD94\uAC00 \uC2E4\uD328', 'error'); }
}

async function adminDeleteMasterItem(itemId) {
  showDeleteConfirm('\uC774 \uACF5\uC6A9 \uC601\uC0C1\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', async function() {
    try {
      const res = await fetch('/api/master/items/' + itemId, { method: 'DELETE' });
      if (res.ok) {
        masterItems = masterItems.filter(i => i.id !== itemId); cachedMasterItems = masterItems; masterItemsCache = masterItems;
        if (_adminSubTab === 'overview') renderAdminOverview(); else renderAdminMasterItems();
        showToast('\uC0AD\uC81C \uC644\uB8CC');
      }
    } catch(e) { showToast('\uC0AD\uC81C \uC2E4\uD328', 'error'); }
  });
}

async function adminEditMasterItem(itemId) {
  var item = (masterItems || []).find(function(i) { return i.id === itemId; });
  if (!item) return;
  var newTitle = prompt('\uC601\uC0C1 \uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694:', item.title || '');
  if (newTitle === null || newTitle.trim() === '') return;
  try {
    var res = await fetch('/api/master/items/' + itemId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() })
    });
    if (res.ok) {
      item.title = newTitle.trim();
      var titleEl = document.getElementById('admin-master-title-' + itemId);
      if (titleEl) titleEl.textContent = newTitle.trim();
      cachedMasterItems = masterItems; masterItemsCache = masterItems;
      showToast('\uC81C\uBAA9 \uC218\uC815 \uC644\uB8CC');
    } else {
      showToast('\uC218\uC815 \uC2E4\uD328', 'error');
    }
  } catch(e) { showToast('\uC218\uC815 \uC2E4\uD328', 'error'); }
}

async function adminToggleTargetType(itemId) {
  var item = (masterItems || []).find(function(i) { return i.id === itemId; });
  if (!item) return;
  var current = item.target_type || 'all';
  var nextMap = { 'all': 'waitingroom', 'waitingroom': 'chair', 'chair': 'all' };
  var next = nextMap[current] || 'all';
  try {
    var res = await fetch('/api/master/items/' + itemId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: next })
    });
    if (res.ok) {
      item.target_type = next;
      cachedMasterItems = masterItems; masterItemsCache = masterItems;
      renderAdminMasterItems();
      var labels = { 'all': '\uC804\uCCB4', 'waitingroom': '\uB300\uAE30\uC2E4', 'chair': '\uCCB4\uC5B4' };
      showToast('\uB300\uC0C1 \uBCC0\uACBD: ' + labels[next]);
    } else { showToast('\uBCC0\uACBD \uC2E4\uD328', 'error'); }
  } catch(e) { showToast('\uBCC0\uACBD \uC2E4\uD328', 'error'); }
}

async function adminRefreshMasterThumb(itemId) {
  var btn = event && event.currentTarget;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  try {
    var res = await fetch('/api/master/items/' + itemId + '/refresh-thumbnail', { method: 'POST' });
    if (res.ok) {
      var data = await res.json();
      var item = (masterItems || []).find(function(i) { return i.id === itemId; });
      if (item && data.thumbnail_url) { item.thumbnail_url = data.thumbnail_url; }
      if (item && data.title) { item.title = data.title; }
      cachedMasterItems = masterItems; masterItemsCache = masterItems;
      renderAdminMasterItems();
      showToast('\uC378\uB124\uC77C \uC0C8\uB85C\uACE0\uCE68 \uC644\uB8CC');
    } else {
      showToast('\uC378\uB124\uC77C \uC0C8\uB85C\uACE0\uCE68 \uC2E4\uD328', 'error');
    }
  } catch(e) { showToast('\uC378\uB124\uC77C \uC0C8\uB85C\uACE0\uCE68 \uC2E4\uD328', 'error'); }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i>'; }
}

async function adminRefreshMasterList() {
  try {
    var res = await fetch('/api/master/items?ts=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      var data = await res.json();
      masterItems = data.items || [];
      cachedMasterItems = masterItems;
      masterItemsCache = masterItems;
      renderAdminMasterItems();
      showToast('\uBAA9\uB85D \uC0C8\uB85C\uACE0\uCE68 \uC644\uB8CC');
    }
  } catch(e) { showToast('\uC0C8\uB85C\uACE0\uCE68 \uC2E4\uD328', 'error'); }
}

function renderAdminPush() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  const allClinics = _allClinics || [];
  const totalCount = allClinics.length;
  const activeCount = allClinics.filter(c => c.is_active !== 0).length;
  
  body.innerHTML = 
    // STEP 1: 대상 클리닉 선택
    '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#3b82f6;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">1</span>' +
        '<h3 style="font-size:15px;font-weight:700;color:#1f2937;margin:0">\ub300\uc0c1 \ud074\ub9ac\ub2c9 \uc120\ud0dd <span style="font-size:12px;font-weight:500;color:#6b7280">(\ud65c\uc131 ' + activeCount + ' / \uc804\uccb4 ' + totalCount + ')</span></h3>' +
      '</div>' +
      '<div style="margin-bottom:10px">' +
        '<div style="position:relative">' +
          '<i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:12px"></i>' +
          '<input type="text" id="push-clinic-search" placeholder="\uce58\uacfc\uba85 \ub610\ub294 \uc774\uba54\uc77c\ub85c \uac80\uc0c9..." oninput="filterPushClinics()" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px 9px 32px;font-size:13px;font-family:inherit;box-sizing:border-box">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="push-select-all" onchange="togglePushSelectAll()" style="width:16px;height:16px;accent-color:#3b82f6"><span style="font-size:13px;color:#374151;font-weight:500">\uc804\uccb4\uc120\ud0dd</span></label>' +
        '<span id="push-selected-count" style="font-size:12px;color:#3b82f6;font-weight:600">0/' + totalCount + '\uac1c</span>' +
      '</div>' +
      '<div id="push-clinics-grid" style="display:flex;flex-wrap:wrap;gap:6px;max-height:240px;overflow-y:auto;padding:4px 0"></div>' +
    '</div>' +
    
    // STEP 2: 배포할 링크 입력
    '<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#3b82f6;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">2</span>' +
        '<h3 style="font-size:15px;font-weight:700;color:#1f2937;margin:0">\ubc30\ud3ec\ud560 \ub9c1\ud06c</h3>' +
      '</div>' +
      '<div id="push-templates-area" style="margin-bottom:12px"></div>' +
      '<div style="display:grid;gap:8px">' +
        '<input type="text" id="push-link-name" placeholder="\ub9c1\ud06c \uc774\ub984 (\uc608: \uce58\uc544\uad50\uc815 \uc548\ub0b4)" style="border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit">' +
        '<input type="text" id="push-link-url" placeholder="URL (https://...)" style="border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit">' +
        '<div style="display:flex;gap:8px">' +
          '<input type="text" id="push-link-thumb" placeholder="\uc378\ub124\uc77c URL (\uc120\ud0dd)" style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit">' +
          '<button onclick="addPushTemplate()" style="padding:9px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap"><i class="fas fa-plus" style="margin-right:4px"></i>\ucd94\uac00</button>' +
        '</div>' +
        '<input type="text" id="push-link-memo" placeholder="\uae30\ubcf8 \uba54\ubaa8 (\ub9c1\ud06c \uc120\ud0dd \uc2dc \uc790\ub3d9 \uc785\ub825, \uc120\ud0dd)" style="border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit">' +
      '</div>' +
    '</div>' +
    
    // 배포 버튼
    '<button onclick="executePush()" style="width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(59,130,246,.3);transition:opacity .15s" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">' +
      '<i class="fas fa-paper-plane" style="margin-right:8px"></i>\uc120\ud0dd \ub300\uc0c1\uc5d0 \ubc30\ud3ec' +
    '</button>';
  
  renderPushClinicsGrid();
  renderPushTemplates();
}

var _pushSearchQuery = '';
var _pushTemplates = [];

function filterPushClinics() {
  var el = document.getElementById('push-clinic-search');
  _pushSearchQuery = el ? el.value.toLowerCase().trim() : '';
  renderPushClinicsGrid();
}

function renderPushClinicsGrid() {
  var grid = document.getElementById('push-clinics-grid');
  if (!grid) return;
  var allClinics = _allClinics || [];
  var q = _pushSearchQuery;
  var filtered = allClinics.filter(function(c) {
    if (!q) return true;
    return (c.clinic_name || '').toLowerCase().includes(q) ||
           (c.imweb_email || '').toLowerCase().includes(q) ||
           (c.admin_code || '').toLowerCase().includes(q);
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = '<p style="width:100%;text-align:center;color:#9ca3af;font-size:13px;padding:12px 0">' + (q ? '\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.' : '\ub4f1\ub85d\ub41c \uce58\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.') + '</p>';
    updatePushCount();
    return;
  }
  
  grid.innerHTML = filtered.map(function(c) {
    var name = c.clinic_name || c.admin_code || '\uc774\ub984\uc5c6\uc74c';
    var isActive = c.is_active !== 0;
    var statusDot = isActive 
      ? '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0"></span>' 
      : '<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0"></span>';
    var chipBorder = isActive ? '#e5e7eb' : '#fecaca';
    var chipBg = isActive ? '#fff' : '#fef2f2';
    return '<label style="display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border:1px solid ' + chipBorder + ';border-radius:20px;cursor:pointer;font-size:12px;background:' + chipBg + ';transition:all .15s;white-space:nowrap;user-select:none" onmouseover="if(!this.querySelector(\'input\').checked){this.style.borderColor=\'#93c5fd\';this.style.background=\'#eff6ff\'}" onmouseout="if(!this.querySelector(\'input\').checked){this.style.borderColor=\'' + chipBorder + '\';this.style.background=\'' + chipBg + '\'}">' +
      '<input type="checkbox" class="push-clinic-cb" value="' + c.admin_code + '" onchange="updatePushCount();updatePushChipStyle(this)" style="width:14px;height:14px;accent-color:#3b82f6">' +
      statusDot +
      '<span style="font-weight:500">' + name + '</span>' +
    '</label>';
  }).join('');
  
  updatePushCount();
}

function updatePushChipStyle(cb) {
  var label = cb.closest('label');
  if (!label) return;
  if (cb.checked) {
    label.style.borderColor = '#3b82f6';
    label.style.background = '#dbeafe';
    label.style.boxShadow = '0 0 0 1px #3b82f6';
  } else {
    label.style.borderColor = '#e5e7eb';
    label.style.background = '#fff';
    label.style.boxShadow = 'none';
  }
}

function addPushTemplate() {
  var nameEl = document.getElementById('push-link-name');
  var urlEl = document.getElementById('push-link-url');
  var thumbEl = document.getElementById('push-link-thumb');
  var memoEl = document.getElementById('push-link-memo');
  if (!urlEl || !urlEl.value.trim()) { showToast('URL\uC744 \uC785\uB825\uD558\uC138\uC694', 'error'); return; }
  _pushTemplates.push({
    name: nameEl ? nameEl.value.trim() : '',
    url: urlEl.value.trim(),
    thumb: thumbEl ? thumbEl.value.trim() : '',
    memo: memoEl ? memoEl.value.trim() : ''
  });
  if (nameEl) nameEl.value = '';
  if (urlEl) urlEl.value = '';
  if (thumbEl) thumbEl.value = '';
  if (memoEl) memoEl.value = '';
  renderPushTemplates();
}

function removePushTemplate(idx) {
  _pushTemplates.splice(idx, 1);
  renderPushTemplates();
}

function renderPushTemplates() {
  var area = document.getElementById('push-templates-area');
  if (!area) return;
  if (_pushTemplates.length === 0) {
    area.innerHTML = '';
    return;
  }
  area.innerHTML = '<div style="margin-bottom:8px;font-size:12px;color:#6b7280;font-weight:500">\uc608\uc57d\ub41c \ub9c1\ud06c (' + _pushTemplates.length + '\uac1c)</div>' +
    _pushTemplates.map(function(t, i) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:6px">' +
      '<i class="fas fa-link" style="color:#3b82f6;font-size:12px;flex-shrink:0"></i>' +
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (t.name || 'Untitled') + '</div><div style="font-size:11px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.url + '</div></div>' +
      '<button onclick="removePushTemplate(' + i + ')" style="border:none;background:#fee2e2;color:#ef4444;cursor:pointer;font-size:11px;padding:4px 8px;border-radius:6px"><i class="fas fa-times"></i></button>' +
    '</div>';
  }).join('');
}

function updatePushCount() {
  var checked = document.querySelectorAll('.push-clinic-cb:checked').length;
  var total = document.querySelectorAll('.push-clinic-cb').length;
  var el = document.getElementById('push-selected-count');
  if (el) el.textContent = checked + '/' + total + '\uAC1C';
  // sync select-all checkbox
  var sa = document.getElementById('push-select-all');
  if (sa) sa.checked = (total > 0 && checked === total);
}

function selectPushTemplate(type) {
  // legacy compat - no longer used in new UI but keep for safety
}

function togglePushSelectAll() {
  var checked = document.getElementById('push-select-all').checked;
  document.querySelectorAll('.push-clinic-cb').forEach(function(cb) { 
    cb.checked = checked; 
    updatePushChipStyle(cb);
  });
  updatePushCount();
}

async function executePush() {
  var selectedCodes = Array.from(document.querySelectorAll('.push-clinic-cb:checked')).map(function(cb){ return cb.value; });
  if (selectedCodes.length === 0) { showToast('\uBC30\uD3EC \uB300\uC0C1\uC744 \uC120\uD0DD\uD558\uC138\uC694', 'error'); return; }
  
  // 템플릿이 있으면 사용, 없으면 입력 필드에서 직접 가져오기
  var pushItems = [];
  if (_pushTemplates.length > 0) {
    pushItems = _pushTemplates.map(function(t) { return { url: t.url, title: t.name || t.url }; });
  } else {
    var linkName = (document.getElementById('push-link-name') || {}).value || '';
    var linkUrl = (document.getElementById('push-link-url') || {}).value || '';
    if (!linkUrl.trim()) { showToast('URL\uC744 \uC785\uB825\uD558\uC138\uC694', 'error'); return; }
    pushItems.push({ url: linkUrl.trim(), title: linkName.trim() || linkUrl.trim() });
  }
  
  showDeleteConfirm(selectedCodes.length + '\uAC1C \uCE58\uACFC\uC5D0 ' + pushItems.length + '\uAC1C \uB9C1\uD06C\uB97C \uBC30\uD3EC\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?',
    async function() {
    var successCount = 0, failCount = 0, failDetails = [];
    showToast('\uBC30\uD3EC \uC911... (' + selectedCodes.length + '\uAC1C \uCE58\uACFC)');
    
    // 모든 치과에 동시 병렬 배포
    var pushPromises = selectedCodes.map(async function(code) {
      try {
        var pRes = await fetch('/api/' + code + '/playlists');
        if (!pRes.ok) { failCount++; failDetails.push(code + ': \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8 \uC870\uD68C \uC2E4\uD328'); return; }
        var pData = await pRes.json();
        var targetPlaylists = (pData.playlists || []).filter(function(p) { return !p.is_master_playlist; });
        if (targetPlaylists.length === 0) { failCount++; failDetails.push(code + ': \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8 \uC5C6\uC74C'); return; }
        // 모든 플레이리스트에 라이브러리 + 재생목록 모두 추가
        for (var pi = 0; pi < targetPlaylists.length; pi++) {
          var playlist = targetPlaylists[pi];
          for (var j = 0; j < pushItems.length; j++) {
            var item = pushItems[j];
            var addRes = await fetch('/api/' + code + '/playlists/' + playlist.id + '/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: item.url, title: item.title, add_to_playlist: false })
            });
            if (addRes.ok) successCount++;
            else {
              failCount++;
              var errData = {};
              try { errData = await addRes.json(); } catch(e2) {}
              failDetails.push(code + ': ' + (errData.error || '\uCD94\uAC00 \uC2E4\uD328'));
            }
          }
        }
      } catch(e) { failCount++; failDetails.push(code + ': \uB124\uD2B8\uC6CC\uD06C \uC624\uB958'); }
    });
    
    await Promise.all(pushPromises);
    
    if (failCount > 0) {
      showToast('\uC131\uACF5 ' + successCount + '\uAC74 / \uC2E4\uD328 ' + failCount + '\uAC74', 'error');
      if (failDetails.length > 0) console.warn('\uBC30\uD3EC \uC2E4\uD328 \uC0C1\uC138:', failDetails);
    } else {
      showToast(selectedCodes.length + '\uAC1C \uCE58\uACFC\uC5D0 ' + successCount + '\uAC74 \uBC30\uD3EC \uC644\uB8CC!');
    }
    // 입력 초기화
    _pushTemplates = [];
    var nameEl = document.getElementById('push-link-name');
    var urlEl = document.getElementById('push-link-url');
    if (nameEl) nameEl.value = '';
    if (urlEl) urlEl.value = '';
    renderPushTemplates();
  }, { type: 'info', title: '\uB9C1\uD06C \uBC30\uD3EC', icon: 'fa-paper-plane', confirmText: '\uBC30\uD3EC' });
}

init();
