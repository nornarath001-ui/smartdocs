<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PublicDocumentController extends Controller
{
    private const FILE_TYPES = [
        'pdf' => ['pdf'],
        'word' => ['doc', 'docx'],
        'excel' => ['xls', 'xlsx', 'csv'],
        'powerpoint' => ['ppt', 'pptx'],
        'image' => ['png', 'jpg', 'jpeg'],
        'text' => ['txt'],
    ];

    // SQL expression that turns the file extension into a group name
    private function typeCase(): string
    {
        $parts = [];
        foreach (self::FILE_TYPES as $name => $exts) {
            $parts[] = "WHEN lower(original_name) ~ '\\.(" . implode('|', $exts) . ")$' THEN '" . $name . "'";
        }
        return 'CASE ' . implode(' ', $parts) . " ELSE 'other' END";
    }

    private function published()
    {
        return Document::query()->where('status', 'published');
    }

    // Published documents with every filter applied
    private function filtered(Request $r)
    {
        $r->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'year' => 'nullable|integer|min:1970|max:2100',
            'month' => 'nullable|integer|between:1,12',
        ]);

        $q = trim((string) $r->query('q', ''));
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $type = $r->query('file_type');

        return $this->published()
            ->when($q !== '', fn ($x) => $x->where(fn ($w) => $w
                ->where('title', 'ilike', $like)
                ->orWhere('description', 'ilike', $like)
                ->orWhere('organization', 'ilike', $like)
                ->orWhere('original_name', 'ilike', $like)))
            ->when($r->query('category'), fn ($x, $v) => $x->whereRaw('lower(trim(category)) = lower(trim(?))', [$v]))
            ->when($r->query('organization'), fn ($x, $v) => $x->whereRaw('lower(trim(organization)) = lower(trim(?))', [$v]))
            ->when(isset(self::FILE_TYPES[$type]), fn ($x) => $x->whereRaw(
                'lower(original_name) ~ ?', ['\\.(' . implode('|', self::FILE_TYPES[$type]) . ')$']
            ))
            ->when($r->query('year'), fn ($x, $v) => $x->whereYear('created_at', (int) $v))
            ->when($r->query('month'), fn ($x, $v) => $x->whereMonth('created_at', (int) $v))
            ->when($r->query('from'), fn ($x, $v) => $x->whereDate('created_at', '>=', $v))
            ->when($r->query('to'), fn ($x, $v) => $x->whereDate('created_at', '<=', $v));
    }

    public function index(Request $r)
    {
        [$col, $dir] = match ($r->query('sort')) {
            'oldest' => ['created_at', 'asc'],
            'title' => ['title', 'asc'],
            'size' => ['size', 'desc'],
            default => ['created_at', 'desc'],
        };

        return $this->filtered($r)
            ->orderBy($col, $dir)
            ->orderByDesc('id')
            ->paginate(
                min((int) $r->query('per_page', 10), 50),
                ['id', 'title', 'description', 'category', 'organization', 'mime_type', 'original_name', 'size', 'created_at']
            );
    }

    // Options for the select boxes (always over all published documents)
    public function filters()
    {
        $categories = Category::query()
            ->select('categories.name', 'categories.color')
            ->selectSub(
                Document::query()->selectRaw('count(*)')->where('status', 'published')
                    ->whereColumn('documents.category', 'categories.name'),
                'documents_count'
            )
            ->orderByDesc('documents_count')->orderBy('name')->get();

        return [
            'categories' => $categories,
            'organizations' => $this->published()->whereNotNull('organization')
                ->selectRaw('organization as name, count(*) as value')
                ->groupBy('organization')->orderBy('name')->get(),
            'file_types' => $this->published()
                ->selectRaw($this->typeCase() . ' as name, count(*) as value')
                ->groupBy('name')->orderByDesc('value')->get(),
            'years' => $this->published()
                ->selectRaw('extract(year from created_at)::int as y')
                ->distinct()->orderByDesc('y')->pluck('y'),
        ];
    }

    // Summary of the currently filtered documents
    public function summary(Request $r)
    {
        $q = fn () => $this->filtered($r);
        $series = fn ($rows) => $rows->map(fn ($x) => ['key' => $x->k, 'total' => (int) $x->v])->values();

        $group = fn (string $fmt, string $order, int $limit = 0) => $series(
            ($limit
                ? $q()->selectRaw("to_char(created_at, '{$fmt}') as k, count(*) as v")->groupBy('k')->orderByDesc('k')->limit($limit)->get()->reverse()
                : $q()->selectRaw("to_char(created_at, '{$fmt}') as k, count(*) as v")->groupBy('k')->orderBy('k')->get())
        );

        return [
            'total' => $q()->count(),
            'size' => (int) $q()->sum('size'),
            'downloads' => (int) $q()->sum('download_count'),
            'organizations_count' => $q()->whereNotNull('organization')->distinct()->count('organization'),
            'by_day' => $group('YYYY-MM-DD', 'k', 14),
            'by_month' => $group('YYYY-MM', 'k', 12),
            'by_year' => $group('YYYY', 'k'),
            'by_category' => $q()->selectRaw('category as name, count(*) as value')
                ->groupBy('category')->orderByDesc('value')->get(),
            'by_file_type' => $q()->selectRaw($this->typeCase() . ' as name, count(*) as value')
                ->groupBy('name')->orderByDesc('value')->get(),
            'by_organization' => $q()->whereNotNull('organization')
                ->selectRaw('organization as name, count(*) as value')
                ->groupBy('organization')->orderByDesc('value')->limit(8)->get(),
        ];
    }

    // Kept for the category chips of older code
    public function categories()
    {
        return $this->filters()['categories'];
    }

    private function guard(Document $d): void
    {
        abort_unless($d->status === 'published', 404, 'This document is no longer available.');
        abort_unless(Storage::exists($d->path), 404, 'File not found.');
    }

    public function download(Document $document)
    {
        $this->guard($document);
        $document->increment('download_count');

        return Storage::download($document->path, $document->original_name);
    }

    public function preview(Document $document)
    {
        $this->guard($document);

        return Storage::response($document->path, $document->original_name, [
            'Content-Type' => $document->mime_type ?: Storage::mimeType($document->path),
        ], 'inline');
    }
}
