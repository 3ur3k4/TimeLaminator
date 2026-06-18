# TimeLaminator

binarized video（2値化された映像）の時間軸をZ軸に投影し、3Dプリント可能なSTLメッシュへ変換するWebアプリケーション。

```
入力: f(x, y, t) ∈ {0, 1}   — 2値化されたフレーム列
出力: V(x, y, z) ∈ {0, 1}   — z = t としたボクセルボリューム
```

詳細な要件・設計仕様は [docs/TimeLaminator-requirements.md](docs/TimeLaminator-requirements.md)、開発の経緯は [docs/ProgressSummary.md](docs/ProgressSummary.md) を参照してください。

## 主な機能

- 映像 / 画像シーケンスの読み込み（`.mp4` / `.mov`、解像度上限の自動リサイズ、`ffmpeg.wasm` によるコーデック互換フォールバック）
- ボクセル化 → Marching Cubes によるメッシュ生成
- `meshoptimizer` を用いたメッシュ最適化（頂点ウェルディング、間引き）
- three.js ベースの3Dプレビュー（回転・スケールギズモ、断面表示、メッシュ統計）
- STLエクスポート、プロジェクトの保存 / 読み込み

## 技術スタック

Vue 3（Composition API） / TypeScript / Vite / Pinia / three.js / meshoptimizer / ffmpeg.wasm

## セットアップ

```bash
npm install
```

## 開発サーバー起動

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## プレビュー（ビルド結果の確認）

```bash
npm run preview
```
