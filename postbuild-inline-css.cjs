#!/usr/bin/env node
/**
 * postbuild-inline-css.cjs
 * dist/_worker.js 내 @@ADMIN_CSS_INLINE@@ 플레이스홀더를
 * admin.css 내용으로 치환하여 CSS를 인라인화
 */
const fs = require('fs')
const path = require('path')

const workerFile = path.join(__dirname, 'dist/_worker.js')
const cssFile = path.join(__dirname, 'public/static/admin.css')

const PLACEHOLDER = '/* @@ADMIN_CSS_INLINE@@ */'

if (!fs.existsSync(workerFile)) {
  console.warn('⚠️  dist/_worker.js not found – skipping CSS inline')
  process.exit(0)
}

const worker = fs.readFileSync(workerFile, 'utf-8')
if (!worker.includes(PLACEHOLDER)) {
  console.warn('⚠️  @@ADMIN_CSS_INLINE@@ not found in _worker.js – skipping')
  process.exit(0)
}

const css = fs.readFileSync(cssFile, 'utf-8')
// _worker.js는 이미 빌드된 JS이므로 JS 문자열 리터럴 안의 이스케이프 처리
// vite가 template literal을 JS 문자열로 변환하므로, CSS 내의 특수문자를 이스케이프
const safeCss = css
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$')

const newWorker = worker.replace(PLACEHOLDER, safeCss)
fs.writeFileSync(workerFile, newWorker)

const savedKb = (css.length / 1024).toFixed(1)
console.log(`✅ Inlined admin.css (${savedKb}KB) into dist/_worker.js – no more render-blocking CSS request`)
