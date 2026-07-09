(() => {
  const DATA = window.OCTO_DATA;
  const CLASS_ORDER = ['warrior','warlock','priest'];
  const STORE_KEY = 'octowow-talent-profiles-v4';
  const POINTS_MAX = DATA.meta.points;
  const $ = s => document.querySelector(s);
  const icon = name => DATA.meta.iconBase + name + '.png';

  let profiles = loadProfiles();
  let state = {
    cls: 'warrior',
    level: 60,
    mode: 'auto',
    profileId: null,
    profileName: 'Automatický profil — Warrior Protection',
    points: {},
    path: []
  };

  function cls(){ return DATA.classes[state.cls]; }
  function talents(){ return DATA.talents[state.cls]; }
  function byId(){ const m={}; talents().forEach(t=>m[t.id]=t); return m; }
  function treeIndex(tree){ return cls().trees.indexOf(tree); }
  function treeSpent(points=state.points, tree){ return talents().filter(t=>t.tree===tree).reduce((a,t)=>a+(points[t.id]||0),0); }
  function totalSpent(points=state.points){ return Object.values(points).reduce((a,b)=>a+(Number(b)||0),0); }
  function pointLimit(){ return Math.max(0, state.level - 9); }
  function pointsLeft(){ return Math.max(0, pointLimit() - totalSpent()); }
  function rowOf(t){ return Math.floor(t.slot/4); }
  function colOf(t){ return t.slot % 4; }
  function reqPointsForRow(t){ return rowOf(t)*5; }
  function initPoints(){ state.points = {}; talents().forEach(t => state.points[t.id]=0); }
  function emptyPointsFor(c){ const p={}; DATA.talents[c].forEach(t=>p[t.id]=0); return p; }
  function canAdd(t, points=state.points){
    if (!t) return false;
    if ((points[t.id]||0) >= t.ranks) return false;
    if (totalSpent(points) >= POINTS_MAX) return false;
    if (treeSpent(points,t.tree) < reqPointsForRow(t)) return false;
    if (t.requires){ const req = DATA.talents[state.cls].find(x=>x.id===t.requires); if (!req || (points[req.id]||0) < req.ranks) return false; }
    return true;
  }
  function validatePath(path, c=state.cls){
    const old = state.cls; state.cls = c;
    const points = emptyPointsFor(c); const map={}; DATA.talents[c].forEach(t=>map[t.id]=t);
    for (const id of path){ const t=map[id]; if(!t || !canAdd(t, points)){ state.cls=old; return false; } points[id]++; }
    state.cls = old; return true;
  }
  function applyPath(path){ initPoints(); state.path=[]; const map=byId(); for(const id of path){ const t=map[id]; if(t && canAdd(t)){ state.points[id]++; state.path.push(id); } } }
  function applyAuto(){ state.mode='auto'; state.profileId=null; state.profileName=`Automatický profil — ${cls().name} ${cls().spec}`; applyPath((DATA.paths[state.cls]||[]).slice(0,pointLimit())); }
  function switchManual(){ if(state.mode !== 'manual'){ state.mode='manual'; state.profileId=null; state.profileName=`Ruční profil — ${cls().name} ${cls().spec}`; } }

  function render(){ renderClasses(); renderProfileControls(); renderHeader(); renderStats(); renderTrees(); renderTalentsList(); renderPath(); }
  function renderClasses(){
    $('#classButtons').innerHTML = CLASS_ORDER.map(k=>`<button class="class-btn ${k===state.cls?'is-active':''}" data-class="${k}"><img src="${icon(DATA.classes[k].icon)}" alt=""><span><strong>${DATA.classes[k].name}</strong><small>${DATA.classes[k].spec} · ${DATA.classes[k].role}</small></span></button>`).join('');
    document.querySelectorAll('.class-btn').forEach(b=>b.onclick=()=>{ state.cls=b.dataset.class; state.level=60; initPoints(); applyAuto(); render(); });
  }
  function renderProfileControls(){
    const opts = ['<option value="">Automatický profil podle class</option>'].concat(profiles.map(p=>`<option value="${p.id}">${esc(p.name)} · ${DATA.classes[p.cls]?.name||p.cls}</option>`));
    $('#profileSelect').innerHTML=opts.join(''); $('#profileSelect').value=state.profileId||'';
    $('#profileName').value=state.profileName; $('#deleteProfileBtn').disabled=!state.profileId;
    $('#modeHint').textContent = state.mode==='auto' ? 'Automatická cesta. Level slider postupně vyklikává doporučený build.' : 'Ruční profil. Každý klik se zapíše jako další levelový krok.';
    $('#levelRange').disabled = state.mode === 'manual';
  }
  function renderHeader(){
    $('#classIcon').src=icon(cls().icon); $('#classTitle').textContent=cls().name; $('#classRole').textContent=`${cls().spec} · ${cls().role}`;
    $('#treeScore').textContent=cls().trees.map(t=>treeSpent(state.points,t)).join(' / ');
    $('#pointsLeft').textContent=pointsLeft(); $('#levelLabel').textContent=state.level; $('#levelRange').value=state.level;
  }
  function renderStats(){ $('#statList').innerHTML=cls().stats.map(s=>`<li>${esc(s)}</li>`).join(''); }
  function renderTrees(){
    const m=byId();
    $('#trees').innerHTML = cls().trees.map((tree,i)=>{
      const treeTalents=talents().filter(t=>t.tree===tree); const slotMap={}; treeTalents.forEach(t=>slotMap[t.slot]=t);
      let slots=''; for(let s=0;s<28;s++){ const t=slotMap[s]; if(!t){ slots+='<div class="slot empty"></div>'; continue; }
        const val=state.points[t.id]||0, locked=val===0&&!canAdd(t), full=val>=t.ranks, next=state.mode==='auto' && (DATA.paths[state.cls]||[])[totalSpent()]===t.id;
        const req = t.requires ? '<span class="req-dot"></span>' : '';
        slots += `<div class="slot"><button class="talent ${val?'is-chosen':''} ${locked?'is-locked':''} ${full?'is-full':''} ${next?'is-next':''}" data-id="${t.id}" aria-label="${esc(t.name)}"><img src="${icon(t.icon)}" alt=""><span class="rank">${val}/${t.ranks}</span>${req}<span class="mini-name">${esc(t.name)}</span></button></div>`;
      }
      return `<section class="tree"><div class="tree-head"><div class="tree-title"><img src="${icon(treeIcon(tree))}" alt=""><h2>${tree}</h2></div><div class="tree-points">${treeSpent(state.points,tree)} / ${cls().max[i]}</div></div><div class="talent-grid">${slots}</div></section>`;
    }).join('');
    document.querySelectorAll('.talent').forEach(btn=>{
      const t=m[btn.dataset.id];
      btn.onclick=e=>{ e.preventDefault(); addTalent(t.id); };
      btn.oncontextmenu=e=>{ e.preventDefault(); removeTalent(t.id); };
      btn.onmouseenter=e=>showTip(e,t); btn.onmousemove=moveTip; btn.onmouseleave=hideTip;
    });
  }
  function treeIcon(tree){
    const icons={Arms:'inv_sword_27',Fury:'ability_warrior_battleshout',Protection:'inv_shield_06',Affliction:'spell_shadow_unsummonbuilding',Demonology:'spell_shadow_curseoftounges',Destruction:'spell_fire_incinerate',Discipline:'spell_holy_auraoflight',Holy:'spell_holy_layonhands',Shadow:'spell_shadow_possession'}; return icons[tree]||'inv_misc_questionmark';
  }
  function addTalent(id){ const t=byId()[id]; switchManual(); if(!canAdd(t)){ toast(lockReason(t)); return; } state.points[id]++; state.path.push(id); state.level=Math.min(60, 9+state.path.length); render(); }
  function removeTalent(id){
    switchManual(); const idx=state.path.lastIndexOf(id); if(idx<0){ toast('Tenhle talent není poslední zvolený bod v profilu.'); return; }
    const candidate=state.path.slice(); candidate.splice(idx,1); if(!validatePath(candidate,state.cls)){ toast('Nejdřív odeber závislé nebo hlubší talenty.'); return; }
    applyPath(candidate); state.level=Math.max(10,9+state.path.length); render();
  }
  function lockReason(t){ if(!t) return 'Talent nejde přidat.'; if(totalSpent()>=POINTS_MAX) return 'Už je utraceno 51 bodů.'; if((state.points[t.id]||0)>=t.ranks) return 'Talent je na max ranku.'; if(treeSpent(state.points,t.tree)<reqPointsForRow(t)) return `Řada je zamčená. Ve stromu ${t.tree} musí být nejdřív ${reqPointsForRow(t)} bodů.`; if(t.requires){ const r=byId()[t.requires]; return `Nejdřív musí být dokončený ${r?.name||'požadovaný talent'}.`; } return 'Talent nejde přidat.'; }
  function renderTalentsList(){
    $('#allTalents').innerHTML = talents().map(t=>`<article class="talent-line"><img src="${icon(t.icon)}" alt=""><div><h3>${esc(t.name)}</h3><small>${t.tree} · ${t.ranks} rank${t.ranks>1?'s':''}</small><p>${esc(t.desc)}</p></div></article>`).join('');
  }
  function renderPath(){
    const map=byId(); const src = state.mode==='auto' ? (DATA.paths[state.cls]||[]) : state.path;
    $('#pathList').innerHTML = src.map((id,i)=>{ const t=map[id]; const lvl=i+10; const active = state.mode==='manual' || lvl<=state.level; return `<div class="path-step ${lvl===state.level?'now':''} ${active?'':'future'}"><b>${lvl}</b><div><strong>${t?esc(t.name):esc(id)}</strong><span>${t?esc(t.tree):''}${state.mode==='manual'?' · klik #'+(i+1):''}</span></div></div>`; }).join('') || '<p class="empty-note">Ruční profil je prázdný. Klikni na první talent — zapíše se jako level 10.</p>';
  }
  function showTip(e,t){ const val=state.points[t.id]||0, locked=val===0&&!canAdd(t); const req=t.requires?`<p>Vyžaduje: <b>${esc(byId()[t.requires]?.name||t.requires)}</b></p>`:''; $('#tooltip').hidden=false; $('#tooltip').innerHTML=`<h3>${esc(t.name)}</h3><small>${esc(t.tree)} · Rank ${val}/${t.ranks}</small><p>${esc(t.desc)}</p>${req}${locked?`<p class="warn">${esc(lockReason(t))}</p>`:''}<p>Levý klik přidá bod. Pravý klik odebere poslední bod tohoto talentu.</p>`; moveTip(e); }
  function moveTip(e){ const tip=$('#tooltip'); let x=e.clientX+16,y=e.clientY+16; const r=tip.getBoundingClientRect(); if(x+r.width>innerWidth-12) x=e.clientX-r.width-16; if(y+r.height>innerHeight-12) y=innerHeight-r.height-12; tip.style.left=x+'px'; tip.style.top=y+'px'; }
  function hideTip(){ $('#tooltip').hidden=true; }
  function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.hidden=true,2600); }
  function saveProfiles(){ localStorage.setItem(STORE_KEY, JSON.stringify(profiles)); }
  function loadProfiles(){ try{return JSON.parse(localStorage.getItem(STORE_KEY)||'[]')}catch{return []} }
  function saveCurrent(copy=false){ const name=$('#profileName').value.trim()||state.profileName||'Bez názvu'; const data={id:copy||!state.profileId?crypto.randomUUID():state.profileId,name,cls:state.cls,level:state.level,path:state.path,mode:'manual'}; if(data.path.length===0 && state.mode==='auto') data.path=(DATA.paths[state.cls]||[]).slice(0,pointLimit()); const idx=profiles.findIndex(p=>p.id===data.id); if(idx>=0) profiles[idx]=data; else profiles.push(data); state.profileId=data.id; state.profileName=data.name; state.mode='manual'; state.path=data.path.slice(); applyPath(state.path); saveProfiles(); render(); toast('Profil uložený v prohlížeči.'); }
  function loadProfile(id){ const p=profiles.find(x=>x.id===id); if(!p) return; state.cls=p.cls; state.mode='manual'; state.profileId=p.id; state.profileName=p.name; state.level=p.level||Math.min(60,9+(p.path?.length||0)); initPoints(); applyPath(p.path||[]); render(); }
  function delProfile(){ if(!state.profileId) return; profiles=profiles.filter(p=>p.id!==state.profileId); saveProfiles(); state.profileId=null; applyAuto(); render(); toast('Profil smazán.'); }
  function exportProfiles(){ const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),profiles},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='octowow-profily.json'; a.click(); URL.revokeObjectURL(a.href); }
  function importProfiles(file){ if(!file) return; const r=new FileReader(); r.onload=()=>{ try{ const obj=JSON.parse(r.result); const incoming=Array.isArray(obj)?obj:obj.profiles; if(!Array.isArray(incoming)) throw new Error(); for(const p of incoming){ if(!p.id) p.id=crypto.randomUUID(); if(Array.isArray(p.path) && validatePath(p.path,p.cls)) profiles.push(p); } saveProfiles(); render(); toast('Import dokončen.'); }catch{ toast('JSON nejde načíst nebo profil není platný.'); } }; r.readAsText(file); }
  function esc(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  $('#levelRange').oninput=e=>{ state.level=Number(e.target.value); if(state.mode==='auto') applyAuto(); render(); };
  $('#levelMinus').onclick=()=>{ state.level=Math.max(10,state.level-1); if(state.mode==='auto') applyAuto(); render(); };
  $('#levelPlus').onclick=()=>{ state.level=Math.min(60,state.level+1); if(state.mode==='auto') applyAuto(); render(); };
  $('#autoBtn').onclick=()=>{ state.level=60; applyAuto(); render(); };
  $('#clearBtn').onclick=()=>{ switchManual(); initPoints(); state.path=[]; state.level=10; render(); };
  $('#newProfileBtn').onclick=()=>{ state.mode='manual'; state.profileId=null; state.profileName=`Nový profil — ${cls().name} ${cls().spec}`; initPoints(); state.path=[]; state.level=10; render(); };
  $('#saveProfileBtn').onclick=()=>saveCurrent(false);
  $('#saveCopyBtn').onclick=()=>saveCurrent(true);
  $('#deleteProfileBtn').onclick=delProfile;
  $('#profileSelect').onchange=e=>{ if(e.target.value) loadProfile(e.target.value); else { applyAuto(); render(); } };
  $('#profileName').oninput=e=>state.profileName=e.target.value;
  $('#printBtn').onclick=()=>window.print();
  $('#exportBtn').onclick=exportProfiles;
  $('#importFile').onchange=e=>importProfiles(e.target.files[0]);

  initPoints(); applyAuto(); render();
})();
