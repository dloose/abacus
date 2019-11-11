import os
from celery import Celery
from celery.schedules import crontab
from dotenv import find_dotenv, load_dotenv

load_dotenv(dotenv_path=find_dotenv(usecwd=True), verbose=True)

host = os.environ["RABBITMQ_HOST"]
user = os.environ["RABBITMQ_DEFAULT_USER"]
password = os.environ["RABBITMQ_DEFAULT_PASS"]
rabbitmq_url = f"amqp://{user}:{password}@{host}//"

app = Celery(
    "app",
    broker=rabbitmq_url,
    backend=rabbitmq_url,
    include=["tasks"]
)

app.conf.beat_schedule = {
    # Update symbols every hour. The service returns current day's result so this will change throughout the day
    "update_symbols": {
        "task": "tasks.update_symbols",
        "schedule": crontab(hour="*/1"),
    },
    # Generate the CSV reports after the market closes
    "generate_reports": {
        "task": "tasks.generate_csv_reports",
        "schedule": crontab(hour="19"),
    },
}
