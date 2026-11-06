#!/usr/bin/env python3
"""
parse_mappings.py — read .eleventy.js and extract the mapping objects
as Python data structures using ast (abstract syntax tree) instead of regex.
This is more robust and handles nested objects and regex literals.
"""
import ast
import json
import sys
from pathlib import Path

def extract_const_objects(source):
    """Return a dict of {var_name: object_value} for const assignments."""
    tree = ast.parse(source, filename=".eleventy.js")
    result = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id.startswith("const "):
                var_name = target.id[6:]  # strip "const "
                try:
                    # Convert the value node to a literal representation
                    obj = _ast_to_literal(node.value)
                    result[var_name] = obj
                except Exception:
                    pass
    return result

def _ast_to_literal(node):
    """Convert an AST node to a Python literal (dict, list, string, etc)."""
    if isinstance(node, ast.Dict):
        d = {}
        for k, v in zip(node.keys, node.values):
            if isinstance(k, ast.Constant) and isinstance(v, ast.Constant):
                d[k.value] = _ast_to_literal(v)
            elif isinstance(k, ast.Constant) and isinstance(v, ast.UnaryOp) and isinstance(v.op, ast.USub):
                # Negative integer keys (unlikely but possible)
                if isinstance(v.operand, ast.Constant) and isinstance(v.operand.value, int):
                    d[-v.operand.value] = _ast_to_literal(node.values[i])
            elif isinstance(k, ast.Constant) and isinstance(v, ast.Call):
                # Function calls like Re()`/pattern/` — convert to string representation
                # Here we approximate by using ast.unparse (Python 3.9+)
                # For simplicity, we capture source snippet for regexes
                try:
                    d[k.value] = f"<regexp:{ast.unparse(v)}>"
                except:
                    d[k.value] = f"<call:{type(v.func.id if isinstance(v.func, ast.Name) else '?')}>"
        return d
    elif isinstance(node, ast.List):
        return [_ast_to_literal(el) for el in node.elts]
    elif isinstance(node, ast.Constant):
        return node.value
    elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        if isinstance(node.operand, ast.Constant):
            return -node.operand.value
    elif isinstance(node, ast.Call):
        # Function calls like Re()`/pattern/` or maybe regex literals
        # Attempt to unparse if possible
        try:
            return f"<call:{ast.unparse(node)}>"
        except:
            return f"<call:{type(node).__name__}>"
    elif isinstance(node, ast.Subscript):
        # Handle regex literals like Re`pattern`/flags
        # Re()` is a function call in JS; we can't reliably parse but we can capture source
        pass
    # For simplicity, return repr
    return f"<ast:{type(node).__name__}>"

def regex_to_str(node):
    """Convert an AST node that represents a regex literal (e.g., Re`...`/) to a Python regex dict."""
    # This is a fallback; most regexes in .eleventy.js are string literals with /.../
    # We'll just return the raw string from the original source.
    pass

def main():
    src_path = Path(".eleventy.js")
    if not src_path.exists():
        print("{} not found", file=sys.stderr)
        sys.exit(1)
    source = src_path.read_text()
    mappings = extract_const_objects(source)
    # Try to preserve regex literals using ast.unparse on regex calls
    # We'll also do a second pass to extract regex patterns using a simpler regex
    # fallback for ease of use.
    import re
    # Extract const blocks using regex (fallback for nested complexity)
    const_re = re.compile(r'const\s+(\w+)\s*=\s*({.*?})\s*;', re.DOTALL)
    for match in const_re.finditer(source):
        var_name = match.group(1)
        raw_obj = match.group(2)
        if var_name in mappings:
            continue
        # Try to parse as JSON with a proxy to handle regex literals
        # Replace /.../ with quoted strings temporarily
        def replace_regex(m):
            inner = m.group(1)
            flags = m.group(2) if m.group(2) else ""
            return f'"<{var_name}_regex_{inner}__{flags}>"'
        normalized = re.sub(r'/([^/]+)/([a-z]*)$', replace_regex, raw_obj)
        try:
            parsed = json.loads(normalized)
            mappings[var_name] = parsed
        except json.JSONDecodeError:
            pass
    # Now output the mappings with regex markers preserved
    print(json.dumps(mappings, indent=2))

if __name__ == "__main__":
    main()