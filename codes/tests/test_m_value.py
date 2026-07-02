import csv, math, os, sys, tempfile, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import m_value_cal as M

REF = [-2.0, -1.0, 0.0, 1.0, 2.0]


class TestMValue(unittest.TestCase):
    def test_center(self):
        # below=3/5=0.6, above=3/5=0.6 -> 2*0.6=1.2 capped to 1.0
        self.assertAlmostEqual(M.m_value(0.0, REF), 1.0)

    def test_tail(self):
        # claim 2: below=5/5=1.0, above=1/5=0.2 -> 2*0.2=0.4
        self.assertAlmostEqual(M.m_value(2.0, REF), 0.4)

    def test_extreme_and_cap(self):
        m = M.m_value(100.0, REF)          # below=1.0, above=0 -> 0
        self.assertAlmostEqual(m, 0.0)
        self.assertLessEqual(M.m_value(0.0, REF), 1.0)


class TestPercentile(unittest.TestCase):
    def test_interpolation(self):
        s = list(range(101))               # already sorted
        self.assertAlmostEqual(M.percentile_sorted(s, 2.5), 2.5)
        self.assertAlmostEqual(M.percentile_sorted(s, 97.5), 97.5)

    def test_single_element(self):
        self.assertEqual(M.percentile_sorted([7.0], 50), 7.0)

    def test_empty_is_nan(self):
        self.assertTrue(math.isnan(M.percentile_sorted([], 50)))


class TestStatOf(unittest.TestCase):
    def test_estimate(self):
        self.assertAlmostEqual(M.stat_of({"ame": "0.4", "ame_se": "0.1"}, "estimate"), 0.4)

    def test_z(self):
        self.assertAlmostEqual(M.stat_of({"ame": "0.4", "ame_se": "0.1"}, "z"), 4.0)

    def test_z_bad_se_is_nan(self):
        self.assertTrue(math.isnan(M.stat_of({"ame": "0.4", "ame_se": "0"}, "z")))


class TestReadSpecs(unittest.TestCase):
    def test_qc_filters(self):
        d = tempfile.mkdtemp()
        f = os.path.join(d, "results_r1.csv")
        with open(f, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["ame", "ame_se"])
            w.writerow(["0.4", "0.1"])   # valid
            w.writerow(["0.5", "0"])     # se=0 -> drop
            w.writerow(["0.5", ""])      # se missing -> drop
            w.writerow(["", "0.1"])      # estimate missing -> drop
        ref = M.read_specs([f])
        self.assertEqual(ref["estimate"], [0.4])
        self.assertEqual(len(ref["z"]), 1)
        self.assertAlmostEqual(ref["z"][0], 4.0)


if __name__ == "__main__":
    unittest.main()
