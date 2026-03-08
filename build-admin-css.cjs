#!/usr/bin/env node
/**
 * build-admin-css.cjs
 * 1. src/index.tsx 전체를 스캔해서 실제 사용되는 Tailwind 클래스만 추출
 *    → public/static/admin.css 에 저장
 * 2. src/index.tsx 에서 @@ADMIN_JS_BEGIN@@ ~ @@ADMIN_JS_END@@ 사이 JS 추출
 *    → public/static/admin.js 에 저장
 *    → src/index.tsx 에서 해당 구간을 defer src 참조로 교체
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = __dirname
const srcFile = path.join(root, 'src/index.tsx')
const outCssStatic = path.join(root, 'public/static/admin.css')
const outCssSrc = path.join(root, 'src/admin-styles.gen.css')
const outJs = path.join(root, 'public/static/admin.js')

// ── Step 1: CSS 빌드 ──────────────────────────────────────────
const content = fs.readFileSync(srcFile, 'utf-8')
fs.writeFileSync('/tmp/admin_scan.html', content)

const twConfig = `
module.exports = {
  content: ['/tmp/admin_scan.html'],
  safelist: [],
  theme: { extend: {} },
  plugins: [],
}
`
fs.writeFileSync('/tmp/tw_build_config.cjs', twConfig)
fs.writeFileSync('/tmp/tw_input.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n')

try {
  execSync(
    'npx tailwindcss --config /tmp/tw_build_config.cjs -i /tmp/tw_input.css -o ' + outCssStatic + ' --minify',
    { cwd: root, stdio: 'pipe' }
  )
  fs.copyFileSync(outCssStatic, outCssSrc)
  const cssSize = fs.statSync(outCssStatic).size
  console.log(`✅ Admin CSS: ${(cssSize/1024).toFixed(1)}KB → public/static/admin.css`)
} catch (e) {
  console.error('❌ Tailwind build failed:', e.stderr?.toString() || e.message)
  const empty = '/* tailwind build failed */'
  fs.writeFileSync(outCssStatic, empty)
  fs.writeFileSync(outCssSrc, empty)
}

// ── Step 2: JS 추출 ──────────────────────────────────────────
const BEGIN_MARKER = '// @@ADMIN_JS_BEGIN@@'
const END_MARKER = '// @@ADMIN_JS_END@@'

const beginIdx = content.indexOf(BEGIN_MARKER)
const endIdx = content.indexOf(END_MARKER)

if (beginIdx === -1 || endIdx === -1) {
  console.warn('⚠️  ADMIN_JS markers not found – skipping JS extraction')
} else {
  // 마커 사이의 JS 내용 추출 (마커 줄 제외)
  const jsContent = content.slice(beginIdx + BEGIN_MARKER.length, endIdx)
    .replace(/^\n/, '') // 첫 빈 줄 제거

  // 들여쓰기 4칸 제거 (template literal 안의 들여쓰기)
  // src/index.tsx 의 큰 template literal 안에서 이스케이프된 문자 복원:
  //   \\\\  →  \\   (이중 이스케이프된 백슬래시)
  //   \\`    →  `    (이스케이프된 백틱)
  //   \\${   →  ${   (이스케이프된 달러-중괄호)
  // 순서 중요: 백슬래시를 먼저 처리해야 함
  const dedentedJs = jsContent
    .split('\n')
    .map(line => line.startsWith('    ') ? line.slice(4) : line)
    .join('\n')
    .replace(/\\\\/g, '\\')   // \\\\ → \\
    .replace(/\\`/g, '`')         // \\` → `
    .replace(/\\\${/g, '${')     // \\${ → ${

  fs.mkdirSync(path.dirname(outJs), { recursive: true })
  fs.writeFileSync(outJs, dedentedJs)
  const jsSize = fs.statSync(outJs).size
  console.log(`✅ Admin JS:  ${(jsSize/1024).toFixed(1)}KB → public/static/admin.js`)
}
