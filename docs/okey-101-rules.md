# Okey 101 — Canonical Kural Referansı

> Bu dosya, Okey 101 kurallarının **tek doğruluk kaynağıdır**. 1a/1b/1c spec'leri
> buradan beslenir. Yeni karar verildikçe güncellenir.
>
> **Önemli:** Okey 101'in bölgesel / "ev kuralı" varyasyonları vardır. Aşağıda
> **(KESİN)** = kaynaklar arası konsensüs + onaylanmış; **(EV KURALI — ONAY BEKLİYOR)**
> = web kaynakları çelişiyor ya da varyanta bağlı, oyuncunun (sen) kendi oynadığın
> sürüme göre netleştirmesi gereken noktalar. Bu ikincileri 1b/1c brainstorm'unda
> kilitleyip (KESİN)'e taşıyacağız.
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

## EV KURALI — ONAY BEKLİYOR (1b'de kilitlenecek: tur akışı / oyun-durumu)

- **Çiftle bitirme tam mekaniği — NETLEŞTİRİLMELİ.** Web kaynakları "14 taş / 8 çift"
  diyor, ama bu **standart Çift Okey'den (14 taşlı el) karışmış** bir rakam; 101'de el
  **21** taş (bitişte çekince 22). 21 tek sayı olduğundan "hepsi çift" matematiksel
  olarak doğrudan oturmuyor. **Senin oynadığın sürümde** çiftle nasıl bitilir?
  (kaç çift / son taş atılır mı / okeyle çift tamamlama). → **senin kararın**.
- **İşleme detayları:** atılan taşın masadaki hangi perlere (alttan/üstten) eklenebildiği,
  "işlek" sayılma anı.
- **Gösterge / okey'in elde özel kullanımı**, ilk el açıldığında göstergeyi çifte bağlama
  (+1 kuralı — senin daha önce belirttiğin).
- Çekme/atma sırası ve "son taş" bitiş anının tam tanımı.

## EV KURALI — ONAY BEKLİYOR (1c'de kilitlenecek: puanlama & varyantlar)

- **Çarpan merdiveni:** elden/okey/çift/çift-okey bitişlerin **kesin** kat sayıları
  (kaynaklar 2× ve 4× üzerinde büyük ölçüde birleşiyor ama senin sürümünü doğrulayalım).
- **Açmayan cezası:** temel **202**; elden/okey bitişte **404**; çift-okey'de daha
  yüksek mi? (kaynaklarda 404→808 zinciri geçiyor — varyant).
- **Istakada okey kalırsa:** biri bitince elinde okey kalanın **+101** ek cezası
  (eşli'de partneri etkiler mi?) — varyant, doğrulanacak.
- **Eşli puanlama — kaynaklar ÇELİŞİYOR:** bir kaynak "bir eş bitince partnerinin
  cezası **silinir**" diyor; başka kaynak "kaybeden takımdaki oyuncuların cezaları
  **ayrı ayrı toplanır**" diyor. **Senin sürümün hangisi?** → **senin kararın**.
- **Eşe katlamalı / eşe katlamasız** varyantlarının puan farkları.
- **Hedef skor / oyun sonu:** kaç ele kadar, baraj puanı, vb.

> Bu iki bölüm 1b/1c brainstorm'larında doğrulanıp yukarı (KESİN) taşınacak.

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
