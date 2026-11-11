<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    private function manage(Request $r): void
    {
        abort_unless($r->user()->hasAnyRole(['admin', 'manager']), 403, 'You do not have permission.');
    }

    private function rules(?Category $c = null): array
    {
        return [
            'name' => ['required', 'string', 'max:100', function ($attr, $value, $fail) use ($c) {
                $q = Category::whereRaw('lower(name) = ?', [mb_strtolower(trim($value))]);
                if ($c) {
                    $q->where('id', '!=', $c->id);
                }
                if ($q->exists()) {
                    $fail('This category already exists.');
                }
            }],
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'description' => 'nullable|string|max:255',
        ];
    }

    public function index()
    {
        return Category::query()
            ->select('categories.*')
            ->selectSub(
                Document::query()->selectRaw('count(*)')->whereColumn('documents.category', 'categories.name'),
                'documents_count'
            )
            ->orderBy('name')
            ->get();
    }

    public function store(Request $r)
    {
        $this->manage($r);
        $data = $r->validate($this->rules());
        $data['name'] = trim($data['name']);

        return response()->json(Category::create($data), 201);
    }

    public function update(Request $r, Category $category)
    {
        $this->manage($r);
        $data = $r->validate($this->rules($category));
        $data['name'] = trim($data['name']);
        $old = $category->name;

        DB::transaction(function () use ($category, $data, $old) {
            $category->update($data);
            if ($old !== $category->name) {
                Document::withTrashed()->where('category', $old)->update(['category' => $category->name]);
            }
        });

        return $category;
    }

    public function destroy(Request $r, Category $category)
    {
        $this->manage($r);
        abort_if(Category::count() <= 1, 422, 'You cannot delete the last category.');

        $count = Document::withTrashed()->where('category', $category->name)->count();
        $move = $r->query('move_to');

        if ($count > 0) {
            abort_if(!$move, 422, "This category is used by {$count} document(s). Choose another category to move them to.");
            abort_if($move === $category->name || !Category::where('name', $move)->exists(), 422, 'Invalid target category.');
        }

        DB::transaction(function () use ($category, $count, $move) {
            if ($count > 0) {
                Document::withTrashed()->where('category', $category->name)->update(['category' => $move]);
            }
            $category->delete();
        });

        return response()->noContent();
    }
}
