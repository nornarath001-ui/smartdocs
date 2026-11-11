<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// API requests always get JSON answers (never a redirect that the browser repeats as GET)
class ForceJson
{
    public function handle(Request $request, Closure $next)
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
