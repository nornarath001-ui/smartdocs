<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $t) {
            $t->string('file_hash', 64)->nullable()->after('size');
        });

        // Unique only for documents that are not deleted
        DB::statement('CREATE UNIQUE INDEX documents_file_hash_unique
            ON documents (file_hash) WHERE deleted_at IS NULL AND file_hash IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS documents_file_hash_unique');
        Schema::table('documents', fn (Blueprint $t) => $t->dropColumn('file_hash'));
    }
};
