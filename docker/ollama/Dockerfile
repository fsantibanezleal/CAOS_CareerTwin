ARG GO_IMAGE=golang:1.26.5-bookworm@sha256:1ecb7edf62a0408027bd5729dfd6b1b8766e578e8df93995b225dfd0944eb651
ARG UPSTREAM_IMAGE=ollama/ollama:0.32.5@sha256:4dea9fb511947e24a84237bb636b0203abcb2ff0d3fbc7b4ff865deb91362131
ARG RUNTIME_IMAGE=ubuntu:24.04@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90

FROM ${GO_IMAGE} AS server-builder

ARG OLLAMA_COMMIT=eec8e0b9458b8a01be0c216a9cc53eefde24ef50
WORKDIR /src
RUN git clone --filter=blob:none --no-checkout https://github.com/ollama/ollama.git . \
    && git checkout --detach "${OLLAMA_COMMIT}" \
    && test "$(git rev-parse HEAD)" = "${OLLAMA_COMMIT}"
RUN --mount=type=cache,target=/go/pkg/mod \
    go get \
      github.com/buger/jsonparser@v1.1.2 \
      github.com/klauspost/compress@v1.18.7 \
      golang.org/x/crypto@v0.53.0 \
      golang.org/x/image@v0.43.0 \
      golang.org/x/net@v0.56.0 \
      golang.org/x/text@v0.39.0 \
    && go mod tidy \
    && go mod verify
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build \
      -trimpath \
      -buildmode=pie \
      -ldflags="-w -s -X github.com/ollama/ollama/version.Version=0.32.5-careertwin.1" \
      -o /opt/ollama/bin/ollama .

FROM ${UPSTREAM_IMAGE} AS cpu-libraries
USER root
RUN rm -rf \
      /usr/lib/ollama/cuda_v12 \
      /usr/lib/ollama/cuda_v13 \
      /usr/lib/ollama/mlx_cuda_v13 \
      /usr/lib/ollama/vulkan

FROM ${RUNTIME_IMAGE}

LABEL org.opencontainers.image.title="CareerTwin hardened Ollama CPU runtime" \
      org.opencontainers.image.description="Ollama 0.32.5 rebuilt with patched Go dependencies and CPU-only inference libraries" \
      org.opencontainers.image.source="https://github.com/fsantibanezleal/CAOS_CareerTwin"

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates libgomp1 \
    && groupadd --gid 65532 careertwin \
    && useradd --uid 65532 --gid 65532 --home-dir /var/lib/ollama --no-create-home --shell /usr/sbin/nologin careertwin \
    && install -d -o 65532 -g 65532 /var/lib/ollama /var/lib/ollama/models \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /usr/bin/getopt /usr/bin/openssl
COPY --from=server-builder /opt/ollama/bin/ollama /bin/ollama
COPY --from=cpu-libraries /usr/lib/ollama /usr/lib/ollama

ENV LD_LIBRARY_PATH=/usr/lib/ollama \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/var/lib/ollama/models \
    HOME=/var/lib/ollama
EXPOSE 11434
USER 65532:65532
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
