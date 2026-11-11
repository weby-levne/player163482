# & — Music & Video Player

Responzivní webová aplikace pro lokální hudbu a videa a vyhledávání legálně dostupných online ukázek.

## Spuštění a publikování

1. Rozbal ZIP do samostatné složky.
2. Otevři `index.html` v moderním prohlížeči, případně spusť lokální server (např. VS Code Live Server).
3. Pro GitHub Pages nahraj všechny čtyři soubory do kořenové složky repozitáře.
4. V GitHubu otevři **Settings → Pages**, zvol **Deploy from a branch**, vyber větev `main` a složku `/ (root)` a ulož.
5. Po dokončení nasazení otevři adresu GitHub Pages.

Aplikace nepoužívá server ani build krok. Online vyhledávání vyžaduje internetové připojení.

## Funkce

- Lokální přehrávání audio a video souborů vybraných ze zařízení.
- Online vyhledávání hudebních ukázek přes iTunes Search API.
- Vyhledávání video záznamů v Internet Archive a načtení dostupného mediálního souboru.
- Playlisty, oblíbené položky a historie přehrávání.
- Ukládání playlistů, oblíbených položek, historie a vzhledu v `localStorage`.
- Přehrávání/pozastavení přes originální Uiverse přepínač MuhammadHasann.
- Přepínání světlého/tmavého režimu přes originální Uiverse přepínač JustCode14.
- Posuvník pozice, hlasitost, předchozí/další položka a fullscreen pro video (podle podpory prohlížeče).
- Responzivní rozložení pro desktop a mobil.

## Ovládání

- **Play/Pause:** přepínač ve spodním přehrávači. Červená poloha znamená přehrávání.
- **Day/Night:** modrá poloha s oblakem znamená světlý režim; tmavá poloha s hvězdami znamená tmavý režim.
- **Přidat soubory:** vyber audio nebo video soubory ze zařízení.
- **Vyhledávání:** přepni mezi Hudbou a Videi, zadej dotaz a spusť hledání.
- **Fullscreen:** tlačítko ⛶ funguje, pokud je právě aktivní video a prohlížeč fullscreen podporuje.

## Použité zdroje a omezení

- **iTunes Search API:** poskytuje krátké hudební náhledy, nikoli plné skladby. Dostupnost náhledu určuje Apple.
- **Internet Archive:** katalog může obsahovat záznamy bez vhodného přehratelného souboru; takový záznam aplikace nepřehraje.
- **Lokální soubory:** prohlížeč je přehrává přes dočasné object URL. Z bezpečnostních důvodů je nelze automaticky obnovit po zavření nebo obnovení stránky, takže je nutné je znovu vybrat.
- **Ukládání:** playlisty, oblíbené položky, historie a vzhled se ukládají v `localStorage` konkrétního prohlížeče a zařízení. Samotné lokální audio/video soubory se do úložiště nekopírují.
- Aplikace neobchází DRM, placené služby ani omezení platforem. Přehrávej pouze obsah, ke kterému máš oprávnění.
- Google Fonts se načítají z externí služby; při nedostupnosti internetu se použijí systémové fonty.

## Původní přepínače Uiverse.io

- Play/Pause Toggle — MuhammadHasann: https://uiverse.io/ (komponenta vložena s původními třídami a animacemi).
- Day/Night Shift Button — JustCode14: https://uiverse.io/ (komponenta vložena s původní strukturou, hvězdami, mrakem a SVG).

Původní HTML/CSS struktura a animační pravidla obou komponent jsou zachována; upraveno je pouze měřítko/umístění v rámci aplikace a jejich propojení s funkcemi přehrávače a tématu.

## Soubory

- `index.html` — struktura aplikace.
- `style.css` — vzhled, původní styly přepínačů a responzivní rozložení.
- `app.js` — přehrávač, vyhledávání, playlisty, oblíbené položky, historie a ukládání.
- `README.md` — tento návod.

### Oprava Play/Pause přepínače
Originální přepínač Uiverse od MuhammadHasann zůstává zachovaný. Opravené rozměry obalu zahrnují vnitřní odsazení, checkbox je přístupný klávesnici a stav se synchronizuje se skutečným přehráváním audia i videa.


### Kompaktnější Play/Pause
Přepínač si zachovává šířku 112 px, ale jeho výška je zmenšena na 52 px. Vnitřní kruh a jeho posun jsou přepočítány tak, aby zůstala zachována animace i funkce.


### Finální mobilní velikost Play/Pause
Na telefonech se přepínač zobrazuje v měřítku 60 % (přibližně 67 × 31 px), přičemž jeho rozložení ponechává rezervu pro animovaný posun kruhu. Na větších obrazovkách zůstává běžná velikost.


### Obnovení souborů v prohlížeči
Odkazy na CSS a JavaScript obsahují verzi v URL (`?v=20261111-2`). Při další aktualizaci vzhledu změň tuto hodnotu, aby prohlížeč stáhl nové soubory místo použití staré cache.
