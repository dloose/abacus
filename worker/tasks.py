import logging
import os

import pandas as pd
import requests
from psycopg2 import sql
from psycopg2.extras import DictCursor, execute_values

from database import connect
from worker import app

logger = logging.getLogger(__name__)


def request_stock_data(symbol, output_size="compact"):
    api_key = os.environ["ALPHA_ADVANTAGE_API_KEY"]
    url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize={output_size}&apikey={api_key}&datatype=csv"
    with requests.get(url, stream=True) as response:
        response.raise_for_status()
        lines = (line.decode("ascii") for line in response.iter_lines())

        headers = next(lines).split(",")

        raw_data = (dict(zip(headers, line.split(","))) for line in lines)

        for item in raw_data:
            yield {
                "symbol": symbol,
                "date": item["timestamp"],
                "open": float(item["open"]),
                "close": float(item["close"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
            }


def compute_sma_rsi(symbol, start=None, window_size=100):
    logger.info(f"Computing SMA and RSI for {symbol}")

    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        query = sql.Composed([
            sql.SQL("""
                SELECT 
                    date, open, close 
                FROM symbol_data
                WHERE symbol = %s
            """),
            sql.SQL("AND date > %s - '200 days' :: INTERVAL") if start else sql.SQL(""),
            sql.SQL("ORDER BY date")
        ])
        params = [symbol, start] if start else [symbol]
        cur.execute(query, params)

        data = [dict(r) for r in cur.fetchall()]
        df = pd.DataFrame.from_records(data)

    open = df["open"]
    close = df["close"]

    sma = close.rolling(window_size).mean()

    # Get the difference in price from previous step
    delta = close - open

    # Make the positive gains (up) and negative gains (down) Series
    up, down = delta.copy(), delta.copy()
    up[up < 0] = 0
    down[down > 0] = 0

    # Calculate the SMA
    roll_up = up.rolling(window_size).mean()
    roll_down = down.abs().rolling(window_size).mean()

    # Calculate the RSI based on SMA
    rsi_step1 = roll_up / roll_down
    rsi_step2 = 100.0 - (100.0 / (1.0 + rsi_step1))

    df.insert(len(df.columns), "sma", sma)
    df.insert(len(df.columns), "rsi", rsi_step2)

    data = [
        {
            "symbol": symbol,
            "date": date,
            "sma": sma,
            "rsi": rsi
        }
        for date, sma, rsi in zip(df["date"], df["sma"], df["rsi"])
    ]

    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        execute_values(
            cur,
            """
                UPDATE symbol_data 
                SET 
                    rsi100d = data.rsi, 
                    sma100d = data.sma
                FROM (VALUES %s) AS data (symbol, date, sma, rsi)
                WHERE symbol_data.symbol = data.symbol AND symbol_data.date = data.date
            """,
            data,
            template="(%(symbol)s, %(date)s, %(sma)s, %(rsi)s)",
            page_size=1000
        )

        cur.execute("UPDATE symbols SET last_update_date = CURRENT_DATE WHERE symbol = %s", [symbol])


@app.task()
def initial_import(symbol):
    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute("SELECT symbol, initial_import_date FROM symbols WHERE symbol = %s", [symbol])
        symbol_rec = cur.fetchone()
        if not symbol_rec:
            raise ValueError(f"Unknown symbol: {symbol}")
        if symbol_rec["initial_import_date"]:
            raise ValueError(f"Initial import completed on {symbol_rec['initial_import_date']} for symbol {symbol}")

    logger.info(f"Running initial import for {symbol}")

    # Fetch the data
    data = request_stock_data(symbol, output_size="full")

    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        execute_values(
            cur,
            "INSERT INTO symbol_data (symbol, date, open, close, high, low) VALUES %s",
            data,
            template="(%(symbol)s, %(date)s, %(open)s, %(close)s, %(high)s, %(low)s)",
            page_size=1000
        )

        cur.execute("UPDATE symbols SET initial_import_date = NOW() WHERE symbol = %s", [symbol])

    compute_sma_rsi(symbol)


@app.task()
def update_symbol(symbol):
    logger.info(f"Running update for {symbol}")
    compute_sma_rsi(symbol)


@app.task()
def update_symbols():
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT symbol FROM symbols WHERE last_update_date < CURRENT_DATE")
        symbols = [record[0] for record in cur.fetchall()]

    for symbol in symbols:
        update_symbol.delay(symbol)
