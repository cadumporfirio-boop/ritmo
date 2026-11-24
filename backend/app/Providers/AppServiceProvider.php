<?php

namespace App\Providers;

use App\PlanningProvider;
use App\UnconfiguredPlanningProvider;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PlanningProvider::class, UnconfiguredPlanningProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
