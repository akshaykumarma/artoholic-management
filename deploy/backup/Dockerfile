# Nightly backup runner (010 research R2): PostgreSQL 15 client + rclone.
FROM alpine:3.20
RUN apk add --no-cache postgresql15-client rclone bash coreutils jq
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
ENTRYPOINT ["/usr/local/bin/backup.sh"]
