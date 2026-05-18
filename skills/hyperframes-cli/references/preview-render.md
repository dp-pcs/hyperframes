# preview, play, render, publish

Serve, render, and share commands.

## preview

```bash
npx hyperframes preview                   # serve current directory
npx hyperframes preview --port 4567       # custom port (default 3002)
```

Hot-reloads on file changes. Opens the studio in your browser automatically.

When handing a project back to the user, use the Studio project URL, not the source `index.html` path:

```text
http://localhost:<port>/#project/<project-name>
```

Use the actual port from the preview output and the project directory name. For example, after `npx hyperframes preview --port 3017` in `codex-openai-video`, report `http://localhost:3017/#project/codex-openai-video`.

Treat `index.html` as source-code context only. It is fine to link as an implementation file, but do not label it as the project or preview surface.

## play (lightweight player)

```bash
npx hyperframes play                  # current project, port 3003
npx hyperframes play ./my-video       # specific project
npx hyperframes play --port 8080      # custom port
```

`play` serves the composition through the embeddable `<hyperframes-player>` web component instead of the full Studio UI. Use it when sharing a preview link or when Studio is heavier than needed (no editor, no panels).

## render

```bash
npx hyperframes render                                # standard MP4 from cwd
npx hyperframes render ./my-video --output ./out.mp4  # render from outside the project dir
npx hyperframes render --output final.mp4             # named output (no timestamp)
npx hyperframes render -c compositions/intro.html -o intro.mp4  # render a specific sub-composition file
npx hyperframes render --quality draft                # fast iteration
npx hyperframes render --fps 60 --quality high        # final delivery
npx hyperframes render --format webm                  # transparent WebM
npx hyperframes render --docker                       # byte-identical
```

> Default `--output` is `renders/<project-name>_<YYYY-MM-DD>_<HH-MM-SS>.<ext>` — timestamped per render so successive runs don't clobber each other. Pass `--output` to get a stable name.

| Flag                                 | Options                                                                                            | Default                        | Notes                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `dir` (positional)                   | path                                                                                               | cwd                            | Project directory. Omit to use current working directory.                                                                    |
| `--composition`, `-c`                | path to composition file                                                                           | `index.html`                   | Render a specific composition file (e.g. `compositions/intro.html`) instead of the project's `index.html`.                   |
| `--output`, `-o`                     | path                                                                                               | `renders/<project>_<ts>.<ext>` | Output path. Default is timestamped (`<project-name>_YYYY-MM-DD_HH-MM-SS.<ext>`).                                            |
| `--fps`                              | 24, 30, 60                                                                                         | 30                             | 60fps doubles render time                                                                                                    |
| `--quality`                          | draft, standard, high                                                                              | standard                       | draft for iterating                                                                                                          |
| `--format`                           | mp4, webm, mov, png-sequence                                                                       | mp4                            | WebM/MOV render with transparency; png-sequence writes RGBA frames to a directory (AE/Nuke/Fusion ingest)                    |
| `--resolution`                       | landscape, portrait, landscape-4k, portrait-4k, square, square-4k (+ aliases `1080p`, `4k`, `uhd`) | —                              | Supersample via Chrome `deviceScaleFactor`. Aspect ratio must match composition; scale must be an integer. Not with `--hdr`. |
| `--crf`                              | 0-51                                                                                               | —                              | Encoder CRF (lower = higher quality). Mutually exclusive with `--video-bitrate`.                                             |
| `--video-bitrate`                    | e.g. `10M`, `5000k`                                                                                | —                              | Target bitrate. Mutually exclusive with `--crf`.                                                                             |
| `--hdr`                              | flag                                                                                               | off                            | Force HDR output even with SDR sources. MP4 only.                                                                            |
| `--sdr`                              | flag                                                                                               | off                            | Force SDR even with HDR sources.                                                                                             |
| `--workers`                          | number or `auto`                                                                                   | auto                           | Each worker spawns Chrome (~256 MB)                                                                                          |
| `--docker`                           | flag                                                                                               | off                            | Reproducible output across hosts                                                                                             |
| `--gpu`                              | flag                                                                                               | off                            | GPU-accelerated FFmpeg encoding (NVENC / VideoToolbox / VAAPI / QSV)                                                         |
| `--browser-gpu` / `--no-browser-gpu` | flag                                                                                               | auto (local), off (docker)     | Host GPU for Chrome/WebGL capture                                                                                            |
| `--quiet`                            | flag                                                                                               | off                            | Suppress verbose output                                                                                                      |
| `--strict`                           | flag                                                                                               | off                            | Fail on lint errors                                                                                                          |
| `--strict-all`                       | flag                                                                                               | off                            | Fail on lint errors AND warnings                                                                                             |
| `--variables`                        | JSON object                                                                                        | —                              | Override values declared in `data-composition-variables`                                                                     |
| `--variables-file`                   | path                                                                                               | —                              | JSON file with variable values (alternative to `--variables`)                                                                |
| `--strict-variables`                 | flag                                                                                               | off                            | Fail render on undeclared keys or type mismatches in `--variables`                                                           |

**Quality guidance:** `draft` while iterating, `standard` for review, `high` for final delivery.

**Parametrized renders:** the composition declares its variables on the `<html>` root with **`data-composition-variables`** — a JSON **array of declarations** (`{id, type, label, default}` per entry) that defines the schema. Scripts inside read the resolved values via `window.__hyperframes.getVariables()`. The CLI `--variables '{"title":"Q4 Report"}'` is a JSON **object keyed by id** that overrides those declared defaults for one render; missing keys fall through, so the same composition runs unchanged in dev preview and in production. Sub-comp hosts can also override per-instance with `data-variable-values`. See the `hyperframes-core` skill for the full pattern.

## publish

```bash
npx hyperframes publish              # upload current project, return public URL
npx hyperframes publish ./my-video   # specific project
npx hyperframes publish --yes        # skip the confirmation prompt (scripts/CI)
```

Uploads the project's source (HTML + assets) and returns a stable public URL that renders in the browser. Use this for sharing a draft for review before rendering MP4, or for embedding the composition elsewhere. Lint findings are surfaced before upload but do not block.
