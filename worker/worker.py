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
    "refresh": {
        "task": "tasks.update_symbols",
        "schedule": crontab(minute="*/5"),
    },
}
