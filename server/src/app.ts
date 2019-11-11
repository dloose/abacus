import * as express from "express";
import symbols from "./routes/symbols";
import * as Config from "./services/config";

function notFound(req: express.Request, res: express.Response, next: express.NextFunction): void {
    res.sendStatus(404);
}

function errorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).send(err.toString());
}

const router = express.Router();

router.use("/symbol", symbols());
router.use(notFound);
router.use(errorHandler);

const app = express();
app.use("/", router);

const config: Config.AppConfig = Config.get().app;
app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});

