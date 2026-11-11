<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Document;
use App\Models\User;
use App\Support\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityController extends Controller
{
    private function isAdmin(Request $r): bool
    {
        return $r->user()->hasRole('admin');
    }

    // Activity visible to the current user (admins see everyone)
    private function scope(Request $r)
    {
        return Activity::query()->when(!$this->isAdmin($r), fn ($q) => $q->where('user_id', $r->user()->id));
    }

    public function index(Request $r)
    {
        $p = $r->filled('period') ? Period::from($r) : null;

        return $this->scope($r)
            ->with('user:id,name')
            ->when($p, fn ($q) => $q->whereBetween('created_at', [$p->from, $p->to]))
            ->when($this->isAdmin($r) && $r->query('user_id'), fn ($q, $id) => $q->where('user_id', $id))
            ->when($r->query('action'), fn ($q, $a) => $q->where('action', $a))
            ->orderByDesc('id')
            ->paginate(min((int) $r->query('per_page', 10), 50));
    }

    public function summary(Request $r)
    {
        $p = Period::from($r);

        return [
            'period' => $p->meta(),
            'series' => $p->series($this->scope($r)),
            'by_action' => $this->scope($r)
                ->whereBetween('created_at', [$p->from, $p->to])
                ->selectRaw('action as name, count(*) as value')->groupBy('action')->get(),
        ];
    }

    public function users(Request $r)
    {
        abort_unless($this->isAdmin($r), 403, 'Only admins can view user analytics.');
        $p = Period::from($r);

        $by_role = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_type', User::class)
            ->selectRaw('roles.name as name, count(*) as value')
            ->groupBy('roles.name')->get();

        $new_users = $p->series(User::query());

        $top_uploaders = Document::withTrashed()
            ->join('users', 'users.id', '=', 'documents.uploaded_by')
            ->whereBetween('documents.created_at', [$p->from, $p->to])
            ->selectRaw('users.name as name, count(documents.id) as value')
            ->groupBy('users.id', 'users.name')->orderByDesc('value')->limit(5)->get();

        $top_active = Activity::join('users', 'users.id', '=', 'activities.user_id')
            ->whereBetween('activities.created_at', [$p->from, $p->to])
            ->selectRaw('users.name as name, count(activities.id) as value')
            ->groupBy('users.id', 'users.name')->orderByDesc('value')->limit(5)->get();

        return [
            'period' => $p->meta(),
            'total_users' => User::count(),
            'new_in_range' => array_sum(array_column($new_users, 'total')),
            'active_in_range' => Activity::whereBetween('created_at', [$p->from, $p->to])
                ->whereNotNull('user_id')->distinct()->count('user_id'),
            'by_role' => $by_role,
            'new_users' => $new_users,
            'logins' => $p->series(Activity::query()->where('action', 'login')),
            'top_uploaders' => $top_uploaders,
            'top_active' => $top_active,
        ];
    }
}
