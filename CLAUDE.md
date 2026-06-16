# CLAUDE.md — Online Masa Oyunları Platformu

> Bu dosya Claude Code'un her oturumda otomatik okuduğu kalıcı talimat dosyasıdır.
> Proje ilerledikçe güncellenir — yaşayan bir belgedir, bir kez yazılıp bırakılmaz.

## Proje özeti

Çok oyunculu, gerçek-zamanlı, tarayıcıda oynanan masa oyunları platformu.
Oyuncular bir odaya katılabilir veya kendi odasını kurabilir.

**Geliştirme sırası (önemli):** Önce **Okey 101** tek başına tam çalışır hale
getirilecek. Sonra sırayla UNO, Kızma Birader ve diğerleri eklenecek.
Bu yüzden mimari **tek bir oyuna gömülü olmamalı** — ortak bir "oyun motoru"
çekirdeği + her oyunun takılıp çıkabildiği modüller şeklinde tasarlanmalı.
İlk oyunu yazarken bile bu ayrım korunmalı (ama gereksiz soyutlama yapılmamalı,
aşağıdaki YAGNI kuralına bak).

## Teknoloji stack'i

- **Frontend:** React + TypeScript, Vite ile.
- **Backend:** Node.js + TypeScript + Socket.IO (gerçek-zamanlı).
- **Monorepo / paket yöneticisi:** **pnpm workspaces**. Üç paket vardır:
  `shared`, `server`, `client`. TypeScript tarafında **project references**
  kullanılır, böylece `shared` değişince tip kontrolü iki tarafa da yayılır.
  `client` ve `server`, `shared`'ı paket adıyla import eder (örn. `@masa/shared`),
  göreli `../../shared` yollarıyla değil.
- **Paylaşılan tipler (`shared/`):** Yalnızca **gerçekten oyun-bağımsız** tipler
  burada durur: `Player`, `Room`, `RoomStatus`, jenerik `GameState`, istemci↔sunucu
  event sözleşmeleri. **Oyuna özel parça tipleri burada DURMAZ** — bunun nedeni
  aşağıdaki "Card değil" notunda.
- **Oyuna özel tipler:** Her oyunun kendi parça/durum tipi kendi modülündedir
  (`OkeyTile`, ileride `UnoCard` ...). Okey bir **taş** oyunudur, kart oyunu değil;
  bu yüzden ortak bir `Card` tipi **tanımlanmaz** (bu, YAGNI ve "hayali esneklik
  ekleme" kuralının doğrudan uygulaması).
- **Şema doğrulama:** Zod — istemciden gelen her mesaj sunucuda Zod ile doğrulanır
  (asla ham/güvenilmeyen veriye güvenme). Zod şemaları event sözleşmesinin
  kaynağıdır; TS tipleri şemadan türetilir (`z.infer`).
- **Oda/state yönetimi:** Başta in-memory, tek sunucu. Ölçeklenince Redis'e geçiş
  için bir depo (repository) arayüzü arkasında sakla, ama şimdi Redis kurma (YAGNI).
- **Logger:** `console.log` değil, yapılandırılmış logger (**pino** önerilir).
- **Test:** Oyun mantığı için birim testleri (**Vitest**) + Playwright ile E2E
  (iki tarayıcı aynı odada senaryosu).

## Klasör yapısı (hedef)

```
/
├── shared/          # ortak TS tipleri ve oyun-bağımsız sözleşmeler
│   └── src/
│       ├── types/   # Player, Room, GameState<TPublic>, ...
│       └── events/  # istemci↔sunucu event adları + Zod şemaları
├── server/          # Node + Socket.IO backend
│   └── src/
│       ├── core/    # oyun-bağımsız çekirdek: oda, lobi, oyuncu, bağlantı, reconnect
│       ├── games/   # her oyun ayrı modül: games/okey/, games/uno/ ...
│       └── ...
├── client/          # React + Vite frontend
│   └── src/
│       ├── core/    # oyun-bağımsız UI: lobi, oda listesi, sohbet
│       ├── games/   # her oyunun masası ayrı: games/okey/, games/uno/ ...
│       └── ...
├── pnpm-workspace.yaml
└── CLAUDE.md
```

Yeni bir oyun eklemek = `server/games/<oyun>/` ve `client/games/<oyun>/`
klasörü eklemek olmalı. Çekirdek kod (oda, lobi, bağlantı) **değişmemeli**.

## EN KRİTİK MİMARİ KURAL: Sunucu otoritesi

Tüm oyun mantığı ve kuralları **sunucuda** çalışır. İstemci sadece gösterir
ve kullanıcı niyetini ("şu taşı at", "taş çek") sunucuya iletir.

- İstemci asla oyun state'inin doğruluğuna karar vermez.
- Her hamle sunucuda doğrulanır: sıra bu oyuncuda mı? bu hamle kurallara uygun mu?
- Bir oyuncuya, görmemesi gereken bilgi (başkasının elindeki taşlar) **gönderilmez**.
  Her oyuncuya sadece kendi görebileceği state'in dilimi yollanır.
- Bunun sebebi hile önleme: istemciye güvenilmez. Bu kural pazarlık konusu değil.

### State dilimi (per-player view) kuralı

Sunucuda tek bir tam `GameState` tutulur. İstemciye **asla** tam state yollanmaz;
bunun yerine saf bir fonksiyondan geçirilir:

```ts
function toPlayerView(state: GameState, playerId: PlayerId): PlayerView
```

- `toPlayerView` **saf** ve **test edilebilir** olmalı — rakip ellerini, çekilecek
  desteyi (sadece sayısını), kapalı bilgileri hiç içermez.
- Bir broadcast yapılacaksa bile her oyuncuya kendi `PlayerView`'i ayrı ayrı gider.
  "Tüm state'i herkese gönder" kalıbı **yasaktır** (en sık görülen hile/bilgi sızıntısı bug'ı).

### Rastgelelik (shuffle/dağıtım)

- Taş karma ve dağıtım **sunucuda** yapılır, kriptografik güvenli RNG ile.
- RNG **enjekte edilebilir** olmalı: testlerde seed'lenebilir bir RNG geçilerek
  deterministik senaryolar yazılabilsin. Oyun mantığı `Math.random`'a doğrudan bağlanmaz.

## Oda / lobi / bağlantı kuralları

- Oyuncu ya açık bir odaya katılır ya da oda kodu/kimliğiyle yeni oda kurar.
- Her odanın kapasitesi, durumu (bekliyor / oynanıyor / bitti) ve sahibi olur.
- **Kimlik:** Şimdilik **hesap sistemi yok** — guest (misafir) takma ad yeterli.
  Oyuncu bir takma ad girer ve kendisine **kalıcı bir oyuncu token'ı** verilir
  (localStorage'da saklanır). Bu token reconnect ve oda üyeliğinin kimliğidir;
  `socket.id` her bağlantıda değiştiği için kimlik olarak **kullanılmaz**.
- **Yeniden bağlanma (reconnect):** Bir oyuncunun bağlantısı koparsa oyun hemen
  bozulmamalı. Kısa bir süre (konfigüre edilebilir grace period) yerini koru;
  oyuncu token'ıyla geri gelirse onu eski koltuğuna oturt ve güncel `PlayerView`'i
  tekrar gönder. Bu, gerçek-zamanlı oyunların en sık atlanan ve en çok bug üreten
  kısmıdır — baştan düşün ve test et.
- Oyuncu çıkarsa/zaman aşımına uğrarsa oyunun ne olacağı her oyun için tanımlı
  olmalı (sıra atla, bot devral, oyunu sonlandır vb.).
- **Turn timeout:** Sıra zaman aşımı çekirdekte ortak bir altyapı olarak durmalı
  (her oyun süre verir, çekirdek sayar ve süre dolunca oyunun kuralına göre davranır).

## Kod kalitesi standartları

Bunlar dile özel değil, mühendislik disiplinidir — TypeScript'te de aynen geçerli:

- **Strict TypeScript.** `tsconfig` strict modda. `any` kullanma; gerçekten
  gerekiyorsa gerekçesini yorum olarak yaz.
- **Tip güvenliği her yerde.** Fonksiyon imzaları ve dönüş tipleri açık.
- **Özel hata sınıfları.** Genel `throw new Error("...")` yerine anlamlı,
  yakalanabilir hata tipleri (örn. `InvalidMoveError`, `RoomFullError`,
  `NotYourTurnError`). Bu hatalar sunucuda yakalanıp istemciye güvenli bir
  hata mesajı olarak çevrilir (stack/iç detay sızdırılmaz).
- **Logging, `console.log` değil.** Yapılandırılmış logger (pino); debug
  çıktıları commit'e girmez.
- **Katmanlı mimari.** Bağlantı/transport katmanı ile oyun mantığı ayrı.
  Socket.IO event handler'ları ince olmalı; iş mantığını servis/motor katmanına
  delege etsin.
- **Saf oyun mantığı.** Oyun kuralları (kim kazandı, bu hamle geçerli mi)
  ağ/Socket.IO'dan bağımsız, saf fonksiyonlar/sınıflar olmalı — böylece ağ
  olmadan birim test edilebilir.
- **Konfigürasyon ortam değişkenlerinden**, kod içine gömülü değil.

## Çalışma prensipleri (Claude için)

- **Kod yazmadan önce planla.** Özellikle yeni bir oyun veya çekirdek özellik
  için, önce kısa bir tasarım/yaklaşım sun, onay al, sonra yaz.
  (superpowers brainstorming akışı bunu zaten zorlar.)
- **YAGNI.** Şu an Okey 101'i çıkarıyoruz. Gelecekteki oyunlar için aşırı
  soyutlama yapma; ama çekirdek/oyun ayrımını da bozma. Denge: çekirdek
  oyun-bağımsız kalsın, ama hayali esneklik için fazladan katman ekleme.
- **Test odaklı.** Oyun kuralları için önce başarısız test yaz, sonra geçir.
  Kritik akışlar (hamle doğrulama, sıra geçişi, kazanma koşulu, reconnect) test edilmeli.
- **Küçük adımlar.** Büyük tek seferlik üretim yerine, doğrulanabilir küçük
  parçalar halinde ilerle.

## Okey 101'e özel notlar (ilk oyun)

- Taş dağıtımı, gösterge taşı, sahte okey, per (seri/grup) doğrulama, "el açma"
  eşiği, ceza puanları — hepsi sunucuda, saf ve test edilebilir mantık olarak.
- Parça tipi `OkeyTile` olarak `server/games/okey/` (ve gerekirse paylaşılan
  istemci tipi olarak `client/games/okey/`) içinde tanımlanır — `shared/`'a
  oyun-özel tip konmaz.
- Her oyuncu sadece kendi taşlarını ve ortak görünen bilgiyi (atılan taş yığını,
  gösterge, kalan deste sayısı) görür. Rakip elleri asla istemciye gönderilmez —
  bu `toPlayerView` ile zorlanır.
- Bu oyunu yazarken ortaya çıkan "oda yönetimi, sıra döngüsü, reconnect, turn
  timeout" gibi her şey çekirdeğe (`core/`) yazılmalı, `games/okey/`'e değil —
  çünkü UNO ve diğerleri bunları aynen kullanacak.

## Çalıştırma / build / test komutları

- `pnpm install` — bağımlılıkları kur.
- `pnpm dev` — server (`:3001`) + client (`:5173`) eşzamanlı.
- `pnpm typecheck` — tüm paketlerde tip kontrolü (project references).
- `pnpm test` — Vitest birim testleri (server core).
- `pnpm lint` — ESLint. `pnpm format` — Prettier.
- `pnpm build` — shared → server + client derleme.

> Playwright E2E (`pnpm test:e2e`) henüz kurulmadı; Okey/UI dilimiyle gelecek.

## Henüz karar verilmemiş / brainstorming'de netleşecek

- ~~Kimlik doğrulama / hesap sistemi~~ → **Karar: şimdilik guest takma ad + kalıcı
  oyuncu token'ı.** Hesap sistemi ileride ayrı bir iş olarak değerlendirilir.
- Kalıcı veri (oyun geçmişi, skor) tutulacak mı, hangi veritabanı?
- Dağıtım/deploy nereye?

Bunlar şimdi çözülmek zorunda değil; Okey 101'in çekirdeği çıkınca netleşir.

## Mevcut durum (2026-06-16)

Okey 101 **baştan sona oynanabilir** (master'da, 164 birim + 3 Playwright E2E testi yeşil).
Tasarım/plan dokümanları: `docs/okey-101-rules.md` (kanonik kurallar) + `docs/superpowers/specs/`
+ `docs/superpowers/plans/`.

Tamamlanan dilimler:
- **1a** saf primitifler (taş/deste/dağıtım/per/çift/puan) — `server/src/games/okey/`
- **1b** saf tur motoru (`applyMove`, `toOkeyPlayerView`, `HandOutcome`)
- **1c** puanlama + maç döngüsü + eşe-katlama (`scoreHand`, `match.ts`)
- **2a** sunucu entegrasyonu (`session.ts`, `handlers.ts`, `contract.ts` — socket, çok-el,
  turn-timeout, reconnect)
- **2b** istemci masası (`client/src/games/okey/` + Room/App teli)
- **Botlar v1** — güvenli auto-play (LLM'siz); oda "Botlarla Doldur"
- **2c** Playwright E2E (`e2e/`, `pnpm test:e2e`): smoke + solo-vs-bots + iki-tarayıcı lobi

Sıradaki olası işler (hiçbiri başlanmadı):
- **Akıllı (sezgisel) bot** — per/çift arayıp açan/bitebilen bot (yine LLM'siz; ayrı dilim).
- Git **remote** kurulup push (kullanıcı GitHub hesabı açınca).
- Dağıtıcı rotasyonu, oyun geçmişi/DB, deploy, reconnect E2E, görsel cila, UNO vb.

> Git remote henüz yok; tüm iş localde master'a `--no-ff` ile merge edildi.
