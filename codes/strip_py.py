#!/usr/bin/env python3
"""Strip module/function/class docstrings and all #-comments from a .py file.

Usage: strip_py.py <input.py> <output.py>

Used by Round1_reviewer.mjs to guarantee the reviewer
sees only executable code, even when the analyst's submitted script contains
docstrings or comments that could leak selection rationale.
"""
import ast
import io
import sys
import tokenize


def strip_docstrings(src: str) -> str:
    tree = ast.parse(src)

    def _drop_doc(body):
        if (
            body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
        ):
            body.pop(0)

    _drop_doc(tree.body)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            _drop_doc(node.body)
            if not node.body:
                node.body.append(ast.Pass())

    return ast.unparse(tree)


def strip_comments(src: str) -> str:
    out = io.StringIO()
    tokens = tokenize.generate_tokens(io.StringIO(src).readline)
    prev_end = (1, 0)
    for tok in tokens:
        if tok.type == tokenize.COMMENT:
            continue
        start_row, start_col = tok.start
        end_row, end_col = tok.end
        if start_row > prev_end[0]:
            out.write("\n" * (start_row - prev_end[0]))
            prev_end = (start_row, 0)
        if start_col > prev_end[1]:
            out.write(" " * (start_col - prev_end[1]))
        out.write(tok.string)
        prev_end = (end_row, end_col)
    return out.getvalue()


def main():
    if len(sys.argv) != 3:
        print("usage: strip_py.py <input.py> <output.py>", file=sys.stderr)
        sys.exit(2)
    inp, outp = sys.argv[1], sys.argv[2]
    src = open(inp).read()
    try:
        cleaned = strip_comments(strip_docstrings(src))
    except SyntaxError:
        cleaned = src
    open(outp, "w").write(cleaned)


if __name__ == "__main__":
    main()
