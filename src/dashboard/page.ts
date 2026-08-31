export const dashboardPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Codex Spec Workflow</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0b0d10; color: #eef0f3; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 85% -10%, #24304a 0, transparent 38%), #0b0d10; }
    main { max-width: 1180px; margin: auto; padding: 40px 24px 80px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
    h1 { margin: 0; font-size: clamp(28px, 5vw, 48px); letter-spacing: -.04em; }
    .subtitle, .muted { color: #9da6b5; }
    .live { display: inline-flex; gap: 8px; align-items: center; color: #9da6b5; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #ed6a5a; }
    .connected .dot { background: #56d99f; box-shadow: 0 0 12px #56d99f; }
    .project { margin: 28px 0 48px; }
    .project-title { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 14px; }
    h2 { margin: 0; font-size: 22px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .card { background: rgba(24, 28, 35, .86); border: 1px solid #2c333f; border-radius: 14px; padding: 18px; box-shadow: 0 12px 34px rgba(0,0,0,.18); }
    .card-top { display: flex; justify-content: space-between; gap: 12px; }
    .kind { color: #9da6b5; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
    .phase { color: #d7b36a; font-size: 13px; }
    .title { font-size: 18px; font-weight: 650; margin: 7px 0 15px; }
    .bar { height: 7px; border-radius: 10px; background: #303744; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: linear-gradient(90deg,#70a5ff,#64d5aa); }
    .row { display: flex; justify-content: space-between; margin-top: 9px; font-size: 13px; color: #aab2bf; }
    .approvals { margin-top: 15px; display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { font-size: 11px; border: 1px solid #394252; border-radius: 99px; padding: 4px 7px; color: #aab2bf; }
    .pill.approved { color: #70d8a8; border-color: #315e4b; }
    .empty { color: #758092; border: 1px dashed #303744; border-radius: 14px; padding: 22px; }
    @media (max-width: 620px) { header { align-items: start; flex-direction: column; } main { padding: 28px 16px 60px; } }
  </style>
</head>
<body>
<main>
  <header><div><h1>Spec Workflow</h1><div class="subtitle">Structured Codex specs and bug fixes</div></div><div id="live" class="live"><span class="dot"></span><span>Connecting</span></div></header>
  <div id="app"><div class="empty">Loading workflow state…</div></div>
</main>
<script>
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function card(status) {
  const w = status.workflow, progress = status.progress || {completed:0,total:0,percent:0};
  const approvals = Object.entries(w.approvals).map(([phase, gate]) => '<span class="pill '+(gate.status==='approved'?'approved':'')+'">'+esc(phase)+': '+esc(gate.status)+'</span>').join('');
  const taskBlock = w.kind === 'spec' ? '<div class="bar"><span style="width:'+progress.percent+'%"></span></div><div class="row"><span>'+progress.completed+' / '+progress.total+' tasks</span><span>'+progress.percent+'%</span></div>' : '';
  return '<article class="card"><div class="card-top"><span class="kind">'+esc(w.kind)+'</span><span class="phase">'+esc(w.phase)+'</span></div><div class="title">'+esc(w.title || w.name)+'</div>'+taskBlock+'<div class="approvals">'+approvals+'</div></article>';
}
function render(snapshot) {
  const html = snapshot.projects.map(project => {
    const workflows = [...project.specs, ...project.bugs];
    const meta = [project.git.branch, project.git.dirty === true ? 'modified' : project.git.dirty === false ? 'clean' : '', project.steering.length+' steering docs'].filter(Boolean).join(' · ');
    return '<section class="project"><div class="project-title"><h2>'+esc(project.name)+'</h2><span class="muted">'+esc(meta)+'</span></div>'+(workflows.length?'<div class="grid">'+workflows.map(card).join('')+'</div>':'<div class="empty">No structured workflows yet.</div>')+'</section>';
  }).join('');
  document.getElementById('app').innerHTML = html || '<div class="empty">No projects configured.</div>';
}
fetch('/api/snapshot').then(response => response.json()).then(render);
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(protocol+'//'+location.host+'/ws');
socket.onopen = () => { const live=document.getElementById('live'); live.classList.add('connected'); live.lastChild.textContent='Live'; };
socket.onmessage = event => render(JSON.parse(event.data));
socket.onclose = () => { const live=document.getElementById('live'); live.classList.remove('connected'); live.lastChild.textContent='Disconnected'; };
</script>
</body>
</html>`;
