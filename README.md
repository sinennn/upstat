# Upstat

Upstat Monorepo


## About

Upstat is a comprehensive web application designed to monitor the health and performance of your websites, servers, and APIs. Equipped with real-time charts, status indicators, and incident reporting, Upstat provides a centralized dashboard that allows you to keep tabs on your digital assets. With its intuitive interface and robust analytics, you can quickly identify issues, analyze trends, and take proactive measures to ensure optimal uptime and user experience. Whether you're a small business or a large enterprise, Upstat offers a scalable solution to meet your monitoring needs.

## Features
- **Real-time charts** — live performance and response time graphs
- **Status indicators** — instant up/down/degraded signals per monitor
- **Incident reporting** — automated incident creation, updates, and resolution
- **Alerting** — notifications via email, Slack, webhooks, and more
- **Multi-region checks** — monitor from multiple geographic locations
- **Public status pages** — shareable uptime pages for your users
- **Team access control** — role-based access for organisations
  
---

## Repository Structure
```
upstat/
├── api/
│   ├── nodejs/           # Node.js REST API (core monitoring engine)
│   └── go/               # Go service (high-frequency ping workers)
├── app/
│   ├── web/              # Next.js web dashboard
│   └── mobile/           # React Native mobile app
├── packages/
│   ├── ui/               # Shared React component library
│   ├── types/            # Shared TypeScript types & interfaces
│   └── utils/            # Shared utility functions
├── deploy/
│   ├── docker/           # Docker Compose configs
│   ├── helm/             # Kubernetes Helm charts
│   └── terraform/        # Infrastructure as Code
├── docs/                 # Architecture, API refs, guides
├── scripts/              # Dev, CI, and release scripts
└── .github/
    ├── ISSUE_TEMPLATE/   # Bug report & feature request templates
    └── workflows/        # GitHub Actions CI/CD pipelines
```
---
## Tech Stack
| Layer | Technology |
|---|---|
| Web Dashboard | Next.js, React, Tailwind CSS |
| Mobile | React Native |
| API (core) | Node.js, Express/ Fastify |
| API (workers) | Go |
| Database | PostgreSQL (via Supabase) |
| Real-time | WebSockets / Server-Sent Events |
| Infrastructure | Docker, Helm, Terrafoam |
| CI/CD  | Github Actions |

---

## Getting Started
### Prerequisites

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) v20+
- [Go](https://go.dev/) 1.21+ (for ping workers)

  ### Setup
  ```bash
  # 1. Clone the repo
  git clone https://github.com/cuesoftinc/upstat.git
  cd upstat

  # 2. Install all dependencies
  make setup

  # 3. Copy environment variables
  cp .env.example .env
  # Fill in your values in .env

  # 4. Start all services locally
  make dev
  ```

  Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

  ---

  ## Self-Hosting
  See the [Self-Hosting Guide](./docs/SELF_HOSTING.md) for instructions on deploying Upstat with Docker, Kubernetes (Helm), or Terraform.

  ---

  ## Contributing

  We welcome contributions of all kinds- bug fixes, new features, documentation, translations, and more.
  Please read our [Contributing Guide](./CONTRIBUTING.md) before opening a PR.

  For first-time contributors, look for issues labelled [`good first issue`](https://github.com/cuesoftinc/upstat/labels/good%20first%20issue).

---

## Documentation 
Full Documentation is in the [./docs/) folder:

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Local Development](./docs/LOCAL_DEVELOPMENT.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Self-Hosting](./docs/SELF_HOSTING.md)

---

## License

Upstat is open-source software licensed under the [MIT License](./LICENSE).

---

## Community

- [GitHub Discussions](https://github.com/cuesoftinc/upstat/discussions)
- [Report a Bug](https://github.com/cuesoftinc/upstat/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/cuesoftinc/upstat/issues/new?template=feature_request.md)
- Security issues: [security@cuesoftinc.com](mailto:security@cuesoftinc.com)

  
