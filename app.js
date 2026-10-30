/* Standalone viewer. Metric coordinates are traced approximations, not survey data. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const DEG = Math.PI / 180, NS = 'http://www.w3.org/2000/svg';
const FH = 2.9, BASE = 4;
// Glass-plane setback is fixed by the user's comparison brief. Opening sizes
// and wall returns remain explicit assumptions until window schedules exist.
const VIEW_SETBACK = 1;
const opening = {width:2.4,sill:.6,top:2.2,wallDepth:.2};
// Official 1400x820 expanded-plan opening symbols, checked 2026-10-23.
// Pixel lengths include frames. Metres use an ASSUMED model scale, not a
// measured window schedule. VR confirms A/D forms, not their dimensions.
const livingOpeningProfiles={
 '84A':{3:{pixels:122,scale:.022,start:[1057,516],end:[1057,638]},4:{pixels:150,scale:.022,start:[875,681],end:[1025,681]}},
 '84B':{1:{pixels:150,scale:.022,start:[423,692],end:[573,692]},2:{pixels:123,scale:.022,start:[387,527],end:[387,650]}},
 '84C':{1:{pixels:151,scale:.023,start:[405,625],end:[556,625]},2:{pixels:122,scale:.023,start:[369,458],end:[369,580]}},
 '84D':{1:{pixels:150,scale:.022,start:[403,640],end:[553,640]},2:{pixels:124,scale:.022,start:[366,454],end:[366,578]}},
 '84E':{1:{pixels:123,scale:.022,start:[1074,414],end:[1074,537]},2:{pixels:150,scale:.022,start:[891,581],end:[1041,581]}},
 '84F':{1:{pixels:101,scale:.023,start:[346,573],end:[447,573]},2:{pixels:150,scale:.023,start:[330,383],end:[330,533]}}
};
const openingOverrides=new Map();
let openingSource='미확인 창 크기 가정';
const seasons = [
 {key:'spring',name:'봄',month:3,day:20}, {key:'summer',name:'여름',month:6,day:21},
 {key:'autumn',name:'가을',month:9,day:23}, {key:'winter',name:'겨울',month:12,day:22}
];
let solarSeason='winter',solarMinute=750,analysisKey='',windowRecess;
const rows = [
 [101,-226.4,56.6,44], [102,-291.2,15.3,43],
 [103,-245.8,-50.5,48], [104,-186.6,-10.6,48],
 [105,-127.8,29.1,48], [106,-65.4,72.6,49],
 [107,-7.8,111.4,49], [108,58.2,44.9,49],
 [109,0,0,49], [110,-63.6,-45.2,49],
 [111,-126.6,-87.8,49], [112,-186.4,-128.1,49]
];
const allUnits = SOURCE.units;
const isPenthouse = type => /^(200|207|209|211|214)/.test(type);
const family = type => type.replace(/([AB])\d$/, '$1');
const unitSlot = u => `${isPenthouse(u.type)?'p':'r'}${u.line}`;
const buildings = rows.map(([id,x,z,roof]) => {
 const units=allUnits.filter(u=>u.building===id);
 const choices=[...new Set(units.map(unitSlot))].sort().sort((a,b)=>(a[0]==='p')-(b[0]==='p')).map(key=>({key,units:units.filter(u=>unitSlot(u)===key)}));
 return {id,x,z,roof,units,choices};
});
const footprint = SOURCE.footprint;
const SITE = [[-188.8,-179],[96.2,17.8],[103,60],[-35.2,191.7],[-97.8,125.5],[-198,105.4],[-209.5,150.3],[-289.1,174.2],[-385.9,66.6]];
// Phase 1 is A2BL. The western phase-2 site is A1BL (official notice).
// These four towers are comparison geometry, not approved block locations or numbers.
const PHASE2_SITE=[[-550,-16],[-367,-62],[-312,16],[-377,171],[-473,199]];
const PHASE2_TOWERS=[[-478,25],[-392,5],[-447,126],[-378,93]];
const PHASE2_ANGLE=-.4;
// Pixel anchors are read from the official 1400 × 820 expanded plans. Bearings
// follow the supplied north-up assembly; metric placement remains approximate.
const planFits = {
 B:{pixel:[387,692],world:[-19.5,17.8],right:77.6,down:167.6,scale:.022},
 C:{pixel:[370,625],world:[-18.1,-10.1],right:167.6,down:257.6,scale:.023},
 D:{pixel:[367,640],world:[-8.6,-24.7],right:167.6,down:257.6,scale:.022},
 E:{pixel:[1073,580],world:[20.1,-6.9],right:77.6,down:167.6,scale:.022},
 F:{pixel:[396,570],world:[16.5,13.3],right:347.6,down:77.6,scale:.023}
};
function mappedWindows(type,items){
 const fit=planFits[type];
 return items.map(([name,bearing,x,y,note=''],i)=>{
  const dx=(x-fit.pixel[0])*fit.scale,dy=(y-fit.pixel[1])*fit.scale;
  const raw=[fit.world[0]+dx*Math.sin(fit.right*DEG)+dy*Math.sin(fit.down*DEG),fit.world[1]-dx*Math.cos(fit.right*DEG)-dy*Math.cos(fit.down*DEG)];
  // Align the reading point with a nearby outward-facing edge of the common
  // tower footprint. Do not place a camera inside a solid simplified wall.
  const vx=Math.sin(bearing*DEG),vz=-Math.cos(bearing*DEG);let best=null;
  for(let j=0;j<footprint.length;j++){
   const a=footprint[j],b=footprint[(j+1)%footprint.length],ex=b[0]-a[0],ez=b[1]-a[1],len=Math.hypot(ex,ez);if(len<1.5)continue;
   let nx=-ez/len,nz=ex/len;if(pointInside((a[0]+b[0])/2+nx*.15,(a[1]+b[1])/2+nz*.15,footprint)){nx=-nx;nz=-nz;}
   if(nx*vx+nz*vz<.88)continue;
   const t=Math.max(.02,Math.min(.98,((raw[0]-a[0])*ex+(raw[1]-a[1])*ez)/(len*len)));
   const q=[a[0]+ex*t+nx*.1,a[1]+ez*t+nz*.1],distance=Math.hypot(raw[0]-q[0],raw[1]-q[1]);
   if(!best||distance<best.distance)best={pos:q,distance};
  }
  return {id:i+1,name,bearing,pos:best?best.pos:raw,hot:[x,y],note,placementShift:best?.distance||0};
 });
}
const unitWindows = {
 A:[
  {id:1,name:'주방 동쪽',bearing:77.6,pos:[5.63,21.27],hot:[994,327]},
  {id:2,name:'주방 남쪽',bearing:167.6,pos:[3.7,23.91],hot:[1057,400]},
  {id:3,name:'거실 남쪽',bearing:167.6,pos:[.27,24.66],hot:[1057,575]},
  {id:4,name:'거실 서쪽',bearing:257.6,pos:[-3.4,22.3],hot:[950,681]},
  {id:5,name:'침실 2',bearing:257.6,pos:[-4.19,18.71],hot:[775,681]},
  {id:6,name:'침실 1',bearing:257.6,pos:[-4.8,15.94],hot:[638,681]},
  {id:7,name:'안방',bearing:167.6,pos:[5.78,13.57],hot:[592,202]},
  {id:8,name:'주방',bearing:77.6,pos:[6.53,18.68],hot:[883,267]},
  {id:9,name:'다용도실 보조창',bearing:77.6,pos:[5.98,16.30],hot:[783,266],note:'보조창은 외벽을 단순화한 위치 추정입니다.'}
 ],
 B:mappedWindows('B',[
  ['거실 남쪽',167.6,498,692],['거실 서쪽',257.6,388,588],['주방 서쪽',257.6,388,420],
  ['침실 2',167.6,674,692],['침실 1',167.6,810,692],['안방',257.6,745,201],
  ['주방 북쪽 ①',347.6,451,341],['주방 북쪽 ②',347.6,565,278],['다용도실 보조창',347.6,666,277,'다용도실·피난공간 쪽의 보조창입니다.']
 ]),
 C:mappedWindows('C',[
  ['거실 서쪽',257.6,480,625],['거실 북쪽',347.6,370,518],['주방·식당 북쪽',347.6,370,378],
  ['침실 2',257.6,657,625],['침실 1',257.6,792,625],['안방',257.6,920,591,'발코니 너머를 보는 안방 창입니다. 발코니 깊이는 모형에서 단순화했습니다.'],
  ['발코니',257.6,920,648,'안방 앞 발코니의 바깥 창입니다.'],['주방',347.6,370,273],['다용도실 보조창',77.6,621,204,'안쪽 외벽에 있는 보조창으로, 위치 오차가 큰 단순 모형입니다.']
 ]),
 D:mappedWindows('D',[
  ['거실 서쪽',257.6,480,639],['거실 북쪽',347.6,369,516],['주방·식당 북쪽',347.6,369,376],
  ['침실 2',257.6,654,638],['안방',257.6,811,638],['침실 1',77.6,823,225],['알파룸',77.6,939,225],
  ['주방 북쪽',347.6,369,266],['주방 동쪽',77.6,455,196],['다용도실 보조창',77.6,599,197,'다용도실·피난공간 쪽의 보조창입니다.']
 ]),
 E:mappedWindows('E',[
  ['거실 동쪽',77.6,1074,477],['거실 남쪽',167.6,966,580],['주방 동쪽',77.6,1074,305],
  ['침실 2',167.6,790,580],['침실 1',347.6,547,195],['안방',77.6,728,636],
  ['주방 북쪽 ①',347.6,1011,228],['주방 북쪽 ②',347.6,900,166],['다용도실 보조창',347.6,797,163,'다용도실·피난공간 쪽의 보조창입니다.']
 ]),
 F:mappedWindows('F',[
  ['거실 동쪽',77.6,397,572],['거실 남쪽',167.6,329,460],['침실 1',77.6,1005,583],['침실 2',77.6,866,583],
  ['안방',167.6,447,266],['주방',77.6,602,665],['다용도실 보조창',77.6,719,613,'다용도실·피난공간 쪽의 보조창입니다.']
 ])
};
for(const [type,plan] of Object.entries(EXTENDED_PLANS)){
 planFits[type]=plan.fit;unitWindows[type]=mappedWindows(type,plan.windows);
}
for(const t of 'ABCDEF')unitWindows['84'+t]=unitWindows[t];
const state = {building:109,slot:'r1',type:'84A',floor:33,eye:1.6,window:3,mode:'window',yaw:167.6,pitch:0,fov:70,orbitYaw:155,orbitEl:38,orbitDistance:560,day:0,labels:true,frame:false};
let scene, camera, renderer, sky, sun, ambient, facadeMaterial, towerMaterial, groundMaterial, roadMaterial;
let cameraNow = new THREE.Vector3(), lookNow = new THREE.Vector3(), targetPosition = new THREE.Vector3(), targetLook = new THREE.Vector3();
let initialized = false, dirty = true, toastTimer, lastTime = 0, svgWedge, svgEye;
const towerGroups = new Map(), labels = [], surfaces = [], obstacles = [], raycaster = new THREE.Raycaster();
let futureGroup, mallGroup, hotel, publicBuilding, neighborhoodGroup, terrainGroup;
let phase2Group,phase2Label,phase2Mini;const phase2Towers=[],phase2MiniTowers=[];
const phase2Config={floors:49,width:40};
const landCenter = new THREE.Vector3(-133,10,0);
const tempV = new THREE.Vector3(), dummy = new THREE.Object3D();
let seed = 4159;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const normalize = a => (a % 360 + 360) % 360;
const selectedBuilding = () => buildings.find(b => b.id === state.building);
const selectedWindow = () => unitWindows[state.type].find(w => w.id === state.window) || unitWindows[state.type][0];
const eyeHeight = () => BASE + (state.floor - 1) * FH + state.eye;
const floorHeight = f => BASE + f * FH;
const compass = a => ['북','북북동','북동','동북동','동','동남동','남동','남남동','남','남남서','남서','서남서','서','서북서','북서','북북서'][Math.round(normalize(a)/22.5)%16];
const unitNumber = () => `${state.floor}${state.slot.slice(1).padStart(2,'0')}`;
const selectedChoice = () => selectedBuilding().choices.find(c=>c.key===state.slot);
const planKey = () => state.type.startsWith('84')?state.type.slice(2):state.type;
function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000); }
function svg(tag,attrs={},parent) { const el=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v); if(parent)parent.appendChild(el); return el; }
function pointInside(x,z,poly) { let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++) {const a=poly[i],b=poly[j]; if(((a[1]>z)!==(b[1]>z)) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside=!inside;} return inside; }
function rectangle(x,z,w,d,a=0){return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([px,pz])=>[x+px*Math.cos(a)+pz*Math.sin(a),z-px*Math.sin(a)+pz*Math.cos(a)]);}
function edgeDistance(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz));}return best;}
function rayDistance(p,angle,poly){const dx=Math.sin(angle*DEG),dz=-Math.cos(angle*DEG);let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ez=b[1]-a[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-8)continue;const ax=a[0]-p.x,az=a[1]-p.z,t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;if(t>0&&u>=0&&u<=1)best=Math.min(best,t);}return best;}
// Distance cards describe the main building wall, not an elevated rooftop part.
// Rooftop parts remain in studyObstacles() for actual ray/height comparisons.
function activeObstacles(){return obstacles.filter(o=>!o.component&&o.id!==state.building&&(!o.group||o.group.visible));}
function visibleSurface(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
const escapeHTML=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function updateDistanceCard(){
 if(!obstacles.length)return;const p=cameraAnchor(),angle=state.mode==='window'?state.yaw:selectedWindow().bearing;
 const all=activeObstacles().map(o=>({...o,distance:edgeDistance(p,o.poly),ray:rayDistance(p,angle,o.poly)}));
 let target=all.filter(o=>Number.isFinite(o.ray)).sort((a,b)=>a.ray-b.ray)[0],direct=true;
 if(!target){direct=false;const half=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(state.fov*DEG/2)*(camera?.aspect||1)))/2;target=all.filter(o=>o.poly.some(([x,z])=>Math.abs((normalize(Math.atan2(x-p.x,-(z-p.z))/DEG-angle)+180)%360-180)<half)).sort((a,b)=>a.distance-b.distance)[0];}
 $('distanceMode').textContent=direct?'정면 방향의 건물':'좌우 시야의 건물';
 if(!target){$('distanceTarget').textContent='등록된 건물이 없는 방향';$('distanceValue').textContent='—';$('heightDifference').textContent='—';$('distanceNote').textContent='미등록 건물·예정 사업으로 실제 전망은 달라질 수 있습니다.';return;}
 const delta=target.height()-eyeHeight(),d=direct?target.ray:target.distance;
 $('distanceTarget').textContent=target.name;$('distanceValue').textContent=`약 ${Math.round(d)}m`;$('heightDifference').textContent=`${delta>=0?'위':'아래'} ${Math.abs(Math.round(delta))}m`;
 $('distanceNote').textContent=`${direct?'정면 외벽까지':'가까운 외벽까지'} · 옥상은 내 눈높이 기준 · 모형 추정 / 자기 동 제외`;
}
function renderDistances(){
 const p=cameraAnchor(),groups=new Map();activeObstacles().forEach(o=>{const d=edgeDistance(p,o.poly);if(!groups.has(o.name)||groups.get(o.name).distance>d)groups.set(o.name,{...o,distance:d});});
 $('distanceTableTitle').textContent=`${state.building}동 ${unitNumber()}호 · ${selectedWindow().name}`;
 $('distanceRows').innerHTML=[...groups.values()].sort((a,b)=>a.distance-b.distance).map(o=>{const diff=o.height()-eyeHeight();return `<tr><td>${escapeHTML(o.name)}</td><td>약 ${Math.round(o.distance)}m</td><td>${escapeHTML(o.floorText())} · 약 ${Math.round(o.height())}m</td><td class="${diff>=0?'above':'below'}">${diff>=0?'위':'아래'} ${Math.abs(Math.round(diff))}m</td></tr>`;}).join('');
}
function allowedFloors() { return [...new Set(selectedChoice().units.map(u=>u.floor))].sort((a,b)=>a-b); }
function readViewLink(hash=window.location?.hash||''){
 const p=new URLSearchParams(hash.replace(/^#/,''));
 const keys=['building','floor','line','window'];
 if(!keys.every(k=>/^\d+$/.test(p.get(k)||'')))return null;
 const [building,floor,line,viewWindow]=keys.map(k=>Number(p.get(k)));
 const u=allUnits.find(u=>u.building===building&&u.floor===floor&&u.line===line);
 if(!u||!unitWindows[u.type]?.some(w=>w.id===viewWindow))return null;
 return {building,floor,slot:unitSlot(u),window:viewWindow,mode:'window',eye:1.6,fov:70};
}
function currentViewHash(){return `#building=${state.building}&floor=${state.floor}&line=${selectedChoice().units[0].line}&window=${state.window}&setback=1`;}
function applyViewLink(){const s=readViewLink();if(s){setSelection(s);if(new URLSearchParams(window.location.hash.slice(1)).get('plan')==='1')$('planDialog').showModal();}return !!s;}
function facadeAnchor(w=selectedWindow(),b=selectedBuilding()) {
 const vx=Math.sin(w.bearing*DEG),vz=-Math.cos(w.bearing*DEG);let best=null;
 for(let i=0;i<footprint.length;i++){
  const a=footprint[i],c=footprint[(i+1)%footprint.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
  // Locate the intended facade FIRST. A larger, unverified opening must not
  // jump to another unit's long wall just to fit the simplified footprint.
  if(len<1.5)continue;let nx=-dz/len,nz=dx/len;
  if(pointInside((a[0]+c[0])/2+nx*.05,(a[1]+c[1])/2+nz*.05,footprint)){nx=-nx;nz=-nz;}
  if(nx*vx+nz*vz<.85)continue;
  const rawT=clamp(((w.pos[0]-a[0])*dx+(w.pos[1]-a[1])*dz)/(len*len),0,1);
  const nearest=Math.hypot(w.pos[0]-a[0]-dx*rawT,w.pos[1]-a[1]-dz*rawT);
  const margin=(opening.width/2+.05)/len;
  const t=margin<=.5?clamp(rawT,margin,1-margin):rawT;
  const x=a[0]+dx*t,z=a[1]+dz*t,distance=Math.hypot(w.pos[0]-x,w.pos[1]-z);
  if(!best||nearest<best.nearest)best={x:b.x+x,z:b.z+z,shift:distance,nearest,edgeLength:len,edgeMargin:Math.min(t,1-t)*len,bearing:normalize(Math.atan2(nx,-nz)/DEG)};
 }
 return {...(best||{x:b.x+w.pos[0],z:b.z+w.pos[1],shift:Infinity,edgeLength:0,edgeMargin:0,bearing:w.bearing}),y:eyeHeight()};
}
function cameraAnchor() {
 const a=facadeAnchor(),vx=Math.sin(a.bearing*DEG),vz=-Math.cos(a.bearing*DEG);
 return new THREE.Vector3(a.x-vx*VIEW_SETBACK,eyeHeight(),a.z-vz*VIEW_SETBACK);
}
function centerSelectedWindow(){
 const a=facadeAnchor(),eye=cameraAnchor();
 const centerY=BASE+(state.floor-1)*FH+(opening.sill+opening.top)/2;
 state.yaw=a.bearing;
 state.pitch=Math.atan2(centerY-eye.y,Math.hypot(a.x-eye.x,a.z-eye.z))/DEG;
 dirty=true;
}
function applyOpeningProfile(){
 const key=`${state.type}:${state.window}`,profile=livingOpeningProfiles[state.type]?.[state.window];
 Object.assign(opening,openingOverrides.get(key)||{width:profile?Number((profile.pixels*profile.scale).toFixed(3)):2.4,sill:.6,top:2.2,wallDepth:.2});
 openingSource=openingOverrides.has(key)?'사용자가 조절한 비교 가정':profile?'공식 평면 기호 비율 × 모형 축척 추정 · 실측 아님':'창 치수 미확인 · 공통 비교 가정';
 for(const [id,value] of Object.entries({openingWidth:opening.width,openingSill:opening.sill,openingTop:opening.top,wallDepth:opening.wallDepth}))$(id).value=value;
}
function windowGeometry(w=selectedWindow(),b=selectedBuilding()){
 return {...facadeAnchor(w,b),floorY:BASE+(state.floor-1)*FH,eyeHeight:state.eye,setback:VIEW_SETBACK,
  width:opening.width,sill:opening.sill,height:opening.top-opening.sill,wallDepth:opening.wallDepth,source:openingSource};
}
function resetStudyAssumptions(){
 openingOverrides.clear();applyOpeningProfile();
 for(const [id,value] of Object.entries({phase2Floors:49,phase2Width:40,hotelHeight:80,publicFloors:20}))$(id).value=value;
 for(const id of ['phase2','future','mall','neighborhood'])$(id).checked=true;
 if(neighborhoodGroup)neighborhoodGroup.visible=true;updatePhase2();updateFuture();solarSeason='winter';solarMinute=750;updateSolarLighting();analysisKey='';
}
function updateWindowRecess(){
 if(!scene)return;
 if(windowRecess){scene.remove(windowRecess);const i=surfaces.indexOf(windowRecess);if(i>=0)surfaces.splice(i,1);windowRecess.geometry.dispose();windowRecess.material.dispose();}
 // A real geometric aperture with jamb depth, not a fixed screen decoration.
 // This plane is a local interior mask; it does not replace the tower's mass.
 const shape=new THREE.Shape();shape.moveTo(-100,-100);shape.lineTo(100,-100);shape.lineTo(100,100);shape.lineTo(-100,100);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-opening.width/2,opening.sill);hole.lineTo(-opening.width/2,opening.top);hole.lineTo(opening.width/2,opening.top);hole.lineTo(opening.width/2,opening.sill);hole.closePath();shape.holes.push(hole);
 const geo=new THREE.ExtrudeGeometry(shape,{depth:opening.wallDepth,bevelEnabled:false,steps:1});
 windowRecess=new THREE.Mesh(geo,material('#ece9de',{side:THREE.DoubleSide}));windowRecess.name='assumed-interior-window-opening';
 // Local +X is the observer's RIGHT, +Z is INDOORS. Never use the
 // outside-looking-in basis for an asymmetric interior window drawing.
 const a=facadeAnchor();windowRecess.position.set(a.x,BASE+(state.floor-1)*FH,a.z);windowRecess.rotation.y=-a.bearing*DEG;
 windowRecess.visible=state.mode==='window';windowRecess.castShadow=false;windowRecess.receiveShadow=false;scene.add(windowRecess);surfaces.push(windowRecess);
}
function studyObstacles(){return obstacles.filter(o=>!o.group||o.group.visible);}
function selfObstruction(w=selectedWindow(),b=selectedBuilding()){
 const win=windowGeometry(w,b),a=facadeAnchor(w,b),n={x:Math.sin(win.bearing*DEG),z:-Math.cos(win.bearing*DEG)},t={x:Math.cos(win.bearing*DEG),z:Math.sin(win.bearing*DEG)};
 const own=obstacles.find(o=>o.id===b.id)||{id:b.id,name:`${b.id}동`,poly:footprint.map(([x,z])=>[x+b.x,z+b.z]),height:floorHeight(b.roof)};
 const hits=[];
 for(let i=0;i<=48;i++){
  const lateral=(i/48-.5)*opening.width*.98,hit={x:win.x+t.x*lateral,y:win.y,z:win.z+t.z*lateral};
  const length=Math.hypot(VIEW_SETBACK,lateral),dir={x:(n.x*VIEW_SETBACK+t.x*lateral)/length,y:0,z:(n.z*VIEW_SETBACK+t.z*lateral)/length};
  const origin={x:hit.x+dir.x*.03,y:hit.y,z:hit.z+dir.z*.03};
  const blocker=SUNLIGHT.firstBlocker(origin,dir,[own]);if(blocker)hits.push({lateral,distance:blocker.distance,angle:Math.atan(lateral/VIEW_SETBACK)/DEG});
 }
 const near=hits.some(h=>h.distance<.25),inside=pointInside(win.x-b.x-n.x,win.z-b.z-n.z,footprint);
 return {hits,near,inside,edgeMismatch:a.edgeMargin<opening.width/2,anchorShift:a.shift};
}
const minuteLabel=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.round(n%60)).padStart(2,'0')}`;
const durationLabel=n=>n?`${Math.floor(n/60)}시간 ${n%60}분`:'0분';
function updateSolarLighting(){
 if(!sun)return;const s=seasons.find(s=>s.key===solarSeason);
 const p=SUNLIGHT.sunPosition({year:2026,month:s.month,day:s.day,hour:Math.floor(solarMinute/60),minute:solarMinute%60});
 sun.position.set(-150+p.direction.x*1000,Math.max(-100,p.direction.y*1000),p.direction.z*1000);sun.target.position.set(-150,0,0);
 sun.intensity=p.elevation>0?(state.day===2?.12:1.3):0;
 $('solarTimeValue').textContent=`${minuteLabel(solarMinute)} KST · 태양 고도 ${Math.round(p.elevation)}°`;
 $('solarTime').value=solarMinute;$('solarSeason').value=solarSeason;dirty=true;
}
function updateSunlightStudy(){
 if(!scene||!obstacles.length)return;
 const key=JSON.stringify([state.mode,state.building,state.type,state.floor,state.window,state.eye,opening,phase2Config,$('phase2').checked,$('future').checked,$('mall').checked,$('neighborhood').checked,$('hotelHeight').value,$('publicFloors').value]);
 if(key===analysisKey)return;analysisKey=key;
 const own=selfObstruction(),unreliable=own.near||!own.inside||own.edgeMismatch||own.anchorShift>2;
 const results=SUNLIGHT.assessSeasons({window:windowGeometry(),obstacles:studyObstacles(),sensitivity:false});
 $('sunlightRows').innerHTML=results.map(r=>`<tr><th>${seasons.find(s=>s.key===r.key).name}<small>${r.date.month}/${r.date.day}</small></th><td>${unreliable?'판단 보류':durationLabel(r.exteriorSunMinutes)}</td><td>${unreliable?'판단 보류':durationLabel(r.pointSunMinutes)}</td></tr>`).join('');
 const current=results.find(r=>r.key===solarSeason),intervals=current.intervals.map(r=>`${r.start}–${r.end}`).join(', ');
 $('sunlightIntervals').textContent=unreliable?'창 위치와 공통 외벽 모형의 오차가 커 일조 수치를 표시하지 않습니다.':`${seasons.find(s=>s.key===solarSeason).name} · 실내 점 직사광: ${intervals||'대표일 표본에서 없음'}.`;
 const side=own.hits.length?(own.hits.some(h=>h.lateral<0)?'왼쪽 ':'')+(own.hits.some(h=>h.lateral>0)?'오른쪽':''):'';
 $('selfObstruction').textContent=unreliable?'창 위치와 공통 외벽 모형의 불일치가 큽니다. 이 시점의 자기 동 차폐·일조는 판단 보류입니다.':own.hits.length?`가정 창폭의 ${side.trim()} 시야에 같은 동 돌출부가 걸립니다. 실제 입면과 창 치수로 재확인이 필요합니다.`:'가정 창폭의 수평 시야 표본에서는 같은 동 돌출부가 검출되지 않았습니다. 실제 무간섭을 보증하지 않습니다.';
 $('geometryConfidence').textContent=`외벽까지 위치 보정 약 ${own.anchorShift.toFixed(1)}m${own.edgeMismatch?' · 가정 창폭이 공통 외벽 모서리를 넘음: 시야·일조 수치 신뢰도 낮음':''}. 반복 창무늬로 이웃집 창 위치나 사생활 간섭을 판정하지 않습니다.`;
 $('sunlightContext').textContent=`${selectedWindow().name} · 창면에서 안쪽 1m · 눈높이 ${state.eye.toFixed(2)}m · 개구 폭 약 ${opening.width.toFixed(2)}m (${openingSource}) / 하단 ${opening.sill.toFixed(1)}m / 상단 ${opening.top.toFixed(1)}m / 벽 깊이 ${opening.wallDepth.toFixed(2)}m 가정`;
 $('viewStatus').classList.toggle('geometry-hold',state.mode==='window'&&unreliable);
 if(state.mode==='window')$('viewStatus').textContent=unreliable?'창·외벽 불일치 · 실제 조망 판단 보류':'창 안쪽 1m';
}
function setSelection(change, resetDirection=true) {
 const previousType=state.type,previousWindow=selectedWindow();
 Object.assign(state,change);const b=selectedBuilding();
 if(!b.choices.some(c=>c.key===state.slot))state.slot=b.choices[0].key;
 const floors=allowedFloors();state.floor=floors.reduce((a,v)=>Math.abs(v-state.floor)<Math.abs(a-state.floor)?v:a,floors[0]);
 state.type=selectedChoice().units.find(u=>u.floor===state.floor).type;
 state.eye=Math.max(1,Math.min(1.9,Number(state.eye)||1.6));
 if(previousType!==state.type && !Object.hasOwn(change,'window'))state.window=(unitWindows[state.type].find(w=>w.name===previousWindow.name)||unitWindows[state.type][0]).id;
 if(!unitWindows[state.type].some(w=>w.id===state.window))state.window=unitWindows[state.type][0].id;
 applyOpeningProfile();
 if(resetDirection || previousType!==state.type || Object.hasOwn(change,'eye'))centerSelectedWindow();
 renderControls(); updateSelectionMarker(); updateWindowRecess(); analysisKey='';dirty=true;
 $('scene').dataset.building=state.building; $('scene').dataset.unit=unitNumber(); $('scene').dataset.type=state.type; $('scene').dataset.eyeHeight=eyeHeight().toFixed(1);
 $('scene').dataset.window=state.window;$('scene').dataset.windowCount=unitWindows[state.type].length;$('scene').dataset.setback='1';
}
function renderControls() {
 const b=selectedBuilding(), floors=allowedFloors(), w=selectedWindow();
 $('building').value=String(b.id);
 $('unitType').replaceChildren(...b.choices.map(c=>{
 const sample=c.units.find(u=>u.floor===state.floor)||c.units[0],types=[...new Set(c.units.map(u=>u.type))];
 const label=c.key[0]==='p'?`${sample.type} · 49층 ${sample.line}호`:`${types.length>1?family(sample.type)+'1~3':sample.type} · ${sample.line}호`;
 return new Option(label,c.key);
 }));$('unitType').value=state.slot;
 $('unitLines').replaceChildren();$('penthouseLines').replaceChildren();
 b.choices.forEach(c=>{
  const nearest=c.units.reduce((a,u)=>Math.abs(u.floor-state.floor)<Math.abs(a.floor-state.floor)?u:a,c.units[0]);
  const penthouse=c.key[0]==='p',button=document.createElement('button');
  button.className='line-button'+(c.key===state.slot?' active':'');
  button.setAttribute('aria-pressed',String(c.key===state.slot));button.dataset.slot=c.key;
  button.innerHTML=`<strong>${penthouse?'49층 ':''}${nearest.line}호</strong><span>${nearest.type}</span>`;
  button.title=`${b.id}동 ${nearest.floor}${String(nearest.line).padStart(2,'0')}호 · ${nearest.type}${nearest.floor!==state.floor?' · 가장 가까운 주거층으로 이동':''}`;
  button.onclick=()=>setSelection({slot:c.key,window:1});
  $(penthouse?'penthouseLines':'unitLines').appendChild(button);
 });
 $('penthouseLines').hidden=!b.choices.some(c=>c.key[0]==='p');
 $('unitTitle').innerHTML=`${b.id}동 <span>${unitNumber()}호</span>`;
 $('unitCaption').textContent=`${state.type} · ${state.floor}층 · ${b.id===109 && state.type==='84A' && state.floor===33?'당첨 세대':'비교 세대'}`;
 $('floor').min=0;$('floor').max=floors.length-1;$('floor').value=floors.indexOf(state.floor);$('floor').setAttribute('aria-valuetext',`${state.floor}층`);
 $('floorValue').innerHTML=`${state.floor}<span>층</span>`; $('floorMin').textContent=`${floors[0]}층`;$('floorMax').textContent=`${floors.at(-1)}층`;
 $('heightNote').textContent=`지상 높이 약 ${eyeHeight().toFixed(1)}m`;
 $('eyeLevel').value=Math.round(state.eye*100);$('eyeValue').textContent=`바닥에서 ${Math.round(state.eye*100)}cm`;
 $('unitMappingNote').textContent=`${state.type} · 공식 동호배치표 반영${/^(103|112|128)/.test(state.type)?' · 층을 바꾸면 세부 타입도 변경됩니다.':''}`;
 $('floorDown').disabled=state.floor===floors[0]; $('floorUp').disabled=state.floor===floors.at(-1);
 $('windows').replaceChildren(); $('planHotspots').replaceChildren();$('largePlanHotspots').replaceChildren();
 unitWindows[state.type].forEach(win=>{
  const button=document.createElement('button');button.innerHTML=`<span class="number">${win.id}</span><span>${win.name}</span>`;
  button.className=win.id===w.id?'active':'';button.setAttribute('aria-pressed',String(win.id===w.id));button.onclick=()=>{setSelection({window:win.id,mode:'window'});updateModeUI();};$('windows').appendChild(button);
  if(win.hot){for(const target of ['planHotspots','largePlanHotspots']){const h=document.createElement('button');h.textContent=win.id;h.className=`hotspot ${win.id===w.id?'active':''}`;const size=SOURCE.sizes[planKey()];h.style.left=`${100*win.hot[0]/size[0]}%`;h.style.top=`${100*win.hot[1]/size[1]}%`;h.title=`${win.id}. ${win.name} · ${compass(win.bearing)}`;h.setAttribute('aria-label',win.name+'에서 보기');h.setAttribute('aria-pressed',String(win.id===w.id));h.onclick=()=>{button.onclick();if(target==='largePlanHotspots')$('planDialog').close();};$(target).appendChild(h);}}
 });
 $('planImage').src=SOURCE.images[planKey()];$('planImage').alt=`${state.type} 확장형 평면도`;
 $('largePlanImage').src=SOURCE.images[planKey()];$('largePlanImage').alt=`${state.type} 창 위치 확대 평면도`;$('largePlanTitle').textContent=`${state.type} · ${unitWindows[state.type].length}개 창·테라스 시점`;
 $('planNote').textContent=`${unitWindows[state.type].length}개 창·테라스 시점 · 숫자를 누르면 해당 창으로 이동합니다. 가까운 번호는 확대해서 선택하세요.`;
 $('windowNote').textContent=`${compass(w.bearing)} 계열 · 방향자료 ${w.bearing.toFixed(1)}° / 모형 외벽 ${facadeAnchor().bearing.toFixed(1)}°. 창 위치는 공통 외벽에 맞춘 추정입니다. 유리면에서 실내 1m 뒤에서 봅니다. ${w.note||'선택 창의 개구부를 통해 보이는 범위를 비교하세요.'} 같은 동 돌출 외벽을 유지하며, 창무늬를 숨긴 면이 실제 무창벽이라는 뜻은 아닙니다.`;
 const profile=livingOpeningProfiles[state.type]?.[state.window],normal=facadeAnchor().bearing;
 $('windowOrientation').textContent=`실내에서 밖을 보는 기준: 왼쪽 ${compass(normal-90)} · 정면 ${compass(normal)} · 오른쪽 ${compass(normal+90)}. 선택하면 개구 가운데에 정렬됩니다.`;
 $('openingEvidence').textContent=profile?`${openingSource}. 현재 개구 폭 약 ${opening.width.toFixed(2)}m. ${['84A','84D'].includes(state.type)?'A·D는 모델하우스에서 분리된 두 창과 코너 벽 형태도 확인했습니다.':'이 타입은 공식 평면만 확인했습니다.'} 높이·창턱·벽 깊이와 창틀 분할 치수는 미확인입니다.`:`${openingSource}. 이 창은 공개 창호 치수표와 대조되지 않아 폭 ${opening.width.toFixed(2)}m 등 비교 가정을 사용합니다.`;
 const panes={'84A:3':'좁은 유리 왼쪽 · 넓은 유리 오른쪽','84D:1':'좁은 유리 왼쪽 · 넓은 유리 오른쪽','84D:2':'넓은 유리 왼쪽 · 좁은 유리 오른쪽'}[`${state.type}:${state.window}`];
 $('modelhousePaneNote').textContent=panes?`모델하우스 관찰: 실내에서 창을 향해 볼 때 ${panes}. 세부 분할 비율과 두께는 미확정이어서 3D에는 창틀을 임의로 그리지 않았습니다.`:'이 창의 창틀 분할·유리별 좌우는 미확정입니다. 다른 창의 분할을 복제하지 않습니다.';
 const living=unitWindows[state.type].filter(win=>win.name.startsWith('거실'));
 $('livingWindows').replaceChildren(...living.map(win=>{const a=document.createElement('a');a.className=win.id===w.id?'active':'';a.textContent=win.name;a.href=`#building=${state.building}&floor=${state.floor}&line=${selectedChoice().units[0].line}&window=${win.id}&setback=1`;a.onclick=e=>{e.preventDefault();setSelection({window:win.id,mode:'window'});};return a;}));
 $('livingWindowNote').textContent=/^84[A-F]$/.test(state.type)?'공식 평면에서 구분한 거실 두 방향입니다. 주방·식당 창은 아래 전체 목록에서 별도 선택합니다. 두 방향 모두 확인하세요.':'거실로 표시된 시점 모음입니다. 좌표·창호는 도면 기반 추정입니다.';
 $('viewLink').value=(window.location?.href||'index.html').split('#')[0]+currentViewHash();
 $('viewWindow').textContent=`${b.id}동 · ${w.name}`;
 updateModeUI(); updateMini();
}
function updateModeUI(){
 updateFacadeVisibility();
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));});
 $('viewStatus').textContent={window:'창 안쪽 1m',orbit:'단지 전체',map:'위에서 보기'}[state.mode];
 if(state.mode!=='window')$('viewStatus').classList.remove('geometry-hold');
 if(windowRecess)windowRecess.visible=state.mode==='window';
 $('windowFrame').classList.remove('visible');
 $('frameToggle').disabled=state.mode!=='window';
 $('dragHint').innerHTML=state.mode==='window'?'↔ 드래그해서 둘러보기 <span>· 휠로 확대</span>':state.mode==='orbit'?'↔ 드래그해서 단지를 회전 <span>· 휠로 거리 조절</span>':'단지 지도에서 동을 눌러 선택하세요';
 $('scene').dataset.mode=state.mode;dirty=true;
}
function updateFacadeVisibility(){
 // Repeated facade windows are decorative, not surveyed openings. Hide them on
 // the observer's own tower so they cannot imply unverified neighbour sightlines.
 towerGroups.forEach((group,id)=>{if(group.userData.glazing)group.userData.glazing.visible=!(state.mode==='window'&&id===state.building);});
}
function material(color,extra={}) {const m=new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,...extra});m.color.convertSRGBToLinear();return m;}
function prism(poly,height,mat,x=0,z=0,base=0,parent=scene) {
 const shape=new THREE.Shape(); poly.forEach(([px,pz],i)=>i?shape.lineTo(px,-pz):shape.moveTo(px,-pz));shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:1});geo.rotateX(-Math.PI/2);
 const m=new THREE.Mesh(geo,mat);m.position.set(x,base,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(x,z,width,depth,height,mat,rotation=0,base=0,parent=scene) {
 const m=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);m.position.set(x,base+height/2,z);m.rotation.y=rotation;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function flatPolygon(poly,mat,y=.03,parent=scene){return prism(poly,.04,mat,0,0,y,parent);}
function ribbon(points,width,mat,y=.08,parent=scene){
 for(let i=1;i<points.length;i++){const [x,z]=points[i-1],[x2,z2]=points[i],len=Math.hypot(x2-x,z2-z);box((x+x2)/2,(z+z2)/2,width,len,.08,mat,Math.atan2(x2-x,z2-z),y,parent);}
}
function addLabel(text,x,y,z,kind='',detail='',group=null){
 const el=document.createElement('div');el.className=`world-label ${kind}`;el.textContent=text;if(detail){const s=document.createElement('small');s.textContent=detail;el.append(s);}$('labels').append(el);
 const item={el,position:new THREE.Vector3(x,y,z),group,text};labels.push(item);return item;
}
function facadeTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#d9ded9';ctx.fillRect(0,0,256,256);
 ctx.fillStyle='#9ea9a6';ctx.fillRect(0,248,256,8);ctx.fillStyle='#b3bcb6';ctx.fillRect(0,0,4,256);
 const grad=ctx.createLinearGradient(0,35,0,225);grad.addColorStop(0,'#668a98');grad.addColorStop(.45,'#a9c4c9');grad.addColorStop(1,'#436979');
 ctx.fillStyle='#a9b5b0';ctx.fillRect(32,28,193,207);ctx.fillStyle=grad;ctx.fillRect(40,35,177,192);
 ctx.fillStyle='#e4e8e2';ctx.fillRect(123,33,6,196);ctx.fillRect(38,153,182,5);ctx.fillStyle='#1c424c55';ctx.fillRect(39,220,177,7);
 const tex=new THREE.CanvasTexture(c);tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tex.encoding=THREE.sRGBEncoding;return tex;
}
function addTower(b){
 const group=new THREE.Group();group.name=String(b.id);scene.add(group);towerGroups.set(b.id,group);const height=floorHeight(b.roof);
 const body=prism(footprint,height,towerMaterial,b.x,b.z,0,group);surfaces.push(body);
 obstacles.push({id:b.id,name:`${b.id}동`,poly:footprint.map(([x,z])=>[x+b.x,z+b.z]),height:()=>height,floorText:()=>`${b.roof}층`});
 const segments=[];
 for(let i=0;i<footprint.length;i++){const a=footprint[i],c=footprint[(i+1)%footprint.length],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len>3.1)segments.push({a,c,len,count:Math.max(1,Math.round(len/2.5))});}
 const total=segments.reduce((sum,e)=>sum+e.count*b.roof,0);const windows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),facadeMaterial,total);let n=0;
 segments.forEach(({a,c,len,count})=>{
  const dx=(c[0]-a[0])/len,dz=(c[1]-a[1])/len;let nx=-dz,nz=dx;if(pointInside((a[0]+c[0])/2+nx*.1,(a[1]+c[1])/2+nz*.1,footprint)){nx=-nx;nz=-nz;}
  for(let f=1;f<=b.roof;f++) for(let k=0;k<count;k++){
   const t=(k+.5)/count;dummy.position.set(b.x+a[0]+(c[0]-a[0])*t+nx*.045,BASE+(f-.5)*FH,b.z+a[1]+(c[1]-a[1])*t+nz*.045);
   dummy.rotation.set(0,Math.atan2(nx,nz),0);dummy.scale.set(len/count-.1,FH,1);dummy.updateMatrix();windows.setMatrixAt(n,dummy.matrix);
   const shade=f===21?.45:.92+random()*.08;windows.setColorAt(n,new THREE.Color(shade,shade,shade));n++;
  }
 });
 windows.instanceMatrix.needsUpdate=true;windows.name='illustrative-windows';group.userData.glazing=windows;
 windows.visible=!(state.mode==='window'&&b.id===state.building);group.add(windows);
 // Match the EXISTING illustrative rooftop meshes with the ray geometry.
 // These sizes predate the model photos; they are NOT measured from photos.
 // Preserve each part's elevated base: a rooftop must not become a solid
 // ground-to-roof prism in the sunlight or horizontal-view calculation.
 const roofPart=(mesh,key,label,poly,base,top)=>{
  mesh.name=`${b.id}-roof-${key}`;surfaces.push(mesh);
  obstacles.push({id:b.id,name:`${b.id}동 ${label} · 가정`,component:'roof',meshName:mesh.name,poly,
   base:()=>base,height:()=>top,floorText:()=>`옥상 가정 구조물`,group,
   source:'기존 화면 모형 치수와 일치 · 사진 실측/승인 치수 아님'});
 };
 roofPart(prism(footprint,.75,material('#9bafa8'),b.x,b.z,height,group),'slab','옥상 슬래브',footprint.map(([x,z])=>[x+b.x,z+b.z]),height,height+.75);
 roofPart(box(b.x,b.z,12,12,4,material('#80938e'),-.215,height+.75,group),'body','옥탑',rectangle(b.x,b.z,12,12,-.215),height+.75,height+4.75);
 roofPart(box(b.x,b.z,8,9,.6,material('#b7c0b8'),-.215,height+4.75,group),'cap','옥탑 상부',rectangle(b.x,b.z,8,9,-.215),height+4.75,height+5.35);
 // A continuous refuge-floor band helps read relative heights without claiming facade precision.
 prism(footprint.map(([x,z])=>[x*1.003,z*1.003]),1.6,material('#607a78'),b.x,b.z,BASE+20*FH,group);
 if(b.id===101)box(b.x,b.z,23,18,3.8,material('#617d81'),-.215,height-3.8,group);
 const label=addLabel(`${b.id}동`,b.x,height+11,b.z,'',`${b.roof}층${b.id===101?' · 44층 커뮤니티':''}`);label.tower=body;
}
function neighboringBlock(name,x,z,w,d,floors,angle=-.35,group=scene,kind='',comparisonName='주변 아파트'){
 const h=floorHeight(floors),mat=material(kind?'#ccbd9e':'#c1c6bb');const b=box(x,z,w,d,h,mat,angle,0,group);surfaces.push(b);
 obstacles.push({name:comparisonName,poly:rectangle(x,z,w,d,angle),height:()=>h,floorText:()=>`${floors}층 적용`,group:group===scene?null:group});
 // Glazing grids, batched per building, keep navigation fluid.
 const count=Math.max(2,Math.round(w/4)),inst=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,1.6),material('#627e80'),count*floors*2);let n=0;
 for(let f=0;f<floors;f++)for(let s of [-1,1])for(let k=0;k<count;k++){
  const lx=-w/2+(k+.5)*w/count,lz=s*(d/2+.05);dummy.position.set(x+lx*Math.cos(angle)+lz*Math.sin(angle),BASE+f*FH+1.6,z-lx*Math.sin(angle)+lz*Math.cos(angle));dummy.rotation.set(0,angle+(s<0?Math.PI:0),0);dummy.scale.set(1,1,1);dummy.updateMatrix();inst.setMatrixAt(n++,dummy.matrix);
 }
 group.add(inst);box(x,z,w+1,d+1,1,material('#8f9e91'),angle,h,group);if(name)addLabel(name,x,h+8,z,kind,`${floors}층 가정`,group===scene?null:group);return b;
}
function addTrees(){
 const trunkMat=material('#9b9075'),leafMat=material('#668e62');const points=[];
 for(let i=0;i<550;i++){const x=-390+random()*510,z=-188+random()*385;if(!pointInside(x,z,SITE))continue;if(buildings.some(b=>Math.hypot(x-b.x,z-b.z)<30))continue;points.push([x,z]);}
 const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leafMat,points.length),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.25,2.4,4),trunkMat,points.length);
 points.forEach(([x,z],i)=>{const s=2.2+random()*1.6;dummy.position.set(x,3+s*.35,z);dummy.scale.set(s,s*1.05,s);dummy.rotation.set(random(),random()*4,0);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);crowns.setColorAt(i,new THREE.Color().setHSL(.25+random()*.04,.23,.38+random()*.12));dummy.position.set(x,1.2,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});
 crowns.castShadow=true;scene.add(crowns,trunks);
}
function buildSurroundings(){
 roadMaterial=material('#858e8c'); const walk=material('#c8c8b8'),river=material('#8bb7bf',{roughness:.35}),grass=material('#a7b995');
 flatPolygon(SITE,material('#b9c9a7'));
 const r1=[[200,-47],[126,57],[-155,355],[-342,544]];
 const r2=[[-430,-344],[-187,-186],[102,14],[126,57]];
 const r3=[[-465,147],[-399,55],[-207,-190],[-151,-267]];
 [r1,r2,r3].forEach((r,i)=>{ribbon(r,i===2?40:29,walk,.05);ribbon(r,i===2?32:22,roadMaterial,.15);ribbon(r,.35,material('#e3d49d'),.22);});
 SOURCE.geography.water.forEach(w=>{ribbon(w.points,48,grass,.06);ribbon(w.points,24,river,.16);});
 addLabel('광주천',-220,4,337,'','공개 지도 중심선 · 하폭 가정');
 // Pedestrian axes and landscape spaces inside the complex.
 ribbon([[-213,-144],[-296,-20],[-330,39],[-271,99],[-202,135]],7,walk,.2);
 ribbon([[-188,-61],[-73,23],[39,99]],9,walk,.22);
 ribbon([[-108,-141],[-173,-32],[-229,68]],8,walk,.2);
 ribbon([[22,-32],[-64,90],[-110,181]],8,walk,.2);
 ribbon([[-310,-4],[-198,76],[-106,123]],9,walk,.2);
 const park=[[-179,112],[-112,142],[-48,169],[-109,235],[-221,195]];flatPolygon(park,material('#a6bc87'),.12);
 box(-123,162,40,26,7,material('#eee9d9'),-.5);box(-127,163,32,20,.4,material('#91a57c'),-.5,7);
 addLabel('문화공원 2',-139,13,175,'planned','배치 개략');
 box(-127,83,35,24,2.5,material('#e3e1cf'),-.22);box(-127,83,25,16,.3,material('#93a47d'),-.22,2.5);
 buildMappedNeighborhood();
 // Planned zones are scenario geometry, intentionally differentiated from residential towers.
 flatPolygon(PHASE2_SITE,material('#c4b498',{transparent:true,opacity:.6}),.4);
 buildPhase2();
 box(-374,-85,84,47,15,material('#d9cfab'),-.6);box(-373,-84,71,34,.4,material('#9eae8b'),-.6,15);
 addLabel('가칭 임동초 계획',-374,24,-85,'planned','개교 시기 미확정 · 위치·형상 개략');
 mallGroup=new THREE.Group();scene.add(mallGroup);
 box(-407,241,112,87,42,material('#d6cfbd'),-.15,0,mallGroup);box(-407,241,100,75,.6,material('#a0b18d'),-.15,42,mallGroup);
 for(let f=1;f<8;f++)box(-407,241,112.2,87.2,.35,material('#b4ac95'),-.15,f*5.2,mallGroup);
 addLabel('더현대 광주 예정',-407,53,241,'planned','42m 가정 모형',mallGroup);
 obstacles.push({name:'더현대 예정 · 가정',poly:rectangle(-407,241,112,87,-.15),height:()=>42,floorText:()=>`42m 입력`,group:mallGroup});
 [[-260,140,67,32],[-317,101,60,32]].forEach(([x,z,w,d])=>{box(x,z,w,d,27,material('#d6d2bd'),-.4,0,mallGroup);box(x,z,w-4,d-4,.5,material('#a7b38b'),-.4,27,mallGroup);});
 addLabel('챔피언스몰',-277,36,132,'planned','높이·형상 가정',mallGroup);
 futureGroup=new THREE.Group();scene.add(futureGroup);
 hotel=box(-299,197,36,31,1,material('#bda886',{transparent:true,opacity:.84}),-.25,0,futureGroup);
 publicBuilding=box(-170,256,62,50,1,material('#d0b98f',{transparent:true,opacity:.86}),-.15,0,futureGroup);
 addLabel('호텔 예정',-299,88,197,'planned','높이 조절 가능',futureGroup);
 addLabel('공공시설 예정',-170,83,256,'planned','20층 상한 시나리오',futureGroup);
 obstacles.push({name:'호텔 예정 · 가정',poly:rectangle(-299,197,36,31,-.25),height:()=>Number($('hotelHeight').value),floorText:()=>`${$('hotelHeight').value}m 입력`,group:futureGroup});
 obstacles.push({name:'공공시설 예정 · 가정',poly:rectangle(-170,256,62,50,-.15),height:()=>Number($('publicFloors').value)*3.6,floorText:()=>`${$('publicFloors').value}층 가정`,group:futureGroup});
 updateFuture();
 // Stadium is an orientation landmark only; no claim of faithful stadium geometry.
 const stadium=new THREE.Mesh(new THREE.CylinderGeometry(78,84,14,48),material('#bcc1ac'));stadium.position.set(-551,7,-392);stadium.scale.z=.8;scene.add(stadium);
 const field=new THREE.Mesh(new THREE.CircleGeometry(58,48),material('#83a674'));field.rotation.x=-Math.PI/2;field.position.set(-551,14.1,-392);field.scale.y=.8;scene.add(field);addLabel('챔피언스필드',-551,27,-392,'','방향 참고 모형');
 addTrees();
 buildMappedTerrain();
}

function buildPhase2(){
 phase2Group=new THREE.Group();phase2Group.name='phase2-scenario';scene.add(phase2Group);
 const walls=material('#b8aaa2'),glazing=material('#657d83',{side:THREE.DoubleSide}),roof=material('#a88b76');
 PHASE2_TOWERS.forEach(([x,z],i)=>{
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=PHASE2_ANGLE;phase2Group.add(group);
  const body=box(0,0,1,.85,1,walls,0,0,group);surfaces.push(body);
  const cap=box(0,0,1.02,.87,.009,roof,0,1,group);
  const windows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),glazing,49*6*4);group.add(windows);
  const obstacle={name:`2차 가정동 ${i+1}`,poly:[],height:()=>floorHeight(phase2Config.floors),
   floorText:()=>`${phase2Config.floors}층 · 배치·층수 가정`,group:phase2Group,phase2:true};obstacles.push(obstacle);
  phase2Towers.push({group,body,cap,windows,obstacle,x,z});
 });
 phase2Label=addLabel('2차 예정 · A1블록',-446,floorHeight(49)+14,73,'planned','4개 가정동 · 49층 가정',phase2Group);
 updatePhase2();
}
function updatePhase2(){
 phase2Config.floors=clamp(Math.round(Number($('phase2Floors').value)||49),20,49);
 phase2Config.width=clamp(Number($('phase2Width').value)||40,28,46);
 const enabled=$('phase2').checked,f=phase2Config.floors,w=phase2Config.width,h=floorHeight(f);
 $('phase2Value').textContent=`${f}층 · 약 ${h.toFixed(1)}m`;$('phase2WidthValue').textContent=`${w}m 가정`;
 $('phase2Controls').hidden=!enabled;$('phase2Floors').value=f;$('phase2Width').value=w;
 if(phase2Group){
  phase2Group.visible=enabled;
  phase2Towers.forEach(t=>{
   t.group.scale.set(w,h,w);t.obstacle.poly=rectangle(t.x,t.z,w,w*.85,PHASE2_ANGLE);
   let n=0;
   for(let floor=0;floor<f;floor++)for(let side=0;side<4;side++)for(let col=0;col<6;col++){
    const along=-.5+(col+.5)/6,front=side<2,sign=side%2===0?1:-1;
    dummy.position.set(front?along:sign*.502,(BASE+(floor+.5)*FH)/h,front?sign*.427:along*.85);
    dummy.rotation.set(0,front?(sign>0?0:Math.PI):sign*Math.PI/2,0);dummy.scale.set(.055,1.5/h,1);dummy.updateMatrix();t.windows.setMatrixAt(n++,dummy.matrix);
   }
   t.windows.count=n;t.windows.instanceMatrix.needsUpdate=true;
  });
  phase2Label.position.y=h+14;phase2Label.el.querySelector('small').textContent=`4개 가정동 · ${f}층 · 확정 배치 아님`;
 }
 if(phase2Mini){phase2Mini.setAttribute('opacity',enabled?'1':'.25');phase2MiniTowers.forEach((el,i)=>{const [x,z]=PHASE2_TOWERS[i];el.setAttribute('points',rectangle(x,z,w,w*.85,PHASE2_ANGLE).map(p=>p.join(',')).join(' '));});}
 $('modelScale').textContent=`층고 2.9m · 2차 ${enabled?f+'층 가정':'미표시'}`;
 $('scene').dataset.phase2=String(enabled);$('scene').dataset.phase2Floors=f;$('scene').dataset.phase2Width=w;
 if($('distanceContent').hidden===false&&obstacles.length)renderDistances();dirty=true;
}
function lookAtPhase2(){
 $('phase2').checked=true;updatePhase2();const p=cameraAnchor();state.mode='window';
 state.yaw=normalize(Math.atan2(-437-p.x,-(62-p.z))/DEG);state.pitch=0;updateModeUI();
 $('landmarkNote').textContent=`2차 예정 A1블록 방향 · ${phase2Config.floors}층 가정 · 앞 동과 겹쳐 보일 수 있습니다.`;
 toast('2차 방향입니다. 2차 켜기·끄기와 층수를 바꿔 비교하세요.');
}
function buildMappedNeighborhood(){
 const geo=SOURCE.geography;neighborhoodGroup=new THREE.Group();scene.add(neighborhoodGroup);
 const wall=material('#c3c9c3'),roof=material('#a4b0ab'),windows=[];
 geo.buildings.forEach(b=>{
  const mesh=prism(b.poly,b.height,wall,0,0,0,neighborhoodGroup);surfaces.push(mesh);
  flatPolygon(b.poly,roof,b.height+.02,neighborhoodGroup);
  obstacles.push({name:b.name==='일반 건물'?'주변 일반 건물':b.name,poly:b.poly,height:()=>b.height,
   floorText:()=>`${b.floors}층 · ${b.source}`,group:neighborhoodGroup});
  if(b.height<20)return;
  b.poly.forEach((a,i)=>{
   const c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);if(length<5)return;
   const count=Math.max(1,Math.floor(length/4.2));
   for(let f=0;f<b.floors;f++)for(let k=0;k<count;k++)windows.push({x:a[0]+dx*(k+.5)/count,z:a[1]+dz*(k+.5)/count,y:4+f*(b.height-4)/b.floors+1.4,angle:Math.atan2(-dz,dx)});
  });
 });
 const glass=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6,1.4),material('#6f929c',{side:THREE.DoubleSide}),windows.length);
 windows.forEach((w,i)=>{dummy.position.set(w.x+Math.sin(w.angle)*.08,w.y,w.z+Math.cos(w.angle)*.08);dummy.rotation.set(0,w.angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();glass.setMatrixAt(i,dummy.matrix);});neighborhoodGroup.add(glass);
 // Batch all mapped streets into a single mesh to keep navigation responsive.
 const vertices=[];
 geo.roads.forEach(r=>{for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.1)continue;
  const nx=-dz/len*r.width/2,nz=dx/len*r.width/2;
  const p=[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]];
  [0,1,2,0,2,3].forEach(j=>vertices.push(p[j][0],.08,p[j][1]));
 }});
 const streets=new THREE.BufferGeometry();streets.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));streets.computeVertexNormals();
 scene.add(new THREE.Mesh(streets,material('#939e9c',{side:THREE.DoubleSide})));
 geo.landmarks.forEach(l=>addLabel(l.name,l.x,l.height+10,l.z,'',l.detail,neighborhoodGroup));
}
function terrainHeight(x,z,elevation){
 // Local ground remains flat for compatibility with the supplied apartment model.
 const a=clamp((Math.hypot(x,z)-1700)/800,0,1),blend=a*a*(3-2*a);
 return Math.max(0,elevation-SOURCE.geography.terrain.baseElevation)*blend-.4;
}
function buildMappedTerrain(){
 const t=SOURCE.geography.terrain,positions=[],indices=[],colors=[];terrainGroup=new THREE.Group();scene.add(terrainGroup);
 const color=new THREE.Color();
 for(let j=0;j<t.rows;j++)for(let i=0;i<t.cols;i++){
  const x=t.xmin+i*t.step,z=t.zmin+j*t.step,y=terrainHeight(x,z,t.heights[j*t.cols+i]);positions.push(x,y,z);
  color.setHSL(.28,.12,Math.max(.33,.49-y/6500));color.convertSRGBToLinear();colors.push(color.r,color.g,color.b);
  if(i<t.cols-1&&j<t.rows-1){const k=j*t.cols+i;indices.push(k,k+t.cols,k+1,k+1,k+t.cols,k+t.cols+1);}
 }
 const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(indices);terrain.computeVertexNormals();
 const mesh=new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));terrainGroup.add(mesh);surfaces.push(mesh);
 const p=SOURCE.geography.peak;addLabel('무등산 · 천왕봉 방향',p.x,p.elevation-t.baseElevation+40,p.z,'','약 11.2km · 공개 고도 자료를 단순화한 능선',terrainGroup);
}
function landmarkTargets(){
 const geo=SOURCE.geography,p=geo.peak;
 return [{name:p.name,x:p.x,z:p.z,height:p.elevation-geo.terrain.baseElevation,detail:'125m 간격 고도 자료 · 실제 능선과 차이 있음'},
  {name:'챔피언스필드',x:-551,z:-392,height:14,detail:'방향 참고 모형'},
  {name:'챔피언스시티 2차 예정 · A1블록',x:-437,z:62,height:floorHeight(phase2Config.floors),detail:'4개 가정동 · 확정 설계 아님'},...geo.landmarks];
}
function lookAtLandmark(){
 const target=landmarkTargets()[Number($('landmark').value)||0],p=cameraAnchor(),dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
 state.mode='window';state.yaw=normalize(Math.atan2(dx,-dz)/DEG);state.pitch=clamp(Math.atan2(target.height-p.y,distance)/DEG,-78,65);
 $('landmarkNote').textContent=`${target.name} · ${compass(state.yaw)} ${Math.round(state.yaw)}° · 약 ${distance>=1000?(distance/1000).toFixed(1)+'km':Math.round(distance)+'m'} · 앞 건물에 가릴 수 있습니다.`;
 updateModeUI();dirty=true;
}
function updateFuture(){
 if(!futureGroup)return;futureGroup.visible=$('future').checked;mallGroup.visible=$('mall').checked;
 const h=Number($('hotelHeight').value),p=Number($('publicFloors').value),ph=p*3.6;
 hotel.scale.y=h;hotel.position.y=h/2;publicBuilding.scale.y=ph;publicBuilding.position.y=ph/2;
 labels.find(l=>l.text==='호텔 예정').position.y=h+9;const pub=labels.find(l=>l.text==='공공시설 예정');pub.position.y=ph+9;pub.el.querySelector('small').textContent=`${p}층 가정 · 층고 3.6m`;
 $('hotelValue').textContent=`${h}m 가정`;$('publicValue').textContent=`${p}층 가정`;$('futureSliders').hidden=!futureGroup.visible;dirty=true;
 $('scene').dataset.future=String(futureGroup.visible);$('scene').dataset.hotelHeight=h;$('scene').dataset.publicFloors=p;
}
let selectionRing, windowDot;
function updateSelectionMarker(){
 if(!selectionRing)return;const b=selectedBuilding();selectionRing.position.set(b.x,1,b.z);windowDot.position.copy(cameraAnchor());
 windowDot.visible=state.mode!=='window';
}
function buildMini(){
 const el=$('mini');
 svg('polygon',{points:PHASE2_SITE.map(p=>p.join(',')).join(' '),fill:'#e4d6be',stroke:'#b4936c','stroke-width':2,'stroke-dasharray':'5 3'},el);
 phase2Mini=svg('g',{'aria-label':'2차 예정 가정 배치'},el);
 PHASE2_TOWERS.forEach(([x,z])=>phase2MiniTowers.push(svg('polygon',{points:rectangle(x,z,40,34,PHASE2_ANGLE).map(p=>p.join(',')).join(' '),fill:'#b59a85',stroke:'#886b58','stroke-width':1.5},phase2Mini)));
 svg('text',{x:-438,y:-28,'font-size':18,'text-anchor':'middle',fill:'#76543b'},el).textContent='2차 예정';
 svg('path',{d:'M -440 289 L -240 333 L 32 365 L 200 429',fill:'none',stroke:'#a1c7cc','stroke-width':25},el);
 svg('path',{d:'M -440 266 L -230 306 L 63 345',fill:'none',stroke:'#cdd7bd','stroke-width':12},el);
 svg('polygon',{points:SITE.map(p=>p.join(',')).join(' '),fill:'#dbe5d3',stroke:'#b7c5af','stroke-width':2},el);
 svg('path',{d:'M -390 -174 L 95 24 L 117 59 L -152 352',fill:'none',stroke:'#d2d6d0','stroke-width':13},el);
 svg('text',{x:156,y:-180,'font-size':23,'text-anchor':'middle',fill:'#49625b'},el).textContent='N';svg('path',{d:'M 156 -164 l -8 25 l 8 -5 l 8 5 Z',fill:'#49625b'},el);
 svg('rect',{x:-430,y:205,width:120,height:75,rx:8,fill:'#d7c5a4',transform:'rotate(-9,-370,242)'},el);
 svg('text',{x:-370,y:248,'font-size':18,'text-anchor':'middle',fill:'#836c48'},el).textContent='더현대';
 svg('text',{x:-230,y:414,'font-size':18,fill:'#62929a'},el).textContent='광주천';
 svgWedge=svg('path',{fill:'#167b7627',stroke:'#167b76','stroke-width':1.5},el);
 buildings.forEach(b=>{const g=svg('g',{class:'mini-building','data-building':b.id,tabindex:0,role:'button','aria-label':`${b.id}동 선택`},el);svg('polygon',{points:footprint.map(([x,z])=>`${x+b.x},${z+b.z}`).join(' ')},g);svg('text',{x:b.x,y:b.z-33},g).textContent=b.id;const select=()=>setSelection({building:b.id});g.addEventListener('click',select);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});});
 svgEye=svg('circle',{r:5,fill:'#167b76',stroke:'white','stroke-width':2},el);updateMini();
}
function updateMini(){
 if(!svgWedge)return;const p=cameraAnchor(),angle=state.mode==='window'?state.yaw:selectedWindow().bearing;
 const half=Math.atan(Math.tan(state.fov*DEG/2)*(camera?.aspect||1))/DEG,points=[`${p.x},${p.z}`];for(let i=0;i<=20;i++){const a=(angle-half+i/20*half*2)*DEG;points.push(`${p.x+Math.sin(a)*140},${p.z-Math.cos(a)*140}`);}svgWedge.setAttribute('d','M '+points.join(' L ')+' Z');svgEye.setAttribute('cx',p.x);svgEye.setAttribute('cy',p.z);
 document.querySelectorAll('.mini-building').forEach(g=>g.classList.toggle('active',Number(g.dataset.building)===state.building));
}
function setSky(index){
 state.day=index;const moods=[{top:'#6caccf',bottom:'#d9e8e7',fog:'#dae5df',sun:'#fff3d4',ambient:'#d9edfa',ground:'#bcc6ac',intensity:2.4},{top:'#6b91b1',bottom:'#edc4a8',fog:'#d4c5b4',sun:'#ffd7a1',ambient:'#c9cadc',ground:'#bdbaa0',intensity:1.7},{top:'#122837',bottom:'#6a8090',fog:'#71838a',sun:'#abbdd2',ambient:'#a3bbd3',ground:'#6c827b',intensity:.65}];
 const m=moods[index];sky.material.uniforms.topColor.value.set(m.top);sky.material.uniforms.bottomColor.value.set(m.bottom);scene.fog.color.set(m.fog);renderer.setClearColor(m.fog);sun.color.set(m.sun);sun.intensity=m.intensity*.53;ambient.color.set(m.ambient);ambient.intensity=index===2?.55:.8;groundMaterial.color.set(m.ground).convertSRGBToLinear();facadeMaterial.emissive.set(index===2?'#dcb56d':'#000000');facadeMaterial.emissiveIntensity=index===2?.35:0;
 $('dayToggle').textContent=['☀ 낮 색감','◒ 노을 색감','☾ 밤 색감'][index];updateSolarLighting();dirty=true;
}
function initScene(){
 window.CHAMPIONS_BOOT?.phase('3D 그래픽을 시작하고 있습니다');
 const mobile=window.innerWidth<=820||window.matchMedia('(pointer: coarse)').matches;
 renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:!mobile,alpha:false,preserveDrawingBuffer:true,powerPreference:mobile?'default':'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.25:1.75));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.fog=new THREE.Fog('#dce7e4',1200,24000);camera=new THREE.PerspectiveCamera(70,1,.2,40000);
 ambient=new THREE.HemisphereLight('#dbedfa','#969b78',1.35);scene.add(ambient);sun=new THREE.DirectionalLight('#fff3db',2.4);sun.position.set(-400,700,-300);scene.add(sun);
 sun.target.position.set(-150,0,0);scene.add(sun.target);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-520,right:520,top:520,bottom:-520,near:1,far:1700});sun.shadow.bias=-.00025;sun.shadow.normalBias=.8;
 const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{topColor:{value:new THREE.Color('#6caccf')},bottomColor:{value:new THREE.Color('#d9e8e7')}},vertexShader:'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){float h=normalize(vWorld+vec3(0.0,80.0,0.0)).y;gl_FragColor=vec4(mix(bottomColor,topColor,pow(max(h,0.0),0.55)),1.0);}'});
 sky=new THREE.Mesh(new THREE.SphereGeometry(35000,32,16),skyMat);scene.add(sky);
 groundMaterial=material('#bcc6ac');const ground=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.2;ground.receiveShadow=true;scene.add(ground);
 towerMaterial=material('#d3d6ca');facadeMaterial=new THREE.MeshStandardMaterial({map:facadeTexture(),roughness:.57,metalness:.1,side:THREE.DoubleSide});
 window.CHAMPIONS_BOOT?.phase('동·주변 건물·지형을 준비하고 있습니다');
 buildings.forEach(addTower);buildSurroundings();
 selectionRing=new THREE.Mesh(new THREE.RingGeometry(28,29.5,64),new THREE.MeshBasicMaterial({color:'#158878',side:THREE.DoubleSide,transparent:true,opacity:.9}));selectionRing.rotation.x=-Math.PI/2;scene.add(selectionRing);
 windowDot=new THREE.Mesh(new THREE.SphereGeometry(1.7,12,8),new THREE.MeshBasicMaterial({color:'#fff4ba'}));scene.add(windowDot);
 window.CHAMPIONS_BOOT?.phase('선택한 창과 사계절 일조를 계산하고 있습니다');
 updateWindowRecess();setSky(0);resize();updateCamera(1);
 window.CHAMPIONS_BOOT?.phase('첫 화면을 그리고 있습니다');
 renderer.render(scene,camera);
 if(renderer.getContext&&renderer.getContext().isContextLost())throw new Error('그래픽 연결이 중단되었습니다. 다른 앱을 닫고 웹주소를 다시 열어 주세요.');
 initialized=true;window.CHAMPIONS_BOOT?.ready();if(!window.CHAMPIONS_BOOT?.state.failed)$('loading').hidden=true;$('scene').dataset.ready='true';
 requestAnimationFrame(animate);
}
function resize(){if(!renderer)return;const width=$('viewer').clientWidth,height=$('viewer').clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;}
function updateCamera(amount){
 if(state.mode==='window'){
  // This is a view THROUGH the selected opening, not an unmodelled 360° room.
  const normal=facadeAnchor().bearing,offset=(normalize(state.yaw-normal)+180)%360-180;
  state.yaw=normal+clamp(offset,-85,85);amount=1;
  targetPosition.copy(cameraAnchor());const y=state.yaw*DEG,p=state.pitch*DEG;targetLook.copy(targetPosition).add(new THREE.Vector3(Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)).multiplyScalar(150));camera.fov=state.fov;
 }else{
  const el=(state.mode==='map'?89.95:state.orbitEl)*DEG,az=(state.mode==='map'?180:state.orbitYaw)*DEG,d=state.mode==='map'?670:state.orbitDistance;
  targetLook.copy(landCenter);targetPosition.set(landCenter.x+Math.sin(az)*Math.cos(el)*d,landCenter.y+Math.sin(el)*d,landCenter.z-Math.cos(az)*Math.cos(el)*d);camera.fov=state.mode==='map'?60:55;
 }
 if(!initialized||window.matchMedia('(prefers-reduced-motion: reduce)').matches)amount=1;
 cameraNow.lerp(targetPosition,amount);lookNow.lerp(targetLook,amount);camera.position.copy(cameraNow);camera.lookAt(lookNow);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 if(windowDot)windowDot.visible=state.mode!=='window';
 const heading=state.mode==='window'?state.yaw:state.mode==='map'?0:normalize(state.orbitYaw+180);
 $('bearing').textContent=`${compass(heading)} ${Math.round(normalize(heading))}°`;$('compassTicks').style.backgroundPositionX=`${-heading*2}px`;
 $('fovLabel').textContent=state.mode==='window'?`${state.fov}°`:'거리';
 $('scene').dataset.bearing=normalize(heading).toFixed(1);updateMini();updateDistanceCard();updateSunlightStudy();
}
function updateLabels(){
 const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight,occupied=[];
 labels.forEach(l=>{
  if(!state.labels||(l.group&&!l.group.visible)){l.el.style.display='none';return;}
  const labelPoint=l.position.clone();if(l.tower&&state.mode==='window')labelPoint.y=Math.min(labelPoint.y,camera.position.y+18);
  const projected=labelPoint.clone().project(camera);const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
  let visible=projected.z<1&&projected.z>-1&&x>30&&x<width-30&&y>92&&y<height-100;
  if(width>820&&x<340)visible=false;
  if(state.mode==='window'&&l.text===`${state.building}동`)visible=false;
  if(visible&&state.mode==='window'){
   const vec=labelPoint.clone().sub(camera.position),distance=vec.length();raycaster.set(camera.position,vec.normalize());raycaster.far=distance-2;const hits=raycaster.intersectObjects(surfaces.filter(visibleSurface),false);if(hits.some(hit=>hit.object!==l.tower&&hit.distance<distance-3))visible=false;
  }
  if(visible&&occupied.some(p=>Math.abs(p.x-x)<83&&Math.abs(p.y-y)<42))visible=false;
  l.el.style.display=visible?'block':'none';if(visible){l.el.style.left=`${x}px`;l.el.style.top=`${y}px`;occupied.push({x,y});}
 });
}
function animate(time){
 const dt=Math.min((time-lastTime)/1000,.08);lastTime=time;
 if(dirty||cameraNow.distanceTo(targetPosition)>.01||lookNow.distanceTo(targetLook)>.01){updateCamera(1-Math.exp(-dt*12));renderer.render(scene,camera);updateLabels();dirty=false;}
 requestAnimationFrame(animate);
}
function info(tab='about'){
 const dialog=$('info');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('aboutContent').hidden=tab!=='about';$('distanceContent').hidden=tab!=='distances';$('referenceImage').hidden=tab==='about'||tab==='distances';
 if(tab==='distances')renderDistances();
 if(!['about','distances'].includes(tab)){$('referenceImage').querySelector('img').src=SOURCE.images[tab];$('referenceCaption').textContent={map:'사용자가 제공한 주변 지도입니다. 지도에 적힌 예정 일정은 현재의 확정 일정으로 검증한 정보가 아닙니다.',site:'공식 단지 배치 자료입니다. 시뮬레이션은 이를 참고한 개략 모형입니다.',directions:'사용자가 제공한 타입별 방향 자료입니다. 평면도 이미지의 위쪽과 실제 북쪽은 다를 수 있습니다.'}[tab];}
 if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
}
function showModelPhoto(id=6){
 const data=SOURCE.modelPhotos,photo=data?.photos.find(p=>p.id===id);if(!photo)return false;
 const dialog=$('modelPhotoDialog');$('modelPhotoTitle').textContent=photo.title;
 $('modelPhotoTabs').replaceChildren(...data.photos.map(p=>{const b=document.createElement('button');b.textContent=p.id+'. '+p.title;b.className=p.id===id?'active':'';b.setAttribute('aria-pressed',String(p.id===id));b.onclick=()=>showModelPhoto(p.id);return b;}));
 $('modelPhotoImage').src=photo.image;$('modelPhotoImage').alt=`전시 모형 사진 ${id}: ${photo.title}`;
 $('modelPhotoCount').textContent=`${id} / ${data.photos.length}`;
 $('modelPhotoCaption').textContent=`${data.source} · ${photo.received||data.received} 접수 · 촬영일·모형 제작 기준일 미확인`;
 $('modelPhotoObserved').textContent=photo.observed;$('modelPhotoUse').textContent=photo.use;$('modelPhotoUnconfirmed').textContent=photo.unconfirmed;
 $('modelPhotoViewport').classList.remove('zoomed');$('modelPhotoViewport').scrollTop=0;$('modelPhotoViewport').scrollLeft=0;
 $('modelPhotoZoom').setAttribute('aria-pressed','false');$('modelPhotoZoom').textContent='크게 보기';
 $('modelPhotoScene').hidden=![5,6].includes(id);
 $('modelPhotoScene').textContent=id===5?'3D에서 동 사이 공간 비교 ↗':'3D에서 뒷줄 외측 배치 비교 ↗';
 dialog.dataset.photo=String(id);if(!dialog.open)dialog.showModal();dialog.scrollTop=0;return true;
}
function applyModelPhotoLink(){const value=new URLSearchParams(window.location?.hash?.slice(1)||'').get('modelPhoto');return /^\d+$/.test(value||'')?showModelPhoto(Number(value)):false;}
function compareModelPhotoScene(){
 const id=Number($('modelPhotoDialog').dataset.photo);if(![5,6].includes(id))return;
 // Comparison viewpoints use the existing model, not a recovered photo camera.
 $('modelPhotoDialog').close();state.orbitYaw=id===5?115:35;state.orbitEl=id===5?18:22;state.orbitDistance=540;
 state.mode='orbit';state.labels=true;$('labelToggle').classList.add('active');$('labelToggle').setAttribute('aria-pressed','true');updateModeUI();dirty=true;
 toast('사진 속 방향과 비교하는 단지 시점입니다. 촬영 위치를 복원한 화면이나 세대 창 조망은 아닙니다.');
}
function showPurchaseReview(section){
 const frame=$('purchaseReport'),jump=()=>{if(section)frame.contentWindow?.postMessage({kind:'champions-review-section',section},'*');};
 if(!frame.srcdoc){frame.onload=jump;frame.srcdoc=SOURCE.purchaseReview;}else jump();
 $('purchaseDialog').showModal();
}
function zoom(delta){if(state.mode==='window')state.fov=clamp(state.fov+delta,38,96);else if(state.mode==='orbit')state.orbitDistance=clamp(state.orbitDistance+delta*10,250,1300);else toast('위에서 보기는 고정 축척입니다. 단지 전체 보기에서 확대할 수 있어요.');dirty=true;}
function saveCapture(){
 renderer.render(scene,camera);const c=document.createElement('canvas');c.width=1600;c.height=Math.round(1600/camera.aspect);const ctx=c.getContext('2d');ctx.drawImage(renderer.domElement,0,0,c.width,c.height);ctx.fillStyle='rgba(15,37,43,.85)';ctx.fillRect(0,c.height-88,c.width,88);ctx.fillStyle='white';ctx.font='600 25px sans-serif';ctx.fillText(`챔피언스시티 ${state.building}동 ${unitNumber()}호 · ${state.type} · ${state.mode==='window'?selectedWindow().name:'단지 전체'}`,32,c.height-51);ctx.font='16px sans-serif';ctx.fillStyle='#d7e2dc';ctx.fillText(`실내 1m · 창 크기·벽 깊이 가정 · 실사 아님 · 2차 ${$('phase2').checked?phase2Config.floors+'층 / 폭 '+phase2Config.width+'m 가정':'미표시'} · 호텔 ${$('future').checked?$('hotelHeight').value+'m':'미표시'} / 공공시설 ${$('future').checked?$('publicFloors').value+'층':'미표시'} · 배치·높이 오차 있음`,32,c.height-22);
 const url=c.toDataURL('image/png');$('captureImage').src=url;$('captureDownload').href=url;$('captureDownload').download=`챔피언스시티_${state.building}동_${unitNumber()}호_예상조망.png`;$('captureDialog').showModal();
}
function events(){
 $('modelPhotos').onclick=()=>showModelPhoto();$('closeModelPhotos').onclick=()=>$('modelPhotoDialog').close();
 $('modelPhotoScene').onclick=compareModelPhotoScene;
 $('modelPhotoZoom').onclick=()=>{const viewport=$('modelPhotoViewport'),large=!viewport.classList.contains('zoomed');viewport.classList.toggle('zoomed',large);$('modelPhotoZoom').setAttribute('aria-pressed',String(large));$('modelPhotoZoom').textContent=large?'화면에 맞추기':'크게 보기';};
 $('purchaseReview').onclick=()=>showPurchaseReview();$('rrReview').onclick=()=>showPurchaseReview('rr-ranking');
 $('closePurchase').onclick=()=>$('purchaseDialog').close();
 window.addEventListener('message',e=>{
  if(e.source!==$('purchaseReport').contentWindow)return;
  if(e.data?.kind==='champions-model-photo'){if(Number.isInteger(e.data.photo)&&SOURCE.modelPhotos?.photos.some(p=>p.id===e.data.photo)){$('purchaseDialog').close();showModelPhoto(e.data.photo);}return;}
  if(e.data?.kind!=='champions-review-selection')return;
  const {building,line,floor,window:viewWindow}=e.data;
  const unit=allUnits.find(u=>u.building===building&&u.line===line&&u.floor===floor);
  if(!unit||!Number.isInteger(viewWindow)||!unitWindows[unit.type]?.some(w=>w.id===viewWindow))return;
  resetStudyAssumptions();setSelection({building,slot:unitSlot(unit),floor,window:viewWindow,mode:'window',eye:1.6,fov:70});
  $('purchaseDialog').close();if(e.data.showPlan)$('planDialog').showModal();toast('조망 비교 예시입니다. 잔여 확인 세대가 아닙니다.');
 });
 window.addEventListener('hashchange',()=>{if(!applyModelPhotoLink())applyViewLink();});
 $('copyViewLink').onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText($('viewLink').value);toast('현재 동·층·창 링크를 복사했습니다.');}catch{$('viewLink').focus();$('viewLink').select();toast('링크를 선택했습니다. Ctrl+C로 복사하세요.');}};
 buildings.forEach(b=>$('building').add(new Option(`${b.id}동`,b.id)));
 $('building').onchange=e=>setSelection({building:Number(e.target.value)});
 $('unitType').onchange=e=>setSelection({slot:e.target.value,window:1});
 $('eyeLevel').oninput=e=>setSelection({eye:Number(e.target.value)/100},false);
 $('eyeSeated').onclick=()=>setSelection({eye:1.15},false);$('eyeStanding').onclick=()=>setSelection({eye:1.6},false);
 ['phase2','phase2Floors','phase2Width'].forEach(id=>$(id).addEventListener('input',updatePhase2));$('lookPhase2').onclick=lookAtPhase2;
 $('landmark').replaceChildren(...landmarkTargets().map((l,i)=>new Option(l.name,String(i))));$('lookLandmark').onclick=lookAtLandmark;
 $('neighborhood').onchange=()=>{if(neighborhoodGroup)neighborhoodGroup.visible=$('neighborhood').checked;dirty=true;};
 $('terrain').onchange=()=>{if(terrainGroup)terrainGroup.visible=$('terrain').checked;dirty=true;};
 $('floor').oninput=e=>setSelection({floor:allowedFloors()[Number(e.target.value)]},false);
 $('floorDown').onclick=()=>{const f=allowedFloors();setSelection({floor:f[Math.max(0,f.indexOf(state.floor)-1)]},false);};
 $('floorUp').onclick=()=>{const f=allowedFloors();setSelection({floor:f[Math.min(f.length-1,f.indexOf(state.floor)+1)]},false);};
 const reset=()=>{setSelection({building:109,slot:'r1',floor:33,eye:1.6,window:3,mode:'window',fov:70});document.querySelector('.panel-body').scrollTop=0;toast('109동 3301호 · 거실 남쪽 창으로 돌아왔습니다.');};$('reset').onclick=reset;$('home').onclick=e=>{e.preventDefault();reset();};
 $('planToggle').onclick=()=>{const hidden=$('floorPlan').hidden;$('floorPlan').hidden=!hidden;$('planToggle').textContent=hidden?'평면도 접기':'평면도 보기';$('planToggle').setAttribute('aria-expanded',String(hidden));};
 $('planExpand').onclick=()=>$('planDialog').showModal();$('closePlan').onclick=()=>$('planDialog').close();
 ['future','mall','hotelHeight','publicFloors'].forEach(id=>$(id).addEventListener('input',updateFuture));
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='window')centerSelectedWindow();updateModeUI();});
 $('frameToggle').onclick=()=>{$('openingDetails').open=!$('openingDetails').open;$('openingDetails').scrollIntoView?.({block:'center',behavior:'smooth'});toast('창 크기와 벽 깊이는 비교용 가정입니다. 실제 창호 치수는 확인되지 않았습니다.');};
 $('centerWindow').onclick=()=>{state.mode='window';centerSelectedWindow();updateModeUI();toast('실내 1m 위치에서 선택 창의 가운데와 정면에 맞췄습니다.');};
 $('labelToggle').onclick=()=>{state.labels=!state.labels;$('labelToggle').classList.toggle('active',state.labels);$('labelToggle').setAttribute('aria-pressed',String(state.labels));dirty=true;};
 $('dayToggle').onclick=()=>{setSky((state.day+1)%3);toast('하늘 색감만 바꿉니다. 일조 계산은 선택한 계절 대표일을 따릅니다.');};
 $('solarSeason').onchange=e=>{solarSeason=e.target.value;analysisKey='';updateSolarLighting();updateSunlightStudy();};
 $('solarTime').oninput=e=>{solarMinute=clamp(Number(e.target.value),300,1200);updateSolarLighting();};
 for(const id of ['openingWidth','openingSill','openingTop','wallDepth'])$(id).onchange=()=>{
  opening.width=clamp(Number($('openingWidth').value)||2.4,1,6);
  opening.sill=clamp(Number($('openingSill').value)||0,0,1.2);
  opening.top=clamp(Number($('openingTop').value)||2.2,opening.sill+.5,2.4);
  opening.wallDepth=clamp(Number($('wallDepth').value)||.2,.1,.4);
  openingOverrides.set(`${state.type}:${state.window}`,{...opening});openingSource='사용자가 조절한 비교 가정';
  $('openingWidth').value=opening.width;$('openingSill').value=opening.sill;$('openingTop').value=opening.top;$('wallDepth').value=opening.wallDepth;
  updateWindowRecess();centerSelectedWindow();renderControls();analysisKey='';dirty=true;
 };
 $('zoomIn').onclick=()=>zoom(-5);$('zoomOut').onclick=()=>zoom(5);$('reference').onclick=()=>info();$('mapReference').onclick=()=>info('map');$('closeInfo').onclick=()=>$('info').close();
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>info(b.dataset.tab));
 $('info').addEventListener('click',e=>{const r=$('info').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info').close();});
 $('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await $('viewer').requestFullscreen();else await document.exitFullscreen();}catch{toast('브라우저의 전체 화면 기능(F11)을 이용해 주세요.');}};
 $('panelToggle').onclick=()=>{$('controls').classList.toggle('collapsed');$('panelToggle').setAttribute('aria-expanded',String(!$('controls').classList.contains('collapsed')));};
 $('capture').onclick=saveCapture;
 $('closeCapture').onclick=()=>$('captureDialog').close();
 $('distanceDetails').onclick=()=>info('distances');
 let dragging=false,lastX=0,lastY=0;
 $('scene').addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;lastX=e.clientX;lastY=e.clientY;$('scene').setPointerCapture(e.pointerId);$('scene').classList.add('dragging');$('scene').focus({preventScroll:true});});
 $('scene').addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;if(state.mode==='window'){state.yaw-=dx*.16;state.pitch=clamp(state.pitch+dy*.13,-78,65);}else if(state.mode==='orbit'){state.orbitYaw-=dx*.2;state.orbitEl=clamp(state.orbitEl+dy*.13,12,85);}dirty=true;});
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('scene').addEventListener(name,()=>{dragging=false;$('scene').classList.remove('dragging');}));
 $('scene').addEventListener('wheel',e=>{e.preventDefault();zoom(Math.sign(e.deltaY)*3);},{passive:false});
 $('scene').addEventListener('keydown',e=>{let handled=true;const orbit=state.mode==='orbit';if(e.key==='ArrowLeft'){if(orbit)state.orbitYaw+=4;else state.yaw-=4;}else if(e.key==='ArrowRight'){if(orbit)state.orbitYaw-=4;else state.yaw+=4;}else if(e.key==='ArrowUp'){if(orbit)state.orbitEl=clamp(state.orbitEl+3,12,85);else state.pitch=clamp(state.pitch+3,-78,65);}else if(e.key==='ArrowDown'){if(orbit)state.orbitEl=clamp(state.orbitEl-3,12,85);else state.pitch=clamp(state.pitch-3,-78,65);}else if(e.key==='+'||e.key==='=')zoom(-5);else if(e.key==='-')zoom(5);else handled=false;if(handled){e.preventDefault();dirty=true;}});
 window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(!document.hidden)dirty=true;});
 $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();$('error').hidden=false;$('errorDetail').textContent='그래픽 연결이 중단되었습니다. 페이지를 새로고침해 주세요.';});
 if(window.innerWidth<=820){$('controls').classList.add('collapsed');$('panelToggle').setAttribute('aria-expanded','false');}
}
try { events();window.CHAMPIONS_BOOT?.phase('동·층·창 선택을 연결하고 있습니다');buildMini();setSelection(readViewLink()||{});initScene();updateSelectionMarker();if(!applyModelPhotoLink()&&new URLSearchParams(window.location?.hash?.slice(1)||'').get('plan')==='1')$('planDialog').showModal(); }
catch(error) {if(window.CHAMPIONS_BOOT)window.CHAMPIONS_BOOT.fail(error);else{$('loading').hidden=true;$('error').hidden=false;$('errorDetail').textContent=error.message;}console.error(error);}
})();
