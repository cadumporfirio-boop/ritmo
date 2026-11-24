<?php

namespace App\Http\Controllers;

use App\AiExchangeContract;
use App\PlanningProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use JsonException;
use stdClass;
use Throwable;

class AiPlanningController extends Controller
{
    public function capabilities(PlanningProvider $provider): JsonResponse
    {
        return response()->json(['contractVersion' => 1, 'manualExchange' => true, 'apiEnabled' => (bool) config('ritmo.ai_enabled') && $provider->isConfigured(), 'message' => 'A troca manual funciona sem API. A conexão automática exige configuração no servidor.']);
    }

    public function validateResponse(Request $request, AiExchangeContract $contract): JsonResponse
    {
        $contract->assertValid($this->payload($request), 'ritmo.ai.plan');

        return response()->json(['valid' => true, 'contractVersion' => 1]);
    }

    public function generate(Request $request, PlanningProvider $provider, AiExchangeContract $contract): JsonResponse
    {
        if (! config('ritmo.ai_enabled')) {
            return response()->json(['code' => 'AI_DISABLED', 'message' => 'A conexão automática está desativada. Use a troca manual.'], 503);
        }
        if (! $provider->isConfigured()) {
            return response()->json(['code' => 'AI_NOT_CONFIGURED', 'message' => 'Nenhum provedor de IA foi configurado.'], 503);
        }
        $payload = $contract->assertValid($this->payload($request), 'ritmo.ai.request');
        try {
            $response = $contract->assertValid($provider->generate($payload), 'ritmo.ai.plan');
            if ($response->requestId !== $payload->requestId || (($response->plan->kind ?? null) === 'program' ? 'advanced' : 'guided') !== $payload->responseFormat) {
                throw new \RuntimeException('Resposta de outro pedido.');
            }
        } catch (Throwable) {
            return response()->json(['code' => 'AI_INVALID_RESPONSE', 'message' => 'O provedor não retornou um planejamento válido para este pedido. Nenhum dado foi salvo.'], 502);
        }

        return response()->json($response);
    }

    private function payload(Request $request): stdClass
    {
        try {
            $value = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw ValidationException::withMessages(['ai' => 'JSON inválido.']);
        }
        if (! $value instanceof stdClass) {
            throw ValidationException::withMessages(['ai' => 'Envie um objeto JSON.']);
        }

        return $value;
    }
}
