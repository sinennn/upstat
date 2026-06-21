# Use an official Golang runtime as a parent image
FROM golang:1.25-alpine

RUN apk add --no-cache git curl

RUN go install github.com/air-verse/air@latest

WORKDIR /app

COPY . /app

RUN go mod download

EXPOSE 8080

CMD ["air"]
