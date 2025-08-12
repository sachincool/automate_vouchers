# Contributing

Thanks for your interest in contributing! A few quick guidelines:

- Fork the repo and create a feature branch from `main`
- Make focused edits with clear commit messages
- Keep code readable and follow existing style
- Do not include secrets, tokens, or personal data in commits or examples
- Update docs when behavior or configuration changes

Development basics:

```bash
# Node setup
npm install

# Python tools for manual voucher claim
pip install -r requirements.txt
```

Before submitting a PR:

- Ensure the automation still runs locally (or behind feature flags)
- Run a quick smoke test of the webhook interaction (no secrets)
- Ensure `.env.example` covers any new env vars

Opening a PR:

- Use a descriptive title and include a short summary
- Link to any related issue(s)
- Describe testing done and potential impact

By contributing, you agree that your contributions will be licensed under the BSD 2-Clause License.
