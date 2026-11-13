<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('training_states', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->json('payload');
            $table->unsignedInteger('revision')->default(0);
            $table->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('training_states');
    }
};
