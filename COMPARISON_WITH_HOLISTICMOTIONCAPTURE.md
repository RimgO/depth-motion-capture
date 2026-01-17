# 本プロジェクトとHolisticMotionCaptureの比較

このドキュメントでは、本プロジェクト（WebベースReact/Three.js）と、GitHubの[HolisticMotionCapture](https://github.com/creativeIKEP/HolisticMotionCapture)（Unityベース）の技術的な違いを説明します。

## 目次
1. [プロジェクト概要](#プロジェクト概要)
2. [実行環境とプラットフォーム](#実行環境とプラットフォーム)
3. [MediaPipe統合の違い](#mediapipe統合の違い)
4. [VRM制御の方式](#vrm制御の方式)
5. [角度計算アルゴリズム](#角度計算アルゴリズム)
6. [手・指トラッキング](#手指トラッキング)
7. [顔表情トラッキング](#顔表情トラッキング)
8. [パフォーマンスとスムージング](#パフォーマンスとスムージング)
9. [アーキテクチャの違い](#アーキテクチャの違い)
10. [まとめ：使い分けのポイント](#まとめ使い分けのポイント)

---

## プロジェクト概要

### 本プロジェクト（depth-motion-capture）
- **目的**: Webブラウザで動作する軽量モーションキャプチャ
- **技術スタック**: React + Three.js + MediaPipe Holistic (JavaScript)
- **対象**: Webアプリケーション、ビデオ会議、オンラインイベント
- **配布形態**: Webアプリとして即座に利用可能

### HolisticMotionCapture
- **目的**: Unityエディタ・スタンドアロンアプリケーション
- **技術スタック**: Unity + Barracuda + HolisticBarracuda (C#)
- **対象**: VTuber配信、Unityゲーム開発、ビデオ制作
- **配布形態**: Windowsインストーラー / macOSインストーラー / Unity Package

---

## 実行環境とプラットフォーム

### 本プロジェクト

| 項目 | 詳細 |
|------|------|
| **実行環境** | Webブラウザ (Chrome, Edge, Firefox, Safari) |
| **OS** | Windows, macOS, Linux, iOS, Android |
| **インストール** | 不要（URLにアクセスするだけ） |
| **MediaPipe** | CDN経由でWASMモジュールを読み込み |
| **GPU** | WebGLによる自動GPU活用 |
| **カメラ** | `getUserMedia` APIで直接アクセス |

**利点**:
- インストール不要、即座に使用開始
- クロスプラットフォーム対応
- モバイルデバイスでも動作可能

**制約**:
- ブラウザのセキュリティポリシーに制約される
- ネットワーク接続が必要（初回読み込み時）
- ブラウザのパフォーマンスに依存

### HolisticMotionCapture

| 項目 | 詳細 |
|------|------|
| **実行環境** | Unity Editor / Standalone Application |
| **OS** | Windows, macOS |
| **インストール** | インストーラー実行が必要 |
| **MediaPipe** | HolisticBarracuda (Unity Barracuda版) |
| **GPU** | UnityのBarracudaエンジン（ONNX） |
| **カメラ** | `WebCamTexture` クラス |
| **出力** | Virtual Camera (Windows) / Syphon (macOS) |

**利点**:
- ネイティブアプリとして高速動作
- Virtual Camera経由で他アプリに配信可能
- Unityエディタで直接VRMを編集可能

**制約**:
- インストールが必要
- OSごとに異なるビルドが必要
- モバイル非対応

---

## MediaPipe統合の違い

### 本プロジェクト: MediaPipe Holistic (JavaScript)

```javascript
// CDN経由でMediaPipeをロード
const holistic = new Holistic({
    locateFile: (file) => 
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
});

holistic.setOptions({
    modelComplexity: 2,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.7,
});

// カメラからフレームを送信
await holistic.send({ image: videoElement });

// 結果を受信
holistic.onResults((results) => {
    // results.za: 3D world landmarks
    // results.poseLandmarks: 2D landmarks
    const worldLandmarks = results.za;
    // VRMに適用
});
```

**特徴**:
- JavaScriptのMediaPipe公式ライブラリを使用
- WASMモジュールとして実行（ブラウザ内で推論）
- `results.za` プロパティで3D座標を取得
- WebGLによるGPU加速

### HolisticMotionCapture: HolisticBarracuda (Unity/Barracuda)

```csharp
// HolisticBarracudaをUnityで初期化
HolisticPipeline holisticPipeline = new HolisticPipeline(BlazePoseModel.full);

// WebCamTextureから画像を取得
WebCamTexture webCam = new WebCamTexture("Camera Name", width, height);

// 推論実行
holisticPipeline.ProcessImage(
    webCam, 
    HolisticInferenceType.full,
    BlazePoseModel.full
);

// 結果を取得
var landmarks = holisticPipeline.GetPoseWorldLandmark(index);
```

**特徴**:
- Unityの**Barracuda**エンジンでONNXモデルを実行
- MediaPipeモデルをBarracuda用に変換したもの
- Unityのテクスチャとシームレスに統合
- ComputeShaderによるGPU加速

---

## VRM制御の方式

### 本プロジェクト: Three.js + @pixiv/three-vrm

```javascript
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';

// VRMロード
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
const gltf = await loader.loadAsync('model.vrm');
const vrm = gltf.userData.vrm;

// ボーン回転の適用
const bone = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
if (bone) {
    const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
    );
    bone.quaternion.slerp(targetQuat, 0.8); // 球面線形補間
}
```

**制御方法**:
- Three.jsの`Quaternion`と`Euler`で直接ボーン回転を制御
- `slerp`（球面線形補間）で滑らかな動き
- JavaScriptでカスタム角度計算を実装

### HolisticMotionCapture: Unity Animator + HumanPoseHandler

```csharp
// Unity Animatorを使用
Animator avatar = GetComponent<Animator>();

// HumanPoseHandlerでボーン制御
HumanPoseHandler handler = new HumanPoseHandler(
    avatar.avatar, 
    avatar.transform
);

HumanPose pose = new HumanPose();
handler.GetHumanPose(ref pose);

// ボーン回転を適用
Transform bone = avatar.GetBoneTransform(HumanBodyBones.RightUpperArm);
bone.rotation = Quaternion.Lerp(
    bone.rotation, 
    targetRotation, 
    lerpPercentage
);

handler.SetHumanPose(ref pose);
```

**制御方法**:
- Unityの`HumanPoseHandler`で標準化されたボーン制御
- `HumanBodyBones`列挙型で統一的なボーン管理
- UnityのAnimatorシステムと完全統合
- `Muscles`配列による指の詳細制御

---

## 角度計算アルゴリズム

### 本プロジェクト: カスタム幾何学計算

```javascript
// 完全にカスタム実装（ライブラリ非依存）
const dx = rElbow.x - rShoulder.x;
const dy = rElbow.y - rShoulder.y;
const dz = rElbow.z - rShoulder.z;

// 水平距離（X+Z）
const horizontalDist = Math.sqrt(dx*dx + dz*dz);

// 垂直軸からの角度
const angleZ = Math.atan2(horizontalDist, -dy);

// VRMへマッピング
riggedPose.RightUpperArm.z = -(angleZ - Math.PI/2);

// 肘の曲げ（内積）
const dot = dx*lowerDx + dy*lowerDy + dz*lowerDz;
const elbowAngle = Math.acos(dot / (upperLen * lowerLen));
riggedPose.RightLowerArm.z = elbowAngle;
```

**アプローチ**:
- **純粋なベクトル幾何学**
- `atan2`と`acos`による角度抽出
- MediaPipe座標系からVRM座標系への明示的な変換
- 左右の腕で異なる符号処理

**利点**:
- 完全に制御可能
- デバッグしやすい
- 特定の用途に最適化可能

**制約**:
- 手動で全ての計算を実装
- エッジケースの処理が必要

### HolisticMotionCapture: Joint継承構造 + Quaternion.LookRotation

```csharp
// Joint構造体でボーンチェーンを管理
public struct Joint
{
    public HumanBodyBones bone;
    public Quaternion initRotation;
    public Quaternion inverseRotation;
    // ...
}

// Quaternion.LookRotationで回転を計算
Vector3 toChild = RotateHandLandmark(boneLandmarkIndex + 1) - 
                  RotateHandLandmark(boneLandmarkIndex);
var rot = Quaternion.LookRotation(-toChild, handForward) * 
          handJoint.inverseRotation * 
          handJoint.initRotation;

// ボーンに適用
boneTrans.rotation = Quaternion.Lerp(
    boneTrans.rotation, 
    avatar.GetBoneTransform(HumanBodyBones.Hips).rotation * rot, 
    lerpPercentage
);
```

**アプローチ**:
- **Unity標準のQuaternion演算**
- `Quaternion.LookRotation`で方向ベクトルから回転を計算
- ボーンチェーン全体の初期回転を保持
- 階層的な回転の合成

**利点**:
- Unityエンジンの最適化された演算
- 複雑なボーン階層に対応しやすい
- ジンバルロックの問題が少ない

**制約**:
- Unity固有の実装
- 内部処理がブラックボックス

---

## 手・指トラッキング

### 本プロジェクト: 未実装（ランドマークは取得済み）

```javascript
// MediaPipeから手ランドマークは取得されている
if (results.leftHandLandmarks) {
    // 21点のランドマーク
    // TODO: 指の関節角度を計算してVRMに適用
}
if (results.rightHandLandmarks) {
    // 21点のランドマーク
    // TODO: 実装予定
}
```

**現状**: 
- ランドマークは取得されているが、VRM指ボーンへの適用は未実装
- オーバーレイには描画されている

### HolisticMotionCapture: 完全実装

```csharp
// 手の初期化
void HandInit() {
    PerHandInit(true);   // 左手
    PerHandInit(false);  // 右手
}

// 各指ごとのボーンリスト
HumanBodyBones[] thumbList = { 
    wrist, 
    LeftThumbProximal, 
    LeftThumbIntermediate, 
    LeftThumbDistal 
};
// index, middle, ring, littleも同様

// 手の回転計算
Vector3 handDirection = RotateHandLandmark(middleProximal) - 
                        RotateHandLandmark(wrist);
Vector3 wristToIndex = RotateHandLandmark(indexProximal) - 
                       RotateHandLandmark(wrist);
Vector3 handUp = Vector3.Cross(handDirection, wristToIndex);
Vector3 handForward = Vector3.Cross(handUp, handDirection);

// 各指の関節に適用
var rot = Quaternion.LookRotation(-toChild, handForward) * 
          handJoint.inverseRotation * 
          handJoint.initRotation;
```

**実装内容**:
- 5本の指すべてに対応（親指、人差し指、中指、薬指、小指）
- 各指3関節の回転を計算
- 手首の回転も考慮
- 手の方向ベクトルを計算して指の向きを正確に

**Muscle制御**:
```csharp
// HumanPoseのMuscles配列で指を制御
pose.muscles[LeftThumb1Stretched] = LeftHandPose.ThumbStretch;
pose.muscles[LeftThumb2Stretched] = LeftHandPose.ThumbStretch;
// ... 全ての指に対して
```

---

## 顔表情トラッキング

### 本プロジェクト: 未実装（ランドマークは取得済み）

```javascript
// MediaPipeから顔ランドマークは取得されている
if (results.faceLandmarks) {
    // 468点のランドマーク
    // TODO: BlendShapeへのマッピングを実装
}
```

**現状**:
- 468点の顔ランドマークは取得されている
- VRM BlendShapeへの適用は未実装

### HolisticMotionCapture: BlendShape + 瞳孔トラッキング

#### まばたき

```csharp
void BlinkRender() {
    // 目の開き具合を計算
    float leftEyeHeight = /* ランドマークから計算 */;
    float leftEyeBlink = Mathf.Clamp01(1.0f - leftEyeHeight * k);
    
    if (leftEyeBlink > 0.65f) leftEyeBlink = 1f; // 閾値処理
    
    // VRM BlendShapeに適用
    proxy.SetValues(new Dictionary<BlendShapeKey, float> {
        {BlendShapeKey.CreateFromPreset(BlendShapePreset.Blink_L), leftEyeBlink},
        {BlendShapeKey.CreateFromPreset(BlendShapePreset.Blink_R), rightEyeBlink}
    });
}
```

#### 口の形（AIUEO）

```csharp
void MouthRender() {
    // 口の開き具合から母音を推定
    float ratioA = /* 「あ」の度合い */;
    float ratioI = /* 「い」の度合い */;
    float ratioU = /* 「う」の度合い */;
    float ratioE = /* 「え」の度合い */;
    float ratioO = /* 「お」の度合い */;
    
    // Low-Pass Filterでスムージング
    ratioA = mouthA_Lpf.Filter(ratioA, Time.deltaTime, aDx);
    
    // VRM BlendShapeに適用
    proxy.SetValues(new Dictionary<BlendShapeKey, float> {
        {BlendShapeKey.CreateFromPreset(BlendShapePreset.A), ratioA},
        {BlendShapeKey.CreateFromPreset(BlendShapePreset.I), ratioI},
        // ...
    });
}
```

#### 瞳孔（視線）トラッキング

```csharp
void PupilRender() {
    var leftRatio = CalculatePupil(true);  // 虹彩位置を計算
    var rightRatio = CalculatePupil(false);
    
    // 目のボーン回転
    leftPupilBoneTrans.localRotation = Quaternion.Euler(x, ly, 0);
    rightPupilBoneTrans.localRotation = Quaternion.Euler(x, ry, 0);
}
```

**実装内容**:
- **まばたき**: `Blink_L`, `Blink_R` BlendShape
- **口**: `A`, `I`, `U`, `E`, `O` の5母音 BlendShape
- **瞳孔**: `LeftEye`, `RightEye` ボーン回転
- **Look At**: カメラ方向を見る機能

---

## パフォーマンスとスムージング

### 本プロジェクト: 3層スムージング

```javascript
// レイヤー1: Low-Pass Filter (ランドマークレベル)
class LowPassFilter {
    filter(value) {
        const alpha = this.smoothing; // 0.3-0.8
        hatX = alpha * this.hatXPrev + (1 - alpha) * value;
        return hatX;
    }
}

// レイヤー2: Temporal Smoothing (角度レベル)
const smoothingFactor = 0.5;
current.angle = previous.angle + 
                (current.angle - previous.angle) * (1 - smoothingFactor);

// レイヤー3: Quaternion Slerp (VRM適用レベル)
bone.quaternion.slerp(targetQuat, 0.8);
```

**パフォーマンス**:
- FPS: 約12-30 (ブラウザ・デバイスに依存)
- 遅延: 50-100ms程度
- GPU: WebGL自動活用

### HolisticMotionCapture: 統合スムージング + FPS制限

```csharp
// FPS制限（30fps上限）
const float maxFps = 30.0f;
if (Time.time - lastPoseUpdateTime < 1.0f / maxFps) {
    return;
}

// Quaternion.Lerp によるスムージング
boneTrans.rotation = Quaternion.Lerp(
    boneTrans.rotation, 
    targetRotation, 
    lerpPercentage  // 通常0.3
);

// Low-Pass Filter（顔のBlendShapeに使用）
mouthA_Lpf.Filter(ratioA, Time.deltaTime, aDx);
```

**パフォーマンス**:
- FPS: 安定30fps（上限設定）
- 遅延: 30-50ms
- GPU: Unity Barracuda (Compute Shader)

---

## アーキテクチャの違い

### 本プロジェクト: React Component + Three.js Scene

```
React App
  ├── App.jsx (メインコンポーネント)
  └── MotionCapturer.jsx (モーションキャプチャコンポーネント)
      ├── MediaPipe Holistic (グローバルシングルトン)
      ├── Three.js Scene
      │   ├── VRM Model
      │   └── Camera/Lights
      └── Custom Rigging Logic
          ├── Geometric Calculations
          ├── Smoothing Filters
          └── VRM Bone Updates
```

**特徴**:
- **Reactライフサイクル**: `useEffect`でセットアップ・クリーンアップ
- **グローバルシングルトン**: MediaPipeインスタンスの再利用
- **カスタムロジック**: 完全に独自実装
- **モジュラー**: 各機能が独立

### HolisticMotionCapture: Unity MonoBehaviour + Partial Class

```
Unity GameObject
  ├── Visualizer.cs (メインコントローラー)
  └── HolisticMotionCapturePipeline (partial class構造)
      ├── HolisticMotionCapture.cs (メインロジック)
      ├── HolisticMotionCapture_Pose.cs (姿勢トラッキング)
      ├── HolisticMotionCapture_Hand.cs (手トラッキング)
      ├── HolisticMotionCapture_Face.cs (顔トラッキング)
      └── HolisticBarracuda (推論エンジン)
```

**特徴**:
- **Partial Class**: 機能ごとにファイル分割
- **MonoBehaviour**: Unityのライフサイクル管理
- **HumanPoseHandler**: Unity標準のボーン制御
- **VRM BlendShape**: UniVRMパッケージ統合

---

## 主要な技術的相違点まとめ

| 項目 | 本プロジェクト | HolisticMotionCapture |
|------|--------------|---------------------|
| **プラットフォーム** | Web（ブラウザ） | Unity（ネイティブアプリ） |
| **言語** | JavaScript/JSX | C# |
| **3Dエンジン** | Three.js | Unity Engine |
| **MediaPipe** | JavaScript (WASM) | HolisticBarracuda (Barracuda/ONNX) |
| **VRMライブラリ** | @pixiv/three-vrm | UniVRM |
| **角度計算** | カスタム幾何学計算 | Unity Quaternion + LookRotation |
| **ボーン制御** | 直接Quaternion操作 | HumanPoseHandler + Muscles |
| **スムージング** | 3層（LPF + Temporal + Slerp） | Lerp + LPF |
| **手トラッキング** | 未実装 | **完全実装**（5指×3関節） |
| **顔トラッキング** | 未実装 | **完全実装**（BlendShape + 瞳孔） |
| **FPS** | 12-30fps（可変） | 30fps（固定上限） |
| **遅延** | 50-100ms | 30-50ms |
| **出力** | ブラウザ内表示 | Virtual Camera / Syphon |

---

## まとめ：使い分けのポイント

### 本プロジェクトが適している場面

✅ **Webアプリケーション・オンラインサービス**
- ビデオ会議、オンラインイベント、Web展示会
- インストール不要で即座に利用開始したい
- モバイルデバイスでも動作させたい

✅ **プロトタイピング・実験**
- 新しいアイデアを素早く試したい
- コードの全てを理解・カスタマイズしたい
- JavaScriptで開発したい

✅ **クロスプラットフォーム対応**
- Windows、macOS、Linux、iOS、Androidすべてで動作
- URLを共有するだけで誰でも使える

### HolisticMotionCaptureが適している場面

✅ **VTuber配信・高品質な映像制作**
- Virtual CameraやSyphonで配信ソフトに出力
- OBS、Zoom、Teamsなどと連携
- より正確で滑らかな動きが必要

✅ **Unity開発プロジェクト**
- Unityゲームにモーションキャプチャを統合
- UnityエディタでVRMを編集しながら開発
- Unityの豊富なエコシステムを活用

✅ **手・指・顔の詳細トラッキング**
- 手の細かな動き（指の曲げ伸ばし）が必要
- 表情豊かなアバター制御
- まばたき、口の形、視線の追従

---

## 今後の展望

### 本プロジェクトの改善方向

1. **手・指トラッキングの実装**
   - MediaPipeから取得済みの21点ランドマークを活用
   - HolisticMotionCaptureの実装を参考に
   - VRM指ボーンへのマッピング

2. **顔表情トラッキング**
   - 468点の顔ランドマークからBlendShapeへ
   - AIUEO母音の認識
   - まばたき検出

3. **パフォーマンス最適化**
   - Web Workerでの並列処理
   - より高度なスムージングアルゴリズム
   - FPS安定化

4. **リアルタイム配信機能**
   - WebRTC統合
   - Canvas Capture APIの活用

### HolisticMotionCaptureとの技術交流

- **アルゴリズムの共有**: 角度計算やスムージング手法の相互参照
- **ベストプラクティス**: それぞれのプラットフォームでの最適化技術
- **オープンソース**: 両プロジェクトともにオープンソースの利点を活かした開発

---

**作成日**: 2026年1月17日  
**バージョン**: 1.0  
**参照**:
- [本プロジェクト: depth-motion-capture](https://github.com/RimgO/depth-motion-capture)
- [HolisticMotionCapture](https://github.com/creativeIKEP/HolisticMotionCapture)
- [本プロジェクトの技術詳細](./MOTION_CAPTURE_SYSTEM.md)
