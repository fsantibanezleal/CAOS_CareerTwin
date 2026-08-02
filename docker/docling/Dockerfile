FROM cgr.dev/chainguard/python:latest-dev@sha256:b6ea84d6ad79b9537046467ef8f507f2787fb9138fdd5e9e3078f0e63fbb502d AS build

USER root
ENV PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/docling
RUN apk add --no-cache build-base cmake ninja linux-headers patch
RUN python -m venv /venv && /venv/bin/pip install --upgrade pip==26.2
COPY docling_gateway/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    /venv/bin/pip install --only-binary=:all: \
      --index-url https://download.pytorch.org/whl/cpu \
      'torch==2.13.0+cpu' \
      'torchvision==0.28.0+cpu'
COPY docker/docling/patches/opencv-python-5.0.0.93-optional-missing-stubs.patch /tmp/opencv-python.patch
ARG OPENCV_SOURCE_URL=https://files.pythonhosted.org/packages/1d/99/76b7c80252aa83c1af16393454aafd125a0287101afe8deb0a6821af0e30/opencv_python_headless-5.0.0.93.tar.gz
ARG OPENCV_SOURCE_SHA256=b82f9831daab90b725c7c1ee1b36cb5732c367096ac76d119e64e14eb70d5f3c
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=cache,id=careertwin-opencv-skbuild,target=/tmp/opencv-skbuild \
    mkdir -p /tmp/opencv-source \
    && wget -q -O /tmp/opencv-source.tar.gz "${OPENCV_SOURCE_URL}" \
    && test "$(sha256sum /tmp/opencv-source.tar.gz | cut -d ' ' -f 1)" = "${OPENCV_SOURCE_SHA256}" \
    && tar -xzf /tmp/opencv-source.tar.gz \
      -C /tmp/opencv-source --strip-components=1 \
    && ln -s /tmp/opencv-skbuild /tmp/opencv-source/_skbuild \
    && cd /tmp/opencv-source \
    && patch -p1 < /tmp/opencv-python.patch \
    && CMAKE_ARGS="-DBUILD_LIST=core,imgcodecs,imgproc,python3 -DCPU_BASELINE=SSE2 -DCPU_DISPATCH= -DWITH_IPP=OFF -DWITH_OPENCL=OFF -DWITH_FFMPEG=OFF -DWITH_GSTREAMER=OFF -DWITH_V4L=OFF -DWITH_1394=OFF" \
      ENABLE_HEADLESS=1 \
      OPENCV_PYTHON_SKIP_GIT_COMMANDS=1 \
      /venv/bin/pip install --no-deps . \
    && rm -rf /tmp/opencv-source /tmp/opencv-source.tar.gz /tmp/opencv-python.patch
RUN --mount=type=cache,target=/root/.cache/pip \
    /venv/bin/pip install --only-binary=:all: -r requirements.txt
RUN /venv/bin/pip install --only-binary=:all: setuptools==83.0.0
COPY docling_gateway /opt/docling/docling_gateway
RUN /venv/bin/pip check \
    && /venv/bin/python -m compileall -q /opt/docling/docling_gateway \
    && /venv/bin/pip uninstall -y wheel \
    && /venv/bin/pip check \
    && rm -rf /venv/bin/pip* /venv/lib/python3.14/site-packages/pip*
RUN mkdir -p /var/cache/docling /tmp/docling \
    && chown -R 65532:65532 /var/cache/docling /tmp/docling /opt/docling

FROM cgr.dev/chainguard/python:latest@sha256:231d4a76e8521327dbb3c23094b2c41151501845d2656da3c1a0610981c496c5

LABEL org.opencontainers.image.title="CareerTwin Docling Gateway" \
      org.opencontainers.image.description="Authenticated CPU document conversion with Docling Slim 2.117.0" \
      org.opencontainers.image.source="https://github.com/fsantibanezleal/CAOS_CareerTwin"

ENV HOME=/var/cache/docling \
    HF_HOME=/var/cache/docling/huggingface \
    EASYOCR_MODULE_PATH=/var/cache/docling/easyocr \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/venv/bin:$PATH" \
    TMPDIR=/tmp/docling
WORKDIR /opt/docling
COPY --from=build --chown=65532:65532 /venv /venv
COPY --from=build --chown=65532:65532 /opt/docling/docling_gateway ./docling_gateway
COPY --from=build --chown=65532:65532 /var/cache/docling /var/cache/docling
COPY --from=build --chown=65532:65532 /tmp/docling /tmp/docling
USER 65532
EXPOSE 5001
ENTRYPOINT []
CMD ["/venv/bin/uvicorn", "docling_gateway.app:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "1", "--no-access-log"]
