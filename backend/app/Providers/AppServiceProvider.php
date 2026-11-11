<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Reset emails link to the React page
        ResetPassword::createUrlUsing(fn ($user, string $token) =>
            rtrim(config('smartdocs.frontend_url'), '/')
            . '/reset-password?token=' . $token
            . '&email=' . urlencode($user->getEmailForPasswordReset())
        );
    }
}
