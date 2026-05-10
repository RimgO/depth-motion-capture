# Depth Motion Capture

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r167-black.svg)](https://threejs.org/)

リアルタイム3Dモーションキャプチャシステム - MediaPipe Holistic + Three.js + VRM

## 概要

Webブラウザ上で動作するプロフェッショナルなモーションキャプチャシステムです。Webカメラや画面キャプチャから人体の姿勢・顔表情・手指の動きをリアルタイムに検出し、VRMアバターに高精度で反映させます。

## 主な機能

### 1. 多彩な入力ソース
- **Webカメラ**: リアルタイム自撮りモーションキャプチャ
- **画面キャプチャ**: ブラウザの別タブ、デスクトップウィンドウ、動画再生プレイヤーなどの映像を直接キャプチャしてトラッキング可能。

### 2. 高精度モーションリギング (Refined Rigging)
- **独自の上腕ねじれ補正**: 腕を下げた際の関節の歪みを解消するY/XZ分離回転アルゴリズムを搭載。
- **手指の自然な追従 (Enhanced Finger Tracking)**: Holistic `modelComplexity: 2` の採用と、VRM 1.0のボーン構造に最適化されたマッピングにより、複雑な手指の動きを遅延なく再現。
- **視線トラッキング**: 虹彩の動きを検出し、アバターの視線にリアルタイムに反映。
- **MediaPipe `za` (World Landmarks) 活用**: 従来の正規化座標に加え、実際のメートル単位の3D座標（World Landmarks）を使用することで、奥行きのある自然な動きを実現。

### 3. Integrated Debug Skeleton
- **3D 統合デバッグ表示**: 体本体のスケルトンに詳細な手指のランドマーク（21点）を手首で動的に結合。
- **リアルタイム・フィードバック**: アバターのボーン位置とMediaPipeの推定位置を同時に視覚化し、リギングの整合性を即座に確認可能。
- **ノイズ除去**: 検出漏れ時に発生する座標の飛び（原点回帰）を自動的にフィルタリング。

### 4. Twin Mode (遠隔同期)
- **セパレート・レンダリング**: `BroadcastChannel API` を使用し、キャプチャ用のメインウィンドウとは別のウィンドウでアバターをフルスクリーン表示可能。OBS等の配信ツールでの取り込みに最適です。

### 4. AI Monitoring & Analysis
- **AIポーズ判定**: 現在のポーズやアクション（挙手、Tポーズ、スクワット等）をAIがリアルタイムにラベル付け。
- **メトリクス可視化**: トラッキングの信頼度、推論レイテンシ、フレーム安定性をグラフでモニタリング。
- **モーション記録**: JSON形式でキャプチャデータを保存し、後で再利用可能。

## 技術スタック

- **Core**: React 18 + Vite
- **3D Engine**: Three.js + @pixiv/three-vrm
- **AI/ML**: MediaPipe Holistic (WASM)
- **Rigging Solver**: Kalidokit + Custom Math Logic
- **UI**: Tailwind CSS + Framer Motion + Lucide React

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

1. **ソースメディアの選択**
   - 「Webcam Feed」: Webカメラを使用します。
   - 「Screen Capture」: 画面共有ダイアログからキャプチャしたい対象を選択します。

2. **VRMアバターの読み込み**
   - 「Upload VRM / GLB」から自分のモデルをアップロード。
   - または「Load Test Avatar」で即座に動作確認。

3. **Twin Mode の起動**
   - URLに `?mode=twin` を付けて開く（またはメイン画面のリンクから）ことで、レンダリング専用ウィンドウが立ち上がります。

4. **記録とデバッグ**
   - 「Start Recording」でモーションデータの保存。
   - 「Debug Logging」を有効にすると、コンソールおよびHUDに詳細なAI推論データが表示されます。

## ライセンス

MIT License

## 関連プロジェクト

- [MediaPipe](https://google.github.io/mediapipe/)
- [Three.js](https://threejs.org/)
- [three-vrm](https://github.com/pixiv/three-vrm)
- [Kalidokit](https://github.com/yeemachine/kalidokit)
- [aituber-kit](https://github.com/aicu-ai/aituber-kit) - 本プロジェクトのロジックが統合されているメインプロジェクト
