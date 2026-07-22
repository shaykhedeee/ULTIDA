#!/usr/bin/env python
import sys
import os

try:
    import ezdxf
except ImportError:
    print("WARNING: ezdxf is not installed. Skipping CAD validation.", file=sys.stderr)
    sys.exit(0)

def validate_dxf(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}", file=sys.stderr)
        return False

    try:
        doc = ezdxf.readfile(filepath)
    except Exception as e:
        print(f"Error reading DXF file structure: {e}", file=sys.stderr)
        return False

    # Check for core layers
    dxf_layers = {layer.dxf.name for layer in doc.layers}
    required_layers = {"A-WALL", "A-OPENING", "A-MOD", "A-ANNO"}
    missing = required_layers - dxf_layers
    if missing:
        print(f"Warning: Missing standard layers: {missing}", file=sys.stderr)
        if len(dxf_layers.intersection(required_layers)) == 0:
            print("Error: None of the standard design layers exist in the DXF file.", file=sys.stderr)
            return False

    # Check entities count
    msp = doc.modelspace()
    entities = list(msp)
    if not entities:
        print("Error: Model space has no entities.", file=sys.stderr)
        return False

    print(f"DXF Validation PASS: {filepath} ({len(entities)} entities, layers: {list(dxf_layers)})")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_dxf.py <path_to_dxf_file>")
        sys.exit(1)
    
    success = validate_dxf(sys.argv[1])
    sys.exit(0 if success else 1)
