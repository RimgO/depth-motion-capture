#!/usr/bin/env python3
import json
import math

with open('log/motion-debug-log-1768663577789.json', 'r') as f:
    data = json.load(f)

print("=" * 60)
print("軸間クロストーク分析（Y軸回転時のZ軸への影響）")
print("=" * 60)

# 右腕のY軸とZ軸の関係を分析
right_y_values = []
right_z_values = []
left_y_values = []
left_z_values = []

for frame in data:
    if 'input' in frame:
        if 'RightUpperArm' in frame['input']:
            y = frame['input']['RightUpperArm'].get('y')
            z = frame['input']['RightUpperArm'].get('z')
            if y is not None and z is not None:
                right_y_values.append(y)
                right_z_values.append(z)
        
        if 'LeftUpperArm' in frame['input']:
            y = frame['input']['LeftUpperArm'].get('y')
            z = frame['input']['LeftUpperArm'].get('z')
            if y is not None and z is not None:
                left_y_values.append(y)
                left_z_values.append(z)

print(f"\n総フレーム数: {len(data)}")

# 右腕の分析
if right_y_values:
    print("\n【右腕】")
    print(f"Y軸回転範囲: {min(right_y_values):.3f} ~ {max(right_y_values):.3f} rad")
    print(f"            ({math.degrees(min(right_y_values)):.1f}° ~ {math.degrees(max(right_y_values)):.1f}°)")
    print(f"Y軸変化量: {max(right_y_values) - min(right_y_values):.3f} rad ({math.degrees(max(right_y_values) - min(right_y_values)):.1f}°)")
    
    print(f"\nZ軸回転範囲: {min(right_z_values):.3f} ~ {max(right_z_values):.3f} rad")
    print(f"            ({math.degrees(min(right_z_values)):.1f}° ~ {math.degrees(max(right_z_values)):.1f}°)")
    print(f"Z軸変化量: {max(right_z_values) - min(right_z_values):.3f} rad ({math.degrees(max(right_z_values) - min(right_z_values)):.1f}°)")
    
    # 相関を計算
    if len(right_y_values) > 1:
        # Y軸が大きく変化している区間を見つける
        y_changes = []
        z_changes = []
        for i in range(1, len(right_y_values)):
            y_diff = abs(right_y_values[i] - right_y_values[i-1])
            z_diff = abs(right_z_values[i] - right_z_values[i-1])
            if y_diff > 0.01:  # Y軸が大きく変化している時
                y_changes.append(y_diff)
                z_changes.append(z_diff)
        
        if y_changes:
            print(f"\nY軸が大きく変化している時のZ軸への影響:")
            print(f"  Y軸変化が0.01 rad以上のフレーム: {len(y_changes)}個")
            print(f"  その時のZ軸平均変化: {sum(z_changes)/len(z_changes):.6f} rad ({math.degrees(sum(z_changes)/len(z_changes)):.3f}°)")
            print(f"  Z軸最大変化: {max(z_changes):.6f} rad ({math.degrees(max(z_changes)):.3f}°)")

# 左腕の分析
if left_y_values:
    print("\n【左腕】")
    print(f"Y軸回転範囲: {min(left_y_values):.3f} ~ {max(left_y_values):.3f} rad")
    print(f"            ({math.degrees(min(left_y_values)):.1f}° ~ {math.degrees(max(left_y_values)):.1f}°)")
    print(f"Y軸変化量: {max(left_y_values) - min(left_y_values):.3f} rad ({math.degrees(max(left_y_values) - min(left_y_values)):.1f}°)")
    
    print(f"\nZ軸回転範囲: {min(left_z_values):.3f} ~ {max(left_z_values):.3f} rad")
    print(f"            ({math.degrees(min(left_z_values)):.1f}° ~ {math.degrees(max(left_z_values)):.1f}°)")
    print(f"Z軸変化量: {max(left_z_values) - min(left_z_values):.3f} rad ({math.degrees(max(left_z_values) - min(left_z_values)):.1f}°)")
    
    if len(left_y_values) > 1:
        y_changes = []
        z_changes = []
        for i in range(1, len(left_y_values)):
            y_diff = abs(left_y_values[i] - left_y_values[i-1])
            z_diff = abs(left_z_values[i] - left_z_values[i-1])
            if y_diff > 0.01:
                y_changes.append(y_diff)
                z_changes.append(z_diff)
        
        if y_changes:
            print(f"\nY軸が大きく変化している時のZ軸への影響:")
            print(f"  Y軸変化が0.01 rad以上のフレーム: {len(y_changes)}個")
            print(f"  その時のZ軸平均変化: {sum(z_changes)/len(z_changes):.6f} rad ({math.degrees(sum(z_changes)/len(z_changes)):.3f}°)")
            print(f"  Z軸最大変化: {max(z_changes):.6f} rad ({math.degrees(max(z_changes)):.3f}°)")

# 詳細な時系列分析（Y軸が大きく変化している区間）
print("\n" + "=" * 60)
print("時系列詳細分析（Y軸が大きく変化している区間）")
print("=" * 60)

large_y_changes = []
for i in range(1, min(len(right_y_values), 100)):
    y_diff = abs(right_y_values[i] - right_y_values[i-1])
    if y_diff > 0.05:  # 大きな変化
        large_y_changes.append(i)

if large_y_changes:
    print(f"\nY軸が大きく変化したフレーム: {large_y_changes[:5]}")
    for idx in large_y_changes[:5]:
        if idx > 0:
            print(f"\nFrame {idx-1} → {idx}:")
            print(f"  Y軸: {right_y_values[idx-1]:.4f} → {right_y_values[idx]:.4f} (変化: {right_y_values[idx]-right_y_values[idx-1]:.4f} rad, {math.degrees(right_y_values[idx]-right_y_values[idx-1]):.2f}°)")
            print(f"  Z軸: {right_z_values[idx-1]:.4f} → {right_z_values[idx]:.4f} (変化: {right_z_values[idx]-right_z_values[idx-1]:.4f} rad, {math.degrees(right_z_values[idx]-right_z_values[idx-1]):.2f}°)")

# 問題の診断
print("\n" + "=" * 60)
print("問題診断")
print("=" * 60)

if right_y_values and right_z_values:
    # Y軸が大きく変化した時のZ軸の変化率
    y_changes_large = []
    z_changes_when_y_changes = []
    
    for i in range(1, len(right_y_values)):
        y_diff = abs(right_y_values[i] - right_y_values[i-1])
        z_diff = abs(right_z_values[i] - right_z_values[i-1])
        if y_diff > 0.01:
            y_changes_large.append(y_diff)
            z_changes_when_y_changes.append(z_diff)
    
    if y_changes_large:
        avg_z_change = sum(z_changes_when_y_changes) / len(z_changes_when_y_changes)
        ratio = avg_z_change / (sum(y_changes_large) / len(y_changes_large)) if y_changes_large else 0
        
        print(f"\nクロストーク比率: {ratio:.3f}")
        print(f"  意味: Y軸が1度変化すると、Z軸が約{ratio:.3f}度変化している")
        
        if avg_z_change > 0.05:  # 約3度以上
            print(f"\n⚠️ 問題発見: Y軸回転時にZ軸が大きく変化")
            print(f"  平均Z軸変化: {math.degrees(avg_z_change):.2f}°")
            print(f"  推奨値: < 0.01 rad (0.6°)")
            print(f"\n改善策:")
            print(f"  1. Y軸回転の計算を手首の位置ではなく、手のひらの向きだけから計算")
            print(f"  2. Z軸（上下）の成分を除去してからY軸回転を計算")
            print(f"  3. 肩-肘のベクトルに対して垂直な平面での回転のみを検出")
        else:
            print(f"\n✅ 良好: Y軸回転時のZ軸への影響は許容範囲内")
            print(f"  平均Z軸変化: {math.degrees(avg_z_change):.2f}°")
