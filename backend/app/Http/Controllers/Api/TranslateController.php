<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class TranslateController extends Controller
{
    // code => [NLLB code, English name]
    public const LANGS = [
        'km' => ['khm_Khmr', 'Khmer'], 'en' => ['eng_Latn', 'English'], 'zh' => ['zho_Hans', 'Chinese'],
        'th' => ['tha_Thai', 'Thai'], 'vi' => ['vie_Latn', 'Vietnamese'], 'fr' => ['fra_Latn', 'French'],
        'de' => ['deu_Latn', 'German'], 'es' => ['spa_Latn', 'Spanish'], 'ja' => ['jpn_Jpan', 'Japanese'],
        'ko' => ['kor_Hang', 'Korean'], 'ru' => ['rus_Cyrl', 'Russian'], 'ar' => ['arb_Arab', 'Arabic'],
        'hi' => ['hin_Deva', 'Hindi'], 'id' => ['ind_Latn', 'Indonesian'], 'ms' => ['zsm_Latn', 'Malay'],
        'pt' => ['por_Latn', 'Portuguese'], 'it' => ['ita_Latn', 'Italian'], 'tr' => ['tur_Latn', 'Turkish'],
        'nl' => ['nld_Latn', 'Dutch'], 'pl' => ['pol_Latn', 'Polish'], 'uk' => ['ukr_Cyrl', 'Ukrainian'],
        'fil' => ['tgl_Latn', 'Filipino'], 'lo' => ['lao_Laoo', 'Lao'], 'my' => ['mya_Mymr', 'Burmese'],
        'bn' => ['ben_Beng', 'Bengali'], 'ta' => ['tam_Taml', 'Tamil'], 'ur' => ['urd_Arab', 'Urdu'],
        'fa' => ['pes_Arab', 'Persian'], 'he' => ['heb_Hebr', 'Hebrew'], 'sv' => ['swe_Latn', 'Swedish'],
        'el' => ['ell_Grek', 'Greek'],
    ];

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

    public function config()
    {
        $ready = false;
        try {
            $ready = (bool) Http::timeout(3)->get(config('translator.url') . '/health')->json('ready');
        } catch (\Throwable $e) {
            // translator not reachable
        }

        return [
            'languages' => collect(self::LANGS)->map(fn ($l, $code) => ['code' => $code, 'name' => $l[1]])->values(),
            'enabled' => $this->enabled(),
            'max_chars' => $this->maxChars(),
            'ready' => $ready,
        ];
    }

    public function translate(Request $r)
    {
        set_time_limit(150);
        abort_unless($this->enabled(), 403, 'Translation is turned off by the administrator.');

        $codes = array_keys(self::LANGS);
        $data = $r->validate([
            'text' => 'required|string|max:' . $this->maxChars(),
            'source' => ['required', Rule::in($codes)],
            'target' => ['required', Rule::in($codes), 'different:source'],
        ]);

        try {
            $res = Http::timeout(140)->acceptJson()->post(config('translator.url') . '/translate', [
                'text' => $data['text'],
                'source' => self::LANGS[$data['source']][0],
                'target' => self::LANGS[$data['target']][0],
            ]);
        } catch (ConnectionException $e) {
            abort(503, 'The translator is not available. Please try again later.');
        }

        abort_if($res->status() === 503, 503, 'The translation model is still loading. Please wait a minute and try again.');
        abort_if($res->failed(), 502, 'Translation failed.');

        // The text is never stored or logged
        return ['translation' => $res->json('translation')];
    }

    public function updateSettings(Request $r)
    {
        abort_unless($r->user()->hasRole('admin'), 403, 'Only admins can change translation settings.');

        $d = $r->validate(['enabled' => 'required|boolean', 'max_chars' => 'required|integer|between:200,20000']);

        DB::table('settings')->upsert([
            ['key' => 'translate_enabled', 'value' => $d['enabled'] ? '1' : '0'],
            ['key' => 'translate_max_chars', 'value' => (string) $d['max_chars']],
        ], ['key'], ['value']);

        return ['enabled' => (bool) $d['enabled'], 'max_chars' => (int) $d['max_chars']];
    }
}
