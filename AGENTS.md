# スタイル記述
- taiwlindで記述する
- remやpxなどはあまり使わず`mb-8`や`text-sm`のようになるべくtailwindの記述に準拠
- 過度なレスポンシブ対策のスタイルなどは実装せず最低限、コードをシンプルに留める

# コメント
- 自分が残したコメントはファイル構造やコードが変わってもなるべく残すように。意味を成してない場合は消す

# リファクタリング
- 未使用コードの削除前に`rg`で参照を確認する
- Astro側のDOM属性・JSON・型を整理するときは、先にクライアント側スクリプトの参照を確認する
- 同じDOM要素のスタイルをSSR（Astroテンプレート）とクライアントJSの両方から書かない。どちらか一方に一本化する

# CRT viewer
- 表示方式はWebGL/Three.jsを維持し、通常の`img`や`video`表示に置き換えない
- `data-crt-root`、`data-crt-canvas`、`data-crt-nav-dot`、`data-index`、`canvas[data-movies]`は表示・操作の契約として扱う
- `canvas[data-movies]`のJSONは`crt-viewer.ts`の`MovieVideo`型と一致させ、未使用データを増やさない
- `BufferGeometry`のindex順や`ShaderMaterial`の描画面設定は、黒画面の原因になるため意図なく変更しない
- fallback画像は動画とWebGLの準備が完了するまで消さない