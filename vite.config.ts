import { defineConfig, Plugin } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

/**
 * adminJsExtract 플러그인:
 * 빌드 결과물(_worker.js)에서 @@ADMIN_JS_BEGIN@@ ~ @@ADMIN_JS_END@@ 사이 코드를
 * `// [extracted to /static/admin.js]` 주석으로 교체합니다.
 * 실제 JS는 prebuild(build-admin-css.cjs)가 public/static/admin.js로 미리 추출합니다.
 */
function adminJsExtract(): Plugin {
  return {
    name: 'admin-js-extract',
    generateBundle(_, bundle) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && chunk.code) {
          // @@ADMIN_JS_BEGIN@@ ~ @@ADMIN_JS_END@@ 사이의 JS를 플레이스홀더로 교체
          // 단, 이 코드는 worker 번들 안의 문자열이므로 이스케이프에 주의
          const BEGIN = '// @@ADMIN_JS_BEGIN@@'
          const END = '// @@ADMIN_JS_END@@'
          let code = chunk.code
          
          let startPos = code.indexOf(BEGIN)
          while (startPos !== -1) {
            const endPos = code.indexOf(END, startPos)
            if (endPos === -1) break
            // 마커 포함 블록을 빈 문자열로 교체
            const replacement = ''
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
