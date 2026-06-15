# Tasarım: Okey 101 Saf Kural Primitifleri (Sub-project Okey-1a)

> Tarih: 2026-06-15
> Kapsam: Okey 101'in **saf, ağ-bağımsız kural primitifleri** — taş modeli, deste,
> dağıtım, gösterge/okey, per (seri/grup) ve çift doğrulama, puan/açış-eşiği kontrolü.
> Kanonik kurallar: `docs/okey-101-rules.md`.

## Amaç

Okey 101'in en kural-yoğun ve en çok hata üreten kısmını — taş kombinasyonu doğrulama —
**tamamen saf, deterministik (seed'li RNG), birim-test-edilebilir** fonksiyonlar olarak
çıkarmak. Hiç Socket.IO, oda, oyun-durumu veya ağ yok. Bu primitifler **varyant-agnostiktir**:
katlamalı/katlamasız ve eşli/eşsiz modlarının hepsinde aynı çalışır; tek fark, açış
eşiklerinin **parametre** olmasıdır (eskalasyon mantığı 1b'ye aittir).

Bu, CLAUDE.md'nin "saf oyun mantığı — ağdan bağımsız, birim test edilebilir" ve
"RNG enjekte edilebilir, oyun mantığı Math.random'a bağlanmaz" kurallarının doğrudan
uygulamasıdır.

## Kapsam dışı (sonraki spec'ler)

- **1b:** oyun-durumu + tur akışı (çek/at/aç/işle/bitir), kazanma tespiti, **mod kilidi**
  (per↔çift), çiftle-bitirme tam mekaniği, en-fazla-3-çift kısıtı, `toOkeyPlayerView`.
- **1c:** ceza puanlama, katlamalı/katlamasız eskalasyon & çarpan, eşli/eşsiz takım puanı.
- Çekirdeğe entegrasyon (oyun modülü, socket hamleleri), istemci masası, E2E.

`docs/okey-101-rules.md` içindeki "NETLEŞTİRİLECEK" başlıkları bu aşamalara aittir.

## Mimari

Tek bir saf modül: `server/src/games/okey/`. Çekirdeğin `Rng` arayüzünü
(`server/src/core/rng.js`) kullanır — başka çekirdek bağımlılığı yok. `OkeyTile` ve
tüm oyun-özel tipler **burada** tanımlanır; `shared/`'a konmaz (CLAUDE.md "Card değil"
kuralı). Her fonksiyon saftır: girdiyi mutasyona uğratmaz, deterministiktir.

### Klasör yapısı (bu spec sonunda)

```
server/src/games/okey/
├── tile.ts        # OkeyColor, OkeyTile (numbered | fakeJoker), eşitlik/yardımcılar
├── okey.ts        # determineOkey, isOkeyTile, isWildcard
├── deck.ts        # buildDeck (106), shuffle(rng)
├── deal.ts        # deal -> 4 el (22/21/21/21) + gösterge + çekme destesi
├── meld.ts        # isValidRun, isValidSet, isValidMeld, meldRepresentedValues
├── pairs.ts       # isPair, isAllPairs, canOpenWithPairs
├── points.ts      # tileValue, meldValue, meldsTotal, canOpenWithMelds
└── index.ts       # barrel (modülün dışa açtığı API)
```

Her dosyanın tek sorumluluğu var; en karmaşık olan `meld.ts` (wildcard'lı seri/grup
çözümü) kendi başına izole ve testlenebilir.

## Birim tasarımları

### `tile.ts`
```ts
export type OkeyColor = "red" | "yellow" | "black" | "blue";
export interface NumberedTile { kind: "numbered"; color: OkeyColor; value: number; } // 1..13
export interface FakeJoker { kind: "fakeJoker"; }
export type OkeyTile = NumberedTile | FakeJoker;
```
- `numbered(color, value)`, `fakeJoker()` kurucular.
- `isFakeJoker(t)`, `isNumbered(t)` tip daraltıcılar.
- `tilesEqual(a, b)`: aynı `kind` ve (numbered ise) aynı renk+değer. (İki sahte okey
  birbirine eşittir.)
- `numbered` kurucusu `value`'yu 1..13 dışındaysa reddeder (kurucu seviyesinde guard).

### `okey.ts`
```ts
export function determineOkey(indicator: NumberedTile): NumberedTile; // aynı renk, value+1 (13->1)
export function isOkeyTile(tile: OkeyTile, okey: NumberedTile): boolean; // numbered ve okey'e eşit
export function isWildcard(tile: OkeyTile, okey: NumberedTile): boolean; // fakeJoker || isOkeyTile
```
- `determineOkey`: 13 → 1 sarması (renk korunur).

### `deck.ts`
```ts
export function buildDeck(): OkeyTile[]; // 106: her (renk×1..13) 2 kopya + 2 fakeJoker
export function shuffle(deck: readonly OkeyTile[], rng: Rng): OkeyTile[]; // Fisher-Yates, yeni dizi
```
- `buildDeck` her zaman tam 106 taş, doğru kompozisyon (52 farklı sayılı taş × 2 + 2 joker).
- `shuffle` saf: girdiyi değiştirmez, enjekte `rng.nextInt` ile karar verir, yeni dizi döner.

### `deal.ts`
```ts
export interface DealResult {
  hands: OkeyTile[][];        // tam 4 el; hands[0] başlayan (22 taş), diğerleri 21
  indicator: NumberedTile;    // gösterge (her zaman sayılı taş)
  drawPile: OkeyTile[];       // kalan taşlar
  startingPlayerIndex: 0;     // başlayan her zaman 0 (22 taşlı)
}
export function deal(shuffledDeck: readonly OkeyTile[]): DealResult;
```
- Girdi: 106 taşlık (karılmış) deste. Değilse hata (guard).
- Gösterge: desteden **ilk sayılı taş** seçilir (sahte okey ise atlanır). Kalanlar
  22/21/21/21 olarak dağıtılır; geriye kalan çekme destesi olur.
- Korunum değişmezi: dağıtılan + gösterge + çekme destesi = 106; hiçbir taş kaybolmaz/çoğalmaz.
- Saf: girdiyi değiştirmez.

### `meld.ts` (en kritik birim)
```ts
export function isValidRun(tiles: readonly OkeyTile[], okey: NumberedTile): boolean;
export function isValidSet(tiles: readonly OkeyTile[], okey: NumberedTile): boolean;
export function isValidMeld(tiles: readonly OkeyTile[], okey: NumberedTile): boolean; // run || set
/** Geçerliyse her taşın temsil ettiği değer dizisi; değilse null. Puanlama bunu kullanır. */
export function meldRepresentedValues(tiles: readonly OkeyTile[], okey: NumberedTile): number[] | null;
```
**Seri kuralı:** doğal taşlar aynı renk + ayrık değerler; w wildcard ile birlikte
**ardışık** bir dizi (uzunluk = doğal + w, ≥3) oluşturulabilmeli; dizi **1..13 içinde**,
**1 yalnız altta**, **sarma yok**. En az 1 doğal taş. Wildcard'lar boşlukları/uçları doldurur.

**Grup kuralı:** doğal taşlar aynı değer + ayrık renk; w wildcard eksik renkleri doldurur;
toplam uzunluk **3–4**; en az 1 doğal taş.

`meldRepresentedValues` doğrulama + değerlemeyi birleştirir: doğal taş kendi değerini,
wildcard temsil ettiği değeri döner (seri'de pozisyon, grup'ta ortak sayı). Bu sayede
puanlama wildcard'ın "ne yerine geçtiğini" yeniden hesaplamak zorunda kalmaz.

> Algoritma (doğru-yanlış arama) plan/TDD aşamasında yazılır; spec davranışı + edge'leri tanımlar.

### `pairs.ts`
```ts
export function isPair(a: OkeyTile, b: OkeyTile, okey: NumberedTile): boolean;
export function isAllPairs(tiles: readonly OkeyTile[], okey: NumberedTile): boolean;
export function canOpenWithPairs(pairs: readonly (readonly OkeyTile[])[], okey: NumberedTile, minPairs?: number): boolean;
```
- `isPair`: iki taş **birebir aynı sayılı taş** (renk+değer) **veya** en az biri wildcard.
- `isAllPairs`: taş çokluk-kümesi tam olarak geçerli çiftlere bölünebiliyor mu (tek taş kalmamalı).
- `canOpenWithPairs`: her grup tam 2 taş ve geçerli çift **ve** çift sayısı **≥ minPairs**
  (varsayılan **5**; katlamalı'da çağıran 1b daha yükseğini geçer).

### `points.ts`
```ts
export function tileValue(tile: NumberedTile): number; // = value
export function meldValue(meld: readonly OkeyTile[], okey: NumberedTile): number;
export function meldsTotal(melds: readonly (readonly OkeyTile[])[], okey: NumberedTile): number;
export function canOpenWithMelds(melds: readonly (readonly OkeyTile[])[], okey: NumberedTile, minPoints?: number): boolean;
```
- `meldValue`: `meldRepresentedValues(meld, okey)` ile temsil değerlerinin toplamı.
  **Sözleşme:** per geçersizse (`meldRepresentedValues === null`) `meldValue`
  çekirdeğin `InvalidMoveError`'unu fırlatır — sessizce 0 dönmez. `meldsTotal` de aynı
  şekilde her perin geçerli olmasını bekler; karışık/güvenilmeyen girdi için önce
  `canOpenWithMelds` çağrılır (o, geçerliliği kontrol edip `false` döner, fırlatmaz).
- `canOpenWithMelds`: **tüm perler geçerli (`isValidMeld`)** VE `meldsTotal ≥ minPoints`
  (varsayılan **101**). İkisinden biri sağlanmazsa `false`.

### `index.ts`
Modülün dışa açtığı tüm API'yi yeniden ihraç eder (1b bu yüzeyi tüketir).

## Hata yönetimi

- Doğrulama fonksiyonları **boolean** döner (fırlatmaz) — saf ve birleştirilebilir.
- Kurucular ve `deal`, geçersiz girdide (örn. value 1..13 dışı, deste ≠106) çekirdeğin
  `InvalidMoveError`'unu (veya açık bir argüman hatası) fırlatır.
- Bu spec **yeni hata sınıfı eklemez**; 1b hamle zorlamasında çekirdek hatalarını kullanır.

## Test (Vitest, TDD)

Her birim için önce başarısız test. Seed'li `SeededRng` ile deterministik.
- **deck:** 106 taş, doğru kompozisyon (her sayılı taş tam 2 kopya, 2 joker); `shuffle`
  korunumu (aynı çokluk-küme) ve determinizm (aynı seed → aynı sıra).
- **deal:** el sayıları 22/21/21/21, gösterge sayılı, korunum (toplam 106), saflık
  (girdi değişmez), gösterge sahte okey gelirse atlama.
- **okey:** `determineOkey` (13→1 dahil); `isWildcard` 4 wildcard'ı tanır.
- **meld (seri):** geçerli `1-2-3`, `11-12-13`; reddedilen `12-13-1`, `11-12-13-1`,
  `13-1-2`, farklı renk, tekrar; wildcard ikamesi (`R5 J R7` geçerli, değer [5,6,7]);
  tamamı-wildcard reddi; <3 reddi.
- **meld (grup):** `R7 Y7 K7` geçerli, `R7 R7 Y7` (aynı renk tekrar) reddi, 5 taş reddi,
  wildcard ile eksik renk; temsil değerleri doğru.
- **pairs:** birebir çift, wildcard'lı çift, iki-wildcard çifti; `isAllPairs` bölme;
  `canOpenWithPairs` 4 çift reddi / 5 çift kabulü; `minPairs` parametresi.
- **points:** `meldsTotal` doğru (wildcard temsil değeriyle); `canOpenWithMelds` 100 reddi
  / 101 kabulü; geçersiz per içeren küme reddi; `minPoints` parametresi.

## Tamamlanma kriterleri (DoD)

- `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` temiz.
- Tüm primitif testleri yeşil; `server/src/games/okey/` dışında çekirdek kod değişmez.
- Modül tamamen saf: ağ/oda/durum yok; yalnız `core/rng` bağımlılığı.
- `shared/`'a oyun-özel tip eklenmez.
