SHA1 := $(shell git rev-parse --short HEAD)

all: build

push:
	docker push chrissearle/netatmo:$(SHA1)
	docker push chrissearle/netatmo:latest

build:
	make check
	docker build . -t chrissearle/netatmo:$(SHA1)
	docker tag chrissearle/netatmo:$(SHA1) chrissearle/netatmo:latest

check: install
	yarn lint

install: node_modules

node_modules: package.json yarn.lock
	yarn