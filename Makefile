# CueLABS™ standard Makefile — compose-driven local development + terraform deploy.
# Run `make help` to list targets.
.DEFAULT_GOAL := help
.PHONY: help up down build rebuild logs ps restart clean demo demo-reset tf-init tf-plan tf-apply tf-destroy

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*## "};{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build and start the full stack (detached)
	docker compose up --build -d

down: ## Stop and remove the stack
	docker compose down

build: ## Build all service images
	docker compose build

rebuild: ## Rebuild images from scratch (no cache)
	docker compose build --no-cache

logs: ## Follow logs from all services
	docker compose logs -f

ps: ## Show service status
	docker compose ps

restart: ## Restart all services
	docker compose restart

demo: ## Start the stack and load the demo account (demo@upstat.app / upstat-demo)
	@test -f .env || cp .env.example .env
	docker compose up --build -d --wait
	@# the insight service needs a service token to read incident context
	@if ! grep -q '^UPSTAT_GRPC_AUTH_TOKEN=..*' .env; then \
		TOKEN=$$(docker compose exec -T api-common /app/make_service_token) && \
		sed -i.bak "s|^UPSTAT_GRPC_AUTH_TOKEN=.*|UPSTAT_GRPC_AUTH_TOKEN=$$TOKEN|" .env && rm -f .env.bak && \
		docker compose up -d --wait api-observability; \
	fi
	docker compose exec api-common /app/seed -backfill
	@echo "\nApp: http://localhost:2003  ·  Status page: http://localhost:2003/status/demo"

demo-reset: ## Rebuild the demo account's data from scratch (fresh history)
	docker compose exec api-common /app/seed -reset -backfill

clean: ## Stop the stack and remove volumes + orphans
	docker compose down -v --remove-orphans

tf-init: ## Init terraform (deploy/terraform)
	terraform -chdir=deploy/terraform init

tf-plan: tf-init ## Preview the Kubernetes deployment
	terraform -chdir=deploy/terraform plan

tf-apply: tf-init ## Deploy the helm chart to the kubeconfig cluster
	terraform -chdir=deploy/terraform apply

tf-destroy: ## Tear down the deployed release
	terraform -chdir=deploy/terraform destroy
