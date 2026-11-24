<?php

return [
    // Primeiro piloto: uma instalação privada, um proprietário.
    'owner_token' => env('RITMO_OWNER_TOKEN'),
    'ai_enabled' => (bool) env('RITMO_AI_ENABLED', false),
];
