import{e,n,Ne,m,N,B,w,i,G}from"./main-ayc6gdzf.js";var O="",D="",E="",W=[],A=new Map,F=e((t)=>N(t,i()),"sanitizeText"),z=e((t)=>{switch(t.type){case"terminal":return{...t,value:F(t.value)};case"nonterminal":return{...t,name:F(t.name)};case"sequence":return{...t,elements:t.elements.map(z)};case"choice":return{...t,alternatives:t.alternatives.map(z)};case"optional":return{...t,element:z(t.element)};case"repetition":return{...t,element:z(t.element),separator:t.separator?z(t.separator):void 0};case"special":return{...t,text:F(t.text)}}},"sanitizeAstNode"),U=e(()=>{O="",D="",E="",W.length=0,A.clear(),w(),n.debug("[Railroad] Database cleared")},"clear"),L=e((t)=>{O=F(t),n.debug("[Railroad] Title set:",t)},"setTitle"),I=e(()=>O,"getTitle"),j=e((t)=>{let o={...t,name:F(t.name),definition:z(t.definition),comment:t.comment?F(t.comment):void 0};if(n.debug("[Railroad] Adding rule:",o.name),A.has(o.name))n.warn(`[Railroad] Rule '${o.name}' is already defined. Overwriting.`);W.push(o),A.set(o.name,o)},"addRule"),K=e(()=>W,"getRules"),J=e((t)=>A.get(t),"getRule"),Q=e((t)=>{D=F(t).replace(/^\s+/g,""),n.debug("[Railroad] Accessibility title set:",t)},"setAccTitle"),Z=e(()=>D,"getAccTitle"),V=e((t)=>{E=F(t).replace(/\n\s+/g,`
`),n.debug("[Railroad] Accessibility description set:",t)},"setAccDescription"),ee=e(()=>E,"getAccDescription"),te=L,re=I,ce={clear:U,setTitle:L,getTitle:I,addRule:j,getRules:K,getRule:J,setAccTitle:Q,getAccTitle:Z,setAccDescription:V,getAccDescription:ee,setDiagramTitle:te,getDiagramTitle:re},x={compactMode:!1,padding:10,verticalSeparation:8,horizontalSeparation:10,arcRadius:10,fontSize:14,fontFamily:"monospace",terminalFill:"#FFFFC0",terminalStroke:"#000000",terminalTextColor:"#000000",nonTerminalFill:"#FFFFFF",nonTerminalStroke:"#000000",nonTerminalTextColor:"#000000",lineColor:"#000000",strokeWidth:2,markerFill:"#000000",commentFill:"#E8E8E8",commentStroke:"#888888",commentTextColor:"#666666",specialFill:"#F0E0FF",specialStroke:"#8800CC",ruleNameColor:"#000066",showMarkers:!0,markerRadius:5},ie=/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$|^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([\d\s%+,./-]+\)$|^[a-z]+$/i,ne=/^[\w "',.-]+$/,ae=new Set(["compactMode","padding","verticalSeparation","horizontalSeparation","arcRadius","fontSize","fontFamily","terminalFill","terminalStroke","terminalTextColor","nonTerminalFill","nonTerminalStroke","nonTerminalTextColor","lineColor","strokeWidth","markerFill","commentFill","commentStroke","commentTextColor","specialFill","specialStroke","ruleNameColor","showMarkers","markerRadius"]),X=e((t)=>{if(!t)return!1;return Object.keys(t).every((o)=>o==="railroad"||ae.has(o))},"isRailroadStyleOptions"),oe=e((t)=>{if(!t)return{};if("railroad"in t&&t.railroad)return t.railroad;return X(t)?t:{}},"extractRailroadOverrides"),le=e((t)=>{if(!t||X(t))return{};let{railroad:o,svgId:s,theme:a,look:r,...l}=t;return l},"extractThemeOverrides"),g=e((t,o)=>{if(typeof t!=="string")return o;let s=t.trim();return ie.test(s)?s:o},"sanitizeColorValue"),H=e((t,o)=>{if(typeof t!=="string")return o;let s=t.trim();return ne.test(s)?s:o},"sanitizeFontFamilyValue"),R=e((t,o)=>{let s=typeof t==="number"?t:typeof t==="string"?Number.parseFloat(t):Number.NaN;return Number.isFinite(s)&&s>=0?s:o},"sanitizeNumberValue"),se=e((t)=>{let o=typeof t==="number"?t:typeof t==="string"?Number.parseFloat(t):Number.NaN;return Number.isFinite(o)&&o>0?o:void 0},"parseThemeFontSize"),de=e((t)=>{let o=H(t.fontFamily,x.fontFamily),s=se(t.fontSize)??x.fontSize;return{...x,fontFamily:o,fontSize:s,terminalFill:g(t.secondBkg??t.secondaryColor,x.terminalFill),terminalStroke:g(t.secondaryBorderColor??t.lineColor,x.terminalStroke),terminalTextColor:g(t.secondaryTextColor??t.textColor,x.terminalTextColor),nonTerminalFill:g(t.mainBkg??t.background,x.nonTerminalFill),nonTerminalStroke:g(t.primaryBorderColor??t.lineColor,x.nonTerminalStroke),nonTerminalTextColor:g(t.primaryTextColor??t.textColor,x.nonTerminalTextColor),lineColor:g(t.lineColor,x.lineColor),markerFill:g(t.lineColor,x.markerFill),commentFill:g(t.labelBackground??t.tertiaryColor,x.commentFill),commentStroke:g(t.tertiaryBorderColor??t.lineColor,x.commentStroke),commentTextColor:g(t.tertiaryTextColor??t.textColor,x.commentTextColor),specialFill:g(t.tertiaryColor??t.secondaryColor,x.specialFill),specialStroke:g(t.tertiaryBorderColor??t.secondaryBorderColor,x.specialStroke),ruleNameColor:g(t.titleColor??t.textColor,x.ruleNameColor)}},"buildThemeDefaults"),_=e((t)=>{let o=m(),s={...Ne(),...o.themeVariables??{},...le(t)},a=de(s),r={...o.railroad??{},...oe(t)};return{compactMode:r.compactMode??a.compactMode,padding:R(r.padding,a.padding),verticalSeparation:R(r.verticalSeparation,a.verticalSeparation),horizontalSeparation:R(r.horizontalSeparation,a.horizontalSeparation),arcRadius:R(r.arcRadius,a.arcRadius),fontSize:R(r.fontSize,a.fontSize),fontFamily:H(r.fontFamily,a.fontFamily),terminalFill:g(r.terminalFill,a.terminalFill),terminalStroke:g(r.terminalStroke,a.terminalStroke),terminalTextColor:g(r.terminalTextColor,a.terminalTextColor),nonTerminalFill:g(r.nonTerminalFill,a.nonTerminalFill),nonTerminalStroke:g(r.nonTerminalStroke,a.nonTerminalStroke),nonTerminalTextColor:g(r.nonTerminalTextColor,a.nonTerminalTextColor),lineColor:g(r.lineColor,a.lineColor),strokeWidth:R(r.strokeWidth,a.strokeWidth),markerFill:g(r.markerFill,a.markerFill),commentFill:g(r.commentFill,a.commentFill),commentStroke:g(r.commentStroke,a.commentStroke),commentTextColor:g(r.commentTextColor,a.commentTextColor),specialFill:g(r.specialFill,a.specialFill),specialStroke:g(r.specialStroke,a.specialStroke),ruleNameColor:g(r.ruleNameColor,a.ruleNameColor),showMarkers:r.showMarkers??a.showMarkers,markerRadius:R(r.markerRadius,a.markerRadius)}},"buildRailroadStyleOptions"),Jt=e((t)=>{let{fontFamily:o,fontSize:s,terminalFill:a,terminalStroke:r,terminalTextColor:l,nonTerminalFill:f,nonTerminalStroke:h,nonTerminalTextColor:d,lineColor:T,strokeWidth:u,markerFill:p,commentFill:v,commentStroke:c,commentTextColor:C,specialFill:b,specialStroke:y,ruleNameColor:S}=_(t);return`
  .railroad-diagram {
    font-family: ${o};
    font-size: ${s}px;
  }

  .railroad-terminal rect {
    fill: ${a};
    stroke: ${r};
    stroke-width: ${u}px;
  }

  .railroad-terminal text {
    fill: ${l};
    font-family: ${o};
    font-size: ${s}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-nonterminal rect {
    fill: ${f};
    stroke: ${h};
    stroke-width: ${u}px;
  }

  .railroad-nonterminal text {
    fill: ${d};
    font-family: ${o};
    font-size: ${s}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-line {
    stroke: ${T};
    stroke-width: ${u}px;
    fill: none;
  }

  .railroad-start circle,
  .railroad-end circle {
    fill: ${p};
  }

  .railroad-comment ellipse {
    fill: ${v};
    stroke: ${c};
    stroke-width: ${u}px;
  }

  .railroad-comment text {
    fill: ${C};
    font-style: italic;
    font-family: ${o};
    font-size: ${s}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-special rect {
    fill: ${b};
    stroke: ${y};
    stroke-width: ${u}px;
    stroke-dasharray: 5,3;
  }

  .railroad-special text {
    fill: ${d};
    font-family: ${o};
    font-size: ${s}px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .railroad-rule-name {
    font-weight: bold;
    fill: ${S};
    font-family: ${o};
    font-size: ${s}px;
  }

  .railroad-group {
    /* Grouping container, no specific styles */
  }
`},"getStyles"),k=class{constructor(){this.d=""}static{e(this,"PathBuilder")}moveTo(t,o){return this.d+=`M ${t} ${o} `,this}lineTo(t,o){return this.d+=`L ${t} ${o} `,this}horizontalTo(t){return this.d+=`H ${t} `,this}verticalTo(t){return this.d+=`V ${t} `,this}arcTo(t,o,s,a,r,l,f){return this.d+=`A ${t} ${o} ${s} ${a?1:0} ${r?1:0} ${l} ${f} `,this}build(){return this.d.trim()}},me=class{constructor(t,o=_()){this.textCache=new Map,this.svg=t,this.config=o}static{e(this,"RailroadRenderer")}measureText(t){if(this.textCache.has(t))return this.textCache.get(t);let o=this.svg.append("text").attr("font-family",this.config.fontFamily).attr("font-size",this.config.fontSize).text(t),s=o.node().getBBox(),a={width:s.width,height:s.height};return o.remove(),this.textCache.set(t,a),a}renderTerminal(t,o){let s=this.measureText(o),a=s.width+this.config.padding*2,r=s.height+this.config.padding*2,l=t.append("g").attr("class","railroad-terminal");return l.append("rect").attr("x",0).attr("y",0).attr("width",a).attr("height",r).attr("rx",10).attr("ry",10),l.append("text").attr("x",a/2).attr("y",r/2).text(o),{element:l.node(),dimensions:{width:a,height:r,up:r/2,down:r/2}}}renderNonTerminal(t,o){let s=this.measureText(o),a=s.width+this.config.padding*2,r=s.height+this.config.padding*2,l=t.append("g").attr("class","railroad-nonterminal");return l.append("rect").attr("x",0).attr("y",0).attr("width",a).attr("height",r),l.append("text").attr("x",a/2).attr("y",r/2).text(o),{element:l.node(),dimensions:{width:a,height:r,up:r/2,down:r/2}}}renderSequence(t,o){let s=o.map((d)=>this.renderExpression(t,d)),a=0,r=0,l=0;for(let d of s)a+=d.dimensions.width,r=Math.max(r,d.dimensions.up),l=Math.max(l,d.dimensions.down);a+=(s.length-1)*this.config.horizontalSeparation;let f=t.append("g").attr("class","railroad-sequence"),h=0;for(let d=0;d<s.length;d++){let T=s[d],u=r-T.dimensions.up;if(f.node().appendChild(T.element).setAttribute("transform",`translate(${h}, ${u})`),d<s.length-1){let v=h+T.dimensions.width,c=v+this.config.horizontalSeparation,C=r;f.append("path").attr("class","railroad-line").attr("d",new k().moveTo(v,C).lineTo(c,C).build())}h+=T.dimensions.width+this.config.horizontalSeparation}return{element:f.node(),dimensions:{width:a,height:r+l,up:r,down:l}}}renderChoice(t,o){let s=o.map((p)=>this.renderExpression(t,p)),a=0,r=0;for(let p of s)a=Math.max(a,p.dimensions.width),r+=p.dimensions.height;r+=(s.length-1)*this.config.verticalSeparation;let l=this.config.arcRadius,f=l*4,h=a+f,d=t.append("g").attr("class","railroad-choice"),T=0,u=r/2;for(let p of s){let v=T,c=v+p.dimensions.up,C=l*2+(a-p.dimensions.width)/2;d.node().appendChild(p.element).setAttribute("transform",`translate(${C}, ${v})`);let y=new k,S=c>u;if(c===u)y.moveTo(0,u).lineTo(C,c);else y.moveTo(0,u).arcTo(l,l,0,!1,S,l,u+(S?l:-l)).lineTo(l,c-(S?l:-l)).arcTo(l,l,0,!1,!S,l*2,c).lineTo(C,c);d.append("path").attr("class","railroad-line").attr("d",y.build());let M=new k,Y=C+p.dimensions.width,q=h-l*2;if(c===u)M.moveTo(Y,c).lineTo(h,u);else M.moveTo(Y,c).lineTo(q,c).arcTo(l,l,0,!1,!S,h-l,c+(S?-l:l)).lineTo(h-l,u+(S?l:-l)).arcTo(l,l,0,!1,S,h,u);d.append("path").attr("class","railroad-line").attr("d",M.build()),T+=p.dimensions.height+this.config.verticalSeparation}return{element:d.node(),dimensions:{width:h,height:r,up:u,down:r-u}}}renderOptional(t,o){let s=this.renderExpression(t,o),a=this.config.arcRadius,r=a*2,l=s.dimensions.width+a*4,f=s.dimensions.height+r,h=t.append("g").attr("class","railroad-optional"),d=a*2,T=r;h.node().appendChild(s.element).setAttribute("transform",`translate(${d}, ${T})`);let p=T+s.dimensions.up,v=new k().moveTo(0,p).lineTo(a*2,p);h.append("path").attr("class","railroad-line").attr("d",v.build());let c=new k().moveTo(d+s.dimensions.width,p).lineTo(l,p);h.append("path").attr("class","railroad-line").attr("d",c.build());let C=new k().moveTo(0,p).arcTo(a,a,0,!1,!1,a,p-a).lineTo(a,a).arcTo(a,a,0,!1,!0,a*2,0).lineTo(l-a*2,0).arcTo(a,a,0,!1,!0,l-a,a).lineTo(l-a,p-a).arcTo(a,a,0,!1,!1,l,p);return h.append("path").attr("class","railroad-line").attr("d",C.build()),{element:h.node(),dimensions:{width:l,height:f,up:p,down:f-p}}}renderRepetition(t,o,s){let a=this.renderExpression(t,o),r=this.config.arcRadius,l=r*2,f=a.dimensions.width+r*4,h=s===0,d=a.dimensions.height+l+(h?l:0),T=t.append("g").attr("class","railroad-repetition"),u=r*2,p=h?l:0;T.node().appendChild(a.element).setAttribute("transform",`translate(${u}, ${p})`);let c=p+a.dimensions.up;T.append("path").attr("class","railroad-line").attr("d",new k().moveTo(0,c).lineTo(r*2,c).build()),T.append("path").attr("class","railroad-line").attr("d",new k().moveTo(u+a.dimensions.width,c).lineTo(f,c).build());let C=p+a.dimensions.height+r,b=new k().moveTo(u+a.dimensions.width,c).arcTo(r,r,0,!1,!0,u+a.dimensions.width+r,c+r).lineTo(u+a.dimensions.width+r,C).arcTo(r,r,0,!1,!0,u+a.dimensions.width,C+r).lineTo(r*2,C+r).arcTo(r,r,0,!1,!0,r,C).lineTo(r,c+r).arcTo(r,r,0,!1,!0,r*2,c);if(T.append("path").attr("class","railroad-line").attr("d",b.build()),h){let y=new k().moveTo(0,c).arcTo(r,r,0,!1,!1,r,c-r).lineTo(r,r).arcTo(r,r,0,!1,!0,r*2,0).lineTo(f-r*2,0).arcTo(r,r,0,!1,!0,f-r,r).lineTo(f-r,c-r).arcTo(r,r,0,!1,!1,f,c);T.append("path").attr("class","railroad-line").attr("d",y.build())}return{element:T.node(),dimensions:{width:f,height:d,up:c,down:d-c}}}renderSpecial(t,o){let s=this.measureText("? "+o+" ?"),a=s.width+this.config.padding*2,r=s.height+this.config.padding*2,l=t.append("g").attr("class","railroad-special");return l.append("rect").attr("x",0).attr("y",0).attr("width",a).attr("height",r),l.append("text").attr("x",a/2).attr("y",r/2).text("? "+o+" ?"),{element:l.node(),dimensions:{width:a,height:r,up:r/2,down:r/2}}}renderExpression(t,o){switch(o.type){case"terminal":return this.renderTerminal(t,o.value);case"nonterminal":return this.renderNonTerminal(t,o.name);case"sequence":return this.renderSequence(t,o.elements);case"choice":return this.renderChoice(t,o.alternatives);case"optional":return this.renderOptional(t,o.element);case"repetition":return this.renderRepetition(t,o.element,o.min);case"special":return this.renderSpecial(t,o.text);default:throw Error(`Unknown node type: ${o.type}`)}}renderRule(t,o){let s=this.svg.append("g").attr("class","railroad-rule").attr("transform",`translate(0, ${o})`),a=t.name+" =",r=this.measureText(a).width+20,l=r+20,f=s.append("g"),h=this.renderExpression(f,t.definition),d=Math.max(20,h.dimensions.up),T=d-h.dimensions.up;return f.attr("transform",`translate(${l}, ${T})`),s.append("g").attr("class","railroad-rule-name-group").append("text").attr("class","railroad-rule-name").attr("x",0).attr("y",d).text(a),s.append("g").attr("class","railroad-start").append("circle").attr("cx",r).attr("cy",d).attr("r",this.config.markerRadius),s.append("g").attr("class","railroad-end").append("circle").attr("cx",l+h.dimensions.width+10).attr("cy",d).attr("r",this.config.markerRadius),s.append("path").attr("class","railroad-line").attr("d",new k().moveTo(r+this.config.markerRadius,d).lineTo(l,d).build()),s.append("path").attr("class","railroad-line").attr("d",new k().moveTo(l+h.dimensions.width,d).lineTo(l+h.dimensions.width+10-this.config.markerRadius,d).build()),{height:Math.max(40,T+h.dimensions.height+this.config.padding*2),width:l+h.dimensions.width+10+this.config.markerRadius}}renderDiagram(t){let o=this.config.padding,s=0;for(let a of t){let r=this.renderRule(a,o);o+=r.height+this.config.verticalSeparation,s=Math.max(s,r.width)}return{width:s+this.config.padding*2,height:o+this.config.padding}}},P=e((t,o,s)=>{B(t,o.height,o.width,s),t.attr("viewBox",`0 0 ${o.width} ${o.height}`)},"configureRailroadSvgSize"),he=e((t,o,s)=>{n.debug(`[Railroad] Rendering diagram
`+t);try{let a=G(o);a.attr("class","railroad-diagram");let l=m().railroad?.useMaxWidth??!0,f=ce.getRules();if(n.debug(`[Railroad] Rendering ${f.length} rules`),f.length===0){n.warn("[Railroad] No rules to render"),P(a,{height:100,width:200},l);return}let d=new me(a,_()).renderDiagram(f);P(a,d,l),n.debug("[Railroad] Render complete")}catch(a){throw n.error("[Railroad] Render error:",a),a}},"draw"),er={draw:he};
export{ce,Jt,er};
