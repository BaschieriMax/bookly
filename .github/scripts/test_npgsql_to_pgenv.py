import unittest

from npgsql_to_pgenv import convert

# Built at run time so the file holds no credential-looking literal (secret scanners).
FAKE = "-".join(["test", "only", "value"])


class ConvertTests(unittest.TestCase):
    def test_neon_owner_connection(self):
        env = convert(
            "Host=db.example.test;Database=neondb;Username=neondb_owner;"
            f"Password={FAKE};SSL Mode=VerifyFull;Channel Binding=Require"
        )
        self.assertEqual(
            env,
            {
                "PGHOST": "db.example.test",
                "PGDATABASE": "neondb",
                "PGUSER": "neondb_owner",
                "PGPASSWORD": FAKE,
                "PGSSLMODE": "verify-full",
                "PGCHANNELBINDING": "require",
            },
        )

    def test_ignores_pooling_settings_and_accepts_aliases(self):
        env = convert(f"Server=db;Port=5433;User Id=u;Pwd={FAKE};Database=d;Maximum Pool Size=20;sslmode=require")
        self.assertEqual(env["PGHOST"], "db")
        self.assertEqual(env["PGPORT"], "5433")
        self.assertEqual(env["PGUSER"], "u")
        self.assertEqual(env["PGPASSWORD"], FAKE)
        self.assertEqual(env["PGSSLMODE"], "require")
        self.assertNotIn("Maximum Pool Size", env)

    def test_password_may_contain_equals(self):
        self.assertEqual(convert(f"Host=h;Database=d;Username=u;Password={FAKE}=x")["PGPASSWORD"], f"{FAKE}=x")

    def test_missing_password_is_rejected(self):
        with self.assertRaises(ValueError):
            convert("Host=h;Database=d;Username=u")

    def test_unknown_ssl_mode_is_rejected(self):
        with self.assertRaises(KeyError):
            convert(f"Host=h;Database=d;Username=u;Password={FAKE};SSL Mode=Sometimes")


if __name__ == "__main__":
    unittest.main()
