install:
	npm ci

test:
	npm test

start:
	npm start

docker-build:
	docker build -t cryptovest-bot:local .

.PHONY: install test start docker-build
