import{ne}from"./main-27sjk07e.js";import{e,n,R,B,w,k,S,T,E,P,C,i,xe,wn,Ei,G,dt,Y}from"./main-e601s562.js";import{le}from"./main-94svmvn7.js";import{Wt}from"./main-4bt8pn29.js";import{kt}from"./main-q15w0xyk.js";function tt(t,l){return l<t?-1:l>t?1:l>=t?0:NaN}function et(t){return t}function rt(){var t=et,l=tt,b=null,F=xe(0),g=xe(wn),h=xe(0);function s(r){var o,u=(r=Ei(r)).length,m,z,O=0,v=Array(u),c=Array(u),W=+F.apply(this,arguments),_=Math.min(wn,Math.max(-wn,g.apply(this,arguments)-W)),H,U=Math.min(Math.abs(_)/u,h.apply(this,arguments)),p=U*(_<0?-1:1),M;for(o=0;o<u;++o)if((M=c[v[o]=o]=+t(r[o],o,r))>0)O+=M;if(l!=null)v.sort(function(I,x){return l(c[I],c[x])});else if(b!=null)v.sort(function(I,x){return b(r[I],r[x])});for(o=0,z=O?(_-u*p)/O:0;o<u;++o,W=H)m=v[o],M=c[m],H=W+(M>0?M*z:0)+p,c[m]={data:r[m],index:o,value:M,startAngle:W,endAngle:H,padAngle:U};return c}return s.value=function(r){return arguments.length?(t=typeof r==="function"?r:xe(+r),s):t},s.sortValues=function(r){return arguments.length?(l=r,b=null,s):l},s.sort=function(r){return arguments.length?(b=r,l=null,s):b},s.startAngle=function(r){return arguments.length?(F=typeof r==="function"?r:xe(+r),s):F},s.endAngle=function(r){return arguments.length?(g=typeof r==="function"?r:xe(+r),s):g},s.padAngle=function(r){return arguments.length?(h=typeof r==="function"?r:xe(+r),s):h},s}var ct=R.pie,at={sections:new Map,showData:!1,config:ct},{sections:Z,showData:nt}=at,vt=structuredClone(ct),xt=e(()=>structuredClone(vt),"getConfig"),St=e(()=>{Z=new Map,nt=at.showData,w()},"clear"),yt=e(({label:t,value:l})=>{if(l<0)throw Error(`"${t}" has invalid value: ${l}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);if(!Z.has(t))Z.set(t,l),n.debug(`added new section: ${t}, with value: ${l}`)},"addSection"),wt=e(()=>Z,"getSections"),At=e((t)=>{nt=t},"setShowData"),Ct=e(()=>nt,"getShowData"),ut={getConfig:xt,clear:St,setDiagramTitle:P,getDiagramTitle:C,setAccTitle:k,getAccTitle:S,setAccDescription:T,getAccDescription:E,addSection:yt,getSections:wt,setShowData:At,getShowData:Ct},$t=e((t,l)=>{ne(t,l),l.setShowData(t.showData),t.sections.map(l.addSection)},"populateDb"),Dt={parse:e(async(t)=>{let l=await le("pie",t);n.debug(l),$t(l,ut)},"parse")},Tt=e((t)=>`
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
`,"getStyles"),bt=Tt,zt=e((t)=>{let l=[...t.values()].reduce((g,h)=>g+h,0),b=[...t.entries()].map(([g,h])=>({label:g,value:h})).filter((g)=>g.value/l*100>=1);return rt().value((g)=>g.value).sort(null)(b)},"createPieArcs"),Et=e((t,l,b,F)=>{n.debug(`rendering pie chart
`+t);let g=F.db,h=i(),s=Y(g.getConfig(),h.pie),r=40,o=18,u=4,m=450,z=m,O=G(l),v=O.append("g");v.attr("transform","translate("+z/2+","+m/2+")");let{themeVariables:c}=h,[W]=dt(c.pieOuterStrokeWidth);W??=2;let{legendPosition:_,textPosition:H}=s,U=s.donutHole>0&&s.donutHole<=0.9?s.donutHole:0,p=Math.min(z,m)/2-r,M=Wt().innerRadius(U*p).outerRadius(p),I=Wt().innerRadius(p*H).outerRadius(p*H),x=v.append("g");x.append("circle").attr("cx",0).attr("cy",0).attr("r",p+W/2).attr("class","pieOuterCircle");let j=g.getSections(),gt=zt(j),pt=[c.pie1,c.pie2,c.pie3,c.pie4,c.pie5,c.pie6,c.pie7,c.pie8,c.pie9,c.pie10,c.pie11,c.pie12],q=0;j.forEach((a)=>{q+=a});let it=gt.filter((a)=>(a.data.value/q*100).toFixed(0)!=="0"),J=kt(pt).domain([...j.keys()]);x.selectAll("mySlices").data(it).enter().append("path").attr("d",M).attr("fill",(a)=>J(a.data.label)).attr("class",(a)=>{let d="pieCircle";if(s.highlightSlice==="hover")d+=" highlightedOnHover";else if(s.highlightSlice===a.data.label)d+=" highlighted";return d}),x.selectAll("mySlices").data(it).enter().append("text").text((a)=>(a.data.value/q*100).toFixed(0)+"%").attr("transform",(a)=>"translate("+I.centroid(a)+")").style("text-anchor","middle").attr("class","slice");let ft=v.append("text").text(g.getDiagramTitle()).attr("x",0).attr("y",-(m-50)/2).attr("class","pieTitleText"),V=[...j.entries()].map(([a,d])=>({label:a,value:d})),L=v.selectAll(".legend").data(V).enter().append("g").attr("class","legend");L.append("rect").attr("width",o).attr("height",o).style("fill",(a)=>J(a.label)).style("stroke",(a)=>J(a.label)),L.append("text").attr("x",o+u).attr("y",o-u).text((a)=>{if(g.getShowData())return`${a.label} [${a.value}]`;return a.label});let N=Math.max(...L.selectAll("text").nodes().map((a)=>a?.getBoundingClientRect().width??0)),X=m,K=z+r,f=o+u,Q=V.length*f;switch(_){case"center":L.attr("transform",(a,d)=>{let y=f*V.length/2,A=-N/2-(o+u),D=d*f-y;return"translate("+A+","+D+")"});break;case"top":X+=Q,L.attr("transform",(a,d)=>{let y=p,A=-N/2-(o+u),D=d*f-y;return`translate(${A}, ${D})`}),x.attr("transform",()=>`translate(0, ${Q+f})`);break;case"bottom":X+=Q,L.attr("transform",(a,d)=>{let y=-p-f,A=-N/2-(o+u),D=d*f-y;return"translate("+A+","+D+")"});break;case"left":K+=o+u+N,L.attr("transform",(a,d)=>{let y=f*V.length/2,A=-p-(o+u),D=d*f-y;return"translate("+A+","+D+")"}),x.attr("transform",()=>`translate(${N+o+u}, 0)`);break;case"right":default:K+=o+u+N,L.attr("transform",(a,d)=>{let y=f*V.length/2,A=12*o,D=d*f-y;return"translate("+A+","+D+")"});break}let ot=ft.node()?.getBoundingClientRect().width??0,ht=z/2-ot/2,mt=z/2+ot/2,lt=Math.min(0,ht),st=Math.max(K,mt)-lt;O.attr("viewBox",`${lt} 0 ${st} ${X}`),B(O,X,st,s.useMaxWidth)},"draw"),Mt={draw:Et},Jt={parser:Dt,db:ut,renderer:Mt,styles:bt};export{Jt as diagram};
