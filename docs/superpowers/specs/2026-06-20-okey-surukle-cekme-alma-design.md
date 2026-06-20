# Okey masası: sürükle-bırak çekme / yerden alma (tasarım)

**Tarih:** 2026-06-20
**Kapsam:** Yalnız istemci UI (`client/src/games/okey/`). Sunucu mantığı, kuralları,
move sözleşmesi değişmez.

## Amaç

Tur eylemlerini buton yerine sürükle-bırak yaparak kullanıcı deneyimini
fiziksel okeye yaklaştırmak. Üç eylem:

1. **Desteden çek** — şu an "Desteden çek" butonu.
2. **Yerden al** — şu an "Yerden al" butonu.
3. **At** — *zaten* sürükle-bırak; yalnız yedek "At (seçili)" butonu kaldırılır.

## Etkileşim modeli

- **Çekme:** Deste destesini tut → ıstakadaki **boş yuvaya** bırak → `drawFromPile`.
- **Yerden alma:** Sol komşunun (prevSeat) son attığı taşı (oturma kutusundaki
  "son: 🀫") tut → boş yuvaya bırak → `drawFromDiscard`.
- **Atma:** ıstaka taşını tut → "at" kutusuna bırak (mevcut davranış).

Sürükleme yalnız **kendi çekme fazımda** (yourTurn && phase === "draw") etkin.

## Bıraktığın yuvaya yerleştirme (`pendingDrawSlot`)

Desteden çekilen taş sunucu yanıtına kadar bilinmez (rastgele). Bu yüzden:

- Bırakılan boş yuva indeksi `pendingDrawSlot` olarak hatırlanır.
- Sunucudan yeni el gelince `reconcileSlots`, yeni (önceden eşleşmeyen) taşı
  `pendingDrawSlot` boşsa oraya, değilse ilk boş yuvaya koyar.
- Yerden alınan taş bilinse de aynı mekanizmadan geçer (tutarlılık).
- `reconcileSlots`'a opsiyonel `preferredFirstSlot` parametresi eklenir; hook bir
  `nextDrawSlotRef` tutup tek seferlik uygular.

## Drag state'i genelleştirme

`drag` ayrımlı birlik olur:

```ts
type Drag =
  | { kind: "slot"; from: number; tile: OkeyTile }  // ıstaka içi taşıma + atma + işleme
  | { kind: "deck" }                                 // desteden çek
  | { kind: "floor"; tile: OkeyTile };               // yerden al
```

- Mevcut `drag.tile` / `drag.from` kullanan yerler (atma, işleme, yuva taşıma)
  `kind:"slot"` dalına uyarlanır.
- `SlottedRack` drop koşulu "herhangi aktif sürükleme"ye genişler (`dragFrom`
  yerine genel bir sinyal); ne yapılacağına parent karar verir:
  - `kind:"slot"` → `move(from, to)` (mevcut yeniden sıralama).
  - `kind:"deck"` → boş hedefte `drawFromPile` + `pendingDrawSlot=to`.
  - `kind:"floor"` → boş hedefte `drawFromDiscard` + `pendingDrawSlot=to`.

## Görsel ipuçları

- Deste ve yan taş: `draggable`, grab imleç, küçük "sürükle" etiketi (yalnız çekme fazı).
- Sürükleme başlayınca boş yuvalar drop hedefi olarak vurgulanır.

## Kaldırılan butonlar

"Desteden çek", "Yerden al", "At (seçili)". Aç / Diz / Erit / "Geri koy"
butonları kalır (bunlar çekme/atma değil).

## Dokunulmayanlar

Floor "geri koy" akışı, açma/dizme/eritme, okey-al swap, tüm sunucu kodu.

## Test

- `reconcileSlots` `preferredFirstSlot` için birim testi (yeni taş hedef yuvaya;
  hedef doluysa ilk boşa).
- UI manuel + mevcut Playwright akışları (buton seçicileri değişebilir; E2E
  güncellenmesi gerekirse not edilir).

## Eksik / edge (rapor)

- **Dokunmatik:** HTML5 drag mobil tarayıcılarda zayıf — bu dilim masaüstü içindir;
  mobil için pointer-events tabanlı sürükle ayrı dilim (YAGNI).
- **Deste boşsa:** sürükleme devre dışı.
- **Dolu yuvaya bırakma:** ilk boş yuvaya düşürülür.
