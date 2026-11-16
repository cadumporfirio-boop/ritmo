<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrainingStateTest extends TestCase
{
    use RefreshDatabase;

    private string $token = 'test-owner-token-with-at-least-32-characters';

    protected function setUp(): void
    {
        parent::setUp();
        config(['ritmo.owner_token' => $this->token]);
    }

    private function state(): array
    {
        return ['version' => 1, 'profile' => ['name' => 'Teste', 'goal' => 'Reduzir gordura', 'experience' => 'Intermediário', 'equipment' => 'Academia', 'autonomy' => true],
            'week' => array_map(fn ($day) => ['day' => $day, 'name' => 'Descanso', 'time' => null, 'type' => 'rest', 'minutes' => 0], ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']),
            'sessions' => [], 'active' => null];
    }

    public function test_private_data_requires_owner_token(): void
    {
        $this->getJson('/api/state')->assertUnauthorized();
        $this->withToken('wrong')->putJson('/api/state', [])->assertUnauthorized();
    }

    public function test_missing_configuration_fails_closed(): void
    {
        config(['ritmo.owner_token' => null]);
        $this->getJson('/api/state')->assertStatus(503);
    }

    public function test_state_round_trip_and_conflict_protection(): void
    {
        $payload = $this->state();
        $this->withToken($this->token)->putJson('/api/state', ['revision' => 0, 'state' => $payload])->assertOk()->assertJsonPath('revision', 1);
        $this->withToken($this->token)->getJson('/api/state')->assertOk()->assertJsonPath('state.profile.goal', 'Reduzir gordura');
        $payload['profile']['goal'] = 'Alteração antiga';
        $this->withToken($this->token)->putJson('/api/state', ['revision' => 0, 'state' => $payload])->assertStatus(409);
        $this->withToken($this->token)->getJson('/api/state')->assertJsonPath('state.profile.goal', 'Reduzir gordura');
    }

    public function test_invalid_week_is_rejected(): void
    {
        $state = $this->state();
        $state['week'][0]['time'] = '35:99';
        $this->withToken($this->token)->putJson('/api/state', ['revision' => 0, 'state' => $state])->assertUnprocessable();
    }

    public function test_ai_does_not_return_a_fake_plan(): void
    {
        $this->postJson('/api/planning', [])->assertStatus(503)->assertJsonPath('code', 'AI_NOT_CONFIGURED');
    }

    public function test_structured_exercise_goals_are_preserved_and_invalid_range_returns_422(): void
    {
        $state = $this->state();
        $state['active'] = [
            'id' => '75d0c3f4-85af-4ab9-818d-e203149ae52f', 'date' => '2026-11-13T10:00:00Z',
            'name' => 'Superiores', 'minutes' => 45, 'note' => '', 'completed' => false,
            'exercises' => [[
                'id' => '3d85ec91-c042-41e0-bd9a-8ffebda8d857', 'name' => 'Supino',
                'detail' => 'Trabalho', 'target' => '8–12 reps', 'previous' => 'Sem registro',
                'metrics' => ['key' => 'supino', 'loadBasis' => 'Por halter', 'setType' => 'Trabalho', 'repMin' => 8, 'repMax' => 12],
                'sets' => [['kg' => 20, 'reps' => 10, 'rir' => 2, 'done' => true]],
            ]],
        ];

        $this->withToken($this->token)->putJson('/api/state', ['revision' => 0, 'state' => $state])->assertOk();
        $this->withToken($this->token)->getJson('/api/state')->assertJsonPath('state.active.exercises.0.metrics.repMax', 12);

        $state['active']['exercises'][0]['metrics']['repMax'] = 6;
        $this->withToken($this->token)->putJson('/api/state', ['revision' => 1, 'state' => $state])->assertUnprocessable();
        $this->withToken($this->token)->getJson('/api/state')->assertJsonPath('revision', 1);
    }
}
