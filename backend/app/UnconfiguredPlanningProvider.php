<?php

namespace App;

use LogicException;
use stdClass;

class UnconfiguredPlanningProvider implements PlanningProvider
{
    public function isConfigured(): bool
    {
        return false;
    }

    public function generate(stdClass $request): stdClass
    {
        throw new LogicException('Nenhum provedor de IA foi configurado.');
    }
}
