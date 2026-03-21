import { defineConfig, Plugin } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

/**
 * adminJsExtract 플러그인:
 * 빌드 결과물(_worker.js)에서 @@ADMIN_JS_BEGIN@@ ~ @@ADMIN_JS_END@@ 사이 코드를
 * 빈 문자열로 교체합니다.
 * 소스에서 <script defer src="/static/admin.js"> 태그가 별도로 추가되어 있으므로,
 * 빌드 후에는 admin.js만 실행됩니다.
 */
function adminJsExtract(): Plugin {
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
            // 마커 포함 블록을 빈 문자열로 교체
            // admin.js는 별도 <script defer> 태그로 로드됨
            code = code.slice(0, startPos) + '/* [admin.js externalized] */' + code.slice(endPos + END.length)
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
