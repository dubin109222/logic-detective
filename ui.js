// 纯 Canvas 矢量组件，不依赖图片、网络或字体图标。
const palette = {
  bg: '#f5f6f2', ink: '#203c3b', muted: '#71837e', primary: '#25776a',
  soft: '#e4f1e9', success: '#25776a', error: '#b85f51', gold: '#efbc55',
  white: '#ffffff', line: '#e3e9e2', warm: '#fcf0d4', navy: '#213f3d'
}
function createUI(ctx) {
  function rounded(x, y, w, h, fill, r = 18, stroke) {
    r = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.beginPath(); ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke() }
  }
  function circle(x, y, r, fill, stroke, line = 2) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke() }
  }
  function path(points, color, line = 2, close = false, fill = false) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    if (close) ctx.closePath()
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = line
    if (fill) ctx.fill(); else ctx.stroke()
  }
  function star(x, y, size, color) {
    const points = Array.from({ length: 10 }, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI / 5, r = size * (i % 2 ? 0.46 : 1)
      return [x + Math.cos(angle) * r, y + Math.sin(angle) * r]
    })
    path(points, color, 1, true, true)
  }
  function icon(name, x, y, size = 24, color = palette.primary) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (name === 'search') { circle(10, 10, 6.5, null, color); path([[15, 15], [21, 21]], color, 3) }
    else if (name === 'arrow') path([[5, 12], [19, 12], [14, 7], [19, 12], [14, 17]], color)
    else if (name === 'chevron') path([[9, 6], [15, 12], [9, 18]], color)
    else if (name === 'back') path([[15, 6], [9, 12], [15, 18]], color)
    else if (name === 'check') path([[5, 12], [10, 17], [20, 6]], color, 2.5)
    else if (name === 'close') { path([[7, 7], [17, 17]], color); path([[17, 7], [7, 17]], color) }
    else if (name === 'star') star(12, 12, 10, color)
    else if (name === 'home') { path([[3, 10], [12, 3], [21, 10]], color); path([[6, 9], [6, 21], [18, 21], [18, 9]], color); path([[10, 21], [10, 15], [14, 15], [14, 21]], color) }
    else if (name === 'map') { path([[3, 5], [9, 3], [15, 6], [21, 3], [21, 19], [15, 22], [9, 19], [3, 21]], color, 1.8, true); path([[9, 3], [9, 19]], color); path([[15, 6], [15, 22]], color) }
    else if (name === 'calendar') { rounded(3, 5, 18, 16, null, 3, color); path([[3, 10], [21, 10]], color); path([[8, 2], [8, 7]], color); path([[16, 2], [16, 7]], color); star(12, 15, 3.5, color) }
    else if (name === 'folder') { path([[3, 7], [3, 4], [10, 4], [13, 7], [21, 7], [21, 20], [3, 20]], color, 2, true); path([[8, 12], [16, 12]], color); path([[8, 16], [13, 16]], color) }
    else if (name === 'badge') { circle(12, 9, 6, null, color); path([[8, 14], [6, 22], [12, 19], [18, 22], [16, 14]], color); star(12, 9, 3, color) }
    else if (name === 'bulb') { circle(12, 9, 6, null, color); rounded(9, 14, 6, 5, color, 1); path([[10, 22], [14, 22]], color); path([[12, 0], [12, 1]], color); path([[1, 8], [3, 8]], color); path([[21, 8], [23, 8]], color) }
    else if (name === 'lock') { rounded(5, 10, 14, 11, null, 3, color); ctx.beginPath(); ctx.arc(12, 10, 4, Math.PI, 0); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); circle(12, 15, 1.5, color) }
    else if (name === 'book') { path([[12, 6], [7, 3], [2, 4], [2, 20], [7, 19], [12, 22], [17, 19], [22, 20], [22, 4], [17, 3], [12, 6], [12, 22]], color, 1.8) }
    else if (name === 'motion') { star(14, 10, 7, color); path([[2, 7], [5, 7]], color); path([[1, 12], [5, 12]], color); path([[3, 17], [7, 17]], color) }
    else if (name === 'pause') { rounded(6, 4, 4, 16, color, 2); rounded(14, 4, 4, 16, color, 2) }
    ctx.restore()
  }
  function mascot(x, y, size = 100, progress = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100)
    circle(50, 50, 46, '#dcebe1')
    // 侦探帽、风衣与放大镜。
    rounded(22, 65, 57, 34, '#e4b661', 20)
    path([[39, 65], [50, 88], [61, 65]], '#f7e2b5', 1, true, true)
    circle(50, 47, 23, '#f9d9ab')
    rounded(27, 19, 46, 22, palette.navy, 9)
    rounded(20, 35, 60, 9, palette.primary, 4)
    rounded(30, 29, 40, 6, '#d6ac60', 2)
    circle(42, 50, 2, palette.navy); circle(59, 50, 2, palette.navy)
    path([[46, 59], [50, 61], [54, 59]], palette.navy, 1.8)
    ctx.save(); ctx.translate(75, 61); ctx.rotate(-0.12 + Math.sin(progress * Math.PI) * 0.22)
    path([[0, 5], [13, 23]], palette.navy, 7); circle(-3, -2, 13, '#def2eb', palette.navy, 4)
    path([[-9, -5], [-5, -9]], '#ffffff', 3); ctx.restore()
    star(13, 15, 5, palette.gold); star(87, 35, 4, palette.primary)
    ctx.restore()
  }
  return { rounded, circle, path, star, icon, mascot }
}
module.exports = { palette, createUI }
