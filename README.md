# Depth Motion Capture

リアルタイム3Dモーションキャプチャシステム - MediaPipe Holistic + Three.js + VRM

## 概要

Webブラウザ上で動作する高精度なモーションキャプチャシステムです。Webカメラや画面キャプチャから人体の姿勢・顔表情・手指の動きをリアルタイムに検出し、VRMアバターに反映させます。

## 主な機能

### 入力ソース
- **Webカメラ**: リアルタイム自撮りモーションキャプチャ
- **画面キャプチャ**: 他のアプリケーションウィンドウの映像をキャプチャ（動画再生アプリ、ビデオ会議ツールなど）

### モーションキャプチャ
- **全身トラッキング**: MediaPipe Holisticによる33点の3D姿勢推定
- **顔表情**: 468点のフェイスランドマーク + 虹彩トラッキング
- **手指追跡**: 左右の手それぞれ21点の3Dトラッキング
- **VRMアバター連動**: リアルタイムでアバターに反映

### 記録・分析
- **モーション記録**: JSON形式でモーションデータを保存
- **リアルタイムメトリクス**: 信頼度、レイテンシ、安定性の可視化
- **デバッグパネル**: 詳細なログとランドマーク表示

## 技術スタック

- **フレームワーク**: React 18 + Vite
- **3Dレンダリング**: Three.js + @pixiv/three-vrm
- **AI/ML**: MediaPipe Holistic (WASM)
- **モーションリギング**: Kalidokit
- **UI**: Tailwind CSS + Framer Motion

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build
```

## 使い方

1. **入力ソースの選択**
   - サイドバーの「Webcam Feed」をクリック: Webカメラを使用
   - 「Screen Capture」をクリック: 画面共有（他のウィンドウをキャプチャ）

2. **VRMアバターの読み込み**
   - 「Upload VRM」から.vrmファイルをアップロード
   - または「Load Test Avatar」でサンプルアバターを読み込み

3. **モーション記録**
   - 「Start Recording」でモーションデータの記録を開始
   - 「Stop Recording」で記録を停止し、JSONファイルをダウンロード

4. **設定調整**
   - **Lower Body Capture**: 下半身トラッキングのON/OFF
   - **Debug Logging**: デバッグログの表示レベル調整

## 画面キャプチャの活用例

画面キャプチャ機能を使うと、様々なコンテンツからモーションキャプチャが可能です:

- YouTube/ニコニコ動画などの動画サイト
- Zoom/Google Meetなどのビデオ会議
- ローカル動画プレイヤー
- ゲーム画面
- 他のWebアプリケーション

**手順:**
1. 「Screen Capture」ボタンをクリック
2. ブラウザのダイアログで共有したいウィンドウ/タブを選択
3. リアルタイムでモーションキャプチャが開始されます

## デバッグ機能

- **Neural Panel**: リアルタイムメトリクスと2Dランドマーク表示
- **Analysis Log**: AI判定の履歴表示
- **Stability Graph**: トラッキング安定性の時系列グラフ

## ブラウザ対応

- Chrome/Edge 94+（推奨）
- Firefox 90+
- Safari 15+（一部機能制限あり）

## ライセンス

MIT License

## 関連プロジェクト

- [MediaPipe](https://google.github.io/mediapipe/)
- [Three.js](https://threejs.org/)
- [three-vrm](https://github.com/pixiv/three-vrm)
- [Kalidokit](https://github.com/yeemachine/kalidokit)
