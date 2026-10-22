// ============================================
// Cherry Blossom Game — David Lam Park
// ============================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// Autumn draws its tree on a separate canvas stacked above the duck layer, so
// the ducks walk behind the tree (layer order is in index.html).
const treeCanvas = document.getElementById('treeCanvas');
const treeCtx = treeCanvas.getContext('2d');
let _treeCanvasHasTree = false;
let _treeCanvasLean = null; // lean last drawn to treeCanvas; skip identical frames
const gameContainer = document.getElementById('gameContainer');
let W, H;
let branches = [], leaves = [], blossoms = [], petals = [], wishes = [];
// Season state. 'spring' = original cherry-blossom mechanic (bare → bloom pink).
// 'autumn' = green-leafed tree that visitors tap to color-shift leaves until
// they fall. autumn.js flips this through window.__setGardenSeason().
let season = window.__initialSeason === 'autumn' ? 'autumn' : 'spring';
// Each autumn leaf picks its own final colour [hue, sat, light]; taps blend it
// from green toward that colour over AUTUMN_TURN_STEPS. Hue blends 120→10 pass
// through yellow and orange, so even mid-turn leaves look natural.
// Brown appears once in the list so it stays an accent, not the whole tree.
const AUTUMN_FINALS = [
  [4, 78, 42],   // deep red
  [12, 85, 48],  // red
  [24, 90, 50],  // orange
  [32, 92, 52],  // pumpkin orange
  [44, 92, 52],  // gold
  [20, 55, 34],  // rust brown
];
const AUTUMN_TURN_STEPS = 3;
// Autumn canopy density: a base count per branch plus leaves per canvas px of
// branch length (canvas is 2x CSS px). Raise these for a fuller tree.
const AUTUMN_LEAVES_PER_BRANCH = 6;
const AUTUMN_LEAVES_PER_PX = 0.35;
// Leaf counts are computed as if the canvas were this tall, so every screen
// size grows the same leaves in the same order. That keeps each leaf's uid
// stable when a resize regenerates the tree (see resizeCanvas).
const AUTUMN_REF_HEIGHT = 800;
// Per-leaf odds of falling on one tap / one drag movement once fully turned.
const KNOCK_CHANCE_TAP = 0.2;
const KNOCK_CHANCE_DRAG = 0.02;
// How far a tap / drag reaches, in canvas px (2x CSS px). Generous so a
// thumb on a phone catches plenty of leaves.
const AUTUMN_TAP_RADIUS = 72;
const AUTUMN_DRAG_RADIUS = 44;
function pickAutumnFinal() {
  return AUTUMN_FINALS[Math.floor(Math.random() * AUTUMN_FINALS.length)];
}
// Autumn progress: counted off every time a leaf hits the final tint stage.
// Fully turned triggers phase 2 (knock the leaves loose).
let totalLeavesInit = 0, totalColorShifted = 0, isFullyAutumn = false;
let selectedWishIdx = -1, draggingWishIdx = -1, dragMoved = false;
let dragDownX = 0, dragDownY = 0;
let totalBloomed = 0, totalBranchZones = 0, isFullyBloomed = false;
let windStrength = 0, windTarget = 0, windTimer = 0, gustCooldown = 0;
let mouseVX = 0, mouseVY = 0, lastMouseX = 0, lastMouseY = 0, isMouseDown = false;
let frameCount = 0;
let _animId = null, _lastFrame = 0;
// Paused while the game is scrolled out of view (IntersectionObserver below).
let _gameVisible = true;
// Autumn tree cache: ~2,000 leaves cost several ms per frame to redraw, so in
// autumn the branches + leaves are rendered once into this offscreen layer and
// re-rendered only when a leaf changes (_treeDirty). Wind sways the whole layer
// from the trunk base instead of rotating every leaf. Spring draws live.
let _treeLayer = null, _treeDirty = true;
let _bgBack = null, _bgFront = null;
let clouds = [], sparkles = [], flowers = [];

const bird = {
  x:0, y:0, state:'sitting', timer:0,
  startX:0, startY:0, endX:0, endY:0, ctrlX:0, ctrlY:0,
  t:0, facingLeft:false, headBobPhase:0, visible:false,
  jumping:false, jumpVy:0, jumpY:0, tweetNotes:[],
};

const wishColors = [
  { fill:'#fadadf', stroke:'rgba(200,100,130,0.18)', text:'#a05070' },
  { fill:'#fdf0c8', stroke:'rgba(180,145,50,0.16)',  text:'#9a7020' },
  { fill:'#d8f0dc', stroke:'rgba(75,158,88,0.16)',   text:'#3d7848' },
  { fill:'#e8d8f8', stroke:'rgba(128,80,178,0.16)',  text:'#6848a0' },
  { fill:'#cce8f8', stroke:'rgba(60,128,190,0.16)',  text:'#2d5e9a' },
];
const MAX_WISHES = 8;

// ---- Tree ----
function generateTree() {
  branches=[]; leaves=[]; blossoms=[]; petals=[]; wishes=[];
  totalBloomed=0; isFullyBloomed=false;
  totalLeavesInit=0; totalColorShifted=0; isFullyAutumn=false;
  _treeDirty=true;
  const trunkBaseX=W*0.48, trunkBaseY=H*0.92;
  const trunkTopX=W*0.46,  trunkTopY=H*0.50;
  function addBranch(x1,y1,angle,length,depth,maxDepth) {
    if (depth>maxDepth||length<6) return;
    const x2=x1+Math.cos(angle)*length, y2=y1+Math.sin(angle)*length;
    const thickness=Math.max(1,(maxDepth-depth+1)*2);
    const isTip=depth>=maxDepth-1, canBloom=depth>=2;
    const branchIdx=branches.length;
    branches.push({x1,y1,x2,y2,thickness,depth,isTip,canBloom,bloomed:false,bloomProgress:0,bloomZoneRadius:length*0.6+15});
    // Autumn leafs every branch including the main limbs (depth 1), and spreads
    // leaves by branch LENGTH so they run all the way down each branch instead
    // of bunching at the many short tips — aiming for full-bloom blossom
    // coverage. Spring keeps its original sparse leaves on bloomable branches;
    // its random-call order must not change (trees are seeded).
    const autumn = season === 'autumn';
    if (canBloom || (autumn && depth >= 1)) {
      const numLeaves = autumn
        ? AUTUMN_LEAVES_PER_BRANCH + Math.round((length / H) * AUTUMN_REF_HEIGHT * AUTUMN_LEAVES_PER_PX)
        : (isTip ? 4 : 2) + Math.floor(Math.random() * (isTip ? 5 : 3));
      const tStart = autumn ? 0.04 : 0.15; // 0 = branch base, 1 = tip
      const jitter = autumn ? 22 : 12;
      for (let j=0;j<numLeaves;j++) {
        const t=tStart+Math.random()*(1-tStart);
        leaves.push({
          x:x1+(x2-x1)*t+(Math.random()-0.5)*jitter,
          y:y1+(y2-y1)*t+(Math.random()-0.5)*jitter,
          size: autumn
            ? (isTip?4.5+Math.random()*5:4+Math.random()*4.5)
            : (isTip?3.5+Math.random()*4.5:2.5+Math.random()*3.5),
          angle:angle+(Math.random()-0.5)*1.8,
          hue:100+Math.random()*35,
          lightness:36+Math.random()*18,
          opacity:0.6+Math.random()*0.35,
          branchIdx,
          tintStage:0,
          uid:leaves.length, // stable across regenerations (same seed → same order)
          autumnFinal:autumn ? pickAutumnFinal() : null,
        });
      }
    }
    const numChildren=depth<2?3:(Math.random()<0.6?2:1);
    const spreadBase=depth<2?0.55:0.7;
    for (let i=0;i<numChildren;i++) {
      const spread=(Math.random()-0.5)*spreadBase+(i-(numChildren-1)/2)*0.35;
      addBranch(x2,y2,angle+spread,length*(0.58+Math.random()*0.18),depth+1,maxDepth);
    }
  }
  branches.push({x1:trunkBaseX,y1:trunkBaseY,x2:trunkTopX,y2:trunkTopY,thickness:11,depth:0,isTip:false,bloomed:true,bloomProgress:1,bloomZoneRadius:0});
  const mainBranches=4+Math.floor(Math.random()*3);
  for (let i=0;i<mainBranches;i++) {
    const spreadAngle=-Math.PI/2+(i-(mainBranches-1)/2)*0.42+(Math.random()-0.5)*0.2;
    addBranch(trunkTopX,trunkTopY,spreadAngle,H*(0.10+Math.random()*0.06),1,5);
  }
  totalBranchZones=branches.filter(b=>b.canBloom).length;
  totalLeavesInit=leaves.length;
  updateUI();
  initBird();
}

function resetTree() {
  windTarget=3.5+Math.random()*1.5; gustCooldown=9999;
  document.getElementById('wishModal').style.display='none';
  selectedWishIdx=-1; draggingWishIdx=-1; dragMoved=false; isMouseDown=false; mouseVX=0; mouseVY=0;
  const btn=document.getElementById('wishBtn');
  btn.classList.remove('visible');
  document.getElementById('wishCount').textContent='';
  setTimeout(()=>{ windStrength=0; windTarget=0; gustCooldown=0; _treeSeed=(Date.now()^(Math.random()*0xffffffff|0))|1; _generateTreeSeeded(); initFlowers(); },480);
}

function spawnBlossoms(branch) {
  const n=10+Math.floor(Math.random()*8);
  for (let i=0;i<n;i++) {
    const t=0.1+Math.random()*0.9;
    const bx=branch.x1+(branch.x2-branch.x1)*t+(Math.random()-0.5)*22;
    const by=branch.y1+(branch.y2-branch.y1)*t+(Math.random()-0.5)*22;
    blossoms.push({
      x:bx,y:by,baseX:bx,baseY:by,
      baseRotation:Math.random()*Math.PI*2,rotation:0,
      size:5+Math.random()*7,
      hue:338+Math.random()*22,lightness:78+Math.random()*14,
      opacity:0,targetOpacity:0.85+Math.random()*0.15,
      petalCount:5,spawnTime:frameCount,canShake:false,
      swayOffset:Math.random()*Math.PI*2,
    });
  }
}

function spawnPetal(x,y,vxBase,vyBase) {
  petals.push({
    x,y,
    vx:vxBase*0.5+(Math.random()-0.5)*0.6,
    vy:vyBase*0.5+Math.random()*0.2,
    size:3+Math.random()*4,
    hue:338+Math.random()*24,lightness:80+Math.random()*12,
    rotation:Math.random()*Math.PI*2,rotSpeed:(Math.random()-0.5)*0.03,
    opacity:0.8+Math.random()*0.2,life:1,
    flutter:Math.random()*Math.PI*2,flutterSpeed:0.008+Math.random()*0.012,
    grounded:false,groundY:H*(0.86+Math.random()*0.12),
  });
}

// ---- Wishing Tree ----
function addWishToTree(text) {
  if (wishes.length>=MAX_WISHES) return;
  const pool=branches.filter(b=>b.bloomed&&b.canBloom&&b.depth>=3);
  const src=pool.length>0?pool:branches.filter(b=>b.bloomed&&b.canBloom);
  if (!src.length) return;
  const branch=src[Math.floor(Math.random()*src.length)];
  const t=0.3+Math.random()*0.45;
  const attachX=branch.x1+(branch.x2-branch.x1)*t;
  const attachY=branch.y1+(branch.y2-branch.y1)*t;
  wishes.push({
    text,attachX,attachY,
    angle:(Math.random()-0.5)*0.3,
    baseAngle:(Math.random()-0.5)*0.18,
    swayOffset:Math.random()*Math.PI*2,
    stringLen:36+Math.random()*18,tagW:92,tagH:60,
    colorIdx:wishes.length%wishColors.length,
    opacity:0,dying:false,deathTimer:1,
  });
  spawnSparkles(attachX,attachY);
}

function findNearestBranchPoint(x,y) {
  let bestDist=Infinity,bestX=x,bestY=y;
  branches.forEach(b=>{
    if (!b.bloomed||!b.canBloom) return;
    const dx=b.x2-b.x1,dy=b.y2-b.y1,len2=dx*dx+dy*dy;
    if (len2===0) return;
    const t=Math.max(0.15,Math.min(0.85,((x-b.x1)*dx+(y-b.y1)*dy)/len2));
    const px=b.x1+t*dx,py=b.y1+t*dy;
    const dist=Math.sqrt((x-px)**2+(y-py)**2);
    if (dist<bestDist){bestDist=dist;bestX=px;bestY=py;}
  });
  return {x:bestX,y:bestY};
}

function roundRectPath(ctx,x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawWish(w,wishIdx) {
  if (w.opacity<=0.01) return;
  const hw=w.tagW/2,hh=w.tagH/2;
  const tipX=w.attachX+Math.sin(w.angle)*w.stringLen;
  const tipY=w.attachY+Math.cos(w.angle)*w.stringLen;
  const tagCX=tipX+Math.sin(w.angle)*hh;
  const tagCY=tipY+Math.cos(w.angle)*hh;
  ctx.save();
  ctx.globalAlpha=(wishIdx===draggingWishIdx&&dragMoved)?w.opacity*0.75:w.opacity;
  ctx.beginPath();
  ctx.moveTo(w.attachX,w.attachY);
  const midX=(w.attachX+tipX)/2+Math.sin(w.angle)*4;
  const midY=(w.attachY+tipY)/2+Math.cos(w.angle)*4;
  ctx.quadraticCurveTo(midX,midY,tipX,tipY);
  ctx.strokeStyle='rgba(95,62,42,0.42)'; ctx.lineWidth=1.2; ctx.stroke();
  ctx.save();
  ctx.translate(tagCX,tagCY); ctx.rotate(w.angle);
  const col=wishColors[w.colorIdx];
  ctx.shadowBlur=12; ctx.shadowColor='rgba(80,38,58,0.18)';
  ctx.shadowOffsetX=2; ctx.shadowOffsetY=5;
  roundRectPath(ctx,-hw,-hh,w.tagW,w.tagH,5);
  ctx.fillStyle=col.fill; ctx.fill();
  ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
  roundRectPath(ctx,-hw,-hh,w.tagW,w.tagH,5);
  ctx.strokeStyle=col.stroke; ctx.lineWidth=1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hw-10,-hh); ctx.lineTo(hw,-hh+10);
  ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=1; ctx.stroke();
  if (wishIdx===selectedWishIdx) {
    roundRectPath(ctx,-hw-3,-hh-3,w.tagW+6,w.tagH+6,7);
    ctx.strokeStyle='rgba(195,75,115,0.55)'; ctx.lineWidth=2.5; ctx.stroke();
    const bx=hw+1,by=-hh-1;
    ctx.beginPath(); ctx.arc(bx,by,11,0,Math.PI*2);
    ctx.fillStyle='rgba(205,70,105,0.9)'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='white'; ctx.font='bold 14px Inter,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('×',bx,by+0.5);
  }
  ctx.beginPath(); ctx.arc(0,-hh+9,4,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=col.text; ctx.font='500 13px Inter,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const maxLineW=w.tagW-18,lineH=16,words=w.text.split(' ');
  const lines=[]; let cur='';
  for (const word of words) {
    const test=cur?cur+' '+word:word;
    if (ctx.measureText(test).width>maxLineW&&cur){lines.push(cur);cur=word;}else{cur=test;}
  }
  if (cur) lines.push(cur);
  const startY=-lines.length*lineH/2+lineH/2+5;
  lines.forEach((line,i)=>ctx.fillText(line,0,startY+i*lineH));
  ctx.restore(); ctx.restore(); ctx.globalAlpha=1;
}

// ---- Clouds ----
function makePuffs() {
  const puffs=[{dx:0,dy:0,r:16+Math.random()*12}];
  const count=3+Math.floor(Math.random()*3),spread=22+Math.random()*18;
  for (let i=1;i<count;i++) puffs.push({dx:(Math.random()-0.5)*spread*2,dy:5+Math.random()*10,r:10+Math.random()*13});
  return puffs;
}
function initClouds() {
  clouds=[];
  for (let i=0;i<3;i++) clouds.push({x:Math.random()*W,y:H*(0.03+Math.random()*0.20),speed:0.075+Math.random()*0.11,scale:0.65+Math.random()*0.55,opacity:0.20+Math.random()*0.22,puffs:makePuffs()});
}
function updateClouds() {
  clouds.forEach(c=>{
    c.x+=c.speed;
    if (c.x>W+130*c.scale){c.x=-130*c.scale;c.y=H*(0.03+Math.random()*0.20);c.opacity=0.20+Math.random()*0.22;c.scale=0.65+Math.random()*0.55;c.puffs=makePuffs();}
  });
}
function drawClouds() {
  if (season === 'autumn') return; // Clear night sky in autumn.
  clouds.forEach(c=>{
    ctx.save(); ctx.globalAlpha=c.opacity; ctx.translate(c.x,c.y); ctx.scale(c.scale,c.scale);
    c.puffs.forEach(p=>{ctx.beginPath();ctx.arc(p.dx,p.dy,p.r,0,Math.PI*2);ctx.fillStyle='rgba(255,250,255,1)';ctx.fill();});
    ctx.restore();
  });
}

// ---- Sparkles ----
function spawnSparkles(x,y) {
  const colors=['rgba(255,218,70,0.95)','rgba(255,245,145,0.9)','rgba(255,198,110,0.9)','rgba(255,232,195,0.85)','rgba(255,175,195,0.8)','rgba(255,200,220,0.9)'];
  for (let i=0;i<32;i++) {
    const angle=Math.random()*Math.PI*2,speed=2.8+Math.random()*5.5;
    sparkles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-3.5,life:1,decay:0.010+Math.random()*0.010,size:4+Math.random()*7,color:colors[Math.floor(Math.random()*colors.length)]});
  }
}
function updateSparkles() {
  for (let i=sparkles.length-1;i>=0;i--){
    const s=sparkles[i]; s.x+=s.vx; s.y+=s.vy; s.vy+=0.045; s.vx*=0.968; s.life-=s.decay;
    if (s.life<=0) sparkles.splice(i,1);
  }
}
function drawSparkles() {
  sparkles.forEach(s=>{
    ctx.save(); ctx.globalAlpha=Math.max(0,s.life)*0.95;
    ctx.shadowColor='rgba(255,210,50,0.9)'; ctx.shadowBlur=14;
    ctx.fillStyle=s.color;
    const r=s.size,inner=s.size*0.38;
    ctx.beginPath();
    for (let p=0;p<8;p++){const a=(p*Math.PI)/4+frameCount*0.02;const rr=p%2===0?r:inner;p===0?ctx.moveTo(s.x+Math.cos(a)*rr,s.y+Math.sin(a)*rr):ctx.lineTo(s.x+Math.cos(a)*rr,s.y+Math.sin(a)*rr);}
    ctx.closePath(); ctx.fill(); ctx.restore();
  });
}

// ---- Bird ----
function initBird() {
  const perchable=branches.filter(b=>b.canBloom&&b.depth>=2&&b.depth<=4);
  if (!perchable.length){bird.visible=false;return;}
  const b=perchable[Math.floor(Math.random()*perchable.length)];
  const tParam=0.25+Math.random()*0.45;
  bird.x=b.x1+(b.x2-b.x1)*tParam; bird.y=b.y1+(b.y2-b.y1)*tParam;
  bird.facingLeft=b.x2<b.x1; bird.state='sitting';
  bird.timer=200+Math.floor(Math.random()*300); bird.headBobPhase=Math.random()*Math.PI*2; bird.visible=true;
}
function updateBird() {
  if (!bird.visible) return;
  // Jump physics
  if (bird.jumping) {
    bird.jumpVy += 1.3;
    bird.jumpY += bird.jumpVy;
    if (bird.jumpY >= 0) { bird.jumpY=0; bird.jumpVy=0; bird.jumping=false; }
  }
  // Tweet notes float up and fade
  for (let i=bird.tweetNotes.length-1;i>=0;i--) {
    const n=bird.tweetNotes[i];
    n.x+=n.vx; n.y+=n.vy; n.vy+=0.025;
    n.life-=n.decay;
    if(n.life<=0) bird.tweetNotes.splice(i,1);
  }
  bird.headBobPhase+=0.03;
  if (bird.state==='sitting') {
    bird.timer--;
    if (bird.timer<=0) {
      const perchable=branches.filter(b=>b.canBloom&&b.depth>=2&&b.depth<=4);
      if (perchable.length<2){bird.timer=160;return;}
      let b,tParam,tries=0;
      do{b=perchable[Math.floor(Math.random()*perchable.length)];tParam=0.25+Math.random()*0.45;tries++;}while(tries<8&&Math.abs(b.x1+(b.x2-b.x1)*tParam-bird.x)<40);
      bird.startX=bird.x;bird.startY=bird.y;
      bird.endX=b.x1+(b.x2-b.x1)*tParam;bird.endY=b.y1+(b.y2-b.y1)*tParam;
      bird.ctrlX=(bird.startX+bird.endX)/2;bird.ctrlY=Math.min(bird.startY,bird.endY)-75-Math.random()*55;
      bird.t=0;bird.state='flying';bird.facingLeft=bird.endX<bird.startX;
    }
  } else if (bird.state==='flying') {
    bird.t+=0.021+Math.random()*0.004;
    if (bird.t>=1){bird.t=1;bird.x=bird.endX;bird.y=bird.endY;bird.state='sitting';bird.timer=220+Math.floor(Math.random()*360);}
    else{const inv=1-bird.t;bird.x=inv*inv*bird.startX+2*inv*bird.t*bird.ctrlX+bird.t*bird.t*bird.endX;bird.y=inv*inv*bird.startY+2*inv*bird.t*bird.ctrlY+bird.t*bird.t*bird.endY;}
  }
}
function drawBird() {
  if (!bird.visible) return;
  const headBob=bird.state==='sitting'?Math.sin(bird.headBobPhase)*1.3:0;
  const wingFlap=bird.state==='flying'?Math.sin(frameCount*0.42)*7:0;
  ctx.save();ctx.translate(bird.x,bird.y+(bird.jumpY||0));if(bird.facingLeft)ctx.scale(-1,1);
  const bodyColor='rgba(55,98,168,0.90)';
  if(bird.state==='flying'){ctx.beginPath();ctx.ellipse(2,-wingFlap,11,4,-0.2,0,Math.PI*2);ctx.fillStyle='rgba(42,80,152,0.82)';ctx.fill();}
  ctx.beginPath();ctx.ellipse(0,0,13,8,0.1,0,Math.PI*2);ctx.fillStyle=bodyColor;ctx.fill();
  ctx.beginPath();ctx.moveTo(-10,1);ctx.lineTo(-19,-3);ctx.lineTo(-17,6);ctx.closePath();ctx.fillStyle=bodyColor;ctx.fill();
  ctx.beginPath();ctx.arc(10,-7+headBob,8,0,Math.PI*2);ctx.fillStyle=bodyColor;ctx.fill();
  ctx.beginPath();ctx.moveTo(16,-7+headBob);ctx.lineTo(23,-6+headBob);ctx.lineTo(16,-4+headBob);ctx.closePath();ctx.fillStyle='rgba(80,65,42,0.92)';ctx.fill();
  ctx.beginPath();ctx.arc(12,-8+headBob,1.8,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.92)';ctx.fill();
  ctx.beginPath();ctx.arc(12.5,-8+headBob,0.85,0,Math.PI*2);ctx.fillStyle='rgba(10,5,8,0.95)';ctx.fill();
  ctx.restore();
  // Draw tweet notes floating up
  if (bird.tweetNotes.length>0) {
    ctx.save();
    ctx.font='bold 28px serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    bird.tweetNotes.forEach(n=>{
      ctx.globalAlpha=Math.max(0,n.life)*0.90;
      ctx.fillStyle='rgba(72,115,205,0.92)';
      ctx.fillText(n.note,n.x,n.y);
    });
    ctx.restore();
  }
}

// ---- Canada Geese (V formation) ----
const geese={x:0,y:0,speed:0,waitTimer:0,wingPhase:0,active:false,scale:1,alpha:0.70};
function initGeese(){geese.active=false;geese.waitTimer=2400+Math.floor(Math.random()*3000);}
function updateGeese(){
  if(!geese.active){if(--geese.waitTimer<=0){geese.x=-180;geese.y=H*(0.08+Math.random()*0.09);geese.speed=0.28+Math.random()*0.14;geese.wingPhase=0;geese.active=true;}return;}
  geese.wingPhase+=0.09;geese.x+=geese.speed;
  // Scale & fade to simulate flying in/out of the distance
  const prog=(geese.x+180)/(W+360);
  if(prog<0.12){const t=prog/0.12;geese.scale=0.3+t*0.7;geese.alpha=t*0.70;}
  else if(prog>0.88){const t=(prog-0.88)/0.12;geese.scale=1.0-t*0.7;geese.alpha=(1-t)*0.70;}
  else{geese.scale=1.0;geese.alpha=0.70;}
  if(geese.x>W+180)initGeese();
}
function drawGeese(){
  if(!geese.active||geese.alpha<=0.01)return;
  const pos=[[0,0],[-18,-9],[18,-9],[-36,-18],[36,-18],[-54,-27],[54,-27]];
  const s=geese.scale;
  ctx.save();
  pos.forEach(([dx,dy],i)=>{
    const flap=Math.sin(geese.wingPhase-i*0.38)*3*s;
    const gx=geese.x+dx*s,gy=geese.y+dy*s;
    ctx.beginPath();ctx.moveTo(gx-6*s,gy-flap);ctx.quadraticCurveTo(gx-2.5*s,gy+0.8*s,gx,gy);ctx.quadraticCurveTo(gx+2.5*s,gy+0.8*s,gx+6*s,gy-flap);
    ctx.strokeStyle=`rgba(35,30,25,${geese.alpha.toFixed(2)})`;ctx.lineWidth=Math.max(0.5,1.3*s);ctx.lineCap='round';ctx.stroke();
  });
  ctx.restore();
}

// ---- Ferry ----
const ferry={x:-110,y:0,speed:0.45,waitTimer:0,sparkTimer:0,sparkParticles:[],confettiParticles:[]};
function initFerry(){ferry.y=H*(0.535+Math.random()*0.025);ferry.x=-110;ferry.waitTimer=90+Math.floor(Math.random()*180);ferry.ferryType=Math.random()<0.5?'bcferry':'aquabus';}
function updateFerry(){
  // Update electric spark particles
  for(let i=ferry.sparkParticles.length-1;i>=0;i--){
    const p=ferry.sparkParticles[i];
    p.x+=p.vx;p.y+=p.vy;p.vy+=0.08;p.vx*=0.95;
    p.life-=p.decay;
    if(p.life<=0)ferry.sparkParticles.splice(i,1);
  }
  // Update confetti particles
  for(let i=ferry.confettiParticles.length-1;i>=0;i--){
    const p=ferry.confettiParticles[i];
    p.x+=p.vx;p.y+=p.vy;p.vy+=0.055;p.vx*=0.98;p.rot+=p.rotV;
    p.life-=p.decay;
    if(p.life<=0)ferry.confettiParticles.splice(i,1);
  }
  if(ferry.waitTimer>0){ferry.waitTimer--;return;}
  // Spawn sparks from sparkTimer
  if(ferry.sparkTimer>0){
    ferry.sparkTimer--;
    if(ferry.sparkTimer%8===0){
      const cols=['rgba(120,200,255,0.95)','rgba(255,255,180,0.95)','rgba(180,240,255,0.95)','rgba(255,240,100,0.92)'];
      for(let i=0;i<5;i++){
        const angle=(Math.random()-0.5)*Math.PI-Math.PI/2;
        const speed=2.5+Math.random()*4;
        ferry.sparkParticles.push({
          x:ferry.x+(Math.random()-0.5)*60,y:ferry.y-18,
          vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
          life:1,decay:0.022+Math.random()*0.012,
          size:2+Math.random()*3.5,
          color:cols[Math.floor(Math.random()*cols.length)]
        });
      }
    }
  }
  ferry.x+=ferry.speed;
  if(ferry.x>W+110){ferry.x=-110;ferry.y=H*(0.535+Math.random()*0.025);ferry.waitTimer=360+Math.floor(Math.random()*480);ferry.ferryType=Math.random()<0.5?'bcferry':'aquabus';}
}
function drawFerry(){
  // Draw electric spark particles (world space)
  if(ferry.sparkParticles.length>0){
    ctx.save();
    ferry.sparkParticles.forEach(p=>{
      ctx.globalAlpha=Math.max(0,p.life)*0.88;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fillStyle=p.color;
      ctx.shadowColor='rgba(100,200,255,0.8)';ctx.shadowBlur=8;
      ctx.fill();
      // tiny lightning bolt crosshair
      ctx.globalAlpha*=0.6;ctx.strokeStyle=p.color;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(p.x-p.size*1.4,p.y);ctx.lineTo(p.x+p.size*1.4,p.y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x,p.y-p.size*1.4);ctx.lineTo(p.x,p.y+p.size*1.4);ctx.stroke();
    });
    ctx.restore();
  }
  // Draw confetti particles (world space)
  if(ferry.confettiParticles.length>0){
    ctx.save();
    ferry.confettiParticles.forEach(p=>{
      ctx.globalAlpha=Math.max(0,p.life)*0.92;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.fillStyle=p.color;
      ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });
    ctx.restore();
  }
  ctx.save();ctx.translate(ferry.x,ferry.y);
  ctx.save();ctx.globalAlpha=0.20;ctx.strokeStyle='rgba(210,230,248,0.9)';
  for(let i=0;i<3;i++){ctx.lineWidth=1.2-i*0.3;ctx.beginPath();ctx.moveTo(-44-i*8,-1+i*2);ctx.lineTo(-82-i*16,-1+i*2);ctx.stroke();}
  ctx.restore();
  if(ferry.ferryType==='aquabus'){
    // Aquabus: red hull, white cabin, rainbow stripe
    ctx.beginPath();ctx.moveTo(-44,0);ctx.lineTo(-44,-13);ctx.lineTo(36,-13);ctx.quadraticCurveTo(48,-13,50,-4);ctx.lineTo(44,0);ctx.closePath();
    ctx.fillStyle='rgba(195,25,25,0.94)';ctx.fill();
    ctx.beginPath();ctx.moveTo(-44,-4);ctx.lineTo(44,-4);ctx.strokeStyle='rgba(20,20,20,0.40)';ctx.lineWidth=1.2;ctx.stroke();
    roundRectPath(ctx,-38,-32,76,19,4);ctx.fillStyle='rgba(245,245,245,0.97)';ctx.fill();ctx.strokeStyle='rgba(18,38,90,0.18)';ctx.lineWidth=0.8;ctx.stroke();
    // Rainbow stripe band across lower cabin
    ctx.save();const rc=['#e8282a','#f47920','#fded00','#00a650','#0072ce','#7b1fa2'];roundRectPath(ctx,-38,-21,76,8,2);ctx.clip();rc.forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(-38+i*(76/rc.length),-21,76/rc.length+1,8);});ctx.restore();
    // Windows (upper cabin)
    ctx.fillStyle='rgba(140,185,220,0.55)';
    [-30,-21,-12,-3,6,15,24].forEach(wx=>{roundRectPath(ctx,wx,-31,7,9,1.5);ctx.fill();});
  }else{
    // BC Ferry: dark navy hull, light cabin
    ctx.beginPath();ctx.moveTo(-44,0);ctx.lineTo(-44,-13);ctx.lineTo(36,-13);ctx.quadraticCurveTo(48,-13,50,-4);ctx.lineTo(44,0);ctx.closePath();
    ctx.fillStyle='rgba(18,38,90,0.94)';ctx.fill();
    ctx.beginPath();ctx.moveTo(-44,-4);ctx.lineTo(44,-4);ctx.strokeStyle='rgba(220,232,255,0.50)';ctx.lineWidth=1.2;ctx.stroke();
    roundRectPath(ctx,-38,-32,76,19,4);ctx.fillStyle='rgba(240,246,255,0.97)';ctx.fill();ctx.strokeStyle='rgba(18,38,90,0.18)';ctx.lineWidth=0.8;ctx.stroke();
    ctx.fillStyle='rgba(140,185,220,0.55)';
    [-30,-21,-12,-3,6,15,24].forEach(wx=>{roundRectPath(ctx,wx,-30,7,12,1.5);ctx.fill();});
  }
  roundRectPath(ctx,-10,-46,34,14,3);ctx.fillStyle='rgba(238,244,255,0.96)';ctx.fill();ctx.strokeStyle='rgba(18,38,90,0.15)';ctx.lineWidth=0.7;ctx.stroke();
  ctx.fillStyle='rgba(150,195,228,0.55)';roundRectPath(ctx,-6,-44,26,9,2);ctx.fill();
  ctx.beginPath();ctx.moveTo(6,-46);ctx.lineTo(6,-72);ctx.strokeStyle='rgba(120,145,185,0.80)';ctx.lineWidth=1.2;ctx.stroke();
  // Canadian flag at mast top: vertical red | white+maple | red
  ctx.fillStyle='rgba(210,0,0,0.92)';ctx.fillRect(-18,-72,6,16);ctx.fillRect(0,-72,6,16);
  ctx.fillStyle='rgba(250,250,250,0.97)';ctx.fillRect(-12,-72,12,16);
  ctx.fillStyle='rgba(210,0,0,0.92)';(function(){const mx=-6,my=-64;ctx.beginPath();ctx.moveTo(mx,my-5);ctx.lineTo(mx-1,my-3);ctx.lineTo(mx-3,my-4);ctx.lineTo(mx-2.5,my-2);ctx.lineTo(mx-5,my-1);ctx.lineTo(mx-3,my+0.5);ctx.lineTo(mx-4,my+2);ctx.lineTo(mx-1,my+1.5);ctx.lineTo(mx-0.5,my+4);ctx.lineTo(mx+0.5,my+4);ctx.lineTo(mx+1,my+1.5);ctx.lineTo(mx+4,my+2);ctx.lineTo(mx+3,my+0.5);ctx.lineTo(mx+5,my-1);ctx.lineTo(mx+2.5,my-2);ctx.lineTo(mx+3,my-4);ctx.lineTo(mx+1,my-3);ctx.closePath();ctx.fill();})();
  ctx.restore();
}

// ---- Sailboat ----
const sailboat={x:0,y:0,speed:0.15,waitTimer:0,gustTimer:0};
function initSailboat(){sailboat.y=H*(0.462+Math.random()*0.018);sailboat.x=W+60;sailboat.waitTimer=300+Math.floor(Math.random()*300);}
function updateSailboat(){
  if(sailboat.waitTimer>0){sailboat.waitTimer--;return;}
  if(sailboat.gustTimer>0){
    sailboat.gustTimer--;
    sailboat.speed=0.15+Math.sin((sailboat.gustTimer/130)*Math.PI)*1.2;
  } else {
    sailboat.speed=0.15;
  }
  sailboat.x-=sailboat.speed;
  if(sailboat.x<-65){sailboat.x=W+60;sailboat.y=H*(0.462+Math.random()*0.018);sailboat.waitTimer=540+Math.floor(Math.random()*600);sailboat.gustTimer=0;}
}
function drawSailboat(){
  ctx.save();ctx.translate(sailboat.x,sailboat.y);
  if(sailboat.gustTimer>0){
    const heel=Math.sin((sailboat.gustTimer/130)*Math.PI)*0.16;
    ctx.rotate(heel);
  }
  ctx.save();ctx.globalAlpha=0.16;ctx.strokeStyle='rgba(210,230,248,0.9)';
  for(let i=0;i<2;i++){ctx.lineWidth=0.85-i*0.3;ctx.beginPath();ctx.moveTo(18+i*4,-0.5);ctx.lineTo(40+i*9,-0.5);ctx.stroke();}
  ctx.restore();
  ctx.beginPath();ctx.moveTo(-22,0);ctx.lineTo(-16,-7);ctx.lineTo(16,-7);ctx.lineTo(18,0);ctx.closePath();
  ctx.fillStyle='rgba(248,245,238,0.96)';ctx.fill();ctx.strokeStyle='rgba(155,135,115,0.30)';ctx.lineWidth=0.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-19,-2.5);ctx.lineTo(17,-2.5);ctx.strokeStyle='rgba(185,52,52,0.68)';ctx.lineWidth=1.3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-7);ctx.lineTo(-4,-52);ctx.strokeStyle='rgba(105,85,68,0.90)';ctx.lineWidth=1.4;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-9);ctx.lineTo(16,-9);ctx.strokeStyle='rgba(105,85,68,0.72)';ctx.lineWidth=0.9;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-50);ctx.lineTo(16,-9);ctx.lineTo(-4,-9);ctx.closePath();ctx.fillStyle='rgba(252,248,234,0.88)';ctx.fill();ctx.strokeStyle='rgba(178,162,138,0.32)';ctx.lineWidth=0.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-44);ctx.lineTo(-20,-7);ctx.lineTo(-4,-9);ctx.closePath();ctx.fillStyle='rgba(234,244,255,0.80)';ctx.fill();ctx.strokeStyle='rgba(155,172,198,0.28)';ctx.lineWidth=0.5;ctx.stroke();
  ctx.restore();
}

// ---- Sailboat 2 (smaller & slower, further away near horizon) ----
const sailboat2={x:0,y:0,speed:0.10,waitTimer:0,gustTimer:0};
function initSailboat2(){sailboat2.y=H*(0.440+Math.random()*0.010);sailboat2.x=W+50;sailboat2.waitTimer=1500+Math.floor(Math.random()*900);}
function updateSailboat2(){
  if(sailboat2.waitTimer>0){sailboat2.waitTimer--;return;}
  if(sailboat2.gustTimer>0){
    sailboat2.gustTimer--;
    sailboat2.speed=0.10+Math.sin((sailboat2.gustTimer/130)*Math.PI)*1.0;
  } else {
    sailboat2.speed=0.10;
  }
  sailboat2.x-=sailboat2.speed;
  if(sailboat2.x<-55){sailboat2.x=W+50;sailboat2.y=H*(0.440+Math.random()*0.010);sailboat2.waitTimer=720+Math.floor(Math.random()*720);sailboat2.gustTimer=0;}
}
function triggerSailboat2Gust(){
  if(sailboat2.waitTimer>0)return;
  sailboat2.gustTimer=130;
}
function drawSailboat2(){
  ctx.save();ctx.translate(sailboat2.x,sailboat2.y);ctx.scale(0.80,0.80);
  if(sailboat2.gustTimer>0){
    const heel=Math.sin((sailboat2.gustTimer/130)*Math.PI)*0.16;
    ctx.rotate(heel);
  }
  ctx.save();ctx.globalAlpha=0.13;ctx.strokeStyle='rgba(210,230,248,0.9)';
  for(let i=0;i<2;i++){ctx.lineWidth=0.85-i*0.3;ctx.beginPath();ctx.moveTo(18+i*4,-0.5);ctx.lineTo(40+i*9,-0.5);ctx.stroke();}
  ctx.restore();
  ctx.beginPath();ctx.moveTo(-22,0);ctx.lineTo(-16,-7);ctx.lineTo(16,-7);ctx.lineTo(18,0);ctx.closePath();
  ctx.fillStyle='rgba(248,245,238,0.90)';ctx.fill();ctx.strokeStyle='rgba(155,135,115,0.25)';ctx.lineWidth=0.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-19,-2.5);ctx.lineTo(17,-2.5);ctx.strokeStyle='rgba(185,52,52,0.60)';ctx.lineWidth=1.3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-7);ctx.lineTo(-4,-52);ctx.strokeStyle='rgba(105,85,68,0.85)';ctx.lineWidth=1.4;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-9);ctx.lineTo(16,-9);ctx.strokeStyle='rgba(105,85,68,0.68)';ctx.lineWidth=0.9;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-50);ctx.lineTo(16,-9);ctx.lineTo(-4,-9);ctx.closePath();ctx.fillStyle='rgba(252,248,234,0.82)';ctx.fill();ctx.strokeStyle='rgba(178,162,138,0.28)';ctx.lineWidth=0.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-44);ctx.lineTo(-20,-7);ctx.lineTo(-4,-9);ctx.closePath();ctx.fillStyle='rgba(234,244,255,0.74)';ctx.fill();ctx.strokeStyle='rgba(155,172,198,0.24)';ctx.lineWidth=0.5;ctx.stroke();
  ctx.restore();
}


// ---- Orca ----
const orca={phase:'hidden',x:0,y:0,rise:0,peakTimer:0,breathTimer:0,vx:0,blowParticles:[]};
function initOrca(){orca.phase='hidden';orca.breathTimer=1500+Math.floor(Math.random()*900);}
function updateOrca(){
  if(orca.phase==='hidden'){
    orca.breathTimer--;
    if(orca.breathTimer<=0){
      orca.x=W*(0.10+Math.random()*0.80);orca.y=H*0.490;orca.rise=0;
      orca.vx=(Math.random()<0.5?1:-1)*(0.12+Math.random()*0.09);
      orca.phase='rising';orca.peakTimer=150+Math.floor(Math.random()*100);
    }return;
  }
  if(orca.phase==='rising'){orca.rise=Math.min(1,orca.rise+0.008);orca.x+=orca.vx;if(orca.rise>=1)orca.phase='peaked';return;}
  if(orca.phase==='peaked'){orca.x+=orca.vx;orca.peakTimer--;if(orca.peakTimer<=0)orca.phase='submerging';return;}
  if(orca.phase==='submerging'){orca.rise=Math.max(0,orca.rise-0.0067);orca.x+=orca.vx;if(orca.rise<=0){orca.phase='hidden';orca.breathTimer=1500+Math.floor(Math.random()*1000);}return;}
}
function drawOrca(){
  // Blowhole particles (world space — persist even while submerging)
  if(orca.blowParticles.length>0){
    ctx.save();
    orca.blowParticles.forEach(p=>{
      ctx.globalAlpha=Math.max(0,p.life)*0.78;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fillStyle='rgba(195,228,250,0.94)';
      ctx.shadowColor='rgba(160,215,245,0.6)';ctx.shadowBlur=6;
      ctx.fill();
    });
    ctx.restore();
  }
  if(orca.phase==='hidden'||orca.rise<=0)return;
  ctx.save();
  const subY=(1-orca.rise)*30;
  ctx.translate(orca.x,orca.y+subY);
  if(orca.vx<0)ctx.scale(-1,1);
  ctx.globalAlpha=Math.min(1,orca.rise*3)*0.86;
  // Back hump
  ctx.beginPath();ctx.moveTo(-48,4);ctx.ellipse(0,4,48,15,0,Math.PI,0);ctx.closePath();
  ctx.fillStyle='rgba(10,10,22,0.92)';ctx.fill();
  // Dorsal fin
  ctx.beginPath();ctx.moveTo(2,0);ctx.bezierCurveTo(-1,-24,4,-30,9,-22);ctx.lineTo(18,0);ctx.closePath();
  ctx.fillStyle='rgba(10,10,22,0.92)';ctx.fill();
  // White saddle patch
  ctx.beginPath();ctx.ellipse(19,-4,11,7,0.28,0,Math.PI*2);
  ctx.fillStyle='rgba(236,244,255,0.88)';ctx.fill();
  ctx.restore();
}

function updateOrcaParticles(){
  for(let i=orca.blowParticles.length-1;i>=0;i--){
    const p=orca.blowParticles[i];
    p.x+=p.vx;p.y+=p.vy;p.vy+=0.14;p.vx*=0.96;
    p.life-=0.024;
    if(p.life<=0)orca.blowParticles.splice(i,1);
  }
}

// ---- Dog ----
const dog={x:0,y:0,state:'sitting',dir:1,stateTimer:0,tailPhase:0,legPhase:0,spinning:false,spinAngle:0,spinCenterX:0,spinCenterY:0};

function initDog(){
  dog.x=W*(0.28+Math.random()*0.44);dog.y=H*0.660;
  dog.state='sitting';dog.stateTimer=150+Math.floor(Math.random()*200);
  dog.tailPhase=Math.random()*Math.PI*2;dog.dir=1;
}
function updateDog(){
  dog.tailPhase+=0.14;
  if(dog.spinning){
    dog.tailPhase+=0.20;  // fast wag
    dog.legPhase+=0.28;   // legs running fast
    dog.spinAngle+=0.10;  // angular speed around circle
    const r=22;
    dog.x=dog.spinCenterX+r*Math.cos(dog.spinAngle);
    dog.y=dog.spinCenterY+r*0.18*Math.sin(dog.spinAngle); // slight y-bob for perspective
    dog.dir=-Math.sin(dog.spinAngle)>=0?1:-1; // flip direction with x-velocity
    if(dog.spinAngle>=Math.PI*4){// 2 full circles
      dog.spinning=false;dog.spinAngle=0;
      dog.x=dog.spinCenterX;dog.y=dog.spinCenterY;
    }
    return;
  }
  if(dog.state==='walking'){
    dog.legPhase+=0.22;dog.x+=0.40*dog.dir;
    if(dog.x<W*0.06||dog.x>W*0.94)dog.dir*=-1;
    dog.stateTimer--;
    if(dog.stateTimer<=0){const r=Math.random();dog.state=r<0.42?'sitting':r<0.68?'sniffing':'walking';dog.stateTimer=130+Math.floor(Math.random()*220);}
  }else{
    dog.stateTimer--;
    if(dog.stateTimer<=0){dog.state='walking';dog.stateTimer=110+Math.floor(Math.random()*180);}
  }
}
function drawDog(){
  const sniffing=!dog.spinning&&dog.state==='sniffing',sitting=!dog.spinning&&dog.state==='sitting';
  const walkBob=(dog.spinning||dog.state==='walking')?Math.sin(dog.legPhase)*1.8:0;
  const headNod=sniffing?8:0,tailWag=Math.sin(dog.tailPhase)*11;
  ctx.save();ctx.translate(dog.x,dog.y+walkBob);
  if(dog.dir<0)ctx.scale(-1,1);
  ctx.globalAlpha=0.90;
  // Legs
  ctx.strokeStyle='rgba(185,145,82,0.88)';ctx.lineWidth=2.8;ctx.lineCap='round';
  if(!sitting){
    const ls=(dog.spinning||dog.state==='walking')?Math.sin(dog.legPhase)*5:0;
    [[-9,ls],[-4,-ls],[3,ls],[8,-ls]].forEach(([lx,sw])=>{ctx.beginPath();ctx.moveTo(lx,6);ctx.lineTo(lx+sw*0.35,14);ctx.stroke();});
  }else{ctx.beginPath();ctx.moveTo(-7,7);ctx.lineTo(-10,12);ctx.stroke();ctx.beginPath();ctx.moveTo(5,7);ctx.lineTo(8,12);ctx.stroke();}
  // Body
  ctx.beginPath();ctx.ellipse(0,0,18,9,sniffing?0.16:0,0,Math.PI*2);
  ctx.fillStyle='rgba(208,168,105,0.93)';ctx.fill();ctx.strokeStyle='rgba(162,122,62,0.22)';ctx.lineWidth=0.7;ctx.stroke();
  // Tail
  ctx.beginPath();ctx.moveTo(-16,-1);ctx.quadraticCurveTo(-25,-10+tailWag,-21,-20+tailWag);
  ctx.strokeStyle='rgba(192,150,85,0.92)';ctx.lineWidth=3.2;ctx.lineCap='round';ctx.stroke();
  // Head
  ctx.beginPath();ctx.arc(18,-5+headNod,9,0,Math.PI*2);
  ctx.fillStyle='rgba(215,175,110,0.95)';ctx.fill();ctx.strokeStyle='rgba(162,122,62,0.20)';ctx.lineWidth=0.7;ctx.stroke();
  // Floppy ears
  ctx.beginPath();ctx.ellipse(14,-7+headNod,5,8,0.55,0,Math.PI*2);ctx.fillStyle='rgba(180,136,72,0.92)';ctx.fill();
  ctx.beginPath();ctx.ellipse(22,-7+headNod,3.8,7,-0.4,0,Math.PI*2);ctx.fillStyle='rgba(180,136,72,0.90)';ctx.fill();
  // Snout
  ctx.beginPath();ctx.ellipse(25,-2+headNod,5.5,3.8,0.08,0,Math.PI*2);ctx.fillStyle='rgba(222,183,118,0.93)';ctx.fill();
  // Nose
  ctx.beginPath();ctx.ellipse(29.5,-3+headNod,2.8,2,0,0,Math.PI*2);ctx.fillStyle='rgba(48,28,22,0.90)';ctx.fill();
  // Eye
  ctx.beginPath();ctx.arc(21,-9+headNod,2.2,0,Math.PI*2);ctx.fillStyle='rgba(32,18,10,0.94)';ctx.fill();
  ctx.beginPath();ctx.arc(21.7,-9.6+headNod,0.85,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.88)';ctx.fill();
  ctx.restore();
}

// ---- Flowers ----
function initFlowers(){
  flowers=[];
  const hues=[340,285,50,195,22,315,160]; // pink, purple, yellow, sky, orange, magenta, mint
  const count=11;
  for(let i=0;i<count;i++){
    flowers.push({
      x:W*(0.03+Math.random()*0.94),
      y:H*(0.77+Math.random()*0.17),
      size:8+Math.random()*5,
      hue:hues[Math.floor(Math.random()*hues.length)],
      bloomProgress:0,
      bloomed:false,
      swayOffset:Math.random()*Math.PI*2,
      petalCount:5+Math.floor(Math.random()*2),
    });
  }
}
function updateFlowers(){
  flowers.forEach(f=>{
    if(f.bloomProgress>0&&f.bloomProgress<1){
      f.bloomProgress=Math.min(1,f.bloomProgress+0.022);
      if(f.bloomProgress>=1)f.bloomed=true;
    }
  });
}
function drawFlowers(){
  if (season === 'autumn') return; // No wildflowers in autumn.
  flowers.forEach(f=>{
    const bp=f.bloomProgress,s=f.size;
    const sway=Math.sin(frameCount*0.022+f.swayOffset)*windStrength*0.06;
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(sway);
    // Stem
    const stemH=s*3.2;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-stemH);
    ctx.strokeStyle='rgba(75,128,58,0.82)';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();
    // Leaf
    ctx.save();ctx.translate(0,-stemH*0.52);ctx.rotate(0.75+sway*0.5);
    ctx.beginPath();ctx.ellipse(0,0,s*0.65,s*0.32,0,0,Math.PI*2);
    ctx.fillStyle='rgba(88,148,68,0.78)';ctx.fill();ctx.restore();
    if(bp<=0){
      // Bud — small green teardrop
      ctx.save();ctx.translate(0,-stemH);
      ctx.beginPath();ctx.ellipse(0,-s*0.42,s*0.35,s*0.55,0,0,Math.PI*2);
      ctx.fillStyle='rgba(95,155,72,0.90)';ctx.fill();
      // tiny hint of colour at tip
      ctx.beginPath();ctx.ellipse(0,-s*0.82,s*0.18,s*0.22,0,0,Math.PI*2);
      ctx.fillStyle=`hsla(${f.hue},65%,72%,0.70)`;ctx.fill();
      ctx.restore();
    } else {
      // Blooming petals
      ctx.save();ctx.translate(0,-stemH-s*0.1);
      for(let i=0;i<f.petalCount;i++){
        const angle=(i/f.petalCount)*Math.PI*2;
        ctx.save();ctx.rotate(angle);ctx.scale(bp,bp);
        ctx.beginPath();ctx.ellipse(0,-s*0.82,s*0.36,s*0.78,0,0,Math.PI*2);
        ctx.fillStyle=`hsla(${f.hue},68%,80%,0.88)`;ctx.fill();
        // petal vein
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-s*0.75);
        ctx.strokeStyle=`hsla(${f.hue},55%,65%,0.25)`;ctx.lineWidth=0.8;ctx.stroke();
        ctx.restore();
      }
      // Centre
      ctx.beginPath();ctx.arc(0,0,s*0.32*bp,0,Math.PI*2);
      ctx.fillStyle=`hsla(48,90%,70%,${0.95*bp})`;ctx.fill();
      ctx.beginPath();ctx.arc(0,0,s*0.14*bp,0,Math.PI*2);
      ctx.fillStyle='rgba(255,240,160,0.9)';ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });
}

// ---- Character Interactions ----
function triggerBirdTweet(){
  if(!bird.visible||bird.jumping||bird.state==='flying')return;
  bird.jumping=true;bird.jumpVy=-13;
  const dir=bird.facingLeft?-1:1;
  const chars=['♪','♫','♩'];
  for(let i=0;i<3;i++){
    bird.tweetNotes.push({
      x:bird.x+dir*(8+i*12),y:bird.y-18-i*4,
      vx:dir*(0.45+i*0.28),vy:-(1.1+i*0.18),
      life:1,decay:0.018+i*0.004,note:chars[i]
    });
  }
}
function triggerDogSpin(){
  if(dog.spinning)return;
  dog.spinning=true;dog.spinAngle=0;
  dog.spinCenterX=dog.x;dog.spinCenterY=dog.y;
}
function triggerOrcaBlowhole(){
  if(orca.phase==='hidden'||orca.rise<0.28)return;
  const subY=(1-orca.rise)*30;
  const finX=orca.x+(orca.vx<0?-4:4);
  const finY=orca.y+subY-28;
  for(let i=0;i<24;i++){
    const angle=-Math.PI/2+(Math.random()-0.5)*0.85;
    const speed=3.5+Math.random()*5;
    orca.blowParticles.push({
      x:finX+(Math.random()-0.5)*8,y:finY,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
      life:1,size:2.5+Math.random()*3.5
    });
  }
}
function triggerSailboatGust(){
  if(sailboat.waitTimer>0)return;
  sailboat.gustTimer=130;
}
function triggerFerryElectric(){
  if(ferry.x<-80||ferry.x>W+80)return;
  if(ferry.ferryType==='aquabus'){
    const cols=['#e8282a','#f47920','#fded00','#00a650','#0072ce','#7b1fa2','#ff69b4','#ffffff'];
    for(let i=0;i<32;i++){
      const angle=(Math.random()-0.5)*Math.PI*1.4-Math.PI/2;
      const speed=2+Math.random()*5;
      ferry.confettiParticles.push({
        x:ferry.x+(Math.random()-0.5)*60,y:ferry.y-20,
        vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
        rot:Math.random()*Math.PI*2,rotV:(Math.random()-0.5)*0.28,
        life:1,decay:0.008+Math.random()*0.008,
        w:4+Math.random()*4,h:2.5+Math.random()*2,
        color:cols[Math.floor(Math.random()*cols.length)]
      });
    }
  } else {
    ferry.sparkTimer=48;
  }
}

function checkCharacterClick(pos){
  const x=pos.x,y=pos.y;
  // Autumn hides the bird, dog and wildflowers, so they must not catch taps either.
  const autumn = season === 'autumn';
  // Bird
  if(!autumn&&bird.visible){
    const by=bird.y+(bird.jumpY||0);
    if((x-bird.x)**2+(y-by)**2<40*40){triggerBirdTweet();return true;}
  }
  // Dog
  if(!autumn&&(x-dog.x)**2+(y-dog.y)**2<58*58){triggerDogSpin();return true;}
  // Orca (only when surfaced)
  if(orca.phase!=='hidden'&&orca.rise>0.1){
    const oy=orca.y+(1-orca.rise)*30;
    if((x-orca.x)**2+(y-oy)**2<70*70){triggerOrcaBlowhole();return true;}
  }
  // Sailboat
  if(sailboat.waitTimer<=0&&sailboat.x>-80&&sailboat.x<W+80){
    if((x-sailboat.x)**2+(y-sailboat.y)**2<62*62){triggerSailboatGust();return true;}
  }
  if(sailboat2.waitTimer<=0&&sailboat2.x>-80&&sailboat2.x<W+80){
    if((x-sailboat2.x)**2+(y-sailboat2.y)**2<55*55){triggerSailboat2Gust();return true;}
  }

  // Ferry
  if(ferry.waitTimer<=0&&ferry.x>-100&&ferry.x<W+100){
    if((x-ferry.x)**2+(y-ferry.y)**2<85*85){triggerFerryElectric();return true;}
  }
  // Flowers — find the CLOSEST flower to click (handles dense clusters correctly)
  let bestF=null,bestHeadX=0,bestHeadY=0,bestDist=Infinity;
  for(let i=0;!autumn&&i<flowers.length;i++){
    const f=flowers[i];
    const sway=Math.sin(frameCount*0.022+f.swayOffset)*windStrength*0.06;
    const stemH=f.size*3.2;
    const headX=f.x+Math.sin(sway)*stemH;
    const headY=f.y-stemH;
    const d=Math.min((x-headX)**2+(y-headY)**2,(x-f.x)**2+(y-f.y)**2);
    if(d<bestDist){bestDist=d;bestF=f;bestHeadX=headX;bestHeadY=headY;}
  }
  if(bestF&&bestDist<48*48){
    if(bestF.bloomProgress<=0){
      bestF.bloomProgress=0.01;
      spawnSparkles(bestHeadX,bestHeadY);
    } else if(bestF.bloomed){
      for(let j=0;j<3;j++) spawnPetal(bestHeadX,bestHeadY,(Math.random()-0.5)*1.2,-0.5-Math.random()*0.8);
    }
    return true;
  }
  return false;
}

// ---- Wind ----
function updateWind(){
  windTimer++;gustCooldown--;
  if(gustCooldown<=0&&Math.random()<0.006){
    windTarget=(Math.random()-0.3)*4;gustCooldown=120+Math.floor(Math.random()*300);
    if(isFullyBloomed&&Math.abs(windTarget)>1.0) blossoms.forEach(b=>{if(Math.random()<0.15)spawnPetal(b.x,b.y,windTarget*0.5,-1);});
  }
  windStrength+=(windTarget-windStrength)*0.02;windTarget*=0.995;
}

// ---- Draw helpers ----
function drawBranch(b, c=ctx){
  c.beginPath();c.moveTo(b.x1,b.y1);c.lineTo(b.x2,b.y2);
  const d=Math.max(0.25,1-b.depth*0.12);
  c.strokeStyle=`rgb(${Math.floor(80*d)},${Math.floor(55*d)},${Math.floor(45*d)})`;
  c.lineWidth=b.thickness;c.lineCap='round';c.stroke();
  // Subtle pulse on unbloomed tips when >85% in bloom — helps find the last few
  if(b.canBloom&&!b.bloomed&&totalBranchZones>0&&totalBloomed/totalBranchZones>=0.85){
    const pulse=(Math.sin(Date.now()*0.004)+1)/2;
    c.beginPath();c.arc(b.x2,b.y2,10+pulse*8,0,Math.PI*2);
    c.fillStyle=`rgba(255,175,200,${0.12+pulse*0.22})`;c.fill();
  }
}
function drawLeaf(l, c=ctx){
  c.save();c.translate(l.x,l.y);c.rotate(l.angle);c.globalAlpha=l.opacity;
  c.beginPath();c.moveTo(0,0);c.bezierCurveTo(l.size*0.5,-l.size*0.6,l.size*1.2,-l.size*0.3,l.size*1.4,0);c.bezierCurveTo(l.size*1.2,l.size*0.3,l.size*0.5,l.size*0.6,0,0);
  let hue=l.hue, sat=55, light=l.lightness;
  if (season==='autumn' && l.tintStage) {
    const t=Math.min(l.tintStage/AUTUMN_TURN_STEPS, 1);
    const f=l.autumnFinal;
    hue=l.hue+(f[0]-l.hue)*t; sat=55+(f[1]-55)*t; light=l.lightness+(f[2]-l.lightness)*t;
  }
  c.fillStyle=`hsla(${hue},${sat}%,${light}%,0.8)`;c.fill();
  c.restore();c.globalAlpha=1;
}
// The owl (an overlay element in index.html, perched on its own drawn branch)
// isn't part of the tree canvas, so shift it sideways by the same lean the
// tree has at the owl's feet. Only runs when the tree's lean changes.
const owlEl = document.getElementById('owl');
function swayOwl(lean, baseY){
  if(!owlEl || !gameContainer.clientHeight) return;
  const toCanvas = H / gameContainer.clientHeight;          // CSS px → canvas px
  const feetY = (owlEl.offsetTop + owlEl.offsetHeight * 0.92) * toCanvas;
  const dxCss = (lean * (feetY - baseY)) / toCanvas;
  owlEl.style.transform = `translateX(${dxCss.toFixed(2)}px)`;
}
// Autumn: draw the cached tree layer, re-rendering it first if a leaf changed.
function drawAutumnTree(c){
  if(!_treeLayer||_treeLayer.width!==W||_treeLayer.height!==H){
    _treeLayer=document.createElement('canvas');_treeLayer.width=W;_treeLayer.height=H;_treeDirty=true;
  }
  const rebuilt=_treeDirty;
  if(_treeDirty){
    const lc=_treeLayer.getContext('2d');
    lc.clearRect(0,0,W,H);
    [...branches].sort((a,b)=>a.depth-b.depth).forEach(b=>drawBranch(b,lc));
    leaves.forEach(l=>drawLeaf(l,lc));
    _treeDirty=false;
  }
  // Skew around the trunk base: the canopy leans with the wind, the base stays put.
  const baseX=W*0.48, baseY=H*0.92;
  const lean=-windStrength*0.012*(0.8+0.2*Math.sin(frameCount*0.05));
  // On the separate tree canvas, a frame identical to the last one (no leaf
  // changes, same lean) is skipped entirely, which is most frames in calm air.
  if(c===treeCtx){
    if(!rebuilt && _treeCanvasHasTree && _treeCanvasLean!==null && Math.abs(lean-_treeCanvasLean)<0.0004) return;
    c.clearRect(0,0,W,H);
    _treeCanvasLean=lean;
    swayOwl(lean, baseY);
  }
  c.save();c.translate(baseX,baseY);c.transform(1,0,lean,1,0,0);c.translate(-baseX,-baseY);
  c.drawImage(_treeLayer,0,0);
  c.restore();
}
function drawBlossom(b){
  if(b.opacity<=0)return;
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rotation);ctx.globalAlpha=b.opacity;
  for(let i=0;i<b.petalCount;i++){const angle=(i/b.petalCount)*Math.PI*2;ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.ellipse(0,-b.size*0.6,b.size*0.38,b.size*0.6,0,0,Math.PI*2);ctx.fillStyle=`hsla(${b.hue},70%,${b.lightness}%,0.85)`;ctx.fill();ctx.restore();}
  ctx.beginPath();ctx.arc(0,0,b.size*0.2,0,Math.PI*2);ctx.fillStyle=`hsla(45,80%,75%,${b.opacity})`;ctx.fill();
  ctx.restore();ctx.globalAlpha=1;
}
function drawPetal(p){
  if(p.opacity<=0)return;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);
  ctx.globalAlpha=p.grounded?p.opacity:p.opacity*p.life;
  ctx.beginPath();ctx.moveTo(0,-p.size);ctx.bezierCurveTo(p.size*0.8,-p.size*0.5,p.size*0.6,p.size*0.5,0,p.size);ctx.bezierCurveTo(-p.size*0.6,p.size*0.5,-p.size*0.8,-p.size*0.5,0,-p.size);
  ctx.fillStyle=`hsla(${p.hue},65%,${p.lightness}%,0.8)`;ctx.fill();
  ctx.restore();ctx.globalAlpha=1;
}
function _drawMountains(c){
  c.beginPath();c.moveTo(0,H*0.38);c.lineTo(W*0.06,H*0.28);c.lineTo(W*0.14,H*0.18);c.lineTo(W*0.22,H*0.23);c.lineTo(W*0.30,H*0.13);c.lineTo(W*0.38,H*0.18);c.lineTo(W*0.46,H*0.10);c.lineTo(W*0.54,H*0.16);c.lineTo(W*0.62,H*0.11);c.lineTo(W*0.70,H*0.17);c.lineTo(W*0.78,H*0.14);c.lineTo(W*0.86,H*0.20);c.lineTo(W*0.94,H*0.16);c.lineTo(W,H*0.25);c.lineTo(W,H*0.40);c.lineTo(0,H*0.40);c.closePath();
  const g=c.createLinearGradient(0,H*0.08,0,H*0.40);g.addColorStop(0,'rgba(100,120,155,0.35)');g.addColorStop(1,'rgba(130,150,175,0.15)');c.fillStyle=g;c.fill();
  const peaks=[[0.28,0.13],[0.46,0.10],[0.62,0.11],[0.78,0.14]];
  c.fillStyle='rgba(255,255,255,0.4)';
  peaks.forEach(([px,py])=>{c.beginPath();c.moveTo(W*px,H*py);c.lineTo(W*(px+0.025),H*py);c.lineTo(W*(px+0.035),H*(py+0.03));c.lineTo(W*(px-0.01),H*(py+0.02));c.closePath();c.fill();});
}
function drawMountains(){_drawMountains(ctx);}
function drawWater(){
  const wt=H*0.38,wb=H*0.58;
  const g=ctx.createLinearGradient(0,wt,0,wb);
  g.addColorStop(0,'rgba(120,170,195,0.35)');g.addColorStop(0.3,'rgba(100,160,190,0.40)');g.addColorStop(0.7,'rgba(90,150,180,0.35)');g.addColorStop(1,'rgba(110,165,170,0.20)');
  ctx.fillStyle=g;ctx.fillRect(0,wt,W,wb-wt);
  ctx.save();ctx.globalAlpha=0.08;
  for(let i=0;i<8;i++){const y=wt+(wb-wt)*(0.15+i*0.1);const xS=W*(0.05+Math.sin(i*1.7+frameCount*0.008)*0.05);const lw=W*(0.15+Math.sin(i*2.3+frameCount*0.006)*0.08);ctx.beginPath();ctx.moveTo(xS,y);ctx.lineTo(xS+lw,y);ctx.strokeStyle='rgba(200,220,240,0.8)';ctx.lineWidth=1;ctx.stroke();}
  ctx.restore();
  ctx.beginPath();ctx.moveTo(0,wb);
  for(let x=0;x<=W;x+=20){ctx.lineTo(x,wb+Math.sin(x*0.015+frameCount*0.02)*2);}
  ctx.lineTo(W,wb+5);ctx.lineTo(0,wb+5);ctx.closePath();
  ctx.fillStyle='rgba(110,165,140,0.15)';ctx.fill();
}
function _drawSeawall(c){
  const shoreTop=H*0.578,pathTop=H*0.628,pathBot=H*0.700,dip=H*0.022;
  function curve(xFrac){return 4*dip*xFrac*(1-xFrac);}
  const sg=c.createLinearGradient(0,shoreTop,0,pathTop+dip);
  sg.addColorStop(0,'rgba(145,138,125,0.0)');sg.addColorStop(0.4,'rgba(140,132,118,0.52)');sg.addColorStop(1,'rgba(132,125,112,0.68)');
  c.fillStyle=sg;
  c.beginPath();c.moveTo(0,shoreTop);c.quadraticCurveTo(W*0.5,shoreTop+dip,W,shoreTop);c.lineTo(W,pathTop);c.quadraticCurveTo(W*0.5,pathTop+dip,0,pathTop);c.closePath();c.fill();
  const rocks=[[0.05,0.592,0.022,0.009],[0.13,0.584,0.016,0.007],[0.21,0.597,0.028,0.011],[0.30,0.587,0.014,0.006],[0.38,0.594,0.020,0.009],[0.47,0.585,0.018,0.008],[0.55,0.598,0.026,0.010],[0.63,0.590,0.015,0.007],[0.71,0.595,0.022,0.009],[0.79,0.587,0.017,0.007],[0.87,0.593,0.021,0.009],[0.94,0.586,0.013,0.006],[0.09,0.603,0.010,0.005],[0.27,0.604,0.012,0.005],[0.44,0.606,0.009,0.004],[0.59,0.602,0.011,0.005],[0.75,0.605,0.010,0.005],[0.92,0.603,0.011,0.005]];
  rocks.forEach(([rx,ry,rw,rh])=>{
    const cy=curve(rx)/H;c.beginPath();c.ellipse(W*rx,H*(ry+cy),W*rw,H*rh,Math.sin(rx*18)*0.35,0,Math.PI*2);
    const shade=108+(rx*22)|0;c.fillStyle=`rgba(${shade},${shade-6},${shade-14},0.76)`;c.fill();
    c.strokeStyle='rgba(88,82,74,0.28)';c.lineWidth=0.6;c.stroke();
  });
  const pg=c.createLinearGradient(0,pathTop,0,pathBot+dip);
  pg.addColorStop(0,'rgba(184,177,166,0.84)');pg.addColorStop(0.5,'rgba(176,169,158,0.80)');pg.addColorStop(1,'rgba(164,158,147,0.72)');
  c.fillStyle=pg;
  c.beginPath();c.moveTo(0,pathTop);c.quadraticCurveTo(W*0.5,pathTop+dip,W,pathTop);c.lineTo(W,pathBot);c.quadraticCurveTo(W*0.5,pathBot+dip,0,pathBot);c.closePath();c.fill();
  c.beginPath();c.moveTo(0,pathTop);c.quadraticCurveTo(W*0.5,pathTop+dip,W,pathTop);c.lineTo(W,pathTop+H*0.005);c.quadraticCurveTo(W*0.5,pathTop+dip+H*0.005,0,pathTop+H*0.005);c.closePath();
  c.fillStyle='rgba(148,140,128,0.90)';c.fill();
  c.save();c.globalAlpha=0.10;c.strokeStyle='rgba(128,120,110,1)';c.lineWidth=1;
  for(let i=1;i<9;i++){const xFrac=i/9,x=W*xFrac,cv=curve(xFrac);c.beginPath();c.moveTo(x,pathTop+cv+H*0.004);c.lineTo(x,pathBot+cv-H*0.004);c.stroke();}
  c.restore();
}
function drawSeawall(){_drawSeawall(ctx);}
function _drawGround(c){
  const gt=H*0.75;
  const g=c.createLinearGradient(0,gt,0,H);
  g.addColorStop(0,'rgba(110,175,90,0.0)');g.addColorStop(0.15,'rgba(105,168,82,0.25)');g.addColorStop(0.4,'rgba(95,155,72,0.45)');g.addColorStop(1,'rgba(75,135,55,0.6)');
  c.fillStyle=g;c.fillRect(0,gt,W,H-gt);
}
function drawGround(){_drawGround(ctx);}

// ---- Update ----
function update(){
  frameCount++;updateWind();
  blossoms.forEach(b=>{
    if(b.opacity<b.targetOpacity){b.opacity=Math.min(b.opacity+0.02,b.targetOpacity);if(b.opacity>=b.targetOpacity*0.9)b.canShake=true;}
    const sway=Math.sin(frameCount*0.018+b.swayOffset)*windStrength*1.2;
    b.x=b.baseX+sway;b.y=b.baseY+Math.sin(frameCount*0.025+b.swayOffset)*Math.abs(windStrength)*0.4;
    b.rotation=b.baseRotation+Math.sin(frameCount*0.022+b.swayOffset)*windStrength*0.06;
  });
  if(season!=='autumn') leaves.forEach(l=>{if(l.baseAngle===undefined)l.baseAngle=l.angle;l.angle=l.baseAngle+Math.sin(frameCount*0.02+l.x*0.01)*windStrength*0.08;});
  for(let i=wishes.length-1;i>=0;i--){
    const w=wishes[i];
    if(w.dying){w.deathTimer-=0.04;w.opacity=Math.max(0,w.deathTimer);if(w.opacity<=0){wishes.splice(i,1);if(selectedWishIdx===i)selectedWishIdx=-1;else if(selectedWishIdx>i)selectedWishIdx--;updateWishCount();}continue;}
    if(w.opacity<1)w.opacity=Math.min(1,w.opacity+0.025);
    const wobble=selectedWishIdx===i?0.28:0.14;
    const targetAngle=Math.sin(frameCount*0.014+w.swayOffset)*windStrength*wobble+w.baseAngle;
    w.angle+=(targetAngle-w.angle)*0.04;
  }
  for(let i=petals.length-1;i>=0;i--){
    const p=petals[i];
    if(!p.grounded){
      p.flutter+=p.flutterSpeed;
      const fx=Math.sin(p.flutter)*0.7,fy=Math.cos(p.flutter*0.6)*0.5;
      p.vx+=windStrength*0.014+fx*0.020;p.vy+=0.024+fy*0.032;p.vx*=0.977;p.vy*=0.989;
      p.x+=p.vx;p.y+=p.vy;p.rotation+=p.rotSpeed*0.5+windStrength*0.008+Math.sin(p.flutter*0.4)*0.015;
      if(p.y>=p.groundY){p.y=p.groundY;p.grounded=true;p.vx=0;p.vy=0;}
      if(p.x<-20)p.x=W+20;if(p.x>W+20)p.x=-20;
    }
    if(p.y>H+50)petals.splice(i,1);
  }
  updateClouds();updateSparkles();updateBird();updateGeese();updateFerry();updateSailboat();updateSailboat2();updateOrca();updateOrcaParticles();updateDog();updateFlowers();
}

// ---- Draw helpers: depth-sort water items ----
function drawWaterItems(){
  [{y:ferry.y,fn:drawFerry},{y:sailboat.y,fn:drawSailboat},{y:sailboat2.y,fn:drawSailboat2},{y:orca.y,fn:drawOrca}]
    .sort((a,b)=>a.y-b.y).forEach(o=>o.fn());
}

// ---- Draw ----
function draw(ts){
  if(ts-_lastFrame<33){_animId=requestAnimationFrame(draw);return;}
  _lastFrame=ts;
  if(_isRecording){
    paintShareBackground(ctx,W,H);
  } else {
    ctx.clearRect(0,0,W,H);
  }
  if(_bgBack)ctx.drawImage(_bgBack,0,0);else drawMountains();
  drawClouds();drawGeese();drawWater();drawWaterItems();
  if(_bgFront)ctx.drawImage(_bgFront,0,0);else{drawSeawall();drawGround();}
  if(season!=='autumn')drawDog();
  drawFlowers();
  if(season==='autumn'){
    if(_isRecording){
      // The recording only captures the main canvas, so stack everything here:
      // ducks, then the tree, then (at the end of the frame) the rest.
      paintShareOverlay(ctx,true);
      drawAutumnTree(ctx);
    } else {
      drawAutumnTree(treeCtx);
      _treeCanvasHasTree=true;
    }
  }
  else { const sorted=[...branches].sort((a,b)=>a.depth-b.depth);sorted.forEach(b=>drawBranch(b));leaves.forEach(l=>drawLeaf(l)); }
  petals.filter(p=>p.grounded).forEach(drawPetal);
  blossoms.forEach(drawBlossom);
  if(season!=='autumn')drawBird();
  wishes.forEach((w,i)=>drawWish(w,i));
  drawSparkles();
  petals.filter(p=>!p.grounded).forEach(drawPetal);
  if(season!=='autumn'&&_treeCanvasHasTree){treeCtx.clearRect(0,0,W,H);_treeCanvasHasTree=false;_treeCanvasLean=null;}
  if(_isRecording)paintShareOverlay(ctx,false);
  if(Math.abs(windStrength)>0.8){
    ctx.save();ctx.globalAlpha=Math.min(Math.abs(windStrength)*0.08,0.15);
    for(let i=0;i<3;i++){const y=H*(0.2+i*0.25)+Math.sin(frameCount*0.02+i)*20;const sx=windStrength>0?W*0.1+i*40:W*0.9-i*40;ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+windStrength*15,y);ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;ctx.stroke();}
    ctx.restore();
  }
  update();update();
  if(!document.hidden && (_gameVisible || _isRecording)) _animId = requestAnimationFrame(draw);
  else _animId = null;
}

// ---- Input ----
function getCanvasPos(e){
  const rect=canvas.getBoundingClientRect(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
  let cx,cy;
  if(e.touches){cx=e.touches[0].clientX;cy=e.touches[0].clientY;}else{cx=e.clientX;cy=e.clientY;}
  return{x:(cx-rect.left)*scaleX,y:(cy-rect.top)*scaleY};
}
// Autumn mechanic — two phases that parallel spring's bloom → petals:
//   phase 1  "turning":  tap blends a leaf from green toward its own final
//                        colour (see AUTUMN_FINALS). Leaves STAY ON THE TREE.
//   phase 2  "falling":  once ≥95% are fully turned, every remaining leaf
//                        snaps to its final colour and the hint flips. Taps
//                        now knock leaves off — they fall as petal-shaped
//                        flakes using the same physics as the spring petals.
function spawnFallenLeaf(l) {
  const p = l.autumnFinal || AUTUMN_FINALS[0];
  petals.push({
    x:l.x, y:l.y,
    vx:(Math.random()-0.5)*0.5,
    vy:0.2+Math.random()*0.3,
    size:l.size*1.1,
    hue:p[0], lightness:p[2],
    rotation:l.angle,
    rotSpeed:(Math.random()-0.5)*0.04,
    opacity:0.9+Math.random()*0.1,
    life:1,
    flutter:Math.random()*Math.PI*2,
    flutterSpeed:0.008+Math.random()*0.012,
    grounded:false,
    groundY:H*(0.86+Math.random()*0.12),
  });
}
function completeAutumnTurn() {
  // Snap any still-green/half-turned leaves to their final colour so the whole
  // tree reads as one full autumn canopy before anything falls.
  leaves.forEach(l => {
    if (l.tintStage < AUTUMN_TURN_STEPS) {
      l.tintStage = AUTUMN_TURN_STEPS;
      totalColorShifted++;
    }
  });
  isFullyAutumn = true;
  _treeDirty = true;
}
// knockChance: odds that a leaf in range comes loose (phase 2 only). Kept low
// so the tree empties gradually instead of in a couple of taps.
function pokeAutumnLeaves(pos, radius, knockChance) {
  let touched = false;
  if (!isFullyAutumn) {
    // Phase 1 — colour shift, leaves stay on the tree.
    for (const l of leaves) {
      if (l.tintStage >= AUTUMN_TURN_STEPS) continue;
      const dist = Math.sqrt((pos.x-l.x)**2 + (pos.y-l.y)**2);
      if (dist < radius) {
        l.tintStage++;
        if (l.tintStage === AUTUMN_TURN_STEPS) totalColorShifted++;
        touched = true;
      }
    }
    if (!isFullyAutumn && totalLeavesInit > 0 &&
        totalColorShifted / totalLeavesInit >= 0.95) {
      completeAutumnTurn();
    }
    if (touched) { _treeDirty = true; updateUI(); }
  } else {
    // Phase 2 — knock the leaves loose.
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      const dist = Math.sqrt((pos.x-l.x)**2 + (pos.y-l.y)**2);
      if (dist < radius && Math.random() < knockChance) {
        spawnFallenLeaf(l);
        leaves.splice(i, 1);
        touched = true;
      }
    }
    if (touched) { _treeDirty = true; updateUI(); }
  }
}

function handleTap(e){
  const pos=getCanvasPos(e);
  if (season === 'autumn') { pokeAutumnLeaves(pos, AUTUMN_TAP_RADIUS, KNOCK_CHANCE_TAP); return; }
  if(isFullyBloomed&&selectedWishIdx!==-1){selectedWishIdx=-1;document.getElementById('gameHint').textContent='swirl the petals... or make a wish 🎋';}
  let bloomedSomething=false;
  const alreadyBloomed=new Set();
  leaves.forEach(l=>{
    if(l.branchIdx===undefined)return;
    const branch=branches[l.branchIdx];
    if(!branch||!branch.canBloom||branch.bloomed)return;
    if(alreadyBloomed.has(l.branchIdx))return;
    const dist=Math.sqrt((pos.x-l.x)**2+(pos.y-l.y)**2);
    if(dist<45){branch.bloomed=true;branch.bloomProgress=1;totalBloomed++;spawnBlossoms(branch);alreadyBloomed.add(l.branchIdx);bloomedSomething=true;}
  });
  if(bloomedSomething){updateUI();if(totalBloomed/totalBranchZones>=0.95&&!isFullyBloomed){branches.forEach(b=>{if(b.canBloom&&!b.bloomed){b.bloomed=true;b.bloomProgress=1;totalBloomed++;spawnBlossoms(b);}});isFullyBloomed=true;updateUI();setTimeout(()=>{blossoms.forEach(b=>{if(Math.random()<0.3)spawnPetal(b.x,b.y,(Math.random()-0.5)*2,-2);});},500);}return;}
  if(isFullyBloomed){
    blossoms.forEach(b=>{if(!b.canShake)return;const dist=Math.sqrt((pos.x-b.x)**2+(pos.y-b.y)**2);if(dist<50&&Math.random()<0.25)spawnPetal(b.x,b.y,(Math.random()-0.5)*1.0,(Math.random()-0.5)*0.3);});
    petals.forEach(p=>{const dist=Math.sqrt((pos.x-p.x)**2+(pos.y-p.y)**2);if(dist<60){const angle=Math.atan2(p.y-pos.y,p.x-pos.x);const force=(60-dist)/60*3;p.vx+=Math.cos(angle)*force;p.vy+=Math.sin(angle)*force-1;if(p.grounded){p.grounded=false;p.vy=-3;}}});
  }
}
function handleMove(e){
  if(!isMouseDown)return;
  const pos=getCanvasPos(e);
  mouseVX=pos.x-lastMouseX;mouseVY=pos.y-lastMouseY;lastMouseX=pos.x;lastMouseY=pos.y;
  if (season === 'autumn') {
    pokeAutumnLeaves(pos, AUTUMN_DRAG_RADIUS, KNOCK_CHANCE_DRAG);
    petals.forEach(p=>{const dist=Math.sqrt((pos.x-p.x)**2+(pos.y-p.y)**2);if(dist<70){const force=(70-dist)/70;p.vx+=mouseVX*force*0.3;p.vy+=mouseVY*force*0.3-force*0.5;if(p.grounded){p.grounded=false;p.vy=-2-Math.random()*2;}}});
    return;
  }
  if(draggingWishIdx!==-1){
    const dx=pos.x-dragDownX,dy=pos.y-dragDownY;
    if(!dragMoved&&Math.sqrt(dx*dx+dy*dy)>12)dragMoved=true;
    if(dragMoved){const w=wishes[draggingWishIdx];w.attachX=pos.x;w.attachY=pos.y;w.angle+=(0-w.angle)*0.18;}
    return;
  }
  if(!isFullyBloomed){
    const alreadyBloomed=new Set();
    leaves.forEach(l=>{
      if(l.branchIdx===undefined)return;const branch=branches[l.branchIdx];
      if(!branch||!branch.canBloom||branch.bloomed)return;if(alreadyBloomed.has(l.branchIdx))return;
      const dist=Math.sqrt((pos.x-l.x)**2+(pos.y-l.y)**2);
      if(dist<45){branch.bloomed=true;branch.bloomProgress=1;totalBloomed++;spawnBlossoms(branch);alreadyBloomed.add(l.branchIdx);}
    });
    if(alreadyBloomed.size>0){updateUI();if(totalBloomed/totalBranchZones>=0.95&&!isFullyBloomed){branches.forEach(b=>{if(b.canBloom&&!b.bloomed){b.bloomed=true;b.bloomProgress=1;totalBloomed++;spawnBlossoms(b);}});isFullyBloomed=true;updateUI();setTimeout(()=>{blossoms.forEach(b=>{if(Math.random()<0.3)spawnPetal(b.x,b.y,(Math.random()-0.5)*2,-2);});},500);}}
    return;
  }
  petals.forEach(p=>{const dist=Math.sqrt((pos.x-p.x)**2+(pos.y-p.y)**2);if(dist<70){const force=(70-dist)/70;p.vx+=mouseVX*force*0.3;p.vy+=mouseVY*force*0.3-force*0.5;if(p.grounded){p.grounded=false;p.vy=-2-Math.random()*2;}}});
  blossoms.forEach(b=>{if(!b.canShake)return;const dist=Math.sqrt((pos.x-b.x)**2+(pos.y-b.y)**2);if(dist<40&&Math.random()<0.05)spawnPetal(b.x,b.y,mouseVX*0.08,0.2+Math.random()*0.3);});
}
function handleDown(e){
  const pos=getCanvasPos(e);
  lastMouseX=pos.x;lastMouseY=pos.y;dragDownX=pos.x;dragDownY=pos.y;dragMoved=false;isMouseDown=true;
  if(isFullyBloomed){
    for(let i=wishes.length-1;i>=0;i--){
      const w=wishes[i];if(w.dying||w.opacity<0.3)continue;
      const tipX=w.attachX+Math.sin(w.angle)*w.stringLen,tipY=w.attachY+Math.cos(w.angle)*w.stringLen;
      const tagCX=tipX+Math.sin(w.angle)*(w.tagH/2),tagCY=tipY+Math.cos(w.angle)*(w.tagH/2);
      if(Math.sqrt((pos.x-tagCX)**2+(pos.y-tagCY)**2)<Math.max(w.tagW,w.tagH)/2+12){draggingWishIdx=i;return;}
    }
  }
  if(checkCharacterClick(pos))return;
  handleTap(e);
}
function handleUp(){
  if(draggingWishIdx!==-1){
    const w=wishes[draggingWishIdx];
    if(!dragMoved){
      if(selectedWishIdx===draggingWishIdx){
        w.dying=true;selectedWishIdx=-1;
        document.getElementById('gameHint').textContent='swirl the petals... or make a wish 🎋';
        const active=wishes.filter(x=>!x.dying).length;
        if(active<MAX_WISHES){const btn=document.getElementById('wishBtn');btn.textContent='🎋 make a wish';btn.style.pointerEvents='all';btn.style.opacity='1';}
      }else{selectedWishIdx=draggingWishIdx;document.getElementById('gameHint').textContent='tap again to remove · drag to move 🎋';}
    }else{
      const snap=findNearestBranchPoint(w.attachX,w.attachY);
      w.attachX=snap.x;w.attachY=snap.y;w.baseAngle=(Math.random()-0.5)*0.18;w.swayOffset=Math.random()*Math.PI*2;
      selectedWishIdx=-1;document.getElementById('gameHint').textContent='swirl the petals... or make a wish 🎋';
    }
    draggingWishIdx=-1;dragMoved=false;isMouseDown=false;mouseVX=0;mouseVY=0;return;
  }
  isMouseDown=false;mouseVX=0;mouseVY=0;
}
// Touch on phones, where the game fills most of the screen:
//  - A touch that STARTS ON THE TREE is always the game: any-direction drags
//    paint leaves / bloom branches and the page never scrolls.
//  - A touch that starts anywhere else (sky, water, seawall, grass) lets the
//    page scroll: the game box is touch-action: pan-y in index.html. It stays
//    undecided until it moves TOUCH_SLOP px: mostly vertical → page scroll;
//    sideways → game drag; lifted without moving → tap (dog, ferry, flowers…).
const TOUCH_SLOP = 10;        // CSS px
const TREE_TOUCH_REACH = 48;  // canvas px around any branch that counts as "on the tree"
function segmentDist(px, py, b) {
  const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
  const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (b.x1 + t * dx), py - (b.y1 + t * dy));
}
function isOnTree(pos) {
  return branches.some((b) => segmentDist(pos.x, pos.y, b) < TREE_TOUCH_REACH);
}
let touchStart = null, touchMode = null, lastTouchAt = 0; // touchMode: null | 'drag' | 'scroll' | 'ignore'
// Phones also send emulated mouse events after a touch; skip those.
const mouseOnly = (fn) => (e) => { if (Date.now() - lastTouchAt > 800) fn(e); };
canvas.addEventListener('mousedown',mouseOnly(handleDown));
canvas.addEventListener('mousemove',mouseOnly(handleMove));
canvas.addEventListener('mouseup',mouseOnly(handleUp));
canvas.addEventListener('mouseleave',mouseOnly(handleUp));
canvas.addEventListener('touchstart',(e)=>{
  lastTouchAt = Date.now();
  if (e.touches.length !== 1) { touchMode = 'ignore'; return; } // pinch zoom etc.
  const t = e.touches[0];
  touchStart = { clientX: t.clientX, clientY: t.clientY };
  touchMode = null;
  if (isOnTree(getCanvasPos(touchStart))) {
    e.preventDefault(); // claim this touch: no page scroll
    touchMode = 'drag';
    handleDown(touchStart);
  }
},{passive:false});
canvas.addEventListener('touchmove',(e)=>{
  lastTouchAt = Date.now();
  if (!touchStart || touchMode === 'scroll' || touchMode === 'ignore') return;
  if (!touchMode) {
    const t = e.touches[0];
    const dx = t.clientX - touchStart.clientX, dy = t.clientY - touchStart.clientY;
    if (Math.abs(dy) > TOUCH_SLOP && Math.abs(dy) >= Math.abs(dx)) { touchMode = 'scroll'; return; }
    if (Math.abs(dx) <= TOUCH_SLOP) return;
    touchMode = 'drag';
    handleDown(touchStart);
  }
  if (e.cancelable) e.preventDefault();
  handleMove(e);
},{passive:false});
canvas.addEventListener('touchend',(e)=>{
  lastTouchAt = Date.now();
  if (touchMode === null && touchStart) { handleDown(touchStart); handleUp(); } // a tap
  else if (touchMode === 'drag') handleUp();
  touchStart = null; touchMode = null;
  if (e.cancelable) e.preventDefault(); // no emulated click afterwards
},{passive:false});
canvas.addEventListener('touchcancel',()=>{
  if (touchMode === 'drag') handleUp();
  touchStart = null; touchMode = null;
});

// ---- UI ----
function updateWishCount(){
  const countEl=document.getElementById('wishCount');
  const n=wishes.filter(w=>!w.dying).length;
  if(n===0)countEl.textContent='';
  else if(n<MAX_WISHES)countEl.textContent=`🎋 ${n} wish${n>1?'es':''} on the tree`;
  else countEl.textContent=`🎋 ${MAX_WISHES} wishes on the tree — may they all come true ✨`;
}
function updateUI(){
  const counter=document.getElementById('bloomCounter');
  const hint=document.getElementById('gameHint');
  const wishBtn=document.getElementById('wishBtn');
  if (season === 'autumn') {
    if (!isFullyAutumn) {
      const pct = totalLeavesInit > 0
        ? Math.round((totalColorShifted / totalLeavesInit) * 100)
        : 0;
      counter.textContent = pct > 0 ? `${pct}% turning` : '';
      hint.textContent = 'tap the leaves — watch them turn';
    } else {
      counter.textContent = leaves.length > 0 ? 'the tree is full of autumn' : 'bare branches 🍂';
      hint.textContent = leaves.length > 0
        ? 'tap the branches — knock the leaves loose'
        : 'swirl the fallen leaves';
    }
    return;
  }
  if(totalBloomed===0){counter.textContent='';hint.textContent='touch the branches to make them bloom';}
  else if(totalBloomed<totalBranchZones){const pct=Math.round((totalBloomed/totalBranchZones)*100);counter.textContent=`${pct}% in bloom`;hint.textContent='keep going to bloom more branches';}
  else{counter.textContent='full bloom 🌸';hint.textContent='swirl the petals... or make a wish 🎋';wishBtn.classList.add('visible');updateWishCount();}
}

// ---- Wish modal ----
const wishModal=document.getElementById('wishModal');
const wishInput=document.getElementById('wishInput');
const wishChars=document.getElementById('wishChars');
const wishBtn=document.getElementById('wishBtn');
wishBtn.addEventListener('click',()=>{if(wishes.length>=MAX_WISHES)return;wishModal.style.display='flex';wishInput.value='';wishChars.textContent='50 characters remaining';setTimeout(()=>wishInput.focus(),150);});
wishInput.addEventListener('input',()=>{const rem=50-wishInput.value.length;wishChars.textContent=`${rem} character${rem!==1?'s':''} remaining`;});
document.getElementById('wishSubmit').addEventListener('click',()=>{
  const text=wishInput.value.trim();if(!text){wishInput.focus();return;}
  wishModal.style.display='none';addWishToTree(text);updateWishCount();
  if(wishes.length>=MAX_WISHES){wishBtn.textContent='🎋 wishes made ✨';wishBtn.style.pointerEvents='none';wishBtn.style.opacity='0.68';}
});
document.getElementById('wishCancel').addEventListener('click',()=>{wishModal.style.display='none';});
wishModal.addEventListener('click',(e)=>{if(e.target===wishModal)wishModal.style.display='none';});
wishInput.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('wishSubmit').click();}});
document.getElementById('resetBtn').addEventListener('click',resetTree);


// ---- Share / Camera button ----
// ---- Share as 7-second video ----
let _isRecording = false;
// Autumn overlay layers (moon, owl, pumpkins…) painted into shared frames;
// filled from autumn.js __autumnShareLayers() when a share starts.
let _shareOverlay = null;

// The live sky is the CSS background behind a transparent canvas, so shared
// frames must paint it in. Autumn stops mirror .game-container in autumn.css.
function paintShareBackground(c,w,h){
  const bg=c.createLinearGradient(0,0,0,h);
  if(season==='autumn'){
    [[0,'#0b1733'],[0.10,'#1d2a4f'],[0.22,'#3a2a56'],[0.34,'#6b3f5c'],[0.50,'#a85a44'],
     [0.62,'#c47a4a'],[0.76,'#8a5230'],[0.92,'#5a3a24'],[1,'#3d2615']].forEach(([o,col])=>bg.addColorStop(o,col));
  } else {
    bg.addColorStop(0.00,'#c8ddf5');bg.addColorStop(0.20,'#d8e8f8');bg.addColorStop(0.35,'#b8d4ef');
    bg.addColorStop(0.50,'#8ab8c8');bg.addColorStop(0.60,'#6da8b8');bg.addColorStop(0.72,'#88b888');
    bg.addColorStop(0.82,'#6aad6a');bg.addColorStop(1.00,'#5a9050');
  }
  c.fillStyle=bg;c.fillRect(0,0,w,h);
}
// behindTree: true paints the layers that sit under the tree (the ducks),
// false paints everything above it.
function paintShareOverlay(c, behindTree){
  if(!_shareOverlay)return;
  _shareOverlay.filter(l=>!!l.behindTree===behindTree).forEach(l=>{
    if(l.dot){c.beginPath();c.arc(l.x,l.y,l.r,0,Math.PI*2);c.fillStyle=l.color;c.fill();return;}
    if(l.flip){c.save();c.translate(l.x+l.w,l.y);c.scale(-1,1);c.drawImage(l.img,0,0,l.w,l.h);c.restore();}
    else c.drawImage(l.img,l.x,l.y,l.w,l.h);
  });
}
document.getElementById('shareBtn').addEventListener('click', async () => {
  const btn = document.getElementById('shareBtn');
  if (_isRecording) return;

  const label = btn.querySelector('span:last-child');
  const DURATION = 7000;
  const autumn = season === 'autumn';
  const fileBase = autumn ? 'autumn-tree' : 'cherry-blossom-tree';
  const shareTitle = autumn ? 'My Autumn Tree 🍁' : 'My Cherry Blossom Tree 🌸';
  const shareText = autumn ? 'turned the leaves on an autumn tree 🍂' : 'made a wish on a cherry blossom tree ✨';
  _shareOverlay = null;
  if (autumn && typeof window.__autumnShareLayers === 'function') {
    try { _shareOverlay = await window.__autumnShareLayers(canvas); }
    catch (err) { _shareOverlay = null; } // share without the overlay rather than fail
    if (_isRecording) return; // a second tap arrived while layers were loading
  }

  // Fall back to photo share if captureStream/MediaRecorder unavailable
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width; offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    paintShareBackground(offCtx, offscreen.width, offscreen.height);
    offCtx.drawImage(canvas,0,0);
    paintShareOverlay(offCtx, true);
    if (season === 'autumn') offCtx.drawImage(treeCanvas,0,0);
    paintShareOverlay(offCtx, false);
    _shareOverlay = null;
    let dataUrl;
    try { dataUrl = offscreen.toDataURL('image/png'); }
    catch (err) {
      // Some browsers refuse to export a canvas with SVG images drawn on it;
      // fall back to the scene without the overlay.
      paintShareBackground(offCtx, offscreen.width, offscreen.height);
      offCtx.drawImage(canvas,0,0);
      if (season === 'autumn') offCtx.drawImage(treeCanvas,0,0);
      dataUrl = offscreen.toDataURL('image/png');
    }
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob],`${fileBase}.png`,{type:'image/png'});
        if (navigator.canShare && navigator.canShare({files:[file]})) {
          await navigator.share({files:[file],title:shareTitle,text:shareText});
          return;
        }
      } catch(err) { if(err.name==='AbortError') return; }
    }
    const link = document.createElement('a'); link.download=`${fileBase}.png`; link.href=dataUrl; link.click();
    btn.classList.add('confirmed'); label.textContent='saved!';
    setTimeout(()=>{ btn.classList.remove('confirmed'); label.textContent='share'; }, 2000);
    return;
  }

  // Pick best MIME type (mp4 for Safari/iOS, webm for Chrome)
  const mimeType = ['video/mp4','video/webm;codecs=vp8,opus','video/webm']
    .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch(e){ return false; } }) || 'video/webm';
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

  // Countdown UI
  _isRecording = true;
  btn.disabled = true;
  let remaining = Math.ceil(DURATION / 1000);
  label.textContent = `${remaining}s`;
  const countdown = setInterval(() => {
    remaining--;
    label.textContent = remaining > 0 ? `${remaining}s` : '...';
  }, 1000);

  // Record live canvas (draw() bakes gradient into pixels while _isRecording=true)
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start();

  await new Promise(resolve => setTimeout(resolve, DURATION));
  recorder.stop();
  clearInterval(countdown);
  _isRecording = false;
  _shareOverlay = null;
  await new Promise(resolve => { recorder.onstop = resolve; });

  label.textContent = 'sharing...';

  const blob = new Blob(chunks, { type: mimeType });

  if (navigator.share) {
    try {
      const file = new File([blob], `${fileBase}.${ext}`, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: shareTitle,
          text: shareText,
        });
        label.textContent = 'share';
        btn.disabled = false;
        return;
      }
    } catch(err) {
      if (err.name === 'AbortError') {
        label.textContent = 'share';
        btn.disabled = false;
        return;
      }
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${fileBase}.${ext}`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);

  btn.classList.add('confirmed');
  label.textContent = 'saved!';
  setTimeout(() => {
    btn.classList.remove('confirmed');
    label.textContent = 'share';
    btn.disabled = false;
  }, 2000);
});

// ---- Seeded RNG — same seed → same tree shape every resize ----
let _treeSeed = null;
function _generateTreeSeeded() {
  let s = _treeSeed;
  const origRandom = Math.random;
  Math.random = function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  generateTree();
  Math.random = origRandom;
}

// ---- Resize ----
let _resizeTimer;
function rebuildBgCache(){
  const back=document.createElement('canvas');back.width=W;back.height=H;
  const bCtx=back.getContext('2d');
  _drawMountains(bCtx);_bgBack=back;
  const front=document.createElement('canvas');front.width=W;front.height=H;
  const fCtx=front.getContext('2d');
  _drawSeawall(fCtx);_drawGround(fCtx);_bgFront=front;
}
function resizeCanvas(){
  const rect=gameContainer.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const newW=Math.round(rect.width*2),newH=Math.round(rect.height*2);
  if(newW===W&&newH===H)return;
  const firstLoad=!W||!H;
  const oldW=W||newW,oldH=H||newH;
  canvas.width=newW;canvas.height=newH;
  treeCanvas.width=newW;treeCanvas.height=newH;_treeCanvasLean=null; // resizing wipes it
  W=newW;H=newH;
  if(firstLoad){
    _treeSeed = (Date.now() ^ (Math.random()*0xffffffff|0)) | 1;
    _generateTreeSeeded();
  } else {
    const scaleX=W/oldW,scaleY=H/oldH;
    const bloomedIdx=branches.map((b,i)=>b.bloomed?i:-1).filter(i=>i>=0);
    // Save blossoms directly so they restore at current opacity (no fade-in flash)
    const savedBlossoms=blossoms.map(b=>({...b,x:b.x*scaleX,y:b.y*scaleY,baseX:b.baseX*scaleX,baseY:b.baseY*scaleY}));
    const savedPetals=petals.map(p=>({...p,x:p.x*scaleX,y:p.y*scaleY,groundY:p.groundY*scaleY}));
    const savedWishes=wishes.map(w=>({...w,x:w.x*scaleX,y:w.y*scaleY,tagX:w.tagX*scaleX,tagY:w.tagY*scaleY}));
    // Autumn progress lives on the leaves (tint + which have fallen). Don't
    // stretch old leaf positions: if the box changed shape (phones settle
    // their layout after load), stretched leaves stop matching the branches.
    // Instead the seeded regeneration rebuilds every leaf in place, and each
    // one gets its tint back by uid; leaves missing from the saved set fell.
    const savedAutumn = season==='autumn'
      ? {tintByUid:new Map(leaves.map(l=>[l.uid,l.tintStage])),totalLeavesInit,totalColorShifted,isFullyAutumn}
      : null;
    _generateTreeSeeded();
    if(savedAutumn){
      leaves=leaves.filter(l=>savedAutumn.tintByUid.has(l.uid));
      leaves.forEach(l=>{l.tintStage=savedAutumn.tintByUid.get(l.uid);});
      totalLeavesInit=savedAutumn.totalLeavesInit;
      totalColorShifted=savedAutumn.totalColorShifted;
      isFullyAutumn=savedAutumn.isFullyAutumn;
      _treeDirty=true;
    }
    // Restore branch bloom state without re-spawning blossoms (avoids opacity:0 fade-in)
    bloomedIdx.forEach(i=>{if(branches[i]&&branches[i].canBloom){branches[i].bloomed=true;branches[i].bloomProgress=1;}});
    totalBloomed=bloomedIdx.filter(i=>branches[i]&&branches[i].canBloom).length;
    isFullyBloomed=totalBloomed>=totalBranchZones;
    blossoms.push(...savedBlossoms);
    petals.push(...savedPetals);
    wishes.push(...savedWishes);
    updateUI();
  }
  dog.y=H*0.660;
  dog.x=Math.max(W*0.1,Math.min(W*0.9,dog.x||W*0.5));
  rebuildBgCache();
}

// ---- Ambient bg petals ----
function initBgPetals(){
  for(let i=0;i<22;i++){
    const p=document.createElement('div');p.className='bg-petal';
    p.style.left=Math.random()*100+'%';p.style.top=Math.random()*100+'%';
    p.style.setProperty('--dur',(Math.random()*5+4)+'s');p.style.animationDelay=Math.random()*5+'s';
    p.style.transform=`rotate(${Math.random()*360}deg) scale(${0.5+Math.random()})`;
    document.body.appendChild(p);
  }
}

// ---- Init ----
// Stop the animation entirely while the game is scrolled out of view — the
// biggest battery saver for people reading the links below it.
new IntersectionObserver((entries)=>{
  _gameVisible = entries[0].isIntersecting;
  if(_gameVisible && !_animId && !document.hidden) _animId=requestAnimationFrame(draw);
}).observe(gameContainer);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ if(_animId){cancelAnimationFrame(_animId);_animId=null;} }
  else if(!_animId){ _animId=requestAnimationFrame(draw); }
});
// Watch the container, not the window: iOS in-app browser sheets settle their
// layout after load without firing window 'resize', leaving the canvas buffer
// a different shape than its CSS box (stretched tree, squashed sprites).
new ResizeObserver(()=>{clearTimeout(_resizeTimer);_resizeTimer=setTimeout(resizeCanvas,150);}).observe(gameContainer);
// Allow autumn.js to flip the game between seasons. Regenerates the tree so
// the player gets a clean canvas (fully leafy for autumn, bare for spring).
// immediate: skip the gust animation — used on page load so a returning
// autumn visitor never sees a flash of the spring scene.
window.__setGardenSeason = function(s, immediate) {
  if (s !== 'spring' && s !== 'autumn') return;
  if (s === season) return;
  season = s;
  if (immediate) { _generateTreeSeeded(); initFlowers(); return; }
  resetTree();
};
initBgPetals();
resizeCanvas();
initClouds();
initGeese();
initFerry();
initSailboat();
initSailboat2();
initOrca();
initDog();
initFlowers();
draw();
