/* Approximate geometry study, NOT measured daylight, illuminance or a legal
 * sunlight assessment. Coordinates: x east, y up, z south; metres; azimuth
 * clockwise from north. Solar equations: NOAA General Solar Position
 * Calculations, https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * Context/limits: https://gml.noaa.gov/grad/solcalc/calcdetails.html
 * We use the published fractional-year approximation, WITHOUT refraction,
 * weather, glass transmission, mullions, interior reflections or overhangs.
 * Geometry/apertures in the viewer are illustrative, not survey dimensions.
 */
(function(root){
 'use strict';
 const DEG=Math.PI/180, EPS=1e-7;
 const defaults=Object.freeze({lat:35.16,lon:126.89,utcOffset:9,stepMinutes:10,
  width:2.4,height:1.8,sill:.6,setback:1,eyeHeight:1.6,wallDepth:.2});
 const mod=(n,m)=>(n%m+m)%m;
 function finite(n,name){if(!Number.isFinite(n))throw new TypeError(name+' must be finite');return n;}
 function validDate(year,month,day){
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw new RangeError('Invalid calendar date');
  return d;
 }
 function sunPosition({year,month,day,hour=12,minute=0,lat=defaults.lat,lon=defaults.lon,utcOffset=defaults.utcOffset}){
  const date=validDate(year,month,day);
  [hour,minute,lat,lon,utcOffset].forEach((v,i)=>finite(v,['hour','minute','lat','lon','utcOffset'][i]));
  if(lat < -90||lat > 90||lon < -180||lon > 180)throw new RangeError('Latitude/longitude out of range');
  const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  const doy=(date.getTime()-Date.UTC(year,0,1))/86400000+1;
  const gamma=2*Math.PI/days*(doy-1+(hour+minute/60-12)/24);
  const equationOfTime=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
  const declination=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
  const hourAngle=(mod(hour*60+minute+equationOfTime+4*lon-60*utcOffset,1440)/4-180)*DEG;
  const phi=lat*DEG;
  // Direct ENU vector avoids the quadrant ambiguity of acos(azimuth).
  const x=-Math.cos(declination)*Math.sin(hourAngle);
  const north=Math.cos(phi)*Math.sin(declination)-Math.sin(phi)*Math.cos(declination)*Math.cos(hourAngle);
  const y=Math.sin(phi)*Math.sin(declination)+Math.cos(phi)*Math.cos(declination)*Math.cos(hourAngle);
  const elevation=Math.asin(Math.max(-1,Math.min(1,y)))/DEG;
  return {azimuth:mod(Math.atan2(x,north)/DEG,360),elevation,direction:{x,y,z:-north},declination:declination/DEG,equationOfTime};
 }
 function windowGeometry(w){
  const out={...defaults,...w};
  out.floorY=out.floorY??((out.y??out.eyeHeight)-out.eyeHeight);
  out.y=out.y??out.floorY+out.eyeHeight;
  for(const k of ['x','z','y','bearing','width','height','sill','floorY','setback','wallDepth'])finite(out[k],k);
  if(out.width<=0||out.height<=0||out.setback<=0||out.wallDepth<0||out.wallDepth>=out.setback)throw new RangeError('Invalid window dimensions: 0 <= wallDepth < setback required');
  out.normal={x:Math.sin(out.bearing*DEG),y:0,z:-Math.cos(out.bearing*DEG)};
  out.tangent={x:Math.cos(out.bearing*DEG),y:0,z:Math.sin(out.bearing*DEG)};
  out.eye={x:out.x-out.normal.x*out.setback,y:out.y,z:out.z-out.normal.z*out.setback};
  return out;
 }
 function apertureRay(window,direction){
  const w=windowGeometry(window),d=direction,n=w.normal;
  const dot=d.x*n.x+d.z*n.z;
  if(d.y<=0)return {passes:false,reason:'below-horizon',eye:w.eye};
  if(dot<=EPS)return {passes:false,reason:'sun-behind-window',eye:w.eye};
  const t=w.setback/dot;
  const hit={x:w.eye.x+d.x*t,y:w.eye.y+d.y*t,z:w.eye.z+d.z*t};
  const lateral=(hit.x-w.x)*w.tangent.x+(hit.z-w.z)*w.tangent.z;
  const bottom=w.floorY+w.sill,top=bottom+w.height;
  // A 20 cm illustrative wall return, NOT a verified structural wall depth.
  // Both its exterior aperture and interior jamb must admit the ray.
  const innerT=(w.setback-w.wallDepth)/dot;
  const innerHit={x:w.eye.x+d.x*innerT,y:w.eye.y+d.y*innerT,z:w.eye.z+d.z*innerT};
  const innerLateral=(innerHit.x-w.x)*w.tangent.x+(innerHit.z-w.z)*w.tangent.z;
  let reason=null;
  if(Math.abs(lateral)>w.width/2+EPS)reason='beside-window';
  else if(hit.y>top+EPS)reason='above-window';
  else if(hit.y<bottom-EPS)reason='below-window';
  else if(Math.abs(innerLateral)>w.width/2+EPS||innerHit.y>top+EPS||innerHit.y<bottom-EPS)reason='inner-jamb';
  // Start AFTER the glazing in the same direction. This omits only the local
  // wall exit, not any other protruding wing of the SAME building.
  const advance=.02/dot;
  const origin={x:hit.x+d.x*advance,y:hit.y+d.y*advance,z:hit.z+d.z*advance};
  return {passes:!reason,reason,eye:w.eye,hit,innerHit,origin,lateral,top,bottom};
 }
 function inside(x,z,poly){
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
 }
 function obstacleDistance(origin,d,obstacle){
  const poly=obstacle.poly;
  if(!Array.isArray(poly)||poly.length<3)return Infinity;
  const top=typeof obstacle.height==='function'?obstacle.height():obstacle.height;
  const bottom=typeof obstacle.base==='function'?obstacle.base():(obstacle.base??0);
  if(!Number.isFinite(top)||top<=bottom)return Infinity;
  let low=0,high=Infinity;
  if(Math.abs(d.y)<EPS){if(origin.y<bottom||origin.y>top)return Infinity;}
  else {const t1=(bottom-origin.y)/d.y,t2=(top-origin.y)/d.y;low=Math.max(0,Math.min(t1,t2));high=Math.max(t1,t2);if(high<low)return Infinity;}
  const cuts=[0];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ez=b[1]-a[1];
   const den=d.x*ez-d.z*ex;if(Math.abs(den)<EPS)continue;
   const ax=a[0]-origin.x,az=a[1]-origin.z;
   const t=(ax*ez-az*ex)/den,u=(ax*d.z-az*d.x)/den;
   if(t>EPS&&u>=-EPS&&u<=1+EPS)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);cuts.push(Infinity);
  for(let i=0;i<cuts.length-1;i++){
   const a=Math.max(cuts[i],low),b=Math.min(cuts[i+1],high);
   if(b<a+EPS)continue;
   const mid=Number.isFinite(b)?(a+b)/2:a+1;
   if(inside(origin.x+d.x*mid,origin.z+d.z*mid,poly))return a;
  }
  return Infinity;
 }
 function firstBlocker(origin,direction,obstacles=[]){
  let best=null;
  for(const o of obstacles){
   if(o.visible===false)continue;
   const distance=obstacleDistance(origin,direction,o);
   if(Number.isFinite(distance)&&(!best||distance<best.distance))best={id:o.id,name:o.name||String(o.id??'건물'),distance};
  }
  return best;
 }
 const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.round(m%60)).padStart(2,'0')}`;
 function intervals(samples,key){
  const out=[];
  for(const s of samples){if(!s[key])continue;const last=out[out.length-1];if(last&&last.endMinute===s.startMinute)last.endMinute=s.endMinute;else out.push({startMinute:s.startMinute,endMinute:s.endMinute});}
  return out.map(s=>({...s,start:clock(s.startMinute),end:clock(s.endMinute),minutes:s.endMinute-s.startMinute}));
 }
 function assessWindow({date,window,obstacles=[],stepMinutes=defaults.stepMinutes,startMinute=0,endMinute=1440,lat=defaults.lat,lon=defaults.lon,utcOffset=defaults.utcOffset,sensitivity=true}){
  if(!date)throw new TypeError('date is required');
  validDate(date.year,date.month,date.day);
  if(!Number.isInteger(stepMinutes)||stepMinutes<1||stepMinutes>60||startMinute<0||endMinute>1440||startMinute>=endMinute)throw new RangeError('Invalid sampling interval');
  const w=windowGeometry(window),samples=[];
  const widths=sensitivity?[{name:'작은 창 가정',width:1.8,sill:.8,height:1.5},{name:'큰 창 가정',width:3.2,sill:.5,height:2}]:[];
  const bounds=widths.map(v=>({...v,pointSunMinutes:0}));
  let pointSunMinutes=0,exteriorSunMinutes=0,frontSunMinutes=0;
  for(let start=startMinute;start<endMinute;start+=stepMinutes){
   const end=Math.min(start+stepMinutes,endMinute),mid=(start+end)/2,duration=end-start;
   const sun=sunPosition({...date,hour:Math.floor(mid/60),minute:mid%60,lat,lon,utcOffset}),d=sun.direction;
   const front=sun.elevation>0&&d.x*w.normal.x+d.z*w.normal.z>EPS;
   const exteriorOrigin={x:w.x+w.normal.x*.02,y:w.y,z:w.z+w.normal.z*.02};
   const exteriorBlocker=front?firstBlocker(exteriorOrigin,d,obstacles):null;
   const exterior=front&&!exteriorBlocker;
   const aperture=apertureRay(w,d);
   const blocker=aperture.passes?firstBlocker(aperture.origin,d,obstacles):null;
   const point=aperture.passes&&!blocker;
   if(front)frontSunMinutes+=duration;if(exterior)exteriorSunMinutes+=duration;if(point)pointSunMinutes+=duration;
   for(const bound of bounds){const a=apertureRay({...w,...bound},d);if(a.passes&&!firstBlocker(a.origin,d,obstacles))bound.pointSunMinutes+=duration;}
   samples.push({startMinute:start,endMinute:end,minute:mid,time:clock(start),azimuth:sun.azimuth,elevation:sun.elevation,front,exterior,point,reason:point?'direct':blocker?'building':aperture.reason,blocker,exteriorBlocker});
  }
  return {date:{...date},pointSunMinutes,exteriorSunMinutes,frontSunMinutes,intervals:intervals(samples,'point'),exteriorIntervals:intervals(samples,'exterior'),samples,
   assumptions:{lat,lon,utcOffset,stepMinutes,width:w.width,sill:w.sill,height:w.height,setback:w.setback,wallDepth:w.wallDepth,eyeHeight:w.y-w.floorY,floorY:w.floorY,
    method:`${stepMinutes}분 구간의 중간 시각 표본`,
    label:`창에서 실내 ${w.setback}m 지점의 눈높이 한 점에 직사광이 닿을 수 있는 모형 시간`,
    limitations:'실측·법정 일조시간·실내 밝기가 아님. 창 크기, 벽/발코니/차양, 미래 건물 위치와 높이, 날씨는 실제와 다를 수 있음.'},
   sensitivity:bounds.map(b=>({name:b.name,width:b.width,sill:b.sill,height:b.height,pointSunMinutes:b.pointSunMinutes}))};
 }
 function assessSeasons(options){
  const year=options.year??2026;
  const dates=[{key:'spring',label:'봄 대표일',year,month:3,day:20},{key:'summer',label:'여름 대표일',year,month:6,day:21},{key:'autumn',label:'가을 대표일',year,month:9,day:23},{key:'winter',label:'겨울 대표일',year,month:12,day:22}];
  return dates.map(date=>({key:date.key,label:date.label,...assessWindow({...options,date})}));
 }
 const api=Object.freeze({defaults,sunPosition,windowGeometry,apertureRay,firstBlocker,assessWindow,assessSeasons});
 root.SUNLIGHT=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
