const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const content = require('../content')
const legacy = require('../legacy')
const ui = require('../ui')
function boot(store = {}, w = 375, h = 667, failStorage = false, animated = false) {
  let now = 0, frameId = 0
  const frames = new Map()
  const events = {}, toasts = [], context = new Proxy({ measureText: text => ({ width: Array.from(text).length * 16 }) }, { get: (target, key) => target[key] || (() => {}) })
  const wx = {
    createCanvas: () => ({ getContext: () => context }), getSystemInfoSync: () => ({ windowWidth: w, windowHeight: h, pixelRatio: 2, safeArea: { top: 20, bottom: h - 20 } }),
    getStorageSync: key => store[key], removeStorageSync: key => { delete store[key] }, setStorageSync: (key, value) => { if (failStorage) throw new Error('storage full'); store[key] = JSON.parse(JSON.stringify(value)) },
    showToast: value => toasts.push(value), showModal: value => value.success({ confirm: true }),
    onTouchStart: fn => { events.start = fn }, onTouchMove: fn => { events.move = fn }, onTouchEnd: fn => { events.end = fn }, onTouchCancel: fn => { events.cancel = fn }, onShow: fn => { events.show = fn }, onHide: fn => { events.hide = fn }
  }
  const sandbox = { wx, module: { exports: {} }, require: name => ({ './content': content, './legacy': legacy, './ui': ui })[name], Date, Math, Map, console }
  if (animated) {
    sandbox.Date = class extends Date { static now() { return now } }
    sandbox.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
    sandbox.cancelAnimationFrame = id => frames.delete(id)
  }
  function advance(ms) { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), sandbox)
  return { api: sandbox.module.exports, events, store, toasts, frames, advance }
}
let passed = 0
function test(name, fn) { fn(); passed++; console.log('PASS', name) }
test('memory game handles mismatches, matches, replay and leaves progress unchanged', () => {
  const { api } = boot({}, 320, 568)
  const progress = JSON.stringify(api.getState().data)
  api.startMemoryGame()
  let game = api.getState().memoryGame
  assert.equal(api.getState().page, 'memory')
  assert.equal(game.cards.length, 8)
  const first = 0, different = game.cards.findIndex(card => card.pair !== game.cards[first].pair)
  api.flipMemoryCard(first); api.flipMemoryCard(first)
  assert.equal(game.open.length, 1)
  api.flipMemoryCard(different)
  assert.equal(game.open.length, 2); assert.equal(game.attempts, 1)
  const partner = game.cards.findIndex((card, i) => i !== first && card.pair === game.cards[first].pair)
  api.flipMemoryCard(first); api.flipMemoryCard(partner)
  assert.equal(game.matched.length, 2); assert.equal(game.open.length, 0)
  for (let pair = 0; pair < 4; pair++) {
    const indices = game.cards.map((card, i) => card.pair === pair && !game.matched.includes(i) ? i : -1).filter(i => i >= 0)
    indices.forEach(i => api.flipMemoryCard(i))
  }
  assert.equal(game.matched.length, 8)
  api.flipMemoryCard(first); assert.equal(game.open.length, 0)
  api.startMemoryGame(); game = api.getState().memoryGame
  assert.equal(game.matched.length, 0); assert.equal(game.attempts, 0)
  api.navigate('home'); assert.equal(JSON.stringify(api.getState().data), progress)
})
function complete(api, score = 10, hint = false) {
  for (let i = 0; i < api.getState().session.list.length; i++) {
    const s = api.getState().session, q = s.list[s.index]
    if (hint) api.revealHint()
    api.answer(i < score ? q.correct : (q.correct + 1) % q.a.length)
    api.next()
  }
}
function permutations(items) {
  if (!items.length) return [[]]
  return items.flatMap((v, i) => permutations(items.filter((_, j) => j !== i)).map(rest => [v, ...rest]))
}
function sequenceSolution(v) {
  const choices = permutations(v.items).filter(order => v.before.every(([a, b]) => order.indexOf(a) < order.indexOf(b)))
  assert.equal(choices.length, 1)
  return choices[0]
}
function matchingAnswer(q) {
  const v = q.visual, solutions = permutations(v.items).filter(order => order[v.people.indexOf(v.known[0])] === v.known[1] && order[v.people.indexOf(v.excluded[0])] !== v.excluded[1])
  assert.equal(solutions.length, 1)
  assert.deepEqual(v.solution, solutions[0])
  const person = v.people.find(p => q.q.endsWith(p + '养什么？') || q.q.endsWith(p + '拿什么？'))
  assert.ok(person)
  return solutions[0][v.people.indexOf(person)]
}
function gridAnswer(q) {
  const grid = q.visual.cells, candidates = [1, 2, 3].filter(n => {
    const filled = grid.map(row => row.map(v => v === null ? n : v))
    return filled.every(row => new Set(row).size === 3) && [0, 1, 2].every(c => new Set(filled.map(row => row[c])).size === 3)
  })
  assert.equal(candidates.length, 1)
  return candidates[0]
}
function walkAnswer(q) {
  const v = q.visual, at = v.start.slice(), moves = [...q.q.matchAll(/向([左右上下])走 (\d) 格/g)]
  assert.equal(moves.length, 2)
  for (const [, direction, size] of moves) {
    at[0] += direction === '右' ? Number(size) : direction === '左' ? -Number(size) : 0
    at[1] += direction === '下' ? Number(size) : direction === '上' ? -Number(size) : 0
    assert.ok(at.every(n => n >= 0 && n < 3))
  }
  return v.places[at[1] * 3 + at[0]]
}
test('200 age-fit questions with short prompts, valid choices and two-step guidance', () => {
  assert.equal(content.levels.length, 20); assert.equal(content.bank.length, 200)
  assert.equal(new Set(content.bank.map(q => q.id)).size, 200)
  for (const level of content.levels) { assert.equal(new Set(level.questions.map(q => q.type)).size, 10); assert.ok(level.story && level.name) }
  for (const level of content.levels) assert.equal(new Set(level.questions.map(q => q.q)).size, 10)
  for (const q of content.bank) {
    assert.ok(q.id.startsWith('g2c-') || q.id.startsWith('fun-')); assert.equal(q.g, 2)
    assert.equal(q.a.length, 3); assert.equal(new Set(q.a).size, 3)
    assert.ok(q.correct >= 0 && q.correct < 3)
    assert.equal(q.hints.length, 2); assert.ok(q.hints.every(h => h.length > 5 && h.length <= 45))
    assert.ok(q.q.length <= 60, q.id + ': ' + q.q)
    assert.ok(q.explain.includes('①') && q.explain.includes('②'))
    assert.ok(!/÷|千克|分钟|保证至少|封闭路口|恰好一人|方法数|整数/.test(q.q + q.explain), q.id)
    assert.ok(q.a.every(a => !/^-\d/.test(a)))
  }
})
test('all 200 answers independently satisfy quantities, visual clues and unique logic solutions', () => {
  let checked = 0
  for (const q of content.bank) {
    const level = q.skill, seed = Number(q.id.split('-')[2]), v = q.visual, nums = (q.q.match(/\d+/g) || []).map(Number)
    let expected
    if (q.id.startsWith('fun-')) expected = ['足球', '雨伞', '长颈鹿', '气球', '钥匙', '胡萝卜', '钟表', '彩笔', '鱼缸', '摇铃铛'][Number(q.id.split('-')[1])]
    else if (level === 1 || level === 20 && seed === 0) {
      const steps = nums.slice(1, 4).map((n, i) => n - nums[i]); assert.equal(new Set(steps).size, 1)
      expected = nums[3] + steps[0]
    } else if (level === 2) {
      const items = v.items.slice(0, -1)
      const period = Array.from({ length: items.length - 1 }, (_, i) => i + 1).find(n => items.every((value, i) => value === items[i % n]))
      assert.ok(period); expected = items[items.length % period]
      assert.ok(q.q.includes(items.join('、')))
    } else if (level === 3) expected = ['香蕉', '尺子', '轮船', '棉帽', '兔子'][seed]
    else if (level === 4) {
      const [a, b] = v.counts
      expected = q.q.includes('更多') ? v.labels[a > b ? 0 : 1] : q.q.includes('更少') ? v.labels[a < b ? 0 : 1] : q.q.includes('红盘里') ? a : q.q.includes('蓝盘里') ? b : a + b
    } else if (level === 5) { const at = v.items.indexOf('星'); expected = q.q.includes('一共') ? v.items.length : q.q.includes('左边有') ? at : q.q.includes('右边有') ? v.items.length - at - 1 : q.q.includes('左边数') ? at + 1 : v.items.length - at }
    else if (level === 6) {
      const [, name, direction] = q.q.match(/\n(.+?)紧挨着的(左|右)边/)
      expected = v.items[v.items.indexOf(name) + (direction === '左' ? -1 : 1)]
    } else if (level === 7) expected = sequenceSolution(v)[nums[0] - 1]
    else if ([8, 9, 10].includes(level)) {
      expected = Array.from({ length: 31 }, (_, i) => i).find(n => n + nums[1] === nums[0])
      if (level === 8) assert.deepEqual(v.counts, nums)
      if (level === 9) { assert.equal(v.total, nums[0]); assert.equal(v.have, nums[1]) }
      if (level === 10) { assert.equal(v.total, nums[0]); assert.equal(v.remove, nums[1]) }
    } else if (level === 11) {
      const [, color, shape] = q.q.match(/只数(.+)色的(圆|方)形/)
      expected = v.items.filter(item => item.color === color && item.shape === shape).length
    } else if (level === 12) {
      const order = sequenceSolution(v), high = q.q.match(/比.+?([长高快多])，/)[1]
      expected = order[q.q.includes('中间') ? 1 : q.q.includes('最' + high) ? 0 : 2]
    } else if (level === 13 || level === 20 && seed === 1) expected = matchingAnswer(q)
    else if (level === 14 || level === 20 && seed === 2) expected = gridAnswer(q)
    else if (level === 15) expected = sequenceSolution(v)[q.q.includes('最先') ? 0 : q.q.includes('最后') ? 2 : 1]
    else if (level === 16 || level === 20 && seed === 3) expected = walkAnswer(q)
    else if (level === 17) {
      const solutions = Array.from({ length: 31 }, (_, n) => n).filter(n => {
        const parts = v.parts.map(p => p === '?' ? n : p)
        return (parts[1] === '＋' ? Number(parts[0]) + Number(parts[2]) : Number(parts[0]) - Number(parts[2])) === Number(parts[4])
      })
      assert.equal(solutions.length, 1); expected = solutions[0]
    } else if (level === 18 || level === 20 && seed === 4) expected = nums[0] + nums[1] - nums[2]
    else if (level === 19) {
      const [, size, color] = q.q.match(/在(小|大)包里，也在(.+)色包里/)
      const solutions = v.items.filter(item => item.color === color && item.small === (size === '小'))
      assert.equal(solutions.length, 1); expected = solutions[0].name
    }
    assert.notEqual(expected, undefined, q.id)
    assert.equal(q.a[q.correct], String(expected), q.id + ': ' + q.q)
    checked++
  }
  assert.equal(checked, 200)
})
test('obsolete saves and previously imported records are removed without changing current progress', () => {
  const current = { stars: { 1: 2 }, motion: false, wrong: [], records: [{ mode: 'campaign', score: 4, total: 5, date: '2026-10-28', previous: true }, { mode: 'campaign', score: 5, total: 5, date: '2026-10-29' }] }
  const store = { 'detective-v1': { stars: { 1: 3 } }, 'detective-v2': { wrong: ['3-0'] }, 'detective-v3': { stars: { 1: 3 } }, 'detective-v4': { stars: { 1: 3 } }, 'detective-v5': { stars: { 1: 3 } }, 'detective-v6': current }
  const { api } = boot(store)
  assert.equal(api.getState().data.stars[1], 2); assert.equal(api.getState().data.unlocked, 2); assert.equal(api.getState().data.motion, false)
  assert.equal(api.getState().data.records.length, 1); assert.equal(store['detective-v6'].records.length, 1)
  assert.equal(store['detective-v1'], undefined); assert.equal(store['detective-v2'], undefined); assert.equal(store['detective-v3'], undefined); assert.equal(store['detective-v4'], undefined); assert.equal(store['detective-v5'], undefined)
  assert.equal(boot(store).api.getState().data.records.length, 1)
})
test('a fresh install does not import obsolete progress', () => {
  const { api, store } = boot({ 'detective-v3': { motion: false, stars: { 1: 3 }, wrong: ['3-0'] } })
  assert.equal(api.getState().data.unlocked, 1); assert.equal(api.getState().data.motion, true); assert.equal(api.getState().data.wrong.length, 0)
  assert.equal(store['detective-v3'], undefined)
})
test('malformed storage recovers and does not unlock arbitrary stages', () => {
  const { api } = boot({ 'detective-v6': { wrong: {}, records: [null, 3], stars: { 1: '999' }, daily: { bad: null, '2026-10-29': 3 }, skills: { bad: { total: -5, correct: 7 } }, unlocked: 999 } })
  assert.equal(api.getState().data.unlocked, 1); assert.equal(api.getState().data.records.length, 0)
  assert.equal(api.begin('campaign', 20), false); api.navigate('records')
})
test('failure, retry, hints and no-hint mastery update progress correctly', () => {
  const { api } = boot()
  api.begin('campaign', 1); complete(api, 2)
  assert.equal(api.getState().data.unlocked, 1); assert.equal(api.getState().data.stars[1], 0)
  api.begin('campaign', 1); complete(api, 6)
  assert.equal(api.getState().data.unlocked, 2); assert.equal(api.getState().data.stars[1], 1)
  api.begin('campaign', 1); complete(api, 10, true)
  assert.equal(api.getState().data.stars[1], 3); assert.equal(api.getState().data.perfect[1], false)
  api.begin('campaign', 1); complete(api)
  assert.equal(api.getState().data.perfect[1], true)
  api.begin('campaign', 1); complete(api, 0)
  assert.equal(api.getState().data.stars[1], 3); assert.equal(api.getState().data.unlocked, 2)
})
test('ten-question campaign uses the 6, 8 and 10 answer star thresholds', () => {
  for (const [score, stars] of [[0, 0], [5, 0], [6, 1], [7, 1], [8, 2], [9, 2], [10, 3]]) {
    const { api } = boot(); api.begin('campaign', 1); assert.equal(api.getState().session.list.length, 10)
    complete(api, score); assert.equal(api.getState().data.stars[1], stars)
    assert.equal(api.getState().data.unlocked, stars ? 2 : 1)
    assert.equal(api.getState().data.perfect[1], score === 10)
  }
})
test('answer shuffle preserves correct mapping and duplicate taps cannot double-count', () => {
  const { api } = boot(); const indices = new Set()
  for (let n = 0; n < 30; n++) {
    api.begin('campaign', 1)
    const q = api.getState().session.list[0], original = content.bank.find(item => item.id === q.id)
    assert.equal(q.a[q.correct], original.a[original.correct]); indices.add(q.correct)
    api.answer(q.correct); api.answer(q.correct); api.revealHint(); api.next(); api.next()
    assert.equal(api.getState().session.score, 1); assert.equal(api.getState().session.index, 1); assert.equal(api.getState().session.hintsUsed, 0)
  }
  assert.equal(indices.size, 3)
})
test('all 20 levels complete, persist, cap at final stage and award all badges', () => {
  const { api, store } = boot()
  for (let id = 1; id <= 20; id++) { assert.ok(api.begin('campaign', id)); complete(api); assert.equal(api.getState().data.stars[id], 3) }
  assert.equal(api.getState().data.unlocked, 20)
  assert.equal(Object.values(api.getState().data.perfect).filter(Boolean).length, 20)
  assert.equal(boot(store).api.getState().data.unlocked, 20)
  const records = api.getState().data.records.length
  api.next(); api.answer(0); assert.equal(api.getState().data.records.length, records)
  api.navigate('map'); api.navigate('records')
})
test('daily set stays within unlocked lessons and keeps the same scope after progress and restart', () => {
  for (const cap of [1, 2, 5, 12, 20]) {
    const stars = Object.fromEntries(Array.from({ length: cap - 1 }, (_, i) => [i + 1, 1]))
    const { api, store } = boot({ 'detective-v6': { stars } })
    api.begin('daily')
    const day = api.getState().session.day, ids = api.getState().session.list.map(q => q.id).sort().join(',')
    assert.equal(new Set(ids.split(',')).size, 10)
    assert.equal(new Set(api.getState().session.list.map(q => q.q)).size, 10)
    assert.ok(api.getState().session.list.every(q => q.level <= cap))
    assert.equal(api.getState().data.daily[day].best, null)
    const deterministic = api.dailyQuestions(day).map(q => q.id).sort().join(',')
    assert.equal(ids, deterministic)
    api.begin('campaign', cap); complete(api)
    api.begin('daily'); assert.equal(api.getState().session.list.map(q => q.id).sort().join(','), ids)
    const restarted = boot(store).api; restarted.begin('daily')
    assert.equal(restarted.getState().session.list.map(q => q.id).sort().join(','), ids)
    complete(restarted, 4); assert.equal(restarted.getState().session.firstDaily, true)
    restarted.begin('daily'); complete(restarted, 2)
    assert.equal(restarted.getState().session.firstDaily, false); assert.equal(restarted.getState().data.daily[day].best, 4)
    assert.equal(restarted.getState().data.unlocked, Math.min(20, cap + 1))
  }
})
test('daily full score persists out of ten and old five-question results are discarded', () => {
  const { api, store } = boot(); const day = api.dateKey()
  api.begin('daily'); assert.equal(api.getState().session.list.length, 10)
  complete(api, 10); assert.equal(api.getState().session.score, 10)
  assert.equal(api.getState().data.daily[day].best, 10)
  assert.equal(boot(store).api.getState().data.daily[day].best, 10)
  const old = boot({ 'detective-v6': { daily: { [day]: { best: 5, level: 1 } } } })
  assert.equal(old.api.getState().data.daily[day], undefined)
  old.api.begin('daily'); assert.equal(old.api.getState().session.list.length, 10)
})
test('daily-only play cannot unlock campaign levels or award campaign stars', () => {
  const { api } = boot(); api.begin('daily'); complete(api)
  assert.equal(api.getState().data.unlocked, 1); assert.equal(api.getState().data.stars[1], 0)
})
test('mistakes return in review and correct answers remove them; empty review is safe', () => {
  const { api } = boot(); assert.equal(api.begin('review'), false)
  api.begin('campaign', 1); complete(api, 0); assert.equal(api.getState().data.wrong.length, 10)
  api.begin('review'); complete(api); assert.equal(api.getState().data.wrong.length, 0)
  assert.equal(api.getState().data.unlocked, 1)
})
test('320px screen supports scroll, long explanations, touch cancel and all practice grades', () => {
  const { api, events } = boot({}, 320, 568)
  assert.ok(api.getState().maxScroll > 0)
  const y = api.getState().contentTop + 30
  events.start({ touches: [{ clientX: 100, clientY: y }] })
  events.move({ touches: [{ clientX: 100, clientY: y - 100 }] })
  events.end({ changedTouches: [{ clientX: 100, clientY: y - 100 }] })
  assert.equal(api.getState().page, 'home'); assert.equal(api.getState().scroll, 100)
  events.cancel(); events.show()
  for (const grade of [1, 3, 4, 5]) { api.begin('practice', 0, grade); complete(api); assert.equal(api.getState().session.score, 10) }
  api.navigate('grades'); api.navigate('records')
})
test('record retention is bounded and reported save errors do not crash gameplay', () => {
  const { api } = boot()
  for (let n = 0; n < 55; n++) { api.begin('campaign', 1); complete(api) }
  assert.equal(api.getState().data.records.length, 50)
  const failing = boot({}, 375, 667, true)
  failing.api.begin('campaign', 1); complete(failing.api)
  assert.equal(failing.api.getState().page, 'result'); assert.equal(failing.toasts.length, 1)
})
function tap(events, button, scroll = 0) {
  const point = { clientX: button.x + button.w / 2, clientY: button.y + button.h / 2 - scroll }
  events.start({ touches: [point] }); events.end({ changedTouches: [point] })
}
function tapVisible(api, events, button) {
  const state = api.getState(), target = Math.min(state.maxScroll, Math.max(0, button.y + button.h - state.contentBottom + 12))
  if (target !== state.scroll) {
    const y = (state.contentTop + state.contentBottom) / 2
    events.start({ touches: [{ clientX: 100, clientY: y }] })
    events.move({ touches: [{ clientX: 100, clientY: y + state.scroll - target }] })
    events.end({ changedTouches: [] })
  }
  tap(events, button, api.getState().scroll)
}
test('bottom navigation stays reachable after scrolling and quiz hides it', () => {
  const { api, events } = boot({}, 320, 568)
  let state = api.getState()
  const start = { clientX: 100, clientY: state.contentTop + 80 }
  events.start({ touches: [start] }); events.move({ touches: [{ clientX: 100, clientY: start.clientY - 160 }] }); events.end({ changedTouches: [] })
  assert.equal(api.getState().scroll, 160)
  tap(events, api.getState().headerButtons[2])
  assert.equal(api.getState().page, 'map'); assert.equal(api.getState().scroll, 0)
  tap(events, api.getState().headerButtons[4]); assert.equal(api.getState().page, 'records')
  api.begin('campaign', 1); assert.equal(api.getState().headerButtons.length, 2)
  const q = api.getState().session.list[0]
  tapVisible(api, events, api.getState().buttons.find(b => b.role === 'answer' && b.index === q.correct)); assert.equal(api.getState().session.score, 1)
  assert.equal(api.getState().buttons.length, 1)
})
test('pressed state clears on cancel, drag and release without accidental navigation', () => {
  const { api, events } = boot({}, 320, 568)
  const b = api.getState().buttons[0], y = Math.min(api.getState().contentBottom - 2, b.y + 5), x = b.x + 10
  events.start({ touches: [{ clientX: x, clientY: y }] }); assert.ok(api.getState().pressed)
  events.cancel(); assert.equal(api.getState().pressed, null)
  events.start({ touches: [{ clientX: x, clientY: y }] })
  events.move({ touches: [{ clientX: x + 20, clientY: y }] }); assert.equal(api.getState().pressed, null)
  events.end({ changedTouches: [{ clientX: x + 20, clientY: y }] }); assert.equal(api.getState().page, 'home')
})
test('animation stops on completion, replacement, hide and persistent motion toggle', () => {
  const { api, events, store, frames, advance } = boot({}, 375, 667, false, true)
  assert.equal(frames.size, 0)
  api.navigate('map'); assert.equal(frames.size, 1)
  api.navigate('records'); assert.equal(frames.size, 1)
  advance(300); assert.equal(frames.size, 0); assert.equal(api.getState().effect, null)
  api.begin('campaign', 1); assert.equal(frames.size, 1)
  events.hide(); assert.equal(frames.size, 0); assert.equal(api.getState().pressed, null)
  events.show(); assert.equal(frames.size, 0)
  tap(events, api.getState().headerButtons[1]); assert.equal(api.getState().data.motion, false)
  api.answer(api.getState().session.list[0].correct); assert.equal(frames.size, 0)
  assert.equal(boot(store).api.getState().data.motion, false)
  tap(events, api.getState().headerButtons[1]); assert.equal(api.getState().data.motion, true)
  api.next(); assert.equal(frames.size, 1)
  advance(300); assert.equal(frames.size, 0)
  api.answer(api.getState().session.list[1].correct); assert.equal(api.getState().effect.kind, 'correct')
  assert.equal(frames.size, 1); advance(700); assert.equal(frames.size, 0)
  api.next(); complete(api); assert.equal(api.getState().effect.kind, 'reward')
  advance(1100); assert.equal(frames.size, 0)
})
test('learning boards support swapping, marking, trial filling and walking without scoring', () => {
  const stars = Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, 1]))
  const { api } = boot({ 'detective-v6': { stars } })
  for (const level of [4, 7, 9, 10, 11, 13, 14, 16, 19]) {
    const target = content.bank.find(q => q.skill === level)
    api.begin('campaign', target.level)
    const index = api.getState().session.list.findIndex(q => q.id === target.id)
    api.getState().session.index = index; api.navigate('quiz')
    const before = JSON.stringify(api.getState().data), s = api.getState().session
    const visual = () => api.getState().buttons.filter(b => b.role === 'visual')
    assert.ok(visual().length)
    if (level === 7) {
      const order = Array.from(s.board.order)
      visual()[0].action(); assert.equal(s.board.selected, 0)
      visual()[1].action(); assert.deepEqual(Array.from(s.board.order), [order[1], order[0], order[2]])
      assert.equal(s.board.selected, -1)
    } else if (level === 14) {
      for (const expected of [1, 2, 3, 0]) { visual()[0].action(); assert.equal(s.board.fill, expected) }
    } else if (level === 16) {
      for (let n = 0; n < 30; n++) visual()[0].action()
      assert.equal(s.board.position[0], 0); assert.ok(s.board.position[1] >= 0)
      visual()[4].action(); assert.deepEqual(Array.from(s.board.position), Array.from(s.list[s.index].visual.start))
      assert.equal(s.board.trail.length, 1)
    } else {
      visual()[0].action()
      assert.equal(Object.values(s.board.marks).filter(Boolean).length, 1)
      if (level === 13) {
        visual()[0].action(); assert.equal(Object.values(s.board.marks)[0], 2)
        visual()[0].action(); assert.equal(Object.values(s.board.marks)[0], 0)
      } else { visual()[0].action(); assert.equal(Object.values(s.board.marks).filter(Boolean).length, 0) }
    }
    assert.equal(s.score, 0); assert.equal(s.choice, -1); assert.equal(s.hintsUsed, 0)
    assert.equal(JSON.stringify(api.getState().data), before)
    api.answer(s.list[s.index].correct); assert.equal(visual().length, 0)
    if (s.index < s.list.length - 1) { api.next(); if (s.list[s.index].visual) { assert.equal(s.board.id, s.list[s.index].id); assert.equal(Object.keys(s.board.marks).length, 0) } }
  }
})
test('unfinished daily snapshots are bounded and cannot exceed inferred unlocked scope', () => {
  const daily = {}
  for (let n = 1; n <= 100; n++) daily[new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10)] = { total: 10, level: 20, best: null }
  const { api } = boot({ 'detective-v6': { stars: { 1: 1, 2: 1 }, daily } })
  assert.equal(Object.keys(api.getState().data.daily).length, 90)
  assert.ok(Object.values(api.getState().data.daily).every(entry => entry.level === 3 && entry.best === null))
  api.begin('daily'); assert.equal(Object.keys(api.getState().data.daily).length, 90)
})
console.log(`\n${passed} groups passed`)
