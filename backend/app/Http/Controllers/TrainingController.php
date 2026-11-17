<?php

namespace App\Http\Controllers;

use App\TrainingContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use JsonException;

class TrainingController extends Controller
{
    public function show(): JsonResponse
    {
        $state = DB::table('training_states')->find(2);

        return response()->json(['revision' => $state?->revision ?? 0, 'library' => $state ? json_decode($state->payload) : null]);
    }

    public function update(Request $request, TrainingContract $contract): JsonResponse
    {
        $input = $request->validate(['revision' => ['required', 'integer', 'min:0'], 'library' => ['required', 'array']]);
        $payload = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        $library = $contract->assertValid($payload->library, 'library');

        return DB::transaction(function () use ($input, $library, $contract): JsonResponse {
            DB::table('training_states')->insertOrIgnore(['id' => 2, 'payload' => '{}', 'revision' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $state = DB::table('training_states')->lockForUpdate()->find(2);
            if ($state->revision !== (int) $input['revision']) {
                return response()->json(['message' => 'A biblioteca no servidor mudou. Consulte a versão atual antes de salvar.', 'revision' => $state->revision], 409);
            }
            $contract->preserveVersions(json_decode($state->payload), $library);
            DB::table('training_states')->where('id', 2)->update(['payload' => json_encode($library, JSON_THROW_ON_ERROR), 'revision' => $state->revision + 1, 'updated_at' => now()]);

            return response()->json(['revision' => $state->revision + 1, 'message' => 'Biblioteca validada e salva.']);
        });
    }

    public function validateWorkout(Request $request, TrainingContract $contract): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw ValidationException::withMessages(['library' => 'JSON inválido. Nenhum treino foi importado.']);
        }
        $workout = $contract->assertValid($data, 'workout');

        return response()->json(['valid' => true, 'workout' => $workout]);
    }
}
