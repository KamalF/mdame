import{re}from"./main-bgdaza4s.js";import{e,n,R,O,B,w,k,T,S,E,_,P,W,Y}from"./main-hq6qtktj.js";import{oe}from"./main-hk1hx9jw.js";var L=R.packet,z=class{constructor(){this.packet=[],this.setAccTitle=k,this.getAccTitle=T,this.setDiagramTitle=_,this.getDiagramTitle=P,this.getAccDescription=E,this.setAccDescription=S}static{e(this,"PacketDB")}getConfig(){let t=W({...L,...O().packet});if(t.showBits)t.paddingY+=10;return t}getPacket(){return this.packet}pushWord(t){if(t.length>0)this.packet.push(t)}clear(){w(),this.packet=[]}},M=1e4,I=e((t,r)=>{re(t,r);let o=-1,i=[],l=1,{bitsPerRow:d}=r.getConfig();for(let{start:a,end:s,bits:g,label:f}of t.blocks){if(a!==void 0&&s!==void 0&&s<a)throw Error(`Packet block ${a} - ${s} is invalid. End must be greater than start.`);if(a??=o+1,a!==o+1)throw Error(`Packet block ${a} - ${s??a} is not contiguous. It should start from ${o+1}.`);if(g===0)throw Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);s??=a+(g??1)-1,g??=s-a+1,o=s,n.debug(`Packet block ${a} - ${o} with label ${f}`);while(i.length<=d+1&&r.getPacket().length<M){let[p,h]=j({start:a,end:s,bits:g,label:f},l,d);if(i.push(p),p.end+1===l*d)r.pushWord(i),i=[],l++;if(!h)break;({start:a,end:s,bits:g,label:f}=h)}}r.pushWord(i)},"populate"),j=e((t,r,o)=>{if(t.start===void 0)throw Error("start should have been set during first phase");if(t.end===void 0)throw Error("end should have been set during first phase");if(t.start>t.end)throw Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=r*o)return[t,void 0];let i=r*o-1,l=r*o;return[{start:t.start,end:i,label:t.label,bits:i-t.start},{start:l,end:t.end,label:t.label,bits:t.end-l}]},"getNextFittingBlock"),F={parser:{yy:void 0},parse:e(async(t)=>{let r=await oe("packet",t),o=F.parser?.yy;if(!(o instanceof z))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");n.debug(r),I(r,o)},"parse")},G=e((t,r,o,i)=>{let l=i.db,d=l.getConfig(),{rowHeight:a,paddingY:s,bitWidth:g,bitsPerRow:f}=d,p=l.getPacket(),h=l.getDiagramTitle(),v=a+s,c=v*(p.length+1)-(h?0:a),m=g*f+2,u=Y(r);u.attr("viewBox",`0 0 ${m} ${c}`),B(u,c,m,d.useMaxWidth);for(let[C,b]of p.entries())H(u,b,C,d);u.append("text").text(h).attr("x",m/2).attr("y",c-v/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),H=e((t,r,o,{rowHeight:i,paddingX:l,paddingY:d,bitWidth:a,bitsPerRow:s,showBits:g,bitOrder:f})=>{let p=t.append("g"),h=o*(i+d)+d,v=f==="descending";for(let c of r){let m=c.end-c.start+1,u=c.start%s,b=(v?s-u-m:u)*a+1,x=m*a-l;if(p.append("rect").attr("x",b).attr("y",h).attr("width",x).attr("height",i).attr("class","packetBlock"),p.append("text").attr("x",b+x/2).attr("y",h+i/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(c.label),!g)continue;let[A,N]=v?[c.end,c.start]:[c.start,c.end],y=m===1,D=h-2;if(p.append("text").attr("x",b+(y?x/2:0)).attr("y",D).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",y?"middle":"start").text(A),!y)p.append("text").attr("x",b+x).attr("y",D).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(N)}},"drawWord"),K={draw:G},U={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},X=e(({packet:t}={})=>{let r=W(U,t);return`
	.packetByte {
		font-size: ${r.byteFontSize};
	}
	.packetByte.start {
		fill: ${r.startByteColor};
	}
	.packetByte.end {
		fill: ${r.endByteColor};
	}
	.packetLabel {
		fill: ${r.labelColor};
		font-size: ${r.labelFontSize};
	}
	.packetTitle {
		fill: ${r.titleColor};
		font-size: ${r.titleFontSize};
	}
	.packetBlock {
		stroke: ${r.blockStrokeColor};
		stroke-width: ${r.blockStrokeWidth};
		fill: ${r.blockFillColor};
	}
	`},"styles"),rt={parser:F,get db(){return new z},renderer:K,styles:X};export{rt as diagram};
