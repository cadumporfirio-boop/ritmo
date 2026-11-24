<?php

namespace App;

use Illuminate\Validation\ValidationException;
use Opis\JsonSchema\Validator;
use stdClass;

class AiExchangeContract
{
    public function assertValid(mixed $data, string $kind): stdClass
    {
        $encoded = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($encoded) > ($kind === 'ritmo.ai.request' ? 250000 : 5000000)) {
            $this->fail('Comunicação maior que o limite permitido.');
        }
        $schema = json_decode(file_get_contents(base_path('../contracts/ai-exchange.schema.json')), false, 512, JSON_THROW_ON_ERROR);
        if (! (new Validator)->validate($data, $schema)->isValid() || ! $data instanceof stdClass || $data->kind !== $kind) {
            $this->fail('Comunicação de IA fora do contrato.');
        }
        if ($kind === 'ritmo.ai.request') {
            if (trim($data->instructions) === '' || strtotime($data->createdAt) === false) {
                $this->fail('Informe pedido e data válidos.');
            }
            foreach ($data->workouts as $workout) {
                app(TrainingContract::class)->assertValid($workout, 'workout');
            }
        } else {
            $this->assertPlan($data->plan);
        }

        return $data;
    }

    private function assertPlan(stdClass $plan): void
    {
        if (($plan->kind ?? null) === 'program') {
            $this->assertAdvancedPlan($plan);

            return;
        }
        if (trim($plan->title) === '' || trim($plan->objective) === '' || count($plan->routines) * $plan->weeks > 500) {
            $this->fail('Confira título, objetivo e limite de 500 sessões.');
        }
        if ($plan->startDate !== '') {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $plan->startDate);
            if ($date === false || $date->format('Y-m-d') !== $plan->startDate) {
                $this->fail('Data inicial inválida.');
            }
        }
        $approaches = [];
        foreach ($plan->approaches as $approach) {
            if (isset($approaches[$approach->key]) || trim($approach->name) === '') {
                $this->fail('Abordagens sem nome ou com chave repetida.');
            }
            $approaches[$approach->key] = true;
        }
        $routineKeys = [];
        foreach ($plan->routines as $routine) {
            if (isset($routineKeys[$routine->key]) || trim($routine->name) === '' || count($routine->sequence) !== $plan->weeks) {
                $this->fail('Treino repetido, sem nome ou com semanas incompletas.');
            }
            $routineKeys[$routine->key] = true;
            foreach ($routine->sequence as $key) {
                if (! isset($approaches[$key])) {
                    $this->fail('A sequência usa uma abordagem inexistente.');
                }
            }
            $exerciseKeys = [];
            foreach ($routine->exercises as $exercise) {
                if (isset($exerciseKeys[$exercise->key]) || trim($exercise->name) === '' || count($exercise->variants) !== count($approaches)) {
                    $this->fail('Confira os exercícios e as variantes de cada abordagem.');
                }
                $exerciseKeys[$exercise->key] = true;
                $variants = [];
                foreach ($exercise->variants as $variant) {
                    if (! isset($approaches[$variant->approachKey]) || isset($variants[$variant->approachKey])) {
                        $this->fail('Variante com abordagem inexistente ou repetida.');
                    }
                    $variants[$variant->approachKey] = $variant;
                }
            }
            foreach ($plan->approaches as $approach) {
                $nodes = [];
                foreach ($routine->exercises as $index => $exercise) {
                    $variant = array_find($exercise->variants, fn (stdClass $candidate): bool => $candidate->approachKey === $approach->key);
                    $series = [];
                    foreach ($variant->series as $seriesIndex => $definition) {
                        $series[] = (object) ['id' => 'series-'.$index.'-'.$seriesIndex, 'role' => $definition->role, 'goals' => $definition->goals];
                    }
                    $nodes[] = (object) ['kind' => 'step', 'id' => 'exercise-'.$index, 'name' => $exercise->name, 'role' => 'work', 'equipment' => '', 'notes' => $exercise->notes, 'goals' => [], 'series' => $series];
                }
                $workout = (object) ['kind' => 'workout', 'schemaVersion' => 2, 'id' => 'ai-preview', 'revision' => 1, 'title' => $routine->name, 'sport' => $routine->sport, 'notes' => '', 'nodes' => $nodes];
                app(TrainingContract::class)->assertValid($workout, 'workout');
            }
        }
    }

    private function assertAdvancedPlan(stdClass $plan): void
    {
        if (trim($plan->title) === '' || trim($plan->context->objective) === '') {
            $this->fail('Informe nome e objetivo do planejamento.');
        }
        if ($plan->startDate !== '') {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $plan->startDate);
            if ($date === false || $date->format('Y-m-d') !== $plan->startDate) {
                $this->fail('Data inicial inválida.');
            }
        }
        $ids = [];
        foreach ([...$plan->periods, ...$plan->progressions, ...$plan->slots] as $item) {
            if (isset($ids[$item->id])) {
                $this->fail('Identificador repetido no planejamento.');
            }
            $ids[$item->id] = true;
        }
        foreach ($plan->periods as $period) {
            if (trim($period->name) === '' || $period->startDay + $period->durationDays - 1 > $plan->durationDays) {
                $this->fail('Período fora da duração do planejamento.');
            }
            $visited = [$period->id => true];
            $current = $period;
            while ($current->parentId !== null) {
                $parent = array_find($plan->periods, fn (stdClass $candidate): bool => $candidate->id === $current->parentId);
                if ($parent === null || isset($visited[$parent->id]) || $current->startDay < $parent->startDay || $current->startDay + $current->durationDays > $parent->startDay + $parent->durationDays) {
                    $this->fail('Hierarquia de períodos inválida.');
                }
                $visited[$parent->id] = true;
                $current = $parent;
            }
        }
        foreach ($plan->slots as $slot) {
            if ($slot->day > $plan->durationDays || trim($slot->label) === '') {
                $this->fail('Sessão fora da duração ou sem nome.');
            }
            app(TrainingContract::class)->assertValid($slot->workout, 'workout');
            $stepIds = [];
            $this->collectSteps($slot->workout->nodes, $stepIds);
            $annotations = [];
            foreach ($slot->exercises as $exercise) {
                if (! isset($stepIds[$exercise->stepId]) || isset($annotations[$exercise->stepId])) {
                    $this->fail('Estratégia de exercício inexistente ou repetida.');
                }
                $annotations[$exercise->stepId] = true;
                foreach ($exercise->progressionIds as $id) {
                    if (! array_any($plan->progressions, fn (stdClass $rule): bool => $rule->id === $id)) {
                        $this->fail('Estratégia de progressão não encontrada.');
                    }
                }
            }
        }
    }

    private function collectSteps(array $nodes, array &$ids): void
    {
        foreach ($nodes as $node) {
            if ($node->kind === 'group') {
                $this->collectSteps($node->children, $ids);
            } else {
                $ids[$node->id] = true;
            }
        }
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['ai' => $message]);
    }
}
