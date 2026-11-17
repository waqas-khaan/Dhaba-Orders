FROM alpine:3.20
RUN apk add --no-cache bash curl kubectl jq postgresql-client redis
RUN adduser -D -u 10001 monitor
WORKDIR /opt/monitor
COPY scripts/monitor/ /opt/monitor/
RUN chmod +x /opt/monitor/*.sh
USER 10001
ENTRYPOINT ["/bin/bash","-c","while true; do /opt/monitor/check-cluster.sh; /opt/monitor/check-services.sh; /opt/monitor/check-databases.sh; sleep 60; done"]
