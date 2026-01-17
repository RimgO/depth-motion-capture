# モーションキャプチャシステムの仕組み

このドキュメントでは、カメラから人物の動きを検出し、VRMモデルに反映する処理の詳細な仕組みを説明します。

## 目次
1. [システム概要](#システム概要)
2. [使用技術とライブラリ](#使用技術とライブラリ)
3. [処理フロー](#処理フロー)
4. [座標系と変換](#座標系と変換)
5. [角度計算アルゴリズム](#角度計算アルゴリズム)
6. [スムージングとフィルタリング](#スムージングとフィルタリング)
7. [VRMへの適用](#vrmへの適用)

---

## システム概要

本システムは以下の3つの主要コンポーネントで構成されています：

```
カメラ/ビデオ入力 → MediaPipe Holistic → 座標変換・角度計算 → VRM適用
```

### 主要な処理ステップ
1. **入力取得**: Webカメラまたはビデオファイルから映像を取得
2. **姿勢推定**: MediaPipe Holisticで33個の3Dポーズランドマークを検出
3. **座標変換**: MediaPipeの座標系からVRM座標系へ変換
4. **角度計算**: ベクトル演算により各関節の回転角度を計算
5. **スムージング**: Low-Pass FilterとTemporal Smoothingで動きを滑らかに
6. **VRM適用**: 計算した角度をVRMのボーン回転に適用

---

## 使用技術とライブラリ

### 1. MediaPipe Holistic
- **役割**: リアルタイム姿勢推定（Pose + Hands + Face）
- **出力**: 
  - `poseLandmarks`: 2D座標（画像平面上）33点
  - `za` (poseWorldLandmarks): 3D座標（実世界空間）33点
  - `leftHandLandmarks`, `rightHandLandmarks`: 手のランドマーク各21点
  - `faceLandmarks`: 顔のランドマーク468点

### 2. Three.js + VRM
- **Three.js**: 3Dレンダリングエンジン
- **@pixiv/three-vrm**: VRMモデルのロードと制御
- **VRM Humanoid Bones**: 標準化されたボーン構造

### 3. カスタム幾何学計算
- **ベクトル演算**: 関節間の角度を計算
- **三角関数**: `atan2`, `acos`を使用した角度抽出
- **内積**: 肘の曲げ角度の計算に使用

---

## 処理フロー

### 1. MediaPipe初期化とグローバルシングルトン

```javascript
const getGlobalHolistic = () => {
    const holistic = new Holistic({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
    });
    
    holistic.setOptions({
        modelComplexity: 2,          // 高精度モード
        smoothLandmarks: true,       // MediaPipe内部のスムージング
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.7,  // 高いトラッキング信頼度
        refineFaceLandmarks: true,
    });
    
    return holistic;
};
```

**重要なポイント**:
- グローバルシングルトンパターンで複数のWASM初期化を防止
- `modelComplexity: 2` で最高精度の3D推定を使用
- `smoothLandmarks: true` でMediaPipe側でも平滑化

### 2. 結果処理ハンドラ

```javascript
holistic.onResults((results) => {
    // results.za: MediaPipeの3D world landmarks (33点)
    // results.poseLandmarks: 2D座標
    // results.leftHandLandmarks, rightHandLandmarks: 手
    // results.faceLandmarks: 顔
});
```

### 3. ランドマークのフィルタリング

```javascript
class LowPassFilter {
    filter(value) {
        const alpha = this.smoothing; // 0.3-0.8
        const hatX = {};
        for (const key in value) {
            hatX[key] = alpha * this.hatXPrev[key] + (1 - alpha) * value[key];
        }
        this.hatXPrev = hatX;
        return hatX;
    }
}
```

**役割**: 高周波ノイズ（ジッター）を除去し、ランドマーク座標を安定化

---

## 座標系と変換

### MediaPipe座標系
```
X軸: 右方向が正（画面右）
Y軸: 下方向が正（重力方向）← 重要！
Z軸: カメラに向かって正（手前）
```

### VRM座標系（Three.js）
```
X軸: 右方向が正
Y軸: 上方向が正（重力の逆）
Z軸: 手前方向が正
```

### 座標変換の実装

```javascript
// MediaPipe → VRM への座標変換
hips.position.set(
    -riggedPose.Hips.worldPosition.x,  // X軸反転
    riggedPose.Hips.worldPosition.y + 1.0,  // Y軸はそのまま、オフセット追加
    -riggedPose.Hips.worldPosition.z   // Z軸反転
);
```

**重要**: MediaPipeのY軸は下向きが正なので、`-dy`を使用することで上向きの動きを正として扱う。

---

## 角度計算アルゴリズム

### 腕の上下運動（Upper Arm Z軸回転）

#### 1. ベクトルの定義
```javascript
// 肩から肘へのベクトル
const dx = rElbow.x - rShoulder.x;  // 水平方向（左右）
const dy = rElbow.y - rShoulder.y;  // 垂直方向（上下）← MediaPipeは下が正
const dz = rElbow.z - rShoulder.z;  // 奥行き方向（前後）
```

#### 2. 水平距離の計算
```javascript
// XZ平面上の距離（水平面上の距離）
const horizontalDist = Math.sqrt(dx*dx + dz*dz);
```

この計算により、腕の前後と左右の動きを統合した「水平面上の距離」を取得します。

#### 3. 垂直軸からの角度計算
```javascript
// 重力方向（垂直軸）からの角度
// atan2(水平距離, -垂直距離)
const angleZ = Math.atan2(horizontalDist, -dy);
```

**なぜ `-dy` を使うのか？**
- MediaPipeでは下向きが正（dy > 0 = 腕が下）
- 腕を上げると dy < 0（負の値）
- `-dy`を使うことで、腕を上げた時に正の角度になる

#### 4. VRM座標系へのマッピング

```javascript
// 左腕
riggedPose.LeftUpperArm.z = angleZ - Math.PI/2;

// 右腕（左右対称のため符号反転）
riggedPose.RightUpperArm.z = -(angleZ - Math.PI/2);
```

**角度範囲**:
- `angleZ`: 0 ～ π (0° ～ 180°)
  - 0°: 腕が真下
  - 90°: 腕が水平
  - 180°: 腕が真上
- `angleZ - π/2`: -π/2 ～ π/2 (-90° ～ +90°)
  - VRMの標準的な回転範囲にマッピング

### 腕の前後運動（Upper Arm X軸回転）

```javascript
if (horizontalDist > 0) {
    // dz: 奥行き（前後方向）
    // dx: 左右方向
    const angleX = Math.atan2(dz, Math.abs(dx)) * 0.5;
    riggedPose.RightUpperArm.x = angleX;
}
```

**0.5倍の理由**: 前後の動きを過度に反映すると不自然になるため、感度を下げる。

### 肘の曲げ（Lower Arm Z軸回転）

#### 1. 上腕・前腕ベクトルの定義
```javascript
// 上腕ベクトル（肩→肘）
const dx = rElbow.x - rShoulder.x;
const dy = rElbow.y - rShoulder.y;
const dz = rElbow.z - rShoulder.z;
const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);

// 前腕ベクトル（肘→手首）
const lowerDx = rWrist.x - rElbow.x;
const lowerDy = rWrist.y - rElbow.y;
const lowerDz = rWrist.z - rElbow.z;
const lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
```

#### 2. 内積を使った角度計算
```javascript
// 2つのベクトルの内積
const dot = dx*lowerDx + dy*lowerDy + dz*lowerDz;

// cos(θ) = (A·B) / (|A||B|)
const cosTheta = dot / (upperLen * lowerLen);

// 角度の取得（逆余弦）
const elbowAngle = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
```

**Math.max(-1, Math.min(1, ...))の理由**: 
- 浮動小数点誤差で|cosTheta| > 1になることを防ぐ
- acosの定義域は [-1, 1]

#### 3. VRMへの適用

```javascript
// 左腕: 負の値で曲げを表現
riggedPose.LeftLowerArm.z = -elbowAngle;

// 右腕: 正の値で曲げを表現（左右非対称）
riggedPose.RightLowerArm.z = elbowAngle;
```

**角度範囲**:
- `elbowAngle`: 0 ～ π (0° ～ 180°)
  - 0°: 腕が真っ直ぐ（伸びている）
  - π (180°): 腕が完全に曲がっている

**左右で符号が異なる理由**:
- VRMモデルの左右のボーンの回転方向の定義が異なるため
- 左腕: 負の値で曲げ
- 右腕: 正の値で曲げ

---

## スムージングとフィルタリング

### 1. Low-Pass Filter（ランドマークレベル）

```javascript
class LowPassFilter {
    constructor(smoothing = 0.3) {
        this.smoothing = smoothing;
        this.hatXPrev = null;
    }
    
    filter(value) {
        const alpha = this.smoothing;
        const hatX = {};
        for (const key in value) {
            hatX[key] = alpha * this.hatXPrev[key] + (1 - alpha) * value[key];
        }
        return hatX;
    }
}
```

**適用レベル**: 各ランドマーク座標に個別に適用
**効果**: 高周波のジッター（細かい震え）を除去

### 2. Temporal Smoothing（回転角度レベル）

```javascript
const smoothingFactor = 0.5;  // 0=スムージングなし, 1=完全スムージング

const smoothRotation = (current, previous, key) => {
    ['x', 'y', 'z'].forEach(axis => {
        current[key][axis] = previous[key][axis] + 
                            (current[key][axis] - previous[key][axis]) * (1 - smoothingFactor);
    });
};
```

**適用レベル**: 計算された回転角度に適用
**効果**: フレーム間の急激な変化を緩和

### 3. Quaternion Slerp（VRM適用レベル）

```javascript
const setRotation = (name, rotation, lerpAmount = 0.8) => {
    const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
    );
    bone.quaternion.slerp(targetQuat, lerpAmount);
};
```

**適用レベル**: VRMのボーン回転に適用
**効果**: 
- Quaternion球面線形補間で自然な回転
- `lerpAmount = 0.8`: 80%を新しい値、20%を前の値でブレンド

### スムージングの3層構造

```
レイヤー1: Low-Pass Filter (座標レベル) → ジッター除去
    ↓
レイヤー2: Temporal Smoothing (角度レベル) → 急激な変化の緩和
    ↓
レイヤー3: Quaternion Slerp (VRM適用レベル) → 自然な回転補間
```

---

## VRMへの適用

### 1. ボーン名のマッピング

MediaPipeランドマーク → VRM Humanoid Bones

| MediaPipe | VRM Humanoid Bone | 説明 |
|-----------|-------------------|------|
| 肩(11,12) | rightShoulder, leftShoulder | 鎖骨 |
| 肘(13,14) | rightUpperArm, leftUpperArm | 上腕 |
| 手首(15,16) | rightLowerArm, leftLowerArm | 前腕 |
| 手首(15,16) | rightHand, leftHand | 手 |
| 腰(23,24) | hips | 腰 |
| - | spine | 脊椎 |

### 2. 回転の適用

```javascript
const setRotation = (name, rotation, lerpAmount = 0.8) => {
    const bone = vrm.humanoid.getNormalizedBoneNode(name);
    if (bone && rotation) {
        // オイラー角からクォータニオンへ変換
        const targetQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
        );
        // 球面線形補間で滑らかに適用
        bone.quaternion.slerp(targetQuat, lerpAmount);
    }
};
```

### 3. 位置の適用（Hipsのみ）

```javascript
if (riggedPose.Hips) {
    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    hips.position.set(
        -riggedPose.Hips.worldPosition.x,
        riggedPose.Hips.worldPosition.y + 1.0,  // 地面からのオフセット
        -riggedPose.Hips.worldPosition.z
    );
}
```

**位置を適用するのはHipsのみの理由**:
- VRMのヒューマノイドリグはHipsをルートとした階層構造
- 他のボーンは回転のみで制御
- Hipsの位置で全身の位置が決まる

---

## デバッグとログ

### 角度のデバッグログ

```javascript
if (Math.random() < 0.02) {  // 2%の確率でログ出力
    console.log(`[Right Arm] angleZ: ${(angleZ * 57.3).toFixed(1)}°, ` +
                `VRM.z: ${(riggedPose.RightUpperArm.z * 57.3).toFixed(1)}°, ` +
                `dy: ${dy.toFixed(3)}, horizontalDist: ${horizontalDist.toFixed(3)}`);
}
```

**57.3の意味**: ラジアンから度への変換係数 (180/π ≈ 57.3)

### モーションデータの記録

```javascript
recordedDataRef.current.push({
    t: Date.now(),
    input: riggedPose,           // 計算された角度
    output: finalPose,           // VRMに適用された角度
    rawLandmarks: landmarks,     // 生のランドマーク
    worldLandmarks: worldLandmarks  // 3D座標
});
```

---

## パフォーマンス最適化

### 1. グローバルシングルトン
- MediaPipe Holisticインスタンスを使い回し
- WASM再初期化を防止
- メモリリークを回避

### 2. 条件付きレンダリング
```javascript
if (Math.random() < 0.016) {  // ~60フレームに1回
    console.log('[resultsHandler] Processing...');
}
```

### 3. 選択的適用
```javascript
if (captureSettings?.captureLowerBody) {
    // 下半身の処理は必要な時のみ
}
```

---

## まとめ

本システムの強みは以下の点にあります：

1. **高精度な3D推定**: MediaPipe Holistic の `za` プロパティによる実世界3D座標
2. **カスタム幾何学計算**: ライブラリに依存しない柔軟な角度計算
3. **多層スムージング**: 3段階のフィルタリングで滑らかな動き
4. **座標系の適切な変換**: MediaPipeとVRMの座標系の違いを正確に処理
5. **左右非対称の対応**: VRMモデルの左右のボーン定義の違いに対応

### 現在の制限事項

- **手・指のトラッキング**: 未実装（ランドマークは取得済み）
- **顔の表情**: 未実装（ランドマークは取得済み）
- **下半身**: 基本的な実装のみ

### 今後の改善点

1. 手と指の21ランドマークを使った詳細なハンドトラッキング
2. 顔の468ランドマークを使った表情制御（VRM Blend Shapes）
3. 下半身（脚、足首）の詳細なトラッキング
4. より高度なスムージングアルゴリズム（Kalman Filter等）
5. 複数人の同時トラッキング

---

**作成日**: 2026年1月17日  
**バージョン**: 1.0  
**対応コード**: MotionCapturer.jsx
