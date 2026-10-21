/**
 * Landing copy. Every claim here is something the shipped product does —
 * the FAQ answers come straight from the backend's behavior.
 */
import type { CodeSnippetTab } from "@/components/ui/CodeSnippet";

export const GITHUB_URL = "https://github.com/cuesoftinc/upstat";
export const DOCS_URL = "https://cuesoft.gitbook.io/upstat";

export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "How often are my sites checked?",
    answer:
      "On the interval you choose per monitor — every 60 seconds by default. Each check is an HTTP GET with its own timeout (10 seconds by default).",
  },
  {
    question: "What counts as down?",
    answer:
      "Any status outside 2xx–3xx, or no response within the timeout. A failed check is retried twice, 500ms apart, before it counts — so one dropped packet never pages you. After the number of consecutive failures you set (3 by default), the monitor goes down and an incident opens.",
  },
  {
    question: "Do I have to close incidents myself?",
    answer:
      "No. The first successful check after an outage resolves the incident and records how long it lasted.",
  },
  {
    question: "Who can see my status page?",
    answer:
      "Anyone with the link — that's the point. It shows each service's status, 90-day history and incidents, but never your monitor URLs or raw error messages.",
  },
  {
    question: "What does the AI insight do?",
    answer:
      "A separate Python service scores each monitor's risk from 0 to 100 using its recent checks, latency trend and incident history, classifies the severity, and writes a plain-language summary with a recommended action.",
  },
  {
    question: "Can I run it myself?",
    answer:
      "Yes — it's open source. One command starts the whole stack (Go API, check worker, MongoDB, Envoy, the insight service and this web app) with Docker Compose.",
  },
];

export const SELF_HOST_TABS: CodeSnippetTab[] = [
  {
    label: "Docker Compose",
    code: `git clone ${GITHUB_URL}.git
cd upstat
make demo`,
  },
];
