const canvas=wx.createCanvas(),ctx=canvas.getContext('2d'),s=wx.getSystemInfoSync(),W=s.windowWidth,H=s.windowHeight,d=s.pixelRatio||1
canvas.width=W*d;canvas.height=H*d;ctx.scale(d,d)
const bank=[], things=[['苹果','梨','桃'],['猫','狗','兔子'],['铅笔','橡皮','尺子'],['红球','黄球','蓝球'],['书','本子','笔'],['小鸟','小鱼','小鸭'],['杯子','碗','盘子'],['足球','篮球','排球'],['小熊','小马','小羊'],['太阳','月亮','星星']]
const names=['小明','小红','小丽','小军','小雨','小星','小乐','小安','小林','小青']
function add(g,type,q,a,correct,hint,explain){bank.push({id:g+'-'+bank.filter(x=>x.g===g).length,g,type,q,a,correct,hint,explain})}
things.forEach(a=>add(1,'找规律',`${a[0]}、${a[1]}、${a[0]}、${a[1]}，下一个是什么？`,a,0,'观察前两个，看看是不是重复出现。',`按照${a[0]}、${a[1]}交替排列，下一个是${a[0]}。`))
things.forEach(a=>add(2,'顺序判断',`按照“${a[0]} → ${a[1]} → ${a[2]}”排列，第二个是什么？`,a,1,'从左往右数，第一个、第二个……',`${a[0]}是第一个，${a[1]}是第二个。`))
names.forEach((a,i)=>{let b=names[(i+1)%10],c=names[(i+2)%10];add(3,'比较高矮',`${a}比${b}高，${b}比${c}高。谁最高？`,[a,b,c],0,'按身高从高到低排一排。',`${a}比${b}高，${b}比${c}高，所以${a}最高。`)})
const colors=[['红','黄','蓝'],['绿','紫','橙'],['粉','白','黑'],['蓝','绿','红'],['黄','蓝','紫'],['橙','红','绿'],['白','粉','黄'],['紫','绿','蓝'],['黑','白','红'],['红','蓝','黄']]
colors.forEach(a=>add(4,'条件排除',`三个盒子分别是${a.join('、')}色，每盒装一种不同的水果。苹果在${a[0]}盒，香蕉不在${a[2]}盒。香蕉在哪个盒子？`,a.map(x=>x+'盒'),1,'先排除装苹果的盒子，再排除另一个不可能的盒子。',`${a[0]}盒装苹果，香蕉不在${a[2]}盒，所以在${a[1]}盒。`))
names.forEach((a,i)=>{let b=names[(i+1)%10],c=names[(i+2)%10];add(5,'顺序推理',`${a}、${b}、${c}排成一队。${b}在${a}前面，${c}在${b}前面。谁排第一？`,[a,b,c],2,`先比较${c}和${b}，再比较${b}和${a}。`,`顺序是${c}、${b}、${a}，所以${c}排第一。`)})
// 二年级关卡：保留原题 ID，让旧版错题仍可找到。
const level2Names=['观察顺序','按序寻找','寻找规律','线索排除','比较推理']
const level2Extra=[
 ['找规律','2、4、2、4，下一个数字是什么？',['2','4','6'],0,'看看前两个数字怎样重复。','2 和 4 交替出现，所以下一个是 2。'],
 ['找规律','🌟🌙🌟🌙，下一个图案是什么？',['🌙','🌟','☀️'],1,'找一找反复出现的两个图案。','星星和月亮交替出现，所以下一个是星星。'],
 ['找规律','1、2、3、1、2、3，接下来是什么？',['1','2','3'],0,'把每三个数字看成一组。','1、2、3 重复出现，下一组从 1 开始。'],
 ['找规律','红、蓝、蓝、红、蓝、蓝，接下来是什么颜色？',['蓝','黄','红'],2,'每三个颜色是一组。','红、蓝、蓝为一组，下一组从红色开始。'],
 ['找规律','3、5、7、9，下一个数字是什么？',['10','11','12'],1,'每次增加多少？','每次增加 2，所以 9 后面是 11。'],
 ['条件排除','红盒放苹果，黄盒放梨，蓝盒放桃。梨在哪个盒子里？',['红盒','黄盒','蓝盒'],1,'找题目中提到梨的那句话。','题目说黄盒放梨，所以选黄盒。'],
 ['条件排除','小猫、小狗、小兔各拿一个球。小猫拿红球，小狗拿蓝球，剩下黄球。谁拿黄球？',['小猫','小狗','小兔'],2,'先把红球和蓝球分别配给它们的主人。','小猫拿红球，小狗拿蓝球，剩下小兔拿黄球。'],
 ['条件排除','三个盒子装不同水果。红盒装苹果，蓝盒不装香蕉。香蕉在哪个盒子？',['红盒','黄盒','蓝盒'],1,'红盒已经装苹果，再排除蓝盒。','红盒装苹果，蓝盒不装香蕉，因此香蕉在黄盒。'],
 ['条件排除','小明、小红、小丽各选一种颜色。小明选红色，小红选蓝色，剩下黄色。谁选了黄色？',['小红','小丽','小明'],1,'先找出红色和蓝色分别是谁的。','红色给小明，蓝色给小红，黄色就给小丽。'],
 ['条件排除','桌上只有铅笔、尺子和橡皮。小明拿走铅笔，小红拿走尺子，剩下什么？',['橡皮','铅笔','尺子'],0,'把拿走的两样东西划掉。','铅笔和尺子被拿走了，所以剩下橡皮。'],
 ['比较推理','小明比小红高，小红比小丽高。谁最高？',['小明','小红','小丽'],0,'先排出三个人从高到低的顺序。','从高到低是小明、小红、小丽，所以小明最高。'],
 ['比较推理','小熊比小兔跑得快，小兔比小猫跑得快。谁跑得最慢？',['小熊','小兔','小猫'],2,'从快到慢排一排。','从快到慢是小熊、小兔、小猫，所以小猫最慢。'],
 ['比较推理','红绳比蓝绳长，蓝绳比黄绳长。哪根最短？',['红绳','黄绳','蓝绳'],1,'先从长到短排一排。','从长到短是红绳、蓝绳、黄绳，黄绳最短。'],
 ['比较推理','小安排在小明前面，小明排在小红前面。谁排第一？',['小红','小明','小安'],2,'把三个人按先后顺序写出来。','队伍顺序是小安、小明、小红，小安第一。'],
 ['比较推理','大盒子比中盒子重，中盒子比小盒子重。哪个最重？',['小盒子','中盒子','大盒子'],2,'从重到轻排一排。','从重到轻是大盒子、中盒子、小盒子，所以大盒子最重。']]
level2Extra.forEach(row=>add(2,...row))
let data={wrong:[],records:[],unlocked:1,stars:{}};try{data=Object.assign(data,wx.getStorageSync('detective-v1')||{})}catch(e){}function save(){try{wx.setStorageSync('detective-v1',data)}catch(e){}}
let page='home',grade=2,list=[],idx=0,score=0,choice=-1,hinted=false,review=false,buttons=[],level=0
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function text(t,x,y,size=16,color='#263858',align='left'){ctx.font=size+'px sans-serif';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(t,x,y)}
function wrap(t,x,y,w,size=17,line=24){ctx.font=size+'px sans-serif';let rows=[],r='';for(let c of t){if(ctx.measureText(r+c).width>w&&r){rows.push(r);r=c}else r+=c}if(r)rows.push(r);rows.forEach((r,i)=>text(r,x,y+i*line,size));return y+rows.length*line}
function button(t,x,y,w,h,fn,color='#567bd8'){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);text(t,x+w/2,y+h/2+6,16,'white','center');buttons.push({x,y,w,h,fn})}
function start(g,isReview=false,stage=0){grade=g;review=isReview;level=stage;const pool=bank.filter(q=>q.g===g);list=isReview?shuffle(data.wrong.map(id=>bank.find(q=>q.id===id)).filter(Boolean)).slice(0,5):stage?shuffle(pool.slice((stage-1)*5,stage*5)):shuffle(pool).slice(0,5);if(!list.length){wx.showToast({title:'还没有错题',icon:'none'});return}idx=score=0;choice=-1;hinted=false;page='quiz';draw()}
function select(i){if(choice!==-1)return;choice=i;let q=list[idx];if(i===q.correct){score++;data.wrong=data.wrong.filter(x=>x!==q.id)}else if(!data.wrong.includes(q.id))data.wrong.push(q.id);save();draw()}
function next(){if(++idx<list.length){choice=-1;hinted=false}else{if(level&&!review){let stars=score===5?3:score>=4?2:score>=3?1:0;data.stars[level]=Math.max(data.stars[level]||0,stars);if(stars&&level<5)data.unlocked=Math.max(data.unlocked,level+1)}data.records.unshift({grade,score,total:list.length,review,level,date:new Date().toLocaleDateString()});data.records=data.records.slice(0,20);save();page='result'}draw()}
function draw(){buttons=[];ctx.fillStyle='#f5f8ff';ctx.fillRect(0,0,W,H);let m=20,w=W-40
if(page==='home'){text('🔎 小小逻辑侦探',W/2,55,24,'#293c6a','center');text('每天 5 题，一起学会想一想',W/2,85,14,'#7081a2','center');let y=103;for(let g=1;g<=5;g++){button(g+' 年级'+(g===2?' · 闯关':' · 体验题'),m,y,w,45,()=>{if(g===2){page='map';draw()}else start(g)},g===2?'#eea24f':'#6e8bd8');y+=52}button('错题回顾',m,y+5,(w-10)/2,42,()=>start(grade,true),'#62af92');button('家长记录',m+(w+10)/2,y+5,(w-10)/2,42,()=>{page='records';draw()},'#8396bf');text('本机待复习 '+data.wrong.length+' 题',W/2,y+70,13,'#7081a2','center')}
if(page==='map'){text('二年级 · 侦探关卡',W/2,55,23,'#293c6a','center');text('每关 5 题，答对 3 题解锁下一关',W/2,84,14,'#7183a5','center');for(let i=1;i<=5;i++){let unlocked=i<=data.unlocked,stars=data.stars[i]||0;button(`${unlocked?'第 '+i+' 关':'🔒 第 '+i+' 关'} · ${level2Names[i-1]}${stars?'  '+ '⭐'.repeat(stars):''}`,m,103+(i-1)*53,w,45,()=>{if(unlocked)start(2,false,i);else wx.showToast({title:'先完成前一关',icon:'none'})},unlocked?'#6e8bd8':'#aebbd5')}button('返回首页',m,385,w,42,()=>{page='home';draw()},'#8396bf')}
if(page==='quiz'){let q=list[idx];text((review?'错题回顾':q.g+' 年级')+' · '+q.type,m,38,16);text((idx+1)+' / '+list.length,W-m,38,15,'#7183a5','right');let y=70;y=wrap(q.q,m,y,w,17,24)+8;q.a.forEach((a,i)=>{let color=choice<0?'#728ee0':i===q.correct?'#55ad86':i===choice?'#dc7777':'#aab9d3';button(String.fromCharCode(65+i)+'  '+a,m,y,w,40,()=>select(i),color);y+=47});if(choice<0){button('看提示',m,y+3,100,38,()=>{hinted=true;draw()},'#e9a04a');if(hinted)wrap(q.hint,m,y+65,w,15,21)}else{text(choice===q.correct?'答对了！':'再想一想，看看解析。',m,y+19,15);y=wrap(q.explain,m,y+46,w,15,21);button(idx===list.length-1?'查看结果':'下一题',m,y+8,w,42,next)}}
if(page==='result'){text('🎉 练习完成',W/2,135,26,'#293c6a','center');text(`答对 ${score} / ${list.length} 题`,W/2,200,24,'#d58a36','center');text('每一次思考都值得鼓励！',W/2,240,15,'#7183a5','center');if(level)text(score>=3?'获得 '+(score===5?'⭐⭐⭐':score===4?'⭐⭐':'⭐')+'，继续前进！':'答对 3 题可解锁下一关，再试试吧',W/2,265,14,'#7183a5','center');button(level?'再玩本关':'再来一组',m,295,w,45,()=>start(grade,review,level));button(level?'返回关卡':'返回首页',m,352,w,45,()=>{page=level?'map':'home';draw()},'#8396bf')}
if(page==='records'){text('家长记录',W/2,55,23,'#293c6a','center');text('待复习错题：'+data.wrong.length+' 道',m,95,16);let y=130;if(!data.records.length)text('还没有练习记录。',m,y);data.records.slice(0,6).forEach(r=>{text(`${r.date} ${r.review?'错题':r.grade+'年级'} 答对 ${r.score}/${r.total}`,m,y,14);y+=32});text('记录仅保存在这台设备上',m,Math.min(y+20,H-90),13,'#7183a5');button('返回首页',m,H-60,w,42,()=>{page='home';draw()})}}
wx.onTouchStart(e=>{let p=e.touches[0];if(!p)return;let b=buttons.find(v=>p.clientX>=v.x&&p.clientX<=v.x+v.w&&p.clientY>=v.y&&p.clientY<=v.y+v.h);if(b)b.fn()});draw()
