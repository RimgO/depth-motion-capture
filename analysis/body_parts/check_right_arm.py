#!/usr/bin/env python3
import json
import math

with open('log/motion-debug-log-1768665541406.json', 'r') as f:
    data = json.load(f)

print('総フレーム数:', len(data))
print()

# 右手と左手のY軸データを抽出
right_y_values = []
left_y_values = []

for i, frame in enumerate(data):
    if 'input' in frame:
        if 'RightUpperArm' in frame['input'] and frame['input']['RightUpperArm']:
            y = frame['input']['RightUpperArm'].get('y')
            if y is not None:
                right_y_values.append((i, y))
        
        if 'LeftUpperArm' in frame['input'] and frame['input']['LeftUpperArm']:
            y = frame['input']['LeftUpperArm'].get('y')
            if y is not None:
                left_y_values.append((i, y))

print('右手Y軸データ数:', len(right_y_values))
if right_y_values:
    values = [v[1] for v in right_y_values]
    print(f'  範囲: {min(values):.4f} ~ {max(values):.4f} rad')
    print(f'        ({math.degrees(min(values)):.1f}° ~ {math.degrees(max(values)):.1f}°)')
    print(f'  変化量: {max(values) - min(values):.4f} rad ({math.degrees(max(values) - min(values)):.1f}°)')
    print('  最初の10フレーム:')
    for idx, val in right_y_values[:10]:
        print(f'    Frame {idx}: {val:.6f} rad ({math.degrees(val):7.2f}°)')
    
    # 変化が大きいフレームを探す
    large_changes = []
    for i in range(1, len(right_y_values)):
        diff = abs(right_y_values[i][1] - right_y_values[i-1][1])
        if diff > 0.1:
            large_changes.append((right_y_values[i-1][0], right_y_values[i][0], diff))
    
    if large_changes:
        print(f'\n  大きな変化があるフレーム（0.1 rad以上）: {len(large_changes)}個')
        for idx1, idx2, diff in large_changes[:5]:
            print(f'    Frame {idx1} → {idx2}: {diff:.4f} rad ({math.degrees(diff):.1f}°)')
else:
    print('  ⚠️ データなし！右手のY軸回転が記録されていません')

print()
print('左手Y軸データ数:', len(left_y_values))
if left_y_values:
    values = [v[1] for v in left_y_values]
    print(f'  範囲: {min(values):.4f} ~ {max(values):.4f} rad')
    print(f'        ({math.degrees(min(values)):.1f}° ~ {math.degrees(max(values)):.1f}°)')
    print(f'  変化量: {max(values) - min(values):.4f} rad ({math.degrees(max(values) - min(values)):.1f}°)')
    print('  最初の10フレーム:')
    for idx, val in left_y_values[:10]:
        print(f'    Frame {idx}: {val:.6f} rad ({math.degrees(val):7.2f}°)')
    
    # 変化が大きいフレームを探す
    large_changes = []
    for i in range(1, len(left_y_values)):
        diff = abs(left_y_values[i][1] - left_y_values[i-1][1])
        if diff > 0.1:
            large_changes.append((left_y_values[i-1][0], left_y_values[i][0], diff))
    
    if large_changes:
        print(f'\n  大きな変化があるフレーム（0.1 rad以上）: {len(large_changes)}個')
        for idx1, idx2, diff in large_changes[:5]:
            print(f'    Frame {idx1} → {idx2}: {diff:.4f} rad ({math.degrees(diff):.1f}°)')
