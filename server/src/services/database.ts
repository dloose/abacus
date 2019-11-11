import * as pg from "pg";
import * as Config from "./config";

export const get: (reconfigure?: boolean) => pg.Pool = (function () {

    let Pool: pg.Pool | null;

    function reconfigurePool(config: Config.DatabaseConfig): pg.Pool {
        if (Pool) {
            // I don't really care about the database error because I'm about to make a new pool anyway.
            // This probably means that there's still an active connection or something... it might make
            // sense to retry. But like, this will only be done during tests so does it really matter?
            Pool.end().catch((error) => console.error("error closing pool during database reconfiguration", {error}));
        }

        Pool = new pg.Pool(config);
        return Pool;
    }

    return (reconfigure: boolean = false): pg.Pool => {
        if (reconfigure || !Pool) {
            const config: Config.DatabaseConfig = Config.get().database;
            Pool = reconfigurePool(config);
        }
        return Pool;
    };
})();

export async function connect(): Promise<pg.PoolClient> {
    return get().connect();
}
