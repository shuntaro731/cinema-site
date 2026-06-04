# コードレビュー

## 重大度の凡例

- **[高]** 動作バグ・機能不全
- **[中]** UX劣化・パフォーマンス問題・意図しない見た目
- **[低]** コード品質・アクセシビリティ改善

---

## 1. [高] `Detail.astro` / `crt-detail.ts` — 詳細画面の映画タイトルが取得できない

**ファイル:** `src/components/section/Detail.astro` L29-51, `src/scripts/crt-detail.ts` L134-138

`crt-detail.ts` の `getTitle()` は、詳細パネル内の `h1` から映画タイトルを取得して `document.title` に反映する設計になっている。
しかし、現在の `Detail.astro` には各映画の `h1` が存在せず、`getTitle()` は常に `originalTitle` にフォールバックする。

```ts
const title = panel?.querySelector('h1')?.textContent?.trim();

return title || originalTitle;
```

**影響:** 詳細画面を開いても、ブラウザのタイトルが映画名に更新されない。また、詳細パネル内に映画タイトルのテキスト情報がないため、スクリーンリーダーや画像が表示されない環境で現在の映画を識別しづらい。

**修正案:** 映画タイトルは視覚的に表示しなくてよいため、各 `article` 内に `sr-only` の `h1` を追加する。

```astro
<article ...>
	<div class="mx-auto w-full max-w-6xl px-6 pt-24 pb-24">
		<h1 class="sr-only">{movie.title}</h1>
		<div class="space-y-24">
			...
		</div>
	</div>
</article>
```

---

## 2. [中] `Header.astro` — 無効な Tailwind v4 クラス名

**ファイル:** `src/components/Header.astro` L11, L22

Tailwind v4 では、`@theme { --color-white: #EFEDDE; }` と定義した色は `text-white` / `border-white` として利用する。
現在の `text-color-white` と `border-color-white` は存在しないクラスのため、CSSが生成されない。

```astro
<!-- 現状（無効） -->
<header class="... text-color-white" ...>
<a class="... border-color-white ...">チケットを購入</a>

<!-- 修正 -->
<header class="... text-white" ...>
<a class="... border-white ...">チケットを購入</a>
```

**影響:** ヘッダーのテキスト色は周辺スタイルにより大きく崩れにくいが、「チケットを購入」ボタンのボーダーが意図通りに適用されない可能性がある。

---

## 3. [中] `movies.ts` — 最適化済み動画ファイルが使われていない

**ファイル:** `src/data/movies.ts` L1-3

`src/assets/video/optimized/` に 720p の `.mp4` / `.webm` があるが、現在はオリジナルの重い `.mp4` を読み込んでいる。

```ts
// 現状
import mandalorianMp4 from '../assets/video/mandalorian.mp4?url';
import marioMp4 from '../assets/video/mario.mp4?url';
import pradaMp4 from '../assets/video/prada2.mp4?url';
```

確認時点のファイルサイズは、オリジナルが約 26-47MB、最適化版が約 1.1-3.3MB だった。
`npm run build` でも chunk size warning が出ており、動画差し替えは初期表示と通信量の改善につながる。

**修正案:** WebMを優先し、MP4をフォールバックとして `teaserSources` に渡す。

```ts
import marioMp4 from '../assets/video/optimized/mario-720p.mp4?url';
import marioWebm from '../assets/video/optimized/mario-720p.webm?url';

teaserSources: [
	{ src: marioWebm, type: 'video/webm' },
	{ src: marioMp4, type: 'video/mp4' },
],
```

---

## 4. [低] `MovieNav.astro` — `aria-label` に英語が混在している

**ファイル:** `src/components/MovieNav.astro` L17

動画ナビゲーションの `aria-label` が日本語 UI の中で英語混在になっている。

```astro
<!-- 現状 -->
aria-label={`Movie ${index + 1} に切り替え`}

<!-- 修正 -->
aria-label={`${index + 1}番目の映画に切り替え`}
```

**影響:** 画面表示には影響しないが、スクリーンリーダーで日英混在の読み上げになり、日本語ユーザーにとって少し不自然になる。

---

## 仕様として問題にしない項目

以下は確認済みの仕様により、不具合としては扱わない。

- `ScheduleTable.astro` の行分割は、上映時間ではなく3時間固定の余白を維持する。
- ヘッダーの「チケットを購入」リンクは、現時点では見た目だけでよい。
- 上映時間の予約ボタンは、現時点では見た目だけでよい。

---

## まとめ

| # | ファイル | 問題 | 重大度 |
|---|---------|------|--------|
| 1 | `Detail.astro` / `crt-detail.ts` | `h1` 不在で映画タイトル取得と `document.title` 更新が不完全 | 高 |
| 2 | `Header.astro` | `text-color-white`, `border-color-white` が無効なクラス | 中 |
| 3 | `movies.ts` | 最適化済み動画を使用していない | 中 |
| 4 | `MovieNav.astro` | `aria-label` に英語混在 | 低 |
