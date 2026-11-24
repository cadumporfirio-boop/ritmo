<?php

namespace App;

use stdClass;

interface PlanningProvider
{
    public function isConfigured(): bool;

    public function generate(stdClass $request): stdClass;
}
