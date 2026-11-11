<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    private const ROLES = ['admin', 'manager', 'staff'];

    private function admin(Request $r): void
    {
        abort_unless($r->user()->hasRole('admin'), 403, 'Only admins can manage users.');
    }

    private function payload(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->getRoleNames()->first() ?? 'staff',
            'created_at' => $u->created_at,
        ];
    }

    public function index(Request $r)
    {
        $this->admin($r);
        $q = trim((string) $r->query('q', ''));

        return User::with('roles:id,name')
            ->when($q !== '', fn ($x) => $x->where(fn ($w) => $w
                ->where('name', 'ilike', "%{$q}%")->orWhere('email', 'ilike', "%{$q}%")))
            ->when(in_array($r->query('role'), self::ROLES), fn ($x) => $x->role($r->query('role')))
            ->orderBy('name')
            ->paginate(min((int) $r->query('per_page', 10), 50))
            ->through(fn (User $u) => $this->payload($u));
    }

    public function store(Request $r)
    {
        $this->admin($r);

        $data = $r->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'role' => ['required', Rule::in(self::ROLES)],
            'password' => ['required', Password::min(8)->letters()->numbers()],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'], // hashed by the model cast
        ]);
        $user->syncRoles([$data['role']]);

        return response()->json($this->payload($user), 201);
    }

    public function update(Request $r, User $user)
    {
        $this->admin($r);

        $data = $r->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in(self::ROLES)],
            'password' => ['nullable', Password::min(8)->letters()->numbers()],
        ]);

        $wasAdmin = $user->hasRole('admin');
        if ($wasAdmin && $data['role'] !== 'admin' && User::role('admin')->count() <= 1) {
            abort(422, 'You cannot remove the last admin.');
        }

        $user->fill(['name' => $data['name'], 'email' => $data['email']]);
        if (!empty($data['password'])) {
            $user->password = $data['password'];
            $user->tokens()->delete(); // force re-login with the new password
        }
        $user->save();
        $user->syncRoles([$data['role']]);

        return $this->payload($user);
    }

    public function destroy(Request $r, User $user)
    {
        $this->admin($r);

        abort_if($user->id === $r->user()->id, 422, 'You cannot delete your own account.');
        abort_if(
            $user->hasRole('admin') && User::role('admin')->count() <= 1,
            422, 'You cannot delete the last admin.'
        );
        abort_if(
            Document::withTrashed()->where('uploaded_by', $user->id)->exists(),
            422, 'This user has uploaded documents and cannot be deleted. Change the role instead.'
        );

        $user->tokens()->delete();
        $user->delete();

        return response()->noContent();
    }
}
