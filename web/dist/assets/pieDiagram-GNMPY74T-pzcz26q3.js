import{re}from"./main-7m5zb1s6.js";import{e,n,Q,B,w,k,S,T,E,P,C,i,xe,bn,$i,G,ft,Y}from"./main-8rxmk9vd.js";import{le}from"./main-e6vgd375.js";import{jt}from"./main-dd9tmjmf.js";import{xt}from"./main-22q7sghg.js";function tt(t,l){return l<t?-1:l>t?1:l>=t?0:NaN}function et(t){return t}function rt(){var t=et,l=tt,b=null,W=xe(0),g=xe(bn),h=xe(0);function s(r){var o,u=(r=$i(r)).length,m,z,L=0,v=Array(u),c=Array(u),O=+W.apply(this,arguments),N=Math.min(bn,Math.max(-bn,g.apply(this,arguments)-O)),F,V=Math.min(Math.abs(N)/u,h.apply(this,arguments)),p=V*(N<0?-1:1),M;for(o=0;o<u;++o)if((M=c[v[o]=o]=+t(r[o],o,r))>0)L+=M;if(l!=null)v.sort(function(_,x){return l(c[_],c[x])});else if(b!=null)v.sort(function(_,x){return b(r[_],r[x])});for(o=0,z=L?(N-u*p)/L:0;o<u;++o,O=F)m=v[o],M=c[m],F=O+(M>0?M*z:0)+p,c[m]={data:r[m],index:o,value:M,startAngle:O,endAngle:F,padAngle:V};return c}return s.value=function(r){return arguments.length?(t=typeof r==="function"?r:xe(+r),s):t},s.sortValues=function(r){return arguments.length?(l=r,b=null,s):l},s.sort=function(r){return arguments.length?(b=r,l=null,s):b},s.startAngle=function(r){return arguments.length?(W=typeof r==="function"?r:xe(+r),s):W},s.endAngle=function(r){return arguments.length?(g=typeof r==="function"?r:xe(+r),s):g},s.padAngle=function(r){return arguments.length?(h=typeof r==="function"?r:xe(+r),s):h},s}var ct=Q.pie,at={sections:new Map,showData:!1,config:ct},{sections:X,showData:nt}=at,vt=structuredClone(ct),St=e(()=>structuredClone(vt),"getConfig"),yt=e(()=>{X=new Map,nt=at.showData,w()},"clear"),wt=e(({label:t,value:l})=>{if(l<0)throw Error(`"${t}" has invalid value: ${l}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);if(!X.has(t))X.set(t,l),n.debug(`added new section: ${t}, with value: ${l}`)},"addSection"),At=e(()=>X,"getSections"),Ct=e((t)=>{nt=t},"setShowData"),$t=e(()=>nt,"getShowData"),ut={getConfig:St,clear:yt,setDiagramTitle:P,getDiagramTitle:C,setAccTitle:k,getAccTitle:S,setAccDescription:T,getAccDescription:E,addSection:wt,getSections:At,setShowData:Ct,getShowData:$t},Dt=e((t,l)=>{re(t,l),l.setShowData(t.showData),t.sections.map(l.addSection)},"populateDb"),Tt={parse:e(async(t)=>{let l=await le("pie",t);n.debug(l),Dt(l,ut)},"parse")},bt=e((t)=>`
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
`,"getStyles"),kt=bt,zt=e((t)=>{let l=[...t.values()].reduce((g,h)=>g+h,0),b=[...t.entries()].map(([g,h])=>({label:g,value:h})).filter((g)=>g.value/l*100>=1);return rt().value((g)=>g.value).sort(null)(b)},"createPieArcs"),Et=e((t,l,b,W)=>{n.debug(`rendering pie chart
`+t);let g=W.db,h=i(),s=Y(g.getConfig(),h.pie),r=40,o=18,u=4,m=450,z=m,L=G(l),v=L.append("g");v.attr("transform","translate("+z/2+","+m/2+")");let{themeVariables:c}=h,[O]=ft(c.pieOuterStrokeWidth);O??=2;let{legendPosition:N,textPosition:F}=s,V=s.donutHole>0&&s.donutHole<=0.9?s.donutHole:0,p=Math.min(z,m)/2-r,M=jt().innerRadius(V*p).outerRadius(p),_=jt().innerRadius(p*F).outerRadius(p*F),x=v.append("g");x.append("circle").attr("cx",0).attr("cy",0).attr("r",p+O/2).attr("class","pieOuterCircle");let U=g.getSections(),gt=zt(U),dt=[c.pie1,c.pie2,c.pie3,c.pie4,c.pie5,c.pie6,c.pie7,c.pie8,c.pie9,c.pie10,c.pie11,c.pie12],Z=0;U.forEach((a)=>{Z+=a});let it=gt.filter((a)=>(a.data.value/Z*100).toFixed(0)!=="0"),q=xt(dt).domain([...U.keys()]);x.selectAll("mySlices").data(it).enter().append("path").attr("d",M).attr("fill",(a)=>q(a.data.label)).attr("class",(a)=>{let d="pieCircle";if(s.highlightSlice==="hover")d+=" highlightedOnHover";else if(s.highlightSlice===a.data.label)d+=" highlighted";return d}),x.selectAll("mySlices").data(it).enter().append("text").text((a)=>(a.data.value/Z*100).toFixed(0)+"%").attr("transform",(a)=>"translate("+_.centroid(a)+")").style("text-anchor","middle").attr("class","slice");let pt=v.append("text").text(g.getDiagramTitle()).attr("x",0).attr("y",-(m-50)/2).attr("class","pieTitleText"),I=[...U.entries()].map(([a,d])=>({label:a,value:d})),R=v.selectAll(".legend").data(I).enter().append("g").attr("class","legend");R.append("rect").attr("width",o).attr("height",o).style("fill",(a)=>q(a.label)).style("stroke",(a)=>q(a.label)),R.append("text").attr("x",o+u).attr("y",o-u).text((a)=>{if(g.getShowData())return`${a.label} [${a.value}]`;return a.label});let H=Math.max(...R.selectAll("text").nodes().map((a)=>a?.getBoundingClientRect().width??0)),j=m,J=z+r,f=o+u,K=I.length*f;switch(N){case"center":R.attr("transform",(a,d)=>{let y=f*I.length/2,A=-H/2-(o+u),D=d*f-y;return"translate("+A+","+D+")"});break;case"top":j+=K,R.attr("transform",(a,d)=>{let y=p,A=-H/2-(o+u),D=d*f-y;return`translate(${A}, ${D})`}),x.attr("transform",()=>`translate(0, ${K+f})`);break;case"bottom":j+=K,R.attr("transform",(a,d)=>{let y=-p-f,A=-H/2-(o+u),D=d*f-y;return"translate("+A+","+D+")"});break;case"left":J+=o+u+H,R.attr("transform",(a,d)=>{let y=f*I.length/2,A=-p-(o+u),D=d*f-y;return"translate("+A+","+D+")"}),x.attr("transform",()=>`translate(${H+o+u}, 0)`);break;case"right":default:J+=o+u+H,R.attr("transform",(a,d)=>{let y=f*I.length/2,A=12*o,D=d*f-y;return"translate("+A+","+D+")"});break}let ot=pt.node()?.getBoundingClientRect().width??0,ht=z/2-ot/2,mt=z/2+ot/2,lt=Math.min(0,ht),st=Math.max(J,mt)-lt;L.attr("viewBox",`${lt} 0 ${st} ${j}`),B(L,j,st,s.useMaxWidth)},"draw"),Mt={draw:Et},Jt={parser:Tt,db:ut,renderer:Mt,styles:kt};export{Jt as diagram};
