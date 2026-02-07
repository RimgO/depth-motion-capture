import json
import sys

with open(sys.argv[1], 'r') as f:
    data = json.load(f)

x_values = [frame['input']['RightUpperArm']['x'] for frame in data]
z_values = [frame['input']['RightUpperArm']['z'] for frame in data]

print(f'Total frames: {len(data)}')
print(f'\nRightUpperArm X-axis (forward flexion):')
print(f'  Min: {min(x_values):.3f} rad ({min(x_values) * 57.3:.1f}°)')
print(f'  Max: {max(x_values):.3f} rad ({max(x_values) * 57.3:.1f}°)')
print(f'  Range: {max(x_values) - min(x_values):.3f} rad ({(max(x_values) - min(x_values)) * 57.3:.1f}°)')
print(f'\nRightUpperArm Z-axis (lateral abduction):')
print(f'  Min: {min(z_values):.3f} rad ({min(z_values) * 57.3:.1f}°)')
print(f'  Max: {max(z_values):.3f} rad ({max(z_values) * 57.3:.1f}°)')
print(f'  Range: {max(z_values) - min(z_values):.3f} rad ({(max(z_values) - min(z_values)) * 57.3:.1f}°)')
