import os
import re
import threading

import ctranslate2
import transformers
from fastapi import FastAPI, HTTPException
from huggingface_hub import snapshot_download
from pydantic import BaseModel

MODEL_REPO = os.getenv("MODEL_REPO", "JustFrederik/nllb-200-distilled-1.3B-ct2-int8")
TOK_REPO = "facebook/nllb-200-distilled-600M"   # same vocabulary for all NLLB sizes
MODEL_DIR = "/models/" + MODEL_REPO.replace("/", "__")
TOK_DIR = "/models/tokenizer"
END = "។.!?…"

state = {"ready": False, "error": None}
translator = None
tokenizer = None


def load():
    global translator, tokenizer
    try:
        if not os.path.exists(f"{MODEL_DIR}/model.bin"):
            snapshot_download(MODEL_REPO, local_dir=MODEL_DIR)      # one-time, resumable
        if not os.path.exists(f"{TOK_DIR}/tokenizer_config.json"):
            snapshot_download(TOK_REPO, local_dir=TOK_DIR,
                              allow_patterns=["tokenizer*", "sentencepiece*", "special_tokens_map.json"])
        tokenizer = transformers.AutoTokenizer.from_pretrained(TOK_DIR)
        translator = ctranslate2.Translator(
            MODEL_DIR, device="cpu", intra_threads=int(os.getenv("THREADS", "4")))
        state["ready"] = True
    except Exception as e:  # noqa: BLE001
        state["error"] = str(e)


threading.Thread(target=load, daemon=True).start()
app = FastAPI()


def sentences(line):
    parts = [p.strip() for p in re.split(r"(?<=[។!?])\s*|(?<=\.)\s+", line) if p and p.strip()]
    out = []
    for p in parts:
        while len(p) > 350:
            cut = p.rfind(" ", 0, 350)
            cut = cut if cut > 100 else 350
            out.append(p[:cut]); p = p[cut:].strip()
        if p:
            out.append(p)
    return out


def encode(s, src):
    # [source language] + sentence pieces + </s>  (the format CTranslate2 expects for NLLB)
    pieces = tokenizer.convert_ids_to_tokens(tokenizer.encode(s, add_special_tokens=False))
    return [src] + pieces + ["</s>"]


class Req(BaseModel):
    text: str
    source: str
    target: str


@app.get("/health")
def health():
    return {"ready": state["ready"], "error": state["error"]}


@app.post("/translate")
def translate(r: Req):
    if not state["ready"]:
        raise HTTPException(503, "loading")
    if len(r.text) > 20000:
        raise HTTPException(422, "too long")
    vocab = tokenizer.get_vocab()
    if r.source not in vocab or r.target not in vocab:
        raise HTTPException(422, "unsupported language")

    lines = [sentences(l) if l.strip() else None for l in r.text.split("\n")]
    flat = [s for l in lines if l for s in l]
    result = []
    if flat:
        prepared, added = [], []
        for s in flat:
            if s[-1] not in END:   # short phrases without punctuation translate much better with one
                prepared.append(s + ("។" if r.source == "khm_Khmr" else ".")); added.append(True)
            else:
                prepared.append(s); added.append(False)

        batch = [encode(s, r.source) for s in prepared]
        limit = min(256, max(16, int(max(len(b) for b in batch) * 2.5)))
        res = translator.translate_batch(
            batch, target_prefix=[[r.target]] * len(batch),
            beam_size=5, max_batch_size=8, max_decoding_length=limit)

        for h, a in zip(res, added):
            ids = tokenizer.convert_tokens_to_ids(h.hypotheses[0][1:])   # drop the target language token
            out = tokenizer.decode(ids, skip_special_tokens=True).strip()
            if a:
                out = out.rstrip(END).strip()
            result.append(out)

    out, i = [], 0
    for l in lines:
        if l is None:
            out.append("")
        else:
            out.append(" ".join(result[i:i + len(l)])); i += len(l)
    return {"translation": "\n".join(out)}
