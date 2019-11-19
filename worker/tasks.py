import csv
import datetime
import logging
import os
from pathlib import Path

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

        for raw_item in raw_data:
            try:
                item = {
                    "symbol": symbol,
                    "date": raw_item["timestamp"],
                    "open": float(raw_item["open"]),
                    "close": float(raw_item["close"]),
                    "high": float(raw_item["high"]),
                    "low": float(raw_item["low"]),
                }
                yield item
            except KeyError:
                logger.exception(f"Invalid item in raw data: {raw_item}")
                raise


# Alpha Advantage will spit these numbers out too, but the calculation isn't too hard
@app.task()
def compute_sma_rsi(symbol, start=None):
    logger.info(f"Computing SMA and RSI for {symbol}")

    window_size = 100
    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        # When start is specified, we go back 200 days even though the window_size is 100. This is a lazy way to
        # account for weekends and holidays. I'm assuming "100 days" means 100 market days and not 100 calendar days.
        query = sql.Composed([
            sql.SQL("""
                SELECT 
                    date, open, close 
                FROM symbol_data
                WHERE symbol = %s
            """),
            sql.SQL(" AND date > %s :: DATE - '200 days' :: INTERVAL") if start else sql.SQL(""),
            sql.SQL(" ORDER BY date")
        ])
        params = [symbol, start] if start else [symbol]
        cur.execute(query, params)

        data = [dict(r) for r in cur.fetchall()]
        df = pd.DataFrame.from_records(data)

    open = df["open"]
    close = df["close"]

    sma = close.rolling(window_size).mean()

    # Code adapted from https://stackoverflow.com/a/29400434

    # Get the difference in price
    delta = close - open

    # Make the positive gains (up) and negative gains (down) Series
    up, down = delta.copy(), delta.copy()
    up[up < 0] = 0
    down[down > 0] = 0

    # Calculate the SMA for both series
    up_sma = up.rolling(window_size).mean()
    down_sma = down.abs().rolling(window_size).mean()

    # Calculate the RSI based on the SMA series
    rsi_step1 = up_sma / down_sma
    rsi_step2 = 100.0 - (100.0 / (1.0 + rsi_step1))

    # Reformat the data for easier database updates
    df.insert(len(df.columns), "sma", sma)
    df.insert(len(df.columns), "rsi", rsi_step2)
    df = df[df["sma"].notnull()]
    df = df[df["rsi"].notnull()]
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

    # Fetch the full 20 years of data for the initial import
    data = request_stock_data(symbol, output_size="full")

    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        execute_values(
            cur,
            "INSERT INTO symbol_data (symbol, date, open, close, high, low) VALUES %s",
            data,
            template="(%(symbol)s, %(date)s, %(open)s, %(close)s, %(high)s, %(low)s)",
            page_size=1000
        )

        cur.execute("""
            UPDATE symbols 
            SET initial_import_date = CURRENT_TIMESTAMP, last_update_date = CURRENT_TIMESTAMP 
            WHERE symbol = %s
        """, [symbol])

    compute_sma_rsi(symbol)


@app.task()
def update_symbol(symbol):
    logger.info(f"Running update for {symbol}")

    # The "compact" option gets 100 days worth of data instead of 20 years.
    # A little more flexibility here would be nice.
    data = request_stock_data(symbol, output_size="compact")

    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        # The only record that should change is today's so updating all of them is wasteful. Oh well.
        execute_values(
            cur,
            """
                INSERT INTO symbol_data (symbol, date, open, close, high, low) 
                VALUES %s
                ON CONFLICT (symbol, date) DO UPDATE SET
                    OPEN = EXCLUDED.open,
                    CLOSE = EXCLUDED.close,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low
            """,
            data,
            template="(%(symbol)s, %(date)s, %(open)s, %(close)s, %(high)s, %(low)s)",
        )

        cur.execute("""
            UPDATE symbols 
            SET last_update_date = CURRENT_TIMESTAMP 
            WHERE symbol = %s
        """, [symbol])

    start_date = datetime.date.today().isoformat()
    compute_sma_rsi(symbol, start=start_date)


@app.task()
def update_symbols():
    with connect() as conn, conn.cursor() as cur:
        # I only update the least-recently-updated symbol, but I run this task every 5 minutes to round-robin the
        # symbols I'm tracking. This isn't ideal.
        cur.execute("""
            SELECT symbol 
            FROM symbols
            WHERE initial_import_date IS NOT NULL 
            ORDER BY last_update_date 
            LIMIT 1
        """)
        symbols = [record[0] for record in cur.fetchall()]

    for symbol in symbols:
        update_symbol.delay(symbol)


@app.task()
def generate_csv_report(symbol):
    logger.info(f"Generating CSV report for {symbol}")

    # Select 1 years worth of data for the current symbol
    with connect() as conn, conn.cursor(cursor_factory=DictCursor) as cur:
        cur.execute(
            """
                SELECT symbol, date, open, close, high, low, sma100d, rsi100d
                FROM symbol_data 
                WHERE symbol = %s AND date > CURRENT_DATE - '1 year' :: INTERVAL
                ORDER BY date 
            """,
            [symbol]
        )

        data = [dict(r) for r in cur.fetchall()]

    # Dump the data to the file system in CSV format. In real life I'd probably write this to S3 and link to it from
    # the client app.
    date_string = datetime.date.today().isoformat()
    file_name = f"{date_string}.csv"
    report_path = Path(os.environ["CSV_REPORT_ROOT_PATH"], symbol, file_name)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open('w') as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=["symbol", "date", "open", "close", "high", "low", "sma100d", "rsi100d"]
        )
        writer.writeheader()
        for d in data:
            writer.writerow(d)


@app.task()
def generate_csv_reports():
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT symbol FROM symbols")
        symbols = [record[0] for record in cur.fetchall()]

    for symbol in symbols:
        generate_csv_report.delay(symbol)
