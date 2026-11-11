<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        Schema::create('documents', function (Blueprint $t) {
            $t->id();
            $t->string('title');
            $t->text('description')->nullable();
            $t->string('category')->default('General');
            $t->string('status')->default('published'); // draft | published
            $t->string('path');
            $t->string('original_name');
            $t->string('mime_type')->nullable();
            $t->unsignedBigInteger('size')->default(0);
            $t->unsignedInteger('download_count')->default(0);
            $t->foreignId('uploaded_by')->constrained('users');
            $t->timestamps();
            $t->softDeletes();
        });

        DB::statement('CREATE INDEX documents_title_trgm ON documents USING GIN (title gin_trgm_ops)');
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
