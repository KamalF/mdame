import{re}from"./main-w9thnv72.js";import{e,n,R,B,w,k,T,S,E,_,P,i,we,wn,Ei,ht,W,Y}from"./main-q2azm01z.js";import{oe}from"./main-yve9awxq.js";import{Vt}from"./main-64g7jfxa.js";import{xt}from"./main-22q7sghg.js";function tt(t,l){return l<t?-1:l>t?1:l>=t?0:NaN}function et(t){return t}function rt(){var t=et,l=tt,D=null,F=we(0),g=we(wn),h=we(0);function s(r){var o,u=(r=Ei(r)).length,m,b,L=0,v=Array(u),c=Array(u),O=+F.apply(this,arguments),G=Math.min(wn,Math.max(-wn,g.apply(this,arguments)-O)),H,U=Math.min(Math.abs(G)/u,h.apply(this,arguments)),p=U*(G<0?-1:1),z;for(o=0;o<u;++o)if((z=c[v[o]=o]=+t(r[o],o,r))>0)L+=z;if(l!=null)v.sort(function(I,x){return l(c[I],c[x])});else if(D!=null)v.sort(function(I,x){return D(r[I],r[x])});for(o=0,b=L?(G-u*p)/L:0;o<u;++o,O=H)m=v[o],z=c[m],H=O+(z>0?z*b:0)+p,c[m]={data:r[m],index:o,value:z,startAngle:O,endAngle:H,padAngle:U};return c}return s.value=function(r){return arguments.length?(t=typeof r==="function"?r:we(+r),s):t},s.sortValues=function(r){return arguments.length?(l=r,D=null,s):l},s.sort=function(r){return arguments.length?(D=r,l=null,s):D},s.startAngle=function(r){return arguments.length?(F=typeof r==="function"?r:we(+r),s):F},s.endAngle=function(r){return arguments.length?(g=typeof r==="function"?r:we(+r),s):g},s.padAngle=function(r){return arguments.length?(h=typeof r==="function"?r:we(+r),s):h},s}var ct=R.pie,at={sections:new Map,showData:!1,config:ct},{sections:Z,showData:nt}=at,vt=structuredClone(ct),St=e(()=>structuredClone(vt),"getConfig"),yt=e(()=>{Z=new Map,nt=at.showData,w()},"clear"),wt=e(({label:t,value:l})=>{if(l<0)throw Error(`"${t}" has invalid value: ${l}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);if(!Z.has(t))Z.set(t,l),n.debug(`added new section: ${t}, with value: ${l}`)},"addSection"),At=e(()=>Z,"getSections"),Ct=e((t)=>{nt=t},"setShowData"),$t=e(()=>nt,"getShowData"),ut={getConfig:St,clear:yt,setDiagramTitle:_,getDiagramTitle:P,setAccTitle:k,getAccTitle:T,setAccDescription:S,getAccDescription:E,addSection:wt,getSections:At,setShowData:Ct,getShowData:$t},Dt=e((t,l)=>{re(t,l),l.setShowData(t.showData),t.sections.map(l.addSection)},"populateDb"),Tt={parse:e(async(t)=>{let l=await oe("pie",t);n.debug(l),Dt(l,ut)},"parse")},bt=e((t)=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),kt=bt,zt=e((t)=>{let l=[...t.values()].reduce((g,h)=>g+h,0),D=[...t.entries()].map(([g,h])=>({label:g,value:h})).filter((g)=>g.value/l*100>=1);return rt().value((g)=>g.value).sort(null)(D)},"createPieArcs"),Et=e((t,l,D,F)=>{n.debug(`rendering pie chart
`+t);let g=F.db,h=i(),s=W(g.getConfig(),h.pie),r=40,o=18,u=4,m=450,b=m,L=Y(l),v=L.append("g");v.attr("transform","translate("+b/2+","+m/2+")");let{themeVariables:c}=h,[O]=ht(c.pieOuterStrokeWidth);O??=2;let{legendPosition:G,textPosition:H}=s,U=s.donutHole>0&&s.donutHole<=0.9?s.donutHole:0,p=Math.min(b,m)/2-r,z=Vt().innerRadius(U*p).outerRadius(p),I=Vt().innerRadius(p*H).outerRadius(p*H),x=v.append("g");x.append("circle").attr("cx",0).attr("cy",0).attr("r",p+O/2).attr("class","pieOuterCircle");let j=g.getSections(),gt=zt(j),dt=[c.pie1,c.pie2,c.pie3,c.pie4,c.pie5,c.pie6,c.pie7,c.pie8,c.pie9,c.pie10,c.pie11,c.pie12],q=0;j.forEach((a)=>{q+=a});let it=gt.filter((a)=>(a.data.value/q*100).toFixed(0)!=="0"),J=xt(dt).domain([...j.keys()]);x.selectAll("mySlices").data(it).enter().append("path").attr("d",z).attr("fill",(a)=>J(a.data.label)).attr("class",(a)=>{let d="pieCircle";if(s.highlightSlice==="hover")d+=" highlightedOnHover";else if(s.highlightSlice===a.data.label)d+=" highlighted";return d}),x.selectAll("mySlices").data(it).enter().append("text").text((a)=>(a.data.value/q*100).toFixed(0)+"%").attr("transform",(a)=>"translate("+I.centroid(a)+")").style("text-anchor","middle").attr("class","slice");let pt=v.append("text").text(g.getDiagramTitle()).attr("x",0).attr("y",-(m-50)/2).attr("class","pieTitleText"),V=[...j.entries()].map(([a,d])=>({label:a,value:d})),M=v.selectAll(".legend").data(V).enter().append("g").attr("class","legend");M.append("rect").attr("width",o).attr("height",o).style("fill",(a)=>J(a.label)).style("stroke",(a)=>J(a.label)),M.append("text").attr("x",o+u).attr("y",o-u).text((a)=>{if(g.getShowData())return`${a.label} [${a.value}]`;return a.label});let N=Math.max(...M.selectAll("text").nodes().map((a)=>a?.getBoundingClientRect().width??0)),X=m,K=b+r,f=o+u,Q=V.length*f;switch(G){case"center":M.attr("transform",(a,d)=>{let y=f*V.length/2,A=-N/2-(o+u),C=d*f-y;return"translate("+A+","+C+")"});break;case"top":X+=Q,M.attr("transform",(a,d)=>{let y=p,A=-N/2-(o+u),C=d*f-y;return`translate(${A}, ${C})`}),x.attr("transform",()=>`translate(0, ${Q+f})`);break;case"bottom":X+=Q,M.attr("transform",(a,d)=>{let y=-p-f,A=-N/2-(o+u),C=d*f-y;return"translate("+A+","+C+")"});break;case"left":K+=o+u+N,M.attr("transform",(a,d)=>{let y=f*V.length/2,A=-p-(o+u),C=d*f-y;return"translate("+A+","+C+")"}),x.attr("transform",()=>`translate(${N+o+u}, 0)`);break;case"right":default:K+=o+u+N,M.attr("transform",(a,d)=>{let y=f*V.length/2,A=12*o,C=d*f-y;return"translate("+A+","+C+")"});break}let ot=pt.node()?.getBoundingClientRect().width??0,ft=b/2-ot/2,mt=b/2+ot/2,lt=Math.min(0,ft),st=Math.max(K,mt)-lt;L.attr("viewBox",`${lt} 0 ${st} ${X}`),B(L,X,st,s.useMaxWidth)},"draw"),Mt={draw:Et},Jt={parser:Tt,db:ut,renderer:Mt,styles:kt};export{Jt as diagram};
