(() => {
  'use strict';
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  const W=480,H=640,keys=new Set();
  const RARE_CHARACTER_CHANCE=0.0001; // 0.01%: one character roll per new game.
  let basketCharacter=false,lives=1,invulnerable=0,notice='',noticeTime=0;
  function rollRareCharacter(){return Math.random()<RARE_CHARACTER_CHANCE}
  function platformWidth(id){const sizes=[56,76,100,124,148];return sizes[(id+Math.floor(Math.random()*sizes.length))%sizes.length]}
  function platformType(id){return id%7===0?'spring':id%5===0?'fragile':id%6===3?'oily':'normal'}
  function addPlatform(p){
    platforms.push(p);
    if(p.type==='fragile'){
      const leftSpace=p.x-18,rightSpace=W-18-p.x-p.w;
      const room=Math.max(leftSpace,rightSpace);
      const width=Math.min(platformWidth(p.id+2),room-16,280-p.w-16);
      // Small landing areas sit closer; a wide landing area permits a longer gap.
      // Limit the whole pair's span so the next floor is reachable from either side.
      const desiredGap=Math.max(16,Math.min(100,142-p.w+(width-56)*.18));
      const gap=Math.min(desiredGap,room-width,280-p.w-width);
      const x=rightSpace>=leftSpace?p.x+p.w+gap:p.x-gap-width;
      platforms.push({x,y:p.y,w:width,type:'normal',id:p.id,backup:true});
    }
  }
  function nextPlatformX(previous,width,spread){
    const backup=previous.type==='fragile'&&platforms.find(p=>p.backup&&p.id===previous.id);
    // The next floor must also be reachable after taking the cookie's alternate route.
    const center=backup?(Math.min(previous.x,backup.x)+Math.max(previous.x+previous.w,backup.x+backup.w))/2:previous.x+previous.w/2;
    const variation=backup?12:Math.min(spread,190+width*.3);
    return Math.max(18,Math.min(W-18-width,center-width/2+(Math.random()-.5)*variation));
  }
  function takeHit(){
    if(invulnerable>0)return;
    lives--;
    if(lives<=0){end();return}
    // Return to a solid foothold in the current view and give the oil some distance.
    let safe=platforms.find(p=>!p.broken&&p.type==='normal'&&p.y-camera>=330&&p.y-camera<=500);
    if(!safe){safe={x:172,y:camera+420,w:136,type:'normal',id:score};platforms.push(safe);platforms.sort((a,b)=>b.y-a.y)}
    player.x=safe.x+safe.w/2;player.y=safe.y-player.h/2;player.vx=0;player.vy=-540;player.slipTime=0;player.oilPlatform=null;
    oil=camera+680;invulnerable=2;notice=`逃過一炸！還有 ${lives} 條命`;noticeTime=2;beep(220,.16);
  }
  let state='ready',last=0,time=0,camera=0,oil=650,score=0,best=0,platforms=[],particles=[],player,muted=true,audio;
  try{best=Number(localStorage.getItem('fry-up-best'))||0}catch{}
  const ui={score:document.getElementById('score'),best:document.getElementById('best'),overlay:document.getElementById('overlay'),title:document.getElementById('overlayTitle'),text:document.getElementById('overlayText'),tag:document.getElementById('overlayTag'),start:document.getElementById('start'),foot:document.getElementById('overlayFoot')};
  ui.best.textContent=String(best).padStart(3,'0');
  function beep(freq,duration=.08){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
  function reset(){camera=0;oil=655;score=0;time=0;particles=[];basketCharacter=false;lives=1;invulnerable=0;notice='';noticeTime=0;player={x:240,y:528,vx:0,vy:0,w:27,h:44,face:1,squash:0,slipTime:0,oilPlatform:null,slideTimer:0};platforms=[{x:172,y:575,w:136,type:'normal',id:0}];let previous=platforms[0];for(let i=1;i<20;i++){const width=platformWidth(i),p={x:nextPlatformX(previous,width,230),y:575-i*75,w:width,type:platformType(i),id:i};addPlatform(p);previous=p}ui.score.textContent='000'}
  function start(){reset();basketCharacter=rollRareCharacter();lives=basketCharacter?3:1;if(basketCharacter){notice='萬分之一！炸網三薯登場 · 3 條命';noticeTime=4}state='playing';ui.overlay.classList.add('hidden');document.getElementById('pause').textContent='Ⅱ';player.vy=-540;beep(basketCharacter?880:420)}
  function show(tag,title,text,button){ui.tag.textContent=tag;ui.title.textContent=title;ui.text.textContent=text;ui.start.innerHTML=button+' <span>↗</span>';ui.foot.textContent='空白鍵也可以繼續';ui.overlay.classList.remove('hidden')}
  function toggle(){if(state==='playing'){state='paused';keys.clear();show('TAKE A LITTLE BREAK','薯條休息中','喘口氣，再繼續往上。','繼續逃脫');document.getElementById('pause').textContent='▶'}else if(state==='paused'){state='playing';ui.overlay.classList.add('hidden');document.getElementById('pause').textContent='Ⅱ'}else start()}
  function end(){state='over';beep(110,.3);if(score>best){best=score;try{localStorage.setItem('fry-up-best',best)}catch{}ui.best.textContent=String(best).padStart(3,'0')}show('這次有點太酥脆了','變成脆薯了！',`你逃到了第 ${score} 層。再來一次，跳得更高！`,'再逃一次');keys.clear()}
  function burst(x,y,color){for(let i=0;i<8;i++)particles.push({x,y,vx:(Math.random()-.5)*100,vy:-Math.random()*100,t:.45,color})}
  function update(dt){time+=dt;const move=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
    player.slipTime=Math.max(0,player.slipTime-dt);
    if(player.slipTime>0){
      // Passive drag is almost zero. Intentional countersteering is a separate brake.
      if(move){const braking=move*player.vx<0;player.vx+=(move*265-player.vx)*(1-Math.exp(-(braking?18:8)*dt))}
      else player.vx*=Math.exp(-.08*dt);
      player.vx=Math.max(-265,Math.min(265,player.vx));
    }else player.vx+=(move*265-player.vx)*Math.min(1,dt*14);
    if(move)player.face=move;player.x+=player.vx*dt;player.x=Math.max(15,Math.min(W-15,player.x));const prevBottom=player.y+player.h/2;
    const wasSliding=Boolean(player.oilPlatform);
    if(wasSliding){
      const p=player.oilPlatform;player.y=p.y-player.h/2;player.slideTimer-=dt;
      if(player.x+12<=p.x||player.x-12>=p.x+p.w){player.oilPlatform=null;player.vy=35}
      else if(player.slideTimer<=0){player.oilPlatform=null;player.vy=-540}
    }else{player.vy+=1350*dt;player.y+=player.vy*dt}
    player.squash=Math.max(0,player.squash-dt*5);
    invulnerable=Math.max(0,invulnerable-dt);noticeTime=Math.max(0,noticeTime-dt);
    if(!wasSliding&&player.vy>0)for(const p of platforms){if(!p.broken&&prevBottom<=p.y+5&&player.y+player.h/2>=p.y&&player.x+12>p.x&&player.x-12<p.x+p.w){player.y=p.y-player.h/2;player.vy=p.type==='spring'?-710:-540;player.squash=.7;
      if(p.type==='oily'){
        player.oilPlatform=p;player.slideTimer=.24;player.slipTime=.85;player.vy=0;
        // Oil reduces traction; it never supplies a horizontal push of its own.
        notice='油垢超滑！按反方向煞車';noticeTime=1.4;burst(player.x,p.y,'#39392d');
      }else{player.slipTime=0;if(p.type==='fragile'){p.broken=true;burst(player.x,p.y,'#b98a50')}else burst(player.x,p.y,'#a3a77b')}
      score=Math.max(score,p.id);ui.score.textContent=String(score).padStart(3,'0');beep(p.type==='oily'?150:p.type==='spring'?700:320+score%8*40);break}}
    camera=Math.min(camera,player.y-270);oil=Math.min(oil,camera+680);oil-=(30+Math.min(score*1.5,100))*dt;
    const top=platforms.reduce((highest,p)=>!p.backup&&(!highest||p.y<highest.y)?p:highest,null);if(top&&top.y-camera>-150){const id=top.id+1,width=platformWidth(id),x=nextPlatformX(top,width,220);addPlatform({x,y:top.y-72-Math.random()*10,w:width,type:platformType(id),id})}platforms=platforms.filter(p=>p.y-camera<760);
    particles.forEach(p=>{p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=250*dt});particles=particles.filter(p=>p.t>0);
    if(player.y+18>oil||player.y-camera>H+50)takeHit();
  }
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
  function basket(x,y){
    ctx.save();ctx.translate(x,y);ctx.rotate(player.vx*.00035);
    ctx.shadowColor='#eab63e';ctx.shadowBlur=14;
    for(let i=0;i<lives;i++){const fx=-16+i*12,fy=-26+(i===1?-4:0);rounded(fx,fy,9,32,2,'#f6c64b','#886b2f');ctx.fillStyle='#ffe390';ctx.fillRect(fx+2,fy+3,2,16);ctx.fillStyle='#574328';ctx.fillRect(fx+2,fy+10,2,3);ctx.fillRect(fx+6,fy+10,2,3)}
    ctx.shadowBlur=0;rounded(-24,-5,48,26,4,'#a5ada0','#4b5b50');
    ctx.strokeStyle='#53695b';ctx.lineWidth=1;
    for(let x=-18;x<=18;x+=6){ctx.beginPath();ctx.moveTo(x,-3);ctx.lineTo(x,19);ctx.stroke()}
    for(let y=1;y<=19;y+=6){ctx.beginPath();ctx.moveTo(-22,y);ctx.lineTo(22,y);ctx.stroke()}
    ctx.strokeStyle='#4b5b50';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(34,-13);ctx.lineTo(43,-13);ctx.stroke();
    ctx.strokeStyle='#746034';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,21);ctx.lineTo(-15,27);ctx.moveTo(12,21);ctx.lineTo(15,27);ctx.stroke();ctx.restore();
  }
  function fry(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale*(1+player.squash*.15),scale*(1-player.squash*.15));ctx.rotate(player.vx*.00035);ctx.shadowColor='#56583b33';ctx.shadowBlur=0;ctx.shadowOffsetX=4;ctx.shadowOffsetY=4;rounded(-14,-25,28,48,4,'#f0ba3f','#7b622d');ctx.shadowColor='transparent';ctx.fillStyle='#ffdc70';ctx.fillRect(-9,-21,6,36);ctx.fillStyle='#d7972d';ctx.fillRect(8,-19,3,36);ctx.fillStyle='#4a4125';ctx.fillRect(-7+player.face,-6,4,5);ctx.fillRect(4+player.face,-6,4,5);ctx.beginPath();ctx.arc(player.face,3,4,0,Math.PI);ctx.lineWidth=2;ctx.strokeStyle='#694929';ctx.stroke();ctx.fillStyle='#e89853';ctx.fillRect(-10,2,4,3);ctx.fillRect(7,2,4,3);ctx.strokeStyle='#7b622d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-14,7);ctx.lineTo(-21,13);ctx.moveTo(14,7);ctx.lineTo(21,4);ctx.moveTo(-7,23);ctx.lineTo(-9,29);ctx.moveTo(7,23);ctx.lineTo(10,29);ctx.stroke();ctx.restore()}
  function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#e7e6ca';ctx.fillRect(0,0,W,H);const offset=((camera*.3)%64+64)%64;ctx.strokeStyle='#d6d7b9';ctx.lineWidth=1;for(let y=-64;y<H;y+=64){ctx.beginPath();ctx.moveTo(0,y-offset);ctx.lineTo(W,y-offset);ctx.stroke();for(let x=0;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,y-offset);ctx.lineTo(x,y+64-offset);ctx.stroke()}}ctx.fillStyle='#c9cbb0';ctx.fillRect(0,0,12,H);ctx.fillRect(W-12,0,12,H);for(let y=0;y<H;y+=24){ctx.fillStyle='#b6ba9b';ctx.fillRect(3,y-offset%24,6,3);ctx.fillRect(W-9,y-offset%24,6,3)}
    for(const p of platforms){const y=p.y-camera;if(y< -25||y>H||p.broken)continue;const colors=p.type==='oily'?['#292a24','#161913']:p.type==='spring'?['#899e62','#536440']:p.type==='fragile'?['#d3ae76','#967644']:['#9da17e','#656c4d'];rounded(p.x,y,p.w,13,3,colors[0],colors[1]);ctx.fillStyle='#ffffff44';ctx.fillRect(p.x+4,y+3,p.w-8,2);
      if(p.type==='oily'){
        rounded(p.x+2,y-4,p.w-4,9,4,'#20221b');
        rounded(p.x+8,y-2,Math.max(12,p.w*.32),2,1,'#84876a');
        rounded(p.x+p.w*.58,y-1,p.w*.22,2,1,'#555e43');
        rounded(p.x+12,y+9,6,9,3,'#292a24');rounded(p.x+p.w-20,y+10,5,6,2,'#292a24');
        ctx.fillStyle='#aaac88';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('≈ ≈',p.x+p.w/2,y+10);
      }
      if(p.type==='fragile'){ctx.strokeStyle='#947340';ctx.beginPath();ctx.moveTo(p.x+p.w*.55,y);ctx.lineTo(p.x+p.w*.48,y+6);ctx.lineTo(p.x+p.w*.58,y+13);ctx.stroke()}if(p.type==='spring'){ctx.fillStyle='#e2e8bf';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText('↑ ↑ ↑',p.x+p.w/2,y+11)}ctx.fillStyle='#777c5b';ctx.font='9px monospace';ctx.textAlign='left';ctx.fillText(String(p.id).padStart(2,'0'),p.x+2,y+26)}
    if(state!=='ready'&&player.slipTime>0&&Math.abs(player.vx)>35){ctx.strokeStyle='#63664b88';ctx.lineWidth=2;const dir=Math.sign(player.vx);for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(player.x-dir*(22+i*7),player.y-camera+10+i*6);ctx.lineTo(player.x-dir*(42+i*10),player.y-camera+10+i*6);ctx.stroke()}}
    if(state==='ready'){fry(240,155,1.5)}else{ctx.globalAlpha=invulnerable>0&&Math.floor(time*12)%2===0?.35:1;if(basketCharacter)basket(player.x,player.y-camera);else fry(player.x,player.y-camera);ctx.globalAlpha=1}
    for(const p of particles){ctx.globalAlpha=p.t/.45;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y-camera,4,4)}ctx.globalAlpha=1;
    const oy=state==='ready'?560:oil-camera;ctx.fillStyle='#cc662d';ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,oy);for(let x=0;x<=W;x+=8)ctx.lineTo(x,oy+Math.sin(x*.04+time*4)*5);ctx.lineTo(W,H);ctx.closePath();ctx.fill();ctx.strokeStyle='#efad3c';ctx.lineWidth=6;ctx.beginPath();for(let x=0;x<=W;x+=8){const y=oy+Math.sin(x*.04+time*4)*5;x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.fillStyle='#e99436';for(let i=0;i<16;i++){const x=(i*71+23)%W,y=oy+15+(i*23+time*18)%90;ctx.beginPath();ctx.arc(x,y,3+i%5,0,Math.PI*2);ctx.fill()}if(oy<H-20){ctx.fillStyle='#ffda83';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('♨  HOT! HOT! HOT!  ♨',W/2,oy+47)}
    if(oy<H-65){const rim=oy+70;rounded(-12,rim,W+24,85,15,'#62664f','#353d31');rounded(-8,rim,W+16,12,5,'#a8ac8c','#464e3c');ctx.fillStyle='#d2d4b1';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText('THE FRYER • 180°C',W/2,rim+42);ctx.fillStyle='#434b39';ctx.fillRect(20,rim+21,22,7);ctx.fillRect(W-42,rim+21,22,7)}
    ctx.save();ctx.textAlign='center';
    if(basketCharacter){ctx.fillStyle='#e7e6caed';ctx.fillRect(191,15,98,57);ctx.fillStyle='#636c48';ctx.font='9px sans-serif';ctx.fillText('剩餘生命',240,29);
    for(let i=0;i<3;i++){rounded(218+i*18,37,10,22,2,i<lives?'#f3bf45':'#c9cbb5',i<lives?'#886b2f':'#a7ad91');if(i<lives){ctx.fillStyle='#ffe38c';ctx.fillRect(220+i*18,40,2,14)}}}
    if(noticeTime>0){rounded(92,90,296,36,5,'#f4cf69','#6d7549');ctx.fillStyle='#3e492e';ctx.font='bold 14px sans-serif';ctx.fillText(notice,240,113)}ctx.restore();
    // A subtle scanline texture keeps the entire scene feeling like an arcade screen.
    ctx.fillStyle='#3d482507';for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);
  }
  function frame(t){const dt=Math.min((t-last)/1000||0,.025);last=t;if(state==='playing')update(dt);else if(state==='ready')time+=dt;draw();requestAnimationFrame(frame)}
  document.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowLeft','ArrowRight',' ','a','d'].includes(k))e.preventDefault();if(k===' '&&!e.repeat)toggle();else keys.add(k)});document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',()=>{keys.clear();if(state==='playing')toggle()});
  ui.start.addEventListener('click',()=>state==='paused'?toggle():start());document.getElementById('pause').addEventListener('click',toggle);document.getElementById('sound').addEventListener('click',e=>{muted=!muted;e.currentTarget.textContent=muted?'音效 OFF ↗':'音效 ON ♪';beep(520)});
  for(const [id,key]of [['left','ArrowLeft'],['right','ArrowRight']]){const b=document.getElementById(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(key)});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(key))}
  reset();requestAnimationFrame(frame);
})();
