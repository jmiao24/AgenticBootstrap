import contextlib, csv, io, os, sys, tempfile, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import aggregate as A

HEADER = ("model_id", "ame", "ame_se", "ame_pvalue")


def write_final(root, persona, run, rows):
    d = os.path.join(root, persona, f"run_{run}")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "results_final.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(HEADER)
        for r in rows:
            w.writerow(r)


class TestAggregate(unittest.TestCase):
    def test_uses_final_row_not_last(self):
        root = tempfile.mkdtemp()
        # a trailing 'extra' row after 'final' must be ignored
        write_final(root, "anti", "01", [["final", "0.2", "0.05", "0.01"],
                                          ["extra", "9.9", "1", "0.5"]])
        write_final(root, "pro", "01", [["final", "-0.2", "0.05", "0.01"]])
        est = {r["persona"]: r["est"] for r in A.load_finals(root)}
        self.assertAlmostEqual(est["anti"], 0.2)
        self.assertAlmostEqual(est["pro"], -0.2)

    def test_pairwise_gap_for_three_personas(self):
        root = tempfile.mkdtemp()
        for p, v in [("anti", "0.2"), ("pro", "-0.2"), ("neutral", "0.0")]:
            write_final(root, p, "01", [["final", v, "0.05", "0.2"]])
        buf = io.StringIO()
        old = sys.argv
        sys.argv = ["aggregate.py", root]
        try:
            with contextlib.redirect_stdout(buf):
                A.main()
        finally:
            sys.argv = old
        out = buf.getvalue()
        self.assertIn("Gap in mean estimate", out)   # regression: default run has 3 personas
        self.assertIn("anti - neutral", out)          # pairwise gaps present


if __name__ == "__main__":
    unittest.main()
