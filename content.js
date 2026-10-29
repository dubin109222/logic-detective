// 二年级上学期入门主线：每关 10 题，使用加减、观察及一两步关系。
// 新题使用独立 ID，避免旧版错题、星星和学习统计套用到不同题目。
const curriculum = 'g2a'
const chapters = [
  { name: '线索起步', story: '先观察、数一数，找到侦探社的第一条线索。', badge: '观察之眼' },
  { name: '小镇寻宝', story: '排排队、补一补，帮小镇居民解决小问题。', badge: '线索猎手' },
  { name: '线索拼图', story: '一次看一条线索，把小小拼图慢慢拼好。', badge: '推理能手' },
  { name: '校园委托', story: '用学过的方法，完成校园里的五项小委托。', badge: '星级侦探' }
]
function make(type, q, answer, alternatives, hints, explain, visual) {
  const a = [String(answer), ...alternatives.map(String)]
  if (a.length !== 3 || new Set(a).size !== 3) throw new Error('选项必须互不相同：' + q)
  return { type, q, a, correct: 0, hints, hint: hints[0], explain, visual }
}
const names = [['小安', '小雨', '小林'], ['小星', '小乐', '小明'], ['小荷', '小竹', '小梅'], ['小北', '小南', '小西'], ['小白', '小青', '小红']]
const colors = ['红', '蓝', '黄']
function numeric(type, prompt, answer, hints, explain, visual) {
  return make(type, prompt, answer, [answer - 1, answer + 1], hints, explain, visual)
}
function lineVisual(items, caption, extra = {}) { return { kind: 'line', items, caption, ...extra } }
function ordering(type, prompt, order, at, hints, explain, orderLabel) {
  return make(type, prompt, order[at], order.filter((_, j) => j !== at), hints, explain, {
    kind: 'arrange', items: [order[1], order[2], order[0]], solution: order, before: [[order[0], order[1]], [order[1], order[2]]], caption: '点两张卡片，可以交换位置', orderLabel: orderLabel || (type === '生活顺序' ? '先做 → → 后做' : '前面 → → 后面')
  })
}
function matching(i, final = false) {
  const people = names[i], pets = final ? ['红球', '蓝球', '黄球'] : ['猫', '狗', '兔子']
  const order = [pets[i % 3], pets[(i + 1) % 3], pets[(i + 2) % 3]]
  const verb = final ? '拿' : '养', at = i % 2 ? 2 : 1
  return make(final ? '结案配对' : '配对排除', `每人${verb}一种：${pets.join('、')}，都不同。\n${people[0]}${verb}${order[0]}，${people[1]}不${verb}${order[2]}。${people[at]}${verb}什么？`, order[at], pets.filter(p => p !== order[at]),
    ['先在表里标出已经知道的一对。', `${people[1]}不能${verb}${order[0]}，也不能${verb}${order[2]}。`],
    `① ${people[0]}${verb}${order[0]}，${people[1]}${verb}${order[1]}。\n② 剩下${order[2]}给${people[2]}，所以选${order[at]}。`,
    { kind: 'matching', people, items: pets, known: [people[0], order[0]], excluded: [people[1], order[2]], solution: order })
}
function miniGrid(i, final = false) {
  const grids = [[[1,2,3],[2,3,1],[3,1,2]], [[3,1,2],[1,2,3],[2,3,1]], [[2,3,1],[3,1,2],[1,2,3]], [[1,3,2],[3,2,1],[2,1,3]], [[2,1,3],[1,3,2],[3,2,1]]]
  const cells = grids[i].map(row => row.slice()), hole = [[0, 1], [1, 2], [2, 0], [0, 2], [2, 1]][i]
  const answer = cells[hole[0]][hole[1]]
  cells[hole[0]][hole[1]] = null
  return make(final ? '结案数阵' : '方格观察', `${final ? '档案卡少了一个数。' : ['小火车的座位缺了一个数。', '游戏卡上有一个问号。', '帮小熊补全数字方格。', '小猫的密码卡缺了一个数。', '侦探社的数字卡破了。'][i]}\n每行、每列都有 1、2、3，不重复。问号填几？`, answer, [1, 2, 3].filter(n => n !== answer),
    ['先看问号这一行，少了哪个数？', `这一行已经有 ${cells[hole[0]].filter(n => n !== null).join('、')}。`],
    `① 问号这一行少了 ${answer}。\n② 这一列也少了 ${answer}，所以填 ${answer}。`, { kind: 'numberGrid', cells })
}
function walking(i, final = false) {
  const places = ['花坛', '书角', '校门', '水池', '操场', '教室', '树下', '长椅', '小亭']
  const routes = [[['右', 1], ['上', 1]], [['左', 1], ['下', 1]], [['上', 1], ['左', 1]], [['下', 1], ['右', 1]], [['右', 1], ['下', 1]]]
  const start = final ? [0, 1] : [1, 1], moves = final ? [['右', 1], ['上', 1]] : routes[i]
  let x = start[0], y = start[1]
  for (const [direction, n] of moves) { x += direction === '右' ? n : direction === '左' ? -n : 0; y += direction === '下' ? n : direction === '上' ? -n : 0 }
  const answer = places[y * 3 + x]
  return make(final ? '结案路线' : '照图走路', `${final ? '最后去送信。' : ''}从小旗出发，向${moves[0][0]}走 1 格，再向${moves[1][0]}走 1 格。到了哪里？`, answer, [places[start[1] * 3 + start[0]], places.find(p => p !== answer && p !== places[start[1] * 3 + start[0]])],
    ['先找到小旗。看清上、下、左、右。', `先向${moves[0][0]}走一格，再向${moves[1][0]}走一格。可以点箭头试试。`],
    `① 从小旗向${moves[0][0]}走一格。\n② 再向${moves[1][0]}走一格，到${answer}。`, { kind: 'walk', places, start, moves })
}
const definitions = [
  ['数字脚印', '找出每次增加的数', i => {
    const start = [1, 2, 5, 3, 10][i], step = [1, 2, 5, 2, 5][i], items = Array.from({ length: 4 }, (_, n) => start + n * step), answer = start + 4 * step
    return numeric('数字规律', `脚印上的数是 ${items.join('、')}。\n每次增加的数一样，接下来是几？`, answer,
      ['先看看前两个数相差几。', `每次加 ${step}，接着往后数。`], `① 每次加 ${step}。\n② ${items[3]}＋${step}＝${answer}，所以填 ${answer}。`, lineVisual([...items, '?'], '从左往右，接着数'))
  }],
  ['彩旗接龙', '看一组图案怎样重复', i => {
    const patterns = [['红', '蓝'], ['黄', '黄', '蓝'], ['红', '蓝', '黄'], ['蓝', '红', '红'], ['黄', '蓝']]
    const pattern = patterns[i], count = [5, 6, 7, 8, 6][i], items = Array.from({ length: count }, (_, n) => pattern[n % pattern.length]), answer = pattern[count % pattern.length]
    return make('循环观察', `彩旗一组一组重复。\n${items.join('、')}，下一面是什么颜色？`, answer, colors.filter(c => c !== answer),
      ['找找前面哪几面总是一起出现。', `一组是${pattern.join('、')}，照着这组接下去。`], `① 一组是${pattern.join('、')}。\n② 接下来轮到${answer}色，所以选${answer}。`, { kind: 'pattern', items: [...items, '?'] })
  }],
  ['物品分类', '找到同一类的物品', i => {
    const rows = [
      ['苹果、梨都是水果。哪样也是水果？', '香蕉', ['铅笔', '皮球'], '香蕉也可以当水果吃。'],
      ['铅笔、橡皮都是文具。哪样也是文具？', '尺子', ['水杯', '面包'], '尺子也属于学习用的文具。'],
      ['公交车、火车都能载人出行。哪样也可以？', '轮船', ['书架', '台灯'], '轮船也能载人出行。'],
      ['手套、围巾都可以保暖。哪样也可以？', '棉帽', ['尺子', '盘子'], '棉帽可以戴在头上保暖。'],
      ['猫、狗都是动物。哪样也是动物？', '兔子', ['积木', '石头'], '兔子和猫、狗一样，都是动物。']
    ]
    const [q, a, other, why] = rows[i]
    return make('分类观察', q, a, other, ['先想想它们有什么相同的地方。', '再把三个选项挨个看一遍。'], `① ${why}\n② 所以选${a}。`)
  }],
  ['数量对对碰', '数一数，再比较多少', i => {
    const counts = [[3, 5], [6, 4], [5, 7], [8, 6], [7, 4]][i], labels = ['红盘', '蓝盘']
    const prompts = ['哪个盘里的圆片更多？', '哪个盘里的圆片更少？', '红盘里有几个圆片？', '蓝盘里有几个圆片？', '两个盘一共有几个圆片？']
    const answers = ['蓝盘', '蓝盘', counts[0], counts[1], counts[0] + counts[1]], answer = answers[i]
    const alternatives = i < 2 ? ['红盘', '一样多'] : [answer - 1, answer + 1]
    return make('数数比较', `两个盘里放着小圆片。\n${prompts[i]}`, answer, alternatives,
      ['点点圆片，可以做记号，别漏数。', `红盘有 ${counts[0]} 个，蓝盘有 ${counts[1]} 个。`], `① 红盘 ${counts[0]} 个，蓝盘 ${counts[1]} 个。\n② ${i === 4 ? `${counts[0]}＋${counts[1]}＝${answer}，` : ''}所以选${answer}。`, { kind: 'countGroups', labels, counts })
  }],
  ['找到位置', '从左或从右数清位置', i => {
    const count = [5, 6, 7, 6, 8][i], at = [1, 3, 4, 2, 5][i]
    const prompts = ['从左边数，有星星的是第几本？', '从右边数，有星星的是第几本？', '有星星的书左边有几本？', '有星星的书右边有几本？', '书架上一共有几本书？']
    const answer = [at + 1, count - at, at, count - at - 1, count][i]
    const items = Array.from({ length: count }, (_, n) => n === at ? '星' : '书')
    return numeric('位置观察', `看一看书架。\n${prompts[i]}`, answer,
      ['点一本数一下，别漏掉。', i < 2 ? '数第几本时，要把星星这本也数进去。' : '只数题目问到的那些书。'], `① ${i < 2 ? '数第几本时，要数到星星这本。' : '按照题目要求逐本数。'}\n② 数出来是 ${answer} 本。`, lineVisual(items, i === 1 ? '左边 ← ← ← 右边' : '左边 → → → 右边'))
  }],
  ['左右邻居', '找到紧挨着的左右邻居', i => {
    const rows = [['书', '笔', '杯', '球', '花'], ['猫', '狗', '兔', '羊', '马'], ['帽', '包', '伞', '鞋', '衣'], ['梨', '桃', '瓜', '枣', '橙'], ['船', '车', '灯', '钟', '桌']]
    const items = rows[i], at = [2, 1, 3, 2, 1][i], left = i % 2 === 0, answer = items[at + (left ? -1 : 1)]
    return make('左右观察', `看这一排物品。\n${items[at]}紧挨着的${left ? '左' : '右'}边是什么？`, answer, [items[at], items[at + (left ? 1 : -1)]],
      [`先找到${items[at]}，点一下做个记号。`, `再看它${left ? '左' : '右'}边紧挨着的一个。`], `① 先找到${items[at]}。\n② 紧挨着的${left ? '左' : '右'}边是${answer}，所以选${answer}。`, lineVisual(items, '左边 → → → 右边'))
  }],
  ['三人排队', '把两条前后线索接起来', i => {
    const [a, b, c] = names[i], at = [0, 2, 1, 0, 2][i]
    return ordering('排队推理', `${a}在${b}前，${b}在${c}前。\n从前往后数，第 ${at + 1} 个是谁？`, [a, b, c], at,
      [`先把${a}和${b}排好。`, `${c}要排在${b}后面。可以交换卡片试试。`], `① 从前到后是${a}、${b}、${c}。\n② 第 ${at + 1} 个是${[a, b, c][at]}。`)
  }],
  ['谁多谁少', '用减法比较相差多少', i => {
    const a = [9, 12, 15, 18, 20][i], b = [6, 8, 10, 13, 14][i], answer = a - b
    return numeric('数量比较', `红盒有 ${a} 支笔，蓝盒有 ${b} 支笔。\n红盒比蓝盒多几支？`, answer,
      ['先找出两个盒子各有几支笔。', '把同样多的部分去掉，剩下的就是多出的。'], `① 用多的减去少的。\n② ${a}－${b}＝${answer}，多 ${answer} 支。`, { kind: 'compare', labels: ['红盒', '蓝盒'], counts: [a, b] })
  }],
  ['补齐线索', '数出还缺几个', i => {
    const total = [6, 8, 10, 12, 10][i], have = [4, 5, 6, 7, 3][i], answer = total - have
    return numeric('补足数量', `要摆 ${total} 个圆片，已有 ${have} 个。\n还要补几个？`, answer,
      ['空着的位置，都需要补一个。', '点一点空位，把圆片补满，看看补了几个。'], `① 一共要 ${total} 个，已有 ${have} 个。\n② ${total}－${have}＝${answer}，还要补 ${answer} 个。`, { kind: 'counters', total, have, mode: 'fill' })
  }],
  ['送出礼物', '从原来的数量里减去送出的', i => {
    const total = [8, 10, 12, 15, 16][i], give = [3, 4, 5, 6, 7][i], answer = total - give
    return numeric('剩余数量', `原有 ${total} 颗糖，送给朋友 ${give} 颗。\n现在还剩几颗？`, answer,
      [`可以点圆片，划掉送出的 ${give} 颗。`, '再数一数没有划掉的。'], `① 从原来的数量里减去送出的。\n② ${total}－${give}＝${answer}，还剩 ${answer} 颗。`, { kind: 'counters', total, have: total, remove: give, mode: 'remove' })
  }],
  ['图案筛选', '同时看颜色和形状', i => {
    const items = [
      { color: '红', shape: '圆' }, { color: '蓝', shape: '圆' }, { color: '红', shape: '方' },
      { color: '黄', shape: '方' }, { color: '蓝', shape: '方' }, { color: '红', shape: '圆' }
    ]
    items[(i + 2) % 6] = { color: colors[i % 3], shape: i % 2 ? '方' : '圆' }
    const color = ['红', '蓝', '黄', '红', '蓝'][i], shape = ['圆', '方', '方', '方', '圆'][i]
    const answer = items.filter(v => v.color === color && v.shape === shape).length
    return numeric('双特征观察', `只数${color}色的${shape === '圆' ? '圆形' : '方形'}。\n一共有几个？`, answer,
      [`先找出所有${color}色图案，可以点一下做记号。`, `再检查形状，只留下${shape === '圆' ? '圆形' : '方形'}。`], `① 颜色要是${color}色，形状也要符合。\n② 两个条件都符合的有 ${answer} 个。`, { kind: 'shapes', items })
  }],
  ['大小排序', '把两个比较关系连起来', i => {
    const rows = [
      [['红绳', '蓝绳', '黄绳'], '长', '短', 2], [['小安', '小雨', '小林'], '高', '矮', 0],
      [['大熊', '小猫', '小兔'], '快', '慢', 2], [['红盒', '蓝盒', '黄盒'], '多', '少', 0], [['绿笔', '红笔', '蓝笔'], '长', '短', 1]
    ]
    const [order, high, low, at] = rows[i], q = i === 3 ? '红盒的笔比蓝盒多，蓝盒的笔比黄盒多。\n哪个盒里的笔最多？' : i === 4 ? '绿笔比红笔长，红笔比蓝笔长。\n哪支笔的长度在中间？' : `${order[0]}比${order[1]}${high}，${order[1]}比${order[2]}${high}。\n${i === 0 ? '哪根最短' : `谁最${at === 0 ? high : low}`}？`
    return ordering('比较排序', q, order, at, [`先把${order[0]}和${order[1]}排一排。`, `从${high}到${low}排，${order[2]}在最后。`], `① 从${high}到${low}：${order.join('、')}。\n② 所以选${order[at]}。`, `${high} → → ${low}`)
  }],
  ['宠物配对', '用已知的一对排除其他选项', i => matching(i)],
  ['数字小方格', '先看一行，再检查一列', i => miniGrid(i)],
  ['先做再做', '排出三件事的先后', i => {
    const tasks = [['洗手', '吃点心', '收餐盘'], ['拿杯子', '倒水', '喝水'], ['穿袜子', '穿鞋', '系鞋带'], ['拿纸', '画画', '收画笔'], ['拿种子', '播种', '浇水']][i], at = [2, 0, 1, 2, 0][i]
    return ordering('生活顺序', `${tasks[0]}要在${tasks[1]}前，${tasks[1]}要在${tasks[2]}前。\n哪件事${at === 0 ? '最先做' : at === 2 ? '最后做' : '第二个做'}？`, tasks, at,
      ['先按题目说的顺序排前两张卡。', `再把${tasks[2]}放在${tasks[1]}后面。`], `① 顺序是${tasks.join('、')}。\n② 所以选${tasks[at]}。`)
  }],
  ['照图走走', '沿图走两步，找到目的地', i => walking(i)],
  ['数字钥匙', '找出加减算式里缺少的数', i => {
    const missing = [4, 6, 8, 10, 9][i], other = [3, 5, 4, 6, 7][i], subtract = i % 2 === 1
    const parts = subtract ? [missing + other, '－', '?', '＝', other] : ['?', '＋', other, '＝', missing + other]
    return numeric('加减填空', `数字钥匙少了一块。\n${parts.join(' ')}，问号是几？`, missing,
      [subtract ? '原有的数减去剩下的数，就是拿走的数。' : '和减去已经知道的数，就是缺少的数。', `可以从 ${missing + other} 里去掉 ${other}，数数剩下多少。`],
      `① ${missing + other}－${other}＝${missing}。\n② 把 ${missing} 放回问号，算式正好成立。`, { kind: 'equation', parts })
  }],
  ['两步小账本', '先算第一步，再接着算', i => {
    const start = [12, 15, 18, 20, 25][i], added = [3, 4, 5, 6, 5][i], removed = [2, 6, 4, 8, 7][i], answer = start + added - removed
    return numeric('两步加减', `书角原有 ${start} 本书，添了 ${added} 本，又借走 ${removed} 本。\n现在有几本？`, answer,
      [`先算添书后有几本：${start}＋${added}。`, `再从 ${start + added} 本里减去借走的 ${removed} 本。`],
      `① ${start}＋${added}＝${start + added}。\n② ${start + added}－${removed}＝${answer}，现在有 ${answer} 本。`, { kind: 'steps', items: [`原有 ${start}`, `添 ${added}`, `借走 ${removed}`] })
  }],
  ['两条小线索', '用两条线索找到同一个物品', i => {
    const color = colors[i % 3], other = colors[(i + 1) % 3], small = i % 2 === 0
    const labels = ['1号包', '2号包', '3号包'], answer = labels[i % 3]
    const items = [{ name: labels[(i + 1) % 3], color, small: !small }, { name: labels[(i + 2) % 3], color: other, small }, { name: answer, color, small }]
    const rotated = items.slice(i % 3).concat(items.slice(0, i % 3))
    return make('双条件排除', `钥匙在${small ? '小' : '大'}包里，也在${color}色包里。\n哪个包同时符合？`, answer, labels.filter(n => n !== answer),
      [`先找出${small ? '小' : '大'}包，另一个可以先不看。`, `再从里面找${color}色的包。`], `① 包的大小和颜色都要符合。\n② ${answer}是${color}色${small ? '小' : '大'}包，所以选${answer}。`, { kind: 'candidates', items: rotated })
  }],
  ['校园结案', '用熟悉的方法完成小委托', i => {
    if (i === 0) return numeric('结案规律', '门牌依次是 2、4、6、8。\n下一块门牌上的数是几？', 10, ['看看每次多几。', '每次加 2，从 8 往后接着数。'], '① 每次加 2。\n② 8＋2＝10，下一块是 10。', lineVisual([2, 4, 6, 8, '?'], '给门牌补上最后一个数'))
    if (i === 1) return matching(1, true)
    if (i === 2) return miniGrid(2, true)
    if (i === 3) return walking(3, true)
    return numeric('结案加减', '教室有 10 把椅子，搬来 4 把，又搬走 3 把。\n现在有几把？', 11, ['先算搬来后有几把。', '先算 10＋4，再减去 3。'], '① 10＋4＝14。\n② 14－3＝11，现在有 11 把。', { kind: 'steps', items: ['原有 10', '搬来 4', '搬走 3'] })
  }]
]
// 每关是一件小委托，穿插不同类型的线索。
const missions = [
  ['小猫的铃铛', '小猫弄丢了铃铛，帮它找回心爱的宝贝。'],
  ['图书馆的秘密', '借书卡不见了，跟着线索在书架间寻找。'],
  ['彩旗去哪儿了', '庆典快开始了，帮大家把彩旗准备好。'],
  ['小熊的生日', '小熊的生日到了，一起准备惊喜礼物。'],
  ['花园里的访客', '花园里出现了脚印，看看是谁来做客。'],
  ['点心店开张', '小镇点心店开张啦，帮店长整理东西。'],
  ['迷路的小鸭', '小鸭找不到朋友了，我们一起帮帮它。'],
  ['玩具列车出发', '玩具们要坐小火车，出发前还有事要做。'],
  ['丢失的画笔', '美术课的画笔不见了，跟着线索找一找。'],
  ['星星邮局', '邮局收到好多信，帮忙把信送到朋友手里。'],
  ['宠物运动会', '动物朋友要开运动会，先来整理比赛线索。'],
  ['小镇寻宝图', '一张藏宝图藏着秘密，沿途收集小线索。'],
  ['神奇种子', '小兔发现一颗种子，帮它找到合适的花盆。'],
  ['消失的气球', '一只气球飞走了，大家留下了寻找线索。'],
  ['厨房小帮手', '点心准备好了，快来帮忙整理厨房。'],
  ['校园寻路', '新朋友来到学校，帮它找到要去的地方。'],
  ['钥匙在哪里', '小盒子的钥匙不见了，一起找找看。'],
  ['书角小管家', '书角有一堆东西要整理，侦探来帮忙。'],
  ['神秘小包裹', '包裹送到了学校，看看该交给谁。'],
  ['侦探社庆典', '大家准备举办庆典，一起完成最后的委托。']
]
const clueLabels = ['看看线索', '找一找', '想一想', '动手试试', '完成委托']
const funCases = [
  ['小猫发现一个圆圆的东西。足球、方积木、书，哪个最容易滚动？', '足球', ['方积木', '书'], '想想哪个东西圆圆的。', '足球是圆的，轻轻一推就能滚动。'],
  ['雨点落下来了。雨伞、勺子、纸杯，哪样可以挡雨？', '雨伞', ['勺子', '纸杯'], '想想出门遇到下雨时会带什么。', '打开雨伞，可以挡住落下的雨。'],
  ['小动物伸长脖子吃树上的叶子。它是谁？', '长颈鹿', ['小鱼', '蜗牛'], '看谁的脖子长长的。', '长颈鹿有长长的脖子，能吃到高处的叶子。'],
  ['庆典上的东西用线牵着，能飘起来。它是什么？', '气球', ['石头', '纸杯'], '想一想生日时什么会飘在空中。', '气球可以用线牵着飘起来。'],
  ['宝盒锁住了。钥匙、帽子、水杯，哪样可以试着开锁？', '钥匙', ['帽子', '水杯'], '找一找和锁配成一对的东西。', '钥匙可以用来打开合适的锁。'],
  ['小兔耳朵长长的。下面哪个是小兔喜欢吃的食物？', '胡萝卜', ['石头', '橡皮'], '想一想哪样是能吃的蔬菜。', '胡萝卜是蔬菜，小兔可以吃。'],
  ['要看看现在几点了，应当找什么？', '钟表', ['枕头', '水杯'], '找一找有时针和分针的东西。', '看钟表可以知道现在的时间。'],
  ['要给画涂上颜色，哪样最合适？', '彩笔', ['鞋子', '汤勺'], '找一找画画时会用的东西。', '彩笔可以给画涂上颜色。'],
  ['小船在水上。鱼缸、书架、地毯，哪里有水？', '鱼缸', ['书架', '地毯'], '想想小鱼平时生活在哪里。', '鱼缸里有水，可以让小船漂浮。'],
  ['晚会开始了，想听到铃声，应该做什么？', '摇铃铛', ['摸枕头', '翻书页'], '找到能发出铃声的东西。', '摇动铃铛，就可以听到铃声。']
]
// 每个委托使用九种不同的思考方式，另加一道生活谜题。
const levels = missions.map(([name, story], index) => {
  const chapter = Math.floor(index / 5), cap = Math.min(19, 9 + Math.ceil(index / 2)), start = (index * 5 + 10) % cap, seed = index % 5
  const questions = Array.from({ length: 9 }, (_, step) => {
    const skill = (start + step) % cap
    const q = definitions[skill][2](seed)
    return { ...q, id: `g2c-${skill + 1}-${seed}-${index + 1}`, level: index + 1, skill: skill + 1, g: 2, clueLabel: `线索 ${step + 1}` }
  })
  const funIndex = index % funCases.length, [prompt, answer, alternatives, hint, reason] = funCases[funIndex]
  const fun = make('生活谜题', prompt, answer, alternatives, [hint, '仔细看看哪一项符合题目说的事情。'], `① ${reason}\n② 所以选${answer}。`)
  questions.splice(4, 0, { ...fun, id: `fun-${funIndex}-${index + 1}`, level: index + 1, skill: 'fun', g: 2, clueLabel: '小谜题' })
  questions.forEach(q => { q.clueLabel = q.type === '生活谜题' ? '小谜题' : '调查线索' })
  return { id: index + 1, chapter, name, story, goal: '十种不同的线索，完成一个小委托', questions }
})
module.exports = { curriculum, chapters, levels, bank: levels.flatMap(level => level.questions) }
