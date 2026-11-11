(() => {
  const $ = id => document.getElementById(id);
  const audio = $('audioElement'), video = $('videoElement');
  let items = [], queue = [], currentIndex = -1, searchType = 'music', playlists = [];
  let favorites = JSON.parse(localStorage.getItem('amp_favorites') || '[]');
  let history = JSON.parse(localStorage.getItem('amp_history') || '[]');
  let activePlaylist = null, toastTimer, currentItem = null;

  const save = () => {
    localStorage.setItem('amp_favorites', JSON.stringify(favorites));
    localStorage.setItem('amp_history', JSON.stringify(history.slice(0,80)));
    localStorage.setItem('amp_playlists', JSON.stringify(playlists));
  };
  playlists = JSON.parse(localStorage.getItem('amp_playlists') || '[]');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = msg => { $('toast').textContent=msg; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2300); };
  const time = n => { if (!Number.isFinite(n)) return '0:00'; return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'); };
  const persistable = x => ({id:x.id,title:x.title,artist:x.artist,kind:x.kind,src:x.remote?x.src:null,art:x.art||'',remote:!!x.remote,source:x.source||''});
  const isFav = x => favorites.some(f=>f.id===x.id);

  function showView(name) {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const el=$(name+'View'); if(el) el.classList.add('active');
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    $('breadcrumb').textContent=({home:'Domů',search:'Vyhledávání',library:'Moje soubory',favorites:'Oblíbené',history:'Historie',playlist:'Playlist'})[name]||name;
    $('sidebar').classList.remove('open');
    if(name==='library') renderLibrary();
    if(name==='favorites') renderCollection('favoritesList',favorites);
    if(name==='history') renderCollection('historyList',history);
    if(name==='playlist') renderPlaylist();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.goto)));
  $('homeSearch').onclick=()=>showView('search');
  $('menuButton').onclick=()=>$('sidebar').classList.toggle('open');
  const themeSwitch=$('checkbox');
  const applyTheme=light=>{document.body.classList.toggle('light',light);themeSwitch.checked=light;localStorage.setItem('amp_light',light?'1':'0');};
  applyTheme(localStorage.getItem('amp_light')==='1');
  themeSwitch.addEventListener('change',()=>applyTheme(themeSwitch.checked));

  $('uploadButton').onclick=()=>$('fileInput').click();
  $('fileInput').addEventListener('change',e=>{
    [...e.target.files].forEach(file=>{
      const kind=file.type.startsWith('video/')?'video':'music';
      const x={id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),title:file.name.replace(/\.[^.]+$/,''),artist:'Místní soubor',kind,src:URL.createObjectURL(file),remote:false,fileName:file.name};
      items.unshift(x);
    });
    renderHome(); renderLibrary(); toast(`Přidáno ${e.target.files.length} souborů`); e.target.value='';
  });

  function row(x, index, allowFav=true) {
    const art=x.art?`<img class="result-art" src="${esc(x.art)}" alt="">`:`<div class="result-art">${x.kind==='video'?'▣':'♫'}</div>`;
    return `<div class="result-row">${art}<div class="result-info"><strong>${esc(x.title)}</strong><small>${esc(x.artist||'Neznámý interpret')} · ${x.kind==='video'?'Video':'Hudba'}${x.source?' · '+esc(x.source):''}</small></div><div class="row-actions"><button data-play="${index}" title="Přehrát">▶</button>${allowFav?`<button data-fav="${esc(x.id)}" title="Oblíbené">${isFav(x)?'♥':'♡'}</button>`:''}<button data-add="${esc(x.id)}" title="Přidat do playlistu">＋</button></div></div>`;
  }
  function bindRows(container, list) {
    container.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(list[Number(b.dataset.play)],list));
    container.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>toggleFavorite(list.find(x=>x.id===b.dataset.fav)));
    container.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addToPlaylist(list.find(x=>x.id===b.dataset.add)));
  }
  function renderLibrary() {
    const box=$('libraryList');
    box.innerHTML=items.length?items.map((x,i)=>row(x,i,false)).join(''):'<div class="empty-state">Zatím nemáš přidané žádné soubory. Použij tlačítko „Přidat soubory“.</div>';
    bindRows(box,items);
  }
  function renderCollection(id,list) {
    const box=$(id);
    box.innerHTML=list.length?list.map((x,i)=>row(x,i)).join(''):'<div class="empty-state">Tady zatím nic není.</div>';
    bindRows(box,list);
  }
  function renderHome() {
    $('homeRecent').innerHTML=items.length?items.slice(0,6).map(x=>`<div class="media-card">${x.art?`<img src="${esc(x.art)}" alt="">`:'<div class="media-placeholder">'+(x.kind==='video'?'▣':'♫')+'</div>'}<strong>${esc(x.title)}</strong><small>${esc(x.artist)}</small><button data-localplay="${esc(x.id)}">Přehrát</button></div>`).join(''):'<div class="empty-state">Zatím tu nic není. Přidej hudbu nebo video ze svého zařízení.</div>';
    $('homeRecent').querySelectorAll('[data-localplay]').forEach(b=>b.onclick=()=>play(items.find(x=>x.id===b.dataset.localplay),items));
  }
  function play(x,list=items) {
    if(!x || !x.src){toast('Tento výsledek nemá dostupný přehratelný soubor.');return;}
    queue=list; currentIndex=list.indexOf(x); currentItem=x;
    const el=x.kind==='video'?video:audio;
    if(x.kind==='video'){audio.pause();video.hidden=false;video.poster=x.art||'';video.src=x.src;video.play().catch(()=>toast('Přehrávání se nepodařilo spustit.'));$('nowArt').innerHTML=x.art?`<img src="${esc(x.art)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`:'▣';}
    else {video.pause();video.hidden=true;video.removeAttribute('src');audio.src=x.src;audio.play().catch(()=>toast('Přehrávání se nepodařilo spustit.'));$('nowArt').innerHTML=x.art?`<img src="${esc(x.art)}" style="width:100%;height:100%;object-fit:cover;border-radius:7px">`:'♫';}
    $('nowTitle').textContent=x.title; $('nowArtist').textContent=x.artist||'Neznámý interpret';
    $('favoriteCurrent').textContent=isFav(x)?'♥':'♡';
    $('currentTime').textContent='0:00'; $('duration').textContent='0:00'; $('seekBar').value=0;
    history=[persistable(x),...history.filter(h=>h.id!==x.id)].slice(0,80); save(); updatePlayButton();
  }
  function activeMedia(){return !video.hidden && video.src ? video : audio;}
  function updatePlayButton(){const playing=!!(activeMedia().src && !activeMedia().paused);$('toggle').checked=playing;$('toggle').setAttribute('aria-label',playing?'Pozastavit':'Přehrát');}
  $('toggle').addEventListener('change',()=>{
    const el=activeMedia();
    if(!currentItem || !el.getAttribute('src')){
      $('toggle').checked=false;
      toast('Nejdřív vyber skladbu nebo video.');
      return;
    }
    if($('toggle').checked){
      const attempt=el.play();
      if(attempt && typeof attempt.catch==='function'){
        attempt.catch(()=>{
          $('toggle').checked=false;
          updatePlayButton();
          toast('Přehrávání se nepodařilo spustit.');
        });
      }
    } else {
      el.pause();
    }
  });
  function next(delta){if(!queue.length)return;currentIndex=(currentIndex+delta+queue.length)%queue.length;play(queue[currentIndex],queue);}
  $('nextButton').onclick=()=>next(1); $('previousButton').onclick=()=>next(-1);
  [audio,video].forEach(el=>{
    el.addEventListener('play',updatePlayButton);el.addEventListener('pause',updatePlayButton);
    el.addEventListener('timeupdate',()=>{if(el!==activeMedia())return; $('currentTime').textContent=time(el.currentTime);$('duration').textContent=time(el.duration);$('seekBar').value=el.duration?el.currentTime/el.duration*1000:0;});
    el.addEventListener('ended',()=>next(1));
  });
  $('seekBar').oninput=e=>{const el=activeMedia();if(el.duration)el.currentTime=el.duration*e.target.value/1000;};
  $('volumeBar').oninput=e=>{audio.volume=Number(e.target.value);video.volume=Number(e.target.value);};
  $('favoriteCurrent').onclick=()=>{if(currentItem){toggleFavorite(currentItem);$('favoriteCurrent').textContent=isFav(currentItem)?'♥':'♡';}else toast('Nejdřív něco přehraj.');};
  $('fullscreenButton').onclick=async()=>{if(video.hidden||!video.src){toast('Celá obrazovka je dostupná při přehrávání videa.');return;}try{if(document.fullscreenElement)await document.exitFullscreen();else if(video.requestFullscreen)await video.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else toast('Celá obrazovka není v tomto prohlížeči podporována.');}catch(e){toast('Nepodařilo se otevřít celou obrazovku.');}};
  $('queueButton').onclick=()=>toast(queue.length?`Ve frontě je ${queue.length} položek.`:'Fronta je prázdná.');

  function toggleFavorite(x){if(!x)return;const wasFavorite=isFav(x);if(wasFavorite)favorites=favorites.filter(f=>f.id!==x.id);else favorites.unshift(persistable(x));save();renderCollection('favoritesList',favorites);if(currentItem?.id===x.id)$('favoriteCurrent').textContent=isFav(x)?'♥':'♡';toast(wasFavorite?'Odebráno z oblíbených':'Přidáno do oblíbených');}
  function addToPlaylist(x){if(!x)return;if(!playlists.length){const name=prompt('Název nového playlistu:');if(!name?.trim())return;playlists.push({id:'pl-'+Date.now(),name:name.trim(),items:[]});}let p=playlists[0];if(playlists.length>1){const choices=playlists.map((pl,i)=>`${i+1}. ${pl.name}`).join('\n');const answer=prompt('Vyber playlist číslem:\n'+choices,'1');if(answer===null)return;const chosen=playlists[Number(answer)-1];if(!chosen){toast('Neplatná volba playlistu.');return;}p=chosen;}if(!p.items.some(i=>i.id===x.id))p.items.push(persistable(x));save();renderPlaylists();toast(`Přidáno do playlistu ${p.name}`);}
  $('newPlaylist').onclick=()=>{const name=prompt('Název playlistu:');if(!name?.trim())return;playlists.push({id:'pl-'+Date.now(),name:name.trim(),items:[]});save();renderPlaylists();toast('Playlist vytvořen');};
  function renderPlaylists(){ $('playlistList').innerHTML=playlists.map(p=>`<button class="nav-item" data-pl="${esc(p.id)}"><span>♫</span>${esc(p.name)}</button>`).join('');$('playlistList').querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{activePlaylist=b.dataset.pl;showView('playlist');}); }
  function renderPlaylist(){const p=playlists.find(p=>p.id===activePlaylist);$('playlistTitle').textContent=p?.name||'Playlist';const list=p?.items||[];$('playlistItems').innerHTML=list.length?list.map((x,i)=>row(x,i)).join(''):'<div class="empty-state">Tento playlist je prázdný.</div>';bindRows($('playlistItems'),list);}

  document.querySelectorAll('.search-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.search-tab').forEach(t=>t.classList.remove('active'));b.classList.add('active');searchType=b.dataset.type;$('searchInput').placeholder=searchType==='music'?'Název skladby nebo interpret':'Název videa';$('searchStatus').textContent='Zadej hledaný výraz.';$('searchResults').innerHTML='';});
  $('searchForm').onsubmit=async e=>{e.preventDefault();const q=$('searchInput').value.trim();if(!q)return;const box=$('searchResults');box.innerHTML='';$('searchStatus').textContent='Vyhledávám…';try{const results=searchType==='music'?await searchMusic(q):await searchVideos(q);$('searchStatus').textContent=results.length?`Nalezeno výsledků: ${results.length}`:'Nic jsme nenašli. Zkus jiný výraz.';box.innerHTML=results.map((x,i)=>row(x,i)).join('');bindRows(box,results);}catch(err){$('searchStatus').textContent='Vyhledávání se nepodařilo. Zkontroluj připojení k internetu a zkus to znovu.';}};
  async function searchMusic(q){
    const url='https://itunes.apple.com/search?term='+encodeURIComponent(q)+'&media=music&entity=song&limit=25';
    const data=await (await fetch(url)).json();
    return (data.results||[]).filter(x=>x.previewUrl).map(x=>({id:'itunes-'+x.trackId,title:x.trackName,artist:x.artistName,kind:'music',src:x.previewUrl,art:x.artworkUrl100,remote:true,source:'iTunes preview'}));
  }
  async function searchVideos(q){
    const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent('('+q+') AND mediatype:movies')+'&fl[]=identifier,title,creator,year&rows=25&page=1&output=json';
    const data=await (await fetch(url)).json();
    const docs=data.response?.docs||[];
    return docs.map(x=>({id:'ia-'+x.identifier,title:x.title||x.identifier,artist:[x.creator,x.year].filter(Boolean).join(' · ')||'Internet Archive',kind:'video',src:'https://archive.org/metadata/'+encodeURIComponent(x.identifier),art:'https://archive.org/services/img/'+encodeURIComponent(x.identifier),remote:true,source:'Internet Archive',identifier:x.identifier,needsResolve:true}));
  }
  // Resolve an Internet Archive record to a playable media file when the user presses play.
  const originalPlay=play;
  play=async function(x,list=items){
    if(x?.needsResolve){try{toast('Načítám video…');const meta=await (await fetch(x.src)).json();const files=meta.files||[];const f=files.find(f=>/\.mp4$/i.test(f.name)&&Number(f.size||0)>0)||files.find(f=>/\.(ogv|webm|m4v)$/i.test(f.name)&&Number(f.size||0)>0);if(!f)throw Error('No playable file');x.src='https://archive.org/download/'+encodeURIComponent(x.identifier)+'/'+encodeURIComponent(f.name);x.needsResolve=false;originalPlay(x,list);}catch(e){toast('U tohoto záznamu se nepodařilo najít přehratelné video.');}return;}
    originalPlay(x,list);
  };

  renderPlaylists();renderHome();renderLibrary();updatePlayButton();
})();