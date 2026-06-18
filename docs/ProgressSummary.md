# 開発進捗サマリー

| フェーズ | 内容 | 主要ファイル |
|----------|------|--------------|
| **1‑3** | - Vite + Vue 3（TypeScript）プロジェクトを作成<br>- 3 カラム UI（`AppLayout.vue` 等）実装<br>- ビデオフレーム抽出 (`CanvasVideoProcessor.ts`)、ボクセル化 (`Voxelizer.ts`)、メッシュ生成 (`MarchingCubesGenerator.ts`) を実装 | `src/core/*` |
| **4‑5** | - メッシュ最適化サービス (`MeshOptimizerService.ts`) を追加（`meshoptimizer` 使用）<br>- STL エクスポートサービス (`STLExporterService.ts`) を追加（Three.js `STLExporter`）<br>- UI にエクスポートボタン、メッシュ統計オーバーレイ、回転スライダー（X=-90°）を統合 | `src/core/services/MeshOptimizerService.ts`<br>`src/core/services/STLExporterService.ts` |
| **バグ修正** | 1. `meshoptimizer` のインポートパスが不正だったため、`import { MeshoptSimplifier } from 'meshoptimizer/simplifier';` に修正<br>2. `MeshoptSimplifier.simplify` の戻り値から未使用変数 `error` を除去（TS6133）<br>3. `STLExporterService` の `Blob` 作成時に `DataView` → `ArrayBuffer` にキャストし、型エラー（TS2322）を解消 | `src/core/services/MeshOptimizerService.ts`<br>`src/core/services/STLExporterService.ts` |
| **ビルド/デプロイ** | - `npm run build` が成功し、`dist/` が生成<br>- `npm run dev` がバックグラウンドで起動中。ポート **5174** でローカルサーバーが動作中（`http://localhost:5174/`） |  |
| **UI 状態** | - ビデオロード → ボクセル化 → メッシュ生成 → 最適化 → STLエクスポートまでのフローが一通り動作<br>- 回転スライダーで X 軸を -90° に固定し、プレビュー方向を修正済み<br>- 追加のスライダーでオブジェクトの向き調整が可能 | `src/components/*`（UI コンポーネント） |
| **コード品質** | - SOLID 原則に沿ったインターフェース (`src/core/interfaces/`) を導入<br>- 変更点は全て TypeScript コンパイルを通過し、ビルドエラーなし |  |
| **6（ギズモ操作）** | - メッシュの回転・スケールを Blender 風ギズモでドラッグ操作可能に<br>- 数値入力フィールドでも直接ドラッグ・編集可能に | `src/components/*`（ビューポート/プロパティ系コンポーネント） |
| **7（解像度制限・プレビュー）** | - 映像をボクセル化する前に解像度上限を適用し、規定値（既定 512px、長辺基準）を超える映像は自動的にダウンスケールするように変更<br>- 上限値はパラメータ化し、UI から変更可能に（`maxResolution`）<br>- 変更時は再デコードが必要なため、専用の debounce ウォッチャーを追加<br>- SOURCE パネル下部に選択した映像のプレビュー枠（`<video>` 要素）を追加 | `src/core/services/CanvasVideoProcessor.ts`<br>`src/stores/useParameterStore.ts`<br>`src/stores/useProjectStore.ts`<br>`src/components/panels/ProjectSettingsPanel.vue` |
| **8（コーデック対応・バグ修正）** | 1. 一部の `.mov` で `videoWidth`/`videoHeight` が 0 のまま `getImageData` が呼ばれ `IndexSizeError` が発生する不具合を修正（`loadeddata` イベントでの再試行とエラーメッセージ改善）<br>2. Apple ProRes 書き出しの `.mov` がブラウザの `<video>` 要素ではデコード不可（コーデック非対応）という根本原因が判明<br>3. **`ffmpeg.wasm` によるソフトウェアデコードのフォールバックを本格実装**（ユーザー選定の方針）。`CanvasVideoProcessor`（ネイティブ・高速）が失敗した場合のみ `FFmpegVideoProcessor`（WASM・低速だが互換性が高い）に自動フォールバックする二段構成<br>4. `@ffmpeg/core@0.12.10`（ESM ビルド）を CDN から動的ロードし、`ffprobe` で解像度取得後 `exec` で RGBA 生フレームに変換する実装に確定（`0.12.6` は ffprobe 非搭載・UMD ビルド不可だったため変更）<br>5. この ffmpeg.wasm ビルドの `ffprobe` は戻り値の exit code が信頼できない（成功時でも `-1` を返すケースを確認）ため、`probe.txt` の実際の内容で成功判定するロジックに修正<br>6. 実際に生成した ProRes `.mov` テストファイルで、フォールバック経由のフルパイプライン（デコード→メッシュ生成）が正常完了することを確認済み | `src/core/services/CanvasVideoProcessor.ts`<br>`src/core/services/FFmpegVideoProcessor.ts`（新規）<br>`src/core/interfaces/IVideoProcessor.ts`<br>`src/stores/useProjectStore.ts`<br>`src/components/panels/ProjectSettingsPanel.vue` |

### 現在の状態
- 開発サーバーが正常に立ち上がっており、ローカルで UI を操作可能です。  
- 主要機能（ビデオ → 3D メッシュ → STL エクスポート）は一通りテスト済みです。  
- H.264 等のブラウザネイティブ対応コーデックは高速パス（`CanvasVideoProcessor`）、Apple ProRes 等の非対応コーデックは `ffmpeg.wasm` フォールバック（`FFmpegVideoProcessor`）で、どちらも問題なくデコードできることを確認済みです。
- 今後は **パフォーマンス最適化**（特に ffmpeg.wasm 初回ロード時間やバンドルサイズ）、**UI のデザイン微調整**、**テストケース追加** などを進める予定です。

> **ClaudeCode へ引き継ぎ**
> 以上が現在までの開発経緯と実装状況です。ClaudeCode が次のステップ（例：高度な最適化や UI の洗練）に取り掛かる際の参考にしてください。
