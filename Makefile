ignore default:
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:' $(MAKEFILE_LIST) | grep -v -E '^(ignore default|.PHONY)' | awk -F':' '{print "  " $$1}'

.PHONY: default

up:
	docker compose up -d

down:
	docker compose down

exec:
	docker compose exec -e TERM=xterm-256color api bash

.PHONY: up down exec




