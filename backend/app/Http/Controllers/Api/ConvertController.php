<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class ConvertController extends Controller
{
    private function workdir(): string
    {
        $dir = storage_path('app/tmp/convert/' . Str::uuid());
        File::ensureDirectoryExists($dir, 0777);
        @chmod($dir, 0777);

        return $dir;
    }

    private function fail(string $dir, string $message, int $status = 422)
    {
        File::deleteDirectory($dir);

        return response()->json(['message' => $message], $status);
    }

    private function outName(string $original, string $ext): string
    {
        $base = pathinfo($original, PATHINFO_FILENAME);
        $base = trim(preg_replace('/[\\\\\/:*?"<>|\x00-\x1f]+/u', '_', $base)) ?: 'document';

        return mb_substr($base, 0, 120) . '.' . $ext;
    }

    private function send(string $dir, string $path, string $name)
    {
        app()->terminating(fn () => File::deleteDirectory($dir));

        return response()->download($path, $name);
    }

    public function wordToPdf(Request $r)
    {
        set_time_limit(180);
        $r->validate(['file' => 'required|file|max:20480|mimes:doc,docx,odt,rtf']);

        $file = $r->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        abort_unless(in_array($ext, ['doc', 'docx', 'odt', 'rtf'], true), 422, 'Unsupported file type.');

        $dir = $this->workdir();
        $file->move($dir, "input.$ext");

        $p = new Process([
            'soffice', '--headless', '--norestore', '--nolockcheck',
            "-env:UserInstallation=file://$dir/profile",
            '--convert-to', 'pdf:writer_pdf_Export',
            '--outdir', $dir, "$dir/input.$ext",
        ], $dir, ['HOME' => $dir], null, 150);

        try {
            $p->run();
        } catch (\Throwable $e) {
            report($e);

            return $this->fail($dir, 'The conversion took too long. Try a smaller file.', 504);
        }

        if (!is_file("$dir/input.pdf") || filesize("$dir/input.pdf") === 0) {
            report(new \RuntimeException('soffice: ' . $p->getErrorOutput() . $p->getOutput()));

            return $this->fail($dir, 'Could not convert this file. It may be damaged or password protected.');
        }

        return $this->send($dir, "$dir/input.pdf", $this->outName($file->getClientOriginalName(), 'pdf'));
    }

    public function pdfToWord(Request $r)
    {
        set_time_limit(240);
        $r->validate(['file' => 'required|file|max:20480|mimes:pdf']);

        $file = $r->file('file');
        $dir = $this->workdir();
        $file->move($dir, 'input.pdf');

        $code = 'import sys; from pdf2docx import Converter; '
            . 'cv = Converter(sys.argv[1]); cv.convert(sys.argv[2]); cv.close()';

        $p = new Process(['/opt/pdfenv/bin/python', '-c', $code, "$dir/input.pdf", "$dir/output.docx"], $dir, ['HOME' => $dir], null, 200);

        try {
            $p->run();
        } catch (\Throwable $e) {
            report($e);

            return $this->fail($dir, 'The conversion took too long. Try a smaller file.', 504);
        }

        if (!is_file("$dir/output.docx") || filesize("$dir/output.docx") === 0) {
            report(new \RuntimeException('pdf2docx: ' . $p->getErrorOutput()));

            return $this->fail($dir, 'Could not convert this PDF. It may be damaged or password protected.');
        }

        return $this->send($dir, "$dir/output.docx", $this->outName($file->getClientOriginalName(), 'docx'));
    }
}
