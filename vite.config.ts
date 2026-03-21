import { defineConfig, Plugin } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

/**
 * adminJsExtract 플러그인:
 * 빌드 결과물(_worker.js)에서 @@ADMIN_JS_BEGIN@@ ~ @@ADMIN_JS_END@@ 사이 코드를
 * 빈 문자열로 교체합니다.
 * 
 * admin.js 추출은 prebuild 스크립트(build-admin-css.cjs)에서 처리합니다.
 * - 이스케이프 복원 (\\\\→\\, \\`→`, \\${→${) 포함
 * - 4칸 들여쓰기 제거 포함
 * 이 플러그인은 _worker.js에서 해당 구간을 제거하는 역할만 합니다.
 */
function adminJsExtract(): Plugin {
  const BEGIN = '// @@ADMIN_JS_BEGIN@@'
  const END = '// @@ADMIN_JS_END@@'

  return {
    name: 'admin-js-extract',
    generateBundle(_, bundle) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && chunk.code) {
          let code = chunk.code
          
          let startPos = code.indexOf(BEGIN)
          while (startPos !== -1) {
            const endPos = code.indexOf(END, startPos)
            if (endPos === -1) break
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
