<?php

namespace App;

use Illuminate\Validation\ValidationException;
use Opis\JsonSchema\Validator;
use stdClass;

class TrainingContract
{
    public function assertValid(mixed $data, string $kind): stdClass
    {
        $encoded = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($encoded) > 5000000) {
            $this->fail('O arquivo excede o limite de 5 MB.');
        }
        $schema = json_decode(file_get_contents(base_path('../contracts/training.schema.json')), false, 512, JSON_THROW_ON_ERROR);
        $result = (new Validator)->validate($data, $schema);
        if (! $result->isValid() || ! $data instanceof stdClass || $data->kind !== $kind) {
            $this->fail('Formato de treino inválido. Confira campos, unidades e limites.');
        }
        if ($kind === 'workout') {
            $this->workout($data);
        } elseif ($kind === 'session') {
            $this->session($data);
        } else {
            if (($data->active?->completed ?? false) || array_any($data->sessions, fn (stdClass $session): bool => ! $session->completed)) {
                $this->fail('O estado da sessão não corresponde à posição no histórico.');
            }
            $versions = [];
            foreach ($data->workouts as $plan) {
                $this->workout($plan);
                $key = $plan->id.':'.$plan->revision;
                if (isset($versions[$key])) {
                    $this->fail('Versão de ficha duplicada.');
                }
                $versions[$key] = true;
            }
            $ids = [];
            foreach ([...$data->sessions, ...($data->active ? [$data->active] : [])] as $session) {
                $this->session($session);
                if (isset($ids[$session->id])) {
                    $this->fail('Sessão duplicada.');
                }
                $ids[$session->id] = true;
            }
        }

        return $data;
    }

    public function preserveVersions(stdClass $previous, stdClass $next): void
    {
        foreach ($previous->workouts ?? [] as $old) {
            $found = array_find($next->workouts, fn (stdClass $plan): bool => $plan->id === $old->id && $plan->revision === $old->revision);
            if ($found === null || $found != $old) {
                $this->fail('Versões existentes não podem ser apagadas ou reescritas. Salve uma nova versão da ficha.');
            }
        }
        foreach ($previous->sessions ?? [] as $old) {
            $found = array_find($next->sessions, fn (stdClass $session): bool => $session->id === $old->id);
            if ($found === null || $found->plan != $old->plan) {
                $this->fail('A ficha de uma sessão histórica deve ser preservada.');
            }
        }
    }

    /** @return array<int, array{key:string, step:stdClass}> */
    private function workout(stdClass $plan): array
    {
        if (trim($plan->title) === '') {
            $this->fail('Dê um nome ao treino.');
        }
        $ids = [];
        $this->nodes($plan->nodes, $ids, 0);
        $expanded = [];
        $this->expand($plan->nodes, '', $expanded);

        return $expanded;
    }

    /** @param array<int, stdClass> $nodes
     * @param  array<string, bool>  $ids
     */
    private function nodes(array $nodes, array &$ids, int $depth): void
    {
        if ($depth > 4) {
            $this->fail('Use no máximo 4 níveis de blocos.');
        }
        foreach ($nodes as $node) {
            if (isset($ids[$node->id])) {
                $this->fail('Cada etapa ou bloco precisa de um identificador único.');
            }
            $ids[$node->id] = true;
            if (trim($node->name) === '') {
                $this->fail('Dê nome às atividades e aos blocos.');
            }
            if ($node->kind === 'group') {
                $this->nodes($node->children, $ids, $depth + 1);
            } else {
                foreach ($node->series ?? [] as $series) {
                    $definition = clone $node;
                    unset($definition->series);
                    $definition->id = $series->id;
                    $definition->role = $series->role;
                    $definition->goals = $series->goals;
                    $this->nodes([$definition], $ids, $depth);
                }
                $metrics = [];
                foreach ($node->goals as $goal) {
                    if (isset($metrics[$goal->metric])) {
                        $this->fail('Não repita uma métrica na mesma etapa.');
                    }
                    $metrics[$goal->metric] = true;
                    foreach (['min', 'max'] as $bound) {
                        if (isset($goal->$bound) && ! $this->metricValid($goal->metric, $goal->$bound)) {
                            $this->fail('Meta fora dos limites da métrica.');
                        }
                    }
                    if ($goal->mode === 'record' && (isset($goal->min) || isset($goal->max))) {
                        $this->fail('Uma métrica apenas registrada não tem limite de meta.');
                    }
                    if ($goal->mode === 'range' && $goal->min > $goal->max) {
                        $this->fail('O mínimo da meta não pode superar o máximo.');
                    }
                    if ($goal->mode === 'exact' && $goal->min != $goal->max) {
                        $this->fail('A meta exata precisa ter limites iguais.');
                    }
                }
            }
        }
    }

    /** @param array<int, stdClass> $nodes
     * @param  array<int, array{key:string, step:stdClass}>  $result
     */
    private function expand(array $nodes, string $prefix, array &$result): void
    {
        foreach ($nodes as $index => $node) {
            $key = $prefix.$index;
            if ($node->kind === 'step') {
                if (isset($node->series)) {
                    foreach ($node->series as $seriesIndex => $series) {
                        $definition = clone $node;
                        $definition->role = $series->role;
                        $definition->goals = $series->goals;
                        $result[] = ['key' => $key.'s'.$seriesIndex, 'step' => $definition];
                    }
                } else {
                    $result[] = ['key' => $key, 'step' => $node];
                }
                if (count($result) > 300) {
                    $this->fail('O treino excede 300 etapas executadas. Divida-o em sessões.');
                }
            } else {
                for ($round = 0; $round < $node->repeat; $round++) {
                    $this->expand($node->children, $key.'r'.$round.'/', $result);
                }
            }
        }
    }

    private function session(stdClass $session): void
    {
        $expanded = $this->workout($session->plan);
        $original = array_values(array_filter($session->entries, fn (stdClass $entry): bool => ! isset($entry->extra)));
        if (strtotime($session->date) === false || count($expanded) !== count($original)) {
            $this->fail('O registro não corresponde às etapas da ficha.');
        }
        $byKey = [];
        foreach ($expanded as $index => $item) {
            if ($original[$index]->key !== $item['key']) {
                $this->fail('O registro não corresponde às etapas da ficha.');
            }
            $byKey[$item['key']] = $item;
        }
        $keys = [];
        $extraCount = 0;
        foreach ($session->entries as $entry) {
            if (isset($keys[$entry->key])) {
                $this->fail('Registro duplicado.');
            }
            $keys[$entry->key] = true;
            if (isset($entry->extra)) {
                $anchor = $byKey[$entry->extra->afterKey] ?? null;
                if ($anchor === null || $anchor['step']->id !== $entry->stepId || isset($byKey[$entry->key]) || ++$extraCount > 100) {
                    $this->fail('Série extra incompatível.');
                }
                $definition = clone $anchor['step'];
                unset($definition->series);
                $definition->role = $entry->extra->role;
                $definition->goals = $entry->extra->goals;
                $ids = [];
                $this->nodes([$definition], $ids, 0);
                $item = ['key' => $entry->key, 'step' => $definition];
            } else {
                $item = $byKey[$entry->key] ?? null;
                if ($item === null) {
                    $this->fail('Registro sem etapa.');
                }
            }
            if ($entry->key !== $item['key'] || $entry->stepId !== $item['step']->id) {
                $this->fail('Identificação de etapa incompatível.');
            }
            if ($entry->done && $entry->skipped) {
                $this->fail('Uma etapa não pode estar concluída e não realizada ao mesmo tempo.');
            }
            $allowed = array_map(fn (stdClass $goal): string => $goal->metric, $item['step']->goals);
            foreach (array_keys(get_object_vars($entry->values)) as $metric) {
                if (! in_array($metric, $allowed, true)) {
                    $this->fail('Há métricas que não pertencem à etapa.');
                }
            }
            if ($entry->done) {
                foreach ($item['step']->goals as $goal) {
                    if ((! isset($entry->values->{$goal->metric}) && $goal->required) ||
                        (isset($entry->values->{$goal->metric}) && ! $this->metricValid($goal->metric, $entry->values->{$goal->metric}))) {
                        $this->fail('Etapa concluída sem registros obrigatórios válidos.');
                    }
                }
            }
        }
    }

    private function metricValid(string $metric, mixed $value): bool
    {
        $limits = [
            'reps' => [0, 1000, true], 'load' => [0, 2000, false],
            'rir' => [0, 10, true], 'rpe' => [0, 10, false],
            'duration' => [0.01, 86400, false], 'distance' => [0.01, 1000000, false],
            'heartRate' => [1, 300, true], 'power' => [0, 10000, false],
            'cadence' => [0, 500, false], 'pace' => [0.01, 36000, false],
        ];
        [$min, $max, $integer] = $limits[$metric];

        return (is_int($value) || is_float($value)) && is_finite((float) $value)
            && $value >= $min && $value <= $max && (! $integer || floor($value) == $value);
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['library' => $message]);
    }
}
