import { defineConfig, Plugin } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

/**
 * adminJsExtract 플러그인:
 * 빌드 결과물(_worker.js)에서 @@ADMIN_JS_BEGIN@@ ~ @@ADMIN_JS_END@@ 사이 코드를
 * admin.js 동적 로드 코드로 교체합니다.
 * 실제 JS는 prebuild(build-admin-css.cjs)가 public/static/admin.js로 미리 추출합니다.
 */
function adminJsExtract(): Plugin {
  // 빌드 시점 타임스탬프로 캐시 버스터 고정
  const buildTs = Date.now()
  return {
    name: 'admin-js-extract',
    generateBundle(_, bundle) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && chunk.code) {
          const BEGIN = '// @@ADMIN_JS_BEGIN@@'
          const END = '// @@ADMIN_JS_END@@'
          let code = chunk.code
          
          let startPos = code.indexOf(BEGIN)
          while (startPos !== -1) {
            const endPos = code.indexOf(END, startPos)
            if (endPos === -1) break
            // 마커 포함 블록을 admin.js 동적 로드 코드로 교체
            // 빌드 타임스탬프 기반 캐시 버스터
            const replacement = `
var _as = document.createElement("script");
_as.src = "/static/admin.js?v=${buildTs}";
document.currentScript.parentNode.appendChild(_as);
`
            code = code.slice(0, startPos) + replacement + code.slice(endPos + END.length)
            startPos = code.indexOf(BEGIN)
          }
          
          chunk.code = code
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [pages(), adminJsExtract()],
  build: {
    outDir: 'dist'
  }
})
