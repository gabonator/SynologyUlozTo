Ulozto.cz synology download station plugin
==========

This plugin allows you to search and download movies from ulozto.cz file sharing service directly from download station.

![](search.jpg)

![](download.jpg)

Requirements:
  - nodejs (can be downloaded in Synology Package Center)

Installation:
  - Download Station -> Settings -> Searching BT -> Add service -> ulozto.dlm
  - Download Station -> Settings -> File hosting -> Add service -> ulozto.host
  - Package center -> Settings -> Trust any publisher
  - Package center -> Manual installation -> ulozto.spk
  - Verify whether service is running by opening http://192.168.1.XXX:8034/ in your web browser

Features:
  - single click download
  - automatic captcha cracking
  - unlimited parallel downloads
  - rating score is displayed as number of peers by this equation "PEERS = 100 + rating*10". Rating 0 shows 100 peers, rating 1 as 110 peers ... rating 10 as 200 peers. Rating -1 as 90 peers, rating -5 as 50 peers...  
  - automatic classification of download type depending on file extension

Todo list:
  - Rewrite captcha cracker into PHP, so nodejs service won't be necessary anymore


Stahovaci plugin ulozto.cz pre synology diskstation
==========

  1. **Instalacia search a host pluginu:** Pluginy pre download station tvoria dva subory - *ulozto.dlm* a *ulozto.host*. Instalujeme ich cez nastavenia v download statione - dlm plugin ulozime cez *nastavenia/hledani bt/pridat* a host plugin cez *nastavenia/hostovanie suborov/pridat*. Dolezite je tieto pluginy spravne stiahnut z githubu. Treba kliknut na ulozto.dlm a potom stiahnut kliknutim na tlacitko "raw", velkost suboru by mala byt 9.31kB a ulozto.host by mal mat 817 bajtov. Skontrolovat ci su spravne stiahnute sa da aj tak, ze ich skusis otvorit s WinRarom. Vovnutri je jeden subor "ulozto" a ked stlacis alt+v mal by ti ukazat konkretne zdrojove kody
  2. **Instalacia servisu:** Stahovaci servis potrebuje pre svoju pracu nainstalovany balicek *Nodejs*. V Centre balickov dame vyhladat *nodejs* a nainstalujeme najnovsiu verziu. V centre balickov klikneme na nastavenia a pre *Uroven doveryhodnosti* zvolime *Akykolvek vydavatel*. Nastavenia zatvorime a klikneme na *Rucna instalacia*, vyberieme subor *ulozto.spk* a pockame na dokoncenie instalacie
  3. **Otestovanie skriptu:** Otvor si http://diskstation:8034, mala by sa zobrazit jednoducha stranka s jedinym editboxom. Skus do neho nieco zapisat (napr. "film") aby si overil funkcnost servisu. Ak sa stranka neda zobrazit, mame problem.

Mozne problemy:
  - Nemoznost pridat vyhladavaci plugin do download station - ak je subor ulozto.dlm alebo ulozto.host zle stiahnuty, download station ho odmietne nainstalovat. Skontroluj podla bodu 1
  - Ak download station stahuje podozrivo male, cca 40 kilobajtove subory, znamena to ze nebezi servis a stahujeme iba web stranku. Skontroluj podla bodu 3
  - V pripade problemov vyhladaj Ulozto Service v Centre Balickov, klikni na *Zobrazit protokoly* a posli nam ich aj s popisom problemu

Contributors:
  - Gabriel Valky (gabonator)
  - Milos Svasek (svasek) 
  - Meenya

