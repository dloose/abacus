import os
import psycopg2
from contextlib import contextmanager


@contextmanager
def connect():
    params = {
        "host": os.environ["POSTGRES_HOST"],
        "port": os.environ["POSTGRES_PORT"],
        "dbname": os.environ["POSTGRES_DB"],
        "user": os.environ["POSTGRES_USER"],
        "password": os.environ["POSTGRES_PASSWORD"],
    }
    conn = None
    try:
        with psycopg2.connect(**params) as conn:
            yield conn
    finally:
        if conn:
            conn.close()
