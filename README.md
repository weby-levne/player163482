# & — Music & Video Player

Responzivní webová aplikace pro přehrávání vlastních audio/video souborů a vyhledávání veřejně dostupných médií z otevřených katalogů. Aplikace je bez reklam, bez placených funkcí a bez vlastního serveru.

## Spuštění

1. Rozbal všechny soubory do jedné složky.
2. Otevři `index.html` v moderním prohlížeči. Pro lokální vývoj je vhodnější jednoduchý HTTP server (například rozšíření Live Server ve VS Code).
3. Pro lokální soubory vyber **Přidat soubory**. Online vyhledávání vyžaduje připojení k internetu.

## Nasazení na GitHub Pages

1. Nahraj `index.html`, `style.css`, `app.js` a `README.md` do kořenové složky repozitáře.
2. Otevři v GitHubu **Settings → Pages**.
3. V části Build and deployment nastav **Deploy from a branch**, vyber větev `main` a složku `/ (root)`.
4. Ulož nastavení a otevři adresu GitHub Pages zobrazenou v nastavení repozitáře.
5. Při každé další změně CSS nebo JavaScriptu zvyš verzi parametrů `?v=` v `index.html`, aby prohlížeče nepoužívaly starou cache.

Projekt nemá build krok, backend ani tajné klíče. Všechna API volání probíhají přímo z prohlížeče uživatele.

## Funkce

- Lokální přehrávání hudby a videí pomocí HTML5 `<audio>` a `<video>`.
- Jednotné vyhledávání více zdrojů současně; výsledky se rozdělují na **Hudbu** a **Videa**.
- Výpadek jednoho katalogu neblokuje ostatní katalogy (`Promise.allSettled`). Neúspěšné zdroje se vypíší ve stavové zprávě.
- Každý výsledek uvádí název, autora, zdroj, dostupný údaj o licenci, typ média a odkaz na původní stránku. Licence má také vlastní odkaz, pokud jej API poskytlo.
- Položky bez doložené licence v Internet Archive a Wikimedia Commons nelze přímo přehrát; je dostupná jejich původní stránka.
- Oblíbené položky, playlisty, historie a vzhled se ukládají do `localStorage`.
- Přehrávání/pozastavení přes původní Uiverse přepínač MuhammadHasann.
- Světlý/tmavý režim přes původní Uiverse přepínač JustCode14.
- Spodní přehrávač: předchozí/další položka, posuvník, hlasitost a fullscreen videa (dle podpory prohlížeče).
- Responzivní rozložení pro desktop a mobil.

## Použité online zdroje

### Hudba

| Zdroj | API / přístup | Typ dostupného média | Licence a omezení |
|---|---|---|---|
| **Audius** | `https://api.audius.co/v1/tracks/search` — veřejné read-only API bez klíče | Streamovací MP3 celé skladby přes `/tracks/{id}/stream` | API vyřazuje skladby označené jako nedostupné nebo stream-gated. Autor může omezit přístup přes API. Zobrazená licence pochází z metadat skladby, pokud ji autor uvedl; jinak je označena jako neuvedená. Streamovatelnost sama o sobě není univerzální Creative Commons licence. |
| **Openverse Audio** | `https://api.openverse.org/v1/audio/` — anonymní požadavky bez klíče; platí limity a stránkovací omezení | Přímá adresa zvukového souboru od původního poskytovatele; nejde o katalogový preview endpoint | U výsledku se zobrazí licenční kód/verze a odkaz, pokud je API poskytne. Openverse výslovně negarantuje správnost licenčních údajů třetích stran; před dalším použitím ověř původní stránku. |
| **Wikimedia Commons** | `https://commons.wikimedia.org/w/api.php` — veřejné Action API s `origin=*` | Přímé podporované soubory, například MP3, OGG, FLAC, WAV nebo M4A | Použije se strojově dostupná licence z metadat souboru. Přehrávání je povoleno jen tehdy, pokud jsou k dispozici údaje o licenci i její URL. Respektuj atribuci autora a konkrétní licenční podmínky. |
| **Internet Archive** | `https://archive.org/advancedsearch.php` + `https://archive.org/metadata/{identifier}` | Při přehrání se vybere kompatibilní soubor MP3/OGG/M4A/WAV/FLAC | Přímé přehrávání je povoleno jen tehdy, když metadata uvádějí rozpoznatelnou Creative Commons licenci nebo Public Domain. Jde o licenci deklarovanou nahrávajícím; Internet Archive negarantuje správnost právních údajů. Bez doložené licence se nabídne pouze původní stránka. |
| **Apple iTunes Search** | `https://itunes.apple.com/search` — veřejné vyhledávání | Pouze krátká ukázka přes `previewUrl`, nikoli celá skladba | Výsledek je v aplikaci výslovně označen jako ukázka. Odkaz vede na stránku skladby v Apple Music/iTunes. |

### Videa

| Zdroj | API / přístup | Typ dostupného média | Licence a omezení |
|---|---|---|---|
| **Wikimedia Commons** | `https://commons.wikimedia.org/w/api.php` | Přímé soubory MP4, WebM, OGV nebo M4V, pokud je prohlížeč podporuje | Stejné licenční pravidlo jako u hudby: nutná strojově dostupná licence a odkaz na ni. |
| **Internet Archive** | Advanced Search + metadata API | Při přehrání se vybere kompatibilní video soubor MP4/WebM/OGV/M4V | Přímé přehrávání jen u záznamů s deklarovanou CC/PD licencí. Údaj o právech poskytuje nahrávající a nemusí být ověřen. |
| **NASA Image and Video Library** | `https://images-api.nasa.gov/search` + `/asset/{nasa_id}` — bez API klíče | Video asset ve formátu MP4, pokud je dostupný | NASA média jsou obecně použitelná podle NASA Media Usage Guidelines a NASA má být uvedena jako zdroj. Mohou se objevit materiály třetích stran, které NASA pouze používá; ty vyžadují samostatné oprávnění. Když metadata naznačují copyright třetí strany, přímé přehrávání je vypnuté. |

### Záměrně nezařazené katalogy

- **Free Music Archive:** jeho oficiální informace pro vývojáře uvádějí, že API bylo vypnuto; přímé přehrávání/hotlinkování souborů z jejich serverů a automatické získávání výsledků z webového vyhledávání není povoleno bez souhlasu.
- **Jamendo:** API vyžaduje registrovaný developer účet a `client_id`. Testovací identifikátor není určen pro produkční aplikaci; proto není natvrdo vložen do veřejného JavaScriptu.
- **Musopen:** nebylo ověřeno oficiální veřejné vyhledávací API bez klíče. Samotný katalog upozorňuje, že právní stav jednotlivých nahrávek nemusí být ověřen.
- **Free To Use:** jeho veřejné API sice nevyžaduje klíč, ale bezplatná licence zakazuje použití hudby v digitálních produktech včetně webových aplikací. Bez odpovídající placené licence se proto nepoužívá.

## Důležité rozdíly mezi celou nahrávkou a ukázkou

- **Audius:** API endpoint vrací streamovatelné MP3 skladby; výsledek se označuje jako celá streamovatelná skladba.
- **Openverse:** vyhledávání je omezeno na kategorii `music` a délku `medium` nebo `long`; aplikace přehrává přímo soubor od poskytovatele, nikoli katalogový preview endpoint. Délka souboru ale může být sama o sobě kratší než běžná skladba.
- **Wikimedia Commons:** aplikace přehrává přímo celý soubor od poskytovatele; záznam může být i krátká nahrávka.
- **Internet Archive:** aplikace vybere dostupný soubor z metadat; záznam může být album, samostatná nahrávka nebo delší audio/video celek. Skutečný soubor se zjišťuje až po stisknutí Play.
- **NASA:** aplikace vybírá MP4 asset z manifestu; přehrávání závisí na dostupnosti a kompatibilitě souboru.
- **iTunes:** vždy pouze ukázka. Aplikace ji nijak nevydává za celou skladbu.

`Celý soubor` znamená celý soubor vrácený zdrojem, ne právní potvrzení, že jde o kompletní studiovou skladbu nebo že lze nahrávku dále redistribuovat.

## Autorská práva a odpovědnost

Aplikace neobchází DRM, paywally, přihlášení ani technická omezení platforem. Přehrávání je určeno pro soubory, k nimž poskytovatel nabízí přímý přístup. Uživatel musí respektovat podmínky konkrétní licence, uvést autora a zdroj, pokud je to vyžadováno, a před dalším užitím si ověřit práva na původní stránce. Samotná dostupnost souboru zdarma neznamená, že je volně použitelný.

## Ukládání a soukromí

- Playlisty, oblíbené položky, historie a nastavení se ukládají lokálně v `localStorage` daného prohlížeče.
- URL, názvy a licenční údaje vzdálených položek se ukládají kvůli playlistům a historii; mediální soubory se nekopírují do aplikace.
- Lokální soubory jsou přehrávány přes dočasné `blob:` URL a po obnovení stránky je nutné je znovu vybrat.
- Vyhledávací dotazy se posílají přímo příslušným API poskytovatelům.

## Testování a známá omezení

- JavaScript prošel kontrolou syntaxe `node --check app.js`.
- Staticky byly ověřeny identifikátory HTML, odkazy na prvky z JavaScriptu, vyvážení závorek CSS a cache parametry v `index.html`.
- HTML struktura a vazby prvků jsou kontrolovány samostatnou statickou kontrolou projektu.
- Živé požadavky na externí API nebylo možné v prostředí přípravy ZIPu ověřit: odchozí DNS přístup z tohoto prostředí nebyl dostupný. Funkčnost jednotlivých API a CORS proto musí být potvrzena také po nasazení v běžném prohlížeči.
- Nebyl proveden plnohodnotný vizuální test v desktopovém a mobilním prohlížeči. Nové CSS se týká pouze řádků výsledků; rozměry a animace původního Play/Pause přepínače nebyly měněny.
- Externí soubor může být odstraněn, dočasně nedostupný nebo mít formát nepodporovaný prohlížečem. V takovém případě použij odkaz na původní stránku.
- Veřejná API mají vlastní limity, pravidla a dostupnost. Pokud některý zdroj vrátí chybu, ostatní vyhledávání pokračují.

## Soubory projektu

- `index.html` — struktura aplikace a cache verze assetů.
- `style.css` — vzhled, responzivní rozložení a původní styly Uiverse přepínačů.
- `app.js` — přehrávání, vyhledávání zdrojů, metadata, playlisty, oblíbené položky a historie.
- `README.md` — dokumentace a nasazení.

## Původní Uiverse přepínače

- Play/Pause Toggle — MuhammadHasann.
- Day/Night Shift Button — JustCode14.

Původní HTML struktura, animace a funkční napojení přepínačů jsou zachovány. Cache parametr v `index.html` je nyní `20261111-3`.
