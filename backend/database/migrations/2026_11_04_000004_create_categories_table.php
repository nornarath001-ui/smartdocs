<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('color', 7)->default('#6366f1');
            $t->string('description')->nullable();
            $t->timestamps();
        });

        // Keep every category already used by documents, plus the defaults
        $used = DB::table('documents')->distinct()->pluck('category')->filter()->all();
        $names = array_values(array_unique(array_merge(['General', 'Contract', 'Invoice', 'Report', 'HR', 'Legal'], $used)));
        $colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

        foreach ($names as $i => $name) {
            DB::table('categories')->insert([
                'name' => $name,
                'color' => $colors[$i % count($colors)],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
