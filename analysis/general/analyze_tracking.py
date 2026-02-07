#!/usr/bin/env python3
import json
import math

with open('log/motion-debug-log-1768663577789.json', 'r') as f:
    data = json.load(f)

print("=" * 60)
print("VRM追従性分析")
print("=" * 60)

# 分析対象のボーン
bones = ['RightUpperArm', 'LeftUpperArm', 'RightLowerArm', 'LeftLowerArm']
axes = ['x', 'y', 'z']

# フレームごとの差分を計算
differences = {bone: {axis: [] for axis in axes} for bone in bones}
frame_count = 0

for frame in data:
    if 'input' not in frame or 'output' not in frame:
        continue
    
    frame_count += 1
    
    for bone in bones:
        bone_lower = bone[0].lower() + bone[1:]  # RightUpperArm -> rightUpperArm
        
        if bone in frame['input'] and bone_lower in frame['output']:
            input_data = frame['input'][bone]
            output_data = frame['output'][bone_lower]
            
            for axis in axes:
                if axis in input_data and axis in output_data:
                    diff = abs(input_data[axis] - output_data[axis])
                    differences[bone][axis].append(diff)

print(f"\n総フレーム数: {frame_count}")
print(f"分析フレーム数: {len(data)}\n")

# 統計を計算
for bone in bones:
    print(f"\n【{bone}】")
    bone_lower = bone[0].lower() + bone[1:]
    
    for axis in axes:
        diffs = differences[bone][axis]
        if diffs:
            avg_diff = sum(diffs) / len(diffs)
            max_diff = max(diffs)
            
            # ラジアンを度に変換
            avg_deg = math.degrees(avg_diff)
            max_deg = math.degrees(max_diff)
            
            print(f"  {axis}軸: 平均誤差 {avg_diff:.6f} rad ({avg_deg:.3f}°), 最大誤差 {max_diff:.6f} rad ({max_deg:.3f}°)")

# Y軸回転の追従性を特に詳しく分析
print("\n" + "=" * 60)
print("Y軸回転（腕のひねり）の追従性")
print("=" * 60)

right_y_diffs = differences['RightUpperArm']['y']
left_y_diffs = differences['LeftUpperArm']['y']

if right_y_diffs:
    print(f"\n右腕Y軸:")
    print(f"  平均誤差: {sum(right_y_diffs)/len(right_y_diffs):.6f} rad ({math.degrees(sum(right_y_diffs)/len(right_y_diffs)):.3f}°)")
    print(f"  最大誤差: {max(right_y_diffs):.6f} rad ({math.degrees(max(right_y_diffs)):.3f}°)")
    print(f"  誤差0.01 rad以下: {sum(1 for d in right_y_diffs if d < 0.01) / len(right_y_diffs) * 100:.1f}%")

if left_y_diffs:
    print(f"\n左腕Y軸:")
    print(f"  平均誤差: {sum(left_y_diffs)/len(left_y_diffs):.6f} rad ({math.degrees(sum(left_y_diffs)/len(left_y_diffs)):.3f}°)")
    print(f"  最大誤差: {max(left_y_diffs):.6f} rad ({math.degrees(max(left_y_diffs)):.3f}°)")
    print(f"  誤差0.01 rad以下: {sum(1 for d in left_y_diffs if d < 0.01) / len(left_y_diffs) * 100:.1f}%")

# 時系列での追従遅延を確認
print("\n" + "=" * 60)
print("時系列追従性（最初の10フレーム）")
print("=" * 60)

for i, frame in enumerate(data[:10]):
    if 'input' not in frame or 'output' not in frame:
        continue
    
    if 'RightUpperArm' in frame['input'] and 'rightUpperArm' in frame['output']:
        input_y = frame['input']['RightUpperArm']['y']
        output_y = frame['output']['rightUpperArm']['y']
        diff = abs(input_y - output_y)
        
        print(f"Frame {i}: Input={input_y:.4f}, Output={output_y:.4f}, Diff={diff:.6f} ({math.degrees(diff):.3f}°)")

print("\n" + "=" * 60)
print("評価結果")
print("=" * 60)

# 総合評価
all_diffs = []
for bone in bones:
    for axis in axes:
        all_diffs.extend(differences[bone][axis])

if all_diffs:
    overall_avg = sum(all_diffs) / len(all_diffs)
    overall_max = max(all_diffs)
    
    print(f"\n全体平均誤差: {overall_avg:.6f} rad ({math.degrees(overall_avg):.3f}°)")
    print(f"全体最大誤差: {overall_max:.6f} rad ({math.degrees(overall_max):.3f}°)")
    
    excellent = sum(1 for d in all_diffs if d < 0.001) / len(all_diffs) * 100
    good = sum(1 for d in all_diffs if d < 0.01) / len(all_diffs) * 100
    acceptable = sum(1 for d in all_diffs if d < 0.1) / len(all_diffs) * 100
    
    print(f"\n精度分布:")
    print(f"  誤差 < 0.001 rad (0.06°): {excellent:.1f}%")
    print(f"  誤差 < 0.01 rad (0.6°): {good:.1f}%")
    print(f"  誤差 < 0.1 rad (5.7°): {acceptable:.1f}%")
    
    if overall_avg < 0.001:
        rating = "★★★★★ 優秀"
    elif overall_avg < 0.01:
        rating = "★★★★☆ 良好"
    elif overall_avg < 0.1:
        rating = "★★★☆☆ 許容"
    else:
        rating = "★★☆☆☆ 要改善"
    
    print(f"\n総合評価: {rating}")
