import{re}from"./main-mh35nch5.js";import{e,n,Be,R,O,B,w,k,T,S,E,_,P,W,Y}from"./main-fj279j2h.js";import{oe}from"./main-sn1w62v6.js";var ut=e(()=>({domains:new Map,transitions:[]}),"createDefaultData"),et=ut(),At=e(()=>et.domains,"getDomains"),Bt=e(()=>et.transitions,"getTransitions"),St=e((t)=>{if(!t)return;for(let o of t){let a=o.domain,r=(o.items??[]).map((l)=>({label:l.label}));et.domains.set(a,{name:a,items:r})}},"setDomains"),Mt=e((t)=>{if(!t)return;et.transitions=t.filter((o)=>{if(o.from===o.to)return n.warn(`Cynefin: self-loop transition on domain "${o.from}" is not meaningful and will be skipped.`),!1;return!0}).map((o)=>({from:o.from,to:o.to,label:o.label||void 0}))},"setTransitions"),zt=e(()=>W({...R.cynefin,...O().cynefin}),"getConfig"),Lt=e(()=>{w(),et=ut()},"clear"),at={getDomains:At,getTransitions:Bt,setDomains:St,setTransitions:Mt,getConfig:zt,clear:Lt,setAccTitle:k,getAccTitle:T,setDiagramTitle:_,getDiagramTitle:P,getAccDescription:E,setAccDescription:S},Nt=e((t)=>{re(t,at),at.setDomains(t.domains),at.setTransitions(t.transitions)},"populate"),Pt={parse:e(async(t)=>{let o=await oe("cynefin",t);n.debug(o),Nt(o)},"parse")};function tt(t){let o=t+1831565813|0;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296}e(tt,"seededRandom");function gt(t){let o=0;for(let a=0;a<t.length;a++){let r=t.charCodeAt(a);o=(o<<5)-o+r,o|=0}return o}e(gt,"hashString");function ht(t,o){if(typeof t==="number"&&Number.isFinite(t)&&t!==0)return t;return gt(o)}e(ht,"resolveSeed");function xt(t,o,a,r){let l=t/2,p=r??t*0.015,nt=7,U=o/7,f=[];for(let i=0;i<=7;i++){let y=tt(a+i*17)*p*2-p;f.push({x:l+y,y:i*U})}let M=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let y=f[i],c=f[i+1],m=(y.y+c.y)/2,v=i%2===0?1:-1,h=p*1.5*v*tt(a+i*31+7),Q=y.x+h,Z=m,J=c.x-h;M+=` C${Q},${Z} ${J},${m} ${c.x},${c.y}`}return M}e(xt,"generateFoldPath");function $t(t,o,a,r){let l=o/2,p=r??o*0.015,nt=7,U=t/7,f=[];for(let i=0;i<=7;i++){let y=tt(a+i*23)*p*2-p;f.push({x:i*U,y:l+y})}let M=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let y=f[i],c=f[i+1],m=(y.x+c.x)/2,v=i%2===0?1:-1,h=p*1.5*v*tt(a+i*37+11),Q=m,Z=y.y+h,J=m,H=c.y-h;M+=` C${Q},${Z} ${J},${H} ${c.x},${c.y}`}return M}e($t,"generateHorizontalBoundary");function bt(t,o){let a=t/2,r=o*0.5,l=o,p=t*0.03;return[`M${a},${r}`,`C${a+p},${r+(l-r)*0.2}`,`${a-p*1.5},${r+(l-r)*0.55}`,`${a+p*0.5},${r+(l-r)*0.75}`,`C${a-p},${r+(l-r)*0.85}`,`${a+p*0.3},${r+(l-r)*0.95}`,`${a},${l}`].join(" ")}e(bt,"generateCliffPath");function wt(t,o,a,r){return[`M${t-a},${o}`,`A${a},${r} 0 1,1 ${t+a},${o}`,`A${a},${r} 0 1,1 ${t-a},${o}`,"Z"].join(" ")}e(wt,"generateConfusionPath");var yt={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},It=e((t,o)=>{let a=t/2,r=o/2;return{complex:{cx:a/2,cy:r/2,x:0,y:0,w:a,h:r},complicated:{cx:a+a/2,cy:r/2,x:a,y:0,w:a,h:r},chaotic:{cx:a/2,cy:r+r/2,x:0,y:r,w:a,h:r},clear:{cx:a+a/2,cy:r+r/2,x:a,y:r,w:a,h:r},confusion:{cx:a,cy:r,x:a*0.7,y:r*0.7,w:a*0.6,h:r*0.6}}},"getDomainLayouts"),Wt=e(()=>{let t=Be(),o=O();return W(t,o.themeVariables).cynefin},"getCynefinDomainColors"),st=3,Rt=e((t,o,a,r)=>{let l=r.db,p=l.getDomains(),nt=l.getTransitions(),U=l.getDiagramTitle(),f=l.getAccTitle(),M=l.getAccDescription(),i=l.getConfig(),y=Wt();n.debug("Rendering Cynefin diagram");let{width:c,height:m,padding:v,showDomainDescriptions:h,boundaryAmplitude:Q}=i,Z=c+v*2,J=m+v*2,H={complex:y.complexBg,complicated:y.complicatedBg,clear:y.clearBg,chaotic:y.chaoticBg,confusion:y.confusionBg},z=Y(o);if(B(z,J,Z,i.useMaxWidth??!0),z.attr("viewBox",`0 0 ${Z} ${J}`),f)z.append("title").text(f);if(M)z.append("desc").text(M);let L=z.append("g").attr("transform",`translate(${v}, ${v})`),K=It(c,m),ct=ht(i.seed,o),Ct=L.append("g").attr("class","cynefin-backgrounds"),rt=["complex","complicated","chaotic","clear"];for(let d of rt){let s=K[d];Ct.append("rect").attr("class","cynefinDomain").attr("x",s.x).attr("y",s.y).attr("width",s.w).attr("height",s.h).attr("fill",H[d]).attr("fill-opacity",0.4).attr("stroke","none")}let it=L.append("g").attr("class","cynefin-boundaries");it.append("path").attr("class","cynefinBoundary").attr("d",xt(c,m,ct,Q)).attr("fill","none"),it.append("path").attr("class","cynefinBoundary").attr("d",$t(c,m,ct+100,Q)).attr("fill","none"),it.append("path").attr("class","cynefinCliff").attr("d",bt(c,m)).attr("fill","none");let vt=c*0.15,Dt=m*0.15;L.append("path").attr("class","cynefinConfusion").attr("d",wt(c/2,m/2,vt,Dt)).attr("fill",H.confusion).attr("fill-opacity",0.5);let lt=L.append("g").attr("class","cynefin-labels");for(let d of rt){let s=K[d];lt.append("text").attr("class","cynefinDomainLabel").attr("x",s.cx).attr("y",h?s.cy-30:s.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(d.charAt(0).toUpperCase()+d.slice(1))}if(lt.append("text").attr("class","cynefinDomainLabel").attr("x",c/2).attr("y",h?m/2-10:m/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),h){let d=L.append("g").attr("class","cynefin-subtitles");for(let s of rt){let g=K[s],u=yt[s];d.append("text").attr("class","cynefinSubtitle").attr("x",g.cx).attr("y",g.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(u.model),d.append("text").attr("class","cynefinSubtitle").attr("x",g.cx).attr("y",g.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(u.practice)}d.append("text").attr("class","cynefinSubtitle").attr("x",c/2).attr("y",m/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(yt.confusion.practice)}let dt=L.append("g").attr("class","cynefin-items"),N=26,ft=10,kt=["complex","complicated","chaotic","clear","confusion"];for(let d of kt){let s=p.get(d);if(!s||s.items.length===0)continue;let g=K[d],u=d==="confusion",G=s.items,X=0;if(u&&s.items.length>st)X=s.items.length-st,G=s.items.slice(0,st);let I;if(u){let b=h?22:14;I=g.cy+b}else I=g.cy+(h?25:15);if([...G].forEach((b,F)=>{let D=I+F*(N+4),V=dt.append("g"),j=V.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",N/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(b.label),C=b.label.length*7,x=j.node();if(x&&typeof x.getBBox==="function"){let ot=x.getBBox();if(ot.width>0)C=ot.width}let A=C+ft*2,q=g.cx-A/2;V.attr("transform",`translate(${q}, ${D})`),V.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",A).attr("height",N).attr("rx",4).attr("ry",4).attr("fill",H[d]).attr("fill-opacity",0.95),j.attr("x",A/2).attr("y",N/2)}),X>0){let b=I+G.length*(N+4),F=`+${X} more`,D=dt.append("g"),V=D.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",N/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(F),j=F.length*7,C=V.node();if(C&&typeof C.getBBox==="function"){let q=C.getBBox();if(q.width>0)j=q.width}let x=j+ft*2,A=g.cx-x/2;D.attr("transform",`translate(${A}, ${b})`),D.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",x).attr("height",N).attr("rx",4).attr("ry",4).attr("fill",H[d]).attr("fill-opacity",0.6),V.attr("x",x/2).attr("y",N/2)}}if(nt.length>0){let d=z.select("defs").empty()?z.append("defs"):z.select("defs"),s=`cynefin-arrow-${o}`;d.append("marker").attr("id",s).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");let g=L.append("g").attr("class","cynefin-arrows");nt.forEach((u)=>{let G=K[u.from],X=K[u.to];if(!G||!X)return;if(u.from===u.to){n.warn(`Cynefin renderer: skipping self-loop on domain "${u.from}"`);return}let{cx:I,cy:b}=G,{cx:F,cy:D}=X,V=(I+F)/2,j=(b+D)/2,C=F-I,x=D-b,A=Math.sqrt(C*C+x*x),q=A*0.15,ot=-x/A,Tt=C/A,mt=V+ot*q,pt=j+Tt*q;if(g.append("path").attr("class","cynefinArrowLine").attr("d",`M${I},${b} Q${mt},${pt} ${F},${D}`).attr("fill","none").attr("marker-end",`url(#${s})`),u.label)g.append("text").attr("class","cynefinArrowLabel").attr("x",mt).attr("y",pt-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(u.label)})}if(U)L.append("text").attr("class","cynefinTitle").attr("x",c/2).attr("y",-v/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(U)},"draw"),Ft={draw:Rt},Vt=e(()=>{let t=Be(),o=O();return W(t,o.themeVariables).cynefin},"getCynefinTheme"),_t=e(()=>{let t=Vt();return`
	.cynefinDomain {
		stroke: none;
	}
	.cynefinDomainLabel {
		font-size: ${t.domainFontSize}px;
		font-weight: bold;
		fill: ${t.labelColor};
	}
	.cynefinSubtitle {
		font-size: ${t.itemFontSize-1}px;
		fill: ${t.textColor};
		font-style: italic;
	}
	.cynefinItem {
		fill-opacity: 0.95;
		stroke: ${t.boundaryColor};
		stroke-width: 1;
	}
	.cynefinItemText {
		font-size: ${t.itemFontSize}px;
		fill: ${t.textColor};
	}
	.cynefinItemOverflow {
		fill-opacity: 0.6;
		stroke: ${t.boundaryColor};
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}
	.cynefinBoundary {
		stroke: ${t.boundaryColor};
		stroke-width: ${t.boundaryWidth};
		stroke-dasharray: 6 3;
	}
	.cynefinCliff {
		stroke: ${t.cliffColor};
		stroke-width: ${t.cliffWidth};
	}
	.cynefinConfusion {
		stroke: ${t.boundaryColor};
		stroke-width: 1.5;
		stroke-dasharray: 4 2;
	}
	.cynefinArrowLine {
		stroke: ${t.arrowColor};
		stroke-width: ${t.arrowWidth};
		fill: none;
	}
	.cynefinArrowHead {
		fill: ${t.arrowColor};
		stroke: none;
	}
	.cynefinArrowLabel {
		font-size: ${t.itemFontSize-1}px;
		fill: ${t.textColor};
	}
	.cynefinTitle {
		font-size: ${t.domainFontSize+2}px;
		font-weight: bold;
		fill: ${t.labelColor};
	}
	`},"styles"),Et=_t,Ut={parser:Pt,db:at,renderer:Ft,styles:Et};export{Ut as diagram};
