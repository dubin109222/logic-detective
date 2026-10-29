const { chapters, levels, bank: cases } = require('./content')
const legacy = require('./legacy').filter(q => q.g !== 2)
const { palette: colors, createUI } = require('./ui')
const allQuestions = [...cases, ...legacy]
const byId = new Map(allQuestions.map(q => [q.id, q]))
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const device = wx.getSystemInfoSync()
const W = device.windowWidth, H = device.windowHeight, ratio = device.pixelRatio || 1
const top = Math.max(12, device.safeArea ? device.safeArea.top : 20)
const bottom = device.safeArea ? Math.max(12, H - device.safeArea.bottom) : 18
const contentTop = top + 92, margin = 20, width = W - margin * 2
let contentBottom = H - bottom - 68
canvas.width = W * ratio
canvas.height = H * ratio
ctx.scale(ratio, ratio)
const ui = createUI(ctx)
const STORE = 'detective-v6'
function read(key) { try { return wx.getStorageSync(key) } catch (_) { return null } }
function bounded(value, low, high) { return Number.isFinite(value) ? Math.max(low, Math.min(high, Math.floor(value))) : low }
function cleanRecord(record) {
  return record && typeof record === 'object' && Number.isFinite(record.score) && Number.isFinite(record.total) && typeof record.date === 'string'
}
function load() {
  const raw = read(STORE) || {}
  const wrong = Array.isArray(raw.wrong) ? raw.wrong : []
  const stars = {}, perfect = {}, daily = {}, skills = {}
  for (const level of levels) {
    stars[level.id] = bounded(raw.stars && raw.stars[level.id], 0, 3)
    perfect[level.id] = !!(raw.perfect && raw.perfect[level.id]) && stars[level.id] === 3
  }
  // 从连续通过的关卡推导解锁，避免坏存档跳过关卡。
  let unlocked = 1
  while (unlocked < levels.length && stars[unlocked] > 0) unlocked++
  if (raw.daily && typeof raw.daily === 'object') {
    for (const key of Object.keys(raw.daily).sort().slice(-90)) {
      const entry = raw.daily[key]
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && entry && typeof entry === 'object' && entry.total === 10) daily[key] = { total: 10, best: Number.isFinite(entry.best) ? bounded(entry.best, 0, 10) : null, level: bounded(entry.level, 1, unlocked) }
    }
  }
  if (raw.skills && typeof raw.skills === 'object') for (const key of Object.keys(raw.skills)) {
    const value = raw.skills[key]
    if (value && typeof value === 'object') {
      const total = bounded(value.total, 0, 1000000)
      if (total > 0) skills[key] = { total, correct: bounded(value.correct, 0, total) }
    }
  }
  return { motion: raw.motion !== false, wrong: [...new Set(wrong.filter(id => byId.has(id)))], records: (Array.isArray(raw.records) ? raw.records : []).filter(r => cleanRecord(r) && !r.previous).slice(0, 50), stars, perfect, unlocked, daily, skills }
}
let data = load(), storageFailed = false
function save() {
  try { wx.setStorageSync(STORE, data); storageFailed = false } catch (_) {
    if (!storageFailed) wx.showToast({ title: '保存失败，请检查存储空间', icon: 'none' })
    storageFailed = true
  }
}
// 用户不再保留旧版存档；清理失败时保留当前进度并提示。
function discardOldSaves() {
  const raw = read(STORE)
  if (raw && Array.isArray(raw.records) && raw.records.some(r => r && r.previous)) save()
  try {
    for (const key of ['detective-v1', 'detective-v2', 'detective-v3', 'detective-v4', 'detective-v5']) wx.removeStorageSync(key)
  } catch (_) { wx.showToast({ title: '旧存档清理失败', icon: 'none' }) }
}
discardOldSaves()
function dateKey() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function totalStars() { return Object.values(data.stars).reduce((a, b) => a + b, 0) }
function rank() { const stars = totalStars(); return stars >= 50 ? '星级侦探' : stars >= 30 ? '资深侦探' : stars >= 10 ? '线索侦探' : '见习侦探' }
function chapterStars(index) { return levels.filter(l => l.chapter === index).reduce((n, l) => n + data.stars[l.id], 0) }
function shuffle(items, random = Math.random) {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
function seeded(seed) {
  let n = 2166136261
  for (const char of seed) n = Math.imul(n ^ char.charCodeAt(0), 16777619)
  return () => { n += 0x6d2b79f5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
function trimDaily() {
  const dates = Object.keys(data.daily).sort()
  while (dates.length > 90) delete data.daily[dates.shift()]
}
function dailyQuestions(day) {
  // 开始挑战时固定当天的解锁范围；当天继续闯关也不会更换题组。
  const cap = data.daily[day] ? data.daily[day].level : data.unlocked
  const available = levels.filter(l => l.id <= cap), random = seeded(`daily10:${day}:${cap}`)
  const first = shuffle(available, random).slice(0, 10).map(l => shuffle(l.questions, random)[0])
  const pool = shuffle(available.flatMap(l => l.questions), random)
  return first.concat(pool).filter((q, i, list) => list.findIndex(v => v.q === q.q) === i).slice(0, 10)
}
let page = 'home', chapter = 0, session = null, scroll = 0, maxScroll = 0, buttons = [], headerButtons = []
let memoryGame = null
const memoryPairs = [
  { symbol: '★', name: '星星', color: '#c69332' },
  { symbol: '●', name: '圆形', color: '#d77a69' },
  { symbol: '▲', name: '三角形', color: '#598ab3' },
  { symbol: '◆', name: '菱形', color: '#7b80ac' }
]
function startMemoryGame() {
  memoryGame = { cards: shuffle(memoryPairs.flatMap((_, pair) => [{ pair }, { pair }])), open: [], matched: [], attempts: 0 }
  navigate('memory')
}
function flipMemoryCard(index) {
  if (!memoryGame || !Number.isInteger(index) || index < 0 || index >= memoryGame.cards.length || memoryGame.matched.includes(index)) return
  if (memoryGame.open.length === 2) memoryGame.open = []
  if (memoryGame.open.includes(index)) return
  memoryGame.open.push(index)
  if (memoryGame.open.length === 2) {
    memoryGame.attempts++
    const [a, b] = memoryGame.open
    if (memoryGame.cards[a].pair === memoryGame.cards[b].pair) {
      memoryGame.matched.push(a, b)
      memoryGame.open = []
      animate('correct')
    }
  }
}
// 动画只在交互后运行，静止页面不循环绘制；没有帧 API 时直接显示最终状态。
let effect = null, frame = null, hidden = false, pressed = null
const hasFrames = typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function'
function effectProgress() { return effect ? Math.min(1, (Date.now() - effect.start) / effect.duration) : 1 }
function stopEffect() {
  if (frame !== null && hasFrames) cancelAnimationFrame(frame)
  frame = null; effect = null
}
function animate(kind = 'enter') {
  stopEffect()
  if (data.motion && hasFrames && !hidden) effect = { kind, start: Date.now(), duration: kind === 'reward' ? 1050 : kind === 'correct' ? 650 : 260 }
  draw()
}
function scheduleFrame() {
  if (!effect || frame !== null || hidden) return
  if (effectProgress() >= 1) { effect = null; return }
  frame = requestAnimationFrame(() => { frame = null; draw() })
}
function navigate(next) { page = next; scroll = 0; pressed = null; animate(next === 'result' ? 'reward' : 'enter') }
function toggleMotion() { data.motion = !data.motion; stopEffect(); save(); draw(); wx.showToast({ title: data.motion ? '动画已开启' : '动画已关闭', icon: 'none' }) }
function begin(mode, levelId = 0, grade = 2) {
  const day = dateKey()
  let questions
  if (mode === 'campaign') {
    if (!levels[levelId - 1] || levelId > data.unlocked) { wx.showToast({ title: '请先通过前一关', icon: 'none' }); return false }
    questions = levels[levelId - 1].questions.slice()
    chapter = levels[levelId - 1].chapter
  } else if (mode === 'daily') {
    if (!data.daily[day]) { data.daily[day] = { total: 10, best: null, level: data.unlocked }; trimDaily(); save() }
    questions = dailyQuestions(day)
  }
  else if (mode === 'review') questions = shuffle(data.wrong.map(id => byId.get(id)).filter(Boolean)).slice(0, 10)
  else questions = shuffle(legacy.filter(q => q.g === grade)).slice(0, 10)
  if (!questions.length) { wx.showToast({ title: '还没有错题，先去挑战吧', icon: 'none' }); return false }
  session = { mode, levelId, grade, day, list: questions.map(q => {
    const answers = shuffle(q.a.map((text, index) => ({ text, right: index === q.correct })))
    return { ...q, a: answers.map(a => a.text), correct: answers.findIndex(a => a.right) }
  }), index: 0, score: 0, choice: -1, hints: 0, hintsUsed: 0, streak: 0, bestStreak: 0, answers: [], done: false }
  navigate('quiz')
  return true
}
function revealHint() {
  if (!session || session.choice >= 0 || session.done) return
  const q = session.list[session.index], count = (q.hints || [q.hint]).length
  if (session.hints < count) { session.hints++; session.hintsUsed++; animate('hint') }
}
function answer(index) {
  if (!session || session.done || session.choice !== -1 || !Number.isInteger(index)) return
  const q = session.list[session.index]
  if (index < 0 || index >= q.a.length) return
  session.choice = index
  const correct = index === q.correct
  session.score += correct ? 1 : 0
  session.streak = correct ? session.streak + 1 : 0
  session.bestStreak = Math.max(session.bestStreak, session.streak)
  session.answers.push({ id: q.id, correct, hints: session.hints, type: q.type })
  if (correct) data.wrong = data.wrong.filter(id => id !== q.id)
  else if (!data.wrong.includes(q.id)) data.wrong.push(q.id)
  const skill = data.skills[q.type] || { correct: 0, total: 0 }
  skill.total++; if (correct) skill.correct++
  data.skills[q.type] = skill
  save(); animate(correct ? 'correct' : 'answer')
}
function finish() {
  if (session.done) return
  session.done = true
  session.stars = session.score === 10 ? 3 : session.score >= 8 ? 2 : session.score >= 6 ? 1 : 0
  const before = chapters.map((_, i) => chapterStars(i))
  if (session.mode === 'campaign') {
    data.stars[session.levelId] = Math.max(data.stars[session.levelId], session.stars)
    if (session.stars && session.levelId === data.unlocked) data.unlocked = Math.min(levels.length, data.unlocked + 1)
    if (session.score === session.list.length && session.hintsUsed === 0) data.perfect[session.levelId] = true
  }
  if (session.mode === 'daily') {
    const previous = data.daily[session.day]
    session.firstDaily = !previous || previous.best === null
    data.daily[session.day] = { total: 10, level: previous ? previous.level : data.unlocked, best: Math.max(previous && previous.best !== null ? previous.best : 0, session.score) }
    trimDaily()
  }
  session.newBadges = chapters.filter((_, i) => before[i] < 10 && chapterStars(i) >= 10).map(c => c.badge)
  data.records.unshift({ mode: session.mode, level: session.levelId, grade: session.grade, score: session.score, total: session.list.length, hints: session.hintsUsed, streak: session.bestStreak, date: session.day })
  data.records = data.records.slice(0, 50)
  save(); navigate('result')
}
function next() {
  if (!session || session.done || session.choice < 0) return
  if (session.index === session.list.length - 1) { finish(); return }
  session.index++; session.choice = -1; session.hints = 0; scroll = 0; animate()
}
function leave() {
  if (page === 'quiz' && session && !session.done) {
    wx.showModal({ title: '暂时离开调查？', content: '本轮不会计入通关记录。已答题的错题与学习统计会保留。', confirmText: '离开', cancelText: '继续调查', success: result => { if (result.confirm) navigate(session.mode === 'campaign' ? 'map' : 'home') } })
  } else navigate('home')
}
function lines(value, size, available) {
  ctx.font = `${size}px sans-serif`
  const result = []
  for (const paragraph of String(value).split('\n')) {
    let line = ''
    for (const char of paragraph) {
      if (line && ctx.measureText(line + char).width > available) { result.push(line); line = char } else line += char
    }
    result.push(line)
  }
  return result
}
function label(value, x, y, size = 16, color = colors.ink, bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = color; ctx.fillText(String(value), x, y)
}
function paragraph(value, x, y, available = width, size = 16, color = colors.ink, lineHeight = size + 8) {
  const rows = lines(value, size, available)
  rows.forEach((row, i) => label(row, x, y + i * lineHeight, size, color))
  return y + rows.length * lineHeight
}
function rectangle(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h) }
function note(value, y, color = colors.muted, size = 14) { return paragraph(value, margin, y, width, size, color) + 12 }
function card(title, description, y, fn, options = {}) {
  const inset = 17, titleSize = options.small ? 14 : 17, leading = options.icon ? 43 : 0
  const available = width - inset * 2 - leading - (fn ? 22 : 0)
  const titleRows = lines(title, titleSize, available)
  const bodyRows = description ? lines(description, 13, available) : []
  const height = Math.max(options.icon ? 78 : 58, 30 + titleRows.length * (titleSize + 7) + (bodyRows.length ? 6 + bodyRows.length * 21 : 0))
  const active = pressed && pressed.x === margin && pressed.y === y
  ui.rounded(margin, y + 2, width, height, '#e8ece5', 18)
  ui.rounded(margin, y, width, height, options.color || colors.white, 18, options.border)
  if (active) ui.rounded(margin, y, width, height, '#0000000d', 18)
  if (options.icon) {
    ui.rounded(margin + 14, y + 17, 34, 34, options.iconBg || colors.soft, 11)
    ui.icon(options.icon, margin + 21, y + 24, 20, options.iconColor || colors.primary)
  }
  paragraph(title, margin + inset + leading, y + 15, available, titleSize, options.ink || colors.ink)
  if (description) paragraph(description, margin + inset + leading, y + 21 + titleRows.length * (titleSize + 7), available, 13, options.bodyInk || options.ink || colors.muted, 21)
  if (fn) {
    ui.icon(options.arrow || 'chevron', W - margin - 33, y + (height - 18) / 2, 18, options.ink || colors.muted)
    buttons.push({ x: margin, y, w: width, h: height, action: fn })
  }
  return y + height + 13
}
function action(title, y, fn, color = colors.primary) { return card(title, '', y, fn, { color, ink: colors.white, arrow: 'arrow' }) }
function section(title, caption, y) {
  label(title, margin + 1, y + 4, 17, colors.ink, true)
  if (caption) { ctx.font = '11px sans-serif'; label(caption, W - margin - ctx.measureText(caption).width, y + 8, 11, colors.muted) }
  return y + 36
}
function progressBar(x, y, w, value, color = colors.primary) {
  ui.rounded(x, y, w, 6, colors.line, 3)
  if (value > 0) ui.rounded(x, y, Math.max(6, w * Math.min(1, value)), 6, color, 3)
}
function starsText(count) { return '★'.repeat(count) + '☆'.repeat(3 - count) }
function drawHome(y) {
  const compact = H < 620
  ui.rounded(margin, y, width, compact ? 128 : 178, colors.navy, 24)
  label('LITTLE DETECTIVE CLUB', margin + 20, y + (compact ? 14 : 20), 9, '#bad8c8', true)
  label('好奇心，就是', margin + 20, y + (compact ? 34 : 45), compact ? 20 : 24, colors.white, true)
  label('你的超能力。', margin + 20, y + (compact ? 60 : 77), compact ? 20 : 24, colors.white, true)
  label('不计时，慢慢发现每一条线索', margin + 20, y + (compact ? 101 : 122), W < 350 ? 10 : 11, '#c4dcd0')
  label('杜惟安同学加油！', margin + 20, y + (compact ? 115 : 146), compact ? 11 : 13, '#f2c76d', true)
  const mascotSize = compact ? 68 : W < 350 ? 83 : 104
  ui.mascot(W - margin - mascotSize - 9, y + (compact ? 40 : 48), mascotSize, effectProgress())
  y += compact ? 140 : 193
  ui.rounded(margin, y, width, compact ? 64 : 70, colors.white, 18)
  const metrics = [[totalStars(), '收集星星', 'star'], [Object.values(data.stars).filter(Boolean).length, '完成关卡', 'check'], [chapters.filter((_, i) => chapterStars(i) >= 10).length, '章节徽章', 'badge']]
  metrics.forEach(([value, name, icon], i) => {
    const x = margin + width * i / 3 + 15
    ui.icon(icon, x, y + 16, 16, i === 0 ? '#be8b32' : colors.primary)
    label(value, x + 23, y + 12, 21, colors.ink, true)
    label(name, x + 2, y + 44, 11, colors.muted)
    if (i < 2) rectangle(margin + width * (i + 1) / 3, y + 17, 1, 36, colors.line)
  })
  y += compact ? 76 : 88
  y = section('开启今天的调查', rank(), y)
  const current = levels[data.unlocked - 1]
  y = card(`第 ${data.unlocked} 关 · ${current.name}`, `${current.story}\n10 道线索 · 不计时`, y, () => begin('campaign', data.unlocked), { color: colors.primary, ink: colors.white, bodyInk: '#d5e9dc', icon: 'search', iconBg: '#ffffff20', iconColor: colors.white, arrow: 'arrow' })
  const daily = data.daily[dateKey()]
  y = card('每日挑战', daily && daily.best !== null ? `今日最佳 ${daily.best}/10 · 可以重试` : '每天 10 道不同题 · 当天题组固定', y, () => begin('daily'), { icon: 'calendar', iconBg: colors.warm, iconColor: '#b58838' })
  y = card('休息一下 · 记忆翻翻乐', '翻开卡片，找到 4 对相同图案', y, startMemoryGame, { icon: 'star', iconBg: colors.warm, iconColor: '#b58838' })
  y = card('错题档案', data.wrong.length ? `还有 ${data.wrong.length} 道线索等待破解` : '暂无错题，继续探索新案件吧', y, () => data.wrong.length ? begin('review') : navigate('map'), { icon: 'folder', iconBg: '#eaf0fa', iconColor: '#5f7faa' })
  y = section('更多探索', '4 章 / 20 关 / 200 题', y + 9)
  y = card('章节地图', '重访案件、摘取星星、收集徽章', y, () => { chapter = Math.floor((data.unlocked - 1) / 5); navigate('map') }, { icon: 'map' })
  y = card('其他年级体验', '一、三、四、五年级原版体验题', y, () => navigate('grades'), { icon: 'book', iconBg: colors.warm, iconColor: '#b58838' })
  return note('观察 · 思考 · 验证  /  进度仅保存在本机', y + 6, colors.muted, 11)
}
function drawMemory(y) {
  const game = memoryGame
  if (!game) return y
  y = card('记忆翻翻乐', '每次翻两张，找到相同图案。\n没有时间限制，慢慢玩吧！', y, null, { icon: 'star', iconBg: colors.warm, iconColor: '#b58838' })
  const done = game.matched.length === game.cards.length
  const status = done ? '太棒了，找到了全部 4 对！' : game.open.length === 2 ? '不一样，再点一张继续找' : `已找到 ${game.matched.length / 2} / 4 对`
  y = section(status, '', y)
  const gap = 8, tile = (width - gap * 3) / 4, tileHeight = Math.min(92, tile + 12)
  game.cards.forEach((item, index) => {
    const x = margin + (index % 4) * (tile + gap), rowY = y + Math.floor(index / 4) * (tileHeight + gap)
    const matched = game.matched.includes(index), visible = matched || game.open.includes(index), pair = memoryPairs[item.pair]
    ui.rounded(x, rowY + 2, tile, tileHeight, '#dce6de', 14)
    ui.rounded(x, rowY, tile, tileHeight, matched ? colors.soft : visible ? colors.white : colors.primary, 14, visible ? colors.line : undefined)
    if (visible) {
      ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = pair.color
      ctx.fillText(pair.symbol, x + tile / 2, rowY + 14)
      ctx.font = '11px sans-serif'; ctx.fillStyle = colors.ink; ctx.fillText(pair.name, x + tile / 2, rowY + tileHeight - 21)
    } else {
      ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e5f3e9'
      ctx.fillText('?', x + tile / 2, rowY + (tileHeight - 24) / 2)
      buttons.push({ x, y: rowY, w: tile, h: tileHeight, action: () => flipMemoryCard(index) })
    }
  })
  y += 2 * tileHeight + gap + 20
  y = card(done ? '再玩一次' : '重新洗牌', '换一组位置，重新开始', y, startMemoryGame, { icon: 'motion', iconBg: colors.warm })
  return card('返回侦探社', '休息好了，再继续探索', y, () => navigate('home'), { icon: 'home' })
}
function drawMap(y) {
  y = section('案件地图', `${totalStars()} / 60 星`, y)
  for (let i = 0; i < chapters.length; i++) {
    const locked = data.unlocked < i * 5 + 1, selected = i === chapter
    const tabWidth = (width - 10) / 2, x = margin + (i % 2) * (tabWidth + 10), tabY = y + Math.floor(i / 2) * 88
    ui.rounded(x, tabY, tabWidth, 78, selected ? colors.navy : colors.white, 16)
    ui.icon(locked ? 'lock' : 'map', x + 12, tabY + 14, 17, selected ? '#e8ca84' : colors.primary)
    label(chapters[i].name, x + 36, tabY + 15, 13, selected ? colors.white : colors.ink, true)
    label(`${chapterStars(i)} / 15 星${locked ? ' · 待解锁' : ''}`, x + 13, tabY + 43, 11, selected ? '#c1d8ca' : colors.muted)
    progressBar(x + 13, tabY + 63, tabWidth - 26, chapterStars(i) / 15, colors.gold)
    buttons.push({ x, y: tabY, w: tabWidth, h: 78, action: () => { chapter = i; scroll = 0; animate() } })
  }
  y += 185
  y = card(`CHAPTER 0${chapter + 1} · ${chapters[chapter].name}`, chapters[chapter].story, y, null, { color: colors.soft, icon: 'search' })
  for (const level of levels.filter(l => l.chapter === chapter)) {
    const locked = level.id > data.unlocked, count = data.stars[level.id], current = level.id === data.unlocked
    y = card(`第 ${level.id} 关 · ${level.name}`, `${level.goal}
${locked ? '通过上一关后解锁' : count ? `${starsText(count)}${data.perfect[level.id] ? ' · 独立满星' : ' · 可重玩摘星'}` : '等待你的第一条线索'}`, y, () => begin('campaign', level.id), { icon: locked ? 'lock' : count ? 'check' : 'search', color: locked ? '#edf0ea' : colors.white, ink: locked ? colors.muted : colors.ink, border: current ? colors.primary : undefined })
  }
  y = card(chapters[chapter].badge, `本章 ${chapterStars(chapter)}/15 星 · 累计 10 星获得徽章`, y, null, { icon: 'badge', color: colors.warm, iconBg: '#f6e3b4', iconColor: '#af8030' })
  return note('答对 6 / 8 / 10 题获得 1 / 2 / 3 星，提示不扣星。', y, colors.muted, 12)
}
function drawQuiz(y) {
  const q = session.list[session.index], hints = q.hints || [q.hint]
  const title = session.mode === 'campaign' ? `第 ${session.levelId} 关 · ${levels[session.levelId - 1].name}` : session.mode === 'daily' ? '每日挑战' : session.mode === 'review' ? '错题回顾' : `${session.grade} 年级体验`
  label(title, margin, y + 2, 16, colors.primary, true); y += 31
  label(q.type, margin, y, 12, colors.muted)
  label(`${session.index + 1} / ${session.list.length}`, W - margin - 37, y, 12, colors.primary, true)
  y += 25
  progressBar(margin, y, width, (session.index + 1) / session.list.length); y += 24
  if (session.mode === 'campaign') {
    if (session.index === 0) y = card('本次委托', levels[session.levelId - 1].story, y, null, { color: colors.soft, icon: 'search' })
    y = section(q.clueLabel, `线索 ${session.index + 1} / ${session.list.length}`, y)
  }
  y = card(q.q, '', y, null, { color: colors.white })
  if (q.visual) y = drawVisual(q, y)
  y = section('选择你的推理', session.streak >= 2 ? `已连续答对 ${session.streak} 题` : '认真想一想', y + 2)
  q.a.forEach((option, i) => {
    const answered = session.choice >= 0, right = answered && i === q.correct, wrong = session.choice === i && !right
    const color = right ? colors.soft : wrong ? '#f9e9e2' : colors.white
    const ink = right ? colors.success : wrong ? colors.error : colors.ink
    const rows = lines(option, 16, width - 91), height = Math.max(62, 30 + rows.length * 24)
    ui.rounded(margin, y, width, height, color, 17, right ? colors.success : wrong ? colors.error : colors.line)
    if (pressed && pressed.y === y) ui.rounded(margin, y, width, height, '#0000000d', 17)
    ui.rounded(margin + 14, y + 15, 32, 32, right ? colors.success : wrong ? colors.error : colors.bg, 10)
    if (right || wrong) ui.icon(right ? 'check' : 'close', margin + 20, y + 21, 20, colors.white)
    else label(String.fromCharCode(65 + i), margin + 24, y + 23, 14, colors.primary, true)
    paragraph(option, margin + 60, y + 19, width - 91, 16, ink, 24)
    if (!answered) buttons.push({ x: margin, y, w: width, h: height, role: 'answer', index: i, action: () => answer(i) })
    y += height + 11
  })
  if (session.choice < 0) {
    if (session.hints < hints.length) y = card(session.hints ? '再给一点线索' : '给我一点线索', '提示不扣星，试着自己找到答案', y + 5, revealHint, { icon: 'bulb', color: colors.warm, iconBg: '#f5e2b4', iconColor: '#a6782d' })
    for (let i = 0; i < session.hints; i++) y = card(`线索 ${i + 1}`, hints[i], y, null, { color: colors.warm, icon: 'bulb', iconBg: '#f5e2b4', iconColor: '#a6782d' })
  } else {
    const right = session.choice === q.correct
    y = card(right ? '漂亮！线索破解成功' : '没关系，再看看这条线索', right ? (session.streak >= 2 ? `已经连续答对 ${session.streak} 题，继续保持！` : '你的观察力又进步了一点。') : '正确答案已标记，读一读下面的侦探笔记。', y + 5, null, { color: right ? colors.soft : colors.warm, icon: right ? 'check' : 'bulb' })
    y = card('侦探笔记', q.explain, y, null, { color: colors.soft, icon: 'book' })
    y = action(session.index === session.list.length - 1 ? '完成调查，查看成果' : '下一条线索', y, next)
  }
  return note('不着急，可以上下滑动，慢慢思考。', y + 4, colors.muted, 12)
}
function drawVisual(q, y) {
  const v = q.visual, solved = session.choice >= 0
  if (!session.board || session.board.id !== q.id) session.board = { id: q.id, marks: {}, order: (v.items || []).slice(), selected: -1, fill: 0, position: v.start ? v.start.slice() : null, trail: v.start ? [v.start.slice()] : [] }
  const board = session.board, answerText = q.a[q.correct]
  const captions = {
    line: v.caption || '点卡片，可以做记号', pattern: '一组一组看，接着摆',
    countGroups: '点圆片做记号，数过的就不会漏掉', arrange: v.caption || '点两张卡片交换；想好后再选答案',
    compare: '两行左边对齐，看看哪边多', counters: v.mode === 'fill' ? '点空位，试着把圆片补满' : '点圆片，划掉送出的，再点可以恢复',
    shapes: '点符合条件的图案，做个记号', matching: '点空格做记号：勾 → 叉 → 清除',
    numberGrid: '点问号，可以试填 1、2、3', walk: '旗是起点，点箭头试着走，想好再选答案',
    equation: '把数放回问号里，看看对不对', steps: '从左到右，一次只算一步', candidates: '点包做记号，再看看两条线索'
  }
  const caption = solved ? '看图核对，再读一读下面的笔记' : captions[v.kind]
  const headingHeight = lines(caption, 12, width - 28).length * 18
  const body = y + 24 + headingHeight, left = margin + 14, inner = width - 28
  let bodyHeight = 68
  if (v.kind === 'pattern') bodyHeight = Math.ceil(v.items.length / 5) * 48
  else if (v.kind === 'countGroups') bodyHeight = v.counts.reduce((h, n) => h + 28 + Math.ceil(n / 5) * 35, 0)
  else if (v.kind === 'counters') bodyHeight = Math.ceil(v.total / 5) * 43 + 28
  else if (v.kind === 'shapes') bodyHeight = 128
  else if (v.kind === 'matching') bodyHeight = 170
  else if (v.kind === 'numberGrid') bodyHeight = 174
  else if (v.kind === 'walk') bodyHeight = 247
  else if (v.kind === 'compare') bodyHeight = 94
  else if (v.kind === 'candidates') bodyHeight = 102
  const height = body - y + bodyHeight + 10
  ui.rounded(margin, y, width, height, colors.white, 18)
  paragraph(caption, left, y + 14, inner, 12, colors.muted, 18)
  const paint = { 红: '#be5c52', 蓝: '#527aa4', 黄: '#bd913b' }
  function press(x, atY, w, h, fn) {
    if (!solved) buttons.push({ x, y: atY, w, h, role: 'visual', action: () => { fn(); draw() } })
  }
  function mark(key) { board.marks[key] = !board.marks[key] }
  function centered(value, x, atY, w, size = 15, color = colors.ink) {
    ctx.font = `${size}px sans-serif`
    label(value, x + (w - ctx.measureText(String(value)).width) / 2, atY, size, color)
  }
  if (v.kind === 'line' || v.kind === 'pattern') {
    const pattern = v.kind === 'pattern', columns = pattern ? 5 : v.items.length, cell = inner / columns
    v.items.forEach((original, i) => {
      const value = original === '?' && solved ? answerText : original
      const x = left + (i % columns) * cell, rowY = body + Math.floor(i / columns) * 48
      ui.rounded(x + 2, rowY, cell - 4, 40, board.marks[i] ? colors.soft : colors.bg, 9, board.marks[i] ? colors.primary : undefined)
      if (pattern && value !== '?') {
        ui.rounded(x + cell / 2 - 14, rowY + 5, 28, 22, paint[value], 4)
        centered(value, x, rowY + 28, cell, 10, colors.muted)
      } else if (value === '星') ui.star(x + cell / 2, rowY + 20, 11, colors.gold)
      else centered(value, x, rowY + 11, cell, typeof value === 'number' ? 16 : 14)
      press(x, rowY, cell, 40, () => mark(i))
    })
  } else if (v.kind === 'countGroups') {
    let rowY = body
    v.counts.forEach((count, group) => {
      label(v.labels[group], left, rowY + 2, 13, group ? paint.蓝 : paint.红)
      rowY += 25
      for (let i = 0; i < count; i++) {
        const x = left + 38 + i % 5 * 35, dotY = rowY + Math.floor(i / 5) * 35, key = `${group}-${i}`
        ui.circle(x + 15, dotY + 14, 11, group ? '#dae7f4' : '#f4ded8', group ? paint.蓝 : paint.红, 1.5)
        if (board.marks[key]) ui.icon('check', x + 6, dotY + 5, 18, colors.primary)
        press(x - 1, dotY - 2, 34, 34, () => mark(key))
      }
      rowY += Math.ceil(count / 5) * 35 + 3
    })
  } else if (v.kind === 'arrange') {
    const items = solved ? v.solution : board.order, cell = inner / 3
    items.forEach((value, i) => {
      const x = left + i * cell
      ui.rounded(x + 3, body, cell - 6, 47, solved ? colors.soft : colors.bg, 11, board.selected === i && !solved ? colors.primary : colors.line)
      centered(value, x, body + 16, cell, value.length > 3 ? 12 : 14)
      press(x + 3, body, cell - 6, 47, () => {
        if (board.selected < 0) board.selected = i
        else { [board.order[i], board.order[board.selected]] = [board.order[board.selected], board.order[i]]; board.selected = -1 }
      })
    })
    centered(v.orderLabel, left, body + 54, inner, 10, colors.muted)
  } else if (v.kind === 'compare') {
    v.counts.forEach((count, i) => {
      const atY = body + i * 43
      label(`${v.labels[i]}  ${count} 支`, left, atY, 13, colors.ink)
      ui.rounded(left, atY + 22, inner * count / Math.max(...v.counts), 12, i ? '#a7c0dc' : '#d99b8f', 4)
    })
  } else if (v.kind === 'counters') {
    const cell = Math.min(43, inner / 5), offset = left + (inner - cell * 5) / 2
    for (let i = 0; i < v.total; i++) {
      const x = offset + (i % 5) * cell, atY = body + Math.floor(i / 5) * 43
      const original = i < v.have, marked = solved ? v.mode === 'fill' ? !original : i < v.remove : !!board.marks[i]
      ui.circle(x + cell / 2, atY + 19, 13, original || marked ? colors.soft : colors.white, colors.primary, 1.5)
      if (marked) ui.icon(v.mode === 'fill' ? 'check' : 'close', x + cell / 2 - 9, atY + 10, 18, v.mode === 'fill' ? colors.primary : colors.error)
      if (v.mode === 'remove' || !original) press(x, atY, cell, 41, () => mark(i))
    }
    const markedCount = solved ? v.mode === 'fill' ? v.total - v.have : v.remove : Object.values(board.marks).filter(Boolean).length
    centered(`${solved ? '' : '试着'}${v.mode === 'fill' ? '补了' : '划掉'} ${markedCount} 个`, left, body + bodyHeight - 22, inner, 12, colors.muted)
  } else if (v.kind === 'shapes') {
    const cell = inner / 3
    v.items.forEach((item, i) => {
      const x = left + i % 3 * cell, atY = body + Math.floor(i / 3) * 62
      ui.rounded(x + 3, atY, cell - 6, 55, board.marks[i] ? colors.soft : colors.bg, 10)
      if (item.shape === '圆') ui.circle(x + cell / 2, atY + 20, 11, paint[item.color])
      else ui.rounded(x + cell / 2 - 11, atY + 9, 22, 22, paint[item.color], 2)
      centered(`${item.color}·${item.shape}`, x, atY + 37, cell, 10, colors.muted)
      press(x + 3, atY, cell - 6, 55, () => mark(i))
    })
  } else if (v.kind === 'matching') {
    const nameWidth = 47, cell = (inner - nameWidth) / 3
    v.items.forEach((name, i) => centered(name, left + nameWidth + i * cell, body, cell, 13))
    v.people.forEach((person, r) => {
      const atY = body + 28 + r * 45
      label(person, left, atY + 14, 13)
      v.items.forEach((item, c) => {
        const x = left + nameWidth + c * cell, key = `${r}-${c}`
        const known = person === v.known[0] && item === v.known[1], excluded = person === v.excluded[0] && item === v.excluded[1]
        const value = solved ? item === v.solution[r] ? 1 : 2 : known ? 1 : excluded ? 2 : board.marks[key] || 0
        ui.rounded(x + 2, atY, cell - 4, 42, known || solved && value === 1 ? colors.soft : colors.bg, 8)
        if (value) ui.icon(value === 1 ? 'check' : 'close', x + cell / 2 - 10, atY + 11, 20, value === 1 ? colors.primary : colors.muted)
        if (!known && !excluded) press(x + 2, atY, cell - 4, 42, () => { board.marks[key] = ((board.marks[key] || 0) + 1) % 3 })
      })
    })
  } else if (v.kind === 'numberGrid') {
    const cell = 55, startX = W / 2 - cell * 1.5
    v.cells.forEach((row, r) => row.forEach((value, c) => {
      const x = startX + c * cell, atY = body + r * cell, missing = value === null
      ui.rounded(x + 2, atY + 2, cell - 4, cell - 4, missing ? colors.warm : colors.bg, 9)
      centered(missing ? solved ? answerText : board.fill || '?' : value, x, atY + 16, cell, 22, missing ? colors.primary : colors.ink)
      if (missing) press(x + 2, atY + 2, cell - 4, cell - 4, () => { board.fill = (board.fill + 1) % 4 })
    }))
  } else if (v.kind === 'walk') {
    const cell = 56, startX = W / 2 - cell * 1.5
    let position = board.position, trail = board.trail
    if (solved) {
      position = v.start.slice(); trail = [position.slice()]
      for (const [direction, n] of v.moves) {
        position = [position[0] + (direction === '右' ? n : direction === '左' ? -n : 0), position[1] + (direction === '下' ? n : direction === '上' ? -n : 0)]
        trail.push(position.slice())
      }
    }
    v.places.forEach((place, i) => {
      const col = i % 3, row = Math.floor(i / 3), x = startX + col * cell, atY = body + row * cell
      const here = position[0] === col && position[1] === row, start = v.start[0] === col && v.start[1] === row
      ui.rounded(x + 2, atY + 2, cell - 4, cell - 4, here ? colors.soft : colors.bg, 8, here ? colors.primary : undefined)
      if (start) label('旗', x + 7, atY + 7, 10, '#a6782d')
      if (here) ui.circle(x + cell - 13, atY + 13, 4, colors.primary)
      centered(place, x, atY + 31, cell, 12)
    })
    if (trail.length > 1) ui.path(trail.map(([x, row]) => [startX + x * cell + cell / 2, body + row * cell + 17]), '#a7c6b2', 2)
    const controls = [['←', -1, 0], ['↑', 0, -1], ['↓', 0, 1], ['→', 1, 0], ['重来', 0, 0]], w = inner / 5
    controls.forEach(([text, dx, dy], i) => {
      const x = left + i * w, atY = body + 182
      ui.rounded(x + 2, atY, w - 4, 44, colors.bg, 9)
      centered(text, x, atY + 12, w, i === 4 ? 12 : 20, colors.primary)
      press(x + 2, atY, w - 4, 44, () => {
        if (i === 4) { board.position = v.start.slice(); board.trail = [v.start.slice()]; return }
        const next = [board.position[0] + dx, board.position[1] + dy]
        if (next.some(n => n < 0 || n > 2)) return
        board.position = next; board.trail.push(next.slice()); board.trail = board.trail.slice(-20)
      })
    })
  } else if (v.kind === 'equation' || v.kind === 'steps') {
    const parts = v.kind === 'equation' ? v.parts : v.items, cell = inner / parts.length
    parts.forEach((part, i) => {
      const x = left + i * cell
      ui.rounded(x + 2, body, cell - 4, 52, part === '?' ? colors.warm : colors.bg, 9)
      centered(part === '?' && solved ? answerText : part, x, body + 16, cell, v.kind === 'equation' ? 22 : 12, colors.primary)
    })
  } else if (v.kind === 'candidates') {
    const cell = inner / 3
    v.items.forEach((item, i) => {
      const x = left + i * cell, bagW = item.small ? 28 : 43, bagH = item.small ? 28 : 42
      ui.rounded(x + 2, body, cell - 4, 95, board.marks[i] ? colors.soft : colors.bg, 10)
      ui.rounded(x + (cell - bagW) / 2, body + 45 - bagH, bagW, bagH, paint[item.color], 6)
      centered(item.name, x, body + 54, cell, 14)
      centered(`${item.color}色·${item.small ? '小' : '大'}`, x, body + 77, cell, 10, colors.muted)
      press(x + 2, body, cell - 4, 95, () => mark(i))
    })
  }
  return y + height + 13
}
function drawResult(y) {
  const passed = session.score >= Math.ceil(session.list.length * 0.6)
  ui.rounded(margin, y, width, 230, colors.navy, 24)
  ui.circle(W / 2, y + 56, 32, '#355650')
  ui.icon(passed ? 'badge' : 'search', W / 2 - 20, y + 35, 40, colors.gold)
  const heading = passed ? '调查完成，侦探！' : '每次思考，都是进步'
  ctx.font = 'bold 23px sans-serif'
  label(heading, W / 2 - ctx.measureText(heading).width / 2, y + 105, 23, colors.white, true)
  const subtitle = `答对 ${session.score} / ${session.list.length} 题 · 最高连对 ${session.bestStreak} 题`
  ctx.font = '13px sans-serif'
  label(subtitle, W / 2 - ctx.measureText(subtitle).width / 2, y + 143, 13, '#c2dbce')
  const count = session.mode === 'campaign' ? session.stars : session.score === session.list.length ? 3 : session.score >= Math.ceil(session.list.length * 0.8) ? 2 : passed ? 1 : 0
  for (let i = 0; i < 3; i++) {
    const p = effect && effect.kind === 'reward' ? Math.max(0, Math.min(1, (effectProgress() * 1050 - i * 130) / 280)) : 1
    const scale = i < count ? 0.65 + 0.35 * p + Math.sin(p * Math.PI) * 0.18 : 1
    ui.star(W / 2 + (i - 1) * 44, y + 192, 16 * scale, i < count ? colors.gold : '#53716a')
  }
  y += 249
  if (session.mode === 'campaign') y = card('委托记录 · ' + levels[session.levelId - 1].name, passed ? '十条线索已经整理好，继续探索下一个故事吧。' : '十条线索都看过了，回看笔记，再试一次。', y, null, { icon: 'folder', color: colors.soft })
  y = note(`本轮使用 ${session.hintsUsed} 次提示 · 每条线索都值得认真思考`, y, colors.muted, 12)
  if (session.mode === 'campaign') {
    y = note(`${starsText(session.stars)}  本关最佳 ${starsText(data.stars[session.levelId])}`, y, colors.primary, 18)
    y = note(passed ? session.levelId === 20 ? '恭喜完成全部 20 关！可以继续收集满星与独立满星标记。' : `下一站：第 ${session.levelId + 1} 关。` : '本关答对 6 题即可解锁下一关。看看解析，再试一次。', y)
    if (session.score === session.list.length && session.hintsUsed === 0) y = card('独立满星', '十题全对，并且没有使用提示。', y, null, { color: colors.warm, icon: 'badge', iconBg: '#f5e2b4', iconColor: '#a6782d' })
    for (const badge of session.newBadges) y = card(`获得徽章：${badge}`, '本章累计达到 10 星。', y, null, { color: colors.warm, icon: 'badge', iconBg: '#f5e2b4', iconColor: '#a6782d' })
    if (passed && session.levelId < levels.length) y = action('前往下一关', y, () => begin('campaign', session.levelId + 1))
    y = action('重玩本关', y, () => begin('campaign', session.levelId))
    y = card('返回章节地图', '', y, () => navigate('map'), { icon: 'map' })
  } else if (session.mode === 'daily') {
    y = note(`今日最佳：${data.daily[session.day].best}/10。${session.firstDaily ? '已记录今日挑战。' : '已更新本日最佳成绩。'}`, y)
    y = action('再次挑战今日题组', y, () => begin('daily'))
  } else if (session.mode === 'review') {
    y = note(`错题档案还剩 ${data.wrong.length} 道。`, y)
    if (data.wrong.length) y = action('继续整理错题', y, () => begin('review'))
  } else y = action('再来一组', y, () => begin('practice', 0, session.grade))
  const incorrect = session.answers.filter(a => !a.correct)
  if (incorrect.length) {
    y = note('本轮待复习', y, colors.primary, 17)
    for (const item of incorrect) { const q = byId.get(item.id); y = card(q.type, q.q + '\n\n' + q.explain, y, null) }
  }
  return card('返回侦探社', '', y, () => navigate('home'), { icon: 'home' })
}
function drawRecords(y) {
  y = card(rank(), `${totalStars()}/60 星 · 独立满星 ${Object.values(data.perfect).filter(Boolean).length}/20 关\n已完成 ${Object.values(data.daily).filter(d => d.best !== null).length} 天每日挑战`, y, null, { color: colors.soft, icon: 'search' })
  y = section('我的章节徽章', '10 星点亮一枚', y + 4)
  for (let i = 0; i < chapters.length; i++) y = card(`${chapterStars(i) >= 10 ? '已获得' : '待收集'} · ${chapters[i].badge}`, `${chapters[i].name} · ${chapterStars(i)}/15 星`, y, null, { icon: chapterStars(i) >= 10 ? 'badge' : 'lock', color: chapterStars(i) >= 10 ? colors.warm : colors.white, iconColor: chapterStars(i) >= 10 ? '#a6782d' : colors.muted })
  const skills = Object.entries(data.skills).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
  y = note('题型观察 · 正确率从低到高', y, colors.primary, 17)
  if (!skills.length) y = card('你的第一条线索，正等着你', '完成调查后，这里会留下你的成长轨迹。', y, () => begin('campaign', data.unlocked), { icon: 'search', color: colors.soft })
  for (const [type, skill] of skills) y = card(type, `${skill.correct}/${skill.total} 题答对 · ${Math.round(skill.correct / skill.total * 100)}%${skill.total < 5 ? ' · 样本较少' : ''}`, y, null)
  y = note('最近练习 · 最多保留 50 次', y, colors.primary, 17)
  if (!data.records.length) y = note('还没有完成的练习。', y)
  for (const record of data.records) {
    const title = record.mode === 'campaign' ? `闯关 · 第 ${record.level} 关` : record.mode === 'daily' ? '每日挑战' : record.mode === 'review' ? '错题回顾' : record.mode === 'legacy' ? '旧版练习' : `${record.grade} 年级体验`
    y = card(`${record.date} · ${title}`, `答对 ${record.score}/${record.total}${Number.isFinite(record.hints) ? ` · 使用 ${record.hints} 次提示` : ''}`, y, null, { small: true })
  }
  return note('正确率包含重玩、提示作答和复习，用于观察练习情况。', y)
}
function drawNavigation() {
  if (page === 'quiz' || page === 'result') return
  const navY = H - bottom - 60
  ui.rounded(margin - 4, navY, width + 8, 58, colors.white, 20, colors.line)
  const tabs = [['home', 'home', '侦探社'], ['map', 'map', '案件地图'], ['records', 'badge', '我的档案']]
  tabs.forEach(([target, icon, name], i) => {
    const w = (width + 8) / 3, x = margin - 4 + i * w, active = page === target
    if (active) ui.rounded(x + 8, navY + 5, w - 16, 48, colors.soft, 14)
    ui.icon(icon, x + w / 2 - 10, navY + 10, 20, active ? colors.primary : colors.muted)
    label(name, x + w / 2 - 22, navY + 35, 11, active ? colors.primary : colors.muted, active)
    headerButtons.push({ x, y: navY, w, h: 58, action: () => { if (target !== page) { if (target === 'map') chapter = Math.floor((data.unlocked - 1) / 5); navigate(target) } } })
  })
}
function drawParticles() {
  if (!effect || !['correct', 'reward'].includes(effect.kind)) return
  if (page === 'result' && session.score < Math.ceil(session.list.length * 0.6)) return
  const p = effectProgress(), reward = effect.kind === 'reward'
  ctx.save(); ctx.globalAlpha = (1 - p) * 0.85
  for (let i = 0; i < (reward ? 22 : 10); i++) {
    const angle = i * 2.39996, radius = (reward ? 70 : 25) + p * (reward ? 170 : 85)
    const x = W / 2 + Math.cos(angle) * radius
    const y = contentTop + (reward ? 105 : 65) + Math.sin(angle) * radius * 0.65 + p * p * 85
    if (i % 3 === 0) ui.star(x, y, 3 + i % 4, colors.gold)
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(angle + p * 4); ui.rounded(-2, -4, 4, 8, [colors.primary, colors.gold, '#93bca8'][i % 3], 1); ctx.restore() }
  }
  ctx.restore()
}
function draw() {
  buttons = []; headerButtons = []
  contentBottom = H - bottom - (page === 'quiz' || page === 'result' ? 0 : 72)
  rectangle(0, 0, W, H, colors.bg)
  ctx.save(); ctx.beginPath(); ctx.rect(0, contentTop, W, Math.max(0, contentBottom - contentTop)); ctx.clip(); ctx.translate(0, -scroll)
  if (effect && ['enter', 'hint', 'answer'].includes(effect.kind)) ctx.globalAlpha = 0.35 + 0.65 * (1 - Math.pow(1 - effectProgress(), 3))
  let y = contentTop + 10
  if (page === 'home') y = drawHome(y)
  else if (page === 'map') y = drawMap(y)
  else if (page === 'quiz') y = drawQuiz(y)
  else if (page === 'result') y = drawResult(y)
  else if (page === 'records') y = drawRecords(y)
  else if (page === 'memory') y = drawMemory(y)
  else if (page === 'grades') {
    y = card('给好奇心，多一点空间', '当前主线按二年级上学期入门设计。这里也保留了其他年级的原版体验题。', y, null, { icon: 'book', color: colors.soft })
    for (const grade of [1, 3, 4, 5]) y = card(`${grade} 年级体验`, '随机 10 道题 · 不计时，慢慢想', y, () => begin('practice', 0, grade), { icon: 'book' })
  }
  ctx.restore()
  maxScroll = Math.max(0, y + 16 - contentBottom)
  const clamped = Math.max(0, Math.min(scroll, maxScroll))
  if (clamped !== scroll) { scroll = clamped; draw(); return }
  rectangle(0, 0, W, contentTop, colors.bg)
  ui.rounded(margin, top + 5, 33, 33, colors.primary, 11)
  ui.icon('search', margin + 6, top + 11, 21, colors.white)
  // 首行右侧为微信胶囊预留空间，操作按钮放在下一行。
  label('小小逻辑侦探', margin + 43, top + 5, W < 350 ? 17 : 20, colors.ink, true)
  label('LITTLE DETECTIVE', margin + 44, top + 31, 8, colors.muted, true)
  const heading = { home: '二年级上学期 · 观察与思考', map: '一张地图，二十个小小冒险', quiz: '现场调查', result: '调查成果', records: '每一步，都算数', grades: '更多年级体验', memory: '益智休息时间' }[page]
  label(heading, margin + (page === 'home' ? 0 : 25), top + 62, 13, colors.muted)
  if (page !== 'home') {
    ui.icon('back', margin - 2, top + 57, 22)
    headerButtons.push({ x: margin - 8, y: top + 48, w: Math.min(width - 80, 220), h: 40, action: leave })
  }
  const toggleX = W - margin - 64
  ui.rounded(toggleX, top + 51, 64, 32, colors.white, 12, colors.line)
  ui.icon(data.motion ? 'motion' : 'pause', toggleX + 7, top + 58, 18, colors.primary)
  label(data.motion ? '动效' : '静态', toggleX + 31, top + 61, 11, colors.primary)
  headerButtons.push({ x: toggleX, y: top + 45, w: 68, h: 44, action: toggleMotion })
  drawNavigation()
  if (maxScroll) {
    const area = contentBottom - contentTop, size = Math.max(24, area * area / (area + maxScroll))
    ui.rounded(W - 6, contentTop + (area - size) * scroll / maxScroll, 3, size, '#bdcfc4', 1.5)
  }
  ctx.save(); ctx.beginPath(); ctx.rect(0, contentTop, W, Math.max(0, contentBottom - contentTop)); ctx.clip(); drawParticles(); ctx.restore()
  scheduleFrame()
}
let touch = null
function hitButton(button, x, y) { return x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h }
wx.onTouchStart(event => {
  const point = event.touches[0]
  if (!point) return
  const canScroll = point.clientY >= contentTop && point.clientY <= contentBottom
  touch = { x: point.clientX, y: point.clientY, scroll, moved: false, canScroll }
  pressed = canScroll ? buttons.find(b => hitButton(b, point.clientX, point.clientY + scroll)) : null
  draw()
})
wx.onTouchMove(event => {
  if (!touch || !event.touches[0]) return
  const point = event.touches[0], delta = point.clientY - touch.y
  if (Math.abs(delta) > 8 || Math.abs(point.clientX - touch.x) > 8) touch.moved = true
  if (touch.moved) pressed = null
  if (touch.moved && touch.canScroll) { scroll = Math.max(0, Math.min(maxScroll, touch.scroll - delta)); draw() }
})
wx.onTouchEnd(event => {
  if (!touch) return
  const start = touch; touch = null; pressed = null
  const point = event.changedTouches[0]
  if (!point || start.moved || Math.abs(point.clientX - start.x) > 8 || Math.abs(point.clientY - start.y) > 8) { draw(); return }
  const header = headerButtons.find(b => hitButton(b, point.clientX, point.clientY) && hitButton(b, start.x, start.y))
  if (header) { header.action(); draw(); return }
  if (!start.canScroll || point.clientY < contentTop || point.clientY > contentBottom) { draw(); return }
  const button = buttons.find(b => hitButton(b, point.clientX, point.clientY + scroll) && hitButton(b, start.x, start.y + start.scroll))
  if (button) button.action()
  draw()
})
if (wx.onTouchCancel) wx.onTouchCancel(() => { touch = null; pressed = null; draw() })
if (wx.onHide) wx.onHide(() => { hidden = true; touch = null; pressed = null; stopEffect() })
if (wx.onShow) wx.onShow(() => { hidden = false; draw() })
draw()
// 供离线逻辑与画布回归检查使用；游戏运行仍由 wx 事件驱动。
module.exports = { begin, answer, revealHint, next, navigate, dailyQuestions, dateKey, startMemoryGame, flipMemoryCard, getState: () => ({ page, chapter, session, memoryGame, data, scroll, maxScroll, buttons, headerButtons, contentTop, contentBottom, effect, frame, pressed }) }
