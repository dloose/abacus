import * as dotenv from "dotenv";

export interface Config {
    app: AppConfig;
    celery: CeleryConfiguration;
    database: DatabaseConfig;
}

type Environment = { [k: string]: string | undefined };

function getRequired(env: Environment, varName: string): string {
    const value = env[varName];
    if (!value) {
        throw new Error(`Missing required value for environment variable ${varName}`);
    }
    return value;
}

function parseIntWithDefault(env: Environment, varName: string, defValue: number): number {
    const stringValue = env[varName];
    if (!stringValue) {
        return defValue;
    }

    const value = parseInt(stringValue, 10);
    if (isNaN(value)) {
        throw new Error(`Invalid value for ${varName} environment variable: ${stringValue}`);
    }

    return value;
}

export interface AppConfig {
    port: number;
}

function parseAppConfig(env: Environment): AppConfig {
    return {port: parseIntWithDefault(env, "PORT", 3000)};
}

export interface CeleryConfiguration {
    brokerUrl: string;
    resultBackend: string;
}

function parseCeleryConfig(env: Environment): CeleryConfiguration {
    return {
        brokerUrl: getRequired(env, "CELERY_BROKER_URL"),
        resultBackend: getRequired(env, "CELERY_RESULT_BACKEND")
    };
}

export interface DatabaseConfig {
    user: string;
    database: string;
    password: string;
    host: string;
    schema: string;
    port: number;
    max: number;
    idleTimeoutMillis: number;
}

function parseDatabaseConfig(env: Environment): DatabaseConfig {
    return {
        user: getRequired(env, "POSTGRES_USER"),
        database: getRequired(env, "POSTGRES_DB"),
        password: getRequired(env, "POSTGRES_PASSWORD"),
        host: getRequired(env, "POSTGRES_HOST"),
        schema: getRequired(env, "POSTGRES_SCHEMA"),
        port: parseIntWithDefault(env, "POSTGRES_PORT", 5432),
        max: parseIntWithDefault(env, "POSTGRES_MAX_POOL_SIZE", 10),
        idleTimeoutMillis: parseIntWithDefault(env, "POSTGRES_IDLE_TIMEOUT_MILLIS", 30000),
    };
}

let Config: Config | null = null;

export function get(): Config {
    if (Config === null) {
        dotenv.config({path: "../.env"});
        Config = {
            app: parseAppConfig(process.env),
            celery: parseCeleryConfig(process.env),
            database: parseDatabaseConfig(process.env),
        };
    }
    return Config;
}