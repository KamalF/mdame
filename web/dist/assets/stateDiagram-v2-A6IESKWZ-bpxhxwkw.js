import{e,n,Le,p,v,w,k,x,T,E,S,i,l,Ea,_,ge,ue,he,vt,Te,Se}from"./main-8tb3dy83.js";import{Dt}from"./main-gabk89x0.js";import{ke}from"./main-a2aajtsq.js";import{fe}from"./main-c7fskp8v.js";var Bt=function(){var t=e(function(Q,d,y,o){for(y=y||{},o=Q.length;o--;y[Q[o]]=d);return y},"o"),s=[1,2],h=[1,3],r=[1,4],f=[2,4],g=[1,9],b=[1,11],D=[1,16],c=[1,17],L=[1,18],I=[1,19],Y=[1,33],V=[1,20],j=[1,21],F=[1,22],m=[1,23],M=[1,24],P=[1,26],z=[1,27],W=[1,28],K=[1,29],R=[1,30],st=[1,31],pt=[1,32],St=[1,35],gt=[1,36],yt=[1,37],mt=[1,38],rt=[1,34],C=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],bt=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,39,40,41,45,48,51,52,53,54,57],Mt=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],wt={trace:e(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,CLICK:38,STRING:39,HREF:40,classDef:41,CLASSDEF_ID:42,CLASSDEF_STYLEOPTS:43,DEFAULT:44,style:45,STYLE_IDS:46,STYLEDEF_STYLEOPTS:47,class:48,CLASSENTITY_IDS:49,STYLECLASS:50,direction_tb:51,direction_bt:52,direction_rl:53,direction_lr:54,eol:55,";":56,EDGE_STATE:57,STYLE_SEPARATOR:58,left_of:59,right_of:60,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"CLICK",39:"STRING",40:"HREF",41:"classDef",42:"CLASSDEF_ID",43:"CLASSDEF_STYLEOPTS",44:"DEFAULT",45:"style",46:"STYLE_IDS",47:"STYLEDEF_STYLEOPTS",48:"class",49:"CLASSENTITY_IDS",50:"STYLECLASS",51:"direction_tb",52:"direction_bt",53:"direction_rl",54:"direction_lr",56:";",57:"EDGE_STATE",58:"STYLE_SEPARATOR",59:"left_of",60:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[9,5],[9,5],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[55,1],[55,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:e(function(d,y,o,A,N,a,it){var u=a.length-1;switch(N){case 3:return A.setRootDoc(a[u]),a[u];break;case 4:this.$=[];break;case 5:if(a[u]!="nl")a[u-1].push(a[u]),this.$=a[u-1];break;case 6:case 7:this.$=a[u];break;case 8:this.$="nl";break;case 12:this.$=a[u];break;case 13:let Tt=a[u-1];Tt.description=A.trimColon(a[u]),this.$=Tt;break;case 14:this.$={stmt:"relation",state1:a[u-2],state2:a[u]};break;case 15:let Et=A.trimColon(a[u]);this.$={stmt:"relation",state1:a[u-3],state2:a[u-1],description:Et};break;case 19:this.$={stmt:"state",id:a[u-3],type:"default",description:"",doc:a[u-1]};break;case 20:var X=a[u],J=a[u-2].trim();if(a[u].match(":")){var lt=a[u].split(":");X=lt[0],J=[J,lt[1]]}this.$={stmt:"state",id:X,type:"default",description:J};break;case 21:this.$={stmt:"state",id:a[u-3],type:"default",description:a[u-5],doc:a[u-1]};break;case 22:this.$={stmt:"state",id:a[u],type:"fork"};break;case 23:this.$={stmt:"state",id:a[u],type:"join"};break;case 24:this.$={stmt:"state",id:a[u],type:"choice"};break;case 25:this.$={stmt:"state",id:A.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:a[u-1].trim(),note:{position:a[u-2].trim(),text:a[u].trim()}};break;case 29:this.$=a[u].trim(),A.setAccTitle(this.$);break;case 30:case 31:this.$=a[u].trim(),A.setAccDescription(this.$);break;case 32:this.$={stmt:"click",id:a[u-3],url:a[u-2],tooltip:a[u-1]};break;case 33:this.$={stmt:"click",id:a[u-3],url:a[u-1],tooltip:""};break;case 34:case 35:this.$={stmt:"classDef",id:a[u-1].trim(),classes:a[u].trim()};break;case 36:this.$={stmt:"style",id:a[u-1].trim(),styleClass:a[u].trim()};break;case 37:this.$={stmt:"applyClass",id:a[u-1].trim(),styleClass:a[u].trim()};break;case 38:A.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 39:A.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 40:A.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 41:A.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 44:case 45:this.$={stmt:"state",id:a[u].trim(),type:"default",description:""};break;case 46:this.$={stmt:"state",id:a[u-2].trim(),classes:[a[u].trim()],type:"default",description:""};break;case 47:this.$={stmt:"state",id:a[u-2].trim(),classes:[a[u].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:s,5:h,6:r},{1:[3]},{3:5,4:s,5:h,6:r},{3:6,4:s,5:h,6:r},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],f,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:g,5:b,8:8,9:10,10:12,11:13,12:14,13:15,16:D,17:c,19:L,22:I,24:Y,25:V,26:j,27:F,28:m,29:M,32:25,33:P,35:z,37:W,38:K,41:R,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(C,[2,5]),{9:39,10:12,11:13,12:14,13:15,16:D,17:c,19:L,22:I,24:Y,25:V,26:j,27:F,28:m,29:M,32:25,33:P,35:z,37:W,38:K,41:R,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(C,[2,7]),t(C,[2,8]),t(C,[2,9]),t(C,[2,10]),t(C,[2,11]),t(C,[2,12],{14:[1,40],15:[1,41]}),t(C,[2,16]),{18:[1,42]},t(C,[2,18],{20:[1,43]}),{23:[1,44]},t(C,[2,22]),t(C,[2,23]),t(C,[2,24]),t(C,[2,25]),{30:45,31:[1,46],59:[1,47],60:[1,48]},t(C,[2,28]),{34:[1,49]},{36:[1,50]},t(C,[2,31]),{13:51,24:Y,57:rt},{42:[1,52],44:[1,53]},{46:[1,54]},{49:[1,55]},t(bt,[2,44],{58:[1,56]}),t(bt,[2,45],{58:[1,57]}),t(C,[2,38]),t(C,[2,39]),t(C,[2,40]),t(C,[2,41]),t(C,[2,6]),t(C,[2,13]),{13:58,24:Y,57:rt},t(C,[2,17]),t(Mt,f,{7:59}),{24:[1,60]},{24:[1,61]},{23:[1,62]},{24:[2,48]},{24:[2,49]},t(C,[2,29]),t(C,[2,30]),{39:[1,63],40:[1,64]},{43:[1,65]},{43:[1,66]},{47:[1,67]},{50:[1,68]},{24:[1,69]},{24:[1,70]},t(C,[2,14],{14:[1,71]}),{4:g,5:b,8:8,9:10,10:12,11:13,12:14,13:15,16:D,17:c,19:L,21:[1,72],22:I,24:Y,25:V,26:j,27:F,28:m,29:M,32:25,33:P,35:z,37:W,38:K,41:R,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(C,[2,20],{20:[1,73]}),{31:[1,74]},{24:[1,75]},{39:[1,76]},{39:[1,77]},t(C,[2,34]),t(C,[2,35]),t(C,[2,36]),t(C,[2,37]),t(bt,[2,46]),t(bt,[2,47]),t(C,[2,15]),t(C,[2,19]),t(Mt,f,{7:78}),t(C,[2,26]),t(C,[2,27]),{5:[1,79]},{5:[1,80]},{4:g,5:b,8:8,9:10,10:12,11:13,12:14,13:15,16:D,17:c,19:L,21:[1,81],22:I,24:Y,25:V,26:j,27:F,28:m,29:M,32:25,33:P,35:z,37:W,38:K,41:R,45:st,48:pt,51:St,52:gt,53:yt,54:mt,57:rt},t(C,[2,32]),t(C,[2,33]),t(C,[2,21])],defaultActions:{5:[2,1],6:[2,2],47:[2,48],48:[2,49]},parseError:e(function(d,y){if(y.recoverable)this.trace(d);else{var o=Error(d);throw o.hash=y,o}},"parseError"),parse:e(function(d){var y=this,o=[0],A=[],N=[null],a=[],it=this.table,u="",X=0,J=0,lt=0,Tt=2,Et=1,ye=a.slice.call(arguments,1),O=Object.create(this.lexer),tt={yy:{}};for(var It in this.yy)if(Object.prototype.hasOwnProperty.call(this.yy,It))tt.yy[It]=this.yy[It];if(O.setInput(d,tt.yy),tt.yy.lexer=O,tt.yy.parser=this,typeof O.yylloc>"u")O.yylloc={};var Nt=O.yylloc;a.push(Nt);var me=O.options&&O.options.ranges;if(typeof tt.yy.parseError==="function")this.parseError=tt.yy.parseError;else this.parseError=Object.getPrototypeOf(this).parseError;function be(H){o.length=o.length-2*H,N.length=N.length-H,a.length=a.length-H}e(be,"popStack");function Wt(){var H=A.pop()||O.lex()||Et;if(typeof H!=="number"){if(H instanceof Array)A=H,H=A.pop();H=y.symbols_[H]||H}return H}e(Wt,"lex");var B,Ot,et,U,ts,Rt,at={},_t,q,jt,Ct;while(!0){if(et=o[o.length-1],this.defaultActions[et])U=this.defaultActions[et];else{if(B===null||typeof B>"u")B=Wt();U=it[et]&&it[et][B]}if(typeof U>"u"||!U.length||!U[0]){var $t="";Ct=[];for(_t in it[et])if(this.terminals_[_t]&&_t>Tt)Ct.push("'"+this.terminals_[_t]+"'");if(O.showPosition)$t="Parse error on line "+(X+1)+`:
`+O.showPosition()+`
Expecting `+Ct.join(", ")+", got '"+(this.terminals_[B]||B)+"'";else $t="Parse error on line "+(X+1)+": Unexpected "+(B==Et?"end of input":"'"+(this.terminals_[B]||B)+"'");this.parseError($t,{text:O.match,token:this.terminals_[B]||B,line:O.yylineno,loc:Nt,expected:Ct})}if(U[0]instanceof Array&&U.length>1)throw Error("Parse Error: multiple actions possible at state: "+et+", token: "+B);switch(U[0]){case 1:if(o.push(B),N.push(O.yytext),a.push(O.yylloc),o.push(U[1]),B=null,!Ot){if(J=O.yyleng,u=O.yytext,X=O.yylineno,Nt=O.yylloc,lt>0)lt--}else B=Ot,Ot=null;break;case 2:if(q=this.productions_[U[1]][1],at.$=N[N.length-q],at._$={first_line:a[a.length-(q||1)].first_line,last_line:a[a.length-1].last_line,first_column:a[a.length-(q||1)].first_column,last_column:a[a.length-1].last_column},me)at._$.range=[a[a.length-(q||1)].range[0],a[a.length-1].range[1]];if(Rt=this.performAction.apply(at,[u,J,X,tt.yy,U[1],N,a].concat(ye)),typeof Rt<"u")return Rt;if(q)o=o.slice(0,-1*q*2),N=N.slice(0,-1*q),a=a.slice(0,-1*q);o.push(this.productions_[U[1]][0]),N.push(at.$),a.push(at._$),jt=it[o[o.length-2]][o[o.length-1]],o.push(jt);break;case 3:return!0}}return!0},"parse")},pe=function(){var Q={EOF:1,parseError:e(function(y,o){if(this.yy.parser)this.yy.parser.parseError(y,o);else throw Error(y)},"parseError"),setInput:e(function(d,y){if(this.yy=y||this.yy||{},this._input=d,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges)this.yylloc.range=[0,0];return this.offset=0,this},"setInput"),input:e(function(){var d=this._input[0];this.yytext+=d,this.yyleng++,this.offset++,this.match+=d,this.matched+=d;var y=d.match(/(?:\r\n?|\n).*/g);if(y)this.yylineno++,this.yylloc.last_line++;else this.yylloc.last_column++;if(this.options.ranges)this.yylloc.range[1]++;return this._input=this._input.slice(1),d},"input"),unput:e(function(d){var y=d.length,o=d.split(/(?:\r\n?|\n)/g);this._input=d+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-y),this.offset-=y;var A=this.match.split(/(?:\r\n?|\n)/g);if(this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),o.length-1)this.yylineno-=o.length-1;var N=this.yylloc.range;if(this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:o?(o.length===A.length?this.yylloc.first_column:0)+A[A.length-o.length].length-o[0].length:this.yylloc.first_column-y},this.options.ranges)this.yylloc.range=[N[0],N[0]+this.yyleng-y];return this.yyleng=this.yytext.length,this},"unput"),more:e(function(){return this._more=!0,this},"more"),reject:e(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:e(function(d){this.unput(this.match.slice(d))},"less"),pastInput:e(function(){var d=this.matched.substr(0,this.matched.length-this.match.length);return(d.length>20?"...":"")+d.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:e(function(){var d=this.match;if(d.length<20)d+=this._input.substr(0,20-d.length);return(d.substr(0,20)+(d.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:e(function(){var d=this.pastInput(),y=Array(d.length+1).join("-");return d+this.upcomingInput()+`
`+y+"^"},"showPosition"),test_match:e(function(d,y){var o,A,N;if(this.options.backtrack_lexer){if(N={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges)N.yylloc.range=this.yylloc.range.slice(0)}if(A=d[0].match(/(?:\r\n?|\n).*/g),A)this.yylineno+=A.length;if(this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:A?A[A.length-1].length-A[A.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+d[0].length},this.yytext+=d[0],this.match+=d[0],this.matches=d,this.yyleng=this.yytext.length,this.options.ranges)this.yylloc.range=[this.offset,this.offset+=this.yyleng];if(this._more=!1,this._backtrack=!1,this._input=this._input.slice(d[0].length),this.matched+=d[0],o=this.performAction.call(this,this.yy,this,y,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input)this.done=!1;if(o)return o;else if(this._backtrack){for(var a in N)this[a]=N[a];return!1}return!1},"test_match"),next:e(function(){if(this.done)return this.EOF;if(!this._input)this.done=!0;var d,y,o,A;if(!this._more)this.yytext="",this.match="";var N=this._currentRules();for(var a=0;a<N.length;a++)if(o=this._input.match(this.rules[N[a]]),o&&(!y||o[0].length>y[0].length)){if(y=o,A=a,this.options.backtrack_lexer)if(d=this.test_match(o,N[a]),d!==!1)return d;else if(this._backtrack){y=!1;continue}else return!1;else if(!this.options.flex)break}if(y){if(d=this.test_match(y,N[A]),d!==!1)return d;return!1}if(this._input==="")return this.EOF;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:e(function(){var y=this.next();if(y)return y;else return this.lex()},"lex"),begin:e(function(y){this.conditionStack.push(y)},"begin"),popState:e(function(){var y=this.conditionStack.length-1;if(y>0)return this.conditionStack.pop();else return this.conditionStack[0]},"popState"),_currentRules:e(function(){if(this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1])return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;else return this.conditions.INITIAL.rules},"_currentRules"),topState:e(function(y){if(y=this.conditionStack.length-1-Math.abs(y||0),y>=0)return this.conditionStack[y];else return"INITIAL"},"topState"),pushState:e(function(y){this.begin(y)},"pushState"),stateStackSize:e(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:e(function(y,o,A,N){function a(){let u=o.yytext.indexOf("%%");if(u===0)return!1;if(u>0){let X=o.yytext.slice(0,u),J=o.yytext.slice(u);if(J)y.lexer.unput(J);o.yytext=X}return!0}e(a,"processId");var it=N;switch(A){case 0:return 38;case 1:return 40;case 2:return 39;case 3:return 44;case 4:return 51;case 5:return 52;case 6:return 53;case 7:return 54;case 8:return 5;case 9:break;case 10:break;case 11:break;case 12:break;case 13:return this.pushState("SCALE"),17;break;case 14:return 18;case 15:this.popState();break;case 16:return this.begin("acc_title"),33;break;case 17:return this.popState(),"acc_title_value";break;case 18:return this.begin("acc_descr"),35;break;case 19:return this.popState(),"acc_descr_value";break;case 20:this.begin("acc_descr_multiline");break;case 21:this.popState();break;case 22:return"acc_descr_multiline_value";case 23:return this.pushState("CLASSDEF"),41;break;case 24:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";break;case 25:return this.popState(),this.pushState("CLASSDEFID"),42;break;case 26:return this.popState(),43;break;case 27:return this.pushState("CLASS"),48;break;case 28:return this.popState(),this.pushState("CLASS_STYLE"),49;break;case 29:return this.popState(),50;break;case 30:return this.pushState("STYLE"),45;break;case 31:return this.popState(),this.pushState("STYLEDEF_STYLES"),46;break;case 32:return this.popState(),47;break;case 33:return this.pushState("SCALE"),17;break;case 34:return 18;case 35:this.popState();break;case 36:this.pushState("STATE");break;case 37:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),25;break;case 38:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),26;break;case 39:return this.popState(),o.yytext=o.yytext.slice(0,-10).trim(),27;break;case 40:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),25;break;case 41:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),26;break;case 42:return this.popState(),o.yytext=o.yytext.slice(0,-10).trim(),27;break;case 43:return 51;case 44:return 52;case 45:return 53;case 46:return 54;case 47:this.pushState("STATE_STRING");break;case 48:return this.pushState("STATE_ID"),"AS";break;case 49:if(!a())return;return this.popState(),"ID";break;case 50:this.popState();break;case 51:return"STATE_DESCR";case 52:throw Error('Error: State name must be a single word. Found: "'+o.yytext.trim()+'"');case 53:return 19;case 54:this.popState();break;case 55:return this.popState(),this.pushState("struct"),20;break;case 56:return this.popState(),21;break;case 57:break;case 58:return this.begin("NOTE"),29;break;case 59:return this.popState(),this.pushState("NOTE_ID"),59;break;case 60:return this.popState(),this.pushState("NOTE_ID"),60;break;case 61:this.popState(),this.pushState("FLOATING_NOTE");break;case 62:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";break;case 63:break;case 64:return"NOTE_TEXT";case 65:if(!a())return;return this.popState(),"ID";break;case 66:if(!a())return;return this.popState(),this.pushState("NOTE_TEXT"),24;break;case 67:return this.popState(),o.yytext=o.yytext.substr(2).trim(),31;break;case 68:return this.popState(),o.yytext=o.yytext.slice(0,-8).trim(),31;break;case 69:return 6;case 70:return 6;case 71:return 16;case 72:return 57;case 73:if(!a())return;return 24;case 74:return o.yytext=o.yytext.trim(),14;break;case 75:return 15;case 76:return 28;case 77:return 58;case 78:return 5;case 79:return"INVALID"}},"anonymous"),rules:[/^(?:click\b)/i,/^(?:href\b)/i,/^(?:"[^"]*")/i,/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:\w+\s+\w+.*?\{)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?\n\s*end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:(?:[^:\n;]|:[^:\n;])+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[10,11,12],inclusive:!1},struct:{rules:[10,11,12,23,27,30,36,43,44,45,46,56,57,58,72,73,74,75,76,77],inclusive:!1},FLOATING_NOTE_ID:{rules:[65],inclusive:!1},FLOATING_NOTE:{rules:[62,63,64],inclusive:!1},NOTE_TEXT:{rules:[67,68],inclusive:!1},NOTE_ID:{rules:[66],inclusive:!1},NOTE:{rules:[59,60,61],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[32],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[31],inclusive:!1},CLASS_STYLE:{rules:[29],inclusive:!1},CLASS:{rules:[28],inclusive:!1},CLASSDEFID:{rules:[26],inclusive:!1},CLASSDEF:{rules:[24,25],inclusive:!1},acc_descr_multiline:{rules:[21,22],inclusive:!1},acc_descr:{rules:[19],inclusive:!1},acc_title:{rules:[17],inclusive:!1},SCALE:{rules:[14,15,34,35],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[49],inclusive:!1},STATE_STRING:{rules:[50,51],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[10,11,12,37,38,39,40,41,42,47,48,52,53,54,55],inclusive:!1},ID:{rules:[10,11,12],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,9,11,12,13,16,18,20,23,27,30,33,36,55,58,69,70,71,72,73,74,75,77,78,79],inclusive:!0}}};return Q}();wt.lexer=pe;function kt(){this.yy={}}return e(kt,"Parser"),kt.prototype=wt,wt.Parser=kt,new kt}();Bt.parser=Bt;var Ee=Bt,_e="TB",qt="TB",Ut="dir",ot="state",nt="root",Gt="relation",ve="classDef",De="style",Ce="applyClass",ut="default",Qt="divider",Zt="fill:none",te="fill: #333",ee="c",se="markdown",re="normal",Ft="rect",Pt="rectWithTitle",Ae="stateStart",xe="stateEnd",Yt="divider",Ht="roundedWithTitle",we="note",Ie="noteGroup",ft="statediagram",Ne="state",Oe=`${ft}-${Ne}`,ie="transition",Re="note",$e="note-edge",Fe=`${ie} ${$e}`,Pe=`${ft}-${Re}`,Be="cluster",Ge=`${ft}-${Be}`,Ye="cluster-alt",Ve=`${ft}-${Ye}`,ae="parent",ne="note",Me="state",Vt="----",We=`${Vt}${ne}`,zt=`${Vt}${ae}`,xt=new Map,Z=0,oe=0,ct=new Map,je=e((t,s,h,r)=>{if(t===Yt&&h?.id!==void 0&&ct.has(h.id)){let b=ct.get(h.id);return ct.set(s,b),b}let f=oe++,g=r?void 0:f;return ct.set(s,g),g},"colorSlotFor");function Lt(t="",s=0,h="",r=Vt){let f=h!==null&&h.length>0?`${r}${h}`:"";return`${Me}-${t}${f}-${s}`}e(Lt,"stateDomId");var Ue=e((t,s,h,r,f,g,b,D)=>{n.trace("items",s),s.forEach((c)=>{switch(c.stmt){case ot:dt(t,c,h,r,f,g,b,D);break;case ut:dt(t,c,h,r,f,g,b,D);break;case Gt:{dt(t,c.state1,h,r,f,g,b,D),dt(t,c.state2,h,r,f,g,b,D);let L=b==="neo",I={id:"edge"+Z,start:c.state1.id,end:c.state2.id,arrowhead:"normal",arrowTypeEnd:L?"arrow_barb_neo":"arrow_barb",style:Zt,labelStyle:"",label:p.sanitizeText(c.description??"",i()),arrowheadStyle:te,labelpos:ee,labelType:se,thickness:re,classes:ie,look:b};f.push(I),Z++}break}})},"setupDoc"),Kt=e((t,s=qt)=>{let h=s;if(t.doc){for(let r of t.doc)if(r.stmt==="dir")h=r.value}return h},"getDir");function ht(t,s,h){if(!s.id||s.id==="</join></fork>"||s.id==="</choice>")return;if(s.cssClasses){if(!Array.isArray(s.cssCompiledStyles))s.cssCompiledStyles=[];s.cssClasses.split(" ").forEach((f)=>{let g=h.get(f);if(g)s.cssCompiledStyles=[...s.cssCompiledStyles??[],...g.styles]})}let r=t.find((f)=>f.id===s.id);if(r)Object.assign(r,s);else t.push(s)}e(ht,"insertOrUpdateNode");function le(t){return t?.classes?.join(" ")??""}e(le,"getClassesFromDbInfo");function ce(t){return t?.styles??[]}e(ce,"getStylesFromDbInfo");var dt=e((t,s,h,r,f,g,b,D)=>{let c=s.id,L=h.get(c),I=le(L),Y=ce(L),V=i(),j=I.trim()!==""||Y.length>0;if(n.info("dataFetcher parsedItem",s,L,Y),c!=="root"){let F=Ft;if(s.start===!0)F=Ae;else if(s.start===!1)F=xe;if(s.type!==ut)F=s.type;if(!xt.get(c))xt.set(c,{id:c,shape:F,description:p.sanitizeText(c,V),cssClasses:`${I} ${Oe}`,cssStyles:Y});let m=xt.get(c);if(s.description){if(Array.isArray(m.description))m.shape=Pt,m.description.push(s.description);else if(m.description?.length&&m.description.length>0)if(m.shape=Pt,m.description===c)m.description=[s.description];else m.description=[m.description,s.description];else m.shape=Ft,m.description=s.description;m.description=p.sanitizeTextOrArray(m.description,V)}if(m.description?.length===1&&m.shape===Pt)if(m.type==="group")m.shape=Ht;else m.shape=Ft;if(!m.type&&s.doc)n.info("Setting cluster for XCX",c,Kt(s)),m.type="group",m.isGroup=!0,m.dir=Kt(s),m.shape=s.type===Qt?Yt:Ht,m.colorIndex=je(m.shape,c,t,j),m.cssClasses=`${m.cssClasses} ${Ge} ${g?Ve:""}`;let M={labelStyle:"",shape:m.shape,label:m.description,cssClasses:m.cssClasses,cssCompiledStyles:[],cssStyles:m.cssStyles,id:c,dir:m.dir,domId:Lt(c,Z),type:m.type,isGroup:m.type==="group",colorIndex:m.colorIndex,padding:8,rx:10,ry:10,look:b,labelType:"markdown"};if(M.shape===Yt)M.label="";if(t&&t.id!=="root")n.trace("Setting node ",c," to be child of its parent ",t.id),M.parentId=t.id;if(M.centerLabel=!0,s.note){let P={labelStyle:"",shape:we,label:s.note.text,labelType:"markdown",cssClasses:Pe,cssStyles:[],cssCompiledStyles:[],id:c+We+"-"+Z,domId:Lt(c,Z,ne),type:"node",isGroup:!1,padding:V.flowchart?.padding,look:b,position:s.note.position},z=c+zt,W={labelStyle:"",shape:Ie,label:s.note.text,cssClasses:m.cssClasses,cssStyles:[],id:c+zt,domId:Lt(c,Z,ae),type:"group",isGroup:!0,padding:16,look:b,position:s.note.position};Z++,W.id=z,P.parentId=z,ht(r,W,D),ht(r,P,D),ht(r,M,D);let K=c,R=P.id;if(s.note.position==="left of")K=P.id,R=c;f.push({id:K+"-"+R,start:K,end:R,arrowhead:"none",arrowTypeEnd:"",style:Zt,labelStyle:"",classes:Fe,pattern:"dashed",arrowheadStyle:te,labelpos:ee,labelType:se,thickness:re,look:b})}else ht(r,M,D)}if(s.doc)n.trace("Adding nodes children "),Ue(s,s.doc,h,r,f,!g,b,D)},"dataFetcher"),He=e(()=>{xt.clear(),Z=0,oe=0,ct.clear()},"reset"),de=e((t,s=qt)=>{if(!t.doc)return s;let h=s;for(let r of t.doc)if(r.stmt==="dir")h=r.value;return h},"getDir"),ze=e(function(t,s){return s.db.getClasses()},"getClasses"),Ke=e(async function(t,s,h,r){n.info("REF0:"),n.info("Drawing state diagram (v2)",s);let{securityLevel:f,state:g,layout:b}=i();r.db.extract(r.db.getRootDocV2());let D=r.db.getData(),c=ke(s,f);if(D.type=r.type,D.layoutAlgorithm=Se(b),D.nodeSpacing=g?.nodeSpacing||50,D.rankSpacing=g?.rankSpacing||50,i().look==="neo")D.markers=["barbNeo"];else D.markers=["barb"];D.diagramId=s,await Te(D,c);let I=8;try{(typeof r.db.getLinks==="function"?r.db.getLinks():new Map).forEach((V,j)=>{let F=typeof j==="string"?j:typeof j?.id==="string"?j.id:"",m=D.nodes.find((R)=>R.id===F);if(!F){n.warn("⚠️ Invalid or missing stateId from key:",JSON.stringify(j));return}let M=c.node()?.querySelectorAll("g.node, g.rough-node"),P;if(M?.forEach((R)=>{let st=R.textContent?.trim();if(R.id===m?.domId||st===F)P=R}),!P){n.warn("⚠️ Could not find node matching text:",F);return}let z=P.parentNode;if(!z){n.warn("⚠️ Node has no parent, cannot wrap:",F);return}let W=document.createElementNS("http://www.w3.org/2000/svg","a"),K=V.url.replace(/^"+|"+$/g,"");if(W.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",K),W.setAttribute("target","_blank"),V.tooltip){let R=V.tooltip.replace(/^"+|"+$/g,"");W.setAttribute("title",R),P.setAttribute("title",R)}z.replaceChild(W,P),W.appendChild(P),n.info("\uD83D\uDD17 Wrapped node in <a> tag for:",F,V.url)})}catch(Y){n.error("❌ Error injecting clickable links:",Y)}_.insertTitle(c,"statediagramTitleText",g?.titleTopMargin??25,r.db.getDiagramTitle()),fe(c,I,ft,g?.useMaxWidth??!0)},"draw"),Xe={getClasses:ze,draw:Ke,getDir:de},G={START_NODE:"[*]",START_TYPE:"start",END_NODE:"[*]",END_TYPE:"end",COLOR_KEYWORD:"color",FILL_KEYWORD:"fill",BG_FILL:"bgFill",STYLECLASS_SEP:","},Xt=e(()=>new Map,"newClassesList"),Jt=e(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),At=e((t)=>JSON.parse(JSON.stringify(t)),"clone"),Je=class{constructor(t){this.version=t,this.nodes=[],this.edges=[],this.rootDoc=[],this.classes=Xt(),this.documents={root:Jt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.dividerCnt=0,this.links=new Map,this.funs=[],this.getAccTitle=k,this.setAccTitle=w,this.getAccDescription=T,this.setAccDescription=x,this.setDiagramTitle=E,this.getDiagramTitle=S,this.clear(),this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this),this.bindFunctions=this.bindFunctions.bind(this)}static{e(this,"StateDB")}static{this.relationType={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3}}extract(t){this.clear(!0);for(let r of Array.isArray(t)?t:t.doc)switch(r.stmt){case ot:this.addState(r.id.trim(),r.type,r.doc,r.description,r.note);break;case Gt:this.addRelation(r.state1,r.state2,r.description);break;case ve:this.addStyleClass(r.id.trim(),r.classes);break;case De:this.handleStyleDef(r);break;case Ce:this.setCssClass(r.id.trim(),r.styleClass);break;case"click":this.addLink(r.id,r.url,r.tooltip);break}let s=this.getStates(),h=i();He(),dt(void 0,this.getRootDocV2(),s,this.nodes,this.edges,!0,h.look,this.classes);for(let r of this.nodes){if(!Array.isArray(r.label))continue;if(r.description=r.label.slice(1),r.isGroup&&r.description.length>0)throw Error(`Group nodes can only have label. Remove the additional description for node [${r.id}]`);r.label=r.label[0]}}handleStyleDef(t){let s=t.id.trim().split(","),h=t.styleClass.split(",");for(let r of s){let f=this.getState(r);if(!f){let g=r.trim();this.addState(g),f=this.getState(g)}if(f)f.styles=h.map((g)=>g.replace(/;/g,"")?.trim())}}setRootDoc(t){if(n.info("Setting root doc",t),this.rootDoc=t,this.version===1)this.extract(t);else this.extract(this.getRootDocV2())}docTranslator(t,s,h){if(s.stmt===Gt){this.docTranslator(t,s.state1,!0),this.docTranslator(t,s.state2,!1);return}if(s.stmt===ot)if(s.id===G.START_NODE)s.id=t.id+(h?"_start":"_end"),s.start=h;else s.id=s.id.trim();if(s.stmt!==nt&&s.stmt!==ot||!s.doc)return;let r=[],f=[];for(let g of s.doc)if(g.type===Qt){let b=At(g);b.doc=At(f),r.push(b),f=[]}else f.push(g);if(r.length>0&&f.length>0){let g={stmt:ot,id:Ea(),type:"divider",doc:At(f)};r.push(At(g)),s.doc=r}s.doc.forEach((g)=>this.docTranslator(s,g,!0))}getRootDocV2(){return this.docTranslator({id:nt,stmt:nt},{id:nt,stmt:nt,doc:this.rootDoc},!0),{id:nt,doc:this.rootDoc}}addState(t,s=ut,h=void 0,r=void 0,f=void 0,g=void 0,b=void 0,D=void 0){let c=t?.trim();if(!this.currentDocument.states.has(c))n.info("Adding state ",c,r),this.currentDocument.states.set(c,{stmt:ot,id:c,descriptions:[],type:s,doc:h,note:f,classes:[],styles:[],textStyles:[]});else{let L=this.currentDocument.states.get(c);if(!L)throw Error(`State not found: ${c}`);if(!L.doc)L.doc=h;if(!L.type)L.type=s}if(r)n.info("Setting state description",c,r),(Array.isArray(r)?r:[r]).forEach((I)=>this.addDescription(c,I.trim()));if(f){let L=this.currentDocument.states.get(c);if(!L)throw Error(`State not found: ${c}`);L.note=f,L.note.text=p.sanitizeText(L.note.text,i())}if(g)n.info("Setting state classes",c,g),(Array.isArray(g)?g:[g]).forEach((I)=>this.setCssClass(c,I.trim()));if(b)n.info("Setting state styles",c,b),(Array.isArray(b)?b:[b]).forEach((I)=>this.setStyle(c,I.trim()));if(D)n.info("Setting state styles",c,b),(Array.isArray(D)?D:[D]).forEach((I)=>this.setTextStyle(c,I.trim()))}clear(t){if(this.nodes=[],this.edges=[],this.funs=[this.setupToolTips.bind(this)],this.documents={root:Jt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Xt(),!t)this.links=new Map,v()}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){n.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}addLink(t,s,h){this.links.set(t,{url:s,tooltip:h}),n.warn("Adding link",t,s,h)}getLinks(){return this.links}startIdIfNeeded(t=""){if(t===G.START_NODE)return this.startEndCount++,`${G.START_TYPE}${this.startEndCount}`;return t}startTypeIfNeeded(t="",s=ut){return t===G.START_NODE?G.START_TYPE:s}endIdIfNeeded(t=""){if(t===G.END_NODE)return this.startEndCount++,`${G.END_TYPE}${this.startEndCount}`;return t}endTypeIfNeeded(t="",s=ut){return t===G.END_NODE?G.END_TYPE:s}addRelationObjs(t,s,h=""){let r=this.startIdIfNeeded(t.id.trim()),f=this.startTypeIfNeeded(t.id.trim(),t.type),g=this.startIdIfNeeded(s.id.trim()),b=this.startTypeIfNeeded(s.id.trim(),s.type);this.addState(r,f,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(g,b,s.doc,s.description,s.note,s.classes,s.styles,s.textStyles),this.currentDocument.relations.push({id1:r,id2:g,relationTitle:p.sanitizeText(h,i())})}addRelation(t,s,h){if(typeof t==="object"&&typeof s==="object")this.addRelationObjs(t,s,h);else if(typeof t==="string"&&typeof s==="string"){let r=this.startIdIfNeeded(t.trim()),f=this.startTypeIfNeeded(t),g=this.endIdIfNeeded(s.trim()),b=this.endTypeIfNeeded(s);this.addState(r,f),this.addState(g,b),this.currentDocument.relations.push({id1:r,id2:g,relationTitle:h?p.sanitizeText(h,i()):void 0})}}addDescription(t,s){let h=this.currentDocument.states.get(t),r=s.startsWith(":")?s.replace(":","").trim():s;h?.descriptions?.push(p.sanitizeText(r,i()))}cleanupLabel(t){return t.startsWith(":")?t.slice(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,`divider-id-${this.dividerCnt}`}addStyleClass(t,s=""){if(!this.classes.has(t))this.classes.set(t,{id:t,styles:[],textStyles:[]});let h=this.classes.get(t);if(s&&h)s.split(G.STYLECLASS_SEP).forEach((r)=>{let f=r.replace(/([^;]*);/,"$1").trim();if(RegExp(G.COLOR_KEYWORD).exec(r)){let b=f.replace(G.FILL_KEYWORD,G.BG_FILL).replace(G.COLOR_KEYWORD,G.FILL_KEYWORD);h.textStyles.push(b)}h.styles.push(f)})}getClasses(){return this.classes}setupToolTips(t){let s=Dt();l(t).select("svg").selectAll("g.node, g.rough-node").on("mouseover",(f)=>{let g=l(f.currentTarget),b=g.attr("title");if(b===null)return;let D=f.currentTarget?.getBoundingClientRect();s.transition().duration(200).style("opacity",".9"),s.style("left",window.scrollX+D.left+(D.right-D.left)/2+"px").style("top",window.scrollY+D.bottom+"px"),s.html(Le.sanitize(b)),g.classed("hover",!0)}).on("mouseout",(f)=>{s.transition().duration(500).style("opacity",0),l(f.currentTarget).classed("hover",!1)})}setCssClass(t,s){t.split(",").forEach((h)=>{let r=this.getState(h);if(!r){let f=h.trim();this.addState(f),r=this.getState(f)}r?.classes?.push(s)})}setStyle(t,s){this.getState(t)?.styles?.push(s)}setTextStyle(t,s){this.getState(t)?.textStyles?.push(s)}bindFunctions(t){this.funs.forEach((s)=>{s(t)})}getDirectionStatement(){return this.rootDoc.find((t)=>t.stmt===Ut)}getDirection(){return this.getDirectionStatement()?.value??_e}setDirection(t){let s=this.getDirectionStatement();if(s)s.value=t;else this.rootDoc.unshift({stmt:Ut,value:t})}trimColon(t){return t.startsWith(":")?t.slice(1).trim():t.trim()}getData(){let t=i();for(let s of this.nodes)if(s.wrappingWidth??=t.state?.wrappingWidth,!s.isGroup)s.minWidth??=t.state?.minNodeWidth;return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:de(this.getRootDocV2())}}getConfig(){return i().state}},qe=e((t)=>{let{theme:s,bkgColorArray:h,borderColorArray:r}=t;if(!ue(s,r))return"";let f=he(t.look),g=ge(h),b="";for(let D=0;D<vt(r);D++){let c=r[D],L=g?`fill: ${h[D%h.length]};`:"",I=`[data-look="${f}"][data-color-id="color-${D}"]`;b+=`

    /* The title strip: \`rect.outer\` spans the whole composite and \`rect.inner\` covers
       the body, so what stays visible of \`outer\` is the band behind the label. */
    ${I}.statediagram-cluster rect.outer {
      stroke: ${c};
      ${L}
    }

    ${I}.statediagram-cluster rect.inner {
      stroke: ${c};
    }

    /* Concurrency regions. Siblings of one composite share a slot, so a divided composite
       reads as one thing split into parts rather than as several composites. */
    ${I}.statediagram-cluster rect.divider {
      stroke: ${c};
      ${L}
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
    ${I}.statediagram-cluster .outer path[stroke='none'] {
      ${L}
    }

    ${I}.statediagram-cluster .outer path[fill='none'] {
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
    ${I}.statediagram-cluster .divider path[stroke='none'] {
      ${L}
    }

    ${I}.statediagram-cluster .divider path[fill='none'] {
      stroke: ${c};
    }
    `}return b},"genColor"),Qe=e((t)=>`
${qe(t)}
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
`,"getStyles"),Ze=Qe,ks={parser:Ee,get db(){return new Je(2)},renderer:Xe,styles:Ze,init:e((t)=>{if(!t.state)t.state={};t.state.arrowMarkerAbsolute=t.arrowMarkerAbsolute},"init")};export{ks as diagram};
