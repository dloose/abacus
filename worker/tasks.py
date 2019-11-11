import logging

from database import connect
from worker import app

logger = logging.getLogger(__name__)


@app.task()
def update_symbol(symbol):
    logger.info(f"Running update for {symbol}")


@app.task()
def update_symbols():
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT symbol FROM symbols WHERE last_update_date < CURRENT_DATE")
        symbols = [record[0] for record in cur.fetchall()]

    for symbol in symbols:
        update_symbol.delay(symbol)
