import * as FileSystem from "expo-file-system/legacy";

import { createLLM } from "react-native-litert-lm";

const MODEL_URL =
  "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm";
const MODEL_FILE_NAME = "gemma-4-E4B-it.litertlm";

let llmInstance: any = null;
let downloadProgressCallback: ((progress: number) => void) | null = null;

export function setDownloadProgressCallback(cb: (progress: number) => void) {
  downloadProgressCallback = cb;
}

export async function getLocalLLM() {
  if (llmInstance) return llmInstance;

  const modelPath = `${FileSystem.documentDirectory}${MODEL_FILE_NAME}`;
  let fileInfo = await FileSystem.getInfoAsync(modelPath);

  if (fileInfo.exists && fileInfo.size < 1000000) {
    console.log("Found corrupted/partial download. Deleting...");
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
    fileInfo = await FileSystem.getInfoAsync(modelPath);
  }

  if (!fileInfo.exists) {
    console.log("Downloading Gemma 4 model to device...");
    const downloadResumable = FileSystem.createDownloadResumable(
      MODEL_URL,
      modelPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        if (downloadProgressCallback) {
          downloadProgressCallback(progress);
        }
      },
    );

    try {
      const result = await downloadResumable.downloadAsync();
      if (!result || result.status !== 200) {
        throw new Error("Failed to download model.");
      }
      console.log("Download complete:", result.uri);
    } catch (e) {
      console.error(e);
      throw new Error("Error downloading the LLM model to local storage.");
    }
  }

  console.log("Initializing LiteRT LLM from:", modelPath);
  llmInstance = createLLM();
  const rawPath = modelPath.replace(/^file:\/\//, "");
  await llmInstance.loadModel(rawPath, {
    backend: "gpu",
    systemPrompt:
      "You are a concise, helpful medical AI triage assistant. You provide short, empathetic advice.",
  });
  return llmInstance;
}

export async function generateLLMResponse(
  prompt: string,
  resetHistory: boolean = false,
): Promise<string> {
  const llm = await getLocalLLM();

  if (resetHistory) {
    llm.resetConversation();
  }

  try {
    const fullResponse = await llm.sendMessage(prompt);
    return fullResponse;
  } catch (error) {
    throw error;
  }
}
