# Agent contract evaluations

This suite exercises an isolated deterministic contract double through the same LangGraph router and evidence critic used by the web application. The double is registered only under `APP_ENV=test`; it is a release gate, never a product provider or a substitute for the required live-model evaluation.

The cases verify:

- bounded specialist routing in English and Spanish;
- citation resolution against only the evidence supplied to the turn;
- prompt-injection text inside evidence remains inert;
- no canonical write is performed by the conversational workflow;
- responses do not frame alignment as a hiring probability.

Run it with:

```bash
python evals/agent_contract.py
```

Hosted-provider evaluations require a deliberately curated private dataset and explicit operator opt-in. Never add resumes, job-search history, tokens, or production conversations to this public directory.
