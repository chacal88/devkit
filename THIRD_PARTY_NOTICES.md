# Third-party notices

devkit is MIT-licensed. The skills below are adapted (renamed, trimmed, decoupled from their original tooling) from public projects, under those projects' licenses. Changes from the originals are noted per skill. The full license texts follow.

| devkit skill | Adapted from | License | Copyright |
|---|---|---|---|
| `core/systematic-debugging` | [obra/superpowers](https://github.com/obra/superpowers) `systematic-debugging` | MIT | Jesse Vincent |
| `core/test-driven-development` | [obra/superpowers](https://github.com/obra/superpowers) `test-driven-development` | MIT | Jesse Vincent |
| `ai-engineering/llm-evaluation` | [muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) `advanced-evaluation` | MIT | Context Engineering Agent Skills Contributors |
| `ai-engineering/context-compression` | same, `context-compression` | MIT | Context Engineering Agent Skills Contributors |
| `ai-engineering/multi-agent-patterns` | same, `multi-agent-patterns` | MIT | Context Engineering Agent Skills Contributors |
| `ai-engineering/agent-tool-design` | same, `tool-design` | MIT | Context Engineering Agent Skills Contributors |
| `ai-engineering/agent-friendly-cli` | [ChaosRealmsAI/agent-cli-spec](https://github.com/ChaosRealmsAI/agent-cli-spec) | MIT | zhuanz |
| `ai-engineering/skill-scanner` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) `skill-scanner` | MIT | Antigravity User |
| `stack/saas-multi-tenant` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) `saas-multi-tenant` | MIT | Antigravity User |
| `stack/postgres` (rules) | [supabase/agent-skills](https://github.com/supabase/agent-skills) Postgres best practices | MIT | Supabase |
| `stack/postgres` (`references/schema-design.md`) | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) `postgresql` | MIT | Antigravity User |
| `stack/react-performance` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `react-best-practices` | MIT (declared in the skill and the project README) | Vercel |
| `stack/vitest` | [antfu/skills](https://github.com/antfu/skills) `vitest` | MIT | Anthony Fu |
| `stack/neon-postgres` | [vibeforge1111/vibeship-spawner-skills](https://github.com/vibeforge1111/vibeship-spawner-skills) `neon-postgres` | Apache-2.0 (declared in the project README); text in the skill's `LICENSE.txt` | vibeship |
| `stack/threat-model` | [openai/skills](https://github.com/openai/skills) `security-threat-model` | Apache-2.0; text in the skill's `LICENSE.txt` | OpenAI |

Common changes: frontmatter rewritten to devkit's conventions (name, trigger-oriented description, documentation-only keys removed); references to tools, skills and files not shipped in devkit removed or redirected; build leftovers from the source repositories removed (compiled `AGENTS.md`, `metadata.json`, authoring notes and pressure tests); in `postgres`, two sources merged into one skill with a generated rule index.

All other agents, skills, schemas and hooks are original to devkit, some reworked from the author's own earlier private kits.

---

## MIT license texts

### obra/superpowers

```text
MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### muratcankoylan/Agent-Skills-for-Context-Engineering

```text
MIT License

Copyright (c) 2025 Context Engineering Agent Skills Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

### ChaosRealmsAI/agent-cli-spec

```text
MIT License

Copyright (c) 2026 zhuanz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### sickn33/antigravity-awesome-skills

```text
MIT License

Copyright (c) 2026 Antigravity User

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### supabase/agent-skills

```text
MIT License

Copyright (c) 2026 Supabase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### antfu/skills

```text
MIT License

Copyright (c) 2025-PRESENT Anthony Fu <https://github.com/antfu>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### vercel-labs/agent-skills

The repository declares `license: MIT` in the skill frontmatter and "MIT" in its README, without a license file. The standard MIT text applies, with the copyright holder Vercel:

```text
MIT License

Copyright (c) Vercel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Apache License 2.0

The full text ships next to each Apache-licensed skill: `plugins/stack/skills/threat-model/LICENSE.txt` and `plugins/stack/skills/neon-postgres/LICENSE.txt`.
