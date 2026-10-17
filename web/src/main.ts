const response = await fetch("/api/state");
const state = await response.json();
document.getElementById("state")!.textContent = JSON.stringify(state, null, 2);
