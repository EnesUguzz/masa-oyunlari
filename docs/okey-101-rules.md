# Okey 101 — Canonical Kural Referansı

> Bu dosya, brainstorming sırasında onaylanan Okey 101 kurallarının **tek doğruluk
> kaynağıdır**. 1a/1b/1c spec'leri buradan beslenir. Yeni karar verildikçe güncellenir.
> "NETLEŞTİRİLECEK" başlıkları ileri aşamalar (1b/1c) için bilinçli açık bırakılmış
> kararlardır.

## Taşlar ve kurulum (KESİN)

- **106 taş:** 4 renk (`red` kırmızı, `yellow` sarı, `black` siyah, `blue` mavi)
  × 1–13 × **2 kopya** = 104 sayılı taş, + **2 sahte okey** (fake joker) = 106.
- **4 oyuncu.**
- **Dağıtım:** Gösterge taşı belirlenir; oyunculara **21'er** taş, **başlayan
  oyuncuya 22**. Kalan ~**20** taş çekme destesi olur. (Toplam: 22+21+21+21 + 1 gösterge
  + 20 deste = 106.)
- **Gösterge** her zaman **sayılı bir taştır** (sahte okey gösterge olamaz; gelirse
  atlanır/yeniden çekilir).

## Okey ve wildcard (KESİN)

- **Okey** = göstergenin **bir üstü, aynı renk** (gösterge kırmızı 5 → okey kırmızı 6).
  Gösterge 13 ise okey 1 (aynı renk).
- **Wildcard (joker) = 4 taş:** 2 sahte okey **+** okey değerindeki 2 gerçek taş.
- Bir wildcard, perde herhangi bir taşın yerine geçebilir; **puanı, temsil ettiği
  taşın değeridir**.

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
  artar** (6 açıldıysa sonraki ≥7) — eskalasyon 1b'de, primitif `minPairs` parametreli.

## El açma eşiği (KESİN — 1a)

- **Puanlı açış:** açılan perlerin toplamı **≥ eşik**. Taş puanı = sayısı; wildcard =
  temsil ettiği taşın değeri.
- **Katlamasız:** eşik sabit **101**.
- **Katlamalı:** ilk açan 101 (veya 5 çift) ile açar; **sonraki her açan bir öncekinin
  toplamını ≥ +1 geçmeli**. Eskalasyon 1b'de; 1a'da eşik **parametre** (`minPoints`).

## Oyun modları (KESİN tanım, mekanik 1c'de)

- Matris: `{eşsiz, eşli} × {katlamasız, katlamalı}`.
- **Eşsiz:** herkes bireysel.
- **Eşli:** karşılıklı **2 takım**; **her oyuncu bireysel açar** (partnerin açması seni
  açmış saymaz); puanlama takım bazında.

---

## NETLEŞTİRİLECEK — 1b (tur akışı / oyun-durumu)

- **Mod kilidi:** bir oyuncu çift açtıysa o el **normal per açamaz**, per açtıysa çift
  açamaz. Sonradan mod değiştiremez.
- **Çiftle bitirme tam mekaniği:** kaç çiftle / kaç taşla bitilir? (Kaynaklar 14 taş /
  8 çift diyor ama bu standart okeyden karışmış; 101'de el 21 — bitiş anında 22.
  Çekme/atma ile çift bitirmenin tam taş sayısı **netleştirilecek**.)
- **Masada en fazla 3 oyuncu çifte gidebilir**; 4'ü de giderse **el bozulur** — bu
  kısıt tur-akışında zorlanır.
- **İşleme/işletme:** atılan taş masadaki bir pere eklenebiliyorsa kural ihlali.
- Çift açan **rakip taşı alamaz**, yalnız kendi çektiğiyle ilerler.
- Çekme/atma sırası, gösterge açma, "alttan/üstten" işleme detayları.

## NETLEŞTİRİLECEK — 1c (puanlama & varyantlar)

- **Bitiren oyuncu −101** (en düşük skor kazanır).
- **Cezalar:** 101'e ulaşmadan açma → taşları geri al + **101 ceza**; açmamış oyuncu
  başkası bitince **404 ceza**; ıstakada **okey kalırsa +101** (eşli'de partneri de
  etkiler); attığın taş bir pere eklenebiliyorsa **101 ceza**.
- **Çift cezaları:** çift bitiren rakiplerin cezasını **katlar**; başkası bitince çift
  gidenin elindeki taş değerleri **2 kat** sayılır; yere çift açıp bitemeyenin cezası
  **2 katlanır**.
- **Eşli puanlama:** takım bazında; bir eş bitince **partnerinin cezası silinir**.
- **Katlamalı puan katlama** mekaniği (açış eskalasyonu + puan çarpanı).
- Hedef skor / oyun sonu koşulu (kaç ele kadar, baraj vb.).

> Bu iki bölüm 1b/1c brainstorm'larında doğrulanıp yukarı (KESİN) taşınacak.
