import{ee}from"./main-q3w7pm59.js";import{e,n,Me,Q,m,X,w,x,S,k,E,P,C,G,Y}from"./main-eqghj39w.js";import{le}from"./main-a3tp0and.js";var ut=e(()=>({domains:new Map,transitions:[]}),"createDefaultData"),et=ut(),At=e(()=>et.domains,"getDomains"),Bt=e(()=>et.transitions,"getTransitions"),St=e((t)=>{if(!t)return;for(let o of t){let a=o.domain,r=(o.items??[]).map((l)=>({label:l.label}));et.domains.set(a,{name:a,items:r})}},"setDomains"),Mt=e((t)=>{if(!t)return;et.transitions=t.filter((o)=>{if(o.from===o.to)return n.warn(`Cynefin: self-loop transition on domain "${o.from}" is not meaningful and will be skipped.`),!1;return!0}).map((o)=>({from:o.from,to:o.to,label:o.label||void 0}))},"setTransitions"),zt=e(()=>Y({...Q.cynefin,...m().cynefin}),"getConfig"),Lt=e(()=>{w(),et=ut()},"clear"),at={getDomains:At,getTransitions:Bt,setDomains:St,setTransitions:Mt,getConfig:zt,clear:Lt,setAccTitle:x,getAccTitle:S,setDiagramTitle:P,getDiagramTitle:C,getAccDescription:E,setAccDescription:k},Nt=e((t)=>{ee(t,at),at.setDomains(t.domains),at.setTransitions(t.transitions)},"populate"),Pt={parse:e(async(t)=>{let o=await le("cynefin",t);n.debug(o),Nt(o)},"parse")};function tt(t){let o=t+1831565813|0;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296}e(tt,"seededRandom");function gt(t){let o=0;for(let a=0;a<t.length;a++){let r=t.charCodeAt(a);o=(o<<5)-o+r,o|=0}return o}e(gt,"hashString");function ht(t,o){if(typeof t==="number"&&Number.isFinite(t)&&t!==0)return t;return gt(o)}e(ht,"resolveSeed");function xt(t,o,a,r){let l=t/2,y=r??t*0.015,nt=7,q=o/7,f=[];for(let i=0;i<=7;i++){let u=tt(a+i*17)*y*2-y;f.push({x:l+u,y:i*q})}let z=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let u=f[i],c=f[i+1],p=(u.y+c.y)/2,A=i%2===0?1:-1,b=y*1.5*A*tt(a+i*31+7),U=u.x+b,Z=p,J=c.x-b;z+=` C${U},${Z} ${J},${p} ${c.x},${c.y}`}return z}e(xt,"generateFoldPath");function $t(t,o,a,r){let l=o/2,y=r??o*0.015,nt=7,q=t/7,f=[];for(let i=0;i<=7;i++){let u=tt(a+i*23)*y*2-y;f.push({x:i*q,y:l+u})}let z=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let u=f[i],c=f[i+1],p=(u.x+c.x)/2,A=i%2===0?1:-1,b=y*1.5*A*tt(a+i*37+11),U=p,Z=u.y+b,J=p,V=c.y-b;z+=` C${U},${Z} ${J},${V} ${c.x},${c.y}`}return z}e($t,"generateHorizontalBoundary");function bt(t,o){let a=t/2,r=o*0.5,l=o,y=t*0.03;return[`M${a},${r}`,`C${a+y},${r+(l-r)*0.2}`,`${a-y*1.5},${r+(l-r)*0.55}`,`${a+y*0.5},${r+(l-r)*0.75}`,`C${a-y},${r+(l-r)*0.85}`,`${a+y*0.3},${r+(l-r)*0.95}`,`${a},${l}`].join(" ")}e(bt,"generateCliffPath");function wt(t,o,a,r){return[`M${t-a},${o}`,`A${a},${r} 0 1,1 ${t+a},${o}`,`A${a},${r} 0 1,1 ${t-a},${o}`,"Z"].join(" ")}e(wt,"generateConfusionPath");var yt={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},It=e((t,o)=>{let a=t/2,r=o/2;return{complex:{cx:a/2,cy:r/2,x:0,y:0,w:a,h:r},complicated:{cx:a+a/2,cy:r/2,x:a,y:0,w:a,h:r},chaotic:{cx:a/2,cy:r+r/2,x:0,y:r,w:a,h:r},clear:{cx:a+a/2,cy:r+r/2,x:a,y:r,w:a,h:r},confusion:{cx:a,cy:r,x:a*0.7,y:r*0.7,w:a*0.6,h:r*0.6}}},"getDomainLayouts"),Wt=e(()=>{let t=Me(),o=m();return Y(t,o.themeVariables).cynefin},"getCynefinDomainColors"),st=3,Rt=e((t,o,a,r)=>{let l=r.db,y=l.getDomains(),nt=l.getTransitions(),q=l.getDiagramTitle(),f=l.getAccTitle(),z=l.getAccDescription(),i=l.getConfig(),u=Wt();n.debug("Rendering Cynefin diagram");let{width:c,height:p,padding:A,showDomainDescriptions:b,boundaryAmplitude:U}=i,Z=c+A*2,J=p+A*2,V={complex:u.complexBg,complicated:u.complicatedBg,clear:u.clearBg,chaotic:u.chaoticBg,confusion:u.confusionBg},L=G(o);if(X(L,J,Z,i.useMaxWidth??!0),L.attr("viewBox",`0 0 ${Z} ${J}`),f)L.append("title").text(f);if(z)L.append("desc").text(z);let N=L.append("g").attr("transform",`translate(${A}, ${A})`),K=It(c,p),ct=ht(i.seed,o),Ct=N.append("g").attr("class","cynefin-backgrounds"),rt=["complex","complicated","chaotic","clear"];for(let d of rt){let s=K[d];Ct.append("rect").attr("class","cynefinDomain").attr("x",s.x).attr("y",s.y).attr("width",s.w).attr("height",s.h).attr("fill",V[d]).attr("fill-opacity",0.4).attr("stroke","none")}let it=N.append("g").attr("class","cynefin-boundaries");it.append("path").attr("class","cynefinBoundary").attr("d",xt(c,p,ct,U)).attr("fill","none"),it.append("path").attr("class","cynefinBoundary").attr("d",$t(c,p,ct+100,U)).attr("fill","none"),it.append("path").attr("class","cynefinCliff").attr("d",bt(c,p)).attr("fill","none");let vt=c*0.15,Dt=p*0.15;N.append("path").attr("class","cynefinConfusion").attr("d",wt(c/2,p/2,vt,Dt)).attr("fill",V.confusion).attr("fill-opacity",0.5);let lt=N.append("g").attr("class","cynefin-labels");for(let d of rt){let s=K[d];lt.append("text").attr("class","cynefinDomainLabel").attr("x",s.cx).attr("y",b?s.cy-30:s.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(d.charAt(0).toUpperCase()+d.slice(1))}if(lt.append("text").attr("class","cynefinDomainLabel").attr("x",c/2).attr("y",b?p/2-10:p/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),b){let d=N.append("g").attr("class","cynefin-subtitles");for(let s of rt){let h=K[s],g=yt[s];d.append("text").attr("class","cynefinSubtitle").attr("x",h.cx).attr("y",h.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(g.model),d.append("text").attr("class","cynefinSubtitle").attr("x",h.cx).attr("y",h.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(g.practice)}d.append("text").attr("class","cynefinSubtitle").attr("x",c/2).attr("y",p/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(yt.confusion.practice)}let dt=N.append("g").attr("class","cynefin-items"),I=26,ft=10,kt=["complex","complicated","chaotic","clear","confusion"];for(let d of kt){let s=y.get(d);if(!s||s.items.length===0)continue;let h=K[d],g=d==="confusion",_=s.items,H=0;if(g&&s.items.length>st)H=s.items.length-st,_=s.items.slice(0,st);let W;if(g){let D=b?22:14;W=h.cy+D}else W=h.cy+(b?25:15);if([..._].forEach((D,R)=>{let B=W+R*(I+4),F=dt.append("g"),O=F.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",I/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(D.label),T=D.label.length*7,v=O.node();if(v&&typeof v.getBBox==="function"){let ot=v.getBBox();if(ot.width>0)T=ot.width}let M=T+ft*2,j=h.cx-M/2;F.attr("transform",`translate(${j}, ${B})`),F.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",M).attr("height",I).attr("rx",4).attr("ry",4).attr("fill",V[d]).attr("fill-opacity",0.95),O.attr("x",M/2).attr("y",I/2)}),H>0){let D=W+_.length*(I+4),R=`+${H} more`,B=dt.append("g"),F=B.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",I/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(R),O=R.length*7,T=F.node();if(T&&typeof T.getBBox==="function"){let j=T.getBBox();if(j.width>0)O=j.width}let v=O+ft*2,M=h.cx-v/2;B.attr("transform",`translate(${M}, ${D})`),B.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",v).attr("height",I).attr("rx",4).attr("ry",4).attr("fill",V[d]).attr("fill-opacity",0.6),F.attr("x",v/2).attr("y",I/2)}}if(nt.length>0){let d=L.select("defs").empty()?L.append("defs"):L.select("defs"),s=`cynefin-arrow-${o}`;d.append("marker").attr("id",s).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");let h=N.append("g").attr("class","cynefin-arrows");nt.forEach((g)=>{let _=K[g.from],H=K[g.to];if(!_||!H)return;if(g.from===g.to){n.warn(`Cynefin renderer: skipping self-loop on domain "${g.from}"`);return}let{cx:W,cy:D}=_,{cx:R,cy:B}=H,F=(W+R)/2,O=(D+B)/2,T=R-W,v=B-D,M=Math.sqrt(T*T+v*v),j=M*0.15,ot=-v/M,Tt=T/M,mt=F+ot*j,pt=O+Tt*j;if(h.append("path").attr("class","cynefinArrowLine").attr("d",`M${W},${D} Q${mt},${pt} ${R},${B}`).attr("fill","none").attr("marker-end",`url(#${s})`),g.label)h.append("text").attr("class","cynefinArrowLabel").attr("x",mt).attr("y",pt-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(g.label)})}if(q)N.append("text").attr("class","cynefinTitle").attr("x",c/2).attr("y",-A/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(q)},"draw"),Ft={draw:Rt},Vt=e(()=>{let t=Me(),o=m();return Y(t,o.themeVariables).cynefin},"getCynefinTheme"),_t=e(()=>{let t=Vt();return`
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
