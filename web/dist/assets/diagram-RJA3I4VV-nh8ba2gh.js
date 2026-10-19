import{K}from"./main-1g31nb70.js";import{e,n,Ce,C,g,N,v,w,k,x,T,E,S,V,F}from"./main-8gzg685w.js";import{ie}from"./main-m44xsvf1.js";var y={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},O=32,R={axes:[],curves:[],options:y},f=structuredClone(R),W=C.radar,H=e(()=>F({...W,...g().radar}),"getConfig"),I=e(()=>f.axes,"getAxes"),j=e(()=>f.curves,"getCurves"),U=e(()=>f.options,"getOptions"),X=e((r)=>{f.axes=r.map((t)=>({name:t.name,label:t.label??t.name}))},"setAxes"),Y=e((r)=>{f.curves=r.map((t)=>({name:t.name,label:t.label??t.name,entries:Z(t.entries)}))},"setCurves"),Z=e((r)=>{if(r[0].axis==null)return r.map((a)=>a.value);let t=I();if(t.length===0)throw Error("Axes must be populated before curves for reference entries");return t.map((a)=>{let s=r.find((o)=>o.axis?.$refText===a.name);if(s===void 0)throw Error("Missing entry for axis "+a.label);return s.value})},"computeCurveEntries"),q=e((r)=>{let t=r.reduce((a,s)=>(a[s.name]=s,a),{});if(f.options={showLegend:t.showLegend?.value??y.showLegend,ticks:t.ticks?.value??y.ticks,max:t.max?.value??y.max,min:t.min?.value??y.min,graticule:t.graticule?.value??y.graticule},f.options.ticks>O)n.warn(`Radar diagram ticks (${f.options.ticks}) exceeds maximum allowed (${O}). Using ${O} instead.`),f.options.ticks=O},"setOptions"),J=e(()=>{v(),f=structuredClone(R)},"clear"),M={getAxes:I,getCurves:j,getOptions:U,setAxes:X,setCurves:Y,setOptions:q,getConfig:H,clear:J,setAccTitle:w,getAccTitle:k,setDiagramTitle:E,getDiagramTitle:S,getAccDescription:T,setAccDescription:x},Q=e((r)=>{K(r,M);let{axes:t,curves:a,options:s}=r;M.setAxes(t),M.setCurves(a),M.setOptions(s)},"populate"),tt={parse:e(async(r)=>{let t=await ie("radar",r);n.debug(t),Q(t)},"parse")},et=e((r,t,a,s)=>{let o=s.db,c=o.getAxes(),d=o.getCurves(),i=o.getOptions(),l=o.getConfig(),u=o.getDiagramTitle(),m=V(t),p=at(m,l),h=i.max??Math.max(...d.map((L)=>Math.max(...L.entries))),b=i.min,A=Math.min(l.width,l.height)/2;rt(p,c,A,i.ticks,i.graticule),nt(p,c,A,l),_(p,c,d,b,h,i.graticule,l),z(p,d,i.showLegend,l),p.append("text").attr("class","radarTitle").text(u).attr("x",0).attr("y",-l.height/2-l.marginTop)},"draw"),at=e((r,t)=>{let a=t.width+t.marginLeft+t.marginRight,s=t.height+t.marginTop+t.marginBottom,o={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return N(r,s,a,t.useMaxWidth??!0),r.attr("viewBox",`0 0 ${a} ${s}`).attr("overflow","visible"),r.append("g").attr("transform",`translate(${o.x}, ${o.y})`)},"drawFrame"),rt=e((r,t,a,s,o)=>{if(o==="circle")for(let c=0;c<s;c++){let d=a*(c+1)/s;r.append("circle").attr("r",d).attr("class","radarGraticule")}else if(o==="polygon"){let c=t.length;for(let d=0;d<s;d++){let i=a*(d+1)/s,l=t.map((u,m)=>{let p=2*m*Math.PI/c-Math.PI/2,h=i*Math.cos(p),b=i*Math.sin(p);return`${h},${b}`}).join(" ");r.append("polygon").attr("points",l).attr("class","radarGraticule")}}},"drawGraticule"),nt=e((r,t,a,s)=>{let o=t.length;for(let c=0;c<o;c++){let d=t[c].label,i=2*c*Math.PI/o-Math.PI/2,l=Math.cos(i),u=Math.sin(i);r.append("line").attr("x1",0).attr("y1",0).attr("x2",a*s.axisScaleFactor*l).attr("y2",a*s.axisScaleFactor*u).attr("class","radarAxisLine");let m=l>0.01?"start":l<-0.01?"end":"middle",p=u>0.01?"hanging":u<-0.01?"auto":"central",h=4;r.append("text").text(d).attr("x",a*s.axisLabelFactor*l+h*l).attr("y",a*s.axisLabelFactor*u+h*u).attr("text-anchor",m).attr("dominant-baseline",p).attr("class","radarAxisLabel")}},"drawAxes");function _(r,t,a,s,o,c,d){let i=t.length,l=Math.min(d.width,d.height)/2;a.forEach((u,m)=>{if(u.entries.length!==i)return;let p=u.entries.map((h,b)=>{let A=2*Math.PI*b/i-Math.PI/2,L=D(h,s,o,l),G=L*Math.cos(A),B=L*Math.sin(A);return{x:G,y:B}});if(c==="circle")r.append("path").attr("d",P(p,d.curveTension)).attr("class",`radarCurve-${m}`);else if(c==="polygon")r.append("polygon").attr("points",p.map((h)=>`${h.x},${h.y}`).join(" ")).attr("class",`radarCurve-${m}`)})}e(_,"drawCurves");function D(r,t,a,s){let o=Math.min(Math.max(r,t),a);return s*(o-t)/(a-t)}e(D,"relativeRadius");function P(r,t){let a=r.length,s=`M${r[0].x},${r[0].y}`;for(let o=0;o<a;o++){let c=r[(o-1+a)%a],d=r[o],i=r[(o+1)%a],l=r[(o+2)%a],u={x:d.x+(i.x-c.x)*t,y:d.y+(i.y-c.y)*t},m={x:i.x-(l.x-d.x)*t,y:i.y-(l.y-d.y)*t};s+=` C${u.x},${u.y} ${m.x},${m.y} ${i.x},${i.y}`}return`${s} Z`}e(P,"closedRoundCurve");function z(r,t,a,s){if(!a)return;let o=(s.width/2+s.marginRight)*3/4,c=-(s.height/2+s.marginTop)*3/4,d=20;t.forEach((i,l)=>{let u=r.append("g").attr("transform",`translate(${o}, ${c+l*d})`);u.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${l}`),u.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(i.label)})}e(z,"drawLegend");var st={draw:et},ot=e((r,t)=>{let a="";for(let s=0;s<r.THEME_COLOR_LIMIT;s++){let o=r[`cScale${s}`];a+=`
		.radarCurve-${s} {
			color: ${o};
			fill: ${o};
			fill-opacity: ${t.curveOpacity};
			stroke: ${o};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${s} {
			fill: ${o};
			fill-opacity: ${t.curveOpacity};
			stroke: ${o};
		}
		`}return a},"genIndexStyles"),it=e((r)=>{let t=Ce(),a=g(),s=F(t,a.themeVariables),o=F(s.radar,r);return{themeVariables:s,radarOptions:o}},"buildRadarStyleOptions"),lt=e(({radar:r}={})=>{let{themeVariables:t,radarOptions:a}=it(r);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${a.axisColor};
		stroke-width: ${a.axisStrokeWidth};
	}
	.radarAxisLabel {
		font-size: ${a.axisLabelFontSize}px;
		color: ${a.axisColor};
	}
	.radarGraticule {
		fill: ${a.graticuleColor};
		fill-opacity: ${a.graticuleOpacity};
		stroke: ${a.graticuleColor};
		stroke-width: ${a.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${a.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${ot(t,a)}
	`},"styles"),ht={parser:tt,db:M,renderer:st,styles:lt};export{ht as diagram};
