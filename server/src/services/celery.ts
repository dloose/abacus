import * as Celery from "celery-ts";
import * as Config from "./config";

export const getClient: (reconfigure?: boolean) => Celery.Client = (function () {

    let client: Celery.Client | null;

    return (reconfigure: boolean = false): Celery.Client => {
        if (reconfigure && client) {
            client.end().catch((error) => console.error("error closing pool during Celery client reconfiguration", {error}));
            client = null;
        }
        if (!client) {
            client = Celery.createClient({
                brokerUrl: Config.get().celery.brokerUrl,
                resultBackend: Config.get().celery.resultBackend,
            });
        }
        return client;
    };
})();

export function callWithClient<T>(
    client: Celery.Client,
    name: string,
    args: any[] = [],
    kwargs: { [k: string]: any } = {},
    options: Partial<Celery.TaskApplyOptions> = {}
): Celery.Result<T> {
    return client.createTask<T>(name).applyAsync({...options, args, kwargs})
}

export function call<T>(
    name: string,
    args: any[] = [],
    kwargs: { [k: string]: any } = {},
    options: Partial<Celery.TaskApplyOptions> = {}
): Celery.Result<T> {
    const client = getClient();
    return callWithClient<T>(client, name, args, kwargs, options);
}
