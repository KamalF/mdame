var t=await fetch("/api/state"),e=await t.json();document.getElementById("state").textContent=JSON.stringify(e,null,2);
