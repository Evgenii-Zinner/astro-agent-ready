# Contributing to astro-agent-ready

Thank you for your interest in improving `astro-agent-ready`!

---

## 📢 Please Open Issues, Not Pull Requests (For Now)

If you have found a bug, identified an edge case, or want to suggest a new feature, **please open a GitHub Issue instead of submitting a Pull Request**.

### Why?
As a solo maintainer, I currently do not have the bandwidth to review, verify, and maintain external Pull Requests on a full-time basis. Unsolicited PRs take significant time to audit for zero-dependency guarantees, cross-platform behavior, and performance overhead.

### How to Help (And What Gets Prioritized)
Opening well-documented issues is the most effective way to help! I actively review and work to resolve issues that provide:

1. **Clear Explanations**: A thorough description of the issue or feature and why it is needed.
2. **Concrete Real-World Use Cases**: Real-world examples (e.g. how a specific content collection schema, markdown format, or agent crawler consumes your site).
3. **Minimal Reproductions**: Short content snippets or a minimal Astro reproduction repository demonstrating the behavior.
4. **Expected vs. Actual Output**: What the output looks like now vs. what the spec or agent requires.
5. **Environment Details**: Your Astro version, Node.js runtime version, and operating system.

Issues with clear explanations and practical use cases will be prioritized and resolved directly in core releases.

---

## 🐛 Bug Reports

When opening a bug report, please include:
- A clear summary of what happened.
- The input source file before build and the resulting `llms.txt` or `llms-full.txt` in `dist/`.
- Your `astro.config.mjs` integration configuration.
- Any error messages or console logs.

---

## 💡 Feature Requests

When requesting new features:
- Describe the agent or AI crawler rationale (e.g., compatibility with a specific LLM, agent tool, or spec update).
- Explain whether it should be a default or an opt-in configuration option.

---

## 🤝 Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it to ensure a respectful and welcoming environment for everyone.
