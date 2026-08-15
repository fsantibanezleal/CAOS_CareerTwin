ARG WOLFI_IMAGE=cgr.dev/chainguard/wolfi-base:latest@sha256:0a8fd427de5882aed77471b0a432c3675eda6b6a0ae952b5d640b46da628cdbe

FROM ${WOLFI_IMAGE} AS vector-builder

ARG PGVECTOR_COMMIT=8ee86c96f0fd72390f890aa8a336fda6d3ab4c6c
ARG PGVECTOR_SHA256=d076a3098010905fd60256649327809651f6288327db6413f0938305f62ea299

RUN apk add --no-cache \
        build-base=1-r9 \
        ca-certificates-bundle \
        postgresql-17-dev=17.10-r1
ADD --checksum=sha256:${PGVECTOR_SHA256} \
    https://github.com/pgvector/pgvector/archive/${PGVECTOR_COMMIT}.tar.gz \
    /tmp/pgvector.tar.gz
RUN mkdir -p /tmp/pgvector \
    && tar --extract --gzip --file /tmp/pgvector.tar.gz --directory /tmp/pgvector --strip-components=1 \
    && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
    && make -C /tmp/pgvector DESTDIR=/opt/pgvector-root with_llvm=no install

FROM ${WOLFI_IMAGE}

RUN addgroup -S -g 70 postgres \
    && adduser -S -D -u 70 -G postgres -h /home/postgres -s /bin/sh postgres \
    && apk add --no-cache \
        ca-certificates-bundle \
        glibc-locale-en=2.43-r13 \
        gosu=1.19-r14 \
        posix-libc-utils-bin=2.43-r13 \
        postgresql-17=17.10-r1 \
        postgresql-17-client=17.10-r1 \
        postgresql-17-contrib=17.10-r1 \
        postgresql-17-oci-entrypoint=17.10-r1 \
    && mkdir -p /var/lib/postgresql/data /var/run/postgresql \
    && chown -R postgres:postgres /var/lib/postgresql /var/run/postgresql

ENV LANG=en_US.UTF-8 \
    PATH=/usr/lib/postgresql17/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin \
    PGDATA=/var/lib/postgresql/data \
    PG_MAJOR=17 \
    PG_VERSION=17.10

LABEL org.opencontainers.image.title="CareerTwin PostgreSQL with pgvector" \
      org.opencontainers.image.description="PostgreSQL 17.10 on Wolfi/glibc with pgvector 0.8.6 and verifiable collation provenance" \
      org.opencontainers.image.source="https://github.com/fsantibanezleal/CAOS_CareerTwin"

COPY --from=vector-builder /opt/pgvector-root/ /

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh", "postgres"]
