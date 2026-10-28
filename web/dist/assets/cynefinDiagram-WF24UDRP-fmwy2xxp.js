import{re}from"./main-bv9q656r.js";import{e,n,Ne,Q,m,B,w,k,S,T,E,P,C,G,Y}from"./main-588aq8c0.js";import{le}from"./main-d7mq9ass.js";var ut=e(()=>({domains:new Map,transitions:[]}),"createDefaultData"),et=ut(),At=e(()=>et.domains,"getDomains"),Bt=e(()=>et.transitions,"getTransitions"),St=e((t)=>{if(!t)return;for(let o of t){let a=o.domain,r=(o.items??[]).map((l)=>({label:l.label}));et.domains.set(a,{name:a,items:r})}},"setDomains"),Mt=e((t)=>{if(!t)return;et.transitions=t.filter((o)=>{if(o.from===o.to)return n.warn(`Cynefin: self-loop transition on domain "${o.from}" is not meaningful and will be skipped.`),!1;return!0}).map((o)=>({from:o.from,to:o.to,label:o.label||void 0}))},"setTransitions"),zt=e(()=>Y({...Q.cynefin,...m().cynefin}),"getConfig"),Lt=e(()=>{w(),et=ut()},"clear"),at={getDomains:At,getTransitions:Bt,setDomains:St,setTransitions:Mt,getConfig:zt,clear:Lt,setAccTitle:k,getAccTitle:S,setDiagramTitle:P,getDiagramTitle:C,getAccDescription:E,setAccDescription:T},Nt=e((t)=>{re(t,at),at.setDomains(t.domains),at.setTransitions(t.transitions)},"populate"),Pt={parse:e(async(t)=>{let o=await le("cynefin",t);n.debug(o),Nt(o)},"parse")};function tt(t){let o=t+1831565813|0;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296}e(tt,"seededRandom");function gt(t){let o=0;for(let a=0;a<t.length;a++){let r=t.charCodeAt(a);o=(o<<5)-o+r,o|=0}return o}e(gt,"hashString");function ht(t,o){if(typeof t==="number"&&Number.isFinite(t)&&t!==0)return t;return gt(o)}e(ht,"resolveSeed");function xt(t,o,a,r){let l=t/2,y=r??t*0.015,nt=7,q=o/7,f=[];for(let i=0;i<=7;i++){let u=tt(a+i*17)*y*2-y;f.push({x:l+u,y:i*q})}let L=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let u=f[i],c=f[i+1],p=(u.y+c.y)/2,A=i%2===0?1:-1,x=y*1.5*A*tt(a+i*31+7),U=u.x+x,Z=p,J=c.x-x;L+=` C${U},${Z} ${J},${p} ${c.x},${c.y}`}return L}e(xt,"generateFoldPath");function $t(t,o,a,r){let l=o/2,y=r??o*0.015,nt=7,q=t/7,f=[];for(let i=0;i<=7;i++){let u=tt(a+i*23)*y*2-y;f.push({x:i*q,y:l+u})}let L=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let u=f[i],c=f[i+1],p=(u.x+c.x)/2,A=i%2===0?1:-1,x=y*1.5*A*tt(a+i*37+11),U=p,Z=u.y+x,J=p,_=c.y-x;L+=` C${U},${Z} ${J},${_} ${c.x},${c.y}`}return L}e($t,"generateHorizontalBoundary");function bt(t,o){let a=t/2,r=o*0.5,l=o,y=t*0.03;return[`M${a},${r}`,`C${a+y},${r+(l-r)*0.2}`,`${a-y*1.5},${r+(l-r)*0.55}`,`${a+y*0.5},${r+(l-r)*0.75}`,`C${a-y},${r+(l-r)*0.85}`,`${a+y*0.3},${r+(l-r)*0.95}`,`${a},${l}`].join(" ")}e(bt,"generateCliffPath");function wt(t,o,a,r){return[`M${t-a},${o}`,`A${a},${r} 0 1,1 ${t+a},${o}`,`A${a},${r} 0 1,1 ${t-a},${o}`,"Z"].join(" ")}e(wt,"generateConfusionPath");var yt={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},It=e((t,o)=>{let a=t/2,r=o/2;return{complex:{cx:a/2,cy:r/2,x:0,y:0,w:a,h:r},complicated:{cx:a+a/2,cy:r/2,x:a,y:0,w:a,h:r},chaotic:{cx:a/2,cy:r+r/2,x:0,y:r,w:a,h:r},clear:{cx:a+a/2,cy:r+r/2,x:a,y:r,w:a,h:r},confusion:{cx:a,cy:r,x:a*0.7,y:r*0.7,w:a*0.6,h:r*0.6}}},"getDomainLayouts"),Wt=e(()=>{let t=Ne(),o=m();return Y(t,o.themeVariables).cynefin},"getCynefinDomainColors"),st=3,Rt=e((t,o,a,r)=>{let l=r.db,y=l.getDomains(),nt=l.getTransitions(),q=l.getDiagramTitle(),f=l.getAccTitle(),L=l.getAccDescription(),i=l.getConfig(),u=Wt();n.debug("Rendering Cynefin diagram");let{width:c,height:p,padding:A,showDomainDescriptions:x,boundaryAmplitude:U}=i,Z=c+A*2,J=p+A*2,_={complex:u.complexBg,complicated:u.complicatedBg,clear:u.clearBg,chaotic:u.chaoticBg,confusion:u.confusionBg},N=G(o);if(B(N,J,Z,i.useMaxWidth??!0),N.attr("viewBox",`0 0 ${Z} ${J}`),f)N.append("title").text(f);if(L)N.append("desc").text(L);let I=N.append("g").attr("transform",`translate(${A}, ${A})`),K=It(c,p),ct=ht(i.seed,o),Ct=I.append("g").attr("class","cynefin-backgrounds"),rt=["complex","complicated","chaotic","clear"];for(let d of rt){let s=K[d];Ct.append("rect").attr("class","cynefinDomain").attr("x",s.x).attr("y",s.y).attr("width",s.w).attr("height",s.h).attr("fill",_[d]).attr("fill-opacity",0.4).attr("stroke","none")}let it=I.append("g").attr("class","cynefin-boundaries");it.append("path").attr("class","cynefinBoundary").attr("d",xt(c,p,ct,U)).attr("fill","none"),it.append("path").attr("class","cynefinBoundary").attr("d",$t(c,p,ct+100,U)).attr("fill","none"),it.append("path").attr("class","cynefinCliff").attr("d",bt(c,p)).attr("fill","none");let vt=c*0.15,Dt=p*0.15;I.append("path").attr("class","cynefinConfusion").attr("d",wt(c/2,p/2,vt,Dt)).attr("fill",_.confusion).attr("fill-opacity",0.5);let lt=I.append("g").attr("class","cynefin-labels");for(let d of rt){let s=K[d];lt.append("text").attr("class","cynefinDomainLabel").attr("x",s.cx).attr("y",x?s.cy-30:s.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(d.charAt(0).toUpperCase()+d.slice(1))}if(lt.append("text").attr("class","cynefinDomainLabel").attr("x",c/2).attr("y",x?p/2-10:p/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),x){let d=I.append("g").attr("class","cynefin-subtitles");for(let s of rt){let h=K[s],g=yt[s];d.append("text").attr("class","cynefinSubtitle").attr("x",h.cx).attr("y",h.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(g.model),d.append("text").attr("class","cynefinSubtitle").attr("x",h.cx).attr("y",h.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(g.practice)}d.append("text").attr("class","cynefinSubtitle").attr("x",c/2).attr("y",p/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(yt.confusion.practice)}let dt=I.append("g").attr("class","cynefin-items"),W=26,ft=10,kt=["complex","complicated","chaotic","clear","confusion"];for(let d of kt){let s=y.get(d);if(!s||s.items.length===0)continue;let h=K[d],g=d==="confusion",H=s.items,O=0;if(g&&s.items.length>st)O=s.items.length-st,H=s.items.slice(0,st);let R;if(g){let v=x?22:14;R=h.cy+v}else R=h.cy+(x?25:15);if([...H].forEach((v,F)=>{let M=R+F*(W+4),V=dt.append("g"),X=V.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",W/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(v.label),D=v.label.length*7,b=X.node();if(b&&typeof b.getBBox==="function"){let ot=b.getBBox();if(ot.width>0)D=ot.width}let z=D+ft*2,j=h.cx-z/2;V.attr("transform",`translate(${j}, ${M})`),V.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",z).attr("height",W).attr("rx",4).attr("ry",4).attr("fill",_[d]).attr("fill-opacity",0.95),X.attr("x",z/2).attr("y",W/2)}),O>0){let v=R+H.length*(W+4),F=`+${O} more`,M=dt.append("g"),V=M.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",W/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(F),X=F.length*7,D=V.node();if(D&&typeof D.getBBox==="function"){let j=D.getBBox();if(j.width>0)X=j.width}let b=X+ft*2,z=h.cx-b/2;M.attr("transform",`translate(${z}, ${v})`),M.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",b).attr("height",W).attr("rx",4).attr("ry",4).attr("fill",_[d]).attr("fill-opacity",0.6),V.attr("x",b/2).attr("y",W/2)}}if(nt.length>0){let d=N.select("defs").empty()?N.append("defs"):N.select("defs"),s=`cynefin-arrow-${o}`;d.append("marker").attr("id",s).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");let h=I.append("g").attr("class","cynefin-arrows");nt.forEach((g)=>{let H=K[g.from],O=K[g.to];if(!H||!O)return;if(g.from===g.to){n.warn(`Cynefin renderer: skipping self-loop on domain "${g.from}"`);return}let{cx:R,cy:v}=H,{cx:F,cy:M}=O,V=(R+F)/2,X=(v+M)/2,D=F-R,b=M-v,z=Math.sqrt(D*D+b*b),j=z*0.15,ot=-b/z,Tt=D/z,mt=V+ot*j,pt=X+Tt*j;if(h.append("path").attr("class","cynefinArrowLine").attr("d",`M${R},${v} Q${mt},${pt} ${F},${M}`).attr("fill","none").attr("marker-end",`url(#${s})`),g.label)h.append("text").attr("class","cynefinArrowLabel").attr("x",mt).attr("y",pt-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(g.label)})}if(q)I.append("text").attr("class","cynefinTitle").attr("x",c/2).attr("y",-A/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(q)},"draw"),Ft={draw:Rt},Vt=e(()=>{let t=Ne(),o=m();return Y(t,o.themeVariables).cynefin},"getCynefinTheme"),_t=e(()=>{let t=Vt();return`
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
