# Changelog

## [0.2.0](https://github.com/Evgenii-Zinner/astro-agent-ready/compare/v0.1.1...v0.2.0) (2026-11-13)


### Features

* add SSR support (`output: "server"` / `"hybrid"`) ([#6](https://github.com/Evgenii-Zinner/astro-agent-ready/pull/6)) ([ee1e3c3](https://github.com/Evgenii-Zinner/astro-agent-ready/commit/ee1e3c316e21f4f7d8256e22d60e2465068e8c70)):
  * dynamic `resolveContext()` option for runtime content loading
  * `.md` suffix route rewriting and `Accept: text/markdown` content negotiation middleware
  * bounded `/llms-full.txt` output via `maxDocs` and `maxTokens`
  * synchronous FNV-1a `ETag` / `304 Not Modified` caching and `Link` discovery headers

## [0.1.1](https://github.com/Evgenii-Zinner/astro-agent-ready/compare/v0.1.0...v0.1.1) (2026-10-24)


### Bug Fixes

* harden regexes against ReDoS, add draft filtering and boolean exports ([#1](https://github.com/Evgenii-Zinner/astro-agent-ready/issues/1)) ([8e3c043](https://github.com/Evgenii-Zinner/astro-agent-ready/commit/8e3c043343b80d72a55a7df6dff875a8a4eb6f0f))
