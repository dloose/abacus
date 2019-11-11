FROM python:3.7

# Install dumb-init and set it as our entry point. We're going to be launching
# sub-processes so we need our PID 1 to know how to handle that correctly.
# Without this, you wind up with a bunch of zombie processes
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.1/dumb-init_1.2.1_amd64 \
    && chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]

#RUN apk update \
#    && apk add --no-cache postgresql-libs ffmpeg openssl libxml2 libxslt libffi \
#    && apk add --no-cache --virtual .build-deps gcc git musl-dev postgresql-dev libxml2-dev libxslt-dev libffi-dev make \
#    && pip install pipenv

RUN pip install pipenv

COPY Pipfile Pipfile.lock /abacus-stock-worker/
WORKDIR /abacus-stock-worker

RUN pipenv install --system --deploy --keep-outdated --ignore-pipfile --verbose
#\
#    && apk --purge del .build-deps

COPY . /abacus-stock-worker
