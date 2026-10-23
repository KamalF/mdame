import{ee}from"./main-q3w7pm59.js";import{e,n,Me,Q,m,X,w,x,S,k,E,P,C,G,Y}from"./main-eqghj39w.js";import{le}from"./main-a3tp0and.js";var f={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},L=32,T={axes:[],curves:[],options:f},v=structuredClone(T),B=Q.radar,W=e(()=>Y({...B,...m().radar}),"getConfig"),O=e(()=>v.axes,"getAxes"),V=e(()=>v.curves,"getCurves"),H=e(()=>v.options,"getOptions"),j=e((r)=>{v.axes=r.map((t)=>({name:t.name,label:t.label??t.name}))},"setAxes"),U=e((r)=>{v.curves=r.map((t)=>({name:t.name,label:t.label??t.name,entries:K(t.entries)}))},"setCurves"),K=e((r)=>{if(r[0].axis==null)return r.map((a)=>a.value);let t=O();if(t.length===0)throw Error("Axes must be populated before curves for reference entries");return t.map((a)=>{let s=r.find((o)=>o.axis?.$refText===a.name);if(s===void 0)throw Error("Missing entry for axis "+a.label);return s.value})},"computeCurveEntries"),N=e((r)=>{let t=r.reduce((a,s)=>(a[s.name]=s,a),{});if(v.options={showLegend:t.showLegend?.value??f.showLegend,ticks:t.ticks?.value??f.ticks,max:t.max?.value??f.max,min:t.min?.value??f.min,graticule:t.graticule?.value??f.graticule},v.options.ticks>L)n.warn(`Radar diagram ticks (${v.options.ticks}) exceeds maximum allowed (${L}). Using ${L} instead.`),v.options.ticks=L},"setOptions"),Z=e(()=>{w(),v=structuredClone(T)},"clear"),A={getAxes:O,getCurves:V,getOptions:H,setAxes:j,setCurves:U,setOptions:N,getConfig:W,clear:Z,setAccTitle:x,getAccTitle:S,setDiagramTitle:P,getDiagramTitle:C,getAccDescription:E,setAccDescription:k},q=e((r)=>{ee(r,A);let{axes:t,curves:a,options:s}=r;A.setAxes(t),A.setCurves(a),A.setOptions(s)},"populate"),J={parse:e(async(r)=>{let t=await le("radar",r);n.debug(t),q(t)},"parse")},tt=e((r,t,a,s)=>{let o=s.db,c=o.getAxes(),d=o.getCurves(),i=o.getOptions(),l=o.getConfig(),u=o.getDiagramTitle(),g=G(t),p=et(g,l),h=i.max??Math.max(...d.map((M)=>Math.max(...M.entries))),y=i.min,b=Math.min(l.width,l.height)/2;at(p,c,b,i.ticks,i.graticule),rt(p,c,b,l),R(p,c,d,y,h,i.graticule,l),F(p,d,i.showLegend,l),p.append("text").attr("class","radarTitle").text(u).attr("x",0).attr("y",-l.height/2-l.marginTop)},"draw"),et=e((r,t)=>{let a=t.width+t.marginLeft+t.marginRight,s=t.height+t.marginTop+t.marginBottom,o={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return X(r,s,a,t.useMaxWidth??!0),r.attr("viewBox",`0 0 ${a} ${s}`).attr("overflow","visible"),r.append("g").attr("transform",`translate(${o.x}, ${o.y})`)},"drawFrame"),at=e((r,t,a,s,o)=>{if(o==="circle")for(let c=0;c<s;c++){let d=a*(c+1)/s;r.append("circle").attr("r",d).attr("class","radarGraticule")}else if(o==="polygon"){let c=t.length;for(let d=0;d<s;d++){let i=a*(d+1)/s,l=t.map((u,g)=>{let p=2*g*Math.PI/c-Math.PI/2,h=i*Math.cos(p),y=i*Math.sin(p);return`${h},${y}`}).join(" ");r.append("polygon").attr("points",l).attr("class","radarGraticule")}}},"drawGraticule"),rt=e((r,t,a,s)=>{let o=t.length;for(let c=0;c<o;c++){let d=t[c].label,i=2*c*Math.PI/o-Math.PI/2,l=Math.cos(i),u=Math.sin(i);r.append("line").attr("x1",0).attr("y1",0).attr("x2",a*s.axisScaleFactor*l).attr("y2",a*s.axisScaleFactor*u).attr("class","radarAxisLine");let g=l>0.01?"start":l<-0.01?"end":"middle",p=u>0.01?"hanging":u<-0.01?"auto":"central",h=4;r.append("text").text(d).attr("x",a*s.axisLabelFactor*l+h*l).attr("y",a*s.axisLabelFactor*u+h*u).attr("text-anchor",g).attr("dominant-baseline",p).attr("class","radarAxisLabel")}},"drawAxes");function R(r,t,a,s,o,c,d){let i=t.length,l=Math.min(d.width,d.height)/2;a.forEach((u,g)=>{if(u.entries.length!==i)return;let p=u.entries.map((h,y)=>{let b=2*Math.PI*y/i-Math.PI/2,M=I(h,s,o,l),D=M*Math.cos(b),z=M*Math.sin(b);return{x:D,y:z}});if(c==="circle")r.append("path").attr("d",_(p,d.curveTension)).attr("class",`radarCurve-${g}`);else if(c==="polygon")r.append("polygon").attr("points",p.map((h)=>`${h.x},${h.y}`).join(" ")).attr("class",`radarCurve-${g}`)})}e(R,"drawCurves");function I(r,t,a,s){let o=Math.min(Math.max(r,t),a);return s*(o-t)/(a-t)}e(I,"relativeRadius");function _(r,t){let a=r.length,s=`M${r[0].x},${r[0].y}`;for(let o=0;o<a;o++){let c=r[(o-1+a)%a],d=r[o],i=r[(o+1)%a],l=r[(o+2)%a],u={x:d.x+(i.x-c.x)*t,y:d.y+(i.y-c.y)*t},g={x:i.x-(l.x-d.x)*t,y:i.y-(l.y-d.y)*t};s+=` C${u.x},${u.y} ${g.x},${g.y} ${i.x},${i.y}`}return`${s} Z`}e(_,"closedRoundCurve");function F(r,t,a,s){if(!a)return;let o=(s.width/2+s.marginRight)*3/4,c=-(s.height/2+s.marginTop)*3/4,d=20;t.forEach((i,l)=>{let u=r.append("g").attr("transform",`translate(${o}, ${c+l*d})`);u.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${l}`),u.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(i.label)})}e(F,"drawLegend");var nt={draw:tt},st=e((r,t)=>{let a="";for(let s=0;s<r.THEME_COLOR_LIMIT;s++){let o=r[`cScale${s}`];a+=`
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
		`}return a},"genIndexStyles"),ot=e((r)=>{let t=Me(),a=m(),s=Y(t,a.themeVariables),o=Y(s.radar,r);return{themeVariables:s,radarOptions:o}},"buildRadarStyleOptions"),it=e(({radar:r}={})=>{let{themeVariables:t,radarOptions:a}=ot(r);return`
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
	${st(t,a)}
	`},"styles"),xt={parser:J,db:A,renderer:nt,styles:it};export{xt as diagram};
