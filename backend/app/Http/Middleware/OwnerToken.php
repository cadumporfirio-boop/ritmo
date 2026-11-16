<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OwnerToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('ritmo.owner_token');
        if (! is_string($expected) || strlen($expected) < 32) {
            return response()->json(['message' => 'Configure RITMO_OWNER_TOKEN com pelo menos 32 caracteres no servidor.'], 503);
        }
        $provided = $request->bearerToken();
        if (! is_string($provided) || ! hash_equals($expected, $provided)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 401);
        }

        return $next($request);
    }
}
