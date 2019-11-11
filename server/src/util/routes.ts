import * as express from "express";

export function asyncRoute(fn: express.Handler): express.Handler {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (e) {
            next(e);
        }
    };
}