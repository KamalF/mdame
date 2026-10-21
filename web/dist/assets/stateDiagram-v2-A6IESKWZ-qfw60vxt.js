import{e,n,Ue,g,w,x,S,k,E,P,C,i,l,Ka,R,we,me,Oe,Nt,_e,Qe}from"./main-fwb472nv.js";import{rr}from"./main-bk6q37qg.js";import{Pe}from"./main-238f0xp2.js";import{ye}from"./main-nvn3m1wp.js";var Pt=function(){var t=e(function(Q,d,y,o){for(y=y||{},o=Q.length;o--;y[Q[o]]=d);return y},"o"),s=[1,2],h=[1,3],r=[1,4],f=[2,4],p=[1,9],b=[1,11],T=[1,16],c=[1,17],D=[1,18],A=[1,19],Y=[1,33],V=[1,20],j=[1,21],O=[1,22],m=[1,23],M=[1,24],F=[1,26],z=[1,27],W=[1,28],K=[1,29],N=[1,30],st=[1,31],pt=[1,32],St=[1,35],gt=[1,36],yt=[1,37],mt=[1,38],rt=[1,34],_=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],bt=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,39,40,41,45,48,51,52,53,54,57],Vt=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],xt={trace:e(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,CLICK:38,STRING:39,HREF:40,classDef:41,CLASSDEF_ID:42,CLASSDEF_STYLEOPTS:43,DEFAULT:44,style:45,STYLE_IDS:46,STYLEDEF_STYLEOPTS:47,class:48,CLASSENTITY_IDS:49,STYLECLASS:50,direction_tb:51,direction_bt:52,direction_rl:53,direction_lr:54,eol:55,";":56,EDGE_STATE:57,STYLE_SEPARATOR:58,left_of:59,right_of:60,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"CLICK",39:"STRING",40:"HREF",41:"classDef",42:"CLASSDEF_ID",43:"CLASSDEF_STYLEOPTS",44:"DEFAULT",45:"style",46:"STYLE_IDS",47:"STYLEDEF_STYLEOPTS",48:"class",49:"CLASSENTITY_IDS",50:"STYLECLASS",51:"direction_tb",52:"direction_bt",53:"direction_rl",54:"direction_lr",56:";",57:"EDGE_STATE",58:"STYLE_SEPARATOR",59:"left_of",60:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[9,5],[9,5],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[55,1],[55,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:e(function(d,y,o,v,L,a,it){var u=a.length-1;switch(L){case 3:return v.setRootDoc(a[u]),a[u];break;case 4:this.$=[];break;case 5:if(a[u]!="nl")a[u-1].push(a[u]),this.$=a[u-1];break;case 6:case 7:this.$=a[u];break;case 8:this.$="nl";break;case 12:this.$=a[u];break;case 13:let Tt=a[u-1];Tt.description=v.trimColon(a[u]),this.$=Tt;break;case 14:this.$={stmt:"relation",state1:a[u-2],state2:a[u]};break;case 15:let Et=v.trimColon(a[u]);this.$={stmt:"relation",state1:a[u-3],state2:a[u-1],description:Et};break;case 19:this.$={stmt:"state",id:a[u-3],type:"default",description:"",doc:a[u-1]};break;case 20:var X=a[u],J=a[u-2].trim();if(a[u].match(":")){var lt=a[u].split(":");X=lt[0],J=[J,lt[1]]}this.$={stmt:"state",id:X,type:"default",description:J};break;case 21:this.$={stmt:"state",id:a[u-3],type:"default",description:a[u-5],doc:a[u-1]};break;case 22:this.$={stmt:"state",id:a[u],type:"fork"};break;case 23:this.$={stmt:"state",id:a[u],type:"join"};break;case 24:this.$={stmt:"state",id:a[u],type:"choice"};break;case 25:this.$={stmt:"state",id:v.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:a[u-1].trim(),note:{position:a[u-2].trim(),text:a[u].trim()}};break;case 29:this.$=a[u].trim(),v.setAccTitle(this.$);break;case 30:case 31:this.$=a[u].trim(),v.setAccDescription(this.$);break;case 32:this.$={stmt:"click",id:a[u-3],url:a[u-2],tooltip:a[u-1]};break;case 33:this.$={stmt:"click",id:a[u-3],url:a[u-1],tooltip:""};break;case 34:case 35:this.$={stmt:"classDef",id:a[u-1].trim(),classes:a[u].trim()};break;case 36:this.$={stmt:"style",id:a[u-1].trim(),styleClass:a[u].trim()};break;case 37:this.$={stmt:"applyClass",id:a[u-1].trim(),styleClass:a[u].trim()};break;case 38:v.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 39:v.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 40:v.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 41:v.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 44:case 45:this.$={stmt:"state",id:a[u].trim(),type:"default",description:""};break;case 46:this.$={stmt:"state",id:a[u-2].trim(),classes:[a[u].trim()],type:"default",description:""};break;case 47:this.$={stmt:"state",id:a[u-2].trim(),classes:[a[u].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:s,5:h,6:r},{1:[3]},{3:5,4:s,5:h,6:r},{3:6,4:s,5:h,6:r},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],f,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:p,5:b,8:8,9:10,10:12,11:13,12:14,13:15,16:T,17:c,19:D,22:A,24:Y,25:V,26:j,27:O,28:m,29:M,32:25,33:F,35:z,37:W,38:K,41:N,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(_,[2,5]),{9:39,10:12,11:13,12:14,13:15,16:T,17:c,19:D,22:A,24:Y,25:V,26:j,27:O,28:m,29:M,32:25,33:F,35:z,37:W,38:K,41:N,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(_,[2,7]),t(_,[2,8]),t(_,[2,9]),t(_,[2,10]),t(_,[2,11]),t(_,[2,12],{14:[1,40],15:[1,41]}),t(_,[2,16]),{18:[1,42]},t(_,[2,18],{20:[1,43]}),{23:[1,44]},t(_,[2,22]),t(_,[2,23]),t(_,[2,24]),t(_,[2,25]),{30:45,31:[1,46],59:[1,47],60:[1,48]},t(_,[2,28]),{34:[1,49]},{36:[1,50]},t(_,[2,31]),{13:51,24:Y,57:rt},{42:[1,52],44:[1,53]},{46:[1,54]},{49:[1,55]},t(bt,[2,44],{58:[1,56]}),t(bt,[2,45],{58:[1,57]}),t(_,[2,38]),t(_,[2,39]),t(_,[2,40]),t(_,[2,41]),t(_,[2,6]),t(_,[2,13]),{13:58,24:Y,57:rt},t(_,[2,17]),t(Vt,f,{7:59}),{24:[1,60]},{24:[1,61]},{23:[1,62]},{24:[2,48]},{24:[2,49]},t(_,[2,29]),t(_,[2,30]),{39:[1,63],40:[1,64]},{43:[1,65]},{43:[1,66]},{47:[1,67]},{50:[1,68]},{24:[1,69]},{24:[1,70]},t(_,[2,14],{14:[1,71]}),{4:p,5:b,8:8,9:10,10:12,11:13,12:14,13:15,16:T,17:c,19:D,21:[1,72],22:A,24:Y,25:V,26:j,27:O,28:m,29:M,32:25,33:F,35:z,37:W,38:K,41:N,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(_,[2,20],{20:[1,73]}),{31:[1,74]},{24:[1,75]},{39:[1,76]},{39:[1,77]},t(_,[2,34]),t(_,[2,35]),t(_,[2,36]),t(_,[2,37]),t(bt,[2,46]),t(bt,[2,47]),t(_,[2,15]),t(_,[2,19]),t(Vt,f,{7:78}),t(_,[2,26]),t(_,[2,27]),{5:[1,79]},{5:[1,80]},{4:p,5:b,8:8,9:10,10:12,11:13,12:14,13:15,16:T,17:c,19:D,21:[1,81],22:A,24:Y,25:V,26:j,27:O,28:m,29:M,32:25,33:F,35:z,37:W,38:K,41:N,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(_,[2,32]),t(_,[2,33]),t(_,[2,21])],defaultActions:{5:[2,1],6:[2,2],47:[2,48],48:[2,49]},parseError:e(function(d,y){if(y.recoverable)this.trace(d);else{var o=Error(d);throw o.hash=y,o}},"parseError"),parse:e(function(d){var y=this,o=[0],v=[],L=[null],a=[],it=this.table,u="",X=0,J=0,lt=0,Tt=2,Et=1,de=a.slice.call(arguments,1),I=Object.create(this.lexer),tt={yy:{}};for(var Lt in this.yy)if(Object.prototype.hasOwnProperty.call(this.yy,Lt))tt.yy[Lt]=this.yy[Lt];if(I.setInput(d,tt.yy),tt.yy.lexer=I,tt.yy.parser=this,typeof I.yylloc>"u")I.yylloc={};var wt=I.yylloc;a.push(wt);var ue=I.options&&I.options.ranges;if(typeof tt.yy.parseError==="function")this.parseError=tt.yy.parseError;else this.parseError=Object.getPrototypeOf(this).parseError;function fe(H){o.length=o.length-2*H,L.length=L.length-H,a.length=a.length-H}e(fe,"popStack");function Mt(){var H=v.pop()||I.lex()||Et;if(typeof H!=="number"){if(H instanceof Array)v=H,H=v.pop();H=y.symbols_[H]||H}return H}e(Mt,"lex");var B,It,et,U,Ze,Ot,at={},_t,q,Wt,vt;while(!0){if(et=o[o.length-1],this.defaultActions[et])U=this.defaultActions[et];else{if(B===null||typeof B>"u")B=Mt();U=it[et]&&it[et][B]}if(typeof U>"u"||!U.length||!U[0]){var Rt="";vt=[];for(_t in it[et])if(this.terminals_[_t]&&_t>Tt)vt.push("'"+this.terminals_[_t]+"'");if(I.showPosition)Rt="Parse error on line "+(X+1)+`:
`+I.showPosition()+`
Expecting `+vt.join(", ")+", got '"+(this.terminals_[B]||B)+"'";else Rt="Parse error on line "+(X+1)+": Unexpected "+(B==Et?"end of input":"'"+(this.terminals_[B]||B)+"'");this.parseError(Rt,{text:I.match,token:this.terminals_[B]||B,line:I.yylineno,loc:wt,expected:vt})}if(U[0]instanceof Array&&U.length>1)throw Error("Parse Error: multiple actions possible at state: "+et+", token: "+B);switch(U[0]){case 1:if(o.push(B),L.push(I.yytext),a.push(I.yylloc),o.push(U[1]),B=null,!It){if(J=I.yyleng,u=I.yytext,X=I.yylineno,wt=I.yylloc,lt>0)lt--}else B=It,It=null;break;case 2:if(q=this.productions_[U[1]][1],at.$=L[L.length-q],at._$={first_line:a[a.length-(q||1)].first_line,last_line:a[a.length-1].last_line,first_column:a[a.length-(q||1)].first_column,last_column:a[a.length-1].last_column},ue)at._$.range=[a[a.length-(q||1)].range[0],a[a.length-1].range[1]];if(Ot=this.performAction.apply(at,[u,J,X,tt.yy,U[1],L,a].concat(de)),typeof Ot<"u")return Ot;if(q)o=o.slice(0,-1*q*2),L=L.slice(0,-1*q),a=a.slice(0,-1*q);o.push(this.productions_[U[1]][0]),L.push(at.$),a.push(at._$),Wt=it[o[o.length-2]][o[o.length-1]],o.push(Wt);break;case 3:return!0}}return!0},"parse")},he=function(){var Q={EOF:1,parseError:e(function(y,o){if(this.yy.parser)this.yy.parser.parseError(y,o);else throw Error(y)},"parseError"),setInput:e(function(d,y){if(this.yy=y||this.yy||{},this._input=d,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges)this.yylloc.range=[0,0];return this.offset=0,this},"setInput"),input:e(function(){var d=this._input[0];this.yytext+=d,this.yyleng++,this.offset++,this.match+=d,this.matched+=d;var y=d.match(/(?:\r\n?|\n).*/g);if(y)this.yylineno++,this.yylloc.last_line++;else this.yylloc.last_column++;if(this.options.ranges)this.yylloc.range[1]++;return this._input=this._input.slice(1),d},"input"),unput:e(function(d){var y=d.length,o=d.split(/(?:\r\n?|\n)/g);this._input=d+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-y),this.offset-=y;var v=this.match.split(/(?:\r\n?|\n)/g);if(this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),o.length-1)this.yylineno-=o.length-1;var L=this.yylloc.range;if(this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:o?(o.length===v.length?this.yylloc.first_column:0)+v[v.length-o.length].length-o[0].length:this.yylloc.first_column-y},this.options.ranges)this.yylloc.range=[L[0],L[0]+this.yyleng-y];return this.yyleng=this.yytext.length,this},"unput"),more:e(function(){return this._more=!0,this},"more"),reject:e(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:e(function(d){this.unput(this.match.slice(d))},"less"),pastInput:e(function(){var d=this.matched.substr(0,this.matched.length-this.match.length);return(d.length>20?"...":"")+d.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:e(function(){var d=this.match;if(d.length<20)d+=this._input.substr(0,20-d.length);return(d.substr(0,20)+(d.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:e(function(){var d=this.pastInput(),y=Array(d.length+1).join("-");return d+this.upcomingInput()+`
`+y+"^"},"showPosition"),test_match:e(function(d,y){var o,v,L;if(this.options.backtrack_lexer){if(L={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges)L.yylloc.range=this.yylloc.range.slice(0)}if(v=d[0].match(/(?:\r\n?|\n).*/g),v)this.yylineno+=v.length;if(this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:v?v[v.length-1].length-v[v.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+d[0].length},this.yytext+=d[0],this.match+=d[0],this.matches=d,this.yyleng=this.yytext.length,this.options.ranges)this.yylloc.range=[this.offset,this.offset+=this.yyleng];if(this._more=!1,this._backtrack=!1,this._input=this._input.slice(d[0].length),this.matched+=d[0],o=this.performAction.call(this,this.yy,this,y,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input)this.done=!1;if(o)return o;else if(this._backtrack){for(var a in L)this[a]=L[a];return!1}return!1},"test_match"),next:e(function(){if(this.done)return this.EOF;if(!this._input)this.done=!0;var d,y,o,v;if(!this._more)this.yytext="",this.match="";var L=this._currentRules();for(var a=0;a<L.length;a++)if(o=this._input.match(this.rules[L[a]]),o&&(!y||o[0].length>y[0].length)){if(y=o,v=a,this.options.backtrack_lexer)if(d=this.test_match(o,L[a]),d!==!1)return d;else if(this._backtrack){y=!1;continue}else return!1;else if(!this.options.flex)break}if(y){if(d=this.test_match(y,L[v]),d!==!1)return d;return!1}if(this._input==="")return this.EOF;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:e(function(){var y=this.next();if(y)return y;else return this.lex()},"lex"),begin:e(function(y){this.conditionStack.push(y)},"begin"),popState:e(function(){var y=this.conditionStack.length-1;if(y>0)return this.conditionStack.pop();else return this.conditionStack[0]},"popState"),_currentRules:e(function(){if(this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1])return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;else return this.conditions.INITIAL.rules},"_currentRules"),topState:e(function(y){if(y=this.conditionStack.length-1-Math.abs(y||0),y>=0)return this.conditionStack[y];else return"INITIAL"},"topState"),pushState:e(function(y){this.begin(y)},"pushState"),stateStackSize:e(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:e(function(y,o,v,L){function a(){let u=o.yytext.indexOf("%%");if(u===0)return!1;if(u>0){let X=o.yytext.slice(0,u),J=o.yytext.slice(u);if(J)y.lexer.unput(J);o.yytext=X}return!0}e(a,"processId");var it=L;switch(v){case 0:return 38;case 1:return 40;case 2:return 39;case 3:return 44;case 4:return 51;case 5:return 52;case 6:return 53;case 7:return 54;case 8:return 5;case 9:break;case 10:break;case 11:break;case 12:break;case 13:return this.pushState("SCALE"),17;break;case 14:return 18;case 15:this.popState();break;case 16:return this.begin("acc_title"),33;break;case 17:return this.popState(),"acc_title_value";break;case 18:return this.begin("acc_descr"),35;break;case 19:return this.popState(),"acc_descr_value";break;case 20:this.begin("acc_descr_multiline");break;case 21:this.popState();break;case 22:return"acc_descr_multiline_value";case 23:return this.pushState("CLASSDEF"),41;break;case 24:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";break;case 25:return this.popState(),this.pushState("CLASSDEFID"),42;break;case 26:return this.popState(),43;break;case 27:return this.pushState("CLASS"),48;break;case 28:return this.popState(),this.pushState("CLASS_STYLE"),49;break;case 29:return this.popState(),50;break;case 30:return this.pushState("STYLE"),45;break;case 31:return this.popState(),this.pushState("STYLEDEF_STYLES"),46;break;case 32:return this.popState(),47;break;case 33:return this.pushState("SCALE"),17;break;case 34:return 18;case 35:this.popState();break;case 36:this.pushState("STATE");break;case 37:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),25;break;case 38:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),26;break;case 39:return this.popState(),o.yytext=o.yytext.slice(0,-10).trim(),27;break;case 40:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),25;break;case 41:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),26;break;case 42:return this.popState(),o.yytext=o.yytext.slice(0,-10).trim(),27;break;case 43:return 51;case 44:return 52;case 45:return 53;case 46:return 54;case 47:this.pushState("STATE_STRING");break;case 48:return this.pushState("STATE_ID"),"AS";break;case 49:if(!a())return;return this.popState(),"ID";break;case 50:this.popState();break;case 51:return"STATE_DESCR";case 52:throw Error('Error: State name must be a single word. Found: "'+o.yytext.trim()+'"');case 53:return 19;case 54:this.popState();break;case 55:return this.popState(),this.pushState("struct"),20;break;case 56:return this.popState(),21;break;case 57:break;case 58:return this.begin("NOTE"),29;break;case 59:return this.popState(),this.pushState("NOTE_ID"),59;break;case 60:return this.popState(),this.pushState("NOTE_ID"),60;break;case 61:this.popState(),this.pushState("FLOATING_NOTE");break;case 62:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";break;case 63:break;case 64:return"NOTE_TEXT";case 65:if(!a())return;return this.popState(),"ID";break;case 66:if(!a())return;return this.popState(),this.pushState("NOTE_TEXT"),24;break;case 67:return this.popState(),o.yytext=o.yytext.substr(2).trim(),31;break;case 68:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),31;break;case 69:return 6;case 70:return 6;case 71:return 16;case 72:return 57;case 73:if(!a())return;return 24;case 74:return o.yytext=o.yytext.trim(),14;break;case 75:return 15;case 76:return 28;case 77:return 58;case 78:return 5;case 79:return"INVALID"}},"anonymous"),rules:[/^(?:click\b)/i,/^(?:href\b)/i,/^(?:"[^"]*")/i,/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:\w+\s+\w+.*?\{)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?\n\s*end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:(?:[^:\n;]|:[^:\n;])+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[10,11,12],inclusive:!1},struct:{rules:[10,11,12,23,27,30,36,43,44,45,46,56,57,58,72,73,74,75,76,77],inclusive:!1},FLOATING_NOTE_ID:{rules:[65],inclusive:!1},FLOATING_NOTE:{rules:[62,63,64],inclusive:!1},NOTE_TEXT:{rules:[67,68],inclusive:!1},NOTE_ID:{rules:[66],inclusive:!1},NOTE:{rules:[59,60,61],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[32],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[31],inclusive:!1},CLASS_STYLE:{rules:[29],inclusive:!1},CLASS:{rules:[28],inclusive:!1},CLASSDEFID:{rules:[26],inclusive:!1},CLASSDEF:{rules:[24,25],inclusive:!1},acc_descr_multiline:{rules:[21,22],inclusive:!1},acc_descr:{rules:[19],inclusive:!1},acc_title:{rules:[17],inclusive:!1},SCALE:{rules:[14,15,34,35],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[49],inclusive:!1},STATE_STRING:{rules:[50,51],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[10,11,12,37,38,39,40,41,42,47,48,52,53,54,55],inclusive:!1},ID:{rules:[10,11,12],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,9,11,12,13,16,18,20,23,27,30,33,36,55,58,69,70,71,72,73,74,75,77,78,79],inclusive:!0}}};return Q}();xt.lexer=he;function kt(){this.yy={}}return e(kt,"Parser"),kt.prototype=xt,xt.Parser=kt,new kt}();Pt.parser=Pt;var pe=Pt,Se="TB",Jt="TB",jt="dir",ot="state",nt="root",Bt="relation",ge="classDef",be="style",ke="applyClass",ut="default",qt="divider",Qt="fill:none",Zt="fill: #333",te="c",ee="markdown",se="normal",$t="rect",Ft="rectWithTitle",Te="stateStart",Ee="stateEnd",Gt="divider",Ut="roundedWithTitle",ve="note",De="noteGroup",ft="statediagram",Ce="state",Ae=`${ft}-${Ce}`,re="transition",xe="note",Le="note-edge",Ie=`${re} ${Le}`,Ne=`${ft}-${xe}`,Re="cluster",$e=`${ft}-${Re}`,Fe="cluster-alt",Be=`${ft}-${Fe}`,ie="parent",ae="note",Ge="state",Yt="----",Ye=`${Yt}${ae}`,Ht=`${Yt}${ie}`,Ct=new Map,Z=0,ne=0,ct=new Map,Ve=e((t,s,h,r)=>{if(t===Gt&&h?.id!==void 0&&ct.has(h.id)){let b=ct.get(h.id);return ct.set(s,b),b}let f=ne++,p=r?void 0:f;return ct.set(s,p),p},"colorSlotFor");function At(t="",s=0,h="",r=Yt){let f=h!==null&&h.length>0?`${r}${h}`:"";return`${Ge}-${t}${f}-${s}`}e(At,"stateDomId");var Me=e((t,s,h,r,f,p,b,T)=>{n.trace("items",s),s.forEach((c)=>{switch(c.stmt){case ot:dt(t,c,h,r,f,p,b,T);break;case ut:dt(t,c,h,r,f,p,b,T);break;case Bt:{dt(t,c.state1,h,r,f,p,b,T),dt(t,c.state2,h,r,f,p,b,T);let D=b==="neo",A={id:"edge"+Z,start:c.state1.id,end:c.state2.id,arrowhead:"normal",arrowTypeEnd:D?"arrow_barb_neo":"arrow_barb",style:Qt,labelStyle:"",label:g.sanitizeText(c.description??"",i()),arrowheadStyle:Zt,labelpos:te,labelType:ee,thickness:se,classes:re,look:b};f.push(A),Z++}break}})},"setupDoc"),zt=e((t,s=Jt)=>{let h=s;if(t.doc){for(let r of t.doc)if(r.stmt==="dir")h=r.value}return h},"getDir");function ht(t,s,h){if(!s.id||s.id==="</join></fork>"||s.id==="</choice>")return;if(s.cssClasses){if(!Array.isArray(s.cssCompiledStyles))s.cssCompiledStyles=[];s.cssClasses.split(" ").forEach((f)=>{let p=h.get(f);if(p)s.cssCompiledStyles=[...s.cssCompiledStyles??[],...p.styles]})}let r=t.find((f)=>f.id===s.id);if(r)Object.assign(r,s);else t.push(s)}e(ht,"insertOrUpdateNode");function oe(t){return t?.classes?.join(" ")??""}e(oe,"getClassesFromDbInfo");function le(t){return t?.styles??[]}e(le,"getStylesFromDbInfo");var dt=e((t,s,h,r,f,p,b,T)=>{let c=s.id,D=h.get(c),A=oe(D),Y=le(D),V=i(),j=A.trim()!==""||Y.length>0;if(n.info("dataFetcher parsedItem",s,D,Y),c!=="root"){let O=$t;if(s.start===!0)O=Te;else if(s.start===!1)O=Ee;if(s.type!==ut)O=s.type;if(!Ct.get(c))Ct.set(c,{id:c,shape:O,description:g.sanitizeText(c,V),cssClasses:`${A} ${Ae}`,cssStyles:Y});let m=Ct.get(c);if(s.description){if(Array.isArray(m.description))m.shape=Ft,m.description.push(s.description);else if(m.description?.length&&m.description.length>0)if(m.shape=Ft,m.description===c)m.description=[s.description];else m.description=[m.description,s.description];else m.shape=$t,m.description=s.description;m.description=g.sanitizeTextOrArray(m.description,V)}if(m.description?.length===1&&m.shape===Ft)if(m.type==="group")m.shape=Ut;else m.shape=$t;if(!m.type&&s.doc)n.info("Setting cluster for XCX",c,zt(s)),m.type="group",m.isGroup=!0,m.dir=zt(s),m.shape=s.type===qt?Gt:Ut,m.colorIndex=Ve(m.shape,c,t,j),m.cssClasses=`${m.cssClasses} ${$e} ${p?Be:""}`;let M={labelStyle:"",shape:m.shape,label:m.description,cssClasses:m.cssClasses,cssCompiledStyles:[],cssStyles:m.cssStyles,id:c,dir:m.dir,domId:At(c,Z),type:m.type,isGroup:m.type==="group",colorIndex:m.colorIndex,padding:8,rx:10,ry:10,look:b,labelType:"markdown"};if(M.shape===Gt)M.label="";if(t&&t.id!=="root")n.trace("Setting node ",c," to be child of its parent ",t.id),M.parentId=t.id;if(M.centerLabel=!0,s.note){let F={labelStyle:"",shape:ve,label:s.note.text,labelType:"markdown",cssClasses:Ne,cssStyles:[],cssCompiledStyles:[],id:c+Ye+"-"+Z,domId:At(c,Z,ae),type:"node",isGroup:!1,padding:V.flowchart?.padding,look:b,position:s.note.position},z=c+Ht,W={labelStyle:"",shape:De,label:s.note.text,cssClasses:m.cssClasses,cssStyles:[],id:c+Ht,domId:At(c,Z,ie),type:"group",isGroup:!0,padding:16,look:b,position:s.note.position};Z++,W.id=z,F.parentId=z,ht(r,W,T),ht(r,F,T),ht(r,M,T);let K=c,N=F.id;if(s.note.position==="left of")K=F.id,N=c;f.push({id:K+"-"+N,start:K,end:N,arrowhead:"none",arrowTypeEnd:"",style:Qt,labelStyle:"",classes:Ie,pattern:"dashed",arrowheadStyle:Zt,labelpos:te,labelType:ee,thickness:se,look:b})}else ht(r,M,T)}if(s.doc)n.trace("Adding nodes children "),Me(s,s.doc,h,r,f,!p,b,T)},"dataFetcher"),We=e(()=>{Ct.clear(),Z=0,ne=0,ct.clear()},"reset"),ce=e((t,s=Jt)=>{if(!t.doc)return s;let h=s;for(let r of t.doc)if(r.stmt==="dir")h=r.value;return h},"getDir"),je=e(function(t,s){return s.db.getClasses()},"getClasses"),He=e(async function(t,s,h,r){n.info("REF0:"),n.info("Drawing state diagram (v2)",s);let{securityLevel:f,state:p,layout:b}=i();r.db.extract(r.db.getRootDocV2());let T=r.db.getData(),c=Pe(s,f);if(T.type=r.type,T.layoutAlgorithm=Qe(b),T.nodeSpacing=p?.nodeSpacing||50,T.rankSpacing=p?.rankSpacing||50,i().look==="neo")T.markers=["barbNeo"];else T.markers=["barb"];T.diagramId=s,await _e(T,c);let A=8;try{(typeof r.db.getLinks==="function"?r.db.getLinks():new Map).forEach((V,j)=>{let O=typeof j==="string"?j:typeof j?.id==="string"?j.id:"",m=T.nodes.find((N)=>N.id===O);if(!O){n.warn("⚠️ Invalid or missing stateId from key:",JSON.stringify(j));return}let M=c.node()?.querySelectorAll("g.node, g.rough-node"),F;if(M?.forEach((N)=>{let st=N.textContent?.trim();if(N.id===m?.domId||st===O)F=N}),!F){n.warn("⚠️ Could not find node matching text:",O);return}let z=F.parentNode;if(!z){n.warn("⚠️ Node has no parent, cannot wrap:",O);return}let W=document.createElementNS("http://www.w3.org/2000/svg","a"),K=V.url.replace(/^"+|"+$/g,"");if(W.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",K),W.setAttribute("target","_blank"),V.tooltip){let N=V.tooltip.replace(/^"+|"+$/g,"");W.setAttribute("title",N),F.setAttribute("title",N)}z.replaceChild(W,F),W.appendChild(F),n.info("\uD83D\uDD17 Wrapped node in <a> tag for:",O,V.url)})}catch(Y){n.error("❌ Error injecting clickable links:",Y)}R.insertTitle(c,"statediagramTitleText",p?.titleTopMargin??25,r.db.getDiagramTitle()),ye(c,A,ft,p?.useMaxWidth??!0)},"draw"),ze={getClasses:je,draw:He,getDir:ce},G={START_NODE:"[*]",START_TYPE:"start",END_NODE:"[*]",END_TYPE:"end",COLOR_KEYWORD:"color",FILL_KEYWORD:"fill",BG_FILL:"bgFill",STYLECLASS_SEP:","},Kt=e(()=>new Map,"newClassesList"),Xt=e(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),Dt=e((t)=>JSON.parse(JSON.stringify(t)),"clone"),Ke=class{constructor(t){this.version=t,this.nodes=[],this.edges=[],this.rootDoc=[],this.classes=Kt(),this.documents={root:Xt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.dividerCnt=0,this.links=new Map,this.funs=[],this.getAccTitle=S,this.setAccTitle=x,this.getAccDescription=E,this.setAccDescription=k,this.setDiagramTitle=P,this.getDiagramTitle=C,this.clear(),this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this),this.bindFunctions=this.bindFunctions.bind(this)}static{e(this,"StateDB")}static{this.relationType={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3}}extract(t){this.clear(!0);for(let r of Array.isArray(t)?t:t.doc)switch(r.stmt){case ot:this.addState(r.id.trim(),r.type,r.doc,r.description,r.note);break;case Bt:this.addRelation(r.state1,r.state2,r.description);break;case ge:this.addStyleClass(r.id.trim(),r.classes);break;case be:this.handleStyleDef(r);break;case ke:this.setCssClass(r.id.trim(),r.styleClass);break;case"click":this.addLink(r.id,r.url,r.tooltip);break}let s=this.getStates(),h=i();We(),dt(void 0,this.getRootDocV2(),s,this.nodes,this.edges,!0,h.look,this.classes);for(let r of this.nodes){if(!Array.isArray(r.label))continue;if(r.description=r.label.slice(1),r.isGroup&&r.description.length>0)throw Error(`Group nodes can only have label. Remove the additional description for node [${r.id}]`);r.label=r.label[0]}}handleStyleDef(t){let s=t.id.trim().split(","),h=t.styleClass.split(",");for(let r of s){let f=this.getState(r);if(!f){let p=r.trim();this.addState(p),f=this.getState(p)}if(f)f.styles=h.map((p)=>p.replace(/;/g,"")?.trim())}}setRootDoc(t){if(n.info("Setting root doc",t),this.rootDoc=t,this.version===1)this.extract(t);else this.extract(this.getRootDocV2())}docTranslator(t,s,h){if(s.stmt===Bt){this.docTranslator(t,s.state1,!0),this.docTranslator(t,s.state2,!1);return}if(s.stmt===ot)if(s.id===G.START_NODE)s.id=t.id+(h?"_start":"_end"),s.start=h;else s.id=s.id.trim();if(s.stmt!==nt&&s.stmt!==ot||!s.doc)return;let r=[],f=[];for(let p of s.doc)if(p.type===qt){let b=Dt(p);b.doc=Dt(f),r.push(b),f=[]}else f.push(p);if(r.length>0&&f.length>0){let p={stmt:ot,id:Ka(),type:"divider",doc:Dt(f)};r.push(Dt(p)),s.doc=r}s.doc.forEach((p)=>this.docTranslator(s,p,!0))}getRootDocV2(){return this.docTranslator({id:nt,stmt:nt},{id:nt,stmt:nt,doc:this.rootDoc},!0),{id:nt,doc:this.rootDoc}}addState(t,s=ut,h=void 0,r=void 0,f=void 0,p=void 0,b=void 0,T=void 0){let c=t?.trim();if(!this.currentDocument.states.has(c))n.info("Adding state ",c,r),this.currentDocument.states.set(c,{stmt:ot,id:c,descriptions:[],type:s,doc:h,note:f,classes:[],styles:[],textStyles:[]});else{let D=this.currentDocument.states.get(c);if(!D)throw Error(`State not found: ${c}`);if(!D.doc)D.doc=h;if(!D.type)D.type=s}if(r)n.info("Setting state description",c,r),(Array.isArray(r)?r:[r]).forEach((A)=>this.addDescription(c,A.trim()));if(f){let D=this.currentDocument.states.get(c);if(!D)throw Error(`State not found: ${c}`);D.note=f,D.note.text=g.sanitizeText(D.note.text,i())}if(p)n.info("Setting state classes",c,p),(Array.isArray(p)?p:[p]).forEach((A)=>this.setCssClass(c,A.trim()));if(b)n.info("Setting state styles",c,b),(Array.isArray(b)?b:[b]).forEach((A)=>this.setStyle(c,A.trim()));if(T)n.info("Setting state styles",c,b),(Array.isArray(T)?T:[T]).forEach((A)=>this.setTextStyle(c,A.trim()))}clear(t){if(this.nodes=[],this.edges=[],this.funs=[this.setupToolTips.bind(this)],this.documents={root:Xt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Kt(),!t)this.links=new Map,w()}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){n.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}addLink(t,s,h){this.links.set(t,{url:s,tooltip:h}),n.warn("Adding link",t,s,h)}getLinks(){return this.links}startIdIfNeeded(t=""){if(t===G.START_NODE)return this.startEndCount++,`${G.START_TYPE}${this.startEndCount}`;return t}startTypeIfNeeded(t="",s=ut){return t===G.START_NODE?G.START_TYPE:s}endIdIfNeeded(t=""){if(t===G.END_NODE)return this.startEndCount++,`${G.END_TYPE}${this.startEndCount}`;return t}endTypeIfNeeded(t="",s=ut){return t===G.END_NODE?G.END_TYPE:s}addRelationObjs(t,s,h=""){let r=this.startIdIfNeeded(t.id.trim()),f=this.startTypeIfNeeded(t.id.trim(),t.type),p=this.startIdIfNeeded(s.id.trim()),b=this.startTypeIfNeeded(s.id.trim(),s.type);this.addState(r,f,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(p,b,s.doc,s.description,s.note,s.classes,s.styles,s.textStyles),this.currentDocument.relations.push({id1:r,id2:p,relationTitle:g.sanitizeText(h,i())})}addRelation(t,s,h){if(typeof t==="object"&&typeof s==="object")this.addRelationObjs(t,s,h);else if(typeof t==="string"&&typeof s==="string"){let r=this.startIdIfNeeded(t.trim()),f=this.startTypeIfNeeded(t),p=this.endIdIfNeeded(s.trim()),b=this.endTypeIfNeeded(s);this.addState(r,f),this.addState(p,b),this.currentDocument.relations.push({id1:r,id2:p,relationTitle:h?g.sanitizeText(h,i()):void 0})}}addDescription(t,s){let h=this.currentDocument.states.get(t),r=s.startsWith(":")?s.replace(":","").trim():s;h?.descriptions?.push(g.sanitizeText(r,i()))}cleanupLabel(t){return t.startsWith(":")?t.slice(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,`divider-id-${this.dividerCnt}`}addStyleClass(t,s=""){if(!this.classes.has(t))this.classes.set(t,{id:t,styles:[],textStyles:[]});let h=this.classes.get(t);if(s&&h)s.split(G.STYLECLASS_SEP).forEach((r)=>{let f=r.replace(/([^;]*);/,"$1").trim();if(RegExp(G.COLOR_KEYWORD).exec(r)){let b=f.replace(G.FILL_KEYWORD,G.BG_FILL).replace(G.COLOR_KEYWORD,G.FILL_KEYWORD);h.textStyles.push(b)}h.styles.push(f)})}getClasses(){return this.classes}setupToolTips(t){let s=rr();l(t).select("svg").selectAll("g.node, g.rough-node").on("mouseover",(f)=>{let p=l(f.currentTarget),b=p.attr("title");if(b===null)return;let T=f.currentTarget?.getBoundingClientRect();s.transition().duration(200).style("opacity",".9"),s.style("left",window.scrollX+T.left+(T.right-T.left)/2+"px").style("top",window.scrollY+T.bottom+"px"),s.html(Ue.sanitize(b)),p.classed("hover",!0)}).on("mouseout",(f)=>{s.transition().duration(500).style("opacity",0),l(f.currentTarget).classed("hover",!1)})}setCssClass(t,s){t.split(",").forEach((h)=>{let r=this.getState(h);if(!r){let f=h.trim();this.addState(f),r=this.getState(f)}r?.classes?.push(s)})}setStyle(t,s){this.getState(t)?.styles?.push(s)}setTextStyle(t,s){this.getState(t)?.textStyles?.push(s)}bindFunctions(t){this.funs.forEach((s)=>{s(t)})}getDirectionStatement(){return this.rootDoc.find((t)=>t.stmt===jt)}getDirection(){return this.getDirectionStatement()?.value??Se}setDirection(t){let s=this.getDirectionStatement();if(s)s.value=t;else this.rootDoc.unshift({stmt:jt,value:t})}trimColon(t){return t.startsWith(":")?t.slice(1).trim():t.trim()}getData(){let t=i();for(let s of this.nodes)if(s.wrappingWidth??=t.state?.wrappingWidth,!s.isGroup)s.minWidth??=t.state?.minNodeWidth;return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:ce(this.getRootDocV2())}}getConfig(){return i().state}},Xe=e((t)=>{let{theme:s,bkgColorArray:h,borderColorArray:r}=t;if(!me(s,r))return"";let f=Oe(t.look),p=we(h),b="";for(let T=0;T<Nt(r);T++){let c=r[T],D=p?`fill: ${h[T%h.length]};`:"",A=`[data-look="${f}"][data-color-id="color-${T}"]`;b+=`

    /* The title strip: \`rect.outer\` spans the whole composite and \`rect.inner\` covers
       the body, so what stays visible of \`outer\` is the band behind the label. */
    ${A}.statediagram-cluster rect.outer {
      stroke: ${c};
      ${D}
    }

    ${A}.statediagram-cluster rect.inner {
      stroke: ${c};
    }

    /* Concurrency regions. Siblings of one composite share a slot, so a divided composite
       reads as one thing split into parts rather than as several composites. */
    ${A}.statediagram-cluster rect.divider {
      stroke: ${c};
      ${D}
    }

    /* handDrawn draws the same container as roughjs shapes rather than plain rects, so it
       needs its own rules. \`roundedWithTitle\` and \`divider\` name those groups \`outer\`,
       \`inner\` and \`divider\` to match the classic branch, which is what lets these
       discriminate -- a bare \`.statediagram-cluster path\` rule reached the body as well and
       tinted the whole composite, losing \`compositeBackground\` and diverging from what
       classic and neo do.

       roughjs emits two paths per shape and marks them: the filled shape carries
       \`stroke="none"\` and the sketched outline carries \`fill="none"\`. Splitting on that is
       what keeps \`fill\` off the outline -- a rough outline is open squiggles, not a closed
       region, so filling it produces smears -- and keeps \`stroke\` off the fill shape, which
       would otherwise gain an edge it was drawn without. */
    ${A}.statediagram-cluster .outer path[stroke='none'] {
      ${D}
    }

    ${A}.statediagram-cluster .outer path[fill='none'] {
      stroke: ${c};
    }

    /* No \`.inner\` rule on purpose. The body shape is left entirely alone under handDrawn,
       where a rect's \`inner\` counterpart cannot be recoloured safely: roughjs draws a
       hachure fill as *stroked* lines, so its fill paths carry \`fill="none"\` exactly like
       the outline and no selector separates them. An \`.inner\` stroke rule therefore
       repainted the hatching of every alt composite in the palette colour instead of
       leaving it on \`altBackground\`. The container still reads as palette-coloured: the
       \`outer\` shape spans the whole composite, so its outline already frames the body. */

    /* Regions split the same way, which is why \`divider\` fills solid rather than taking
       roughjs's default hachure -- see the note on that call. Hatched, both of its paths
       carried \`fill="none"\` and these two rules degenerated: the tint matched nothing and
       the border rule repainted the hatching. */
    ${A}.statediagram-cluster .divider path[stroke='none'] {
      ${D}
    }

    ${A}.statediagram-cluster .divider path[fill='none'] {
      stroke: ${c};
    }
    `}return b},"genColor"),Je=e((t)=>`
${Xe(t)}
defs [id$="-barbEnd"] {
    fill: ${t.transitionColor};
    stroke: ${t.transitionColor};
  }
g.stateGroup text {
  fill: ${t.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${t.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${t.stateLabelColor};
}

g.stateGroup rect {
  fill: ${t.mainBkg};
  stroke: ${t.nodeBorder};
}

g.stateGroup line {
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.transition {
  stroke: ${t.transitionColor};
  stroke-width: ${t.strokeWidth||1};
  fill: none;
}

.stateGroup .composit {
  fill: ${t.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${t.noteBorderColor};
  fill: ${t.noteBkgColor};

  text {
    fill: ${t.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${t.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${t.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${t.edgeLabelBackground};
  p {
    background-color: ${t.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${t.edgeLabelBackground};
    fill: ${t.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${t.transitionLabelColor||t.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${t.transitionLabelColor||t.tertiaryTextColor};
}

.stateLabel text {
  fill: ${t.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node .fork-join {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node circle.state-end {
  fill: ${t.innerEndBackground};
  stroke: ${t.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${t.compositeBackground||t.background};
  // stroke: ${t.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${t.stateBkg||t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}
.node polygon {
  fill: ${t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};;
  stroke-width: ${t.strokeWidth||1}px;
}
[id$="-barbEnd"] {
  fill: ${t.lineColor};
}

.statediagram-cluster rect {
  fill: ${t.compositeTitleBackground};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}

.cluster-label, .nodeLabel {
  color: ${t.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${t.stateBorder||t.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${t.compositeBackground||t.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${t.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${t.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${t.noteTextColor};
}

[id$="-dependencyStart"], [id$="-dependencyEnd"] {
  fill: ${t.lineColor};
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${t.textColor};
}

[data-look="neo"].statediagram-cluster rect {
  fill: ${t.mainBkg};
  stroke: ${t.useGradient?"url("+t.svgId+"-gradient)":t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth??1};
}
[data-look="neo"].statediagram-cluster rect.outer {
  rx: ${t.radius}px;
  ry: ${t.radius}px;
  filter: ${t.dropShadow?t.dropShadow.replace("url(#drop-shadow)",`url(${t.svgId}-drop-shadow)`):"none"}
}
`,"getStyles"),qe=Je,bs={parser:pe,get db(){return new Ke(2)},renderer:ze,styles:qe,init:e((t)=>{if(!t.state)t.state={};t.state.arrowMarkerAbsolute=t.arrowMarkerAbsolute},"init")};export{bs as diagram};
