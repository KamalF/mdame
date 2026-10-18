# Hostile HTML

<script>alert(1)</script>
<img src="x.png" onerror="alert(1)" alt="handler">
<a href="javascript:alert(1)">script link</a>
<a href="JaVaScRiPt:alert(1)">mixed case</a>
<a href="data:text/html,<script>alert(1)</script>">data link</a>
<iframe src="https://example.com"></iframe>
<object data="x.swf"></object>
<embed src="x.swf">
<style>body { display: none }</style>
<p style="position: fixed; inset: 0">styled</p>
<form action="https://example.com"><button>Send</button></form>
<input type="text" value="secret">
<svg onload="alert(1)"><circle r="1"/></svg>
<math><mi xlink:href="javascript:alert(1)">x</mi></math>
<div onclick="alert(1)" onmouseover="alert(1)">handlers</div>
<base href="https://example.com/">
<meta http-equiv="refresh" content="0; url=https://example.com">
<link rel="stylesheet" href="https://example.com/x.css">

[markdown script link](javascript:alert(1))

![markdown image](javascript:alert(1))

<a href="#fn-1" id="fn-1" data-evil="1">kept link</a>
