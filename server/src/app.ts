import * as express from "express";

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

router.use(notFound);
router.use(errorHandler);

const app = express();
app.use("/", router);

app.listen(3000, () => {
    console.log(`Server running on port 3000`);
});

