# Okey 101 — Akıllı (sezgisel) bot — Tasarım

> Tarih: 2026-06-16
> Durum: onaylandı, implementasyon planına hazır.
> Seviye: **orta (açgözlü sezgisel)**, LLM'siz. İleri seviye stratejik bot ayrı dilim(ler)e bırakıldı.

## Amaç ve bağlam

Mevcut bot yalnızca `autoMoves`'u kullanıyor (desteden çek + son taşı at). Hiç per/çift
aramaz, açmaz, bilerek bitirmez. Bu dilim, bot koltuklarına **gerçekten oynayan** bir
sezgisel bot ekler: elinde en iyi per/çift kombinasyonunu bulur, eşik dolunca açar,
dizebildiğini masaya koyar, bitebiliyorsa bitirir, kalan taşların ceza puanını
düşürecek şekilde atar. Rakip takibi / yem verme bu dilimde **yok** (YAGNI).

Karar (kullanıcı onayı):
- Bot seviyesi: **orta, açgözlü sezgisel** (şimdilik uygulamayı test etmek için).
- Kapsam: yeni akıllı bot **tüm bot koltuklarında** eski güvenli botun yerini alır.
  UI'da zorluk seçimi **yok** (YAGNI). İnsan oyuncu zaman aşımına uğrarsa kullanılan
  güvenli `autoMoves` auto-play'i **korunur**.
- Çekirdek el-çözümleme yaklaşımı: **düğüm-sınırlı backtracking arama** (Yaklaşım 1).

## Oyun mekaniği — tasarımı şekillendiren kısıtlar

(Kaynak: `server/src/games/okey/apply.ts`, `opening.ts`, `helpers.ts`.)

- Bir el yalnızca bir oyuncu **son taşını attığında** biter (`apply.ts`: discard sonrası
  `hand.length === 0`). Yani bot kazanmak için bir taş hariç her şeyi masaya dizmeli,
  sonra o son taşı atmalı.
- Taş dizmek (`openNewMeld` / `processToMeld`) yalnızca **açtıktan sonra** mümkündür.
  Açmak eşiği gerektirir: per modunda toplam temsil değeri `meldThreshold` (varsayılan
  101, katlamalı modda yükselir); çift modunda `pairThreshold` kadar çift.
- **Floor-tile kuralı** (`apply.ts`): `drawFromDiscard` ile alınan taş **o turda
  dizilmek zorundadır** — `pendingFloorTile` doluyken atış (discard) yapılamaz. Bu yüzden
  discard'tan çekmek sadece taş hemen kullanılabiliyorsa güvenlidir.
- Pairs modunda açan oyuncu discard'tan çekemez (`apply.ts: drawFromDiscard`).
- Aynı `OkeySession.autoPlayTurn` hem bot koltukları (`driveBots`) hem insan zaman aşımı
  (`armTimer`) için çağrılıyor; ikisi de şu an `autoMoves` kullanıyor.

## Mimari yerleşim ve sınırlar

Yeni saf modül: `server/src/games/okey/bot.ts` (+ `bot.test.ts`).

```ts
// Tek genel API — saf, deterministik, ağ/Socket.IO'dan bağımsız:
export function botMoves(state: OkeyGameState, seat: number): Move[]
```

- **Saf fonksiyon**: state'i mutasyona uğratmaz; tek turun tamamını legal `Move[]` olarak
  döndürür (çek → [aç / diz / işle …] → at).
- **Hile yok**: planlayıcı yalnızca `state.players[seat].hand` + herkese açık bilgiyi
  (tableMelds, discards, gösterge/okey, kalan deste sayısı, eşik) okur. Rakip ellerine
  bakmaz — `toPlayerView` kuralının ruhuna uyar.
- **Oyuna özel**: Okey'e özgü sezgi `games/okey/` altında kalır. Çekirdek (`core/`)
  dokunulmaz.

## Çekirdek: el çözümleme (Yaklaşım 1)

`decompose(tiles, okey, goal)` — düğüm-sınırlı backtracking:

- Mevcut validatörleri yeniden kullanır: `isValidMeld`, `meldValue` (`points.ts`),
  `isPair` (`pairs.ts`). Sahte okey ve okey, validatörlerce zaten wildcard olarak
  doğru ele alınıyor; çözümleyici bunu yeniden uygulamaz.
- İki amaç (`goal`):
  - **maxValue**: açma için melded per'lerin toplam temsil değerini maksimize eder.
  - **maxTilesUsed**: dizme/bitirme için kullanılan taş sayısını maksimize eder.
- Çıktı: seçilen per/grup listesi + kullanılan taşlar + toplam değer.
- **Güvenlik valfi**: bir düğüm sayacı üst sınırı vardır; sınır aşılırsa o ana dek
  bulunan en iyi sonuç döner (asla donmaz / sonsuz dallanmaz).
- Determinizm: taşlar sabit bir sırayla işlenir; aynı girdi → aynı çıktı (test edilebilir).

## Tur planı (`botMoves`)

**DRAW fazı:**
- Varsayılan `drawFromPile`.
- `drawFromDiscard` yalnızca **güvenliyse**: bot zaten açmış VE önceki oyuncunun son
  atılan taşı bu turda hemen dizilebiliyorsa (mevcut bir per'e `processToMeld` ya da yeni
  geçerli grup/çift). Aksi halde floor-tile kuralına takılmamak için desteden çeker.
- Pairs modunda discard'tan çekilmez.

**ACT fazı:**
- Açmamışsa:
  - `decompose(maxValue)` toplamı `meldThreshold`'u tutuyorsa → `openMelds` (eşiği geçen
    en iyi per seçimi).
  - Tutmuyorsa çift sayısı `pairThreshold`'u tutuyorsa → `openPairs`.
  - İkisi de olmuyorsa açma (sadece çek/at ile bekle).
- Açmışsa: dizebildiği her şeyi masaya koy — mevcut per'lere `processToMeld`, yeni
  geçerli gruplara `openNewMeld` — eli küçült.
- **Bitirme**: dizme sonrası el tam 1 taşa inebiliyorsa o son taşı atıp kazanır.
  Planlayıcı her zaman atılacak 1 taşı elde tutar; her şeyi dizip 0 taşla kalmaz
  (bu illegal — bitirme atış ile olur).

**Atış (discard):** kalan çözümlemeye en az katkısı olan "ölü" taşı at (tipik olarak
izole, yüksek değerli taş). Wildcard / okey mümkünse atılmaz. `pendingFloorTile`
doluyken atış denenmez.

## Entegrasyon

`OkeySession.autoPlayTurn(seat)` koltuğa göre ayrışır:

- **Bot koltuğu** (`isBotSeat(seat)`) → `botMoves`.
- **İnsan zaman aşımı** → mevcut güvenli `autoMoves` (korunur).
- **Güvenlik ağı**: `botMoves` herhangi bir sebeple boş dönerse ya da bir hamle
  `applyMove`'da hata atarsa → `autoMoves`'a düşülür. Oyun asla kilitlenmez.
- `handlers.ts`'deki `driveBots` ve `armTimer` döngüleri olduğu gibi kalır.

## Test (Vitest, TDD — önce başarısız test)

- `decompose`:
  - bilinen el → beklenen per/değer;
  - wildcard / sahte okey içeren el;
  - boş ve çözülemeyen el (graceful).
- `botMoves`:
  - açma eşiği taması → `openMelds` / `openPairs`;
  - eşik tutmuyorsa açmama;
  - açtıktan sonra dizme (`processToMeld` / `openNewMeld`);
  - **bitirme** senaryosu (kurgulanmış elle kazanır);
  - güvenli discard seçimi (ölü taşı atar, wildcard'ı tutar);
  - floor-tile kuralına uyma (asla `drawFromDiscard` ile takılıp kalmaz).
- Entegrasyon: bot koltuklu `OkeySession` bir eli sonuna kadar yalnızca legal hamlelerle
  oynar (mevcut `driveBots` akışıyla).
- Determinizm: aynı state → aynı `Move[]`.

## YAGNI / kapsam dışı (ileride ayrı dilim)

- Atılan taşların takibi, rakibe yem vermeme.
- Çift ↔ seri arası ileri optimizasyon, bitirme planlaması derinliği.
- Eş (esli) işbirliği stratejisi.
- UI'da bot zorluk seçimi.
