import{ee}from"./main-q3w7pm59.js";import{e,n,Q,m,X,w,x,S,k,E,P,C,G,Y}from"./main-eqghj39w.js";import{le}from"./main-a3tp0and.js";var N=Q.packet,F=class{constructor(){this.packet=[],this.setAccTitle=x,this.getAccTitle=S,this.setDiagramTitle=P,this.getDiagramTitle=C,this.getAccDescription=E,this.setAccDescription=k}static{e(this,"PacketDB")}getConfig(){let t=Y({...N,...m().packet});if(t.showBits)t.paddingY+=10;return t}getPacket(){return this.packet}pushWord(t){if(t.length>0)this.packet.push(t)}clear(){w(),this.packet=[]}},L=1e4,M=e((t,r)=>{ee(t,r);let o=-1,i=[],l=1,{bitsPerRow:d}=r.getConfig();for(let{start:a,end:s,bits:g,label:f}of t.blocks){if(a!==void 0&&s!==void 0&&s<a)throw Error(`Packet block ${a} - ${s} is invalid. End must be greater than start.`);if(a??=o+1,a!==o+1)throw Error(`Packet block ${a} - ${s??a} is not contiguous. It should start from ${o+1}.`);if(g===0)throw Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);s??=a+(g??1)-1,g??=s-a+1,o=s,n.debug(`Packet block ${a} - ${o} with label ${f}`);while(i.length<=d+1&&r.getPacket().length<L){let[p,h]=I({start:a,end:s,bits:g,label:f},l,d);if(i.push(p),p.end+1===l*d)r.pushWord(i),i=[],l++;if(!h)break;({start:a,end:s,bits:g,label:f}=h)}}r.pushWord(i)},"populate"),I=e((t,r,o)=>{if(t.start===void 0)throw Error("start should have been set during first phase");if(t.end===void 0)throw Error("end should have been set during first phase");if(t.start>t.end)throw Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=r*o)return[t,void 0];let i=r*o-1,l=r*o;return[{start:t.start,end:i,label:t.label,bits:i-t.start},{start:l,end:t.end,label:t.label,bits:t.end-l}]},"getNextFittingBlock"),A={parser:{yy:void 0},parse:e(async(t)=>{let r=await le("packet",t),o=A.parser?.yy;if(!(o instanceof F))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");n.debug(r),M(r,o)},"parse")},O=e((t,r,o,i)=>{let l=i.db,d=l.getConfig(),{rowHeight:a,paddingY:s,bitWidth:g,bitsPerRow:f}=d,p=l.getPacket(),h=l.getDiagramTitle(),y=a+s,c=y*(p.length+1)-(h?0:a),u=g*f+2,b=G(r);b.attr("viewBox",`0 0 ${u} ${c}`),X(b,c,u,d.useMaxWidth);for(let[T,v]of p.entries())j(b,v,T,d);b.append("text").text(h).attr("x",u/2).attr("y",c-y/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),j=e((t,r,o,{rowHeight:i,paddingX:l,paddingY:d,bitWidth:a,bitsPerRow:s,showBits:g,bitOrder:f})=>{let p=t.append("g"),h=o*(i+d)+d,y=f==="descending";for(let c of r){let u=c.end-c.start+1,b=c.start%s,v=(y?s-b-u:b)*a+1,B=u*a-l;if(p.append("rect").attr("x",v).attr("y",h).attr("width",B).attr("height",i).attr("class","packetBlock"),p.append("text").attr("x",v+B/2).attr("y",h+i/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(c.label),!g)continue;let[W,_]=y?[c.end,c.start]:[c.start,c.end],D=u===1,z=h-2;if(p.append("text").attr("x",v+(D?B/2:0)).attr("y",z).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",D?"middle":"start").text(W),!D)p.append("text").attr("x",v+B).attr("y",z).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(_)}},"drawWord"),H={draw:O},K={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},U=e(({packet:t}={})=>{let r=Y(K,t);return`
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
	`},"styles"),rt={parser:A,get db(){return new F},renderer:H,styles:U};export{rt as diagram};
