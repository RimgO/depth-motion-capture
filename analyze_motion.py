import json
import statistics
import math

# Load the motion data
with open('log/motion-debug-log-1768628258421.json', 'r') as f:
    data = json.load(f)

print(f"総フレーム数: {len(data)}")
print(f"記録時間: {(data[-1]['t'] - data[0]['t']) / 1000:.2f}秒")
print(f"平均FPS: {len(data) / ((data[-1]['t'] - data[0]['t']) / 1000):.1f}\n")

# MediaPipe Pose landmark indices
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_ELBOW = 13
RIGHT_ELBOW = 14
LEFT_WRIST = 15
RIGHT_WRIST = 16

# Analyze arm movements
left_wrist_y = []
right_wrist_y = []
left_elbow_y = []
right_elbow_y = []

for frame in data:
    if 'rawLandmarks' in frame and len(frame['rawLandmarks']) > RIGHT_WRIST:
        # Y座標が小さいほど上（画像座標系）
        left_wrist_y.append(frame['rawLandmarks'][LEFT_WRIST]['y'])
        right_wrist_y.append(frame['rawLandmarks'][RIGHT_WRIST]['y'])
        left_elbow_y.append(frame['rawLandmarks'][LEFT_ELBOW]['y'])
        right_elbow_y.append(frame['rawLandmarks'][RIGHT_ELBOW]['y'])

print("=" * 60)
print("腕の上げ下げ分析（Y座標: 小さいほど上）")
print("=" * 60)

def analyze_movement(positions, name):
    if not positions:
        return
    
    min_y = min(positions)
    max_y = max(positions)
    range_y = max_y - min_y
    avg_y = statistics.mean(positions)
    std_y = statistics.stdev(positions) if len(positions) > 1 else 0
    
    print(f"\n【{name}】")
    print(f"  最高位置（最小Y）: {min_y:.4f}")
    print(f"  最低位置（最大Y）: {max_y:.4f}")
    print(f"  可動範囲: {range_y:.4f} ({range_y * 100:.1f}%)")
    print(f"  平均位置: {avg_y:.4f}")
    print(f"  標準偏差: {std_y:.4f}")
    
    # Movement detection
    movements = 0
    threshold = 0.02  # 2%の変化を検出
    for i in range(1, len(positions)):
        if abs(positions[i] - positions[i-1]) > threshold:
            movements += 1
    
    print(f"  動き検出回数: {movements}回")
    print(f"  動き密度: {movements / len(positions) * 100:.1f}%")

analyze_movement(left_wrist_y, "左手首")
analyze_movement(right_wrist_y, "右手首")
analyze_movement(left_elbow_y, "左肘")
analyze_movement(right_elbow_y, "右肘")

# Analyze VRM rigging data
print("\n" + "=" * 60)
print("VRM腕関節の回転角度分析")
print("=" * 60)

right_upper_arm_z = []
left_upper_arm_z = []

for frame in data:
    if 'input' in frame and frame['input']:
        if 'RightUpperArm' in frame['input'] and frame['input']['RightUpperArm']:
            right_upper_arm_z.append(frame['input']['RightUpperArm'].get('z', 0))
        if 'LeftUpperArm' in frame['input'] and frame['input']['LeftUpperArm']:
            left_upper_arm_z.append(frame['input']['LeftUpperArm'].get('z', 0))

def analyze_rotation(rotations, name):
    if not rotations:
        print(f"\n【{name}】データなし")
        return
    
    min_rot = min(rotations)
    max_rot = max(rotations)
    range_rot = max_rot - min_rot
    avg_rot = statistics.mean(rotations)
    
    print(f"\n【{name}（Z軸回転）】")
    print(f"  最小角度: {min_rot:.4f} rad ({math.degrees(min_rot):.1f}°)")
    print(f"  最大角度: {max_rot:.4f} rad ({math.degrees(max_rot):.1f}°)")
    print(f"  可動範囲: {range_rot:.4f} rad ({math.degrees(range_rot):.1f}°)")
    print(f"  平均角度: {avg_rot:.4f} rad ({math.degrees(avg_rot):.1f}°)")

analyze_rotation(right_upper_arm_z, "右上腕")
analyze_rotation(left_upper_arm_z, "左上腕")

# Responsiveness check
print("\n" + "=" * 60)
print("追従性評価")
print("=" * 60)

def calculate_smoothness(positions):
    if len(positions) < 3:
        return 0
    
    # Calculate jitter (second derivative)
    accelerations = []
    for i in range(2, len(positions)):
        accel = abs((positions[i] - positions[i-1]) - (positions[i-1] - positions[i-2]))
        accelerations.append(accel)
    
    return statistics.mean(accelerations) if accelerations else 0

left_smoothness = calculate_smoothness(left_wrist_y)
right_smoothness = calculate_smoothness(right_wrist_y)

print(f"\n左手首のスムーズさ: {left_smoothness:.6f} (小さいほど滑らか)")
print(f"右手首のスムーズさ: {right_smoothness:.6f} (小さいほど滑らか)")

# Frame-to-frame consistency
frame_times = [data[i]['t'] - data[i-1]['t'] for i in range(1, len(data))]
avg_frame_time = statistics.mean(frame_times)
std_frame_time = statistics.stdev(frame_times) if len(frame_times) > 1 else 0

print(f"\nフレーム間隔: {avg_frame_time:.1f}ms ± {std_frame_time:.1f}ms")
print(f"タイミングの安定性: {(1 - std_frame_time/avg_frame_time) * 100:.1f}%")

# Overall assessment
print("\n" + "=" * 60)
print("総合評価")
print("=" * 60)

score = 0
max_score = 0

# 1. 可動範囲チェック（30点）
max_score += 30
if left_wrist_y and right_wrist_y:
    left_range = max(left_wrist_y) - min(left_wrist_y)
    right_range = max(right_wrist_y) - min(right_wrist_y)
    avg_range = (left_range + right_range) / 2
    
    if avg_range > 0.3:
        score += 30
        range_eval = "優秀"
    elif avg_range > 0.2:
        score += 20
        range_eval = "良好"
    elif avg_range > 0.1:
        score += 10
        range_eval = "普通"
    else:
        range_eval = "不十分"
    
    print(f"可動範囲: {range_eval} ({avg_range*100:.1f}%の範囲)")

# 2. スムーズさ（30点）
max_score += 30
avg_smoothness = (left_smoothness + right_smoothness) / 2 if left_smoothness and right_smoothness else 0

if avg_smoothness < 0.001:
    score += 30
    smooth_eval = "非常に滑らか"
elif avg_smoothness < 0.003:
    score += 20
    smooth_eval = "滑らか"
elif avg_smoothness < 0.005:
    score += 10
    smooth_eval = "やや揺れあり"
else:
    smooth_eval = "揺れが多い"

print(f"動きのスムーズさ: {smooth_eval}")

# 3. データ完全性（20点）
max_score += 20
data_completeness = sum(1 for f in data if f.get('input') and f.get('output')) / len(data)
score += int(data_completeness * 20)
print(f"データ完全性: {data_completeness*100:.1f}%")

# 4. フレームレート安定性（20点）
max_score += 20
if std_frame_time < avg_frame_time * 0.2:
    score += 20
    fps_eval = "安定"
elif std_frame_time < avg_frame_time * 0.4:
    score += 10
    fps_eval = "やや不安定"
else:
    fps_eval = "不安定"

print(f"フレームレート: {fps_eval}")

print(f"\n【総合スコア】: {score}/{max_score}点 ({score/max_score*100:.0f}%)")

if score >= 80:
    print("評価: ⭐⭐⭐⭐⭐ 優秀 - VRMが正確に腕の動きを追従しています")
elif score >= 60:
    print("評価: ⭐⭐⭐⭐ 良好 - 概ね良好な追従性です")
elif score >= 40:
    print("評価: ⭐⭐⭐ 普通 - 基本的な動きは捉えられています")
else:
    print("評価: ⭐⭐ 改善の余地あり")
