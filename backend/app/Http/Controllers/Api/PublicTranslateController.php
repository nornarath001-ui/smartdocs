<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class PublicTranslateController extends Controller
{
    private const FILE_MAX_CHARS = 20000;

    private function setting(string $key, $default)
    {
        $v = DB::table('settings')->where('key', $key)->value('value');

        return $v === null ? $default : $v;
    }

    private function enabled(): bool
    {
        return (bool) (int) $this->setting('translate_enabled', 1);
    }

    private function maxChars(): int
    {
        return (int) $this->setting('translate_max_chars', 5000);
    }

    private function url(): string
    {
        return rtrim(config('translator.url'), '/');
    }

    private function codes(): array
    {
        return array_keys(TranslateController::LANGS);
    }

    public function config()
    {
        $ready = false;
        try {
            $ready = (bool) Http::timeout(3)->get($this->url() . '/health')->json('ready');
        } catch (\Throwable $e) {
            // translator not reachable
        }

        return [
            'languages' => collect(TranslateController::LANGS)->map(fn ($l, $c) => ['code' => $c, 'name' => $l[1]])->values(),
            'enabled' => $this->enabled(),
            'max_chars' => $this->maxChars(),
            'file_max_chars' => self::FILE_MAX_CHARS,
            'ready' => $ready,
        ];
    }

    public function text(Request $r)
    {
        set_time_limit(150);
        abort_unless($this->enabled(), 403, 'Translation is turned off by the administrator.');

        $data = $r->validate([
            'text' => 'required|string|max:' . $this->maxChars(),
            'source' => ['required', Rule::in($this->codes())],
            'target' => ['required', Rule::in($this->codes()), 'different:source'],
        ]);

        try {
            $res = Http::timeout(140)->acceptJson()->post($this->url() . '/translate', [
                'text' => $data['text'],
                'source' => TranslateController::LANGS[$data['source']][0],
                'target' => TranslateController::LANGS[$data['target']][0],
            ]);
        } catch (ConnectionException $e) {
            abort(503, 'The translator is not available. Please try again later.');
        }

        abort_if($res->status() === 503, 503, 'The translation model is still loading. Please wait a minute and try again.');
        abort_if($res->failed(), 502, 'Translation failed.');

        return ['translation' => $res->json('translation')];
    }

    public function file(Request $r)
    {
        set_time_limit(300);
        abort_unless($this->enabled(), 403, 'Translation is turned off by the administrator.');

        $data = $r->validate([
            'file' => 'required|file|max:10240',
            'source' => ['required', Rule::in($this->codes())],
            'target' => ['required', Rule::in($this->codes()), 'different:source'],
        ]);

        $file = $r->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        abort_unless(in_array($ext, ['txt', 'docx', 'pdf'], true), 422, 'Only .txt, .docx and .pdf files are supported.');

        try {
            $res = Http::timeout(290)
                ->attach('file', file_get_contents($file->getRealPath()), "input.$ext")
                ->post($this->url() . '/file', [
                    'source' => TranslateController::LANGS[$data['source']][0],
                    'target' => TranslateController::LANGS[$data['target']][0],
                    'max_chars' => self::FILE_MAX_CHARS,
                ]);
        } catch (ConnectionException $e) {
            abort(503, 'The translator is not available, or the file took too long. Try a smaller file.');
        }

        abort_if($res->status() === 503, 503, 'The translation model is still loading. Please wait a minute and try again.');

        if ($res->failed()) {
            $detail = $res->json('detail');
            abort($res->status() === 422 ? 422 : 502, is_string($detail) ? $detail : 'Translation failed.');
        }

        $base = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $base = trim(preg_replace('/[\\\\\/:*?"<>|\x00-\x1f]+/u', '_', $base)) ?: 'document';
        $name = mb_substr($base, 0, 100) . '.' . $data['target'] . '.' . ($ext === 'txt' ? 'txt' : 'docx');

        // Nothing is stored: the translated file is streamed straight back
        return response($res->body(), 200, [
            'Content-Type' => $res->header('Content-Type'),
            'Content-Disposition' => "attachment; filename*=UTF-8''" . rawurlencode($name),
        ]);
    }
}
