import{K}from"./main-1g31nb70.js";import{e,n,C,g,N,v,w,k,x,T,E,S,V,F}from"./main-8gzg685w.js";import{ie}from"./main-m44xsvf1.js";var Y=C.packet,W=class{constructor(){this.packet=[],this.setAccTitle=w,this.getAccTitle=k,this.setDiagramTitle=E,this.getDiagramTitle=S,this.getAccDescription=T,this.setAccDescription=x}static{e(this,"PacketDB")}getConfig(){let t=F({...Y,...g().packet});if(t.showBits)t.paddingY+=10;return t}getPacket(){return this.packet}pushWord(t){if(t.length>0)this.packet.push(t)}clear(){v(),this.packet=[]}},I=1e4,O=e((t,r)=>{K(t,r);let o=-1,i=[],l=1,{bitsPerRow:d}=r.getConfig();for(let{start:a,end:s,bits:h,label:m}of t.blocks){if(a!==void 0&&s!==void 0&&s<a)throw Error(`Packet block ${a} - ${s} is invalid. End must be greater than start.`);if(a??=o+1,a!==o+1)throw Error(`Packet block ${a} - ${s??a} is not contiguous. It should start from ${o+1}.`);if(h===0)throw Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);s??=a+(h??1)-1,h??=s-a+1,o=s,n.debug(`Packet block ${a} - ${o} with label ${m}`);while(i.length<=d+1&&r.getPacket().length<I){let[p,f]=j({start:a,end:s,bits:h,label:m},l,d);if(i.push(p),p.end+1===l*d)r.pushWord(i),i=[],l++;if(!f)break;({start:a,end:s,bits:h,label:m}=f)}}r.pushWord(i)},"populate"),j=e((t,r,o)=>{if(t.start===void 0)throw Error("start should have been set during first phase");if(t.end===void 0)throw Error("end should have been set during first phase");if(t.start>t.end)throw Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=r*o)return[t,void 0];let i=r*o-1,l=r*o;return[{start:t.start,end:i,label:t.label,bits:i-t.start},{start:l,end:t.end,label:t.label,bits:t.end-l}]},"getNextFittingBlock"),_={parser:{yy:void 0},parse:e(async(t)=>{let r=await ie("packet",t),o=_.parser?.yy;if(!(o instanceof W))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");n.debug(r),O(r,o)},"parse")},G=e((t,r,o,i)=>{let l=i.db,d=l.getConfig(),{rowHeight:a,paddingY:s,bitWidth:h,bitsPerRow:m}=d,p=l.getPacket(),f=l.getDiagramTitle(),B=a+s,c=B*(p.length+1)-(f?0:a),u=h*m+2,b=V(r);b.attr("viewBox",`0 0 ${u} ${c}`),N(b,c,u,d.useMaxWidth);for(let[P,y]of p.entries())H(b,y,P,d);b.append("text").text(f).attr("x",u/2).attr("y",c-B/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),H=e((t,r,o,{rowHeight:i,paddingX:l,paddingY:d,bitWidth:a,bitsPerRow:s,showBits:h,bitOrder:m})=>{let p=t.append("g"),f=o*(i+d)+d,B=m==="descending";for(let c of r){let u=c.end-c.start+1,b=c.start%s,y=(B?s-b-u:b)*a+1,D=u*a-l;if(p.append("rect").attr("x",y).attr("y",f).attr("width",D).attr("height",i).attr("class","packetBlock"),p.append("text").attr("x",y+D/2).attr("y",f+i/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(c.label),!h)continue;let[L,M]=B?[c.end,c.start]:[c.start,c.end],z=u===1,A=f-2;if(p.append("text").attr("x",y+(z?D/2:0)).attr("y",A).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",z?"middle":"start").text(L),!z)p.append("text").attr("x",y+D).attr("y",A).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(M)}},"drawWord"),U={draw:G},X={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},q=e(({packet:t}={})=>{let r=F(X,t);return`
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
	`},"styles"),at={parser:_,get db(){return new W},renderer:U,styles:q};export{at as diagram};
