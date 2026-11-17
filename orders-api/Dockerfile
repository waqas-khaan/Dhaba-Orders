FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
ARG APP_VERSION=dev
RUN mkdir -p /out && CGO_ENABLED=0 go build -ldflags="-s -w -X main.version=${APP_VERSION}" -o /out/orders-api .
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/orders-api /orders-api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/orders-api"]
