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
  // Upgrade older saved Internet Archive entries that used to store only the metadata URL.
  const migrateSavedItem = x => {
    if(!x || typeof x!=='object')return x;
    const match=String(x.src||'').match(/^https?:\/\/(?:www\.)?archive\.org\/metadata\/([^/?#]+)/i);
    if(match && !x.needsResolve){
      let identifier=match[1];try{identifier=decodeURIComponent(identifier);}catch{}
      return {...x,identifier,needsResolve:true,resolveType:'archive',playable:x.playable!==false,
        pageUrl:x.pageUrl||'https://archive.org/details/'+encodeURIComponent(identifier),
        mediaStatus:x.mediaStatus||'Kontrola licence a mediálního souboru při přehrání',license:x.license||'Licence se ověří v metadatech'};
    }
    return x;
  };
  favorites=favorites.map(migrateSavedItem);
  history=history.map(migrateSavedItem);
  playlists=playlists.map(p=>({...p,items:(p.items||[]).map(migrateSavedItem)}));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = msg => { $('toast').textContent=msg; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2300); };
  const time = n => { if (!Number.isFinite(n)) return '0:00'; return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'); };
  const persistable = x => ({
    id:x.id,title:x.title,artist:x.artist,kind:x.kind,
    src:x.remote?x.src:null,art:x.art||'',remote:!!x.remote,source:x.source||'',
    pageUrl:x.pageUrl||'',license:x.license||'',licenseUrl:x.licenseUrl||'',
    mediaStatus:x.mediaStatus||'',isFull:x.isFull??null,playable:x.playable!==false,
    needsResolve:!!x.needsResolve,resolveType:x.resolveType||'',identifier:x.identifier||'',
    duration:Number.isFinite(Number(x.duration))?Number(x.duration):null,creatorUrl:x.creatorUrl||''
  });
  const isFav = x => favorites.some(f=>f.id===x.id);
  const httpUrl = value => { try { const raw=String(value||'').trim(); if(!raw)return ''; const u=new URL(raw); return /^https?:$/.test(u.protocol)?u.href:''; } catch { return ''; } };
  const httpsUrl = value => { const u=httpUrl(value); return u.startsWith('https://')?u:''; };
  const mimeFor = (kind,url,mimeHint='') => {
    if(mimeHint && String(mimeHint).includes('/')){const hinted=String(mimeHint).toLowerCase();if(hinted==='application/ogg')return kind==='video'?'video/ogg':'audio/ogg';if(hinted!=='application/octet-stream')return hinted;}
    let path='';try{path=new URL(String(url||'')).pathname.toLowerCase();}catch{}
    const ext=(path.match(/\.([a-z0-9]+)$/)||[])[1]||'';
    const map={mp3:'audio/mpeg',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg; codecs=opus',flac:'audio/flac',wav:'audio/wav',m4a:'audio/mp4',mp4:'video/mp4',m4v:'video/mp4',webm:kind==='video'?'video/webm':'audio/webm',ogv:'video/ogg'};
    return map[ext]|| (kind==='video'?'video/mp4':'audio/mpeg');
  };
  const browserCanPlay = (kind,url,mimeHint='') => {
    const element=kind==='video'?video:audio;
    try{return !!element.canPlayType(mimeFor(kind,url,mimeHint));}catch{return false;}
  };
  const plainText = value => {
    if(value==null)return '';
    const node=new DOMParser().parseFromString(String(value),'text/html');
    return (node.body.textContent||'').replace(/\s+/g,' ').trim();
  };
  const metaValue = (metadata,key) => plainText(metadata?.[key]?.value ?? metadata?.[key] ?? '');
  const formatDuration = seconds => Number.isFinite(Number(seconds))&&Number(seconds)>0 ? time(Number(seconds)) : '';
  const recognizedLicense = (licenseUrl,rights='') => /creativecommons\.org\/(?:licenses|publicdomain)\//i.test(String(licenseUrl||'')+' '+String(rights||'')) || /public\s+domain/i.test(String(rights||''));
  const licenseLabel = (licenseUrl,rights='') => {
    const raw=plainText(licenseUrl||rights);
    if(!raw)return 'Licence neuvedena';
    const cc=raw.match(/creativecommons\.org\/(?:licenses|publicdomain)\/[^\s<]+/i);
    return cc?cc[0].replace(/^https?:\/\//,''):raw.slice(0,100);
  };

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
    const artUrl=httpUrl(x.art);
    const art=artUrl?`<img class="result-art" src="${esc(artUrl)}" alt="" loading="lazy">`:`<div class="result-art">${x.kind==='video'?'▣':'♫'}</div>`;
    const canPlay=x.playable!==false && (!!x.src||!!x.needsResolve);
    const status=x.mediaStatus||(x.isFull===false?'Ukázka':x.isFull===true?'Celý soubor':'Soubor zdroje');
    const duration=formatDuration(x.duration);
    const details=[status,duration,x.license||'Licence neuvedena'].filter(Boolean).join(' · ');
    const page=httpUrl(x.pageUrl);const licensePage=httpUrl(x.licenseUrl);
    return `<div class="result-row">${art}<div class="result-info"><strong>${esc(x.title)}</strong><small>${esc(x.artist||'Neznámý autor')} · ${x.kind==='video'?'Video':'Hudba'}${x.source?' · '+esc(x.source):''}</small><small class="result-legal">${esc(details)}${licensePage?` · <a href="${esc(licensePage)}" target="_blank" rel="noopener noreferrer">Licence ↗</a>`:''}</small></div><div class="row-actions"><button data-play="${index}" title="${canPlay?'Přehrát':'Přehrávání není dostupné – otevři původní stránku'}" ${canPlay?'':'disabled'}>▶</button>${allowFav?`<button data-fav="${esc(x.id)}" title="Oblíbené">${isFav(x)?'♥':'♡'}</button>`:''}<button data-add="${esc(x.id)}" title="Přidat do playlistu">＋</button>${page?`<a class="source-link" href="${esc(page)}" target="_blank" rel="noopener noreferrer" title="Otevřít původní stránku" aria-label="Otevřít původní stránku">↗</a>`:''}</div></div>`;
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
    el.addEventListener('error',()=>{
      if(el!==activeMedia()||!currentItem||currentItem.kind!==(el===video?'video':'music'))return;
      $('toggle').checked=false;updatePlayButton();
      toast('Mediální soubor není dostupný nebo jej prohlížeč nepodporuje. Otevři původní stránku zdroje.');
    });
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
  $('searchForm').onsubmit=async e=>{
    e.preventDefault();
    const q=$('searchInput').value.trim();if(!q)return;
    const box=$('searchResults');box.innerHTML='';$('searchStatus').textContent='Vyhledávám souběžně ve více katalozích…';
    const tasks=searchType==='music'?
      [ ['Audius',()=>searchAudius(q)], ['Openverse',()=>searchOpenverseAudio(q)], ['Wikimedia Commons',()=>searchCommons(q,'music')], ['Internet Archive',()=>searchArchive(q,'music')], ['Apple iTunes',()=>searchITunes(q)] ]:
      [ ['Wikimedia Commons',()=>searchCommons(q,'video')], ['Internet Archive',()=>searchArchive(q,'video')], ['NASA',()=>searchNASA(q)] ];
    const settled=await Promise.allSettled(tasks.map(([,fn])=>fn()));
    const merged=[];const failed=[];
    settled.forEach((result,i)=>{if(result.status==='fulfilled')merged.push(...result.value);else{failed.push(tasks[i][0]);console.warn(`Zdroj ${tasks[i][0]} není dostupný:`,result.reason);}});
    const results=dedupeResults(merged);
    $('searchStatus').textContent=`Nalezeno ${results.length} výsledků · dostupné zdroje ${tasks.length-failed.length}/${tasks.length}${failed.length?' · nedostupné: '+failed.join(', '):''}`;
    if(!results.length&&failed.length===tasks.length)$('searchStatus').textContent='Žádný zdroj právě neodpovídá. Zkus to později nebo otevři dříve uložené položky.';
    else if(!results.length)$('searchStatus').textContent+=' · Zkus jiný hledaný výraz.';
    box.innerHTML=results.length?results.map((x,i)=>row(x,i)).join(''):'<div class="empty-state">Nic jsme nenašli. Zkus jiný výraz.</div>';
    bindRows(box,results);
  };

  async function fetchJson(url,timeout=16000){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
    try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}
    finally{clearTimeout(timer);}
  }
  function dedupeResults(list){
    const seen=new Set();const out=[];
    for(const x of list){
      const title=(x.title||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
      const artist=(x.artist||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
      const key=title&&artist?`${x.kind}|${title}|${artist}`:`${x.kind}|${x.pageUrl||x.src||x.id}`;
      if(seen.has(key))continue;seen.add(key);out.push(x);
    }
    return out;
  }
  async function searchAudius(q){
    const url='https://api.audius.co/v1/tracks/search?query='+encodeURIComponent(q)+'&limit=20&app_name=amp_music_video_player';
    const data=await fetchJson(url);
    return (data.data||[]).filter(t=>t.id && t.is_streamable!==false && t.is_available!==false && t.is_stream_gated!==true).map(t=>({
      id:'audius-'+t.id,title:t.title||'Bez názvu',artist:t.user?.name||t.user?.handle||'Audius creator',kind:'music',
      src:`https://api.audius.co/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=amp_music_video_player`,
      art:t.artwork?._480x480||t.artwork?.['480x480']||t.artwork?._150x150||t.artwork?.['150x150']||'',remote:true,source:'Audius',pageUrl:t.permalink||'https://audius.co',
      license:typeof t.license==='string'?(t.license||'Licence neuvedena'):(t.license?.name||t.license?.license_type||'Licence neuvedena · práva dle nastavení autora'),
      licenseUrl:typeof t.license==='string'&&/^https?:\/\//i.test(t.license)?t.license:(httpUrl(t.license?.url)||''),duration:t.duration,isFull:true,mediaStatus:'Celá streamovatelná skladba',playable:browserCanPlay('music','https://media.audius.co/stream.mp3','audio/mpeg')
    }));
  }
  async function searchOpenverseAudio(q){
    const url='https://api.openverse.org/v1/audio/?q='+encodeURIComponent(q)+'&category=music&length=medium,long&page_size=20';
    const data=await fetchJson(url);
    return (data.results||[]).filter(x=>httpsUrl(x.url)).map(x=>({
      id:'openverse-'+x.id,title:x.title||'Bez názvu',artist:x.creator||'Neznámý autor',kind:'music',src:httpsUrl(x.url),
      art:x.thumbnail||'',remote:true,source:'Openverse'+(x.provider?' · '+x.provider:''),pageUrl:x.foreign_landing_url||x.detail_url||'https://openverse.org/',
      license:[x.license,x.license_version].filter(Boolean).join(' ')||'Licence neuvedena',licenseUrl:x.license_url||'',duration:Number(x.duration)>0?Number(x.duration)/1000:null,
      isFull:true,mediaStatus:'Soubor zdroje (nikoli katalogová ukázka)',playable:!!x.license&&browserCanPlay('music',x.url,x.filetype)
    }));
  }
  async function searchCommons(q,kind){
    const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'20',prop:'imageinfo',iiprop:'url|extmetadata|mime|mediatype|commonmetadata',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription',iiurlwidth:'240',format:'json',origin:'*'});
    const data=await fetchJson('https://commons.wikimedia.org/w/api.php?'+params.toString());
    const pages=Object.values(data.query?.pages||{});const allowed=kind==='music'?/\.(mp3|ogg|oga|opus|flac|wav|m4a)$/i:/\.(mp4|webm|ogv|m4v)$/i;
    return pages.flatMap(page=>{
      const info=page.imageinfo?.[0];if(!info?.url)return[];
      const file=page.title||'';const mime=(info.mime||'').toLowerCase();
      const isAudio=mime.startsWith('audio/')||/\.(mp3|ogg|oga|opus|flac|wav|m4a)$/i.test(file);
      const isVideo=mime.startsWith('video/')||/\.(mp4|webm|ogv|m4v)$/i.test(file);
      if((kind==='music'&&!isAudio)||(kind==='video'&&!isVideo)||!allowed.test(file))return[];
      const ex=info.extmetadata||{};const lic=metaValue(ex,'LicenseShortName');const licUrl=metaValue(ex,'LicenseUrl');
      const artist=metaValue(ex,'Artist')||metaValue(ex,'Credit')||'Autor neuveden';
      const description=metaValue(ex,'ImageDescription');
      const title=file.replace(/^File:/,'').replace(/\.[^.]+$/,'').replace(/_/g,' ');
      const duration=Number(info.duration)||null;
      return [{id:'commons-'+page.pageid,title:description&&description.length<140?description:title,artist,kind,src:httpsUrl(info.url),art:info.thumburl||'',remote:true,
        source:'Wikimedia Commons',pageUrl:info.descriptionurl||`https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        license:lic||'Licence neuvedena',licenseUrl:licUrl,duration,isFull:true,mediaStatus:'Celý soubor Commons',playable:!!lic&&!!licUrl&&!!httpsUrl(info.url)&&browserCanPlay(kind,info.url,mime)}];
    });
  }
  async function searchArchive(q,kind){
    const mediaType=kind==='music'?'audio':'movies';
    const fields='identifier,title,creator,year,licenseurl,rights';
    const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent('('+q+') AND mediatype:'+mediaType)+'&'+fields.split(',').map(f=>'fl[]='+encodeURIComponent(f)).join('&')+'&rows=22&page=1&output=json';
    const data=await fetchJson(url);const docs=data.response?.docs||[];
    return docs.map(d=>{
      const licenseUrl=d.licenseurl||'';const rights=plainText(d.rights||'');const known=recognizedLicense(licenseUrl,rights);
      return {id:'ia-'+d.identifier,title:d.title||d.identifier,artist:[d.creator,d.year].filter(Boolean).join(' · ')||'Neznámý autor',kind,
        src:'https://archive.org/metadata/'+encodeURIComponent(d.identifier),art:'https://archive.org/services/img/'+encodeURIComponent(d.identifier),remote:true,
        source:'Internet Archive',pageUrl:'https://archive.org/details/'+encodeURIComponent(d.identifier),license:licenseLabel(licenseUrl,rights),licenseUrl,
        identifier:d.identifier,needsResolve:known,resolveType:'archive',duration:null,isFull:known,mediaStatus:known?'Celé médium (ověří se soubor)':'Pouze původní stránka – licence není uvedena',playable:known};
    });
  }
  async function searchITunes(q){
    const url='https://itunes.apple.com/search?term='+encodeURIComponent(q)+'&media=music&entity=song&limit=20';
    const data=await fetchJson(url);
    return (data.results||[]).filter(x=>x.previewUrl).map(x=>({id:'itunes-'+x.trackId,title:x.trackName,artist:x.artistName,kind:'music',src:x.previewUrl,art:x.artworkUrl100,remote:true,
      source:'Apple iTunes',pageUrl:x.trackViewUrl||'https://music.apple.com/',license:'Apple preview · pouze krátká ukázka',licenseUrl:'https://www.apple.com/legal/internet-services/itunes/',
      duration:null,isFull:false,mediaStatus:'Ukázka, nikoli celá skladba',playable:browserCanPlay('music',x.previewUrl,'audio/mpeg')}));
  }
  async function searchNASA(q){
    const url='https://images-api.nasa.gov/search?q='+encodeURIComponent(q)+'&media_type=video&page_size=18';
    const data=await fetchJson(url);
    return (data.collection?.items||[]).flatMap(item=>{
      const d=item.data?.[0];if(!d?.nasa_id)return[];
      const credits=[d.photographer,d.secondary_creator].filter(Boolean).join(' · ');
      const description=plainText(d.description||'');
      const thirdParty=/©|copyrighted|all rights reserved|courtesy of [A-Z]/i.test(credits+' '+description);
      const thumb=item.links?.find(l=>l.rel==='preview')?.href||item.links?.[0]?.href||'';
      return [{id:'nasa-'+d.nasa_id,title:d.title||d.nasa_id,artist:credits||d.center||'NASA',kind:'video',
        src:'https://images-api.nasa.gov/asset/'+encodeURIComponent(d.nasa_id),art:thumb,remote:true,source:'NASA Image and Video Library',
        pageUrl:'https://images.nasa.gov/details/'+encodeURIComponent(d.nasa_id),license:'NASA Media Usage Guidelines · uvést NASA; mohou existovat výjimky třetích stran',
        licenseUrl:'https://www.nasa.gov/nasa-brand-center/images-and-media/',duration:null,isFull:true,
        mediaStatus:thirdParty?'Práva třetí strany – pouze stránka NASA':'Celý video soubor NASA',playable:!thirdParty&&browserCanPlay('video','https://media.nasa.gov/asset.mp4','video/mp4'),needsResolve:!thirdParty&&browserCanPlay('video','https://media.nasa.gov/asset.mp4','video/mp4'),resolveType:'nasa'}];
    });
  }
  // Rozlišení přímého souboru probíhá až po stisku Play, aby vyhledávání zůstalo rychlé.
  const originalPlay=play;
  function pickArchiveFile(files,kind){
    const ext=kind==='music'?/\.(mp3|ogg|oga|opus|m4a|wav|flac)$/i:/\.(mp4|webm|ogv|m4v)$/i;
    const valid=(files||[]).filter(f=>f.name&&ext.test(f.name)&&Number(f.size||0)>0&&!/(sample|preview|thumbnail|thumb|torrent|spectrogram)/i.test(f.name)&&browserCanPlay(kind,'https://archive.org/download/file/'+encodeURIComponent(f.name)));
    const preference=kind==='music'?['.mp3','.ogg','.oga','.opus','.m4a','.wav','.flac']:['.mp4','.webm','.ogv','.m4v'];
    valid.sort((a,b)=>{
      const ea=preference.findIndex(e=>a.name.toLowerCase().endsWith(e));const eb=preference.findIndex(e=>b.name.toLowerCase().endsWith(e));
      if(ea!==eb)return ea-eb;
      const oa=a.source==='original'?1:0,ob=b.source==='original'?1:0;if(oa!==ob)return ob-oa;
      return Number(b.size||0)-Number(a.size||0);
    });
    return valid[0]||null;
  }
  play=async function(x,list=items){
    if(!x)return;
    if(x.playable===false){toast('Přehrávání je vypnuté, protože licence nebo práva nejsou doložena. Otevři původní stránku.');return;}
    if(x.needsResolve){
      try{
        toast('Načítám mediální soubor…');
        if(x.resolveType==='archive'){
          const meta=await fetchJson(x.src);const md=meta.metadata||{};
          if(!recognizedLicense(md.licenseurl||x.licenseUrl,md.rights||''))throw Error('License is not declared');
          const f=pickArchiveFile(meta.files,x.kind);if(!f)throw Error('No compatible media file');
          x.src='https://archive.org/download/'+encodeURIComponent(x.identifier)+'/'+String(f.name).split('/').map(encodeURIComponent).join('/');
        } else if(x.resolveType==='nasa'){
          const assets=await fetchJson(x.src);
          const entries=Array.isArray(assets)?assets:(assets.collection?.items||[]);
          const files=entries.map(entry=>typeof entry==='string'?entry:entry?.href).filter(Boolean);
          const candidates=files.filter(u=>/\.mp4(?:$|\?)/i.test(u));
          const file=candidates.find(u=>/orig/i.test(u))||candidates[0];if(!file||!httpsUrl(file))throw Error('No MP4 asset');
          x.src=httpsUrl(file);
        } else throw Error('Unknown resolver');
        x.needsResolve=false;originalPlay(x,list);
      }catch(err){console.warn('Media resolution failed:',err);toast('Původní soubor se nepodařilo bezpečně načíst nebo není přehratelný. Otevři stránku zdroje.');}
      return;
    }
    originalPlay(x,list);
  };

  renderPlaylists();renderHome();renderLibrary();updatePlayButton();
})();