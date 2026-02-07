#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
腕の検出とVRM追従性の分析スクリプト
"""

import json
import sys
from pathlib import Path
import math

def analyze_arm_tracking(log_file):
    """腕の追従性を分析"""
    
    print(f"\n{'='*60}")
    print(f"腕の検出とVRM追従性の分析")
    print(f"ログファイル: {Path(log_file).name}")
    print(f"{'='*60}\n")
    
    with open(log_file, 'r') as f:
        data = json.load(f)
    
    if not data:
        print("❌ データが空です")
        return
    
    print(f"📊 総フレーム数: {len(data)}\n")
    
    # 1. データ構造の確認
    first_frame = data[0]
    print("=" * 60)
    print("1. データ構造の確認")
    print("=" * 60)
    
    has_input = 'input' in first_frame and first_frame['input']
    has_output = 'output' in first_frame and first_frame['output']
    has_raw = 'rawLandmarks' in first_frame and first_frame['rawLandmarks']
    has_world = 'worldLandmarks' in first_frame and first_frame['worldLandmarks']
    
    print(f"input データ: {'✓' if has_input else '✗'}")
    print(f"output データ: {'✓' if has_output else '✗'}")
    print(f"rawLandmarks: {'✓' if has_raw else '✗'} ({len(first_frame.get('rawLandmarks', []))} 点)")
    print(f"worldLandmarks: {'✓' if has_world else '✗'} ({len(first_frame.get('worldLandmarks', []))} 点)")
    
    if has_input:
        input_keys = list(first_frame['input'].keys())
        print(f"\ninput keys: {', '.join(input_keys)}")
    
    # 2. 腕のデータを収集
    print("\n" + "=" * 60)
    print("2. 腕の回転データ分析")
    print("=" * 60)
    
    right_upper_z = []
    right_upper_x = []
    right_upper_y = []
    left_upper_z = []
    left_upper_x = []
    left_upper_y = []
    right_lower_z = []
    left_lower_z = []
    
    frames_with_data = 0
    frames_without_data = 0
    
    for frame in data:
        if 'input' not in frame or not frame['input']:
            frames_without_data += 1
            continue
        
        inp = frame['input']
        
        # 右上腕
        if 'RightUpperArm' in inp and inp['RightUpperArm']:
            rua = inp['RightUpperArm']
            if 'z' in rua and rua['z'] != 0:
                right_upper_z.append(rua['z'])
                right_upper_x.append(rua.get('x', 0))
                right_upper_y.append(rua.get('y', 0))
                frames_with_data += 1
        
        # 左上腕
        if 'LeftUpperArm' in inp and inp['LeftUpperArm']:
            lua = inp['LeftUpperArm']
            if 'z' in lua and lua['z'] != 0:
                left_upper_z.append(lua['z'])
                left_upper_x.append(lua.get('x', 0))
                left_upper_y.append(lua.get('y', 0))
        
        # 右肘
        if 'RightLowerArm' in inp and inp['RightLowerArm']:
            rla = inp['RightLowerArm']
            if 'z' in rla:
                right_lower_z.append(rla['z'])
        
        # 左肘
        if 'LeftLowerArm' in inp and inp['LeftLowerArm']:
            lla = inp['LeftLowerArm']
            if 'z' in lla:
                left_lower_z.append(lla['z'])
    
    print(f"\n有効データフレーム: {frames_with_data}")
    print(f"データなしフレーム: {frames_without_data}")
    
    def analyze_rotation_data(name, data_z, data_x=None, data_y=None):
        """回転データを分析"""
        if not data_z:
            print(f"\n{name}: ❌ データなし")
            return
        
        print(f"\n{name}:")
        print(f"  サンプル数: {len(data_z)}")
        
        # Z軸 (腕の上げ下げ)
        avg_z = sum(data_z) / len(data_z)
        min_z = min(data_z)
        max_z = max(data_z)
        range_z = max_z - min_z
        
        print(f"  Z軸 (上下運動):")
        print(f"    平均: {avg_z:.3f} rad ({math.degrees(avg_z):.1f}°)")
        print(f"    範囲: {min_z:.3f} ~ {max_z:.3f} rad")
        print(f"    可動域: {range_z:.3f} rad ({math.degrees(range_z):.1f}°)")
        
        # 可動域評価
        if range_z < 0.5:
            print(f"    ⚠️  可動域が非常に狭い（ほぼ動いていない）")
        elif range_z < 1.0:
            print(f"    ⚠️  可動域が狭い")
        elif range_z < 2.0:
            print(f"    ✓  可動域は正常範囲")
        else:
            print(f"    ✓  可動域が広い（良好）")
        
        # X軸 (前後の傾き)
        if data_x:
            avg_x = sum(data_x) / len(data_x)
            range_x = max(data_x) - min(data_x)
            print(f"  X軸 (前後傾き):")
            print(f"    平均: {avg_x:.3f} rad ({math.degrees(avg_x):.1f}°)")
            print(f"    可動域: {range_x:.3f} rad ({math.degrees(range_x):.1f}°)")
        
        # Y軸 (腕のひねり)
        if data_y:
            avg_y = sum(data_y) / len(data_y)
            range_y = max(data_y) - min(data_y)
            print(f"  Y軸 (ひねり):")
            print(f"    平均: {avg_y:.3f} rad ({math.degrees(avg_y):.1f}°)")
            print(f"    可動域: {range_y:.3f} rad ({math.degrees(range_y):.1f}°)")
        
        # 変動の評価（スムージング効果）
        if len(data_z) > 1:
            diffs = [abs(data_z[i] - data_z[i-1]) for i in range(1, len(data_z))]
            avg_diff = sum(diffs) / len(diffs)
            max_diff = max(diffs)
            
            print(f"  変動:")
            print(f"    平均変化量: {avg_diff:.4f} rad/frame ({math.degrees(avg_diff):.2f}°/frame)")
            print(f"    最大変化量: {max_diff:.4f} rad/frame ({math.degrees(max_diff):.2f}°/frame)")
            
            if avg_diff < 0.01:
                print(f"    ⚠️  ほとんど動いていない（スムージングが強すぎる可能性）")
            elif avg_diff < 0.05:
                print(f"    ✓  滑らかな動き")
            elif avg_diff < 0.1:
                print(f"    ✓  適度な動き")
            else:
                print(f"    ⚠️  動きが粗い（ジッターが多い）")
    
    analyze_rotation_data("右上腕", right_upper_z, right_upper_x, right_upper_y)
    analyze_rotation_data("左上腕", left_upper_z, left_upper_x, left_upper_y)
    analyze_rotation_data("右肘", right_lower_z)
    analyze_rotation_data("左肘", left_lower_z)
    
    # 3. inputとoutputの比較
    print("\n" + "=" * 60)
    print("3. input → output の追従性分析")
    print("=" * 60)
    
    input_output_diffs = []
    
    for frame in data[:100]:  # 最初の100フレームで確認
        if 'input' not in frame or 'output' not in frame:
            continue
        
        inp = frame.get('input', {})
        out = frame.get('output', {})
        
        # 右上腕のZ軸で比較
        if 'RightUpperArm' in inp and inp['RightUpperArm'] and 'rightUpperArm' in out and out['rightUpperArm']:
            in_z = inp['RightUpperArm'].get('z', 0)
            out_z = out['rightUpperArm'].get('z', 0)
            if in_z != 0 and out_z != 0:
                diff = abs(in_z - out_z)
                input_output_diffs.append(diff)
    
    if input_output_diffs:
        avg_diff = sum(input_output_diffs) / len(input_output_diffs)
        max_diff = max(input_output_diffs)
        
        print(f"\n右上腕Z軸の input → output の誤差:")
        print(f"  平均誤差: {avg_diff:.6f} rad ({math.degrees(avg_diff):.3f}°)")
        print(f"  最大誤差: {max_diff:.6f} rad ({math.degrees(max_diff):.3f}°)")
        
        if avg_diff < 0.001:
            print(f"  ✓ 追従性: 優秀（ほぼ一致）")
        elif avg_diff < 0.01:
            print(f"  ✓ 追従性: 良好")
        elif avg_diff < 0.05:
            print(f"  ⚠️  追従性: やや遅延あり")
        else:
            print(f"  ❌ 追従性: 遅延が大きい")
    else:
        print("\n⚠️  input/output 比較データが不足しています")
    
    # 4. 問題点の特定
    print("\n" + "=" * 60)
    print("4. 問題点と改善提案")
    print("=" * 60)
    
    issues = []
    suggestions = []
    
    # 右上腕の問題
    if right_upper_z:
        avg_z = sum(right_upper_z) / len(right_upper_z)
        range_z = max(right_upper_z) - min(right_upper_z)
        
        # 負の値が多い = 腕が下がりすぎている
        if avg_z < -0.5:
            issues.append("右腕が常に下がりすぎている（平均値が負に大きい）")
            suggestions.append("ARM_Z_OFFSET の調整（現在 π/2）を増やす")
        
        # 可動域が狭い
        if range_z < 1.0:
            issues.append("右腕の可動域が狭い")
            suggestions.append("スムージング係数を下げる（SMOOTHING.POSE_TEMPORAL を 0.5 → 0.3 等）")
            suggestions.append("VRM_BONE_SLERP を上げる（0.8 → 0.9 等）")
    
    # 左上腕の問題
    if left_upper_z:
        avg_z = sum(left_upper_z) / len(left_upper_z)
        range_z = max(left_upper_z) - min(left_upper_z)
        
        if avg_z < -1.0:
            issues.append("左腕が常に大きく下がっている")
            suggestions.append("VRM0/VRM1 の座標系の違いを確認")
        
        if range_z < 1.0:
            issues.append("左腕の可動域が狭い")
    
    # 肘の問題
    if right_lower_z:
        avg_elbow = sum(right_lower_z) / len(right_lower_z)
        if abs(avg_elbow) > 2.5:
            issues.append(f"右肘が過剰に曲がっている（平均 {avg_elbow:.2f} rad）")
            suggestions.append("肘の角度計算ロジックを確認")
    
    if left_lower_z:
        avg_elbow = sum(left_lower_z) / len(left_lower_z)
        if abs(avg_elbow) < 0.3:
            issues.append(f"左肘がほとんど曲がっていない（平均 {avg_elbow:.2f} rad）")
    
    # 出力
    if issues:
        print("\n🔴 検出された問題:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
    else:
        print("\n✓ 大きな問題は検出されませんでした")
    
    if suggestions:
        print("\n💡 改善提案:")
        for i, suggestion in enumerate(suggestions, 1):
            print(f"  {i}. {suggestion}")
    
    # 5. 推奨パラメータ
    print("\n" + "=" * 60)
    print("5. 推奨パラメータ調整")
    print("=" * 60)
    
    print("\n現在の設定 (src/constants/landmarks.js):")
    print("  SMOOTHING.POSE_TEMPORAL: 0.5")
    print("  SMOOTHING.VRM_BONE_SLERP: 0.8")
    print("  ANGLES.ARM_Z_OFFSET: π/2 (1.571 rad)")
    print("  ANGLES.ARM_X_SCALE: 0.5")
    
    print("\n推奨設定:")
    if range_z < 1.0 if right_upper_z else False:
        print("  ✏️  SMOOTHING.POSE_TEMPORAL: 0.5 → 0.3 (応答性向上)")
        print("  ✏️  SMOOTHING.VRM_BONE_SLERP: 0.8 → 0.9 (より素早い追従)")
    
    if avg_z < -0.5 if right_upper_z else False:
        print("  ✏️  ANGLES.ARM_Z_OFFSET: π/2 → π/2 + 0.3 (腕の基準位置を上げる)")
    
    print("\n追加確認項目:")
    print("  • MediaPipe の modelComplexity が 2 になっているか")
    print("  • smoothLandmarks が true になっているか")
    print("  • 3D worldLandmarks (za) が正しく取得できているか")
    print("  • VRM のバージョン (0.x vs 1.0) が正しく判定されているか")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("使用法: python analyze_arm_tracking.py <log_file.json>")
        sys.exit(1)
    
    log_file = sys.argv[1]
    if not Path(log_file).exists():
        print(f"エラー: ファイルが見つかりません: {log_file}")
        sys.exit(1)
    
    analyze_arm_tracking(log_file)
