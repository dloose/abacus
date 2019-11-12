# Running

To start the back end, run the following commands from the repository's root directory.

1. Copy the `.env.example` file to `.env`
2. Uncomment the `POSTGRES_PASSWORD` line in the `.env` file and enter a suitable password
3. Uncomment the `ALPHA_ADVANTAGE_API_KEY` line in the `.env` file and replace the value with your API key
4. Start the application with `docker-compose up`

To run the front end, you will need a few pre-requisites:

* Node 12
* Yarn

To start the front end, change to the `client` directory and run the following commands.

1. `yarn install`
2. `PORT=3001 yarn start`

I did not have time to package the front end application so it is configured to proxy API requests to `localhost:3000`.
The `docker-compose.yml` file is configured to forward that port into the Docker container.

# API Usage

## Adding a symbol

By default, the application is not configured to monitor any stock symbols. You can add a symbol by running a command 
like `curl -XPOST http://localhost:3000/symbol/AAPL`. That will add the symbol to the set of symbols to monitor and 
launch the initial import task. The initial import task loads all of the historical data available from Alpha 
Advantage's API into the `symbol_data` table in the Postgres database. 

## Retrieving symbol data

You can retrieve data for a stock symbol using a command like `curl -XGET http://localhost:3000/symbol/AAPL`. Currently, 
it always returns data for the last 100 calendar days. You won't see 100 data points because there are no data points
for weekends and market holidays.

I initially planned to make the endpoint take start & end dates as query parameters, but I ran out of time.

## Retrieving a list of monitored symbols

You can retrieve the list of symbols the system is monitoring by using a command like 
`curl -XGET http://localhost:3000/symbol`. 

I intended to use this to populate a drop-down menu in the client.

## CSV reports

CSV reports are generated in a Docker volume at the moment. That volume is mounted in the `worker` service at 
`/reports`. Reports are generated with a file name like `/reports/<SYMBOL>/<YYYY-MM-DD>.csv`. You can view a report
using `docker-compose exec worker cat /reports/<SYMBOL>/<YYYY-MM-DD>.csv` or a `docker cp` command.

You could also modify the `docker-compose.yml` file to map a local directory to `/reports` instead of the volume.

# Structure

The `docker-compose.yml` file builds and runs the following services:

* a Postgres database 
* a RabbitMQ instance
* a Celery worker
* a Celery beat scheduler
* a NodeJS application

## Postgres database

When the Postgres instance launches for the first time, it executes the DDL in `database/stock_schema.sql` to initialize
the database schema.

## RabbitMQ instance

The RabbitMQ instance serves as the broker for the Celery task queue.

## Celery worker

The Celery worker schedules 2 periodic tasks:

1. `update_symbols`, which runs hourly and launches tasks to update each symbol the system is monitoring
2. `generate_reports`, which runs once per day at 7pm and launches tasks to generate the CSV reports

All of the Celery tasks can be found in the `worker/tasks.py` file.

## NodeJS server

The structure of this repository is a stripped down version of the structure I've used in a few personal projects. 
The interesting bits are in `src/routes/symbols.ts`, which implements the 3 routes I would have used for the front end.

# Missing work

## Unit tests 

I do write unit tests in real life, but I focused on functionality in this case.

## Cloud architecture diagram

Again, this was a casualty of time. If I were to deploy this to AWS, I would create a Postgres RDS instance. I would 
remove RabbitMQ and Celery and use Lambda functions instead. The same Python code could be deployed to Lambda pretty 
simply using [Zappa](https://github.com/Miserlou/Zappa), but writing CSV reports to the file system wouldn't make much
sense so I would write them to an S3 bucket instead. Similarly, the NodeJS application could be deployed to Lambda 
using [Serverless](https://serverless.com/blog/serverless-express-rest-api/).