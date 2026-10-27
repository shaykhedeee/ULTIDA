"""Validate an operator's measurements; does not establish physical truth or machine certification."""
import csv
import json
import math
import sys


def validate(rows):
    failures = []
    seen = set()
    if not rows:
        return ['No measurements supplied']
    for i, row in enumerate(rows, 2):
        label = row.get('part_id', '')
        if not label or label in seen:
            failures.append(f'Row {i}: missing or duplicate part ID')
        seen.add(label)
        for axis in ('length', 'width', 'thickness'):
            try:
                expected = float(row[f'expected_{axis}_mm'])
                measured = float(row[f'measured_{axis}_mm'])
                tolerance = float(row[f'{axis}_tolerance_mm'])
                if not all(map(math.isfinite, (expected, measured, tolerance))) or min(expected, measured) <= 0 or tolerance < 0 or abs(expected-measured) > tolerance:
                    raise ValueError()
            except (KeyError, ValueError, TypeError):
                failures.append(f'Row {i} {label}: invalid or out-of-tolerance {axis}')
        for field in ('face_a_match', 'face_b_match', 'grain_match', 'assembly_pass'):
            if row.get(field) != 'yes':
                failures.append(f'Row {i} {label}: {field} not verified')
        try:
            qr = json.loads(row.get('qr_payload', ''))
            if qr.get('v') != 1 or qr.get('part') != label or qr.get('scene') != row.get('scene_id') or qr.get('project') != row.get('project_id') or not row.get('scene_id') or not row.get('project_id'):
                raise ValueError()
        except (ValueError, AttributeError, TypeError):
            failures.append(f'Row {i} {label}: QR identity mismatch')
        if not row.get('operator') or not row.get('evidence_file'):
            failures.append(f'Row {i} {label}: missing operator or evidence reference')
    return failures


if __name__ == '__main__':
    with open(sys.argv[1], newline='', encoding='utf-8-sig') as source:
        failures = validate(list(csv.DictReader(source)))
    print(json.dumps({'recorded_measurements': 'failed' if failures else 'passed', 'physical_signoff': 'requires workshop reviewer', 'failures': failures}, indent=2))
    sys.exit(bool(failures))
