import{e,X,w,x,S,k,E,P,C,i,l}from"./main-fwb472nv.js";import{$r,ni,ps,Ot}from"./main-bk6q37qg.js";import{Xt}from"./main-w4ynjm5t.js";import{it}from"./main-6htmk5zr.js";var st=function(){var t=e(function(y,s,a,c){for(a=a||{},c=y.length;c--;a[y[c]]=s);return a},"o"),r=[6,8,10,11,12,14,16,17,18],o=[1,9],g=[1,10],n=[1,11],d=[1,12],m=[1,13],h=[1,14],b={trace:e(function(){},"trace"),yy:{},symbols_:{error:2,start:3,journey:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,taskName:18,taskData:19,$accept:0,$end:1},terminals_:{2:"error",4:"journey",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",18:"taskName",19:"taskData"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,2]],performAction:e(function(s,a,c,f,p,u,I){var T=u.length-1;switch(p){case 1:return u[T-1];case 2:this.$=[];break;case 3:u[T-1].push(u[T]),this.$=u[T-1];break;case 4:case 5:this.$=u[T];break;case 6:case 7:this.$=[];break;case 8:f.setDiagramTitle(u[T].substr(6)),this.$=u[T].substr(6);break;case 9:this.$=u[T].trim(),f.setAccTitle(this.$);break;case 10:case 11:this.$=u[T].trim(),f.setAccDescription(this.$);break;case 12:f.addSection(u[T].substr(8)),this.$=u[T].substr(8);break;case 13:f.addTask(u[T-1],u[T]),this.$="task";break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(r,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:o,12:g,14:n,16:d,17:m,18:h},t(r,[2,7],{1:[2,1]}),t(r,[2,3]),{9:15,11:o,12:g,14:n,16:d,17:m,18:h},t(r,[2,5]),t(r,[2,6]),t(r,[2,8]),{13:[1,16]},{15:[1,17]},t(r,[2,11]),t(r,[2,12]),{19:[1,18]},t(r,[2,4]),t(r,[2,9]),t(r,[2,10]),t(r,[2,13])],defaultActions:{},parseError:e(function(s,a){if(a.recoverable)this.trace(s);else{var c=Error(s);throw c.hash=a,c}},"parseError"),parse:e(function(s){var a=this,c=[0],f=[],p=[null],u=[],I=this.table,T="",N=0,ct=0,ht=0,vt=2,ut=1,wt=u.slice.call(arguments,1),M=Object.create(this.lexer),W={yy:{}};for(var Q in this.yy)if(Object.prototype.hasOwnProperty.call(this.yy,Q))W.yy[Q]=this.yy[Q];if(M.setInput(s,W.yy),W.yy.lexer=M,W.yy.parser=this,typeof M.yylloc>"u")M.yylloc={};var D=M.yylloc;u.push(D);var Tt=M.options&&M.options.ranges;if(typeof W.yy.parseError==="function")this.parseError=W.yy.parseError;else this.parseError=Object.getPrototypeOf(this).parseError;function St(V){c.length=c.length-2*V,p.length=p.length-V,u.length=u.length-V}e(St,"popStack");function yt(){var V=f.pop()||M.lex()||ut;if(typeof V!=="number"){if(V instanceof Array)f=V,V=f.pop();V=a.symbols_[V]||V}return V}e(yt,"lex");var A,tt,O,F,Ut,et,Y={},Z,B,dt,J;while(!0){if(O=c[c.length-1],this.defaultActions[O])F=this.defaultActions[O];else{if(A===null||typeof A>"u")A=yt();F=I[O]&&I[O][A]}if(typeof F>"u"||!F.length||!F[0]){var rt="";J=[];for(Z in I[O])if(this.terminals_[Z]&&Z>vt)J.push("'"+this.terminals_[Z]+"'");if(M.showPosition)rt="Parse error on line "+(N+1)+`:
`+M.showPosition()+`
Expecting `+J.join(", ")+", got '"+(this.terminals_[A]||A)+"'";else rt="Parse error on line "+(N+1)+": Unexpected "+(A==ut?"end of input":"'"+(this.terminals_[A]||A)+"'");this.parseError(rt,{text:M.match,token:this.terminals_[A]||A,line:M.yylineno,loc:D,expected:J})}if(F[0]instanceof Array&&F.length>1)throw Error("Parse Error: multiple actions possible at state: "+O+", token: "+A);switch(F[0]){case 1:if(c.push(A),p.push(M.yytext),u.push(M.yylloc),c.push(F[1]),A=null,!tt){if(ct=M.yyleng,T=M.yytext,N=M.yylineno,D=M.yylloc,ht>0)ht--}else A=tt,tt=null;break;case 2:if(B=this.productions_[F[1]][1],Y.$=p[p.length-B],Y._$={first_line:u[u.length-(B||1)].first_line,last_line:u[u.length-1].last_line,first_column:u[u.length-(B||1)].first_column,last_column:u[u.length-1].last_column},Tt)Y._$.range=[u[u.length-(B||1)].range[0],u[u.length-1].range[1]];if(et=this.performAction.apply(Y,[T,ct,N,W.yy,F[1],p,u].concat(wt)),typeof et<"u")return et;if(B)c=c.slice(0,-1*B*2),p=p.slice(0,-1*B),u=u.slice(0,-1*B);c.push(this.productions_[F[1]][0]),p.push(Y.$),u.push(Y._$),dt=I[c[c.length-2]][c[c.length-1]],c.push(dt);break;case 3:return!0}}return!0},"parse")},_=function(){var y={EOF:1,parseError:e(function(a,c){if(this.yy.parser)this.yy.parser.parseError(a,c);else throw Error(a)},"parseError"),setInput:e(function(s,a){if(this.yy=a||this.yy||{},this._input=s,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges)this.yylloc.range=[0,0];return this.offset=0,this},"setInput"),input:e(function(){var s=this._input[0];this.yytext+=s,this.yyleng++,this.offset++,this.match+=s,this.matched+=s;var a=s.match(/(?:\r\n?|\n).*/g);if(a)this.yylineno++,this.yylloc.last_line++;else this.yylloc.last_column++;if(this.options.ranges)this.yylloc.range[1]++;return this._input=this._input.slice(1),s},"input"),unput:e(function(s){var a=s.length,c=s.split(/(?:\r\n?|\n)/g);this._input=s+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-a),this.offset-=a;var f=this.match.split(/(?:\r\n?|\n)/g);if(this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),c.length-1)this.yylineno-=c.length-1;var p=this.yylloc.range;if(this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:c?(c.length===f.length?this.yylloc.first_column:0)+f[f.length-c.length].length-c[0].length:this.yylloc.first_column-a},this.options.ranges)this.yylloc.range=[p[0],p[0]+this.yyleng-a];return this.yyleng=this.yytext.length,this},"unput"),more:e(function(){return this._more=!0,this},"more"),reject:e(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:e(function(s){this.unput(this.match.slice(s))},"less"),pastInput:e(function(){var s=this.matched.substr(0,this.matched.length-this.match.length);return(s.length>20?"...":"")+s.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:e(function(){var s=this.match;if(s.length<20)s+=this._input.substr(0,20-s.length);return(s.substr(0,20)+(s.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:e(function(){var s=this.pastInput(),a=Array(s.length+1).join("-");return s+this.upcomingInput()+`
`+a+"^"},"showPosition"),test_match:e(function(s,a){var c,f,p;if(this.options.backtrack_lexer){if(p={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges)p.yylloc.range=this.yylloc.range.slice(0)}if(f=s[0].match(/(?:\r\n?|\n).*/g),f)this.yylineno+=f.length;if(this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:f?f[f.length-1].length-f[f.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+s[0].length},this.yytext+=s[0],this.match+=s[0],this.matches=s,this.yyleng=this.yytext.length,this.options.ranges)this.yylloc.range=[this.offset,this.offset+=this.yyleng];if(this._more=!1,this._backtrack=!1,this._input=this._input.slice(s[0].length),this.matched+=s[0],c=this.performAction.call(this,this.yy,this,a,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input)this.done=!1;if(c)return c;else if(this._backtrack){for(var u in p)this[u]=p[u];return!1}return!1},"test_match"),next:e(function(){if(this.done)return this.EOF;if(!this._input)this.done=!0;var s,a,c,f;if(!this._more)this.yytext="",this.match="";var p=this._currentRules();for(var u=0;u<p.length;u++)if(c=this._input.match(this.rules[p[u]]),c&&(!a||c[0].length>a[0].length)){if(a=c,f=u,this.options.backtrack_lexer)if(s=this.test_match(c,p[u]),s!==!1)return s;else if(this._backtrack){a=!1;continue}else return!1;else if(!this.options.flex)break}if(a){if(s=this.test_match(a,p[f]),s!==!1)return s;return!1}if(this._input==="")return this.EOF;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:e(function(){var a=this.next();if(a)return a;else return this.lex()},"lex"),begin:e(function(a){this.conditionStack.push(a)},"begin"),popState:e(function(){var a=this.conditionStack.length-1;if(a>0)return this.conditionStack.pop();else return this.conditionStack[0]},"popState"),_currentRules:e(function(){if(this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1])return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;else return this.conditions.INITIAL.rules},"_currentRules"),topState:e(function(a){if(a=this.conditionStack.length-1-Math.abs(a||0),a>=0)return this.conditionStack[a];else return"INITIAL"},"topState"),pushState:e(function(a){this.begin(a)},"pushState"),stateStackSize:e(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:e(function(a,c,f,p){var u=p;switch(f){case 0:break;case 1:break;case 2:return 10;case 3:break;case 4:break;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;break;case 8:return this.popState(),"acc_title_value";break;case 9:return this.begin("acc_descr"),14;break;case 10:return this.popState(),"acc_descr_value";break;case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 18;case 16:return 19;case 17:return":";case 18:return 6;case 19:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:journey\b)/i,/^(?:title\s[^#\n;]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^#:\n;]+)/i,/^(?:[^#:\n;]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18,19],inclusive:!0}}};return y}();b.lexer=_;function v(){this.yy={}}return e(v,"Parser"),v.prototype=b,b.Parser=v,new v}();st.parser=st;var $t=st,q="",lt=[],G=[],H=[],Mt=e(function(){lt.length=0,G.length=0,q="",H.length=0,w()},"clear"),Et=e(function(t){q=t,lt.push(t)},"addSection"),Ct=e(function(){return lt},"getSections"),Pt=e(function(){let t=ft(),r=100,o=0;while(!t&&o<r)t=ft(),o++;return G.push(...H),G},"getTasks"),It=e(function(){let t=[];return G.forEach((o)=>{if(o.people)t.push(...o.people)}),[...new Set(t)].sort()},"updateActors"),At=e(function(t,r){let o=r.substr(1).split(":"),g=0,n=[];if(o.length===1)g=Number(o[0]),n=[];else g=Number(o[0]),n=o[1].split(",");let d=n.map((h)=>h.trim()),m={section:q,type:q,people:d,task:t,score:g};H.push(m)},"addTask"),Ft=e(function(t){let r={section:q,type:q,description:t,task:t,classes:[]};G.push(r)},"addTaskOrg"),ft=e(function(){let t=e(function(o){return H[o].processed},"compileTask"),r=!0;for(let[o,g]of H.entries())t(o),r=r&&g.processed;return r},"compileTasks"),Vt=e(function(){return It()},"getActors"),pt={getConfig:e(()=>i().journey,"getConfig"),clear:Mt,setDiagramTitle:P,getDiagramTitle:C,setAccTitle:x,getAccTitle:S,setAccDescription:k,getAccDescription:E,addSection:Et,getSections:Ct,getTasks:Pt,addTask:At,addTaskOrg:Ft,getActors:Vt},Rt=e((t)=>`.label {
    font-family: ${t.fontFamily};
    color: ${t.textColor};
  }
  .mouth {
    stroke: #666;
  }

  line {
    stroke: ${t.textColor}
  }

  .legend {
    fill: ${t.textColor};
    font-family: ${t.fontFamily};
  }

  .label text {
    fill: #333;
  }
  .label {
    color: ${t.textColor}
  }

  .face {
    ${t.faceColor?`fill: ${t.faceColor}`:"fill: #FFF8DC"};
    stroke: #999;
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${t.mainBkg};
    stroke: ${t.nodeBorder};
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${t.arrowheadColor};
  }

  .edgePaths .path {
    stroke: ${t.lineColor};
    stroke-width: 1.5px;
  }

  .flowchart-link {
    stroke: ${t.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${t.edgeLabelBackground};
    rect {
      opacity: 0.5;
    }
    text-align: center;
  }

  .cluster rect {
  }

  .cluster text {
    fill: ${t.titleColor};
  }

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${t.fontFamily};
    font-size: 12px;
    background: ${t.tertiaryColor};
    border: 1px solid ${t.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .task-type-0, .section-type-0  {
    ${t.fillType0?`fill: ${t.fillType0}`:""};
  }
  .task-type-1, .section-type-1  {
    ${t.fillType0?`fill: ${t.fillType1}`:""};
  }
  .task-type-2, .section-type-2  {
    ${t.fillType0?`fill: ${t.fillType2}`:""};
  }
  .task-type-3, .section-type-3  {
    ${t.fillType0?`fill: ${t.fillType3}`:""};
  }
  .task-type-4, .section-type-4  {
    ${t.fillType0?`fill: ${t.fillType4}`:""};
  }
  .task-type-5, .section-type-5  {
    ${t.fillType0?`fill: ${t.fillType5}`:""};
  }
  .task-type-6, .section-type-6  {
    ${t.fillType0?`fill: ${t.fillType6}`:""};
  }
  .task-type-7, .section-type-7  {
    ${t.fillType0?`fill: ${t.fillType7}`:""};
  }

  .actor-0 {
    ${t.actor0?`fill: ${t.actor0}`:""};
  }
  .actor-1 {
    ${t.actor1?`fill: ${t.actor1}`:""};
  }
  .actor-2 {
    ${t.actor2?`fill: ${t.actor2}`:""};
  }
  .actor-3 {
    ${t.actor3?`fill: ${t.actor3}`:""};
  }
  .actor-4 {
    ${t.actor4?`fill: ${t.actor4}`:""};
  }
  .actor-5 {
    ${t.actor5?`fill: ${t.actor5}`:""};
  }
  ${it()}
`,"getStyles"),Lt=Rt,ot=e(function(t,r){return $r(t,r)},"drawRect"),Bt=e(function(t,r){let g=t.append("circle").attr("cx",r.cx).attr("cy",r.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),n=t.append("g");n.append("circle").attr("cx",r.cx-5).attr("cy",r.cy-5).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),n.append("circle").attr("cx",r.cx+5).attr("cy",r.cy-5).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666");function d(b){let _=Xt().startAngle(Math.PI/2).endAngle(3*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);b.append("path").attr("class","mouth").attr("d",_).attr("transform","translate("+r.cx+","+(r.cy+2)+")")}e(d,"smile");function m(b){let _=Xt().startAngle(3*Math.PI/2).endAngle(5*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);b.append("path").attr("class","mouth").attr("d",_).attr("transform","translate("+r.cx+","+(r.cy+7)+")")}e(m,"sad");function h(b){b.append("line").attr("class","mouth").attr("stroke",2).attr("x1",r.cx-5).attr("y1",r.cy+7).attr("x2",r.cx+5).attr("y2",r.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}if(e(h,"ambivalent"),r.score>3)d(n);else if(r.score<3)m(n);else h(n);return g},"drawFace"),xt=e(function(t,r){let o=t.append("circle");if(o.attr("cx",r.cx),o.attr("cy",r.cy),o.attr("class","actor-"+r.pos),o.attr("fill",r.fill),o.attr("stroke",r.stroke),o.attr("r",r.r),o.class!==void 0)o.attr("class",o.class);if(r.title!==void 0)o.append("title").text(r.title);return o},"drawCircle"),kt=e(function(t,r){return ps(t,r)},"drawText"),jt=e(function(t,r){function o(n,d,m,h,b){return n+","+d+" "+(n+m)+","+d+" "+(n+m)+","+(d+h-b)+" "+(n+m-b*1.2)+","+(d+h)+" "+n+","+(d+h)}e(o,"genPoints");let g=t.append("polygon");g.attr("points",o(r.x,r.y,50,20,7)),g.attr("class","labelBox"),r.y=r.y+r.labelMargin,r.x=r.x+0.5*r.labelMargin,kt(t,r)},"drawLabel"),Nt=e(function(t,r,o){let g=t.append("g"),n=Ot();n.x=r.x,n.y=r.y,n.fill=r.fill,n.width=o.width*r.taskCount+o.diagramMarginX*(r.taskCount-1),n.height=o.height,n.class="journey-section section-type-"+r.num,n.rx=3,n.ry=3,ot(g,n),bt(o)(r.text,g,n.x,n.y,n.width,n.height,{class:"journey-section section-type-"+r.num},o,r.colour)},"drawSection"),at=-1,zt=e(function(t,r,o,g){let n=r.x+o.width/2,d=t.append("g");at++;let m=450;d.append("line").attr("id",g+"-task"+at).attr("x1",n).attr("y1",r.y).attr("x2",n).attr("y2",m).attr("class","task-line").attr("stroke-width","1px").attr("stroke-dasharray","4 2").attr("stroke","#666"),Bt(d,{cx:n,cy:300+(5-r.score)*30,score:r.score});let h=Ot();h.x=r.x,h.y=r.y,h.fill=r.fill,h.width=o.width,h.height=o.height,h.class="task task-type-"+r.num,h.rx=3,h.ry=3,ot(d,h);let b=r.x+14;r.people.forEach((_)=>{let v=r.actors[_].color,y={cx:b,cy:r.y,r:7,fill:v,stroke:"#000",title:_,pos:r.actors[_].position};xt(d,y),b+=10}),bt(o)(r.task,d,h.x,h.y,h.width,h.height,{class:"task"},o,r.colour)},"drawTask"),Wt=e(function(t,r){ni(t,r)},"drawBackgroundRect"),bt=function(){function t(n,d,m,h,b,_,v,y){let s=d.append("text").attr("x",m+b/2).attr("y",h+_/2+5).style("font-color",y).style("text-anchor","middle").text(n);g(s,v)}e(t,"byText");function r(n,d,m,h,b,_,v,y,s){let{taskFontSize:a,taskFontFamily:c}=y,f=n.split(/<br\s*\/?>/gi);for(let p=0;p<f.length;p++){let u=p*a-a*(f.length-1)/2,I=d.append("text").attr("x",m+b/2).attr("y",h).attr("fill",s).style("text-anchor","middle").style("font-size",a).style("font-family",c);I.append("tspan").attr("x",m+b/2).attr("dy",u).text(f[p]),I.attr("y",h+_/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),g(I,v)}}e(r,"byTspan");function o(n,d,m,h,b,_,v,y){let s=d.append("switch"),c=s.append("foreignObject").attr("x",m).attr("y",h).attr("width",b).attr("height",_).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");c.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(n),r(n,s,m,h,b,_,v,y),g(c,v)}e(o,"byFo");function g(n,d){for(let m in d)if(m in d)n.attr(m,d[m])}return e(g,"_setTextAttrs"),function(n){return n.textPlacement==="fo"?o:n.textPlacement==="old"?t:r}}(),Yt=e(function(t,r){at=-1,t.append("defs").append("marker").attr("id",r+"-arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics"),U={drawRect:ot,drawCircle:xt,drawSection:Nt,drawText:kt,drawLabel:jt,drawTask:zt,drawBackgroundRect:Wt,initGraphics:Yt},qt=e(function(t){Object.keys(t).forEach(function(o){L[o]=t[o]})},"setConf"),j={},K=0;function _t(t){let r=i().journey,o=r.maxLabelWidth;K=0;let g=60;Object.keys(j).forEach((n)=>{let d=j[n].color,m={cx:20,cy:g,r:7,fill:d,stroke:"#000",pos:j[n].position};U.drawCircle(t,m);let h=t.append("text").attr("visibility","hidden").text(n),b=h.node().getBoundingClientRect().width;h.remove();let _=[];if(b<=o)_=[n];else{let v=n.split(" "),y="";if(h=t.append("text").attr("visibility","hidden"),v.forEach((s)=>{let a=y?`${y} ${s}`:s;if(h.text(a),h.node().getBoundingClientRect().width>o){if(y)_.push(y);if(y=s,h.text(s),h.node().getBoundingClientRect().width>o){let f="";for(let p of s)if(f+=p,h.text(f+"-"),h.node().getBoundingClientRect().width>o)_.push(f.slice(0,-1)+"-"),f=p;y=f}}else y=a}),y)_.push(y);h.remove()}_.forEach((v,y)=>{let s={x:40,y:g+7+y*20,fill:"#666",text:v,textMargin:r.boxTextMargin??5},c=U.drawText(t,s).node().getBoundingClientRect().width;if(c>K&&c>r.leftMargin-c)K=c}),g+=Math.max(20,_.length*20)})}e(_t,"drawActorLegend");var L=i().journey,z=0,Gt=e(function(t,r,o,g){let n=i(),d=n.journey.titleColor,m=n.journey.titleFontSize,h=n.journey.titleFontFamily,b=n.securityLevel,_;if(b==="sandbox")_=l("#i"+r);let v=b==="sandbox"?l(_.nodes()[0].contentDocument.body):l("body");R.init();let y=v.select("#"+r);U.initGraphics(y,r);let s=g.db.getTasks(),a=g.db.getDiagramTitle(),c=g.db.getActors();for(let N in j)delete j[N];let f=0;c.forEach((N)=>{j[N]={color:L.actorColours[f%L.actorColours.length],position:f},f++}),_t(y),z=L.leftMargin+K,R.insert(0,0,z,Object.keys(j).length*50),Ht(y,s,0,r);let p=R.getBounds();if(a)y.append("text").text(a).attr("x",z).attr("font-size",m).attr("font-weight","bold").attr("y",25).attr("fill",d).attr("font-family",h);let u=p.stopy-p.starty+2*L.diagramMarginY,I=z+p.stopx+2*L.diagramMarginX;X(y,u,I,L.useMaxWidth),y.append("line").attr("x1",z).attr("y1",L.height*4).attr("x2",I-z-4).attr("y2",L.height*4).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#"+r+"-arrowhead)");let T=a?70:0;y.attr("viewBox",`${p.startx} -25 ${I} ${u+T}`),y.attr("preserveAspectRatio","xMinYMin meet"),y.attr("height",u+T+25)},"draw"),R={data:{startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},verticalPos:0,sequenceItems:[],init:e(function(){this.sequenceItems=[],this.data={startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},this.verticalPos=0},"init"),updateVal:e(function(t,r,o,g){if(t[r]===void 0)t[r]=o;else t[r]=g(o,t[r])},"updateVal"),updateBounds:e(function(t,r,o,g){let n=i().journey,d=this,m=0;function h(b){return e(function(v){m++;let y=d.sequenceItems.length-m+1;if(d.updateVal(v,"starty",r-y*n.boxMargin,Math.min),d.updateVal(v,"stopy",g+y*n.boxMargin,Math.max),d.updateVal(R.data,"startx",t-y*n.boxMargin,Math.min),d.updateVal(R.data,"stopx",o+y*n.boxMargin,Math.max),b!=="activation")d.updateVal(v,"startx",t-y*n.boxMargin,Math.min),d.updateVal(v,"stopx",o+y*n.boxMargin,Math.max),d.updateVal(R.data,"starty",r-y*n.boxMargin,Math.min),d.updateVal(R.data,"stopy",g+y*n.boxMargin,Math.max)},"updateItemBounds")}e(h,"updateFn"),this.sequenceItems.forEach(h())},"updateBounds"),insert:e(function(t,r,o,g){let n=Math.min(t,o),d=Math.max(t,o),m=Math.min(r,g),h=Math.max(r,g);this.updateVal(R.data,"startx",n,Math.min),this.updateVal(R.data,"starty",m,Math.min),this.updateVal(R.data,"stopx",d,Math.max),this.updateVal(R.data,"stopy",h,Math.max),this.updateBounds(n,m,d,h)},"insert"),bumpVerticalPos:e(function(t){this.verticalPos=this.verticalPos+t,this.data.stopy=this.verticalPos},"bumpVerticalPos"),getVerticalPos:e(function(){return this.verticalPos},"getVerticalPos"),getBounds:e(function(){return this.data},"getBounds")},{sectionFills:nt,sectionColours:gt}=L,Ht=e(function(t,r,o,g){let n=i().journey,d="",m=n.height*2+n.diagramMarginY,h=o+m,b=0,_="#CCC",v="black",y=0;for(let[s,a]of r.entries()){if(d!==a.section){_=nt[b%nt.length],y=b%nt.length,v=gt[b%gt.length];let f=0,p=a.section;for(let I=s;I<r.length;I++)if(r[I].section==p)f=f+1;else break;let u={x:s*n.taskMargin+s*n.width+z,y:50,text:a.section,fill:_,num:y,colour:v,taskCount:f};U.drawSection(t,u,n),d=a.section,b++}let c=a.people.reduce((f,p)=>{if(j[p])f[p]=j[p];return f},{});a.x=s*n.taskMargin+s*n.width+z,a.y=h,a.width=n.diagramMarginX,a.height=n.diagramMarginY,a.colour=v,a.fill=_,a.num=y,a.actors=c,U.drawTask(t,a,n,g),R.insert(a.x,a.y,a.x+a.width+n.taskMargin,450)}},"drawTasks"),mt={setConf:qt,draw:Gt},re={parser:$t,db:pt,renderer:mt,styles:Lt,init:e((t)=>{mt.setConf(t.journey),pt.clear()},"init")};export{re as diagram};
