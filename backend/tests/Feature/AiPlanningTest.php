<?php

namespace Tests\Feature;

use App\PlanningProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use stdClass;
use Tests\TestCase;

class AiPlanningTest extends TestCase
{
    use RefreshDatabase;

    private string $token = 'ai-exchange-test-owner-token-long-enough';

    protected function setUp(): void
    {
        parent::setUp();
        config(['ritmo.owner_token' => $this->token, 'ritmo.ai_enabled' => false, 'cache.default' => 'array']);
        Http::fake();
    }

    private function requestPayload(): array
    {
        return ['kind' => 'ritmo.ai.request', 'schemaVersion' => 1, 'requestId' => 'test-request', 'responseFormat' => 'guided', 'createdAt' => '2026-11-24T12:00:00.000Z', 'instructions' => 'Monte meu planejamento completo.', 'context' => (object) [], 'workouts' => [], 'currentProgram' => null, 'history' => [], 'scope' => ['historyIncluded' => false, 'historyMaxSessions' => 5, 'historyOnlyConfirmed' => true]];
    }

    private function responsePayload(): stdClass
    {
        $response = json_decode(file_get_contents(base_path('../frontend/tests/fixtures/ai-plan.json')));
        $response->requestId = 'test-request';

        return $response;
    }

    public function test_ai_entry_requires_owner_and_is_disabled_by_default(): void
    {
        $this->getJson('/api/ai/capabilities')->assertUnauthorized();
        $this->postJson('/api/ai/planning', $this->requestPayload())->assertUnauthorized();
        $this->withToken($this->token)->getJson('/api/ai/capabilities')->assertOk()->assertJsonPath('manualExchange', true)->assertJsonPath('apiEnabled', false);
        $this->withToken($this->token)->postJson('/api/ai/planning', $this->requestPayload())->assertStatus(503)->assertJsonPath('code', 'AI_DISABLED');
        config(['ritmo.ai_enabled' => true]);
        $this->withToken($this->token)->postJson('/api/ai/planning', $this->requestPayload())->assertStatus(503)->assertJsonPath('code', 'AI_NOT_CONFIGURED');
        Http::assertNothingSent();
    }

    public function test_manual_response_can_be_validated_without_a_provider_and_without_saving(): void
    {
        $response = $this->responsePayload();
        $this->withToken($this->token)->postJson('/api/ai/validate-response', (array) $response)->assertOk()->assertJsonPath('valid', true);
        $response->plan->routines[0]->sequence = ['missing'];
        $this->withToken($this->token)->postJson('/api/ai/validate-response', (array) $response)->assertUnprocessable();
        $this->assertDatabaseCount('training_states', 0);
        Http::assertNothingSent();
    }

    public function test_configured_adapter_uses_contract_and_request_identity_but_does_not_save(): void
    {
        config(['ritmo.ai_enabled' => true]);
        $fixture = $this->responsePayload();
        $provider = new class($fixture) implements PlanningProvider
        {
            public int $calls = 0;

            public function __construct(public stdClass $response) {}

            public function isConfigured(): bool
            {
                return true;
            }

            public function generate(stdClass $request): stdClass
            {
                $this->calls++;

                return $this->response;
            }
        };
        $this->app->instance(PlanningProvider::class, $provider);
        $this->withToken($this->token)->postJson('/api/ai/planning', $this->requestPayload())->assertOk()->assertJsonPath('kind', 'ritmo.ai.plan')->assertJsonPath('requestId', 'test-request');
        $this->assertSame(1, $provider->calls);
        $invalid = $this->requestPayload();
        $invalid['instructions'] = '';
        $this->withToken($this->token)->postJson('/api/ai/planning', $invalid)->assertUnprocessable();
        $this->assertSame(1, $provider->calls);
        $provider->response->requestId = 'another-request';
        $this->withToken($this->token)->postJson('/api/ai/planning', $this->requestPayload())->assertStatus(502)->assertJsonPath('code', 'AI_INVALID_RESPONSE');
        $this->assertDatabaseCount('training_states', 0);
        Http::assertNothingSent();
    }

    public function test_response_rejects_invalid_metrics_and_missing_approach_variants(): void
    {
        $response = $this->responsePayload();
        $response->plan->routines[0]->exercises[0]->variants[0]->series[0]->goals[2]->max = 11;
        $this->withToken($this->token)->postJson('/api/ai/validate-response', (array) $response)->assertUnprocessable();
        $response = $this->responsePayload();
        array_pop($response->plan->routines[0]->exercises[0]->variants);
        $this->withToken($this->token)->postJson('/api/ai/validate-response', (array) $response)->assertUnprocessable();
        $this->assertDatabaseCount('training_states', 0);
    }

    public function test_advanced_response_preserves_free_duration_and_rejects_period_cycles(): void
    {
        $response = json_decode(file_get_contents(base_path('../frontend/tests/fixtures/ai-advanced-plan.json')));
        $this->withToken($this->token)->postJson('/api/ai/validate-response', (array) $response)->assertOk();
        $response->plan->periods[0]->parentId = $response->plan->periods[0]->id;
        $this->withToken($this->token)->postJson('/api/ai/validate-response', (array) $response)->assertUnprocessable();
        $this->assertDatabaseCount('training_states', 0);
        Http::assertNothingSent();
    }
}
