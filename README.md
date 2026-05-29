# Astroについて
Astroとは、Webサイトを構築するためのフレームワークで、静的サイトジェネレーターの一つです。マルチページアプリケーション（MPA）という仕組みで動いているため、初期表示が早い、クライアント側の負荷軽減、SEO対策など様々な恩恵が得られます。

# 各種リンク
- GitHub: [https://github.com/shuntaro731/cinema-site]
- Figma: [https://www.figma.com/design/1TUjD1Lqm451Ca5JoeEaEv/WF11?node-id=395-30&t=gZQtOxeoaWfdmrLH-1]

# 実行手順
## 必要な環境
- Node.js v22.12.0 以上
- bun

## 1. リポジトリを取得する
Git が入っている場合は、任意の作業用フォルダでこのリポジトリを clone します。
```bash
git clone https://github.com/shuntaro731/goldenweek-site.git
cd goldenweek-site
```

## 2. Node.js を入れる
Node.js が入っていない場合は、Node.js 22 系をインストールしてください。
- 公式サイト: https://nodejs.org/
インストール後、バージョンを確認します。
```bash
node -v
bun -v
```
`node -v` が `v22.12.0` 以上なら問題ありません。

## 3. 依存パッケージを入れる
プロジェクトのルートで次を実行します。
```bash
bun install
```

## 4. 開発サーバーを起動する
```bash
astro dev
```
起動後、表示された URL をブラウザで開くと確認できます。