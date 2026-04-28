# Asset Pipeline

## Strategy

- Keep heavy source files under `src/assets/`.
- Export optimized runtime assets into `public/assets/`.
- Use naming conventions that map to code-friendly IDs.

## Recommendations

- Models: glTF/GLB.
- Textures: compressed PNG/WebP where appropriate.
- Audio: OGG/MP3 depending on compatibility and size.

## Team Workflow

1. Author in DCC tool (Blender, etc.).
2. Export optimized runtime variant.
3. Commit runtime asset with clear name/version.
4. Update docs or mapping code when asset IDs change.
