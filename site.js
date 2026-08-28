window.WF = (() => {
  const money = (v, digits=0) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:digits}).format(Number(v)||0);
  const number = v => new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Number(v)||0);
  const pct = (v,d=1) => (Number(v)>=0?"+":"") + Number(v).toFixed(d) + "%";

  function lineChart(el, rows, series, opts={}) {
    if(!el || !rows?.length) return;
    const W=1000,H=390,p={l:62,r:24,t:22,b:48};
    const all=rows.flatMap(r=>series.map(s=>Number(r[s.key]))).filter(Number.isFinite);
    const yMin=opts.yMin ?? Math.min(...all), yMax=opts.yMax ?? Math.max(...all), span=Math.max(1,yMax-yMin);
    const lo=opts.yMin ?? Math.floor((yMin-span*.08)/10)*10, hi=opts.yMax ?? Math.ceil((yMax+span*.08)/10)*10;
    const xVals=rows.map((r,i)=>opts.xValueKey?Number(r[opts.xValueKey]):i);
    const xMin=Math.min(...xVals),xMax=Math.max(...xVals),xSpan=Math.max(1,xMax-xMin);
    const x=i=>p.l+(xVals[i]-xMin)*(W-p.l-p.r)/xSpan;
    const y=v=>p.t+(hi-v)*(H-p.t-p.b)/(hi-lo);
    const ns="http://www.w3.org/2000/svg";el.innerHTML="";
    const add=(tag,attrs={},parent=el)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.appendChild(n);return n};
    const tickCount=4;
    for(let i=0;i<=tickCount;i++){
      const val=lo+(hi-lo)*i/tickCount,yy=y(val);
      add("line",{x1:p.l,x2:W-p.r,y1:yy,y2:yy,stroke:"#d8d4c9","stroke-width":"1"});
      const t=add("text",{x:p.l-12,y:yy+4,fill:"#737871","font-size":"12","text-anchor":"end"});t.textContent=opts.yFormatter?opts.yFormatter(val):Math.round(val);
    }
    const desired=window.innerWidth<=640?5:7,step=Math.max(1,Math.ceil((rows.length-1)/(desired-1)));
    rows.forEach((r,i)=>{if(i===0||i===rows.length-1||i%step===0){const t=add("text",{x:x(i),y:H-17,fill:"#737871","font-size":"12","text-anchor":i===0?"start":i===rows.length-1?"end":"middle"});t.textContent=r.label}});
    series.forEach(s=>{const d=rows.map((r,i)=>(i?"L":"M")+" "+x(i)+" "+y(Number(r[s.key]))).join(" ");add("path",{d,fill:"none",stroke:s.color,"stroke-width":opts.strokeWidth||4,"stroke-linecap":"round","stroke-linejoin":"round"})});
    const focus=add("g",{"aria-hidden":"true"});focus.style.display="none";
    const focusLine=add("line",{y1:p.t,y2:H-p.b,stroke:"#8c928c","stroke-width":"1","stroke-dasharray":"4 4"},focus);
    const circles=series.map(s=>add("circle",{r:"6",fill:s.color,stroke:"#fbfaf6","stroke-width":"3"},focus));
    function setFocus(i){
      i=Math.max(0,Math.min(rows.length-1,Number(i)||0));const r=rows[i],xx=x(i);focus.style.display="";
      focusLine.setAttribute("x1",xx);focusLine.setAttribute("x2",xx);
      circles.forEach((c,j)=>{c.setAttribute("cx",xx);c.setAttribute("cy",y(Number(r[series[j].key])))});
      if(opts.onFocus)opts.onFocus(r,i);
      const scrub=document.querySelector('[data-scrubber-for="'+el.id+'"]');if(scrub)scrub.value=i;
    }
    rows.forEach((r,i)=>{
      const left=i===0?p.l:(x(i-1)+x(i))/2,right=i===rows.length-1?W-p.r:(x(i)+x(i+1))/2;
      const hit=add("rect",{x:left,y:p.t,width:Math.max(1,right-left),height:H-p.t-p.b,fill:"transparent"});hit.style.cursor="crosshair";
      ["pointerenter","pointerdown"].forEach(ev=>hit.addEventListener(ev,()=>setFocus(i)));
    });
    const scrub=document.querySelector('[data-scrubber-for="'+el.id+'"]');if(scrub){scrub.max=rows.length-1;scrub.addEventListener("input",e=>setFocus(e.target.value))}
    setFocus(rows.length-1);
  }

  function mortgagePayment(principal,annualRate,years=30){
    const r=annualRate/12,n=years*12;if(!r)return principal/n;
    return principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  }

  function monthsToLtv80(price,downPct,annualRate,appreciation=.03){
    let loan=price*(1-downPct),payment=mortgagePayment(loan,annualRate,30),r=annualRate/12;
    for(let m=1;m<=360;m++){loan=loan*(1+r)-payment;const value=price*Math.pow(1+appreciation,m/12);if(loan/value<=.80)return m}
    return 360;
  }

  return {money,number,pct,lineChart,mortgagePayment,monthsToLtv80};
})();