import{ne}from"./main-jyx71avx.js";import{e,n,Be,R,O,B,w,k,S,T,E,P,C,G,Y}from"./main-ggz3t070.js";import{le}from"./main-1aqaqkgs.js";var ut=e(()=>({domains:new Map,transitions:[]}),"createDefaultData"),et=ut(),At=e(()=>et.domains,"getDomains"),Bt=e(()=>et.transitions,"getTransitions"),St=e((t)=>{if(!t)return;for(let o of t){let a=o.domain,r=(o.items??[]).map((l)=>({label:l.label}));et.domains.set(a,{name:a,items:r})}},"setDomains"),Mt=e((t)=>{if(!t)return;et.transitions=t.filter((o)=>{if(o.from===o.to)return n.warn(`Cynefin: self-loop transition on domain "${o.from}" is not meaningful and will be skipped.`),!1;return!0}).map((o)=>({from:o.from,to:o.to,label:o.label||void 0}))},"setTransitions"),zt=e(()=>Y({...R.cynefin,...O().cynefin}),"getConfig"),Lt=e(()=>{w(),et=ut()},"clear"),at={getDomains:At,getTransitions:Bt,setDomains:St,setTransitions:Mt,getConfig:zt,clear:Lt,setAccTitle:k,getAccTitle:S,setDiagramTitle:P,getDiagramTitle:C,getAccDescription:E,setAccDescription:T},Nt=e((t)=>{ne(t,at),at.setDomains(t.domains),at.setTransitions(t.transitions)},"populate"),Pt={parse:e(async(t)=>{let o=await le("cynefin",t);n.debug(o),Nt(o)},"parse")};function tt(t){let o=t+1831565813|0;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296}e(tt,"seededRandom");function gt(t){let o=0;for(let a=0;a<t.length;a++){let r=t.charCodeAt(a);o=(o<<5)-o+r,o|=0}return o}e(gt,"hashString");function ht(t,o){if(typeof t==="number"&&Number.isFinite(t)&&t!==0)return t;return gt(o)}e(ht,"resolveSeed");function xt(t,o,a,r){let l=t/2,p=r??t*0.015,nt=7,U=o/7,f=[];for(let i=0;i<=7;i++){let y=tt(a+i*17)*p*2-p;f.push({x:l+y,y:i*U})}let z=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let y=f[i],c=f[i+1],m=(y.y+c.y)/2,D=i%2===0?1:-1,h=p*1.5*D*tt(a+i*31+7),Q=y.x+h,Z=m,J=c.x-h;z+=` C${Q},${Z} ${J},${m} ${c.x},${c.y}`}return z}e(xt,"generateFoldPath");function $t(t,o,a,r){let l=o/2,p=r??o*0.015,nt=7,U=t/7,f=[];for(let i=0;i<=7;i++){let y=tt(a+i*23)*p*2-p;f.push({x:i*U,y:l+y})}let z=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let y=f[i],c=f[i+1],m=(y.x+c.x)/2,D=i%2===0?1:-1,h=p*1.5*D*tt(a+i*37+11),Q=m,Z=y.y+h,J=m,_=c.y-h;z+=` C${Q},${Z} ${J},${_} ${c.x},${c.y}`}return z}e($t,"generateHorizontalBoundary");function bt(t,o){let a=t/2,r=o*0.5,l=o,p=t*0.03;return[`M${a},${r}`,`C${a+p},${r+(l-r)*0.2}`,`${a-p*1.5},${r+(l-r)*0.55}`,`${a+p*0.5},${r+(l-r)*0.75}`,`C${a-p},${r+(l-r)*0.85}`,`${a+p*0.3},${r+(l-r)*0.95}`,`${a},${l}`].join(" ")}e(bt,"generateCliffPath");function wt(t,o,a,r){return[`M${t-a},${o}`,`A${a},${r} 0 1,1 ${t+a},${o}`,`A${a},${r} 0 1,1 ${t-a},${o}`,"Z"].join(" ")}e(wt,"generateConfusionPath");var yt={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},It=e((t,o)=>{let a=t/2,r=o/2;return{complex:{cx:a/2,cy:r/2,x:0,y:0,w:a,h:r},complicated:{cx:a+a/2,cy:r/2,x:a,y:0,w:a,h:r},chaotic:{cx:a/2,cy:r+r/2,x:0,y:r,w:a,h:r},clear:{cx:a+a/2,cy:r+r/2,x:a,y:r,w:a,h:r},confusion:{cx:a,cy:r,x:a*0.7,y:r*0.7,w:a*0.6,h:r*0.6}}},"getDomainLayouts"),Wt=e(()=>{let t=Be(),o=O();return Y(t,o.themeVariables).cynefin},"getCynefinDomainColors"),st=3,Rt=e((t,o,a,r)=>{let l=r.db,p=l.getDomains(),nt=l.getTransitions(),U=l.getDiagramTitle(),f=l.getAccTitle(),z=l.getAccDescription(),i=l.getConfig(),y=Wt();n.debug("Rendering Cynefin diagram");let{width:c,height:m,padding:D,showDomainDescriptions:h,boundaryAmplitude:Q}=i,Z=c+D*2,J=m+D*2,_={complex:y.complexBg,complicated:y.complicatedBg,clear:y.clearBg,chaotic:y.chaoticBg,confusion:y.confusionBg},L=G(o);if(B(L,J,Z,i.useMaxWidth??!0),L.attr("viewBox",`0 0 ${Z} ${J}`),f)L.append("title").text(f);if(z)L.append("desc").text(z);let N=L.append("g").attr("transform",`translate(${D}, ${D})`),K=It(c,m),ct=ht(i.seed,o),Ct=N.append("g").attr("class","cynefin-backgrounds"),rt=["complex","complicated","chaotic","clear"];for(let d of rt){let s=K[d];Ct.append("rect").attr("class","cynefinDomain").attr("x",s.x).attr("y",s.y).attr("width",s.w).attr("height",s.h).attr("fill",_[d]).attr("fill-opacity",0.4).attr("stroke","none")}let it=N.append("g").attr("class","cynefin-boundaries");it.append("path").attr("class","cynefinBoundary").attr("d",xt(c,m,ct,Q)).attr("fill","none"),it.append("path").attr("class","cynefinBoundary").attr("d",$t(c,m,ct+100,Q)).attr("fill","none"),it.append("path").attr("class","cynefinCliff").attr("d",bt(c,m)).attr("fill","none");let vt=c*0.15,Dt=m*0.15;N.append("path").attr("class","cynefinConfusion").attr("d",wt(c/2,m/2,vt,Dt)).attr("fill",_.confusion).attr("fill-opacity",0.5);let lt=N.append("g").attr("class","cynefin-labels");for(let d of rt){let s=K[d];lt.append("text").attr("class","cynefinDomainLabel").attr("x",s.cx).attr("y",h?s.cy-30:s.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(d.charAt(0).toUpperCase()+d.slice(1))}if(lt.append("text").attr("class","cynefinDomainLabel").attr("x",c/2).attr("y",h?m/2-10:m/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),h){let d=N.append("g").attr("class","cynefin-subtitles");for(let s of rt){let g=K[s],u=yt[s];d.append("text").attr("class","cynefinSubtitle").attr("x",g.cx).attr("y",g.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(u.model),d.append("text").attr("class","cynefinSubtitle").attr("x",g.cx).attr("y",g.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(u.practice)}d.append("text").attr("class","cynefinSubtitle").attr("x",c/2).attr("y",m/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(yt.confusion.practice)}let dt=N.append("g").attr("class","cynefin-items"),I=26,ft=10,kt=["complex","complicated","chaotic","clear","confusion"];for(let d of kt){let s=p.get(d);if(!s||s.items.length===0)continue;let g=K[d],u=d==="confusion",H=s.items,X=0;if(u&&s.items.length>st)X=s.items.length-st,H=s.items.slice(0,st);let W;if(u){let b=h?22:14;W=g.cy+b}else W=g.cy+(h?25:15);if([...H].forEach((b,F)=>{let A=W+F*(I+4),V=dt.append("g"),j=V.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",I/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(b.label),v=b.label.length*7,x=j.node();if(x&&typeof x.getBBox==="function"){let ot=x.getBBox();if(ot.width>0)v=ot.width}let M=v+ft*2,q=g.cx-M/2;V.attr("transform",`translate(${q}, ${A})`),V.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",M).attr("height",I).attr("rx",4).attr("ry",4).attr("fill",_[d]).attr("fill-opacity",0.95),j.attr("x",M/2).attr("y",I/2)}),X>0){let b=W+H.length*(I+4),F=`+${X} more`,A=dt.append("g"),V=A.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",I/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(F),j=F.length*7,v=V.node();if(v&&typeof v.getBBox==="function"){let q=v.getBBox();if(q.width>0)j=q.width}let x=j+ft*2,M=g.cx-x/2;A.attr("transform",`translate(${M}, ${b})`),A.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",x).attr("height",I).attr("rx",4).attr("ry",4).attr("fill",_[d]).attr("fill-opacity",0.6),V.attr("x",x/2).attr("y",I/2)}}if(nt.length>0){let d=L.select("defs").empty()?L.append("defs"):L.select("defs"),s=`cynefin-arrow-${o}`;d.append("marker").attr("id",s).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");let g=N.append("g").attr("class","cynefin-arrows");nt.forEach((u)=>{let H=K[u.from],X=K[u.to];if(!H||!X)return;if(u.from===u.to){n.warn(`Cynefin renderer: skipping self-loop on domain "${u.from}"`);return}let{cx:W,cy:b}=H,{cx:F,cy:A}=X,V=(W+F)/2,j=(b+A)/2,v=F-W,x=A-b,M=Math.sqrt(v*v+x*x),q=M*0.15,ot=-x/M,Tt=v/M,mt=V+ot*q,pt=j+Tt*q;if(g.append("path").attr("class","cynefinArrowLine").attr("d",`M${W},${b} Q${mt},${pt} ${F},${A}`).attr("fill","none").attr("marker-end",`url(#${s})`),u.label)g.append("text").attr("class","cynefinArrowLabel").attr("x",mt).attr("y",pt-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(u.label)})}if(U)N.append("text").attr("class","cynefinTitle").attr("x",c/2).attr("y",-D/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(U)},"draw"),Ft={draw:Rt},Vt=e(()=>{let t=Be(),o=O();return Y(t,o.themeVariables).cynefin},"getCynefinTheme"),_t=e(()=>{let t=Vt();return`
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
