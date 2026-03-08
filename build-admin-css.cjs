#!/usr/bin/env node
/**
 * build-admin-css.cjs
 * src/index.tsx 전체를 스캔해서 실제 사용되는 Tailwind 클래스만 추출
 * → public/static/admin.css 에 저장 (Cloudflare Pages가 /static/admin.css 로 서빙)
 * → src/admin-styles.gen.css 에도 저장 (import 호환용 fallback)
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = __dirname
const srcFile = path.join(root, 'src/index.tsx')
const outFileStatic = path.join(root, 'public/static/admin.css')
const outFileSrc = path.join(root, 'src/admin-styles.gen.css')

// 1. src/index.tsx 전체를 스캔 대상으로 사용
const content = fs.readFileSync(srcFile, 'utf-8')
fs.writeFileSync('/tmp/admin_scan.html', content)

// 2. 최소 config (safelist 없이 실제 사용 클래스만)
const twConfig = `
module.exports = {
  content: ['/tmp/admin_scan.html'],
  safelist: [],
  theme: { extend: {} },
  plugins: [],
}
`
fs.writeFileSync('/tmp/tw_build_config.cjs', twConfig)

// 3. input CSS
fs.writeFileSync('/tmp/tw_input.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n')

// 4. Tailwind CLI 실행
try {
  execSync(
    'npx tailwindcss --config /tmp/tw_build_config.cjs -i /tmp/tw_input.css -o ' + outFileStatic + ' --minify',
    { cwd: root, stdio: 'pipe' }
  )
  // src/admin-styles.gen.css 에도 복사 (import 호환)
  fs.copyFileSync(outFileStatic, outFileSrc)
  const size = fs.statSync(outFileStatic).size
  console.log(`✅ Admin CSS: ${(size/1024).toFixed(1)}KB → public/static/admin.css (CDN 407KB 대비)`)
} catch (e) {
  console.error('❌ Tailwind build failed:', e.stderr?.toString() || e.message)
  // 실패해도 빈 파일 생성 (빌드 중단 방지)
  const empty = '/* tailwind build failed */'
  fs.writeFileSync(outFileStatic, empty)
  fs.writeFileSync(outFileSrc, empty)
}
