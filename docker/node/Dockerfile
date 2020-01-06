FROM node:10

ADD docker/node/helm-v2.14.3-linux-amd64.tar.gz /tmp/

RUN mv /tmp/linux-amd64/helm /usr/local/bin/helm
WORKDIR /application
CMD node index.js