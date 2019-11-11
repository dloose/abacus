CREATE TABLE symbols (
    symbol              TEXT PRIMARY KEY,
    added_date          TIMESTAMP NOT NULL DEFAULT NOW(),
    initial_import_date TIMESTAMP,
    last_update_date    TIMESTAMP
);

CREATE TABLE symbol_data (
    symbol  TEXT    NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
    date    DATE    NOT NULL,
    open    NUMERIC NOT NULL,
    close   NUMERIC NOT NULL,
    high    NUMERIC NOT NULL,
    low     NUMERIC NOT NULL,
    sma100d NUMERIC,
    rsi100d NUMERIC
);

CREATE UNIQUE INDEX ON symbol_data(symbol, date DESC);