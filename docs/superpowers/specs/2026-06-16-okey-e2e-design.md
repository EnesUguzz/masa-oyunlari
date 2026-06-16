# Tasarım: Okey E2E Testleri (Sub-project 2c)

> Tarih: 2026-06-16
> Kapsam: Playwright ile uçtan-uca tarayıcı testleri. CLAUDE.md hedefi ("iki tarayıcı
> aynı odada") + bot sayesinde tek-tarayıcı solo-vs-bot tam akışı. Gerçek server + client
> ayakta; gerçek socket trafiği.

## Amaç

Tüm stack'i (React UI ↔ Socket.IO ↔ okey motoru ↔ botlar) gerçek bir tarayıcıda doğrulamak.
Birim/entegrasyon testleri parçaları kanıtladı; E2E bütünü kanıtlar: bir kullanıcı gerçekten
oda kurup botlarla oyun başlatıp hamle yapabiliyor mu, ve iki tarayıcı aynı odada birbirini
görüyor mu (çok-istemci + per-player view).

## Araç ve kurulum

- **`@playwright/test`** kök devDependency. Chromium: `npx playwright install chromium`.
- **`playwright.config.ts`** (kök): `testDir: "e2e"`, `baseURL: "http://localhost:5173"`,
  tek proje (chromium, headless), `webServer` testlerden önce `pnpm dev`'i başlatır
  (`command: "pnpm dev"`, `url: "http://localhost:5173"`, `reuseExistingServer: !process.env.CI`,
  cömert `timeout` örn. 120s — Vite + tsc başlangıcı için).
- Kök `package.json`: `"test:e2e": "playwright test"`. (Mevcut `pnpm test` birim testleri kalır;
  E2E ayrı komut — CLAUDE.md de böyle der.)
- E2E testleri `pnpm test`'e dahil EDİLMEZ (ağır, ayrı altyapı); `pnpm test:e2e` ile çalışır.

## Determinizm

Üretim sunucusu `CryptoRng` kullanır → dağıtım rastgele. E2E **yapısal** doğrular: ekran
geçişleri, taş **sayıları**, sıra göstergesi, oyuncu listesi — **belirli taşlar değil**.
Bu yüzden seed gerekmez; testler dağıtımdan bağımsız geçer. (İleride istenirse sunucuya
`RNG_SEED` env eklenip deterministik E2E yazılabilir — şimdilik YAGNI.)

## Küçük UI dokunuşları (sağlam selektör için)

- `client/src/core/Room.tsx`: oda kodu gösterimine `data-testid="room-code"`.
- `client/src/games/okey/Hand.tsx`: kök sarmalayıcıya `data-testid="hand"`.
Gerisi rol/metin selektörü (Türkçe buton/etiket adları): "Devam", "Yeni Oda Kur",
"Katıl", "Botlarla Doldur", "Oyunu Başlat", "Desteden çek", "At", "Takma ad", "Oda kodu".

## Senaryolar (`e2e/`)

### 1. `solo-vs-bots.spec.ts` — tek tarayıcı, tam akış
1. `/` aç → "Takma ad" input'a "Ben" yaz → "Devam".
2. Lobi → "Yeni Oda Kur" → Oda ekranı: `room-code` görünür, "Oyuncular (1/4)".
3. "Botlarla Doldur" → "Oyuncular (4/4)" + "Oyunu Başlat" görünür.
4. "Oyunu Başlat" (varsayılan config: eşsiz/katlamasız/cezasız/11).
5. Masa görünür: "Senin elin (22" metni; "Desteden çek" butonu (senin sıran, draw fazı).
6. "Desteden çek" → el 23 olur (act fazı); `[data-testid=hand] button` ilk taşı tıkla (seç) →
   "At" → hamle gönderilir.
7. Botlar otomatik oynar; **sıra tekrar sana döner** → "Desteden çek" yeniden görünür
   (Playwright auto-wait). Bu, motor + bot + socket + UI'ın uçtan uca çalıştığını kanıtlar.

### 2. `two-browsers-lobby.spec.ts` — iki tarayıcı context'i, çok-istemci
1. Context A: ad "A" → "Yeni Oda Kur" → `room-code` metnini oku (`codeA`).
2. Context B (ayrı `browser.newContext()`): ad "B" → "Oda kodu" input'a `codeA` yaz → "Katıl".
3. Doğrula: **A** ekranında oyuncu listesi A ve B'yi içerir; **B** ekranında da A ve B;
   her context kendi oyuncusunda "(sen)" görür. Gerçek-zaman senkron + per-player kimlik.

> Not: localStorage token/nickname izolasyonu için iki ayrı `browser.newContext()` kullanılır
> (paylaşılan storage olmaz; aksi halde aynı token'la ikisi tek oyuncu olur).

## Hata / kararlılık notları

- `webServer` başlatma süresi: `pnpm dev` Vite + tsc başlatır; `timeout` cömert tutulur.
- Bot hamleleri sunucuda senkron; istemci tek `okey:state` ile sıranın döndüğünü görür →
  Playwright "Desteden çek" görünene kadar otomatik bekler (sabit `sleep` yok).
- Sunucu in-memory: her `test:e2e` koşusu taze sunucuyla başlar (webServer yeni süreç).
- Testler bağımsız: her biri kendi tarayıcı context'iyle, taze oda.

## Kapsam dışı / sonraki
- Tam el bitirme (açma/işleme/kazanma) E2E'si — botlar v1'de açmadığından insanla tam el
  bitirmek uzun; v1 "hamle yapılabiliyor + sıra dönüyor" ile yetinir. (Akıllı bot gelince
  daha zengin senaryo yazılabilir.)
- Reconnect E2E (sayfa yenileme → masaya dönüş) — ayrı senaryo olarak sonra eklenebilir.
- CI entegrasyonu / görsel snapshot.

## Tamamlanma kriterleri (DoD)
- `pnpm test:e2e` her iki senaryoyu da yeşil geçirir (yerel; chromium kurulu).
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (birim) hâlâ temiz.
- Eklenen `data-testid`'ler dışında UI davranışı değişmez; çekirdek oyun-agnostik kalır.
