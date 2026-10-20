import{ee}from"./main-m1m0h35q.js";import{e,n,Q,X,w,x,T,k,E,P,C,i,ve,ln,ci,G,ot,Y}from"./main-zc06fyn3.js";import{le}from"./main-a3tp0and.js";import{Xt}from"./main-fc23s46y.js";import{mt}from"./main-p674ch02.js";function tt(t,l){return l<t?-1:l>t?1:l>=t?0:NaN}function et(t){return t}function rt(){var t=et,l=tt,b=null,W=ve(0),g=ve(ln),h=ve(0);function s(r){var o,u=(r=ci(r)).length,m,z,L=0,v=Array(u),c=Array(u),O=+W.apply(this,arguments),N=Math.min(ln,Math.max(-ln,g.apply(this,arguments)-O)),F,I=Math.min(Math.abs(N)/u,h.apply(this,arguments)),p=I*(N<0?-1:1),M;for(o=0;o<u;++o)if((M=c[v[o]=o]=+t(r[o],o,r))>0)L+=M;if(l!=null)v.sort(function(_,S){return l(c[_],c[S])});else if(b!=null)v.sort(function(_,S){return b(r[_],r[S])});for(o=0,z=L?(N-u*p)/L:0;o<u;++o,O=F)m=v[o],M=c[m],F=O+(M>0?M*z:0)+p,c[m]={data:r[m],index:o,value:M,startAngle:O,endAngle:F,padAngle:I};return c}return s.value=function(r){return arguments.length?(t=typeof r==="function"?r:ve(+r),s):t},s.sortValues=function(r){return arguments.length?(l=r,b=null,s):l},s.sort=function(r){return arguments.length?(b=r,l=null,s):b},s.startAngle=function(r){return arguments.length?(W=typeof r==="function"?r:ve(+r),s):W},s.endAngle=function(r){return arguments.length?(g=typeof r==="function"?r:ve(+r),s):g},s.padAngle=function(r){return arguments.length?(h=typeof r==="function"?r:ve(+r),s):h},s}var ut=Q.pie,at={sections:new Map,showData:!1,config:ut},{sections:j,showData:nt}=at,xt=structuredClone(ut),St=e(()=>structuredClone(xt),"getConfig"),yt=e(()=>{j=new Map,nt=at.showData,w()},"clear"),wt=e(({label:t,value:l})=>{if(l<0)throw Error(`"${t}" has invalid value: ${l}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);if(!j.has(t))j.set(t,l),n.debug(`added new section: ${t}, with value: ${l}`)},"addSection"),At=e(()=>j,"getSections"),Ct=e((t)=>{nt=t},"setShowData"),$t=e(()=>nt,"getShowData"),gt={getConfig:St,clear:yt,setDiagramTitle:P,getDiagramTitle:C,setAccTitle:x,getAccTitle:T,setAccDescription:k,getAccDescription:E,addSection:wt,getSections:At,setShowData:Ct,getShowData:$t},Dt=e((t,l)=>{ee(t,l),l.setShowData(t.showData),t.sections.map(l.addSection)},"populateDb"),Tt={parse:e(async(t)=>{let l=await le("pie",t);n.debug(l),Dt(l,gt)},"parse")},bt=e((t)=>`
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
`+t);let g=W.db,h=i(),s=Y(g.getConfig(),h.pie),r=40,o=18,u=4,m=450,z=m,L=G(l),v=L.append("g");v.attr("transform","translate("+z/2+","+m/2+")");let{themeVariables:c}=h,[O]=ot(c.pieOuterStrokeWidth);O??=2;let{legendPosition:N,textPosition:F}=s,I=s.donutHole>0&&s.donutHole<=0.9?s.donutHole:0,p=Math.min(z,m)/2-r,M=Xt().innerRadius(I*p).outerRadius(p),_=Xt().innerRadius(p*F).outerRadius(p*F),S=v.append("g");S.append("circle").attr("cx",0).attr("cy",0).attr("r",p+O/2).attr("class","pieOuterCircle");let V=g.getSections(),dt=zt(V),pt=[c.pie1,c.pie2,c.pie3,c.pie4,c.pie5,c.pie6,c.pie7,c.pie8,c.pie9,c.pie10,c.pie11,c.pie12],Z=0;V.forEach((a)=>{Z+=a});let it=dt.filter((a)=>(a.data.value/Z*100).toFixed(0)!=="0"),q=mt(pt).domain([...V.keys()]);S.selectAll("mySlices").data(it).enter().append("path").attr("d",M).attr("fill",(a)=>q(a.data.label)).attr("class",(a)=>{let d="pieCircle";if(s.highlightSlice==="hover")d+=" highlightedOnHover";else if(s.highlightSlice===a.data.label)d+=" highlighted";return d}),S.selectAll("mySlices").data(it).enter().append("text").text((a)=>(a.data.value/Z*100).toFixed(0)+"%").attr("transform",(a)=>"translate("+_.centroid(a)+")").style("text-anchor","middle").attr("class","slice");let ft=v.append("text").text(g.getDiagramTitle()).attr("x",0).attr("y",-(m-50)/2).attr("class","pieTitleText"),B=[...V.entries()].map(([a,d])=>({label:a,value:d})),R=v.selectAll(".legend").data(B).enter().append("g").attr("class","legend");R.append("rect").attr("width",o).attr("height",o).style("fill",(a)=>q(a.label)).style("stroke",(a)=>q(a.label)),R.append("text").attr("x",o+u).attr("y",o-u).text((a)=>{if(g.getShowData())return`${a.label} [${a.value}]`;return a.label});let H=Math.max(...R.selectAll("text").nodes().map((a)=>a?.getBoundingClientRect().width??0)),U=m,J=z+r,f=o+u,K=B.length*f;switch(N){case"center":R.attr("transform",(a,d)=>{let y=f*B.length/2,A=-H/2-(o+u),D=d*f-y;return"translate("+A+","+D+")"});break;case"top":U+=K,R.attr("transform",(a,d)=>{let y=p,A=-H/2-(o+u),D=d*f-y;return`translate(${A}, ${D})`}),S.attr("transform",()=>`translate(0, ${K+f})`);break;case"bottom":U+=K,R.attr("transform",(a,d)=>{let y=-p-f,A=-H/2-(o+u),D=d*f-y;return"translate("+A+","+D+")"});break;case"left":J+=o+u+H,R.attr("transform",(a,d)=>{let y=f*B.length/2,A=-p-(o+u),D=d*f-y;return"translate("+A+","+D+")"}),S.attr("transform",()=>`translate(${H+o+u}, 0)`);break;case"right":default:J+=o+u+H,R.attr("transform",(a,d)=>{let y=f*B.length/2,A=12*o,D=d*f-y;return"translate("+A+","+D+")"});break}let lt=ft.node()?.getBoundingClientRect().width??0,ht=z/2-lt/2,vt=z/2+lt/2,st=Math.min(0,ht),ct=Math.max(J,vt)-st;L.attr("viewBox",`${st} 0 ${ct} ${U}`),X(L,U,ct,s.useMaxWidth)},"draw"),Mt={draw:Et},Jt={parser:Tt,db:gt,renderer:Mt,styles:kt};export{Jt as diagram};
