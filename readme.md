Ulozto.cz synology download station plugin
==========

This plugin allows you to search and download movies from ulozto.cz file sharing service directly from download station.

![](search.jpg)

![](download.jpg)

###### Requirements:
  - **nodejs** (can be downloaded in Synology Package Center)
  - request nodejs package "npm install request" (installed by ulozto.spk)

###### Installation:
  - Download Station -> Settings -> Searching BT -> Add service -> **ulozto.dlm**
  - Download Station -> Settings -> File hosting -> Add service -> **ulozto.host**
  - Package Center -> Settings -> Allow installation of package published by: "Any publisher"
  - Package Center -> Manual Install -> Browse -> **ulozto.spk**
  - Verify whether service is running by opening http://diskstation:8034/ in your web browser

###### Features:
  - single click download
  - automatic captcha cracking
  - unlimited parallel downloads
  - rating score is displayed as number of peers by this equation "PEERS = 100 + rating*10". Rating 0 shows 100 peers, rating 1 as 110 peers ... rating 10 as 200 peers. Rating -1 as 90 peers, rating -5 as 50 peers...  
  - automatic classification of download type depending on file extension

###### Todo list:
  - Rewrite captcha cracker into PHP, so nodejs service won't be necessary anymore


Stahovací plugin ulozto.cz pro Synology DiskStation
==========

###### Instalace search a host pluginu:
  1. Pluginy pro Download Station tvoří dva subory - *[ulozto.dlm](ulozto.dlm?raw=true)* (9392B) a *[ulozto.host](ulozto.host?raw=true)* (817B). Stahněte si je, následně je nanstalujeme v nastavení Download Station.
  2. DLM plugin nainstalujte v *Nastavení/Hledani -> BT/Přidat*.
  3. Host plugin nainstalujte v *Nastavení/Hostování -> suborů/Přidat*.
  4. Skontrolovat zda jsou správně stažené se dá i tak, že je skusíte otevřít například WinRarem. Uvnítř je jeden subor "ulozto" a když stisknete alt+v měl by vám ukázat zdrojové kódy. Další možnost je, změnít souborům příponu na ".tgz" a pak je otevřít jako archív.

###### Instalace služby pro Ulozto:
  1. V "Centrum balíčků" nainstalujte balíček "Node.js v4".
  2. Balíček pro instalaci *[ulozto.spk](ulozto.spk?raw=true)* (46805B) zatím není podepsaný pomocí GPG a proto je třeba v nastavení "Centrum balíčků" povolit instalaci pro "Jakýkoli vydavatel".
  3. Nainstalujeme v "Centrum balíčků" pomocí tlačítka "Ruční instalace". Najdeme soubor *ulozto.spk* a nainstalujeme.
  4. Po instalaci skontrolujte, zda proběhla úspěšně a v "Centrum balíčků" je u balíčku napsáno zeleně "Spuštěno". Případně můžete ověřit, že služba běží navštívením http://diskstation:8034/.


Mozne problemy:
  - Nemožnost přidat vyhladávací plugin do Download Station - Pokud je subor ulozto.dlm, nebo ulozto.host nesprávně stažený, nebo poškozený, Download Station ho odmietne nainstalovat.
  - Pokud Download Station stahuje podezžele malé, cca 40 až 70 kilobajtove subory, znamená to že neběží služba. V "Centrum balíčků" skontroluj, zda běží. Log soubor je k nahlédnutí také tam.

Contributors:
  - [Gabriel Valky](https://github.com/gabonator) (gabonator)
  - [Miloš Svašek](https://github.com/svasek) (svasek)
  - [Meenya](https://github.com/meenya)
