# Okey 101 — Canonical Kural Referansı

> Bu dosya, Okey 101 kurallarının **tek doğruluk kaynağıdır**. 1a/1b/1c spec'leri
> buradan beslenir. Yeni karar verildikçe güncellenir.
>
> **Önemli:** Okey 101'in bölgesel / "ev kuralı" varyasyonları vardır. Aşağıda
> **(KESİN)** = kaynaklar arası konsensüs + onaylanmış; **(KARARLAŞTIRILDI)** = oyuncu
> (sen) bu sürüm için kararını verdi, ilgili aşamada doğrulanacak; **(EV KURALI — ONAY
> BEKLİYOR)** = web kaynakları çelişiyor ya da varyanta bağlı, hâlâ netleştirilmesi
> gereken noktalar. İkinci/üçüncüleri 1b/1c brainstorm'unda kilitleyip (KESİN)'e taşıyacağız.
>
> Araştırma kaynakları dosyanın en altında.

## Taşlar ve kurulum (KESİN)

- **106 taş:** 4 renk (`red` kırmızı, `yellow` sarı, `black` siyah, `blue` mavi)
  × 1–13 × **2 kopya** = 104 sayılı taş, + **2 sahte okey** (fake joker) = 106.
- **4 oyuncu.**
- **Dağıtım:** Gösterge taşı belirlenir; oyunculara **21'er** taş, **başlayan
  oyuncuya 22**. Kalan ~**20** taş çekme destesi olur. (Toplam: 22+21+21+21 + 1 gösterge
  + 20 deste = 106.)
- **Gösterge** her zaman **sayılı bir taştır** (sahte okey gösterge olamaz; gelirse
  atlanır/yeniden çekilir).
- **Oyun yönü:** Başlayan (22 taşlı) oyuncudan başlar. Yön (saat yönü / tersi)
  uygulamada sabit bir kurguyla tutulur — 1a'da `startingPlayerIndex=0`, yön 1b'de.

## Okey ve wildcard (KESİN)

- **Okey** = göstergenin **bir üstü, aynı renk** (gösterge kırmızı 5 → okey kırmızı 6).
  Gösterge 13 ise okey 1 (aynı renk).
- **Wildcard (joker) = 4 taş:** 2 sahte okey **+** okey değerindeki 2 gerçek taş.
- Bir wildcard, perde herhangi bir taşın yerine geçebilir; **puanı, temsil ettiği
  taşın değeridir**.

## Tur akışı (KESİN — çekirdek mekanik, detay 1b)

- Sıra gelen oyuncu **1 taş çeker** (kapalı desteden **veya** solundaki oyuncunun
  son attığı taşı yerden), sonra elinden **1 taş atar**. El bu döngüyle ilerler.
- **Çekme/atma sırası**, gösterge açma, "alttan/üstten işleme" gibi detaylar 1b'de.

## Per (meld) kuralları (KESİN — 1a)

- **Seri (run):** aynı renk, **ardışık** sayılar, **≥3 taş**, aynı sayı tekrarı yok.
  **1 yalnızca en altta** (`1-2-3` geçerli); **sarma yok** (`12-13-1`, `11-12-13-1`,
  `13-1-2` hepsi **geçersiz**; 13↔1 bağlantısı yok).
- **Grup (set):** aynı sayı, **farklı renkler**, **3–4 taş** (en fazla 4, çünkü 4 renk).
- Bir per **en az 1 doğal (joker olmayan) taş** içermeli — tamamı wildcard olamaz.
- Wildcard, seride boşluğu/uçları, grupta eksik rengi doldurur (1..13 dışına /
  sarmaya çıkamaz).

## Çift (pairs) kuralları (KESİN — 1a kısmı)

- **Çift** = aynı **renk + sayı** iki taş (örn. kırmızı 7 + kırmızı 7).
- **Wildcard çiftte herhangi bir taşla eşleşir** (4 wildcard'ın hepsi: 2 sahte okey +
  okey değerindeki 2 taş). İki wildcard da çift sayılır.
- **Çift açış: en az 5 çift** (`minPairs=5`). Katlamasız'da sabit 5; **katlamalı'da
  artar** (önceki oyuncu 5 açtıysa sonraki ≥6, 6 açıldıysa ≥7 ...) — eskalasyon 1b'de,
  primitif `minPairs` parametreli.
- **Mod kilidi (KESİN):** Bir oyuncu çiftle açtıysa o el **normal per açamaz**; per
  açtıysa çift açamaz. Sonradan mod değiştiremez.
- **Çifte giden taş alamaz (KESİN):** Çifte giden oyuncu **yerden / rakip taşını
  alamaz**, yalnız kapalı desteden kendi çektiğiyle ilerler.
- **Masada en fazla 3 oyuncu çifte gidebilir (KESİN):** 4 oyuncunun **dördü de**
  çifte giderse o **el iptal/bozulur**.

## El açma eşiği (KESİN — 1a)

- **Puanlı açış:** açılan perlerin toplamı **≥ eşik**. Taş puanı = sayısı; wildcard =
  temsil ettiği taşın değeri.
- **Katlamasız:** eşik sabit **101**.
- **Katlamalı:** ilk açan 101 (veya 5 çift) ile açar; **sonraki her açan bir öncekinin
  toplamını ≥ +1 geçmeli** (örn. biri 140 açtıysa sonraki ≥141). Eskalasyon 1b'de;
  1a'da eşik **parametre** (`minPoints`).

## İşleme / cezalar (KESİN — kaynak konsensüsü, mekanik 1b, puan 1c)

- **İşleme (işlek taş) cezası = 101:** Bir oyuncu, **masadaki açılmış bir pere
  eklenebilecek** bir taş atarsa **101 ceza** alır (kendi açmamış olsa bile).
  *İstisna:* tüm elini bitirip **son taşını** atıyorsa, o taş işlenebilir olsa da ceza yok.
- **Okey atma cezası = 101:** Oyuncu okey (wildcard) taşını yere atarsa **101 ceza**.
- **Yerden okey alma cezası = 101:** Okey taşı yalnız izinli durumda yerden alınır;
  kural dışı alınırsa **101 ceza**.
- **Eksik puanla (101 altı) açma:** Açılan taşlar **geri alınır + 101 ceza**.
- **Elde okey kalma cezası = +101 (KESİN — koşullu):** Bir oyuncu **el açmışsa** ve el
  sonunda elinde **okey (wildcard)** tutuyorsa **+101 ek ceza** alır. **El açmamış**
  oyuncunun elinde okey kalması ceza getirmez (zaten açmama cezasını alır).

## Puanlama (kaynak konsensüsü; kesin kilitleme 1c'de)

> Aşağıdaki temel iskelet kaynaklarda tutarlı; **çarpan merdiveni** ve **eşli
> puanlama** noktaları varyanta bağlı → "ONAY BEKLİYOR" bölümüne bak.

- **Bitiren oyuncu: −101** (en düşük skor kazanır; ceza biriktirme oyunu).
- **Biri bitince diğerleri:** elde kalan taşların **sayı değerleri toplamı** kadar ceza.
- **Hiç açmamış oyuncu:** biri bitince **202 ceza** (elindeki taş değil, sabit 202).
- **Bitiriş türü çarpanları (kaynak konsensüsü, onay bekliyor):**
  - Normal bitiş → bitiren −101; kaybedenler elindeki kadar.
  - **Elden bitiş** (hiç açmadan tek hamlede tüm eli bitirme) → bitiren −202; rakip
    cezaları **×2**; açmayan **404**.
  - **Okey ile bitiş** (son atılan/bitiren taş okey) → −202; rakip cezaları **×2**.
  - **Elden + okey** → −404; cezalar **×4**.
  - **Çift bitiş** → rakip cezaları **×2**; **çift okey** bitiş → **×4**.

---

## Oyun modları ve oyun sonu (KARARLAŞTIRILDI)

- **Mod matrisi:** `{eşsiz, eşli} × {katlamasız, katlamalı}` + eşe-katlamalı/eşe-katlamasız.
- **Maç sonu:** oda kurucusu **7 / 11 / 21 el** seçer (kullanıcı seçimli). El sonunda
  en düşük toplam ceza puanı kazanır. (Baraj/hedef-puan modu şimdilik yok.)

## Çiftle bitirme (KARARLAŞTIRILDI — geçici, 1b'de doğrulanacak)

- **Çiftlerle DOĞRUDAN bitilmez.** Çift modunda da bitiş şu akışla olur: oyuncu
  **çiftlerini açar**, **işler** (kendi/masadaki perlere taş ekler), ve **son taşını
  atarak** eli bitirir. Yani "elini tamamen çifte bölüp anında bitme" yok; açış + işleme
  + son-taş-atma gerekir.
- > Bu kuralı ileride inceleyip değiştirmek istersen söyle (oyuncu notu).

## EV KURALI — ONAY BEKLİYOR (1b'de kilitlenecek: tur akışı / oyun-durumu)

- **İşleme detayları:** atılan taşın masadaki hangi perlere (alttan/üstten) eklenebildiği,
  "işlek" sayılma anı; çift modunda işleme akışının tam tanımı.
- **Gösterge / okey'in elde özel kullanımı**, ilk el açıldığında göstergeyi çifte bağlama
  (+1 kuralı — senin daha önce belirttiğin).
- Çekme/atma sırası ve "son taş" bitiş anının tam tanımı.

## Eşli (takımlı) puanlama (KARARLAŞTIRILDI — çalışma modeli, 1c'de doğrulanacak)

- **Takım bazında** puanlanır (karşılıklı 2 takım). Her oyuncu **bireysel açar**;
  partnerin açması seni açmış saymaz.
- **Normal bitiş:** bir eş bitirince **o takımın el puanı ~0'a iner** (bitiren −101,
  partnerinin elde-kalan cezası bağışlanır → takım nötr).
- **Okey ile bitiş:** bitiren takıma ≈ **−200 (−202)**.
- **Elden / hiç açmadan / kimse açmadan bitiş:** bitiren takıma ≈ **−400 (−404)**.
- **Kaybeden takım:** iki oyuncunun cezaları **ayrı ayrı hesaplanıp toplanır**
  (elde kalan taş × duruma göre çarpan; açmayan 202/404).
- > Senin tarifin (−200 / −400) kaynaklardaki −202 / −404 merdiveniyle eşleşiyor;
  > kesin kat sayılarını 1c brainstorm'unda kilitleyeceğiz.

## EV KURALI — ONAY BEKLİYOR (1c'de kilitlenecek: kalan ince ayarlar)

- **Çarpan merdiveni kesin sayıları:** elden/okey/çift/çift-okey bitişlerin tam kat
  sayıları (kaynaklar 2× / 4× ağırlıklı; çift-okey'de 404→808 zinciri geçen kaynak var).
- **Açmayan cezası üst basamakları:** temel **202**; elden/okey bitişte **404**;
  çift-okey bitişte daha yüksek mi?
- **Katlamalı puan çarpanı** (açış eskalasyonunun skora yansıması) ve **eşe-katlamalı /
  eşe-katlamasız** varyant farkları.

> Bu bölüm 1c brainstorm'unda doğrulanıp yukarı (KESİN) taşınacak.

---

## Araştırma kaynakları

- Okey 101 — Vikipedi: https://tr.wikipedia.org/wiki/Okey_101
- Altınstar, Okey 101 Kuralları: https://www.altinstar.com/okey-nasil-oynanir/okey-101-kurallar
- 101 Okey Oyunu Kuralları (101kurallari): https://www.101kurallari.com/
- okeydeyim.net — Çift Kuralları: https://www.okeydeyim.net/101-okey-cift-kurallari.html
- okeydeyim.net — Cezalar: https://www.okeydeyim.net/101-okey-cezalari.html
- 101okeyy.blogspot — Puanlama ve Cezalar: http://101okeyy.blogspot.com/p/puanlama-ve-cezalar.html
- 101okeyy.blogspot — Seri/Çift/İşleme: http://101okeyy.blogspot.com/p/sericiftisleme.html
- Eşli 101 Turnuvası Kuralları (Barobirlik PDF): https://medya.barobirlik.org.tr/barowebsite/uploads/52/kural1.pdf
