"""Turn an Npgsql connection string into libpq environment variables (DEC-036).

The backup workflow reuses DATABASE_MIGRATION_CONNECTION (Npgsql format, written for the EF Core
migration bundle) to run pg_dump, which only understands libpq settings. Reading the string from
an environment variable and printing PGHOST=... lines keeps the password out of command lines and
shell quoting. Usage: NPGSQL_CONNECTION='Host=...;...' python3 npgsql_to_pgenv.py > pg.env
"""

import os
import sys

KEYS = {
    "host": "PGHOST",
    "server": "PGHOST",
    "port": "PGPORT",
    "database": "PGDATABASE",
    "db": "PGDATABASE",
    "username": "PGUSER",
    "user id": "PGUSER",
    "userid": "PGUSER",
    "user": "PGUSER",
    "password": "PGPASSWORD",
    "pwd": "PGPASSWORD",
    "ssl mode": "PGSSLMODE",
    "sslmode": "PGSSLMODE",
    "channel binding": "PGCHANNELBINDING",
    "channelbinding": "PGCHANNELBINDING",
}

SSL_MODES = {
    "disable": "disable",
    "allow": "allow",
    "prefer": "prefer",
    "require": "require",
    "verifyca": "verify-ca",
    "verifyfull": "verify-full",
}

CHANNEL_BINDING = {"disable": "disable", "prefer": "prefer", "require": "require"}


def convert(connection: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for part in connection.split(";"):
        if not part.strip():
            continue
        key, sep, value = part.partition("=")
        if not sep:
            raise ValueError("every setting must be key=value")
        name = KEYS.get(key.strip().lower())
        if name is None:
            continue  # pooling and other Npgsql-only settings
        value = value.strip()
        if "\n" in value or "\r" in value:
            raise ValueError(f"{name} contains a line break")
        if name == "PGSSLMODE":
            value = SSL_MODES[value.replace("-", "").replace(" ", "").lower()]
        elif name == "PGCHANNELBINDING":
            value = CHANNEL_BINDING[value.lower()]
        env[name] = value

    missing = {"PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"} - env.keys()
    if missing:
        raise ValueError("missing " + ", ".join(sorted(missing)))
    return env


def main() -> int:
    connection = os.environ.get("NPGSQL_CONNECTION", "")
    try:
        env = convert(connection)
    except (ValueError, KeyError) as error:
        # Never echo the input: it holds the password.
        print(f"Invalid connection string: {error}", file=sys.stderr)
        return 1
    for name, value in env.items():
        print(f"{name}={value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
