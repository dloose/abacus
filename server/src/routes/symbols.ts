import * as express from "express";
import * as pg from "pg";
import sql from "sql-template-tag";
import {call} from "../services/celery";
import {connect} from "../services/database";
import {asyncRoute} from "../util/routes";

function normalizeSymbol(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.params.symbol) {
        req.params.symbol = req.params.symbol.toUpperCase();
    }
    next();
}

export default function init(): express.Router {
    const router = express.Router();

    // get a list of symbols we're monitoring
    router.get("/",
        asyncRoute(async function listSymbols(req, res) {
            const conn: pg.PoolClient = await connect();

            const data = await conn.query(sql`
                SELECT *
                FROM symbols
                ORDER BY
                    symbol
            `);

            conn.release();

            return res.status(200).json(data.rows);
        }));

    // add a new symbol
    router.post("/:symbol",
        normalizeSymbol,
        asyncRoute(async function addSymbol(req, res) {
            const symbol = req.params.symbol;

            const conn: pg.PoolClient = await connect();

            // use an UPSERT to add the requested symbol to the symbols table, if necessary
            const insertResult =
                await conn.query(sql`
                    INSERT INTO symbols (symbol, added_date) 
                    VALUES (${symbol}, NOW()) 
                    ON CONFLICT DO NOTHING
                    RETURNING *
                `);

            conn.release();

            // if the INSERT was successful, run the initial import task and wait for it to complete
            if (insertResult.rowCount !== 0) {
                call("tasks.initial_import", [symbol]).get().catch(err =>
                    console.error(`Initial import failed for ${symbol}: ${err}`));
                return res.status(201).json(insertResult.rows[0]);
            }

            return res.status(400).send(`Symbol ${symbol} already exists.`);
        }));

    // return data for a single symbol
    router.get("/:symbol",
        normalizeSymbol,
        asyncRoute(async function getSymbolData(req, res) {
            const symbol = req.params.symbol;

            const conn: pg.PoolClient = await connect();

            const data = await conn.query(sql`
                SELECT 
                    symbols.*, 
                    coalesce(
                        jsonb_agg(symbol_data.* ORDER BY symbol_data.date DESC) 
                            FILTER (WHERE symbol_data.date BETWEEN CURRENT_DATE - '100 days' :: INTERVAL AND CURRENT_DATE), 
                        '[]' :: JSONB) AS data 
                FROM symbols
                  LEFT JOIN symbol_data ON symbols.symbol = symbol_data.symbol
                WHERE symbols.symbol = ${symbol} 
                GROUP BY symbols.symbol
            `);

            conn.release();

            if (data.rowCount === 0) {
                return res.sendStatus(404);
            }

            if (data.rowCount !== 1) {
                return res.sendStatus(500);
            }

            return res.status(200).json(data.rows[0]);
        }));

    return router;
}