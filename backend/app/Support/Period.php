<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Http\Request;

class Period
{
    private const MAX = ['day' => 366, 'month' => 120, 'year' => 50];
    private const DEFAULT = ['day' => 30, 'month' => 12, 'year' => 5];

    public function __construct(public string $unit, public Carbon $from, public Carbon $to)
    {
    }

    /** Reads ?period=day|month|year and either ?last=N or ?from=&to= */
    public static function from(Request $r): self
    {
        $unit = in_array($r->query('period'), array_keys(self::MAX), true) ? $r->query('period') : 'month';

        try {
            $to = $r->filled('to') ? Carbon::parse($r->query('to')) : now();
            $from = $r->filled('from') ? Carbon::parse($r->query('from')) : null;
        } catch (\Throwable $e) {
            abort(422, 'Invalid date range.');
        }

        $to = $to->copy()->endOf($unit);

        if ($from) {
            $from = $from->copy()->startOf($unit);
        } else {
            $n = max(1, min((int) $r->query('last', self::DEFAULT[$unit]), self::MAX[$unit])) - 1;
            $from = match ($unit) {
                'day' => $to->copy()->subDays($n)->startOfDay(),
                'month' => $to->copy()->startOfMonth()->subMonthsNoOverflow($n),
                default => $to->copy()->startOfYear()->subYears($n),
            };
        }

        abort_if($from->gt($to), 422, 'The start date must be before the end date.');

        $p = new self($unit, $from, $to);
        $p->buckets(); // validates the size of the range

        return $p;
    }

    private function pg(): string
    {
        return ['day' => 'YYYY-MM-DD', 'month' => 'YYYY-MM', 'year' => 'YYYY'][$this->unit];
    }

    private function php(): string
    {
        return ['day' => 'Y-m-d', 'month' => 'Y-m', 'year' => 'Y'][$this->unit];
    }

    /** Every day / month / year key between from and to */
    public function buckets(): array
    {
        $out = [];
        $c = $this->from->copy();

        while ($c->lte($this->to)) {
            $out[] = $c->format($this->php());
            abort_if(count($out) > self::MAX[$this->unit], 422, 'Range is too large. Choose a larger unit (month or year).');
            $c = match ($this->unit) {
                'day' => $c->copy()->addDay(),
                'month' => $c->copy()->addMonthNoOverflow(),
                default => $c->copy()->addYear(),
            };
        }

        return $out;
    }

    /** Grouped values per bucket, with zeros for empty buckets */
    public function series($query, string $agg = 'count(*)', string $col = 'created_at'): array
    {
        $fmt = $this->pg();

        $rows = (clone $query)
            ->whereBetween($col, [$this->from, $this->to])
            ->selectRaw("to_char({$col}, '{$fmt}') as k, {$agg} as v")
            ->groupBy('k')
            ->pluck('v', 'k');

        return array_map(fn ($k) => ['key' => $k, 'total' => (int) ($rows[$k] ?? 0)], $this->buckets());
    }

    public function meta(): array
    {
        return [
            'unit' => $this->unit,
            'from' => $this->from->toDateString(),
            'to' => $this->to->toDateString(),
        ];
    }
}
