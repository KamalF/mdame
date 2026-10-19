import{K}from"./main-1g31nb70.js";import{e,n,C,N,v,w,k,x,T,E,S,i,pe,qr,Fn,V,He,F}from"./main-8gzg685w.js";import{ie}from"./main-m44xsvf1.js";import{xt}from"./main-5bqe5zjw.js";import{nt}from"./main-ftm14t32.js";function et(t,l){return l<t?-1:l>t?1:l>=t?0:NaN}function rt(t){return t}function at(){var t=rt,l=et,M=null,P=pe(0),g=pe(qr),h=pe(0);function s(r){var o,u=(r=Fn(r)).length,m,R,W=0,y=Array(u),c=Array(u),H=+P.apply(this,arguments),B=Math.min(qr,Math.max(-qr,g.apply(this,arguments)-H)),_,j=Math.min(Math.abs(B)/u,h.apply(this,arguments)),p=j*(B<0?-1:1),L;for(o=0;o<u;++o)if((L=c[y[o]=o]=+t(r[o],o,r))>0)W+=L;if(l!=null)y.sort(function(I,A){return l(c[I],c[A])});else if(M!=null)y.sort(function(I,A){return M(r[I],r[A])});for(o=0,R=W?(B-u*p)/W:0;o<u;++o,H=_)m=y[o],L=c[m],_=H+(L>0?L*R:0)+p,c[m]={data:r[m],index:o,value:L,startAngle:H,endAngle:_,padAngle:j};return c}return s.value=function(r){return arguments.length?(t=typeof r==="function"?r:pe(+r),s):t},s.sortValues=function(r){return arguments.length?(l=r,M=null,s):l},s.sort=function(r){return arguments.length?(M=r,l=null,s):M},s.startAngle=function(r){return arguments.length?(P=typeof r==="function"?r:pe(+r),s):P},s.endAngle=function(r){return arguments.length?(g=typeof r==="function"?r:pe(+r),s):g},s.padAngle=function(r){return arguments.length?(h=typeof r==="function"?r:pe(+r),s):h},s}var gt=C.pie,it={sections:new Map,showData:!1,config:gt},{sections:q,showData:ot}=it,St=structuredClone(gt),yt=e(()=>structuredClone(St),"getConfig"),wt=e(()=>{q=new Map,ot=it.showData,v()},"clear"),At=e(({label:t,value:l})=>{if(l<0)throw Error(`"${t}" has invalid value: ${l}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);if(!q.has(t))q.set(t,l),n.debug(`added new section: ${t}, with value: ${l}`)},"addSection"),Ct=e(()=>q,"getSections"),$t=e((t)=>{ot=t},"setShowData"),Dt=e(()=>ot,"getShowData"),dt={getConfig:yt,clear:wt,setDiagramTitle:E,getDiagramTitle:S,setAccTitle:w,getAccTitle:k,setAccDescription:x,getAccDescription:T,addSection:At,getSections:Ct,setShowData:$t,getShowData:Dt},Tt=e((t,l)=>{K(t,l),l.setShowData(t.showData),t.sections.map(l.addSection)},"populateDb"),bt={parse:e(async(t)=>{let l=await ie("pie",t);n.debug(l),Tt(l,dt)},"parse")},kt=e((t)=>`
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
`,"getStyles"),zt=kt,Et=e((t)=>{let l=[...t.values()].reduce((g,h)=>g+h,0),M=[...t.entries()].map(([g,h])=>({label:g,value:h})).filter((g)=>g.value/l*100>=1);return at().value((g)=>g.value).sort(null)(M)},"createPieArcs"),Mt=e((t,l,M,P)=>{n.debug(`rendering pie chart
`+t);let g=P.db,h=i(),s=F(g.getConfig(),h.pie),r=40,o=18,u=4,m=450,R=m,W=V(l),y=W.append("g");y.attr("transform","translate("+R/2+","+m/2+")");let{themeVariables:c}=h,[H]=He(c.pieOuterStrokeWidth);H??=2;let{legendPosition:B,textPosition:_}=s,j=s.donutHole>0&&s.donutHole<=0.9?s.donutHole:0,p=Math.min(R,m)/2-r,L=xt().innerRadius(j*p).outerRadius(p),I=xt().innerRadius(p*_).outerRadius(p*_),A=y.append("g");A.append("circle").attr("cx",0).attr("cy",0).attr("r",p+H/2).attr("class","pieOuterCircle");let X=g.getSections(),pt=Et(X),ft=[c.pie1,c.pie2,c.pie3,c.pie4,c.pie5,c.pie6,c.pie7,c.pie8,c.pie9,c.pie10,c.pie11,c.pie12],J=0;X.forEach((a)=>{J+=a});let lt=pt.filter((a)=>(a.data.value/J*100).toFixed(0)!=="0"),Q=nt(ft).domain([...X.keys()]);A.selectAll("mySlices").data(lt).enter().append("path").attr("d",L).attr("fill",(a)=>Q(a.data.label)).attr("class",(a)=>{let d="pieCircle";if(s.highlightSlice==="hover")d+=" highlightedOnHover";else if(s.highlightSlice===a.data.label)d+=" highlighted";return d}),A.selectAll("mySlices").data(lt).enter().append("text").text((a)=>(a.data.value/J*100).toFixed(0)+"%").attr("transform",(a)=>"translate("+I.centroid(a)+")").style("text-anchor","middle").attr("class","slice");let ht=y.append("text").text(g.getDiagramTitle()).attr("x",0).attr("y",-(m-50)/2).attr("class","pieTitleText"),U=[...X.entries()].map(([a,d])=>({label:a,value:d})),O=y.selectAll(".legend").data(U).enter().append("g").attr("class","legend");O.append("rect").attr("width",o).attr("height",o).style("fill",(a)=>Q(a.label)).style("stroke",(a)=>Q(a.label)),O.append("text").attr("x",o+u).attr("y",o-u).text((a)=>{if(g.getShowData())return`${a.label} [${a.value}]`;return a.label});let G=Math.max(...O.selectAll("text").nodes().map((a)=>a?.getBoundingClientRect().width??0)),Z=m,Y=R+r,f=o+u,tt=U.length*f;switch(B){case"center":O.attr("transform",(a,d)=>{let D=f*U.length/2,b=-G/2-(o+u),z=d*f-D;return"translate("+b+","+z+")"});break;case"top":Z+=tt,O.attr("transform",(a,d)=>{let D=p,b=-G/2-(o+u),z=d*f-D;return`translate(${b}, ${z})`}),A.attr("transform",()=>`translate(0, ${tt+f})`);break;case"bottom":Z+=tt,O.attr("transform",(a,d)=>{let D=-p-f,b=-G/2-(o+u),z=d*f-D;return"translate("+b+","+z+")"});break;case"left":Y+=o+u+G,O.attr("transform",(a,d)=>{let D=f*U.length/2,b=-p-(o+u),z=d*f-D;return"translate("+b+","+z+")"}),A.attr("transform",()=>`translate(${G+o+u}, 0)`);break;case"right":default:Y+=o+u+G,O.attr("transform",(a,d)=>{let D=f*U.length/2,b=12*o,z=d*f-D;return"translate("+b+","+z+")"});break}let st=ht.node()?.getBoundingClientRect().width??0,mt=R/2-st/2,vt=R/2+st/2,ct=Math.min(0,mt),ut=Math.max(Y,vt)-ct;W.attr("viewBox",`${ct} 0 ${ut} ${Z}`),N(W,Z,ut,s.useMaxWidth)},"draw"),Rt={draw:Mt},Jt={parser:bt,db:dt,renderer:Rt,styles:zt};export{Jt as diagram};
