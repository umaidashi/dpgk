"""各 run の outputs を dpgk_lint にかけて lint.json を書く。"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "skills/dpgk/scripts"))
from dpgk_lint import lint
for out in sorted(Path(sys.argv[1]).glob("*/*/run-1/outputs")):
    res = []
    for f in sorted(out.rglob("*")):
        if f.suffix in (".svg", ".html"):
            score, hits = lint(f.read_text(encoding="utf-8"), f.suffix == ".svg")
            res.append({"file": f.name, "score": score, "ids": [h["id"] for h in hits]})
    (out.parent / "lint.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    print(out.parent.relative_to(sys.argv[1]), res)
