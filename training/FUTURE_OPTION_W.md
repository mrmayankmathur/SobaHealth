# FUTURE: Option W — Ship the LoRA adapter to the phone

> **Status**: deferred. Pick this up when upstream blockers clear OR when you
> have a spare week for native-module hacking.
>
> **2026-05 update**: the *edge* side of this fine-tune is also currently
> blocked by upstream Gemma 4 gaps (see `training/README.md` banner). Even on
> the server, neither `llama.cpp convert_hf_to_gguf.py` nor `convert_lora_to_gguf.py`
> nor Ollama's `ADAPTER` directive can yet handle a fine-tuned Gemma 4 model.
> The training pipeline still produces the artefacts cleanly and pushes them to
> HF — the moment any of those upstream paths fixes Gemma 4, the existing
> [`scripts/install_clinical*.sh`](./scripts/) installers Just Work and the
> backend's `resolve_model()` picks the tuned model up automatically.

## Why we deferred it

When we built this fine-tune (May 2026), three upstream limitations meant we
could not ship a separate ~50 MB LoRA adapter directly to the React Native app:

1. **`react-native-litert-lm@0.3.7` has no public `loadAdapter` API.**
   The package exposes only `createLLM().loadModel(path, opts)`,
   `sendMessage`, `sendMessageWithImage`, `sendMessageWithAudio`, and
   `resetConversation`. There is no public binding for the underlying
   LiteRT-LM C++ `LoadLoRA` method.

2. **Google's `LiteRT-LM` C++ runtime has internal `LoadLoRA` /
   `CreateNewContext` methods but they are not yet part of the public API.**
   See [google-ai-edge/LiteRT-LM#1188](https://github.com/google-ai-edge/LiteRT-LM/issues/1188)
   - a feature request for "Public API for LoRA adapter weights in Sessions"
   that is open with no timeline.

3. **Gemma 4 export to `.litertlm` has known issues.**
   - [`litert_lm_builder` missing `gemma4` case](https://github.com/google-ai-edge/litert-torch/issues/1005)
     - the builder defaults to `generic_model` metadata, causing runtime
     segfaults.
   - [Fine-tuned Gemma 4 export loses fidelity](https://github.com/google-ai-edge/litert-torch/issues/1013)
     - tool-calling regresses noticeably vs the MLX baseline.

So even if we had `loadAdapter` working, the underlying export pipeline isn't
production-ready for Gemma 4 right now.

## What to do when picking this up

### Triggers (any one is enough)
- Upstream resolves [LiteRT-LM#1188](https://github.com/google-ai-edge/LiteRT-LM/issues/1188) (public adapter API)
- We have a clear week of native-module work to fork the package
- A working `gemma4` case lands in `litert_lm_builder.py`

### Work items

1. **Fork [`hung-yueh/react-native-litert-lm`](https://github.com/hung-yueh/react-native-litert-lm)** and add a native method:
   - iOS (Swift / C++): expose `loadAdapter(path: String)` calling into the
     LiteRT-LM C++ `LoadLoRA`.
   - Android (Kotlin / C++): same via JNI.
   - Nitro module spec: extend `Llm.nitro.ts` with `loadAdapter(adapterPath: string): Promise<void>`.

2. **Patch `litert_lm_builder.py`** (or wait for upstream):
   ```python
   case 'gemma4':
       processor = Gemma4DataProcessor(...)
   ```

3. **Add a third entry to `MODELS` in
   [`mobile/services/modelInstall.ts`](../mobile/services/modelInstall.ts)**:
   ```ts
   adapter: {
     fileName: "sobahealth-clinical-adapter.litertlm",
     storageKey: "@soba_adapter_path",
     downloadUrl: "https://huggingface.co/<you>/sobahealth-clinical/resolve/main/adapter.litertlm",
     approxBytes: 50 * 1024 * 1024,
     minValidBytes: 30 * 1024 * 1024,
   }
   ```

4. **Wire `loadAdapter()` into
   [`mobile/services/localInference.ts`](../mobile/services/localInference.ts)**:
   ```ts
   const adapter = await getInstalledPath("adapter");
   if (adapter && useClinical) {
     await llm.loadAdapter(toNativePath(adapter));
   }
   ```

5. **Add the toggle to
   [`mobile/app/settings.tsx`](../mobile/app/settings.tsx)**:
   - Persistent AsyncStorage key: `@soba_use_clinical_adapter`
   - UI: a `Switch` labelled "Use SobaHealth Clinical (on-device)"
   - On change, call `releaseLocalInference()` then re-init so the next call
     picks up the new adapter state.

### Training pipeline output that survives Option W

The current Kaggle notebook saves the adapter at `outputs_clinical/adapter/`
before merging. That's exactly the artefact Option W needs - we just don't
ship it anywhere right now. When you come back to this, push that adapter to
a private HF repo:

```bash
huggingface-cli upload <you>/sobahealth-clinical \
  outputs_clinical/adapter adapter \
  --repo-type model
```

…then run [`training/convert_to_litertlm.py`](./convert_to_litertlm.py) (to be
written) to wrap it as a LiteRT-LM-loadable adapter blob.

## Estimated effort
- Native fork + API wiring: 3-5 days
- Mobile UI + state: 1 day
- Adapter conversion script + testing: 2-3 days
- E2E QA on iOS + Android: 2 days

Total: ~2 weeks elapsed, ~1 week focused work.
