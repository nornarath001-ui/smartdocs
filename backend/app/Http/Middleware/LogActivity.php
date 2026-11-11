<?php

namespace App\Http\Middleware;

use App\Models\Activity;
use App\Models\Category;
use App\Models\Document;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class LogActivity
{
    private const MAP = [
        'POST api/login' => 'login',
        'POST api/logout' => 'logout',
        'POST api/documents' => 'upload',
        'PUT api/documents/{document}' => 'update_document',
        'DELETE api/documents/{document}' => 'delete_document',
        'GET api/documents/{document}/download' => 'download',
        'POST api/users' => 'create_user',
        'PUT api/users/{user}' => 'update_user',
        'DELETE api/users/{user}' => 'delete_user',
        'PUT api/me/password' => 'change_password',
        'PUT api/me' => 'update_profile',
        'POST api/translate' => 'translate',
        'POST api/categories' => 'create_category',
        'PUT api/categories/{category}' => 'update_category',
        'DELETE api/categories/{category}' => 'delete_category',
    ];

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        try {
            $this->record($request, $response);
        } catch (\Throwable $e) {
            report($e); // never break the request because of logging
        }

        return $response;
    }

    private function record(Request $request, $response): void
    {
        if ($response->getStatusCode() >= 400 || !($route = $request->route())) {
            return;
        }

        $action = self::MAP[$request->method() . ' ' . $route->uri()] ?? null;
        if (!$action) {
            return;
        }

        $user = $action === 'login'
            ? User::where('email', $request->input('email'))->first()
            : $request->user();

        $doc = $route->parameter('document');
        $target = $route->parameter('user');

        $description = match (true) {
            $doc instanceof Document => $doc->title,
            $target instanceof User => $target->name,
            $route->parameter('category') instanceof Category => $route->parameter('category')->name,
            $action === 'upload' => $request->input('title'),
            in_array($action, ['create_user', 'create_category'], true) => $request->input('name'),
            $action === 'translate' => $request->input('source') . ' > ' . $request->input('target')
                . ' (' . mb_strlen((string) $request->input('text')) . ' chars)',
            default => null,
        };

        Activity::create([
            'user_id' => $user?->id,
            'action' => $action,
            'description' => $description ? mb_substr($description, 0, 250) : null,
            'ip' => $request->ip(),
        ]);
    }
}
