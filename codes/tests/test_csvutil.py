import math, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _csvutil import num, pick, finite, final_row


class TestNum(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(num("0.5"), 0.5)
        self.assertEqual(num("-3"), -3.0)

    def test_nan(self):
        for v in ("", None, "abc"):
            self.assertTrue(math.isnan(num(v)))


class TestPick(unittest.TestCase):
    def test_ame(self):
        self.assertEqual(pick({"ame": "0.4"}, ["ame", "estimate"]), "0.4")

    def test_estimate(self):
        self.assertEqual(pick({"estimate": "0.4"}, ["ame", "estimate"]), "0.4")

    def test_none(self):
        self.assertEqual(pick({"x": "1"}, ["ame", "estimate"]), "")

    def test_empty_value_skipped(self):
        self.assertEqual(pick({"ame": "", "estimate": "0.4"}, ["ame", "estimate"]), "0.4")


class TestFinite(unittest.TestCase):
    def test_drops_nan_and_inf(self):
        xs = [1.0, float("nan"), float("inf"), float("-inf"), 2.0]
        self.assertEqual(finite(xs), [1.0, 2.0])


class TestFinalRow(unittest.TestCase):
    def test_picks_final_not_last(self):
        recs = [{"model_id": "baseline"}, {"model_id": "final", "v": "1"}, {"model_id": "extra"}]
        self.assertEqual(final_row(recs)["v"], "1")

    def test_fallback_to_last(self):
        recs = [{"model_id": "a"}, {"model_id": "b", "v": "2"}]
        self.assertEqual(final_row(recs)["v"], "2")

    def test_empty_returns_none(self):
        self.assertIsNone(final_row([]))


if __name__ == "__main__":
    unittest.main()
