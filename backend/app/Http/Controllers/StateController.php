<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StateController extends Controller
{
    public function show()
    {
        $state = DB::table('training_states')->find(1);

        return response()->json(['revision' => $state?->revision ?? 0, 'state' => $state ? json_decode($state->payload, true) : null]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:0'],
            'state' => ['required', 'array:version,profile,week,sessions,active'],
            'state.version' => ['required', 'integer', Rule::in([1])],
            'state.profile' => ['required', 'array:name,goal,experience,equipment,autonomy'],
            'state.profile.name' => ['present', 'nullable', 'string', 'max:80'],
            'state.profile.goal' => ['required', 'string', 'max:100'],
            'state.profile.experience' => ['required', Rule::in(['Iniciante', 'Intermediário', 'Avançado'])],
            'state.profile.equipment' => ['present', 'nullable', 'string', 'max:200'],
            'state.profile.autonomy' => ['required', 'boolean'],
            'state.week' => ['required', 'array', 'size:7'],
            'state.week.*' => ['array:day,name,time,type,minutes,workoutId'],
            'state.week.*.workoutId' => ['sometimes', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'state.week.*.day' => ['required', Rule::in(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']), 'distinct'],
            'state.week.*.name' => ['required', 'string', 'max:150'],
            'state.week.*.time' => ['present', 'nullable', 'date_format:H:i'],
            'state.week.*.type' => ['required', Rule::in(['strength', 'sport', 'cardio', 'rest'])],
            'state.week.*.minutes' => ['required', 'integer', 'min:0', 'max:600'],
            'state.sessions' => ['present', 'array', 'max:2000'],
            'state.active' => ['present', 'nullable', 'array'],
        ]);
        foreach ($data['state']['sessions'] as $session) {
            $this->validateSession($session);
        }
        if ($data['state']['active'] !== null) {
            $this->validateSession($data['state']['active']);
        }

        return DB::transaction(function () use ($data) {
            DB::table('training_states')->insertOrIgnore(['id' => 1, 'payload' => '{}', 'revision' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $state = DB::table('training_states')->lockForUpdate()->find(1);
            if ($state->revision !== $data['revision']) {
                return response()->json(['message' => 'O histórico no servidor mudou. Baixe a versão atual antes de salvar.', 'revision' => $state->revision], 409);
            }
            DB::table('training_states')->where('id', 1)->update(['payload' => json_encode($data['state'], JSON_THROW_ON_ERROR), 'revision' => $state->revision + 1, 'updated_at' => now()]);

            return response()->json(['revision' => $state->revision + 1, 'message' => 'Histórico salvo no servidor.']);
        });
    }

    private function validateSession(mixed $session): void
    {
        $validated = validator(['session' => $session], [
            'session' => ['required', 'array:id,date,name,minutes,exercises,note,completed'],
            'session.id' => ['required', 'uuid'], 'session.date' => ['required', 'date'],
            'session.name' => ['required', 'string', 'max:150'],
            'session.minutes' => ['required', 'integer', 'min:1', 'max:600'],
            'session.note' => ['present', 'nullable', 'string', 'max:2000'],
            'session.completed' => ['required', 'boolean'],
            'session.exercises' => ['present', 'array', 'max:30'],
            'session.exercises.*' => ['array:id,name,detail,target,previous,sets,metrics'],
            'session.exercises.*.metrics' => ['sometimes', 'array:key,loadBasis,setType,repMin,repMax'],
            'session.exercises.*.metrics.key' => ['required_with:session.exercises.*.metrics', 'string', 'max:150'],
            'session.exercises.*.metrics.loadBasis' => ['required_with:session.exercises.*.metrics', 'string', 'max:100'],
            'session.exercises.*.metrics.setType' => ['required_with:session.exercises.*.metrics', 'string', 'max:100'],
            'session.exercises.*.metrics.repMin' => ['required_with:session.exercises.*.metrics', 'integer', 'min:1', 'max:200'],
            'session.exercises.*.metrics.repMax' => ['required_with:session.exercises.*.metrics', 'integer', 'min:1', 'max:200', 'gte:session.exercises.*.metrics.repMin'],
            'session.exercises.*.id' => ['required', 'uuid'],
            'session.exercises.*.name' => ['required', 'string', 'max:150'],
            'session.exercises.*.detail' => ['required', 'string', 'max:300'],
            'session.exercises.*.target' => ['required', 'string', 'max:300'],
            'session.exercises.*.previous' => ['required', 'string', 'max:300'],
            'session.exercises.*.sets' => ['required', 'array', 'max:20'],
            'session.exercises.*.sets.*' => ['array:kg,reps,rir,done'],
            'session.exercises.*.sets.*.kg' => ['present', 'nullable', 'numeric', 'min:0', 'max:1000'],
            'session.exercises.*.sets.*.reps' => ['present', 'nullable', 'integer', 'min:1', 'max:200'],
            'session.exercises.*.sets.*.rir' => ['present', 'nullable', 'integer', 'min:0', 'max:10'],
            'session.exercises.*.sets.*.done' => ['required', 'boolean'],
        ])->validate();
        foreach ($validated['session']['exercises'] as $exercise) {
            foreach ($exercise['sets'] as $set) {
                if ($set['done'] && ($set['kg'] === null || $set['reps'] === null)) {
                    throw ValidationException::withMessages(['state.sessions' => 'Uma série confirmada exige carga e repetições.']);
                }
            }
        }
    }
}
