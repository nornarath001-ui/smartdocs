<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Document;
use App\Support\Period;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    private function canManage(Request $r): bool
    {
        return $r->user()->hasAnyRole(['admin', 'manager']);
    }

    private function requireManage(Request $r): void
    {
        abort_unless($this->canManage($r), 403, 'You do not have permission.');
    }

    private function requireVisible(Request $r, Document $d): void
    {
        abort_if($d->status !== 'published' && !$this->canManage($r), 404, 'This document is not available. It may be a draft.');
    }

    public function index(Request $r)
    {
        $q = trim((string) $r->query('q', ''));
        $manage = $this->canManage($r);

        return Document::with('uploader:id,name')
            ->when(!$manage, fn ($x) => $x->where('status', 'published'))
            ->when($q !== '', function ($x) use ($q) {
                $like = "%{$q}%";
                $x->where(fn ($w) => $w->where('title', 'ilike', $like)
                    ->orWhere('description', 'ilike', $like)
                    ->orWhere('organization', 'ilike', $like)
                    ->orWhere('original_name', 'ilike', $like));
            })
            ->when($r->query('category'), fn ($x, $c) => $x->where('category', $c))
            ->when($r->query('organization'), fn ($x, $o) => $x->where('organization', $o))
            ->when($manage && $r->query('status'), fn ($x) => $x->where('status', $r->query('status')))
            ->latest()
            ->paginate(min((int) $r->query('per_page', 10), 50));
    }

    private function duplicateResponse(?Document $existing)
    {
        return response()->json([
            'message' => 'Duplicate file. This document already exists'
                . ($existing ? ': "' . $existing->title . '"' : '.'),
            'existing' => $existing ? ['id' => $existing->id, 'title' => $existing->title] : null,
        ], 409);
    }

    public function checkDuplicates(Request $r)
    {
        $this->requireManage($r);

        $data = $r->validate([
            'hashes' => 'required|array|max:500',
            'hashes.*' => 'string|size:64',
        ]);

        return [
            'duplicates' => Document::whereIn('file_hash', $data['hashes'])->pluck('title', 'file_hash'),
        ];
    }

    public function store(Request $r)
    {
        $this->requireManage($r);

        $data = $r->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category' => 'required|string|exists:categories,name',
            'status' => 'required|in:draft,published',
            'organization' => 'nullable|string|max:150',
            'file' => 'required|file|max:102400|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,png,jpg,jpeg,txt,csv',
        ]);

        $file = $r->file('file');
        $hash = hash_file('sha256', $file->getRealPath());

        if ($existing = Document::where('file_hash', $hash)->first()) {
            return $this->duplicateResponse($existing);
        }

        $path = $file->store('documents');
        abort_if(!$path || !Storage::exists($path), 500, 'Could not save the file. Check storage permissions.');

        try {
            $doc = Document::create([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'category' => $data['category'],
                'status' => $data['status'],
                'organization' => $data['organization'] ?? null,
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'file_hash' => $hash,
                'uploaded_by' => $r->user()->id,
            ]);
        } catch (UniqueConstraintViolationException $e) {
            Storage::delete($path); // lost a race with a parallel upload
            return $this->duplicateResponse(Document::where('file_hash', $hash)->first());
        }

        return response()->json($doc->load('uploader:id,name'), 201);
    }

    public function show(Request $r, Document $document)
    {
        $this->requireVisible($r, $document);
        return $document->load('uploader:id,name');
    }

    public function update(Request $r, Document $document)
    {
        $this->requireManage($r);

        $data = $r->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category' => 'required|string|exists:categories,name',
            'status' => 'required|in:draft,published',
            'organization' => 'nullable|string|max:150',
        ]);

        $document->update($data);
        return $document->load('uploader:id,name');
    }

    public function destroy(Request $r, Document $document)
    {
        $this->requireManage($r);
        $document->delete(); // soft delete, file is kept
        return response()->noContent();
    }

    private function fileOrFail(Document $d): void
    {
        abort_unless(
            Storage::exists($d->path),
            404,
            'File not found on the server. Please upload it again.'
        );
    }

    public function download(Request $r, Document $document)
    {
        $this->requireVisible($r, $document);
        $this->fileOrFail($document);
        $document->increment('download_count');

        return Storage::download($document->path, $document->original_name, [
            'Access-Control-Expose-Headers' => 'Content-Disposition',
        ]);
    }

    public function preview(Request $r, Document $document)
    {
        $this->requireVisible($r, $document);
        $this->fileOrFail($document);

        return Storage::response($document->path, $document->original_name, [
            'Content-Type' => $document->mime_type ?: Storage::mimeType($document->path),
            'Access-Control-Expose-Headers' => 'Content-Disposition',
        ], 'inline');
    }

    public function stats(Request $r)
    {
        $manage = $this->canManage($r);
        $p = Period::from($r);

        $docs = fn () => Document::query()->when(!$manage, fn ($x) => $x->where('status', 'published'));
        $downloads = fn () => Activity::query()->where('action', 'download')
            ->when(!$manage, fn ($x) => $x->where('user_id', $r->user()->id));
        $inRange = fn ($q) => $q->whereBetween('created_at', [$p->from, $p->to]);

        $uploads = $p->series($docs());
        $dl = $p->series($downloads());
        $storage = $p->series($docs(), 'coalesce(sum(size),0)');

        return [
            'period' => $p->meta(),
            'cards' => [
                'total' => $docs()->count(),
                'published' => Document::where('status', 'published')->count(),
                'draft' => $manage ? Document::where('status', 'draft')->count() : 0,
                'downloads' => (int) $docs()->sum('download_count'),
                'storage' => (int) $docs()->sum('size'),
                'uploads_in_range' => array_sum(array_column($uploads, 'total')),
                'downloads_in_range' => array_sum(array_column($dl, 'total')),
                'storage_in_range' => array_sum(array_column($storage, 'total')),
            ],
            'uploads' => $uploads,
            'downloads' => $dl,
            'storage_added' => $storage,
            'by_category' => $inRange($docs())->selectRaw('category as name, count(*) as value')->groupBy('category')->get(),
            'by_status' => $manage
                ? $inRange(Document::query())->selectRaw('status as name, count(*) as value')->groupBy('status')->get()
                : [],
            'top_downloaded' => $docs()->where('download_count', '>', 0)
                ->orderByDesc('download_count')->limit(5)->get(['id', 'title', 'download_count']),
            'recent' => $docs()->with('uploader:id,name')->latest()->limit(5)->get(),
        ];
    }
}
