import{K}from"./main-1g31nb70.js";import{e,n,Ce,C,g,N,v,w,k,x,T,E,S,V,F}from"./main-8gzg685w.js";import{ie}from"./main-m44xsvf1.js";var gt=e(()=>({domains:new Map,transitions:[]}),"createDefaultData"),nt=gt(),Bt=e(()=>nt.domains,"getDomains"),St=e(()=>nt.transitions,"getTransitions"),Mt=e((t)=>{if(!t)return;for(let o of t){let a=o.domain,r=(o.items??[]).map((l)=>({label:l.label}));nt.domains.set(a,{name:a,items:r})}},"setDomains"),zt=e((t)=>{if(!t)return;nt.transitions=t.filter((o)=>{if(o.from===o.to)return n.warn(`Cynefin: self-loop transition on domain "${o.from}" is not meaningful and will be skipped.`),!1;return!0}).map((o)=>({from:o.from,to:o.to,label:o.label||void 0}))},"setTransitions"),Lt=e(()=>F({...C.cynefin,...g().cynefin}),"getConfig"),Nt=e(()=>{v(),nt=gt()},"clear"),rt={getDomains:Bt,getTransitions:St,setDomains:Mt,setTransitions:zt,getConfig:Lt,clear:Nt,setAccTitle:w,getAccTitle:k,setDiagramTitle:E,getDiagramTitle:S,getAccDescription:T,setAccDescription:x},Pt=e((t)=>{K(t,rt),rt.setDomains(t.domains),rt.setTransitions(t.transitions)},"populate"),It={parse:e(async(t)=>{let o=await ie("cynefin",t);n.debug(o),Pt(o)},"parse")};function et(t){let o=t+1831565813|0;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296}e(et,"seededRandom");function ht(t){let o=0;for(let a=0;a<t.length;a++){let r=t.charCodeAt(a);o=(o<<5)-o+r,o|=0}return o}e(ht,"hashString");function xt(t,o){if(typeof t==="number"&&Number.isFinite(t)&&t!==0)return t;return ht(o)}e(xt,"resolveSeed");function $t(t,o,a,r){let l=t/2,p=r??t*0.015,ot=7,U=o/7,f=[];for(let i=0;i<=7;i++){let y=et(a+i*17)*p*2-p;f.push({x:l+y,y:i*U})}let P=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let y=f[i],c=f[i+1],m=(y.y+c.y)/2,M=i%2===0?1:-1,b=p*1.5*M*et(a+i*31+7),Q=y.x+b,Z=m,J=c.x-b;P+=` C${Q},${Z} ${J},${m} ${c.x},${c.y}`}return P}e($t,"generateFoldPath");function bt(t,o,a,r){let l=o/2,p=r??o*0.015,ot=7,U=t/7,f=[];for(let i=0;i<=7;i++){let y=et(a+i*23)*p*2-p;f.push({x:i*U,y:l+y})}let P=`M${f[0].x},${f[0].y}`;for(let i=0;i<f.length-1;i++){let y=f[i],c=f[i+1],m=(y.x+c.x)/2,M=i%2===0?1:-1,b=p*1.5*M*et(a+i*37+11),Q=m,Z=y.y+b,J=m,Y=c.y-b;P+=` C${Q},${Z} ${J},${Y} ${c.x},${c.y}`}return P}e(bt,"generateHorizontalBoundary");function wt(t,o){let a=t/2,r=o*0.5,l=o,p=t*0.03;return[`M${a},${r}`,`C${a+p},${r+(l-r)*0.2}`,`${a-p*1.5},${r+(l-r)*0.55}`,`${a+p*0.5},${r+(l-r)*0.75}`,`C${a-p},${r+(l-r)*0.85}`,`${a+p*0.3},${r+(l-r)*0.95}`,`${a},${l}`].join(" ")}e(wt,"generateCliffPath");function Ct(t,o,a,r){return[`M${t-a},${o}`,`A${a},${r} 0 1,1 ${t+a},${o}`,`A${a},${r} 0 1,1 ${t-a},${o}`,"Z"].join(" ")}e(Ct,"generateConfusionPath");var ut={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},Wt=e((t,o)=>{let a=t/2,r=o/2;return{complex:{cx:a/2,cy:r/2,x:0,y:0,w:a,h:r},complicated:{cx:a+a/2,cy:r/2,x:a,y:0,w:a,h:r},chaotic:{cx:a/2,cy:r+r/2,x:0,y:r,w:a,h:r},clear:{cx:a+a/2,cy:r+r/2,x:a,y:r,w:a,h:r},confusion:{cx:a,cy:r,x:a*0.7,y:r*0.7,w:a*0.6,h:r*0.6}}},"getDomainLayouts"),Rt=e(()=>{let t=Ce(),o=g();return F(t,o.themeVariables).cynefin},"getCynefinDomainColors"),ct=3,Ft=e((t,o,a,r)=>{let l=r.db,p=l.getDomains(),ot=l.getTransitions(),U=l.getDiagramTitle(),f=l.getAccTitle(),P=l.getAccDescription(),i=l.getConfig(),y=Rt();n.debug("Rendering Cynefin diagram");let{width:c,height:m,padding:M,showDomainDescriptions:b,boundaryAmplitude:Q}=i,Z=c+M*2,J=m+M*2,Y={complex:y.complexBg,complicated:y.complicatedBg,clear:y.clearBg,chaotic:y.chaoticBg,confusion:y.confusionBg},I=V(o);if(N(I,J,Z,i.useMaxWidth??!0),I.attr("viewBox",`0 0 ${Z} ${J}`),f)I.append("title").text(f);if(P)I.append("desc").text(P);let W=I.append("g").attr("transform",`translate(${M}, ${M})`),tt=Wt(c,m),lt=xt(i.seed,o),vt=W.append("g").attr("class","cynefin-backgrounds"),it=["complex","complicated","chaotic","clear"];for(let d of it){let s=tt[d];vt.append("rect").attr("class","cynefinDomain").attr("x",s.x).attr("y",s.y).attr("width",s.w).attr("height",s.h).attr("fill",Y[d]).attr("fill-opacity",0.4).attr("stroke","none")}let st=W.append("g").attr("class","cynefin-boundaries");st.append("path").attr("class","cynefinBoundary").attr("d",$t(c,m,lt,Q)).attr("fill","none"),st.append("path").attr("class","cynefinBoundary").attr("d",bt(c,m,lt+100,Q)).attr("fill","none"),st.append("path").attr("class","cynefinCliff").attr("d",wt(c,m)).attr("fill","none");let Dt=c*0.15,kt=m*0.15;W.append("path").attr("class","cynefinConfusion").attr("d",Ct(c/2,m/2,Dt,kt)).attr("fill",Y.confusion).attr("fill-opacity",0.5);let dt=W.append("g").attr("class","cynefin-labels");for(let d of it){let s=tt[d];dt.append("text").attr("class","cynefinDomainLabel").attr("x",s.cx).attr("y",b?s.cy-30:s.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(d.charAt(0).toUpperCase()+d.slice(1))}if(dt.append("text").attr("class","cynefinDomainLabel").attr("x",c/2).attr("y",b?m/2-10:m/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),b){let d=W.append("g").attr("class","cynefin-subtitles");for(let s of it){let h=tt[s],u=ut[s];d.append("text").attr("class","cynefinSubtitle").attr("x",h.cx).attr("y",h.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(u.model),d.append("text").attr("class","cynefinSubtitle").attr("x",h.cx).attr("y",h.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(u.practice)}d.append("text").attr("class","cynefinSubtitle").attr("x",c/2).attr("y",m/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(ut.confusion.practice)}let ft=W.append("g").attr("class","cynefin-items"),R=26,mt=10,Tt=["complex","complicated","chaotic","clear","confusion"];for(let d of Tt){let s=p.get(d);if(!s||s.items.length===0)continue;let h=tt[d],u=d==="confusion",O=s.items,X=0;if(u&&s.items.length>ct)X=s.items.length-ct,O=s.items.slice(0,ct);let _;if(u){let A=b?22:14;_=h.cy+A}else _=h.cy+(b?25:15);if([...O].forEach((A,H)=>{let z=_+H*(R+4),G=ft.append("g"),j=G.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",R/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(A.label),B=A.label.length*7,D=j.node();if(D&&typeof D.getBBox==="function"){let at=D.getBBox();if(at.width>0)B=at.width}let L=B+mt*2,q=h.cx-L/2;G.attr("transform",`translate(${q}, ${z})`),G.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",L).attr("height",R).attr("rx",4).attr("ry",4).attr("fill",Y[d]).attr("fill-opacity",0.95),j.attr("x",L/2).attr("y",R/2)}),X>0){let A=_+O.length*(R+4),H=`+${X} more`,z=ft.append("g"),G=z.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",R/2).attr("text-anchor","middle").attr("dominant-baseline","central").text(H),j=H.length*7,B=G.node();if(B&&typeof B.getBBox==="function"){let q=B.getBBox();if(q.width>0)j=q.width}let D=j+mt*2,L=h.cx-D/2;z.attr("transform",`translate(${L}, ${A})`),z.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",D).attr("height",R).attr("rx",4).attr("ry",4).attr("fill",Y[d]).attr("fill-opacity",0.6),G.attr("x",D/2).attr("y",R/2)}}if(ot.length>0){let d=I.select("defs").empty()?I.append("defs"):I.select("defs"),s=`cynefin-arrow-${o}`;d.append("marker").attr("id",s).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");let h=W.append("g").attr("class","cynefin-arrows");ot.forEach((u)=>{let O=tt[u.from],X=tt[u.to];if(!O||!X)return;if(u.from===u.to){n.warn(`Cynefin renderer: skipping self-loop on domain "${u.from}"`);return}let{cx:_,cy:A}=O,{cx:H,cy:z}=X,G=(_+H)/2,j=(A+z)/2,B=H-_,D=z-A,L=Math.sqrt(B*B+D*D),q=L*0.15,at=-D/L,At=B/L,pt=G+at*q,yt=j+At*q;if(h.append("path").attr("class","cynefinArrowLine").attr("d",`M${_},${A} Q${pt},${yt} ${H},${z}`).attr("fill","none").attr("marker-end",`url(#${s})`),u.label)h.append("text").attr("class","cynefinArrowLabel").attr("x",pt).attr("y",yt-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(u.label)})}if(U)W.append("text").attr("class","cynefinTitle").attr("x",c/2).attr("y",-M/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(U)},"draw"),Vt={draw:Ft},_t=e(()=>{let t=Ce(),o=g();return F(t,o.themeVariables).cynefin},"getCynefinTheme"),Et=e(()=>{let t=_t();return`
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
	`},"styles"),Ht=Et,Qt={parser:It,db:rt,renderer:Vt,styles:Ht};export{Qt as diagram};
