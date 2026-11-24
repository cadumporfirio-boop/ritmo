<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TrainingContractTest extends TestCase
{
    use RefreshDatabase;

    private string $token = 'structured-training-test-owner-token';

    protected function setUp(): void
    {
        parent::setUp();
        config(['ritmo.owner_token' => $this->token]);
    }

    private function workout(): object
    {
        return json_decode('{"kind":"workout","schemaVersion":2,"id":"plan-a","revision":1,"title":"Treino","sport":"mixed","notes":"","nodes":[{"kind":"group","id":"block-a","name":"Circuito","repeat":2,"children":[{"kind":"step","id":"step-a","name":"Atividade","role":"work","equipment":"","notes":"","goals":[{"metric":"duration","mode":"min","required":true,"min":60}]}]}]}');
    }

    private function library(): object
    {
        return (object) ['kind' => 'library', 'schemaVersion' => 2, 'workouts' => [$this->workout()], 'sessions' => [], 'active' => null];
    }

    public function test_private_library_requires_token(): void
    {
        $this->getJson('/api/training')->assertUnauthorized();
        $this->postJson('/api/training/validate', (array) $this->workout())->assertUnauthorized();
    }

    public function test_shared_contract_accepts_interval_workout_and_rejects_invalid_range(): void
    {
        $plan = $this->workout();
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertOk()->assertJsonPath('valid', true);

        $plan->nodes[0]->children[0]->goals[0] = (object) ['metric' => 'reps', 'mode' => 'range', 'required' => true, 'min' => 12, 'max' => 8];
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable()->assertJsonPath('errors.library.0', 'O mínimo da meta não pode superar o máximo.');
    }

    public function test_server_library_is_separate_from_legacy_and_rejects_stale_revision(): void
    {
        DB::table('training_states')->insert(['id' => 1, 'payload' => '{"legacy":true}', 'revision' => 4, 'created_at' => now(), 'updated_at' => now()]);
        $library = $this->library();

        $this->withToken($this->token)->putJson('/api/training', ['revision' => 0, 'library' => $library])->assertOk()->assertJsonPath('revision', 1);
        $this->withToken($this->token)->getJson('/api/training')->assertOk()->assertJsonPath('library.workouts.0.title', 'Treino');
        $this->assertDatabaseHas('training_states', ['id' => 1, 'revision' => 4, 'payload' => '{"legacy":true}']);
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 0, 'library' => $library])->assertStatus(409);
    }

    public function test_unknown_fields_and_duplicate_steps_are_rejected(): void
    {
        $plan = $this->workout();
        $plan->unknown = true;
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable();
        unset($plan->unknown);
        $plan->nodes[] = clone $plan->nodes[0];
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable()->assertJsonPath('errors.library.0', 'Cada etapa ou bloco precisa de um identificador único.');
    }

    public function test_expansion_is_bounded(): void
    {
        $plan = $this->workout();
        $plan->nodes[0]->repeat = 30;
        $plan->nodes[0]->children = [(object) ['kind' => 'group', 'id' => 'inner', 'name' => 'Interno', 'repeat' => 30, 'children' => $plan->nodes[0]->children]];

        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable()->assertJsonPath('errors.library.0', 'O treino excede 300 etapas executadas. Divida-o em sessões.');
    }

    public function test_session_requires_matching_entries_and_completed_values(): void
    {
        $library = $this->library();
        $library->active = (object) ['kind' => 'session', 'schemaVersion' => 2, 'id' => 'session-a', 'date' => '2026-11-17T10:00:00.000Z', 'plan' => $library->workouts[0], 'entries' => [
            (object) ['key' => '0r0/0', 'stepId' => 'step-a', 'values' => (object) [], 'done' => false, 'skipped' => false, 'note' => ''],
            (object) ['key' => '0r1/0', 'stepId' => 'step-a', 'values' => (object) [], 'done' => false, 'skipped' => false, 'note' => ''],
        ], 'completed' => false, 'note' => ''];

        $this->withToken($this->token)->putJson('/api/training', ['revision' => 0, 'library' => $library])->assertOk();
        $library->active->entries[0]->done = true;
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 1, 'library' => $library])->assertUnprocessable();
        $library->active->entries[0]->values->duration = 60;
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 1, 'library' => $library])->assertOk();
        $library->active->entries[1]->key = 'wrong';
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 2, 'library' => $library])->assertUnprocessable();
    }

    public function test_metric_boundaries_apply_to_goals(): void
    {
        $plan = $this->workout();
        $plan->nodes[0]->children[0]->goals = [(object) ['metric' => 'rir', 'mode' => 'range', 'required' => true, 'min' => 0, 'max' => 11]];

        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable();
    }

    public function test_existing_workout_revision_cannot_be_silently_rewritten(): void
    {
        $library = $this->library();
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 0, 'library' => $library])->assertOk();
        $library->workouts[0]->title = 'Alteração sem nova versão';

        $this->withToken($this->token)->putJson('/api/training', ['revision' => 1, 'library' => $library])->assertUnprocessable();
        $this->withToken($this->token)->getJson('/api/training')->assertJsonPath('library.workouts.0.title', 'Treino')->assertJsonPath('revision', 1);
    }

    public function test_series_expand_inside_steps_and_extra_series_preserve_planned_entries(): void
    {
        $library = $this->library();
        $plan = $library->workouts[0];
        $step = $plan->nodes[0]->children[0];
        $step->series = [
            (object) ['id' => 'warmup', 'role' => 'warmup', 'goals' => [(object) ['metric' => 'reps', 'mode' => 'range', 'required' => true, 'min' => 8, 'max' => 12]]],
            (object) ['id' => 'top', 'role' => 'top', 'goals' => $step->goals],
        ];
        $entries = [];
        for ($round = 0; $round < 2; $round++) {
            for ($series = 0; $series < 2; $series++) {
                $entries[] = (object) ['key' => '0r'.$round.'/0s'.$series, 'stepId' => 'step-a', 'values' => (object) [], 'done' => false, 'skipped' => false, 'note' => ''];
            }
        }
        $entries[] = (object) ['key' => 'extra-one', 'stepId' => 'step-a', 'values' => (object) ['duration' => 60], 'done' => true, 'skipped' => false, 'note' => '', 'extra' => (object) ['afterKey' => '0r0/0s1', 'role' => 'work', 'goals' => $step->goals]];
        $library->active = (object) ['kind' => 'session', 'schemaVersion' => 2, 'id' => 'series-session', 'date' => '2026-11-17T10:00:00.000Z', 'plan' => $plan, 'entries' => $entries, 'completed' => false, 'note' => ''];
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 0, 'library' => $library])->assertOk();
        $library->active->entries[0]->done = true;
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 1, 'library' => $library])->assertUnprocessable();
        $library->active->entries[0]->done = false;
        $library->active->entries[4]->extra->afterKey = 'missing';
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 1, 'library' => $library])->assertUnprocessable();
    }

    public function test_series_reject_duplicate_identifiers_and_inconsistent_goals(): void
    {
        $plan = $this->workout();
        $step = $plan->nodes[0]->children[0];
        $step->series = [(object) ['id' => 'series-one', 'role' => 'top', 'goals' => [(object) ['metric' => 'reps', 'mode' => 'range', 'required' => true, 'min' => 12, 'max' => 8]]]];
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable();
        $step->series[0]->goals = $step->goals;
        $step->series[] = clone $step->series[0];
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable();
    }

    public function test_rest_and_relative_load_have_independent_limits_and_units(): void
    {
        $plan = $this->workout();
        $plan->nodes[0]->children[0]->goals = [
            (object) ['metric' => 'rest', 'mode' => 'range', 'required' => false, 'min' => 0, 'max' => 180],
            (object) ['metric' => 'percent1rm', 'mode' => 'range', 'required' => false, 'min' => 70, 'max' => 85],
        ];
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertOk();
        $plan->nodes[0]->children[0]->goals[1]->min = 0.005;
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable();
        $plan->nodes[0]->children[0]->goals[1]->min = 70;
        $plan->nodes[0]->children[0]->goals[0]->min = -1;
        $this->withToken($this->token)->postJson('/api/training/validate', (array) $plan)->assertUnprocessable();
    }

    public function test_historical_planning_origin_cannot_be_rewritten(): void
    {
        $library = $this->library();
        $session = (object) ['kind' => 'session', 'schemaVersion' => 2, 'id' => 'planned-session', 'date' => '2026-11-18T10:00:00.000Z', 'plan' => $library->workouts[0], 'entries' => [
            (object) ['key' => '0r0/0', 'stepId' => 'step-a', 'values' => (object) [], 'done' => false, 'skipped' => false, 'note' => ''],
            (object) ['key' => '0r1/0', 'stepId' => 'step-a', 'values' => (object) [], 'done' => false, 'skipped' => false, 'note' => ''],
        ], 'completed' => true, 'note' => '', 'planning' => (object) ['activationId' => 'activation-one', 'programId' => 'program-one', 'programRevision' => 1, 'slotId' => 'slot-one', 'day' => 9, 'programTitle' => 'Microciclo livre', 'stimulus' => 'Técnica']];
        $library->sessions = [$session];
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 0, 'library' => $library])->assertOk();
        $session->planning->programRevision = 2;
        $this->withToken($this->token)->putJson('/api/training', ['revision' => 1, 'library' => $library])->assertUnprocessable();
    }
}
